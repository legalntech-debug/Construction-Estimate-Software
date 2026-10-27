// src/app/(dashboard)/construction-plan-preview/components/PaymentGateway.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  fetchPricingRow,
  getDisplayPricing,
  PricingRow,
  PricingDisplay,
} from "@/lib/pricingFetch";
import {
  createOrUpdateServiceRecord,
  isAlreadyPaid,
  checkReprintStatus,
  autoUpdatePaidRecord,
  ServiceRecordPayload,
} from "@/lib/service-records";

// ============================================================
// CONSTANTS — 60-day / 15% policy (yaha badlo, poori app me apply hoga)
// ============================================================
const REUSE_WINDOW_DAYS = 60;
const MAX_CHANGE_PERCENT = 15;

// ============================================================
// TYPES
// ============================================================
type ReuseStatus =
  | { type: "reuse_same"; refNo: string }
  | { type: "reuse_minor"; refNo: string; nameChange?: number; addressChange?: number }
  | { type: "admin_override"; refNo: string }
  | { type: "new"; reason: "major_change" | "expired" | "none"; nameChange?: number; addressChange?: number; refNo?: string }
  | null;

// ============================================================
// LOCAL CHANGE CHECK — independent enforcement of the 15% rule
//
// checkReprintStatus() may report PAID_SAME / PAID_MINOR_CHANGE without really
// measuring the change (no percentages are returned). This check compares the
// customer name and property address with the saved record and flags a major
// change, so a new Ref No. and payment are required.
// ============================================================
const normalizeForCompare = (value: string): string =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Percentage change between a saved value and a new value (0 when there is nothing to compare). */
function changePercent(savedValue: string, newValue: string): number {
  const a = normalizeForCompare(savedValue);
  const b = normalizeForCompare(newValue);
  if (!a) return 0; // no saved baseline -> cannot be measured
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return (levenshteinDistance(a, b) / maxLen) * 100;
}

type LocalChange = { nameChange: number; addressChange: number; exceeds: boolean };

async function localChangeCheck(
  refNo: string,
  customerName: string,
  propertyAddress: string
): Promise<LocalChange | null> {
  try {
    const { data, error } = await supabase
      .from("service_records")
      .select("customer_name, property_address")
      .eq("ref_no", refNo)
      .maybeSingle();

    if (error || !data) return null; // no baseline -> defer to checkReprintStatus

    const nameChange = changePercent(data.customer_name || "", customerName);
    const addressChange = changePercent(data.property_address || "", propertyAddress);
    console.log("[LOCAL CHANGE CHECK]", { refNo, nameChange, addressChange, limit: MAX_CHANGE_PERCENT });

    return {
      nameChange,
      addressChange,
      exceeds: nameChange > MAX_CHANGE_PERCENT || addressChange > MAX_CHANGE_PERCENT,
    };
  } catch (err) {
    console.error("[LOCAL CHANGE CHECK ERROR]", err);
    return null;
  }
}

// ============================================================
// WALLET GATE — runs only before a NEW ref no. / new payment is started.
// Reprints of an already paid record (same data / minor change) never reach it.
// ============================================================
const MIN_RECHARGE = 100; // Platform minimum recharge amount (INR)

type WalletBlock = { charge: number; balance: number; state: string };

// Flat shape on purpose: discriminated-union narrowing on a boolean flag
// does not work when "strict" is disabled in tsconfig.
type WalletGateResult = {
  allowed: boolean;
  block?: WalletBlock;
  message?: string;
};

/**
 * Verifies that the logged-in user's wallet balance covers the service charge
 * configured in the pricing table for the user's own (profile) state.
 * Fails closed: if the balance cannot be verified, the user is not allowed to proceed.
 */
