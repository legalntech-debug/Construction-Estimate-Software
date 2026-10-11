# v6 update — ground aur upper floor ki stair SAME

Sirf 1 file replace karni hai:
`src/app/(dashboard)/construction-plan/engine/architecturalPlanningEngine.ts`
(pehle backup le lo, phir is zip wali file se overwrite karo, `npm run dev` restart.)

Kya badla:
- Ground floor ab isi call me asli settings ke saath pehle generate hota hai.
- Uski asli stair (x, y, size, entryFace, exitFace, spec, corner, shape) upper floors ko pass hoti hai.
- UI se aayi purani/stale groundStairPosition ignore hoti hai.

Test: 98 plot sizes (10..40 x 25..60) — ground aur first floor stair ka x/y/size/entry face 98/98 SAME.
Known: 18x30 pe "[STAIR] usable placement nahi mila" abhi bhi aata hai (narrow plot, straight stair support baaki).
Browser me test nahi kar paya — engine + SVG render se verify kiya.
