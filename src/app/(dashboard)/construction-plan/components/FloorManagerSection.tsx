'use client';

import React, { useState, useEffect, useRef } from "react";
import { FloorData as BaseFloorData, FloorRoom as BaseFloorRoom } from "../engine/planningTypes";

import {
  getParkingWidth,
  getCommonToiletOrientation,
  getAttachedToiletOrientation,
  getWallThicknessFt,
  n,
  clamp,
  canonical,
} from "../engine/layoutFormulas";

export interface FloorData extends BaseFloorData {
  clearWidth?: number;
  clearLength?: number;
  setbacks?: { front?: number; rear?: number; left?: number; right?: number };
  x?: number;
  y?: number;
}

export interface FloorRoom extends BaseFloorRoom {
  width?: number;
  length?: number;
  areaMode?: "AUTO" | "MANUAL";
  areaPerRoom?: number;
  inheritedFrom?: string;
  inheritedPosition?: { x: number; y: number };
  positionLocked?: boolean;
  position?: string;
  inheritedX?: number;
  inheritedY?: number;
  stairW?: number;
  stairH?: number;
  userAdjusted?: boolean;
}

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

const WALL_THICKNESS_SMALL_FT = 4 / 12;
const WALL_THICKNESS_LARGE_FT = 4 / 12;
const WALL_THICKNESS_BREAKPOINT_FT = 15;

export { getParkingWidth };

export function getCommonToiletSize(W: number): { w: number; h: number; orientation: 'H' | 'V' } {
  return getCommonToiletOrientation(W);
}

export function getAttachedToiletSize(masterW: number, masterH: number): { w: number; h: number; orientation: 'H' | 'V' } {
  const placement = getAttachedToiletOrientation(masterW, masterH);
  return { w: placement.w, h: placement.h, orientation: placement.orientation };
}

export function adjustRoomLengthsProportionally(
  floorLength: number,
  desiredLengths: { key: string; length: number; minLength: number }[],
): Record<string, number> {
  const totalDesired = desiredLengths.reduce((sum, r) => sum + r.length, 0);
  const totalMin = desiredLengths.reduce((sum, r) => sum + r.minLength, 0);

  if (totalDesired <= floorLength) {
    const out: Record<string, number> = {};
    desiredLengths.forEach(r => { out[r.key] = r.length; });
    return out;
  }

  if (totalMin >= floorLength) {
    const out: Record<string, number> = {};
    desiredLengths.forEach(r => { out[r.key] = r.minLength; });
    return out;
  }

  const scale = floorLength / totalDesired;
  const out: Record<string, number> = {};
  desiredLengths.forEach(r => {
    const adjusted = Math.max(r.minLength, r.length * scale);
    out[r.key] = Number(adjusted.toFixed(2));
  });

  let total = Object.values(out).reduce((a, b) => a + b, 0);
  let attempts = 0;
  while (total > floorLength && attempts < 50) {
    const sorted = Object.entries(out).sort((a, b) => b[1] - a[1]);
    const [largestKey, largestVal] = sorted[0];
    const minVal = desiredLengths.find(d => d.key === largestKey)?.minLength ?? 0;
    if (largestVal > minVal + 0.1) {
      out[largestKey] = Number((largestVal - 0.1).toFixed(2));
      total = Object.values(out).reduce((a, b) => a + b, 0);
    } else {
      break;
    }
    attempts++;
  }

  return out;
}

export function resolveDynamicDimensions(
  roomKey: string,
  presetW: number,
  presetL: number,
  actualW: number,
  actualL: number,
  presetFloorW: number,
  presetFloorL: number,
  minW: number,
  minL: number,
): { width: number; length: number } {
  const scaleW = actualW / Math.max(1, presetFloorW);
  const scaleL = actualL / Math.max(1, presetFloorL);

  let newW = presetW * scaleW;
  let newL = presetL * scaleL;

  newW = Math.max(Math.min(minW, actualW), newW);
  newL = Math.max(Math.min(minL, actualL), newL);

  newW = Math.min(newW, actualW);
  newL = Math.min(newL, actualL);

  return {
    width: Number(newW.toFixed(2)),
    length: Number(newL.toFixed(2)),
  };
}

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

