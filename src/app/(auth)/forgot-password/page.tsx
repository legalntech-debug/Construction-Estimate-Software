'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMounted(true);

    // Supabase ka built-in recovery event listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Step 1: Send Native Reset Email via Supabase
  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return alert('Please enter your email!');

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/forgot-password`,
    });

    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      setMessage('Password reset link has been sent to your email!');
    }
  };

  // Step 2: Update Password using the established session
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return alert('Passwords do not match!');
    if (newPassword.length < 8) return alert('Password must be at least 8 characters long.');

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      alert('Password updated successfully!');
      router.push('/login');
    }
  };

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
            Securely recover your account via Supabase
          </p>
        </div>

        {/* Step 1: Send Reset Link Form */}
        {!isRecoveryMode ? (
          <form onSubmit={handleSendResetEmail} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase block mb-1">Registered Email</label>
              <input 
                type="email" 
                required
                placeholder="ENTER YOUR REGISTERED EMAIL" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 text-slate-800"
              />
            </div>
            {message && <p className="text-xs text-green-600 font-semibold text-center">{message}</p>}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl transition text-xs tracking-wider uppercase"
            >
              {loading ? 'SENDING LINK...' : 'Send Recovery Link'}
            </button>
          </form>
        ) : (
          /* Step 2: Set New Password Form */
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 font-medium text-center">
              Session verified! Please set your new password below.
            </div>
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
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition text-xs tracking-wider uppercase"
            >
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