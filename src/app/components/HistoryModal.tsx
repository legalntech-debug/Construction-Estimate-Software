"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { X } from "lucide-react";

export default function HistoryModal({ refNo, onClose }: { refNo: string, onClose: () => void }) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    async function fetchHistory() {
      const { data } = await supabase
        .from('estimate_history')
        .select('*')
        .eq('ref_no', refNo)
        .order('created_at', { ascending: false });
      setHistory(data || []);
    }

    fetchHistory();

    // REALTIME SUBSCRIPTION
    const channel = supabase
      .channel('history-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'estimate_history', filter: `ref_no=eq.${refNo}` },
        (payload) => {
          setHistory((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refNo]);

  // ... baaki return code same rahega

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
      <div className="bg-white w-[600px] p-6 rounded-lg shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-black uppercase">History Log: {refNo}</h2>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
         
{history.length === 0 ? <p className="text-xs text-center">No edits found.</p> : (
  history.map((h, i) => (
    <div key={i} className="border-b py-2 text-[10px] space-y-1">
      <p><b>Date:</b> {new Date(h.created_at).toLocaleString()}</p>
      <p><b>Action:</b> {h.action_type}</p>
      <div className="bg-slate-50 p-2 rounded border">
        <b>Changes:</b>
        <pre className="whitespace-pre-wrap font-mono mt-1">
          {JSON.stringify(h.changes, null, 2)}
        </pre>
      </div>
    </div>
  ))
)}
        </div>
      </div>
    </div>
  );
}