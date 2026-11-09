'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Activity, AlertOctagon, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Database,
  RefreshCw, ShieldCheck, Users, Zap,
} from 'lucide-react';
import { fetchAll } from '../lib/finance';
import { ERROR_TABLE, reportError, type Severity } from '../lib/errorMonitor';
import { Badge, Btn, Card, EmptyState, Segmented, Stat, inputCls, thCls, tdCls, type ToastKind, type Tone } from './ui';

export interface DataSourceStatus {
  key: string;
  label: string;
  ok: boolean;
  rows: number;
  ms: number;
  error?: string | null;
  truncated?: boolean;
}

export interface HealthStats {
  open24h: number;
  critical24h: number;
  failedSources: number;
  setupNeeded: boolean;
}

interface ErrorRow {
  id: number;
  created_at: string;
  fingerprint: string;
  severity: Severity;
  source: string;
  message: string;
  stack: string | null;
  component: string | null;
  url: string | null;
  user_id: string | null;
  resolved: boolean;
  resolved_at: string | null;
}

interface Group {
  fingerprint: string;
  message: string;
  source: string;
  component: string | null;
  severity: Severity;
  total: number;
  open: number;
  firstSeen: string;
  lastSeen: string;
  users: number;
  url: string | null;
  stack: string | null;
  regressed: boolean;
}

const SEV_RANK: Record<Severity, number> = { info: 0, warning: 1, error: 2, critical: 3 };
const SEV_TONE: Record<Severity, Tone> = { info: 'info', warning: 'warning', error: 'negative', critical: 'negative' };

const fmtIST = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

