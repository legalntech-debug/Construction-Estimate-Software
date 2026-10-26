"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { QRCodeSVG } from 'qrcode.react';
import { fetchPricingRow, getDisplayPricing } from "@/lib/pricingFetch";
import { getItemRate } from "@/lib/pricing";
import {
  NAME_ADDRESS_CHANGE_LIMIT,
  isRealRef,
  isNameAddressChangeMajor,
  isEstimateExpired,
} from "@/lib/estimateRules";

// The QR code and share link always point to the production verification page
const VERIFY_BASE_URL = "https://construction-estimate-software.vercel.app";

// Route of the estimate input form + the localStorage key that carries the estimate between input and preview
const ESTIMATE_FORM_ROUTE = "/estimate";
const ESTIMATE_STORAGE_KEY = "estimatePreview";

// sessionStorage flag read by the input form: "the user deliberately came back from the preview, keep the data"
const RETURN_TO_FORM_FLAG = "estimateReturnToForm";

// NAME_ADDRESS_CHANGE_LIMIT, isRealRef and calculatePercentageChange now live in "@/lib/estimateRules"
// (shared with the input form so both pages always apply the same rule).

// Effective consulting fee used for change detection.
// AUTO mode derives the fee from the clients table at save time, so only a MANUAL fee is compared.
const effectiveFee = (e: any): number | null => {
  const mode = String(e?.fee_mode || "").trim().toUpperCase();
  if (mode === "AUTO") return null;
  return Number(parseFloat(e?.fee_amount) || 0);
};

// Snapshot used to detect changes: name, address, plot area, rate, floor areas, totals,
// client / representative, estimate & plan type and the manual consulting fee.
// Defaults for estimate_type / plan_type mirror the ones used in the save payload so that a
// record read back from the database produces the same snapshot as the on-screen estimate.
const makeSnapshot = (e: any) => {
  const fd = e?.floor_details && typeof e.floor_details === "object" ? e.floor_details : {};
  const floors: Record<string, number> = {};
  Object.keys(fd).sort().forEach((k) => { floors[k] = Number(fd[k]?.area || 0); });
  const norm = (v: any) => String(v || "").trim().toUpperCase();
  return JSON.stringify({
    n: norm(e?.customer_name),
    a: norm(e?.property_address),
    p: Number(e?.plot_area || 0),
    r: Number(e?.rate_per_sqft || 0),
    b: Number(e?.total_builtup_area || 0),
    t: Math.round(Number(e?.total_value ?? e?.total_construction_cost ?? e?.construction_cost ?? 0)),
    f: floors,
    c: norm(e?.client_name),
    rp: norm(e?.representative),
    et: norm(e?.estimate_type || "RENOVATION"),
    pt: norm(e?.plan_type || "BASIC"),
    fe: effectiveFee(e),
  });
};

// Builds the baseline snapshot from a persisted `estimates` row.
// feeMode is taken from the on-screen estimate because the fee mode itself is not stored in the database.
// NOTE: confirm the fee column name of the `estimates` table (fee_amount vs fee_standard) - see getSavedFee.
const getSavedFee = (rec: any) => rec?.fee_amount ?? rec?.fee_standard ?? rec?.consulting_fee ?? 0;
const snapshotFromRecord = (rec: any, feeMode?: string) =>
  makeSnapshot({
    customer_name: rec?.customer_name,
    property_address: rec?.property_address,
    plot_area: rec?.plot_area,
    rate_per_sqft: rec?.rate_per_sqft,
    total_builtup_area: rec?.total_builtup_area,
    total_value: rec?.total_construction_cost ?? rec?.total_value,
    floor_details: rec?.floor_details,
    client_name: rec?.client_name,
    representative: rec?.representative,
    estimate_type: rec?.estimate_type,
    plan_type: rec?.plan_type,
    fee_mode: feeMode,
    fee_amount: getSavedFee(rec),
  });

// ---------------------------------------------------------------------------
// WALLET GATE - runs only when a NEW payment is about to start (Pay to Print).
// Reprints / same-ref updates of an already paid estimate never reach it.
// ---------------------------------------------------------------------------
const MIN_RECHARGE = 100; // Platform minimum recharge amount (INR)
const WALLET_RECHARGE_ROUTE = "/wallet-ledger";

type WalletBlock = { charge: number; balance: number; state: string };

// Flat shape on purpose: discriminated-union narrowing does not work when "strict" is disabled in tsconfig.
type WalletGateResult = { allowed: boolean; block?: WalletBlock; message?: string };

/**
 * Verifies that the logged-in user's wallet balance covers the service charge from the pricing table.
 * Admin, CEO, premium and advanced accounts are exempt. Fails closed: if the balance cannot be verified,
 * the user is not allowed to continue to the payment.
 */
async function verifyWalletForNewPayment(args: {
  userId?: string | null;
  fallbackState: string;
  charge: number;
}): Promise<WalletGateResult> {
  const { userId, fallbackState, charge } = args;

  if (!userId) {
    return { allowed: false, message: "Session expired. Please log in again to continue." };
  }

  try {
    // Always read the balance fresh from the database (the cached profile may be stale after a recharge)
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, plan_type, wallet_balance, state")
      .eq("id", userId)
      .maybeSingle();

    if (error || !profile) {
      console.error("[WALLET GATE] Profile fetch failed:", error);
      return { allowed: false, message: "Unable to verify wallet balance. Please try again." };
    }

    // Exemption rules are the same as the ones the input page applied before its own wallet lock was removed:
    // admin / CEO roles, premium / advanced plans and the platform owner account.
    const role = String(profile.role || "").toLowerCase();
    const plan = String(profile.plan_type || "").toLowerCase();
    const { data: authData } = await supabase.auth.getUser();
    const isOwnerAccount = authData?.user?.email === "legalntech@gmail.com";
    if (role === "admin" || role === "ceo" || plan.includes("premium") || plan.includes("advanced") || isOwnerAccount) {
      return { allowed: true };
    }

    const balance = Number(profile.wallet_balance ?? 0);
    const state = String(profile.state || fallbackState || "").toUpperCase().trim();

    console.log("[WALLET GATE]", { userId, state, balance, charge });

    if (!charge || charge <= 0 || balance >= charge) return { allowed: true };

    return { allowed: false, block: { charge, balance, state } };
  } catch (err) {
    console.error("[WALLET GATE] Unexpected error:", err);
    return { allowed: false, message: "Unable to verify wallet balance. Please try again." };
  }
}

const slabConfig: any = {
  1000: { door: 0.20, plumb: 0.335, elec: 0.335, paint: 0.13, }, //done//
  1100: { door: 0.18, paint: 0.18, plumb: 0.25, elec: 0.25, ms: 0.14}, //done//
  1150: { door: 0.18, paint: 0.18, plumb: 0.25, elec: 0.25, ms: 0.14}, //done//
  1200: { door: 0.14,  paint: 0.14, ms: 0.08,  plumb: 0.2, elec: 0.2, floor: 0.24}, //done//
  1250: { door: 0.14,  paint: 0.14, ms: 0.08,  plumb: 0.2, elec: 0.2, floor: 0.24}, //done//
  1300: { door: 0.14,  paint: 0.14, ms: 0.08,  plumb: 0.2, elec: 0.2, floor: 0.24}, //done//
  1350: { door: 0.14,  paint: 0.14, ms: 0.1,  plumb: 0.195, elec: 0.195, floor: 0.23}, //done//
  1400: { door: 0.14,  paint: 0.14, ms: 0.11,  plumb: 0.195, elec: 0.195, floor: 0.22}, //done//
  1500: { door: 0.131, paint: 0.125, ms: 0.13, plumb: 0.187, elec: 0.187, floor: 0.24 }, //done//
  1550: { door: 0.095, paint: 0.111, ms: 0.095, plumb: 0.16, elec: 0.16, floor: 0.17, ceiling: 0.08,water: 0.129 }, //done//
  1600: { door: 0.095, paint: 0.111, ms: 0.095, plumb: 0.16, elec: 0.16, floor: 0.18, ceiling: 0.07,water: 0.129 }, //done//
  1650: { door: 0.095, paint: 0.111, ms: 0.095, plumb: 0.16, elec: 0.16, floor: 0.18, ceiling: 0.07,water: 0.129 }, //done//
  1700: { door: 0.09, paint: 0.09, ms: 0.09, plumb: 0.13, elec: 0.13, floor: 0.15, ceiling: 0.04, kitchen: 0.15, water: 0.13 }, //done//
  1750: { door: 0.09, paint: 0.09, ms: 0.09, plumb: 0.13, elec: 0.13, floor: 0.15, ceiling: 0.04, kitchen: 0.28 }, //done//
  1800: { door: 0.078, paint: 0.08, ms: 0.078, plumb: 0.13, elec: 0.13, floor: 0.135, ceiling: 0.05, kitchen: 0.154, water: 0.1, furnish: 0.065 },//done//
  1900: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.13, elec: 0.13, floor: 0.13, ceiling: 0.06, kitchen: 0.14,  water: 0.1, furnish: 0.12},//done//
  2000: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.10, elec: 0.10, floor: 0.11, ceiling: 0.06, kitchen: 0.13, water: 0.11, furnish: 0.16, elev: 0.04 }, //done//
  2100: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.16, elev: 0.04, cons: 0.02}, //done//
  2200: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045}, //done//
  2250: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045}, //done//
  2300: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045}, //done//
  2350: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045}, //done//
  2400: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045}, //done//
  2450: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.182, elev: 0.035, cons: 0.02, bore: 0.043}, //done//
  2500: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045}, //done//
  2550: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045}, //done//
  2600: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045}, //done//
  2650: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045}, //done//
  2700: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.09, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.335}, //done//
  2750: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.09, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.335}, //done//
  2800: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.1, elev: 0.02, cons: 0.02, bore: 0.025, lift: 0.335}, //done//
  2850: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.1, elev: 0.02, cons: 0.02, bore: 0.025, lift: 0.335}, //done//
  2900: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.045, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.34}, //done//
  3000: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.045, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.34}, //done//
  3100: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.04, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.03, lift: 0.35}, //done//
  3150: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.04, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.03, lift: 0.35}, //done//
  3200: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.075, elec: 0.07, floor: 0.085, ceiling: 0.04, kitchen: 0.07, water: 0.035, furnish: 0.17, elev: 0.02, cons: 0.02, bore: 0.02, lift: 0.275}, //done//
  3250: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.075, elec: 0.07, floor: 0.085, ceiling: 0.04, kitchen: 0.07, water: 0.035, furnish: 0.17, elev: 0.02, cons: 0.02, bore: 0.02, lift: 0.275}, //done//
  3500: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.075, elec: 0.07, floor: 0.095, ceiling: 0.04, kitchen: 0.07, water: 0.035, furnish: 0.195, elev: 0.02, cons: 0.023, bore: 0.017, lift: 0.24}, //done//
  3750: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.06, water: 0.023, furnish: 0.206, elev: 0.015, cons: 0.03, bore: 0.012, lift: 0.20}, //done//
  4000: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.356, elev: 0.01, cons: 0.03, bore: 0.005, lift: 0.085}, //done//
  4250: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.354, elev: 0.01, cons: 0.03, bore: 0.007, lift: 0.085}, //done//
  4500: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.354, elev: 0.01, cons: 0.03, bore: 0.007, lift: 0.085}, //done//

  4750: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.336, elev: 0.01, cons: 0.033, bore: 0.007, lift: 0.1}, //done//
  5000: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.337, elev: 0.01, cons: 0.033, bore: 0.006, lift: 0.1} //done//
};

