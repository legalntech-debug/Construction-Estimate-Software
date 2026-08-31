'use client';

import { useState, useEffect, Fragment } from 'react';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  full_name: string;
  role: string | null;
  state: string | null;
  city: string | null;
  email: string | null;
  mobile: string | null;
  referred_by?: string | null;
}

interface PartnerRecord {
  id: string;
  user_id: string;
  holding_percentage: number;
  second_role: string | null;
  target_candidates: number;
  total_disbursed: number;
  partner_since: string | null;
  status: 'active' | 'inactive' | 'revoked';
  created_at?: string;
}

interface StateRevenue {
  state: string;
  revenue: number;
}

interface PayoutRecord {
  id: string;
  user_id: string;
  partner_id: string;
  amount_settled: number;
  settlement_month: string;
  payout_date: string;
  payment_mode?: string;
  transaction_ref: string;
  notes?: string;
  created_at: string;
  amount?: number;
}

interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  full_name?: string;
}

interface MonthlyBreakupItem {
  monthName: string;
  monthIndex: number;
  totalGross: number;
  adminDeduction: number;
  expenses: number;
  payouts: number;
  net: number;
}

const EXCLUDED_USER_ID = '458350dc-59b3-44d9-a9e4-6051602c5291';
const EFFECTIVE_START_DATE = new Date('2026-09-01T00:00:00.000Z');
const FIXED_OPERATIONAL_COST = 10000;

