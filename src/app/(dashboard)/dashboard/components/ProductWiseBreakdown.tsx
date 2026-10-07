'use client';

import { Package } from 'lucide-react';
import { useMemo } from 'react';

export default function ProductWiseBreakdown({ data }: any) {
  const productData = useMemo(() => {
    const map: Record<string, { revenue: number; business: number; count: number }> = {};
    data.forEach((r: any) => {
      const key = r.case_type || 'OTHER';
      if (!map[key]) map[key] = { revenue: 0, business: 0, count: 0 };
      map[key].revenue += Number(r.user_payment || 0);
      map[key].business += Number(r.fee_standard || 0);
      map[key].count += 1;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  const total = productData.reduce((s, p) => s + p.revenue, 0);

  const colors = [
    'from-blue-500 to-indigo-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-purple-500 to-pink-500',
    'from-rose-500 to-red-500',
    'from-cyan-500 to-blue-500',
    'from-lime-500 to-green-500',
    'from-fuchsia-500 to-purple-500',
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Package className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Product-wise Sales
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Revenue distribution by case type
            </p>
          </div>
        </div>
        <span className="text-[10px] text-slate-500 font-bold uppercase bg-slate-100 px-2 py-1 rounded">
          {productData.length} product{productData.length !== 1 ? 's' : ''}
        </span>
      </div>

      {productData.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No product data available</div>
      ) : (
        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
          {productData.map((p, idx) => {
            const percent = total > 0 ? (p.revenue / total) * 100 : 0;
            const gradient = colors[idx % colors.length];
            return (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-3 h-3 rounded bg-gradient-to-br ${gradient} shrink-0`} />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide truncate">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {p.count} orders
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500 font-bold">
                      {percent.toFixed(1)}%
                    </span>
                    <span className="text-xs font-bold text-slate-900 min-w-[60px] text-right">
                      ₹{p.revenue.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all`}
                    style={{ width: `${Math.max(percent, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}