export default function EstimatePreviewPage() {
  const router = useRouter();
  const { currentUser, setCurrentUser } = useAuth();

  // 1. Core States
  const [estimate, setEstimate] = useState<any>(null);
  const [masterItem, setMasterItem] = useState<any>(null);
  const [selectedPlotMaster, setSelectedPlotMaster] = useState<any>(null);
  const [totalColumnNos, setTotalColumnNos] = useState(0);

  // 2. Control & UI States
  const [isPaid, setIsPaid] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [totalEstimates, setTotalEstimates] = useState(0);
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [validationReason, setValidationReason] = useState("");
  const [isCheckingHistory, setIsCheckingHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Wallet gate (Pay to Print): modal data when the balance is below the service charge
  const [walletBlock, setWalletBlock] = useState<WalletBlock | null>(null);
  const [walletChecking, setWalletChecking] = useState(false);

  // 3. Custom Letterhead System
  const [useCustomLetterhead, setUseCustomLetterhead] = useState(false);
  const [customHeaderTitle, setCustomHeaderTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [legalText, setLegalText] = useState("WE PROVIDE TECHNICAL SERVICES INCLUDING CONSTRUCTION ESTIMATION, BUILDING PLANNING AND DESIGN, BUILDING PERMISSION AND PLAN APPROVAL, SITE LAYOUT .");
  const [disclaimerText, setDisclaimerText] = useState("This estimation is provided purely as a tentative budgetary guide for informational purposes at the request of the customer to understand the potential scope and incurred costs of the house/bungalow. It is not a binding commercial contract, a fixed-price quotation, or a guaranteed construction cost, as final expenses may vary significantly due to market fluctuations in material prices (e.g., steel, cement), unforeseen site-specific conditions, design changes, and local regulatory requirements. Before initiating any financial commitments, the customer is strictly advised to conduct a detailed site inspection and consult with qualified structural engineers and contractors to obtain finalized site-specific BOQs and quotes. The estimator bears no financial or legal liability for any budget shortfalls, cost overruns, or discrepancies that may arise during actual construction, and the use of this document for any financial or institutional application remains the sole responsibility of the customer. This document is valid for 60 days from the date of issue.");
  const [showSignature, setShowSignature] = useState(false); // Default: false (hidden for the customer)
  // 3. Custom Letterhead System (continued)
  const [signatureDetails, setSignatureDetails] = useState<string | null>(null);
  const userCategory = (currentUser?.user_type || 'INDIVIDUAL USER').toUpperCase();
  const [isFinalized, setIsFinalized] = useState(false);

  // 1. Fee / ref no / payment state for this component
  const [finalFee, setFinalFee] = useState(150); // Default fee; replaced by the dynamically fetched fee when available
  const [currentRefNo, setCurrentRefNo] = useState("LNT/26-27/..."); // Unique ref ID (placeholder until saved)
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false);
  // Smart Change Tracking Ref
  const initialEstimateRef = useRef<string | null>(null); // Snapshot of the estimate as persisted in the database (baseline for change detection)
  const printRef = useRef<HTMLDivElement>(null);
  const [isPdfBusy, setIsPdfBusy] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [needsNewPayment, setNeedsNewPayment] = useState(false);
  const [originalRefNo, setOriginalRefNo] = useState<string | null>(null);
  const [newPaymentReason, setNewPaymentReason] = useState<string>("");
  const goingToFormRef = useRef(false);
  const isMountedRef = useRef(false);
  const allowPrintRef = useRef(false); // true only while the in-app Print button triggers window.print()
  // Mobile preview: the A4 page is scaled down to fit the screen width (desktop stays at scale 1)
  const [previewScale, setPreviewScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);
  // ✅ NEW: State-wise dynamic pricing (from pricing_config DB)
  const [gatewayFeeAmount, setGatewayFeeAmount] = useState<number>(21); // fallback
  const [pricingDisplay, setPricingDisplay] = useState<{
    mrp: number;
    price: number;
    discountEnabled: boolean;
    discountPercent: number;
    savings: number;
    isFromDB: boolean;
  }>({
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
    current?: { customer_name?: string; property_address?: string; fee_mode?: string }
  ) => {
    if (!refNo) return;
    try {
      const { data: estData } = await supabase
        .from('estimates')
        .select('*')
        .eq('ref_no', refNo)
        .maybeSingle();

      // 15% rule: compare the current name/address with the saved (paid) record
      const changedTooMuch = !!(estData && current) && isNameAddressChangeMajor(
        { customer_name: estData.customer_name, property_address: estData.property_address },
        { customer_name: current.customer_name, property_address: current.property_address }
      );
      // 60-day rule: an estimate older than the validity period is a new estimate as well
      const expired = !!estData && isEstimateExpired(estData.created_at);

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

      if (changedTooMuch || expired) {
        // Treat as a new estimate: detach from the old ref/id and require a new payment
        setNeedsNewPayment(true);
        setNewPaymentReason(expired ? "EXPIRED_60_DAYS" : "CHANGED");
        setOriginalRefNo(refNo);
        setIsAlreadyPaid(false);
        setIsPaid(false);
        setRequiresPayment(true);
        setCurrentRefNo("LNT/26-27/...");
        setEstimate((prev: any) => (prev ? { ...prev, id: null, ref_no: null } : prev));
        return;
      }

      // Baseline: values persisted in the database (used to detect print-only / minor-change cases)
      if (estData) {
        initialEstimateRef.current = snapshotFromRecord(estData, current?.fee_mode);
      }

      setIsAlreadyPaid(true);
      setIsPaid(true);
      setRequiresPayment(false);
    } catch (err) {
      console.error("Error checking payment status:", err);
    }
  };

    // ═══════════════════════════════════════════════════════════
  // ✅ NEW: Fetch pricing from pricing_config based on estimate state
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    let alive = true;

    const loadPricing = async () => {
      setPricingLoading(true);
      
      // State priority: estimate.state → user state → default
      const targetState = 
  currentUser?.state ||           // ✅ USER PROFILE STATE (highest priority)
  estimateStateName || 
  estimate?.state_name || 
  "MADHYA PRADESH";

      try {
        const row = await fetchPricingRow("estimate", targetState, userCategory);
        const display = getDisplayPricing(row);

        if (!alive) return;

        if (display.isFromDB && display.price > 0) {
          // ✅ DB se aayi value
          setGatewayFeeAmount(display.price);
          setPricingDisplay({
            mrp: display.mrp,
            price: display.price,
            discountEnabled: display.discountEnabled,
            discountPercent: display.discountPercent,
            savings: display.savings,
            isFromDB: true,
          });
          console.log(`💰 [ESTIMATE DB PRICING] ${targetState} = ₹${display.price}`);
        } else {
          // ✅ Fallback: hardcoded pricing.ts
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
          console.log(`⚠️ [ESTIMATE FALLBACK PRICING] ${targetState} = ₹${fallbackPrice}`);
        }
      } catch (err) {
        console.error("[ESTIMATE PRICING FETCH ERROR]", err);
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

    return () => {
      alive = false;
    };
  }, [estimateStateName, estimate?.state_name, currentUser?.state, userCategory]);

  // Load the saved estimate from localStorage and verify payment status + the 15% name/address rule
  useEffect(() => {
    const loadEstimateFromStorage = async () => {
      try {
        const rawData = localStorage.getItem(ESTIMATE_STORAGE_KEY);
        if (!rawData) return;
        const parsedData = JSON.parse(rawData);

        if (parsedData?.force_new_ref && !isRealRef(parsedData.ref_no)) {
          // The input page has already decided on a new ref no + new payment (e.g. estimate older than 60 days)
          setNeedsNewPayment(true);
          setNewPaymentReason(parsedData.new_ref_reason || "EXPIRED_60_DAYS");
          setOriginalRefNo(parsedData.previous_ref_no || null);
        } else if (isRealRef(parsedData?.ref_no)) {
          setCurrentRefNo(parsedData.ref_no);
          await checkEstimatePaymentStatus(parsedData.ref_no, {
            customer_name: parsedData.customer_name,
            property_address: parsedData.property_address,
            fee_mode: parsedData.fee_mode,
          });
        }
      } catch (err) {
        console.error("Error loading estimate from storage:", err);
      }
    };
    loadEstimateFromStorage();
  }, []);

  
// Update the isPaid status as soon as the estimate data is loaded (required)
  useEffect(() => {
    if (estimate && estimate.platform_payment_status === 'paid' && !needsNewPayment) {
      setIsPaid(true);
    }
  }, [estimate, needsNewPayment]);

  // On page load, read the logo from local storage and check the payment status
  useEffect(() => {
    // 1. Logo Load
    const savedLogo = localStorage.getItem("customLogo");
    if (savedLogo) {
      setLogoUrl(savedLogo);
    }

    const syncPaymentStatus = async () => {
    if (estimate?.id) {
      const { data, error } = await supabase
        .from('mis_records')
        .select('platform_payment_status')
        .eq('estimate_id', estimate.id)
        .maybeSingle();

      // Use data.platform_payment_status
      if (data && data.platform_payment_status === 'paid' && !needsNewPayment) {
        setIsPaid(true);
      }
    }
  };

  syncPaymentStatus();
}, [estimate?.id]);

  // 1. Map handleRazorpayPayment to handlePayment
const handleRazorpayPayment = () => handlePayment();

// Open the print dialog only after React has rendered the final (paid, with ref no) page
  const printAfterRender = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          // Printing is only permitted when it is started from the in-app Print button
          allowPrintRef.current = true;
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
  // Minor change (name/address within 15%, or plot/floor area/rate) -> updates the SAME ref no
  // Major change / new estimate         -> handleSaveAndFinalize creates a new ref no and requires payment
  const isUnchangedFromSaved = () =>
    !needsNewPayment &&
    isRealRef(estimate?.ref_no) &&
    !!initialEstimateRef.current &&
    makeSnapshot(estimate) === initialEstimateRef.current;

  const ensureSaved = async (): Promise<boolean> => {
    if (isFinalized) return true;
    if (isUnchangedFromSaved()) return true;
    const ok = await handleSaveAndFinalize();
    if (ok) await new Promise((r) => setTimeout(r, 500)); // Allow the new ref no to render before capturing/printing
    return ok;
  };

  const isExportReady = () =>
    (isPaid || isAlreadyPaid || userCategory === 'ADMIN') &&
    !!estimate?.ref_no && !String(estimate.ref_no).startsWith("TEMP") && !String(estimate.ref_no).includes("...");

  // File name: <Ref No> - <Customer Name> (LnT Consultant).pdf   (characters not allowed in file names, e.g. "/", are replaced)
  const pdfFileName = () => {
    const clean = (v: any) => String(v || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
    const ref = clean(estimate?.ref_no) || "Estimate";
    const customer = clean(estimate?.customer_name) || "Customer";
    return `${ref} - ${customer} (LnT Consultant).pdf`;
  };

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
        force("transform", "none");
        // The mobile preview wrappers must not clip or shrink the capture
        ["preview-scale-box", "print-shell"].forEach((cls) => {
          const w = root.closest("." + cls) as HTMLElement | null;
          if (w) {
            ["overflow", "width", "height", "padding", "display"].forEach((p) =>
              w.style.setProperty(p, p === "overflow" ? "visible" : p === "display" ? "block" : p === "padding" ? "0" : "auto", "important")
            );
          }
        });
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
      alert("Could not create the PDF. Please try again.");
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
      const text = `Construction Estimate | Ref No: ${estimate?.ref_no}\nVerify: ${verifyUrl}`;
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Construction Estimate", text });
      } else {
        // Desktop / unsupported browser fallback: download the PDF and open WhatsApp with the verification link
        downloadBlob(blob);
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Share error:", err);
        alert("Sharing failed. Please use 'Download PDF' instead.");
      }
    } finally {
      setIsPdfBusy(false);
    }
  };


// Razorpay Payment Handler
  const handlePayment = async () => {
    if (walletChecking) return; // ignore double clicks while the balance is being verified
    try {
      // WALLET GATE: verify the wallet balance against the pricing-table charge BEFORE the payment starts.
      // Insufficient balance -> recharge prompt (the same charge is used for the Razorpay order below).
      setWalletChecking(true);
      setWalletBlock(null);
      try {
        const gate = await verifyWalletForNewPayment({
          userId: currentUser?.id,
          fallbackState: estimateStateName,
          charge: gatewayFeeAmount || 21,
        });
        if (!gate.allowed) {
          if (gate.block) setWalletBlock(gate.block);
          else alert(gate.message || "Unable to verify wallet balance. Please try again.");
          return;
        }
      } finally {
        setWalletChecking(false);
      }

      if (!(window as any).Razorpay) {
        await new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          document.body.appendChild(script);
        });
      }

          // ✅ FIX: Use dynamic price from DB instead of hardcoded 21
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
        amount: Math.round(dynamicAmount * 100), // ✅ paise
        currency: "INR",
        name: "Construction Estimate",
        order_id: data.id, 
        config: {
          display: {
            sequence: ["block.upi_qr", "block.cards", "block.netbanking", "block.wallet"],
            preferences: {
              show_default_blocks: true, 
            },
          },
        },
        handler: async function (response: any) {
          try {
            const paymentDetails = {
              p_payment_status: 'paid',
              p_order_id: response.razorpay_order_id,
              p_payment_id: response.razorpay_payment_id,
              p_user_payment: dynamicAmount  // ✅ dynamic
            };

            setNeedsNewPayment(false);
            setIsPaid(true);
            setIsAlreadyPaid(true);
            await handleSaveAndFinalize(paymentDetails);

            const rzpElement = document.querySelector('.razorpay-checkout-frame');
            if (rzpElement) { rzpElement.remove(); }

            // After payment stay on the finalized page (with ref no); no automatic print / redirect.
            // The user chooses Print, Download PDF or Share PDF.
            window.scrollTo({ top: 0, behavior: "smooth" });

          } catch (error) {
           
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
      
      alert("Payment initialization failed. Please try again.");
    }
  };
  
// On page load, read the logo from local storage
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

// ==========================================
// >>> PAYMENT CONTROL <<<
// ==========================================
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
              ? `⚠️ This estimate is older than 60 days, so it will be treated as a NEW estimate (previous Ref: ${originalRefNo || "-"}). A new REF NO will be generated and a new payment is required to print.`
              : `⚠️ Customer name or property address has changed by more than ${NAME_ADDRESS_CHANGE_LIMIT}%, so this will be treated as a NEW estimate (previous Ref: ${originalRefNo || "-"}). A new REF NO will be generated and a new payment is required to print.`)
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

