/* =========================================================
   CONSTRUCTION PLAN SYSTEM — SINGLE RESIDENTIAL ROOM PLANNER
   ✅ FORMULA-BASED | PROPORTIONAL | ANY PLOT SIZE
   ✅ UPDATED: Pure formulas moved to layoutFormulas.ts
========================================================= */

import { FloorRoom, PlanningMode, ParkingMode, CandidateStrategy } from './planningTypes';
import { BHK_PRESETS, getRoomDefinition } from './roomRules';
import { calculateStaircase, fitStaircaseToZone, adaptStairToFloorHeight, StaircaseType, StaircaseFootprint } from './stairPlanner';
import { getRoadOrientation } from './roadOrientation';
import { selectParkingCandidate } from './parkingPlanner';
import { optimizeWetCore } from './ductPlanner';

// ✅ NEW: All pure formulas imported from layoutFormulas.ts
import {
  n,
  clean,
  clamp,
  canonical,
  PRACTICAL_ROOM_RULES,
  getStandardRoomSizes,
  getParkingWidth,
  getCommonToiletOrientation,
  getAttachedToiletOrientation,
  furnitureAssumptions,
  fitRectForArea,
  getFlightDirectionForCorner,
  type PracticalRoomRule,
  type StairCorner,
  type StairFlightDirection,
  type StairFace,
} from './layoutFormulas';

// ✅ Re-export for backward compatibility
export { PRACTICAL_ROOM_RULES };
export type { PracticalRoomRule };

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
  /** Ground par final hui stair ka spec (type, flight width, treads, riser count). Upar ki floors/tower isi ko reuse karti hain. */
  groundStairSpec?: StaircaseFootprint;
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

// ============================================================
// HELPERS (only those NOT in layoutFormulas.ts)
// ============================================================

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

