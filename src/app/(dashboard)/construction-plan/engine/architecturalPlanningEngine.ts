import { resolveDoorConflicts } from './doorResolver';
import { createPlotGeometry } from './plotEngine';
import { calculateBuildableGeometry, calculateBuildableFootprint } from './geometryEngine';
import { calculateSetbacks } from './setbackRules';
import { generateFloorOpenings, findSharedBoundary } from './openingPlanner';
import { calculateElevationProfile } from './elevationEngine';
import {
  buildSectionContext,
  buildSectionModel,
  DEFAULT_SECTION_CUTS,
  type SectionModel,
} from './sectionEngine';
import { generateWallsFromRooms, generateStructuralColumns } from './cad/cadGeometry';
import { buildPlotShapeFit, extendRoomsToPolygon, scanInterval, PlotShapeFit } from './plotShapeFit';
import { PlotDimensions, PlotShape, FloorRoom, PlanningMode, ParkingMode, VastuAssessment, VastuDirection } from './planningTypes';
import { toFiniteNumber, cleanFloorName } from './planningInput';
import { getRoadOrientation } from './roadOrientation';
import { validateConstructionPlan } from './validationEngine';
import { assessVastuForRoom } from './vastuRules';
import {
  generateArchitecturalFloorPlan,
  roomProgramForFloor,
  extractStairPositionFromResult,
  extractGroundWetStack,
  setGroundWetStack,
  resetGroundParts,
  type GroundWetStack,
  getInheritedGroundStairSpec,
} from './roomPlanner';
import { adaptStairToFloorHeight, getStairDrawingHints, solveStairDrawPlan } from './stairPlanner';
import { planTowerLayout, buildTowerRooms } from './towerPlanner';
import { scorePlan } from './planningScore';

// ✅ Import from layoutFormulas.ts (single source of truth)
import {
  n,
  clean,
  canonical,
  getExternalWallThicknessFt,
} from './layoutFormulas';

// ✅ Backward compat: `num` is now just an alias for `n`
const num = n;

export interface DynamicFloorRequest {
  floorName: string;
  width: number;
  length: number;
  bhk?: string;
  selectedRooms?: any;
  planningMode?: PlanningMode | string;
  planningSettings?: Record<string, any>;
  roadSide?: string;
  hasParking?: boolean;
  planningArea?: number;
  parkingMode?: ParkingMode;
  groundFloorProgram?: string[];
  groundStairPosition?: { x: number; y: number; w?: number; h?: number; spec?: any; corner?: string; entryFace?: string; exitFace?: string; flightDirection?: string; staircaseType?: string };
  groundStairRelativeOffset?: { dx: number; dy: number };
  /** Ground par final hui stair ka spec — upar ki floors aur tower isi ko reuse karte hain (same riser/tread count) */
  groundStairSpec?: any;
  /** v13: ground ka duct/attached-toilet stack (upper floors same x,y par) */
  groundWetStack?: GroundWetStack | null;
  /** v13: floor ka W/L user ne khud diya (tower box ke liye) */
  userDims?: boolean;
  /** v20: bedroom wali upper floor selected hai? (false => stair sirf ground ke angle se) */
  hasUpperFloor?: boolean;
}

export interface GeneratedFloorPlan {
  floorName: string;
  width: number;
  length: number;
  clearWidth: number;
  clearLength: number;
  area: number;
  outerArea: number;
  buildableArea: number;
  originX: number;
  originY: number;
  rooms: FloorRoom[];
  requestedProgram?: string[];
  walls: any[];
  columns: any[];
  openings: any[];
  dimensions: any[];
  staircase: any | null;
  warnings: string[];
  errors: string[];
  connectivity: { connected: boolean; unreachableRooms: string[] };
  vastuScore: number;
  vastuAssessments: VastuAssessment[];
  planningScore: ReturnType<typeof scorePlan>;
  furnitureChecks: any[];
  orientation: ReturnType<typeof getRoadOrientation>;
}

export interface GeneratedConstructionPlan {
  plotGeometry: any;
  setbackRules: any;
  buildableGeometry: any;
  plotArea: number;
  selectedFloors: string[];
  floors: Record<string, GeneratedFloorPlan>;
  floorData: Record<string, any>;
  floorRooms: Record<string, FloorRoom[]>;
  elevation: any[];
  section: SectionModel[];
  orientation: ReturnType<typeof getRoadOrientation>;
  generatedAt: string;
}

// ============================================================================
// LOCAL HELPERS
// ============================================================================

function typeOf(r: any): string {
  const s = `${r.type || ''} ${r.name || ''}`.toLowerCase();
  if (s.includes('parking')) return 'parking';
  if (s.includes('stair')) return 'stairs';
  if (s.includes('duct')) return 'duct';
  if (s.includes('kitchen')) return 'kitchen';
  if (s.includes('bath') || s.includes('toilet')) return 'bathroom';
  if (s.includes('living') || s.includes('hall') || s.includes('drawing')) return 'hall';
  if (s.includes('dining')) return 'dining';
  if (s.includes('master')) return 'master-bedroom';
  if (s.includes('bedroom') || s.includes('bed')) return 'bedroom';
  if (s.includes('passage')) return 'passage';
  if (s.includes('balcony')) return 'balcony';
  return 'room';
}

function touches(a: any, b: any): boolean {
  const ax=num(a.x), ay=num(a.y), aw=num(a.w), ah=num(a.h), bx=num(b.x), by=num(b.y), bw=num(b.w), bh=num(b.h);
  const xo=Math.min(ax+aw,bx+bw)-Math.max(ax,bx), yo=Math.min(ay+ah,by+bh)-Math.max(ay,by);
  return ((Math.abs(ay+ah-by)<.08 || Math.abs(by+bh-ay)<.08) && xo>.5) || ((Math.abs(ax+aw-bx)<.08 || Math.abs(bx+bw-ax)<.08) && yo>.5);
}

