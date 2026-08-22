'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Banknote, Users, Menu, X } from "lucide-react";
import { createBrowserClient } from '@supabase/ssr';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showEstimate, setShowEstimate] = useState(false);
  const [showClient, setShowClient] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); 
  const [userPlan, setUserPlan] = useState<string>("BASIC PLAN");
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  useEffect(() => {
    setMounted(true);
    const checkUserSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        const { data: roleData } = await supabaseClient.rpc('get_user_role', { target_user_id: session.user.id });
        if (roleData?.toLowerCase() === 'admin' || session.user.email === 'legalntech@gmail.com') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }

        const { data: profileData, error } = await supabaseClient
          .from('profiles')
          .select('plan_type, wallet_balance, created_at, role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileData) {
          if (profileData.plan_type) setUserPlan(profileData.plan_type);
          if (profileData.wallet_balance !== null && profileData.wallet_balance !== undefined) {
            setWalletBalance(Number(profileData.wallet_balance));
          }
          if (profileData.created_at) setCreatedAt(profileData.created_at);
          if (profileData.role === 'admin') setIsAdmin(true);
        }
      }
    };
    checkUserSession();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) checkUserSession();
      else { 
        setIsAdmin(false); 
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Route change hone par mobile menu auto close hoga
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!mounted) {
    return <aside className="bg-blue-950 text-white w-72 h-screen no-print hidden md:block"></aside>;
  }

  // --- LOCKING & EXEMPTION CONDITIONS ---
  const isWalletLow = walletBalance < 100;
  const isPremium = userPlan.toUpperCase().includes('PREMIUM');

  // Admin aur Premium users kabhi restricted nahi honge
  const isSidebarRestricted = !isAdmin && !isPremium && isWalletLow;

  const ledgerLabel = isPremium ? 'Billing & Account Ledger' : 'Account Ledger';

  return (
    <>
      {/* Mobile Top Header Bar (Only visible on small screens / Mobile) */}
      <div className="md:hidden bg-blue-950 text-white p-3 flex justify-between items-center sticky top-0 z-40 no-print border-b border-blue-800">
        <h1 className="font-extrabold text-sm tracking-wide">LNT WITH AI 2.0</h1>
        <button 
          onClick={() => setMobileOpen(!mobileOpen)} 
          className="bg-blue-800 p-1.5 rounded text-white focus:outline-none"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Dark Backdrop Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden no-print"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Main Container */}
      <aside className={`
        bg-blue-950 text-white transition-all duration-300 h-screen sticky top-0 z-50 no-print overflow-y-auto overflow-x-hidden custom-scrollbar
        fixed inset-y-0 left-0 md:relative
        ${mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
        ${collapsed ? 'md:w-16' : 'md:w-72'}
      `}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-blue-800">
          {(!collapsed || mobileOpen) && <h1 className="font-extrabold text-sm tracking-wide">LNT WITH AI 2.0</h1>}
          <button 
            onClick={() => {
              if (window.innerWidth < 768) setMobileOpen(false);
              else setCollapsed(!collapsed);
            }} 
            className="bg-blue-800 px-2 py-1 rounded text-xs"
          >
            {collapsed ? '☰' : '◀'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 text-sm font-bold uppercase">
          
          {/* 1. DASHBOARD */}
          <Link 
            href="/dashboard" 
            className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-lg transition ${
              pathname === '/dashboard' ? 'bg-blue-600 text-white' : 'text-white bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <LayoutDashboard size={18} />
            {(!collapsed || mobileOpen) && <span>DASHBOARD</span>}
          </Link>

          {/* 2. PLAN */}
          <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
            <button onClick={() => !isSidebarRestricted && setShowPlan(!showPlan)} className="w-full text-left px-6 py-2 hover:bg-blue-800 flex justify-between">
              <span>🏗 {(!collapsed || mobileOpen) && 'PLAN'}</span>
            </button>
            {(!collapsed || mobileOpen) && showPlan && !isSidebarRestricted && (
              <div className="ml-10 space-y-0.5 mb-1">
                <Link href="/construction-plan" className="block py-0.5 hover:text-blue-300">🏗 Construction Plan</Link>
                <Link href="/route-map" className="block py-0.5 hover:text-blue-300">📍 Location / Key Plan</Link>
              </div>
            )}
          </div>

          {/* 3. ESTIMATE TYPE */}
          <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
            <button onClick={() => !isSidebarRestricted && setShowEstimate(!showEstimate)} className="w-full text-left px-6 py-2 hover:bg-blue-800 flex justify-between">
              <span>📋 {(!collapsed || mobileOpen) && 'ESTIMATE TYPE'}</span>
            </button>
            {(!collapsed || mobileOpen) && showEstimate && !isSidebarRestricted && (
              <div className="ml-10 space-y-0.5 mb-1">
                <Link href="/estimate" className="block py-0.5 hover:text-blue-300">New Construction</Link>
                <Link href="/renovation-estimate" className="block py-0.5 hover:text-blue-300">Renovation</Link>
                <Link href="/extension-estimate" className="block py-0.5 hover:text-blue-300">Renovation + Extension</Link>
                <Link href="/remaining-work-estimate" className="block py-0.5 hover:text-blue-300">Remaining Work</Link>
                <Link href="/construction-certificate" className="block py-0.5 hover:text-blue-300">Construction Certificate</Link>
              </div>
            )}
          </div>

          {/* 4. DEED DRAFTING */}
          <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
            <Link href="/deed-drafting" className="block px-6 py-2 hover:bg-blue-800">📝 {(!collapsed || mobileOpen) && 'Deed Drafting'}</Link>
          </div>

          {/* 5. DMS */}
          <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
            <Link href="/document-management" className="w-full text-left px-6 py-2.5 hover:bg-blue-800 flex items-center gap-2 transition-colors">
              <span>📂</span>
              {(!collapsed || mobileOpen) && <span className="font-bold">DOC. MANAGEMENT</span>}
            </Link>
          </div>

          {/* 6. VALUATION ASSESSMENT */}
          <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
            <Link href="/valuation-assessment" className="w-full text-left px-6 py-2.5 hover:bg-blue-800 flex items-center gap-2 transition-colors">
              <span>🤖</span>
              {(!collapsed || mobileOpen) && <span className="font-bold">VALUATION ASSESSMENT</span>}
            </Link>
          </div>

          {/* 7. MIS */}
          <Link href="/mis" className="block px-6 py-2 hover:bg-blue-800 bg-blue-900/40">📊 {(!collapsed || mobileOpen) && 'MIS'}</Link>
          
          {/* 8. REOPEN CASE */}
          <Link href="/reopen-old-case" className="block px-6 py-2 hover:bg-blue-800 bg-blue-900/40">🔄 {(!collapsed || mobileOpen) && 'Reopen Case'}</Link>

          {/* CLIENT DASHBOARD */}
          <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
            <button onClick={() => !isSidebarRestricted && setShowClient(!showClient)} className="w-full text-left px-6 py-2 hover:bg-blue-800">
              👥 {(!collapsed || mobileOpen) && 'CLIENT DASHBOARD'}
            </button>
            {(!collapsed || mobileOpen) && showClient && !isSidebarRestricted && (
              <div className="ml-10 space-y-0.5 mb-1">
                <Link href="/client-registration" className="block py-0.5 hover:text-blue-300">Registration</Link>
                <Link href="/client-data" className="block py-0.5 hover:text-blue-300">Client Data</Link>
              </div>
            )}
          </div>

          {/* Payments Ledger */}
          <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
            <Link href="/payments" className="flex items-center gap-3 px-6 py-2 hover:bg-blue-800 text-amber-400">
              <Banknote size={18} /> {(!collapsed || mobileOpen) && <span>Payments Ledger</span>}
            </Link>
          </div>

          {/* 9. BILLING & ACCOUNT LEDGER */}
          <Link href="/wallet-ledger" className="flex items-center gap-3 px-6 py-2 hover:bg-blue-800 text-emerald-400 bg-emerald-950/30 border-y border-emerald-900/50">
            <Banknote size={18} /> {(!collapsed || mobileOpen) && <span>{ledgerLabel}</span>}
          </Link>

          {/* --- 10. PARTNER NETWORK --- */}
          <div className={isSidebarRestricted ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}>
            <Link href="/partner-dashboard" className="flex items-center gap-3 px-6 py-2 hover:bg-blue-800 text-cyan-300 bg-cyan-950/20">
              <Users size={18} /> {(!collapsed || mobileOpen) && <span>Partner Network</span>}
            </Link>
          </div>

          {isAdmin && (
            <Link href="/admin-dashboard" className="flex items-center px-6 py-2 hover:bg-blue-800">
              📊 {(!collapsed || mobileOpen) && <span className="ml-4">Admin Dashboard</span>}
            </Link>
          )}
        </nav>
      </aside>
    </>
  );
}