'use client';

import { Users, ShieldCheck, MapPin, Landmark, Edit, Mail, Calendar, CreditCard } from 'lucide-react';

interface PartnerProfileCardProps {
  partnerProfile: any;
  canEdit?: boolean;
  onEdit?: () => void;
}

export default function PartnerProfileCard({
  partnerProfile,
  canEdit = false,
  onEdit,
}: PartnerProfileCardProps) {
  const pUser = partnerProfile?.profiles || {};
  const pData = partnerProfile || {};

  const isAdminApproved =
    pData.approved_by_admin === 'APPROVED' ||
    pData.admin_status === 'APPROVED' ||
    pData.approval_status === 'APPROVED' ||
    pData.status === 'APPROVED';

  // Dynamic Aadhaar extraction
  const aadhaarValue = pData.aadhaar_no || pData.aadhar_no || pData.aadhaar_number || 'N/A';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 text-slate-100 uppercase">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-extrabold text-white tracking-wider">
            PARTNER PROFILE DETAILS
          </h3>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Status Badge */}
          <span
            className={`text-[11px] px-3 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
              isAdminApproved
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                : 'bg-amber-950/80 text-amber-400 border-amber-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            STATUS: {isAdminApproved ? 'APPROVED' : (pData.approval_status || pData.status || 'PENDING')}
          </span>

          {/* Partner ID */}
          <span className="bg-slate-950 text-indigo-400 border border-indigo-900/60 text-[11px] px-3 py-1 rounded-full font-bold font-mono">
            ID: {pData.partner_id ? String(pData.partner_id).substring(0, 8).toUpperCase() : 'N/A'}
          </span>

          {/* ✅ EDIT PROFILE BUTTON */}
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg uppercase flex items-center gap-1.5 shadow-md transition cursor-pointer border border-indigo-500/50"
              title="Edit Your Profile"
            >
              <Edit size={12} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* DYNAMIC GENERAL DETAILS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
        <div>
          <span className="text-[10px] font-bold text-slate-400 block mb-1">PARTNER NAME</span>
          <span className="font-extrabold text-white text-sm block truncate">
            {pUser.full_name || pData.partner_name || 'N/A'}
          </span>
          {pUser.user_code && (
            <span className="font-mono text-amber-400 text-[10px] block mt-0.5">
              {pUser.user_code}
            </span>
          )}
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 block mb-1">MOBILE / EMAIL</span>
          <span className="font-mono font-bold text-slate-200 block flex items-center gap-1">
            📱 {pUser.mobile || pData.mobile || 'N/A'}
          </span>
          <span className="font-mono text-slate-400 block lowercase text-[11px] truncate flex items-center gap-1">
            📧 {pUser.email || pData.email || 'N/A'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 block mb-1 flex items-center gap-1">
            <CreditCard size={12} className="text-indigo-400" /> AADHAAR / PAN NO.
          </span>
          <span className="font-mono font-bold text-slate-300 block">
            AADHAAR: {aadhaarValue}
          </span>
          <span className="font-mono font-bold text-indigo-400 block text-[11px]">
            PAN: {pData.pan_card_no || 'N/A'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 block mb-1 flex items-center gap-1">
            <Calendar size={12} className="text-indigo-400" /> DOB / JOINED DATE
          </span>
          <span className="font-mono font-bold text-slate-200 block">
            DOB: {pData.date_of_birth || 'N/A'}
          </span>
          <span className="font-mono text-slate-400 text-[11px] block">
            JOINED: {pData.partner_joined_date
              ? new Date(pData.partner_joined_date).toLocaleDateString('en-IN')
              : (pData.joined_date || 'N/A')}
          </span>
        </div>
      </div>

      {/* DYNAMIC LOCATION & BANKING */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs pt-2 border-t border-slate-800">
        <div>
          <span className="text-[10px] font-bold text-slate-400 block mb-1 flex items-center gap-1">
            <MapPin size={12} className="text-indigo-400" /> COVERAGE LOCATION / REGION
          </span>
          <span className="font-bold text-slate-200 block">
            {pData.coverage_location || 'N/A'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 block mb-1 flex items-center gap-1">
            <Landmark size={12} className="text-emerald-400" /> BANKING DETAILS
          </span>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="bg-slate-950 text-emerald-400 border border-emerald-900/60 px-2.5 py-1 rounded-md font-bold">
              ACC NO: {pData.bank_account_no || 'N/A'}
            </span>
            <span className="bg-slate-950 text-cyan-400 border border-cyan-900/60 px-2.5 py-1 rounded-md font-bold">
              IFSC CODE: {pData.ifsc_code || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* DYNAMIC NOMINEE & APPROVAL STATUS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2 border-t border-slate-800 text-xs">
        <div>
          <span className="text-[10px] font-bold text-slate-400 block mb-1">NOMINEE INFORMATION</span>
          <span className="font-bold text-slate-200 text-xs">
            {pData.nominees_data && Array.isArray(pData.nominees_data) && pData.nominees_data.length > 0 ? (
              pData.nominees_data.map((n: any, i: number) => (
                <span key={i} className="block">
                  {n.name} ({n.relation}) - PH: {n.phone} • {n.share_percent}%
                </span>
              ))
            ) : pData.nominee_name ? (
              `${pData.nominee_name} (${pData.nominee_relation || 'RELATION N/A'}) - PH: ${pData.nominee_phone || 'N/A'}`
            ) : (
              'N/A'
            )}
          </span>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[10px] font-bold text-slate-400 block mb-1">APPROVAL STATUS</span>
          
          {/* Level 1 Approval */}
          {pData.approved_by_level1 && (
            <div className="font-mono font-bold text-blue-400 text-[11px]">
              L1 APPROVAL: <span className="bg-blue-950/80 border border-blue-800 px-2 py-0.5 rounded text-blue-400 ml-1">{pData.approved_by_level1}</span>
            </div>
          )}

          {/* Admin Approval */}
          <div className={`font-mono font-bold text-[11px] ${isAdminApproved ? 'text-emerald-400' : 'text-amber-400'} mt-1`}>
            ADMIN APPROVAL: <span className={`border px-2 py-0.5 rounded ml-1 ${
              isAdminApproved 
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
                : 'bg-amber-950/80 border-amber-800 text-amber-400'
            }`}>
              {pData.approved_by_admin || pData.approval_status || 'PENDING'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}