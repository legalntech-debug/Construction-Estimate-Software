# v16 update (v15 ke upar) — sirf 1 file replace karni hai
`src/app/(dashboard)/construction-plan/engine/roomPlanner.ts` (pehle backup, phir overwrite, `npm run dev` restart).

## Upper floor
1. Right-side bedrooms ki partition wall par jo EXTRA darwaze (green mark) aa rahe the wo hata diye. Ab right column ke front/rear bedroom ka sirf ek darwaza, beech ki partition wall se standard wall-clearance par (pehle ~10.8 ft door dur tha).
2. Stair-side (left) bedroom ki length ab living ke andar tak badhti hai jahan tak stair ki wall/stair ka access ho; right-side room ka darwaza block ho to darwaze ke end-point se 1 inch pehle ruk jati hai. Stair ki entry clear rehti hai.
3. Bathroom rule: area <= 48 sq.ft -> sirf bathroom; > 70 sq.ft -> 68% bathroom + 32% dressing; 48-70 me side-strip toilet ho aur bachi bedroom chaudai 12 ft se kam ho to bathroom chaudai min 4 ft tak. (Duct/stack se bandhe toilet ground ke saath aligned hi rehte hain.)
4. Koi bhi bedroom darwaza ab doosre bedroom me nahi khulta (v15 me 25/48 test plans me tha, ab 0).

## Ground floor
- Common toilet ab kitchen row ke RIGHT end par (green box wali jagah); alag PASSAGE row hat gayi. Bachi hui jagah master bedroom + attached toilet + duct aur living/stair ko mili.
- Gate (meri assumption): floor width >= 20 ft -> hamesha ye front-row planning (parking 6-8 ft, common toilet 4-4.5 ft, baaki kitchen). Width < 20 ft -> chhota/bada side ratio >= 0.80 (22x25 = 0.88) ho tabhi; 18x30 (0.60) purani planning me rehta hai.
- Length ~41 ft se zyada par purani rows wali planning chalti hai (wahan service row ki jagah bedroom ko deni zaroori nahi).

## Test (engine + SVG render; browser me nahi chalaya)
Grid 15..40 x 25..60: v15 me 24/48 plans me issue, v16 me 5/48 (baaki: 15x45, 15x50, 30x30, 30x45 me bedroom carpet 99-125 sq.ft, narrow/square plot ke natural limit).
Abhi baaki: mobile pan-zoom, 18x30 stair error, `NO BRANCH MATCHED` warning (kuch floor/size combos branch me nahi aate; fallback chal jata hai).
