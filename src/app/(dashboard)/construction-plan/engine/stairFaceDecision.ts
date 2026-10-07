/* =========================================================
   STAIR FACE DECISION  (pure function)
   ---------------------------------------------------------
   Building-level decision: kis face se stair me entry hogi (U-shape BOTTOM/TOP ya C-shape LEFT/RIGHT).
   Pehle ye logic CadFloorPlansView ke andar tha. Ab yahan hai taaki
   PLAN VIEW aur SECTION/ELEVATION dono EXACTLY same face use karein.
   ========================================================= */
import { normalizeRoomList } from "./normalizeRooms";
import { calculateStaircase, solveStairDrawPlan, StaircaseFootprint, StairDrawPlan } from "./stairPlanner";

export type StairFace = "BOTTOM" | "TOP" | "LEFT" | "RIGHT";
export interface StairDecision { face: StairFace; allOk: boolean; summary: string }

/** floor-to-floor height jo stair planner ko dena hai (plan view wala same rule) */
export function stairFloorHeightFtFrom(floorData: Record<string, any> | undefined): number {
  const infos: any[] = Object.values(floorData || {});
  for (const f of infos) {
    const v = Number(
      f?.floorToFloorHeightFeet ??
      f?.planningSettings?.floorToFloorHeightFeet ??
      f?.settings?.floorToFloorHeightFeet ??
      f?.staircaseConfig?.floorToFloorHeightFeet
    );
    if (v > 0) return v;
  }
  return 10;
}

