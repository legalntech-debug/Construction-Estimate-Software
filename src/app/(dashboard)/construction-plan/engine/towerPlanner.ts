/* =========================================================
   TOWER PLANNER
   - Tower ka STAIR CORE = upar ki floor ki stair ka exact rect (x, y, w, h). Koi "+3'/4' width" nahi.
   - User tower area / dimension zyada de to stair ke bagal me alag "TOWER ROOM" box banta hai.
   - Sab coordinates UPPER FLOOR ke plan-local ft me hain, isliye tower stair ke theek upar aata hai.
========================================================= */

import type { FloorRoom } from './planningTypes';

export interface Rect { x: number; y: number; w: number; h: number }

export const TOWER_MIN_ROOM_SIDE_FT = 3.5;
export const TOWER_MIN_EXTRA_AREA_SQFT = 12;
const MIN_SHARED_EDGE_FT = 2.5;

export type TowerPlacement = 'RIGHT' | 'LEFT' | 'BELOW' | 'ABOVE';

export interface TowerLayoutInput {
  /** Upar ki floor ki stair ka rect (plan-local ft) */
  stair: Rect;
  /** Upar ki floor ka clear size: tower isse bahar nahi ja sakta */
  canvasW: number;
  canvasL: number;
  /** User ka total tower area (sq.ft). Stair core se zyada ho to extra room banega */
  towerArea?: number;
  /** User ke diye extra TOWER ROOM ke dimensions (dono > 0 ho to area se zyada priority) */
  roomWidth?: number;
  roomLength?: number;
  /** Stair ki pehli riser jis face par hai (ground/upper stair ka entryFace). Is taraf TOWER ROOM nahi aayega. */
  entryFace?: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
  /** Pehli riser ke samne free landing (ft). Default 3.5 */
  entryClearFt?: number;
  /** v13: user ka diya tower box (W x L). Stair se bada ho to stair ke bottom se peeche (nahi to aage, nahi to dono taraf barabar) badhta hai */
  boxW?: number;
  boxL?: number;
}

export interface TowerLayout {
  stair: Rect;
  room: Rect | null;
  /** v13: box ke baaki hisse (side / end strips) - room ke saath milkar poora box banate hain */
  extraRooms?: Rect[];
  placement: TowerPlacement | null;
  stairArea: number;
  roomArea: number;
  totalArea: number;
  bounds: Rect;
  notes: string[];
}

const r2 = (v: number) => Number(v.toFixed(2));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Tower ke stair ka area - AUTO (stair rect ka area) */
export function towerStairArea(stair: Pick<Rect, 'w' | 'h'>): number {
  return r2(Math.max(0, stair.w) * Math.max(0, stair.h));
}

