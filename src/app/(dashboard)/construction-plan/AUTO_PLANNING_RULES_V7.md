# AUTO Planning Rules v7 — cumulative specification

## Ground Floor AUTO tiers

### <= 750 sq.ft
Starting compact program:
- 1 Master Bedroom
- 1 Common Toilet
- 1 Kitchen
- 1 Living / Drawing
- Compact Dining (can be functionally combined with Living where the footprint is too small)
- Parking when the frontage/geometry permits
- Staircase when an upper floor is selected
- Utility when area/geometry permits
- Pooja/Store only when space permits

### 751–1100 sq.ft
Default program:
- 1 Master Bedroom
- 1 Attached Toilet
- 1 Common Toilet
- 1 Kitchen
- 1 Dining
- 1 Living / Drawing
- Parking when feasible
- Staircase when required
- Utility from about 900 sq.ft upward when geometry permits
- Pooja from about 1000 sq.ft upward when geometry permits
- Duct/service ventilation as required

### 1101–1500 sq.ft
Default program:
- 1 Master Bedroom
- 1 Bedroom
- 1 Attached Toilet
- 1 Common Toilet
- Kitchen
- Dining
- Living / Drawing
- Staircase
- Parking
- Pooja
- Utility
- Duct/OTS where useful

### 1501+ sq.ft
Requirement-driven. Start from a practical 2-bedroom core if no explicit room program is supplied. Add a third bedroom, Study, Store, Pooja, Utility, additional duct/OTS, larger Living/Dining, or improved parking only when the actual floor geometry and furniture-clearance checks support it.

Area alone must never force an extra bedroom.

## Room practicality

Each bedroom is evaluated using minimum clear width/depth, aspect ratio, and a non-rendered furniture envelope representing bed, wardrobe and clear walking space. Living uses sofa/TV/circulation assumptions; Dining uses table/clearance; Kitchen uses counter/fridge/working aisle assumptions. Furniture is not drawn in the final 2D plan unless explicitly requested.

## Parking

The selected MAIN ROAD is always the bottom/front edge of the normalized drawing. Ground-floor parking must connect to that road/front edge. Parking can be BOX, L-SHAPE or SIDE when the actual geometry makes the candidate feasible. L-shaped parking is preferred on wide frontages only when it does not compromise pedestrian entry, living access or required room envelopes.

Vehicle gate and pedestrian/main entry are separate logical openings. The same access relationship must never create duplicate doors on one wall.

## Orientation and corner plots

N/S/E/W is normalized by rotating the sheet so the selected MAIN ROAD is always at the bottom. Corner properties retain the side-road relationship after the same rotation: main road bottom, side road on its correct relative side.

## Circulation

The generated access graph should support, where the program requires it:

ROAD → VEHICLE GATE → PARKING → MAIN ENTRY → LIVING/HALL → DINING/KITCHEN/PRIVATE ROOMS
and
LIVING/HALL → STAIR → FIRST FLOOR / TOWER.

Bedrooms, bathrooms and service spaces must not become isolated islands. Toilets are placed so they have a door path from the main circulation network.

## Stairs

Stair type is selected from actual available geometry, not plot presets. Candidates include STRAIGHT, L-SHAPED and DOG-LEGGED. Riser, tread, flight width, landing, run and access are checked. L-shaped stairs are allowed on narrower/deeper plots when they produce a more practical run/landing arrangement.

## Ducts and wet zones

Bathrooms and kitchen service zones should prefer shared/stacked ducts where possible. Additional ducts/OTS are allowed when one shaft cannot serve the wet/service arrangement. A duct is ventilation/service infrastructure, never a circulation room.

## Doors / windows / walls

A shared access relationship is represented by one logical opening ID. Wall geometry is split at door/window openings so the wall is actually open at that span. Windows are drawn as symbols between the remaining wall segments.

## Labels

Room labels should be centered/wrapped inside their room bounds and prevented from overlapping walls, openings or adjacent room labels.

## Validation levels

Hard errors: overlaps, out-of-bound geometry, missing required access, inaccessible parking/entry, impossible stair/access, missing mandatory ground-floor toilets, duplicate/overlapping openings.

Warnings: compact room dimensions, unusual aspect ratio, lower Vastu score, reduced optional rooms, small parking, limited daylight/ventilation potential.

## Current acceptance test

Primary design test: 25' × 45' plot, Ground + First Floor + approximately 100 sq.ft Tower/Mumty. The size is a test case only; production planning must remain fully dynamic for changing plot and floor dimensions.