// Sync the ref no and fee as soon as the estimate data is loaded
useEffect(() => {
  if (estimate) {
    if (estimate.ref_no) {
      setCurrentRefNo(estimate.ref_no);
    }
    // Use the dynamic fee if already computed, otherwise fall back to the base fee of 150
    if (estimate.fee_amount) {
      setFinalFee(Number(estimate.fee_amount));
    }
  }
}, [estimate]);
// ==========================================

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

  // FIX: Strip dots and extra spaces and use only the first word / clean name
  const cleanCName = clientName?.split(/[.\s]+/)[0].trim();
  const cleanRName = repName?.split(/[.\s]+/)[0].trim();
  
  // Use a partial match in the query
  const { data, error } = await supabase
    .from("clients")
    .select(targetColumn)
    .ilike("client_name", `${cleanCName}%`) 
    .ilike("representative_name", `${cleanRName}%`)
    .maybeSingle();

  if (error) {
   
    return 0;
  }

  // Return 0 when there is no data
  const finalFee = data ? Number(data[targetColumn] || 0) : 0;
   return finalFee;
};

  const generateNextRef = (lastRef: string) => {
    if (!lastRef) return null;
    const parts = lastRef.split('/');
    const currentC = parseInt(parts[4].substring(1));
    const nextC = (currentC + 1).toString().padStart(3, '0');
    return `${parts[0]}/${parts[1]}/${parts[2]}/${parts[3]}/C${nextC}`;
  };

