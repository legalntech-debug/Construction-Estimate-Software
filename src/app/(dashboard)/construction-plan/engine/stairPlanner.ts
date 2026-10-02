/* =========================================================
CONSTRUCTION PLAN SYSTEM — STAIRCASE RULES ENGINE (v2)
✅ Footprint ab sahi geometry se nikalta hai (U / C / L / Winder)
✅ Rise & tread dynamic -> shape & size (requiredWidthFt / requiredLengthFt) directly inse
✅ fitStaircaseToZone(): zone me fit + minimum 4 ft passage check + extension rule
========================================================= */

import { StaircaseSpec } from "./planningTypes";

export type StaircaseType =
  | "DOG_LEGGED"
  | "L_SHAPED"
  | "2_QUARTER_WINDER"    // C-Shape with winders
  | "2_QUARTER_LANDING";  // C-Shape with landing + middle treads

export interface StaircaseFootprint extends StaircaseSpec {
  staircaseType: StaircaseType;
  requiredWidthFt: number;
  requiredLengthFt: number;
  flight1: { treads: number; riserCount: number; lengthFt: number };
  flight2: { treads: number; riserCount: number; lengthFt: number };
  landing1: { widthFt: number; lengthFt: number };
  landing2: { widthFt: number; lengthFt: number };
  middleTreads: number;
  /** Zone ke andar stair ke baad bacha hua free space (passage check ke liye) */
  wellSize: { widthFt: number; lengthFt: number };
  totalRiseInches: number;
  totalTreadDepthInches: number;
  /** NEW */
  flightWidthFt: number;
  winderRisers: number;
  middleRunFt: number;
}

const STAIR_GAP_FT = 0.3; // do flights ke beech ka well gap

/** ✅ User rules: riser 6"–7.5", tread 9"–11", flight width 0.9 m – 1.0 m (feet me) */
export const RISER_MIN_IN = 6;
export const RISER_MAX_IN = 7.5;
export const TREAD_MIN_IN = 9;
export const TREAD_MAX_IN = 11;
export const FLIGHT_WIDTH_MIN_FT = Number((0.9 / 0.3048).toFixed(2)); // 2.95 ft
export const FLIGHT_WIDTH_MAX_FT = Number((1.0 / 0.3048).toFixed(2)); // 3.28 ft

/**
 * Dynamic staircase calculator.
 * Riser/tread nikalta hai, flights me risers baantta hai, phir footprint banata hai.
 *
 * NOTE: U / C stair me dono flights PARALLEL chalti hain, isliye
 *   length = max(flight1, flight2) + landing depth      (flights add NAHI hoti)
 *   width  = 2 * flightWidth + (gap ya middle treads ki run)
 */
