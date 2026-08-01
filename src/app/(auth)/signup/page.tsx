'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import emailjs from '@emailjs/browser';

export default function SignupPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    mobile: '',
    email: '',
    password: '',
    userType: 'INDIVIDUAL',
    planType: 'BASIC ENGINE PLAN', // Default Plan
    firmName: '',
    city: '',
    state: '',
    otp: '',
  });

  const [credentials, setCredentials] = useState({
    userId: '',
    password: '',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handlers and Automatic Uppercase logic
  const handleChange = (e: any) => {
    const { name, value } = e.target;
    
    if (name === 'userType') {
      // FIX: Agar user INDIVIDUAL chunta hai, toh PREMIUM PLAN block ho jaye aur BASIC automatic select ho jaye
      if (value === 'INDIVIDUAL') {
        setForm({ ...form, userType: value, planType: 'BASIC ENGINE PLAN' });
      } else {
        setForm({ ...form, userType: value });
      }
    } else if (name === 'password' || name === 'email') {
      setForm({ ...form, [name]: value });
    } else {
      setForm({ ...form, [name]: value.toUpperCase() });
    }
  };

  const sendOtp = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // 1. Supabase mein OTP save karein
    const { error: otpError } = await supabase.from('otps').insert([{ email: form.email, otp_code: generatedOtp }]);
    
    if (otpError) {
      setError("Database error, try again.");
      setLoading(false);
      return;
    }

    // 2. EmailJS se email bhejein
    emailjs.send(
      'service_g8hpevj',         // Service ID
      'template_4sqme4r',        // Template ID
      {
        to_email: form.email,    // User ka email
        otp_code: generatedOtp,  // OTP jo bhejna hai
      }, 
      'grxZ-VWExc0FNxr5n'        // Public Key
    )
    .then(() => {
      alert("OTP aapki email par bhej diya gaya hai!");
      setStep(2);
      setLoading(false);
    })
    .catch((err) => {
      setError("Email nahi ja paya!");
      setLoading(false);
    });
  };

  const verifyOtp = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 1. Database se check
    const { data, error: dbError } = await supabase
      .from('otps')
      .select('otp_code')
      .eq('email', form.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbError || data.otp_code !== form.otp) {
      setError('Galat OTP! Phir se try karein.');
      setLoading(false);
      return;
    }

    // 2. Auth Signup
    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      setError('User session not found');
      setLoading(false);
      return;
    }

    const generatedUserId = 'LNT-' + Math.floor(100000 + Math.random() * 900000);

    // Find this part inside verifyOtp function in your code
