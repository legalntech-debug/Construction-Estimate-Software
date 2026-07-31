"use client";
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Component ko memoize karein ya ensure karein ki ye sirf client side par chale
export default function SystemAlerts({ type, message }: { type: string, message: string }) {
  useEffect(() => {
    // Supabase channel setup
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mis_records' }, (payload) => {
        const amount = Number(payload.new.fee_standard);
        if (amount > 500000) {
          alert(`⚠️ HIGH VALUE: ₹${amount.toLocaleString()}`);
        }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className={`px-4 py-1 rounded-full text-xs font-bold ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
      {message}
    </div>
  );
}