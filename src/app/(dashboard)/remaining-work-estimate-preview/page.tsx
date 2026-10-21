"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { QRCodeSVG } from 'qrcode.react';
import { fetchPricingRow, getDisplayPricing } from "@/lib/pricingFetch";   // ✅ NEW
import { getItemRate } from "@/lib/pricing";                              // ✅ NEW

// The QR code and share link always point to the production verification page
const VERIFY_BASE_URL = "https://construction-estimate-software.vercel.app";

// Route of the remaining-work input form (change this single constant if the route differs)
const REMAINING_FORM_ROUTE = "/remaining-work-estimate";

// localStorage key that carries the input form data into this preview (and back again)
const PREVIEW_STORAGE_KEY = "estimatePreview";
const clearFlowStorage = () => {
  try { localStorage.removeItem(PREVIEW_STORAGE_KEY); } catch {}
};

// A larger change in customer name / property address is treated as a new estimate (new ref no + new payment)
const NAME_ADDRESS_CHANGE_LIMIT = 15; // Percent

// True for a persisted reference number; false for temporary ones (REF-..., TEMP..., placeholders)
const isRealRef = (r?: string | null) => !!r && !/^(REF-|TEMP)/i.test(r) && !r.includes("...");

// Snapshot used to detect changes: name, address, plot area, rate, floor areas and totals
const makeSnapshot = (e: any) => {
  const fd = e?.floor_details && typeof e.floor_details === "object" ? e.floor_details : {};
  const floors: Record<string, number> = {};
  Object.keys(fd).sort().forEach((k) => { floors[k] = Number(fd[k]?.area || 0); });
  return JSON.stringify({
    n: String(e?.customer_name || "").trim().toUpperCase(),
    a: String(e?.property_address || "").trim().toUpperCase(),
    p: Number(e?.plot_area || 0),
    r: Number(e?.rate_per_sqft || 0),
    b: Number(e?.total_builtup_area || 0),
    t: Math.round(Number(e?.total_value ?? e?.total_construction_cost ?? e?.construction_cost ?? 0)),
    f: floors,
  });
};

// Returns how much a text value has changed, as a percentage (character-level Levenshtein distance),
// so that a same-length replacement (e.g. RAMESH -> SURESH) is still counted as a change.
const calculatePercentageChange = (str1: string, str2: string) => {
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

// File name used for the PDF and as the default name in the browser's "Save as PDF" dialog
const sanitizeForFile = (v: any) =>
  String(v || "").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const slabConfig: any = {
  500: { door: 0.1, plumb: 0.25, elec: 0.25, paint: 0.1,floor: 0.3 },
  600: { door: 0.1, plumb: 0.25, elec: 0.25, paint: 0.1,floor: 0.3 },
  700: { door: 0.1, plumb: 0.25, elec: 0.25, paint: 0.1,floor: 0.3 },
  800: { door: 0.1, plumb: 0.25, elec: 0.25, paint: 0.1,floor: 0.3 },
  900: { door: 0.1, plumb: 0.25, elec: 0.25, paint: 0.1,floor: 0.3 },
  1000: { door: 0.10, plumb: 0.25, elec: 0.25, paint: 0.1,floor: 0.3 },
  1100: { door: 0.14,  paint: 0.14, ms: 0.08,  plumb: 0.2, elec: 0.2, floor: 0.24},
  1150: { door: 0.14,  paint: 0.14, ms: 0.08,  plumb: 0.2, elec: 0.2, floor: 0.24},
  1200: { door: 0.14,  paint: 0.14, ms: 0.08,  plumb: 0.2, elec: 0.2, floor: 0.24},
  1250: { door: 0.14,  paint: 0.14, ms: 0.08,  plumb: 0.2, elec: 0.2, floor: 0.24},
  1300: { door: 0.14,  paint: 0.14, ms: 0.08,  plumb: 0.2, elec: 0.2, floor: 0.24},
  1350: { door: 0.14,  paint: 0.14, ms: 0.1,  plumb: 0.195, elec: 0.195, floor: 0.23},
  1400: { door: 0.14,  paint: 0.14, ms: 0.11,  plumb: 0.195, elec: 0.195, floor: 0.22},
  1500: { door: 0.131, paint: 0.125, ms: 0.13, plumb: 0.187, elec: 0.187, floor: 0.24 },
  1550: { door: 0.095, paint: 0.111, ms: 0.095, plumb: 0.16, elec: 0.16, floor: 0.17, ceiling: 0.08,water: 0.129 },
  1600: { door: 0.095, paint: 0.111, ms: 0.095, plumb: 0.16, elec: 0.16, floor: 0.18, ceiling: 0.07,water: 0.129 },
  1650: { door: 0.095, paint: 0.111, ms: 0.095, plumb: 0.16, elec: 0.16, floor: 0.18, ceiling: 0.07,water: 0.129 },
  1700: { door: 0.09, paint: 0.09, ms: 0.09, plumb: 0.13, elec: 0.13, floor: 0.15, ceiling: 0.04, kitchen: 0.15, water: 0.13 },
  1750: { door: 0.09, paint: 0.09, ms: 0.09, plumb: 0.13, elec: 0.13, floor: 0.15, ceiling: 0.04, kitchen: 0.28 },
  1800: { door: 0.078, paint: 0.08, ms: 0.078, plumb: 0.13, elec: 0.13, floor: 0.135, ceiling: 0.05, kitchen: 0.154, water: 0.1, furnish: 0.065 },
  1900: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.13, elec: 0.13, floor: 0.13, ceiling: 0.06, kitchen: 0.14,  water: 0.1, furnish: 0.12},
  2000: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.10, elec: 0.10, floor: 0.11, ceiling: 0.06, kitchen: 0.13, water: 0.11, furnish: 0.16, elev: 0.04 },
  2100: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.16, elev: 0.04, cons: 0.02},
  2200: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045},
  2250: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045},
  2300: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045},
  2350: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045},
  2400: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045},
  2450: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.182, elev: 0.035, cons: 0.02, bore: 0.043},
  2500: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045},
  2550: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045},
  2600: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045},
  2650: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045},
  2700: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.09, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.335},
  2750: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.09, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.335},
  2800: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.1, elev: 0.02, cons: 0.02, bore: 0.025, lift: 0.335},
  2850: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.1, elev: 0.02, cons: 0.02, bore: 0.025, lift: 0.335},
  2900: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.045, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.34},
  3000: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.045, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.34},
  3100: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.04, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.03, lift: 0.35},
  3150: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.04, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.03, lift: 0.35},
  3200: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.075, elec: 0.07, floor: 0.085, ceiling: 0.04, kitchen: 0.07, water: 0.035, furnish: 0.17, elev: 0.02, cons: 0.02, bore: 0.02, lift: 0.275},
  3250: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.075, elec: 0.07, floor: 0.085, ceiling: 0.04, kitchen: 0.07, water: 0.035, furnish: 0.17, elev: 0.02, cons: 0.02, bore: 0.02, lift: 0.275},
  3500: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.075, elec: 0.07, floor: 0.095, ceiling: 0.04, kitchen: 0.07, water: 0.035, furnish: 0.195, elev: 0.02, cons: 0.023, bore: 0.017, lift: 0.24},
  3750: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.06, water: 0.023, furnish: 0.206, elev: 0.015, cons: 0.03, bore: 0.012, lift: 0.20},
  4000: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.356, elev: 0.01, cons: 0.03, bore: 0.005, lift: 0.085},
  4250: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.354, elev: 0.01, cons: 0.03, bore: 0.007, lift: 0.085},
  4500: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.354, elev: 0.01, cons: 0.03, bore: 0.007, lift: 0.085},
  4750: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.336, elev: 0.01, cons: 0.033, bore: 0.007, lift: 0.1},
  5000: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.337, elev: 0.01, cons: 0.033, bore: 0.006, lift: 0.1}
};

