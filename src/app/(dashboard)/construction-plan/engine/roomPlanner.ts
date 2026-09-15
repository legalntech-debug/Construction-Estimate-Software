/* =========================================================
   CONSTRUCTION PLAN SYSTEM — SINGLE RESIDENTIAL ROOM PLANNER
   ---------------------------------------------------------
   Is file mein room placement ka pura logic hai. User diye gaye
   exact dimensions (Width/Length) ko respect kiya jata hai.
   Ye file multi-candidate strategies ko support karta hai:
   VASTU, SPACE_EFFICIENT, PRIVACY, PLUMBING, LIGHT,
   CIRCULATION, FLEXIBLE_ZONING, BALANCED.
========================================================= */

import { FloorRoom, PlanningMode, ParkingMode, CandidateStrategy } from './planningTypes';
import { BHK_PRESETS, getRoomDefinition } from './roomRules';
import { calculateStaircase, StaircaseType } from './stairPlanner';
import { getRoadOrientation } from './roadOrientation';
import { selectParkingCandidate } from './parkingPlanner';
import { optimizeWetCore } from './ductPlanner'; // ✅ NEW: Dynamic Duct Placement

// 1. Input Interface
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
}

// 2. Practical Room Rule
export interface PracticalRoomRule {
  minWidth: number;
  minDepth: number;
  preferredWidth: number;
  preferredDepth: number;
  furniture: string;
}

// 3. Result Interface
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

// 4. Internal RoomSpec
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
};

// 5. Practical Rules
export const PRACTICAL_ROOM_RULES: Record<string, PracticalRoomRule> = {
  'MASTER BEDROOM': { minWidth: 10.5, minDepth: 10.5, preferredWidth: 12, preferredDepth: 14, furniture: 'double bed + wardrobe + clear bedside access' },
  'BEDROOM': { minWidth: 9, minDepth: 9, preferredWidth: 11, preferredDepth: 12, furniture: 'bed + wardrobe + clear walking path' },
  'LIVING ROOM': { minWidth: 10, minDepth: 9, preferredWidth: 12, preferredDepth: 14, furniture: 'sofa set + TV wall + circulation' },
  'HALL': { minWidth: 9, minDepth: 9, preferredWidth: 11, preferredDepth: 13, furniture: 'seating + entry circulation' },
  'KITCHEN': { minWidth: 7, minDepth: 8, preferredWidth: 8, preferredDepth: 10, furniture: 'counter run + fridge + working aisle' },
  'KITCHEN CUM DINING': { minWidth: 9, minDepth: 9, preferredWidth: 11, preferredDepth: 12, furniture: 'kitchen counter + dining table + working aisle' },
  'DINING': { minWidth: 7, minDepth: 8, preferredWidth: 8, preferredDepth: 10, furniture: '4–6 seat dining table + circulation' },
  'POOJA ROOM': { minWidth: 4, minDepth: 5, preferredWidth: 5, preferredDepth: 6, furniture: 'altar + standing space' },
  'STUDY ROOM': { minWidth: 6, minDepth: 7, preferredWidth: 7, preferredDepth: 8, furniture: 'desk + chair + storage' },
  'COMMON TOILET': { minWidth: 4.5, minDepth: 7, preferredWidth: 5, preferredDepth: 7, furniture: 'WC + basin + required clear space' },
  'ATTACHED TOILET': { minWidth: 5, minDepth: 7, preferredWidth: 5, preferredDepth: 7, furniture: 'WC + basin + bathing clear space' },
  'BATHROOM': { minWidth: 5, minDepth: 7, preferredWidth: 5, preferredDepth: 7, furniture: 'WC + basin + bathing clear space' },
  'STAIRCASE': { minWidth: 5.5, minDepth: 8.5, preferredWidth: 6.0, preferredDepth: 10, furniture: 'two-flight stair + landing/headroom zone' },
  'PARKING': { minWidth: 9, minDepth: 10, preferredWidth: 10, preferredDepth: 12, furniture: 'car bay + door/vehicle clearance' },
  'DUCT': { minWidth: 1.5, minDepth: 4, preferredWidth: 2, preferredDepth: 6, furniture: 'ventilation/service shaft' },
  'PASSAGE': { minWidth: 3, minDepth: 6, preferredWidth: 3.25, preferredDepth: 12, furniture: 'clear circulation path' },
  'BALCONY': { minWidth: 4, minDepth: 5, preferredWidth: 5, preferredDepth: 8, furniture: 'open circulation / sit-out' },
};

// 6. Safe Number
function n(v: any, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

// 7. Clean String
function clean(s: any) { return String(s || '').trim().toUpperCase(); }

// 8. Canonical Room Name
function canonical(raw: any): string {
  const s = clean(raw);
  if ((s.includes('LIVING') || s.includes('HALL') || s.includes('DRAWING')) && s.includes('STAIR')) {
    return 'LIVING ROOM + STAIR';
  }
  if (s.includes('KITCHEN') && (s.includes('DINING') || s.includes('CUM'))) return 'KITCHEN CUM DINING';
  // FIX: Master (with attached toilet) intent check BEFORE generic MASTER
  if (s.includes('MASTER') && (s.includes('ATTACHED') || s.includes('TOILET') || s.includes('BATH'))) {
    return 'MASTER BEDROOM';
  }
  if (s.includes('MASTER')) return 'MASTER BEDROOM';
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

// Helper: detect if user selected "master with attached toilet"
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

// 9. Furniture Assumptions
function furnitureAssumptions(key: string, w: number, h: number): any[] {
  const fw = Math.max(0.1, w), fh = Math.max(0.1, h);
  if (key === 'MASTER BEDROOM' || key === 'BEDROOM') {
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

// 10. Room Maker
function makeRoom(key: string, index: number, x: number, y: number, w: number, h: number, extras: any = {}): FloorRoom {
  const roomType = key === 'LIVING ROOM' ? 'living' : key === 'PARKING' ? 'parking' : key === 'STAIRCASE' ? 'stairs' : key === 'DUCT' ? 'duct' : key.includes('TOILET') || key === 'BATHROOM' ? 'toilet' : key === 'PASSAGE' ? 'passage' : key.toLowerCase().replace(/\s+/g, '-');
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

// 11. Room Counts
function roomCounts(program: string[]) {
  const counts: Record<string, number> = {};
  for (const key of program) counts[key] = (counts[key] || 0) + 1;
  return counts;
}

// 12. Overlap Checker
function overlap(a: FloorRoom, b: FloorRoom) {
  return Math.min((a.x! + a.w!), (b.x! + b.w!)) > Math.max(a.x!, b.x!) + 0.02 &&
    Math.min((a.y! + a.h!), (b.y! + b.h!)) > Math.max(a.y!, b.y!) + 0.02;
}

// ============================================================
// 12b. Staircase Smart Placement Engine
// ============================================================
type StairCorner = 'BOTTOM-RIGHT' | 'BOTTOM-LEFT' | 'TOP-RIGHT' | 'TOP-LEFT';

function chooseStaircaseCorner(
  livingRoom: FloorRoom,
  stairW: number,
  stairH: number,
  existingRooms: FloorRoom[],
  existingDoors: any[],
  stairType: StaircaseType,
): { corner: StairCorner; x: number; y: number } | null {
  const lx = livingRoom.x || 0;
  const ly = livingRoom.y || 0;
  const lw = livingRoom.w || 0;
  const lh = livingRoom.h || 0;

  const cornerDefs: Array<{ corner: StairCorner; x: number; y: number; score: number }> = [
    { corner: 'BOTTOM-RIGHT', x: lx + lw - stairW, y: ly + lh - stairH, score: 1 },
    { corner: 'BOTTOM-LEFT', x: lx, y: ly + lh - stairH, score: 2 },
    { corner: 'TOP-RIGHT', x: lx + lw - stairW, y: ly, score: 3 },
    { corner: 'TOP-LEFT', x: lx, y: ly, score: 4 },
  ];

  const isBlockedBy = (cand: { x: number; y: number }, other: FloorRoom): boolean => {
    if (other === livingRoom) return false;
    if ((other as any).subZoneOf || (other as any).isSubRoom) return false;
    if (canonical(other.name) === 'PASSAGE') return false;
    const ox = Math.min(cand.x + stairW, (other.x || 0) + (other.w || 0)) - Math.max(cand.x, other.x || 0);
    const oy = Math.min(cand.y + stairH, (other.y || 0) + (other.h || 0)) - Math.max(cand.y, other.y || 0);
    return ox > 0.15 && oy > 0.15;
  };

  const isBlockedByDoor = (cand: { x: number; y: number }): boolean => {
    for (const door of existingDoors) {
      const doorX = door.globalX ?? door.x ?? 0;
      const doorY = door.globalY ?? door.y ?? 0;
      const swing = 3;
      const ox = Math.min(cand.x + stairW, doorX + swing) - Math.max(cand.x, doorX - swing);
      const oy = Math.min(cand.y + stairH, doorY + swing) - Math.max(cand.y, doorY - swing);
      if (ox > 0.3 && oy > 0.3) return true;
    }
    return false;
  };

  const isBlockedByPassage = (cand: { x: number; y: number }): boolean => {
    for (const r of existingRooms) {
      if (canonical(r.name) !== 'PASSAGE') continue;
      const ox = Math.min(cand.x + stairW, (r.x || 0) + (r.w || 0)) - Math.max(cand.x, r.x || 0);
      const oy = Math.min(cand.y + stairH, (r.y || 0) + (r.h || 0)) - Math.max(cand.y, r.y || 0);
      if (ox > 0.15 && oy > 0.15) return true;
    }
    return false;
  };

  const isInsideLiving = (cand: { x: number; y: number }): boolean => {
    if (cand.x < lx - 0.01 || cand.y < ly - 0.01) return false;
    if (cand.x + stairW > lx + lw + 0.01) return false;
    if (cand.y + stairH > ly + lh + 0.01) return false;
    return true;
  };

  const typeAdjustedScore = (base: number, corner: StairCorner): number => {
    if (stairType === 'L_SHAPED') return base;
    if (stairType === 'STRAIGHT') {
      if (corner === 'BOTTOM-RIGHT' || corner === 'TOP-RIGHT') return base - 0.5;
      return base;
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
    return { corner: def.corner, x: def.x, y: def.y };
  }

  return { corner: 'BOTTOM-RIGHT', x: lx + lw - stairW, y: ly + lh - stairH };
}

// 13. Specs Extractor
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
      } as RoomSpec);

      return;
    }

    if (key === 'STAIRCASE' && out.some(x => x.key === 'STAIRCASE' && x.embedIn === 'LIVING ROOM')) {
      return;
    }

    const width = Number(item.width) > 0 ? Number(item.width) : (Number(item.w) > 0 ? Number(item.w) : undefined);
    const length = Number(item.length) > 0 ? Number(item.length) : (Number(item.h) > 0 ? Number(item.h) : undefined);

    const existing = out.find(x => x.key === key && x.areaMode === areaMode && x.areaPerRoom === areaPerRoom && x.width === width && x.length === length);
    if (existing) existing.count += count;
    else out.push({ key, count, areaMode, areaPerRoom, width, length });
  };

  if (Array.isArray(selectedRooms)) {
    for (const value of selectedRooms) {
      if (typeof value === 'string') push(value, {});
      else if (value && typeof value === 'object') push(value.key || value.name || value.label || value.roomType, value);
    }
  } else if (selectedRooms && typeof selectedRooms === 'object') {
    for (const [key, value] of Object.entries(selectedRooms)) push(key, value);
  }

  // AUTO-DETECT: LIVING ROOM width > 14ft → assume U-shape combo
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
      } as RoomSpec);
    }
  }

  // FIX: Auto-inject ATTACHED TOILET when "master with attached toilet" selected
  const masterSpec = out.find(s => s.key === 'MASTER BEDROOM');
  const attachedSpec = out.find(s => s.key === 'ATTACHED TOILET');
  if (masterSpec && !attachedSpec && detectMasterWithAttached(selectedRooms)) {
    out.push({
      key: 'ATTACHED TOILET',
      count: 1,
      areaMode: 'AUTO',
      areaPerRoom: 50,
    } as RoomSpec);
  }

  return out;
}

