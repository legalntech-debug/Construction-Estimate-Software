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

// Comprehensive checklist including Structural and all requested Finishing items
const AVAILABLE_CORE_ITEMS = [
  // Structural & Masonry Items
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
  { id: "parapet_wall", label: "Parapet Wall" },
  { id: "terrace_coba", label: "Terrace Coba Waterproofing" },
  
  // Finishing & Specialized Items
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
  
  // Item selection states
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>(AVAILABLE_CORE_ITEMS.map(i => i.id));
  const [tempSelectedItems, setTempSelectedItems] = useState<string[]>(selectedItems);

  const [floorData, setFloorData] = useState<Record<string, { length: number; width: number; area: number }>>({});
  const [rate, setRate] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [feeMode, setFeeMode] = useState("AUTO");
  const [manualFee, setManualFee] = useState<number>(0);
  const [registeredFee, setRegisteredFee] = useState<number>(0);
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
        setRate(Number(parsed.rate_per_sqft) || 0);
        setFeeMode(parsed.fee_mode || "AUTO");
        if (parsed.fee_amount) setManualFee(parsed.fee_amount);
        if (parsed.floor_details) {
          setFloorData(parsed.floor_details);
          setSelectedFloors(Object.keys(parsed.floor_details));
          const totalArea = Object.values(parsed.floor_details).reduce(
            (sum: number, f: any) => sum + Number(f.area || 0), 0
          );
          setAmount(Number(totalArea) * Number(parsed.rate_per_sqft || 0));
        }
        if (parsed.selected_items && Array.isArray(parsed.selected_items)) {
          setSelectedItems(parsed.selected_items);
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

  const updateArea = (floor: string, l: number, w: number) => {
    const newArea = parseFloat((l * w).toFixed(2));
    const plotAreaNum = parseFloat(plotArea) || 0;
    if (plotAreaNum > 0 && newArea > plotAreaNum) {
      alert(`Validation Error: Area exceeds plot area.`);
      return;
    }
    const updatedFloorData = { ...floorData, [floor]: { length: l, width: w, area: newArea } };
    setFloorData(updatedFloorData);
    const newTotal = Object.values(updatedFloorData).reduce((sum, f) => sum + (f.area || 0), 0);
    setAmount(parseFloat((newTotal * rate).toFixed(2)));
  };

  const totalBuiltUpArea = Object.values(floorData).reduce((sum, f) => sum + (f.area || 0), 0);
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
    const manualTotalBuiltUp = Object.values(floorData).reduce((sum, f) => sum + (f.area || 0), 0);
    
    if (!customerName.trim() || !propertyAddress.trim() || !plotArea || rate <= 0 || Object.keys(floorData).length === 0) {
      alert("Validation Error: Please fill in all required fields and ensure floor dimensions are provided.");
      return;
    }
    
    for (const floor of selectedFloors) {
      const floorArea = floorData[floor]?.area || 0;
      if (floorArea > plotAreaNum) {
        alert(`Validation Error: The area for ${floor} (${floorArea} SQ.FT) exceeds the plot area (${plotAreaNum} SQ.FT).`);
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
      floor_details: floorData,
      total_builtup_area: manualTotalBuiltUp,
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
    setSelectedItems(AVAILABLE_CORE_ITEMS.map(i => i.id));
  };

  return (
    <div className="p-6 font-sans uppercase text-lg text-black max-w-5xl mx-auto border border-black bg-white shadow-lg leading-tight">
      <h1 className="text-2xl font-bold text-center border-2 border-black bg-gray-100 p-1 mb-2">REMAINING WORK ESTIMATE INPUT FORM</h1>
      
      <div className="grid grid-cols-7 gap-4 mb-4 border-b border-black pb-4">
        <div className="col-span-2">
          <label className="font-bold block text-[12pt]">CASE TYPE</label>
          <select className="w-full border border-black p-1 uppercase text-center">
            <option>REMAINING WORK</option>
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
          <datalist id="clients-list">{[...new Set(clients.map(c => c.client_name))].map((name, i) => <option key={i} value={name} />)}</datalist>
        </div>
        <div className="col-span-2">
          <label className="font-bold block text-[12pt]">REPRESENTATIVE</label>
          <input list="reps-list" value={representative} onChange={(e) => setRepresentative(e.target.value)} className="w-full border border-black p-1 uppercase text-center" placeholder="SEARCH REP..." />
          <datalist id="reps-list">{filteredReps.map((rep, i) => <option key={i} value={rep} />)}</datalist>
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

      <div className="grid grid-cols-10 gap-4 mb-1 items-center border-t border-black pt-2">
        <div className="col-span-3">
          <label className="font-bold block text-[12pt]">PLOT AREA</label>
          <div className="relative flex items-center">
            <input type="text" placeholder="0.00" value={plotArea ? Number(plotArea).toLocaleString('en-IN') : ""} onChange={(e) => { const val = e.target.value.replace(/[^0-9.]/g, ''); setPlotArea(val); }} className="w-full border border-black p-1 uppercase text-center text-xl" />
            <span className="absolute right-2 text-black font-bold text-[10pt] pointer-events-none">SQ. FT</span>
          </div>
        </div>
        <div className="col-span-4">
          <label className="font-bold block text-[12pt]">SELECT FLOORS: ({selectedFloors.length} SELECTED)</label>
          <button onClick={() => { setTempSelectedFloors(selectedFloors); setIsFloorModalOpen(true); }} className="border border-black px-6 py-1 font-bold text-[10pt] mt-1 bg-gray-100 hover:bg-gray-200 w-full">+ CHOOSE FLOORS</button>
        </div>
        <div className="col-span-3">
          <label className="font-bold block text-[12pt]">SELECT WORK ITEMS: ({selectedItems.length} SELECTED)</label>
          <button onClick={() => { setTempSelectedItems(selectedItems); setIsItemModalOpen(true); }} className="border border-black px-6 py-1 font-bold text-[10pt] mt-1 bg-gray-100 hover:bg-gray-200 w-full">+ CHOOSE ITEMS</button>
        </div>
      </div>

      <div className="mt-4 border border-black rounded-none overflow-hidden">
        <div className="bg-[#1e293b] text-white py-2 font-bold uppercase tracking-wider text-center text-[12pt]">BUILT UP AREA DETAILS</div>
        <div className="flex flex-col">
          {["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"]
            .filter(f => selectedFloors.includes(f))
            .map((f) => (
              <div key={f} className="grid grid-cols-12 items-center border-b border-black bg-white">
                <span className="col-span-4 font-bold text-black uppercase text-[12pt] p-2 text-center border-r border-black">{f}</span>
                <div className="col-span-4 grid grid-cols-2 gap-0 border-r border-black">
                  <input type="number" step="0.01" placeholder="W (FEET)" value={floorData[f]?.width || ""} className="w-full text-center border-none bg-transparent outline-none" onChange={(e) => updateArea(f, floorData[f]?.length || 0, parseFloat(e.target.value) || 0)} />
                  <input type="number" step="0.01" placeholder="L (FEET)" value={floorData[f]?.length || ""} className="w-full text-center border-none bg-transparent outline-none" onChange={(e) => updateArea(f, parseFloat(e.target.value) || 0, floorData[f]?.width || 0)} />
                </div>
                <input type="text" readOnly value={`${floorData[f]?.area || 0} SQ.FT`} className="col-span-4 p-2 text-center font-bold text-black text-[12pt] bg-transparent" />
              </div>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-5 mb-3 mt-4 items-center">
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">TOTAL AREA</label>
          <input type="text" readOnly value={`${totalBuiltUpArea} SQ.FT`} className="w-full border border-black p-1 uppercase text-center bg-gray-100 font-bold" />
        </div>
        <div className="text-center font-bold text-lg">X</div>
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">RATE / SQ.FT</label>
          <input type="number" step="0.01" placeholder="RATE / SQ.FT" value={rate || ""} onChange={(e) => { const r = parseFloat(e.target.value) || 0; setRate(r); setAmount(parseFloat((r * totalBuiltUpArea).toFixed(2))); }} className="w-full text-center border border-black p-1 uppercase" />
        </div>
        <div className="text-center font-bold text-lg">=</div>
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">TOTAL AMOUNT</label>
          <input type="text" readOnly value={amount ? amount.toLocaleString('en-IN') + "/-" : ""} className="w-full border border-black p-1 uppercase text-center bg-gray-100 font-bold" />
        </div>
      </div>

      <div className="flex gap-4 border-t border-black pt-4">
        <button onClick={handleGenerate} className="bg-black text-white px-6 py-2 font-bold uppercase">GENERATE ESTIMATE</button>
        <button onClick={handleClear} className="bg-red-600 text-white px-6 py-2 font-bold uppercase">Clear Data</button>
      </div>

      {/* Floor Selection Modal */}
      {isFloorModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 border border-black w-[400px] uppercase text-[9pt]">
            <h2 className="font-bold mb-4 border-b border-black pb-2 text-[11pt]">SELECT FLOORS</h2>
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
                setSelectedFloors([...tempSelectedFloors].sort((a, b) => floorSequence.indexOf(a) - floorSequence.indexOf(b)));
                setIsFloorModalOpen(false);
              }}>ADD SELECTED</button>
            </div>
          </div>
        </div>
      )}

      {/* Item Checklist Modal for Remaining Work */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 border border-black w-[480px] uppercase text-[9pt]">
            <h2 className="font-bold mb-4 border-b border-black pb-2 text-[11pt]">SELECT STRUCTURAL & FINISHING ITEMS</h2>
            <div className="flex gap-2 mb-3">
              <button className="text-xs border px-2 py-1 bg-gray-100" onClick={() => setTempSelectedItems(AVAILABLE_CORE_ITEMS.map(i => i.id))}>Select All</button>
              <button className="text-xs border px-2 py-1 bg-gray-100" onClick={() => setTempSelectedItems([])}>Deselect All</button>
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
                setIsItemModalOpen(false);
              }}>APPLY ITEMS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}