'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { persistSession: true }
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = '/dashboard';
  };
  if (!mounted) {
    return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-gray-500 font-medium text-sm">LOADING...</div>;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 overflow-hidden">

     {/* ANIMATED MARQUEE CENTERED */}
<div className="w-full bg-white/5 border-b border-white/10 py-5 overflow-hidden flex justify-center">
  <div className="marquee-left text-sm font-bold tracking-widest text-gray-200 px-6 whitespace-nowrap">
    Welcome to Legal n Tech Consultants • ERP Secure Gateway • Construction Estimate System • Client Management Live • MIS Dashboard • PDF Engine • Wallet System • AI ERP Core
  </div>
</div>

      {/* MAIN 3 COLUMN AREA */}
      <div className="flex flex-1 w-full">

        {/* LEFT PANEL */}
  <div className="flex-1 flex flex-col px-12 pb-12 border-r border-white/10">
    <div className="mb-6 pt-4">
      <Link 
        href="/verify-estimate" 
        className="inline-flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg text-white text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-blue-900 transition-all duration-300 bg-slate-950/50 backdrop-blur-md"
      >
        <span>←</span> BACK TO VERIFICATION
      </Link>
    </div>

    <h2 className="text-yellow-400 font-black text-sm mb-6 tracking-widest text-center">
      SERVICES MODULE
    </h2>

    <div className="relative flex-1 h-[420px] overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="absolute w-full animate-[scrollUp_18s_linear_infinite] space-y-4">
        {[
          "Construction Estimate Engine",
          "Route Map & Key Plan System",
          "Legal Documentation Workflow",
          "Client Registration ERP",
          "MIS Reporting Dashboard",
          "Auto PDF Generation System",
          "Property Valuation Module",
          "Construction Planning AI"
        ].map((item, i) => (
          <div key={i} className="text-sm font-semibold text-gray-200 flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <span>⚡ {item}</span>
            <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-400 rounded-full animate-pulse" style={{ width: `${60 + (i * 5) % 40}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>

        {/* CENTER LOGIN PANEL */}
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md bg-white text-black rounded-2xl shadow-2xl p-8">
            
            {/* HEADER */}
            <div className="text-center mb-6">
              <div className="text-4xl">🏢</div>
              <h1 className="text-2xl font-black text-blue-900 mt-2">
                L&T WITH AI 2.0 PORTAL
              </h1>
            </div>

            {/* ERROR */}
            {error && (
              <div className="bg-red-100 text-red-700 text-xs p-2 rounded mb-4 font-semibold border border-red-200">
                {error}
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* EMAIL */}
              <div>
                <label className="text-xs font-bold text-gray-700">
                  USER ID / EMAIL
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border p-3 rounded-lg mt-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-700"
                  placeholder="ENTER YOUR ID"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label className="text-xs font-bold text-gray-700">
                  PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border p-3 rounded-lg mt-1 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-700"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-4 text-gray-500"
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* LOGIN BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl transition disabled:bg-slate-400 uppercase tracking-wider text-sm"
              >
                {loading ? 'AUTHENTICATING SYSTEM...' : 'SECURE SIGN IN'}
              </button>
            </form>

            {/* LINKS */}
            <div className="flex justify-between text-xs mt-5 text-blue-700 font-semibold">
              <Link href="/forgot-password">Forgot Password?</Link>
              <Link href="/signup">Create Account →</Link>
            </div>

            {/* FOOTER */}
            <div className="text-center text-[10px] text-gray-500 mt-6 pt-4 border-t border-gray-100">
              © L&T Smart ERP System
            </div>

          </div>
        </div>

        {/* RIGHT PANEL - SPECIAL OFFERS & UPCOMING SERVICES */}
        <div className="hidden lg:flex flex-1 flex-col justify-center p-8 border-l border-white/10 bg-yellow-500/5 backdrop-blur-sm">
          <h2 className="text-yellow-400 font-black text-sm mb-6 tracking-widest text-center uppercase animate-pulse">
            ⚡ Special Launching Offer ⚡
          </h2>

          <div className="flex flex-col gap-4">
            {/* OFFER CARD 1 */}
            <div className="bg-white/10 p-4 rounded-xl border border-yellow-400/30 shadow-lg flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-yellow-300 font-black text-sm">
                <span>🚀 ESTIMATE ENGINE OFFER</span>
                <span className="bg-yellow-400 text-slate-950 px-2.5 py-0.5 rounded text-xs font-black shadow">₹21 ONLY</span>
              </div>
              <p className="text-xs text-slate-200 font-normal leading-relaxed">
                Get instant construction & technical estimates at an unbeatable launching price of just ₹21!
              </p>
            </div>

            {/* OFFER CARD 2 */}
            <div className="bg-white/10 p-4 rounded-xl border border-green-400/30 shadow-lg flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-green-400 font-black text-sm">
                <span>📄 FREE DRAFTING SERVICES</span>
                <span className="bg-green-500 text-slate-950 px-2.5 py-0.5 rounded text-xs font-black shadow">FREE</span>
              </div>
              <p className="text-xs text-slate-200 font-normal leading-relaxed">
                Complimentary document drafting included with your selected plans during the launch period.
              </p>
            </div>

            {/* UPCOMING SERVICES PIPELINE */}
            <div className="mt-2 p-4 rounded-xl border border-white/10 bg-black/20">
              <p className="text-[11px] font-black text-yellow-300 uppercase tracking-widest mb-3 text-center">
                Upcoming Services Pipeline:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-200 font-semibold">
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/10 flex items-center gap-2">
                  <span>📍</span> Location Plan
                </div>
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/10 flex items-center gap-2">
                  <span>📊</span> Work Plan
                </div>
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/10 flex items-center gap-2">
                  <span>🏗️</span> Extension Est.
                </div>
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/10 flex items-center gap-2">
                  <span>🔨</span> Renovation Est.
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}