// ============================================================================
// normalizeSelectedRooms — preserve RAW key (not canonical)
// ============================================================================
function normalizeSelectedRooms(selectedRooms: any): any {
  if (!selectedRooms) return undefined;
  if (Array.isArray(selectedRooms)) return selectedRooms;
  if (typeof selectedRooms === 'object') {
    return Object.entries(selectedRooms).filter(([_, v]: any) => {
      if (v && typeof v === 'object') return v.selected !== false;
      return Boolean(v);
    }).map(([k, v]: any) => ({
        key: k,
        canonicalKey: canonical(k),
        count: v && typeof v === 'object' ? (v.count ?? 1) : 1,
        areaPerRoom: v?.areaMode === 'MANUAL' ? Number(v?.areaPerRoom) : undefined,
        width: v?.width ? Number(v.width) : (v?.w ? Number(v.w) : undefined),
        length: v?.length ? Number(v.length) : (v?.h ? Number(v.h) : undefined),
        position: v?.position,
        inheritedX: v?.inheritedX,
        inheritedY: v?.inheritedY,
        inheritedFrom: v?.inheritedFrom,
    }));
  }
  return undefined;
}

// ============================================================================
// ✅ generateTowerPlan
//  - Tower ka stair core = upar ki floor ki stair ka EXACT rect (same x, y, w, h) -> stair ke theek upar
//  - Canvas = upar ki floor ka clear size (tower ke apne chhote W/H se clamp nahi hota)
//  - User tower area / dimension zyada de to stair ke bagal me alag TOWER ROOM box (towerPlanner.ts)
// ============================================================================
function generateTowerPlan(
  canvasW: number,
  canvasL: number,
  floorName: string,
  floorToFloorHeight = 10,
  groundStairPosition?: { x: number; y: number; w?: number; h?: number; spec?: any; corner?: string; entryFace?: string; exitFace?: string; flightDirection?: string; staircaseType?: string },
  groundStairSpec?: any,
  towerOpts?: { towerArea?: number; roomWidth?: number; roomLength?: number; boxW?: number; boxL?: number; entryFace?: any },
) {
  const W = Math.max(1, canvasW), H = Math.max(1, canvasL);

  const stairW0 = groundStairPosition?.w && groundStairPosition.w > 0
    ? Number(groundStairPosition.w)
    : Math.min(6, Math.max(5, W * 0.55));
  const stairH0 = groundStairPosition?.h && groundStairPosition.h > 0
    ? Number(groundStairPosition.h)
    : Math.min(Math.max(8.5, H * 0.75), 12);
  const hasPos = !!groundStairPosition && Number.isFinite(groundStairPosition.x) && Number.isFinite(groundStairPosition.y);

  const layout = planTowerLayout({
    stair: {
      x: hasPos ? Number(groundStairPosition!.x) : Math.max(0, W - stairW0),
      y: hasPos ? Number(groundStairPosition!.y) : 0,
      w: stairW0, h: stairH0,
    },
    canvasW: W, canvasL: H,
    towerArea: towerOpts?.towerArea,
    roomWidth: towerOpts?.roomWidth,
    roomLength: towerOpts?.roomLength,
    boxW: towerOpts?.boxW,
    boxL: towerOpts?.boxL,
    entryFace: (towerOpts?.entryFace || groundStairPosition?.entryFace) as any,
  });
  const rooms: FloorRoom[] = buildTowerRooms(layout, W, H, (towerOpts?.entryFace || groundStairPosition?.entryFace) as any, groundStairPosition?.exitFace);
  const { stair: st } = layout;

  // ✅ Tower stair = ground wali stair ka SAME spec (type, flight width, tread, riser COUNT).
  const inheritedSpec = groundStairSpec ?? groundStairPosition?.spec ?? getInheritedGroundStairSpec(W, floorToFloorHeight);
  const stair = inheritedSpec
    ? adaptStairToFloorHeight(inheritedSpec, floorToFloorHeight)
    : generateArchitecturalFloorPlan({
        floorName,
        width: st.w,
        length: st.h,
        bhk: '1 RK',
        selectedRooms: ['STAIRCASE'],
        planningMode: 'AUTO',
        roadSide: '1 SIDE ROAD (SOUTH)',
        hasParking: false,
        floorToFloorHeightFeet: floorToFloorHeight,
      }).staircase;
  if (!inheritedSpec && typeof console !== 'undefined') {
    console.warn('[generateTowerPlan] ⚠️ Ground stair spec nahi mila — tower stair alag calculate hui. Pehle GROUND generate karo.');
  }

  // Renderer ke liye: spec room par DIRECT (renderer rm.staircaseSpec padhta hai) + stairMeta
  const towerStairRoom: any = rooms.find((r: any) => r.id === 'tower_stair');
  if (towerStairRoom) {
    towerStairRoom.staircaseSpec = stair;
    towerStairRoom.staircaseType = (stair as any).staircaseType;
    towerStairRoom.stairMeta = {
      staircaseType: (stair as any).staircaseType,
      staircaseSpec: stair,
      absX: st.x, absY: st.y, w: st.w, h: st.h,
      corner: groundStairPosition?.corner,
      entryFace: groundStairPosition?.entryFace,
      exitFace: groundStairPosition?.exitFace,
      flightDirection: groundStairPosition?.flightDirection,
      renderHints: {
        drawFromSpec: true,
        riserCount: (stair as any).riserCount,
        flight1Treads: (stair as any).flight1?.treads,
        flight2Treads: (stair as any).flight2?.treads,
        middleTreads: (stair as any).middleTreads,
        treadInches: (stair as any).treadInches,
        actualRiserInches: (stair as any).actualRiserInches,
        drawPlan: (stair as any).drawPlan,
      },
      stairDrawing: getStairDrawingHints('TOWER'),
      source: 'TOWER_INHERITED_FROM_GROUND',
    };
  }

  if (typeof console !== 'undefined') {
    console.log('[generateTowerPlan] ✅ tower anchored on upper-floor stair', {
      canvas: { W, H }, stair: st, room: layout.room, placement: layout.placement,
      stairArea: layout.stairArea, roomArea: layout.roomArea, totalArea: layout.totalArea,
    });
  }

  return { rooms, stair, layout };
}

