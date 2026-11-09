'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity, BarChart3, Crown, FileText, IndianRupee, Inbox, LayoutDashboard, PieChart, RefreshCw,
  ScrollText, Tag, Undo2, Users, Wallet, Wrench, Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import RazorpayRevenueChart from '@/app/components/RazorpayRevenueChart';
import PushNotificationManager from '@/components/PushNotificationManager';

import {
  EXCLUDED_ADMIN_USER_ID, FINANCE_RULES_VERSION, buildRevenueTxns, fetchAll, fetchRevenueSources, inr, inr0, istMonthKey,
  currentISTMonth, rechargeBucket, round2, toNum, istDateKey, type RevenueTxn,
} from './lib/finance';
import { ERROR_TABLE, installErrorMonitor, reportSupabaseError } from './lib/errorMonitor';

import AdminBroadcastWidget from './components/AdminBroadcastWidget';
import AdminCreateUserWidget from './components/AdminCreateUserWidget';
import AdminPendingApprovalsWidget from './components/AdminPendingApprovalsWidget';
import AdminRefundRequestsWidget from './components/AdminRefundRequestsWidget';
import PremiumBillingWidget from './components/PremiumBillingWidget';
import BusinessProfitSharingWidget from './components/BusinessProfitSharingWidget';
import AdminRazorpayLiveWidget from './components/AdminRazorpayLiveWidget';
import UserManagementRBAC from './components/UserManagementRBAC';
import PricingControlWidget from './components/PricingControlWidget';
import ErrorBoundary from './components/ErrorBoundary';
import GstManager, { type IncomeForm } from './components/GstManager';
import OverviewPanel from './components/OverviewPanel';
import ReportsPanel, { type MisPeriod } from './components/ReportsPanel';
import RevenueInspector, { type GstRequest } from './components/RevenueInspector';
import ProfitOverview from './components/ProfitOverview';
import SystemHealthPanel, { type DataSourceStatus, type HealthStats } from './components/SystemHealthPanel';
import UserEstimatesModal from './components/UserEstimatesModal';
import WalletOverviewPanel, { RechargeRequestsTable } from './components/WalletOverviewPanel';
import { Badge, Btn, Card, EmptyState, Skeleton, Stat, tdCls, thCls, useToast } from './components/ui';

/* ============================================================
   Navigation
   ============================================================ */

type TabKey =
  | 'overview' | 'revenue' | 'wallet' | 'recharges' | 'refunds' | 'profit' | 'gst' | 'razorpay'
  | 'users' | 'premium' | 'tools' | 'health' | 'audit' | 'reports' | 'pricing';

const NAV: { group: string; items: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  { group: 'Dashboard', items: [{ key: 'overview', label: 'Overview', icon: LayoutDashboard }] },
  {
    group: 'Finance',
    items: [
      { key: 'revenue', label: 'Revenue', icon: IndianRupee },
      { key: 'wallet', label: 'Wallets', icon: Wallet },
      { key: 'recharges', label: 'Recharge requests', icon: Inbox },
      { key: 'refunds', label: 'Refund requests', icon: Undo2 },
      { key: 'profit', label: 'Profit sharing', icon: PieChart },
      { key: 'gst', label: 'GST & invoices', icon: FileText },
      { key: 'razorpay', label: 'Razorpay', icon: Zap },
    ],
  },
  {
    group: 'Customers',
    items: [
      { key: 'users', label: 'Users & access', icon: Users },
      { key: 'premium', label: 'Premium billing', icon: Crown },
      { key: 'tools', label: 'Admin tools', icon: Wrench },
    ],
  },
  {
    group: 'Operations',
    items: [
      { key: 'health', label: 'System health', icon: Activity },
      { key: 'audit', label: 'Audit trail', icon: ScrollText },
      { key: 'reports', label: 'Reports (MIS)', icon: BarChart3 },
      { key: 'pricing', label: 'Pricing control', icon: Tag },
    ],
  },
];
const TAB_KEYS = NAV.flatMap((g) => g.items.map((i) => i.key));
const TAB_LABEL = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.key, i.label]))) as Record<TabKey, string>;

const EXCLUDE_ADMIN = [EXCLUDED_ADMIN_USER_ID];
const REFRESH_MS = 5 * 60 * 1000;

const isMissingTable = (e: any) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|Could not find the table/i.test(e.message || ''));
const isMissingFn = (e: any) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|function .* does not exist/i.test(e.message || ''));

/** 1 April of the current Indian financial year, as an ISO instant (IST midnight). */
const fyStartISO = () => {
  const key = istDateKey(new Date().toISOString());
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return new Date(`${m >= 4 ? y : y - 1}-04-01T00:00:00+05:30`).toISOString();
};