export function calculateStaircase(
  floorToFloorHeightFt: number = 10,
  availableWidthFt: number = 10,
  availableLengthFt: number = 16,
  staircaseType: StaircaseType = "DOG_LEGGED",
  preferredRiserIn: number = 7,
  preferredTreadIn: number = 11,
  flightWidthFt: number = FLIGHT_WIDTH_MAX_FT,
  middleTreadsOverride?: number,
): StaircaseFootprint {
  const totalHeightInches = floorToFloorHeightFt * 12;

  // ---------- STEP 1: RISER ----------
  let riserCount = Math.max(2, Math.round(totalHeightInches / preferredRiserIn));
  let actualRiserInches = Number((totalHeightInches / riserCount).toFixed(2));
  if (actualRiserInches > RISER_MAX_IN) {
    riserCount = Math.ceil(totalHeightInches / RISER_MAX_IN);
    actualRiserInches = Number((totalHeightInches / riserCount).toFixed(2));
  } else if (actualRiserInches < RISER_MIN_IN) {
    riserCount = Math.max(2, Math.floor(totalHeightInches / RISER_MIN_IN));
    actualRiserInches = Number((totalHeightInches / riserCount).toFixed(2));
  }

  // ---------- STEP 2: TREAD (10 - 11") ----------
  // preferredTreadIn ko cap maante hain: 10" se kam nahi, preferred se zyada nahi
  const baseTread = actualRiserInches < 6.5 ? 10 : actualRiserInches < 7 ? 10.5 : 11;
  // preferredTreadIn = upper cap. Tread kabhi 9" se kam / 11" se zyada nahi.
  const treadInches = Math.max(
    TREAD_MIN_IN,
    Math.min(TREAD_MAX_IN, Math.min(baseTread, preferredTreadIn)),
  );

  const fw = Math.min(FLIGHT_WIDTH_MAX_FT, Math.max(FLIGHT_WIDTH_MIN_FT, flightWidthFt));
  const landingDepth = fw; // square landing

  // ---------- STEP 3: RISERS KA SPLIT ----------
  const isWinder = staircaseType === "2_QUARTER_WINDER";
  const isCLanding = staircaseType === "2_QUARTER_LANDING";

  const middleTreads = isCLanding
    ? Math.max(1, Math.min(5, Math.round(middleTreadsOverride ?? 3)))
    : 0;
  const winderRisers = isWinder ? 6 : 0;                  // 3 per quarter turn
  const middleRisers = isCLanding ? middleTreads + 1 : 0; // landing1 -> landing2

  const remaining = Math.max(2, riserCount - winderRisers - middleRisers);
  const risersFlight1 = Math.ceil(remaining / 2);
  const risersFlight2 = remaining - risersFlight1;

  // Landing/floor wala riser flat tread nahi deta -> treads = risers - 1
  // Winder me flight1 ka last riser winder me jaata hai -> flight1 treads = risers
  const treadsFlight1 = Math.max(1, isWinder ? risersFlight1 : risersFlight1 - 1);
  const treadsFlight2 = Math.max(1, risersFlight2 - 1);

  const flight1LengthFt = Number(((treadsFlight1 * treadInches) / 12).toFixed(2));
  const flight2LengthFt = Number(((treadsFlight2 * treadInches) / 12).toFixed(2));
  const longestFlight = Math.max(flight1LengthFt, flight2LengthFt);

  // ---------- STEP 4: FOOTPRINT ----------
  let requiredWidthFt = 0;
  let requiredLengthFt = 0;
  let middleRunFt = 0;

  switch (staircaseType) {
    case "2_QUARTER_LANDING":
      middleRunFt = Number(((middleTreads * treadInches) / 12).toFixed(2));
      requiredWidthFt = 2 * fw + middleRunFt;
      requiredLengthFt = longestFlight + landingDepth;
      break;
    case "2_QUARTER_WINDER":
      requiredWidthFt = 2 * fw + STAIR_GAP_FT;
      requiredLengthFt = longestFlight + landingDepth; // winders landing wale square me hi hain
      break;
    case "L_SHAPED":
      // flight1 length ke along, landing, flight2 width ke along
      requiredLengthFt = flight1LengthFt + landingDepth;
      requiredWidthFt = fw + flight2LengthFt;
      break;
    case "DOG_LEGGED":
    default:
      requiredWidthFt = 2 * fw + STAIR_GAP_FT;
      requiredLengthFt = longestFlight + landingDepth;
      break;
  }
  requiredWidthFt = Number(requiredWidthFt.toFixed(2));
  requiredLengthFt = Number(requiredLengthFt.toFixed(2));

  // ---------- STEP 5: ZONE ME BACHA HUA SPACE ----------
  const wellWidthFt = Math.max(0, Number((availableWidthFt - requiredWidthFt).toFixed(2)));
  const wellLengthFt = Math.max(0, Number((availableLengthFt - requiredLengthFt).toFixed(2)));

  // ---------- STEP 6: STATUS ----------
  let status: "OPTIMAL" | "COMPACT" | "CHECK REQUIRED" = "OPTIMAL";
  if (actualRiserInches > RISER_MAX_IN || actualRiserInches < RISER_MIN_IN) status = "CHECK REQUIRED";
  else if (actualRiserInches > 7 || actualRiserInches < 6.5) status = "COMPACT";

  return {
    floorToFloorHeight: floorToFloorHeightFt,
    targetRiserInches: preferredRiserIn,
    riserCount,
    actualRiserInches,
    treadInches,
    flightCount: 2,
    landingWidth: fw,
    staircaseWidth: fw,
    totalLengthNeeded: requiredLengthFt,
    status,
    staircaseType,
    requiredWidthFt,
    requiredLengthFt,
    flight1: { treads: treadsFlight1, riserCount: risersFlight1, lengthFt: flight1LengthFt },
    flight2: { treads: treadsFlight2, riserCount: risersFlight2, lengthFt: flight2LengthFt },
    landing1: { widthFt: fw, lengthFt: landingDepth },
    landing2: { widthFt: fw, lengthFt: landingDepth },
    middleTreads,
    wellSize: { widthFt: wellWidthFt, lengthFt: wellLengthFt },
    totalRiseInches: Number((riserCount * actualRiserInches).toFixed(2)),
    totalTreadDepthInches: (treadsFlight1 + treadsFlight2 + middleTreads + winderRisers) * treadInches,
    flightWidthFt: fw,
    winderRisers,
    middleRunFt,
  } as StaircaseFootprint;
}