// ============================================================================
// generateDynamicFloorPlan
// ============================================================================
export function generateDynamicFloorPlan(request: DynamicFloorRequest, maxFootprint: { width: number; length: number; originX: number; originY: number }): GeneratedFloorPlan {
  const floorName = cleanFloorName(request.floorName);
  const requestedW = Math.max(1, num(request.width, maxFootprint.width));
  const requestedL = Math.max(1, num(request.length, maxFootprint.length));
  const outerW = Math.min(requestedW, Math.max(1, maxFootprint.width));
  const outerL = Math.min(requestedL, Math.max(1, maxFootprint.length));

  const wall = 4 / 12;
  const clearW = Math.max(1, outerW - 2 * wall);
  const clearL = Math.max(1, outerL - 2 * wall);
  const floorArea = outerW * outerL;
  const isGround = floorName.includes('GROUND');
  const isTower = floorName.includes('TOWER') || floorName.includes('MUMTY');
  // Tower ka canvas = upar ki floor ka clear size (stair ke theek upar aane ke liye); baaki floors me same as clear.
  const layoutW = isTower ? Math.max(clearW, maxFootprint.width - 2 * wall) : clearW;
  const layoutL = isTower ? Math.max(clearL, maxFootprint.length - 2 * wall) : clearL;

  const hasParking = request.hasParking === true
    ? true
    : request.hasParking === false
    ? false
    : isGround;

  const orientation = getRoadOrientation(request.roadSide || '1 SIDE ROAD (SOUTH)');
  const requestedProgram = isTower
    ? ['OPEN TERRACE', 'TOWER', 'STAIRCASE']
    : roomProgramForFloor(
        normalizeSelectedRooms(request.selectedRooms),
        request.bhk || 'AUTO',
        num(request.planningArea, clearW * clearL),
        isGround,
        String(request.planningMode || 'AUTO'),
        clearW,
        clearL
      );
  const warnings: string[] = [];
  const errors: string[] = [];

  let rooms: FloorRoom[];
  let staircase: any = null;
  let furnitureChecks: any[] = [];

  if (isTower) {
    const ps: any = request.planningSettings || {};
    const tower = generateTowerPlan(
      layoutW,
      layoutL,
      floorName,
      num(ps.floorToFloorHeightFeet, 10),
      request.groundStairPosition,
      request.groundStairSpec,
      {
        // Sirf jab user ne tower area / room dimension khud diya ho (default 10x10 se extra room na bane)
        towerArea: num(ps.towerArea, 0),
        roomWidth: num(ps.towerRoomWidth, 0),
        roomLength: num(ps.towerRoomLength, 0),
        // v13: user ne tower floor ka W x L khud diya ho to wahi box (default 10x10 hardcode nahi)
        // tower area (sq.ft) se W x L auto-fill hota hai -> wo bhi box hai (stair ki width uske andar, bahar nahi)
        boxW: ((request as any).userDims || (num(ps.towerArea, 0) > 0 && Math.abs(requestedW * requestedL - num(ps.towerArea, 0)) <= 0.2 * num(ps.towerArea, 0))) ? requestedW : 0,
        boxL: ((request as any).userDims || (num(ps.towerArea, 0) > 0 && Math.abs(requestedW * requestedL - num(ps.towerArea, 0)) <= 0.2 * num(ps.towerArea, 0))) ? requestedL : 0,
      },
    );
    rooms = tower.rooms;
    staircase = tower.stair;
    warnings.push(...tower.layout.notes);
    warnings.push('Tower/Mumty is planned as dynamic open terrace plus vertical stair headroom core; final authority/structural checks remain required.');
  } else {
    if (typeof console !== 'undefined') {
      console.log('[PLANNING ENGINE] GENERATE FLOOR', {
        floorName, width: clearW, length: clearL,
        planningArea: request.planningArea,
        mode: request.planningMode,
        hasParking,
        isGround,
        selectedRooms: request.selectedRooms,
        groundStairPosition: request.groundStairPosition,
        groundStairRelativeOffset: request.groundStairRelativeOffset,
        groundFloorProgram: request.groundFloorProgram,
      });
    }

    setGroundWetStack(isGround ? null : (request.groundWetStack || null));
    const smart = (() => { try { return generateArchitecturalFloorPlan({
      floorName,
      width: clearW,
      length: clearL,
      bhk: request.bhk || 'AUTO',
      selectedRooms: normalizeSelectedRooms(request.selectedRooms),
      planningMode: request.planningMode || 'AUTO',
      roadSide: request.roadSide,
      hasParking,
      floorToFloorHeightFeet: num(request.planningSettings?.floorToFloorHeightFeet, 10),
      planningArea: num((request as any).planningArea, clearW * clearL),
      parkingMode: String(request.planningSettings?.parkingMode || request.parkingMode || 'CAR').toUpperCase() as ParkingMode,
      groundFloorProgram: isGround ? undefined : request.groundFloorProgram,
      groundStairPosition: isGround ? undefined : request.groundStairPosition,
      groundStairRelativeOffset: isGround ? undefined : request.groundStairRelativeOffset,
      groundStairSpec: isGround ? undefined : (request.groundStairSpec ?? request.groundStairPosition?.spec),
      hasUpperFloor: request.hasUpperFloor,
    }); } finally { setGroundWetStack(null); } })();
    rooms = smart.rooms;
    warnings.push(...smart.warnings);
    errors.push(...smart.errors);
    staircase = smart.staircase;
    furnitureChecks = smart.furnitureChecks;

    if (typeof console !== 'undefined') {
      console.log('[ENGINE] 🔍 roomPlanner output doors:', smart.rooms.map((r: any) => ({
        name: r.name,
        doors: (r.doors || []).map((d: any) => ({ id: d.id, wall: d.wall, offset: d.offsetFeet, renderSymbol: d.renderSymbol }))
      })));
    }

    if (typeof console !== 'undefined') {
      console.log('[PLANNING ENGINE] FLOOR RESULT', {
        floorName,
        roomCount: smart.rooms.length,
        rooms: smart.rooms.map((r: any) => ({ name: r.name, x: r.x, y: r.y, w: r.w, h: r.h, subZoneOf: r.subZoneOf })),
        errors: smart.errors,
        warnings: smart.warnings,
        stair: smart.staircase,
      });
    }
  }

  // ✅ doors aur windows explicitly preserve karo
  rooms = rooms.map((r, i) => ({
    ...r,
    id: r.id || `room_${i}`,
    x: Number(Math.max(0, Math.min(num(r.x), layoutW - .01)).toFixed(3)),
    y: Number(Math.max(0, Math.min(num(r.y), layoutL - .01)).toFixed(3)),
    w: Number(Math.max(.1, Math.min(num(r.w), layoutW - num(r.x))).toFixed(3)),
    h: Number(Math.max(.1, Math.min(num(r.h), layoutL - num(r.y))).toFixed(3)),
    areaPerRoom: Number((Math.max(.1, num(r.w)) * Math.max(.1, num(r.h))).toFixed(2)),
    doors: Array.isArray(r.doors) ? [...r.doors] : [],
    windows: Array.isArray(r.windows) ? [...r.windows] : [],
  }));

  // ✅ FIX: Tower floor ke liye TOWER block + STAIR dono preserve karo
  if (isTower) {
    // ✅ Sirf OPEN TERRACE, TOWER, aur STAIRS ko rakho — baaki sab hataao
    rooms = rooms.filter((r) => {
      const name = String(r.name || '').toUpperCase();
      return name.includes('TERRACE') ||
             name.includes('TOWER') ||
             name.includes('STAIR') ||
             name.includes('MUMTY');
    });

    if (typeof console !== 'undefined') {
      console.log('[ENGINE] 🔍 Tower rooms preserved:', rooms.map((r: any) => ({
        name: r.name, x: r.x, y: r.y, w: r.w, h: r.h,
      })));
    }
  }

  let opened = generateFloorOpenings(rooms as any, orientation.mainRoad, layoutW, layoutL) as any[];
  // v14: tower me darwaze sirf towerPlanner ke (stair + TOWER ROOM) - openingPlanner ke extra/ghalat darwaze hatao
  if (isTower) {
    const own = new Map<string, any[]>((rooms as any[]).map((r: any) => [String(r.id), r.doors || []]));
    opened = opened.map((r: any) => ({ ...r, doors: own.has(String(r.id)) ? [...own.get(String(r.id))!] : (r.doors || []) }));
  }

  // v19: plan + openings ban jaane ke baad koi door kisi doosre door / stair se cross na kare (position -> hinge -> swing side)
  if (!isTower) { try { opened = resolveDoorConflicts(opened as any[], layoutW, layoutL) as any[]; } catch (e) { console.warn('[DOOR RESOLVER] failed', e); } }

  if (typeof console !== 'undefined') {
    console.log('[ENGINE] 🔍 after openingPlanner doors:', opened.map((r: any) => ({
      name: r.name,
      doors: (r.doors || []).map((d: any) => ({ id: d.id, wall: d.wall, offset: d.offsetFeet, renderSymbol: d.renderSymbol }))
    })));
  }

  const openingWarnings: string[] = [];
  const uniqueOpenings = new Set<string>();
  for (const r of opened) {
    for (const d of (r.doors || [])) {
      const key = `${r.id}|D|${d.wall}|${num(d.offsetFeet).toFixed(2)}|${num(d.widthFeet).toFixed(2)}`;
      if (uniqueOpenings.has(key)) openingWarnings.push(`${r.name}: duplicate door opening suppressed.`);
      uniqueOpenings.add(key);
    }
  }
  warnings.push(...openingWarnings);

  const blueprintRooms = opened.map((r: any, i: number) => ({
    id: r.id || `bp_${i}`,
    name: r.name || 'ROOM',
    sourceKey: canonical(r.name || 'ROOM').toLowerCase().replace(/\s+/g, '_'),
    index: i + 1,
    x: num(r.x), y: num(r.y), w: num(r.w), h: num(r.h),
    area: `${(num(r.w) * num(r.h)).toFixed(0)} SQ FT`,
    formattedDimension: `${num(r.w).toFixed(2)}' X ${num(r.h).toFixed(2)}'`,
    hasDoor: Array.isArray(r.doors) && r.doors.length > 0,
    hasWindow: Array.isArray(r.windows) && r.windows.length > 0,
    doorSide: r.doors?.[0]?.wall,
    isStairs: typeOf(r) === 'stairs',
    isParking: typeOf(r) === 'parking',
  }));

  const walls = generateWallsFromRooms(blueprintRooms, layoutW, layoutL);
  const columns = generateStructuralColumns(blueprintRooms);

  const planScore = scorePlan(opened as FloorRoom[]);

  const provisionalFloorData: Record<string, any> = {
    [floorName]: {
      width: outerW,
      length: outerL,
      clearWidth: clearW,
      clearLength: clearL,
      area: floorArea,
      outerArea: floorArea,
      buildableArea: clearW * clearL,
      rooms: opened,
      requestedProgram,
      staircase,
      orientation,
      outerWallThickness: wall,
      innerWallThickness: 4 / 12,
    },
  };

  const validation = validateConstructionPlan(
    floorArea,
    [floorName],
    provisionalFloorData,
    { [floorName]: opened as any },
    { [floorName]: opened as any },
    orientation.mainRoad,
  );
  warnings.push(...validation.warnings.map((x: any) => typeof x === 'string' ? x : x.message));
  errors.push(...validation.errors.map((x: any) => typeof x === 'string' ? x : x.message));

  if (requestedW > maxFootprint.width + .01 || requestedL > maxFootprint.length + .01) {
    warnings.push(`Requested ${requestedW.toFixed(2)} × ${requestedL.toFixed(2)} ft exceeds the available buildable footprint and was clamped.`);
  }
  if (isGround && floorArea > 750 && (opened.filter(r => canonical(r.name || '') === 'ATTACHED TOILET').length !== 1 || opened.filter(r => canonical(r.name || '') === 'COMMON TOILET').length !== 1) && String(request.planningMode || 'AUTO').toUpperCase() === 'AUTO') {
    errors.push('Ground AUTO > 750 SQ.FT requires exactly one attached toilet and one common toilet.');
  }

  const vastuAssessments: VastuAssessment[] = opened
    .filter((r: any) => ['KITCHEN','MASTER BEDROOM','POOJA ROOM','STAIRCASE'].some(k => canonical(r.name || '').includes(k)))
    .map((r: any) => {
      const cx = num(r.x) + num(r.w) / 2;
      const cy = num(r.y) + num(r.h) / 2;
      const horizontal = cx < clearW / 2 ? orientation.leftCardinal : orientation.rightCardinal;
      const vertical = cy < clearL / 2 ? orientation.topCardinal : orientation.bottomCardinal;
      const pair = new Set([horizontal, vertical]);
      let zone: VastuDirection = 'CENTER';
      if (pair.has('NORTH') && pair.has('EAST')) zone='NE';
      else if (pair.has('NORTH') && pair.has('WEST')) zone='NW';
      else if (pair.has('SOUTH') && pair.has('EAST')) zone='SE';
      else if (pair.has('SOUTH') && pair.has('WEST')) zone='SW';
      else if (pair.has('NORTH')) zone='N'; else if (pair.has('SOUTH')) zone='S'; else if (pair.has('EAST')) zone='E'; else if (pair.has('WEST')) zone='W';
      return assessVastuForRoom(canonical(r.name || 'ROOM'), zone);
    });
  const good = vastuAssessments.filter(a => a.status === 'GOOD').length;
  const vastuScore = vastuAssessments.length ? Math.round(good / vastuAssessments.length * 100) : 100;
  for (const a of vastuAssessments) if (a.status !== 'GOOD') warnings.push(a.note);

  const unreachableRooms = validation.errors.filter((e: any) => String(e.message).toLowerCase().includes('not reachable')).map((e: any) => e.roomKey || e.message);

  return {
    floorName,
    width: Number(outerW.toFixed(2)), length: Number(outerL.toFixed(2)),
    // v14: tower ke rooms upar ki floor ke clear canvas (layoutW x layoutL) me hain -> renderer ko wahi clear size do (pehle 9.33 milta tha aur stair 9.33 me dobara solve/clamp hoke boundary wall se door dikhti thi)
    clearWidth: Number((isTower ? layoutW : clearW).toFixed(2)), clearLength: Number((isTower ? layoutL : clearL).toFixed(2)),
    area: Number(floorArea.toFixed(2)), outerArea: Number(floorArea.toFixed(2)),
    buildableArea: Number((clearW * clearL).toFixed(2)),
    originX: Number((maxFootprint.originX + Math.max(0, (maxFootprint.width - outerW) / 2)).toFixed(2)),
    originY: Number((maxFootprint.originY + Math.max(0, (maxFootprint.length - outerL) / 2)).toFixed(2)),
    rooms: opened as FloorRoom[], requestedProgram, walls, columns,
    openings: opened.flatMap((r: any) => [...(r.doors || []), ...(r.windows || [])]),
    dimensions: [], staircase,
    warnings: Array.from(new Set(warnings)), errors: Array.from(new Set(errors)),
    connectivity: { connected: unreachableRooms.length === 0, unreachableRooms },
    vastuScore, vastuAssessments, planningScore: planScore, furnitureChecks,
    orientation,
  };
}

