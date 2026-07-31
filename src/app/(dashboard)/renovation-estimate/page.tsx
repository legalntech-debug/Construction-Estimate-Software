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

  useEffect(() => {
    // 🟢 Yahan "renovationEstimateData" key jodna zaroori hai
    const savedData = localStorage.getItem("renovationEstimateData") || 
                      localStorage.getItem("renovationEstimatePreview") || 
                      localStorage.getItem("estimatePreview");
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

        if (parsedData.property_type) setPropertyType(parsedData.property_type);
        if (parsedData.floor_details) setFloorData(parsedData.floor_details);
        if (parsedData.selected_floors) setSelectedFloors(parsedData.selected_floors);
        if (parsedData.case_type || parsedData.estimate_type) {
          setCaseType(parsedData.case_type || parsedData.estimate_type);
        }

        // Calculate total area
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
    const savedData = localStorage.getItem("renovationEstimatePreview") || localStorage.getItem("estimatePreview");
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

        if (parsedData.property_type) setPropertyType(parsedData.property_type);
        if (parsedData.floor_details) setFloorData(parsedData.floor_details);
        if (parsedData.selected_floors) setSelectedFloors(parsedData.selected_floors);
        if (parsedData.estimate_type) setCaseType(parsedData.estimate_type);

        // Calculate total area
        let calculatedArea = 0;
        if (parsedData.property_type === "HOUSE" && parsedData.floor_details) {
          calculatedArea = (Object.values(parsedData.floor_details) as any[]).reduce((sum: number, f: any) => sum + (f.area || 0), 0);
        } else {
          calculatedArea = parseFloat(parsedData.plot_area) || 0;
        }

        setTotalBuiltUpArea(calculatedArea);
        
        // Fix: Force calculation based on Rate * Area instead of taking fee/total_value from MIS
        const finalAmount = loadedRate * calculatedArea;
        setAmount(finalAmount);

      } catch (e) {
        console.error("Error parsing reopen data", e);
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
      total_construction_cost: amount, // 🟢 Yeh add karein
      total_value: amount,             // 🟢 Yeh bhi add karein
      estimate_type: caseType,
      property_type: propertyType,    
      floor_details: floorData,       
      selected_floors: selectedFloors 
     };
    
    localStorage.setItem("renovationEstimatePreview", JSON.stringify(estimateData));
    localStorage.setItem("RenovationEstimatePreview", JSON.stringify(estimateData));
    router.push("/renovation-estimate-preview");
  };

  useEffect(() => {
    if (propertyType === "HOUSE") {
      const newTotal = Object.values(floorData).reduce((sum, f) => sum + (f.area || 0), 0);
      setTotalBuiltUpArea(newTotal);
    }
  }, [floorData, propertyType]);

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

  const updateArea = (floor: string, l: number, w: number) => {
    const newArea = parseFloat((l * w).toFixed(2));
    const plotAreaNum = parseFloat(plotArea) || 0;
    
    if (plotAreaNum > 0 && newArea > plotAreaNum) {
      alert(`Validation Warning: Floor area (${newArea}) exceeds Plot Area (${plotAreaNum})!`);
    }
    
    const updatedFloorData = { ...floorData, [floor]: { length: l, width: w, area: newArea } };
    setFloorData(updatedFloorData);
  };

  useEffect(() => {
    if (propertyType === "HOUSE") {
      const newTotal = Object.values(floorData).reduce((sum, f) => sum + (f.area || 0), 0);
      setTotalBuiltUpArea(newTotal);
    } else {
      const areaNum = parseFloat(plotArea) || 0;
      setTotalBuiltUpArea(areaNum);
    }
  }, [floorData, propertyType, plotArea]);

  const handleGenerate = async () => {
    if (!selectedClientName.trim() || !representative.trim()) {
      alert("Validation Error: Please select both Client Name and Representative.");
      return;
    }

    if (!customerName.trim() || !propertyAddress.trim() || rate <= 0) {
      alert("Validation Error: Please fill in Customer Name, Property Address, and a valid Rate.");
      return;
    }

    if (propertyType === "HOUSE" && Object.keys(floorData).length === 0) {
      alert("Validation Error: Please fill at least one floor dimension.");
      return;
    }

    if (propertyType !== "HOUSE" && (!plotArea || Number(plotArea) <= 0)) {
      alert("Validation Error: Please enter a valid Area.");
      return;
    }
    
    navigateToPreview();
  };  

  const handleClear = () => {
    // Sari relevant storage keys ko clear karein
    localStorage.removeItem("RenovationEstimatePreview");
    localStorage.removeItem("renovationEstimatePreview");
    localStorage.removeItem("estimatePreview");
    localStorage.removeItem("renovationEstimateData");
    
    // States ko reset karein
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
    
    // Page ko reload karne ki bajaye clean state maintain karna behtar hai, 
    // par agar refresh karna ho toh window.location.reload() rehne dein.
    window.location.reload();
  };
  return (
    <div className="p-6 font-sans uppercase text-lg text-black max-w-5xl mx-auto border border-black bg-white shadow-lg leading-tight">
      <h1 className="text-2xl font-bold text-center border-2 border-black bg-gray-100 p-1 mb-2">
        {caseType === "RENOVATION" ? "RENOVATION ESTIMATE INPUT FORM" : "CONSTRUCTION ESTIMATE INPUT FORM"}
      </h1>
      
      <div className="grid grid-cols-4 gap-4 mb-4 border-b border-black pb-4">
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">CASE TYPE</label>
          <select className="w-full border border-black p-1 uppercase text-center" value={caseType} disabled>
            <option value="RENOVATION">RENOVATION</option>
            <option value="NEW CONSTRUCTION">NEW CONSTRUCTION</option>
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
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">CLIENT NAME</label>
          <input list="clients-list" value={selectedClientName} onChange={(e) => handleClientChange(e.target.value)} className="w-full border border-black p-1 uppercase text-center" placeholder="SEARCH CLIENT..." />
        </div>
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">REPRESENTATIVE</label>
          <input list="reps-list" value={representative} onChange={(e) => setRepresentative(e.target.value)} className="w-full border border-black p-1 uppercase text-center" placeholder="SEARCH REP..." />
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

      <div className="grid grid-cols-12 gap-4 mb-6 border-b border-black pb-4">
        <div className="col-span-2">
          <label className="font-bold block text-[12pt]">PROPERTY TYPE</label>
          <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="w-full border border-black p-1 uppercase text-center h-[38px]">
            <option value="HOUSE">HOUSE</option>
            <option value="FLAT">FLAT</option>
          </select>
        </div>
        {propertyType !== "HOUSE" && (
          <div className="col-span-3">
            <label className="font-bold block text-[12pt]">AREA TYPE</label>
            <select value={areaType} onChange={(e) => setAreaType(e.target.value)} className="w-full border border-black p-1 uppercase text-center h-[38px]">
              <option value="BUILT-UP AREA">BUILT-UP AREA</option>
              <option value="CARPET AREA">CARPET AREA</option>
            </select>
          </div>
        )}
        <div className={propertyType === "HOUSE" ? "col-span-2" : "col-span-3"}>
          <label className="font-bold block text-[12pt]">{propertyType === "HOUSE" ? "PLOT AREA" : areaType}</label>
          <input type="text" placeholder="0.00" value={plotArea} onChange={(e) => setPlotArea(e.target.value)} className="w-full border border-black p-1 uppercase text-center text-xl h-[38px]" />
        </div>
        {propertyType === "HOUSE" && (
          <div className="col-span-4">
            <label className="font-bold block text-[12pt]">SELECT FLOORS</label>
            <button onClick={() => { setTempSelectedFloors(selectedFloors); setIsFloorModalOpen(true); }} className="w-full border border-black py-1 font-bold text-[10pt] bg-gray-100 h-[38px]">
              + ADD / CHOOSE FLOOR
            </button>
          </div>
        )}
      </div>

      {propertyType === "HOUSE" && (
        <div className="mt-4 border border-black rounded-none overflow-hidden">
          <div className="bg-[#1e293b] text-white py-2 font-bold uppercase tracking-wider text-center text-[12pt]">BUILT UP AREA DETAILS</div>
          {["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"]
            .filter(f => selectedFloors.includes(f))
            .map((f) => (
              <div key={f} className="grid grid-cols-12 items-center border-b border-black">
                <span className="col-span-4 font-bold text-black uppercase text-[12pt] p-2 text-center border-r border-black">{f}</span>
                <div className="col-span-4 grid grid-cols-2 gap-0 border-r border-black">
                  <input type="number" placeholder="W" value={floorData[f]?.width || ""} className="w-full text-center border-none" onChange={(e) => updateArea(f, floorData[f]?.length || 0, parseFloat(e.target.value) || 0)} />
                  <input type="number" placeholder="L" value={floorData[f]?.length || ""} className="w-full text-center border-none border-l border-black" onChange={(e) => updateArea(f, parseFloat(e.target.value) || 0, floorData[f]?.width || 0)} />
                </div>
                <input type="text" readOnly value={`${floorData[f]?.area || 0} SQ.FT`} className="col-span-4 p-2 text-center font-bold" />
              </div>
            ))}
        </div>
      )}

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
          <div className="bg-white p-6 border border-black w-[400px]">
            <h2 className="font-bold mb-4">SELECT FLOORS</h2>
            <div className="space-y-2 max-h-[350px] overflow-auto">
              {[...DEFAULT_FLOORS, ...EXTRA_FLOORS].map((floor) => (
                <label key={floor} className="flex items-center gap-3">
                  <input type="checkbox" checked={tempSelectedFloors.includes(floor)} onChange={() => setTempSelectedFloors(prev => prev.includes(floor) ? prev.filter(f => f !== floor) : [...prev, floor])} />
                  {floor}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setIsFloorModalOpen(false)}>CANCEL</button>
              <button className="bg-black text-white px-4 py-2" onClick={() => { setSelectedFloors(tempSelectedFloors); setIsFloorModalOpen(false); }}>ADD SELECTED</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}