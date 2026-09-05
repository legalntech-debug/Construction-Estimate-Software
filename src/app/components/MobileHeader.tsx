'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Menu, X, LayoutDashboard, Compass, Calculator, FileText, 
  Folder, Bell, User, Wallet, LogOut, Settings, ShieldCheck, 
  Bot, RefreshCw, Users, Banknote, Building2, MapPin 
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

export default function MobileHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showPlanSub, setShowPlanSub] = useState(false);
  const [showEstimateSub, setShowEstimateSub] = useState(false);
  const [showClientSub, setShowClientSub] = useState(false);

  const [userData, setUserData] = useState({
    email: '',
    id: '',
    name: 'Loading...',
    wallet: 0,
    planType: 'BASIC PLAN',
    isAdmin: false,
    isEligibleForAccessControl: false,
    approvalStatus: 'APPROVED'
  });
  
  const pathname = usePathname();
  const router = useRouter();

  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) return;

      const user = session.user;
      let userIsAdmin = false;

      const { data: roleData } = await supabaseClient.rpc('get_user_role', { target_user_id: user.id });
      if (roleData?.toLowerCase() === 'admin' || user.email === 'legalntech@gmail.com') {
        userIsAdmin = true;
      }

      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role === 'admin' || profile?.user_type === 'Admin') {
        userIsAdmin = true;
      }

      const { data: partnerData } = await supabaseClient
        .from('partners')
        .select('second_role, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const allowedPartnerRoles = ['ceo', 'co-partner', 'co-owner', 'marketing & support', 'investor'];
      const userPartnerRole = partnerData?.second_role?.toLowerCase() || '';
      const showAccessControl = userIsAdmin || (partnerData && allowedPartnerRoles.includes(userPartnerRole));

      const userEmail = user.email || '';
      setUserData({
        email: userEmail,
        id: profile?.user_code || user.id.slice(0, 8),
        name: profile?.full_name || "User",
        wallet: Number(profile?.wallet_balance || 0),
        planType: profile?.plan_type || 'BASIC PLAN',
        isAdmin: userIsAdmin,
        isEligibleForAccessControl: !!showAccessControl,
        approvalStatus: profile?.approval_status || 'APPROVED'
      });
    };

    fetchUserData();
  }, []);

  const isWalletLow = userData.wallet < 100;
  const isPremium = userData.planType.toUpperCase().includes('PREMIUM');
  const isSidebarRestricted = !userData.isAdmin && !isPremium && isWalletLow;
  const ledgerLabel = isPremium ? 'Billing & Account Ledger' : 'Account Ledger';

  return (
    <>
      {/* Top Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between bg-blue-950 text-white px-4 py-2.5 sticky top-0 z-40 border-b border-blue-900 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsOpen(true)}
            className="p-1.5 rounded-lg hover:bg-blue-900 text-slate-200 focus:outline-none cursor-pointer transition"
            aria-label="Open Menu"
          >
            <Menu size={20} />
          </button>
          <span className="font-extrabold text-xs tracking-wider uppercase text-white truncate max-w-[190px]">
            {userData.isAdmin ? 'LNT ADMIN DASHBOARD' : 'LNT WITH AI 2.0'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button 
            onClick={() => setShowNotificationDrawer(true)}
            className="relative p-2 rounded-full bg-blue-900 hover:bg-blue-800 text-slate-300 transition cursor-pointer"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {isWalletLow && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>}
          </button>

          {/* Profile Quick Button */}
          <button 
            onClick={() => setIsOpen(true)}
            className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow cursor-pointer uppercase overflow-hidden"
          >
            {userData?.email ? userData.email.charAt(0).toUpperCase() : <User size={14} />}
          </button>
        </div>
      </div>

      {/* COMBINED SIDEBAR & PROFILE DRAWER */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-80 bg-blue-950 text-white h-full shadow-2xl flex flex-col z-10 border-r border-blue-900 overflow-y-auto custom-scrollbar">
            
            {/* Drawer Header */}
            <div className="p-3.5 flex items-center justify-between border-b border-blue-900 bg-blue-950 sticky top-0 z-20">
              <span className="font-black text-xs tracking-wider uppercase text-white">LNT WITH AI 2.0</span>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg bg-blue-900 hover:bg-blue-800 text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* 1. PROFILE SECTION (TOP OF DRAWER) */}
            <div className="p-3.5 bg-blue-900/40 border-b border-blue-900 space-y-2.5 text-xs">
              <div className="flex items-center gap-2.5 pb-2 border-b border-blue-900/60">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold uppercase text-white shrink-0">
                  {userData?.email ? userData.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="overflow-hidden">
                  <p className="font-extrabold text-white uppercase truncate">{userData.name}</p>
                  <p className="text-[10px] text-blue-300 truncate">{userData.email}</p>
                </div>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between items-center text-blue-200">
                  <span className="text-blue-400 uppercase text-[10px]">System ID:</span>
                  <span className="font-bold">{userData.id}</span>
                </div>
                <div className="flex justify-between items-center text-blue-200">
                  <span className="text-blue-400 uppercase text-[10px]">Plan Type:</span>
                  <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-extrabold text-[9px] uppercase">
                    {userData.planType}
                  </span>
                </div>
              </div>

              {/* Wallet Box */}
              <div className="bg-blue-950 p-2.5 rounded-xl border border-blue-900 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-blue-400 font-extrabold uppercase">Wallet Balance</p>
                  <p className={`text-sm font-black ${userData.wallet < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ₹ {userData.wallet.toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Link 
                    href="/wallet-ledger"
                    onClick={() => setIsOpen(false)}
                    className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] uppercase transition"
                  >
                    Ledger
                  </Link>
                  <Link 
                    href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase shadow transition"
                  >
                    Add Fund
                  </Link>
                </div>
              </div>
            </div>

            {/* 2. COMPLETE SIDEBAR NAVIGATION OPTIONS */}
            <nav className="p-3 space-y-1 text-sm font-bold uppercase flex-1">
              
              {/* DASHBOARD */}
              <Link 
                href="/dashboard" 
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                  pathname === '/dashboard' ? 'bg-blue-600 text-white' : 'text-white bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <LayoutDashboard size={18} className="shrink-0" />
                <span>DASHBOARD</span>
              </Link>

              {/* PLAN SECTION */}
              <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
                <button 
                  onClick={() => !isSidebarRestricted && setShowPlanSub(!showPlanSub)} 
                  className="w-full text-left px-4 py-2 hover:bg-blue-900 flex justify-between items-center rounded transition"
                >
                  <span className="flex items-center gap-2">🏗 <span>PLAN</span></span>
                  <span className="text-xs">{showPlanSub ? '▲' : '▼'}</span>
                </button>
                {showPlanSub && !isSidebarRestricted && (
                  <div className="ml-8 space-y-1 my-1 text-xs normal-case border-l-2 border-blue-800 pl-3">
                    <Link href="/construction-plan" onClick={() => setIsOpen(false)} className="block py-1 hover:text-blue-300 font-medium">🏗 Construction Plan</Link>
                    <Link href="/route-map" onClick={() => setIsOpen(false)} className="block py-1 hover:text-blue-300 font-medium">📍 Location / Key Plan</Link>
                  </div>
                )}
              </div>

              {/* ESTIMATE TYPE SECTION */}
              <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
                <button 
                  onClick={() => !isSidebarRestricted && setShowEstimateSub(!showEstimateSub)} 
                  className="w-full text-left px-4 py-2 hover:bg-blue-900 flex justify-between items-center rounded transition"
                >
                  <span className="flex items-center gap-2">📋 <span>ESTIMATE TYPE</span></span>
                  <span className="text-xs">{showEstimateSub ? '▲' : '▼'}</span>
                </button>
                {showEstimateSub && !isSidebarRestricted && (
                  <div className="ml-8 space-y-1 my-1 text-xs normal-case border-l-2 border-blue-800 pl-3">
                    <Link href="/estimate" onClick={() => setIsOpen(false)} className="block py-1 hover:text-blue-300 font-medium">New Construction</Link>
                    <Link href="/renovation-estimate" onClick={() => setIsOpen(false)} className="block py-1 hover:text-blue-300 font-medium">Renovation</Link>
                    <Link href="/extension-estimate" onClick={() => setIsOpen(false)} className="block py-1 hover:text-blue-300 font-medium">Renovation + Extension</Link>
                    <Link href="/remaining-work-estimate" onClick={() => setIsOpen(false)} className="block py-1 hover:text-blue-300 font-medium">Remaining Work</Link>
                    <Link href="/construction-certificate" onClick={() => setIsOpen(false)} className="block py-1 hover:text-blue-300 font-medium">Construction Certificate</Link>
                  </div>
                )}
              </div>

              {/* DEED DRAFTING */}
              <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
                <Link href="/deed-drafting" onClick={() => setIsOpen(false)} className="block px-4 py-2 hover:bg-blue-900 rounded transition">
                  📝 Deed Drafting
                </Link>
              </div>

              {/* DOC. MANAGEMENT */}
              <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
                <Link href="/document-management" onClick={() => setIsOpen(false)} className="w-full text-left px-4 py-2 hover:bg-blue-900 flex items-center gap-2 transition rounded">
                  <span>📂</span>
                  <span className="font-bold">DOC. MANAGEMENT</span>
                </Link>
              </div>

              {/* VALUATION ASSESSMENT */}
              <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
                <Link href="/valuation-assessment" onClick={() => setIsOpen(false)} className="w-full text-left px-4 py-2 hover:bg-blue-900 flex items-center gap-2 transition rounded">
                  <span>🤖</span>
                  <span className="font-bold">VALUATION ASSESSMENT</span>
                </Link>
              </div>

              {/* MIS */}
              <Link href="/mis" onClick={() => setIsOpen(false)} className="block px-4 py-2 hover:bg-blue-900 bg-blue-900/40 rounded transition">
                📊 MIS
              </Link>
              
              {/* REOPEN CASE */}
              <Link href="/reopen-old-case" onClick={() => setIsOpen(false)} className="block px-4 py-2 hover:bg-blue-900 bg-blue-900/40 rounded transition">
                🔄 Reopen Case
              </Link>

              {/* CLIENT DASHBOARD */}
              <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
                <button 
                  onClick={() => !isSidebarRestricted && setShowClientSub(!showClientSub)} 
                  className="w-full text-left px-4 py-2 hover:bg-blue-900 flex justify-between items-center rounded transition"
                >
                  <span>👥 CLIENT DASHBOARD</span>
                  <span className="text-xs">{showClientSub ? '▲' : '▼'}</span>
                </button>
                {showClientSub && !isSidebarRestricted && (
                  <div className="ml-8 space-y-1 my-1 text-xs normal-case border-l-2 border-blue-800 pl-3">
                    <Link href="/client-registration" onClick={() => setIsOpen(false)} className="block py-1 hover:text-blue-300 font-medium">Registration</Link>
                    <Link href="/client-data" onClick={() => setIsOpen(false)} className="block py-1 hover:text-blue-300 font-medium">Client Data</Link>
                  </div>
                )}
              </div>

              {/* Payments Ledger */}
              <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
                <Link href="/payments" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-2 hover:bg-blue-900 text-amber-400 rounded transition">
                  <Banknote size={18} className="shrink-0" /> <span>Payments Ledger</span>
                </Link>
              </div>

              {/* BILLING & ACCOUNT LEDGER */}
              <Link href="/wallet-ledger" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-2 hover:bg-blue-900 text-emerald-400 bg-emerald-950/30 border-y border-emerald-900/50 rounded transition">
                <Banknote size={18} className="shrink-0" /> <span>{ledgerLabel}</span>
              </Link>

              {/* PARTNER NETWORK */}
              <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
                <Link href="/partner-dashboard" onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-4 py-2 hover:bg-blue-900 text-cyan-300 bg-cyan-950/20 rounded transition">
                  <Users size={18} className="shrink-0" /> <span>Partner Network</span>
                </Link>
              </div>

              {/* ACCESS CONTROL */}
              {userData.isEligibleForAccessControl && (
                <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
                  <Link href="/access-control" onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-2 hover:bg-blue-900 text-purple-300 rounded transition ${pathname === '/access-control' ? 'bg-purple-900 text-white' : 'bg-purple-950/20'}`}>
                    <ShieldCheck size={18} className="shrink-0 text-purple-400" /> <span>Access Control</span>
                  </Link>
                </div>
              )}

              {/* ADMIN DASHBOARD */}
              {userData.isAdmin && (
                <Link href="/admin-dashboard" onClick={() => setIsOpen(false)} className={`flex items-center px-4 py-2 hover:bg-blue-900 rounded text-amber-300 transition ${pathname === '/admin-dashboard' ? 'bg-blue-900 text-white' : ''}`}>
                  📊 <span className="ml-2">Admin Dashboard</span>
                </Link>
              )}

              {/* EDIT PROFILE & LOGOUT */}
              <div className="pt-4 mt-4 border-t border-blue-900 space-y-1">
                <Link
                  href="/edit-profile"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold uppercase text-slate-300 hover:bg-blue-900 hover:text-white transition"
                >
                  <Settings size={18} className="shrink-0" />
                  <span>Edit Profile</span>
                </Link>

                <button
                  onClick={async () => {
                    setIsOpen(false);
                    await supabaseClient.auth.signOut();
                    router.push('/verify-estimate');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold uppercase text-rose-400 hover:bg-rose-950/40 transition text-left cursor-pointer"
                >
                  <LogOut size={18} className="shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            </nav>
            
            <div className="p-3 border-t border-blue-900 bg-blue-950/80 text-center text-[10px] text-blue-400 font-semibold">
              LNT AI CONSULTANT 2.0
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS DRAWER */}
      {showNotificationDrawer && (
        <div className="fixed inset-0 z-50 flex md:hidden justify-end">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowNotificationDrawer(false)}
          />

          <div className="relative w-80 bg-white text-slate-800 h-full shadow-2xl flex flex-col z-10 overflow-y-auto">
            <div className="bg-blue-950 p-4 text-white flex items-center justify-between">
              <span className="font-extrabold text-xs tracking-wider uppercase">Notifications</span>
              <button 
                onClick={() => setShowNotificationDrawer(false)}
                className="p-1 rounded-lg bg-blue-900 hover:bg-blue-800 text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3 bg-slate-50 flex-1">
              {isWalletLow && (
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 shadow-sm space-y-1.5">
                  <p className="font-extrabold text-xs text-rose-600">⚠️ Low Wallet Balance Alert!</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Your balance is <strong className="text-rose-600">₹{userData.wallet.toFixed(2)}</strong>. Please recharge to avoid access restrictions.
                  </p>
                </div>
              )}

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <p className="font-bold text-xs text-blue-600">☀️ L&T Consultant 2.0 Active</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  You can access estimates, drafting, and document management seamlessly.
                </p>
                <p className="text-[9px] text-slate-400 pt-1">Just now</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}