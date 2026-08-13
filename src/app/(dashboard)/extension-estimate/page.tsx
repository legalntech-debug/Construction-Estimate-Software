"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DocumentScanner from "../../../components/DocumentScanner";

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

  useEffect(() => {
    let newTotal = 0;
    Object.entries(floorData).forEach(([f, data]) => {
      if (selectedFloors.includes(f)) {
        const mode = floorModes[f] || "BOTH";
        if (mode === "PROPOSED" || mode === "BOTH") {
          newTotal += data?.proposed?.area || 0;
        }
        if (mode === "EXISTING" || mode === "BOTH") {
          newTotal += data?.existing?.area || 0;
        }
      }
    });
    setTotalBuiltUpArea(newTotal);
    setAmount(parseFloat((rate * newTotal).toFixed(2)));
  }, [floorData, floorModes, selectedFloors, rate]);

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
      } catch (e) {
        console.error("Error parsing saved data", e);
      }
    }
  }, []);

  const navigateToPreview = () => {
    const cleanedFloorDetails: any = {};
    const cleanedFloorModes: any = {};

    selectedFloors.forEach(f => {
      if (floorData[f]) {
        cleanedFloorDetails[f] = floorData[f];
      }
      if (floorModes[f]) {
        cleanedFloorModes[f] = floorModes[f];
      }
    });

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
      floor_details: cleanedFloorDetails,      
      selected_floors: selectedFloors,
      floor_modes: cleanedFloorModes,
      version_tag: "UPCOMING VERSION"
     };
    
    localStorage.setItem("extensionEstimatePreview", JSON.stringify(estimateData));
    router.push("/extension-estimate-preview");
  };

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
    const validL = Math.max(0, l);
    const validW = Math.max(0, w);
    const calculatedSubArea = parseFloat((validL * validW).toFixed(2));
    const plotNum = parseFloat(plotArea) || 0;

    const currentFloorObj = floorData[floor] || {
      proposed: { length: 0, width: 0, area: 0 },
      existing: { length: 0, width: 0, area: 0 }
    };

    const otherType = type === 'proposed' ? 'existing' : 'proposed';
    const otherArea = currentFloorObj[otherType]?.area || 0;
    const combinedFloorArea = calculatedSubArea + otherArea;

    // Live warning only (will not block typing or updating values)
    if (plotNum > 0 && combinedFloorArea > plotNum) {
      console.warn(`Validation Warning: Total area for ${floor} (${combinedFloorArea} SQ.FT) exceeds Plot Area (${plotNum} SQ.FT)!`);
    }

    const updatedSubArea = { length: validL, width: validW, area: calculatedSubArea };

    setFloorData({
      ...floorData,
      [floor]: {
        ...currentFloorObj,
        [type]: updatedSubArea
      }
    });
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

    if (Object.keys(floorData).length === 0 || selectedFloors.length === 0) {
      alert("Validation Error: Please select and fill at least one floor dimension.");
      return;
    }

    if (!plotArea || Number(plotArea) <= 0) {
      alert("Validation Error: Please enter a valid Plot Area.");
      return;
    }

    // STRICT VALIDATION ON GENERATE: Block generation if any floor area exceeds Plot Area
    const plotNum = parseFloat(plotArea) || 0;
    for (const f of selectedFloors) {
      const data = floorData[f];
      if (data) {
        const mode = floorModes[f] || "BOTH";
        let floorTotal = 0;
        if (mode === "PROPOSED" || mode === "BOTH") floorTotal += data.proposed?.area || 0;
        if (mode === "EXISTING" || mode === "BOTH") floorTotal += data.existing?.area || 0;

        if (floorTotal > plotNum) {
          alert(`Validation Error: ${f} total area (${floorTotal} SQ.FT) exceeds Plot Area (${plotNum} SQ.FT). Cannot generate estimate.`);
          return;
        }
      }
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

  const isClientFilled = selectedClientName.trim() !== "" && representative.trim() !== "";
  const isCustomerFilled = isClientFilled && customerName.trim() !== "";
  const isAddressFilled = isCustomerFilled && propertyAddress.trim() !== "";
  const isPlotFilled = isAddressFilled && plotArea.trim() !== "";

  return (
    <div className="p-6 font-sans uppercase text-lg text-black max-w-5xl mx-auto border border-black bg-white shadow-lg leading-tight">
      <div className="flex justify-between items-center border-2 border-black bg-gray-100 p-2 mb-4">
        <h1 className="text-2xl font-bold text-center w-full pl-32">
          EXTENSION & RENOVATION ESTIMATE INPUT FORM
        </h1>
        <DocumentScanner 
          onScanComplete={({ customerName, propertyAddress, plotArea }) => {
            if (customerName) setCustomerName(customerName);
            if (propertyAddress) setPropertyAddress(propertyAddress);
            if (plotArea) setPlotArea(plotArea);
          }} 
        />
      </div>
      
      <div className="grid grid-cols-7 gap-4 mb-4 border-b border-black pb-4">
        <div className="col-span-2">
          <label className="font-bold block text-[12pt]">CASE TYPE</label>
          <select className="w-full border border-black p-1 uppercase text-center">
            <option>EXTENSION & RENOVATION</option>
          </select>
        </div>
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">FEE</label>
          <select className="w-full border border-black p-1 uppercase text-center" value={feeMode} onChange={(e) => setFeeMode(e.target.value)}>
            <option value="AUTO">AUTO</option>
            <option value="MANUAL">MANUAL</option>
          </select>
          {feeMode === "MANUAL" && (
            <input type="number" placeholder="ENTER FEE" className="w-full border border-black p-1 mt-1 text-center" onChange={(e) => setManualFee(Number(e.target.value))} />
          )}
        </div>
        
        <div className="col-span-2">
          <label className="font-bold block text-[12pt]">CLIENT NAME</label>
          <input list="clients-list" value={selectedClientName} onChange={(e) => handleClientChange(e.target.value)} className="w-full border border-black p-1 uppercase text-center" placeholder="SEARCH CLIENT..." />
        </div>
        <div className="col-span-2">
          <label className="font-bold block text-[12pt]">REPRESENTATIVE</label>
          <input list="reps-list" value={representative} onChange={(e) => setRepresentative(e.target.value)} className="w-full border border-black p-1 uppercase text-center" placeholder="SEARCH REP..." />
        </div>
      </div>

      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-12 items-center gap-4">
          <label className="col-span-3 font-bold text-[12pt] border border-black p-2 bg-gray-100">CUSTOMER NAME</label>
          <textarea 
            value={customerName} 
            disabled={!isClientFilled}
            onChange={(e) => setCustomerName(e.target.value)} 
            className={`col-span-9 border border-black p-2 uppercase text-left text-lg placeholder:text-gray-400 placeholder:normal-case ${!isClientFilled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} 
            rows={1} 
            placeholder="FILL HERE (e.g. Mr. Raju Dubela, s/o Premchand)"
          />
        </div>
        <div className="grid grid-cols-12 items-center gap-4">
          <label className="col-span-3 font-bold text-[12pt] border border-black p-2 bg-gray-100">PROPERTY ADDRESS</label>
          <textarea 
            value={propertyAddress} 
            disabled={!isCustomerFilled}
            onChange={(e) => setPropertyAddress(e.target.value)} 
            className={`col-span-9 border border-black p-2 uppercase text-left text-lg placeholder:text-gray-400 placeholder:normal-case ${!isCustomerFilled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} 
            rows={2} 
            placeholder="FILL HERE (e.g. 110 PATEL MARG, Vill. Rajgarh, Tehsil Sardarpur, Distt. Dhar, State MP)"
          />
        </div>
      </div>

      <div className={`grid grid-cols-10 gap-4 mb-2 items-center border-t border-black pt-4 ${!isAddressFilled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="col-span-3">
          <label className="font-bold block text-[12pt]">PLOT AREA</label>
          <div className="relative flex items-center">
            <input 
              type="text" 
              placeholder="0.00" 
              disabled={!isAddressFilled}
              value={plotArea} 
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                const parts = val.split('.');
                const formattedVal = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : val;
                setPlotArea(formattedVal);
              }} 
              className="w-full border border-black p-1 uppercase text-center text-xl pr-16" 
            />
            <span className="absolute right-2 text-black font-bold text-[10pt] pointer-events-none">SQ. FT</span>
          </div>
        </div>
        
        <div className="col-span-7">
          <div className="flex justify-between items-center mb-1">
            <label className="font-bold block text-[12pt]">SELECT FLOORS</label>
            <div className="flex items-center gap-2 text-[10pt] font-bold text-purple-900">
              <span className="bg-purple-100 px-3 py-1 border border-black">PROPOSED</span>
              <span className="bg-orange-100 px-3 py-1 border border-black text-orange-900">EXISTING</span>
            </div>
          </div>
          <button 
            disabled={!isPlotFilled}
            onClick={() => { 
              setTempSelectedFloors(selectedFloors); 
              setTempFloorModes(floorModes);
              setIsFloorModalOpen(true); 
            }} 
            className={`border border-black px-10 py-1 font-bold text-[10pt] bg-gray-100 hover:bg-gray-200 text-black w-full text-center ${!isPlotFilled ? 'cursor-not-allowed' : ''}`}
          >
            + ADD / CHOOSE FLOOR
          </button>
        </div>
      </div>

      <div className={`mt-4 border border-black overflow-hidden space-y-4 p-4 bg-gray-50 ${!isPlotFilled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="bg-[#1e293b] text-white py-2 px-3 font-bold uppercase tracking-wider text-center text-[12pt]">BUILT UP AREA DETAILS (PROPOSED & EXISTING)</div>
        
        {["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"]
          .filter(f => selectedFloors.includes(f))
          .map((f) => {
            const floorObj = floorData[f] || {
              proposed: { length: 0, width: 0, area: 0 },
              existing: { length: 0, width: 0, area: 0 }
            };

            const currentMode = floorModes[f] || "BOTH";

            return (
              <div key={f} className="border border-black p-3 bg-white">
                <div className="font-bold text-[12pt] text-center bg-gray-100 border border-black py-2 mb-3 flex justify-between px-4 items-center">
                  <span className="text-black">{f}</span>
                  <span className="text-[10pt] bg-white px-3 py-1 border border-black font-bold text-black">
                    {currentMode === "BOTH" ? "PROPOSED & EXISTING" : currentMode === "PROPOSED" ? "PROPOSED ONLY" : "EXISTING ONLY"}
                  </span>
                </div>
                
                <div className="space-y-3">
                  {(currentMode === "BOTH" || currentMode === "PROPOSED") && (
                    <div className="grid grid-cols-12 items-center border border-black bg-white">
                      <span className="col-span-3 font-bold text-black uppercase text-[12pt] p-2 text-center border-r border-black bg-purple-50">PROPOSED</span>
                      <div className="col-span-5 grid grid-cols-2 gap-0 border-r border-black">
                        <input type="number" step="0.01" min="0" placeholder="WIDTH" value={floorObj?.proposed?.width || ""} className="w-full text-center border-none p-2 text-[12pt] font-bold outline-none bg-transparent" onChange={(e) => updateFloorArea(f, 'proposed', floorObj?.proposed?.length || 0, parseFloat(e.target.value) || 0)} />
                        <input type="number" step="0.01" min="0" placeholder="LENGTH" value={floorObj?.proposed?.length || ""} className="w-full text-center border-none border-l border-black p-2 text-[12pt] font-bold outline-none bg-transparent" onChange={(e) => updateFloorArea(f, 'proposed', parseFloat(e.target.value) || 0, floorObj?.proposed?.width || 0)} />
                      </div>
                      <input type="text" readOnly value={`${floorObj?.proposed?.area || 0} SQ.FT`} className="col-span-4 p-2 text-center font-bold text-[12pt] bg-gray-100 text-black border-none" />
                    </div>
                  )}

                  {(currentMode === "BOTH" || currentMode === "EXISTING") && (
                    <div className="grid grid-cols-12 items-center border border-black bg-white">
                      <span className="col-span-3 font-bold text-black uppercase text-[12pt] p-2 text-center border-r border-black bg-orange-50">EXISTING</span>
                      <div className="col-span-5 grid grid-cols-2 gap-0 border-r border-black">
                        <input type="number" step="0.01" min="0" placeholder="WIDTH" value={floorObj?.existing?.width || ""} className="w-full text-center border-none p-2 text-[12pt] font-bold outline-none bg-transparent" onChange={(e) => updateFloorArea(f, 'existing', floorObj?.existing?.length || 0, parseFloat(e.target.value) || 0)} />
                        <input type="number" step="0.01" min="0" placeholder="LENGTH" value={floorObj?.existing?.length || ""} className="w-full text-center border-none border-l border-black p-2 text-[12pt] font-bold outline-none bg-transparent" onChange={(e) => updateFloorArea(f, 'existing', parseFloat(e.target.value) || 0, floorObj?.existing?.width || 0)} />
                      </div>
                      <input type="text" readOnly value={`${floorObj?.existing?.area || 0} SQ.FT`} className="col-span-4 p-2 text-center font-bold text-[12pt] bg-gray-100 text-black border-none" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      <div className={`grid grid-cols-5 gap-4 mb-4 mt-6 items-center ${totalBuiltUpArea <= 0 ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">TOTAL AREA</label>
          <input type="text" readOnly value={`${totalBuiltUpArea} SQ.FT`} className="w-full border border-black p-1 text-center bg-gray-100 font-bold text-[12pt]" />
        </div>
        <div className="text-center font-bold text-lg">X</div>
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">RATE / SQ.FT</label>
          <input 
            type="number" 
            step="0.01" 
            value={rate || ""} 
            onChange={(e) => { 
              const r = parseFloat(e.target.value) || 0; 
              setRate(r); 
              setAmount(parseFloat((r * totalBuiltUpArea).toFixed(2))); 
            }} 
            className="w-full text-center border border-black p-1 text-[12pt]" 
            placeholder="0" 
          />
        </div>
        <div className="text-center font-bold text-lg">=</div>
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">TOTAL AMOUNT</label>
          <input 
            type="text" 
            value={amount ? amount.toLocaleString('en-IN') + "/-" : ""} 
            onChange={(e) => {
              const rawVal = e.target.value.replace(/[^0-9.]/g, '');
              const amt = parseFloat(rawVal) || 0;
              setAmount(amt);
              if (totalBuiltUpArea > 0) {
                const calculatedRate = parseFloat((amt / totalBuiltUpArea).toFixed(2));
                setRate(calculatedRate);
              }
            }} 
            className="w-full border border-black p-1 text-center bg-gray-100 font-bold text-[12pt]" 
          />
        </div>
      </div>

      <div className="flex gap-4 border-t border-black pt-4">
        <button onClick={handleGenerate} className="bg-black text-white px-6 py-2 font-bold uppercase text-[12pt]">GENERATE ESTIMATE</button>
        <button onClick={handleClear} className="bg-red-600 text-white px-6 py-2 font-bold uppercase text-[12pt]">Clear Data</button>
      </div>

      <datalist id="clients-list">
        {[...new Set(clients.map(c => c.client_name))].map((name) => <option key={name} value={name} />)}
      </datalist>
      <datalist id="reps-list">
        {filteredReps.map((rep) => <option key={rep} value={rep} />)}
      </datalist>

      {isFloorModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 border border-black w-[450px] uppercase text-[9pt]">
            <h2 className="font-bold mb-4 border-b border-black pb-2 text-[11pt]">SELECT FLOORS & TYPES</h2>
            <div className="space-y-2 max-h-[400px] overflow-auto mb-4 pr-2">
              {[...DEFAULT_FLOORS, ...EXTRA_FLOORS].map((floor) => {
                const isSelected = tempSelectedFloors.includes(floor);
                const currentMode = tempFloorModes[floor] || "BOTH";

                return (
                  <div key={floor} className="border-b border-gray-300 py-2 flex flex-col gap-2">
                    <label className="flex items-center gap-3 font-bold cursor-pointer text-[10pt]">
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
                        className="w-4 h-4"
                      />
                      {floor}
                    </label>

                    {isSelected && (
                      <div className="pl-7 flex items-center gap-2">
                        <span className="text-[9pt] font-bold whitespace-nowrap">TYPE:</span>
                        <select 
                          value={currentMode}
                          onChange={(e) => {
                            const newMode = e.target.value;
                            setTempFloorModes({ ...tempFloorModes, [floor]: newMode });
                          }}
                          className="border border-black p-1 text-[9pt] font-bold bg-white w-full"
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
            <div className="flex justify-end gap-3 mt-4">
              <button className="border border-black px-4 py-2 font-bold text-[9pt]" onClick={() => setIsFloorModalOpen(false)}>CANCEL</button>
              <button className="bg-black text-white px-4 py-2 font-bold text-[9pt]" onClick={() => { 
                const floorSequence = ["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"];
                const sortedFloors = [...tempSelectedFloors].sort((a, b) => floorSequence.indexOf(a) - floorSequence.indexOf(b));
                
                setSelectedFloors(sortedFloors); 
                setFloorModes(tempFloorModes);
                
                setFloorData(prev => {
                  const updatedData = { ...prev };
                  Object.keys(updatedData).forEach(f => {
                    if (!tempSelectedFloors.includes(f)) {
                      delete updatedData[f];
                    }
                  });
                  return updatedData;
                });

                setFloorModes(prev => {
                  const updatedModes = { ...prev };
                  Object.keys(updatedModes).forEach(f => {
                    if (!tempSelectedFloors.includes(f)) {
                      delete updatedModes[f];
                    }
                  });
                  return updatedModes;
                });

                setIsFloorModalOpen(false); 
              }}>APPLY FLOORS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}