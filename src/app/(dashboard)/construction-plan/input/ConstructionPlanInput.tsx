'use client';

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import ClientDetailsSection from "../components/ClientDetailsSection";
import PlotConfigSection from "../components/PlotConfigSection";
import FloorManagerSection from "../components/FloorManagerSection";
import CadModalView from "../components/CadModalView";
import { FloorData, FloorRoom, PlotDimensions, PlotShape } from "@/lib/constructionPlan/types";
import { calculateSetbacks } from "@/lib/constructionPlan/setbackRules";
import { generateCompleteConstructionPlan } from "@/lib/constructionPlan/planGenerator";
import { generateCadVectorBlueprint } from "@/lib/constructionPlan/cad/cadRenderer";
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
  const router = useRouter();
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
  const cadContainerRef = React.useRef<HTMLDivElement | null>(null);
  
  const [plotShape, setPlotShape] = useState<PlotShape | "IRREGULAR" | "L-SHAPE" | "">("" as any);

  // CAD Interactive States
  const [cadZoom, setCadZoom] = useState(1.2);
  const [cadTool, setCadCommand] = useState<any>("SELECT");
  const [orthMode, setOrthMode] = useState(false);
  const [osnapMode, setOsnapMode] = useState(true);
  const [cadRotation, setCadRotation] = useState(0);
  const [cadText, setCadText] = useState("");
  const [panOffset] = useState({ x: 0, y: 0 });

  // Combined CAD Modal State for "VIEW CONSTRUCTION PLAN"
  const [isCombinedCadModalOpen, setIsCombinedCadModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.85);

  const [measurementUnit, setMeasurementUnit] = useState<"FEET" | "METERS">("FEET");
  const [roadFacingOption, setRoadFacingOption] = useState("");
  const [coverageType, setCoverageType] = useState("100_PERCENT");
  const [selectedFloors, setSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [tempSelectedFloors, setTempSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [isCadModalOpen, setIsCadModalOpen] = useState(false);
  
  const [blueprintZoom, setBlueprintZoom] = useState(1.0);
  const [dimensionHistory, setDimensionHistory] = useState<PlotDimensions[]>([]);
  
  // Initial dimensions set to 0
  const [plotDimensions, setPlotDimensions] = useState<PlotDimensions>({
    A: 0, B: 0, C: 0, D: 0, E: 0, F: 0
  });
  
  const [dimDetails, setDimDetails] = useState<Record<string, { ft: number; in: number }>>({
    A: { ft: 0, in: 0 },
    B: { ft: 0, in: 0 },
    C: { ft: 0, in: 0 },
    D: { ft: 0, in: 0 },
  });

  const [setbackInputs, setSetbackInputs] = useState({ front: 5, rear: 3, left: 3, right: 3 });

  useEffect(() => {
    if (coverageType === "100_PERCENT") {
      setSetbackInputs({ front: 0, rear: 0, left: 0, right: 0 });
    }
  }, [coverageType]);

  useEffect(() => {
    if (plotShape === "SQUARE") {
      const sideA = dimDetails.A || { ft: 0, in: 0 };
      const totalFeetA = Number(sideA.ft || 0) + Number(sideA.in || 0) / 12;
      
      setDimDetails(prev => ({
        ...prev,
        B: sideA,
        C: sideA,
        D: sideA
      }));
      setPlotDimensions(prev => ({
        ...prev,
        A: totalFeetA,
        B: totalFeetA,
        C: totalFeetA,
        D: totalFeetA
      }));
    }
  }, [plotShape]);
  
  const [boundaryNorth, setBoundaryNorth] = useState("");
  const [boundarySouth, setBoundarySouth] = useState("");
  const [boundaryEast, setBoundaryEast] = useState("");
  const [boundaryWest, setBoundaryWest] = useState("");

  // Side A = Front Width, Side C = Depth / Length
  const frontWidthFt = Number(dimDetails.A?.ft ?? plotDimensions.A ?? 0) + Number(dimDetails.A?.in ?? 0) / 12;
  const depthFt = Number(dimDetails.C?.ft ?? plotDimensions.C ?? 0) + Number(dimDetails.C?.in ?? 0) / 12;
  const plotArea = frontWidthFt * depthFt;

  const [floorData, setFloorData] = useState<Record<string, FloorData>>({
    "GROUND FLOOR": { 
      width: frontWidthFt, 
      length: depthFt, 
      area: plotArea 
    }
  });

  // 👉 Ground Floor ke liye width = frontWidthFt, length = depthFt sync logic
  useEffect(() => {
    const currentWidth = frontWidthFt;
    const currentLength = depthFt;
    const calculatedArea = currentWidth * currentLength;

    setFloorData(prev => {
      const updated = { ...prev };
      selectedFloors.forEach(floor => {
        if (floor === "GROUND FLOOR") {
          const isUnset = !updated[floor] || updated[floor].width === 0 || updated[floor].length === 0;
          if (isUnset) {
            updated[floor] = {
              width: currentWidth,
              length: currentLength,
              area: calculatedArea > 0 ? calculatedArea : 0
            };
          }
        } else {
          if (!updated[floor]) {
            updated[floor] = { width: 0, length: 0, area: 0 };
          }
        }
      });
      return updated;
    });
  }, [frontWidthFt, depthFt, selectedFloors]);

  const floorBuiltUpAreas = React.useMemo(() => {
    const map: Record<string, number> = {};
    Object.keys(floorData).forEach((floor) => {
      map[floor] = floorData[floor]?.area || 0;
    });
    return map;
  }, [floorData]);

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

  const updateFloorAreaDirect = (floor: string, areaVal: number) => {
    setFloorData(prev => ({
      ...prev,
      [floor]: { ...(prev[floor] || { width: 0, length: 0 }), area: areaVal }
    }));
  };

  const updateFloorDimensions = (floor: string, width: number, length: number) => {
    const area = Number((width * length).toFixed(2));
    setFloorData(prev => ({
      ...prev,
      [floor]: {
        ...(prev[floor] || { area: 0 }),
        width,
        length,
        area: area > 0 ? area : (prev[floor]?.area || 0)
      }
    }));
  };

  // 👉 Setbacks minus hone ke baad net dimensions update karna
  useEffect(() => {
    const rules = calculateSetbacks(
      plotArea,
      20,
      false,
      setbackInputs,
      coverageType
    );

    if (coverageType === "AS_PER_NORMS" || coverageType === "CUSTOM_PERCENT") {
      const netWidth = Math.max(0, frontWidthFt - (rules.leftSetback + rules.rightSetback));
      const netLength = Math.max(0, depthFt - (rules.frontSetback + rules.rearSetback));
      if (netWidth > 0 && netLength > 0) {
        updateFloorDimensions("GROUND FLOOR", netWidth, netLength);
      }
    } else if (coverageType === "100_PERCENT") {
      if (frontWidthFt > 0 && depthFt > 0) {
        updateFloorDimensions("GROUND FLOOR", frontWidthFt, depthFt);
      }
    }
  }, [
    frontWidthFt, 
    depthFt, 
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
    
    setDimDetails(prev => {
      const current = prev[side] || { ft: 0, in: 0 };
      const updated = { ...current, [field]: val };
      
      const totalFeet = Number(updated.ft || 0) + Number(updated.in || 0) / 12;

      if (plotShape === "SQUARE") {
        const newDimDetails: Record<string, { ft: number; in: number }> = { ...prev };
        const newPlotDims: PlotDimensions = { ...plotDimensions };

        ['A', 'B', 'C', 'D'].forEach(s => {
          newDimDetails[s] = updated;
          newPlotDims[s as keyof PlotDimensions] = totalFeet;
        });

        setPlotDimensions(newPlotDims);
        return newDimDetails;
      } else {
        setPlotDimensions(prevDims => ({
          ...prevDims,
          [side]: totalFeet
        }));

        return {
          ...prev,
          [side]: updated
        };
      }
    });
  };

  const handleUndo = () => {
    if (dimensionHistory.length === 0) return;
    const last = dimensionHistory[dimensionHistory.length - 1];
    setPlotDimensions(last);
    setDimensionHistory(prev => prev.slice(0, -1));
  };

  const handleResetDimensions = () => {
    setPlotDimensions({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 });
    setDimDetails({
      A: { ft: 0, in: 0 },
      B: { ft: 0, in: 0 },
      C: { ft: 0, in: 0 },
      D: { ft: 0, in: 0 },
    });
    setDimensionHistory([]);
    setRoadFacingOption("");
    setPlotShape("");
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

  const handleClearForm = () => {
    setCustomerName("");
    setPropertyAddress("");
    setSelectedClientName("");
    setRepresentative("");
    setRoadFacingOption("");
    setPlotShape("");
    handleResetDimensions();
    setSelectedFloors(DEFAULT_FLOORS);
    setFloorData({ "GROUND FLOOR": { width: 0, length: 0, area: 0 } });
    setFloorRooms({});
    setBoundaryNorth("");
    setBoundarySouth("");
    setBoundaryEast("");
    setBoundaryWest("");
    alert("Form cleared successfully!");
  };

  const handleGeneratePlan = () => {
    const payload = {
      caseType,
      customerName,
      propertyAddress,
      selectedClientName,
      representative,
      measurementUnit,
      roadFacingOption,
      plotShape,
      plotArea,
      coverageType,
      plotDimensions,
      dimDetails,
      setbackInputs,
      boundaries: { north: boundaryNorth, south: boundarySouth, east: boundaryEast, west: boundaryWest },
      selectedFloors,
      floorData,
      floorBhkConfig,
      floorRooms,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem("construction_plan_preview_data", JSON.stringify(payload));
    alert("Construction Plan generated successfully! Redirecting to preview...");
    router.push("/construction-plan-preview");
  };

  const currentPayload = useMemo(() => {
    return {
      dimensions: plotDimensions,
      floor_details: floorData,
      room_details: floorRooms,
      selected_floors: selectedFloors,
      road_side: roadFacingOption,
      boundaries: { north: boundaryNorth, south: boundarySouth, east: boundaryEast, west: boundaryWest }
    };
  }, [plotDimensions, floorData, floorRooms, selectedFloors, roadFacingOption, boundaryNorth, boundarySouth, boundaryEast, boundaryWest]);

  const completePlan = useMemo(() => {
    try {
      return generateCompleteConstructionPlan(currentPayload as any);
    } catch {
      return { plotArea: plotArea };
    }
  }, [currentPayload, plotArea]);

  const cadBlueprint = useMemo(() => {
    try {
      return generateCadVectorBlueprint(
        plotDimensions,
        (completePlan as any).footprint || {},
        floorData,
        floorRooms,
        (selectedFloors[0] || "GROUND FLOOR") as any,
        roadFacingOption
      );
    } catch {
      return null;
    }
  }, [plotDimensions, completePlan, floorData, floorRooms, selectedFloors, roadFacingOption]);

  const hasTower = selectedFloors.includes("TOWER");

  const renderModalFloorPlan = (floorName: string) => {
    if (!cadBlueprint) return null;
    const rooms = cadBlueprint.getRoomsForFloor(floorName);

    return (
      <svg viewBox={cadBlueprint.viewBox} className="w-full h-[320px] bg-white">
        <rect x="20" y="20" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="white" stroke="black" strokeWidth="2" />
        {rooms.map((room: any, index: number) => {
          if (room.isOpen) return null;
          return (
            <g key={`modal-room-${room.key}-${index}`}>
              <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="white" stroke="black" strokeWidth="1" />
              <text x={room.x + room.w / 2} y={room.y + room.h / 2 - 4} textAnchor="middle" dominantBaseline="middle" fontSize="6" fontWeight="900">{room.name}</text>
              <text x={room.x + room.w / 2} y={room.y + room.h / 2 + 7} textAnchor="middle" dominantBaseline="middle" fontSize="5" fontWeight="700">{room.area} SQ.FT</text>
            </g>
          );
        })}
        <text x={cadBlueprint.plotWidth / 2 + 20} y="12" textAnchor="middle" fontSize="8" fontWeight="900">NORTH ↑</text>
      </svg>
    );
  };

  const renderModalFrontElevation = () => (
    <svg viewBox="0 0 300 320" className="w-full h-[320px] bg-white">
      <rect x="50" y="80" width="200" height="200" fill="white" stroke="black" strokeWidth="2" />
      <line x1="30" y1="280" x2="270" y2="280" stroke="black" strokeWidth="3" />
      <polygon points="50,80 150,20 250,80" fill="white" stroke="black" strokeWidth="2" />
      <rect x="130" y="210" width="40" height="70" fill="white" stroke="black" strokeWidth="1.5" />
      <text x="150" y="305" textAnchor="middle" fontSize="9" fontWeight="900">FRONT ELEVATION</text>
    </svg>
  );

  const renderModalSectionView = () => (
    <svg viewBox="0 0 300 320" className="w-full h-[320px] bg-white">
      <rect x="80" y="60" width="140" height="220" fill="white" stroke="black" strokeWidth="2" />
      <line x1="30" y1="280" x2="270" y2="280" stroke="black" strokeWidth="3" />
      <line x1="80" y1="170" x2="220" y2="170" stroke="black" strokeWidth="1.5" strokeDasharray="4" />
      <text x="150" y="120" textAnchor="middle" fontSize="8" fontWeight="700">FIRST FLOOR SLAB</text>
      <text x="150" y="230" textAnchor="middle" fontSize="8" fontWeight="700">GROUND FLOOR SLAB</text>
      <text x="150" y="305" textAnchor="middle" fontSize="9" fontWeight="900">SECTION VIEW (A-A' )</text>
    </svg>
  );

  const isMultiDimShape = typeof plotShape === "string" && plotShape.includes("L-SHAPE");

  return (
    <div className="p-6 max-w-[1400px] mx-auto bg-white text-black font-sans uppercase">
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
        updateFloorDimensions={updateFloorDimensions}
        applyBhkTemplate={applyBhkTemplate}
        openFloorCadModal={(_floor) => setIsCadModalOpen(true)}
        ensureFloorRooms={ensureFloorRooms}
        setRoomEditorFloor={setRoomEditorFloor}
        toggleRoom={toggleRoom}
        updateRoom={updateRoom}
        BHK_CONFIGURATIONS={BHK_CONFIGURATIONS}
        plotLength={frontWidthFt}
        plotWidth={depthFt}
        groundCoverage={coverageType}
      />

      <div className="flex gap-2 border-t-2 border-black pt-3">
        <button type="button" onClick={() => setIsCadModalOpen(true)} className="bg-blue-700 text-white px-6 py-3 text-xs font-black cursor-pointer">
          OPEN CAD LAYOUT
        </button>
        <button type="button" onClick={handleGeneratePlan} className="bg-black text-white px-6 py-3 text-xs font-black cursor-pointer">
          GENERATE PLAN
        </button>
        <button type="button" onClick={handleClearForm} className="bg-red-600 text-white px-6 py-3 text-xs font-black cursor-pointer">
          CLEAR DATA
        </button>
      </div>

      <CadModalView
        isCadModalOpen={isCadModalOpen}
        setIsCadModalOpen={setIsCadModalOpen}
        plotShape={plotShape}
        roadFacingOption={roadFacingOption}
        cadZoom={cadZoom}
        setCadZoom={setCadZoom}
        cadTool={cadTool}
        setCadCommand={setCadCommand}
        orthMode={orthMode}
        setOrthMode={setOrthMode}
        osnapMode={osnapMode}
        setOsnapMode={setOsnapMode}
        undoLastCadAction={() => {}}
        copySelectedCadObjects={() => {}}
        rotateSelectedCadObjects={() => {}}
        deleteSelectedCadObjects={() => {}}
        cadRotation={cadRotation}
        setCadRotation={setCadRotation}
        cadText={cadText}
        setCadText={setCadText}
        cadContainerRef={cadContainerRef}
        handleMouseDown={() => {}}
        handleCadMouseMove={() => {}}
        handleMouseUp={() => {}}
        handleCadCanvasClick={() => {}}
        handleCadDoubleClick={() => {}}
        panOffset={panOffset}
        plotDimensions={plotDimensions}
        updateDimensionPart={updateDimensionPart}
        measurementUnit={measurementUnit}
        plotArea={plotArea}
        isMultiDimShape={isMultiDimShape}
        boundaryNorth={boundaryNorth}
        setBoundaryNorth={setBoundaryNorth}
        boundarySouth={boundarySouth}
        setBoundarySouth={setBoundarySouth}
        boundaryEast={boundaryEast}
        setBoundaryEast={setBoundaryEast}
        boundaryWest={boundaryWest}
        setBoundaryWest={setBoundaryWest}
        cadObjects={[]}
        selectedCadObjectIds={[]}
        toggleCadSelection={() => {}}
        activeDrawingStart={null}
        mouseCurrentPoint={null}
        totalFloors={selectedFloors.length}
        selectedFloors={selectedFloors}
        floorBuiltUpAreas={floorBuiltUpAreas}
        floorData={floorData}
        
        frontMos={coverageType === "100_PERCENT" ? 0 : setbackInputs.front}
        rearMos={coverageType === "100_PERCENT" ? 0 : setbackInputs.rear}
        leftMos={coverageType === "100_PERCENT" ? 0 : setbackInputs.left}
        rightMos={coverageType === "100_PERCENT" ? 0 : setbackInputs.right}
        setFrontMos={(val) => setSetbackInputs(prev => ({ ...prev, front: val }))}
        setRearMos={(val) => setSetbackInputs(prev => ({ ...prev, rear: val }))}
        setLeftMos={(val) => setSetbackInputs(prev => ({ ...prev, left: val }))}
        setRightMos={(val) => setSetbackInputs(prev => ({ ...prev, right: val }))}
      />

      {/* COMBINED CAD MODAL VIEWER */}
      {isCombinedCadModalOpen && cadBlueprint && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-[1500px] flex justify-between items-center bg-white p-3 border-2 border-black mb-2 shadow-md">
            <h3 className="font-black text-sm">COMBINED CAD ARCHITECTURAL DRAWINGS SHEET</h3>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-black">ZOOM</span>
              <button type="button" onClick={() => setZoomLevel((v) => Math.max(0.5, v - 0.1))} className="px-3 py-1 bg-gray-200 border border-black font-black cursor-pointer">−</button>
              <span className="w-12 text-center text-xs font-black">{Math.round(zoomLevel * 100)}%</span>
              <button type="button" onClick={() => setZoomLevel((v) => Math.min(1.5, v + 0.1))} className="px-3 py-1 bg-gray-200 border border-black font-black cursor-pointer">+</button>
              <button type="button" onClick={() => setZoomLevel(0.85)} className="px-3 py-1 bg-black text-white font-black text-xs cursor-pointer">RESET</button>
              <button type="button" onClick={() => setIsCombinedCadModalOpen(false)} className="bg-red-600 text-white px-4 py-2 text-xs font-black cursor-pointer hover:bg-red-700">CLOSE VIEWER</button>
            </div>
          </div>

          <div className="w-full overflow-auto flex justify-center py-2 max-h-[85vh] bg-gray-200">
            <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center" }} className="border-2 border-black w-[1450px] bg-white text-[9px] p-6 shadow-2xl shrink-0 flex flex-col gap-6 uppercase">
              <div className="border-b-2 border-black pb-3">
                <div className="text-center font-black text-base tracking-wide">PROPOSED RESIDENTIAL BUILDING ON {selectedFloors.join(" + ")}</div>
                <div className="text-center text-[9px] font-bold mt-1 tracking-wider text-gray-700">PLOT AREA: {plotArea} SQ.FT | DIMENSIONS: {plotDimensions.A}' × {plotDimensions.C}' | ROAD: {roadFacingOption || "NOT SPECIFIED"}</div>
              </div>

              <div className="grid grid-cols-4 gap-6 items-end pb-4">
                {selectedFloors.map((floorName: string) => {
                  const fArea = Number(floorData?.[floorName]?.area || 0);
                  return (
                    <div key={floorName} className="flex flex-col bg-white border border-black p-2 relative shadow-sm">
                      <div className="border border-black mb-2">{renderModalFloorPlan(floorName)}</div>
                      <div className="text-center pt-1 border-t border-black bg-gray-50">
                        <div className="font-black text-[10px]">{floorName}</div>
                        <div className="font-bold text-[8px] text-gray-800">{fArea.toFixed(2)} SQ.FT BUILT-UP</div>
                      </div>
                    </div>
                  );
                })}

                {!hasTower && (
                  <>
                    <div className="flex flex-col bg-white border border-black p-2 relative shadow-sm">
                      <div className="border border-black mb-2">{renderModalFrontElevation()}</div>
                      <div className="text-center pt-1 border-t border-black bg-gray-50">
                        <div className="font-black text-[10px]">FRONT ELEVATION</div>
                        <div className="font-bold text-[8px] text-gray-800">ARCHITECTURAL VIEW</div>
                      </div>
                    </div>
                    <div className="flex flex-col bg-white border border-black p-2 relative shadow-sm">
                      <div className="border border-black mb-2">{renderModalSectionView()}</div>
                      <div className="text-center pt-1 border-t border-black bg-gray-50">
                        <div className="font-black text-[10px]">SECTION VIEW</div>
                        <div className="font-bold text-[8px] text-gray-800">CROSS SECTION (A-A')</div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex flex-col bg-white border border-black p-2 relative shadow-sm">
                  <div className="border border-black mb-2">
                    <svg viewBox={`0 0 ${cadBlueprint.plotWidth + 120} ${cadBlueprint.plotDepth + 80}`} className="w-full h-[320px] bg-white">
                      <text x={40 + cadBlueprint.plotWidth / 2} y="15" textAnchor="middle" fontSize="8" fontWeight="900">NORTH ↑</text>
                      <rect x="40" y="30" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="white" stroke="black" strokeWidth="2" />
                      <text x={40 + cadBlueprint.plotWidth / 2} y={30 + cadBlueprint.plotDepth / 2} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="900">PROPOSED SITE</text>
                      <text x={40 + cadBlueprint.plotWidth / 2} y={30 + cadBlueprint.plotDepth + 15} textAnchor="middle" fontSize="7" fontWeight="900">{boundarySouth || "ROAD"}</text>
                      <rect x="40" y={30 + cadBlueprint.plotDepth + 20} width={cadBlueprint.plotWidth} height="15" fill="#e2e8f0" stroke="black" />
                      <text x={40 + cadBlueprint.plotWidth / 2} y={30 + cadBlueprint.plotDepth + 30} textAnchor="middle" fontSize="7" fontWeight="900">ROAD</text>
                    </svg>
                  </div>
                  <div className="text-center pt-1 border-t border-black bg-gray-50">
                    <div className="font-black text-[10px]">SITE LAYOUT</div>
                    <div className="font-bold text-[8px] text-gray-800">PLOT: {plotArea} SQ.FT</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floor Selection Modal */}
      {isFloorModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
              <button className="border border-black px-4 py-2 cursor-pointer hover:bg-gray-100" onClick={() => setIsFloorModalOpen(false)}>CANCEL</button>
              <button className="bg-black text-white px-4 py-2 font-bold cursor-pointer hover:bg-gray-800" onClick={() => {
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