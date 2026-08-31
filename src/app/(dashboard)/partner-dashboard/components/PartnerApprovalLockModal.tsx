'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ShieldAlert, RefreshCw, Send, CheckCircle2, User, Phone, Mail, Hash, Plus, Trash2, Clock } from 'lucide-react';

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
  onRefresh
}: PartnerApprovalLockProps) {
  const [submitting, setSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

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

  useEffect(() => {
    if (!hasAccount && userId) {
      fetchExistingUserProfile();
    }
  }, [hasAccount, userId]);

  const fetchExistingUserProfile = async () => {
    setLoadingProfile(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      setUserProfile(data);
      setFormData((prev) => ({
        ...prev,
        aadhaar_no: data.aadhaar_no || data.aadhaar || '',
        pan_card_no: data.pan_card_no || data.pan || '',
        bank_account_no: data.bank_account_no || data.account_no || '',
        ifsc_code: data.ifsc_code || data.ifsc || '',
        coverage_location: data.coverage_location || data.city || data.location || '',
      }));
    }
    setLoadingProfile(false);
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

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.from('partner_profiles').insert([{
      user_id: userId,
      ...formData,
      nominee_name: nominees[0]?.name || '',
      nominee_relation: nominees[0]?.relation || '',
      nominee_phone: nominees[0]?.phone || '',
      nominees_data: nominees,
      approval_status: 'PENDING',
      approved_by_level1: null,
      approved_by_admin: null
    }]);

    setSubmitting(false);
    if (error) {
      alert('Error creating partner profile: ' + error.message);
    } else {
      onRefresh();
    }
  };

  // 1. FIRST TIME ONBOARDING FORM
  if (!hasAccount) {
    return (
      <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans text-xs uppercase">
        <div className="bg-slate-900 border border-indigo-900/60 p-6 rounded-2xl w-full max-w-2xl space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-black text-indigo-400 tracking-wider">PARTNER ACCOUNT ONBOARDING</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Verify your registered details and submit KYC for dual-stage approval.</p>
          </div>

          {loadingProfile ? (
            <div className="py-8 text-center text-slate-400 font-mono">FETCHING USER PROFILE...</div>
          ) : (
            <form onSubmit={handleSubmitProfile} className="space-y-4 text-left">
              
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
                  <input type="date" required value={formData.date_of_birth} onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">AADHAAR NUMBER *</label>
                  <input type="text" required placeholder="12 Digit Aadhaar Number" value={formData.aadhaar_no} onChange={(e) => setFormData({...formData, aadhaar_no: e.target.value})} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">PAN CARD NUMBER *</label>
                  <input type="text" required placeholder="ABCDE1234F" value={formData.pan_card_no} onChange={(e) => setFormData({...formData, pan_card_no: e.target.value.toUpperCase()})} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">COVERAGE LOCATION / REGION *</label>
                  <input type="text" required placeholder="e.g. Indore, MP" value={formData.coverage_location} onChange={(e) => setFormData({...formData, coverage_location: e.target.value})} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">BANK ACCOUNT NO. *</label>
                  <input type="text" required placeholder="Account Number" value={formData.bank_account_no} onChange={(e) => setFormData({...formData, bank_account_no: e.target.value})} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">IFSC CODE *</label>
                  <input type="text" required placeholder="SBIN0001234" value={formData.ifsc_code} onChange={(e) => setFormData({...formData, ifsc_code: e.target.value.toUpperCase()})} className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500" />
                </div>
              </div>

              {/* DYNAMIC MULTIPLE NOMINEES */}
              <div className="border-t border-slate-800 pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-300">NOMINEE DETAILS (UP TO 2 NOMINEES)</h3>
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
                        <input type="text" required value={nom.name} onChange={(e) => handleNomineeChange(idx, 'name', e.target.value)} placeholder="Nominee Name" className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1 text-[9px]">RELATION *</label>
                        <input type="text" required value={nom.relation} onChange={(e) => handleNomineeChange(idx, 'relation', e.target.value)} placeholder="Spouse / Father" className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1 text-[9px]">PHONE NO. *</label>
                        <input type="text" required value={nom.phone} onChange={(e) => handleNomineeChange(idx, 'phone', e.target.value)} placeholder="Mobile Number" className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1 text-[9px]">SHARE % *</label>
                        <input type="number" min={1} max={100} required value={nom.share_percent} onChange={(e) => handleNomineeChange(idx, 'share_percent', Number(e.target.value))} className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="submit" disabled={submitting} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3.5 rounded-xl text-xs uppercase shadow-lg flex items-center justify-center gap-2">
                <Send size={15} /> {submitting ? 'SUBMITTING PROFILE...' : 'SUBMIT PROFILE FOR APPROVAL →'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 2. LIVE STAGE TRACKER LOCK SCREEN (AFTER SUBMISSION)
  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-40 p-4 font-sans uppercase">
      <div className="bg-slate-900 border border-amber-800/80 p-6 md:p-8 rounded-2xl w-full max-w-lg space-y-5 shadow-2xl text-center">
        <div className="p-3 bg-amber-950/80 border border-amber-800/60 rounded-2xl w-fit mx-auto">
          <ShieldAlert className="text-amber-400 w-10 h-10" />
        </div>
        
        <div>
          <h2 className="text-base font-black text-amber-400 tracking-wider">PARTNER APPROVAL IN PROGRESS</h2>
          <p className="text-[11px] text-slate-400 mt-1">Your Profile is Submitted & Under Multi-Stage Verification.</p>
        </div>

        {/* LIVE STAGE TRACKER */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-left text-xs">
          
          {/* STAGE 1: MADHUSMITA / JAYANT */}
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

          {/* STAGE 2: FINAL ADMIN */}
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