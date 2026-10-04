// src/app/(dashboard)/construction-plan-preview/components/PaymentGateway.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { getItemRate } from "@/lib/pricing";
import {
  createOrUpdateServiceRecord,
  updatePaymentStatus,
  isAlreadyPaid,
  ServiceRecordPayload,
} from "@/lib/service-records";

// ============================================================
// TYPES
// ============================================================
interface PaymentGatewayProps {
  refNo: string;
  /** ✅ Payment success ke baad call hoga, naya refNo return kare */
  refNoGenerator?: () => Promise<string>;
  caseType: string;
  stateName?: string;
  pricingItem?: string;
  amountOverride?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  formSnapshot?: any;
  extraFields?: Partial<ServiceRecordPayload>;
  /** ✅ 3rd param: finalRefNo (payment ke baad generate hua naya ref) */
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

  // Calculate amount from pricing table
  const amount = amountOverride ?? getItemRate(stateName, pricingItem);
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
  // HANDLE PAYMENT
  // ============================================================
  const handlePayment = useCallback(async () => {
    // Already paid → trigger success callback
    if (isPaid) {
      onPaymentSuccess?.("already_paid", "already_paid");
      return;
    }

    // ============================================================
    // ✅ ADMIN BYPASS — Admin/Engineer free print
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
    // VALIDATIONS
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
      // ✅ DIRECT RAZORPAY — Deed Drafting pattern (no server API)
      // ============================================================
      // - `amount` rupees mein hai
      // - Razorpay `amount * 100` chahiye (paise)
      // - No server-side order create needed — Razorpay directly handle karega
      // - Ref No. `handler` ke andar generate hoga (payment success ke baad)

      const razorpayKey = "rzp_test_TK9kvfQQvEx2rQ";  // test key
      // Production: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID

      // ============================================================
      // RAZORPAY CHECKOUT OPTIONS
      // ============================================================
      const options = {
        key: razorpayKey,
        amount: Math.round(amount * 100),          // ✅ paise (rupees × 100)
        currency: "INR",
        name: "LNT WITH AI 2.0",
        description: `${caseType.replace(/_/g, " ")} — ${stateName}`,
        // ✅ No `order_id` — Razorpay auto-create karega

        handler: async function (response: any) {
          try {
            console.log("[PAYMENT] Razorpay success response:", response);

            // ============================================================
            // ✅ STEP 1: Payment ke BAAD fresh refNo generate karo
            // ============================================================
            const finalRefNo = refNoGenerator ? await refNoGenerator() : refNo;
            console.log("[PAYMENT] Final ref_no:", finalRefNo);

            // ============================================================
            // ✅ STEP 2: CREATE service_records entry — SIRF payment success ke baad
            // ============================================================
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
                state_name: stateName,
                form_snapshot: formSnapshot,
                fee_mode: "Auto",
                status: "finalized",
                ...extraFields,
              });
              console.log("[SERVICE RECORD] ✅ Entry created with ref:", finalRefNo);
            } catch (recErr: any) {
              console.error("[SERVICE RECORD SAVE ERROR]", recErr);
              // Payment ho chuki hai — record fail ho to bhi user ko success dikhao
            }

            // ✅ Payment state update karo + caller ko notify karo
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
        },
        theme: {
          color: "#1e3a8a",
        },

        // ✅ CANCEL — User ne checkout band kiya
        // Error nahi dikhana — sirf loading off karo
        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
            console.log("[PAYMENT] User cancelled the checkout");
            // setPaymentError NAHI karenge
            // onPaymentError NAHI call karenge
          },
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();

      // ✅ PAYMENT FAILED — Razorpay network error / card decline
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
    customerEmail,
    customerPhone,
    formSnapshot,
    extraFields,
    currentUser,
    stateName,
    onPaymentSuccess,
    onPaymentError,
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
    amount,
    gatewayFee,
    userServiceFee,

    // Handler
    handlePayment,

    // Render helpers
    renderButton: (customText?: string, customClass?: string) => (
      <button
        onClick={handlePayment}
        disabled={paymentLoading || (!scriptLoaded && !isAdminUser)}
        className={
          customClass ||
          buttonClassName ||
          `px-4 py-1.5 text-xs font-bold transition rounded cursor-pointer ${
            paymentLoading || (!scriptLoaded && !isAdminUser)
              ? "bg-gray-400 cursor-not-allowed"
              : isPaid
              ? "bg-blue-600 hover:bg-blue-700"
              : isAdminUser
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          } text-white`
        }
      >
        {paymentLoading
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