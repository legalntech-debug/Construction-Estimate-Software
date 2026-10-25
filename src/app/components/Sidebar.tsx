'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Banknote, Users, ShieldCheck, X, AlertTriangle } from "lucide-react";
import { createBrowserClient } from '@supabase/ssr';
import { usePathname, useRouter } from 'next/navigation';

interface SidebarProps {
  onClose?: () => void;
}

// ════════════════════════════════════════════════════════════════
// 🔹 Constants
// ════════════════════════════════════════════════════════════════
const MIN_RECHARGE = 100; // Platform ka recharge minimum

const SERVICE_CASE_TYPE_MAP: Record<string, string> = {
  '/construction-plan':         'map',
  '/route-map':                 'locationPlan',
  '/subdivision-plan':          'map',
  '/estimate':                  'estimate',
  '/renovation-estimate':       'estimate',
  '/extension-estimate':        'estimate',
  '/remaining-work-estimate':   'estimate',
  '/construction-certificate':  'constructionCertificate',
  '/deed-drafting':             'drafting',
  '/valuation-assessment':      'map',
  '/mis':                       'mis',
  '/reopen-old-case':           'reopen',
  '/document-management':       'documentManagement',
  '/client-registration':       'clientRegistration',
  '/client-data':               'clientData',
};

const SERVICE_LABELS: Record<string, string> = {
  '/construction-plan':         'Construction Plan',
  '/route-map':                 'Location / Key Plan',
  '/subdivision-plan':          'Subdivision Plan',
  '/estimate':                  'New Construction Estimate',
  '/renovation-estimate':       'Renovation Estimate',
  '/extension-estimate':        'Renovation + Extension Estimate',
  '/remaining-work-estimate':   'Remaining Work Estimate',
  '/construction-certificate':  'Construction Certificate',
  '/deed-drafting':             'Deed Drafting',
  '/valuation-assessment':      'Valuation Assessment',
  '/mis':                       'MIS Reports',
  '/reopen-old-case':           'Reopen Old Case',
  '/document-management':       'Document Management',
  '/client-registration':       'Client Registration',
  '/client-data':               'Client Data',
};

const FALLBACK_MIN_CHARGES: Record<string, number> = {
  '/mis':             36,
  '/reopen-old-case': 36,
};

