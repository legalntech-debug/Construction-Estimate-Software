// Path: app/api/admin/service-records/route.ts
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Supabase Admin Client (module-scoped, reused across requests) ───
let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}

const PAGE_SIZE = 1000;
const ID_CHUNK = 100;

// ─── Helper: extract bearer token from header ───
function extractBearerToken(req: Request): string | null {
  const raw =
    req.headers.get('authorization') ||
    req.headers.get('Authorization') ||
    '';

  if (!raw) return null;

  const match = raw.match(/^Bearer\s+(.+)$/i); // case-insensitive "Bearer "
  return match ? match[1].trim() : null;
}

// ─── OPTIONS (safety for preflight requests) ───
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// ─── POST /api/admin/service-records ───
export async function POST(req: Request) {
  try {
    const admin = getAdmin();

    // 1️⃣ Extract & validate token
    const token = extractBearerToken(req);
    if (!token) {
      console.warn('[service-records] 401 — No Authorization header provided');
      return NextResponse.json(
        { error: 'Unauthorized', reason: 'missing_token' },
        { status: 401 }
      );
    }

    // 2️⃣ Verify token with Supabase
    const { data: userData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !userData?.user) {
      console.warn(
        '[service-records] 401 — Invalid token:',
        authErr?.message || 'no user returned'
      );
      return NextResponse.json(
        { error: 'Unauthorized', reason: 'invalid_token', detail: authErr?.message },
        { status: 401 }
      );
    }

    // 3️⃣ Admin check (profiles.role OR hardcoded super-admin email)
    const email = (userData.user.email || '').toLowerCase();
    const { data: me, error: profErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profErr) {
      console.error('[service-records] Profile lookup failed:', profErr.message);
    }

    const isAdmin =
      me?.role?.toLowerCase() === 'admin' ||
      email === 'legalntech@gmail.com';

    if (!isAdmin) {
      console.warn(
        `[service-records] 403 — User ${email} is not admin (role=${me?.role ?? 'null'})`
      );
      return NextResponse.json(
        { error: 'Forbidden', reason: 'not_admin' },
        { status: 403 }
      );
    }

    // 4️⃣ Parse & sanitize input
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const rawIds = body?.userIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Only strings, dedupe
    const userIds: string[] = Array.from(
      new Set(rawIds.filter((x: any) => typeof x === 'string' && x.length > 0))
    );

    if (userIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 5️⃣ Fetch service_records with pagination (bypasses 1000-row limit)
    const all: any[] = [];

    for (let i = 0; i < userIds.length; i += ID_CHUNK) {
      const ids = userIds.slice(i, i + ID_CHUNK);
      let from = 0;

      // Safety cap: max 50 pages per chunk (50,000 rows) to avoid infinite loop
      for (let page = 0; page < 50; page++) {
        const { data, error } = await admin
          .from('service_records')
          .select('*')
          .in('user_id', ids)
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error('[service-records] DB error:', error.message);
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }

        const chunk = data || [];
        all.push(...chunk);

        if (chunk.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
    }

    return NextResponse.json({ data: all });
  } catch (e: any) {
    console.error('[service-records] Unhandled error:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}