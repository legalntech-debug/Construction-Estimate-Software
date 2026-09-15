/* =========================================================
   CONSTRUCTION PLAN SYSTEM — PLANNING SCORE ENGINE
   ---------------------------------------------------------
   Two scoring modes in one file:
     1. Single-plan scoring (existing): scorePlan()
     2. Multi-candidate scoring (new): scoreCandidate()
========================================================= */

import { FloorRoom, PlanCandidateScore } from './planningTypes';
import { buildCirculationGraph } from './circulationPlanner';
import { getRoadOrientation } from './roadOrientation';

// ============================================================
// WEIGHTS for multi-candidate scoring
// ============================================================

export const SCORE_WEIGHTS = {
  vastu: 0.25,
  circulation: 0.20,
  space: 0.20,
  lighting: 0.20,
  plumbing: 0.15,
} as const;

// ============================================================
// EXISTING: Single-plan score
// ============================================================

export interface PlanningScore {
  total: number;
  circulation: number;
  privacy: number;
  service: number;
  proportions: number;
  notes: string[];
}

function kind(r: FloorRoom) {
  const s = `${r.type || ''} ${r.name || ''}`.toLowerCase();
  if (s.includes('parking')) return 'parking';
  if (s.includes('hall') || s.includes('living')) return 'hall';
  if (s.includes('stair')) return 'stairs';
  if (s.includes('kitchen')) return 'kitchen';
  if (s.includes('dining')) return 'dining';
  if (s.includes('bedroom') || s.includes('master')) return 'bedroom';
  if (s.includes('bath') || s.includes('toilet')) return 'bathroom';
  if (s.includes('duct')) return 'duct';
  return 'other';
}

export function scorePlan(rooms: FloorRoom[]): PlanningScore {
  let circulation = 100, privacy = 100, service = 100, proportions = 100;
  const notes: string[] = [];
  const graph = buildCirculationGraph(rooms);
  if (!graph.connected) { circulation -= graph.unreachableRooms.length * 25; notes.push(`Unreachable: ${graph.unreachableRooms.join(', ')}`); }
  const parking = rooms.find(r => kind(r) === 'parking');
  const hall = rooms.find(r => kind(r) === 'hall');
  const stairs = rooms.find(r => kind(r) === 'stairs');
  if (parking && hall) {
    const direct = graph.edges.some(e => (e.from === parking.name && e.to === hall.name) || (e.from === hall.name && e.to === parking.name));
    if (!direct) circulation -= 25;
  }
  if (stairs && hall) {
    const direct = graph.edges.some(e => (e.from === stairs.name && e.to === hall.name) || (e.from === hall.name && e.to === stairs.name));
    if (!direct) circulation -= 15;
  }
  const bedrooms = rooms.filter(r => kind(r) === 'bedroom');
  for (const b of bedrooms) if ((b.y || 0) > 0) privacy += 1;
  const toilets = rooms.filter(r => kind(r) === 'bathroom');
  if (toilets.length) {
    const ducts = rooms.filter(r => kind(r) === 'duct');
    if (!ducts.length) service -= 12;
  }
  for (const r of rooms) {
    const min = Math.min(Number(r.w || 0), Number(r.h || 0));
    if (kind(r) === 'bedroom' && min < 9.5) proportions -= 12;
    if (kind(r) === 'hall' && min < 9) proportions -= 10;
    if (kind(r) === 'parking' && min < 9) proportions -= 20;
  }
  const total = Math.max(0, Math.round(circulation * .35 + privacy * .15 + service * .20 + proportions * .30));
  return { total, circulation, privacy, service, proportions, notes };
}

// ============================================================
// NEW: Multi-candidate scoring
// ============================================================

function num(v: any, d = 0) { const x = Number(v); return Number.isFinite(x) ? x : d; }

function kind2(r: FloorRoom): string {
  const s = `${r.type || ''} ${r.name || ''}`.toLowerCase();
  if (s.includes('parking')) return 'parking';
  if (s.includes('stair')) return 'stairs';
  if (s.includes('duct')) return 'duct';
  if (s.includes('kitchen')) return 'kitchen';
  if (s.includes('master')) return 'master';
  if (s.includes('bedroom') || s.includes('bed')) return 'bedroom';
  if (s.includes('living') || s.includes('hall') || s.includes('drawing')) return 'living';
  if (s.includes('dining')) return 'dining';
  if (s.includes('toilet') || s.includes('bath') || s === 'wc') return 'toilet';
  if (s.includes('pooja')) return 'pooja';
  if (s.includes('study')) return 'study';
  if (s.includes('passage') || s.includes('corridor')) return 'passage';
  if (s.includes('balcony')) return 'balcony';
  return 'other';
}

