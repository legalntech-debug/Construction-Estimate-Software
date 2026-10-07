'use client';

import { TrendingUp, TrendingDown, IndianRupee, Users, Package, Activity } from 'lucide-react';

export default function KpiCards({ data, previousPeriodData, totalUsers }: any) {
  const totalRevenue = data.reduce((s: number, r: any) => s + Number(r.user_payment || 0), 0);
  const totalBusiness = data.reduce((s: number, r: any) => s + Number(r.fee_standard || 0), 0);
  const totalEntries = data.length;

  // ✅ FIX: Unique user_id count karo (client_name nahi)
  // Kyunki client_name = bank name (HDFC, YES BANK) — actual client nahi
  const uniqueUserIds = new Set(
    data.map((r: any) => r.user_id).filter(Boolean)
  ).size;

  // ✅ Priority: totalUsers (from profiles) > uniqueUserIds (from records)
  const activeClientCount = totalUsers || uniqueUserIds;

  const paidRows = data.filter((r: any) =>
    ['RECEIVED', 'PAID', 'COMPLETED'].includes((r.status || '').toUpperCase())
  );
  const paidBusiness = paidRows.reduce((s: number, r: any) => s + Number(r.fee_standard || 0), 0);
  const collectionRate = totalBusiness > 0 ? (paidBusiness / totalBusiness) * 100 : 0;

  // Trend
  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const previousRevenue = previousPeriodData
    .filter((r: any) => new Date(r.created_date).getTime() < thirtyDaysAgo)
    .reduce((s: number, r: any) => s + Number(r.user_payment || 0), 0);

  const revenueChange = previousRevenue > 0
    ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
    : 0;
  const isUp = revenueChange >= 0;

  const cards = [
    {
      label: 'Net Revenue',
      value: `₹${totalRevenue.toLocaleString('en-IN')}`,
      sub: 'Actual amount received',
      icon: IndianRupee,
      color: 'blue',
      trend: revenueChange,
      showTrend: true,
    },
    {
      label: 'Business Value',
      value: `₹${totalBusiness.toLocaleString('en-IN')}`,
      sub: `${totalEntries} total entries`,
      icon: Package,
      color: 'indigo',
    },
    {
      label: 'Collection Rate',
      value: `${collectionRate.toFixed(1)}%`,
      sub: `${paidRows.length} paid / ${data.length}`,
      icon: Activity,
      color: 'emerald',
    },
    {
      label: 'Active Clients',
      value: activeClientCount,  // ✅ FIXED
      sub: totalUsers ? 'Total registered users' : 'Unique clients',
      icon: Users,
      color: 'amber',
    },
  ];

  const colorMap: any = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100' },
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', border: 'border-indigo-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100' },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const colors = colorMap[c.color];
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={`bg-white rounded-2xl p-5 border ${colors.border} shadow-sm hover:shadow-md transition`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${colors.icon}`} />
              </div>
              {c.showTrend && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                  isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(revenueChange).toFixed(1)}%
                </div>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {c.label}
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1 leading-tight">{c.value}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">{c.sub}</p>
          </div>
        );
      })}
    </div>
  );
}