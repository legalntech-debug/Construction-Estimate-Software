'use client';

import { useState, useMemo } from 'react';
import { X, Calendar, DollarSign, ArrowDownRight, CheckCircle2, Landmark, Filter } from 'lucide-react';

interface PayoutBreakdownModalProps {
  onClose: () => void;
  referralRevenue: number;
  totalSettled: number;
  currentWalletBal: number;
  referredUsers: any[];
  payoutHistory: any[];
}

export default function PayoutBreakdownModal({
  onClose,
  referralRevenue,
  totalSettled,
  currentWalletBal,
  referredUsers,
  payoutHistory,
}: PayoutBreakdownModalProps) {
  const [viewMode, setViewMode] = useState<'MONTHLY' | 'FY'>('MONTHLY');

  const isNegativeWallet = currentWalletBal < 0;
  const negativeDeficit = isNegativeWallet ? Math.abs(currentWalletBal) : 0;
  const netPayable = Math.max(0, referralRevenue - totalSettled - negativeDeficit);

  // Grouping Data Month-Wise & FY-Wise
  const groupedData = useMemo(() => {
    const map: Record<string, { label: string; grossRevenue: number; commission: number; settled: number }> = {};

    // Group Commissions from Referred Users
    referredUsers.forEach((u) => {
      const uDate = u.rawDate ? new Date(u.rawDate) : new Date();
      const monthStr = uDate.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
      
      const year = uDate.getFullYear();
      const monthIdx = uDate.getMonth(); // 0 = Jan, 3 = April
      const fyStartYear = monthIdx >= 3 ? year : year - 1;
      const fyStr = `FY ${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`;

      const key = viewMode === 'MONTHLY' ? monthStr : fyStr;

      if (!map[key]) {
        map[key] = { label: key, grossRevenue: 0, commission: 0, settled: 0 };
      }
      map[key].grossRevenue += u.paid_revenue || 0;
      map[key].commission += u.earned_commission_3percent || 0;
    });

    // Group Settled Payouts
    payoutHistory.forEach((p) => {
      let key = (p.settlement_month || 'UNSPECIFIED').toUpperCase();

      if (viewMode === 'FY') {
        const pDate = p.payout_date ? new Date(p.payout_date) : new Date();
        const year = pDate.getFullYear();
        const monthIdx = pDate.getMonth();
        const fyStartYear = monthIdx >= 3 ? year : year - 1;
        key = `FY ${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`;
      }

      if (!map[key]) {
        map[key] = { label: key, grossRevenue: 0, commission: 0, settled: 0 };
      }
      map[key].settled += Number(p.amount_settled) || 0;
    });

    return Object.values(map);
  }, [referredUsers, payoutHistory, viewMode]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-6 uppercase font-mono">
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl w-full max-w-4xl space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
        
        {/* MODAL HEADER */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-black text-indigo-400 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-400" /> REVENUE & PAYOUT BREAKDOWN LEDGER
            </h3>
            <p className="text-[10px] text-slate-400 font-sans">Detailed calculation summary with Wallet Adjustment & Monthly/FY Consolidations.</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* SUMMARY CALCULATION HEADER CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold block">GROSS 3% COMMISSION</span>
            <span className="text-base font-black text-indigo-400">₹ {referralRevenue.toFixed(2)}</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold block">SETTLED PAYOUTS</span>
            <span className="text-base font-black text-amber-400">₹ {totalSettled.toFixed(2)}</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold block">WALLET DEFICIT DEDUCTION</span>
            <span className={`text-base font-black ${isNegativeWallet ? 'text-red-400' : 'text-slate-500'}`}>
              - ₹ {negativeDeficit.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-indigo-900/60 bg-indigo-950/20">
            <span className="text-[10px] text-indigo-300 font-bold block">FINAL NET PAYABLE</span>
            <span className="text-base font-black text-cyan-400">₹ {netPayable.toFixed(2)}</span>
          </div>
        </div>

        {/* VIEW TOGGLE */}
        <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800">
          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <Filter size={14} className="text-indigo-400" /> CONSOLIDATION VIEW:
          </span>
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('MONTHLY')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition ${
                viewMode === 'MONTHLY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              MONTH-WISE
            </button>
            <button
              onClick={() => setViewMode('FY')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition ${
                viewMode === 'FY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              FINANCIAL YEAR (FY)
            </button>
          </div>
        </div>

        {/* BREAKDOWN TABLE */}
        <div className="overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800/80 text-indigo-300 border-b border-slate-800 text-[10px]">
                <th className="p-3">{viewMode === 'MONTHLY' ? 'MONTH / PERIOD' : 'FINANCIAL YEAR'}</th>
                <th className="p-3">USERS GENERATED REV</th>
                <th className="p-3">EARNED COMMISSION (3%)</th>
                <th className="p-3">SETTLED AMOUNT</th>
                <th className="p-3">NET PERIOD BALANCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {groupedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">NO REVENUE RECORDS FOUND.</td>
                </tr>
              ) : (
                groupedData.map((row, idx) => {
                  const periodBalance = Math.max(0, row.commission - row.settled);
                  return (
                    <tr key={idx} className="hover:bg-slate-900/50 transition">
                      <td className="p-3 font-bold text-white">{row.label}</td>
                      <td className="p-3 font-mono text-emerald-400">₹ {row.grossRevenue.toFixed(2)}</td>
                      <td className="p-3 font-mono text-indigo-400 font-bold">₹ {row.commission.toFixed(2)}</td>
                      <td className="p-3 font-mono text-amber-400 font-bold">₹ {row.settled.toFixed(2)}</td>
                      <td className="p-3 font-mono font-black text-cyan-400">₹ {periodBalance.toFixed(2)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER NOTE */}
        <div className="text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <span>* Net Payable = (Active Commission - Settled Payouts) - Minus Wallet Balance Deficit.</span>
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold">
            CLOSE
          </button>
        </div>

      </div>
    </div>
  );
}