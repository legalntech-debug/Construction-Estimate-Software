// src/lib/stringSimilarity.ts
// ═══════════════════════════════════════════════════════════════════
// Similarity Check Helper
// Business Rules:
//   - Minor changes (spelling, salutation, state) → Allowed
//   - Meaningful changes (name, colony, city, plot no.) → Re-payment
// ═══════════════════════════════════════════════════════════════════

// Words jo ignore karne hain (spelling/salutation/state)
const IGNORABLE_WORDS = new Set([
  'MR', 'MRS', 'MS', 'SHRI', 'SMT', 'DR', 'M/S',
  'M.P.', 'MP', 'INDIA', 'IN', 'MADHYA', 'PRADESH',
  'THE', 'AND', '&', 'A', 'AN', 'OF',
]);

// Words jo change hote hi re-payment trigger karenge
const CRITICAL_KEYWORDS = [
  'NAGAR', 'COLONY', 'SOCIETY', 'APARTMENT', 'BUILDING',
  'PLOT', 'SCHEME', 'PHASE', 'SECTOR', 'BLOCK',
  'VILLAGE', 'TOWN', 'CITY', 'DISTRICT',
];

function normalize(str: string): string {
  return (str || '')
    .toUpperCase()
    .replace(/[^\w\s,]/g, '')  // Special chars hatao (except comma)
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(str: string): string[] {
  return normalize(str).split(/[\s,]+/).filter((w) => w.length > 0);
}

/**
 * Calculate Levenshtein distance
 */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Basic character similarity (0-100)
 */
export function calculateSimilarity(oldStr: string, newStr: string): number {
  const a = normalize(oldStr);
  const b = normalize(newStr);
  if (!a && !b) return 100;
  if (!a || !b) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshtein(a, b);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

/**
 * Check if changes are minor (spelling/salutation only)
 * Returns: { hasMajorChange: boolean; reason: string }
 */
function detectMajorChange(oldStr: string, newStr: string): {
  hasMajorChange: boolean;
  reason: string;
} {
  const oldTokens = tokenize(oldStr);
  const newTokens = tokenize(newStr);

  // Remove ignorable words
  const oldFiltered = oldTokens.filter((t) => !IGNORABLE_WORDS.has(t));
  const newFiltered = newTokens.filter((t) => !IGNORABLE_WORDS.has(t));

  // Check critical keywords
  for (const keyword of CRITICAL_KEYWORDS) {
    const oldHas = oldFiltered.includes(keyword);
    const newHas = newFiltered.includes(keyword);
    if (oldHas !== newHas) {
      return {
        hasMajorChange: true,
        reason: `Critical keyword "${keyword}" ${oldHas ? 'removed' : 'added'}`,
      };
    }
  }

  // Check if new critical word appeared (like MEGHDOOT → BAJRANG after NAGAR)
  // Agar same position pe different non-ignorable word
  if (oldFiltered.length === newFiltered.length) {
    for (let i = 0; i < oldFiltered.length; i++) {
      const oldW = oldFiltered[i];
      const newW = newFiltered[i];
      if (oldW === newW) continue;

      // Check similarity of these two words
      const wordSim = calculateSimilarity(oldW, newW);
      // Agar 2 words bilkul different hain (similarity < 40%)
      if (wordSim < 40) {
        return {
          hasMajorChange: true,
          reason: `Word "${oldW}" changed to "${newW}"`,
        };
      }
    }
  }

  return { hasMajorChange: false, reason: '' };
}

/**
 * Main check function
 */
export function checkChangesNeedRepayment(
  oldName: string,
  newName: string,
  oldAddress: string,
  newAddress: string
): {
  nameScore: number;
  addressScore: number;
  combinedScore: number;
  nameMajorChange: boolean;
  addressMajorChange: boolean;
  needsRepayment: boolean;
  reason: string;
} {
  const nameScore = calculateSimilarity(oldName, newName);
  const addressScore = calculateSimilarity(oldAddress, newAddress);

  const nameChange = detectMajorChange(oldName, newName);
  const addressChange = detectMajorChange(oldAddress, newAddress);

  const combinedScore = Math.round((nameScore + addressScore) / 2);

  let needsRepayment = false;
  let reason = '';

  if (nameChange.hasMajorChange) {
    needsRepayment = true;
    reason = `Customer name changed: ${nameChange.reason}`;
  } else if (addressChange.hasMajorChange) {
    needsRepayment = true;
    reason = `Property address changed: ${addressChange.reason}`;
  } else if (combinedScore < 60) {
    // Fallback: agar overall score bahut kam hai
    needsRepayment = true;
    reason = `Overall similarity too low (${combinedScore}%)`;
  }

  return {
    nameScore,
    addressScore,
    combinedScore,
    nameMajorChange: nameChange.hasMajorChange,
    addressMajorChange: addressChange.hasMajorChange,
    needsRepayment,
    reason,
  };
}

/**
 * 60-day validity check
 */
export function isRefNoExpired(
  createdAt: string | Date,
  validityDays: number = 60
): boolean {
  if (!createdAt) return true;
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > validityDays;
}

/**
 * Days remaining
 */
export function daysUntilExpiry(
  createdAt: string | Date,
  validityDays: number = 60
): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, validityDays - diffDays);
}