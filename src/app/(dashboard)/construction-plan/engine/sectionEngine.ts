/* =========================================================
   SECTION + ELEVATION ENGINE  (pure geometry, no React)
   ---------------------------------------------------------
   Everything is derived from the SAME rooms/doors/windows/stairs
   that the floor plans draw (normalizeRoomList is shared).

   Units: feet.
   Plan frame : x -> right, y -> down (FRONT of building = bottom).
   Inner frame: origin at inside face of the 4" outer wall.
   Outer frame: inner + WALL_T (what the section/elevation is drawn in).
   Vertical axis z: 0 = ground-floor FFL (plinth top). GL = -plinthFt.
   ========================================================= */
import { normalizeRoomList } from "./normalizeRooms";
import { calculateStaircase, solveStairDrawPlan, StairDrawPlan, StaircaseFootprint } from "./stairPlanner";
import type { StairFace } from "./stairFaceDecision";

export const WALL_T = 4 / 12;           // external AND internal wall thickness (matches plan)
export const SLAB_DEFAULT = 0.5;
export const PARAPET_FT = 3;
export const TOWER_FT = 8;

export type CutAxis = "VERTICAL" | "HORIZONTAL" | "AUTO";   // VERTICAL = cut line runs top->bottom on plan, AUTO = along the stair run
export type SectionLook = "LEFT" | "RIGHT" | "UP" | "DOWN";
export type ElevationSide = "FRONT" | "REAR" | "LEFT" | "RIGHT";

export interface SectionCutDef {
  id: string;
  axis: CutAxis;
  positionFt: number | "AUTO";   // from outer LEFT (vertical cut) / outer TOP (horizontal cut)
  look: SectionLook;
  color?: string;
}

export const SECTION_COLORS = ["#16a34a", "#dc2626", "#2563eb", "#d97706", "#7c3aed"];
export const DEFAULT_SECTION_CUTS: SectionCutDef[] = [
  { id: "A", axis: "VERTICAL", positionFt: "AUTO", look: "LEFT", color: SECTION_COLORS[0] },     // lambi (longitudinal) section: stair ke through
  { id: "B", axis: "HORIZONTAL", positionFt: "AUTO", look: "UP", color: SECTION_COLORS[1] },     // aadhi (transverse) section: stair ke across
];

export const normalizeLook = (axis: CutAxis, look: SectionLook): SectionLook =>
  axis === "VERTICAL" ? (look === "RIGHT" || look === "DOWN" ? "RIGHT" : "LEFT")
  : axis === "HORIZONTAL" ? (look === "DOWN" || look === "RIGHT" ? "DOWN" : "UP")
  : look;