export const STANDARD_LOAN_PRESETS: Record<string, { label: string; width: number; length: number }> = {
  "10x30": { label: "10' x 30' (300 SQ.FT)", width: 10, length: 30 },
  "12x30": { label: "12' x 30' (360 SQ.FT)", width: 12, length: 30 },
  "15x30": { label: "15' x 30' (450 SQ.FT)", width: 15, length: 30 },
  "17x30": { label: "17' x 30' (510 SQ.FT)", width: 17, length: 30 },
  "20x30": { label: "20' x 30' (600 SQ.FT)", width: 20, length: 30 },
  "10x35": { label: "10' x 35' (350 SQ.FT)", width: 10, length: 35 },
  "12x35": { label: "12' x 35' (420 SQ.FT)", width: 12, length: 35 },
  "15x35": { label: "15' x 35' (525 SQ.FT)", width: 15, length: 35 },
  "17x35": { label: "17' x 35' (595 SQ.FT)", width: 17, length: 35 },
  "20x35": { label: "20' x 35' (700 SQ.FT)", width: 20, length: 35 },
  "10x40": { label: "10' x 40' (400 SQ.FT)", width: 10, length: 40 },
  "12x40": { label: "12' x 40' (480 SQ.FT)", width: 12, length: 40 },
  "15x40": { label: "15' x 40' (600 SQ.FT)", width: 15, length: 40 },
  "20x40": { label: "20' x 40' (800 SQ.FT)", width: 20, length: 40 },
  "10x50": { label: "10' x 50' (500 SQ.FT)", width: 10, length: 50 },
  "12x50": { label: "12' x 50' (600 SQ.FT)", width: 12, length: 50 },
  "15x50": { label: "15' x 50' (750 SQ.FT)", width: 15, length: 50 },
  "20x50": { label: "20' x 50' (1,000 SQ.FT)", width: 20, length: 50 },
  "22x50": { label: "22' x 50' (1,100 SQ.FT)", width: 22, length: 50 },
  "25x50": { label: "25' x 50' (1,250 SQ.FT)", width: 25, length: 50 },
  "30x50": { label: "30' x 50' (1,500 SQ.FT)", width: 30, length: 50 },
  "35x50": { label: "35' x 50' (1,750 SQ.FT)", width: 35, length: 50 },
  "35x40": { label: "35' x 40' (1,400 SQ.FT)", width: 35, length: 40 },
  "40x40": { label: "40' x 40' (1,600 SQ.FT)", width: 40, length: 40 },
  "30x30": { label: "30' x 30' (900 SQ.FT)", width: 30, length: 30 },
  "35x35": { label: "35' x 35' (1,225 SQ.FT)", width: 35, length: 35 },
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

export function getAutoRoomsForFloor(
  floorName: string,
  width: number,
  length: number,
  groundFloorProgram?: string[],
): string[] {
  const upper = floorName.toUpperCase();
  const isGround = upper.includes("GROUND");
  const isTower = upper.includes("TOWER") || upper.includes("MUMTY");

  if (isTower) {
    return ["staircase", "terrace_garden", "utility"];
  }

  const W = Number(width) || 20;
  const L = Number(length) || 50;

  if (isGround) {
    const rooms: string[] = [];
    rooms.push("parking");
    rooms.push("kitchen");
    rooms.push("living_room_with_stair");
    rooms.push("common_bathroom");

    if (W <= 14) {
      rooms.push("master_bedroom");
      rooms.push("attached_bathroom");
    } else {
      rooms.push("master_bedroom", "attached_bathroom");
    }

    return rooms;
  }

     const rooms: string[] = [];

  // ✅ Upper floor: rooms by W (carpet width)
  if (W >= 12) {
    // VERY WIDE (W ≥ 12 ft): 2 MASTER BED + 2 ATTACHED BATH + STAIR
    rooms.push("master_bedroom");
    rooms.push("attached_bathroom");
    rooms.push("staircase");
    rooms.push("master_bedroom");
    rooms.push("attached_bathroom");
  } else if (W >= 8) {
    // WIDE (8 ≤ W < 12 ft): 1 MASTER BED + 1 BEDROOM + 2 ATTACHED BATH + STAIR
    rooms.push("master_bedroom");
    rooms.push("attached_bathroom");
    rooms.push("staircase");
    rooms.push("bedroom");
    rooms.push("attached_bathroom");
  } else if (W >= 6) {
    // MEDIUM (6 ≤ W < 8 ft): 1 MASTER BED + 1 ATTACHED BATH + STAIR + HALL
    rooms.push("master_bedroom");
    rooms.push("attached_bathroom");
    rooms.push("staircase");
    rooms.push("hall");
  } else if (W >= 4.5) {
    // NARROW (4.5 ≤ W < 6): 1 BEDROOM + STAIR + HALL
    rooms.push("bedroom");
    rooms.push("staircase");
    rooms.push("hall");
  } else {
    // ULTRA NARROW (W < 4.5): LIVING + STAIR
    rooms.push("living_room");
    rooms.push("staircase");
  }

  return rooms;
}

export const ROOM_CATALOG = [
  { key: "parking", label: "PARKING", defaultWidth: 9, defaultLength: 8, minWidth: 4, minLength: 7, defaultArea: 72, minArea: 28, category: "Ground" },
  { key: "parking_with_stair", label: "PARKING WITH STAIRCASE", defaultWidth: 6, defaultLength: 7, minWidth: 6, minLength: 7, defaultArea: 42, minArea: 42, category: "Ground" },
  { key: "staircase", label: "STAIRCASE", defaultWidth: 6.5, defaultLength: 10, minWidth: 6, minLength: 8, defaultArea: 65, minArea: 48, category: "Core" },
  { key: "living_room_with_stair", label: "LIVING ROOM + STAIR (U-SHAPE)", defaultWidth: 10, defaultLength: 16, minWidth: 10, minLength: 12, defaultArea: 160, minArea: 120, category: "Living" },
  { key: "living_room", label: "LIVING ROOM / FAMILY LOUNGE", defaultWidth: 12, defaultLength: 10, minWidth: 10, minLength: 9, defaultArea: 120, minArea: 90, category: "Living" },
  { key: "hall", label: "MAIN HALL / PASSAGE (6' WIDE)", defaultWidth: 10, defaultLength: 10, minWidth: 6, minLength: 8, defaultArea: 100, minArea: 48, category: "Living" },
  { key: "kitchen", label: "KITCHEN (GROUND FLOOR)", defaultWidth: 6, defaultLength: 8, minWidth: 5, minLength: 5, defaultArea: 48, minArea: 25, category: "Kitchen" },
  { key: "kitchen_cum_dining", label: "KITCHEN CUM DINING", defaultWidth: 10, defaultLength: 8, minWidth: 8, minLength: 7, defaultArea: 80, minArea: 56, category: "Kitchen" },
  { key: "store_room", label: "STORE ROOM", defaultWidth: 5, defaultLength: 6, minWidth: 4, minLength: 4, defaultArea: 30, minArea: 16, category: "Utility" },
  { key: "master_bedroom", label: "MASTER BEDROOM (WITH ATTACHED TOILET)", defaultWidth: 10, defaultLength: 12, minWidth: 7.5, minLength: 9, defaultArea: 100, minArea: 60, category: "Bedroom" },
  { key: "bedroom", label: "BEDROOM", defaultWidth: 10, defaultLength: 10, minWidth: 7, minLength: 8.5, defaultArea: 100, minArea: 60, category: "Bedroom" },
  { key: "dressing", label: "DRESSING ROOM", defaultWidth: 5, defaultLength: 6, minWidth: 4, minLength: 4, defaultArea: 30, minArea: 16, category: "Bedroom" },
  { key: "common_bathroom", label: "COMMON BATHROOM", defaultWidth: 4.5, defaultLength: 6.5, minWidth: 4, minLength: 4, defaultArea: 29.25, minArea: 16, category: "Bathroom" },
  { key: "attached_bathroom", label: "ATTACHED BATHROOM", defaultWidth: 5, defaultLength: 7, minWidth: 4.5, minLength: 4.5, defaultArea: 35, minArea: 20, category: "Bathroom" },
  { key: "wc", label: "WC (TOILET)", defaultWidth: 4, defaultLength: 5, minWidth: 3.5, minLength: 4, defaultArea: 20, minArea: 14, category: "Bathroom" },
  { key: "pooja_room", label: "POOJA ROOM", defaultWidth: 4, defaultLength: 5, minWidth: 4, minLength: 4, defaultArea: 20, minArea: 16, category: "Common" },
  { key: "study_room", label: "STUDY / KIDS ROOM", defaultWidth: 7, defaultLength: 8, minWidth: 6, minLength: 7, defaultArea: 56, minArea: 42, category: "Common" },
  { key: "utility", label: "UTILITY / WASH AREA", defaultWidth: 5, defaultLength: 5, minWidth: 4, minLength: 4, defaultArea: 25, minArea: 16, category: "Utility" },
  { key: "balcony", label: "BALCONY", defaultWidth: 4.5, defaultLength: 6, minWidth: 3.5, minLength: 4, defaultArea: 27, minArea: 14, category: "Exterior" },
  { key: "duct", label: "HUGE VENTILATION DUCT", defaultWidth: 3, defaultLength: 4, minWidth: 3, minLength: 3, defaultArea: 12, minArea: 9, mandatory: true, category: "Core" },
  { key: "lift", label: "LIFT / ELEVATOR", defaultWidth: 5, defaultLength: 5, minWidth: 4.5, minLength: 5, defaultArea: 25, minArea: 22.5, category: "Core" },
  { key: "terrace_garden", label: "TERRACE GARDEN", defaultWidth: 10, defaultLength: 10, minWidth: 8, minLength: 8, defaultArea: 100, minArea: 64, category: "Exterior" },
  { key: "front_bedroom", label: "FRONT BEDROOM", defaultWidth: 10, defaultLength: 11, minWidth: 4, minLength: 6, defaultArea: 110, minArea: 24, category: "Upper" },
  { key: "rear_bedroom", label: "REAR BEDROOM", defaultWidth: 10, defaultLength: 13, minWidth: 4, minLength: 6, defaultArea: 130, minArea: 24, category: "Upper" },
  { key: "front_attached_bath", label: "FRONT ATTACHED BATH", defaultWidth: 4, defaultLength: 7, minWidth: 3, minLength: 3.5, defaultArea: 28, minArea: 10.5, category: "Upper" },
  { key: "rear_attached_bath", label: "REAR ATTACHED BATH", defaultWidth: 4, defaultLength: 6, minWidth: 3, minLength: 3.5, defaultArea: 24, minArea: 10.5, category: "Upper" },
];

const MUTUALLY_EXCLUSIVE: Array<{ primary: string; blocked: string; note: string }> = [
  { primary: "living_room_with_stair", blocked: "staircase", note: "STAIRCASE is already embedded inside LIVING ROOM + STAIR (U-SHAPE)." },
  { primary: "living_room_with_stair", blocked: "living_room", note: "LIVING ROOM is already part of LIVING ROOM + STAIR (U-SHAPE)." },
  { primary: "living_room_with_stair", blocked: "parking_with_stair", note: "Only one staircase configuration is allowed per floor." },
  { primary: "parking_with_stair", blocked: "staircase", note: "STAIRCASE is already embedded inside PARKING WITH STAIRCASE." },
  { primary: "parking_with_stair", blocked: "living_room_with_stair", note: "Only one staircase configuration is allowed per floor." },
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
  onPlanningContextReady?: (ctx: {
    groundFloorProgram: string[];
    groundStairPosition: { x: number; y: number } | null;
    groundStairRelativeOffset: { dx: number; dy: number } | null;
  }) => void;
  groundStairPositionExternal?: { x: number; y: number; w?: number; h?: number } | null;
  groundStairRelativeOffsetExternal?: { dx: number; dy: number } | null;
  parkingSide?: string;
  roadFacingOption?: string;
}

interface SetbackType {
  front: number;
  rear: number;
  left: number;
  right: number;
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
  onPlanningContextReady,
  groundStairPositionExternal,
  groundStairRelativeOffsetExternal,
  parkingSide = "SOUTH",
  roadFacingOption = "",
}: FloorManagerSectionProps) {
  void parkingSide;
  void roadFacingOption;

  const [mosEditorFloor, setMosEditorFloor] = useState<string | null>(null);
  const [localSetbacks, setLocalSetbacks] = useState<Record<string, SetbackType>>({});

  const [internalPlanningMode, setInternalPlanningMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const planningMode = propPlanningMode ?? internalPlanningMode;
  const setPlanningMode = propSetPlanningMode ?? setInternalPlanningMode;

  const [activeGearFloor, setActiveGearFloor] = useState<string | null>(null);

  const inheritanceApplied = useRef<Record<string, boolean>>({});

  // ✅ NEW: Track which floors AUTO MODE has already fully processed
  // This prevents the race condition where the effect runs multiple times
  // and stale floorRooms state causes rooms to be skipped.
  const autoProcessedSignature = useRef<Record<string, string>>({});

  const [internalStairPosition, setInternalStairPosition] = useState<{ x: number; y: number } | null>(null);
  const [internalRelativeOffset, setInternalRelativeOffset] = useState<{ dx: number; dy: number } | null>(null);

  const groundStairPosition = groundStairPositionExternal ?? internalStairPosition;
  const groundStairRelativeOffset = groundStairRelativeOffsetExternal ?? internalRelativeOffset;

  useEffect(() => {
    if (groundStairPositionExternal) {
      setInternalStairPosition({
        x: groundStairPositionExternal.x,
        y: groundStairPositionExternal.y,
      });
    }
  }, [groundStairPositionExternal]);

  useEffect(() => {
    if (groundStairRelativeOffsetExternal) {
      setInternalRelativeOffset({
        dx: groundStairRelativeOffsetExternal.dx,
        dy: groundStairRelativeOffsetExternal.dy,
      });
    }
  }, [groundStairRelativeOffsetExternal]);

  const getWallThicknessForWidth = (_plotWidthFt: number): number => {
  // ✅ FIXED: Always 4" (was 8" for width > 15 ft)
  return 4 / 12;
};

  const getAvailableSize = (floor: string): { W: number; L: number } => {
    const data = (floorData[floor] || {}) as Partial<FloorData> & {
      clearWidth?: number;
      clearLength?: number;
      setbacks?: { front?: number; rear?: number; left?: number; right?: number };
    };
    const isTower = floor.toUpperCase().includes("TOWER") || floor.toUpperCase().includes("MUMTY");

    const plotW = Number(data.width) || (isTower ? 10 : Number(plotWidth) || 20);
    const plotL = Number(data.length) || (isTower ? 10 : Number(plotLength) || 50);

    const floorSetbacks = data.setbacks || {};
    const sLeft = Number(floorSetbacks.left) || Number(leftSetback) || 0;
    const sRight = Number(floorSetbacks.right) || Number(rightSetback) || 0;
    const sFront = Number(floorSetbacks.front) || Number(frontSetback) || 0;
    const sRear = Number(floorSetbacks.rear) || Number(rearSetback) || 0;

    const afterSetbackW = plotW - (sLeft + sRight);
    const afterSetbackL = plotL - (sFront + sRear);

    const wallThicknessFt = getWallThicknessForWidth(plotW);
    const wallDeductionW = wallThicknessFt * 2;
    const wallDeductionL = wallThicknessFt * 2;

    let availableW: number;
    let availableL: number;

    if (isTower) {
      availableW = plotW;
      availableL = plotL;
    } else {
      availableW = Math.max(3.5, afterSetbackW - wallDeductionW);
      availableL = Math.max(6, afterSetbackL - wallDeductionL);
    }

    return { W: availableW, L: availableL };
  };

  const groundFloorProgramKey = React.useMemo(() => {
    const groundFloor = selectedFloors.find(f => f.toUpperCase().includes("GROUND"));
    if (!groundFloor) return '';
    const { W, L } = getAvailableSize(groundFloor);
    return getAutoRoomsForFloor(groundFloor, W, L).join('|');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedFloors.join('|'),
    floorData,
    plotLength,
    plotWidth,
    leftSetback, rightSetback, frontSetback, rearSetback,
  ]);

  const groundFloorProgram = React.useMemo(() => {
    if (!groundFloorProgramKey) return [];
    return groundFloorProgramKey.split('|');
  }, [groundFloorProgramKey]);

  useEffect(() => {
    if (onPlanningContextReady) {
      onPlanningContextReady({
        groundFloorProgram,
        groundStairPosition,
        groundStairRelativeOffset,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    groundFloorProgramKey,
    (groundStairPosition as any)?.x,
    (groundStairPosition as any)?.y,
    (groundStairPosition as any)?.w,
    (groundStairPosition as any)?.h,
    (groundStairRelativeOffset as any)?.dx,
    (groundStairRelativeOffset as any)?.dy,
    onPlanningContextReady,
  ]);

  // ============================================================================
  // ✅ SMART AUTO-MODE EFFECT — FINAL (with signature guard)
  // ============================================================================
  useEffect(() => {
    if (planningMode !== "AUTO") return;

    // ✅ FIX: Compute a signature for each floor that captures:
    //  - Selected floor name
    //  - Current W/L of the floor
    //  - Whether the floor already has rooms in state
    // If the signature matches the last processed, skip that floor.
    // This prevents re-runs from resetting rooms.
    const currentSignatures: Record<string, string> = {};

    selectedFloors.forEach((floor) => {
      const { W, L } = getAvailableSize(floor);
      const roomsInState = floorRooms[floor] || {};
      const selectedCount = Object.values(roomsInState).filter((r: any) => r?.selected).length;

      const sig = `${floor}|${W.toFixed(2)}|${L.toFixed(2)}|${selectedCount}`;
      currentSignatures[floor] = sig;

      // Skip if signature unchanged AND floor already has rooms
      const lastSig = autoProcessedSignature.current[floor];
      if (lastSig === sig && selectedCount > 0) {
        return;
      }

      // ---------- Process this floor ----------
      ensureFloorRooms(floor);

      const data = (floorData[floor] || {}) as Partial<FloorData>;
      const isTower = floor.toUpperCase().includes("TOWER") || floor.toUpperCase().includes("MUMTY");
      const isGround = floor.toUpperCase().includes("GROUND");

      const { W: currentW, L: currentL } = getAvailableSize(floor);

      if (isTower) {
        const towerRooms = getAutoRoomsForFloor(floor, currentW, currentL);
        const towerCounts: Record<string, number> = {};
        towerRooms.forEach(k => { towerCounts[k] = (towerCounts[k] || 0) + 1; });

        ROOM_CATALOG.forEach((room) => {
          const shouldSelect = towerCounts[room.key] > 0;
          const currentRoomInfo = roomsInState[room.key] || {};
          const isCurrentlySelected = !!currentRoomInfo.selected;

          if (shouldSelect && !isCurrentlySelected) {
            updateRoom(floor, room.key, { selected: true, count: 1 });
          } else if (!shouldSelect && isCurrentlySelected) {
            updateRoom(floor, room.key, { selected: false });
          }
        });

        autoProcessedSignature.current[floor] = sig;
        return;
      }

      const preset = getNearestPreset(currentW, currentL);
      const presetFloorW = preset.width;
      const presetFloorL = preset.length;

      const targetRooms = getAutoRoomsForFloor(floor, currentW, currentL, groundFloorProgram);

      const targetCounts: Record<string, number> = {};
      targetRooms.forEach((key) => {
        targetCounts[key] = (targetCounts[key] || 0) + 1;
      });

      const desiredDims: Record<string, { w: number; h: number; minW: number; minH: number; count: number }> = {};

      const groundStairW = (groundStairPosition as any)?.w;
      const groundStairH = (groundStairPosition as any)?.h;

      const fixedFrontH = 8;
      const fixedServiceH = currentL >= 45 ? 6 : 4.5;
      const minRearH = 9.5;

      let fixedMiddleH = currentL - fixedFrontH - fixedServiceH - minRearH;
      if (fixedMiddleH > 16) fixedMiddleH = 16;
      if (fixedMiddleH < 12) fixedMiddleH = 12;

      const rearH = Math.max(minRearH, currentL - fixedFrontH - fixedMiddleH - fixedServiceH);

      let upperStairH = 8;
      let upperStairW = currentW;
      let upperFrontBedH = 11;
      let upperRearBedH = currentL - upperStairH - upperFrontBedH - fixedServiceH;

      if (!isGround && groundStairH && groundStairH > 0) {
        upperStairH = groundStairH;
        upperStairW = Math.min(groundStairW || currentW, currentW);
        const bachaHua = currentL - upperStairH - fixedServiceH;
        upperFrontBedH = Math.max(7, bachaHua * 0.4);
        upperRearBedH = Math.max(7, bachaHua * 0.6);
      }

      const masterCount = targetCounts["master_bedroom"] || 0;
      const attachedBathCount = targetCounts["attached_bathroom"] || 0;
      const isSingleMasterUpper = !isGround && masterCount === 1;

      ROOM_CATALOG.forEach((room) => {
        const shouldSelect = targetCounts[room.key] > 0;
        if (!shouldSelect) return;

        let targetWidth = room.defaultWidth;
        let targetLength = room.defaultLength;
        let targetCount = targetCounts[room.key] || 1;

        if (room.key === "parking") {
          targetWidth = getParkingWidth(currentW);
          targetLength = 8;
        } else if (room.key === "kitchen" || room.key === "kitchen_cum_dining") {
          const parkingW = getParkingWidth(currentW);
          targetWidth = Math.max(4, currentW - parkingW);
          targetLength = 8;
        } else if (room.key === "living_room_with_stair" || room.key === "living_room") {
          targetWidth = currentW;
          targetLength = fixedMiddleH;
        } else if (room.key === "hall") {
          targetWidth = currentW;
          const usedByOthers = (upperFrontBedH || 0) + (upperStairH || 0) + fixedServiceH;
          const remaining = Math.max(8, currentL - usedByOthers);
          targetLength = remaining;
          targetCount = 1;
        } else if (room.key === "common_bathroom") {
          const ctSize = getCommonToiletOrientation(currentW);
          targetWidth = ctSize.w;
          targetLength = Math.min(ctSize.h, fixedServiceH);
          targetCount = 1;
        } else if (room.key === "master_bedroom") {
          targetWidth = currentW;
          if (isSingleMasterUpper) {
            targetLength = Math.max(12, currentL - upperStairH - fixedServiceH);
          } else if (masterCount > 1) {
            targetLength = Math.max(9, upperFrontBedH);
          } else {
            targetLength = Math.max(10, rearH);
          }
          targetCount = masterCount;
        } else if (room.key === "bedroom") {
          targetWidth = currentW;
          targetLength = Math.max(9.5, rearH);
          targetCount = 1;
        } else if (room.key === "attached_bathroom") {
          targetCount = Math.max(1, attachedBathCount);
          const attachedArea = Math.max(30, currentW * 4);
          targetWidth = Math.min(5, currentW * 0.4);
          targetLength = Math.max(5, attachedArea / targetWidth);
        } else if (room.key === "front_bedroom") {
          targetWidth = currentW;
          targetLength = Math.max(7, upperFrontBedH);
          targetCount = 1;
        } else if (room.key === "rear_bedroom") {
          targetWidth = currentW;
          targetLength = Math.max(7, upperRearBedH);
          targetCount = 1;
        } else if (room.key === "front_attached_bath") {
          const frontBedArea = currentW * upperFrontBedH;
          if (frontBedArea < 60) {
            targetCount = 0;
          } else {
            targetCount = 1;
            const attachedArea = Math.max(25, currentW * 4);
            targetWidth = Math.min(5, currentW * 0.4);
            targetLength = Math.max(4.5, attachedArea / targetWidth);
          }
        } else if (room.key === "rear_attached_bath") {
          const rearBedArea = currentW * upperRearBedH;
          if (rearBedArea < 60) {
            targetCount = 0;
          } else {
            targetCount = 1;
            const attachedArea = Math.max(25, currentW * 4);
            targetWidth = Math.min(5, currentW * 0.4);
            targetLength = Math.max(4.5, attachedArea / targetWidth);
          }
        } else if (room.key === "staircase") {
          if (!isGround && upperStairW && upperStairH) {
            targetWidth = upperStairW;
            targetLength = upperStairH;
          } else {
            targetWidth = groundStairW && groundStairW > 0 ? Math.min(groundStairW, currentW) : 6.5;
            targetLength = groundStairH && groundStairH > 0 ? groundStairH : 8;
          }
          targetCount = 1;
        }

        const EXACT_RULE_ROOMS = new Set([
          "parking", "living_room_with_stair", "living_room", "kitchen",
          "kitchen_cum_dining", "master_bedroom", "bedroom",
          "attached_bathroom", "common_bathroom", "staircase", "hall",
          "front_bedroom", "rear_bedroom", "front_attached_bath", "rear_attached_bath",
        ]);

        if (!EXACT_RULE_ROOMS.has(room.key)) {
          const adapted = resolveDynamicDimensions(
            room.key, targetWidth, targetLength, currentW, currentL,
            presetFloorW, presetFloorL, room.minWidth, room.minLength,
          );
          targetWidth = adapted.width;
          targetLength = adapted.length;
        }

        if (targetWidth > currentW) targetWidth = Number(currentW.toFixed(2));
        if (targetLength > currentL) targetLength = Number(currentL.toFixed(2));

           desiredDims[room.key] = {
          w: targetWidth,
          h: targetLength,
          minW: room.minWidth,
          minH: room.minLength,   // ← ✅ Fix: minLength use karo
          count: targetCount,
        };
      });

      const isGroundFloor = floor.toUpperCase().includes("GROUND");
           const bedroomCount = (targetCounts["bedroom"] || 0) + (targetCounts["master_bedroom"] || 0);
      const stackOrder = isGroundFloor
        ? ["parking", "common_bathroom", "living_room_with_stair", "master_bedroom", "attached_bathroom"]
        : (bedroomCount >= 2
            ? [
                targetCounts["master_bedroom"] ? "master_bedroom" : "bedroom",
                "attached_bathroom",
                "staircase",
                targetCounts["master_bedroom"] ? "master_bedroom" : "bedroom",
                "attached_bathroom",
              ]
            : (targetCounts["master_bedroom"] ? ["master_bedroom", "attached_bathroom", "staircase", "hall"] : ["bedroom", "attached_bathroom", "staircase", "hall"]));

      const stackRooms = stackOrder
        .filter(k => desiredDims[k] && desiredDims[k].count > 0)
        .map(k => ({
          key: k,
          length: desiredDims[k].h,
          minLength: desiredDims[k].minH,
        }));

      const totalStackLength = stackRooms.reduce((sum, r) => sum + r.length, 0);
      let adjustedLengths: Record<string, number> = {};

      if (stackRooms.length > 0) {
        if (totalStackLength > currentL) {
          adjustedLengths = adjustRoomLengthsProportionally(currentL, stackRooms);
        } else {
          stackRooms.forEach(r => { adjustedLengths[r.key] = r.length; });
        }
      }

      Object.entries(adjustedLengths).forEach(([key, len]) => {
        if (desiredDims[key]) {
          desiredDims[key].h = Number(Math.min(len, currentL).toFixed(2));
        }
      });

      Object.entries(desiredDims).forEach(([key, dim]) => {
        dim.w = Number(Math.min(dim.w, currentW).toFixed(2));
      });

      // ✅ STEP A: Force-remove upper-floor pe kuch bhi jo target me nahi hai
      const FORCE_REMOVE_FOR_UPPER: string[] = isGround
        ? []
        : [
            "living_room_with_stair", "living_room", "kitchen", "kitchen_cum_dining",
            "parking", "common_bathroom",
            "front_bedroom", "rear_bedroom", "front_attached_bath", "rear_attached_bath",
          ];

      FORCE_REMOVE_FOR_UPPER.forEach((roomKey) => {
        const currentInfo = roomsInState[roomKey];
        if (currentInfo?.selected) {
          updateRoom(floor, roomKey, { selected: false });
        }
      });

      // ✅ STEP B: Remove rooms not in target
      ROOM_CATALOG.forEach((room) => {
        const shouldSelect = targetCounts[room.key] > 0;
        const currentRoomInfo = roomsInState[room.key] || {};
        const isCurrentlySelected = !!currentRoomInfo.selected;
        const desiredEntry = desiredDims[room.key];
        const desiredCount = desiredEntry?.count ?? 0;

        if ((!shouldSelect || desiredCount === 0) && isCurrentlySelected) {
          updateRoom(floor, room.key, { selected: false });
        }
      });

      // ✅ STEP C: Atomic add/update using `updateRoom` ONLY (no toggleRoom!)
      ROOM_CATALOG.forEach((room) => {
        const shouldSelect = targetCounts[room.key] > 0;
        if (!shouldSelect) return;

        const desiredEntry = desiredDims[room.key];
        if (!desiredEntry || desiredEntry.count === 0) return;

        const currentRoomInfo = roomsInState[room.key] || {};

        if ((currentRoomInfo as any).userAdjusted === true) return;

        const { w, h, count } = desiredEntry;
        const safeW = Number(Math.min(w, currentW).toFixed(2));
        const safeH = Number(Math.min(h, currentL).toFixed(2));
        const expectedArea = Number((safeW * safeH).toFixed(2));

        // ✅ ALWAYS force `selected: true` + full patch in ONE call
        updateRoom(floor, room.key, {
          count,
          width: safeW,
          length: safeH,
          areaPerRoom: expectedArea,
          selected: true,
        });
      });

      // ✅ Mark floor as processed with its current signature
      autoProcessedSignature.current[floor] = sig;
    });

    // Clean up signatures for floors no longer selected
    Object.keys(autoProcessedSignature.current).forEach((f) => {
      if (!selectedFloors.includes(f)) {
        delete autoProcessedSignature.current[f];
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    planningMode,
    selectedFloors.join('|'),
    plotLength,
    plotWidth,
    groundFloorProgramKey,
    (groundStairPosition as any)?.x,
    (groundStairPosition as any)?.y,
    (groundStairPosition as any)?.w,
    (groundStairPosition as any)?.h,
    leftSetback, rightSetback, frontSetback, rearSetback,
  ]);

  // ============================================================================
  // ✅ STAIRCASE INHERITANCE EFFECT — only for MANUAL mode
  // ============================================================================
  useEffect(() => {
    if (planningMode === "AUTO") return;

    const groundFloor = selectedFloors.find(f => f.toUpperCase().includes("GROUND"));
    if (!groundFloor) return;

    const groundRooms = floorRooms[groundFloor] || {};
    const groundStair = groundRooms["staircase"];
    const groundLivingStair = groundRooms["living_room_with_stair"];

    if (!groundStair?.selected && !groundLivingStair?.selected) return;

    const upperFloors = selectedFloors.filter(f =>
      !f.toUpperCase().includes("GROUND") &&
      !f.toUpperCase().includes("TOWER") &&
      !f.toUpperCase().includes("MUMTY")
    );

    upperFloors.forEach((floor) => {
      if (inheritanceApplied.current[floor]) return;

      ensureFloorRooms(floor);
      const floorRoomsMap = floorRooms[floor] || {};

      const groundStairW = (groundStairPosition as any)?.w || groundStair?.width || 6.5;
      const groundStairH = (groundStairPosition as any)?.h || groundStair?.length || 8;
      const groundStairArea = Number((groundStairW * groundStairH).toFixed(2));

      if (groundLivingStair?.selected) {
        const existingLivingStair = floorRoomsMap["living_room_with_stair"];
        if (!existingLivingStair?.selected) {
          updateRoom(floor, "living_room_with_stair", {
            count: groundLivingStair.count || 1,
            width: Number(groundLivingStair.width || 10),
            length: Number(groundLivingStair.length || 16),
            areaPerRoom: Number(groundLivingStair.areaPerRoom || 160),
            inheritedFrom: groundFloor,
            positionLocked: false,
            position: "AUTO",
            inheritedX: groundStairPosition?.x,
            inheritedY: groundStairPosition?.y,
            stairW: groundStairW,
            stairH: groundStairH,
            selected: true,
          } as any);
        }
        inheritanceApplied.current[floor] = true;
        return;
      }

      const existingStair = floorRoomsMap["staircase"];
      if (!existingStair?.selected) {
        updateRoom(floor, "staircase", {
          count: groundStair.count || 1,
          width: Number(groundStairW),
          length: Number(groundStairH),
          areaPerRoom: groundStairArea,
          inheritedFrom: groundFloor,
          positionLocked: false,
          position: "AUTO",
          inheritedX: groundStairPosition?.x,
          inheritedY: groundStairPosition?.y,
          selected: true,
        });
      }
      inheritanceApplied.current[floor] = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    floorRooms,
    selectedFloors.join('|'),
    (groundStairPosition as any)?.x,
    (groundStairPosition as any)?.y,
    (groundStairPosition as any)?.w,
    (groundStairPosition as any)?.h,
  ]);

  const plotFrontWidth = Number(plotWidth) > 0 ? Number(plotWidth) : 20;
  const plotDepth = Number(plotLength) > 0 ? Number(plotLength) : 50;

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
    <div className="border-2 border-black mb-4 bg-white shadow-sm uppercase font-sans text-xs">
      {/* HEADER */}
      <div className="bg-slate-900 text-white p-2 font-black text-[10px] sm:text-sm flex flex-col md:flex-row justify-between items-center px-2 sm:px-4 gap-2">
        <span className="text-center font-extrabold tracking-wide text-[10px] sm:text-sm leading-tight">
          FLOOR-WISE BUILT-UP AREA & ROOM PLANNING
        </span>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded border border-amber-500/50">
            <span className="text-[8px] sm:text-[10px] text-amber-400 font-bold">⚡ AUTO:</span>
            <span className="text-[9px] sm:text-[11px] text-amber-300 font-black">{currentNearest.label}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded border border-slate-700">
            <span className={`text-[8px] sm:text-[10px] font-bold ${planningMode === "AUTO" ? "text-green-400" : "text-gray-400"}`}>
              AUTO
            </span>
            <button
              type="button"
              onClick={() => {
                const nextMode = planningMode === "AUTO" ? "MANUAL" : "AUTO";
                setPlanningMode(nextMode);
                if (nextMode === "AUTO") setRoomEditorFloor(null);
              }}
              className={`w-8 h-4 sm:w-11 sm:h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                planningMode === "MANUAL" ? "bg-amber-500 justify-end" : "bg-blue-600 justify-start"
              }`}
            >
              <div className="bg-white w-3 h-3 sm:w-4 sm:h-4 rounded-full shadow-md"></div>
            </button>
            <span className={`text-[8px] sm:text-[10px] font-bold ${planningMode === "MANUAL" ? "text-amber-400" : "text-gray-400"}`}>
              MANUAL
            </span>
          </div>
        </div>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="block md:hidden">
        {selectedFloors.map((floor) => {
          const isGround = floor === "GROUND FLOOR" || floor.toUpperCase().includes("GROUND");
          const isTower = floor.toUpperCase().includes("TOWER");
          const data = (floorData[floor] || {}) as FloorData;
          const isMosOpen = mosEditorFloor === floor;
          const isRoomOpen = roomEditorFloor === floor;

          const rawW = Number(data.width);
          const rawL = Number(data.length);
          const currentWidth = isGround ? (rawW > 0 ? rawW : plotFrontWidth) : (isTower ? 10 : rawW || plotFrontWidth);
          const currentLength = isGround ? (rawL > 0 ? rawL : plotDepth) : (isTower ? 10 : rawL || plotDepth);

          const floorRoomMap = floorRooms[floor] || {};
          const selectedRoomLabels: string[] = [];
          ROOM_CATALOG.forEach(cat => {
            const roomInfo = floorRoomMap[cat.key];
            if (roomInfo && roomInfo.selected) {
              const countPrefix = (roomInfo.count && roomInfo.count > 1) ? `${roomInfo.count}x ` : '';
              const inheritBadge = (roomInfo as any).inheritedFrom ? ' 🔗' : '';
              selectedRoomLabels.push(`${countPrefix}${cat.label}${inheritBadge}`);
            }
          });

          return (
            <div key={floor} className="border-b-2 border-black p-2 space-y-2">
              <div className="font-black text-[11px] bg-slate-100 p-2 border border-black">
                {isGround ? "GROUND FLOOR" : isTower ? "TOWER" : floor}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black block mb-0.5">WIDTH (FT)</label>
                  <input
                    type="number"
                    value={currentWidth}
                    onChange={(e) => {
                      const w = Number(e.target.value) || 0;
                      if (updateFloorDimensions) updateFloorDimensions(floor, w, currentLength);
                      updateFloorAreaDirect(floor, Number((w * currentLength).toFixed(2)));
                    }}
                    className="w-full border-2 border-black p-1.5 text-center font-black text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black block mb-0.5">LENGTH (FT)</label>
                  <input
                    type="number"
                    value={currentLength}
                    onChange={(e) => {
                      const l = Number(e.target.value) || 0;
                      if (updateFloorDimensions) updateFloorDimensions(floor, currentWidth, l);
                      updateFloorAreaDirect(floor, Number((currentWidth * l).toFixed(2)));
                    }}
                    className="w-full border-2 border-black p-1.5 text-center font-black text-xs bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black block mb-0.5">BUILT-UP AREA (SQ.FT)</label>
                <input
                  type="number"
                  value={data.area || Number((currentWidth * currentLength).toFixed(2))}
                  onChange={(e) => updateFloorAreaDirect(floor, Number(e.target.value) || 0)}
                  className="w-full border-2 border-black p-1.5 text-center font-black text-xs bg-white"
                />
              </div>

              {!isGround && (
                <button
                  type="button"
                  onClick={() => setMosEditorFloor(isMosOpen ? null : floor)}
                  className="w-full bg-amber-600 text-white px-3 py-1.5 text-[10px] font-black uppercase"
                >
                  {isMosOpen ? "CLOSE MOS" : "EDIT MOS"}
                </button>
              )}

              {planningMode === "MANUAL" ? (
                <button
                  type="button"
                  onClick={() => {
                    ensureFloorRooms(floor);
                    setRoomEditorFloor(isRoomOpen ? null : floor);
                  }}
                  className="w-full bg-black text-white px-3 py-1.5 text-[10px] font-black uppercase"
                >
                  {isRoomOpen ? "CLOSE ROOMS" : "EDIT ROOMS"}
                </button>
              ) : (
                <div className="flex flex-wrap gap-1 p-1 bg-slate-50 border border-black max-h-32 overflow-auto">
                  {selectedRoomLabels.length > 0 ? (
                    selectedRoomLabels.map((lbl) => (
                      <span key={lbl} className="bg-green-100 text-green-900 border border-green-400 text-[8px] font-black px-1 py-0.5 rounded">
                        ✓ {lbl}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] text-gray-400 font-bold">AUTO GENERATING...</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DESKTOP LAYOUT */}
      <div className="hidden md:block overflow-x-auto">
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
              const data = (floorData[floor] || {}) as FloorData;
              const isMosOpen = mosEditorFloor === floor;
              const isRoomOpen = roomEditorFloor === floor;

              const sb = data.setbacks || {};
              const defaultSetbacks: SetbackType = {
                front: Number(sb.front ?? (isTower ? 15 : numFrontSetback)),
                rear:  Number(sb.rear  ?? (isTower ? 25 : numRearSetback)),
                left:  Number(sb.left  ?? (isTower ? 7  : numLeftSetback)),
                right: Number(sb.right ?? (isTower ? 3  : numRightSetback)),
              };

              const setbacks = localSetbacks[floor] || defaultSetbacks;

              const rawW = Number(data.width);
              const rawL = Number(data.length);

              let currentWidth = 0;
              let currentLength = 0;

              if (isGround) {
                currentWidth = rawW > 0 ? rawW : plotFrontWidth;
                currentLength = rawL > 0 ? rawL : plotDepth;
              } else if (isTower) {
                currentWidth = rawW > 0 ? rawW : 10;
                currentLength = rawL > 0 ? rawL : 10;
              } else {
                currentWidth = rawW > 0 ? rawW : Math.max(6, plotFrontWidth - (setbacks.left + setbacks.right));
                currentLength = rawL > 0 ? rawL : Math.max(6, plotDepth - (setbacks.front + setbacks.rear));
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
                  const inheritBadge = (roomInfo as any).inheritedFrom ? ' 🔗' : '';
                  selectedRoomLabels.push(`${countPrefix}${cat.label}${inheritBadge}`);
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
                          if (updateFloorDimensions) updateFloorDimensions(floor, w, l);
                          updateFloorAreaDirect(floor, Number((w * l).toFixed(2)));
                        }}
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
                          if (updateFloorDimensions) updateFloorDimensions(floor, w, l);
                          updateFloorAreaDirect(floor, Number((w * l).toFixed(2)));
                        }}
                        className="w-20 border-2 border-black p-1.5 text-center font-black text-xs bg-white focus:bg-amber-50"
                      />
                    </td>

                    <td className="border-r border-black p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          value={data.area || totalFloorBuiltUp || ""}
                          onChange={(e) => updateFloorAreaDirect(floor, Number(e.target.value) || 0)}
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
                            <span>MOS & Position for {floor}</span>
                            <span className="text-[10px] text-gray-600">Max: {plotFrontWidth}×{plotDepth} FT</span>
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
                                  if (updateFloorSetbacks) updateFloorSetbacks(floor, updated);
                                  const newLength = Math.max(5, plotDepth - (updated.front + updated.rear));
                                  const newWidth = Math.max(6, plotFrontWidth - (updated.left + updated.right));
                                  if (updateFloorDimensions) updateFloorDimensions(floor, newWidth, newLength);
                                  updateFloorAreaDirect(floor, Number((newWidth * newLength).toFixed(2)));
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
                              ROOM PLANNING FOR {floor}
                            </div>
                            <div className="text-xs font-black flex gap-3 items-center">
                              <span className="bg-slate-200 px-3 py-1 border border-black">
                                AREA: {totalFloorBuiltUp} SQ.FT
                              </span>
                              <span className={`px-3 py-1 border border-black ${allocatedRoomArea > totalFloorBuiltUp ? 'bg-red-200 text-red-900' : 'bg-green-100 text-green-900'}`}>
                                ALLOC: {allocatedRoomArea.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                            <div className="border-2 border-black p-3 bg-white">
                              <div className="bg-slate-900 text-white p-2 text-xs font-black mb-2 flex justify-between items-center">
                                <span>SELECT ITEMS</span>
                                {resetFloorRooms && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      resetFloorRooms(floor);
                                      inheritanceApplied.current[floor] = false;
                                      delete autoProcessedSignature.current[floor];
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 text-[10px] font-black uppercase border border-white cursor-pointer"
                                  >
                                    RESET
                                  </button>
                                )}
                              </div>
                              <div className="max-h-[420px] overflow-auto">
                                <table className="w-full border-collapse text-xs">
                                  <thead className="bg-slate-200 sticky top-0">
                                    <tr>
                                      <th className="border border-black p-1.5 font-black text-center w-8">SEL</th>
                                      <th className="border border-black p-1.5 font-black text-left pl-2">ROOM</th>
                                      <th className="border border-black p-1.5 font-black text-center w-10">NOS</th>
                                      <th className="border border-black p-1.5 font-black text-center w-16">W</th>
                                      <th className="border border-black p-1.5 font-black text-center w-16">L</th>
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
                                      const isInherited = (current as any).inheritedFrom;

                                      return (
                                        <tr key={room.key} className={current.selected ? "bg-amber-50" : isBlocked ? "bg-gray-100 opacity-60" : ""}>
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="checkbox"
                                              checked={current.selected}
                                              disabled={isBlocked}
                                              onChange={() => {
                                                if (isBlocked) { alert(exclusivity.note); return; }
                                                const nextAllocated = allocatedRoomArea + (current.selected ? -itemTotalArea : itemTotalArea);
                                                if (!current.selected && nextAllocated > totalFloorBuiltUp) { alert("Cannot select!"); return; }
                                                toggleRoom(floor, room.key);
                                              }}
                                              className="w-4 h-4"
                                            />
                                          </td>
                                          <td className="border border-black p-1.5 font-bold text-left pl-2">
                                            {room.label}
                                            {isInherited && <span className="text-[9px] text-blue-600 ml-1">🔗</span>}
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
                                                let val = Math.max(room.minWidth, Number(e.target.value) || room.minWidth);
                                                if (val > currentWidth * 1.5) val = Number(currentWidth.toFixed(2));
                                                updateRoom(floor, room.key, {
                                                  width: val,
                                                  areaPerRoom: Number((val * rL).toFixed(2)),
                                                  areaMode: 'MANUAL',
                                                  userAdjusted: true,
                                                } as any);
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
                                                let val = Math.max(room.minLength, Number(e.target.value) || room.minLength);
                                                if (val > currentLength * 1.5) val = Number(currentLength.toFixed(2));
                                                updateRoom(floor, room.key, {
                                                  length: val,
                                                  areaPerRoom: Number((rW * val).toFixed(2)),
                                                  areaMode: 'MANUAL',
                                                  userAdjusted: true,
                                                } as any);
                                              }}
                                              className="w-14 border border-black p-1 text-center font-bold text-xs bg-white"
                                            />
                                          </td>
                                          <td className="border border-black p-1.5 text-center font-bold">{rArea.toFixed(0)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="border-2 border-black p-3 bg-white">
                              <div className="bg-slate-900 text-white p-2 text-xs font-black mb-2 text-left pl-2">
                                SELECTED ITEMS
                              </div>
                              <div className="max-h-[420px] overflow-auto">
                                <table className="w-full border-collapse text-xs">
                                  <thead className="bg-slate-200 sticky top-0">
                                    <tr>
                                      <th className="border border-black p-1.5 font-black text-left pl-2">ITEM</th>
                                      <th className="border border-black p-1.5 font-black text-center">NOS</th>
                                      <th className="border border-black p-1.5 font-black text-center">DIM</th>
                                      <th className="border border-black p-1.5 font-black text-right pr-2">TOTAL</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ROOM_CATALOG.filter(room => floorRoomMap[room.key]?.selected).length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="border border-black p-8 text-center text-gray-500 font-bold">No items.</td>
                                      </tr>
                                    ) : (
                                      ROOM_CATALOG.filter(room => floorRoomMap[room.key]?.selected).map((room) => {
                                        const current = floorRoomMap[room.key];
                                        const rW = Number(current.width || room.defaultWidth);
                                        const rL = Number(current.length || room.defaultLength);
                                        const total = Number(current.count || 1) * Number((rW * rL).toFixed(2));
                                        const isInherited = (current as any).inheritedFrom;
                                        return (
                                          <tr key={`sel-${room.key}`} className="bg-green-50">
                                            <td className="border border-black p-1.5 font-bold text-left pl-2">
                                              {room.label}
                                              {isInherited && <span className="text-[9px] text-blue-600 ml-1">🔗</span>}
                                            </td>
                                            <td className="border border-black p-1.5 text-center font-bold">{current.count || 1}</td>
                                            <td className="border border-black p-1.5 text-center font-bold">{rW}'×{rL}'</td>
                                            <td className="border border-black p-1.5 text-right pr-2 font-black">{total.toFixed(2)}</td>
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