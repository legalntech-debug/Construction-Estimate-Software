'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardChartProps {
  data?: any[];
  /** how many of the most recent records to plot */
  limit?: number;
}

const stamp = (item: any): number => {
  const t = new Date(item.created_at || item.created_date || 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** MIS record amounts over time (oldest -> newest). */
export default function DashboardChart({ data = [], limit = 30 }: DashboardChartProps) {
  const safeData = Array.isArray(data) ? data : [];

  const chartData = [...safeData]
    .sort((a, b) => stamp(a) - stamp(b))
    .slice(-limit)
    .map((item, index) => {
      const ts = stamp(item);
      return {
        name: ts
          ? new Date(ts).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' })
          : `#${index + 1}`,
        revenue: Number(item.fee_standard || item.amount || item.user_payment || item.paid_amount || 0),
      };
    });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500">Most recent {chartData.length} MIS record{chartData.length === 1 ? '' : 's'} in the selected window</p>
      </div>
      <div className="h-[260px] w-full" role="img" aria-label="MIS record amounts over time">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(val: any) => [`₹${Number(val || 0).toLocaleString('en-IN')}`, 'Amount']}
              />
              <Line type="monotone" dataKey="revenue" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3, fill: '#1d4ed8' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-slate-500 rounded-lg border border-dashed border-slate-200">
            No MIS records in this window
          </div>
        )}
      </div>
    </div>
  );
}