/* ---------------- helpers ---------------- */
const up = (s: any) => String(s ?? "").toUpperCase();
const num = (v: any, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const normKey = (n: string) => up(n).split("(")[0].trim();
const isStairRoom = (r: any) => r?.type === "stairs" || up(r?.name).includes("STAIR");
const lookup = (obj: any, name: string) => {
  if (!obj) return undefined;
  if (obj[name] !== undefined) return obj[name];
  const k = Object.keys(obj).find((x) => normKey(x) === normKey(name));
  return k ? obj[k] : undefined;
};
const toArr = (v: any): any[] => (!v ? [] : Array.isArray(v) ? v : Object.values(v));

/* ---------------- context ---------------- */
export interface StairCtx {
  x: number; y: number; w: number; h: number;     // stair rect, inner frame (same as plan: living.x + relX ...)
  face: StairFace;                                 // entry face (building level decision, same as plan view)
  plan: StairDrawPlan;                             // EXACT draw plan the plan view uses (treads, landings, flights)
}
export interface FloorCtx {
  name: string; isTower: boolean; heightFt: number; slabFt: number;
  rooms: any[]; outerW: number; outerL: number; innerW: number; innerL: number;
  stairs: StairCtx[];
}
export interface SectionContext {
  floors: FloorCtx[]; main: FloorCtx[]; tower?: FloorCtx;
  towerBox?: { x: number; y: number; w: number; h: number };   // inner frame of tower floor
  outerW: number; outerL: number;
  plinthFt: number; parapetFt: number; towerHeightFt: number;
}

/** Same stair-plan resolution the plan view does (pre-solved drawPlan if it fits, else re-solve). */
function resolveStairPlan(es: any, face: StairFace, stairFloorHeightFt: number): StairDrawPlan | null {
  try {
    const given: any = es.staircaseSpec || {};
    const rotated = face === "LEFT" || face === "RIGHT";
    const wFt = es.w, hFt = es.h;
    const fits = (p: StairDrawPlan | undefined, rot: boolean) =>
      !!p && p.shortTreads === 0 && p.usedCrossFt <= (rot ? hFt : wFt) + 0.05 && p.usedRunFt <= (rot ? wFt : hFt) + 0.05;
    const pre: StairDrawPlan | undefined = given.drawPlan ?? es.renderHints?.drawPlan;
    if (fits(pre, rotated)) return pre as StairDrawPlan;
    const crossBox = rotated ? hFt : wFt, runBox = rotated ? wFt : hFt;
    const usable = Number(given.riserCount) > 0 && Number(given.flightWidthFt) > 0 && given.flight1 && given.flight2;
    const fh = Number(given.floorToFloorHeight || given.floorToFloorHeightFeet || given.floorHeightFt || given.floorHeightFeet) || stairFloorHeightFt || 10;
    const base: StaircaseFootprint = usable ? (given as StaircaseFootprint) : calculateStaircase(fh, crossBox, runBox, "DOG_LEGGED");
    return solveStairDrawPlan(base, crossBox, runBox).plan;
  } catch {
    return null;
  }
}

export interface BuildCtxOpts { stairFace?: StairFace | null; stairFloorHeightFt?: number }

export function buildSectionContext(
  processedFloors: string[], floorData: Record<string, any>, floorRooms: Record<string, any>,
  baseOuterW: number, baseOuterL: number, opts: BuildCtxOpts = {}
): SectionContext {
  const floors: FloorCtx[] = [];
  processedFloors.forEach((name) => {
    if (up(name).includes("BASEMENT")) return;
    const info: any = lookup(floorData, name) || {};
    const isTower = up(name).includes("TOWER") || up(name).includes("MUMTY");
    const outerW = num(info.width, baseOuterW);
    const outerL = num(info.length, baseOuterL);
    const cw = Number(info.clearWidth), cl = Number(info.clearLength);
    const innerW = Math.max(3.5, cw > 0 ? cw : outerW - 2 * WALL_T);
    const innerL = Math.max(6, cl > 0 ? cl : outerL - 2 * WALL_T);

    // SAME priority as the plan view: floorData[floor].rooms first, then floorRooms
    let entries: any[] = toArr(info.rooms);
    if (entries.length === 0) entries = toArr(lookup(floorRooms, name));
    const raw = entries.map((r: any) => ({
      ...r,
      name: r.name || r.label || r.roomType || "ROOM",
      x: Math.max(0, Number(r.x ?? r.relX ?? 0)), y: Math.max(0, Number(r.y ?? r.relY ?? 0)),
      w: Math.max(0.1, Math.min(Number(r.w ?? innerW), innerW)), h: Math.max(0.1, Math.min(Number(r.h ?? innerL), innerL)),
      type: r.type || r.roomType || "room",
    }));
    const rooms = normalizeRoomList(raw, innerW, innerL);

    const heightFt = num(info.floorToFloorHeightFeet ?? info.planningSettings?.floorToFloorHeightFeet ?? info.settings?.floorToFloorHeightFeet, 10);
    const slabIn = Number(info.slabThicknessInch), slabFeet = Number(info.slabThicknessFeet);
    const slabFt = slabIn > 0 ? slabIn / 12 : slabFeet > 0 ? slabFeet : SLAB_DEFAULT;

    const stairs: StairCtx[] = [];
    if (!isTower) {
      rooms.forEach((r: any) => {
        const es = r.embeddedStair;
        if (!es || !(es.w > 0) || !(es.h > 0)) return;
        const faceIn = up(es.entryFace);
        const face = (opts.stairFace || (["BOTTOM", "TOP", "LEFT", "RIGHT"].includes(faceIn) ? faceIn : "BOTTOM")) as StairFace;
        const sx = r.x + (es.relX !== undefined ? es.relX : es.x || 0);
        const sy = r.y + (es.relY !== undefined ? es.relY : es.y || 0);
        const plan = resolveStairPlan({ ...es, w: es.w, h: es.h }, face, opts.stairFloorHeightFt || heightFt);
        if (plan) stairs.push({ x: sx, y: sy, w: es.w, h: es.h, face, plan });
      });
    }
    floors.push({ name, isTower, heightFt, slabFt, rooms, outerW, outerL, innerW, innerL, stairs });
  });

  const main = floors.filter((f) => !f.isTower);
  const tower = floors.find((f) => f.isTower);
  const first: any = main[0] ? lookup(floorData, main[0].name) || {} : {};
  const plinthFt = num(first.plinthHeightFeet ?? first.planningSettings?.plinthHeightFeet ?? first.settings?.plinthHeightFeet, 1.5);

  let towerBox: SectionContext["towerBox"];
  if (tower && tower.rooms.length) {
    const x0 = Math.min(...tower.rooms.map((r: any) => r.x)), y0 = Math.min(...tower.rooms.map((r: any) => r.y));
    const x1 = Math.max(...tower.rooms.map((r: any) => r.x + r.w)), y1 = Math.max(...tower.rooms.map((r: any) => r.y + r.h));
    towerBox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };       // stair core + optional tower room
  }
  const anyInfo: any = Object.values(floorData || {}).find((i: any) => Number(i?.parapetHeightFeet) > 0) || {};
  const towerInfo: any = tower ? lookup(floorData, tower.name) || {} : {};
  const parapetFt = num(anyInfo.parapetHeightFeet, PARAPET_FT);
  const towerHeightFt = num(towerInfo.towerHeightFeet, TOWER_FT);
  return {
    floors, main, tower, towerBox,
    outerW: Math.max(baseOuterW, ...main.map((f) => f.outerW)),
    outerL: Math.max(baseOuterL, ...main.map((f) => f.outerL)),
    plinthFt, parapetFt, towerHeightFt,
  };
}

/** AUTO axis -> concrete axis (cut ALONG the stair run so the flight profile is visible, like an architect would). */
export function resolveCut(cut: SectionCutDef, ctx: SectionContext): SectionCutDef & { axis: "VERTICAL" | "HORIZONTAL" } {
  let axis = cut.axis;
  if (axis === "AUTO") {
    const st = ctx.main.flatMap((f) => f.stairs)[0];
    axis = !st || st.face === "BOTTOM" || st.face === "TOP" ? "VERTICAL" : "HORIZONTAL";
  }
  return { ...cut, axis: axis as "VERTICAL" | "HORIZONTAL", look: normalizeLook(axis, cut.look) };
}

