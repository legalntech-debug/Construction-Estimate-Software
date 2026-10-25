# v19 update (3 files)

Copy karo (purana backup le lo), phir `npm run dev` restart:
- engine/roomPlanner.ts        (replace)
- engine/architecturalPlanningEngine.ts (replace)
- engine/doorResolver.ts       (NAYI file)

Kya badla
1. Door-cross resolver (doorResolver.ts): plan + openings banne ke baad har darwaze ka asli swing arc nikalta hai. Agar kisi
   doosre door ke swing / opening / stair se cross kare to pehle POSITION, phir HINGE side, last me SWING side badalta hai
   (shared opening ke dono taraf). 476 floors sweep: pehle 12 conflicts, ab 0.
2. Bathroom/dressing green-box case (20x45, 26x40 jaise): wet block ab lobby/living wali wall ke saath ROW me
   (toilet + dressing ek line) aata hai, bedroom ke peeche poori chaudai ka clean rectangle bachta hai. Bedroom ke bagal ki
   lambi (7x14) toilet bhi bathroom + dressing me tootti hai. Stack toilet 11 ft tak ek hi rehta hai (chhota 3.4 ft dressing + khali gap nahi).
3. Console error `[STAIR] blocks door COMMON TOILET:shared-ct-living` (30x30 jaise compact square): living ab stair + 3 ft door band
   ke hisaab se badhti hai. Unusable ground stairs 17 -> 1 (sirf 18x30 bacha). Variant-selector ka message ab console.warn hai.

Test: engine-level (browser me nahi). Nota: ground ka layout aapke screen se thoda alag aa sakta hai agar aapne floor settings / rooms manually di hon.