// 14. Program Builder
export function programFromInput(selectedRooms: any, bhk: string, floorArea: number, ground: boolean, mode: string, layoutW = 0, layoutH = 0): string[] {
  const explicit = extractSpecs(selectedRooms);
  const result: string[] = [];
  const add = (key: string, count = 1) => { for (let i = 0; i < count; i++) result.push(canonical(key)); };

  for (const spec of explicit) add(spec.key, spec.count);
  const hasExplicit = explicit.length > 0;
  const area = Math.max(1, floorArea);
  const auto = clean(mode) === 'AUTO';

  // FIX: Ensure ATTACHED TOILET follows MASTER BEDROOM when master-with-attached selected
  if (detectMasterWithAttached(selectedRooms) && !result.includes('ATTACHED TOILET')) {
    const masterIdx = result.indexOf('MASTER BEDROOM');
    if (masterIdx >= 0) result.splice(masterIdx + 1, 0, 'ATTACHED TOILET');
    else result.push('ATTACHED TOILET');
  }

  if (!hasExplicit && auto) {
    if (ground) {
      if (area <= 1200) {
        add('MASTER BEDROOM'); add('ATTACHED TOILET'); add('COMMON TOILET'); add('KITCHEN CUM DINING'); add('LIVING ROOM'); add('PARKING'); add('STAIRCASE');
      } else if (area <= 1500) {
        add('MASTER BEDROOM'); add('BEDROOM'); add('ATTACHED TOILET'); add('COMMON TOILET'); add('KITCHEN CUM DINING'); add('LIVING ROOM'); add('PARKING'); add('STAIRCASE');
      } else {
        add('MASTER BEDROOM'); add('BEDROOM'); add('ATTACHED TOILET'); add('COMMON TOILET'); add('KITCHEN'); add('DINING'); add('LIVING ROOM'); add('PARKING'); add('STAIRCASE'); add('POOJA ROOM'); add('UTILITY');
      }
    } else {
      let presetKey = clean(bhk) || 'AUTO';
      if (presetKey === 'AUTO') {
        if (area >= 550 && layoutW >= 13) presetKey = '2 BHK ATTACHED';
        else presetKey = '1 BHK';
      }
      if (presetKey === '2 BHK ATTACHED') {
        add('MASTER BEDROOM'); add('BEDROOM'); add('ATTACHED TOILET', 2);
      } else {
        const preset = (BHK_PRESETS as any)[presetKey] || (BHK_PRESETS as any)['1 BHK'];
        for (const [key, count] of preset) add(String(key), n(count, 1));
      }
      add('STAIRCASE');
      if (area >= 1100 && !result.includes('COMMON TOILET')) add('COMMON TOILET');
    }
  }

  if (auto && hasExplicit) {
    if (!result.includes('LIVING ROOM')) add('LIVING ROOM');
    if (!result.includes('KITCHEN') && !result.includes('KITCHEN CUM DINING')) add('KITCHEN');
    if (ground && area > 750) {
      const withoutToilets = result.filter(k => !['BATHROOM', 'WC', 'ATTACHED TOILET', 'COMMON TOILET'].includes(k));
      result.splice(0, result.length, ...withoutToilets, 'ATTACHED TOILET', 'COMMON TOILET');
    }
    if (ground && area >= 500 && !result.includes('PARKING')) add('PARKING');
    if (!result.includes('STAIRCASE')) add('STAIRCASE');
  }

  if (ground && auto && area <= 1000) {
    const allowed = new Set(['MASTER BEDROOM','ATTACHED TOILET','COMMON TOILET','KITCHEN','KITCHEN CUM DINING','LIVING ROOM','PARKING','STAIRCASE']);
    const cleaned = result.filter(k => allowed.has(k) && k !== 'BEDROOM');
    result.length = 0;
    result.push(...cleaned.filter(k => !['MASTER BEDROOM','ATTACHED TOILET','COMMON TOILET'].includes(k)));
    result.push('MASTER BEDROOM','ATTACHED TOILET','COMMON TOILET');
    const unique: string[] = [];
    for (const k of result) if (!unique.includes(k)) unique.push(k);
    result.length = 0; result.push(...unique);
  }

  if (!result.length && !hasExplicit) {
    const preset = (BHK_PRESETS as any)[clean(bhk) || '1 BHK'] || (BHK_PRESETS as any)['1 BHK'];
    for (const [key, count] of preset) add(String(key), n(count, 1));
  }

  return result;
}

// 14b. Helper used by candidateGenerator
export function extractSpecsForCandidate(selectedRooms: any): RoomSpec[] {
  return extractSpecs(selectedRooms);
}

// 15. Desired Area
function desiredArea(specs: RoomSpec[], key: string, fallback: number): number {
  const spec = specs.find(s => s.key === key);
  if (spec?.width && spec?.length) return spec.width * spec.length;
  if (spec?.areaMode === 'MANUAL' && spec.areaPerRoom && spec.areaPerRoom > 0) return spec.areaPerRoom;
  const def = getRoomDefinition(key);
  return Math.max(def.minArea || 1, def.defaultArea || fallback);
}

// 16. Stair Type
function chooseStairType(W: number, H: number): StaircaseType {
  if (W >= 28 && H >= 45) return 'DOG_LEGGED';
  if (W >= 18 && H >= 38) return 'L_SHAPED';
  return 'STRAIGHT';
}

// 17. Clamp
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

// 18. Fit Rectangle
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

