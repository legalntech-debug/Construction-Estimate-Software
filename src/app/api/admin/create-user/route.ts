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

    // ✅ 1. Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'EMAIL AND PASSWORD ARE REQUIRED.' },
        { status: 400 }
      );
    }

    if (!profileData?.full_name || !profileData?.mobile) {
      return NextResponse.json(
        { error: 'FULL NAME AND MOBILE ARE REQUIRED.' },
        { status: 400 }
      );
    }

    // ✅ 2. Create Auth User (session disturb nahi hoga)
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

    // ✅ 3. Insert Profile — explicit status & approval_status set karo
    const { error: profileError } = await supabaseAdmin.from('profiles').insert([
      {
        id: authUser.user.id,
        email: email.toLowerCase(),
        ...profileData,
        // Ye 2 line explicitly set karo taki frontend ke bheje values consistent rahen
        status: profileData?.status || 'active',
        approval_status: profileData?.approval_status || 'APPROVED',
      },
    ]);

    if (profileError) {
      // ✅ 4. ROLLBACK: Agar profile fail ho, to auth user delete karo
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    // ✅ 5. Success response
    return NextResponse.json({
      success: true,
      user: authUser.user,
      message: 'User created successfully.',
    });

  } catch (err: any) {
    console.error('Create user API error:', err);
    return NextResponse.json(
      { error: err.message || 'INTERNAL SERVER ERROR' },
      { status: 500 }
    );
  }
}