/* ---------------- levels ---------------- */
export interface LevelFloor { name: string; ffl: number; clearTop: number; slabTop: number; heightFt: number; slabFt: number }
export interface Levels {
  plinthFt: number; floors: LevelFloor[]; roofSlabTop: number; parapetTop: number;
  towerHeightFt: number; towerTop?: number;
}
export function buildLevels(ctx: SectionContext): Levels {
  let z = 0;
  const floors = ctx.main.map((f) => {
    const lf = { name: f.name, ffl: z, clearTop: z + f.heightFt, slabTop: z + f.heightFt + f.slabFt, heightFt: f.heightFt, slabFt: f.slabFt };
    z = lf.slabTop;
    return lf;
  });
  return {
    plinthFt: ctx.plinthFt, floors, roofSlabTop: z, parapetTop: z + ctx.parapetFt,
    towerHeightFt: ctx.towerHeightFt,
    towerTop: ctx.tower ? z + ctx.towerHeightFt + SLAB_DEFAULT : undefined,
  };
}

/* ---------------- openings ---------------- */
const GATE_GAP = 0.5;
const isGate = (d: any) => {
  const id = up(d?.id).toLowerCase(), role = up(d?.entryRole).toLowerCase();
  return (id.includes("parking") && id.includes("gate")) || role.includes("main_road_vehicle_gate");
};
// identical rule to the plan: parking gate is centred in its wall
function span(o: any, wallLen: number) {
  const w0 = Math.max(0, Number(o?.widthFeet ?? o?.lengthFeet ?? 0));
  const off0 = Math.max(0, Number(o?.offsetFeet || 0));
  if (!isGate(o) || wallLen <= 0) return { off: off0, w: w0 || 3 };
  const w = Math.max(2.5, Math.min(w0 || wallLen, wallLen - 2 * GATE_GAP));
  return { off: Math.max(GATE_GAP, (wallLen - w) / 2), w };
}
const isVent = (w: any) => up(w?.windowType ?? w?.type).includes("VENT");
function doorZ(d: any, clearH: number): [number, number] {
  return [0, Math.min(num(d.heightFeet, isGate(d) ? 6.5 : 7), clearH - 0.2)];
}
function winZ(w: any, clearH: number): [number, number] {
  const vent = isVent(w);
  const sill = Number.isFinite(Number(w.sillFeet)) && w.sillFeet !== undefined ? Number(w.sillFeet) : vent ? 6.5 : 3;
  const h = num(w.heightFeet, vent ? 1.5 : 4);
  const top = Math.min(sill + h, clearH - 0.3);
  return [Math.min(sill, top - 0.5), top];
}

/* ---------------- section model ---------------- */
export interface WallGap { kind: "D" | "W"; z0: number; z1: number }
export interface WallCut { v0: number; v1: number; kind: "E" | "I"; gaps: WallGap[] }
export interface FaceOpening { kind: "D" | "W" | "V"; a0: number; a1: number; z0: number; z1: number }
export interface Face { v0: number; v1: number; roomName: string; openings: FaceOpening[] }
export interface SecPoly { kind: "POCHE" | "LINE"; pts: [number, number][] }   // [v, z] absolute
export interface SecStair {
  relation: "CUT" | "BEYOND"; polys: SecPoly[];
  label: string;                         // "17 R @ 7.4\"" ('' when there is nothing to write)
  labelAt?: [number, number];            // [v, z] where the label sits
  anchor?: [number, number];             // kept for the older SectionDrawing.tsx
  mode?: "RUN" | "CROSS";                // kept for the older SectionDrawing.tsx
}
export interface SectionFloor {
  name: string; ffl: number; clearTop: number; slabTop: number; heightFt: number; slabFt: number;
  outerLen: number; walls: WallCut[]; faces: Face[]; stairs: SecStair[];
  rooms: { name: string; v0: number; v1: number }[]; holes: [number, number][];
}
export interface SectionModel {
  cut: SectionCutDef; title: string; lengthV: number; positionOuterFt: number; nudged: boolean; flip: boolean;
  floors: SectionFloor[]; tower?: { v0: number; v1: number; relation: "CUT" | "BEYOND"; heightFt: number };
}

// room extents along (v = along drawing, u = across cut line)
const ext = (r: any, axis: CutAxis) =>
  axis === "VERTICAL"
    ? { v0: r.y, v1: r.y + r.h, u0: r.x, u1: r.x + r.w }
    : { v0: r.x, v1: r.x + r.w, u0: r.y, u1: r.y + r.h };

/** stair local frame (x = cross, y = run, far end y=0)  ->  plan frame (inner). IDENTICAL to plan view's toWorld(). */
export function stairToPlan(st: StairCtx, lx: number, ly: number): [number, number] {
  const cross = st.plan.usedCrossFt, run = st.plan.usedRunFt;
  switch (st.face) {
    case "TOP": return [st.x + cross - lx, st.y + run - ly];
    case "LEFT": return [st.x + run - ly, st.y + lx];
    case "RIGHT": return [st.x + ly, st.y + lx];
    default: return [st.x + lx, st.y + ly];
  }
}

/** kitne door / window us u-position par cut walls me aate hain (AUTO cut ko opening dikhane ke liye) */
function openingsAtU(ctx: SectionContext, axis: CutAxis, u: number): number {
  const vertical = axis === "VERTICAL";
  const cutWalls = vertical ? ["TOP", "BOTTOM"] : ["LEFT", "RIGHT"];
  let n = 0;
  ctx.main.forEach((f) => f.rooms.forEach((r: any) => {
    if (isStairRoom(r)) return;
    const e = ext(r, axis);
    if (!(u > e.u0 + 0.01 && u < e.u1 - 0.01)) return;
    [...(r.doors || []), ...(r.windows || [])].forEach((o: any) => {
      if (!cutWalls.includes(o.wall)) return;
      const sp = span(o, vertical ? r.w : r.h);
      const a0 = e.u0 + sp.off;
      if (u >= a0 - 0.05 && u <= a0 + sp.w + 0.05) n++;
    });
  }));
  return n;
}

