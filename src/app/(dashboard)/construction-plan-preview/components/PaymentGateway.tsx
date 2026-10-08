// src/app/(dashboard)/construction-plan-preview/components/PaymentGateway.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
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
        } else if (status?.status === "PAID_SAME") {
          setIsPaid(true);
          setEffectiveRefNo(candidateRef);
          setReuseStatus({ type: "reuse_same", refNo: candidateRef });
        } else if (status?.status === "PAID_MINOR_CHANGE") {
          setIsPaid(true);
          setEffectiveRefNo(candidateRef);
          setReuseStatus({
            type: "reuse_minor",
            refNo: candidateRef,
            nameChange: status.nameChangePercent,
            addressChange: status.addressChangePercent,
          });
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
    const check = async () => {
      if (!effectiveRefNo || effectiveRefNo === "DRAFT") return;
      const paid = await isAlreadyPaid(effectiveRefNo);
      if (paid) setIsPaid(true);
    };
    check();
  }, [effectiveRefNo]);

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
        if (rs?.status === "PAID_MINOR_CHANGE") {
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
        if (rs?.status === "PAID_SAME") {
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
    clientName,
    representative,
    onPaymentSuccess,
    onPaymentError,
    display.mrp,
    display.discountPercent,
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
            
          </div>
        )}
      </>
    ),
  };
}