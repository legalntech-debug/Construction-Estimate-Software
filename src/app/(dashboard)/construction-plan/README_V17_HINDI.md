# v17 update (v16 ke upar) — 2 files replace karni hain
Folder `src/app/(dashboard)/construction-plan/`:
- `engine/roomPlanner.ts`
- `components/CadFloorPlansView.tsx`  (sirf 1 line: label ab `displayName` use karta hai)
(pehle backup, phir overwrite, `npm run dev` restart.)

## Kya badla
1. Upper floor par bedroom count ab "request" hai, guarantee nahi. Har candidate poora plan karke check hota hai:
   stair ground wali EXACT jagah par ho, overlap na ho, darwaza doosre bedroom me na khule, bedroom strip (aspect > 2.2) na ho,
   aur 3+ bedroom me har bedroom ka carpet >= 130 sq.ft. Pass na ho to bedroom kam karke (4 -> 3 -> 2) dobara plan hota hai.
   Isse 25x25 par 4 bedroom ki jagah 2 bedroom bante hain aur stair ground ke rear-corner wali jagah par hi rehti hai
   (pehle upper par beech me aa jati thi aur bedroom 12x8 ke ban jate the).
2. 25x25 jaise floor par ek bada bedroom ab 2 bedroom me tootta hai (24 ft se chhoti chaudai par bhi): partition stair + landing + darwaze ke baad,
   dusra bedroom poori length lekar (lobby ki bekar jagah use hoti hai). Chhota attached toilet (<30 sq.ft) 7 ft depth tak bada hota hai.
3. Upper floor ka "LIVING ROOM" jiska area 150 sq.ft se kam ho ab "STAIR LOBBY" likha jata hai (sirf label; baki logic same).

## Test (engine + SVG render; browser me nahi chalaya)
Grid 10..60 x 20..60, auto + 4-bedroom request: koi exception nahi, ground/upper stair 99/99 same.
15..40 x 25..60 me 4-bedroom request par issues 19/48 -> 5/48.

## Abhi baaki / assumptions
- "1 attached + 1 common toilet" (2 bedroom floor): abhi dono bedroom ke apne attached toilet hain; upper par common toilet nahi banaya.
- "Pehle upper plan, phir ground, phir stair check": abhi order ground -> upper hi hai; upper ab ground ki stair ke hisaab se bedroom kam karta hai, ground dobara nahi banta.
- 22x25 jaisi chhoti chaudai par upper abhi 1 bada master + dressing banta hai (2 bedroom ke liye chaudai kam).
- 30x30: 4 bedroom ka carpet 108-111 sq.ft (130 se kam), 3 bedroom me strip banti hai — abhi 4 bedroom hi.
