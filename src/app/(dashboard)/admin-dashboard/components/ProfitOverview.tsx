'use client';

import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  EFFECTIVE_START_MONTH, EXCLUDED_ADMIN_USER_ID, FIXED_MONTHLY_OVERHEAD, computeMonthProfit, currentISTMonth, inr, inr0,
  monthLabel, revenueSplitByMonth, toNum, type RevenueTxn,
} from '../lib/finance';
import { Badge, Card, Stat, inputCls, tdCls, thCls } from './ui';

interface Props {
  txns: RevenueTxn[];
  /** rows of shareholder_paytable */
  payouts: any[];
  payoutsOk: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Profit statement built straight from the two revenue tables:
 *   estimates + service_records  ->  earned revenue (Razorpay or wallet)  ->  less admin usage / overhead  ->  net profit.
 * Wallet recharges are deposits, not revenue, and never enter this statement.
 */
export default function ProfitOverview({ txns, payouts, payoutsOk }: Props) {
  const nowKey = currentISTMonth();
  const [year, setYear] = useState(Number(nowKey.slice(0, 4)));
  const [month, setMonth] = useState(Number(nowKey.slice(5, 7)));

  const byMonth = useMemo(() => revenueSplitByMonth(txns, EXCLUDED_ADMIN_USER_ID), [txns]);

  const payoutByMonth = useMemo(() => {
    const m = new Map<string, number>();
    payouts.forEach((p) => {
      const k = String(p.settlement_month || '');
      m.set(k, (m.get(k) || 0) + toNum(p.amount_settled ?? p.amount));
    });
    return m;
  }, [payouts]);

  const years = useMemo(() => {
    const ys = new Set<number>([Number(nowKey.slice(0, 4))]);
    byMonth.forEach((_, k) => ys.add(Number(k.slice(0, 4))));
    return [...ys].sort((a, b) => b - a);
  }, [byMonth, nowKey]);

  const rows = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const key = `${year}-${String(m).padStart(2, '0')}`;
        const s = byMonth.get(key);
        const est = (s?.estimatesGateway.amount ?? 0) + (s?.estimatesWallet.amount ?? 0);
        const svc = (s?.servicesGateway.amount ?? 0) + (s?.servicesWallet.amount ?? 0);
        const pr = computeMonthProfit({
          month: key, gross: (s?.total ?? 0) + (s?.admin.amount ?? 0), adminSelfUsage: s?.admin.amount ?? 0,
          overheadPerMonth: FIXED_MONTHLY_OVERHEAD, payouts: payoutByMonth.get(`${String(m).padStart(2, '0')}-${year}`) || 0,
        });
        return { m, key, est, svc, s, pr, rev: s?.total ?? 0, future: key > nowKey };
      }),
    [byMonth, payoutByMonth, year, nowKey]
  );

  const sel = rows[month - 1];
  const totals = useMemo(
    () => rows.reduce((t, r) => ({
      est: t.est + r.est, svc: t.svc + r.svc, rev: t.rev + r.rev, overhead: t.overhead + r.pr.overhead,
      pool: t.pool + r.pr.pool, settled: t.settled + r.pr.payouts, balance: t.balance + r.pr.undistributed,
    }), { est: 0, svc: 0, rev: 0, overhead: 0, pool: 0, settled: 0, balance: 0 }),
    [rows]
  );

  const chart = rows.filter((r) => !r.future).map((r) => ({
    label: MONTHS[r.m - 1], Revenue: r.rev, 'Net profit': Math.round(r.pr.pool),
  }));

  const lines: { label: string; amount: number; count?: number; sub?: boolean }[] = [
    { label: 'Estimates · paid via Razorpay', amount: sel.s?.estimatesGateway.amount ?? 0, count: sel.s?.estimatesGateway.count, sub: true },
    { label: 'Estimates · deducted from wallet', amount: sel.s?.estimatesWallet.amount ?? 0, count: sel.s?.estimatesWallet.count, sub: true },
    { label: 'Service records · paid via Razorpay', amount: sel.s?.servicesGateway.amount ?? 0, count: sel.s?.servicesGateway.count, sub: true },
    { label: 'Service records · deducted from wallet', amount: sel.s?.servicesWallet.amount ?? 0, count: sel.s?.servicesWallet.count, sub: true },
  ];

  const beforeStart = sel.key < EFFECTIVE_START_MONTH;
  const pool = sel.pr.pool;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Revenue &amp; profit statement</h3>
          <p className="text-xs text-slate-500">Built from estimates + service records (earned revenue). Recharges are deposits and are not counted. India time.</p>
        </div>
        <div className="flex gap-2">
          <select className={inputCls} value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Month">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className={inputCls} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={`Revenue · ${monthLabel(sel.key)}`} value={inr0(sel.rev)} tone="info" hint={`${sel.s?.publicCount ?? 0} paid transactions`} />
        <Stat label="Fixed overhead" value={inr0(sel.pr.overhead)} hint={beforeStart ? `Starts ${EFFECTIVE_START_MONTH}` : 'Monthly operating cost'} />
        <Stat label={pool < 0 ? 'Net loss' : 'Net distributable profit'} value={inr0(Math.abs(pool))} tone={pool < 0 ? 'negative' : 'positive'} hint={pool < 0 ? 'Overhead exceeds revenue' : 'Pool for partner shares'} />
        <Stat label="Yet to be settled" value={inr0(sel.pr.undistributed)} tone={sel.pr.undistributed > 0 ? 'warning' : 'neutral'} hint={`Settled ${inr0(sel.pr.payouts)}${payoutsOk ? '' : ' (payout data unavailable)'}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <Card className="xl:col-span-2" title={`Statement · ${monthLabel(sel.key)}`} bodyClassName="p-0">
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.label}>
                  <td className={`${tdCls} pl-8 text-slate-700`}>{l.label}{l.count ? <span className="text-xs text-slate-400"> · {l.count}</span> : null}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{inr(l.amount)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50">
                <td className={`${tdCls} font-semibold text-slate-900`}>Revenue from public users</td>
                <td className={`${tdCls} text-right tabular-nums font-semibold`}>{inr(sel.rev)}</td>
              </tr>
              <tr>
                <td className={`${tdCls} text-slate-500`}>Memo: internal admin account usage (excluded)</td>
                <td className={`${tdCls} text-right tabular-nums text-slate-500`}>{inr(sel.pr.adminSelfUsage)}</td>
              </tr>
              <tr>
                <td className={`${tdCls} text-slate-700`}>Less: fixed operating overhead</td>
                <td className={`${tdCls} text-right tabular-nums text-rose-700`}>− {inr(sel.pr.overhead)}</td>
              </tr>
              <tr className={pool < 0 ? 'bg-rose-50' : 'bg-emerald-50'}>
                <td className={`${tdCls} font-semibold ${pool < 0 ? 'text-rose-800' : 'text-emerald-900'}`}>{pool < 0 ? 'Net loss (nothing distributable)' : 'Net distributable profit'}</td>
                <td className={`${tdCls} text-right tabular-nums font-semibold ${pool < 0 ? 'text-rose-800' : 'text-emerald-900'}`}>{pool < 0 ? '− ' : ''}{inr(Math.abs(pool))}</td>
              </tr>
              <tr>
                <td className={`${tdCls} text-slate-700`}>Already settled to partners</td>
                <td className={`${tdCls} text-right tabular-nums`}>{inr(sel.pr.payouts)}</td>
              </tr>
              <tr>
                <td className={`${tdCls} font-medium text-slate-900`}>Yet to be settled</td>
                <td className={`${tdCls} text-right tabular-nums font-medium`}>{inr(sel.pr.undistributed)}</td>
              </tr>
            </tbody>
          </table>
          {beforeStart && <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">Profit sharing is effective from {EFFECTIVE_START_MONTH}; earlier months show revenue only.</p>}
        </Card>

        <Card className="xl:col-span-3" title={`Revenue vs net profit · ${year}`} subtitle="Public-user earned revenue and the distributable pool, month by month">
          <div className="h-72" role="img" aria-label="Monthly revenue and net profit">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: any, n: any) => [inr(Number(v)), n]} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Revenue" fill="#1d4ed8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Net profit" fill="#059669" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title={`Month-wise summary · ${year}`} subtitle="Click a row to open that month in the statement" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr>
                <th className={thCls}>Month</th><th className={`${thCls} text-right`}>Estimates</th><th className={`${thCls} text-right`}>Service records</th>
                <th className={`${thCls} text-right`}>Revenue</th><th className={`${thCls} text-right`}>Overhead</th><th className={`${thCls} text-right`}>Net profit</th>
                <th className={`${thCls} text-right`}>Settled</th><th className={`${thCls} text-right`}>Yet to settle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.key} onClick={() => setMonth(r.m)} className={`cursor-pointer hover:bg-slate-50 ${r.m === month ? 'bg-blue-50/60' : ''} ${r.future ? 'opacity-40' : ''}`}>
                  <td className={`${tdCls} font-medium text-slate-900`}>{MONTHS[r.m - 1]} {year}{r.m === month && <Badge tone="info">selected</Badge>}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{inr(r.est)}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{inr(r.svc)}</td>
                  <td className={`${tdCls} text-right tabular-nums font-medium`}>{inr(r.rev)}</td>
                  <td className={`${tdCls} text-right tabular-nums text-slate-500`}>{inr(r.pr.overhead)}</td>
                  <td className={`${tdCls} text-right tabular-nums font-semibold ${r.pr.pool < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{r.pr.pool < 0 ? '− ' : ''}{inr(Math.abs(r.pr.pool))}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{inr(r.pr.payouts)}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{inr(r.pr.undistributed)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                <td className="px-3 py-3 text-sm">Total {year}</td>
                <td className="px-3 py-3 text-sm text-right tabular-nums">{inr(totals.est)}</td>
                <td className="px-3 py-3 text-sm text-right tabular-nums">{inr(totals.svc)}</td>
                <td className="px-3 py-3 text-sm text-right tabular-nums">{inr(totals.rev)}</td>
                <td className="px-3 py-3 text-sm text-right tabular-nums">{inr(totals.overhead)}</td>
                <td className="px-3 py-3 text-sm text-right tabular-nums">{totals.pool < 0 ? '− ' : ''}{inr(Math.abs(totals.pool))}</td>
                <td className="px-3 py-3 text-sm text-right tabular-nums">{inr(totals.settled)}</td>
                <td className="px-3 py-3 text-sm text-right tabular-nums">{inr(totals.balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
