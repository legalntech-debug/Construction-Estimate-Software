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

export const WALL_T = 4 / 12;           // external AND internal wall thickness (matches plan)
export const SLAB_DEFAULT = 0.5;
export const PARAPET_FT = 3;
export const TOWER_FT = 8;

export type CutAxis = "VERTICAL" | "HORIZONTAL";          // VERTICAL = cut line runs top->bottom on plan
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
  { id: "A", axis: "VERTICAL", positionFt: "AUTO", look: "LEFT", color: SECTION_COLORS[0] },
];

export const normalizeLook = (axis: CutAxis, look: SectionLook): SectionLook =>
  axis === "VERTICAL" ? (look === "RIGHT" ? "RIGHT" : "LEFT") : look === "DOWN" ? "DOWN" : "UP";

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
  x: number; y: number; w: number; h: number;           // inner frame
  entryFace: "BOTTOM" | "TOP" | "LEFT" | "RIGHT";
  riserCount: number; riserIn: number; flightWidthFt: number;
  /** exact tread/riser plan from stairPlanner.solveStairDrawPlan (same data the plan view draws) */
  drawPlan?: any;
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

export function buildSectionContext(
  processedFloors: string[], floorData: Record<string, any>, floorRooms: Record<string, any>,
  baseOuterW: number, baseOuterL: number
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
        const spec = es.staircaseSpec || {};
        stairs.push({
          x: r.x + (es.relX !== undefined ? es.relX : es.x || 0),
          y: r.y + (es.relY !== undefined ? es.relY : es.y || 0),
          w: es.w, h: es.h,
          entryFace: (["BOTTOM", "TOP", "LEFT", "RIGHT"].includes(up(es.entryFace)) ? up(es.entryFace) : "BOTTOM") as any,
          riserCount: Number(spec.riserCount) > 0 ? Number(spec.riserCount) : 0,
          riserIn: Number(spec.actualRiserInches) > 0 ? Number(spec.actualRiserInches) : 0,
          flightWidthFt: Number(spec.flightWidthFt) > 0 ? Number(spec.flightWidthFt) : 0,
          drawPlan: spec.drawPlan,
        });
      });
    }
    floors.push({ name, isTower, heightFt, slabFt, rooms, outerW, outerL, innerW, innerL, stairs });
  });

  const main = floors.filter((f) => !f.isTower);
  const tower = floors.find((f) => f.isTower);
  const first: any = main[0] ? lookup(floorData, main[0].name) || {} : {};
  const plinthFt = num(first.plinthHeightFeet ?? first.planningSettings?.plinthHeightFeet ?? first.settings?.plinthHeightFeet, 1.5);

  let towerBox: SectionContext["towerBox"];
  if (tower) {
    const rs = tower.rooms.filter((r: any) => isStairRoom(r));
    const pick = rs[0] || [...tower.rooms].sort((a: any, b: any) => b.w * b.h - a.w * a.h)[0];
    if (pick) towerBox = { x: pick.x, y: pick.y, w: pick.w, h: pick.h };
  }
  return {
    floors, main, tower, towerBox,
    outerW: Math.max(baseOuterW, ...main.map((f) => f.outerW)),
    outerL: Math.max(baseOuterL, ...main.map((f) => f.outerL)),
    plinthFt, parapetFt: PARAPET_FT, towerHeightFt: TOWER_FT,
  };
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
const isVent = (w: any) => up(w?.type).includes("VENT");
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
export interface SecStair { relation: "CUT" | "BEYOND"; mode: "RUN" | "CROSS"; polys: SecPoly[]; label: string; anchor?: [number, number] }
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