export function planTowerLayout(inp: TowerLayoutInput): TowerLayout {
  const W = Math.max(1, inp.canvasW);
  const L = Math.max(1, inp.canvasL);
  const sw = Math.min(Math.max(0.1, inp.stair.w), W);
  const sh = Math.min(Math.max(0.1, inp.stair.h), L);
  const s: Rect = {
    x: clamp(inp.stair.x, 0, Math.max(0, W - sw)),
    y: clamp(inp.stair.y, 0, Math.max(0, L - sh)),
    w: sw, h: sh,
  };
  const stairArea = towerStairArea(s);
  const notes: string[] = [];

  const explicit = (inp.roomWidth ?? 0) > 0 && (inp.roomLength ?? 0) > 0;
  const areaAsked = (inp.towerArea ?? 0) > 0;
  const extraArea = explicit ? 0 : Math.max(0, (inp.towerArea ?? 0) - stairArea);

  const done = (room: Rect | null, placement: TowerPlacement | null): TowerLayout => {
    const roomArea = room ? towerStairArea(room) : 0;
    const x0 = Math.min(s.x, room ? room.x : s.x);
    const y0 = Math.min(s.y, room ? room.y : s.y);
    const x1 = Math.max(s.x + s.w, room ? room.x + room.w : s.x + s.w);
    const y1 = Math.max(s.y + s.h, room ? room.y + room.h : s.y + s.h);
    return {
      stair: s, room, placement, stairArea, roomArea, totalArea: r2(stairArea + roomArea),
      bounds: { x: r2(x0), y: r2(y0), w: r2(x1 - x0), h: r2(y1 - y0) }, notes,
    };
  };

  // ✅ Pehli riser ke samne landing: TOWER ROOM is rectangle ko kabhi nahi kaat sakta (user ka access block na ho)
  const ED = Math.max(0, inp.entryClearFt ?? 3.5);
  const clear: Rect | null = !inp.entryFace ? null
    : inp.entryFace === 'BOTTOM' ? { x: s.x, y: s.y + s.h, w: s.w, h: ED }
    : inp.entryFace === 'TOP' ? { x: s.x, y: s.y - ED, w: s.w, h: ED }
    : inp.entryFace === 'LEFT' ? { x: s.x - ED, y: s.y, w: ED, h: s.h }
    : { x: s.x + s.w, y: s.y, w: ED, h: s.h };
  const hitsClear = (r: Rect) => !!clear &&
    Math.min(r.x + r.w, clear.x + clear.w) - Math.max(r.x, clear.x) > 0.01 &&
    Math.min(r.y + r.h, clear.y + clear.h) - Math.max(r.y, clear.y) > 0.01;

  // ✅ v13: USER BOX (W x L) - stair se bada ho to stair ke 1 corner (bottom) se grow
  const bw = inp.boxW ?? 0, bl = inp.boxL ?? 0;
  if (!explicit && bw > 0 && bl > 0 && (bw > s.w + 0.5 || bl > s.h + 0.5)) {
    const boxW = Math.min(Math.max(bw, s.w), W), boxL = Math.min(Math.max(bl, s.h), L);
    const ew = boxW - s.w, el = boxL - s.h;
    // LENGTH: stair ke bottom se peeche (upar, y chhota) -> nahi to aage (neeche) -> nahi to dono taraf barabar
    let y0 = s.y;
    if (el > 0.01) {
      const back = s.y, front = L - (s.y + s.h);
      if (back >= el - 0.01) y0 = s.y + s.h - boxL;
      else if (front >= el - 0.01) y0 = s.y;
      else y0 = clamp(s.y - el / 2, 0, L - boxL);
    }
    // WIDTH: jis taraf zyada jagah (pehli riser wali side ko chhodkar) -> nahi to dono taraf barabar
    let x0 = s.x;
    if (ew > 0.01) {
      const left = s.x, right = W - (s.x + s.w);
      const blockR = inp.entryFace === 'RIGHT', blockL = inp.entryFace === 'LEFT';
      const canR = right >= ew - 0.01 && !blockR, canL = left >= ew - 0.01 && !blockL;
      if (canR && (!canL || right >= left)) x0 = s.x;
      else if (canL) x0 = s.x + s.w - boxW;
      else x0 = clamp(s.x - ew / 2, 0, W - boxW);
    }
    // v14: HAMESHA EK HI TOWER ROOM (rectangle) - stair ke saath ek poora sahi kamra, multiple tukde nahi.
    const cands: Array<{ r: Rect; tag: string }> = [];
    const sideOK = ew > 0.4, endOK = el > 0.4;
    if (sideOK) {
      const sx = x0 < s.x - 0.01 ? x0 : s.x + s.w;
      cands.push({ r: { x: r2(sx), y: r2(y0), w: r2(ew), h: r2(boxL) }, tag: 'side' });
    }
    if (endOK) {
      const ey = y0 < s.y - 0.01 ? y0 : s.y + s.h;
      const ex = sideOK ? x0 : s.x;
      const eW = sideOK ? boxW : s.w;
      cands.push({ r: { x: r2(ex), y: r2(ey), w: r2(eW), h: r2(el) }, tag: 'end' });
    }
    const okRect = (r: Rect) => r.w >= TOWER_MIN_ROOM_SIDE_FT * 0.8 && r.h >= TOWER_MIN_ROOM_SIDE_FT * 0.8 &&
      r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= W + 0.01 && r.y + r.h <= L + 0.01 &&
      !(Math.min(r.x + r.w, s.x + s.w) - Math.max(r.x, s.x) > 0.01 && Math.min(r.y + r.h, s.y + s.h) - Math.max(r.y, s.y) > 0.01) && !hitsClear(r);
    const good = cands.filter((c) => okRect(c.r)).sort((a, b) => b.r.w * b.r.h - a.r.w * a.r.h);
    if (good.length) {
      const room = good[0].r;
      notes.push(`Tower: stair (${r2(s.w)} x ${r2(s.h)}) ke ${good[0].tag === 'side' ? 'bagal' : good[0].tag === 'end' && room.y < s.y ? 'peeche' : 'aage'} ek hi TOWER ROOM (${room.w} x ${room.h} ft).`);
      const lay = done(room, null);
      lay.placement = good[0].tag === 'side' ? (room.x < s.x ? 'LEFT' : 'RIGHT') : (room.y < s.y ? 'ABOVE' : 'BELOW');
      return lay;
    }
    notes.push('Tower box stair ke bagal me ek sahi room ki tarah fit nahi hua - sirf stair rakhi (box size/entry landing check karo).');
    return done(null, null);
  }

  if (!explicit && extraArea < TOWER_MIN_EXTRA_AREA_SQFT) {
    if (areaAsked) notes.push(`Tower area (${inp.towerArea} sq.ft) stair core (${stairArea} sq.ft) se zyada nahi - tower me sirf stair hai.`);
    return done(null, null);
  }

  const space: Record<TowerPlacement, number> = {
    RIGHT: W - (s.x + s.w), LEFT: s.x, BELOW: L - (s.y + s.h), ABOVE: s.y,
  };
  const sides = (['RIGHT', 'LEFT'] as TowerPlacement[]).sort((a, b) => space[b] - space[a]);
  const ends = (['BELOW', 'ABOVE'] as TowerPlacement[]).sort((a, b) => space[b] - space[a]);
  const order = [...sides, ...ends];

  const place = (p: TowerPlacement, w: number, h: number): Rect | null => {
    let x: number, y: number;
    if (p === 'RIGHT' || p === 'LEFT') {
      x = p === 'RIGHT' ? s.x + s.w : s.x - w;
      y = s.y;
      if (y + h > L) y = L - h;
      const shared = Math.min(y + h, s.y + s.h) - Math.max(y, s.y);
      if (shared < Math.min(MIN_SHARED_EDGE_FT, s.h)) return null;
    } else {
      y = p === 'BELOW' ? s.y + s.h : s.y - h;
      x = s.x;
      if (x + w > W) x = W - w;
      const shared = Math.min(x + w, s.x + s.w) - Math.max(x, s.x);
      if (shared < Math.min(MIN_SHARED_EDGE_FT, s.w)) return null;
    }
    if (x < -0.01 || y < -0.01 || x + w > W + 0.01 || y + h > L + 0.01) return null;
    const out: Rect = { x: r2(Math.max(0, x)), y: r2(Math.max(0, y)), w: r2(w), h: r2(h) };
    if (hitsClear(out)) return null;   // entry landing block ho rahi hai -> is side/size ko reject
    return out;
  };

  for (const p of order) {
    const isSide = p === 'RIGHT' || p === 'LEFT';
    const sizes: Array<[number, number]> = explicit
      ? [[inp.roomWidth!, inp.roomLength!], [inp.roomLength!, inp.roomWidth!]]
      : isSide
        ? [[Math.max(TOWER_MIN_ROOM_SIDE_FT, extraArea / s.h), s.h]]
        : [[s.w, Math.max(TOWER_MIN_ROOM_SIDE_FT, extraArea / s.w)]];
    for (const [w, h] of sizes) {
      const rect = place(p, w, h);
      if (rect) {
        notes.push(`Tower room stair ke ${p} side me (${rect.w} x ${rect.h} ft).`);
        return done(rect, p);
      }
    }
  }

  notes.push('Tower room upar ki floor ke footprint me stair ke bagal me fit nahi hua (pehli riser ke samne ' + ED + ' ft landing free rakhni hai) - area/dimension kam karo.');
  return done(null, null);
}

