'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import emailjs from '@emailjs/browser';

export default function AdminRefundRequestsWidget({ refundRequests, onUpdate }: { refundRequests: any[], onUpdate: () => void }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false); // Default hidden state
  
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
  const [timerSeconds, setTimerSeconds] = useState(300); // 5 Minutes

  const pendingCount = refundRequests.filter(r => r.status === 'PENDING').length;

  useEffect(() => {
    let interval: any;
    if (step === 'OTP' && otpExpiryTime) {
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((otpExpiryTime - Date.now()) / 1000));
        setTimerSeconds(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, otpExpiryTime]);

  const checkLockoutStatus = () => {
    const lockoutTime = localStorage.getItem('admin_lockout_until');
    if (lockoutTime) {
      const remainingTime = new Date(lockoutTime).getTime() - Date.now();
      if (remainingTime > 0) {
        return Math.ceil(remainingTime / (1000 * 60 * 60));
      } else {
        localStorage.removeItem('admin_lockout_until');
        localStorage.setItem('admin_wrong_attempts', '0');
      }
    }
    return 0;
  };

  const handleInitiateAction = (req: any, type: 'APPROVE' | 'REJECT' | 'REVERT') => {
    const lockedHours = checkLockoutStatus();
    if (lockedHours > 0) {
      alert(`⚠️ Security Lockout Active! Too many incorrect password attempts. Please try again after ${lockedHours} hours.`);
      return;
    }

    setSelectedReq(req);
    setActionType(type);
    setStep('DETAILS');
    setAdminPassword('');
    setShowPassword(false);
    setEnteredOtp('');
    setUtrNo('');
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
      alert(`⚠️ Account locked due to multiple wrong password attempts. Try again later.`);
      return;
    }

    if (!adminPassword) {
      alert('Please enter your Admin Password.');
      return;
    }

    setLoadingId(selectedReq.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        throw new Error('Admin session not found. Please log in again.');
      }

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
          alert(`🚨 CRITICAL SECURITY ALERT:\n5 incorrect password attempts detected!\nWarning emails successfully dispatched to jasvantf@gmail.com and ${user.email}.\nYour account is now locked for 24 hours.`);
          setSelectedReq(null);
          setLoadingId(null);
          return;
        }

        alert(`❌ Incorrect Admin Password! (${currentAttempts}/5 attempts).\nWarning notification email sent to jasvantf@gmail.com & ${user.email}.`);
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

      alert(`🔒 Security OTP sent successfully to ${user.email} & jasvantf@gmail.com via EmailJS (Valid for 5 mins).`);
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

      alert(`🔄 New Security OTP re-sent successfully via EmailJS!`);
    } catch (err: any) {
      alert('Failed to resend OTP: ' + err.message);
    }
  };

  const handleFinalizeAction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otpExpiryTime && Date.now() > otpExpiryTime) {
      alert('❌ OTP has expired (Valid only for 5 minutes). Please click Resend OTP.');
      return;
    }

    if (enteredOtp !== generatedOtp) {
      alert('Invalid OTP entered! Please check and try again.');
      return;
    }

    if (actionType === 'APPROVE' && !utrNo) {
      alert('Please enter UTR / Bank Transfer Reference Number for approval.');
      return;
    }

    setLoadingId(selectedReq.id);
    try {
      let newStatus = 'PENDING';
      if (actionType === 'APPROVE') newStatus = 'APPROVED';
      if (actionType === 'REJECT') newStatus = 'REJECTED';
      if (actionType === 'REVERT') newStatus = 'PENDING';

      const { error } = await supabase
        .from('wallet_refund_requests')
        .update({ 
          status: newStatus, 
          utr_no: actionType === 'APPROVE' ? utrNo : (actionType === 'REVERT' ? null : selectedReq.utr_no) 
        })
        .eq('id', selectedReq.id);

      if (error) throw error;

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

      alert(`Success! Refund request has been successfully marked as ${newStatus} and updated in user ledger.`);
      setSelectedReq(null);
      onUpdate();
    } catch (err: any) {
      alert('Failed to process action: ' + (err.message || err));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 my-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800 text-base">Unutilized Balance Refund Requests</h3>
          <p className="text-xs text-slate-500">Review users&apos; wallet refund requests, approve with UTR, reject, or revert with Admin OTP security.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-xl font-bold border border-amber-200">
            {pendingCount} Pending
          </span>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition border border-slate-200"
          >
            {isOpen ? 'Hide [-]' : 'Show [+]'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="overflow-x-auto pt-2 animate-in fade-in duration-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3 rounded-l-xl">User ID</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Bank Details</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
                <th className="p-3 rounded-r-xl text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {refundRequests.length > 0 ? (
                refundRequests.map((req: any) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition text-xs">
                    <td className="p-3 font-mono text-blue-600">{req.user_id}</td>
                    <td className="p-3 font-black text-emerald-600">₹ {Number(req.amount).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-slate-700">{req.bank_details}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                        req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        req.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {req.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{new Date(req.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      {req.status !== 'APPROVED' && (
                        <button
                          onClick={() => handleInitiateAction(req, 'APPROVE')}
                          disabled={loadingId === req.id}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg uppercase text-[10px] shadow-sm transition"
                        >
                          Approve
                        </button>
                      )}

                      {req.status !== 'REJECTED' && (
                        <button
                          onClick={() => handleInitiateAction(req, 'REJECT')}
                          disabled={loadingId === req.id}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg uppercase text-[10px] shadow-sm transition"
                        >
                          Reject
                        </button>
                      )}

                      {req.status === 'APPROVED' && (
                        <button
                          onClick={() => handleInitiateAction(req, 'REVERT')}
                          disabled={loadingId === req.id}
                          className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg uppercase text-[10px] shadow-sm transition"
                        >
                          Revert Back
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 text-xs">No refund requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SECURE ADMIN PASSWORD & OTP MODAL */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-black tracking-tight">
                  Security Verification ({actionType})
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">Admin authorization required to modify refund status.</p>
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
                  <p className="text-[10px] text-rose-500 mt-1">⚠️ Note: 5 incorrect password attempts will lock the account for 24 hours & email warning to jasvantf@gmail.com & admin email.</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-[11px] text-amber-800 font-medium">
                  🔒 Clicking continue will send a real 6-digit verification OTP via EmailJS (Valid for 5 mins) to your admin email and jasvantf@gmail.com.
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
                      ⏳ Expires in: {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, '0')}
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
                      🔄 Resend OTP via EmailJS
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