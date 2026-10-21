"use client";

/* =========================================================
   PAYMENT GATEWAY — SUBDIVISION PLAN
   ---------------------------------------------------------
   - Razorpay integration (client-side)
   - Supabase pricing_config + service_records direct use
   - 60-day / 15% reuse policy (same as construction plan)
   - Admin bypass
   - Sab kuch self-contained — koi @/lib dependency nahi
========================================================= */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

// ============================================================
// CONSTANTS
// ============================================================
const REUSE_WINDOW_DAYS = 60;
const MAX_CHANGE_PERCENT = 15;
const STORAGE_KEY = "subdivisionPlanRefNo";

// ============================================================
// TYPES
// ============================================================
export interface PaymentGatewayOptions {
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
  extraFields?: Record<string, any>;
  onPaymentSuccess?: (paymentId: string, orderId: string, finalRefNo?: string) => void;
  onPaymentError?: (error: string) => void;
  isAdmin?: boolean;
  userCategory?: string;
}

interface PricingRow {
  price: number;
  mrp: number;
  discount_enabled: boolean;
  discount_percent: number;
}

interface PricingDisplay {
  price: number;
  mrp: number;
  discountEnabled: boolean;
  discountPercent: number;
  savings: number;
}

type ReuseStatus =
  | { type: "reuse_same"; refNo: string }
  | { type: "reuse_minor"; refNo: string; nameChange?: number; addressChange?: number }
  | { type: "admin_override"; refNo: string }
  | { type: "new"; reason: "major_change" | "expired" | "none" }
  | null;