export function resolveCutPositionFt(cutIn: SectionCutDef, ctx: SectionContext) {
  const cut = resolveCut(cutIn, ctx);
  const vertical = cut.axis === "VERTICAL";
  const lookNeg = cut.look === "LEFT" || cut.look === "UP";
  let posInner: number;
  if (cut.positionFt === "AUTO") {
    const st = ctx.main.flatMap((f) => f.stairs)[0];
    if (st) {
      const P = st.plan, fw = P.flightWidthFt, x2 = Math.max(fw, P.usedCrossFt - fw);
      const U = (lx: number, ly: number) => { const q = stairToPlan(st, lx, ly); return vertical ? q[0] : q[1]; };
      const dependsOnCross = Math.abs(U(1, 0) - U(0, 0)) > 0.5;
      if (dependsOnCross) {
        // cut runs ALONG the flights: pick the flight so the OTHER flight is visible beyond the cut plane
        const c1 = U(fw / 2, 0), c2 = U(x2 + fw / 2, 0);
        const centre = lookNeg ? Math.max(c1, c2) : Math.min(c1, c2);
        // flight width ke andar wo position chuno jahan section zyada door / window se guzre (architect: opening dikhna chahiye)
        const reach = Math.max(0, fw / 2 - 0.4);
        let bestU = centre, bestScore = openingsAtU(ctx, cut.axis, centre);
        for (let k = -reach; k <= reach + 1e-6; k += 0.25) {
          const cand = centre + k, sc = openingsAtU(ctx, cut.axis, cand);
          if (sc > bestScore + 0.01 || (Math.abs(sc - bestScore) < 0.01 && Math.abs(k) < Math.abs(bestU - centre) - 1e-6)) { bestScore = sc; bestU = cand; }
        }
        posInner = bestU;
      } else {
        // cut runs ACROSS the flights: go through the middle of a tread (never on a nosing line)
        const d = P.flight1.depthsIn.map((x) => x / 12);
        const k = Math.floor(d.length / 2);
        const before = d.slice(0, k).reduce((a, b) => a + b, 0);
        posInner = U(0, fw + before + (d[k] || 0.9) / 2);
      }
    } else posInner = (vertical ? ctx.outerW : ctx.outerL) / 2 - WALL_T;
  } else posInner = Number(cut.positionFt) - WALL_T;

  const lim = (vertical ? ctx.outerW : ctx.outerL) - 2 * WALL_T;
  posInner = Math.max(0.1, Math.min(lim - 0.1, posInner));

  // never let the cut ride exactly inside a wall that runs parallel to it
  let nudged = false;
  const bad = (p: number) => ctx.main.some((f) => f.rooms.some((r: any) => {
    const e = ext(r, cut.axis); return Math.abs(p - e.u0) < 0.2 || Math.abs(p - e.u1) < 0.2;
  })) || p < 0.2 || p > lim - 0.2;
  if (cut.positionFt !== "AUTO" && bad(posInner)) {
    for (const d of [0.4, -0.4, 0.8, -0.8]) if (!bad(posInner + d)) { posInner += d; nudged = true; break; }
  }
  return { posInner, posOuter: posInner + WALL_T, nudged };
}

type Pt = [number, number];

interface StairEl { idx: number; landing: boolean; runAxis: "x" | "y" | null; x0: number; x1: number; y0: number; y1: number; z: number }

/** Every tread / landing of the plan's stair as a rectangle (plan frame) + the level of its top surface. */
function stairElements(st: StairCtx, ffl: number, totalRise: number): { els: StairEl[]; rise: number; well: { x0: number; x1: number; y0: number; y1: number } } {
  const P = st.plan, fw = P.flightWidthFt, cross = P.usedCrossFt;
  const x2 = Math.max(fw, cross - fw);
  const f1 = P.flight1.depthsIn.map((d) => d / 12), f2 = P.flight2.depthsIn.map((d) => d / 12), mid = P.middle.depthsIn.map((d) => d / 12);
  const N = f1.length + 1 + mid.length + 1 + f2.length;      // treads incl. the two landings
  const rise = totalRise / (N + 1);
  const rect = (lx0: number, lx1: number, ly0: number, ly1: number) => {
    const a = stairToPlan(st, lx0, ly0), b = stairToPlan(st, lx1, ly1);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) };
  };
  const els: StairEl[] = [];
  let idx = 0;
  const flightAxis: "x" | "y" = st.face === "BOTTOM" || st.face === "TOP" ? "y" : "x";     // plan axis of the run (local y)
  const midAxis: "x" | "y" = flightAxis === "y" ? "x" : "y";
  const push = (landing: boolean, lx0: number, lx1: number, ly0: number, ly1: number, axis: "x" | "y" | null) => {
    idx++; els.push({ idx, landing, runAxis: axis, ...rect(lx0, lx1, ly0, ly1), z: ffl + idx * rise });
  };
  const cum = (a: number[]) => { const c = [0]; a.forEach((d) => c.push(c[c.length - 1] + d)); return c; };
  const c1 = cum(f1), c2 = cum(f2), cm = cum(mid);
  for (let k = f1.length - 1; k >= 0; k--) push(false, 0, fw, fw + c1[k], fw + c1[k + 1], flightAxis);        // flight-1: entry -> landing-1
  push(true, 0, fw, 0, fw, null);                                                                 // landing-1
  for (let j = 0; j < mid.length; j++) push(false, fw + cm[j], fw + cm[j + 1], 0, fw, midAxis);           // middle treads
  push(true, x2, x2 + fw, 0, fw, null);                                                           // landing-2
  for (let k = 0; k < f2.length; k++) push(false, x2, x2 + fw, fw + c2[k], fw + c2[k + 1], flightAxis);       // flight-2: landing-2 -> top
  const runMax = Math.max(P.flight1.runFt, P.flight2.runFt, c1[c1.length - 1], c2[c2.length - 1]);
  return { els, rise, well: rect(0, cross, fw, fw + runMax) };
}