function center(r: FloorRoom): { cx: number; cy: number } {
  return {
    cx: num(r.x) + num(r.w) / 2,
    cy: num(r.y) + num(r.h) / 2,
  };
}

function touching(a: FloorRoom, b: FloorRoom): boolean {
  const ax = num(a.x), ay = num(a.y), aw = num(a.w), ah = num(a.h);
  const bx = num(b.x), by = num(b.y), bw = num(b.w), bh = num(b.h);
  const xo = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
  const yo = Math.min(ay + ah, by + bh) - Math.max(ay, by);
  return ((Math.abs(ay + ah - by) < 0.3 || Math.abs(by + bh - ay) < 0.3) && xo > 0.3) ||
         ((Math.abs(ax + aw - bx) < 0.3 || Math.abs(bx + bw - ax) < 0.3) && yo > 0.3);
}

// -- 1. Vastu Compliance --
function scoreVastu(rooms: FloorRoom[], W: number, H: number, roadSide: string): number {
  const orientation = getRoadOrientation(roadSide || '1 SIDE ROAD (SOUTH)');
  if (!rooms.length) return 50;

  function dirOf(r: FloorRoom): string {
    const { cx, cy } = center(r);
    const horizontal = cx < W / 2 ? orientation.leftCardinal : orientation.rightCardinal;
    const vertical = cy < H / 2 ? orientation.topCardinal : orientation.bottomCardinal;
    const pair = new Set([horizontal, vertical]);
    if (pair.has('NORTH') && pair.has('EAST')) return 'NE';
    if (pair.has('NORTH') && pair.has('WEST')) return 'NW';
    if (pair.has('SOUTH') && pair.has('EAST')) return 'SE';
    if (pair.has('SOUTH') && pair.has('WEST')) return 'SW';
    if (pair.has('NORTH')) return 'N';
    if (pair.has('SOUTH')) return 'S';
    if (pair.has('EAST')) return 'E';
    if (pair.has('WEST')) return 'W';
    return 'CENTER';
  }

  let totalPoints = 0, maxPoints = 0;
  for (const r of rooms) {
    const k = kind2(r);
    const dir = dirOf(r);
    let pts = 0, cap = 0;

    if (k === 'kitchen') { cap = 20; pts = dir === 'SE' ? 20 : dir === 'NW' ? 12 : 5; }
    else if (k === 'pooja') { cap = 20; pts = dir === 'NE' ? 20 : 5; }
    else if (k === 'master') { cap = 20; pts = dir === 'SW' ? 20 : (dir === 'S' || dir === 'W') ? 14 : 6; }
    else if (k === 'stairs') { cap = 15; pts = ['S', 'SW', 'W'].includes(dir) ? 15 : 6; }
    else if (k === 'toilet') { cap = 10; pts = ['NW', 'W'].includes(dir) ? 10 : dir === 'SE' ? 4 : 7; }
    else if (k === 'living') { cap = 10; pts = ['E', 'NE', 'N'].includes(dir) ? 10 : 6; }
    else if (k === 'bedroom') { cap = 8; pts = ['W', 'SW', 'S'].includes(dir) ? 8 : 4; }
    else { cap = 5; pts = 3; }

    totalPoints += pts;
    maxPoints += cap;
  }

  return maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 50;
}

