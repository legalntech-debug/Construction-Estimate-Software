'use client';

import { LineChart, TrendingUp, TrendingDown } from 'lucide-react';
import { useMemo } from 'react';

export default function SalesTrendChart({ data }: any) {
  const monthlyData = useMemo(() => {
    const map: Record<string, { revenue: number; business: number; count: number }> = {};
    data.forEach((r: any) => {
      const d = new Date(r.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { revenue: 0, business: 0, count: 0 };
      map[key].revenue += Number(r.user_payment || 0);
      map[key].business += Number(r.fee_standard || 0);
      map[key].count += 1;
    });
    return Object.entries(map)
      .map(([k, v]) => ({ month: k, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [data]);

  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);
  const monthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[parseInt(mo) - 1]} ${y.slice(-2)}`;
  };

  // ✅ FIX: Current incomplete month ko trend se exclude karo
  // Sirf complete months ka MoM (Month-over-Month) trend dikhao
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const completeMonths = monthlyData.filter(m => m.month !== currentMonthKey);
  const trendData = completeMonths.length >= 2 ? completeMonths : monthlyData;

  // Compare last two COMPLETE months (MoM growth)
  const trend = trendData.length >= 2
    ? trendData[trendData.length - 1].revenue - trendData[trendData.length - 2].revenue
    : 0;
  const isUp = trend >= 0;
  const showTrend = trendData.length >= 2;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <LineChart className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Sales Trend
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Month-wise revenue performance
            </p>
          </div>
        </div>
        {showTrend && (
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold ${
            isUp ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                 : 'bg-rose-50 text-rose-600 border border-rose-200'
          }`}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isUp ? 'Growing' : 'Declining'} trend
          </div>
        )}
      </div>

      {monthlyData.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          No data available
        </div>
      ) : (
        <>
          {/* Bar Chart */}
          <div className="flex items-end gap-2 h-52 mb-4 pb-2 border-b-2 border-slate-200">
            {monthlyData.map((m) => {
              const heightPercent = (m.revenue / maxRevenue) * 100;
              const isCurrentMonth = m.month === currentMonthKey;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <span className="text-[9px] font-bold text-slate-700 mb-0.5">
                    ₹{m.revenue > 0 ? (m.revenue >= 1000 ? `${(m.revenue / 1000).toFixed(1)}k` : m.revenue) : '0'}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t transition-all cursor-pointer ${
                        isCurrentMonth
                          ? 'bg-gradient-to-t from-amber-500 via-amber-400 to-amber-300 hover:from-amber-600 hover:to-amber-400'
                          : 'bg-gradient-to-t from-blue-600 via-blue-500 to-indigo-400 hover:from-blue-700 hover:to-indigo-500'
                      }`}
                      style={{ height: `${Math.max(heightPercent, 3)}%`, minHeight: '6px' }}
                    />
                  </div>
                  <span className={`text-[9px] font-bold uppercase ${
                    isCurrentMonth ? 'text-amber-600' : 'text-slate-500'
                  }`}>
                    {monthLabel(m.month)}
                    {isCurrentMonth && '*'}
                  </span>

                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10 pointer-events-none">
                    <div>₹{m.revenue.toLocaleString('en-IN')}</div>
                    <div className="text-[9px] text-slate-300 font-medium">{m.count} entries</div>
                    {isCurrentMonth && (
                      <div className="text-[9px] text-amber-300 font-medium">Current (incomplete)</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gradient-to-br from-blue-600 to-indigo-500" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Net Revenue
                </span>
              </div>
              {completeMonths.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gradient-to-br from-amber-500 to-amber-400" />
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                    Current Month*
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-medium">Peak:</span>
                <span className="text-[10px] text-emerald-600 font-bold">
                  ₹{maxRevenue.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {monthlyData.length} month{monthlyData.length !== 1 ? 's' : ''} data
            </span>
          </div>

          {/* Trend note */}
          {showTrend && completeMonths.length > 0 && (
            <p className="text-[9px] text-slate-400 mt-2 italic">
              * Trend badge based on complete months only ({trendData.length} months compared)
            </p>
          )}
        </>
      )}
    </div>
  );
}