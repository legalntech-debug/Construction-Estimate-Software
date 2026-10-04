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
  /** Variable tread: start/end ke treads chhote (>= 9"), beech ke bade (<= 11"). Total run uniform tread jitna hi. */
  treadProfile?: { flight1: number[]; flight2: number[]; uniformTreadIn: number; note: string };
  /** Middle treads (Landing-1 -> Landing-2) ki har tread ki depth (inch). solveStairDrawPlan se aata hai */
  middleTreadsIn?: number[];
  /** Final rect me exact-fit draw plan. Renderer ko SIRF isse draw karna hai (apna tread/landing calculation nahi) */
  drawPlan?: StairDrawPlan;
}

/**
 * Stair ka exact draw plan (stair ke apne frame me, ft/inch).
 * Frame: x = cross axis (flights ki chaudai wali direction), y = run axis. Entry y=run (neeche), far end y=0 (upar).
 * Far end par Landing-1 (x=0) aur Landing-2 (x=cross-fw); dono ke beech MIDDLE treads cross axis par chalte hain.
 * Rotated stair me renderer isi frame ko 90deg ghumata hai (entry LEFT/RIGHT).
 */
export interface StairDrawPlan {
  usedCrossFt: number;
  usedRunFt: number;
  flightWidthFt: number;
  landingFt: number;
  flight1: { treads: number; depthsIn: number[]; runFt: number };
  flight2: { treads: number; depthsIn: number[]; runFt: number };
  middle: { treads: number; depthsIn: number[]; runFt: number };
  totalTreads: number;
  riserCount: number;
  /** Rect me jitne treads draw NAHI ho paye (0 hona chahiye). Renderer apna "SHORT n TREAD" na nikale, ye use kare */
  shortTreads: number;
  /** Flights me jagah nahi thi, isliye itne treads middle me shift hue */
  movedToMiddle: number;
  notes: string[];
}

/**
 * TREAD PROFILE - total run same rakhte hue comfort badhao.
 * Jab tread 11" se kam karna pade (passage bachane ke liye), sab treads barabar chhote karne ke bajay
 * pehle/aakhri 2-2 treads 9" (min) karo aur beech ke treads bade (max 11"). Total run (n * uniform) same rehta hai.
 */