const periodStartISO = (period: MisPeriod): string => {
  const d = new Date();
  if (period === 'day') d.setDate(d.getDate() - 1);
  else if (period === 'week') d.setDate(d.getDate() - 7);
  else if (period === 'month') d.setMonth(d.getMonth() - 1);
  else if (period === 'year') d.setFullYear(d.getFullYear() - 1);
  else if (period === 'fy') return fyStartISO();
  else return new Date('2020-01-01T00:00:00Z').toISOString();
  return d.toISOString();
};

const fmtIST = (iso: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

/* ============================================================
   Page
   ============================================================ */

export default function AdminDashboardPage(props: {
  searchParams: Promise<{ filter?: string; inactiveDays?: string }>;
}) {
  const [searchParamsData, setSearchParamsData] = useState<{ filter?: string; inactiveDays?: string }>({});
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<TabKey>('overview');
  const { notify, toastView } = useToast();

  /* ---------- data ---------- */
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);

  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [queryLatency, setQueryLatency] = useState(0);
  const [health, setHealth] = useState<HealthStats | null>(null);

  const [walletProfiles, setWalletProfiles] = useState<any[]>([]);
  const [rbacProfiles, setRbacProfiles] = useState<any[]>([]);
  const [recharges, setRecharges] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [ledgerOk, setLedgerOk] = useState(true);
  const [txns, setTxns] = useState<RevenueTxn[]>([]);
  const [estimatesList, setEstimatesList] = useState<any[]>([]);
  const [serviceRecordsList, setServiceRecordsList] = useState<any[]>([]);
  const [refundRequests, setRefundRequests] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [incomesMissing, setIncomesMissing] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutsOk, setPayoutsOk] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [razorpayTransactions, setRazorpayTransactions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [monthlyCases, setMonthlyCases] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState<any[]>([]);

  /* ---------- UI state ---------- */
  const [userTableSearch, setUserTableSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalFilterType, setModalFilterType] = useState<'all' | 'date' | 'month'>('all');
  const [modalSelectedDate, setModalSelectedDate] = useState('');
  const [modalSelectedMonth, setModalSelectedMonth] = useState('');
  const [hiddenSections, setHiddenSections] = useState<{ [key: string]: boolean }>({});
  const [busyRechargeId, setBusyRechargeId] = useState<string | null>(null);
  const [auditLimit, setAuditLimit] = useState(25);
  const warnedLegacy = useRef(false);

  const misPeriod = (['day', 'week', 'month', 'year', 'fy', 'all'].includes(searchParamsData.filter || '')
    ? searchParamsData.filter
    : 'all') as MisPeriod;
  const inactiveDays = Number(searchParamsData.inactiveDays || 30) || 30;

  /* ---------- bootstrapping ---------- */
  useEffect(() => {
    setMounted(true);
    props.searchParams.then((p) => setSearchParamsData(p || {})).catch(() => setSearchParamsData({}));
  }, [props.searchParams]);

  useEffect(() => installErrorMonitor(), []);

  useEffect(() => {
    const h = window.location.hash.replace('#', '') as TabKey;
    if (TAB_KEYS.includes(h)) setTab(h);
    supabase.auth.getUser().then(({ data }) => setAdminId(data?.user?.id ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        notify('Printing and saving this page are disabled – it contains confidential financial data. Use the Export buttons instead.', 'warning');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notify]);

  const go = useCallback((k: string) => {
    if (!TAB_KEYS.includes(k as TabKey)) return;
    setTab(k as TabKey);
    try { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${k}`); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  }, []);

  /* ---------- loaders ---------- */

  const record = useCallback((s: DataSourceStatus) => {
    setSources((prev) => {
      const i = prev.findIndex((p) => p.key === s.key);
      if (i === -1) return [...prev, s];
      const next = prev.slice();
      next[i] = s;
      return next;
    });
  }, []);

  /** Runs one query, records its health (ok / rows / ms / error) and reports failures to the crash log. */
  const run = useCallback(
    async (key: string, label: string, fn: () => PromiseLike<any>, opts: { tolerateMissing?: boolean; cap?: number } = {}) => {
      const t0 = Date.now();
      let res: any;
      try { res = await fn(); } catch (e: any) { res = { data: null, error: { message: e?.message || String(e) } }; }
      const ms = Date.now() - t0;
      const err = res?.error ?? null;
      const missing = !!err && !!opts.tolerateMissing && isMissingTable(err);
      const rows = Array.isArray(res?.data) ? res.data.length : toNum(res?.count);
      record({
        key, label, ok: !err || missing, rows, ms,
        error: err ? (missing ? 'Table not set up yet' : err.message) : null,
        truncated: !!res?.truncated || (opts.cap ? rows >= opts.cap : false),
      });
      if (err && !missing) reportSupabaseError(label, err);
      return { ...res, ms, missing };
    },
    [record]
  );

  const loadCore = useCallback(async () => {
    setRefreshing(true);
    try {
      const since24 = new Date(Date.now() - 86400_000).toISOString();
      const [
        profilesRes, rechargesRes, ledgerRes, refundsRes, incomesRes, rbacRes, usersRes, onlineRes,
        rpRes, auditRes, casesRes, errRes, payoutsRes, revenue,
      ] = await Promise.all([
        run('profiles', 'Profiles & wallet balances', () =>
          fetchAll((a, b) =>
            supabase.from('profiles').select('id, full_name, email, mobile, user_code, plan_type, wallet_balance').order('id').range(a, b))),
        run('recharges', 'Wallet recharges', () =>
          fetchAll((a, b) => supabase.from('wallet_recharges').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).range(a, b))),
        run('ledger', 'Wallet ledger', () =>
          fetchAll((a, b) => supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).range(a, b))),
        run('refunds', 'Refund requests', () =>
          fetchAll((a, b) => supabase.from('wallet_refund_requests').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).range(a, b))),
        run('incomes', 'GST income register', () =>
          fetchAll((a, b) => supabase.from('admin_incomes').select('*').order('created_at', { ascending: false }).range(a, b)), { tolerateMissing: true }),
        run('rbac', 'Users with estimates', () => supabase.rpc('get_profiles_with_estimates_count')),
        run('users', 'Total users', () => supabase.rpc('get_total_users')),
        run('online', 'Live user status', () => supabase.from('user_status').select('*', { count: 'exact', head: true }).eq('is_online', true)),
        run('razorpay', 'Razorpay transactions', () => supabase.rpc('get_razorpay_transactions')),
        run('audit', 'Audit logs', () => supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)),
        run('cases', 'Monthly case count', () => supabase.rpc('get_monthly_case_count')),
        run('errlog', 'Crash log (24h)', () => supabase.from(ERROR_TABLE).select('severity, resolved').gte('created_at', since24).limit(1000), { tolerateMissing: true }),
        run('payouts', 'Partner payouts', () => supabase.from('shareholder_paytable').select('*'), { tolerateMissing: true }),
        fetchRevenueSources(supabase),
      ]);

      /* revenue sources report as two data sources */
      record({ key: 'estimates', label: 'Estimates', ok: !revenue.estimates.error, rows: revenue.estimates.data.length, ms: revenue.ms.estimates, error: revenue.estimates.error?.message ?? null, truncated: revenue.estimates.truncated });
      record({ key: 'services', label: 'Service records', ok: !revenue.services.error, rows: revenue.services.data.length, ms: revenue.ms.services, error: revenue.services.error?.message ?? null, truncated: revenue.services.truncated });
      if (revenue.estimates.error) reportSupabaseError('Estimates', revenue.estimates.error);
      if (revenue.services.error) reportSupabaseError('Service records', revenue.services.error);

      /* Keep the previous numbers when a query fails instead of silently showing zero. */
      if (!profilesRes.error) setWalletProfiles(profilesRes.data || []);
      if (!rechargesRes.error) setRecharges(rechargesRes.data || []);
      setLedgerOk(!ledgerRes.error);
      if (!ledgerRes.error) setLedger(ledgerRes.data || []);
      if (!refundsRes.error) setRefundRequests(refundsRes.data || []);
      setIncomesMissing(!!incomesRes.missing);
      if (!incomesRes.error) setIncomes(incomesRes.data || []);
      if (!payoutsRes.error) setPayouts(payoutsRes.data || []);
      setPayoutsOk(!payoutsRes.error || !!payoutsRes.missing);
      if (!rbacRes.error) {
        const list = [...(rbacRes.data || [])];
        list.sort((a: any, b: any) => String(a.full_name || '').toLowerCase().localeCompare(String(b.full_name || '').toLowerCase()));
        setRbacProfiles(list);
      }
      if (!usersRes.error) setTotalUsers(Number(usersRes.data ?? 0));
      if (!onlineRes.error) { setOnlineCount(onlineRes.count ?? 0); setQueryLatency(onlineRes.ms); }
      if (!rpRes.error) setRazorpayTransactions(rpRes.data || []);
      if (!auditRes.error) setAuditLogs(auditRes.data || []);
      if (!casesRes.error) setMonthlyCases(casesRes.data || []);

      if (!revenue.estimates.error && !revenue.services.error) {
        setEstimatesList(revenue.estimates.data);
        setServiceRecordsList(revenue.services.data);
        setTxns(buildRevenueTxns(revenue.estimates.data, revenue.services.data));
      }

      /* error-log summary for the nav badge / overview (full view lives in System health) */
      const errRows: any[] = errRes.error ? [] : errRes.data || [];
      const open = errRows.filter((r) => !r.resolved);
      setHealth((prev) => ({
        open24h: errRes.error ? prev?.open24h ?? 0 : open.length,
        critical24h: errRes.error ? prev?.critical24h ?? 0 : open.filter((r) => r.severity === 'critical').length,
        failedSources: prev?.failedSources ?? 0,
        setupNeeded: !!errRes.missing,
      }));

      setLastUpdated(new Date());
      setLoaded(true);
    } finally {
      setRefreshing(false);
    }
  }, [run, record]);

  const loadMis = useCallback(async () => {
    const [recRes, inactiveRes] = await Promise.all([
      run('mis', 'MIS records', () =>
        supabase.from('mis_records').select('*').gte('created_date', periodStartISO(misPeriod)).order('created_date', { ascending: false }).limit(1000), { cap: 1000 }),
      run('inactive', 'Inactive users', () => supabase.rpc('get_inactive_users', { days_limit: inactiveDays })),
    ]);
    if (!recRes.error) setRecords(recRes.data || []);
    if (!inactiveRes.error) setInactiveUsers(inactiveRes.data || []);
  }, [run, misPeriod, inactiveDays]);

  useEffect(() => { if (mounted) void loadCore(); }, [mounted, loadCore]);
  useEffect(() => { if (mounted) void loadMis(); }, [mounted, loadMis]);

  useEffect(() => {
    if (!mounted) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') void loadCore(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [mounted, loadCore]);

  const refreshAll = () => { void loadCore(); void loadMis(); };

  /* keep "failed sources" in the health summary current */
  const failedSources = sources.filter((s) => !s.ok).length;
  useEffect(() => {
    setHealth((prev) => (prev && prev.failedSources === failedSources ? prev : { open24h: prev?.open24h ?? 0, critical24h: prev?.critical24h ?? 0, setupNeeded: prev?.setupNeeded ?? false, failedSources }));
  }, [failedSources]);

  /* ============================================================
     Actions
     ============================================================ */

  const toggleSection = (key: string) => setHiddenSections((p) => ({ ...p, [key]: !p[key] }));

  const handleUpdateUserRbac = async (userId: string, field: 'role' | 'status', value: string) => {
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', userId);
    if (error) { notify(`Could not update ${field}: ${error.message}`, 'error'); reportSupabaseError('Update user access', error); return; }
    notify(`User ${field} updated to "${value}".`, 'success');
    void loadCore();
  };

  /* ----- wallet recharge actions: atomic via SQL functions; guarded fallback if SQL not yet applied ----- */

  const afterRechargeChange = () => { void loadCore(); };

  const legacyBalanceChange = async (userId: string, delta: number) => {
    const { data: p, error: e1 } = await supabase.from('profiles').select('wallet_balance').eq('id', userId).maybeSingle();
    if (e1) throw e1;
    const { error: e2 } = await supabase.from('profiles').update({ wallet_balance: round2(toNum(p?.wallet_balance) + delta) }).eq('id', userId);
    if (e2) throw e2;
  };

  const warnLegacy = () => {
    if (warnedLegacy.current) return;
    warnedLegacy.current = true;
    notify('Using fallback mode. Atomic recharge functions are not installed (see sql/02_recharge_functions_AFTER_TRIGGER_REVIEW.sql). Using the standard path.', 'info', 6000);
  };

  const approveRecharge = async (req: any) => {
    const id = String(req.id);
    setBusyRechargeId(id);
    try {
      const { error } = await supabase.rpc('approve_wallet_recharge', { p_request_id: id });
      if (error && !isMissingFn(error)) throw error;
      if (error) {
        warnLegacy();
        const { data: upd, error: e1 } = await supabase.from('wallet_recharges').update({ status: 'APPROVED' }).eq('id', req.id).eq('status', 'PENDING').select('id');
        if (e1) throw e1;
        if (!upd?.length) throw new Error('This request was already processed.');
        try { await legacyBalanceChange(req.user_id, toNum(req.amount)); }
        catch (e) { await supabase.from('wallet_recharges').update({ status: 'PENDING' }).eq('id', req.id); throw e; }
      }
      notify(`Approved ${inr(toNum(req.amount))} for ${req.user_name || 'user'}. Wallet credited.`, 'success');
      afterRechargeChange();
    } catch (e: any) {
      notify(`Could not approve: ${e?.message || e}`, 'error');
      reportSupabaseError('Approve recharge', e);
      afterRechargeChange();
    } finally { setBusyRechargeId(null); }
  };

  const rejectRecharge = async (req: any) => {
    if (!window.confirm(`Reject the ${inr(toNum(req.amount))} recharge request from ${req.user_name || 'this user'}?`)) return;
    const id = String(req.id);
    setBusyRechargeId(id);
    try {
      const { error } = await supabase.rpc('reject_wallet_recharge', { p_request_id: id });
      if (error && !isMissingFn(error)) throw error;
      if (error) {
        warnLegacy();
        const { data: upd, error: e1 } = await supabase.from('wallet_recharges').update({ status: 'REJECTED' }).eq('id', req.id).eq('status', 'PENDING').select('id');
        if (e1) throw e1;
        if (!upd?.length) throw new Error('This request was already processed.');
      }
      notify('Recharge request rejected.', 'success');
      afterRechargeChange();
    } catch (e: any) {
      notify(`Could not reject: ${e?.message || e}`, 'error');
      reportSupabaseError('Reject recharge', e);
      afterRechargeChange();
    } finally { setBusyRechargeId(null); }
  };

  const revokeRecharge = async (req: any) => {
    const amt = toNum(req.amount);
    if (!window.confirm(`Revoke this APPROVED recharge?\n\n${inr(amt)} will be deducted from ${req.user_name || 'the user'}'s wallet. If they already used it, their balance will go negative and show as "Overdrawn".`)) return;
    const id = String(req.id);
    setBusyRechargeId(id);
    try {
      const { error } = await supabase.rpc('revoke_wallet_recharge', { p_request_id: id });
      if (error && !isMissingFn(error)) throw error;
      if (error) {
        warnLegacy();
        const { data: upd, error: e1 } = await supabase.from('wallet_recharges').update({ status: 'REJECTED' }).eq('id', req.id).eq('status', 'APPROVED').select('id');
        if (e1) throw e1;
        if (!upd?.length) throw new Error('This request is no longer approved.');
        try { await legacyBalanceChange(req.user_id, -amt); }
        catch (e) { await supabase.from('wallet_recharges').update({ status: 'APPROVED' }).eq('id', req.id); throw e; }
      }
      notify(`Recharge revoked. ${inr(amt)} deducted from the wallet.`, 'success');
      afterRechargeChange();
    } catch (e: any) {
      notify(`Could not revoke: ${e?.message || e}`, 'error');
      reportSupabaseError('Revoke recharge', e);
      afterRechargeChange();
    } finally { setBusyRechargeId(null); }
  };

  /* ----- GST ----- */

  const splitGst = (taxable: number, rate: number, inter: boolean) => {
    const gst = round2((taxable * rate) / 100);
    if (inter) return { gst, cgst: 0, sgst: 0, igst: gst };
    const cgst = round2(gst / 2);
    return { gst, cgst, sgst: round2(gst - cgst), igst: 0 };
  };

  const addIncome = async (form: IncomeForm): Promise<boolean> => {
    const taxable = Number(form.taxable_amount);
    const rate = Number(form.gst_rate);
    if (!Number.isFinite(taxable) || taxable <= 0) { notify('Enter a valid taxable amount.', 'warning'); return false; }
    const { gst, cgst, sgst, igst } = splitGst(taxable, rate, form.gst_type === 'INTER');
    const { error } = await supabase.from('admin_incomes').insert([{
      client_name: form.client_name.trim(),
      invoice_no: form.invoice_no.trim() || `INV-${Date.now().toString().slice(-6)}`,
      taxable_amount: taxable, gst_rate: rate, gst_amount: gst, cgst, sgst, igst,
      total_amount: round2(taxable + gst), description: form.description,
    }]);
    if (error) { notify(`Invoice was NOT saved: ${error.message}`, 'error'); reportSupabaseError('Add income', error); return false; }
    notify('Invoice recorded.', 'success');
    void loadCore();
    return true;
  };

  /** Revenue earned in a period is GST-inclusive (18%); book it as one consolidated B2C invoice. */
  const generatePeriodGst = async (req: GstRequest) => {
    if (req.amount <= 0) { notify('No revenue in this period to invoice.', 'warning'); return; }
    const rate = 18;
    const taxable = round2(req.amount / (1 + rate / 100));
    const { gst, cgst, sgst } = splitGst(taxable, rate, false);
    let invoiceNo = `B2C-${req.mode.toUpperCase()}-${req.key}`;
    const existing = incomes.find((i) => i.invoice_no === invoiceNo);
    if (existing) {
      if (!window.confirm(`An invoice (${invoiceNo}) for this period already exists for ${inr(toNum(existing.total_amount))}.\n\nCreate an additional invoice for ${inr(req.amount)}?`)) return;
      invoiceNo = `${invoiceNo}-${Date.now().toString().slice(-4)}`;
    }
    const { error } = await supabase.from('admin_incomes').insert([{
      client_name: `B2C Consolidated Sales (${req.key})`, invoice_no: invoiceNo,
      taxable_amount: taxable, gst_rate: rate, gst_amount: gst, cgst, sgst, igst: 0, total_amount: round2(req.amount),
      description: `Consolidated earned revenue for ${req.mode.toUpperCase()} ${req.key}: ${req.count} transactions (gateway + wallet usage), GST-inclusive.`,
    }]);
    if (error) { notify(`Invoice was NOT created: ${error.message}`, 'error'); reportSupabaseError('Generate GST invoice', error); return; }
    notify(`Invoice ${invoiceNo} created for ${inr(req.amount)}.`, 'success');
    void loadCore();
  };

  /* ============================================================
     Derived values
     ============================================================ */

  const filteredProfiles = useMemo(() => {
    const q = userTableSearch.toLowerCase();
    return rbacProfiles.filter((p: any) => {
      const hay = [
        p.full_name || p.name, p.email, p.mobile, p.category || p.user_category || p.user_type || p.account_type,
        p.firm_name || p.company_name || p.business_name,
      ].map((v) => String(v || '').toLowerCase());
      return hay.some((h) => h.includes(q));
    });
  }, [rbacProfiles, userTableSearch]);

  const rechargeStats = useMemo(() => {
    const thisMonth = currentISTMonth();
    let pending = 0, pendingN = 0, approvedMonth = 0, approvedAll = 0, rejected = 0;
    recharges.forEach((r) => {
      const b = rechargeBucket(r.status);
      const a = toNum(r.amount);
      if (b === 'pending') { pending += a; pendingN++; }
      else if (b === 'approved') { approvedAll += a; if (istMonthKey(r.created_at) === thisMonth) approvedMonth += a; }
      else rejected += a;
    });
    return { pending, pendingN, approvedMonth, approvedAll, rejected };
  }, [recharges]);

  const pendingRefundCount = useMemo(
    () => refundRequests.filter((r) => ['PENDING', ''].includes(String(r.status ?? '').trim().toUpperCase())).length,
    [refundRequests]
  );

  const badges: Partial<Record<TabKey, { n: number; tone: 'warning' | 'negative' }>> = {};
  if (rechargeStats.pendingN) badges.recharges = { n: rechargeStats.pendingN, tone: 'warning' };
  if (pendingRefundCount) badges.refunds = { n: pendingRefundCount, tone: 'warning' };
  if (health && (health.critical24h > 0 || health.failedSources > 0)) badges.health = { n: health.critical24h + health.failedSources, tone: 'negative' };
  else if (health && health.open24h > 0) badges.health = { n: health.open24h, tone: 'warning' };

  const status: { tone: 'positive' | 'warning' | 'negative'; text: string } =
    health && (health.critical24h > 0 || health.failedSources > 0)
      ? { tone: 'negative', text: 'Attention required' }
      : health && health.open24h > 0
        ? { tone: 'warning', text: 'Minor issues' }
        : { tone: 'positive', text: 'Operational' };

  const buildMisHref = (p: MisPeriod) => `/admin-dashboard?filter=${p}&inactiveDays=${inactiveDays}#reports`;

  /* ============================================================
     Render
     ============================================================ */

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">Loading admin console…</div>;
  }

  const pill = (t: 'positive' | 'warning' | 'negative') =>
    t === 'positive' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : t === 'warning' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-rose-50 text-rose-700 ring-rose-200';
  const dot = (t: 'positive' | 'warning' | 'negative') => (t === 'positive' ? 'bg-emerald-500' : t === 'warning' ? 'bg-amber-500' : 'bg-rose-500');

  const content = (() => {
    if (!loaded && tab !== 'health') {
      return (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-72 w-full" />
        </div>
      );
    }
    switch (tab) {
      case 'overview':
        return (
          <OverviewPanel
            txns={txns} recharges={recharges} profiles={walletProfiles} ledger={ledger} ledgerOk={ledgerOk}
            refundRequests={refundRequests} health={health} failedSources={failedSources}
            totalUsers={totalUsers} onlineCount={onlineCount} inactiveUsers={inactiveUsers} onNavigate={go}
          />
        );
      case 'revenue':
        return (
          <div className="space-y-2">
            <RevenueInspector txns={txns} onGenerateGst={generatePeriodGst} />
            <p className="text-[11px] text-slate-400">Revenue rules v{FINANCE_RULES_VERSION}. A payment with a Razorpay payment id counts as received even if its status still says pending.</p>
          </div>
        );
      case 'wallet':
        return (
          <WalletOverviewPanel
            recharges={recharges} profiles={walletProfiles} ledger={ledger} ledgerOk={ledgerOk}
            walletPaidTxns={txns} excludeUserIds={EXCLUDE_ADMIN}
          />
        );
      case 'recharges':
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Pending approval" value={inr0(rechargeStats.pending)} tone={rechargeStats.pendingN ? 'warning' : 'neutral'} hint={`${rechargeStats.pendingN} request${rechargeStats.pendingN === 1 ? '' : 's'}`} />
              <Stat label="Approved this month" value={inr0(rechargeStats.approvedMonth)} tone="positive" />
              <Stat label="Approved all time" value={inr0(rechargeStats.approvedAll)} tone="info" />
              <Stat label="Rejected all time" value={inr0(rechargeStats.rejected)} />
            </div>
            <RechargeRequestsTable requests={recharges} busyId={busyRechargeId} onApprove={approveRecharge} onReject={rejectRecharge} onRevoke={revokeRecharge} />
          </div>
        );
      case 'refunds':
        return <AdminRefundRequestsWidget refundRequests={refundRequests} onUpdate={() => void loadCore()} />;
      case 'profit':
        return (
          <div className="space-y-8">
            <ProfitOverview txns={txns} payouts={payouts} payoutsOk={payoutsOk} />
            <section aria-label="Partner management" className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Partner shares &amp; payouts</h3>
                <p className="text-xs text-slate-500">Partner equity, settlement entries and payout requests.</p>
              </div>
              <BusinessProfitSharingWidget />
            </section>
          </div>
        );
      case 'gst':
        return (
          <div className="space-y-4">
            {incomesMissing && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <b>The invoice register table is not set up yet.</b> Run <code className="font-mono">sql/01_run_now.sql</code> in the Supabase SQL editor, then press Refresh. Invoices cannot be saved until then.
              </div>
            )}
            <GstManager incomes={incomes} onAdd={addIncome} />
          </div>
        );
      case 'razorpay':
        return (
          <div className="space-y-5">
            <Card title="Razorpay revenue analytics"><RazorpayRevenueChart transactions={razorpayTransactions} /></Card>
            <AdminRazorpayLiveWidget transactions={txns} estimates={estimatesList} serviceRecords={serviceRecordsList} />
          </div>
        );
      case 'users':
        return (
          <div className="space-y-5">
            <UserManagementRBAC
              filteredProfiles={filteredProfiles}
              userTableSearch={userTableSearch} setUserTableSearch={setUserTableSearch}
              modalSelectedDate={modalSelectedDate} setModalSelectedDate={setModalSelectedDate}
              modalSelectedMonth={modalSelectedMonth} setModalSelectedMonth={setModalSelectedMonth}
              modalFilterType={modalFilterType} setModalFilterType={setModalFilterType}
              hiddenSections={hiddenSections} toggleSection={toggleSection}
              handleUpdateUserRbac={handleUpdateUserRbac}
              handleOpenUserEstimates={(p: any) => setSelectedUser(p)}
            />
            <Card
              title="Dormant users"
              subtitle={`${inactiveUsers.length} user${inactiveUsers.length === 1 ? '' : 's'} with no login in the last ${inactiveDays} days`}
              actions={
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                  {[10, 20, 30, 60, 90].map((d) => (
                    <Link
                      key={d} scroll={false} href={`/admin-dashboard?filter=${misPeriod}&inactiveDays=${d}#users`}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${inactiveDays === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >{d}d</Link>
                  ))}
                </div>
              }
              bodyClassName="p-0"
            >
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {inactiveUsers.length === 0 && <EmptyState title="No dormant users for this threshold" />}
                {inactiveUsers.map((u: any) => (
                  <div key={u.user_id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-slate-800">{u.email}</span>
                    <span className="text-xs text-slate-500">Last login {u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'never'}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      case 'premium':
        return <PremiumBillingWidget />;
      case 'tools':
        return (
          <div className="space-y-5">
            <AdminPendingApprovalsWidget onActionComplete={() => void loadCore()} />
            <AdminCreateUserWidget onUserCreated={() => void loadCore()} />
            <AdminBroadcastWidget />
            <PushNotificationManager />
          </div>
        );
      case 'health':
        return (
          <SystemHealthPanel dataSources={sources} queryLatency={queryLatency} adminId={adminId} notify={notify} onStats={setHealth} />
        );
      case 'audit':
        return (
          <Card title="Audit trail" subtitle="Chronological log of database changes and administrative actions (latest 200)" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead><tr><th className={thCls}>When (IST)</th><th className={thCls}>Action</th><th className={thCls}>Detail</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length === 0 && (<tr><td colSpan={3}><EmptyState title="No audit entries" /></td></tr>)}
                  {auditLogs.slice(0, auditLimit).map((l: any, i: number) => (
                    <tr key={l.id ?? i}>
                      <td className={`${tdCls} text-xs whitespace-nowrap`}>{fmtIST(l.created_at)}</td>
                      <td className={tdCls}><Badge tone="info">{String(l.action_type || 'UPDATE').toUpperCase()}</Badge></td>
                      <td className={tdCls}>{l.description || l.table_name || 'System record modified'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {auditLogs.length > auditLimit && (
              <div className="p-3 border-t border-slate-100 text-center"><Btn size="sm" onClick={() => setAuditLimit((n) => n + 50)}>Show more</Btn></div>
            )}
          </Card>
        );
      case 'reports':
        return <ReportsPanel period={misPeriod} buildHref={buildMisHref} records={records} monthlyCases={monthlyCases} txns={txns} profiles={walletProfiles} />;
      case 'pricing':
        return <PricingControlWidget />;
      default:
        return null;
    }
  })();

  return (
    <>
      <style jsx global>{`
        @media print { body { display: none !important; } }
      `}</style>

      <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {/* ---------- Top bar ---------- */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="flex items-center gap-3 px-4 lg:px-6 h-14">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-blue-700 text-white flex items-center justify-center text-sm font-bold">A</div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold leading-tight truncate">Admin Console</h1>
                <p className="text-[11px] text-slate-500 leading-tight truncate">{TAB_LABEL[tab]} · FY {(() => { const k = istDateKey(new Date().toISOString()); const y = Number(k.slice(0, 4)); const s = Number(k.slice(5, 7)) >= 4 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, '0')}`; })()}</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => go('health')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${pill(status.tone)}`}
                title="Open System health"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dot(status.tone)}`} /> {status.text}
              </button>
              <span className="hidden md:block text-xs text-slate-500">
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })} IST` : 'Loading…'}
              </span>
              <Btn size="sm" onClick={refreshAll} disabled={refreshing} aria-label="Refresh data">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
              </Btn>
              <a
                href="/api/admin/export-reports" target="_blank" rel="noopener"
                className="hidden sm:inline-flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >Export report</a>
            </div>
          </div>

          {/* mobile / tablet nav */}
          <nav className="lg:hidden flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Sections">
            {NAV.flatMap((g) => g.items).map((it) => (
              <button
                key={it.key} onClick={() => go(it.key)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${tab === it.key ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {it.label}{badges[it.key] ? ` (${badges[it.key]!.n})` : ''}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex">
          {/* ---------- Sidebar ---------- */}
          <aside className="hidden lg:block w-60 shrink-0 border-r border-slate-200 bg-white min-h-[calc(100vh-3.5rem)]">
            <nav className="sticky top-14 p-3 space-y-5 max-h-[calc(100vh-3.5rem)] overflow-y-auto" aria-label="Sections">
              {NAV.map((g) => (
                <div key={g.group}>
                  <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.group}</p>
                  <ul className="space-y-0.5">
                    {g.items.map((it) => {
                      const Icon = it.icon;
                      const b = badges[it.key];
                      const active = tab === it.key;
                      return (
                        <li key={it.key}>
                          <button
                            onClick={() => go(it.key)} aria-current={active ? 'page' : undefined}
                            className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${active ? 'bg-blue-50 text-blue-800 font-medium' : 'text-slate-700 hover:bg-slate-100'}`}
                          >
                            <Icon className={`h-4 w-4 ${active ? 'text-blue-700' : 'text-slate-400'}`} />
                            <span className="flex-1 text-left truncate">{it.label}</span>
                            {b && (
                              <span className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-center ${b.tone === 'negative' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800'}`}>{b.n}</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* ---------- Main ---------- */}
          <main className="flex-1 min-w-0 p-4 lg:p-6">
            <div className="max-w-[1400px] mx-auto">
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight">{TAB_LABEL[tab]}</h2>
              </div>
              <ErrorBoundary key={tab} name={TAB_LABEL[tab]}>{content}</ErrorBoundary>
            </div>
          </main>
        </div>

        {selectedUser && <UserEstimatesModal profile={selectedUser} onClose={() => setSelectedUser(null)} notify={notify} />}
        {toastView}
      </div>
    </>
  );
}
