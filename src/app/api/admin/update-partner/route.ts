import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Next.js build prerendering bypass karne ke liye
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Environment Variables check & safe runtime initialization
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: 'Missing Supabase environment variables' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { user_id, second_role, holding_percentage, target_candidates, status, partner_since } = body;

    const { data, error } = await supabaseAdmin
      .from('partners')
      .upsert(
        {
          user_id,
          second_role,
          holding_percentage,
          target_candidates,
          status,
          partner_since,
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}