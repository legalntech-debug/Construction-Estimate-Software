'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Calendar, User, ShieldCheck, X, Search, FileText } from 'lucide-react';
import emailjs from '@emailjs/browser';
// Change these lines:
import WithdrawalModal from '../components/WithdrawalModal';
import AdminApprovalModal from '../components/AdminApprovalModal';

interface UserProfile {
  id: string;
  full_name: string;
  mobile: string;
  email: string;
  user_type: string;
  plan_type: string;
  firm_name?: string;
  city: string;
  state: string;
  user_code: string;
  wallet_balance: number;
  created_at: string;
  address?: string;
}

interface Transaction {
  id: string;
  created_at: string;
  ref_no: string;
  customer_name: string;
  case_type: string;
  payment_mode: string;
  razorpay_payment_id?: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balance_after: number;
}

interface RefundRequest {
  id: string;
  user_id: string;
  amount: number;
  bank_details: string;
  status: string;
  created_at: string;
  utr_no?: string;
}

export default function WalletLedgerPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  const [showRefundModal, setShowRefundModal] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);

  // OTP Verification States for Refund Modal Security
  const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
  const [otpStep, setOtpStep] = useState<number>(1);
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [otpLoading, setOtpLoading] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string>('');

  // Search & Filter States for Table Headers
  const [filterRef, setFilterRef] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterCaseType, setFilterCaseType] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState('');
  const [filterCredit, setFilterCredit] = useState('');

  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Anti-Screenshot & Anti-Recording Protection Effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        (e.ctrlKey && e.key.toLowerCase() === 's') ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i')
      ) {
        e.preventDefault();
        alert('Screenshots and recording are strictly disabled for security reasons.');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.body.style.filter = 'blur(25px)';
      } else {
        document.body.style.filter = 'none';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchLedgerData();
    }
  }, [selectedMonth, selectedUserId]);

  const fetchInitialData = async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
        setTargetProfile(profileData);

        if (profileData.user_type?.toLowerCase() === 'admin') {
          const { data: usersList } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('full_name', { ascending: true });
          if (usersList) {
            setAllUsers(usersList);
          }
        }
        setSelectedUserId(session.user.id);
      }
    }
  };

  const fetchLedgerData = async () => {
    if (!selectedUserId) return;
    setLoading(true);

    let currentTarget = profile;
    if (profile?.user_type?.toLowerCase() === 'admin' && selectedUserId !== profile.id) {
      const { data: targetData } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', selectedUserId)
        .maybeSingle();
      if (targetData) {
        currentTarget = targetData;
        setTargetProfile(targetData);
      }
    } else {
      setTargetProfile(profile);
    }

    const startDate = `${selectedMonth}-01T00:00:00`;
    const endDate = `${selectedMonth}-31T23:59:59`;

    const { data: walletTx } = await supabaseClient
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', selectedUserId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const { data: rechargeTx } = await supabaseClient
      .from('wallet_recharges')
      .select('*')
      .eq('user_id', selectedUserId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const { data: estimateTx } = await supabaseClient
      .from('estimates')
      .select('*')
      .eq('user_id', selectedUserId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    let combinedTx: Transaction[] = [];

    if (walletTx) {
      walletTx.forEach((w: any) => {
        combinedTx.push({
          id: w.id,
          created_at: w.created_at,
          ref_no: w.ref_no || 'TOPUP-REF',
          customer_name: w.customer_name || currentTarget?.full_name || 'Wallet Topup',
          case_type: w.case_type || 'Wallet Recharge',
          payment_mode: w.payment_mode || 'Razorpay Gateway',
          razorpay_payment_id: w.razorpay_payment_id,
          type: w.type === 'DEBIT' ? 'DEBIT' : 'CREDIT',
          amount: Number(w.amount),
          balance_after: 0
        });
      });
    }

    if (rechargeTx) {
      rechargeTx.forEach((r: any) => {
        const exists = combinedTx.some(t => t.id === r.id || (t.amount === Number(r.amount) && t.created_at === r.created_at));
        if (!exists) {
          combinedTx.push({
            id: r.id,
            created_at: r.created_at || r.updated_at,
            ref_no: r.ref_no || 'RECHARGE-' + r.id.slice(0, 6),
            customer_name: r.customer_name || currentTarget?.full_name || 'Self Recharge',
            case_type: 'Wallet Topup',
            payment_mode: r.payment_mode || 'Online Gateway',
            razorpay_payment_id: r.razorpay_payment_id,
            type: 'CREDIT',
            amount: Number(r.amount),
            balance_after: 0
          });
        }
      });
    }

    if (estimateTx) {
      estimateTx.forEach((e: any) => {
        const fee = Number(e.user_payment || e.fee_standard || 0);
        combinedTx.push({
          id: e.ref_no || e.id,
          created_at: e.created_at,
          ref_no: e.ref_no || 'ESTIMATE-REF',
          customer_name: e.customer_name || e.client_name || 'N/A',
          case_type: e.estimate_type || 'Construction Plan / Estimate',
          payment_mode: e.platform_payment_status === 'paid' ? 'Online Gateway' : 'Wallet Deduction',
          razorpay_payment_id: e.razorpay_payment_id,
          type: 'DEBIT',
          amount: fee,
          balance_after: 0
        });
      });
    }

    combinedTx.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let runningCalc = 0;
    const calculatedTx = combinedTx.map((tx) => {
      if (tx.type === 'CREDIT') {
        runningCalc += tx.amount;
      } else {
        runningCalc -= tx.amount;
      }
      return {
        ...tx,
        balance_after: runningCalc
      };
    });

    calculatedTx.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setTransactions(calculatedTx);

    const { data: refundData } = await supabaseClient
      .from('wallet_refund_requests')
      .select('*')
      .eq('user_id', selectedUserId)
      .order('created_at', { ascending: false });

    if (refundData) {
      setRefundRequests(refundData);
    }
    setLoading(false);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.email) return;
    setOtpLoading(true);
    setOtpError('');

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const { error: otpError } = await supabaseClient.from('otps').insert([
      { email: profile.email, otp_code: generatedOtp }
    ]);

    if (otpError) {
      setOtpError("Database error while generating OTP.");
      setOtpLoading(false);
      return;
    }

    emailjs.send(
      'service_g8hpevj',
      'template_4sqme4r',
      {
        to_email: profile.email,
        otp_code: generatedOtp,
      },
      'grxZ-VWExc0FNxr5n'
    )
    .then(() => {
      setOtpStep(2);
      setOtpLoading(false);
    })
    .catch(() => {
      setOtpError("Failed to send email via EmailJS.");
      setOtpLoading(false);
    });
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.email) return;
    setOtpLoading(true);
    setOtpError('');

    const { data, error: dbError } = await supabaseClient
      .from('otps')
      .select('otp_code')
      .eq('email', profile.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbError || !data || data.otp_code !== enteredOtp) {
      setOtpError('Invalid OTP! Please try again.');
      setOtpLoading(false);
      return;
    }

    setOtpLoading(false);
    setShowOtpModal(false);
    setEnteredOtp('');
    setOtpStep(1);
    setShowRefundModal(true);
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filterRef && !tx.ref_no.toLowerCase().includes(filterRef.toLowerCase())) return false;
    if (filterCustomer && !tx.customer_name.toLowerCase().includes(filterCustomer.toLowerCase())) return false;
    if (filterCaseType && !tx.case_type.toLowerCase().includes(filterCaseType.toLowerCase())) return false;
    if (filterPaymentMode && !tx.payment_mode.toLowerCase().includes(filterPaymentMode.toLowerCase())) return false;
    if (filterCredit && tx.type === 'CREDIT' && !tx.amount.toString().includes(filterCredit)) return false;
    if (filterCredit && tx.type !== 'CREDIT') return false;
    return true;
  });

  const totalCredit = filteredTransactions
    .filter(t => t.type === 'CREDIT')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalDebit = filteredTransactions
    .filter(t => t.type === 'DEBIT')
    .reduce((acc, t) => acc + t.amount, 0);

  const isAdmin = profile?.user_type?.toLowerCase() === 'admin';

  const filteredUsersList = allUsers.filter(u => 
    u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.user_code?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.mobile?.includes(userSearchQuery)
  );

  return (
    <div className="p-8 max-w-[1400px] mx-auto bg-slate-50 min-h-screen text-black font-sans relative select-none" style={{ WebkitUserSelect: 'none' }}>
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wide uppercase">Wallet & Account Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">Complete banking-style statement combining gateway approvals, recharges, and estimates usage.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg border border-slate-300">
            <Calendar size={18} className="text-slate-600" />
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-semibold outline-none cursor-pointer"
            />
          </div>

          {!isAdmin && (
            <button 
              onClick={() => setShowOtpModal(true)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow"
            >
              Request Unutilized Balance Refund
            </button>
          )}

          {/* Secure Print / PDF Statement Button */}
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition shadow"
          >
            <FileText size={16} /> Print / Download PDF Statement
          </button>
        </div>
      </div>

      {/* ADMIN SPECIAL PASSBOOK CHECKER SECTION */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 p-6 rounded-xl shadow-md text-white mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Search size={20} className="text-blue-400" />
            <h2 className="text-base font-black uppercase tracking-wider">Admin Passbook & Issue Resolver Panel</h2>
          </div>
          <p className="text-xs text-slate-300 mb-4">Search any registered user by Name, Code, Email, or Mobile to instantly inspect their wallet balance, passbook entries, and resolve issues.</p>
          
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <input 
                type="text"
                placeholder="Search user by name, code, email, or mobile..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-blue-400 placeholder:text-slate-500 font-medium"
              />
            </div>
            <div className="w-full md:w-auto min-w-[300px]">
              <select 
                value={selectedUserId} 
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-blue-800 text-white text-sm font-bold px-4 py-2.5 rounded-lg border border-blue-600 outline-none cursor-pointer"
              >
                {filteredUsersList.map((usr) => (
                  <option key={usr.id} value={usr.id}>
                    {usr.full_name} ({usr.user_code || 'No Code'}) - {usr.mobile || usr.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Customer & Profile Information Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
        <h2 className="text-sm font-black uppercase text-slate-700 tracking-wider mb-4 border-b pb-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <User size={18} className="text-blue-600" /> Customer & Profile Information (KYC Verified)
          </span>
          <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-bold">
            <ShieldCheck size={14} /> KYC Active
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Customer Name</span>
            <span className="font-bold text-slate-900 text-base">{targetProfile?.full_name || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">System ID (User Code)</span>
            <span className="font-semibold text-blue-600">{targetProfile?.user_code || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Mobile Number</span>
            <span className="font-semibold text-slate-800">{targetProfile?.mobile || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Email Address</span>
            <span className="font-semibold text-slate-800">{targetProfile?.email || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Plan Type</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-xs uppercase">{targetProfile?.plan_type || 'Basic Plan'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Category / User Type</span>
            <span className="font-semibold text-slate-800">{targetProfile?.user_type || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Location (State / City)</span>
            <span className="font-semibold text-slate-800">{targetProfile?.city && targetProfile?.state ? `${targetProfile.city}, ${targetProfile.state}` : 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">A/C Creation Date</span>
            <span className="font-semibold text-slate-800">{targetProfile?.created_at ? new Date(targetProfile.created_at).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div className="md:col-span-4 mt-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase block">Registered Address</span>
            <span className="font-medium text-slate-700">{targetProfile?.address || 'No address provided during registration.'}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Wallet Balance</p>
            <h2 className="text-3xl font-black text-emerald-600 mt-2">₹ {(targetProfile?.wallet_balance ?? 0).toFixed(2)}</h2>
          </div>
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full"><Wallet size={28} /></div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Credited (Filtered)</p>
            <h2 className="text-3xl font-black text-blue-600 mt-2">+ ₹ {totalCredit.toFixed(2)}</h2>
          </div>
          <div className="p-4 bg-blue-50 text-blue-600 rounded-full"><ArrowDownCircle size={28} /></div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Debited (Filtered)</p>
            <h2 className="text-3xl font-black text-rose-600 mt-2">- ₹ {totalDebit.toFixed(2)}</h2>
          </div>
          <div className="p-4 bg-rose-50 text-rose-600 rounded-full"><ArrowUpCircle size={28} /></div>
        </div>
      </div>

      {/* Month-wise Ledger Table with Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-sm uppercase tracking-wide text-slate-700 flex justify-between items-center">
          <span>Month-Wise Ledger Statement ({selectedMonth})</span>
          <span className="text-xs text-slate-500 font-normal">Banking Passbook Format with Multi-Filters</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Loading ledger records...</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">No transactions found for this month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-900 text-white font-bold uppercase text-[10pt]">
                  <th className="p-3 w-16">Sr.</th>
                  
                  {/* Ref No Filter */}
                  <th className="p-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">Ref No.</span>
                      <input 
                        type="text" 
                        placeholder="Filter Ref..." 
                        value={filterRef}
                        onChange={(e) => setFilterRef(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white font-normal focus:outline-none focus:border-blue-400 placeholder:text-slate-500"
                      />
                    </div>
                  </th>

                  <th className="p-3 w-28">Date</th>

                  {/* Customer Name Filter */}
                  <th className="p-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">Customer Name</span>
                      <input 
                        type="text" 
                        placeholder="Filter Customer..." 
                        value={filterCustomer}
                        onChange={(e) => setFilterCustomer(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white font-normal focus:outline-none focus:border-blue-400 placeholder:text-slate-500"
                      />
                    </div>
                  </th>

                  {/* Case Type Filter */}
                  <th className="p-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">Case Type</span>
                      <input 
                        type="text" 
                        placeholder="Filter Case..." 
                        value={filterCaseType}
                        onChange={(e) => setFilterCaseType(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white font-normal focus:outline-none focus:border-blue-400 placeholder:text-slate-500"
                      />
                    </div>
                  </th>

                  {/* Payment Mode Filter */}
                  <th className="p-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">Payment Mode / Details</span>
                      <input 
                        type="text" 
                        placeholder="Filter Mode..." 
                        value={filterPaymentMode}
                        onChange={(e) => setFilterPaymentMode(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white font-normal focus:outline-none focus:border-blue-400 placeholder:text-slate-500"
                      />
                    </div>
                  </th>

                  {/* Credit Filter Added */}
                  <th className="p-2 text-right w-32">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-300">Credit (+)</span>
                      <input 
                        type="text" 
                        placeholder="Filter Credit..." 
                        value={filterCredit}
                        onChange={(e) => setFilterCredit(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white font-normal focus:outline-none focus:border-blue-400 placeholder:text-slate-500 text-right"
                      />
                    </div>
                  </th>

                  <th className="p-3 text-right w-28">Debit (-)</th>
                  <th className="p-3 text-right w-36">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10pt]">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-400 font-medium">No matching records found for your filter.</td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx, index) => (
                    <tr key={tx.id || index} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-500">{index + 1}</td>
                      <td className="p-3 font-mono text-xs text-blue-600 font-bold">{tx.ref_no || 'N/A'}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td className="p-3 font-medium text-slate-900 uppercase">{tx.customer_name || 'N/A'}</td>
                      <td className="p-3 text-slate-700 uppercase">{tx.case_type || 'N/A'}</td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-800 block">{tx.payment_mode || 'N/A'}</span>
                      </td>
                      <td className="p-3 text-right font-black text-blue-600">
                        {tx.type === 'CREDIT' ? `₹ ${tx.amount}` : '-'}
                      </td>
                      <td className="p-3 text-right font-black text-rose-600">
                        {tx.type === 'DEBIT' ? `₹ ${tx.amount}` : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        ₹ {tx.balance_after?.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OTP Verification Modal for Refund Security */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => { setShowOtpModal(false); setOtpStep(1); setEnteredOtp(''); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-lg font-black text-slate-900 uppercase mb-1">Security Verification</h3>
            <p className="text-xs text-slate-500 mb-4">Secure verification via email OTP to process refund request.</p>

            {otpError && (
              <div className="bg-red-100 text-red-700 text-xs p-2.5 rounded mb-3 font-semibold uppercase">
                {otpError}
              </div>
            )}

            {otpStep === 1 ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-700">An OTP will be sent to your registered email: <b className="text-blue-900">{profile?.email}</b></p>
                <button 
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  className="w-full bg-blue-900 hover:bg-blue-800 text-white py-2.5 rounded font-bold transition uppercase text-sm tracking-wider"
                >
                  {otpLoading ? 'SENDING OTP...' : 'SEND OTP'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-2 rounded text-center font-bold">
                  OTP SENT SUCCESSFULLY TO EMAIL
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="ENTER 6-DIGIT OTP"
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full border-2 p-2 rounded text-center tracking-widest font-black text-xl text-slate-800 focus:ring-2 focus:ring-green-600"
                />
                <button 
                  type="submit"
                  disabled={otpLoading}
                  className="w-full bg-green-700 hover:bg-green-600 text-white py-2.5 rounded font-bold transition uppercase text-sm tracking-wider"
                >
                  {otpLoading ? 'VERIFYING...' : 'VERIFY & PROCEED'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <WithdrawalModal 
        isOpen={showRefundModal} 
        onClose={() => setShowRefundModal(false)} 
        profile={profile} 
        onSuccess={fetchLedgerData} 
        supabaseClient={supabaseClient} 
      />

      <AdminApprovalModal 
        selectedRequest={selectedRequest} 
        onClose={() => setSelectedRequest(null)} 
        onSuccess={fetchLedgerData} 
        supabaseClient={supabaseClient} 
        profile={profile} 
      />

    </div>
  );
}