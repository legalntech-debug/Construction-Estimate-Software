'use client';

import { useState, useEffect, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Wallet, Users, UserPlus, Lock, Search, CreditCard, ArrowUpRight, 
  Landmark, X, PlusCircle, Filter, Eye, EyeOff, LogOut, 
  AlertTriangle, PhoneCall, UserX, ExternalLink, Calculator, CheckCircle
} from 'lucide-react';
import AddUserModal from './components/AddUserModal';
import PartnerProfileCard from './components/PartnerProfileCard';
import PayoutBreakdownModal from './components/PayoutBreakdownModal';
import PartnerApprovalLockModal from './components/PartnerApprovalLockModal';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PartnerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAdminOrCEO, setIsAdminOrCEO] = useState(false);
  const [isLevel1Approver, setIsLevel1Approver] = useState(false);

  // Approval Verification State
  const [hasPartnerAccount, setHasPartnerAccount] = useState<boolean>(true);
  const [approvalStatus, setApprovalStatus] = useState<string>('PENDING');
  const [approvedByLevel1, setApprovedByLevel1] = useState<string | null>(null);
  const [approvedByAdmin, setApprovedByAdmin] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'network' | 'settlement'>('network');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  const [allPartners, setAllPartners] = useState<any[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [referralRevenue, setReferralRevenue] = useState<number>(0);
  const [totalSettled, setTotalSettled] = useState<number>(0);

  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [showUnpaidOnly, setShowUnpaidOnly] = useState<boolean>(false);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutDate, setPayoutDate] = useState('');
  const [payoutMonth, setPayoutMonth] = useState('August 2026');
  const [payoutMode, setPayoutMode] = useState('UPI / NEFT');
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');

  useEffect(() => {
    if (sessionStorage.getItem('partner_ledger_unlocked') === 'true') {
      setIsUnlocked(true);
    }
    fetchInitialData();
    return () => sessionStorage.removeItem('partner_ledger_unlocked');
  }, []);

  useEffect(() => {
    if (!isUnlocked || !session) return;
    const interval = setInterval(() => {
      if (isAdminOrCEO && selectedPartnerId) {
        const selected = allPartners.find((p) => p.partner_id === selectedPartnerId);
        if (selected) loadPartnerDetails(selected.partner_id, selected.user_id);
      } else if (partnerProfile) {
        loadPartnerDetails(partnerProfile.partner_id, session.user.id);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [isUnlocked, session, selectedPartnerId, partnerProfile, isAdminOrCEO, allPartners]);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setSession(session);

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    setProfile(userProfile);
    const hasAdminAccess = ['Admin', 'admin', 'CEO', 'ceo'].includes(userProfile?.user_type || userProfile?.role);
    const isL1 = ['Co-Partner', 'CO PARTNER', 'ENGINEER', 'CEO', 'Admin'].includes(userProfile?.role || userProfile?.user_type);
    
    setIsAdminOrCEO(hasAdminAccess);
    setIsLevel1Approver(isL1);

    if (hasAdminAccess) {
      const { data: partners } = await supabase
        .from('partner_profiles')
        .select(`*, profiles:user_id (*)`);

      const partnerList = (partners || []).filter((p) => {
        const role = (p.profiles?.role || '').toLowerCase();
        const userType = (p.profiles?.user_type || '').toLowerCase();
        const userCode = (p.profiles?.user_code || '').toLowerCase();
        return role !== 'admin' && userType !== 'admin' && userCode !== 'admin001';
      });

      setAllPartners(partnerList);
      if (partnerList.length > 0) {
        setSelectedPartnerId(partnerList[0].partner_id);
        setPartnerProfile(partnerList[0]);
        setApprovalStatus(partnerList[0].approval_status || 'PENDING');
        setApprovedByLevel1(partnerList[0].approved_by_level1);
        setApprovedByAdmin(partnerList[0].approved_by_admin);
        await loadPartnerDetails(partnerList[0].partner_id, partnerList[0].user_id);
      }
    } else {
      const { data: partnerData } = await supabase
        .from('partner_profiles')
        .select(`*, profiles:user_id (*)`)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!partnerData) {
        setHasPartnerAccount(false);
      } else {
        setHasPartnerAccount(true);
        setPartnerProfile(partnerData);
        setApprovalStatus(partnerData.approval_status || 'PENDING');
        setApprovedByLevel1(partnerData.approved_by_level1);
        setApprovedByAdmin(partnerData.approved_by_admin);
        if (partnerData.approval_status === 'APPROVED') {
          await loadPartnerDetails(partnerData.partner_id, session.user.id);
        }
      }
    }
    setLoading(false);
  };

  const loadPartnerDetails = async (partnerId: string, userId: string) => {
    const { data: partnerUserData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const userCode = partnerUserData?.user_code || 'U001';

    const { data: rawDirectProfiles } = await supabase
      .from('profiles')
      .select('*')
      .or(`referred_by.eq.${partnerId},referred_by.eq.${userCode},referred_by.eq.${userId}`)
      .neq('id', userId);

    const directProfiles = (rawDirectProfiles || []).filter((p) => {
      const role = (p.role || '').toLowerCase();
      const userType = (p.user_type || '').toLowerCase();
      const uCode = (p.user_code || '').toLowerCase();
      return role !== 'admin' && userType !== 'admin' && uCode !== 'admin001';
    });

    const { data: rawMappings } = await supabase
      .from('partner_user_mapping')
      .select(`*, profiles:referred_user_id (id, full_name, email, mobile, created_at, user_type, role, user_code)`)
      .eq('partner_id', partnerId);

    const mappings = (rawMappings || []).filter((m) => {
      const role = (m.profiles?.role || '').toLowerCase();
      const userType = (m.profiles?.user_type || '').toLowerCase();
      const uCode = (m.profiles?.user_code || '').toLowerCase();
      return role !== 'admin' && userType !== 'admin' && uCode !== 'admin001';
    });

    const mappedUserIds = new Set(mappings.map((m) => m.referred_user_id));
    const directUserIds = directProfiles.map((p) => p.id);
    const allReferredUserIds = Array.from(new Set([...Array.from(mappedUserIds), ...directUserIds]));

    const revenueMap: Record<string, number> = {};
    if (allReferredUserIds.length > 0) {
      const { data: misData } = await supabase
        .from('mis_records')
        .select('user_id, user_payment, fee_standard')
        .in('user_id', allReferredUserIds);

      (misData || []).forEach((row) => {
        if (row.user_id) {
          const paymentAmount = Number(row.user_payment) || Number(row.fee_standard) || 0;
          revenueMap[row.user_id] = (revenueMap[row.user_id] || 0) + paymentAmount;
        }
      });
    }

    const processUserData = (rawDate: string) => {
      const addedDate = rawDate ? new Date(rawDate) : new Date();
      const expiryDate = new Date(addedDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      const today = new Date();
      const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const isExpired = daysLeft <= 0;

      const opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
      return {
        rawDate: addedDate,
        addedDateStr: addedDate.toLocaleDateString('en-IN', opt).toUpperCase(),
        expiryDateStr: expiryDate.toLocaleDateString('en-IN', opt).toUpperCase(),
        daysLeft: isExpired ? 0 : daysLeft,
        isExpired,
        statusLabel: isExpired ? 'DEACTIVE (1-YR EXPIRED)' : `${daysLeft} DAYS REMAINING`
      };
    };

    const formattedDirectUsers = directProfiles
      .filter((p) => !mappedUserIds.has(p.id))
      .map((p) => {
        const { rawDate, addedDateStr, expiryDateStr, daysLeft, isExpired, statusLabel } = processUserData(p.created_at);
        const paidRevenue = revenueMap[p.id] || 0;
        return {
          id: p.id,
          rawDate,
          profiles: p,
          case_type: p.plan_type || 'BASIC PLAN',
          added_date: addedDateStr,
          expiry_date: expiryDateStr,
          days_left: daysLeft,
          paid_revenue: paidRevenue,
          earned_commission_3percent: isExpired ? 0 : paidRevenue * 0.03,
          is_expired: isExpired,
          status: statusLabel
        };
      });

    const formattedMappings = mappings.map((m) => {
      const rawDate = m.profiles?.created_at || m.created_at;
      const { rawDate: dateObj, addedDateStr, expiryDateStr, daysLeft, isExpired, statusLabel } = processUserData(rawDate);
      const paidRevenue = revenueMap[m.referred_user_id] || m.paid_revenue || 0;
      return {
        ...m,
        rawDate: dateObj,
        added_date: addedDateStr,
        expiry_date: expiryDateStr,
        days_left: daysLeft,
        paid_revenue: paidRevenue,
        earned_commission_3percent: isExpired ? 0 : paidRevenue * 0.03,
        is_expired: isExpired,
        status: statusLabel
      };
    });

    const combinedList = [...formattedMappings, ...formattedDirectUsers];
    setReferredUsers(combinedList);

    const calculatedActiveRevenue = combinedList.reduce((acc, curr) => acc + (curr.earned_commission_3percent || 0), 0);
    setReferralRevenue(calculatedActiveRevenue);

    const { data: payouts } = await supabase
      .from('partner_payouts')
      .select('*')
      .or(`partner_id.eq.${partnerId},user_id.eq.${userId}`)
      .order('payout_date', { ascending: false });

    const payoutList = payouts || [];
    const calculatedTotalSettled = payoutList.reduce((acc, item) => acc + (Number(item.amount_settled) || 0), 0);
    setPayoutHistory(payoutList);
    setTotalSettled(calculatedTotalSettled);
  };

  // Inside handleApprovePartner function in PartnerDashboardPage.tsx:

const handleApprovePartner = async (targetPartnerId: string, level: 'LEVEL1' | 'ADMIN') => {
  const approverName = profile?.full_name || (level === 'LEVEL1' ? 'LEVEL_1_APPROVER' : 'ADMIN');
  const updatePayload: any = {};

  if (level === 'LEVEL1') {
    // Madhusmita or Jayant Approval
    updatePayload.approved_by_level1 = approverName;
  } else if (level === 'ADMIN') {
    // DRC Consultant Final Approval
    updatePayload.approved_by_admin = approverName;
    updatePayload.approval_status = 'APPROVED';
  }

  const { error } = await supabase
    .from('partner_profiles')
    .update(updatePayload)
    .eq('partner_id', targetPartnerId);

  if (!error) {
    await fetchInitialData();
  } else {
    alert('Approval Error: ' + error.message);
  }
};

  const filteredReferredUsers = useMemo(() => {
    return referredUsers.filter((u) => {
      const uDate = u.rawDate ? new Date(u.rawDate) : new Date();
      const monthName = uDate.toLocaleString('default', { month: 'long' }).toUpperCase();
      const yearStr = uDate.getFullYear().toString();

      const matchesMonth = filterMonth === 'ALL' || monthName.includes(filterMonth.toUpperCase());
      const matchesYear = filterYear === 'ALL' || yearStr === filterYear;
      const matchesUnpaid = !showUnpaidOnly || u.paid_revenue === 0;

      return matchesMonth && matchesYear && matchesUnpaid;
    });
  }, [referredUsers, filterMonth, filterYear, showUnpaidOnly]);

  const networkStats = useMemo(() => {
    const rev = filteredReferredUsers.reduce((sum, u) => sum + (u.paid_revenue || 0), 0);
    const payout = filteredReferredUsers.reduce((sum, u) => sum + (u.earned_commission_3percent || 0), 0);
    const paidCount = filteredReferredUsers.filter((u) => u.paid_revenue > 0).length;
    const unpaidCount = filteredReferredUsers.filter((u) => u.paid_revenue === 0).length;
    const totalGeneratedRevenue = referredUsers.reduce((sum, u) => sum + (u.paid_revenue || 0), 0);
    return { rev, payout, paidCount, unpaidCount, totalGeneratedRevenue };
  }, [filteredReferredUsers, referredUsers]);

  const currentWalletBal = Number(partnerProfile?.profiles?.wallet_balance || profile?.wallet_balance || 0);
  const isNegativeWallet = currentWalletBal < 0;
  const negativeAmountToClear = isNegativeWallet ? Math.abs(currentWalletBal) : 0;
  const netPayable = Math.max(0, referralRevenue - totalSettled - negativeAmountToClear);

  const filteredPayoutHistory = useMemo(() => {
    return payoutHistory.filter((item) => {
      const matchesMonth = filterMonth === 'ALL' || item.settlement_month?.toUpperCase().includes(filterMonth.toUpperCase());
      const matchesYear = filterYear === 'ALL' || item.settlement_month?.includes(filterYear);
      return matchesMonth && matchesYear;
    });
  }, [payoutHistory, filterMonth, filterYear]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!session?.user?.email) return;
    const { error } = await supabase.auth.signInWithPassword({ email: session.user.email, password: securityPassword });
    if (error) setAuthError('INVALID PASSWORD!');
    else { sessionStorage.setItem('partner_ledger_unlocked', 'true'); setIsUnlocked(true); }
  };

  const handleAddPayoutSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerProfile) return;
    const { error } = await supabase.from('partner_payouts').insert([{ 
      partner_id: partnerProfile.partner_id, 
      user_id: partnerProfile.user_id, 
      amount_settled: Number(payoutAmount), 
      payout_date: payoutDate, 
      settlement_month: payoutMonth, 
      payment_mode: payoutMode, 
      transaction_ref: payoutRef, 
      notes: payoutNotes 
    }]);

    if (error) alert('ERROR: ' + error.message);
    else {
      setShowPayoutModal(false); setPayoutAmount(''); setPayoutRef(''); setPayoutNotes('');
      await loadPartnerDetails(partnerProfile.partner_id, partnerProfile.user_id);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-300 bg-slate-950 min-h-screen font-mono">LOADING LEDGER...</div>;

  // 1. APPROVAL LOCK GUARD (IF NOT APPROVED & NOT ADMIN)
  if ((!hasPartnerAccount || approvalStatus !== 'APPROVED') && !isAdminOrCEO) {
    return (
      <PartnerApprovalLockModal
        userId={session.user.id}
        hasAccount={hasPartnerAccount}
        approvalStatus={approvalStatus}
        approvedByLevel1={approvedByLevel1}
        approvedByAdmin={approvedByAdmin}
        onRefresh={fetchInitialData}
      />
    );
  }

  // 2. SECURITY PASSWORD LOCK GUARD
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md text-center space-y-4 shadow-2xl">
          <div className="p-3 bg-indigo-950/60 border border-indigo-800/50 rounded-2xl w-fit mx-auto">
            <Lock className="text-indigo-400 w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider">SECURE PARTNER LEDGER</h2>
          <form onSubmit={handleUnlock} className="space-y-4 text-left">
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password..."
                value={securityPassword}
                onChange={(e) => setSecurityPassword(e.target.value)}
                className="w-full p-3 pr-10 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {authError && <p className="text-red-400 text-xs font-semibold uppercase">{authError}</p>}
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl text-xs uppercase shadow-lg">ACCESS LEDGER →</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-6 space-y-5 uppercase">
      
      {/* HEADER BAR */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-800 pb-3 gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-black text-indigo-400 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> PARTNER NETWORK & REVENUE LEDGER
          </h1>
          <p className="text-[11px] text-slate-400">Track Commissions, Expiry & Monthly Settlement History.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {isAdminOrCEO && (
            <>
              <div className="flex items-center gap-2 bg-slate-900 border border-indigo-900/50 p-2 rounded-xl">
                <Search size={14} className="text-indigo-400 shrink-0" />
                <span className="text-[11px] font-bold text-indigo-300 shrink-0">PARTNER:</span>
                <select 
                  value={selectedPartnerId}
                  onChange={(e) => {
                    setSelectedPartnerId(e.target.value);
                    const selected = allPartners.find((p) => p.partner_id === e.target.value);
                    if (selected) { 
                      setPartnerProfile(selected); 
                      setApprovalStatus(selected.approval_status || 'PENDING');
                      setApprovedByLevel1(selected.approved_by_level1);
                      setApprovedByAdmin(selected.approved_by_admin);
                      loadPartnerDetails(selected.partner_id, selected.user_id); 
                    }
                  }}
                  className="bg-slate-950 text-white text-xs p-1.5 rounded-lg border border-slate-700 focus:outline-none"
                >
                  {allPartners.map((p) => (
                    <option key={p.partner_id} value={p.partner_id}>
                      {p.profiles?.full_name || 'Partner'} ({p.approval_status || 'PENDING'})
                    </option>
                  ))}
                </select>
              </div>

              {partnerProfile && partnerProfile.approval_status !== 'APPROVED' && (
                <div className="flex items-center gap-1.5">
                  {!partnerProfile.approved_by_level1 && (
                    <button 
                      onClick={() => handleApprovePartner(partnerProfile.partner_id, 'LEVEL1')}
                      className="bg-indigo-700 hover:bg-indigo-600 text-white px-2.5 py-2 rounded-xl text-[10px] font-black flex items-center gap-1"
                    >
                      <CheckCircle size={12} /> APPROVE (LEVEL 1)
                    </button>
                  )}
                  <button 
                    onClick={() => handleApprovePartner(partnerProfile.partner_id, 'ADMIN')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-2 rounded-xl text-[10px] font-black flex items-center gap-1 shadow-md"
                  >
                    <CheckCircle size={12} /> FINAL ADMIN APPROVAL
                  </button>
                </div>
              )}

              <button 
                onClick={() => setShowPayoutModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <PlusCircle size={15} /> SETTLEMENT ENTRY
              </button>
            </>
          )}

          <button onClick={() => { sessionStorage.removeItem('partner_ledger_unlocked'); setIsUnlocked(false); }} className="bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ml-auto">
            <LogOut size={14} /> LOCK
          </button>
        </div>
      </div>

      <PartnerProfileCard partnerProfile={partnerProfile} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-md">
          <div>
            <p className="text-[10px] text-slate-400 font-bold">TOTAL USER REVENUE</p>
            <h3 className="text-xl font-black text-emerald-400">
              ₹ {networkStats.totalGeneratedRevenue.toFixed(2)}
            </h3>
            <span className="text-[9px] text-slate-400 font-bold block mt-0.5">FROM ALL REFERRED USERS</span>
          </div>
          <Wallet className="text-emerald-400 w-5 h-5" />
        </div>

        <div 
          onClick={() => setShowBreakdownModal(true)}
          className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-md cursor-pointer hover:border-indigo-500 transition group"
        >
          <div>
            <div className="flex items-center gap-1">
              <p className="text-[10px] text-slate-400 font-bold group-hover:text-indigo-300">ACTIVE PAYOUT (3%)</p>
              <ExternalLink size={10} className="text-indigo-400" />
            </div>
            <h3 className="text-xl font-black text-indigo-400">₹ {referralRevenue.toFixed(2)}</h3>
            <span className="text-[9px] text-indigo-400/80 font-bold">CLICK FOR BREAKDOWN</span>
          </div>
          <ArrowUpRight className="text-indigo-400 w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
        </div>

        <div 
          onClick={() => setActiveTab('settlement')}
          className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-md cursor-pointer hover:border-amber-500 transition group"
        >
          <div>
            <div className="flex items-center gap-1">
              <p className="text-[10px] text-slate-400 font-bold group-hover:text-amber-300">SETTLED PAYOUTS</p>
              <ExternalLink size={10} className="text-amber-400" />
            </div>
            <h3 className="text-xl font-black text-amber-400">₹ {totalSettled.toFixed(2)}</h3>
            <span className="text-[9px] text-amber-400/80 font-bold">VIEW HISTORY TAB</span>
          </div>
          <Landmark className="text-amber-400 w-5 h-5 group-hover:scale-110 transition" />
        </div>

        <div 
          onClick={() => setShowBreakdownModal(true)}
          className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-md cursor-pointer hover:border-cyan-500 transition group"
        >
          <div>
            <div className="flex items-center gap-1">
              <p className="text-[10px] text-slate-400 font-bold group-hover:text-cyan-300">NET PAYABLE</p>
              <Calculator size={10} className="text-cyan-400" />
            </div>
            <h3 className="text-xl font-black text-cyan-400">₹ {netPayable.toFixed(2)}</h3>
            {isNegativeWallet && (
              <span className="text-[8px] text-red-400 font-bold block">(-₹{negativeAmountToClear.toFixed(0)} WALLET DEDUCTED)</span>
            )}
          </div>
          <CreditCard className="text-cyan-400 w-5 h-5 group-hover:scale-110 transition" />
        </div>
      </div>

      {isNegativeWallet && (
        <div className="bg-amber-950/40 border border-amber-800/80 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-amber-300 text-[11px]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-400 shrink-0 w-5 h-5" />
            <div>
              <span className="font-bold text-white">NEGATIVE WALLET DEFICIT AUTO-DEDUCTION INCLUDED</span>
              <p className="text-[10px] text-amber-200">
                CURRENT WALLET BALANCE IS MINUS <span className="font-bold text-red-400">-₹{negativeAmountToClear.toFixed(2)}</span>. THIS DEFICIT HAS BEEN DEDUCTED FROM NET PAYABLE COMMISSION.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowBreakdownModal(true)}
            className="bg-amber-900/80 border border-amber-700 hover:bg-amber-800 px-3 py-1 rounded font-bold text-[9px] text-white shrink-0"
          >
            SEE DETAILED BREAKDOWN →
          </button>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('network')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'network' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={14} /> NETWORK ({referredUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('settlement')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'settlement' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Landmark size={14} /> SETTLEMENTS ({filteredPayoutHistory.length})
          </button>
        </div>

        {activeTab === 'network' && (
          <div className="flex items-center gap-2 overflow-x-auto text-[10px] font-mono py-1 px-2 bg-slate-950/80 rounded-xl border border-slate-800 shrink-0">
            <span className="text-slate-400">REV: <strong className="text-emerald-400">₹{networkStats.rev.toFixed(0)}</strong></span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">PAYOUT: <strong className="text-amber-400">₹{networkStats.payout.toFixed(0)}</strong></span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">PAID: <strong className="text-cyan-400">{networkStats.paidCount}</strong></span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">UNPAID: <strong className="text-red-400">{networkStats.unpaidCount}</strong></span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1.5 rounded-xl border border-slate-800">
            <Filter size={12} className="text-indigo-400 shrink-0" />
            <select 
              value={filterMonth} 
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-transparent text-white text-[11px] font-bold focus:outline-none"
            >
              <option value="ALL" className="bg-slate-900">ALL MONTHS</option>
              {['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'].map((m) => (
                <option key={m} value={m} className="bg-slate-900">{m}</option>
              ))}
            </select>

            <select 
              value={filterYear} 
              onChange={(e) => setFilterYear(e.target.value)}
              className="bg-transparent text-white text-[11px] font-bold focus:outline-none border-l border-slate-800 pl-1"
            >
              <option value="ALL" className="bg-slate-900">ALL YEARS</option>
              <option value="2025" className="bg-slate-900">2025</option>
              <option value="2026" className="bg-slate-900">2026</option>
              <option value="2027" className="bg-slate-900">2027</option>
            </select>
          </div>

          {activeTab === 'network' && (
            <button
              onClick={() => setShowUnpaidOnly(!showUnpaidOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition border flex items-center gap-1.5 shrink-0 ${
                showUnpaidOnly 
                  ? 'bg-red-600 text-white border-red-500 shadow-lg' 
                  : 'bg-slate-950 text-red-400 border-red-900/60 hover:bg-red-950/40'
              }`}
            >
              <PhoneCall size={13} /> {showUnpaidOnly ? 'SHOW ALL USERS' : 'FILTER UNPAID (FOLLOW UP)'}
            </button>
          )}

          {activeTab === 'network' && (
            <button onClick={() => setShowAddUserModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0">
              <UserPlus size={13} /> ADD USER
            </button>
          )}
        </div>
      </div>

      {activeTab === 'network' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-indigo-300">REFERRED NETWORK ({filteredReferredUsers.length})</h3>
              <p className="text-[10px] text-slate-400">Dynamic 365-day expiry tracker. 3% commission cuts off after 1 year.</p>
            </div>
            {showUnpaidOnly && (
              <span className="bg-red-950 text-red-400 border border-red-800 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                <UserX size={12} /> {networkStats.unpaidCount} INACTIVE USERS NEED FOLLOW UP
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/60 text-indigo-300 uppercase border-b border-slate-800 text-[11px]">
                  <th className="p-3">USER NAME</th>
                  <th className="p-3">MOBILE NO.</th>
                  <th className="p-3">CASE TYPE</th>
                  <th className="p-3 text-cyan-300">ADDED DATE</th>
                  <th className="p-3 text-amber-300">COMMISSION END DATE</th>
                  <th className="p-3">PAID REVENUE</th>
                  <th className="p-3">3% COMMISSION</th>
                  <th className="p-3">VALIDITY / FOLLOW UP STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredReferredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">NO REFERRED USERS FOUND MATCHING SELECTED FILTERS.</td>
                  </tr>
                ) : (
                  filteredReferredUsers.map((item) => (
                    <tr key={item.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                      <td className="p-3 font-semibold text-white">{item.profiles?.full_name || 'N/A'}</td>
                      <td className="p-3 text-slate-300 font-mono">{item.profiles?.mobile || 'N/A'}</td>
                      <td className="p-3 text-indigo-300 font-bold">{item.case_type || 'BASIC PLAN'}</td>
                      <td className="p-3 text-cyan-300 font-mono font-bold">{item.added_date}</td>
                      <td className="p-3 text-amber-300 font-mono font-bold">{item.expiry_date}</td>
                      <td className="p-3 font-bold text-emerald-400">₹ {Number(item.paid_revenue || 0).toFixed(2)}</td>
                      <td className="p-3 font-bold">
                        {item.is_expired ? (
                          <span className="text-red-400 bg-red-950/60 border border-red-800 px-1.5 py-0.5 rounded text-[10px]">₹ 0.00 (EXPIRED)</span>
                        ) : (
                          <span className="text-amber-400">₹ {Number(item.earned_commission_3percent || 0).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="p-3 flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${item.is_expired ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'}`}>
                          {item.status}
                        </span>
                        {item.paid_revenue === 0 && (
                          <span className="bg-amber-950/90 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-extrabold text-[9px] flex items-center gap-1">
                            <PhoneCall size={10} className="text-amber-400" /> NO PAYMENT (FOLLOW UP)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              
              {filteredReferredUsers.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-950 font-black text-white border-t-2 border-indigo-500 uppercase">
                    <td colSpan={5} className="p-3 text-right text-indigo-300 text-[11px] font-mono">
                      TOTAL ({filteredReferredUsers.length} USERS):
                    </td>
                    <td className="p-3 text-emerald-400 text-sm font-black font-mono">
                      ₹ {networkStats.rev.toFixed(2)}
                    </td>
                    <td className="p-3 text-amber-400 text-sm font-black font-mono">
                      ₹ {networkStats.payout.toFixed(2)}
                    </td>
                    <td className="p-3 text-slate-400 text-[10px]">
                      PAID: {networkStats.paidCount} | UNPAID: {networkStats.unpaidCount}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3 border-b border-slate-800 bg-slate-900/60">
            <h3 className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
              <Landmark size={15} /> SETTLEMENT HISTORY ({filteredPayoutHistory.length})
            </h3>
            <p className="text-[10px] text-slate-400">Bank payouts disbursed by Admin & Auto Wallet Ledger Adjustments.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/60 text-emerald-300 uppercase border-b border-slate-800 text-[11px]">
                  <th className="p-3">DATE</th>
                  <th className="p-3">MONTH</th>
                  <th className="p-3">AMOUNT PAID</th>
                  <th className="p-3">MODE</th>
                  <th className="p-3">UTR / REF NO.</th>
                  <th className="p-3">NOTES</th>
                  <th className="p-3">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayoutHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">NO PAYOUT SETTLEMENTS FOUND FOR {filterMonth} {filterYear}.</td>
                  </tr>
                ) : (
                  filteredPayoutHistory.map((payout) => (
                    <tr key={payout.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition ${payout.payment_mode === '1ST DATE AUTO-ADJUSTMENT' ? 'bg-amber-950/20' : ''}`}>
                      <td className="p-3 text-white font-mono font-bold">{payout.payout_date}</td>
                      <td className="p-3 text-indigo-300 font-bold">{payout.settlement_month}</td>
                      <td className="p-3 text-emerald-400 font-black">₹ {Number(payout.amount_settled).toFixed(2)}</td>
                      <td className="p-3 text-slate-300">{payout.payment_mode || 'UPI/NEFT'}</td>
                      <td className="p-3 text-amber-300 font-mono font-bold">{payout.transaction_ref}</td>
                      <td className="p-3 text-slate-300 text-[10px]">{payout.notes || '-'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${payout.payment_mode === '1ST DATE AUTO-ADJUSTMENT' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'}`}>
                          {payout.payment_mode === '1ST DATE AUTO-ADJUSTMENT' ? 'WALLET AUTO-ADJUSTED' : 'SETTLED'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showBreakdownModal && (
        <PayoutBreakdownModal
          onClose={() => setShowBreakdownModal(false)}
          referralRevenue={referralRevenue}
          totalSettled={totalSettled}
          currentWalletBal={currentWalletBal}
          referredUsers={referredUsers}
          payoutHistory={payoutHistory}
        />
      )}

      {showAddUserModal && (
        <AddUserModal
          partnerProfile={partnerProfile}
          onClose={() => setShowAddUserModal(false)}
          onSuccess={() => {
            if (partnerProfile) {
              loadPartnerDetails(partnerProfile.partner_id, partnerProfile.user_id);
            }
          }}
        />
      )}

      {showPayoutModal && isAdminOrCEO && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl w-full max-w-lg space-y-3 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2"><Landmark size={16} /> RECORD PAYOUT SETTLEMENT</h3>
              <button onClick={() => setShowPayoutModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <form onSubmit={handleAddPayoutSettlement} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">SELECTED PARTNER</label>
                <input type="text" disabled value={`${partnerProfile?.profiles?.full_name || 'Partner'} (${partnerProfile?.partner_id})`} className="w-full p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-indigo-300 font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">SETTLEMENT DATE *</label>
                  <input type="date" required value={payoutDate} onChange={(e) => setPayoutDate(e.target.value)} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">SETTLEMENT MONTH *</label>
                  <input type="text" required placeholder="e.g. August 2026" value={payoutMonth} onChange={(e) => setPayoutMonth(e.target.value)} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">AMOUNT SETTLED (₹) *</label>
                  <input type="number" step="0.01" required placeholder="5000" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">MODE</label>
                  <select value={payoutMode} onChange={(e) => setPayoutMode(e.target.value)} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none">
                    <option value="UPI / NEFT">UPI / NEFT</option>
                    <option value="IMPS / RTGS">IMPS / RTGS</option>
                    <option value="BANK CHEQUE">BANK CHEQUE</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">UTR / REF NUMBER *</label>
                <input type="text" required placeholder="e.g. UTR129384019283" value={payoutRef} onChange={(e) => setPayoutRef(e.target.value)} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">NOTES</label>
                <input type="text" placeholder="Remarks..." value={payoutNotes} onChange={(e) => setPayoutNotes(e.target.value)} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowPayoutModal(false)} className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">CANCEL</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md">SAVE SETTLEMENT →</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}