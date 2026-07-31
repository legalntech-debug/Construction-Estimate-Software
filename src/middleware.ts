import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Securely fetch user from Supabase Auth server
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // 1. Protect Admin Dashboard (Requires login + admin role)
  if (path.startsWith('/admin-dashboard')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Check role from database
    const { data: role } = await supabase.rpc('get_user_role', { target_user_id: user.id });
    if (role?.toLowerCase() !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 2. Protect General User Dashboard (Requires login)
  if (path.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin-dashboard/:path*'],
};