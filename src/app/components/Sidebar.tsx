'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { LayoutDashboard, RefreshCw, Banknote } from "lucide-react";
import { createBrowserClient } from '@supabase/ssr';
import { supabase } from '@/lib/supabase';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showEstimate, setShowEstimate] = useState(false);
  const [showClient, setShowClient] = useState(false);
  const [showCommonDoc, setShowCommonDoc] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); 

  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  useEffect(() => {
    setMounted(true);
    const checkAdmin = async () => {
      const cachedRole = localStorage.getItem('user_role');
      if (cachedRole === 'admin') setIsAdmin(true);
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        const { data, error } = await supabaseClient.rpc('get_user_role', { target_user_id: session.user.id });
        if (!error && data?.toLowerCase() === 'admin') {
          setIsAdmin(true);
          localStorage.setItem('user_role', 'admin');
        } else {
          setIsAdmin(false);
          localStorage.removeItem('user_role');
        }
      }
    };
    checkAdmin();
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) checkAdmin();
      else { setIsAdmin(false); localStorage.removeItem('user_role'); }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!mounted) {
    return <aside className="bg-blue-950 text-white w-72 h-screen no-print"></aside>;
  }

  return (
    // Yahan update kiya gaya hai (sticky top-0 aur overflow classes)
    <aside className={`bg-blue-950 text-white transition-all duration-300 h-screen sticky top-0 no-print ${collapsed ? 'w-16' : 'w-72'} overflow-y-auto overflow-x-hidden custom-scrollbar`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-blue-800">
        {!collapsed && <h1 className="font-extrabold text-sm tracking-wide">LNT WITH AI 2.0</h1>}
        <button onClick={() => setCollapsed(!collapsed)} className="bg-blue-800 px-2 py-1 rounded text-xs">
          {collapsed ? '☰' : '◀'}
        </button>
      </div>

      {/* [START NEW FEATURE] */}
      {/* Navigation - Font size increased to text-sm and spacing reduced to space-y-1 */}
      <nav className="p-3 space-y-1 text-sm font-bold uppercase">
        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2 mx-2 text-white bg-blue-600 rounded-lg">
          <LayoutDashboard size={18} />
          {!collapsed && <span>DASHBOARD</span>}
        </Link>

        {/* PLAN */}
        <div>
          <button onClick={() => setShowPlan(!showPlan)} className="w-full text-left px-6 py-2 hover:bg-blue-800 flex justify-between">
            <span>🏗 {!collapsed && 'PLAN'}</span>
          </button>
          {!collapsed && showPlan && (
            <div className="ml-10 space-y-0.5 mb-1">
              <Link href="/construction-plan" className="block py-0.5 hover:text-blue-300">🏗 Construction Plan</Link>
              <Link href="/route-map" className="block py-0.5 hover:text-blue-300">📍 Location / Key Plan</Link>
            </div>
          )}
        </div>

        {/* ESTIMATE TYPE */}
        <div>
          <button onClick={() => setShowEstimate(!showEstimate)} className="w-full text-left px-6 py-2 hover:bg-blue-800 flex justify-between">
            <span>📋 {!collapsed && 'ESTIMATE TYPE'}</span>
          </button>
          {!collapsed && showEstimate && (
            <div className="ml-10 space-y-0.5 mb-1">
              <Link href="/estimate" className="block py-0.5 hover:text-blue-300">New Construction</Link>
              <Link href="/renovation-estimate" className="block py-0.5 hover:text-blue-300">Renovation</Link>
              <Link href="/extension-estimate" className="block py-0.5 hover:text-blue-300">Renovation + Extension</Link> {/* <-- Yahan /improvement-estimate ki jagah /extension-estimate kar diya gaya hai */}
            </div>
          )}
        </div>

        {/* DEED DRAFTING */}
        <Link href="/deed-drafting" className="block px-6 py-2 hover:bg-blue-800">📝 {!collapsed && 'Deed Drafting'}</Link>

       {/* DMS */}
        <div>
          <Link 
            href="/document-management" 
            className="w-full text-left px-6 py-2.5 hover:bg-blue-800 flex items-center gap-2 transition-colors"
          >
            <span>📂</span>
            {!collapsed && <span className="font-bold">DOC. M. SYSTEM</span>}
          </Link>
        </div>

        <Link href="/mis" className="block px-6 py-2 hover:bg-blue-800">📊 {!collapsed && 'MIS'}</Link>
        <Link href="/reopen-old-case" className="block px-6 py-2 hover:bg-blue-800">🔄 {!collapsed && 'Reopen Case'}</Link>

        {/* CLIENT DASHBOARD */}
        <div>
          <button onClick={() => setShowClient(!showClient)} className="w-full text-left px-6 py-2 hover:bg-blue-800">
            👥 {!collapsed && 'CLIENT DASHBOARD'}
          </button>
          {!collapsed && showClient && (
            <div className="ml-10 space-y-0.5 mb-1">
              <Link href="/client-registration" className="block py-0.5 hover:text-blue-300">Registration</Link>
              <Link href="/client-data" className="block py-0.5 hover:text-blue-300">Client Data</Link>
            </div>
          )}
        </div>

        <Link href="/payments" className="flex items-center gap-3 px-6 py-2 hover:bg-blue-800 text-amber-400">
          <Banknote size={18} /> {!collapsed && <span>Payments Ledger</span>}
        </Link>

        {isAdmin && (
          <Link href="/admin-dashboard" className="flex items-center px-6 py-2 hover:bg-blue-800">
            📊 {!collapsed && <span className="ml-4">Admin Dashboard</span>}
          </Link>
        )}
      </nav>
      {/* [END NEW FEATURE] */}
    </aside>
  );
}