export function buildTreadProfile(treadCount: number, uniformTreadIn: number, endCount = 2): number[] {
  const n = Math.max(0, Math.round(treadCount));
  if (n === 0) return [];
  const uni = Number(uniformTreadIn.toFixed(2));
  const e = Math.min(endCount, Math.floor(n / 2));
  const m = n - 2 * e;
  if (uniformTreadIn >= TREAD_MAX_IN - 0.01 || e < 1 || m < 1) return Array(n).fill(uni);
  const total = n * uniformTreadIn;
  let endIn = TREAD_MIN_IN;
  let midIn = (total - 2 * e * endIn) / m;
  if (midIn > TREAD_MAX_IN) {            // beech 11" se upar nahi -> ends thode bade
    midIn = TREAD_MAX_IN;
    endIn = (total - m * midIn) / (2 * e);
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Number(((i < e || i >= n - e) ? endIn : midIn).toFixed(2)));
  return out;
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

  // ============================================================
  // ✅ RETURN
  // ============================================================
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
    treadProfile: treadInches < TREAD_MAX_IN - 0.01
      ? {
          flight1: buildTreadProfile(treadsFlight1, treadInches),
          flight2: buildTreadProfile(treadsFlight2, treadInches),
          uniformTreadIn: treadInches,
          note: 'Start/end treads chhote, beech ke bade - total run uniform tread jitna (passage same bachta hai).',
        }
      : undefined,
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
  /**
   * Stair ke SAMNE (end) common passage ka target (zoneLength - stairLength). Isse kam bacha to planner treads ko
   * (min 9" tak, start/end pehle) chhota karke stair ki length ghatata hai - sirf utna jitna zaroori ho.
   */
  endPassageTargetFt?: number;
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
  for (let t = treadPref; t >= TREAD_MIN_IN - 0.001; t -= 0.25) treadList.push(Number(t.toFixed(2)));

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
      // end passage target se kam bacha to length ghatao (tread chhota): 1 ft kami = 40 pts, 1" tread = 6 pts
      const endShort = opts.endPassageTargetFt ? Math.max(0, opts.endPassageTargetFt - Math.max(0, end)) : 0;
      const score = valid
        ? (maxFw - fw) * 10 + treadPenalty + c.pref + endShort * 40
        : 1000 + overflow * 100 + passageShort * 50 + (maxFw - fw) * 10 + treadPenalty + c.pref;

      const notes: string[] = [];
      if (valid && c.ext === "NONE") notes.push("Dog-legged fit — extension ki zaroorat nahi.");
      if (valid && c.ext === "WINDER_TURN") notes.push("Length kam karne ke liye winder turn use hua.");
      if (valid && c.ext === "MIDDLE_TREADS")
        notes.push(`Extra steps Landing-1 aur Landing-2 ke beech (${c.mt} middle treads) me daale.`);
      if (valid && fw < maxFw) notes.push(`Passage ${minPassage} ft rakhne ke liye flight width ${fw} ft kiya.`);
      if (valid && tIn < treadPref) notes.push(`Length kam karne ke liye avg tread ${tIn}" kiya: start/end treads ~${TREAD_MIN_IN}", beech ke bade (tread profile).`);
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

/* =========================================================
   2D ENGINEERING DRAWING HINTS (renderer ke liye)
   Plan view convention:
     - Flight jo is floor se UPAR ja rahi hai  -> solid (cut line ke saath, UP arrow)
     - Flight jo NEECHE wali floor se is level par aa rahi hai -> slab ke neeche hai, isliye HIDDEN (dashed) line
     - Tower / mumty: stair yahan terminate hoti hai (headroom) -> neeche se aane wali flights dashed, arrow DN,
       aur "stair upar ki floor se yahan connect ho rahi hai" dikhane ke liye break line
   Renderer in flags ko padhe; planner sirf data deta hai.
========================================================= */
export type StairDrawingRole = "GROUND" | "UPPER" | "TOWER";

export interface StairDrawingHints {
  role: StairDrawingRole;
  /** Arrow direction: GROUND/UPPER -> "UP", TOWER -> "DN" (neeche jaane ka) */
  arrow: "UP" | "DN";
  /** Is level se upar jaati flights solid draw hoti hain */
  departingFlightsSolid: boolean;
  /** Neeche wali floor se aati flights is level par slab ke neeche hain -> hidden (dashed) line */
  arrivingFlightsHidden: boolean;
  hiddenLineStyle: "DASHED";
  /** 1.2 m cut plane / break line stair par dikhao */
  breakLine: boolean;
  /** stair kahan connect hoti hai */
  continuesTo: "NEXT_LEVEL" | "NONE";
  /** Top landing / headroom par stair terminate hoti hai (tower) */
  terminatesAtLanding: boolean;
  note: string;
}

export function getStairDrawingHints(role: StairDrawingRole): StairDrawingHints {
  switch (role) {
    case "TOWER":
      return {
        role, arrow: "DN",
        departingFlightsSolid: false,
        arrivingFlightsHidden: true,
        hiddenLineStyle: "DASHED",
        breakLine: true,
        continuesTo: "NONE",
        terminatesAtLanding: true,
        note: "Tower: neeche ki floor se aati stair dashed (hidden) + break line; headroom landing par terminate.",
      };
    case "UPPER":
      return {
        role, arrow: "UP",
        departingFlightsSolid: true,
        arrivingFlightsHidden: true,
        hiddenLineStyle: "DASHED",
        breakLine: true,
        continuesTo: "NEXT_LEVEL",
        terminatesAtLanding: false,
        note: "Upper floor: upar jaati flight solid, neeche se aati flight hidden (dashed).",
      };
    case "GROUND":
    default:
      return {
        role: "GROUND", arrow: "UP",
        departingFlightsSolid: true,
        arrivingFlightsHidden: false,
        hiddenLineStyle: "DASHED",
        breakLine: true,
        continuesTo: "NEXT_LEVEL",
        terminatesAtLanding: false,
        note: "Ground: stair upar ki floor ko jaati hai (UP arrow + cut line).",
      };
  }
}

/* =========================================================
   EXACT-FIT DRAW PLAN  (hardcode nahi - rect + riser count se nikalta hai)

   Problem: spec "N treads" bolta tha, par rect ke start (Landing-1 wali patti) aur end (Landing-2 wali patti)
   me flights ki run utni nahi hoti thi -> renderer "SHORT n TREAD" dikhata tha, aur ground / upper alag aate the.

   Rule:
     1) Riser COUNT fixed (floor height se) - kabhi change nahi hota.
     2) Flights ko rect ki run me min tread (9") tak chhota karke fit karo.
     3) Phir bhi na aaye -> extra treads MIDDLE (Landing-1 <-> Landing-2) me shift karo (middle treads badhao).
        Middle ki cross-width = rect.cross - 2*flightWidth, tread depth 9"-11".
     4) Jo footprint actual me cover hota hai (usedCross x usedRun) wahi return hota hai -> wahi draw ho.
   Total treads (landing type) = riserCount - 3  (middle kitne bhi ho), dog-legged = riserCount - 2.
========================================================= */
function splitRisers(type: StaircaseType, R: number, mt: number) {
  const middleRisers = type === "2_QUARTER_LANDING" ? mt + 1 : 0;
  const remaining = Math.max(2, R - middleRisers);
  const r1 = Math.ceil(remaining / 2);
  const r2 = remaining - r1;
  return { r1, r2, t1: Math.max(1, r1 - 1), t2: Math.max(1, r2 - 1) };
}

export function solveStairDrawPlan(
  base: StaircaseFootprint,
  rectCrossFt: number,
  rectRunFt: number,
): { spec: StaircaseFootprint; plan: StairDrawPlan } {
  const R = base.riserCount;
  const types: Array<{ type: StaircaseType; mt: number }> = [{ type: "DOG_LEGGED", mt: 0 }];
  for (let mt = 1; mt <= 8; mt++) types.push({ type: "2_QUARTER_LANDING", mt });

  // Winder / L-shape ka geometry alag hai -> sirf plan report karo (shortTreads), type mat badlo
  const keepAsIs = base.staircaseType === "L_SHAPED" || base.staircaseType === "2_QUARTER_WINDER";

  let best: { score: number; type: StaircaseType; mt: number; fw: number; df: number; dm: number; sp: ReturnType<typeof splitRisers> } | null = null;

  if (!keepAsIs) {
    for (let fw = Math.min(FLIGHT_WIDTH_MAX_FT, base.flightWidthFt || FLIGHT_WIDTH_MAX_FT); fw >= FLIGHT_WIDTH_MIN_FT - 0.001; fw -= 0.11) {
      const flightW = Number(fw.toFixed(2));
      for (const c of types) {
        const sp = splitRisers(c.type, R, c.mt);
        const tMax = Math.max(sp.t1, sp.t2);
        const runAvail = rectRunFt - flightW;                  // flight run = rect run - landing
        if (runAvail <= 0) continue;
        const df = Math.min(TREAD_MAX_IN, (runAvail * 12) / tMax);   // flights rect ko poora bharte hain
        if (df < TREAD_MIN_IN - 0.001) continue;
        let dm = 0;
        if (c.mt >= 1) {
          const crossAvail = rectCrossFt - 2 * flightW;
          if (crossAvail <= 0) continue;
          dm = Math.min(TREAD_MAX_IN, (crossAvail * 12) / c.mt);
          if (dm < TREAD_MIN_IN - 0.001) continue;
        } else if (rectCrossFt < 2 * flightW + STAIR_GAP_FT - 0.001) continue;
        // comfort: bada flight width, bade treads (11" ke paas), kam middle treads
        const score = (FLIGHT_WIDTH_MAX_FT - flightW) * 10 + (TREAD_MAX_IN - df) * 6 + (c.mt ? (TREAD_MAX_IN - dm) * 3 : 0) + c.mt * 0.5;
        if (!best || score < best.score) best = { score, type: c.type, mt: c.mt, fw: flightW, df, dm, sp };
      }
    }
  }

  // ---- koi exact fit nahi: base spec ke hisaab se kitne treads short hain wo honestly report karo ----
  if (!best) {
    const fw = base.flightWidthFt;
    const cap = Math.max(0, Math.floor(((rectRunFt - fw) * 12) / TREAD_MIN_IN));
    const baseFits = base.requiredWidthFt <= rectCrossFt + 0.01 && base.requiredLengthFt <= rectRunFt + 0.01;
    const short = (keepAsIs && baseFits) ? 0 : Math.max(0, base.flight1.treads - cap) + Math.max(0, base.flight2.treads - cap);
    const plan: StairDrawPlan = {
      usedCrossFt: Math.min(rectCrossFt, base.requiredWidthFt), usedRunFt: Math.min(rectRunFt, base.requiredLengthFt),
      flightWidthFt: fw, landingFt: fw,
      flight1: { treads: base.flight1.treads, depthsIn: base.treadProfile?.flight1 ?? Array(base.flight1.treads).fill(base.treadInches), runFt: base.flight1.lengthFt },
      flight2: { treads: base.flight2.treads, depthsIn: base.treadProfile?.flight2 ?? Array(base.flight2.treads).fill(base.treadInches), runFt: base.flight2.lengthFt },
      middle: { treads: base.middleTreads, depthsIn: Array(base.middleTreads).fill(base.treadInches), runFt: base.middleRunFt },
      totalTreads: base.flight1.treads + base.flight2.treads + base.middleTreads + base.winderRisers,
      riserCount: R, shortTreads: short, movedToMiddle: 0,
      notes: [short > 0
        ? `Rect (${rectCrossFt.toFixed(2)} x ${rectRunFt.toFixed(2)} ft) me ${short} tread draw nahi ho sakte - rect badhao ya floor height check karo.`
        : "Base spec rect me draw ho jaata hai."],
    };
    return { spec: { ...base, drawPlan: plan }, plan };
  }

  const { type, mt, fw, df, dm, sp } = best;
  const flightDepths = (t: number) => buildTreadProfile(t, df);      // start/end chhote, beech bade, total run = t*df
  const f1 = flightDepths(sp.t1), f2 = flightDepths(sp.t2);
  const mid = Array(mt).fill(Number(dm.toFixed(2)));
  const runOf = (a: number[]) => Number((a.reduce((x, y) => x + y, 0) / 12).toFixed(2));
  const f1Run = runOf(f1), f2Run = runOf(f2), midRun = runOf(mid);
  const usedRun = Number((Math.max(f1Run, f2Run) + fw).toFixed(2));
  const usedCross = Number((type === "2_QUARTER_LANDING" ? 2 * fw + midRun : 2 * fw + STAIR_GAP_FT).toFixed(2));
  const movedToMiddle = Math.max(0, mt - (base.staircaseType === "2_QUARTER_LANDING" ? base.middleTreads : 0));

  const plan: StairDrawPlan = {
    usedCrossFt: usedCross, usedRunFt: usedRun, flightWidthFt: fw, landingFt: fw,
    flight1: { treads: sp.t1, depthsIn: f1, runFt: f1Run },
    flight2: { treads: sp.t2, depthsIn: f2, runFt: f2Run },
    middle: { treads: mt, depthsIn: mid, runFt: midRun },
    totalTreads: sp.t1 + sp.t2 + mt, riserCount: R, shortTreads: 0, movedToMiddle,
    notes: [
      `${type}${mt ? ` (${mt} middle treads)` : ""} | flights ${sp.t1}+${sp.t2} treads @ avg ${df.toFixed(2)}"` +
      (mt ? `, middle ${mt} @ ${dm.toFixed(2)}"` : "") + ` | footprint ${usedCross} x ${usedRun} ft`,
      ...(movedToMiddle > 0 ? [`Start/end patti me jagah kam thi -> ${movedToMiddle} extra tread middle me shift hue.`] : []),
    ],
  };

  const spec: StaircaseFootprint = {
    ...base,
    staircaseType: type,
    flightWidthFt: fw, staircaseWidth: fw, landingWidth: fw,
    treadInches: Number(df.toFixed(2)),
    flight1: { treads: sp.t1, riserCount: sp.r1, lengthFt: f1Run },
    flight2: { treads: sp.t2, riserCount: sp.r2, lengthFt: f2Run },
    landing1: { widthFt: fw, lengthFt: fw }, landing2: { widthFt: fw, lengthFt: fw },
    middleTreads: mt, middleRunFt: midRun, middleTreadsIn: mid, winderRisers: 0,
    requiredWidthFt: usedCross, requiredLengthFt: usedRun, totalLengthNeeded: usedRun,
    wellSize: { widthFt: Math.max(0, Number((rectCrossFt - usedCross).toFixed(2))), lengthFt: Math.max(0, Number((rectRunFt - usedRun).toFixed(2))) },
    totalTreadDepthInches: [...f1, ...f2, ...mid].reduce((a, b) => a + b, 0),
    treadProfile: { flight1: f1, flight2: f2, uniformTreadIn: Number(df.toFixed(2)), note: "Exact-fit: rect ke hisaab se dynamic (solveStairDrawPlan)." },
    drawPlan: plan,
  } as StaircaseFootprint;
  return { spec, plan };
}