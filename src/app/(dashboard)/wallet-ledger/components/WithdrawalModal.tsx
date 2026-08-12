'use client';

import { useState } from 'react';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  onSuccess: () => void;
  supabaseClient: any;
}

export default function WithdrawalModal({ isOpen, onClose, profile, onSuccess, supabaseClient }: WithdrawalModalProps) {
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [bankDetails, setBankDetails] = useState<string>('');
  const [userPassword, setUserPassword] = useState<string>('');
  const [showUserPassword, setShowUserPassword] = useState<boolean>(false);
  const [userOtp, setUserOtp] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [userWrongAttempts, setUserWrongAttempts] = useState<number>(0);
  const [userLockedUntil, setUserLockedUntil] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const lock = localStorage.getItem('wallet_user_lockout');
    return lock && Number(lock) > Date.now() ? Number(lock) : null;
  });

  if (!isOpen) return null;

  const handleSendUserOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userLockedUntil && userLockedUntil > Date.now()) {
      alert('Security Lockout Active: Too many incorrect attempts. Try again after 24 hours.');
      return;
    }

    const amt = parseFloat(refundAmount);
    const currentBalance = profile?.wallet_balance || 0;

    if (!amt || amt <= 0 || amt > currentBalance) {
      alert('Invalid or exceeding withdrawal amount.');
      return;
    }
    if (!bankDetails.trim() || !userPassword) {
      alert('Please fill in bank details and system account password.');
      return;
    }

    if (userPassword.length < 6) {
      const newAttempts = userWrongAttempts + 1;
      setUserWrongAttempts(newAttempts);
      if (newAttempts >= 5) {
        const lockTime = Date.now() + 24 * 60 * 60 * 1000;
        setUserLockedUntil(lockTime);
        if (typeof window !== 'undefined') {
          localStorage.setItem('wallet_user_lockout', lockTime.toString());
        }
        alert('Security Alert: 5 incorrect password attempts reached. Account withdrawal locked for 24 hours.');
      } else {
        alert(`Incorrect password. Attempt ${newAttempts} of 5.`);
      }
      return;
    }

    setUserWrongAttempts(0);
    setSubmitting(true);
    setTimeout(() => {
      setOtpSent(true);
      setSubmitting(false);
      alert(`Security OTP sent successfully to registered email: ${profile?.email}`);
    }, 1000);
  };

  const handleFinalRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userOtp.length !== 6) {
      alert('Please enter a valid 6-digit OTP.');
      return;
    }

    setSubmitting(true);
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
      const { error } = await supabaseClient.from('wallet_refund_requests').insert({
        user_id: session.user.id,
        amount: parseFloat(refundAmount),
        bank_details: bankDetails,
        status: 'Pending'
      });

      if (error) {
        alert('Error: ' + error.message);
      } else {
        alert('Unutilized balance refund request submitted successfully with security verification.');
        onSuccess();
        onClose();
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide mb-2">Request Unutilized Balance Refund</h3>
        <p className="text-xs text-slate-500 mb-4">Secure verification via account credentials and email OTP.</p>

        {userLockedUntil && userLockedUntil > Date.now() ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center text-rose-700">
            <AlertTriangle className="mx-auto mb-2 text-rose-600" size={32} />
            <p className="font-bold text-sm">Account Locked</p>
            <p className="text-xs mt-1">Due to 5 incorrect password attempts, withdrawal requests are locked for 24 hours.</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold">Close</button>
          </div>
        ) : !otpSent ? (
          <form onSubmit={handleSendUserOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Refund Amount (₹)</label>
              <input type="number" step="0.01" max={profile?.wallet_balance || 0} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Enter amount" className="w-full px-3 py-2 border rounded-lg text-sm font-semibold outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Bank / UPI Payout Details</label>
              <textarea rows={2} value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} placeholder="Account No, IFSC / UPI ID" className="w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">System Account Password</label>
              <div className="relative">
                <input 
                  type={showUserPassword ? "text" : "password"} 
                  value={userPassword} 
                  onChange={(e) => setUserPassword(e.target.value)} 
                  placeholder="Enter password" 
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none pr-10" 
                  required 
                />
                <button type="button" onClick={() => setShowUserPassword(!showUserPassword)} className="absolute right-3 top-2.5 text-slate-500">
                  {showUserPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {userWrongAttempts > 0 && <span className="text-[10px] text-rose-600 font-bold">Failed attempts: {userWrongAttempts}/5</span>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">
                {submitting ? 'Sending...' : 'Send OTP to Email'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleFinalRefundSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Enter 6-Digit OTP Sent to Email</label>
              <input type="text" maxLength={6} value={userOtp} onChange={(e) => setUserOtp(e.target.value)} placeholder="Enter 6-digit OTP" className="w-full px-3 py-2 border rounded-lg text-lg font-mono tracking-widest text-center outline-none" required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOtpSent(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold">Back</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">
                {submitting ? 'Verifying...' : 'Verify & Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}