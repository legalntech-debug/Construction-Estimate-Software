import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, profileData } = body;

    // ✅ 1. Basic Validation
    if (!email || !password) {
      return NextResponse.json({ error: 'EMAIL AND PASSWORD ARE REQUIRED.' }, { status: 400 });
    }
    if (!profileData?.full_name || !profileData?.mobile) {
      return NextResponse.json({ error: 'FULL NAME AND MOBILE ARE REQUIRED.' }, { status: 400 });
    }

    // ✅ 2. Env vars validate
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'SERVER CONFIGURATION ERROR: Missing Supabase credentials.' }, { status: 500 });
    }

    // ✅ 3. Supabase Admin Client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ✅ 4. DUPLICATE CHECK — Email, Mobile, Aadhaar
    const emailLower = email.toLowerCase().trim();
    const mobileToCheck = String(profileData?.mobile || '').trim();
    const cleanAadhaar = profileData?.aadhaar_no
      ? String(profileData.aadhaar_no).replace(/\s/g, '')
      : null;

    // 4a. Email Check
    const { data: emailCheck } = await supabaseAdmin.from('profiles').select('id, full_name, user_code').ilike('email', emailLower).limit(1);
    if (emailCheck && emailCheck.length > 0) {
      return NextResponse.json({ error: `DUPLICATE ACCOUNT: Email "${emailLower}" is already registered.`, duplicate: true, field: 'email' }, { status: 409 });
    }

    // 4b. Mobile Check
    if (mobileToCheck) {
      const { data: mobileCheck } = await supabaseAdmin.from('profiles').select('id, full_name, user_code').eq('mobile', mobileToCheck).limit(1);
      if (mobileCheck && mobileCheck.length > 0) {
        return NextResponse.json({ error: `DUPLICATE ACCOUNT: Mobile "${mobileToCheck}" is already registered.`, duplicate: true, field: 'mobile' }, { status: 409 });
      }
    }

    // 4c. Aadhaar Check
    if (cleanAadhaar) {
      const { data: aadhaarCheck } = await supabaseAdmin.from('profiles').select('id, full_name, user_code').eq('aadhaar_no', cleanAadhaar).limit(1);
      if (aadhaarCheck && aadhaarCheck.length > 0) {
        return NextResponse.json({ error: `DUPLICATE ACCOUNT: Aadhaar "${cleanAadhaar}" is already registered.`, duplicate: true, field: 'aadhaar' }, { status: 409 });
      }
    }

    // ✅ 5. Create Auth User (Trigger hata diya hai, isliye yahan sirf auth user banega)
    const userCode = `USR-${Date.now().toString().slice(-6)}`; // User code generate kiya

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailLower,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: profileData?.full_name || '',
        role: profileData?.role || 'user',
        // Future safety ke liye saara data yahan bhi bhej rahe hain
        mobile: mobileToCheck, 
        user_type: profileData?.user_type || 'BANKER',
        plan_type: profileData?.plan_type || 'BASIC PLAN',
        city: profileData?.city || 'Unknown',
        state: profileData?.state || 'Unknown',
        user_code: userCode
      },
    });

    if (authError || !authUser?.user) {
      console.error('Auth user creation error:', authError);
      return NextResponse.json({ error: authError?.message || 'FAILED TO CREATE AUTH USER.' }, { status: 400 });
    }

    // ✅ 6. Insert Profile (Explicit columns, NOT NULL constraints handled)
    const { error: profileError } = await supabaseAdmin.from('profiles').insert([
      {
        id: authUser.user.id,
        full_name: profileData.full_name,
        email: emailLower,
        mobile: mobileToCheck,
        user_type: profileData.user_type || 'BANKER', // Default if missing
        plan_type: profileData.plan_type || 'BASIC PLAN', // Default if missing
        city: profileData.city || 'Unknown',
        state: profileData.state || 'Unknown',
        user_code: userCode, // Zaroori field
        firm_name: profileData.firm_name || null,
        address: profileData.address || null,
        aadhaar_no: cleanAadhaar,
        role: profileData.role || 'user',
        status: 'active',
        approval_status: 'APPROVED',
      },
    ]);

    if (profileError) {
      // ✅ 7. ROLLBACK: Profile fail → auth user delete
      console.error('Profile insert error:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    // ✅ 8. Success response
    return NextResponse.json({
      success: true,
      user: authUser.user,
      message: 'User created successfully and auto-approved.',
    });

  } catch (err: any) {
    console.error('Create user API error:', err);
    return NextResponse.json({ error: err.message || 'INTERNAL SERVER ERROR' }, { status: 500 });
  }
}