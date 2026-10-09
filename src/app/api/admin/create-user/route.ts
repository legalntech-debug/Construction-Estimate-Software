import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, profileData } = body;

    // ✅ 1. Basic Validation
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

    // ✅ 2. Env vars validate
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing env vars:', {
        url: !!supabaseUrl,
        key: !!serviceRoleKey,
      });
      return NextResponse.json(
        { error: 'SERVER CONFIGURATION ERROR: Missing Supabase credentials.' },
        { status: 500 }
      );
    }

    // ✅ 3. Supabase Admin Client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ═══════════════════════════════════════════════════════════════
    // ✅ 4. DUPLICATE CHECK — Email, Mobile, Aadhaar
    // ═══════════════════════════════════════════════════════════════
    const emailLower = email.toLowerCase().trim();
    const mobileToCheck = String(profileData?.mobile || '').trim();
    const cleanAadhaar = profileData?.aadhaar_no
      ? String(profileData.aadhaar_no).replace(/\s/g, '')
      : null;

    // 4a. Check EMAIL (case-insensitive)
    const { data: emailCheck } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, user_code')
      .ilike('email', emailLower)
      .limit(1);

    if (emailCheck && emailCheck.length > 0) {
      return NextResponse.json(
        {
          error: `DUPLICATE ACCOUNT: Email "${emailLower}" is already registered with "${emailCheck[0].full_name}" (${emailCheck[0].user_code}). Please use a different email.`,
          duplicate: true,
          field: 'email',
        },
        { status: 409 }
      );
    }

    // 4b. Check MOBILE
    if (mobileToCheck) {
      const { data: mobileCheck } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, user_code')
        .eq('mobile', mobileToCheck)
        .limit(1);

      if (mobileCheck && mobileCheck.length > 0) {
        return NextResponse.json(
          {
            error: `DUPLICATE ACCOUNT: Mobile "${mobileToCheck}" is already registered with "${mobileCheck[0].full_name}" (${mobileCheck[0].user_code}). Please use a different mobile.`,
            duplicate: true,
            field: 'mobile',
          },
          { status: 409 }
        );
      }
    }

    // 4c. Check AADHAAR
    if (cleanAadhaar) {
      const { data: aadhaarCheck } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, user_code')
        .eq('aadhaar_no', cleanAadhaar)
        .limit(1);

      if (aadhaarCheck && aadhaarCheck.length > 0) {
        return NextResponse.json(
          {
            error: `DUPLICATE ACCOUNT: Aadhaar "${cleanAadhaar}" is already registered with "${aadhaarCheck[0].full_name}" (${aadhaarCheck[0].user_code}). Please verify.`,
            duplicate: true,
            field: 'aadhaar',
          },
          { status: 409 }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ 5. Create Auth User
    // ═══════════════════════════════════════════════════════════════
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailLower,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: profileData?.full_name || '',
        role: profileData?.role || 'user',
      },
    });

    if (authError || !authUser?.user) {
      console.error('Auth user creation error:', authError);
      return NextResponse.json(
        { error: authError?.message || 'FAILED TO CREATE AUTH USER.' },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ 6. Insert Profile — AUTO-APPROVED
    // ═══════════════════════════════════════════════════════════════
    const { error: profileError } = await supabaseAdmin.from('profiles').insert([
      {
        id: authUser.user.id,
        ...profileData,          // Pehle spread karein
        email: emailLower,       // Phir override karein
        mobile: mobileToCheck,
        aadhaar_no: cleanAadhaar,
        // ✅ AUTO-APPROVE
        status: 'active',
        approval_status: 'APPROVED',
      },
    ]);

    if (profileError) {
      // ✅ 7. ROLLBACK: Profile fail → auth user delete
      console.error('Profile insert error:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    // ✅ 8. Success response
    return NextResponse.json({
      success: true,
      user: authUser.user,
      message: 'User created successfully and auto-approved.',
    });

  } catch (err: any) {
    console.error('Create user API error:', err);
    return NextResponse.json(
      { error: err.message || 'INTERNAL SERVER ERROR' },
      { status: 500 }
    );
  }
}