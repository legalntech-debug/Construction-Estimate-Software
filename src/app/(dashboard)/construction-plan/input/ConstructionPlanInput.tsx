'use client';

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import ClientDetailsSection from "../components/ClientDetailsSection";
import PlotConfigSection from "../components/PlotConfigSection";
import FloorManagerSection from "../components/FloorManagerSection";
import FloorPlanningSettings from "../components/FloorPlanningSettings";
import CadModalView from "../components/CadModalView";
import { DEFAULT_FLOOR_PLANNING_SETTINGS, FloorData, FloorPlanningSettings as FloorPlanningSettingsType, FloorRoom, PlanningMode, PlotDimensions, PlotShape } from "../engine/planningTypes";
import { calculateSetbacks } from "../engine/setbackRules";
import { generateCompleteConstructionPlan } from "../engine/planGenerator";
import { generateCadVectorBlueprint } from "../engine/cad/cadRenderer";
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
      width: frontWidthFt > 0 ? frontWidthFt : 30, 
      length: depthFt > 0 ? depthFt : 50, 
      area: (frontWidthFt > 0 ? frontWidthFt : 30) * (depthFt > 0 ? depthFt : 50) 
    }
  });

  // Ground Floor width = frontWidthFt, length = depthFt sync logic
  useEffect(() => {
    if (frontWidthFt <= 0 || depthFt <= 0) return;

    const currentWidth = frontWidthFt;
    const currentLength = depthFt;
    const calculatedArea = Number((currentWidth * currentLength).toFixed(2));

    setFloorData(prev => {
      const updated = { ...prev };
      selectedFloors.forEach(floor => {
        if (floor === "GROUND FLOOR") {
          updated[floor] = {
            width: currentWidth,
            length: currentLength,
            area: calculatedArea
          };
        } else {
          if (!updated[floor]) {
            updated[floor] = { width: currentWidth, length: currentLength, area: calculatedArea };
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
    "GROUND FLOOR": "AUTO"
  });
  const [roomEditorFloor, setRoomEditorFloor] = useState<string | null>(null);
  const [floorRooms, setFloorRooms] = useState<Record<string, Record<string, FloorRoom>>>({});
  const [planningMode, setPlanningMode] = useState<PlanningMode>("AUTO");
  const [floorSettings, setFloorSettings] = useState<Record<string, FloorPlanningSettingsType>>({
    "GROUND FLOOR": { ...DEFAULT_FLOOR_PLANNING_SETTINGS },
  });
  const [settingsFloor, setSettingsFloor] = useState<string | null>(null);

  useEffect(() => {
    setFloorSettings(prev => {
      const next = { ...prev };
      selectedFloors.forEach(floor => {
        if (!next[floor]) next[floor] = { ...DEFAULT_FLOOR_PLANNING_SETTINGS, planningMode };
      });
      return next;
    });
  }, [selectedFloors, planningMode]);

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

  const BHK_CONFIGURATIONS = ["AUTO", "CUSTOM", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "DUPLEX"];

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

  const ensureFloorSettings = (floor: string) => {
    setFloorSettings(prev => prev[floor] ? prev : { ...prev, [floor]: { ...DEFAULT_FLOOR_PLANNING_SETTINGS, planningMode } });
  };

  const updateFloorSettings = (floor: string, settings: Partial<FloorPlanningSettingsType> | FloorPlanningSettingsType) => {
    setFloorSettings(prev => ({
      ...prev,
      [floor]: {
        ...(prev[floor] || DEFAULT_FLOOR_PLANNING_SETTINGS),
        ...settings,
      }
    }));
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
    setFloorData({ "GROUND FLOOR": { width: 30, length: 50, area: 1500 } });
    setFloorRooms({});
    setPlanningMode("AUTO");
    setFloorSettings({ "GROUND FLOOR": { ...DEFAULT_FLOOR_PLANNING_SETTINGS } });
    setSettingsFloor(null);
    setBoundaryNorth("");
    setBoundarySouth("");
    setBoundaryEast("");
    setBoundaryWest("");
    alert("Form cleared successfully!");
  };

  const handleGeneratePlan = () => {
    try {
      const inputPayload = {
        caseType, feeMode, manualFee, registeredFee, customerName, propertyAddress,
        selectedClientName, representative, measurementUnit, roadFacingOption, plotShape,
        plotArea, coverageType, plotDimensions, dimDetails, setbackInputs,
        boundaries: { north: boundaryNorth, south: boundarySouth, east: boundaryEast, west: boundaryWest },
        selectedFloors, floorData, floorBhkConfig, floorRooms, planningMode, floorSettings,
        createdAt: new Date().toISOString(),
      };

      // IMPORTANT: Generate the architectural model ONCE here.
      // The preview receives these exact room x/y/w/h values, so no second/fallback
      // planner is allowed to move the rooms after this button is clicked.
      const generated = generateCompleteConstructionPlan(inputPayload);

      const previewPayload = {
        ...inputPayload,
        floorData: generated.floorData,
        floorRooms: generated.floorRooms,
        generatedFloorPlans: generated.floors,
        generatedConstructionPlan: generated,
        plotGeometry: generated.plotGeometry,
        buildableGeometry: generated.buildableGeometry,
        setbackRules: generated.setbackRules,
        elevation: generated.elevation,
        section: generated.section,
        generatedAt: generated.generatedAt,
        previewVersion: 2,
      };

      localStorage.setItem("construction_plan_preview_data", JSON.stringify(previewPayload));
      router.push("/construction-plan-preview");
    } catch (error) {
      console.error("Construction plan generation failed:", error);
      alert("Plan generation failed. Please check plot, floor size and room requirements.");
    }
  };

  const currentPayload = useMemo(() => {
    return {
      dimensions: plotDimensions,
      floor_details: floorData,
      room_details: floorRooms,
      selected_floors: selectedFloors,
      road_side: roadFacingOption,
      boundaries: { north: boundaryNorth, south: boundarySouth, east: boundaryEast, west: boundaryWest },
      planning_mode: planningMode,
      floor_settings: floorSettings
    };
  }, [plotDimensions, floorData, floorRooms, floorSettings, planningMode, selectedFloors, roadFacingOption, boundaryNorth, boundarySouth, boundaryEast, boundaryWest]);

  // SINGLE SOURCE OF TRUTH FOR LIVE CAD: use the exact same master generator
  // used by the final GENERATE PLAN action. This prevents CAD and Preview from
  // inventing different room positions.
  const liveGeneratedPlan = useMemo(() => {
    try {
      return generateCompleteConstructionPlan({
        caseType, feeMode, manualFee, registeredFee, customerName, propertyAddress,
        selectedClientName, representative, measurementUnit,
        roadFacingOption: roadFacingOption || "1 SIDE ROAD (SOUTH)",
        plotShape: plotShape || "RECTANGULAR",
        plotArea, coverageType, plotDimensions, dimDetails, setbackInputs,
        boundaries: { north: boundaryNorth, south: boundarySouth, east: boundaryEast, west: boundaryWest },
        selectedFloors, floorData, floorBhkConfig, floorRooms, planningMode, floorSettings,
      });
    } catch (error) {
      console.warn("Live construction-plan generation preview fallback:", error);
      return null;
    }
  }, [
    caseType, feeMode, manualFee, registeredFee, customerName, propertyAddress,
    selectedClientName, representative, measurementUnit, roadFacingOption, plotShape,
    plotArea, coverageType, plotDimensions, dimDetails, setbackInputs, boundaryNorth,
    boundarySouth, boundaryEast, boundaryWest, selectedFloors, floorData, floorBhkConfig,
    floorRooms, planningMode, floorSettings
  ]);

  const enrichedFloorData = useMemo(() => {
    if (liveGeneratedPlan?.floorData) return liveGeneratedPlan.floorData;
    const result: Record<string, any> = {};
    selectedFloors.forEach((floor) => {
      result[floor] = floorData[floor] || { width: frontWidthFt || 30, length: depthFt || 50, area: plotArea || 1500, rooms: [] };
    });
    return result;
  }, [liveGeneratedPlan, selectedFloors, floorData, frontWidthFt, depthFt, plotArea]);

  // CAD receives the exact generated x/y/w/h geometry from the master engine.
  const generatedCadFloorRooms = useMemo(() => {
    if (liveGeneratedPlan?.floorRooms) return liveGeneratedPlan.floorRooms;
    const result: Record<string, FloorRoom[]> = {};
    selectedFloors.forEach((floor) => {
      result[floor] = Array.isArray(enrichedFloorData[floor]?.rooms) ? enrichedFloorData[floor].rooms as FloorRoom[] : [];
    });
    return result;
  }, [liveGeneratedPlan, selectedFloors, enrichedFloorData]);

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
        selectedFloors={selectedFloors || []}
        floorData={floorData || {}}
        floorBhkConfig={floorBhkConfig || {}}
        roomEditorFloor={roomEditorFloor}
        floorRooms={floorRooms || {}}
        planningMode={planningMode}
        setPlanningMode={setPlanningMode}
        floorSettings={floorSettings || {}}
        settingsFloor={settingsFloor}
        setSettingsFloor={(floor) => { if (floor) ensureFloorSettings(floor); setSettingsFloor(floor); }}
        updateFloorSettings={updateFloorSettings}
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

      <div className="flex flex-wrap gap-2 border-t-2 border-black pt-3">
        <button 
          type="button" 
          onClick={() => {
            console.log("======== 🔍 INPUT PAGE PAYLOAD DEBUG START ========");
            console.log("► Plot Dimensions:", plotDimensions);
            console.log("► Dim Details (A,B,C,D):", dimDetails);
            console.log("► Front Width (Ft):", frontWidthFt, "| Depth (Ft):", depthFt);
            console.log("► Floor Data Sync State:", floorData);
            console.log("► Floor BHK Config:", floorBhkConfig);
            console.log("► Floor Rooms Selection:", floorRooms);
            console.log("► Setbacks / MOS:", setbackInputs);
            console.log("======== 🔍 INPUT PAGE PAYLOAD DEBUG END ========");
            setIsCadModalOpen(true);
          }} 
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 text-xs font-black cursor-pointer uppercase transition"
        >
          OPEN CAD LAYOUT
        </button>
        <button type="button" onClick={handleGeneratePlan} className="bg-black hover:bg-zinc-800 text-white px-6 py-3 text-xs font-black cursor-pointer uppercase transition">
          GENERATE PLAN
        </button>
        <button type="button" onClick={handleClearForm} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 text-xs font-black cursor-pointer uppercase transition">
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
        floorData={enrichedFloorData}
        
        frontMos={coverageType === "100_PERCENT" ? 0 : setbackInputs.front}
        rearMos={coverageType === "100_PERCENT" ? 0 : setbackInputs.rear}
        leftMos={coverageType === "100_PERCENT" ? 0 : setbackInputs.left}
        rightMos={coverageType === "100_PERCENT" ? 0 : setbackInputs.right}
        setFrontMos={(val) => setSetbackInputs(prev => ({ ...prev, front: val }))}
        setRearMos={(val) => setSetbackInputs(prev => ({ ...prev, rear: val }))}
        setLeftMos={(val) => setSetbackInputs(prev => ({ ...prev, left: val }))}
        setRightMos={(val) => setSetbackInputs(prev => ({ ...prev, right: val }))}

        floorRooms={generatedCadFloorRooms}
        floorSettings={floorSettings}
        floorBhkConfig={floorBhkConfig}
        planningMode={planningMode}
      />

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