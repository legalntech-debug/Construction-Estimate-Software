# v20 update (5 files) — v19 ke upar

Copy (backup ke baad): 
- engine/roomPlanner.ts, engine/architecturalPlanningEngine.ts, engine/towerPlanner.ts (replace)
- engine/doorResolver.ts (v19 wali file replace)
- components/CadFloorPlansView.tsx (replace)
`npm run dev` restart.

1. Duct aur bathroom ke beech gap: stack toilet ab duct tak poori length leta hai; upar bachi patti bhi bathroom le leta hai (max 12 ft). Toilet duct par chadh jaye to duct tak kat jata hai.
2. Dressing ki wall bedroom door ko overlap kare: pehle dressing door se 0.25 ft door tak chhota; bahut chhota (<3.4 ft / <24 sq.ft) ho to door wall par khisakta hai; fir bhi na ho to dressing hata ke uska bacha hissa bathroom me jud jata hai. Door ki width kabhi kam nahi hoti. (sweep: 47 -> 0 overlaps)
3. Tower: total (stair+room) 70-100 sq.ft => ek hi kamra, stair aur room ke beech wall nahi. Total > 100 aur stair ke baad >= 80 sq.ft => mumty (stair) alag + adjoining room alag (jo area diya). Chhota extra => bhi ek kamra.

Test: engine-level; browser me nahi.
