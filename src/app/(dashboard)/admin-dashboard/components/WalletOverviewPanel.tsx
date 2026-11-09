'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, Download, Landmark, PiggyBank, ReceiptText, Wallet } from 'lucide-react';
import { computeWalletSummary, currentISTMonth, hasGatewayPayment, inr, inr0, isRevenueRow, rechargeBucket, istMonthKey, resolveAmount } from '../lib/finance';
import { Badge, Btn, Card, EmptyState, Segmented, Stat, downloadCsv, inputCls, tdCls, thCls } from './ui';

interface Props {
  recharges: any[];
  profiles: any[];
  ledger: any[];
  ledgerOk: boolean;
  walletPaidTxns: any[];
  excludeUserIds?: string[];
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function WalletOverviewPanel({ recharges, profiles, ledger, ledgerOk, walletPaidTxns, excludeUserIds = [] }: Props) {
  const [period, setPeriod] = useState<'all' | 'month'>('all');
  const [month, setMonth] = useState(currentISTMonth());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'balance' | 'used' | 'recharged' | 'usage'>('balance');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [limit, setLimit] = useState(25);

  const sum = useMemo(
    () => computeWalletSummary({ recharges, profiles, ledger, ledgerOk, walletPaidTxns, month: period === 'month' ? month : null, excludeUserIds }),
    [recharges, profiles, ledger, ledgerOk, walletPaidTxns, period, month, excludeUserIds]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = sum.rows
      .filter((r) => !onlyFlagged || r.flag !== 'OK')
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.mobile.includes(q) || r.code.toLowerCase().includes(q));
    const key = { balance: 'balance', used: 'used', recharged: 'recharged', usage: 'usagePct' }[sort] as 'balance' | 'used' | 'recharged' | 'usagePct';
    return [...list].sort((a, b) => b[key] - a[key]);
  }, [sum.rows, search, sort, onlyFlagged]);

  /* Cross-check: what the ledger says users used vs. wallet-paid services actually delivered */
  const recon = useMemo(() => {
    if (!ledgerOk || !walletPaidTxns?.length) return null;
    const ex = new Set(excludeUserIds);
    let total = 0;
    for (const t of walletPaidTxns) {
      if (!isRevenueRow(t) || hasGatewayPayment(t) || ex.has(String(t.user_id ?? ''))) continue;
      if (period === 'month' && istMonthKey(t.created_at) !== month) continue;
      total += resolveAmount(t);
    }
    const diff = sum.totalUsed - total;
    return { services: total, diff, off: Math.abs(diff) > Math.max(1, total * 0.02) };
  }, [ledgerOk, walletPaidTxns, excludeUserIds, period, month, sum.totalUsed]);

  const flowTotal = sum.totalUsed + sum.totalRefunded + sum.remainingBalance;
  const pct = (n: number) => (flowTotal > 0 ? (n / flowTotal) * 100 : 0);

  const exportCsv = () =>
    downloadCsv(`wallet_summary_${period === 'month' ? month : 'all_time'}.csv`, [
      ['User', 'User Code', 'Email', 'Mobile', 'Plan', 'Total Recharged', 'Used', 'Refunded', 'Current Balance', 'Usage %', 'Last Recharge', 'Flag'],
      ...sum.rows.map((r) => [r.name, r.code, r.email, r.mobile, r.plan, r.recharged, r.used, r.refunded, r.balance, r.usagePct, fmtDate(r.lastRechargeAt), r.flag]),
    ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Wallet position</h2>
          <p className="text-xs text-slate-500">Money users deposited, how much they have consumed, and how much we are holding for them.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={period} onChange={setPeriod} options={[{ value: 'all', label: 'All time' }, { value: 'month', label: 'Month' }]} />
          {period === 'month' && <input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} />}
          <Btn size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export CSV</Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total recharged" value={inr0(sum.totalRecharged)} hint={`${sum.rechargeCount} approved recharge${sum.rechargeCount === 1 ? '' : 's'}`} tone="info" icon={<ArrowDownToLine className="h-4 w-4" />} />
        <Stat label="Used by users" value={inr0(sum.totalUsed)} hint={`${sum.usagePct.toFixed(1)}% of recharged`} icon={<ReceiptText className="h-4 w-4" />} />
        <Stat label="Remaining with us" value={inr0(sum.remainingBalance)} hint={`${sum.usersWithBalance} user${sum.usersWithBalance === 1 ? '' : 's'} hold a balance (live)`} tone="positive" icon={<PiggyBank className="h-4 w-4" />} />
        <Stat label="Refunded to users" value={inr0(sum.totalRefunded)} hint="Unused balance returned" icon={<Landmark className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Pending recharges" value={inr0(sum.totalPending)} hint={`${sum.pendingCount} awaiting approval`} tone={sum.pendingCount ? 'warning' : 'neutral'} />
        <Stat label="Rejected recharges" value={inr0(sum.totalRejected)} hint="Not credited" />
        <Stat label="Receivable (overdrawn)" value={inr0(sum.receivable)} hint="Premium / negative wallets" tone={sum.receivable ? 'negative' : 'neutral'} icon={<Wallet className="h-4 w-4" />} />
        <Stat label="Net held for users" value={inr0(sum.netHeld)} hint="Remaining − receivable" tone="positive" />
      </div>

      <Card title="Where the recharged money went" subtitle={period === 'all' ? 'All-time flow of user deposits' : `Activity in ${month}; balances are live`}>
        {flowTotal <= 0 ? (
          <EmptyState title="No wallet activity for this period" />
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Used, refunded and remaining split">
              <div className="bg-blue-600" style={{ width: `${pct(sum.totalUsed)}%` }} title={`Used ${inr(sum.totalUsed)}`} />
              <div className="bg-amber-500" style={{ width: `${pct(sum.totalRefunded)}%` }} title={`Refunded ${inr(sum.totalRefunded)}`} />
              <div className="bg-emerald-500" style={{ width: `${pct(sum.remainingBalance)}%` }} title={`Remaining ${inr(sum.remainingBalance)}`} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue-600" /> Used {inr0(sum.totalUsed)} ({pct(sum.totalUsed).toFixed(0)}%)</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" /> Refunded {inr0(sum.totalRefunded)} ({pct(sum.totalRefunded).toFixed(0)}%)</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Remaining {inr0(sum.remainingBalance)} ({pct(sum.remainingBalance).toFixed(0)}%)</span>
            </div>
            {period === 'all' && (
              <p className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-3">
                Recharged <b className="text-slate-700">{inr0(sum.totalRecharged)}</b>
                {' + '}bonus / adjustments <b className="text-slate-700">{inr0(sum.bonusAndAdjustments)}</b>
                {' − '}used <b className="text-slate-700">{inr0(sum.totalUsed)}</b>
                {' − '}refunded <b className="text-slate-700">{inr0(sum.totalRefunded)}</b>
                {' ≈ '}holding <b className="text-slate-700">{inr0(sum.remainingBalance - sum.receivable)}</b>.
                Bonus / adjustments are derived (wallet credits that did not come through an approved recharge, e.g. the signup bonus given when an admin creates a user).
              </p>
            )}
            {recon && (
              <p className={`mt-2 text-xs ${recon.off ? 'text-amber-700' : 'text-slate-500'}`}>
                Cross-check: wallet-paid services total <b>{inr0(recon.services)}</b> vs ledger usage <b>{inr0(sum.totalUsed)}</b>
                {recon.off
                  ? <> – difference of <b>{inr0(Math.abs(recon.diff))}</b>. Some usage may be missing from (or extra in) the wallet ledger; review users flagged below.</>
                  : <> – matches.</>}
              </p>
            )}
            {sum.usedSource === 'estimates' && (
              <p className="mt-2 text-xs text-amber-700">Wallet ledger (wallet_transactions) could not be read – “Used” is estimated from wallet-paid estimates and may differ.</p>
            )}
          </>
        )}
      </Card>

      <Card
        title="Per-user wallet statement"
        subtitle={`${rows.length} of ${sum.rows.length} users`}
        actions={
          <>
            <input className={`${inputCls} w-52`} placeholder="Search name, email, mobile, code" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(25); }} />
            <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Sort by">
              <option value="balance">Sort: Balance</option><option value="used">Sort: Used</option><option value="recharged">Sort: Recharged</option><option value="usage">Sort: Usage %</option>
            </select>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Needs review only ({sum.usersFlagged})
            </label>
          </>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr>
                <th className={thCls}>User</th>
                <th className={`${thCls} text-right`}>Recharged</th>
                <th className={`${thCls} text-right`}>Used</th>
                <th className={`${thCls} text-right`}>Refunded</th>
                <th className={`${thCls} text-right`}>Balance</th>
                <th className={thCls}>Usage</th>
                <th className={thCls}>Last recharge</th>
                <th className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (<tr><td colSpan={8}><EmptyState title="No users match" /></td></tr>)}
              {rows.slice(0, limit).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className={tdCls}>
                    <div className="font-medium text-slate-900">{r.name}</div>
                    <div className="text-xs text-slate-500">{[r.code, r.email].filter(Boolean).join(' · ') || '—'}</div>
                  </td>
                  <td className={`${tdCls} text-right tabular-nums`}>{inr(r.recharged)}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{inr(r.used)}</td>
                  <td className={`${tdCls} text-right tabular-nums text-slate-500`}>{r.refunded ? inr(r.refunded) : '—'}</td>
                  <td className={`${tdCls} text-right tabular-nums font-semibold ${r.balance < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{inr(r.balance)}</td>
                  <td className={`${tdCls} w-36`}>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-blue-600" style={{ width: `${Math.min(100, r.usagePct)}%` }} /></div>
                    <div className="text-[11px] text-slate-500 mt-1 tabular-nums">{r.recharged > 0 ? `${r.usagePct.toFixed(0)}%` : '—'}</div>
                  </td>
                  <td className={`${tdCls} text-xs text-slate-600 whitespace-nowrap`}>{fmtDate(r.lastRechargeAt)}</td>
                  <td className={tdCls}>
                    {r.flag === 'OK' && <Badge tone="positive">OK</Badge>}
                    {r.flag === 'NEGATIVE_BALANCE' && <Badge tone="negative">Overdrawn</Badge>}
                    {r.flag === 'REVIEW' && <span title={`Balance is ${inr(Math.abs(r.adjustment))} lower than recharges − usage − refunds. Check for missing ledger rows or reversed approvals.`}><Badge tone="warning">Review</Badge></span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <div className="p-3 border-t border-slate-100 text-center">
            <Btn size="sm" onClick={() => setLimit((l) => l + 50)}>Show more ({rows.length - limit} remaining)</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   Recharge request queue (approve / reject / revoke)
   ============================================================ */

export function RechargeRequestsTable({
  requests, busyId, onApprove, onReject, onRevoke,
}: {
  requests: any[];
  busyId: string | null;
  onApprove: (req: any) => void;
  onReject: (req: any) => void;
  onRevoke: (req: any) => void;
}) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [month, setMonth] = useState('');
  const [limit, setLimit] = useState(25);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    requests.forEach((r) => { c[rechargeBucket(r.status)]++; });
    return c;
  }, [requests]);

  const list = useMemo(
    () => requests
      .filter((r) => status === 'all' || rechargeBucket(r.status) === status)
      .filter((r) => !month || istMonthKey(r.created_at) === month),
    [requests, status, month]
  );

  return (
    <Card
      title="Recharge requests"
      subtitle="Approve to credit the user's wallet. Approving is atomic and can only happen once per request."
      actions={
        <>
          <Segmented
            value={status}
            onChange={(v) => { setStatus(v); setLimit(25); }}
            options={[
              { value: 'pending', label: `Pending (${counts.pending})` },
              { value: 'approved', label: `Approved (${counts.approved})` },
              { value: 'rejected', label: `Rejected (${counts.rejected})` },
              { value: 'all', label: 'All' },
            ]}
          />
          <input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Filter by month" />
        </>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className={thCls}>User</th><th className={`${thCls} text-right`}>Amount</th><th className={thCls}>UTR / Ref</th>
              <th className={thCls}>Requested (IST)</th><th className={thCls}>Status</th><th className={`${thCls} text-right`}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.length === 0 && (<tr><td colSpan={6}><EmptyState title="No requests in this view" /></td></tr>)}
            {list.slice(0, limit).map((r) => {
              const b = rechargeBucket(r.status);
              const busy = busyId === String(r.id);
              return (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className={tdCls}><div className="font-medium text-slate-900">{r.user_name || 'N/A'}</div><div className="text-xs text-slate-500">{r.user_email || '—'}</div></td>
                  <td className={`${tdCls} text-right tabular-nums font-semibold text-slate-900`}>{inr(Number(r.amount) || 0)}</td>
                  <td className={`${tdCls} font-mono text-xs`}>{r.utr_no || '—'}</td>
                  <td className={`${tdCls} text-xs whitespace-nowrap`}>{r.created_at ? new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</td>
                  <td className={tdCls}><Badge tone={b === 'approved' ? 'positive' : b === 'rejected' ? 'negative' : 'warning'}>{String(r.status || 'PENDING').toUpperCase()}</Badge></td>
                  <td className={`${tdCls} text-right whitespace-nowrap space-x-1.5`}>
                    {b === 'pending' && (
                      <>
                        <Btn size="sm" variant="success" disabled={busy} onClick={() => onApprove(r)}>{busy ? 'Working…' : 'Approve'}</Btn>
                        <Btn size="sm" variant="danger" disabled={busy} onClick={() => onReject(r)}>Reject</Btn>
                      </>
                    )}
                    {b === 'approved' && <Btn size="sm" disabled={busy} onClick={() => onRevoke(r)}>Revoke</Btn>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length > limit && (
        <div className="p-3 border-t border-slate-100 text-center"><Btn size="sm" onClick={() => setLimit((l) => l + 50)}>Show more ({list.length - limit} remaining)</Btn></div>
      )}
    </Card>
  );
}
