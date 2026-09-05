# Construction Plan Phase 2 — Room Input / Access / Wall Fix

## Scope
This phase fixes the next blocking floor-plan problems after duplicate-engine cleanup.

### 1. AUTO / MANUAL room input is authoritative
- Floor-wise selected room/count data is read by the master room planner.
- MANUAL `areaPerRoom` is preserved as a planning target.
- `KITCHEN CUM DINING` is treated as a combined architectural requirement.
- `MAIN HALL` is normalized to `LIVING ROOM`.
- Requested rooms are never silently dropped.
- Missing requested rooms become hard planning errors.

### 2. Dynamic topology
- No single 20x50/25x45 layout is hardcoded.
- Narrow plots use a side circulation spine or a dedicated ultra-narrow topology.
- Kitchen + dining can stack when side-by-side geometry would make either space unusable.
- Dining can become an explicit living/dining sub-zone when an independent bay cannot fit.
- Balcony can be an attached open sub-zone when no independent footprint remains.

### 3. Parking
- Ground-floor parking remains attached to the normalized road/front edge.
- Narrow frontage uses a full-front parking topology instead of forcing an unusable side car bay.
- Vehicle-fit metadata is retained for validation/warnings.

### 4. Stair coordination
- Stair type remains geometry-dependent: STRAIGHT / L-SHAPED / DOG-LEGGED.
- Riser/tread calculation is retained from floor-to-floor height.
- Upper floors reuse the ground-floor stair footprint when the upper footprint permits it.
- This gives section/elevation a stable vertical circulation core.

### 5. Wall/opening rendering
- Shared room boundaries are rendered as double partition-wall lines instead of suppressing both sides.
- Opening cuts are rendered AFTER wall lines, so doors/windows visibly break the wall.
- Open-area/sub-zone overlaps are handled separately from solid-room collision checks.

### 6. Diagnostics
The master engine now logs:
- floor input
- generated room program
- every room's x/y/w/h
- stair specification
- floor errors/warnings
- final building summary

Console prefix: `[PLANNING ENGINE]`

## Important validation behavior
A generated plan is not considered valid merely because rectangles do not overlap. The pipeline now checks requested-room presence, boundary geometry, room collisions, parking frontage, stair geometry and practical furniture-fit warnings. The central validation engine also treats missing generated door/opening paths as connectivity errors.

## Known limitation for this phase
The project source archive does not include installed `node_modules`/`tsconfig.json`, so a complete Next.js production build cannot be executed inside this archive. The modified TypeScript planning-engine files were compiled independently with TypeScript and passed syntax/type checking for their referenced engine modules.
