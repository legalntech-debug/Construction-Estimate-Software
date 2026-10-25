# v18 update (v16/v17 ke upar) — 2 files replace karni hain
Folder `src/app/(dashboard)/construction-plan/`:
- `engine/roomPlanner.ts`
- `components/CadFloorPlansView.tsx` (v17 wali hi; "STAIR LOBBY" label)
(pehle backup, phir overwrite, `npm run dev` restart.)

## Kya badla
1. Ground ke duct + toilet ke upar wala upper bathroom (20x40 me circle wala): ab ground wale toilet ki poori length leta hai, upar khaali jagah nahi bachti.
   - length <= ~10 ft: sirf bathroom (length 10 ft tak badhti hai)
   - length > 10 ft: bathroom + dressing (dressing ~32% ya min 3.4 ft)
   20x40: bathroom 7.25x7.75 + dressing 7.25x3.75 corner me (pehle 3.5 ft ka khaali gap tha).
2. Doosra (non-stack) bathroom/dressing: ab furniture ke hisaab se jagah chunta hai. 4 corner x (row/column) x depth 5.5-8.5 ft candidates me se
   wo jisme bedroom ka sabse bada khaali rectangle bache (bed + dono taraf cabinet/wardrobe ke liye 10.5 x 10 ft+). Shart: toilet ki ek bahari wall (window),
   darwaza bedroom ki taraf, bedroom ke darwaze/duct se na takraye. Naya placement tabhi jab free rectangle >= 8% bada ho.
   20x40: rear bedroom ka toilet+dressing ab stair ke neeche left wall par (green box wali jagah), bedroom ka clear rectangle ~12.8 x 19 ft.

## Test (engine + SVG render; browser me nahi chalaya)
Grid 10..60 x 20..60, auto + 4-bedroom request: koi exception nahi, ground/upper stair same, naye issue 0 (pehle jaise hi 21/99 known: 10 ft wide parking gate, 15x45/15x50/30x30/30x45 carpet).