const handleSaveAndFinalize = async (paymentData?: any): Promise<boolean> => {
  // 1. Authorization
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

    // 2. Same ref no (reopen / minor change)  ->  UPDATE the existing record
    //    needsNewPayment (name/address changed > 15% or estimate older than 60 days) -> brand new record + new ref no
    let activeEstimateId = needsNewPayment ? null : (estimate?.id || null);
    let activeRefNo: string | null = needsNewPayment ? null : (isRealRef(estimate?.ref_no) ? estimate.ref_no : null);
    // A record that already had a ref no (reopen / minor change) is an UPDATE, never a new estimate,
    // even when its id could not be resolved (e.g. record opened by another account)
    const hadRefNoAtStart = !!activeRefNo;

    // State has the ref no but not the id -> find the exact record in the database
    if (!activeEstimateId && activeRefNo) {
      const { data: foundRec } = await supabase
        .from("estimates")
        .select("id")
        .eq("ref_no", activeRefNo)
        .eq("user_id", userId)
        .maybeSingle();

      if (foundRec) {
        activeEstimateId = foundRec.id;
      }
    }

    // 3. Duplicate check (only for a fresh record that has no ref no yet)
    if (!activeRefNo && !needsNewPayment) {
      const { data: duplicate } = await supabase
        .from("estimates")
        .select("id, ref_no")
        .eq("user_id", userId)
        .eq("customer_name", estimate?.customer_name)
        .eq("property_address", estimate?.property_address)
        .maybeSingle();

      if (duplicate) {
        const confirmOverwrite = confirm(`Duplicate found (Ref: ${duplicate.ref_no}). OK to OVERWRITE?`);
        if (confirmOverwrite) {
          activeEstimateId = duplicate.id;
          activeRefNo = duplicate.ref_no;
        } else {
          setIsSaving(false);
          return false;
        }
      }
    }

    // 4. A new Ref No is generated only for a fresh / new-payment record
    if (!activeRefNo) {
      const fy = (now.getMonth() + 1) >= 4 
        ? `${String(now.getFullYear()).slice(-2)}-${String(now.getFullYear() + 1).slice(-2)}` 
        : `${String(now.getFullYear() - 1).slice(-2)}-${String(now.getFullYear()).slice(-2)}`;
      
      const firstName = (currentUser?.full_name || "GUEST").split(' ')[0].toUpperCase();

      // A. The user's own estimate count (U001, U002...)
      const { count: userCount, error: userErr } = await supabase
        .from('estimates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const personalSeq = !userErr && userCount !== null ? userCount + 1 : 1;
      const formattedUserSeq = `U${String(personalSeq).padStart(3, '0')}`;

      // B. Global system count (C0001, C0002...)
      const { count: globalCount, error: globalErr } = await supabase
        .from('estimates')
        .select('*', { count: 'exact', head: true });

      const globalSeq = !globalErr && globalCount !== null ? globalCount + 1 : 1;
      const formattedGlobalSeq = `C${String(globalSeq).padStart(4, '0')}`;

      // C. Final format: LnT/26-27/JASVANT/U001/C0001
      activeRefNo = `LnT/${fy}/${firstName}/${formattedUserSeq}/${formattedGlobalSeq}`;
    }

    // 5. Dynamic Fee Calculation
    let consultingFee = String(estimate?.fee_mode || "").toUpperCase() === "AUTO" 
      ? await fetchDynamicFee(estimate?.client_name, estimate?.representative, estimate?.estimate_type) 
      : parseFloat(estimate?.fee_amount) || 0;

    // 6. Payload Preparation (Safe Casting)
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
      // On an update of an already paid ref no keep the original payment details
      p_order_id: paymentData?.p_order_id || estimate?.order_id || null,
      p_payment_id: paymentData?.p_payment_id || estimate?.payment_id || estimate?.razorpay_payment_id || null,
      p_user_payment: Number(paymentData?.p_user_payment || estimate?.user_payment || gatewayFeeAmount || 21)
    };

    // 7. DB Call
    const { data, error } = await supabase.rpc('rpc_save_estimate', payload);
    if (error) throw error;

    // 8. Success Handling
    if (data && data.length > 0) {
      if (!activeEstimateId && !hadRefNoAtStart) {
        await supabase.from('profiles').update({ estimate_count: (currentUser?.estimate_count || 0) + 1 }).eq('id', userId);
      }
      
      const result = data[0];
      const savedId = result.estimate_id ?? result.id;
      setEstimate((prev: any) => ({ ...prev, id: savedId, ref_no: result.ref_no }));
      setIsFinalized(true);
      setIsPaid(true);
      setIsAlreadyPaid(true);
      setCurrentRefNo(result.ref_no);
      if (paymentData) setJustPaid(true);
      setNeedsNewPayment(false);
      setOriginalRefNo(null);
      setNewPaymentReason("");
      // The persisted values are now the baseline for change detection
      initialEstimateRef.current = makeSnapshot(estimate);

      // Keep the saved data + ref no so that "Back to Input" returns to the form with everything still filled in
      try {
        localStorage.setItem(
          ESTIMATE_STORAGE_KEY,
          JSON.stringify({ ...estimate, id: savedId, ref_no: result.ref_no, payment_status: 'paid', is_paid: true, force_new_ref: false, new_ref_reason: null })
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

const handlePrint = () => { handleSaveAndPrint(); };

  // --- useEffects (kept outside handlePrint) ---
  useEffect(() => {
  let isMounted = true;

  async function calculateDynamicColumns() {
    if (!estimate) return;
    
    const floors = estimate.selected_floors || [];
    let otherFloorsCols = 0;
    let groundCols = 0;

    for (const floor of floors) {
      const fData = estimate.floor_details?.[floor];
      if (!fData) continue;

      const count = await getColumnsForFloor(fData.width, fData.length);
      if (floor === "GROUND FLOOR") {
        groundCols = count;
      } else {
        otherFloorsCols += count;
      }
    }

    const finalTotal = (groundCols * 2) + otherFloorsCols;
    
    // 10X Loop Guardrail: Only update if the value has actually changed
    if (isMounted && totalColumnNos !== finalTotal) {
      setTotalColumnNos(finalTotal);
    }
  }

  calculateDynamicColumns();

  return () => {
    isMounted = false;
  };
}, [estimate, totalColumnNos]); // Safely added totalColumnNos to dependencies

  useEffect(() => {
    const loadAndVerifyEstimateData = async () => {
      const data = localStorage.getItem("estimatePreview");
      if (!data) return;

      const estimateData = JSON.parse(data);
      let workingEstimate = { ...estimateData, id: estimateData.id || null };

      const forcedNew = !!workingEstimate.force_new_ref && !isRealRef(workingEstimate.ref_no);

      // If opened from MIS and the ref_no is temporary/missing, match the existing record from the database
      if (!forcedNew && (!workingEstimate.ref_no || workingEstimate.ref_no.startsWith("TEMP") || workingEstimate.ref_no.includes("REF-"))) {
        try {
          // Scoped to the logged-in user: another user's paid record with the same name/address must never unlock printing
          const { data: { user: lookupUser } } = await supabase.auth.getUser();
          const { data: existingRows } = lookupUser
            ? await supabase
                .from("estimates")
                .select("*")
                .eq("user_id", lookupUser.id)
                .eq("customer_name", workingEstimate.customer_name)
                .eq("property_address", workingEstimate.property_address)
                .limit(1)
            : { data: null };
          const existingRecord = existingRows && existingRows.length > 0 ? existingRows[0] : null;

          if (existingRecord) {
            // Existing original ref_no and details found, so reuse them
            workingEstimate.id = existingRecord.id;
            workingEstimate.ref_no = existingRecord.ref_no;
            initialEstimateRef.current = snapshotFromRecord(existingRecord, workingEstimate.fee_mode);
            if (existingRecord.payment_status === 'paid' || existingRecord.status === 'paid') {
              setIsPaid(true);
              setIsAlreadyPaid(true);
            }
          }
        } catch (err) {
         
        }
      }

            setEstimate(workingEstimate);

// ✅ FIX: State priority — estimate → user profile → default
const resolvedState = 
  workingEstimate.state_name ||
  workingEstimate.state ||
  workingEstimate.stateName ||
  currentUser?.state ||
  "MADHYA PRADESH";

setEstimateStateName(resolvedState);

console.log('🎯 [STATE RESOLVED]', {
  from_estimate: workingEstimate.state_name || workingEstimate.state || workingEstimate.stateName,
  from_user: currentUser?.state,
  final: resolvedState
});

      // ✅ Robust check for payment/received status from MIS or Reopen Case
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

 // --- DATABASE PAYMENT STATUS CHECK (STEP 4) ---
  useEffect(() => {
    const checkPaymentStatus = async () => {
      // Never re-mark a new-payment estimate as paid from the old record
      if (estimate?.id && !isPaid && !needsNewPayment) {
        const { data, error } = await supabase
          .from('mis_records') // NOTE: this query errors if the table has no estimate_id column
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

  // --- SYSTEM SECURITY & SHORTCUT CONTROL GUARD (STEP 1) ---
  useEffect(() => {
    const preventSystemPrint = (e: KeyboardEvent) => {
      // Check for Ctrl+P (Windows) or Cmd+P (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        alert("System print is disabled! Please use the 'Save & Print' button provided in the software.");
        return false;
      }
    };

    const preventRightClick = (e: MouseEvent) => {
      // Disable right-click print preview bypass
      e.preventDefault();
    };

    window.addEventListener('keydown', preventSystemPrint, true);
    window.addEventListener('contextmenu', preventRightClick);

    return () => {
      window.removeEventListener('keydown', preventSystemPrint, true);
      window.removeEventListener('contextmenu', preventRightClick);
    };
  }, []);
  
  // Mobile preview: fit the A4 page (794px wide) into the screen width. Print / PDF are not affected.
  useEffect(() => {
    const A4_PX = 794;
    const update = () => {
      const vw = window.innerWidth;
      if (vw >= 820) {
        setPreviewScale(1);
        setScaledHeight(null);
        return;
      }
      const scale = Math.min(1, (vw - 16) / A4_PX);
      setPreviewScale(scale);
      const h = printRef.current?.offsetHeight || 0;
      setScaledHeight(h ? h * scale : null);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    let ro: ResizeObserver | undefined;
    if (printRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      ro.observe(printRef.current);
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      ro?.disconnect();
    };
  }, [estimate, masterItem, isCheckingHistory]);

  // Clear the saved input data when the user leaves the form/preview flow (e.g. to the dashboard).
  // The data is preserved when going back to the input form (Back to Input / browser back).
  useEffect(() => {
    isMountedRef.current = true;
    const onPop = () => {
      goingToFormRef.current = true;
      try { sessionStorage.setItem(RETURN_TO_FORM_FLAG, "1"); } catch {}
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      isMountedRef.current = false;
      setTimeout(() => {
        if (!isMountedRef.current && !goingToFormRef.current) {
          try {
            localStorage.removeItem(ESTIMATE_STORAGE_KEY);
            sessionStorage.removeItem(RETURN_TO_FORM_FLAG);
          } catch {}
        }
      }, 0);
    };
  }, []);

  // --- Helper Functions ---
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

  // Loading States
  if (!estimate) return <div className="p-10">Loading...</div>;
  if (!masterItem) return <div className="p-10">Loading Master Items...</div>;

  const formatQty = (val: number) => Number(val || 0).toFixed(2);
  const getUnit = (unit: string | null | undefined) => (unit && unit.trim() !== "" ? unit : "LS");
  
 async function getGroundFloorPlotMaster(estimate: any) {
  const activeDetails = estimate?.floor_details || {};
  const selectedFloors = estimate?.selected_floors || [];

  // SMART FIX: If Ground Floor is not selected, use the first selected floor instead
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

  // Safety fallback when the dimensions are 0
  if (width <= 0 || length <= 0) {
    width = 20; // Default standard width fallback
    length = 50; // Default standard length fallback
  }

  //----------------------------------------------------
  // STEP-1 : Exact Search
  //----------------------------------------------------
  let { data } = await supabase
    .from("plot_master")
    .select("*")
    .eq("width_feet", width)
    .eq("length_feet", length)
    .limit(1);

  if (data && data.length > 0) {
    return data[0];
  }

  //----------------------------------------------------
  // STEP-2 : Width fix, Length increase
  //----------------------------------------------------
  for (let l = length + 1; l <= 250; l++) {
    const { data } = await supabase
      .from("plot_master")
      .select("*")
      .eq("width_feet", width)
      .eq("length_feet", l)
      .limit(1);

    if (data && data.length > 0) {
      return data[0];
    }
  }

  //----------------------------------------------------
  // STEP-3 : Width increase then length search
  //----------------------------------------------------
  for (let w = width + 1; w <= 250; w++) {
    for (let l = length; l <= 250; l++) {
      const { data } = await supabase
        .from("plot_master")
        .select("*")
        .eq("width_feet", w)
        .eq("length_feet", l)
        .limit(1);

      if (data && data.length > 0) {
        return data[0];
      }
    }
  }
  return null;
}
  // ===========================
  // RCC LINTEL CALCULATION
  // ===========================
  const gfLength =estimate.floor_details?.["GROUND FLOOR"]?.length || 0;
  const gfWidth =  estimate.floor_details?.["GROUND FLOOR"]?.width || 0;

  const baseLintelLength =
    gfLength > 0 && gfWidth > 0
      ? ((2 * ((gfLength / 3.28) + (gfWidth / 3.28))) * 1.8)
      : 0;

  const lintelWidth = 0.1;
  const lintelDepth = 0.15;

  const towerLintelLength =
    estimate.floor_details?.["TOWER"]?.length > 0 &&
    estimate.floor_details?.["TOWER"]?.width > 0
      ? (
          2 *
          (
            (estimate.floor_details["TOWER"].length / 3.28) +
            (estimate.floor_details["TOWER"].width / 3.28)
          )
        ) * 1.8
      : 0;

  const lintelLength =
    baseLintelLength + towerLintelLength;

  const lintelNos =
    estimate.selected_floors?.length || 0;

  const lintelQty =
    lintelLength *
    lintelWidth *
    lintelDepth *
    lintelNos;


  // ===========================
  // RCC CHAJJA CALCULATION
  // ===========================

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

  const chajjaQty =
    chajjaLength *
    chajjaWidth *
    chajjaDepth *
    chajjaNos;

  // ===========================
  // RCC STAIRCASE CALCULATION
  // ===========================

  // Count floors excluding the tower
  const stairNos = estimate.selected_floors?.filter((f: string) => f !== "TOWER").length || 0;

  const stairL = 10;
  const stairW = 1.1;
  const stairT = 0.12;

  const stairQty = stairL * stairW * stairT * stairNos;

  // ===========================
  // REINFORCEMENT STEEL CALCULATION
  // ===========================

  let totalSteelQty = 0;

  estimate.selected_floors?.forEach((floor: string, index: number) => {
    const floorArea = Number(estimate.floor_details?.[floor]?.area || 0);
        
    let kgPerSqft = 3.6; 

    if (index >= 4) {
      // 5th floor (index 4) onwards: 0.3 increase per floor
      kgPerSqft += (index - 3) * 0.3;
    }

    // 2. Area logic: add +0.2 when the area is above 1500 sqft
    if (floorArea > 1500) {
      kgPerSqft += 0.2;
    }

   totalSteelQty += (floorArea * kgPerSqft);
  });

  // #PROTECT: Safe Fallback Objects creation to bypass loading spinner block
  const currentEstimate = estimate || { total_builtup_area: 0, selected_floors: [], floor_details: {}, rate_per_sqft: 0, total_value: 0, construction_cost: 0 };
  const currentMasterItem = masterItem || { reinforcement_steel_rate: 0, shuttering_rate: 0, preliminary_rate: 0, earthwork_rate: 0 };
  const currentPlotMaster = selectedPlotMaster || { footing_width_meter: 0, footing_length_meter: 0, footing_height_meter: 0, no_of_column: 0, footing_thickness_meter: 0, column_width_meter: 0, column_length_meter: 0, column_height: 0, beam_width_meter: 0, beam_depth_meter: 0, slab_thicknes: 0, plinth_slab_thicknes: 0 };

  // Rate Logic
  const baseRate = Number(currentMasterItem.reinforcement_steel_rate || 0);
  const actualFloorsCount = currentEstimate.selected_floors?.filter((f: string) => f !== "TOWER").length || 1;
  const effectiveRate = actualFloorsCount > 4 ? (baseRate + (actualFloorsCount - 4)) : baseRate;
  
  // ===========================
  // SHUTTERING CALCULATION (USING SAFE FALLBACKS)
  // ===========================

  // Qty: Total Built-up Area in Sq.Mt
  const shutteringQty = Number(currentEstimate.total_builtup_area || 0) / 10.76;

  // Rate Calculation Logic:
  const baseShutterRate = Number(currentMasterItem.shuttering_rate || 0);
  const totalFloorCount = currentEstimate.selected_floors?.length || 1;

  let shutteringRate = baseShutterRate;

  if (totalFloorCount > 3) {
    // For the 4th, 5th and 6th floors (+30 per floor)
    const floorsToApply30 = Math.min(totalFloorCount - 3, 3);
    shutteringRate += (floorsToApply30 * 30);
    
    // 7th floor onwards (+10 per floor)
    if (totalFloorCount > 6) {
      shutteringRate += ((totalFloorCount - 6) * 10);
    }
  }

  
  // --- CALCULATIONS BLOCK (SAARA YAHAN RAKHEIN) ---
  const builtupAreaSqFt = Number(estimate.total_builtup_area || 0);
  const builtupAreaSqMt = builtupAreaSqFt / 10.76;

  // Floor count fix: define only once
  const floorCount = estimate.selected_floors?.length || 1;
  const hasTower = estimate.selected_floors?.includes("TOWER");

  // Brickwork
  let brickMultiplier = 0.92;
  if (builtupAreaSqFt >= 200 && builtupAreaSqFt <= 600) brickMultiplier = 0.82;
  else if (builtupAreaSqFt <= 1000) brickMultiplier = 0.85;
  else if (builtupAreaSqFt <= 1500) brickMultiplier = 0.88;
  else if (builtupAreaSqFt <= 2000) brickMultiplier = 0.90;

  const wallLengthRm = builtupAreaSqMt * 0.9;
  const brickQtyCum = (wallLengthRm * 2.7 * 0.15 * brickMultiplier) * 1.05;

  // Plaster
  const internalPlasterQty = builtupAreaSqMt * 3.35;
  const externalPlasterQty = builtupAreaSqMt * 3;

  // --- DOOR & WINDOW CALCULATIONS ---
  let totalDoorWindowNos = 0;

  // Loop over every floor
  estimate.selected_floors?.forEach((floor: string) => {
      if (floor === "TOWER") {
          totalDoorWindowNos += 1; // Fixed 1 for the tower
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
              // 1801 se har 1000 sqft par +1
              // e.g., 1801-2800 = 10, 2801-3800 = 11
              const extra = Math.floor((floorArea - 1801) / 1000) + 1;
              count = 9 + extra;
          }
          
          totalDoorWindowNos += count;
      }
  });

  const doorFrameNos = totalDoorWindowNos;
  const doorFrameQty = totalDoorWindowNos;

  // Paint
  const paintQtySqMt = builtupAreaSqMt;

  // --- MS STEEL CALCULATION ---
  // 5% of the total amount (total_value)
  const msSteelQty = Number(estimate.total_value || 0) * 0.05;

  // --- PLUMBING & ELECTRICAL PERCENTAGE LOGIC ---
  const ratePerSqft = Number(estimate.rate_per_sqft || 0);
  let plumbingElectricPercent = 0.05; // Default 5%

  if (ratePerSqft >= 1000 && ratePerSqft <= 1200) plumbingElectricPercent = 0.05;
  else if (ratePerSqft >= 1201 && ratePerSqft <= 1400) plumbingElectricPercent = 0.06;
  else if (ratePerSqft >= 1401 && ratePerSqft <= 1600) plumbingElectricPercent = 0.075;
  else if (ratePerSqft >= 1601 && ratePerSqft <= 1800) plumbingElectricPercent = 0.08;
  else if (ratePerSqft >= 1801 && ratePerSqft <= 2100) plumbingElectricPercent = 0.09;
  else if (ratePerSqft > 2100) plumbingElectricPercent = 0.10;

  // For the percentage display
  // Number((val).toFixed(2)) removes trailing zeros so the value displays cleanly.
  const displayPercent = Number((plumbingElectricPercent * 100).toFixed(2)).toString() + "%";

  // --- FLOORING CALCULATION ---
  const totalBuiltupSqFt = Number(estimate.total_builtup_area || 0);
  const totalBuiltupSqm = totalBuiltupSqFt / 10.76;

  

  // #PROTECT: Safe calculation proxies to strictly block runtime null evaluation crashes
  const safePlotMaster = selectedPlotMaster || {
    footing_width_meter: 0,
    footing_length_meter: 0,
    footing_height_meter: 0,
    no_of_column: 0,
    footing_thickness_meter: 0,
    column_width_meter: 0,
    column_length_meter: 0,
    column_height: 0,
    beam_width_meter: 0,
    beam_depth_meter: 0,
    slab_thicknes: 0,
    plinth_slab_thicknes: 0
  };

  const safeEstimate = estimate || {
    total_builtup_area: 0,
    rate_per_sqft: 0,
    total_value: 0,
    construction_cost: 0,
    selected_floors: [],
    floor_details: {}
  };
// --- NEW SAFE PATCH END ---

  // --- NEW CALCULATIONS (FULLY PROTECTED FROM NULL) ---
  // Safe extraction to local helper variables
  const spm = selectedPlotMaster || { 
    footing_width_meter: 0, footing_length_meter: 0, footing_height_meter: 0, 
    no_of_column: 0, footing_thickness_meter: 0, column_width_meter: 0, 
    column_length_meter: 0, column_height: 0 
  };
  const est = estimate || { floor_details: {} };

  // 1. Earthwork (Length + 0.6, Width + 0.6, Height + 0.6)
const earthworkQty = 
  (Number(spm.footing_width_meter || 0) + 0.6) * 
  (Number(spm.footing_length_meter || 0) + 0.6) * 
  (Number(spm.footing_height_meter || 0) + 0.6) * 
  Number(spm.no_of_column || 0);

  // 2. PCC Foundation
  const pccThickness = 0.2; 
  const pccQty = (
    parseFloat(String(spm.footing_length_meter || 0)) *
    parseFloat(String(spm.footing_width_meter || 0)) *
    pccThickness *
    parseFloat(String(spm.no_of_column || 0))
  );

  // 3. RCC Foundation
  const rccFootingQty = Number(spm.footing_width_meter || 0) * Number(spm.footing_length_meter || 0) * Number(spm.footing_thickness_meter || 0) * Number(spm.no_of_column || 0);

  // 4. RCC Column
  const columnQty = Number(spm.column_width_meter || 0) * Number(spm.column_length_meter || 0) * Number(spm.column_height || 0) * Number(spm.no_of_column || 0);
  
  const gf = est.floor_details?.["GROUND FLOOR"];
  const plinthLength = gf ? (2 * ((Number(gf.length || 0) / 3.28) + (Number(gf.width || 0) / 3.28))) * 1.8 : 0;
  const plinthBeamQty = plinthLength * 0.20 * 0.30; // Formula: L * W * D

  // B. Roof beam calculation (based on the total dimensions of each floor)
  const floors = est.selected_floors || [];
  let totalRoofBeamLength = 0;

  for (const floor of floors) {
    const fData = est.floor_details?.[floor];
    if (fData) {
      // Beam length calculation for each floor
      const floorBeamLen = (2 * ((Number(fData.length || 0) / 3.28) + (Number(fData.width || 0) / 3.28))) * 1.8;
      totalRoofBeamLength += floorBeamLen;
    }
  }
  const roofBeamQty = totalRoofBeamLength * 0.20 * 0.30;

  
  // --- 7. RCC Slab Calculation ---
  const totalAreaSqMt = Number(est.total_builtup_area || 0) / 10.76;
  const gfAreaSqMt = Number(est.floor_details?.["GROUND FLOOR"]?.area || 0) / 10.76;
  const slabThick = Number(spm.slab_thicknes || 0);
  const plinthThick = Number(spm.plinth_slab_thicknes || 0);
  const slabQty = (totalAreaSqMt * slabThick) + (gfAreaSqMt * plinthThick);
  const formulaDisplay = `(${totalAreaSqMt.toFixed(0)}*${slabThick} + ${gfAreaSqMt.toFixed(0)}*${plinthThick})`;

  // [STEP 1] Floor Sorting Logic
  const floorOrder: { [key: string]: number } = {
    "GROUND FLOOR": 1, "FIRST FLOOR": 2, "SECOND FLOOR": 3,
    "THIRD FLOOR": 4, "FOURTH FLOOR": 5, "FIFTH FLOOR": 6,
    "SIXTH FLOOR": 7, "SEVENTH FLOOR": 8, "EIGHTH FLOOR": 9,
  };

  const sortedFloors = [...(est.selected_floors || [])].sort((a, b) => {
    return (floorOrder[a] || 100) - (floorOrder[b] || 100);
  });

  // =========================================================================
// COBA & PARAPET CONDITION ENGINE (Strict Ground/Tower Coba Hide Rule)
// =========================================================================

const rate = ratePerSqft; 
const selectedFloors = estimate.selected_floors || [];

// Check: are only GROUND and TOWER selected? (i.e. no upper floor)
const isOnlyGroundAndTower = selectedFloors.every(f => f === "GROUND FLOOR" || f === "TOWER");

// Check: is the First Floor or any floor above it selected?
const hasUpperFloors = selectedFloors.some(f => f !== "GROUND FLOOR" && f !== "TOWER");

// Check: is the rate above 1450?
const isRateAbove1450 = rate > 1450;

// Check: is the rate between 1550 and 1900? (parapet hide condition)
const isRateInRange = rate > 1550 && rate < 1900;

// --- CALCULATIONS ---
const shouldHideParapet = isRateInRange && isOnlyGroundAndTower;

// ===========================
// 28. PARAPET WALL CALCULATION
// ===========================
const gfL = Number(estimate.floor_details?.["GROUND FLOOR"]?.length || 0) / 3.28;
const gfW = Number(estimate.floor_details?.["GROUND FLOOR"]?.width || 0) / 3.28;

const lastFloorName = estimate.selected_floors?.filter((f: string) => f !== "TOWER").slice(-1)[0] || "GROUND FLOOR";
const lfL = Number(estimate.floor_details?.[lastFloorName]?.length || 0) / 3.28;
const lfW = Number(estimate.floor_details?.[lastFloorName]?.width || 0) / 3.28;

const maxL = Math.max(gfL, lfL);
const maxW = Math.max(gfW, lfW);

// Parapet
const parapetQtyRM = shouldHideParapet ? 0 : (2 * (maxL + maxW));
const parapetRate = Number(masterItem.parapet_wall_rate || 0);

// ===========================
// TERRACE COBA CALCULATION (Strict Rule Applied)
// ===========================
let cobaQty = 0;

// The item is shown only when:
// 1. The rate is above 1450
// 2. Not only Ground/Tower: upper floors (First floor etc.) are present as well
// 3. The range-based hiding rule does not apply
const shouldShowCoba = isRateAbove1450 && hasUpperFloors && !shouldHideParapet;

if (shouldShowCoba) {
  const getFloorArea = (floorKey) => {
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

  // =========================================================================
// DETAILED ESTIMATE CALCULATIONS ENGINE (GROUND FLOOR CHECK & ZERO FIX)
// =========================================================================

// 1. Safe Proxy Fallbacks
const safeSpm = selectedPlotMaster || {
  footing_length_meter: 0,
  footing_width_meter: 0,
  footing_height_meter: 0,
  footing_thickness_meter: 0,
  column_width_meter: 0,
  column_length_meter: 0,
  column_height: 0,
  no_of_column: 0,
  beam_width_meter: 0,
  beam_depth_meter: 0
};

// Check if Ground Floor is selected in selectedFloors array
const isGroundFloorSelected = selectedFloors ? selectedFloors.includes("GROUND FLOOR") : true;

// Helper function to safely get floor dimension in meters
const getSafeFloorDim = (floorName, dimType) => {
  const val = estimate.floor_details?.[floorName]?.[dimType];
  const num = Number(val);
  return isNaN(num) || num <= 0 ? 0 : num / 3.28;
};

// Raw safe dimensions for calculations
const groundLenMtr = getSafeFloorDim("GROUND FLOOR", "length");
const groundWidMtr = getSafeFloorDim("GROUND FLOOR", "width");

// --- PART 2: Core Items ---
const coreItems = [
  { 
    description: masterItem.preliminary_desc || "Preliminary Work", 
    l: formatQty(groundLenMtr), 
    w: formatQty(groundWidMtr), 
    ht: "-", 
    nos: 1, 
    qty: formatQty(groundLenMtr * groundWidMtr), 
    unit: getUnit(masterItem.preliminary_unit), 
    rate: masterItem.preliminary_rate 
  },
  
  // --- FOUNDATION & EARTHWORK ITEMS (Strictly 0 if Ground Floor is not selected) ---
  { 
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
    description: masterItem.rcc_foundation_desc, 
    l: isGroundFloorSelected ? (selectedPlotMaster?.footing_length_meter || 0) : 0, 
    w: isGroundFloorSelected ? (selectedPlotMaster?.footing_width_meter || 0) : 0, 
    ht: isGroundFloorSelected ? (selectedPlotMaster?.footing_thickness_meter || 0) : 0, 
    nos: isGroundFloorSelected ? (selectedPlotMaster?.no_of_column || 0) : 0, 
    qty: isGroundFloorSelected ? Number(rccFootingQty || 0).toFixed(2) : "0.00", 
    unit: "CUM", 
    rate: masterItem.rcc_foundation_rate 
  },
  
  // --- SUPERSTRUCTURE & UPPER FLOOR ITEMS ---
  { description: masterItem.rcc_column_desc, l: selectedPlotMaster?.column_width_meter || 0, w: selectedPlotMaster?.column_length_meter || 0, ht: selectedPlotMaster?.column_height || 0, nos: totalColumnNos, qty: (Number(selectedPlotMaster?.column_width_meter || 0) * Number(selectedPlotMaster?.column_length_meter || 0) * Number(selectedPlotMaster?.column_height || 0) * totalColumnNos).toFixed(2), unit: "CUM", rate: masterItem.rcc_column_rate },
  
  { 
    description: masterItem.plinth_beam_desc, 
    l: isGroundFloorSelected ? plinthLength.toFixed(2) : 0, 
    w: isGroundFloorSelected ? Number(selectedPlotMaster?.beam_width_meter || 0).toFixed(2) : 0, 
    ht: isGroundFloorSelected ? Number(selectedPlotMaster?.beam_depth_meter || 0).toFixed(2) : 0, 
    nos: isGroundFloorSelected ? 1 : 0, 
    qty: isGroundFloorSelected ? Number(plinthBeamQty || 0).toFixed(2) : "0.00", 
    unit: "CUM", 
    rate: masterItem.plinth_beam_rate 
  },
  
  { description: masterItem.roof_beam_desc, l: totalRoofBeamLength.toFixed(2), w: Number(selectedPlotMaster?.beam_width_meter || 0).toFixed(2), ht: Number(selectedPlotMaster?.beam_depth_meter || 0).toFixed(2), nos: 1, qty: Number(roofBeamQty || 0).toFixed(2), unit: "CUM", rate: masterItem.roof_beam_rate },
  { description: masterItem.rcc_slab_desc, l: "-", w: "-", ht: "-", nos: "-", qty: Number(slabQty || 0).toFixed(2), unit: "CUM", rate: masterItem.rcc_slab_rate },
  
  { description: masterItem.rcc_lintel_desc, l: lintelLength.toFixed(2), w: lintelWidth, ht: lintelDepth, nos: lintelNos, qty: Number(lintelQty || 0).toFixed(2), unit: "CUM", rate: masterItem.rcc_lintel_rate },
  { description: masterItem.rcc_chajja_desc, l: chajjaLength, w: chajjaWidth, ht: chajjaDepth, nos: chajjaNos, qty: Number(chajjaQty || 0).toFixed(2), unit: "CUM", rate: masterItem.rcc_chajja_rate },
  { description: masterItem.rcc_staircase_desc, l: stairL.toFixed(2), w: stairW.toFixed(2), ht: stairT.toFixed(2), nos: stairNos, qty: Number(stairQty || 0).toFixed(2), unit: getUnit(masterItem.rcc_staircase_unit), rate: masterItem.rcc_staircase_rate },
  { description: masterItem.reinforcement_steel_desc, l: "-", w: "-", ht: "-", nos: 1, qty: Number(totalSteelQty || 0).toFixed(2), unit: getUnit(masterItem.reinforcement_steel_unit), rate: effectiveRate.toFixed(2) },
  { description: masterItem.shuttering_desc, l: "-", w: "-", ht: "-", nos: 1, qty: Number(shutteringQty || 0).toFixed(2), unit: "SQ.MT", rate: shutteringRate.toFixed(2) },
  { description: masterItem.brickwork_desc, l: "-", w: "-", ht: "2.7", nos: "1", qty: Number(brickQtyCum || 0).toFixed(2), unit: "CUM", rate: masterItem.brickwork_rate },
  { description: masterItem.internal_plaster_desc, l: "-", w: "-", ht: "-", nos: 1, qty: Number(internalPlasterQty || 0).toFixed(2), unit: getUnit(masterItem.internal_plaster_unit), rate: masterItem.internal_plaster_rate },
  { description: masterItem.external_plaster_desc, l: "-", w: "-", ht: "-", nos: 1, qty: Number(externalPlasterQty || 0).toFixed(2), unit: getUnit(masterItem.external_plaster_unit), rate: masterItem.external_plaster_rate },
  { 
    description: masterItem.parapet_wall_desc || "Parapet Wall", 
    l: shouldHideParapet ? "0" : maxL.toFixed(2), 
    w: shouldHideParapet ? "0" : maxW.toFixed(2), 
    ht: "-", 
    nos: 1, 
    qty: parapetQtyRM.toFixed(2), 
    unit: "RM", 
    rate: parapetRate 
  },
  { description: masterItem.terrace_coba_desc || "Terrace Coba", l: "-", w: "-", ht: "-", nos: 1, qty: cobaQty.toFixed(2), unit: "SQM", rate: cobaRate.toFixed(0) },
];

// 2. Core Total & Weights
const coreTotal = coreItems.reduce((sum, row) => sum + (Number(row.qty || 0) * Number(row.rate || 0)), 0);

const rawBaseValue = Number(estimate.total_value || estimate.construction_cost || 0);
const remainingBudget = Math.max(0, isNaN(rawBaseValue - coreTotal) ? 0 : rawBaseValue - coreTotal);

// =========================================================================
// INTEGRATED CALCULATIONS BLOCK
// =========================================================================

const slabRates = Object.keys(slabConfig).map(Number).sort((a, b) => a - b);
const activeSlab = slabRates.find(s => rate <= s) || 5000;
const w = slabConfig[activeSlab];

const isGroundFloorOnly = selectedFloors.every(f => f === "GROUND FLOOR" || f === "TOWER");
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

const sumWeights = 
  (finalW.door || 0) + (finalW.paint || 0) + (finalW.ms || 0) + 
  (finalW.plumb || 0) + (finalW.elec || 0) + (finalW.floor || 0) + 
  (finalW.ceiling || 0) + (finalW.kitchen || 0) + (finalW.water || 0) + 
  (finalW.furnish || 0) + (finalW.elev || 0) + (finalW.bore || 0) + 
  (finalW.final || 0) + (finalW.lift || 0) + (finalW.cons || 0);

// 4. Estimate Rows Mapping
const estimateRows = [
  ...coreItems,
  { description: masterItem.door_frame_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.door || 0) * 100).toFixed(1) + "%" },
  { description: masterItem.paint_putty_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.paint || 0) * 100).toFixed(1) + "%" },
  { description: masterItem.ms_steel_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.ms || 0) * 100).toFixed(1) + "%" },
  { description: masterItem.plumbing_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.plumb || 0) * 100).toFixed(1) + "%" },
  { description: masterItem.electrical_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.elec || 0) * 100).toFixed(1) + "%" },
  { description: masterItem.flooring_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.floor || 0) * 100).toFixed(1) + "%" },
  { description: masterItem.false_ceiling_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.ceiling || 0) * 100).toFixed(1) + "%" },
  
  { description: masterItem.modular_kitchen_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.kitchen || 0) * 100).toFixed(1) + "%" },
  { description: masterItem.water_tank_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.water || 0) * 100).toFixed(1) + "%" },
  { description: masterItem.full_home_furnishing_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.furnish || 0) * 100).toFixed(1) + "%" },
  { description: masterItem.modern_elevation_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.elev || 0) * 100).toFixed(1) + "%" },
  { description: masterItem.deep_boring_desc, l: "-", w: "-", ht: "-", nos: "-", qty: 1, unit: "LS", rate: ((finalW.bore || 0) * 100).toFixed(1) + "%" },
  { description: masterItem.final_finishing_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.final || 0) * 100).toFixed(1) + "%" },
  
  ...(!isLiftHidden 
    ? [{ description: masterItem.lift_installation_desc, l: "-", w: "-", ht: "-", nos: "-", qty: 1, unit: "LS", rate: ((finalW.lift || 0) * 100).toFixed(1) + "%" }] 
    : []
  ),
  
  { description: masterItem.consultant_fee_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.cons || 0) * 100).toFixed(1) + "%" },
];

