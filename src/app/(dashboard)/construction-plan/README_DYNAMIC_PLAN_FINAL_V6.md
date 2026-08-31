# Construction Plan — Dynamic AUTO Planning v6

## Main update
This version uses actual floor dimensions as the planning envelope and keeps the selected front/main road at the normalized bottom edge before CAD rotation. AUTO room programs are dimension/area driven, not preset-size driven.

## Planning behavior
- Ground AUTO > 750 sq.ft: exactly 1 attached toilet + 1 common toilet.
- 1200/1500/1600/1700+ sq.ft scales the AUTO room program; 4-BHK is used only when the actual geometry can support it comfortably.
- Bedroom/living/kitchen dimensions are checked against furniture-clearance assumptions; furniture is not rendered.
- Large front zones can use an L-shaped parking arrangement (main bay + L-wing) while keeping vehicle access on the bottom/road edge.
- Internal access is validated through actual door connectivity; ducts and parking extensions are not treated as destinations.
- Doors are unique shared openings: the wall is cut on both room sides but only one door symbol is rendered.
- Windows/ventilators create wall openings and remain on exterior walls.
- Stair type is selected from actual floor geometry and minimum technical settings; the selected staircase model is stored with the floor.
- Tower/Mumty is represented as dynamic terrace + stair headroom core.

## Test cases run
Core engine TypeScript compilation passed. Dynamic tests passed for:
- 25x45 Ground + First + Tower
- 30x40 Ground
- 40x40 Ground
- 40x60 Ground + First + Tower
- 20x30 Ground
- 10x20 Ground
- 25x45 corner South main road + East side road

## Important
The engine is a planning/visualization aid. Local development-control rules, structural design, fire/access requirements, setbacks, and final approval must still be verified for the actual site by the relevant licensed professional/authority.


## V7 cumulative AUTO planning update
See `AUTO_PLANNING_RULES_V7.md` for the current cumulative area-tier, practical-room, parking, orientation, circulation, stair, duct, opening and validation rules. These are dynamic rules; 25' × 45' G+1+Tower is only the acceptance test case.
