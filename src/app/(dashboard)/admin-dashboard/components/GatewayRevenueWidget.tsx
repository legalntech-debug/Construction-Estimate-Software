'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface GatewayRevenueWidgetProps {
  gatewayTxns: any[];
  onGstConsolidated?: () => void;
}

export default function GatewayRevenueWidget({ gatewayTxns, onGstConsolidated }: GatewayRevenueWidgetProps) {
  const [isHidden, setIsHidden] = useState(false);
  const [gatewayFilterMode, setGatewayFilterMode] = useState<'month' | 'date' | 'year' | 'fy'>('month');
  const [selectedGatewayMonth, setSelectedGatewayMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedGatewayDate, setSelectedGatewayDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedGatewayYear, setSelectedGatewayYear] = useState(new Date().getFullYear().toString());
  const [selectedGatewayFY, setSelectedGatewayFY] = useState('2026-27');

  const filteredGatewayTxns = gatewayTxns.filter((tx: any) => {
    const txDateStr = tx.created_at || tx.date || tx.payment_date || '';
    if (!txDateStr) return false;
    const txDate = new Date(txDateStr);
    
    if (gatewayFilterMode === 'month') {
      return txDateStr.startsWith(selectedGatewayMonth);
    } else if (gatewayFilterMode === 'date') {
      return txDateStr.startsWith(selectedGatewayDate);
    } else if (gatewayFilterMode === 'year') {
      return txDate.getFullYear().toString() === selectedGatewayYear;
    } else if (gatewayFilterMode === 'fy') {
      const year = txDate.getFullYear();
      const month = txDate.getMonth() + 1;
      const startYear = month >= 4 ? year : year - 1;
      const fyString = `${startYear}-${(startYear + 1).toString().slice(-2)}`;
      return fyString === selectedGatewayFY;
    }
    return true;
  });

  const activeGatewayRevenue = filteredGatewayTxns.reduce((sum: number, tx: any) => {
    const amt = Number(tx.amount || tx.user_payment || tx.gross_amount || tx.paid_amount || 0);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const totalGatewayRevenueAllTime = gatewayTxns.reduce((sum: number, tx: any) => {
    const amt = Number(tx.amount || tx.user_payment || tx.gross_amount || tx.paid_amount || 0);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const handleExportGatewayExcel = () => {
    if (filteredGatewayTxns.length === 0) {
      alert('No transactions found for the selected filter to export.');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Payment ID,Reference No,Customer Name,Case Type,Date,Amount Paid,Status\r\n";

    filteredGatewayTxns.forEach((tx: any) => {
      const row = [
        tx.reference_no || tx.razorpay_payment_id || 'N/A',
        `"${tx.reference_no || ''}"`,
        `"${tx.customer_name || 'N/A'}"`,
        `"${tx.case_type || 'N/A'}"`,
        tx.created_at ? new Date(tx.created_at).toLocaleString() : 'N/A',
        Number(tx.amount || tx.user_payment || 0),
        tx.payment_status || 'paid'
      ].join(",");
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gateway_revenue_${gatewayFilterMode}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateMonthlyConsolidatedGST = async () => {
    const revToConsolidate = activeGatewayRevenue > 0 ? activeGatewayRevenue : totalGatewayRevenueAllTime;
    if (revToConsolidate <= 0) {
      alert('No gateway revenue available to consolidate.');
      return;
    }

    const rate = 18;
    const taxable = Number((revToConsolidate / (1 + rate / 100)).toFixed(2));
    const gstAmount = Number((revToConsolidate - taxable).toFixed(2));
    const cgst = Number((gstAmount / 2).toFixed(2));
    const sgst = Number((gstAmount / 2).toFixed(2));

    const payload = {
      client_name: `B2C Consolidated Gateway Sales (${gatewayFilterMode.toUpperCase()})`,
      invoice_no: `B2C-GW-${Date.now().toString().slice(-6)}`,
      taxable_amount: taxable,
      gst_rate: rate,
      gst_amount: gstAmount,
      cgst,
      sgst,
      igst: 0,
      total_amount: revToConsolidate,
      description: `Automated gateway direct payment consolidation (${filteredGatewayTxns.length} transactions).`,
    };

    try {
      const { error } = await supabase.from('admin_incomes').insert([payload]);
      if (error) throw error;

      alert('Successfully generated B2C Consolidated Monthly GST Invoice!');
      if (onGstConsolidated) onGstConsolidated();
    } catch (err: any) {
      alert('Failed to generate consolidated invoice: ' + (err.message || err));
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-4 sm:p-6 my-6 space-y-6 text-slate-100">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-extrabold text-white text-sm sm:text-base tracking-wide uppercase">
            Payment Gateway Advanced Income & Earnings Inspector
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Filter online gateway revenue dynamically by Date, Month, Year, or Financial Year with Excel export support.
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start flex-wrap">
          <button 
            onClick={handleExportGatewayExcel}
            className="flex-1 sm:flex-initial px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>📊 Excel Export</span>
          </button>
          <button 
            onClick={() => setIsHidden(!isHidden)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition"
          >
            {isHidden ? 'Show [+]' : 'Hide [-]'}
          </button>
        </div>
      </div>

      {!isHidden && (
        <div className="space-y-4">
          {/* Filter Bar - Mobile Friendly Layout */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Filter By:</span>
              {(['month', 'date', 'year', 'fy'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setGatewayFilterMode(mode)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition ${
                    gatewayFilterMode === mode 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Dynamic Date/Month Selectors */}
            <div className="w-full lg:w-auto lg:ml-auto flex items-center">
              {gatewayFilterMode === 'month' && (
                <input 
                  type="month"
                  value={selectedGatewayMonth}
                  onChange={(e) => setSelectedGatewayMonth(e.target.value)}
                  className="w-full lg:w-auto bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-black text-blue-400 focus:outline-none focus:border-blue-500"
                />
              )}
              {gatewayFilterMode === 'date' && (
                <input 
                  type="date"
                  value={selectedGatewayDate}
                  onChange={(e) => setSelectedGatewayDate(e.target.value)}
                  className="w-full lg:w-auto bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-black text-blue-400 focus:outline-none focus:border-blue-500"
                />
              )}
              {gatewayFilterMode === 'year' && (
                <select
                  value={selectedGatewayYear}
                  onChange={(e) => setSelectedGatewayYear(e.target.value)}
                  className="w-full lg:w-auto bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-black text-blue-400 focus:outline-none focus:border-blue-500"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              )}
              {gatewayFilterMode === 'fy' && (
                <select
                  value={selectedGatewayFY}
                  onChange={(e) => setSelectedGatewayFY(e.target.value)}
                  className="w-full lg:w-auto bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-black text-blue-400 focus:outline-none focus:border-blue-500"
                >
                  <option value="2026-27">FY 2026-27</option>
                  <option value="2025-26">FY 2025-26</option>
                  <option value="2024-25">FY 2024-25</option>
                </select>
              )}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Filtered Revenue ({gatewayFilterMode.toUpperCase()})</span>
              <p className="text-xl sm:text-2xl font-black text-blue-400 mt-1">₹ {activeGatewayRevenue.toLocaleString('en-IN')}</p>
              <span className="text-[10px] text-slate-500 mt-1 block">{filteredGatewayTxns.length} matching transactions</span>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase">All-Time Revenue</span>
              <p className="text-xl sm:text-2xl font-black text-slate-100 mt-1">₹ {totalGatewayRevenueAllTime.toLocaleString('en-IN')}</p>
              <span className="text-[10px] text-slate-500 mt-1 block">{gatewayTxns.length} total fetched transactions</span>
            </div>
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Actionable Note</span>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1">Convert current filtered earnings directly into monthly GST filings.</p>
              </div>
              <button
                onClick={handleGenerateMonthlyConsolidatedGST}
                className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                ⚡ Convert Period to GST
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}