'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface GstIncomeManagementWidgetProps {
  incomes: any[];
  onIncomeAdded: () => void;
}

export default function GstIncomeManagementWidget({ incomes, onIncomeAdded }: GstIncomeManagementWidgetProps) {
  const [isHidden, setIsHidden] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    client_name: '',
    invoice_no: '',
    taxable_amount: '',
    gst_rate: '18',
    gst_type: 'INTRA',
    description: '',
  });

  const handleAddIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const taxable = Number(incomeForm.taxable_amount);
    const rate = Number(incomeForm.gst_rate);

    if (isNaN(taxable) || taxable <= 0) {
      alert('Please enter a valid taxable amount.');
      return;
    }

    const gstAmount = (taxable * rate) / 100;
    const totalAmount = taxable + gstAmount;

    let cgst = 0, sgst = 0, igst = 0;
    if (incomeForm.gst_type === 'INTRA') {
      cgst = gstAmount / 2;
      sgst = gstAmount / 2;
    } else {
      igst = gstAmount;
    }

    try {
      const payload = {
        client_name: incomeForm.client_name,
        invoice_no: incomeForm.invoice_no || `INV-${Date.now().toString().slice(-6)}`,
        taxable_amount: taxable,
        gst_rate: rate,
        gst_amount: gstAmount,
        cgst,
        sgst,
        igst,
        total_amount: totalAmount,
        description: incomeForm.description,
      };

      const { error } = await supabase.from('admin_incomes').insert([payload]);
      if (error) throw error;

      alert('Income and GST recorded successfully!');
      setIncomeForm({ client_name: '', invoice_no: '', taxable_amount: '', gst_rate: '18', gst_type: 'INTRA', description: '' });
      onIncomeAdded();
    } catch (err: any) {
      alert('Failed to save income: ' + (err.message || err));
    }
  };

  const totalTaxableIncome = incomes.reduce((sum, item) => sum + Number(item.taxable_amount || 0), 0);
  const totalGstCollected = incomes.reduce((sum, item) => sum + Number(item.gst_amount || 0), 0);
  const totalGrossIncome = incomes.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6 my-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800 text-base">GST Filing & Income Management System</h3>
          <p className="text-xs text-slate-500">Record B2B/B2C invoices or auto-consolidate direct gateway payments for monthly accounting.</p>
        </div>
        <button 
          onClick={() => setIsHidden(!isHidden)}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
        >
          {isHidden ? 'Show [+]' : 'Hide [-]'}
        </button>
      </div>

      {!isHidden && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Taxable Value</span>
              <p className="text-xl font-black text-slate-800 mt-1">₹ {totalTaxableIncome.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total GST Collected</span>
              <p className="text-xl font-black text-blue-600 mt-1">₹ {totalGstCollected.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Gross Revenue</span>
              <p className="text-xl font-black text-emerald-600 mt-1">₹ {totalGrossIncome.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <form onSubmit={handleAddIncomeSubmit} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase">➕ Add Manual Income / B2B Invoice</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Client Name *"
                value={incomeForm.client_name}
                onChange={(e) => setIncomeForm({ ...incomeForm, client_name: e.target.value })}
                required
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Invoice No (Optional)"
                value={incomeForm.invoice_no}
                onChange={(e) => setIncomeForm({ ...incomeForm, invoice_no: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Taxable Amount (₹) *"
                value={incomeForm.taxable_amount}
                onChange={(e) => setIncomeForm({ ...incomeForm, taxable_amount: e.target.value })}
                required
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={incomeForm.gst_rate}
                onChange={(e) => setIncomeForm({ ...incomeForm, gst_rate: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="18">GST Rate: 18%</option>
                <option value="12">GST Rate: 12%</option>
                <option value="5">GST Rate: 5%</option>
                <option value="0">GST Rate: 0% (Exempt)</option>
              </select>
              <select
                value={incomeForm.gst_type}
                onChange={(e) => setIncomeForm({ ...incomeForm, gst_type: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INTRA">Intra-State (CGST + SGST)</option>
                <option value="INTER">Inter-State (IGST)</option>
              </select>
              <input
                type="text"
                placeholder="Description / Remarks"
                value={incomeForm.description}
                onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm uppercase tracking-wider"
            >
              Save Invoice Record
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Invoice No</th>
                  <th className="p-3">Client</th>
                  <th className="p-3 text-right">Taxable</th>
                  <th className="p-3 text-right">GST</th>
                  <th className="p-3 text-right">Total Amount</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incomes.length > 0 ? (
                  incomes.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold text-blue-600">{inc.invoice_no}</td>
                      <td className="p-3 font-bold text-slate-800">{inc.client_name}</td>
                      <td className="p-3 text-right font-medium">₹ {Number(inc.taxable_amount).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-medium text-blue-600">₹ {Number(inc.gst_amount).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">₹ {Number(inc.total_amount).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-slate-500">{new Date(inc.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400">No GST income records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}