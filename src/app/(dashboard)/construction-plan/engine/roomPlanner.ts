/* =========================================================
   CONSTRUCTION PLAN SYSTEM — SINGLE RESIDENTIAL ROOM PLANNER
========================================================= */

import { FloorRoom, PlanningMode, ParkingMode, CandidateStrategy } from './planningTypes';
import { BHK_PRESETS, getRoomDefinition } from './roomRules';
import { calculateStaircase, StaircaseType } from './stairPlanner';
import { getRoadOrientation } from './roadOrientation';
import { selectParkingCandidate } from './parkingPlanner';
import { optimizeWetCore } from './ductPlanner';

// ============================================================
// 1. INPUT INTERFACE
// ============================================================
export interface ArchitecturalPlanRequest {
  floorName: string;
  width: number;
  length: number;
  bhk?: string;
  selectedRooms?: any;
  planningMode?: PlanningMode | string;
  roadSide?: string;
  hasParking?: boolean;
  floorToFloorHeightFeet?: number;
  planningArea?: number;
  parkingMode?: ParkingMode;
  groundFloorProgram?: string[];
  groundStairPosition?: { x: number; y: number; w?: number; h?: number };
  groundStairRelativeOffset?: { dx: number; dy: number };
}

export interface PracticalRoomRule {
  minWidth: number;
  minDepth: number;
  preferredWidth: number;
  preferredDepth: number;
  furniture: string;
}

export interface ArchitecturalPlanResult {
  rooms: FloorRoom[];
  warnings: string[];
  errors: string[];
  score: number;
  furnitureChecks: Array<{ room: string; ok: boolean; note: string }>;
  stairType: StaircaseType;
  staircase: ReturnType<typeof calculateStaircase>;
  orientation: ReturnType<typeof getRoadOrientation>;
}

type RoomSpec = {
  key: string;
  count: number;
  areaMode: 'AUTO' | 'MANUAL';
  areaPerRoom?: number;
  width?: number;
  length?: number;
  w?: number;
  h?: number;
  embedIn?: string;
  position?: string;
  inheritedX?: number;
  inheritedY?: number;
  inheritedFrom?: string;
};

export const PRACTICAL_ROOM_RULES: Record<string, PracticalRoomRule> = {
  'MASTER BEDROOM': { minWidth: 10.5, minDepth: 10.5, preferredWidth: 12, preferredDepth: 14, furniture: 'double bed + wardrobe + clear bedside access' },
  'BEDROOM': { minWidth: 9, minDepth: 9, preferredWidth: 11, preferredDepth: 12, furniture: 'bed + wardrobe + clear walking path' },
  'FRONT BEDROOM': { minWidth: 4, minDepth: 6, preferredWidth: 8, preferredDepth: 11, furniture: 'bed + wardrobe + clear walking path (compact)' },
  'REAR BEDROOM': { minWidth: 4, minDepth: 6, preferredWidth: 8, preferredDepth: 12, furniture: 'bed + wardrobe + clear walking path (compact)' },
  'FRONT ATTACHED BATH': { minWidth: 3, minDepth: 3.5, preferredWidth: 4, preferredDepth: 7, furniture: 'WC + basin + compact shower' },
  'REAR ATTACHED BATH': { minWidth: 3, minDepth: 3.5, preferredWidth: 4, preferredDepth: 6, furniture: 'WC + basin + compact shower' },
  'LIVING ROOM': { minWidth: 10, minDepth: 9, preferredWidth: 12, preferredDepth: 14, furniture: 'sofa set + TV wall + circulation' },
  'HALL': { minWidth: 9, minDepth: 9, preferredWidth: 11, preferredDepth: 13, furniture: 'seating + entry circulation' },
  'KITCHEN': { minWidth: 5, minDepth: 5, preferredWidth: 7, preferredDepth: 8, furniture: 'counter run + fridge + working aisle' },
  'KITCHEN CUM DINING': { minWidth: 9, minDepth: 9, preferredWidth: 11, preferredDepth: 12, furniture: 'kitchen counter + dining table + working aisle' },
  'DINING': { minWidth: 7, minDepth: 8, preferredWidth: 8, preferredDepth: 10, furniture: '4–6 seat dining table + circulation' },
  'POOJA ROOM': { minWidth: 4, minDepth: 5, preferredWidth: 5, preferredDepth: 6, furniture: 'altar + standing space' },
  'STUDY ROOM': { minWidth: 6, minDepth: 7, preferredWidth: 7, preferredDepth: 8, furniture: 'desk + chair + storage' },
  'COMMON TOILET': { minWidth: 4, minDepth: 4, preferredWidth: 6, preferredDepth: 5, furniture: 'WC + basin + required clear space' },
  'ATTACHED TOILET': { minWidth: 4.5, minDepth: 4.5, preferredWidth: 5, preferredDepth: 7, furniture: 'WC + basin + bathing clear space' },
  'BATHROOM': { minWidth: 4, minDepth: 4, preferredWidth: 5, preferredDepth: 7, furniture: 'WC + basin + bathing clear space' },
  'STAIRCASE': { minWidth: 5.5, minDepth: 8, preferredWidth: 6.0, preferredDepth: 10, furniture: 'two-flight stair + landing/headroom zone' },
  'PARKING': { minWidth: 4, minDepth: 7, preferredWidth: 9, preferredDepth: 8, furniture: 'car bay + door/vehicle clearance' },
  'DUCT': { minWidth: 1.5, minDepth: 3, preferredWidth: 3, preferredDepth: 4, furniture: 'ventilation/service shaft' },
  'PASSAGE': { minWidth: 3, minDepth: 4, preferredWidth: 3.25, preferredDepth: 6, furniture: 'clear circulation path' },
  'BALCONY': { minWidth: 4, minDepth: 5, preferredWidth: 5, preferredDepth: 8, furniture: 'open circulation / sit-out' },
};

