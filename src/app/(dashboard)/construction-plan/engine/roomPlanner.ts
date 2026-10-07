/* =========================================================
   CONSTRUCTION PLAN SYSTEM — SINGLE RESIDENTIAL ROOM PLANNER
   ✅ FORMULA-BASED | PROPORTIONAL | ANY PLOT SIZE
   ✅ UPDATED: Pure formulas moved to layoutFormulas.ts
========================================================= */

import { FloorRoom, PlanningMode, ParkingMode, CandidateStrategy } from './planningTypes';
import { BHK_PRESETS, getRoomDefinition } from './roomRules';
import { calculateStaircase, fitStaircaseToZone, solveStairDrawPlan, adaptStairToFloorHeight, getStairDrawingHints, StaircaseType, StaircaseFootprint, FLIGHT_WIDTH_MAX_FT, FLIGHT_WIDTH_MIN_FT } from './stairPlanner';
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
    /** true => toilet bedroom ki DOOR WALI wall par hai */
    onDoorWall: boolean;
    side: 'LEFT' | 'RIGHT';
    wall: 'TOP' | 'BOTTOM';
  };
  /** Bedroom door ka offset (door wali wall par, bedroom ke left se) — hamesha wall ke paas (standard clearance) */
  doorOffset: number;
  /** Toilet ke baad bedroom me furniture (bed + wardrobe + walking) ke liye rectangle bachta hai? */
  furnitureOk: boolean;
  freeRect: { w: number; h: number } | null;
};

/** Bedroom ki ek free rectangle (a x b) me furniture aa sakta hai? (PRACTICAL_ROOM_RULES se, dono orientation) */
const bedFits = (a: number, b: number, key: string): boolean => {
  const r = PRACTICAL_ROOM_RULES[key] || PRACTICAL_ROOM_RULES['BEDROOM'] || { minWidth: 7, minDepth: 8.5 };
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return lo >= r.minWidth - 0.01 && hi >= r.minDepth - 0.01;
};

/**
 * ✅ DYNAMIC attached-toilet placement (bedroom ke ANDAR, horizontal).
 * Har candidate (wall x side x size) ke liye bedroom ka bacha hua free rectangle nikalta hai aur check karta hai
 * ki bed + wardrobe + walking ki jagah bachti hai ya nahi. Fixed size / fixed position nahi.
 *
 *   wall  : bedroom ki door wali wall (preferred) YA uski opposite wall (agar door wali par furniture nahi aata)
 *   side  : LEFT / RIGHT corner (sides param se limit hota hai: external wall ki taraf)
 *   size  : area (~ purane toilet jitni) same rakhte hue width badhao / depth ghatao  (4.5 ft depth tak)
 *
 * Score: furniture fit (bahut bada bonus) > bacha hua free area > door-wall par ho (plumbing/passage ke paas) > preferred side.
 * Bedroom door hamesha wall ke paas, standard clearance (DOOR_WALL_CLEARANCE_FT) par -> beech me space waste nahi.
 */
function planDoorSideToilet(
  bx: number, by: number, bw: number, bh: number,
  doorWall: 'TOP' | 'BOTTOM',
  doorW = 3.0,
  minToiletW = 4.5,
  maxToiletW = 6.5,
  toiletH = 5.0,
  /** true => preferred side RIGHT (right column ke bedroom: external wall right hoti hai) */
  mirror = false,
  opts: { bedKey?: string; sides?: Array<'LEFT' | 'RIGHT'>; blockedBand?: [number, number]; preferFar?: boolean } = {},
): DoorSideToiletPlan {
  const bedKey = opts.bedKey || 'BEDROOM';
  const sides: Array<'LEFT' | 'RIGHT'> = opts.sides && opts.sides.length ? opts.sides : (mirror ? ['RIGHT'] : ['LEFT', 'RIGHT']);
  const prefSide: 'LEFT' | 'RIGHT' = mirror ? 'RIGHT' : 'LEFT';
  const oppWall: 'TOP' | 'BOTTOM' = doorWall === 'BOTTOM' ? 'TOP' : 'BOTTOM';
  const clr = DOOR_WALL_CLEARANCE_FT;
  const TOILET_MIN_H = 4.5, TOILET_MAX_H = 7.0, MIN_AREA = 24;

  const defaultDoorOffset = Math.max(0.3, bw - doorW - clr);

  // reference toilet area: purane formula wala size (bedroom jitna gehra, toilet utna bada)
  const dynH0 = Math.min(TOILET_MAX_H, Math.max(toiletH, (bh - 5.0) * 0.45 + 2.0));
  const tw0 = Math.min(maxToiletW, Math.max(minToiletW, bw - doorW - 1.0));
  const targetArea = Math.max(MIN_AREA + 4, tw0 * dynH0);

  type Cand = { wall: 'TOP' | 'BOTTOM'; side: 'LEFT' | 'RIGHT'; tw: number; th: number; score: number; furnOk: boolean; free: { w: number; h: number } };
  let best: Cand | null = null;

  for (const wall of [doorWall, oppWall] as const) {
    const onDoorWall = wall === doorWall;
    for (const side of sides) {
      for (let th = TOILET_MIN_H; th <= Math.min(TOILET_MAX_H, bh - 3) + 1e-6; th += 0.25) {
        // width badhao / depth ghatao: area ~ target; door wali wall par bedroom door ke liye jagah chhodo
        const maxTW = onDoorWall
          ? Math.min(maxToiletW + 2, bw - doorW - clr - 0.5)
          : Math.min(maxToiletW + 2, bw - 3);
        // wide-shallow par bhi toilet ka aspect ratio <= 2:1 (bahut lamba corridor jaisa bathroom nahi)
        const tw = Math.min(maxTW, th * 2.0, Math.max(minToiletW, Math.round((targetArea / th) * 4) / 4));
        if (tw < 4 || th < 4 || tw * th < MIN_AREA) continue;
        if (onDoorWall && bw - tw < doorW + clr + 0.3) continue;
        // ✅ blockedBand (global x): door wali wall par ye x-range khali rehni chahiye (bedroom door / side corridor ka access)
        if (onDoorWall && opts.blockedBand) {
          const tx0 = side === 'LEFT' ? bx : bx + bw - tw;
          if (tx0 < opts.blockedBand[1] - 0.01 && tx0 + tw > opts.blockedBand[0] + 0.01) continue;
        }
        if (!onDoorWall && bh - th < doorW + 1.0) continue; // door swing ke liye jagah

        const A = { w: bw, h: bh - th };        // toilet ke upar/neeche poori width wali strip
        const B = { w: bw - tw, h: bh };        // toilet ke bagal wali poori height wali strip
        const fitA = bedFits(A.w, A.h, bedKey), fitB = bedFits(B.w, B.h, bedKey);
        const furnOk = fitA || fitB;
        const free = A.w * A.h >= B.w * B.h ? A : B;
        const score =
          (furnOk ? 1000 : 0) +
          free.w * free.h * 2 +
          // preferFar (upper floors): toilet BAHRI (far) wall par -> window seedha bahar; warna door-wall (plumbing/passage ke paas)
          (opts.preferFar ? (onDoorWall ? 0 : 60) : (onDoorWall ? 40 : 0)) +
          (side === prefSide ? 10 : 0) -
          Math.abs(tw * th - targetArea) * 0.3;
        if (!best || score > best.score) best = { wall, side, tw, th, score, furnOk, free };
      }
    }
  }

  if (!best) return { toilet: null, doorOffset: defaultDoorOffset, furnitureOk: false, freeRect: null };

  const { wall, side, tw, th } = best;
  const onDoorWall = wall === doorWall;
  const tx = side === 'LEFT' ? bx : bx + bw - tw;
  const ty = wall === 'BOTTOM' ? by + bh - th : by;

  // Bedroom door: wall ke paas (standard clearance). Toilet door wali wall par ho to uske opposite end par.
  let doorOffset = side === 'LEFT' ? bw - doorW - clr : clr;
  doorOffset = Math.max(0.3, Math.min(doorOffset, bw - doorW - 0.3));

  return {
    toilet: {
      x: tx, y: ty, w: tw, h: th,
      onDoorWall, side, wall,
      // toilet ka door bedroom ki taraf kholta hai
      door: {
        id: 'att_door_bedroom',
        wall: wall === 'BOTTOM' ? 'TOP' : 'BOTTOM',
        widthFeet: 2.5,
        // ✅ Door centre me nahi: corner ke paas (sirf swing ke liye jagah) -> baaki wall fixtures ke liye
        offsetFeet: Math.min(clr, Math.max(0.3, tw - 2.5 - 0.3)),
        doorType: 'TOILET', renderSymbol: true, swingInside: true,
      },
      // external wall par ventilation
      // far wall (bahri) par ho to window usi wall par (seedhi bahar); door-wall par ho to side wall par
      window: onDoorWall
        ? {
            id: side === 'RIGHT' ? 'att_vent_right' : 'att_vent_left',
            wall: side,
            lengthFeet: 2,
            offsetFeet: Math.max(0.3, th / 2 - 1),
          }
        : {
            id: 'att_vent_exterior',
            wall,
            lengthFeet: 2,
            offsetFeet: Math.max(0.3, tw / 2 - 1),
          },
    },
    doorOffset,
    furnitureOk: best.furnOk,
    freeRect: best.free,
  };
}

// ============================================================
// ✅ DYNAMIC BEDROOM DOOR POSITION (hardcode / fixed-center nahi)
// Door ka left-edge offset (room-relative) is tarah chunta hai:
//   1) attached toilet ke span ko overlap na kare (avoid)
//   2) stair ke span par na aaye
//   3) DEEWAR KE PAAS (standard clearance) — beech me nahi, taaki baaki wall furniture ke liye khali rahe
//   4) in sab me stair ke landing ke sabse paas wala end (kam walk)
// ============================================================
function pickDoorOffset(
  bw: number, doorW: number,
  avoid: Array<[number, number]> = [],
  stairSpan: [number, number] | null = null,
  edge = DOOR_WALL_CLEARANCE_FT,
): number {
  const lo = edge;
  const hi = Math.max(lo, bw - doorW - edge);
  let best = hi;
  let bestScore = Infinity;
  for (let p = lo; p <= hi + 1e-6; p += 0.25) {
    let sc = 0;
    for (const [a, b] of avoid) if (p < b + 0.3 && p + doorW > a - 0.3) sc += 2000;
    let d = 0;
    if (stairSpan) {
      const [a, b] = stairSpan;
      if (p < b && p + doorW > a) sc += 500;
      else d = Math.max(a - (p + doorW), p - b, 0);
    }
    const wallDist = Math.min(p, bw - (p + doorW));
    sc += wallDist * 3 + d * 0.4;
    if (sc < bestScore) { bestScore = sc; best = p; }
  }
  return Number(best.toFixed(2));
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
  /** Total deficiency score (0 = clean). Narrow plots me kam deficiency wala option jeet-ta hai */
  weight?: number;
  /** Stair ke liye jin doors ko wall par khiskana padega (absolute plan coord, same door id sab rooms me) */
  relocations?: Array<{ id: string; abs: number; axis: 'x' | 'y' }>;
};

/** Door / pehli riser ke samne kam se kam itna free chahiye (ft) */
const STAIR_CLEAR_DEPTH_FT = 3.0;
/** Pehli riser ke samne hard minimum (ft). Door-zone 3 ft hi rehta hai, par stair ka entry 3.5 ft se kam nahi. */
const STAIR_ENTRY_MIN_FT = 3.5;
/** Passage <-> living khula edge: stair ke baad kam se kam itna free chahiye (ft) */
const MIN_OPEN_EDGE_FREE_FT = 3.5;
/** Stair ke bagal me circulation ke liye min free width (ft) */
const MIN_SIDE_WALK_FT = 3.0;
/** Hard-fail penalty: entry band / passage opening / wall-to-wall stair ko 'usable' kabhi nahi banne dena */
const STAIR_HARD_PENALTY = 100000;

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
  const doorZones: Array<{ id: string; rect: Rect; seg: Rect; owner: FloorRoom; door: any }> = [];
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
      doorZones.push({ id: `${r.name}:${(d as any).id || (d as any).entryRole || d.wall}`, rect, seg, owner: r, door: d });
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
/**
 * DOOR RELOCATION (smart planning): stair kisi door ke 3 ft zone me aaye to door ko usi wall par khisaka do.
 * Door ke saare copies (jaise PARKING + LIVING ka shared door) ek hi absolute jagah par jaate hain.
 * Free jagah mile to null nahi, relocation return hota hai; warna null (tab door "block" maana jayega).
 */
