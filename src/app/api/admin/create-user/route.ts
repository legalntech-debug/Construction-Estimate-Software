import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, profileData } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'EMAIL AND PASSWORD ARE REQUIRED.' },
        { status: 400 }
      );
    }

    // 1. Create User using Supabase Service Role (Session disturb nahi hoga)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: profileData?.full_name || '',
        role: profileData?.role || 'user',
      },
    });

    if (authError || !authUser?.user) {
      return NextResponse.json(
        { error: authError?.message || 'FAILED TO CREATE AUTH USER.' },
        { status: 400 }
      );
    }

    // 2. Insert Profile Data into 'profiles' Table
    const { error: profileError } = await supabaseAdmin.from('profiles').insert([
      {
        id: authUser.user.id,
        email: email.toLowerCase(),
        ...profileData,
      },
    ]);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: authUser.user });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'INTERNAL SERVER ERROR' },
      { status: 500 }
    );
  }
}