// ============================================================================
// v12: irregular plot -> plan ko plot polygon se jodo
//   plan core-rect me bana hota hai (core-frame). Yahan rooms ko floor ke INNER frame me shift karke
//   core ke bahar ki jagah (wedge) kinare ke kamron me jodte hain, aur outline (outer/inner polygon) attach karte hain.
// ============================================================================
// v13: irregular plot -> stair core ke kinare par ho aur bahar slanted wall ho to stair aur wall ke beech khali patti na rahe.
//   stair ka footprint (landing/middle) us wedge ki min chaudai jitna badhate hain (drawPlan dobara solve), taaki stair wall se chipki dikhe.
function snapStairToWedge(plan: any, fit: PlotShapeFit): void {
  const L: any = (plan.rooms as any[]).find((r: any) => r.embeddedStair && !r.isSubRoom);
  if (!L) return;
  const e = L.embeddedStair;
  const core = fit.core;
  const sx = (L.x || 0) + (e.relX ?? 0), sy = (L.y || 0) + (e.relY ?? 0);
  const side = Math.abs(sx - core.x) < 0.3 ? 'L' : (Math.abs(sx + e.w - (core.x + core.w)) < 0.3 ? 'R' : '');
  if (!side) return;
  let g = Infinity;
  for (let k = 0; k <= 8; k++) {
    const y = sy + 0.05 + ((e.h - 0.1) * k) / 8;
    const it = scanInterval(fit.inner, y);
    if (!it) { g = 0; break; }
    g = Math.min(g, side === 'L' ? core.x - it[0] : it[1] - (core.x + core.w));
  }
  if (!(g >= 0.4)) return;
  g = Math.floor(Math.min(g, 3.5) * 4) / 4;
  const spec: any = e.staircaseSpec;
  if (!spec || !(Number(spec.riserCount) > 0)) return;
  const rotated = e.entryFace === 'LEFT' || e.entryFace === 'RIGHT';
  const newW = e.w + g;
  const crossBox = rotated ? e.h : newW;
  const runBox = rotated ? newW : e.h;
  const solved = solveStairDrawPlan(spec, crossBox, runBox);
  if (!solved || solved.plan.shortTreads !== 0) return;
  e.w = Number(newW.toFixed(3));
  if (side === 'L') { e.relX = Number((e.relX - g).toFixed(3)); if (typeof e.absX === 'number') e.absX = Number((e.absX - g).toFixed(3)); }
  e.staircaseSpec = { ...spec, ...solved.spec, drawPlan: solved.plan };
  if (e.renderHints) e.renderHints = { ...e.renderHints, drawPlan: solved.plan };
  e.snappedToWedge = { side, gapFt: g };
}

