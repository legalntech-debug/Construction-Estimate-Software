'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { AlertTriangle, Wallet, ArrowRight, Loader2 } from 'lucide-react';

// ════════════════════════════════════════════════════════════════
// 🔹 Constants
// ════════════════════════════════════════════════════════════════
const MIN_RECHARGE = 100;                    // Platform ka recharge minimum
const DEFAULT_USER_STATE = 'MADHYA PRADESH'; // Fallback agar profile me state nahi

// Lower-case service labels whose wallet check lives on the preview page.
const PREVIEW_GATED_SERVICES: string[] = ['construction plan'];

interface WalletGuardProps {
  children: React.ReactNode;
  caseType: string;         // e.g. 'map', 'locationPlan', 'estimate'
  serviceLabel: string;     // e.g. 'Construction Plan'
  minRecharge?: number;     // Override platform minimum (default 100)
}

type ChargeSource = 'state' | 'default' | 'max' | 'fallback' | 'free';

export default function WalletGuard({
  children,
  caseType,
  serviceLabel,
  minRecharge = MIN_RECHARGE,
}: WalletGuardProps) {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [userState, setUserState] = useState('');
  const [chargeSource, setChargeSource] = useState<ChargeSource>('free');

  const supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        // ═══════════════════════════════════════════════════════════
        // 1️⃣ Session check
        // ═══════════════════════════════════════════════════════════
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          router.replace('/verify-estimate');
          return;
        }

        // ═══════════════════════════════════════════════════════════
        // 2️⃣ Profile fetch
        // ═══════════════════════════════════════════════════════════
        const { data: profile, error: profileErr } = await supabaseClient
          .from('profiles')
          .select('role, plan_type, wallet_balance, state')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileErr || !profile) {
          router.replace('/dashboard');
          return;
        }

        const isAdmin =
          profile.role === 'admin' ||
          session.user.email === 'legalntech@gmail.com';
        const isPremium = (profile.plan_type || '').toUpperCase().includes('PREMIUM');

        // ✅ Admin / Premium → bypass (no check)
        if (isAdmin || isPremium) {
          if (alive) setChecking(false);
          return;
        }

        // ✅ Services whose wallet check is enforced later, on the preview page
        // (PaymentGateway verifies the balance right before a NEW ref no. is
        // generated). Reopened cases and same-ref reprints must be able to reach
        // the input page, so no balance check is done here for these services.
        if (PREVIEW_GATED_SERVICES.includes(serviceLabel.trim().toLowerCase())) {
          if (alive) setChecking(false);
          return;
        }

        const wallet = Number(profile.wallet_balance ?? 0);
        const stateName = (profile.state || DEFAULT_USER_STATE).toUpperCase().trim();

        if (alive) {
          setWalletBalance(wallet);
          setUserState(stateName);
        }

        // ═══════════════════════════════════════════════════════════
        // 3️⃣ Charge Lookup — 3-Tier Fallback
        //    Tier 1: User's exact state
        //    Tier 2: DEFAULT state
        //    Tier 3: Highest price across all states
        //    Tier 4: Free (0)
        // ═══════════════════════════════════════════════════════════
        let charge = 0;
        let source: ChargeSource = 'free';

        // ─── Tier 1: User's state ───
        const { data: stateRow, error: stateErr } = await supabaseClient
          .from('pricing_config')
          .select('price, mrp')
          .eq('case_type', caseType)
          .eq('state_name', stateName)
          .eq('active', true)
          .limit(1)
          .maybeSingle();

        if (!stateErr && stateRow) {
          charge = Number(stateRow.price ?? stateRow.mrp ?? 0);
          source = 'state';
        } else {
          // ─── Tier 2: DEFAULT state ───
          const { data: defaultRow, error: defaultErr } = await supabaseClient
            .from('pricing_config')
            .select('price, mrp')
            .eq('case_type', caseType)
            .eq('state_name', 'DEFAULT')
            .eq('active', true)
            .limit(1)
            .maybeSingle();

          if (!defaultErr && defaultRow) {
            charge = Number(defaultRow.price ?? defaultRow.mrp ?? 0);
            source = 'default';
          } else {
            // ─── Tier 3: Highest across all states ───
            const { data: maxRows, error: maxErr } = await supabaseClient
              .from('pricing_config')
              .select('price, mrp')
              .eq('case_type', caseType)
              .eq('active', true)
              .order('price', { ascending: false })
              .limit(1);

            if (!maxErr && maxRows && maxRows.length > 0) {
              charge = Number(maxRows[0].price ?? maxRows[0].mrp ?? 0);
              source = 'max';
            } else {
              // ─── Tier 4: No pricing row at all ───
              charge = 0;
              source = 'free';
            }
          }
        }

        if (!alive) return;

        setServiceCharge(charge);
        setChargeSource(source);

        console.log('[WalletGuard] charge resolved:', {
          caseType,
          serviceLabel,
          stateName,
          charge,
          source,
          wallet,
        });

        // ═══════════════════════════════════════════════════════════
        // 4️⃣ Decision
        // ═══════════════════════════════════════════════════════════
        if (!charge || charge <= 0 || wallet >= charge) {
          setChecking(false);
          return;
        }

        // ❌ Block
        setBlocked(true);
        setChecking(false);
      } catch (err) {
        console.warn('[WalletGuard] check failed:', err);
        // Fail-open: error par allow karo (user stuck na ho)
        if (alive) setChecking(false);
      }
    };

    run();
    return () => { alive = false; };
  }, [caseType, router, supabaseClient]);

  // ═══════════════════════════════════════════════════════════════
  // ⏳ Loading State
  // ═══════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════
  // ❌ Blocked — Insufficient Balance
  // ═══════════════════════════════════════════════════════════════
  if (blocked) {
    const topUpNeeded = Math.max(minRecharge, serviceCharge);
    const shortfall = Math.max(0, topUpNeeded - walletBalance);

    const sourceNote =
      chargeSource === 'max'
        ? ' (highest applicable rate)'
        : chargeSource === 'default'
        ? ' (standard rate)'
        : '';

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
                {serviceLabel} use karne ke liye wallet me balance hona chahiye.
              </p>
            </div>
          </div>

          {/* Numbers */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">
                🎯 Service Charge{sourceNote}
              </span>
              <span className="font-semibold text-gray-800">₹{serviceCharge}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">💰 Minimum Recharge</span>
              <span className="font-semibold text-gray-800">₹{minRecharge}</span>
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
              Recharge <span className="font-bold">₹{minRecharge}</span> (minimum) —
              after that your balance will be{' '}
              <span className="font-bold">
                ₹{(walletBalance + minRecharge).toFixed(2)}
              </span>
              , which covers this service charge of{' '}
              <span className="font-bold">₹{serviceCharge}</span>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition cursor-pointer"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() =>
                router.push(
                  `/wallet-ledger?recharge=1&from=${encodeURIComponent(serviceLabel)}`
                )
              }
              className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 cursor-pointer"
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

  // ═══════════════════════════════════════════════════════════════
  // ✅ Allowed — Render children
  // ═══════════════════════════════════════════════════════════════
  return <>{children}</>;
}