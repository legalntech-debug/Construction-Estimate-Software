'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardChartProps {
  data?: any[];
}

export default function DashboardChart({ data = [] }: DashboardChartProps) {
  const safeData = Array.isArray(data) ? data : [];

  const chartData = safeData.slice(-10).map((item, index) => ({
    name: item.created_at 
      ? new Date(item.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) 
      : `Entry ${index + 1}`,
    revenue: Number(item.fee_standard || item.amount || item.user_payment || item.paid_amount || 0)
  }));

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-4 sm:p-6 my-6 space-y-4 text-slate-100">
      {/* Header - Stacks on mobile */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="font-extrabold text-white text-sm sm:text-base tracking-wide uppercase">
            Revenue & Analytics Trend
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">Visualizing recent transaction history</p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 bg-slate-800 text-blue-400 border border-slate-700 rounded-lg self-start sm:self-auto">
          {chartData.length} Records
        </span>
      </div>

      {/* Chart Container */}
      <div className="h-[260px] sm:h-[300px] w-full pt-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10, fill: '#94a3b8' }} 
                stroke="#334155" 
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#94a3b8' }} 
                stroke="#334155" 
                tickFormatter={(val) => `₹${val}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#020617', 
                  borderRadius: '12px', 
                  border: '1px solid #1e293b', 
                  color: '#fff', 
                  fontSize: '11px',
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)'
                }}
                itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }}
                formatter={(val: any) => [`₹${Number(val || 0).toLocaleString('en-IN')}`, 'Revenue']}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3b82f6" 
                strokeWidth={2.5} 
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#60a5fa' }} 
                activeDot={{ r: 6, fill: '#60a5fa' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 font-mono bg-slate-950/40 rounded-xl border border-slate-800/80">
            <span>📉</span>
            <span className="mt-2 text-center px-2">NO TRANSACTION DATA AVAILABLE</span>
          </div>
        )}
      </div>
    </div>
  );
}