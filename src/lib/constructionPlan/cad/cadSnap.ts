/* =========================================================
CONSTRUCTION PLAN SYSTEM — CAD SNAP ENGINE
---------------------------------------------------------
Calculates snap points (endpoints, midpoints, grid intersections).
========================================================= */

import { Vector2D } from "./cadTypes";

export function snapToGrid(point: Vector2D, gridSize: number = 10): Vector2D {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

export function calculateMidpoint(p1: Vector2D, p2: Vector2D): Vector2D {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}