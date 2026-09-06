import React from 'react';

interface RouteMapFormProps {
  commandInput: string;
  setCommandInput: (val: string) => void;
  handleCommandSubmit: (e: React.FormEvent) => void;
  caseType: string;
  setCaseType: (val: string) => void;
  fee: string;
  setFee: (val: string) => void;
  clientName: string;
  setClientName: (val: string) => void;
  representative: string;
  setRepresentative: (val: string) => void;
  customerName: string;
  setCustomerName: (val: string) => void;
  propertyAddress: string;
  setPropertyAddress: (val: string) => void;
  plotArea: string;
  setPlotArea: (val: string) => void;
  lat: string;
  setLat: (val: string) => void;
  lng: string;
  setLng: (val: string) => void;
  handleDownloadPDF: () => void;
}

export const RouteMapForm: React.FC<RouteMapFormProps> = ({
  commandInput, setCommandInput, handleCommandSubmit,
  caseType, setCaseType, fee, setFee, clientName, setClientName,
  representative, setRepresentative, customerName, setCustomerName,
  propertyAddress, setPropertyAddress, plotArea, setPlotArea,
  lat, setLat, lng, setLng, handleDownloadPDF
}) => {
  return (
    <div className="max-w-[1350px] mx-auto mb-2 bg-[#0b0f19] border-2 border-slate-700 p-3 rounded-lg shadow-2xl print:hidden space-y-2.5">
      
      {/* HEADER TITLE & PDF EXPORT */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h1 className="font-extrabold text-xs text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>🗺️</span> ROUTE MAP / LOCATION PLAN INPUT FORM
        </h1>
        <button 
          onClick={handleDownloadPDF} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1 rounded font-bold text-xs shadow-md transition-all flex items-center gap-1 cursor-pointer"
        >
          📥 Export PDF Route Map
        </button>
      </div>

      {/* COMMAND LINE UTILITY */}
      <form onSubmit={handleCommandSubmit} className="flex gap-2 items-center bg-[#020617] p-2 rounded border border-slate-800">
        <span className="font-mono text-cyan-400 font-bold text-xs">Command:</span>
        <input 
          type="text" 
          value={commandInput} 
          onChange={(e) => setCommandInput(e.target.value)} 
          placeholder="TYPE COMMAND (LINE, RECT, PLINE, HATCH, MOVE, ROTATE, ERASE)..." 
          className="w-full bg-transparent text-white font-mono text-xs focus:outline-none uppercase placeholder:text-slate-600"
        />
      </form>

      {/* ROW 1: CASE TYPE, FEE, CLIENT NAME, REPRESENTATIVE */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px]">
        <div>
          <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Case Type</label>
          <select 
            value={caseType} 
            onChange={(e) => setCaseType(e.target.value)}
            className="w-full bg-[#020617] border border-slate-800 rounded p-1.5 text-white font-semibold focus:border-cyan-500 focus:outline-none"
          >
            <option value="ROUTE MAP">ROUTE MAP / LOCATION PLAN</option>
            <option value="KEY PLAN">KEY PLAN</option>
          </select>
        </div>
        <div>
          <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Fee</label>
          <input 
            type="text" 
            value={fee} 
            onChange={(e) => setFee(e.target.value)} 
            className="w-full bg-[#020617] border border-slate-800 rounded p-1.5 text-white font-semibold focus:border-cyan-500 focus:outline-none" 
            placeholder="AUTO" 
          />
        </div>
        <div>
          <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Client Name</label>
          <input 
            type="text" 
            value={clientName} 
            onChange={(e) => setClientName(e.target.value)} 
            className="w-full bg-[#020617] border border-slate-800 rounded p-1.5 text-white uppercase font-semibold focus:border-cyan-500 focus:outline-none" 
            placeholder="SEARCH CLIENT..." 
          />
        </div>
        <div>
          <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Representative</label>
          <input 
            type="text" 
            value={representative} 
            onChange={(e) => setRepresentative(e.target.value)} 
            className="w-full bg-[#020617] border border-slate-800 rounded p-1.5 text-white uppercase font-semibold focus:border-cyan-500 focus:outline-none" 
            placeholder="SEARCH REP..." 
          />
        </div>
      </div>

      {/* ROW 2: CUSTOMER NAME & PLOT AREA */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px]">
        <div className="md:col-span-3">
          <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Customer Name (As Per Document)</label>
          <input 
            type="text" 
            value={customerName} 
            onChange={(e) => setCustomerName(e.target.value)} 
            className="w-full bg-[#020617] border border-slate-800 rounded p-1.5 text-white uppercase font-bold focus:border-cyan-500 focus:outline-none" 
          />
        </div>
        <div>
          <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Plot Area</label>
          <input 
            type="text" 
            value={plotArea} 
            onChange={(e) => setPlotArea(e.target.value)} 
            className="w-full bg-[#020617] border border-slate-800 rounded p-1.5 text-white font-bold focus:border-cyan-500 focus:outline-none" 
          />
        </div>
      </div>

      {/* ROW 3: PROPERTY ADDRESS & GEO COORDINATES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px]">
        <div className="md:col-span-2">
          <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Property Address</label>
          <textarea 
            value={propertyAddress} 
            onChange={(e) => setPropertyAddress(e.target.value)} 
            rows={2}
            className="w-full bg-[#020617] border border-slate-800 rounded p-1.5 text-white uppercase font-semibold resize-none text-[10px] focus:border-cyan-500 focus:outline-none" 
          />
        </div>
        <div className="md:col-span-2 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Latitude</label>
            <input 
              type="text" 
              value={lat} 
              onChange={(e) => setLat(e.target.value)} 
              className="w-full bg-[#020617] border border-slate-800 rounded p-1.5 text-white font-mono text-center font-semibold focus:border-cyan-500 focus:outline-none" 
              placeholder="Latitude" 
            />
          </div>
          <div>
            <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Longitude</label>
            <input 
              type="text" 
              value={lng} 
              onChange={(e) => setLng(e.target.value)} 
              className="w-full bg-[#020617] border border-slate-800 rounded p-1.5 text-white font-mono text-center font-semibold focus:border-cyan-500 focus:outline-none" 
              placeholder="Longitude" 
            />
          </div>
        </div>
      </div>

    </div>
  );
};