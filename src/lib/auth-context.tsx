"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true); // Loading state taaki ui sync me rahe

  useEffect(() => {
    // Profiles table se details fetch karne wala core function
    const fetchProfileData = async (userId: string) => {
      try {
        // ✅ FIX: .single() ki jagah .maybeSingle() use kiya.
        // .single() tab error deta hai jab 0 rows milti hain (jaise signup ke
        // turant baad, jab auth user ban chuka hota hai lekin profiles table
        // me row abhi insert nahi hui hoti — ek race condition).
        // .maybeSingle() 0 rows par error nahi degi, sirf data: null degi.
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          // Ab yeh sirf actual DB/network errors ke liye chalega,
          // "no rows found" ke liye nahi.
          console.error("Error fetching profile details:", error.message);
          setCurrentUser(null);
        } else if (profile) {
          setCurrentUser(profile);
        } else {
          // Profile abhi tak create nahi hui (signup flow chal raha hai,
          // ya profile insert fail ho gaya). Yeh normal ho sakta hai,
          // isliye silently null rakho — error mat dikhao.
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    // 1. Initial Session Check jab page pehli baar load ho
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchProfileData(session.user.id);
      } else {
        setLoading(false);
      }
    };

    checkInitialSession();

    // 2. Real-time Auth State Change Listener (Login/Logout/Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchProfileData(session.user.id);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
