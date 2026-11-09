'use client';

import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { inr, inr0, round2 } from '../lib/finance';
import { Btn, Card, EmptyState, Stat, downloadCsv, inputCls, tdCls, thCls } from './ui';

export interface IncomeForm {
  client_name: string;
  invoice_no: string;
  taxable_amount: string;
  gst_rate: string;
  gst_type: 'INTRA' | 'INTER';
  description: string;
}

export const emptyIncomeForm: IncomeForm = {
  client_name: '', invoice_no: '', taxable_amount: '', gst_rate: '18', gst_type: 'INTRA', description: '',
};

export default function GstManager({
  incomes, onAdd,
}: {
  incomes: any[];
  onAdd: (form: IncomeForm) => Promise<boolean>;
}) {
  const [form, setForm] = useState<IncomeForm>(emptyIncomeForm);
  const [saving, setSaving] = useState(false);
  const [limit, setLimit] = useState(25);

  const totals = useMemo(() => {
    let taxable = 0, gst = 0, gross = 0;
    incomes.forEach((i) => { taxable += Number(i.taxable_amount || 0); gst += Number(i.gst_amount || 0); gross += Number(i.total_amount || 0); });
    return { taxable: round2(taxable), gst: round2(gst), gross: round2(gross) };
  }, [incomes]);

  const preview = useMemo(() => {
    const t = Number(form.taxable_amount);
    const r = Number(form.gst_rate);
    if (!Number.isFinite(t) || t <= 0) return null;
    const g = round2((t * r) / 100);
    return { gst: g, total: round2(t + g) };
  }, [form.taxable_amount, form.gst_rate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onAdd(form);
    setSaving(false);
    if (ok) setForm(emptyIncomeForm);
  };

  const exportCsv = () =>
    downloadCsv('gst_income_register.csv', [
      ['Date', 'Invoice No', 'Client', 'Taxable', 'GST Rate %', 'CGST', 'SGST', 'IGST', 'GST Amount', 'Total'],
      ...incomes.map((i) => [
        i.created_at ? new Date(i.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        i.invoice_no, i.client_name, i.taxable_amount, i.gst_rate, i.cgst, i.sgst, i.igst, i.gst_amount, i.total_amount,
      ]),
    ]);

  const label = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Taxable income" value={inr0(totals.taxable)} />
        <Stat label="GST collected" value={inr0(totals.gst)} tone="positive" hint="Payable to the government" />
        <Stat label="Gross (incl. GST)" value={inr0(totals.gross)} tone="info" />
      </div>

      <Card title="Record an invoice" subtitle="Manual B2B / B2C income entry. Gateway revenue invoices are generated from the Revenue tab.">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div><label className={label}>Client / customer</label>
            <input required className={`${inputCls} w-full`} value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="e.g. ABC Corp" /></div>
          <div><label className={label}>Invoice number</label>
            <input className={`${inputCls} w-full`} value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} placeholder="Auto if empty" /></div>
          <div><label className={label}>Taxable amount (₹)</label>
            <input required type="number" min="0" step="0.01" className={`${inputCls} w-full`} value={form.taxable_amount} onChange={(e) => setForm({ ...form, taxable_amount: e.target.value })} placeholder="10000" /></div>
          <div><label className={label}>GST rate</label>
            <select className={`${inputCls} w-full`} value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}>
              {['5', '12', '18', '28'].map((r) => <option key={r} value={r}>{r}%</option>)}
            </select></div>
          <div><label className={label}>Supply type</label>
            <select className={`${inputCls} w-full`} value={form.gst_type} onChange={(e) => setForm({ ...form, gst_type: e.target.value as any })}>
              <option value="INTRA">Intra-state (CGST + SGST)</option><option value="INTER">Inter-state (IGST)</option>
            </select></div>
          <div className="flex items-end gap-3">
            <Btn type="submit" variant="primary" disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Record invoice'}</Btn>
          </div>
          {preview && (
            <p className="sm:col-span-2 lg:col-span-3 text-xs text-slate-600">
              GST <b>{inr(preview.gst)}</b> · Invoice total <b>{inr(preview.total)}</b>
            </p>
          )}
        </form>
      </Card>

      <Card title="Income register" subtitle={`${incomes.length} invoice${incomes.length === 1 ? '' : 's'}`} actions={<Btn size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export CSV</Btn>} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr><th className={thCls}>Invoice / date</th><th className={thCls}>Client</th><th className={`${thCls} text-right`}>Taxable</th><th className={thCls}>GST split</th><th className={`${thCls} text-right`}>Total</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {incomes.length === 0 && (<tr><td colSpan={5}><EmptyState title="No invoices recorded yet" /></td></tr>)}
              {incomes.slice(0, limit).map((i, idx) => (
                <tr key={i.id ?? idx} className="hover:bg-slate-50/70">
                  <td className={tdCls}>
                    <div className="font-mono text-xs font-semibold text-slate-900">{i.invoice_no || '—'}</div>
                    <div className="text-xs text-slate-500">{i.created_at ? new Date(i.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : ''}</div>
                  </td>
                  <td className={`${tdCls} font-medium text-slate-900`}>{i.client_name}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{inr(Number(i.taxable_amount || 0))}</td>
                  <td className={`${tdCls} text-xs text-slate-600`}>
                    {Number(i.igst) > 0 ? <>IGST {inr(Number(i.igst))}</> : <>CGST {inr(Number(i.cgst || 0))} · SGST {inr(Number(i.sgst || 0))}</>}
                  </td>
                  <td className={`${tdCls} text-right tabular-nums font-semibold`}>{inr(Number(i.total_amount || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {incomes.length > limit && (
          <div className="p-3 border-t border-slate-100 text-center"><Btn size="sm" onClick={() => setLimit((l) => l + 50)}>Show more ({incomes.length - limit} remaining)</Btn></div>
        )}
      </Card>
    </div>
  );
}
