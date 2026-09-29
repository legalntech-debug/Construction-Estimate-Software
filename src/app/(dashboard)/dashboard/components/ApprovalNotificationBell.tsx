'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const APPROVER_ROLES = ['admin', 'ceo', 'co-partner', 'co_partner', 'co partner'];

export default function ApprovalNotificationBell() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current user role for display
  useEffect(() => {
    const getUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, second_role')
        .eq('id', user.id)
        .single();
      setCurrentUserRole(profile?.second_role || profile?.role || 'Approver');
    };
    getUserRole();
  }, []);

  const fetchPending = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, mobile, city, state, user_type, partner_id, created_at')
      .eq('approval_status', 'PENDING')
      .order('created_at', { ascending: false });

    if (data) setRequests(data);
  };

  useEffect(() => {
    fetchPending();

    // Real-time updates
    const channel = supabase
      .channel('pending-approvals')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles',
          filter: 'approval_status=eq.PENDING',
        },
        (payload) => {
          setRequests((prev) => [payload.new, ...prev]);
          try {
            const audio = new Audio('/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleApprove = async (userId: string, email: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        approval_status: 'APPROVED',
        status: 'active',
      })
      .eq('id', userId);

    if (!error) {
      setRequests((prev) => prev.filter((r) => r.id !== userId));
      alert(`✅ ${email} approved successfully!`);
    } else {
      alert('Failed: ' + error.message);
    }
    setLoading(false);
  };

  const handleReject = async (userId: string, email: string) => {
    if (!confirm(`Reject ${email}?`)) return;

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: 'REJECTED' })
      .eq('id', userId);

    if (!error) {
      setRequests((prev) => prev.filter((r) => r.id !== userId));
      alert(`❌ ${email} rejected.`);
    } else {
      alert('Failed: ' + error.message);
    }
    setLoading(false);
  };

  const badgeCount = requests.length;
  const hasNew = badgeCount > lastSeenCount;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setLastSeenCount(badgeCount);
        }}
        className="relative p-2.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-700 transition shadow-sm border border-amber-300 cursor-pointer"
        title={`Pending Approvals (${currentUserRole})`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
        </svg>

        {badgeCount > 0 && (
          <>
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-md">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
            {hasNew && (
              <span className="absolute inset-0 rounded-full ring-2 ring-rose-400 animate-ping opacity-75 pointer-events-none" />
            )}
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-[380px] sm:w-[420px] bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden max-h-[80vh] flex flex-col">
          <div className="p-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex justify-between items-center">
            <div>
              <h3 className="font-black text-xs uppercase tracking-wide">
                ⏳ Pending User Approvals
              </h3>
              <p className="text-[10px] text-amber-100 mt-0.5">
                Logged in as: <span className="font-bold text-white">{currentUserRole}</span>
              </p>
            </div>
            <span className="px-2.5 py-1 bg-white/20 rounded-xl text-xs font-black">
              {badgeCount}
            </span>
          </div>

          <div className="overflow-y-auto flex-1 bg-slate-50/30">
            {requests.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                ✅ No pending approvals. All caught up!
              </div>
            ) : (
              requests.map((req) => (
                <div key={req.id} className="p-3.5 border-b border-slate-100 hover:bg-white transition">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-black shrink-0">
                      {(req.full_name || 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 text-xs truncate">{req.full_name || 'Unknown'}</p>
                      <p className="text-[10px] text-slate-500 truncate">{req.email}</p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded-md uppercase">
                          {req.user_type || 'USER'}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-md">
                          📍 {req.city}, {req.state}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-md">
                          📞 {req.mobile || 'N/A'}
                        </span>
                        {req.partner_id && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded-md">
                            🔗 Ref: {req.partner_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleApprove(req.id, req.email)}
                      disabled={loading}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => handleReject(req.id, req.email)}
                      disabled={loading}
                      className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {requests.length > 0 && (
            <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
              <p className="text-[10px] text-slate-500 font-medium">
                🔴 Live updates enabled
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}