type Face = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
const TOWER_DOOR_W = 3;

/** v14: tower ke darwaze - stair ka darwaza open terrace ki taraf (exit/entry landing wali free side), TOWER ROOM ka darwaza uski sabse lambi free (terrace) wall par. */
export function planTowerDoors(layout: TowerLayout, canvasW: number, canvasL: number, entryFace?: string, exitFace?: string) {
  const s = layout.stair, room = layout.room;
  const E = 0.05;
  const overlapX = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = (a: Rect, b: Rect) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const touchesRoom = (r: Rect, f: Face) => !!room && (
    (f === 'LEFT' && Math.abs(room.x + room.w - r.x) < E && overlapY(room, r) > E) ||
    (f === 'RIGHT' && Math.abs(room.x - (r.x + r.w)) < E && overlapY(room, r) > E) ||
    (f === 'TOP' && Math.abs(room.y + room.h - r.y) < E && overlapX(room, r) > E) ||
    (f === 'BOTTOM' && Math.abs(room.y - (r.y + r.h)) < E && overlapX(room, r) > E));
  const onEdge = (r: Rect, f: Face) =>
    (f === 'LEFT' && r.x < E) || (f === 'RIGHT' && r.x + r.w > canvasW - E) ||
    (f === 'TOP' && r.y < E) || (f === 'BOTTOM' && r.y + r.h > canvasL - E);
  const faceLen = (r: Rect, f: Face) => (f === 'TOP' || f === 'BOTTOM') ? r.w : r.h;
  const mk = (id: string, r: Rect, f: Face, nearEnd?: Face) => {
    const len = faceLen(r, f);
    let off = (len - TOWER_DOOR_W) / 2;
    // lambi wall (LEFT/RIGHT) par darwaza landing ke end ki taraf
    if ((f === 'LEFT' || f === 'RIGHT') && (nearEnd === 'TOP' || nearEnd === 'BOTTOM')) off = nearEnd === 'TOP' ? 0.4 : len - TOWER_DOOR_W - 0.4;
    if ((f === 'TOP' || f === 'BOTTOM') && (nearEnd === 'LEFT' || nearEnd === 'RIGHT')) off = nearEnd === 'LEFT' ? 0.4 : len - TOWER_DOOR_W - 0.4;
    off = Math.max(0.3, Math.min(Math.max(0.3, len - TOWER_DOOR_W - 0.3), off));
    return { id, wall: f, widthFeet: TOWER_DOOR_W, offsetFeet: r2(off), doorType: 'INTERNAL', renderSymbol: true, swingInside: false, hingeSide: 'END' };
  };
  const faces: Face[] = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];
  const freeS = faces.filter((f) => !onEdge(s, f) && !touchesRoom(s, f));
  const pref = [exitFace, entryFace].filter(Boolean) as Face[];
  const sf = pref.find((f) => freeS.includes(f)) || freeS.sort((a, b) => faceLen(s, b) - faceLen(s, a))[0];
  const out: { stair: any | null; room: any | null } = { stair: null, room: null };
  if (sf) out.stair = mk('tower_stair_door', s, sf, (exitFace as Face) && (exitFace === 'TOP' || exitFace === 'BOTTOM') ? (exitFace as Face) : undefined);
  if (room) {
    const freeR = faces.filter((f) => !onEdge(room, f) && !touchesStair(room, s, f, E));
    const rf = freeR.sort((a, b) => faceLen(room, b) - faceLen(room, a))[0];
    if (rf) out.room = mk('tower_room_door', room, rf);
  }
  return out;
}
function touchesStair(r: Rect, s: Rect, f: Face, E: number) {
  const ox = Math.min(r.x + r.w, s.x + s.w) - Math.max(r.x, s.x), oy = Math.min(r.y + r.h, s.y + s.h) - Math.max(r.y, s.y);
  return (f === 'LEFT' && Math.abs(s.x + s.w - r.x) < E && oy > E) || (f === 'RIGHT' && Math.abs(s.x - (r.x + r.w)) < E && oy > E) ||
    (f === 'TOP' && Math.abs(s.y + s.h - r.y) < E && ox > E) || (f === 'BOTTOM' && Math.abs(s.y - (r.y + r.h)) < E && ox > E);
}

