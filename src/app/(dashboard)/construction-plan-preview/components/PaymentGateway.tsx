// src/app/(dashboard)/construction-plan-preview/components/PaymentGateway.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { fetchPricingRow, getDisplayPricing, formatPrice, PricingRow, PricingDisplay } from "@/lib/pricingFetch";
import {
  createOrUpdateServiceRecord,
  updatePaymentStatus,
  isAlreadyPaid,
  fetchPaidRecordByRef,
  checkReprintStatus,
  autoUpdatePaidRecord,
  ServiceRecordPayload,
} from "@/lib/service-records";

// ============================================================
// TYPES
// ============================================================
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

  // ============================================================
  // ✅ NEW: DB Pricing State
  // ============================================================
  const [pricingRow, setPricingRow] = useState<PricingRow | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  // ============================================================
  // ✅ NEW: Fetch pricing from DB
  // ============================================================
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

  // ✅ Display values from DB
  const display: PricingDisplay = getDisplayPricing(pricingRow);

  // ✅ Final price (jo user pay karega) — DB se, fallback override
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
  // CHECK IF ALREADY PAID
  // ============================================================
  useEffect(() => {
    const check = async () => {
      if (!refNo || refNo === "DRAFT") return;
      const paid = await isAlreadyPaid(refNo);
      if (paid) setIsPaid(true);
    };
    check();
  }, [refNo]);

  // ============================================================
  // ✅ NEW: HANDLE PAYMENT (with reprint logic)
  // ============================================================
  const handlePayment = useCallback(async () => {
    // ============================================================
    // STEP 1: Agar already paid hai (same session me) → success callback
    // ============================================================
    if (isPaid) {
      onPaymentSuccess?.("already_paid", "already_paid", refNo);
      return;
    }

    // ============================================================
    // STEP 2: Reprint Check (agar refNo valid hai)
    //   - 5 scenarios handle karo: NEW, PAID_SAME, MINOR, MAJOR, EXPIRED, ADMIN
    // ============================================================
    let reprintStatus: any = null;

    if (refNo && refNo !== "DRAFT" && currentUser?.id) {
      try {
        reprintStatus = await checkReprintStatus(
          refNo,
          { customer_name: customerName, property_address: propertyAddress },
          isAdminUser
        );

        console.log("[REPRINT CHECK]", reprintStatus);

        // ✅ CASE 1: Admin Override — print allowed
        if (reprintStatus.status === 'ADMIN_OVERRIDE') {
          setIsPaid(true);
          onPaymentSuccess?.("ADMIN_OVERRIDE", "ADMIN_OVERRIDE", refNo);
          return;
        }

        // ✅ CASE 2: Minor changes → Auto-update + print
        if (reprintStatus.status === 'PAID_MINOR_CHANGE') {
          await autoUpdatePaidRecord(refNo, {
            customer_name: customerName,
            property_address: propertyAddress,
            client_name: clientName,
            representative: representative,
            form_snapshot: formSnapshot,
            ...extraFields,
          });
          setIsPaid(true);
          onPaymentSuccess?.("MINOR_UPDATE", "MINOR_UPDATE", refNo);
          return;
        }

        // ✅ CASE 3: PAID_SAME (identical data) → Direct print
        if (reprintStatus.status === 'PAID_SAME') {
          setIsPaid(true);
          onPaymentSuccess?.("SAME_DATA", "SAME_DATA", refNo);
          return;
        }

        // ❌ CASE 4: EXPIRED or MAJOR_CHANGE → Continue to payment (fresh charge)
        if (reprintStatus.status === 'EXPIRED') {
          console.warn("[REPRINT] Expired — new payment required");
        } else if (reprintStatus.status === 'PAID_MAJOR_CHANGE') {
          console.warn("[REPRINT] Major change — new payment required:", reprintStatus.reason);
        }
      } catch (err) {
        console.error("[REPRINT CHECK ERROR]", err);
        // Continue to payment flow on error
      }
    }

    // ============================================================
    // STEP 3: ADMIN BYPASS
    // ============================================================
    if (isAdminUser) {
      try {
        const finalRefNo = refNoGenerator ? await refNoGenerator() : refNo;

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

    // ============================================================
    // STEP 4: VALIDATIONS
    // ============================================================
    if (!scriptLoaded) {
      setPaymentError("Payment gateway is loading. Please wait...");
      return;
    }

    if (!refNo) {
      setPaymentError("Reference number is missing.");
      return;
    }

    setPaymentLoading(true);
    setPaymentError("");

    try {
      // ============================================================
      // RAZORPAY CHECKOUT
      // ============================================================
      const razorpayKey =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TK9kvfQQvEx2rQ";

      const options = {
        key: razorpayKey,
        amount: Math.round(amount * 100), // paise
        currency: "INR",
        name: "LNT WITH AI 2.0",
        description: `${caseType.replace(/_/g, " ")} — ${stateName}`,

        handler: async function (response: any) {
          try {
            console.log("[PAYMENT] Razorpay success:", response);

            // ✅ Step 1: Generate fresh ref_no
            const finalRefNo = refNoGenerator ? await refNoGenerator() : refNo;

            // ✅ Step 2: Save service record
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
          ref_no: refNo,
          case_type: caseType,
          mrp: display.mrp,
          discount_percent: display.discountPercent,
        },
        theme: {
          color: "#1e3a8a",
        },

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
    isAdminUser,
    scriptLoaded,
    refNo,
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
  // RETURN OBJECT (render prop pattern)
  // ============================================================
  return {
    // State
    isPaid,
    isAdminUser,
    paymentLoading,
    paymentError,
    scriptLoaded,
    pricingLoading,

    // ✅ NEW: Pricing display values
    mrp: display.mrp,
    price: display.price,
    discountEnabled: display.discountEnabled,
    discountPercent: display.discountPercent,
    savings: display.savings,

    // Amount (backward compat)
    amount,
    gatewayFee,
    userServiceFee,

    // Handler
    handlePayment,

    // Render helpers
    renderButton: (customText?: string, customClass?: string) => (
      <button
        onClick={handlePayment}
        disabled={paymentLoading || (!scriptLoaded && !isAdminUser) || pricingLoading}
        className={
          customClass ||
          buttonClassName ||
          `px-4 py-1.5 text-xs font-bold transition rounded cursor-pointer ${
            paymentLoading || (!scriptLoaded && !isAdminUser) || pricingLoading
              ? "bg-gray-400 cursor-not-allowed"
              : isPaid
              ? "bg-blue-600 hover:bg-blue-700"
              : isAdminUser
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          } text-white`
        }
      >
        {pricingLoading
          ? "LOADING PRICE..."
          : paymentLoading
          ? "PROCESSING..."
          : isPaid
          ? "✅ PAID"
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
        {isPaid && (
          <div className="bg-green-100 border border-green-400 text-green-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ✅ Payment successful! You can now print.
          </div>
        )}
      </>
    ),
  };
}