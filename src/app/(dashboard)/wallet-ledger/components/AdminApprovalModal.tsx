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
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState('');
  
  const [adminWrongAttempts, setAdminWrongAttempts] = useState<number>(0);
  const [adminLockedUntil, setAdminLockedUntil] = useState<number | null>(null);

  // Safe localStorage initialization for Next.js SSR
  useEffect(() => {
    const lock = localStorage.getItem('wallet_admin_lockout');
    if (lock && Number(lock) > Date.now()) {
      setAdminLockedUntil(Number(lock));
    }
  }, []);

  if (!selectedRequest) return null;

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check lockout
    if (adminLockedUntil && adminLockedUntil > Date.now()) {
      const remainingSecs = Math.ceil((adminLockedUntil - Date.now()) / 1000);
      alert(`Too many incorrect PIN attempts. Locked for ${remainingSecs} seconds.`);
      return;
    }

    // PIN Verification (Example Admin PIN: '1234' or your custom check)
    if (pin !== '1234') {
      const newAttempts = adminWrongAttempts + 1;
      setAdminWrongAttempts(newAttempts);
      if (newAttempts >= 3) {
        const lockTime = Date.now() + 60 * 1000; // Lock for 1 minute
        setAdminLockedUntil(lockTime);
        localStorage.setItem('wallet_admin_lockout', lockTime.toString());
        alert('Incorrect PIN entered 3 times. Locked for 1 minute.');
      } else {
        alert(`Incorrect Admin PIN. Attempt ${newAttempts} of 3.`);
      }
      return;
    }

    setLoading(true);
    try {
      // 1. Update refund request status
      const { error: updateErr } = await supabaseClient
        .from('wallet_refund_requests')
        .update({
          status: 'APPROVED',
          utr_no: utrNo || 'ONLINE-TRANSFER'
        })
        .eq('id', selectedRequest.id);

      if (updateErr) throw updateErr;

      // 2. Deduct amount from user's wallet balance
      const { data: targetUser } = await supabaseClient
        .from('profiles')
        .select('wallet_balance')
        .eq('id', selectedRequest.user_id)
        .maybeSingle();

      const currentBalance = Number(targetUser?.wallet_balance || 0);
      const newBalance = Math.max(0, currentBalance - Number(selectedRequest.amount));

      await supabaseClient
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', selectedRequest.user_id);

      // 3. Add DEBIT transaction entry to passbook
      await supabaseClient.from('wallet_transactions').insert({
        user_id: selectedRequest.user_id,
        amount: Number(selectedRequest.amount),
        type: 'DEBIT',
        ref_no: `REFUND-${selectedRequest.id.slice(0, 6)}`,
        customer_name: 'Balance Refund Processed',
        case_type: 'Wallet Refund',
        payment_mode: `UTR: ${utrNo || 'N/A'}`,
        balance_after: newBalance
      });

      alert('Refund request approved successfully and wallet updated.');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Error processing approval: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="font-bold text-slate-800 text-base uppercase">Approve Refund Request</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>

        <form onSubmit={handleApprove} className="space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <p><span className="font-bold text-slate-500">Amount:</span> <span className="font-black text-emerald-600 text-sm">₹ {selectedRequest.amount}</span></p>
            <p><span className="font-bold text-slate-500">Bank Details:</span> <span className="font-medium text-slate-800">{selectedRequest.bank_details}</span></p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase">Enter UTR / Transaction No</label>
            <input 
              type="text"
              placeholder="Enter bank UTR reference"
              value={utrNo}
              onChange={(e) => setUtrNo(e.target.value)}
              className="w-full border rounded-xl p-2.5 font-bold text-sm outline-none focus:border-blue-600"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase">Admin Security PIN</label>
            <input 
              type="password"
              placeholder="Enter 4-digit PIN (default: 1234)"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full border rounded-xl p-2.5 font-bold text-sm outline-none focus:border-blue-600"
              required
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button type="button" onClick={onClose} className="w-1/2 bg-gray-200 text-slate-700 font-bold py-2.5 rounded-xl uppercase">Cancel</button>
            <button type="submit" disabled={loading} className="w-1/2 bg-blue-600 text-white font-extrabold py-2.5 rounded-xl uppercase shadow">
              {loading ? 'Processing...' : 'Approve & Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}