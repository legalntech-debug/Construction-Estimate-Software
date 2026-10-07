'use client';

import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { useMemo } from 'react';

export default function FyComparisonChart({ data }: any) {
  const fyData = useMemo(() => {
    const map: Record<string, { revenue: number; business: number; count: number; startYear: number }> = {};
    data.forEach((r: any) => {
      const d = new Date(r.created_date);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const startYear = m >= 4 ? y : y - 1;
      const fyKey = `FY${startYear}-${String(startYear + 1).slice(-2)}`;
      if (!map[fyKey]) map[fyKey] = { revenue: 0, business: 0, count: 0, startYear };
      map[fyKey].revenue += Number(r.user_payment || 0);
      map[fyKey].business += Number(r.fee_standard || 0);
      map[fyKey].count += 1;
    });
    return Object.entries(map)
      .map(([fy, v]) => ({ fy, ...v }))
      .sort((a, b) => a.startYear - b.startYear);
  }, [data]);

  const maxRevenue = Math.max(...fyData.map(f => f.revenue), 1);
  const totalRevenue = fyData.reduce((s, f) => s + f.revenue, 0);

  // YoY growth
  const getYoY = (idx: number) => {
    if (idx === 0 || fyData[idx - 1].revenue === 0) return 0;
    return ((fyData[idx].revenue - fyData[idx - 1].revenue) / fyData[idx - 1].revenue) * 100;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              FY-wise Comparison
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Year-over-year revenue growth
            </p>
          </div>
        </div>
        <span className="text-[10px] text-slate-500 font-bold uppercase bg-slate-100 px-2 py-1 rounded">
          {fyData.length} FY
        </span>
      </div>

      {fyData.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No FY data available</div>
      ) : (
        <div className="space-y-5">
          {/* FY bars */}
          {fyData.map((f, idx) => {
            const heightPercent = (f.revenue / maxRevenue) * 100;
            const yoy = getYoY(idx);
            const isUp = yoy >= 0;
            const sharePercent = totalRevenue > 0 ? (f.revenue / totalRevenue) * 100 : 0;

            return (
              <div key={f.fy} className="group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {f.fy}
                    </span>
                    {idx > 0 && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {isUp ? '+' : ''}{yoy.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 font-bold">
                      {sharePercent.toFixed(1)}% share
                    </span>
                    <span className="text-xs font-bold text-slate-900 min-w-[70px] text-right">
                      ₹{f.revenue.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <div className="h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500 rounded-lg transition-all flex items-center justify-end pr-3"
                    style={{ width: `${Math.max(heightPercent, 8)}%` }}
                  >
                    {heightPercent > 20 && (
                      <span className="text-[10px] font-bold text-white">
                        {f.count} entries
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Summary */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Total Revenue</p>
              <p className="text-sm font-bold text-slate-900 mt-1">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Best FY</p>
              <p className="text-sm font-bold text-emerald-600 mt-1">
                {fyData.reduce((best, f) => f.revenue > best.revenue ? f : best, fyData[0]).fy}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}