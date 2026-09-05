'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Calculator, Folder, Compass, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu?: () => void;
}

export default function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const pathname = usePathname();

  if (pathname === '/estimate-preview') {
    return null;
  }

  const navItems = [
    { label: "PLAN", href: "/construction-plan", icon: Compass },
    { label: "Estimate", href: "/estimate", icon: Calculator },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Drafting", href: "/deed-drafting", icon: FileText },
    { label: "Docs", href: "/document-management", icon: Folder },
  ];

  return (
<div 
      className="md:hidden absolute bottom-0 left-0 right-0 w-full bg-blue-950 text-white border-t border-blue-900 z-50 no-print shadow-2xl flex flex-row flex-nowrap items-center justify-between"
      style={{ 
        height: '56px', 
        padding: '0 2px',
        // Yeh ensure karega ki 768px se badi screen par yeh CSS level par permanently hide rahe
        display: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'none' : 'flex' 
      }}
    >
      {navItems.map((item) => {
        const IconComponent = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{ 
              flex: '1', 
              minWidth: 0, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              textDecoration: 'none' 
            }}
            className={`text-[9px] font-medium transition-colors ${
              isActive ? 'text-amber-400 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            <IconComponent className="w-4 h-4 mb-0.5 shrink-0" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
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
            cursor: 'pointer' 
          }}
          className="text-[9px] font-medium text-slate-300 hover:text-white transition-colors"
        >
          <Menu className="w-4 h-4 mb-0.5 shrink-0" />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
            Menu
          </span>
        </button>
      )}
    </div>
  );
}