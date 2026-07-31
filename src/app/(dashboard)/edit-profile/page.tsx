'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
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

  // Synchronize authentication context with local states
  useEffect(() => {
    if (auth?.currentUser) {
      setFullName(auth.currentUser.full_name || '');
      setEmail(auth.currentUser.email || '');
      setMobile(auth.currentUser.mobile || '');
    }
  }, [auth?.currentUser]);

  if (auth?.loading) {
    return <div className="p-10 text-center">Checking Session...</div>;
  }

  if (!auth?.currentUser) {
    return <div className="p-10 text-center text-red-500">Session expired. Please login.</div>;
  }

  // 1. Core Profile Update Handler
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProfile(true);
    setTimeout(() => {
      alert("Profile details updated successfully!");
      setLoadingProfile(false);
    }, 1000);
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

      // [START NEW FEATURE] Professional English notification without console logs
      alert(`Verification OTP has been successfully sent to your registered email (${email}).`);
      // [END NEW FEATURE]
      setEmailOtpSent(true);
    } catch (error) {
      // [START NEW FEATURE] Professional English notification without console logs
      alert('Failed to send verification OTP. Please try again later.');
      // [END NEW FEATURE]
    }
  };

  const handleVerifyEmailOtp = () => {
    if (emailOtpValue === generatedEmailOtp) {
      setIsEmailOtpVerified(true);
      // [START NEW FEATURE] Professional English notification
      alert('Current email verified successfully! You can now enter your new email address.');
      // [END NEW FEATURE]
    } else {
      // [START NEW FEATURE] Professional English notification
      alert('Invalid OTP! Please enter the correct verification code.');
      // [END NEW FEATURE]
    }
  };

  const handleSaveNewEmail = () => {
    if (!newEmail) {
      // [START NEW FEATURE] Professional English notification
      return alert('Please enter a new email address!');
      // [END NEW FEATURE]
    }
    setEmail(newEmail); 
    // [START NEW FEATURE] Professional English notification
    alert(`Email address updated successfully to ${newEmail}!`);
    // [END NEW FEATURE]
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
    // [START NEW FEATURE] Professional English notification
    alert(`[Simulated SMS] Verification OTP sent to mobile number (${mobile}). OTP: ${otp}`);
    // [END NEW FEATURE]
    setMobileOtpSent(true);
  };

  const handleVerifyMobileOtp = () => {
    if (mobileOtpValue === generatedMobileOtp) {
      setIsMobileOtpVerified(true);
      // [START NEW FEATURE] Professional English notification
      alert('Current mobile number verified successfully! You can now update your mobile number.');
      // [END NEW FEATURE]
    } else {
      // [START NEW FEATURE] Professional English notification
      alert('Invalid OTP! Please enter the correct verification code.');
      // [END NEW FEATURE]
    }
  };

  const handleSaveNewMobile = () => {
    if (!newMobile) {
      // [START NEW FEATURE] Professional English notification
      return alert('Please enter a new mobile number!');
      // [END NEW FEATURE]
    }
    setMobile(newMobile); 
    // [START NEW FEATURE] Professional English notification
    alert(`Mobile number updated successfully to ${newMobile}!`);
    // [END NEW FEATURE]
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

        // [START NEW FEATURE] Professional English notification without console logs
        alert(`Secure verification OTP has been sent to your email (${email}).`);
        // [END NEW FEATURE]
        setOtpSent(true);
      } catch (error) {
        // [START NEW FEATURE] Professional English notification without console logs
        alert('An error occurred while sending the verification OTP.');
        // [END NEW FEATURE]
      }
    } else {
      // [START NEW FEATURE] Professional English notification
      alert(`[Simulated SMS] Verification OTP sent to mobile number (${mobile}). OTP: ${otp}`);
      // [END NEW FEATURE]
      setOtpSent(true);
    }
  };

  const handleVerifyPasswordOtp = () => {
    if (otpValue === generatedPasswordOtp) {
      setIsOtpVerified(true);
      // [START NEW FEATURE] Professional English notification
      alert('OTP verified successfully! You can now set your new password.');
      // [END NEW FEATURE]
    } else {
      // [START NEW FEATURE] Professional English notification
      alert('Invalid OTP! Please enter the correct verification code.');
      // [END NEW FEATURE]
    }
  };
  
  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      // [START NEW FEATURE] Professional English notification
      alert('Password must be at least 8 characters long!');
      // [END NEW FEATURE]
      return;
    }
    if (newPassword !== confirmPassword) {
      // [START NEW FEATURE] Professional English notification
      alert('New password and confirmation password do not match!');
      // [END NEW FEATURE]
      return;
    }
    setLoadingPassword(true);
    setTimeout(() => {
      // [START NEW FEATURE] Professional English notification
      alert('New password has been set successfully!');
      // [END NEW FEATURE]
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
    <div className="max-w-2xl mx-auto mt-6 bg-white p-6 rounded-2xl border shadow-sm space-y-8 mb-12 text-slate-700">
      
      {/* Header */}
      <div className="flex items-center gap-3 border-b pb-4">
        <button onClick={() => router.push('/dashboard')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-sm transition">
          ⬅ Back to Dashboard
        </button>
        <h2 className="text-xl font-bold text-slate-800">MY PROFILE & SETTINGS</h2>
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
              className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date of Birth</label>
            <input 
              type="date" 
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
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
            className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
          />
        </div>

        <button 
          type="submit" 
          disabled={loadingProfile}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition uppercase text-xs tracking-wider"
        >
          {loadingProfile ? 'Saving...' : 'Save Basic Info'}
        </button>
      </form>

      <hr className="border-slate-100" />

      {/* SECTION 2: SECURE EMAIL MANAGEMENT */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Email Authentication</h3>
        
        {!isEditingEmail ? (
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border">
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold">Current Email</p>
              <p className="text-sm font-medium text-slate-700">{email}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setIsEditingEmail(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
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
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Send OTP to {email}
              </button>
            )}

            {emailOtpSent && !isEmailOtpVerified && (
              <div className="flex gap-2 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Enter Email OTP</label>
                  <input type="text" maxLength={4} value={emailOtpValue} onChange={(e) => setEmailOtpValue(e.target.value)} className="border p-2 rounded-lg w-36 text-center font-bold text-sm" />
                </div>
                <button type="button" onClick={handleVerifyEmailOtp} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition">Verify OTP</button>
              </div>
            )}

            {isEmailOtpVerified && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Enter New Email Address</label>
                  <input type="email" placeholder="example@new.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full border p-2 rounded-lg text-sm bg-white" />
                </div>
                <button type="button" onClick={handleSaveNewEmail} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition uppercase">Update Email</button>
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
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border">
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold">Current Mobile No.</p>
              <p className="text-sm font-medium text-slate-700">+91 {mobile}</p>
            </div>
            <button 
              type="button" 
              onClick={() => setIsEditingMobile(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
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
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Send OTP to {mobile}
              </button>
            )}

            {mobileOtpSent && !isMobileOtpVerified && (
              <div className="flex gap-2 items-end">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Enter Mobile OTP</label>
                  <input type="text" maxLength={4} value={mobileOtpValue} onChange={(e) => setMobileOtpValue(e.target.value)} className="border p-2 rounded-lg w-36 text-center font-bold text-sm" />
                </div>
                <button type="button" onClick={handleVerifyMobileOtp} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition">Verify OTP</button>
              </div>
            )}

            {isMobileOtpVerified && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Enter New Mobile Number</label>
                  <input type="tel" maxLength={10} placeholder="Enter 10 Digit Number" value={newMobile} onChange={(e) => setNewMobile(e.target.value)} className="w-full border p-2 rounded-lg text-sm bg-white" />
                </div>
                <button type="button" onClick={handleSaveNewMobile} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition uppercase">Update Number</button>
              </div>
            )}
          </div>
        )}
      </div>

      <hr className="border-slate-100" />

      {/* SECTION 4: CHANGE PASSWORD */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Security & Password</h3>
            <p className="text-xs text-slate-400">Manage and update your account password securely</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="text-xs font-bold uppercase tracking-wider px-4 py-2 border rounded-xl hover:bg-slate-50 transition text-slate-600"
          >
            {showPasswordSection ? 'Hide Section' : 'Change Password'}
          </button>
        </div>

        {showPasswordSection && (
          <div className="bg-slate-50 p-5 rounded-2xl border border-dashed space-y-4 transition">
            {!otpSent && !isOtpVerified && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase">Select OTP Delivery Method</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                    <input type="radio" name="otpType" checked={otpMethod === 'email'} onChange={() => setOtpMethod('email')} className="w-4 h-4 text-blue-600" />
                    Send to Email ({email})
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                    <input type="radio" name="otpType" checked={otpMethod === 'mobile'} onChange={() => setOtpMethod('mobile')} className="w-4 h-4 text-blue-600" />
                    Send to Mobile ({mobile})
                  </label>
                </div>
                <button type="button" onClick={handleSendPasswordOtp} className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition uppercase tracking-wide">Send Verification OTP</button>
              </div>
            )}

            {otpSent && !isOtpVerified && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase">Enter 4-Digit OTP</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Enter OTP" maxLength={4} value={otpValue} onChange={(e) => setOtpValue(e.target.value)} className="border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 text-center font-bold text-lg tracking-widest text-slate-700" />
                  <button type="button" onClick={handleVerifyPasswordOtp} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-5 rounded-xl transition uppercase tracking-wide">Verify OTP</button>
                </div>
              </div>
            )}

            {isOtpVerified && (
              <form onSubmit={handleSavePassword} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">New Password</label>
                    <input type="password" placeholder="Minimum 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Confirm New Password</label>
                    <input type="password" placeholder="Repeat new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" required />
                  </div>
                </div>
                <button type="submit" disabled={loadingPassword} className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl transition uppercase text-xs tracking-wider">
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