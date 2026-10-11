# v10 update (v5 ke upar; v6 se v9 ke saare fix shamil)

7 files overwrite karni hain (pehle backup), phir `npm run dev` restart.

Folder `src/app/(dashboard)/construction-plan/engine/`:
- roomPlanner.ts
- architecturalPlanningEngine.ts
- labelFit.ts
- labelPlacer.ts

Folder `src/app/(dashboard)/construction-plan/components/`:
- CadElevationRenderer.tsx
- CadSectionRenderer.tsx
- CadElevationSectionView.tsx

## v10 me naya
1. Upper floor ka bekaar lounge: jis taraf stair nahi hai us taraf ke front/rear bedroom ab lounge me stair ki line tak badhte hain; beech me sirf 4 ft ka PASSAGE bachta hai (bedroom darwaze + stair tak raasta). Living sirf stair wale hisse tak simat jata hai. Ye 28x45 se 50x60 ke un plots me lagta hai jahan upper bedroom 2-2 me bante hain (30x50, 30x60 sahit, 21 sizes). Single wide bedroom (jaise 25x50 ka 24 ft wala) abhi isme nahi aata.
2. C/hall-style stair zyada chuni jaati hai: selector ab upper bedroom ka kul area (1500 sq.ft tak) gine, pehle 400 par ruk jata tha aur bade plot me U/C barabar ho jaate the. 30x50, 25x50, 27x50, 20x50 ab hall-style chunte hain.
3. Elevation / Section sheet: PARAPET TOP, ROOF SLAB TOP, FIRST FLOOR... wale level call-outs ab poori sheet me sirf ek baar (sabse right wali drawing par). Baaki drawings saaf dikhti hain.

## Test (engine + SVG render; browser me nahi chalaya)
135 plot sizes: room overlap 0, stair kisi room par 0, ek bedroom ke 2 toilet 0, bedroom darwaza stair par 0, ground aur upper stair same.

## Abhi baaki
- Rear bedroom ko "bungalow jaisa huge" shape + duct dikhana: abhi nahi kiya. Bedroom pehle se badhte hain (ab zyada), duct planner alag se judna baaki hai.
- Ground floor par bhi bada living (30x50 me 29x20) bacha rehta hai; ye v10 me nahi chheda.
- 18x30: "[STAIR] usable placement nahi mila" (straight stair support nahi). 20x30: ground par C stair fit nahi hoti.
- General fit-and-grow pass, common toilet / stair ki jagah vary karna, irregular plot choice, mobile pan-zoom: baaki.
