/* =========================================================
   CONSTRUCTION PLAN SYSTEM — SINGLE RESIDENTIAL ROOM PLANNER
   ---------------------------------------------------------
   This module owns room-program interpretation and spatial placement.
   It deliberately does NOT use plot-size presets. Every placement is
   calculated from the current floor footprint + the current floor room
   requirements.
========================================================= */

import { FloorRoom, PlanningMode } from './planningTypes';
import { BHK_PRESETS, getRoomDefinition } from './roomRules';
import { calculateStaircase, StaircaseType } from './stairPlanner';
import { getRoadOrientation } from './roadOrientation';
import { selectParkingCandidate } from './parkingPlanner';

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
};

export const PRACTICAL_ROOM_RULES: Record<string, PracticalRoomRule> = {
  'MASTER BEDROOM': { minWidth: 11, minDepth: 12, preferredWidth: 12, preferredDepth: 14, furniture: 'double bed + wardrobe + clear bedside access' },
  'BEDROOM': { minWidth: 10, minDepth: 10, preferredWidth: 11, preferredDepth: 12, furniture: 'bed + wardrobe + clear walking path' },
  'LIVING ROOM': { minWidth: 10, minDepth: 12, preferredWidth: 12, preferredDepth: 14, furniture: 'sofa set + TV wall + circulation' },
  'HALL': { minWidth: 9, minDepth: 11, preferredWidth: 11, preferredDepth: 13, furniture: 'seating + entry circulation' },
  'KITCHEN': { minWidth: 7, minDepth: 8, preferredWidth: 8, preferredDepth: 10, furniture: 'counter run + fridge + working aisle' },
  'KITCHEN CUM DINING': { minWidth: 9, minDepth: 10, preferredWidth: 11, preferredDepth: 12, furniture: 'kitchen counter + dining table + working aisle' },
  'DINING': { minWidth: 7, minDepth: 8, preferredWidth: 8, preferredDepth: 10, furniture: '4–6 seat dining table + circulation' },
  'POOJA ROOM': { minWidth: 4, minDepth: 5, preferredWidth: 5, preferredDepth: 6, furniture: 'altar + standing space' },
  'STUDY ROOM': { minWidth: 6, minDepth: 7, preferredWidth: 7, preferredDepth: 8, furniture: 'desk + chair + storage' },
  'COMMON TOILET': { minWidth: 4.5, minDepth: 7, preferredWidth: 5, preferredDepth: 7, furniture: 'WC + basin + required clear space' },
  'ATTACHED TOILET': { minWidth: 5, minDepth: 7, preferredWidth: 5, preferredDepth: 7, furniture: 'WC + basin + bathing clear space' },
  'BATHROOM': { minWidth: 5, minDepth: 7, preferredWidth: 5, preferredDepth: 7, furniture: 'WC + basin + bathing clear space' },
  'STAIRCASE': { minWidth: 5.5, minDepth: 8.5, preferredWidth: 6.0, preferredDepth: 10, furniture: 'two-flight stair + landing/headroom zone' },
  'PARKING': { minWidth: 9, minDepth: 15, preferredWidth: 10, preferredDepth: 18, furniture: 'car bay + door/vehicle clearance' },
  'DUCT': { minWidth: 1.5, minDepth: 4, preferredWidth: 2, preferredDepth: 6, furniture: 'ventilation/service shaft' },
  'PASSAGE': { minWidth: 3, minDepth: 6, preferredWidth: 3.25, preferredDepth: 12, furniture: 'clear circulation path' },
  'BALCONY': { minWidth: 4, minDepth: 5, preferredWidth: 5, preferredDepth: 8, furniture: 'open circulation / sit-out' },
};

