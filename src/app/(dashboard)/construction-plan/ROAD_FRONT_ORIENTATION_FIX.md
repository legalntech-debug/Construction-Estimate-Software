# Road / Front Orientation Fix v3

## What changed
- The CAD's existing engineering-sheet convention is preserved: the selected ROAD / FRONT edge is always shown at the bottom of the plan sheet.
- AUTO planning now places parking + public/front spaces in the bottom band for every selected cardinal road direction.
- The main parking shutter / entrance door is placed on the bottom/front wall in the rotated sheet convention.
- CAD validation now checks parking against the bottom/front edge, eliminating the false 1-error state caused by validating one coordinate convention against another.
- `CadFloorElevationRenderer` now passes the selected road orientation into `CadFloorPlansView` instead of silently using its default.
- The compass badge now indicates where world NORTH points relative to the rotated plan: SOUTH road => north up; NORTH road => north down; EAST road => north right; WEST road => north left.
- Default road/front was normalized to SOUTH where no selection is present.

## Verification
Core TypeScript engine files compile with TypeScript 5.8.3.
A generated 30x50 ground-floor test using `1 SIDE ROAD (NORTH)` places parking at y=40.67 with h=9.33, ending exactly at y=50 (bottom/front) and produces 0 errors / 0 warnings from the generated floor plan.
