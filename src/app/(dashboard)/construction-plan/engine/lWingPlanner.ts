/**
 * v29: L-SHAPE wing planner.
 * L plot me "core" (road se lagi sabse badi rectangle) ko to normal planner plan karta hai. Core ke bahar bacha
 * hua hissa (wing) pehle sirf kamron ka extension banta tha (khaali dikhta tha). Ab wing me bhi rooms bante hain:
 * bedroom (+ attached toilet), study, aur zarurat ho to passage - core ke living / passage se door ke saath.
 */
import { makeRoom } from './roomPlanner';
import { scanInterval, PlotShapeFit } from './plotShapeFit';

type Rect = { x: number; y: number; w: number; h: number };
type Side = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
const OPP: Record<Side, Side> = { LEFT: 'RIGHT', RIGHT: 'LEFT', TOP: 'BOTTOM', BOTTOM: 'TOP' };

export interface Wing { rect: Rect; side: Side; u0: number; uLen: number; depth: number }

const snap25 = (v: number) => Math.round(v * 4) / 4;
const r2 = (v: number) => Number(v.toFixed(2));

/** core ke bahar bacha rectangular hissa (wings) - polygon (inner) ko rows me scan karke */
export function findWings(fit: PlotShapeFit): Wing[] {
  const core = fit.core, inner = fit.inner;
  const ys = inner.map((p) => p.y);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  type Open = { x0: number; x1: number; ya: number; yb: number };
  const done: Open[] = [];
  let open: Open[] = [];
  for (let y = y0 + 0.125; y < y1; y += 0.25) {
    const it = scanInterval(inner, y);
    const segs: [number, number][] = [];
    if (it) {
      const inCore = y >= core.y && y <= core.y + core.h;
      if (inCore) {
        if (core.x - it[0] > 0.3) segs.push([it[0], core.x]);
        if (it[1] - (core.x + core.w) > 0.3) segs.push([core.x + core.w, it[1]]);
      } else segs.push([it[0], it[1]]);
    }
    const next: Open[] = [];
    for (const s of segs) {
      const m = open.find((o) => Math.abs(o.x0 - s[0]) < 0.2 && Math.abs(o.x1 - s[1]) < 0.2);
      if (m) { m.yb = y + 0.125; next.push(m); } else next.push({ x0: s[0], x1: s[1], ya: y - 0.125, yb: y + 0.125 });
    }
    for (const o of open) if (!next.includes(o)) done.push(o);
    open = next;
  }
  done.push(...open);

  const wings: Wing[] = [];
  const near = 0.45;
  for (const o of done) {
    const rect = { x: o.x0, y: o.ya, w: o.x1 - o.x0, h: o.yb - o.ya };
    if (rect.w < 6 || rect.h < 6) continue;
    const yOv = (a: number, b: number) => Math.min(b, core.y + core.h) - Math.max(a, core.y);
    const xOv = (a: number, b: number) => Math.min(b, core.x + core.w) - Math.max(a, core.x);
    if (Math.abs(o.x1 - core.x) < near && yOv(o.ya, o.yb) >= 5) {
      wings.push({ rect, side: 'LEFT', u0: Math.max(o.ya, core.y), uLen: yOv(o.ya, o.yb), depth: rect.w });
    } else if (Math.abs(o.x0 - (core.x + core.w)) < near && yOv(o.ya, o.yb) >= 5) {
      wings.push({ rect, side: 'RIGHT', u0: Math.max(o.ya, core.y), uLen: yOv(o.ya, o.yb), depth: rect.w });
    } else if (Math.abs(o.yb - core.y) < near && xOv(o.x0, o.x1) >= 5) {
      wings.push({ rect, side: 'TOP', u0: Math.max(o.x0, core.x), uLen: xOv(o.x0, o.x1), depth: rect.h });
    } else if (Math.abs(o.ya - (core.y + core.h)) < near && xOv(o.x0, o.x1) >= 5) {
      wings.push({ rect, side: 'BOTTOM', u0: Math.max(o.x0, core.x), uLen: xOv(o.x0, o.x1), depth: rect.h });
    }
  }
  return wings;
}

