/* =========================================================
CONSTRUCTION PLAN SYSTEM — CAD TYPES
---------------------------------------------------------
Type definitions for vector coordinates, layers, and snapping.
========================================================= */

export type Vector2D = {
  x: number;
  y: number;
};

export type CadLayer = {
  name: string;
  color: string;
  visible: boolean;
  lineWidth: number;
};

export type ArchitecturalElement = {
  id: string;
  type: "WALL" | "DOOR" | "WINDOW" | "TEXT" | "COLUMN";
  start: Vector2D;
  end: Vector2D;
  properties?: Record<string, any>;
};