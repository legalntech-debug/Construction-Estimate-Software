/* =========================================================
CONSTRUCTION PLAN SYSTEM — CAD SNAP ENGINE
---------------------------------------------------------
Calculates snap points (endpoints, midpoints, grid intersections).
========================================================= */

import { Point2D } from "./cadTypes";

export function snapToGrid(point: Point2D, gridSize: number = 10): Point2D {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

export function calculateMidpoint(p1: Point2D, p2: Point2D): Point2D {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}