# v14 update (v13 ke upar) - sirf 4 file badli hain
Copy karo: `construction-plan/engine/` me
- towerPlanner.ts
- architecturalPlanningEngine.ts
- roomPlanner.ts
- openingPlanner.ts

## Kya sahi hua
1. **Tower**: ab hamesha EK hi TOWER ROOM banta hai (stair ke peeche, nahi to aage, nahi to bagal; entry landing kabhi block nahi). Stair ka darwaza terrace/exit side par aur TOWER ROOM ka darwaza uski sabse lambi free wall par (stair ke andar nahi). Openings planner ke extra/galat darwaze tower par hata diye.
2. **Upper floor bathroom (ground jaisa)**: toilet + duct ground ke same x,y par; uske bagal bachi bekaar jagah (ground ke common toilet wali footprint) ab bedroom ka DRESSING banti hai. Dressing ka darwaza sirf apne bedroom se (living/passage se nahi).
3. **Bedroom 130 sq.ft balance** (ground + upper, side-by-side bedroom pair): carpet = area - toilet - duct - dressing. Kam carpet wale ko dusre se jagah dekar pehle 130 tak, phir bacha hua dono me barabar (end me carpet barabar). 130 tak na pahunche to best possible. Darwaze apni jagah par rehte hain; wet-stack/duct wali wall nahi khisakti. Upper floor me ground ki partition wall ke paas ho (aur imbalance <=40 sq.ft) to wahi x (structural alignment), warna apna balance.
   Example 40x40 ground: master 19.75 -> 21.8 ft, bedroom 2 19.58 -> 17.6 ft (carpet ~138 / ~136).
4. **Stair-side bedroom aage badhana**: logic add hai (stair + entry clearance + darwaza approach + passage chhod kar bachi jagah tak). Rectangle rooms ki wajah se ye tabhi lagta hai jab bachi jagah poori chaudai me ho. Abhi test sizes (20..60 x 30..80) me aisi jagah nahi mili (stair, entry-landing aur darwaze ka approach hi poori lounge ghera rakhte hain), isliye kuch nahi badla - ye honest limitation hai. L-shape bedroom chahiye to alag se karna padega.

## Test (engine level, browser nahi)
- 99 plans (20..60 x 30..80): room overlap 0, darwaza overlap/out-of-wall 0, dressing/toilet multiple door 0.
- Tower: 56 combos (7 plots x 8 box sizes): multiple TOWER ROOM 0, stair se overlap 0, canvas ke bahar 0, har room me darwaza.
- Irregular shapes (trapezoid/irregular/L/triangle) 12 plans: crash 0.
