/**
 * Legacy compatibility facade.
 * All residential floor generation is owned by architecturalPlanningEngine/roomPlanner.
 * No plot-specific or duplicate placement logic belongs here.
 */
import { generateArchitecturalFloorPlan } from './roomPlanner';
import { FloorRoom } from './planningTypes';

export interface PlannerConfig {
  wFt: number;
  hFt: number;
  roadOrientation: "NORTH" | "SOUTH" | "EAST" | "WEST";
  bhk?: number;
  hasParking?: boolean;
  selectedRooms?: any;
  planningMode?: "AUTO" | "MANUAL" | "PRESET" | string;
  floorName?: string;
  floorToFloorHeightFeet?: number;
}

export function generateEngineFloorLayout(config: PlannerConfig): FloorRoom[] {
  return generateArchitecturalFloorPlan({
    floorName: config.floorName || 'GROUND FLOOR',
    width: config.wFt,
    length: config.hFt,
    bhk: config.bhk ? `${config.bhk} BHK` : 'AUTO',
    selectedRooms: config.selectedRooms,
    planningMode: config.planningMode || 'AUTO',
    roadSide: `1 SIDE ROAD (${config.roadOrientation || 'SOUTH'})`,
    hasParking: config.hasParking !== false,
    floorToFloorHeightFeet: config.floorToFloorHeightFeet || 10,
    planningArea: config.wFt * config.hFt,
  }).rooms;
}
