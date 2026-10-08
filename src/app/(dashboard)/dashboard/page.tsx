'use client';

import { useState, useEffect, useMemo, useCallback, memo, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ApprovalNotificationBell from './components/ApprovalNotificationBell';
import { BarChart3, LayoutDashboard, Send } from 'lucide-react';

// ✅ Analytics Components

// ✅ Heavy / kam-use wale components ab sirf zarurat par load hote hain (first load fast)
// ✅ FIX (TS2769): props any rakhe — warna dynamic() component ko `{}` props wala maan leta hai
const lazy = (loader: () => Promise<any>) =>
  dynamic(loader, { ssr: false }) as ComponentType<any>;
const RechargeModal = lazy(() => import('./components/RechargeModal'));
const CorporateSupportModal = lazy(() => import('./components/CorporateSupportModal'));
const PartnerNetworkPromoModal = lazy(() => import('./components/PartnerNetworkPromoModal'));
const AdminRechargeApproval = lazy(() => import('./components/AdminRechargeApproval'));
const AdminPartnerApproval = lazy(() => import('./components/AdminPartnerApproval'));
const AnalyticsHeader = lazy(() => import('./components/AnalyticsHeader'));
const KpiCards = lazy(() => import('./components/KpiCards'));
const SalesTrendChart = lazy(() => import('./components/SalesTrendChart'));
const StateWiseHeatmap = lazy(() => import('./components/StateWiseHeatmap'));
const ProductWiseBreakdown = lazy(() => import('./components/ProductWiseBreakdown'));
const FyComparisonChart = lazy(() => import('./components/FyComparisonChart'));

// ✅ Sirf zaruri columns — heavy columns (form_snapshot etc.) nahi aate.
// Agar koi column DB me na mile to automatically select('*') par fallback hota hai.
const MIS_COLS = 'id, ref_no, customer_name, client_name, representative, case_type, fee_standard, user_payment, status, created_date, user_id';
const EST_COLS = 'id, ref_no, customer_name, client_name, representative, estimate_type, fee_standard, user_payment, status, created_at, user_id';
const SVC_COLS = 'id, ref_no, customer_name, client_name, representative, case_type, deed_type, fee_standard, gateway_fee, user_payment, user_service_fee, status, payment_status, created_at, user_id, state_name, city_district, razorpay_payment_id, buyers:form_snapshot->buyers';

// ✅ Jo column DB me nahi hota, wo khud list se hat jata hai aur query dobara chalti hai
// (poora select('*') nahi). Chuni hui list session me yaad rehti hai.
const colsCache = new Map<string, string>();

async function queryWithFallback(table: string, cols: string, build: (q: any) => any) {
  const t0 = performance.now();
  let list = (colsCache.get(table) ?? cols).split(',').map((c) => c.trim()).filter(Boolean);

  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await build(supabase.from(table).select(list.join(', ')));
    if (!res.error) {
      colsCache.set(table, list.join(', '));
      console.log(`[dashboard] ${table}: ${Math.round(performance.now() - t0)}ms (${res.data?.length ?? 0} rows)`);
      return res;
    }
    const m = /column [\w]+\.(\w+) does not exist/i.exec(res.error.message || '');
    if (!m) break;
    console.warn(`[dashboard] ${table}.${m[1]} DB me nahi hai -> list se hata diya`);
    list = list.filter((c) => c !== m[1] && !c.endsWith(`:${m[1]}`));
  }

  console.warn(`[dashboard] ${table}: select('*') fallback`);
  const res = await build(supabase.from(table).select('*'));
  console.log(`[dashboard] ${table} (*): ${Math.round(performance.now() - t0)}ms (${res.data?.length ?? 0} rows)`);
  return res;
}

const PAGE_SIZE = 100;

// ✅ Instant load: pichla data sessionStorage me (user-wise), fresh data background me aata hai
const CACHE_PREFIX = 'dash_cache_v1_';
const clearDashCache = () => {
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => sessionStorage.removeItem(k));
  } catch {}
};

