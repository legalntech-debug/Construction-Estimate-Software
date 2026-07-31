import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  cookies: {
    getAll() {
      if (typeof document === 'undefined') return [];
      return document.cookie.split(';').map(cookie => {
        const [name, value] = cookie.split('=');
        return { name: name.trim(), value: decodeURIComponent(value || '') };
      });
    },
    setAll(cookies) {
  if (typeof document === 'undefined') return;
  cookies.forEach(({ name, value, options }) => {
    let cookieString = `${name}=${encodeURIComponent(value)}; path=/;`;
    if (options?.maxAge) cookieString += ` max-age=${options.maxAge};`;
    if (options?.sameSite) cookieString += ` SameSite=${options.sameSite};`;
    if (options?.secure) cookieString += ` Secure;`; // Yeh line add karein
    document.cookie = cookieString;
  });
},
  },
})