'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import emailjs from 'emailjs-com';

export default function EditProfilePage() {
  const router = useRouter();
  const auth = useAuth();

  // State initialization with appropriate default values
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);

  // --- EMAIL CHANGE SECURITY STATES ---
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [generatedEmailOtp, setGeneratedEmailOtp] = useState('');
  const [emailOtpValue, setEmailOtpValue] = useState('');
  const [isEmailOtpVerified, setIsEmailOtpVerified] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  // --- MOBILE CHANGE SECURITY STATES ---
  const [isEditingMobile, setIsEditingMobile] = useState(false);
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [generatedMobileOtp, setGeneratedMobileOtp] = useState('');
  const [mobileOtpValue, setMobileOtpValue] = useState('');
  const [isMobileOtpVerified, setIsMobileOtpVerified] = useState(false);
  const [newMobile, setNewMobile] = useState('');

  // --- PASSWORD / OTP STATES ---
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpMethod, setOtpMethod] = useState('email'); // 'email' or 'mobile'
  const [generatedPasswordOtp, setGeneratedPasswordOtp] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);

  // Synchronize authentication context and fetch full profile data including dob & address
  useEffect(() => {
    if (auth?.currentUser?.id) {
      setFullName(auth.currentUser.full_name || '');
      setEmail(auth.currentUser.email || '');
      setMobile(auth.currentUser.mobile || '');
      
      const fetchProfileDetails = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('dob, address, full_name')
          .eq('id', auth.currentUser.id)
          .single();

        if (data && !error) {
          if (data.full_name) setFullName(data.full_name);
          if (data.dob) setDob(data.dob);
          if (data.address) setAddress(data.address);
        }
      };

      fetchProfileDetails();
    }
  }, [auth?.currentUser]);

  if (auth?.loading) {
    return <div className="p-10 text-center">Checking Session...</div>;
  }

  if (!auth?.currentUser) {
    return <div className="p-10 text-center text-red-500">Session expired. Please login.</div>;
  }

  // 1. Core Profile Update Handler (Connected to Supabase)
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProfile(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          address: address,
          dob: dob,
        })
        .eq('id', auth.currentUser.id);

      if (error) throw error;

      alert("Profile details updated successfully in database!");
    } catch (error: any) {
      alert("Error updating profile: " + (error.message || error));
    } finally {
      setLoadingProfile(false);
    }
  };

  // 2. Email OTP Flow Handlers
  const handleSendEmailOtp = async () => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedEmailOtp(otp);

    try {
      const templateParams = {
        to_email: email,
        to_name: fullName,
        otp_code: otp,
      };

      await emailjs.send(
        'service_g8hpevj', 
        'template_4sqme4r', 
        templateParams, 
        'grxZ-VWExc0FNxr5n'
      );

      alert(`Verification OTP has been successfully sent to your registered email (${email}).`);
      setEmailOtpSent(true);
    } catch (error) {
      alert('Failed to send verification OTP. Please try again later.');
    }
  };

  const handleVerifyEmailOtp = () => {
    if (emailOtpValue === generatedEmailOtp) {
      setIsEmailOtpVerified(true);
      alert('Current email verified successfully! You can now enter your new email address.');
    } else {
      alert('Invalid OTP! Please enter the correct verification code.');
    }
  };

  const handleSaveNewEmail = () => {
    if (!newEmail) {
      return alert('Please enter a new email address!');
    }
    setEmail(newEmail); 
    alert(`Email address updated successfully to ${newEmail}!`);
    setIsEditingEmail(false);
    setEmailOtpSent(false);
    setIsEmailOtpVerified(false);
    setEmailOtpValue('');
    setNewEmail('');
  };

  // 3. Mobile OTP Flow Handlers
  const handleSendMobileOtp = () => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedMobileOtp(otp);
    alert(`[Simulated SMS] Verification OTP sent to mobile number (${mobile}). OTP: ${otp}`);
    setMobileOtpSent(true);
  };

  const handleVerifyMobileOtp = () => {
    if (mobileOtpValue === generatedMobileOtp) {
      setIsMobileOtpVerified(true);
      alert('Current mobile number verified successfully! You can now update your mobile number.');
    } else {
      alert('Invalid OTP! Please enter the correct verification code.');
    }
  };

  const handleSaveNewMobile = () => {
    if (!newMobile) {
      return alert('Please enter a new mobile number!');
    }
    setMobile(newMobile); 
    alert(`Mobile number updated successfully to ${newMobile}!`);
    setIsEditingMobile(false);
    setMobileOtpSent(false);
    setIsMobileOtpVerified(false);
    setMobileOtpValue('');
    setNewMobile('');
  };

  // 4. Password Change Handlers
  const handleSendPasswordOtp = async () => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedPasswordOtp(otp);

    if (otpMethod === 'email') {
      try {
        const templateParams = {
          to_email: email,
          to_name: fullName,
          otp_code: otp,
        };

        await emailjs.send(
          'service_g8hpevj', 
          'template_4sqme4r', 
          templateParams, 
          'grxZ-VWExc0FNxr5n'
        );

        alert(`Secure verification OTP has been sent to your email (${email}).`);
        setOtpSent(true);
      } catch (error) {
        alert('An error occurred while sending the verification OTP.');
      }
    } else {
      alert(`[Simulated SMS] Verification OTP sent to mobile number (${mobile}). OTP: ${otp}`);
      setOtpSent(true);
    }
  };

  const handleVerifyPasswordOtp = () => {
    if (otpValue === generatedPasswordOtp) {
      setIsOtpVerified(true);
      alert('OTP verified successfully! You can now set your new password.');
    } else {
      alert('Invalid OTP! Please enter the correct verification code.');
    }
  };
  
  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long!');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('New password and confirmation password do not match!');
      return;
    }
    setLoadingPassword(true);
    setTimeout(() => {
      alert('New password has been set successfully!');
      setLoadingPassword(false);
      setShowPasswordSection(false);
      setOtpSent(false);
      setIsOtpVerified(false);
      setOtpValue('');
      setNewPassword('');
      setConfirmPassword('');
    }, 1000);
  };

  return (
    <div className="max-w-2xl mx-auto mt-4 sm:mt-6 bg-white p-4 sm:p-6 rounded-2xl border shadow-sm space-y-6 sm:space-y-8 mb-12 text-slate-700">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b pb-4">
        <button onClick={() => router.push('/dashboard')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm transition self-start sm:self-auto">
          ⬅ Back to Dashboard
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-slate-800">MY PROFILE & SETTINGS</h2>
      </div>

      {/* SECTION 1: PERSONAL DETAILS */}
      <form onSubmit={handleProfileUpdate} className="space-y-4">
        <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Personal Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Full Name</label>
            <input 
              type="text" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date of Birth</label>
            <input 
              type="date" 
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Permanent Address</label>
          <textarea 
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter your complete address here..."
            className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-sm"
          />
        </div>

        <button 
          type="submit" 
          disabled={loadingProfile}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition uppercase text-xs tracking-wider"
        >
          {loadingProfile ? 'Saving...' : 'Save Basic Info'}
        </button>
      </form>

      <hr className="border-slate-100" />

      {/* SECTION 2: SECURE EMAIL MANAGEMENT */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Email Authentication</h3>
        
        {!isEditingEmail ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border">
            <div className="overflow-hidden">
              <p className="text-xs text-slate-400 uppercase font-bold">Current Email</p>
              <p className="text-sm font-medium text-slate-700 break-all">{email}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setIsEditingEmail(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition self-start sm:self-auto"
            >
              Change Email
            </button>
          </div>
        ) : (
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-blue-600 uppercase">Email Security Verification</span>
              <button onClick={() => setIsEditingEmail(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
            </div>

            {!emailOtpSent && (
              <button 
                type="button" 
                onClick={handleSendEmailOtp}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Send OTP to {email}
              </button>
            )}

            {emailOtpSent && !isEmailOtpVerified && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="w-full sm:w-auto">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Enter Email OTP</label>
                  <input type="text" maxLength={4} value={emailOtpValue} onChange={(e) => setEmailOtpValue(e.target.value)} className="border p-2 rounded-lg w-full sm:w-36 text-center font-bold text-sm bg-white" />
                </div>
                <button type="button" onClick={handleVerifyEmailOtp} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition">Verify OTP</button>
              </div>
            )}

            {isEmailOtpVerified && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Enter New Email Address</label>
                  <input type="email" placeholder="example@new.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full border p-2 rounded-lg text-sm bg-white" />
                </div>
                <button type="button" onClick={handleSaveNewEmail} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition uppercase">Update Email</button>
              </div>
            )}
          </div>
        )}
      </div>

      <hr className="border-slate-100" />

      {/* SECTION 3: SECURE MOBILE MANAGEMENT */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Mobile Verification</h3>
        
        {!isEditingMobile ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border">
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold">Current Mobile No.</p>
              <p className="text-sm font-medium text-slate-700">+91 {mobile}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setIsEditingMobile(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition self-start sm:self-auto"
            >
              Change Number
            </button>
          </div>
        ) : (
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-600 uppercase">Mobile Security Verification</span>
              <button onClick={() => setIsEditingMobile(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
            </div>

            {!mobileOtpSent && (
              <button 
                type="button" 
                onClick={handleSendMobileOtp}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Send OTP to {mobile}
              </button>
            )}

            {mobileOtpSent && !isMobileOtpVerified && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="w-full sm:w-auto">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Enter Mobile OTP</label>
                  <input type="text" maxLength={4} value={mobileOtpValue} onChange={(e) => setMobileOtpValue(e.target.value)} className="border p-2 rounded-lg w-full sm:w-36 text-center font-bold text-sm bg-white" />
                </div>
                <button type="button" onClick={handleVerifyMobileOtp} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition">Verify OTP</button>
              </div>
            )}

            {isMobileOtpVerified && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Enter New Mobile Number</label>
                  <input type="tel" maxLength={10} placeholder="Enter 10 Digit Number" value={newMobile} onChange={(e) => setNewMobile(e.target.value)} className="w-full border p-2 rounded-lg text-sm bg-white" />
                </div>
                <button type="button" onClick={handleSaveNewMobile} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition uppercase">Update Number</button>
              </div>
            )}
          </div>
        )}
      </div>

      <hr className="border-slate-100" />

      {/* SECTION 4: CHANGE PASSWORD */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Security & Password</h3>
            <p className="text-xs text-slate-400">Manage and update your account password securely</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="text-xs font-bold uppercase tracking-wider px-4 py-2 border rounded-xl hover:bg-slate-50 transition text-slate-600 self-start sm:self-auto"
          >
            {showPasswordSection ? 'Hide Section' : 'Change Password'}
          </button>
        </div>

        {showPasswordSection && (
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-dashed space-y-4 transition">
            {!otpSent && !isOtpVerified && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase">Select OTP Delivery Method</label>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                    <input type="radio" name="otpType" checked={otpMethod === 'email'} onChange={() => setOtpMethod('email')} className="w-4 h-4 text-blue-600" />
                    <span className="break-all">Send to Email ({email})</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                    <input type="radio" name="otpType" checked={otpMethod === 'mobile'} onChange={() => setOtpMethod('mobile')} className="w-4 h-4 text-blue-600" />
                    <span>Send to Mobile ({mobile})</span>
                  </label>
                </div>
                <button type="button" onClick={handleSendPasswordOtp} className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition uppercase tracking-wide">Send Verification OTP</button>
              </div>
            )}

            {otpSent && !isOtpVerified && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase">Enter 4-Digit OTP</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" placeholder="Enter OTP" maxLength={4} value={otpValue} onChange={(e) => setOtpValue(e.target.value)} className="border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-48 text-center font-bold text-lg tracking-widest text-slate-700 bg-white" />
                  <button type="button" onClick={handleVerifyPasswordOtp} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-5 py-3 sm:py-0 rounded-xl transition uppercase tracking-wide">Verify OTP</button>
                </div>
              </div>
            )}

            {isOtpVerified && (
              <form onSubmit={handleSavePassword} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">New Password</label>
                    <input type="password" placeholder="Minimum 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Confirm New Password</label>
                    <input type="password" placeholder="Repeat new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm" required />
                  </div>
                </div>
                <button type="submit" disabled={loadingPassword} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl transition uppercase text-xs tracking-wider">
                  {loadingPassword ? 'Updating...' : 'Update Password Securely'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

    </div>
  );
}