"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase"; 
import Sidebar from "../components/Sidebar";
import UserStatusTracker from "../components/UserStatusTracker";
import MobileBottomNav from "../components/MobileBottomNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const pathname = usePathname();
  
  // Check if current page is any preview page
  const isPreviewPage = pathname ? pathname.includes('preview') || pathname.endsWith('-preview') : false;

  // Auto close mobile drawer and reset states on every route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Handle window resize to automatically close mobile drawer if screen size switches to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
          
        if (profileData) {
          if (profileData.role === 'admin') {
            setIsAdmin(true);
          }
        }
      }
    };
    checkUser();
  }, []); 

  // Agar preview page hai toh bina sidebar/nav ke render karein
  if (isPreviewPage) {
    return (
      <div key={pathname} className="min-h-screen bg-slate-100 w-full overflow-y-auto">
        {children}
      </div>
    );
  }

  return (
    <div key={pathname} className="flex h-dvh w-screen overflow-hidden bg-slate-100 fixed inset-0 isolate">
      {userId && !isAdmin && <UserStatusTracker userId={userId} />}

      {/* 1. DESKTOP SIDEBAR (Force hidden on mobile via !hidden) */}
      <aside className="!hidden md:!flex flex-col border-r border-slate-800 bg-slate-900 shrink-0 no-print h-full w-auto">
        <Sidebar />
      </aside>

      {/* 2. MOBILE DRAWER SIDEBAR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden no-print">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] bg-blue-950 h-full overflow-y-auto shadow-2xl flex flex-col text-white">
            <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
        <main className="flex-1 overflow-y-auto p-3 md:p-6 pb-36 md:pb-6 flex flex-col w-full">
          <div className="w-full max-w-full">
            {children}
          </div>
        </main>
        
        {/* MOBILE BOTTOM NAVIGATION - Sticky/Relative placement so it flows naturally after content without covering buttons */}
        <div className="md:hidden no-print w-full shrink-0 z-30">
          <MobileBottomNav onOpenMenu={() => setIsMobileMenuOpen(true)} />
        </div>
      </div>

      {/* 
        ═══════════════════════════════════════════════════════════════════════
        REMOVED: FLOATING WHATSAPP HELPDESK BUTTON
        ═══════════════════════════════════════════════════════════════════════
        
        The floating WhatsApp button at bottom-right corner has been removed 
        because support is now accessible through the professional "Help" 
        button in the dashboard header (top-right corner).
        
        The Help button opens the Corporate Support Modal which provides:
        • 8 pre-defined issue categories (Approval, Recharge, Low Wallet, KYC, 
          Billing, Technical, Escalation, Custom Message)
        • 3 support contacts (Administrator, Co-Partner, CEO Office)
        • Pre-filled professional messages with user account details
        • Escalation path to executive management
        
        This aligns with enterprise SaaS UX standards (like Zoho, Freshworks, 
        Salesforce) instead of consumer-style floating action buttons.
        ═══════════════════════════════════════════════════════════════════════
      */}
    </div>
  );
}