/* =========================================================
   v19 — GLOBAL DOOR CONFLICT RESOLVER
   Plan ban jaane ke BAAD har darwaze ka asli swing (jaise CadFloorPlansView draw karta hai) nikalte hain:
     • door-leaf ka quarter-circle  vs  doosre door ka quarter-circle   (leaf cross)
     • door-leaf  vs  doosre door ka opening (frame)
     • door-leaf  vs  stair block
     • do darwaze ke frame ek doosre par
   Conflict mile to pehle door ki POSITION (wall par khisakna, shared opening ke dono taraf),
   phir HINGE side, phir (sirf last resort) SWING side badalte hain. Jo option sabse kam conflict + sabse kam
   shift de wahi chunte hain. Koi hardcoded size/position nahi.
========================================================= */

type Disc = { cx: number; cy: number; r: number; sx: number; sy: number };
type Geo = { room: any; door: any; discs: Disc[]; frame: { x0: number; y0: number; x1: number; y1: number }; key: string };

const STEP = 0.1;       // sampling grid (ft)
const INFLATE = 0.12;   // leaf ke aas-paas clearance (ft)
const AREA_EPS = 0.05;  // sq ft — isse kam overlap ignore
const WALL_T = 0.34;

const isRendered = (d: any) => d && d.renderSymbol !== false && String(d.doorType || '').toUpperCase() !== 'OPENING';
const isDouble = (d: any) => !!(d.isDoubleLeaf || d.doubleLeaf || (d.leafCount && d.leafCount > 1) || String(d.doorType || '').toUpperCase() === 'MAIN');
const sid = (d: any) => String(d.sharedOpeningId || d.id || '');

/** CadFloorPlansView.renderCadDoorSymbol ke geometry ka exact mirror */
export function doorGeo(room: any, d: any): Geo | null {
  if (!isRendered(d)) return null;
  const dw = Number(d.widthFeet || 0), off = Number(d.offsetFeet || 0);
  if (!(dw > 0)) return null;
  const wall = String(d.wall || '').toUpperCase();
  const dbl = isDouble(d);
  const hingeEnd = String(d.hingeSide || '').toUpperCase() === 'END';
  const inside = !!d.swingInside;
  const discs: Disc[] = [];
  let frame;
  if (wall === 'TOP' || wall === 'BOTTOM') {
    const s = room.x + off, e = s + dw, wy = wall === 'TOP' ? room.y : room.y + room.h, into = wall === 'TOP' ? 1 : -1;
    frame = { x0: s, x1: e, y0: wy - WALL_T / 2, y1: wy + WALL_T / 2 };
    if (dbl) { discs.push({ cx: s, cy: wy, r: dw / 2, sx: 1, sy: into }, { cx: e, cy: wy, r: dw / 2, sx: -1, sy: into }); }
    else discs.push({ cx: hingeEnd ? e : s, cy: wy, r: dw, sx: hingeEnd ? -1 : 1, sy: into });
  } else if (wall === 'LEFT' || wall === 'RIGHT') {
    const s = room.y + off, e = s + dw, wx = wall === 'LEFT' ? room.x : room.x + room.w;
    const intoIn = wall === 'LEFT' ? 1 : -1;
    frame = { x0: wx - WALL_T / 2, x1: wx + WALL_T / 2, y0: s, y1: e };
    if (dbl) { discs.push({ cx: wx, cy: s, r: dw / 2, sx: intoIn, sy: 1 }, { cx: wx, cy: e, r: dw / 2, sx: intoIn, sy: -1 }); }
    else if (inside) discs.push({ cx: wx, cy: hingeEnd ? e : s, r: dw, sx: intoIn, sy: hingeEnd ? -1 : 1 });
    else discs.push({ cx: wx, cy: s, r: dw, sx: -intoIn, sy: 1 });
  } else return null;
  return { room, door: d, discs, frame, key: `${room.id || room.name}|${d.id || ''}|${wall}` };
}

