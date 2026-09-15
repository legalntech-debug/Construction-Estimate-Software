/* =========================================================
   CONSTRUCTION PLAN SYSTEM — MULTI-CANDIDATE GENERATOR
   ---------------------------------------------------------
   Generates N candidate layouts, each following a distinct
   architectural strategy, and scores them using the weighted
   planScorer (vastu 25%, circulation 20%, space 20%,
   lighting 20%, plumbing 15%).
========================================================= */

import { FloorRoom, CandidateStrategy, PlanCandidate } from './planningTypes';
import { buildResidentialLayout, programFromInput, extractSpecsForCandidate } from './roomPlanner';
import { calculateStaircase, StaircaseType } from './stairPlanner';
import { scoreCandidate } from './planningScore';

interface CandidateConfig {
  strategy: CandidateStrategy;
  label: string;
  description: string;
}

/**
 * 8 candidate strategies. Each uses the SAME program (same rooms,
 * same user-provided sizes) but a DIFFERENT placement philosophy.
 * The strategy is passed to buildResidentialLayout which will
 * (Phase 2B) apply strategy-specific zoning tweaks.
 */
export const CANDIDATE_CONFIGS: CandidateConfig[] = [
  { strategy: 'VASTU_OPTIMIZED',        label: 'Vastu Optimized',        description: 'Traditional Vastu Shastra compliant placement' },
  { strategy: 'SPACE_EFFICIENT',        label: 'Space Efficient',        description: 'Minimal circulation, maximum usable area' },
  { strategy: 'PRIVACY_FOCUSED',        label: 'Privacy Focused',        description: 'Bedrooms away from public zones' },
  { strategy: 'PLUMBING_CLUSTERED',     label: 'Plumbing Clustered',     description: 'Kitchen and toilets grouped for cost efficiency' },
  { strategy: 'LIGHT_VENTILATION',      label: 'Light & Ventilation',    description: 'Maximum exterior exposure for habitable rooms' },
  { strategy: 'CIRCULATION_OPTIMIZED',  label: 'Circulation Optimized',  description: 'Shortest corridors, direct access' },
  { strategy: 'FLEXIBLE_ZONING',        label: 'Flexible Zoning',        description: 'Public front, private back — vertical efficiency' },
  { strategy: 'BALANCED',               label: 'Balanced',               description: 'Even trade-off across all factors' },
];

export interface MultiCandidateRequest {
  floorName: string;
  width: number;
  length: number;
  bhk?: string;
  selectedRooms?: any;
  planningMode?: string;
  roadSide?: string;
  floorToFloorHeightFeet?: number;
  planningArea?: number;
  parkingMode?: any;
}

export interface MultiCandidateResult {
  candidates: PlanCandidate[];
  topCandidateId: string | null;
}

/**
 * Generates all candidate layouts.
 * Each candidate:
 *   1. Uses the SAME program (same rooms + user sizes)
 *   2. Uses a DIFFERENT architectural strategy
 *   3. Is validated (overlaps + boundary)
 *   4. Is scored via scoreCandidate() from planningScore.ts
 *   5. Gets computed metrics for the UI comparison table
 */
