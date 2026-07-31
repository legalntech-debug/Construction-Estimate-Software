'use client';

import { useState } from 'react';

export default function RazorpayRevenueChart({ transactions }: { transactions: any[] }) {
  const [timeframe, setTimeframe] = useState<'daily' | 'case_type'>('daily');

  // 1. Calculate Total Revenue & Metrics
  const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.user_payment || 0), 0);
  const totalTxns = transactions.length;
  const avgTicketSize = totalTxns > 0 ? totalRevenue / totalTxns : 0;

  // 2. Group by Case Type for Business Strength Analysis
  const caseTypeMap: { [key: string]: number } = {};
  // 3. Group by Date for Trend Analysis
  const dateMap: { [key: string]: number } = {};

  transactions.forEach((t) => {
    const cType = t.estimate_type || 'GENERAL';
    caseTypeMap[cType] = (caseTypeMap[cType] || 0) + Number(t.user_payment || 0);

    const dateKey = new Date(t.created_at || Date.now()).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
    dateMap[dateKey] = (dateMap[dateKey] || 0) + Number(t.user_payment || 0);
  });

  const topCaseType = Object.entries(caseTypeMap).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
      {/* Header & Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Razorpay Revenue Intelligence Engine</h3>
          <p className="text-xs text-gray-500">Deep financial health, cash flow velocity, and service strengths.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setTimeframe('daily')}
            className={`px-3 py-1.5 rounded-lg transition ${timeframe === 'daily' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            Daily Collections
          </button>
          <button
            onClick={() => setTimeframe('case_type')}
            className={`px-3 py-1.5 rounded-lg transition ${timeframe === 'case_type' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            Revenue by Case Type
          </button>
        </div>
      </div>

      {/* Quick Business Health Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Avg. Ticket Size</span>
          <p className="text-xl font-black text-blue-900 mt-1">₹ {Math.round(avgTicketSize).toLocaleString()}</p>
          <span className="text-[10px] text-blue-500 font-medium">Per transaction value</span>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Top Earning Service</span>
          <p className="text-xl font-black text-emerald-900 mt-1 uppercase truncate">{topCaseType[0]}</p>
          <span className="text-[10px] text-emerald-600 font-medium">₹ {topCaseType[1].toLocaleString()} generated</span>
        </div>
        <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl">
          <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Conversion Volume</span>
          <p className="text-xl font-black text-purple-900 mt-1">{totalTxns} Paid Orders</p>
          <span className="text-[10px] text-purple-500 font-medium">Active gateway throughput</span>
        </div>
      </div>

      {/* Visual Analytics Bars */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          {timeframe === 'daily' ? 'Recent Daily Cashflow Breakdown' : 'Revenue Share by Service Type'}
        </h4>

        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-2">
          {timeframe === 'daily' ? (
            Object.keys(dateMap).length > 0 ? (
              Object.entries(dateMap).map(([date, amt]) => {
                const percentage = totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0;
                return (
                  <div key={date} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700">{date}</span>
                      <span className="text-gray-900">₹ {amt.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(percentage, 5)}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">No daily transaction metrics available.</p>
            )
          ) : (
            Object.keys(caseTypeMap).length > 0 ? (
              Object.entries(caseTypeMap).map(([type, amt]) => {
                const percentage = totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0;
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-700 uppercase">{type}</span>
                      <span className="text-gray-900">₹ {amt.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(percentage, 5)}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">No case type metrics available.</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}