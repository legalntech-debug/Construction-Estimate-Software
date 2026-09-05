'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Check if recovery event triggered via URL hash/token
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Step 1: Send Reset Email
  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setMessage('');

    if (!email) {
      setErrorMsg('Please enter your email!');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/forgot-password`,
    });

    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setMessage('Password reset link has been sent to your registered email!');
    }
  };

  // Step 2: Save New Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match!');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      alert('Password updated successfully! Redirecting to login...');
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4 font-sans text-slate-700 overflow-x-hidden relative">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 my-auto">
        
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-1">🔑</div>
          <h2 className="text-xl md:text-2xl font-black text-blue-900 uppercase tracking-tight">
            PASSWORD RECOVERY
          </h2>
          <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mt-1">
            Securely recover your account via Supabase
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-100 text-red-700 text-xs p-3 border border-red-200 rounded-lg font-semibold uppercase text-center">
            {errorMsg}
          </div>
        )}

        {/* Step 1: Send Reset Link Form */}
        {!isRecoveryMode ? (
          <form onSubmit={handleSendResetEmail} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase block mb-1">
                Registered Email *
              </label>
              <input 
                type="email" 
                required
                placeholder="ENTER YOUR REGISTERED EMAIL" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-700 text-sm font-semibold text-slate-900"
              />
            </div>

            {message && (
              <div className="bg-green-50 text-green-700 text-xs p-3 border border-green-200 rounded-lg font-semibold text-center">
                {message}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl transition text-xs tracking-wider uppercase cursor-pointer"
            >
              {loading ? 'SENDING LINK...' : 'SEND RECOVERY LINK'}
            </button>
          </form>
        ) : (
          /* Step 2: Set New Password Form */
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-900 font-bold text-center uppercase">
              ✓ Session Verified! Enter your new password.
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 uppercase block mb-1">
                New Password (Min 8 chars) *
              </label>
              <input 
                type="password" 
                required
                placeholder="••••••••" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-700 text-sm font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 uppercase block mb-1">
                Confirm New Password *
              </label>
              <input 
                type="password" 
                required
                placeholder="••••••••" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-700 text-sm font-semibold text-slate-900"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition text-xs tracking-wider uppercase cursor-pointer"
            >
              {loading ? 'SAVING...' : 'SAVE & UPDATE PASSWORD'}
            </button>
          </form>
        )}

        {/* Back to Login Link */}
        <div className="text-center pt-2 border-t text-xs font-semibold">
          <Link href="/login" className="text-blue-900 hover:underline uppercase tracking-wide">
            ⬅ Back to Secure Sign In
          </Link>
        </div>

      </div>
    </div>
  );
}