function n(v: any, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function clean(s: any) { return String(s || '').trim().toUpperCase(); }

function canonical(raw: any): string {
  const s = clean(raw);
  if (s.includes('KITCHEN') && (s.includes('DINING') || s.includes('CUM'))) return 'KITCHEN CUM DINING';
  if (s.includes('MASTER')) return 'MASTER BEDROOM';
  if (s.includes('BEDROOM') || s === 'BED') return 'BEDROOM';
  if (s.includes('LIVING') || s.includes('DRAWING') || s === 'HALL') return 'LIVING ROOM';
  if (s.includes('ATTACHED') && (s.includes('TOILET') || s.includes('BATH'))) return 'ATTACHED TOILET';
  if (s.includes('COMMON') && (s.includes('TOILET') || s.includes('BATH'))) return 'COMMON TOILET';
  if (s.includes('TOILET') || s.includes('BATH') || s === 'WC') return 'COMMON TOILET';
  if (s.includes('KITCHEN')) return 'KITCHEN';
  if (s.includes('DINING')) return 'DINING';
  if (s.includes('POOJA')) return 'POOJA ROOM';
  if (s.includes('STUDY')) return 'STUDY ROOM';
  if (s.includes('STAIR')) return 'STAIRCASE';
  if (s.includes('PARK') || s.includes('PORCH')) return 'PARKING';
  if (s.includes('DUCT') || s.includes('OTS') || s.includes('SHAFT')) return 'DUCT';
  if (s.includes('PASSAGE') || s.includes('CORRIDOR')) return 'PASSAGE';
  if (s.includes('BALCONY')) return 'BALCONY';
  if (s.includes('UTILITY')) return 'UTILITY';
  if (s.includes('STORE')) return 'STORE';
  if (s.includes('GARDEN') || s.includes('BIKE')) return 'GARDEN / BIKE ENTRY';
  return s || 'ROOM';
}

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

function roomCounts(program: string[]) {
  const counts: Record<string, number> = {};
  for (const key of program) counts[key] = (counts[key] || 0) + 1;
  return counts;
}

function overlap(a: FloorRoom, b: FloorRoom) {
  return Math.min((a.x! + a.w!), (b.x! + b.w!)) > Math.max(a.x!, b.x!) + 0.02 &&
    Math.min((a.y! + a.h!), (b.y! + b.h!)) > Math.max(a.y!, b.y!) + 0.02;
}

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
    const existing = out.find(x => x.key === key && x.areaMode === areaMode && x.areaPerRoom === areaPerRoom);
    if (existing) existing.count += count;
    else out.push({ key, count, areaMode, areaPerRoom });
  };

  if (Array.isArray(selectedRooms)) {
    for (const value of selectedRooms) {
      if (typeof value === 'string') push(value, {});
      else if (value && typeof value === 'object') push(value.key || value.name || value.label || value.roomType, value);
    }
  } else if (selectedRooms && typeof selectedRooms === 'object') {
    for (const [key, value] of Object.entries(selectedRooms)) push(key, value);
  }
  return out;
}

