'use client';

import { useState, useEffect } from 'react';

interface AdminApprovalModalProps {
  selectedRequest: any;
  onClose: () => void;
  onSuccess: () => void;
  supabaseClient: any;
  profile: any;
}

export default function AdminApprovalModal({
  selectedRequest,
  onClose,
  onSuccess,
  supabaseClient,
  profile,
}: AdminApprovalModalProps) {
  const [utrNo, setUtrNo] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRejectMode, setIsRejectMode] = useState(false);

  const [adminWrongAttempts, setAdminWrongAttempts] = useState<number>(0);
  const [adminLockedUntil, setAdminLockedUntil] = useState<number | null>(null);

  useEffect(() => {
    if (selectedRequest?.utr_no) {
      setUtrNo(selectedRequest.utr_no);
    }
    const lock = localStorage.getItem('wallet_admin_lockout');
    if (lock && Number(lock) > Date.now()) {
      setAdminLockedUntil(Number(lock));
    }
  }, [selectedRequest]);

  if (!selectedRequest) return null;

  const verifyPin = async (): Promise<boolean> => {
    if (adminLockedUntil && adminLockedUntil > Date.now()) {
      const remainingSecs = Math.ceil((adminLockedUntil - Date.now()) / 1000);
      alert(`Too many incorrect PIN attempts. Locked for ${remainingSecs} seconds.`);
      return false;
    }

    const { data: isPinValid, error: rpcErr } = await supabaseClient.rpc('verify_admin_pin', {
      p_admin_id: profile?.id,
      p_entered_pin: pin,
    });

    if (rpcErr || !isPinValid) {
      const newAttempts = adminWrongAttempts + 1;
      setAdminWrongAttempts(newAttempts);

      if (newAttempts >= 3) {
        const lockTime = Date.now() + 60 * 1000;
        setAdminLockedUntil(lockTime);
        localStorage.setItem('wallet_admin_lockout', lockTime.toString());
        alert('Incorrect PIN entered 3 times. Locked for 1 minute.');
      } else {
        alert(`Incorrect Admin PIN. Attempt ${newAttempts} of 3.`);
      }
      return false;
    }

    return true;
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const pinOk = await verifyPin();
      if (!pinOk) {
        setLoading(false);
        return;
      }

      // 1. Update wallet_recharges status to APPROVED
      const { error: updateErr } = await supabaseClient
        .from('wallet_recharges')
        .update({
          status: 'APPROVED',
          utr_no: utrNo || selectedRequest.utr_no,
        })
        .eq('id', selectedRequest.id);

      if (updateErr) throw updateErr;

      // 2. Fetch current wallet balance of target user
      const { data: targetUser } = await supabaseClient
        .from('profiles')
        .select('wallet_balance')
        .eq('id', selectedRequest.user_id)
        .maybeSingle();

      const currentBalance = Number(targetUser?.wallet_balance || 0);
      const newBalance = currentBalance + Number(selectedRequest.amount);

      // 3. Update user profile wallet balance (+ CREDIT)
      const { error: profileErr } = await supabaseClient
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', selectedRequest.user_id);

      if (profileErr) throw profileErr;

      // 4. Insert CREDIT transaction into wallet_transactions (Passbook/Ledger table me dikhne ke liye)
      const { error: txErr } = await supabaseClient.from('wallet_transactions').insert({
        user_id: selectedRequest.user_id,
        amount: Number(selectedRequest.amount),
        type: 'CREDIT',
        ref_no: utrNo || selectedRequest.utr_no || `RCG-${selectedRequest.id.slice(0, 6)}`,
        customer_name: selectedRequest.user_name || 'Wallet Recharge Approved',
        case_type: 'Wallet Recharge',
        payment_mode: 'Online Gateway',
        balance_after: newBalance,
      });

      if (txErr) throw txErr;

      alert('Recharge request approved successfully and credited to wallet!');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Error processing approval: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const pinOk = await verifyPin();
      if (!pinOk) {
        setLoading(false);
        return;
      }

      // Update status to REJECTED in wallet_recharges table
      const { error } = await supabaseClient
        .from('wallet_recharges')
        .update({
          status: 'REJECTED',
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      alert('Recharge request rejected successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Error rejecting recharge: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="font-bold text-slate-800 text-base uppercase">
            {isRejectMode ? 'Reject Recharge Request' : 'Approve Recharge Request'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg"
          >
            &times;
          </button>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs">
          <p>
            <span className="font-bold text-slate-500">User Name:</span>{' '}
            <span className="font-semibold text-slate-800">{selectedRequest.user_name || 'N/A'}</span>
          </p>
          <p>
            <span className="font-bold text-slate-500">Email:</span>{' '}
            <span className="font-semibold text-slate-800">{selectedRequest.user_email || 'N/A'}</span>
          </p>
          <p>
            <span className="font-bold text-slate-500">Amount:</span>{' '}
            <span className="font-black text-emerald-600 text-sm">₹ {selectedRequest.amount}</span>
          </p>
          <p>
            <span className="font-bold text-slate-500">UTR No:</span>{' '}
            <span className="font-medium text-slate-800">{selectedRequest.utr_no}</span>
          </p>
        </div>

        <form onSubmit={isRejectMode ? handleReject : handleApprove} className="space-y-4 text-xs">
          {!isRejectMode && (
            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase">
                Confirm / Edit UTR No
              </label>
              <input
                type="text"
                placeholder="Enter UTR reference"
                value={utrNo}
                onChange={(e) => setUtrNo(e.target.value)}
                className="w-full border rounded-xl p-2.5 font-bold text-sm outline-none focus:border-blue-600"
                required
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase">
              Admin Security PIN
            </label>
            <input
              type="password"
              placeholder="Enter Security PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full border rounded-xl p-2.5 font-bold text-sm outline-none focus:border-blue-600"
              required
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setIsRejectMode(!isRejectMode)}
              className={`w-1/2 font-bold py-2.5 rounded-xl uppercase border ${
                isRejectMode ? 'border-blue-600 text-blue-600' : 'border-rose-600 text-rose-600'
              }`}
            >
              {isRejectMode ? 'Switch to Approve' : 'Reject Recharge'}
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`w-1/2 text-white font-extrabold py-2.5 rounded-xl uppercase shadow disabled:opacity-50 ${
                isRejectMode ? 'bg-rose-600' : 'bg-emerald-600'
              }`}
            >
              {loading ? 'Processing...' : isRejectMode ? 'Confirm Reject' : 'Approve & Credit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}