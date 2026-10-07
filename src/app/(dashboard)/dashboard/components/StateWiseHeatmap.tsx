'use client';

import { MapPin, TrendingUp, TrendingDown, Trophy } from 'lucide-react';
import { useMemo } from 'react';

export default function StateWiseHeatmap({ data }: any) {
  const stateData = useMemo(() => {
    const map: Record<string, {
      current: number; previous: number; count: number; clients: Set<string>;
    }> = {};

    const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
    const sixtyDaysAgo = Date.now() - 60 * 24 * 3600 * 1000;

    data.forEach((r: any) => {
      const state = r.state || 'Unknown';
      if (!map[state]) map[state] = { current: 0, previous: 0, count: 0, clients: new Set() };

      const t = new Date(r.created_date).getTime();
      const amount = Number(r.user_payment || 0);
      if (t >= thirtyDaysAgo) map[state].current += amount;
      else if (t >= sixtyDaysAgo) map[state].previous += amount;

      map[state].count += 1;
      if (r.client_name || r.client) map[state].clients.add(r.client_name || r.client);
    });

    return Object.entries(map)
      .map(([state, v]) => ({
        state,
        current: v.current,
        previous: v.previous,
        count: v.count,
        clients: v.clients.size,
        growth: v.previous > 0
          ? ((v.current - v.previous) / v.previous) * 100
          : (v.current > 0 ? 100 : 0),
      }))
      .sort((a, b) => b.current - a.current);
  }, [data]);

  const maxRevenue = Math.max(...stateData.map(s => s.current), 1);
  const totalRevenue = stateData.reduce((s, st) => s + st.current, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              State-wise Performance
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Growth &amp; decline by state
            </p>
          </div>
        </div>
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-100 px-2 py-1 rounded">
          {stateData.length} state{stateData.length !== 1 ? 's' : ''}
        </span>
      </div>

      {stateData.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No state data available</div>
      ) : (
        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
          {stateData.map((s, idx) => {
            const isGrowing = s.growth > 0;
            const width = (s.current / maxRevenue) * 100;
            const sharePercent = totalRevenue > 0 ? (s.current / totalRevenue) * 100 : 0;

            return (
              <div key={s.state} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      idx === 0 ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800 border border-amber-300' :
                      idx === 1 ? 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 border border-slate-300' :
                      idx === 2 ? 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border border-orange-300' :
                      'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                      {idx === 0 ? <Trophy className="w-3 h-3" /> : `#${idx + 1}`}
                    </span>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide truncate">
                      {s.state}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {s.clients} clients
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isGrowing
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}>
                      {isGrowing ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {isGrowing ? '+' : ''}{s.growth.toFixed(0)}%
                    </span>
                    <span className="text-xs font-bold text-slate-900 min-w-[60px] text-right">
                      ₹{s.current.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isGrowing
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        : 'bg-gradient-to-r from-rose-500 to-rose-400'
                    }`}
                    style={{ width: `${Math.max(width, 2)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-slate-400 font-medium">
                    {s.count} entries
                  </span>
                  <span className="text-[9px] text-slate-500 font-bold">
                    {sharePercent.toFixed(1)}% of total
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}