// ============================================================
// ROOM FACTORY
// ============================================================
function makeRoom(key: string, index: number, x: number, y: number, w: number, h: number, extras: any = {}): FloorRoom {
  const roomType = key === 'LIVING ROOM' ? 'living' : key === 'PARKING' ? 'parking' : key === 'STAIRCASE' ? 'stairs' : key === 'DUCT' ? 'duct' : key.includes('TOILET') || key === 'BATHROOM' || key.includes('ATTACHED BATH') ? 'toilet' : key === 'PASSAGE' ? 'passage' : key.toLowerCase().replace(/\s+/g, '-');

  const minDim = Math.min(w, h);
  const fontSize = Math.max(6, Math.min(12, minDim * 0.8));
  const labelPadding = 0.3;

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
    labelFontSize: fontSize,
    labelPadding,
    labelAnchor: 'middle',
    labelBaseline: 'middle',
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
// ✅ NARROW PLOT HELPERS
// ============================================================
/** Is width se kam wale GROUND floor par (common toilet ke saath) auto program me attached toilet nahi jodte */
export const GROUND_ATTACHED_MIN_W_FT = 12;
/** Is width se kam par attached toilet horizontal, door wali wall par aata hai (vertical strip nahi) */
/** Toilet/bathroom door ko wall ke corner se itna door rakho (frame + hinge ke liye) */
export const DOOR_WALL_CLEARANCE_FT = 0.75;
export const ATTACHED_VERTICAL_MIN_W_FT = 15; // ground (verticalAttached) aur upper floors dono yahi use karte hain

type DoorSideToiletPlan = {
  toilet: null | {
    x: number; y: number; w: number; h: number;
    door: any; window: any;
  };
  /** Bedroom door ka offset (door wali wall par, bedroom ke left se) */
  doorOffset: number;
};

/**
 * Bedroom ki DOOR WALI wall par horizontal attached toilet.
 *   doorWall = 'BOTTOM' -> toilet bedroom ke neeche (passage side)
 *   doorWall = 'TOP'    -> toilet bedroom ke upar (passage side)
 * Door wall ka ek hissa toilet leta hai, baaki hissa door ke liye. Bedroom poori width
 * rehta hai -> koi wasted strip nahi banti.
 */
function planDoorSideToilet(
  bx: number, by: number, bw: number, bh: number,
  doorWall: 'TOP' | 'BOTTOM',
  doorW = 3.0,
  minToiletW = 4.5,
  maxToiletW = 6.5,
  toiletH = 5.0,
): DoorSideToiletPlan {
  const centered = bx + Math.max(0.3, (bw - doorW) / 2);

  let tw = Math.min(maxToiletW, Math.max(minToiletW, bw - doorW - 1.0));
  if (bw - tw < doorW + 0.5) tw = bw - doorW - 0.5;

  // ✅ DYNAMIC DEPTH: bedroom jitna gehra, toilet utna bada (5 ft se 7 ft),
  // par bedroom ke liye kam se kam 5 ft depth hamesha bachti hai.
  const dynH = Math.min(7.0, Math.max(toiletH, (bh - 5.0) * 0.45 + 2.0));
  const th = Math.min(dynH, bh - 5.0);
  if (tw < 4 || th < 4) return { toilet: null, doorOffset: centered - bx };

  const ty = doorWall === 'BOTTOM' ? by + bh - th : by;
  const doorOffset = tw + Math.max(0.3, (bw - tw - doorW) / 2);

  return {
    toilet: {
      x: bx, y: ty, w: tw, h: th,
      // toilet ka door bedroom ki taraf kholta hai
      door: {
        id: 'att_door_bedroom',
        wall: doorWall === 'BOTTOM' ? 'TOP' : 'BOTTOM',
        widthFeet: 2.5,
        // ✅ Door centre me nahi: corner ke paas (sirf swing ke liye jagah) -> baaki wall fixtures ke liye
        offsetFeet: Math.min(DOOR_WALL_CLEARANCE_FT, Math.max(0.3, tw - 2.5 - 0.3)),
        doorType: 'TOILET', renderSymbol: true, swingInside: true,
      },
      // external (left) wall par ventilation
      window: {
        id: 'att_vent_left',
        wall: 'LEFT',
        lengthFeet: 2,
        offsetFeet: Math.max(0.3, th / 2 - 1),
      },
    },
    doorOffset,
  };
}

// ============================================================
// STAIRCASE CORNER CHOOSER (uses getFlightDirectionForCorner from layoutFormulas)
// ============================================================
type Rect = { x: number; y: number; w: number; h: number };

type StairPlacement = {
  corner: StairCorner;
  x: number;
  y: number;
  relativeX: number;
  relativeY: number;
  flightDirection: StairFlightDirection;
  entryFace: StairFace;
  exitFace: StairFace;
  usable: boolean;
  usabilityReason: string;
  /** Pehli riser ke samne ka khuda (walkable) rectangle */
  entryClearance?: Rect;
  violations?: string[];
};

/** Door / pehli riser ke samne kam se kam itna free chahiye (ft) */
const STAIR_CLEAR_DEPTH_FT = 3.0;
/** Passage <-> living khula edge: stair ke baad kam se kam itna free chahiye (ft) */
const MIN_OPEN_EDGE_FREE_FT = 3.5;
/** Stair ke bagal me circulation ke liye min free width (ft) */
const MIN_SIDE_WALK_FT = 3.0;

const R_EPS = 0.05;
const rectsOverlap = (a: Rect, b: Rect) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > R_EPS &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > R_EPS;
const overlapArea = (a: Rect, b: Rect) => {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ox > 0 && oy > 0 ? ox * oy : 0;
};
const rectGap = (a: Rect, b: Rect) => {
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
  return Math.hypot(dx, dy);
};
const asRect = (r: FloorRoom): Rect => ({ x: r.x || 0, y: r.y || 0, w: r.w || 0, h: r.h || 0 });

/**
 * Living room ke har access point ko collect karta hai:
 *  - doorZones : living ki wall par jo bhi door/opening hai (parking, kitchen ...) + 3 ft swing/walk zone
 *  - openEdges : PASSAGE jo living se khuli judi hai (poora shared edge walkway hai)
 * Stair in dono ko block nahi kar sakti.
 */
function collectLivingAccess(living: FloorRoom, rooms: FloorRoom[]) {
  const L = asRect(living);
  const D = STAIR_CLEAR_DEPTH_FT;
  const T = 0.2;
  const doorZones: Array<{ id: string; rect: Rect; seg: Rect }> = [];
  const openEdges: Array<{ id: string; seg: Rect; band: Rect; vertical: boolean }> = [];

  const bandFor = (seg: Rect): Rect | null => {
    if (seg.h === 0) {
      if (Math.abs(seg.y - L.y) <= T) return { x: seg.x, y: L.y, w: seg.w, h: D };
      if (Math.abs(seg.y - (L.y + L.h)) <= T) return { x: seg.x, y: L.y + L.h - D, w: seg.w, h: D };
    } else if (seg.w === 0) {
      if (Math.abs(seg.x - L.x) <= T) return { x: L.x, y: seg.y, w: D, h: seg.h };
      if (Math.abs(seg.x - (L.x + L.w)) <= T) return { x: L.x + L.w - D, y: seg.y, w: D, h: seg.h };
    }
    return null;
  };
  const clipToLiving = (seg: Rect): Rect | null => {
    if (seg.h === 0) {
      const x0 = Math.max(seg.x, L.x), x1 = Math.min(seg.x + seg.w, L.x + L.w);
      return x1 - x0 > 0.1 ? { x: x0, y: seg.y, w: x1 - x0, h: 0 } : null;
    }
    const y0 = Math.max(seg.y, L.y), y1 = Math.min(seg.y + seg.h, L.y + L.h);
    return y1 - y0 > 0.1 ? { x: seg.x, y: y0, w: 0, h: y1 - y0 } : null;
  };
  const doorSeg = (r: FloorRoom, d: any): Rect | null => {
    const off = Number(d.offsetFeet) || 0;
    const wd = Number(d.widthFeet) || 0;
    const R = asRect(r);
    switch (String(d.wall || '').toUpperCase()) {
      case 'TOP': return { x: R.x + off, y: R.y, w: wd, h: 0 };
      case 'BOTTOM': return { x: R.x + off, y: R.y + R.h, w: wd, h: 0 };
      case 'LEFT': return { x: R.x, y: R.y + off, w: 0, h: wd };
      case 'RIGHT': return { x: R.x + R.w, y: R.y + off, w: 0, h: wd };
    }
    return null;
  };

  for (const r of rooms) {
    if (canonical(r.name) === 'PASSAGE') continue;
    for (const d of (r.doors || [])) {
      if ((d as any).isExternalOpening) continue;
      const raw = doorSeg(r, d);
      if (!raw) continue;
      const seg = clipToLiving(raw);
      if (!seg) continue;
      const rect = bandFor(seg);
      if (!rect) continue;
      doorZones.push({ id: `${r.name}:${(d as any).id || (d as any).entryRole || d.wall}`, rect, seg });
    }
  }

  for (const r of rooms) {
    if (canonical(r.name) !== 'PASSAGE') continue;
    const P = asRect(r);
    let seg: Rect | null = null;
    if (Math.abs(P.y + P.h - L.y) <= T) seg = { x: Math.max(P.x, L.x), y: L.y, w: Math.min(P.x + P.w, L.x + L.w) - Math.max(P.x, L.x), h: 0 };
    else if (Math.abs(P.y - (L.y + L.h)) <= T) seg = { x: Math.max(P.x, L.x), y: L.y + L.h, w: Math.min(P.x + P.w, L.x + L.w) - Math.max(P.x, L.x), h: 0 };
    else if (Math.abs(P.x + P.w - L.x) <= T) seg = { x: L.x, y: Math.max(P.y, L.y), w: 0, h: Math.min(P.y + P.h, L.y + L.h) - Math.max(P.y, L.y) };
    else if (Math.abs(P.x - (L.x + L.w)) <= T) seg = { x: L.x + L.w, y: Math.max(P.y, L.y), w: 0, h: Math.min(P.y + P.h, L.y + L.h) - Math.max(P.y, L.y) };
    if (!seg || (seg.h === 0 ? seg.w : seg.h) < 0.5) continue;
    const band = bandFor(seg);
    if (band) openEdges.push({ id: r.id || 'PASSAGE', seg, band, vertical: seg.w === 0 });
  }
  return { doorZones, openEdges };
}

/**
 * STAIR PLACEMENT (clearance based)
 * Har corner x entry face (BOTTOM/TOP) test hota hai. Hard rules:
 *   1. stair living ke andar, kisi dusre room (kitchen/parking/toilet/passage) par nahi
 *   2. kisi door / opening (parking, kitchen) ka 3 ft zone block nahi
 *   3. passage <-> living khula edge: stair ke baad >= 3.5 ft free
 *   4. PEHLI RISER ke samne 3 ft walkable jagah (living ya passage) — wall/room se ghira nahi
 *   5. stair ke bagal me >= 3 ft walkway
 * Koi bhi corner pass na kare to sabse kam violation wala chuna jaata hai aur usable=false hota hai
 * (taaki warning dikhe, chup-chaap galat jagah stair na bane).
 */
function chooseStaircaseCorner(
  livingRoom: FloorRoom,
  stairW: number,
  stairH: number,
  existingRooms: FloorRoom[],
  existingDoors: any[],
  stairType: StaircaseType,
): StairPlacement | null {
  void existingDoors; void stairType;
  const L = asRect(livingRoom);
  const sW = Math.min(stairW, L.w);
  const sH = Math.min(stairH, L.h);
  if (sW <= 0 || sH <= 0) return null;

  const { doorZones, openEdges } = collectLivingAccess(livingRoom, existingRooms);
  const passages = existingRooms.filter(r => canonical(r.name) === 'PASSAGE');
  const solids = existingRooms.filter(r =>
    r !== livingRoom && canonical(r.name) !== 'PASSAGE' && !(r as any).isSubRoom && !(r as any).subZoneOf);

  const xs: Array<{ n: 'LEFT' | 'RIGHT'; x: number }> = [
    { n: 'LEFT', x: L.x }, { n: 'RIGHT', x: L.x + L.w - sW },
  ];
  const ys: Array<{ n: 'TOP' | 'BOTTOM'; y: number }> = [
    { n: 'TOP', y: L.y }, { n: 'BOTTOM', y: L.y + L.h - sH },
  ];
  const faces: Array<'BOTTOM' | 'TOP'> = ['BOTTOM', 'TOP'];

  type Cand = { placement: StairPlacement; weight: number; score: number };
  const cands: Cand[] = [];

  for (const yy of ys) for (const xx of xs) for (const face of faces) {
    const stair: Rect = { x: xx.x, y: yy.y, w: sW, h: sH };
    const violations: string[] = [];
    let weight = 0;

    for (const r of solids) {
      if (rectsOverlap(stair, asRect(r))) { violations.push(`overlaps ${r.name}`); weight += 100; }
    }
    for (const p of passages) {
      if (rectsOverlap(stair, asRect(p))) { violations.push('overlaps PASSAGE'); weight += 100; }
    }
    for (const dz of doorZones) {
      if (rectsOverlap(stair, dz.rect)) { violations.push(`blocks door ${dz.id}`); weight += 50; }
    }
    for (const oe of openEdges) {
      if (!rectsOverlap(stair, oe.band)) continue;
      const segLen = oe.vertical ? oe.seg.h : oe.seg.w;
      const a0 = oe.vertical ? oe.seg.y : oe.seg.x;
      const a1 = a0 + segLen;
      const s0 = oe.vertical ? stair.y : stair.x;
      const s1 = s0 + (oe.vertical ? stair.h : stair.w);
      const covered = Math.max(0, Math.min(a1, s1) - Math.max(a0, s0));
      const free = segLen - covered;
      if (free < Math.min(MIN_OPEN_EDGE_FREE_FT, segLen) - 0.01) {
        violations.push(`blocks passage opening (free ${free.toFixed(2)} ft)`); weight += 50;
      }
    }

    const side = L.w - sW;
    if (side < MIN_SIDE_WALK_FT - 0.01) { violations.push(`side walkway ${side.toFixed(2)} ft`); weight += 20; }

    const entry: Rect = face === 'BOTTOM'
      ? { x: stair.x, y: stair.y + stair.h, w: stair.w, h: STAIR_CLEAR_DEPTH_FT }
      : { x: stair.x, y: stair.y - STAIR_CLEAR_DEPTH_FT, w: stair.w, h: STAIR_CLEAR_DEPTH_FT };
    const walkable = overlapArea(entry, L) + passages.reduce((a, p) => a + overlapArea(entry, asRect(p)), 0);
    const need = entry.w * entry.h;
    if (walkable < need - 0.3) {
      violations.push(`1st riser (${face}) ke samne 3 ft free nahi (${walkable.toFixed(1)}/${need.toFixed(1)} sqft)`);
      weight += 40;
    }

    let slack = 6;
    for (const dz of doorZones) slack = Math.min(slack, rectGap(stair, dz.seg));
    for (const oe of openEdges) slack = Math.min(slack, rectGap(stair, oe.seg));

    const corner = `${yy.n}-${xx.n}` as StairCorner;
    const placement: StairPlacement = {
      corner, x: xx.x, y: yy.y,
      relativeX: xx.x - L.x, relativeY: yy.y - L.y,
      flightDirection: face === 'BOTTOM' ? 'UP' : 'DOWN',
      entryFace: face,
      exitFace: face === 'BOTTOM' ? 'TOP' : 'BOTTOM',
      usable: violations.length === 0,
      usabilityReason: violations.length === 0
        ? `OK: ${corner}, entry ${face} (3 ft clear), doors & passage free`
        : violations.join('; '),
      entryClearance: entry,
      violations,
    };
    cands.push({ placement, weight, score: weight * 1000 + (face === 'TOP' ? 5 : 0) + (xx.n === 'RIGHT' ? 0.1 : 0) - slack });
  }

  cands.sort((a, b) => a.score - b.score);
  const best = cands[0]?.placement ?? null;
  if (best) {
    console.log(best.usable ? '[CHOOSE STAIR] ✅' : '[CHOOSE STAIR] ⚠️ NO CLEAN SPOT', best);
  }
  return best;
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

      out.push({ key: 'LIVING ROOM', count: 1, areaMode, areaPerRoom, width, length } as RoomSpec);
      out.push({
        key: 'STAIRCASE', count: 1, areaMode: 'AUTO', areaPerRoom: 65,
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
        key: 'STAIRCASE', count: 1, areaMode: 'AUTO', areaPerRoom: 65,
        embedIn: 'LIVING ROOM', position: 'TOP-RIGHT',
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
  // ✅ FIX: 10x40 jaise narrow ground floor par common toilet hai -> auto program me attached toilet nahi
  const groundAttachedOk = !(W > 0 && W < GROUND_ATTACHED_MIN_W_FT);

  console.log(`[PROGRAM FROM INPUT] START floor=${ground ? 'GROUND' : 'UPPER'}, layoutW=${W}, layoutH=${L}, area=${area}, hasExplicit=${hasExplicit}, auto=${auto}`);

  if (!hasExplicit && auto) {
    if (ground) {
      if (area <= 1200) {
        add('MASTER BEDROOM'); if (groundAttachedOk) add('ATTACHED TOILET'); add('COMMON TOILET');
        add('KITCHEN CUM DINING'); add('LIVING ROOM'); add('PARKING'); add('STAIRCASE');
      } else if (area <= 1500) {
        add('MASTER BEDROOM'); add('BEDROOM'); if (groundAttachedOk) add('ATTACHED TOILET');
        add('COMMON TOILET'); add('KITCHEN CUM DINING'); add('LIVING ROOM');
        add('PARKING'); add('STAIRCASE');
      } else {
        add('MASTER BEDROOM'); add('BEDROOM'); if (groundAttachedOk) add('ATTACHED TOILET');
        add('COMMON TOILET'); add('KITCHEN'); add('DINING'); add('LIVING ROOM');
        add('PARKING'); add('STAIRCASE'); add('POOJA ROOM'); add('UTILITY');
      }
        } else {
      if (W >= 10) {
        add('FRONT BEDROOM'); add('REAR BEDROOM');
        add('FRONT ATTACHED BATH'); add('REAR ATTACHED BATH');
        add('STAIRCASE');
      } else if (W >= 8) {
        add('FRONT BEDROOM'); add('REAR BEDROOM'); add('STAIRCASE');
      } else if (W >= 6) {
        add('FRONT BEDROOM'); add('STAIRCASE');
      } else if (W >= 4.5) {
        add('LIVING ROOM'); add('STAIRCASE');
      } else {
        add('LIVING ROOM'); add('STAIRCASE');
      }
    }
  }

  if (auto && hasExplicit) {
    if (!result.includes('LIVING ROOM')) add('LIVING ROOM');
    if (ground && !result.includes('KITCHEN') && !result.includes('KITCHEN CUM DINING')) {
      const kitchenSpec = explicit.find(s => s.key === 'KITCHEN' || s.key === 'KITCHEN CUM DINING');
      if (kitchenSpec) add('KITCHEN');
    }
    if (ground && area >= 500 && !result.includes('PARKING')) add('PARKING');
    const hasLivingStairCombo = explicit.some(s => s.key === 'STAIRCASE' && s.embedIn === 'LIVING ROOM');
    if (!hasLivingStairCombo && !result.includes('STAIRCASE')) add('STAIRCASE');
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
    hasExplicit, auto, ground, W, L, area,
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

// ============================================================
// ✅ AUTO STAIR TYPE SELECTION
// ============================================================
function selectBestStairType(
  W: number,
  H: number,
  availableStairW: number,
  availableStairH: number,
  floorHeightFt: number,
): {
  stairType: StaircaseType;
  stairSpec: ReturnType<typeof calculateStaircase>;
  reason: string;
  alternatives: Array<{ type: StaircaseType; reason: string; valid: boolean }>;
} {
  void W; void H;
  // ✅ Rise/tread dynamic -> footprint -> zone fit + min 4 ft passage (stairPlanner.fitStaircaseToZone)
  const fit = fitStaircaseToZone(floorHeightFt, {
    floorWidthFt: availableStairW,
    zoneLengthFt: availableStairH,
    minPassageFt: 4,
    passageMode: 'SIDE_OR_END',
  });

  const reason = `${fit.staircaseType} [${fit.extension}] ${fit.spec.requiredWidthFt}x${fit.spec.requiredLengthFt}ft, ` +
    `riser ${fit.spec.actualRiserInches}" x ${fit.spec.riserCount}, tread ${fit.spec.treadInches}" ` +
    `| side ${fit.sidePassageFt}ft end ${fit.endPassageFt}ft | ${fit.notes.join(' ')}`;

  console.log('[AUTO STAIR SELECT] ✅', { type: fit.staircaseType, extension: fit.extension, reason });

  return {
    stairType: fit.staircaseType,
    stairSpec: fit.spec,
    reason,
    alternatives: [{ type: fit.staircaseType, reason, valid: fit.fits && fit.passageOk }],
  };
}

// ============================================================
// HELPER: Resolve inherited stair position
// ============================================================
function resolveInheritedStairPosition(args: {
  livingX: number; livingY: number; livingW: number; livingH: number;
  stairW: number; stairH: number;
  userInheritedX: number | null; userInheritedY: number | null;
  groundStairPosition?: { x: number; y: number };
  groundStairRelativeOffset?: { dx: number; dy: number };
  fallbackPosition: string;
}): { x: number; y: number; rule: string } {
  const {
    livingX, livingY, livingW, livingH, stairW, stairH,
    userInheritedX, userInheritedY,
    groundStairPosition, groundStairRelativeOffset, fallbackPosition,
  } = args;

  const clampX = (v: number) => Math.max(livingX, Math.min(v, livingX + livingW - stairW));
  const clampY = (v: number) => Math.max(livingY, Math.min(v, livingY + livingH - stairH));

  // ✅ Ground par jo stair bani, upar ki floor / tower par WAHI position (x,y) chahiye.
  // Isliye ground ka absolute position sabse pehle; manual override sirf tab jab ground position hai hi nahi.
  if (groundStairPosition && Number.isFinite(groundStairPosition.x) && Number.isFinite(groundStairPosition.y)) {
    return { x: clampX(groundStairPosition.x), y: clampY(groundStairPosition.y), rule: 'INHERITED_ABSOLUTE_POSITION' };
  }

  if (Number.isFinite(userInheritedX) && Number.isFinite(userInheritedY)) {
    return { x: clampX(userInheritedX!), y: clampY(userInheritedY!), rule: 'USER_MANUAL_OVERRIDE' };
  }

  if (groundStairRelativeOffset && Number.isFinite(groundStairRelativeOffset.dx) && Number.isFinite(groundStairRelativeOffset.dy)) {
    return {
      x: clampX(livingX + groundStairRelativeOffset.dx),
      y: clampY(livingY + groundStairRelativeOffset.dy),
      rule: 'INHERITED_RELATIVE_OFFSET'
    };
  }

  if (groundStairPosition && Number.isFinite(groundStairPosition.x) && Number.isFinite(groundStairPosition.y)) {
    return { x: clampX(groundStairPosition.x), y: clampY(groundStairPosition.y), rule: 'INHERITED_ABSOLUTE_POSITION' };
  }

  let fx = livingX + livingW - stairW;
  let fy = livingY + livingH - stairH;
  let rule = 'DEFAULT_TOP_RIGHT';

  if (fallbackPosition === 'TOP-LEFT') { fx = livingX; fy = livingY + livingH - stairH; rule = 'DEFAULT_TOP_LEFT'; }
  else if (fallbackPosition === 'BOTTOM-RIGHT') { fx = livingX + livingW - stairW; fy = livingY; rule = 'DEFAULT_BOTTOM_RIGHT'; }
  else if (fallbackPosition === 'BOTTOM-LEFT') { fx = livingX; fy = livingY; rule = 'DEFAULT_BOTTOM_LEFT'; }

  return { x: clampX(fx), y: clampY(fy), rule };
}

// ============================================================
// HELPER: Build embedded stair metadata
// ============================================================
function buildEmbeddedStairMetadata(args: {
  placement: StairPlacement;
  sW: number; sH: number;
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
    w: sW, h: sH,
    staircaseType: stairType,
    flightDirection: placement.flightDirection,
    entryFace: placement.entryFace,
    exitFace: placement.exitFace,
    usable: placement.usable,
    usabilityReason: placement.usabilityReason,
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
    source, corner: placement.corner,
    flightDirection: placement.flightDirection,
    entryFace: placement.entryFace, exitFace: placement.exitFace,
    usable: placement.usable, w: sW, h: sH, stairType,
  });

  return metadata;
}

// ============================================================
// ✅ FIXED: Preserve doors + Deep copy
// ============================================================
function preserveDoorsAfterWetCore(originalRooms: FloorRoom[]): FloorRoom[] {
  const roomsCopy: FloorRoom[] = originalRooms.map(r => ({
    ...r,
    doors: r.doors ? r.doors.map((d: any) => ({ ...d })) : [],
    windows: r.windows ? r.windows.map((w: any) => ({ ...w })) : [],
    furniture: r.furniture ? r.furniture.map((f: any) => ({ ...f })) : [],
  }));

  const doorsById = new Map<string, any[]>();
  const windowsById = new Map<string, any[]>();

  for (const r of roomsCopy) {
    if (r.id) {
      if (Array.isArray(r.doors) && r.doors.length > 0) doorsById.set(String(r.id), r.doors.map((d: any) => ({ ...d })));
      if (Array.isArray(r.windows) && r.windows.length > 0) windowsById.set(String(r.id), r.windows.map((w: any) => ({ ...w })));
    }
  }

  const finalRooms = optimizeWetCore(roomsCopy);

  let reattachedDoors = 0;
  let reattachedWindows = 0;

  for (const fr of finalRooms) {
    if (!fr.id) continue;
    const origDoors = doorsById.get(String(fr.id));
    if (origDoors && origDoors.length > 0 && (!Array.isArray(fr.doors) || fr.doors.length === 0)) {
      fr.doors = origDoors.map((d: any) => ({ ...d }));
      reattachedDoors++;
    }
    const origWins = windowsById.get(String(fr.id));
    if (origWins && origWins.length > 0 && (!Array.isArray(fr.windows) || fr.windows.length === 0)) {
      fr.windows = origWins.map((w: any) => ({ ...w }));
      reattachedWindows++;
    }
  }

  console.log(`[PRESERVE DOORS] ✅ Re-attached: ${reattachedDoors} rooms (doors), ${reattachedWindows} rooms (windows)`);
  return finalRooms;
}

// ============================================================
// ✅ SAFETY NET: sub-room (attached toilet) kisi aur room (common toilet etc.) par overlap na kare
// (wet-core optimizer ya manual spec dimension size badal de to bhi)
// ============================================================
function clipSubRoomsToParents(rooms: FloorRoom[]): FloorRoom[] {
  for (const sub of rooms) {
    const parentId = (sub as any).subZoneOf || (sub as any).attachedTo;
    if (!parentId) continue;
    const parent = rooms.find(r => r.id === parentId);
    if (!parent) continue;

    // Toilet parent ke ANDAR (door-wall horizontal) ya BAGAL me (wide plot ki side strip) ho sakta hai,
    // isliye sirf DUSRE rooms (common toilet, passage, living ...) se overlap trim karte hain.
    let w = sub.w || 0, h = sub.h || 0, x = sub.x || 0, y = sub.y || 0;

    for (const other of rooms) {
      if (other === parent || other === sub) continue;
      if ((other as any).isSubRoom || (other as any).subZoneOf) continue;
      const ox = Math.min(x + w, (other.x || 0) + (other.w || 0)) - Math.max(x, other.x || 0);
      const oy = Math.min(y + h, (other.y || 0) + (other.h || 0)) - Math.max(y, other.y || 0);
      if (ox > 0.05 && oy > 0.05) {
        if (oy <= ox) { if (y < (other.y || 0)) h -= oy; else { y += oy; h -= oy; } }
        else { if (x < (other.x || 0)) w -= ox; else { x += ox; w -= ox; } }
      }
    }
    if (w !== sub.w || h !== sub.h || x !== sub.x || y !== sub.y) {
      console.warn(`[SANITIZE] ${sub.name} trimmed — other room se overlap tha`);
      sub.x = Number(x.toFixed(3)); sub.y = Number(y.toFixed(3));
      sub.w = Number(Math.max(0.1, w).toFixed(3)); sub.h = Number(Math.max(0.1, h).toFixed(3));
      sub.areaPerRoom = Number((sub.w * sub.h).toFixed(2));
    }
  }
  return rooms;
}

function finalizeRooms(rooms: FloorRoom[]): FloorRoom[] {
  return clipSubRoomsToParents(preserveDoorsAfterWetCore(rooms));
}

// ============================================================
// ✅ UNIVERSAL GROUND FLOOR (Formula-Based, Order Fixed)
// ============================================================
function buildUniversalGroundFloor(
  W: number, H: number,
  hasParking: boolean, hasLiving: boolean, hasKitchen: boolean, hasKD: boolean,
  hasCommon: boolean, hasAttached: boolean,
  bedrooms: string[],
  stairSpec: ReturnType<typeof calculateStaircase>,
  parkingMode: ParkingMode,
  stairEmbeddedInLiving: boolean,
  addRoom: (key: string, x: number, y: number, w: number, h: number, extras?: any) => void,
  rooms: FloorRoom[],
  specs: RoomSpec[] = [],
): FloorRoom[] | null {
  console.log('[BUILD UNIVERSAL GROUND FLOOR] START', {
    W, H, hasParking, hasLiving, hasKitchen, hasKD, hasCommon, hasAttached,
    bedrooms, stairEmbeddedInLiving, stairType: stairSpec.staircaseType,
  });

  if (!hasParking || !hasLiving) {
    console.log('[BUILD UNIVERSAL GROUND FLOOR] ABORT → no parking or living');
    return null;
  }

  const sizes = getStandardRoomSizes(W, H);
  console.log('[STANDARD ROOM SIZES]', sizes);

  // ✅ FIX: Common toilet thoda bada + passage kam se kam 4 ft (W=10 -> toilet 6 x 5.5, passage 4)
  const MIN_PASSAGE_FT = 4;
  const ctW = hasCommon
    ? Math.min(
        Math.max(sizes.commonToilet.w, Math.min(6, W - MIN_PASSAGE_FT)),
        Math.max(4, W - 3.25),
      )
    : 0;
  const ctH = hasCommon ? Math.max(sizes.commonToilet.h, 5.5) : 0;

  // ✅ FIX: living height ek hi jagah se decide hoti hai (spec override se gap/overlap nahi).
  // Bedroom ko kam se kam MIN_BED_DEPTH milna chahiye, uske liye living chhoti hoti hai (min 12 ft).
  const MIN_BED_DEPTH = 9.5;
  const livingSpec: any = specs.find(sp => sp.key === 'LIVING ROOM');
  const wantedLivingH = Number(livingSpec?.length ?? livingSpec?.h) > 0
    ? Number(livingSpec.length ?? livingSpec.h)
    : sizes.living.h;
  const maxLivingH = H - sizes.parking.h - ctH - MIN_BED_DEPTH;
  const livingH = Math.max(8, Math.min(wantedLivingH, Math.max(12, maxLivingH)));
  // ✅ Parking->Living door: SINGLE FRAME, parking width se 1 ft chhota (0.5 ft wall ke dono taraf),
// kabhi 3.5 ft se bada nahi -> kitchen wali partition tak nahi jaata.
const parkingDoorW = Math.max(2.0, Math.min(3.5, Number((sizes.parking.w - 1).toFixed(2))));
  const parkingDoorOffset = Number(Math.max(0.5, (sizes.parking.w - parkingDoorW) / 2).toFixed(2));

   // ============================================================
  // STEP 2: PARKING + KITCHEN (Front, road side)
  // ============================================================
  const parkingY = H - sizes.parking.h;
  addRoom('PARKING', 0, parkingY, sizes.parking.w, sizes.parking.h, {
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
        // ✅ FIX: Parking gate width — narrow parking ke liye 4 ft, wide ke liye 6.5 ft
        // Agar parking width < 7 ft → gate 4 ft fixed
        // Agar parking width ≥ 7 ft → gate 6.5 ft (ya parking width ka 85%)
        widthFeet: sizes.parking.w < 7
          ? 4.0
          : Math.min(6.5, sizes.parking.w * 0.85),
        offsetFeet: sizes.parking.w < 7
          ? Math.max(0.5, (sizes.parking.w - 4.0) / 2)
          : Math.max(0.5, (sizes.parking.w - Math.min(6.5, sizes.parking.w * 0.85)) / 2),
        doorType: 'MAIN', renderSymbol: true,
        isExternalOpening: true, cutsExternalWall: true,
        entryRole: 'MAIN_ROAD_VEHICLE_GATE',
      },
      {
        id: 'shared-parking-living',
        wall: 'TOP',
        widthFeet: parkingDoorW,
        offsetFeet: parkingDoorOffset,
        doorType: 'MAIN', isDoubleLeaf: false, doubleLeaf: false, leafCount: 1,
        renderSymbol: false, swingDirection: 'INWARDS',
        entryRole: 'MAIN_PARKING_TO_LIVING_DOOR',
        sharedOpeningId: 'shared-parking-living',
      },
    ],
  });

  // ✅ FIX #1: Parking ko bottom wall se flush karo
  // Kyunki addRoom() me H - finalY clamping hoti hai, kabhi kabhi parking
  // bottom se gap chhod deta hai. Ye ensure karta hai ki parking.y + parking.h === H
  const parkingRoomForFlush = rooms.find(r => canonical(r.name) === 'PARKING');
  if (parkingRoomForFlush) {
    const parkingBottom = (parkingRoomForFlush.y || 0) + (parkingRoomForFlush.h || 0);
    if (Math.abs(parkingBottom - H) > 0.05) {
      parkingRoomForFlush.y = Math.max(0, H - (parkingRoomForFlush.h || 0));
    }
  }

  // ============================================================
  // STEP 3: KITCHEN
  // ============================================================
 if (hasKitchen || hasKD) {
  const kitchenKey = hasKD ? 'KITCHEN CUM DINING' : 'KITCHEN';
  const actualKitchenW = Math.max(3, W - sizes.parking.w);
  // ✅ FIX: Kitchen ki height Parking ke barabar karo
  // Taaki Parking ↔ Kitchen partition wall exactly bottom tak extend ho
  const actualKitchenH = sizes.parking.h;
  addRoom(kitchenKey, sizes.parking.w, parkingY, actualKitchenW, actualKitchenH, {
    
    serviceZone: true,
    ventilationRequired: true,
    dimensionsFitted: true,
    doors: [
      {
        id: 'kitchen-living-access',
        wall: 'TOP',
        widthFeet: 3.5,
        offsetFeet: Math.max(0.5, (actualKitchenW - 3.5) / 2),
        doorType: 'OPENING',
        renderSymbol: false,
        isExternalOpening: false,
        cutsExternalWall: false,
        swingDirection: 'NONE',
        entryRole: 'KITCHEN_TO_LIVING_ACCESS',
      },
    ],
  });
}

  // ============================================================
  // STEP 4: LIVING ROOM (Middle)
  // ============================================================
   const livingY = parkingY - livingH;
  addRoom('LIVING ROOM', 0, livingY, W, livingH, {
    dimensionsFitted: true,
    entryZone: true, publicCore: true,
    parkingAdjacent: true, behindParking: true,
    doors: [
      // ✅ FIX: Sirf ek entry door (parking side se)
      // Purana living_entry_passage hata diya kyunki user ne kaha nahi chahiye
      {
        id: 'shared-parking-living',
        wall: 'BOTTOM',
        widthFeet: parkingDoorW,
        // ✅ shared opening: parking wali door ke SAME x par (pehle living ke center par thi -> kitchen tak chali jaati thi)
        offsetFeet: parkingDoorOffset,
        doorType: 'MAIN', isDoubleLeaf: false, doubleLeaf: false, leafCount: 1, renderSymbol: true,
        swingDirection: 'INWARDS',
        entryRole: 'MAIN_PARKING_TO_LIVING_DOOR',
        sharedOpeningId: 'shared-parking-living',
      },
    ],
  });

  // ============================================================
  // STEP 6: COMMON TOILET + PASSAGE (Service, Living ke upar)
  // ============================================================
  let serviceY = livingY;
  if (hasCommon) {
    serviceY = livingY - ctH;
    addRoom('COMMON TOILET', 0, serviceY, ctW, ctH, {
      serviceCore: true, ventilationRequired: true, dimensionsFitted: true,
      orientation: ctW >= 5 ? 'HORIZONTAL' : 'VERTICAL',
      doors: [
        {
          id: 'shared-ct-passage',
          wall: 'RIGHT',
          widthFeet: 2.5,
          offsetFeet: Math.max(DOOR_WALL_CLEARANCE_FT, (ctH - 2.5) / 2),
          doorType: 'TOILET', renderSymbol: true,
          swingInside: true, sharedOpeningId: 'shared-ct-passage',
        },
      ],
      windows: [
        {
          id: 'ct_vent_left',
          wall: 'LEFT',
          lengthFeet: 2,
          offsetFeet: Math.max(0.5, ctH / 2 - 1),
        },
      ],
    });

    const passageW = W - ctW;
    if (passageW >= 3) {
      addRoom('PASSAGE', ctW, serviceY, passageW, ctH, {
        dimensionsFitted: true, circulationZone: true, protectedCorridor: true,
        corridorWidthFt: passageW, pinkGuideLines: true,
        connects: ['LIVING ROOM', 'KITCHEN', 'COMMON TOILET', 'MASTER BEDROOM'],
        orientation: 'HORIZONTAL_SERVICE_SPINE',
        accessRole: 'PRIMARY_INTERNAL_SPINE',
        isSubRoom: true,
        doors: [],
      });
    }
  }

  // ============================================================
  // STEP 7: MASTER BEDROOM (Rear, private)
  // ============================================================
  const rearY = 0;
  // ✅ FIX: bedroom EXACT serviceY tak (pehle max(9.5, serviceY) common toilet/passage ke andar ghus jaata tha)
  const rearH = serviceY;
  const primaryBedroomKey: string = bedrooms[0] || 'BEDROOM';
  const bedDoorW = 3.0;
  const passageStartX = hasCommon ? ctW : 0;
  const passageSpan = W - passageStartX;

  const isMaster = primaryBedroomKey === 'MASTER BEDROOM';
  const verticalAttached = isMaster && hasAttached && W >= ATTACHED_VERTICAL_MIN_W_FT;
  const attachedStripW = verticalAttached ? sizes.attachedToilet.w : 0;
  const bedW = W - attachedStripW;

  // ✅ FIX: Bedroom ka door HAMESHA passage wali wall (BOTTOM) par, passage ke x-range me.
  // (Pehle 'TOP' tha -> rear external wall par render hota tha.)
  let bedDoorOffset = hasCommon && passageSpan >= bedDoorW
    ? passageStartX + (passageSpan - bedDoorW) / 2
    : Math.max(0.5, bedW - bedDoorW - 0.5);

  // ✅ FIX: Narrow (W < 15) me attached toilet HORIZONTAL aur door wali wall par
  // (common toilet ke upar, taaki plumbing stack bane aur bedroom ka area waste na ho)
  const narrowToilet = isMaster && hasAttached && !verticalAttached
    ? planDoorSideToilet(0, rearY, bedW, rearH, 'BOTTOM', bedDoorW, Math.min(6.5, Math.max(4.5, passageStartX)))
    : null;
  if (narrowToilet?.toilet) bedDoorOffset = narrowToilet.doorOffset;
  bedDoorOffset = Math.max(0.3, Math.min(bedDoorOffset, bedW - bedDoorW - 0.3));

  addRoom(primaryBedroomKey, 0, rearY, bedW, rearH, {
    dimensionsFitted: true,
    privateZone: true, furnitureValidated: true,
    doors: [
      {
        id: 'shared-bedroom-passage',
        wall: 'BOTTOM',
        widthFeet: bedDoorW,
        offsetFeet: bedDoorOffset,
        doorType: 'INTERNAL', renderSymbol: true,
        swingInside: true, hingeSide: 'END',
        sharedOpeningId: 'shared-bedroom-passage',
      },
    ],
  });
  const bedroomRoom = rooms[rooms.length - 1];

  if (isMaster && hasAttached && bedroomRoom) {
    if (verticalAttached) {
      addRoom('ATTACHED TOILET',
        (bedroomRoom.x || 0) + bedW, rearY, attachedStripW, rearH,
        {
          dimensionsFitted: true,
          attachedTo: bedroomRoom.id, subZoneOf: bedroomRoom.id,
          isSubRoom: true, serviceCore: true, ventilationRequired: true,
          orientation: 'VERTICAL', placementRule: 'MASTER_WIDE_VERTICAL',
          doors: [
            {
              id: 'att_door_master', wall: 'LEFT',
              widthFeet: 2.5, offsetFeet: Math.max(DOOR_WALL_CLEARANCE_FT, rearH / 2 - 1.25),
              doorType: 'TOILET', renderSymbol: true, swingInside: true,
            },
          ],
        });
    } else if (narrowToilet?.toilet) {
      const t = narrowToilet.toilet;
      addRoom('ATTACHED TOILET', t.x, t.y, t.w, t.h, {
        dimensionsFitted: true,
        attachedTo: bedroomRoom.id, subZoneOf: bedroomRoom.id,
        isSubRoom: true, serviceCore: true, ventilationRequired: true,
        orientation: 'HORIZONTAL', placementRule: 'NARROW_DOOR_SIDE_HORIZONTAL',
        doors: [t.door],
        windows: [t.window],
      });
    } else {
      console.warn('[ATTACHED TOILET] Narrow bedroom me jagah nahi mili (door wall par strip < 4 ft).');
    }
  }

  // ============================================================
  // STEP 8: STAIR (Living Room ke andar) — ab PASSAGE/KITCHEN/PARKING bante ke BAAD
  // (pehle stair pehle place hoti thi, isliye passage/doors ka pata hi nahi tha -> access block)
  // ============================================================
  if (stairEmbeddedInLiving) {
    const living = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
    if (living) {
      const floorH = stairSpec.floorToFloorHeight || 10;
      const lw = living.w || 0, lh = living.h || 0;
      const typeOrder: StaircaseType[] = ['DOG_LEGGED', '2_QUARTER_WINDER', '2_QUARTER_LANDING', 'L_SHAPED'];

      type Pick = { fit: ReturnType<typeof fitStaircaseToZone>; placement: StairPlacement; sW: number; sH: number };
      let best: Pick | null = null;

      // Pehle living me stair + 3 ft entry clearance fit karne ki koshish, phir relaxed zone
      const zoneLens = [Math.max(6, lh - STAIR_CLEAR_DEPTH_FT), Math.max(6, lh - 0.5)];
      outer: for (const zl of zoneLens) {
        const base = fitStaircaseToZone(floorH, {
          floorWidthFt: lw, zoneLengthFt: zl, minPassageFt: MIN_PASSAGE_FT, passageMode: 'SIDE',
        });
        const ordered = [base.staircaseType, ...typeOrder.filter(t => t !== base.staircaseType)];
        for (const t of ordered) {
          const fit = t === base.staircaseType ? base : fitStaircaseToZone(floorH, {
            floorWidthFt: lw, zoneLengthFt: zl, minPassageFt: MIN_PASSAGE_FT, passageMode: 'SIDE',
            allowedTypes: [t],
          });
          if (!fit.fits || !fit.passageOk) continue;
          const sW = Math.min(fit.spec.requiredWidthFt, lw);
          const sH = Math.min(fit.spec.requiredLengthFt, lh);
          if (sW < 3 || sH < 6) continue;
          const placement = chooseStaircaseCorner(living, sW, sH, rooms, [], t);
          if (!placement) continue;
          if (!best || (placement.usable && !best.placement.usable)) best = { fit, placement, sW, sH };
          if (placement.usable) break outer;
        }
      }

      if (best) {
        const { fit, placement, sW, sH } = best;
        console.log('[STAIR FIT]', {
          type: fit.staircaseType, extension: fit.extension,
          required: { w: fit.spec.requiredWidthFt, h: fit.spec.requiredLengthFt },
          zone: { w: lw, h: lh }, corner: placement.corner, entry: placement.entryFace,
          riser: `${fit.spec.riserCount} @ ${fit.spec.actualRiserInches}`, tread: fit.spec.treadInches,
          usable: placement.usable, reason: placement.usabilityReason,
        });
        const meta = buildEmbeddedStairMetadata({
          placement, sW, sH, stairType: fit.staircaseType, stairSpec: fit.spec, source: 'GROUND_FLOOR_LIVING',
        });
        meta.fit = {
          extension: fit.extension, sidePassageFt: fit.sidePassageFt,
          endPassageFt: fit.endPassageFt, passageOk: fit.passageOk, notes: fit.notes,
        };
        meta.entryClearance = placement.entryClearance;
        (living as any).embeddedStair = meta;
      } else {
        console.error('[STAIR FAILED ❌] Koi stair type living me fit nahi hua', { lw, lh });
      }
    }
  }

  console.log('[BUILD UNIVERSAL GROUND FLOOR] COMPLETE', {
    roomCount: rooms.length,
    rooms: rooms.map(r => ({
      name: r.name, x: r.x, y: r.y, w: r.w, h: r.h,
      hasStair: !!(r as any).embeddedStair,
    })),
  });

  return finalizeRooms(rooms);
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

  const addRoom = (key: string, x: number, y: number, w: number, h: number, extras: any = {}) => {
    let finalX = Math.max(0, x);
    let finalY = Math.max(0, y);
    let finalW = Math.min(w, W - finalX);
    let finalH = Math.min(h, H - finalY);

    const rule = PRACTICAL_ROOM_RULES[key] || { minWidth: 3, minDepth: 3 };
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
          if (overlapY < overlapX && finalH - overlapY > 2) finalH -= overlapY;
          else if (finalW - overlapX > 2) finalW -= overlapX;
          else finalY += overlapY;
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
  const has = (k) => (counts[k] || 0) > 0;

  const bedrooms = program.filter(k =>
    k === 'MASTER BEDROOM' || k === 'BEDROOM' ||
    k === 'FRONT BEDROOM' || k === 'REAR BEDROOM'
  );

  const hasParking = ground && has('PARKING');
  const hasLiving = has('LIVING ROOM');
  const hasKitchen = has('KITCHEN');
  const hasKD = has('KITCHEN CUM DINING');
  const hasStair = has('STAIRCASE');
  const bathroomCount = counts['BATHROOM'] || 0;
  const commonToiletCount = Math.max(counts['COMMON TOILET'] || 0, bathroomCount);
  const hasCommon = commonToiletCount > 0;
  const hasAttached = has('ATTACHED TOILET') || has('FRONT ATTACHED BATH') || has('REAR ATTACHED BATH');

  const needsPassage = bedrooms.length > 1 || (bedrooms.length >= 1 && (hasKitchen || hasKD || hasCommon || hasLiving));

  const hasLivingStairCombo = specs.some(s => s.key === 'STAIRCASE' && s.embedIn === 'LIVING ROOM');
  const stairEmbeddedInLiving = hasLiving && (hasLivingStairCombo || hasStair);

  console.log('[BUILD RESIDENTIAL LAYOUT] FLAGS', {
    hasParking, hasLiving, hasKitchen, hasKD, hasStair,
    hasCommon, hasAttached, needsPassage,
    hasLivingStairCombo, stairEmbeddedInLiving, isTower, bedrooms,
  });

  const stairSpecFromInput = specs.find(s => s.key === 'STAIRCASE');
  const inputStairPosition = (stairSpecFromInput as any)?.position || 'TOP-RIGHT';
  const inputStairInheritedX = Number((stairSpecFromInput as any)?.inheritedX);
  const inputStairInheritedY = Number((stairSpecFromInput as any)?.inheritedY);
  const userInheritedX = Number.isFinite(inputStairInheritedX) ? inputStairInheritedX : null;
  const userInheritedY = Number.isFinite(inputStairInheritedY) ? inputStairInheritedY : null;

  const min = (key) => PRACTICAL_ROOM_RULES[key] || { minWidth: 3, minDepth: 3, preferredWidth: 5, preferredDepth: 6, furniture: '' };
  const minDim = (key, horizontal = true) => horizontal ? min(key).minWidth : min(key).minDepth;
  const roomArea = (key, fallback) => desiredArea(specs, key, fallback);
  const usableW = Math.max(1, W), usableH = Math.max(1, H);

  const getSpecDim = (key, minW, minH, maxW, maxH) => {
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

  // ==========================================================
  // ✅ UNIVERSAL GROUND FLOOR (Formula-Based)
  // ==========================================================
  if (
    ground &&
    hasParking &&
    hasLiving &&
    W >= 8 &&
    W <= 24 &&
    H >= 30 &&
    H <= 60
  ) {
    const result = buildUniversalGroundFloor(
      W, H,
      hasParking, hasLiving, hasKitchen, hasKD, hasCommon, hasAttached,
      bedrooms, stairSpec, parkingMode, stairEmbeddedInLiving,
      addRoom, rooms, specs,
    );
    if (result) return result;
  }

  // ==========================================================
  // BRANCH 1: NARROW PLOT MASTER STRATEGY (Fallback)
  // ==========================================================
  if (ground && hasParking && W <= 24 && H >= 34) {
    console.log('[BUILD RESIDENTIAL LAYOUT] → BRANCH 1 (NARROW GROUND)');
    const sizes = getStandardRoomSizes(W, H);
    const parkingW = sizes.parking.w;
    const parkingH = sizes.parking.h;

       const pY = H - parkingH;
    // ✅ FIX: Parking gate width — narrow parking ke liye 4 ft
    const parkingGateWidth = parkingW < 7
      ? 4.0
      : Math.min(6.5, parkingW * 0.85);

    addRoom('PARKING', 0, pY, parkingW, parkingH, {
      parkingShape: 'CAR', parkingZone: 'FRONT_ROAD_CONNECTED',
      vehicleFit: true, vehicleClearanceRequired: true, parkingMode,
      entryRole: 'MAIN_ROAD_VEHICLE_GATE',
      doors: [
        {
          id: 'd-parking-main-gate',
          wall: 'BOTTOM',
          widthFeet: parkingGateWidth,
          offsetFeet: Math.max(0.5, (parkingW - parkingGateWidth) / 2),
          doorType: 'MAIN', renderSymbol: true,
          isExternalOpening: true, cutsExternalWall: true,
          entryRole: 'MAIN_ROAD_VEHICLE_GATE',
        },
      ],
    });

    let currentY = pY;

    if (hasKitchen || hasKD) {
  const kitchenKey = hasKD ? 'KITCHEN CUM DINING' : 'KITCHEN';
  const actualKitchenW = Math.max(3, W - sizes.parking.w);
  // ✅ FIX: Kitchen ki height Parking ke barabar karo
  // Taaki Parking ↔ Kitchen partition wall exactly bottom tak extend ho
  const actualKitchenH = sizes.parking.h;
  addRoom(kitchenKey, sizes.parking.w, pY, actualKitchenW, actualKitchenH, {
    serviceZone: true, ventilationRequired: true, dimensionsFitted: true,
  });
}

    if (hasLiving) {
      const livingH = sizes.living.h;
      const lY = currentY - livingH;
      addRoom('LIVING ROOM', 0, lY, W, livingH, {
        entryZone: true, publicCore: true, parkingAdjacent: true, behindParking: true,
      });
      currentY = lY;

      if (stairEmbeddedInLiving) {
        const living = rooms[rooms.length - 1];
        const availableStairW = Math.max(3, living.w! - 3.5);
        const availableStairH = Math.max(6, living.h! - 3);

        const sDim = {
          w: Math.min(stairSpec.requiredWidthFt || 5.5, availableStairW),
          h: Math.min(stairSpec.requiredLengthFt || 9.5, availableStairH),
        };

        console.log('[BRANCH 1 STAIR SIZE]', {
          required: { w: stairSpec.requiredWidthFt, h: stairSpec.requiredLengthFt },
          available: { w: availableStairW, h: availableStairH },
          final: sDim,
        });

        const existingDoors: any[] = [];
        for (const r of rooms) {
          for (const d of (r.doors || [])) existingDoors.push({ ...d, globalX: (r.x || 0), globalY: (r.y || 0) });
        }

        const placement = chooseStaircaseCorner(living, sDim.w, sDim.h, rooms, existingDoors, stairSpec.staircaseType);

        if (placement && sDim.w <= living.w! - 0.5 && sDim.h <= living.h! - 0.5) {
          (living as any).embeddedStair = buildEmbeddedStairMetadata({
            placement, sW: sDim.w, sH: sDim.h,
            stairType: stairSpec.staircaseType, stairSpec, source: 'BRANCH1_LIVING',
          });
        }
      }
    }

    if (hasCommon) {
      const serviceH = sizes.commonToilet.h;
      const sY = currentY - serviceH;
      const passageW = W - sizes.commonToilet.w;
      const ctDoorOffset = Math.max(DOOR_WALL_CLEARANCE_FT, serviceH - 2.5 - DOOR_WALL_CLEARANCE_FT);

      addRoom('COMMON TOILET', 0, sY, sizes.commonToilet.w, serviceH, {
        serviceCore: true, ventilationRequired: true, dimensionsFitted: true,
        orientation: sizes.commonToilet.w >= 5 ? 'HORIZONTAL' : 'VERTICAL',
        doors: [{
          id: 'shared-ct-passage', wall: 'RIGHT',
          widthFeet: 2.5, offsetFeet: ctDoorOffset,
          doorType: 'TOILET', renderSymbol: true, swingInside: true,
          hingeSide: 'END', sharedOpeningId: 'shared-ct-passage',
        }],
      });

      if (passageW >= 2) {
        addRoom('PASSAGE', sizes.commonToilet.w, sY, passageW, serviceH, {
          circulationZone: true, protectedCorridor: true, corridorWidthFt: passageW,
          pinkGuideLines: true,
          connects: ['LIVING ROOM', 'KITCHEN', 'COMMON TOILET', 'MASTER BEDROOM'],
          orientation: 'HORIZONTAL_SERVICE_SPINE', accessRole: 'PRIMARY_INTERNAL_SPINE',
          isSubRoom: true,
          doors: [{
            id: 'shared-ct-passage', wall: 'LEFT',
            widthFeet: 2.5, offsetFeet: ctDoorOffset,
            doorType: 'TOILET', renderSymbol: false, swingInside: false,
            sharedOpeningId: 'shared-ct-passage',
          }],
        });
      }

      currentY = sY;
    }

    if (bedrooms.length >= 1) {
      const privateH = Math.max(9.5, currentY);
      const primaryBedroomKey = bedrooms[0] || 'BEDROOM';
      const attachedW = (primaryBedroomKey === 'MASTER BEDROOM' && hasAttached) ? sizes.attachedToilet.w : 0;
      const masterW = Math.max(minDim(primaryBedroomKey), W - attachedW);

      const bedPassageW = hasCommon ? W - sizes.commonToilet.w : 0;
      const bedDoorW = bedPassageW >= 2 ? Math.min(3.0, bedPassageW) : 3.0;
      const bedDoorOffset = bedPassageW >= 2 ? Math.max(0, W - bedDoorW) : Math.max(1, masterW - 3.5);

      addRoom(primaryBedroomKey, 0, 0, masterW, privateH, {
        privateZone: true, furnitureValidated: true,
        doors: [{
          id: 'shared-bedroom-passage', wall: 'BOTTOM',
          widthFeet: bedDoorW, offsetFeet: bedDoorOffset,
          doorType: 'INTERNAL', renderSymbol: true, swingInside: true,
          hingeSide: 'END', sharedOpeningId: 'shared-bedroom-passage',
        }],
      });
      const masterIndex = rooms.length - 1;

      if (attachedW > 0) {
        const master = rooms[masterIndex];
        const orientation = getAttachedToiletOrientation(master.w || 0, master.h || 0);
        addRoom('ATTACHED TOILET',
          (master.x || 0) + orientation.x, (master.y || 0) + orientation.y,
          orientation.w, orientation.h,
          {
            attachedTo: master.id, subZoneOf: master.id,
            isSubRoom: true, serviceCore: true, ventilationRequired: true,
            orientation: orientation.orientation === 'V' ? 'VERTICAL' : 'HORIZONTAL',
          });
      }
    }

    return finalizeRooms(rooms);
  }

  // ==========================================================
  // BRANCH 2: PRIMARY ZONING (fallback)
  // ==========================================================
  if (ground && hasLiving && hasStair && hasParking && W >= 13.0 && H >= 34.0) {
    console.log('[BUILD RESIDENTIAL LAYOUT] → BRANCH 2 (PRIMARY ZONING)');
    const sizes = getStandardRoomSizes(W, H);
    const parkingMinimum = selectParkingCandidate(W, H, sizes.parking.h, parkingMode);
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
        for (const d of (r.doors || [])) existingDoors.push({ ...d, globalX: (r.x || 0), globalY: (r.y || 0) });
      }
      const placement = chooseStaircaseCorner(livingRoom, stairW, stairH, rooms, existingDoors, stairSpec.staircaseType);
      if (placement) {
        (livingRoom as any).embeddedStair = buildEmbeddedStairMetadata({
          placement, sW: stairW, sH: stairH,
          stairType: stairSpec.staircaseType, stairSpec, source: 'BRANCH2_LIVING',
        });
      }
    }

    return finalizeRooms(rooms);
  }

  // ==========================================================
  // BRANCH 3: UPPER-FLOOR — BUNGALOW LAYOUT
  // ==========================================================
   if (!hasParking && (hasStair || stairEmbeddedInLiving) && bedrooms.length >= 1 && W >= 6 && H >= 34) {
    console.log('[BUILD RESIDENTIAL LAYOUT] → BRANCH 3 (UPPER BUNGALOW)');
    let groundLivingY: number | null = null;
    if (groundStairPosition && groundStairRelativeOffset) {
      groundLivingY = (groundStairPosition.y || 0) - (groundStairRelativeOffset.dy || 0);
    }

    // ------------------------------------------------------------
    // ✅ UPPER FLOOR — FULL-COVERAGE ZONING (koi gap / overflow nahi)
    //
    //   [ FRONT BEDROOM ]
    //   [ 4 ft passage ]
    //   [ STAIR ZONE    ]   <- stair ground wali position par (aligned)
    //   [ 4 ft passage ]       front <-> rear bedrooms ko jodta hai
    //   [ REAR BEDROOM  ]
    //
    // Teeno zone milkar poori H cover karte hain.
    // ------------------------------------------------------------
    const PASSAGE_FT = 4;

    const groundStairW = groundStairPosition && (groundStairPosition as any).w ? Number((groundStairPosition as any).w) : 0;
    const groundStairH = groundStairPosition && (groundStairPosition as any).h ? Number((groundStairPosition as any).h) : 0;
    const groundStairType = stairSpec.staircaseType;

    // ✅ Stair size = ground ka actual size, warna dynamic calculateStaircase() ka footprint
    let stairW = groundStairW || stairSpec.requiredWidthFt || 6;
    let stairH = groundStairH || stairSpec.requiredLengthFt || 10;
    stairW = Math.min(stairW, W - 0.25);

    // Bedroom depth + passage combos (jagah kam ho to pehle rear passage, phir bedroom depth ghatate hain)
    const combos: Array<[number, number, number]> = [[4, 4, 9], [4, 0, 9], [4, 0, 8], [3, 0, 8]];
    let topP = 4, botP = 4, minBedDepth = 9;
    let minY = 0, maxY = 0;
    const wantedStairY = groundStairPosition && Number.isFinite((groundStairPosition as any).y)
      ? Number((groundStairPosition as any).y) : null;
    // ✅ Pehle wo combo jisme ground wali y EXACT aa jaaye; nahi to pehla feasible combo (clamp + warning)
    let firstFeasible: [number, number, number] | null = null;
    let exactCombo: [number, number, number] | null = null;
    for (const [tp, bp, mb] of combos) {
      const lo = mb + tp, hi = H - stairH - bp - mb;
      if (lo > hi) continue;
      if (!firstFeasible) firstFeasible = [tp, bp, mb];
      if (wantedStairY !== null && wantedStairY >= lo - 0.01 && wantedStairY <= hi + 0.01) { exactCombo = [tp, bp, mb]; break; }
      if (wantedStairY === null) break;
    }
    const chosenCombo = exactCombo || firstFeasible || combos[combos.length - 1];
    [topP, botP, minBedDepth] = chosenCombo;
    minY = minBedDepth + topP;
    maxY = H - stairH - botP - minBedDepth;
    if (wantedStairY !== null && !exactCombo) {
      console.warn('[UPPER STAIR] ground wali y exact nahi aa saki, clamp hui', { wantedStairY, minY, maxY });
    }
    let stairY = groundStairPosition && Number.isFinite((groundStairPosition as any).y)
      ? Number((groundStairPosition as any).y)
      : (H - stairH) / 2;
    stairY = minY <= maxY ? Math.max(minY, Math.min(stairY, maxY)) : (minY + maxY) / 2;

    const zoneY0 = Number((stairY - topP).toFixed(3));
    const zoneH = Number((topP + stairH + botP).toFixed(3));
    const rearY0 = Number((zoneY0 + zoneH).toFixed(3));
    const frontH = zoneY0;
    const rearH = Number((H - rearY0).toFixed(3));
    const alignmentRule = groundStairPosition ? 'STAIR_ALIGNED_TO_GROUND' : 'STAIR_CENTERED';

    const frontBedKey = bedrooms.find(k => k === 'MASTER BEDROOM') || bedrooms.find(k => k === 'FRONT BEDROOM') || bedrooms[0];
    const rearBedKey = bedrooms.length > 1
      ? (bedrooms.find((k, i) => i > 0) || bedrooms[1] || bedrooms[0])
      : frontBedKey;

    const narrowUpper = W < ATTACHED_VERTICAL_MIN_W_FT;
    const BED_DOOR_W = 3.0;

    // Ek bedroom (+ uska attached toilet) banane ka helper.
    // ✅ Bedroom HAMESHA exact zone size me (dimensionsFitted) -> beech me gap/extra wall nahi
    // ✅ Door HAMESHA lagta hai, passage wali wall par (front: BOTTOM, rear: TOP)
    // ✅ Toilet door wali wall par horizontal (narrow) ya side strip (wide) -> jagah waste nahi
    const buildUpperBedroom = (
      key: string, y: number, h: number, doorWall: 'TOP' | 'BOTTOM',
      zoneName: string, ruleName: string,
    ) => {
      if (h < 4) return;
      const doorId = `bed_door_${zoneName.toLowerCase()}`;
      if (narrowUpper) {
        const plan = hasAttached ? planDoorSideToilet(0, y, W, h, doorWall, BED_DOOR_W, 4.5) : null;
        const doorOffset = plan?.toilet ? plan.doorOffset : Math.max(0.3, (W - BED_DOOR_W) / 2);
        addRoom(key, 0, y, W, h, {
          dimensionsFitted: true,
          privateZone: true, furnitureValidated: true,
          placementZone: zoneName,
          requestedArea: roomArea(key, 140),
          doors: [{
            id: doorId, wall: doorWall, widthFeet: BED_DOOR_W, offsetFeet: doorOffset,
            doorType: 'INTERNAL', renderSymbol: true, swingInside: true,
          }],
        });
        const bed = rooms[rooms.length - 1];
        if (hasAttached && plan?.toilet && bed) {
          const t = plan.toilet;
          addRoom('ATTACHED TOILET', t.x, t.y, t.w, t.h, {
            dimensionsFitted: true,
            attachedTo: bed.id, subZoneOf: bed.id,
            isSubRoom: true, serviceCore: true, ventilationRequired: true,
            orientation: 'HORIZONTAL', placementRule: ruleName,
            doors: [t.door], windows: [t.window],
          });
        } else if (hasAttached) {
          console.warn(`[UPPER] ${key}: attached toilet ke liye door wali wall par jagah nahi (h=${h}).`);
        }
      } else {
        // W >= 15: side strip toilet, bedroom ka door passage wali wall par
        const attachedW = hasAttached ? Math.min(5.0, W * 0.4) : 0;
        const bedW = W - attachedW;
        addRoom(key, 0, y, bedW, h, {
          dimensionsFitted: true,
          privateZone: true, furnitureValidated: true,
          placementZone: zoneName,
          requestedArea: roomArea(key, 140),
          doors: [{
            id: doorId, wall: doorWall, widthFeet: BED_DOOR_W,
            offsetFeet: Math.max(0.3, (bedW - BED_DOOR_W) / 2),
            doorType: 'INTERNAL', renderSymbol: true, swingInside: true,
          }],
        });
        const bed = rooms[rooms.length - 1];
        if (hasAttached && bed) {
          addRoom('ATTACHED TOILET', bedW, y, attachedW, h, {
            dimensionsFitted: true,
            attachedTo: bed.id, subZoneOf: bed.id,
            isSubRoom: true, serviceCore: true, ventilationRequired: true,
            orientation: 'VERTICAL', placementRule: ruleName,
            doors: [{
              id: 'att_door_upper', wall: 'LEFT', widthFeet: 2.5,
              // bedroom ka door passage wali side hai -> toilet ka door usse OPPOSITE corner ke paas
              offsetFeet: doorWall === 'BOTTOM'
                ? DOOR_WALL_CLEARANCE_FT
                : Math.max(DOOR_WALL_CLEARANCE_FT, h - 2.5 - DOOR_WALL_CLEARANCE_FT),
              doorType: 'TOILET', renderSymbol: true, swingInside: true,
            }],
          });
        }
      }
    };

    // 1) FRONT BEDROOM (door wall = neeche, passage ki taraf)
    buildUpperBedroom(frontBedKey, 0, frontH, 'BOTTOM', 'FRONT_BUNGALOW', 'BUNGALOW_FRONT_ATTACHED');

    // 2) STAIR ZONE (living) — full width
    addRoom('LIVING ROOM', 0, zoneY0, W, zoneH, {
      dimensionsFitted: true,
      publicCore: true, upperFloorLiving: true,
      alignmentRule, placementZone: 'MIDDLE_LIVING', fullWidth: true,
      connectingPassageTopFt: topP, connectingPassageBottomFt: botP,
    });
    const livingRoom = rooms[rooms.length - 1];

    if (livingRoom && stairW <= livingRoom.w - 0.25) {
      const resolved = resolveInheritedStairPosition({
        livingX: livingRoom.x || 0, livingY: livingRoom.y || 0,
        livingW: livingRoom.w || 0, livingH: livingRoom.h || 0,
        stairW, stairH, userInheritedX, userInheritedY,
        groundStairPosition,
        // ✅ Absolute ground position use karo: zone ka y0 ground living se alag hota hai,
        // isliye relative offset se stair upar khisak jaati thi.
        groundStairRelativeOffset: groundStairPosition ? undefined : groundStairRelativeOffset,
        fallbackPosition: inputStairPosition,
      });

      // ✅ Ground jaisi hi stair: x ground se, y = zone me exact (top/bottom passage 4 ft ke beech)
      const inh: any = groundStairPosition || {};
      const upEntry = (inh.entryFace as StairFace) || 'BOTTOM';
      const upExit = (inh.exitFace as StairFace) || (upEntry === 'BOTTOM' ? 'TOP' : 'BOTTOM');
      const stairYFinal = Number(stairY.toFixed(3));
      const meta = buildEmbeddedStairMetadata({
        placement: {
          corner: (inh.corner as StairCorner) || 'TOP-LEFT',
          x: resolved.x, y: stairYFinal,
          relativeX: resolved.x - (livingRoom.x || 0),
          relativeY: stairYFinal - (livingRoom.y || 0),
          flightDirection: (inh.flightDirection as StairFlightDirection) || (upEntry === 'BOTTOM' ? 'UP' : 'DOWN'),
          entryFace: upEntry,
          exitFace: upExit,
          usable: true,
          usabilityReason: `Inherited from ground floor (${resolved.rule}); entry ${upEntry} -> ${upEntry === 'BOTTOM' ? botP : topP} ft passage`,
        },
        sW: stairW, sH: stairH,
        stairType: groundStairType, stairSpec,
        source: `UPPER_FLOOR_${resolved.rule}`,
      });
      meta.sidePassageFt = Number((W - stairW).toFixed(2));
      meta.connectingPassageFt = { top: topP, bottom: botP };
      (livingRoom as any).embeddedStair = meta;
    }

    // 3) REAR BEDROOM (door wall = upar, passage ki taraf) — exact zone ke baad, H tak
    buildUpperBedroom(rearBedKey, rearY0, rearH, 'TOP', 'REAR_BUNGALOW', 'BUNGALOW_REAR_ATTACHED');

    console.log('[UPPER FLOOR ZONING]', {
      W, H, frontH, zoneY0, zoneH, rearY0, rearH, stairY, topP, botP, minBedDepth,
      covered: Number((frontH + zoneH + rearH).toFixed(2)),
    });

    return finalizeRooms(rooms);
  }

  // ==========================================================
  // BRANCH 4: UPPER-FLOOR NO-PARKING (W >= 17)
  // ==========================================================
    if (!hasParking && hasLiving && hasStair && W >= 6.0 && H >= 35.0) {
    console.log('[BUILD RESIDENTIAL LAYOUT] → BRANCH 4 (UPPER NO-PARKING)');
    let groundLivingY: number | null = null;
    if (groundStairPosition && groundStairRelativeOffset) {
      groundLivingY = (groundStairPosition.y || 0) - (groundStairRelativeOffset.dy || 0);
    }

    const frontBedH = Math.max(10, Math.min(15, (H - 16) * 0.4));
    const minLivingH = 16;

    const frontBedKey = bedrooms.find(k => k === 'MASTER BEDROOM') || bedrooms.find(k => k === 'FRONT BEDROOM') || bedrooms[0];
    const frontAttachedW = hasAttached ? 5.0 : 0;
    const frontBedWidth = W - frontAttachedW;

    addRoom(frontBedKey, 0, 0, frontBedWidth, frontBedH, {
      privateZone: true, furnitureValidated: true,
      placementZone: 'FRONT_BUNGALOW',
      requestedArea: roomArea(frontBedKey, 140),
    });
    const frontBed = rooms[rooms.length - 1];

    if (hasAttached) {
      const orientation = getAttachedToiletOrientation(frontBed.w || 0, frontBed.h || 0);
      addRoom('ATTACHED TOILET',
        (frontBed.x || 0) + orientation.x, (frontBed.y || 0) + orientation.y,
        orientation.w, orientation.h,
        {
          attachedTo: frontBed.id, subZoneOf: frontBed.id,
          isSubRoom: true, serviceCore: true, ventilationRequired: true,
          orientation: orientation.orientation === 'V' ? 'VERTICAL' : 'HORIZONTAL',
          placementRule: 'BUNGALOW_FRONT_ATTACHED',
        });
    }

    let finalLivingY = frontBedH;
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
      alignmentRule, placementZone: 'MIDDLE_LIVING', fullWidth: true,
    });
    const livingRoom = rooms[rooms.length - 1];

    const groundStairW4 = groundStairPosition && (groundStairPosition as any).w ? Number((groundStairPosition as any).w) : 0;
    const groundStairH4 = groundStairPosition && (groundStairPosition as any).h ? Number((groundStairPosition as any).h) : 0;

    const stairW = groundStairW4 > 0 ? groundStairW4 : Math.min(6, Math.max(5.5, stairSpec.requiredWidthFt || 5.5));
    const stairH = groundStairH4 > 0 ? Math.min(groundStairH4, minLivingH) : Math.min(minLivingH, Math.max(7.5, stairSpec.requiredLengthFt || 8));

    if (livingRoom) {
      const resolved = resolveInheritedStairPosition({
        livingX: livingRoom.x || 0, livingY: livingRoom.y || 0,
        livingW: livingRoom.w || 0, livingH: livingRoom.h || 0,
        stairW, stairH, userInheritedX, userInheritedY,
        groundStairPosition, groundStairRelativeOffset: groundStairPosition ? undefined : groundStairRelativeOffset,
        fallbackPosition: inputStairPosition,
      });

      (livingRoom as any).embeddedStair = buildEmbeddedStairMetadata({
        placement: {
          corner: 'TOP-RIGHT',
          x: resolved.x, y: resolved.y,
          relativeX: resolved.x - (livingRoom.x || 0),
          relativeY: resolved.y - (livingRoom.y || 0),
          flightDirection: 'UP',
          entryFace: 'BOTTOM',
          exitFace: 'TOP',
          usable: true,
          usabilityReason: `Inherited (${resolved.rule})`,
        },
        sW: stairW, sH: stairH,
        stairType: stairSpec.staircaseType, stairSpec,
        source: `UPPER_NO_PARKING_${resolved.rule}`,
      });
    }

    const rearBedKey = bedrooms.length > 1
      ? (bedrooms.find((k, i) => i > 0) || bedrooms[1] || bedrooms[0])
      : frontBedKey;

    const rearBedYFinal = finalLivingY + minLivingH + 0.1;
    const rearBedHFinal = Math.max(10, H - rearBedYFinal);

    if (rearBedHFinal >= 9.5) {
      addRoom(rearBedKey, 0, rearBedYFinal, W, rearBedHFinal, {
        privateZone: true, furnitureValidated: true,
        placementZone: 'REAR_BUNGALOW',
        requestedArea: roomArea(rearBedKey, 140),
      });
      const rearBed = rooms[rooms.length - 1];

      if (hasAttached) {
        const orientation = getAttachedToiletOrientation(rearBed.w || 0, rearBed.h || 0);
        addRoom('ATTACHED TOILET',
          (rearBed.x || 0) + orientation.x, (rearBed.y || 0) + orientation.y,
          orientation.w, orientation.h,
          {
            attachedTo: rearBed.id, subZoneOf: rearBed.id,
            isSubRoom: true, serviceCore: true, ventilationRequired: true,
            orientation: orientation.orientation === 'V' ? 'VERTICAL' : 'HORIZONTAL',
            placementRule: 'BUNGALOW_REAR_ATTACHED',
          });
      }
    }

    return finalizeRooms(rooms);
  }

  console.warn('[BUILD RESIDENTIAL LAYOUT] ⚠️ NO BRANCH MATCHED');
  return finalizeRooms(rooms);
}

