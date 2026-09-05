import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Root URL (/) को सीधे /verify-estimate पर भेजें
  if (path === '/') {
    return NextResponse.redirect(new URL('/verify-estimate', request.url));
  }

  // 2. Protected Routes की जाँच करें
  const isDashboardRoute = path.startsWith('/dashboard');
  const isAdminRoute = path.startsWith('/admin-dashboard');

  // अगर रिक्वेस्ट Public Route (जैसे /signup, /login, /verify-estimate आदि) पर है, तो सीधा पास होने दें
  if (!isDashboardRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  // केवल Protect Dashboard Routes के लिए Supabase Auth चेक चलाएं
  let supabaseResponse = NextResponse.next({ request });

  // Environment Variables Availability Check
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
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

    const { data: { user } } = await supabase.auth.getUser();

    // Protect Admin Dashboard
    if (isAdminRoute) {
      if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      
      const { data: role } = await supabase.rpc('get_user_role', { target_user_id: user.id });
      if (role?.toLowerCase() !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // Protect User Dashboard
    if (isDashboardRoute && !user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } catch (error) {
    console.error('Middleware Auth Check Error:', error);
    // नेटवर्क एरर आने पर अनपेक्षित अटकाव रोकने के लिए रिस्पॉन्स पास करें
    return supabaseResponse;
  }

  return supabaseResponse;
}

// MATCHING CONFIGURATION (Statics, Next Internals & Assets Excluded)
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};