async function verifyWalletForNewRef(args: {
  userId?: string | null;
  fallbackState: string;
  pricingItem: string;
  userCategory: string;
  amountOverride?: number;
}): Promise<WalletGateResult> {
  const { userId, fallbackState, pricingItem, userCategory, amountOverride } = args;

  if (!userId) {
    return { allowed: false, message: "Session expired. Please log in again to continue." };
  }

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, plan_type, wallet_balance, state")
      .eq("id", userId)
      .maybeSingle();

    if (error || !profile) {
      console.error("[WALLET GATE] Profile fetch failed:", error);
      return { allowed: false, message: "Unable to verify wallet balance. Please try again." };
    }

    // Admin and premium accounts are exempt (same rule as WalletGuard)
    const isAdminRole = String(profile.role || "").toLowerCase() === "admin";
    const isPremium = String(profile.plan_type || "").toUpperCase().includes("PREMIUM");
    if (isAdminRole || isPremium) return { allowed: true };

    const state = String(profile.state || fallbackState || "").toUpperCase().trim();
    const balance = Number(profile.wallet_balance ?? 0);

    // Same pricing source as the pay button, so the gate never disagrees with the price shown
    const row = await fetchPricingRow(pricingItem, state, userCategory);
    const charge = Number(amountOverride ?? getDisplayPricing(row).price ?? 0);

    console.log("[WALLET GATE]", { userId, state, balance, charge });

    if (!charge || charge <= 0 || balance >= charge) return { allowed: true };

    return { allowed: false, block: { charge, balance, state } };
  } catch (err) {
    console.error("[WALLET GATE] Unexpected error:", err);
    return { allowed: false, message: "Unable to verify wallet balance. Please try again." };
  }
}

interface PaymentGatewayProps {
  refNo: string;
  refNoGenerator?: () => Promise<string>;
  caseType: string;
  stateName?: string;
  pricingItem?: string;
  amountOverride?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  propertyAddress?: string;
  clientName?: string;
  representative?: string;
  formSnapshot?: any;
  extraFields?: Partial<ServiceRecordPayload>;
  onPaymentSuccess?: (paymentId: string, orderId: string, finalRefNo?: string) => void;
  onPaymentError?: (error: string) => void;
  isAdmin?: boolean;
  userCategory?: string;
  buttonText?: string;
  buttonClassName?: string;
}

