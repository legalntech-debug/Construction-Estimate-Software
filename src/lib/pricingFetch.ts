// src/lib/pricingFetch.ts

import { supabase } from './supabase';
import { getItemRate } from './pricing';

export interface PricingRow {
  id: string;
  case_type: string;
  state_name: string;
  user_category: string | null;
  mrp: number;
  price: number;
  discount_enabled: boolean;
  discount_percent: number | null;
  active: boolean;
}

export interface PricingDisplay {
  mrp: number;
  price: number;
  discountEnabled: boolean;
  discountPercent: number;
  savings: number;
  isFromDB: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// 1. FETCH SINGLE PRICING ROW
// ═══════════════════════════════════════════════════════════════════

export async function fetchPricingRow(
  caseType: string,
  stateName: string,
  userCategory?: string
): Promise<PricingRow | null> {
  try {
    const stateUpper = (stateName || '').toUpperCase().trim();
    const catUpper = (userCategory || '').toUpperCase().trim();

    const { data, error } = await supabase
      .from('pricing_config')
      .select('*')
      .eq('case_type', caseType)
      .eq('active', true);

    if (error || !data || data.length === 0) {
      console.warn(`[fetchPricingRow] No rows for ${caseType} × ${stateName}`);
      return null;
    }

    const rows = data as PricingRow[];

    if (catUpper) {
      const exact = rows.find(
        (r) =>
          r.state_name?.toUpperCase() === stateUpper &&
          r.user_category?.toUpperCase() === catUpper
      );
      if (exact) return exact;
    }

    const stateOnly = rows.find(
      (r) =>
        r.state_name?.toUpperCase() === stateUpper && !r.user_category
    );
    if (stateOnly) return stateOnly;

    const defaultRow = rows.find(
      (r) => r.state_name?.toUpperCase() === 'DEFAULT'
    );
    if (defaultRow) return defaultRow;

    return null;
  } catch (err) {
    console.error('[fetchPricingRow] Error:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. FETCH ALL SERVICES FOR A STATE
// ═══════════════════════════════════════════════════════════════════

export async function fetchStatePricing(
  stateName: string,
  userCategory?: string
): Promise<Record<string, PricingRow>> {
  try {
    const { data, error } = await supabase
      .from('pricing_config')
      .select('*')
      .eq('active', true);

    if (error || !data) {
      console.warn('[fetchStatePricing] DB error, using fallback');
      return {};
    }

    const stateUpper = (stateName || '').toUpperCase().trim();
    const catUpper = (userCategory || '').toUpperCase().trim();

    const rows = data as PricingRow[];

    const caseTypes: string[] = Array.from(
      new Set(rows.map((r) => String(r.case_type)))
    );

    const result: Record<string, PricingRow> = {};

    for (const ct of caseTypes) {
      const candidates = rows.filter((r) => String(r.case_type) === ct);

      const pick: PricingRow | null =
        (catUpper &&
          candidates.find(
            (r) =>
              r.state_name?.toUpperCase() === stateUpper &&
              r.user_category?.toUpperCase() === catUpper
          )) ||
        candidates.find(
          (r) =>
            r.state_name?.toUpperCase() === stateUpper && !r.user_category
        ) ||
        candidates.find(
          (r) => r.state_name?.toUpperCase() === 'DEFAULT'
        ) ||
        null;

      if (pick) {
        result[String(ct)] = pick;
      }
    }

    return result;
  } catch (err) {
    console.error('[fetchStatePricing] Error:', err);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. GET DISPLAY PRICING
// ═══════════════════════════════════════════════════════════════════

export function getDisplayPricing(row: PricingRow | null): PricingDisplay {
  if (!row) {
    return {
      mrp: 0,
      price: 0,
      discountEnabled: false,
      discountPercent: 0,
      savings: 0,
      isFromDB: false,
    };
  }

  const mrp = Number(row.mrp) || 0;
  const price = Number(row.price) || 0;
  const discountEnabled = Boolean(row.discount_enabled);

  let discountPercent = 0;
  if (discountEnabled && mrp > price && mrp > 0) {
    discountPercent =
      row.discount_percent != null
        ? Number(row.discount_percent)
        : Math.round(((mrp - price) / mrp) * 100);
  }

  return {
    mrp,
    price,
    discountEnabled,
    discountPercent,
    savings: Math.max(0, mrp - price),
    isFromDB: true,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 4. FORMAT PRICE
// ═══════════════════════════════════════════════════════════════════

export function formatPrice(value: number): string {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString('en-IN')}`;
}

// ═══════════════════════════════════════════════════════════════════
// 5. GET EFFECTIVE PRICE
// ═══════════════════════════════════════════════════════════════════

export function getEffectivePrice(
  row: PricingRow | null,
  caseType: string,
  stateName: string
): number {
  if (row) return Number(row.price) || 0;
  return getItemRate(stateName, caseType);
}

// ═══════════════════════════════════════════════════════════════════
// 6. FALLBACK PRICING
// ═══════════════════════════════════════════════════════════════════

export function getFallbackPricing(
  caseType: string,
  stateName: string
): PricingDisplay {
  const basePrice = getItemRate(stateName, caseType);
  const discountPercent = caseType === 'map' ? 30 : 70;
  const mrp = basePrice;
  const price = mrp * (1 - discountPercent / 100);

  return {
    mrp,
    price: Math.round(price * 100) / 100,
    discountEnabled: true,
    discountPercent,
    savings: mrp - price,
    isFromDB: false,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 7. NORMALIZE CASE TYPE
// ═══════════════════════════════════════════════════════════════════

export function normalizeCaseType(itemName: string): string {
  if (!itemName) return 'estimate';
  if (itemName === 'routeMap') return 'locationPlan';
  return itemName;
}