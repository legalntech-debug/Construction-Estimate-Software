"use client";

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
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm my-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800 text-base">Revenue & Analytics Trend</h3>
          <p className="text-xs text-slate-500">Visualizing recent transaction history</p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
          {chartData.length} Records
        </span>
      </div>

      <div className="h-[300px] w-full pt-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  borderRadius: '12px', 
                  border: 'none', 
                  color: '#fff', 
                  fontSize: '12px' 
                }}
                itemStyle={{ color: '#38bdf8' }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#2563eb" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#2563eb' }} 
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
            NO TRANSACTION DATA AVAILABLE
          </div>
        )}
      </div>
    </div>
  );
}