// ============================================================
// HELPERS
// ============================================================
function n(v: any, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function clean(s: any) { return String(s || '').trim().toUpperCase(); }

function canonical(raw: any): string {
  const s = clean(raw);
  if ((s.includes('LIVING') || s.includes('HALL') || s.includes('DRAWING')) && s.includes('STAIR')) {
    return 'LIVING ROOM + STAIR';
  }
  if (s.includes('KITCHEN') && (s.includes('DINING') || s.includes('CUM'))) return 'KITCHEN CUM DINING';
  if (s.includes('MASTER') && (s.includes('ATTACHED') || s.includes('TOILET') || s.includes('BATH'))) {
    return 'MASTER BEDROOM';
  }
  if (s.includes('MASTER')) return 'MASTER BEDROOM';
  if (s.includes('FRONT') && s.includes('ATTACHED') && (s.includes('BATH') || s.includes('TOILET'))) return 'FRONT ATTACHED BATH';
  if (s.includes('REAR') && s.includes('ATTACHED') && (s.includes('BATH') || s.includes('TOILET'))) return 'REAR ATTACHED BATH';
  if (s.includes('FRONT') && (s.includes('BEDROOM') || s.includes('BED'))) return 'FRONT BEDROOM';
  if (s.includes('REAR') && (s.includes('BEDROOM') || s.includes('BED'))) return 'REAR BEDROOM';
  if (s.includes('BEDROOM') || s === 'BED') return 'BEDROOM';
  if (s.includes('STAIR')) return 'STAIRCASE';
  if (s.includes('LIVING') || s.includes('DRAWING') || s.includes('HALL') || s.includes('LOUNGE')) return 'LIVING ROOM';
  if (s.includes('ATTACHED') && (s.includes('TOILET') || s.includes('BATH'))) return 'ATTACHED TOILET';
  if (s.includes('COMMON') && (s.includes('TOILET') || s.includes('BATH'))) return 'COMMON TOILET';
  if (s.includes('BATH') || s.includes('BATHROOM')) return 'BATHROOM';
  if (s.includes('TOILET') || s === 'WC') return 'COMMON TOILET';
  if (s.includes('KITCHEN')) return 'KITCHEN';
  if (s.includes('DINING')) return 'DINING';
  if (s.includes('POOJA')) return 'POOJA ROOM';
  if (s.includes('STUDY')) return 'STUDY ROOM';
  if (s.includes('PARK') || s.includes('PORCH')) return 'PARKING';
  if (s.includes('DUCT') || s.includes('OTS') || s.includes('SHAFT')) return 'DUCT';
  if (s.includes('PASSAGE') || s.includes('CORRIDOR')) return 'PASSAGE';
  if (s.includes('BALCONY')) return 'BALCONY';
  if (s.includes('UTILITY')) return 'UTILITY';
  if (s.includes('STORE')) return 'STORE';
  if (s.includes('GARDEN') || s.includes('BIKE')) return 'GARDEN / BIKE ENTRY';
  return s || 'ROOM';
}

function detectMasterWithAttached(selectedRooms: any): boolean {
  const check = (arr: any[]): boolean => arr.some((v: any) => {
    const k = String(v?.key || v?.name || v?.label || v?.roomType || '').toLowerCase();
    return k.includes('master') && (k.includes('attached') || k.includes('toilet') || k.includes('bath'));
  });
  if (Array.isArray(selectedRooms)) return check(selectedRooms);
  if (selectedRooms && typeof selectedRooms === 'object') {
    return Object.entries(selectedRooms).some(([k, v]: any) => {
      const lower = k.toLowerCase();
      const labelLower = String(v?.label || v?.name || '').toLowerCase();
      return (lower.includes('master') || labelLower.includes('master')) &&
        (lower.includes('attached') || lower.includes('toilet') || labelLower.includes('attached') || labelLower.includes('toilet'));
    });
  }
  return false;
}

function furnitureAssumptions(key: string, w: number, h: number): any[] {
  const fw = Math.max(0.1, w), fh = Math.max(0.1, h);
  if (key === 'MASTER BEDROOM' || key === 'BEDROOM' || key === 'FRONT BEDROOM' || key === 'REAR BEDROOM') {
    const bedW = Math.min(6.25, Math.max(5, fw - 3.2));
    return [
      { type: 'BED', x: Math.max(0.6, fw * 0.08), y: Math.max(0.6, fh * 0.16), width: bedW, depth: 6.5 },
      { type: 'WARDROBE_CLEAR', x: Math.max(0.5, fw - 2.1), y: 0.6, width: 1.8, depth: Math.min(7, Math.max(4, fh - 1.2)) },
    ];
  }
  if (key === 'LIVING ROOM') return [{ type: 'SOFA_CLEAR', x: 0.7, y: Math.max(0.7, fh - 4.5), width: Math.min(9, Math.max(6, fw - 1.4)), depth: 3.4 }];
  if (key === 'DINING') return [{ type: 'DINING_TABLE_CLEAR', x: Math.max(0.5, fw / 2 - 3), y: Math.max(0.5, fh / 2 - 2), width: Math.min(6, Math.max(4, fw - 1)), depth: Math.min(4, Math.max(3, fh - 1)) }];
  if (key === 'KITCHEN' || key === 'KITCHEN CUM DINING') return [{ type: 'KITCHEN_COUNTER_CLEAR', x: 0.35, y: 0.35, width: Math.min(2, Math.max(1.5, fw - 0.7)), depth: Math.min(8, Math.max(4, fh - 0.7)) }];
  return [];
}

function makeRoom(key: string, index: number, x: number, y: number, w: number, h: number, extras: any = {}): FloorRoom {
  const roomType = key === 'LIVING ROOM' ? 'living' : key === 'PARKING' ? 'parking' : key === 'STAIRCASE' ? 'stairs' : key === 'DUCT' ? 'duct' : key.includes('TOILET') || key === 'BATHROOM' || key.includes('ATTACHED BATH') ? 'toilet' : key === 'PASSAGE' ? 'passage' : key.toLowerCase().replace(/\s+/g, '-');
  return {
    id: `arch_${index}_${key.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name: key,
    label: key,
    roomType,
    type: roomType,
    x: Number(Math.max(0, x).toFixed(3)),
    y: Number(Math.max(0, y).toFixed(3)),
    w: Number(Math.max(0.1, w).toFixed(3)),
    h: Number(Math.max(0.1, h).toFixed(3)),
    selected: true,
    count: 1,
    areaMode: extras.areaMode || 'AUTO',
    areaPerRoom: Number(Math.max(0.1, w * h).toFixed(2)),
    furniture: extras.furniture ?? furnitureAssumptions(key, w, h),
    ...extras,
  };
}

function roomCounts(program: string[]) {
  const counts: Record<string, number> = {};
  for (const key of program) counts[key] = (counts[key] || 0) + 1;
  return counts;
}

function overlap(a: FloorRoom, b: FloorRoom) {
  return Math.min((a.x! + a.w!), (b.x! + b.w!)) > Math.max(a.x!, b.x!) + 0.02 &&
    Math.min((a.y! + a.h!), (b.y! + b.h!)) > Math.max(a.y!, b.y!) + 0.02;
}

// ============================================================
// 12b. STAIRCASE CORNER CHOOSER
// ============================================================
type StairCorner = 'BOTTOM-RIGHT' | 'BOTTOM-LEFT' | 'TOP-RIGHT' | 'TOP-LEFT';

type StairPlacement = {
  corner: StairCorner;
  x: number;
  y: number;
  relativeX: number;
  relativeY: number;
};

function chooseStaircaseCorner(
  livingRoom: FloorRoom,
  stairW: number,
  stairH: number,
  existingRooms: FloorRoom[],
  existingDoors: any[],
  stairType: StaircaseType,
): StairPlacement | null {
  const lx = livingRoom.x || 0;
  const ly = livingRoom.y || 0;
  const lw = livingRoom.w || 0;
  const lh = livingRoom.h || 0;

  let effectiveStairW = stairW;
  let effectiveStairH = stairH;

  if (stairType === '2_QUARTER_WINDER' || stairType === '2_QUARTER_LANDING') {
    effectiveStairH = Math.min(stairH, lh * 0.9);
    effectiveStairW = Math.min(stairW, lw * 0.8);
  }

  const cornerDefs: Array<{ corner: StairCorner; x: number; y: number; score: number }> = [
    { corner: 'TOP-RIGHT', x: lx + lw - effectiveStairW, y: ly, score: 1 },
    { corner: 'TOP-LEFT', x: lx, y: ly, score: 2 },
    { corner: 'BOTTOM-RIGHT', x: lx + lw - effectiveStairW, y: ly + lh - effectiveStairH, score: 3 },
    { corner: 'BOTTOM-LEFT', x: lx, y: ly + lh - effectiveStairH, score: 4 },
  ];

  const isBlockedBy = (cand: { x: number; y: number }, other: FloorRoom): boolean => {
    if (other === livingRoom) return false;
    if ((other as any).subZoneOf || (other as any).isSubRoom) return false;
    if (canonical(other.name) === 'PASSAGE') return false;
    const ox = Math.min(cand.x + effectiveStairW, (other.x || 0) + (other.w || 0)) - Math.max(cand.x, other.x || 0);
    const oy = Math.min(cand.y + effectiveStairH, (other.y || 0) + (other.h || 0)) - Math.max(cand.y, other.y || 0);
    return ox > 0.15 && oy > 0.15;
  };

  const isBlockedByDoor = (cand: { x: number; y: number }): boolean => {
    for (const door of existingDoors) {
      const doorX = door.globalX ?? door.x ?? 0;
      const doorY = door.globalY ?? door.y ?? 0;
      const swing = 3;
      const ox = Math.min(cand.x + effectiveStairW, doorX + swing) - Math.max(cand.x, doorX - swing);
      const oy = Math.min(cand.y + effectiveStairH, doorY + swing) - Math.max(cand.y, doorY - swing);
      if (ox > 0.3 && oy > 0.3) return true;
    }
    return false;
  };

  const isBlockedByPassage = (cand: { x: number; y: number }): boolean => {
    for (const r of existingRooms) {
      if (canonical(r.name) !== 'PASSAGE') continue;
      const ox = Math.min(cand.x + effectiveStairW, (r.x || 0) + (r.w || 0)) - Math.max(cand.x, r.x || 0);
      const oy = Math.min(cand.y + effectiveStairH, (r.y || 0) + (r.h || 0)) - Math.max(cand.y, r.y || 0);
      if (ox > 0.15 && oy > 0.15) return true;
    }
    return false;
  };

  const isInsideLiving = (cand: { x: number; y: number }): boolean => {
    if (cand.x < lx - 0.01 || cand.y < ly - 0.01) return false;
    if (cand.x + effectiveStairW > lx + lw + 0.01) return false;
    if (cand.y + effectiveStairH > ly + lh + 0.01) return false;
    return true;
  };

  const typeAdjustedScore = (base: number, corner: StairCorner): number => {
    if (stairType === '2_QUARTER_WINDER' || stairType === '2_QUARTER_LANDING') {
      if (corner === 'TOP-LEFT') return base - 1.0;
      if (corner === 'BOTTOM-LEFT') return base - 0.5;
      if (corner === 'TOP-RIGHT') return base + 1.0;
      if (corner === 'BOTTOM-RIGHT') return base + 1.5;
    }
    if (stairType === 'L_SHAPED') {
      if (corner === 'TOP-RIGHT' || corner === 'TOP-LEFT') return base - 0.5;
      if (corner === 'BOTTOM-RIGHT' || corner === 'BOTTOM-LEFT') return base + 0.5;
    }
    if (stairType === 'DOG_LEGGED') {
      if (corner === 'TOP-RIGHT') return base - 0.75;
      if (corner === 'TOP-LEFT') return base - 0.25;
    }
    return base;
  };

  const sorted = [...cornerDefs]
    .map(c => ({ ...c, score: typeAdjustedScore(c.score, c.corner) }))
    .sort((a, b) => a.score - b.score);

  for (const def of sorted) {
    const cand = { x: def.x, y: def.y };

    if (!isInsideLiving(cand)) continue;
    if (isBlockedByPassage(cand)) continue;
    if (isBlockedByDoor(cand)) continue;
    let blocked = false;
    for (const r of existingRooms) {
      if (isBlockedBy(cand, r)) { blocked = true; break; }
    }
    if (blocked) continue;

    const result: StairPlacement = {
      corner: def.corner,
      x: def.x,
      y: def.y,
      relativeX: def.x - lx,
      relativeY: def.y - ly,
    };
    console.log('[CHOOSE STAIR CORNER] ✅ SELECTED', result);
    return result;
  }

  const fallback: StairPlacement = {
    corner: 'TOP-RIGHT',
    x: lx + lw - effectiveStairW,
    y: ly,
    relativeX: lw - effectiveStairW,
    relativeY: 0,
  };
  console.log('[CHOOSE STAIR CORNER] ⚠️ FALLBACK USED', fallback);
  return fallback;
}

// ============================================================
// 13. SPECS EXTRACTOR
// ============================================================
function extractSpecs(selectedRooms: any): RoomSpec[] {
  const out: RoomSpec[] = [];
  const push = (rawKey: any, value: any) => {
    const key = canonical(rawKey);
    if (!key || key === 'ROOM') return;
    const item = value && typeof value === 'object' ? value : {};
    if (item.selected === false) return;
    const count = Math.max(1, Math.floor(n(item.count, 1)));
    const areaMode = String(item.areaMode || 'AUTO').toUpperCase() === 'MANUAL' ? 'MANUAL' : 'AUTO';
    const areaPerRoom = areaMode === 'MANUAL' && n(item.areaPerRoom, 0) > 0 ? n(item.areaPerRoom) : undefined;

    if (String(rawKey).toLowerCase().includes('parking_with_stair')) {
      out.push({
        key: 'PARKING', count, areaMode, areaPerRoom,
        width: item.width || item.w,
        length: item.length || item.h,
      } as RoomSpec);
      out.push({ key: 'STAIRCASE', count: 1, areaMode: 'AUTO', areaPerRoom: 65 } as RoomSpec);
      return;
    }

    const rawLower = String(rawKey || '').toLowerCase();
    const labelLower = String(item.label || item.name || '').toLowerCase();
    const combinedKey = `${rawLower} ${labelLower}`;
    const isLivingStairCombo =
      key === 'LIVING ROOM + STAIR' ||
      ((combinedKey.includes('living') || combinedKey.includes('hall') || combinedKey.includes('drawing')) &&
        combinedKey.includes('stair'));

    if (isLivingStairCombo) {
      const width = Number(item.width) > 0 ? Number(item.width) : (Number(item.w) > 0 ? Number(item.w) : undefined);
      const length = Number(item.length) > 0 ? Number(item.length) : (Number(item.h) > 0 ? Number(item.h) : undefined);

      out.push({
        key: 'LIVING ROOM',
        count: 1,
        areaMode,
        areaPerRoom,
        width,
        length,
      } as RoomSpec);

      out.push({
        key: 'STAIRCASE',
        count: 1,
        areaMode: 'AUTO',
        areaPerRoom: 65,
        embedIn: 'LIVING ROOM',
        position: item.position || 'TOP-RIGHT',
        inheritedX: Number(item.inheritedX) || undefined,
        inheritedY: Number(item.inheritedY) || undefined,
        inheritedFrom: item.inheritedFrom || undefined,
      } as RoomSpec);

      return;
    }

    if (key === 'STAIRCASE' && out.some(x => x.key === 'STAIRCASE' && x.embedIn === 'LIVING ROOM')) {
      return;
    }

    const width = Number(item.width) > 0 ? Number(item.width) : (Number(item.w) > 0 ? Number(item.w) : undefined);
    const length = Number(item.length) > 0 ? Number(item.length) : (Number(item.h) > 0 ? Number(item.h) : undefined);

    const existing = out.find(x => x.key === key && x.areaMode === areaMode && x.areaPerRoom === areaPerRoom && x.width === width && x.length === length);
    if (existing) {
      existing.count += count;
    } else {
      out.push({
        key, count, areaMode, areaPerRoom, width, length,
        position: key === 'STAIRCASE' ? (item.position || 'TOP-RIGHT') : undefined,
        inheritedX: key === 'STAIRCASE' ? (Number(item.inheritedX) || undefined) : undefined,
        inheritedY: key === 'STAIRCASE' ? (Number(item.inheritedY) || undefined) : undefined,
        inheritedFrom: key === 'STAIRCASE' ? (item.inheritedFrom || undefined) : undefined,
      });
    }
  };

  if (Array.isArray(selectedRooms)) {
    for (const value of selectedRooms) {
      if (typeof value === 'string') push(value, {});
      else if (value && typeof value === 'object') push(value.key || value.name || value.label || value.roomType, value);
    }
  } else if (selectedRooms && typeof selectedRooms === 'object') {
    for (const [key, value] of Object.entries(selectedRooms)) push(key, value);
  }

  const livingSpec = out.find(s => s.key === 'LIVING ROOM');
  const stairSpec = out.find(s => s.key === 'STAIRCASE');
  if (livingSpec && !stairSpec) {
    const lw = Number(livingSpec.width) || 0;
    if (lw > 14) {
      out.push({
        key: 'STAIRCASE',
        count: 1,
        areaMode: 'AUTO',
        areaPerRoom: 65,
        embedIn: 'LIVING ROOM',
        position: 'TOP-RIGHT',
      } as RoomSpec);
    }
  }

  return out;
}

// ============================================================
// 14. PROGRAM BUILDER
// ============================================================
export function programFromInput(
  selectedRooms: any,
  bhk: string,
  floorArea: number,
  ground: boolean,
  mode: string,
  layoutW = 0,
  layoutH = 0,
  groundFloorProgram?: string[],
): string[] {
  const explicit = extractSpecs(selectedRooms);
  const result: string[] = [];
  const add = (key: string, count = 1) => { for (let i = 0; i < count; i++) result.push(canonical(key)); };

  for (const spec of explicit) add(spec.key, spec.count);
  const hasExplicit = explicit.length > 0;
  const area = Math.max(1, floorArea);
  const auto = clean(mode) === 'AUTO';

  const W = Number(layoutW) || 0;
  const L = Number(layoutH) || 0;

  console.log(`[PROGRAM FROM INPUT] START floor=${ground ? 'GROUND' : 'UPPER'}, layoutW=${W}, layoutH=${L}, area=${area}, hasExplicit=${hasExplicit}, auto=${auto}`);

  if (!hasExplicit && auto) {
    if (ground) {
      if (area <= 1200) {
        add('MASTER BEDROOM'); add('ATTACHED TOILET'); add('COMMON TOILET');
        add('KITCHEN CUM DINING'); add('LIVING ROOM'); add('PARKING'); add('STAIRCASE');
      } else if (area <= 1500) {
        add('MASTER BEDROOM'); add('BEDROOM'); add('ATTACHED TOILET');
        add('COMMON TOILET'); add('KITCHEN CUM DINING'); add('LIVING ROOM');
        add('PARKING'); add('STAIRCASE');
      } else {
        add('MASTER BEDROOM'); add('BEDROOM'); add('ATTACHED TOILET');
        add('COMMON TOILET'); add('KITCHEN'); add('DINING'); add('LIVING ROOM');
        add('PARKING'); add('STAIRCASE'); add('POOJA ROOM'); add('UTILITY');
      }
    } else {
      if (W >= 10) {
        add('FRONT BEDROOM'); add('REAR BEDROOM');
        add('FRONT ATTACHED BATH'); add('REAR ATTACHED BATH');
        add('STAIRCASE');
      } else if (W >= 8) {
        add('FRONT BEDROOM'); add('REAR BEDROOM');
        add('STAIRCASE');
      } else if (W >= 4.5) {
        add('FRONT BEDROOM'); add('STAIRCASE');
      } else {
        add('LIVING ROOM'); add('STAIRCASE');
      }
    }
  }

  if (auto && hasExplicit) {
    if (!result.includes('LIVING ROOM')) add('LIVING ROOM');
    if (ground && !result.includes('KITCHEN') && !result.includes('KITCHEN CUM DINING')) {
      add('KITCHEN');
    }
    if (ground && area >= 500 && !result.includes('PARKING')) {
      add('PARKING');
    }
    const hasLivingStairCombo = explicit.some(s => s.key === 'STAIRCASE' && s.embedIn === 'LIVING ROOM');
    if (!hasLivingStairCombo && !result.includes('STAIRCASE')) {
      add('STAIRCASE');
    }
  }

  if (ground && auto && !hasExplicit && area <= 1000) {
    const allowed = new Set([
      'MASTER BEDROOM', 'ATTACHED TOILET', 'COMMON TOILET', 'KITCHEN',
      'KITCHEN CUM DINING', 'LIVING ROOM', 'PARKING', 'STAIRCASE', 'BEDROOM',
    ]);
    const cleaned = result.filter(k => allowed.has(k));
    result.length = 0;
    result.push(...cleaned);
    const unique: string[] = [];
    for (const k of result) if (!unique.includes(k)) unique.push(k);
    result.length = 0; result.push(...unique);
  }

  if (!result.length && !hasExplicit) {
    const preset = (BHK_PRESETS as any)[clean(bhk) || '1 BHK'] || (BHK_PRESETS as any)['1 BHK'];
    for (const [key, count] of preset) add(String(key), n(count, 1));
  }

  console.log('[PROGRAM FROM INPUT] DONE', {
    explicitKeys: explicit.map(s => s.key),
    hasExplicit,
    auto,
    ground,
    W, L, area,
    finalProgram: result,
  });

  return result;
}

export function extractSpecsForCandidate(selectedRooms: any): RoomSpec[] {
  return extractSpecs(selectedRooms);
}

function desiredArea(specs: RoomSpec[], key: string, fallback: number): number {
  const spec = specs.find(s => s.key === key);
  if (spec?.width && spec?.length) return spec.width * spec.length;
  if (spec?.areaMode === 'MANUAL' && spec.areaPerRoom && spec.areaPerRoom > 0) return spec.areaPerRoom;
  const def = getRoomDefinition(key);
  return Math.max(def.minArea || 1, def.defaultArea || fallback);
}

function chooseStairType(W: number, H: number): StaircaseType {
  if (H < 30) return '2_QUARTER_WINDER';
  if (W < 13) return '2_QUARTER_WINDER';
  if (W >= 13 && W < 15) return '2_QUARTER_LANDING';
  if (W >= 15 && W < 18) return 'L_SHAPED';
  return 'DOG_LEGGED';
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function fitRectForArea(key: string, area: number, maxW: number, maxH: number): { w: number; h: number } {
  const rule = PRACTICAL_ROOM_RULES[key] || { minWidth: 3, minDepth: 3, preferredWidth: 5, preferredDepth: 6, furniture: '' };
  const preferredW = clamp(Math.sqrt(Math.max(1, area) * (rule.preferredWidth / Math.max(1, rule.preferredDepth))), rule.minWidth, maxW);
  let h = area / Math.max(rule.minWidth, preferredW);
  let w = preferredW;
  if (h > maxH) { h = maxH; w = area / Math.max(1, h); }
  if (w > maxW) { w = maxW; h = area / Math.max(1, w); }
  w = Math.max(Math.min(rule.minWidth, maxW), w);
  h = Math.max(Math.min(rule.minDepth, maxH), h);
  return { w: Math.min(maxW, w), h: Math.min(maxH, h) };
}

// ============================================================
// HELPER: Parking Width
// ============================================================
function getParkingWidth(W: number): number {
  if (W <= 11) return 4;
  if (W <= 12) return 4;
  if (W <= 13) return 5;
  if (W <= 14) return 6;
  if (W <= 15) return 7;
  if (W <= 16) return 7.5;
  if (W <= 17) return 8;
  if (W <= 18) return 8.5;
  if (W <= 19) return 8.5;
  return 9;
}

// ============================================================
// HELPER: Common Toilet Orientation
// ============================================================
const MIN_PASSAGE_W = 3.5;   // passage kabhi 3.5' se kam nahi

function getCommonToiletOrientation(availableW: number): { w: number; h: number; orientation: 'H' | 'V' } {
  // Wide plot: passage 3.5' ya usse zyada bachta hai → purana 6' x 4.5'
  if (availableW >= 6 + MIN_PASSAGE_W) {
    return { w: 6, h: 4.5, orientation: 'H' };
  }
  // Narrow plot: toilet width kam karo (passage 3.5' rakho), length badha kar area same rakho
  const w = availableW - MIN_PASSAGE_W;
  if (w >= 4) {
    const h = Math.max(4.5, Math.ceil((27 / w) * 2) / 2);   // 0.5' ke multiple me
    return { w, h, orientation: 'V' };
  }
  return { w: 4, h: 6.5, orientation: 'V' };
}

// ============================================================
// HELPER: Attached Toilet Orientation
// ============================================================
function getAttachedToiletOrientation(masterW: number, masterH: number): { w: number; h: number; orientation: 'H' | 'V'; x: number; y: number } {
  if (masterW >= 15) {
    const aw = 5;
    const ah = Math.min(7, masterH * 0.7);
    return { w: aw, h: ah, orientation: 'V', x: masterW - aw, y: 0 };
  }
  const aw = Math.min(10, masterW * 0.7);
  const ah = 4.5;
  return { w: aw, h: ah, orientation: 'H', x: 0, y: 0 };
}

// ============================================================
// HELPER: Resolve inherited stair position for upper floors
// ============================================================
function resolveInheritedStairPosition(args: {
  livingX: number;
  livingY: number;
  livingW: number;
  livingH: number;
  stairW: number;
  stairH: number;
  userInheritedX: number | null;
  userInheritedY: number | null;
  groundStairPosition?: { x: number; y: number };
  groundStairRelativeOffset?: { dx: number; dy: number };
  fallbackPosition: string;
}): { x: number; y: number; rule: string } {
  const {
    livingX, livingY, livingW, livingH,
    stairW, stairH,
    userInheritedX, userInheritedY,
    groundStairPosition,
    groundStairRelativeOffset,
    fallbackPosition,
  } = args;

  const clampX = (v: number) => Math.max(livingX, Math.min(v, livingX + livingW - stairW));
  const clampY = (v: number) => Math.max(livingY, Math.min(v, livingY + livingH - stairH));

  if (Number.isFinite(userInheritedX) && Number.isFinite(userInheritedY)) {
    return { x: clampX(userInheritedX as number), y: clampY(userInheritedY as number), rule: 'USER_MANUAL_OVERRIDE' };
  }

  if (groundStairPosition && Number.isFinite(groundStairPosition.x) && Number.isFinite(groundStairPosition.y)) {
    return { x: clampX(groundStairPosition.x), y: clampY(groundStairPosition.y), rule: 'INHERITED_ABSOLUTE_GROUND_POSITION_CLAMPED' };
  }

  if (groundStairRelativeOffset && Number.isFinite(groundStairRelativeOffset.dx) && Number.isFinite(groundStairRelativeOffset.dy)) {
    return { x: clampX(livingX + groundStairRelativeOffset.dx), y: clampY(livingY + groundStairRelativeOffset.dy), rule: 'INHERITED_RELATIVE_OFFSET_FALLBACK' };
  }

  let fx = livingX + livingW - stairW;
  let fy = livingY + livingH - stairH;
  let rule = 'DEFAULT_TOP_RIGHT';

  if (fallbackPosition === 'TOP-LEFT') {
    fx = livingX; fy = livingY + livingH - stairH; rule = 'DEFAULT_TOP_LEFT';
  } else if (fallbackPosition === 'BOTTOM-RIGHT') {
    fx = livingX + livingW - stairW; fy = livingY; rule = 'DEFAULT_BOTTOM_RIGHT';
  } else if (fallbackPosition === 'BOTTOM-LEFT') {
    fx = livingX; fy = livingY; rule = 'DEFAULT_BOTTOM_LEFT';
  }

  return { x: clampX(fx), y: clampY(fy), rule };
}

// ============================================================
// HELPER: Build embedded stair metadata
// ============================================================
function buildEmbeddedStairMetadata(args: {
  placement: StairPlacement;
  sW: number;
  sH: number;
  stairType: StaircaseType;
  stairSpec: ReturnType<typeof calculateStaircase>;
  source: string;
}): any {
  const { placement, sW, sH, stairType, stairSpec, source } = args;

  const metadata = {
    relX: placement.relativeX,
    relY: placement.relativeY,
    absX: placement.x,
    absY: placement.y,
    w: sW,
    h: sH,
    staircaseType: stairType,
    staircaseSpec: {
      ...stairSpec,
      flight1Treads: stairSpec.flight1.treads,
      flight2Treads: stairSpec.flight2.treads,
      flight1LengthFt: stairSpec.flight1.lengthFt,
      flight2LengthFt: stairSpec.flight2.lengthFt,
      middleTreads: stairSpec.middleTreads,
      treadInches: stairSpec.treadInches,
      actualRiserInches: stairSpec.actualRiserInches,
      riserCount: stairSpec.riserCount,
      landing1WidthFt: stairSpec.landing1.widthFt,
      landing1LengthFt: stairSpec.landing1.lengthFt,
      landing2WidthFt: stairSpec.landing2.widthFt,
      landing2LengthFt: stairSpec.landing2.lengthFt,
      wellWidthFt: stairSpec.wellSize.widthFt,
      wellLengthFt: stairSpec.wellSize.lengthFt,
    },
    placedAtCorner: placement.corner,
    source,
  };

  console.log('[EMBEDDED STAIR METADATA CREATED]', {
    source,
    relX: metadata.relX, relY: metadata.relY,
    absX: metadata.absX, absY: metadata.absY,
    w: sW, h: sH,
    corner: placement.corner,
    stairType,
  });

  return metadata;
}

// ============================================================
// ✅ HELPER: Preserve doors after optimizeWetCore
// optimizeWetCore() rooms ko re-arrange karta hai aur doors wipe kar deta hai
// Yeh helper doors/windows ko re-attach karta hai by room ID
// ============================================================
function preserveDoorsAfterWetCore(originalRooms: FloorRoom[]): FloorRoom[] {
  // 1. Original doors/windows ko map me store karo (by room id)
  const doorsById = new Map<string, any[]>();
  const windowsById = new Map<string, any[]>();

  for (const r of originalRooms) {
    if (r.id) {
      if (Array.isArray(r.doors) && r.doors.length > 0) {
        doorsById.set(String(r.id), [...r.doors]);
      }
      if (Array.isArray(r.windows) && r.windows.length > 0) {
        windowsById.set(String(r.id), [...r.windows]);
      }
    }
  }

  console.log('[PRESERVE DOORS] 📋 Captured doors for', doorsById.size, 'rooms, windows for', windowsById.size, 'rooms');

  // 2. optimizeWetCore call karo
  const finalRooms = optimizeWetCore(originalRooms);

  // 3. Doors/windows re-attach karo (agar wipe ho gaye hain)
  let reattachedDoors = 0;
  let reattachedWindows = 0;

  for (const fr of finalRooms) {
    if (!fr.id) continue;

    const origDoors = doorsById.get(String(fr.id));
    if (origDoors && origDoors.length > 0) {
      if (!Array.isArray(fr.doors) || fr.doors.length === 0) {
        fr.doors = [...origDoors];
        reattachedDoors++;
        console.log(`[PRESERVE DOORS] ✅ Re-attached ${origDoors.length} doors to ${fr.name} (id=${fr.id})`);
      }
    }

    const origWins = windowsById.get(String(fr.id));
    if (origWins && origWins.length > 0) {
      if (!Array.isArray(fr.windows) || fr.windows.length === 0) {
        fr.windows = [...origWins];
        reattachedWindows++;
      }
    }
  }

  console.log(`[PRESERVE DOORS] ✅ Total re-attached: ${reattachedDoors} rooms (doors), ${reattachedWindows} rooms (windows)`);

  return finalRooms;
}

// ============================================================
// ✅ BUILD UNIVERSAL GROUND FLOOR (10≤W≤20, 35≤L≤55)
// ============================================================
function buildUniversalGroundFloor(
  W: number,
  H: number,
  hasParking: boolean,
  hasLiving: boolean,
  hasKitchen: boolean,
  hasKD: boolean,
  hasCommon: boolean,
  hasAttached: boolean,
  bedrooms: string[],
  stairSpec: ReturnType<typeof calculateStaircase>,
  parkingMode: ParkingMode,
  stairEmbeddedInLiving: boolean,
  addRoom: (key: string, x: number, y: number, w: number, h: number, extras?: any) => void,
  rooms: FloorRoom[],
): FloorRoom[] | null {
  console.log('[BUILD UNIVERSAL GROUND FLOOR] START', {
    W, H, hasParking, hasLiving, hasKitchen, hasKD, hasCommon, hasAttached,
    bedrooms, stairEmbeddedInLiving,
    stairType: stairSpec.staircaseType,
  });

  if (!hasParking || !hasLiving) {
    console.log('[BUILD UNIVERSAL GROUND FLOOR] ABORT → no parking or living');
    return null;
  }

  const frontH = 8;
  const parkingW = getParkingWidth(W);
  const kitchenW = Math.max(4.5, W - parkingW);
  const frontY = H - frontH;
  const ctW = W >= 15 ? 6 : (W >= 12 ? 5 : 4);

  addRoom('PARKING', 0, frontY, parkingW, frontH, {
    parkingShape: 'CAR',
    parkingZone: 'FRONT_ROAD_CONNECTED',
    vehicleFit: true,
    vehicleClearanceRequired: true,
    parkingMode,
    entryRole: 'MAIN_ROAD_VEHICLE_GATE',
    doors: [
      {
        id: 'd-parking-main-gate',
        wall: 'BOTTOM',
        widthFeet: 6.5,
        offsetFeet: Math.max(0.5, (parkingW - 6.5) / 2),
        doorType: 'MAIN',
        renderSymbol: true,
        isExternalOpening: true,
        cutsExternalWall: true,
        entryRole: 'MAIN_ROAD_VEHICLE_GATE',
      },
      {
        id: 'shared-parking-living',
        wall: 'TOP',
        widthFeet: 3.5,
        offsetFeet: Math.max(1, (parkingW - 3.5) / 2),
        doorType: 'MAIN',
        isDoubleLeaf: true,
        renderSymbol: false,
        swingDirection: 'INWARDS',
        entryRole: 'MAIN_PARKING_TO_LIVING_DOOR',
        sharedOpeningId: 'shared-parking-living',
      },
    ],
  });

  if (hasKitchen || hasKD) {
    const kitchenKey = hasKD ? 'KITCHEN CUM DINING' : 'KITCHEN';
    const actualKitchenW = Math.max(4, W - parkingW);

    addRoom(kitchenKey, parkingW, frontY, actualKitchenW, frontH, {
      serviceZone: true,
      ventilationRequired: true,
      dimensionsFitted: true,
    });

    const kitchenAdded = rooms.some(r => canonical(r.name) === 'KITCHEN' || canonical(r.name) === 'KITCHEN CUM DINING');
    if (!kitchenAdded) {
      const fallbackParkW = 4;
      const fallbackKitchenW = W - fallbackParkW;
      const parkingIdx = rooms.findIndex(r => canonical(r.name) === 'PARKING');
      if (parkingIdx >= 0) {
        rooms[parkingIdx].w = fallbackParkW;
        rooms[parkingIdx].areaPerRoom = fallbackParkW * frontH;
      }
      addRoom(kitchenKey, fallbackParkW, frontY, fallbackKitchenW, frontH, {
        serviceZone: true,
        ventilationRequired: true,
        dimensionsFitted: true,
      });
    }
  }
  let currentY = frontY;

  let serviceH = 0;
  if (hasCommon) {
    serviceH = W >= 13 ? 5 : 4.5;
    const sY = currentY - serviceH;

    addRoom('COMMON TOILET', 0, sY, ctW, serviceH, {
      serviceCore: true,
      ventilationRequired: true,
      dimensionsFitted: true,
      orientation: W >= 13 ? 'HORIZONTAL' : 'VERTICAL',
      doors: [
        {
          id: 'shared-ct-passage',
          wall: 'RIGHT',
          widthFeet: 2.5,
          offsetFeet: Math.max(0.5, (serviceH - 2.5) / 2),
          doorType: 'TOILET',
          renderSymbol: true,
          swingInside: true,
          sharedOpeningId: 'shared-ct-passage',
        },
      ],
      windows: [
        {
          id: 'ct_vent_top',
          wall: 'TOP',
          lengthFeet: 2,
          offsetFeet: Math.max(0.5, ctW / 2 - 1),
        },
      ],
    });
    const passageW = W - ctW;
    if (passageW >= 3) {
      const passageRoom = makeRoom('PASSAGE', rooms.length, ctW, sY, passageW, serviceH, {
        circulationZone: true,
        protectedCorridor: true,
        corridorWidthFt: passageW,
        pinkGuideLines: true,
        connects: ['PARKING', 'KITCHEN', 'LIVING ROOM', 'COMMON TOILET', 'MASTER BEDROOM'],
        orientation: 'HORIZONTAL_SERVICE_SPINE',
        accessRole: 'PRIMARY_INTERNAL_SPINE',
        isSubRoom: true,
        doors: [
          {
            id: 'shared-ct-passage',
            wall: 'LEFT',
            widthFeet: 2.5,
            offsetFeet: Math.max(0.5, (serviceH - 2.5) / 2),
            doorType: 'TOILET',
            renderSymbol: false,
            swingInside: false,
            sharedOpeningId: 'shared-ct-passage',
          },
          {
            id: 'shared-bedroom-passage',
            wall: 'BOTTOM',
            widthFeet: 3.0,
            offsetFeet: Math.max(1, passageW - 3.5),
            doorType: 'INTERNAL',
            renderSymbol: false,
            swingInside: false,
            sharedOpeningId: 'shared-bedroom-passage',
          },
        ],
      });
      rooms.push(passageRoom);
    }
    currentY = sY;
  }

  const rearMinH = 9.5;
  let livingH = H - frontH - serviceH - rearMinH;
  if (livingH > 16) livingH = 16;
  if (livingH < 12) livingH = 12;

  const lY = currentY - livingH;

  addRoom('LIVING ROOM', 0, lY, W, livingH, {
    entryZone: true,
    publicCore: true,
    parkingAdjacent: true,
    behindParking: true,
    doors: [
      {
        id: 'living_entry_passage',
        wall: 'TOP',
        widthFeet: 3.5,
        offsetFeet: Math.max(1, W - ctW - 3.5 + 1.75),
        doorType: 'MAIN',
        isDoubleLeaf: true,
        renderSymbol: true,
      },
      {
        id: 'shared-parking-living',
        wall: 'BOTTOM',
        widthFeet: 3.5,
        offsetFeet: Math.max(1, (W - 3.5) / 2),
        doorType: 'MAIN',
        isDoubleLeaf: true,
        renderSymbol: true,
        swingDirection: 'INWARDS',
        entryRole: 'MAIN_PARKING_TO_LIVING_DOOR',
        sharedOpeningId: 'shared-parking-living',
      },
    ],
  });
  currentY = lY;

  if (stairEmbeddedInLiving) {
    const living = rooms[rooms.length - 1];
    const stairType = stairSpec.staircaseType;

    const requiredW = stairSpec.requiredWidthFt || 5.5;
    const requiredH = stairSpec.requiredLengthFt || 9.5;

    const availableW = Math.max(3, living.w! - 3.5);
    const availableH = Math.max(6, living.h! - 3);

    const sW = Math.min(requiredW, availableW);
    const sH = Math.min(requiredH, availableH);

    if (sW >= 3 && sH >= 6) {
      const existingDoors: any[] = [];
      const placement = chooseStaircaseCorner(living, sW, sH, rooms, existingDoors, stairType);

      if (placement) {
        (living as any).embeddedStair = buildEmbeddedStairMetadata({
          placement,
          sW, sH,
          stairType,
          stairSpec,
          source: 'GROUND_FLOOR_LIVING',
        });
      }
    }
  }

  const rearH = Math.max(rearMinH, currentY);
  const primaryBedroomKey: string = bedrooms[0] || 'BEDROOM';

  if (primaryBedroomKey === 'MASTER BEDROOM') {
    const attachedW = (hasAttached && W >= 15) ? 5 : 0;
    const masterW = W - attachedW;
    const masterDoorOffset = Math.max(1, W - ctW - 3.5 + 1.75);

    addRoom('MASTER BEDROOM', 0, 0, masterW, rearH, {
      privateZone: true,
      furnitureValidated: true,
      doors: [
        {
          id: 'shared-bedroom-passage',
          wall: 'TOP',
          widthFeet: 3.0,
          offsetFeet: Math.max(1, masterW - 3.5),
          doorType: 'INTERNAL',
          renderSymbol: true,
          sharedOpeningId: 'shared-bedroom-passage',
          swingInside: true,
        },
      ],
    });

    const master = rooms[rooms.length - 1];

    if (attachedW > 0) {
      addRoom('ATTACHED TOILET',
        (master.x || 0) + masterW,
        0,
        attachedW,
        rearH,
        {
          attachedTo: master.id,
          subZoneOf: master.id,
          isSubRoom: true,
          serviceCore: true,
          ventilationRequired: true,
          orientation: 'VERTICAL',
          placementRule: 'MASTER_WIDE_VERTICAL',
          doors: [
            {
              id: 'att_door_master',
              wall: 'LEFT',
              widthFeet: 2.5,
              offsetFeet: rearH / 2 - 1.25,
              doorType: 'TOILET',
              renderSymbol: true,
              swingInside: true,
            },
          ],
        });
    } else if (hasAttached && W < 15) {
      const aw = Math.min(10, W * 0.7);
      const ah = 4.5;
      addRoom('ATTACHED TOILET', 0, 0, aw, ah, {
        attachedTo: master.id,
        subZoneOf: master.id,
        isSubRoom: true,
        serviceCore: true,
        ventilationRequired: true,
        orientation: 'HORIZONTAL',
        placementRule: 'MASTER_NARROW_HORIZONTAL',
        doors: [
          {
            id: 'att_door_master',
            wall: 'TOP',
            widthFeet: 2.5,
            offsetFeet: aw / 2 - 1.25,
            doorType: 'TOILET',
            renderSymbol: true,
            swingInside: true,
          },
        ],
      });
    }
  } else {
    const bedDoorOffset = Math.max(1, W - ctW - 3.5 + 1.75);

    addRoom(primaryBedroomKey, 0, 0, W, rearH, {
      privateZone: true,
      furnitureValidated: true,
      doors: [
        {
          id: 'bed_door_corridor',
          wall: 'BOTTOM',
          widthFeet: 3.0,
          offsetFeet: bedDoorOffset - 1.5,
          doorType: 'INTERNAL',
          renderSymbol: true,
        },
      ],
    });
  }

  // ✅ FIX: Use preserveDoorsAfterWetCore instead of optimizeWetCore
  return preserveDoorsAfterWetCore(rooms);
}

// ============================================================
// 19. MAIN LAYOUT BUILDER
// ============================================================
export function buildResidentialLayout(
  program: string[],
  specs: RoomSpec[],
  W: number,
  H: number,
  ground: boolean,
  stairSpec: ReturnType<typeof calculateStaircase>,
  parkingMode: ParkingMode = 'CAR',
  strategy?: CandidateStrategy,
  groundStairPosition?: { x: number; y: number; w?: number; h?: number },
  groundStairRelativeOffset?: { dx: number; dy: number },
  isTower: boolean = false,
): FloorRoom[] {
  void strategy;

  const rooms: FloorRoom[] = [];
  let id = 0;

  const addRoom = (
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    extras: any = {},
  ) => {
    let finalX = Math.max(0, x);
    let finalY = Math.max(0, y);
    let finalW = Math.min(w, W - finalX);
    let finalH = Math.min(h, H - finalY);

    if (finalW <= 0.5 || finalH <= 0.5) {
      console.warn(`[ADD ROOM] ${key} REJECTED → too small`, { finalW, finalH });
      return;
    }

    const spec = extras.dimensionsFitted ? undefined : specs.find(s => s.key === key);
    const inputW = spec?.width || spec?.w;
    const inputL = spec?.length || spec?.h;
    if (inputW && inputW > 0) finalW = Math.min(inputW, W - finalX);
    if (inputL && inputL > 0) finalH = Math.min(inputL, H - finalY);

    const isSubRoom = extras.isSubRoom || extras.subZoneOf;
    const MAX_TRIES = 40;
    let tries = 0;
    let collides = true;

    while (collides && tries < MAX_TRIES) {
      collides = false;
      for (const other of rooms) {
        if (isSubRoom) continue;
        if ((other as any).isSubRoom) continue;
        if ((other as any).subZoneOf) continue;

        const oR = (other.x || 0) + (other.w || 0);
        const oB = (other.y || 0) + (other.h || 0);
        const rR = finalX + finalW;
        const rB = finalY + finalH;

        const overlapX = Math.min(rR, oR) - Math.max(finalX, other.x || 0);
        const overlapY = Math.min(rB, oB) - Math.max(finalY, other.y || 0);

        if (overlapX > 0.05 && overlapY > 0.05) {
          collides = true;
          if (overlapY < overlapX && finalH - overlapY > 2) {
            finalH -= overlapY;
          } else if (finalW - overlapX > 2) {
            finalW -= overlapX;
          } else {
            finalY += overlapY;
          }
          if (finalW <= 0.5 || finalH <= 0.5) return;
          break;
        }
      }
      tries++;
    }

    if (finalW > 0.5 && finalH > 0.5) {
      rooms.push(makeRoom(key, id++, finalX, finalY, finalW, finalH, extras));
    }
  };

  const counts = roomCounts(program);
  const has = (k: string) => (counts[k] || 0) > 0;

  const bedrooms = program.filter(k =>
    k === 'MASTER BEDROOM' ||
    k === 'BEDROOM' ||
    k === 'FRONT BEDROOM' ||
    k === 'REAR BEDROOM'
  );

  const hasParking = ground && has('PARKING');
  const hasLiving = has('LIVING ROOM');
  const hasKitchen = has('KITCHEN');
  const hasKD = has('KITCHEN CUM DINING');
  const hasDining = has('DINING');
  const hasStair = has('STAIRCASE');
  const bathroomCount = counts['BATHROOM'] || 0;
  const commonToiletCount = Math.max(counts['COMMON TOILET'] || 0, bathroomCount);
  const hasCommon = commonToiletCount > 0;

  const hasAttached = has('ATTACHED TOILET') || has('FRONT ATTACHED BATH') || has('REAR ATTACHED BATH');

  const needsPassage = bedrooms.length > 1 ||
    (bedrooms.length >= 1 && (hasKitchen || hasKD || hasCommon || hasLiving));

  const hasLivingStairCombo = specs.some(s => s.key === 'STAIRCASE' && s.embedIn === 'LIVING ROOM');
  const stairEmbeddedInLiving = !isTower && hasLiving && (hasLivingStairCombo || hasStair);

  console.log('[BUILD RESIDENTIAL LAYOUT] FLAGS', {
    hasParking, hasLiving, hasKitchen, hasKD, hasDining, hasStair,
    hasCommon, hasAttached, needsPassage,
    hasLivingStairCombo,
    stairEmbeddedInLiving, isTower,
    bedrooms,
  });

  const stairSpecFromInput = specs.find(s => s.key === 'STAIRCASE');
  const inputStairW = Number(stairSpecFromInput?.width || stairSpecFromInput?.w) || 0;
  const inputStairH = Number(stairSpecFromInput?.length || stairSpecFromInput?.h) || 0;
  const inputStairPosition = (stairSpecFromInput as any)?.position || 'TOP-RIGHT';
  const inputStairInheritedX = Number((stairSpecFromInput as any)?.inheritedX);
  const inputStairInheritedY = Number((stairSpecFromInput as any)?.inheritedY);
  const userInheritedX = Number.isFinite(inputStairInheritedX) ? inputStairInheritedX : null;
  const userInheritedY = Number.isFinite(inputStairInheritedY) ? inputStairInheritedY : null;

  const min = (key: string) => PRACTICAL_ROOM_RULES[key] || { minWidth: 3, minDepth: 3, preferredWidth: 5, preferredDepth: 6, furniture: '' };
  const minDim = (key: string, horizontal = true) => horizontal ? min(key).minWidth : min(key).minDepth;
  const roomArea = (key: string, fallback: number) => desiredArea(specs, key, fallback);
  const fit = (key: string, area: number, maxW: number, maxH: number) => fitRectForArea(key, area, Math.max(0.1, maxW), Math.max(0.1, maxH));
  const usableW = Math.max(1, W), usableH = Math.max(1, H);

  const getSpecDim = (key: string, minW: number, minH: number, maxW: number, maxH: number): { w: number; h: number } => {
    const spec = specs.find(s => s.key === key);
    const rule = PRACTICAL_ROOM_RULES[key];
    const preferredW = Math.min(rule?.preferredWidth || 10, maxW);
    const preferredH = Math.min(rule?.preferredDepth || 12, maxH);

    const inputW = spec?.width || spec?.w;
    const inputL = spec?.length || spec?.h;

    if (inputW && inputL) return { w: Math.max(minW, Math.min(inputW, maxW)), h: Math.max(minH, Math.min(inputL, maxH)) };
    if (inputW && !inputL) return { w: Math.max(minW, Math.min(inputW, maxW)), h: Math.max(minH, preferredH) };
    if (!inputW && inputL) return { w: Math.max(minW, preferredW), h: Math.max(minH, Math.min(inputL, maxH)) };

    const area = roomArea(key, preferredW * preferredH);
    const fitted = fitRectForArea(key, area, maxW, maxH);
    return { w: Math.max(minW, fitted.w), h: Math.max(minH, fitted.h) };
  };

  const parkingDepth = hasParking ? clamp(Math.min(usableH * 0.24, 16), 10, Math.max(10, usableH - 20)) : 0;
  const frontDepth = hasParking ? Math.max(15, parkingDepth) : clamp(usableH * 0.20, 8, 12);
  const stairDepth = hasStair ? Math.max(9, stairSpec.requiredLengthFt) : 0;
  const bedroomDepths = bedrooms.map(k => clamp((roomArea(k, k === 'MASTER BEDROOM' ? 140 : 120) / Math.max(usableW, 10)), minDim(k, false), 16));
  const privateDepth = bedrooms.length ? Math.min(usableH * 0.55, Math.max(12, bedroomDepths.reduce((a, b) => a + b, 0) + (bedrooms.length > 1 ? 0.5 : 0))) : 0;
  const middleDepth = Math.max(8, usableH - frontDepth - privateDepth);

  // ==========================================================
  // ✅ UNIVERSAL GROUND FLOOR
  // ==========================================================
  if (
    ground &&
    hasParking &&
    hasLiving &&
    W >= 10 &&
    W <= 20 &&
    H >= 35 &&
    H <= 55
  ) {
    const result = buildUniversalGroundFloor(
      W, H,
      hasParking, hasLiving, hasKitchen, hasKD, hasCommon, hasAttached,
      bedrooms,
      stairSpec,
      parkingMode,
      stairEmbeddedInLiving,
      addRoom,
      rooms,
    );
    if (result) return result;
  }

  // ==========================================================
  // BRANCH 1: NARROW PLOT MASTER STRATEGY (Fallback)
  // ==========================================================
  if (ground && hasParking && W <= 24 && H >= 34) {
    console.log('[BUILD RESIDENTIAL LAYOUT] → BRANCH 1 (NARROW GROUND)');
    const parkingW = getParkingWidth(W);
    const parkingH = 8;

    const pY = H - parkingH;
    addRoom('PARKING', 0, pY, parkingW, parkingH, {
      parkingShape: 'CAR', parkingZone: 'FRONT_ROAD_CONNECTED',
      vehicleFit: true, vehicleClearanceRequired: true, parkingMode,
      entryRole: 'MAIN_ROAD_VEHICLE_GATE',
    });

    let currentY = pY;

    if (hasKitchen || hasKD) {
      const kitchenW = Math.max(4.5, W - parkingW);
      if (kitchenW >= 4.5) {
        const kitchenKey = hasKD ? 'KITCHEN CUM DINING' : 'KITCHEN';
        addRoom(kitchenKey, parkingW, pY, kitchenW, parkingH, {
          serviceZone: true, ventilationRequired: true, dimensionsFitted: true,
        });
      }
    }

    if (hasLiving) {
      // Toilet ki length badhi to utni hi living (hall) ki length kam — bedroom same rehta hai
      const ctExtraH = hasCommon ? Math.max(0, getCommonToiletOrientation(W).h - 4.5) : 0;
      const livingH = (H >= 45 ? 17 : 16) - ctExtraH;
      const lY = currentY - livingH;
      addRoom('LIVING ROOM', 0, lY, W, livingH, {
        entryZone: true, publicCore: true, parkingAdjacent: true, behindParking: true,
      });
      currentY = lY;

      if (stairEmbeddedInLiving) {
        const living = rooms[rooms.length - 1];
        const maxStairW = Math.min(living.w! * 0.5, living.w! - 3.5);
        const maxStairH = Math.min(living.h! * 0.65, living.h! - 3);

        const sDim = getSpecDim(
          'STAIRCASE',
          minDim('STAIRCASE'),
          minDim('STAIRCASE', false),
          Math.max(minDim('STAIRCASE'), maxStairW),
          Math.max(minDim('STAIRCASE', false), maxStairH),
        );

        const existingDoors: any[] = [];
        for (const r of rooms) {
          for (const d of (r.doors || [])) {
            existingDoors.push({ ...d, globalX: (r.x || 0), globalY: (r.y || 0) });
          }
        }

        const placement = chooseStaircaseCorner(living, sDim.w, sDim.h, rooms, existingDoors, stairSpec.staircaseType);

        if (placement && sDim.w <= living.w! - 0.5 && sDim.h <= living.h! - 0.5) {
          (living as any).embeddedStair = buildEmbeddedStairMetadata({
            placement,
            sW: sDim.w, sH: sDim.h,
            stairType: stairSpec.staircaseType,
            stairSpec,
            source: 'BRANCH1_LIVING',
          });
        }
      }
    }

    if (hasCommon) {
      const { w: commonW, h: serviceH, orientation } = getCommonToiletOrientation(W);
      const sY = currentY - serviceH;

      // ✅ FIX: Common toilet me sirf 1 door — passage-side wall (RIGHT) par.
      //    Bedroom-side (TOP) wall par koi toilet door render nahi hoga.
      const passageW = W - commonW;
      // Door wall ke end par (leaf wall ke saath lage), beech me nahi
      const ctDoorOffset = Math.max(0.3, serviceH - 2.5 - 0.3);
      addRoom('COMMON TOILET', 0, sY, commonW, serviceH, {
        serviceCore: true, ventilationRequired: true, dimensionsFitted: true,
        orientation: orientation === 'H' ? 'HORIZONTAL' : 'VERTICAL',
        doors: [
          {
            id: 'shared-ct-passage',
            wall: 'RIGHT',
            widthFeet: 2.5,
            offsetFeet: ctDoorOffset,
            doorType: 'TOILET',
            renderSymbol: true,
            swingInside: true,
            hingeSide: 'END',        // hinge wall ke end (bottom jamb) par
            sharedOpeningId: 'shared-ct-passage',
          },
        ],
      });

      if (passageW >= 2) {
        addRoom('PASSAGE', commonW, sY, passageW, serviceH, {
          circulationZone: true, protectedCorridor: true, corridorWidthFt: passageW,
          pinkGuideLines: true,
          connects: ['LIVING ROOM', 'KITCHEN', 'COMMON TOILET', 'MASTER BEDROOM'],
          orientation: 'HORIZONTAL_SERVICE_SPINE', accessRole: 'PRIMARY_INTERNAL_SPINE',
          isSubRoom: true,
          doors: [
            {
              id: 'shared-ct-passage',
              wall: 'LEFT',
              widthFeet: 2.5,
              offsetFeet: ctDoorOffset,
              doorType: 'TOILET',
              renderSymbol: false,   // duplicate symbol nahi — toilet wali hi draw hogi
              swingInside: false,
              sharedOpeningId: 'shared-ct-passage',
            },
          ],
        });
      }

      currentY = sY;
    }

    if (bedrooms.length >= 1) {
      const privateH = Math.max(9.5, currentY);
      const primaryBedroomKey: string = bedrooms[0] || 'BEDROOM';
      const attachedW = (primaryBedroomKey === 'MASTER BEDROOM' && hasAttached) ? 5.0 : 0;
      const masterW = Math.max(minDim(primaryBedroomKey), W - attachedW);

      // ✅ Bedroom door: passage ke andar hi (passage width se bada nahi), right wall ke paas hinge
      const bedPassageW = hasCommon ? W - getCommonToiletOrientation(W).w : 0;
      const bedDoorW = bedPassageW >= 2 ? Math.min(3.0, bedPassageW) : 3.0;
      const bedDoorOffset = bedPassageW >= 2 ? Math.max(0, W - bedDoorW) : Math.max(1, masterW - 3.5);
      addRoom(primaryBedroomKey, 0, 0, masterW, privateH, {
        privateZone: true, furnitureValidated: true,
        doors: [
          {
            id: 'shared-bedroom-passage',
            wall: 'BOTTOM',
            widthFeet: bedDoorW,
            offsetFeet: bedDoorOffset,
            doorType: 'INTERNAL',
            renderSymbol: true,
            swingInside: true,
            hingeSide: 'END',        // hinge right wall ki taraf
            sharedOpeningId: 'shared-bedroom-passage',
          },
        ],
      });
      const masterIndex = rooms.length - 1;

      if (attachedW > 0) {
        const master = rooms[masterIndex];
        const mW = master.w || 0;
        const mH = master.h || 0;
        const orientation = getAttachedToiletOrientation(mW, mH);

        addRoom('ATTACHED TOILET',
          (master.x || 0) + orientation.x,
          (master.y || 0) + orientation.y,
          orientation.w, orientation.h,
          {
            attachedTo: master.id, subZoneOf: master.id, isSubRoom: true,
            serviceCore: true, ventilationRequired: true,
            orientation: orientation.orientation === 'V' ? 'VERTICAL' : 'HORIZONTAL',
          });
      }
    }

    // ✅ FIX: preserveDoorsAfterWetCore
    return preserveDoorsAfterWetCore(rooms);
  }

  // ==========================================================
  // BRANCH 2: PRIMARY ZONING (fallback)
  // ==========================================================
  if (ground && hasLiving && hasStair && hasParking && W >= 13.0 && H >= 34.0) {
    console.log('[BUILD RESIDENTIAL LAYOUT] → BRANCH 2 (PRIMARY ZONING)');
    const parkingMinimum = selectParkingCandidate(W, H, parkingDepth || 15, parkingMode);
    const carLike = parkingMode === 'CAR' || parkingMode === 'CAR_BIKE_PEDESTRIAN';
    const parkingDepthActual = Math.min(H * 0.4, Math.max(10, parkingMinimum.depth));
    const passageW = needsPassage ? 3.25 : 0;
    const livingMinW = (ground && (usableW * usableH) <= 1000) ? 9.0 : min('LIVING ROOM').minWidth;

    let frontY = H - parkingDepthActual;
    let parking: any = null;
    let living: any = null;

    if (ground && hasParking && W >= parkingMinimum.width + livingMinW + 0.5) {
      const parkingW = Math.min(parkingMinimum.width, W - livingMinW - 0.5);
      parking = { ...parkingMinimum, x: W - parkingW, y: frontY, w: parkingW, h: parkingDepthActual };
      addRoom('PARKING', parking.x, parking.y, parking.w, parking.h, {
        parkingShape: parking.shape || parking.type,
        parkingZone: 'FRONT_ROAD_CONNECTED', vehicleFit: parking.vehicleFit,
        candidateScore: parking.score, vehicleClearanceRequired: carLike,
        parkingMode, bikeZone: parking.bikeZone, pedestrianZone: parking.pedestrianZone,
        entryRole: 'MAIN_ROAD_VEHICLE_GATE',
      });
      const livingW = W - parkingW;
      living = { x: 0, y: frontY, w: livingW, h: parkingDepthActual };
      addRoom('LIVING ROOM', living.x, living.y, living.w, living.h, {
        entryZone: true, publicCore: true, parkingAdjacent: true, parkingFirstAccess: true,
      });
    } else if (ground && hasParking) {
      const parkingW = Math.min(W, Math.max(parkingMinimum.width, W));
      parking = { ...parkingMinimum, x: 0, y: H - parkingDepthActual, w: parkingW, h: parkingDepthActual };
      addRoom('PARKING', 0, parking.y, parking.w, parking.h, {
        parkingShape: parking.shape || parking.type, parkingZone: 'FRONT_ROAD_CONNECTED',
        vehicleFit: parking.vehicleFit, candidateScore: parking.score,
        vehicleClearanceRequired: carLike, parkingMode, bikeZone: parking.bikeZone,
        pedestrianZone: parking.pedestrianZone, entryRole: 'MAIN_ROAD_VEHICLE_GATE',
      });
      const livingH = Math.min(10, Math.max(8.5, roomArea('LIVING ROOM', 120) / Math.max(1, W)));
      frontY = H - parkingDepthActual - livingH;
      living = { x: 0, y: frontY, w: W, h: livingH };
      if (living.h >= livingMinW) addRoom('LIVING ROOM', living.x, living.y, living.w, living.h, {
        entryZone: true, publicCore: true, parkingAdjacent: true, parkingFirstAccess: true, behindParking: true,
      });
    } else {
      const livingH = Math.min(10, Math.max(8.5, roomArea('LIVING ROOM', 120) / Math.max(1, W - passageW)));
      frontY = H - livingH;
      addRoom('LIVING ROOM', passageW, frontY, Math.max(7, W - passageW), livingH, {
        entryZone: true, publicCore: true, upperFloorLiving: true,
      });
    }

    const livingRoom = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
    const stairW = Math.min(6, Math.max(5.5, stairSpec.requiredWidthFt || 5.5));
    const stairH = Math.min(Math.max(7.5, stairSpec.requiredLengthFt || 8), Math.max(7.5, livingRoom?.h || 8.5));

    if (livingRoom && stairW <= livingRoom.w - 0.4 && stairH <= livingRoom.h) {
      const existingDoors: any[] = [];
      for (const r of rooms) {
        for (const d of (r.doors || [])) {
          existingDoors.push({ ...d, globalX: (r.x || 0), globalY: (r.y || 0) });
        }
      }
      const placement = chooseStaircaseCorner(livingRoom, stairW, stairH, rooms, existingDoors, stairSpec.staircaseType);
      if (placement) {
        (livingRoom as any).embeddedStair = buildEmbeddedStairMetadata({
          placement,
          sW: stairW, sH: stairH,
          stairType: stairSpec.staircaseType,
          stairSpec,
          source: 'BRANCH2_LIVING',
        });
      }
    }

    // ✅ FIX: preserveDoorsAfterWetCore
    return preserveDoorsAfterWetCore(rooms);
  }

  // ==========================================================
  // BRANCH 3: UPPER-FLOOR — BUNGALOW LAYOUT
  // ==========================================================
  if (!hasParking && (hasStair || stairEmbeddedInLiving) && bedrooms.length >= 1 && W >= 10 && H >= 34) {
    console.log('[BUILD RESIDENTIAL LAYOUT] → BRANCH 3 (UPPER BUNGALOW)');
    let groundLivingY: number | null = null;
    if (groundStairPosition && groundStairRelativeOffset) {
      groundLivingY = (groundStairPosition.y || 0) - (groundStairRelativeOffset.dy || 0);
    }

    const frontBedH = Math.max(10, Math.min(15, (H - 16) * 0.4));
    const minLivingH = 16;

    const frontBedY = 0;
    const livingY = frontBedH;

    const frontBedKey = bedrooms.find(k => k === 'MASTER BEDROOM') || bedrooms.find(k => k === 'FRONT BEDROOM') || bedrooms[0];
    const frontAttachedW = hasAttached ? 5.0 : 0;
    const frontBedWidth = W - frontAttachedW;

    addRoom(frontBedKey, 0, frontBedY, frontBedWidth, frontBedH, {
      privateZone: true, furnitureValidated: true,
      placementZone: 'FRONT_BUNGALOW',
      requestedArea: roomArea(frontBedKey, 140),
    });
    const frontBed = rooms[rooms.length - 1];

    if (hasAttached && frontAttachedW > 0) {
      const mW = frontBed.w || 0;
      const mH = frontBed.h || 0;
      const orientation = getAttachedToiletOrientation(mW, mH);
      addRoom('ATTACHED TOILET',
        (frontBed.x || 0) + orientation.x,
        (frontBed.y || 0) + orientation.y,
        orientation.w, orientation.h,
        {
          attachedTo: frontBed.id, subZoneOf: frontBed.id,
          isSubRoom: true, serviceCore: true, ventilationRequired: true,
          orientation: orientation.orientation === 'V' ? 'VERTICAL' : 'HORIZONTAL',
          placementRule: 'BUNGALOW_FRONT_ATTACHED',
        });
    }

    let finalLivingY = livingY;
    let alignmentRule = 'BUNGALOW_MIDDLE';

    if (groundLivingY !== null && Number.isFinite(groundLivingY)) {
      const maxAllowed = Math.max(0, H - minLivingH);
      if (groundLivingY <= maxAllowed && groundLivingY >= frontBedH) {
        finalLivingY = groundLivingY;
        alignmentRule = 'GROUND_ALIGNED_EXACT';
      } else if (groundLivingY > maxAllowed) {
        finalLivingY = maxAllowed;
        alignmentRule = 'GROUND_ALIGNED_CLAMPED';
      }
    }

    addRoom('LIVING ROOM', 0, finalLivingY, W, minLivingH, {
      publicCore: true, upperFloorLiving: true,
      alignmentRule,
      placementZone: 'MIDDLE_LIVING',
      fullWidth: true,
    });
    const livingRoom = rooms[rooms.length - 1];

    const groundStairW = groundStairPosition && (groundStairPosition as any).w
      ? Number((groundStairPosition as any).w) : 0;
    const groundStairH = groundStairPosition && (groundStairPosition as any).h
      ? Number((groundStairPosition as any).h) : 0;

    const groundStairType = stairSpec.staircaseType;

    let stairW = groundStairW;
    let stairH = groundStairH;

    if (!stairW || !stairH) {
      if (groundStairType === 'DOG_LEGGED') { stairW = 8; stairH = 6.5; }
      else if (groundStairType === 'L_SHAPED') { stairW = 6; stairH = 8; }
      else if (groundStairType === '2_QUARTER_WINDER') { stairW = 5.5; stairH = 9; }
      else if (groundStairType === '2_QUARTER_LANDING') { stairW = 6; stairH = 9.5; }
      else { stairW = 5.5; stairH = 9; }
    }

    stairW = Math.min(stairW, livingRoom.w! - 0.25);
    stairH = Math.min(stairH, minLivingH);

    if (livingRoom && stairW <= livingRoom.w - 0.25) {
      const resolved = resolveInheritedStairPosition({
        livingX: livingRoom.x || 0, livingY: livingRoom.y || 0,
        livingW: livingRoom.w || 0, livingH: livingRoom.h || 0,
        stairW, stairH,
        userInheritedX, userInheritedY,
        groundStairPosition, groundStairRelativeOffset,
        fallbackPosition: inputStairPosition,
      });

      const stairX = resolved.x;
      const stairY = resolved.y;
      const stairPlacementRule = resolved.rule;

      (livingRoom as any).embeddedStair = buildEmbeddedStairMetadata({
        placement: {
          corner: 'TOP-RIGHT',
          x: stairX,
          y: stairY,
          relativeX: stairX - (livingRoom.x || 0),
          relativeY: stairY - (livingRoom.y || 0),
        },
        sW: stairW,
        sH: stairH,
        stairType: groundStairType,
        stairSpec,
        source: `UPPER_FLOOR_${stairPlacementRule}`,
      });
    }

    const rearBedKey = bedrooms.length > 1
      ? (bedrooms.find((k, i) => i > 0) || bedrooms[1] || bedrooms[0])
      : frontBedKey;

    const rearBedYFinal = finalLivingY + minLivingH + 0.1;
    const rearBedHFinal = Math.max(9.5, H - rearBedYFinal);

    if (rearBedHFinal >= 9.5) {
      addRoom(rearBedKey, 0, rearBedYFinal, W, rearBedHFinal, {
        privateZone: true, furnitureValidated: true,
        placementZone: 'REAR_BUNGALOW',
        requestedArea: roomArea(rearBedKey, 140),
      });
      const rearBed = rooms[rooms.length - 1];

      if (hasAttached) {
        const mW = rearBed.w || 0;
        const mH = rearBed.h || 0;
        const orientation = getAttachedToiletOrientation(mW, mH);
        addRoom('ATTACHED TOILET',
          (rearBed.x || 0) + orientation.x,
          (rearBed.y || 0) + orientation.y,
          orientation.w, orientation.h,
          {
            attachedTo: rearBed.id, subZoneOf: rearBed.id,
            isSubRoom: true, serviceCore: true, ventilationRequired: true,
            orientation: orientation.orientation === 'V' ? 'VERTICAL' : 'HORIZONTAL',
            placementRule: 'BUNGALOW_REAR_ATTACHED',
          });
      }
    }

    // ✅ FIX: preserveDoorsAfterWetCore
    return preserveDoorsAfterWetCore(rooms);
  }

  // ==========================================================
  // BRANCH 4: UPPER-FLOOR NO-PARKING (W >= 17)
  // ==========================================================
  if (!hasParking && hasLiving && hasStair && W >= 17.0 && H >= 35.0) {
    console.log('[BUILD RESIDENTIAL LAYOUT] → BRANCH 4 (UPPER NO-PARKING)');
    let groundLivingY: number | null = null;
    if (groundStairPosition && groundStairRelativeOffset) {
      groundLivingY = (groundStairPosition.y || 0) - (groundStairRelativeOffset.dy || 0);
    }

    const frontBedH = Math.max(10, Math.min(15, (H - 16) * 0.4));
    const minLivingH = 16;

    const frontBedY = 0;
    let livingY = frontBedH;

    const frontBedKey = bedrooms.find(k => k === 'MASTER BEDROOM') || bedrooms.find(k => k === 'FRONT BEDROOM') || bedrooms[0];
    const frontAttachedW = hasAttached ? 5.0 : 0;
    const frontBedWidth = W - frontAttachedW;

    addRoom(frontBedKey, 0, frontBedY, frontBedWidth, frontBedH, {
      privateZone: true, furnitureValidated: true,
      placementZone: 'FRONT_BUNGALOW',
      requestedArea: roomArea(frontBedKey, 140),
    });
    const frontBed = rooms[rooms.length - 1];

    if (hasAttached) {
      const mW = frontBed.w || 0;
      const mH = frontBed.h || 0;
      const orientation = getAttachedToiletOrientation(mW, mH);
      addRoom('ATTACHED TOILET',
        (frontBed.x || 0) + orientation.x,
        (frontBed.y || 0) + orientation.y,
        orientation.w, orientation.h,
        {
          attachedTo: frontBed.id, subZoneOf: frontBed.id,
          isSubRoom: true, serviceCore: true, ventilationRequired: true,
          orientation: orientation.orientation === 'V' ? 'VERTICAL' : 'HORIZONTAL',
          placementRule: 'BUNGALOW_FRONT_ATTACHED',
        });
    }

    let alignmentRule = 'BUNGALOW_MIDDLE';
    if (groundLivingY !== null && Number.isFinite(groundLivingY)) {
      const maxAllowed = Math.max(0, H - minLivingH);
      if (groundLivingY <= maxAllowed && groundLivingY >= frontBedH) {
        livingY = groundLivingY;
        alignmentRule = 'GROUND_ALIGNED_EXACT';
      } else if (groundLivingY > maxAllowed) {
        livingY = maxAllowed;
        alignmentRule = 'GROUND_ALIGNED_CLAMPED';
      }
    }

    addRoom('LIVING ROOM', 0, livingY, W, minLivingH, {
      publicCore: true, upperFloorLiving: true,
      alignmentRule, placementZone: 'MIDDLE_LIVING', fullWidth: true,
    });
    const livingRoom = rooms[rooms.length - 1];

    const groundStairW4 = groundStairPosition && (groundStairPosition as any).w
      ? Number((groundStairPosition as any).w) : 0;
    const groundStairH4 = groundStairPosition && (groundStairPosition as any).h
      ? Number((groundStairPosition as any).h) : 0;

    const stairW = groundStairW4 > 0 ? groundStairW4
      : Math.min(6, Math.max(5.5, stairSpec.requiredWidthFt || 5.5));
    const stairH = groundStairH4 > 0 ? Math.min(groundStairH4, minLivingH)
      : Math.min(minLivingH, Math.max(7.5, stairSpec.requiredLengthFt || 8));

    if (livingRoom) {
      const resolved = resolveInheritedStairPosition({
        livingX: livingRoom.x || 0, livingY: livingRoom.y || 0,
        livingW: livingRoom.w || 0, livingH: livingRoom.h || 0,
        stairW, stairH,
        userInheritedX, userInheritedY,
        groundStairPosition, groundStairRelativeOffset,
        fallbackPosition: inputStairPosition,
      });

      const stairX = resolved.x;
      const stairY = resolved.y;
      const stairPlacementRule = resolved.rule;

      (livingRoom as any).embeddedStair = buildEmbeddedStairMetadata({
        placement: {
          corner: 'TOP-RIGHT',
          x: stairX, y: stairY,
          relativeX: stairX - (livingRoom.x || 0),
          relativeY: stairY - (livingRoom.y || 0),
        },
        sW: stairW, sH: stairH,
        stairType: stairSpec.staircaseType,
        stairSpec,
        source: `UPPER_NO_PARKING_${stairPlacementRule}`,
      });
    }

    const rearBedKey = bedrooms.length > 1
      ? (bedrooms.find((k, i) => i > 0) || bedrooms[1] || bedrooms[0])
      : frontBedKey;

    const rearBedYFinal = livingY + minLivingH + 0.1;
    const rearBedHFinal = Math.max(10, H - rearBedYFinal);

    if (rearBedHFinal >= 9.5) {
      addRoom(rearBedKey, 0, rearBedYFinal, W, rearBedHFinal, {
        privateZone: true, furnitureValidated: true,
        placementZone: 'REAR_BUNGALOW',
        requestedArea: roomArea(rearBedKey, 140),
      });
      const rearBed = rooms[rooms.length - 1];

      if (hasAttached) {
        const mW = rearBed.w || 0;
        const mH = rearBed.h || 0;
        const orientation = getAttachedToiletOrientation(mW, mH);
        addRoom('ATTACHED TOILET',
          (rearBed.x || 0) + orientation.x,
          (rearBed.y || 0) + orientation.y,
          orientation.w, orientation.h,
          {
            attachedTo: rearBed.id, subZoneOf: rearBed.id,
            isSubRoom: true, serviceCore: true, ventilationRequired: true,
            orientation: orientation.orientation === 'V' ? 'VERTICAL' : 'HORIZONTAL',
            placementRule: 'BUNGALOW_REAR_ATTACHED',
          });
      }
    }

    // ✅ FIX: preserveDoorsAfterWetCore
    return preserveDoorsAfterWetCore(rooms);
  }

  console.warn('[BUILD RESIDENTIAL LAYOUT] ⚠️ NO BRANCH MATCHED — returning rooms as-is', {
    ground, hasParking, hasLiving, hasStair, W, H,
  });
  // ✅ FIX: preserveDoorsAfterWetCore
  return preserveDoorsAfterWetCore(rooms);
}

// ============================================================
// HELPERS
// ============================================================
function findFreeRectangle(rooms: FloorRoom[], W: number, H: number, rw: number, rh: number, yMin = 0, yMax = H): { x: number; y: number } | null {
  const step = 0.5;
  for (let y = Math.max(0, yMin); y + rh <= Math.min(H, yMax) + 0.01; y += step) {
    for (let x = 0; x + rw <= W + 0.01; x += step) {
      const collides = rooms.some(r => {
        if ((r as any).subZoneOf || (r as any).isSubRoom) return false;
        return Math.min((r.x || 0) + (r.w || 0), x + rw) > Math.max(r.x || 0, x) + 0.05 &&
          Math.min((r.y || 0) + (r.h || 0), y + rh) > Math.max(r.y || 0, y) + 0.05;
      });
      if (!collides) return { x, y };
    }
  }
  return null;
}

function validateFurniture(room: FloorRoom): { ok: boolean; note: string } {
  const key = canonical(room.name);
  const rule = PRACTICAL_ROOM_RULES[key];
  if (!rule) return { ok: true, note: 'No furniture-specific rule.' };
  const minDim = Math.min(room.w || 0, room.h || 0);
  const requiredMin = Math.min(rule.minWidth, rule.minDepth);
  if (minDim < requiredMin) return { ok: false, note: `${key} is ${room.w?.toFixed(2)}' × ${room.h?.toFixed(2)}'; furniture/circulation minimum is constrained.` };
  const ratio = Math.max(room.w || 0, room.h || 0) / Math.max(0.1, minDim);
  if (ratio > 2.6 && !['PASSAGE', 'DUCT'].includes(key)) return { ok: false, note: `${key} aspect ratio ${ratio.toFixed(2)}:1 is too elongated for practical furniture placement.` };
  return { ok: true, note: `${rule.furniture}; clear circulation assumed and checked.` };
}

// ============================================================
// 24. MAIN ENTRY
// ============================================================
export function generateArchitecturalFloorPlan(request: ArchitecturalPlanRequest): ArchitecturalPlanResult {
  console.groupCollapsed('[GENERATE ARCHITECTURAL FLOOR PLAN] START');
  console.log('REQUEST:', request);

  const W = Math.max(1, n(request.width, 20));
  const H = Math.max(1, n(request.length, 40));
  const floorName = clean(request.floorName);
  const ground = floorName.includes('GROUND');
  const isTower = floorName.includes('TOWER') || floorName.includes('MUMTY');
  const mode = clean(request.planningMode || 'AUTO');
  const area = n(request.planningArea, W * H);
  const orientation = getRoadOrientation(request.roadSide || '1 SIDE ROAD (SOUTH)');
  const specs = extractSpecs(request.selectedRooms);

  console.log('[GENERATE] INPUTS', {
    W, H, floorName, ground, isTower, mode, area,
    specs,
  });

  const program = programFromInput(
    request.selectedRooms,
    request.bhk || 'AUTO',
    area,
    ground,
    mode,
    W,
    H,
    request.groundFloorProgram,
  );

  console.log('[GENERATE] PROGRAM', program);

  if (specs.length === 0 && ground && program.includes('LIVING ROOM') && program.includes('STAIRCASE')) {
    specs.push({ key: 'STAIRCASE', count: 1, areaMode: 'AUTO', embedIn: 'LIVING ROOM' } as any);
  }

  const stairType = chooseStairType(W, H);

  let livingRoomWidth = W;
  let livingRoomLength = 0;

  if (ground) {
    const frontH = 8;
    const serviceH = W >= 13 ? 5 : 4.5;
    const rearMinH = 9.5;
    livingRoomLength = Math.max(12, Math.min(16, H - frontH - serviceH - rearMinH));
  } else {
    livingRoomLength = 16;
  }

  const commonToiletSpec = specs.find(s => s.key === 'COMMON TOILET');
  const commonToiletLength = commonToiletSpec?.length || commonToiletSpec?.h || 4.5;

  const availableStairWidth = Math.min(6.5, livingRoomWidth * 0.6);
  const availableStairLength = Math.min(16, livingRoomLength * 0.8);

  const staircase = calculateStaircase(
    n(request.floorToFloorHeightFeet, 10),
    availableStairWidth,
    availableStairLength,
    stairType,
    7, 11, 3.0
  );

  const parkingMode = (String(request.parkingMode || 'CAR').toUpperCase() as ParkingMode);

  const groundStairPosition = ground ? undefined : request.groundStairPosition;
  const groundStairRelativeOffset = ground ? undefined : request.groundStairRelativeOffset;

  const rawRooms = buildResidentialLayout(
    program, specs, W, H, ground,
    staircase, parkingMode, undefined,
    groundStairPosition,
    groundStairRelativeOffset,
    isTower,
  );

  const rooms = rawRooms;

  console.log('[GENERATE] ROOMS GENERATED', {
    count: rooms.length,
    names: rooms.map(r => r.name),
    embeddedStairPresent: !!(rooms.find(r => canonical(r.name) === 'LIVING ROOM') as any)?.embeddedStair,
    staircaseRoomPresent: rooms.some(r => canonical(r.name) === 'STAIRCASE'),
  });

  const warnings: string[] = [];
  const errors: string[] = [];
  const furnitureChecks: ArchitecturalPlanResult['furnitureChecks'] = [];

  const requestedCounts = roomCounts(program);
  const presentCounts = roomCounts(rooms.map(r => canonical(r.name)));

  const livingRoom = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
  const hasEmbeddedStair = !!(livingRoom as any)?.embeddedStair;
  if (hasEmbeddedStair && !presentCounts['STAIRCASE']) {
    presentCounts['STAIRCASE'] = 1;
  }

  for (const [key, wanted] of Object.entries(requestedCounts)) {
    const got = key === 'BATHROOM'
      ? (presentCounts['BATHROOM'] || 0) + (presentCounts['ATTACHED TOILET'] || 0)
      : (presentCounts[key] || 0);
    if (got < wanted) errors.push(`${floorName}: REQUIRED ROOM MISSING → ${key}. Requested ${wanted}, generated ${got}.`);
  }

  for (const room of rooms) {
    const x = n(room.x), y = n(room.y), w = n(room.w), h = n(room.h);
    if (x < -0.01 || y < -0.01 || x + w > W + 0.01 || y + h > H + 0.01) {
      warnings.push(`${floorName}: ${room.name} exceeds planning boundary.`);
    }
    const fit = validateFurniture(room);
    furnitureChecks.push({ room: room.name || 'ROOM', ok: fit.ok, note: fit.note });
    if (!fit.ok) warnings.push(`${floorName}: ${fit.note}`);
  }

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if ((rooms[i] as any).subZoneOf === rooms[j].id || (rooms[j] as any).subZoneOf === rooms[i].id) continue;
      if ((rooms[i] as any).isSubRoom || (rooms[j] as any).isSubRoom) continue;
      if (overlap(rooms[i], rooms[j])) warnings.push(`${floorName}: SPATIAL OVERLAP → ${rooms[i].name} / ${rooms[j].name}.`);
    }
  }

  let score = 100;
  score -= errors.length * 15;
  score -= furnitureChecks.filter(x => !x.ok).length * 3;
  score = Math.max(0, score);

  console.log('[GENERATE] RESULT', {
    roomCount: rooms.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    score,
    errors,
    warnings,
  });
  console.groupEnd();

  return {
    rooms,
    warnings: Array.from(new Set(warnings)),
    errors: Array.from(new Set(errors)),
    score,
    furnitureChecks,
    stairType,
    staircase,
    orientation,
  };
}

// ============================================================
// 25. HELPER — Extract stair position
// ============================================================
export function extractStairPositionFromResult(
  result: ArchitecturalPlanResult,
): {
  x: number; y: number; w: number; h: number;
  livingRoom: { x: number; y: number; w: number; h: number } | null;
  relativeOffset: { dx: number; dy: number } | null;
} | null {
  const livingRoom = result.rooms.find(r => canonical(r.name) === 'LIVING ROOM');
  const embeddedStair = (livingRoom as any)?.embeddedStair;

  if (embeddedStair) {
    return {
      x: embeddedStair.absX || (livingRoom!.x || 0) + (embeddedStair.relX || 0),
      y: embeddedStair.absY || (livingRoom!.y || 0) + (embeddedStair.relY || 0),
      w: embeddedStair.w || 0,
      h: embeddedStair.h || 0,
      livingRoom: livingRoom ? {
        x: livingRoom.x || 0, y: livingRoom.y || 0,
        w: livingRoom.w || 0, h: livingRoom.h || 0,
      } : null,
      relativeOffset: {
        dx: embeddedStair.relX || 0,
        dy: embeddedStair.relY || 0,
      },
    };
  }

  const stair = result.rooms.find(r => canonical(r.name) === 'STAIRCASE');
  if (!stair) return null;

  let relativeOffset: { dx: number; dy: number } | null = null;
  let livingRoomRect: { x: number; y: number; w: number; h: number } | null = null;

  if (livingRoom) {
    relativeOffset = {
      dx: (stair.x || 0) - (livingRoom.x || 0),
      dy: (stair.y || 0) - (livingRoom.y || 0),
    };
    livingRoomRect = {
      x: livingRoom.x || 0, y: livingRoom.y || 0,
      w: livingRoom.w || 0, h: livingRoom.h || 0,
    };
  }

  return {
    x: stair.x || 0, y: stair.y || 0,
    w: stair.w || 0, h: stair.h || 0,
    livingRoom: livingRoomRect, relativeOffset,
  };
}

// ============================================================
// 26. HELPER — Program for floor
// ============================================================
export function roomProgramForFloor(selectedRooms: any, bhk: string, floorArea: number, isGround: boolean, mode: string, width = 0, length = 0): string[] {
  return programFromInput(selectedRooms, bhk, floorArea, isGround, mode, width, length);
}