function programFromInput(selectedRooms: any, bhk: string, floorArea: number, ground: boolean, mode: string, layoutW = 0, layoutH = 0): string[] {
  const explicit = extractSpecs(selectedRooms);
  const result: string[] = [];
  const add = (key: string, count = 1) => { for (let i = 0; i < count; i++) result.push(canonical(key)); };

  for (const spec of explicit) add(spec.key, spec.count);
  const hasExplicit = explicit.length > 0;
  const area = Math.max(1, floorArea);
  const auto = clean(mode) === 'AUTO';

  if (!hasExplicit && auto) {
    if (ground) {
      // Ground AUTO: propose a second bedroom only when BOTH area and usable
      // frontage support it. This prevents the recurring 20x50 / sub-22-ft mismatch.
      if (area <= 1200 || layoutW < 22) {
        add('MASTER BEDROOM'); add('ATTACHED TOILET'); add('COMMON TOILET'); add('KITCHEN CUM DINING'); add('LIVING ROOM'); add('PARKING'); add('STAIRCASE');
      } else if (area <= 1500) {
        add('MASTER BEDROOM'); add('BEDROOM'); add('ATTACHED TOILET'); add('COMMON TOILET'); add('KITCHEN CUM DINING'); add('LIVING ROOM'); add('PARKING'); add('STAIRCASE');
      } else {
        add('MASTER BEDROOM'); add('BEDROOM'); add('ATTACHED TOILET'); add('COMMON TOILET'); add('KITCHEN'); add('DINING'); add('LIVING ROOM'); add('PARKING'); add('STAIRCASE'); add('POOJA ROOM'); add('UTILITY');
        if (area >= 1800 && layoutW >= 28 && layoutH >= 40) add('BEDROOM');
        if (area >= 2200 && layoutW >= 32 && layoutH >= 45) add('STUDY ROOM');
        if (area >= 2400 && layoutW >= 34 && layoutH >= 48) add('STORE');
      }
    } else {
      let presetKey = clean(bhk) || 'AUTO';
      if (presetKey === 'AUTO') {
        presetKey = area >= 1800 && layoutW >= 32 ? '3 BHK' : area >= 1100 && layoutW >= 20 ? '2 BHK' : '1 BHK';
      }
      const preset = (BHK_PRESETS as any)[presetKey] || (BHK_PRESETS as any)['1 BHK'];
      for (const [key, count] of preset) add(String(key), n(count, 1));
      add('STAIRCASE');
      if (area >= 1100) add('COMMON TOILET');
    }
  }

  // Explicit AUTO selection still receives the essential functional rooms, but the
  // user's selected room identities/counts are never silently discarded.
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

  if (!result.length && !hasExplicit) {
    const preset = (BHK_PRESETS as any)[clean(bhk) || '1 BHK'] || (BHK_PRESETS as any)['1 BHK'];
    for (const [key, count] of preset) add(String(key), n(count, 1));
  }

  // Do not deduplicate user-selected counts. The UI count is part of the architectural
  // requirement and must reach the planner unchanged. AUTO tiers above have already
  // produced their own deterministic mandatory counts.
  return result;
}

function desiredArea(specs: RoomSpec[], key: string, fallback: number): number {
  const spec = specs.find(s => s.key === key);
  if (spec?.areaMode === 'MANUAL' && spec.areaPerRoom && spec.areaPerRoom > 0) return spec.areaPerRoom;
  const def = getRoomDefinition(key);
  return Math.max(def.minArea || 1, def.defaultArea || fallback);
}

