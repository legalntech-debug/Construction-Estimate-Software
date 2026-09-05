"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const DEFAULT_FLOORS = ["GROUND FLOOR"];
const EXTRA_FLOORS = [
  "BASEMENT", "FIRST FLOOR", "SECOND FLOOR", "TOWER", "THIRD FLOOR", 
  "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", 
  "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR"
];

export default function RenovationEstimatePage() {
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
  
  const [floorData, setFloorData] = useState<Record<string, { length: number; width: number; area: number }>>({});
  
  const [rate, setRate] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [feeMode, setFeeMode] = useState("AUTO");
  const [manualFee, setManualFee] = useState<number>(0);
  const [registeredFee, setRegisteredFee] = useState<number>(0);
  const [totalBuiltUpArea, setTotalBuiltUpArea] = useState(0);
  const [propertyType, setPropertyType] = useState("HOUSE");
  const [areaType, setAreaType] = useState("BUILT-UP AREA");
  const [caseType, setCaseType] = useState("RENOVATION");
  const [currentRefNo, setCurrentRefNo] = useState("");

  useEffect(() => {
    const savedData = localStorage.getItem("renovationEstimateData") || 
                    localStorage.getItem("renovationEstimatePreview") || 
                    localStorage.getItem("estimatePreview");
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        if (parsedData.ref_no) setCurrentRefNo(parsedData.ref_no);
        setCustomerName(parsedData.customer_name || "");
        setSelectedClientName(parsedData.client_name || "");
        setRepresentative(parsedData.representative || "");
        setPropertyAddress(parsedData.property_address || "");
        setPlotArea(parsedData.plot_area?.toString() || "");
        
        const loadedRate = parsedData.rate_per_sqft || 0;
        setRate(loadedRate);
        setFeeMode(parsedData.fee_mode || "AUTO");
        if (parsedData.fee_amount) setManualFee(parsedData.fee_amount);

        if (parsedData.property_type) setPropertyType(parsedData.property_type);
        if (parsedData.floor_details) setFloorData(parsedData.floor_details);
        if (parsedData.selected_floors) setSelectedFloors(parsedData.selected_floors);
        if (parsedData.case_type || parsedData.estimate_type) {
          setCaseType(parsedData.case_type || parsedData.estimate_type);
        }

        let calculatedArea = 0;
        if ((parsedData.property_type || "HOUSE") === "HOUSE" && parsedData.floor_details) {
          calculatedArea = (Object.values(parsedData.floor_details) as any[]).reduce((sum: number, f: any) => sum + (f.area || 0), 0);
        } else {
          calculatedArea = parseFloat(parsedData.plot_area) || 0;
        }

        setTotalBuiltUpArea(calculatedArea);
        const finalAmount = loadedRate * calculatedArea;
        setAmount(finalAmount);

      } catch (e) {
        console.error("Error parsing reopen data", e);
      }
    }
  }, []);

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

  const handlePlotAreaChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9.]/g, '');
    const parts = cleanVal.split('.');
    const formattedVal = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleanVal;
    setPlotArea(formattedVal);
  };

  const updateArea = (floor: string, l: number, w: number) => {
    const validLength = Math.max(0, l);
    const validWidth = Math.max(0, w);
    const newArea = parseFloat((validLength * validWidth).toFixed(2));
    
    const plotAreaNum = parseFloat(plotArea) || 0;
    if (propertyType === "HOUSE" && plotAreaNum > 0 && newArea > plotAreaNum) {
      alert(`Validation Error: Floor "${floor}" area (${newArea} SQ.FT) cannot exceed the Plot Area (${plotAreaNum} SQ.FT).`);
      return;
    }

    const updatedFloorData = { ...floorData, [floor]: { length: validLength, width: validWidth, area: newArea } };
    setFloorData(updatedFloorData);
  };

  useEffect(() => {
    if (propertyType === "HOUSE") {
      let newTotal = 0;
      Object.entries(floorData).forEach(([f, data]) => {
        if (selectedFloors.includes(f)) {
          newTotal += data?.area || 0;
        }
      });
      setTotalBuiltUpArea(newTotal);
      setAmount(parseFloat((newTotal * rate).toFixed(2)));
    } else {
      const areaNum = parseFloat(plotArea) || 0;
      setTotalBuiltUpArea(areaNum);
      setAmount(parseFloat((areaNum * rate).toFixed(2)));
    }
  }, [floorData, propertyType, plotArea, selectedFloors, rate]);

  const navigateToPreview = () => {
    const cleanedFloorDetails: any = {};
    selectedFloors.forEach(f => {
      if (floorData[f]) {
        cleanedFloorDetails[f] = floorData[f];
      }
    });

    const finalFee = feeMode === "AUTO" ? registeredFee : manualFee;

    const estimateData = {
      ref_no: currentRefNo || ("REF-" + Date.now()),
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
      property_type: propertyType,    
      floor_details: cleanedFloorDetails,      
      selected_floors: selectedFloors,
      fee_amount: finalFee,
      fee_mode: feeMode
     };
    
    localStorage.setItem("renovationEstimatePreview", JSON.stringify(estimateData));
    localStorage.setItem("RenovationEstimatePreview", JSON.stringify(estimateData));
    router.push("/renovation-estimate-preview");
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

    if (propertyType === "HOUSE" && (Object.keys(floorData).length === 0 || selectedFloors.length === 0)) {
      alert("Validation Error: Please select and fill at least one floor dimension.");
      return;
    }

    if (propertyType !== "HOUSE" && (!plotArea || Number(plotArea) <= 0)) {
      alert("Validation Error: Please enter a valid Area.");
      return;
    }

    const plotAreaNum = parseFloat(plotArea) || 0;
    if (propertyType === "HOUSE" && plotAreaNum > 0) {
      for (const floor of selectedFloors) {
        const floorArea = floorData[floor]?.area || 0;
        if (floorArea > plotAreaNum) {
          alert(`Validation Error: Floor "${floor}" area (${floorArea} SQ.FT) exceeds Plot Area (${plotAreaNum} SQ.FT). Cannot generate estimate.`);
          return;
        }
      }
    }
    
    navigateToPreview();
  };  

  const handleClear = () => {
    localStorage.removeItem("RenovationEstimatePreview");
    localStorage.removeItem("renovationEstimatePreview");
    localStorage.removeItem("estimatePreview");
    localStorage.removeItem("renovationEstimateData");
    
    setFloorData({});
    setRate(0);
    setAmount(0);
    setCustomerName("");
    setPropertyAddress("");
    setPlotArea("");
    setSelectedClientName("");
    setRepresentative("");
    setSelectedFloors(DEFAULT_FLOORS);
    setTotalBuiltUpArea(0);
    setFeeMode("AUTO");
    setManualFee(0);
    
    window.location.reload();
  };

  const isClientFilled = selectedClientName.trim() !== "" && representative.trim() !== "";
  const isCustomerFilled = isClientFilled && customerName.trim() !== "";
  const isAddressFilled = isCustomerFilled && propertyAddress.trim() !== "";
  const isPlotFilled = isAddressFilled && String(plotArea || "").trim() !== "";

  return (
    <div className="w-full max-w-5xl mx-auto p-2 sm:p-6 font-sans uppercase text-sm sm:text-lg text-black border border-black bg-white shadow-lg leading-tight overflow-x-auto">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center border-2 border-black bg-gray-100 p-3 mb-4 gap-2">
        <div className="hidden sm:block w-24"></div>
        <h1 className="text-xl sm:text-2xl font-bold text-center flex-1">
          {caseType === "RENOVATION" ? "RENOVATION ESTIMATE INPUT FORM" : "CONSTRUCTION ESTIMATE INPUT FORM"}
        </h1>
        <div>
          <label className="bg-black text-white px-3 py-1.5 font-bold text-xs sm:text-base uppercase cursor-pointer hover:bg-gray-800 flex items-center gap-1 shadow">
            📁 UPLOAD DOC / AI SCAN
            <input 
              type="file" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  alert(`Document "${file.name}" uploaded successfully! (AI Auto-Extraction will be connected here soon.)`);
                }
              }} 
            />
          </label>
        </div>
      </div>
      
      {/* Top Fields Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 border-b border-black pb-4">
        <div className="col-span-1">
          <label className="font-bold block text-xs sm:text-lg">CASE TYPE</label>
          <select className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg" value={caseType} disabled>
            <option value="RENOVATION">RENOVATION</option>
            <option value="NEW CONSTRUCTION">NEW CONSTRUCTION</option>
          </select>
        </div>
        <div className="col-span-1">
          <label className="font-bold block text-xs sm:text-lg">FEE</label>
          <select className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg" value={feeMode} onChange={(e) => setFeeMode(e.target.value)}>
            <option value="AUTO">AUTO</option>
            <option value="MANUAL">MANUAL</option>
          </select>
          {feeMode === "MANUAL" && (
            <input type="number" placeholder="ENTER FEE" className="w-full border border-black p-1.5 mt-1 text-center text-xs sm:text-lg" onChange={(e) => setManualFee(Number(e.target.value))} />
          )}
        </div>
        <div className="col-span-1">
          <label className="font-bold block text-xs sm:text-lg">CLIENT NAME</label>
          <input list="clients-list" value={selectedClientName} onChange={(e) => handleClientChange(e.target.value)} className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg" placeholder="SEARCH CLIENT..." />
        </div>
        <div className="col-span-1">
          <label className="font-bold block text-xs sm:text-lg">REPRESENTATIVE</label>
          <input list="reps-list" value={representative} onChange={(e) => setRepresentative(e.target.value)} className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg" placeholder="SEARCH REP..." />
        </div>
      </div>

      {/* Customer Name & Property Address */}
      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 md:gap-4">
          <label className="col-span-1 md:col-span-3 font-bold text-sm sm:text-lg border border-black p-2.5 bg-gray-100">CUSTOMER NAME</label>
          <textarea 
            value={customerName} 
            disabled={!isClientFilled}
            onChange={(e) => {
              setCustomerName(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }} 
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
            className={`col-span-1 md:col-span-9 border border-black p-2.5 uppercase text-left text-sm sm:text-lg resize-y overflow-hidden placeholder:text-gray-400 placeholder:normal-case ${!isClientFilled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} 
            rows={1} 
            placeholder="FILL HERE (e.g. Mr. Raju Dubela, s/o Premchand)"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 md:gap-4">
          <label className="col-span-1 md:col-span-3 font-bold text-sm sm:text-lg border border-black p-2.5 bg-gray-100">PROPERTY ADDRESS</label>
          <textarea 
            value={propertyAddress} 
            disabled={!isCustomerFilled}
            onChange={(e) => {
              setPropertyAddress(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }} 
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
            className={`col-span-1 md:col-span-9 border border-black p-2.5 uppercase text-left text-sm sm:text-lg resize-y overflow-hidden placeholder:text-gray-400 placeholder:normal-case ${!isCustomerFilled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} 
            rows={2} 
            placeholder="FILL HERE (e.g. 110 PATEL MARG, Vill. Rajgarh, Tehsil Sardarpur, Distt. Dhar, State MP)"
          />
        </div>
      </div>

      {/* Property Type & Plot Area Selection */}
      <div className={`grid grid-cols-12 gap-2 md:gap-4 mb-4 border-b border-black pb-4 items-center ${!isAddressFilled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="col-span-4 sm:col-span-2">
          <label className="font-bold block text-xs sm:text-lg">PROPERTY TYPE</label>
          <select value={propertyType} disabled={!isAddressFilled} onChange={(e) => setPropertyType(e.target.value)} className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg h-[42px]">
            <option value="HOUSE">HOUSE</option>
            <option value="FLAT">FLAT</option>
          </select>
        </div>
        {propertyType !== "HOUSE" && (
          <div className="col-span-4 sm:col-span-3">
            <label className="font-bold block text-xs sm:text-lg">AREA TYPE</label>
            <select value={areaType} onChange={(e) => setAreaType(e.target.value)} className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg h-[42px]">
              <option value="BUILT-UP AREA">BUILT-UP AREA</option>
              <option value="CARPET AREA">CARPET AREA</option>
            </select>
          </div>
        )}
        <div className={propertyType === "HOUSE" ? "col-span-8 sm:col-span-3" : "col-span-4 sm:col-span-3"}>
          <label className="font-bold block text-xs sm:text-lg">{propertyType === "HOUSE" ? "PLOT AREA" : areaType}</label>
          <input type="text" placeholder="0.00" disabled={!isAddressFilled} value={plotArea} onChange={(e) => handlePlotAreaChange(e.target.value)} className="w-full border border-black p-2 uppercase text-center text-sm sm:text-lg h-[42px]" />
        </div>
        {propertyType === "HOUSE" && (
          <div className="col-span-12 sm:col-span-4">
            <label className="font-bold block text-xs sm:text-lg">SELECT FLOORS: ({selectedFloors.length})</label>
            <button disabled={!isPlotFilled} onClick={() => { setTempSelectedFloors(selectedFloors); setIsFloorModalOpen(true); }} className={`w-full border border-black py-2 font-bold text-xs sm:text-base bg-gray-100 hover:bg-gray-200 h-[42px] ${!isPlotFilled ? 'cursor-not-allowed' : ''}`}>
              + ADD / CHOOSE FLOOR
            </button>
          </div>
        )}
      </div>

      {/* Built Up Area Details */}
      {propertyType === "HOUSE" && (
        <div className={`mt-4 border border-black rounded-none overflow-hidden ${!isPlotFilled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="bg-[#1e293b] text-white py-2.5 font-bold uppercase tracking-wider text-center text-sm sm:text-lg">BUILT UP AREA DETAILS</div>
          {["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"]
            .filter(f => selectedFloors.includes(f))
            .map((f) => (
              <div key={f} className="grid grid-cols-12 items-center border-b border-black bg-white">
                <span className="col-span-4 font-bold text-black uppercase text-xs sm:text-lg p-2.5 text-center border-r border-black">{f}</span>
                <div className="col-span-4 grid grid-cols-2 gap-0 border-r border-black">
                  <input type="number" step="0.01" min="0" placeholder="W" value={floorData[f]?.width || ""} className="w-full text-center border-none bg-transparent outline-none p-2.5 text-xs sm:text-lg" onChange={(e) => updateArea(f, floorData[f]?.length || 0, parseFloat(e.target.value) || 0)} />
                  <input type="number" step="0.01" min="0" placeholder="L" value={floorData[f]?.length || ""} className="w-full text-center border-none border-l border-black bg-transparent outline-none p-2.5 text-xs sm:text-lg" onChange={(e) => updateArea(f, parseFloat(e.target.value) || 0, floorData[f]?.width || 0)} />
                </div>
                <input type="text" readOnly value={`${floorData[f]?.area || 0} SQ.FT`} className="col-span-4 p-2.5 text-center font-bold text-xs sm:text-lg bg-transparent" />
              </div>
            ))}
        </div>
      )}

      {/* Summary Calculation Bar */}
      <div className={`grid grid-cols-2 sm:grid-cols-5 mb-3 mt-4 items-center gap-2 ${totalBuiltUpArea <= 0 ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="col-span-1">
          <label className="font-bold block text-xs sm:text-lg">TOTAL AREA</label>
          <input type="text" readOnly value={`${totalBuiltUpArea} SQ.FT`} className="w-full border border-black p-2 text-center bg-gray-100 font-bold text-xs sm:text-lg" />
        </div>
        <div className="text-center font-bold text-lg hidden sm:block">X</div>
        <div className="col-span-1">
          <label className="font-bold block text-xs sm:text-lg">RATE / SQ.FT</label>
          <input 
            type="number" 
            step="0.01" 
            value={rate || ""} 
            onChange={(e) => { 
              const r = parseFloat(e.target.value) || 0; 
              setRate(r); 
              setAmount(parseFloat((r * totalBuiltUpArea).toFixed(2))); 
            }} 
            className="w-full text-center border border-black p-2 text-xs sm:text-lg" 
          />
        </div>
        <div className="text-center font-bold text-lg hidden sm:block">=</div>
        <div className="col-span-2 sm:col-span-1">
          <label className="font-bold block text-xs sm:text-lg">TOTAL AMOUNT</label>
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
            className="w-full border border-black p-2 text-center bg-gray-100 font-bold text-xs sm:text-lg" 
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 border-t border-black pt-4">
        <button onClick={handleGenerate} className="bg-black text-white px-6 py-3 font-bold uppercase text-sm sm:text-lg w-full sm:w-auto">GENERATE ESTIMATE</button>
        <button onClick={handleClear} className="bg-red-600 text-white px-6 py-3 font-bold uppercase text-sm sm:text-lg w-full sm:w-auto">Clear Data</button>
      </div>

      <datalist id="clients-list">
        {[...new Set(clients.map(c => c.client_name))].map((name) => <option key={name} value={name} />)}
      </datalist>
      <datalist id="reps-list">
        {filteredReps.map((rep) => <option key={rep} value={rep} />)}
      </datalist>

      {/* Floor Selector Modal */}
      {isFloorModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 border border-black w-full max-w-[400px] uppercase text-xs sm:text-base">
            <h2 className="font-bold mb-4 border-b border-black pb-2 text-sm sm:text-lg">SELECT FLOORS</h2>
            <div className="space-y-2 max-h-[350px] overflow-auto mb-4">
              {[...DEFAULT_FLOORS, ...EXTRA_FLOORS].map((floor) => (
                <label key={floor} className="flex items-center gap-3 cursor-pointer p-2 border-b">
                  <input type="checkbox" checked={tempSelectedFloors.includes(floor)} onChange={() => setTempSelectedFloors(prev => prev.includes(floor) ? prev.filter(f => f !== floor) : [...prev, floor])} />
                  {floor}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button className="border border-black px-4 py-2" onClick={() => setIsFloorModalOpen(false)}>CANCEL</button>
              <button className="bg-black text-white px-4 py-2 font-bold" onClick={() => { 
                const floorSequence = ["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"];
                const sortedFloors = [...tempSelectedFloors].sort((a, b) => floorSequence.indexOf(a) - floorSequence.indexOf(b));
                
                setSelectedFloors(sortedFloors); 
                
                setFloorData(prev => {
                  const updatedData = { ...prev };
                  Object.keys(updatedData).forEach(f => {
                    if (!tempSelectedFloors.includes(f)) {
                      delete updatedData[f];
                    }
                  });
                  return updatedData;
                });

                setIsFloorModalOpen(false); 
              }}>ADD SELECTED</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}