export default function PaymentGateway({
  refNo,
  refNoGenerator,
  caseType,
  stateName = "MADHYA PRADESH",
  pricingItem = "map",
  amountOverride,
  customerName = "",
  customerEmail = "",
  customerPhone = "",
  propertyAddress = "",
  clientName = "",
  representative = "",
  formSnapshot = null,
  extraFields = {},
  onPaymentSuccess,
  onPaymentError,
  isAdmin = false,
  userCategory = "INDIVIDUAL USER",
  buttonText,
  buttonClassName,
}: PaymentGatewayProps) {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [walletBlock, setWalletBlock] = useState<WalletBlock | null>(null);
  // Ref no. paid in this browser session (skips re-verification right after a successful payment)
  const paidThisSessionRef = useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const isAdminUser = isAdmin || userCategory?.toUpperCase() === "ADMIN";
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentError, setPaymentError] = useState<string>("");

  // ✅ NEW: reuse/reprint status — page.tsx me banner dikhane ke liye
  const [reuseStatus, setReuseStatus] = useState<ReuseStatus>(null);
  const [reuseChecking, setReuseChecking] = useState(false);
  const [effectiveRefNo, setEffectiveRefNo] = useState<string>(refNo || "DRAFT");

  // ============================================================
  // DB Pricing State
  // ============================================================
  const [pricingRow, setPricingRow] = useState<PricingRow | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPricingLoading(true);
      try {
        const row = await fetchPricingRow(pricingItem, stateName, userCategory);
        if (alive) setPricingRow(row);
      } catch (err) {
        console.error("[PRICING FETCH ERROR]", err);
      } finally {
        if (alive) setPricingLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pricingItem, stateName, userCategory]);

  const display: PricingDisplay = getDisplayPricing(pricingRow);
  const amount = amountOverride ?? display.price ?? 0;
  const gatewayFee = amount;
  const userServiceFee = 0;

  // ============================================================
  // LOAD RAZORPAY SCRIPT
  // ============================================================
  useEffect(() => {
    if ((window as any).Razorpay) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      console.log("[PAYMENT GATEWAY] Razorpay script loaded");
      setScriptLoaded(true);
    };
    script.onerror = () => {
      console.error("[PAYMENT GATEWAY] Script load failed");
      setPaymentError("Payment gateway load failed. Please refresh.");
    };
    document.body.appendChild(script);
  }, []);

  // ============================================================
  // ✅ FRESH REPRINT CHECK ON MOUNT (60-day / 15% rule)
  //    - refNo DRAFT ho to localStorage ka saved ref use karo
  //    - checkReprintStatus se decide karo: reuse vs new payment
  // ============================================================
  useEffect(() => {
    let alive = true;

    const runReuseCheck = async () => {
      setReuseChecking(true);
      // Never carry an earlier approval into a fresh verification: customer name /
      // address may have changed, and only the new result may unlock printing.
      setIsPaid(false);
      try {
        // 1) refNo param se lo, warna localStorage ka saved ref
        const savedRef = typeof window !== "undefined"
          ? localStorage.getItem("constructionPlanRefNo")
          : null;

        const candidateRef =
          (refNo && refNo !== "DRAFT" ? refNo : null) ||
          (savedRef && savedRef !== "DRAFT" ? savedRef : null);

        if (!candidateRef) {
          if (alive) {
            setReuseStatus({ type: "new", reason: "none" });
            setEffectiveRefNo("DRAFT");
          }
          return;
        }

        // Just paid in this session -> keep it unlocked, no re-verification needed
        if (candidateRef === paidThisSessionRef.current) {
          if (alive) {
            setIsPaid(true);
            setEffectiveRefNo(candidateRef);
          }
          return;
        }

        // 2) Server side reprint check
        const status: any = await checkReprintStatus(
          candidateRef,
          { customer_name: customerName, property_address: propertyAddress },
          isAdminUser
        );
        if (!alive) return;

        console.log("[PAYMENT GATEWAY / REUSE CHECK]", { candidateRef, status });

        // 3) Map status to our state
        if (status?.status === "ADMIN_OVERRIDE") {
          setIsPaid(true);
          setEffectiveRefNo(candidateRef);
          setReuseStatus({ type: "admin_override", refNo: candidateRef });
        } else if (status?.status === "PAID_SAME" || status?.status === "PAID_MINOR_CHANGE") {
          // Independent 15% verification against the saved record
          const local = await localChangeCheck(candidateRef, customerName, propertyAddress);
          if (!alive) return;

          if (local?.exceeds) {
            // Name / address changed beyond the limit -> new Ref No. + payment
            setEffectiveRefNo("DRAFT");
            setReuseStatus({
              type: "new",
              reason: "major_change",
              nameChange: local.nameChange,
              addressChange: local.addressChange,
            });
          } else if (status?.status === "PAID_SAME") {
            setIsPaid(true);
            setEffectiveRefNo(candidateRef);
            setReuseStatus({ type: "reuse_same", refNo: candidateRef });
          } else {
            setIsPaid(true);
            setEffectiveRefNo(candidateRef);
            setReuseStatus({
              type: "reuse_minor",
              refNo: candidateRef,
              nameChange: status.nameChangePercent ?? local?.nameChange,
              addressChange: status.addressChangePercent ?? local?.addressChange,
            });
          }
        } else if (status?.status === "EXPIRED") {
          setEffectiveRefNo("DRAFT");
          setReuseStatus({
            type: "new",
            reason: "expired",
            nameChange: status.nameChangePercent,
            addressChange: status.addressChangePercent,
          });
        } else if (status?.status === "PAID_MAJOR_CHANGE") {
          setEffectiveRefNo("DRAFT");
          setReuseStatus({
            type: "new",
            reason: "major_change",
            nameChange: status.nameChangePercent,
            addressChange: status.addressChangePercent,
          });
        } else {
          // unknown — fail safe to new
          setEffectiveRefNo("DRAFT");
          setReuseStatus({ type: "new", reason: "none" });
        }
      } catch (err) {
        console.error("[PAYMENT GATEWAY / REUSE CHECK ERROR]", err);
        // Fail-closed: error par naya payment maango
        if (alive) {
          setEffectiveRefNo("DRAFT");
          setReuseStatus({ type: "new", reason: "none" });
        }
      } finally {
        if (alive) setReuseChecking(false);
      }
    };

    runReuseCheck();
    return () => {
      alive = false;
    };
  }, [refNo, customerName, propertyAddress, isAdminUser]);

  // ============================================================
  // CHECK IF ALREADY PAID (fallback for effectiveRefNo)
  // ============================================================
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (!effectiveRefNo || effectiveRefNo === "DRAFT") return;
      // Only confirm refs that the reuse check already approved. A "new" status
      // (major change / expired) must never be unlocked by this fallback.
      if (!reuseStatus || reuseStatus.type === "new") return;
      const paid = await isAlreadyPaid(effectiveRefNo);
      if (alive && paid) setIsPaid(true);
    };
    check();
    return () => {
      alive = false;
    };
  }, [effectiveRefNo, reuseStatus]);

  // ============================================================
  // HANDLE PAYMENT
  // ============================================================
  const handlePayment = useCallback(async () => {
    // STEP 1: already paid (reuse_same / minor / admin_override)
    if (isPaid) {
      // Minor change ho to record update karo, phir print
      if (reuseStatus?.type === "reuse_minor") {
        try {
          await autoUpdatePaidRecord(reuseStatus.refNo, {
            customer_name: customerName,
            property_address: propertyAddress,
            client_name: clientName,
            representative: representative,
            form_snapshot: formSnapshot,
            ...extraFields,
          });
        } catch (err) {
          console.error("[AUTO UPDATE MINOR CHANGE ERROR]", err);
        }
      }
           const reuseRef = (reuseStatus && "refNo" in reuseStatus ? reuseStatus.refNo : undefined) || effectiveRefNo;
      onPaymentSuccess?.("already_paid", "already_paid", reuseRef);
      return;
    }

    // STEP 2: Fresh reprint check again (in case user ka data badal gaya ho)
    if (effectiveRefNo && effectiveRefNo !== "DRAFT" && currentUser?.id) {
      try {
        const rs: any = await checkReprintStatus(
          effectiveRefNo,
          { customer_name: customerName, property_address: propertyAddress },
          isAdminUser
        );
        console.log("[HANDLE PAYMENT / REUSE CHECK]", rs);

        if (rs?.status === "ADMIN_OVERRIDE") {
          setIsPaid(true);
          onPaymentSuccess?.("ADMIN_OVERRIDE", "ADMIN_OVERRIDE", effectiveRefNo);
          return;
        }
        // Independent 15% verification: a major change must fall through to a new payment
        let localExceeds = false;
        if (rs?.status === "PAID_MINOR_CHANGE" || rs?.status === "PAID_SAME") {
          const local = await localChangeCheck(effectiveRefNo, customerName, propertyAddress);
          localExceeds = !!local?.exceeds;
        }

        if (!localExceeds && rs?.status === "PAID_MINOR_CHANGE") {
          await autoUpdatePaidRecord(effectiveRefNo, {
            customer_name: customerName,
            property_address: propertyAddress,
            client_name: clientName,
            representative: representative,
            form_snapshot: formSnapshot,
            ...extraFields,
          });
          setIsPaid(true);
          onPaymentSuccess?.("MINOR_UPDATE", "MINOR_UPDATE", effectiveRefNo);
          return;
        }
        if (!localExceeds && rs?.status === "PAID_SAME") {
          setIsPaid(true);
          onPaymentSuccess?.("SAME_DATA", "SAME_DATA", effectiveRefNo);
          return;
        }
        if (rs?.status === "EXPIRED") {
          console.warn("[REPRINT] Expired — new payment required");
        } else if (rs?.status === "PAID_MAJOR_CHANGE") {
          console.warn("[REPRINT] Major change — new payment required:", rs.reason);
        }
      } catch (err) {
        console.error("[REPRINT CHECK ERROR]", err);
      }
    }

    // STEP 3: ADMIN BYPASS
    if (isAdminUser) {
      try {
        const finalRefNo = refNoGenerator ? await refNoGenerator() : refNo || effectiveRefNo;
        await createOrUpdateServiceRecord({
          ref_no: finalRefNo,
          user_id: currentUser?.id || null,
          case_type: caseType,
          payment_status: "paid",
          platform_payment_status: "admin_bypass",
          user_payment: 0,
          gateway_fee: 0,
          user_service_fee: 0,
          razorpay_order_id: "ADMIN_BYPASS",
          razorpay_payment_id: "ADMIN_FREE",
          customer_name: customerName,
          property_address: propertyAddress,
          state_name: stateName,
          form_snapshot: formSnapshot,
          fee_mode: "Auto",
          status: "finalized",
          ...extraFields,
        });
        paidThisSessionRef.current = finalRefNo;
        setIsPaid(true);
        onPaymentSuccess?.("ADMIN_FREE", "ADMIN_BYPASS", finalRefNo);
      } catch (err: any) {
        setPaymentError(err.message || "Admin bypass failed");
        onPaymentError?.(err.message);
      }
      return;
    }

    // STEP 4: VALIDATIONS
    if (!scriptLoaded) {
      setPaymentError("Payment gateway is loading. Please wait...");
      return;
    }
    if (!refNo && !effectiveRefNo) {
      setPaymentError("Reference number is missing.");
      return;
    }

    // STEP 4.5: WALLET GATE
    // Reaching this point means a new ref no. / new payment is required
    // (fresh case, major change, or expired record). Block if the wallet
    // balance is below the service charge for the user's state.
    setPaymentLoading(true);
    setPaymentError("");
    setWalletBlock(null);

    const gate = await verifyWalletForNewRef({
      userId: currentUser?.id,
      fallbackState: stateName,
      pricingItem,
      userCategory,
      amountOverride,
    });

    if (!gate.allowed) {
      setPaymentLoading(false);
      if (gate.block) setWalletBlock(gate.block);
      else setPaymentError(gate.message || "Unable to verify wallet balance.");
      return;
    }

    setPaymentLoading(true);
    setPaymentError("");

    try {
      const razorpayKey =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TK9kvfQQvEx2rQ";

      const options = {
        key: razorpayKey,
        amount: Math.round(amount * 100),
        currency: "INR",
        name: "LNT WITH AI 2.0",
        description: `${caseType.replace(/_/g, " ")} — ${stateName}`,

        handler: async function (response: any) {
          try {
            console.log("[PAYMENT] Razorpay success:", response);
            const finalRefNo = refNoGenerator ? await refNoGenerator() : (refNo || effectiveRefNo);

            try {
              await createOrUpdateServiceRecord({
                ref_no: finalRefNo,
                user_id: currentUser?.id || null,
                case_type: caseType,
                payment_status: "paid",
                platform_payment_status: "paid",
                user_payment: userServiceFee,
                gateway_fee: gatewayFee,
                user_service_fee: userServiceFee,
                razorpay_order_id: response.razorpay_order_id || "DIRECT_PAY",
                razorpay_payment_id: response.razorpay_payment_id,
                customer_name: customerName,
                property_address: propertyAddress,
                state_name: stateName,
                form_snapshot: formSnapshot,
                fee_mode: "Auto",
                status: "finalized",
                ...extraFields,
              });
              console.log("[SERVICE RECORD] ✅ Saved with ref:", finalRefNo);
            } catch (recErr: any) {
              console.error("[SERVICE RECORD SAVE ERROR]", recErr);
            }

            // localStorage me ref save karo taaki next visit par reuse ho
            try {
              if (typeof window !== "undefined" && finalRefNo) {
                localStorage.setItem("constructionPlanRefNo", finalRefNo);
              }
            } catch {}

            paidThisSessionRef.current = finalRefNo;
            setIsPaid(true);
            setPaymentLoading(false);
            onPaymentSuccess?.(
              response.razorpay_payment_id,
              response.razorpay_order_id || "DIRECT_PAY",
              finalRefNo
            );
          } catch (err: any) {
            console.error("[PAYMENT HANDLER ERROR]", err);
            setPaymentError(err.message || "Payment processing failed");
            setPaymentLoading(false);
            onPaymentError?.(err.message);
          }
        },

        prefill: {
          name: customerName || "",
          email: customerEmail || "",
          contact: customerPhone || "",
        },
        notes: {
          ref_no: effectiveRefNo,
          case_type: caseType,
          mrp: display.mrp,
          discount_percent: display.discountPercent,
        },
        theme: { color: "#1e3a8a" },

        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
          },
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();

      razorpay.on("payment.failed", function (response: any) {
        console.error("[PAYMENT FAILED]", response.error);
        setPaymentError(response.error.description || "Payment failed");
        setPaymentLoading(false);
        onPaymentError?.(response.error.description || "Payment failed");
      });
    } catch (err: any) {
      console.error("[PAYMENT ERROR]", err);
      setPaymentError(err.message || "Payment failed");
      setPaymentLoading(false);
      onPaymentError?.(err.message || "Payment failed");
    }
  }, [
    isPaid,
    reuseStatus,
    isAdminUser,
    scriptLoaded,
    refNo,
    effectiveRefNo,
    refNoGenerator,
    caseType,
    amount,
    gatewayFee,
    userServiceFee,
    customerName,
    propertyAddress,
    customerEmail,
    customerPhone,
    formSnapshot,
    extraFields,
    currentUser,
    stateName,
    pricingItem,
    userCategory,
    amountOverride,
    clientName,
    representative,
    onPaymentSuccess,
    onPaymentError,
    display.mrp,
    display.discountPercent,
  ]);

  // ============================================================
  // ✅ SYNC LATEST DATA TO THE SAVED (PAID) RECORD
  //
  // Reopen -> edit -> print: jab record pehle se paid hai (reuse_same / reuse_minor /
  // admin_override), "Print" button seedha print/PDF chalata hai aur handlePayment()
  // tak jata hi nahi. autoUpdatePaidRecord sirf handlePayment ke andar (aur sirf
  // reuse_minor par) chalta tha -> naya form_snapshot (dimension / rooms / shape)
  // kabhi DB me save nahi hota tha, aur agli baar reopen par purana plan aata tha.
  // Name/address ka 15% rule checkReprintStatus hi dekhta hai, plan geometry ko nahi,
  // isliye "reuse_same" me bhi snapshot update hona chahiye.
  // Print / PDF se pehle page.tsx isse call karta hai.
  // ============================================================
  const syncPaidRecord = useCallback(async (): Promise<boolean> => {
    const ref = effectiveRefNo;
    if (!ref || ref === "DRAFT") return true; // naya / unsaved draft -> payment flow create karega
    if (!isPaid) return true;
    // major change / expired => naya ref + payment lagega, purane record ko mat chedo
    if (reuseStatus?.type === "new" && paidThisSessionRef.current !== ref) return true;
    try {
      await autoUpdatePaidRecord(ref, {
        customer_name: customerName,
        property_address: propertyAddress,
        client_name: clientName,
        representative: representative,
        form_snapshot: formSnapshot,
        ...extraFields,
      });
      console.log("[SYNC PAID RECORD] saved latest plan to", ref);
      return true;
    } catch (err) {
      console.error("[SYNC PAID RECORD ERROR]", err);
      return false;
    }
  }, [
    effectiveRefNo, isPaid, reuseStatus,
    customerName, propertyAddress, clientName, representative,
    formSnapshot, extraFields,
  ]);

  // ============================================================
  // RETURN OBJECT
  // ============================================================
  return {
    // State
    isPaid,
    isAdminUser,
    paymentLoading,
    paymentError,
    scriptLoaded,
    pricingLoading,

    // ✅ NEW: reuse state
    reuseStatus,
    reuseChecking,
    effectiveRefNo,

    // Pricing display
    mrp: display.mrp,
    price: display.price,
    discountEnabled: display.discountEnabled,
    discountPercent: display.discountPercent,
    savings: display.savings,

    amount,
    gatewayFee,
    userServiceFee,

    handlePayment,
    syncPaidRecord,

    renderButton: (customText?: string, customClass?: string) => (
      <button
        onClick={handlePayment}
        disabled={
          reuseChecking ||
          paymentLoading ||
          (!scriptLoaded && !isAdminUser && !isPaid) ||
          pricingLoading
        }
        className={
          customClass ||
          buttonClassName ||
          `px-4 py-1.5 text-xs font-bold transition rounded cursor-pointer ${
            reuseChecking ||
            paymentLoading ||
            (!scriptLoaded && !isAdminUser && !isPaid) ||
            pricingLoading
              ? "bg-gray-400 cursor-not-allowed"
              : isPaid
              ? "bg-blue-600 hover:bg-blue-700"
              : isAdminUser
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          } text-white`
        }
      >
        {reuseChecking
          ? "CHECKING PREVIOUS RECORD..."
          : pricingLoading
          ? "LOADING PRICE..."
          : paymentLoading
          ? "PROCESSING..."
          : isPaid
          ? reuseStatus?.type === "reuse_minor"
            ? "🖨️ PRINT (NO CHARGE)"
            : reuseStatus?.type === "reuse_same"
            ? "🖨️ PRINT (NO CHARGE)"
            : "🖨️ PRINT NOW"
          : isAdminUser
          ? "🖨️ GENERATE FREE (ADMIN)"
          : customText || buttonText || `💳 PAY ₹${amount} & PRINT`}
      </button>
    ),

    renderStatusMessage: () => (
      <>
        {walletBlock && (() => {
          const shortfall = Math.max(0, walletBlock.charge - walletBlock.balance);
          const rechargeAmount = Math.max(MIN_RECHARGE, Math.ceil(shortfall));
          return (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4 print:hidden">
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-full bg-amber-100 p-2.5 text-xl">⚠️</div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Insufficient Wallet Balance</h2>
                    <p className="text-xs text-slate-500">
                      A new reference number cannot be generated until your wallet covers the service charge.
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
                  Your changes are saved, so you can return to this preview after recharging.
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
                    onClick={() =>
                      router.push(`/wallet-ledger?recharge=1&from=${encodeURIComponent("Construction Plan")}`)
                    }
                    className="flex-1 cursor-pointer rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition hover:bg-blue-700"
                  >
                    Recharge Now →
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
        {paymentError && (
          <div className="bg-red-100 border border-red-400 text-red-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ⚠️ {paymentError}
          </div>
        )}
        {isPaid && reuseStatus?.type === "reuse_same" && (
          <div className="bg-green-100 border border-green-400 text-green-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ✅ Aapne is plan ke liye pehle hi pay kar diya hai (Ref: {reuseStatus.refNo}). Direct print ho jayega — koi extra charge nahi.
          </div>
        )}
        {isPaid && reuseStatus?.type === "reuse_minor" && (
          <div className="bg-green-100 border border-green-400 text-green-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ✅ Minor change (within {MAX_CHANGE_PERCENT}%) — same Ref {reuseStatus.refNo}, no extra charge.
            {typeof reuseStatus.nameChange === "number" && ` Name changed: ${Math.round(reuseStatus.nameChange)}%.`}
            {typeof reuseStatus.addressChange === "number" && ` Address changed: ${Math.round(reuseStatus.addressChange)}%.`}
          </div>
        )}
        {isPaid && reuseStatus?.type === "admin_override" && (
          <div className="bg-purple-100 border border-purple-400 text-purple-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ✅ Admin override — direct print.
          </div>
        )}
        {reuseStatus?.type === "new" && reuseStatus.reason === "expired" && (
          <div className="bg-amber-100 border border-amber-400 text-amber-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ℹ️ Pichhla record {REUSE_WINDOW_DAYS} din se purana hai — naya payment lagega.
          </div>
        )}
        {reuseStatus?.type === "new" && reuseStatus.reason === "major_change" && (
          <div className="bg-amber-100 border border-amber-400 text-amber-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ℹ️ Customer name / address changed by more than {MAX_CHANGE_PERCENT}% — a new Ref No. and payment are required.
            {typeof reuseStatus.nameChange === "number" && ` Name changed: ${Math.round(reuseStatus.nameChange)}%.`}
            {typeof reuseStatus.addressChange === "number" && ` Address changed: ${Math.round(reuseStatus.addressChange)}%.`}
          </div>
        )}
      </>
    ),
  };
}