// ============================================================
// VALIDATION
// ============================================================
function validateFurniture(room: FloorRoom): { ok: boolean; note: string } {
  const key = canonical(room.name);
  const rule = PRACTICAL_ROOM_RULES[key];
  if (!rule) return { ok: true, note: 'No furniture-specific rule.' };
  const minDim = Math.min(room.w || 0, room.h || 0);
  const requiredMin = Math.min(rule.minWidth, rule.minDepth);
  if (minDim < requiredMin) return { ok: false, note: `${key} is ${room.w?.toFixed(2)}' × ${room.h?.toFixed(2)}'; minimum is constrained.` };
  const ratio = Math.max(room.w || 0, room.h || 0) / Math.max(0.1, minDim);
  if (ratio > 2.6 && !['PASSAGE', 'DUCT'].includes(key)) return { ok: false, note: `${key} aspect ratio ${ratio.toFixed(2)}:1 too elongated.` };
  return { ok: true, note: `${rule.furniture}; clear circulation assumed.` };
}

// ============================================================
// ✅ GROUND STAIR -> UPAR KI FLOORS / TOWER (same size, shape, type)
// Ground par final hui stair yahan save hoti hai. Agar caller groundStairSpec / groundStairPosition.spec
// pass nahi karta to isi cache se (same width + floor height) wahi stair milti hai.
// ============================================================
type GroundStairRecord = {
  spec: StaircaseFootprint; type: StaircaseType;
  corner?: string; entryFace?: string; exitFace?: string; flightDirection?: string;
};
const groundStairCache = new Map<string, GroundStairRecord>();
const stairCacheKey = (W: number, floorH: number) => `${W.toFixed(2)}|${floorH}`;

