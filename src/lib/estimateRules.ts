// Single source of truth for the new-construction estimate business rules.
// Both the input form and the preview page MUST import from here so the
// thresholds can never drift apart again (input used 20%, preview used 15%).

// A larger change in customer name / property address than this is treated as a NEW estimate (new ref no + new payment)
export const NAME_ADDRESS_CHANGE_LIMIT = 15; // Percent

// An estimate older than this many days is treated as a NEW estimate (new ref no + new payment)
export const ESTIMATE_VALIDITY_DAYS = 60;

// True for a persisted reference number; false for temporary ones (REF-..., TEMP..., placeholders)
export const isRealRef = (r?: string | null) => !!r && !/^(REF-|TEMP)/i.test(r) && !r.includes("...");

// Percentage change between two strings (character level / Levenshtein, so RAMESH -> SURESH still counts as a change)
export const calculatePercentageChange = (str1: string, str2: string) => {
  const a = (str1 || "").trim().toLowerCase().replace(/\s+/g, " ");
  const b = (str2 || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!a && !b) return 0;
  if (!a || !b) return 100;
  let prev = Array.from({ length: b.length + 1 }, (_, k) => k);
  for (let x = 1; x <= a.length; x++) {
    const cur = [x];
    for (let y = 1; y <= b.length; y++) {
      cur[y] = Math.min(prev[y] + 1, cur[y - 1] + 1, prev[y - 1] + (a[x - 1] === b[y - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return (prev[b.length] / Math.max(a.length, b.length)) * 100;
};

// True when the customer name OR the property address changed by more than the allowed limit.
// An empty "old" value is ignored (nothing to compare against).
export const isNameAddressChangeMajor = (
  oldVal: { customer_name?: string | null; property_address?: string | null },
  newVal: { customer_name?: string | null; property_address?: string | null }
) => {
  const pct = (o: any, n: any) =>
    String(o || "").trim() ? calculatePercentageChange(String(o), String(n || "")) : 0;
  return (
    pct(oldVal.customer_name, newVal.customer_name) > NAME_ADDRESS_CHANGE_LIMIT ||
    pct(oldVal.property_address, newVal.property_address) > NAME_ADDRESS_CHANGE_LIMIT
  );
};

// True when the estimate was created more than ESTIMATE_VALIDITY_DAYS ago.
// A missing / unparsable date returns false (we cannot prove it is expired).
export const isEstimateExpired = (createdAt?: string | null) => {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > ESTIMATE_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
};
