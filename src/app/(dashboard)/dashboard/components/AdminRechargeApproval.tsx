'use client';

import React, { useState } from 'react';
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

  // Modal states
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [adminRemark, setAdminRemark] = useState<string>('');
  const [isSendBackModalOpen, setIsSendBackModalOpen] = useState<boolean>(false);

  // Reject Modal states
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectReasonType, setRejectReasonType] = useState<string>('Wrong UTR Mentioned');
  const [customRejectReason, setCustomRejectReason] = useState<string>('');

  if (!isAdmin || pendingRequests.length === 0) {
    return null;
  }

  const handleAdminApproveRecharge = async (reqId: string, targetUserId: string, reqAmount: number) => {
    try {
      const { error: updateErr } = await supabase
        .from('wallet_recharges')
        .update({ status: 'APPROVED', admin_remark: null })
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

  const handleAdminRejectRecharge = async (reqId: string, finalReason: string) => {
    try {
      const { error } = await supabase
        .from('wallet_recharges')
        .update({ status: 'REJECTED', admin_remark: finalReason })
        .eq('id', reqId);

      if (error) throw error;

      alert('Recharge request successfully rejected!');
      setIsRejectModalOpen(false);
      setSelectedReq(null);
      setCustomRejectReason('');
      onRefresh();
    } catch (err: any) {
      alert('Rejection failed: ' + (err.message || err));
    }
  };

  const handleAdminSendBack = async (reqId: string, remark: string) => {
    try {
      const { error } = await supabase
        .from('wallet_recharges')
        .update({ status: 'SENT_BACK', admin_remark: remark })
        .eq('id', reqId);

      if (error) throw error;

      alert('Recharge request sent back to user for correction!');
      setIsSendBackModalOpen(false);
      setSelectedReq(null);
      setAdminRemark('');
      onRefresh();
    } catch (err: any) {
      alert('Operation failed: ' + (err.message || err));
    }
  };

  const openSendBackModal = (req: any) => {
    setSelectedReq(req);
    setAdminRemark('');
    setIsSendBackModalOpen(true);
  };

  const openRejectModal = (req: any) => {
    setSelectedReq(req);
    setRejectReasonType('Wrong UTR Mentioned');
    setCustomRejectReason('');
    setIsRejectModalOpen(true);
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

            <div className="flex gap-2 w-full sm:w-auto justify-end flex-wrap">
              <button
                type="button"
                onClick={() => handleAdminApproveRecharge(req.id, req.user_id, req.amount)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs shadow uppercase transition cursor-pointer"
              >
                Approve
              </button>

              <button
                type="button"
                onClick={() => openSendBackModal(req)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs shadow uppercase transition cursor-pointer"
              >
                Send Back
              </button>

              <button
                type="button"
                onClick={() => openRejectModal(req)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs shadow uppercase transition cursor-pointer"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* REJECT MODAL WITH DROPDOWN & CUSTOM REASON */}
      {isRejectModalOpen && selectedReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span>❌</span> Reject Recharge Request
            </h2>
            
            <p className="text-xs text-slate-600">
              User: <strong className="text-slate-800">{selectedReq.user_name || selectedReq.user_email}</strong> (Amount: ₹{selectedReq.amount})<br />
              UTR: <span className="font-mono">{selectedReq.utr_no}</span>
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Select Rejection Reason <span className="text-red-500">*</span>
              </label>
              <select
                value={rejectReasonType}
                onChange={(e) => setRejectReasonType(e.target.value)}
                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-rose-500 text-xs font-medium text-slate-800 bg-white outline-none"
              >
                <option value="Wrong UTR Mentioned">Wrong UTR Mentioned</option>
                <option value="Paid Amount Mismatch / Wrong Amount">Paid Amount Mismatch / Wrong Amount</option>
                <option value="Same UTR Used Multiple Times">Same UTR Used Multiple Times</option>
                <option value="Payment Screenshot Not Received / Invalid">Payment Screenshot Not Received / Invalid</option>
                <option value="Payment Not Received in Bank Account">Payment Not Received in Bank Account</option>
                <option value="Other">Other (Type custom reason below)</option>
              </select>
            </div>

            {/* Custom Textarea if 'Other' is selected or to add extra clarification */}
            {rejectReasonType === 'Other' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Type Custom Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={customRejectReason}
                  onChange={(e) => setCustomRejectReason(e.target.value)}
                  placeholder="Type specific reason for rejection..."
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-rose-500 text-xs text-slate-800 outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalReason = rejectReasonType === 'Other' ? customRejectReason.trim() : rejectReasonType;
                  if (rejectReasonType === 'Other' && !finalReason) {
                    alert('Please type the custom rejection reason.');
                    return;
                  }
                  handleAdminRejectRecharge(selectedReq.id, finalReason);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND BACK REMARK MODAL */}
      {isSendBackModalOpen && selectedReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span>↩️</span> Send Back Request for Correction
            </h2>
            
            <p className="text-xs text-slate-600">
              User: <strong className="text-slate-800">{selectedReq.user_name || selectedReq.user_email}</strong> (Amount: ₹{selectedReq.amount})<br />
              UTR: <span className="font-mono">{selectedReq.utr_no}</span>
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Reason / Correction Note for User <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={adminRemark}
                onChange={(e) => setAdminRemark(e.target.value)}
                placeholder="e.g., Please re-verify UTR number, 12 digits are incorrect or screenshot was unclear."
                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 text-xs text-slate-800 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSendBackModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!adminRemark.trim()) {
                    alert('Please enter a remark explaining why it is being sent back.');
                    return;
                  }
                  handleAdminSendBack(selectedReq.id, adminRemark.trim());
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow"
              >
                Confirm Send Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}