export function generateAllCandidates(request: MultiCandidateRequest): MultiCandidateResult {
  const W = Math.max(1, Number(request.width) || 20);
  const H = Math.max(1, Number(request.length) || 40);
  const ground = String(request.floorName || '').toUpperCase().includes('GROUND');
  const mode = String(request.planningMode || 'AUTO').toUpperCase();
  const area = Number(request.planningArea) || W * H;

  const specs = extractSpecsForCandidate(request.selectedRooms);
  const program = programFromInput(
    request.selectedRooms,
    request.bhk || 'AUTO',
    area,
    ground,
    mode,
    W,
    H,
  );

  const stairType: StaircaseType =
    W >= 28 && H >= 45 ? 'DOG_LEGGED' :
    W >= 18 && H >= 38 ? 'L_SHAPED' : 'STRAIGHT';

  const staircase = calculateStaircase(
    Number(request.floorToFloorHeightFeet) || 10,
    6.8,
    stairType,
  );

  const parkingMode = String(request.parkingMode || 'CAR').toUpperCase();

  const candidates: PlanCandidate[] = [];

  for (const cfg of CANDIDATE_CONFIGS) {
    let rooms: FloorRoom[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      rooms = buildResidentialLayout(
        program,
        specs,
        W,
        H,
        ground,
        staircase,
        parkingMode as any,
        cfg.strategy,   // strategy parameter — Phase 2B will use this
      );
    } catch (e: any) {
      errors.push(`Strategy ${cfg.strategy} failed: ${e?.message || 'unknown error'}`);
    }

    // Validate: no overlaps (with 0.15 ft tolerance so sub-room
    // boundaries shared with parent rooms don't false-positive),
    // and all rooms within floor bounds.
    const valid = validateCandidate(rooms, W, H, errors);

    const score = valid
      ? scoreCandidate(rooms, W, H, request.roadSide || '1 SIDE ROAD (SOUTH)')
      : { vastu: 0, circulation: 0, space: 0, lighting: 0, plumbing: 0, total: 0 };

    const metrics = computeMetrics(rooms, W, H);

    // Collect furniture warnings for this candidate
    if (valid) {
      for (const r of rooms) {
        const w = Number(r.w) || 0;
        const h = Number(r.h) || 0;
        const minDim = Math.min(w, h);
        const maxDim = Math.max(w, h);
        const name = String(r.name || r.type || '').toUpperCase();
        if (minDim < 3 && !name.includes('DUCT')) {
          warnings.push(`${r.name} is very narrow (${minDim.toFixed(1)} ft).`);
        }
        if (maxDim > 0 && minDim > 0 && maxDim / minDim > 2.6 && !name.includes('PASSAGE') && !name.includes('DUCT')) {
          warnings.push(`${r.name} is too elongated (${(maxDim / minDim).toFixed(1)}:1).`);
        }
      }
    }

    candidates.push({
      id: `${cfg.strategy}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      strategy: cfg.strategy,
      strategyLabel: cfg.label,
      strategyDescription: cfg.description,
      rooms,
      score,
      warnings,
      errors,
      isValid: valid,
      metrics,
    });
  }

  // Sort by total score descending (highest first)
  candidates.sort((a, b) => b.score.total - a.score.total);

  // Top candidate = highest-scoring VALID candidate
  const topCandidateId = candidates.find(c => c.isValid)?.id || null;

  if (typeof console !== 'undefined') {
    console.groupCollapsed('[CANDIDATE GENERATOR] RESULTS');
    console.log('Total candidates:', candidates.length);
    for (const c of candidates) {
      console.log(
        `${c.strategy.padEnd(22)} | total=${c.score.total.toString().padStart(3)} | ` +
        `vastu=${c.score.vastu} circ=${c.score.circulation} space=${c.score.space} ` +
        `light=${c.score.lighting} plumb=${c.score.plumbing} | ` +
        `valid=${c.isValid} | rooms=${c.rooms.length}`
      );
    }
    console.log('Top candidate:', topCandidateId);
    console.groupEnd();
  }

  return { candidates, topCandidateId };
}

/**
 * Validates a candidate layout:
 *   - Every room inside the floor boundary
 *   - No two non-sub rooms overlap by more than 0.15 ft (tolerance
 *     avoids false positives on shared boundaries)
 */
function validateCandidate(
  rooms: FloorRoom[],
  W: number,
  H: number,
  errors: string[],
): boolean {
  if (!rooms.length) {
    errors.push('No rooms placed.');
    return false;
  }

  // Boundary check
  for (const r of rooms) {
    const x = Number(r.x) || 0;
    const y = Number(r.y) || 0;
    const w = Number(r.w) || 0;
    const h = Number(r.h) || 0;
    if (x < -0.5 || y < -0.5 || x + w > W + 0.5 || y + h > H + 0.5) {
      errors.push(`${r.name} exceeds floor boundary.`);
    }
  }

  // Overlap check (excluding sub-rooms and parent-child pairs)
  const OVERLAP_TOLERANCE = 0.15;
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];

      // Skip parent-child / sub-room relationships
      if ((a as any).subZoneOf === b.id || (b as any).subZoneOf === a.id) continue;
      if ((a as any).isSubRoom || (b as any).isSubRoom) continue;

      const ax = Number(a.x) || 0;
      const ay = Number(a.y) || 0;
      const aw = Number(a.w) || 0;
      const ah = Number(a.h) || 0;
      const bx = Number(b.x) || 0;
      const by = Number(b.y) || 0;
      const bw = Number(b.w) || 0;
      const bh = Number(b.h) || 0;

      const overlapX = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
      const overlapY = Math.min(ay + ah, by + bh) - Math.max(ay, by);

      if (overlapX > OVERLAP_TOLERANCE && overlapY > OVERLAP_TOLERANCE) {
        errors.push(
          `Overlap: ${a.name} & ${b.name} (${overlapX.toFixed(2)}×${overlapY.toFixed(2)} ft)`,
        );
        return false;
      }
    }
  }

  return errors.length === 0;
}

/**
 * Computes additional metrics for the UI comparison table:
 *   - totalBuiltUpArea
 *   - passageArea
 *   - circulatingRooms
 *   - exteriorRoomCount
 *   - wetCoreClusterScore (0-100, higher = more clustered)
 */
function computeMetrics(rooms: FloorRoom[], W: number, H: number) {
  const totalBuiltUpArea = W * H;

  const passageArea = rooms
    .filter(r => `${r.type || r.name}`.toLowerCase().includes('passage'))
    .reduce((s, r) => s + (Number(r.w) || 0) * (Number(r.h) || 0), 0);

  const circulatingRooms = rooms.filter(r => {
    const s = `${r.type || r.name}`.toLowerCase();
    return s.includes('passage') || s.includes('corridor');
  }).length;

  const exteriorRoomCount = rooms.filter(r => {
    const x = Number(r.x) || 0;
    const y = Number(r.y) || 0;
    const w = Number(r.w) || 0;
    const h = Number(r.h) || 0;
    return (
      Math.abs(x) < 0.5 ||
      Math.abs(y) < 0.5 ||
      Math.abs(x + w - W) < 0.5 ||
      Math.abs(y + h - H) < 0.5
    );
  }).length;

  // Wet core clustering: average pairwise distance between
  // kitchen / toilets / baths. Lower distance = higher score.
  const wet = rooms.filter(r => {
    const s = `${r.type || r.name}`.toLowerCase();
    return s.includes('kitchen') || s.includes('toilet') || s.includes('bath');
  });

  let wetCluster = 100;
  if (wet.length >= 2) {
    let total = 0;
    let count = 0;
    for (let i = 0; i < wet.length; i++) {
      for (let j = i + 1; j < wet.length; j++) {
        const a = wet[i];
        const b = wet[j];
        total += Math.hypot(
          ((Number(a.x) || 0) + (Number(a.w) || 0) / 2) -
            ((Number(b.x) || 0) + (Number(b.w) || 0) / 2),
          ((Number(a.y) || 0) + (Number(a.h) || 0) / 2) -
            ((Number(b.y) || 0) + (Number(b.h) || 0) / 2),
        );
        count++;
      }
    }
    const avg = count > 0 ? total / count : 0;
    wetCluster = Math.max(0, Math.min(100, Math.round(100 - avg * 2)));
  }

  return {
    totalBuiltUpArea,
    passageArea,
    circulatingRooms,
    exteriorRoomCount,
    wetCoreClusterScore: wetCluster,
  };
}