const ago = (iso: string) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const isMissingTable = (e: { message?: string; code?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|Could not find the table/i.test(e.message || ''));

export default function SystemHealthPanel({
  dataSources, queryLatency, adminId, notify, onStats,
}: {
  dataSources: DataSourceStatus[];
  queryLatency: number;
  adminId: string | null;
  notify: (text: string, kind?: ToastKind) => void;
  onStats?: (s: HealthStats) => void;
}) {
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [sevFilter, setSevFilter] = useState<'all' | Severity>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const res = await fetchAll<ErrorRow>(
      (from, to) =>
        supabase.from(ERROR_TABLE).select('*').gte('created_at', since)
          .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to),
      { maxRows: 5000 }
    );
    if (res.error) {
      setSetupNeeded(isMissingTable(res.error));
      setLoadError(isMissingTable(res.error) ? null : res.error.message);
    } else {
      setSetupNeeded(false);
      setLoadError(null);
    }
    setRows(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  /* Live feed: new crash appears instantly, resolved state syncs across admins */
  useEffect(() => {
    if (setupNeeded) return;
    const channel = supabase
      .channel('admin-error-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: ERROR_TABLE }, (payload: any) => {
        const row = payload.new as ErrorRow;
        setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev].slice(0, 5000)));
        if (row.severity === 'critical') notify(`Critical error: ${row.message.slice(0, 120)}`, 'error');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: ERROR_TABLE }, (payload: any) => {
        const row = payload.new as ErrorRow;
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [setupNeeded, notify]);

  const stats = useMemo(() => {
    const d24 = now - 86400_000;
    const last24 = rows.filter((r) => new Date(r.created_at).getTime() >= d24);
    const open24 = last24.filter((r) => !r.resolved);
    const hours = Array.from({ length: 24 }, () => 0);
    last24.forEach((r) => {
      const h = 23 - Math.min(23, Math.floor((now - new Date(r.created_at).getTime()) / 3600_000));
      hours[h]++;
    });
    return {
      total24: last24.length,
      open24: open24.length,
      critical24: open24.filter((r) => r.severity === 'critical').length,
      users24: new Set(last24.map((r) => r.user_id).filter(Boolean)).size,
      total7: rows.length,
      openAll: rows.filter((r) => !r.resolved).length,
      hours,
    };
  }, [rows, now]);

  const failedSources = dataSources.filter((d) => !d.ok).length;

  useEffect(() => {
    onStats?.({ open24h: stats.open24, critical24h: stats.critical24, failedSources, setupNeeded });
  }, [stats.open24, stats.critical24, failedSources, setupNeeded, onStats]);

  const groups = useMemo(() => {
    const map = new Map<string, { rows: ErrorRow[] }>();
    rows.forEach((r) => {
      const g = map.get(r.fingerprint) || { rows: [] };
      g.rows.push(r);
      map.set(r.fingerprint, g);
    });
    const out: Group[] = [];
    map.forEach(({ rows: rs }, fp) => {
      const newest = rs[0];
      const open = rs.filter((r) => !r.resolved).length;
      out.push({
        fingerprint: fp,
        message: newest.message,
        source: newest.source,
        component: newest.component,
        severity: rs.reduce<Severity>((m, r) => (SEV_RANK[r.severity] > SEV_RANK[m] ? r.severity : m), 'info'),
        total: rs.length,
        open,
        firstSeen: rs[rs.length - 1].created_at,
        lastSeen: newest.created_at,
        users: new Set(rs.map((r) => r.user_id).filter(Boolean)).size,
        url: newest.url,
        stack: rs.find((r) => r.stack)?.stack ?? null,
        regressed: open > 0 && open < rs.length,
      });
    });
    return out;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .filter((g) => (statusFilter === 'all' ? true : statusFilter === 'open' ? g.open > 0 : g.open === 0))
      .filter((g) => sevFilter === 'all' || g.severity === sevFilter)
      .filter((g) => !q || g.message.toLowerCase().includes(q) || (g.component || '').toLowerCase().includes(q) || g.source.includes(q))
      .sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || +new Date(b.lastSeen) - +new Date(a.lastSeen))
      .slice(0, 60);
  }, [groups, statusFilter, sevFilter, search]);

  const setResolved = async (fp: string, resolved: boolean) => {
    const patch = resolved
      ? { resolved: true, resolved_at: new Date().toISOString(), resolved_by: adminId }
      : { resolved: false, resolved_at: null, resolved_by: null };
    const q = supabase.from(ERROR_TABLE).update(patch).eq('fingerprint', fp);
    const { error } = await (resolved ? q.eq('resolved', false) : q);
    if (error) { notify(`Could not update: ${error.message}`, 'error'); return; }
    setRows((prev) => prev.map((r) => (r.fingerprint === fp ? { ...r, ...patch } as ErrorRow : r)));
    notify(resolved ? 'Marked as resolved. It will reopen automatically if it happens again.' : 'Issue reopened.', 'success');
  };

  const sendTest = async () => {
    await reportError({ source: 'manual', severity: 'info', message: `Test event from System Health (${new Date().toLocaleTimeString('en-IN')})` });
    notify('Test event sent. It should appear below within a few seconds.', 'info');
    setTimeout(load, 1800);
  };

  /* ----- overall verdict ----- */
  const verdict: { tone: Tone; title: string; text: string } =
    stats.critical24 > 0
      ? { tone: 'negative', title: 'Action required', text: `${stats.critical24} critical error${stats.critical24 > 1 ? 's' : ''} unresolved in the last 24 hours.` }
      : failedSources > 0
        ? { tone: 'negative', title: 'Data source failure', text: `${failedSources} dashboard data source${failedSources > 1 ? 's' : ''} failed to load – numbers shown may be incomplete.` }
        : stats.open24 > 0
          ? { tone: 'warning', title: 'Attention', text: `${stats.open24} unresolved error${stats.open24 > 1 ? 's' : ''} in the last 24 hours, none critical.` }
          : setupNeeded
            ? { tone: 'warning', title: 'Crash logging not set up', text: 'Run the SQL file once to start recording crashes.' }
            : { tone: 'positive', title: 'All systems operational', text: 'No unresolved errors in the last 24 hours.' };

  const verdictCls: Record<Tone, string> = {
    positive: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    negative: 'bg-rose-50 border-rose-200 text-rose-900',
    neutral: 'bg-slate-50 border-slate-200 text-slate-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
  };
  const VerdictIcon = verdict.tone === 'positive' ? CheckCircle2 : verdict.tone === 'negative' ? AlertOctagon : AlertTriangle;

  const latTone: Tone = queryLatency === 0 ? 'neutral' : queryLatency < 400 ? 'positive' : queryLatency < 1200 ? 'warning' : 'negative';
  const latLabel = queryLatency === 0 ? 'Measuring…' : queryLatency < 400 ? 'Fast' : queryLatency < 1200 ? 'Slow' : 'Very slow';
  const maxBar = Math.max(1, ...stats.hours);

  return (
    <div className="space-y-5">
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${verdictCls[verdict.tone]}`}>
        <VerdictIcon className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{verdict.title}</p>
          <p className="text-sm opacity-90">{verdict.text}</p>
        </div>
        <Btn size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Btn>
      </div>

      {setupNeeded && (
        <Card title="One-time setup needed" subtitle="The crash log table does not exist yet.">
          <p className="text-sm text-slate-700">
            Open the Supabase SQL editor and run <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">sql/admin_dashboard_upgrade.sql</code>.
            Then add the monitor to your root layout (see <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">README_UPGRADE.md</code>) so crashes from every page are captured, not only this dashboard.
          </p>
        </Card>
      )}
      {loadError && <p className="text-sm text-rose-700">Could not load error log: {loadError}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Errors (24h)" value={stats.total24} hint={`${stats.total7} in 7 days`} icon={<Activity className="h-4 w-4" />} />
        <Stat label="Unresolved (24h)" value={stats.open24} tone={stats.open24 ? 'warning' : 'positive'} hint={`${stats.openAll} open overall`} icon={<AlertTriangle className="h-4 w-4" />} />
        <Stat label="Critical open" value={stats.critical24} tone={stats.critical24 ? 'negative' : 'positive'} hint="Crashes, API 5xx" icon={<AlertOctagon className="h-4 w-4" />} />
        <Stat label="Users affected (24h)" value={stats.users24} icon={<Users className="h-4 w-4" />} />
        <Stat label="Database latency" value={queryLatency ? `${queryLatency} ms` : '—'} tone={latTone} hint={latLabel} icon={<Zap className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card title="Errors per hour" subtitle="Last 24 hours" className="xl:col-span-1">
          <div className="flex items-end gap-[3px] h-28" role="img" aria-label="Errors per hour for the last 24 hours">
            {stats.hours.map((c, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end h-full" title={`${24 - i}h ago: ${c} error${c === 1 ? '' : 's'}`}>
                <div
                  className={`w-full rounded-t ${c === 0 ? 'bg-slate-100' : 'bg-rose-500'}`}
                  style={{ height: c === 0 ? 3 : `${Math.max(8, (c / maxBar) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1.5"><span>24h ago</span><span>now</span></div>
        </Card>

        <Card
          title="Data source health"
          subtitle="Every query this dashboard runs – a failed one means missing numbers"
          className="xl:col-span-2"
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className={thCls}>Source</th><th className={thCls}>Status</th><th className={`${thCls} text-right`}>Rows</th><th className={`${thCls} text-right`}>Time</th><th className={thCls}>Detail</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {dataSources.length === 0 && (<tr><td colSpan={5}><EmptyState title="Loading data sources…" /></td></tr>)}
                {dataSources.map((d) => (
                  <tr key={d.key}>
                    <td className={`${tdCls} font-medium text-slate-900`}><span className="inline-flex items-center gap-2"><Database className="h-3.5 w-3.5 text-slate-400" />{d.label}</span></td>
                    <td className={tdCls}>{d.ok ? <Badge tone="positive">OK</Badge> : <Badge tone="negative">Failed</Badge>}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{d.rows.toLocaleString('en-IN')}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{d.ms} ms</td>
                    <td className={`${tdCls} text-xs ${d.ok ? 'text-slate-500' : 'text-rose-700'}`}>
                      {d.error || (d.truncated ? 'Row cap reached – totals may be incomplete' : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card
        title="Crash & error log"
        subtitle="Similar errors are grouped. Resolving an issue reopens it automatically if it happens again."
        actions={
          <>
            <Segmented
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as 'open' | 'resolved' | 'all')}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'all', label: 'All' },
              ]}
            />
            <select className={inputCls} value={sevFilter} onChange={(e) => setSevFilter(e.target.value as any)} aria-label="Severity filter">
              <option value="all">All severities</option><option value="critical">Critical</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Info</option>
            </select>
            <input className={`${inputCls} w-44`} placeholder="Search message…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Btn size="sm" onClick={sendTest}><ShieldCheck className="h-3.5 w-3.5" /> Send test event</Btn>
          </>
        }
        bodyClassName="p-0"
      >
        {visible.length === 0 ? (
          <EmptyState title={loading ? 'Loading…' : statusFilter === 'open' ? 'No open issues' : 'Nothing matches the filter'} hint={!loading && statusFilter === 'open' ? 'Crashes captured from any page of the app will show up here in real time.' : undefined} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((g) => {
              const isOpen = expanded === g.fingerprint;
              return (
                <li key={g.fingerprint}>
                  <div className="flex items-start gap-3 px-5 py-3">
                    <button className="mt-1 text-slate-400 hover:text-slate-700" onClick={() => setExpanded(isOpen ? null : g.fingerprint)} aria-label="Toggle details">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={SEV_TONE[g.severity]}>{g.severity.toUpperCase()}</Badge>
                        <Badge>{g.source}</Badge>
                        {g.component && <span className="text-xs text-slate-500 truncate max-w-[16rem]">{g.component}</span>}
                        {g.regressed && <Badge tone="warning">Reoccurred</Badge>}
                        {g.open === 0 && <Badge tone="positive">Resolved</Badge>}
                      </div>
                      <p className="text-sm text-slate-900 mt-1 break-words">{g.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {g.total}× · {g.users} user{g.users === 1 ? '' : 's'} · last {ago(g.lastSeen)} ({fmtIST(g.lastSeen)} IST) · first {fmtIST(g.firstSeen)}
                      </p>
                    </div>
                    {g.open > 0
                      ? <Btn size="sm" onClick={() => setResolved(g.fingerprint, true)}>Mark resolved</Btn>
                      : <Btn size="sm" variant="ghost" onClick={() => setResolved(g.fingerprint, false)}>Reopen</Btn>}
                  </div>
                  {isOpen && (
                    <div className="px-5 pb-4 pl-12 space-y-2">
                      {g.url && <p className="text-xs text-slate-500">Page: <span className="font-mono text-slate-700">{g.url}</span></p>}
                      <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 text-slate-200 text-[11px] leading-relaxed p-3 whitespace-pre-wrap break-words">{g.stack || 'No stack trace was captured for this error.'}</pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
