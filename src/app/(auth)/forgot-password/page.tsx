'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import emailjs from '@emailjs/browser';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  // Recovery States
  const [identity, setIdentity] = useState(''); // Stores Email or Mobile
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // [START NEW FEATURE]
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity) return alert('Please enter your registered Email!');
    
    setLoading(true);
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to database
    const { error: dbError } = await supabase.from('otps').insert([{ email: identity, otp_code: generatedOtp }]);

    if (dbError) {
      alert("Database error!");
      setLoading(false);
      return;
    }

    // Send email using EmailJS
    emailjs.send(
      'service_g8hpevj', 
      'template_4sqme4r', 
      { to_email: identity, otp_code: generatedOtp }, 
      'grxZ-VWExc0FNxr5n'
    )
    .then(() => {
      alert("OTP has been sent to your email!");
      setOtpSent(true);
      setLoading(false);
    })
    .catch(() => {
      alert("Failed to send email!");
      setLoading(false);
    });
  };

  const handleVerifyOtp = async () => {
    if (!otpValue) return alert("Please enter the OTP!");
    setLoading(true);

    const { data, error } = await supabase
      .from('otps')
      .select('otp_code')
      .eq('email', identity)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Check if OTP matches
    if (error || data.otp_code !== otpValue) {
      alert('Invalid OTP! Please try again.');
    } else {
      setIsOtpVerified(true);
      alert('OTP Verified successfully!');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return alert('Passwords do not match!');

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      alert(error.message);
    } else {
      alert('Password has been updated!');
      router.push('/login');
    }
    setLoading(false);
  };
  // [END NEW FEATURE]

  if (!mounted) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-gray-500 text-xs tracking-widest">
        LOADING RECOVERY GATEWAY...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4 font-sans text-slate-700">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl">🔑</div>
          <h2 className="text-2xl font-black text-blue-900 mt-2">PASSWORD RECOVERY</h2>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Securely recover your account without login
          </p>
        </div>

        {/* Step 1: Send OTP Form */}
        {!otpSent && !isOtpVerified && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Registered Email or Mobile No.</label>
              <input 
                type="text" 
                required
                placeholder="ENTER REGISTERED EMAIL OR MOBILE" 
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                className="w-full border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-slate-800"
              />
            </div>
            <button type="submit" className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl transition text-xs tracking-wider uppercase">
              Send Recovery OTP
            </button>
          </form>
        )}

        {/* Step 2: Verify OTP Input */}
        {otpSent && !isOtpVerified && (
          <div className="space-y-4 text-center">
            <div className="text-left">
              <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Enter 6-Digit OTP</label>
              <input 
                type="text" 
                maxLength={6}
                placeholder="000000" 
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value)}
                className="w-full border p-3 rounded-lg text-center font-bold text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-700 text-slate-800"
              />
            </div>
            <button 
              type="button" 
              onClick={handleVerifyOtp} 
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition text-xs tracking-wider uppercase"
            >
              {loading ? 'VERIFYING...' : 'Verify Code'}
            </button>
            <button type="button" onClick={() => setOtpSent(false)} className="text-xs text-blue-700 font-semibold hover:underline">
              ⬅ Change Email/Mobile
            </button>
          </div>
        )}

        {/* Step 3: Set New Password Form */}
        {isOtpVerified && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase block mb-1">New Password (Min 8 chars)</label>
              <input 
                type="password" 
                required
                placeholder="••••••••" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Confirm New Password</label>
              <input 
                type="password" 
                required
                placeholder="••••••••" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-slate-800"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition text-xs tracking-wider uppercase">
              {loading ? 'RESETTING...' : 'Save & Update Password'}
            </button>
          </form>
        )}

        {/* Back to Login Link */}
        <div className="text-center pt-2 border-t text-xs font-semibold">
          <Link href="/login" className="text-blue-900 hover:underline">
            ⬅ Back to Secure Sign In
          </Link>
        </div>

      </div>
    </div>
  );
}