function applyShapeFitToPlan(plan: any, fit: PlotShapeFit, originX: number, originY: number): void {
  const dx = fit.core.x, dy = fit.core.y;
  const mv = (o: any) => { if (o && typeof o.x === 'number') { o.x = Number((o.x + dx).toFixed(3)); o.y = Number((o.y + dy).toFixed(3)); } };
  for (const r of plan.rooms as any[]) mv(r);
  for (const w of (plan.walls || []) as any[]) {
    if (w?.start && w?.end) { mv(w.start); mv(w.end); }
    else if (typeof w?.x1 === 'number') { w.x1 += dx; w.x2 += dx; w.y1 += dy; w.y2 += dy; }
  }
  for (const c of (plan.columns || []) as any[]) mv(c);
  const wall = fit.wall;
  const ext = extendRoomsToPolygon(plan.rooms as any[], fit.inner, fit.core);
  // jis wall par wedge juda hai wo ab andar ki line hai -> us par khidki/bahari opening nahi
  const sideWall: Record<string, string> = { L: 'LEFT', R: 'RIGHT', T: 'TOP', B: 'BOTTOM' };
  for (const r of plan.rooms as any[]) {
    for (const e of (r.extensions || [])) {
      const w = sideWall[e.side];
      r.windows = (r.windows || []).filter((q: any) => q.wall !== w);
    }
  }
  try { snapStairToWedge(plan, fit); } catch (e) { /* stair snap optional */ }
  const polyArea = (p: any[]) => Math.abs(p.reduce((s: number, a: any, i: number) => { const b = p[(i + 1) % p.length]; return s + a.x * b.y - b.x * a.y; }, 0)) / 2;
  plan.area = Number(polyArea(fit.outer).toFixed(2)); plan.outerArea = plan.area;
  plan.buildableArea = Number(polyArea(fit.inner).toFixed(2));
  plan.width = Number(fit.width.toFixed(2)); plan.length = Number(fit.length.toFixed(2));
  plan.clearWidth = Number((fit.width - 2 * wall).toFixed(2)); plan.clearLength = Number((fit.length - 2 * wall).toFixed(2));
  plan.originX = originX; plan.originY = originY;
  plan.outline = {
    outer: fit.outer, inner: fit.inner, core: fit.core, wall,
    extWalls: ext.extWalls, shape: 'POLYGON',
  };
  plan.warnings = Array.from(new Set([...(plan.warnings || []), `Irregular plot: planning plot ke shape (polygon) ke hisaab se; core ${fit.core.w.toFixed(1)} x ${fit.core.h.toFixed(1)} ft + side wedges kamron me joda gaya.`]));
}

