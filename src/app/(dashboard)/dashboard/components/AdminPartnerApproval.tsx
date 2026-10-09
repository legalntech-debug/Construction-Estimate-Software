'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import RejectSendBackModal from '@/app/(dashboard)/partner-dashboard/components/RejectSendBackModal';

export default function AdminPartnerApproval({ isAdmin, isApprover, userData }: any) {
  const [pendingPartners, setPendingPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // ✅ NEW: Reject/Send Back modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);

  const MANAGEMENT_CONTACTS = {
    admin: "917987561396",
    coPartner: "918249169703",
    ceo: "918103804355"
  };

  const fetchPendingPartners = async () => {
    if (!isAdmin && !isApprover) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('partner_profiles')
      .select(`
        partner_id,
        user_id,
        approval_status,
        approved_by_level1,
        approved_by_admin,
        partner_joined_date,
        coverage_location,
        date_of_birth,
        aadhaar_no,
        pan_card_no,
        bank_account_no,
        ifsc_code,
        nominee_name,
        nominee_relation,
        nominee_phone,
        is_legacy_active,
        profiles:user_id (
          id,
          full_name,
          mobile,
          email,
          user_code,
          role,
          user_type,
          city,
          state,
          firm_name,
          plan_type,
          wallet_balance,
          referred_by,
          created_at
        )
      `)
      .or('approval_status.eq.PENDING,approval_status.is.null')
      .order('partner_joined_date', { ascending: false });

    if (error) {
      console.error('Partner fetch error:', error);
      setLoading(false);
      return;
    }

    const filtered = (data || []).filter((p: any) => {
      const role = (p.profiles?.role || '').toLowerCase();
      const userType = (p.profiles?.user_type || '').toLowerCase();
      const userCode = (p.profiles?.user_code || '').toLowerCase();
      return role !== 'admin' && userType !== 'admin' && userCode !== 'admin001';
    });

    setPendingPartners(filtered);
    setLoading(false);
  };

  useEffect(() => {
    fetchPendingPartners();

    const channel = supabase
      .channel('partner_approvals_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partner_profiles' },
        (payload) => {
          console.log('Partner profile changed:', payload);
          fetchPendingPartners();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, isApprover]);

  const handleApprove = async (partnerId: string, level: 'LEVEL1' | 'ADMIN') => {
    const approverName = userData?.name || 'Admin';
    const updatePayload: any = {};

    if (level === 'LEVEL1') {
      updatePayload.approved_by_level1 = approverName;
    } else if (level === 'ADMIN') {
      updatePayload.approved_by_admin = approverName;
      updatePayload.approval_status = 'APPROVED';
    }

    const { error } = await supabase
      .from('partner_profiles')
      .update(updatePayload)
      .eq('partner_id', partnerId);

    if (error) {
      alert('❌ Approval Error: ' + error.message);
      return;
    }

    const targetPartner = pendingPartners.find((p) => p.partner_id === partnerId);
    const partnerName = targetPartner?.profiles?.full_name || 'Valued Partner';
    const partnerMobile = targetPartner?.profiles?.mobile;

    if (level === 'LEVEL1') {
      const msg = encodeURIComponent(
        `Dear Management,\n\n` +
        `Level 1 approval completed for partner: *${partnerName}*\n` +
        `Approved by: *${approverName}*\n\n` +
        `Kindly proceed with final administrative approval.\n\n` +
        `Regards,\nL&T Management System`
      );
      window.open(`https://wa.me/${MANAGEMENT_CONTACTS.admin}?text=${msg}`, '_blank');
      window.open(`https://wa.me/${MANAGEMENT_CONTACTS.coPartner}?text=${msg}`, '_blank');
    } else if (level === 'ADMIN') {
      const ceoMsg = encodeURIComponent(
        `Dear CEO,\n\n` +
        `Final Admin Approval granted for partner account: *${partnerName}*\n` +
        `Approved by: *${approverName}*\n\n` +
        `All onboarding procedures are now complete.\n\n` +
        `Regards,\nL&T Management System`
      );
      window.open(`https://wa.me/${MANAGEMENT_CONTACTS.ceo}?text=${ceoMsg}`, '_blank');

      if (partnerMobile) {
        const formatted = partnerMobile.replace(/\D/g, '');
        const recipient = formatted.startsWith('91') ? formatted : `91${formatted}`;
        const partnerMsg = encodeURIComponent(
          `Dear ${partnerName},\n\n` +
          `🎉 *Congratulations!* 🎉\n\n` +
          `Your Partner Account has been *APPROVED*!\n\n` +
          `✅ You can now access your full Partner Dashboard\n` +
          `✅ Track your network revenue\n` +
          `✅ View commission earnings (3%)\n` +
          `✅ Add new users to your network\n\n` +
          `Welcome aboard!\n\n` +
          `Best Regards,\nExecutive Management Team\nL&T Consultant Services`
        );
        window.open(`https://wa.me/${recipient}?text=${partnerMsg}`, '_blank');
      }
    }

    fetchPendingPartners();
  };

  // ═══════════════════════════════════════════════════════════════
  // ✅ NEW: Handle Reject
  // ═══════════════════════════════════════════════════════════════
  const handleRejectPartner = async (
    reasonCode: string,
    reasonText: string,
    customText: string
  ) => {
    if (!selectedPartner) throw new Error('No partner selected');

    const rejectorName = userData?.name || 'Admin';
    const partnerName = selectedPartner?.profiles?.full_name || 'Partner';
    const partnerUserId = selectedPartner?.user_id;

    const { error } = await supabase
      .from('partner_profiles')
      .update({
        approval_status: 'REJECTED',
        rejection_reason: reasonText,
        rejection_reason_code: reasonCode,
        rejected_by: rejectorName,
        rejected_at: new Date().toISOString(),
      })
      .eq('partner_id', selectedPartner.partner_id);

    if (error) throw new Error(error.message);

    // Create notification for partner
    await supabase.from('notifications').insert({
      user_id: partnerUserId,
      title: '❌ Partner Profile REJECTED',
      message: `Your partner profile has been rejected by ${rejectorName}.\n\nReason: ${reasonText}`,
      type: 'ERROR',
      category: 'REJECTION',
      related_id: selectedPartner.partner_id,
    });

    // WhatsApp notification
    const partnerMobile = selectedPartner?.profiles?.mobile;
    if (partnerMobile) {
      const formatted = partnerMobile.replace(/\D/g, '');
      const recipient = formatted.startsWith('91') ? formatted : `91${formatted}`;
      const msg = encodeURIComponent(
        `Dear ${partnerName},\n\n` +
        `❌ *Partner Profile REJECTED*\n\n` +
        `Your partner profile has been rejected.\n\n` +
        `Reason: *${reasonText}*\n\n` +
        `Rejected by: ${rejectorName}\n\n` +
        `For more details, please login to your account.\n\n` +
        `Regards,\nL&T Management Team`
      );
      window.open(`https://wa.me/${recipient}?text=${msg}`, '_blank');
    }

    setShowRejectModal(false);
    setSelectedPartner(null);
    fetchPendingPartners();
  };

  // ═══════════════════════════════════════════════════════════════
  // ✅ NEW: Handle Send Back
  // ═══════════════════════════════════════════════════════════════
  const handleSendBackPartner = async (
    reasonCode: string,
    reasonText: string,
    customText: string
  ) => {
    if (!selectedPartner) throw new Error('No partner selected');

    const senderName = userData?.name || 'Admin';
    const partnerName = selectedPartner?.profiles?.full_name || 'Partner';
    const partnerUserId = selectedPartner?.user_id;

    const { error } = await supabase
      .from('partner_profiles')
      .update({
        approval_status: 'SEND_BACK',
        send_back_reason: reasonText,
        send_back_reason_code: reasonCode,
        send_back_by: senderName,
        send_back_at: new Date().toISOString(),
        approved_by_level1: null,
        approved_by_admin: null,
      })
      .eq('partner_id', selectedPartner.partner_id);

    if (error) throw new Error(error.message);

    // Create notification for partner
    await supabase.from('notifications').insert({
      user_id: partnerUserId,
      title: '⚠️ Profile Needs Correction',
      message: `Your partner profile has been sent back for correction by ${senderName}.\n\nReason: ${reasonText}\n\nPlease update the details and resubmit.`,
      type: 'WARNING',
      category: 'SEND_BACK',
      related_id: selectedPartner.partner_id,
    });

    // WhatsApp notification
    const partnerMobile = selectedPartner?.profiles?.mobile;
    if (partnerMobile) {
      const formatted = partnerMobile.replace(/\D/g, '');
      const recipient = formatted.startsWith('91') ? formatted : `91${formatted}`;
      const msg = encodeURIComponent(
        `Dear ${partnerName},\n\n` +
        `⚠️ *Profile Needs Correction*\n\n` +
        `Your partner profile has been sent back for correction.\n\n` +
        `Reason: *${reasonText}*\n\n` +
        `Sent back by: ${senderName}\n\n` +
        `Please login to your account, update the details, and resubmit.\n\n` +
        `Regards,\nL&T Management Team`
      );
      window.open(`https://wa.me/${recipient}?text=${msg}`, '_blank');
    }

    setShowSendBackModal(false);
    setSelectedPartner(null);
    fetchPendingPartners();
  };

  // ═══════════════════════════════════════════════════════════════
  // ✅ NEW: Open Modals
  // ═══════════════════════════════════════════════════════════════
  const openRejectModal = (partner: any) => {
    setSelectedPartner(partner);
    setShowRejectModal(true);
  };

  const openSendBackModal = (partner: any) => {
    setSelectedPartner(partner);
    setShowSendBackModal(true);
  };

  if (!isAdmin && !isApprover) return null;

  if (pendingPartners.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-white border-2 border-amber-400 rounded-xl p-4 shadow-lg">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤝</span>
            <div>
              <h3 className="font-black text-sm uppercase text-amber-700">
                Partner Approval Requests ({pendingPartners.length})
              </h3>
              <p className="text-[10px] text-slate-500">
                New partner signups waiting for verification
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-bold hover:bg-slate-200 cursor-pointer"
            >
              {expanded ? '▲ Hide' : '▼ Show'}
            </button>
            <button
              onClick={fetchPendingPartners}
              disabled={loading}
              className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-lg font-bold hover:bg-amber-200 disabled:opacity-50 cursor-pointer"
            >
              {loading ? '⏳' : '🔄'} Refresh
            </button>
          </div>
        </div>

        {/* LIST */}
        {expanded && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pendingPartners.map((partner) => {
              const profile = partner.profiles || {};
              const joinedDate = partner.partner_joined_date
                ? new Date(partner.partner_joined_date).toLocaleDateString('en-IN')
                : 'N/A';

              return (
                <div
                  key={partner.partner_id}
                  className="border rounded-lg p-3 bg-amber-50/50 hover:bg-amber-50 transition"
                >
                  <div className="flex justify-between items-start gap-3 flex-wrap">
                    {/* LEFT - Partner Info */}
                    <div className="flex-1 text-xs space-y-1 min-w-[240px]">
                      <p className="font-black text-slate-800 uppercase text-sm">
                        {profile.full_name || 'N/A'}
                      </p>
                      <p className="text-slate-600">📧 {profile.email || 'N/A'}</p>
                      <p className="text-slate-600">📱 {profile.mobile || 'N/A'}</p>
                      <p className="text-slate-600">🆔 {profile.user_code || 'N/A'}</p>
                      {profile.firm_name && (
                        <p className="text-slate-500 text-[10px]">🏢 {profile.firm_name}</p>
                      )}
                      <p className="text-slate-500 text-[10px]">
                        📍 {profile.city || 'N/A'}, {profile.state || 'N/A'}
                      </p>
                      {partner.coverage_location && (
                        <p className="text-slate-500 text-[10px]">
                          🎯 Coverage: {partner.coverage_location}
                        </p>
                      )}
                      {partner.nominee_name && (
                        <p className="text-slate-500 text-[10px]">
                          👤 Nominee: {partner.nominee_name} ({partner.nominee_relation || 'N/A'})
                        </p>
                      )}
                      <p className="text-slate-400 text-[9px]">📅 Joined: {joinedDate}</p>

                      {/* Approval Badges */}
                      <div className="flex gap-2 pt-1 flex-wrap">
                        {partner.approved_by_level1 && (
                          <span className="bg-blue-100 text-blue-700 text-[9px] px-2 py-0.5 rounded font-bold border border-blue-200">
                            ✅ L1: {partner.approved_by_level1}
                          </span>
                        )}
                        {partner.approved_by_admin && (
                          <span className="bg-emerald-100 text-emerald-700 text-[9px] px-2 py-0.5 rounded font-bold border border-emerald-200">
                            ✅ ADMIN: {partner.approved_by_admin}
                          </span>
                        )}
                        {!partner.approved_by_level1 && !partner.approved_by_admin && (
                          <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded font-bold border border-amber-200">
                            ⏳ Awaiting Approval
                          </span>
                        )}
                      </div>
                    </div>

                    {/* RIGHT - Action Buttons */}
                    <div className="flex flex-col gap-1.5 min-w-[140px]">
                      {/* APPROVE buttons */}
                      {!partner.approved_by_level1 && (
                        <button
                          onClick={() => handleApprove(partner.partner_id, 'LEVEL1')}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-3 py-2 rounded-lg uppercase whitespace-nowrap cursor-pointer transition shadow-sm"
                          title="CEO/Co-Partner Level Approval"
                        >
                          ✓ Level 1 Approve
                        </button>
                      )}
                      {isAdmin && !partner.approved_by_admin && (
                        <button
                          onClick={() => handleApprove(partner.partner_id, 'ADMIN')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-3 py-2 rounded-lg uppercase whitespace-nowrap cursor-pointer transition shadow-md"
                          title="Final Admin Approval"
                        >
                          ✓ Final Approve
                        </button>
                      )}

                      {/* ✅ SEND BACK button */}
                      <button
                        onClick={() => openSendBackModal(partner)}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black px-3 py-2 rounded-lg uppercase whitespace-nowrap cursor-pointer transition shadow-sm"
                        title="Send back for correction"
                      >
                        ↩ Send Back
                      </button>

                      {/* ✅ REJECT button — only admin */}
                      {isAdmin && (
                        <button
                          onClick={() => openRejectModal(partner)}
                          className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black px-3 py-2 rounded-lg uppercase whitespace-nowrap cursor-pointer transition shadow-sm"
                          title="Reject partner profile"
                        >
                          ✕ Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ REJECT MODAL */}
      {showRejectModal && selectedPartner && (
        <RejectSendBackModal
          partnerName={selectedPartner?.profiles?.full_name || 'Partner'}
          action="REJECT"
          onClose={() => {
            setShowRejectModal(false);
            setSelectedPartner(null);
          }}
          onConfirm={handleRejectPartner}
        />
      )}

      {/* ✅ SEND BACK MODAL */}
      {showSendBackModal && selectedPartner && (
        <RejectSendBackModal
          partnerName={selectedPartner?.profiles?.full_name || 'Partner'}
          action="SEND_BACK"
          onClose={() => {
            setShowSendBackModal(false);
            setSelectedPartner(null);
          }}
          onConfirm={handleSendBackPartner}
        />
      )}
    </>
  );
}