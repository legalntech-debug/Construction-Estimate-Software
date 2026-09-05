/**
 * Canonical planning constants shared by the master planning pipeline.
 * Keep architectural dimensions/rules here; do not hard-code plot-specific layouts.
 */
export const PLAN_THRESHOLDS = {
  COMPACT_MAX_WIDTH_FT: 22,
  AUTO_GROUND_1_BEDROOM_MAX_SQFT: 750,
  AUTO_GROUND_1_MASTER_MAX_SQFT: 1200,
  AUTO_GROUND_2_BEDROOM_MAX_SQFT: 1500,
  PARKING_MIN_CLEAR_WIDTH_FT: 8,
  PARKING_MIN_CLEAR_DEPTH_FT: 15,
  PEDESTRIAN_STRIP_MIN_WIDTH_FT: 3,
  INTERNAL_WALL_THICKNESS_IN: 4.0,
  EXTERNAL_WALL_THICKNESS_IN: 9,
};