export function decideStairFace(
  processedFloors: string[],
  floorData: Record<string, any> | undefined,
  floorRooms: Record<string, any> | undefined,
  stairFloorHeightFt: number
): StairDecision | null {
  const getFloorInfo = (name: string) => {
    if (!floorData) return null;
    const cleanKey = name.trim().toLowerCase();
    const foundKey = Object.keys(floorData).find(
      (k) => k.trim().toLowerCase() === cleanKey || k.trim().toLowerCase().replace(/\s+/g, "_") === cleanKey.replace(/\s+/g, "_")
    );
    return foundKey ? (floorData as any)[foundKey] : null;
  };

  const STAIR_ACCESS_DEPTH_FT = 3.5;

  const lookupFloorRooms = (name: string): any[] => {
    if (!floorRooms) return [];
    let src: any = (floorRooms as any)[name];
    if (!src) {
      const clean = name.trim().toLowerCase().replace(/\s+/g, "_");
      const key = Object.keys(floorRooms).find(
        (k) => k.trim().toLowerCase() === name.trim().toLowerCase() || k.trim().toLowerCase().replace(/\s+/g, "_") === clean
      );
      src = key ? (floorRooms as any)[key] : null;
    }
    if (!src) return [];
    return Array.isArray(src) ? src : Object.values(src);
  };

  const stairDecision: StairDecision | null = (() => {
    try {
      const CIRC = ["LIVING", "HALL", "DRAWING", "PASSAGE", "CORRIDOR", "DINING", "LOBBY"];
      const isCirc = (n: string) => CIRC.some((k) => n.includes(k));
      type Item = { floor: string; W: number; H: number; rooms: any[]; sx: number; sy: number; sw: number; sh: number; es: any };
      const items: Item[] = [];

      for (const fname of processedFloors) {
        const up = fname.toUpperCase();
        if (up.includes("TOWER") || up.includes("MUMTY")) continue;
        const info: any = getFloorInfo(fname);
        const wall = 4 / 12;
        const sb = info?.setbacks || {};
        const plotW = Number(info?.width) || 10;
        const plotL = Number(info?.length) || 40;
        const cw = Number(info?.clearWidth), cl = Number(info?.clearLength);
        const W = Math.max(3.5, cw > 0 ? cw : plotW - ((Number(sb.left) || 0) + (Number(sb.right) || 0)) - wall * 2);
        const H = Math.max(6, cl > 0 ? cl : plotL - ((Number(sb.front) || 0) + (Number(sb.rear) || 0)) - wall * 2);

        let entries: any[] = lookupFloorRooms(fname);
        if (entries.length === 0 && Array.isArray(info?.rooms)) entries = info.rooms;
        if (entries.length === 0) continue;
        const raw = entries.map((r: any) => ({
          ...r,
          name: r.name || r.label || r.roomType || "ROOM",
          x: Math.max(0, Number(r.x ?? 0)), y: Math.max(0, Number(r.y ?? 0)),
          w: Math.max(0.1, Math.min(Number(r.w ?? W), W)), h: Math.max(0.1, Math.min(Number(r.h ?? H), H)),
          type: r.type || r.roomType || "room",
        }));
        const rooms = normalizeRoomList(raw, W, H);
        const living: any = rooms.find((r: any) => String(r.name || "").toUpperCase().includes("LIVING") && r.embeddedStair && (r.embeddedStair.w || 0) > 0 && (r.embeddedStair.h || 0) > 0);
        if (!living) continue;
        const es = living.embeddedStair;
        const sx = (living.x || 0) + (es.relX !== undefined ? es.relX : (es.x || 0));
        const sy = (living.y || 0) + (es.relY !== undefined ? es.relY : (es.y || 0));
        items.push({ floor: fname, W, H, rooms, sx, sy, sw: es.w || 0, sh: es.h || 0, es });
      }
      if (items.length === 0) return null;

      const planFits = (it: Item, face: StairFace): boolean => {
        const rot = face === "LEFT" || face === "RIGHT";
        const cross = rot ? it.sh : it.sw;
        const run = rot ? it.sw : it.sh;
        const given: any = it.es.staircaseSpec || {};
        const pre: StairDrawPlan | undefined = given?.drawPlan ?? it.es.renderHints?.drawPlan;
        if (pre && pre.shortTreads === 0 && pre.usedCrossFt <= cross + 0.05 && pre.usedRunFt <= run + 0.05) return true;
        const usable = Number(given?.riserCount) > 0 && Number(given?.flightWidthFt) > 0 && given?.flight1 && given?.flight2;
        const base: StaircaseFootprint = usable ? (given as StaircaseFootprint) : calculateStaircase(stairFloorHeightFt, cross, run, "DOG_LEGGED");
        return solveStairDrawPlan(base, cross, run).plan.shortTreads === 0;
      };

      const accessFree = (it: Item, face: StairFace): boolean => {
        const D = STAIR_ACCESS_DEPTH_FT;
        let zx = it.sx, zy = it.sy, zw = it.sw, zh = it.sh;
        if (face === "BOTTOM") { zy = it.sy + it.sh; zh = D; }
        else if (face === "TOP") { zy = it.sy - D; zh = D; }
        else if (face === "RIGHT") { zx = it.sx + it.sw; zw = D; }
        else { zx = it.sx - D; zw = D; }
        const E = 0.05;
        if (zx < -E || zy < -E || zx + zw > it.W + E || zy + zh > it.H + E) return false;
        for (const r of it.rooms) {
          const n = String(r.name || "").toUpperCase();
          if (r.type === "stairs" || n.includes("STAIR") || isCirc(n)) continue;
          const ox = Math.min(zx + zw, (r.x || 0) + (r.w || 0)) - Math.max(zx, r.x || 0);
          const oy = Math.min(zy + zh, (r.y || 0) + (r.h || 0)) - Math.max(zy, r.y || 0);
          if (ox > E && oy > E) return false;
        }
        return true;
      };

      const plannerFace = String(items[0].es.entryFace || "").toUpperCase() as StairFace;
      const order = Array.from(new Set<StairFace>([
        ...(["BOTTOM", "TOP", "LEFT", "RIGHT"].includes(plannerFace) ? [plannerFace] : []),
        "BOTTOM", "RIGHT", "LEFT", "TOP",
      ] as StairFace[]));

      let best: { face: StairFace; okCount: number; fitAll: boolean } | null = null;
      const lines: string[] = [];
      for (const face of order) {
        const fitAll = items.every((it) => planFits(it, face));
        const okFloors = items.filter((it) => accessFree(it, face)).map((it) => it.floor);
        const okCount = okFloors.length;
        lines.push(`${face}: fit=${fitAll} access ${okCount}/${items.length} [${okFloors.join(", ")}]`);
        const better = !best
          || (fitAll && !best.fitAll)
          || (fitAll === best.fitAll && okCount > best.okCount);
        if (better) best = { face, okCount, fitAll };
        if (fitAll && okCount === items.length) { best = { face, okCount, fitAll }; break; }
      }
      const b = best!;
      const allOk = b.fitAll && b.okCount === items.length;
      return { face: b.face, allOk, summary: lines.join(" | ") };
    } catch (e) {
      console.warn("[STAIR DECISION] fail -> planner ka face use hoga", e);
      return null;
    }
  })();

  return stairDecision;
}
