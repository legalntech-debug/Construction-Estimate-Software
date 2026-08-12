'use client';
import { useState } from 'react';
import { User, ShieldCheck, Edit3 } from 'lucide-react';
import EditProfileModal from './EditProfileModal';

interface CustomerProfileCardProps {
  targetProfile: any;
  supabaseClient: any;
  onSuccess: () => void;
}

export default function CustomerProfileCard({ targetProfile, supabaseClient, onSuccess }: CustomerProfileCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  const formatAadhaar = (aadhaar?: string) => {
    if (!aadhaar) return 'Not Provided';
    const cleanAadhaar = aadhaar.replace(/\D/g, '');
    if (cleanAadhaar.length === 12) {
      return `XXXX-XXXX-${cleanAadhaar.slice(8)}`;
    }
    return 'Invalid (Must be 12 Digits)';
  };

  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 relative">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-sm font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
            <User size={18} className="text-blue-600" /> Customer & Profile Information (KYC Verified)
          </h2>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-bold">
              <ShieldCheck size={14} /> KYC Active
            </span>
            <button 
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow"
            >
              <Edit3 size={14} /> Edit Details
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Customer Name</span>
            <span className="font-bold text-slate-900 text-base">{targetProfile?.full_name || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">System ID (User Code)</span>
            <span className="font-semibold text-blue-600">{targetProfile?.user_code || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Mobile Number</span>
            <span className="font-semibold text-slate-800">{targetProfile?.mobile || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Email Address</span>
            <span className="font-semibold text-slate-800">{targetProfile?.email || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Aadhaar Card No.</span>
            <span className="font-bold text-slate-700">{formatAadhaar(targetProfile?.aadhaar_no)}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Plan Type</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-xs uppercase">{targetProfile?.plan_type || 'Basic Plan'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Category / User Type</span>
            <span className="font-semibold text-slate-800">{targetProfile?.user_type || 'N/A'}</span>
          </div>
          <div className="md:col-span-2">
            <span className="text-xs font-bold text-slate-400 uppercase block">Location (State / City)</span>
            <span className="font-semibold text-slate-800">{targetProfile?.city && targetProfile?.state ? `${targetProfile.city}, ${targetProfile.state}` : 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">A/C Creation Date</span>
            <span className="font-semibold text-slate-800">{targetProfile?.created_at ? new Date(targetProfile.created_at).toLocaleDateString() : 'N/A'}</span>
          </div>

          <div className="md:col-span-5 mt-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase block">Registered Address</span>
            <span className="font-medium text-slate-700">{targetProfile?.address || 'No address provided during registration.'}</span>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        profile={targetProfile} 
        supabaseClient={supabaseClient} 
        onSuccess={onSuccess} 
      />
    </>
  );
}