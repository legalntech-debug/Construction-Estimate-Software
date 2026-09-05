"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FolderOpen, History, RotateCcw, Search } from "lucide-react";
import HistoryModal from "../../components/HistoryModal";

export default function ReopenOldCase() {
  const [cases, setCases] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchCases = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const userRole = (profile?.role || "").toLowerCase();
      const isAdmin = userRole === "admin";

      let misData: any[] = [];
      let serviceData: any[] = [];

      if (isAdmin) {
        const { data: mis, error: misError } = await supabase
          .from('mis_records')
          .select('*')
          .order('created_date', { ascending: false });
        if (!misError) misData = mis || [];

        const { data: srv, error: srvError } = await supabase
          .from('service_records')
          .select('*')
          .order('created_at', { ascending: false });
        if (!srvError) serviceData = srv || [];
      } else {
        const { data: mis, error: misError } = await supabase
          .from('mis_records')
          .select(`
            *,
            estimates!inner(user_id)
          `)
          .eq('estimates.user_id', user.id)
          .order('created_date', { ascending: false });
        if (!misError) misData = mis || [];

        const { data: srv, error: srvError } = await supabase
          .from('service_records')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (!srvError) serviceData = srv || [];
      }

      // Normalize service_records (deed drafts)
      const normalizedServiceData = serviceData.map((item) => {
        // Buyer का नाम निकालने के लिए form_snapshot चेक करें
        const buyerName = item.form_snapshot?.buyers?.[0]?.name || item.customer_name || "Valued Client";
        return {
          id: item.id,
          ref_no: item.ref_no,
          created_date: item.created_at || item.created_date,
          customer_name: buyerName, // 👈 यहाँ Buyer का नाम दिखेगा
          client_name: item.client_name, // 👈 यहाँ बैंक/क्लाइंट का नाम दिखेगा (जैसे ICICI HFC)
          representative: item.representative,
          case_type: item.case_type || "DEED_DRAFT",
          fee: item.user_payment || item.fee_standard || 0,
          property_address: item.property_address,
          plot_area: item.plot_area,
          property_type: item.property_type,
          form_snapshot: item.form_snapshot,
          isDeedDraft: true
        };
      });

      const combined = [...misData, ...normalizedServiceData].sort((a, b) => {
        const dateA = new Date(a.created_date || a.created_at || 0).getTime();
        const dateB = new Date(b.created_date || b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setCases(combined);
    };
    fetchCases();
  }, []);

  const handleReopen = (record: any) => {
    // 1. Deed Draft Reopen Logic
    if (record.isDeedDraft || (record.case_type || "").toUpperCase().includes("DEED")) {
      if (record.form_snapshot) {
        // फॉर्म स्नैपशॉट को सीधे लोकल स्टोरेज में सेट करें ताकि इनपुट फील्ड्स भर जाएँ
        localStorage.setItem("deedDraftData", JSON.stringify(record.form_snapshot));
      } else {
        // यदि स्नैपशॉट नहीं है, तो बेसिक रिकॉर्ड डेटा से स्ट्रक्चर बनाकर भेजें
        const fallbackData = {
          refNo: record.ref_no,
          clientName: record.client_name,
          propertyAddress: record.property_address,
          plotArea: record.plot_area,
          buyers: [{ name: record.customer_name, details: "" }],
          stateName: record.state_name,
          cityName: record.city_district,
          deedType: record.deed_type || "SALE DEED",
          outputLanguage: record.output_language || "HINDI"
        };
        localStorage.setItem("deedDraftData", JSON.stringify(fallbackData));
      }
      router.push("/deed-drafting");
      return;
    }

    // 2. Existing Estimate Reopen Logic
    const isPaidAlready = (record.status || "").toUpperCase() === "RECEIVED";
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const validId = uuidRegex.test(record.id) ? record.id : null;

    const reopenData = {
      ref_no: record.ref_no,
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
      isReopenedCase: true
    };

    localStorage.removeItem("estimateData");
    localStorage.removeItem("renovationEstimateData");
    localStorage.removeItem("estimatePreview");
    localStorage.removeItem("renovationEstimatePreview");

    const caseType = (record.case_type || "").trim().toUpperCase();

    if (caseType === "RENOVATION" || caseType.includes("RENOVATION")) {
      localStorage.setItem("renovationEstimateData", JSON.stringify(reopenData));
      router.push("/renovation-estimate");
    } else {
      localStorage.setItem("estimateData", JSON.stringify(reopenData));
      router.push("/estimate");
    }
  };

  const filteredCases = cases.filter((row) => {
    const query = searchQuery.toLowerCase();
    const refNo = (row.ref_no || "").toLowerCase();
    const customer = (row.customer_name || "").toLowerCase();
    const client = (row.client_name || "").toLowerCase();
    const rep = (row.representative || "").toLowerCase();
    const dateStr = new Date(row.created_date).toLocaleDateString().toLowerCase();

    return (
      refNo.includes(query) ||
      customer.includes(query) ||
      client.includes(query) ||
      rep.includes(query) ||
      dateStr.includes(query)
    );
  });
  
  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen pb-24">
      {/* Header */}
      <div className="mb-4 bg-white p-4 rounded-lg border-l-4 border-blue-950 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-wider">Reopen Old Case</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Manage archived records & retrieval logs</p>
        </div>
        <FolderOpen className="text-blue-950 shrink-0" size={24} />
      </div>

      {/* Search Bar */}
      <div className="mb-4 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search size={16} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Ref No, Customer Name, Client, Rep or Date..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:border-blue-900 transition-all"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] font-bold text-slate-400 hover:text-slate-600"
          >
            CLEAR
          </button>
        )}
      </div>
      
      {/* MOBILE VIEW (CARDS) */}
      <div className="block md:hidden space-y-3">
        {filteredCases.length === 0 ? (
          <div className="bg-white p-6 text-center rounded-lg border border-slate-200 text-xs text-slate-400 font-bold">
            No matching records found.
          </div>
        ) : (
          filteredCases.map((row, index) => (
            <div key={row.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black bg-blue-100 text-blue-950 px-2 py-0.5 rounded">
                  #{index + 1}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {new Date(row.created_date).toLocaleDateString()}
                </span>
              </div>

              <div className="space-y-1 mb-3">
                <div className="text-xs font-mono font-bold text-blue-700 truncate">
                  {row.ref_no}
                </div>
                <div className="text-xs font-bold text-slate-800">
                  Customer: <span className="font-normal text-slate-600">{row.customer_name}</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  Client: <span className="font-semibold">{row.client_name || "N/A"}</span> | Rep: <span className="font-semibold">{row.representative || "N/A"}</span>
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-500 pt-1">
                  Type: <span className="bg-slate-100 px-2 py-0.5 rounded text-blue-900">{row.case_type}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleReopen(row)}
                  className="flex items-center gap-1.5 bg-blue-950 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase hover:bg-slate-800"
                >
                  <RotateCcw size={12} /> Reopen
                </button>
                <button
                  onClick={() => setShowHistory(row.ref_no)}
                  className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded text-[10px] font-bold uppercase hover:bg-slate-200 border border-slate-200"
                >
                  <History size={12} /> History
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP VIEW (TABLE) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-lg shadow-sm overflow-visible">
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
            {filteredCases.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                  No matching records found.
                </td>
              </tr>
            ) : (
              filteredCases.map((row, index) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* HistoryModal */}
      {showHistory && (
        <HistoryModal refNo={showHistory} onClose={() => setShowHistory(null)} />
      )}
    </div>
  );
}