const WAIST = 0.5;       // flight soffit thickness (vertical, ft)
const LANDING_T = 0.5;

/** consecutive elements -> poche / line polygons (stepped top, sloping soffit). */
function polysFor(group: { vA: number; vB: number; z: number; landing: boolean }[], rise: number, kind: "POCHE" | "LINE"): SecPoly[] {
  const out: SecPoly[] = [];
  let run: typeof group = [];
  const flush = () => {
    if (!run.length) return;
    if (run.length === 1) {
      const e = run[0];
      out.push({ kind, pts: [[e.vA, e.z - LANDING_T], [e.vB, e.z - LANDING_T], [e.vB, e.z], [e.vA, e.z]] });
    } else {
      const first = run[0], last = run[run.length - 1];
      const zFloor = first.z - rise;
      const pts: Pt[] = [[first.vA, zFloor]];
      run.forEach((e) => { pts.push([e.vA, e.z], [e.vB, e.z]); });
      const m = (last.z - first.z) / (last.vA - first.vA || 1e-6);            // dz / dv along the pitch line
      const lineAt = (v: number) => zFloor + m * (v - first.vA);
      pts.push([last.vB, lineAt(last.vB) - WAIST]);
      pts.push([first.vA + WAIST / (m || 1e-6), zFloor]);
      out.push({ kind, pts });
    }
    run = [];
  };
  group.forEach((e) => {
    if (e.landing) { flush(); run = [e]; flush(); } else run.push(e);
  });
  flush();
  return out;
}

function stairSection(
  st: StairCtx, f: FloorCtx, ffl: number, axis: CutAxis, u: number, lookNeg: boolean
): { stairs: SecStair[]; hole?: [number, number] } {
  const vertical = axis === "VERTICAL";
  const total = f.heightFt + f.slabFt;
  const { els, rise, well } = stairElements(st, ffl, total);
  type R4 = { x0: number; x1: number; y0: number; y1: number };
  const uR = (e: R4) => (vertical ? [e.x0, e.x1] : [e.y0, e.y1]);
  const vR = (e: R4) => (vertical ? [e.y0, e.y1] : [e.x0, e.x1]);
  // half-open [a,b)  ->  every u belongs to exactly ONE tread (no gaps at tread boundaries)
  const isCut = (e: R4) => u >= uR(e)[0] - 1e-9 && u < uR(e)[1] - 1e-9;
  const isBeyond = (e: R4) => !isCut(e) && (lookNeg ? uR(e)[1] <= u + 1e-9 : uR(e)[0] >= u - 1e-9);
  const runAlongV = (e: StairEl) => e.runAxis === (vertical ? "y" : "x");
  const cls = (e: StairEl) => (e.landing ? "L" : runAlongV(e) ? "P" : "E");
  const uc = (e: R4) => (uR(e)[0] + uR(e)[1]) / 2;
  const vOf = (e: R4) => [vR(e)[0] + WALL_T, vR(e)[1] + WALL_T] as [number, number];

  const build = (sel: (e: StairEl) => boolean, kind: "POCHE" | "LINE"): SecPoly[] => {
    const polys: SecPoly[] = [];
    let cur: StairEl[] = [];
    const emit = () => {
      if (!cur.length) return;
      const c = cls(cur[0]);
      if (c === "P" || c === "L") {
        const cv = (e: StairEl) => (vR(e)[0] + vR(e)[1]) / 2;
        const dir = cur.length > 1 ? Math.sign(cv(cur[cur.length - 1]) - cv(cur[0])) : 1;
        const g = cur.map((e) => {
          const [a, b] = vOf(e);
          return dir >= 0 ? { vA: a, vB: b, z: e.z, landing: e.landing } : { vA: b, vB: a, z: e.z, landing: e.landing };
        });
        polys.push(...polysFor(g, rise, kind));
      } else if (kind === "POCHE") {
        // flight running ACROSS the cut plane -> plain cross-section of the flight (rect between soffit and tread)
        cur.forEach((e) => {
          const prev = els[e.idx - 2], next = els[e.idx];
          const sgn = next && !next.landing ? Math.sign(uc(next) - uc(e)) : prev && !prev.landing ? Math.sign(uc(e) - uc(prev)) : 1;
          let t = (u - uR(e)[0]) / Math.max(1e-6, uR(e)[1] - uR(e)[0]);
          t = Math.min(1, Math.max(0, sgn >= 0 ? t : 1 - t));
          const [a, b] = vOf(e);
          const zs = e.z - rise + t * rise - WAIST;
          polys.push({ kind, pts: [[a, zs], [b, zs], [b, e.z], [a, e.z]] });
        });
      } else {
        // seen end-on from the cut: one outline + a line at every tread level
        const a = Math.min(...cur.map((e) => vOf(e)[0])), b = Math.max(...cur.map((e) => vOf(e)[1]));
        const zLo = Math.min(...cur.map((e) => e.z)) - rise, zHi = Math.max(...cur.map((e) => e.z));
        polys.push({ kind, pts: [[a, zLo], [b, zLo], [b, zHi], [a, zHi]] });
        cur.forEach((e) => polys.push({ kind, pts: [[a, e.z], [b, e.z]] }));
      }
      cur = [];
    };
    els.forEach((e) => {
      if (sel(e)) {
        if (cur.length && (cur[cur.length - 1].idx !== e.idx - 1 || cls(cur[0]) !== cls(e) || cls(e) === "L")) emit();
        cur.push(e);
      } else emit();
    });
    emit();
    return polys;
  };

  const result: SecStair[] = [];
  const cutEls = els.filter(isCut);
  const R = st.plan.riserCount;
  const label = `${R} R @ ${((total * 12) / Math.max(1, R)).toFixed(1)}"`;
  if (cutEls.length) {
    const flights = cutEls.filter((e) => !e.landing);
    const mid = flights.length ? flights[Math.floor(flights.length / 2)] : cutEls[0];
    const [la, lb] = vOf(mid);
    const endOn = cls(mid) === "E";           // flight runs across the cut plane -> label would sit on the poche, skip it
    result.push({ relation: "CUT", polys: build(isCut, "POCHE"), label: endOn ? "" : label, labelAt: endOn ? undefined : [(la + lb) / 2, mid.z] });
  }
  const beyondPolys = build(isBeyond, "LINE");
  if (beyondPolys.length) result.push({ relation: "BEYOND", polys: beyondPolys, label: "" });

  let hole: [number, number] | undefined;
  if (u >= uR(well)[0] && u < uR(well)[1]) hole = [vR(well)[0] + WALL_T, vR(well)[1] + WALL_T];
  return { stairs: result, hole };
}

