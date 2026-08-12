# Construction Plan — Road & L-Shape Update

Implemented in this module:

- Road/front-side option is treated as an ordered selection: the FIRST direction is always the main/front road and is rendered at the bottom of the site layout.
- Exhaustive road combinations are available:
  - 4 single-side roads
  - 8 ordered corner combinations
  - 4 ordered opposite/two-side combinations
  - 12 ordered three-side combinations
  - 4-side island/open plot
- Boundary labels are remapped from North/South/East/West to the actual screen position based on the selected main road.
- Road renderer follows actual polygon edges, including L-shape edges, instead of drawing unrelated rectangular road boxes.
- Four-side road now renders on all four sides.
- North arrow orientation is corrected:
  - South road -> North up
  - North road -> North down
  - East road -> North left
  - West road -> North right
- L-shape geometry is generated from editable dimensions:
  - A = overall width
  - C = overall depth
  - E = notch width
  - F = notch depth
  - B/D are derived for compatibility.
- All six L-shape variants are supported.
- L-shape polygon area/perimeter are calculated from the actual polygon geometry.
- L-shape dimensions are rendered from actual polygon edge lengths.
- Plot boundary remains yellow; buildable/proposed boundary remains red.
- Road is rendered underneath the plot so it does not bleed into the plot area.
- Saved construction-plan data now restores road side, measurement unit, coverage and four boundaries.

Validation performed:
- TypeScript compilation of the new road/geometry utility: PASS.
- Road combination matrix tests: PASS.
- L-shape polygon area/validity tests for all six variants: PASS.

Note: this upload contains the Construction Plan module only. Full application compilation still depends on the parent project's existing `src/lib`, package dependencies and environment files.


## Bug-fix pass — Road orientation, MOS footprint and L-shape dimensions

- The plot remains front-relative: the first selected road direction is always the bottom edge. Geographical labels and the north arrow rotate instead of rotating the editable geometry.
- Corrected relative compass mapping, including NORTH-front and EAST/WEST-front cases.
- Road renderer now recognises boundary segments inside an L-shape/irregular bounding box, so roads do not disappear on recessed edges.
- MOS now generates a visible buildable polygon instead of reusing the complete plot polygon.
- Buildable area is shown on the input page and used as the floor footprint area.
- L-shape input preview now uses the real polygon dimension overlay for every boundary segment.
- CAD L-shape dimensions use polygon winding to place dimension labels on the true outside of concave edges.
- Rectangular A/C edits keep opposite sides synchronized; independently changing B or D promotes the shape to IRREGULAR instead of silently ignoring the entered dimension.
