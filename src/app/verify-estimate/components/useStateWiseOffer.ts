'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type OfferSource = 'REF' | 'BROWSER' | 'IP' | 'GENERAL';

export interface OfferData {
  state_name: string;
  estimate_mrp: number;
  estimate_price: number;
  drafting_mrp: number;
  drafting_price: number;
  map_mrp: number;      // ✅ NEW
  map_price: number;    // ✅ NEW
  discount_enabled: boolean;
  total_price: number;
  total_mrp: number;
  discount_percent: number;
  source: OfferSource;
}

/* ============================================================
   Build offer from pricing rows — Estimate + Drafting + Map
   ============================================================ */
function buildOfferFromPricing(
  pricingRows: any[],
  stateName: string,
  source: OfferSource
): OfferData | null {
  if (!pricingRows || pricingRows.length === 0) return null;

  // ✅ Estimate row
  const estimateRow = pricingRows.find(
    (r: any) => r.case_type?.toUpperCase() === 'ESTIMATE'
  );

  // ✅ Drafting row (exclude map)
  const draftingRow = pricingRows.find((r: any) => {
    const ct = (r.case_type || '').toUpperCase();
    return (
      ct.includes('DRAFT') ||
      ct.includes('DEED') ||
      ct === 'DRAFTING'
    );
  });

  // ✅ Map row (separate)
  const mapRow = pricingRows.find((r: any) => {
    const ct = (r.case_type || '').toUpperCase();
    return (
      ct.includes('MAP') ||
      ct.includes('LOCATION') ||
      ct.includes('CERTIFICATE')
    );
  });

  // At least estimate must exist
  if (!estimateRow) return null;

  const estimateMrp = Number(estimateRow?.mrp || 0);
  const estimatePrice = Number(estimateRow?.price || 0);
  const draftingMrp = Number(draftingRow?.mrp || 0);
  const draftingPrice = Number(draftingRow?.price || 0);
  const mapMrp = Number(mapRow?.mrp || 0);
  const mapPrice = Number(mapRow?.price || 0);

  // Check if any discount is enabled
  const hasDiscount =
    (estimateRow?.discount_enabled ?? false) ||
    (draftingRow?.discount_enabled ?? false) ||
    (mapRow?.discount_enabled ?? false);

  if (!hasDiscount) return null;

  const totalMrp = estimateMrp + draftingMrp + mapMrp;
  const totalPrice = estimatePrice + draftingPrice + mapPrice;
  const discountPercent =
    totalMrp > 0 ? Math.round(((totalMrp - totalPrice) / totalMrp) * 100) : 0;

  return {
    state_name: stateName,
    estimate_mrp: estimateMrp,
    estimate_price: estimatePrice,
    drafting_mrp: draftingMrp,
    drafting_price: draftingPrice,
    map_mrp: mapMrp,
    map_price: mapPrice,
    discount_enabled: true,
    total_price: totalPrice,
    total_mrp: totalMrp,
    discount_percent: discountPercent,
    source,
  };
}

/* ============================================================
   Fetch pricing for a state (exact + case-insensitive + wildcards)
   ============================================================ */
async function fetchPricingForState(stateName: string) {
  console.info('🔍 Fetching pricing for state:', stateName);

  // Try 1: Exact match
  let { data: exact } = await supabase
    .from('pricing_config')
    .select('*')
    .eq('state_name', stateName)
    .eq('active', true);

  if (exact && exact.length > 0) {
    console.info('✅ Exact match found:', stateName);
    return exact;
  }

  // Try 2: Case-insensitive
  let { data: ilike } = await supabase
    .from('pricing_config')
    .select('*')
    .ilike('state_name', stateName)
    .eq('active', true);

  if (ilike && ilike.length > 0) {
    console.info('✅ Case-insensitive match found:', stateName);
    return ilike;
  }

  // Try 3: Partial (first word)
  const firstWord = stateName.split(' ')[0];
  let { data: partial } = await supabase
    .from('pricing_config')
    .select('*')
    .ilike('state_name', `%${firstWord}%`)
    .eq('active', true);

  if (partial && partial.length > 0) {
    console.info('✅ Partial match found using first word:', firstWord);
    return partial;
  }

  console.warn('❌ No pricing found for state:', stateName);
  return [];
}

/* ============================================================
   Fetch GENERAL/DEFAULT pricing (fallback)
   ============================================================ */
async function fetchGeneralPricing() {
  const generalNames = [
    'GENERAL',
    'ALL INDIA',
    'ALL_INDIA',
    'PAN INDIA',
    'DEFAULT',
  ];

  for (const name of generalNames) {
    const { data } = await supabase
      .from('pricing_config')
      .select('*')
      .ilike('state_name', name)
      .eq('active', true);

    if (data && data.length > 0) {
      console.info('🎯 Using GENERAL offer from:', name);
      return data;
    }
  }

  console.warn('❌ No GENERAL/DEFAULT pricing found');
  return [];
}

/* ============================================================
   Reverse geocode lat/lng → state (BigDataCloud free API)
   ============================================================ */
