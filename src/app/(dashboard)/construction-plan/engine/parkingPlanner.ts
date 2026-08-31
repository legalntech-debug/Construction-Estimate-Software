import { PLAN_THRESHOLDS } from './planningConstants';

export type ParkingCandidateType = 'PARKING_BOX' | 'PARKING_L' | 'PARKING_SIDE' | 'PEDESTRIAN_FRONT';

export interface ParkingCandidate {
  type: ParkingCandidateType;
  width: number;
  depth: number;
  area: number;
  x: number;
  score: number;
  vehicleFit: boolean;
  reason: string;
}

export function scoreParkingCandidate(type: ParkingCandidateType, width: number, depth: number, plotWidth = width): ParkingCandidate {
  const area = Math.max(0, width * depth);
  const vehicleFit = width >= PLAN_THRESHOLDS.PARKING_MIN_CLEAR_WIDTH_FT && depth >= PLAN_THRESHOLDS.PARKING_MIN_CLEAR_DEPTH_FT;
  const score = (vehicleFit ? 70 : -100) + Math.min(20, area / 10)
    + (type === 'PARKING_L' ? (plotWidth >= 24 ? 12 : 5) : type === 'PARKING_SIDE' ? 8 : 5);
  return {
    type, width, depth, area, x: Math.max(0, plotWidth - width), score, vehicleFit,
    reason: vehicleFit ? 'Vehicle-fit candidate.' : 'Not sufficient for a conventional car bay; may be pedestrian/bike/service space.',
  };
}

/** Select the best vehicle-fit geometry from BOX/L/SIDE candidates for the current footprint. */
export function selectParkingCandidate(plotWidth: number, plotDepth: number, preferredDepth = 15): ParkingCandidate {
  const W = Math.max(1, plotWidth);
  const H = Math.max(1, plotDepth);
  const depth = Math.min(H, Math.max(15, preferredDepth));
  const candidates: ParkingCandidate[] = [
    scoreParkingCandidate('PARKING_BOX', Math.min(10, W), depth, W),
    scoreParkingCandidate('PARKING_SIDE', Math.min(Math.max(9, W * 0.44), W), depth, W),
    scoreParkingCandidate('PARKING_L', Math.min(Math.max(9, W * 0.50), W), depth, W),
  ].filter(c => c.width <= W + 0.01 && c.depth <= H + 0.01);
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || scoreParkingCandidate('PARKING_BOX', Math.min(W, 9), Math.min(H, 15), W);
}
