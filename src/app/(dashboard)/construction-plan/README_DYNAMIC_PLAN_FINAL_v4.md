# Construction Plan Dynamic Planner — Final v4

This replacement updates the construction-plan feature so the generated floor plan is driven by the user's input and a single authoritative planning model.

## Main fixes
- The selected main road/front is normalized to the bottom of the plan sheet.
- Main-road cardinal direction is preserved as metadata/compass rotation:
  - NORTH road -> NORTH is bottom
  - EAST road -> EAST is bottom
  - SOUTH road -> SOUTH is bottom
  - WEST road -> WEST is bottom
- Corner plots keep the second road on the corresponding rotated side.
- Ground-floor parking is always on the bottom/front road edge in local plan coordinates.
- Parking has a direct road shutter and direct connection to the living/entry hall where geometry permits.
- Hall/living -> staircase -> passage -> bedroom circulation is prioritized on wider plots.
- Bathrooms are kept in a service/wet zone and a shared duct is used where there is enough width.
- Door generation uses actual shared room boundaries; duct spaces are not treated as circulation rooms.
- Exterior windows/ventilators are generated only on true exterior walls.
- CAD uses the authoritative generated room geometry instead of creating a second fallback layout.
- Wall rendering is segmented around doors/windows so opening positions remain visible.
- Room labels are wrapped/clipped to stay inside rooms.
- Validation checks room boundaries, overlaps, front parking, parking-to-hall access, staircase access/landing configuration, ventilation, and connected internal-door paths.
- Generate Plan stores the same generated x/y/w/h data for preview/CAD.

## Test coverage performed
The core TypeScript engine was compiled independently and runtime-tested for 30x50 plots with NORTH/EAST/SOUTH/WEST road orientations and corner configurations. Generated ground/first floors returned zero validation errors. A custom 30x50 plan with explicit room selections and 5/5/3/3 setbacks also returned zero validation errors.

Very small plots can still produce legitimate warnings or errors when the requested room program cannot physically fit. The planner should not silently fabricate an impossible plan.

## AUTO Ground-Floor Toilet Rule (updated)
- When planning mode is AUTO and the Ground Floor outer floor area is greater than 750 sq.ft, the room program contains at least one ATTACHED TOILET and one COMMON TOILET.
- For a standard 2 BHK program with two bathrooms, those two slots are converted to the explicit attached/common roles.
- On larger ground floors with a Master Bedroom and two planning columns, the attached toilet is placed directly beside the Master Bedroom; the common toilet remains in the wet/service core.
- Manual mode is not overridden by this rule.
