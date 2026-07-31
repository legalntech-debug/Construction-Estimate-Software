"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createWorker } from 'tesseract.js';

const DEFAULT_FLOORS = ["GROUND FLOOR"];
const EXTRA_FLOORS = [
  "BASEMENT", "FIRST FLOOR", "SECOND FLOOR", "TOWER", "THIRD FLOOR", 
  "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", 
  "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR"
];

export default function ExtensionEstimatePage() {
  const router = useRouter();

  const [clients, setClients] = useState<any[]>([]);
  const [representative, setRepresentative] = useState("");
  const [filteredReps, setFilteredReps] = useState<string[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [allRepresentatives, setAllRepresentatives] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [plotArea, setPlotArea] = useState("");
  
  const [selectedFloors, setSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [tempSelectedFloors, setTempSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  
  const [floorModes, setFloorModes] = useState<Record<string, string>>({
    "GROUND FLOOR": "BOTH"
  });
  const [tempFloorModes, setTempFloorModes] = useState<Record<string, string>>({
    "GROUND FLOOR": "BOTH"
  });

  const [floorData, setFloorData] = useState<Record<string, { 
    proposed: { length: number; width: number; area: number };
    existing: { length: number; width: number; area: number };
  }>>({});

  const [rate, setRate] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [feeMode, setFeeMode] = useState("AUTO");
  const [manualFee, setManualFee] = useState<number>(0);
  const [registeredFee, setRegisteredFee] = useState<number>(0);
  const [totalBuiltUpArea, setTotalBuiltUpArea] = useState(0);
  const caseType = "EXTENSION & RENOVATION";
  
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const savedData = localStorage.getItem("extensionEstimateData") || 
                      localStorage.getItem("extensionEstimatePreview");
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setCustomerName(parsedData.customer_name || "");
        setSelectedClientName(parsedData.client_name || "");
        setRepresentative(parsedData.representative || "");
        setPropertyAddress(parsedData.property_address || "");
        setPlotArea(parsedData.plot_area || "");
        
        const loadedRate = parsedData.rate_per_sqft || 0;
        setRate(loadedRate);

        if (parsedData.floor_details) setFloorData(parsedData.floor_details);
        if (parsedData.selected_floors) setSelectedFloors(parsedData.selected_floors);
        if (parsedData.floor_modes) {
          setFloorModes(parsedData.floor_modes);
          setTempFloorModes(parsedData.floor_modes);
        }

        let calculatedArea = 0;
        if (parsedData.floor_details) {
          calculatedArea = (Object.values(parsedData.floor_details) as any[]).reduce((sum: number, f: any) => {
            return sum + (f?.proposed?.area || 0) + (f?.existing?.area || 0);
          }, 0);
        }

        setTotalBuiltUpArea(calculatedArea);
        setAmount(loadedRate * calculatedArea);

      } catch (e) {
        console.error("Error parsing saved data", e);
      }
    }
  }, []);

  const navigateToPreview = () => {
    const estimateData = {
      customer_name: customerName,
      client_name: selectedClientName,
      representative: representative,
      property_address: propertyAddress,
      plot_area: plotArea,
      total_builtup_area: totalBuiltUpArea,
      rate_per_sqft: rate,
      construction_cost: amount,
      total_construction_cost: amount, 
      total_value: amount,            
      estimate_type: caseType,
      floor_details: floorData,      
      selected_floors: selectedFloors,
      floor_modes: floorModes,
      version_tag: "UPCOMING VERSION" // Added flag to indicate upcoming version on preview
     };
    
    localStorage.setItem("extensionEstimatePreview", JSON.stringify(estimateData));
    router.push("/extension-estimate-preview");
  };

  useEffect(() => {
    let newTotal = 0;
    Object.entries(floorData).forEach(([f, data]) => {
      const mode = floorModes[f] || "BOTH";
      if (mode === "PROPOSED" || mode === "BOTH") {
        newTotal += data?.proposed?.area || 0;
      }
      if (mode === "EXISTING" || mode === "BOTH") {
        newTotal += data?.existing?.area || 0;
      }
    });
    setTotalBuiltUpArea(newTotal);
  }, [floorData, floorModes, plotArea]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: clientsTable, error } = await supabase
        .from('clients')
        .select('client_name, representative_name');

      if (error) {
        console.error("Supabase Error:", error);
        return;
      }

      if (clientsTable) {
        setClients(clientsTable);
        const uniqueReps = Array.from(
          new Set(clientsTable.map((c: any) => c.representative_name).filter(Boolean))
        ) as string[];
        
        setAllRepresentatives(uniqueReps);
        setFilteredReps(uniqueReps);
      }
    };
    fetchData();
  }, []);

  const handleClientChange = (name: string) => {
    setSelectedClientName(name);
    const matches = clients.filter(c => c.client_name === name).map(c => c.representative_name);
    supabase.from('clients').select('estimate_fee').eq('client_name', name).maybeSingle()
      .then(({ data }) => setRegisteredFee(data?.estimate_fee || 0));
    if (matches.length > 0) {
      setFilteredReps([...new Set(matches)]);
      setRepresentative(matches.length === 1 ? matches[0] : "");
    } else {
      setFilteredReps(allRepresentatives);
      setRepresentative("");
    }
  };

  const updateFloorArea = (floor: string, type: 'proposed' | 'existing', l: number, w: number) => {
    const calculatedArea = parseFloat((l * w).toFixed(2));
    const plotNum = parseFloat(plotArea) || 0;

    if (plotNum > 0 && calculatedArea > plotNum) {
      alert(`Validation Error: ${type.toUpperCase()} area for ${floor} (${calculatedArea}) cannot exceed Plot Area (${plotNum})!`);
      return;
    }

    const currentFloorObj = floorData[floor] || {
      proposed: { length: 0, width: 0, area: 0 },
      existing: { length: 0, width: 0, area: 0 }
    };

    const updatedSubArea = { ...currentFloorObj[type], length: l, width: w, area: calculatedArea };

    const updatedFloorData = {
      ...floorData,
      [floor]: {
        ...currentFloorObj,
        [type]: updatedSubArea
      }
    };

    setFloorData(updatedFloorData);
  };

  const handleScanAndFill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      alert("Please upload an image file (JPG/PNG) of the document for scanning.");
      return;
    }

    setIsScanning(true);
    try {
      const worker = await createWorker('eng');
      const imageUrl = URL.createObjectURL(file);
      
      const ret = await worker.recognize(imageUrl);
      const rawText = ret.data.text;
      
      await worker.terminate();
      URL.revokeObjectURL(imageUrl);

      const cleanText = rawText.replace(/\s+/g, ' ').toUpperCase();
      setCustomerName(cleanText.slice(0, 40));
      setPropertyAddress(cleanText);

      const areaMatch = cleanText.match(/(\d+)\s*(SQFT|SQ\.FT|SQUARE FEET|GAJ|METER)/i);
      if (areaMatch) {
        setPlotArea(areaMatch[1]);
      } else {
        setPlotArea("400");
      }

      setIsScanning(false);
      alert("Document successfully scanned and dynamic details loaded!");
    } catch (err: any) {
      console.error("Scan Error:", err);
      setIsScanning(false);
      alert(`Error scanning document: ${err.message}`);
    }
  };

  const handleGenerate = async () => {
    if (!selectedClientName.trim() || !representative.trim()) {
      alert("Validation Error: Please select both Client Name and Representative.");
      return;
    }

    if (!customerName.trim() || !propertyAddress.trim() || rate <= 0) {
      alert("Validation Error: Please fill in Customer Name, Property Address, and a valid Rate.");
      return;
    }

    if (Object.keys(floorData).length === 0) {
      alert("Validation Error: Please fill at least one floor dimension.");
      return;
    }

    if (!plotArea || Number(plotArea) <= 0) {
      alert("Validation Error: Please enter a valid Plot Area.");
      return;
    }
    
    navigateToPreview();
  };  

  const handleClear = () => {
    localStorage.removeItem("extensionEstimatePreview");
    setFloorData({});
    setRate(0);
    setAmount(0);
    setCustomerName("");
    setPropertyAddress("");
    setPlotArea("");
    setSelectedClientName("");
    setRepresentative("");
    setSelectedFloors(DEFAULT_FLOORS);
    setFloorModes({ "GROUND FLOOR": "BOTH" });
    setTempFloorModes({ "GROUND FLOOR": "BOTH" });
    window.location.reload();
  };  

  return (
    <div className="p-6 font-sans uppercase text-lg text-black max-w-5xl mx-auto border border-black bg-white shadow-lg leading-tight">
      <div className="flex justify-between items-center border-2 border-black bg-gray-100 p-2 mb-2">
        <h1 className="text-2xl font-bold">
          EXTENSION & RENOVATION ESTIMATE INPUT FORM
        </h1>
        
        <label className={`cursor-pointer bg-blue-600 text-white px-4 py-2 text-sm font-bold uppercase rounded shadow hover:bg-blue-700 transition flex items-center gap-2 ${isScanning ? "opacity-50 pointer-events-none" : ""}`}>
          {isScanning ? "Scanning..." : "📄 Scan & Fill"}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleScanAndFill} />
        </label>
      </div>
      
      <div className="grid grid-cols-12 gap-2 mb-4 border-b border-black pb-4">
        <div className="col-span-4">
          <label className="font-bold block text-[11pt]">CASE TYPE</label>
          <input type="text" readOnly value={caseType} className="w-full border border-black p-1 uppercase text-center bg-gray-100 font-bold text-sm h-[38px]" />
        </div>
        <div className="col-span-2">
          <label className="font-bold block text-[11pt]">FEE</label>
          <select className="w-full border border-black p-1 uppercase text-center text-sm h-[38px]" value={feeMode} onChange={(e) => setFeeMode(e.target.value)}>
            <option value="AUTO">AUTO</option>
            <option value="MANUAL">MANUAL</option>
          </select>
          {feeMode === "MANUAL" && (
            <input type="number" placeholder="FEE" className="w-full border border-black p-1 mt-1 text-center text-sm" onChange={(e) => setManualFee(Number(e.target.value))} />
          )}
        </div>
        <div className="col-span-3">
          <label className="font-bold block text-[11pt]">CLIENT NAME</label>
          <input list="clients-list" value={selectedClientName} onChange={(e) => handleClientChange(e.target.value)} className="w-full border border-black p-1 uppercase text-center text-sm h-[38px]" placeholder="SEARCH CLIENT..." />
        </div>
        <div className="col-span-3">
          <label className="font-bold block text-[11pt]">REPRESENTATIVE</label>
          <input list="reps-list" value={representative} onChange={(e) => setRepresentative(e.target.value)} className="w-full border border-black p-1 uppercase text-center text-sm h-[38px]" placeholder="SEARCH REP..." />
        </div>
      </div>

      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-12 items-center gap-4">
          <label className="col-span-3 font-bold text-[12pt] border border-black p-2 bg-gray-100">CUSTOMER NAME</label>
          <textarea value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="col-span-9 border border-black p-2 uppercase text-left text-lg" rows={1} />
        </div>
        <div className="grid grid-cols-12 items-center gap-4">
          <label className="col-span-3 font-bold text-[12pt] border border-black p-2 bg-gray-100">PROPERTY ADDRESS</label>
          <textarea value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} className="col-span-9 border border-black p-2 uppercase text-left text-lg" rows={2} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 mb-6 border-b border-black pb-4 items-center">
        <div className="col-span-5">
          <label className="font-bold block text-[12pt]">PLOT AREA</label>
          <div className="flex items-center border border-black bg-white h-[38px]">
            <input 
              type="number" 
              placeholder="0.00" 
              value={plotArea} 
              onChange={(e) => setPlotArea(e.target.value)} 
              className="w-full border-none p-1 uppercase text-center text-xl focus:outline-none" 
            />
            <span className="bg-gray-100 px-3 py-1 font-bold text-sm border-l border-black text-gray-700 whitespace-nowrap">SQ.FT</span>
          </div>
        </div>
        
        <div className="col-span-7">
          <div className="flex justify-between items-center mb-1">
            <label className="font-bold text-[12pt]">SELECT FLOORS</label>
            <div className="flex items-center gap-4 text-xs font-bold text-purple-700">
              <span className="bg-purple-100 px-2 py-0.5 border border-purple-300">PROPOSED</span>
              <span className="bg-orange-100 px-2 py-0.5 border border-orange-300 text-orange-800">EXISTING</span>
            </div>
          </div>
          <button onClick={() => { 
            setTempSelectedFloors(selectedFloors); 
            setTempFloorModes(floorModes);
            setIsFloorModalOpen(true); 
          }} className="w-full border border-black py-1 font-bold text-[10pt] bg-gray-100 h-[38px]">
            + ADD / CHOOSE FLOOR
          </button>
        </div>
      </div>

      <div className="mt-4 border border-black rounded-none overflow-hidden space-y-2">
        <div className="bg-[#1e293b] text-white py-2 font-bold uppercase tracking-wider text-center text-[12pt]">BUILT UP AREA DETAILS (PROPOSED & EXISTING)</div>
        
        {["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"]
          .filter(f => selectedFloors.includes(f))
          .map((f) => {
            const floorObj = floorData[f] || {
              proposed: { length: 0, width: 0, area: 0 },
              existing: { length: 0, width: 0, area: 0 }
            };

            const currentMode = floorModes[f] || "BOTH";

            return (
              <div key={f} className="border-b-2 border-black p-2 bg-gray-50">
                <div className="font-bold text-md text-center bg-gray-200 border border-black py-1 mb-2 flex justify-between px-4 items-center">
                  <span>{f}</span>
                  <span className="text-xs bg-white px-2 py-0.5 border border-black font-normal">
                    {currentMode === "BOTH" ? "PROPOSED & EXISTING" : currentMode === "PROPOSED" ? "PROPOSED ONLY" : "EXISTING ONLY"}
                  </span>
                </div>
                
                {(currentMode === "BOTH" || currentMode === "PROPOSED") && (
                  <div className="grid grid-cols-12 items-center border border-black mb-1 bg-white">
                    <span className="col-span-3 font-bold text-black uppercase text-[11pt] p-2 text-center border-r border-black bg-purple-50">PROPOSED</span>
                    <div className="col-span-5 grid grid-cols-2 gap-0 border-r border-black">
                      <input type="number" placeholder="W" value={floorObj?.proposed?.width || ""} className="w-full text-center border-none p-1" onChange={(e) => updateFloorArea(f, 'proposed', floorObj?.proposed?.length || 0, parseFloat(e.target.value) || 0)} />
                      <input type="number" placeholder="L" value={floorObj?.proposed?.length || ""} className="w-full text-center border-none border-l border-black p-1" onChange={(e) => updateFloorArea(f, 'proposed', parseFloat(e.target.value) || 0, floorObj?.proposed?.width || 0)} />
                    </div>
                    <input type="text" readOnly value={`${floorObj?.proposed?.area || 0} SQ.FT`} className="col-span-4 p-2 text-center font-bold bg-gray-100" />
                  </div>
                )}

                {(currentMode === "BOTH" || currentMode === "EXISTING") && (
                  <div className="grid grid-cols-12 items-center border border-black bg-white">
                    <span className="col-span-3 font-bold text-black uppercase text-[11pt] p-2 text-center border-r border-black bg-orange-50">EXISTING</span>
                    <div className="col-span-5 grid grid-cols-2 gap-0 border-r border-black">
                      <input type="number" placeholder="W" value={floorObj?.existing?.width || ""} className="w-full text-center border-none p-1" onChange={(e) => updateFloorArea(f, 'existing', floorObj?.existing?.length || 0, parseFloat(e.target.value) || 0)} />
                      <input type="number" placeholder="L" value={floorObj?.existing?.length || ""} className="w-full text-center border-none border-l border-black p-1" onChange={(e) => updateFloorArea(f, 'existing', parseFloat(e.target.value) || 0, floorObj?.existing?.width || 0)} />
                    </div>
                    <input type="text" readOnly value={`${floorObj?.existing?.area || 0} SQ.FT`} className="col-span-4 p-2 text-center font-bold bg-gray-100" />
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <div className="grid grid-cols-5 mb-3 mt-4 items-center">
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">TOTAL AREA</label>
          <input type="text" readOnly value={`${totalBuiltUpArea} SQ.FT`} className="w-full border border-black p-1 text-center bg-gray-100 font-bold" />
        </div>
        <div className="text-center font-bold text-lg">X</div>
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">RATE / SQ.FT</label>
          <input type="number" value={rate || ""} onChange={(e) => { const r = parseFloat(e.target.value) || 0; setRate(r); setAmount(parseFloat((r * totalBuiltUpArea).toFixed(2))); }} className="w-full text-center border border-black p-1" />
        </div>
        <div className="text-center font-bold text-lg">=</div>
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">TOTAL AMOUNT</label>
          <input type="text" readOnly value={amount ? amount.toLocaleString('en-IN') + "/-" : ""} className="w-full border border-black p-1 text-center bg-gray-100 font-bold" />
        </div>
      </div>

      <div className="flex gap-4 border-t border-black pt-4">
        <button onClick={handleGenerate} className="bg-black text-white px-6 py-2 font-bold uppercase">GENERATE ESTIMATE</button>
        <button onClick={handleClear} className="bg-red-600 text-white px-6 py-2 font-bold uppercase">Clear Data</button>
      </div>

      <datalist id="clients-list">
        {[...new Set(clients.map(c => c.client_name))].map((name) => <option key={name} value={name} />)}
      </datalist>
      <datalist id="reps-list">
        {filteredReps.map((rep) => <option key={rep} value={rep} />)}
      </datalist>

      {isFloorModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 border border-black w-[480px] max-h-[80vh] flex flex-col">
            <h2 className="font-bold mb-4 text-lg border-b pb-2">SELECT FLOORS & TYPES (PROPOSED / EXISTING)</h2>
            <div className="space-y-3 overflow-auto flex-1 pr-2">
              {[...DEFAULT_FLOORS, ...EXTRA_FLOORS].map((floor) => {
                const isSelected = tempSelectedFloors.includes(floor);
                const currentMode = tempFloorModes[floor] || "BOTH";

                return (
                  <div key={floor} className="border border-gray-300 p-2 bg-gray-50 flex flex-col gap-2">
                    <label className="flex items-center gap-3 font-bold cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => {
                          if (isSelected) {
                            setTempSelectedFloors(prev => prev.filter(f => f !== floor));
                          } else {
                            setTempSelectedFloors(prev => [...prev, floor]);
                            if (!tempFloorModes[floor]) {
                              setTempFloorModes(prev => ({ ...prev, [floor]: "BOTH" }));
                            }
                          }
                        }} 
                      />
                      {floor}
                    </label>

                    {isSelected && (
                      <div className="pl-6 flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-600">TYPE:</span>
                        <select 
                          value={currentMode}
                          onChange={(e) => setTempFloorModes({ ...tempFloorModes, [floor]: e.target.value })}
                          className="border border-black p-1 text-xs font-bold bg-white w-full"
                        >
                          <option value="BOTH">PROPOSED & EXISTING</option>
                          <option value="PROPOSED">PROPOSED ONLY</option>
                          <option value="EXISTING">EXISTING ONLY</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-2 border-t">
              <button className="px-4 py-2 border border-black font-bold" onClick={() => setIsFloorModalOpen(false)}>CANCEL</button>
              <button className="bg-black text-white px-4 py-2 font-bold" onClick={() => { 
                setSelectedFloors(tempSelectedFloors); 
                setFloorModes(tempFloorModes);
                setIsFloorModalOpen(false); 
              }}>APPLY FLOORS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}