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
}

export interface TowerLayout {
  stair: Rect;
  room: Rect | null;
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

export function buildTowerRooms(layout: TowerLayout): FloorRoom[] {
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
    } as FloorRoom);
  }
  return rooms;
}