const inDisc = (p: { x: number; y: number }, c: Disc, infl: number) => {
  const dx = p.x - c.cx, dy = p.y - c.cy;
  if (dx * c.sx < -infl || dy * c.sy < -infl) return false;
  return dx * dx + dy * dy <= (c.r + infl) * (c.r + infl);
};
const bbox = (g: Geo) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of g.discs) {
    const xa = c.cx, xb = c.cx + c.sx * (c.r + INFLATE), ya = c.cy, yb = c.cy + c.sy * (c.r + INFLATE);
    x0 = Math.min(x0, xa, xb); x1 = Math.max(x1, xa, xb); y0 = Math.min(y0, ya, yb); y1 = Math.max(y1, ya, yb);
  }
  return { x0, y0, x1, y1 };
};
const boxHit = (a: any, b: any) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.01 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.01;
const inGeo = (p: any, g: Geo, infl: number) => g.discs.some(c => inDisc(p, c, infl));

function sampleArea(a: Geo, pred: (p: { x: number; y: number }) => boolean): number {
  const b = bbox(a);
  let n = 0;
  for (let x = b.x0 + STEP / 2; x < b.x1; x += STEP)
    for (let y = b.y0 + STEP / 2; y < b.y1; y += STEP) {
      const p = { x, y };
      if (inGeo(p, a, INFLATE) && pred(p)) n++;
    }
  return n * STEP * STEP;
}

function stairRects(rooms: any[]) {
  const out: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  for (const r of rooms) {
    const e = r.embeddedStair;
    if (!e || r.isSubRoom) continue;
    const x0 = r.x + (e.relX ?? 0), y0 = r.y + (e.relY ?? 0);
    out.push({ x0, y0, x1: x0 + Number(e.w || 0), y1: y0 + Number(e.h || 0) });
  }
  return out;
}

export type DoorConflict = { a: string; b: string; kind: 'LEAF' | 'FRAME' | 'STAIR' | 'FRAME_FRAME'; roomA: string; roomB?: string; area: number };

/** sab conflicts ki list (resolver ke baad 0 hona chahiye) */
export function findDoorConflicts(rooms: any[]): DoorConflict[] {
  const geos: Geo[] = [];
  for (const r of rooms) for (const d of (r.doors || [])) { const g = doorGeo(r, d); if (g) geos.push(g); }
  const stairs = stairRects(rooms);
  const out: DoorConflict[] = [];
  for (let i = 0; i < geos.length; i++) {
    const a = geos[i];
    const ba = bbox(a);
    for (const st of stairs) {
      if (!boxHit(ba, st)) continue;
      const ar = sampleArea(a, p => p.x > st.x0 && p.x < st.x1 && p.y > st.y0 && p.y < st.y1);
      if (ar > AREA_EPS) out.push({ a: a.key, b: 'STAIR', kind: 'STAIR', roomA: a.room.name, area: ar });
    }
    for (let j = i + 1; j < geos.length; j++) {
      const b = geos[j];
      if (sid(a.door) && sid(a.door) === sid(b.door)) continue;
      if (a.room === b.room && (a.door.id || '') === (b.door.id || '') && a.door.wall === b.door.wall) continue;
      if (boxHit(a.frame, b.frame)) { out.push({ a: a.key, b: b.key, kind: 'FRAME_FRAME', roomA: a.room.name, roomB: b.room.name, area: 0 }); continue; }
      const bb = bbox(b);
      if (boxHit(ba, bb)) {
        const ar = sampleArea(a, p => inGeo(p, b, INFLATE));
        if (ar > AREA_EPS) { out.push({ a: a.key, b: b.key, kind: 'LEAF', roomA: a.room.name, roomB: b.room.name, area: ar }); continue; }
      }
      // leaf vs doosre ka frame (opening)
      const fa = sampleArea(a, p => p.x > b.frame.x0 && p.x < b.frame.x1 && p.y > b.frame.y0 && p.y < b.frame.y1);
      const fb = sampleArea(b, p => p.x > a.frame.x0 && p.x < a.frame.x1 && p.y > a.frame.y0 && p.y < a.frame.y1);
      if (fa > AREA_EPS * 0.4 || fb > AREA_EPS * 0.4) out.push({ a: a.key, b: b.key, kind: 'FRAME', roomA: a.room.name, roomB: b.room.name, area: Math.max(fa, fb) });
    }
  }
  return out;
}

