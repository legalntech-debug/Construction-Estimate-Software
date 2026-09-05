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
    <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-4 sm:p-6 my-6 space-y-6 text-slate-100">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-extrabold text-white text-sm sm:text-base tracking-wide uppercase">
            GST Filing & Income Management System
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Record B2B/B2C invoices or auto-consolidate direct gateway payments for monthly accounting.
          </p>
        </div>
        <button 
          onClick={() => setIsHidden(!isHidden)}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition self-start sm:self-auto"
        >
          {isHidden ? 'Show [+]' : 'Hide [-]'}
        </button>
      </div>

      {!isHidden && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Taxable Value</span>
              <p className="text-xl font-black text-slate-100 mt-1">₹ {totalTaxableIncome.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total GST Collected</span>
              <p className="text-xl font-black text-blue-400 mt-1">₹ {totalGstCollected.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Gross Revenue</span>
              <p className="text-xl font-black text-emerald-400 mt-1">₹ {totalGrossIncome.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* Manual Income Form */}
          <form onSubmit={handleAddIncomeSubmit} className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide">➕ Add Manual Income / B2B Invoice</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Client Name *"
                value={incomeForm.client_name}
                onChange={(e) => setIncomeForm({ ...incomeForm, client_name: e.target.value })}
                required
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Invoice No (Optional)"
                value={incomeForm.invoice_no}
                onChange={(e) => setIncomeForm({ ...incomeForm, invoice_no: e.target.value })}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                placeholder="Taxable Amount (₹) *"
                value={incomeForm.taxable_amount}
                onChange={(e) => setIncomeForm({ ...incomeForm, taxable_amount: e.target.value })}
                required
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={incomeForm.gst_rate}
                onChange={(e) => setIncomeForm({ ...incomeForm, gst_rate: e.target.value })}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-blue-400 focus:outline-none focus:border-blue-500"
              >
                <option value="18">GST Rate: 18%</option>
                <option value="12">GST Rate: 12%</option>
                <option value="5">GST Rate: 5%</option>
                <option value="0">GST Rate: 0% (Exempt)</option>
              </select>
              <select
                value={incomeForm.gst_type}
                onChange={(e) => setIncomeForm({ ...incomeForm, gst_type: e.target.value })}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-blue-400 focus:outline-none focus:border-blue-500"
              >
                <option value="INTRA">Intra-State (CGST + SGST)</option>
                <option value="INTER">Inter-State (IGST)</option>
              </select>
              <input
                type="text"
                placeholder="Description / Remarks"
                value={incomeForm.description}
                onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm uppercase tracking-wider"
            >
              Save Invoice Record
            </button>
          </form>

          {/* Income & GST Records Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Invoice No</th>
                  <th className="p-3">Client</th>
                  <th className="p-3 text-right">Taxable</th>
                  <th className="p-3 text-right">GST</th>
                  <th className="p-3 text-right">Total Amount</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900">
                {incomes.length > 0 ? (
                  incomes.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-3 font-mono font-bold text-blue-400">{inc.invoice_no}</td>
                      <td className="p-3 font-bold text-slate-200">{inc.client_name}</td>
                      <td className="p-3 text-right font-medium text-slate-300">₹ {Number(inc.taxable_amount).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-medium text-blue-400">₹ {Number(inc.gst_amount).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-bold text-emerald-400">₹ {Number(inc.total_amount).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-slate-400">{new Date(inc.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500 text-xs">No GST income records found.</td>
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