// ============================================================
// HELPERS — string difference percentage
// ============================================================
function computeChangePercent(oldStr: string, newStr: string): number {
  const a = (oldStr || "").trim().toUpperCase();
  const b = (newStr || "").trim().toUpperCase();
  if (!a && !b) return 0;
  if (a === b) return 0;
  const maxLen = Math.max(a.length, b.length, 1);
  const dist = levenshtein(a, b);
  return Math.min(100, Math.round((dist / maxLen) * 100));
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

// ============================================================
// MAIN HOOK-STYLE FUNCTION
// ============================================================
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
}: PaymentGatewayOptions) {
  const { currentUser } = useAuth();
  const isAdminUser = isAdmin || userCategory?.toUpperCase() === "ADMIN";

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentError, setPaymentError] = useState<string>("");

  const [pricingRow, setPricingRow] = useState<PricingRow | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  const [reuseStatus, setReuseStatus] = useState<ReuseStatus>(null);
  const [reuseChecking, setReuseChecking] = useState(false);
  const [effectiveRefNo, setEffectiveRefNo] = useState<string>(refNo || "DRAFT");

  // ============================================================
  // 1. LOAD RAZORPAY SCRIPT
  // ============================================================
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).Razorpay) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      console.log("[SUBDIV PAYMENT] Razorpay script loaded");
      setScriptLoaded(true);
    };
    script.onerror = () => {
      console.error("[SUBDIV PAYMENT] Script load failed");
      setPaymentError("Payment gateway load failed. Please refresh.");
    };
    document.body.appendChild(script);
  }, []);

  // ============================================================
  // 2. FETCH PRICING FROM SUPABASE
  // ============================================================
  useEffect(() => {
    let alive = true;
    (async () => {
      setPricingLoading(true);
      try {
        // Try exact state first
        let { data, error } = await supabase
          .from("pricing_config")
          .select("price, mrp, discount_enabled, discount_percent")
          .eq("case_type", caseType)
          .eq("state_name", stateName)
          .eq("active", true)
          .maybeSingle();

        // Fallback: DEFAULT row
        if (error || !data) {
          const fallback = await supabase
            .from("pricing_config")
            .select("price, mrp, discount_enabled, discount_percent")
            .eq("case_type", caseType)
            .eq("state_name", "DEFAULT")
            .eq("active", true)
            .maybeSingle();
          data = fallback.data;
        }

        // Fallback 2: highest price row
        if (!data) {
          const maxRow = await supabase
            .from("pricing_config")
            .select("price, mrp, discount_enabled, discount_percent")
            .eq("case_type", caseType)
            .eq("active", true)
            .order("price", { ascending: false })
            .limit(1)
            .maybeSingle();
          data = maxRow.data;
        }

        if (alive && data) {
          setPricingRow({
            price: Number(data.price) || 0,
            mrp: Number(data.mrp) || Number(data.price) || 0,
            discount_enabled: !!data.discount_enabled,
            discount_percent: Number(data.discount_percent) || 0,
          });
          console.log("[SUBDIV PAYMENT] Pricing loaded:", data);
        } else {
          console.warn("[SUBDIV PAYMENT] No pricing row found for:", {
            caseType,
            stateName,
          });
        }
      } catch (err) {
        console.error("[SUBDIV PAYMENT] Pricing fetch error:", err);
      } finally {
        if (alive) setPricingLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [caseType, stateName, pricingItem]);

  // Compute display pricing
  const display: PricingDisplay = (() => {
    const row = pricingRow;
    if (!row) {
      return {
        price: amountOverride ?? 0,
        mrp: amountOverride ?? 0,
        discountEnabled: false,
        discountPercent: 0,
        savings: 0,
      };
    }
    const price = amountOverride ?? row.price;
    const mrp = row.mrp || row.price;
    const savings = Math.max(0, mrp - price);
    return {
      price,
      mrp,
      discountEnabled: row.discount_enabled && row.discount_percent > 0,
      discountPercent: row.discount_percent,
      savings,
    };
  })();

  const amount = display.price;
  const gatewayFee = amount;
  const userServiceFee = 0;

  // ============================================================
  // 3. FRESH REPRINT CHECK (60-day / 15% policy)
  // ============================================================
  useEffect(() => {
    let alive = true;

    const runReuseCheck = async () => {
      setReuseChecking(true);
      try {
        const savedRef =
          typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEY)
            : null;

        const candidateRef =
          (refNo && refNo !== "DRAFT" ? refNo : null) ||
          (savedRef && savedRef !== "DRAFT" ? savedRef : null);

        console.log("[SUBDIV REUSE CHECK] candidateRef:", candidateRef);

        if (!candidateRef) {
          if (alive) {
            setReuseStatus({ type: "new", reason: "none" });
            setEffectiveRefNo("DRAFT");
          }
          return;
        }

        // Admin override
        if (isAdminUser) {
          setIsPaid(true);
          setEffectiveRefNo(candidateRef);
          setReuseStatus({ type: "admin_override", refNo: candidateRef });
          return;
        }

        // Fetch saved record
        const { data, error } = await supabase
          .from("service_records")
          .select(
            "ref_no, payment_status, customer_name, property_address, created_at, case_type"
          )
          .eq("ref_no", candidateRef)
          .maybeSingle();

        if (error || !data) {
          console.log("[SUBDIV REUSE] No saved record → new payment");
          if (alive) {
            setReuseStatus({ type: "new", reason: "none" });
            setEffectiveRefNo("DRAFT");
          }
          return;
        }

        // Not paid
        if (data.payment_status !== "paid") {
          if (alive) {
            setReuseStatus({ type: "new", reason: "none" });
            setEffectiveRefNo("DRAFT");
          }
          return;
        }

        // Case type mismatch → new payment
        if (data.case_type && data.case_type !== caseType) {
          console.log("[SUBDIV REUSE] Case type mismatch → new payment");
          if (alive) {
            setReuseStatus({ type: "new", reason: "none" });
            setEffectiveRefNo("DRAFT");
          }
          return;
        }

        // Check age (60 days)
        const created = new Date(data.created_at).getTime();
        const ageDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
        console.log("[SUBDIV REUSE] Record age (days):", Math.round(ageDays));

        if (ageDays > REUSE_WINDOW_DAYS) {
          if (alive) {
            setReuseStatus({ type: "new", reason: "expired" });
            setEffectiveRefNo("DRAFT");
          }
          return;
        }

        // Compute change percentages
        const nameChange = computeChangePercent(
          data.customer_name || "",
          customerName || ""
        );
        const addressChange = computeChangePercent(
          data.property_address || "",
          propertyAddress || ""
        );

        const maxChange = Math.max(nameChange, addressChange);
        console.log("[SUBDIV REUSE] Change %:", {
          nameChange,
          addressChange,
          maxChange,
        });

        if (maxChange === 0) {
          setIsPaid(true);
          setEffectiveRefNo(candidateRef);
          setReuseStatus({ type: "reuse_same", refNo: candidateRef });
        } else if (maxChange <= MAX_CHANGE_PERCENT) {
          setIsPaid(true);
          setEffectiveRefNo(candidateRef);
          setReuseStatus({
            type: "reuse_minor",
            refNo: candidateRef,
            nameChange,
            addressChange,
          });
        } else {
          setReuseStatus({ type: "new", reason: "major_change" });
          setEffectiveRefNo("DRAFT");
        }
      } catch (err) {
        console.error("[SUBDIV REUSE CHECK ERROR]", err);
        if (alive) {
          setReuseStatus({ type: "new", reason: "none" });
          setEffectiveRefNo("DRAFT");
        }
      } finally {
        if (alive) setReuseChecking(false);
      }
    };

    runReuseCheck();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refNo, customerName, propertyAddress, isAdminUser, caseType]);

  // ============================================================
  // 4. HANDLE PAYMENT (main entry)
  // ============================================================
  const handlePayment = useCallback(async () => {
    // ---------- CASE A: Already paid (reuse) ----------
    if (isPaid) {
      const reuseRef =
        (reuseStatus && "refNo" in reuseStatus ? reuseStatus.refNo : undefined) ||
        effectiveRefNo;

      // Minor change → update record
      if (reuseStatus?.type === "reuse_minor") {
        try {
          await supabase
            .from("service_records")
            .update({
              customer_name: customerName,
              property_address: propertyAddress,
              client_name: clientName,
              representative: representative,
              form_snapshot: formSnapshot,
              ...(extraFields || {}),
            })
            .eq("ref_no", reuseRef);
          console.log("[SUBDIV PAYMENT] Minor change updated in record");
        } catch (err) {
          console.error("[SUBDIV PAYMENT] Minor update failed:", err);
        }
      }

      onPaymentSuccess?.("already_paid", "already_paid", reuseRef);
      return;
    }

    // ---------- CASE B: Admin bypass ----------
    if (isAdminUser) {
      try {
        const finalRefNo = refNoGenerator
          ? await refNoGenerator()
          : refNo || effectiveRefNo;

        await supabase.from("service_records").upsert(
          {
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
            client_name: clientName,
            representative: representative,
            form_snapshot: formSnapshot,
            fee_mode: "Auto",
            status: "finalized",
            ...(extraFields || {}),
          },
          { onConflict: "ref_no" }
        );

        try {
          if (typeof window !== "undefined" && finalRefNo) {
            localStorage.setItem(STORAGE_KEY, finalRefNo);
          }
        } catch {}

        setIsPaid(true);
        onPaymentSuccess?.("ADMIN_FREE", "ADMIN_BYPASS", finalRefNo);
      } catch (err: any) {
        setPaymentError(err.message || "Admin bypass failed");
        onPaymentError?.(err.message);
      }
      return;
    }

    // ---------- CASE C: Validations ----------
    if (!scriptLoaded) {
      setPaymentError("Payment gateway is loading. Please wait...");
      return;
    }
    if (amount <= 0) {
      setPaymentError("Invalid amount. Please check pricing.");
      return;
    }

    setPaymentLoading(true);
    setPaymentError("");

    // ---------- CASE D: Razorpay checkout ----------
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
            console.log("[SUBDIV PAYMENT] Razorpay success:", response);

            const finalRefNo = refNoGenerator
              ? await refNoGenerator()
              : refNo || effectiveRefNo;

            await supabase.from("service_records").upsert(
              {
                ref_no: finalRefNo,
                user_id: currentUser?.id || null,
                case_type: caseType,
                payment_status: "paid",
                platform_payment_status: "paid",
                user_payment: userServiceFee,
                gateway_fee: gatewayFee,
                user_service_fee: userServiceFee,
                razorpay_order_id:
                  response.razorpay_order_id || "DIRECT_PAY",
                razorpay_payment_id: response.razorpay_payment_id,
                customer_name: customerName,
                property_address: propertyAddress,
                state_name: stateName,
                client_name: clientName,
                representative: representative,
                form_snapshot: formSnapshot,
                fee_mode: "Auto",
                status: "finalized",
                ...(extraFields || {}),
              },
              { onConflict: "ref_no" }
            );

            console.log("[SUBDIV SERVICE RECORD] ✅ Saved with ref:", finalRefNo);

            // Save ref to localStorage for reuse
            try {
              if (typeof window !== "undefined" && finalRefNo) {
                localStorage.setItem(STORAGE_KEY, finalRefNo);
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
            console.error("[SUBDIV PAYMENT HANDLER ERROR]", err);
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
        console.error("[SUBDIV PAYMENT FAILED]", response.error);
        setPaymentError(response.error.description || "Payment failed");
        setPaymentLoading(false);
        onPaymentError?.(response.error.description || "Payment failed");
      });
    } catch (err: any) {
      console.error("[SUBDIV PAYMENT ERROR]", err);
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
  // 5. RENDER STATUS MESSAGE
  // ============================================================
  const renderStatusMessage = useCallback(() => {
    return (
      <>
        {paymentError && (
          <div className="bg-red-100 border border-red-400 text-red-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ⚠️ {paymentError}
          </div>
        )}

        {isPaid && reuseStatus?.type === "reuse_same" && (
          <div className="bg-green-100 border border-green-400 text-green-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ✅ Aapne is subdivision plan ke liye pehle hi pay kar diya hai (Ref:{" "}
            {reuseStatus.refNo}). Direct print ho jayega — koi extra charge nahi.
          </div>
        )}

        {isPaid && reuseStatus?.type === "reuse_minor" && (
          <div className="bg-green-100 border border-green-400 text-green-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ✅ Chhota change detected ({Math.max(
              reuseStatus.nameChange || 0,
              reuseStatus.addressChange || 0
            )}
            %). Ref: {reuseStatus.refNo} — Direct print, koi extra charge nahi.
          </div>
        )}

        {isPaid && reuseStatus?.type === "admin_override" && (
          <div className="bg-purple-100 border border-purple-400 text-purple-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ✅ Admin override — direct print.
          </div>
        )}

        {reuseStatus?.type === "new" && reuseStatus.reason === "expired" && (
          <div className="bg-amber-100 border border-amber-400 text-amber-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ℹ️ Pichhla record {REUSE_WINDOW_DAYS} din se purana hai — naya payment
            lagega.
          </div>
        )}

        {reuseStatus?.type === "new" && reuseStatus.reason === "major_change" && (
          <div className="bg-amber-100 border border-amber-400 text-amber-800 px-3 py-2 mb-2 rounded text-xs font-bold print:hidden">
            ℹ️ Customer name / address me {MAX_CHANGE_PERCENT}% se zyada change
            hai — naya payment lagega.
          </div>
        )}
      </>
    );
  }, [paymentError, isPaid, reuseStatus]);

  // ============================================================
  // 6. RETURN OBJECT
  // ============================================================
  return {
    // State
    isPaid,
    isAdminUser,
    paymentLoading,
    paymentError,
    scriptLoaded,
    pricingLoading,
    reuseStatus,
    reuseChecking,
    effectiveRefNo,

    // Pricing display
    mrp: display.mrp,
    price: display.price,
    discountEnabled: display.discountEnabled,
    discountPercent: display.discountPercent,
    savings: display.savings,

    // Amounts
    amount,
    gatewayFee,
    userServiceFee,

    // Actions
    handlePayment,
    renderStatusMessage,

    // Ready-made button
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
          ? reuseStatus?.type === "reuse_minor" ||
            reuseStatus?.type === "reuse_same"
            ? "🖨️ PRINT (NO CHARGE)"
            : "🖨️ PRINT NOW"
          : isAdminUser
          ? "🖨️ GENERATE FREE (ADMIN)"
          : customText || `💳 PAY ₹${amount} & PRINT`}
      </button>
    ),
  };
}