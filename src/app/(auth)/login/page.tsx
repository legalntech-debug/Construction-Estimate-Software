'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  // States for Terms & Conditions Modal
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const loginEmail = ((formData.get('email') as string) || email).trim();
    const loginPassword = ((formData.get('password') as string) || password).trim();

    if (!loginEmail || !loginPassword) {
      setError('Please fill in both Email and Password fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (authError) {
        setLoading(false);
        setError(`[AUTH ERROR]: ${authError.message}`);
        return;
      }

      if (data?.user) {
        // Fetch terms acceptance status from profiles table
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('terms_accepted')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        }

        // Check if terms are already accepted
        if (profile && profile.terms_accepted === true) {
          const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
          window.location.replace(`${currentOrigin}/dashboard`);
        } else {
          // Trigger Terms Modal for first-time user / partner-created user
          setPendingUser(data.user);
          setShowTermsModal(true);
          setLoading(false);
        }
      } else {
        setLoading(false);
        setError('No session created.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(`[CATCH ERROR]: ${err?.message || 'Unexpected error'}`);
    }
  };

  const handleAcceptTerms = async () => {
    if (!termsChecked || !pendingUser) return;
    setAcceptingTerms(true);

    try {
      // Update terms acceptance in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('id', pendingUser.id);

      if (updateError) {
        setError(`[TERMS ERROR]: ${updateError.message}`);
        setAcceptingTerms(false);
        setShowTermsModal(false);
        return;
      }

      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      window.location.replace(`${currentOrigin}/dashboard`);
    } catch (err: any) {
      setAcceptingTerms(false);
      setError(`[TERMS UPDATE ERROR]: ${err?.message || 'Failed to update terms acceptance.'}`);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 overflow-x-hidden relative">
      
      {/* ANIMATED MARQUEE HEADER */}
      <div className="w-full bg-white/5 border-b border-white/10 py-2.5 overflow-hidden flex justify-center shrink-0">
        <div className="marquee-left text-xs font-bold tracking-widest text-gray-200 px-4 whitespace-nowrap">
          Welcome to Legal n Tech Consultants • ERP Secure Gateway • Construction Estimate System • Client Management Live • MIS Dashboard • PDF Engine • Wallet System • AI ERP Core
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex flex-col lg:flex-row flex-1 w-full lg:h-[calc(100vh-41px)] overflow-hidden">

        {/* LEFT PANEL */}
        <div className="hidden lg:flex flex-1 flex-col px-8 py-6 border-r border-white/10 overflow-hidden">
          <div className="mb-4 shrink-0">
            <Link 
              href="/verify-estimate" 
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/20 rounded-lg text-white text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-blue-900 transition-all duration-300 bg-slate-950/50 backdrop-blur-md"
            >
              <span>←</span> BACK TO VERIFICATION
            </Link>
          </div>

          <h2 className="text-yellow-400 font-black text-xs mb-4 tracking-widest text-center shrink-0">
            SERVICES MODULE
          </h2>

          <div className="relative flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="absolute w-full animate-[scrollUp_18s_linear_infinite] space-y-3 pr-6">
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
                <div key={i} className="text-xs font-semibold text-gray-200 flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <span>⚡ {item}</span>
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full animate-pulse" style={{ width: `${60 + (i * 5) % 40}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER LOGIN PANEL */}
        <div className="flex flex-1 items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-sm sm:max-w-md bg-white text-black rounded-2xl shadow-2xl p-5 sm:p-8 my-auto">
            
            <div className="lg:hidden text-center pb-2.5 mb-2 border-b">
              <Link 
                href="/verify-estimate" 
                className="text-[11px] font-bold text-blue-900 hover:underline uppercase tracking-wider inline-flex items-center gap-1"
              >
                <span>←</span> Back to Verification Portal
              </Link>
            </div>

            <div className="text-center mb-4 sm:mb-6">
              <div className="text-2xl sm:text-3xl">🏢</div>
              <h1 className="text-lg sm:text-2xl font-black text-blue-900 mt-1">
                L&T WITH AI 2.0 PORTAL
              </h1>
            </div>

            {error && (
              <div className="bg-red-100 text-red-800 text-xs p-2.5 rounded-lg mb-3 font-bold border border-red-300 break-words font-mono">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleLogin} method="POST" noValidate className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700 block">
                  USER ID / EMAIL
                </label>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border p-2.5 rounded-lg mt-1 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                  placeholder="ENTER YOUR ID"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block">
                  PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border p-2.5 rounded-lg mt-1 pr-10 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPass(!showPass);
                    }}
                    className="absolute right-3 top-3 p-1 text-gray-500 z-10 focus:outline-none select-none active:scale-95 transition-transform"
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 rounded-xl transition disabled:bg-slate-400 uppercase tracking-wider text-xs sm:text-sm cursor-pointer shadow-md active:scale-[0.99] mt-1"
              >
                {loading ? 'AUTHENTICATING SYSTEM...' : 'SECURE SIGN IN'}
              </button>
            </form>

            <div className="flex justify-between text-xs mt-4 text-blue-700 font-semibold">
              <Link href="/forgot-password">Forgot Password?</Link>
              <Link href="/signup">Create Account →</Link>
            </div>

            <div className="text-center text-[10px] text-gray-500 mt-5 pt-3 border-t border-gray-100">
              © L&T Smart ERP System
            </div>

          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="hidden lg:flex flex-1 flex-col px-8 py-6 border-l border-white/10 bg-yellow-500/5 backdrop-blur-sm overflow-hidden">
          <div className="mb-4 shrink-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-yellow-400/30 rounded-lg text-yellow-300 text-xs font-bold uppercase tracking-widest bg-slate-950/50 backdrop-blur-md w-full justify-center">
              <span>⚡</span> SPECIAL LAUNCHING OFFER <span>⚡</span>
            </div>
          </div>

          <h2 className="text-yellow-400 font-black text-xs mb-4 tracking-widest text-center uppercase animate-pulse shrink-0">
            OFFERS & PIPELINE
          </h2>

          <div className="relative flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="absolute w-[calc(100%-2rem)] animate-[scrollUp_20s_linear_infinite] space-y-3">
              <div className="bg-white/10 p-3.5 rounded-xl border border-yellow-400/30 shadow-lg flex flex-col gap-1">
                <div className="flex justify-between items-center text-yellow-300 font-black text-xs">
                  <span>🚀 ESTIMATE ENGINE OFFER</span>
                  <span className="bg-yellow-400 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black shadow">₹21 ONLY</span>
                </div>
                <p className="text-[11px] text-slate-200 font-normal leading-relaxed">
                  Get instant construction & technical estimates at an unbeatable launching price of just ₹21!
                </p>
              </div>

              <div className="bg-white/10 p-3.5 rounded-xl border border-green-400/30 shadow-lg flex flex-col gap-1">
                <div className="flex justify-between items-center text-green-400 font-black text-xs">
                  <span>📄 FREE DRAFTING SERVICES</span>
                  <span className="bg-green-500 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black shadow">FREE</span>
                </div>
                <p className="text-[11px] text-slate-200 font-normal leading-relaxed">
                  Complimentary document drafting included with your selected plans during the launch period.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-white/10 bg-black/20 space-y-2">
                <p className="text-[10px] font-black text-yellow-300 uppercase tracking-widest text-center">
                  Upcoming Services Pipeline:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-200 font-semibold">
                  <div className="bg-white/5 p-2 rounded-lg border border-white/10 flex items-center gap-1.5">
                    <span>📍</span> Location Plan
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg border border-white/10 flex items-center gap-1.5">
                    <span>📊</span> Work Plan
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg border border-white/10 flex items-center gap-1.5">
                    <span>🏗️</span> Extension Est.
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg border border-white/10 flex items-center gap-1.5">
                    <span>🔨</span> Renovation Est.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* TERMS AND CONDITIONS FIRST-TIME ACCEPTANCE MODAL */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            
            <div className="border-b border-slate-800 pb-3 shrink-0">
              <h3 className="text-lg font-black text-yellow-400 uppercase tracking-wide">
                📜 TERMS & CONDITIONS REQUIRED
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Please review and accept our Platform Terms & Operational Guidelines to complete your account setup.
              </p>
            </div>

            {/* Scrollable Terms Content */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-y-auto text-xs text-slate-300 leading-relaxed space-y-4 font-sans shrink-0 max-h-72">
              <p className="font-bold text-white border-b border-slate-800 pb-1 uppercase tracking-wider">
                Platform Terms, Legal Disclaimers & Operational Guidelines
              </p>

              {/* 1. INTERNAL REFERENCE ONLY */}
              <div className="space-y-1 bg-red-950/40 p-2.5 rounded-lg border border-red-800/40">
                <p className="font-black text-red-400 uppercase tracking-wide">
                  1. Internal Reference Only (Non-Legal Use)
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300 font-medium">
                  <li>
                    <b>Strictly Internal Purpose:</b> All reports, estimates, valuation drafts, route maps, and legal documentation generated through this portal are strictly intended for internal client reference and preliminary evaluation purposes only.
                  </li>
                  <li>
                    <b>Not Valid in Court / Legal Proceedings:</b> These documents are <b>NOT valid</b> as formal legal evidence or expert proof in any Court of Law, Judicial Proceeding, Arbitral Tribunal, or Statutory Government Authority.
                  </li>
                  <li>
                    <b>User Responsibility:</b> The user assumes complete responsibility and liability for any unauthorized use, misuse, or disputes arising from presenting these reports in formal legal proceedings.
                  </li>
                </ul>
              </div>

              {/* 2. STRICT NO-REFUND POLICY */}
              <div className="space-y-1 bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/40">
                <p className="font-black text-amber-400 uppercase tracking-wide">
                  2. No-Refund & Payment Deduction Policy
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300 font-medium">
                  <li>
                    <b>Strictly Non-Refundable:</b> All payments, wallet deductions, or service fees incurred for report generation, estimation, or drafting services are <b>100% non-refundable</b> under any circumstances.
                  </li>
                  <li>
                    <b>No Reversal or Chargeback:</b> Once a report or service is successfully processed, requests for payment cancellation, refund claims, or chargebacks will not be entertained.
                  </li>
                  <li>
                    <b>Wallet Balance:</b> Funds added to the platform wallet are non-transferable and non-refundable.
                  </li>
                </ul>
              </div>

              {/* 3. BANK REJECTIONS & SITE VERIFICATION */}
              <div className="space-y-1">
                <p className="font-bold text-yellow-400 uppercase tracking-wide">
                  3. Bank Rejections & Site Verification
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  <li>
                    <b>No Guarantee for Approvals:</b> Legal n Tech Consultants holds no legal or financial liability in cases of bank loan rejections, municipal authority disapprovals, or third-party refusals.
                  </li>
                  <li>
                    <b>Mandatory Cross-Verification:</b> It is the sole responsibility of the user to physically verify site dimensions, local PWD/CPWD rates, and property legal title documents before finalizing any report.
                  </li>
                </ul>
              </div>

              {/* 4. WALLET BALANCE & ACCOUNT STATUS */}
              <div className="space-y-1">
                <p className="font-bold text-yellow-400 uppercase tracking-wide">
                  4. Wallet Balance & Account Status
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  <li>
                    <b>Minimum Balance Requirement:</b> Users must maintain a minimum wallet balance of <b>₹100</b> at all times to ensure uninterrupted access to all platform features and services.
                  </li>
                  <li>
                    <b>Low Balance Restrictions:</b> If your wallet balance falls below ₹100, new service requests will be restricted. However, you will retain access to view and print your previously generated estimates and review old cases.
                  </li>
                  <li>
                    <b>Account Deactivation Policy:</b> If the wallet balance remains below the required minimum and no activity or top-up is recorded for <b>60 days</b>, the account will be temporarily suspended, and estimates older than 60 days will no longer be accessible for opening or editing.
                  </li>
                </ul>
              </div>

              {/* 5. SERVICE & ESTIMATE GUIDELINES */}
              <div className="space-y-1">
                <p className="font-bold text-yellow-400 uppercase tracking-wide">
                  5. Service & Estimate Guidelines
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  <li>
                    <b>Activity Requirement:</b> Users must generate at least <b>1 estimate every 2 months</b> to keep their account fully active and operational. Failure to meet this requirement may lead to account suspension.
                  </li>
                  <li>
                    <b>Editing Limits:</b> For every standard service package (including estimates, drafting, mapping, and allied services), users are permitted a maximum of <b>3 free edits</b>.
                  </li>
                  <li>
                    <b>Additional Revisions:</b> Any modifications or edits requested after exhausting the initial 3 revisions will incur standard additional charges for a new request.
                  </li>
                  <li>
                    <b>Name & Address Correction Policy:</b> Only <b>minor typographical or spelling corrections</b> are permitted in the Name and Address fields. Substantial changes to identity or property ownership details are not allowed once submitted.
                  </li>
                </ul>
              </div>

              {/* SUPPORT */}
              <div className="space-y-1 pt-2 border-t border-slate-800">
                <p className="font-bold text-white uppercase">Support & Assistance</p>
                <p className="text-slate-400">
                  If you encounter any technical issues, platform errors, or require clarification regarding your wallet balance or account status, please contact our Administrator Support Team at:
                </p>
                <p className="font-bold text-yellow-400">Helpline / WhatsApp: 7987561396</p>
              </div>
            </div>

            {/* Checkbox */}
            <div className="flex items-start gap-2.5 pt-2 shrink-0">
              <input
                type="checkbox"
                id="modalTermsCheck"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="modalTermsCheck" className="text-xs text-slate-300 cursor-pointer select-none leading-tight">
                I have read, understood, and unconditionally agree to all the <span className="text-yellow-400 font-bold">Platform Terms & Guidelines</span> stated above.
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowTermsModal(false);
                  setPendingUser(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={!termsChecked || acceptingTerms}
                onClick={handleAcceptTerms}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-bold rounded-xl transition shadow-lg cursor-pointer"
              >
                {acceptingTerms ? 'SUBMITTING...' : 'ACCEPT & CONTINUE →'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}