// Routes that must stay reachable regardless of wallet balance.
// Reopening an existing case is free to open; the balance check is
// enforced later, on the service input page, for chargeable actions only.
const WALLET_CHECK_EXEMPT_ROUTES: string[] = ['/reopen-old-case'];

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showEstimate, setShowEstimate] = useState(false);
  const [showClient, setShowClient] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEligibleForAccessControl, setIsEligibleForAccessControl] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("BASIC PLAN");
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [userState, setUserState] = useState<string>("MADHYA PRADESH");

  const [warning, setWarning] = useState<{
    open: boolean;
    service: string;
    required: number;
  } | null>(null);

  const chargeCacheRef = useRef<Record<string, number>>({});

  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    setMounted(true);

    const checkUserSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return;

      let userIsAdmin = false;

      const { data: roleData } = await supabaseClient.rpc('get_user_role', {
        target_user_id: session.user.id,
      });
      if (
        roleData?.toLowerCase() === 'admin' ||
        session.user.email === 'legalntech@gmail.com'
      ) {
        userIsAdmin = true;
      }

      const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('plan_type, wallet_balance, role, state')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileData) {
        if (profileData.plan_type) setUserPlan(profileData.plan_type);
        if (profileData.wallet_balance !== null && profileData.wallet_balance !== undefined) {
          setWalletBalance(Number(profileData.wallet_balance));
        }
        if (profileData.role === 'admin') userIsAdmin = true;
        if (profileData.state) setUserState(profileData.state.toUpperCase());
      }

      setIsAdmin(userIsAdmin);

      const { data: partnerData } = await supabaseClient
        .from('partners')
        .select('second_role, status')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle();

      const allowedPartnerRoles = ['ceo', 'co-partner', 'co-owner', 'marketing & support', 'investor'];
      const userPartnerRole = partnerData?.second_role?.toLowerCase() || '';

      const showAccessControl =
        userIsAdmin || (partnerData && allowedPartnerRoles.includes(userPartnerRole));
      setIsEligibleForAccessControl(!!showAccessControl);
    };

    checkUserSession();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        checkUserSession();
      } else {
        setIsAdmin(false);
        setIsEligibleForAccessControl(false);
        chargeCacheRef.current = {};
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!mounted) {
    return <div className="bg-blue-950 text-white w-72 h-screen no-print shrink-0"></div>;
  }

  const isPremium = userPlan.toUpperCase().includes('PREMIUM');
  const ledgerLabel = isPremium ? 'Billing & Account Ledger' : 'Account Ledger';

  const getChargeForRoute = async (href: string): Promise<number> => {
    if (chargeCacheRef.current[href] !== undefined) {
      return chargeCacheRef.current[href];
    }

    const caseType = SERVICE_CASE_TYPE_MAP[href];
    const fallback = FALLBACK_MIN_CHARGES[href] ?? 0;

    if (!caseType) {
      chargeCacheRef.current[href] = fallback;
      return fallback;
    }

    try {
      const stateCandidates = Array.from(new Set([userState, 'DEFAULT']));

      for (const stateName of stateCandidates) {
        const { data, error } = await supabaseClient
          .from('pricing_config')
          .select('price, mrp, active')
          .eq('case_type', caseType)
          .eq('state_name', stateName)
          .eq('active', true)
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const price = Number(data.price ?? data.mrp ?? 0);
          chargeCacheRef.current[href] = price;
          return price;
        }
      }

      chargeCacheRef.current[href] = fallback;
      return fallback;
    } catch (e) {
      console.warn('[Sidebar] pricing fetch threw:', e);
      chargeCacheRef.current[href] = fallback;
      return fallback;
    }
  };

  const handleNav = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (isAdmin || isPremium || WALLET_CHECK_EXEMPT_ROUTES.includes(href)) {
      onClose?.();
      return;
    }

    e.preventDefault();

    try {
      const required = await getChargeForRoute(href);

      if (!required || required <= 0) {
        onClose?.();
        router.push(href);
        return;
      }

      if (walletBalance >= required) {
        onClose?.();
        router.push(href);
        return;
      }

      const label = SERVICE_LABELS[href] || href.replace('/', '').replace(/-/g, ' ');
      setWarning({ open: true, service: label, required });
    } catch (err) {
      console.warn('[Sidebar] nav check failed:', err);
      onClose?.();
      router.push(href);
    }
  };

  const handleRecharge = () => {
    setWarning(null);
    onClose?.();
    router.push('/wallet-ledger?recharge=1');
  };

  // ════════════════════════════════════════════════════════════════
  // 🔹 Modal ke liye values — teen cheezein alag-alag dikhao
  // ════════════════════════════════════════════════════════════════
  const serviceCharge = warning?.required ?? 0;                       // Actual service price
  const rechargeMin = MIN_RECHARGE;                                    // Platform minimum
  const topUpNeeded = Math.max(MIN_RECHARGE, serviceCharge);           // At least this much
  const shortfall = warning ? Math.max(0, topUpNeeded - walletBalance) : 0;

  return (
    <>
      <div
        className={`
          flex flex-col
          bg-blue-950 text-white transition-all duration-300 h-full z-50 no-print
          shrink-0 overflow-y-auto overflow-x-hidden custom-scrollbar
          ${collapsed ? 'w-16' : 'w-72'}
        `}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-3 border-b border-blue-800 shrink-0">
          {!collapsed && (
            <h1 className="font-extrabold text-sm tracking-wide text-white whitespace-nowrap">
              LNT WITH AI 2.0
            </h1>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {onClose && (
              <button
                onClick={onClose}
                className="md:hidden bg-blue-800 p-1.5 rounded text-white hover:bg-blue-700 transition-colors cursor-pointer"
                title="Close Menu"
              >
                <X size={18} />
              </button>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:block bg-blue-800 px-2 py-1 rounded text-xs text-white hover:bg-blue-700 transition-colors cursor-pointer"
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? '☰' : '◀'}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 text-sm font-bold uppercase flex-1">

          {/* DASHBOARD */}
          <Link
            href="/dashboard"
            onClick={(e) => {
              if (!isAdmin && !isPremium) e.preventDefault();
              onClose?.();
              if (!isAdmin && !isPremium) router.push('/dashboard');
            }}
            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
              pathname === '/dashboard'
                ? 'bg-blue-600 text-white'
                : 'text-white bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <LayoutDashboard size={18} className="shrink-0" />
            {!collapsed && <span>DASHBOARD</span>}
          </Link>

          {/* PLAN */}
          <div>
            <button
              onClick={() => setShowPlan(!showPlan)}
              className="w-full text-left px-4 py-2 hover:bg-blue-800 flex justify-between items-center rounded cursor-pointer"
            >
              <span>🏗 {!collapsed && 'PLAN'}</span>
            </button>
            {!collapsed && showPlan && (
              <div className="ml-8 space-y-0.5 mb-1 text-xs">
                <Link href="/construction-plan" onClick={(e) => handleNav(e, '/construction-plan')} className="block py-1 hover:text-blue-300">
                  🏗 Construction Plan
                </Link>
                <Link href="/route-map" onClick={(e) => handleNav(e, '/route-map')} className="block py-1 hover:text-blue-300">
                  📍 Location / Key Plan
                </Link>
                <Link href="/subdivision-plan" onClick={(e) => handleNav(e, '/subdivision-plan')} className="block py-1 hover:text-blue-300">
                  📍 Subdivision Plan
                </Link>
              </div>
            )}
          </div>

          {/* ESTIMATE TYPE */}
          <div>
            <button
              onClick={() => setShowEstimate(!showEstimate)}
              className="w-full text-left px-4 py-2 hover:bg-blue-800 flex justify-between items-center rounded cursor-pointer"
            >
              <span>📋 {!collapsed && 'ESTIMATE TYPE'}</span>
            </button>
            {!collapsed && showEstimate && (
              <div className="ml-8 space-y-0.5 mb-1 text-xs">
                <Link href="/estimate" onClick={(e) => handleNav(e, '/estimate')} className="block py-1 hover:text-blue-300">New Construction</Link>
                <Link href="/renovation-estimate" onClick={(e) => handleNav(e, '/renovation-estimate')} className="block py-1 hover:text-blue-300">Renovation</Link>
                <Link href="/extension-estimate" onClick={(e) => handleNav(e, '/extension-estimate')} className="block py-1 hover:text-blue-300">Renovation + Extension</Link>
                <Link href="/remaining-work-estimate" onClick={(e) => handleNav(e, '/remaining-work-estimate')} className="block py-1 hover:text-blue-300">Remaining Work</Link>
                <Link href="/construction-certificate" onClick={(e) => handleNav(e, '/construction-certificate')} className="block py-1 hover:text-blue-300">Construction Certificate</Link>
              </div>
            )}
          </div>

          {/* DEED DRAFTING */}
          <div>
            <Link href="/deed-drafting" onClick={(e) => handleNav(e, '/deed-drafting')} className="block px-4 py-2 hover:bg-blue-800 rounded">
              📝 {!collapsed && 'Deed Drafting'}
            </Link>
          </div>

          {/* DMS */}
          <div>
            <Link
              href="/document-management"
              onClick={(e) => handleNav(e, '/document-management')}
              className="w-full text-left px-4 py-2 hover:bg-blue-800 flex items-center gap-2 transition-colors rounded"
            >
              <span>📂</span>
              {!collapsed && <span className="font-bold">DOC. MANAGEMENT</span>}
            </Link>
          </div>

          {/* VALUATION */}
          <div>
            <Link href="/valuation-assessment" onClick={(e) => handleNav(e, '/valuation-assessment')} className="w-full text-left px-4 py-2 hover:bg-blue-800 flex items-center gap-2 transition-colors rounded">
              <span>🤖</span>
              {!collapsed && <span className="font-bold">VALUATION ASSESSMENT</span>}
            </Link>
          </div>

          {/* MIS */}
          <Link href="/mis" onClick={(e) => handleNav(e, '/mis')} className="block px-4 py-2 hover:bg-blue-800 bg-blue-900/40 rounded">
            📊 {!collapsed && 'MIS'}
          </Link>

          {/* REOPEN CASE */}
          <Link href="/reopen-old-case" onClick={(e) => handleNav(e, '/reopen-old-case')} className="block px-4 py-2 hover:bg-blue-800 bg-blue-900/40 rounded">
            🔄 {!collapsed && 'Reopen Case'}
          </Link>

          {/* CLIENT DASHBOARD */}
          <div>
            <button onClick={() => setShowClient(!showClient)} className="w-full text-left px-4 py-2 hover:bg-blue-800 rounded cursor-pointer">
              👥 {!collapsed && 'CLIENT DASHBOARD'}
            </button>
            {!collapsed && showClient && (
              <div className="ml-8 space-y-0.5 mb-1 text-xs">
                <Link href="/client-registration" onClick={(e) => handleNav(e, '/client-registration')} className="block py-1 hover:text-blue-300">Registration</Link>
                <Link href="/client-data" onClick={(e) => handleNav(e, '/client-data')} className="block py-1 hover:text-blue-300">Client Data</Link>
              </div>
            )}
          </div>

          {/* Payments Ledger */}
          <div>
            <Link href="/payments" onClick={onClose} className="flex items-center gap-3 px-4 py-2 hover:bg-blue-800 text-amber-400 rounded">
              <Banknote size={18} className="shrink-0" />
              {!collapsed && <span>Payments Ledger</span>}
            </Link>
          </div>

          {/* BILLING & ACCOUNT LEDGER */}
          <Link href="/wallet-ledger" onClick={onClose} className="flex items-center gap-3 px-4 py-2 hover:bg-blue-800 text-emerald-400 bg-emerald-950/30 border-y border-emerald-900/50 rounded">
            <Banknote size={18} className="shrink-0" />
            {!collapsed && <span>{ledgerLabel}</span>}
          </Link>

          {/* PARTNER NETWORK */}
          <div>
            <Link href="/partner-dashboard" onClick={onClose} className="flex items-center gap-3 px-4 py-2 hover:bg-blue-800 text-cyan-300 bg-cyan-950/20 rounded">
              <Users size={18} className="shrink-0" />
              {!collapsed && <span>Partner Network</span>}
            </Link>
          </div>

          {/* ACCESS CONTROL */}
          {isEligibleForAccessControl && (
            <div>
              <Link href="/access-control" onClick={onClose} className={`flex items-center gap-3 px-4 py-2 hover:bg-blue-800 text-purple-300 rounded ${pathname === '/access-control' ? 'bg-purple-900 text-white' : 'bg-purple-950/20'}`}>
                <ShieldCheck size={18} className="shrink-0 text-purple-400" />
                {!collapsed && <span>Access Control</span>}
              </Link>
            </div>
          )}

          {/* ADMIN DASHBOARD */}
          {isAdmin && (
            <Link href="/admin-dashboard" onClick={onClose} className={`flex items-center px-4 py-2 hover:bg-blue-800 rounded text-amber-300 ${pathname === '/admin-dashboard' ? 'bg-blue-800 text-white' : ''}`}>
              📊 {!collapsed && <span className="ml-2">Admin Dashboard</span>}
            </Link>
          )}
        </nav>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* LOW BALANCE WARNING MODAL — 3 CLEAR NUMBERS                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {warning?.open && (
        <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4 no-print">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setWarning(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="bg-amber-100 p-2 rounded-full">
                <AlertTriangle className="text-amber-600" size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Insufficient Wallet Balance</h2>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-blue-700">{warning.service}</span> use karne ke liye
                  wallet me balance hona chahiye.
                </p>
              </div>
            </div>

            {/* 3 numbers alag-alag */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">🎯 Service Charge</span>
                <span className="font-semibold text-gray-800">₹{serviceCharge}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">💰 Minimum Recharge</span>
                <span className="font-semibold text-gray-800">₹{rechargeMin}</span>
              </div>

              <div className="flex justify-between border-t border-blue-200 pt-2">
                <span className="text-gray-600">💼 Your Balance</span>
                <span className="font-semibold text-gray-800">₹{walletBalance.toFixed(2)}</span>
              </div>

              <div className="flex justify-between border-t border-blue-200 pt-2">
                <span className="text-gray-700 font-semibold">⚠️ Shortfall</span>
                <span className="font-bold text-red-600">₹{shortfall.toFixed(2)}</span>
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-5 text-xs text-emerald-800 leading-relaxed">
              <p className="font-bold mb-1">💡 How to fix:</p>
              <p>
                Recharge <span className="font-bold">₹{rechargeMin}</span> (minimum) —
                after that your balance will be{' '}
                <span className="font-bold">₹{(walletBalance + rechargeMin).toFixed(2)}</span>,
                which covers this service charge of{' '}
                <span className="font-bold">₹{serviceCharge}</span>.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setWarning(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRecharge}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition cursor-pointer"
              >
                Recharge ₹{rechargeMin} Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}