export default function BusinessProfitSharingWidget() {
  const [isInitiated, setIsInitiated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [partnersList, setPartnersList] = useState<PartnerRecord[]>([]);
  const [stateRevenues, setStateRevenues] = useState<StateRevenue[]>([]);

  // Active Sub-Tab View State
  const [activeTab, setActiveTab] = useState<'overview' | 'settlements' | 'directory'>('overview');

  // Logged-in User Context
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');

  // Month & Financial Year Filter States
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Financial Summary States
  const [totalGrossBilling, setTotalGrossBilling] = useState(0);
  const [adminUsageDeduction, setAdminUsageDeduction] = useState(0);
  const [netRevenue, setNetRevenue] = useState(0);
  const [totalMonthPayouts, setTotalMonthPayouts] = useState<number>(0);

  // Month Breakup Modal State
  const [isBreakupModalOpen, setIsBreakupModalOpen] = useState(false);
  const [monthlyBreakupData, setMonthlyBreakupData] = useState<MonthlyBreakupItem[]>([]);

  // Database Payouts & Requests
  const [dbPayouts, setDbPayouts] = useState<PayoutRecord[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [requestAmountInput, setRequestAmountInput] = useState<string>('');

  // Admin Direct Settlement Form States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'NEFT' | 'UPI' | 'IMPS' | 'RTGS' | 'BANK_TRANSFER'>('NEFT');
  const [transactionRef, setTransactionRef] = useState('');
  const [adminAuthEmail, setAdminAuthEmail] = useState('');
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);

  // Editable Directory State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editHoldingPct, setEditHoldingPct] = useState<number>(5);
  const [editSelectedRole, setEditSelectedRole] = useState<string>('Marketing & Support');
  const [editTargetCandidates, setEditTargetCandidates] = useState<number>(400);
  const [editPartnerSince, setEditPartnerSince] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive' | 'revoked'>('active');
  const [dirAdminEmail, setDirAdminEmail] = useState<string>('');
  const [dirAdminPassword, setDirAdminPassword] = useState<string>('');
  const [isSavingPartner, setIsSavingPartner] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (isInitiated) {
      fetchProfitSharingData();
    }
  }, [isInitiated, selectedMonth, selectedYear]);

  const fetchProfitSharingData = async () => {
    setLoading(true);
    try {
      const { data: profileData, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, role, state, city, email, mobile, referred_by');

      if (profErr) throw profErr;

      if (profileData) {
        setProfiles(profileData);
        if (currentUserId) {
          const loggedUser = profileData.find((p) => p.id === currentUserId);
          if (loggedUser) setCurrentUserRole(loggedUser.role || 'user');
        }
      }

      const { data: partnersData, error: partnerErr } = await supabase
        .from('partners')
        .select('*');

      if (!partnerErr && partnersData) {
        setPartnersList(partnersData as PartnerRecord[]);
      }

      const userStateMap: { [userId: string]: string } = {};
      profileData?.forEach((p) => {
        if (p.id) {
          const formattedState = p.state ? p.state.trim().toUpperCase() : 'OTHER';
          userStateMap[p.id] = formattedState;
        }
      });

      const filterStart = new Date(selectedYear, selectedMonth - 1, 1);
      const filterEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

      const startDate = filterStart < EFFECTIVE_START_DATE ? EFFECTIVE_START_DATE.toISOString() : filterStart.toISOString();
      const endDate = filterEnd.toISOString();

      let overallGross = 0;
      let adminDeduction = 0;
      const stateMap: { [key: string]: number } = {};

      if (new Date(endDate) >= EFFECTIVE_START_DATE) {
        const { data: estimatesData } = await supabase
          .from('estimates')
          .select('id, user_id, user_payment, created_at')
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        if (estimatesData) {
          estimatesData.forEach((est: any) => {
            const amt = Number(est.user_payment || 0);
            if (amt > 0) {
              overallGross += amt;
              if (est.user_id === EXCLUDED_USER_ID) {
                adminDeduction += amt;
              } else {
                const userState = userStateMap[est.user_id] || 'OTHER';
                stateMap[userState] = (stateMap[userState] || 0) + amt;
              }
            }
          });
        }

        const { data: rechargeData } = await supabase
          .from('wallet_recharges')
          .select('amount, user_id, status, created_at')
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        if (rechargeData) {
          rechargeData.forEach((item: any) => {
            const status = item.status ? String(item.status).toLowerCase() : '';
            const isPaid = status === 'success' || status === 'paid' || status === 'completed';
            const amt = Number(item.amount || 0);

            if (isPaid && amt > 0) {
              overallGross += amt;
              if (item.user_id === EXCLUDED_USER_ID) {
                adminDeduction += amt;
              } else {
                const userState = userStateMap[item.user_id] || 'OTHER';
                stateMap[userState] = (stateMap[userState] || 0) + amt;
              }
            }
          });
        }
      }

      // 4-Point Net Calculation
      const publicGross = overallGross - adminDeduction;
      const calculatedNetTotal = Math.max(0, publicGross - FIXED_OPERATIONAL_COST);

      const formattedStateData = Object.keys(stateMap).map((st) => ({
        state: st,
        revenue: stateMap[st],
      }));

      setStateRevenues(formattedStateData);
      setTotalGrossBilling(overallGross);
      setAdminUsageDeduction(adminDeduction);
      setNetRevenue(calculatedNetTotal);

      // Payouts Settlement Fetch
      const formattedMonthStr = `${selectedMonth.toString().padStart(2, '0')}-${selectedYear}`;
      const { data: payoutsData } = await supabase
        .from('shareholder_paytable')
        .select('*')
        .eq('settlement_month', formattedMonthStr);

      let totalMonthPaid = 0;
      if (payoutsData) {
        setDbPayouts(payoutsData);
        totalMonthPaid = payoutsData.reduce(
          (sum, pay) => sum + Number(pay.amount_settled || pay.amount || 0),
          0
        );
      } else {
        const { data: fallbackPayouts } = await supabase.from('shareholder_paytable').select('*');
        if (fallbackPayouts) {
          setDbPayouts(fallbackPayouts);
          totalMonthPaid = fallbackPayouts.reduce(
            (sum, pay) => sum + Number(pay.amount_settled || pay.amount || 0),
            0
          );
        }
      }
      setTotalMonthPayouts(totalMonthPaid);

      // FY Month Breakup Data Calculation
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      const fyBreakupList: MonthlyBreakupItem[] = [];
      const fyStart = new Date(selectedYear, 0, 1);
      const fyEnd = new Date(selectedYear, 11, 31, 23, 59, 59);

      const { data: allFyEstimates } = await supabase
        .from('estimates')
        .select('user_id, user_payment, created_at')
        .gte('created_at', fyStart.toISOString())
        .lte('created_at', fyEnd.toISOString());

      const { data: allFyRecharges } = await supabase
        .from('wallet_recharges')
        .select('user_id, amount, status, created_at')
        .gte('created_at', fyStart.toISOString())
        .lte('created_at', fyEnd.toISOString());

      const { data: allFyPayouts } = await supabase
        .from('shareholder_paytable')
        .select('*');

      for (let m = 0; m < 12; m++) {
        let mTotalGross = 0;
        let mAdminDeduction = 0;
        const monthNumStr = `${(m + 1).toString().padStart(2, '0')}-${selectedYear}`;

        allFyEstimates?.forEach((est: any) => {
          const d = new Date(est.created_at);
          if (d.getMonth() === m && d.getFullYear() === selectedYear) {
            const amt = Number(est.user_payment || 0);
            if (amt > 0) {
              mTotalGross += amt;
              if (est.user_id === EXCLUDED_USER_ID) {
                mAdminDeduction += amt;
              }
            }
          }
        });

        allFyRecharges?.forEach((rec: any) => {
          const d = new Date(rec.created_at);
          const st = String(rec.status || '').toLowerCase();
          if (
            d.getMonth() === m &&
            d.getFullYear() === selectedYear &&
            (st === 'success' || st === 'paid' || st === 'completed')
          ) {
            const amt = Number(rec.amount || 0);
            if (amt > 0) {
              mTotalGross += amt;
              if (rec.user_id === EXCLUDED_USER_ID) {
                mAdminDeduction += amt;
              }
            }
          }
        });

        let mPayouts = 0;
        allFyPayouts?.forEach((pay: any) => {
          if (pay.settlement_month === monthNumStr) {
            mPayouts += Number(pay.amount_settled || pay.amount || 0);
          }
        });

        const mPublicGross = mTotalGross - mAdminDeduction;
        const mNet = Math.max(0, mPublicGross - FIXED_OPERATIONAL_COST - mPayouts);

        fyBreakupList.push({
          monthName: monthNames[m],
          monthIndex: m + 1,
          totalGross: mTotalGross,
          adminDeduction: mAdminDeduction,
          expenses: FIXED_OPERATIONAL_COST,
          payouts: mPayouts,
          net: mNet,
        });
      }

      setMonthlyBreakupData(fyBreakupList);

      const { data: requestsData } = await supabase
        .from('payout_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (requestsData) {
        const enrichedRequests = requestsData.map((req) => ({
          ...req,
          full_name: profileData?.find((p) => p.id === req.user_id)?.full_name || 'Partner',
        }));
        setPayoutRequests(enrichedRequests);
      }
    } catch (err: any) {
      console.error('Profit Sharing Data Fetch Error:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = currentUserRole.toLowerCase().includes('admin');

  const handleUpdatePartnerDetails = async (userId: string) => {
    if (!isAdmin) return alert('Unauthorized action.');
    if (!dirAdminEmail.trim() || !dirAdminPassword.trim()) {
      return alert('Admin ID and Password are required to update partner details.');
    }

    if (editSelectedRole === 'CEO') {
      const existingCeo = profiles.find(
        (p) =>
          p.id !== userId &&
          (p.role?.toLowerCase() === 'ceo' || p.role?.toLowerCase() === 'co_partner (ceo)')
      );

      if (existingCeo) {
        return alert(
          `Action Denied: A CEO is already assigned in the system (${existingCeo.full_name}). You cannot assign multiple CEOs.`
        );
      }
    }

    setIsSavingPartner(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: dirAdminEmail.trim(),
        password: dirAdminPassword.trim(),
      });

      if (authErr) {
        throw new Error('Admin Authentication failed! Invalid credentials.');
      }

      const isCeoRole = editSelectedRole === 'CEO';
      const roleDbValue = isCeoRole ? 'CEO' : 'Co-Partner';

      const partnerPayload = {
        user_id: userId,
        holding_percentage: editHoldingPct,
        second_role: editSelectedRole,
        target_candidates: editTargetCandidates,
        status: editStatus,
        partner_since: editPartnerSince ? new Date(editPartnerSince).toISOString() : new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from('partners')
        .upsert(partnerPayload, { onConflict: 'user_id' });

      if (upsertErr) throw upsertErr;

      if (editStatus === 'active') {
        await supabase
          .from('profiles')
          .update({ role: roleDbValue })
          .eq('id', userId);
      }

      alert('✅ Partner details & role successfully updated!');
      setEditingUserId(null);
      setDirAdminEmail('');
      setDirAdminPassword('');
      fetchProfitSharingData();
    } catch (err: any) {
      alert('Update Error: ' + err.message);
    } finally {
      setIsSavingPartner(false);
    }
  };

  const handleRemovePartnerRole = async (userId: string) => {
    if (!isAdmin) return alert('Unauthorized action.');

    const confirmRevoke = confirm('Are you sure you want to end/revoke partner status for this user?');
    if (!confirmRevoke) return;

    try {
      const { error } = await supabase
        .from('partners')
        .update({ status: 'revoked', holding_percentage: 0 })
        .eq('user_id', userId);

      if (error) throw error;

      alert('Partner role revoked successfully.');
      fetchProfitSharingData();
    } catch (err: any) {
      alert('Failed to revoke partner: ' + err.message);
    }
  };

  const isRoleMatching = (role: string | null, target: string) =>
    role?.toLowerCase().includes(target.toLowerCase());

  const ceoPartnerProfile = profiles.find((p) => isRoleMatching(p.role, 'ceo'));
  const adminPartnerProfile = profiles.find((p) => isRoleMatching(p.role, 'admin'));

  const activePartners = partnersList.filter((p) => p.status === 'active');
  const totalActivePartnerPct = activePartners.reduce(
    (sum, p) => sum + Number(p.holding_percentage || 0),
    0
  );

  const adminSharePct = Math.max(0, 100 - totalActivePartnerPct);
  const adminCalculatedShare = (netRevenue * adminSharePct) / 100;

  const adminPayouts = dbPayouts.filter((pay) => pay.user_id === (adminPartnerProfile?.id || EXCLUDED_USER_ID));
  const adminTotalPaid = adminPayouts.reduce((acc, curr) => acc + Number(curr.amount_settled || curr.amount || 0), 0);

  const rawShareholders = [
    {
      id: adminPartnerProfile?.id || EXCLUDED_USER_ID,
      name: adminPartnerProfile?.full_name || 'DRC Consultant',
      role: 'Admin (Holding Partner)',
      secondRole: 'System Owner',
      partnerSince: '2026-08-30',
      target: 0,
      joinedCandidatesCount: 0,
      percentage: adminSharePct,
      grossProfit: adminCalculatedShare,
      totalDisbursed: adminTotalPaid,
      netPayableBalance: Math.max(0, adminCalculatedShare - adminTotalPaid),
      status: 'active',
    },
    ...partnersList.map((p) => {
      const userProfile = profiles.find((prof) => prof.id === p.user_id);
      const isActive = p.status === 'active';
      const currentHoldingPct = isActive ? Number(p.holding_percentage || 0) : 0;

      const joinedCandidates = profiles.filter(
        (prof) => prof.referred_by === p.user_id || (prof as any).partner_id === p.user_id
      );

      const targetReq = p.target_candidates || 400;
      const isTargetAchieved = joinedCandidates.length >= targetReq || p.user_id === ceoPartnerProfile?.id;

      let calculatedShare = 0;
      if (isActive && isTargetAchieved) {
        calculatedShare = (netRevenue * currentHoldingPct) / 100;
      }

      const partnerPayouts = dbPayouts.filter((pay) => pay.user_id === p.user_id);
      const totalPaid = partnerPayouts.reduce(
        (acc, curr) => acc + Number(curr.amount_settled || curr.amount || 0),
        0
      ) + Number(p.total_disbursed || 0);

      const netPayableBalance = Math.max(0, calculatedShare - totalPaid);

      return {
        id: p.user_id,
        name: userProfile?.full_name || 'Partner',
        role: `Co-Partner (${userProfile?.role || 'Partner'})`,
        secondRole: p.second_role || 'Marketing & Support',
        partnerSince: p.partner_since ? new Date(p.partner_since).toLocaleDateString('en-IN') : '-',
        target: targetReq,
        joinedCandidatesCount: joinedCandidates.length,
        percentage: currentHoldingPct,
        grossProfit: calculatedShare,
        totalDisbursed: totalPaid,
        netPayableBalance: netPayableBalance,
        status: p.status,
      };
    }),
  ];

  const allShareholders = [...rawShareholders].sort((a, b) => 
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  );

  const currentShareholder = allShareholders.find((s) => s.id === currentUserId);
  const currentUserNetBalance = currentShareholder?.netPayableBalance || 0;

  const targetShareholder = allShareholders.find((s) => s.id === selectedPartnerId);
  const targetNetBalance = targetShareholder?.netPayableBalance || 0;

  const handleAdminSettlePayment = async () => {
    if (!isAdmin) return alert('Unauthorized action.');
    if (!selectedPartnerId) return alert('Please select a partner or shareholder.');

    const amount = Number(settleAmount);
    if (isNaN(amount) || amount <= 0) return alert('Please enter a valid payment amount.');
    if (!transactionRef.trim()) return alert('Please enter Transaction Ref / UTR / Reference No.');
    if (!adminAuthEmail.trim() || !adminAuthPassword.trim()) {
      return alert('Admin Email ID and Password are required for verification.');
    }

    if (amount > targetNetBalance) {
      return alert(
        `⛔ PAYMENT REJECTED: Requested amount (₹${amount.toLocaleString('en-IN')}) exceeds Partner's Net Payable Balance (₹${targetNetBalance.toLocaleString('en-IN')}).`
      );
    }

    setIsVerifyingAdmin(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: adminAuthEmail.trim(),
        password: adminAuthPassword.trim(),
      });

      if (authErr) {
        throw new Error('Admin authentication failed! Check ID or Password.');
      }

      const targetProfile = profiles.find((p) => p.id === selectedPartnerId);
      const partnerIdStr = targetProfile?.email || selectedPartnerId;
      const settlementMonthStr = `${selectedMonth.toString().padStart(2, '0')}-${selectedYear}`;
      const todayDate = new Date().toISOString().split('T')[0];

      const { error: dbErr } = await supabase.from('shareholder_paytable').insert([
        {
          partner_id: partnerIdStr,
          user_id: selectedPartnerId,
          amount_settled: amount,
          amount: amount,
          settlement_month: settlementMonthStr,
          payout_date: todayDate,
          payment_mode: paymentMode,
          transaction_ref: transactionRef.trim(),
          notes: `Admin settlement via ${paymentMode} Ref: ${transactionRef.trim()}`,
        },
      ]);

      if (dbErr) throw dbErr;

      const currentDisbursed = targetShareholder?.totalDisbursed || 0;
      await supabase
        .from('partners')
        .update({ total_disbursed: currentDisbursed + amount })
        .eq('user_id', selectedPartnerId);

      alert(`✅ Settlement of ₹${amount.toLocaleString('en-IN')} successfully completed for ${targetShareholder?.name}!`);

      setSettleAmount('');
      setTransactionRef('');
      setAdminAuthPassword('');
      setSelectedPartnerId('');

      fetchProfitSharingData();
    } catch (err: any) {
      alert('Settlement Error: ' + err.message);
    } finally {
      setIsVerifyingAdmin(false);
    }
  };

  const handlePartnerRequestPayout = async () => {
    const amount = Number(requestAmountInput);
    if (!currentUserId || amount <= 0) return alert('Please enter a valid payout amount.');

    if (amount > currentUserNetBalance) {
      return alert(
        `Requested amount (₹${amount}) exceeds your Net Payable Balance (₹${currentUserNetBalance.toFixed(2)}).`
      );
    }

    try {
      const { error } = await supabase.from('payout_requests').insert([
        {
          user_id: currentUserId,
          amount,
          status: 'pending',
        },
      ]);

      if (error) throw error;

      alert('Payout request submitted successfully!');
      setRequestAmountInput('');
      fetchProfitSharingData();
    } catch (err: any) {
      alert('Failed to submit request: ' + err.message);
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!isAdmin) return alert('Unauthorized action.');
    try {
      const { error } = await supabase
        .from('payout_requests')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;

      fetchProfitSharingData();
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const visibleShareholders = isAdmin
    ? allShareholders
    : allShareholders.filter((s) => s.id === currentUserId);

  const filteredRequests = payoutRequests.filter(
    (req) => isAdmin || req.user_id === currentUserId
  );

  const filteredShareholdersForSearch = allShareholders.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden my-6 text-slate-100">
      <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-950/50">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold tracking-wide uppercase text-white">
              BUSINESS PROFIT SHARING & EQUITY DISTRIBUTION
            </h2>
            <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded tracking-wider">
              {isAdmin ? 'ADMIN ACCESS' : 'PARTNER PORTAL'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track and calculate total net income distribution across shareholders and partners.
          </p>
        </div>

        <button
          onClick={() => setIsInitiated(!isInitiated)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
            isInitiated
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isInitiated ? '✕ Hide Dashboard' : '▶ Initiate Profit Sharing'}
        </button>
      </div>

      {isInitiated && (
        <div className="p-6 space-y-6 animate-in fade-in duration-200">
          <div className="p-3 bg-amber-950/40 border border-amber-800/50 text-amber-300 rounded-xl text-xs font-medium flex items-center gap-2">
            <span>📢</span>
            <span>
              <strong>Notice:</strong> Profit sharing applies after partner joining date with target threshold. Inactive partners set to 0% with ₹0 payable balance.
            </span>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Select Month / FY Filter:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 text-xs font-bold bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ].map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 text-xs font-bold bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={2025}>FY 2025</option>
                <option value={2026}>FY 2026</option>
                <option value={2027}>FY 2027</option>
              </select>
            </div>

            <span className="text-[11px] font-semibold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              Showing Data For: {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} {selectedYear}
            </span>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span>📊</span> Revenue & Profit Split
            </button>

            <button
              onClick={() => setActiveTab('settlements')}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'settlements'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span>💸</span> Payout Settlements & History
              {filteredRequests.length > 0 && (
                <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {filteredRequests.length}
                </span>
              )}
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('directory')}
                className={`px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === 'directory'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>👥</span> Partner Directory ({profiles.filter((p) => p.role?.toLowerCase() !== 'admin' && p.id !== EXCLUDED_USER_ID).length})
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs font-semibold text-slate-400">
              Loading financial metrics and ledger records...
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Vertical Revenue Summary Stack (4 Point Deductions) */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                        Monthly Revenue & Expense Summary ({new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} {selectedYear})
                      </h3>
                      <span className="text-[10px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full text-blue-400 font-bold">
                        Active Public States: {stateRevenues.length}
                      </span>
                    </div>

                    {/* 1. Total Gross Billing */}
                    <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                      <div className="flex items-center space-x-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                        <span className="text-sm font-bold text-slate-200">1. Total Gross Billing</span>
                      </div>
                      <span className="text-lg font-black text-emerald-400">
                        ₹ {(totalGrossBilling || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 2. Less: Admin Self-Usage Revenue Deduction */}
                    <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                      <div className="flex items-center space-x-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                        <div>
                          <span className="text-sm font-bold text-slate-200">2. Less: Admin Self-Usage Deduction</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Excluded Admin Usage Billing Amount
                          </p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-rose-400">
                        - ₹ {(adminUsageDeduction || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 3. Less: Fixed Operational Overhead */}
                    <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                      <div className="flex items-center space-x-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                        <div>
                          <span className="text-sm font-bold text-slate-200">3. Less: Fixed Operational Overhead</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            System Infrastructure & Platform Operations Cost
                          </p>
                        </div>
                      </div>
                      <span className="text-lg font-black text-amber-400">
                        - ₹ {FIXED_OPERATIONAL_COST.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 4. Less: Network Partner Payouts */}
                    <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                      <div className="flex items-center space-x-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
                        <span className="text-sm font-bold text-slate-200">4. Less: Network Partner Payouts</span>
                      </div>
                      <span className="text-lg font-black text-indigo-400">
                        - ₹ {(totalMonthPayouts || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <hr className="border-slate-800 my-2" />

                    {/* Final Net Distributable Profit Card */}
                    <div
                      onClick={() => setIsBreakupModalOpen(true)}
                      className="group cursor-pointer bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-500/40 p-5 rounded-2xl flex justify-between items-center transition-all duration-200 hover:shadow-xl hover:shadow-emerald-950/40"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                            Final Net Distributable Profit
                          </span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                            🔍 Click for Month-wise Breakup
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Click here to view month-by-month expense, gross billing, and net profit analysis.
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-2xl font-black text-emerald-300">
                          ₹ {(netRevenue || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">➔</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                    <div className="p-3 bg-slate-800/50 border-b border-slate-800 font-bold text-xs text-slate-300 uppercase tracking-wider">
                      {isAdmin ? 'Shareholders Equity & Target Profit Distribution' : 'Your Equity & Net Profit Balance'}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-800">
                          <tr>
                            <th className="p-3">Partner Name</th>
                            <th className="p-3">Role & Assigned Position</th>
                            <th className="p-3 text-center">Partner Since</th>
                            <th className="p-3 text-center">Target Candidates</th>
                            <th className="p-3 text-center">Holding %</th>
                            <th className="p-3 text-right">Calculated Share (₹)</th>
                            <th className="p-3 text-right">Total Disbursed (₹)</th>
                            <th className="p-3 text-right">Net Payable Balance (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {visibleShareholders.map((holder) => (
                            <tr key={holder.id} className="hover:bg-slate-800/30 font-medium text-slate-200">
                              <td className="p-3 font-bold text-slate-100">
                                <div>{holder.name}</div>
                                {holder.status === 'inactive' && (
                                  <span className="text-[9px] text-rose-400 bg-rose-950 px-1 py-0.5 rounded font-bold">INACTIVE</span>
                                )}
                              </td>
                              <td className="p-3 text-slate-400">
                                <div>{holder.role}</div>
                                <div className="text-[10px] text-blue-400 font-semibold">{holder.secondRole}</div>
                              </td>
                              <td className="p-3 text-center text-slate-300 font-mono">{holder.partnerSince}</td>
                              <td className="p-3 text-center">
                                {holder.target > 0 ? (
                                  <span className="px-2 py-0.5 bg-slate-800 rounded text-[11px] font-bold text-amber-400">
                                    {holder.joinedCandidatesCount} / {holder.target}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-bold">N/A</span>
                                )}
                              </td>
                              <td className="p-3 text-center font-black text-blue-400 bg-blue-950/20">
                                {holder.percentage}%
                              </td>
                              <td className="p-3 text-right font-bold text-slate-100">
                                ₹ {(holder.grossProfit || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right font-bold text-emerald-400">
                                ₹ {(holder.totalDisbursed || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="p-3 text-right font-black text-amber-400 text-sm">
                                ₹ {(holder.netPayableBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'settlements' && (
                <div className="space-y-6">
                  {isAdmin && (
                    <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4 shadow-xl">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h4 className="text-xs font-extrabold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                          <span>🛡️</span> Admin Direct Settlement & Verification Panel
                        </h4>
                        <span className="text-[10px] text-slate-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          Secure Auth Guard
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                            1. Search & Select Partner / Shareholder
                          </label>
                          <input
                            type="text"
                            placeholder="Type partner name or role..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:ring-1 focus:ring-blue-500"
                          />
                          <select
                            value={selectedPartnerId}
                            onChange={(e) => setSelectedPartnerId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-bold text-slate-100 focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-- Select Partner --</option>
                            {filteredShareholdersForSearch.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.role})
                              </option>
                            ))}
                          </select>

                          {targetShareholder && (
                            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                              <p className="text-xs font-bold text-slate-200">{targetShareholder.name}</p>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">Calculated Share:</span>
                                <span className="font-bold text-slate-200">
                                  ₹{(targetShareholder.grossProfit || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">Total Already Disbursed:</span>
                                <span className="font-bold text-emerald-400">
                                  ₹{(targetShareholder.totalDisbursed || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px] pt-1 border-t border-slate-800">
                                <span className="text-amber-400 font-bold">Max Allowed Balance:</span>
                                <span className="font-black text-amber-400">
                                  ₹{(targetNetBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                            2. Settlement Payment & Credentials
                          </label>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block mb-1">Payment Mode</span>
                              <select
                                value={paymentMode}
                                onChange={(e: any) => setPaymentMode(e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-bold text-slate-100"
                              >
                                <option value="NEFT">NEFT</option>
                                <option value="UPI">UPI / PhonePe</option>
                                <option value="IMPS">IMPS</option>
                                <option value="RTGS">RTGS</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                              </select>
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block mb-1">Amount (₹)</span>
                              <input
                                type="number"
                                placeholder="Amount"
                                value={settleAmount}
                                onChange={(e) => setSettleAmount(e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs font-bold text-slate-100"
                              />
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block mb-1">Transaction Ref / UTR No.</span>
                            <input
                              type="text"
                              placeholder="e.g. UTR-1788100080029 or UPI Txn ID"
                              value={transactionRef}
                              onChange={(e) => setTransactionRef(e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                            <input
                              type="email"
                              placeholder="Admin Email ID"
                              value={adminAuthEmail}
                              onChange={(e) => setAdminAuthEmail(e.target.value)}
                              className="px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100"
                            />
                            <input
                              type="password"
                              placeholder="Admin Password"
                              value={adminAuthPassword}
                              onChange={(e) => setAdminAuthPassword(e.target.value)}
                              className="px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100"
                            />
                          </div>

                          <button
                            onClick={handleAdminSettlePayment}
                            disabled={isVerifyingAdmin}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-lg shadow-md transition-all mt-2"
                          >
                            {isVerifyingAdmin ? 'Verifying Credentials...' : '🔐 Verify & Record Payout Settlement'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isAdmin && (
                    <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Submit Payout Request
                        </h4>
                        <span className="text-xs font-semibold text-amber-400">
                          Max Eligible Limit: ₹{(currentUserNetBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          max={currentUserNetBalance}
                          placeholder={`Max ₹${(currentUserNetBalance || 0).toFixed(0)}`}
                          value={requestAmountInput}
                          onChange={(e) => setRequestAmountInput(e.target.value)}
                          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        />
                        <button
                          onClick={handlePartnerRequestPayout}
                          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md transition-all"
                        >
                          Submit Request
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                    <div className="p-3 bg-slate-800/50 border-b border-slate-800 font-bold text-xs text-slate-300 uppercase tracking-wider flex justify-between items-center">
                      <span>Settlement & Request Ledger</span>
                      <span className="text-[10px] text-slate-400 font-normal">Records filter applied by selected FY/Month</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-800">
                          <tr>
                            <th className="p-3">Partner Name</th>
                            <th className="p-3">Requested / Settled Amount</th>
                            <th className="p-3">Date</th>
                            <th className="p-3">Status</th>
                            {isAdmin && <th className="p-3 text-center">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
                          {filteredRequests.map((req) => (
                            <tr key={req.id} className="hover:bg-slate-800/30">
                              <td className="p-3 font-bold text-slate-100">{req.full_name}</td>
                              <td className="p-3 font-bold text-slate-100">₹ {(req.amount || 0).toLocaleString('en-IN')}</td>
                              <td className="p-3 text-slate-400">{req.created_at ? new Date(req.created_at).toLocaleDateString('en-IN') : '-'}</td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-wider ${
                                    req.status === 'approved'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                      : req.status === 'rejected'
                                      ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                                      : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                                  }`}
                                >
                                  {req.status}
                                </span>
                              </td>
                              {isAdmin && (
                                <td className="p-3 text-center space-x-2">
                                  {req.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => handleUpdateRequestStatus(req.id, 'approved')}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleUpdateRequestStatus(req.id, 'rejected')}
                                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                          {filteredRequests.length === 0 && (
                            <tr>
                              <td colSpan={isAdmin ? 5 : 4} className="p-6 text-center text-slate-500 font-medium">
                                No settlement or payout requests found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'directory' && isAdmin && (
                <div className="space-y-4">
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                    <div className="p-3 bg-slate-800/50 border-b border-slate-800 font-bold text-xs text-slate-300 uppercase tracking-wider flex justify-between items-center">
                      <span>Registered Network Profiles & Partner Configuration</span>
                      <span className="text-[10px] bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded font-bold">
                        Admin Only View
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-800">
                          <tr>
                            <th className="p-3">User / Partner Name</th>
                            <th className="p-3">Email & Phone</th>
                            <th className="p-3">Holding %</th>
                            <th className="p-3">Assigned Role</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
                          {profiles
                            .filter((p) => p.role?.toLowerCase() !== 'admin' && p.id !== EXCLUDED_USER_ID)
                            .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', undefined, { sensitivity: 'base' }))
                            .map((p) => {
                              const partnerRec = partnersList.find((ptr) => ptr.user_id === p.id);
                              const isPartner = !!partnerRec && partnerRec.status === 'active';
                              const isEditingThisUser = editingUserId === p.id;

                              return (
                                <Fragment key={p.id}>
                                  <tr className="hover:bg-slate-800/30">
                                    <td className="p-3 font-bold text-slate-100">
                                      <div>{p.full_name}</div>
                                      {partnerRec?.partner_since && (
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          Since: {new Date(partnerRec.partner_since).toLocaleDateString('en-IN')}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-slate-400">
                                      <div>{p.email}</div>
                                      <div className="text-[10px] text-slate-500">{p.mobile}</div>
                                    </td>
                                    <td className="p-3 font-bold text-blue-400">
                                      {partnerRec && partnerRec.status === 'active' ? `${partnerRec.holding_percentage}%` : '0%'}
                                    </td>
                                    <td className="p-3 text-slate-300 font-semibold">
                                      {partnerRec?.second_role || p.role || '-'}
                                    </td>
                                    <td className="p-3">
                                      <span
                                        className={`px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider ${
                                          partnerRec?.status === 'active'
                                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                                        }`}
                                      >
                                        {partnerRec?.status || 'inactive'}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center space-x-2">
                                      <button
                                        onClick={() => {
                                          if (isEditingThisUser) {
                                            setEditingUserId(null);
                                          } else {
                                            setEditingUserId(p.id);
                                            setEditHoldingPct(partnerRec?.holding_percentage || 5);
                                            setEditSelectedRole(partnerRec?.second_role || 'Marketing & Support');
                                            setEditTargetCandidates(partnerRec?.target_candidates || 400);
                                            setEditStatus(partnerRec?.status || 'active');
                                            setEditPartnerSince(
                                              partnerRec?.partner_since
                                                ? new Date(partnerRec.partner_since).toISOString().split('T')[0]
                                                : new Date().toISOString().split('T')[0]
                                            );
                                          }
                                        }}
                                        className={`px-2.5 py-1 text-white font-bold text-[10px] rounded shadow transition-all ${
                                          isEditingThisUser
                                            ? 'bg-amber-600 hover:bg-amber-700'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                      >
                                        {isEditingThisUser ? '✕ Cancel' : 'Promote / Edit Partner'}
                                      </button>
                                      {isPartner && (
                                        <button
                                          onClick={() => handleRemovePartnerRole(p.id)}
                                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded shadow"
                                        >
                                          Revoke Status
                                        </button>
                                      )}
                                    </td>
                                  </tr>

                                  {isEditingThisUser && (
                                    <tr className="bg-slate-900/90 border-t border-b border-blue-500/40">
                                      <td colSpan={6} className="p-4">
                                        <div className="p-4 bg-slate-950 border border-blue-600/50 rounded-xl space-y-4 shadow-2xl">
                                          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                            <h4 className="text-xs font-black text-blue-400 uppercase tracking-wider">
                                              Promote / Edit Partner Role for {p.full_name}
                                            </h4>
                                            <button
                                              onClick={() => setEditingUserId(null)}
                                              className="text-slate-400 hover:text-white text-xs font-bold"
                                            >
                                              ✕ Close
                                            </button>
                                          </div>

                                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-400 block mb-1">Assigned Role</label>
                                              <select
                                                value={editSelectedRole}
                                                onChange={(e) => setEditSelectedRole(e.target.value)}
                                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 font-bold focus:ring-1 focus:ring-blue-500"
                                              >
                                                <option value="CEO">CEO</option>
                                                <option value="Marketing & Support">Marketing & Support</option>
                                                <option value="Investor">Investor</option>
                                              </select>
                                            </div>

                                            <div>
                                              <label className="text-[10px] font-bold text-slate-400 block mb-1">Holding %</label>
                                              <input
                                                type="number"
                                                value={editHoldingPct}
                                                onChange={(e) => setEditHoldingPct(Number(e.target.value))}
                                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 font-bold"
                                              />
                                            </div>

                                            <div>
                                              <label className="text-[10px] font-bold text-slate-400 block mb-1">Target Candidates</label>
                                              <input
                                                type="number"
                                                value={editTargetCandidates}
                                                onChange={(e) => setEditTargetCandidates(Number(e.target.value))}
                                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 font-bold"
                                              />
                                            </div>

                                            <div>
                                              <label className="text-[10px] font-bold text-slate-400 block mb-1">Status</label>
                                              <select
                                                value={editStatus}
                                                onChange={(e: any) => setEditStatus(e.target.value)}
                                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 font-bold"
                                              >
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                                <option value="revoked">Revoked</option>
                                              </select>
                                            </div>

                                            <div>
                                              <label className="text-[10px] font-bold text-slate-400 block mb-1">Partner Since Date</label>
                                              <input
                                                type="date"
                                                value={editPartnerSince}
                                                onChange={(e) => setEditPartnerSince(e.target.value)}
                                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                                              />
                                            </div>
                                          </div>

                                          <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <input
                                              type="email"
                                              placeholder="Admin Email ID"
                                              value={dirAdminEmail}
                                              onChange={(e) => setDirAdminEmail(e.target.value)}
                                              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100"
                                            />
                                            <input
                                              type="password"
                                              placeholder="Admin Password"
                                              value={dirAdminPassword}
                                              onChange={(e) => setDirAdminPassword(e.target.value)}
                                              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100"
                                            />
                                            <button
                                              onClick={() => handleUpdatePartnerDetails(p.id)}
                                              disabled={isSavingPartner}
                                              className="py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded shadow transition-all"
                                            >
                                              {isSavingPartner ? 'Authenticating...' : '🔐 Confirm & Save to DB'}
                                            </button>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* MONTH-WISE BREAKUP MODAL (UPDATED WITH ADMIN DEDUCTION COLUMN) */}
      {isBreakupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl">
            
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div>
                <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">
                  Financial Year Month-Wise Expense & Revenue Breakup
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Financial Year: FY {selectedYear} | Detail view showing Total Gross Billing & Deductions
                </p>
              </div>
              <button
                onClick={() => setIsBreakupModalOpen(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 font-bold text-slate-400 uppercase bg-slate-800/40">
                    <th className="p-3">Month</th>
                    <th className="p-3 text-right">Total Gross Billing</th>
                    <th className="p-3 text-right">Admin Deduction</th>
                    <th className="p-3 text-right">Fixed Op Costs</th>
                    <th className="p-3 text-right">Partner Payouts</th>
                    <th className="p-3 text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {monthlyBreakupData.map((item) => (
                    <tr
                      key={item.monthIndex}
                      className={`hover:bg-slate-800/30 ${
                        item.monthIndex === selectedMonth ? 'bg-blue-950/20 font-bold' : ''
                      }`}
                    >
                      <td className="p-3 text-slate-200">
                        {item.monthName} {selectedYear}
                        {item.monthIndex === selectedMonth && (
                          <span className="ml-2 text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-black">
                            SELECTED
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right text-emerald-400 font-bold">
                        ₹ {item.totalGross.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right text-rose-400 font-bold">
                        - ₹ {item.adminDeduction.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right text-amber-400 font-bold">
                        - ₹ {item.expenses.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right text-indigo-400 font-bold">
                        - ₹ {item.payouts.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right font-black text-emerald-300 text-sm">
                        ₹ {item.net.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center text-xs text-slate-400">
              <span>Formula: Net Profit = Total Gross - Admin Deduction - Op Cost - Payouts</span>
              <button
                onClick={() => setIsBreakupModalOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}