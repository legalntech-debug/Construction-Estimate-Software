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

const GROUND_ONLY_ITEMS = [
  "preliminary", 
  "earthwork", 
  "pcc_foundation", 
  "anti_termite", 
  "rcc_foundation", 
  "plinth_beam",
  "deep_boring_desc",
  "water_tank_desc",
  "boundary_wall_gate"
];

const AVAILABLE_CORE_ITEMS = [
  { id: "preliminary", label: "Preliminary Work" },
  { id: "earthwork", label: "Earthwork & Excavation" },
  { id: "pcc_foundation", label: "PCC Foundation" },
  { id: "anti_termite", label: "Anti-Termite Treatment" },
  { id: "rcc_foundation", label: "RCC Foundation / Footings" },
  { id: "rcc_column", label: "RCC Column Work" },
  { id: "plinth_beam", label: "Plinth Beam" },
  { id: "roof_beam", label: "Roof Beam" },
  { id: "rcc_slab", label: "RCC Slab Work" },
  { id: "rcc_lintel", label: "RCC Lintel Work" },
  { id: "rcc_chajja", label: "RCC Chajja Work" },
  { id: "rcc_staircase", label: "RCC Staircase Work" },
  { id: "reinforcement_steel", label: "Reinforcement Steel" },
  { id: "shuttering", label: "Shuttering & Formwork" },
  { id: "brickwork", label: "Brickwork Masonry" },
  { id: "internal_plaster", label: "Internal Plaster" },
  { id: "external_plaster", label: "External Plaster" },
  { id: "parapet_wall", label: "Parapet Wall" },
  { id: "terrace_coba", label: "Terrace Coba Waterproofing" },
  { id: "door_frame_desc", label: "Door Frames & Shutters Work" },
  { id: "paint_putty_desc", label: "Paint, Putty & Wall Finish" },
  { id: "ms_steel_desc", label: "MS Steel & Grill Work" },
  { id: "plumbing_desc", label: "Plumbing & Sanitary Fittings" },
  { id: "electrical_desc", label: "Electrical Conduiting & Fixtures" },
  { id: "flooring_desc", label: "Flooring & Tiling Work" },
  { id: "false_ceiling_desc", label: "False Ceiling Work" },
  { id: "modular_kitchen_desc", label: "Modular Kitchen Setup" },
  { id: "water_tank_desc", label: "Water Tank Installation" },
  { id: "full_home_furnishing_desc", label: "Full Home Furnishing & Woodwork" },
  { id: "modern_elevation_desc", label: "Modern Elevation & Facade" },
  { id: "deep_boring_desc", label: "Deep Boring Work" },
  { id: "final_finishing_desc", label: "Final Finishing & Cleaning" },
  { id: "lift_installation_desc", label: "Lift Installation" },
  { id: "consultant_fee_desc", label: "Consultant & Engineering Fees" },
  { id: "boundary_wall_gate", label: "Compound/Boundary Wall & Gate" },
];

