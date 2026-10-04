'use client';

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import ClientDetailsSection from "../components/ClientDetailsSection";
import PlotConfigSection from "../components/PlotConfigSection";
import FloorManagerSection from "../components/FloorManagerSection";
import FloorPlanningSettings from "../components/FloorPlanningSettings";
import CadModalView from "../components/CadModalView";
import CadFloorElevationRenderer from "../components/CadFloorElevationRenderer";
import PlotPolygonRenderer from "../components/PlotPolygonRenderer";
import BoundaryLabels from "../components/BoundaryLabels";
import RoadRenderer from "../components/RoadRenderer";
import { DEFAULT_FLOOR_PLANNING_SETTINGS, FloorData, FloorPlanningSettings as FloorPlanningSettingsType, FloorRoom, PlanningMode, PlotDimensions, PlotShape } from "../engine/planningTypes";
import { calculateSetbacks } from "../engine/setbackRules";
import { generateCompleteConstructionPlan } from "../engine/planGenerator";
import { generateCadVectorBlueprint } from "../engine/cad/cadRenderer";
import { supabase } from "@/lib/supabase";

// ✅ Import for stair inheritance
import {
  generateArchitecturalFloorPlan,
  extractStairPositionFromResult,
} from "../engine/roomPlanner";

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

  const [parkingSide, setParkingSide] = useState<string>("SOUTH");

  const [coverageType, setCoverageType] = useState("100_PERCENT");
  const [selectedFloors, setSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [tempSelectedFloors, setTempSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [isCadModalOpen, setIsCadModalOpen] = useState(false);
  
  const [showInlinePlan, setShowInlinePlan] = useState<boolean>(false);
  const [generatedPreviewPayload, setGeneratedPreviewPayload] = useState<any>(null);
  const inlinePlansRef = useRef<HTMLDivElement>(null);
  
  const [blueprintZoom, setBlueprintZoom] = useState(1.0);
  const [dimensionHistory, setDimensionHistory] = useState<PlotDimensions[]>([]);
  
  const [plotDimensions, setPlotDimensions] = useState<PlotDimensions>({
    length: 0,
    width: 0,
    area: 0,
    A: 0, B: 0, C: 0, D: 0, E: 0, F: 0
  });
  
  const [dimDetails, setDimDetails] = useState<Record<string, { ft: number; in: number }>>({
    A: { ft: 0, in: 0 },
    B: { ft: 0, in: 0 },
    C: { ft: 0, in: 0 },
    D: { ft: 0, in: 0 },
  });

  const [setbackInputs, setSetbackInputs] = useState({ front: 5, rear: 3, left: 3, right: 3 });

  const [groundStairPos, setGroundStairPos] = useState<{ x: number; y: number; w?: number; h?: number } | null>(null);
  const [groundStairOffset, setGroundStairOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [groundFloorProgram, setGroundFloorProgram] = useState<string[]>([]);

  const lastExtractedSignature = useRef<string>("");

  // ============================================================
  // ✅ Restore saved construction plan data (from Reopen Old Case)
  // ============================================================
  const hasRestoredRef = useRef<boolean>(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;

    try {
      const raw =
        localStorage.getItem("constructionPlanData") ||
        localStorage.getItem("construction_plan_preview_data") ||
        localStorage.getItem("CONSTRUCTION_PLAN_INPUT");

      if (!raw) return;

      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return;

      console.log("[REOPEN] Restoring construction plan data:", {
        refNo: saved.ref_no || saved.refNo,
        plotShape: saved.plotShape,
        selectedFloors: saved.selectedFloors,
      });

      if (saved.selectedClientName) setSelectedClientName(saved.selectedClientName);
      if (saved.representative) setRepresentative(saved.representative);
      if (saved.customerName) setCustomerName(saved.customerName);
      if (saved.propertyAddress) setPropertyAddress(saved.propertyAddress);

      if (saved.plotShape) setPlotShape(saved.plotShape);
      if (saved.roadFacingOption) setRoadFacingOption(saved.roadFacingOption);
      if (saved.parkingSide) setParkingSide(saved.parkingSide);
      if (saved.coverageType) setCoverageType(saved.coverageType);
      if (saved.measurementUnit) setMeasurementUnit(saved.measurementUnit);

      if (saved.plotDimensions) setPlotDimensions(saved.plotDimensions);
      if (saved.dimDetails) setDimDetails(saved.dimDetails);
      if (saved.setbackInputs) setSetbackInputs(saved.setbackInputs);

      if (saved.boundaries) {
        if (saved.boundaries.north) setBoundaryNorth(saved.boundaries.north);
        if (saved.boundaries.south) setBoundarySouth(saved.boundaries.south);
        if (saved.boundaries.east) setBoundaryEast(saved.boundaries.east);
        if (saved.boundaries.west) setBoundaryWest(saved.boundaries.west);
      }

      if (Array.isArray(saved.selectedFloors) && saved.selectedFloors.length > 0) {
        setSelectedFloors(saved.selectedFloors);
        setTempSelectedFloors(saved.selectedFloors);
      }
      if (saved.floorData && typeof saved.floorData === "object") {
        setFloorData(saved.floorData);
      }
      if (saved.floorRooms && typeof saved.floorRooms === "object") {
        setFloorRooms(saved.floorRooms);
      }
      if (saved.floorBhkConfig) setFloorBhkConfig(saved.floorBhkConfig);

      if (saved.planningMode) setPlanningMode(saved.planningMode);
      if (saved.floorSettings) setFloorSettings(saved.floorSettings);

      if (saved.groundStairPosition) setGroundStairPos(saved.groundStairPosition);
      if (saved.groundStairRelativeOffset) setGroundStairOffset(saved.groundStairRelativeOffset);
      if (Array.isArray(saved.groundFloorProgram)) setGroundFloorProgram(saved.groundFloorProgram);

      if (saved.feeMode) setFeeMode(saved.feeMode);

      hasRestoredRef.current = true;
      console.log("[REOPEN] ✅ Construction plan data restored successfully");
    } catch (e) {
      console.error("[REOPEN] Failed to restore construction plan data:", e);
    } finally {
      try {
        localStorage.removeItem("constructionPlanData");
        localStorage.removeItem("construction_plan_preview_data");
        localStorage.removeItem("CONSTRUCTION_PLAN_INPUT");
      } catch {}
    }
  }, []);

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
        length: totalFeetA,
        width: totalFeetA,
        area: totalFeetA * totalFeetA,
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

  useEffect(() => {
    if (frontWidthFt <= 0 || depthFt <= 0) return;

    const currentWidth = frontWidthFt;
    const currentLength = depthFt;
    const calculatedArea = Number((currentWidth * currentLength).toFixed(2));

    setFloorData(prev => {
      const updated = { ...prev };
      selectedFloors.forEach(floor => {
        const isTower = floor.toUpperCase().includes("TOWER") || floor.toUpperCase().includes("MUMTY");
        
        if (floor === "GROUND FLOOR") {
          updated[floor] = {
            width: currentWidth,
            length: currentLength,
            area: calculatedArea
          };
        } else if (isTower) {
          const towerWidth = Math.min(10, currentWidth);
          const towerLength = Math.min(10, currentLength);
          const towerArea = Number((towerWidth * towerLength).toFixed(2));
          
          if (!updated[floor]) {
            updated[floor] = {
              width: towerWidth,
              length: towerLength,
              area: towerArea
            };
          }
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

  // ============================================================================
  // ✅ GROUND FLOOR STAIR POSITION
  // ============================================================================
  useEffect(() => {
    const groundFloor = selectedFloors.find(f => f.toUpperCase().includes('GROUND'));
    if (!groundFloor) {
      setGroundStairPos(null);
      setGroundStairOffset(null);
      setGroundFloorProgram([]);
      return;
    }

    const gData = (floorData[groundFloor] || {}) as Partial<FloorData>;
    const gfW = Number(gData.width) || frontWidthFt || 20;
    const gfL = Number(gData.length) || depthFt || 50;

    if (gfW <= 0 || gfL <= 0) return;

    const signature = JSON.stringify({
      floor: groundFloor,
      w: gfW,
      l: gfL,
      rooms: floorRooms[groundFloor] ? Object.keys(floorRooms[groundFloor]).sort() : [],
      mode: planningMode,
      road: roadFacingOption,
      parking: parkingSide,
    });
    if (signature === lastExtractedSignature.current) return;
    lastExtractedSignature.current = signature;

    try {
      const gfResult = generateArchitecturalFloorPlan({
        floorName: groundFloor,
        width: gfW,
        length: gfL,
        selectedRooms: floorRooms[groundFloor] || {},
        planningMode: planningMode,
        roadSide: roadFacingOption || '1 SIDE ROAD (SOUTH)',
        planningArea: gfW * gfL,
        hasParking: true,
      });

      const stairInfo = extractStairPositionFromResult(gfResult);

      if (stairInfo) {
        setGroundStairPos({
          x: stairInfo.x,
          y: stairInfo.y,
          w: stairInfo.w,
          h: stairInfo.h,
        });
        setGroundStairOffset(stairInfo.relativeOffset);
      } else {
        setGroundStairPos(null);
        setGroundStairOffset(null);
      }

      const program = gfResult.rooms.map(r =>
        String(r.name || '').toLowerCase().replace(/\s+/g, '_')
      );
      setGroundFloorProgram(program);

      if (typeof console !== 'undefined') {
        const stairRoom = gfResult.rooms.find(r => String(r.name || '').toUpperCase().includes('STAIR'));
        const livingRoom = gfResult.rooms.find(r => String(r.name || '').toUpperCase().includes('LIVING'));
        console.log('[PARENT] Ground floor stair extracted:', {
          stairInfo,
          stairRoom: stairRoom ? { x: stairRoom.x, y: stairRoom.y, w: stairRoom.w, h: stairRoom.h, name: stairRoom.name } : null,
          livingRoom: livingRoom ? { x: livingRoom.x, y: livingRoom.y, w: livingRoom.w, h: livingRoom.h, name: livingRoom.name } : null,
          program,
          totalRooms: gfResult.rooms.length,
        });
      }
    } catch (err) {
      console.error('[PARENT] Ground floor stair extraction failed:', err);
      setGroundStairPos(null);
      setGroundStairOffset(null);
      setGroundFloorProgram([]);
    }
  }, [
    selectedFloors,
    floorData,
    floorRooms,
    planningMode,
    frontWidthFt,
    depthFt,
    roadFacingOption,
    parkingSide,
  ]);

  const ROAD_FACING_OPTIONS = [
    "1 SIDE ROAD (NORTH)", "1 SIDE ROAD (SOUTH)", "1 SIDE ROAD (EAST)", "1 SIDE ROAD (WEST)",
    "CORNER: MAIN RD NORTH & EAST", "CORNER: MAIN RD NORTH & WEST", "CORNER: MAIN RD SOUTH & EAST", "CORNER: MAIN RD SOUTH & WEST",
    "CORNER: MAIN RD EAST & NORTH", "CORNER: MAIN RD EAST & SOUTH", "CORNER: MAIN RD WEST & NORTH", "CORNER: MAIN RD WEST & SOUTH",
    "2 SIDE FRONT & REAR (NORTH & SOUTH)", "2 SIDE FRONT & REAR (SOUTH & NORTH)", "2 SIDE FRONT & REAR (EAST & WEST)", "2 SIDE FRONT & REAR (WEST & EAST)",
    "3 SIDE ROAD (NORTH, EAST & WEST)", "3 SIDE ROAD (SOUTH, EAST & WEST)", "3 SIDE ROAD (EAST, NORTH & SOUTH)", "3 SIDE ROAD (WEST, NORTH & SOUTH)",
    "4 SIDE ROAD (ISLAND / OPEN)",
  ];

  const PARKING_SIDE_OPTIONS = [
    "SOUTH", "NORTH", "EAST", "WEST",
    "SOUTH-EAST", "SOUTH-WEST", "NORTH-EAST", "NORTH-WEST",
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

  // ============================================================
  // ✅ FIXED: updateDimensionPart — NO nested setState
  // ============================================================
  const updateDimensionPart = (side: keyof PlotDimensions, field: "ft" | "in", val: number) => {
    setDimensionHistory(prev => [...prev, { ...plotDimensions }]);

    const currentDetail = dimDetails[side as string] || { ft: 0, in: 0 };
    const updatedDetail = { ...currentDetail, [field]: val };
    const totalFeet = Number(updatedDetail.ft || 0) + Number(updatedDetail.in || 0) / 12;

    setDimDetails(prev => {
      if (plotShape === "SQUARE") {
        const next = { ...prev };
        ['A', 'B', 'C', 'D'].forEach(s => { next[s] = updatedDetail; });
        return next;
      }
      return { ...prev, [side]: updatedDetail };
    });

    setPlotDimensions(prevDims => {
      const next: PlotDimensions = { ...prevDims, [side]: totalFeet };

      if (plotShape === "SQUARE") {
        ['A', 'B', 'C', 'D'].forEach(s => { (next as any)[s] = totalFeet; });
        next.length = totalFeet;
        next.width = totalFeet;
        next.area = totalFeet * totalFeet;
      } else {
        if (side === 'A') next.width = totalFeet;
        if (side === 'C') next.length = totalFeet;

        const finalA = side === 'A' ? totalFeet : (Number(prevDims.A) || 0);
        const finalC = side === 'C' ? totalFeet : (Number(prevDims.C) || 0);
        next.area = finalA * finalC;
      }

      console.log('[UPDATE DIM]', { side, field, val, totalFeet, next });
      return next;
    });
  };

  const handleUndo = () => {
    if (dimensionHistory.length === 0) return;
    const last = dimensionHistory[dimensionHistory.length - 1];
    setPlotDimensions(last);
    setDimensionHistory(prev => prev.slice(0, -1));
  };

  const handleResetDimensions = () => {
    setPlotDimensions({ length: 0, width: 0, area: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 });
    setDimDetails({
      A: { ft: 0, in: 0 },
      B: { ft: 0, in: 0 },
      C: { ft: 0, in: 0 },
      D: { ft: 0, in: 0 },
    });
    setDimensionHistory([]);
    setRoadFacingOption("");
    setParkingSide("SOUTH");
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
    setFloorRooms(prev => {
      if (prev[floor]) return prev;
      return { ...prev, [floor]: {} };
    });
  };

  const toggleRoom = (floor: string, roomKey: string) => {
    setFloorRooms(prev => {
      const floorMap = prev[floor] || {};
      const currentRoom = floorMap[roomKey];
      const nextSelected = !(currentRoom?.selected ?? false);

      return {
        ...prev,
        [floor]: {
          ...floorMap,
          [roomKey]: {
            ...(currentRoom || { count: 1, areaMode: "AUTO", areaPerRoom: 100 }),
            selected: nextSelected,
          },
        },
      };
    });
  };

  const updateRoom = (floor: string, roomKey: string, patch: Partial<FloorRoom>) => {
    setFloorRooms(prev => {
      const floorMap = prev[floor] || {};
      const currentRoom = floorMap[roomKey];

      const nextRoom: any = currentRoom
        ? { ...currentRoom, ...patch }
        : {
            selected: true,
            count: 1,
            areaMode: "AUTO",
            areaPerRoom: 100,
            ...patch,
          };

      if (nextRoom.selected === undefined || nextRoom.selected === null) {
        nextRoom.selected = true;
      }

      return {
        ...prev,
        [floor]: {
          ...floorMap,
          [roomKey]: nextRoom,
        },
      };
    });
  };

  const handleClearForm = () => {
    setCustomerName("");
    setPropertyAddress("");
    setSelectedClientName("");
    setRepresentative("");
    setRoadFacingOption("");
    setParkingSide("SOUTH");
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
    lastExtractedSignature.current = "";
    setGroundStairPos(null);
    setGroundStairOffset(null);
    setGroundFloorProgram([]);
    setShowInlinePlan(false);
    setGeneratedPreviewPayload(null);
    alert("Form cleared successfully!");
  };

  // ============================================================
  // ✅ FIXED: handleGeneratePlan
  //   - safePlotDimensions (dimDetails se fallback)
  //   - safeFloorData (1×1 detection)
  //   - floorData/floorRooms GENERATED se (input se nahi)
  // ============================================================
  const handleGeneratePlan = () => {
    try {
      const getDim = (side: 'A' | 'B' | 'C' | 'D'): number => {
        const fromState = Number(plotDimensions[side]) || 0;
        if (fromState > 0) return fromState;
        const detail = dimDetails[side] || { ft: 0, in: 0 };
        return Number(detail.ft || 0) + Number(detail.in || 0) / 12;
      };

      const safeA = getDim('A');
      const safeB = getDim('B') || safeA;
      const safeC = getDim('C');
      const safeD = getDim('D') || safeC;

      const safePlotDimensions: PlotDimensions = {
        ...plotDimensions,
        A: safeA,
        B: safeB,
        C: safeC,
        D: safeD,
        E: Number(plotDimensions.E) || 0,
        F: Number(plotDimensions.F) || 0,
        width: safeA,
        length: safeC,
        area: safeA * safeC,
      };

      const safePlotArea = safePlotDimensions.area > 0
        ? safePlotDimensions.area
        : (safeA * safeC);

      const safeFloorData: Record<string, any> = { ...floorData };
      Object.keys(safeFloorData).forEach(floor => {
        const fd = safeFloorData[floor];
        if (!fd || (Number(fd.width) === 1 && Number(fd.length) === 1)) {
          safeFloorData[floor] = {
            width: safeA,
            length: safeC,
            area: safePlotArea,
          };
        }
      });

      console.log("[GENERATE] State check:", {
        plotDimensions,
        dimDetails,
        safePlotDimensions,
        safePlotArea,
        customerName,
        selectedClientName,
        representative,
        roadFacingOption,
        plotShape,
        parkingSide,
        selectedFloors,
        floorData: safeFloorData,
      });

      const inputPayload = {
        caseType,
        feeMode,
        manualFee,
        registeredFee,
        customerName: customerName || "",
        propertyAddress: propertyAddress || "",
        selectedClientName: selectedClientName || "",
        representative: representative || "",
        measurementUnit,
        roadFacingOption: roadFacingOption || "1 SIDE ROAD (SOUTH)",
        plotShape: plotShape || "RECTANGLE",
        parkingSide,
        plotArea: safePlotArea,
        coverageType,
        plotDimensions: safePlotDimensions,
        dimensions: safePlotDimensions,
        dimDetails: { ...dimDetails },
        setbackInputs,
        boundaries: {
          north: boundaryNorth || "",
          south: boundarySouth || "",
          east: boundaryEast || "",
          west: boundaryWest || "",
        },
        selectedFloors,
        floorData: safeFloorData,
        floorBhkConfig,
        floorRooms,
        planningMode,
        floorSettings,
        groundStairPosition: groundStairPos,
        groundStairRelativeOffset: groundStairOffset,
        groundFloorProgram,
        createdAt: new Date().toISOString(),
      };

      const generated = generateCompleteConstructionPlan(inputPayload);

      // ✅ FINAL previewPayload
      const previewPayload = {
        ...inputPayload,
        // Inputs (user entered) — preserve
        plotDimensions: safePlotDimensions,
        dimensions: safePlotDimensions,
        dimDetails: { ...dimDetails },
        plotArea: safePlotArea,
        plotShape: plotShape || "RECTANGLE",
        roadFacingOption: roadFacingOption || "1 SIDE ROAD (SOUTH)",
        customerName: customerName || "",
        propertyAddress: propertyAddress || "",
        selectedClientName: selectedClientName || "",
        representative: representative || "",
        boundaries: {
          north: boundaryNorth || "",
          south: boundarySouth || "",
          east: boundaryEast || "",
          west: boundaryWest || "",
        },

        // ✅ FIX: floorData/floorRooms GENERATED se lo (rooms, walls, staircase sab)
        // Agar generated empty ho to input ka safeFloorData fallback
        floorData: (generated?.floorData && Object.keys(generated.floorData).length > 0)
          ? generated.floorData
          : safeFloorData,
        floorRooms: (generated?.floorRooms && Object.keys(generated.floorRooms).length > 0)
          ? generated.floorRooms
          : floorRooms,

        // Generated output (backup ke liye)
        generatedFloorPlans: generated.floors,
        generatedFloorData: generated.floorData,
        generatedFloorRooms: generated.floorRooms,
        generatedConstructionPlan: generated,
        plotGeometry: generated.plotGeometry,
        buildableGeometry: generated.buildableGeometry,
        setbackRules: generated.setbackRules,
        elevation: generated.elevation,
        section: generated.section,
        generatedAt: generated.generatedAt,
        previewVersion: 2,
      };

      console.log("[GENERATE] Final previewPayload:", {
        plotDimensions: previewPayload.plotDimensions,
        plotArea: previewPayload.plotArea,
        customerName: previewPayload.customerName,
        selectedClientName: previewPayload.selectedClientName,
        representative: previewPayload.representative,
        roadFacingOption: previewPayload.roadFacingOption,
        plotShape: previewPayload.plotShape,
        boundaries: previewPayload.boundaries,
        floorDataKeys: Object.keys(previewPayload.floorData || {}),
        groundFloorRoomsCount:
          (previewPayload.floorData?.["GROUND FLOOR"]?.rooms || []).length,
      });

      localStorage.setItem("construction_plan_preview_data", JSON.stringify(previewPayload));
      localStorage.setItem("constructionPlanData", JSON.stringify(previewPayload));

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
      parking_side: parkingSide,
      boundaries: { north: boundaryNorth, south: boundarySouth, east: boundaryEast, west: boundaryWest },
      planning_mode: planningMode,
      floor_settings: floorSettings
    };
  }, [plotDimensions, floorData, floorRooms, floorSettings, planningMode, selectedFloors, roadFacingOption, parkingSide, boundaryNorth, boundarySouth, boundaryEast, boundaryWest]);

  const liveGeneratedPlan = useMemo(() => {
    try {
      return generateCompleteConstructionPlan({
        caseType, feeMode, manualFee, registeredFee, customerName, propertyAddress,
        selectedClientName, representative, measurementUnit,
        roadFacingOption: roadFacingOption || "1 SIDE ROAD (SOUTH)",
        parkingSide,
        plotShape: plotShape || "RECTANGULAR",
        plotArea, coverageType, plotDimensions, dimDetails, setbackInputs,
        boundaries: { north: boundaryNorth, south: boundarySouth, east: boundaryEast, west: boundaryWest },
        selectedFloors, floorData, floorBhkConfig, floorRooms, planningMode, floorSettings,
        groundStairPosition: groundStairPos,
        groundStairRelativeOffset: groundStairOffset,
        groundFloorProgram,
      });
    } catch (error) {
      console.warn("Live construction-plan generation preview fallback:", error);
      return null;
    }
  }, [
    caseType, feeMode, manualFee, registeredFee, customerName, propertyAddress,
    selectedClientName, representative, measurementUnit, roadFacingOption,
    parkingSide,
    plotShape,
    plotArea, coverageType, plotDimensions, dimDetails, setbackInputs, boundaryNorth,
    boundarySouth, boundaryEast, boundaryWest, selectedFloors, floorData, floorBhkConfig,
    floorRooms, planningMode, floorSettings,
    groundStairPos, groundStairOffset, groundFloorProgram,
  ]);

  const enrichedFloorData = useMemo(() => {
    if (liveGeneratedPlan?.floorData) return liveGeneratedPlan.floorData;
    const result: Record<string, any> = {};
    selectedFloors.forEach((floor) => {
      result[floor] = floorData[floor] || { width: frontWidthFt || 30, length: depthFt || 50, area: plotArea || 1500, rooms: [] };
    });
    return result;
  }, [liveGeneratedPlan, selectedFloors, floorData, frontWidthFt, depthFt, plotArea]);

  const generatedCadFloorRooms = useMemo(() => {
    if (liveGeneratedPlan?.floorRooms) return liveGeneratedPlan.floorRooms;
    const result: Record<string, FloorRoom[]> = {};
    selectedFloors.forEach((floor) => {
      result[floor] = Array.isArray(enrichedFloorData[floor]?.rooms) ? enrichedFloorData[floor].rooms as FloorRoom[] : [];
    });
    return result;
  }, [liveGeneratedPlan, selectedFloors, enrichedFloorData]);

  const isMultiDimShape = typeof plotShape === "string" && plotShape.includes("L-SHAPE");

  const inlinePlotPoints = useMemo(() => {
    const payload = generatedPreviewPayload;
    if (!payload) return [];
    const d = payload.plotDimensions || payload.dimensions || {};
    const A = Number(d.A || d.width || 20);
    const B = Number(d.B || A);
    const C = Number(d.C || d.length || 50);
    const D = Number(d.D || C);
    const s = 5.5;
    const bw = A * s, tw = B * s, hl = C * s, hr = D * s;
    return [
      { x: -tw / 2, y: -hl / 2 },
      { x: tw / 2, y: -hr / 2 },
      { x: bw / 2, y: hl / 2 },
      { x: -bw / 2, y: hl / 2 },
    ];
  }, [generatedPreviewPayload]);

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
        parkingSide={parkingSide}
        setParkingSide={setParkingSide}
        parkingSideOptions={PARKING_SIDE_OPTIONS}
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
        planningMode={planningMode as "AUTO" | "MANUAL"}
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
        plotWidth={frontWidthFt}
        plotLength={depthFt}
        groundCoverage={coverageType}
        parkingSide={parkingSide}
        roadFacingOption={roadFacingOption}
        groundStairPositionExternal={groundStairPos}
        groundStairRelativeOffsetExternal={groundStairOffset}
        onPlanningContextReady={(ctx) => {
          if (!groundStairPos && ctx.groundStairPosition) {
            setGroundStairPos(ctx.groundStairPosition);
          }
          if (!groundStairOffset && ctx.groundStairRelativeOffset) {
            setGroundStairOffset(ctx.groundStairRelativeOffset);
          }
          if ((!groundFloorProgram || groundFloorProgram.length === 0) && ctx.groundFloorProgram?.length) {
            setGroundFloorProgram(ctx.groundFloorProgram);
          }
        }}
      />

      <div className="flex flex-wrap gap-2 border-t-2 border-black pt-3">
        <button 
          type="button" 
          onClick={() => {
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

        floorRooms={(() => {
          const merged: Record<string, Record<string, FloorRoom>> = {};

          Object.entries(generatedCadFloorRooms || {}).forEach(([floor, rooms]) => {
            if (Array.isArray(rooms)) {
              merged[floor] = Object.fromEntries(
                rooms.map((r: any, idx) => [r.id || r.type || idx, { ...r }])
              );
            } else if (rooms && typeof rooms === "object") {
              const cloned: Record<string, any> = {};
              Object.entries(rooms as any).forEach(([k, v]: any) => {
                cloned[k] = { ...(v as any) };
              });
              merged[floor] = cloned;
            }
          });

          Object.entries(floorRooms || {}).forEach(([floor, roomsMap]) => {
            const existing = merged[floor] || {};
            const mergedFloor: Record<string, FloorRoom> = { ...existing };

            Object.entries(roomsMap || {}).forEach(([roomKey, room]) => {
              if (room && (room as any).selected) {
                mergedFloor[roomKey] = { ...(existing[roomKey] || {}), ...room };
              } else if (mergedFloor[roomKey]) {
                delete mergedFloor[roomKey];
              }
            });

            merged[floor] = mergedFloor;
          });

          return merged;
        })()}

        floorSettings={floorSettings}
        floorBhkConfig={floorBhkConfig}
        planningMode={planningMode}
      />

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