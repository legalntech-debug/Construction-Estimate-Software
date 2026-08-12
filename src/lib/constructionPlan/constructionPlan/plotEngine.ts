import { PlotDimensions, PlotGeometry, PlotShape, PlotSide, Point, Polygon } from "./types";

const EPSILON = 0.0001;

function n(value: unknown): number {
  const valueAsNumber = Number(value);
  return Number.isFinite(valueAsNumber) ? valueAsNumber : 0;
}

export function polygonArea(vertices: Polygon): number {
  if (vertices.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeter(vertices: Polygon): number {
  if (vertices.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

function isSimplePolygon(vertices: Polygon): boolean {
  if (vertices.length < 3) return false;
  // Consecutive edge intersection checking is enough for the user-facing
  // polygon editor's basic validation. Full self-intersection handling can be
  // added without changing the public model.
  const orientation = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const onSegment = (a: Point, b: Point, c: Point) =>
    Math.min(a.x, b.x) - EPSILON <= c.x && c.x <= Math.max(a.x, b.x) + EPSILON &&
    Math.min(a.y, b.y) - EPSILON <= c.y && c.y <= Math.max(a.y, b.y) + EPSILON;
  const intersects = (a: Point, b: Point, c: Point, d: Point) => {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    if (((o1 > EPSILON && o2 < -EPSILON) || (o1 < -EPSILON && o2 > EPSILON)) &&
        ((o3 > EPSILON && o4 < -EPSILON) || (o3 < -EPSILON && o4 > EPSILON))) return true;
    return Math.abs(o1) <= EPSILON && onSegment(a, b, c) ||
      Math.abs(o2) <= EPSILON && onSegment(a, b, d) ||
      Math.abs(o3) <= EPSILON && onSegment(c, d, a) ||
      Math.abs(o4) <= EPSILON && onSegment(c, d, b);
  };

  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    for (let j = i + 1; j < vertices.length; j += 1) {
      const c = vertices[j];
      const d = vertices[(j + 1) % vertices.length];
      if (i === j || (i + 1) % vertices.length === j || i === (j + 1) % vertices.length) continue;
      if (intersects(a, b, c, d)) return false;
    }
  }
  return true;
}

export function rectangleVertices(dimensions: PlotDimensions): Polygon {
  const front = n(dimensions.A);
  const rear = n(dimensions.B) || front;
  const left = n(dimensions.C);
  const right = n(dimensions.D) || left;
  const width = (front + rear) / 2;
  const depth = (left + right) / 2;
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: depth },
    { x: 0, y: depth },
  ];
}

export function trapezoidVertices(dimensions: PlotDimensions): Polygon {
  const front = Math.max(EPSILON, n(dimensions.A));
  const rear = Math.max(EPSILON, n(dimensions.B));
  const left = Math.max(EPSILON, n(dimensions.C));
  const right = Math.max(EPSILON, n(dimensions.D));
  const depth = (left + right) / 2;
  const shift = (front - rear) / 2;
  return [
    { x: 0, y: 0 },
    { x: front, y: 0 },
    { x: Math.max(0, rear + shift), y: depth },
    { x: shift, y: depth },
  ];
}

export function createPlotGeometry(
  dimensions: PlotDimensions,
  shape: PlotShape,
  vertices?: Polygon
): PlotGeometry {
  let points: Polygon;
  const errors: string[] = [];

  if (vertices && vertices.length >= 3) {
    points = vertices;
  } else if (shape === "SQUARE") {
    const side = n(dimensions.A);
    points = rectangleVertices({ A: side, B: side, C: side, D: side });
  } else if (shape === "TRAPEZOIDAL") {
    points = trapezoidVertices(dimensions);
  } else if (shape === "TRIANGULAR") {
    const base = Math.max(EPSILON, n(dimensions.A));
    const height = Math.max(EPSILON, (n(dimensions.C) + n(dimensions.D)) / 2);
    points = [{ x: 0, y: 0 }, { x: base, y: 0 }, { x: base / 2, y: height }];
  } else {
    points = rectangleVertices(dimensions);
  }

  if (points.length < 3) errors.push("At least three plot points are required.");
  if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) errors.push("Plot contains an invalid point.");
  if (!isSimplePolygon(points)) errors.push("Plot boundary lines intersect or the polygon is invalid.");

  const area = polygonArea(points);
  if (area <= EPSILON) errors.push("Plot area must be greater than zero.");

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  return {
    shape,
    vertices: points,
    area: Number(area.toFixed(2)),
    perimeter: Number(polygonPerimeter(points).toFixed(2)),
    width: Number((Math.max(...xs) - Math.min(...xs)).toFixed(2)),
    depth: Number((Math.max(...ys) - Math.min(...ys)).toFixed(2)),
    valid: errors.length === 0,
    errors,
  };
}

export function calculatePlotArea(dim: PlotDimensions | undefined, shape: PlotShape): number {
  if (!dim) return 0;
  return createPlotGeometry(dim, shape).area;
}

export function computeAutoOppositeDimension(
  dimensions: PlotDimensions,
  targetSide: PlotSide,
  _knownArea?: number
): PlotDimensions {
  const next = { ...dimensions };
  if (targetSide === "B" && next.A > 0) next.B = next.A;
  else if (targetSide === "A" && next.B > 0) next.A = next.B;
  else if (targetSide === "D" && next.C > 0) next.D = next.C;
  else if (targetSide === "C" && next.D > 0) next.C = next.D;
  return next;
}
