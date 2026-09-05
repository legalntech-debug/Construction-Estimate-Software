'use client';

import { supabase } from '@/lib/supabase';

interface AdminRechargeApprovalProps {
  isAdmin: boolean;
  rechargeRequests: any[];
  onRefresh: () => void;
}

export default function AdminRechargeApproval({
  isAdmin,
  rechargeRequests,
  onRefresh
}: AdminRechargeApprovalProps) {
  const pendingRequests = rechargeRequests.filter(r => r.status === 'PENDING');

  if (!isAdmin || pendingRequests.length === 0) {
    return null;
  }

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
      onRefresh();
    } catch (err: any) {
      alert('Approval failed: ' + (err.message || err));
    }
  };

  const handleAdminRejectRecharge = async (reqId: string) => {
    try {
      const { error } = await supabase
        .from('wallet_recharges')
        .update({ status: 'REJECTED' })
        .eq('id', reqId);

      if (error) throw error;

      alert('Recharge request successfully rejected!');
      onRefresh();
    } catch (err: any) {
      alert('Rejection failed: ' + (err.message || err));
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
      <h2 className="text-xs sm:text-sm font-black text-amber-800 uppercase tracking-wide">
        Pending Wallet Recharge Requests (Admin Dashboard)
      </h2>
      <div className="space-y-2">
        {pendingRequests.map(req => (
          <div
            key={req.id}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-lg border border-amber-100 text-xs gap-3"
          >
            <div>
              <p className="font-bold text-slate-900">{req.user_name || req.user_email}</p>
              <p className="text-slate-500">
                Amount: <span className="font-black text-emerald-600">₹{req.amount}</span> | UTR / Ref:{' '}
                <span className="font-mono font-bold text-blue-600">{req.utr_no}</span>
              </p>
            </div>

            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => handleAdminApproveRecharge(req.id, req.user_id, req.amount)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs shadow uppercase transition cursor-pointer"
              >
                Approve
              </button>

              <button
                onClick={() => handleAdminRejectRecharge(req.id)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs shadow uppercase transition cursor-pointer"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}