function tryRelocateDoor(
  dz: { id: string; rect: Rect; seg: Rect; owner: FloorRoom; door: any },
  stair: Rect,
  zones: Array<{ id: string; rect: Rect; seg: Rect; owner: FloorRoom; door: any }>,
  L: Rect,
): { id: string; abs: number; axis: 'x' | 'y' } | null {
  const doorId = dz.door && dz.door.id ? String(dz.door.id) : '';
  if (!doorId) return null;
  const horizontalWall = dz.seg.h === 0;
  const axis: 'x' | 'y' = horizontalWall ? 'x' : 'y';
  const wd = horizontalWall ? dz.seg.w : dz.seg.h;
  const group = zones.filter(z => z.door && String(z.door.id) === doorId);
  let lo = -Infinity, hi = Infinity;
  for (const z of group) {
    const R = asRect(z.owner);
    const o0 = horizontalWall ? R.x : R.y, o1 = o0 + (horizontalWall ? R.w : R.h);
    lo = Math.max(lo, o0); hi = Math.min(hi, o1);
  }
  const l0 = horizontalWall ? L.x : L.y, l1 = l0 + (horizontalWall ? L.w : L.h);
  lo = Math.max(lo, l0) + 0.5; hi = Math.min(hi, l1) - 0.5 - wd;
  if (hi < lo) return null;
  const cur = horizontalWall ? dz.seg.x : dz.seg.y;
  const bandAt = (a0: number): Rect => horizontalWall
    ? { x: a0, y: dz.rect.y, w: wd, h: dz.rect.h }
    : { x: dz.rect.x, y: a0, w: dz.rect.w, h: wd };
  const segAt = (a0: number): Rect => horizontalWall ? { x: a0, y: dz.seg.y, w: wd, h: 0 } : { x: dz.seg.x, y: a0, w: 0, h: wd };
  const cands: number[] = [];
  for (let a = lo; a <= hi + 1e-6; a += 0.25) cands.push(Number(a.toFixed(2)));
  cands.sort((p, q) => Math.abs(p - cur) - Math.abs(q - cur));
  for (const a0 of cands) {
    if (rectsOverlap(stair, bandAt(a0))) continue;
    const sg = segAt(a0);
    let clash = false;
    for (const z of zones) {
      if (z.door && String(z.door.id) === doorId) continue;
      if (rectGap(sg, z.seg) < 0.6) { clash = true; break; }
    }
    if (!clash) return { id: doorId, abs: a0, axis };
  }
  return null;
}

/** chosen stair placement ki relocations ko rooms ke doors par apply karo (same door id = sab copies) */
function applyDoorRelocations(rooms: FloorRoom[], placement: StairPlacement | null | undefined) {
  if (!placement || !placement.relocations || !placement.relocations.length) return;
  for (const rl of placement.relocations) {
    for (const room of rooms) {
      for (const d of (room.doors || [])) {
        if (String((d as any).id) !== rl.id) continue;
        const origin = rl.axis === 'x' ? (room.x || 0) : (room.y || 0);
        (d as any).offsetFeet = Number((rl.abs - origin).toFixed(2));
        (d as any).relocatedForStair = true;
      }
    }
  }
  console.log('[STAIR] doors relocated', placement.relocations);
}