export function resolveCutPositionFt(cut: SectionCutDef, ctx: SectionContext) {
  const vertical = cut.axis === "VERTICAL";
  let posInner: number;
  if (cut.positionFt === "AUTO") {
    const st = ctx.main.flatMap((f) => f.stairs)[0];
    if (st) {
      // go through the middle of ONE flight so the stair appears in section
      const runY = st.entryFace === "BOTTOM" || st.entryFace === "TOP";
      const C = runY ? st.w : st.h;                       // cross length
      const fw = st.flightWidthFt > 0 ? Math.min(st.flightWidthFt, C / 2 - 0.1) : Math.max(1, (C - 0.5) / 2);
      const crossIsU = vertical ? runY : !runY;           // does stair cross axis lie on the cut's u axis?
      if (crossIsU) {
        const start = vertical ? st.x : st.y;
        const aAtStart = st.entryFace === "BOTTOM" || st.entryFace === "LEFT";
        posInner = aAtStart ? start + fw / 2 : start + C - fw / 2;
      } else {
        posInner = (vertical ? st.x + st.w / 2 : st.y + st.h / 2);
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

function stairPolys(
  s: StairCtx, f: FloorCtx, ffl: number, axis: CutAxis, uCut: number, relation: "CUT" | "BEYOND"
): { stair: SecStair; hole?: [number, number] } {
  const vertical = axis === "VERTICAL";
  const runY = s.entryFace === "BOTTOM" || s.entryFace === "TOP";
  const C = runY ? s.w : s.h, Run = runY ? s.h : s.w;
  const total = f.heightFt + f.slabFt;                  // stair climbs from this FFL to the NEXT FFL
  const dp = s.drawPlan;
  let R = s.riserCount > 0 ? s.riserCount : Number(dp?.riserCount) > 0 ? Number(dp!.riserCount) : 0;
  if (!(R > 0)) R = Math.max(6, Math.round(total / 0.6));
  const rise = total / R;
  const fw = s.flightWidthFt > 0 ? Math.min(s.flightWidthFt, C / 2 - 0.1) : Math.max(1, (C - 0.5) / 2);
  const wt = 0.5;                                       // waist / landing slab thickness
  const label = `${R} R @ ${(rise * 12).toFixed(1)}"`;
  const mode: "RUN" | "CROSS" = runY === vertical ? "RUN" : "CROSS";

  // ---- tread / riser split: EXACTLY the plan's drawPlan when available (single source of truth)
  const t1p = Number(dp?.flight1?.treads), t2p = Number(dp?.flight2?.treads), mtp = Number(dp?.middle?.treads) || 0;
  const dpOk = !!dp && t1p >= 1 && t2p >= 1 && t1p + t2p + mtp + 3 === R;
  let n1: number, nm: number, n2: number;               // risers: FFL->landing1, landing1->landing2, landing2->next FFL
  let d1: number[], d2: number[], dm: number[];         // tread depths (ft) per flight
  let L1: number;                                       // run length occupied by the flights (landings after it)
  if (dpOk) {
    n1 = t1p + 1; nm = mtp + 1; n2 = t2p + 1;
    const toFt = (a: any, n: number, fallback: number) =>
      Array.isArray(a) && a.length === n && a.every((x: any) => Number(x) > 0) ? a.map((x: any) => Number(x) / 12) : Array(n).fill(fallback);
    const approx = Math.max(0.6, (Run - fw) / Math.max(1, t1p));
    d1 = toFt(dp!.flight1.depthsIn, t1p, approx);
    d2 = toFt(dp!.flight2.depthsIn, t2p, approx);
    dm = toFt(dp!.middle?.depthsIn, mtp, Math.max(0.6, (C - 2 * fw) / Math.max(1, mtp)));
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    L1 = Math.max(1, Math.min(Run - 0.5, Math.max(sum(d1), sum(d2))));
  } else {
    nm = R >= 10 ? 2 : 1;
    n1 = Math.ceil((R - nm) / 2); n2 = R - nm - n1;
    L1 = Math.max(1, Run - fw);
    d1 = Array(Math.max(1, n1 - 1)).fill(L1 / Math.max(1, n1 - 1));
    d2 = Array(Math.max(1, n2 - 1)).fill(L1 / Math.max(1, n2 - 1));
    dm = Array(Math.max(0, nm - 1)).fill(Math.max(0.6, (C - 2 * fw) / Math.max(1, nm - 1)));
  }
  const zA = ffl + n1 * rise, zB = ffl + (n1 + nm) * rise, zTop = ffl + R * rise;
  const polys: SecPoly[] = [];
  let hole: [number, number] | undefined;

  // which flight does the cut line pass through (cross coordinate)
  const crossStart = vertical ? s.x : s.y;
  const aAtStart = s.entryFace === "BOTTOM" || s.entryFace === "LEFT";
  const aLo = aAtStart ? crossStart : crossStart + C - fw, bLo = aAtStart ? crossStart + C - fw : crossStart;
  let which: "A" | "B" | "WELL" = "WELL";
  if (uCut >= aLo - 0.01 && uCut <= aLo + fw + 0.01) which = "A"; else if (uCut >= bLo - 0.01 && uCut <= bLo + fw + 0.01) which = "B";

  if (mode === "RUN") {
    const sv0 = (vertical ? s.y : s.x) + WALL_T, sv1 = sv0 + Run;
    const entryAtV1 = vertical ? s.entryFace === "BOTTOM" : s.entryFace === "RIGHT";
    const vE = entryAtV1 ? sv1 : sv0, dir = entryAtV1 ? -1 : 1;
    const V = (p: number) => vE + dir * p;              // p = distance from the entry riser

    // flight A: entry -> landing 1 (nosing profile, then landing slab, then sloping soffit)
    const A: Pt[] = [[V(0), ffl]];
    let x = 0;
    d1.forEach((d, k) => { A.push([V(x), ffl + (k + 1) * rise]); x += d; A.push([V(x), ffl + (k + 1) * rise]); });
    A.push([V(x), zA], [V(Run), zA], [V(Run), zA - wt], [V(x), zA - wt]);
    A.push([V(Math.min(x * 0.9, (wt * (x / d1.length)) / rise)), ffl]);

    // flight B: landing 2 -> next floor (descending towards the entry)
    const B: Pt[] = [[V(Run), zB], [V(L1), zB]];
    let xb = L1;
    d2.forEach((d, j) => { B.push([V(xb), zB + (j + 1) * rise]); xb -= d; B.push([V(xb), zB + (j + 1) * rise]); });
    B.push([V(xb), zTop]);
    const sB = rise / Math.max(0.3, d2.reduce((a, b) => a + b, 0) / d2.length);
    const pU = Math.min(L1, xb + (zTop - wt - (zB - wt)) / sB), zU = zTop - wt - sB * (pU - xb);
    B.push([V(xb), zTop - wt], [V(pU), zU], [V(pU), zB - wt], [V(Run), zB - wt]);

    if (relation === "BEYOND") polys.push({ kind: "LINE", pts: A }, { kind: "LINE", pts: B });
    else if (which === "A") polys.push({ kind: "POCHE", pts: A }, { kind: "LINE", pts: B });
    else if (which === "B") polys.push({ kind: "POCHE", pts: B }, { kind: "LINE", pts: A });
    else {
      // cut runs through the well: shows the middle (cross-running) treads on the far landing
      polys.push({ kind: "LINE", pts: A }, { kind: "LINE", pts: B });
      if (nm > 1 && C - 2 * fw > 0.2) {
        const lo = (aAtStart ? crossStart : crossStart) + fw, width = C - 2 * fw;
        const frac = Math.min(0.999, Math.max(0, (aAtStart ? uCut - lo : crossStart + C - fw - uCut) / width));
        const idx = Math.floor(frac * (nm - 1));
        const zt = zA + (idx + 1) * rise;
        polys.push({ kind: "POCHE", pts: [[V(L1), zt - wt], [V(Run), zt - wt], [V(Run), zt], [V(L1), zt]] });
      }
    }
    if (relation === "CUT") hole = [Math.min(V(0), V(L1)), Math.max(V(0), V(L1))];
    return { stair: { relation, mode, polys, label, anchor: [V((L1 + Run) / 2), ffl + 0.6] }, hole };
  }

  // CROSS: v runs across the flights; the cut sits at run-distance sRun from the entry riser
  const cs = (vertical ? s.y : s.x) + WALL_T;
  const aV: [number, number] = aAtStart ? [cs, cs + fw] : [cs + C - fw, cs + C];
  const bV: [number, number] = aAtStart ? [cs + C - fw, cs + C] : [cs, cs + fw];
  const sRun = s.entryFace === "BOTTOM" ? s.y + s.h - uCut : s.entryFace === "TOP" ? uCut - s.y : s.entryFace === "LEFT" ? uCut - s.x : s.x + s.w - uCut;
  const blk = (v: [number, number], zt: number, kind: "POCHE" | "LINE", thick = wt): SecPoly =>
    ({ kind, pts: [[v[0], zt - thick], [v[1], zt - thick], [v[1], zt], [v[0], zt]] });
  const anchor: [number, number] = [cs + C / 2, ffl + 0.6];

  if (relation === "BEYOND") {
    polys.push(blk(aV, zA, "LINE", n1 * rise), blk(bV, zTop, "LINE", R * rise));
    return { stair: { relation, mode, polys, label, anchor } };
  }
  if (sRun < L1) {
    const idx = (a: number[], p: number) => { let c = 0; for (let i = 0; i < a.length; i++) { c += a[i]; if (p < c) return i; } return a.length - 1; };
    const i = idx(d1, sRun);                                         // A tread under the cut
    const pB = L1 - sRun;                                            // B counts back from the far end
    const j = Math.min(d2.length - 1, Math.max(0, idx(d2.slice().reverse(), Math.max(0, pB)) ));
    const jj = d2.length - 1 - j;                                    // tread number counted from landing 2
    polys.push(blk(aV, ffl + (i + 1) * rise, "POCHE"), blk(bV, zB + (jj + 1) * rise, "POCHE"));
    hole = [cs, cs + C];
  } else {
    polys.push(blk(aV, zA, "POCHE"), blk(bV, zB, "POCHE"));
    const gapLo = Math.min(aV[1], bV[1]) === aV[1] ? aV[1] : bV[1];
    const gapHi = gapLo === aV[1] ? bV[0] : aV[0];
    const lo = Math.min(gapLo, gapHi), hi = Math.max(gapLo, gapHi), steps = Math.max(1, nm - 1);
    const stepV = (hi - lo) / steps, rev = aV[0] > bV[0];
    for (let k = 0; k < nm - 1; k++) {
      const a = lo + k * stepV, b = a + stepV, z = rev ? zB - (k + 1) * rise : zA + (k + 1) * rise;
      polys.push({ kind: "POCHE", pts: [[a, z - wt], [b, z - wt], [b, z], [a, z]] });
    }
  }
  return { stair: { relation, mode, polys, label, anchor }, hole };
}

export function buildSectionModel(ctx: SectionContext, cutIn: SectionCutDef): SectionModel {
  const cut: SectionCutDef = { ...cutIn, look: normalizeLook(cutIn.axis, cutIn.look) };
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

    // ---- stairs
    const stairs: SecStair[] = [];
    const holes: [number, number][] = [];
    f.stairs.forEach((s) => {
      const su0 = vertical ? s.x : s.y, su1 = su0 + (vertical ? s.w : s.h);
      let relation: "CUT" | "BEYOND" | null = null;
      if (u >= su0 && u <= su1) relation = "CUT";
      else if (lookNeg ? su1 <= u : su0 >= u) relation = "BEYOND";
      if (!relation) return;
      const r = stairPolys(s, f, L.ffl, cut.axis, u, relation);
      stairs.push(r.stair);
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