export function buildSectionModel(ctx: SectionContext, cutIn: SectionCutDef): SectionModel {
  const cut: SectionCutDef = resolveCut(cutIn, ctx);
  const vertical = cut.axis === "VERTICAL";
  const lv = buildLevels(ctx);
  const pos = resolveCutPositionFt(cut, ctx);
  const u = pos.posInner;
  const flip = cut.look === "LEFT" || cut.look === "DOWN";
  const cutWalls = vertical ? ["TOP", "BOTTOM"] : ["LEFT", "RIGHT"];
  const lookWall = cut.look === "LEFT" ? "LEFT" : cut.look === "RIGHT" ? "RIGHT" : cut.look === "UP" ? "TOP" : "BOTTOM";
  const oppWall = ({ LEFT: "RIGHT", RIGHT: "LEFT", TOP: "BOTTOM", BOTTOM: "TOP" } as any)[lookWall] as string;
  const lookNeg = cut.look === "LEFT" || cut.look === "UP";            // looking toward smaller u
  const lengthV = vertical ? ctx.outerL : ctx.outerW;

  const floors: SectionFloor[] = ctx.main.map((f, fi) => {
    const L = lv.floors[fi];
    const innerV = vertical ? f.innerL : f.innerW;
    const outerV = vertical ? f.outerL : f.outerW;
    const rooms = f.rooms.filter((r: any) => !isStairRoom(r));
    const hit = rooms.filter((r: any) => { const e = ext(r, cut.axis); return u > e.u0 + 0.01 && u < e.u1 - 0.01; });

    // ---- cut walls: external at both frame edges + every room boundary the cut crosses
    const bounds: { b: number; gaps: WallGap[] }[] = [{ b: 0, gaps: [] }, { b: innerV, gaps: [] }];
    const near = (b: number) => bounds.find((x) => Math.abs(x.b - b) < 0.3);
    hit.forEach((r: any) => {
      const e = ext(r, cut.axis);
      [e.v0, e.v1].forEach((b) => { if (!near(b)) bounds.push({ b, gaps: [] }); });
    });
    const addGap = (b: number, g: WallGap) => { const t = near(b); if (t) t.gaps.push(g); };
    hit.forEach((r: any) => {
      const e = ext(r, cut.axis);
      const wallBy = (w: string) => (w === cutWalls[0] ? e.v0 : e.v1);
      (r.doors || []).forEach((d: any) => {
        if (!cutWalls.includes(d.wall)) return;
        const sp = span(d, vertical ? r.w : r.h); const a0 = e.u0 + sp.off;
        if (u >= a0 - 0.05 && u <= a0 + sp.w + 0.05) { const [z0, z1] = doorZ(d, f.heightFt); addGap(wallBy(d.wall), { kind: "D", z0, z1 }); }
      });
      (r.windows || []).forEach((w: any) => {
        if (!cutWalls.includes(w.wall)) return;
        const sp = span(w, vertical ? r.w : r.h); const a0 = e.u0 + sp.off;
        if (u >= a0 - 0.05 && u <= a0 + sp.w + 0.05) { const [z0, z1] = winZ(w, f.heightFt); addGap(wallBy(w.wall), { kind: "W", z0, z1 }); }
      });
    });
    const walls: WallCut[] = bounds.map((x) => {
      if (x.b < 0.3) return { v0: 0, v1: WALL_T, kind: "E" as const, gaps: x.gaps };
      if (x.b > innerV - 0.3) return { v0: outerV - WALL_T, v1: outerV, kind: "E" as const, gaps: x.gaps };
      return { v0: x.b + WALL_T - WALL_T / 2, v1: x.b + WALL_T + WALL_T / 2, kind: "I" as const, gaps: x.gaps };
    }).sort((a, b) => a.v0 - b.v0);

    // ---- beyond faces (what you see looking through the cut)
    const faces: Face[] = [];
    hit.slice().sort((a: any, b: any) => ext(a, cut.axis).v0 - ext(b, cut.axis).v0).forEach((r: any) => {
      const e = ext(r, cut.axis);
      const fl = lookNeg ? e.u0 : e.u1;
      const sv0 = e.v0 + WALL_T + WALL_T / 2, sv1 = e.v1 + WALL_T - WALL_T / 2;
      const openings: FaceOpening[] = [];
      rooms.forEach((r2: any) => {
        const e2 = ext(r2, cut.axis);
        const own = (w: string) => (w === lookWall && Math.abs(e2.u0 * (lookNeg ? 1 : 0) + e2.u1 * (lookNeg ? 0 : 1) - fl) < 0.25) ||
                                    (w === oppWall && Math.abs(e2.u0 * (lookNeg ? 0 : 1) + e2.u1 * (lookNeg ? 1 : 0) - fl) < 0.25);
        const push = (o: any, kind: "D" | "W" | "V") => {
          if (!own(o.wall)) return;
          const sp = span(o, vertical ? r2.h : r2.w);
          const a0 = e2.v0 + sp.off + WALL_T, a1 = a0 + sp.w;
          if (Math.min(a1, sv1) - Math.max(a0, sv0) < 0.1) return;
          const [z0, z1] = kind === "D" ? doorZ(o, f.heightFt) : winZ(o, f.heightFt);
          if (!openings.some((q) => q.kind === kind && Math.abs(q.a0 - a0) < 0.05 && Math.abs(q.z0 - z0) < 0.05)) openings.push({ kind, a0, a1, z0, z1 });
        };
        (r2.doors || []).forEach((d: any) => push(d, "D"));
        (r2.windows || []).forEach((w: any) => push(w, isVent(w) ? "V" : "W"));
      });
      faces.push({ v0: sv0, v1: sv1, roomName: String(r.name), openings });
    });

    // ---- stairs (exact plan geometry, sliced by the cut plane)
    const stairs: SecStair[] = [];
    const holes: [number, number][] = [];
    f.stairs.forEach((st) => {
      const r = stairSection(st, f, L.ffl, cut.axis, u, lookNeg);
      stairs.push(...r.stairs);
      if (r.hole) holes.push(r.hole);
    });

    return {
      name: f.name, ffl: L.ffl, clearTop: L.clearTop, slabTop: L.slabTop, heightFt: f.heightFt, slabFt: f.slabFt,
      outerLen: outerV, walls, faces, stairs, holes,
      rooms: hit.map((r: any) => { const e = ext(r, cut.axis); return { name: String(r.name), v0: e.v0 + WALL_T, v1: e.v1 + WALL_T }; }),
    };
  });

  // ---- tower (mumty) above roof
  let tower: SectionModel["tower"];
  if (ctx.towerBox) {
    const b = ctx.towerBox;
    const e = ext({ x: b.x, y: b.y, w: b.w, h: b.h }, cut.axis);
    const v0 = e.v0 + WALL_T - WALL_T, v1 = e.v1 + WALL_T + WALL_T;
    let relation: "CUT" | "BEYOND" | null = null;
    if (u >= e.u0 && u <= e.u1) relation = "CUT";
    else if (lookNeg ? e.u1 <= u : e.u0 >= u) relation = "BEYOND";
    if (relation) tower = { v0, v1, relation, heightFt: ctx.towerHeightFt };
  }

  return {
    cut, title: `SECTION ${cut.id}-${cut.id}`, lengthV, positionOuterFt: pos.posOuter, nudged: pos.nudged, flip, floors, tower,
  };
}

