'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2 } from 'lucide-react';
import ConstructionPlanInput from './input/ConstructionPlanInput';

// ════════════════════════════════════════════════════════════════
// Construction Plan input page
//
// Access rules:
//   - A logged-in user with a profile may always open this page
//     (new case, reopened case, or a same-ref reprint).
//   - The wallet balance is NOT checked here. It is enforced on the
//     preview page (PaymentGateway), right before a NEW reference
//     number is generated. Same-ref reprints and minor edits to a
//     reopened case stay free and are never blocked by the wallet.
// ════════════════════════════════════════════════════════════════
export default function ConstructionPlanPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;

    const supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const checkSession = async () => {
      try {
        // 1. Session
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          router.replace('/verify-estimate');
          return;
        }

        // 2. Profile must exist
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!profile) {
          router.replace('/dashboard');
          return;
        }

        if (alive) setChecking(false);
      } catch (err) {
        console.warn('[ConstructionPlanPage] session check failed:', err);
        // Fail-open: the preview page enforces payment, so do not trap the user here
        if (alive) setChecking(false);
      }
    };

    checkSession();
    return () => { alive = false; };
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  return <ConstructionPlanInput />;
}
