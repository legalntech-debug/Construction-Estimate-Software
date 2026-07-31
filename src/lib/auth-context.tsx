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
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profile) {
          setCurrentUser(profile);
        } else if (error) {
          console.error("Error fetching profile details:", error.message);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
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