# Phase 4 — Layout / Wall / Gate / Passage Diagnostic Fix

## What was corrected

1. **Ground AUTO bedroom rule**
   - 600–1000 sq.ft: exactly one Master Bedroom strategy.
   - One Attached Toilet + one Common Toilet.
   - A second bedroom is not injected by default in this area band.
   - Larger ground floors may add a second bedroom only when the area/frontage rule permits.

2. **Architectural zoning**
   - Main road is normalized to the local bottom edge.
   - Ground front zone is Parking + Living when frontage permits.
   - Narrow frontage does not create a fake undersized side-by-side living/car bay; it stacks zones instead.
   - Rear bedrooms are reached from a protected circulation spine.

3. **Passage**
   - Passage is a real circulation entity.
   - Pink guide lines render horizontally or vertically depending on passage geometry.
   - Passage-to-room connections are represented as `PASSAGE_OPENING`, not a fake hinged door.
   - The wall is still physically cut at the passage opening.

4. **Doors / gates**
   - Main vehicle gate is owned by the Ground Floor Parking zone.
   - Gate is on the normalized road-facing external wall.
   - Upper floors no longer receive a fake Main Road gate.
   - Bedroom-to-bedroom direct access is prohibited.

5. **External wall**
   - External wall baseline is 9 inches.
   - Internal partition wall baseline is 4 inches.
   - External gate opening is rendered outside the inner clipping group so it can break the external wall ring.

6. **Renderer source of truth**
   - `floorInfo.rooms` from the generated architectural plan is now the primary renderer source.
   - Stale UI `floorRooms` data is fallback only.
   - This prevents generated doors/gates from disappearing because an older input-room object was rendered.

7. **Upper floor**
   - AUTO upper floor can generate two bedrooms with two attached toilets where the footprint supports them.
   - Narrow upper floors stack bedrooms along depth so both bedrooms independently touch the passage.
   - Stair alignment is not blindly copied when it would place the stair inside a bedroom/service zone.

## Diagnostic console path

The browser console now reports the pipeline in this order:

`roomPlanner.ts → parkingPlanner.ts → stairPlanner.ts → openingPlanner.ts → cadGeometry.ts → validationEngine.ts → CadFloorPlansView.tsx`

Important groups:

- `[ROOM PLANNER] INPUT → PROGRAM`
- `[ROOM PLANNER] ARCHITECTURAL DECISION`
- `[ROOM PLANNER] GENERATED GEOMETRY`
- `[OPENING PLANNER] FINAL OPENING AUDIT`
- `[PLAN PIPELINE DIAGNOSTIC] FLOOR`
- `[CAD DIAGNOSTIC] FLOOR`
- `[CAD VALIDATION] FLOOR`

The diagnostic output explicitly identifies whether a problem belongs to room geometry, opening data, wall geometry, validation, or rendering source selection.

## Verification performed

The final engine TypeScript set was compiled with TypeScript (`ENGINE_TSC_OK`).

Acceptance checks included 20×40 and 25×45 Ground + First Floor AUTO plans:

- Ground: 600–1000 sq.ft → one bedroom + attached + common toilet.
- Ground: main parking gate exists on BOTTOM external wall and is marked as external opening.
- Ground: passage exists as protected circulation.
- First: two bedrooms can be independently reached from passage.
- First: two attached toilets are generated where footprint supports them.
- Upper floors do not get a fake road gate.
- Tested plans returned zero planning/validation errors after the final fixes.

These are software-engine diagnostics, not municipal approval or structural certification.
