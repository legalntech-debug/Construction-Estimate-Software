'use client';

import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { inr, inrCompact } from '../lib/finance';

export interface TrendPoint { month: string; label: string; earned: number; cashIn: number }

/** Monthly earned revenue vs cash received – last 12 months. */
export default function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  const empty = data.every((d) => d.earned === 0 && d.cashIn === 0);
  if (empty) {
    return <div className="h-64 flex items-center justify-center text-sm text-slate-500">No revenue recorded in the last 12 months.</div>;
  }
  return (
    <div className="h-64 w-full" role="img" aria-label="Monthly earned revenue versus cash received, last 12 months">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => inrCompact(Number(v))} />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.12)' }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
            formatter={(v: any, name: any) => [inr(Number(v)), name]}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="earned" name="Earned revenue" fill="#1d4ed8" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar dataKey="cashIn" name="Cash received" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
