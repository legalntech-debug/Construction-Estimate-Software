'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  ShieldAlert, RefreshCw, Send, CheckCircle2, User, Phone, Mail, Hash,
  Plus, Trash2, Clock, X, XCircle, RotateCcw, Edit, Save
} from 'lucide-react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PartnerApprovalLockProps {
  userId: string;
  hasAccount: boolean;
  approvalStatus: string;
  approvedByLevel1: string | null;
  approvedByAdmin: string | null;
  rejectionReason?: string | null;
  sendBackReason?: string | null;
  startInEditMode?: boolean;
  onClose?: () => void;
  onRefresh: () => void;
}

interface Nominee {
  name: string;
  relation: string;
  phone: string;
  share_percent: number;
}

export default function PartnerApprovalLockModal({
  userId,
  hasAccount,
  approvalStatus,
  approvedByLevel1,
  approvedByAdmin,
  rejectionReason,
  sendBackReason,
  startInEditMode = false,
  onClose,
  onRefresh,
}: PartnerApprovalLockProps) {
  const [submitting, setSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [formError, setFormError] = useState('');

  // ✅ Edit mode — auto-enabled for approved partner edit
  const [isEditMode, setIsEditMode] = useState(startInEditMode);
  const [partnerProfileData, setPartnerProfileData] = useState<any>(null);

  const [nominees, setNominees] = useState<Nominee[]>([
    { name: '', relation: '', phone: '', share_percent: 100 }
  ]);

  const [formData, setFormData] = useState({
    date_of_birth: '',
    aadhaar_no: '',
    pan_card_no: '',
    bank_account_no: '',
    ifsc_code: '',
    coverage_location: ''
  });

  // ═══════════════════════════════════════════════════════════════
  // ✅ VALIDATION HELPERS
  // ═══════════════════════════════════════════════════════════════
  const isValidAadhaar = (aadhaar: string) => /^\d{12}$/.test(aadhaar);
  const isValidPAN = (pan: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  const isValidIFSC = (ifsc: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
  const isValidMobile = (mobile: string) => /^\d{10}$/.test(mobile);
  const isValidBankAcc = (acc: string) => /^\d{9,18}$/.test(acc);

  const maxDOB = new Date(new Date().setFullYear(new Date().getFullYear() - 18))
    .toISOString()
    .split('T')[0];

  // ═══════════════════════════════════════════════════════════════
  // ✅ EXIT HANDLER
  // ═══════════════════════════════════════════════════════════════
  const handleExit = () => {
    // ✅ If onClose provided (edit mode), close gracefully
    if (onClose && isEditMode) {
      const confirmed = window.confirm(
        "Close without saving?\n\nAny unsaved changes will be lost."
      );
      if (confirmed) onClose();
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to exit?\n\n" +
      (hasAccount
        ? "Your profile is under review. You can come back anytime to check status."
        : "Your partner profile is incomplete. You can come back anytime to continue.") +
      "\n\nClick OK to go back, or Cancel to stay."
    );

    if (confirmed) {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/dashboard';
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // ✅ Fetch user profile + partner profile data
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (userId) {
      fetchExistingUserProfile();
      // ✅ Fetch partner profile data if:
      // - SEND_BACK (for resubmit)
      // - startInEditMode (approved partner editing)
      if (approvalStatus === 'SEND_BACK' || startInEditMode) {
        fetchPartnerProfileData();
      }
    }
  }, [hasAccount, userId, approvalStatus, startInEditMode]);

  const fetchExistingUserProfile = async () => {
    setLoadingProfile(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      setUserProfile(data);
      // Only auto-fill from profile if not editing existing partner_profiles
      if (approvalStatus !== 'SEND_BACK' && !startInEditMode) {
        const rawAadhaar = data.aadhaar_no || data.aadhaar || '';
        const cleanAadhaar = rawAadhaar.replace(/\D/g, '').slice(0, 12);
        const formattedAadhaar = cleanAadhaar.replace(/(\d{4})(?=\d)/g, '$1 ');

        setFormData((prev) => ({
          ...prev,
          aadhaar_no: formattedAadhaar,
          pan_card_no: data.pan_card_no || data.pan || '',
          bank_account_no: data.bank_account_no || data.account_no || '',
          ifsc_code: data.ifsc_code || data.ifsc || '',
          coverage_location: data.coverage_location || data.city || data.location || '',
        }));
      }
    }
    setLoadingProfile(false);
  };

  // ✅ Fetch existing partner_profiles data (for edit or resubmit)
  const fetchPartnerProfileData = async () => {
    const { data } = await supabase
      .from('partner_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      setPartnerProfileData(data);

      const rawAadhaar = data.aadhaar_no || '';
      const cleanAadhaar = rawAadhaar.replace(/\D/g, '').slice(0, 12);
      const formattedAadhaar = cleanAadhaar.replace(/(\d{4})(?=\d)/g, '$1 ');

      setFormData({
        date_of_birth: data.date_of_birth || '',
        aadhaar_no: formattedAadhaar,
        pan_card_no: data.pan_card_no || '',
        bank_account_no: data.bank_account_no || '',
        ifsc_code: data.ifsc_code || '',
        coverage_location: data.coverage_location || '',
      });

      if (data.nominees_data && Array.isArray(data.nominees_data) && data.nominees_data.length > 0) {
        setNominees(data.nominees_data);
      } else if (data.nominee_name) {
        setNominees([{
          name: data.nominee_name || '',
          relation: data.nominee_relation || '',
          phone: data.nominee_phone || '',
          share_percent: 100
        }]);
      }
    }
  };

  const handleAddNominee = () => {
    if (nominees.length >= 2) return;
    setNominees([
      { name: nominees[0].name, relation: nominees[0].relation, phone: nominees[0].phone, share_percent: 50 },
      { name: '', relation: '', phone: '', share_percent: 50 }
    ]);
  };

  const handleRemoveNominee = (index: number) => {
    const updated = nominees.filter((_, i) => i !== index);
    if (updated.length === 1) {
      updated[0].share_percent = 100;
    }
    setNominees(updated);
  };

  const handleNomineeChange = (index: number, field: keyof Nominee, value: string | number) => {
    const updated = [...nominees];
    updated[index] = { ...updated[index], [field]: value };
    setNominees(updated);
  };

  // ═══════════════════════════════════════════════════════════════
  // ✅ SUBMIT — INSERT (new) OR UPDATE (resubmit / edit)
  // ═══════════════════════════════════════════════════════════════
  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!formData.date_of_birth) {
      setFormError('DATE OF BIRTH IS REQUIRED.');
      return;
    }

    const dob = new Date(formData.date_of_birth);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()) ? age - 1 : age;

    if (actualAge < 18) {
      setFormError('YOU MUST BE AT LEAST 18 YEARS OLD TO BECOME A PARTNER.');
      return;
    }

    const cleanAadhaar = formData.aadhaar_no.replace(/\s/g, '');
    if (!isValidAadhaar(cleanAadhaar)) {
      setFormError('AADHAAR MUST BE EXACTLY 12 DIGITS.');
      return;
    }

    if (!isValidPAN(formData.pan_card_no)) {
      setFormError('PAN FORMAT INVALID. EXAMPLE: ABCDE1234F');
      return;
    }

    if (!isValidBankAcc(formData.bank_account_no)) {
      setFormError('BANK ACCOUNT MUST BE 9-18 DIGITS.');
      return;
    }

    if (!isValidIFSC(formData.ifsc_code)) {
      setFormError('IFSC CODE INVALID. EXAMPLE: SBIN0001234');
      return;
    }

    if (!formData.coverage_location.trim()) {
      setFormError('COVERAGE LOCATION IS REQUIRED.');
      return;
    }

    for (let i = 0; i < nominees.length; i++) {
      const nom = nominees[i];
      if (!nom.name.trim()) {
        setFormError(`NOMINEE #${i + 1}: NAME IS REQUIRED.`);
        return;
      }
      if (!nom.relation.trim()) {
        setFormError(`NOMINEE #${i + 1}: RELATION IS REQUIRED.`);
        return;
      }
      if (!isValidMobile(nom.phone)) {
        setFormError(`NOMINEE #${i + 1}: PHONE MUST BE 10 DIGITS.`);
        return;
      }
      if (nom.share_percent < 1 || nom.share_percent > 100) {
        setFormError(`NOMINEE #${i + 1}: SHARE % MUST BE BETWEEN 1 AND 100.`);
        return;
      }
    }

    const totalShare = nominees.reduce((sum, n) => sum + n.share_percent, 0);
    if (totalShare !== 100) {
      setFormError(`TOTAL NOMINEE SHARE MUST BE 100%. CURRENT: ${totalShare}%`);
      return;
    }

    setSubmitting(true);

    // ✅ Determine status based on context
    const isApprovedEdit = isEditMode && approvalStatus === 'APPROVED';

    const payload: any = {
      user_id: userId,
      date_of_birth: formData.date_of_birth,
      aadhaar_no: cleanAadhaar,
      pan_card_no: formData.pan_card_no,
      bank_account_no: formData.bank_account_no,
      ifsc_code: formData.ifsc_code,
      coverage_location: formData.coverage_location,
      nominee_name: nominees[0]?.name || '',
      nominee_relation: nominees[0]?.relation || '',
      nominee_phone: nominees[0]?.phone || '',
      nominees_data: nominees,
    };

    if (isApprovedEdit) {
      // ✅ Approved partner editing — keep approval intact
      payload.approval_status = 'APPROVED';
      payload.approved_by_level1 = approvedByLevel1;
      payload.approved_by_admin = approvedByAdmin;
    } else {
      // ✅ New / Send-back resubmit — reset to PENDING
      payload.approval_status = 'PENDING';
      payload.approved_by_level1 = null;
      payload.approved_by_admin = null;
      payload.rejection_reason = null;
      payload.rejection_reason_code = null;
      payload.rejected_by = null;
      payload.rejected_at = null;
      payload.send_back_reason = null;
      payload.send_back_reason_code = null;
      payload.send_back_by = null;
      payload.send_back_at = null;
    }

    let error;

    if (isEditMode && partnerProfileData) {
      // ✅ UPDATE existing
      const { error: updateError } = await supabase
        .from('partner_profiles')
        .update(payload)
        .eq('partner_id', partnerProfileData.partner_id);
      error = updateError;
    } else {
      // ✅ INSERT new
      const { error: insertError } = await supabase
        .from('partner_profiles')
        .insert([payload]);
      error = insertError;
    }

    setSubmitting(false);

    if (error) {
      setFormError('ERROR SAVING PARTNER PROFILE: ' + error.message);
    } else {
      setIsEditMode(false);

      // ✅ Success message
      if (isApprovedEdit) {
        alert('✅ Profile updated successfully!');
      } else if (isEditMode) {
        alert('✅ Profile resubmitted for approval!');
      }

      // ✅ Close modal if onClose provided, otherwise refresh
      if (onClose) {
        onRefresh();
        onClose();
      } else {
        onRefresh();
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 1. ONBOARDING / EDIT FORM
  // ═══════════════════════════════════════════════════════════════
  if (!hasAccount || isEditMode) {
    const isApprovedEdit = isEditMode && approvalStatus === 'APPROVED';

    return (
      <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-[110] p-4 font-sans text-xs uppercase">
        <div className="bg-slate-900 border border-indigo-900/60 p-6 rounded-2xl w-full max-w-2xl space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] relative">

          {/* X button */}
          <button
            type="button"
            onClick={isEditMode ? handleExit : handleExit}
            className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/80 p-1.5 rounded-full border border-slate-700 transition z-10"
            title={isEditMode ? "Close" : "Go Back"}
          >
            <X size={16} />
          </button>

          <div className="border-b border-slate-800 pb-3 pr-8">
            <h2 className="text-base font-black text-indigo-400 tracking-wider">
              {isApprovedEdit
                ? '✏️ EDIT PARTNER PROFILE'
                : isEditMode
                  ? '✏️ UPDATE PARTNER PROFILE'
                  : 'PARTNER ACCOUNT ONBOARDING'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isApprovedEdit
                ? 'Update your profile details. Changes will be saved immediately.'
                : isEditMode
                  ? 'Update the required fields and resubmit for approval.'
                  : 'Verify your registered details and submit KYC for dual-stage approval.'}
            </p>
          </div>

          {/* ✅ Send Back Reason Banner */}
          {isEditMode && !isApprovedEdit && sendBackReason && (
            <div className="bg-amber-950/60 border border-amber-800 text-amber-300 text-[11px] p-3 rounded-xl font-bold flex items-start gap-2">
              <RotateCcw size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-amber-200 uppercase mb-0.5">Correction Required:</p>
                <p>{sendBackReason}</p>
              </div>
            </div>
          )}

          {loadingProfile ? (
            <div className="py-8 text-center text-slate-400 font-mono">FETCHING USER PROFILE...</div>
          ) : (
            <form onSubmit={handleSubmitProfile} className="space-y-4 text-left">

              {/* ERROR BANNER */}
              {formError && (
                <div className="bg-red-950/80 border border-red-800 text-red-300 text-[11px] p-3 rounded-xl font-bold flex items-start gap-2">
                  <span className="text-red-400 shrink-0">⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* LINKED USER INFO */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-indigo-900/40 space-y-2">
                <span className="text-[10px] font-black text-indigo-400 tracking-wider block border-b border-slate-800 pb-1">
                  REGISTERED ACCOUNT DETAILS (AUTO-LINKED)
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-bold block text-[9px] flex items-center gap-1"><User size={10} className="text-indigo-400" /> FULL NAME</span>
                    <span className="text-white font-bold">{userProfile?.full_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block text-[9px] flex items-center gap-1"><Phone size={10} className="text-indigo-400" /> MOBILE</span>
                    <span className="text-emerald-400 font-mono font-bold">{userProfile?.mobile || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block text-[9px] flex items-center gap-1"><Mail size={10} className="text-indigo-400" /> EMAIL</span>
                    <span className="text-slate-300 font-mono text-[10px] truncate block">{userProfile?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block text-[9px] flex items-center gap-1"><Hash size={10} className="text-indigo-400" /> USER CODE</span>
                    <span className="text-amber-400 font-mono font-bold">{userProfile?.user_code || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* KYC FORM */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">DATE OF BIRTH *</label>
                  <input
                    type="date"
                    required
                    min="1940-01-01"
                    max={maxDOB}
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">MINIMUM AGE: 18 YEARS</p>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">AADHAAR NUMBER *</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="1234 5678 9012"
                    value={formData.aadhaar_no}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                      const formatted = digitsOnly.replace(/(\d{4})(?=\d)/g, '$1 ');
                      setFormData({...formData, aadhaar_no: formatted});
                    }}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono tracking-wider text-base"
                  />
                  <p className={`text-[10px] mt-1 font-bold ${
                    formData.aadhaar_no.replace(/\s/g, '').length === 12 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {formData.aadhaar_no.replace(/\s/g, '').length}/12 DIGITS
                  </p>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">PAN CARD NUMBER *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    value={formData.pan_card_no}
                    onChange={(e) => {
                      const upper = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                      setFormData({...formData, pan_card_no: upper});
                    }}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
                  />
                  <p className={`text-[10px] mt-1 font-bold ${
                    isValidPAN(formData.pan_card_no) ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    FORMAT: ABCDE1234F ({formData.pan_card_no.length}/10)
                  </p>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">COVERAGE LOCATION / REGION *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indore, MP"
                    value={formData.coverage_location}
                    onChange={(e) => setFormData({...formData, coverage_location: e.target.value})}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">BANK ACCOUNT NO. *</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={18}
                    placeholder="9-18 Digit Account Number"
                    value={formData.bank_account_no}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 18);
                      setFormData({...formData, bank_account_no: digitsOnly});
                    }}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">9-18 DIGITS</p>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">IFSC CODE *</label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    placeholder="SBIN0001234"
                    value={formData.ifsc_code}
                    onChange={(e) => {
                      const upper = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
                      setFormData({...formData, ifsc_code: upper});
                    }}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
                  />
                  <p className={`text-[10px] mt-1 font-bold ${
                    isValidIFSC(formData.ifsc_code) ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    FORMAT: ABCD0123456 ({formData.ifsc_code.length}/11)
                  </p>
                </div>
              </div>

              {/* NOMINEES */}
              <div className="border-t border-slate-800 pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-300">
                    NOMINEE DETAILS (UP TO 2 NOMINEES)
                    <span className="text-slate-500 ml-2 text-[10px]">
                      TOTAL SHARE: {nominees.reduce((s, n) => s + n.share_percent, 0)}%
                    </span>
                  </h3>
                  {nominees.length < 2 && (
                    <button type="button" onClick={handleAddNominee} className="text-indigo-400 hover:text-indigo-300 text-[10px] font-bold flex items-center gap-1 bg-indigo-950/60 border border-indigo-800/60 px-2 py-1 rounded-lg">
                      <Plus size={12} /> ADD SECOND NOMINEE
                    </button>
                  )}
                </div>

                {nominees.map((nom, idx) => (
                  <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 relative">
                    <div className="flex justify-between items-center text-[10px] text-indigo-400 font-bold">
                      <span>NOMINEE #{idx + 1}</span>
                      {nominees.length > 1 && (
                        <button type="button" onClick={() => handleRemoveNominee(idx)} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                          <Trash2 size={12} /> REMOVE
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="md:col-span-1">
                        <label className="block text-slate-400 font-bold mb-1 text-[9px]">FULL NAME *</label>
                        <input
                          type="text"
                          required
                          value={nom.name}
                          onChange={(e) => handleNomineeChange(idx, 'name', e.target.value.toUpperCase())}
                          placeholder="Nominee Name"
                          className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1 text-[9px]">RELATION *</label>
                        <input
                          type="text"
                          required
                          value={nom.relation}
                          onChange={(e) => handleNomineeChange(idx, 'relation', e.target.value.toUpperCase())}
                          placeholder="Spouse / Father"
                          className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1 text-[9px]">PHONE NO. *</label>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          inputMode="numeric"
                          value={nom.phone}
                          onChange={(e) => handleNomineeChange(idx, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-Digit Mobile"
                          className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono"
                        />
                        <p className={`text-[9px] mt-0.5 font-bold ${
                          nom.phone.length === 10 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {nom.phone.length}/10
                        </p>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1 text-[9px]">SHARE % *</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          required
                          value={nom.share_percent}
                          onChange={(e) => handleNomineeChange(idx, 'share_percent', Number(e.target.value))}
                          className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3.5 rounded-xl text-xs uppercase shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApprovedEdit ? <Save size={15} /> : <Send size={15} />}
                {submitting
                  ? 'SAVING...'
                  : isApprovedEdit
                    ? '💾 SAVE CHANGES →'
                    : isEditMode
                      ? '🔄 RESUBMIT FOR APPROVAL →'
                      : 'SUBMIT PROFILE FOR APPROVAL →'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. REJECTED SCREEN
  // ═══════════════════════════════════════════════════════════════
  if (approvalStatus === 'REJECTED') {
    return (
      <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-[110] p-4 font-sans uppercase">
        <div className="bg-slate-900 border border-rose-800/80 p-6 md:p-8 rounded-2xl w-full max-w-lg space-y-5 shadow-2xl text-center relative">

          <button
            type="button"
            onClick={handleExit}
            className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/80 p-1.5 rounded-full border border-slate-700 transition z-10"
            title="Go Back"
          >
            <X size={16} />
          </button>

          <div className="p-3 bg-rose-950/80 border border-rose-800/60 rounded-2xl w-fit mx-auto">
            <XCircle className="text-rose-400 w-10 h-10" />
          </div>

          <div>
            <h2 className="text-base font-black text-rose-400 tracking-wider">
              ❌ PARTNER PROFILE REJECTED
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">
              Your partner profile has been rejected by management.
            </p>
          </div>

          {rejectionReason && (
            <div className="bg-rose-950/40 border border-rose-800 p-4 rounded-xl text-left">
              <p className="text-[10px] font-bold text-rose-300 mb-1 uppercase">
                Reason for Rejection:
              </p>
              <p className="text-xs text-white leading-relaxed">
                {rejectionReason}
              </p>
            </div>
          )}

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-left">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              If you believe this is a mistake, please contact the administrator for further clarification.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl text-xs uppercase flex items-center justify-center gap-2 border border-slate-700"
            >
              <RefreshCw size={14} /> Refresh Status
            </button>
            <button
              type="button"
              onClick={() => window.location.href = '/dashboard'}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl text-xs uppercase"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. SEND BACK SCREEN
  // ═══════════════════════════════════════════════════════════════
  if (approvalStatus === 'SEND_BACK') {
    return (
      <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-[110] p-4 font-sans uppercase">
        <div className="bg-slate-900 border border-amber-800/80 p-6 md:p-8 rounded-2xl w-full max-w-lg space-y-5 shadow-2xl text-center relative">

          <button
            type="button"
            onClick={handleExit}
            className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/80 p-1.5 rounded-full border border-slate-700 transition z-10"
            title="Go Back"
          >
            <X size={16} />
          </button>

          <div className="p-3 bg-amber-950/80 border border-amber-800/60 rounded-2xl w-fit mx-auto">
            <RotateCcw className="text-amber-400 w-10 h-10" />
          </div>

          <div>
            <h2 className="text-base font-black text-amber-400 tracking-wider">
              ⚠️ PROFILE SENT BACK
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">
              Please review the reason below and update your details.
            </p>
          </div>

          {sendBackReason && (
            <div className="bg-amber-950/40 border border-amber-800 p-4 rounded-xl text-left">
              <p className="text-[10px] font-bold text-amber-300 mb-1 uppercase">
                Reason from Management:
              </p>
              <p className="text-xs text-white leading-relaxed">
                {sendBackReason}
              </p>
            </div>
          )}

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-left">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Click below to update your profile. After correction, your profile will be re-submitted for approval.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl text-xs uppercase flex items-center justify-center gap-2 border border-slate-700"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl text-xs uppercase shadow-lg flex items-center justify-center gap-2"
            >
              <Edit size={14} /> ✏️ Update Profile Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. LIVE STAGE TRACKER (PENDING)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[110] p-4 font-sans uppercase">
      <div className="bg-slate-900 border border-amber-800/80 p-6 md:p-8 rounded-2xl w-full max-w-lg space-y-5 shadow-2xl text-center relative">

        <button
          type="button"
          onClick={handleExit}
          className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/80 p-1.5 rounded-full border border-slate-700 transition z-10"
          title="Go Back"
        >
          <X size={16} />
        </button>

        <div className="p-3 bg-amber-950/80 border border-amber-800/60 rounded-2xl w-fit mx-auto">
          <ShieldAlert className="text-amber-400 w-10 h-10" />
        </div>

        <div>
          <h2 className="text-base font-black text-amber-400 tracking-wider">PARTNER APPROVAL IN PROGRESS</h2>
          <p className="text-[11px] text-slate-400 mt-1">Your Profile is Submitted & Under Multi-Stage Verification.</p>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-left text-xs">
          <div className="flex justify-between items-center border-b border-slate-800/60 pb-2.5">
            <div>
              <span className="text-slate-300 font-bold text-[11px] block">STAGE 1: CO-PARTNER / CEO APPROVAL</span>
              <span className="text-slate-500 text-[9px]">VERIFIERS: MADHUSMITA SAHOO / JAYANT TOMAR</span>
            </div>
            <span className={`font-black flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${
              approvedByLevel1
                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                : 'bg-amber-950 text-amber-400 border-amber-800'
            }`}>
              {approvedByLevel1 ? <CheckCircle2 size={12} /> : <Clock size={12} />}
              {approvedByLevel1 ? `APPROVED (${approvedByLevel1})` : 'PENDING'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <span className="text-slate-300 font-bold text-[11px] block">STAGE 2: FINAL ADMIN APPROVAL</span>
              <span className="text-slate-500 text-[9px]">ADMIN: DRC CONSULTANT</span>
            </div>
            <span className={`font-black flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${
              approvedByAdmin
                ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-bold'
                : approvedByLevel1
                ? 'bg-amber-950 text-amber-400 border-amber-800'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}>
              {approvedByAdmin ? <CheckCircle2 size={12} /> : <Clock size={12} />}
              {approvedByAdmin ? `APPROVED (${approvedByAdmin})` : approvedByLevel1 ? 'PENDING ADMIN' : 'WAITING STAGE 1'}
            </span>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 font-mono">
          * Account will automatically activate as soon as both levels complete authorization.
        </p>

        <button
          onClick={onRefresh}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700"
        >
          <RefreshCw size={14} /> REFRESH APPROVAL STATUS
        </button>
      </div>
    </div>
  );
}