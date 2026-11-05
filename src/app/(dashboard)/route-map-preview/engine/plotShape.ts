// Plot geometry: the plot outline is built from the entered side lengths and area (so it is not forced to 90 degree
// corners), turned to follow the street, and can be replaced by a footprint or a hand drawn polygon.
// Pure TypeScript without DOM access.
import { METERS_PER_DEGREE_LAT, toRad } from "./routeMapGeo";
import type { LatLng } from "./routeMapGeo";
import { FEET_TO_METERS } from "./constants";
import type { Boundaries } from "./types";

// Point in feet: x towards east, y towards north
type Pt = [number, number];

const SQFT_PER_SQM = 10.763910416709722;

// ---------------------------------------------------------------------------
// Local metric offsets
// ---------------------------------------------------------------------------

// Moves a point by metres towards east / north (flat approximation, fine for a few hundred metres)
const offsetLatLng = (c: LatLng, eastM: number, northM: number): LatLng => ({
  lat: c.lat + northM / METERS_PER_DEGREE_LAT,
  lng: c.lng + eastM / (METERS_PER_DEGREE_LAT * Math.cos(toRad(c.lat))),
});

// Rotates an (east, north) offset clockwise by angleDeg
const rotateOffset = (eastM: number, northM: number, angleDeg: number): [number, number] => {
  const a = toRad(angleDeg);
  return [eastM * Math.cos(a) + northM * Math.sin(a), -eastM * Math.sin(a) + northM * Math.cos(a)];
};

// Corner coordinates (NW, NE, SE, SW before rotation) of a rectangle of real-world size centred on a point and turned
// clockwise by angleDeg. Because the corners are geographic coordinates, the box keeps its true size and shape on the
// map at every zoom level.
export const rectAround = (c: LatLng, widthFt: number, heightFt: number, angleDeg = 0): LatLng[] => {
  const hw = (widthFt * FEET_TO_METERS) / 2;
  const hh = (heightFt * FEET_TO_METERS) / 2;
  return ([[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]] as [number, number][]).map(([e, n]) => {
    const [re, rn] = rotateOffset(e, n, angleDeg);
    return offsetLatLng(c, re, rn);
  });
};

// ---------------------------------------------------------------------------
// Quadrilateral from four side lengths and the area
// ---------------------------------------------------------------------------

export interface PlotSides {
  north: number;
  east: number;
  south: number;
  west: number;
}

const positive = (v: string) => {
  const n = parseFloat(v);
  return n > 0 ? n : 0;
};

// Side lengths (ft) and area (sq ft) of the plot. Missing sides are derived from the opposite side or from the area.
export const plotSidesFt = (dims: Boundaries, plotArea: string): { sides: PlotSides; areaSqFt: number } => {
  const area = parseFloat(String(plotArea).replace(/,/g, "")) || 0;
  const n = positive(dims.north);
  const s = positive(dims.south);
  const e = positive(dims.east);
  const w = positive(dims.west);
  // East-west and north-south extent
  const width = n && s ? (n + s) / 2 : n || s;
  const height = e && w ? (e + w) / 2 : e || w;
  const fallbackSide = area > 0 ? Math.sqrt(area) : 30;
  const W = width || (height && area > 0 ? area / height : fallbackSide);
  const H = height || (width && area > 0 ? area / width : fallbackSide);
  return {
    sides: { north: n || s || W, south: s || n || W, east: e || w || H, west: w || e || H },
    areaSqFt: area > 0 ? area : W * H,
  };
};

const shoelace = (pts: Pt[]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
};

const isConvex = (pts: Pt[]) => {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const [x2, y2] = pts[(i + 2) % pts.length];
    const cross = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1);
    if (Math.abs(cross) < 1e-9) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
};

const circleIntersections = (c0: Pt, r0: number, c1: Pt, r1: number): Pt[] => {
  const dx = c1[0] - c0[0];
  const dy = c1[1] - c0[1];
  const d = Math.hypot(dx, dy);
  if (d === 0 || d > r0 + r1 || d < Math.abs(r0 - r1)) return [];
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const mx = c0[0] + (a * dx) / d;
  const my = c0[1] + (a * dy) / d;
  return [
    [mx + (h * dy) / d, my - (h * dx) / d],
    [mx - (h * dy) / d, my + (h * dx) / d],
  ];
};

// Quadrilateral NW, NE, SE, SW with the given side lengths; beta is the lean of the west side from straight south
const buildQuad = (sides: PlotSides, beta: number): Pt[] | null => {
  const p0: Pt = [0, 0];
  const p1: Pt = [sides.north, 0];
  const p3: Pt = [sides.west * Math.sin(beta), -sides.west * Math.cos(beta)];
  for (const p2 of circleIntersections(p1, sides.east, p3, sides.south)) {
    const quad = [p0, p1, p2, p3];
    if (isConvex(quad)) return quad;
  }
  return null;
};

const centered = (pts: Pt[]): Pt[] => {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [x - cx, y - cy]);
};

const AREA_TOLERANCE = 0.08;
const MAX_LEAN_DEG = 75;

