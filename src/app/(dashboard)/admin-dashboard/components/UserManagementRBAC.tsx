'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';

interface UserManagementRBACProps {
  filteredProfiles: any[];
  userTableSearch: string;
  setUserTableSearch: (val: string) => void;
  modalSelectedDate: string;
  setModalSelectedDate: (val: string) => void;
  modalSelectedMonth: string;
  setModalSelectedMonth: (val: string) => void;
  modalFilterType: string;
  setModalFilterType: (val: 'all' | 'date' | 'month') => void;
  hiddenSections: { [key: string]: boolean };
  toggleSection: (key: string) => void;
  handleUpdateUserRbac: (userId: string, actionField: 'role' | 'status', newValue: string) => Promise<void>;
  handleOpenUserEstimates: (profile: any) => void;
  supabaseClient?: any;
}

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */
const EST_CHUNK = 50;
const SRV_CHUNK = 100;
const PAGE_SIZE = 1000;
const TOKEN_EXPIRY_BUFFER = 30;
const MIN_WALLET_BALANCE = 36;

/* ------------------------------------------------------------------ */
/* Utilities                                                          */
/* ------------------------------------------------------------------ */
const toNum = (v: any) => {
  const n = Number(v ?? 0);
  return isNaN(n) ? 0 : n;
};

const estimateAmount = (r: any) =>
  toNum(r?.user_payment ?? r?.fee_standard ?? r?.amount ?? r?.fee);

const serviceAmount = (r: any) => toNum(r?.gateway_fee);

const keyOf = (item: any) => item.id || item.ref_no || JSON.stringify(item);

const dedupe = (items: any[]) => {
  const m = new Map();
  items.forEach((i) => {
    if (i) m.set(keyOf(i), i);
  });
  return Array.from(m.values());
};

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const groupByUser = (rows: any[], ids: string[]) => {
  const map: { [key: string]: any[] } = {};
  ids.forEach((id) => (map[id] = []));
  rows.forEach((r) => {
    const uid = String(r?.user_id);
    if (map[uid]) map[uid].push(r);
  });
  return map;
};

const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ------------------------------------------------------------------ */
/* JWT helpers                                                        */
/* ------------------------------------------------------------------ */
const JWT_RE = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded));

    if (!decoded?.exp) return false;

    const now = Math.floor(Date.now() / 1000);
    return decoded.exp - now < TOKEN_EXPIRY_BUFFER;
  } catch {
    return true;
  }
}

function decodeMaybeBase64(raw: string): string {
  try {
    if (raw.startsWith('base64-')) {
      const b64 = raw.slice(7).replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64);
      return decodeURIComponent(
        Array.from(bin).map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
      );
    }
  } catch {}
  return raw;
}

function extractToken(raw: string | null): string | null {
  if (!raw || raw.length > 60000) return null;
  const text = decodeMaybeBase64(raw.trim());
  if (JWT_RE.test(text)) return text;
  try {
    const obj = JSON.parse(text);
    const cands = [
      obj?.access_token,
      obj?.currentSession?.access_token,
      obj?.session?.access_token,
      obj?.data?.session?.access_token,
      Array.isArray(obj) ? obj[0] : null,
    ];
    for (const c of cands) {
      if (typeof c === 'string' && JWT_RE.test(c)) return c;
    }
  } catch {}
  return null;
}

function readCookieMap(): { [name: string]: string } {
  const map: { [name: string]: string } = {};
  if (typeof document === 'undefined') return map;
  document.cookie.split('; ').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i < 0) return;
    const name = pair.slice(0, i);
    try {
      map[name] = decodeURIComponent(pair.slice(i + 1));
    } catch {
      map[name] = pair.slice(i + 1);
    }
  });
  return map;
}