export default function RemainingWorkEstimateInputPage() {
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
  
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>(AVAILABLE_CORE_ITEMS.map(i => i.id));
  const [tempSelectedItems, setTempSelectedItems] = useState<string[]>(selectedItems);

  const [floorWiseItems, setFloorWiseItems] = useState<Record<string, string[]>>({
    "GROUND FLOOR": AVAILABLE_CORE_ITEMS.map(i => i.id)
  });
  const [activeItemFloor, setActiveItemFloor] = useState<string | null>(null);
  const [tempFloorWiseItems, setTempFloorWiseItems] = useState<string[]>([]);

  const [floorData, setFloorData] = useState<Record<string, { length: number; width: number; area: number }>>({});
  const [rate, setRate] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [feeMode, setFeeMode] = useState("AUTO");
  const [manualFee, setManualFee] = useState<number>(0);
  const [registeredFee, setRegisteredFee] = useState<number>(0);
  const [totalBuiltUpArea, setTotalBuiltUpArea] = useState(0);
  const [, setCurrentRefNo] = useState("");

  useEffect(() => {
    const savedData = localStorage.getItem("estimateData") || localStorage.getItem("estimatePreview");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.ref_no) setCurrentRefNo(parsed.ref_no);
        setCustomerName(parsed.customer_name || "");
        setPropertyAddress(parsed.property_address || "");
        setPlotArea(parsed.plot_area?.toString() || "");
        setSelectedClientName(parsed.client_name || parsed.selected_client_name || "");
        setRepresentative(parsed.representative || "");
        
        const loadedRate = Number(parsed.rate_per_sqft) || 0;
        setRate(loadedRate);

        setFeeMode(parsed.fee_mode || "AUTO");
        if (parsed.fee_amount) setManualFee(parsed.fee_amount);
        if (parsed.floor_details) {
          setFloorData(parsed.floor_details);
          setSelectedFloors(Object.keys(parsed.floor_details));
          const totalArea = Object.values(parsed.floor_details).reduce(
            (sum: number, f: any) => sum + Number(f.area || 0), 0
          );
          setTotalBuiltUpArea(Number(totalArea));
          setAmount(Number(totalArea) * loadedRate);
        }
        if (parsed.selected_items && Array.isArray(parsed.selected_items)) {
          setSelectedItems(parsed.selected_items);
        }
        if (parsed.floor_wise_items) {
          setFloorWiseItems(parsed.floor_wise_items);
        }
      } catch (e) {
        console.error("Failed to parse saved estimate:", e);
      }
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data: clientsTable, error } = await supabase
        .from('clients')
        .select('client_name, representative_name');
      
      if (error) {
        console.error("Error fetching clients:", error);
        return;
      }

      const combined = clientsTable || [];
      setClients(combined);

      const representatives = combined
        .map((c) => c.representative_name)
        .filter((name): name is string => typeof name === 'string' && name.trim() !== "");

      const uniqueReps = Array.from(new Set(representatives)) as string[];

      setAllRepresentatives(uniqueReps);
      setFilteredReps(uniqueReps);
    };
    fetchData();
  }, []);

  const handleClientChange = (name: string) => {
    setSelectedClientName(name);
    
    const matches: string[] = clients
      .filter((c: any) => c.client_name === name && c.representative_name)
      .map((c: any) => c.representative_name as string);
    
    supabase.from('clients').select('estimate_fee').eq('client_name', name).maybeSingle()
      .then(({ data }) => setRegisteredFee(data?.estimate_fee || 0));
      
    if (matches.length > 0) {
      const uniqueReps = Array.from(new Set(matches)) as string[];
      setFilteredReps(uniqueReps);
      setRepresentative(uniqueReps.length === 1 ? uniqueReps[0] : "");
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
    
    const currentPlotAreaNum = parseFloat(plotArea.toString().replace(/,/g, '')) || 0;
    if (currentPlotAreaNum > 0 && newArea > currentPlotAreaNum) {
      alert(`Validation Warning: Floor "${floor}" area (${newArea} SQ.FT) cannot exceed Plot Area (${currentPlotAreaNum} SQ.FT)!`);
      return;
    }

    const updatedFloorData = { ...floorData, [floor]: { length: validLength, width: validWidth, area: newArea } };
    setFloorData(updatedFloorData);
  };

  useEffect(() => {
    let newTotal = 0;
    const currentPlotAreaNum = parseFloat(plotArea.toString().replace(/,/g, '')) || 0;

    Object.entries(floorData).forEach(([f, data]) => {
      if (selectedFloors.includes(f)) {
        const floorArea = data?.area || 0;
        if (currentPlotAreaNum > 0 && floorArea > currentPlotAreaNum) {
          return;
        }
        newTotal += floorArea;
      }
    });
    setTotalBuiltUpArea(newTotal);
    setAmount(parseFloat((newTotal * rate).toFixed(2)));
  }, [floorData, selectedFloors, rate, plotArea]);

  const residentialFloors = selectedFloors.filter((f) => f !== "BASEMENT" && f !== "TOWER");
  const floorCount = residentialFloors.length;
  const hasTower = selectedFloors.includes("TOWER");

  const lastResidentialFloor = residentialFloors[residentialFloors.length - 1];
  const lastFloorLength = floorData[lastResidentialFloor]?.length || 0;
  const lastFloorWidth = floorData[lastResidentialFloor]?.width || 0;
  const staircaseCount = floorCount;

  let doorCount = 0;
  if (totalBuiltUpArea <= 600) { doorCount = 4 * floorCount; }
  else if (totalBuiltUpArea <= 1000) { doorCount = 5 * floorCount; }
  else if (totalBuiltUpArea <= 1500) { doorCount = 6 * floorCount; }
  else if (totalBuiltUpArea <= 2000) { doorCount = 8 * floorCount; }
  else { doorCount = 8 + Math.ceil((totalBuiltUpArea - 2000) / 500); }
  if (hasTower) { doorCount += 1; }
  const windowCount = doorCount * 2;

  const getPlotMasterData = async () => {
    const width = Number(floorData["GROUND FLOOR"]?.width || 0);
    const length = Number(floorData["GROUND FLOOR"]?.length || 0);
    const area = Number(floorData["GROUND FLOOR"]?.area || 0);
    
    const { data } = await supabase
      .from("plot_master")
      .select("*")
      .eq("builtup_area_sqft", area)
      .eq("width_feet", width)
      .eq("length_feet", length)
      .limit(1);
      
    if (data && data.length > 0) return data[0];

    const { data: allRows } = await supabase.from("plot_master").select("*");
    if (!allRows || allRows.length === 0) return null;

    return allRows.sort((a, b) => {
      const scoreA = Math.abs(a.width_feet - width) + Math.abs(a.length_feet - length) + Math.abs(a.builtup_area_sqft - area);
      const scoreB = Math.abs(b.width_feet - width) + Math.abs(b.length_feet - length) + Math.abs(b.builtup_area_sqft - area);
      return scoreA - scoreB;
    })[0];
  };

  const getSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    
    const costs = new Array();
    for (let i = 0; i <= longer.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= shorter.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (longer.charAt(i - 1) !== shorter.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[shorter.length] = lastValue;
    }
    const distance = costs[shorter.length];
    return (longer.length - distance) / longer.length;
  };

  const handleGenerate = async () => {
    if (!selectedClientName.trim() || !representative.trim()) {
      alert("Validation Error: Please select both Client Name and Representative.");
      return;
    }

    const storedData = JSON.parse(localStorage.getItem("estimateData") || localStorage.getItem("estimatePreview") || "{}");
    const plotAreaNum = parseFloat(plotArea.toString().replace(/,/g, '')) || 0;
    
    if (!customerName.trim() || !propertyAddress.trim() || !plotArea || rate <= 0 || Object.keys(floorData).length === 0) {
      alert("Validation Error: Please fill in all required fields and ensure floor dimensions are provided.");
      return;
    }
    
    for (const floor of selectedFloors) {
      const floorArea = floorData[floor]?.area || 0;
      if (plotAreaNum > 0 && floorArea > plotAreaNum) {
        alert(`Validation Error: Floor "${floor}" area (${floorArea} SQ.FT) exceeds Plot Area (${plotAreaNum} SQ.FT). Cannot generate estimate.`);
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please login to generate estimate.");
      return;
    }

    const plotMaster = await getPlotMasterData();
    const finalFee = feeMode === "AUTO" ? registeredFee : manualFee;

    const oldName = storedData.customer_name || "";
    const oldAddress = storedData.property_address || "";
    const nameSimilarity = getSimilarity(customerName, oldName);
    const addressSimilarity = getSimilarity(propertyAddress, oldAddress);
    
    const needsNewRef = !storedData.ref_no || nameSimilarity < 0.8 || addressSimilarity < 0.8;
    const finalRefNo = needsNewRef ? "REF-" + Date.now() : storedData.ref_no;
    setCurrentRefNo(finalRefNo);

    const cleanedFloorDetails: any = {};
    selectedFloors.forEach(f => {
      if (floorData[f]) {
        cleanedFloorDetails[f] = floorData[f];
      }
    });

    const estimateData = {
      ref_no: finalRefNo,
      id: storedData.id || null,
      customer_name: customerName,
      client_name: selectedClientName,
      representative: representative,
      property_address: propertyAddress,
      plot_area: plotArea,
      selected_floors: selectedFloors,
      selected_items: selectedItems,
      floor_wise_items: floorWiseItems,
      floor_details: cleanedFloorDetails,
      total_builtup_area: totalBuiltUpArea,
      rate_per_sqft: rate,
      construction_cost: amount,
      total_value: amount,
      fee_amount: finalFee,
      fee_mode: feeMode,
      estimate_type: "REMAINING WORK",
      plotMaster,
      floor_count: floorCount,
      has_tower: hasTower,
      last_floor_length: lastFloorLength,
      last_floor_width: lastFloorWidth,
      staircase_count: staircaseCount,
      door_count: doorCount,
      window_count: windowCount,
    };
    
    localStorage.setItem("estimatePreview", JSON.stringify(estimateData));
    router.push("/remaining-work-estimate-preview"); 
  };
  
  const handleClear = () => {
    localStorage.removeItem("estimateData");
    localStorage.removeItem("estimatePreview");
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
    setSelectedItems(AVAILABLE_CORE_ITEMS.map(i => i.id));
    setFloorWiseItems({ "GROUND FLOOR": AVAILABLE_CORE_ITEMS.map(i => i.id) });
    window.location.reload();
  };

  const isClientFilled = selectedClientName.trim() !== "" && representative.trim() !== "";
  const isCustomerFilled = isClientFilled && customerName.trim() !== "";
  const isAddressFilled = isCustomerFilled && propertyAddress.trim() !== "";
  const isPlotFilled = isAddressFilled && plotArea.trim() !== "";

  return (
    <div className="w-full max-w-5xl mx-auto p-2 sm:p-6 font-sans uppercase text-sm sm:text-lg text-black border border-black bg-white shadow-lg leading-tight overflow-x-auto">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center border-2 border-black bg-gray-100 p-3 mb-4 gap-2">
        <div className="hidden sm:block w-24"></div>
        <h1 className="text-xl sm:text-2xl font-bold text-center flex-1">REMAINING WORK ESTIMATE INPUT FORM</h1>
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
          <select className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg" disabled>
            <option>REMAINING WORK</option>
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

      {/* Plot Area, Floor Selection & Global Items */}
      <div className={`grid grid-cols-1 sm:grid-cols-10 gap-2 md:gap-4 mb-4 items-center border-t border-black pt-4 ${!isAddressFilled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="col-span-1 sm:col-span-3">
          <label className="font-bold block text-xs sm:text-lg">PLOT AREA</label>
          <div className="relative flex items-center">
            <input type="text" placeholder="0.00" disabled={!isAddressFilled} value={plotArea ? plotArea : ""} onChange={(e) => handlePlotAreaChange(e.target.value)} className="w-full border border-black p-2 uppercase text-center text-sm sm:text-lg h-[42px]" />
            <span className="absolute right-2 text-black font-bold text-xs sm:text-base pointer-events-none">SQ. FT</span>
          </div>
        </div>
        <div className="col-span-1 sm:col-span-4">
          <label className="font-bold block text-xs sm:text-lg">SELECT FLOORS: ({selectedFloors.length} SELECTED)</label>
          <button disabled={!isPlotFilled} onClick={() => { setTempSelectedFloors(selectedFloors); setIsFloorModalOpen(true); }} className={`border border-black px-4 py-2 font-bold text-xs sm:text-base bg-gray-100 hover:bg-gray-200 w-full h-[42px] ${!isPlotFilled ? 'cursor-not-allowed' : ''}`}>+ CHOOSE FLOORS</button>
        </div>
        <div className="col-span-1 sm:col-span-3">
          <label className="font-bold block text-xs sm:text-lg">GLOBAL WORK ITEMS</label>
          <button disabled={!isPlotFilled} onClick={() => { setTempSelectedItems(selectedItems); setIsItemModalOpen(true); }} className={`border border-black px-4 py-2 font-bold text-xs sm:text-base bg-gray-100 hover:bg-gray-200 w-full h-[42px] ${!isPlotFilled ? 'cursor-not-allowed' : ''}`}>+ CHOOSE GLOBAL ITEMS</button>
        </div>
      </div>

      {/* Built Up Area & Floor-Wise Remaining Work Details */}
      <div className={`mt-4 border border-black rounded-none overflow-hidden ${!isPlotFilled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="bg-[#1e293b] text-white py-2.5 font-bold uppercase tracking-wider text-center text-sm sm:text-lg">BUILT UP AREA & FLOOR-WISE REMAINING WORK DETAILS</div>
        <div className="flex flex-col">
          {["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"]
            .filter(f => selectedFloors.includes(f))
            .map((f) => {
              const currentFloorItems = floorWiseItems[f] || AVAILABLE_CORE_ITEMS.map(i => i.id);
              const currentArea = floorData[f]?.area || 0;
              const plotAreaNum = parseFloat(plotArea.toString().replace(/,/g, '')) || 0;
              const isExceeding = plotAreaNum > 0 && currentArea > plotAreaNum;

              return (
                <div key={f} className={`grid grid-cols-12 items-center border-b border-black bg-white p-2.5 ${isExceeding ? 'bg-red-50' : ''}`}>
                  <span className="col-span-4 sm:col-span-3 font-bold text-black uppercase text-xs sm:text-lg text-center border-r border-black">{f}</span>
                  <div className={`col-span-4 sm:col-span-3 grid grid-cols-2 gap-0 border-r px-1 ${isExceeding ? 'border-red-500 bg-red-100' : 'border-black'}`}>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      placeholder="W" 
                      value={floorData[f]?.width || ""} 
                      className={`w-full text-center bg-transparent outline-none text-xs sm:text-lg font-bold ${isExceeding ? 'text-red-700' : 'text-black'}`} 
                      onChange={(e) => updateArea(f, floorData[f]?.length || 0, parseFloat(e.target.value) || 0)} 
                    />
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      placeholder="L" 
                      value={floorData[f]?.length || ""} 
                      className={`w-full text-center bg-transparent outline-none text-xs sm:text-lg font-bold border-l ${isExceeding ? 'border-red-300 text-red-700' : 'border-gray-300 text-black'}`} 
                      onChange={(e) => updateArea(f, parseFloat(e.target.value) || 0, floorData[f]?.width || 0)} 
                    />
                  </div>
                  <input 
                    type="text" 
                    readOnly 
                    value={`${currentArea} SQ.FT`} 
                    className={`col-span-4 sm:col-span-2 p-2.5 text-center font-bold text-xs sm:text-base bg-transparent border-r border-black ${isExceeding ? 'text-red-600 font-extrabold' : 'text-black'}`} 
                  />
                  <div className="col-span-12 sm:col-span-4 flex items-center justify-between px-2 mt-2 sm:mt-0">
                    <span className="text-xs sm:text-sm font-semibold text-gray-700">{currentFloorItems.length} items chosen</span>
                    <button 
                      onClick={() => {
                        setActiveItemFloor(f);
                        setTempFloorWiseItems(currentFloorItems);
                      }} 
                      className="border border-black px-3 py-1.5 text-xs sm:text-sm font-bold bg-gray-100 hover:bg-gray-200 uppercase"
                    >
                      Configure Work
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Summary Calculation Bar */}
      <div className={`grid grid-cols-2 sm:grid-cols-5 mb-3 mt-4 items-center gap-2 ${totalBuiltUpArea <= 0 ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="col-span-1">
          <label className="font-bold block text-xs sm:text-lg">TOTAL AREA</label>
          <input type="text" readOnly value={`${totalBuiltUpArea} SQ.FT`} className="w-full border border-black p-2 uppercase text-center bg-gray-100 font-bold text-xs sm:text-lg" />
        </div>
        <div className="text-center font-bold text-lg hidden sm:block">X</div>
        <div className="col-span-1">
          <label className="font-bold block text-xs sm:text-lg">RATE / SQ.FT</label>
          <input type="number" step="0.01" placeholder="RATE / SQ.FT" value={rate || ""} onChange={(e) => { const r = parseFloat(e.target.value) || 0; setRate(r); setAmount(parseFloat((r * totalBuiltUpArea).toFixed(2))); }} className="w-full text-center border border-black p-2 uppercase text-xs sm:text-lg" />
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
            className="w-full border border-black p-2 uppercase text-center bg-gray-100 font-bold text-xs sm:text-lg" 
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 border-t border-black pt-4">
        <button onClick={handleGenerate} className="bg-black text-white px-6 py-3 font-bold uppercase text-sm sm:text-lg w-full sm:w-auto">GENERATE ESTIMATE</button>
        <button onClick={handleClear} className="bg-red-600 text-white px-6 py-3 font-bold uppercase text-sm sm:text-lg w-full sm:w-auto">Clear Data</button>
      </div>

      <datalist id="clients-list">{[...new Set(clients.map(c => c.client_name))].map((name, i) => <option key={i} value={name} />)}</datalist>
      <datalist id="reps-list">{filteredReps.map((rep, i) => <option key={i} value={rep} />)}</datalist>

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
                const newSelected = [...tempSelectedFloors].sort((a, b) => floorSequence.indexOf(a) - floorSequence.indexOf(b));
                setSelectedFloors(newSelected);

                setFloorData(prev => {
                  const updatedData = { ...prev };
                  Object.keys(updatedData).forEach(f => {
                    if (!newSelected.includes(f)) {
                      delete updatedData[f];
                    }
                  });
                  return updatedData;
                });

                setFloorWiseItems(prev => {
                  const updated = { ...prev };
                  Object.keys(updated).forEach(f => {
                    if (!newSelected.includes(f)) {
                      delete updated[f];
                    }
                  });
                  newSelected.forEach(f => {
                    if (!updated[f]) {
                      const isGroundOrBasement = f === "GROUND FLOOR" || f === "BASEMENT";
                      const defaultItemsForFloor = AVAILABLE_CORE_ITEMS
                        .filter(item => {
                          if (!isGroundOrBasement && GROUND_ONLY_ITEMS.includes(item.id)) return false;
                          return true;
                        })
                        .map(i => i.id);
                      updated[f] = defaultItemsForFloor;
                    }
                  });
                  return updated;
                });

                setIsFloorModalOpen(false);
              }}>ADD SELECTED</button>
            </div>
          </div>
        </div>
      )}

      {/* Global Items Selector Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 border border-black w-full max-w-[480px] uppercase text-xs sm:text-base">
            <h2 className="font-bold mb-4 border-b border-black pb-2 text-sm sm:text-lg">SELECT GLOBAL STRUCTURAL & FINISHING ITEMS</h2>
            <div className="flex gap-2 mb-3">
              <button className="text-xs sm:text-sm border px-2 py-1 bg-gray-100" onClick={() => setTempSelectedItems(AVAILABLE_CORE_ITEMS.map(i => i.id))}>Select All</button>
              <button className="text-xs sm:text-sm border px-2 py-1 bg-gray-100" onClick={() => setTempSelectedItems([])}>Deselect All</button>
            </div>
            <div className="space-y-2 max-h-[380px] overflow-auto mb-4 pr-1">
              {AVAILABLE_CORE_ITEMS.map((item) => (
                <label key={item.id} className="flex items-center gap-3 cursor-pointer p-2 border-b">
                  <input type="checkbox" checked={tempSelectedItems.includes(item.id)} onChange={() => setTempSelectedItems(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])} />
                  {item.label}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button className="border border-black px-4 py-2" onClick={() => setIsItemModalOpen(false)}>CANCEL</button>
              <button className="bg-black text-white px-4 py-2 font-bold" onClick={() => {
                setSelectedItems(tempSelectedItems);
                setFloorWiseItems(prev => {
                  const updated = { ...prev };
                  selectedFloors.forEach(f => {
                    const isGroundOrBasement = f === "GROUND FLOOR" || f === "BASEMENT";
                    updated[f] = tempSelectedItems.filter(id => {
                      if (!isGroundOrBasement && GROUND_ONLY_ITEMS.includes(id)) return false;
                      return true;
                    });
                  });
                  return updated;
                });
                setIsItemModalOpen(false);
              }}>APPLY GLOBALLY</button>
            </div>
          </div>
        </div>
      )}

      {/* Floor-Specific Work Configuration Modal */}
      {activeItemFloor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 border border-black w-full max-w-[480px] uppercase text-xs sm:text-base">
            <h2 className="font-bold mb-4 border-b border-black pb-2 text-sm sm:text-lg">CONFIG REMAINING WORK FOR: {activeItemFloor}</h2>
            <div className="flex gap-2 mb-3">
              <button className="text-xs sm:text-sm border px-2 py-1 bg-gray-100" onClick={() => {
                const isGroundOrBasement = activeItemFloor === "GROUND FLOOR" || activeItemFloor === "BASEMENT";
                const allowed = AVAILABLE_CORE_ITEMS
                  .filter(item => {
                    if (!isGroundOrBasement && GROUND_ONLY_ITEMS.includes(item.id)) return false;
                    return true;
                  })
                  .map(i => i.id);
                setTempFloorWiseItems(allowed);
              }}>Select All</button>
              <button className="text-xs sm:text-sm border px-2 py-1 bg-gray-100" onClick={() => setTempFloorWiseItems([])}>Deselect All</button>
            </div>
            <div className="space-y-2 max-h-[380px] overflow-auto mb-4 pr-1">
              {AVAILABLE_CORE_ITEMS
                .filter(item => {
                  const isGroundOrBasement = activeItemFloor === "GROUND FLOOR" || activeItemFloor === "BASEMENT";
                  if (!isGroundOrBasement && GROUND_ONLY_ITEMS.includes(item.id)) return false;
                  return true;
                })
                .map((item) => (
                  <label key={item.id} className="flex items-center gap-3 cursor-pointer p-2 border-b">
                    <input 
                      type="checkbox" 
                      checked={tempFloorWiseItems.includes(item.id)} 
                      onChange={() => setTempFloorWiseItems(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id])} 
                    />
                    {item.label}
                  </label>
                ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button className="border border-black px-4 py-2" onClick={() => setActiveItemFloor(null)}>CANCEL</button>
              <button className="bg-black text-white px-4 py-2 font-bold" onClick={() => {
                setFloorWiseItems(prev => ({
                  ...prev,
                  [activeItemFloor]: tempFloorWiseItems
                }));
                setActiveItemFloor(null);
              }}>SAVE FLOOR WORK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}