/* ---------------- elevation model ---------------- */
export interface ElevOpening { kind: "D" | "W" | "V" | "B" | "G"; a0: number; a1: number; z0: number; z1: number }
export interface ElevFloor {
  name: string; ffl: number; clearTop: number; slabTop: number; a0: number; a1: number;
  openings: ElevOpening[]; steps?: { a0: number; a1: number }[];
}
export interface ElevationModel {
  side: ElevationSide; title: string; lengthA: number; floors: ElevFloor[];
  tower?: { a0: number; a1: number; setbackFt: number };
}

export function buildElevationModel(ctx: SectionContext, side: ElevationSide): ElevationModel {
  const lv = buildLevels(ctx);
  const horizontalFacade = side === "FRONT" || side === "REAR";          // facade runs along x
  const wall = side === "FRONT" ? "BOTTOM" : side === "REAR" ? "TOP" : side === "LEFT" ? "LEFT" : "RIGHT";
  const lengthA = horizontalFacade ? ctx.outerW : ctx.outerL;
  const mirror = side === "REAR" || side === "RIGHT";
  const toA = (lo: number, hi: number): [number, number] => (mirror ? [lengthA - hi, lengthA - lo] : [lo, hi]);

  const floors: ElevFloor[] = ctx.main.map((f, fi) => {
    const L = lv.floors[fi];
    const innerA = horizontalFacade ? f.innerW : f.innerL;
    // real extent of the room layout (robust when rooms stop a few inches short of the frame)
    const rs = f.rooms.filter((r: any) => !isStairRoom(r));
    const ex = rs.length
      ? { minX: Math.min(...rs.map((r: any) => r.x)), maxX: Math.max(...rs.map((r: any) => r.x + r.w)), minY: Math.min(...rs.map((r: any) => r.y)), maxY: Math.max(...rs.map((r: any) => r.y + r.h)) }
      : { minX: 0, maxX: f.innerW, minY: 0, maxY: f.innerL };
    const onFacade = (r: any) =>
      wall === "BOTTOM" ? r.y + r.h >= ex.maxY - 0.25 : wall === "TOP" ? r.y <= ex.minY + 0.25 : wall === "LEFT" ? r.x <= ex.minX + 0.25 : r.x + r.w >= ex.maxX - 0.25;
    const outerA = horizontalFacade ? f.outerW : f.outerL;
    const [fa0, fa1] = toA(mirror ? lengthA - outerA : 0, mirror ? lengthA : outerA);
    void innerA;
    const openings: ElevOpening[] = [];
    const steps: { a0: number; a1: number }[] = [];
    f.rooms.forEach((r: any) => {
      if (!onFacade(r) || isStairRoom(r)) return;
      const along0 = horizontalFacade ? r.x : r.y;
      const wallLen = horizontalFacade ? r.w : r.h;
      const add = (o: any, kind: ElevOpening["kind"]) => {
        if (o.wall !== wall) return;
        const sp = span(o, wallLen);
        const [a0, a1] = toA(along0 + sp.off + WALL_T, along0 + sp.off + sp.w + WALL_T);
        const [z0, z1] = kind === "D" || kind === "G" ? doorZ(o, f.heightFt) : winZ(o, f.heightFt);
        openings.push({ kind, a0, a1, z0: L.ffl + z0, z1: L.ffl + z1 });
        if ((kind === "D" || kind === "G") && fi === 0) steps.push({ a0: a0 - 0.5, a1: a1 + 0.5 });
      };
      (r.doors || []).forEach((d: any) => add(d, isGate(d) ? "G" : "D"));
      (r.windows || []).forEach((w: any) => add(w, isVent(w) ? "V" : "W"));
      if (up(r.name).includes("BALCONY") && fi > 0) {
        const [a0, a1] = toA(along0 + WALL_T, along0 + wallLen + WALL_T);
        openings.push({ kind: "B", a0, a1, z0: L.ffl, z1: L.ffl + 3 });
      }
    });
    return { name: f.name, ffl: L.ffl, clearTop: L.clearTop, slabTop: L.slabTop, a0: fa0, a1: fa1, openings, steps };
  });

  let tower: ElevationModel["tower"];
  if (ctx.towerBox) {
    const b = ctx.towerBox;
    const lo = (horizontalFacade ? b.x : b.y) + WALL_T - WALL_T, hi = (horizontalFacade ? b.x + b.w : b.y + b.h) + WALL_T + WALL_T;
    const [a0, a1] = toA(lo, hi);
    const depthLo = horizontalFacade ? b.y : b.x, depthHi = horizontalFacade ? b.y + b.h : b.x + b.w;
    const frameD = horizontalFacade ? ctx.outerL : ctx.outerW;
    const setback = wall === "BOTTOM" || wall === "RIGHT" ? frameD - (depthHi + 2 * WALL_T) : depthLo;
    tower = { a0, a1, setbackFt: Math.max(0, setback) };
  }
  const title = side === "FRONT" ? "FRONT ELEVATION" : side === "REAR" ? "REAR ELEVATION" : side === "LEFT" ? "LEFT SIDE ELEVATION" : "RIGHT SIDE ELEVATION";
  return { side, title, lengthA, floors, tower };
}

