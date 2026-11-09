'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, MessageCircle, X } from 'lucide-react';
import { hasGatewayPayment, inr, isRevenueRow, istDateKey, istMonthKey, resolveAmount } from '../lib/finance';
import { Badge, Btn, Segmented, downloadCsv, inputCls, tdCls, thCls } from './ui';

interface Props {
  profile: any;
  onClose: () => void;
  notify: (text: string, kind?: 'success' | 'error' | 'info' | 'warning') => void;
}

const fmt = (iso: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

/** Payment & case history of one user (opened from the Users table). */
export default function UserEstimatesModal({ profile, onClose, notify }: Props) {
  const [mode, setMode] = useState<'all' | 'date' | 'month'>('all');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const all: any[] = useMemo(() => (Array.isArray(profile?.estimates_list) ? profile.estimates_list : []), [profile]);

  const rows = useMemo(
    () =>
      all.filter((e) => {
        if (mode === 'date' && date) return istDateKey(e.created_at) === date;
        if (mode === 'month' && month) return istMonthKey(e.created_at) === month;
        return true;
      }),
    [all, mode, date, month]
  );

  const total = useMemo(() => rows.reduce((s, r) => (isRevenueRow(r) ? s + resolveAmount(r) : s), 0), [rows]);
  const refOf = (e: any) => e.reference_no || e.ref_no || e.estimate_no || 'N/A';
  const modeOf = (e: any) => (hasGatewayPayment(e) ? String(e.razorpay_payment_id) : e.payment_id || e.payment_mode || 'WALLET DEDUCTION');

  const exportCsv = () => {
    if (!rows.length) { notify('No records to download.', 'warning'); return; }
    downloadCsv(`MIS_Report_${String(profile.full_name || 'user').replace(/\s+/g, '_')}_${Date.now()}.csv`, [
      ['Reference No', 'Date & Time (IST)', 'Customer Name', 'Case Type', 'Payment Mode', 'Counted', 'Amount'],
      ...rows.map((e) => [refOf(e), fmt(e.created_at), e.customer_name || 'N/A', e.case_type || e.estimate_type || 'N/A', modeOf(e), isRevenueRow(e) ? 'Yes' : 'No', resolveAmount(e)]),
    ]);
  };

  const whatsapp = () => {
    const mobile = String(profile.mobile || '').replace(/[^0-9]/g, '');
    if (!mobile) { notify('This user has no mobile number on record.', 'warning'); return; }
    const msg = `Hello ${profile.full_name},\n\nHere is your MIS Case & Fee Summary:\nTotal Cases: ${rows.length}\nTotal Fee/Amount: ₹${total.toLocaleString('en-IN')}\n\nThank you,\nL&T Consultant Services`;
    window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="User payment history" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate">Payment & case history – {profile.full_name || 'User'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{profile.email || '—'} · {profile.mobile || 'No mobile'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>

        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'all', label: 'All' }, { value: 'date', label: 'Date' }, { value: 'month', label: 'Month' }]} />
          {mode === 'date' && <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />}
          {mode === 'month' && <input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} />}
          <div className="ml-auto flex gap-2">
            <Btn size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Excel (CSV)</Btn>
            <Btn size="sm" variant="success" onClick={whatsapp}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp summary</Btn>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full min-w-[820px]">
            <thead className="sticky top-0">
              <tr>
                <th className={thCls}>Ref no.</th><th className={thCls}>Date (IST)</th><th className={thCls}>Customer</th>
                <th className={thCls}>Case type</th><th className={thCls}>Paid via</th><th className={`${thCls} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (<tr><td colSpan={6} className="py-12 text-center text-sm text-slate-500">No records for this selection.</td></tr>)}
              {rows.map((e, i) => {
                const counted = isRevenueRow(e);
                return (
                  <tr key={e.id ?? i} className={counted ? '' : 'opacity-60'}>
                    <td className={`${tdCls} font-mono text-xs`}>{refOf(e)}</td>
                    <td className={`${tdCls} text-xs whitespace-nowrap`}>{fmt(e.created_at)}</td>
                    <td className={`${tdCls} font-medium text-slate-900`}>{e.customer_name || 'N/A'}</td>
                    <td className={tdCls}><Badge tone="info">{e.case_type || e.estimate_type || 'N/A'}</Badge></td>
                    <td className={`${tdCls} font-mono text-xs`}>{modeOf(e)}</td>
                    <td className={`${tdCls} text-right tabular-nums font-semibold ${counted ? '' : 'line-through text-slate-400'}`}>
                      {inr(resolveAmount(e))}{!counted && <span className="ml-1 no-underline text-[10px] text-amber-700">({String(e.payment_status).toLowerCase()})</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={5} className="px-3 py-3 text-right text-sm font-semibold text-slate-700">Total paid ({rows.length} case{rows.length === 1 ? '' : 's'})</td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-slate-900 tabular-nums">{inr(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <footer className="px-5 py-3 border-t border-slate-200 flex justify-end"><Btn onClick={onClose}>Close</Btn></footer>
      </div>
    </div>
  );
}
