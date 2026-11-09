'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardChart from './DashboardChart';
import {
  EXCLUDED_ADMIN_USER_ID, REPORT_PERIOD_LABEL, addMonths, currentISTMonth, inr, inr0, isRevenueRow, istDateKey, istMonthKey,
  monthLabel, periodStartMs, previousWindow, resolveAmount, revenueByFY, revenueBySource, round2, hasGatewayPayment,
  isServiceRecord, type ReportPeriod, type RevenueTxn,
} from '../lib/finance';
import { Btn, Card, EmptyState, Stat, downloadCsv, tdCls, thCls } from './ui';

export type MisPeriod = ReportPeriod;
const PERIODS: ReportPeriod[] = ['day', 'week', 'month', 'fy', 'year', 'all'];

const C_EST = '#1d4ed8';
const C_SVC = '#0f766e';

interface Props {
  period: ReportPeriod;
  buildHref: (period: ReportPeriod) => string;
  records: any[];
  monthlyCases: any[];
  txns: RevenueTxn[];
  profiles: any[];
}

const dayLabel = (key: string) => {
  const d = new Date(`${key}T00:00:00+05:30`);
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
};

const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

export default function ReportsPanel({ period, buildHref, records, monthlyCases, txns, profiles }: Props) {
  const startMs = useMemo(() => periodStartMs(period), [period]);
  const prevWin = useMemo(() => previousWindow(period), [period]);

  const isPublic = (t: any) => t.user_id !== EXCLUDED_ADMIN_USER_ID;
  const inWin = (t: any, a: number, b: number) => {
    const ms = new Date(t.created_at || 0).getTime();
    return ms >= a && ms < b;
  };

  /* rows in the selected window (earned revenue only, public users) */
  const rows = useMemo(
    () => txns.filter((t) => isRevenueRow(t) && isPublic(t) && inWin(t, startMs, Date.now() + 1) && resolveAmount(t) > 0),
    [txns, startMs] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const split = useMemo(() => revenueBySource(txns, { adminUserId: EXCLUDED_ADMIN_USER_ID, filter: (t) => inWin(t, startMs, Date.now() + 1) }), [txns, startMs]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevSplit = useMemo(
    () => (prevWin ? revenueBySource(txns, { adminUserId: EXCLUDED_ADMIN_USER_ID, filter: (t) => inWin(t, prevWin[0], prevWin[1]) }) : null),
    [txns, prevWin] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const gateway = split.estimatesGateway.amount + split.servicesGateway.amount;
  const wallet = split.estimatesWallet.amount + split.servicesWallet.amount;
  const customers = useMemo(() => new Set(rows.map((r) => String(r.user_id))).size, [rows]);
  const avgTicket = split.publicCount ? split.total / split.publicCount : 0;
  const d = prevSplit ? pct(split.total, prevSplit.total) : null;

  /* ---------- trend (daily for short windows, monthly otherwise) ---------- */
  const trend = useMemo(() => {
    const daily = period === 'day' || period === 'week' || period === 'month';
    const key = (t: any) => (daily ? istDateKey(t.created_at) : istMonthKey(t.created_at));
    const acc = new Map<string, { est: number; svc: number }>();
    rows.forEach((t) => {
      const k = key(t);
      const r = acc.get(k) ?? { est: 0, svc: 0 };
      if (isServiceRecord(t)) r.svc += resolveAmount(t); else r.est += resolveAmount(t);
      acc.set(k, r);
    });
    let keys: string[] = [];
    if (daily) {
      const days = Math.max(1, Math.round((Date.now() - startMs) / 86400000) + 1);
      const today = istDateKey(new Date().toISOString());
      keys = Array.from({ length: Math.min(days, 31) }, (_, i) => istDateKey(new Date(new Date(`${today}T12:00:00+05:30`).getTime() - (Math.min(days, 31) - 1 - i) * 86400000).toISOString()));
    } else {
      const cur = currentISTMonth();
      const first = period === 'all' ? ([...acc.keys()].sort()[0] ?? cur) : istMonthKey(new Date(startMs).toISOString());
      for (let k = first; k <= cur && keys.length < 36; k = addMonths(k, 1)) keys.push(k);
      if (keys.length === 36 && keys[keys.length - 1] !== cur) keys = keys.slice(-36);
    }
    return keys.map((k) => {
      const r = acc.get(k) ?? { est: 0, svc: 0 };
      return { label: daily ? dayLabel(k) : monthLabel(k), Estimates: round2(r.est), 'Service records': round2(r.svc) };
    });
  }, [rows, period, startMs]);

  /* ---------- case-type & customer leaderboards ---------- */
  const byType = useMemo(() => {
    const m = new Map<string, { n: number; amt: number }>();
    rows.forEach((t) => {
      const k = String(t.case_type || 'Other');
      const r = m.get(k) ?? { n: 0, amt: 0 };
      r.n++; r.amt += resolveAmount(t);
      m.set(k, r);
    });
    return [...m.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.amt - a.amt).slice(0, 10);
  }, [rows]);

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(String(p.id), p.full_name || p.email || String(p.id).slice(0, 8)));
    return m;
  }, [profiles]);

  const topCustomers = useMemo(() => {
    const m = new Map<string, { n: number; amt: number }>();
    rows.forEach((t) => {
      const k = String(t.user_id);
      const r = m.get(k) ?? { n: 0, amt: 0 };
      r.n++; r.amt += resolveAmount(t);
      m.set(k, r);
    });
    return [...m.entries()].map(([id, v]) => ({ id, name: nameOf.get(id) || 'Unknown user', ...v })).sort((a, b) => b.amt - a.amt).slice(0, 10);
  }, [rows, nameOf]);

  /* ---------- by state / FY ---------- */
  const states = useMemo(() => {
    const stateOf = new Map<string, string>();
    profiles.forEach((p) => {
      const st = p.state || p.user_state || p.location;
      stateOf.set(String(p.id), typeof st === 'string' && st.trim() ? st.trim().toUpperCase() : 'NOT SPECIFIED');
    });
    const m = new Map<string, { revenue: number; count: number; users: Set<string> }>();
    rows.forEach((t) => {
      const st = stateOf.get(String(t.user_id)) || 'NOT SPECIFIED';
      const r = m.get(st) ?? { revenue: 0, count: 0, users: new Set<string>() };
      r.revenue += resolveAmount(t); r.count++; r.users.add(String(t.user_id));
      m.set(st, r);
    });
    return [...m.entries()].map(([state, v]) => ({ state, revenue: v.revenue, count: v.count, users: v.users.size })).sort((a, b) => b.revenue - a.revenue);
  }, [rows, profiles]);
  const fy = useMemo(() => revenueByFY(txns, EXCLUDED_ADMIN_USER_ID), [txns]);

  const mix: { label: string; v: { amount: number; count: number }; color: string }[] = [
    { label: 'Estimates · paid via Razorpay', v: split.estimatesGateway, color: C_EST },
    { label: 'Estimates · deducted from wallet', v: split.estimatesWallet, color: '#60a5fa' },
    { label: 'Service records · paid via Razorpay', v: split.servicesGateway, color: C_SVC },
    { label: 'Service records · deducted from wallet', v: split.servicesWallet, color: '#5eead4' },
  ];

  const exportCsv = () => {
    if (!rows.length) return;
    downloadCsv(`Revenue_${period}_${istDateKey(new Date().toISOString())}.csv`, [
      ['Date (IST)', 'Reference', 'Customer', 'Source', 'Case type', 'Channel', 'Status', 'Amount (INR)'],
      ...rows.map((t) => [
        new Date(t.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), t.reference_no, t.customer_name,
        isServiceRecord(t) ? 'Service record' : 'Estimate', t.case_type, hasGatewayPayment(t) ? 'Razorpay' : 'Wallet', t.payment_status, resolveAmount(t),
      ]),
    ]);
  };

  return (
    <div className="space-y-5">
      {/* Period + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{REPORT_PERIOD_LABEL[period]}</p>
          <p className="text-xs text-slate-500">Earned revenue from estimates and service records · public users · India time. Failed / refunded payments excluded.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            {PERIODS.map((p) => (
              <Link
                key={p} href={buildHref(p)} scroll={false}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >{REPORT_PERIOD_LABEL[p]}</Link>
            ))}
          </div>
          <Btn size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</Btn>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat
          label="Earned revenue" value={inr0(split.total)} tone="info"
          hint={d === null ? (prevSplit ? 'No data in previous period' : 'All time') : <span className={d >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}% vs previous period</span>}
        />
        <Stat label="Paid transactions" value={split.publicCount.toLocaleString('en-IN')} hint={`${customers} paying customer${customers === 1 ? '' : 's'}`} />
        <Stat label="Average ticket" value={inr0(avgTicket)} hint="Revenue ÷ transactions" />
        <Stat label="Direct (Razorpay)" value={inr0(gateway)} hint={split.total ? `${((gateway / split.total) * 100).toFixed(0)}% of revenue` : '—'} />
        <Stat label="From wallet usage" value={inr0(wallet)} hint={split.total ? `${((wallet / split.total) * 100).toFixed(0)}% of revenue` : '—'} />
      </div>

      {/* Trend + mix */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2" title="Revenue trend" subtitle={period === 'day' || period === 'week' || period === 'month' ? 'Daily · stacked by source' : 'Monthly · stacked by source'}>
          <div className="h-72" role="img" aria-label="Revenue trend stacked by estimates and service records">
            {trend.some((t) => t.Estimates + t['Service records'] > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `₹${v}`)} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any, n: any) => [inr(Number(v)), n]} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Estimates" stackId="a" fill={C_EST} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Service records" stackId="a" fill={C_SVC} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="No revenue in this period" />}
          </div>
        </Card>

        <Card title="Revenue mix" subtitle="Where the money came from">
          <ul className="space-y-4">
            {mix.map((m) => (
              <li key={m.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">{m.label}</span>
                  <span className="font-semibold tabular-nums">{inr0(m.v.amount)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${split.total ? (m.v.amount / split.total) * 100 : 0}%`, background: m.color }} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{m.v.count} transaction{m.v.count === 1 ? '' : 's'} · {split.total ? ((m.v.amount / split.total) * 100).toFixed(1) : '0.0'}%</p>
              </li>
            ))}
          </ul>
          {split.admin.count > 0 && (
            <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
              Excluded: {inr0(split.admin.amount)} ({split.admin.count}) from the internal admin account.
            </p>
          )}
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Revenue by case type" subtitle="Top 10 in this period" bodyClassName="p-0">
          <table className="w-full">
            <thead><tr><th className={thCls}>Case type</th><th className={`${thCls} text-right`}>Txns</th><th className={`${thCls} text-right`}>Avg ticket</th><th className={`${thCls} text-right`}>Revenue</th><th className={`${thCls} text-right`}>Share</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {byType.length === 0 && (<tr><td colSpan={5}><EmptyState title="No data" /></td></tr>)}
              {byType.map((r) => (
                <tr key={r.type}>
                  <td className={`${tdCls} font-medium text-slate-900`}>{r.type}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{r.n}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{inr0(r.amt / r.n)}</td>
                  <td className={`${tdCls} text-right tabular-nums font-semibold`}>{inr(r.amt)}</td>
                  <td className={`${tdCls} text-right tabular-nums text-slate-500`}>{split.total ? ((r.amt / split.total) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Top customers" subtitle="By earned revenue in this period" bodyClassName="p-0">
          <table className="w-full">
            <thead><tr><th className={thCls}>#</th><th className={thCls}>Customer</th><th className={`${thCls} text-right`}>Txns</th><th className={`${thCls} text-right`}>Revenue</th><th className={`${thCls} text-right`}>Share</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {topCustomers.length === 0 && (<tr><td colSpan={5}><EmptyState title="No data" /></td></tr>)}
              {topCustomers.map((r, i) => (
                <tr key={r.id}>
                  <td className={`${tdCls} text-slate-400`}>{i + 1}</td>
                  <td className={`${tdCls} font-medium text-slate-900`}>{r.name}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{r.n}</td>
                  <td className={`${tdCls} text-right tabular-nums font-semibold`}>{inr(r.amt)}</td>
                  <td className={`${tdCls} text-right tabular-nums text-slate-500`}>{split.total ? ((r.amt / split.total) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Earned revenue by financial year" subtitle="All time · April–March · public users" bodyClassName="p-0">
          <table className="w-full">
            <thead><tr><th className={thCls}>Financial year</th><th className={`${thCls} text-right`}>Transactions</th><th className={`${thCls} text-right`}>Earned revenue</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {fy.length === 0 && (<tr><td colSpan={3}><EmptyState title="No revenue yet" /></td></tr>)}
              {fy.map((r) => (
                <tr key={r.fy}>
                  <td className={`${tdCls} font-medium text-slate-900`}>FY {r.fy}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{r.count.toLocaleString('en-IN')}</td>
                  <td className={`${tdCls} text-right tabular-nums font-semibold`}>{inr(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Revenue by state" subtitle={`${states.length} state${states.length === 1 ? '' : 's'} · grouped by the paying user's profile`} bodyClassName="p-0">
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full">
              <thead><tr><th className={thCls}>State</th><th className={`${thCls} text-right`}>Users</th><th className={`${thCls} text-right`}>Txns</th><th className={`${thCls} text-right`}>Revenue</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {states.length === 0 && (<tr><td colSpan={4}><EmptyState title="No data" /></td></tr>)}
                {states.map((s) => (
                  <tr key={s.state}>
                    <td className={`${tdCls} font-medium text-slate-900`}>{s.state}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{s.users}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{s.count}</td>
                    <td className={`${tdCls} text-right tabular-nums font-semibold`}>{inr(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Cases by month" subtitle="Aggregated case counts" bodyClassName="p-0">
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full">
              <thead><tr><th className={thCls}>Month</th><th className={`${thCls} text-right`}>Cases</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(!monthlyCases || monthlyCases.length === 0) && (<tr><td colSpan={2}><EmptyState title="No case data" /></td></tr>)}
                {monthlyCases?.map((m: any) => (
                  <tr key={m.month_name}>
                    <td className={`${tdCls} font-medium text-slate-900`}>{m.month_name}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{Number(m.case_count || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="MIS fee records" subtitle="Recent entries in the selected window"><DashboardChart data={records || []} /></Card>
      </div>
    </div>
  );
}
