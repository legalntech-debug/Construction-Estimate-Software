'use type';

'use client';

import React, { useState, useEffect } from "react";
import { FloorData, FloorRoom as BaseFloorRoom } from "../engine/planningTypes";

// Extend FloorRoom interface locally or ensure your planningTypes include width/length
export interface FloorRoom extends BaseFloorRoom {
  width?: number;
  length?: number;
  areaMode?: "AUTO" | "MANUAL";
  areaPerRoom?: number;
}

// ============================================================================
// COMPREHENSIVE IS CODE & NBC TECHNICAL MINIMUM STANDARDS
// ============================================================================
export const IS_CODE_MINIMUMS = {
  floorHeightFt: 10.0,
  plinthHeightFt: 1.5,
  plinthSlabThickIn: 4.0,
  floorSlabThickIn: 5.0,
  beamWidthIn: 9.0,
  beamDepthIn: 12.0,
  columnWidthIn: 9.0,
  columnDepthIn: 9.0,
  mainDoorWidthFt: 3.5,
  mainDoorHeightFt: 7.0,
  internalDoorWidthFt: 3.0,
  internalDoorHeightFt: 7.0,
  toiletDoorWidthFt: 2.5,
  toiletDoorHeightFt: 7.0,
  windowWidthFt: 4.0,
  windowHeightFt: 4.0,
  windowSillHeightFt: 3.0,
  ventilatorWidthFt: 2.0,
  ventilatorHeightFt: 2.0,
  stairRiserIn: 6.0,
  stairTreadIn: 10.0,
  stairFlightWidthFt: 3.25,
  stairLandingWidthFt: 3.25,
  stairHeadroomFt: 7.25,
  stairHandrailHeightFt: 3.0,
};

export interface TechnicalSpecs {
  floorHeightFt: number;
  plinthHeightFt: number;
  plinthSlabThickIn: number;
  floorSlabThickIn: number;
  beamWidthIn: number;
  beamDepthIn: number;
  columnWidthIn: number;
  columnDepthIn: number;
  mainDoorWidthFt: number;
  mainDoorHeightFt: number;
  internalDoorWidthFt: number;
  internalDoorHeightFt: number;
  toiletDoorWidthFt: number;
  toiletDoorHeightFt: number;
  windowWidthFt: number;
  windowHeightFt: number;
  windowSillHeightFt: number;
  ventilatorWidthFt: number;
  ventilatorHeightFt: number;
  stairRiserIn: number;
  stairTreadIn: number;
  stairFlightWidthFt: number;
  stairLandingWidthFt: number;
  stairHeadroomFt: number;
  stairHandrailHeightFt: number;
  [key: string]: any;
}

// ============================================================================
// HELPER: DYNAMIC DOOR/WINDOW/VENTILATOR COUNTER
// ============================================================================
export function calculateFloorOpenings(floorRoomsMap: Record<string, FloorRoom>) {
  let mainDoors = 0;
  let internalDoors = 0;
  let toiletDoors = 0;
  let windows = 0;
  let ventilators = 0;

  Object.entries(floorRoomsMap || {}).forEach(([key, room]) => {
    if (!room?.selected) return;
    const count = room.count || 1;

    if (key === "verandah" || key === "parking_with_stair" || key === "parking") {
      mainDoors += 1;
    } else if (key.includes("bathroom") || key === "wc") {
      toiletDoors += count;
      ventilators += count;
    } else if (
      key.includes("bedroom") ||
      key === "kitchen" ||
      key === "living_room" ||
      key === "hall" ||
      key === "study_room" ||
      key === "pooja_room" ||
      key === "store_room"
    ) {
      internalDoors += count;
      if (key === "master_bedroom" || key === "living_room" || key === "hall") {
        windows += count * 2;
      } else {
        windows += count * 1;
      }
    }
  });

  return { mainDoors, internalDoors, toiletDoors, windows, ventilators };
}

// ============================================================================
// STANDARD PRESETS DATABASE
// ============================================================================
export const STANDARD_LOAN_PRESETS: Record<string, { label: string; width: number; length: number }> = {
  "10x20": { label: "10' x 20' (200 SQ.FT)", width: 10, length: 20 },
  "10x30": { label: "10' x 30' (300 SQ.FT)", width: 10, length: 30 },
  "10x40": { label: "10' x 40' (400 SQ.FT)", width: 10, length: 40 },
  "10x50": { label: "10' x 50' (500 SQ.FT)", width: 10, length: 50 },
  "12.5x30": { label: "12.5' x 30' (375 SQ.FT)", width: 12.5, length: 30 },
  "12.5x40": { label: "12.5' x 40' (500 SQ.FT)", width: 12.5, length: 40 },
  "12.5x50": { label: "12.5' x 50' (625 SQ.FT)", width: 12.5, length: 50 },
  "15x30": { label: "15' x 30' (450 SQ.FT)", width: 15, length: 30 },
  "15x40": { label: "15' x 40' (600 SQ.FT)", width: 15, length: 40 },
  "15x50": { label: "15' x 50' (750 SQ.FT)", width: 15, length: 50 },
  "15x60": { label: "15' x 60' (900 SQ.FT)", width: 15, length: 60 },
  "20x30": { label: "20' x 30' (600 SQ.FT)", width: 20, length: 30 },
  "20x40": { label: "20' x 40' (800 SQ.FT)", width: 20, length: 40 },
  "20x50": { label: "20' x 50' (1,000 SQ.FT)", width: 20, length: 50 },
  "20x60": { label: "20' x 60' (1,200 SQ.FT)", width: 20, length: 60 },
  "22.5x45": { label: "22.5' x 45' (1,012.5 SQ.FT)", width: 22.5, length: 45 },
  "22.5x50": { label: "22.5' x 50' (1,125 SQ.FT)", width: 22.5, length: 50 },
  "25x40": { label: "25' x 40' (1,000 SQ.FT)", width: 25, length: 40 },
  "25x50": { label: "25' x 50' (1,250 SQ.FT)", width: 25, length: 50 },
  "25x60": { label: "25' x 60' (1,500 SQ.FT)", width: 25, length: 60 },
  "30x40": { label: "30' x 40' (1,200 SQ.FT)", width: 30, length: 40 },
  "30x50": { label: "30' x 50' (1,500 SQ.FT)", width: 30, length: 50 },
  "30x60": { label: "30' x 60' (1,800 SQ.FT)", width: 30, length: 60 },
  "35x50": { label: "35' x 50' (1,750 SQ.FT)", width: 35, length: 50 },
  "40x50": { label: "40' x 50' (2,000 SQ.FT)", width: 40, length: 50 },
  "50x50": { label: "50' x 50' (2,500 SQ.FT)", width: 50, length: 50 },
};