// -- 2. Circulation Efficiency --
function scoreCirculationMulti(rooms: FloorRoom[], W: number, H: number): number {
  if (!rooms.length) return 50;
  const totalArea = W * H;
  const passageArea = rooms.filter(r => kind2(r) === 'passage').reduce((s, r) => s + num(r.w) * num(r.h), 0);
  const ratio = totalArea > 0 ? passageArea / totalArea : 0;

  let score = 100;
  if (ratio > 0.05) score -= (ratio - 0.05) * 300;
  if (ratio > 0.12) score -= (ratio - 0.12) * 400;

  const passages = rooms.filter(r => kind2(r) === 'passage');
  if (passages.length > 2) score -= (passages.length - 2) * 5;

  const living = rooms.find(r => kind2(r) === 'living');
  const bedCount = rooms.filter(r => ['bedroom', 'master'].includes(kind2(r))).length;
  if (living && bedCount > 0) {
    const direct = rooms.filter(r => ['bedroom', 'master'].includes(kind2(r)) && touching(r, living)).length;
    score += (direct / bedCount) * 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// -- 3. Space Utilization --
function scoreSpace(rooms: FloorRoom[], W: number, H: number): number {
  if (!rooms.length || W * H === 0) return 50;
  const totalArea = W * H;
  const usableArea = rooms
    .filter(r => !['passage', 'duct'].includes(kind2(r)))
    .reduce((s, r) => s + num(r.w) * num(r.h), 0);
  const ratio = usableArea / totalArea;

  let score = 50;
  if (ratio >= 0.85) score = 95;
  else if (ratio >= 0.75) score = 85;
  else if (ratio >= 0.65) score = 75;
  else if (ratio >= 0.55) score = 60;
  else score = 40;

  for (const r of rooms) {
    const w = num(r.w), h = num(r.h);
    const rRatio = Math.max(w, h) / Math.max(0.1, Math.min(w, h));
    if (rRatio > 2.6 && !['passage', 'duct', 'balcony'].includes(kind2(r))) score -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// -- 4. Lighting & Ventilation --
function scoreLighting(rooms: FloorRoom[], W: number, H: number): number {
  if (!rooms.length) return 50;
  const habitable = rooms.filter(r => !['duct', 'passage'].includes(kind2(r)));
  if (!habitable.length) return 50;

  let exposed = 0;
  for (const r of habitable) {
    const x = num(r.x), y = num(r.y), w = num(r.w), h = num(r.h);
    if (Math.abs(x) < 0.5 || Math.abs(y) < 0.5 || Math.abs(x + w - W) < 0.5 || Math.abs(y + h - H) < 0.5) exposed++;
  }
  const exposureRatio = exposed / habitable.length;

  const wetRooms = rooms.filter(r => kind2(r) === 'toilet');
  const ducts = rooms.filter(r => kind2(r) === 'duct');
  let wetScore = 100;
  if (wetRooms.length > 0 && ducts.length === 0) wetScore = 60;

  return Math.max(0, Math.min(100, Math.round(exposureRatio * 70 + (wetScore / 100) * 30)));
}

// -- 5. Plumbing Clustering --
function scorePlumbing(rooms: FloorRoom[]): number {
  const wet = rooms.filter(r => ['kitchen', 'toilet'].includes(kind2(r)));
  if (wet.length === 0) return 80;
  if (wet.length === 1) return 70;

  let totalDist = 0, count = 0;
  for (let i = 0; i < wet.length; i++) {
    for (let j = i + 1; j < wet.length; j++) {
      const a = wet[i], b = wet[j];
      totalDist += Math.hypot(
        (num(a.x) + num(a.w) / 2) - (num(b.x) + num(b.w) / 2),
        (num(a.y) + num(a.h) / 2) - (num(b.y) + num(b.h) / 2)
      );
      count++;
    }
  }
  const avg = count > 0 ? totalDist / count : 0;

  let score = 100;
  if (avg > 15) score -= (avg - 15) * 3;
  if (avg > 30) score -= (avg - 30) * 2;

  const ducts = rooms.filter(r => kind2(r) === 'duct');
  const toilets = rooms.filter(r => kind2(r) === 'toilet');
  let ductAdjacency = 0;
  for (const d of ducts) {
    if (toilets.some(t => touching(t, d))) ductAdjacency++;
  }
  if (toilets.length > 0) score += (ductAdjacency / toilets.length) * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// -- Master multi-candidate scorer --
export function scoreCandidate(
  rooms: FloorRoom[],
  W: number,
  H: number,
  roadSide: string,
): PlanCandidateScore {
  const vastu = scoreVastu(rooms, W, H, roadSide);
  const circulation = scoreCirculationMulti(rooms, W, H);
  const space = scoreSpace(rooms, W, H);
  const lighting = scoreLighting(rooms, W, H);
  const plumbing = scorePlumbing(rooms);

  const total = Math.round(
    vastu * SCORE_WEIGHTS.vastu +
    circulation * SCORE_WEIGHTS.circulation +
    space * SCORE_WEIGHTS.space +
    lighting * SCORE_WEIGHTS.lighting +
    plumbing * SCORE_WEIGHTS.plumbing
  );

  return { vastu, circulation, space, lighting, plumbing, total };
}