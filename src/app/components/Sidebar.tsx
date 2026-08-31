'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Banknote, Users, ShieldCheck } from "lucide-react";
import { createBrowserClient } from '@supabase/ssr';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showEstimate, setShowEstimate] = useState(false);
  const [showClient, setShowClient] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); 
  const [isEligibleForAccessControl, setIsEligibleForAccessControl] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("BASIC PLAN");
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  useEffect(() => {
    setMounted(true);
    const checkUserSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        let userIsAdmin = false;

        // 1. Check Admin Role
        const { data: roleData } = await supabaseClient.rpc('get_user_role', { target_user_id: session.user.id });
        if (roleData?.toLowerCase() === 'admin' || session.user.email === 'legalntech@gmail.com') {
          userIsAdmin = true;
        }

        const { data: profileData } = await supabaseClient
          .from('profiles')
          .select('plan_type, wallet_balance, created_at, role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileData) {
          if (profileData.plan_type) setUserPlan(profileData.plan_type);
          if (profileData.wallet_balance !== null && profileData.wallet_balance !== undefined) {
            setWalletBalance(Number(profileData.wallet_balance));
          }
          if (profileData.role === 'admin') userIsAdmin = true;
        }

        setIsAdmin(userIsAdmin);

        // 2. Check Partner Role for Access Control
        const { data: partnerData } = await supabaseClient
          .from('partners')
          .select('second_role, status')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .maybeSingle();

        const allowedPartnerRoles = ['ceo', 'co-partner', 'co-owner', 'marketing & support', 'investor'];
        const userPartnerRole = partnerData?.second_role?.toLowerCase() || '';

        // Access Control Eligibility (Admin, CEO, Co-Partner, Co-Owner, etc.)
        const showAccessControl = userIsAdmin || (partnerData && allowedPartnerRoles.includes(userPartnerRole));
        setIsEligibleForAccessControl(!!showAccessControl);
      }
    };

    checkUserSession();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) checkUserSession();
      else { 
        setIsAdmin(false); 
        setIsEligibleForAccessControl(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!mounted) {
    return <aside className="bg-blue-950 text-white w-72 h-screen no-print shrink-0"></aside>;
  }

  const isWalletLow = walletBalance < 100;
  const isPremium = userPlan.toUpperCase().includes('PREMIUM');
  const isSidebarRestricted = !isAdmin && !isPremium && isWalletLow;
  const ledgerLabel = isPremium ? 'Billing & Account Ledger' : 'Account Ledger';

  return (
    <aside className={`
      bg-blue-950 text-white transition-all duration-300 h-screen sticky top-0 z-50 no-print 
      flex flex-col shrink-0 overflow-y-auto overflow-x-hidden custom-scrollbar
      ${collapsed ? 'w-16' : 'w-72'}
    `}>
      
      {/* HEADER */}
      <div className="flex items-center justify-between p-3 border-b border-blue-800 shrink-0">
        {!collapsed && <h1 className="font-extrabold text-sm tracking-wide text-white whitespace-nowrap">LNT WITH AI 2.0</h1>}
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          className="bg-blue-800 px-2 py-1 rounded text-xs text-white hover:bg-blue-700 transition-colors ml-auto"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? '☰' : '◀'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1 text-sm font-bold uppercase flex-1">
        
        {/* DASHBOARD */}
        <Link 
          href="/dashboard" 
          className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
            pathname === '/dashboard' ? 'bg-blue-600 text-white' : 'text-white bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <LayoutDashboard size={18} className="shrink-0" />
          {!collapsed && <span>DASHBOARD</span>}
        </Link>

        {/* PLAN */}
        <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
          <button onClick={() => !isSidebarRestricted && setShowPlan(!showPlan)} className="w-full text-left px-4 py-2 hover:bg-blue-800 flex justify-between items-center rounded">
            <span>🏗 {!collapsed && 'PLAN'}</span>
          </button>
          {!collapsed && showPlan && !isSidebarRestricted && (
            <div className="ml-8 space-y-0.5 mb-1 text-xs">
              <Link href="/construction-plan" className="block py-1 hover:text-blue-300">🏗 Construction Plan</Link>
              <Link href="/route-map" className="block py-1 hover:text-blue-300">📍 Location / Key Plan</Link>
            </div>
          )}
        </div>

        {/* ESTIMATE TYPE */}
        <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
          <button onClick={() => !isSidebarRestricted && setShowEstimate(!showEstimate)} className="w-full text-left px-4 py-2 hover:bg-blue-800 flex justify-between items-center rounded">
            <span>📋 {!collapsed && 'ESTIMATE TYPE'}</span>
          </button>
          {!collapsed && showEstimate && !isSidebarRestricted && (
            <div className="ml-8 space-y-0.5 mb-1 text-xs">
              <Link href="/estimate" className="block py-1 hover:text-blue-300">New Construction</Link>
              <Link href="/renovation-estimate" className="block py-1 hover:text-blue-300">Renovation</Link>
              <Link href="/extension-estimate" className="block py-1 hover:text-blue-300">Renovation + Extension</Link>
              <Link href="/remaining-work-estimate" className="block py-1 hover:text-blue-300">Remaining Work</Link>
              <Link href="/construction-certificate" className="block py-1 hover:text-blue-300">Construction Certificate</Link>
            </div>
          )}
        </div>

        {/* DEED DRAFTING */}
        <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
          <Link href="/deed-drafting" className="block px-4 py-2 hover:bg-blue-800 rounded">📝 {!collapsed && 'Deed Drafting'}</Link>
        </div>

        {/* DMS */}
        <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
          <Link href="/document-management" className="w-full text-left px-4 py-2 hover:bg-blue-800 flex items-center gap-2 transition-colors rounded">
            <span>📂</span>
            {!collapsed && <span className="font-bold">DOC. MANAGEMENT</span>}
          </Link>
        </div>

        {/* VALUATION ASSESSMENT */}
        <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
          <Link href="/valuation-assessment" className="w-full text-left px-4 py-2 hover:bg-blue-800 flex items-center gap-2 transition-colors rounded">
            <span>🤖</span>
            {!collapsed && <span className="font-bold">VALUATION ASSESSMENT</span>}
          </Link>
        </div>

        {/* MIS */}
        <Link href="/mis" className="block px-4 py-2 hover:bg-blue-800 bg-blue-900/40 rounded">📊 {!collapsed && 'MIS'}</Link>
        
        {/* REOPEN CASE */}
        <Link href="/reopen-old-case" className="block px-4 py-2 hover:bg-blue-800 bg-blue-900/40 rounded">🔄 {!collapsed && 'Reopen Case'}</Link>

        {/* CLIENT DASHBOARD */}
        <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
          <button onClick={() => !isSidebarRestricted && setShowClient(!showClient)} className="w-full text-left px-4 py-2 hover:bg-blue-800 rounded">
            👥 {!collapsed && 'CLIENT DASHBOARD'}
          </button>
          {!collapsed && showClient && !isSidebarRestricted && (
            <div className="ml-8 space-y-0.5 mb-1 text-xs">
              <Link href="/client-registration" className="block py-1 hover:text-blue-300">Registration</Link>
              <Link href="/client-data" className="block py-1 hover:text-blue-300">Client Data</Link>
            </div>
          )}
        </div>

        {/* Payments Ledger */}
        <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
          <Link href="/payments" className="flex items-center gap-3 px-4 py-2 hover:bg-blue-800 text-amber-400 rounded">
            <Banknote size={18} className="shrink-0" /> {!collapsed && <span>Payments Ledger</span>}
          </Link>
        </div>

        {/* BILLING & ACCOUNT LEDGER */}
        <Link href="/wallet-ledger" className="flex items-center gap-3 px-4 py-2 hover:bg-blue-800 text-emerald-400 bg-emerald-950/30 border-y border-emerald-900/50 rounded">
          <Banknote size={18} className="shrink-0" /> {!collapsed && <span>{ledgerLabel}</span>}
        </Link>

        {/* PARTNER NETWORK */}
        <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
          <Link href="/partner-dashboard" className="flex items-center gap-3 px-4 py-2 hover:bg-blue-800 text-cyan-300 bg-cyan-950/20 rounded">
            <Users size={18} className="shrink-0" /> {!collapsed && <span>Partner Network</span>}
          </Link>
        </div>

        {/* ACCESS CONTROL - CEO, Co-Partner, & Admin ke liye visible */}
        {isEligibleForAccessControl && (
          <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
            <Link href="/access-control" className={`flex items-center gap-3 px-4 py-2 hover:bg-blue-800 text-purple-300 rounded ${pathname === '/access-control' ? 'bg-purple-900 text-white' : 'bg-purple-950/20'}`}>
              <ShieldCheck size={18} className="shrink-0 text-purple-400" /> {!collapsed && <span>Access Control</span>}
            </Link>
          </div>
        )}

        {/* ADMIN DASHBOARD - Sirf System Admin ke liye visible */}
        {isAdmin && (
          <Link href="/admin-dashboard" className={`flex items-center px-4 py-2 hover:bg-blue-800 rounded text-amber-300 ${pathname === '/admin-dashboard' ? 'bg-blue-800 text-white' : ''}`}>
            📊 {!collapsed && <span className="ml-2">Admin Dashboard</span>}
          </Link>
        )}
      </nav>
    </aside>
  );
}