// 3. Profiles Table mein Data Insert
const { error: profileError } = await supabase.from('profiles').insert([
  {
    id: user.id,
    full_name: form.fullName,
    mobile: form.mobile,
    email: form.email.toLowerCase(),
    user_type: form.userType,
    plan_type: form.planType,
    firm_name: form.userType !== 'INDIVIDUAL' ? form.firmName : null,
    city: form.city,
    state: form.state,
    user_code: generatedUserId,
    // ADD THESE TWO LINES:
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
  },
]);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setCredentials({ userId: generatedUserId, password: form.password });
    setStep(3);
    setLoading(false);
  };

  if (!mounted) {
    return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-gray-500 text-xs tracking-widest font-mono">LOADING GATEWAY...</div>;
  }

  return (
    <div className="min-h-screen w-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white overflow-hidden relative">

      {/* MARQUEE TEXT */}
      <div className="w-full bg-white/5 border-b border-white/10 overflow-hidden relative z-10 flex items-center justify-center">
        <div className="w-full overflow-hidden">
          <div className="inline-block whitespace-nowrap animate-[scrollLeft_25s_linear_infinite] text-sm md:text-base font-bold text-slate-200 py-3 text-center w-full">
            <span>
              Welcome to <span className="text-yellow-400 font-black">Legal n Tech Consultants</span> • Delivering Fast, Secure & Quality-Driven Legal & Construction Solutions 24x365
            </span>
          </div>
        </div>
      </div>

      {/* BACK BUTTON */}
      <div className="absolute top-14 left-4 z-50">
        <Link
          href="/login"
          className="px-4 py-2 text-xs font-bold uppercase rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition"
        >
          ← Back Login
        </Link>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="flex flex-1 items-center justify-between p-6 gap-6">

        {/* LEFT PANEL */}
        <div className="hidden lg:flex flex-1 flex-col justify-center p-6">
          <h2 className="text-yellow-400 font-black text-base mb-5 text-center tracking-widest">
            SERVICES PANEL
          </h2>
          <div className="space-y-4 leading-7 font-medium text-slate-300">
            <p>⚡ Construction Estimate System</p>
            <p>⚡ Client ERP Management</p>
            <p>⚡ Legal Documentation Engine</p>
            <p>⚡ Route Map System</p>
            <p>⚡ MIS Reporting Dashboard</p>
            <p>⚡ Property Valuation System</p>
          </div>
        </div>

        {/* CENTER PANEL (FORM CONTAINER) */}
        <div className="w-full max-w-md bg-white text-black rounded-2xl shadow-2xl p-6">
          <h1 className="text-2xl font-black text-blue-900 text-center uppercase tracking-tight">
            L&T SIGNUP PORTAL
          </h1>
          <p className="text-xs text-center text-gray-500 mb-4 font-bold tracking-wider">
            ACCOUNT REGISTRATION FORM
          </p>

          {error && (
            <div className="bg-red-100 text-red-700 text-xs p-2.5 border border-red-200 rounded mb-3 font-semibold uppercase">
              {error}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
  <form onSubmit={sendOtp} className="space-y-3">
    <input name="fullName" required placeholder="FULL NAME" value={form.fullName} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold uppercase" />
    <input name="mobile" required type="tel" maxLength={10} placeholder="MOBILE NUMBER" value={form.mobile} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold" />
    <input name="email" required type="email" placeholder="EMAIL ADDRESS" value={form.email} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold" />
    <input name="password" required type="password" placeholder="PASSWORD" value={form.password} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold" />

    {/* CITY & STATE */}
    <div className="grid grid-cols-2 gap-2">
      <input name="city" required placeholder="CITY" value={form.city} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold uppercase" />
      <input name="state" required placeholder="STATE" value={form.state} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-semibold uppercase" />
    </div>

    {/* USER CATEGORY DROPDOWN */}
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Select User Category</label>
      <select name="userType" value={form.userType} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-bold bg-white text-slate-800">
        <option value="BANKER">BANKER</option>
        <option value="ENGINEER">ENGINEER</option>
        <option value="ARCHITECT">ARCHITECT</option>
        <option value="VALUER">VALUER</option>
        <option value="DSA">DSA</option>
        <option value="INDIVIDUAL">INDIVIDUAL USER</option>
      </select>
    </div>

    {/* DYNAMIC FIRM NAME */}
    {form.userType !== 'INDIVIDUAL' && (
      <div className="space-y-1">
        <label className="text-[10px] font-black text-blue-700 uppercase tracking-wider block">Registered Firm Name *</label>
        <input
          name="firmName"
          required
          placeholder="ENTER YOUR FIRM NAME"
          value={form.firmName}
          onChange={handleChange}
          className="w-full border-2 border-blue-100 p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-bold uppercase bg-blue-50/30"
        />
      </div>
    )}

    {/* ENGINE PLAN DROPDOWN */}
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Choose Engine Plan</label>
      <select name="planType" value={form.planType} onChange={handleChange} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-700 text-sm font-bold bg-white text-slate-800">
        <option value="BASIC ENGINE PLAN">BASIC ENGINE PLAN</option>
        {form.userType !== 'INDIVIDUAL' && (
          <option value="PREMIUM PLAN">PREMIUM PLAN</option>
        )}
      </select>
    </div>

    {/* LEGAL COMPLIANCE CHECKBOX - UPDATED FOR READABILITY */}
<div className="space-y-1 mt-2">
  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Legal Compliance</label>
  <div className="flex items-start gap-3 p-3 bg-blue-50 rounded border border-blue-200 shadow-inner">
    <input 
      type="checkbox" 
      id="terms" 
      checked={isAgreed} 
      onChange={(e) => setIsAgreed(e.target.checked)} 
      className="mt-1.5 h-4 w-4 shrink-0"
    />
    <label htmlFor="terms" className="text-[11px] text-slate-800 font-medium leading-relaxed cursor-pointer">
      I agree to the <b>DRC Consultant Terms of Service & Strict No-Refund Policy</b>. I verify all details before payment and acknowledge that all software estimates are <b>strictly non-refundable</b>, meant for preliminary use only, carry <b>zero financial or professional liability</b>, and require independent professional verification.
    </label>
  </div>
</div>
    <button 
      disabled={!isAgreed || loading} 
      className={`w-full py-2.5 rounded font-bold transition uppercase tracking-wider text-sm mt-2 ${
        !isAgreed ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800'
      } text-white`}
    >
      {loading ? 'SENDING OTP...' : 'SEND OTP'}
    </button>
  </form>
)}

          {/* STEP 2 */}
          {step === 2 && (
            <form onSubmit={verifyOtp} className="space-y-3">
              <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-2 rounded text-center font-bold">
                OTP SENT SUCCESSFULLY (Demo: 123456)
              </div>

              <input
                name="otp"
                required
                maxLength={6}
                placeholder="ENTER 6-DIGIT OTP"
                value={form.otp}
                onChange={handleChange}
                className="w-full border-2 p-2 rounded text-center tracking-widest font-black text-xl text-slate-800 focus:ring-2 focus:ring-green-600"
              />

              <button className="w-full bg-green-700 hover:bg-green-600 text-white py-2.5 rounded font-bold transition uppercase tracking-wider text-sm">
                {loading ? 'VERIFYING...' : 'VERIFY OTP'}
              </button>
            </form>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="text-center space-y-2">
              <div className="text-green-600 text-5xl font-bold animate-bounce">✓</div>
              <h2 className="font-black text-blue-900 tracking-tight text-lg">ACCOUNT CREATED SUCCESSFULLY</h2>

              <div className="bg-gray-100 p-4 rounded-xl mt-3 text-left text-xs font-mono border border-gray-200 space-y-1">
                <p><b>SYSTEM ID :</b> <span className="text-blue-900 font-bold">{credentials.userId}</span></p>
                <p><b>PASSWORD  :</b> <span className="text-slate-800 font-bold">{credentials.password}</span></p>
                <p><b>CATEGORY  :</b> <span className="text-slate-800 font-bold">{form.userType}</span></p>
                <p><b>LOCATION  :</b> <span className="text-slate-800 font-bold">{form.city}, {form.state}</span></p>
                <p><b>PLAN TYPE  :</b> <span className="text-slate-800 font-bold">{form.planType}</span></p>
                {form.userType !== 'INDIVIDUAL' && <p><b>FIRM NAME :</b> <span className="text-slate-800 font-bold">{form.firmName}</span></p>}
              </div>

              <button
                onClick={() => router.push('/login')}
                className="w-full mt-4 bg-blue-900 hover:bg-blue-800 text-white py-2.5 rounded font-bold transition uppercase text-sm tracking-wider"
              >
                GO TO LOGIN
              </button>
            </div>
          )}

        </div>

        {/* RIGHT PANEL - OFFER & LAUNCHING DETAILS */}
        <div className="hidden lg:flex flex-1 flex-col justify-center p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl backdrop-blur-sm">
          <h2 className="text-yellow-400 font-black text-base mb-4 text-center tracking-widest uppercase">
            ⚡ Special Launching Offer ⚡
          </h2>

          <div className="space-y-4 text-sm font-semibold">
            {/* OFFER ITEM 1 */}
            <div className="bg-white/10 p-3 rounded-lg border border-yellow-400/30 flex flex-col gap-1">
              <div className="flex justify-between items-center text-yellow-300 font-black">
                <span>🚀 ESTIMATE ENGINE OFFER</span>
                <span className="bg-yellow-400 text-slate-950 px-2 py-0.5 rounded text-xs font-black">₹21 ONLY</span>
              </div>
              <p className="text-xs text-slate-200 font-normal">Get instant construction & technical estimates at an unbeatable launching price of just ₹21!</p>
            </div>

            {/* OFFER ITEM 2 */}
            <div className="bg-white/10 p-3 rounded-lg border border-yellow-400/30 flex flex-col gap-1">
              <div className="flex justify-between items-center text-green-400 font-black">
                <span>📄 FREE DRAFTING SERVICES</span>
                <span className="bg-green-500 text-slate-950 px-2 py-0.5 rounded text-xs font-black">FREE</span>
              </div>
              <p className="text-xs text-slate-200 font-normal">Complimentary document drafting included with your selected plans during the launch period.</p>
            </div>

            {/* UPCOMING SERVICES */}
            <div className="pt-2 border-t border-white/10">
              <p className="text-[11px] font-black text-yellow-300 uppercase tracking-widest mb-2">Upcoming Services Pipeline:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 font-medium">
                <div className="bg-black/20 p-2 rounded border border-white/5">📍 Location Plan</div>
                <div className="bg-black/20 p-2 rounded border border-white/5">📊 Work Plan</div>
                <div className="bg-black/20 p-2 rounded border border-white/5">🏗️ Extension Est.</div>
                <div className="bg-black/20 p-2 rounded border border-white/5">🔨 Renovation Est.</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}