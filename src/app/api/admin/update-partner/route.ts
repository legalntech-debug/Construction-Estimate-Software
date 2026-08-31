import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Service Role Key bypasses RLS policies safely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, second_role, holding_percentage, target_candidates, status, partner_since } = body;

    const { data, error } = await supabaseAdmin
      .from('partners')
      .upsert({
        user_id,
        second_role,
        holding_percentage,
        target_candidates,
        status,
        partner_since
      }, { onConflict: 'user_id' });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}