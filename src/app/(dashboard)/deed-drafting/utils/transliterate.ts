// src/app/(dashboard)/deed-drafting/utils/transliterate.ts

const LANG_CODE_MAP: Record<string, string> = {
  HINDI: "hi",
  MARATHI: "mr",
  GUJARATI: "gu",
  ENGLISH: "", // English me convert nahi karna
};

// ✅ In-memory cache (same word dobara instant, network save)
const transliterationCache = new Map<string, string>();

// ✅ Quick dictionary for common legal words (instant, offline)
const QUICK_DICT: Record<string, Record<string, string>> = {
  hi: {
    shri: "श्री",
    shree: "श्री",
    smt: "श्रीमती",
    shrimati: "श्रीमती",
    son: "पुत्र",
    "s/o": "पुत्र श्री",
    "w/o": "पत्नी श्री",
    "d/o": "पुत्री श्री",
    "r/o": "निवासी",
    village: "ग्राम",
    tehsil: "तहसील",
    district: "जिला",
    nagar: "नगर",
    colony: "कॉलोनी",
    sector: "सेक्टर",
    road: "रोड",
    marg: "मार्ग",
  },
  mr: {
    shri: "श्री",
    smt: "श्रीमती",
    "r/o": "राहणार",
    village: "गाव",
  },
  gu: {
    shri: "શ્રી",
    smt: "શ્રીમતી",
  },
};

/**
 * English text ko selected Indian language me transliterate karta hai
 * Google Input Tools API use karta hai (FREE, no API key needed)
 */
export async function transliterateText(
  text: string,
  outputLanguage: string
): Promise<string> {
  if (!text || !text.trim()) return text;

  const langCode = LANG_CODE_MAP[outputLanguage?.toUpperCase()];
  if (!langCode) return text;

  // Already Devanagari/Gujarati chars hain to skip
  if (/[\u0900-\u097F\u0A80-\u0AFF]/.test(text)) return text;

  // ✅ All-caps word ko lowercase karo (API caps nahi samajhta)
  const isAllCaps = text === text.toUpperCase() && /[A-Z]/.test(text);
  const queryText = isAllCaps ? text.toLowerCase() : text;

  const lowerText = queryText.toLowerCase().trim();

  // ✅ 1. Quick dictionary check (fastest — instant, no network)
  const dictHit = QUICK_DICT[langCode]?.[lowerText];
  if (dictHit) {
    return dictHit;
  }

  // ✅ 2. Cache check (fast — same word dobara instant)
  const cacheKey = `${langCode}:${lowerText}`;
  if (transliterationCache.has(cacheKey)) {
    return transliterationCache.get(cacheKey)!;
  }

  // ✅ 3. API call (network + Google response)
  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(
      queryText
    )}&itc=${langCode}-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;

    const res = await fetch(url);
    const data = await res.json();

    if (
      data &&
      data[0] === "SUCCESS" &&
      data[1] &&
      data[1][0] &&
      data[1][0][1] &&
      data[1][0][1][0]
    ) {
      const result = data[1][0][1][0];
      // ✅ Cache me save karo future ke liye
      transliterationCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.error("Transliteration error:", err);
  }

  return text;
}

export function isIndianLang(lang: string): boolean {
  const l = (lang || "").toUpperCase();
  return l === "HINDI" || l === "MARATHI" || l === "GUJARATI";
}

/**
 * ✅ Cache clear karo (optional — logout pe ya debug ke liye)
 */
export function clearTransliterationCache(): void {
  transliterationCache.clear();
}