// 19. Main Layout Builder (Strategy-aware)
export function buildResidentialLayout(
  program: string[],
  specs: RoomSpec[],
  W: number,
  H: number,
  ground: boolean,
  stairSpec: ReturnType<typeof calculateStaircase>,
  parkingMode: ParkingMode = 'CAR',
  strategy?: CandidateStrategy,
): FloorRoom[] {
  void strategy;

  const rooms: FloorRoom[] = [];
  let id = 0;

  const addRoom = (key: string, x: number, y: number, w: number, h: number, extras: any = {}) => {
    const spec = extras.dimensionsFitted ? undefined : specs.find(s => s.key === key);
    const inputW = spec?.width || spec?.w;
    const inputL = spec?.length || spec?.h;

    let finalW = w;
    let finalH = h;
    if (inputW && inputW > 0) finalW = Math.max(0.5, Math.min(inputW, Math.max(0.5, W - x)));
    if (inputL && inputL > 0) finalH = Math.max(0.5, Math.min(inputL, Math.max(0.5, H - y)));
    finalW = Math.min(finalW, Math.max(0.5, W - x));
    finalH = Math.min(finalH, Math.max(0.5, H - y));

    if (finalW > 0.5 && finalH > 0.5) rooms.push(makeRoom(key, id++, x, y, finalW, finalH, extras));
  };

  // HARD GUARANTEE: Auto-inject STAIRCASE(embedIn=LIVING ROOM) if missing
  const livingSpecForStair = specs.find(s => s.key === 'LIVING ROOM');
  const stairSpecForStair = specs.find(s => s.key === 'STAIRCASE');
  if (livingSpecForStair && !stairSpecForStair) {
    const lw = Number(livingSpecForStair.width) || 0;
    if (lw > 14) {
      specs.push({
        key: 'STAIRCASE',
        count: 1,
        areaMode: 'AUTO',
        areaPerRoom: 65,
        embedIn: 'LIVING ROOM',
      } as RoomSpec);
    }
  }

  const counts = roomCounts(program);
  const has = (k: string) => (counts[k] || 0) > 0;
  const bedrooms = program.filter(k => k === 'MASTER BEDROOM' || k === 'BEDROOM');
  const hasParking = ground && has('PARKING');
  const hasLiving = has('LIVING ROOM');
  const hasKitchen = has('KITCHEN');
  const hasKD = has('KITCHEN CUM DINING');
  const hasDining = has('DINING');
  const hasStair = has('STAIRCASE');
  const bathroomCount = counts['BATHROOM'] || 0;
  const commonToiletCount = Math.max(counts['COMMON TOILET'] || 0, bathroomCount);
  const hasCommon = commonToiletCount > 0;
  const hasAttached = has('ATTACHED TOILET');

  const needsPassage = bedrooms.length > 1 ||
    (bedrooms.length >= 1 && (hasKitchen || hasKD || hasCommon || hasLiving));
  const stairEmbeddedInLiving = specs.some(s => s.key === 'STAIRCASE' && s.embedIn === 'LIVING ROOM');

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
  const privateDepth = bedrooms.length ? Math.min(usableH * 0.55, Math.max(12, bedroomDepths.reduce((a,b)=>a+b,0) + (bedrooms.length > 1 ? 0.5 : 0))) : 0;
  const middleDepth = Math.max(8, usableH - frontDepth - privateDepth);

  // ==========================================================
  // NARROW PLOT MASTER STRATEGY
  // ==========================================================
  if (ground && hasParking && W <= 24 && H >= 34) {
    const pDim = getSpecDim('PARKING', 9, 10, W, H);
    const parkingH = pDim.h;
    const pY = H - parkingH;
    addRoom('PARKING', 0, pY, pDim.w, parkingH, {
      parkingShape: 'CAR', parkingZone: 'FRONT_ROAD_CONNECTED',
      vehicleFit: true, vehicleClearanceRequired: true, parkingMode,
      entryRole: 'MAIN_ROAD_VEHICLE_GATE',
    });

    let currentY = pY;

    if (hasLiving) {
      const lDim = getSpecDim('LIVING ROOM', 10, 9, W, H);
      const lY = currentY - lDim.h;
      addRoom('LIVING ROOM', 0, lY, lDim.w, lDim.h, {
        entryZone: true, publicCore: true, parkingAdjacent: true, behindParking: true,
      });
      currentY = lY;

      if (stairEmbeddedInLiving) {
        const living = rooms[rooms.length - 1];
        const maxStairW = Math.min(living.w! * 0.5, living.w! - 3);
        const maxStairH = Math.min(living.h! * 0.6, living.h! - 3);
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

        const placement = chooseStaircaseCorner(
          living,
          sDim.w,
          sDim.h,
          rooms,
          existingDoors,
          stairSpec.staircaseType,
        );

        if (placement && sDim.w <= living.w! - 0.5 && sDim.h <= living.h! - 0.5) {
          addRoom('STAIRCASE', placement.x, placement.y, sDim.w, sDim.h, {
            staircaseType: stairSpec.staircaseType,
            staircaseSpec: stairSpec,
            verticalCore: true,
            accessSide: placement.corner.startsWith('BOTTOM') ? 'BOTTOM' : 'TOP',
            upperFloorCore: true,
            subZoneOf: living.id,
            isSubRoom: true,
            stairAccessZone: 'LIVING ROOM',
            collisionChecked: true,
            placedAtCorner: placement.corner,
            entrySide: placement.corner.startsWith('BOTTOM') ? 'SOUTH' : 'NORTH',
          });
        }
      }
    }

    // ============================================================
    // SERVICE ZONE (Kitchen + Passage + Common Toilet + Duct + Stair)
    // ============================================================
    if (hasKD || hasKitchen || hasCommon || (hasStair && !stairEmbeddedInLiving)) {
      const kitchenKey = hasKD ? 'KITCHEN CUM DINING' : 'KITCHEN';

      const passageW = (needsPassage && hasCommon) ? 3.0 : 0;
      const commonW = hasCommon ? 4.5 : 0;
      const ductW = (hasCommon && hasAttached) ? 1.5 : 0;
      const stairReserve = (hasStair && !stairEmbeddedInLiving) ? 5.5 : 0;

      const kitchenMaxW = Math.max(6, W - commonW - passageW - ductW - stairReserve);
      const defaultServiceH = clamp(H * 0.25, 7, 9);
      const kitchenMaxH = Math.max(defaultServiceH, Math.min(H * 0.4, 14));
      const kitchenDim = (hasKD || hasKitchen)
        ? getSpecDim(kitchenKey, 6, defaultServiceH, kitchenMaxW, kitchenMaxH)
        : { w: 0, h: defaultServiceH };
      const serviceH = Math.max(defaultServiceH, kitchenDim.h);
      const sY = currentY - serviceH;
      let cursorX = 0;

      const kitchenW = kitchenDim.w;
      if (hasKD) addRoom('KITCHEN CUM DINING', 0, sY, kitchenW, serviceH, { serviceZone: true, ventilationRequired: true, dimensionsFitted: true });
      else if (hasKitchen) addRoom('KITCHEN', 0, sY, kitchenW, serviceH, { serviceZone: true, ventilationRequired: true, dimensionsFitted: true });
      cursorX += kitchenW;

      if (hasStair && !stairEmbeddedInLiving) {
  const stairW = Math.max(5.5, W - cursorX);  // ❌ Hardcoded min 5.5
  addRoom('STAIRCASE', cursorX, sY, stairW, serviceH, {
    staircaseType: stairSpec.staircaseType,
    staircaseSpec: stairSpec,
    verticalCore: true,
    accessSide: 'BOTTOM',
    upperFloorCore: true,
    dimensionsFitted: true,
  });
}

      if (passageW > 0) {
        addRoom('PASSAGE', cursorX, sY, passageW, serviceH, {
          circulationZone: true,
          protectedCorridor: true,
          corridorWidthFt: passageW,
          pinkGuideLines: true,
          connects: ['LIVING ROOM', 'KITCHEN', 'COMMON TOILET', 'MASTER BEDROOM', 'STAIRCASE'],
          orientation: 'VERTICAL_SERVICE_SPINE',
          accessRole: 'PRIMARY_INTERNAL_SPINE',
        });
        cursorX += passageW;
      }

      if (hasCommon) {
        const usableCommonW = Math.max(4.0, W - cursorX - ductW - stairReserve);
        addRoom('COMMON TOILET', cursorX, sY, usableCommonW, Math.min(serviceH, 7), {
          serviceCore: true,
          ventilationRequired: true,
          dimensionsFitted: true,
        });
        cursorX += usableCommonW;
      }

      // ✅ REMOVED: Hardcoded DUCT placement — now handled by optimizeWetCore()
      // Reserve space for duct if user selected it
      if (ductW > 0) {
        cursorX += ductW; // Space reserve only, no render
      }

      if (hasStair && !stairEmbeddedInLiving) {
        const stairW = Math.max(5.5, W - cursorX);
        addRoom('STAIRCASE', cursorX, sY, stairW, serviceH, {
          staircaseType: stairSpec.staircaseType,
          staircaseSpec: stairSpec,
          verticalCore: true,
          accessSide: 'BOTTOM',
          upperFloorCore: true,
          dimensionsFitted: true,
        });
      }

      currentY = sY;
    }

    // ============================================================
    // PRIVATE ZONE (Master Bedroom + Attached Toilet — Orientation Aware)
    // ============================================================
    if (bedrooms.length >= 1) {
      const privateH = Math.max(10.5, currentY);
      const attachedW = hasAttached ? 5.0 : 0;
      const masterW = Math.max(minDim('MASTER BEDROOM'), W - attachedW);

      addRoom('MASTER BEDROOM', 0, 0, masterW, privateH, {
        privateZone: true,
        furnitureValidated: true,
      });
      const masterIndex = rooms.length - 1;

      if (hasAttached) {
        const master = rooms[masterIndex];
        const mW = master.w || 0;
        const mH = master.h || 0;

        // ORIENTATION RULE:
        //   - master >= 14 x 13  → HORIZONTAL (top-right corner, 7x7 max)
        //   - master width < 13  → HORIZONTAL (top strip, 5x7)
        //   - else               → VERTICAL (right side strip, 5 x masterHeight)
        const preferHorizontal =
          (mW >= 14 && mH >= 13) ||
          (mW < 13);

        if (preferHorizontal) {
          const attachedWidth = Math.min(7, Math.max(5, mW * 0.45));
          const attachedHeight = Math.min(7, Math.max(5, mH * 0.5));
          addRoom('ATTACHED TOILET',
            (master.x || 0) + mW - attachedWidth,
            (master.y || 0) + mH - attachedHeight,
            attachedWidth, attachedHeight,
          {
            attachedTo: master.id,
            subZoneOf: master.id,
            isSubRoom: true,
            serviceCore: true,
            ventilationRequired: true,
            orientation: 'HORIZONTAL',
            placementRule: mW >= 14 ? 'MASTER_LARGE_HORIZONTAL' : 'MASTER_NARROW_HORIZONTAL',
          });
        } else {
          const attachedWidth = Math.min(5, Math.max(4.5, mW * 0.35));
          const attachedHeight = Math.min(7, mH);
          addRoom('ATTACHED TOILET',
            (master.x || 0) + mW - attachedWidth,
            (master.y || 0),
            attachedWidth, attachedHeight,
          {
            attachedTo: master.id,
            subZoneOf: master.id,
            isSubRoom: true,
            serviceCore: true,
            ventilationRequired: true,
            orientation: 'VERTICAL',
            placementRule: 'MASTER_MEDIUM_VERTICAL',
          });
        }
      }
    } else if (hasAttached) {
      const remainingH = Math.max(0, currentY);
      if (remainingH > 3) {
        const dim = getSpecDim('ATTACHED TOILET', minDim('ATTACHED TOILET'), minDim('ATTACHED TOILET', false), W, remainingH);
        addRoom('ATTACHED TOILET', 0, Math.max(0, currentY - dim.h), dim.w, dim.h, {
          serviceCore: true,
          ventilationRequired: true,
          standaloneToilet: true,
        });
      }
    }

    // ============================================================
    // STEP 3: OPTIONAL ROOMS — Priority-based Placement
    // ============================================================
    if (has('POOJA ROOM')) {
      const livingRoom = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
      let placed = false;

      // Priority 1: Front side — near Parking (NE direction — Vastu ideal)
      const parking = rooms.find(r => canonical(r.name) === 'PARKING');
      if (parking && (parking.w || 0) < W - 5 && parking.y !== undefined) {
        const px = W - 5;
        const py = (parking.y || 0) + 0.5;
        const collides = rooms.some(r =>
          !(r as any).subZoneOf && !(r as any).isSubRoom &&
          Math.min(px + 5, (r.x || 0) + (r.w || 0)) > Math.max(px, r.x || 0) + 0.1 &&
          Math.min(py + 5, (r.y || 0) + (r.h || 0)) > Math.max(py, r.y || 0) + 0.1
        );
        if (!collides) {
          addRoom('POOJA ROOM', px, py, 5, 5, {
            optionalZone: true,
            placementStrategy: 'FRONT_NEAR_PARKING',
            preferredDirection: 'NE',
          });
          placed = true;
        }
      }

      // Priority 2: Living Room NE corner (if room big enough)
      if (!placed && livingRoom && (livingRoom.w || 0) >= 12 && (livingRoom.h || 0) >= 12) {
        const px = (livingRoom.x || 0) + (livingRoom.w || 0) - 5.5;
        const py = (livingRoom.y || 0) + 0.5;
        const collides = rooms.some(r =>
          r !== livingRoom && !(r as any).subZoneOf && !(r as any).isSubRoom &&
          Math.min(px + 5, (r.x || 0) + (r.w || 0)) > Math.max(px, r.x || 0) + 0.1 &&
          Math.min(py + 5, (r.y || 0) + (r.h || 0)) > Math.max(py, r.y || 0) + 0.1
        );
        if (!collides) {
          addRoom('POOJA ROOM', px, py, 5, 5, {
            optionalZone: true,
            subZoneOf: livingRoom.id,
            isSubRoom: true,
            attachedTo: livingRoom.id,
            placementStrategy: 'LIVING_NE_CORNER',
            preferredDirection: 'NE',
          });
          placed = true;
        }
      }

      // Priority 3: Nearest free rectangle (fallback)
      if (!placed) {
        const free = findFreeRectangle(rooms, W, H, 5, 5, 0, currentY || H);
        if (free) {
          addRoom('POOJA ROOM', free.x, free.y, 5, 5, {
            optionalZone: true,
            placementStrategy: 'FALLBACK_FREE_SPACE',
          });
          placed = true;
        }
      }

      if (!placed && typeof console !== 'undefined') {
        console.warn('[ROOM PLANNER] POOJA ROOM could not find suitable space — skipping.');
      }
    }

    if (has('STUDY ROOM')) {
      const free = findFreeRectangle(rooms, W, H, 7, 8, 0, currentY || H);
      if (free) addRoom('STUDY ROOM', free.x, free.y, 7, 8, { optionalZone: true });
    }
    if (has('UTILITY')) {
      const free = findFreeRectangle(rooms, W, H, 4, 6, 0, currentY || H);
      if (free) addRoom('UTILITY', free.x, free.y, 4, 6, { optionalZone: true, ventilationRequired: true });
    }
    if (has('STORE')) {
      const free = findFreeRectangle(rooms, W, H, 4, 5, 0, currentY || H);
      if (free) addRoom('STORE', free.x, free.y, 4, 5, { optionalZone: true });
    }
    if (has('BALCONY')) {
      const living = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
      if (living && (living.w || 0) >= 5) {
        addRoom('BALCONY', (living.x || 0), Math.max(0, (living.y || 0) - 4.5), Math.min(6, living.w || 6), 4.5, {
          subZoneOf: living.id,
          isSubRoom: true,
          isOpen: true,
          attachedTo: living.id,
          exteriorProjection: true,
        });
      }
    }

    // ✅ FINAL: Dynamic Duct Optimization (only if user selected DUCT)
    return optimizeWetCore(rooms);
  }

  // -------- PRIMARY ZONING --------
  if (hasLiving && hasStair && (hasParking || !ground) && W >= 13.0 && H >= 34.0) {
    const parkingMinimum = selectParkingCandidate(W, H, parkingDepth || 15, parkingMode);
    const carLike = parkingMode === 'CAR' || parkingMode === 'CAR_BIKE_PEDESTRIAN';
    const parkingDepthActual = Math.min(H, Math.max(12, parkingMinimum.depth));
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
        addRoom('STAIRCASE', placement.x, placement.y, stairW, stairH, {
          staircaseType: stairSpec.staircaseType, staircaseSpec: stairSpec, verticalCore: true,
          accessSide: placement.corner.startsWith('BOTTOM') ? 'BOTTOM' : 'TOP',
          landingRequired: true, upperFloorCore: true,
          subZoneOf: livingRoom.id, isSubRoom: true, stairAccessZone: 'LIVING/PASSAGE',
          collisionChecked: true,
          placedAtCorner: placement.corner,
          entrySide: placement.corner.startsWith('BOTTOM') ? 'SOUTH' : 'NORTH',
        });
      }
    }

    const serviceH = Math.min(7, Math.max(6.5, H * 0.15));
    const serviceY = frontY - serviceH;
    const serviceRight = W;
    if (passageW > 0) {
      addRoom('PASSAGE', 0, 0, passageW, Math.max(6, frontY), {
        circulationZone: true, protectedCorridor: true, corridorWidthFt: passageW,
        pinkGuideLines: true, accessRole: 'PRIMARY_INTERNAL_SPINE',
        connects: ['PARKING', 'LIVING ROOM', 'STAIRCASE', 'KITCHEN', 'COMMON TOILET', 'PRIVATE ROOMS'],
      });
    }

    const usableServiceW = Math.max(0, serviceRight - passageW);
    let cursorX = passageW;
    const toiletW = hasCommon ? Math.min(4.5, Math.max(4.5, usableServiceW - 7)) : 0;
    const ductW = hasCommon && usableServiceW - toiletW >= 8.5 ? 1.5 : 0;
    const kitchenW = hasKD || hasKitchen ? Math.max(6.5, usableServiceW - toiletW - ductW) : 0;

    if (hasKD && kitchenW >= min('KITCHEN CUM DINING').minWidth) {
      addRoom('KITCHEN CUM DINING', cursorX, serviceY, kitchenW, serviceH, { serviceZone: true, diningAdjacent: true, ventilationRequired: true });
      cursorX += kitchenW;
    } else if (hasKitchen && kitchenW >= min('KITCHEN').minWidth) {
      addRoom('KITCHEN', cursorX, serviceY, kitchenW, serviceH, { serviceZone: true, ventilationRequired: true });
      cursorX += kitchenW;
    }

    if (hasCommon && toiletW >= 4.0) {
      addRoom('COMMON TOILET', cursorX, serviceY, toiletW, Math.min(7, serviceH), {
        serviceCore: true, privacy: 'PUBLIC_SERVICE', ventilationRequired: true,
      });
      cursorX += toiletW;
      // ✅ REMOVED: Hardcoded DUCT placement
    }

    const privateTop = Math.max(0, serviceY);
    const privateH = privateTop;
    const rearW = Math.max(0, W - passageW);
    if (bedrooms.length === 1 && rearW >= min('MASTER BEDROOM').minWidth && privateH >= min('MASTER BEDROOM').minDepth) {
      const masterH = privateH;
      const attachedW = hasAttached && rearW >= 11.5 ? Math.min(5, Math.max(4.5, rearW - min('MASTER BEDROOM').minWidth)) : 0;
      addRoom('MASTER BEDROOM', passageW, 0, rearW - attachedW, masterH, {
        privateZone: true, requestedArea: roomArea('MASTER BEDROOM', 140),
        furnitureValidated: true,
      });
      if (attachedW) {
        const master = rooms[rooms.length - 1];
        const mW = master.w || 0;
        const mH = master.h || 0;
        const preferHorizontal = (mW >= 14 && mH >= 13) || (mW < 13);

        if (preferHorizontal) {
          const aw = Math.min(7, Math.max(5, mW * 0.45));
          const ah = Math.min(7, Math.max(5, mH * 0.5));
          addRoom('ATTACHED TOILET', (master.x || 0) + mW - aw, (master.y || 0) + mH - ah, aw, ah, {
            attachedTo: master.id, subZoneOf: master.id, isSubRoom: true,
            serviceCore: true, ventilationRequired: true,
            orientation: 'HORIZONTAL',
          });
        } else {
          const aw = Math.min(5, Math.max(4.5, mW * 0.35));
          const ah = Math.min(7, mH);
          addRoom('ATTACHED TOILET', (master.x || 0) + mW - aw, (master.y || 0), aw, ah, {
            attachedTo: master.id, subZoneOf: master.id, isSubRoom: true,
            serviceCore: true, ventilationRequired: true,
            orientation: 'VERTICAL',
          });
        }
      }
    } else if (bedrooms.length >= 2 && rearW >= 20 && privateH >= 20) {
      const bayW = (rearW) / 2;
      const bedH = privateH / 2;
      addRoom('MASTER BEDROOM', passageW, bedH, bayW, bedH, { privateZone: true, furnitureValidated: true, requestedArea: roomArea('MASTER BEDROOM', 140) });
      addRoom('BEDROOM', passageW + bayW, bedH, bayW, bedH, { privateZone: true, furnitureValidated: true, requestedArea: roomArea('BEDROOM', 110) });
      if (hasAttached && bayW >= 11.5) {
        const master = rooms.find(r => canonical(r.name) === 'MASTER BEDROOM');
        if (master) {
          const mW = master.w || 0;
          const mH = master.h || 0;
          const preferHorizontal = (mW >= 14 && mH >= 13) || (mW < 13);
          if (preferHorizontal) {
            const aw = Math.min(7, Math.max(5, mW * 0.45));
            const ah = Math.min(7, Math.max(5, mH * 0.5));
            addRoom('ATTACHED TOILET', (master.x || 0) + mW - aw, (master.y || 0) + mH - ah, aw, ah, {
              attachedTo: master.id, subZoneOf: master.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'HORIZONTAL',
            });
          } else {
            const aw = Math.min(5, Math.max(4.5, mW * 0.35));
            const ah = Math.min(7, mH);
            addRoom('ATTACHED TOILET', (master.x || 0) + mW - aw, (master.y || 0), aw, ah, {
              attachedTo: master.id, subZoneOf: master.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'VERTICAL',
            });
          }
        }
      }
    }

    if (has('BALCONY')) {
      const l = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
      if (l && l.w >= 5 && l.h >= 5) {
        addRoom('BALCONY', l.x, Math.max(0, l.y - 4.0), Math.min(6, l.w), 4.0, {
          subZoneOf: l.id, isSubRoom: true, isOpen: true, attachedTo: l.id, exteriorProjection: false,
        });
      }
    }

    // ✅ FINAL: Dynamic Duct Optimization (only if user selected DUCT)
    return optimizeWetCore(rooms);
  }

  // -------- UPPER-FLOOR BEDROOM --------
  if (!hasParking && hasStair && bedrooms.length >= 1 && W >= 13 && H >= 34) {
    const sidePassW = needsPassage ? 3.25 : 0;
    let publicH = 0;
    let livingRoom: FloorRoom | null = null;

    if (hasLiving) {
      publicH = Math.min(10, Math.max(8.5, roomArea('LIVING ROOM', 120) / Math.max(1, W - sidePassW)));
      const livingY = H - publicH;
      addRoom('LIVING ROOM', sidePassW, livingY, W - sidePassW, publicH, { publicCore: true, upperFloorLiving: true });
      livingRoom = rooms[rooms.length - 1];
    }

    const stairW = Math.min(6, Math.max(5.5, stairSpec.requiredWidthFt || 5.5));
    const stairH = Math.min(Math.max(7.5, stairSpec.requiredLengthFt || 8), Math.max(7.5, publicH || 10.17));
    const stairY = H - Math.max(publicH, stairH);

    if (hasLiving && livingRoom && stairW <= livingRoom.w - 0.25) {
      const existingDoors: any[] = [];
      for (const r of rooms) {
        for (const d of (r.doors || [])) {
          existingDoors.push({ ...d, globalX: (r.x || 0), globalY: (r.y || 0) });
        }
      }
      const placement = chooseStaircaseCorner(livingRoom, stairW, stairH, rooms, existingDoors, stairSpec.staircaseType);
      if (placement) {
        addRoom('STAIRCASE', placement.x, placement.y, stairW, Math.min(stairH, livingRoom.h), {
          staircaseType: stairSpec.staircaseType, staircaseSpec: stairSpec, verticalCore: true,
          accessSide: placement.corner.startsWith('BOTTOM') ? 'BOTTOM' : 'TOP',
          landingRequired: true, upperFloorCore: true,
          subZoneOf: livingRoom.id, isSubRoom: true, stairAccessZone: 'LIVING/PASSAGE',
          collisionChecked: true,
          placedAtCorner: placement.corner,
          entrySide: placement.corner.startsWith('BOTTOM') ? 'SOUTH' : 'NORTH',
        });
      }
    } else {
      addRoom('STAIRCASE', sidePassW, stairY, stairW, stairH, {
        staircaseType: stairSpec.staircaseType, staircaseSpec: stairSpec, verticalCore: true,
        accessSide: 'LEFT', landingRequired: true, upperFloorCore: true,
        stairAccessZone: 'PASSAGE', allowGroundAlignment: false,
      });
    }

    const serviceH = hasKitchen || hasKD || hasCommon ? Math.min(7.5, Math.max(6.5, H * 0.16)) : 0;
    const serviceY = H - publicH - serviceH - (hasLiving ? 0 : stairH);
    if (serviceH > 0 && serviceY > 12) {
      if (hasKitchen) addRoom('KITCHEN', sidePassW, serviceY, Math.max(6.5, W - sidePassW - (hasCommon ? 4.5 : 0)), serviceH, { serviceZone: true, ventilationRequired: true });
      else if (hasKD) addRoom('KITCHEN CUM DINING', sidePassW, serviceY, Math.max(9, W - sidePassW - (hasCommon ? 4.5 : 0)), serviceH, { serviceZone: true, diningAdjacent: true, ventilationRequired: true });
      if (hasCommon) addRoom('COMMON TOILET', sidePassW, serviceY, 4.5, Math.min(7, serviceH), { serviceCore: true, ventilationRequired: true, accessRole: 'PUBLIC_SERVICE' });
    }

    const passageH = Math.max(12, serviceY);
    if (sidePassW > 0) {
      addRoom('PASSAGE', 0, 0, sidePassW, passageH, {
        circulationZone: true, protectedCorridor: true, corridorWidthFt: sidePassW,
        pinkGuideLines: true, accessRole: 'PRIMARY_INTERNAL_SPINE',
        connects: ['STAIRCASE', 'LIVING ROOM', 'MASTER BEDROOM', 'BEDROOM'],
      });
    }

    const rearW = Math.max(0, W - sidePassW);
    const bedroomZoneH = passageH;
    if (bedrooms.length === 1) {
      const key = bedrooms[0];
      if (rearW >= min(key).minWidth && bedroomZoneH >= min(key).minDepth) {
        addRoom(key, sidePassW, 0, rearW, bedroomZoneH, { privateZone: true, furnitureValidated: true, requestedArea: roomArea(key, 140) });
        if (hasAttached && rearW >= 10 && bedroomZoneH >= 13) {
          const bedroom = rooms[rooms.length - 1];
          const mW = bedroom.w || 0;
          const mH = bedroom.h || 0;
          const preferHorizontal = (mW >= 14 && mH >= 13) || (mW < 13);
          if (preferHorizontal) {
            const aw = Math.min(7, Math.max(5, mW * 0.45));
            const ah = Math.min(7, Math.max(5, mH * 0.5));
            addRoom('ATTACHED TOILET', (bedroom.x || 0) + mW - aw, (bedroom.y || 0) + mH - ah, aw, ah, {
              attachedTo: bedroom.id, subZoneOf: bedroom.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'HORIZONTAL',
            });
          } else {
            const aw = Math.min(5, Math.max(4.5, mW * 0.35));
            const ah = Math.min(7, mH);
            addRoom('ATTACHED TOILET', (bedroom.x || 0) + mW - aw, (bedroom.y || 0), aw, ah, {
              attachedTo: bedroom.id, subZoneOf: bedroom.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'VERTICAL',
            });
          }
        }
      }
    } else if (bedroomZoneH >= 20 && rearW >= 10) {
      const bedH = bedroomZoneH / 2;
      const keyA = bedrooms[0], keyB = bedrooms[1];
      addRoom(keyA, sidePassW, bedH, rearW, bedH, { privateZone: true, furnitureValidated: true, requestedArea: roomArea(keyA, 140) });
      addRoom(keyB, sidePassW, 0, rearW, bedH, { privateZone: true, furnitureValidated: true, requestedArea: roomArea(keyB, 110) });
      if (hasAttached && rearW >= 10 && bedH >= 9.5) {
        const bedroomA = rooms[rooms.length - 2];
        const bedroomB = rooms[rooms.length - 1];
        for (const bedroom of [bedroomA, bedroomB]) {
          const mW = bedroom.w || 0;
          const mH = bedroom.h || 0;
          const preferHorizontal = (mW >= 14 && mH >= 13) || (mW < 13);
          if (preferHorizontal) {
            const aw = Math.min(7, Math.max(5, mW * 0.45));
            const ah = Math.min(7, Math.max(5, mH * 0.5));
            addRoom('ATTACHED TOILET', (bedroom.x || 0) + mW - aw, (bedroom.y || 0) + mH - ah, aw, ah, {
              attachedTo: bedroom.id, subZoneOf: bedroom.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'HORIZONTAL',
            });
          } else {
            const aw = Math.min(5, Math.max(4.5, mW * 0.35));
            const ah = Math.min(7, mH);
            addRoom('ATTACHED TOILET', (bedroom.x || 0) + mW - aw, (bedroom.y || 0), aw, ah, {
              attachedTo: bedroom.id, subZoneOf: bedroom.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'VERTICAL',
            });
          }
        }
      }
    }
    // ✅ FINAL: Dynamic Duct Optimization (only if user selected DUCT)
    return optimizeWetCore(rooms);
  }

  // -------- UPPER-FLOOR NO-PARKING --------
  if (!hasParking && hasLiving && hasStair && W >= 17.0 && H >= 35.0) {
    const livingH2 = 8.5;
    const serviceH2 = Math.max(6.5, Math.min(7.0, H * 0.18));
    const passageW2 = needsPassage ? 3.25 : 0;
    const privateNeeded = bedrooms.length >= 2 ? 20.0 : bedrooms.length ? 10.5 : 0;
    const requiredH2 = livingH2 + serviceH2 + privateNeeded;
    if (requiredH2 <= H + 0.25) {
      const livingY2 = H - livingH2;
      addRoom('LIVING ROOM', 0, livingY2, W, livingH2, { publicCore: true, upperFloorLiving: true });
      const livingId = rooms[rooms.length - 1].id;
      const stairW2 = Math.min(6, Math.max(5.5, stairSpec.requiredWidthFt || 5.5));
      const stairH2 = Math.min(livingH2, Math.max(7.5, stairSpec.requiredLengthFt || 8));
      if (stairW2 <= W - 0.5) addRoom('STAIRCASE', W - stairW2, livingY2, stairW2, stairH2, {
        staircaseType: stairSpec.staircaseType, staircaseSpec: stairSpec, verticalCore: true,
        accessSide: 'BOTTOM', landingRequired: true, upperFloorCore: true, subZoneOf: livingId, isSubRoom: true,
      });

      const serviceY2 = livingY2 - serviceH2;
      const wetCount2 = Math.max(0, commonToiletCount);
      const wetW2 = wetCount2 * 4.0;
      const serviceW2 = W - passageW2 - wetW2;
      if (serviceW2 >= 7.0) {
        if (hasKD) addRoom('KITCHEN CUM DINING', 0, serviceY2, serviceW2, serviceH2, { serviceZone: true, diningAdjacent: true, ventilationRequired: true });
        else if (hasKitchen) addRoom('KITCHEN', 0, serviceY2, serviceW2, serviceH2, { serviceZone: true, ventilationRequired: true });

        for (let bi = 0; bi < Math.max(0, counts['COMMON TOILET'] || 0); bi++) {
          addRoom('COMMON TOILET', serviceW2 + bi * 4, serviceY2, 4, serviceH2, { serviceCore: true, ventilationRequired: true });
        }

        if (bedrooms.length) {
          const privateTop2 = serviceY2;
          const sideX = W - passageW2;
          if (passageW2 > 0) {
            addRoom('PASSAGE', sideX, 0, passageW2, privateTop2, {
              circulationZone: true, protectedCorridor: true, corridorWidthFt: passageW2, pinkGuideLines: true,
              connects: ['LIVING ROOM', 'STAIRCASE', 'KITCHEN', 'COMMON TOILET', 'MASTER BEDROOM', 'BEDROOM'],
              orientation: 'VERTICAL_PRIVATE_SPINE',
            });
          }

          if (bedrooms.length >= 2) {
            const masterH = 10.5;
            const bedH = Math.max(9.5, privateTop2 - masterH);
            const privateW = sideX;
            if (privateW >= 10.5 && bedH >= 9.5) {
              addRoom('MASTER BEDROOM', 0, bedH, privateW, masterH, { privateZone: true, requestedArea: roomArea('MASTER BEDROOM', 140), furnitureValidated: true });
              const master = rooms[rooms.length - 1];
              let bathPlaced = 0;
              if (bathroomCount > bathPlaced && privateW >= 15) {
                addRoom('ATTACHED TOILET', privateW - 5, bedH, 5, Math.min(7, masterH), { attachedTo: master.id, subZoneOf: master.id, isSubRoom: true, serviceCore: true, ventilationRequired: true });
                bathPlaced++;
              }
              addRoom('BEDROOM', 0, 0, privateW, bedH, { privateZone: true, requestedArea: roomArea('BEDROOM', 110), furnitureValidated: true });
              const second = rooms[rooms.length - 1];
              if (bathroomCount > bathPlaced && privateW >= 15) {
                addRoom('ATTACHED TOILET', privateW - 5, 0, 5, Math.min(7, bedH), { attachedTo: second.id, subZoneOf: second.id, isSubRoom: true, serviceCore: true, ventilationRequired: true });
                bathPlaced++;
              }
              for (let bi = bathPlaced; bi < bathroomCount; bi++) {
                const x = serviceW2 + ((bi - bathPlaced) * 4);
                if (x + 4 <= W - passageW2 + 0.01) addRoom('BATHROOM', x, serviceY2, 4, serviceH2, { serviceCore: true, ventilationRequired: true, bathroomIndex: bi + 1 });
              }
            }
          } else {
            const h = Math.min(10.5, privateTop2);
            const privateW = sideX;
            if (privateW >= 11 && h >= 10) {
              addRoom('MASTER BEDROOM', 0, privateTop2 - h, privateW, h, { privateZone: true, requestedArea: roomArea('MASTER BEDROOM', 140), furnitureValidated: true });
              const master = rooms[rooms.length - 1];
              if (bathroomCount > 0 && privateW >= 15) addRoom('ATTACHED TOILET', privateW - 5, master.y || 0, 5, Math.min(7, h), { attachedTo: master.id, subZoneOf: master.id, isSubRoom: true, serviceCore: true, ventilationRequired: true });
            }
          }
          // ✅ FINAL: Dynamic Duct Optimization (only if user selected DUCT)
          return optimizeWetCore(rooms);
        }
        // ✅ FINAL: Dynamic Duct Optimization (only if user selected DUCT)
        return optimizeWetCore(rooms);
      }
    }
  }

  // -------- MEDIUM FRONTAGE / 2-BEDROOM --------
  if (W >= 22 && W < 28 && H >= 42 && hasLiving && hasStair && bedrooms.length >= 2 && hasParking) {
    const parking = scoreAndPlaceParking(W, 15, W, H, parkingMode);
    const parkingH = 15;
    const livingH = 10;
    const stairW = 6;
    const stairH = Math.min(10.5, Math.max(10, stairSpec.requiredLengthFt));
    const commonW = hasCommon ? 4.5 : 0;
    const serviceH = Math.max(10, stairH, hasCommon ? 7 : 0);
    const passageH = 3.25;
    const privateH = 10.9;
    const totalH = parkingH + livingH + serviceH + passageH + privateH;

    if (parking.w >= 9 && totalH <= H + 0.25 && W >= 22) {
      addRoom('PARKING', parking.x, H - parkingH, parking.w, parkingH, {
        parkingShape: parking.shape, parkingZone: 'FRONT_ROAD_CONNECTED', vehicleFit: parking.vehicleFit,
        candidateScore: parking.score, vehicleClearanceRequired: true, parkingMode,
      });
      const livingY = H - parkingH - livingH;
      addRoom('LIVING ROOM', 0, livingY, W, livingH, { entryZone: true, roadConnected: true, publicCore: true });

      const serviceY = livingY - serviceH;
      const stairX = W - stairW;
      addRoom('STAIRCASE', stairX, serviceY, stairW, stairH, {
        staircaseType: stairSpec.staircaseType, staircaseSpec: stairSpec, verticalCore: true,
        accessSide: 'BOTTOM', landingRequired: true, upperFloorCore: true,
      });
      const commonX = stairX - commonW;
      if (hasCommon) addRoom('COMMON TOILET', commonX, serviceY, commonW, 7, { serviceCore: true, privacy: 'LIVING_SIDE_ACCESS', ventilationRequired: true });
      // ✅ REMOVED: Hardcoded DUCT placement

      const foodW = Math.max(7, commonX);
      if (hasKD) addRoom('KITCHEN CUM DINING', 0, serviceY, foodW, serviceH, { serviceZone: true, diningAdjacent: true, ventilationRequired: true });
      else if (hasKitchen) addRoom('KITCHEN', 0, serviceY, foodW, serviceH, { serviceZone: true, ventilationRequired: true });

      const passageY = serviceY - passageH;
      addRoom('PASSAGE', 0, passageY, W, passageH, {
        circulationZone: true, protectedCorridor: true, corridorWidthFt: passageH,
        pinkGuideLines: true, connects: ['LIVING ROOM', 'MASTER BEDROOM', 'BEDROOM', 'STAIRCASE', 'KITCHEN CUM DINING', 'COMMON TOILET'],
        orientation: 'HORIZONTAL_PRIVATE_SPINE',
      });

      const roomW = W / 2;
      addRoom('MASTER BEDROOM', 0, 0, roomW, privateH, { privateZone: true, requestedArea: roomArea('MASTER BEDROOM', 140), furnitureValidated: true });
      const master = rooms[rooms.length - 1];
      if (hasAttached) {
        const mW = master.w || 0;
        const mH = master.h || 0;
        const preferHorizontal = (mW >= 14 && mH >= 13) || (mW < 13);
        if (preferHorizontal) {
          const aw = Math.min(7, Math.max(5, mW * 0.45));
          const ah = Math.min(7, Math.max(5, mH * 0.5));
          addRoom('ATTACHED TOILET', (master.x || 0) + mW - aw, (master.y || 0) + mH - ah, aw, ah, {
            attachedTo: master.id, subZoneOf: master.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'HORIZONTAL',
          });
        } else {
          const aw = Math.min(5, Math.max(4.5, mW * 0.35));
          const ah = Math.min(7, mH);
          addRoom('ATTACHED TOILET', (master.x || 0) + mW - aw, (master.y || 0), aw, ah, {
            attachedTo: master.id, subZoneOf: master.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'VERTICAL',
          });
        }
      }
      addRoom('BEDROOM', roomW, 0, roomW, privateH, { privateZone: true, requestedArea: roomArea('BEDROOM', 110), furnitureValidated: true });

      if (has('BALCONY')) {
        const living = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
        if (living) addRoom('BALCONY', Math.max(0, W - 6), living.y || 0, 6, 4.5, { subZoneOf: living.id, isSubRoom: true, isOpen: true, attachedTo: living.id, exteriorProjection: true });
      }
      // ✅ FINAL: Dynamic Duct Optimization (only if user selected DUCT)
      return optimizeWetCore(rooms);
    }
  }

  // -------- COMPACT --------
  if (W < 24 && H >= 38 && hasLiving && hasStair) {
    const parking = hasParking ? scoreAndPlaceParking(W, 15, W, H, parkingMode) : null;
    const parkingH = parking ? 15 : 0;
    const livingH = clamp(roomArea('LIVING ROOM', 120) / Math.max(1, W), 10, 10.5);
    const stairW = clamp(stairSpec.requiredWidthFt || 5.5, 5.5, Math.min(6, W * 0.34));
    const stairH = clamp(stairSpec.requiredLengthFt || 10, 9.5, Math.min(11.5, H));
    const commonW = hasCommon ? 4.5 : 0;
    const ductW = hasCommon ? 1.5 : 0;
    const kitchenBayW = Math.max(7, W - stairW - commonW);
    const serviceH = Math.max(10, stairH, hasCommon ? 7 : 0, hasKitchen || hasKD ? 8 : 0);
    const passageW = needsPassage ? 3.25 : 0;
    const privateTargetH = bedrooms.length ? (bedrooms.length > 1 ? 20.5 : 10.5) : 0;
    const requiredH = parkingH + livingH + serviceH + passageW + privateTargetH;

    if (requiredH <= H + 0.25 && kitchenBayW >= 7) {
      if (parking) {
        addRoom('PARKING', parking.x, H - parking.h, parking.w, parking.h, {
          parkingShape: parking.shape, parkingZone: 'FRONT_ROAD_CONNECTED',
          vehicleFit: parking.vehicleFit, candidateScore: parking.score, vehicleClearanceRequired: true,
        });
      }

      const livingY = H - parkingH - livingH;
      addRoom('LIVING ROOM', 0, livingY, W, livingH, { entryZone: true, roadConnected: true, publicCore: true });

      const serviceY = livingY - serviceH;
      const stairX = W - stairW;
      const commonX = stairX - commonW;

      if (hasKD) {
        addRoom('KITCHEN CUM DINING', 0, serviceY, Math.max(7, commonX), serviceH, { serviceZone: true, diningAdjacent: true, ventilationRequired: true });
      } else if (hasKitchen) {
        if (hasDining && kitchenBayW >= 13.5) {
          const kw = kitchenBayW * 0.55;
          addRoom('KITCHEN', 0, serviceY, kw, serviceH, { serviceZone: true, ventilationRequired: true });
          addRoom('DINING', kw, serviceY, kitchenBayW - kw, serviceH, { adjacentTo: 'KITCHEN', circulationSide: 'LIVING' });
        } else {
          addRoom('KITCHEN', 0, serviceY, kitchenBayW, serviceH, { serviceZone: true, ventilationRequired: true });
        }
      } else if (hasDining) {
        addRoom('DINING', 0, serviceY, kitchenBayW, serviceH, { circulationSide: 'LIVING' });
      }

      if (hasCommon) {
        addRoom('COMMON TOILET', commonX, serviceY, commonW, 7, { serviceCore: true, privacy: 'LIVING_SIDE_ACCESS', ventilationRequired: true });
        // ✅ REMOVED: Hardcoded DUCT placement
      }

      addRoom('STAIRCASE', stairX, serviceY, stairW, stairH, {
        staircaseType: stairSpec.staircaseType, staircaseSpec: stairSpec,
        verticalCore: true, accessSide: 'BOTTOM', landingRequired: true, upperFloorCore: true,
      });

      if (bedrooms.length) {
        const passageY = serviceY - passageW;
        if (passageW > 0) {
          addRoom('PASSAGE', 0, passageY, W, passageW, {
            circulationZone: true, protectedCorridor: true, corridorWidthFt: passageW, pinkGuideLines: true,
            connects: ['LIVING ROOM', 'STAIRCASE', 'PRIVATE ROOMS'],
          });
        }

        const privateTop = passageY;
        const availablePrivate = privateTop;
        const ordered = [...bedrooms].sort((a, b) => a === 'MASTER BEDROOM' ? -1 : b === 'MASTER BEDROOM' ? 1 : 0);
        const eachH = ordered.length === 1 ? availablePrivate : availablePrivate / ordered.length;
        let y = 0;

        ordered.forEach((key, idx) => {
          const h = Math.min(eachH - (idx < ordered.length - 1 ? 0.15 : 0), key === 'MASTER BEDROOM' ? 12.5 : 11.5);
          if (h < (key === 'MASTER BEDROOM' ? 10 : 9.5)) return;
          let roomW = W;
          let attachedW = 0;
          if (key === 'MASTER BEDROOM' && hasAttached && W >= 15) {
            attachedW = 5;
            roomW = W - attachedW;
          }
          addRoom(key, 0, y, roomW, h, {
            privateZone: true, requestedArea: roomArea(key, key === 'MASTER BEDROOM' ? 140 : 110), furnitureValidated: true,
          });
          const master = rooms[rooms.length - 1];
          if (key === 'MASTER BEDROOM' && attachedW > 0) {
            const mW = master.w || 0;
            const mH = master.h || 0;
            const preferHorizontal = (mW >= 14 && mH >= 13) || (mW < 13);
            if (preferHorizontal) {
              const aw = Math.min(7, Math.max(5, mW * 0.45));
              const ah = Math.min(7, Math.max(5, mH * 0.5));
              addRoom('ATTACHED TOILET', (master.x || 0) + mW - aw, (master.y || 0) + mH - ah, aw, ah, {
                attachedTo: master.id, subZoneOf: master.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'HORIZONTAL',
              });
            } else {
              const aw = Math.min(5, Math.max(4.5, mW * 0.35));
              const ah = Math.min(7, mH);
              addRoom('ATTACHED TOILET', (master.x || 0) + mW - aw, (master.y || 0), aw, ah, {
                attachedTo: master.id, subZoneOf: master.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'VERTICAL',
              });
            }
          }
          y += eachH;
        });
      }

      if (has('BALCONY')) {
        const living = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
        if (living && (living.w || 0) >= 5) {
          addRoom('BALCONY', living.x || 0, Math.max(0, (living.y || 0) - 4.5), Math.min(6, living.w || 6), 4.5, {
            subZoneOf: living.id, isSubRoom: true, isOpen: true, attachedTo: living.id, exteriorProjection: true,
          });
        }
      }

      // ✅ FINAL: Dynamic Duct Optimization (only if user selected DUCT)
      return optimizeWetCore(rooms);
    }
  }

  // -------- FRONT/ENTRY FALLBACK --------
  let livingY = H - frontDepth;
  let livingH = 0;
  if (hasParking) {
    const parking = scoreAndPlaceParking(usableW, frontDepth, W, H, parkingMode);
    addRoom('PARKING', parking.x, parking.y, parking.w, parking.h, {
      parkingShape: parking.shape, parkingZone: 'FRONT_ROAD_CONNECTED',
      vehicleFit: parking.vehicleFit, candidateScore: parking.score, parkingMode,
    });

    if (hasLiving) {
      const remainingW = Math.max(0, usableW - parking.w);
      if (remainingW >= minDim('LIVING ROOM')) {
        addRoom('LIVING ROOM', 0, H - frontDepth, remainingW, frontDepth, { entryZone: true, roadConnected: true });
      } else {
        livingH = Math.min(12, Math.max(10, middleDepth * 0.62));
        livingY = H - frontDepth - livingH;
        addRoom('LIVING ROOM', 0, livingY, usableW, livingH, { entryZone: true, roadConnected: true, behindParking: true });
      }
    }
  } else if (hasLiving) {
    livingH = frontDepth;
    addRoom('LIVING ROOM', 0, H - frontDepth, usableW, frontDepth, { entryZone: true, roadConnected: true });
  }

  const rearBottom = 0;
  let cursorY = rearBottom;
  const orderedBedrooms = [...bedrooms].sort((a, b) => a === 'MASTER BEDROOM' ? -1 : b === 'MASTER BEDROOM' ? 1 : 0);

  orderedBedrooms.forEach((key, idx) => {
    const remainingH = Math.max(0, privateDepth - cursorY);
    const targetH = idx === orderedBedrooms.length - 1 ? remainingH : clamp(roomArea(key, key === 'MASTER BEDROOM' ? 140 : 120) / usableW, minDim(key, false), Math.max(minDim(key, false), remainingH - 0.25));
    const h = Math.max(minDim(key, false), Math.min(remainingH, targetH));
    if (h < minDim(key, false)) return;

    let roomW = usableW;
    let attachedW = 0;
    if (key === 'MASTER BEDROOM' && hasAttached && usableW >= 15) {
      attachedW = clamp(usableW * 0.27, 4.5, 5.5);
      roomW = usableW - attachedW;
      if (roomW < minDim('MASTER BEDROOM')) { attachedW = 0; roomW = usableW; }
    }

    addRoom(key, 0, cursorY, roomW, h, {
      privateZone: true, requestedArea: roomArea(key, key === 'MASTER BEDROOM' ? 140 : 120), furnitureValidated: true,
    });
    if (key === 'MASTER BEDROOM' && attachedW > 0) {
      const master = rooms[rooms.length - 1];
      const mW = master.w || 0;
      const mH = master.h || 0;
      const preferHorizontal = (mW >= 14 && mH >= 13) || (mW < 13);
      if (preferHorizontal) {
        const aw = Math.min(7, Math.max(5, mW * 0.45));
        const ah = Math.min(7, Math.max(5, mH * 0.5));
        addRoom('ATTACHED TOILET', (master.x || 0) + mW - aw, (master.y || 0) + mH - ah, aw, ah, {
          attachedTo: key, subZoneOf: master.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'HORIZONTAL',
        });
      } else {
        const aw = Math.min(5, Math.max(4.5, mW * 0.35));
        const ah = Math.min(7, mH);
        addRoom('ATTACHED TOILET', (master.x || 0) + mW - aw, (master.y || 0), aw, ah, {
          attachedTo: key, subZoneOf: master.id, isSubRoom: true, serviceCore: true, ventilationRequired: true, orientation: 'VERTICAL',
        });
      }
    }
    cursorY += h + (idx < orderedBedrooms.length - 1 ? 0.25 : 0);
  });

  const middleY = privateDepth;
  const effectiveFrontDepth = frontDepth + livingH;
  const middleH = Math.max(7, H - privateDepth - effectiveFrontDepth);
  const stairW = hasStair ? clamp(stairSpec.requiredWidthFt || 5.5, 5.5, Math.min(7, W * 0.36)) : 0;
  const stairX = hasStair ? Math.max(0, W - stairW) : W;
  if (hasStair && middleH >= stairSpec.requiredLengthFt) {
    const stairH = Math.min(middleH, stairSpec.requiredLengthFt);
    const stairY = Math.max(middleY, H - effectiveFrontDepth - stairH);
    addRoom('STAIRCASE', stairX, stairY, stairW, stairH, {
      staircaseType: stairSpec.staircaseType, staircaseSpec: stairSpec, verticalCore: true,
      accessSide: 'BOTTOM', landingRequired: true, upperFloorCore: true,
    });
  }

  const serviceRight = hasStair ? stairX : W;
  const wetW = hasCommon ? Math.min(4.5, Math.max(4.0, serviceRight - 7.0)) : 0;
  const ductW = hasCommon ? 1.5 : 0;
  const foodW = Math.max(7.0, serviceRight);

  if (hasKD) {
    const sideCoreW = hasCommon ? wetW + ductW : 0;
    const effectiveKDWidth = serviceRight - sideCoreW;
    const minKD = min('KITCHEN CUM DINING');
    const targetKD = roomArea('KITCHEN CUM DINING', 130);

    const toiletH = Math.min(7, middleH * 0.48);
    const canUseDuct = hasCommon && ductW >= 1.5 && serviceRight - (wetW + ductW) >= minKD.minWidth;

    if (hasCommon && effectiveKDWidth >= minKD.minWidth && middleH >= minKD.minDepth + 0.25) {
      addRoom('KITCHEN CUM DINING', 0, middleY, effectiveKDWidth, middleH, {
        ventilationEdge: 'LEFT', diningAdjacent: true, serviceZone: true, requestedArea: targetKD,
      });
      const commonX = effectiveKDWidth;
      if (wetW >= 4.5 && toiletH >= 7) {
        addRoom('COMMON TOILET', commonX, middleY, wetW, toiletH, {
          serviceCore: true, privacy: 'LANDING_SIDE_AVOIDED', ventilationRequired: true,
          ventilationEdge: canUseDuct ? 'DUCT' : 'RIGHT',
        });
        // ✅ REMOVED: Hardcoded DUCT placement
      }
    } else {
      addRoom('KITCHEN CUM DINING', 0, middleY, serviceRight, middleH, {
        ventilationEdge: 'LEFT', diningAdjacent: true, serviceZone: true, requestedArea: targetKD,
      });
      if (hasCommon) {
        const toiletH = Math.min(7, middleH);
        const free = findFreeRectangle(rooms, W, H, wetW, toiletH, middleY, H - frontDepth);
        if (free) addRoom('COMMON TOILET', free.x, free.y, wetW, toiletH, { serviceCore: true, privacy: 'LANDING_SIDE_AVOIDED', ventilationRequired: true });
      }
    }
  } else if (hasKitchen && hasDining && foodW >= 13.5) {
    const kitchenW = Math.max(7, foodW * 0.52);
    addRoom('KITCHEN', 0, middleY, kitchenW, middleH, { requestedArea: roomArea('KITCHEN', 70), ventilationEdge: 'LEFT', serviceZone: true });
    addRoom('DINING', kitchenW, middleY, foodW - kitchenW, middleH, { adjacentTo: 'KITCHEN', circulationSide: 'LIVING' });
  } else if (hasKitchen) {
    addRoom('KITCHEN', 0, middleY, foodW, middleH, { requestedArea: roomArea('KITCHEN', 70), ventilationEdge: 'LEFT', serviceZone: true });
  } else if (hasDining) {
    addRoom('DINING', 0, middleY, foodW, middleH, { circulationSide: 'LIVING' });
  }

  if (hasCommon && !hasKD && !rooms.some(r => canonical(r.name) === 'COMMON TOILET')) {
    const toiletH = Math.min(7, middleH);
    const free = findFreeRectangle(rooms, W, H, wetW, toiletH, middleY, H - frontDepth);
    if (free) addRoom('COMMON TOILET', free.x, free.y, wetW, toiletH, { serviceCore: true, privacy: 'LANDING_SIDE_AVOIDED', ventilationRequired: true });
  }

  const placedBedroomCount = rooms.filter(r => ['MASTER BEDROOM', 'BEDROOM'].includes(canonical(r.name))).length;
  if (placedBedroomCount < bedrooms.length) {
    for (let i = placedBedroomCount; i < bedrooms.length; i++) {
      const key = bedrooms[i];
      const target = fit(key, roomArea(key, key === 'MASTER BEDROOM' ? 140 : 120), W, Math.max(10, middleH - 0.5));
      const free = findFreeRectangle(rooms, W, H, target.w, target.h, middleY, H - frontDepth);
      if (free) addRoom(key, free.x, free.y, target.w, target.h, { fallbackPlacement: true });
    }
  }

  if (has('POOJA ROOM')) {
    const free = findFreeRectangle(rooms, W, H, 5, 5, middleY, H - frontDepth);
    if (free) addRoom('POOJA ROOM', free.x, free.y, 5, 5, { optionalZone: true });
  }
  if (has('UTILITY')) {
    const free = findFreeRectangle(rooms, W, H, 4, 6, middleY, H - frontDepth);
    if (free) addRoom('UTILITY', free.x, free.y, 4, 6, { optionalZone: true, ventilationRequired: true });
  }
  if (has('BALCONY')) {
    const living = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
    if (living && (living.w || 0) >= 5 && (living.h || 0) >= 5) {
      addRoom('BALCONY', living.x || 0, living.y || 0, Math.min(6, living.w || 6), Math.min(5, living.h || 5), { subZoneOf: living.id, isOpen: true, attachedTo: living.id });
    }
  }

  // ✅ FINAL: Dynamic Duct Optimization (only if user selected DUCT)
  return optimizeWetCore(rooms);
}

