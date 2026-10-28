import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ✅ Dynamic Case Type → Client Table Column Mapping
const CASE_TYPE_FEE_MAP: Record<string, string> = {
  "NEW CONSTRUCTION": "plan_fee",
  "CONSTRUCTION PLAN": "plan_fee",
  "ESTIMATE": "estimate_fee",
  "ESTIMATE CASE": "estimate_fee",
  "RENOVATION": "estimate_fee",
  "ROUTE MAP": "route_map_fee",
  "DEED DRAFTING": "drafting_fee",
  "DEED_DRAFT": "drafting_fee",
};

interface ClientDetailsSectionProps {
  caseType: string;
  setCaseType: (val: string) => void;
  feeMode: "AUTO" | "MANUAL";
  setFeeMode: (val: "AUTO" | "MANUAL") => void;
  setManualFee: (val: number) => void;
  /** current fee (reopen par MANUAL input me wahi dikhane ke liye) */
  manualFee?: number;
  selectedClientName: string;
  handleClientChange: (val: string) => void;
  clients: any[];
  representative: string;
  setRepresentative: (val: string) => void;
  filteredReps: string[];
  customerName: string;
  setCustomerName: (val: string) => void;
  propertyAddress: string;
  setPropertyAddress: (val: string) => void;
}

export default function ClientDetailsSection({
  caseType,
  setCaseType,
  feeMode,
  setFeeMode,
  setManualFee,
  manualFee,
  selectedClientName,
  handleClientChange,
  clients,
  representative,
  setRepresentative,
  filteredReps,
  customerName,
  setCustomerName,
  propertyAddress,
  setPropertyAddress,
}: ClientDetailsSectionProps) {
  const [showClientName, setShowClientName] = useState(true);
  const [showRepresentative, setShowRepresentative] = useState(true);
  const [autoFetchedFee, setAutoFetchedFee] = useState<number>(0);

  // ✅ DYNAMIC AUTO FEE FETCH — Client + Representative + CaseType
  useEffect(() => {
    if (feeMode !== "AUTO") return;

    const trimmedClient = (selectedClientName || "").trim();
    const trimmedRep = (representative || "").trim();

    if (!trimmedClient) {
      setAutoFetchedFee(0);
      setManualFee(0);
      return;
    }

    const fetchFeeFromClient = async () => {
      try {
        // ✅ Case type normalize
        const normalizedCaseType = String(caseType || "NEW CONSTRUCTION")
          .trim()
          .toUpperCase()
          .replace(/_/g, " ");

        const feeColumn =
          CASE_TYPE_FEE_MAP[normalizedCaseType] ||
          CASE_TYPE_FEE_MAP[String(caseType).trim().toUpperCase()] ||
          "estimate_fee";

        console.log("🔍 Auto-Fee → client:", trimmedClient, "| rep:", trimmedRep, "| column:", feeColumn);

        // ✅ STEP 1: Client + Representative DONO pe match karo
        let query = supabase
          .from("clients")
          .select("client_id, client_name, representative_name, estimate_fee, plan_fee, route_map_fee, drafting_fee")
          .ilike("client_name", trimmedClient);

        // ✅ Agar representative filled hai, to us pe bhi filter lagao
        if (trimmedRep) {
          query = query.ilike("representative_name", trimmedRep);
        }

        const { data, error } = await query.limit(1);

        if (error) {
          console.error("❌ Auto-Fee error:", error);
          setAutoFetchedFee(0);
          setManualFee(0);
          return;
        }

        // ✅ STEP 2: Agar rep-specific match nahi mila, fallback — sirf client pe match
        let clientRow = data && data.length > 0 ? data[0] : null;

        if (!clientRow) {
          console.log("⚠️ Auto-Fee: Rep-specific match not found, trying client-only fallback...");
          const { data: fallbackData } = await supabase
            .from("clients")
            .select("client_id, client_name, representative_name, estimate_fee, plan_fee, route_map_fee, drafting_fee")
            .ilike("client_name", trimmedClient)
            .limit(1);

          clientRow = fallbackData && fallbackData.length > 0 ? fallbackData[0] : null;
        }

        if (!clientRow) {
          console.warn("❌ Auto-Fee: No client found for:", trimmedClient);
          setAutoFetchedFee(0);
          setManualFee(0);
          return;
        }

        console.log("✅ Auto-Fee matched row:", clientRow);

        const rawFee = clientRow[feeColumn as keyof typeof clientRow];
        const feeValue = Number(rawFee ?? 0);

        console.log("✅ Auto-Fee → final value:", feeValue);

        setAutoFetchedFee(feeValue);
        setManualFee(feeValue);
      } catch (err) {
        console.error("❌ Auto-Fee exception:", err);
        setAutoFetchedFee(0);
        setManualFee(0);
      }
    };

    // ✅ Debounce 400ms
    const timeoutId = setTimeout(fetchFeeFromClient, 400);
    return () => clearTimeout(timeoutId);
  }, [feeMode, selectedClientName, representative, caseType, setManualFee]);

  return (
    <>
      {/* Top Fields Grid */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3 md:gap-4 mb-4 border-b border-black pb-4">
        <div className="col-span-1 md:col-span-2">
          <label className="font-bold block text-[10pt] md:text-[12pt]">CASE TYPE</label>
          <select
            value={caseType}
            onChange={(e) => setCaseType(e.target.value)}
            className="w-full border border-black p-2 md:p-1 uppercase text-center bg-white text-xs md:text-sm cursor-pointer"
          >
            <option>CONSTRUCTION PLAN</option>
          </select>
        </div>

        <div className="col-span-1 md:col-span-1">
          <label className="font-bold block text-[10pt] md:text-[12pt]">FEE</label>
          <select
            className="w-full border border-black p-2 md:p-1 uppercase text-center bg-white text-xs md:text-sm cursor-pointer"
            value={feeMode}
            onChange={(e) => setFeeMode(e.target.value as "AUTO" | "MANUAL")}
          >
            <option value="AUTO">AUTO</option>
            <option value="MANUAL">MANUAL</option>
          </select>

          {feeMode === "AUTO" && (
            <input
              type="number"
              value={autoFetchedFee}
              readOnly
              className="w-full border border-black p-2 md:p-1 mt-1 text-center bg-gray-100 text-xs md:text-sm font-bold text-blue-700 cursor-not-allowed"
              title="Auto-fetched from client+representative based on case type"
            />
          )}

          {feeMode === "MANUAL" && (
            <input
              type="number"
              placeholder="ENTER FEE"
              value={manualFee ? manualFee : ""}
              className="w-full border border-black p-2 md:p-1 mt-1 text-center bg-white text-xs md:text-sm"
              onChange={(e) => setManualFee(Number(e.target.value))}
            />
          )}
        </div>

        {/* CLIENT NAME */}
        <div className="col-span-1 md:col-span-2">
          <div className="flex justify-between items-center">
            <label className="font-bold block text-[10pt] md:text-[12pt]">CLIENT NAME</label>
            <button
              type="button"
              onClick={() => setShowClientName(!showClientName)}
              className="text-xs text-gray-500 hover:text-black"
              title={showClientName ? "Hide field" : "Show field"}
            >
              {showClientName ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          {showClientName && (
            <>
              <input
                list="clients-list"
                value={selectedClientName}
                onChange={(e) => handleClientChange(e.target.value)}
                className="w-full border border-black p-2 md:p-1 uppercase text-center bg-white text-xs md:text-sm"
                placeholder="SEARCH CLIENT..."
              />
              <datalist id="clients-list">
                {[...new Set(clients.map(c => c.client_name || c.name))].filter(Boolean).map((name: any, i) => (
                  <option key={i} value={name} />
                ))}
              </datalist>
            </>
          )}
        </div>

        {/* REPRESENTATIVE */}
        <div className="col-span-1 md:col-span-2">
          <div className="flex justify-between items-center">
            <label className="font-bold block text-[10pt] md:text-[12pt]">REPRESENTATIVE</label>
            <button
              type="button"
              onClick={() => setShowRepresentative(!showRepresentative)}
              className="text-xs text-gray-500 hover:text-black"
              title={showRepresentative ? "Hide field" : "Show field"}
            >
              {showRepresentative ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          {showRepresentative && (
            <>
              <input
                list="reps-list"
                value={representative}
                onChange={(e) => setRepresentative(e.target.value)}
                className="w-full border border-black p-2 md:p-1 uppercase text-center bg-white text-xs md:text-sm"
                placeholder="SEARCH REP..."
              />
              <datalist id="reps-list">
                {filteredReps.filter(Boolean).map((rep, i) => (
                  <option key={i} value={rep} />
                ))}
              </datalist>
            </>
          )}
        </div>
      </div>

      {/* CUSTOMER NAME & PROPERTY ADDRESS */}
      <div className="mb-4 space-y-3 md:space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-1 md:gap-4">
          <label className="col-span-1 md:col-span-3 font-bold text-[11pt] md:text-[12pt] border border-black p-2 bg-gray-100">
            CUSTOMER NAME
          </label>
          <textarea
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="col-span-1 md:col-span-9 border border-black p-2 uppercase text-left text-base md:text-lg bg-white"
            rows={1}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-1 md:gap-4">
          <label className="col-span-1 md:col-span-3 font-bold text-[11pt] md:text-[12pt] border border-black p-2 bg-gray-100">
            PROPERTY ADDRESS
          </label>
          <textarea
            value={propertyAddress}
            onChange={(e) => setPropertyAddress(e.target.value)}
            className="col-span-1 md:col-span-9 border border-black p-2 uppercase text-left text-base md:text-lg bg-white"
            rows={2}
          />
        </div>
      </div>
    </>
  );
}