function mkDoor(room: Rect, wall: Side, centerAlong: number, width: number, id: string, render = true, extra: any = {}) {
  const horiz = wall === 'TOP' || wall === 'BOTTOM';
  const start = horiz ? room.x : room.y, len = horiz ? room.w : room.h;
  const off = Math.max(0.3, Math.min(centerAlong - start - width / 2, len - width - 0.3));
  return { id, wall, widthFeet: width, offsetFeet: r2(off), doorType: 'INTERNAL', renderSymbol: render, swingInside: true, hingeSide: 'END', sharedOpeningId: id, ...extra };
}
function mkWindow(room: Rect, wall: Side, centerAlong: number, len: number, id: string): any {
  const horiz = wall === 'TOP' || wall === 'BOTTOM';
  const start = horiz ? room.x : room.y, total = horiz ? room.w : room.h;
  const off = Math.max(0.3, Math.min(centerAlong - start - len / 2, total - len - 0.3));
  return { id, wall, lengthFeet: len, offsetFeet: r2(off), windowType: (len <= 2 ? 'VENTILATOR' : 'STANDARD') as any };
}

export function planWingRooms(plan: any, fit: PlotShapeFit, isGround: boolean): { wings: Rect[]; added: string[] } {
  const out = { wings: [] as Rect[], added: [] as string[] };
  const wings = findWings(fit);
  if (!wings.length) return out;
  const rooms: any[] = plan.rooms;
  const core = fit.core;
  let counter = 200;
  const bedCount = () => rooms.filter((r) => /BEDROOM/.test(String(r.name)) && !r.isSubRoom).length;

  const okTarget = /LIVING|PASSAGE|DINING|LOBBY|HALL/i;
  const badTarget = /TOILET|BATH|DUCT|SHAFT|STAIR|PARKING|KITCHEN|BEDROOM/i;

  for (const wing of wings) {
    const { side } = wing;
    const nearWall = OPP[side];                 // wing room ki wall jo core / passage ki taraf hai
    const sx = side === 'LEFT' ? wing.rect.x + wing.rect.w : side === 'RIGHT' ? wing.rect.x : side === 'TOP' ? wing.rect.y + wing.rect.h : wing.rect.y;
    const mapRect = (u0: number, v0: number, uw: number, vd: number): Rect => {
      const U = wing.u0 + u0;
      switch (side) {
        case 'LEFT': return { x: sx - (v0 + vd), y: U, w: vd, h: uw };
        case 'RIGHT': return { x: sx + v0, y: U, w: vd, h: uw };
        case 'TOP': return { x: U, y: sx - (v0 + vd), w: uw, h: vd };
        default: return { x: U, y: sx + v0, w: uw, h: vd };
      }
    };
    const uToGlobal = (u: number) => wing.u0 + u;                                       // shared edge ke saath coordinate
    const vToGlobal = (v: number) => (side === 'LEFT' || side === 'TOP' ? sx - v : sx + v);  // core se door ki taraf
    const uAxisIsY = side === 'LEFT' || side === 'RIGHT';

    // core ke wo rooms jo shared edge par hain
    const coreEdgeRooms = rooms.filter((r) => !r.isSubRoom && !r.isWingRoom && (
      side === 'LEFT' ? Math.abs(r.x - core.x) < 0.45 :
      side === 'RIGHT' ? Math.abs(r.x + r.w - (core.x + core.w)) < 0.45 :
      side === 'TOP' ? Math.abs(r.y - core.y) < 0.45 :
      Math.abs(r.y + r.h - (core.y + core.h)) < 0.45));
    const spanOf = (r: any): [number, number] => (uAxisIsY ? [r.y, r.y + r.h] : [r.x, r.x + r.w]);

    /** [a,b] (u-coordinates, global) par core ka kaun sa room se jod sakte hain */
    const pickCoreTarget = (a: number, b: number): { room: any; a: number; b: number } | null => {
      let best: { room: any; a: number; b: number; sc: number } | null = null;
      for (const r of coreEdgeRooms) {
        const [ra, rb] = spanOf(r);
        let oa = Math.max(a, ra), ob = Math.min(b, rb);
        if (ob - oa < 3.4) continue;
        // v30: stair us wall se lagi ho to door stair ke neeche (headroom nahi) nahi - stair ke footprint ke bahar ka sabse bada hissa
        const es = r.embeddedStair;
        if (es) {
          const sx = r.x + (es.relX || 0), sy = r.y + (es.relY || 0), sw2 = es.w || 0, sh2 = es.h || 0;
          const abut = side === 'LEFT' ? Math.abs(sx - core.x) < 0.8 : side === 'RIGHT' ? Math.abs(sx + sw2 - (core.x + core.w)) < 0.8 : side === 'TOP' ? Math.abs(sy - core.y) < 0.8 : Math.abs(sy + sh2 - (core.y + core.h)) < 0.8;
          if (abut) {
            const b0 = (uAxisIsY ? sy : sx) - 0.3, b1 = (uAxisIsY ? sy + sh2 : sx + sw2) + 0.3;
            const segA: [number, number] = [oa, Math.min(ob, b0)], segB: [number, number] = [Math.max(oa, b1), ob];
            const lenA = segA[1] - segA[0], lenB = segB[1] - segB[0];
            if (Math.max(lenA, lenB) < 3.3) continue;
            [oa, ob] = lenA >= lenB ? segA : segB;
          }
        }
        const nm = String(r.name);
        const sc = (okTarget.test(nm) ? 100 : badTarget.test(nm) ? -50 : 0) + (ob - oa);
        if (sc < 0) continue;
        if (!best || sc > best.sc) best = { room: r, a: oa, b: ob, sc };
      }
      return best ? { room: best.room, a: best.a, b: best.b } : null;
    };

    const built: any[] = [];
    const doorsToCore: Array<{ room: any; door: any }> = [];
    const wingTag = `wing${counter}`;
    // ---- SPINE layout: gehra wing -> core se seedha corridor (v ke saath), dono taraf kamre ----
    if (wing.depth >= 20 && wing.uLen >= 22) {
      const tgt = pickCoreTarget(wing.u0 + 8, wing.u0 + wing.uLen - 8);
      if (tgt) {
        const sw = 3.5;
        let c = Math.max(tgt.a + 1.65, Math.min((tgt.a + tgt.b) / 2, tgt.b - 1.65));
        c = Math.max(wing.u0 + 8 + sw / 2, Math.min(c, wing.u0 + wing.uLen - 8 - sw / 2));
        const spineU0 = snap25(c - wing.u0 - sw / 2);
        const leftW = spineU0, rightW = r2(wing.uLen - spineU0 - sw);
        if (leftW >= 8 && rightW >= 8) {
          const uStartWall: Side = uAxisIsY ? 'TOP' : 'LEFT', uEndWall: Side = uAxisIsY ? 'BOTTOM' : 'RIGHT';
          const k = Math.max(1, Math.min(3, Math.round(wing.depth / 13)));
          const dv = r2(wing.depth / k);
          if (dv >= 10) {
            const spineRect = mapRect(spineU0, 0, sw, wing.depth);
            const coreId = `${wingTag}-core-door`;
            const spine = makeRoom('PASSAGE', counter++, spineRect.x, spineRect.y, spineRect.w, spineRect.h, { isWingRoom: true, doors: [mkDoor(spineRect, nearWall, uToGlobal(spineU0 + sw / 2), 3, coreId, true)], windows: [] });
            const cd = Math.max(tgt.a + 1.65, Math.min(uToGlobal(spineU0 + sw / 2), tgt.b - 1.65));
            doorsToCore.push({ room: tgt.room, door: mkDoor(tgt.room, side, cd, 3, coreId, false) });
            built.push(spine);
            const cells: Array<{ col: 'L' | 'R'; row: number }> = [];
            for (let row = 0; row < k; row++) { cells.push({ col: 'L', row }); cells.push({ col: 'R', row }); }
            const total = cells.length;
            cells.forEach((cell, idx) => {
              const cu0 = cell.col === 'L' ? 0 : spineU0 + sw, cw = cell.col === 'L' ? leftW : rightW;
              const cv0 = cell.row * dv;
              const rr = mapRect(cu0, cv0, cw, dv);
              const kind = (total >= 4 && idx === total - 1) ? 'STUDY ROOM' : 'BEDROOM';
              const nm = kind === 'BEDROOM' ? `BEDROOM ${bedCount() + built.filter((q) => /BEDROOM/.test(q.name) && !q.isSubRoom).length + 1}` : kind;
              const spineWall: Side = cell.col === 'L' ? uEndWall : uStartWall;
              const outerWall: Side = cell.col === 'L' ? uStartWall : uEndWall;
              const vc = cv0 + dv / 2;
              const did = `${wingTag}-sd-${idx}`;
              const hasToilet = kind === 'BEDROOM' && cw >= 10.5 && dv >= 11.5;
              const room = makeRoom(nm, counter++, rr.x, rr.y, rr.w, rr.h, {
                isWingRoom: true, privateZone: kind === 'BEDROOM',
                doors: [mkDoor(rr, spineWall, vToGlobal(vc), 3, did, true)],
                windows: [] as any[],
              });
              spine.doors.push(mkDoor(spineRect, cell.col === 'L' ? uStartWall : uEndWall, vToGlobal(vc), 3, did, false));
              // window: outer wall (exterior); toilet ho to bachi hui jagah ke beech
              const wc = hasToilet ? cv0 + (dv - 7.5) / 2 : vc;
              room.windows.push(mkWindow(rr, outerWall, vToGlobal(wc), 3.5, `${wingTag}-sw-${idx}`));
              if (cell.row === k - 1) room.windows.push(mkWindow(rr, OPP[nearWall], uAxisIsY ? rr.y + rr.h / 2 : rr.x + rr.w / 2, 3.5, `${wingTag}-sf-${idx}`));
              built.push(room);
              if (hasToilet) {
                const tU0 = cell.col === 'L' ? cu0 : cu0 + cw - 5;
                const tr = mapRect(tU0, cv0 + dv - 7.5, 5, 7.5);
                const tId = `${wingTag}-sat-${idx}`;
                const doorWall: Side = cell.col === 'L' ? uEndWall : uStartWall;     // bedroom ki taraf
                const toilet = makeRoom('ATTACHED TOILET', counter++, tr.x, tr.y, tr.w, tr.h, {
                  isWingRoom: true, isSubRoom: true, attachedTo: room.id, subZoneOf: room.id, serviceCore: true, ventilationRequired: true,
                  doors: [mkDoor(tr, doorWall, vToGlobal(cv0 + dv - 7.5 + 1.7), 2.5, tId, true, { doorType: 'TOILET' })],
                  windows: [mkWindow(tr, outerWall, vToGlobal(cv0 + dv - 3.75), 2, `${tId}-win`)],
                });
                built.push(toilet);
              }
            });
            rooms.push(...built);
            for (const d of doorsToCore) d.room.doors = [...(d.room.doors || []), d.door];
            out.added.push(...built.filter((b) => !b.isSubRoom).map((b) => b.name));
            out.wings.push(wing.rect);
            continue;
          }
        }
      }
    }

    const hasPassage = wing.depth >= 13;
    const pd = 3.5;
    const rd = hasPassage ? wing.depth - pd : wing.depth;
    if (rd < 9 || wing.uLen < 9) continue;
    const n = Math.max(1, Math.min(3, Math.floor(wing.uLen / 10)));
    const widths: number[] = [];
    for (let i = 0; i < n; i++) widths.push(i === n - 1 ? r2(wing.uLen - widths.reduce((a, b) => a + b, 0)) : snap25(wing.uLen / n));
    if (widths.some((w) => w < 8)) continue;

    const roomV0 = hasPassage ? pd : 0;

    // ---- core se connection (passage ya seedha) ----
    let passage: any = null;
    if (hasPassage) {
      const pr = mapRect(0, 0, wing.uLen, pd);
      const tgt = pickCoreTarget(wing.u0, wing.u0 + wing.uLen);
      if (!tgt) continue;
      const c = Math.max(tgt.a + 1.65, Math.min((tgt.a + tgt.b) / 2, tgt.b - 1.65));
      const did = `${wingTag}-core-door`;
      passage = makeRoom('PASSAGE', counter++, pr.x, pr.y, pr.w, pr.h, { isWingRoom: true, doors: [mkDoor(pr, nearWall, c, 3, did, true)], windows: [] });
      doorsToCore.push({ room: tgt.room, door: mkDoor(tgt.room, side, c, 3, did, false) });
      built.push(passage);
    }

    // ---- rooms ----
    const kinds = ['BEDROOM', 'BEDROOM', 'STUDY ROOM'];
    let u = 0, abort = false;
    const roomObjs: any[] = [];
    for (let i = 0; i < n && !abort; i++) {
      const rw = widths[i];
      const rr = mapRect(u, roomV0, rw, rd);
      const kind = (rw * rd < 70) ? 'STUDY ROOM' : kinds[i] || 'BEDROOM';
      const nm = kind === 'BEDROOM' ? `BEDROOM ${bedCount() + roomObjs.filter((q) => /BEDROOM/.test(q.name)).length + 1}` : kind;
      const did = `${wingTag}-door-${i}`;
      const centerAlong = uAxisIsY ? rr.y + rr.h / 2 : rr.x + rr.w / 2;
      const doors: any[] = [];
      if (hasPassage && passage) {
        doors.push(mkDoor(rr, nearWall, centerAlong, 3, did, true));
        passage.doors.push(mkDoor(passage, side, centerAlong, 3, did, false));
      } else {
        const tgt = pickCoreTarget(uToGlobal(u), uToGlobal(u + rw));
        if (!tgt) {
          // seedha core se nahi jud sakta -> pichhle wing room se jodo (chain), warna wing chhodo
          const prev = roomObjs[roomObjs.length - 1];
          if (!prev) { abort = true; break; }
          const seam = uAxisIsY ? rr.y : rr.x;
          doors.push(mkDoor(rr, uAxisIsY ? 'TOP' : 'LEFT', (uAxisIsY ? rr.x : rr.y) + (uAxisIsY ? rr.w : rr.h) / 2 + (rd > 12 ? 0 : 0), 3, did, true));
          prev.doors.push(mkDoor(prev, uAxisIsY ? 'BOTTOM' : 'RIGHT', (uAxisIsY ? prev.x : prev.y) + (uAxisIsY ? prev.w : prev.h) / 2, 3, did, false));
          void seam;
        } else {
          const c = Math.max(tgt.a + 1.65, Math.min((tgt.a + tgt.b) / 2, tgt.b - 1.65));
          doors.push(mkDoor(rr, nearWall, c, 3, did, true));
          doorsToCore.push({ room: tgt.room, door: mkDoor(tgt.room, side, c, 3, did, false) });
        }
      }
      const farWall = OPP[nearWall];
      const windows: any[] = [mkWindow(rr, farWall, uAxisIsY ? rr.y + rr.h / 2 : rr.x + rr.w / 2, 3.5, `${wingTag}-win-${i}`)];
      const room = makeRoom(nm, counter++, rr.x, rr.y, rr.w, rr.h, { isWingRoom: true, privateZone: kind === 'BEDROOM', doors, windows });
      roomObjs.push(room);
      built.push(room);
      u += rw;
    }
    if (abort) continue;

    // ---- attached toilet (bedroom ke far-v corner par) ----
    roomObjs.forEach((room, i) => {
      if (!/BEDROOM/.test(room.name)) return;
      if (!(widths[i] >= 10.5 && rd >= 11.5)) return;
      const uStart = widths.slice(0, i).reduce((a, b) => a + b, 0);
      const tw = 5, th = 7.5;
      const vFar = roomV0 + rd;
      const tr = mapRect(uStart, vFar - th, tw, th);
      const uEndWall: Side = uAxisIsY ? 'BOTTOM' : 'RIGHT';
      const doorV = vFar - th + 1.7;                     // toilet ke near-v side se thoda andar
      const centerAlong = uAxisIsY ? vToGlobal(doorV) : vToGlobal(doorV);
      const farWall = OPP[nearWall];
      const tId = `${wingTag}-att-${i}`;
      const toilet = makeRoom('ATTACHED TOILET', counter++, tr.x, tr.y, tr.w, tr.h, {
        isWingRoom: true, isSubRoom: true, attachedTo: room.id, subZoneOf: room.id, serviceCore: true, ventilationRequired: true,
        doors: [{ id: tId, wall: uEndWall, widthFeet: 2.5, offsetFeet: 0, doorType: 'TOILET', renderSymbol: true, swingInside: true, sharedOpeningId: tId }],
        windows: [mkWindow(tr, farWall, uAxisIsY ? tr.y + tr.h / 2 : tr.x + tr.w / 2, 2, `${tId}-win`)],
      });
      toilet.doors[0] = mkDoor(tr, uEndWall, centerAlong, 2.5, tId, true, { doorType: 'TOILET' });
      built.push(toilet);
      // bedroom ki window toilet se bachi jagah ke beech
      const wnd = room.windows[0];
      if (wnd) {
        const centerU = (uAxisIsY ? room.y : room.x) + tw + (widths[i] - tw) / 2;
        room.windows[0] = mkWindow(room, farWall, centerU, 3.5, wnd.id);
      }
    });

    // core ke rooms me matching door (symbol sirf wing side par)
    for (const d of doorsToCore) d.room.doors = [...(d.room.doors || []), d.door];
    rooms.push(...built);
    out.added.push(...built.filter((b) => !b.isSubRoom).map((b) => b.name));
    out.wings.push(wing.rect);
  }
  return out;
}
