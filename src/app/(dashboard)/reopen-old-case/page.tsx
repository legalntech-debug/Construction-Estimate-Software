"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FolderOpen, History, RotateCcw } from "lucide-react";
import HistoryModal from "../../components/HistoryModal";

export default function ReopenOldCase() {
  const [cases, setCases] = useState<any[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchCases = async () => {
      // 1. Current logged-in user ki auth details nikalenge
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 2. profiles table se check karenge ki is user ka role kya hai
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const userRole = (profile?.role || "").toLowerCase();
      const isAdmin = userRole === "admin";

      if (isAdmin) {
        // 3A. Agar user ka role 'admin' hai, toh bina kisi restriction ke sabhi ke records fetch honge
        const { data, error } = await supabase
          .from('mis_records')
          .select('*')
          .order('created_date', { ascending: true });

        if (error) {
          console.error("Admin data error:", error);
        } else {
          setCases(data || []);
        }
      } else {
        // 3B. Agar normal user hai, toh sirf uske khud ke linked cases dikhenge
        const { data, error } = await supabase
          .from('mis_records')
          .select(`
            *,
            estimates!inner(user_id)
          `)
          .eq('estimates.user_id', user.id)
          .order('created_date', { ascending: true });

        if (error) {
          console.error("Security violation block or data error:", error);
        } else {
          setCases(data || []);
        }
      }
    };
    fetchCases();
  }, []);
  

  const handleReopen = (record: any) => {
  const isPaidAlready = (record.status || "").toUpperCase() === "RECEIVED";

  // UUID validation check taaki database me invalid syntax error na aaye
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const validId = uuidRegex.test(record.id) ? record.id : null;

  const reopenData = {
    ref_no: record.ref_no,             // Purana Ref No yahan secure rahega
    id: validId,
    customer_name: record.customer_name,
    client_name: record.client_name,
    representative: record.representative,
    case_type: record.case_type,
    total_value: record.fee,
    property_address: record.property_address || "",
    plot_area: record.plot_area || "",
    property_type: record.property_type || "HOUSE", 
    floor_details: typeof record.floor_details === 'string' ? JSON.parse(record.floor_details || '{}') : record.floor_details,
    rate_per_sqft: record.rate_per_sqft,
    isAlreadyPaid: isPaidAlready,
    isReopenedCase: true               // 👈 Yeh flag bataega ki yeh naya nahi balki reopen case hai
  };

  // Sabhi purani localstorage keys clean karein taaki overlap na ho
  localStorage.removeItem("estimateData");
  localStorage.removeItem("renovationEstimateData");
  localStorage.removeItem("estimatePreview");
  localStorage.removeItem("renovationEstimatePreview");
  localStorage.removeItem("RenovationEstimatePreview");

  const caseType = (record.case_type || "").trim().toUpperCase();

  if (caseType === "RENOVATION" || caseType.includes("RENOVATION")) {
    // 1. Agar Renovation hai -> Sirf Renovation ke INPUT form par bhejein
    localStorage.setItem("renovationEstimateData", JSON.stringify(reopenData));
    router.push("/renovation-estimate");
  } else {
    // 2. Agar New Construction hai -> Sirf New Construction ke INPUT form par bhejein
    localStorage.setItem("estimateData", JSON.stringify(reopenData));
    router.push("/estimate");
  }
};
  
  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 bg-white p-4 rounded-lg border-l-4 border-blue-950 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-800 uppercase tracking-wider">Reopen Old Case</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manage archived records and retrieval logs</p>
        </div>
        <FolderOpen className="text-blue-950" size={24} />
      </div>
      
      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-visible">
        <table className="w-full border-collapse table-fixed">
          <thead className="bg-blue-950 text-white text-[10px] uppercase font-black">
            <tr>
              <th className="p-4 w-[60px] text-center border-r border-blue-800">SR. NO</th>
              <th className="p-4 w-[220px] text-left border-r border-blue-800">REF NO</th>
              <th className="p-4 w-[100px] text-center border-r border-blue-800">DATE</th>
              <th className="p-4 text-left border-r border-blue-800">CUSTOMER NAME</th>
              <th className="p-4 text-center border-r border-blue-800">CLIENT NAME</th>
              <th className="p-4 text-center border-r border-blue-800">REPRESENTATIVE</th>
              <th className="p-4 text-center border-r border-blue-800">CASE TYPE</th>
              <th className="p-4 w-[120px] text-center">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px] font-bold text-slate-600">
            {cases.map((row, index) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 text-center">{index + 1}</td>
                <td className="p-4 text-blue-700 font-mono truncate">{row.ref_no}</td>
                <td className="p-4 text-center">{new Date(row.created_date).toLocaleDateString()}</td>
                <td className="p-4 truncate">{row.customer_name}</td>
                <td className="p-4 text-center">{row.client_name || "N/A"}</td>
                <td className="p-4 text-center">{row.representative || "N/A"}</td>
                <td className="p-4 text-center">{row.case_type}</td>
                
                <td className="p-2 text-center relative">
                  <button 
                    onClick={() => setActiveMenuId(activeMenuId === row.id ? null : row.id)}
                    className="bg-blue-950 text-white px-4 py-1.5 rounded-full text-[9px] font-bold uppercase hover:bg-slate-800 transition-all flex items-center gap-1 mx-auto"
                  >
                    Action ▼
                  </button>
                  
                  {activeMenuId === row.id && (
                    <div className="absolute right-0 mt-2 w-36 bg-white border border-slate-200 shadow-2xl rounded-lg z-[9999] overflow-hidden">
                      <button onClick={() => handleReopen(row)} className="flex items-center gap-2 w-full px-4 py-2 hover:bg-slate-50 text-left text-[10px] font-bold text-slate-700 border-b">
                        <RotateCcw size={12} /> REOPEN CASE
                      </button>
                      <button 
                        onClick={() => { setShowHistory(row.ref_no); setActiveMenuId(null); }} 
                        className="flex items-center gap-2 w-full px-4 py-2 hover:bg-slate-50 text-left text-[10px] font-bold text-slate-700"
                      >
                        <History size={12} /> HISTORY
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal is placed outside table container for proper overlay */}
      {showHistory && (
        <HistoryModal refNo={showHistory} onClose={() => setShowHistory(null)} />
      )}
    </div>
  );
}