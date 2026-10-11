# v9 update (v5 ke upar; v6, v7, v8 ke saare fix shamil)

4 files overwrite karni hain (pehle backup), phir `npm run dev` restart:
folder `src/app/(dashboard)/construction-plan/engine/`
- roomPlanner.ts
- architecturalPlanningEngine.ts
- labelFit.ts
- labelPlacer.ts

## v9 me kya hai (bedroom sizing aur stair-door)
1. Bedroom split ka order: pehle MASTER ki net jagah (attached toilet nikalne ke baad kam se kam 10 ft chauda), phir BEDROOM (kam se kam 9 ft). Kam pade to 7% tak dono me thoda-thoda adjust. Phir bhi jagah na ho to 2 bedroom nahi banate; ek hi bada bedroom furniture ke saath rehta hai.
2. Toilet bedroom ke andar ho to utna hi patla (min 5 ft) jitna bedroom net size bachane ke liye zaroori ho. Pehle 30x40 me master ka free hissa sirf ~7 ft chauda rehta tha.
3. Bedroom ka darwaza stair ke upar ya saamne nahi aata: stair se laga ho to darwaza uske bagal me khisakta hai; kisi bhi bedroom ke liye 3 ft darwaza + stair clearance na bache to us split ko hi skip karte hain.
4. Pichhle fix (v6 se v8): ground aur upper stair same, bedroom ek bathroom ke 2 toilet nahi, stair ke samne wall me opening, parking gate label overlap nahi, C stair ko zyada mauka, toilet ki chaudai bedroom ke hisaab se.

## Test (engine + SVG render; browser me nahi chalaya)
135 plot sizes (10 se 50 x 20 se 60) aur aapke diye sizes (30x40, 20x50, 30x35, 30x60, 20x40, 20x60, 25x50, 25x40, 27x40, 27x50): room overlap 0, stair over room 0, ek bedroom ke 2 toilet 0, bedroom ka darwaza stair par 0, ground aur upper stair same.

## Abhi baaki
- 18x30 par "[STAIR] usable placement nahi mila" aata hai (narrow, straight stair support nahi).
- 20x30: ground par C stair fit nahi hoti (living 8.8 ft gehri), isliye U rehti hai.
- Aapke UI ka asli room program (manual rooms) mere test se alag ho sakta hai. Agar phir bhi "UPPER STAIR ACCESS" error aaye to floor ke rooms ka screenshot aur console log bhejiye.
- General "ek item lagne ke baad dusre ka size adjust" pass, common toilet / stair ki position vary karna, irregular plot choice aur mobile pan-zoom: baaki.
