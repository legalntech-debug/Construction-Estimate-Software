# Parking Mode Update

This revision adds dynamic ground-floor parking requirements without using a plot-specific floor-plan preset.

## User options
- 2-WHEELER
- CAR
- CAR + BIKE + PEDESTRIAN
- ONLY PARKING / ENTRY ZONE

## Engine behaviour
- `getParkingMinimum()` provides configurable planning baselines.
- `selectParkingCandidate()` scores BOX / L / SIDE candidates against the selected parking mode and actual footprint.
- Parking mode is stored on the generated parking room and travels through the master planning engine.
- Car+bike+pedestrian candidates can carry protected bike/pedestrian sub-zone metadata.
- The displayed values are planning baselines, not universal statutory minima; local DCR/authority rules must still be applied.

## Also retained
- Main road normalized to the bottom in local planning coordinates.
- 4-inch internal wall / 9-inch external wall constants.
- Protected passage/circulation rules.
- Parking-first access intent and parking-to-hall connection logic.
- Dynamic stair sizing and vertical stair-core coordination.
- Ground AUTO bedroom rule: second bedroom only when area > 1200 sq.ft and usable frontage >= 22 ft.
