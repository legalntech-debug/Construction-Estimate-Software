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
  const [userProfile, setUserProfile] = useState<{ full_name: string; mobile: string; user_code: string } | null>(null);
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
          .select('role, full_name, mobile, user_code')
          .eq('id', user.id)
          .single();
          
        if (profileData) {
          if (profileData.role === 'admin') {
            setIsAdmin(true);
          }
          setUserProfile(profileData);
        }
      }
    };
    checkUser();
  }, []); 

  const handleSupportClick = () => {
    const SUPPORT_NUMBER = "917987561396"; 
    const name = userProfile?.full_name?.trim() || "User";
    const mobile = userProfile?.mobile?.trim() || "N/A";
    const userCode = userProfile?.user_code?.trim() || userId?.slice(0, 8) || "N/A";

    const message = encodeURIComponent(
      `Hello LNT Support,\n\nI am facing an issue with my portal account.\n\n*Name:* ${name}\n*Registered Mobile:* ${mobile}\n*User Code:* ${userCode}\n\nPlease assist.`
    );
    
    window.open(`https://wa.me/${SUPPORT_NUMBER}?text=${message}`, '_blank');
  };

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
        {/* Yahan pb-32 ya pb-36 kar dein taaki niche ka content patti ke peeche na chhupi */}
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

      {/* WHATSAPP HELPDESK BUTTON */}
      <button
        onClick={handleSupportClick}
        className="fixed bottom-20 md:bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl transition-all duration-300 hover:scale-110 hover:bg-emerald-600 active:scale-95 no-print cursor-pointer"
        title="Contact Helpdesk Support"
      >
        <svg className="h-7 w-7 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.455L0 24zm6.59-4.846c1.66.986 3.296 1.489 4.961 1.491 5.421.001 9.834-4.415 9.836-9.841a9.77 9.77 0 0 0-2.871-6.96 9.784 9.784 0 0 0-6.96-2.871c-5.424 0-9.84 4.417-9.842 9.843-.001 1.812.487 3.53 1.412 5.064l-.965 3.525 3.637-.954zm10.516-4.505c-.292-.146-1.727-.853-1.993-.95-.266-.096-.46-.146-.653.146-.193.291-.747.95-.916 1.144-.169.193-.338.218-.63.072-1.464-.73-2.433-1.28-3.414-2.954-.258-.44.258-.409.738-1.37.08-.164.04-.308-.02-.454-.06-.146-.457-1.102-.626-1.51-.165-.4-.347-.346-.476-.352l-.407-.006c-.141 0-.368.053-.56.26-.191.207-.73.714-.73 1.743s.748 2.027.854 2.17c.104.144 1.47 2.244 3.562 3.146 1.1.474 1.958.641 2.631.527.751-.112 2.301-.94 2.625-1.848.324-.909.324-1.686.227-1.848-.097-.162-.356-.258-.648-.404z"/>
        </svg>
      </button>
    </div>
  );
}