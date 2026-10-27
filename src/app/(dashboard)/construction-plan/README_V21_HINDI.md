# v21 update (3 files) — v20 ke upar

Replace: engine/roomPlanner.ts, engine/architecturalPlanningEngine.ts, engine/towerPlanner.ts  -> `npm run dev` restart.

1. Tower box (jaise 150 sq.ft = 10 x 15): box ab stair ke saath hi 10 x 15 hota hai (stair ki width alag se add nahi hoti).
   Box stair se bada ho to peeche (nahi to aage, nahi to dono taraf) badhta hai. Stair ke bagal ki patti stair (mumty) se jud jaati hai,
   peeche ki poori-width patti TOWER ROOM banti hai. 70-100 sq.ft total => ek hi kamra.
2. Stair selector: sirf ground floor ho to sirf ground ke angle se (living ka sabse bada free rectangle), upper floor ho to ground + upper
   dono; stair ke baad bacha space me furniture (living ~9x9 sofa+TV, bedroom ~10x10 bed+cabinet) fit na ho to stair ki position / type /
   UP-DOWN face (flip) / LEFT-RIGHT corner badal ke best chuna jaata hai. Sirf ground floor par selector crash hota tha (upper null) - fix.

Test: engine-level (browser me nahi). Sweep: door conflicts 0, unusable stairs sirf 18x30.
