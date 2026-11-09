'use client';

import React, { useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import {
  currentFY, currentISTDate, currentISTMonth, fyOf, fyOptions, inr, inr0, isPendingButPaid, isRevenueRow, istDateKey, istMonthKey,
  resolveAmount, summarizeRevenue, yearOptions, type RevenueTxn,
} from '../lib/finance';
import { Badge, Btn, Card, EmptyState, Segmented, Stat, downloadCsv, inputCls, tdCls, thCls } from './ui';

type Mode = 'month' | 'date' | 'year' | 'fy' | 'all';

export interface GstRequest {
  mode: Mode;
  key: string;
  amount: number;
  count: number;
}

const fmtDateTime = (iso: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

export default function RevenueInspector({
  txns, onGenerateGst,
}: {
  txns: RevenueTxn[];
  onGenerateGst: (req: GstRequest) => void;
}) {
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(currentISTMonth());
  const [date, setDate] = useState(currentISTDate());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [fy, setFy] = useState(currentFY());
  const [channel, setChannel] = useState<'all' | 'GATEWAY' | 'WALLET'>('all');
  const [source, setSource] = useState<'all' | 'estimates' | 'service_records'>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(25);

  const periodKey = mode === 'month' ? month : mode === 'date' ? date : mode === 'year' ? year : mode === 'fy' ? fy : 'ALL';

  const inPeriod = useMemo(
    () =>
      txns.filter((tx) => {
        if (mode === 'month') return istMonthKey(tx.created_at) === month;
        if (mode === 'date') return istDateKey(tx.created_at) === date;
        if (mode === 'year') return istDateKey(tx.created_at).slice(0, 4) === year;
        if (mode === 'fy') return fyOf(tx.created_at) === fy;
        return true;
      }),
    [txns, mode, month, date, year, fy]
  );

  const summary = useMemo(() => summarizeRevenue(inPeriod), [inPeriod]);
  const allTime = useMemo(() => summarizeRevenue(txns), [txns]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inPeriod
      .filter((t) => channel === 'all' || t.channel === channel)
      .filter((t) => source === 'all' || t.source_table === source)
      .filter((t) => !q || `${t.reference_no} ${t.customer_name} ${t.case_type} ${t.razorpay_payment_id}`.toLowerCase().includes(q));
  }, [inPeriod, channel, source, search]);

  const exportCsv = () =>
    downloadCsv(`revenue_${mode}_${periodKey}.csv`, [
      ['Date (IST)', 'Reference No', 'Razorpay Payment ID', 'Customer', 'Case Type', 'Source', 'Channel', 'Status', 'Counted In Revenue', 'Amount (INR)'],
      ...rows.map((t) => [
        fmtDateTime(t.created_at), t.reference_no, t.channel === 'GATEWAY' ? t.razorpay_payment_id : '', t.customer_name, t.case_type,
        t.source_table === 'estimates' ? 'Estimate' : 'Service', t.channel === 'GATEWAY' ? 'Razorpay' : 'Wallet', t.payment_status,
        isRevenueRow(t) ? 'Yes' : 'No', resolveAmount(t),
      ]),
    ]);

  return (
    <div className="space-y-5">
      <Card
        title="Revenue inspector"
        subtitle="Earned revenue from estimates and service records. Amounts follow one rule everywhere in this dashboard; failed, pending and refunded payments are not counted."
        actions={
          <>
            <Btn size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export CSV</Btn>
            <Btn
              size="sm" variant="primary"
              disabled={mode === 'all' || summary.total <= 0}
              title={mode === 'all' ? 'Pick a month, date, year or FY first' : undefined}
              onClick={() => onGenerateGst({ mode, key: periodKey, amount: summary.total, count: summary.count })}
            >
              <FileText className="h-3.5 w-3.5" /> GST invoice for period
            </Btn>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={mode}
            onChange={(v) => { setMode(v); setLimit(25); }}
            options={[{ value: 'month', label: 'Month' }, { value: 'date', label: 'Day' }, { value: 'year', label: 'Year' }, { value: 'fy', label: 'Financial year' }, { value: 'all', label: 'All time' }]}
          />
          {mode === 'month' && <input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} />}
          {mode === 'date' && <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />}
          {mode === 'year' && (
            <select className={inputCls} value={year} onChange={(e) => setYear(e.target.value)}>{yearOptions().map((y) => <option key={y}>{y}</option>)}</select>
          )}
          {mode === 'fy' && (
            <select className={inputCls} value={fy} onChange={(e) => setFy(e.target.value)}>{fyOptions().map((y) => <option key={y} value={y}>FY {y}</option>)}</select>
          )}
          <span className="text-xs text-slate-500 ml-auto">Dates are in India time (IST)</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Earned revenue (period)" value={inr0(summary.total)} tone="info" hint={`${summary.count} paid transaction${summary.count === 1 ? '' : 's'}`} />
        <Stat label="Direct (Razorpay)" value={inr0(summary.gateway)} hint={`${summary.gatewayCount} online payment${summary.gatewayCount === 1 ? '' : 's'}`} />
        <Stat label="From wallet usage" value={inr0(summary.wallet)} hint={`${summary.walletCount} wallet deduction${summary.walletCount === 1 ? '' : 's'}`} />
        <Stat label="All-time earned" value={inr0(allTime.total)} hint={`${allTime.count} transactions${allTime.excludedCount ? ` · ${allTime.excludedCount} not counted` : ''}`} />
      </div>

      <Card
        title="Transactions"
        subtitle={`${rows.length} row${rows.length === 1 ? '' : 's'} in this view${summary.excludedCount ? ` · ${summary.excludedCount} in period are failed / pending / refunded and not counted` : ''}`}
        actions={
          <>
            <input className={`${inputCls} w-52`} placeholder="Search ref, customer, payment id" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(25); }} />
            <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value as any)} aria-label="Channel">
              <option value="all">All channels</option><option value="GATEWAY">Razorpay</option><option value="WALLET">Wallet</option>
            </select>
            <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value as any)} aria-label="Source">
              <option value="all">Estimates + services</option><option value="estimates">Estimates</option><option value="service_records">Services</option>
            </select>
          </>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th className={thCls}>Date (IST)</th><th className={thCls}>Reference</th><th className={thCls}>Customer</th><th className={thCls}>Case type</th>
                <th className={thCls}>Channel</th><th className={thCls}>Status</th><th className={`${thCls} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (<tr><td colSpan={7}><EmptyState title="No transactions for this selection" /></td></tr>)}
              {rows.slice(0, limit).map((t) => {
                const counted = isRevenueRow(t);
                return (
                  <tr key={`${t.source_table}-${t.id}`} className={`hover:bg-slate-50/70 ${counted ? '' : 'opacity-60'}`}>
                    <td className={`${tdCls} text-xs whitespace-nowrap`}>{fmtDateTime(t.created_at)}</td>
                    <td className={`${tdCls} font-mono text-xs`}>{t.reference_no || '—'}</td>
                    <td className={`${tdCls} font-medium text-slate-900`}>{t.customer_name}</td>
                    <td className={tdCls}><Badge tone={t.source_table === 'estimates' ? 'info' : 'neutral'}>{t.case_type}</Badge></td>
                    <td className={tdCls}>{t.channel === 'GATEWAY' ? <Badge tone="info">Razorpay</Badge> : <Badge>Wallet</Badge>}</td>
                    <td className={tdCls}>{counted ? (isPendingButPaid(t)
                      ? <span title={`Status in database is "${t.payment_status}", but a Razorpay payment id exists, so it is counted as received.`}><Badge tone="positive">PAID · gateway ID</Badge></span>
                      : <Badge tone="positive">{String(t.payment_status).toUpperCase()}</Badge>) : <Badge tone="warning">{String(t.payment_status).toUpperCase()} · not counted</Badge>}</td>
                    <td className={`${tdCls} text-right tabular-nums font-semibold ${counted ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{inr(resolveAmount(t))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <div className="p-3 border-t border-slate-100 text-center"><Btn size="sm" onClick={() => setLimit((l) => l + 50)}>Show more ({rows.length - limit} remaining)</Btn></div>
        )}
      </Card>
    </div>
  );
}