/** Ground stair ki POSITION (plan-local ft). Floor height se independent -> tower/upper floors ko wahi position milti hai. */
type GroundStairPosRecord = {
  x: number; y: number; w: number; h: number;
  relX: number; relY: number;
  corner?: string; entryFace?: string; exitFace?: string; flightDirection?: string;
  staircaseType?: StaircaseType;
};
const groundStairPosCache = new Map<string, GroundStairPosRecord>();
const stairPosKey = (W: number) => W.toFixed(2);

function isValidStairPos(p: any, W: number, H: number): boolean {
  if (!p) return false;
  const x = Number(p.x), y = Number(p.y), w = Number(p.w) || 0, h = Number(p.h) || 0;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  // plan-local coordinates hi valid hain (global/MOS-offset coordinates reject)
  return x >= -0.01 && y >= -0.01 && x + w <= W + 0.05 && y + h <= H + 0.05;
}

function normalizeRoomKey(k: string): string {
  const map: Record<string, string> = {
    'ATTACHED BATHROOM': 'ATTACHED TOILET', 'FRONT ATTACHED BATH': 'ATTACHED TOILET', 'REAR ATTACHED BATH': 'ATTACHED TOILET',
    'COMMON BATHROOM': 'COMMON TOILET', 'FRONT BEDROOM': 'BEDROOM', 'REAR BEDROOM': 'BEDROOM',
  };
  return map[k] || k;
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

  console.log('[GENERATE] INPUTS', { W, H, floorName, ground, isTower, mode, area, specs });

  const program = programFromInput(
    request.selectedRooms, request.bhk || 'AUTO', area,
    ground, mode, W, H, request.groundFloorProgram,
  );

  console.log('[GENERATE] PROGRAM', program);

  if (specs.length === 0 && ground && program.includes('LIVING ROOM') && program.includes('STAIRCASE')) {
    specs.push({ key: 'STAIRCASE', count: 1, areaMode: 'AUTO', embedIn: 'LIVING ROOM' } as any);
  }

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

  // ✅ FIX: Stair zone = poori living width x living length (60% / 80% ke andaze nahi)
  const availableStairWidth = livingRoomWidth;
  const availableStairLength = Math.max(8, livingRoomLength - 0.5);

  const floorHeightFt = n(request.floorToFloorHeightFeet, 10);

  // ✅ Upar ki floors / tower: ground wali stair ka SAME type, flight width, treads, riser count.
  // Sirf us floor ki height ke hisaab se riser height dobara nikalti hai.
  const inheritedRec: GroundStairRecord | null = ground ? null : (() => {
    const spec = request.groundStairSpec ?? (request.groundStairPosition as any)?.spec;
    const pos: any = request.groundStairPosition || {};
    if (spec) {
      return {
        spec, type: (pos.staircaseType || spec.staircaseType) as StaircaseType,
        corner: pos.corner, entryFace: pos.entryFace, exitFace: pos.exitFace, flightDirection: pos.flightDirection,
      };
    }
    const cached = groundStairCache.get(stairCacheKey(W, floorHeightFt));
    if (cached) console.warn('[GENERATE] groundStairSpec nahi mila — cache se ground stair use hui');
    return cached || null;
  })();

  const stairSelection = inheritedRec
    ? {
        stairType: inheritedRec.type,
        stairSpec: adaptStairToFloorHeight(inheritedRec.spec, floorHeightFt),
        reason: 'INHERITED FROM GROUND', alternatives: [] as any[],
      }
    : selectBestStairType(W, H, availableStairWidth, availableStairLength, floorHeightFt);
  if (!ground && !inheritedRec) {
    console.warn('[GENERATE] ⚠️ Ground stair spec available nahi — is floor ki stair alag calculate hui (size mismatch ho sakta hai).');
  }

  let stairType = stairSelection.stairType;
  let staircase = stairSelection.stairSpec;

  console.log('[GENERATE] STAIR TYPE SELECTED', {
    type: stairType, reason: stairSelection.reason,
    alternatives: stairSelection.alternatives,
  });

  const parkingMode = (String(request.parkingMode || 'CAR').toUpperCase() as ParkingMode);
  // ✅ Ground stair position: request me valid (plan-local) ho to wahi; warna (missing / global coordinates)
  // ground ne jo position cache ki thi wo. Isse upper floor + tower par stair ground wali jagah hi aati hai.
  const reqStairPos: any = ground ? null : (request.groundStairPosition || null);
  const cachedStairPos = ground ? undefined : groundStairPosCache.get(stairPosKey(W));
  const useReqPos = !!reqStairPos && isValidStairPos(reqStairPos, W, H);
  if (!ground && reqStairPos && !useReqPos) {
    console.warn('[GENERATE] groundStairPosition plan-local range me nahi (global/MOS offset?) -> cache use hoga', reqStairPos);
  }
  if (!ground && !useReqPos && !cachedStairPos) {
    console.warn('[GENERATE] ⚠️ Ground stair position request me bhi nahi aur cache me bhi nahi — pehle GROUND floor generate karo.');
  }
  const groundStairPosition = ground ? undefined : (useReqPos
    ? { ...reqStairPos, ...(inheritedRec ? { corner: inheritedRec.corner, entryFace: inheritedRec.entryFace, exitFace: inheritedRec.exitFace, flightDirection: inheritedRec.flightDirection } : {}) } as any
    : (cachedStairPos
        ? { x: cachedStairPos.x, y: cachedStairPos.y, w: cachedStairPos.w, h: cachedStairPos.h,
            corner: cachedStairPos.corner, entryFace: cachedStairPos.entryFace, exitFace: cachedStairPos.exitFace,
            flightDirection: cachedStairPos.flightDirection, staircaseType: cachedStairPos.staircaseType } as any
        : undefined));
  const groundStairRelativeOffset = ground ? undefined
    : (useReqPos ? request.groundStairRelativeOffset
      : (cachedStairPos ? { dx: cachedStairPos.relX, dy: cachedStairPos.relY } : request.groundStairRelativeOffset));

  const rawRooms = buildResidentialLayout(
    program, specs, W, H, ground,
    staircase, parkingMode, undefined,
    groundStairPosition, groundStairRelativeOffset, isTower,
  );

  const rooms = rawRooms;

  // ✅ Result me wahi stair jo layout me actually draw hui (ground par fit-loop ne type/size badla ho sakta hai)
  {
    const lr: any = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
    const emb = lr?.embeddedStair;
    if (emb?.staircaseSpec) {
      staircase = emb.staircaseSpec as StaircaseFootprint;
      stairType = (emb.staircaseType || stairType) as StaircaseType;
      if (ground && emb.usable !== false) {
        groundStairCache.set(stairCacheKey(W, floorHeightFt), {
          spec: staircase, type: stairType, corner: emb.placedAtCorner,
          entryFace: emb.entryFace, exitFace: emb.exitFace, flightDirection: emb.flightDirection,
        });
        groundStairPosCache.set(stairPosKey(W), {
          x: Number(emb.absX ?? ((lr?.x || 0) + (emb.relX || 0))),
          y: Number(emb.absY ?? ((lr?.y || 0) + (emb.relY || 0))),
          w: Number(emb.w || 0), h: Number(emb.h || 0),
          relX: Number(emb.relX || 0), relY: Number(emb.relY || 0),
          corner: emb.placedAtCorner, entryFace: emb.entryFace, exitFace: emb.exitFace,
          flightDirection: emb.flightDirection, staircaseType: emb.staircaseType,
        });
      }
    }
  }

  console.log('[GENERATE] ROOMS GENERATED', {
    count: rooms.length,
    names: rooms.map(r => r.name),
    embeddedStairPresent: !!(rooms.find(r => canonical(r.name) === 'LIVING ROOM') as any)?.embeddedStair,
    staircaseRoomPresent: rooms.some(r => canonical(r.name) === 'STAIRCASE'),
  });

  const warnings: string[] = [];
  const errors: string[] = [];
  const furnitureChecks: ArchitecturalPlanResult['furnitureChecks'] = [];

  const requestedCounts = roomCounts(program.map(normalizeRoomKey));
  const presentCounts = roomCounts(rooms.map(r => normalizeRoomKey(canonical(r.name))));

  const livingRoom = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
  const hasEmbeddedStair = !!(livingRoom as any)?.embeddedStair;
  if (hasEmbeddedStair && !presentCounts['STAIRCASE']) {
    presentCounts['STAIRCASE'] = 1;
  }

  for (const [key, wanted] of Object.entries(requestedCounts)) {
    const got = key === 'BATHROOM'
      ? (presentCounts['BATHROOM'] || 0) + (presentCounts['ATTACHED TOILET'] || 0) + (presentCounts['COMMON TOILET'] || 0)
      : (presentCounts[key] || 0);
    if (got < wanted) errors.push(`${floorName}: REQUIRED ROOM MISSING → ${key}. Requested ${wanted}, got ${got}.`);
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

  for (const room of rooms) {
    const embeddedStair = (room as any)?.embeddedStair;
    if (embeddedStair) {
      if (!embeddedStair.usable) {
        warnings.push(`${floorName}: STAIRCASE in ${room.name} is UNUSABLE → ${embeddedStair.usabilityReason}`);
      }
      console.log('[STAIR USABILITY]', {
        room: room.name,
        corner: embeddedStair.placedAtCorner,
        flightDirection: embeddedStair.flightDirection,
        entryFace: embeddedStair.entryFace,
        exitFace: embeddedStair.exitFace,
        usable: embeddedStair.usable,
        reason: embeddedStair.usabilityReason,
      });
    }
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
    score, errors, warnings,
  });
  console.groupEnd();

  return {
    rooms,
    warnings: Array.from(new Set(warnings)),
    errors: Array.from(new Set(errors)),
    score, furnitureChecks, stairType, staircase, orientation,
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
  /** Upar ki floors/tower ko pass karo (groundStairSpec) taaki same stair bane */
  spec?: StaircaseFootprint;
  staircaseType?: StaircaseType;
  corner?: string; entryFace?: string; exitFace?: string; flightDirection?: string;
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
      spec: embeddedStair.staircaseSpec,
      staircaseType: embeddedStair.staircaseType,
      corner: embeddedStair.placedAtCorner,
      entryFace: embeddedStair.entryFace,
      exitFace: embeddedStair.exitFace,
      flightDirection: embeddedStair.flightDirection,
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
export function roomProgramForFloor(
  selectedRooms: any, bhk: string, floorArea: number,
  isGround: boolean, mode: string, width = 0, length = 0,
): string[] {
  return programFromInput(selectedRooms, bhk, floorArea, isGround, mode, width, length);
}