'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { AlertTriangle, Wallet, ArrowRight, Loader2 } from 'lucide-react';
import ConstructionPlanInput from './input/ConstructionPlanInput';

// ════════════════════════════════════════════════════════════════
// 🔹 Config — is page ki service ka case_type
// ════════════════════════════════════════════════════════════════
const PAGE_CASE_TYPE = 'map';                    // construction plan ke liye 'map'
const PAGE_SERVICE_LABEL = 'Construction Plan';
const MIN_RECHARGE = 100;                        // platform recharge minimum

export default function ConstructionPlanPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [userState, setUserState] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    let alive = true;

    const checkAccess = async () => {
      try {
        // 1️⃣ Session
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          router.replace('/verify-estimate');
          return;
        }

        // 2️⃣ Profile
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role, plan_type, wallet_balance, state')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!profile) {
          router.replace('/dashboard');
          return;
        }

        const adminFlag =
          profile.role === 'admin' ||
          session.user.email === 'legalntech@gmail.com';
        const premiumFlag = (profile.plan_type || '').toUpperCase().includes('PREMIUM');

        if (!alive) return;
        setIsAdmin(adminFlag);
        setIsPremium(premiumFlag);

        // 3️⃣ Admin / Premium → bypass
        if (adminFlag || premiumFlag) {
          setChecking(false);
          return;
        }

        const wallet = Number(profile.wallet_balance ?? 0);
        const stateName = (profile.state || 'MADHYA PRADESH').toUpperCase();

        if (!alive) return;
        setWalletBalance(wallet);
        setUserState(stateName);

        // 4️⃣ Pricing lookup — user's state → DEFAULT fallback
        let charge = 0;
        for (const st of [stateName, 'DEFAULT']) {
          const { data: pricing } = await supabaseClient
            .from('pricing_config')
            .select('price, mrp, active')
            .eq('case_type', PAGE_CASE_TYPE)
            .eq('state_name', st)
            .eq('active', true)
            .limit(1)
            .maybeSingle();

          if (pricing) {
            charge = Number(pricing.price ?? pricing.mrp ?? 0);
            break;
          }
        }

        if (!alive) return;
        setServiceCharge(charge);

        // 5️⃣ Decide — free / enough balance → allow
        if (!charge || charge <= 0 || wallet >= charge) {
          setChecking(false);
          return;
        }

        // ❌ Block
        setBlocked(true);
        setChecking(false);
      } catch (err) {
        console.warn('[ConstructionPlanPage] access check failed:', err);
        if (alive) setChecking(false); // fail-open
      }
    };

    checkAccess();
    return () => { alive = false; };
  }, [router, supabaseClient]);

  // ⏳ Loading
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Verifying wallet balance…
          </p>
        </div>
      </div>
    );
  }

  // ❌ Blocked — warning screen
  if (blocked) {
    const topUpNeeded = Math.max(MIN_RECHARGE, serviceCharge);
    const shortfall = Math.max(0, topUpNeeded - walletBalance);

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-amber-100 p-2.5 rounded-full">
              <AlertTriangle className="text-amber-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Insufficient Wallet Balance
              </h2>
              <p className="text-xs text-slate-500">
                {PAGE_SERVICE_LABEL} use karne ke liye wallet me balance hona chahiye.
              </p>
            </div>
          </div>

          {/* Numbers */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">🎯 Service Charge</span>
              <span className="font-semibold text-gray-800">₹{serviceCharge}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">💰 Minimum Recharge</span>
              <span className="font-semibold text-gray-800">₹{MIN_RECHARGE}</span>
            </div>
            <div className="flex justify-between border-t border-blue-200 pt-2">
              <span className="text-gray-600">💼 Your Balance</span>
              <span className="font-semibold text-gray-800">
                ₹{walletBalance.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-blue-200 pt-2">
              <span className="text-gray-700 font-semibold">⚠️ Shortfall</span>
              <span className="font-bold text-red-600">
                ₹{shortfall.toFixed(2)}
              </span>
            </div>
            {userState && (
              <div className="flex justify-between pt-1">
                <span className="text-gray-500 text-xs">State</span>
                <span className="text-gray-700 text-xs font-semibold">
                  {userState}
                </span>
              </div>
            )}
          </div>

          {/* Hint */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-5 text-xs text-emerald-800 leading-relaxed">
            <p className="font-bold mb-1">💡 How to fix:</p>
            <p>
              Recharge <span className="font-bold">₹{MIN_RECHARGE}</span> (minimum) —
              after that your balance will be{' '}
              <span className="font-bold">
                ₹{(walletBalance + MIN_RECHARGE).toFixed(2)}
              </span>
              , which covers this service charge of{' '}
              <span className="font-bold">₹{serviceCharge}</span>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() =>
                router.push(
                  `/wallet-ledger?recharge=1&from=${encodeURIComponent(PAGE_SERVICE_LABEL)}`
                )
              }
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Wallet size={16} />
              Recharge Now
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Allowed — render form
  return <ConstructionPlanInput />;
}