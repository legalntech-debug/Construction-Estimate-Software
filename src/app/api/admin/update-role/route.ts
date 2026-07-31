import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limiter';

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const limiter = rateLimit(ip, 15, 60 * 1000);
  
  if (!limiter.success) {
    return NextResponse.json(
      { error: `Too many requests. Please try again after ${limiter.resetIn} seconds.` },
      { status: 429 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  }

  const { data: role } = await supabase.rpc('get_user_role', { target_user_id: user.id });
  if (role?.toLowerCase() !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url), { status: 303 });
  }

  const formData = await request.formData();
  const targetUserId = formData.get('user_id') as string;
  const action = formData.get('action') as string;

  if (!targetUserId || !action) {
    return NextResponse.redirect(new URL('/admin-dashboard?error=invalid_params', request.url), { status: 303 });
  }

  // Profile ko 'id' ya 'user_code' se fetch karein
  let { data: profile } = await supabase
    .from('profiles')
    .select('id, user_code, role, status')
    .eq('id', targetUserId)
    .single();

  if (!profile) {
    const { data: profileByCode } = await supabase
      .from('profiles')
      .select('id, user_code, role, status')
      .eq('user_code', targetUserId)
      .single();
    profile = profileByCode;
  }

  if (profile) {
    const matchField = profile.id === targetUserId ? 'id' : 'user_code';
    const matchValue = targetUserId;

    if (action === 'toggle_role') {
      const newRole = profile.role === 'admin' ? 'user' : 'admin';
      await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq(matchField, matchValue);
    } else if (action === 'toggle_status') {
      const currentStatus = profile.status ? profile.status.toLowerCase().trim() : 'active';
      const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
      
      await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq(matchField, matchValue);
    }
  }

  return NextResponse.redirect(new URL('/admin-dashboard', request.url), { status: 303 });
}