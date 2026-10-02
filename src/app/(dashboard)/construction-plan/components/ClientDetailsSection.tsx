import React from "react";

interface ClientDetailsSectionProps {
  caseType: string;
  setCaseType: (val: string) => void;
  feeMode: "AUTO" | "MANUAL";
  setFeeMode: (val: "AUTO" | "MANUAL") => void;
  setManualFee: (val: number) => void;
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
  return (
    <>
      {/* Top Fields Grid - 2 Columns on Mobile, 7-Cols on Desktop */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3 md:gap-4 mb-4 border-b border-black pb-4">
        <div className="col-span-1 md:col-span-2">
          <label className="font-bold block text-[10pt] md:text-[12pt]">CASE TYPE</label>
          <select 
            value={caseType} 
            onChange={(e) => setCaseType(e.target.value)}
            className="w-full border border-black p-2 md:p-1 uppercase text-center bg-white text-xs md:text-sm cursor-pointer"
          >
            <option>CONSTRUCTION PLAN</option>
            <option>NEW CONSTRUCTION</option>
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
          {feeMode === "MANUAL" && (
            <input 
              type="number" 
              placeholder="ENTER FEE" 
              className="w-full border border-black p-2 md:p-1 mt-1 text-center bg-white text-xs md:text-sm" 
              onChange={(e) => setManualFee(Number(e.target.value))} 
            />
          )}
        </div>
        
        <div className="col-span-1 md:col-span-2">
          <label className="font-bold block text-[10pt] md:text-[12pt]">CLIENT NAME</label>
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
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="font-bold block text-[10pt] md:text-[12pt]">REPRESENTATIVE</label>
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
        </div>
      </div>

      {/* Customer Name & Property Address Fields */}
      <div className="mb-4 space-y-3 md:space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-1 md:gap-4">
          <label className="col-span-1 md:col-span-3 font-bold text-[11pt] md:text-[12pt] border border-black p-2 bg-gray-100">CUSTOMER NAME</label>
          <textarea 
            value={customerName} 
            onChange={(e) => setCustomerName(e.target.value)} 
            className="col-span-1 md:col-span-9 border border-black p-2 uppercase text-left text-base md:text-lg bg-white" 
            rows={1} 
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-1 md:gap-4">
          <label className="col-span-1 md:col-span-3 font-bold text-[11pt] md:text-[12pt] border border-black p-2 bg-gray-100">PROPERTY ADDRESS</label>
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