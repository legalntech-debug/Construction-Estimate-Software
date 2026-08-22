"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Calculator, FolderKanban, Wallet } from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Estimate", href: "/estimate", icon: Calculator },
    { label: "Certificate", href: "/construction-certificate", icon: FileText },
    { label: "DMS", href: "/document-management", icon: FolderKanban },
    { label: "Ledger", href: "/wallet-ledger", icon: Wallet },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-blue-950 text-white border-t border-blue-800 flex justify-around items-center py-2.5 z-40 no-print shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              isActive ? 'text-amber-400 font-bold scale-105' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}