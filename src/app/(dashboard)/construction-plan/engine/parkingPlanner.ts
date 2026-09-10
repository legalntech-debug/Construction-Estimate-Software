import { PLAN_THRESHOLDS } from './planningConstants';
import type { ParkingMode } from './planningTypes';

export type ParkingCandidateType = 'PARKING_BOX' | 'PARKING_L' | 'PARKING_SIDE' | 'PEDESTRIAN_FRONT';

export interface ParkingMinimum {
  mode: ParkingMode;
  minWidth: number;
  minDepth: number;
  minArea: number;
  note: string;
}

export interface ParkingCandidate {
  type: ParkingCandidateType;
  width: number;
  depth: number;
  area: number;
  x: number;
  score: number;
  vehicleFit: boolean;
  reason: string;
  parkingMode: ParkingMode;
  bikeZone?: { x: number; y: number; width: number; depth: number };
  pedestrianZone?: { x: number; y: number; width: number; depth: number };
}

/**
 * Practical planning baselines only. These are NOT universal statutory minimums;
 * local DCR/authority rules must be applied separately.
 */
export function getParkingMinimum(mode: ParkingMode = 'CAR'): ParkingMinimum {
  switch (mode) {
    case 'TWO_WHEELER':
      return { mode, minWidth: 4, minDepth: 7, minArea: 28, note: 'Compact two-wheeler bay; add circulation/entry clearance as required.' };
    case 'CAR_BIKE_PEDESTRIAN':
      return { mode, minWidth: 12, minDepth: 15, minArea: 180, note: 'Car bay + bike zone + protected pedestrian strip; final local clearance check required.' };
    case 'GENERIC':
      return { mode, minWidth: 6, minDepth: 12, minArea: 72, note: 'Generic parking/entry zone; 72 sq.ft is a planning baseline, not a legal minimum.' };
    case 'CAR':
    default:
      return { mode: 'CAR', minWidth: PLAN_THRESHOLDS.PARKING_MIN_CLEAR_WIDTH_FT, minDepth: PLAN_THRESHOLDS.PARKING_MIN_CLEAR_DEPTH_FT, minArea: PLAN_THRESHOLDS.PARKING_MIN_CLEAR_WIDTH_FT * PLAN_THRESHOLDS.PARKING_MIN_CLEAR_DEPTH_FT, note: 'Practical clear car-bay baseline; local authority parking rules can override.' };
  }
}

export function scoreParkingCandidate(
  type: ParkingCandidateType,
  width: number,
  depth: number,
  plotWidth = width,
  mode: ParkingMode = 'CAR'
): ParkingCandidate {
  const minimum = getParkingMinimum(mode);
  const area = Math.max(0, width * depth);
  const vehicleFit = width >= minimum.minWidth && depth >= minimum.minDepth;
  const score = (vehicleFit ? 70 : -100) + Math.min(25, area / 10)
    + (type === 'PARKING_L' ? (plotWidth >= 24 ? 12 : 5) : type === 'PARKING_SIDE' ? 8 : 5)
    + (mode === 'CAR_BIKE_PEDESTRIAN' && type === 'PARKING_L' ? 8 : 0)
    + (mode === 'TWO_WHEELER' && type === 'PARKING_SIDE' ? 8 : 0);

  const candidate: ParkingCandidate = {
    type, width, depth, area, x: Math.max(0, plotWidth - width), score, vehicleFit,
    reason: vehicleFit ? minimum.note : `Below ${minimum.minWidth.toFixed(1)}' × ${minimum.minDepth.toFixed(1)}' planning baseline for ${mode}.`,
    parkingMode: mode,
  };

  if (mode === 'CAR_BIKE_PEDESTRIAN' && vehicleFit) {
    const pedestrianWidth = Math.min(3, Math.max(2.5, width * 0.22));
    const bikeWidth = Math.min(4, Math.max(3.5, width * 0.28));
    candidate.pedestrianZone = { x: 0, y: 0, width: pedestrianWidth, depth };
    candidate.bikeZone = { x: pedestrianWidth, y: 0, width: Math.min(bikeWidth, Math.max(0, width - pedestrianWidth - minimum.minWidth)), depth: Math.min(7, depth) };
  }
  return candidate;
}

/** Select the best mode-compatible geometry from BOX/L/SIDE candidates. */
export function selectParkingCandidate(
  plotWidth: number,
  plotDepth: number,
  preferredDepth = 15,
  mode: ParkingMode = 'CAR'
): ParkingCandidate {
  const W = Math.max(1, plotWidth);
  const H = Math.max(1, plotDepth);
  const minimum = getParkingMinimum(mode);
  const depth = Math.min(H, Math.max(minimum.minDepth, preferredDepth));
  const targetWidth = minimum.minWidth;
  const widthFactor = mode === 'TWO_WHEELER' ? 0.24 : mode === 'GENERIC' ? 0.32 : mode === 'CAR_BIKE_PEDESTRIAN' ? 0.50 : 0.42;

  const candidates: ParkingCandidate[] = [
    scoreParkingCandidate('PARKING_BOX', Math.min(Math.max(targetWidth, W * widthFactor), W), depth, W, mode),
    scoreParkingCandidate('PARKING_SIDE', Math.min(Math.max(targetWidth, W * (widthFactor + 0.04)), W), depth, W, mode),
    scoreParkingCandidate('PARKING_L', Math.min(Math.max(targetWidth, W * (widthFactor + 0.08)), W), depth, W, mode),
  ].filter(c => c.width <= W + 0.01 && c.depth <= H + 0.01);

  if (!candidates.length) {
    return scoreParkingCandidate('PARKING_BOX', Math.min(W, targetWidth), Math.min(H, minimum.minDepth), W, mode);
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}
