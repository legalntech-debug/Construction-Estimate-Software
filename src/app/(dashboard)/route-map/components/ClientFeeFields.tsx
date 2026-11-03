"use client";
// Case type, fee, client name and representative row of the input form.
import { ROUTE_MAP_TYPE } from "../formConstants";
import EyeIcon from "./EyeIcon";

interface ClientFeeFieldsProps {
  feeMode: string;
  setFeeMode: (value: string) => void;
  manualFee: number;
  setManualFee: (value: number) => void;
  showClientFields: boolean;
  toggleClientFields: () => void;
  clients: any[];
  selectedClientName: string;
  handleClientChange: (name: string) => void;
  representative: string;
  setRepresentative: (value: string) => void;
  filteredReps: string[];
}

export default function ClientFeeFields({
  feeMode, setFeeMode, manualFee, setManualFee, showClientFields, toggleClientFields, clients,
  selectedClientName, handleClientChange, representative, setRepresentative, filteredReps,
}: ClientFeeFieldsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 sm:gap-4 mb-4 border-b border-black pb-4">
          <div className="col-span-1 sm:col-span-2">
            <label className="font-bold block text-xs sm:text-lg">CASE TYPE</label>
            <select className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg bg-white">
              <option>{ROUTE_MAP_TYPE}</option>
            </select>
          </div>
          <div className="col-span-1 sm:col-span-1">
            <label className="font-bold block text-xs sm:text-lg">FEE</label>
            <select className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg bg-white" value={feeMode} onChange={(e) => setFeeMode(e.target.value)}>
              <option value="AUTO">AUTO</option>
              <option value="MANUAL">MANUAL</option>
            </select>
            {feeMode === "MANUAL" && (
              <input type="number" placeholder="ENTER FEE" value={manualFee || ""} className="w-full border border-black p-1.5 mt-1 text-center text-xs sm:text-lg" onChange={(e) => setManualFee(Number(e.target.value))} />
            )}
          </div>
          {showClientFields ? (<>
          <div className="rm-reveal col-span-1 sm:col-span-2">
            <label className="font-bold block text-xs sm:text-lg">CLIENT NAME</label>
            <input list="clients-list" value={selectedClientName} onChange={(e) => handleClientChange(e.target.value)} className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg" placeholder="SEARCH CLIENT..." />
            <datalist id="clients-list">{[...new Set(clients.map(c => c.client_name))].map((name, i) => <option key={i} value={name} />)}</datalist>
          </div>
          <div className="rm-reveal col-span-1 sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="font-bold block text-xs sm:text-lg">REPRESENTATIVE</label>
              <button
                type="button"
                onClick={toggleClientFields}
                title="Hide Client Name & Representative"
                aria-label="Hide Client Name and Representative"
                className="rm-eye-btn p-1 border border-black bg-white hover:bg-black hover:text-white transition-colors"
              >
                <EyeIcon off />
              </button>
            </div>
            <input list="reps-list" value={representative} onChange={(e) => setRepresentative(e.target.value)} className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg" placeholder="SEARCH REP..." />
            <datalist id="reps-list">{filteredReps.map((rep, i) => <option key={i} value={rep} />)}</datalist>
          </div>
          </>) : (
          <div className="col-span-2 sm:col-span-4 flex items-end">
            <button
              type="button"
              onClick={toggleClientFields}
              title="Show Client Name & Representative"
              aria-label="Show Client Name and Representative"
              className="rm-eye-btn w-full h-[38px] sm:h-[50px] flex items-center justify-center gap-2 px-2 border-2 border-dashed border-black bg-white text-xs sm:text-base font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors"
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
  );
}