const countFor = (rooms: any[], geoOf: (r: any, d: any) => Geo | null = doorGeo) => findDoorConflicts(rooms).length;


/* ---------------------------------------------------------------------------------------------
   v19b — WET BLOCK (dressing / attached toilet) vs BEDROOM DOOR
   Dressing ya toilet ki wall bedroom ke darwaze (frame ya leaf) ko overlap kare to:
     1) dressing ko door se door se thoda chhota karo (door ki width kabhi kam nahi hoti, pad 0.25 ft)
     2) dressing bahut chhota ban jaye (< 3.4 ft side ya < 24 sq.ft) to darwaze ko wall par khisakao
     3) wo bhi na ho to dressing hata do aur uska bacha hissa bathroom me jod do (bathroom bada, <= 12 ft)
------------------------------------------------------------------------------------------------ */
const subsOf = (all: any[], B: any) => all.filter(t => t !== B && (t.attachedTo === B.id || t.subZoneOf === B.id) && /DRESSING|ATTACHED TOILET/.test(String(t.name || '')));

function wetClash(g: Geo, S: any): boolean {
  const inf = 0.12;
  const sb = { x0: S.x - inf, y0: S.y - inf, x1: S.x + S.w + inf, y1: S.y + S.h + inf };
  const f = g.frame;
  const fr = { x0: f.x0 - 0.02, y0: f.y0 - 0.02, x1: f.x1 + 0.02, y1: f.y1 + 0.02 };
  if (boxHit(fr, sb)) {
    // frame wall line par S ke andar tak ghus raha ho (sirf touch nahi)
    const ox = Math.min(f.x1, S.x + S.w) - Math.max(f.x0, S.x), oy = Math.min(f.y1, S.y + S.h) - Math.max(f.y0, S.y);
    if (ox > 0.03 && oy > 0.08) return true;
  }
  return sampleArea(g, p => p.x > S.x && p.x < S.x + S.w && p.y > S.y && p.y < S.y + S.h) > 0.05;
}