/* ------------------------------------------------------------------ */
/* Token acquisition                                                  */
/* ------------------------------------------------------------------ */
async function getAccessToken(client: any): Promise<string | null> {
  if (client?.auth?.getSession) {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        console.warn('[RBAC] getSession error:', error.message);
      } else if (data?.session?.access_token) {
        const token = data.session.access_token;
        if (!isTokenExpired(token)) return token;

        if (client.auth.refreshSession) {
          const { data: refreshed, error: rErr } = await client.auth.refreshSession();
          if (!rErr && refreshed?.session?.access_token) {
            return refreshed.session.access_token;
          }
        }
      }
    } catch (e) {
      console.warn('[RBAC] getSession threw:', e);
    }
  }

  if (typeof window === 'undefined') return null;

  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (!k) continue;
        const t = extractToken(store.getItem(k));
        if (t && !isTokenExpired(t)) return t;
      }
    } catch {}
  }

  try {
    const cookies = readCookieMap();
    const groups: { [base: string]: { idx: number; val: string }[] } = {};
    Object.keys(cookies).forEach((name) => {
      const m = name.match(/^(.*auth-token)(?:\.(\d+))?$/);
      if (m) (groups[m[1]] ||= []).push({ idx: Number(m[2] || 0), val: cookies[name] });
    });
    for (const base of Object.keys(groups)) {
      const joined = groups[base].sort((a, b) => a.idx - b.idx).map((x) => x.val).join('');
      const t = extractToken(joined);
      if (t && !isTokenExpired(t)) return t;
    }
  } catch {}

  return null;
}

/* ------------------------------------------------------------------ */
/* Fetchers                                                           */
/* ------------------------------------------------------------------ */
async function fetchEstimatesChunk(client: any, ids: string[]) {
  const rows: any[] = [];
  let from = 0;
  try {
    while (true) {
      const { data, error } = await client
        .from('estimates')
        .select('*')
        .in('user_id', ids)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.warn('[RBAC] estimates fetch error:', error.message);
        return { rows, ok: false };
      }
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return { rows, ok: true };
  } catch (e) {
    console.warn('[RBAC] estimates fetch threw:', e);
    return { rows, ok: false };
  }
}