/* =========================================================
   ZONE FIT — rise badhne par stair kahan badhegi?
   Priority (passage block na ho, isliye):
     1) DOG_LEGGED (balanced flights)                 -> sabse kam width
     2) 2_QUARTER_WINDER  (turn me 6 steps)           -> length 3 treads kam
     3) 2_QUARTER_LANDING  middle treads 1..4         -> Landing-1 aur Landing-2 ke BEECH me steps
        (length kam hoti hai, width badhti hai)
     4) L_SHAPED
   Landing-2 ke baad "upper side" me flight lamba NAHI kiya jaata,
   kyunki wahan roof/upper-floor connect hota hai aur min 4 ft passage
   free rehna chahiye (bedrooms ko jodne wala passage).
========================================================= */
export interface StaircaseFitOptions {
  /** Stair jis zone (living) me hai uski poori width */
  floorWidthFt: number;
  /** Zone ki length (run direction) */
  zoneLengthFt: number;
  /** Connecting passage minimum (default 4 ft) */
  minPassageFt?: number;
  minFlightWidthFt?: number; // default 2.5
  maxFlightWidthFt?: number; // default 3.0
  preferredRiserIn?: number; // default 7
  preferredTreadIn?: number; // default 11
  /** Sirf in types me se choose karo */
  allowedTypes?: StaircaseType[];
  /**
   * 'SIDE'        -> stair ke bagal ka passage >= minPassage (ground: living -> passage ka raasta)
   * 'SIDE_OR_END' -> side YA end me se koi ek >= minPassage (upper floor: bedrooms ko jodne wala passage)
   */
  passageMode?: "SIDE" | "SIDE_OR_END";
}

export interface StaircaseFitResult {
  spec: StaircaseFootprint;
  staircaseType: StaircaseType;
  fits: boolean;
  /** side passage = floorWidth - stairWidth ; end passage = zoneLength - stairLength */
  sidePassageFt: number;
  endPassageFt: number;
  passageOk: boolean;
  extension: "NONE" | "WINDER_TURN" | "MIDDLE_TREADS" | "L_SHAPE" | "FAILED";
  notes: string[];
}

