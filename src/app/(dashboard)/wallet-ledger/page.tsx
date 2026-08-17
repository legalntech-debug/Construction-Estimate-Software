'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Calendar, X, Search, Printer, ChevronDown, Lock, ArrowRight, AlertTriangle } from 'lucide-react';
import emailjs from '@emailjs/browser';
import WithdrawalModal from './components/WithdrawalModal';
import AdminApprovalModal from './components/AdminApprovalModal';
import CustomerProfileCard from './components/CustomerProfileCard';

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
  role?: string;
  aadhaar_no?: string;
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

const INDIAN_STATES_AND_DISTRICTS: { [key: string]: string[] } = {
  "ANDHRA PRADESH": ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Prakasam", "Srikakulam", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"],
  "MAHARASHTRA": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
  "UTTAR PRADESH": ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Badaun", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Raebareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"]
};

export default function WalletLedgerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [isLockedOut, setIsLockedOut] = useState<boolean>(false);
  const [lockoutMessage, setLockoutMessage] = useState<string>('');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('ALL');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('ALL');
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [showDateDropdown, setShowDateDropdown] = useState<boolean>(false);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const [showRefundModal, setShowRefundModal] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);

  const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
  const [otpStep, setOtpStep] = useState<number>(1);
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [otpLoading, setOtpLoading] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string>('');

  const [filterRef, setFilterRef] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterCaseType, setFilterCaseType] = useState('');
  const [filterPaymentMode, setFilterPaymentMode] = useState('');
  const [filterCredit, setFilterCredit] = useState('');

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        handleAutoLogoutDueToInactivity();
      }, 20 * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetIdleTimer));

    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach(event => window.removeEventListener(event, resetIdleTimer));
    };
  }, [isAuthenticated]);

  const handleAutoLogoutDueToInactivity = () => {
    sessionStorage.removeItem('ledger_authenticated');
    window.location.href = '/dashboard';
  };

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
        setSelectedUserId(session.user.id);

        const { data: lockData } = await supabaseClient
          .from('user_security_logs')
          .select('locked_until')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (lockData && lockData.locked_until) {
          const lockTime = new Date(lockData.locked_until).getTime();
          if (Date.now() < lockTime) {
            setIsLockedOut(true);
            setLockoutMessage(`Account locked due to multiple incorrect password attempts. Try again after ${new Date(lockData.locked_until).toLocaleString()}.`);
          } else {
            await supabaseClient.from('user_security_logs').update({ failed_attempts: 0, locked_until: null }).eq('user_id', session.user.id);
          }
        }

        const userType = profileData.user_type?.trim().toLowerCase();
        const userRole = profileData.role?.trim().toLowerCase();
        
        if (userType === 'admin' || userType === 'administrator' || userType === 'founder' || userRole === 'admin') {
          const { data: usersList } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('full_name', { ascending: true });
          if (usersList) setAllUsers(usersList);
        }
      }
    }
  };

  useEffect(() => {
    if (selectedUserId && isAuthenticated) {
      fetchLedgerData();
    }
  }, [selectedUserId, selectedMonth, fromDate, toDate, isAuthenticated]);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;
    setAuthLoading(true);
    setAuthError('');

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user?.email || !profile) {
      setAuthError('No active session found. Please login again.');
      setAuthLoading(false);
      return;
    }

    const { error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: session.user.email,
      password: loginPassword,
    });

    if (signInError) {
      let { data: secLog } = await supabaseClient
        .from('user_security_logs')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      let attempts = (secLog?.failed_attempts || 0) + 1;

      if (attempts >= 5) {
        const lockoutTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        
        if (!secLog) {
          await supabaseClient.from('user_security_logs').insert([{ user_id: profile.id, failed_attempts: attempts, locked_until: lockoutTime }]);
        } else {
          await supabaseClient.from('user_security_logs').update({ failed_attempts: attempts, locked_until: lockoutTime }).eq('user_id', profile.id);
        }

        setIsLockedOut(true);
        setLockoutMessage('Incorrect password entered 5 times. Your ledger access is locked for 24 hours. A warning notification has been sent.');
        setAuthLoading(false);

        emailjs.send(
          'service_g8hpevj',
          'template_4sqme4r',
          {
            to_email: profile.email,
            user_name: profile.full_name,
            warning_message: 'Your account ledger access has been locked for 24 hours due to 5 consecutive invalid password attempts.'
          },
          'grxZ-VWExc0FNxr5n'
        ).catch(() => {});

        return;
      } else {
        if (!secLog) {
          await supabaseClient.from('user_security_logs').insert([{ user_id: profile.id, failed_attempts: attempts }]);
        } else {
          await supabaseClient.from('user_security_logs').update({ failed_attempts: attempts }).eq('user_id', profile.id);
        }

        setAuthError(`Invalid password. Attempt ${attempts} of 5. After 5 attempts, access will be locked for 24 hours.`);
        setAuthLoading(false);
        return;
      }
    }

    await supabaseClient.from('user_security_logs').upsert({ user_id: profile.id, failed_attempts: 0, locked_until: null });

    sessionStorage.setItem('ledger_authenticated', 'true');
    setIsAuthenticated(true);
    setAuthLoading(false);
  };

  const fetchLedgerData = async () => {
    if (!selectedUserId) return;
    setLoading(true);

    let currentTarget = profile;
    const currentUserType = profile?.user_type?.trim().toLowerCase();
    const currentUserRole = profile?.role?.trim().toLowerCase();
    const isAdmin = currentUserType === 'admin' || currentUserType === 'administrator' || currentUserType === 'founder' || currentUserRole === 'admin';
    
    if (isAdmin && selectedUserId !== profile?.id) {
      const { data: targetData } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', selectedUserId)
        .maybeSingle();
      if (targetData) {
        currentTarget = targetData;
        setTargetProfile(targetData);
      }
    } else if (selectedUserId === profile?.id) {
      setTargetProfile(profile);
    }

    let startDate = fromDate ? `${fromDate}T00:00:00` : `${selectedMonth}-01T00:00:00`;
    let endDate = toDate ? `${toDate}T23:59:59` : `${selectedMonth}-31T23:59:59`;

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

    if (calculatedTx.length > 0) {
      const latestBalance = calculatedTx[0].balance_after;
      
      await supabaseClient
        .from('profiles')
        .update({ wallet_balance: latestBalance })
        .eq('id', selectedUserId);

      setTargetProfile(prev => prev ? { ...prev, wallet_balance: latestBalance } : prev);
      if (selectedUserId === profile?.id) {
        setProfile(prev => prev ? { ...prev, wallet_balance: latestBalance } : prev);
      }
    }

    const { data: refundData } = await supabaseClient
      .from('wallet_refund_requests')
      .select('*')
      .eq('user_id', selectedUserId)
      .order('created_at', { ascending: false });

    if (refundData) setRefundRequests(refundData);
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

  const totalCredit = filteredTransactions.filter(t => t.type === 'CREDIT').reduce((acc, t) => acc + t.amount, 0);
  const totalDebit = filteredTransactions.filter(t => t.type === 'DEBIT').reduce((acc, t) => acc + t.amount, 0);

  const userTypeNormalized = profile?.user_type?.trim().toLowerCase();
  const userRoleNormalized = profile?.role?.trim().toLowerCase();
  const isAdmin = userTypeNormalized === 'admin' || userTypeNormalized === 'administrator' || userTypeNormalized === 'founder' || userRoleNormalized === 'admin';

  const filteredUsersList = allUsers.filter(u => {
    if (selectedStateFilter !== 'ALL' && u.state?.trim().toUpperCase() !== selectedStateFilter && !userSearchQuery) return false;
    if (selectedCityFilter !== 'ALL' && u.city?.trim().toUpperCase() !== selectedCityFilter && !userSearchQuery) return false;

    if (userSearchQuery) {
      const q = userSearchQuery.toLowerCase();
      const matchName = u.full_name?.toLowerCase().includes(q);
      const matchCode = u.user_code?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      const matchMobile = u.mobile?.includes(q);
      if (!matchName && !matchCode && !matchEmail && !matchMobile) return false;
    }
    return true;
  });

  const isWalletNegative = (targetProfile?.wallet_balance ?? 0) < 0;

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 font-sans bg-slate-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${isLockedOut ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-900'}`}>
            {isLockedOut ? <AlertTriangle size={24} /> : <Lock size={24} />}
          </div>
          
          <h2 className="text-lg font-black uppercase text-slate-900 mb-1">
            {isLockedOut ? 'Access Locked Out' : 'Secure Account Ledger'}
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            {isLockedOut ? lockoutMessage : 'Please enter your login password to access confidential financial records.'}
          </p>

          {authError && <div className="bg-red-50 text-red-700 text-xs p-3 rounded mb-4 font-bold">{authError}</div>}

          {!isLockedOut && (
            <form onSubmit={handleVerifyPassword} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Login ID (Email)</label>
                <input 
                  type="email" 
                  value={profile?.email || ''} 
                  disabled 
                  className="w-full bg-slate-100 p-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-500 cursor-not-allowed" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Account Password</label>
                <input 
                  type="password" 
                  placeholder="Enter your login password"
                  value={loginPassword} 
                  onChange={(e) => setLoginPassword(e.target.value)} 
                  className="w-full bg-slate-100 p-3 rounded-lg border border-slate-300 text-xs font-semibold text-black outline-none focus:border-blue-900" 
                  required 
                />
              </div>

              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white py-3 rounded-lg font-bold uppercase text-xs tracking-wider transition flex items-center justify-center gap-2 shadow-lg"
              >
                {authLoading ? 'Verifying...' : <>Access Ledger <ArrowRight size={16} /></>}
              </button>
            </form>
          )}

          <div className="mt-6 border-t pt-4">
            <a href="/dashboard" className="text-xs font-bold text-blue-600 hover:underline">Return to Dashboard</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto bg-slate-50 min-h-screen text-black font-sans relative select-none" style={{ WebkitUserSelect: 'none' }}>
      
      {/* Strict Print CSS: Landscape Mode, Profile & Table Visible, Sidebars Hidden */}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }

          body * {
            visibility: hidden !important;
          }

          .printable-ledger-section, .printable-ledger-section * {
            visibility: visible !important;
          }

          .printable-ledger-section {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
          }

          body, html, #__next, main {
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .no-print, nav, aside, header, footer, button, input {
            display: none !important;
          }

          thead {
            display: table-row-group !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 8px !important;
            color: black !important;
            font-size: 9pt !important;
          }
        }
      `}</style>

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wide uppercase">Wallet & Account Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">Complete digital transaction statement combining secure gateway approvals, recharges, and platform usage logs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          
          <div className="relative">
            <div 
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg border border-slate-300 cursor-pointer hover:bg-slate-200 transition"
            >
              <Calendar size={18} className="text-slate-600" />
              <span className="text-sm font-semibold text-slate-800">
                {fromDate && toDate ? `${fromDate} to ${toDate}` : selectedMonth}
              </span>
              <ChevronDown size={14} className="text-slate-500" />
            </div>

            {showDateDropdown && (
              <div className="absolute right-0 mt-2 bg-white border border-slate-300 shadow-xl rounded-xl p-4 z-50 w-72 space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-xs font-bold uppercase text-slate-700">Filter By Date / Month</span>
                  <button onClick={() => setShowDateDropdown(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xs">✕</button>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Month Selector</label>
                  <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value);
                      setFromDate('');
                      setToDate('');
                    }}
                    className="w-full bg-slate-100 text-sm font-semibold p-2 rounded border border-slate-300 outline-none cursor-pointer"
                  />
                </div>
                <div className="border-t pt-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Custom Date Range</label>
                  <div className="flex gap-2">
                    <div>
                      <span className="text-[9px] text-slate-400 block">From</span>
                      <input 
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full bg-slate-100 text-xs p-1.5 rounded border border-slate-300 outline-none cursor-pointer font-medium"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">To</span>
                      <input 
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full bg-slate-100 text-xs p-1.5 rounded border border-slate-300 outline-none cursor-pointer font-medium"
                      />
                    </div>
                  </div>
                </div>
                {(fromDate || toDate) && (
                  <button 
                    onClick={() => { setFromDate(''); setToDate(''); setShowDateDropdown(false); }}
                    className="w-full bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold py-1.5 rounded transition"
                  >
                    Clear Custom Range
                  </button>
                )}
              </div>
            )}
          </div>

          {!isAdmin && (
            <div className="relative group">
              <button 
                onClick={() => {
                  if (isWalletNegative) {
                    alert("Your wallet balance is negative. Please recharge your wallet first to proceed with refund requests.");
                  } else {
                    setShowOtpModal(true);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition shadow whitespace-nowrap flex items-center gap-2 ${
                  isWalletNegative 
                    ? 'bg-slate-300 text-slate-600 cursor-not-allowed' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isWalletNegative && <Lock size={14} />} Request Unutilized Balance Refund
              </button>
            </div>
          )}

          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition shadow whitespace-nowrap print:hidden"
          >
            <Printer size={16} /> Print Statement
          </button>
        </div>
      </div>

      {/* ADMIN PANEL */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 p-6 rounded-xl shadow-md text-white mb-6 print:hidden">
          <div className="flex items-center gap-2 mb-3">
            <Search size={20} className="text-blue-400" />
            <h2 className="text-base font-black uppercase tracking-wider">Advanced Admin Passbook & Issue Resolver Panel</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">Select State</label>
              <input 
                type="text"
                list="admin-states-list"
                placeholder="ALL STATES or type..."
                value={selectedStateFilter === 'ALL' ? '' : selectedStateFilter}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setSelectedStateFilter(val === '' ? 'ALL' : val);
                  setSelectedCityFilter('ALL');
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold outline-none uppercase"
              />
              <datalist id="admin-states-list">
                {Object.keys(INDIAN_STATES_AND_DISTRICTS).map(st => (
                  <option key={st} value={st} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">Select City / District</label>
              <input 
                type="text"
                list="admin-cities-list"
                placeholder="ALL CITIES or type..."
                value={selectedCityFilter === 'ALL' ? '' : selectedCityFilter}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setSelectedCityFilter(val === '' ? 'ALL' : val);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold outline-none uppercase"
              />
              <datalist id="admin-cities-list">
                {selectedStateFilter !== 'ALL' && INDIAN_STATES_AND_DISTRICTS[selectedStateFilter] ? (
                  INDIAN_STATES_AND_DISTRICTS[selectedStateFilter].map(district => (
                    <option key={`${district}-${selectedStateFilter}`} value={district} />
                  ))
                ) : (
                  Object.entries(INDIAN_STATES_AND_DISTRICTS).flatMap(([stateName, districts]) =>
                    districts.map(district => (
                      <option key={`${district}-${stateName}`} value={district} />
                    ))
                  )
                )}
              </datalist>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">Search Name/Code & Select User</label>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Type Name, Code or Mobile..."
                  value={userSearchQuery}
                  onChange={(e) => {
                    const query = e.target.value;
                    setUserSearchQuery(query);
                    if (query.trim() !== '') {
                      const found = allUsers.find(u => 
                        u.full_name?.toLowerCase().includes(query.toLowerCase()) ||
                        u.user_code?.toLowerCase().includes(query.toLowerCase()) ||
                        u.mobile?.includes(query)
                      );
                      if (found) setSelectedUserId(found.id);
                    }
                  }}
                  className="w-1/2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                />
                <select 
                  value={selectedUserId} 
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-1/2 bg-blue-800 text-white text-xs font-bold px-3 py-2 rounded-lg border border-blue-600 outline-none cursor-pointer"
                >
                  {filteredUsersList.map((usr) => (
                    <option key={usr.id} value={usr.id}>
                      {usr.full_name} ({usr.user_code || 'No Code'}) - {usr.city || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Section wrapper - Includes Customer Profile Card & Ledger Table */}
      <div className="printable-ledger-section space-y-6">
        
        {/* Customer Profile Card Component included inside print section */}
        <div>
          <CustomerProfileCard 
            targetProfile={targetProfile} 
            supabaseClient={supabaseClient} 
            onSuccess={fetchLedgerData} 
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 print:grid-cols-3">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Wallet Balance</p>
              <h2 className={`text-3xl font-black mt-2 ${isWalletNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                {isWalletNegative ? `- ₹ ${Math.abs(targetProfile?.wallet_balance ?? 0).toFixed(2)}` : `₹ ${(targetProfile?.wallet_balance ?? 0).toFixed(2)}`}
              </h2>
            </div>
            <div className={`p-4 rounded-full print:hidden ${isWalletNegative ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Wallet size={28} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Credited (Filtered)</p>
              <h2 className="text-3xl font-black text-blue-600 mt-2">+ ₹ {totalCredit.toFixed(2)}</h2>
            </div>
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full print:hidden"><ArrowDownCircle size={28} /></div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Debited (Filtered)</p>
              <h2 className="text-3xl font-black text-rose-600 mt-2">- ₹ {totalDebit.toFixed(2)}</h2>
            </div>
            <div className="p-4 bg-rose-50 text-rose-600 rounded-full print:hidden"><ArrowUpCircle size={28} /></div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-sm uppercase tracking-wide text-slate-700 flex justify-between items-center">
            <span>Ledger Statement ({fromDate && toDate ? `${fromDate} to ${toDate}` : selectedMonth})</span>
            <span className="text-xs text-slate-500 font-normal"> Passbook </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 font-medium">Loading ledger records...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-semibold">No transaction records found for this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-900 text-white font-bold uppercase text-[10pt]">
                    <th className="p-3 w-16">Sr.</th>
                    <th className="p-2">
                      <span className="print:hidden">
                        <input type="text" placeholder="Filter Ref..." value={filterRef} onChange={(e) => setFilterRef(e.target.value)} className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white" />
                      </span>
                      <span className="hidden print:inline">Ref No.</span>
                    </th>
                    <th className="p-3 w-28">Date</th>
                    <th className="p-2">
                      <span className="print:hidden">
                        <input type="text" placeholder="Filter Customer..." value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white" />
                      </span>
                      <span className="hidden print:inline">Customer Name</span>
                    </th>
                    <th className="p-2">
                      <span className="print:hidden">
                        <input type="text" placeholder="Filter Case..." value={filterCaseType} onChange={(e) => setFilterCaseType(e.target.value)} className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white" />
                      </span>
                      <span className="hidden print:inline">Case Type</span>
                    </th>
                    <th className="p-2">
                      <span className="print:hidden">
                        <input type="text" placeholder="Filter Mode..." value={filterPaymentMode} onChange={(e) => setFilterPaymentMode(e.target.value)} className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white" />
                      </span>
                      <span className="hidden print:inline">Payment Mode</span>
                    </th>
                    <th className="p-2 text-right w-32">
                      <span className="print:hidden">
                        <input type="text" placeholder="Filter Credit..." value={filterCredit} onChange={(e) => setFilterCredit(e.target.value)} className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white text-right" />
                      </span>
                      <span className="hidden print:inline">Credit (+)</span>
                    </th>
                    <th className="p-3 text-right w-28">Debit (-)</th>
                    <th className="p-3 text-right w-36">Current Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[10pt]">
                  {filteredTransactions.map((tx, index) => (
                    <tr key={tx.id || index} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-500">{index + 1}</td>
                      <td className="p-3 font-mono text-xs text-blue-600 font-bold">{tx.ref_no || 'N/A'}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td className="p-3 font-medium text-slate-900 uppercase">{tx.customer_name || 'N/A'}</td>
                      <td className="p-3 text-slate-700 uppercase">{tx.case_type || 'N/A'}</td>
                      <td className="p-3 font-semibold text-slate-800">{tx.payment_mode || 'N/A'}</td>
                      <td className="p-3 text-right font-black text-blue-600">{tx.type === 'CREDIT' ? `₹ ${tx.amount}` : '-'}</td>
                      <td className="p-3 text-right font-black text-rose-600">{tx.type === 'DEBIT' ? `₹ ${tx.amount}` : '-'}</td>
                      <td className={`p-3 text-right font-bold ${tx.balance_after < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {tx.balance_after < 0 ? `- ₹ ${Math.abs(tx.balance_after).toFixed(2)}` : `₹ ${tx.balance_after?.toFixed(2)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => { setShowOtpModal(false); setOtpStep(1); setEnteredOtp(''); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
            <h3 className="text-lg font-black text-slate-900 uppercase mb-1">Security Verification</h3>
            <p className="text-xs text-slate-500 mb-4">Secure verification via email OTP to process refund request.</p>

            {otpError && <div className="bg-red-100 text-red-700 text-xs p-2.5 rounded mb-3 font-semibold uppercase">{otpError}</div>}

            {otpStep === 1 ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-700">An OTP will be sent to your registered email: <b className="text-blue-900">{profile?.email}</b></p>
                <button onClick={handleSendOtp} disabled={otpLoading} className="w-full bg-blue-900 hover:bg-blue-800 text-white py-2.5 rounded font-bold transition uppercase text-sm">
                  {otpLoading ? 'SENDING OTP...' : 'SEND OTP'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-2 rounded text-center font-bold">OTP SENT SUCCESSFULLY TO EMAIL</div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="ENTER 6-DIGIT OTP"
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full border-2 p-2 rounded text-center tracking-widest font-black text-xl text-slate-800"
                />
                <button type="submit" disabled={otpLoading} className="w-full bg-green-700 hover:bg-green-600 text-white py-2.5 rounded font-bold transition uppercase text-sm">
                  {otpLoading ? 'VERIFYING...' : 'VERIFY & PROCEED'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <WithdrawalModal isOpen={showRefundModal} onClose={() => setShowRefundModal(false)} profile={targetProfile || profile} onSuccess={fetchLedgerData} supabaseClient={supabaseClient} />
      <AdminApprovalModal selectedRequest={selectedRequest} onClose={() => setSelectedRequest(null)} onSuccess={fetchLedgerData} supabaseClient={supabaseClient} profile={profile} />

    </div>
  );
}