export default function RemainingWorkEstimatePreviewPage() {
  const router = useRouter();
  const { currentUser, setCurrentUser } = useAuth();

  const [estimate, setEstimate] = useState<any>(null);
  const [masterItem, setMasterItem] = useState<any>(null);
  const [selectedPlotMaster, setSelectedPlotMaster] = useState<any>(null);
  const [totalColumnNos, setTotalColumnNos] = useState(0);

  const [isPaid, setIsPaid] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [totalEstimates, setTotalEstimates] = useState(0);
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [validationReason, setValidationReason] = useState("");
  const [isCheckingHistory, setIsCheckingHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [useCustomLetterhead, setUseCustomLetterhead] = useState(false);
  const [customHeaderTitle, setCustomHeaderTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [legalText, setLegalText] = useState("WE PROVIDE TECHNICAL SERVICES INCLUDING CONSTRUCTION ESTIMATION, BUILDING PLANNING AND DESIGN, BUILDING PERMISSION AND PLAN APPROVAL, SITE LAYOUT .");
  const [disclaimerText, setDisclaimerText] = useState("This estimation is provided purely as a tentative budgetary guide for informational purposes at the request of the customer to understand the potential scope and incurred costs of the house/bungalow. It is not a binding commercial contract, a fixed-price quotation, or a guaranteed construction cost, as final expenses may vary significantly due to market fluctuations in material prices (e.g., steel, cement), unforeseen site-specific conditions, design changes, and local regulatory requirements. Before initiating any financial commitments, the customer is strictly advised to conduct a detailed site inspection and consult with qualified structural engineers and contractors to obtain finalized site-specific BOQs and quotes. The estimator bears no financial or legal liability for any budget shortfalls, cost overruns, or discrepancies that may arise during actual construction, and the use of this document for any financial or institutional application remains the sole responsibility of the customer. This document is valid for 60 days from the date of issue.");
  const [showSignature, setShowSignature] = useState(false);
  const [signatureDetails, setSignatureDetails] = useState<string | null>(null);
  const userCategory = (currentUser?.user_type || 'INDIVIDUAL USER').toUpperCase();
  const [isFinalized, setIsFinalized] = useState(false);
  
  const [finalFee, setFinalFee] = useState(150);
  const [currentRefNo, setCurrentRefNo] = useState("LNT/26-27/...");
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [isPdfBusy, setIsPdfBusy] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [needsNewPayment, setNeedsNewPayment] = useState(false);
  const [originalRefNo, setOriginalRefNo] = useState<string | null>(null);
  const [newPaymentReason, setNewPaymentReason] = useState<string>("");
  const initialEstimateRef = useRef<string | null>(null); // Snapshot of the estimate as persisted in the database (baseline for change detection)
  const savedPaymentRef = useRef<{ order_id: any; payment_id: any; user_payment: any }>({ order_id: null, payment_id: null, user_payment: null }); // Payment identifiers already stored for this ref no
  const goingToFormRef = useRef(false);
  const isMountedRef = useRef(false);
  const allowPrintRef = useRef(false); // true only while the in-app Print button triggers window.print()

  // ✅ NEW: Dynamic Pricing States
  const [gatewayFeeAmount, setGatewayFeeAmount] = useState<number>(21);
  const [pricingDisplay, setPricingDisplay] = useState({
    mrp: 120,
    price: 21,
    discountEnabled: true,
    discountPercent: 82,
    savings: 99,
    isFromDB: false,
  });
  const [pricingLoading, setPricingLoading] = useState(true);
  const [estimateStateName, setEstimateStateName] = useState<string>("MADHYA PRADESH");

  const checkEstimatePaymentStatus = async (
    refNo: string,
    current?: { customer_name?: string; property_address?: string }
  ) => {
    if (!refNo) return;
    try {
      const { data: estData } = await supabase
        .from('estimates')
        .select('*')
        .eq('ref_no', refNo)
        .maybeSingle();

      // 15% rule: compare the current name/address with the saved (paid) record
      const pct = (dbVal: any, curVal: any) =>
        String(dbVal || "").trim() ? calculatePercentageChange(String(dbVal), String(curVal || "")) : 0;
      const changedTooMuch = !!(estData && current) && (
        pct(estData.customer_name, current.customer_name) > NAME_ADDRESS_CHANGE_LIMIT ||
        pct(estData.property_address, current.property_address) > NAME_ADDRESS_CHANGE_LIMIT
      );

      let alreadyPaid = !!estData && (estData.platform_payment_status === 'paid' || estData.payment_status === 'paid' || estData.status === 'paid');

      if (!alreadyPaid) {
        const { data: misData } = await supabase
          .from('mis_records')
          .select('platform_payment_status')
          .eq('ref_no', refNo)
          .maybeSingle();
        alreadyPaid = !!misData && misData.platform_payment_status === 'paid';
      }

      if (!alreadyPaid) return;

      if (changedTooMuch) {
        // Treat as a new estimate: detach from the old ref/id and require a new payment
        setNeedsNewPayment(true);
        setNewPaymentReason("CHANGED");
        setOriginalRefNo(refNo);
        setIsAlreadyPaid(false);
        setIsPaid(false);
        setRequiresPayment(true);
        setCurrentRefNo("LNT/26-27/...");
        setEstimate((prev: any) => (prev ? { ...prev, id: null, ref_no: null } : prev));
        return;
      }

      if (estData) {
        // Baseline: values persisted in the database (used to detect print-only / minor-change cases)
        initialEstimateRef.current = makeSnapshot({
          customer_name: estData.customer_name,
          property_address: estData.property_address,
          plot_area: estData.plot_area,
          rate_per_sqft: estData.rate_per_sqft,
          total_builtup_area: estData.total_builtup_area,
          total_value: estData.total_construction_cost ?? estData.total_value,
          floor_details: estData.floor_details,
        });
        // Keep the stored payment identifiers so that a same-ref update never wipes them
        savedPaymentRef.current = {
          order_id: estData.order_id ?? estData.razorpay_order_id ?? null,
          payment_id: estData.payment_id ?? estData.razorpay_payment_id ?? null,
          user_payment: estData.user_payment ?? null,
        };
      }

      setIsAlreadyPaid(true);
      setIsPaid(true);
      setRequiresPayment(false);
    } catch (err) {
      console.error("Error checking payment status:", err);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // ✅ NEW: State-wise dynamic pricing fetch
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    let alive = true;

    const loadPricing = async () => {
      setPricingLoading(true);

      const targetState =
        currentUser?.state ||
        estimateStateName ||
        estimate?.state_name ||
        "MADHYA PRADESH";

      try {
        const row = await fetchPricingRow("estimate", targetState, userCategory);
        const display = getDisplayPricing(row);

        if (!alive) return;

        if (display.isFromDB && display.price > 0) {
          setGatewayFeeAmount(display.price);
          setPricingDisplay({
            mrp: display.mrp,
            price: display.price,
            discountEnabled: display.discountEnabled,
            discountPercent: display.discountPercent,
            savings: display.savings,
            isFromDB: true,
          });
          console.log(`💰 [REMAINING WORK DB PRICING] ${targetState} = ₹${display.price}`);
        } else {
          const fallbackPrice = getItemRate(targetState, "estimate");
          setGatewayFeeAmount(fallbackPrice);
          setPricingDisplay({
            mrp: fallbackPrice,
            price: fallbackPrice,
            discountEnabled: false,
            discountPercent: 0,
            savings: 0,
            isFromDB: false,
          });
          console.log(`⚠️ [REMAINING WORK FALLBACK PRICING] ${targetState} = ₹${fallbackPrice}`);
        }
      } catch (err) {
        console.error("[REMAINING WORK PRICING FETCH ERROR]", err);
        if (!alive) return;
        const fallbackPrice = getItemRate(targetState, "estimate");
        setGatewayFeeAmount(fallbackPrice);
        setPricingDisplay({
          mrp: fallbackPrice,
          price: fallbackPrice,
          discountEnabled: false,
          discountPercent: 0,
          savings: 0,
          isFromDB: false,
        });
      } finally {
        if (alive) setPricingLoading(false);
      }
    };

    loadPricing();
    return () => { alive = false; };
  }, [estimateStateName, estimate?.state_name, currentUser?.state, userCategory]);

  useEffect(() => {
    const loadEstimateFromStorage = async () => {
      try {
        const rawData = typeof window !== 'undefined' ? localStorage.getItem(PREVIEW_STORAGE_KEY) : null;
        if (!rawData) return;
        const parsedData = JSON.parse(rawData);

        if (parsedData?.force_new_ref && !isRealRef(parsedData.ref_no)) {
          // The input page has already decided on a new ref no + new payment (e.g. estimate older than 60 days)
          setNeedsNewPayment(true);
          setNewPaymentReason(parsedData.new_ref_reason || "EXPIRED_60_DAYS");
          setOriginalRefNo(parsedData.previous_ref_no || null);
          setCurrentRefNo(parsedData.ref_no || "LNT/26-27/...");
        } else if (parsedData?.ref_no) {
          setCurrentRefNo(parsedData.ref_no);
          await checkEstimatePaymentStatus(parsedData.ref_no, {
            customer_name: parsedData.customer_name,
            property_address: parsedData.property_address,
          });
        }
      } catch (err) {
        console.error("Error loading estimate from storage:", err);
      }
    };

    loadEstimateFromStorage();
  }, []);

  useEffect(() => {
    if (estimate) {
      setIsPaid(estimate.platform_payment_status === 'paid');
    }
  }, [estimate]);

  useEffect(() => {
    const savedLogo = localStorage.getItem("customLogo");
    if (savedLogo) {
      setLogoUrl(savedLogo);
    }

    const syncPaymentStatus = async () => {
      if (estimate?.id) {
        const { data } = await supabase
          .from('mis_records')
          .select('platform_payment_status')
          .eq('estimate_id', estimate.id)
          .maybeSingle();

        if (data && data.platform_payment_status === 'paid') {
          setIsPaid(true);
        } else {
          setIsPaid(false);
        }
      }
    };

    syncPaymentStatus();
  }, [estimate?.id]);

  const handleRazorpayPayment = () => handlePayment();

  // Base name shared by the PDF file and the browser's print dialog: <ref no>_<customer name>_LnT-Consultancy
  const exportBaseName = () =>
    [sanitizeForFile(estimate?.ref_no || "estimate"), sanitizeForFile(estimate?.customer_name), "LnT-Consultancy"]
      .filter(Boolean)
      .join("_");

  const pdfFileName = () => `${exportBaseName()}.pdf`;

  // Open the print dialog only after React has rendered the final (paid, with ref no) page
  const printAfterRender = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          // Printing is only permitted when it is started from the in-app Print button
          allowPrintRef.current = true;
          // The document title becomes the default file name in "Save as PDF"
          const previousTitle = document.title;
          document.title = exportBaseName();
          const restoreTitle = () => { document.title = previousTitle; };
          window.addEventListener("afterprint", restoreTitle, { once: true });
          setTimeout(restoreTitle, 60000); // Fallback in case afterprint never fires
          try {
            window.print();
          } finally {
            setTimeout(() => { allowPrintRef.current = false; }, 1000);
          }
          resolve();
        })
      );
    });

  const handleSaveAndPrint = async () => {
    setIsSaving(true);
    try {
      const ok = await ensureSaved();
      if (!ok) return;
      await printAfterRender();
    } catch (error) {
      console.error("Save failed", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Print-only / no change              -> database is not touched (same ref no, no update, no new charge)
  // Minor change (name/address within 15%, or plot/floor area/rate/items) -> updates the SAME ref no
  // Major change / new estimate         -> handleSaveAndFinalize creates a new ref no and requires payment
  const isUnchangedFromSaved = () =>
    !needsNewPayment &&
    isRealRef(estimate?.ref_no) &&
    !!initialEstimateRef.current &&
    makeSnapshot(estimate) === initialEstimateRef.current;

  const ensureSaved = async (): Promise<boolean> => {
    if (isUnchangedFromSaved()) return true;
    const ok = await handleSaveAndFinalize();
    if (ok) await new Promise((r) => setTimeout(r, 500)); // Allow the new ref no to render before capturing/printing
    return ok;
  };

  const isExportReady = () =>
    (isPaid || isAlreadyPaid || userCategory === 'ADMIN') &&
    !!estimate?.ref_no && !String(estimate.ref_no).startsWith("TEMP") && !String(estimate.ref_no).includes("...");

  // Converts the estimate currently on screen into a paginated A4 PDF.
  // - Layout is captured at a fixed A4 width so the result does not depend on the screen size.
  // - Page breaks are only placed between table rows / top-level sections, so no row is ever cut in half.
  // - A block that does not fit on the current page moves to the next page; the last page is never
  //   left with only a tiny block (a few preceding rows are carried over with it).
  // - Every page carries a "Page X of Y" footer.
  const buildPdfBlob = async (): Promise<Blob> => {
    const el = printRef.current;
    if (!el) throw new Error("Estimate area not found");
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas-pro"),
      import("jspdf"),
    ]);

    const SCALE = 3;
    const CAPTURE_WIDTH_PX = 703; // 186 mm (A4 width minus 12 mm side margins) at 96 DPI, same as the print layout
    const breakCandidatesCss: number[] = []; // safe break offsets (CSS px) measured in the cloned DOM

    // Collect the @media print rules of the page so the PDF uses exactly the same compact layout as the printout
    let printCss = "";
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; } // skip cross-origin stylesheets
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule && /print/i.test(rule.media.mediaText)) {
          for (const inner of Array.from(rule.cssRules)) {
            if (inner instanceof CSSStyleRule) printCss += inner.cssText + "\n";
          }
        }
      }
    }

    const canvas = await html2canvas(el, {
      scale: SCALE,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth: 1100,
      ignoreElements: (node: Element) =>
        node.classList?.contains("no-print") || node.classList?.contains("draft-watermark"),
      onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
        // Remove UI-only elements from the layout (print.css forces .no-print to display:block, hence !important)
        clonedDoc.querySelectorAll(".no-print, .draft-watermark").forEach((n) => {
          (n as HTMLElement).style.setProperty("display", "none", "important");
        });

        // html2canvas does not lay out <textarea> text reliably (alignment/wrapping), so render them as plain blocks
        clonedDoc.querySelectorAll("textarea").forEach((node) => {
          const ta = node as HTMLTextAreaElement;
          const cs = clonedDoc.defaultView!.getComputedStyle(ta);
          const block = clonedDoc.createElement("div");
          block.textContent = ta.value;
          ["font-family", "font-size", "font-weight", "line-height", "letter-spacing", "color", "text-align", "text-transform"].forEach((p) =>
            block.style.setProperty(p, cs.getPropertyValue(p))
          );
          block.style.whiteSpace = "pre-wrap";
          block.style.width = "100%";
          ta.parentNode?.replaceChild(block, ta);
        });

        // Apply the print rules to the cloned document, then pin the root to the A4 content width
        const styleEl = clonedDoc.createElement("style");
        styleEl.textContent = printCss;
        clonedDoc.head.appendChild(styleEl);

        const root = clonedEl;
        const force = (prop: string, value: string) => root.style.setProperty(prop, value, "important");
        force("position", "relative");
        force("top", "0");
        force("left", "0");
        force("width", `${CAPTURE_WIDTH_PX}px`);
        force("max-width", `${CAPTURE_WIDTH_PX}px`);
        force("min-height", "0");
        force("margin", "0");
        force("padding", "0");

        // Measure the positions where a page break is allowed
        const rootTop = root.getBoundingClientRect().top;
        const addCandidate = (node: Element) => {
          const r = node.getBoundingClientRect();
          if (r.height > 0) breakCandidatesCss.push(r.bottom - rootTop);
        };
        // Between table body rows (never right after a table header row)
        root.querySelectorAll("tr").forEach((tr) => {
          if (!tr.closest("thead")) addCandidate(tr);
        });
        // Between top-level sections (never right after a heading)
        Array.from(root.children).forEach((child) => {
          if (!/^H[1-3]$/.test(child.tagName) && !child.querySelector("h1, h2, h3")) addCandidate(child);
        });
      },
    });

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const marginX = 12; // identical to the print margins (A4: 12 mm sides, 10 mm top, 14 mm bottom)
    const marginTop = 10;
    const marginBottom = 14; // space reserved for the page number footer
    const imgW = pageW - marginX * 2;
    const pxPerMm = canvas.width / imgW;
    const pageContentPx = Math.floor((pageH - marginTop - marginBottom) * pxPerMm);
    const minFillPx = Math.floor(pageContentPx * 0.3);

    const candidates = Array.from(
      new Set(
        breakCandidatesCss
          .map((v) => Math.round(v * SCALE))
          .filter((v) => v > 0 && v < canvas.height)
      )
    ).sort((a, b) => a - b);

    // Build page edges: break at the last safe position that still fits on the page
    const edges: number[] = [0];
    while (canvas.height - edges[edges.length - 1] > pageContentPx) {
      const start = edges[edges.length - 1];
      const limit = start + pageContentPx;
      let end = limit; // hard cut only if a single unbreakable block is taller than a page
      for (let i = candidates.length - 1; i >= 0; i--) {
        if (candidates[i] <= limit && candidates[i] > start + minFillPx) {
          end = candidates[i];
          break;
        }
      }
      edges.push(end);
    }
    edges.push(canvas.height);

    // Avoid a nearly empty last page: carry a few preceding rows over together with the last block
    if (edges.length >= 3) {
      const lastStart = edges[edges.length - 2];
      const minLastPx = Math.floor(pageContentPx * 0.35);
      if (canvas.height - lastStart < minLastPx) {
        const prevStart = edges[edges.length - 3];
        const target = canvas.height - minLastPx;
        let moved = -1;
        for (const c of candidates) {
          if (c > prevStart + minFillPx && c <= target) moved = c;
        }
        if (moved > 0 && canvas.height - moved <= pageContentPx) edges[edges.length - 2] = moved;
      }
    }

    const totalPages = edges.length - 1;
    for (let p = 0; p < totalPages; p++) {
      const y0 = edges[p];
      const h = edges[p + 1] - y0;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = h;
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, h);
      ctx.drawImage(canvas, 0, y0, canvas.width, h, 0, 0, canvas.width, h);

      if (p > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", marginX, marginTop, imgW, h / pxPerMm);

      pdf.setFontSize(8);
      pdf.setTextColor(68, 68, 68);
      pdf.text(`Page ${p + 1} of ${totalPages}`, pageW / 2, pageH - 6, { align: "center" });
    }
    return pdf.output("blob");
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleDownloadPdf = async () => {
    if (!isExportReady() || isPdfBusy) return;
    setIsPdfBusy(true);
    try {
      if (!(await ensureSaved())) return;
      downloadBlob(await buildPdfBlob());
    } catch (err) {
      console.error("PDF error:", err);
      alert("PDF nahi ban paya. Kripya dobara try karein.");
    } finally {
      setIsPdfBusy(false);
    }
  };

  const handleSharePdf = async () => {
    if (!isExportReady() || isPdfBusy) return;
    setIsPdfBusy(true);
    try {
      if (!(await ensureSaved())) return;
      const blob = await buildPdfBlob();
      const file = new File([blob], pdfFileName(), { type: "application/pdf" });
      const verifyUrl = `${VERIFY_BASE_URL}/verify-estimate?ref=${estimate?.ref_no || ""}`;
      const text = `Remaining Work Estimate | Ref No: ${estimate?.ref_no}\nCustomer: ${estimate?.customer_name || ""}\nVerify: ${verifyUrl}`;
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Remaining Work Estimate", text });
      } else {
        // Desktop / unsupported browser fallback: download the PDF and open WhatsApp with the verification link
        downloadBlob(blob);
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Share error:", err);
        alert("Share nahi ho paya. Kripya 'Download PDF' use karein.");
      }
    } finally {
      setIsPdfBusy(false);
    }
  };

  const handlePayment = async () => {
    try {
      if (!(window as any).Razorpay) {
        await new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          document.body.appendChild(script);
        });
      }

      // Use the dynamic price from the pricing configuration
      const dynamicAmount = gatewayFeeAmount || 21;

      const res = await fetch("/api/analyze/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: dynamicAmount }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create order");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: Math.round(dynamicAmount * 100),
        currency: "INR",
        name: "Construction Estimate",
        order_id: data.id, 
        config: {
          display: {
            sequence: ["block.upi_qr", "block.cards", "block.netbanking", "block.wallet"],
            preferences: { show_default_blocks: true },
          },
        },
        handler: async function (response: any) {
          try {
            const paymentDetails = {
              p_payment_status: 'paid',
              p_order_id: response.razorpay_order_id,
              p_payment_id: response.razorpay_payment_id,
              p_user_payment: dynamicAmount
            };

            setNeedsNewPayment(false);
            setIsPaid(true);
            setIsAlreadyPaid(true);
            await handleSaveAndFinalize(paymentDetails);
            
            const rzpElement = document.querySelector('.razorpay-checkout-frame');
            if (rzpElement) { rzpElement.remove(); }
            
            // After payment, stay on the finalized page (with ref no); no automatic print or redirect
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch (error) {
            console.error("Payment sync error:", error);
            alert("Payment successful but system failed to update status.");
          }
        },
        prefill: {
          name: currentUser?.full_name || "",
          email: currentUser?.email || ""
        },
        theme: { color: "#3399cc" }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment Error:", err);
      alert("Payment initialization failed. Please try again.");
    }
  };
  
  useEffect(() => {
    const savedLogo = localStorage.getItem("customLogo");
    if (savedLogo) {
      setLogoUrl(savedLogo);
    }
  }, []);

  useEffect(() => {
    const initializeDashboard = async () => {
      const { count } = await supabase.from("mis_records").select('*', { count: 'exact', head: true });
      setTotalEstimates((count || 0) + 1);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (profile) setCurrentUser(profile);
      }
    };
    initializeDashboard();
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (userCategory === 'ADMIN' || isPaid || isAlreadyPaid) {
        setRequiresPayment(false);
        setValidationReason("");
      } else {
        setRequiresPayment(true);
        setValidationReason(
          needsNewPayment
            ? (newPaymentReason === "EXPIRED_60_DAYS"
                ? `⚠️ Purana estimate 60 din se zyada purana hai, isliye ye NAYA estimate maana jayega (purani Ref: ${originalRefNo || "-"}). Naya REF NO banega aur print ke liye naya payment karna hoga.`
                : `⚠️ Customer name ya property address ${NAME_ADDRESS_CHANGE_LIMIT}% se zyada badal gaya hai, isliye ye NAYA estimate maana jayega (purani Ref: ${originalRefNo || "-"}). Naya REF NO banega aur print ke liye naya payment karna hoga.`)
            : "Note: To print this estimate, please complete the payment process."
        );
      }
    }
  }, [currentUser, userCategory, isPaid, isAlreadyPaid, needsNewPayment, originalRefNo, newPaymentReason]);

  // While a new payment is pending, prevent any other effect from marking the estimate as paid
  useEffect(() => {
    if (needsNewPayment && (isPaid || isAlreadyPaid)) {
      setIsPaid(false);
      setIsAlreadyPaid(false);
    }
  }, [needsNewPayment, isPaid, isAlreadyPaid]);

  useEffect(() => {
    if (estimate) {
      if (estimate.ref_no) {
        setCurrentRefNo(estimate.ref_no);
      }
      if (estimate.fee_amount) {
        setFinalFee(Number(estimate.fee_amount));
      }
    }
  }, [estimate]);

  async function getColumnsForFloor(width: number, length: number) {
    const { data } = await supabase
      .from("plot_master")
      .select("no_of_column")
      .eq("width_feet", Math.ceil(width))
      .eq("length_feet", Math.ceil(length))
      .maybeSingle();
    return data?.no_of_column || 0;
  }

  const fetchDynamicFee = async (clientName: string, repName: string, caseType: string) => {
    const caseTypeMap: any = {
      "NEW CONSTRUCTION": "estimate_fee",
      "RENOVATION": "plan_fee",
      "RENOVATION + EXTENSION": "route_map_fee"
    };
    const targetColumn = caseTypeMap[caseType] || "estimate_fee";

    const cleanCName = clientName?.split(/[.\s]+/)[0].trim();
    const cleanRName = repName?.split(/[.\s]+/)[0].trim();
  
    const { data, error } = await supabase
      .from("clients")
      .select(targetColumn)
      .ilike("client_name", `${cleanCName}%`) 
      .ilike("representative_name", `${cleanRName}%`)
      .maybeSingle();

    if (error) return 0;

    return data ? Number(data[targetColumn] || 0) : 0;
  };

  const handleSaveAndFinalize = async (paymentData?: any): Promise<boolean> => {
    const isAuthorized = userCategory === 'ADMIN' || isPaid || isAlreadyPaid || paymentData;
    if (!isAuthorized) {
      alert(`Payment of ₹${gatewayFeeAmount}/- is required to save and print.`);
      handlePayment();
      return false;
    }

    if (isSaving) return false;

    const now = new Date();
    const userId = currentUser?.id;
    if (!userId) { alert("User ID not found!"); return false; }

    try {
      setIsSaving(true);

      // New-payment case: do not overwrite the old record; create a new record with a new ref no
      let activeEstimateId = needsNewPayment ? null : (estimate?.id || null);
      let activeRefNo = needsNewPayment ? null : (isRealRef(estimate?.ref_no) ? estimate.ref_no : null);
      let skipNewRefGeneration = false;

      if (activeRefNo) {
        skipNewRefGeneration = true;
      }

      if (!activeEstimateId && activeRefNo) {
        const { data: foundRec } = await supabase
          .from("estimates")
          .select("id")
          .eq("ref_no", activeRefNo)
          .maybeSingle();
        
        if (foundRec) {
          activeEstimateId = foundRec.id;
        }
      }

      if (!activeRefNo && !needsNewPayment) {
        const { data: duplicate } = await supabase
          .from("estimates")
          .select("id, ref_no")
          .eq("customer_name", estimate?.customer_name)
          .eq("property_address", estimate?.property_address)
          .maybeSingle();

        if (duplicate) {
          const confirmOverwrite = confirm(`Duplicate found (Ref: ${duplicate.ref_no}). OK to OVERWRITE?`);
          if (confirmOverwrite) {
            activeEstimateId = duplicate.id;
            activeRefNo = duplicate.ref_no; 
            skipNewRefGeneration = true;
          } else {
            setIsSaving(false);
            return false;
          }
        }
      }

      if (!skipNewRefGeneration && !activeRefNo) {
        const fy = (now.getMonth() + 1) >= 4 
          ? `${String(now.getFullYear()).slice(-2)}-${String(now.getFullYear() + 1).slice(-2)}` 
          : `${String(now.getFullYear() - 1).slice(-2)}-${String(now.getFullYear()).slice(-2)}`;
        
        const firstName = (currentUser?.full_name || "GUEST").split(' ')[0].toUpperCase();

        const { count: userCount, error: userErr } = await supabase
          .from('estimates')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        const personalSeq = !userErr && userCount !== null ? userCount + 1 : 1;
        const formattedUserSeq = `U${String(personalSeq).padStart(3, '0')}`;

        const { count: globalCount, error: globalErr } = await supabase
          .from('estimates')
          .select('*', { count: 'exact', head: true });

        const globalSeq = !globalErr && globalCount !== null ? globalCount + 1 : 1;
        const formattedGlobalSeq = `C${String(globalSeq).padStart(4, '0')}`;

        activeRefNo = `LnT/${fy}/${firstName}/${formattedUserSeq}/${formattedGlobalSeq}`;
      }

      let consultingFee = estimate?.fee_mode === "AUTO" 
        ? await fetchDynamicFee(estimate?.client_name, estimate?.representative, estimate?.estimate_type) 
        : parseFloat(estimate?.fee_amount) || 0;

      const payload = {
        p_estimate_id: activeEstimateId,
        p_user_id: userId,
        p_customer_name: estimate?.customer_name || 'GUEST',
        p_snapshot: { 
          totalArea: Number(estimate?.total_builtup_area || 0), 
          grandTotal: Number(estimate?.total_value || 0), 
          property_address: estimate?.property_address || '', 
          date: now.toISOString() 
        },
        p_fee_standard: Number(consultingFee) || 0,
        p_estimate_type: estimate?.estimate_type || 'RENOVATION',
        p_plan_type: estimate?.plan_type || 'BASIC',
        p_rate_per_sqft: Number(estimate?.rate_per_sqft || 0),
        p_floor_details: (estimate?.floor_details && typeof estimate.floor_details === 'object') ? estimate.floor_details : {},
        p_client_name: estimate?.client_name || '',
        p_representative: estimate?.representative || '',
        p_plot_area: Number(estimate?.plot_area || 0),
        p_property_address: estimate?.property_address || '',
        p_total_builtup_area: Number(estimate?.total_builtup_area || 0),
        p_total_construction_cost: Number(estimate?.total_value || 0),
        p_ref_no: activeRefNo,
        p_status: 'pending',
        p_payment_status: paymentData?.p_payment_status || 'paid',
        // On a same-ref update the stored payment identifiers are carried forward instead of being cleared
        p_order_id: paymentData?.p_order_id || (needsNewPayment ? null : savedPaymentRef.current.order_id) || null,
        p_payment_id: paymentData?.p_payment_id || (needsNewPayment ? null : savedPaymentRef.current.payment_id) || null,
        p_user_payment: Number(paymentData?.p_user_payment || (needsNewPayment ? 0 : savedPaymentRef.current.user_payment) || gatewayFeeAmount || 21)
      };

      const { data, error } = await supabase.rpc('rpc_save_estimate', payload);
      if (error) throw error;

      if (data && data.length > 0) {
        if (!activeEstimateId) {
          await supabase.from('profiles').update({ estimate_count: (currentUser?.estimate_count || 0) + 1 }).eq('id', userId);
        }
        
        const result = data[0];
        const savedEstimate = { ...estimate, id: result.estimate_id, ref_no: result.ref_no };
        setEstimate((prev: any) => ({ ...prev, id: result.estimate_id, ref_no: result.ref_no }));
        setIsFinalized(true);
        setIsPaid(true);
        setCurrentRefNo(result.ref_no);
        if (paymentData) setJustPaid(true);
        setNeedsNewPayment(false);
        setOriginalRefNo(null);
        setNewPaymentReason("");
        if (paymentData) {
          savedPaymentRef.current = {
            order_id: paymentData.p_order_id || null,
            payment_id: paymentData.p_payment_id || null,
            user_payment: paymentData.p_user_payment ?? null,
          };
        }
        // The persisted values are now the baseline
        initialEstimateRef.current = makeSnapshot(savedEstimate);

        // Keep the saved data and ref no available when returning to the input form for corrections
        try {
          localStorage.setItem(
            PREVIEW_STORAGE_KEY,
            JSON.stringify({ ...savedEstimate, payment_status: 'paid', is_paid: true, force_new_ref: false, new_ref_reason: null })
          );
        } catch {}
        return true;
      }
      return false;
    } catch (error: any) {
      console.error("Save Error:", error);
      alert("Error: " + (error.message || "Failed to save data"));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function calculateDynamicColumns() {
      if (!estimate) return;
      
      const floors = estimate.selected_floors || [];
      const floorWiseItems = estimate.floor_wise_items || {};
      let otherFloorsCols = 0;
      let groundCols = 0;

      for (const floor of floors) {
        const fData = estimate.floor_details?.[floor];
        if (!fData) continue;

        const count = await getColumnsForFloor(fData.width, fData.length);
        if (floor === "GROUND FLOOR") {
          const isGroundFoundationSelected = floorWiseItems["GROUND FLOOR"] 
            ? (floorWiseItems["GROUND FLOOR"].includes("rcc_foundation") || floorWiseItems["GROUND FLOOR"].includes("earthwork"))
            : true;
          groundCols = isGroundFoundationSelected ? count * 2 : count;
        } else {
          otherFloorsCols += count;
        }
      }

      const finalTotal = groundCols + otherFloorsCols;
      
      if (isMounted && totalColumnNos !== finalTotal) {
        setTotalColumnNos(finalTotal);
      }
    }

    calculateDynamicColumns();

    return () => {
      isMounted = false;
    };
  }, [estimate, totalColumnNos]);

  useEffect(() => {
    const loadAndVerifyEstimateData = async () => {
      const data = localStorage.getItem(PREVIEW_STORAGE_KEY);
      if (!data) return;

      const estimateData = JSON.parse(data);
      let workingEstimate = { ...estimateData, id: estimateData.id || null };
      const forcedNew = !!workingEstimate.force_new_ref && !isRealRef(workingEstimate.ref_no);

      if (!forcedNew && (!workingEstimate.ref_no || workingEstimate.ref_no.startsWith("TEMP") || workingEstimate.ref_no.includes("REF-"))) {
        try {
          const { data: existingRecord } = await supabase
            .from("estimates")
            .select("*")
            .eq("customer_name", workingEstimate.customer_name)
            .eq("property_address", workingEstimate.property_address)
            .maybeSingle();

          if (existingRecord) {
            workingEstimate.id = existingRecord.id;
            workingEstimate.ref_no = existingRecord.ref_no;
            if (existingRecord.payment_status === 'paid' || existingRecord.status === 'paid') {
              setIsPaid(true);
              setIsAlreadyPaid(true);
            }
          }
        } catch (err) {}
      }

      setEstimate(workingEstimate);

      // ✅ NEW: Set state from estimate
      const resolvedState =
        workingEstimate.state_name ||
        workingEstimate.state ||
        workingEstimate.stateName ||
        currentUser?.state ||
        "MADHYA PRADESH";
      setEstimateStateName(resolvedState);

      const statusCheck = (workingEstimate.status || "").trim().toUpperCase();
      const paymentStatusCheck = (workingEstimate.payment_status || "").trim().toUpperCase();
      
      const isPaidFlag = 
        workingEstimate.isAlreadyPaid === true || 
        workingEstimate.is_paid === true ||
        statusCheck === "RECEIVED" || 
        statusCheck === "PAID" ||
        statusCheck === "SUCCESS" ||
        paymentStatusCheck === "PAID";

      if (isPaidFlag && !forcedNew) {
        setIsPaid(true);
        setIsAlreadyPaid(true);
      }
      
      if (workingEstimate.rate_per_sqft) {
        loadMasterItem(Number(workingEstimate.rate_per_sqft));
      }
    };

    loadAndVerifyEstimateData();
  }, []);

  useEffect(() => {
    if (estimate) {
      getGroundFloorPlotMaster(estimate).then((row) => {
        setSelectedPlotMaster(row);
      });
    }
  }, [estimate]);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (estimate?.id && !isPaid) {
        const { data } = await supabase
          .from('mis_records')
          .select('payment_status') 
          .eq('estimate_id', estimate.id) 
          .maybeSingle();
        
        if (data?.payment_status === 'paid') {
          setIsPaid(true);
          localStorage.setItem("payment_status", "paid");
        }
      }
    };
    checkPaymentStatus();
  }, [estimate?.id]);

  // Output protection: printing is only possible through the in-app button after payment,
  // and common capture shortcuts are blocked. Note: browsers cannot fully prevent OS-level screenshots
  // or screen recording, so these are deterrents; the DRAFT watermark and the withheld signature/QR
  // (until payment) are the actual protection.
  useEffect(() => {
    const paidView = isPaid || isAlreadyPaid || userCategory === 'ADMIN';
    const body = document.body;
    const isProd = process.env.NODE_ENV === 'production';

    const onKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || "").toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const isPrint = mod && key === 'p';
      const isCapture = key === 'printscreen' || (e.metaKey && e.shiftKey && key === 's');
      const isDevOrSave =
        isProd && (key === 'f12' || (mod && ['s', 'u'].includes(key)) || (mod && e.shiftKey && ['i', 'j', 'c'].includes(key)));
      if (isPrint || isCapture || isDevOrSave) {
        e.preventDefault();
        e.stopPropagation();
        if (key === 'printscreen') {
          try { navigator.clipboard?.writeText(""); } catch {}
        }
        if (isPrint) alert("System print is disabled. Please use the Print button on this page.");
      }
    };
    const blockEvent = (e: Event) => e.preventDefault();

    // Printing from the browser menu or any other route is locked unless it came from the Print button
    const onBeforePrint = () => {
      if (!(allowPrintRef.current && paidView)) body.classList.add("print-locked");
    };
    const onAfterPrint = () => {
      body.classList.remove("print-locked");
      allowPrintRef.current = false;
    };
    const mq = window.matchMedia ? window.matchMedia("print") : null;
    const onMq = (e: MediaQueryListEvent) => (e.matches ? onBeforePrint() : onAfterPrint());

    // Unpaid drafts are blurred whenever the window loses focus (typical for snipping / recording tools)
    const lock = () => body.classList.add("screen-guard");
    const unlock = () => {
      if (document.hasFocus() && !document.hidden) body.classList.remove("screen-guard");
    };
    const onVisibility = () => (document.hidden ? lock() : unlock());

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('contextmenu', blockEvent);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    mq?.addEventListener?.('change', onMq);
    if (!paidView) {
      window.addEventListener('blur', lock);
      window.addEventListener('focus', unlock);
      document.addEventListener('visibilitychange', onVisibility);
      document.addEventListener('copy', blockEvent);
      document.addEventListener('cut', blockEvent);
      document.addEventListener('dragstart', blockEvent);
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('contextmenu', blockEvent);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
      mq?.removeEventListener?.('change', onMq);
      window.removeEventListener('blur', lock);
      window.removeEventListener('focus', unlock);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('cut', blockEvent);
      document.removeEventListener('dragstart', blockEvent);
      body.classList.remove("print-locked", "screen-guard");
    };
  }, [isPaid, isAlreadyPaid, userCategory]);

  // Automatically clear the saved input data when the user leaves the form/preview flow (e.g. to the dashboard).
  // The data is preserved when navigating back to the input form (Back to Input / browser back).
  useEffect(() => {
    isMountedRef.current = true;
    const onPop = () => { goingToFormRef.current = true; };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      isMountedRef.current = false;
      setTimeout(() => {
        if (!isMountedRef.current && !goingToFormRef.current) clearFlowStorage();
      }, 0);
    };
  }, []);

  const loadMasterItem = async (selectedRate: number) => {
    const { data, error } = await supabase.from("master_items").select("*");
    if (error || !data) return;
    let nearest = data[0];
    data.forEach((row) => {
      if (Math.abs(row.rate_sqft - selectedRate) < Math.abs(nearest.rate_sqft - selectedRate)) {
        nearest = row;
      }
    });
    setMasterItem(nearest);
  };

  if (!estimate) return <div className="p-10">Loading...</div>;
  if (!masterItem) return <div className="p-10">Loading Master Items...</div>;

  const formatQty = (val: number) => Number(val || 0).toFixed(2);
  const getUnit = (unit: string | null | undefined) => (unit && unit.trim() !== "" ? unit : "LS");
  
  async function getGroundFloorPlotMaster(estimate: any) {
    const activeDetails = estimate?.floor_details || {};
    const selectedFloors = estimate?.selected_floors || [];

    const isGroundFloorSelected = selectedFloors.includes("GROUND FLOOR");
    const fallbackFloorKey = selectedFloors.filter((f: string) => f !== "TOWER")[0] || Object.keys(activeDetails)[0] || "GROUND FLOOR";
    
    const targetFloorKey = isGroundFloorSelected ? "GROUND FLOOR" : fallbackFloorKey;
    const availableDetailsKeys = Object.keys(activeDetails || {});
    
    const matchedDetailsKey = availableDetailsKeys.find(
      (k) => k.trim().toUpperCase().includes(targetFloorKey.toUpperCase())
    ) || targetFloorKey;

    const ground = activeDetails[matchedDetailsKey] || {};

    let rawWidth: any = 0;
    let rawLength: any = 0;

    if (typeof ground === 'object' && ground !== null) {
      const targetLayer = ground.proposed || ground;
      
      rawWidth = targetLayer.width ?? targetLayer.width_feet ?? targetLayer.length_x ?? targetLayer.val ?? 0;
      rawLength = targetLayer.length ?? targetLayer.length_feet ?? targetLayer.width_y ?? targetLayer.val ?? 0;
      
      if (typeof rawWidth === 'object') rawWidth = rawWidth.value ?? rawWidth.val ?? 0;
      if (typeof rawLength === 'object') rawLength = rawLength.value ?? rawLength.val ?? 0;
    } else if (typeof ground === 'string' || typeof ground === 'number') {
      const parts = String(ground).toLowerCase().split('x');
      if (parts.length >= 2) {
        rawWidth = parts[0];
        rawLength = parts[1];
      } else {
        rawWidth = ground;
      }
    }

    const inputWidth = parseFloat(String(rawWidth).replace(/[^0-9.]/g, '')) || 0;
    const inputLength = parseFloat(String(rawLength).replace(/[^0-9.]/g, '')) || 0;

    let width = inputWidth;
    let length = inputLength;

    if (!Number.isInteger(width)) width = Math.ceil(width);
    if (!Number.isInteger(length)) length = Math.ceil(length);

    if (width <= 0 || length <= 0) {
      width = 20; 
      length = 50; 
    }

    let { data } = await supabase
      .from("plot_master")
      .select("*")
      .eq("width_feet", width)
      .eq("length_feet", length)
      .limit(1);

    if (data && data.length > 0) return data[0];

    for (let l = length + 1; l <= 250; l++) {
      const { data } = await supabase
        .from("plot_master")
        .select("*")
        .eq("width_feet", width)
        .eq("length_feet", l)
        .limit(1);

      if (data && data.length > 0) return data[0];
    }

    for (let w = width + 1; w <= 250; w++) {
      for (let l = length; l <= 250; l++) {
        const { data } = await supabase
          .from("plot_master")
          .select("*")
          .eq("width_feet", w)
          .eq("length_feet", l)
          .limit(1);

        if (data && data.length > 0) return data[0];
      }
    }
    return null;
  }

  const gfLength = estimate.floor_details?.["GROUND FLOOR"]?.length || 0;
  const gfWidth = estimate.floor_details?.["GROUND FLOOR"]?.width || 0;

  const baseLintelLength = gfLength > 0 && gfWidth > 0 ? ((2 * ((gfLength / 3.28) + (gfWidth / 3.28))) * 1.8) : 0;
  const lintelWidth = 0.1;
  const lintelDepth = 0.15;

  const towerLintelLength = estimate.floor_details?.["TOWER"]?.length > 0 && estimate.floor_details?.["TOWER"]?.width > 0
    ? (2 * ((estimate.floor_details["TOWER"].length / 3.28) + (estimate.floor_details["TOWER"].width / 3.28))) * 1.8
    : 0;

  const lintelLength = baseLintelLength + towerLintelLength;
  const lintelNos = estimate.selected_floors?.length || 0;
  const lintelQty = lintelLength * lintelWidth * lintelDepth * lintelNos;

  const chajjaLength = 1.8;
  const chajjaWidth = 0.4;
  const chajjaDepth = 0.12;
  let chajjaNos = 0;

  estimate.selected_floors?.forEach((floor: string) => {
    if (floor === "TOWER") {
      chajjaNos += 1;
    } else {
      chajjaNos += 2;
    }
  });

  const chajjaQty = chajjaLength * chajjaWidth * chajjaDepth * chajjaNos;
  const stairNos = estimate.selected_floors?.filter((f: string) => f !== "TOWER").length || 0;

  const stairL = 10;
  const stairW = 1.1;
  const stairT = 0.12;
  const stairQty = stairL * stairW * stairT * stairNos;

  let totalSteelQty = 0;
  const floorWiseItems = estimate.floor_wise_items || {};

  estimate.selected_floors?.forEach((floor: string, index: number) => {
    const floorItems = floorWiseItems[floor] || estimate.selected_items || [];
    if (!floorItems.includes("reinforcement_steel")) return;

    const floorArea = Number(estimate.floor_details?.[floor]?.area || 0);
    let kgPerSqft = 3.6; 

    if (index >= 4) {
      kgPerSqft += (index - 3) * 0.3;
    }

    if (floorArea > 1500) {
      kgPerSqft += 0.2;
    }

   totalSteelQty += (floorArea * kgPerSqft);
  });

  const currentEstimate = estimate || { total_builtup_area: 0, selected_floors: [], floor_details: {}, rate_per_sqft: 0, total_value: 0, construction_cost: 0 };
  const currentMasterItem = masterItem || { reinforcement_steel_rate: 0, shuttering_rate: 0, preliminary_rate: 0, earthwork_rate: 0 };
  const currentPlotMaster = selectedPlotMaster || { footing_width_meter: 0, footing_length_meter: 0, footing_height_meter: 0, no_of_column: 0, footing_thickness_meter: 0, column_width_meter: 0, column_length_meter: 0, column_height: 0, beam_width_meter: 0, beam_depth_meter: 0, slab_thicknes: 0, plinth_slab_thicknes: 0 };

  const baseRate = Number(currentMasterItem.reinforcement_steel_rate || 0);
  const actualFloorsCount = currentEstimate.selected_floors?.filter((f: string) => f !== "TOWER").length || 1;
  const effectiveRate = actualFloorsCount > 4 ? (baseRate + (actualFloorsCount - 4)) : baseRate;
  
  const shutteringQty = Number(currentEstimate.total_builtup_area || 0) / 10.76;
  const baseShutterRate = Number(currentMasterItem.shuttering_rate || 0);
  const totalFloorCount = currentEstimate.selected_floors?.length || 1;

  let shutteringRate = baseShutterRate;

  if (totalFloorCount > 3) {
    const floorsToApply30 = Math.min(totalFloorCount - 3, 3);
    shutteringRate += (floorsToApply30 * 30);
    
    if (totalFloorCount > 6) {
      shutteringRate += ((totalFloorCount - 6) * 10);
    }
  }
  
  const builtupAreaSqFt = Number(estimate.total_builtup_area || 0);
  const builtupAreaSqMt = builtupAreaSqFt / 10.76;

  const floorCount = estimate.selected_floors?.length || 1;
  const hasTower = estimate.selected_floors?.includes("TOWER");

  let brickMultiplier = 0.92;
  if (builtupAreaSqFt >= 200 && builtupAreaSqFt <= 600) brickMultiplier = 0.82;
  else if (builtupAreaSqFt <= 1000) brickMultiplier = 0.85;
  else if (builtupAreaSqFt <= 1500) brickMultiplier = 0.88;
  else if (builtupAreaSqFt <= 2000) brickMultiplier = 0.90;

  const wallLengthRm = builtupAreaSqMt * 0.9;
  const brickQtyCum = (wallLengthRm * 2.7 * 0.15 * brickMultiplier) * 1.05;

  const internalPlasterQty = builtupAreaSqMt * 3.35;
  const externalPlasterQty = builtupAreaSqMt * 3;

  let totalDoorWindowNos = 0;

  estimate.selected_floors?.forEach((floor: string) => {
      if (floor === "TOWER") {
          totalDoorWindowNos += 1;
      } else {
          const floorArea = Number(estimate.floor_details?.[floor]?.area || 0);
          let count = 0;

          if (floorArea < 500) count = 2;
          else if (floorArea >= 500 && floorArea <= 750) count = 4;
          else if (floorArea >= 751 && floorArea <= 800) count = 5;
          else if (floorArea >= 801 && floorArea <= 1000) count = 6;
          else if (floorArea >= 1001 && floorArea <= 1250) count = 7;
          else if (floorArea >= 1251 && floorArea <= 1500) count = 8;
          else if (floorArea >= 1501 && floorArea <= 1800) count = 9;
          else if (floorArea > 1800) {
              const extra = Math.floor((floorArea - 1801) / 1000) + 1;
              count = 9 + extra;
          }
          totalDoorWindowNos += count;
      }
  });

  const doorFrameNos = totalDoorWindowNos;
  const doorFrameQty = totalDoorWindowNos;
  const paintQtySqMt = builtupAreaSqMt;
  const msSteelQty = Number(estimate.total_value || 0) * 0.05;

  const ratePerSqft = Number(estimate.rate_per_sqft || 0);
  let plumbingElectricPercent = 0.05;

  if (ratePerSqft >= 1000 && ratePerSqft <= 1200) plumbingElectricPercent = 0.05;
  else if (ratePerSqft >= 1201 && ratePerSqft <= 1400) plumbingElectricPercent = 0.06;
  else if (ratePerSqft >= 1401 && ratePerSqft <= 1600) plumbingElectricPercent = 0.075;
  else if (ratePerSqft >= 1601 && ratePerSqft <= 1800) plumbingElectricPercent = 0.08;
  else if (ratePerSqft >= 1801 && ratePerSqft <= 2100) plumbingElectricPercent = 0.09;
  else if (ratePerSqft > 2100) plumbingElectricPercent = 0.10;

  const displayPercent = Number((plumbingElectricPercent * 100).toFixed(2)).toString() + "%";
  const totalBuiltupSqFt = Number(estimate.total_builtup_area || 0);
  const totalBuiltupSqm = totalBuiltupSqFt / 10.76;

  const spm = selectedPlotMaster || { 
    footing_width_meter: 0, footing_length_meter: 0, footing_height_meter: 0, 
    no_of_column: 0, footing_thickness_meter: 0, column_width_meter: 0, 
    column_length_meter: 0, column_height: 0 
  };
  const est = estimate || { floor_details: {} };

  const earthworkQty = 
    (Number(spm.footing_width_meter || 0) + 0.6) * 
    (Number(spm.footing_length_meter || 0) + 0.6) * 
    (Number(spm.footing_height_meter || 0) + 0.6) * 
    Number(spm.no_of_column || 0);

  const pccThickness = 0.2; 
  const pccQty = (
    parseFloat(String(spm.footing_length_meter || 0)) *
    parseFloat(String(spm.footing_width_meter || 0)) *
    pccThickness *
    parseFloat(String(spm.no_of_column || 0))
  );

  const rccFootingQty = Number(spm.footing_width_meter || 0) * Number(spm.footing_length_meter || 0) * Number(spm.footing_thickness_meter || 0) * Number(spm.no_of_column || 0);
  const columnQty = Number(spm.column_width_meter || 0) * Number(spm.column_length_meter || 0) * Number(spm.column_height || 0) * Number(spm.no_of_column || 0);
  
  const gf = est.floor_details?.["GROUND FLOOR"];
  const plinthLength = gf ? (2 * ((Number(gf.length || 0) / 3.28) + (Number(gf.width || 0) / 3.28))) * 1.8 : 0;
  const plinthBeamQty = plinthLength * 0.20 * 0.30;

  const floors = est.selected_floors || [];
  let totalRoofBeamLength = 0;

  for (const floor of floors) {
    const fData = est.floor_details?.[floor];
    if (fData) {
      const floorBeamLen = (2 * ((Number(fData.length || 0) / 3.28) + (Number(fData.width || 0) / 3.28))) * 1.8;
      totalRoofBeamLength += floorBeamLen;
    }
  }
  const roofBeamQty = totalRoofBeamLength * 0.20 * 0.30;

  const totalAreaSqMt = Number(est.total_builtup_area || 0) / 10.76;
  const gfAreaSqMt = Number(est.floor_details?.["GROUND FLOOR"]?.area || 0) / 10.76;
  const slabThick = Number(spm.slab_thicknes || 0);
  const plinthThick = Number(spm.plinth_slab_thicknes || 0);
  const slabQty = (totalAreaSqMt * slabThick) + (gfAreaSqMt * plinthThick);

  const floorOrder: { [key: string]: number } = {
    "GROUND FLOOR": 1, "FIRST FLOOR": 2, "SECOND FLOOR": 3,
    "THIRD FLOOR": 4, "FOURTH FLOOR": 5, "FIFTH FLOOR": 6,
    "SIXTH FLOOR": 7, "SEVENTH FLOOR": 8, "EIGHTH FLOOR": 9,
  };

  const sortedFloors = [...(est.selected_floors || [])].sort((a, b) => {
    return (floorOrder[a] || 100) - (floorOrder[b] || 100);
  });

  const rate = ratePerSqft; 
  const selectedFloors = estimate.selected_floors || [];

  const isOnlyGroundAndTower = selectedFloors.every(f => f === "GROUND FLOOR" || f === "TOWER");
  const hasUpperFloors = selectedFloors.some(f => f !== "GROUND FLOOR" && f !== "TOWER");
  const isRateAbove1450 = rate > 1450;
  const isRateInRange = rate > 1550 && rate < 1900;
  const shouldHideParapet = isRateInRange && isOnlyGroundAndTower;

  const gfL = Number(estimate.floor_details?.["GROUND FLOOR"]?.length || 0) / 3.28;
  const gfW = Number(estimate.floor_details?.["GROUND FLOOR"]?.width || 0) / 3.28;

  const lastFloorName = estimate.selected_floors?.filter((f: string) => f !== "TOWER").slice(-1)[0] || "GROUND FLOOR";
  const lfL = Number(estimate.floor_details?.[lastFloorName]?.length || 0) / 3.28;
  const lfW = Number(estimate.floor_details?.[lastFloorName]?.width || 0) / 3.28;

  const maxL = Math.max(gfL, lfL);
  const maxW = Math.max(gfW, lfW);

  const parapetQtyRM = shouldHideParapet ? 0 : (2 * (maxL + maxW));
  const parapetRate = Number(masterItem.parapet_wall_rate || 0);

  let cobaQty = 0;
  const shouldShowCoba = isRateAbove1450 && hasUpperFloors && !shouldHideParapet;

  if (shouldShowCoba) {
    const getFloorArea = (floorKey: string) => {
      const fObj = estimate.floor_details?.[floorKey];
      if (!fObj) return 0;
      const rawArea = fObj.area ?? fObj.builtup_area ?? fObj.sqft ?? fObj.total_area ?? 0;
      const parsed = parseFloat(String(rawArea).replace(/[^0-9.]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    };

    const gfArea = getFloorArea("GROUND FLOOR");
    const lfArea = getFloorArea(lastFloorName);
    let maxArea = Math.max(gfArea, lfArea);

    if (maxArea <= 0 && maxL > 0 && maxW > 0) {
      maxArea = maxL * maxW * 10.76; 
    }

    if (maxArea > 0) {
      cobaQty = maxArea / 10.76;
    }
  }

  const cobaRate = Number(masterItem.terrace_coba_rate || 0);
  const isGroundFloorSelected = selectedFloors ? selectedFloors.includes("GROUND FLOOR") : true;

  const getSafeFloorDim = (floorName: string, dimType: string) => {
    const val = estimate.floor_details?.[floorName]?.[dimType];
    const num = Number(val);
    return isNaN(num) || num <= 0 ? 0 : num / 3.28;
  };

  const groundLenMtr = getSafeFloorDim("GROUND FLOOR", "length");
  const groundWidMtr = getSafeFloorDim("GROUND FLOOR", "width");

  const selectedItems = estimate.selected_items || [
    "preliminary", "earthwork", "pcc_foundation", "anti_termite", "rcc_foundation", 
    "rcc_column", "plinth_beam", "roof_beam", "rcc_slab", "rcc_lintel", "rcc_chajja", 
    "rcc_staircase", "reinforcement_steel", "shuttering", "brickwork", 
    "internal_plaster", "external_plaster", "parapet_wall", "terrace_coba",
    "door_frame_desc", "paint_putty_desc", "ms_steel_desc", "plumbing_desc", 
    "electrical_desc", "flooring_desc", "false_ceiling_desc", "modular_kitchen_desc", 
    "water_tank_desc", "full_home_furnishing_desc", "modern_elevation_desc", 
    "deep_boring_desc", "final_finishing_desc", "lift_installation_desc", "consultant_fee_desc"
  ];

  const coreItems = [
    { 
      id: "preliminary",
      description: masterItem.preliminary_desc || "Preliminary Work", 
      l: formatQty(groundLenMtr), 
      w: formatQty(groundWidMtr), 
      ht: "-", 
      nos: 1, 
      qty: formatQty(groundLenMtr * groundWidMtr), 
      unit: getUnit(masterItem.preliminary_unit), 
      rate: masterItem.preliminary_rate 
    },
    { 
      id: "earthwork",
      description: masterItem.earthwork_desc, 
      l: isGroundFloorSelected ? (selectedPlotMaster?.footing_length_meter || 0) : 0, 
      w: isGroundFloorSelected ? (selectedPlotMaster?.footing_width_meter || 0) : 0, 
      ht: isGroundFloorSelected ? (selectedPlotMaster?.footing_height_meter || 0) : 0, 
      nos: isGroundFloorSelected ? (selectedPlotMaster?.no_of_column || 0) : 0, 
      qty: isGroundFloorSelected ? Number(earthworkQty || 0).toFixed(2) : "0.00", 
      unit: "CUM", 
      rate: masterItem.earthwork_rate 
    },
    { 
      id: "pcc_foundation",
      description: masterItem.pcc_foundation_desc, 
      l: isGroundFloorSelected ? (selectedPlotMaster?.footing_length_meter || 0) : 0, 
      w: isGroundFloorSelected ? (selectedPlotMaster?.footing_width_meter || 0) : 0, 
      ht: isGroundFloorSelected ? "0.2" : 0, 
      nos: isGroundFloorSelected ? (selectedPlotMaster?.no_of_column || 0) : 0, 
      qty: isGroundFloorSelected ? Number(pccQty || 0).toFixed(2) : "0.00", 
      unit: "CUM", 
      rate: masterItem.pcc_foundation_rate 
    },
    { 
      id: "anti_termite",
      description: masterItem.anti_termite_desc, 
      l: isGroundFloorSelected ? groundLenMtr.toFixed(2) : 0, 
      w: isGroundFloorSelected ? groundWidMtr.toFixed(2) : 0, 
      ht: "-", 
      nos: isGroundFloorSelected ? 1 : 0, 
      qty: isGroundFloorSelected ? (groundLenMtr * groundWidMtr).toFixed(2) : "0.00", 
      unit: getUnit(masterItem.anti_termite_unit), 
      rate: masterItem.anti_termite_rate 
    },
    { 
      id: "rcc_foundation",
      description: masterItem.rcc_foundation_desc, 
      l: isGroundFloorSelected ? (selectedPlotMaster?.footing_length_meter || 0) : 0, 
      w: isGroundFloorSelected ? (selectedPlotMaster?.footing_width_meter || 0) : 0, 
      ht: isGroundFloorSelected ? (selectedPlotMaster?.footing_thickness_meter || 0) : 0, 
      nos: isGroundFloorSelected ? (selectedPlotMaster?.no_of_column || 0) : 0, 
      qty: isGroundFloorSelected ? Number(rccFootingQty || 0).toFixed(2) : "0.00", 
      unit: "CUM", 
      rate: masterItem.rcc_foundation_rate 
    },
    { 
      id: "rcc_column",
      description: masterItem.rcc_column_desc, 
      l: selectedPlotMaster?.column_width_meter || 0, 
      w: selectedPlotMaster?.column_length_meter || 0, 
      ht: (floorWiseItems["GROUND FLOOR"] ? (floorWiseItems["GROUND FLOOR"].includes("rcc_foundation") || floorWiseItems["GROUND FLOOR"].includes("earthwork")) : (selectedItems.includes("rcc_foundation") || selectedItems.includes("earthwork")))
          ? (Number(selectedPlotMaster?.column_height || 0) + Number(selectedPlotMaster?.footing_depth_meter || 0)) 
          : Number(selectedPlotMaster?.column_height || 0), 
      nos: totalColumnNos, 
      qty: (
        Number(selectedPlotMaster?.column_width_meter || 0) * 
        Number(selectedPlotMaster?.column_length_meter || 0) * 
        ((floorWiseItems["GROUND FLOOR"] ? (floorWiseItems["GROUND FLOOR"].includes("rcc_foundation") || floorWiseItems["GROUND FLOOR"].includes("earthwork")) : (selectedItems.includes("rcc_foundation") || selectedItems.includes("earthwork")))
          ? (Number(selectedPlotMaster?.column_height || 0) + Number(selectedPlotMaster?.footing_depth_meter || 0)) 
          : Number(selectedPlotMaster?.column_height || 0)) * 
        totalColumnNos
      ).toFixed(2), 
      unit: "CUM", 
      rate: masterItem.rcc_column_rate 
    },
    { 
      id: "plinth_beam",
      description: masterItem.plinth_beam_desc, 
      l: isGroundFloorSelected ? plinthLength.toFixed(2) : 0, 
      w: isGroundFloorSelected ? Number(selectedPlotMaster?.beam_width_meter || 0).toFixed(2) : 0, 
      ht: isGroundFloorSelected ? Number(selectedPlotMaster?.beam_depth_meter || 0).toFixed(2) : 0, 
      nos: isGroundFloorSelected ? 1 : 0, 
      qty: isGroundFloorSelected ? Number(plinthBeamQty || 0).toFixed(2) : "0.00", 
      unit: "CUM", 
      rate: masterItem.plinth_beam_rate 
    },
    { 
      id: "roof_beam",
      description: masterItem.roof_beam_desc, 
      l: totalRoofBeamLength.toFixed(2), 
      w: Number(selectedPlotMaster?.beam_width_meter || 0).toFixed(2), 
      ht: Number(selectedPlotMaster?.beam_depth_meter || 0).toFixed(2), 
      nos: 1, 
      qty: Number(roofBeamQty || 0).toFixed(2), 
      unit: "CUM", 
      rate: masterItem.roof_beam_rate 
    },
    { 
      id: "rcc_slab",
      description: masterItem.rcc_slab_desc, 
      l: "-", w: "-", ht: "-", nos: "-", 
      qty: Number(slabQty || 0).toFixed(2), 
      unit: "CUM", 
      rate: masterItem.rcc_slab_rate 
    },
    { 
      id: "rcc_lintel",
      description: masterItem.rcc_lintel_desc, 
      l: lintelLength.toFixed(2), 
      w: lintelWidth, 
      ht: lintelDepth, 
      nos: lintelNos, 
      qty: Number(lintelQty || 0).toFixed(2), 
      unit: "CUM", 
      rate: masterItem.rcc_lintel_rate 
    },
    { 
      id: "rcc_chajja",
      description: masterItem.rcc_chajja_desc, 
      l: chajjaLength, 
      w: chajjaWidth, 
      ht: chajjaDepth, 
      nos: chajjaNos, 
      qty: Number(chajjaQty || 0).toFixed(2), 
      unit: "CUM", 
      rate: masterItem.rcc_chajja_rate 
    },
    { 
      id: "rcc_staircase",
      description: masterItem.rcc_staircase_desc, 
      l: stairL.toFixed(2), 
      w: stairW.toFixed(2), 
      ht: stairT.toFixed(2), 
      nos: stairNos, 
      qty: Number(stairQty || 0).toFixed(2), 
      unit: getUnit(masterItem.rcc_staircase_unit), 
      rate: masterItem.rcc_staircase_rate 
    },
    { 
      id: "reinforcement_steel",
      description: masterItem.reinforcement_steel_desc, 
      l: "-", w: "-", ht: "-", 
      nos: 1, 
      qty: Number(totalSteelQty || 0).toFixed(2), 
      unit: getUnit(masterItem.reinforcement_steel_unit), 
      rate: effectiveRate.toFixed(2) 
    },
    { 
      id: "shuttering",
      description: masterItem.shuttering_desc, 
      l: "-", w: "-", ht: "-", 
      nos: 1, 
      qty: Number(shutteringQty || 0).toFixed(2), 
      unit: "SQ.MT", 
      rate: shutteringRate.toFixed(2) 
    },
    { 
      id: "brickwork",
      description: masterItem.brickwork_desc, 
      l: "-", w: "-", 
      ht: "2.7", 
      nos: "1", 
      qty: Number(brickQtyCum || 0).toFixed(2), 
      unit: "CUM", 
      rate: masterItem.brickwork_rate 
    },
    { 
      id: "internal_plaster",
      description: masterItem.internal_plaster_desc, 
      l: "-", w: "-", ht: "-", 
      nos: 1, 
      qty: Number(internalPlasterQty || 0).toFixed(2), 
      unit: getUnit(masterItem.internal_plaster_unit), 
      rate: masterItem.internal_plaster_rate 
    },
    { 
      id: "external_plaster",
      description: masterItem.external_plaster_desc, 
      l: "-", w: "-", ht: "-", 
      nos: 1, 
      qty: Number(externalPlasterQty || 0).toFixed(2), 
      unit: getUnit(masterItem.external_plaster_unit), 
      rate: masterItem.external_plaster_rate 
    },
    { 
      id: "parapet_wall",
      description: masterItem.parapet_wall_desc || "Parapet Wall", 
      l: shouldHideParapet ? "0" : maxL.toFixed(2), 
      w: shouldHideParapet ? "0" : maxW.toFixed(2), 
      ht: "-", 
      nos: 1, 
      qty: parapetQtyRM.toFixed(2), 
      unit: "RM", 
      rate: parapetRate 
    },
    { 
      id: "terrace_coba",
      description: masterItem.terrace_coba_desc || "Terrace Coba", 
      l: "-", w: "-", ht: "-", 
      nos: 1, 
      qty: cobaQty.toFixed(2), 
      unit: "SQM", 
      rate: cobaRate.toFixed(0) 
    },
  ];

  const isItemSelected = (itemId: string) => {
    if (floorWiseItems && Object.keys(floorWiseItems).length > 0) {
      return sortedFloors.some((floor: string) => {
        const itemsOnFloor = floorWiseItems[floor];
        return itemsOnFloor ? itemsOnFloor.includes(itemId) : selectedItems.includes(itemId);
      });
    }
    return selectedItems.includes(itemId);
  };

  const coreItemsWithAmount = coreItems.map(item => {
    const isSelected = isItemSelected(item.id);
    const calculatedQty = isSelected ? Number(item.qty || 0) : 0;
    const rate = Number(item.rate || 0);
    const totalAmount = calculatedQty * rate;
    
    return {
      ...item,
      qty: calculatedQty,
      hidden: !isSelected,
      totalAmount: totalAmount
    };
  });

  const coreTotal = coreItemsWithAmount.reduce((sum, row) => sum + row.totalAmount, 0);
  const rawBaseValue = Number(estimate.total_value || estimate.construction_cost || 0);
  const remainingBudget = Math.max(0, isNaN(rawBaseValue - coreTotal) ? 0 : rawBaseValue - coreTotal);

  const slabRates = Object.keys(slabConfig).map(Number).sort((a, b) => a - b);
  const activeSlab = slabRates.find(s => rate <= s) || 5000;
  const w = slabConfig[activeSlab];
  const isGroundFloorOnly = selectedFloors.length === 1 && selectedFloors.includes("GROUND FLOOR");
  const isLiftHidden = rate >= 2700 && isGroundFloorOnly;
  const baseLiftWeight = w.lift || 0;
  const liftWeightToDistribute = isLiftHidden ? baseLiftWeight : 0;

  const finalLiftWeight = isLiftHidden ? 0 : baseLiftWeight;
  const finalKitchenWeight = (w.kitchen || 0) + (liftWeightToDistribute * 0.25);
  const finalBoreWeight = (w.bore || 0) + (liftWeightToDistribute * 0.15);
  const finalWaterWeight = (w.water || 0) + (liftWeightToDistribute * 0.20);
  const finalFurnishWeight = (w.furnish || 0) + (liftWeightToDistribute * 0.40);

  const finalW = {
    ...w,
    kitchen: finalKitchenWeight,
    bore: finalBoreWeight,
    water: finalWaterWeight,
    furnish: finalFurnishWeight,
    lift: finalLiftWeight
  };

  const allEstimateRows = [
    ...coreItemsWithAmount,
    { id: "door_frame_desc", description: masterItem.door_frame_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.door || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("door_frame_desc") },
    { id: "paint_putty_desc", description: masterItem.paint_putty_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.paint || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("paint_putty_desc") },
    { id: "ms_steel_desc", description: masterItem.ms_steel_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.ms || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("ms_steel_desc") },
    { id: "plumbing_desc", description: masterItem.plumbing_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.plumb || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("plumbing_desc") },
    { id: "electrical_desc", description: masterItem.electrical_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.elec || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("electrical_desc") },
    { id: "flooring_desc", description: masterItem.flooring_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.floor || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("flooring_desc") },
    { id: "false_ceiling_desc", description: masterItem.false_ceiling_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.ceiling || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("false_ceiling_desc") },
    { id: "modular_kitchen_desc", description: masterItem.modular_kitchen_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.kitchen || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("modular_kitchen_desc") },
    { id: "water_tank_desc", description: masterItem.water_tank_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.water || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("water_tank_desc") },
    { id: "full_home_furnishing_desc", description: masterItem.full_home_furnishing_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.furnish || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("full_home_furnishing_desc") },
    { id: "modern_elevation_desc", description: masterItem.modern_elevation_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.elev || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("modern_elevation_desc") },
    { id: "deep_boring_desc", description: masterItem.deep_boring_desc, l: "-", w: "-", ht: "-", nos: "-", qty: isItemSelected("deep_boring_desc") ? 1 : 0, unit: "LS", rate: ((finalW.bore || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("deep_boring_desc") },
    { id: "final_finishing_desc", description: masterItem.final_finishing_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.final || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("final_finishing_desc") },
    { 
      id: "lift_installation_desc", 
      description: masterItem.lift_installation_desc, 
      l: "-", w: "-", ht: "-", nos: "-", qty: (isItemSelected("lift_installation_desc") && !isLiftHidden) ? 1 : 0, unit: "LS", 
      rate: ((finalW.lift || 0) * 100).toFixed(1) + "%",
      hidden: isLiftHidden || !isItemSelected("lift_installation_desc")
    },
    { id: "consultant_fee_desc", description: masterItem.consultant_fee_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.cons || 0) * 100).toFixed(1) + "%", hidden: !isItemSelected("consultant_fee_desc") },
  ];

  const estimateRows = allEstimateRows.filter(row => {
    const shouldKeep = isItemSelected(row.id) && !row.hidden;
    return shouldKeep;
  });

  if (isCheckingHistory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold tracking-wide uppercase">Validating Estimate History...</p>
      </div>
    );
  }

 return (
    <div ref={printRef} className={`print-area print-page p-10 bg-white min-h-screen relative ${(!isPaid && !isAlreadyPaid && userCategory !== 'ADMIN') ? "is-draft" : ""}`}>
      
<style jsx global>{`
  @media print {
    @page {
      size: A4 portrait;
      size: 210mm 297mm;
      margin: 10mm 12mm 14mm 12mm;
      @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #444;
      }
    }

    body * {
      visibility: hidden !important;
    }

    .print-area, .print-area * {
      visibility: visible !important;
    }

    .print-area {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      box-shadow: none !important;
      border: none !important;
    }

    body, html, #__next, main {
      background: #ffffff !important;
      color: #000000 !important;
      overflow: visible !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .no-print, nav, aside, header, footer, button {
      display: none !important;
    }

    thead {
      display: table-row-group !important;
    }

    .report-header h1, .report-header h2, .company-title, .report-title {
      font-size: 9px !important;
      font-weight: bold !important;
    }

    .company-details, .header-text, .report-header, .header-container, .letterhead, .letterhead * {
      font-size: 10px !important;
      line-height: 1.15 !important;
    }

    .ref-date-container, .ref-no, .ref-number, .report-date, .date-container, .ref-section, .ref-details, .ref-details * {
      font-size: 9.5px !important;
      font-weight: bold !important;
    }

    .customer-details, .customer-details * {
      font-size: 10px !important;
      text-align: left !important;
    }

    table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: 10.5px !important; 
      margin-bottom: 6px !important;
    }

    th {
      font-weight: bold !important;
      background-color: #f3f4f6 !important;
      white-space: nowrap !important;
      word-break: normal !important;
      padding: 4px 2px !important;
      font-size: 10px !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    td {
      padding: 3px 2px !important;
      line-height: 1.2 !important;
      vertical-align: top !important;
    }

    table:not(.estimate-table) {
      table-layout: auto !important;
    }

    table.estimate-table {
      table-layout: fixed !important;
      width: 100% !important;
    }

    table.estimate-table th:nth-child(1), table.estimate-table td:nth-child(1) { width: 3.5% !important; text-align: center !important; }
    table.estimate-table th:nth-child(2), table.estimate-table td:nth-child(2) { width: 38.5% !important; text-align: left !important; word-break: break-word !important; }
    table.estimate-table th:nth-child(3), table.estimate-table td:nth-child(3) { width: 4% !important; text-align: center !important; white-space: nowrap !important; }
    table.estimate-table th:nth-child(4), table.estimate-table td:nth-child(4) { width: 8.5% !important; text-align: right !important; white-space: nowrap !important; }
    table.estimate-table th:nth-child(5), table.estimate-table td:nth-child(5) { width: 5.5% !important; text-align: center !important; white-space: nowrap !important; }
    table.estimate-table th:nth-child(6), table.estimate-table td:nth-child(6) { width: 14% !important; text-align: right !important; white-space: nowrap !important; }
    
    table.estimate-table th:nth-child(7), 
    table.estimate-table td:nth-child(7),
    table.estimate-table tfoot td,
    table.estimate-table tr.total-row td,
    table.estimate-table tr:last-child td { 
      width: 26% !important; 
      text-align: right !important; 
      white-space: nowrap !important; 
      word-break: keep-all !important;
      font-weight: bold !important; 
      font-size: 10px !important;
    }

    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* If the disclaimer/signature block does not fit on the page, move it to the next page as a whole,
       together with the last rows of the estimate table, leaving a little spacing above it */
    .keep-together {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin-top: 8mm !important;
    }
    table.tail-keep {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    table.tail-keep tbody tr:nth-last-child(-n+4) {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    .disclaimer-container, .disclaimer-section, .terms-container {
      width: 100% !important;
      margin-top: 6px !important;
    }

    .disclaimer-title, .terms-heading {
      font-size: 8px !important;
      font-weight: bold !important;
    }

    .disclaimer-text, .terms-text, .disclaimer-container p {
      font-size: 8px !important;
      line-height: 1.2 !important;
      text-align: justify !important;
    }

    .draft-watermark {
      display: block !important;
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) rotate(-45deg) !important;
      color: rgba(220, 38, 38, 0.08) !important;
      z-index: 9999 !important;
    }
  }

  .draft-watermark {
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) rotate(-45deg) !important;
    font-size: 8rem !important;
    font-weight: 900 !important;
    color: rgba(220, 38, 38, 0.08) !important;
    pointer-events: none !important;
    white-space: nowrap !important;
    z-index: 9999 !important;
    text-transform: uppercase !important;
    letter-spacing: 1rem !important;
  }

  /* Defensive rules for the output-protection classes toggled by the page script */
  @media print {
    body.print-locked * { visibility: hidden !important; }
  }
  body.screen-guard .print-area { filter: blur(14px); }
`}</style>

      {(!isPaid && !isAlreadyPaid && userCategory !== 'ADMIN') && (
        <div className="draft-watermark no-print">DRAFT</div>
      )}

      {justPaid && estimate?.ref_no && (
        <div className="mb-6 p-4 border-2 border-emerald-500 bg-emerald-50 rounded-lg text-left no-print">
          <p className="font-bold uppercase text-xs tracking-wider text-emerald-800 mb-1">✅ Payment Successful</p>
          <p className="text-sm font-medium text-emerald-900">
            Ref No: <span className="font-mono font-bold">{estimate.ref_no}</span>
          </p>
          <p className="text-xs text-emerald-800 mt-1">Ab aap niche se Print, PDF Download ya Share kar sakte hain.</p>
        </div>
      )}

      {['ENGINEER', 'ARCHITECT'].includes(userCategory) && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-left no-print shadow-sm font-sans">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="letterheadToggle"
              checked={useCustomLetterhead}
              onChange={(e) => setUseCustomLetterhead(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="letterheadToggle" className="text-xs font-bold text-slate-700 cursor-pointer select-none uppercase tracking-wider">
              Activate Custom Letterhead Mode (For Rented Engineers/Architects)
            </label>
          </div>
          {useCustomLetterhead && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 mt-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Custom Header Title</label>
                <input
                  type="text"
                  placeholder="e.g., VERMA & ASSOCIATES"
                  value={customHeaderTitle}
                  onChange={(e) => setCustomHeaderTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-black font-medium"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Custom Subtitle / Designations</label>
                <input
                  type="text"
                  placeholder="e.g., Chartered Engineer & Govt. Approved Valuer"
                  value={customSubtitle}
                  onChange={(e) => setCustomSubtitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-black font-medium"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {validationReason && (
        <div className={`mb-6 p-4 border text-left no-print ${requiresPayment ? "bg-amber-50 border-amber-500 text-amber-900" : "bg-emerald-50 border-emerald-500 text-emerald-900"}`}>
          <p className="font-bold uppercase text-xs tracking-wider mb-1">📋 System Audit Status</p>
          <p className="text-sm font-medium">{validationReason}</p>
        </div>
      )}

      <div className="mb-6 border-b-2 border-black pb-4">
        <div className="grid items-center" style={{ gridTemplateColumns: "1fr auto 1.7fr", columnGap: "8px" }}>
          <div className="text-[12px] uppercase font-bold text-slate-700">
            {useCustomLetterhead ? (
              <p className="text-xl text-black font-bold uppercase">{customHeaderTitle || "ENTER HEADER TITLE"}</p>
            ) : (
              <>
                <p>T&CP 23IND-IER050924212</p>
              </>
            )}
          </div>

          <div key={useCustomLetterhead ? "custom" : "default"} className="flex justify-center items-center">
            {useCustomLetterhead ? (
              <div className="relative group cursor-pointer border border-dashed border-gray-400 p-2 rounded transition-all hover:bg-gray-50 h-24 w-40 flex items-center justify-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="Custom Logo" className="h-20 w-auto object-contain" />
                ) : (
                  <div className="text-center text-[10px] text-gray-500 font-bold uppercase">Insert Logo</div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const base64 = reader.result as string;
                        setLogoUrl(base64);
                        localStorage.setItem("customLogo", base64);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>
            ) : (
              <img src="/logo.jpg" alt="Logo" className="h-24 w-auto object-contain" />
            )}
          </div>

          <div className="text-[12px] text-right font-bold text-slate-700 whitespace-nowrap">
            {useCustomLetterhead ? (
              <p className="text-sm text-black font-medium uppercase">{customSubtitle || "ENTER DESIGNATION"}</p>
            ) : (
              <>
                <p>203, MAYUR COMPLEX, 49 SUTAR GALI,</p>
        <p>JAIL ROAD, INDORE (M.P)</p>
        <p>CONTACT NO. 8103804355 / 79875-61396 </p>
        <p>Gmail: legalntech@gmail.com</p>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 text-[15px] text-center font-bold text-slate-600 uppercase leading-relaxed border-t pt-2">
          {useCustomLetterhead ? (
            <textarea
              value={legalText}
              onChange={(e) => setLegalText(e.target.value)}
              className="w-full text-sm border-none focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none text-center bg-white"
              rows={3}
            />
          ) : (
            // Static text for the default letterhead: always centered, in the UI, print and PDF
            <div className="w-full text-sm text-center whitespace-pre-wrap">{legalText}</div>
          )}
          <hr className="w-full border border-black border-collapse mb-4"/>
        </div>
        <div className="flex justify-between items-center text-sm mt-2 px-1 font-semibold">
          <span className="font-semibold">
            <strong>REF NO:</strong>{" "}
            <span className="font-mono font-bold text-slate-800">
              {(() => {
                if ((isPaid || isAlreadyPaid || userCategory === 'ADMIN') && isRealRef(estimate?.ref_no)) {
                  return estimate.ref_no;
                }
                return "DRAFT";
              })()}
            </span>
          </span>
          <span>DATE: {new Date().toLocaleDateString('en-IN')}</span>
        </div>
      </div>

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold uppercase text-center">
          PROPOSED CONSTRUCTION ESTIMATE FOR REMAINING WORK ON {sortedFloors.join(" + ")}
        </h2>
      </div>

      <table className="w-full border-collapse mb-6">
        <tbody>
          <tr>
            <td className="font-bold w-[250px] py-1">CUSTOMER NAME</td>
            <td className="font-bold w-[20px]">:</td>
            <td className="uppercase">{estimate.customer_name}</td>
          </tr>
          <tr>
            <td className="font-bold py-1">PROPERTY ADDRESS</td>
            <td className="font-bold">:</td>
            <td className="uppercase">{estimate.property_address}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border border-black border-collapse mb-4">
        <tbody>
          <tr>
            <td className="border border-black p-2 font-bold w-[80%]">PLOT AREA</td>
            <td className="border border-black p-2 text-center font-bold">
              {estimate.plot_area} {estimate.plot_unit || "SQ.FT"}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border border-black border-collapse mb-6">
        <thead>
          <tr>
            <th className="border border-black p-2 w-[80px]">SR</th>
            <th className="border border-black p-2">DESCRIPTION</th>
            <th className="border border-black p-2 w-[180px]">AREA</th>
          </tr>
        </thead>
        <tbody>
          {sortedFloors.map((floor: string, index: number) => (
            <tr key={floor}>
              <td className="border border-black p-2 text-center">{index + 1}</td>
              <td className="border border-black p-2">{floor} BUILT UP AREA</td>
              <td className="border border-black p-2 text-center">
                {estimate.floor_details?.[floor]?.area || 0} SQ.FT
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="border border-black p-2 font-bold">TOTAL BUILT UP AREA</td>
            <td className="border border-black p-2 text-center font-bold">{estimate.total_builtup_area} SQ.FT</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-t border-b border-black mb-4">
        <tbody>
          <tr>
            <td className="py-2 font-bold">TOTAL BUILT UP AREA : {estimate.total_builtup_area} SQ.FT</td>
            <td className="py-2 text-center font-bold">RATE PER SQ.FT : ₹ {estimate.rate_per_sqft}/-</td>
            <td className="py-2 text-right font-bold">
              TOTAL VALUE : ₹ {Number(estimate.total_value || estimate.construction_cost || 0).toLocaleString("en-IN")}/-
            </td>
          </tr>
        </tbody>
      </table>

      {masterItem && (
        <table className="tail-keep w-full border border-black border-collapse mt-6 text-base">
          <thead>
            <tr>
              <th className="border border-black p-2">SR</th>
              <th className="border border-black p-2">DESCRIPTION</th>
              <th className="border border-black p-2">NOS</th>
              <th className="border border-black p-2">QTY</th>
              <th className="border border-black p-2">UNIT</th>
              <th className="border border-black p-2">RATE</th>
              <th className="border border-black p-2">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {estimateRows
              .filter((row) => {
                const rateVal = parseFloat((row.rate || "0").toString().replace('%', '')) || 0;
                const amount = row.unit === "LS"
                  ? (remainingBudget * (rateVal / 100))
                  : (Number(row.qty || 0) * Number(row.rate || 0));
                return amount > 0;
              })
              .map((row, index) => {
                const rateVal = parseFloat((row.rate || "0").toString().replace('%', '')) || 0;
                const rowAmount = row.unit === "LS"
                  ? (remainingBudget * (rateVal / 100))
                  : (Number(row.qty || 0) * Number(row.rate || 0));
                const currentGrandTotal = estimateRows.reduce((sum, r) => {
                  const rRate = parseFloat((r.rate || "0").toString().replace('%', '')) || 0;
                  const amt = r.unit === "LS" ? (remainingBudget * (rRate / 100)) : (Number(r.qty || 0) * Number(r.rate || 0));
                  return sum + amt;
                }, 0);
                const calculatedPercent = currentGrandTotal > 0 ? (rowAmount / currentGrandTotal) * 100 : 0;
                const showPercent = [masterItem.paint_putty_desc, masterItem.plumbing_desc, masterItem.electrical_desc, masterItem.flooring_desc].includes(row.description);
                return (
                  <tr key={index}>
                    <td className="border border-black p-1 text-center">{index + 1}</td>
                    <td className="border border-black p-1 capitalize">{row.description?.toLowerCase()}</td>
                    <td className="border border-black p-1 text-center">{row.nos}</td>
                    <td className="border border-black p-1 text-center">{row.qty}</td>
                    <td className="border border-black p-1 text-center">{row.unit}</td>
                    <td className="border border-black p-1 text-center">
                      {row.unit === "LS" ? (showPercent ? `${calculatedPercent.toFixed(2)}%` : "-") : row.rate}
                    </td>
                    <td className="border border-black p-1 text-center">
                      {rowAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            <tr>
              <td colSpan={6} className="border border-black p-2 font-bold text-right">TOTAL AMOUNT</td>
              <td className="border border-black p-2 font-bold text-center">
                {estimateRows
                  .reduce((sum, row) => sum + (row.unit === "LS" ? (remainingBudget * (parseFloat(row.rate.toString().replace('%', '')) / 100)) : (Number(row.qty) * Number(row.rate))), 0)
                  .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <table className="keep-together w-full border border-black border-collapse mt-6">
        <tbody>
          <tr>
            <td className="border border-black p-4 w-[60%] align-top">
              <h4 className="font-bold mb-1">DISCLAIMER & TERMS:</h4>
              {useCustomLetterhead ? (
                <textarea
                  value={disclaimerText}
                  onChange={(e) => setDisclaimerText(e.target.value)}
                  className="w-full text-xs border-none focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none bg-white"
                  rows={6}
                />
              ) : (
                <div className="w-full text-xs text-justify leading-relaxed text-gray-800">
                  {disclaimerText}
                </div>
              )}
            </td>
            <td className="border border-black p-4 w-[40%] align-top">
              {!useCustomLetterhead && (isPaid || isAlreadyPaid || userCategory === 'ADMIN' || signatureDetails) ? (
                <>
                  <div className="flex flex-row items-center justify-between gap-4 p-2">
                    <div className="flex flex-col items-center">
                      <QRCodeSVG 
                        value={`${VERIFY_BASE_URL}/verify-estimate?ref=${estimate?.ref_no}`} 
                        size={60} 
                        level="H" 
                      />
                      <p className="text-[8px] mt-1 text-gray-500 font-bold text-center">SCAN TO VERIFY</p>
                    </div>

                    <div className="text-[10px] text-blue-900 border border-blue-200 bg-blue-50 p-2 rounded text-left w-full shadow-sm">
                      <p className="font-bold border-b border-blue-200 mb-1">✓ VERIFIED SIGNATURE</p>
                      <p className="font-bold">Er. J.TOMAR</p>
                      <p className="mt-1 break-words">{signatureDetails || "Digitally Verified & Approved"}</p>
                    </div>
                  </div>

                  {/* ✅ NEW: Manual Signature Image (Jayant Tomar) */}
                  <div className="flex justify-center items-center mt-3 mb-1">
                    <img 
                      src="/signature-jayant-tomar.png" 
                      alt="Authorised Signatory" 
                      className="h-24 w-auto object-contain mix-blend-multiply" 
                    />
                  </div>

                  <div className="border-t border-black pt-2 mt-2 text-center">
                    <p className="font-bold text-sm">AUTHORISED SIGNATORY</p>
                  </div>
                </>
              ) : (
                <div className="h-28"></div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ✅ PaymentBanner Style (Dynamic Pricing) */}
      <div className="mt-8 mb-12 no-print border-t border-slate-200 pt-6">
        {!isPaid && !isAlreadyPaid && userCategory !== 'ADMIN' && (
          <div className="mb-4 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border-2 border-dashed border-amber-400 rounded-xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded shadow uppercase tracking-wider animate-pulse">
                ⚡ LIMITED TIME DEAL
              </span>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 uppercase">
                  Professional Remaining Work Estimate & Verified Report
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  Includes Instant PDF Download, Digital Sealing & Verification QR Code.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-amber-200 shadow-inner">
              <div className="text-right">
                {pricingLoading ? (
                  <span className="text-xs text-slate-500 font-bold">Loading price...</span>
                ) : (
                  <>
                    {pricingDisplay.discountEnabled && pricingDisplay.discountPercent > 0 && (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-gray-400 line-through font-semibold">
                          ₹ {pricingDisplay.mrp}/-
                        </span>
                        <span className="bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {pricingDisplay.discountPercent}% OFF
                        </span>
                      </div>
                    )}
                    <div className="text-lg font-black text-emerald-600 leading-tight">
                      ₹ {pricingDisplay.price}{" "}
                      <span className="text-xs font-bold text-slate-700">Only</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-start gap-4">
          {(isPaid || isAlreadyPaid || userCategory === 'ADMIN') ? (
            <>
              <button
                onClick={handleSaveAndPrint}
                disabled={isSaving}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition font-bold uppercase tracking-wide flex items-center gap-2"
              >
                {isSaving ? "SAVING..." : "🖨️ PRINT ESTIMATE"}
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={isPdfBusy || isSaving || !isExportReady()}
                className="bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-emerald-700 transition font-bold uppercase tracking-wide flex items-center gap-2 disabled:opacity-50"
              >
                {isPdfBusy ? "⏳ PLEASE WAIT..." : "⬇️ DOWNLOAD PDF"}
              </button>
              <button
                onClick={handleSharePdf}
                disabled={isPdfBusy || isSaving || !isExportReady()}
                className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-green-700 transition font-bold uppercase tracking-wide flex items-center gap-2 disabled:opacity-50"
              >
                📤 SHARE PDF
              </button>
            </>
          ) : (
            <button
              onClick={handleRazorpayPayment}
              disabled={pricingLoading}
              className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-8 py-3 rounded-lg shadow-lg hover:from-emerald-700 hover:to-green-700 transition font-extrabold uppercase tracking-wide flex items-center gap-2 text-base animate-bounce disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pricingLoading ? "⏳ LOADING PRICE..." : `🚀 PAY TO PRINT (₹${gatewayFeeAmount})`}
            </button>
          )}

          <button
            onClick={() => {
              // Keep the entered data so the input form opens pre-filled; it is cleared only when the user leaves the flow
              goingToFormRef.current = true;
              router.push(REMAINING_FORM_ROUTE);
            }}
            className="bg-slate-700 text-white px-6 py-3 rounded-lg shadow-md hover:bg-slate-800 transition font-bold uppercase tracking-wide"
          >
            ⬅️ BACK TO INPUT
          </button>
        </div>
      </div>
    </div>
  );
}