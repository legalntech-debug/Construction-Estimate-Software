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

  // 🆕 Profile Modal States
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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
      .select('id, full_name, email, mobile, city, state, user_type, partner_id, created_at, user_code, firm_name, plan_type, address, aadhaar_no, referred_by, role, second_role')
      .eq('approval_status', 'PENDING')
      .order('created_at', { ascending: false });

    if (data) setRequests(data);
  };

  useEffect(() => {
    fetchPending();

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
      setIsProfileModalOpen(false);
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
      setIsProfileModalOpen(false);
    } else {
      alert('Failed: ' + error.message);
    }
    setLoading(false);
  };

  const handleWhatsAppUser = (user: any) => {
    if (!user) {
      alert('User data not available.');
      return;
    }

    const rawMobile = user.mobile || '';
    const digitsOnly = rawMobile.replace(/[^0-9]/g, '');

    if (!digitsOnly || digitsOnly.length < 10) {
      alert(`⚠️ User's mobile number is missing or invalid.\n\nMobile on record: "${rawMobile || 'N/A'}"`);
      return;
    }

    const whatsappNumber = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

    const userName = user.full_name || 'User';
    const userCode = user.user_code || 'N/A';
    const userType = user.user_type || 'USER';
    const city = user.city || 'N/A';
    const state = user.state || 'N/A';
    const firmName = user.firm_name || 'N/A';
    const planType = user.plan_type || 'N/A';
    const email = user.email || 'N/A';
    const referredBy = user.referred_by || 'DIRECT';

    const message = 
`🏛️ *Legal n Tech — Account Verification*

Dear *${userName}*,

Your account registration has been received. We need to verify a few details before final approval.

━━━━━━━━━━━━━━━━━━
📋 *Your Registration Details*
━━━━━━━━━━━━━━━━━━
• *User Code:* ${userCode}
• *Email:* ${email}
• *User Type:* ${userType}
• *Plan Type:* ${planType}
• *Firm Name:* ${firmName}
• *City/State:* ${city}, ${state}
• *Referred By:* ${referredBy}

━━━━━━━━━━━━━━━━━━
✍️ *Please confirm by replying:*
━━━━━━━━━━━━━━━━━━
✅ *"VERIFY"* — All details are correct, please approve my account.

❌ *"UPDATE"* — I need to correct some details. (Please specify what)

❓ *"CALL"* — Please call me for verification.

━━━━━━━━━━━━━━━━━━
📞 Or contact us directly at:
• Helpline: 7987561396
• Email: legalntech@gmail.com

⏱️ Kindly reply within 24 hours to activate your account quickly.

Thank you,
*Legal n Tech Consultant Services*
_DRC Software Engine — Account Verification Team_`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');

    try {
      const trackKey = `wa_approval_sent_${user.id}`;
      localStorage.setItem(trackKey, new Date().toISOString());
      console.log('✅ WhatsApp approval confirmation initiated for:', user.id);
    } catch (e) {
      console.warn('Tracking failed:', e);
    }
  };

  const handleOpenProfile = (user: any) => {
    setSelectedUser(user);
    setIsProfileModalOpen(true);
  };

  const badgeCount = requests.length;
  const hasNew = badgeCount > lastSeenCount;

  return (
    <>
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
          <>
            {/* 🔥 MOBILE BACKDROP - only visible on small screens */}
            <div 
              className="fixed inset-0 bg-black/40 z-[60] sm:hidden" 
              onClick={() => setIsOpen(false)}
            />

            {/* 🔥 DROPDOWN - fixed & centered on mobile, absolute on desktop */}
            <div className="
              fixed top-20 left-1/2 -translate-x-1/2 w-[calc(100vw-1.5rem)] max-w-[440px]
              sm:absolute sm:right-0 sm:left-auto sm:translate-x-0 sm:top-auto sm:mt-3 sm:w-[440px]
              bg-white shadow-2xl rounded-2xl border border-slate-100 z-[70]
              overflow-hidden max-h-[80vh] flex flex-col
            ">
              <div className="p-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex justify-between items-center">
                <div className="min-w-0 pr-2">
                  <h3 className="font-black text-xs uppercase tracking-wide truncate">
                    ⏳ Pending User Approvals
                  </h3>
                  <p className="text-[10px] text-amber-100 mt-0.5 truncate">
                    Logged in as: <span className="font-bold text-white">{currentUserRole}</span>
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-white/20 rounded-xl text-xs font-black shrink-0">
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

                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleWhatsAppUser(req)}
                          disabled={!req.mobile}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1 ${
                            req.mobile
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                          title={req.mobile ? `WhatsApp ${req.mobile}` : 'Mobile not available'}
                        >
                          💬 WhatsApp
                        </button>
                        <button
                          onClick={() => handleOpenProfile(req)}
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          👤 View Profile
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
          </>
        )}
      </div>

      {/* 🆕 USER PROFILE MODAL */}
      {isProfileModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm sm:text-base font-black tracking-tight">👤 Pending User Details</h3>
                <p className="text-[10px] sm:text-[11px] text-indigo-100 mt-0.5">Review full details before approval</p>
              </div>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition text-xs shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="bg-amber-50 border-2 border-amber-300 p-3 rounded-xl">
                <p className="text-xs text-amber-800 font-bold">
                  ⏳ Awaiting Admin Approval
                </p>
                <p className="text-[10px] text-amber-700 mt-1">
                  Registered on: {new Date(selectedUser.created_at).toLocaleString('en-IN')}
                </p>
              </div>

              {/* 🔥 MOBILE FIX: grid-cols-1 on mobile, grid-cols-2 on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 sm:col-span-2">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Full Name</p>
                  <p className="text-sm font-bold text-slate-800">
                    {selectedUser.full_name || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Email</p>
                  <p className="text-xs font-bold text-slate-800 truncate" title={selectedUser.email}>
                    {selectedUser.email || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Mobile</p>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedUser.mobile || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">User Code</p>
                  <p className="text-xs font-mono font-bold text-slate-800">
                    {selectedUser.user_code || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">User Type</p>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedUser.user_type || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Plan Type</p>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedUser.plan_type || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Firm Name</p>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedUser.firm_name || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">City</p>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedUser.city || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">State</p>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedUser.state || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Referred By</p>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedUser.referred_by || 'DIRECT'}
                  </p>
                </div>
                {selectedUser.partner_id && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                    <p className="text-[10px] text-amber-600 uppercase font-bold">Partner ID</p>
                    <p className="text-xs font-mono font-bold text-amber-700">
                      {selectedUser.partner_id}
                    </p>
                  </div>
                )}
                {selectedUser.role && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Role</p>
                    <p className="text-xs font-bold text-slate-800">
                      {selectedUser.role}
                    </p>
                  </div>
                )}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 sm:col-span-2">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Address</p>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedUser.address || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 sm:col-span-2">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">User ID (UUID)</p>
                  <p className="text-[10px] font-mono text-slate-600 break-all">
                    {selectedUser.id}
                  </p>
                </div>
              </div>

              <div className="bg-green-50 border-2 border-green-300 p-4 rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-2xl">📱</span>
                  <div className="flex-1">
                    <p className="text-xs font-black text-green-800 uppercase">
                      WhatsApp Verification Request
                    </p>
                    <p className="text-[10px] text-green-700 mt-0.5">
                      Send a pre-filled verification message to <b>{selectedUser.full_name || 'this user'}</b> at <b>{selectedUser.mobile || 'N/A'}</b>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleWhatsAppUser(selectedUser)}
                  disabled={!selectedUser.mobile}
                  className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wide shadow-sm transition flex items-center justify-center gap-2 ${
                    selectedUser.mobile
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span>💬</span>
                  <span>Send WhatsApp Verification</span>
                </button>

                {(() => {
                  try {
                    const sentAt = localStorage.getItem(`wa_approval_sent_${selectedUser.id}`);
                    if (sentAt) {
                      const sentTime = new Date(sentAt);
                      const minutesAgo = Math.floor((Date.now() - sentTime.getTime()) / 60000);
                      return (
                        <div className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-center font-bold">
                          ⚠️ WhatsApp message sent {minutesAgo < 1 ? 'just now' : `${minutesAgo} min ago`}
                        </div>
                      );
                    }
                  } catch (e) {}
                  return null;
                })()}
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                <p className="text-[10px] text-slate-500 uppercase font-bold text-center">
                  Quick Actions
                </p>
                {/* 🔥 MOBILE FIX: stack vertically on mobile */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => handleApprove(selectedUser.id, selectedUser.email)}
                    disabled={loading}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer"
                  >
                    ✅ Approve User
                  </button>
                  <button
                    onClick={() => handleReject(selectedUser.id, selectedUser.email)}
                    disabled={loading}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer"
                  >
                    ❌ Reject User
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}