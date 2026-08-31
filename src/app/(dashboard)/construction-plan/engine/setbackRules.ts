import { CoverageType, SetbackRuleset, SetbackValues } from "./planningTypes";

export const EMPTY_SETBACKS: SetbackValues = { front: 0, rear: 0, left: 0, right: 0 };

export function normalizeSetbacks(input?: Partial<SetbackValues>): SetbackValues {
  return {
    front: Math.max(0, Number(input?.front) || 0),
    rear: Math.max(0, Number(input?.rear) || 0),
    left: Math.max(0, Number(input?.left) || 0),
    right: Math.max(0, Number(input?.right) || 0),
  };
}

/**
 * Returns a neutral ruleset when no local authority rules have been supplied.
 * We deliberately do not pretend that one universal Indian setback table is
 * legally applicable everywhere.
 */
export function calculateSetbacks(
  plotArea: number,
  roadWidthFeet = 20,
  isCornerPlot = false,
  userSetbacks?: Partial<SetbackValues>,
  coverageType: CoverageType | string = "AS_PER_NORMS",
  coveragePercentage?: number
): SetbackRuleset {
  const explicit = normalizeSetbacks(userSetbacks);
  const hasExplicit = Object.values(explicit).some((value) => value > 0);

  let maxCoveragePercentage = coverageType === "100_PERCENT"
    ? 100
    : Number(coveragePercentage) || 100;

  if (coverageType === "AS_PER_NORMS" && !hasExplicit) {
    // No legal default is assumed. The UI must ask for the applicable rule
    // or user-entered MOS before using this as a statutory calculation.
    maxCoveragePercentage = 100;
  }

  return {
    frontSetback: explicit.front,
    rearSetback: explicit.rear,
    leftSetback: explicit.left,
    rightSetback: explicit.right,
    maxCoveragePercentage: Math.min(100, Math.max(0, maxCoveragePercentage)),
    maxBuildingHeight: 0,
    source: hasExplicit ? "USER_INPUT" : "DEFAULT_UNSPECIFIED",
  };
}

export function getSetbackValues(rules: SetbackRuleset): SetbackValues {
  return {
    front: Math.max(0, rules.frontSetback),
    rear: Math.max(0, rules.rearSetback),
    left: Math.max(0, rules.leftSetback),
    right: Math.max(0, rules.rightSetback),
  };
}