/* ---------------- layout helpers ---------------- */
export const SECTION_GAP_FT = 52;      // (legacy) nominal gap between drawings
const PAD_LEFT_PX = 30;                // dimension chain on the left of a drawing
const PAD_RIGHT_PX = 200;              // level call-out boxes on the right of a drawing

export interface RowItem { kind: "ELEVATION" | "SECTION"; index: number; x0: number; widthPx: number; leftPx: number; rightPx: number }
export interface MosFt { front: number; back: number; left: number; right: number }

/** Left -> right placement of all elevations then all sections (setback/MOS aware, markers never collide). */
export function layoutDrawingRow(
  sides: ElevationSide[], cuts: SectionCutDef[], outerW: number, outerL: number, scale: number, startX: number, mos: MosFt
): { items: RowItem[]; totalWidthPx: number } {
  const items: RowItem[] = [];
  let cursor = startX;
  const place = (kind: RowItem["kind"], index: number, widthFt: number, leftMosFt: number, rightMosFt: number) => {
    const leftPx = (items.length ? PAD_LEFT_PX : 0) + leftMosFt * scale;
    const x0 = cursor + leftPx;
    const widthPx = widthFt * scale;
    const rightPx = rightMosFt * scale + PAD_RIGHT_PX;
    items.push({ kind, index, x0, widthPx, leftPx, rightPx });
    cursor = x0 + widthPx + rightPx;
  };
  sides.forEach((sd, i) => place("ELEVATION", i, sd === "FRONT" || sd === "REAR" ? outerW : outerL, 0, 0));
  cuts.forEach((c, i) => {
    const vertical = c.axis === "VERTICAL";
    place("SECTION", i, vertical ? outerL : outerW, vertical ? mos.back : mos.left, vertical ? mos.front : mos.right);
  });
  return { items, totalWidthPx: Math.max(0, cursor - startX) };
}

export function estimateDrawingRowWidthPx(sides: ElevationSide[], cuts: SectionCutDef[], outerW: number, outerL: number, scale: number, mos?: MosFt): number {
  return layoutDrawingRow(sides, cuts, outerW, outerL, scale, 0, mos || { front: 0, back: 0, left: 0, right: 0 }).totalWidthPx;
}