function chooseStairType(W: number, H: number): StaircaseType {
  // Prefer a two-flight L/U-compatible core once the usable width reaches ~18 ft.
  // Straight stairs consume excessive depth on narrow homes and break the circulation chain.
  if (W >= 28 && H >= 45) return 'DOG_LEGGED';
  if (W >= 18 && H >= 38) return 'L_SHAPED';
  return 'STRAIGHT';
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

/**
 * Builds a connected residential plan in normalized coordinates:
 * y=H is always the road/front edge before the orientation renderer rotates the sheet.
 * Narrow plots use a side circulation spine; wider plots use a central service strategy.
 */
function buildResidentialLayout(program: string[], specs: RoomSpec[], W: number, H: number, ground: boolean, stairSpec: ReturnType<typeof calculateStaircase>): FloorRoom[] {
  /**
   * Candidate-based architectural zoning.
   * Coordinates are normalized so the MAIN ROAD is always at local BOTTOM (y = H).
   * No plot-size preset is used: every dimension is derived from the current W/H,
   * required program, room minimums, stair geometry and available area.
   */
  const rooms: FloorRoom[] = [];
  let id = 0;
  const counts = roomCounts(program);
  const addRoom = (key: string, x: number, y: number, w: number, h: number, extras: any = {}) => {
    if (w > 0.5 && h > 0.5) rooms.push(makeRoom(key, id++, x, y, w, h, extras));
  };

  const has = (k: string) => (counts[k] || 0) > 0;
  const bedrooms = program.filter(k => k === 'MASTER BEDROOM' || k === 'BEDROOM');
  const hasParking = ground && has('PARKING');
  const hasLiving = has('LIVING ROOM');
  const hasKitchen = has('KITCHEN');
  const hasKD = has('KITCHEN CUM DINING');
  const hasDining = has('DINING');
  const hasStair = has('STAIRCASE');
  const hasCommon = has('COMMON TOILET');
  const hasAttached = has('ATTACHED TOILET');

  const min = (key: string) => PRACTICAL_ROOM_RULES[key] || { minWidth: 3, minDepth: 3, preferredWidth: 5, preferredDepth: 6, furniture: '' };
  const minDim = (key: string, horizontal = true) => horizontal ? min(key).minWidth : min(key).minDepth;
  const roomArea = (key: string, fallback: number) => desiredArea(specs, key, fallback);
  const fit = (key: string, area: number, maxW: number, maxH: number) => fitRectForArea(key, area, Math.max(0.1, maxW), Math.max(0.1, maxH));
  const usableW = Math.max(1, W), usableH = Math.max(1, H);

  // Candidate zoning bands are computed from requirements. The front band is always
  // the road/entry band; private rooms are kept away from the public edge where possible.
  const parkingDepth = hasParking ? clamp(Math.min(usableH * 0.24, 16), 10, Math.max(10, usableH - 20)) : 0;
  const frontDepth = hasParking ? Math.max(15, parkingDepth) : clamp(usableH * 0.20, 8, 12);
  const stairDepth = hasStair ? Math.max(9, stairSpec.requiredLengthFt) : 0;
  const bedroomDepths = bedrooms.map(k => clamp((roomArea(k, k === 'MASTER BEDROOM' ? 140 : 120) / Math.max(usableW, 10)), minDim(k, false), 16));
  const privateDepth = bedrooms.length ? Math.min(usableH * 0.55, Math.max(12, bedroomDepths.reduce((a,b)=>a+b,0) + (bedrooms.length > 1 ? 0.5 : 0))) : 0;
  const middleDepth = Math.max(8, usableH - frontDepth - privateDepth);

  // -------- Medium frontage / two-bedroom candidate --------
  // 22–28 ft homes: bedrooms share a rear band side-by-side, while a horizontal protected
  // corridor separates the private zone from service/public zones. This is more efficient
  // than a vertical spine and preserves bedroom width.
  if (W >= 22 && W < 28 && H >= 42 && hasLiving && hasStair && bedrooms.length >= 2 && hasParking) {
    const parking = scoreAndPlaceParking(W, 15, W, H);
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
        candidateScore: parking.score, vehicleClearanceRequired: true,
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
      if (hasCommon) addRoom('DUCT', commonX, serviceY + 7, 1.5, Math.min(3.5, serviceH - 7), { ventilationFor: 'COMMON TOILET', openToSky: true, serviceCore: true });

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
      if (hasAttached) addRoom('ATTACHED TOILET', roomW - 5, 0, 5, Math.min(7, privateH), {
        attachedTo: master.id, subZoneOf: master.id, isSubRoom: true, serviceCore: true, ventilationRequired: true,
      });
      addRoom('BEDROOM', roomW, 0, roomW, privateH, { privateZone: true, requestedArea: roomArea('BEDROOM', 110), furnitureValidated: true });

      if (has('BALCONY')) {
        const living = rooms.find(r => canonical(r.name) === 'LIVING ROOM');
        if (living) addRoom('BALCONY', Math.max(0, W - 6), living.y || 0, 6, 4.5, { subZoneOf: living.id, isSubRoom: true, isOpen: true, attachedTo: living.id, exteriorProjection: true });
      }
      return rooms;
    }
  }

  // -------- Compact architectural candidate (narrow/medium frontage) --------
  // Circulation-first strategy for sub-24-ft homes. The corridor is a protected
  // geometric zone; it is never treated as accidental leftover space.
  if (W < 24 && H >= 38 && hasLiving && hasStair) {
    const parking = hasParking ? scoreAndPlaceParking(W, 15, W, H) : null;
    const parkingH = parking ? 15 : 0;
    const livingH = clamp(roomArea('LIVING ROOM', 120) / Math.max(1, W), 10, 10.5);
    const stairW = clamp(stairSpec.requiredWidthFt || 5.5, 5.5, Math.min(6, W * 0.34));
    const stairH = clamp(stairSpec.requiredLengthFt || 10, 9.5, Math.min(11.5, H));
    const commonW = hasCommon ? 4.5 : 0;
    const ductW = hasCommon ? 1.5 : 0;
    const kitchenBayW = Math.max(7, W - stairW - commonW);
    const serviceH = Math.max(10, stairH, hasCommon ? 7 : 0, hasKitchen || hasKD ? 8 : 0);
    const passageW = bedrooms.length ? 3.25 : 0;
    const privateTargetH = bedrooms.length ? (bedrooms.length > 1 ? 20.5 : 10.5) : 0;
    const requiredH = parkingH + livingH + serviceH + passageW + privateTargetH;

    if (requiredH <= H + 0.25 && kitchenBayW >= 7) {
      if (parking) {
        addRoom('PARKING', parking.x, H - parking.h, parking.w, parking.h, {
          parkingShape: parking.shape,
          parkingZone: 'FRONT_ROAD_CONNECTED',
          vehicleFit: parking.vehicleFit,
          candidateScore: parking.score,
          vehicleClearanceRequired: true,
        });
      }

      const livingY = H - parkingH - livingH;
      addRoom('LIVING ROOM', 0, livingY, W, livingH, {
        entryZone: true, roadConnected: true, publicCore: true,
      });

      const serviceY = livingY - serviceH;
      const stairX = W - stairW;
      const commonX = stairX - commonW;

      if (hasKD) {
        addRoom('KITCHEN CUM DINING', 0, serviceY, Math.max(7, commonX), serviceH, {
          serviceZone: true, diningAdjacent: true, ventilationRequired: true,
        });
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
        addRoom('COMMON TOILET', commonX, serviceY, commonW, 7, {
          serviceCore: true, privacy: 'LIVING_SIDE_ACCESS', ventilationRequired: true,
        });
        addRoom('DUCT', commonX, serviceY + 7, ductW, Math.min(4, serviceH - 7), {
          ventilationFor: 'COMMON TOILET', openToSky: true, serviceCore: true,
        });
      }

      addRoom('STAIRCASE', stairX, serviceY, stairW, stairH, {
        staircaseType: stairSpec.staircaseType,
        staircaseSpec: stairSpec,
        verticalCore: true,
        accessSide: 'BOTTOM',
        landingRequired: true,
        upperFloorCore: true,
      });

      if (bedrooms.length) {
        const passageY = serviceY - passageW;
        addRoom('PASSAGE', 0, passageY, W, passageW, {
          circulationZone: true,
          protectedCorridor: true,
          corridorWidthFt: passageW,
          pinkGuideLines: true,
          connects: ['LIVING ROOM', 'STAIRCASE', 'PRIVATE ROOMS'],
        });

        const privateTop = passageY;
        const privateBottom = 0;
        const availablePrivate = privateTop - privateBottom;
        const ordered = [...bedrooms].sort((a, b) => a === 'MASTER BEDROOM' ? -1 : b === 'MASTER BEDROOM' ? 1 : 0);
        const eachH = ordered.length === 1 ? availablePrivate : availablePrivate / ordered.length;
        let y = privateBottom;

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
            privateZone: true,
            requestedArea: roomArea(key, key === 'MASTER BEDROOM' ? 140 : 110),
            furnitureValidated: true,
          });
          const master = rooms[rooms.length - 1];
          if (key === 'MASTER BEDROOM' && attachedW > 0) {
            addRoom('ATTACHED TOILET', roomW, y, attachedW, Math.min(7, h), {
              attachedTo: master.id,
              subZoneOf: master.id,
              isSubRoom: true,
              serviceCore: true,
              ventilationRequired: true,
            });
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

      return rooms;
    }
  }

  // -------- Front/entry zone --------
  let livingY = H - frontDepth;
  let livingH = 0;
  if (hasParking) {
    const parking = scoreAndPlaceParking(usableW, frontDepth, W, H);
    addRoom('PARKING', parking.x, parking.y, parking.w, parking.h, {
      parkingShape: parking.shape,
      parkingZone: 'FRONT_ROAD_CONNECTED',
      vehicleFit: parking.vehicleFit,
      candidateScore: parking.score,
    });

    if (hasLiving) {
      const remainingW = Math.max(0, usableW - parking.w);
      if (remainingW >= minDim('LIVING ROOM')) {
        addRoom('LIVING ROOM', 0, H - frontDepth, remainingW, frontDepth, { entryZone: true, roadConnected: true });
      } else {
        // Narrow frontage: do NOT squeeze living beside the car. Move the living room
        // into the next full-width band immediately behind the parking/entry zone.
        livingH = Math.min(12, Math.max(10, middleDepth * 0.62));
        livingY = H - frontDepth - livingH;
        addRoom('LIVING ROOM', 0, livingY, usableW, livingH, { entryZone: true, roadConnected: true, behindParking: true });
      }
    }
  } else if (hasLiving) {
    livingH = frontDepth;
    addRoom('LIVING ROOM', 0, H - frontDepth, usableW, frontDepth, { entryZone: true, roadConnected: true });
  }

  // -------- Private/rear zone --------
  // Bedrooms are stacked along the depth when frontage is narrow. This avoids the
  // classic 20-ft problem where two bedrooms are placed side-by-side with no passage.
  const rearBottom = 0;
  let cursorY = rearBottom;
  const orderedBedrooms = [...bedrooms].sort((a,b) => a === 'MASTER BEDROOM' ? -1 : b === 'MASTER BEDROOM' ? 1 : 0);

  orderedBedrooms.forEach((key, idx) => {
    const remainingH = Math.max(0, privateDepth - cursorY);
    const targetH = idx === orderedBedrooms.length - 1 ? remainingH : clamp(roomArea(key, key === 'MASTER BEDROOM' ? 140 : 120) / usableW, minDim(key, false), Math.max(minDim(key, false), remainingH - 0.25));
    const h = Math.max(minDim(key, false), Math.min(remainingH, targetH));
    if (h < minDim(key, false)) return;

    // Master gets a private attached toilet carved from its side when the width allows.
    let roomW = usableW;
    let attachedW = 0;
    if (key === 'MASTER BEDROOM' && hasAttached && usableW >= 15) {
      attachedW = clamp(usableW * 0.27, 4.5, 5.5);
      roomW = usableW - attachedW;
      if (roomW < minDim('MASTER BEDROOM')) { attachedW = 0; roomW = usableW; }
    }

    addRoom(key, 0, cursorY, roomW, h, {
      privateZone: true,
      requestedArea: roomArea(key, key === 'MASTER BEDROOM' ? 140 : 120),
      furnitureValidated: true,
    });
    if (key === 'MASTER BEDROOM' && attachedW > 0) {
      const ah = Math.min(7, h);
      addRoom('ATTACHED TOILET', roomW, cursorY, attachedW, ah, { attachedTo: key, serviceCore: true, ventilationRequired: true });
    }
    cursorY += h + (idx < orderedBedrooms.length - 1 ? 0.25 : 0);
  });

  // -------- Middle service/circulation zone --------
  const middleY = privateDepth;
  const effectiveFrontDepth = frontDepth + livingH;
  const middleH = Math.max(7, H - privateDepth - effectiveFrontDepth);
  const stairW = hasStair ? clamp(stairSpec.requiredWidthFt || 5.5, 5.5, Math.min(7, W * 0.36)) : 0;
  // For narrow/medium plots use a real service/circulation spine between rooms and the
  // stair rather than a decorative corridor rectangle that can overlap other geometry.
  const stairX = hasStair ? Math.max(0, W - stairW) : W;
  if (hasStair && middleH >= stairSpec.requiredLengthFt) {
    const stairH = Math.min(middleH, stairSpec.requiredLengthFt);
    // Keep the vertical core on the front edge of the service band so the living/entry
    // zone can open directly to the stair landing and the same core can continue upward.
    const stairY = Math.max(middleY, H - effectiveFrontDepth - stairH);
    addRoom('STAIRCASE', stairX, stairY, stairW, stairH, {
      staircaseType: stairSpec.staircaseType,
      staircaseSpec: stairSpec,
      verticalCore: true,
      accessSide: 'BOTTOM',
      landingRequired: true,
      upperFloorCore: true,
    });
  }

  const serviceRight = hasStair ? stairX : W;

  // Wet rooms must not collide with the stair. Prefer a compact wet/service bay on the
  // non-stair side; when width is tight it is stacked vertically against the kitchen edge.
  const wetW = hasCommon ? Math.min(4.5, Math.max(4.0, serviceRight - 7.0)) : 0;
  const ductW = hasCommon ? 1.5 : 0;
  const foodW = Math.max(7.0, serviceRight);

  if (hasKD) {
    // Preferred topology for compact plots: kitchen/dining occupies the left bay,
    // wet/service core sits immediately beside it, and the stair remains a separate
    // vertical core. The three bays are dimensioned from the current footprint.
    const sideCoreW = hasCommon ? wetW + ductW : 0;
    const kdW = Math.max(7, serviceRight - sideCoreW);
    const minKD = min('KITCHEN CUM DINING');
    const targetKD = roomArea('KITCHEN CUM DINING', 130);

    if (hasCommon && kdW >= minKD.minWidth && middleH >= minKD.minDepth + 0.25) {
      const toiletH = Math.min(7, middleH * 0.48);
      const kdH = middleH;
      addRoom('KITCHEN CUM DINING', 0, middleY, kdW, kdH, {
        ventilationEdge: 'LEFT', diningAdjacent: true, serviceZone: true, requestedArea: targetKD,
      });
      const commonX = kdW;
      if (wetW >= 4.5 && toiletH >= 7) {
        addRoom('COMMON TOILET', commonX, middleY, wetW, toiletH, {
          serviceCore: true, privacy: 'LANDING_SIDE_AVOIDED', ventilationRequired: true,
        });
        if (ductW >= 1.5) addRoom('DUCT', commonX + wetW, middleY, ductW, toiletH, {
          ventilationFor: 'COMMON TOILET', openToSky: true, serviceCore: true,
        });
      }
    } else {
      // If the requested combined kitchen/dining cannot coexist with the wet core at
      // this width, keep it intact and search for a free wet bay instead of overlapping it.
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
    const commonX = Math.max(0, serviceRight - wetW);
    const free = findFreeRectangle(rooms, W, H, wetW, toiletH, middleY, H - frontDepth);
    if (free) addRoom('COMMON TOILET', free.x, free.y, wetW, toiletH, { serviceCore: true, privacy: 'LANDING_SIDE_AVOIDED', ventilationRequired: true });
  }

  // If the requested room set has more bedrooms than the rear band can support, place
  // remaining bedrooms in free rectangles only after minimum dimensions are respected.
  const placedBedroomCount = rooms.filter(r => ['MASTER BEDROOM','BEDROOM'].includes(canonical(r.name))).length;
  if (placedBedroomCount < bedrooms.length) {
    for (let i = placedBedroomCount; i < bedrooms.length; i++) {
      const key = bedrooms[i];
      const target = fit(key, roomArea(key, key === 'MASTER BEDROOM' ? 140 : 120), W, Math.max(10, middleH - 0.5));
      const free = findFreeRectangle(rooms, W, H, target.w, target.h, middleY, H - frontDepth);
      if (free) addRoom(key, free.x, free.y, target.w, target.h, { fallbackPlacement: true });
    }
  }

  // Optional rooms are fitted into genuinely free space, never by shrinking required rooms.
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

  return rooms;
}

function rectanglesOverlap(a: any, b: any): boolean {
  return Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) + 0.05 && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y) + 0.05;
}