function chooseStaircaseCorner(
  livingRoom: FloorRoom,
  stairW: number,
  stairH: number,
  existingRooms: FloorRoom[],
  existingDoors: any[],
  stairType: StaircaseType,
  opts: {
    /** true => stair ki run X direction me (entry LEFT/RIGHT face); w/h already swapped hone chahiye */
    rotated?: boolean;
    /** Upper floors par isi y par stair aa sake (front/rear bedroom depth + 4 ft passage) -> in corners ko tie-break me priority */
    upperRange?: { H: number; minBed: number; topP: number; botP: number };
    /** true => stair ke raste me aane wale internal doors ko wall par khisaka sakte hain (universal ground builder) */
    relocateDoors?: boolean;
  } = {},
): StairPlacement | null {
  void existingDoors; void stairType;
  const rotated = !!opts.rotated;
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
  const faces: StairFace[] = rotated ? ['LEFT', 'RIGHT'] : ['BOTTOM', 'TOP'];

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
    const reloc: Array<{ id: string; abs: number; axis: 'x' | 'y' }> = [];
    const relocDone = new Set<string>();
    for (const dz of doorZones) {
      if (!rectsOverlap(stair, dz.rect)) continue;
      const did = dz.door && dz.door.id ? String(dz.door.id) : '';
      if (opts.relocateDoors && did) {
        if (relocDone.has(did)) continue;
        const rl = tryRelocateDoor(dz, stair, doorZones, L);
        if (rl) { reloc.push(rl); relocDone.add(did); weight += 3; continue; }
      }
      violations.push(`blocks door ${dz.id}`); weight += 50;
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
      // Narrow living (< 11 ft): U/C stair ke baad max ~3.1 ft bachta hai -> 3.0 ft clear opening manzoor (min walkway)
      // Narrow living: < 9.5 ft => 2.0 ft (compact, 2 flights ke baad itna hi bachta hai), < 11 ft => 3.0 ft, warna 3.5 ft
      const openMin = L.w < 9.5 ? 2.0 : L.w < 11 ? 3.0 : MIN_OPEN_EDGE_FREE_FT;
      if (free < Math.min(openMin, segLen) - 0.01) {
        violations.push(`blocks passage opening (free ${free.toFixed(2)} ft)`);
        weight += STAIR_HARD_PENALTY + (Math.min(openMin, segLen) - free) * 40;   // kami jitni zyada, penalty utni zyada
      }
    }

    const side = rotated ? L.h - sH : L.w - sW;
    const sideMin = L.w < 9.5 ? 2.0 : MIN_SIDE_WALK_FT;   // narrow plot: 2 ft tak manzoor
    if (side < sideMin - 0.01) {
      violations.push(`side walkway ${side.toFixed(2)} ft`);
      weight += 20 + (sideMin - side) * 30;
      if (side < 2.0 - 0.01) weight += STAIR_HARD_PENALTY;   // wall-to-wall stair: raasta hi nahi bachta
    }

    const ED = STAIR_ENTRY_MIN_FT;
    const entry: Rect = face === 'BOTTOM'
      ? { x: stair.x, y: stair.y + stair.h, w: stair.w, h: ED }
      : face === 'TOP'
        ? { x: stair.x, y: stair.y - ED, w: stair.w, h: ED }
        : face === 'LEFT'
          ? { x: stair.x - ED, y: stair.y, w: ED, h: stair.h }
          : { x: stair.x + stair.w, y: stair.y, w: ED, h: stair.h };
    const walkable = overlapArea(entry, L) + passages.reduce((a, p) => a + overlapArea(entry, asRect(p)), 0);
    const need = entry.w * entry.h;
    if (walkable < need - 0.3) {
      violations.push(`1st riser (${face}) ke samne ${ED} ft free nahi (${walkable.toFixed(1)}/${need.toFixed(1)} sqft)`);
      weight += STAIR_HARD_PENALTY;   // pehli riser ke samne jagah nahi => stair par chadh hi nahi sakte
    }

    let slack = 6;
    for (const dz of doorZones) slack = Math.min(slack, rectGap(stair, dz.seg));
    for (const oe of openEdges) slack = Math.min(slack, rectGap(stair, oe.seg));

    const corner = `${yy.n}-${xx.n}` as StairCorner;
    const placement: StairPlacement = {
      corner, x: xx.x, y: yy.y,
      relativeX: xx.x - L.x, relativeY: yy.y - L.y,
      flightDirection: face === 'BOTTOM' ? 'UP' : face === 'TOP' ? 'DOWN' : face === 'LEFT' ? 'RIGHT' : 'LEFT',
      entryFace: face,
      exitFace: face === 'BOTTOM' ? 'TOP' : face === 'TOP' ? 'BOTTOM' : face === 'LEFT' ? 'RIGHT' : 'LEFT',
      weight,
      usable: violations.length === 0,
      usabilityReason: violations.length === 0
        ? `OK: ${corner}, entry ${face} (3 ft clear), doors & passage free`
        : violations.join('; '),
      entryClearance: entry,
      violations,
      relocations: reloc,
    };
    // Upper floors par ye y feasible hai? (front bedroom >= minBed + passage, rear bedroom >= minBed + passage)
    let yPenalty = 0;
    if (opts.upperRange) {
      const { H: planH, minBed, topP, botP } = opts.upperRange;
      const lo = minBed + topP, hi = planH - sH - botP - minBed;
      if (yy.y < lo - 0.01 || yy.y > hi + 0.01) yPenalty = 500;
    }
    cands.push({ placement, weight, score: weight * 1000 + yPenalty + (face === 'TOP' || face === 'LEFT' ? 5 : 0) + (xx.n === 'RIGHT' ? 0.1 : 0) - slack });
  }

  cands.sort((a, b) => a.score - b.score);
  const best = cands[0]?.placement ?? null;
  if (best) {
    console.log(best.usable ? '[CHOOSE STAIR] ✅' : '[CHOOSE STAIR] ⚠️ NO CLEAN SPOT', best);
    if (!best.usable) {
      console.log('[CHOOSE STAIR] all candidates', { living: L, stair: { w: sW, h: sH }, rotated },
        cands.map(c => ({ corner: c.placement.corner, entry: c.placement.entryFace, weight: Math.round(c.weight), why: c.placement.violations })));
    }
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
  // ✅ Area rule (gross-equivalent, 4\" wall ke baad bhi 15x40 = 600): <=600 | 600-1000 | 1000-1500
  const ruleAreaProg = (W > 0 && L > 0) ? Math.round((W + 0.67) * (L + 0.67)) : area;

  console.log(`[PROGRAM FROM INPUT] START floor=${ground ? 'GROUND' : 'UPPER'}, layoutW=${W}, layoutH=${L}, area=${area}, hasExplicit=${hasExplicit}, auto=${auto}`);

  if (!hasExplicit && auto) {
    if (ground) {
      if (ruleAreaProg <= 600) {
        // 380-600: Parking, Kitchen, Living+Stair, Common toilet, sirf BEDROOM (attached toilet nahi)
        add('BEDROOM'); add('COMMON TOILET');
        add('KITCHEN'); add('LIVING ROOM'); add('PARKING'); add('STAIRCASE');
      } else if (ruleAreaProg <= 1000) {
        // 600-1000: MASTER BEDROOM + (bada) attached toilet + common toilet
        add('MASTER BEDROOM'); add('ATTACHED TOILET'); add('COMMON TOILET');
        add('KITCHEN'); add('LIVING ROOM'); add('PARKING'); add('STAIRCASE');
      } else if (ruleAreaProg <= 1500) {
        // 1000-1500: Kitchen cum dining, 1 common toilet, 1 bedroom + attached toilet (duct catalog se)
        add('MASTER BEDROOM'); add('ATTACHED TOILET'); add('COMMON TOILET');
        add('KITCHEN CUM DINING'); add('LIVING ROOM'); add('PARKING'); add('STAIRCASE');
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

  if (ground && auto && !hasExplicit && ruleAreaProg <= 1500) {
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
    // ✅ Renderer ke liye: treads/risers spec se draw ho (rect me stretch nahi) -> ground / upper / tower par same count
    renderHints: {
      drawFromSpec: true,
      riserCount: stairSpec.riserCount,
      flight1Treads: stairSpec.flight1.treads,
      flight2Treads: stairSpec.flight2.treads,
      middleTreads: stairSpec.middleTreads,
      treadInches: stairSpec.treadInches,
      // ✅ Variable tread: renderer is array se har tread ki depth (inch) draw kare (start/end chhote, beech ke bade)
      flight1TreadsIn: (stairSpec as any).treadProfile?.flight1,
      flight2TreadsIn: (stairSpec as any).treadProfile?.flight2,
      middleTreadsIn: (stairSpec as any).middleTreadsIn,
      // ✅ Renderer isi plan se draw kare (segments + exact depths); apna "SHORT n TREAD" na nikale -> plan.shortTreads use kare
      drawPlan: (stairSpec as any).drawPlan,
      shortTreads: (stairSpec as any).drawPlan?.shortTreads ?? 0,
      actualRiserInches: stairSpec.actualRiserInches,
      rotated: placement.entryFace === 'LEFT' || placement.entryFace === 'RIGHT',
    },
    // ✅ 2D engineering convention: kaun si flight solid, kaun si hidden (dashed), break line, arrow
    stairDrawing: getStairDrawingHints(/^UPPER/.test(source) ? 'UPPER' : 'GROUND'),
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
/**
 * Stair variant override (sirf generateArchitecturalFloorPlan ka selector set karta hai).
 *   rotated: true  -> stair ki run X direction me (entry LEFT/RIGHT), false -> portrait (entry TOP/BOTTOM), undefined -> auto
 *   type: sirf yahi stair type try ho (U = DOG_LEGGED, C = 2_QUARTER_LANDING / 2_QUARTER_WINDER, L = L_SHAPED)
 */
type StairOverride = { rotated?: boolean; type?: StaircaseType } | null;
let STAIR_OVERRIDE: StairOverride = null;

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

  // ✅ Area rule: > 600 sq.ft (gross) => master bedroom + BADA attached toilet
  const ruleArea = Math.round((W + 0.67) * (H + 0.67));
  const isBigGround = ruleArea > 600;
  // ✅ Chhoti length (clear < 34 ft, jaise 15x30): service / bedroom depth thodi kam, living stair ke liye min 8.5
  const compactH = H < 34;
  // ✅ SIZE-ADAPTIVE: bedrooms=[] => ground par bedroom zone nahi; living poori leftover depth leta hai (stair ke liye landing/access)
  const noBedroom = bedrooms.length === 0;

  // ✅ FIX: Common toilet thoda bada + passage kam se kam 4 ft (W=10 -> toilet 6 x 5.5, passage 4)
  const MIN_PASSAGE_FT = 4;
  const ctBaseW = hasCommon
    ? Math.min(
        Math.max(sizes.commonToilet.w, Math.min(6, W - MIN_PASSAGE_FT)),
        Math.max(4, W - 3.25),
      )
    : 0;
  // ✅ Passage me extra jagah ho to HORIZONTAL common toilet ki length (x) thodi badhao (max +2 ft),
  // par passage >= 4.5 ft rahe taaki bedroom door (3 ft) ka access aur stair-opening block na ho.
  const GROUND_BED_DOOR_W = 3.0;
  const minPassageAfterExt = Math.max(4.5, GROUND_BED_DOOR_W + 1.5);
  let ctW = ctBaseW;
  if (hasCommon && ctBaseW >= 5) {
    const spare = (W - ctBaseW) - minPassageAfterExt;
    ctW = Number((Math.round((ctBaseW + Math.max(0, Math.min(3, spare))) * 4) / 4).toFixed(2));
  }
  // ✅ DYNAMIC: toilet jitna chauda (horizontal) hua, utni uski length (depth) kam -> area same, bedroom ko extra depth milti hai.
  // Hardcode nahi: ctBaseW x ctHBase area preserve hota hai, par depth 4.5 ft se kam nahi.
  const CT_MIN_H = 4.5;
  const ctHBase = hasCommon ? (compactH ? 4.5 : Math.max(sizes.commonToilet.h, 5.5)) : 0;
  let ctH = hasCommon
    ? Number(Math.max(CT_MIN_H, Math.min(ctHBase, Math.round(((ctBaseW * ctHBase) / Math.max(0.1, ctW)) * 4) / 4)).toFixed(2))
    : 0;

  // ============================================================
  // ✅ STACKED WET CORE (master bedroom + common toilet):
  //   Attached toilet ko common toilet ke UPAR (same LEFT column) laate hain, beech me DUCT (ventilation + plumbing shaft).
  //   Faayde: (1) plumbing stack ek line me, (2) bedroom ka door passage ke far CORNER se judta hai (beech me waste nahi),
  //   (3) common toilet bada (width = stack width, depth 6 ft), (4) side strip nahi katti -> bedroom ek clean rectangle.
  // ============================================================
  const STACK_DUCT_H = 2.5;
  const stackedWet = hasCommon && hasAttached && bedrooms[0] === 'MASTER BEDROOM' && W >= 12 && H >= 30;
  let stackW = 0;
  if (stackedWet) {
    stackW = Math.min(7.5, Math.max(6, Math.round(W * 0.38 * 4) / 4));
    stackW = Math.min(stackW, W - MIN_PASSAGE_FT - 0.5);          // passage side kam se kam 4.5 ft
    ctW = stackW;                                                   // common toilet width = stack width
    ctH = compactH ? 5.0 : 6.0;                                     // common toilet bada (pehle ~9 x 4.5)
  }

  // ✅ FIX: living height ek hi jagah se decide hoti hai (spec override se gap/overlap nahi).
  // Bedroom ko kam se kam MIN_BED_DEPTH milna chahiye, uske liye living chhoti hoti hai (min 12 ft).
  const MIN_BED_DEPTH = compactH ? 8 : 9.5;
  const livingSpec: any = specs.find(sp => sp.key === 'LIVING ROOM');
  const wantedLivingH = Number(livingSpec?.length ?? livingSpec?.h) > 0
    ? Number(livingSpec.length ?? livingSpec.h)
    : sizes.living.h;
  const maxLivingH = H - sizes.parking.h - ctH - MIN_BED_DEPTH;
  let livingH = Math.max(8, Math.min(wantedLivingH, Math.max(compactH ? 8.5 : 12, maxLivingH)));
  // ✅ BALANCED STAIR ZONE (upper floor fix):
  // Upper floor par stair ground wali y par hi aati hai: [front bed][4ft][STAIR][4ft][rear bed].
  // Ground par rear bedroom ko saari extra length mil jaye to living niche khisak jaati hai aur
  // upper floor ka road-side bedroom 8-9 ft ka reh jaata hai. Isliye living ka top (= stair ki y)
  // plot ke beech ke paas laate hain, par ground rear bedroom ki min depth (attached toilet ke saath) bachakar.
  // Sirf BADHATE hain (kabhi chhota nahi), aur tabhi jab user ne MANUAL living length nahi di.
  {
    const livingLenManual = (livingSpec as any)?.areaMode === 'MANUAL' && Number((livingSpec as any)?.length ?? (livingSpec as any)?.h) > 0;
    if (!livingLenManual) {
      const stairLenEst = Math.max(8, Number((stairSpec as any)?.requiredLengthFt) || 10);
      const minRearBed = isBigGround ? 13 : MIN_BED_DEPTH;
      const targetLivingY = Math.max((H - stairLenEst) / 2, ctH + minRearBed);
      const balancedLivingH = (H - sizes.parking.h) - targetLivingY;
      const maxByBed = H - sizes.parking.h - ctH - MIN_BED_DEPTH;
      const grown = Math.min(balancedLivingH, maxByBed, 22);
      if (grown > livingH + 0.25) {
        console.log('[LIVING BALANCE] living badhayi (upper floor stair centre ke paas)', { from: livingH, to: grown, targetLivingY });
        livingH = Number(grown.toFixed(2));
      }
    }
  }
  if (noBedroom) livingH = Number((H - sizes.parking.h - ctH).toFixed(2));
  // ✅ Parking->Living door: SINGLE FRAME, parking width se 1 ft chhota (0.5 ft wall ke dono taraf),
// kabhi 3.5 ft se bada nahi -> kitchen wali partition tak nahi jaata.
const parkingDoorW = Math.max(2.0, Math.min(3.5, Number((sizes.parking.w - 1).toFixed(2))));
  const parkingDoorOffset = Number(Math.max(0.5, (sizes.parking.w - parkingDoorW) / 2).toFixed(2));

   // ============================================================
  // STEP 2: PARKING + KITCHEN (Front, road side)
  // ============================================================
  const parkingY = H - sizes.parking.h;
  addRoom('PARKING', 0, parkingY, sizes.parking.w, sizes.parking.h, {
    dimensionsFitted: true, // FIX: spec width/length parking ko resize na kare -> kitchen ke saath ek hi partition wall
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
  // ✅ FIX: kitchen ka x = parking ki ASLI right edge -> gap/overlap se double wall nahi banegi
  const pkRoom = rooms.find(r => canonical(r.name) === 'PARKING');
  const pkW = pkRoom ? (pkRoom.w || sizes.parking.w) : sizes.parking.w;
  const actualKitchenW = Math.max(3, W - pkW);
  // ✅ FIX: Kitchen ki height Parking ke barabar karo
  // Taaki Parking ↔ Kitchen partition wall exactly bottom tak extend ho
  const actualKitchenH = sizes.parking.h;
  addRoom(kitchenKey, pkW, parkingY, actualKitchenW, actualKitchenH, {
    
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
          // ✅ Door corner ke paas, wall se standard clearance par (centre me nahi)
          offsetFeet: Math.max(DOOR_WALL_CLEARANCE_FT, ctH - 2.5 - DOOR_WALL_CLEARANCE_FT),
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

  // ✅ Stacked plan: attached toilet (upar) + duct + common toilet (neeche), sab LEFT column me.
  // Bedroom ke baaki hisse (W - stackW) me furniture (bed + wardrobe + walking) fit hona zaroori hai, warna purana logic.
  // Rule (senior architect):
  //   - Duct ke upar ki poori patti attached toilet ko do (bedroom ek clean rectangle rahe, koi dead pocket nahi)
  //   - Agar patti bahut lambi ho (toilet ~48 sq ft se zyada), to toilet duct ke saath neeche corner me (plumbing stack),
  //     upar bacha hissa DRESSING (wardrobe) bane - bedroom me dead pocket nahi.
  let stackedAtt: { w: number; h: number; y: number; ductY: number; dressH: number; full: boolean } | null = null;
  if (stackedWet && isMaster) {
    const freeW = W - stackW;
    const avail = rearH - STACK_DUCT_H;
    if (avail >= 6 && bedFits(freeW, rearH, primaryBedroomKey)) {
      const attTarget = Math.min(avail, Math.max(7.5, 48 / stackW));
      const pocket = avail - attTarget;
      const dressOk = pocket >= 4.5 && pocket * stackW >= 20;
      const attH = Math.floor((dressOk ? attTarget : avail) * 4) / 4;
      const dressH = dressOk ? Number((avail - attH).toFixed(2)) : 0;
      const ductY = rearY + rearH - STACK_DUCT_H;
      // ✅ Attached toilet DUCT wali patti bhi le leta hai -> toilet seedha common toilet ki wall tak (bedroom aur toilet ke beech gap nahi).
      //    Plumbing stack ab dono toilets ki shared wall me (back-to-back), alag open duct slot nahi.
      stackedAtt = { w: stackW, h: Number((attH + STACK_DUCT_H).toFixed(3)), ductY, y: ductY - attH, dressH, full: !dressOk };
    } else {
      console.warn('[STACKED WET] fit nahi hua -> purana attached-toilet logic', { freeW, rearH, avail });
    }
  }
  const stripWCand = isBigGround ? Math.min(6.5, Math.max(sizes.attachedToilet.w, W * 0.36)) : sizes.attachedToilet.w;
  // ✅ Vertical strip tabhi jab toilet ka aspect ratio theek ho (<= 2.4:1); bade bedroom me horizontal door-side toilet
  const verticalAttached = !stackedAtt && isMaster && hasAttached && W >= ATTACHED_VERTICAL_MIN_W_FT && (rearH / stripWCand) <= 2.4;
  const attachedStripW = verticalAttached ? stripWCand : 0;
  const bedW = W - attachedStripW;

  // ✅ FIX: Bedroom ka door HAMESHA passage wali wall (BOTTOM) par, passage ke x-range me.
  // (Pehle 'TOP' tha -> rear external wall par render hota tha.)
  // ✅ Door passage ke far end par, SIDE WALL se standard clearance par (centre me nahi) -> bedroom ki baaki wall furniture ke liye
  let bedDoorOffset = hasCommon && passageSpan >= bedDoorW
    ? Math.min(passageStartX + passageSpan, bedW) - bedDoorW - DOOR_WALL_CLEARANCE_FT
    : Math.max(DOOR_WALL_CLEARANCE_FT, bedW - bedDoorW - DOOR_WALL_CLEARANCE_FT);

  // ✅ FIX: Narrow (W < 15) me attached toilet HORIZONTAL aur door wali wall par
  // (common toilet ke upar, taaki plumbing stack bane aur bedroom ka area waste na ho)
  const narrowToilet = isMaster && hasAttached && !verticalAttached && !stackedAtt
    ? (isBigGround
        ? planDoorSideToilet(0, rearY, bedW, rearH, 'BOTTOM', bedDoorW, Math.min(7.5, Math.max(5.5, passageStartX)), 7.5, 6, false, { bedKey: primaryBedroomKey, sides: ['LEFT'] })
        : planDoorSideToilet(0, rearY, bedW, rearH, 'BOTTOM', bedDoorW, Math.min(6.5, Math.max(4.5, passageStartX)), 6.5, 5.0, false, { bedKey: primaryBedroomKey, sides: ['LEFT'] }))
    : null;
  if (narrowToilet?.toilet) bedDoorOffset = narrowToilet.doorOffset;
  // ✅ Door hamesha passage ke x-range me (common toilet badhne par bhi access block na ho)
  if (hasCommon) bedDoorOffset = Math.max(bedDoorOffset, passageStartX + 0.3);
  bedDoorOffset = Math.max(0.3, Math.min(bedDoorOffset, bedW - bedDoorW - 0.3));
  if (narrowToilet?.toilet && !narrowToilet.furnitureOk) {
    console.warn('[ATTACHED TOILET] ground bedroom me bathroom ke baad furniture ka rectangle nahi bacha', narrowToilet.freeRect);
  }

  const skipBedroom = noBedroom && rearH < 1.5;
  let bedroomRoom: FloorRoom | undefined;
  if (!skipBedroom) {
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
  bedroomRoom = rooms[rooms.length - 1];

  if (isMaster && hasAttached && bedroomRoom) {
    if (stackedAtt) {
      addRoom('ATTACHED TOILET', 0, stackedAtt.y, stackedAtt.w, stackedAtt.h, {
        dimensionsFitted: true,
        attachedTo: bedroomRoom.id, subZoneOf: bedroomRoom.id,
        isSubRoom: true, serviceCore: true, ventilationRequired: true,
        orientation: 'HORIZONTAL', placementRule: 'STACKED_OVER_COMMON_TOILET',
        ventilationViaDuct: true,
        bedroomFurnitureFit: true,
        doors: [{
          id: 'att_door_master', wall: 'RIGHT', widthFeet: 2.5,
          // duct ki taraf (neeche) -> bedroom ki bed wall free rehti hai
          offsetFeet: Math.max(DOOR_WALL_CLEARANCE_FT, stackedAtt.h - 2.5 - DOOR_WALL_CLEARANCE_FT),
          doorType: 'TOILET', renderSymbol: true, swingInside: true,
        }],
        // poori patti: toilet rear (bahri) wall ko touch karta hai -> window seedhi bahar; corner case me left wall
        windows: [stackedAtt.full
          ? { id: 'att_vent_exterior', wall: 'TOP', lengthFeet: 2, offsetFeet: Math.max(0.5, stackedAtt.w / 2 - 1) }
          : { id: 'att_vent_left', wall: 'LEFT', lengthFeet: 2, offsetFeet: Math.max(0.5, stackedAtt.h / 2 - 1) }],
      });
      if (stackedAtt.dressH > 0) {
        addRoom('DRESSING', 0, rearY, stackedAtt.w, stackedAtt.dressH, {
          dimensionsFitted: true,
          attachedTo: bedroomRoom.id, subZoneOf: bedroomRoom.id,
          isSubRoom: true, placementRule: 'DRESSING_ABOVE_ATTACHED_TOILET',
          doors: [{
            id: 'dress_door_master', wall: 'RIGHT', widthFeet: 2.5,
            offsetFeet: Math.max(DOOR_WALL_CLEARANCE_FT, stackedAtt.dressH - 2.5 - DOOR_WALL_CLEARANCE_FT),
            doorType: 'INTERNAL', renderSymbol: true, swingInside: true,
          }],
          windows: [{ id: 'dress_win_exterior', wall: 'TOP', lengthFeet: 2, offsetFeet: Math.max(0.5, stackedAtt.w / 2 - 1) }],
        });
      }
      // (DUCT slot ab attached toilet ke andar absorb ho gaya - alag DUCT room nahi, gap nahi)
    } else if (verticalAttached) {
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
        orientation: 'HORIZONTAL', placementRule: t.onDoorWall ? 'NARROW_DOOR_SIDE_HORIZONTAL' : 'NARROW_FAR_WALL_HORIZONTAL',
        bedroomFurnitureFit: narrowToilet.furnitureOk,
        doors: [t.door],
        windows: [t.window],
      });
    } else {
      console.warn('[ATTACHED TOILET] Narrow bedroom me jagah nahi mili (door wall par strip < 4 ft).');
    }
  }

  } // end if (!skipBedroom)

  // ============================================================
  // STEP 8: STAIR (Living Room ke andar) — ab PASSAGE/KITCHEN/PARKING bante ke BAAD
  // (pehle stair pehle place hoti thi, isliye passage/doors ka pata hi nahi tha -> access block)
  // ============================================================
  if (stairEmbeddedInLiving) {
    const living = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
    if (living) {
      const floorH = stairSpec.floorToFloorHeight || 10;
      const lw = living.w || 0, lh = living.h || 0;
      const typeOrder: StaircaseType[] = STAIR_OVERRIDE?.type ? [STAIR_OVERRIDE.type] : ['DOG_LEGGED', '2_QUARTER_WINDER', '2_QUARTER_LANDING', 'L_SHAPED'];

      type Pick = { fit: ReturnType<typeof fitStaircaseToZone>; placement: StairPlacement; sW: number; sH: number; rotated?: boolean; zoneCross: number; zoneRun: number; minPassage: number };
      // Upper floors par stair isi y par aa sake (bedroom depth >= 9 ft + 4 ft passage) -> corner tie-break
      const upperRange = { H, minBed: 9, topP: 4, botP: 4 };
      let best: Pick | null = null;

      // ✅ TIERED FALLBACK (narrow plot fix):
      // Pehle strict rule (stair ke bagal 4 ft passage). Narrow plot (10'-12') me living sirf ~9-11 ft chaudi hoti hai,
      // wahan U/C stair (2 flights = ~6.2 - 6.9 ft) ke baad 4 ft side bacha hi nahi sakta -> pehle stair FAIL ho jaati thi.
      // Isliye rule dheere dheere relax hota hai: 4 ft -> 3 ft (min walkway) -> side ya end -> koi passage rule nahi.
      // Har tier me: pehle 3 ft entry clearance wali zone, phir relaxed zone, phir poori living length.
      const passageTiers: Array<{ label: string; minPassage: number; mode: 'SIDE' | 'SIDE_OR_END' }> = [
        { label: 'STRICT_4FT_SIDE', minPassage: MIN_PASSAGE_FT, mode: 'SIDE' },
        { label: 'RELAXED_3FT_SIDE', minPassage: 3, mode: 'SIDE' },
        { label: 'SIDE_OR_END_3FT', minPassage: 3, mode: 'SIDE_OR_END' },
        { label: 'NO_PASSAGE_RULE', minPassage: 0, mode: 'SIDE' },
      ];
      const zoneLens = Array.from(new Set([
        Math.max(6, lh - 4),
        Math.max(6, lh - STAIR_ENTRY_MIN_FT),
        Math.max(6, lh - STAIR_CLEAR_DEPTH_FT),
        Math.max(6, lh - 0.5),                    // relaxed fallbacks (stair kabhi gayab na ho)
        Math.max(6, lh),
      ].map(v => Number(v.toFixed(2)))));

      let usedTier = '';

      // ✅ NARROW PLOT FALLBACK (10 ft ya kam): portrait stair, ek side par >= 3 ft walkway (passage tak),
      // neeche >= 3.5 ft entry. Cross-width pehle (lw - 3), phir (lw - 2.5), (lw - 2). Sirf USABLE placement return hota hai.
      const narrowPlotFallback = (): Pick | null => {
        const runMax = Math.max(6, lh - STAIR_ENTRY_MIN_FT);
        const crossOptions = [lw - 3.0, lw - 2.5, lw - 2.0].filter(v => v >= 5.5);
        for (const cm of crossOptions) {
          for (const t of typeOrder) {
            const base = fitStaircaseToZone(floorH, {
              floorWidthFt: cm, zoneLengthFt: runMax, minPassageFt: 0, passageMode: 'SIDE',
              maxFlightWidthFt: FLIGHT_WIDTH_MAX_FT, allowedTypes: [t],
            });
            if (!base.fits) continue;
            const solved = solveStairDrawPlan(base.spec, cm, runMax);
            if (solved.plan.shortTreads !== 0) continue;
            const nW = Number(solved.plan.usedCrossFt.toFixed(3));
            const nH = Number(solved.plan.usedRunFt.toFixed(3));
            const pl = chooseStaircaseCorner(living, nW, nH, rooms, [], solved.spec.staircaseType, { upperRange, relocateDoors: true });
            if (pl && pl.usable) {
              return {
                fit: { ...base, spec: solved.spec, staircaseType: solved.spec.staircaseType },
                placement: pl, sW: nW, sH: nH, zoneCross: lw, zoneRun: lh, minPassage: 3,
              };
            }
          }
        }
        return null;
      };
      // ✅ Flight width sweep: placement unusable ho (jaise passage opening < 3.5 ft) to chaudi flight (3.28 -> 2.95 ft)
      // chhoti karke dobara try karo. Wide flight pehle (comfort), narrow baad me.
      const fwCaps = Array.from(new Set([FLIGHT_WIDTH_MAX_FT, 3.1, FLIGHT_WIDTH_MIN_FT].map(v => Number(v.toFixed(2)))));
      outer: for (const tier of passageTiers) {
        if (STAIR_OVERRIDE?.rotated === true) break;   // forced rotated: portrait try hi nahi
        for (const zl of zoneLens) {
          for (const fwCap of fwCaps) {
            const base = fitStaircaseToZone(floorH, {
              floorWidthFt: lw, zoneLengthFt: zl, minPassageFt: tier.minPassage, passageMode: tier.mode,
              maxFlightWidthFt: fwCap, endPassageTargetFt: Math.max(0, 4 - (lh - zl)),
            });
            const ordered = [base.staircaseType, ...typeOrder.filter(t => t !== base.staircaseType)]
              .filter(t => !STAIR_OVERRIDE?.type || t === STAIR_OVERRIDE.type);
            for (const t of ordered) {
              const fit = t === base.staircaseType ? base : fitStaircaseToZone(floorH, {
                floorWidthFt: lw, zoneLengthFt: zl, minPassageFt: tier.minPassage, passageMode: tier.mode,
                maxFlightWidthFt: fwCap, allowedTypes: [t], endPassageTargetFt: Math.max(0, 4 - (lh - zl)),
              });
              if (!fit.fits || !fit.passageOk) continue;
              const sW = Math.min(fit.spec.requiredWidthFt, lw);
              const sH = Math.min(fit.spec.requiredLengthFt, lh);
              if (sW < 3 || sH < 6) continue;
              const placement = chooseStaircaseCorner(living, sW, sH, rooms, [], t, { upperRange, relocateDoors: true });
              if (!placement) continue;
              const vNew = placement.weight ?? 9999;
              const vOld = best?.placement.weight ?? 9999;
              const better = !best
                || (placement.usable && !best.placement.usable)
                || (!placement.usable && !best.placement.usable && vNew < vOld - 0.01);
              if (better) { best = { fit, placement, sW, sH, zoneCross: lw, zoneRun: zl, minPassage: tier.minPassage }; usedTier = tier.label; }
              if (placement.usable) break outer;
            }
          }
        }
      }

      // ✅ FALLBACK: seedhi (portrait) stair kisi corner me clean fit nahi hui (samne wali wall se chipak jaati / 3 ft entry nahi) ->
      // stair ko ROTATE karke (run X direction me, entry LEFT/RIGHT) har corner me try karo. Types: U / winder / C / L sab.
      if (STAIR_OVERRIDE?.rotated === true || ((!best || !best.placement.usable) && STAIR_OVERRIDE?.rotated !== false)) {
        const rotLens = Array.from(new Set([
          Math.max(6, lw - 4), Math.max(6, lw - STAIR_ENTRY_MIN_FT), Math.max(6, lw - STAIR_CLEAR_DEPTH_FT), Math.max(6, lw - 0.5), Math.max(6, lw),
        ].map(v => Number(v.toFixed(2)))));
        outerRot: for (const tier of passageTiers) {
          for (const zl of rotLens) {
            for (const fwCap of fwCaps) {
              for (const t of typeOrder) {
                // rotated: cross-direction = living ki height (lh), run-direction = living ki width (lw)
                const fit = fitStaircaseToZone(floorH, {
                  floorWidthFt: lh, zoneLengthFt: zl, minPassageFt: tier.minPassage, passageMode: tier.mode,
                  maxFlightWidthFt: fwCap, allowedTypes: [t],
                });
                if (!fit.fits || !fit.passageOk) continue;
                const rW = Math.min(fit.spec.requiredLengthFt, lw);
                const rH = Math.min(fit.spec.requiredWidthFt, lh);
                if (rW < 6 || rH < 3) continue;
                // poori width wali rotated stair (wall-to-wall) tab hi allowed jab koi portrait option bacha hi na ho
                if (rW > lw - STAIR_ENTRY_MIN_FT + 0.01) continue;   // rotated stair ke ek taraf 3.5 ft entry zaroori
                const placement = chooseStaircaseCorner(living, rW, rH, rooms, [], t, { rotated: true, upperRange, relocateDoors: true });
                if (!placement) continue;
                const vNew = placement.weight ?? 9999;
                const vOld = best?.placement.weight ?? 9999;
                const better = !best
                  || (placement.usable && !best.placement.usable)
                  || (!placement.usable && !best.placement.usable && vNew < vOld - 0.01);
                if (better) { best = { fit, placement, sW: rW, sH: rH, rotated: true, zoneCross: lh, zoneRun: zl, minPassage: tier.minPassage }; usedTier = `ROTATED_${tier.label}`; }
                if (placement.usable) break outerRot;
              }
            }
          }
        }
      }

      if (best) {
        // ✅ EXACT-FIT: spec ke treads vs rect ka mismatch ("SHORT n TREAD") yahin khatam.
        //   Riser count fixed; start/end patti (Landing-1 / Landing-2) me jagah kam ho to extra treads MIDDLE me shift,
        //   aur jo footprint actual me cover hota hai wahi stair rect banta hai (drawing = actual area, hardcode nahi).
        {
          const b0: Pick = best;
          const rot = !!b0.rotated;
          const rectCross0 = rot ? b0.sH : b0.sW;
          const rectRun0 = rot ? b0.sW : b0.sH;
          // limit: zone ki cross-width se tier ka side-passage hata do, run = zone run (entry clearance pehle se kata hua)
          // side walkway kam se kam MIN_SIDE_WALK_FT, run me entry clearance (3.5 ft) bachni chahiye
          const sideKeep = Math.max(b0.minPassage, MIN_SIDE_WALK_FT);
          const crossLimit = Math.max(rectCross0, b0.zoneCross - sideKeep);
          const runLimit = Math.max(rectRun0, Math.min(b0.zoneRun, (rot ? lw : lh) - STAIR_ENTRY_MIN_FT));
          // Stage 1: original rect me hi treads redistribute (middle treads badha ke) - placement / passage change nahi
          const stage1 = solveStairDrawPlan(b0.fit.spec, rectCross0, rectRun0);
          // Stage 2: stage-1 me fit nahi hua to hi footprint badhao (cross: side passage tak, run: zone tak)
          const solved = stage1.plan.shortTreads === 0 ? stage1 : solveStairDrawPlan(b0.fit.spec, crossLimit, runLimit);
          if (solved.plan.shortTreads === 0) {
            const nCross = Number(solved.plan.usedCrossFt.toFixed(3)), nRun = Number(solved.plan.usedRunFt.toFixed(3));
            const nW = rot ? nRun : nCross, nH = rot ? nCross : nRun;
            const np = chooseStaircaseCorner(living, nW, nH, rooms, [], solved.spec.staircaseType, { rotated: rot, upperRange, relocateDoors: true });
            // naya (exact) footprint bhi usable ho tabhi lo; warna purana rect + sirf tread redistribution
            if (np && (np.usable || !b0.placement.usable)) {
              best = { ...b0, fit: { ...b0.fit, spec: solved.spec, staircaseType: solved.spec.staircaseType }, placement: np, sW: nW, sH: nH };
            } else {
              const sr = solveStairDrawPlan(b0.fit.spec, rectCross0, rectRun0);
              if (sr.plan.shortTreads === 0) best = { ...b0, fit: { ...b0.fit, spec: sr.spec, staircaseType: sr.spec.staircaseType } };
              else best = { ...b0, fit: { ...b0.fit, spec: sr.spec } };
            }
          } else {
            console.warn('[STAIR DRAW] exact fit nahi mila', solved.plan.notes);
            best = { ...b0, fit: { ...b0.fit, spec: solved.spec } };
          }
          const dp = (best as Pick).fit.spec.drawPlan;
          console.log('[STAIR DRAW PLAN]', dp && { used: [dp.usedCrossFt, dp.usedRunFt], short: dp.shortTreads, moved: dp.movedToMiddle, treads: [dp.flight1.treads, dp.flight2.treads, dp.middle.treads], notes: dp.notes });
        }
        // ✅ FINAL GUARD: exact-fit ke baad bhi stair unusable (passage block / entry band / wall-to-wall) ho to narrow fallback
        {
          const cur = best as Pick | null;
          if (cur && !cur.placement.usable) {
            const fb = narrowPlotFallback();
            if (fb) { best = fb; usedTier = 'NARROW_FALLBACK'; }
            else console.error('[STAIR] usable placement nahi mila:', cur.placement.usabilityReason);
          }
        }
        const { fit, placement, sW, sH } = best as Pick;
        applyDoorRelocations(rooms, placement);
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
          passageTier: usedTier,
        };
        meta.entryClearance = placement.entryClearance;
        meta.rotated = !!(best as Pick).rotated;
        (living as any).embeddedStair = meta;
      } else {
        console.error('[STAIR FAILED ❌] Koi stair type living me fit nahi hua', { lw, lh, floorH });
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

/* =========================================================
   SIZE-ADAPTIVE BEDROOM SPLIT (wide plots)
   ---------------------------------------------------------
   24 ft se chaude bedroom (jaise 39 ft ka master) genuine nahi lagta. Usse equal parts me todte hain:
   har part ko apna circulation door (neighbor me counterpart door ke saath) + apna ATTACHED TOILET.
   ========================================================= */
const MAX_BEDROOM_W_FT = 24;
function splitOversizedBedrooms(roomsIn: FloorRoom[], W: number, H: number, isTower: boolean): FloorRoom[] {
  if (isTower) return roomsIn;
  const rooms = roomsIn.slice();
  const isBed = (r: any) => /BEDROOM/.test(String(r.name)) && !r.isSubRoom && !r.subZoneOf;
  let serial = 800;
  let bedNo = rooms.filter(isBed).length;
  const snap = (v: number) => Math.round(v * 4) / 4;

  for (const R of rooms.filter(isBed) as any[]) {
    if (R.w <= MAX_BEDROOM_W_FT || R.h < 8) continue;
    const n = Math.min(4, Math.ceil(R.w / MAX_BEDROOM_W_FT));
    const x0 = R.x, wTot = R.w;
    const edges: number[] = [x0];
    for (let k = 1; k < n; k++) edges.push(snap(x0 + (wTot * k) / n));
    edges.push(x0 + wTot);

    // circulation door of the original room (BOTTOM / TOP wall) -> uska wall + width
    const circDoors = (R.doors || []).filter((d: any) => d.wall === 'BOTTOM' || d.wall === 'TOP');
    const circWall: 'BOTTOM' | 'TOP' = circDoors.length ? circDoors[0].wall : 'BOTTOM';
    const origAttached = rooms.filter((t: any) => t.attachedTo === R.id || t.subZoneOf === R.id);
    const hadToilet = origAttached.some((t: any) => /TOILET/.test(String(t.name)));
    const doorsAll: any[] = (R.doors || []).slice();

    const parts: any[] = [];
    for (let k = 0; k < n; k++) {
      const px = edges[k], pw = Number((edges[k + 1] - edges[k]).toFixed(3));
      if (k === 0) {
        R.w = pw; R.areaPerRoom = Number((pw * R.h).toFixed(2)); R.furniture = furnitureAssumptions(R.name, pw, R.h);
        R.doors = []; parts.push(R);
      } else {
        const nm = /MASTER/.test(R.name) ? `BEDROOM ${++bedNo}` : `${R.name} ${k + 1}`;
        const part: any = makeRoom(nm, serial++, px, R.y, pw, R.h, {
          dimensionsFitted: true, privateZone: true, furnitureValidated: true, splitFrom: R.id, doors: [],
        });
        rooms.push(part); parts.push(part);
      }
    }

    // --- circulation doors: purane door ko sahi part ko do, jis part me door nahi bacha usme naya
    const lastRight: any[] = [];
    for (const d of doorsAll) {
      if (d.wall === 'LEFT') { parts[0].doors.push(d); continue; }
      if (d.wall === 'RIGHT') { lastRight.push(d); continue; }
      const cx = x0 + (d.offsetFeet || 0) + (d.widthFeet || 3) / 2;
      let kk = parts.findIndex((pt: any) => cx >= pt.x - 1e-6 && cx < pt.x + pt.w - 1e-6);
      if (kk < 0) kk = parts.length - 1;
      const pt = parts[kk];
      const off = Number(Math.max(0.3, Math.min((x0 + (d.offsetFeet || 0)) - pt.x, pt.w - (d.widthFeet || 3) - 0.3)).toFixed(2));
      pt.doors.push({ ...d, offsetFeet: off });
    }
    parts[parts.length - 1].doors.push(...lastRight);

    const passage: any = rooms.find((r: any) => r.name === 'PASSAGE');
    for (let k = 0; k < parts.length; k++) {
      const pt = parts[k];
      if (pt.doors.some((d: any) => d.wall === circWall)) continue;
      const dw = 3.0;
      let absX = pt.x + Math.max(0.6, Math.min(pt.w / 2 - dw / 2, pt.w - dw - 0.6));
      if (passage && pt.h) {
        const lo = passage.x + 0.3, hi = passage.x + passage.w - dw - 0.3;
        if (hi >= lo) absX = Math.max(lo, Math.min(absX, hi));
        absX = Math.max(pt.x + 0.4, Math.min(absX, pt.x + pt.w - dw - 0.4));
      }
      const did = `${R.id}_split_door_${k}`;
      const wallY = circWall === 'BOTTOM' ? pt.y + pt.h : pt.y;
      pt.doors.push({ id: did, wall: circWall, widthFeet: dw, offsetFeet: Number((absX - pt.x).toFixed(2)),
        doorType: 'INTERNAL', renderSymbol: true, swingInside: true, sharedOpeningId: did,
        hingeSide: absX + dw / 2 > pt.x + pt.w / 2 ? 'END' : 'START' });
      // counterpart (neighbor ke taraf) taaki wall me door ka gap dono taraf bane
      const nb: any = rooms.find((r: any) => r !== pt && !/TOILET|DUCT|DRESSING/.test(String(r.name)) && (!r.isSubRoom || r.name === 'PASSAGE') &&
        (circWall === 'BOTTOM' ? Math.abs((r.y || 0) - wallY) < 0.4 : Math.abs((r.y || 0) + (r.h || 0) - wallY) < 0.4) &&
        absX + dw / 2 >= (r.x || 0) && absX + dw / 2 <= (r.x || 0) + (r.w || 0));
      if (nb) {
        nb.doors = nb.doors || [];
        nb.doors.push({ id: did, wall: circWall === 'BOTTOM' ? 'TOP' : 'BOTTOM', widthFeet: dw, offsetFeet: Number((absX - (nb.x || 0)).toFixed(2)),
          doorType: 'OPENING', renderSymbol: false, swingDirection: 'NONE', sharedOpeningId: did });
      }
    }

    // --- attached toilets / dressing: x-center ke hisaab se part ko; jis part me toilet nahi, naya
    const owner = (t: any) => {
      const c = t.x + t.w / 2;
      const kk = parts.findIndex((pt: any) => c >= pt.x - 1e-6 && c < pt.x + pt.w - 1e-6);
      return parts[kk < 0 ? 0 : kk];
    };
    for (const t of origAttached as any[]) { const o = owner(t); t.attachedTo = o.id; t.subZoneOf = o.id; }
    if (hadToilet) {
      for (let k = 0; k < parts.length; k++) {
        const pt = parts[k];
        const has = rooms.some((t: any) => t.attachedTo === pt.id && /TOILET/.test(String(t.name)));
        if (has) continue;
        const tw = pt.w < 12 ? 5.5 : 6.5;
        const th = Number(Math.max(5, Math.min(8, pt.h - 4.5)).toFixed(2));
        if (pt.h - th < 4 || pt.w < 9) continue;
        const atRight = k === parts.length - 1 || k > 0 && k < parts.length - 1 ? true : false;
        const tx = atRight ? pt.x + pt.w - tw : pt.x;
        const atTop = circWall === 'BOTTOM';
        const ty = atTop ? pt.y : pt.y + pt.h - th;
        const tid = `att_door_split_${k}_${serial}`;
        const toilet: any = makeRoom('ATTACHED TOILET', serial++, tx, ty, tw, th, {
          dimensionsFitted: true, attachedTo: pt.id, subZoneOf: pt.id, isSubRoom: true, serviceCore: true,
          ventilationRequired: true, orientation: 'HORIZONTAL', placementRule: 'SPLIT_BEDROOM_CORNER',
          doors: [{ id: tid, wall: atRight ? 'LEFT' : 'RIGHT', widthFeet: 2.5, offsetFeet: atTop ? 0.5 : Number((th - 3.0).toFixed(2)), doorType: 'TOILET', renderSymbol: true, swingInside: true }],
          windows: [{ id: `att_vent_split_${k}`, wall: atTop ? 'TOP' : 'BOTTOM', lengthFeet: 2, offsetFeet: Number(Math.max(0.5, tw / 2 - 1).toFixed(2)) }],
        });
        rooms.push(toilet);
      }
    }
  }
  return rooms;
}

export function buildResidentialLayout(
  ...args: Parameters<typeof buildResidentialLayoutCore>
): FloorRoom[] {
  const out = buildResidentialLayoutCore(...args);
  try {
    return splitOversizedBedrooms(out, args[2], args[3], !!args[10]);
  } catch (e) {
    console.warn('[SPLIT BEDROOMS] skipped', e);
    return out;
  }
}

function buildResidentialLayoutCore(
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
    W <= 90 &&
    // ✅ FIX: 15x30 / 10x30 me 4\" walls ke baad clear length = 29.33 ft -> pehle (H >= 30) koi branch match nahi hota tha (blank plan)
    H >= 16 &&
    H <= 120
  ) {
    // ✅ SIZE-ADAPTIVE ROOM PROGRAM: jagah kam ho to pehle ground bedroom (+attached toilet) hatao,
    // taaki living deep ho jaye aur stair ke samne landing / access bache (architect ka standard reduce order)
    const shortPlot = H < 28;
    const narrowCompact = W < 16.5 && H < 36;
    const reduce = shortPlot || narrowCompact;
    const result = buildUniversalGroundFloor(
      W, H,
      hasParking, hasLiving, hasKitchen, hasKD, hasCommon && H >= 22, reduce ? false : hasAttached,
      reduce ? [] : bedrooms, stairSpec, parkingMode, stairEmbeddedInLiving,
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
      dimensionsFitted: true,
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
   if (!hasParking && (hasStair || stairEmbeddedInLiving) && bedrooms.length >= 1 && W >= 6 && H >= 15) {
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

    const wantedStairY = groundStairPosition && Number.isFinite((groundStairPosition as any).y)
      ? Number((groundStairPosition as any).y) : null;

    const frontBedKey = bedrooms.find(k => k === 'MASTER BEDROOM') || bedrooms.find(k => k === 'FRONT BEDROOM') || bedrooms[0];
    const rearBedKey = bedrooms.length > 1
      ? (bedrooms.find((k, i) => i > 0) || bedrooms[1] || bedrooms[0])
      : frontBedKey;

    // Bedroom depth + passage combos (jagah kam ho to pehle rear passage, phir bedroom depth ghatate hain)
    // ✅ Ground wali y EXACT aa sake isliye zyada combos (passage 4 -> 3.5 -> 3, bedroom depth 9 -> 8.5 -> 8): tino floors par stair ek hi jagah
    const baseCombos: Array<[number, number, number]> = [
      [4, 4, 9], [4, 4, 8.5], [4, 4, 8], [3.5, 3.5, 8.5], [3, 3, 8.5], [3, 3, 8],
      [4, 0, 9], [4, 0, 8], [3, 0, 8],
    ];

    // Zone solver: combos me se wo jisme ground wali stair y EXACT aaye; nahi to pehla feasible (clamp + warning)
    const solveZones = (comboList: Array<[number, number, number]>) => {
      let firstFeasible: [number, number, number] | null = null;
      let exactCombo: [number, number, number] | null = null;
      for (const [tp, bp, mb] of comboList) {
        const lo = mb + tp, hi = H - stairH - bp - mb;
        if (lo > hi) continue;
        if (!firstFeasible) firstFeasible = [tp, bp, mb];
        if (wantedStairY !== null && wantedStairY >= lo - 0.01 && wantedStairY <= hi + 0.01) { exactCombo = [tp, bp, mb]; break; }
        if (wantedStairY === null) break;
      }
      const chosenCombo = exactCombo || firstFeasible || comboList[comboList.length - 1];
      const [tp, bp, mb] = chosenCombo;
      const minY = mb + tp;
      const maxY = H - stairH - bp - mb;
      let sy = wantedStairY !== null ? wantedStairY : (H - stairH) / 2;
      sy = minY <= maxY ? Math.max(minY, Math.min(sy, maxY)) : (minY + maxY) / 2;
      const zY0 = Number((sy - tp).toFixed(3));
      const zH = Number((tp + stairH + bp).toFixed(3));
      const rY0 = Number((zY0 + zH).toFixed(3));
      return {
        topP: tp, botP: bp, minBedDepth: mb, minY, maxY, stairY: sy,
        zoneY0: zY0, zoneH: zH, rearY0: rY0, frontH: zY0, rearH: Number((H - rY0).toFixed(3)),
        exact: !!exactCombo, feasible: !!firstFeasible,
      };
    };

    // ------------------------------------------------------------
    // ✅ FLUSH FAR-FACE (narrow upper floor): stair ke bagal wali side corridor dono bedrooms ko jodti hai.
    //   - ARRIVAL face (jis taraf se stair upar aati hai = ground ka entryFace): chhota lobby (>= 3 ft) -> us taraf ke bedroom ka door lobby me
    //   - FAR face: bedroom ki wall stair ke end se SEEDHI judti hai (0 ft passage); us bedroom ka door side corridor ki taraf
    //     (stair ke x-span se bahar) shift ho jaata hai -> 4 ft ka dead lobby bedroom me chala jaata hai.
    //   Sirf tab jab: corridor >= 2.4 ft, stair straight-end type (L-shape nahi), ground y exact aa rahi ho,
    //   aur far bedroom me door + attached toilet + furniture sab fit ho (warna purana 4 ft passage layout).
    // ------------------------------------------------------------
    const FLUSH_MIN_CORRIDOR_FT = 2.4;
    let stairXPre: number | null = null;
    try {
      const p0 = resolveInheritedStairPosition({
        livingX: 0, livingY: 0, livingW: W, livingH: H,
        stairW, stairH, userInheritedX, userInheritedY,
        groundStairPosition,
        groundStairRelativeOffset: groundStairPosition ? undefined : groundStairRelativeOffset,
        fallbackPosition: inputStairPosition,
      });
      if (Number.isFinite(p0.x)) stairXPre = p0.x;
    } catch { stairXPre = null; }
    const leftStrip = stairXPre ?? 0;
    const rightStrip = stairXPre === null ? 0 : W - (stairXPre + stairW);
    const arrivalFace = (((groundStairPosition as any)?.entryFace as StairFace) || 'BOTTOM');
    const stairRotatedUp = arrivalFace === 'LEFT' || arrivalFace === 'RIGHT';
    // ✅ Rotated stair (run X me, entry LEFT/RIGHT): chadhne ka raasta SIDE corridor se hai (entry wali taraf ki strip).
    //    Stair ke upar/neeche ke edge par flights ki side hai, entry nahi -> wahan 4 ft passage ki zaroorat nahi.
    //    Isliye corridor = ENTRY wali side ki strip, aur dono bedrooms stair ke top/bottom edge tak flush ho sakte hain.
    const corridorSide: 'LEFT' | 'RIGHT' = stairRotatedUp
      ? (arrivalFace === 'LEFT' ? 'LEFT' : 'RIGHT')
      : (rightStrip >= leftStrip ? 'RIGHT' : 'LEFT');
    const corridorW = stairRotatedUp ? (corridorSide === 'LEFT' ? leftStrip : rightStrip) : Math.max(leftStrip, rightStrip);
    const flushCandidate =
      stairXPre !== null && !(bedrooms.length >= 4 && W >= 18) &&
      (stairRotatedUp || String(groundStairType) !== 'L_SHAPED') && corridorW >= FLUSH_MIN_CORRIDOR_FT;

    // far-face bedroom: arrival BOTTOM => far = TOP => FRONT bedroom (y=0 side) stair se flush
    const flushIsFront = arrivalFace !== 'TOP';
    const flushDoorW = Math.min(3.0, Math.max(2.5, corridorW + 0.2));
    const corridorBand: [number, number] = stairXPre === null ? [0, 0]
      : (corridorSide === 'RIGHT' ? [stairXPre + stairW, W] : [0, stairXPre]);
    // ✅ Wide floor: side strip chaudi ho to door STAIR ke paas (chhota walk), narrow me strip ke beech
    const bandW = corridorBand[1] - corridorBand[0];
    // Door side-corridor ke WALL wale corner par (standard clearance), hinge wall ki taraf -> leaf wall se chipak ke khulta hai.
    // Narrow corridor (<= door+1.5) me corridor ke beech.
    const flushDoorGxRaw = bandW > flushDoorW + 1.5
      ? (corridorSide === 'RIGHT' ? W - flushDoorW - DOOR_WALL_CLEARANCE_FT : DOOR_WALL_CLEARANCE_FT)
      : corridorBand[0] + (bandW - flushDoorW) / 2;
    const flushDoorGx = Math.max(0.2, Math.min(flushDoorGxRaw, W - flushDoorW - 0.2));

    // ------------------------------------------------------------
    // ✅ ACCESS RULE (architect check) — upper floor par stair ki PEHLI RISER (entry face) ke samne
    //    free LANDING (bedroom wall / room nahi) hona hi chahiye, warna user stair par chadh nahi sakta.
    //    Tier 1: >= 3.5 ft  ->  Tier 2: >= 3.0 ft  ->  Tier 3 (legacy, sirf last resort + accessWarning).
    //    - non-rotated stair: entry side (BOTTOM/TOP) ka passage = arrival lobby
    //    - rotated stair   : entry side ki strip (corridorW) hi landing hai
    //    BOTH-FLUSH (dono bedroom stair se chipke) sirf rotated stair me allowed, kyunki seedhi stair me
    //    ek end par bedroom chipka to pehli riser blocked ho jaati hai.
    // ------------------------------------------------------------
    type ZoneSol = ReturnType<typeof solveZones>;
    const entryDepthOf = (Zc: ZoneSol): number =>
      stairRotatedUp ? corridorW : (arrivalFace === 'TOP' ? Zc.topP : Zc.botP);

    const planZoning = (minEntry: number): { Z: ZoneSol; useFlush: boolean; bothFlush: boolean } | null => {
      const strict = minEntry > 0;
      const entryOk = (Zc: ZoneSol) => !strict || entryDepthOf(Zc) >= minEntry - 0.01;
      const accept = (Zc: ZoneSol) => strict ? (Zc.feasible && (wantedStairY === null || Zc.exact) && entryOk(Zc)) : true;
      let Zc: ZoneSol | null = null;
      let flushOn = false;
      let bothOn = false;

      // rotated stair: entry strip hi nahi to is tier me koi zoning kaam ki nahi
      if (strict && stairRotatedUp && corridorW < minEntry - 0.01) return null;

      // (1) BOTH-FLUSH
      const bothAllowed = flushCandidate && (strict
        ? (stairRotatedUp && corridorW >= minEntry - 0.01)
        : (stairRotatedUp || corridorW >= MIN_SIDE_WALK_FT));
      if (bothAllowed) {
        const Zb = solveZones(([9, 8.5, 8] as number[]).map(mb => [0, 0, mb] as [number, number, number]));
        let okB = Zb.feasible && (wantedStairY === null || Zb.exact) && Zb.frontH >= 8 && Zb.rearH >= 8;
        if (okB && hasAttached) {
          for (const [hh, isFront] of [[Zb.frontH, true], [Zb.rearH, false]] as Array<[number, boolean]>) {
            const chkB = planDoorSideToilet(
              0, 0, W, hh, isFront ? 'BOTTOM' : 'TOP', flushDoorW, 4.5, W >= 12 ? 7.5 : 6.5, 5.0, corridorSide === 'LEFT',
              { bedKey: isFront ? frontBedKey : rearBedKey, sides: ['LEFT', 'RIGHT'], blockedBand: [flushDoorGx, flushDoorGx + flushDoorW], preferFar: true },
            );
            if (!(chkB.toilet && chkB.furnitureOk)) { okB = false; break; }
          }
        }
        console.log('[UPPER BOTH-FLUSH]', { minEntry, okB, corridorW, corridorSide, frontH: Zb.frontH, rearH: Zb.rearH });
        if (okB && accept(Zb)) { Zc = Zb; flushOn = true; bothOn = true; }
      }

      // (2) SINGLE FLUSH: far face chipka, arrival (entry) face par lobby
      if (!Zc && flushCandidate) {
        const flushCombos: Array<[number, number, number]> = [];
        for (const arrP of [4, 3.5, STAIR_CLEAR_DEPTH_FT]) {
          if (strict && arrP < minEntry - 0.01) continue;
          for (const mb of [9, 8.5, 8]) {
            flushCombos.push((flushIsFront ? [0, arrP, mb] : [arrP, 0, mb]) as [number, number, number]);
          }
        }
        if (flushCombos.length) {
          const Zf = solveZones(flushCombos);
          let ok = Zf.feasible && (wantedStairY === null || Zf.exact);
          const fh = flushIsFront ? Zf.frontH : Zf.rearH;
          const fKey = flushIsFront ? frontBedKey : rearBedKey;
          if (ok && fh < 8) ok = false;
          if (ok && hasAttached) {
            const chk = planDoorSideToilet(
              0, 0, W, fh, flushIsFront ? 'BOTTOM' : 'TOP', flushDoorW, 4.5, W >= 12 ? 7.5 : 6.5, 5.0, false,
              { bedKey: fKey, sides: ['LEFT', 'RIGHT'], blockedBand: [flushDoorGx, flushDoorGx + flushDoorW], preferFar: true },
            );
            ok = !!chk.toilet && chk.furnitureOk;
          }
          console.log('[UPPER FLUSH]', { minEntry, ok, flushIsFront, corridorW, corridorSide, fh });
          if (ok && accept(Zf)) { Zc = Zf; flushOn = true; }
        }
      }

      // (3) NORMAL: dono taraf passage (strict tier me entry side filter)
      if (!Zc) {
        const combos = strict
          ? baseCombos.filter(([tp, bp]) => stairRotatedUp || (arrivalFace === 'TOP' ? tp : bp) >= minEntry - 0.01)
          : baseCombos;
        if (!combos.length) return null;
        const Zn = solveZones(combos);
        if (!accept(Zn)) return null;
        Zc = Zn;
      }
      return { Z: Zc, useFlush: flushOn, bothFlush: bothOn };
    };

    let accessTier: string = 'STRICT_3_5FT';
    let zoning = planZoning(STAIR_ENTRY_MIN_FT);
    if (!zoning) { accessTier = 'MIN_3FT'; zoning = planZoning(STAIR_CLEAR_DEPTH_FT); }
    if (!zoning) { accessTier = 'LEGACY_NO_GUARANTEE'; zoning = planZoning(0)!; }
    let { Z, useFlush, bothFlush } = zoning;

    // ------------------------------------------------------------
    // ✅ COMPACT UPPER FLOOR (size-adaptive): 2 bedrooms + stair + passages fit hi nahi hote (H < ~35 ft)
    // Tab: stair ground wali y par (alignment pakki), ek bedroom (+attached toilet) jahan >= 7.4 ft depth mile,
    // baaki bachi jagah ko technical naam: road side = BALCONY, rear side = STUDY / UTILITY / WASH AREA.
    // Entry side par 3.5 ft landing guaranteed.
    // ------------------------------------------------------------
    let compactUpper = false;
    const COMPACT_MIN_BED = 7.4;
    if (accessTier === 'LEGACY_NO_GUARANTEE' && !(bedrooms.length >= 4 && W >= 18)) {
      const syC = wantedStairY !== null ? wantedStairY : (H - stairH) / 2;
      const LAND = 3.5;
      const tpC = (!stairRotatedUp && arrivalFace === 'TOP') ? LAND : 0;
      const bpC = (!stairRotatedUp && arrivalFace !== 'TOP') ? LAND : 0;
      let zy0 = Math.max(0, syC - tpC);
      let zy1 = Math.min(H, syC + stairH + bpC);
      if (zy0 < 3.5) zy0 = 0;                 // patli sliver lounge me absorb
      if (H - zy1 < 3.5) zy1 = H;
      Z = {
        topP: tpC, botP: bpC, minBedDepth: COMPACT_MIN_BED, minY: zy0, maxY: zy0, stairY: syC,
        zoneY0: Number(zy0.toFixed(3)), zoneH: Number((zy1 - zy0).toFixed(3)), rearY0: Number(zy1.toFixed(3)),
        frontH: Number(zy0.toFixed(3)), rearH: Number((H - zy1).toFixed(3)), exact: true, feasible: true,
      } as ZoneSol;
      useFlush = false; bothFlush = false; compactUpper = true;
      accessTier = 'COMPACT_LANDING_3_5FT';
      console.log('[UPPER COMPACT] 1 bedroom + lounge layout', { W, H, stairY: syC, frontH: Z.frontH, rearH: Z.rearH });
    }
    const entryClearFt = Number(entryDepthOf(Z).toFixed(2));
    const stairAccessWarning = entryClearFt < STAIR_CLEAR_DEPTH_FT - 0.01;
    if (stairAccessWarning) {
      console.error('[UPPER STAIR ACCESS ❌] pehli riser ke samne landing nahi bachi — ground stair ki position/size badlo', { W, H, wantedStairY, stairH, arrivalFace, entryClearFt });
    } else {
      console.log('[UPPER STAIR ACCESS ✅]', { accessTier, entryClearFt, arrivalFace, rotated: stairRotatedUp, useFlush, bothFlush });
    }
    const { topP, botP, minBedDepth, stairY, zoneY0, zoneH, rearY0, frontH, rearH } = Z;
    if (wantedStairY !== null && !Z.exact) {
      console.warn('[UPPER STAIR] ground wali y exact nahi aa saki, clamp hui', { wantedStairY, minY: Z.minY, maxY: Z.maxY });
    }
    const alignmentRule = groundStairPosition ? 'STAIR_ALIGNED_TO_GROUND' : 'STAIR_CENTERED';
    const flushSpec = (isFrontBed: boolean) =>
      (useFlush && (bothFlush || isFrontBed === flushIsFront)) ? { band: [flushDoorGx, flushDoorGx + flushDoorW] as [number, number], doorW: flushDoorW } : undefined;

    // ✅ Wide upper floor (4 bedrooms): front row = 2 bedrooms, rear row = 2 bedrooms (har ek ke saath attached toilet)
    const fourBeds = bedrooms.length >= 4 && W >= 18;
    const narrowUpper = W < ATTACHED_VERTICAL_MIN_W_FT;
    const BED_DOOR_W = 3.0;

    // ✅ Stair ka x-span pehle se nikaalo -> bedroom door position stair ke hisaab se DYNAMIC (hardcode center nahi)
    let stairSpanGlobal: [number, number] | null = null;
    try {
      const pre = resolveInheritedStairPosition({
        livingX: 0, livingY: zoneY0, livingW: W, livingH: zoneH,
        stairW, stairH, userInheritedX, userInheritedY,
        groundStairPosition,
        groundStairRelativeOffset: groundStairPosition ? undefined : groundStairRelativeOffset,
        fallbackPosition: inputStairPosition,
      });
      if (Number.isFinite(pre.x)) stairSpanGlobal = [pre.x, pre.x + stairW];
    } catch { stairSpanGlobal = null; }

    // Ek bedroom (+ uska attached toilet) banane ka helper.
    // ✅ Bedroom HAMESHA exact zone size me (dimensionsFitted) -> beech me gap/extra wall nahi
    // ✅ Door passage wali wall par (front: BOTTOM, rear: TOP); x-position pickDoorOffset() se dynamic:
    //    attached toilet aur stair ke span se bachkar, stair landing ke sabse paas
    // ✅ Toilet door wali wall par horizontal (narrow) ya side strip (wide); width bedroom >= 12 ft par 7.5 ft tak
    const buildUpperBedroom = (
      key: string, y: number, h: number, doorWall: 'TOP' | 'BOTTOM',
      zoneName: string, ruleName: string,
      x0 = 0, bw = W, mirror = false,
      flush?: { band: [number, number]; doorW: number },
    ) => {
      if (h < 4) return;
      // flush bedroom: toilet door se OPPOSITE side (door corridor wale wall-corner par hai)
      if (flush && corridorSide === 'LEFT') mirror = true;
      const DOOR_W_USE = flush ? flush.doorW : BED_DOOR_W;
      // hinge hamesha sabse paas ki side-wall ki taraf -> khula leaf wall se chipak jaata hai (room ke beech me nahi)
      const hingeFor = (offset: number, dw: number): 'START' | 'END' => (offset + dw / 2 > bw / 2 ? 'END' : 'START');
      const doorId = `bed_door_${zoneName.toLowerCase()}`;
      const stairRel: [number, number] | null = stairSpanGlobal ? [stairSpanGlobal[0] - x0, stairSpanGlobal[1] - x0] : null;
      // Side-strip toilet tabhi jab bedroom itna lamba na ho ki toilet elongated (> 2.4:1) ban jaye; warna horizontal door-side toilet
      const stripWUp = Math.min(5.0, bw * 0.4);
      let colNarrow = fourBeds ? true : (bw < ATTACHED_VERTICAL_MIN_W_FT || (h / Math.max(1, stripWUp)) > 2.4);
      // ✅ DYNAMIC CHECK: horizontal toilet ke baad bedroom me furniture aata hai? Nahi to side strip / far-wall corner try
      let plan: DoorSideToiletPlan | null = null;
      if (hasAttached) {
        plan = planDoorSideToilet(
          x0, y, bw, h, doorWall, DOOR_W_USE, 4.5, bw >= 12 ? 7.5 : 6.5, 5.0, mirror,
          { bedKey: key, sides: (fourBeds ? [mirror ? 'RIGHT' : 'LEFT'] : ['LEFT', 'RIGHT']) as Array<'LEFT' | 'RIGHT'>, blockedBand: flush ? flush.band : undefined, preferFar: true },
        );
        const stripFits = !fourBeds && bedFits(bw - stripWUp, h, key);
        if (colNarrow && !(plan.toilet && plan.furnitureOk) && stripFits) colNarrow = false;
        else if (!colNarrow && !stripFits && plan.toilet && plan.furnitureOk) colNarrow = true;
      }
      if (flush) colNarrow = true; // flush bedroom: toilet horizontal, door side corridor me
      if (colNarrow) {
        const avoid: Array<[number, number]> = plan?.toilet?.onDoorWall ? [[plan.toilet.x - x0, plan.toilet.x - x0 + plan.toilet.w]] : [];
        const doorOffset = flush
          ? Number(Math.max(0.2, Math.min(flush.band[0] - x0, bw - DOOR_W_USE - 0.2)).toFixed(2))
          : pickDoorOffset(bw, BED_DOOR_W, avoid, stairRel);
        addRoom(key, x0, y, bw, h, {
          dimensionsFitted: true,
          privateZone: true, furnitureValidated: true,
          placementZone: zoneName,
          requestedArea: roomArea(key, 140),
          doors: [{
            id: doorId, wall: doorWall, widthFeet: DOOR_W_USE, offsetFeet: doorOffset,
            doorType: 'INTERNAL', renderSymbol: true, swingInside: true,
            hingeSide: hingeFor(doorOffset, DOOR_W_USE),
            dynamicPosition: true,
            ...(flush ? { placementRule: 'FLUSH_STAIR_SIDE_CORRIDOR' } : {}),
          }],
        });
        const bed = rooms[rooms.length - 1];
        if (hasAttached && plan?.toilet && bed) {
          const t = plan.toilet;
          if (!plan.furnitureOk) console.warn(`[UPPER] ${key}: bathroom ke baad bedroom me furniture rectangle nahi bacha`, plan.freeRect);
          addRoom('ATTACHED TOILET', t.x, t.y, t.w, t.h, {
            dimensionsFitted: true,
            attachedTo: bed.id, subZoneOf: bed.id,
            isSubRoom: true, serviceCore: true, ventilationRequired: true,
            orientation: 'HORIZONTAL', placementRule: ruleName,
            bedroomFurnitureFit: plan.furnitureOk,
            doors: [t.door], windows: [t.window],
          });
        } else if (hasAttached) {
          console.warn(`[UPPER] ${key}: attached toilet ke liye door wali wall par jagah nahi (h=${h}).`);
        }
      } else {
        // W >= 15: side strip toilet, bedroom ka door passage wali wall par
        const attachedW = hasAttached ? Math.min(5.0, bw * 0.4) : 0;
        const bedW = bw - attachedW;
        const doorOffset = pickDoorOffset(bedW, BED_DOOR_W, [], stairRel);
        addRoom(key, x0, y, bedW, h, {
          dimensionsFitted: true,
          privateZone: true, furnitureValidated: true,
          placementZone: zoneName,
          requestedArea: roomArea(key, 140),
          doors: [{
            id: doorId, wall: doorWall, widthFeet: BED_DOOR_W,
            offsetFeet: doorOffset,
            doorType: 'INTERNAL', renderSymbol: true, swingInside: true,
            hingeSide: hingeFor(doorOffset, BED_DOOR_W),
            dynamicPosition: true,
          }],
        });
        const bed = rooms[rooms.length - 1];
        if (hasAttached && bed) {
          addRoom('ATTACHED TOILET', x0 + bedW, y, attachedW, h, {
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

    // ---- compact upper: kaun si zone bedroom, kaun si leftover (technical naam)
    const bothBedsC = compactUpper && bedrooms.length >= 2 && frontH >= COMPACT_MIN_BED && rearH >= COMPACT_MIN_BED;
    const frontIsBedC = compactUpper && frontH >= COMPACT_MIN_BED && (bothBedsC || rearH < COMPACT_MIN_BED || frontH >= rearH);
    const rearIsBedC = compactUpper && rearH >= COMPACT_MIN_BED && (bothBedsC || !frontIsBedC);
    const stairX0C = stairXPre ?? 0;
    // door ko stair ke bagal wali free strip me rakho (stair se flush zone ke liye)
    const stripDoor = (dw: number): { gx: number } => {
      const L = stairX0C, R = W - (stairX0C + stairW);
      const useRight = R >= L;
      const s0 = useRight ? stairX0C + stairW : 0, s1 = useRight ? W : stairX0C;
      const gx = s1 - s0 >= dw + 0.3 ? s0 + (s1 - s0 - dw) / 2 : (useRight ? s0 : Math.max(0, s1 - dw));
      return { gx: Math.max(0.2, Math.min(gx, W - dw - 0.2)) };
    };
    const flushBandC = (flushToStair: boolean) => {
      if (!flushToStair) return undefined;
      const dw = 2.8; const { gx } = stripDoor(dw);
      return { band: [gx, gx + dw] as [number, number], doorW: dw };
    };
    const addLeftoverC = (name: string, y: number, h: number, doorWall: 'TOP' | 'BOTTOM', flushToStair: boolean) => {
      if (h < 3.4) return;
      const dw = 3.0; const gx = flushToStair ? stripDoor(dw).gx : Math.max(0.5, (W - dw) / 2);
      addRoom(name, 0, y, W, h, {
        dimensionsFitted: true, upperLeftover: true,
        leftoverReason: 'COMPACT_PLOT_REMAINING_AREA',
        doors: [{ id: `leftover_door_${name.toLowerCase().replace(/[^a-z]+/g, '_')}`, wall: doorWall, widthFeet: dw, offsetFeet: Number(gx.toFixed(2)), doorType: 'INTERNAL', renderSymbol: true, swingInside: true }],
      });
    };
    // top zone (y=0 side) flush = entry BOTTOM (stair ka far end wall se laga); bottom zone flush = entry TOP / rotated
    const topFlushC = Z.topP < 0.1, botFlushC = Z.botP < 0.1;

    // 1) FRONT BEDROOM (door wall = neeche, passage ki taraf)
    if (fourBeds) {
      const half = Number((W / 2).toFixed(3));
      buildUpperBedroom(bedrooms[0], 0, frontH, 'BOTTOM', 'FRONT_BUNGALOW_L', 'BUNGALOW_FRONT_ATTACHED', 0, half, false);
      buildUpperBedroom(bedrooms[1], 0, frontH, 'BOTTOM', 'FRONT_BUNGALOW_R', 'BUNGALOW_FRONT_ATTACHED', half, Number((W - half).toFixed(3)), true);
    } else if (!compactUpper) {
      buildUpperBedroom(frontBedKey, 0, frontH, 'BOTTOM', 'FRONT_BUNGALOW', 'BUNGALOW_FRONT_ATTACHED', 0, W, false, flushSpec(true));
    } else if (frontIsBedC) {
      buildUpperBedroom(frontBedKey, 0, frontH, 'BOTTOM', 'FRONT_BUNGALOW', 'BUNGALOW_FRONT_ATTACHED', 0, W, false, flushBandC(topFlushC));
    } else {
      addLeftoverC(frontH >= 6 ? 'STUDY' : 'UTILITY / WASH AREA', 0, frontH, 'BOTTOM', topFlushC);
    }

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
      (meta as any).flushFarFace = useFlush;
      (meta as any).entryClearanceFt = entryClearFt;
      (meta as any).accessTier = accessTier;
      (meta as any).accessWarning = stairAccessWarning;
      (livingRoom as any).embeddedStair = meta;
    }

    // 3) REAR BEDROOM (door wall = upar, passage ki taraf) — exact zone ke baad, H tak
    if (fourBeds) {
      const half = Number((W / 2).toFixed(3));
      buildUpperBedroom(bedrooms[2], rearY0, rearH, 'TOP', 'REAR_BUNGALOW_L', 'BUNGALOW_REAR_ATTACHED', 0, half, false);
      buildUpperBedroom(bedrooms[3], rearY0, rearH, 'TOP', 'REAR_BUNGALOW_R', 'BUNGALOW_REAR_ATTACHED', half, Number((W - half).toFixed(3)), true);
    } else if (!compactUpper) {
      buildUpperBedroom(rearBedKey, rearY0, rearH, 'TOP', 'REAR_BUNGALOW', 'BUNGALOW_REAR_ATTACHED', 0, W, false, flushSpec(false));
    } else if (rearIsBedC) {
      buildUpperBedroom(rearBedKey, rearY0, rearH, 'TOP', 'REAR_BUNGALOW', 'BUNGALOW_REAR_ATTACHED', 0, W, false, flushBandC(botFlushC));
    } else {
      addLeftoverC('BALCONY', rearY0, rearH, 'TOP', botFlushC);
    }

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
  // Upper floor par "LIVING ROOM" asal me stair lobby (stair + landing) hai, furniture room nahi
  if ((room as any).embeddedStair && (room as any).upperFloorLiving) return { ok: true, note: 'Upper-floor stair lobby; furniture rule not applicable.' };
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
const stairPosKey = (W: number, H: number) => `${W.toFixed(2)}|${H.toFixed(2)}`;

/** Exact (W + floor height) na mile to sabse nearest width (<= 1 ft) ki ground stair — upar ki floors/tower ka floor height alag ho sakta hai */
function findCachedGroundStair(W: number, floorH: number): GroundStairRecord | null {
  const exact = groundStairCache.get(stairCacheKey(W, floorH));
  if (exact) return exact;
  let best: GroundStairRecord | null = null, bestD = Infinity;
  for (const [k, v] of groundStairCache) {
    const d = Math.abs(parseFloat(k.split('|')[0]) - W);
    if (d <= 1.0 && d < bestD) { best = v; bestD = d; }
  }
  return best;
}
function findCachedGroundStairPos(W: number, H: number): GroundStairPosRecord | undefined {
  const exact = groundStairPosCache.get(stairPosKey(W, H));
  if (exact) return exact;
  // ✅ FIX: pehle key sirf W thi -> 12x40 aur 12x45 ek hi stair position share karte the. Ab W aur H dono (<= 1 ft) match chahiye.
  let best: GroundStairPosRecord | undefined, bestD = Infinity;
  for (const [k, v] of groundStairPosCache) {
    const [kw, kh] = k.split('|').map(parseFloat);
    const dw = Math.abs(kw - W), dh = Math.abs(kh - H);
    if (dw <= 1.0 && dh <= 1.0 && dw + dh < bestD) { best = v; bestD = dw + dh; }
  }
  return best;
}
/** Tower / external callers: ground ki final stair spec (W ke nearest) */
export function getInheritedGroundStairSpec(W: number, floorH: number): StaircaseFootprint | null {
  return findCachedGroundStair(W, floorH)?.spec ?? null;
}

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
function generateArchitecturalFloorPlanCore(request: ArchitecturalPlanRequest): ArchitecturalPlanResult {
  console.info('%c[ROOMPLANNER] stairfix-v3 loaded', 'color:#0a0;font-weight:bold', request.floorName, request.width, 'x', request.length);
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
    const cached = findCachedGroundStair(W, floorHeightFt);
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
  const cachedStairPos = ground ? undefined : findCachedGroundStairPos(W, H);
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
        groundStairPosCache.set(stairPosKey(W, H), {
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

  {
    const lr: any = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
    const es = lr?.embeddedStair;
    console.info('[ROOMPLANNER] SUMMARY', floorName, {
      living: lr && { y: lr.y, h: lr.h },
      stair: es && { type: es.staircaseType, x: es.relX, y: es.relY, w: es.w, h: es.h, entry: es.entryFace, rotated: es.rotated, usable: es.usable, tier: es.fit?.passageTier, reason: es.usabilityReason, short: es.staircaseSpec?.drawPlan?.shortTreads },
      rooms: rooms.map(r => `${r.name} ${Number(r.w).toFixed(2)}x${Number(r.h).toFixed(2)}@${Number(r.x).toFixed(2)},${Number(r.y).toFixed(2)}`),
    });
  }

  return {
    rooms,
    warnings: Array.from(new Set(warnings)),
    errors: Array.from(new Set(errors)),
    score, furnitureChecks, stairType, staircase, orientation,
  };
}

// ============================================================
// 24b. UPPER-FLOOR AWARE STAIR SELECTOR  (public entry)
//
//   Problem: ground par stair ka pehla "usable" option le liya jaata tha. Upar ki floor par wahi
//   stair (same x,y,size) aati hai, to kabhi pehli riser ke samne bedroom ki wall aa jaati ya
//   bedroom chhota karna padta tha.
//
//   Ab: GROUND ke liye stair variants (auto / portrait / ROTATED  x  U / C-landing / C-winder / L)
//   ek-ek karke ground + FIRST FLOOR dono par generate hote hain, aur sabse achha variant chuna jaata hai:
//     1) upper par pehli riser ke samne free landing (walkable, kisi bedroom me nahi)
//     2) bedroom chhote na ho (min depth), ground par bhi koi room na ghate
//   Winner ko LAST me dobara chalate hain, taaki ground stair cache (upar ki floors / tower) winner ka hi ho.
// ============================================================
const UPPER_LANDING_FT = 3.5;
const stairVariantMemo = new Map<string, StairOverride>();

function isBedroomName(nm: any) { return /BEDROOM/.test(String(nm || '').toUpperCase()); }

function evaluateStairVariant(ground: ArchitecturalPlanResult, upper: ArchitecturalPlanResult, W: number, H: number) {
  const gl: any = ground.rooms.find(r => canonical(r.name) === 'LIVING ROOM');
  const ges = gl?.embeddedStair;
  const ul: any = upper.rooms.find(r => canonical(r.name) === 'LIVING ROOM');
  const ues = ul?.embeddedStair;
  const out = { score: -1e9, groundUsable: false, landingFt: 0, minBedDepth: 0, notes: [] as string[] };
  if (!ges || ges.usable === false) { out.notes.push('ground stair unusable / missing'); return out; }
  out.groundUsable = true;
  if (!ues || !ul) { out.notes.push('upper stair missing'); out.score = -5000; return out; }

  const st = { x: Number(ues.absX ?? ((ul.x || 0) + (ues.relX || 0))), y: Number(ues.absY ?? ((ul.y || 0) + (ues.relY || 0))), w: Number(ues.w), h: Number(ues.h) };
  const face: string = ues.entryFace || 'BOTTOM';
  const others = upper.rooms.filter(r => r !== ul && !(r as any).isSubRoom && !(r as any).subZoneOf && canonical(r.name) !== 'STAIRCASE');
  // landing ka free depth: 0.25 ft steps me badhao jab tak koi room/plan ki boundary na aaye
  const band = (d: number) => face === 'BOTTOM' ? { x: st.x, y: st.y + st.h, w: st.w, h: d }
    : face === 'TOP' ? { x: st.x, y: st.y - d, w: st.w, h: d }
    : face === 'LEFT' ? { x: st.x - d, y: st.y, w: d, h: st.h }
    : { x: st.x + st.w, y: st.y, w: d, h: st.h };
  const hit = (a: any, b: any) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.05 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.05;
  const inside = (b: any) => b.x >= -0.01 && b.y >= -0.01 && b.x + b.w <= W + 0.01 && b.y + b.h <= H + 0.01;
  let free = 0;
  for (let d = 0.25; d <= 4.001; d += 0.25) {
    const b = band(d);
    if (!inside(b) || others.some(o => hit(b, o))) break;
    free = d;
  }
  out.landingFt = Number(free.toFixed(2));

  const beds = upper.rooms.filter(r => isBedroomName(r.name) && !(r as any).isSubRoom);
  const depths = beds.map(r => Math.min(Number(r.w) || 0, Number(r.h) || 0));
  out.minBedDepth = depths.length ? Math.min(...depths) : 12;
  const bedArea = beds.reduce((a, r) => a + (Number(r.w) || 0) * (Number(r.h) || 0), 0);

  // ground par koi room ghata? (parking / kitchen / living ka chhota side)
  const gKey = ground.rooms.filter(r => /PARKING|KITCHEN|LIVING/.test(String(r.name).toUpperCase()) && !(r as any).isSubRoom);
  const gMin = gKey.length ? Math.min(...gKey.map(r => Math.min(Number(r.w) || 0, Number(r.h) || 0))) : 8;

  const landingScore = free >= UPPER_LANDING_FT - 0.01 ? 600 : free >= 3 - 0.01 ? 250 : -2500 + free * 100;
  out.score = landingScore
    + Math.min(free, 4) * 40
    + Math.min(out.minBedDepth, 12) * 30
    + Math.min(bedArea, 400) / 8
    + Math.min(gMin, 10) * 12
    - ground.warnings.filter(w => /UNUSABLE|OVERLAP|exceeds/i.test(w)).length * 400
    - upper.warnings.filter(w => /UNUSABLE|OVERLAP|exceeds/i.test(w)).length * 400
    - ground.errors.length * 300 - upper.errors.length * 300;
  out.notes.push(`landing ${out.landingFt} ft, min bedroom depth ${out.minBedDepth.toFixed(1)} ft, ground min ${gMin.toFixed(1)} ft`);
  return out;
}

export function generateArchitecturalFloorPlan(request: ArchitecturalPlanRequest): ArchitecturalPlanResult {
  const floorName = clean(request.floorName);
  const isGround = floorName.includes('GROUND');
  // Sirf GROUND par selector chalta hai; upper / tower ground wali stair inherit karte hain.
  if (!isGround || STAIR_OVERRIDE) return generateArchitecturalFloorPlanCore(request);

  const W = Math.max(1, n(request.width, 20)), H = Math.max(1, n(request.length, 40));
  const memoKey = JSON.stringify([W, H, request.bhk, request.selectedRooms, request.planningMode, request.hasParking,
    request.parkingMode, request.floorToFloorHeightFeet, request.planningArea, request.groundFloorProgram]);

  const runWith = (ov: StairOverride) => {
    STAIR_OVERRIDE = ov;
    try { return generateArchitecturalFloorPlanCore(request); } finally { STAIR_OVERRIDE = null; }
  };

  let chosen = stairVariantMemo.get(memoKey);
  if (chosen === undefined) {
    const types: StaircaseType[] = ['DOG_LEGGED', '2_QUARTER_LANDING', 'L_SHAPED', '2_QUARTER_WINDER'];
    const variants: Array<{ label: string; ov: StairOverride }> = [{ label: 'AUTO', ov: null }];
    for (const rotated of [true, false]) for (const type of types) {
      variants.push({ label: `${rotated ? 'ROTATED' : 'PORTRAIT'}_${type}`, ov: { rotated, type } });
    }
    const quiet = typeof console !== 'undefined';
    const saved = quiet ? { log: console.log, warn: console.warn, info: console.info, error: console.error, gc: (console as any).groupCollapsed, ge: (console as any).groupEnd } : null;
    let bestScore = -Infinity; let bestOv: StairOverride = null; const table: any[] = [];
    try {
      if (saved) { console.log = () => {}; console.warn = () => {}; console.info = () => {}; console.error = () => {}; (console as any).groupCollapsed = () => {}; (console as any).groupEnd = () => {}; }
      for (const v of variants) {
        try {
          const g = runWith(v.ov);
          const pos = extractStairPositionFromResult(g);
          if (!pos) { table.push({ v: v.label, score: 'no stair' }); continue; }
          const u = generateArchitecturalFloorPlanCore({
            ...request, floorName: 'FIRST FLOOR', hasParking: false,
            groundStairPosition: { x: pos.x, y: pos.y, w: pos.w, h: pos.h, corner: pos.corner, entryFace: pos.entryFace, exitFace: pos.exitFace, flightDirection: pos.flightDirection, staircaseType: pos.staircaseType, spec: pos.spec } as any,
            groundStairSpec: pos.spec, groundStairRelativeOffset: pos.relativeOffset || undefined,
          });
          const ev = evaluateStairVariant(g, u, W, H);
          const score = ev.score + (v.ov === null ? 20 : 0);   // tie => purana (auto) behaviour
          table.push({ v: v.label, score: Math.round(score), notes: ev.notes.join('; ') });
          if (score > bestScore) { bestScore = score; bestOv = v.ov; }
        } catch (e) { table.push({ v: v.label, score: 'error', err: String(e) }); }
      }
    } finally {
      if (saved) { console.log = saved.log; console.warn = saved.warn; console.info = saved.info; console.error = saved.error; (console as any).groupCollapsed = saved.gc; (console as any).groupEnd = saved.ge; }
    }
    chosen = bestOv;
    stairVariantMemo.set(memoKey, chosen);
    console.log('[STAIR VARIANT SELECTOR]', { W, H, chosen: chosen ? `${chosen.rotated ? 'ROTATED' : 'PORTRAIT'}_${chosen.type}` : 'AUTO', table });
  }
  // Winner LAST chalao: ground result + stair cache (upper / tower) isi ke hain
  return runWith(chosen ?? null);
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