export function fixWetBlockDoorClashes(all: any[]): void {
  // 0) toilet / dressing duct ke upar chadh gaye ho to duct tak kaato, phir upar ki khali patti bathroom le le (<= 12 ft)
  for (const D of all.filter(r => r.name === 'DUCT')) {
    for (const T of all.filter(r => /ATTACHED TOILET|DRESSING/.test(String(r.name)) && r.attachedTo === D.attachedTo)) {
      const ox = Math.min(T.x + T.w, D.x + D.w) - Math.max(T.x, D.x), oy = Math.min(T.y + T.h, D.y + D.h) - Math.max(T.y, D.y);
      if (ox > 0.05 && oy > 0.05 && T.y < D.y - 0.05 && D.y - T.y >= 4.5) {
        T.h = Number((D.y - T.y).toFixed(3)); T.areaPerRoom = Number((T.w * T.h).toFixed(2));
        for (const d of (T.doors || [])) if (d.wall === 'LEFT' || d.wall === 'RIGHT') d.offsetFeet = Number(Math.max(0.3, Math.min(d.offsetFeet || 0, T.h - (d.widthFeet || 2.5) - 0.3)).toFixed(2));
      }
    }
  }
  const beds = all.filter(r => /BEDROOM/.test(String(r.name || '')) && !r.isSubRoom && !r.subZoneOf);
  let guard = 0, changed = true;
  while (changed && guard++ < 12) {
    changed = false;
    for (const B of beds) {
      for (const D of (B.doors || [])) {
        const g = doorGeo(B, D); if (!g) continue;
        const wall = String(D.wall).toUpperCase();
        const horiz = wall === 'TOP' || wall === 'BOTTOM';
        const a = horiz ? B.x + D.offsetFeet : B.y + D.offsetFeet, b = a + Number(D.widthFeet || 3);
        for (const S of subsOf(all, B)) {
          if (!wetClash(g, S)) continue;
          const touch = wall === 'TOP' ? Math.abs(S.y - B.y) < 0.12 : wall === 'BOTTOM' ? Math.abs(S.y + S.h - (B.y + B.h)) < 0.12
            : wall === 'LEFT' ? Math.abs(S.x - B.x) < 0.12 : Math.abs(S.x + S.w - (B.x + B.w)) < 0.12;
          const s0 = horiz ? S.x : S.y, s1 = s0 + (horiz ? S.w : S.h), other = horiz ? S.h : S.w;
          const isDress = /DRESSING/.test(String(S.name));
          const minLen = isDress ? 3.4 : 4.5, minArea = isDress ? 24 : 28, pad = 0.25;
          // piece after cutting out the door span
          let n0 = s0, n1 = s1;
          if (touch) {
            if (a - pad > s0 + 0.01 && b + pad >= s1 - 0.01) n1 = a - pad;
            else if (b + pad < s1 - 0.01 && a - pad <= s0 + 0.01) n0 = b + pad;
            else { n0 = n1 = NaN; }
          } else { n0 = n1 = NaN; }
          const okShrink = Number.isFinite(n0) && (n1 - n0) >= minLen && (n1 - n0) * other >= minArea;
          const apply = (m0: number, m1: number) => {
            const oldAbs = (dd: any) => (horiz ? S.x : S.y) + (dd.offsetFeet || 0);
            const keep = (S.doors || []).map((dd: any) => ({ dd, abs: oldAbs(dd), w: dd.widthFeet || 2.5 }));
            if (horiz) { S.x = Number(m0.toFixed(3)); S.w = Number((m1 - m0).toFixed(3)); } else { S.y = Number(m0.toFixed(3)); S.h = Number((m1 - m0).toFixed(3)); }
            S.areaPerRoom = Number((S.w * S.h).toFixed(2));
            for (const k of keep) {
              const dwall = String(k.dd.wall).toUpperCase();
              const along = (dwall === 'TOP' || dwall === 'BOTTOM') === horiz;
              if (!along) continue;
              const len = horiz ? S.w : S.h, st = horiz ? S.x : S.y;
              k.dd.offsetFeet = Number(Math.max(0.3, Math.min(len - k.w - 0.3, k.abs - st)).toFixed(2));
            }
          };
          if (okShrink) { apply(n0, n1); changed = true; break; }
          // 2) darwaza khisakao
          const mates: Array<{ room: any; door: any }> = [];
          const id = sid(D);
          if (id) for (const r2 of all) if (r2 !== B) for (const q of (r2.doors || [])) if (q !== D && sid(q) === id) mates.push({ room: r2, door: q });
          let lo = horiz ? B.x : B.y, hi = lo + (horiz ? B.w : B.h);
          for (const m of mates) { const ms = horiz ? m.room.x : m.room.y, ml = horiz ? m.room.w : m.room.h; lo = Math.max(lo, ms); hi = Math.min(hi, ms + ml); }
          const dw = Number(D.widthFeet || 3), o0 = D.offsetFeet, base = horiz ? B.x : B.y;
          const subsB = subsOf(all, B), before = findDoorConflicts(all).length;
          let bestO: number | null = null, bd = Infinity;
          for (let t = lo + 0.4; t <= hi - dw - 0.4 + 1e-6; t += 0.25) {
            D.offsetFeet = Number((t - base).toFixed(2));
            const g2 = doorGeo(B, D)!;
            if (subsB.some(x => wetClash(g2, x))) continue;
            for (const m of mates) m.door.offsetFeet = Number((t - (horiz ? m.room.x : m.room.y)).toFixed(2));
            const n = findDoorConflicts(all).length;
            if (n <= before && Math.abs(t - base - o0) < bd) { bd = Math.abs(t - base - o0); bestO = D.offsetFeet; }
          }
          if (bestO !== null) { D.offsetFeet = bestO; for (const m of mates) m.door.offsetFeet = Number(((base + bestO) - (horiz ? m.room.x : m.room.y)).toFixed(2)); D.__resolved = true; changed = true; break; }
          D.offsetFeet = o0; for (const m of mates) m.door.offsetFeet = Number((base + o0 - (horiz ? m.room.x : m.room.y)).toFixed(2));
          // 3) dressing hatao, bacha hissa (agar hai) bathroom me jodo
          if (isDress) {
            const T = subsOf(all, B).find(t => /ATTACHED TOILET/.test(String(t.name)) && t !== S);
            const keepPiece = Number.isFinite(n0) && (n1 - n0) > 0.4;
            if (T && keepPiece) {
              const pieceRect = horiz ? { x: n0, y: S.y, w: n1 - n0, h: S.h } : { x: S.x, y: n0, w: S.w, h: n1 - n0 };
              const side = horiz && Math.abs(T.y - pieceRect.y) < 0.06 && Math.abs(T.h - pieceRect.h) < 0.06 && (Math.abs(T.x + T.w - pieceRect.x) < 0.08 || Math.abs(pieceRect.x + pieceRect.w - T.x) < 0.08);
              const stack = !horiz && Math.abs(T.x - pieceRect.x) < 0.06 && Math.abs(T.w - pieceRect.w) < 0.06 && (Math.abs(T.y + T.h - pieceRect.y) < 0.08 || Math.abs(pieceRect.y + pieceRect.h - T.y) < 0.08);
              if (side || stack) {
                const nx0 = Math.min(T.x, pieceRect.x), ny0 = Math.min(T.y, pieceRect.y);
                const nx1 = Math.max(T.x + T.w, pieceRect.x + pieceRect.w), ny1 = Math.max(T.y + T.h, pieceRect.y + pieceRect.h);
                const tdoors = (T.doors || []).map((dd: any) => ({ dd, abs: ((String(dd.wall).toUpperCase() === 'TOP' || String(dd.wall).toUpperCase() === 'BOTTOM') ? T.x : T.y) + (dd.offsetFeet || 0) }));
                T.x = Number(nx0.toFixed(3)); T.y = Number(ny0.toFixed(3)); T.w = Number((nx1 - nx0).toFixed(3)); T.h = Number((ny1 - ny0).toFixed(3));
                T.areaPerRoom = Number((T.w * T.h).toFixed(2));
                for (const k of tdoors) { const hz = String(k.dd.wall).toUpperCase() === 'TOP' || String(k.dd.wall).toUpperCase() === 'BOTTOM'; const st = hz ? T.x : T.y, len = hz ? T.w : T.h; k.dd.offsetFeet = Number(Math.max(0.3, Math.min(len - (k.dd.widthFeet || 2.5) - 0.3, k.abs - st)).toFixed(2)); }
                (T as any).absorbedDressing = true;
              }
            }
            all.splice(all.indexOf(S), 1);
            changed = true; break;
          }
        }
        if (changed) break;
      }
      if (changed) break;
    }
  }
}

