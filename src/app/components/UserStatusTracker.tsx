'use client';
import { useEffect } from 'react';
// import { createClient } ... ki jagah ye use karein:
import { supabase } from "../../lib/supabase"; 

export default function UserStatusTracker({ userId }: { userId: string }) {
  useEffect(() => {
    // Ab 'supabase' object directly use hoga
    const updateStatus = async () => {
      await supabase.from('profiles')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', userId);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000);

    return () => clearInterval(interval);
  }, [userId]);

  return null;
}