export function getNearestPreset(w: number, l: number) {
  let nearestKey = "20x50";
  let minDiff = Infinity;

  Object.entries(STANDARD_LOAN_PRESETS).forEach(([key, preset]) => {
    const diff = Math.abs(preset.width - w) * 1.5 + Math.abs(preset.length - l);
    if (diff < minDiff) {
      minDiff = diff;
      nearestKey = key;
    }
  });

  return { key: nearestKey, ...STANDARD_LOAN_PRESETS[nearestKey] };
}

export function getAutoRoomsForFloor(floorName: string, width: number, length: number): string[] {
  const upper = floorName.toUpperCase();
  const area = Math.max(0, Number(width) || 0) * Math.max(0, Number(length) || 0);
  const isGround = upper.includes("GROUND");
  const isTower = upper.includes("TOWER") || upper.includes("MUMTY");
  if (isTower) return area >= 80 ? ["staircase", "terrace_garden", "utility"] : ["staircase"];

  // PDF D349 Style: 20x35 (700 sqft) -> Parking, Hall, Kitchen cum Dining, Master Bedroom, Stair
  if (isGround) {
    if (area < 400 || width < 10) return ["parking_with_stair", "hall", "kitchen", "wc", "duct"];
    if (area <= 1200) return ["parking", "hall", "kitchen_cum_dining", "master_bedroom", "attached_bathroom", "common_bathroom", "staircase", "duct"];
    if (width >= 34 && length >= 50) return ["parking_with_stair", "hall", "kitchen_cum_dining", "master_bedroom", "bedroom", "bedroom", "attached_bathroom", "common_bathroom", "pooja_room", "study_room", "duct"];
    return ["parking_with_stair", "hall", "kitchen_cum_dining", "master_bedroom", "bedroom", "attached_bathroom", "common_bathroom", "pooja_room", "duct"];
  }

  if (area < 500 || width < 12) return ["staircase", "living_room", "master_bedroom", "common_bathroom", "balcony", "duct"];
  if (area <= 1200 || width < 20) return ["staircase", "living_room", "master_bedroom", "attached_bathroom", "common_bathroom", "balcony", "duct"];
  return ["staircase", "hall", "master_bedroom", "bedroom", "bedroom", "attached_bathroom", "common_bathroom", "study_room", "balcony", "duct"];
}

interface FloorManagerSectionProps {
  selectedFloors: string[];
  floorData: Record<string, FloorData>;
  floorBhkConfig?: Record<string, string>;
  roomEditorFloor: string | null;
  floorRooms: Record<string, Record<string, FloorRoom>>;
  updateFloorAreaDirect: (floor: string, area: number) => void;
  updateFloorDimensions?: (floor: string, width: number, length: number) => void;
  updateFloorSetbacks?: (floor: string, setback: { front?: number; rear?: number; left?: number; right?: number }) => void;
  updateFloorPosition?: (floor: string, x: number, y: number) => void;
  applyBhkTemplate?: (floor: string, bhkType: string) => void;
  openFloorCadModal?: (floor: string) => void;
  ensureFloorRooms: (floor: string) => void;
  setRoomEditorFloor: (floor: string | null) => void;
  toggleRoom: (floor: string, roomKey: string) => void;
  updateRoom: (floor: string, roomKey: string, patch: Partial<FloorRoom>) => void;
  resetFloorRooms?: (floor: string) => void;
  BHK_CONFIGURATIONS?: readonly string[];
  plotLength?: number | string;
  plotWidth?: number | string;
  groundCoverage?: string;
  frontSetback?: number | string;
  rearSetback?: number | string;
  leftSetback?: number | string;
  rightSetback?: number | string;
  planningMode?: "AUTO" | "MANUAL";
  setPlanningMode?: React.Dispatch<React.SetStateAction<"AUTO" | "MANUAL">>;
  floorSettings?: any;
  settingsFloor?: any;
  setSettingsFloor?: any;
  updateFloorSettings?: (floor: string, specs: any) => void;
}

interface SetbackType {
  front: number;
  rear: number;
  left: number;
  right: number;
}