async function fetchServicesChunk(client: any, ids: string[]) {
  try {
    let token = await getAccessToken(client);
    if (!token) return { rows: [], ok: false };

    const callApi = async (tk: string) =>
      fetch('/api/admin/service-records', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tk}`,
        },
        body: JSON.stringify({ userIds: ids }),
      });

    let res = await callApi(token);

    if (res.status === 401 && client?.auth?.refreshSession) {
      try {
        const { data: refreshed } = await client.auth.refreshSession();
        if (refreshed?.session?.access_token) {
          token = refreshed.session.access_token;
          res = await callApi(token);
        }
      } catch {}
    }

    if (res.status === 401 || res.status === 403) {
      return { rows: [], ok: false };
    }

    if (!res.ok) {
      console.warn('[RBAC] service-records API failed:', res.status);
      return { rows: [], ok: false };
    }

    const json = await res.json();
    return { rows: (json.data || []) as any[], ok: true };
  } catch (e) {
    console.warn('[RBAC] service-records fetch threw:', e);
    return { rows: [], ok: false };
  }
}

/* ================================================================== */
/* Component                                                          */
/* ================================================================== */
export default function UserManagementRBAC({
  filteredProfiles,
  userTableSearch,
  setUserTableSearch,
  modalSelectedDate,
  setModalSelectedDate,
  modalSelectedMonth,
  setModalSelectedMonth,
  modalFilterType,
  setModalFilterType,
  hiddenSections,
  toggleSection,
  handleUpdateUserRbac,
  handleOpenUserEstimates,
  supabaseClient,
}: UserManagementRBACProps) {
  const [rawData, setRawData] = useState<{
    estimates: { [key: string]: any[] };
    services: { [key: string]: any[] };
  }>({ estimates: {}, services: {} });
  const [loading, setLoading] = useState(false);

  const [lockFilter, setLockFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED'>('ALL');

  // ✅ Column-wise inline header filters
  const [colFilters, setColFilters] = useState({
    user: '',
    category: '',
    wallet: '',
    lock: '',
    estsrv: '',
    revenue: '',
  });

  const loadedRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef(0);

  const idsKey = useMemo(
    () => (filteredProfiles || []).map((p) => p?.id).filter(Boolean).join(','),
    [filteredProfiles]
  );

  useEffect(() => {
    const client =
      supabaseClient ||
      (typeof window !== 'undefined' ? (window as any).supabase : null);
    if (!idsKey) return;

    const allIds = idsKey.split(',');
    const missing = allIds.filter((id) => !loadedRef.current.has(id));
    if (missing.length === 0) return;

    missing.forEach((id) => loadedRef.current.add(id));
    pendingRef.current += 1;
    setLoading(true);

    (async () => {
      const failed = new Set<string>();

      const estJobs = chunkArray(missing, EST_CHUNK).map(async (ids) => {
        if (!client) return [] as any[];
        const r = await fetchEstimatesChunk(client, ids);
        if (!r.ok) ids.forEach((i) => failed.add(i));
        return r.rows;
      });

      const srvJobs = chunkArray(missing, SRV_CHUNK).map(async (ids) => {
        const r = await fetchServicesChunk(client, ids);
        if (!r.ok) ids.forEach((i) => failed.add(i));
        return r.rows;
      });

      const [estResults, srvResults] = await Promise.all([
        Promise.all(estJobs),
        Promise.all(srvJobs),
      ]);

      const estRows = estResults.flat();
      const srvRows = srvResults.flat();

      const estMap = groupByUser(estRows, missing);
      const srvMap = groupByUser(srvRows, missing);

      setRawData((prev) => ({
        estimates: { ...prev.estimates, ...estMap },
        services: { ...prev.services, ...srvMap },
      }));

      failed.forEach((id) => loadedRef.current.delete(id));

      pendingRef.current -= 1;
      if (pendingRef.current <= 0) setLoading(false);
    })();
  }, [idsKey, supabaseClient]);

  const { processedProfiles, totals, counters } = useMemo(() => {
    const filterFn = (rec: any) => {
      const dateField = rec?.created_at || rec?.date;
      if (!dateField) return false;
      const d = new Date(dateField);
      if (isNaN(d.getTime())) return false;

      if (modalFilterType === 'date' && modalSelectedDate) {
        return localDateStr(d) === modalSelectedDate;
      }
      if (modalFilterType === 'month' && modalSelectedMonth) {
        return localDateStr(d).slice(0, 7) === modalSelectedMonth;
      }
      return true;
    };

    const hasDateFilter = !!(modalSelectedDate || modalSelectedMonth);

    const baseList = (filteredProfiles || [])
      .map((p: any) => {
        const id = String(p.id);

        let estimates = dedupe([
          ...(Array.isArray(p.estimates_list) ? p.estimates_list : []),
          ...(Array.isArray(p.estimates) ? p.estimates : []),
          ...(rawData.estimates[id] || []),
        ]);

        let services = dedupe([
          ...(Array.isArray(p.service_records) ? p.service_records : []),
          ...(Array.isArray(p.records) ? p.records : []),
          ...(Array.isArray(p.drafts) ? p.drafts : []),
          ...(rawData.services[id] || []),
        ]);

        if (hasDateFilter) {
          estimates = estimates.filter(filterFn);
          services = services.filter(filterFn);
        }

        const estCount = estimates.length;
        const srvCount = services.length;

        const estimatesRevenue = estimates.reduce(
          (s: number, r: any) => s + estimateAmount(r),
          0
        );
        const servicesRevenue = services.reduce(
          (s: number, r: any) => s + serviceAmount(r),
          0
        );

        const userWalletBalance = Number(p.wallet_balance ?? 0);
        const userPlan = (p.plan_type || '').toUpperCase();
        const isAdminUser =
          p.role === 'admin' ||
          (p.email || '').toLowerCase() === 'legalntech@gmail.com';
        const isPremium = userPlan.includes('PREMIUM');
        const isUserLocked =
          !isAdminUser && !isPremium && userWalletBalance < MIN_WALLET_BALANCE;

        return {
          ...p,
          calculatedEstCount: estCount,
          calculatedSrvCount: srvCount,
          calculatedTotalCount: estCount + srvCount,
          calculatedRevenue: estimatesRevenue + servicesRevenue,
          filteredEstimates: estimates,
          filteredServices: services,
          combinedRecords: [...estimates, ...services],
          _isAdminUser: isAdminUser,
          _isPremium: isPremium,
          _isUserLocked: isUserLocked,
        };
      })
      .filter((p: any) => (hasDateFilter ? p.calculatedTotalCount > 0 : true));

    const lockedCount = baseList.filter((p: any) => p._isUserLocked).length;
    const activeCount = baseList.filter(
      (p: any) => !p._isUserLocked && !p._isAdminUser && !p._isPremium
    ).length;
    const adminCount = baseList.filter((p: any) => p._isAdminUser).length;
    const premiumCount = baseList.filter(
      (p: any) => !p._isAdminUser && p._isPremium
    ).length;

    // Apply lock filter + column filters
    const list = baseList.filter((p: any) => {
      if (lockFilter === 'LOCKED' && !p._isUserLocked) return false;
      if (lockFilter === 'ACTIVE' && (p._isUserLocked || p._isAdminUser || p._isPremium))
        return false;

      const f = colFilters;

      if (f.user) {
        const q = f.user.toLowerCase();
        const name = (p.full_name || p.name || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        const mobile = (p.mobile || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !mobile.includes(q)) return false;
      }

      if (f.category) {
        const q = f.category.toLowerCase();
        const cat = (
          p.category ||
          p.user_category ||
          p.user_type ||
          p.account_type ||
          ''
        ).toLowerCase();
        const firm = (p.firm_name || p.company_name || p.business_name || '').toLowerCase();
        if (!cat.includes(q) && !firm.includes(q)) return false;
      }

      if (f.wallet) {
        const q = f.wallet.replace(/[^0-9.-]/g, '');
        const bal = String(Number(p.wallet_balance ?? 0));
        if (!bal.includes(q)) return false;
      }

      if (f.lock) {
        const q = f.lock.toLowerCase();
        const lockLabel = p._isAdminUser
          ? 'admin'
          : p._isPremium
          ? 'exempt'
          : p._isUserLocked
          ? 'locked'
          : 'active';
        if (!lockLabel.includes(q)) return false;
      }

      if (f.estsrv) {
        const q = f.estsrv.replace(/\s+/g, '');
        const combo = `${p.calculatedEstCount}+${p.calculatedSrvCount}`;
        if (!combo.includes(q)) return false;
      }

      if (f.revenue) {
        const q = f.revenue.replace(/[^0-9.-]/g, '');
        const rev = String(Number(p.calculatedRevenue ?? 0));
        if (!rev.includes(q)) return false;
      }

      return true;
    });

    const t = {
      active: 0,
      suspended: 0,
      wallet: 0,
      est: 0,
      srv: 0,
      revenue: 0,
    };
    list.forEach((p: any) => {
      const status = (p.status || 'active').toLowerCase();
      if (status === 'active') t.active += 1;
      if (status === 'suspended') t.suspended += 1;
      t.wallet += Number(p.wallet_balance ?? 0);
      t.est += p.calculatedEstCount;
      t.srv += p.calculatedSrvCount;
      t.revenue += p.calculatedRevenue;
    });

    return {
      processedProfiles: list,
      totals: t,
      counters: {
        locked: lockedCount,
        active: activeCount,
        admin: adminCount,
        premium: premiumCount,
        total: baseList.length,
      },
    };
  }, [
    filteredProfiles,
    rawData,
    modalSelectedDate,
    modalSelectedMonth,
    modalFilterType,
    lockFilter,
    colFilters,
  ]);

  const hasAnyColFilter = Object.values(colFilters).some((v) => v.trim() !== '');

  const clearAllFilters = () => {
    setModalSelectedDate('');
    setModalSelectedMonth('');
    setUserTableSearch('');
    setModalFilterType('all');
    setLockFilter('ALL');
    setColFilters({
      user: '',
      category: '',
      wallet: '',
      lock: '',
      estsrv: '',
      revenue: '',
    });
  };

  const showResetBtn =
    modalSelectedDate ||
    modalSelectedMonth ||
    userTableSearch ||
    lockFilter !== 'ALL' ||
    hasAnyColFilter;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* COMPACT HEADER — Title + Filters in one line                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base whitespace-nowrap">
              RBAC User Management
            </h3>

            {/* Counters chips — compact inline */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                Total <span className="text-slate-900">{counters.total}</span>
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                🟢 <span>{counters.active}</span>
              </span>
              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded border border-rose-200">
                🔒 <span>{counters.locked}</span>
              </span>
              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                👑 <span>{counters.admin}</span>
              </span>
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                ⭐ <span>{counters.premium}</span>
              </span>
              {loading && (
                <span className="text-blue-600 font-semibold animate-pulse text-[10px]">
                  Loading…
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          {/* Date */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">From</span>
            <input
              type="date"
              value={modalSelectedDate && modalFilterType === 'date' ? modalSelectedDate : ''}
              onChange={(e) => {
                setModalSelectedDate(e.target.value);
                setModalFilterType('date');
              }}
              className="text-[11px] bg-transparent focus:outline-none font-semibold text-slate-800"
            />
          </div>

          {/* Month */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">Month</span>
            <input
              type="month"
              value={modalSelectedMonth}
              onChange={(e) => {
                setModalSelectedMonth(e.target.value);
                setModalFilterType('month');
              }}
              className="text-[11px] bg-transparent focus:outline-none font-semibold text-slate-800"
            />
          </div>

          {/* Lock dropdown */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">Lock</span>
            <select
              value={lockFilter}
              onChange={(e) => setLockFilter(e.target.value as any)}
              className={`text-[11px] bg-transparent focus:outline-none font-bold cursor-pointer ${
                lockFilter === 'LOCKED'
                  ? 'text-rose-600'
                  : lockFilter === 'ACTIVE'
                  ? 'text-emerald-600'
                  : 'text-slate-800'
              }`}
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">🟢 Active</option>
              <option value="LOCKED">🔒 Locked</option>
            </select>
          </div>

          {showResetBtn && (
            <button
              onClick={clearAllFilters}
              className="px-2 py-1 bg-rose-50 text-rose-600 rounded-md text-[10px] font-bold hover:bg-rose-100 transition"
            >
              Reset
            </button>
          )}

          <button
            onClick={() => toggleSection('rbac')}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold transition whitespace-nowrap"
          >
            {hiddenSections.rbac ? 'Show [+]' : 'Hide [−]'}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TABLE — Header me hi filter inputs                          */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {!hiddenSections.rbac && (
        <div
          className="overflow-y-auto overflow-x-auto mx-4 mb-4 rounded-xl border border-slate-100"
          style={{
            maxHeight: 'calc(100vh - 250px)',
            minHeight: '400px',
          }}
        >
          <table className="w-full text-left text-sm table-fixed">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-bold sticky top-0 z-10">
              <tr>
                {/* User — header me inline filter */}
                <th className="py-1.5 px-2 w-[22%] bg-slate-50">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px]">User</span>
                    <input
                      type="text"
                      placeholder="Filter…"
                      value={colFilters.user}
                      onChange={(e) =>
                        setColFilters({ ...colFilters, user: e.target.value })
                      }
                      className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 placeholder:text-[9px]"
                    />
                  </div>
                </th>

                <th className="py-1.5 px-2 w-[18%] bg-slate-50">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px]">Category & Firm</span>
                    <input
                      type="text"
                      placeholder="Filter…"
                      value={colFilters.category}
                      onChange={(e) =>
                        setColFilters({ ...colFilters, category: e.target.value })
                      }
                      className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 placeholder:text-[9px]"
                    />
                  </div>
                </th>

                <th className="py-1.5 px-2 text-center w-[8%] bg-slate-50">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px]">Wallet</span>
                    <input
                      type="text"
                      placeholder="₹"
                      value={colFilters.wallet}
                      onChange={(e) =>
                        setColFilters({ ...colFilters, wallet: e.target.value })
                      }
                      className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 text-center"
                    />
                  </div>
                </th>

                <th className="py-1.5 px-2 text-center w-[8%] bg-slate-50">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px]">Lock</span>
                    <input
                      type="text"
                      placeholder="act/lock"
                      value={colFilters.lock}
                      onChange={(e) =>
                        setColFilters({ ...colFilters, lock: e.target.value })
                      }
                      className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 placeholder:text-[9px] text-center"
                    />
                  </div>
                </th>

                <th className="py-1.5 px-2 text-center w-[10%] bg-slate-50">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px]">Est / Srv</span>
                    <input
                      type="text"
                      placeholder="5+2"
                      value={colFilters.estsrv}
                      onChange={(e) =>
                        setColFilters({ ...colFilters, estsrv: e.target.value })
                      }
                      className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 placeholder:text-[9px] text-center"
                    />
                  </div>
                </th>

                <th className="py-1.5 px-2 w-[8%] bg-slate-50">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px]">Revenue</span>
                    <input
                      type="text"
                      placeholder="₹"
                      value={colFilters.revenue}
                      onChange={(e) =>
                        setColFilters({ ...colFilters, revenue: e.target.value })
                      }
                      className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 text-center"
                    />
                  </div>
                </th>

                <th className="py-1.5 px-2 w-[8%] bg-slate-50 text-center">
                  <span className="text-[9px]">Role</span>
                </th>
                <th className="py-1.5 px-2 w-[9%] bg-slate-50 text-center">
                  <span className="text-[9px]">Status</span>
                </th>
                <th className="py-1.5 px-2 text-right w-[9%] bg-slate-50">
                  <span className="text-[9px]">Action</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {processedProfiles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400 text-sm">
                    No profiles found matching your search or filter criteria.
                  </td>
                </tr>
              ) : (
                processedProfiles.map((p: any) => {
                  const userId = p.id;
                  const userWalletBalance = Number(p.wallet_balance ?? 0);
                  const isAdminUser = p._isAdminUser;
                  const isPremium = p._isPremium;
                  const isUserLocked = p._isUserLocked;

                  const userCategory =
                    p.category ||
                    p.user_category ||
                    p.user_type ||
                    p.account_type ||
                    'Individual';
                  const userFirmName =
                    p.firm_name || p.company_name || p.business_name || 'N/A';
                  const isSuspended =
                    (p.status || '').toLowerCase() === 'suspended';

                  return (
                    <tr key={userId} className="hover:bg-slate-50/60 transition">
                      <td className="py-1 px-2 truncate">
                        <div
                          className="font-bold text-slate-900 text-[12px] truncate leading-tight"
                          title={p.full_name || p.name || 'N/A'}
                        >
                          {p.full_name || p.name || 'N/A'}
                        </div>
                        <div
                          className="text-[10px] text-slate-500 truncate leading-tight"
                          title={p.email || 'No Email'}
                        >
                          {p.email || 'No Email'}
                        </div>
                        <div
                          className="text-[10px] text-slate-600 font-medium truncate leading-tight"
                          title={p.mobile || 'N/A'}
                        >
                          📞 {p.mobile || 'N/A'}
                        </div>
                      </td>

                      <td className="py-1 px-2 truncate">
                        <span
                          className="px-1.5 py-0 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold truncate inline-block max-w-full leading-tight"
                          title={userCategory}
                        >
                          {userCategory}
                        </span>
                        <div
                          className="font-semibold text-slate-800 text-[10px] truncate leading-tight"
                          title={userFirmName}
                        >
                          🏢 {userFirmName}
                        </div>
                      </td>

                      <td className="py-1 px-2 text-center">
                        <span
                          className={`px-1.5 py-0 rounded text-[9px] font-bold border inline-block whitespace-nowrap leading-tight ${
                            userWalletBalance < 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : userWalletBalance === 0
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {userWalletBalance < 0
                            ? `-₹${Math.abs(userWalletBalance)}`
                            : `₹${userWalletBalance}`}
                        </span>
                      </td>

                      <td className="py-1 px-2 text-center">
                        {isAdminUser ? (
                          <span className="px-1.5 py-0 bg-purple-50 text-purple-700 rounded text-[8px] font-extrabold uppercase leading-tight">
                            Admin
                          </span>
                        ) : isPremium ? (
                          <span className="px-1.5 py-0 bg-blue-50 text-blue-700 rounded text-[8px] font-extrabold uppercase leading-tight">
                            Exempt
                          </span>
                        ) : isUserLocked ? (
                          <span className="px-1.5 py-0 bg-rose-100 text-rose-700 rounded text-[8px] font-extrabold uppercase animate-pulse leading-tight">
                            🔒 Locked
                          </span>
                        ) : (
                          <span className="px-1.5 py-0 bg-emerald-100 text-emerald-700 rounded text-[8px] font-extrabold uppercase leading-tight">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="py-1 px-2 text-center">
                        <button
                          onClick={() => {
                            const serviceRows = (p.filteredServices || []).map(
                              (srv: any) => ({
                                ...srv,
                                entry_type: 'SERVICE',
                                source_table: 'service_records',
                                user_payment: srv?.gateway_fee ?? 0,
                              })
                            );
                            const estimateRows = (p.filteredEstimates || []).map(
                              (est: any) => ({
                                ...est,
                                entry_type: est?.entry_type || 'ESTIMATE',
                                source_table: 'estimates',
                              })
                            );
                            const allRows = [...estimateRows, ...serviceRows].sort(
                              (a: any, b: any) =>
                                new Date(b?.created_at || b?.date || 0).getTime() -
                                new Date(a?.created_at || a?.date || 0).getTime()
                            );
                            const payload = {
                              ...p,
                              estimates_list: allRows,
                              service_records: serviceRows,
                              combined_records: allRows,
                            };
                            handleOpenUserEstimates(payload);
                          }}
                          className="px-1.5 py-0 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[9px] font-bold transition border border-blue-200 whitespace-nowrap inline-flex items-center gap-0.5 leading-tight"
                          title="Estimates + Service Records"
                        >
                          📊 <span className="text-blue-900 font-black">{p.calculatedEstCount}</span>{' '}
                          +{' '}
                          <span className="text-indigo-900 font-black">
                            {p.calculatedSrvCount}
                          </span>
                        </button>
                      </td>

                      <td className="py-1 px-2 font-semibold text-emerald-600 text-[10px] whitespace-nowrap leading-tight">
                        ₹{Number(p.calculatedRevenue).toLocaleString('en-IN')}
                      </td>

                      <td className="py-1 px-2">
                        <select
                          value={p.role || 'user'}
                          onChange={(e) =>
                            handleUpdateUserRbac(userId, 'role', e.target.value)
                          }
                          className={`px-1 py-0 rounded text-[9px] font-bold cursor-pointer border focus:outline-none w-full leading-tight ${
                            p.role === 'admin'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : p.role === 'premium'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="user">user</option>
                          <option value="premium">premium</option>
                        </select>
                      </td>

                      <td className="py-1 px-2">
                        <select
                          value={p.status || 'Active'}
                          onChange={(e) =>
                            handleUpdateUserRbac(userId, 'status', e.target.value)
                          }
                          className={`px-1 py-0 rounded text-[9px] font-bold cursor-pointer border focus:outline-none w-full leading-tight ${
                            isSuspended
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <option value="Active">Active</option>
                          <option value="suspended">suspended</option>
                        </select>
                      </td>

                      <td className="py-1 px-2 text-right">
                        <button
                          onClick={() =>
                            handleUpdateUserRbac(
                              userId,
                              'status',
                              isSuspended ? 'Active' : 'suspended'
                            )
                          }
                          className={`px-1.5 py-0 text-[9px] font-semibold rounded transition whitespace-nowrap leading-tight ${
                            isSuspended
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                          }`}
                        >
                          {isSuspended ? 'Activate' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900 text-xs sticky bottom-0 z-10">
              <tr>
                <td colSpan={2} className="py-1.5 px-2 bg-slate-50">
                  <div className="flex flex-col gap-0">
                    <span className="text-blue-700 font-black text-[11px] leading-tight">
                      TOTAL (Filtered):
                    </span>
                    <span className="text-slate-500 text-[10px] leading-tight">
                      Active:{' '}
                      <strong className="text-emerald-600">{totals.active}</strong> |
                      Suspended:{' '}
                      <strong className="text-rose-600">{totals.suspended}</strong>
                    </span>
                  </div>
                </td>
                <td
                  className={`py-1.5 px-2 text-center align-middle border text-[11px] bg-slate-50 leading-tight ${
                    totals.wallet < 0
                      ? 'text-rose-700'
                      : totals.wallet === 0
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {totals.wallet < 0
                    ? `-₹${Math.abs(totals.wallet)}`
                    : `₹${totals.wallet}`}
                </td>
                <td className="py-1.5 px-2 bg-slate-50"></td>
                <td className="py-1.5 px-2 text-center text-blue-700 text-[11px] whitespace-nowrap font-bold bg-slate-50 leading-tight">
                  {totals.est} Est + {totals.srv} Srv
                </td>
                <td
                  colSpan={4}
                  className="py-1.5 px-2 text-emerald-700 text-[11px] whitespace-nowrap bg-slate-50 leading-tight"
                >
                  ₹{totals.revenue.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}