// ============================================================================
// generateCompleteConstructionPlan
// ============================================================================
export function generateCompleteConstructionPlan(payload: any): GeneratedConstructionPlan {
  resetGroundParts();
  const raw = payload?.plotDimensions || payload?.dimensions || {};
  const A = Math.max(1, num(raw.A ?? raw.width ?? raw.a, 30));
  const C = Math.max(1, num(raw.C ?? raw.length ?? raw.c, 50));
  const dimensions: PlotDimensions = { ...raw, A, B: num(raw.B, A), C, D: num(raw.D, C), E: num(raw.E, 0), F: num(raw.F, 0), width: A, length: C, area: A * C };
  const shape = (payload?.plotShape || payload?.plot_shape || 'RECTANGULAR') as PlotShape;
  const plotGeometry = createPlotGeometry(dimensions, shape, payload?.plotVertices);
  const setbacks = calculateSetbacks(plotGeometry.area, 20, false, payload?.setbackInputs || payload?.setbacks, payload?.coverageType || 'AS_PER_NORMS');
  const buildableGeometry = calculateBuildableGeometry(dimensions, shape, setbacks, payload?.plotVertices);
  const fallback = calculateBuildableFootprint(dimensions, setbacks);
  const maxFootprint = { width: Math.max(.1, fallback.width || A), length: Math.max(.1, fallback.length || C), originX: num(fallback.originX), originY: num(fallback.originY) };
  // v12: irregular / trapezoid / custom plot -> polygon fit (rectangle plots ke liye null => purana raasta)
  let shapeFit: PlotShapeFit | null = null;
  try {
    shapeFit = buildPlotShapeFit({
      dims: { A, B: num(raw.B, A), C, D: num(raw.D, C) },
      shape: String(shape),
      vertices: Array.isArray(payload?.plotVertices) ? payload.plotVertices : null,
      slantB: payload?.plotSlant?.B,
      angles: payload?.plotAngles || null,
      setbacks: { front: setbacks.frontSetback, rear: setbacks.rearSetback, left: setbacks.leftSetback, right: setbacks.rightSetback },
      wall: 4 / 12,
    });
  } catch (e) { shapeFit = null; }
  const selectedFloors: string[] = (payload?.selectedFloors || payload?.selected_floors || Object.keys(payload?.floorData || {})).map(cleanFloorName).filter((v: string, i: number, arr: string[]) => v && arr.indexOf(v) === i);
  if (!selectedFloors.length) selectedFloors.push('GROUND FLOOR');
  const floorDataInput = payload?.floorData || payload?.floor_details || {};
  const floorRoomsInput = payload?.floorRooms || payload?.room_details || {};
  const floorBhk = payload?.floorBhkConfig || {};
  const settings = payload?.floorSettings || payload?.floor_settings || {};
  const orientation = getRoadOrientation(payload?.roadFacingOption || payload?.road_side || '1 SIDE ROAD (SOUTH)');

  let groundStairPos: { x: number; y: number; w?: number; h?: number; spec?: any; corner?: string; entryFace?: string; exitFace?: string; flightDirection?: string; staircaseType?: string } | null = payload?.groundStairPosition || null;
  let groundStairOffset: { dx: number; dy: number } | null = payload?.groundStairRelativeOffset || null;
  let groundFloorProgram: string[] = payload?.groundFloorProgram || [];

  const groundKey = selectedFloors.find(f => f.includes('GROUND'));

  // v6: ground floor isi call me REAL settings ke saath generate hota hai; stair uske
  // asli result se nikalte hain (stale parent values ignore). Pre-pass sirf tab jab ground select nahi.
  if (groundKey) {
    groundStairPos = null; groundStairOffset = null; groundFloorProgram = [];
  } else if (typeof console !== 'undefined') {
    console.log('[PLANNING ENGINE] Using stair info from parent:', {
      groundStairPos,
      groundStairOffset,
      groundFloorProgram,
    });
  }

  let groundWet: GroundWetStack | null = null;
  const floors: Record<string, GeneratedFloorPlan> = {};
  const generatedFloorData: Record<string, any> = {};
  const generatedFloorRooms: Record<string, FloorRoom[]> = {};

  const floorOrder = [...selectedFloors].sort((a, b) => (b.includes('GROUND') ? 1 : 0) - (a.includes('GROUND') ? 1 : 0));
  for (const floorName of floorOrder) {
    const input = floorDataInput[floorName] || floorDataInput[floorName.toUpperCase()] || {};
    let width = Math.max(1, num(input.width, maxFootprint.width));
    let length = Math.max(1, num(input.length, maxFootprint.length));
    const isGround = floorName.includes('GROUND');
    const isTowerF = floorName.toUpperCase().includes('TOWER') || floorName.toUpperCase().includes('MUMTY');
    const useFit = !!shapeFit && !isTowerF;
    let planFootprint = maxFootprint;
    if (useFit && shapeFit) {
      width = shapeFit.core.w + 2 * shapeFit.wall;
      length = shapeFit.core.h + 2 * shapeFit.wall;
      planFootprint = { width, length, originX: maxFootprint.originX, originY: maxFootprint.originY };
    }

    const plan = generateDynamicFloorPlan({
      floorName, width, length,
      bhk: floorBhk[floorName] || 'AUTO',
      selectedRooms: floorRoomsInput[floorName] ?? floorRoomsInput[floorName.toUpperCase()],
      planningMode: payload?.planningMode || 'AUTO',
      planningSettings: settings[floorName] || {},
      roadSide: payload?.roadFacingOption || payload?.road_side || '1 SIDE ROAD (SOUTH)',
      hasParking: isGround,
      planningArea: useFit ? Math.max(1, (width - 2 * (4 / 12)) * (length - 2 * (4 / 12))) : Math.max(1, num(input.area, width * length)),
      groundFloorProgram: isGround ? undefined : groundFloorProgram,
      groundStairPosition: isGround ? undefined : (groundStairPos ? { ...groundStairPos } : undefined),
      groundStairRelativeOffset: isGround ? undefined : (groundStairOffset || undefined),
      groundWetStack: isGround ? undefined : groundWet,
      userDims: !!input.userDims,
      hasUpperFloor: selectedFloors.some(f => !f.includes('GROUND') && !f.includes('BASEMENT') && !f.includes('TOWER') && !f.includes('MUMTY')),
    }, planFootprint);

    floors[floorName] = plan;

    if (isGround) {
      try {
        const si: any = extractStairPositionFromResult(plan as any);
        if (si) {
          groundStairPos = { x: si.x, y: si.y, w: si.w, h: si.h, spec: si.spec, corner: si.corner, entryFace: si.entryFace, exitFace: si.exitFace, flightDirection: si.flightDirection, staircaseType: si.staircaseType };
          groundStairOffset = si.relativeOffset;
        }
        groundWet = extractGroundWetStack(plan.rooms as any[]);
        groundFloorProgram = plan.rooms.map((r: any) => String(r.name || '').toLowerCase().replace(/\s+/g, '_'));
      } catch (e) { console.error('[PLANNING ENGINE] ground stair extract failed', e); }
    }

    if (useFit && shapeFit) {
      try { applyShapeFitToPlan(plan as any, shapeFit, maxFootprint.originX, maxFootprint.originY); }
      catch (e) { console.error('[PLANNING ENGINE] shape fit failed', e); }
    }

    if (typeof console !== 'undefined') {
      console.log('[PLANNING ENGINE] FLOOR FINAL', {
        floor: floorName,
        roomCount: plan.rooms.length,
        errors: plan.errors,
        warnings: plan.warnings,
        connectivity: plan.connectivity,
      });
      if (!isGround) {
        const stair = plan.rooms.find((r: any) => String(r.name || '').toUpperCase().includes('STAIR'));
        if (stair) {
          console.log(`[PLANNING ENGINE] ${floorName} stair:`, {
            x: stair.x, y: stair.y, w: stair.w, h: stair.h,
            placementRule: (stair as any).placementRule,
            inheritedFrom: (stair as any).inheritedFrom,
            subZoneOf: (stair as any).subZoneOf,
          });
        }
      }
    }

    generatedFloorRooms[floorName] = plan.rooms;
    generatedFloorData[floorName] = {
      width: plan.width, length: plan.length, clearWidth: plan.clearWidth, clearLength: plan.clearLength,
      area: plan.area, outerArea: plan.outerArea, buildableArea: plan.buildableArea,
      originX: plan.originX, originY: plan.originY, rooms: plan.rooms, walls: plan.walls, columns: plan.columns,
      outline: (plan as any).outline || undefined,
      openings: plan.openings, staircase: plan.staircase, staircaseConfig: plan.staircase,
      outerWallThickness: getExternalWallThicknessFt(), innerWallThickness: 4 / 12,
      connectivity: plan.connectivity, orientation: plan.orientation,
      planningScore: plan.planningScore, furnitureChecks: plan.furnitureChecks,
      validation: { errors: plan.errors, warnings: plan.warnings, isValid: plan.errors.length === 0 },
      requestedProgram: (plan as any).requestedProgram || plan.rooms.map((r: any) => r.name),
    };
  }

  if (typeof console !== 'undefined') {
    console.groupCollapsed('[PLANNING ENGINE] PIPELINE TRACE');
    console.log('[PLANNING ENGINE] master=architecturalPlanningEngine.ts');
    console.log('[PLANNING ENGINE] room placement=roomPlanner.ts');
    console.log('[PLANNING ENGINE] parking=parkingPlanner.ts');
    console.log('[PLANNING ENGINE] stair=stairPlanner.ts');
    console.log('[PLANNING ENGINE] openings=openingPlanner.ts');
    console.log('[PLANNING ENGINE] validation=validationEngine.ts');
    console.log('[PLANNING ENGINE] renderer=components/CadFloorPlansView.tsx');
    console.groupEnd();
    console.groupCollapsed('[PLANNING ENGINE] BUILDING SUMMARY');
    for (const floorName of selectedFloors) {
      const p = floors[floorName];
      console.log(floorName, {
        rooms: p?.rooms?.map((r: any) => `${r.name} ${Number(r.w || 0).toFixed(2)}x${Number(r.h || 0).toFixed(2)} @ ${Number(r.x || 0).toFixed(2)},${Number(r.y || 0).toFixed(2)}`),
        errors: p?.errors, warnings: p?.warnings, stair: p?.staircase,
      });
    }
    console.groupEnd();
  }

  const elevation = calculateElevationProfile(selectedFloors, num(payload?.floorToFloorHeightFeet, 10));

  // ✅ SECTION: build context first (from generated data), then build one SectionModel per cut.
  const sectionContext = buildSectionContext(
    selectedFloors,
    generatedFloorData,
    generatedFloorRooms,
    shapeFit ? shapeFit.width : maxFootprint.width,
    shapeFit ? shapeFit.length : maxFootprint.length,
  );

  const cutsInput: any[] =
    Array.isArray(payload?.sectionCuts) && payload.sectionCuts.length > 0
      ? payload.sectionCuts
      : DEFAULT_SECTION_CUTS;

  const section: SectionModel[] = cutsInput.map((cut) =>
    buildSectionModel(sectionContext, cut),
  );

  return {
    plotGeometry,
    setbackRules: setbacks,
    buildableGeometry,
    plotArea: plotGeometry.area,
    selectedFloors,
    floors,
    floorData: generatedFloorData,
    floorRooms: generatedFloorRooms,
    elevation,
    section,
    orientation,
    generatedAt: new Date().toISOString(),
  };
}

export function generateAutoRoomsForFloor(
  buildW: number,
  buildL: number,
  facing = '1 SIDE ROAD (SOUTH)',
  bhkConfig = 'AUTO',
  userRooms: any = [],
  setbacks: any = { front:0, rear:0,left:0,right:0 }
) {
  return generateDynamicFloorPlan({
    floorName: 'GROUND FLOOR',
    width: buildW,
    length: buildL,
    bhk: bhkConfig,
    selectedRooms: userRooms,
    planningMode: 'AUTO',
    roadSide: facing,
    hasParking: true,
    planningArea: buildW * buildL,
  }, {
    width: Math.max(.1, num(buildW)),
    length: Math.max(.1, num(buildL)),
    originX: num(setbacks.left),
    originY: num(setbacks.front),
  }).rooms;
}