export const ROOM_CATALOG = [
  { key: "parking", label: "PARKING", defaultWidth: 10, defaultLength: 12, minWidth: 8, minLength: 10, defaultArea: 120, minArea: 80, category: "Ground" },
  { key: "parking_with_stair", label: "PARKING WITH STAIRCASE", defaultWidth: 10, defaultLength: 16, minWidth: 8, minLength: 14, defaultArea: 160, minArea: 110, category: "Ground" },
  { key: "staircase", label: "STAIRCASE", defaultWidth: 6.5, defaultLength: 10, minWidth: 6, minLength: 8, defaultArea: 65, minArea: 48, category: "Core" },
  { key: "stair_in_living", label: "STAIR IN LIVING ROOM", defaultWidth: 8, defaultLength: 10, minWidth: 7, minLength: 8, defaultArea: 80, minArea: 56, category: "Core" },
  { key: "verandah", label: "VERANDAH / PORCH", defaultWidth: 7.5, defaultLength: 10, minWidth: 5, minLength: 8, defaultArea: 75, minArea: 40, category: "Exterior" },
  { key: "living_room", label: "LIVING ROOM / FAMILY LOUNGE", defaultWidth: 12, defaultLength: 15, minWidth: 10, minLength: 12, defaultArea: 180, minArea: 120, category: "Living" },
  { key: "hall", label: "MAIN HALL", defaultWidth: 10, defaultLength: 15, minWidth: 9, minLength: 12, defaultArea: 150, minArea: 100, category: "Living" },
  { key: "kitchen", label: "KITCHEN (GROUND FLOOR)", defaultWidth: 6.5, defaultLength: 10, minWidth: 6, minLength: 8, defaultArea: 65, minArea: 48, category: "Kitchen" },
  { key: "kitchen_cum_dining", label: "KITCHEN CUM DINING", defaultWidth: 10, defaultLength: 13, minWidth: 8, minLength: 10, defaultArea: 130, minArea: 80, category: "Kitchen" },
  { key: "store_room", label: "STORE ROOM", defaultWidth: 5, defaultLength: 8, minWidth: 4, minLength: 6, defaultArea: 40, minArea: 24, category: "Utility" },
  { key: "master_bedroom", label: "MASTER BEDROOM (WITH TOILET)", defaultWidth: 12, defaultLength: 15, minWidth: 11, minLength: 12, defaultArea: 180, minArea: 130, category: "Bedroom" },
  { key: "bedroom", label: "BEDROOM", defaultWidth: 10, defaultLength: 14, minWidth: 9, minLength: 10, defaultArea: 140, minArea: 90, category: "Bedroom" },
  { key: "dressing", label: "DRESSING ROOM", defaultWidth: 5, defaultLength: 8, minWidth: 4, minLength: 5, defaultArea: 40, minArea: 20, category: "Bedroom" },
  { key: "common_bathroom", label: "COMMON BATHROOM", defaultWidth: 5, defaultLength: 9, minWidth: 4, minLength: 6, defaultArea: 45, minArea: 24, category: "Bathroom" },
  { key: "attached_bathroom", label: "ATTACHED BATHROOM", defaultWidth: 5, defaultLength: 10, minWidth: 4.5, minLength: 6.5, defaultArea: 50, minArea: 28, category: "Bathroom" },
  { key: "wc", label: "WC (TOILET)", defaultWidth: 4, defaultLength: 6, minWidth: 3.5, minLength: 4.5, defaultArea: 24, minArea: 15, category: "Bathroom" },
  { key: "pooja_room", label: "POOJA ROOM", defaultWidth: 5, defaultLength: 6, minWidth: 4, minLength: 4, defaultArea: 30, minArea: 16, category: "Common" },
  { key: "study_room", label: "STUDY / KIDS ROOM", defaultWidth: 7, defaultLength: 10, minWidth: 6, minLength: 8, defaultArea: 70, minArea: 48, category: "Common" },
  { key: "utility", label: "UTILITY / WASH AREA", defaultWidth: 5, defaultLength: 7, minWidth: 4, minLength: 5, defaultArea: 35, minArea: 20, category: "Utility" },
  { key: "balcony", label: "BALCONY", defaultWidth: 4.5, defaultLength: 10, minWidth: 3.5, minLength: 6, defaultArea: 45, minArea: 21, category: "Exterior" },
  { key: "duct", label: "VENTILATION DUCT", defaultWidth: 4, defaultLength: 6, minWidth: 3, minLength: 3, defaultArea: 24, minArea: 9, mandatory: true, category: "Core" },
  { key: "lift", label: "LIFT / ELEVATOR", defaultWidth: 5, defaultLength: 7, minWidth: 4.5, minLength: 5, defaultArea: 35, minArea: 22.5, category: "Core" },
  { key: "ground_garden", label: "GROUND FLOOR GARDEN / LAWN", defaultWidth: 10, defaultLength: 20, minWidth: 8, minLength: 10, defaultArea: 200, minArea: 80, category: "Exterior" },
  { key: "terrace_garden", label: "TERRACE GARDEN", defaultWidth: 10, defaultLength: 15, minWidth: 8, minLength: 10, defaultArea: 150, minArea: 80, category: "Exterior" },
  { key: "swimming_pool", label: "SWIMMING POOL", defaultWidth: 15, defaultLength: 20, minWidth: 10, minLength: 15, defaultArea: 300, minArea: 150, category: "Exterior" },
];