export function buildTowerRooms(layout: TowerLayout, canvasW?: number, canvasL?: number, entryFace?: string, exitFace?: string): FloorRoom[] {
  const { stair, room } = layout;
  const rooms: FloorRoom[] = [{
    id: 'tower_stair',
    name: 'STAIR TOWER / MUMTY',
    label: 'STAIR TOWER / MUMTY',
    roomType: 'stairs',
    type: 'stairs',
    x: stair.x, y: stair.y, w: stair.w, h: stair.h,
    selected: true, count: 1, areaMode: 'AUTO',
    areaPerRoom: layout.stairArea,
  } as FloorRoom];
  const td = planTowerDoors(layout, canvasW ?? 1e9, canvasL ?? 1e9, entryFace, exitFace);
  if (td.stair) (rooms[0] as any).doors = [td.stair];

  for (const [i, ex] of (layout.extraRooms || []).entries()) {
    rooms.push({
      id: `tower_room_${i + 2}`, name: 'TOWER ROOM', label: 'TOWER ROOM', roomType: 'room', type: 'room',
      x: ex.x, y: ex.y, w: ex.w, h: ex.h, selected: true, count: 1, areaMode: 'MANUAL', areaPerRoom: r2(ex.w * ex.h),
    } as FloorRoom);
  }
  if (room) {
    rooms.push({
      id: 'tower_room',
      name: 'TOWER ROOM',
      label: 'TOWER ROOM',
      roomType: 'room',
      type: 'room',
      x: room.x, y: room.y, w: room.w, h: room.h,
      selected: true, count: 1, areaMode: 'MANUAL',
      areaPerRoom: layout.roomArea,
      doors: td.room ? [td.room] : [],
    } as FloorRoom);
  }
  return rooms;
}