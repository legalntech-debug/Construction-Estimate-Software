"use client";

import React, { useState, useEffect } from "react";
import ClientDetailsSection from "../components/ClientDetailsSection";
import PlotConfigSection from "../components/PlotConfigSection";
import FloorManagerSection from "../components/FloorManagerSection";
import { FloorData, FloorRoom, PlotDimensions, PlotShape } from "@/lib/constructionPlan/types";
import { calculateSetbacks } from "@/lib/constructionPlan/setbackRules";
import { supabase } from "@/lib/supabase";

const DEFAULT_FLOORS = ["GROUND FLOOR"];
const EXTRA_FLOORS = [
  "BASEMENT", "FIRST FLOOR", "SECOND FLOOR", "TOWER", "THIRD FLOOR", 
  "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", 
  "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR"
];

const FLOOR_SEQUENCE = [
  "BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", 
  "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", 
  "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"
];

export default function ConstructionPlanInput() {
  const [caseType, setCaseType] = useState("CONSTRUCTION PLAN");
  const [feeMode, setFeeMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [manualFee, setManualFee] = useState<number>(0);
  const [registeredFee, setRegisteredFee] = useState<number>(0);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [representative, setRepresentative] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [filteredReps, setFilteredReps] = useState<string[]>([]);
  const [allRepresentatives, setAllRepresentatives] = useState<string[]>([]);
  
  const [plotShape, setPlotShape] = useState<PlotShape | "IRREGULAR" | "L-SHAPE" | "">("" as any);

  // Fetch Clients
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

  const [measurementUnit, setMeasurementUnit] = useState<"FEET" | "METERS">("FEET");
  const [roadFacingOption, setRoadFacingOption] = useState("");
  const [coverageType, setCoverageType] = useState("100_PERCENT");
  const [selectedFloors, setSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [tempSelectedFloors, setTempSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [isCadModalOpen, setIsCadModalOpen] = useState(false);
  
  const [blueprintZoom, setBlueprintZoom] = useState(1.0);
  const [dimensionHistory, setDimensionHistory] = useState<PlotDimensions[]>([]);
  
  const [plotDimensions, setPlotDimensions] = useState<PlotDimensions>({
    A: 30, B: 30, C: 40, D: 40, E: 0, F: 0
  });
  
  const [dimDetails, setDimDetails] = useState<Record<string, { ft: number; in: number }>>({
    A: { ft: 30, in: 0 },
    B: { ft: 30, in: 0 },
    C: { ft: 40, in: 0 },
    D: { ft: 40, in: 0 },
  });

  const [setbackInputs, setSetbackInputs] = useState({ front: 5, rear: 3, left: 3, right: 3 });
  
  const [boundaryNorth, setBoundaryNorth] = useState("");
  const [boundarySouth, setBoundarySouth] = useState("");
  const [boundaryEast, setBoundaryEast] = useState("");
  const [boundaryWest, setBoundaryWest] = useState("");

  const plotArea = plotDimensions.A * plotDimensions.C;

  // Floor Manager States & Default Area Calculation
  const [floorData, setFloorData] = useState<Record<string, FloorData>>({
    "GROUND FLOOR": { length: 0, width: 0, area: plotArea }
  });

  const updateFloorAreaDirect = (floor: string, areaVal: number) => {
    setFloorData(prev => ({
      ...prev,
      [floor]: { ...(prev[floor] || { length: 0, width: 0 }), area: areaVal }
    }));
  };

  // Auto-calculate Ground Floor Built-Up Area using setbackRules.ts
  useEffect(() => {
    const totalLength = Number(dimDetails.A?.ft ?? plotDimensions.A ?? 0);
    const totalWidth = Number(dimDetails.C?.ft ?? plotDimensions.C ?? 0);
    
    const rules = calculateSetbacks(
      plotArea,
      20,
      false,
      setbackInputs,
      coverageType
    );

    let netArea = plotArea;
    if (coverageType === "AS_PER_NORMS" || coverageType === "CUSTOM_PERCENT") {
      const netLength = Math.max(0, totalLength - (rules.leftSetback + rules.rightSetback));
      const netWidth = Math.max(0, totalWidth - (rules.frontSetback + rules.rearSetback));
      netArea = netLength * netWidth;
    } else if (coverageType === "100_PERCENT") {
      netArea = totalLength * totalWidth;
    }

    if (netArea > 0) {
      updateFloorAreaDirect("GROUND FLOOR", Number(netArea.toFixed(2)));
    }
  }, [
    dimDetails.A?.ft, 
    dimDetails.C?.ft, 
    plotDimensions.A, 
    plotDimensions.C, 
    setbackInputs.front, 
    setbackInputs.rear, 
    setbackInputs.left, 
    setbackInputs.right, 
    coverageType, 
    plotArea
  ]);

  const [floorBhkConfig, setFloorBhkConfig] = useState<Record<string, string>>({
    "GROUND FLOOR": "CUSTOM"
  });
  const [roomEditorFloor, setRoomEditorFloor] = useState<string | null>(null);
  const [floorRooms, setFloorRooms] = useState<Record<string, Record<string, FloorRoom>>>({});

  const ROAD_FACING_OPTIONS = [
    "1 SIDE ROAD (NORTH)", "1 SIDE ROAD (SOUTH)", "1 SIDE ROAD (EAST)", "1 SIDE ROAD (WEST)",
    "CORNER: MAIN RD NORTH & EAST", "CORNER: MAIN RD NORTH & WEST", "CORNER: MAIN RD SOUTH & EAST", "CORNER: MAIN RD SOUTH & WEST",
    "CORNER: MAIN RD EAST & NORTH", "CORNER: MAIN RD EAST & SOUTH", "CORNER: MAIN RD WEST & NORTH", "CORNER: MAIN RD WEST & SOUTH",
    "2 SIDE FRONT & REAR (NORTH & SOUTH)", "2 SIDE FRONT & REAR (SOUTH & NORTH)", "2 SIDE FRONT & REAR (EAST & WEST)", "2 SIDE FRONT & REAR (WEST & EAST)",
    "3 SIDE ROAD (NORTH, EAST & WEST)", "3 SIDE ROAD (SOUTH, EAST & WEST)", "3 SIDE ROAD (EAST, NORTH & SOUTH)", "3 SIDE ROAD (WEST, NORTH & SOUTH)",
    "4 SIDE ROAD (ISLAND / OPEN)",
  ];
  
  const PLOT_SHAPES = [
    "RECTANGLE", "SQUARE", "TRAPEZOIDAL", "POLYGON", "IRREGULAR", "L-SHAPE",
    "L-SHAPE (TYPE 1: FRONT-LEFT CUT)", "L-SHAPE (TYPE 2: FRONT-RIGHT CUT)",
    "L-SHAPE (TYPE 3: REAR-LEFT CUT)", "L-SHAPE (TYPE 4: REAR-RIGHT CUT)",
    "L-SHAPE (TYPE 5: LEFT-RECESSED)", "L-SHAPE (TYPE 6: RIGHT-RECESSED)",
  ] as const;

  const BHK_CONFIGURATIONS = ["CUSTOM", "1 BHK", "2 BHK", "3 BHK", "DUPLEX"];

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

  const updateDimensionPart = (side: keyof PlotDimensions, field: "ft" | "in", val: number) => {
    setDimensionHistory(prev => [...prev, { ...plotDimensions }]);
    setPlotDimensions(prev => ({ ...prev, [side]: val }));
    if (field === "ft" || field === "in") {
      setDimDetails(prev => ({
        ...prev,
        [side]: { ...(prev[side] || { ft: 0, in: 0 }), [field]: val }
      }));
    }
  };

  const handleUndo = () => {
    if (dimensionHistory.length === 0) return;
    const last = dimensionHistory[dimensionHistory.length - 1];
    setPlotDimensions(last);
    setDimensionHistory(prev => prev.slice(0, -1));
  };

  const handleResetDimensions = () => {
    setPlotDimensions({ A: 30, B: 30, C: 40, D: 40, E: 0, F: 0 });
    setDimensionHistory([]);
  };

  const applyBhkTemplate = (floor: string, bhkType: string) => {
    setFloorBhkConfig(prev => ({ ...prev, [floor]: bhkType }));
  };

  const ensureFloorRooms = (floor: string) => {
    if (!floorRooms[floor]) {
      setFloorRooms(prev => ({ ...prev, [floor]: {} }));
    }
  };

  const toggleRoom = (floor: string, roomKey: string) => {
    setFloorRooms(prev => {
      const floorMap = prev[floor] || {};
      const currentRoom = floorMap[roomKey] || { selected: false, count: 1, areaMode: "AUTO", areaPerRoom: 100 };
      return {
        ...prev,
        [floor]: {
          ...floorMap,
          [roomKey]: { ...currentRoom, selected: !currentRoom.selected }
        }
      };
    });
  };

  const updateRoom = (floor: string, roomKey: string, patch: Partial<FloorRoom>) => {
    setFloorRooms(prev => {
      const floorMap = prev[floor] || {};
      const currentRoom = floorMap[roomKey] || { selected: true, count: 1, areaMode: "AUTO", areaPerRoom: 100 };
      return {
        ...prev,
        [floor]: {
          ...floorMap,
          [roomKey]: { ...currentRoom, ...patch }
        }
      };
    });
  };

  const isMultiDimShape = typeof plotShape === "string" && plotShape.includes("L-SHAPE");

  return (
    <div className="p-6 max-w-[1400px] mx-auto bg-white text-black font-sans">
      <div className="bg-slate-900 text-white p-3 text-center font-black text-2xl mb-6 tracking-wide shadow">
        CONSTRUCTION PLAN INPUT FORM
      </div>

      <ClientDetailsSection
        caseType={caseType}
        setCaseType={setCaseType}
        feeMode={feeMode}
        setFeeMode={setFeeMode}
        setManualFee={setManualFee}
        selectedClientName={selectedClientName}
        handleClientChange={handleClientChange}
        clients={clients}
        representative={representative}
        setRepresentative={setRepresentative}
        filteredReps={filteredReps}
        customerName={customerName}
        setCustomerName={setCustomerName}
        propertyAddress={propertyAddress}
        setPropertyAddress={setPropertyAddress}
      />

      <PlotConfigSection
        measurementUnit={measurementUnit}
        setMeasurementUnit={setMeasurementUnit}
        roadFacingOption={roadFacingOption}
        setRoadFacingOption={setRoadFacingOption}
        plotShape={plotShape}
        setPlotShape={setPlotShape}
        plotArea={plotArea}
        coverageType={coverageType}
        setCoverageType={setCoverageType}
        setTempSelectedFloors={setTempSelectedFloors}
        selectedFloors={selectedFloors}
        setIsFloorModalOpen={setIsFloorModalOpen}
        setIsCadModalOpen={setIsCadModalOpen}
        dimensionHistory={dimensionHistory}
        handleUndo={handleUndo}
        handleResetDimensions={handleResetDimensions}
        blueprintZoom={blueprintZoom}
        setBlueprintZoom={setBlueprintZoom}
        isMultiDimShape={isMultiDimShape}
        lShapeMetrics={{ 
          points: "50,30 210,30 210,120 130,120 130,190 50,190", 
          posA: { top: "0%", left: "55%" }, 
          posB: { top: "20%", left: "86%" }, 
          posC: { top: "100%", left: "38%" }, 
          posD: { top: "51%", left: "17%" }, 
          posE: { top: "51%", left: "67%" }, 
          posF: { top: "75%", left: "51%" } 
        }}
        plotDimensions={plotDimensions}
        updateDimensionPart={updateDimensionPart}
        dimDetails={dimDetails}
        setbackInputs={setbackInputs}
        setSetbackInputs={setSetbackInputs}
        boundaryNorth={boundaryNorth}
        setBoundaryNorth={setBoundaryNorth}
        boundarySouth={boundarySouth}
        setBoundarySouth={setBoundarySouth}
        boundaryEast={boundaryEast}
        setBoundaryEast={setBoundaryEast}
        boundaryWest={boundaryWest}
        setBoundaryWest={setBoundaryWest}
        ROAD_FACING_OPTIONS={ROAD_FACING_OPTIONS}
        PLOT_SHAPES={PLOT_SHAPES as any}
        calculatedNetArea={floorData["GROUND FLOOR"]?.area || 0}
      />

      <FloorManagerSection
        selectedFloors={selectedFloors}
        floorData={floorData}
        floorBhkConfig={floorBhkConfig}
        roomEditorFloor={roomEditorFloor}
        floorRooms={floorRooms}
        updateFloorAreaDirect={updateFloorAreaDirect}
        applyBhkTemplate={applyBhkTemplate}
        openFloorCadModal={(_floor) => setIsCadModalOpen(true)}
        ensureFloorRooms={ensureFloorRooms}
        setRoomEditorFloor={setRoomEditorFloor}
        toggleRoom={toggleRoom}
        updateRoom={updateRoom}
        BHK_CONFIGURATIONS={BHK_CONFIGURATIONS}
      />

      {/* Floor Selection Modal */}
      {isFloorModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 border border-black w-[400px] uppercase text-[9pt]">
            <h2 className="font-bold mb-4 border-b border-black pb-2 text-[11pt]">SELECT FLOORS</h2>
            <div className="space-y-2 max-h-[350px] overflow-auto mb-4">
              {[...DEFAULT_FLOORS, ...EXTRA_FLOORS].map((floor) => (
                <label key={floor} className="flex items-center gap-3 cursor-pointer p-2 border-b">
                  <input 
                    type="checkbox" 
                    checked={tempSelectedFloors.includes(floor)} 
                    onChange={() => setTempSelectedFloors(prev => prev.includes(floor) ? prev.filter(f => f !== floor) : [...prev, floor])} 
                  />
                  {floor}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button className="border border-black px-4 py-2 cursor-pointer" onClick={() => setIsFloorModalOpen(false)}>CANCEL</button>
              <button className="bg-black text-white px-4 py-2 font-bold cursor-pointer" onClick={() => {
                const sortedFloors = [...tempSelectedFloors].sort((a, b) => FLOOR_SEQUENCE.indexOf(a) - FLOOR_SEQUENCE.indexOf(b));
                setSelectedFloors(sortedFloors);
                sortedFloors.forEach(f => ensureFloorRooms(f));
                setIsFloorModalOpen(false);
              }}>ADD SELECTED</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}