import { createPlotGeometry } from './plotEngine';
import { calculateBuildableGeometry, calculateBuildableFootprint } from './geometryEngine';
import { calculateSetbacks } from './setbackRules';
import { generateFloorOpenings, findSharedBoundary } from './openingPlanner';
import { calculateElevationProfile } from './elevationEngine';
import { calculateSectionProfile } from './sectionEngine';
import { generateWallsFromRooms, generateStructuralColumns } from './cad/cadGeometry';
import { PlotDimensions, PlotShape, FloorRoom, PlanningMode, VastuAssessment, VastuDirection } from './planningTypes';
import { toFiniteNumber, cleanFloorName } from './planningInput';
import { getRoadOrientation } from './roadOrientation';
import { validateConstructionPlan } from './validationEngine';
import { assessVastuForRoom } from './vastuRules';
import { generateArchitecturalFloorPlan, roomProgramForFloor } from './roomPlanner';
import { scorePlan } from './planningScore';

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
  section: any[];
  orientation: ReturnType<typeof getRoadOrientation>;
  generatedAt: string;
}

function num(v: any, fallback = 0): number { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function canonical(raw: string): string {
  const s = String(raw || '').toUpperCase().trim();
  if (s.includes('MASTER')) return 'MASTER BEDROOM';
  if (s.includes('BEDROOM') || s === 'BED') return 'BEDROOM';
  if (s.includes('LIVING') || s.includes('DRAWING') || s.includes('HALL')) return 'LIVING ROOM';
  if (s.includes('KITCHEN')) return 'KITCHEN';
  if (s.includes('DINING')) return 'DINING';
  if (s.includes('ATTACHED') && (s.includes('TOILET') || s.includes('BATH'))) return 'ATTACHED TOILET';
  if (s.includes('COMMON') && (s.includes('TOILET') || s.includes('BATH'))) return 'COMMON TOILET';
  if (s.includes('TOILET') || s.includes('BATH')) return 'BATHROOM';
  if (s.includes('POOJA')) return 'POOJA ROOM';
  if (s.includes('STUDY')) return 'STUDY ROOM';
  if (s.includes('STAIR')) return 'STAIRCASE';
  if (s.includes('PARK') || s.includes('PORCH')) return 'PARKING';
  if (s.includes('DUCT') || s.includes('OTS')) return 'DUCT';
  if (s.includes('BALCONY')) return 'BALCONY';
  if (s.includes('UTILITY')) return 'UTILITY';
  if (s.includes('STORE')) return 'STORE';
  return s || 'ROOM';
}
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

function normalizeSelectedRooms(selectedRooms: any): any {
  if (!selectedRooms) return undefined;
  if (Array.isArray(selectedRooms)) return selectedRooms;
  if (typeof selectedRooms === 'object') {
    return Object.entries(selectedRooms).filter(([_, v]: any) => {
      if (v && typeof v === 'object') return v.selected !== false;
      return Boolean(v);
    }).map(([k, v]: any) => ({ key: canonical(k), count: v && typeof v === 'object' ? (v.count ?? 1) : 1, areaPerRoom: v?.areaMode === 'MANUAL' ? Number(v?.areaPerRoom) : undefined }));
  }
  return undefined;
}

function generateTowerPlan(width: number, length: number, floorName: string, floorToFloorHeight = 10) {
  const W = Math.max(1, width), H = Math.max(1, length);
  const targetStairW = Math.min(6, Math.max(5, W * .55));
  const targetStairH = Math.min(Math.max(8.5, H * .75), 12);
  const stairX = Math.max(0, W - targetStairW), stairY = 0;
  const rooms: FloorRoom[] = [
    { id: 'tower_terrace', name: 'OPEN TERRACE', label: 'OPEN TERRACE', roomType: 'balcony', type: 'balcony', x: 0, y: 0, w: W, h: H, selected: true, count: 1, areaMode: 'AUTO', areaPerRoom: W * H },
    { id: 'tower_stair', name: 'STAIR TOWER / MUMTY', label: 'STAIR TOWER / MUMTY', roomType: 'stairs', type: 'stairs', x: stairX, y: stairY, w: targetStairW, h: targetStairH, selected: true, count: 1, areaMode: 'AUTO', areaPerRoom: targetStairW * targetStairH },
  ];
  // The terrace is an open zone; remove the stair overlap logically by keeping the
  // stair as a service/vertical-core item. CAD can emphasize the stair over the terrace.
  const stair = generateArchitecturalFloorPlan({ floorName, width: targetStairW, length: targetStairH, bhk: '1 RK', selectedRooms: ['STAIRCASE'], planningMode: 'AUTO', roadSide: '1 SIDE ROAD (SOUTH)', hasParking: false, floorToFloorHeightFeet: floorToFloorHeight }).staircase;
  return { rooms, stair };
}

export function generateDynamicFloorPlan(request: DynamicFloorRequest, maxFootprint: { width: number; length: number; originX: number; originY: number }): GeneratedFloorPlan {
  const floorName = cleanFloorName(request.floorName);
  const requestedW = Math.max(1, num(request.width, maxFootprint.width));
  const requestedL = Math.max(1, num(request.length, maxFootprint.length));
  const outerW = Math.min(requestedW, Math.max(1, maxFootprint.width));
  const outerL = Math.min(requestedL, Math.max(1, maxFootprint.length));
  const wall = 8 / 12;
  const clearW = Math.max(1, outerW - 2 * wall);
  const clearL = Math.max(1, outerL - 2 * wall);
  const floorArea = outerW * outerL;
  const isGround = floorName.includes('GROUND');
  const isTower = floorName.includes('TOWER') || floorName.includes('MUMTY');
  const orientation = getRoadOrientation(request.roadSide || '1 SIDE ROAD (SOUTH)');
  const requestedProgram = isTower ? ['OPEN TERRACE', 'STAIRCASE'] : roomProgramForFloor(normalizeSelectedRooms(request.selectedRooms), request.bhk || 'AUTO', num(request.planningArea, clearW * clearL), isGround, String(request.planningMode || 'AUTO'), clearW, clearL);
  const warnings: string[] = [];
  const errors: string[] = [];

  let rooms: FloorRoom[];
  let staircase: any = null;
  let furnitureChecks: any[] = [];

  if (isTower) {
    const tower = generateTowerPlan(clearW, clearL, floorName, num(request.planningSettings?.floorToFloorHeightFeet, 10));
    rooms = tower.rooms;
    staircase = tower.stair;
    warnings.push('Tower/Mumty is planned as dynamic open terrace plus vertical stair headroom core; final authority/structural checks remain required.');
  } else {
    if (typeof console !== 'undefined') console.log('[PLANNING ENGINE] GENERATE FLOOR', { floorName, width: clearW, length: clearL, planningArea: request.planningArea, mode: request.planningMode, selectedRooms: request.selectedRooms });
    const smart = generateArchitecturalFloorPlan({
      floorName,
      width: clearW,
      length: clearL,
      bhk: request.bhk || 'AUTO',
      selectedRooms: normalizeSelectedRooms(request.selectedRooms),
      planningMode: request.planningMode || 'AUTO',
      roadSide: request.roadSide,
      hasParking: request.hasParking !== false,
      floorToFloorHeightFeet: num(request.planningSettings?.floorToFloorHeightFeet, 10),
      planningArea: num((request as any).planningArea, clearW * clearL),
    });
    rooms = smart.rooms;
    warnings.push(...smart.warnings);
    errors.push(...smart.errors);
    staircase = smart.staircase;
    furnitureChecks = smart.furnitureChecks;
    if (typeof console !== 'undefined') console.log('[PLANNING ENGINE] FLOOR RESULT', { floorName, rooms: smart.rooms.map((r: any) => ({ name: r.name, x: r.x, y: r.y, w: r.w, h: r.h })), errors: smart.errors, warnings: smart.warnings, stair: smart.staircase });
  }

  rooms = rooms.map((r, i) => ({
    ...r,
    id: r.id || `room_${i}`,
    x: Number(Math.max(0, Math.min(num(r.x), clearW - .01)).toFixed(3)),
    y: Number(Math.max(0, Math.min(num(r.y), clearL - .01)).toFixed(3)),
    w: Number(Math.max(.1, Math.min(num(r.w), clearW - num(r.x))).toFixed(3)),
    h: Number(Math.max(.1, Math.min(num(r.h), clearL - num(r.y))).toFixed(3)),
    areaPerRoom: Number((Math.max(.1, num(r.w)) * Math.max(.1, num(r.h))).toFixed(2)),
  }));

  // Remove duplicate terrace room if a separate tower core exists in its footprint. This is a visual overlay.
  if (isTower) rooms = rooms.filter((r, i) => i === 0 || typeOf(r) === 'stairs');

  const opened = generateFloorOpenings(rooms as any, orientation.mainRoad, clearW, clearL) as any[];
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

  const walls = generateWallsFromRooms(blueprintRooms, clearW, clearL);
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
    clearWidth: Number(clearW.toFixed(2)), clearLength: Number(clearL.toFixed(2)),
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

export function generateCompleteConstructionPlan(payload: any): GeneratedConstructionPlan {
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
  const selectedFloors: string[] = (payload?.selectedFloors || payload?.selected_floors || Object.keys(payload?.floorData || {})).map(cleanFloorName).filter((v: string, i: number, arr: string[]) => v && arr.indexOf(v) === i);
  if (!selectedFloors.length) selectedFloors.push('GROUND FLOOR');
  const floorDataInput = payload?.floorData || payload?.floor_details || {};
  const floorRoomsInput = payload?.floorRooms || payload?.room_details || {};
  const floorBhk = payload?.floorBhkConfig || {};
  const settings = payload?.floorSettings || payload?.floor_settings || {};
  const orientation = getRoadOrientation(payload?.roadFacingOption || payload?.road_side || '1 SIDE ROAD (SOUTH)');

  const floors: Record<string, GeneratedFloorPlan> = {};
  const generatedFloorData: Record<string, any> = {};
  const generatedFloorRooms: Record<string, FloorRoom[]> = {};
  for (const floorName of selectedFloors) {
    const input = floorDataInput[floorName] || floorDataInput[floorName.toUpperCase()] || {};
    const width = Math.max(1, num(input.width, maxFootprint.width));
    const length = Math.max(1, num(input.length, maxFootprint.length));
    const plan = generateDynamicFloorPlan({
      floorName, width, length,
      bhk: floorBhk[floorName] || 'AUTO',
      selectedRooms: floorRoomsInput[floorName] ?? floorRoomsInput[floorName.toUpperCase()],
      planningMode: payload?.planningMode || 'AUTO',
      planningSettings: settings[floorName] || {},
      roadSide: payload?.roadFacingOption || payload?.road_side || '1 SIDE ROAD (SOUTH)',
      hasParking: floorName.includes('GROUND'),
      planningArea: Math.max(1, num(input.area, width * length)),
    }, maxFootprint);
    floors[floorName] = plan;
    if (typeof console !== 'undefined') console.log('[PLANNING ENGINE] FLOOR FINAL', { floor: floorName, roomCount: plan.rooms.length, errors: plan.errors, warnings: plan.warnings, connectivity: plan.connectivity });
    generatedFloorRooms[floorName] = plan.rooms;
    generatedFloorData[floorName] = {
      width: plan.width, length: plan.length, clearWidth: plan.clearWidth, clearLength: plan.clearLength,
      area: plan.area, outerArea: plan.outerArea, buildableArea: plan.buildableArea,
      originX: plan.originX, originY: plan.originY, rooms: plan.rooms, walls: plan.walls, columns: plan.columns,
      openings: plan.openings, staircase: plan.staircase, staircaseConfig: plan.staircase,
      connectivity: plan.connectivity, orientation: plan.orientation,
      planningScore: plan.planningScore, furnitureChecks: plan.furnitureChecks,
      validation: { errors: plan.errors, warnings: plan.warnings, isValid: plan.errors.length === 0 },
      requestedProgram: (plan as any).requestedProgram || plan.rooms.map((r: any) => r.name),
    };
  }
  // Vertical stair-core coordination: when floor footprints permit it, every upper
  // floor reuses the ground-floor stair footprint so the section/elevation has one
  // continuous vertical circulation line instead of independently drifting stairs.
  const groundKey = selectedFloors.find(f => f.includes('GROUND'));
  const groundStair = groundKey ? floors[groundKey]?.rooms.find((r: any) => String(r.name || '').toUpperCase() === 'STAIRCASE') : null;
  if (groundStair) {
    for (const floorName of selectedFloors) {
      if (floorName === groundKey || floorName.includes('TOWER') || floorName.includes('MUMTY')) continue;
      const plan = floors[floorName];
      const stair = plan?.rooms.find((r: any) => String(r.name || '').toUpperCase() === 'STAIRCASE') as any;
      if (!stair) continue;
      const fits = groundStair.x! + groundStair.w! <= plan.clearWidth + 0.01 && groundStair.y! + groundStair.h! <= plan.clearLength + 0.01;
      if (fits) {
        stair.x = groundStair.x; stair.y = groundStair.y;
        stair.w = groundStair.w; stair.h = groundStair.h;
        stair.staircaseType = (groundStair as any).staircaseType;
        stair.staircaseSpec = (groundStair as any).staircaseSpec;
        plan.staircase = floors[groundKey]?.staircase || plan.staircase;
        plan.warnings.push(`${floorName}: stair core aligned to GROUND FLOOR vertical stair position.`);
        generatedFloorRooms[floorName] = plan.rooms;
        generatedFloorData[floorName].rooms = plan.rooms;
        generatedFloorData[floorName].staircase = plan.staircase;
        generatedFloorData[floorName].staircaseConfig = plan.staircase;
      } else {
        plan.warnings.push(`${floorName}: ground-floor stair core could not be reused because the upper floor footprint is smaller.`);
      }
    }
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
      console.log(floorName, { rooms: p?.rooms?.map((r: any) => `${r.name} ${Number(r.w || 0).toFixed(2)}x${Number(r.h || 0).toFixed(2)} @ ${Number(r.x || 0).toFixed(2)},${Number(r.y || 0).toFixed(2)}`), errors: p?.errors, warnings: p?.warnings, stair: p?.staircase });
    }
    console.groupEnd();
  }

  const elevation = calculateElevationProfile(selectedFloors, num(payload?.floorToFloorHeightFeet, 10));
  const section = calculateSectionProfile(selectedFloors, num(payload?.floorToFloorHeightFeet, 10));
  return { plotGeometry, setbackRules: setbacks, buildableGeometry, plotArea: plotGeometry.area, selectedFloors, floors, floorData: generatedFloorData, floorRooms: generatedFloorRooms, elevation, section, orientation, generatedAt: new Date().toISOString() };
}

export function generateAutoRoomsForFloor(buildW: number, buildL: number, facing = '1 SIDE ROAD (SOUTH)', bhkConfig = 'AUTO', userRooms: any = [], setbacks: any = { front:0, rear:0,left:0,right:0 }) {
  return generateDynamicFloorPlan({ floorName: 'GROUND FLOOR', width: buildW, length: buildL, bhk: bhkConfig, selectedRooms: userRooms, planningMode: 'AUTO', roadSide: facing, hasParking: true, planningArea: buildW * buildL }, { width: Math.max(.1,num(buildW)), length: Math.max(.1,num(buildL)), originX:num(setbacks.left), originY:num(setbacks.front) }).rooms;
}