// Calculate Grand Total Safely
const grandTotal = estimateRows.reduce((sum, row) => {
  const qty = Number(row?.qty || 0);
  const rateVal = row?.rate;
  
  if (typeof rateVal === 'string' && rateVal.includes('%')) {
    return sum;
  }
  
  return sum + (qty * Number(rateVal || 0));
}, 0);

const formattedTotal = Math.round(grandTotal).toLocaleString('en-IN');

if (isCheckingHistory) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-sm font-semibold tracking-wide uppercase">Validating Estimate History...</p>
    </div>
  );
}

// Mobile: notices and buttons live OUTSIDE the scaled A4 page so they stay full size and tappable
const isMobilePreview = previewScale < 1;

const noticesBlock = (
  <>
    {justPaid && estimate?.ref_no && (
      <div className="mb-6 p-4 border-2 border-emerald-500 bg-emerald-50 rounded-lg text-left no-print">
        <p className="font-bold uppercase text-xs tracking-wider text-emerald-800 mb-1">✅ Payment Successful</p>
        <p className="text-sm font-medium text-emerald-900">
          Ref No: <span className="font-mono font-bold">{estimate.ref_no}</span>
        </p>
        <p className="text-xs text-emerald-800 mt-1">You can now Print, Download the PDF or Share it from below.</p>
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
  </>
);

const actionsBlock = (
<div className="mt-8 mb-12 no-print border-t border-slate-300 pt-6">
  
  {/* {!isPaid && !isAlreadyPaid && userCategory !== 'ADMIN' && condition: banner shown inside */}
  {!isPaid && !isAlreadyPaid && userCategory !== 'ADMIN' && (
    <div className="mb-4 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border-2 border-dashed border-amber-400 rounded-xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
      
      {/* Left side: Offer Title */}
      <div className="flex items-center gap-3">
        <span className="bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded shadow uppercase tracking-wider animate-pulse">
          ⚡ LIMITED TIME DEAL
        </span>
        <div>
          <h4 className="text-sm font-extrabold text-slate-900 uppercase">
            Professional Construction Estimate & Verified Report
          </h4>
          <p className="text-xs text-slate-600 font-medium">
            Includes Instant PDF Download, Digital Sealing & Verification QR Code.
          </p>
        </div>
      </div>

            {/* Right side: Amazon/Flipkart Style Price Box - DYNAMIC */}
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
                ₹ {pricingDisplay.price} <span className="text-xs font-bold text-slate-700">Only</span>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )}

  {/* Action Buttons Row */}
  <div className="flex flex-wrap items-center justify-start gap-4">
    {(isPaid || isAlreadyPaid || userCategory === 'ADMIN') ? (
      <>
        <button
          onClick={handleSaveAndPrint}
          disabled={isSaving || isPdfBusy}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 transition font-bold uppercase tracking-wide flex items-center gap-2 disabled:opacity-50"
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
        disabled={pricingLoading || walletChecking}
        className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-8 py-3 rounded-lg shadow-lg hover:from-emerald-700 hover:to-green-700 transition font-extrabold uppercase tracking-wide flex items-center gap-2 text-base animate-bounce disabled:opacity-50 disabled:animate-none"
      >
        {pricingLoading
          ? "⏳ LOADING PRICE..."
          : walletChecking
          ? "⏳ CHECKING WALLET..."
          : `🚀 PAY TO PRINT (₹${gatewayFeeAmount})`}
      </button>
    )}

    <button
      onClick={() => {
        // Keep the entered data (and ref no) in localStorage so the input form is still filled
        goingToFormRef.current = true;
        try { sessionStorage.setItem(RETURN_TO_FORM_FLAG, "1"); } catch {}
        router.push(ESTIMATE_FORM_ROUTE);
      }}
      className="bg-slate-700 text-white px-6 py-3 rounded-lg shadow-md hover:bg-slate-800 transition font-bold uppercase tracking-wide"
    >
      ⬅️ BACK TO INPUT
    </button>
  </div>
</div>
);

return (
  <div
    className="print-shell w-full overflow-x-auto bg-slate-100 p-2 md:p-6 flex justify-center"
    style={isMobilePreview ? { flexDirection: "column", alignItems: "center", overflowX: "hidden", padding: "8px 0" } : undefined}
  >
    {walletBlock && (() => {
      const shortfall = Math.max(0, walletBlock.charge - walletBlock.balance);
      const rechargeAmount = Math.max(MIN_RECHARGE, Math.ceil(shortfall));
      return (
        <div className="no-print print:hidden fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2.5 text-xl">⚠️</div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Insufficient Wallet Balance</h2>
                <p className="text-xs text-slate-500">
                  Your wallet must cover the service charge before the payment can start.
                </p>
              </div>
            </div>

            <div className="mb-4 space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">🎯 Service Charge</span>
                <span className="font-semibold text-gray-800">₹{walletBlock.charge}</span>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-2">
                <span className="text-gray-600">💼 Your Balance</span>
                <span className="font-semibold text-gray-800">₹{walletBlock.balance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-2">
                <span className="font-semibold text-gray-700">⚠️ Shortfall</span>
                <span className="font-bold text-red-600">₹{shortfall.toFixed(2)}</span>
              </div>
              {walletBlock.state && (
                <div className="flex justify-between pt-1">
                  <span className="text-xs text-gray-500">State</span>
                  <span className="text-xs font-semibold text-gray-700">{walletBlock.state}</span>
                </div>
              )}
            </div>

            <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
              Recharge at least <span className="font-bold">₹{rechargeAmount}</span> to continue.
              Your estimate is kept, so you can return to this preview after recharging and tap PAY TO PRINT again.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWalletBlock(null)}
                className="flex-1 cursor-pointer rounded-lg border border-slate-300 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  // Keep the estimate in localStorage: the unmount cleanup must not clear it while the user recharges
                  goingToFormRef.current = true;
                  router.push(`${WALLET_RECHARGE_ROUTE}?recharge=1&from=${encodeURIComponent("Estimate")}`);
                }}
                className="flex-1 cursor-pointer rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition hover:bg-blue-700"
              >
                Recharge Now →
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    {isMobilePreview && <div className="no-print w-full px-3">{noticesBlock}</div>}
    <div
      className="preview-scale-box"
      style={isMobilePreview ? { width: 794 * previewScale, height: scaledHeight ?? undefined, flexShrink: 0 } : undefined}
    >
    <div
      ref={printRef}
      className={`print-area print-page p-10 bg-white min-h-screen relative ${(!isPaid && !isAlreadyPaid && userCategory !== 'ADMIN') ? "is-draft" : ""}`}
      style={isMobilePreview ? { width: 794, transform: `scale(${previewScale})`, transformOrigin: "top left" } : undefined}
    >
<style jsx global>{`
  @media print {
    .preview-scale-box {
      width: auto !important;
      height: auto !important;
      display: block !important;
    }
    .print-area {
      transform: none !important;
    }
    .print-shell {
      display: block !important;
      overflow: visible !important;
      padding: 0 !important;
      margin: 0 !important;
      background: #ffffff !important;
    }
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
`}</style>

    
    {(!isPaid && !isAlreadyPaid && userCategory !== 'ADMIN') && (
      <div className="draft-watermark no-print">DRAFT</div>
    )}

    {!isMobilePreview && noticesBlock}

    <div className="mb-6 border-b-2 border-black pb-4">
      <div className="grid items-center" style={{ gridTemplateColumns: "1fr auto 1.7fr", columnGap: "8px" }}>
  {/* LEFT COLUMN: COMPANY DETAILS */}
  <div className="text-[12px] uppercase font-bold text-slate-700">
    {useCustomLetterhead ? (
      <p className="text-xl text-black font-bold uppercase">{customHeaderTitle || "ENTER HEADER TITLE"}</p>
    ) : (
      <>
        <p>T&CP 23IND-IER050924212</p>
      </>
    )}
  </div>

  {/* CENTER COLUMN: LOGO */}
<div 
  key={useCustomLetterhead ? "custom" : "default"} 
  className="flex justify-center items-center"
>
  {useCustomLetterhead ? (
    // Custom Mode ON
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
    // Custom Mode OFF
    <img src="/logo.jpg" alt="Logo" className="h-24 w-auto object-contain" />
  )}
</div>

  {/* RIGHT COLUMN: CONTACT DETAILS */}
  <div className="text-[12px] text-right font-bold text-slate-700">
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
        <textarea
  value={legalText}
  onChange={(e) => setLegalText(e.target.value)}
  // If custom mode is OFF, the field is disabled
  disabled={!useCustomLetterhead}
  className={`w-full text-sm border-none focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none text-center ${!useCustomLetterhead ? "bg-transparent cursor-default" : "bg-white"}`}
  rows={3}
/>
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
        PROPOSED CONSTRUCTION ESTIMATE FOR {sortedFloors.join(" + ")}
      </h2>
    </div>

    <div className="mb-6 space-y-2">
  <div className="flex items-start text-xs font-bold">
    <span className="w-[250px] shrink-0">CUSTOMER NAME</span>
    <span className="w-[20px]">:</span>
    <span className="uppercase flex-1">{estimate.customer_name}</span>
  </div>
  <div className="flex items-start text-xs font-bold">
    <span className="w-[250px] shrink-0">PROPERTY ADDRESS</span>
    <span className="w-[20px]">:</span>
    <span className="uppercase flex-1">{estimate.property_address}</span>
  </div>
</div>

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
          <td colSpan={2} className="border border-black p-2 font-bold">
            TOTAL BUILT UP AREA
          </td>
          <td className="border border-black p-2 text-center font-bold">
            {estimate.total_builtup_area} SQ.FT
          </td>
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
      <table className="tail-keep w-full border border-black border-collapse mt-6">
        <thead>
          <tr>
            <th className="border p-2 text-center w-10">SR</th>
            <th className="border p-2">DESCRIPTION</th>
            <th className="border p-2 text-center w-14">NOS</th>
            <th className="border p-2 text-center w-16">QTY</th>
            <th className="border p-2 text-center w-14">UNIT</th>
            <th className="border p-2 text-center w-20">RATE</th>
            <th className="border p-2 text-center w-24">AMOUNT</th>
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
                  <td className="border p-1 text-center">{index + 1}</td>
                  <td className="border p-1 capitalize">{row.description?.toLowerCase()}</td>
                  <td className="border p-1 text-center">{row.nos}</td>
                  <td className="border p-1 text-center">{row.qty}</td>
                  <td className="border p-1 text-center">{row.unit}</td>
                  <td className="border p-1 text-center">
                    {row.unit === "LS"
                      ? (showPercent ? `${calculatedPercent.toFixed(2)}%` : "-")
                      : row.rate}
                  </td>
                  <td className="border p-1 text-center">
                    {rowAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          <tr>
            <td colSpan={6} className="border p-2 font-bold text-right">TOTAL AMOUNT</td>
            <td className="border p-2 font-bold text-center">
              {estimateRows
                .reduce((sum, row) => sum + (row.unit === "LS" ? (remainingBudget * (parseFloat(row.rate.toString().replace('%', '')) / 100)) : (Number(row.qty) * Number(row.rate))), 0)
                .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>
    )}

   {/* [START NEW FEATURE] */}
<table className="keep-together w-full border border-black border-collapse mt-6">
  <tbody>
    <tr>
      <td className="border border-black p-4 w-[65%] align-top">
        <h4 className="font-bold mb-1">DISCLAIMER & TERMS:</h4>
        {useCustomLetterhead ? (
          <textarea
            value={disclaimerText}
            onChange={(e) => setDisclaimerText(e.target.value)}
            className="w-full text-sm border-none focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none bg-white"
            rows={6}
          />
        ) : (
          <div className="w-full text-xs text-justify leading-relaxed text-gray-800">
            {disclaimerText}
          </div>
        )}
      </td>
         <td className="border border-black p-4 w-[35%] align-top">
        {!useCustomLetterhead && (isPaid || isAlreadyPaid || userCategory === 'ADMIN' || signatureDetails) ? (
          <>
            {/* Horizontal Layout: QR Left, Details Right */}
          <div className="flex flex-row items-center justify-between gap-4 p-2">
            {/* QR code on the left */}
            <div className="flex flex-col items-center">
              <QRCodeSVG 
  value={`https://construction-estimate-software.vercel.app/verify-estimate?ref=${estimate?.ref_no}`} 
  size={120} 
  level="M" 
/>
              <p className="text-[8px] mt-1 text-gray-500 font-bold text-center">SCAN TO VERIFY</p>
            </div>

            {/* Signature details on the right */}
            <div className="text-[10px] text-blue-900 border border-blue-200 bg-blue-50 p-2 rounded text-left w-full shadow-sm">
              <p className="font-bold border-b border-blue-200 mb-1">✓ VERIFIED SIGNATURE</p>
              <p className="font-bold">Er. J.TOMAR</p>
              <p className="mt-1 break-words">{signatureDetails || "Digitally Verified & Approved"}</p>
            </div>
          </div>

                   {/* ✅ NEW: Manual Signature Image (Jayant Tomar) */}
          <div className="flex justify-center items-center mt-1 mb-1">
            <img 
              src="/signature-jayant-tomar.png" 
              alt="Authorised Signatory" 
              className="h-32 w-auto object-contain mix-blend-multiply" 
            />
          </div>

          {/* Authorised Signatory label below */}
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
{/* [END NEW FEATURE] */}

{!isMobilePreview && actionsBlock}
    </div>
    </div>
    {isMobilePreview && <div className="no-print w-full px-3 pb-6">{actionsBlock}</div>}
  </div>
);
}