async function getStateFromCoords(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (!res.ok) return null;
    const data = await res.json();
    console.info('🗺️ Reverse geocode response:', data);

    const state =
      data?.principalSubdivision ||
      data?.principalSubdivisionCode?.split('-')[1] ||
      data?.localityInfo?.administrative?.[2]?.name ||
      data?.localityInfo?.administrative?.[1]?.name ||
      null;

    return state;
  } catch (err) {
    console.error('Reverse geocode failed:', err);
    return null;
  }
}

/* ============================================================
   Hook: useStateWiseOffer
   ============================================================ */
export function useStateWiseOffer(refNo?: string) {
  const [offerData, setOfferData] = useState<OfferData | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);

  const fetchOffer = useCallback(async () => {
    setOfferLoading(true);
    try {
      console.info('🚀 Fetching offer...', { refNo });

      /* ─── CASE 1: Existing User (has ref) ─── */
      if (refNo) {
        try {
          const [estRes, svcRes] = await Promise.all([
            supabase
              .from('estimates')
              .select('user_id')
              .eq('ref_no', refNo)
              .maybeSingle(),
            supabase
              .from('service_records')
              .select('user_id')
              .eq('ref_no', refNo)
              .maybeSingle(),
          ]);

          const user_id = estRes.data?.user_id || svcRes.data?.user_id;
          console.info('👤 User ID from ref:', user_id);

          if (user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('state')
              .eq('id', user_id)
              .maybeSingle();

            const userState = profile?.state;
            console.info('📍 User state:', userState);

            if (userState) {
              const rows = await fetchPricingForState(userState);
              const offer = buildOfferFromPricing(rows, userState, 'REF');
              if (offer) {
                console.info('✅ REF offer found:', offer);
                setOfferData(offer);
                setOfferLoading(false);
                return;
              }
            }
          }

          console.info('⚠️ No REF-based offer, trying GENERAL...');
          const generalRows = await fetchGeneralPricing();
          if (generalRows.length > 0) {
            const offer = buildOfferFromPricing(generalRows, 'All India', 'GENERAL');
            if (offer) {
              console.info('✅ GENERAL offer (for existing user):', offer);
              setOfferData(offer);
              setOfferLoading(false);
              return;
            }
          }

          console.info('❌ Existing user — no offer anywhere. Skipping.');
          setOfferData(null);
          setOfferLoading(false);
          return;
        } catch (err) {
          console.error('Error in REF branch:', err);
          const generalRows = await fetchGeneralPricing();
          if (generalRows.length > 0) {
            const offer = buildOfferFromPricing(generalRows, 'All India', 'GENERAL');
            if (offer) {
              setOfferData(offer);
              setOfferLoading(false);
              return;
            }
          }
          setOfferData(null);
          setOfferLoading(false);
          return;
        }
      }

      /* ─── CASE 2: New Visitor (no ref) ─── */
      let detectedState: string | null = null;
      let source: OfferSource = 'GENERAL';

      // LAYER 2A: Browser geolocation
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          console.info('🌐 Requesting browser geolocation...');
          const position: any = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 8000,
              maximumAge: 15 * 60 * 1000,
              enableHighAccuracy: false,
            });
          });

          console.info('📍 Coords received:', position.coords);
          const state = await getStateFromCoords(
            position.coords.latitude,
            position.coords.longitude
          );

          if (state) {
            detectedState = state;
            source = 'BROWSER';
            console.info('🎯 State from BROWSER:', state);
          } else {
            console.warn('⚠️ Reverse geocode returned null, trying IP...');
          }
        } catch (err: any) {
          console.info('🚫 Browser geo denied/unavailable:', err?.message || err);
        }
      }

      // LAYER 2B: IP-based fallback
      if (!detectedState) {
        try {
          console.info('🌐 Trying IP-based geolocation...');
          const res = await fetch('https://ipapi.co/json/');
          if (res.ok) {
            const ipData = await res.json();
            console.info('📍 IP data:', ipData);
            if (ipData?.region) {
              detectedState = ipData.region;
              source = 'IP';
              console.info('🎯 State from IP:', detectedState);
            }
          }
        } catch (err) {
          console.warn('IP geo failed:', err);
        }
      }

      // Try detected state's offer
      if (detectedState) {
        const rows = await fetchPricingForState(detectedState);
        const offer = buildOfferFromPricing(rows, detectedState, source);
        if (offer) {
          console.info('✅ Detected state offer:', offer);
          setOfferData(offer);
          setOfferLoading(false);
          return;
        }
      }

      // LAYER 3: GENERAL offer
      console.info('⚠️ No state-based offer, trying GENERAL...');
      const generalRows = await fetchGeneralPricing();
      if (generalRows.length > 0) {
        const offer = buildOfferFromPricing(generalRows, 'All India', 'GENERAL');
        if (offer) {
          console.info('✅ GENERAL offer:', offer);
          setOfferData(offer);
          setOfferLoading(false);
          return;
        }
      }

      console.warn('❌ No offer configured anywhere.');
      setOfferData(null);
    } catch (err) {
      console.error('Offer fetch error:', err);
      setOfferData(null);
    } finally {
      setOfferLoading(false);
    }
  }, [refNo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOffer();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchOffer]);

  return { offerData, offerLoading, refetchOffer: fetchOffer };
}