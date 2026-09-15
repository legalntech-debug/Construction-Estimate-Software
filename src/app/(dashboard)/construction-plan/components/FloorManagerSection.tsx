'use client';

import React, { useState, useEffect } from "react";
import { FloorData, FloorRoom as BaseFloorRoom } from "../engine/planningTypes";

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
      key === "living_room_with_stair" ||
      key === "hall" ||
      key === "study_room" ||
      key === "pooja_room" ||
      key === "store_room"
    ) {
      internalDoors += count;
      if (key === "master_bedroom" || key === "living_room" || key === "living_room_with_stair" || key === "hall") {
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
  "10x40": { label: "10' x 40' (400 SQ.FT)", width: 10, length: 40 },
  "10x50": { label: "10' x 50' (500 SQ.FT)", width: 10, length: 50 },
  "15x40": { label: "15' x 40' (600 SQ.FT)", width: 15, length: 40 },
  "15x50": { label: "15' x 50' (750 SQ.FT)", width: 15, length: 50 },
  "20x30": { label: "20' x 30' (600 SQ.FT)", width: 20, length: 30 },
  "20x40": { label: "20' x 40' (800 SQ.FT)", width: 20, length: 40 },
  "20x50": { label: "20' x 50' (1,000 SQ.FT)", width: 20, length: 50 },
  "22x45": { label: "22' x 45' (990 SQ.FT)", width: 22, length: 45 },
  "22x50": { label: "22' x 50' (1,100 SQ.FT)", width: 22, length: 50 },
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

// ============================================================================
// UNIFIED AUTO-PLANNING LOGIC
// ============================================================================
export function getAutoRoomsForFloor(floorName: string, width: number, length: number): string[] {
  const upper = floorName.toUpperCase();
  const isGround = upper.includes("GROUND");
  const isTower = upper.includes("TOWER") || upper.includes("MUMTY");

  if (isTower) return ["staircase", "terrace_garden", "utility"];

  if (isGround) {
    if (width <= 16) {
      return [
        "living_room_with_stair",
        "common_bathroom",
        "kitchen",
        "bedroom",
        "parking_with_stair"
      ];
    } else {
      return [
        "kitchen",
        "living_room_with_stair",
        "bedroom",
        "common_bathroom",
        "parking"
      ];
    }
  } else {
    // First Floor & Upper Floors: Master Bedrooms / Modern Bungalow Pattern
    return [
      "staircase",
      "hall",
      "master_bedroom",
      "balcony",
      "duct"
    ];
  }
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

// ============================================================================
// COMPREHENSIVE UNIFIED ROOM CATALOG
// ============================================================================
export const ROOM_CATALOG = [
  { key: "parking", label: "PARKING", defaultWidth: 9, defaultLength: 10, minWidth: 6, minLength: 7, defaultArea: 90, minArea: 42, category: "Ground" },
  { key: "parking_with_stair", label: "PARKING WITH STAIRCASE", defaultWidth: 6, defaultLength: 7, minWidth: 6, minLength: 7, defaultArea: 42, minArea: 42, category: "Ground" },
  { key: "staircase", label: "STAIRCASE", defaultWidth: 6.5, defaultLength: 10, minWidth: 6, minLength: 8, defaultArea: 65, minArea: 48, category: "Core" },
  { key: "living_room_with_stair", label: "LIVING ROOM + STAIR (U-SHAPE)", defaultWidth: 10, defaultLength: 16, minWidth: 10, minLength: 14, defaultArea: 160, minArea: 120, category: "Living" },
  { key: "living_room", label: "LIVING ROOM / FAMILY LOUNGE", defaultWidth: 12, defaultLength: 15, minWidth: 10, minLength: 12, defaultArea: 180, minArea: 120, category: "Living" },
  { key: "hall", label: "MAIN HALL / PASSAGE (6' WIDE)", defaultWidth: 10, defaultLength: 15, minWidth: 6, minLength: 10, defaultArea: 150, minArea: 60, category: "Living" },
  { key: "kitchen", label: "KITCHEN (GROUND FLOOR)", defaultWidth: 6.5, defaultLength: 10, minWidth: 6, minLength: 8, defaultArea: 65, minArea: 48, category: "Kitchen" },
  { key: "kitchen_cum_dining", label: "KITCHEN CUM DINING", defaultWidth: 10, defaultLength: 13, minWidth: 8, minLength: 10, defaultArea: 130, minArea: 80, category: "Kitchen" },
  { key: "store_room", label: "STORE ROOM", defaultWidth: 5, defaultLength: 8, minWidth: 4, minLength: 6, defaultArea: 40, minArea: 24, category: "Utility" },
  { key: "master_bedroom", label: "MASTER BEDROOM (WITH ATTACHED TOILET)", defaultWidth: 20, defaultLength: 15, minWidth: 11, minLength: 12, defaultArea: 300, minArea: 130, category: "Bedroom" },
  { key: "bedroom", label: "BEDROOM", defaultWidth: 10, defaultLength: 14, minWidth: 9, minLength: 10, defaultArea: 140, minArea: 90, category: "Bedroom" },
  { key: "dressing", label: "DRESSING ROOM", defaultWidth: 5, defaultLength: 8, minWidth: 4, minLength: 5, defaultArea: 40, minArea: 20, category: "Bedroom" },
  { key: "common_bathroom", label: "COMMON BATHROOM", defaultWidth: 5, defaultLength: 9, minWidth: 4, minLength: 6, defaultArea: 45, minArea: 24, category: "Bathroom" },
  { key: "attached_bathroom", label: "ATTACHED BATHROOM", defaultWidth: 5, defaultLength: 10, minWidth: 4.5, minLength: 6.5, defaultArea: 50, minArea: 28, category: "Bathroom" },
  { key: "wc", label: "WC (TOILET)", defaultWidth: 4, defaultLength: 6, minWidth: 3.5, minLength: 4.5, defaultArea: 24, minArea: 15, category: "Bathroom" },
  { key: "pooja_room", label: "POOJA ROOM", defaultWidth: 5, defaultLength: 6, minWidth: 4, minLength: 4, defaultArea: 30, minArea: 16, category: "Common" },
  { key: "study_room", label: "STUDY / KIDS ROOM", defaultWidth: 7, defaultLength: 10, minWidth: 6, minLength: 8, defaultArea: 70, minArea: 48, category: "Common" },
  { key: "utility", label: "UTILITY / WASH AREA", defaultWidth: 5, defaultLength: 7, minWidth: 4, minLength: 5, defaultArea: 35, minArea: 20, category: "Utility" },
  { key: "balcony", label: "BALCONY", defaultWidth: 4.5, defaultLength: 10, minWidth: 3.5, minLength: 6, defaultArea: 45, minArea: 21, category: "Exterior" },
  { key: "duct", label: "HUGE VENTILATION DUCT", defaultWidth: 4, defaultLength: 6, minWidth: 3, minLength: 3, defaultArea: 24, minArea: 9, mandatory: true, category: "Core" },
  { key: "lift", label: "LIFT / ELEVATOR", defaultWidth: 5, defaultLength: 7, minWidth: 4.5, minLength: 5, defaultArea: 35, minArea: 22.5, category: "Core" },
  { key: "terrace_garden", label: "TERRACE GARDEN", defaultWidth: 10, defaultLength: 15, minWidth: 8, minLength: 10, defaultArea: 150, minArea: 80, category: "Exterior" },
];

const MUTUALLY_EXCLUSIVE: Array<{ primary: string; blocked: string; note: string }> = [
  {
    primary: "living_room_with_stair",
    blocked: "staircase",
    note: "STAIRCASE is already embedded inside LIVING ROOM + STAIR (U-SHAPE).",
  },
  {
    primary: "living_room_with_stair",
    blocked: "living_room",
    note: "LIVING ROOM is already part of LIVING ROOM + STAIR (U-SHAPE).",
  },
  {
    primary: "living_room_with_stair",
    blocked: "parking_with_stair",
    note: "Only one staircase configuration is allowed per floor.",
  },
  {
    primary: "parking_with_stair",
    blocked: "staircase",
    note: "STAIRCASE is already embedded inside PARKING WITH STAIRCASE.",
  },
  {
    primary: "parking_with_stair",
    blocked: "living_room_with_stair",
    note: "Only one staircase configuration is allowed per floor.",
  },
];

function isBlockedByExclusive(
  roomKey: string,
  floorRoomMap: Record<string, FloorRoom>
): { blocked: boolean; byKey?: string; note?: string } {
  for (const rule of MUTUALLY_EXCLUSIVE) {
    if (rule.blocked === roomKey && floorRoomMap[rule.primary]?.selected) {
      return { blocked: true, byKey: rule.primary, note: rule.note };
    }
  }
  return { blocked: false };
}

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
          const currentRoomInfo = floorRoomState[room.key] || {};
          const isCurrentlySelected = !!currentRoomInfo.selected;

          // Sirf tab toggle ya update karein jab state mein actual change ki zaroorat ho
          if (shouldSelect !== isCurrentlySelected) {
            toggleRoom(floor, room.key);
          }

          if (shouldSelect) {
            let targetWidth = Number(currentRoomInfo.width || room.defaultWidth);
            let targetLength = Number(currentRoomInfo.length || room.defaultLength);

            if (currentW <= 22 && (room.key === "master_bedroom" || room.key === "living_room" || room.key === "living_room_with_stair")) {
              targetWidth = currentW;
            } else if (room.key === "living_room_with_stair" || room.key === "master_bedroom") {
              targetWidth = currentW;
            } else if ((room.key === "kitchen" || room.key === "kitchen_cum_dining") && currentW <= 22) {
              const passage = currentW <= 10 ? 3.5 : 4.0;
              targetWidth = Math.max(room.minWidth, currentW - passage);
            }

            const expectedArea = Number((targetWidth * targetLength).toFixed(2));

            if (room.key === "master_bedroom" && !floor.toUpperCase().includes("GROUND")) {
              if (currentRoomInfo.count !== 2 || currentRoomInfo.width !== targetWidth) {
                updateRoom(floor, room.key, {
                  count: 2,
                  width: targetWidth,
                  length: targetLength,
                  areaPerRoom: expectedArea
                });
              }
            } else if (currentRoomInfo.width !== targetWidth || currentRoomInfo.areaPerRoom !== expectedArea) {
              updateRoom(floor, room.key, {
                width: targetWidth,
                areaPerRoom: expectedArea
              });
            }
          }
        });
      });
    }
  }, [planningMode, JSON.stringify(selectedFloors), plotLength, plotWidth, JSON.stringify(floorData)]);

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
          FLOOR-WISE BUILT-UP AREA & ROOM PLANNING (SYNCED AUTO/MANUAL)
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
                <th className="p-2.5 font-black text-center">AUTO ROOM PLAN (FULL WIDTH MATCHED)</th>
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
                  const countPrefix = (roomInfo.count && roomInfo.count > 1) ? `${roomInfo.count}x ` : '';
                  selectedRoomLabels.push(`${countPrefix}${cat.label}`);
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
                      {isGround ? "GROUND FLOOR (PARKING + LIVING + KITCHEN)" : isTower ? "TOWER PLANNING" : `${floor} PLANNING`}
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
                              SEQUENTIAL ROOM PLANNING FOR {floor} (SYNCED CATALOG)
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

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                            <div className="border-2 border-black p-3 bg-white">
                              <div className="bg-slate-900 text-white p-2 text-xs font-black mb-2 flex justify-between items-center">
                                <span>PART 1: SELECT ITEMS, WIDTH & LENGTH</span>
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
                                      <th className="border border-black p-1.5 font-black text-center w-16">W (FT)</th>
                                      <th className="border border-black p-1.5 font-black text-center w-16">L (FT)</th>
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

                                      const exclusivity = isBlockedByExclusive(room.key, floorRoomMap);
                                      const isBlocked = exclusivity.blocked && !current.selected;

                                      return (
                                        <tr
                                          key={room.key}
                                          className={
                                            current.selected
                                              ? "bg-amber-50"
                                              : isBlocked
                                                ? "bg-gray-100 opacity-60"
                                                : ""
                                          }
                                          title={isBlocked ? exclusivity.note : undefined}
                                        >
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="checkbox"
                                              checked={current.selected}
                                              disabled={isBlocked}
                                              onChange={() => {
                                                if (isBlocked) {
                                                  alert(exclusivity.note);
                                                  return;
                                                }
                                                const nextAllocated = allocatedRoomArea + (current.selected ? -itemTotalArea : itemTotalArea);
                                                if (!current.selected && nextAllocated > totalFloorBuiltUp) {
                                                  alert("Cannot select: Exceeds floor built-up area!");
                                                  return;
                                                }
                                                toggleRoom(floor, room.key);
                                              }}
                                              className={`w-4 h-4 ${isBlocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                                            />
                                          </td>
                                          <td className="border border-black p-1.5 font-bold text-left pl-2">
                                            {room.label}
                                            {isBlocked && (
                                              <span className="block text-[9px] font-normal text-gray-500 normal-case">
                                                Disabled — {exclusivity.byKey} is already selected
                                              </span>
                                            )}
                                          </td>
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="number"
                                              min={1}
                                              value={current.count || 1}
                                              disabled={!current.selected || isBlocked}
                                              onChange={(e) => updateRoom(floor, room.key, { count: Math.max(1, Number(e.target.value) || 1) })}
                                              className="w-10 border border-black p-1 text-center font-bold text-xs bg-white"
                                            />
                                          </td>
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="number"
                                              step="0.5"
                                              min={room.minWidth}
                                              disabled={!current.selected || isBlocked}
                                              value={rW}
                                              onChange={(e) => {
                                                const val = Math.max(room.minWidth, Number(e.target.value) || room.minWidth);
                                                updateRoom(floor, room.key, { width: val, areaPerRoom: Number((val * rL).toFixed(2)) });
                                              }}
                                              className="w-14 border border-black p-1 text-center font-bold text-xs bg-white"
                                            />
                                          </td>
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="number"
                                              step="0.5"
                                              min={room.minLength}
                                              disabled={!current.selected || isBlocked}
                                              value={rL}
                                              onChange={(e) => {
                                                const val = Math.max(room.minLength, Number(e.target.value) || room.minLength);
                                                updateRoom(floor, room.key, { length: val, areaPerRoom: Number((rW * val).toFixed(2)) });
                                              }}
                                              className="w-14 border border-black p-1 text-center font-bold text-xs bg-white"
                                            />
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

                            <div className="border-2 border-black p-3 bg-white">
                              <div className="bg-slate-900 text-white p-2 text-xs font-black mb-2 text-left pl-2">
                                PART 2: SELECTED ITEMS LIST & SUMMARY
                              </div>
                              <div className="max-h-[420px] overflow-auto">
                                <table className="w-full border-collapse text-xs">
                                  <thead className="bg-slate-200 sticky top-0">
                                    <tr>
                                      <th className="border border-black p-1.5 font-black text-left pl-2">SELECTED ITEM</th>
                                      <th className="border border-black p-1.5 font-black text-center">NOS</th>
                                      <th className="border border-black p-1.5 font-black text-center">DIMENSION</th>
                                      <th className="border border-black p-1.5 font-black text-right pr-2">TOTAL</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ROOM_CATALOG.filter(room => floorRoomMap[room.key]?.selected).length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="border border-black p-8 text-center text-gray-500 font-bold">
                                          No items selected yet.
                                        </td>
                                      </tr>
                                    ) : (
                                      ROOM_CATALOG.filter(room => floorRoomMap[room.key]?.selected).map((room) => {
                                        const current = floorRoomMap[room.key];
                                        const rW = Number(current.width || room.defaultWidth);
                                        const rL = Number(current.length || room.defaultLength);
                                        const total = Number(current.count || 1) * Number((rW * rL).toFixed(2));

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
    </div>
  );
}