type Variant = { off: number; hinge: 'START' | 'END'; inside: boolean; disp: number };

/**
 * Plan ke har darwaze ke liye conflict resolve karo.
 * Order: (1) offset (position)  (2) hinge side  (3) swing side (L/R walls, non-wet rooms)
 */
export function resolveDoorConflicts(rooms: any[], W: number, H: number): any[] {
  const all = rooms as any[];
  try { fixWetBlockDoorClashes(all); } catch (e) { if (typeof console !== 'undefined') console.warn('[WET/DOOR] fix failed', e); }
  let guard = 0;
  let conflicts = findDoorConflicts(all);
  const MOVABLE = (d: any) => isRendered(d) && !isDouble(d) && String(d.doorType || '').toUpperCase() !== 'MAIN';
  while (conflicts.length && guard++ < 24) {
    const before = conflicts.length;
    // conflict me aaye darwaze (unique)
    const keys = new Set<string>();
    for (const c of conflicts) { keys.add(c.a); if (c.b !== 'STAIR') keys.add(c.b); }
    const cand: Array<{ room: any; door: any }> = [];
    for (const r of all) for (const d of (r.doors || [])) {
      const k = `${r.id || r.name}|${d.id || ''}|${String(d.wall || '').toUpperCase()}`;
      if (keys.has(k) && MOVABLE(d)) cand.push({ room: r, door: d });
    }
    let bestPick: { room: any; door: any; v: Variant; n: number } | null = null;
    for (const { room, door } of cand) {
      const wall = String(door.wall).toUpperCase();
      const horiz = wall === 'TOP' || wall === 'BOTTOM';
      const dw = Number(door.widthFeet || 0);
      const start0 = horiz ? room.x : room.y;
      const len = horiz ? room.w : room.h;
      let lo = start0, hi = start0 + len;
      // shared counterparts: opening dono rooms ke common span me hi rahe
      const mates: Array<{ room: any; door: any }> = [];
      const id = sid(door);
      if (id) for (const r2 of all) if (r2 !== room) for (const q of (r2.doors || [])) if (q !== door && sid(q) === id) mates.push({ room: r2, door: q });
      for (const m of mates) {
        const ms = horiz ? m.room.x : m.room.y, ml = horiz ? m.room.w : m.room.h;
        lo = Math.max(lo, ms); hi = Math.min(hi, ms + ml);
      }
      const clr = /TOILET|BATH|DRESSING/i.test(String(room.name || '')) ? 0.5 : 0.35;
      const o0 = Number(door.offsetFeet || 0), h0: 'START' | 'END' = String(door.hingeSide || '').toUpperCase() === 'END' ? 'END' : 'START', in0 = !!door.swingInside;
      const variants: Variant[] = [];
      const canSide = !horiz && !/TOILET|BATH|DRESSING|DUCT/i.test(String(room.name || '')) && String(door.doorType || '').toUpperCase() === 'INTERNAL' && mates.length > 0;
      for (let s = lo + clr; s <= hi - dw - clr + 1e-6; s += 0.25) {
        const off = Number((s - start0).toFixed(2));
        for (const hinge of ['START', 'END'] as const) {
          variants.push({ off, hinge, inside: in0, disp: Math.abs(off - o0) + (hinge === h0 ? 0 : 0.6) });
          if (canSide) variants.push({ off, hinge, inside: !in0, disp: Math.abs(off - o0) + (hinge === h0 ? 0 : 0.6) + 3 });
        }
      }
      for (const v of variants) {
        if (v.off === o0 && v.hinge === h0 && v.inside === in0) continue;
        const sOff = door.offsetFeet, sH = door.hingeSide, sI = door.swingInside;
        const mOff = mates.map(m => m.door.offsetFeet);
        door.offsetFeet = v.off; door.hingeSide = v.hinge; door.swingInside = v.inside;
        for (const m of mates) m.door.offsetFeet = Number(((start0 + v.off) - (horiz ? m.room.x : m.room.y)).toFixed(2));
        const n = countFor(all);
        door.offsetFeet = sOff; door.hingeSide = sH; door.swingInside = sI;
        mates.forEach((m, i) => { m.door.offsetFeet = mOff[i]; });
        const better = !bestPick || n < bestPick.n || (n === bestPick.n && v.disp < bestPick.v.disp);
        if (n < before && better) bestPick = { room, door, v, n };
      }
    }
    if (!bestPick) break;
    const { room, door, v } = bestPick;
    const wall = String(door.wall).toUpperCase();
    const horiz = wall === 'TOP' || wall === 'BOTTOM';
    const start0 = horiz ? room.x : room.y;
    const id = sid(door);
    door.offsetFeet = v.off; door.hingeSide = v.hinge; door.swingInside = v.inside;
    door.__resolved = true;
    if (id) for (const r2 of all) if (r2 !== room) for (const q of (r2.doors || [])) if (q !== door && sid(q) === id) q.offsetFeet = Number(((start0 + v.off) - (horiz ? r2.x : r2.y)).toFixed(2));
    conflicts = findDoorConflicts(all);
    if (conflicts.length >= before) break;
  }
  if (conflicts.length && typeof console !== 'undefined') console.warn('[DOOR RESOLVER] bache hue conflicts', conflicts.map(c => `${c.roomA}${c.roomB ? '/' + c.roomB : ''}:${c.kind}`));
  return rooms;
}
