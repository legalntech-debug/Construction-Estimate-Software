// Screen space layout of map labels: a name that fits inside a polygon, and boundary texts placed outside the edges of
// the plot without overlapping each other. Works on pixel coordinates (x to the right, y downwards); no DOM access.

export interface PxPoint {
  x: number;
  y: number;
}

// Centre and size of a label box in pixels
export interface LabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rectsOverlap = (a: LabelRect, b: LabelRect, margin = 1) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + margin && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + margin;

export const pxCentroid = (ring: PxPoint[]): PxPoint => {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(a) < 1e-9) return { x: ring.reduce((s, p) => s + p.x, 0) / ring.length, y: ring.reduce((s, p) => s + p.y, 0) / ring.length };
  return { x: cx / (3 * a), y: cy / (3 * a) };
};

export interface FittedLabel {
  // Centre of the text and its turn in degrees (clockwise, screen space)
  x: number;
  y: number;
  angleDeg: number;
  fontPx: number;
}

// Turns an angle into the range (-90, 90] so text never runs upside down
export const readableAngle = (deg: number) => {
  let r = ((deg % 180) + 180) % 180;
  if (r > 90) r -= 180;
  return r;
};

// Largest font (up to maxFont) at which a text of the given width (pixels at a font size of 1 px) fits inside the ring.
// The text runs along the longest edge. Returns null when even minFont does not fit (the label is hidden then).
export const fitLabelInRing = (
  ring: PxPoint[],
  textWidthPerPx: number,
  options: { maxFont: number; minFont: number; fill?: number }
): FittedLabel | null => {
  if (ring.length < 3) return null;
  const fill = options.fill ?? 0.9;

  // Direction of the longest edge
  let bestLen = 0;
  let angle = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len > bestLen) {
      bestLen = len;
      angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    }
  }
  const textAngle = readableAngle(angle);
  const rad = (textAngle * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);

  // Extent of the ring along and across the text direction
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  ring.forEach((p) => {
    const u = p.x * ux + p.y * uy;
    const v = -p.x * uy + p.y * ux;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  });
  const extentU = maxU - minU;
  const extentV = maxV - minV;

  const fontPx = Math.min(options.maxFont, (extentU * fill) / textWidthPerPx, extentV * 0.7);
  if (fontPx < options.minFont) return null;
  const c = pxCentroid(ring);
  return { x: c.x, y: c.y, angleDeg: textAngle, fontPx };
};

export interface PlotEdge {
  mid: PxPoint;
  // Unit normal pointing out of the polygon
  normal: PxPoint;
  length: number;
  // Direction of the edge on screen in degrees (clockwise), in the readable range so text along it never runs upside down
  angleDeg: number;
}

// The edge of the ring that faces a compass direction (dir = unit vector on screen: north (0,-1), east (1,0) ...)
export const edgeFacing = (ring: PxPoint[], dir: PxPoint): PlotEdge | null => {
  if (ring.length < 3) return null;
  const c = pxCentroid(ring);
  let best: PlotEdge | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) continue;
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    let normal = { x: dy / length, y: -dx / length };
    // Make the normal point away from the centre of the ring
    if (normal.x * (mid.x - c.x) + normal.y * (mid.y - c.y) < 0) normal = { x: -normal.x, y: -normal.y };
    // Facing the direction matters most; among equal candidates the longer edge wins
    const score = normal.x * dir.x + normal.y * dir.y + length * 1e-4;
    if (score > bestScore) {
      bestScore = score;
      best = { mid, normal, length, angleDeg: readableAngle((Math.atan2(dy, dx) * 180) / Math.PI) };
    }
  }
  return best;
};

export interface BoundaryLabelRequest {
  key: string;
  edge: PlotEdge;
  // Size of the text block (width along the edge, height across it)
  w: number;
  h: number;
}

export interface PlacedLabel {
  // Centre of the text block, its turn (parallel to the plot edge) and the size of the unturned block
  x: number;
  y: number;
  angleDeg: number;
  textW: number;
  textH: number;
  // Box around the turned block (used for the overlap test)
  box: LabelRect;
}

// Box around a w x h block turned by angleDeg
const turnedBox = (x: number, y: number, w: number, h: number, angleDeg: number): LabelRect => {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  return { x, y, w: w * c + h * s, h: w * s + h * c };
};

// Puts every text outside its edge, parallel to it, and pushes it outwards until it touches no obstacle and no earlier
// text. Returns the text centres in the same coordinates as the edges.
export const placeBoundaryLabels = (
  requests: BoundaryLabelRequest[],
  obstacles: LabelRect[],
  gap = 2,
  step = 3,
  maxSteps = 80
): Record<string, PlacedLabel> => {
  const placed: LabelRect[] = [...obstacles];
  const result: Record<string, PlacedLabel> = {};
  requests.forEach(({ key, edge, w, h }) => {
    // The text runs along the edge, so across the edge it needs half of its height
    let dist = gap + h / 2;
    let x = edge.mid.x;
    let y = edge.mid.y;
    let box = turnedBox(x, y, w, h, edge.angleDeg);
    for (let i = 0; i < maxSteps; i++) {
      x = edge.mid.x + edge.normal.x * dist;
      y = edge.mid.y + edge.normal.y * dist;
      box = turnedBox(x, y, w, h, edge.angleDeg);
      if (!placed.some((p) => rectsOverlap(box, p))) break;
      dist += step;
    }
    placed.push(box);
    result[key] = { x, y, angleDeg: edge.angleDeg, textW: w, textH: h, box };
  });
  return result;
};
