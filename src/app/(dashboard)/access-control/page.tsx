'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import SystemAlerts from '@/app/components/SystemAlerts';
import PushNotificationManager from '@/components/PushNotificationManager';
import {
  Phone,
  PhoneOff,
  TrendingUp,
  Filter,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  MessageCircle,
  User,
  X,
  BarChart3,
  Calendar,
  Users,
  Activity,
  AlertCircle,
} from 'lucide-react';

// Local Widgets
import AdminBroadcastWidget from '../admin-dashboard/components/AdminBroadcastWidget';
import AdminCreateUserWidget from '../admin-dashboard/components/AdminCreateUserWidget';
import AdminPendingApprovalsWidget from '../admin-dashboard/components/AdminPendingApprovalsWidget';
import BusinessProfitSharingWidget from '../admin-dashboard/components/BusinessProfitSharingWidget';
import PricingControlWidget from '../admin-dashboard/components/PricingControlWidget';

type RevenueFilter = 'ALL' | 'ZERO' | 'ACTIVE' | 'INACTIVE_15D';
type MainTab = 'users' | 'pricing';
type ViewMode = 'table' | 'registration' | 'analytics';
type FYFilter = 'ALL' | number;

// ═══════════════════════════════════════════════════════════════════
// Contact Dropdown
// ═══════════════════════════════════════════════════════════════════
function ContactDropdown({
  mobile,
  userName,
  onAction,
  compact = false,
}: {
  mobile: string;
  userName?: string;
  onAction: (mobile: string, userName: string, action: 'call' | 'whatsapp') => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={`inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold transition-colors border-b border-dotted border-blue-400 hover:border-blue-700 ${
          compact ? 'text-[10px] mt-0.5' : 'text-[11px] mt-0.5'
        }`}
      >
        <Phone size={compact ? 10 : 11} />
        <span>{mobile}</span>
        <ChevronDown size={compact ? 9 : 10} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 min-w-[150px] overflow-hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction(mobile, userName || 'User', 'call');
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors border-b border-slate-100"
            >
              <Phone size={12} className="text-blue-600" />
              Call Now
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction(mobile, userName || 'User', 'whatsapp');
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
            >
              <MessageCircle size={12} className="text-emerald-600" />
              WhatsApp
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// User Profile Modal
// ═══════════════════════════════════════════════════════════════════
function UserProfileModal({
  user,
  onClose,
  onContactAction,
}: {
  user: any;
  onClose: () => void;
  onContactAction: (mobile: string, userName: string, action: 'call' | 'whatsapp') => void;
}) {
  if (!user) return null;

  const walletBalance = Number(user.wallet_balance ?? 0);
  const revenue = Number(user.computed_revenue ?? 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-200 flex justify-between items-start gap-4 bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <User size={24} className="text-blue-700" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-base truncate">{user.full_name || 'N/A'}</h3>
              <p className="text-xs text-slate-500 truncate">{user.email || 'No Email'}</p>
              {user.user_code && (
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{user.user_code}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-700 transition shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <span className="text-[9px] font-bold text-emerald-700 uppercase">Wallet</span>
              <p className="font-black text-emerald-800 text-sm mt-1">₹{walletBalance.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <span className="text-[9px] font-bold text-blue-700 uppercase">Revenue</span>
              <p className="font-black text-blue-800 text-sm mt-1">₹{revenue.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <span className="text-[9px] font-bold text-purple-700 uppercase">Status</span>
              <p className="font-black text-purple-800 text-sm mt-1 uppercase">{user.status || 'active'}</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Personal Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <ProfileField label="Full Name" value={user.full_name} />
              <ProfileField label="Email" value={user.email} />
              <ProfileField
                label="Mobile"
                value={user.mobile}
                action={
                  user.mobile && (
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => onContactAction(user.mobile, user.full_name, 'call')}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-[9px] font-bold rounded"
                      >
                        <Phone size={9} /> Call
                      </button>
                      <button
                        onClick={() => onContactAction(user.mobile, user.full_name, 'whatsapp')}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white text-[9px] font-bold rounded"
                      >
                        <MessageCircle size={9} /> WhatsApp
                      </button>
                    </div>
                  )
                }
              />
              <ProfileField label="User Type" value={user.user_type} />
              <ProfileField label="Firm Name" value={user.firm_name} />
              <ProfileField label="City" value={user.city} />
              <ProfileField label="State" value={user.state} />
              <ProfileField label="Plan" value={user.plan_type} />
              <ProfileField label="Role" value={user.role} />
              <ProfileField label="User Code" value={user.user_code} />
              <ProfileField
                label="Joined"
                value={
                  user.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A'
                }
              />
              <ProfileField
                label="Last Activity"
                value={
                  user.last_activity_at
                    ? new Date(user.last_activity_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'N/A'
                }
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value, action }: { label: string; value: any; action?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
      <span className="text-xs font-semibold text-slate-800 block mt-0.5 break-words">{value || 'N/A'}</span>
      {action}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// New Registration Chart (FY-wise with ALL option)
// ═══════════════════════════════════════════════════════════════════
function NewRegistrationChart({
  profiles,
  financialYear,
  onBarClick,
}: {
  profiles: any[];
  financialYear: FYFilter;
  onBarClick: (label: string, users: any[]) => void;
}) {
  const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

  // ✅ ALL FY mode: Show all years combined (grouped by FY)
  const allFYData = useMemo(() => {
    if (financialYear !== 'ALL') return null;

    const fyMap: Record<string, { fy: string; count: number; users: any[]; startYear: number }> = {};

    profiles.forEach((p: any) => {
      if (!p.created_at) return;
      const d = new Date(p.created_at);
      const year = d.getFullYear();
      const month = d.getMonth();
      const startYear = month >= 3 ? year : year - 1;
      const fyKey = `${startYear}-${String(startYear + 1).slice(-2)}`;

      if (!fyMap[fyKey]) {
        fyMap[fyKey] = { fy: fyKey, count: 0, users: [], startYear };
      }
      fyMap[fyKey].count++;
      fyMap[fyKey].users.push(p);
    });

    return Object.values(fyMap).sort((a, b) => a.startYear - b.startYear);
  }, [profiles, financialYear]);

  const monthlyData = useMemo(() => {
    if (financialYear === 'ALL') return [];
    const data: { month: string; count: number; fullLabel: string; users: any[] }[] = [];
    for (let i = 0; i < 12; i++) {
      const actualMonth = (3 + i) % 12;
      const actualYear = actualMonth >= 3 ? financialYear : financialYear + 1;

      const users = profiles.filter((p: any) => {
        if (!p.created_at) return false;
        const d = new Date(p.created_at);
        return d.getMonth() === actualMonth && d.getFullYear() === actualYear;
      });

      data.push({
        month: monthNames[i],
        count: users.length,
        fullLabel: `${monthNames[i]} ${actualYear}`,
        users,
      });
    }
    return data;
  }, [profiles, financialYear]);

  // ALL FY view
  if (financialYear === 'ALL' && allFYData) {
    const maxCount = Math.max(...allFYData.map((d) => d.count), 1);
    const totalUsers = allFYData.reduce((sum, d) => sum + d.count, 0);

    return (
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-600" />
              New Registrations — All Financial Years
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Year-over-year user signups · Click any bar to view users
            </p>
          </div>
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200">
            Total: {totalUsers} users
          </span>
        </div>

        <div className="flex items-end gap-3 h-40 border-b-2 border-l-2 border-slate-200 pl-2 pb-1">
          {allFYData.map((d, idx) => {
            const height = (d.count / maxCount) * 100;
            return (
              <div
                key={idx}
                onClick={() => onBarClick(`FY ${d.fy}`, d.users)}
                className="flex-1 flex flex-col items-center justify-end group relative h-full cursor-pointer"
              >
                <span className="text-[10px] font-bold text-slate-700 mb-0.5">{d.count}</span>
                <div
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all hover:from-blue-700 hover:to-blue-500"
                  style={{ height: `${Math.max(height, 3)}%`, minHeight: '4px' }}
                />
                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-900 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-10">
                  FY {d.fy}: {d.count} users
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-1 pl-2">
          {allFYData.map((d, idx) => (
            <div key={idx} className="flex-1 text-center">
              <span className="text-[10px] font-bold text-slate-600">FY {d.fy}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Single FY view
  const maxCount = Math.max(...monthlyData.map((d) => d.count), 1);
  const totalUsers = monthlyData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-600" />
            New Registrations — FY {financialYear}-{String((financialYear as number) + 1).slice(-2)}
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Month-wise user signups (April → March) · Click any bar to view users
          </p>
        </div>
        <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200">
          Total: {totalUsers} users
        </span>
      </div>

      <div className="flex items-end gap-1.5 h-40 border-b-2 border-l-2 border-slate-200 pl-2 pb-1">
        {monthlyData.map((d, idx) => {
          const height = (d.count / maxCount) * 100;
          return (
            <div
              key={idx}
              onClick={() => d.count > 0 && onBarClick(d.fullLabel, d.users)}
              className={`flex-1 flex flex-col items-center justify-end group relative h-full ${
                d.count > 0 ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              {d.count > 0 && <span className="text-[9px] font-bold text-slate-700 mb-0.5">{d.count}</span>}
              <div
                className={`w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all ${
                  d.count > 0 ? 'hover:from-blue-700 hover:to-blue-500' : ''
                }`}
                style={{
                  height: `${Math.max(height, d.count > 0 ? 3 : 0)}%`,
                  minHeight: d.count > 0 ? '4px' : '0',
                }}
              />
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-900 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-10">
                {d.fullLabel}: {d.count} users
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1.5 mt-1 pl-2">
        {monthlyData.map((d, idx) => (
          <div key={idx} className="flex-1 text-center">
            <span className="text-[9px] font-semibold text-slate-500">{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Engagement Analyser (with FY + Month filter)
// ═══════════════════════════════════════════════════════════════════
function ActiveInactiveAnalyser({
  profiles,
  onSliceClick,
}: {
  profiles: any[];
  onSliceClick: (type: 'active' | 'inactive', users: any[], label: string) => void;
}) {
  const [fyFilter, setFyFilter] = useState<FYFilter>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');

  // ✅ Build list of available FYs
  const availableFYs = useMemo(() => {
    const fySet = new Set<string>();
    profiles.forEach((p: any) => {
      if (!p.created_at) return;
      const d = new Date(p.created_at);
      const year = d.getFullYear();
      const month = d.getMonth();
      const startYear = month >= 3 ? year : year - 1;
      fySet.add(`${startYear}`);
    });
    return Array.from(fySet).sort((a, b) => Number(a) - Number(b));
  }, [profiles]);

  // ✅ Filter profiles based on FY + Month
  const filteredByDate = useMemo(() => {
    return profiles.filter((p: any) => {
      if (fyFilter === 'ALL' && monthFilter === 'ALL') return true;
      if (!p.created_at) return false;

      const d = new Date(p.created_at);
      const year = d.getFullYear();
      const month = d.getMonth();
      const startYear = month >= 3 ? year : year - 1;
      const actualMonth = month + 1;

      if (fyFilter !== 'ALL' && startYear !== fyFilter) return false;
      if (monthFilter !== 'ALL' && String(actualMonth) !== monthFilter) return false;

      return true;
    });
  }, [profiles, fyFilter, monthFilter]);

  const stats = useMemo(() => {
    const active = filteredByDate.filter((p: any) => !p.is_inactive_15d);
    const inactive = filteredByDate.filter((p: any) => p.is_inactive_15d);
    const total = filteredByDate.length;

    return {
      active: active.length,
      inactive: inactive.length,
      activeUsers: active,
      inactiveUsers: inactive,
      total,
      activePct: total > 0 ? Math.round((active.length / total) * 100) : 0,
      inactivePct: total > 0 ? Math.round((inactive.length / total) * 100) : 0,
    };
  }, [filteredByDate]);

  const filterLabel = `${fyFilter === 'ALL' ? 'All FYs' : `FY ${fyFilter}-${String((fyFilter as number) + 1).slice(-2)}`} · ${
    monthFilter === 'ALL' ? 'All Months' : monthNames[Number(monthFilter) - 1]
  }`;

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const activeStroke = (stats.activePct / 100) * circumference;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Filter size={11} /> Analyser Filter:
        </span>

        {/* FY Filter */}
        <div className="flex items-center gap-1.5">
          <Calendar size={11} className="text-slate-500" />
          <span className="text-[10px] font-semibold text-slate-500 uppercase">FY:</span>
          <select
            value={fyFilter === 'ALL' ? 'ALL' : String(fyFilter)}
            onChange={(e) => setFyFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All FYs</option>
            {availableFYs.map((fy) => (
              <option key={fy} value={fy}>
                FY {fy}-{String(Number(fy) + 1).slice(-2)}
              </option>
            ))}
          </select>
        </div>

        {/* Month Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Month:</span>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Months</option>
            {monthNames.map((m, i) => (
              <option key={i} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {(fyFilter !== 'ALL' || monthFilter !== 'ALL') && (
          <button
            onClick={() => {
              setFyFilter('ALL');
              setMonthFilter('ALL');
            }}
            className="ml-auto px-2.5 py-1 bg-white text-slate-600 border border-slate-200 rounded text-[10px] font-semibold hover:bg-slate-100 transition"
          >
            ✕ Clear
          </button>
        )}

        <div className="ml-auto text-[10px] font-bold text-slate-500">
          Showing: <span className="text-blue-700">{stats.total} users</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pie Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2 mb-4">
            <Activity size={16} className="text-emerald-600" />
            User Engagement Analyser
          </h3>

          <div className="flex items-center justify-center relative">
            <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="#fecdd3"
                strokeWidth="24"
                className="cursor-pointer hover:stroke-rose-300 transition-all"
                onClick={() => onSliceClick('inactive', stats.inactiveUsers, filterLabel)}
              />
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="#34d399"
                strokeWidth="24"
                strokeDasharray={`${activeStroke} ${circumference}`}
                strokeLinecap="butt"
                className="cursor-pointer hover:stroke-emerald-400 transition-all"
                onClick={() => onSliceClick('active', stats.activeUsers, filterLabel)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900">{stats.total}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                Total Users
              </span>
            </div>
          </div>

          <div className="flex justify-center gap-4 mt-4 flex-wrap">
            <button
              onClick={() => onSliceClick('active', stats.activeUsers, filterLabel)}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
            >
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-bold text-emerald-700">
                Active: {stats.active} ({stats.activePct}%)
              </span>
            </button>
            <button
              onClick={() => onSliceClick('inactive', stats.inactiveUsers, filterLabel)}
              className="flex items-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
            >
              <div className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="text-[11px] font-bold text-rose-700">
                Inactive: {stats.inactive} ({stats.inactivePct}%)
              </span>
            </button>
          </div>
        </div>

        {/* Stats Panel */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600" />
            Business Insight
          </h3>
          <p className="text-[10px] text-slate-500 -mt-2">For: {filterLabel}</p>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
              <span className="text-[11px] font-semibold text-slate-600">Total Registered</span>
              <span className="text-sm font-black text-slate-900">{stats.total}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
              <span className="text-[11px] font-semibold text-emerald-700">Active Users</span>
              <span className="text-sm font-black text-emerald-700">{stats.active}</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-[11px] font-semibold text-rose-700">Inactive (15+ days)</span>
              <span className="text-sm font-black text-rose-700">{stats.inactive}</span>
            </div>
          </div>

          <button
            onClick={() => onSliceClick('inactive', stats.inactiveUsers, filterLabel)}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <PhoneOff size={14} /> Follow up with {stats.inactive} Inactive Users
          </button>

          <p className="text-[10px] text-slate-500 text-center italic">
            Users inactive 15+ days — likely disengaged. Click to view list.
          </p>
        </div>
      </div>
    </div>
  );
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════
export default function AccessControlPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<MainTab>('users');
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilter>('ALL');
  const [showWidgets, setShowWidgets] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [financialYear, setFinancialYear] = useState<FYFilter>(() => {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  });

  const [profileModalUser, setProfileModalUser] = useState<any>(null);

  const [userListModal, setUserListModal] = useState<{
    title: string;
    subtitle: string;
    users: any[];
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [inputUserCode, setInputUserCode] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAccessControlData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUserProfile(profileData);
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      const [estRes, srvRes] = await Promise.all([
        supabase.from('estimates').select('user_id, user_payment, amount, total_amount, created_at'),
        supabase.from('service_records').select('user_id, gateway_fee, user_payment, user_service_fee, fee_standard, amount, created_at'),
      ]);

      const revenueMap: Record<string, number> = {};
      const lastActivityMap: Record<string, string> = {};

      const updateActivity = (uid: string, dateStr: string) => {
        if (!uid || !dateStr) return;
        if (!lastActivityMap[uid] || new Date(dateStr) > new Date(lastActivityMap[uid])) {
          lastActivityMap[uid] = dateStr;
        }
      };

      (estRes.data || []).forEach((e: any) => {
        if (!e.user_id) return;
        const amt = Number(e.user_payment ?? e.amount ?? e.total_amount ?? 0);
        if (amt > 0) revenueMap[e.user_id] = (revenueMap[e.user_id] || 0) + amt;
        if (e.created_at) updateActivity(e.user_id, e.created_at);
      });

      (srvRes.data || []).forEach((s: any) => {
        if (!s.user_id) return;
        const amt = Number(s.gateway_fee ?? s.user_payment ?? s.user_service_fee ?? s.fee_standard ?? s.amount ?? 0);
        if (amt > 0) revenueMap[s.user_id] = (revenueMap[s.user_id] || 0) + amt;
        if (s.created_at) updateActivity(s.user_id, s.created_at);
      });

      const now = Date.now();
      const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

      let sortedProfiles = (profilesData || []).map((p: any) => {
        const lastAct = lastActivityMap[p.id] || p.last_seen || p.created_at || null;
        const isInactive15d = lastAct ? now - new Date(lastAct).getTime() > FIFTEEN_DAYS_MS : true;

        return {
          ...p,
          computed_revenue: revenueMap[p.id] || 0,
          last_activity_at: lastAct,
          is_inactive_15d: isInactive15d,
        };
      });

      sortedProfiles.sort((a: any, b: any) => {
        const nameA = (a.full_name || '').toLowerCase();
        const nameB = (b.full_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setProfiles(sortedProfiles);
    } catch (err) {
      console.error('Error fetching access control data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessControlData();
  }, []);

  const isCurrentUserAdmin =
    currentUserProfile?.role === 'admin' ||
    (currentUserProfile?.email || '').toLowerCase() === 'legalntech@gmail.com';

  const handleOpenSuspendModal = (user: any) => {
    if (!isCurrentUserAdmin) {
      alert('Unauthorized: Only Admin accounts can modify user status.');
      return;
    }
    setTargetUser(user);
    setInputUserCode('');
    setInputPassword('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleVerifyAndSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setVerifying(true);

    try {
      if (inputUserCode.trim() !== currentUserProfile?.user_code) {
        setErrorMsg('Invalid Admin User Code. Action denied.');
        setVerifying(false);
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentUserProfile?.email,
        password: inputPassword,
      });

      if (authError) {
        setErrorMsg('Invalid Password. Verification failed.');
        setVerifying(false);
        return;
      }

      const newStatus = targetUser.status === 'suspended' ? 'active' : 'suspended';

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', targetUser.id);

      if (updateError) {
        setErrorMsg('Failed to update user status: ' + updateError.message);
      } else {
        setModalOpen(false);
        fetchAccessControlData();
      }
    } catch (err: any) {
      setErrorMsg('An error occurred during verification.');
    } finally {
      setVerifying(false);
    }
  };

  const handleContactAction = (
    mobile: string,
    userName: string,
    action: 'call' | 'whatsapp'
  ) => {
    if (!mobile) {
      alert('Mobile number not available.');
      return;
    }
    const cleanNumber = mobile.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) {
      alert('Invalid mobile number.');
      return;
    }

    const finalNumber = cleanNumber.slice(-10);

    if (action === 'call') {
      window.location.href = `tel:+91${finalNumber}`;
    } else if (action === 'whatsapp') {
      const employeeName = currentUserProfile?.full_name || 'L&T Team';
      const employeeMobile = currentUserProfile?.mobile || '';
      const employeeCode = currentUserProfile?.user_code || '';

      const messageText =
`Dear ${userName || 'User'},

Greetings from *L&T Consultant Services*! 🏢

We noticed that you haven't been active on our platform recently. We truly value your association with us and would love to understand how we can serve you better.

━━━━━━━━━━━━━━━━━━━━━
📋 *We'd love your feedback:*
━━━━━━━━━━━━━━━━━━━━━
1️⃣ Are you facing any technical issues?
2️⃣ Is our software meeting your expectations?
3️⃣ Any features you'd like us to improve or add?
4️⃣ Any specific reason for the inactivity?

Your valuable feedback will help us serve you better.

━━━━━━━━━━━━━━━━━━━━━
👤 *Your Relationship Manager:*
━━━━━━━━━━━━━━━━━━━━━
Name: *${employeeName}*
${employeeCode ? `Employee ID: ${employeeCode}` : ''}
${employeeMobile ? `Direct Line: ${employeeMobile}` : ''}

Feel free to reply to this message anytime. We're here to help!

Warm Regards,
*L&T Consultant Services*
_Digital Platform Team_

━━━━━━━━━━━━━━━━━━━━━
_This is an official communication from L&T Consultant Services._`;

      const message = encodeURIComponent(messageText);
      window.open(`https://wa.me/91${finalNumber}?text=${message}`, '_blank');
    }
  };

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p: any) => {
      const query = searchQuery.toLowerCase();
      const name = (p.full_name || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const mobile = (p.mobile || '').toLowerCase();
      const category = (p.user_type || '').toLowerCase();
      const firm = (p.firm_name || '').toLowerCase();
      const state = (p.state || '').toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        email.includes(query) ||
        mobile.includes(query) ||
        category.includes(query) ||
        firm.includes(query) ||
        state.includes(query);

      if (!matchesSearch) return false;

      const revenue = Number(p.computed_revenue || 0);

      if (revenueFilter === 'ZERO' && revenue > 0) return false;
      if (revenueFilter === 'ACTIVE' && revenue <= 0) return false;
      if (revenueFilter === 'INACTIVE_15D' && !p.is_inactive_15d) return false;

      return true;
    });
  }, [profiles, searchQuery, revenueFilter]);

  const zeroRevenueCount = profiles.filter((p: any) => Number(p.computed_revenue || 0) === 0).length;
  const activeRevenueCount = profiles.filter((p: any) => Number(p.computed_revenue || 0) > 0).length;
  const inactive15dCount = profiles.filter((p: any) => p.is_inactive_15d === true).length;

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center text-slate-400 text-xs tracking-widest font-mono">
        LOADING ACCESS &amp; CONTROL CENTER...
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 bg-slate-100 min-h-screen space-y-4 sm:space-y-6 font-sans antialiased text-slate-900 relative select-none overflow-x-hidden">

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Access Control &amp; User Management
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200 uppercase tracking-wide">
              RBAC Engine Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage user roles, lock statuses, revenue, and platform access privileges.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowWidgets(!showWidgets)}
            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors border border-slate-200 flex items-center gap-2"
          >
            {showWidgets ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showWidgets ? 'Hide Admin Widgets' : 'Show Admin Widgets'}
          </button>
          <SystemAlerts type="status" message="SECURITY SECURE" />
        </div>
      </div>

      {showWidgets && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <PushNotificationManager />
          <AdminBroadcastWidget />
          <AdminCreateUserWidget onUserCreated={fetchAccessControlData} />
          <AdminPendingApprovalsWidget onActionComplete={fetchAccessControlData} />
          <BusinessProfitSharingWidget />
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'users' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck size={14} /> User Management (RBAC)
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'pricing' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign size={14} /> Pricing Control
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                User Privilege &amp; Account Security
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                View lock statuses, state, and manage account suspensions.
              </p>
            </div>
            <div className="w-full sm:w-80">
              <input
                type="text"
                placeholder="Search name, email, mobile, firm, state..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* View Mode Switch */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2">
                View:
              </span>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors border ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                📋 Table
              </button>
              <button
                onClick={() => setViewMode('registration')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors border flex items-center gap-1 ${
                  viewMode === 'registration'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <BarChart3 size={11} /> New Registration
              </button>
              <button
                onClick={() => setViewMode('analytics')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors border flex items-center gap-1 ${
                  viewMode === 'analytics'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Activity size={11} /> Engagement Analyser
              </button>
            </div>

            {/* ✅ FY selector — only for Registration mode */}
            {viewMode === 'registration' && (
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-slate-500" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase">FY:</span>
                <select
                  value={financialYear === 'ALL' ? 'ALL' : String(financialYear)}
                  onChange={(e) => setFinancialYear(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All FYs</option>
                  <option value={2024}>2024-25</option>
                  <option value={2025}>2025-26</option>
                  <option value={2026}>2026-27</option>
                  <option value={2027}>2027-28</option>
                </select>
              </div>
            )}
          </div>

          {/* Registration Chart */}
          {viewMode === 'registration' && (
            <NewRegistrationChart
              profiles={profiles}
              financialYear={financialYear}
              onBarClick={(label, users) => {
                setUserListModal({
                  title: `New Registrations — ${label}`,
                  subtitle: `${users.length} users joined in this period`,
                  users,
                });
              }}
            />
          )}

          {/* Analytics Chart */}
          {viewMode === 'analytics' && (
            <ActiveInactiveAnalyser
              profiles={profiles}
              onSliceClick={(type, users, label) => {
                setUserListModal({
                  title: `${type === 'active' ? 'Active' : 'Inactive'} Users — ${label}`,
                  subtitle: `${users.length} users · ${type === 'active' ? 'Recently engaged' : 'Need follow-up'}`,
                  users,
                });
              }}
            />
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <>
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 flex items-center gap-1.5">
                  <Filter size={11} /> Filter:
                </span>
                <button
                  onClick={() => setRevenueFilter('ALL')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors border ${
                    revenueFilter === 'ALL'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All ({profiles.length})
                </button>
                <button
                  onClick={() => setRevenueFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors border flex items-center gap-1 ${
                    revenueFilter === 'ACTIVE'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  <TrendingUp size={11} /> Active Revenue ({activeRevenueCount})
                </button>
                <button
                  onClick={() => setRevenueFilter('ZERO')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors border flex items-center gap-1 ${
                    revenueFilter === 'ZERO'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  <PhoneOff size={11} /> Zero Revenue ({zeroRevenueCount})
                </button>
                <button
                  onClick={() => setRevenueFilter('INACTIVE_15D')}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors border flex items-center gap-1 ${
                    revenueFilter === 'INACTIVE_15D'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  <Clock size={11} /> Inactive 15+ Days ({inactive15dCount})
                </button>
                <div className="ml-auto px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-bold border border-blue-200">
                  ✓ {filteredProfiles.length} user{filteredProfiles.length !== 1 ? 's' : ''} found
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block">
                <div className="overflow-auto max-h-[600px] border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="p-3 border-b border-slate-200">User Details</th>
                        <th className="p-3 border-b border-slate-200">State</th>
                        <th className="p-3 border-b border-slate-200 text-center">Wallet</th>
                        <th className="p-3 border-b border-slate-200 text-center">Lock</th>
                        <th className="p-3 border-b border-slate-200 text-center">Role</th>
                        <th className="p-3 border-b border-slate-200 text-center">Status</th>
                        <th className="p-3 border-b border-slate-200 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProfiles.length > 0 ? (
                        filteredProfiles.map((p: any) => {
                          const userId = p.id;
                          const walletBalance = Number(p.wallet_balance ?? 0);
                          const userPlan = (p.plan_type || '').toUpperCase();
                          const role = (p.role || '').toLowerCase();

                          const isAdminUser = role === 'admin' || (p.email || '').toLowerCase() === 'legalntech@gmail.com';
                          const isPremium = userPlan.includes('PREMIUM') || role === 'premium';
                          const isMarketingSupport = ['marketing_support', 'marketing & support', 'marketing', 'support'].includes(role);
                          const isInvestor = role === 'investor';
                          const isSpecialRole = isMarketingSupport || isInvestor;
                          const isExempt = isAdminUser || isPremium || isSpecialRole;
                          const isLocked = !isExempt && walletBalance < 100;

                          return (
                            <tr
                              key={userId}
                              onClick={() => setProfileModalUser(p)}
                              className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                            >
                              <td className="p-3">
                                <div className="grid grid-cols-2 gap-3 items-start">
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-900 text-xs truncate">
                                      {p.full_name || 'N/A'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">
                                      {p.email || 'No Email'}
                                    </div>
                                    {p.plan_type && (
                                      <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-semibold bg-slate-100 text-slate-600 rounded border border-slate-200">
                                        {p.plan_type}
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-semibold border border-slate-200">
                                      {p.user_type || 'N/A'}
                                    </span>
                                    <div className="text-[10px] text-slate-600 font-medium truncate mt-0.5" title={p.firm_name || 'N/A'}>
                                      🏢 {p.firm_name || 'N/A'}
                                    </div>
                                    {p.mobile ? (
                                      <ContactDropdown mobile={p.mobile} userName={p.full_name} onAction={handleContactAction} />
                                    ) : (
                                      <div className="text-[10px] text-slate-400 mt-0.5">📞 N/A</div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="p-3">
                                <span className="text-[11px] text-slate-700 font-semibold whitespace-nowrap">
                                  📍 {p.state || 'N/A'}
                                </span>
                              </td>

                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded font-semibold text-[10px] border whitespace-nowrap ${
                                  walletBalance < 0
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : walletBalance === 0
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  ₹{walletBalance.toLocaleString('en-IN')}
                                </span>
                              </td>

                              <td className="p-3 text-center">
                                {isAdminUser ? (
                                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-bold uppercase whitespace-nowrap border border-purple-200">Admin</span>
                                ) : isMarketingSupport ? (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold uppercase whitespace-nowrap border border-indigo-200">Support</span>
                                ) : isInvestor ? (
                                  <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-[9px] font-bold uppercase whitespace-nowrap border border-teal-200">Investor</span>
                                ) : isPremium ? (
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold uppercase whitespace-nowrap border border-blue-200">Exempt</span>
                                ) : isLocked ? (
                                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold uppercase whitespace-nowrap border border-rose-200">🔒 Locked</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold uppercase whitespace-nowrap border border-emerald-200">🟢 Active</span>
                                )}
                              </td>

                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border ${
                                  role === 'admin'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : role === 'premium'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : isMarketingSupport
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : isInvestor
                                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {isMarketingSupport ? 'Marketing' : isInvestor ? 'Investor' : p.role || 'user'}
                                </span>
                              </td>

                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border ${
                                  p.status === 'suspended'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  {p.status || 'Active'}
                                </span>
                              </td>

                              <td className="p-3 text-right">
                                <button
                                  disabled={!isCurrentUserAdmin}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenSuspendModal(p);
                                  }}
                                  className={`px-2.5 py-1 text-[10px] font-semibold rounded transition-colors whitespace-nowrap border ${
                                    !isCurrentUserAdmin
                                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                      : p.status === 'suspended'
                                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {p.status === 'suspended' ? 'Activate' : 'Suspend'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 text-xs">
                            No profiles match your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {filteredProfiles.length > 0 ? (
                  filteredProfiles.map((p: any) => {
                    const userId = p.id;
                    const walletBalance = Number(p.wallet_balance ?? 0);

                    return (
                      <div
                        key={userId}
                        onClick={() => setProfileModalUser(p)}
                        className="bg-white border border-slate-200 p-3 rounded-lg space-y-2 shadow-sm cursor-pointer hover:border-blue-300 transition"
                      >
                        <div className="flex justify-between items-start gap-2 border-b border-slate-200 pb-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm text-slate-900 truncate">
                              {p.full_name || 'N/A'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">{p.email || 'No Email'}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 border ${
                            p.status === 'suspended'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {p.status || 'Active'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="block text-[9px] text-slate-500 font-semibold uppercase">Category</span>
                            <span className="font-semibold text-slate-700 text-[10px] mt-0.5 block truncate">{p.user_type || 'N/A'}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="block text-[9px] text-slate-500 font-semibold uppercase">Firm</span>
                            <span className="font-semibold text-slate-700 text-[10px] mt-0.5 block truncate">{p.firm_name || 'N/A'}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="block text-[9px] text-slate-500 font-semibold uppercase">State</span>
                            <span className="font-semibold text-slate-700 text-[10px] mt-0.5 block truncate">📍 {p.state || 'N/A'}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="block text-[9px] text-slate-500 font-semibold uppercase">Mobile</span>
                            {p.mobile ? (
                              <ContactDropdown mobile={p.mobile} userName={p.full_name} onAction={handleContactAction} compact />
                            ) : <span className="text-slate-400 text-[10px]">N/A</span>}
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="block text-[9px] text-slate-500 font-semibold uppercase">Wallet</span>
                            <span className={`font-bold text-[10px] mt-0.5 block ${
                              walletBalance < 0 ? 'text-rose-600' : walletBalance === 0 ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                              ₹{walletBalance.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="block text-[9px] text-slate-500 font-semibold uppercase">Role</span>
                            <span className="font-semibold text-slate-700 text-[10px] mt-0.5 block truncate">{p.role || 'user'}</span>
                          </div>
                        </div>

                        <button
                          disabled={!isCurrentUserAdmin}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSuspendModal(p);
                          }}
                          className={`w-full py-2 text-xs font-semibold rounded transition-colors border ${
                            !isCurrentUserAdmin
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : p.status === 'suspended'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {p.status === 'suspended' ? 'Activate' : 'Suspend'}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-slate-400 text-sm">No profiles match.</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
          <PricingControlWidget />
        </div>
      )}

      {/* User Profile Modal */}
      {profileModalUser && (
        <UserProfileModal
          user={profileModalUser}
          onClose={() => setProfileModalUser(null)}
          onContactAction={handleContactAction}
        />
      )}

      {/* User List Modal */}
      {userListModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-start gap-4 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{userListModal.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{userListModal.subtitle}</p>
              </div>
              <button
                onClick={() => setUserListModal(null)}
                className="h-8 w-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-700 transition shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {userListModal.users.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No users found.</div>
              ) : (
                <div className="space-y-2">
                  {userListModal.users.map((u: any, idx: number) => (
                    <div
                      key={u.id || idx}
                      className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-blue-50/50 transition"
                    >
                      <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <User size={16} className="text-blue-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-xs truncate">
                          {u.full_name || 'N/A'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{u.email || 'N/A'}</div>
                        <div className="text-[10px] text-slate-600 mt-0.5 flex flex-wrap gap-2">
                          {u.mobile && <span className="text-blue-700 font-semibold">📞 {u.mobile}</span>}
                          {u.state && <span>📍 {u.state}</span>}
                          {u.firm_name && <span>🏢 {u.firm_name}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {u.mobile && (
                          <>
                            <button
                              onClick={() => handleContactAction(u.mobile, u.full_name, 'call')}
                              className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded flex items-center gap-1"
                            >
                              <Phone size={10} /> Call
                            </button>
                            <button
                              onClick={() => handleContactAction(u.mobile, u.full_name, 'whatsapp')}
                              className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded flex items-center gap-1"
                            >
                              <MessageCircle size={10} /> WA
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setUserListModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {modalOpen && targetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Admin Security Verification</h3>
              <p className="text-xs text-slate-500 mt-1">
                To {targetUser.status === 'suspended' ? 'activate' : 'suspend'}{' '}
                <span className="font-semibold text-slate-800">{targetUser.full_name}</span>, enter your <strong>User Code</strong> and <strong>Password</strong>.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleVerifyAndSuspend} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UC-10294"
                  value={inputUserCode}
                  onChange={(e) => setInputUserCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {verifying ? 'Verifying...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}