// 20. Rectangle Overlap Checker
function rectanglesOverlap(a: any, b: any): boolean {
  return Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + 0.05 && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) + 0.05;
}

// 21. Free Rectangle Finder
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

// 22. Parking Sizer
function scoreAndPlaceParking(W: number, frontDepth: number, plotW: number, plotH: number, parkingMode: ParkingMode = 'CAR') {
  const c = selectParkingCandidate(plotW, plotH, frontDepth, parkingMode);
  return {
    x: c.x, y: plotH - c.depth, w: c.width, h: c.depth,
    shape: c.type, vehicleFit: c.vehicleFit, score: c.score,
    parkingMode: c.parkingMode, bikeZone: c.bikeZone,
    pedestrianZone: c.pedestrianZone, minimumArea: c.area,
  };
}

// 23. Furniture Validator
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

// 24. Main Export Function
export function generateArchitecturalFloorPlan(request: ArchitecturalPlanRequest): ArchitecturalPlanResult {
  const W = Math.max(1, n(request.width, 20));
  const H = Math.max(1, n(request.length, 40));
  const floorName = clean(request.floorName);
  const ground = floorName.includes('GROUND');
  const mode = clean(request.planningMode || 'AUTO');
  const area = n(request.planningArea, W * H);
  const orientation = getRoadOrientation(request.roadSide || '1 SIDE ROAD (SOUTH)');
  const specs = extractSpecs(request.selectedRooms);
  const program = programFromInput(request.selectedRooms, request.bhk || 'AUTO', area, ground, mode, W, H);

  if (specs.length === 0 && ground && program.includes('LIVING ROOM') && program.includes('STAIRCASE')) {
    specs.push({ key: 'STAIRCASE', count: 1, areaMode: 'AUTO', embedIn: 'LIVING ROOM' } as any);
  }

  const stairType = chooseStairType(W, H);
  const staircase = calculateStaircase(n(request.floorToFloorHeightFeet, 10), 6.8, stairType);
  const parkingMode = (String(request.parkingMode || 'CAR').toUpperCase() as ParkingMode);
  const rawRooms = buildResidentialLayout(program, specs, W, H, ground, staircase, parkingMode, undefined);
  // ✅ Dynamic Duct Optimization already applied inside buildResidentialLayout
  const rooms = rawRooms;

  if (typeof console !== 'undefined') {
    console.groupCollapsed('[ROOM PLANNER] INPUT → PROGRAM');
    console.log('FLOOR:', floorName, { W, H, area, mode, ground });
    console.log('RAW selectedRooms:', request.selectedRooms);
    console.log('EXTRACTED specs:', specs.map(s => ({
      key: s.key,
      count: s.count,
      width: s.width,
      length: s.length,
      embedIn: s.embedIn,
    })));
    console.log('FINAL program:', program);
    console.log('stairEmbeddedInLiving:', specs.some(s => s.key === 'STAIRCASE' && s.embedIn === 'LIVING ROOM'));

    const stairRoom = rooms.find(r => canonical(r.name) === 'STAIRCASE');
    if (stairRoom) {
      console.log('[STAIRCASE PLACED]', {
        x: stairRoom.x, y: stairRoom.y, w: stairRoom.w, h: stairRoom.h,
        placedAtCorner: (stairRoom as any).placedAtCorner,
        entrySide: (stairRoom as any).entrySide,
        collisionChecked: (stairRoom as any).collisionChecked,
        subZoneOf: (stairRoom as any).subZoneOf,
      });
    }
    const ductRoom = rooms.find(r => canonical(r.name) === 'DUCT');
    if (ductRoom) {
      console.log('[DUCT PLACED]', {
        x: ductRoom.x, y: ductRoom.y, w: ductRoom.w, h: ductRoom.h,
        ventilationFor: (ductRoom as any).ventilationFor,
        servesRooms: (ductRoom as any).servesRooms,
      });
    }
    console.groupEnd();
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  const furnitureChecks: ArchitecturalPlanResult['furnitureChecks'] = [];

  const requestedCounts = roomCounts(program);
  const presentCounts = roomCounts(rooms.map(r => canonical(r.name)));
  for (const [key, wanted] of Object.entries(requestedCounts)) {
    const got = key === 'BATHROOM'
      ? (presentCounts['BATHROOM'] || 0) + (presentCounts['ATTACHED TOILET'] || 0)
      : (presentCounts[key] || 0);
    if (got < wanted) errors.push(`${floorName}: REQUIRED ROOM MISSING → ${key}. Requested ${wanted}, generated ${got}.`);
  }

  if (ground && mode === 'AUTO' && area > 750) {
    if ((presentCounts['ATTACHED TOILET'] || 0) !== 1) errors.push(`${floorName}: AUTO >750 SQ.FT requires exactly 1 ATTACHED TOILET.`);
    if ((presentCounts['COMMON TOILET'] || 0) !== 1) errors.push(`${floorName}: AUTO >750 SQ.FT requires exactly 1 COMMON TOILET.`);
  }

  for (const room of rooms) {
    const x = n(room.x), y = n(room.y), w = n(room.w), h = n(room.h);
    if (x < -0.01 || y < -0.01 || x + w > W + 0.01 || y + h > H + 0.01) {
      errors.push(`${floorName}: ${room.name} exceeds planning boundary.`);
    }
    const fit = validateFurniture(room);
    furnitureChecks.push({ room: room.name || 'ROOM', ok: fit.ok, note: fit.note });
    if (!fit.ok) warnings.push(`${floorName}: ${fit.note}`);
  }

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if ((rooms[i] as any).subZoneOf === rooms[j].id || (rooms[j] as any).subZoneOf === rooms[i].id) continue;
      if ((rooms[i] as any).isSubRoom || (rooms[j] as any).isSubRoom) continue;
      if (overlap(rooms[i], rooms[j])) errors.push(`${floorName}: SPATIAL OVERLAP → ${rooms[i].name} / ${rooms[j].name}.`);
    }
  }

  const stairRoomCheck = rooms.find(r => canonical(r.name) === 'STAIRCASE');
  if (stairRoomCheck) {
    for (const other of rooms) {
      if (other === stairRoomCheck) continue;
      if ((other as any).subZoneOf || (other as any).isSubRoom) continue;
      const ox = Math.min((stairRoomCheck.x || 0) + (stairRoomCheck.w || 0), (other.x || 0) + (other.w || 0)) - Math.max(stairRoomCheck.x || 0, other.x || 0);
      const oy = Math.min((stairRoomCheck.y || 0) + (stairRoomCheck.h || 0), (other.y || 0) + (other.h || 0)) - Math.max(stairRoomCheck.y || 0, other.y || 0);
      if (ox > 0.25 && oy > 0.25) {
        const isParent = (stairRoomCheck as any).subZoneOf === other.id;
        if (!isParent) {
          warnings.push(`${floorName}: STAIRCASE overlaps ${other.name} — check placement.`);
        }
      }
    }
  }

  const parking = rooms.find(r => canonical(r.name) === 'PARKING');
  if (ground && parking && Math.abs((parking.y || 0) + (parking.h || 0) - H) > 0.2) {
    errors.push(`${floorName}: PARKING is not on the normalized road/front edge.`);
  }
  if (parking && (!(parking as any).vehicleFit || (parking.w || 0) < 9 || (parking.h || 0) < 10)) {
    warnings.push(`${floorName}: parking candidate is below preferred car-bay clearance; it must not be treated as a full car bay.`);
  }

  if (staircase.actualRiserInches < 6 || staircase.actualRiserInches > 7.5) {
    errors.push(`${floorName}: Stair riser ${staircase.actualRiserInches}" is outside the configured practical range.`);
  }
  if (staircase.treadInches < 10) errors.push(`${floorName}: Stair tread ${staircase.treadInches}" is below configured minimum.`);

  const solid = rooms.filter(r => !['DUCT', 'PARKING'].includes(canonical(r.name)) && !(r as any).subZoneOf && !String(r.name || '').includes('OPEN TERRACE'));
  const roots = solid.filter(r => ['LIVING ROOM', 'PASSAGE', 'STAIRCASE'].includes(canonical(r.name)));
  const visited = new Set<FloorRoom>();
  const queue = roots.length ? [...roots] : solid.slice(0, 1);
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const other of solid) {
      if (visited.has(other)) continue;
      const touch = Math.abs((current.x! + current.w!) - other.x!) < 0.2 || Math.abs((other.x! + other.w!) - current.x!) < 0.2 || Math.abs((current.y! + current.h!) - other.y!) < 0.2 || Math.abs((other.y! + other.h!) - current.y!) < 0.2;
      const overlapSpan = (Math.min(current.x! + current.w!, other.x! + other.w!) - Math.max(current.x!, other.x!)) > 0.25 || (Math.min(current.y! + current.h!, other.y! + other.h!) - Math.max(current.y!, other.y!)) > 0.25;
      if (touch && overlapSpan) queue.push(other);
    }
  }
  for (const room of solid) if (!visited.has(room)) errors.push(`${floorName}: ROOM ACCESS DISCONNECTED → ${room.name}.`);

  if (ground && parking) {
    const living = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
    if (living) {
      const touching = Math.abs((parking.x! + parking.w!) - living.x!) < 0.2 || Math.abs((living.x! + living.w!) - parking.x!) < 0.2 || Math.abs((parking.y! + parking.h!) - living.y!) < 0.2 || Math.abs((living.y! + living.h!) - parking.y!) < 0.2;
      if (!touching) warnings.push(`${floorName}: Parking does not directly touch living/entry zone; opening planner cannot create a direct internal connection.`);
    }
  }

  let score = 100;
  score -= errors.length * 15;
  score -= furnitureChecks.filter(x => !x.ok).length * 3;
  score = Math.max(0, score);

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

// 25. Helper for Program Generation
export function roomProgramForFloor(selectedRooms: any, bhk: string, floorArea: number, isGround: boolean, mode: string, width = 0, length = 0): string[] {
  return programFromInput(selectedRooms, bhk, floorArea, isGround, mode, width, length);
}