// ✅ Row memo — typing / column resize par poori table dobara render nahi hoti
const TxnRow = memo(function TxnRow({ est, onHistory }: { est: any; onHistory: (e: any) => void }) {
  const dateSource = est.created_date || est.created_at;
  const dateObj = dateSource ? new Date(dateSource) : null;
  const formattedDate = dateObj
    ? `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`
    : '-';

  let cleanCustomerName = est.customer_name || '-';
  const match = cleanCustomerName.match(/^(.*?)\s+(s\/o|d\/o|w\/o|c\/o|S\/O|D\/O|W\/O|C\/O)\b/i);
  if (match && match[1]) cleanCustomerName = match[1].trim();

  const statusUpper = (est.status || 'PENDING').toUpperCase();
  const isPaid = statusUpper === 'RECEIVED' || statusUpper === 'PAID' || statusUpper === 'COMPLETED';

  return (
    <tr className="border-t hover:bg-slate-50 text-xs font-sans tracking-wide">
      <td className="p-3 font-bold text-blue-600 uppercase text-center">{est.ref_no}</td>
      <td className="p-3 text-slate-600 text-center whitespace-nowrap">{formattedDate}</td>
      <td className="p-3 uppercase text-center">
        <div className="font-extrabold text-slate-800">{cleanCustomerName.replace(/[,.]\s*$/, '')}</div>
      </td>
      <td className="p-3 font-bold text-slate-700 uppercase text-center truncate">{est.client_name || '-'}</td>
      <td className="p-3 font-semibold text-slate-600 uppercase text-center truncate">{est.representative || '-'}</td>
      <td className="p-3 font-black text-slate-900 uppercase text-center whitespace-nowrap">{est.case_type || 'NEW CONSTRUCTION'}</td>
      <td className="p-3 font-bold text-slate-800 text-center whitespace-nowrap">₹{Number(est.fee_standard || 0).toLocaleString()}</td>
      <td className="p-3 text-center">
        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
          isPaid ? 'bg-emerald-100 text-emerald-600'
            : statusUpper === 'WAIVED' ? 'bg-slate-100 text-slate-600'
            : statusUpper === 'FINALIZED' ? 'bg-blue-100 text-blue-600'
            : 'bg-red-100 text-red-600'
        }`}>
          {statusUpper}
        </span>
      </td>
      <td className="p-3 text-center">
        <button
          onClick={() => onHistory(est)}
          className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1 rounded-lg text-xs transition border border-blue-200 uppercase cursor-pointer"
        >
          History
        </button>
      </td>
    </tr>
  );
});

export default function DashboardPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>({
    email: '', id: '', uuid: '', name: 'Loading...', wallet: 0,
    planType: 'BASIC ENGINE PLAN', isAdmin: false, isApprover: false,
    role: 'user', secondRole: null, approvalStatus: 'APPROVED',
    createdAt: null, state: ''
  });
  const [estimateList, setEstimateList] = useState<any[]>([]);

  // UI States
  const [showProfile, setShowProfile] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // ✅ View Switcher
  const [adminView, setAdminView] = useState<'dashboard' | 'analytics'>('dashboard');

  // ✅ Analytics Filters
   // ✅ Analytics Filters
  const [analyticsFY, setAnalyticsFY] = useState('ALL');
  const [analyticsMonth, setAnalyticsMonth] = useState('ALL');
  const [analyticsState, setAnalyticsState] = useState('ALL');
  const [analyticsProduct, setAnalyticsProduct] = useState('ALL');

  // ✅ NEW: Total registered users (from profiles table)
  const [totalRegisteredUsers, setTotalRegisteredUsers] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [filterType, setFilterType] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [refWidth, setRefWidth] = useState(240);
  const [clientWidth, setClientWidth] = useState(240);

  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [refSearch, setRefSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [representativeSearch, setRepresentativeSearch] = useState('');

  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [rechargeRequests, setRechargeRequests] = useState<any[]>([]);

  const [showPartnerPromo, setShowPartnerPromo] = useState(false);
  const [isPartnerUser, setIsPartnerUser] = useState(false);
  const [promoChecked, setPromoChecked] = useState(false);

  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportDefaultIssue, setSupportDefaultIssue] = useState<string | null>(null);

  const openSupportModal = (issueId: string | null = null) => {
    setSupportDefaultIssue(issueId);
    setIsSupportModalOpen(true);
  };

  useEffect(() => {
    const fetchData = async () => {
      const tStart = performance.now();
      try {
        // getSession local hai (fast) — data access RLS se hi protected hai
        let { data: { session } } = await supabase.auth.getSession();
        let user = session?.user || null;
        if (!user) {
          const res = await supabase.auth.getUser();
          user = res.data.user;
        }
        if (!user) return;

        // ✅ Cache turant dikhao (sirf isi user ka) — network ka wait nahi
        const cacheKey = `${CACHE_PREFIX}${user.id}`;
        try {
          const raw = sessionStorage.getItem(cacheKey);
          if (raw) {
            const c = JSON.parse(raw);
            if (Array.isArray(c.list)) {
              if (c.userData) setUserData(c.userData);
              setEstimateList(c.list);
              setTotalRegisteredUsers(c.totalUsers || 0);
              setRechargeRequests(c.recharges || []);
              setDataLoading(false);
            }
          }
        } catch {}

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        const userEmail = user.email || '';
        const roleStr = (profile?.role || '').toLowerCase();
        const secondRoleStr = (profile?.second_role || '').toLowerCase();

        const isAdmin =
          profile?.role === 'admin' ||
          profile?.user_type === 'Admin' ||
          userEmail === 'admin@lnt.com' ||
          roleStr === 'admin';

        const approverRoles = ['admin', 'ceo', 'co-partner', 'co_partner', 'co partner'];
        const isApprover =
          isAdmin ||
          userEmail === 'legalntech@gmail.com' ||
          approverRoles.some((r) => roleStr.includes(r) || secondRoleStr.includes(r));

        // ✅ Header / naam turant dikh jaye
        const nextUserData = {
          email: userEmail,
          id: profile?.user_code || user.id.slice(0, 8),
          uuid: user.id,
          name: profile?.full_name || 'Guest User',
          wallet: Number(profile?.wallet_balance || 0),
          planType: profile?.plan_type || 'BASIC ENGINE PLAN',
          isAdmin, isApprover,
          role: profile?.role || 'user',
          secondRole: profile?.second_role || null,
          approvalStatus: profile?.approval_status || 'PENDING',
          createdAt: profile?.created_at || profile?.created_date || user.created_at,
          state: profile?.state || ''
        };
        setUserData(nextUserData);

        // ✅ Baaki sab queries PARALLEL (pehle ek ke baad ek chalti thi)
        console.log(`[dashboard] auth+profile: ${Math.round(performance.now() - tStart)}ms`);
        const mine = (q: any) => (isAdmin ? q : q.eq('user_id', user!.id));
        const [partnerRes, profilesRes, misRes, estRes, svcRes, rechargeRes] = await Promise.all([
          isAdmin
            ? Promise.resolve({ data: null })
            : supabase.from('partner_profiles').select('partner_id, approval_status').eq('user_id', user.id).maybeSingle(),
          // Saare users ki profiles sirf admin ko chahiye (state mapping + total users)
          isAdmin
            ? supabase.from('profiles').select('id, state, city', { count: 'exact' })
            : Promise.resolve({ data: null, count: null }),
          queryWithFallback('mis_records', MIS_COLS, (q) => mine(q.order('created_date', { ascending: false }))),
          queryWithFallback('estimates', EST_COLS, (q) => mine(q.order('created_at', { ascending: false }))),
          queryWithFallback('service_records', SVC_COLS, (q) => mine(q.order('created_at', { ascending: false }))),
          // Admin ko sirf PENDING recharge requests chahiye
          isAdmin
            ? supabase.from('wallet_recharges').select('*').eq('status', 'PENDING').order('created_at', { ascending: false })
            : supabase.from('wallet_recharges').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        ]);

        // PARTNER PROMO
        try {
          const userIsPartner = !!(partnerRes as any).data;
          setIsPartnerUser(userIsPartner);
          const promoSeen = localStorage.getItem(`partner_promo_seen_${user.id}`);
          const promoClicked = localStorage.getItem(`partner_promo_clicked_${user.id}`);
          const isUserApproved = isAdmin || profile?.approval_status === 'APPROVED';
          const shouldShowPromo = !userIsPartner && !isAdmin && !promoSeen && !promoClicked && isUserApproved;
          if (shouldShowPromo) setTimeout(() => setShowPartnerPromo(true), 1500);
        } catch (err) { console.error(err); }
        setPromoChecked(true);

        // State / city mapping (user_id -> state)
        const profileStateMap = new Map<string, string>();
        const profileCityMap = new Map<string, string>();
        if (isAdmin) {
          const profilesData: any[] = (profilesRes as any).data || [];
          profilesData.forEach((p: any) => {
            if (p.id) {
              profileStateMap.set(p.id, p.state || 'Unknown');
              profileCityMap.set(p.id, p.city || 'Unknown');
            }
          });
          setTotalRegisteredUsers((profilesRes as any).count ?? profilesData.length);
        } else {
          profileStateMap.set(user.id, profile?.state || 'Unknown');
          profileCityMap.set(user.id, profile?.city || 'Unknown');
        }

        /* ---------- MIS_RECORDS (PRIMARY) ---------- */
        if (misRes.error) console.error('MIS fetch error:', misRes.error);
        const misData: any[] = misRes.data || [];
        const misMap = new Map<string, any>();
        misData.forEach((item: any) => { if (item.ref_no) misMap.set(item.ref_no, item); });

        const formattedMIS = misData.map((item: any) => ({
          ...item,
          id: item.id,
          source_table: 'mis_records' as const,
          record_category: 'MIS' as const,
          customer_name: item.customer_name || 'N/A',
          client_name: item.client_name || '',
          representative: item.representative || '',
          case_type: item.case_type || 'NEW CONSTRUCTION',
          fee_standard: Number(item.fee_standard || 0),
          user_payment: Number(item.user_payment || 0),
          status: (item.status || 'PENDING').toUpperCase(),
          created_date: item.created_date || new Date().toISOString(),
          state: profileStateMap.get(item.user_id) || 'Unknown',
          city: profileCityMap.get(item.user_id) || 'Unknown'
        }));

        /* ---------- ESTIMATES (SECONDARY) ---------- */
        if (estRes.error) console.error('Estimates fetch error:', estRes.error);
        const formattedEstimates = ((estRes.data as any[]) || [])
          .filter((item: any) => !item.ref_no || !misMap.has(item.ref_no))
          .map((item: any) => ({
            ...item,
            source_table: 'estimates' as const,
            record_category: 'ESTIMATE' as const,
            customer_name: item.customer_name || 'N/A',
            client_name: item.client_name || item.client || '',
            representative: item.representative || '',
            case_type: item.estimate_type || item.case_type || 'NEW CONSTRUCTION',
            fee_standard: Number(item.fee_standard || 0),
            user_payment: Number(item.user_payment || 0),
            status: (item.status || 'PENDING').toUpperCase(),
            created_date: item.created_at || new Date().toISOString(),
            state: profileStateMap.get(item.user_id) || 'Unknown',
            city: profileCityMap.get(item.user_id) || 'Unknown'
          }));

        /* ---------- SERVICE_RECORDS ---------- */
        if (svcRes.error) console.error('Service fetch error:', svcRes.error);
        const formattedServices = ((svcRes.data as any[]) || []).map((item: any) => {
          let extractedName = item.customer_name;
          if (!extractedName) {
            let buyers = item.buyers;
            if (!buyers && item.form_snapshot) {
              try {
                const snapshot = typeof item.form_snapshot === 'string'
                  ? JSON.parse(item.form_snapshot) : item.form_snapshot;
                buyers = snapshot?.buyers;
              } catch (e) {}
            }
            if (Array.isArray(buyers) && buyers.length > 0) extractedName = buyers[0]?.name;
          }

          return {
            ...item,
            id: item.id || item.ref_no,
            source_table: 'service_records' as const,
            record_category: 'SERVICE' as const,
            customer_name: extractedName || item.client_name || 'N/A',
            client_name: item.client_name || '',
            representative: item.representative || '',
            case_type: item.case_type || (item.deed_type ? `DEED - ${item.deed_type}` : 'DEED_DRAFT'),
            fee_standard: Number(item.fee_standard || 0),
            gateway_fee: Number(item.gateway_fee || 0),
            user_payment: Number(item.user_payment || 0),
            user_service_fee: Number(item.user_service_fee || 0),
            status: (item.status || 'PENDING').toUpperCase(),
            payment_status: (item.payment_status || 'pending').toUpperCase(),
            created_date: item.created_at || new Date().toISOString(),
            state: item.state_name || profileStateMap.get(item.user_id) || 'Unknown',
            city: item.city_district || profileCityMap.get(item.user_id) || 'Unknown'
          };
        });

        const combined = [...formattedMIS, ...formattedEstimates, ...formattedServices];
        combined.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());

        console.log(`[dashboard] TOTAL load: ${Math.round(performance.now() - tStart)}ms`);
        setEstimateList(combined);
        if (rechargeRes.data) setRechargeRequests(rechargeRes.data);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            userData: nextUserData,
            list: combined,
            totalUsers: isAdmin ? ((profilesRes as any).count ?? 0) : 0,
            recharges: rechargeRes.data || [],
          }));
        } catch {} // storage full ho to ignore
      } catch (err) {
        console.error('[dashboard] load error:', err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, []);

  const fetchRecharges = async (userId: string, isAdmin: boolean) => {
    let q = supabase.from('wallet_recharges').select('*').order('created_at', { ascending: false });
    q = isAdmin ? q.eq('status', 'PENDING') : q.eq('user_id', userId);
    const { data } = await q;
    if (data) setRechargeRequests(data);
  };

  const currentDate = new Date();
  const targetLockDate = new Date('2026-08-20T00:00:00');
  const isAfterLockDate = currentDate > targetLockDate;

  const accountCreationDate = new Date(userData.createdAt || Date.now());
  const daysSinceCreation = (currentDate.getTime() - accountCreationDate.getTime()) / (1000 * 3600 * 24);
  const isWithinGracePeriod = daysSinceCreation <= 21;

  const isWalletLow = userData.wallet < 100;
  const isPremiumUser = (userData.planType || '').toUpperCase().includes('PREMIUM');
  const isFirstDateOfMonth = currentDate.getDate() === 1;

  const isAccountLocked =
    !userData.isAdmin && !isPremiumUser && !isWithinGracePeriod &&
    isAfterLockDate && isWalletLow;

  const showLowWalletWarning =
    !userData.isAdmin && !isPremiumUser && !isWithinGracePeriod && isWalletLow;
  const showPremiumBillClearAlert = isPremiumUser && isFirstDateOfMonth;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = refWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentWidth = startWidth + (moveEvent.clientX - startX);
      if (currentWidth > 120) setRefWidth(currentWidth);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleClientMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = clientWidth;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentWidth = startWidth + (moveEvent.clientX - startX);
      if (currentWidth > 120) setClientWidth(currentWidth);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Dedupe (memo — har render par dobara nahi chalta)
  const deduplicatedList = useMemo(() => {
    const seen: Record<string, any> = {};
    const priority = { mis_records: 3, estimates: 2, service_records: 1 };
    estimateList.forEach((item) => {
      const key = item.ref_no || `${item.source_table}-${item.id}`;
      const currentPriority = priority[item.source_table as keyof typeof priority] || 0;
      const existingPriority = seen[key]
        ? (priority[seen[key].source_table as keyof typeof priority] || 0)
        : -1;
      if (!seen[key] || currentPriority > existingPriority) seen[key] = item;
    });
    return Object.values(seen);
  }, [estimateList]);

  const { totalValue, receivedAmount, pendingAmount } = useMemo(() => {
    let total = 0, received = 0;
    deduplicatedList.forEach((i: any) => {
      const fee = Number(i.fee_standard || 0);
      total += fee;
      const st = (i.status || '').toUpperCase();
      if (st === 'RECEIVED' || st === 'PAID' || st === 'COMPLETED') received += fee;
    });
    return { totalValue: total, receivedAmount: received, pendingAmount: total - received };
  }, [deduplicatedList]);

  // ✅ Analytics filtered data (with product filter)
  const filteredAnalyticsData = useMemo(() => {
    return deduplicatedList.filter((row: any) => {
      const d = new Date(row.created_date);
      const rowMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const rowFY = m >= 4 ? `FY${y}-${String(y + 1).slice(-2)}` : `FY${y - 1}-${String(y).slice(-2)}`;

      if (analyticsFY !== 'ALL' && rowFY !== analyticsFY) return false;
      if (analyticsMonth !== 'ALL' && rowMonth !== analyticsMonth) return false;
      if (analyticsState !== 'ALL' && (row.state || 'Unknown') !== analyticsState) return false;
      if (analyticsProduct !== 'ALL' && (row.case_type || 'NEW CONSTRUCTION') !== analyticsProduct) return false;
      return true;
    });
  }, [deduplicatedList, analyticsFY, analyticsMonth, analyticsState, analyticsProduct]);

  const filteredList = useMemo(() => deduplicatedList.filter((item) => {
    const currentStatus = (item.status || 'PENDING').toUpperCase();
    const isPaidStatus = currentStatus === 'RECEIVED' || currentStatus === 'PAID' || currentStatus === 'COMPLETED';

    if (filterType === 'Paid' && !isPaidStatus) return false;
    if (filterType === 'Pending' && isPaidStatus) return false;

    const itemRef = (item.ref_no || '').toLowerCase();
    if (refSearch && !itemRef.includes(refSearch.toLowerCase())) return false;

    const itemClient = (item.client || item.client_name || '').toLowerCase();
    if (clientSearch && !itemClient.includes(clientSearch.toLowerCase())) return false;

    const itemRep = (item.representative || item.rep_name || '').toLowerCase();
    if (representativeSearch && !itemRep.includes(representativeSearch.toLowerCase())) return false;

    return true;
  }), [deduplicatedList, filterType, refSearch, clientSearch, representativeSearch]);

  // ✅ Filter badalne par list wapas pehle 100 rows par
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filterType, refSearch, clientSearch, representativeSearch]);
  const visibleRows = useMemo(() => filteredList.slice(0, visibleCount), [filteredList, visibleCount]);
  const openHistory = useCallback((est: any) => { setSelectedTxn(est); setIsModalOpen(true); }, []);

  const isPendingApproval = !userData.isAdmin && userData.approvalStatus === 'PENDING';
  const isRejected = !userData.isAdmin && userData.approvalStatus === 'REJECTED';
  const isApproved = userData.isAdmin || userData.approvalStatus === 'APPROVED';

  const getInitials = (name: string) => {
    if (!name || name === 'Loading...' || name === 'Guest User') return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 p-2 sm:p-4">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white px-3 py-2.5 sm:p-4 rounded-xl shadow-sm border border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { setShowMenuDrawer(true); setShowProfile(false); setShowNotifications(false); }}
            className="text-slate-800 hover:text-blue-600 focus:outline-none cursor-pointer p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          {userData.isAdmin ? (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setAdminView('dashboard')}
                className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  adminView === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </button>
              <button
                onClick={() => setAdminView('analytics')}
                className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  adminView === 'analytics'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Revenue Analytics</span>
                <span className="sm:hidden">Revenue</span>
              </button>
            </div>
          ) : (
            <h1 className="text-xs sm:text-xl font-black text-slate-800 uppercase tracking-tight">
              LNT DASHBOARD
            </h1>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {userData.isApprover && <ApprovalNotificationBell />}

          <div className="relative">
            <button
              onClick={async () => {
                setShowNotifications(!showNotifications);
                setShowMenuDrawer(false);
                setShowProfile(false);
                if (!('Notification' in window)) return;
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                  new Notification('L&T Consultant Services', { body: 'Notifications enabled.', icon: '/favicon.ico' });
                }
              }}
              className="relative p-2 sm:p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition shadow-sm border border-slate-200 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-600 rounded-full ring-2 ring-white"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-72 sm:w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden">
                <div className="bg-slate-900 p-3 text-white flex justify-between items-center">
                  <span className="font-bold text-xs uppercase tracking-wider">Notifications</span>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer">&times;</button>
                </div>
                <div className="p-3 sm:p-4 space-y-2 bg-slate-50/50 max-h-[60vh] overflow-y-auto">
                  {showLowWalletWarning && (
                    <div className="bg-red-50 p-3 rounded-xl border border-red-200 shadow-sm space-y-2">
                      <p className="font-bold text-xs text-red-600">Low Wallet Balance Alert</p>
                      <p className="text-xs text-slate-600">Balance: <b className="text-red-600">₹{userData.wallet.toFixed(2)}</b></p>
                      {isApproved && (
                        <button onClick={() => { setShowNotifications(false); setIsRechargeModalOpen(true); }} className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-1.5 rounded-lg text-[10px] uppercase cursor-pointer">
                          Recharge Now
                        </button>
                      )}
                    </div>
                  )}
                  {isPendingApproval && (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-sm">
                      <p className="font-bold text-xs text-amber-800">Account Pending Approval</p>
                    </div>
                  )}
                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <p className="font-bold text-xs text-blue-600">Welcome to L&T Consultant Services</p>
                    <p className="text-xs text-slate-600">24/7 sale estimate & map drafting.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => openSupportModal(null)} className="flex items-center gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-3 sm:py-2 rounded-full bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-sm border border-slate-200 cursor-pointer group shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 group-hover:text-emerald-600 transition-colors shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
            </svg>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide">Help</span>
            <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-full w-full bg-emerald-500"></span>
            </span>
          </button>

          <div className="relative">
            <button
              onClick={() => { setShowProfile(!showProfile); setShowMenuDrawer(false); setShowNotifications(false); }}
              className="flex items-center gap-1.5 sm:gap-2 p-1.5 pr-2 sm:pr-2.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-sm shrink-0">
                {getInitials(userData.name)}
              </div>
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="text-[11px] font-extrabold text-slate-800 uppercase leading-tight max-w-[100px] truncate">
                  {userData.name.split(' ')[0]}
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase leading-tight">
                  {userData.isAdmin ? 'Admin' : userData.role}
                </span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`hidden sm:block w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${showProfile ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {showProfile && (
              <div className="absolute right-0 mt-3 w-72 sm:w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
                      {getInitials(userData.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-sm uppercase tracking-wide truncate">{userData.name}</p>
                      <p className="text-[11px] text-slate-300 truncate">{userData.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/20 border border-blue-400/30 rounded text-[9px] font-bold uppercase tracking-wider text-blue-300">
                        {userData.isAdmin ? 'Administrator' : userData.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
                  <div className="space-y-3 pb-4 border-b border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-500">SYSTEM ID</span>
                      <span className="font-bold text-slate-900">{userData?.id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-500">APPROVAL STATUS</span>
                      <span className={`font-extrabold uppercase ${isApproved ? 'text-emerald-600' : isRejected ? 'text-rose-600' : 'text-amber-600'}`}>
                        {userData.isAdmin ? 'ADMIN' : userData.approvalStatus}
                      </span>
                    </div>
                    {userData.state && (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold uppercase text-slate-500">STATE</span>
                        <span className="font-bold text-slate-900">{userData.state}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs">
                    <span className="font-bold uppercase text-slate-700">PLAN TYPE</span>
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-md font-extrabold tracking-wide text-[10px] uppercase">
                      {userData?.planType}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">WALLET AMOUNT</p>
                      <p className={`text-base sm:text-lg font-black ${userData.wallet < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {userData.wallet < 0 ? `- ₹ ${Math.abs(userData.wallet).toFixed(2)}` : `₹ ${userData?.wallet?.toFixed(2) || '0.00'}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setShowProfile(false); router.push('/wallet-ledger'); }} className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] px-2.5 py-2 rounded-lg transition uppercase tracking-wider cursor-pointer">
                        Ledger
                      </button>
                      <button onClick={() => { setShowProfile(false); setIsRechargeModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] px-3 py-2 rounded-lg transition shadow-md uppercase tracking-wider cursor-pointer">
                        Recharge
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs font-bold">
                    <button onClick={() => router.push('/edit-profile')} className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition uppercase cursor-pointer">
                      <span>EDIT PROFILE</span>
                    </button>
                    <button onClick={() => { setShowProfile(false); openSupportModal(null); }} className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-emerald-700 transition uppercase cursor-pointer">
                      <span>CONTACT SUPPORT</span>
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await supabase.from('profiles').update({ is_online: false }).eq('id', userData.uuid);
                          clearDashCache(); await supabase.auth.signOut();
                          router.push('/verify-estimate');
                        } catch (err: any) { alert('Logout failed: ' + (err.message || err)); }
                      }}
                      className="w-full flex items-center p-2.5 rounded-xl hover:bg-red-50 text-red-600 transition mt-1 uppercase cursor-pointer"
                    >
                      <span>LOGOUT</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-hidden flex flex-col mt-2 sm:mt-4 min-h-0">
        {/* ✅ SCROLLABLE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 flex flex-col gap-2 sm:gap-4">
          {isPendingApproval && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 sm:p-5 rounded-xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl">⏳</span>
                <div>
                  <h4 className="font-black text-sm sm:text-base uppercase tracking-wide">Account Pending Approval</h4>
                  <p className="text-[11px] sm:text-xs opacity-95 mt-1 leading-relaxed">Under verification.</p>
                </div>
              </div>
              <button onClick={() => openSupportModal('approval')} className="bg-white text-amber-700 font-black px-4 py-2 rounded-lg text-[11px] uppercase shadow-md hover:bg-amber-50 transition whitespace-nowrap cursor-pointer w-full sm:w-auto">
                Contact Admin
              </button>
            </div>
          )}

          {isRejected && (
            <div className="bg-gradient-to-r from-rose-600 to-red-600 text-white p-4 sm:p-5 rounded-xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl">❌</span>
                <div>
                  <h4 className="font-black text-sm sm:text-base uppercase tracking-wide">Account Rejected</h4>
                </div>
              </div>
              <button onClick={() => openSupportModal('approval')} className="bg-white text-rose-700 font-black px-4 py-2 rounded-lg text-[11px] uppercase shadow-md hover:bg-rose-50 transition whitespace-nowrap cursor-pointer">
                Contact Support
              </button>
            </div>
          )}

          {showPremiumBillClearAlert && (
            <div className="bg-blue-900 text-white p-3 sm:px-5 sm:py-4 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📋</span>
                <div>
                  <h4 className="font-extrabold text-[11px] sm:text-sm uppercase tracking-wide">Monthly Bill Clearance Reminder</h4>
                  <p className="text-[10px] sm:text-xs opacity-95 mt-0.5">Your monthly statement is ready.</p>
                </div>
              </div>
              <button onClick={() => router.push('/billing-ledger')} className="w-full sm:w-auto bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-lg text-[11px] uppercase shadow hover:bg-amber-300 transition whitespace-nowrap cursor-pointer">
                View Bill
              </button>
            </div>
          )}

          {showLowWalletWarning && (
            <div className="bg-rose-600 text-white p-3 sm:px-5 sm:py-4 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="font-extrabold text-[11px] sm:text-sm uppercase tracking-wide">Low Wallet Balance</h4>
                  <p className="text-[10px] sm:text-xs opacity-95 mt-0.5">Balance: <strong className="underline">₹{userData.wallet.toFixed(2)}</strong></p>
                </div>
              </div>
              <button onClick={() => setIsRechargeModalOpen(true)} className="w-full sm:w-auto bg-white text-rose-600 font-black px-4 py-2 rounded-lg text-[11px] uppercase shadow hover:bg-rose-50 transition whitespace-nowrap cursor-pointer">
                Recharge Now
              </button>
            </div>
          )}

          {userData.isAdmin && adminView === 'analytics' && (
            <div className="flex justify-end">
              <button
                onClick={() => alert('Review request will be sent to CEO/Co-Partner')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider shadow-md shadow-emerald-500/20 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Send for Review
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              DASHBOARD VIEW
              ═══════════════════════════════════════════════════════ */}
          {adminView === 'dashboard' && (
            <>
              {/* ✅ Recharge approval — sabse upar, sirf jab koi PENDING request ho */}
              {userData.isAdmin && rechargeRequests.length > 0 && (
                <AdminRechargeApproval
                  isAdmin={userData.isAdmin}
                  rechargeRequests={rechargeRequests}
                  onRefresh={() => fetchRecharges(userData.uuid, userData.isAdmin)}
                />
              )}

              {userData.isApprover && (
                <AdminPartnerApproval
                  isAdmin={userData.isAdmin}
                  isApprover={userData.isApprover}
                  userData={userData}
                />
              )}

              {/* ✅ Simple summary table + filter options (ek hi jagah, kam space) */}
              <div className="shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-300 text-[10px] sm:text-xs uppercase tracking-wider">
                      <th className="py-2 font-bold">Total</th>
                      <th className="py-2 font-bold">Received</th>
                      <th className="py-2 font-bold">Pending</th>
                      <th className="py-2 font-bold">Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-sm sm:text-xl font-black">
                      <td className="py-2 text-slate-800">{dataLoading ? '…' : `₹${totalValue.toLocaleString()}`}</td>
                      <td className="py-2 text-green-600">{dataLoading ? '…' : `₹${receivedAmount.toLocaleString()}`}</td>
                      <td className="py-2 text-red-600">{dataLoading ? '…' : `₹${pendingAmount.toLocaleString()}`}</td>
                      <td className="py-2 text-blue-600">{dataLoading ? '…' : deduplicatedList.length}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex items-center justify-between gap-2 p-2 border-t border-slate-200 bg-slate-50">
                  <div className="flex gap-1.5 overflow-x-auto">
                    {['All', 'Paid', 'Pending'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setFilterType(type as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition shrink-0 cursor-pointer ${
                          filterType === type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => router.push('/wallet-ledger')}
                    disabled={!isApproved}
                    title={isApproved ? 'Wallet & Ledger Passbook' : 'Ledger locked pending approval'}
                    className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-1.5 rounded-lg transition cursor-pointer shrink-0"
                  >
                    Ledger
                  </button>
                </div>
              </div>

          <div className="flex-1 min-h-[320px] overflow-auto bg-white rounded-xl shadow-sm border border-slate-200">
            <table className="w-full text-left border-collapse table-fixed min-w-[1250px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider text-center select-none">
                  <th style={{ width: `${refWidth}px` }} className="p-2 text-center relative group">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="px-1 text-[10px] font-bold text-slate-300">REF NO</span>
                      <input type="text" placeholder="Filter..." value={refSearch} onChange={(e) => setRefSearch(e.target.value)} className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-white text-center focus:outline-none focus:border-blue-400 font-normal placeholder:text-slate-500" />
                    </div>
                    <div onMouseDown={handleMouseDown} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent group-hover:bg-blue-500 cursor-col-resize transition-colors z-10" />
                  </th>
                  <th className="p-3 font-semibold w-24 text-center">DATE</th>
                  <th className="p-3 font-semibold w-52 text-center">CUSTOMER NAME</th>
                  <th style={{ width: `${clientWidth}px` }} className="p-2 text-center relative group">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="px-1 text-[10px] font-bold text-slate-300">CLIENT</span>
                      <input type="text" placeholder="Filter..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-white text-center focus:outline-none focus:border-blue-400 font-normal placeholder:text-slate-500" />
                    </div>
                    <div onMouseDown={handleClientMouseDown} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent group-hover:bg-blue-500 cursor-col-resize transition-colors z-10" />
                  </th>
                  <th className="p-2 w-48 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <span className="px-1 text-[10px] font-bold text-slate-300">REPRESENTATIVE</span>
                      <input type="text" placeholder="Filter..." value={representativeSearch} onChange={(e) => setRepresentativeSearch(e.target.value)} className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-white text-center focus:outline-none focus:border-blue-400 font-normal placeholder:text-slate-500" />
                    </div>
                  </th>
                  <th className="p-3 font-semibold w-48 text-center">CASE TYPE</th>
                  <th className="p-3 font-semibold w-28 text-center">FEE STANDARD</th>
                  <th className="p-3 font-semibold w-28 text-center">STATUS</th>
                  <th className="p-3 font-semibold w-36 text-center">TRANSACTION</th>
                </tr>
              </thead>
              <tbody>
                {dataLoading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-t">
                    <td colSpan={9} className="p-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  </tr>
                ))}
                {!dataLoading && visibleRows.map((est) => (
                  <TxnRow key={`${est.source_table}-${est.id || est.ref_no}`} est={est} onHistory={openHistory} />
                ))}
                {!dataLoading && filteredList.length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-xs text-slate-400 font-bold uppercase">No records found</td></tr>
                )}
              </tbody>
            </table>
            {!dataLoading && filteredList.length > visibleCount && (
              <div className="p-3 text-center border-t bg-slate-50">
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold px-4 py-2 rounded-lg uppercase tracking-wide cursor-pointer"
                >
                  Show more ({filteredList.length - visibleCount} baaki)
                </button>
              </div>
            )}
          </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════
              ✅ ANALYTICS VIEW — REAL COMPONENTS
              ═══════════════════════════════════════════════════════ */}
          {adminView === 'analytics' && (
            <div className="space-y-5">
              {/* Filters */}
              <AnalyticsHeader
                data={deduplicatedList}
                selectedFY={analyticsFY}
                setSelectedFY={setAnalyticsFY}
                selectedMonth={analyticsMonth}
                setSelectedMonth={setAnalyticsMonth}
                selectedState={analyticsState}
                setSelectedState={setAnalyticsState}
                selectedProduct={analyticsProduct}
                setSelectedProduct={setAnalyticsProduct}
              />

                            {/* KPI Cards */}
              <KpiCards
                data={filteredAnalyticsData}
                previousPeriodData={deduplicatedList}
                totalUsers={totalRegisteredUsers}
              />

              {/* Sales Trend */}
              <SalesTrendChart data={filteredAnalyticsData} />

              {/* 2 Column Grid — State + Product */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <StateWiseHeatmap data={filteredAnalyticsData} />
                <ProductWiseBreakdown data={filteredAnalyticsData} />
              </div>

              {/* FY Comparison */}
              <FyComparisonChart data={filteredAnalyticsData} />
            </div>
          )}
        </div>

      </div>

      {/* Overlays + Drawer + Modals */}
      {isPendingApproval && (
        <div className="absolute inset-x-3 sm:inset-x-6 top-40 z-40 bg-slate-900/95 text-white p-6 sm:p-8 rounded-3xl shadow-2xl border-2 border-amber-500 text-center space-y-4 backdrop-blur-md">
          <span className="text-4xl">⏳</span>
          <h3 className="text-lg sm:text-xl font-black uppercase text-amber-400 tracking-wider">Dashboard Locked — Approval Pending</h3>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={() => openSupportModal('approval')} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg transition cursor-pointer">
              Contact Admin
            </button>
            <button onClick={async () => { clearDashCache(); await supabase.auth.signOut(); router.push('/login'); }} className="bg-slate-700 hover:bg-slate-600 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg transition cursor-pointer">
              Logout
            </button>
          </div>
        </div>
      )}

      {isAccountLocked && !isPendingApproval && (
        <div className="absolute inset-x-3 sm:inset-x-6 top-32 z-40 bg-slate-900/95 text-white p-6 sm:p-8 rounded-3xl shadow-2xl border-2 border-rose-500 text-center space-y-4 backdrop-blur-md">
          <span className="text-4xl">🔒</span>
          <h3 className="text-lg sm:text-xl font-black uppercase text-rose-500 tracking-wider">Dashboard Locked — Recharge Required</h3>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={() => setIsRechargeModalOpen(true)} className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg transition cursor-pointer">
              Recharge Wallet
            </button>
          </div>
        </div>
      )}

      {showMenuDrawer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-start">
          <div className="bg-white w-80 h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-200">
            <div>
              <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">☰</span>
                  <span className="font-black text-sm uppercase tracking-wider">LNT NAVIGATION MENU</span>
                </div>
                <button onClick={() => setShowMenuDrawer(false)} className="text-slate-400 hover:text-white font-bold text-xl cursor-pointer p-1">&times;</button>
              </div>
              <div className="p-4 space-y-2 text-xs font-bold text-slate-700 overflow-y-auto max-h-[calc(100vh-140px)]">
                <button onClick={() => { setShowMenuDrawer(false); router.push('/dashboard'); }} className="w-full text-left p-3 rounded-xl hover:bg-slate-100 transition flex items-center gap-3 uppercase cursor-pointer text-blue-600 bg-blue-50">
                  <span>🏠 Dashboard Home</span>
                </button>
                <button onClick={() => { setShowMenuDrawer(false); router.push('/wallet-ledger'); }} className="w-full text-left p-3 rounded-xl hover:bg-slate-100 transition flex items-center gap-3 uppercase cursor-pointer">
                  <span>Passbook & Wallet Ledger</span>
                </button>
                <button onClick={() => { setShowMenuDrawer(false); setIsRechargeModalOpen(true); }} className="w-full text-left p-3 rounded-xl hover:bg-slate-100 transition flex items-center gap-3 uppercase cursor-pointer text-emerald-600">
                  <span>💳 Recharge Wallet</span>
                </button>
                <button onClick={() => { setShowMenuDrawer(false); router.push('/edit-profile'); }} className="w-full text-left p-3 rounded-xl hover:bg-slate-100 transition flex items-center gap-3 uppercase cursor-pointer">
                  <span>⚙️ Edit Profile</span>
                </button>
                <button onClick={() => { setShowMenuDrawer(false); openSupportModal(null); }} className="w-full text-left p-3 rounded-xl hover:bg-emerald-50 bg-emerald-50/50 text-emerald-700 transition flex items-center gap-3 uppercase cursor-pointer border border-emerald-200">
                  <span>💬 Contact Support Team</span>
                </button>

                {[
                  { label: '📝 Deed Drafting', path: '/deed-drafting' },
                  { label: '🏗️ Construction Plan / Map', path: '/construction-plan' },
                  { label: '📊 Estimate (New / Renovation)', path: '/estimate' },
                  { label: '📁 Document Management', path: '/document-management' },
                ].map((item) => {
                  const isLocked = isPendingApproval || (!userData.isAdmin && !isPremiumUser && isWalletLow);
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        if (isPendingApproval) { alert('Pending approval.'); return; }
                        if (!userData.isAdmin && !isPremiumUser && isWalletLow) {
                          alert('Wallet below ₹100.'); router.push('/wallet-ledger'); setShowMenuDrawer(false); return;
                        }
                        setShowMenuDrawer(false); router.push(item.path);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition flex items-center gap-3 uppercase cursor-pointer ${isLocked ? 'opacity-40 text-slate-400' : 'hover:bg-slate-100 text-slate-700'}`}
                    >
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={async () => { try { clearDashCache(); await supabase.auth.signOut(); router.push('/verify-estimate'); } catch { alert('Logout failed'); } }}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-sm"
              >
                Logout Session
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setShowMenuDrawer(false)}></div>
        </div>
      )}

      {isRechargeModalOpen && (
        <RechargeModal
          isOpen={isRechargeModalOpen}
          onClose={() => setIsRechargeModalOpen(false)}
          userData={userData}
          onRechargeSubmitted={() => fetchRecharges(userData.uuid, userData.isAdmin)}
        />
      )}

      {isModalOpen && selectedTxn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-md border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Transaction History</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">&times;</button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Source Table:</span>
                <span className="font-bold text-purple-600 uppercase">{selectedTxn.source_table}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Reference No:</span>
                <span className="font-bold text-blue-600">{selectedTxn.ref_no}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Customer Name:</span>
                <span className="font-bold text-slate-800 uppercase">{selectedTxn.customer_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Case Type:</span>
                <span className="font-bold text-slate-900 uppercase">{selectedTxn.case_type || 'NEW CONSTRUCTION'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Fee Standard:</span>
                <span className="font-bold text-slate-800">₹{Number(selectedTxn.fee_standard || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Amount Paid:</span>
                <span className="font-extrabold text-emerald-600 text-sm">
                  ₹{Number(selectedTxn.gateway_fee || selectedTxn.user_payment || selectedTxn.user_service_fee || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Payment ID:</span>
                <span className="font-mono font-semibold text-slate-800">{selectedTxn.razorpay_payment_id || 'WALLET DEDUCTION'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 font-medium">Date & Time:</span>
                <span className="font-semibold text-slate-700">
                  {new Date(selectedTxn.created_at || selectedTxn.created_date || Date.now()).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            <div className="pt-2">
              <button onClick={() => setIsModalOpen(false)} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-xl text-xs transition uppercase cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showPartnerPromo && !isPartnerUser && promoChecked && (
        <PartnerNetworkPromoModal
          isOpen={showPartnerPromo}
          onClose={() => setShowPartnerPromo(false)}
          userId={userData.uuid}
          userName={userData.name !== 'Loading...' ? userData.name : undefined}
        />
      )}

      {isSupportModalOpen && (
        <CorporateSupportModal
          isOpen={isSupportModalOpen}
          onClose={() => { setIsSupportModalOpen(false); setSupportDefaultIssue(null); }}
          userData={userData}
          defaultIssue={supportDefaultIssue}
        />
      )}

      <div className="text-[10px] sm:text-xs text-gray-400 text-center shrink-0 py-2">
        © 2026 LNT WITH AI 2.0 RIGHTS RESERVED
      </div>
    </div>
  );
}