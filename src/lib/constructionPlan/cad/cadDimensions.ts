/* =========================================================
CONSTRUCTION PLAN SYSTEM — CAD GEOMETRY ENGINE
---------------------------------------------------------
Handles geometric calculations, wall offsets, and coordinate transforms.
========================================================= */

export type Point2D = {
  x: number;
  y: number;
};

export type LineSegment = {
  start: Point2D;
  end: Point2D;
};

export function calculateWallOffset(point: Point2D, offsetDistance: number): Point2D {
  return {
    x: point.x + offsetDistance,
    y: point.y + offsetDistance,
  };
}

export function computeBoundingBox(points: Point2D[]) {
  if (!points || points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });

  return { minX, minY, maxX, maxY };
}