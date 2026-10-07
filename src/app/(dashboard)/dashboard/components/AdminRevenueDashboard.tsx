'use client';

import { useState, useMemo } from 'react';
import {
  TrendingUp, IndianRupee, Calendar, MapPin,
  BarChart3, PieChart, FileText, Building2,
  ArrowUpRight, ArrowDownRight, Wallet, Activity
} from 'lucide-react';

interface AdminRevenueDashboardProps {
  estimates: any[];
  userState?: string;
}

type ViewMode = 'month' | 'fy' | 'all' | 'state';

export default function AdminRevenueDashboard({ estimates, userState }: AdminRevenueDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedFY, setSelectedFY] = useState<string>('');

  const getFinancialYear = (dateStr: string): string => {
    if (!dateStr) return 'Unknown';
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    if (month >= 4) return `FY ${year}-${(year + 1).toString().slice(-2)}`;
    return `FY ${year - 1}-${year.toString().slice(-2)}`;
  };

  const getMonthLabel = (dateStr: string): string => {
    if (!dateStr) return 'Unknown';
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // ✅ Revenue Helpers — user_payment is actual money received
  const getRowRevenue = (row: any): number => {
    // user_payment = actual money paid by user to platform
    const paid = Number(row.user_payment || 0);
    if (paid > 0) return paid;
    // Fallback: gateway_fee / user_service_fee
    return Number(row.gateway_fee || row.user_service_fee || 0);
  };

  const getRowGrossValue = (row: any): number => {
    return Number(row.fee_standard || 0);
  };

  const isReceivedRow = (row: any): boolean => {
    const status = (row.status || '').toUpperCase();
    const platformStatus = (row.platform_payment_status || '').toLowerCase();
    return (
      status === 'RECEIVED' ||
      status === 'PAID' ||
      status === 'COMPLETED' ||
      platformStatus === 'paid'
    );
  };

  const allFYs = useMemo(() => {
    const fys = new Set<string>();
    estimates.forEach(e => {
      const fy = getFinancialYear(e.created_date || e.created_at);
      if (fy !== 'Unknown') fys.add(fy);
    });
    return Array.from(fys).sort().reverse();
  }, [estimates]);

  useMemo(() => {
    if (!selectedFY && allFYs.length > 0) setSelectedFY(allFYs[0]);
  }, [allFYs, selectedFY]);

  // ✅ Revenue metrics — use user_payment (actual earning)
  const totalRevenue = useMemo(() =>
    estimates.reduce((sum, e) => sum + getRowRevenue(e), 0), [estimates]);

  const receivedRevenue = useMemo(() =>
    estimates
      .filter(e => isReceivedRow(e))
      .reduce((sum, e) => sum + getRowRevenue(e), 0), [estimates]);

  const pendingRevenue = totalRevenue - receivedRevenue;

  // ✅ Gross value — fee_standard sum
  const totalGrossValue = useMemo(() =>
    estimates.reduce((sum, e) => sum + getRowGrossValue(e), 0), [estimates]);

  const receivedGrossValue = useMemo(() =>
    estimates
      .filter(e => isReceivedRow(e))
      .reduce((sum, e) => sum + getRowGrossValue(e), 0), [estimates]);

  // Month-wise
  const monthWiseRevenue = useMemo(() => {
    const map: Record<string, { total: number; received: number; pending: number; count: number }> = {};
    estimates.forEach(e => {
      const key = getMonthLabel(e.created_date || e.created_at);
      if (!map[key]) map[key] = { total: 0, received: 0, pending: 0, count: 0 };
      const amount = getRowRevenue(e);
      map[key].total += amount;
      map[key].count += 1;
      if (isReceivedRow(e)) map[key].received += amount;
      else map[key].pending += amount;
    });
    return Object.entries(map)
      .map(([month, data]) => ({ month, ...data, sortKey: new Date(month).getTime() }))
      .sort((a, b) => b.sortKey - a.sortKey);
  }, [estimates]);

  // FY-wise
  const fyWiseRevenue = useMemo(() => {
    const map: Record<string, { total: number; received: number; pending: number; count: number }> = {};
    estimates.forEach(e => {
      const key = getFinancialYear(e.created_date || e.created_at);
      if (!map[key]) map[key] = { total: 0, received: 0, pending: 0, count: 0 };
      const amount = getRowRevenue(e);
      map[key].total += amount;
      map[key].count += 1;
      if (isReceivedRow(e)) map[key].received += amount;
      else map[key].pending += amount;
    });
    return Object.entries(map)
      .map(([fy, data]) => ({ fy, ...data }))
      .sort((a, b) => b.fy.localeCompare(a.fy));
  }, [estimates]);

  // State-wise
  const stateWiseRevenue = useMemo(() => {
    const map: Record<string, { total: number; received: number; pending: number; count: number }> = {};
    estimates.forEach(e => {
      const state = (e.state || 'Unknown').trim() || 'Unknown';
      if (!map[state]) map[state] = { total: 0, received: 0, pending: 0, count: 0 };
      const amount = getRowRevenue(e);
      map[state].total += amount;
      map[state].count += 1;
      if (isReceivedRow(e)) map[state].received += amount;
      else map[state].pending += amount;
    });
    return Object.entries(map)
      .map(([state, data]) => ({ state, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [estimates]);

  const selectedFYData = useMemo(() =>
    fyWiseRevenue.find(f => f.fy === selectedFY) || { total: 0, received: 0, pending: 0, count: 0 },
    [fyWiseRevenue, selectedFY]);

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatFullCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  const collectionPercent = totalRevenue > 0 ? (receivedRevenue / totalRevenue) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* ═══ HEADER — Corporate Blue ═══ */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base tracking-tight">
                Company Revenue Dashboard
              </h2>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {userState ? `Head Office: ${userState}` : 'All India Business Overview'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-slate-800/80 backdrop-blur rounded-lg px-3 py-1.5 border border-slate-700">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Entries</p>
              <p className="text-white font-bold text-sm leading-tight">{estimates.length}</p>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ KPI CARDS — Premium Corporate ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-slate-50">
        {/* Total Revenue */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition">
              <Wallet className="w-4 h-4 text-blue-600" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
            Total Revenue
          </p>
          <p className="text-slate-900 font-bold text-xl leading-tight">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            {formatFullCurrency(totalRevenue)}
          </p>
        </div>

        {/* Received */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
            Received
          </p>
          <p className="text-emerald-600 font-bold text-xl leading-tight">
            {formatCurrency(receivedRevenue)}
          </p>
          <p className="text-[10px] text-emerald-500/70 mt-1 font-medium">
            {formatFullCurrency(receivedRevenue)}
          </p>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition">
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
            <ArrowDownRight className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
            Pending
          </p>
          <p className="text-amber-600 font-bold text-xl leading-tight">
            {formatCurrency(pendingRevenue)}
          </p>
          <p className="text-[10px] text-amber-500/70 mt-1 font-medium">
            {formatFullCurrency(pendingRevenue)}
          </p>
        </div>

        {/* Collection % */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition">
              <PieChart className="w-4 h-4 text-indigo-600" />
            </div>
            <Activity className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
            Collection Rate
          </p>
          <p className="text-indigo-600 font-bold text-xl leading-tight">
            {collectionPercent.toFixed(1)}%
          </p>
          {/* Mini progress bar */}
          <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${Math.min(collectionPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ═══ VIEW MODE TABS — Premium ═══ */}
      <div className="px-5 pb-3">
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {[
            { key: 'month' as ViewMode, label: 'Month-wise', icon: Calendar },
            { key: 'fy' as ViewMode, label: 'FY-wise', icon: FileText },
            { key: 'state' as ViewMode, label: 'State-wise', icon: MapPin },
            { key: 'all' as ViewMode, label: 'All FY', icon: Building2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all cursor-pointer ${
                viewMode === key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ CONTENT AREA ═══ */}
      <div className="p-5 pt-2 space-y-4 max-h-[500px] overflow-y-auto">

        {/* ─── MONTH-WISE ─── */}
        {viewMode === 'month' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Monthly Revenue Breakdown
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">
                {monthWiseRevenue.length} months
              </span>
            </div>
            {monthWiseRevenue.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-xs font-medium">No data available</p>
              </div>
            ) : (
              monthWiseRevenue.slice(0, 12).map((m) => (
                <div key={m.month} className="bg-white rounded-xl p-4 border border-slate-200 hover:border-blue-300 hover:shadow-sm transition">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-slate-900 font-bold text-sm">{m.month}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{m.count} entries</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-900 font-bold text-sm">{formatFullCurrency(m.total)}</p>
                      <p className="text-[10px] text-emerald-500 font-semibold">
                        {m.total > 0 ? ((m.received / m.total) * 100).toFixed(0) : 0}% collected
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Total</p>
                      <p className="text-slate-700 font-bold text-xs mt-0.5">{formatCurrency(m.total)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-emerald-600 uppercase font-bold tracking-wider">Received</p>
                      <p className="text-emerald-600 font-bold text-xs mt-0.5">{formatCurrency(m.received)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-amber-600 uppercase font-bold tracking-wider">Pending</p>
                      <p className="text-amber-600 font-bold text-xs mt-0.5">{formatCurrency(m.pending)}</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                      style={{ width: `${m.total > 0 ? (m.received / m.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── FY-WISE ─── */}
        {viewMode === 'fy' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Financial Year Revenue
              </h3>
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="bg-white text-slate-700 text-[11px] font-bold rounded-lg px-3 py-1.5 border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
              </select>
            </div>

            {selectedFY && (
              <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    {selectedFY} Summary
                  </p>
                  <span className="text-[10px] text-blue-600 font-bold bg-white px-2 py-0.5 rounded-full border border-blue-100">
                    {selectedFYData.count} entries
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Revenue</p>
                    <p className="text-slate-900 font-bold text-lg mt-0.5">{formatFullCurrency(selectedFYData.total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider">Received</p>
                    <p className="text-emerald-600 font-bold text-lg mt-0.5">{formatFullCurrency(selectedFYData.received)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-amber-600 uppercase font-bold tracking-wider">Pending</p>
                    <p className="text-amber-600 font-bold text-lg mt-0.5">{formatFullCurrency(selectedFYData.pending)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-600 uppercase font-bold tracking-wider">Collection</p>
                    <p className="text-indigo-600 font-bold text-lg mt-0.5">
                      {selectedFYData.total > 0 ? ((selectedFYData.received / selectedFYData.total) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {fyWiseRevenue.map(fy => (
                <div
                  key={fy.fy}
                  className={`rounded-xl p-3.5 border transition-all cursor-pointer ${
                    selectedFY === fy.fy
                      ? 'border-blue-300 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                  }`}
                  onClick={() => setSelectedFY(fy.fy)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-900 font-bold text-sm">{fy.fy}</span>
                    <span className="text-blue-700 font-bold text-sm">{formatCurrency(fy.total)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      ✓ {formatCurrency(fy.received)} received
                    </span>
                    <span className="text-[10px] text-amber-600 font-semibold">
                      ⏳ {formatCurrency(fy.pending)} pending
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── STATE-WISE ─── */}
        {viewMode === 'state' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                State-wise Distribution
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">
                {stateWiseRevenue.length} states
              </span>
            </div>
            {stateWiseRevenue.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-xs font-medium">No state data available</p>
              </div>
            ) : (
              stateWiseRevenue.map((s, idx) => {
                const percentage = totalRevenue > 0 ? (s.total / totalRevenue) * 100 : 0;
                return (
                  <div key={s.state} className="bg-white rounded-xl p-4 border border-slate-200 hover:border-blue-300 hover:shadow-sm transition">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800 border border-amber-300' :
                          idx === 1 ? 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 border border-slate-300' :
                          idx === 2 ? 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border border-orange-300' :
                          'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="text-slate-900 font-bold text-sm uppercase tracking-wide">{s.state}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{s.count} entries</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-900 font-bold text-sm">{formatCurrency(s.total)}</p>
                        <p className="text-[10px] text-blue-600 font-bold">{percentage.toFixed(1)}% share</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-[9px] text-emerald-600 uppercase font-bold tracking-wider">Received</p>
                        <p className="text-emerald-600 font-bold text-xs mt-0.5">{formatCurrency(s.received)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-amber-600 uppercase font-bold tracking-wider">Pending</p>
                        <p className="text-amber-600 font-bold text-xs mt-0.5">{formatCurrency(s.pending)}</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ─── ALL FY ─── */}
        {viewMode === 'all' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              All Financial Years — Complete Overview
            </h3>

            {/* FY Bar Chart */}
            {fyWiseRevenue.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-4">
                  FY Revenue Trend
                </p>
                <div className="space-y-3">
                  {fyWiseRevenue.map(fy => {
                    const maxTotal = Math.max(...fyWiseRevenue.map(f => f.total), 1);
                    return (
                      <div key={fy.fy}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-[11px] text-slate-700 font-bold">{fy.fy}</span>
                          <span className="text-[11px] text-blue-700 font-bold">{formatCurrency(fy.total)}</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                            style={{ width: `${(fy.received / maxTotal) * 100}%` }}
                            title={`Received: ${formatFullCurrency(fy.received)}`}
                          />
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all"
                            style={{ width: `${(fy.pending / maxTotal) * 100}%` }}
                            title={`Pending: ${formatFullCurrency(fy.pending)}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-gradient-to-br from-emerald-500 to-emerald-400" />
                    <span className="text-[10px] text-slate-600 font-bold uppercase">Received</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-gradient-to-br from-amber-500 to-amber-400" />
                    <span className="text-[10px] text-slate-600 font-bold uppercase">Pending</span>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">FY</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Received</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Pending</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fyWiseRevenue.map(fy => (
                      <tr key={fy.fy} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3 text-xs text-slate-900 font-bold">{fy.fy}</td>
                        <td className="px-4 py-3 text-xs text-slate-700 font-bold text-right">{formatCurrency(fy.total)}</td>
                        <td className="px-4 py-3 text-xs text-emerald-600 font-bold text-right">{formatCurrency(fy.received)}</td>
                        <td className="px-4 py-3 text-xs text-amber-600 font-bold text-right">{formatCurrency(fy.pending)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 font-bold text-center">{fy.count}</td>
                      </tr>
                    ))}
                    <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-t-2 border-blue-200">
                      <td className="px-4 py-3 text-xs text-blue-900 font-bold uppercase tracking-wider">Grand Total</td>
                      <td className="px-4 py-3 text-xs text-slate-900 font-bold text-right">{formatCurrency(totalRevenue)}</td>
                      <td className="px-4 py-3 text-xs text-emerald-700 font-bold text-right">{formatCurrency(receivedRevenue)}</td>
                      <td className="px-4 py-3 text-xs text-amber-700 font-bold text-right">{formatCurrency(pendingRevenue)}</td>
                      <td className="px-4 py-3 text-xs text-blue-900 font-bold text-center">{estimates.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Live Business Analytics
            </p>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            Admin access only • Auto-refresh on data change
          </p>
        </div>
      </div>
    </div>
  );
}