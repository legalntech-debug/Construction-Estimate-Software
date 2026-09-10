# CAD / Planning Debugging Guide — Phase 4

## Fixes in this build

- Internal partition walls are derived from final room geometry and rendered as real 4-inch partitions.
- Shared room edges are rendered once, so partitions do not disappear because two rooms both suppress the same edge.
- External main-road gate openings are cut through the 9-inch external wall ring outside the inner SVG clip.
- Room fills are painted before final partition walls; opening cuts and door/window symbols are painted after walls.
- Compact 20×40-class plans use a front parking/living public zone, service zone, protected passage and private zone. The stair can be a validated sub-zone of living/public space.
- Upper floors use a side protected passage for stacked bedrooms so the lower bedroom is not disconnected.
- Upper-floor stair alignment no longer blindly moves a stair into a kitchen/service zone.
- Repeated React renders no longer flood the console with identical CAD validation diagnostics.

## Console routing

| Console block | Responsible file | What to inspect |
|---|---|---|
| `[ROOM PLANNER]` | `engine/roomPlanner.ts` | Program, room coordinates, dimensions, overlap, furniture fit |
| `[OPENING PLANNER] FINAL OPENING AUDIT` | `engine/openingPlanner.ts` | Main gate, internal doors, wall side, opening widths |
| `[VALIDATION ENGINE] RESULT` | `engine/validationEngine.ts` | Hard errors and connectivity |
| `[CAD DIAGNOSTIC] FLOOR` | `components/CadFloorPlansView.tsx` | Partition edge count, opening audit, CAD wall drawing |
| `[CAD VALIDATION] FLOOR` | `engine/validationEngine.ts` via renderer | Final CAD-facing validation result |

### Main gate expectation
For parking-first ground-floor planning:

`ROAD → PARKING → LIVING`

The main vehicle gate should report:

- `room: PARKING`
- `wall: BOTTOM` in normalized coordinates
- `isExternalOpening: true`
- `cutsExternalWall: true`

### Partition expectation
For a multi-room floor, `[CAD DIAGNOSTIC]` should report a non-zero `internalPartitionEdges` value. `internalPartitionAudit` identifies the two rooms and wall side for each partition.

## Architectural rule
A valid room plan and its CAD drawing must agree. We do not hide validation errors merely to make a drawing appear valid. If geometry is impossible, the planner must re-plan or reject it; if geometry is valid, its walls/openings must visibly exist in the CAD output.
