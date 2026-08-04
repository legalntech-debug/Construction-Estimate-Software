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

const PLOT_SHAPES = [
  "RECTANGULAR",
  "SQUARE",
  "IRREGULAR / L-SHAPE",
  "TRAPEZOIDAL",
  "POLYGON"
];

const ROAD_FACING_OPTIONS = [
  "1 SIDE ROAD (NORTH)",
  "1 SIDE ROAD (SOUTH)",
  "1 SIDE ROAD (EAST)",
  "1 SIDE ROAD (WEST)",
  "CORNER (2 SIDE ROAD: NORTH & EAST)",
  "CORNER (2 SIDE ROAD: SOUTH & EAST)",
  "CORNER (2 SIDE ROAD: NORTH & WEST)",
  "CORNER (2 SIDE ROAD: SOUTH & WEST)",
  "2 SIDE FRONT & REAR (NORTH & SOUTH)",
  "2 SIDE FRONT & REAR (EAST & WEST)",
  "3 SIDE ROAD",
  "4 SIDE ROAD (ISLAND / OPEN)"
];

export default function ConstructionPlanInputPage() {
  const router = useRouter();

  const [clients, setClients] = useState<any[]>([]);
  const [representative, setRepresentative] = useState("");
  const [filteredReps, setFilteredReps] = useState<string[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [allRepresentatives, setAllRepresentatives] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  
  const [plotShape, setPlotShape] = useState("RECTANGULAR");
  const [isCadModalOpen, setIsCadModalOpen] = useState(false);
  const [roadFacingOption, setRoadFacingOption] = useState("1 SIDE ROAD (SOUTH)");
  
  const [dimNorth, setDimNorth] = useState<number>(20);
  const [dimSouth, setDimSouth] = useState<number>(20);
  const [dimEast, setDimEast] = useState<number>(40);
  const [dimWest, setDimWest] = useState<number>(40);

  const [boundaryNorth, setBoundaryNorth] = useState("ARAJI OF DEEPAK SINGH");
  const [boundarySouth, setBoundarySouth] = useState("20' WIDE ROAD");
  const [boundaryEast, setBoundaryEast] = useState("ARAJI OF SANCHIT SHUKLA");
  const [boundaryWest, setBoundaryWest] = useState("REMAINING ARAJI OF THE SELLER");
  
  const [coverageType, setCoverageType] = useState("100% COVERAGE");

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
  const [currentRefNo, setCurrentRefNo] = useState("");
  const [caseType, setCaseType] = useState("NEW CONSTRUCTION DESIGN");

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
        if (parsed.plot_shape) setPlotShape(parsed.plot_shape);
        if (parsed.fee_amount) setManualFee(parsed.fee_amount);
        if (parsed.floor_details) {
          setFloorData(parsed.floor_details);
          setSelectedFloors(Object.keys(parsed.floor_details));
          const totalArea = Object.values(parsed.floor_details).reduce(
            (sum: number, f: any) => sum + Number(f.area || 0), 0
          );
          setAmount(Number(totalArea) * Number(parsed.rate_per_sqft || 0));
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

  useEffect(() => {
    const avgWidth = (dimNorth + dimSouth) / 2;
    const avgLength = (dimEast + dimWest) / 2;
    const calculatedArea = Math.round(avgWidth * avgLength);
    if (calculatedArea > 0) {
      setPlotArea(calculatedArea.toString());
    }
  }, [dimNorth, dimSouth, dimEast, dimWest]);

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
      alert(`Validation Error: Floor area cannot exceed plot area.`);
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

  let doorCount = 0;
  if (totalBuiltUpArea <= 600) { doorCount = 4 * floorCount; }
  else if (totalBuiltUpArea <= 1000) { doorCount = 5 * floorCount; }
  else if (totalBuiltUpArea <= 1500) { doorCount = 6 * floorCount; }
  else if (totalBuiltUpArea <= 2000) { doorCount = 8 * floorCount; }
  else { doorCount = 8 + Math.ceil((totalBuiltUpArea - 2000) / 500); }
  if (hasTower) { doorCount += 1; }
  const windowCount = doorCount * 2;

  const handleGenerate = async () => {
    if (!selectedClientName.trim() || !representative.trim()) {
      alert("Validation Error: Please select both Client Name and Representative.");
      return;
    }

    const manualTotalBuiltUp = Object.values(floorData).reduce((sum, f) => sum + (f.area || 0), 0);
    
    if (!customerName.trim() || !propertyAddress.trim() || !plotArea || rate <= 0 || Object.keys(floorData).length === 0) {
      alert("Validation Error: Please fill in all required fields and floor dimensions.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please login to generate blueprint plan.");
      return;
    }

    const finalFee = feeMode === "AUTO" ? registeredFee : manualFee;

    const planData = {
      ref_no: currentRefNo || "PLAN-" + Date.now(),
      customer_name: customerName,
      client_name: selectedClientName,
      representative: representative,
      property_address: propertyAddress,
      plot_area: plotArea,
      plot_shape: plotShape,
      road_side: roadFacingOption,
      dimensions: { north: dimNorth, south: dimSouth, east: dimEast, west: dimWest },
      boundaries: { north: boundaryNorth, south: boundarySouth, east: boundaryEast, west: boundaryWest },
      coverage_type: coverageType,
      selected_floors: selectedFloors,
      floor_details: floorData,
      total_builtup_area: manualTotalBuiltUp,
      rate_per_sqft: rate,
      total_value: amount,
      fee_amount: finalFee,
      fee_mode: feeMode,
      case_type: caseType,
      floor_count: floorCount,
      has_tower: hasTower,
      door_count: doorCount,
      window_count: windowCount,
    };
    
    localStorage.setItem("estimatePreview", JSON.stringify(planData));
    router.push("/estimate-preview");
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
  };

  const topWidthPx = Math.max(120, Math.round(dimNorth * 9));
  const bottomWidthPx = Math.max(120, Math.round(dimSouth * 9));
  const vertDim = (dimEast + dimWest) / 2 || 40;
  const heightPx = Math.max(140, Math.round(vertDim * 6.5));

  return (
  <div className="p-6 font-sans uppercase text-lg text-black max-w-5xl mx-auto border border-black bg-white shadow-lg leading-tight">
    <h1 className="text-xl font-bold text-center border-2 border-black bg-gray-100 p-2 mb-3">
      🏗️ CONSTRUCTION PLAN & DESIGN INPUT FORM
    </h1>
    
    <div className="grid grid-cols-12 gap-2 mb-4 border-b border-black pb-4 items-center">
      <div className="col-span-3">
        <label className="font-bold block text-[10pt] mb-1">CASE TYPE</label>
        <select value={caseType} onChange={(e) => setCaseType(e.target.value)} className="w-full border border-black p-1 uppercase text-center text-xs font-bold bg-white">
          <option value="NEW CONSTRUCTION DESIGN">NEW CONSTRUCTION DESIGN</option>
          <option value="ARCHITECTURAL BLUEPRINT">ARCHITECTURAL BLUEPRINT</option>
          <option value="STRUCTURE DESIGN">STRUCTURE DESIGN</option>
        </select>
      </div>

      <div className="col-span-2">
        <label className="font-bold block text-[10pt] mb-1">FEE MODE</label>
        <select value={feeMode} onChange={(e) => setFeeMode(e.target.value)} className="w-full border border-black p-1 uppercase text-center text-xs font-bold bg-white">
          <option value="AUTO">AUTO</option>
          <option value="MANUAL">MANUAL</option>
        </select>
        {feeMode === "MANUAL" && (
          <input type="number" placeholder="FEE ₹" className="w-full border border-black p-1 mt-1 text-center text-xs font-bold" onChange={(e) => setManualFee(Number(e.target.value))} />
        )}
      </div>
      
      <div className="col-span-4">
        <label className="font-bold block text-[10pt] mb-1">CLIENT NAME</label>
        <input list="clients-list" value={selectedClientName} onChange={(e) => handleClientChange(e.target.value)} className="w-full border border-black p-1 uppercase text-center text-xs font-bold" placeholder="SEARCH CLIENT..." />
        <datalist id="clients-list">{[...new Set(clients.map(c => c.client_name))].map((name, i) => <option key={i} value={name} />)}</datalist>
      </div>

      <div className="col-span-3">
        <label className="font-bold block text-[10pt] mb-1">REPRESENTATIVE</label>
        <input list="reps-list" value={representative} onChange={(e) => setRepresentative(e.target.value)} className="w-full border border-black p-1 uppercase text-center text-xs font-bold" placeholder="SEARCH REP..." />
        <datalist id="reps-list">{filteredReps.map((rep, i) => <option key={i} value={rep} />)}</datalist>
      </div>
    </div>

    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-12 items-center gap-2">
        <label className="col-span-3 font-bold text-[11pt] border border-black p-2 bg-gray-100 text-center">CUSTOMER NAME</label>
        <textarea value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="col-span-9 border border-black p-2 uppercase text-left text-sm font-bold" rows={1} placeholder="ENTER CUSTOMER NAME..." />
      </div>
      <div className="grid grid-cols-12 items-center gap-2">
        <label className="col-span-3 font-bold text-[11pt] border border-black p-2 bg-gray-100 text-center">PROPERTY ADDRESS</label>
        <textarea value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} className="col-span-9 border border-black p-2 uppercase text-left text-sm font-bold" rows={2} placeholder="ENTER PROPERTY ADDRESS..." />
      </div>
    </div>

    <div className="grid grid-cols-10 gap-4 mb-3 items-center border-t border-black pt-3">
      <div className="col-span-4">
        <label className="font-bold block text-[11pt]">PLOT SHAPE & CAD SETUP</label>
        <div className="flex gap-2 mt-1">
          <select value={plotShape} onChange={(e) => setPlotShape(e.target.value)} className="w-full border border-black p-2 uppercase text-center text-xs font-bold bg-white">
            {PLOT_SHAPES.map((shape, idx) => (
              <option key={idx} value={shape}>{shape}</option>
            ))}
          </select>
          <button onClick={() => setIsCadModalOpen(true)} className="bg-blue-600 text-white px-3 py-1 font-bold text-xs uppercase whitespace-nowrap hover:bg-blue-700 shadow">
            OPEN CAD 🗺️
          </button>
        </div>
      </div>
      <div className="col-span-3">
        <label className="font-bold block text-[11pt]">PLOT AREA (AUTO)</label>
        <div className="relative flex items-center">
          <input type="text" readOnly placeholder="0.00" value={plotArea ? Number(plotArea).toLocaleString('en-IN') : ""} className="w-full border border-black p-1 uppercase text-center text-lg font-bold bg-gray-100" />
          <span className="absolute right-2 text-black font-bold text-[10pt] pointer-events-none">SQ. FT</span>
        </div>
      </div>
      <div className="col-span-3">
        <label className="font-bold block text-[11pt]">SELECT FLOORS: ({selectedFloors.length})</label>
        <button onClick={() => { setTempSelectedFloors(selectedFloors); setIsFloorModalOpen(true); }} className="border border-black px-4 py-1 font-bold text-[10pt] mt-1 bg-gray-100 hover:bg-gray-200 w-full">+ CHOOSE FLOOR</button>
      </div>
    </div>

    <div className="mt-4 border border-black rounded-none overflow-hidden">
      <div className="bg-[#1e293b] text-white py-2 font-bold uppercase tracking-wider text-center text-[11pt]">BUILT UP AREA DETAILS (WIDTH x LENGTH)</div>
      <div className="flex flex-col">
        {["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"]
          .filter(f => selectedFloors.includes(f))
          .map((f) => (
            <div key={f} className="grid grid-cols-12 items-center border-b border-black bg-white">
              <span className="col-span-4 font-bold text-black uppercase text-[11pt] p-2 text-center border-r border-black">{f}</span>
              <div className="col-span-4 grid grid-cols-2 gap-0 border-r border-black">
                <input type="number" step="0.01" placeholder="W (FT)" value={floorData[f]?.width || ""} className="w-full text-center border-none bg-transparent outline-none p-2 text-sm font-bold" onChange={(e) => updateArea(f, floorData[f]?.length || 0, parseFloat(e.target.value) || 0)} />
                <input type="number" step="0.01" placeholder="L (FT)" value={floorData[f]?.length || ""} className="w-full text-center border-none bg-transparent outline-none p-2 text-sm font-bold" onChange={(e) => updateArea(f, parseFloat(e.target.value) || 0, floorData[f]?.width || 0)} />
              </div>
              <input type="text" readOnly value={`${floorData[f]?.area || 0} SQ.FT`} className="col-span-4 p-2 text-center font-bold text-black text-[11pt] bg-transparent" />
            </div>
          ))}
      </div>
    </div>

    <div className="grid grid-cols-5 mb-4 mt-4 items-center">
      <div className="col-span-1">
        <label className="font-bold block text-[10pt]">TOTAL AREA</label>
        <input type="text" readOnly value={`${totalBuiltUpArea} SQ.FT`} className="w-full border border-black p-1 uppercase text-center bg-gray-100 font-bold text-sm" />
      </div>
      <div className="text-center font-bold text-lg">X</div>
      <div className="col-span-1">
        <label className="font-bold block text-[10pt]">RATE / SQ.FT</label>
        <input type="number" step="0.01" placeholder="RATE" value={rate || ""} onChange={(e) => { const r = parseFloat(e.target.value) || 0; setRate(r); setAmount(parseFloat((r * totalBuiltUpArea).toFixed(2))); }} className="w-full text-center border border-black p-1 uppercase text-sm font-bold" />
      </div>
      <div className="text-center font-bold text-lg">=</div>
      <div className="col-span-1">
        <label className="font-bold block text-[10pt]">TOTAL AMOUNT</label>
        <input type="text" readOnly value={amount ? amount.toLocaleString('en-IN') + "/-" : ""} className="w-full border border-black p-1 uppercase text-center bg-gray-100 font-bold text-sm" />
      </div>
    </div>

    <div className="flex gap-4 border-t border-black pt-4">
      <button onClick={handleGenerate} className="bg-black text-white px-6 py-2 font-bold uppercase text-sm hover:bg-gray-800">GENERATE PLAN</button>
      <button onClick={handleClear} className="bg-red-600 text-white px-6 py-2 font-bold uppercase text-sm hover:bg-red-700">CLEAR DATA</button>
    </div>

    {isCadModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-2">
        <div className="bg-white border-2 border-black w-full max-w-[96vw] h-[95vh] flex flex-col uppercase text-xs shadow-2xl">
          
          <div className="bg-black text-white p-3 flex justify-between items-center font-bold text-base">
            <span>📐 ENGINEERING DRAWING SITE PLAN ({plotShape}) — TRUE AutoCAD BLUEPRINT ENGINE</span>
            <button onClick={() => setIsCadModalOpen(false)} className="bg-red-600 text-white px-4 py-1 font-bold text-sm hover:bg-red-700">CLOSE [X]</button>
          </div>

          <div className="flex-1 grid grid-cols-12 overflow-hidden">
            
            {/* CAD Drawing Area */}
            <div className="col-span-9 border-r border-black p-4 flex flex-col bg-white overflow-hidden relative">
              
              <div className="flex justify-between items-center mb-2 border-b border-black pb-1">
                <span className="font-bold text-sm text-black">SITE PLAN — TRUE SCALE (NORTH: {dimNorth}' × SOUTH: {dimSouth}')</span>
                <div className="bg-yellow-300 text-black px-3 py-1 font-extrabold text-xs border border-black shadow">
                  🧭 NORTH DIRECTION
                </div>
              </div>

              <div className="flex-1 bg-white flex flex-col items-center justify-center relative p-6 overflow-auto">
                
                <div className="relative flex flex-col items-center justify-center">

                  {/* TOP DIRECTION TITLE (EXACT MATCH TO REFERENCE) */}
                 

                  <div className="flex items-center justify-center relative mt-2">
                    
                    {/* MAIN PLOT & CAD DIMENSION CONTAINER */}
                    <div className="relative flex flex-col items-center">
                      
                      {/* TOP CAD DIMENSION & BOUNDARY TEXT SECTION */}
                      <div className="relative mb-5 flex flex-col items-center justify-center" style={{ width: `${Math.max(topWidthPx, bottomWidthPx)}px` }}>
                        
                        {/* North Boundary Text */}
                        <div className="absolute -top-7 text-center font-bold text-xs text-black tracking-widest uppercase whitespace-nowrap">
                          {boundaryNorth}
                        </div>

                        {/* Top Dimension Line with Exact AutoCAD Arrows */}
                        <div className="relative w-full flex items-center justify-center" style={{ height: '20px' }}>
                          <svg className="absolute w-full overflow-visible" height="16" style={{ top: '2px' }}>
                            <line x1="0" y1="8" x2="100%" y2="8" stroke="black" strokeWidth="1" />
                            <polygon points="0,5 6,8 0,11" fill="black" />
                            <polygon points="100%,5 calc(100% - 6),8 100%,11" fill="black" />
                          </svg>
                          <span className="bg-white px-2 text-black font-bold text-xs z-10 relative" style={{ top: '-1px' }}>{dimNorth}'</span>
                        </div>
                      </div>

                      <div className="flex items-center relative">
                        
                        {/* LEFT SIDE: AutoCAD Style Vertical Dimension Line & Boundary Text */}
                        <div className="absolute -left-40 flex items-center flex-row-reverse" style={{ height: `${heightPx}px` }}>
                          
                          {/* Vertical Dimension Line */}
                          <div className="relative flex items-center justify-center ml-2" style={{ width: '24px', height: `${heightPx}px` }}>
                            <svg className="absolute h-full overflow-visible" width="16" style={{ right: '8px' }}>
                              <line x1="16" y1="0" x2="2" y2="0" stroke="black" strokeWidth="1" />
                              <line x1="16" y1="100%" x2="2" y2="100%" stroke="black" strokeWidth="1" />
                              <line x1="2" y1="0" x2="2" y2="100%" stroke="black" strokeWidth="1" />
                              <polygon points="5,0 2,5 -1,0" fill="black" />
                              <polygon points="5,100% 2,calc(100% - 5) -1,100%" fill="black" />
                            </svg>
                            <span className="bg-white py-0.5 px-0.5 font-bold text-[11px] z-10 relative text-center whitespace-nowrap text-black" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{dimWest}'</span>
                          </div>

                          {/* Left Boundary Text */}
                          <div className="font-bold text-xs text-black tracking-wider text-right mr-3" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxWidth: '140px', lineHeight: '1.2' }}>
                            {boundaryWest}
                          </div>

                        </div>

                        {/* PROPOSED SITE BOX WITH HATCHING */}
                        <div 
                          className="border-2 border-black relative flex items-center justify-center bg-white shadow-md"
                          style={{ 
                            width: `${Math.max(topWidthPx, bottomWidthPx)}px`, 
                            height: `${heightPx}px` 
                          }}
                        >
                          <div className="w-full h-full border border-red-500 flex items-center justify-center" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,0,0,0.12) 0, rgba(255,0,0,0.12) 6px, transparent 0, transparent 12px)' }}>
                            <div className="text-center font-bold text-red-900 text-xs tracking-wider">
                              PROPOSED<br/>SITE
                            </div>
                          </div>
                        </div>

                        {/* RIGHT SIDE: Vertical Boundary Text (AutoCAD Style) */}
                        <div className="absolute -right-32 flex items-center" style={{ height: `${heightPx}px` }}>
                          <div className="font-bold text-xs text-black tracking-wider whitespace-nowrap ml-3" style={{ writingMode: 'vertical-rl' }}>
                            {boundaryEast}
                          </div>
                        </div>

                      </div>

                    </div>

                  </div>

                  {/* SOUTH ROAD — Wider than Plot with Proper Zig-Zag Cuts */}
                  <div className="relative mt-4 border-t-2 border-b-2 border-black bg-white py-3 px-12 flex items-center justify-center" style={{ width: `${Math.max(topWidthPx, bottomWidthPx) + 120}px` }}>
                    {/* Left Zig-Zag Cut */}
                    <div className="absolute -left-3 top-0 bottom-0 w-3 border-r-2 border-black bg-white flex flex-col justify-between">
                      <div className="h-2 border-b border-black transform rotate-45"></div>
                      <div className="h-2 border-t border-black transform -rotate-45"></div>
                    </div>
                    
                    <span className="font-bold text-xs text-black tracking-widest text-center uppercase break-words">{boundarySouth}</span>
                    
                    {/* Right Zig-Zag Cut */}
                    <div className="absolute -right-3 top-0 bottom-0 w-3 border-l-2 border-black bg-white flex flex-col justify-between">
                      <div className="h-2 border-b border-black transform -rotate-45"></div>
                      <div className="h-2 border-t border-black transform rotate-45"></div>
                    </div>
                  </div>

                  {/* BOTTOM DIRECTION TITLE (EXACT MATCH TO REFERENCE) */}
                  
                  

                </div>

              </div>
            </div>

            {/* Sidebar controls */}
            <div className="col-span-3 p-4 flex flex-col bg-gray-50 overflow-y-auto space-y-3">
              <div className="border border-black p-2.5 bg-white">
                <h3 className="font-bold text-xs mb-1.5 border-b border-black pb-1 text-blue-900">1. PLOT DIMENSIONS (FEET)</h3>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <label className="font-bold block">NORTH WIDTH</label>
                    <input type="number" value={dimNorth} onChange={(e) => setDimNorth(Number(e.target.value))} className="w-full border border-black p-1 text-center font-bold" />
                  </div>
                  <div>
                    <label className="font-bold block">SOUTH WIDTH</label>
                    <input type="number" value={dimSouth} onChange={(e) => setDimSouth(Number(e.target.value))} className="w-full border border-black p-1 text-center font-bold" />
                  </div>
                  <div>
                    <label className="font-bold block">EAST LENGTH</label>
                    <input type="number" value={dimEast} onChange={(e) => setDimEast(Number(e.target.value))} className="w-full border border-black p-1 text-center font-bold" />
                  </div>
                  <div>
                    <label className="font-bold block">WEST LENGTH</label>
                    <input type="number" value={dimWest} onChange={(e) => setDimWest(Number(e.target.value))} className="w-full border border-black p-1 text-center font-bold" />
                  </div>
                </div>
              </div>

              <div className="border border-black p-2.5 bg-white">
                <h3 className="font-bold text-xs mb-1 text-blue-900">2. TOTAL PLOT AREA</h3>
                <input type="text" readOnly value={`${plotArea || 0} SQ.FT`} className="w-full border border-black p-1.5 bg-gray-100 font-bold text-center text-sm" />
              </div>

              <div className="border border-black p-2.5 bg-white">
                <h3 className="font-bold text-xs mb-1 text-blue-900">3. PLOT FACING / ROAD SIDE</h3>
                <select value={roadFacingOption} onChange={(e) => setRoadFacingOption(e.target.value)} className="w-full border border-black p-1.5 font-bold bg-white text-[10px]">
                  {ROAD_FACING_OPTIONS.map((opt, idx) => (
                    <option key={idx} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="border border-black p-2.5 bg-white">
                <h3 className="font-bold text-xs mb-1 text-blue-900">4. COVERAGE TYPE</h3>
                <select value={coverageType} onChange={(e) => setCoverageType(e.target.value)} className="w-full border border-black p-1.5 font-bold bg-white text-xs">
                  <option value="100% COVERAGE">100% COVERAGE</option>
                  <option value="AS PER NORMS">AS PER NORMS</option>
                  <option value="CUSTOM LEFT MARGIN">CUSTOM LEFT MARGIN</option>
                </select>
              </div>

              <div className="border border-black p-2.5 bg-white">
                <h3 className="font-bold text-xs mb-1.5 border-b border-black pb-1 text-blue-900">5. FOUR BOUNDARIES</h3>
                <div className="space-y-1.5 text-[10px]">
                  <div>
                    <label className="font-bold block">NORTH:</label>
                    <input type="text" value={boundaryNorth} onChange={(e) => setBoundaryNorth(e.target.value)} className="w-full border border-black p-1 font-bold" />
                  </div>
                  <div>
                    <label className="font-bold block">SOUTH:</label>
                    <input type="text" value={boundarySouth} onChange={(e) => setBoundarySouth(e.target.value)} className="w-full border border-black p-1 font-bold" />
                  </div>
                  <div>
                    <label className="font-bold block">EAST:</label>
                    <input type="text" value={boundaryEast} onChange={(e) => setBoundaryEast(e.target.value)} className="w-full border border-black p-1 font-bold" />
                  </div>
                  <div>
                    <label className="font-bold block">WEST:</label>
                    <input type="text" value={boundaryWest} onChange={(e) => setBoundaryWest(e.target.value)} className="w-full border border-black p-1 font-bold" />
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-2">
                <button onClick={() => setIsCadModalOpen(false)} className="w-full bg-black text-white py-2.5 font-bold text-xs uppercase hover:bg-gray-800 shadow">
                  FINAL / SAVE LAYOUT ✓
                </button>
              </div>

            </div>

          </div>
        </div>
      </div>
    )}

    {isFloorModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 border border-black w-[400px] uppercase text-[9pt]">
          <h2 className="font-bold mb-4 border-b border-black pb-2 text-[11pt]">SELECT FLOORS FOR PLAN</h2>
          <div className="space-y-2 max-h-[350px] overflow-auto mb-4">
            {[...DEFAULT_FLOORS, ...EXTRA_FLOORS].map((floor) => (
              <label key={floor} className="flex items-center gap-3 cursor-pointer p-2 border-b font-bold">
                <input type="checkbox" checked={tempSelectedFloors.includes(floor)} onChange={() => setTempSelectedFloors(prev => prev.includes(floor) ? prev.filter(f => f !== floor) : [...prev, floor])} />
                {floor}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button className="border border-black px-4 py-2 font-bold" onClick={() => setIsFloorModalOpen(false)}>CANCEL</button>
            <button className="bg-black text-white px-4 py-2 font-bold" onClick={() => {
              const floorSequence = ["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"];
              setSelectedFloors([...tempSelectedFloors].sort((a, b) => floorSequence.indexOf(a) - floorSequence.indexOf(b)));
              setIsFloorModalOpen(false);
            }}>ADD SELECTED</button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}