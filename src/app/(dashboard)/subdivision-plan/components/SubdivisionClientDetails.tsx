"use client";

import React, { useEffect, useState } from "react";

/* =========================================================
   SUBDIVISION CLIENT DETAILS
   Drop-in replacement for <ClientDetailsSection /> on the
   subdivision input page (same props).
   CLIENT NAME and REPRESENTATIVE are optional, so they are
   hidden by default. An eye button shows / hides them and the
   choice is remembered in the browser.
========================================================= */

const CLIENT_FIELDS_PREF_KEY = "subdivisionShowClientFields";

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <line x1="3" y1="3" x2="21" y2="21" />}
  </svg>
);

interface SubdivisionClientDetailsProps {
  caseType: string;
  setCaseType: (v: string) => void;
  feeMode: "AUTO" | "MANUAL";
  setFeeMode: (v: "AUTO" | "MANUAL") => void;
  setManualFee: (v: number) => void;
  selectedClientName: string;
  handleClientChange: (name: string) => void;
  clients: any[];
  representative: string;
  setRepresentative: (v: string) => void;
  filteredReps: string[];
  customerName: string;
  setCustomerName: (v: string) => void;
  propertyAddress: string;
  setPropertyAddress: (v: string) => void;
}

export default function SubdivisionClientDetails({
  caseType,
  setCaseType,
  feeMode,
  setFeeMode,
  setManualFee,
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
}: SubdivisionClientDetailsProps) {
  // Hidden by default; the saved preference is applied after mount (SSR safe)
  const [showClientFields, setShowClientFields] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CLIENT_FIELDS_PREF_KEY) === "1") setShowClientFields(true);
    } catch {}
  }, []);

  const toggleClientFields = () => {
    const next = !showClientFields;
    setShowClientFields(next);
    try { localStorage.setItem(CLIENT_FIELDS_PREF_KEY, next ? "1" : "0"); } catch {}
  };

  const clientNames = Array.from(new Set((clients || []).map((c: any) => c?.client_name).filter(Boolean))) as string[];
  const inputBase = "w-full border border-black p-2 text-sm sm:text-lg font-bold text-center bg-white";

  return (
    <div className="mb-4">
      <style>{`
        @keyframes sdvReveal { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        @keyframes sdvBlink { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.1); } }
        .sdv-reveal { animation: sdvReveal 0.25s ease-out both; }
        .sdv-eye-btn:hover svg { animation: sdvBlink 0.45s ease-in-out; }
        @media (prefers-reduced-motion: reduce) { .sdv-reveal, .sdv-eye-btn:hover svg { animation: none; } }
      `}</style>

      <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 sm:gap-4 pb-3 border-b border-black">
        <div className="col-span-1 sm:col-span-2">
          <label className="font-bold block text-xs sm:text-lg">CASE TYPE</label>
          <select value={caseType} onChange={(e) => setCaseType(e.target.value)} className={inputBase}>
            <option value={caseType}>{caseType}</option>
          </select>
        </div>

        <div className="col-span-1">
          <label className="font-bold block text-xs sm:text-lg">FEE</label>
          <select value={feeMode} onChange={(e) => setFeeMode(e.target.value as "AUTO" | "MANUAL")} className={inputBase}>
            <option value="AUTO">AUTO</option>
            <option value="MANUAL">MANUAL</option>
          </select>
        </div>

        {feeMode === "MANUAL" && (
          <div className="col-span-2 sm:col-span-1">
            <label className="font-bold block text-xs sm:text-lg">AMOUNT</label>
            <input type="number" min={0} onChange={(e) => setManualFee(Number(e.target.value) || 0)} className={inputBase} />
          </div>
        )}

        {showClientFields ? (
          <>
            <div className="sdv-reveal col-span-1 sm:col-span-2">
              <label className="font-bold block text-xs sm:text-lg">CLIENT NAME</label>
              <input
                list="sdv-clients-list"
                value={selectedClientName}
                onChange={(e) => handleClientChange(e.target.value.toUpperCase())}
                className={`${inputBase} uppercase`}
              />
              <datalist id="sdv-clients-list">
                {clientNames.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div className="sdv-reveal col-span-1 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="font-bold block text-xs sm:text-lg">REPRESENTATIVE</label>
                <button
                  type="button"
                  onClick={toggleClientFields}
                  title="Hide Client Name & Representative"
                  aria-label="Hide Client Name and Representative"
                  className="sdv-eye-btn p-1 border border-black bg-white hover:bg-black hover:text-white transition-colors"
                >
                  <EyeIcon off />
                </button>
              </div>
              <input
                list="sdv-reps-list"
                value={representative}
                onChange={(e) => setRepresentative(e.target.value.toUpperCase())}
                className={`${inputBase} uppercase`}
              />
              <datalist id="sdv-reps-list">
                {(filteredReps || []).map((r, i) => <option key={i} value={r} />)}
              </datalist>
            </div>
          </>
        ) : (
          <div className="col-span-2 sm:col-span-3 flex items-end">
            <button
              type="button"
              onClick={toggleClientFields}
              title="Show Client Name & Representative"
              aria-label="Show Client Name and Representative"
              className="sdv-eye-btn w-full h-[38px] sm:h-[50px] flex items-center justify-center gap-2 px-2 border-2 border-dashed border-black bg-white text-xs sm:text-base font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors"
            >
              <EyeIcon off={false} />
              <span className="truncate">
                {selectedClientName.trim()
                  ? `CLIENT: ${selectedClientName}${representative.trim() ? " · " + representative : ""}`
                  : "SHOW CLIENT & REPRESENTATIVE"}
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-3 mt-3 items-stretch">
        <div className="border border-black p-3 font-black text-sm sm:text-lg flex items-center bg-gray-50">CUSTOMER NAME</div>
        <textarea
          rows={2}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
          className="w-full border border-black p-3 text-sm sm:text-lg font-bold uppercase resize-y"
        />
        <div className="border border-black p-3 font-black text-sm sm:text-lg flex items-center bg-gray-50">PROPERTY ADDRESS</div>
        <textarea
          rows={3}
          value={propertyAddress}
          onChange={(e) => setPropertyAddress(e.target.value.toUpperCase())}
          className="w-full border border-black p-3 text-sm sm:text-lg font-bold uppercase resize-y"
        />
      </div>
    </div>
  );
}
