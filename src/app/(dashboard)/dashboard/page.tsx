'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import PushNotificationManager from '@/components/PushNotificationManager';

/* CARD COMPONENT */
function Card({ title, value, color }: any) {
  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition">
      <p className="text-xs text-gray-400">{title}</p>
      <h2 className={`text-2xl font-bold ${color}`}>{value}</h2>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>({email: '', id: '', uuid: '', name: 'Loading...', wallet: 0, planType: 'BASIC ENGINE PLAN', isAdmin: false, approvalStatus: 'APPROVED', createdAt: null });
  const [estimateList, setEstimateList] = useState<any[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [filterType, setFilterType] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [refWidth, setRefWidth] = useState(240); 
  const [clientWidth, setClientWidth] = useState(240);

  // Modal State for Transaction History
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Search Filters States
  const [refSearch, setRefSearch] = useState(''); 
  const [clientSearch, setClientSearch] = useState('');
  const [representativeSearch, setRepresentativeSearch] = useState('');

  // Wallet Recharge & Admin Approval States
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeUTR, setRechargeUTR] = useState('');
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeRequests, setRechargeRequests] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
   const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const userEmail = user.email || '';
      const isAdmin = profile?.role === 'admin' || userEmail === 'admin@lnt.com' || profile?.user_type === 'Admin'; 

      setUserData({
        email: userEmail,
        id: profile?.user_code || user.id.slice(0, 8),
        uuid: user.id,
        name: profile?.full_name || "Guest User",
        wallet: Number(profile?.wallet_balance || 0),
        planType: profile?.plan_type || 'BASIC ENGINE PLAN',
        isAdmin: isAdmin,
        approvalStatus: profile?.approval_status || 'PENDING',
        createdAt: profile?.created_at || profile?.created_date || user.created_at
      });

      let query = supabase
        .from('mis_records')
        .select('*')
        .order('created_date', { ascending: true });

      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data } = await query;
      if (data) setEstimateList(data);

      fetchRecharges(user.id, isAdmin);
    };

    fetchData();
  }, []);

  const fetchRecharges = async (userId: string, isAdmin: boolean) => {
    let q = supabase.from('wallet_recharges').select('*').order('created_at', { ascending: false });
    if (!isAdmin) {
      q = q.eq('user_id', userId);
    }
    const { data } = await q;
    if (data) setRechargeRequests(data);
  };

  const handleRequestRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userData.approvalStatus !== 'APPROVED' && !userData.isAdmin) {
      alert('Your account is pending Admin approval. You cannot recharge until approved.');
      return;
    }
    if (!rechargeAmount || Number(rechargeAmount) <= 0) {
      alert('Please enter a valid recharge amount');
      return;
    }
    setRechargeLoading(true);
    try {
      const { error } = await supabase.from('wallet_recharges').insert({
        user_id: userData.uuid,
        user_email: userData.email,
        user_name: userData.name,
        amount: Number(rechargeAmount),
        utr_no: rechargeUTR || 'N/A',
        status: 'PENDING',
        created_at: new Date().toISOString()
      });

      if (error) throw error;
      alert('Recharge request submitted successfully to Admin for approval!');
      setRechargeAmount('');
      setRechargeUTR('');
      setIsRechargeModalOpen(false);
      fetchRecharges(userData.uuid, userData.isAdmin);
    } catch (err: any) {
      alert('Error submitting recharge request: ' + (err.message || err));
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleAdminApproveRecharge = async (reqId: string, targetUserId: string, reqAmount: number) => {
    try {
      const { error: updateErr } = await supabase
        .from('wallet_recharges')
        .update({ status: 'APPROVED' })
        .eq('id', reqId);
      if (updateErr) throw updateErr;

      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', targetUserId)
        .maybeSingle();

      const currentWallet = Number(targetProfile?.wallet_balance || 0);
      const newBalance = currentWallet + Number(reqAmount);

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', targetUserId);
      if (profileErr) throw profileErr;

      await supabase.from('wallet_transactions').insert({
        user_id: targetUserId,
        amount: Number(reqAmount),
        type: 'CREDIT',
        ref_no: `TOPUP-${Date.now().toString().slice(-6)}`,
        customer_name: 'Admin Topup',
        case_type: 'Wallet Recharge Approved',
        payment_mode: 'Admin Approval',
        balance_after: newBalance
      });

      alert('Recharge approved and user wallet updated successfully!');
      fetchRecharges(userData.uuid, userData.isAdmin);
    } catch (err: any) {
      alert('Approval failed: ' + (err.message || err));
    }
  };

  // LOGIC CALCULATIONS
  const currentDate = new Date();
  const targetLockDate = new Date('2026-08-20T00:00:00');
  const isAfterLockDate = currentDate > targetLockDate;
  
  // 21-day grace period check for new users
  const accountCreationDate = new Date(userData.createdAt || Date.now());
  const daysSinceCreation = (currentDate.getTime() - accountCreationDate.getTime()) / (1000 * 3600 * 24);
  const isWithinGracePeriod = daysSinceCreation <= 21;

  const isWalletLow = userData.wallet < 100;
  const isPremiumUser = (userData.planType || '').toUpperCase().includes('PREMIUM');
  const isFirstDateOfMonth = currentDate.getDate() === 1;

  // Admin & Premium users are NEVER locked or restricted for low balance
  const isAccountLocked = !userData.isAdmin && !isPremiumUser && !isWithinGracePeriod && isAfterLockDate && isWalletLow;
  
  // Low wallet warning banner (Excludes Admin, Premium users, and 21-day grace period users)
  // BUT Premium users get a special bill clearance alert on the 1st of every month.
  const showLowWalletWarning = !userData.isAdmin && !isPremiumUser && !isWithinGracePeriod && isWalletLow;
  const showPremiumBillClearAlert = isPremiumUser && isFirstDateOfMonth;

  // REF NO COLUMN RESIZE HANDLER
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = refWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentWidth = startWidth + (moveEvent.clientX - startX);
      if (currentWidth > 120) { 
        setRefWidth(currentWidth);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // CLIENT COLUMN RESIZE HANDLER
  const handleClientMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = clientWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentWidth = startWidth + (moveEvent.clientX - startX);
      if (currentWidth > 120) { 
        setClientWidth(currentWidth);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const totalValue = estimateList.reduce(
    (sum, i) => sum + Number(i.fee_standard || i.total_value || 0),
    0
  );

  const receivedAmount = estimateList
    .filter(i => (i.status || '').toUpperCase() === 'RECEIVED')
    .reduce((sum, i) => sum + Number(i.fee_standard || i.total_value || 0), 0);

  const pendingAmount = totalValue - receivedAmount;

  const filteredList = estimateList.filter(item => {
    const currentStatus = (item.status || 'PENDING').toUpperCase();
    if (filterType === 'Paid' && currentStatus !== 'RECEIVED') return false;
    if (filterType === 'Pending' && currentStatus === 'RECEIVED') return false;

    const itemRef = (item.ref_no || '').toLowerCase();
    if (refSearch && !itemRef.includes(refSearch.toLowerCase())) return false;

    const itemClient = (item.client || item.client_name || '').toLowerCase();
    if (clientSearch && !itemClient.includes(clientSearch.toLowerCase())) return false;

    const itemRep = (item.representative || item.rep_name || '').toLowerCase();
    if (representativeSearch && !itemRep.includes(representativeSearch.toLowerCase())) return false;

    return true;
  });

  const isApproved = userData.isAdmin || userData.approvalStatus === 'APPROVED';

  return (
    <div className="p-6 space-y-6 relative">

      {/* PREMIUM USER 1ST OF THE MONTH BILL CLEARANCE ALERT */}
      {showPremiumBillClearAlert && (
        <div className="bg-blue-900 text-white px-5 py-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <h4 className="font-extrabold text-sm uppercase tracking-wide">Monthly Bill Clearance Alert (1st of the Month)</h4>
              <p className="text-xs opacity-95 mt-0.5">
                Dear Premium Subscriber, please review and clear your monthly subscription billing statement and ledger balance.
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/billing-ledger')} // Aapka billing page route
            className="bg-amber-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs uppercase shadow-md hover:bg-amber-300 transition whitespace-nowrap"
          >
            View Bill & Clear
          </button>
        </div>
      )}

      {/* LOW WALLET BALANCE RECHARGE NOTIFICATION BANNER */}
      {showLowWalletWarning && (
        <div className="bg-rose-600 text-white px-5 py-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="font-extrabold text-sm uppercase tracking-wide">Low Wallet Balance Alert!</h4>
              <p className="text-xs opacity-95 mt-0.5">
                Your wallet balance is <strong className="underline">₹{userData.wallet.toFixed(2)}</strong> (less than ₹100). Please recharge your wallet to maintain uninterrupted service.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsRechargeModalOpen(true)}
            className="bg-white text-rose-600 font-black px-5 py-2.5 rounded-xl text-xs uppercase shadow-md hover:bg-rose-50 transition whitespace-nowrap"
          >
            Recharge Now
          </button>
        </div>
      )}

      {/* HEADER WITH NOTIFICATION BELL & PROFILE */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-black text-slate-800 uppercase">
          {userData.isAdmin ? 'LNT ADMIN DASHBOARD (ALL RECORDS)' : 'LNT DASHBOARD'}
        </h1>

        <div className="flex items-center gap-3">
          
          {/* PROFESSIONAL NOTIFICATION BELL BUTTON WITH DROPDOWN */}
          <div className="relative">
            <button
              onClick={async () => {
                setShowNotifications(!showNotifications);
                if (!('Notification' in window)) return;
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                  new Notification("L&T Consultant Services", {
                    body: "Notifications are enabled! You will receive daily 24/7 sale estimate & map drafting alerts.",
                    icon: "/favicon.ico"
                  });
                }
              }}
              className="relative p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition shadow-sm border border-slate-200"
              title="Notifications"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-600 rounded-full ring-2 ring-white"></span>
            </button>

            {/* NOTIFICATION MESSAGE DROPDOWN */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden text-slate-700 font-sans">
                <div className="bg-slate-900 p-3 text-white flex justify-between items-center">
                  <span className="font-bold text-xs uppercase tracking-wider">Notifications</span>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-white text-sm font-bold"
                  >
                    &times;
                  </button>
                </div>
                <div className="p-4 space-y-2 bg-slate-50/50">
                  {showLowWalletWarning && (
                    <div className="bg-red-50 p-3 rounded-xl border border-red-200 shadow-sm space-y-2">
                      <p className="font-bold text-xs text-red-600">⚠️ Low Wallet Balance Alert!</p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Your current wallet balance is <b className="text-red-600">₹{userData.wallet.toFixed(2)}</b> (less than ₹100). Please recharge your wallet immediately.
                      </p>
                      {isApproved && (
                        <button 
                          onClick={() => {
                            setShowNotifications(false);
                            setIsRechargeModalOpen(true);
                          }}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-1.5 rounded-lg text-[10px] uppercase transition shadow-sm"
                        >
                          Recharge Now
                        </button>
                      )}
                    </div>
                  )}

                  {showPremiumBillClearAlert && (
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 shadow-sm space-y-2">
                      <p className="font-bold text-xs text-blue-900">📋 Monthly Bill Clearance</p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        Today is the 1st of the month. Please clear your subscription bill statement.
                      </p>
                    </div>
                  )}

                  {!isApproved && !userData.isAdmin && (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 shadow-sm space-y-1">
                      <p className="font-bold text-xs text-amber-800">⏳ Account Pending Approval</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Your account registration is under review by Admin. Once approved, you will be able to access Ledger and Wallet Recharges.
                      </p>
                    </div>
                  )}

                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-1">
                    <p className="font-bold text-xs text-blue-600">☀️ Good Morning! L&T Consultant</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Get your sale estimate & map drafting done 24/7 anytime via L&T Consultant Software.
                    </p>
                    <p className="text-[10px] text-slate-400 pt-1">Just now</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PROFILE */}
          <div className="relative">
            <div
              onClick={() => setShowProfile(!showProfile)}
              className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold cursor-pointer shadow-sm"
            >
              {userData?.email?.charAt(0).toUpperCase()}
            </div>

            {showProfile && (
              <div className="absolute right-0 mt-3 w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden text-slate-700 font-sans">
                <div className="bg-blue-600 p-4 text-white flex items-center gap-3">
                  <div className="bg-blue-500/30 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </div>
                  <span className="font-bold text-sm tracking-wider uppercase">
                    {userData.isAdmin ? 'ADMIN ACCOUNT' : 'ACCOUNT STATUS'}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  <div className="space-y-3 pb-4 border-b border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-500">USER NAME</span>
                      <span className="font-extrabold text-slate-900 uppercase">{userData.name}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-500">USER EMAIL</span>
                      <span className="font-bold text-slate-900">{userData?.email}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-500">SYSTEM ID</span>
                      <span className="font-bold text-slate-900">{userData?.id}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-500">APPROVAL STATUS</span>
                      <span className={`font-extrabold uppercase ${isApproved ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {userData.isAdmin ? 'ADMIN' : userData.approvalStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs">
                    <span className="font-bold uppercase text-slate-700">PLAN TYPE</span>
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-md font-extrabold tracking-wide text-[10px] uppercase">
                      {userData?.planType}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">WALLET AMOUNT</p>
                      <p className={`text-lg font-black ${userData.wallet < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {userData.wallet < 0 ? `- ₹ ${Math.abs(userData.wallet).toFixed(2)}` : `₹ ${userData?.wallet?.toFixed(2) || '0.00'}`}
                      </p>
                    </div>
                    
                    {/* RECHARGE & LEDGER ACCESSIBLE FROM PROFILE DROPDOWN */}
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => {
                          setShowProfile(false);
                          router.push('/wallet-ledger');
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-3 py-2 rounded-lg transition shadow-sm uppercase tracking-wider"
                      >
                        Ledger
                      </button>
                      <button 
                        onClick={() => {
                          setShowProfile(false);
                          setIsRechargeModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2 rounded-lg transition shadow-md shadow-blue-200 uppercase tracking-wider"
                      >
                        Recharge
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs font-bold">
                    <button 
                      onClick={() => router.push('/edit-profile')} 
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition group uppercase"
                    >
                      <span>EDIT PROFILE (PRE-FILLED)</span>
                    </button>

                    <button 
                      onClick={async () => {
                        try {
                          await supabase.from('profiles').update({ is_online: false }).eq('id', userData.uuid);
                          await supabase.auth.signOut();
                          router.push('/verify-estimate');
                        } catch (err: any) {
                          alert('Logout failed: ' + (err.message || err));
                        }
                      }}
                      className="w-full flex items-center p-3 rounded-xl hover:bg-red-50 text-red-600 transition group mt-2 uppercase"
                    >
                      <span>LOGOUT</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DASHBOARD CONTENT WRAPPER */}
      <div className={`relative space-y-6 ${isAccountLocked ? 'pointer-events-none opacity-40 select-none' : ''}`}>

        {/* KPI CARDS */}
        <div className="grid grid-cols-4 gap-4">
          <Card title="TOTAL" value={totalValue} color="text-slate-800" />
          <Card title="RECEIVED" value={receivedAmount} color="text-green-600" />
          <Card title="PENDING" value={pendingAmount} color="text-red-600" />
          <Card title="ESTIMATES" value={estimateList.length} color="text-blue-600" />
        </div>

        {/* ADMIN RECHARGE APPROVAL SECTION */}
        {userData.isAdmin && rechargeRequests.filter(r => r.status === 'PENDING').length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-black text-amber-800 uppercase tracking-wide">Pending Wallet Recharge Requests (Admin Dashboard)</h2>
            <div className="space-y-2">
              {rechargeRequests.filter(r => r.status === 'PENDING').map(req => (
                <div key={req.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-amber-100 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{req.user_name || req.user_email}</p>
                    <p className="text-slate-500">Amount: <span className="font-black text-emerald-600">₹{req.amount}</span> | UTR / Ref: <span className="font-mono font-bold text-blue-600">{req.utr_no}</span></p>
                  </div>
                  <button
                    onClick={() => handleAdminApproveRecharge(req.id, req.user_id, req.amount)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-1.5 rounded-lg shadow uppercase transition"
                  >
                    Approve Recharge
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FILTER BAR */}
        <div className="flex justify-between items-center">
          <div className="flex gap-3">
            {['All', 'Paid', 'Pending'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${
                  filterType === type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          {isApproved ? (
            <button
              onClick={() => router.push('/wallet-ledger')}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition uppercase tracking-wide"
            >
              View Wallet & Ledger Passbook
            </button>
          ) : (
            <span className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg font-bold border border-amber-200">
              Ledger Locked (Pending Admin Approval)
            </span>
          )}
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-slate-100">
          <table className="w-full text-left border-collapse table-fixed min-w-[1250px]">
            <thead>
              <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider text-center select-none">
                
                <th style={{ width: `${refWidth}px` }} className="p-2 text-center relative group">
                  <div className="flex flex-col gap-1 items-center">
                    <span className="px-1 text-[10px] font-bold text-slate-300">REF NO</span>
                    <input
                      type="text"
                      placeholder="Filter Ref No..."
                      value={refSearch}
                      onChange={(e) => setRefSearch(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-white text-center focus:outline-none focus:border-blue-400 font-normal placeholder:text-slate-500"
                    />
                  </div>
                  <div onMouseDown={handleMouseDown} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent group-hover:bg-blue-500 cursor-col-resize transition-colors z-10" />
                </th>

                <th className="p-3 font-semibold w-24 text-center">DATE</th>
                <th className="p-3 font-semibold w-52 text-center">CUSTOMER NAME</th>
                
                <th style={{ width: `${clientWidth}px` }} className="p-2 text-center relative group">
                  <div className="flex flex-col gap-1 items-center">
                    <span className="px-1 text-[10px] font-bold text-slate-300">CLIENT</span>
                    <input
                      type="text"
                      placeholder="Filter Client..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-white text-center focus:outline-none focus:border-blue-400 font-normal placeholder:text-slate-500"
                    />
                  </div>
                  <div onMouseDown={handleClientMouseDown} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent group-hover:bg-blue-500 cursor-col-resize transition-colors z-10" />
                </th>

                <th className="p-2 w-48 text-center">
                  <div className="flex flex-col gap-1 items-center">
                    <span className="px-1 text-[10px] font-bold text-slate-300">REPRESENTATIVE</span>
                    <input
                      type="text"
                      placeholder="Filter Rep..."
                      value={representativeSearch}
                      onChange={(e) => setRepresentativeSearch(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-white text-center focus:outline-none focus:border-blue-400 font-normal placeholder:text-slate-500"
                    />
                  </div>
                </th>

                <th className="p-3 font-semibold w-48 text-center">CASE TYPE</th>
                <th className="p-3 font-semibold w-28 text-center">FEE STANDARD</th>
                <th className="p-3 font-semibold w-28 text-center">STATUS</th>
                <th className="p-3 font-semibold w-36 text-center">TRANSACTION</th>
              </tr>
            </thead>
            
            <tbody>
              {filteredList.map(est => {
                const dateSource = est.created_date || est.created_at;
                const dateObj = dateSource ? new Date(dateSource) : null;
                const formattedDate = dateObj 
                  ? `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`
                  : '-';

                let cleanCustomerName = est.customer_name || '-';
                const match = cleanCustomerName.match(/^(.*?)\s+(s\/o|d\/o|w\/o|c\/o|S\/O|D\/O|W\/O|C\/O)\b/i);
                if (match && match[1]) {
                  cleanCustomerName = match[1].trim();
                }

                return (
                  <tr key={est.id} className="border-t hover:bg-slate-50 text-xs font-sans tracking-wide">
                    <td className="p-3 font-bold text-blue-600 uppercase whitespace-nowrap overflow-hidden text-ellipsis">
                      {est.ref_no}
                    </td>
                    <td className="p-3 text-slate-600 text-center whitespace-nowrap">{formattedDate}</td>
                    <td className="p-3 font-extrabold text-slate-800 uppercase whitespace-nowrap overflow-hidden text-ellipsis">
                      {cleanCustomerName.replace(/[,.]\s*$/, '')}
                    </td>
                    <td className="p-3 font-bold text-slate-700 uppercase text-center truncate">
                      {est.client_name || '-'}
                    </td>
                    <td className="p-3 font-semibold text-slate-600 uppercase text-center truncate">
                      {est.representative || '-'}
                    </td>
                    <td className="p-3 font-black text-slate-900 uppercase text-center whitespace-nowrap">
                      {est.case_type || 'NEW CONSTRUCTION'}
                    </td>
                    <td className="p-3 font-bold text-slate-800 text-center whitespace-nowrap">
                      ₹{est.fee_standard || '0'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                        (est.status || 'PENDING').toUpperCase() === 'RECEIVED' ? 'bg-emerald-100 text-emerald-600' :
                        (est.status || 'PENDING').toUpperCase() === 'WAIVED' ? 'bg-slate-100 text-slate-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {(est.status || 'PENDING').toUpperCase()}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedTxn(est);
                          setIsModalOpen(true);
                        }}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1 rounded-lg text-xs transition border border-blue-200 uppercase"
                      >
                        History
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* LOCK MESSAGE BANNER OVERLAY */}
      {isAccountLocked && (
        <div className="absolute inset-x-6 top-32 z-40 bg-slate-900/95 text-white p-8 rounded-3xl shadow-2xl border-2 border-rose-500 text-center space-y-4 backdrop-blur-md">
          <span className="text-4xl">🔒</span>
          <h3 className="text-xl font-black uppercase text-rose-500 tracking-wider">Dashboard Locked (Recharge Required)</h3>
          <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
            Your 21-day trial period has ended. As per platform policy effective after August 20, 2026, accounts with a wallet balance below ₹100 are restricted. Your current balance is <strong className="text-rose-400">₹{userData.wallet.toFixed(2)}</strong>.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setIsRechargeModalOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg transition"
            >
              Recharge Wallet Now to Unlock
            </button>
          </div>
        </div>
      )}

      {/* WALLET RECHARGE MODAL */}
      {isRechargeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base uppercase">Recharge Wallet</h3>
              <button 
                onClick={() => setIsRechargeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRequestRecharge} className="space-y-4 text-xs">
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-blue-800">
                <p className="font-bold">Instructions:</p>
                <p className="mt-1">Transfer funds via UPI/Bank Transfer, enter the amount and UTR / Transaction Reference ID below, and submit for Admin approval.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase">Recharge Amount (₹)</label>
                <input 
                  type="number"
                  placeholder="e.g. 1000"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-bold text-sm focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase">UTR No / UPI Transaction Reference</label>
                <input 
                  type="text"
                  placeholder="Enter UTR or UPI Ref ID"
                  value={rechargeUTR}
                  onChange={(e) => setRechargeUTR(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-bold text-sm focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRechargeModalOpen(false)}
                  className="w-1/2 bg-gray-200 hover:bg-gray-300 text-slate-700 font-bold py-2.5 rounded-xl uppercase transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rechargeLoading}
                  className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-xl uppercase transition shadow-md shadow-blue-200"
                >
                  {rechargeLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSACTION HISTORY MODAL POPUP */}
      {isModalOpen && selectedTxn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base">Transaction History</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Reference No:</span>
                <span className="font-bold text-blue-600">{selectedTxn.ref_no}</span>
              </div>
              
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Customer Name:</span>
                <span className="font-bold text-slate-800 uppercase">{selectedTxn.customer_name}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Case Type:</span>
                <span className="font-bold text-slate-900 uppercase">{selectedTxn.case_type || selectedTxn.estimate_type || 'NEW CONSTRUCTION'}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Amount Paid:</span>
                <span className="font-extrabold text-emerald-600 text-sm">₹ {Number(selectedTxn.user_payment || selectedTxn.fee_standard || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Payment ID / Mode:</span>
                <span className="font-mono font-semibold text-slate-800">{selectedTxn.razorpay_payment_id || 'WALLET DEDUCTION'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 font-medium">Date & Time:</span>
                <span className="font-semibold text-slate-700">
                  {new Date(selectedTxn.created_at || selectedTxn.created_date || Date.now()).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-xl text-xs transition uppercase"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="text-xs text-gray-400 text-center pt-4">
        © 2026 LNT WITH AI 2.0 RIGHTS RESERVED
      </div>

    </div>
  );
}