export function fitStaircaseToZone(
  floorToFloorHeightFt: number,
  opts: StaircaseFitOptions,
): StaircaseFitResult {
  const minPassage = opts.minPassageFt ?? 4;
  const minFw = Math.max(FLIGHT_WIDTH_MIN_FT, opts.minFlightWidthFt ?? FLIGHT_WIDTH_MIN_FT);
  const maxFw = Math.min(FLIGHT_WIDTH_MAX_FT, opts.maxFlightWidthFt ?? FLIGHT_WIDTH_MAX_FT);
  const riserPref = opts.preferredRiserIn ?? 7;
  const treadPref = Math.min(TREAD_MAX_IN, opts.preferredTreadIn ?? TREAD_MAX_IN);
  const passageMode = opts.passageMode ?? "SIDE_OR_END";

  type Cand = { type: StaircaseType; mt?: number; ext: StaircaseFitResult["extension"]; pref: number };
  const baseCands: Cand[] = [
    { type: "DOG_LEGGED", ext: "NONE", pref: 0 },
    { type: "2_QUARTER_WINDER", ext: "WINDER_TURN", pref: 1 },
    { type: "2_QUARTER_LANDING", mt: 1, ext: "MIDDLE_TREADS", pref: 2 },
    { type: "2_QUARTER_LANDING", mt: 2, ext: "MIDDLE_TREADS", pref: 3 },
    { type: "2_QUARTER_LANDING", mt: 3, ext: "MIDDLE_TREADS", pref: 4 },
    { type: "2_QUARTER_LANDING", mt: 4, ext: "MIDDLE_TREADS", pref: 5 },
    { type: "L_SHAPED", ext: "L_SHAPE", pref: 6 },
  ];
  const cands = baseCands.filter(c => !opts.allowedTypes || opts.allowedTypes.includes(c.type));

  const fwList: number[] = [];
  for (let fw = maxFw; fw >= minFw - 0.001; fw -= 0.11) fwList.push(Number(fw.toFixed(2)));
  if (!fwList.includes(Number(minFw.toFixed(2)))) fwList.push(Number(minFw.toFixed(2)));

  // Tread options: pehle 11", fit na ho to 10.5 -> 9" tak kam karke length ghatao
  const treadList: number[] = [];
  for (let t = treadPref; t >= TREAD_MIN_IN - 0.001; t -= 0.5) treadList.push(Number(t.toFixed(1)));

  let best: { res: StaircaseFitResult; score: number } | null = null;

  for (const fw of fwList) {
    for (const tIn of treadList) for (const c of cands) {
      const spec = calculateStaircase(
        floorToFloorHeightFt, opts.floorWidthFt, opts.zoneLengthFt,
        c.type, riserPref, tIn, fw, c.mt,
      );

      const widthOk = spec.requiredWidthFt <= opts.floorWidthFt + 0.01;
      const lengthOk = spec.requiredLengthFt <= opts.zoneLengthFt + 0.01;
      const side = Number((opts.floorWidthFt - spec.requiredWidthFt).toFixed(2));
      const end = Number((opts.zoneLengthFt - spec.requiredLengthFt).toFixed(2));
      // Upper floor ko jodne wala passage: side ya end me se kisi ek taraf >= 4 ft
      const passageOk = side >= minPassage - 0.01 ||
        (passageMode === "SIDE_OR_END" && end >= minPassage - 0.01);
      const fits = widthOk && lengthOk;
      const valid = fits && passageOk;

      const overflow =
        Math.max(0, spec.requiredWidthFt - opts.floorWidthFt) +
        Math.max(0, spec.requiredLengthFt - opts.zoneLengthFt);
      const passageShort = passageOk ? 0 : minPassage - Math.max(side, end);

      // valid => chhota score. Pehle bada flight width (3 ft), phir type preference
      const treadPenalty = (treadPref - tIn) * 6;
      const score = valid
        ? (maxFw - fw) * 10 + treadPenalty + c.pref
        : 1000 + overflow * 100 + passageShort * 50 + (maxFw - fw) * 10 + treadPenalty + c.pref;

      const notes: string[] = [];
      if (valid && c.ext === "NONE") notes.push("Dog-legged fit — extension ki zaroorat nahi.");
      if (valid && c.ext === "WINDER_TURN") notes.push("Length kam karne ke liye winder turn use hua.");
      if (valid && c.ext === "MIDDLE_TREADS")
        notes.push(`Extra steps Landing-1 aur Landing-2 ke beech (${c.mt} middle treads) me daale.`);
      if (valid && fw < maxFw) notes.push(`Passage ${minPassage} ft rakhne ke liye flight width ${fw} ft kiya.`);
      if (valid && tIn < treadPref) notes.push(`Length kam karne ke liye tread ${tIn}" kiya (min ${TREAD_MIN_IN}").`);
      if (!fits) notes.push("Zone me stair fit nahi hoti.");
      if (fits && !passageOk)
        notes.push(`Connecting passage ${minPassage} ft se kam bachega (side ${side} ft, end ${end} ft).`);

      const res: StaircaseFitResult = {
        spec,
        staircaseType: c.type,
        fits,
        sidePassageFt: side,
        endPassageFt: end,
        passageOk,
        extension: valid ? c.ext : "FAILED",
        notes,
      };
      if (!best || score < best.score) best = { res, score };
    }
  }

  const out = best!.res;
  if (out.extension === "FAILED") {
    out.spec = { ...out.spec, status: "CHECK REQUIRED" } as StaircaseFootprint;
    out.notes.push("CHECK REQUIRED: floor height kam karo ya stair zone (living) badhao.");
  }
  return out;
}
/* =========================================================
   FLOOR-HEIGHT ADAPTER
   Upar ki floors / tower par stair ka SHAPE, TYPE, FLIGHT WIDTH, TREAD aur
   RISER-COUNT ground wali stair ke barabar rehta hai (footprint same).
   Sirf riser height = (us floor ki height / same riser count) dobara nikalti hai.
   Agar riser 6"–7.5" se bahar jaye to status CHECK REQUIRED.
========================================================= */
export function adaptStairToFloorHeight(
  base: StaircaseFootprint,
  floorToFloorHeightFt: number,
): StaircaseFootprint {
  const heightFt = Number.isFinite(floorToFloorHeightFt) && floorToFloorHeightFt > 0
    ? floorToFloorHeightFt
    : base.floorToFloorHeight;
  if (Math.abs(heightFt - base.floorToFloorHeight) < 0.01) return { ...base };

  const actualRiserInches = Number(((heightFt * 12) / base.riserCount).toFixed(2));
  let status: StaircaseFootprint["status"] = "OPTIMAL";
  if (actualRiserInches > RISER_MAX_IN || actualRiserInches < RISER_MIN_IN) status = "CHECK REQUIRED";
  else if (actualRiserInches > 7 || actualRiserInches < 6.5) status = "COMPACT";

  return {
    ...base,
    floorToFloorHeight: heightFt,
    actualRiserInches,
    totalRiseInches: Number((base.riserCount * actualRiserInches).toFixed(2)),
    status,
  } as StaircaseFootprint;
}