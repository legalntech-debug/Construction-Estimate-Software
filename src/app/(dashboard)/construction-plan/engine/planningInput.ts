/** Canonical input helpers used by the master planning engine. */
export function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function cleanFloorName(value: unknown): string {
  return String(value || 'GROUND FLOOR').trim().toUpperCase();
}

export function cleanPlanningMode(value: unknown): string {
  return String(value || 'AUTO').trim().toUpperCase();
}
