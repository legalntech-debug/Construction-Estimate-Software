# Phase 2 — 20x50 Planning Correction

## Root cause found

The previous narrow-plot branch created three geometries that could overlap:

1. A full-height `PASSAGE` was reserved beside the stair.
2. The stair was then placed into the same right-side zone.
3. The kitchen occupied the full service width while the common toilet/duct were placed inside that same rectangle.
4. The duct was also allowed to occupy the stair footprint.

This produced false/real spatial collision errors and a visually trapped middle service zone.

## New 20x50 strategy

For plots below 24 ft frontage the planner now uses coordinated zones rather than a fake full-height corridor:

- Front: parking + living/entry
- Stair: anchored to the front/living edge and used as the vertical core
- Middle: kitchen / kitchen-cum-dining + OTS duct + common toilet
- Rear: bedroom(s) + attached toilet where requested

For a typical 20x50 one-master configuration, the middle service bay is arranged as:

`KITCHEN / DINING | DUCT | COMMON TOILET | STAIR`

with no overlapping solid room rectangles.

## Ventilation

The common toilet receives an actual OTS duct. Kitchen/kitchen-dining keeps an exterior edge for ventilation. The toilet is not placed below the stair landing.

## Stair

The stair footprint is anchored at the front/living boundary so the stair has a direct architectural relationship with the entry/living zone and can act as the vertical core for upper-floor alignment.

## Diagnostics

The browser console now reports:

- `[ROOM PLANNER] INPUT → PROGRAM`
- `[ROOM PLANNER] GENERATED GEOMETRY`
- `[VALIDATION ENGINE] RESULT`

The geometry log includes each room's x/y/width/height, sub-zone relation, stair type and ventilation target. This makes the next failing plot directly traceable.

## Important limitation

This correction is deliberately dynamic; it is not a hard-coded 20x50 drawing. Smaller or unusually proportioned plots may be geometrically infeasible for the requested program. Those cases should be reported as a planning constraint rather than hidden by overlapping rooms.
