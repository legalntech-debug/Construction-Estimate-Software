# Phase 4 — Parking + Protected Passage + Access Update

## Rules added
- Ground AUTO: <= 1200 sq.ft OR usable width < 22 ft uses a single-master strategy.
- Ground AUTO: >1200 sq.ft AND usable width >= 22 ft may use master + bedroom.
- Narrow/medium plans use L-shaped/two-flight stair preference to avoid excessive stair depth.
- Parking is vehicle-fit validated; 9' x 15' is accepted as the compact car-bay baseline.
- Passage is a real protected circulation zone, normally 3.25 ft wide.
- Passage has two pink guide edges in CAD debug/render view.
- Any room geometry crossing the protected passage is a hard validation error.
- Room connectivity includes the passage in the access graph.
- Internal partition wall thickness is 4 inches; outer wall remains 9 inches.
- Opening placement is downstream of room/passage geometry.
- Removed unused duplicate engines and redirected active imports to the master pipeline.

## Active planning order
architecturalPlanningEngine → roomPlanner → parkingPlanner/stairPlanner → openingPlanner → validationEngine → building model → section/elevation → CAD renderer.

## Diagnostics
Console tracing identifies the active master engine, room planner, parking, stair, openings, validation and renderer stages. Room geometry, stair geometry, parking candidate and validation errors/warnings are logged per floor.