// Plot outline (feet, centred) from the side lengths: a plain rectangle / trapezoid when the lengths already agree with
// the area, otherwise the leaning quadrilateral whose area matches the entered area.
export const solveQuadFt = (sides: PlotSides, areaSqFt: number): Pt[] => {
  const straight = buildQuad(sides, 0);
  if (straight && Math.abs(Math.abs(shoelace(straight)) - areaSqFt) / areaSqFt <= AREA_TOLERANCE) return centered(straight);

  // Look for the lean angle (smallest first) at which the area equals the entered area
  const areaAt = (beta: number) => {
    const q = buildQuad(sides, beta);
    return q ? Math.abs(shoelace(q)) : NaN;
  };
  let bestBeta: number | null = null;
  for (const direction of [1, -1]) {
    let prevBeta = 0;
    let prevF = areaAt(0) - areaSqFt;
    for (let deg = 0.5; deg <= MAX_LEAN_DEG; deg += 0.5) {
      const beta = (direction * deg * Math.PI) / 180;
      const f = areaAt(beta) - areaSqFt;
      if (!isNaN(f) && !isNaN(prevF) && Math.sign(f) !== Math.sign(prevF)) {
        // Bisection between the two samples
        let lo = prevBeta;
        let hi = beta;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          const fm = areaAt(mid) - areaSqFt;
          if (isNaN(fm)) break;
          if (Math.sign(fm) === Math.sign(areaAt(lo) - areaSqFt)) lo = mid;
          else hi = mid;
        }
        const root = (lo + hi) / 2;
        if (bestBeta === null || Math.abs(root) < Math.abs(bestBeta)) bestBeta = root;
        break;
      }
      if (!isNaN(f)) {
        prevBeta = beta;
        prevF = f;
      }
    }
  }
  const solved = bestBeta !== null ? buildQuad(sides, bestBeta) : null;
  if (solved) return centered(solved);
  if (straight) return centered(straight);

  // The lengths cannot form a quadrilateral: fall back to a rectangle of the average sizes
  const W = (sides.north + sides.south) / 2;
  const H = (sides.east + sides.west) / 2;
  return [[-W / 2, H / 2], [W / 2, H / 2], [W / 2, -H / 2], [-W / 2, -H / 2]];
};

// Plot ring (NW, NE, SE, SW) on the map: centred on a point and turned clockwise by angleDeg
export const quadRing = (center: LatLng, sides: PlotSides, areaSqFt: number, angleDeg: number): LatLng[] =>
  solveQuadFt(sides, areaSqFt).map(([xFt, yFt]) => {
    const [e, n] = rotateOffset(xFt * FEET_TO_METERS, yFt * FEET_TO_METERS, angleDeg);
    return offsetLatLng(center, e, n);
  });

// ---------------------------------------------------------------------------
// Rings (polygons) on the map
// ---------------------------------------------------------------------------

const project = (origin: LatLng) => {
  const kx = METERS_PER_DEGREE_LAT * Math.cos(toRad(origin.lat));
  return (p: LatLng): Pt => [(p.lng - origin.lng) * kx, (p.lat - origin.lat) * METERS_PER_DEGREE_LAT];
};

// Area of a ring in square feet
export const ringAreaSqFt = (ring: LatLng[]): number => {
  if (ring.length < 3) return 0;
  const proj = project(ring[0]);
  return Math.abs(shoelace(ring.map(proj))) * SQFT_PER_SQM;
};

// Area centroid of a ring
export const ringCenter = (ring: LatLng[]): LatLng => {
  const origin = ring[0];
  const proj = project(origin);
  const pts = ring.map(proj);
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    return { lat: ring.reduce((s, p) => s + p.lat, 0) / ring.length, lng: ring.reduce((s, p) => s + p.lng, 0) / ring.length };
  }
  return offsetLatLng(origin, cx / (3 * a), cy / (3 * a));
};

// Douglas-Peucker simplification of a ring (tolerance in metres); keeps at least three points
export const simplifyRing = (ring: LatLng[], toleranceM = 0.4): LatLng[] => {
  // Drop the repeated closing point
  const pts = ring.length > 1 && ring[0].lat === ring[ring.length - 1].lat && ring[0].lng === ring[ring.length - 1].lng ? ring.slice(0, -1) : ring;
  if (pts.length <= 4) return pts;
  const proj = project(pts[0]);
  const xy = pts.map(proj);
  const keep = new Array(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;

  const distToSegment = (p: Pt, a: Pt, b: Pt) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop() as [number, number];
    let maxD = 0;
    let idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distToSegment(xy[k], xy[i], xy[j]);
      if (d > maxD) {
        maxD = d;
        idx = k;
      }
    }
    if (idx !== -1 && maxD > toleranceM) {
      keep[idx] = true;
      stack.push([i, idx], [idx, j]);
    }
  }
  let out = pts.filter((_, k) => keep[k]);
  if (out.length < 3) return pts;

  // A kept anchor can still lie on the line between its neighbours (tie in the distance test): drop those too,
  // going round the ring until no vertex is left that is closer than the tolerance
  const outProj = project(out[0]);
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    const xyOut = out.map(outProj);
    for (let k = 0; k < out.length; k++) {
      const prev = xyOut[(k - 1 + out.length) % out.length];
      const next = xyOut[(k + 1) % out.length];
      if (distToSegment(xyOut[k], prev, next) <= toleranceM) {
        out = out.filter((_, idx) => idx !== k);
        changed = true;
        break;
      }
    }
  }
  return out;
};
