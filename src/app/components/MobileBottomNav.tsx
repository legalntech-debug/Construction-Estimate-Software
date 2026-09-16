'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, FileText, Calculator, Compass, Menu, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface MobileBottomNavProps {
  onOpenMenu?: () => void;
}

export default function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("BASIC PLAN");
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const checkUserSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        let userIsAdmin = false;

        const { data: roleData } = await supabaseClient.rpc('get_user_role', { target_user_id: session.user.id });
        if (roleData?.toLowerCase() === 'admin' || session.user.email === 'legalntech@gmail.com') {
          userIsAdmin = true;
        }

        const { data: profileData } = await supabaseClient
          .from('profiles')
          .select('plan_type, wallet_balance, role')
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
      }
      setIsDataLoaded(true);
    };

    checkUserSession();
  }, []);

  const isWalletLow = walletBalance < 100;
  const isPremium = userPlan.toUpperCase().includes('PREMIUM');
  const isRestricted = !isAdmin && !isPremium && (isWalletLow || !isDataLoaded);

  if (pathname === '/estimate-preview') {
    return null;
  }

  const navItems = [
    { label: "PLAN", href: "/construction-plan", icon: Compass },
    { label: "Estimate", href: "/estimate", icon: Calculator },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Drafting", href: "/deed-drafting", icon: FileText },
  ];

  const handleRestrictedClick = (e: React.MouseEvent, href: string) => {
    if (isRestricted) {
      e.preventDefault();
      alert('Aapka wallet balance ₹100 se kam hai. Kripya wallet recharge karein.');
      router.push('/wallet-ledger');
    }
  };

  return (
    <div 
      suppressHydrationWarning={true}
      // App-like bottom bar: Taller (68px), no rounded corners on top, subtle top shadow
      className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-blue-950 text-white border-t border-blue-900 z-50 no-print shadow-2xl flex flex-row flex-nowrap items-center justify-between"
      style={{ 
        height: '68px', 
        padding: '6px 4px',
        display: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'none' : 'flex' 
      }}
    >
      {navItems.map((item) => {
        const IconComponent = item.icon;
        const isActive = pathname === item.href;
        const itemLocked = isRestricted;

        return (
          <Link
            key={item.href}
            href={itemLocked ? '/wallet-ledger' : item.href}
            onClick={(e) => handleRestrictedClick(e, item.href)}
            style={{ 
              flex: '1', 
              minWidth: 0, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              textDecoration: 'none',
              gap: '4px'
            }}
            className={`text-[12px] font-semibold tracking-wide transition-all duration-200 ${
              itemLocked 
                ? 'opacity-40 cursor-not-allowed' 
                : isActive 
                  ? 'text-amber-400 scale-105' 
                  : 'text-slate-300 hover:text-white active:scale-95'
            }`}
          >
            {itemLocked ? (
              <Lock className="w-6 h-6 shrink-0 text-red-400" />
            ) : (
              <IconComponent className="w-6 h-6 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
            )}
            <span 
              style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap', 
                width: '100%', 
                textAlign: 'center',
                lineHeight: '1'
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}

      {onOpenMenu && (
        <button
          onClick={onOpenMenu}
          style={{ 
            flex: '1', 
            minWidth: 0, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
            gap: '4px'
          }}
          className="text-[12px] font-semibold tracking-wide text-slate-300 hover:text-white active:scale-95 transition-all duration-200"
        >
          <Menu className="w-6 h-6 shrink-0" strokeWidth={2} />
          <span 
            style={{ 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              width: '100%', 
              textAlign: 'center',
              lineHeight: '1'
            }}
          >
            Menu
          </span>
        </button>
      )}
    </div>
  );
}