'use client';
import { useState } from 'react';
import { X } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  supabaseClient: any;
  onSuccess: () => void;
}

export default function EditProfileModal({ isOpen, onClose, profile, supabaseClient, onSuccess }: EditProfileModalProps) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [mobile, setMobile] = useState(profile?.mobile || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [city, setCity] = useState(profile?.city || '');
  const [state, setState] = useState(profile?.state || '');
  const [aadhaarNo, setAadhaarNo] = useState(profile?.aadhaar_no || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanAadhaar = aadhaarNo.replace(/\D/g, '');
    if (cleanAadhaar && cleanAadhaar.length !== 12) {
      setError('Aadhaar number must be exactly 12 digits.');
      setLoading(false);
      return;
    }

    const newDetails = {
      full_name: fullName,
      mobile: mobile,
      address: address,
      city: city,
      state: state,
      aadhaar_no: cleanAadhaar
    };

    const { error: dbError } = await supabaseClient
      .from('profile_update_history')
      .insert([
        {
          user_id: profile.id,
          updated_fields: newDetails,
          status: 'PENDING'
        }
      ]);

    if (dbError) {
      setError('Failed to submit request.');
      setLoading(false);
      return;
    }

    setSuccessMsg('Update request sent to Admin successfully!');
    setLoading(false);
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-black font-sans">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <h3 className="text-lg font-black text-slate-900 uppercase mb-1">Update Profile & KYC Details</h3>
        <p className="text-xs text-slate-500 mb-4">Changes will reflect after Admin verification and approval.</p>

        {error && <div className="bg-red-50 text-red-700 text-xs p-2.5 rounded mb-3 font-bold">{error}</div>}
        {successMsg && <div className="bg-emerald-50 text-emerald-700 text-xs p-2.5 rounded mb-3 font-bold">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Full Name</label>
            <input 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              className="w-full bg-slate-100 p-2.5 rounded border border-slate-300 font-semibold outline-none" 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Mobile Number</label>
              <input 
                type="text" 
                maxLength={10} 
                value={mobile} 
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} 
                className="w-full bg-slate-100 p-2.5 rounded border border-slate-300 font-semibold outline-none" 
                required 
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Aadhaar Card No. (12 Digits)</label>
              <input 
                type="text" 
                maxLength={12} 
                placeholder="12 Digit Aadhaar"
                value={aadhaarNo} 
                onChange={(e) => setAadhaarNo(e.target.value.replace(/\D/g, ''))} 
                className="w-full bg-slate-100 p-2.5 rounded border border-slate-300 font-semibold outline-none tracking-wider" 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">City</label>
              <input 
                type="text" 
                value={city} 
                onChange={(e) => setCity(e.target.value)} 
                className="w-full bg-slate-100 p-2.5 rounded border border-slate-300 font-semibold outline-none" 
                required 
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">State</label>
              <input 
                type="text" 
                value={state} 
                onChange={(e) => setState(e.target.value)} 
                className="w-full bg-slate-100 p-2.5 rounded border border-slate-300 font-semibold outline-none" 
                required 
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Registered Address</label>
            <textarea 
              rows={2} 
              value={address} 
              onChange={(e) => setAddress(e.target.value)} 
              className="w-full bg-slate-100 p-2.5 rounded border border-slate-300 font-semibold outline-none resize-none" 
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-900 hover:bg-blue-800 text-white py-3 rounded-lg font-bold uppercase transition mt-2 text-sm tracking-wider"
          >
            {loading ? 'Submitting...' : 'Submit Update Request to Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}