export default function FloorManagerSection({
  selectedFloors,
  floorData,
  roomEditorFloor,
  floorRooms,
  updateFloorAreaDirect,
  updateFloorDimensions,
  updateFloorSetbacks,
  updateFloorPosition,
  ensureFloorRooms,
  setRoomEditorFloor,
  toggleRoom,
  updateRoom,
  resetFloorRooms,
  plotLength = 0,
  plotWidth = 0,
  groundCoverage = "100_PERCENT",
  frontSetback = 0,
  rearSetback = 0,
  leftSetback = 0,
  rightSetback = 0,
  planningMode: propPlanningMode,
  setPlanningMode: propSetPlanningMode,
  updateFloorSettings,
}: FloorManagerSectionProps) {
  const [mosEditorFloor, setMosEditorFloor] = useState<string | null>(null);
  const [localSetbacks, setLocalSetbacks] = useState<Record<string, SetbackType>>({});

  const [internalPlanningMode, setInternalPlanningMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const planningMode = propPlanningMode ?? internalPlanningMode;
  const setPlanningMode = propSetPlanningMode ?? setInternalPlanningMode;

  const [activeGearFloor, setActiveGearFloor] = useState<string | null>(null);

  const [floorSpecs, setFloorSpecs] = useState<Record<string, TechnicalSpecs>>(() => {
    const initial: Record<string, TechnicalSpecs> = {};
    selectedFloors.forEach((f) => {
      initial[f] = { ...IS_CODE_MINIMUMS };
    });
    return initial;
  });

  const getFloorSpec = (floor: string): TechnicalSpecs => {
    return floorSpecs[floor] || { ...IS_CODE_MINIMUMS };
  };

  const handleSpecChange = (floor: string, field: keyof TechnicalSpecs, rawVal: number) => {
    const minVal = IS_CODE_MINIMUMS[field as keyof typeof IS_CODE_MINIMUMS] || 0;
    const finalVal = Math.max(rawVal, minVal);

    setFloorSpecs((prev) => ({
      ...prev,
      [floor]: {
        ...(prev[floor] || { ...IS_CODE_MINIMUMS }),
        [field]: finalVal,
      },
    }));
  };

  useEffect(() => {
    if (planningMode === "AUTO") {
      selectedFloors.forEach((floor) => {
        ensureFloorRooms(floor);
        const data = (floorData[floor] || {}) as Partial<FloorData>;
        const isTower = floor.toUpperCase().includes("TOWER");
        const currentW = Number(data.width) || (isTower ? 10 : Number(plotLength) || 20);
        const currentL = Number(data.length) || (isTower ? 10 : Number(plotWidth) || 50);

        const targetRooms = getAutoRoomsForFloor(floor, currentW, currentL);
        const floorRoomState = floorRooms[floor] || {};

        ROOM_CATALOG.forEach((room) => {
          const shouldSelect = targetRooms.includes(room.key);
          const isCurrentlySelected = !!floorRoomState[room.key]?.selected;

          if (shouldSelect !== isCurrentlySelected) {
            toggleRoom(floor, room.key);
          }
        });
      });
    }
  }, [planningMode, selectedFloors, plotLength, plotWidth, floorData]);

  const plotFrontWidth = Number(plotLength) > 0 ? Number(plotLength) : 20;
  const plotDepth = Number(plotWidth) > 0 ? Number(plotWidth) : 50;

  const numFrontSetback = Number(frontSetback) || 0;
  const numRearSetback = Number(rearSetback) || 0;
  const numLeftSetback = Number(leftSetback) || 0;
  const numRightSetback = Number(rightSetback) || 0;

  const currentColSpan = planningMode === "MANUAL" ? 7 : 6;

  const gfData = (floorData[selectedFloors[0]] || {}) as Partial<FloorData>;
  const gfW = Number(gfData.width) || plotFrontWidth;
  const gfL = Number(gfData.length) || plotDepth;
  const currentNearest = getNearestPreset(gfW, gfL);

  return (
    <div className="border-2 border-black mb-4 bg-white shadow-sm uppercase font-sans">
      <div className="bg-slate-900 text-white p-2 font-black text-xs sm:text-sm flex flex-col md:flex-row justify-between items-center px-4 gap-2">
        <span className="text-center font-extrabold tracking-wide">
          FLOOR-WISE BUILT-UP AREA & ROOM PLANNING (SINGLE FAMILY - 5 to 6 MEMBERS)
        </span>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded border border-amber-500/50">
            <span className="text-[10px] text-amber-400 font-bold">⚡ SMART AUTO-MATCH:</span>
            <span className="text-[11px] text-amber-300 font-black">
              {currentNearest.label}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded border border-slate-700">
            <span className={`text-[10px] font-bold ${planningMode === "AUTO" ? "text-green-400" : "text-gray-400"}`}>
              AUTO (IS CODE)
            </span>
            <button
              type="button"
              onClick={() => {
                const nextMode = planningMode === "AUTO" ? "MANUAL" : "AUTO";
                setPlanningMode(nextMode);
                if (nextMode === "AUTO") setRoomEditorFloor(null);
              }}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                planningMode === "MANUAL" ? "bg-amber-500 justify-end" : "bg-blue-600 justify-start"
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
            </button>
            <span className={`text-[10px] font-bold ${planningMode === "MANUAL" ? "text-amber-400" : "text-gray-400"}`}>
              MANUAL
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-200 text-black border-b-2 border-black">
            <tr>
              <th className="border-r border-black p-2.5 font-black text-left pl-3">FLOOR</th>
              <th className="border-r border-black p-2.5 font-black text-center">WIDTH (FT)</th>
              <th className="border-r border-black p-2.5 font-black text-center">LENGTH (FT)</th>
              <th className="border-r border-black p-2.5 font-black text-center">BUILT-UP AREA</th>
              <th className="border-r border-black p-2.5 font-black text-center">MOS / POSITION</th>
              {planningMode === "MANUAL" ? (
                <>
                  <th className="border-r border-black p-2.5 font-black text-center">ROOM EDIT</th>
                  <th className="p-2.5 font-black text-center w-16">SETTINGS</th>
                </>
              ) : (
                <th className="p-2.5 font-black text-center">AUTO ROOM PLAN (ACTUAL DIMENSION DYNAMIC)</th>
              )}
            </tr>
          </thead>
          <tbody>
            {selectedFloors.map((floor) => {
              const isGround = floor === "GROUND FLOOR" || floor.toUpperCase().includes("GROUND");
              const isTower = floor.toUpperCase().includes("TOWER");
              const data = (floorData[floor] || {}) as FloorData & { setbacks?: SetbackType; x?: number; y?: number };
              const isMosOpen = mosEditorFloor === floor;
              const isRoomOpen = roomEditorFloor === floor;

              const defaultSetbacks: SetbackType = data.setbacks && typeof data.setbacks === 'object' ? {
                front: Number(data.setbacks.front ?? (isTower ? 15 : numFrontSetback)),
                rear: Number(data.setbacks.rear ?? (isTower ? 25 : numRearSetback)),
                left: Number(data.setbacks.left ?? (isTower ? 7 : numLeftSetback)),
                right: Number(data.setbacks.right ?? (isTower ? 3 : numRightSetback)),
              } : {
                front: isTower ? 15 : numFrontSetback,
                rear: isTower ? 25 : numRearSetback,
                left: isTower ? 7 : numLeftSetback,
                right: isTower ? 3 : numRightSetback,
              };

              const setbacks = localSetbacks[floor] || defaultSetbacks;

              const calculatedFormulaWidth = Math.max(5, plotFrontWidth - (setbacks.left + setbacks.right));
              const calculatedFormulaLength = Math.max(5, plotDepth - (setbacks.front + setbacks.rear));

              const rawW = Number(data.width);
              const rawL = Number(data.length);

              let currentWidth = 0;
              let currentLength = 0;

              if (isGround) {
                let w = rawW > 0 ? rawW : plotFrontWidth;
                let l = rawL > 0 ? rawL : plotDepth;

                if (w > plotFrontWidth && l <= plotFrontWidth) {
                  const temp = w;
                  w = l;
                  l = temp;
                }

                currentWidth = w > plotFrontWidth ? plotFrontWidth : w;
                currentLength = l > plotDepth ? plotDepth : l;
              } else if (isTower) {
                currentWidth = rawW > 0 ? rawW : 10;
                currentLength = rawL > 0 ? rawL : 10;
              } else {
                currentWidth = rawW > 0 ? rawW : calculatedFormulaWidth;
                currentLength = rawL > 0 ? rawL : calculatedFormulaLength;
              }

              const calculatedArea = currentWidth * currentLength;
              const totalFloorBuiltUp = Number(data.area || calculatedArea);

              const floorRoomMap = floorRooms[floor] || {};
              let allocatedRoomArea = 0;
              const selectedRoomLabels: string[] = [];

              ROOM_CATALOG.forEach(cat => {
                const roomInfo = floorRoomMap[cat.key];
                if (roomInfo && roomInfo.selected) {
                  const rWidth = Number(roomInfo.width || cat.defaultWidth);
                  const rLength = Number(roomInfo.length || cat.defaultLength);
                  const rArea = roomInfo.areaMode === "MANUAL" ? Number(roomInfo.areaPerRoom || (rWidth * rLength)) : Number((rWidth * rLength).toFixed(2));
                  allocatedRoomArea += Number(roomInfo.count || 1) * rArea;
                  selectedRoomLabels.push(cat.label);
                }
              });

              const isFullCoverage = groundCoverage === "100_PERCENT";
              const availableCatalog = ROOM_CATALOG.filter(cat => {
                if (cat.mandatory) return true;
                if (totalFloorBuiltUp > 0 && cat.minArea > totalFloorBuiltUp) return false;
                return true;
              });

              return (
                <React.Fragment key={floor}>
                  <tr className="border-b border-black hover:bg-gray-50 transition">
                    <td className="border-r border-black p-3 font-black text-left pl-3 uppercase bg-slate-50 min-w-[180px]">
                      {isGround ? "GROUND FLOOR (KITCHEN & LIVING)" : isTower ? "TOWER PLANNING" : `${floor} PLANNING`}
                    </td>
                    
                    <td className="border-r border-black p-2.5 text-center">
                      <input
                        type="number"
                        value={currentWidth}
                        onChange={(e) => {
                          const w = Number(e.target.value) || 0;
                          const l = currentLength;
                          const newArea = Number((w * l).toFixed(2));

                          if (updateFloorDimensions) {
                            updateFloorDimensions(floor, w, l);
                          }
                          updateFloorAreaDirect(floor, newArea);
                        }}
                        placeholder="Width"
                        className="w-20 border-2 border-black p-1.5 text-center font-black text-xs bg-white focus:bg-amber-50"
                      />
                    </td>

                    <td className="border-r border-black p-2.5 text-center">
                      <input
                        type="number"
                        value={currentLength}
                        onChange={(e) => {
                          const l = Number(e.target.value) || 0;
                          const w = currentWidth;
                          const newArea = Number((w * l).toFixed(2));

                          if (updateFloorDimensions) {
                            updateFloorDimensions(floor, w, l);
                          }
                          updateFloorAreaDirect(floor, newArea);
                        }}
                        placeholder="Length"
                        className="w-20 border-2 border-black p-1.5 text-center font-black text-xs bg-white focus:bg-amber-50"
                      />
                    </td>

                    <td className="border-r border-black p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          value={data.area || totalFloorBuiltUp || ""}
                          onChange={(event) => {
                            let val = Number(event.target.value) || 0;
                            updateFloorAreaDirect(floor, val);
                          }}
                          className="w-24 border-2 border-black p-1.5 text-center font-black text-xs bg-white"
                        />
                        <span className="text-[10px] font-black">SQ.FT</span>
                      </div>
                    </td>

                    <td className="border-r border-black p-2.5 text-center">
                      {isGround ? (
                        <span className="text-[10px] font-bold text-gray-400">PLOT SETUP</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMosEditorFloor(isMosOpen ? null : floor)}
                          className="bg-amber-600 text-white px-3 py-1.5 text-xs font-black shadow hover:bg-amber-700 transition cursor-pointer uppercase"
                        >
                          {isMosOpen ? "CLOSE MOS" : "EDIT MOS"}
                        </button>
                      )}
                    </td>

                    {planningMode === "MANUAL" ? (
                      <>
                        <td className="border-r border-black p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              ensureFloorRooms(floor);
                              setRoomEditorFloor(isRoomOpen ? null : floor);
                            }}
                            className="bg-black text-white px-3 py-1.5 text-xs font-black shadow hover:bg-zinc-800 transition cursor-pointer uppercase"
                          >
                            {isRoomOpen ? "CLOSE" : "ROOMS"}
                          </button>
                        </td>

                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => setActiveGearFloor(floor)}
                            title={`${floor} Structural & Technical Settings`}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black border border-black font-black rounded cursor-pointer text-xs"
                          >
                            ⚙️
                          </button>
                        </td>
                      </>
                    ) : (
                      <td className="p-2.5 text-center">
                        <div className="flex flex-wrap gap-1 justify-center max-w-md mx-auto">
                          {selectedRoomLabels.length > 0 ? (
                            selectedRoomLabels.map((lbl) => (
                              <span key={lbl} className="bg-green-100 text-green-900 border border-green-400 text-[9px] font-black px-1.5 py-0.5 rounded">
                                ✓ {lbl}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-gray-400 font-bold">AUTO GENERATING...</span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>

                  {!isGround && isMosOpen && (
                    <tr className="bg-amber-50 border-b border-black">
                      <td colSpan={currentColSpan} className="p-3">
                        <div className="border border-amber-600 p-3 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                          <div className="text-xs font-black text-amber-900 col-span-2 sm:col-span-4 uppercase border-b border-amber-300 pb-1 flex justify-between items-center">
                            <span>Margin of Setbacks (MOS) & Position for {floor}</span>
                            <span className="text-[10px] text-gray-600">Max Plot: {plotFrontWidth}×{plotDepth} FT</span>
                          </div>
                          {["front", "rear", "left", "right"].map((side) => (
                            <div key={side} className="flex flex-col gap-1">
                              <span className="text-[10px] font-black">{side.toUpperCase()} MOS (FT)</span>
                              <input
                                type="number"
                                min={0}
                                value={setbacks[side as keyof SetbackType] ?? 0}
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  if (rawVal.includes('-')) return;
                                  const val = rawVal === "" ? 0 : Number(rawVal);
                                  const updated: SetbackType = { ...setbacks, [side]: val };
                                  setLocalSetbacks(prev => ({ ...prev, [floor]: updated }));

                                  if (updateFloorSetbacks) {
                                    updateFloorSetbacks(floor, updated);
                                  }

                                  const newLength = Math.max(5, plotDepth - (updated.front + updated.rear));
                                  const newWidth = Math.max(5, plotFrontWidth - (updated.left + updated.right));
                                  
                                  if (updateFloorDimensions) {
                                    updateFloorDimensions(floor, newWidth, newLength);
                                  }
                                  updateFloorAreaDirect(floor, Number((newWidth * newLength).toFixed(2)));

                                  if (isTower && updateFloorPosition) {
                                    updateFloorPosition(floor, updated.left, updated.front);
                                  }
                                }}
                                className="border border-black p-1.5 text-center text-xs font-bold bg-white"
                              />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {planningMode === "MANUAL" && isRoomOpen && (
                    <tr className="bg-slate-50 border-b-2 border-black">
                      <td colSpan={currentColSpan} className="p-4">
                        <div className="border-2 border-black bg-white p-3">
                          <div className="flex flex-col sm:flex-row justify-between items-center mb-3 border-b-2 border-black pb-2 gap-2">
                            <div className="font-black text-xs uppercase text-slate-900 text-left">
                              SEQUENTIAL ROOM PLANNING FOR {floor} (DIMENSIONS WITH MIN LIMITS & AREA CALCULATION)
                            </div>
                            <div className="text-xs font-black flex gap-3 items-center">
                              <span className="bg-slate-200 px-3 py-1 border border-black">
                                FLOOR BUILT-UP: {totalFloorBuiltUp} SQ.FT
                              </span>
                              <span className={`px-3 py-1 border border-black ${allocatedRoomArea > totalFloorBuiltUp ? 'bg-red-200 text-red-900' : 'bg-green-100 text-green-900'}`}>
                                ALLOCATED: {allocatedRoomArea.toFixed(2)} SQ.FT
                              </span>
                            </div>
                          </div>

                          {allocatedRoomArea > totalFloorBuiltUp && (
                            <div className="bg-red-600 text-white p-2 text-xs font-black mb-3 text-center border border-black">
                              ⚠️ WARNING: Selected rooms total area ({allocatedRoomArea.toFixed(2)} SQ.FT) exceeds floor built-up area ({totalFloorBuiltUp} SQ.FT)!
                            </div>
                          )}

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                            {/* PART 1: SELECT CATALOG & DIMENSIONS */}
                            <div className="border-2 border-black p-3 bg-white">
                              <div className="bg-slate-900 text-white p-2 text-xs font-black mb-2 flex justify-between items-center">
                                <span>PART 1: SELECT ITEMS, WIDTH & LENGTH (MIN LIMITS)</span>
                                {resetFloorRooms && (
                                  <button
                                    type="button"
                                    onClick={() => resetFloorRooms(floor)}
                                    className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-white cursor-pointer"
                                  >
                                    RESET ALL
                                  </button>
                                )}
                              </div>
                              <div className="max-h-[420px] overflow-auto">
                                <table className="w-full border-collapse text-xs">
                                  <thead className="bg-slate-200 sticky top-0">
                                    <tr>
                                      <th className="border border-black p-1.5 font-black text-center w-8">SEL</th>
                                      <th className="border border-black p-1.5 font-black text-left pl-2">ROOM / ITEM</th>
                                      <th className="border border-black p-1.5 font-black text-center w-10">NOS</th>
                                      <th className="border border-black p-1.5 font-black text-center w-16">W (FT)<br/><span className="text-[8px] font-normal text-gray-700">Min: W</span></th>
                                      <th className="border border-black p-1.5 font-black text-center w-16">L (FT)<br/><span className="text-[8px] font-normal text-gray-700">Min: L</span></th>
                                      <th className="border border-black p-1.5 font-black text-center w-16">SQ.FT</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {availableCatalog.map((room) => {
                                      const current = floorRoomMap[room.key] || {
                                        selected: room.mandatory && isFullCoverage ? true : false,
                                        count: 1,
                                        width: room.defaultWidth,
                                        length: room.defaultLength,
                                        areaMode: "AUTO" as const,
                                        areaPerRoom: room.defaultArea,
                                      };
                                      const rW = Number(current.width || room.defaultWidth);
                                      const rL = Number(current.length || room.defaultLength);
                                      const rArea = current.areaMode === "MANUAL" ? Number(current.areaPerRoom || (rW * rL)) : Number((rW * rL).toFixed(2));
                                      const itemTotalArea = Number(current.count || 1) * rArea;

                                      return (
                                        <tr key={room.key} className={current.selected ? "bg-amber-50" : ""}>
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="checkbox"
                                              checked={current.selected}
                                              onChange={() => {
                                                const nextAllocated = allocatedRoomArea + (current.selected ? -itemTotalArea : itemTotalArea);
                                                if (!current.selected && nextAllocated > totalFloorBuiltUp) {
                                                  alert("Cannot select: Exceeds floor built-up area!");
                                                  return;
                                                }
                                                toggleRoom(floor, room.key);
                                              }}
                                              className="w-4 h-4 cursor-pointer"
                                            />
                                          </td>
                                          <td className="border border-black p-1.5 font-bold text-left pl-2">
                                            {room.label} 
                                            {room.key === "stair_in_living" && <span className="block text-[8px] text-amber-800 font-bold">✨ Adjusts Living Area</span>}
                                            {room.key === "master_bedroom" && <span className="block text-[8px] text-blue-800 font-bold">✨ Includes Attached Toilet sizing</span>}
                                          </td>
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="number"
                                              min={1}
                                              value={current.count || 1}
                                              disabled={!current.selected}
                                              onChange={(e) => updateRoom(floor, room.key, { count: Math.max(1, Number(e.target.value) || 1) })}
                                              className="w-10 border border-black p-1 text-center font-bold text-xs bg-white"
                                            />
                                          </td>
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="number"
                                              step="0.5"
                                              min={room.minWidth}
                                              disabled={!current.selected}
                                              value={rW}
                                              onChange={(e) => {
                                                const val = Math.max(room.minWidth, Number(e.target.value) || room.minWidth);
                                                updateRoom(floor, room.key, { width: val, areaPerRoom: Number((val * rL).toFixed(2)) });
                                              }}
                                              title={`Min Width: ${room.minWidth}'`}
                                              className="w-14 border border-black p-1 text-center font-bold text-xs bg-white"
                                            />
                                            <span className="block text-[8px] text-gray-500">min {room.minWidth}&apos;</span>
                                          </td>
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="number"
                                              step="0.5"
                                              min={room.minLength}
                                              disabled={!current.selected}
                                              value={rL}
                                              onChange={(e) => {
                                                const val = Math.max(room.minLength, Number(e.target.value) || room.minLength);
                                                updateRoom(floor, room.key, { length: val, areaPerRoom: Number((rW * val).toFixed(2)) });
                                              }}
                                              title={`Min Length: ${room.minLength}'`}
                                              className="w-14 border border-black p-1 text-center font-bold text-xs bg-white"
                                            />
                                            <span className="block text-[8px] text-gray-500">min {room.minLength}&apos;</span>
                                          </td>
                                          <td className="border border-black p-1.5 text-center font-bold">
                                            {rArea.toFixed(0)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* PART 2: SELECTED LIST & SUMMARY */}
                            <div className="border-2 border-black p-3 bg-white">
                              <div className="bg-slate-900 text-white p-2 text-xs font-black mb-2 text-left pl-2">
                                PART 2: SELECTED ITEMS LIST & DIMENSIONS SUMMARY
                              </div>
                              <div className="max-h-[420px] overflow-auto">
                                <table className="w-full border-collapse text-xs">
                                  <thead className="bg-slate-200 sticky top-0">
                                    <tr>
                                      <th className="border border-black p-1.5 font-black text-left pl-2">SELECTED ITEM</th>
                                      <th className="border border-black p-1.5 font-black text-center">NOS</th>
                                      <th className="border border-black p-1.5 font-black text-center">DIMENSION (W×L)</th>
                                      <th className="border border-black p-1.5 font-black text-right pr-2">TOTAL</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ROOM_CATALOG.filter(room => floorRoomMap[room.key]?.selected).length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="border border-black p-8 text-center text-gray-500 font-bold">
                                          No items selected yet. Choose items from Part 1.
                                        </td>
                                      </tr>
                                    ) : (
                                      ROOM_CATALOG.filter(room => floorRoomMap[room.key]?.selected).map((room) => {
                                        const current = floorRoomMap[room.key];
                                        const rW = Number(current.width || room.defaultWidth);
                                        const rL = Number(current.length || room.defaultLength);
                                        const rArea = Number((rW * rL).toFixed(2));
                                        const total = Number(current.count || 1) * rArea;

                                        return (
                                          <tr key={`sel-${room.key}`} className="bg-green-50">
                                            <td className="border border-black p-1.5 font-bold text-left pl-2">{room.label}</td>
                                            <td className="border border-black p-1.5 text-center font-bold">{current.count || 1}</td>
                                            <td className="border border-black p-1.5 text-center font-bold">{rW}&apos; × {rL}&apos;</td>
                                            <td className="border border-black p-1.5 text-right pr-2 font-black">{total.toFixed(2)} SQ.FT</td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              <div className="mt-3 p-2 bg-slate-100 border border-black text-[10px] font-bold text-left">
                                <div className="flex justify-between items-center">
                                  <div>
                                    ✅ Total Allocated: <span className="font-black text-black">{allocatedRoomArea.toFixed(2)} SQ.FT</span>
                                  </div>
                                  <div className={`font-black ${(totalFloorBuiltUp - allocatedRoomArea) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                    ⚖️ Balance: {(totalFloorBuiltUp - allocatedRoomArea).toFixed(2)} SQ.FT
                                  </div>
                                </div>
                                <div className="mt-1 text-gray-700 border-t border-gray-300 pt-1">
                                  ℹ️ Living Room & Master Bedroom layouts automatically coordinate with attached toilets and interior stair integrations.
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL FOR STRUCTURAL & TECHNICAL SETTINGS */}
      {activeGearFloor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black w-full max-w-2xl p-5 font-sans uppercase shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-4">
              <h3 className="font-black text-sm text-slate-900">
                TECHNICAL NORMS & IS CODE SPECIFICATIONS — {activeGearFloor}
              </h3>
              <button
                type="button"
                onClick={() => setActiveGearFloor(null)}
                className="bg-red-600 text-white px-2 py-1 text-xs font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* DYNAMIC OPENINGS SUMMARY */}
            {(() => {
              const openings = calculateFloorOpenings(floorRooms[activeGearFloor] || {});
              return (
                <div className="bg-amber-100 border border-amber-600 p-2.5 mb-4 text-[10px] font-black">
                  <span className="text-amber-900 block font-black mb-1">📊 AUTO-CALCULATED OPENINGS FOR THIS FLOOR:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-slate-800">
                    <div className="bg-white p-1 border border-amber-400">MAIN DOORS: {openings.mainDoors}</div>
                    <div className="bg-white p-1 border border-amber-400">ROOM DOORS: {openings.internalDoors}</div>
                    <div className="bg-white p-1 border border-amber-400">TOILET DOORS: {openings.toiletDoors}</div>
                    <div className="bg-white p-1 border border-amber-400">WINDOWS: {openings.windows}</div>
                    <div className="bg-white p-1 border border-amber-400">VENTILATORS: {openings.ventilators}</div>
                  </div>
                </div>
              );
            })()}

            <p className="text-[9px] text-amber-700 font-bold mb-3">
              * Input values cannot be set lower than standard IS Code minimum thresholds.
            </p>

            <div className="space-y-4 text-[10px]">
              {activeGearFloor.toUpperCase().includes("GROUND") && (
                <div className="border border-black p-3 bg-amber-50">
                  <h4 className="font-black border-b border-black pb-1 mb-2 text-amber-900">
                    PLINTH DETAILS (GROUND FLOOR ONLY)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold mb-1">PLINTH HEIGHT (FT) [MIN: 1.5&apos;]</label>
                      <input
                        type="number"
                        step="0.1"
                        min={IS_CODE_MINIMUMS.plinthHeightFt}
                        value={getFloorSpec(activeGearFloor).plinthHeightFt}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "plinthHeightFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.plinthHeightFt)
                        }
                        className="w-full border border-black p-1 bg-white font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">PLINTH SLAB THICKNESS (INCH) [MIN: 4&quot;]</label>
                      <input
                        type="number"
                        step="0.5"
                        min={IS_CODE_MINIMUMS.plinthSlabThickIn}
                        value={getFloorSpec(activeGearFloor).plinthSlabThickIn}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "plinthSlabThickIn", parseFloat(e.target.value) || IS_CODE_MINIMUMS.plinthSlabThickIn)
                        }
                        className="w-full border border-black p-1 bg-white font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="border border-black p-3 bg-slate-50">
                <h4 className="font-black border-b border-black pb-1 mb-2 text-slate-800">FLOOR HEIGHT & STRUCTURAL SPECIFICATIONS</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold mb-1">FLOOR HEIGHT (FT) [STD: 10&apos;]</label>
                    <input
                      type="number"
                      step="0.5"
                      min={IS_CODE_MINIMUMS.floorHeightFt}
                      value={getFloorSpec(activeGearFloor).floorHeightFt}
                      onChange={(e) =>
                        handleSpecChange(activeGearFloor, "floorHeightFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.floorHeightFt)
                      }
                      className="w-full border border-black p-1 bg-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">SLAB THICKNESS (INCH) [MIN: 5&quot;]</label>
                    <input
                      type="number"
                      step="0.5"
                      min={IS_CODE_MINIMUMS.floorSlabThickIn}
                      value={getFloorSpec(activeGearFloor).floorSlabThickIn}
                      onChange={(e) =>
                        handleSpecChange(activeGearFloor, "floorSlabThickIn", parseFloat(e.target.value) || IS_CODE_MINIMUMS.floorSlabThickIn)
                      }
                      className="w-full border border-black p-1 bg-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">COLUMN SIZE (W × D INCH)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={IS_CODE_MINIMUMS.columnWidthIn}
                        value={getFloorSpec(activeGearFloor).columnWidthIn}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "columnWidthIn", parseFloat(e.target.value) || IS_CODE_MINIMUMS.columnWidthIn)
                        }
                        className="w-1/2 border border-black p-1 text-center font-bold text-xs"
                      />
                      <span className="self-center font-bold">×</span>
                      <input
                        type="number"
                        min={IS_CODE_MINIMUMS.columnDepthIn}
                        value={getFloorSpec(activeGearFloor).columnDepthIn}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "columnDepthIn", parseFloat(e.target.value) || IS_CODE_MINIMUMS.columnDepthIn)
                        }
                        className="w-1/2 border border-black p-1 text-center font-bold text-xs"
                      />
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block font-bold mb-1">BEAM SIZE (W × D INCH)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={IS_CODE_MINIMUMS.beamWidthIn}
                        value={getFloorSpec(activeGearFloor).beamWidthIn}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "beamWidthIn", parseFloat(e.target.value) || IS_CODE_MINIMUMS.beamWidthIn)
                        }
                        className="w-1/2 border border-black p-1 text-center font-bold text-xs"
                      />
                      <span className="self-center font-bold">×</span>
                      <input
                        type="number"
                        min={IS_CODE_MINIMUMS.beamDepthIn}
                        value={getFloorSpec(activeGearFloor).beamDepthIn}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "beamDepthIn", parseFloat(e.target.value) || IS_CODE_MINIMUMS.beamDepthIn)
                        }
                        className="w-1/2 border border-black p-1 text-center font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-black p-3 bg-blue-50">
                <h4 className="font-black border-b border-blue-900 pb-1 mb-2 text-blue-900">STAIRCASE TECHNICAL NORMS (IS 456 / NBC)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold mb-1">RISER (INCH) [MAX 6&quot;-7&quot;]</label>
                    <input
                      type="number"
                      step="0.25"
                      min={IS_CODE_MINIMUMS.stairRiserIn}
                      value={getFloorSpec(activeGearFloor).stairRiserIn}
                      onChange={(e) =>
                        handleSpecChange(activeGearFloor, "stairRiserIn", parseFloat(e.target.value) || IS_CODE_MINIMUMS.stairRiserIn)
                      }
                      className="w-full border border-black p-1 bg-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">TREAD (INCH) [MIN 10&quot;]</label>
                    <input
                      type="number"
                      step="0.5"
                      min={IS_CODE_MINIMUMS.stairTreadIn}
                      value={getFloorSpec(activeGearFloor).stairTreadIn}
                      onChange={(e) =>
                        handleSpecChange(activeGearFloor, "stairTreadIn", parseFloat(e.target.value) || IS_CODE_MINIMUMS.stairTreadIn)
                      }
                      className="w-full border border-black p-1 bg-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">FLIGHT WIDTH (FT) [MIN 3.25&apos;]</label>
                    <input
                      type="number"
                      step="0.25"
                      min={IS_CODE_MINIMUMS.stairFlightWidthFt}
                      value={getFloorSpec(activeGearFloor).stairFlightWidthFt}
                      onChange={(e) =>
                        handleSpecChange(activeGearFloor, "stairFlightWidthFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.stairFlightWidthFt)
                      }
                      className="w-full border border-black p-1 bg-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">LANDING WIDTH (FT) [MIN 3.25&apos;]</label>
                    <input
                      type="number"
                      step="0.25"
                      min={IS_CODE_MINIMUMS.stairLandingWidthFt}
                      value={getFloorSpec(activeGearFloor).stairLandingWidthFt}
                      onChange={(e) =>
                        handleSpecChange(activeGearFloor, "stairLandingWidthFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.stairLandingWidthFt)
                      }
                      className="w-full border border-black p-1 bg-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">HEADROOM CLEAR (FT) [MIN 7.25&apos;]</label>
                    <input
                      type="number"
                      step="0.25"
                      min={IS_CODE_MINIMUMS.stairHeadroomFt}
                      value={getFloorSpec(activeGearFloor).stairHeadroomFt}
                      onChange={(e) =>
                        handleSpecChange(activeGearFloor, "stairHeadroomFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.stairHeadroomFt)
                      }
                      className="w-full border border-black p-1 bg-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">HANDRAIL HT (FT) [MIN 3&apos;]</label>
                    <input
                      type="number"
                      step="0.25"
                      min={IS_CODE_MINIMUMS.stairHandrailHeightFt}
                      value={getFloorSpec(activeGearFloor).stairHandrailHeightFt}
                      onChange={(e) =>
                        handleSpecChange(activeGearFloor, "stairHandrailHeightFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.stairHandrailHeightFt)
                      }
                      className="w-full border border-black p-1 bg-white font-bold text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-black p-3 bg-gray-50">
                <h4 className="font-black border-b border-black pb-1 mb-2">DOOR & WINDOW NORMS BY TYPE</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold mb-1">MAIN DOOR (W × H FT)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.25"
                        value={getFloorSpec(activeGearFloor).mainDoorWidthFt}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "mainDoorWidthFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.mainDoorWidthFt)
                        }
                        className="w-1/2 border border-black p-1 text-center font-bold text-xs"
                      />
                      <span className="self-center">×</span>
                      <input
                        type="number"
                        step="0.5"
                        value={getFloorSpec(activeGearFloor).mainDoorHeightFt}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "mainDoorHeightFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.mainDoorHeightFt)
                        }
                        className="w-1/2 border border-black p-1 text-center font-bold text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">ROOM DOOR (W × H FT)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.25"
                        value={getFloorSpec(activeGearFloor).internalDoorWidthFt}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "internalDoorWidthFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.internalDoorWidthFt)
                        }
                        className="w-1/2 border border-black p-1 text-center font-bold text-xs"
                      />
                      <span className="self-center">×</span>
                      <input
                        type="number"
                        step="0.5"
                        value={getFloorSpec(activeGearFloor).internalDoorHeightFt}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "internalDoorHeightFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.internalDoorHeightFt)
                        }
                        className="w-1/2 border border-black p-1 text-center font-bold text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">TOILET DOOR (W × H FT)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.25"
                        value={getFloorSpec(activeGearFloor).toiletDoorWidthFt}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "toiletDoorWidthFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.toiletDoorWidthFt)
                        }
                        className="w-1/2 border border-black p-1 text-center font-bold text-xs"
                      />
                      <span className="self-center">×</span>
                      <input
                        type="number"
                        step="0.5"
                        value={getFloorSpec(activeGearFloor).toiletDoorHeightFt}
                        onChange={(e) =>
                          handleSpecChange(activeGearFloor, "toiletDoorHeightFt", parseFloat(e.target.value) || IS_CODE_MINIMUMS.toiletDoorHeightFt)
                        }
                        className="w-1/2 border border-black p-1 text-center font-bold text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-black flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (activeGearFloor) {
                    const currentSpecs = getFloorSpec(activeGearFloor);
                    const openings = calculateFloorOpenings(floorRooms[activeGearFloor] || {});
                    if (updateFloorSettings) {
                      updateFloorSettings(activeGearFloor, {
                        ...currentSpecs,
                        planningMode,
                        mainDoorCount: openings.mainDoors,
                        internalDoorCount: openings.internalDoors,
                        bathroomDoorCount: openings.toiletDoors,
                        windowCount: openings.windows,
                        ventilatorCount: openings.ventilators,
                      });
                    }
                  }
                  setActiveGearFloor(null);
                }}
                className="bg-black text-white px-5 py-2 font-black cursor-pointer text-xs uppercase hover:bg-slate-800 transition"
              >
                SAVE & APPLY NORMS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}