'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import emailjs from '@emailjs/browser';

export default function AdminRefundRequestsWidget({ refundRequests, onUpdate }: { refundRequests: any[], onUpdate: () => void }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Modal & Security States
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'REVERT' | null>(null);
  const [step, setStep] = useState<'DETAILS' | 'OTP'>('DETAILS');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [utrNo, setUtrNo] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpExpiryTime, setOtpExpiryTime] = useState<number | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(300);

  // 🆕 User Profile Modal States (uses new DB columns)
  const [selectedUserReq, setSelectedUserReq] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const pendingCount = refundRequests.filter(r => (r.status || '').toUpperCase() === 'PENDING').length;

  // 🆕 Auto-sync modal data when refundRequests prop updates
  useEffect(() => {
    if (isProfileModalOpen && selectedUserReq && refundRequests.length > 0) {
      const latestReq = refundRequests.find((r: any) => r.id === selectedUserReq.id);
      if (latestReq) setSelectedUserReq(latestReq);
    }
  }, [refundRequests, isProfileModalOpen]);

  useEffect(() => {
    let interval: any;
    if (step === 'OTP' && otpExpiryTime) {
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((otpExpiryTime - Date.now()) / 1000));
        setTimerSeconds(remaining);
        if (remaining <= 0) clearInterval(interval);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, otpExpiryTime]);

  const checkLockoutStatus = () => {
    const lockoutTime = localStorage.getItem('admin_lockout_until');
    if (lockoutTime) {
      const remainingTime = new Date(lockoutTime).getTime() - Date.now();
      if (remainingTime > 0) return Math.ceil(remainingTime / (1000 * 60 * 60));
      else {
        localStorage.removeItem('admin_lockout_until');
        localStorage.setItem('admin_wrong_attempts', '0');
      }
    }
    return 0;
  };

  const handleInitiateAction = (req: any, type: 'APPROVE' | 'REJECT' | 'REVERT') => {
    const lockedHours = checkLockoutStatus();
    if (lockedHours > 0) {
      alert(`⚠️ Security Lockout Active! Please try again after ${lockedHours} hours.`);
      return;
    }
    setSelectedReq(req);
    setActionType(type);
    setStep('DETAILS');
    setAdminPassword('');
    setShowPassword(false);
    setEnteredOtp('');
    setUtrNo(req.utr_no || ''); // 🆕 Pre-fill UTR if exists
  };

  // 🆕 Open Profile Modal (uses DB columns directly)
  const handleOpenProfile = (req: any) => {
    setSelectedUserReq(req);
    setIsProfileModalOpen(true);
  };

  /* ============================================================
     🆕 WHATSAPP CONFIRMATION FUNCTION
     - Uses DB columns: user_name, user_mobile, user_code, etc.
     - Tracks whatsapp_sent_at + whatsapp_sent_count in DB
     ============================================================ */
  const handleWhatsAppConfirm = async () => {
    if (!selectedUserReq) {
      alert('Refund request data not available.');
      return;
    }

    const rawMobile = selectedUserReq.user_mobile || '';
    const digitsOnly = rawMobile.replace(/[^0-9]/g, '');

    if (!digitsOnly || digitsOnly.length < 10) {
      alert(`⚠️ User's mobile number is missing or invalid.\n\nMobile on record: "${rawMobile || 'N/A'}"\n\nPlease verify from the user profile before contacting.`);
      return;
    }

    // Auto-prepend India country code if 10-digit number
    const whatsappNumber = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

    const userName = selectedUserReq.user_name || 'User';
    const refundAmount = Number(selectedUserReq.amount || 0).toLocaleString('en-IN');
    const bankDetails = selectedUserReq.bank_details || 'N/A';
    const currentBalance = Number(selectedUserReq.wallet_balance_at_request || 0).toLocaleString('en-IN');
    const userCode = selectedUserReq.user_code || 'N/A';
    const requestStatus = (selectedUserReq.status || 'PENDING').toUpperCase();
    const requestId = selectedUserReq.id || '';

    const message =
`🏦 *Legal n Tech — Refund Confirmation Request*

Dear *${userName}*,

We have received your Unutilized Balance Refund Request. Before we process it, please confirm the following details are correct:

━━━━━━━━━━━━━━━━━━
📋 *Refund Request Details*
━━━━━━━━━━━━━━━━━━
• *User Code:* ${userCode}
• *Requested Amount:* ₹ ${refundAmount}
• *Current Wallet Balance:* ₹ ${currentBalance}
• *Request Status:* ${requestStatus}
• *Bank Details on File:* ${bankDetails}
• *Request ID:* ${requestId ? requestId.slice(0, 8) + '...' : 'N/A'}

━━━━━━━━━━━━━━━━━━
✍️ *Please confirm by replying:*
━━━━━━━━━━━━━━━━━━
✅ *"CONFIRM"* — All details are correct, please process the refund.

❌ *"UPDATE"* — Bank details need to be changed. (Please share correct details)

❓ *"HOLD"* — I want to keep the balance, do NOT process refund.

━━━━━━━━━━━━━━━━━━
⏱️ Kindly reply within 24 hours. Without your confirmation, we cannot proceed with the refund.

Thank you,
*Legal n Tech Consultant Services*
_DRC Software Engine — Refund Verification_`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');

    // 🆕 Save WhatsApp tracking in DATABASE
    try {
      const currentCount = Number(selectedUserReq?.whatsapp_sent_count || 0);
      const now = new Date().toISOString();

      await supabase
        .from('wallet_refund_requests')
        .update({
          whatsapp_sent_at: now,
          whatsapp_sent_count: currentCount + 1,
        })
        .eq('id', selectedUserReq.id);

      // Update local state
      setSelectedUserReq((prev: any) => ({
        ...prev,
        whatsapp_sent_at: now,
        whatsapp_sent_count: currentCount + 1,
      }));

      console.log('✅ WhatsApp tracking saved in DB');
    } catch (e) {
      console.warn('WhatsApp tracking failed:', e);
    }
  };

  const sendEmailViaEmailJS = async (recipientEmail: string, otpCode: string, isWarning: boolean = false) => {
    try {
      const templateParams = {
        to_email: recipientEmail,
        otp_code: otpCode,
        message: isWarning
          ? `SECURITY ALERT: Multiple incorrect admin password attempts detected for Legal n Tech Admin Portal. Warning sent to jasvantf@gmail.com & ${recipientEmail}.`
          : `Your Admin Verification OTP for Refund Action is: ${otpCode}. Valid for 5 minutes.`
      };
      await emailjs.send('service_g8hpevj', 'template_4sqme4r', templateParams, 'grxZ-VWExc0FNxr5n');
    } catch (err) {
      console.error('EmailJS dispatch failed:', err);
    }
  };

  const handleVerifyPasswordAndSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const lockedHours = checkLockoutStatus();
    if (lockedHours > 0) {
      alert(`⚠️ Account locked. Try again later.`);
      return;
    }
    if (!adminPassword) {
      alert('Please enter your Admin Password.');
      return;
    }

    setLoadingId(selectedReq.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) throw new Error('Admin session not found.');

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });

      if (authError) {
        let currentAttempts = Number(localStorage.getItem('admin_wrong_attempts') || '0') + 1;
        localStorage.setItem('admin_wrong_attempts', currentAttempts.toString());
        await sendEmailViaEmailJS(user.email, '', true);
        await sendEmailViaEmailJS('jasvantf@gmail.com', '', true);

        if (currentAttempts >= 5) {
          const lockoutExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          localStorage.setItem('admin_lockout_until', lockoutExpiry);
          alert(`🚨 CRITICAL: 5 incorrect attempts! Account locked for 24 hours.`);
          setSelectedReq(null);
          setLoadingId(null);
          return;
        }
        alert(`❌ Incorrect Admin Password! (${currentAttempts}/5 attempts).`);
        setLoadingId(null);
        return;
      }

      localStorage.setItem('admin_wrong_attempts', '0');
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(mockOtp);
      setOtpExpiryTime(Date.now() + 5 * 60 * 1000);
      setTimerSeconds(300);

      await sendEmailViaEmailJS(user.email, mockOtp, false);
      await sendEmailViaEmailJS('jasvantf@gmail.com', mockOtp, false);

      alert(`🔒 Security OTP sent successfully (Valid for 5 mins).`);
      setStep('OTP');
    } catch (err: any) {
      alert('Error: ' + (err.message || err));
    } finally {
      setLoadingId(null);
    }
  };

  const handleResendOtp = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) return;
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(newOtp);
      setOtpExpiryTime(Date.now() + 5 * 60 * 1000);
      setTimerSeconds(300);
      await sendEmailViaEmailJS(user.email, newOtp, false);
      await sendEmailViaEmailJS('jasvantf@gmail.com', newOtp, false);
      alert(`🔄 New Security OTP re-sent!`);
    } catch (err: any) {
      alert('Failed to resend OTP: ' + err.message);
    }
  };

  const handleFinalizeAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpExpiryTime && Date.now() > otpExpiryTime) {
      alert('❌ OTP expired. Please click Resend OTP.');
      return;
    }
    if (enteredOtp !== generatedOtp) {
      alert('Invalid OTP entered!');
      return;
    }
    if (actionType === 'APPROVE' && !utrNo) {
      alert('Please enter UTR Number.');
      return;
    }

    setLoadingId(selectedReq.id);
    try {
      /* ============================================================
         🆕 Fetch admin info for audit trail
         ============================================================ */
      const { data: { user } } = await supabase.auth.getUser();
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('full_name, user_code')
        .eq('id', user?.id)
        .single();

      const adminName = adminProfile?.full_name || user?.email || 'Admin';
      const now = new Date().toISOString();

      let newStatus = 'PENDING';
      if (actionType === 'APPROVE') newStatus = 'APPROVED';
      if (actionType === 'REJECT') newStatus = 'REJECTED';
      if (actionType === 'REVERT') newStatus = 'PENDING';

      /* ============================================================
         🆕 Build update payload with NEW columns
         ============================================================ */
      const updatePayload: any = {
        status: newStatus,
        processed_by: adminName,
      };

      if (actionType === 'APPROVE') {
        updatePayload.utr_no = utrNo;
        updatePayload.approved_by = adminName;
        updatePayload.approved_at = now;
        updatePayload.transaction_ref = `REFUND-${Math.floor(100000 + Math.random() * 900000)}`;
        updatePayload.payment_mode = 'BANK_TRANSFER';
      } else if (actionType === 'REJECT') {
        updatePayload.rejection_reason = 'Rejected by admin';
      } else if (actionType === 'REVERT') {
        updatePayload.utr_no = null;
        updatePayload.approved_by = null;
        updatePayload.approved_at = null;
        updatePayload.rejection_reason = null;
      }

      const { error } = await supabase
        .from('wallet_refund_requests')
        .update(updatePayload)
        .eq('id', selectedReq.id);

      if (error) throw error;

      /* ============================================================
         APPROVE: Deduct wallet + insert transaction
         ============================================================ */
      if (actionType === 'APPROVE') {
        const targetUserId = selectedReq.user_id;
        const refundAmt = Number(selectedReq.amount);

        const { data: profileData } = await supabase
          .from('profiles')
          .select('wallet_balance, full_name')
          .eq('id', targetUserId)
          .single();

        if (profileData) {
          const currentBal = Number(profileData.wallet_balance || 0);
          const updatedBal = Math.max(0, currentBal - refundAmt);
          await supabase
            .from('profiles')
            .update({ wallet_balance: updatedBal })
            .eq('id', targetUserId);
        }

        await supabase.from('wallet_transactions').insert([{
          user_id: targetUserId,
          ref_no: `REFUND-${Math.floor(100000 + Math.random() * 900000)}`,
          type: 'DEBIT',
          amount: refundAmt,
          description: `Unutilized Balance Refund Processed (UTR: ${utrNo})`,
          created_at: new Date().toISOString()
        }]);
      }

      alert(`Success! Refund marked as ${newStatus}.`);
      setSelectedReq(null);
      setIsProfileModalOpen(false);
      onUpdate();
    } catch (err: any) {
      alert('Failed: ' + (err.message || err));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 my-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="font-bold text-slate-800 text-sm sm:text-base">Unutilized Balance Refund Requests</h3>
          <p className="text-[11px] sm:text-xs text-slate-500">
            Review users&apos; wallet refund requests, approve with UTR, reject, or revert with Admin OTP security.
            <span className="text-blue-600 font-bold"> Click on user name to view full profile & WhatsApp confirmation.</span>
          </p>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-xl font-bold border border-amber-200">
            {pendingCount} Pending
          </span>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition border border-slate-200 shrink-0"
          >
            {isOpen ? 'Hide [-]' : 'Show [+]'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="overflow-x-auto pt-2 animate-in fade-in duration-200 -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-left text-sm min-w-[700px] sm:min-w-full">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3 rounded-l-xl">User</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Bank Details</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
                <th className="p-3 rounded-r-xl text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {refundRequests.length > 0 ? (
                refundRequests.map((req: any) => {
                  // 🆕 Use DB columns directly
                  const userName = req.user_name || 'Unknown User';
                  const userBalance = Number(req.wallet_balance_at_request || 0);
                  const refundAmount = Number(req.amount);
                  const isInsufficient = userBalance < refundAmount;
                  const statusUpper = (req.status || 'PENDING').toUpperCase();

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition text-xs">
                      <td className="p-3">
                        <button
                          onClick={() => handleOpenProfile(req)}
                          className="font-bold text-left block text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          title="Click to view full profile"
                        >
                          👤 {userName}
                        </button>
                        <div className="font-mono text-[9px] text-slate-400 mt-0.5 truncate max-w-[180px]">
                          {req.user_code || req.user_id}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-black text-emerald-600">
                          ₹ {refundAmount.toLocaleString('en-IN')}
                        </div>
                        <div className={`text-[9px] font-bold mt-0.5 ${isInsufficient ? 'text-rose-500' : 'text-slate-400'}`}>
                          Bal: ₹ {userBalance.toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td className="p-3 text-slate-700 max-w-[180px] truncate" title={req.bank_details}>
                        {req.bank_details}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                          statusUpper === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                          statusUpper === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {statusUpper}
                        </span>
                        {isInsufficient && statusUpper === 'PENDING' && (
                          <div className="text-[9px] text-rose-500 font-bold mt-1">⚠️ Low Balance</div>
                        )}
                      </td>
                      <td className="p-3 text-slate-500">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        {statusUpper !== 'APPROVED' && (
                          <button
                            onClick={() => handleInitiateAction(req, 'APPROVE')}
                            disabled={loadingId === req.id || isInsufficient}
                            title={isInsufficient ? `Insufficient Balance` : 'Approve Refund'}
                            className={`px-2 py-1.5 font-bold rounded-lg uppercase text-[10px] shadow-sm transition ${
                              isInsufficient
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            Approve
                          </button>
                        )}

                        {statusUpper !== 'REJECTED' && (
                          <button
                            onClick={() => handleInitiateAction(req, 'REJECT')}
                            disabled={loadingId === req.id}
                            className="px-2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg uppercase text-[10px] shadow-sm transition"
                          >
                            Reject
                          </button>
                        )}

                        {statusUpper === 'APPROVED' && (
                          <button
                            onClick={() => handleInitiateAction(req, 'REVERT')}
                            disabled={loadingId === req.id}
                            className="px-2 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg uppercase text-[10px] shadow-sm transition"
                          >
                            Revert Back
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 text-xs">No refund requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 🆕 USER PROFILE MODAL (uses DB columns) */}
      {isProfileModalOpen && selectedUserReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-black tracking-tight">👤 Refund Request Details</h3>
                <p className="text-[11px] text-blue-100 mt-0.5">Complete account overview & balance verification</p>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* User Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Full Name</p>
                  <p className="text-sm font-bold text-slate-800">
                    {selectedUserReq.user_name || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Email</p>
                  <p className="text-xs font-bold text-slate-800 truncate" title={selectedUserReq.user_email}>
                    {selectedUserReq.user_email || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Mobile</p>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedUserReq.user_mobile || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">User Code</p>
                  <p className="text-xs font-mono font-bold text-slate-800">
                    {selectedUserReq.user_code || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Payment Mode</p>
                  <p className="text-xs font-bold text-slate-800">
                    {selectedUserReq.payment_mode || 'BANK_TRANSFER'}
                  </p>
                </div>
                {selectedUserReq.transaction_ref && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Transaction Ref</p>
                    <p className="text-[10px] font-mono font-bold text-blue-700">
                      {selectedUserReq.transaction_ref}
                    </p>
                  </div>
                )}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">User ID (UUID)</p>
                  <p className="text-[10px] font-mono text-slate-600 break-all">
                    {selectedUserReq.user_id}
                  </p>
                </div>
              </div>

              {/* Balance Comparison Section */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <p className="text-[10px] text-emerald-600 uppercase font-bold">💰 Balance at Request</p>
                  <p className={`text-2xl font-black mt-1 ${
                    Number(selectedUserReq.wallet_balance_at_request || 0) < 0
                      ? 'text-rose-700'
                      : 'text-emerald-700'
                  }`}>
                    ₹ {Number(selectedUserReq.wallet_balance_at_request || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <p className="text-[10px] text-amber-600 uppercase font-bold">📤 Requested Refund</p>
                  <p className="text-2xl font-black text-amber-700 mt-1">
                    ₹ {Number(selectedUserReq.amount).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Balance Status Alert */}
              {Number(selectedUserReq.wallet_balance_at_request || 0) >= Number(selectedUserReq.amount) ? (
                <div className="bg-emerald-50 border-2 border-emerald-300 p-3 rounded-xl">
                  <p className="text-xs text-emerald-700 font-bold">
                    ✅ Sufficient Balance — User had enough balance when requested.
                  </p>
                </div>
              ) : (
                <div className="bg-rose-50 border-2 border-rose-300 p-3 rounded-xl animate-pulse">
                  <p className="text-xs text-rose-700 font-bold">
                    ⚠️ INSUFFICIENT BALANCE at request time!
                  </p>
                  <p className="text-[10px] text-rose-600 mt-1">
                    Shortfall: ₹ {(Number(selectedUserReq.amount) - Number(selectedUserReq.wallet_balance_at_request || 0)).toLocaleString('en-IN')}
                  </p>
                </div>
              )}

              {/* Bank Details */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-bold">🏦 Bank Details</p>
                <p className="text-xs font-bold text-slate-800 mt-1 break-words">
                  {selectedUserReq.bank_details || 'N/A'}
                </p>
              </div>

              {/* Request Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Request Status</p>
                  <p className={`text-xs font-black mt-1 ${
                    (selectedUserReq.status || '').toUpperCase() === 'APPROVED' ? 'text-emerald-600' :
                    (selectedUserReq.status || '').toUpperCase() === 'REJECTED' ? 'text-rose-600' :
                    'text-amber-600'
                  }`}>
                    {(selectedUserReq.status || 'PENDING').toUpperCase()}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Requested On</p>
                  <p className="text-xs font-bold text-slate-800 mt-1">
                    {new Date(selectedUserReq.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {selectedUserReq.utr_no && (
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <p className="text-[10px] text-blue-600 uppercase font-bold">UTR Number</p>
                  <p className="text-xs font-mono font-bold text-blue-700 mt-1">
                    {selectedUserReq.utr_no}
                  </p>
                </div>
              )}

              {/* 🆕 Audit Trail */}
              {(selectedUserReq.approved_by || selectedUserReq.processed_by) && (
                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 space-y-1.5">
                  <p className="text-[10px] text-indigo-600 uppercase font-bold">🔐 Audit Trail</p>
                  {selectedUserReq.approved_by && (
                    <p className="text-[11px] text-slate-700">
                      <span className="font-bold">Approved by:</span> {selectedUserReq.approved_by}
                    </p>
                  )}
                  {selectedUserReq.approved_at && (
                    <p className="text-[11px] text-slate-700">
                      <span className="font-bold">Approved on:</span>{' '}
                      {new Date(selectedUserReq.approved_at).toLocaleString('en-IN')}
                    </p>
                  )}
                  {selectedUserReq.processed_by && !selectedUserReq.approved_by && (
                    <p className="text-[11px] text-slate-700">
                      <span className="font-bold">Processed by:</span> {selectedUserReq.processed_by}
                    </p>
                  )}
                  {selectedUserReq.rejection_reason && (
                    <p className="text-[11px] text-rose-700">
                      <span className="font-bold">Rejection Reason:</span> {selectedUserReq.rejection_reason}
                    </p>
                  )}
                </div>
              )}

              {/* 🆕 WHATSAPP CONFIRMATION BUTTON */}
              <div className="bg-green-50 border-2 border-green-300 p-4 rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-2xl">📱</span>
                  <div className="flex-1">
                    <p className="text-xs font-black text-green-800 uppercase">
                      WhatsApp Confirmation Request
                    </p>
                    <p className="text-[10px] text-green-700 mt-0.5">
                      Send a pre-filled confirmation message to <b>{selectedUserReq.user_name || 'this user'}</b> at <b>{selectedUserReq.user_mobile || 'N/A'}</b> to verify the refund request before processing.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleWhatsAppConfirm}
                  disabled={!selectedUserReq.user_mobile}
                  className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wide shadow-sm transition flex items-center justify-center gap-2 ${
                    selectedUserReq.user_mobile
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                  title={
                    selectedUserReq.user_mobile
                      ? `Open WhatsApp chat with ${selectedUserReq.user_mobile}`
                      : 'Mobile number not available'
                  }
                >
                  <span>💬</span>
                  <span>Send WhatsApp Confirmation to User</span>
                </button>

                {/* 🆕 WhatsApp tracking badge from DATABASE */}
                {selectedUserReq.whatsapp_sent_at && (
                  <div className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-center font-bold">
                    ⚠️ WhatsApp sent {
                      Math.max(0, Math.floor((Date.now() - new Date(selectedUserReq.whatsapp_sent_at).getTime()) / 60000))
                    } min ago
                    {Number(selectedUserReq.whatsapp_sent_count || 0) > 1 &&
                      ` (${selectedUserReq.whatsapp_sent_count} times)`
                    }
                  </div>
                )}

                <p className="text-[9px] text-green-600 text-center italic">
                  Message will auto-fill with refund amount, bank details, and Yes/No options.
                </p>
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

      {/* SECURE ADMIN PASSWORD & OTP MODAL */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-black tracking-tight">Security Verification ({actionType})</h3>
                <p className="text-xs text-slate-300 mt-0.5">Admin authorization required.</p>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition text-xs"
              >
                ✕
              </button>
            </div>

            {step === 'DETAILS' ? (
              <form onSubmit={handleVerifyPasswordAndSendOtp} className="p-6 space-y-4">
                {actionType === 'APPROVE' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Enter UTR / Bank Transfer Ref No. *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UTR4893201928"
                      value={utrNo}
                      onChange={(e) => setUtrNo(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Confirm Admin Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter your admin login password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <p className="text-[10px] text-rose-500 mt-1">⚠️ 5 incorrect attempts will lock account for 24 hours.</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-[11px] text-amber-800 font-medium">
                  🔒 OTP will be sent to your admin email and jasvantf@gmail.com (Valid for 5 mins).
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReq(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingId === selectedReq.id}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    {loadingId === selectedReq.id ? 'Sending Email...' : 'Send OTP & Proceed'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleFinalizeAction} className="p-6 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-600 uppercase">Enter 6-Digit OTP *</label>
                    <span className={`text-xs font-bold ${timerSeconds < 60 ? 'text-rose-600 animate-pulse' : 'text-blue-600'}`}>
                      ⏳ {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, '0')}
                    </span>
                  </div>

                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black tracking-widest text-center text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <div className="flex justify-between items-center mt-2">
                    <p className="text-[10px] text-slate-400">Didn&apos;t receive email?</p>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      🔄 Resend OTP
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('DETAILS')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loadingId === selectedReq.id || timerSeconds <= 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:bg-slate-300"
                  >
                    {loadingId === selectedReq.id ? 'Processing...' : (timerSeconds <= 0 ? 'OTP Expired' : `Confirm & ${actionType}`)}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}