function findFreeRectangle(rooms: FloorRoom[], W: number, H: number, rw: number, rh: number, yMin = 0, yMax = H): {x:number;y:number}|null {
  const step = 0.5;
  for (let y = Math.max(0, yMin); y + rh <= Math.min(H, yMax) + 0.01; y += step) {
    for (let x = 0; x + rw <= W + 0.01; x += step) {
      const candidate = { x, y, w: rw, h: rh } as any;
      const collides = rooms.some(r => {
        if ((r as any).subZoneOf || (r as any).isSubRoom) return false;
        return Math.min((r.x||0)+(r.w||0), x+rw) > Math.max(r.x||0,x)+0.05 &&
          Math.min((r.y||0)+(r.h||0), y+rh) > Math.max(r.y||0,y)+0.05;
      });
      if (!collides) return {x,y};
    }
  }
  return null;
}

function scoreAndPlaceParking(W: number, frontDepth: number, plotW: number, plotH: number) {
  const c = selectParkingCandidate(plotW, plotH, frontDepth);
  return { x: c.x, y: plotH - c.depth, w: c.width, h: c.depth, shape: c.type, vehicleFit: c.vehicleFit, score: c.score };
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
  const stairType = chooseStairType(W, H);
  const staircase = calculateStaircase(n(request.floorToFloorHeightFeet, 10), 6.8, stairType);
  const rooms = buildResidentialLayout(program, specs, W, H, ground, staircase);
  if (typeof console !== 'undefined') {
    console.log('[ROOM PLANNER] INPUT → PROGRAM', { floorName, width: W, length: H, area, mode, program });
    console.log('[ROOM PLANNER] ARCHITECTURAL DECISION', {
      floorName, width: W, length: H, area, road: orientation.mainRoad,
      program, stairType, stair: staircase,
      parking: rooms.filter(r => canonical(r.name) === 'PARKING').map(r => ({x:r.x,y:r.y,w:r.w,h:r.h,shape:(r as any).parkingShape,vehicleFit:(r as any).vehicleFit})),
      accessIntent: 'PARKING → LIVING → STAIR/KITCHEN → BEDROOMS',
      ventilationIntent: 'KITCHEN/TOILET → EXTERIOR OR DUCT/OTS',
    });
    console.log('[ROOM PLANNER] GENERATED GEOMETRY', rooms.map(r => ({
      name: r.name, x: Number(r.x?.toFixed(2)), y: Number(r.y?.toFixed(2)),
      w: Number(r.w?.toFixed(2)), h: Number(r.h?.toFixed(2)),
      subZoneOf: (r as any).subZoneOf || null,
      stairType: (r as any).staircaseType || null,
      ventilation: (r as any).ventilationFor || null,
    })));
  }
  const warnings: string[] = [];
  const errors: string[] = [];
  const furnitureChecks: ArchitecturalPlanResult['furnitureChecks'] = [];

  // Required program presence is a HARD check. A requested kitchen/bedroom/etc. may not silently disappear.
  const requestedCounts = roomCounts(program);
  const presentCounts = roomCounts(rooms.map(r => canonical(r.name)));
  for (const [key, wanted] of Object.entries(requestedCounts)) {
    const got = presentCounts[key] || 0;
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

  const parking = rooms.find(r => canonical(r.name) === 'PARKING');
  if (ground && parking && Math.abs((parking.y || 0) + (parking.h || 0) - H) > 0.2) {
    errors.push(`${floorName}: PARKING is not on the normalized road/front edge.`);
  }
  if (parking && (!(parking as any).vehicleFit || (parking.w || 0) < 9 || (parking.h || 0) < 15)) {
    warnings.push(`${floorName}: parking candidate is below preferred car-bay clearance; it must not be treated as a full car bay.`);
  }

  if (staircase.actualRiserInches < 6 || staircase.actualRiserInches > 7.5) {
    errors.push(`${floorName}: Stair riser ${staircase.actualRiserInches}" is outside the configured practical range.`);
  }
  if (staircase.treadInches < 10) errors.push(`${floorName}: Stair tread ${staircase.treadInches}" is below configured minimum.`);

  // Logical room access graph: touching is necessary but a door/opening is created later by openingPlanner.
  // Here we require each non-open room to physically touch the circulation/public/service network.
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

export function roomProgramForFloor(selectedRooms: any, bhk: string, floorArea: number, isGround: boolean, mode: string, width = 0, length = 0): string[] {
  return programFromInput(selectedRooms, bhk, floorArea, isGround, mode, width, length);
}
