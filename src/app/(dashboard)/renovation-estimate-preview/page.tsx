"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { QRCodeSVG } from 'qrcode.react';
import { fetchPricingRow, getDisplayPricing } from "@/lib/pricingFetch";   // ✅ NEW
import { getItemRate } from "@/lib/pricing";                              // ✅ NEW

// Helper function to check percentage change in length of name or address
const calculatePercentageChange = (str1: string, str2: string) => {
  if (!str1 || !str2) return 100;
  const len1 = str1.trim().length;
  const len2 = str2.trim().length;
  if (len1 === 0 && len2 === 0) return 0;
  const diff = Math.abs(len1 - len2);
  return (diff / Math.max(len1, len2)) * 100;
};

const slabConfig: any = {
  600:  { door: 0.15, paint: 0.15, plumb: 0.22, elec: 0.22, floor: 0.26},
  700:  { door: 0.1, paint: 0.12, ms: 0.1, plumb: 0.12, elec: 0.12, floor: 0.18, kitchen: 0.26},
  800:  { door: 0.1, paint: 0.12, ms: 0.1, plumb: 0.12, elec: 0.12, floor: 0.15, ceiling: 0.08, kitchen: 0.15, furnish: 0.06},
  900:  { door: 0.08, paint: 0.12, ms: 0.08, plumb: 0.12, elec: 0.12, floor: 0.15, ceiling: 0.08, kitchen: 0.12, furnish: 0.13},
  1000:  { door: 0.08, paint: 0.1, ms: 0.08, plumb: 0.12, elec: 0.12, floor: 0.15, ceiling: 0.06, kitchen: 0.08, furnish: 0.1, water: 0.11},
  1100:  { door: 0.07, paint: 0.09, ms: 0.07, plumb: 0.12, elec: 0.12, floor: 0.15, ceiling: 0.05, kitchen: 0.12, furnish: 0.1, water: 0.08, cons: 0.03},
  1200:  { door: 0.07, paint: 0.09, ms: 0.07, plumb: 0.12, elec: 0.12, floor: 0.13, ceiling: 0.05, kitchen: 0.08, furnish: 0.1, water: 0.08, cons: 0.03, bore: 0.06},
  1300:  { door: 0.07, paint: 0.09, ms: 0.07, plumb: 0.12, elec: 0.12, floor: 0.12, ceiling: 0.05, kitchen: 0.08, furnish: 0.11, water: 0.08, cons: 0.03, bore: 0.06},
  1400:  { door: 0.07, paint: 0.08, ms: 0.07, plumb: 0.12, elec: 0.1, floor: 0.1, ceiling: 0.05, kitchen: 0.08, furnish: 0.15, water: 0.08, cons: 0.04, bore: 0.06},
  1500:  { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.1, elec: 0.1, floor: 0.1, ceiling: 0.05, kitchen: 0.1, furnish: 0.18, water: 0.08, cons: 0.04, bore: 0.06},
  1600:  { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.1, ceiling: 0.05, kitchen: 0.1, furnish: 0.18, water: 0.08, cons: 0.04, bore: 0.06},
  1700:  { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.06, elec: 0.06, floor: 0.08, ceiling: 0.04, kitchen: 0.06, furnish: 0.08, water: 0.06, cons: 0.04, bore: 0.04, lift: 0.35},
  1800:  { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.06, elec: 0.06, floor: 0.09, ceiling: 0.04, kitchen: 0.18, furnish: 0.3, water: 0.06, cons: 0.04, bore: 0.05,  },
  1900:  { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.06, elec: 0.06, floor: 0.09, ceiling: 0.04, kitchen: 0.18, furnish: 0.3, water: 0.06, cons: 0.04, bore: 0.05,  },
  2000:  { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.06, elec: 0.06, floor: 0.09, ceiling: 0.04, kitchen: 0.18, furnish: 0.3, water: 0.06, cons: 0.04, bore: 0.05,  },
  2100:  { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.06, elec: 0.06, floor: 0.09, ceiling: 0.04, kitchen: 0.18, furnish: 0.3, water: 0.06, cons: 0.04, bore: 0.05,  },
  2200:  { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.06, elec: 0.06, floor: 0.09, ceiling: 0.04, kitchen: 0.18, furnish: 0.3, water: 0.06, cons: 0.04, bore: 0.05,  },
  2300:  { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.06, elec: 0.06, floor: 0.1, ceiling: 0.04, kitchen: 0.18, furnish: 0.31, water: 0.05, cons: 0.04, bore: 0.04,  },
  2400:  { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.06, elec: 0.06, floor: 0.1, ceiling: 0.04, kitchen: 0.18, furnish: 0.31, water: 0.05, cons: 0.04, bore: 0.04,  },
  2500:  { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.06, elec: 0.06, floor: 0.1, ceiling: 0.04, kitchen: 0.18, furnish: 0.31, water: 0.05, cons: 0.04, bore: 0.04,  },
  2600:  { door: 0.04, paint: 0.03, ms: 0.03, plumb: 0.055, elec: 0.055, floor: 0.07, ceiling: 0.04, kitchen: 0.12, furnish: 0.15, water: 0.05, cons: 0.03, bore: 0.03, lift: 0.31 },
  2700:  { door: 0.04, paint: 0.03, ms: 0.03, plumb: 0.055, elec: 0.055, floor: 0.07, ceiling: 0.04, kitchen: 0.12, furnish: 0.15, water: 0.05, cons: 0.03, bore: 0.03, lift: 0.31 },
  2800:  { door: 0.04, paint: 0.03, ms: 0.03, plumb: 0.055, elec: 0.055, floor: 0.07, ceiling: 0.04, kitchen: 0.12, furnish: 0.15, water: 0.05, cons: 0.03, bore: 0.03, lift: 0.31 },
  2900:  { door: 0.04, paint: 0.03, ms: 0.03, plumb: 0.055, elec: 0.055, floor: 0.07, ceiling: 0.04, kitchen: 0.12, furnish: 0.15, water: 0.05, cons: 0.03, bore: 0.03, lift: 0.31 },
  3000:  { door: 0.04, paint: 0.03, ms: 0.03, plumb: 0.055, elec: 0.055, floor: 0.07, ceiling: 0.04, kitchen: 0.12, furnish: 0.15, water: 0.05, cons: 0.03, bore: 0.03, lift: 0.31 },
  3100:  { door: 0.04, paint: 0.03, ms: 0.03, plumb: 0.05, elec: 0.05, floor: 0.06, ceiling: 0.04, kitchen: 0.12, furnish: 0.18, water: 0.04, cons: 0.03, bore: 0.03, lift: 0.31 },
  3200:  { door: 0.04, paint: 0.03, ms: 0.03, plumb: 0.05, elec: 0.05, floor: 0.06, ceiling: 0.04, kitchen: 0.12, furnish: 0.18, water: 0.04, cons: 0.03, bore: 0.03, lift: 0.31 },
  3300:  { door: 0.04, paint: 0.03, ms: 0.03, plumb: 0.05, elec: 0.05, floor: 0.06, ceiling: 0.04, kitchen: 0.12, furnish: 0.18, water: 0.04, cons: 0.03, bore: 0.03, lift: 0.31 },
  3400:  { door: 0.04, paint: 0.025, ms: 0.03, plumb: 0.05, elec: 0.05, floor: 0.06, ceiling: 0.04, kitchen: 0.12, furnish: 0.185, water: 0.04, cons: 0.03, bore: 0.03, lift: 0.31 },
  3500:  { door: 0.04, paint: 0.025, ms: 0.03, plumb: 0.05, elec: 0.05, floor: 0.06, ceiling: 0.04, kitchen: 0.12, furnish: 0.185, water: 0.04, cons: 0.03, bore: 0.03, lift: 0.31 },
  3600:  { door: 0.04, paint: 0.02, ms: 0.03, plumb: 0.05, elec: 0.04, floor: 0.06, ceiling: 0.04, kitchen: 0.11, furnish: 0.26, water: 0.03, cons: 0.03, bore: 0.025, lift: 0.265 },
  3700:  { door: 0.04, paint: 0.02, ms: 0.03, plumb: 0.05, elec: 0.04, floor: 0.06, ceiling: 0.04, kitchen: 0.11, furnish: 0.26, water: 0.03, cons: 0.03, bore: 0.025, lift: 0.265 },
  3800:  { door: 0.04, paint: 0.02, ms: 0.03, plumb: 0.05, elec: 0.04, floor: 0.06, ceiling: 0.04, kitchen: 0.11, furnish: 0.26, water: 0.03, cons: 0.03, bore: 0.025, lift: 0.265 },
  3900:  { door: 0.04, paint: 0.02, ms: 0.03, plumb: 0.05, elec: 0.04, floor: 0.06, ceiling: 0.04, kitchen: 0.11, furnish: 0.26, water: 0.03, cons: 0.03, bore: 0.025, lift: 0.265 },
  4000:  { door: 0.04, paint: 0.02, ms: 0.03, plumb: 0.05, elec: 0.04, floor: 0.06, ceiling: 0.04, kitchen: 0.11, furnish: 0.26, water: 0.03, cons: 0.03, bore: 0.025, lift: 0.265 },
  4100:  { door: 0.04, paint: 0.02, ms: 0.03, plumb: 0.05, elec: 0.04, floor: 0.06, ceiling: 0.04, kitchen: 0.11, furnish: 0.26, water: 0.03, cons: 0.03, bore: 0.025, lift: 0.265 }
};

export default function RenovationEstimatePreview() {
  const router = useRouter();
  const { currentUser, setCurrentUser } = useAuth();

  const [estimate, setEstimate] = useState<any>(null);
  const [selectedPlotMaster, setSelectedPlotMaster] = useState<any>(null);
  const [totalColumnNos, setTotalColumnNos] = useState(0);
  const [renovationMasterItem, setRenovationMasterItem] = useState<any>(null);

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
  const userCategory = (currentUser?.user_type || 'RENOVATION USER').toUpperCase();
  const [isFinalized, setIsFinalized] = useState(false);

  const [finalFee, setFinalFee] = useState(150);
  const [currentRefNo, setCurrentRefNo] = useState("LNT/26-27/...");
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false);

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

  // Safe LocalStorage read for Next.js SSR
  const savedData = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem("renovationEstimatePreview") || localStorage.getItem("RenovationEstimatePreview") || "{}") 
    : {};
  
  const propertyTypeVal = String(estimate?.property_type || savedData?.property_type || "HOUSE").trim().toUpperCase();

  const totalBuiltupSqFt = propertyTypeVal === 'HOUSE' 
    ? (estimate?.selected_floors || savedData?.selected_floors || []).reduce((sum: number, floor: string) => {
        const floorArea = estimate?.floor_details?.[floor]?.area || savedData?.floor_details?.[floor]?.area || 0;
        return sum + floorArea;
      }, 0)
    : parseFloat(estimate?.plot_area || savedData?.plot_area || estimate?.total_builtup_area || savedData?.total_builtup_area || 0);

  const builtupAreaSqMt = totalBuiltupSqFt / 10.764;

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
          console.log(`💰 [RENOVATION DB PRICING] ${targetState} = ₹${display.price}`);
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
          console.log(`⚠️ [RENOVATION FALLBACK PRICING] ${targetState} = ₹${fallbackPrice}`);
        }
      } catch (err) {
        console.error("[RENOVATION PRICING FETCH ERROR]", err);
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

  const checkEstimatePaymentStatus = async (refNo: string) => {
    if (!refNo) return;
    try {
      const { data: estData } = await supabase
        .from('estimates')
        .select('platform_payment_status, payment_status, status')
        .eq('ref_no', refNo)
        .maybeSingle();

      if (estData && (estData.platform_payment_status === 'paid' || estData.payment_status === 'paid' || estData.status === 'paid')) {
        setIsAlreadyPaid(true);
        setIsPaid(true);
        setRequiresPayment(false);
        return;
      }

      const { data: misData } = await supabase
        .from('mis_records')
        .select('platform_payment_status')
        .eq('ref_no', refNo)
        .maybeSingle();

      if (misData && misData.platform_payment_status === 'paid') {
        setIsAlreadyPaid(true);
        setIsPaid(true);
        setRequiresPayment(false);
      }
    } catch (err) {
      console.error("Error checking payment status:", err);
    }
  };

  useEffect(() => {
    const loadEstimateFromStorage = async () => {
      try {
        const rawData = typeof window !== 'undefined' 
          ? localStorage.getItem("renovationEstimatePreview") || localStorage.getItem("RenovationEstimatePreview")
          : null;

        if (rawData) {
          const parsedData = JSON.parse(rawData);
          setEstimate(parsedData);
          
          // ✅ NEW: Set state from estimate
          const resolvedState =
            parsedData.state_name ||
            parsedData.state ||
            parsedData.stateName ||
            currentUser?.state ||
            "MADHYA PRADESH";
          setEstimateStateName(resolvedState);

          if (parsedData?.ref_no) {
            setCurrentRefNo(parsedData.ref_no);
            await checkEstimatePaymentStatus(parsedData.ref_no);
          }
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

  const handleSaveAndPrint = async () => {
    setIsSaving(true);
    try {
      await handleSaveAndFinalize();
      window.print();
      setTimeout(() => { router.push('/dashboard'); }, 5000);
    } catch (error) {
      console.error("Save failed", error);
    } finally {
      setIsSaving(false);
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

      // ✅ FIX: Use dynamic price
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

            setIsPaid(true);
            setIsAlreadyPaid(true);
            await handleSaveAndFinalize(paymentDetails);
            
            const rzpElement = document.querySelector('.razorpay-checkout-frame');
            if (rzpElement) { rzpElement.remove(); }
            
            window.print();
            setTimeout(() => { router.push('/dashboard'); }, 3000);
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
      if (userCategory === 'ADMIN') {
        setRequiresPayment(false);
      } else {
        setRequiresPayment(true);
        setValidationReason("Note: To print this estimate, please complete the payment process.");
      }
    }
  }, [currentUser, userCategory]);

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
      "RENOVATION USER": "estimate_fee",
      "NEW CONSTRUCTION": "estimate_fee",
      "RENOVATION": "estimate_fee",
      "RENOVATION + EXTENSION": "estimate_fee"
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

    if (error) {
      console.error("Supabase Query Error:", error);
      return 0;
    }

    return data ? Number(data[targetColumn] || 0) : 0;
  };

  const handleSaveAndFinalize = async (paymentData?: any) => {
    const isAuthorized = userCategory === 'ADMIN' || isPaid || paymentData;
    if (!isAuthorized) {
      alert(`Payment of ₹${gatewayFeeAmount}/- is required to save and print.`);
      handlePayment();
      return;
    }

    if (isSaving) return;

    const now = new Date();
    const userId = currentUser?.id;
    if (!userId) { alert("User ID not found!"); return; }

    try {
      setIsSaving(true);

      let activeEstimateId = estimate?.id || null;
      let activeRefNo = estimate?.ref_no && !estimate?.ref_no.startsWith("TEMP") && !estimate?.ref_no.includes("...") 
  ? estimate.ref_no 
  : (currentRefNo && !currentRefNo.includes("...") ? currentRefNo : null);

if (!activeEstimateId && activeRefNo && !activeRefNo.startsWith("TEMP")) {
  const { data: foundRec } = await supabase
    .from("estimates")
    .select("id")
    .eq("ref_no", activeRefNo)
    .maybeSingle();
  
  if (foundRec) {
    activeEstimateId = foundRec.id;
  }
}

let shouldGenerateNewRef = !activeEstimateId || !activeRefNo || activeRefNo.startsWith("TEMP");
      
      if (shouldGenerateNewRef) {
        const { data: duplicate } = await supabase
          .from("estimates")
          .select("id, ref_no")
          .eq("customer_name", estimate?.customer_name)
          .eq("property_address", estimate?.property_address)
          .maybeSingle();

        if (duplicate) {
          const confirmOverwrite = confirm(`Similar record found (Ref: ${duplicate.ref_no}). OK to OVERWRITE?`);
          if (confirmOverwrite) {
            activeEstimateId = duplicate.id;
            activeRefNo = duplicate.ref_no;
            shouldGenerateNewRef = false;
          } else {
            setIsSaving(false);
            return;
          }
        }
      }

if (shouldGenerateNewRef && !estimate?.id) {
  activeRefNo = null;
}

      let consultingFee = 0;
      
      if (estimate?.client_name) {
        const { data: clientData, error: clientErr } = await supabase
          .from('clients')
          .select('estimate_fee')
          .eq('client_name', estimate.client_name)
          .maybeSingle();
        
        if (!clientErr && clientData) {
          consultingFee = Number(clientData.estimate_fee) || 0;
        }
      }

      if (!consultingFee || consultingFee === 0 || isNaN(consultingFee)) {
        consultingFee = parseFloat(estimate?.fee_amount) || parseFloat(estimate?.fee_standard) || 0;
      }

      const payload = {
  p_estimate_id: activeEstimateId,
  p_user_id: userId,
  p_customer_name: estimate?.customer_name || 'GUEST',
  p_snapshot: { 
    totalArea: Number(estimate?.total_builtup_area || 0), 
    grandTotal: Number(estimate?.total_value || estimate?.total_amount || 0), 
    property_address: estimate?.property_address || '', 
    property_type: estimate?.property_type || 'HOUSE',
    date: now.toISOString() 
  },
  p_fee_standard: Number(consultingFee) || 0,
  p_estimate_type: estimate?.estimate_type || 'STANDARD',
  p_plan_type: estimate?.plan_type || 'BASIC',
  p_rate_per_sqft: Number(estimate?.rate_per_sqft || 0),
  p_floor_details: (estimate?.floor_details && typeof estimate.floor_details === 'object') ? estimate.floor_details : {},
  p_client_name: estimate?.client_name || '',
  p_representative: estimate?.representative || '',
  p_plot_area: Number(estimate?.plot_area || 0),
  p_property_address: estimate?.property_address || '',
  p_property_type: estimate?.property_type || 'HOUSE',
  p_total_builtup_area: Number(estimate?.total_builtup_area || 0),
  p_total_construction_cost: Number(
  estimate?.total_construction_cost || 
  estimate?.total_value || 
  estimate?.total_amount || 
  estimate?.grandTotal || 
  estimate?.totalCost || 
  0
),
  p_ref_no: activeRefNo,
  p_status: 'Pending',
  p_payment_status: paymentData?.p_payment_status || estimate?.payment_status || 'paid',
  p_order_id: paymentData?.p_order_id || estimate?.order_id || null,
  p_payment_id: paymentData?.p_payment_id || estimate?.payment_id || estimate?.razorpay_payment_id || null,
  p_user_payment: Number(paymentData?.p_user_payment || estimate?.user_payment || gatewayFeeAmount || 21)
};

      const { data, error } = await supabase.rpc('rpc_save_renovation_estimate', payload);
      if (error) throw error;

      if (data && data.length > 0) {
        if (!activeEstimateId) {
          await supabase.from('profiles').update({ estimate_count: (currentUser?.estimate_count || 0) + 1 }).eq('id', userId);
        }
        
        const result = data[0];
        setEstimate((prev: any) => ({ ...prev, id: result.id, ref_no: result.ref_no }));
        setIsFinalized(true);
        setIsPaid(true);
        localStorage.removeItem("RenovationEstimatePreview");
        alert(`Saved successfully! Ref: ${result.ref_no}`);
        setTimeout(() => window.print(), 500);
      }
    } catch (error: any) {
      console.error("Save Error:", error);
      alert("Error: " + (error.message || "Failed to save data"));
    } finally {
      setIsSaving(false);
    }
  };  

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
      const data = localStorage.getItem("RenovationEstimatePreview") || localStorage.getItem("renovationEstimatePreview");
      if (!data) return;

      const estimateData = JSON.parse(data);
      let workingEstimate = { 
        ...estimateData, 
        id: estimateData.id || null,
        property_type: estimateData.property_type || "HOUSE" 
      };

      if (!workingEstimate.ref_no || workingEstimate.ref_no.startsWith("TEMP") || workingEstimate.ref_no.includes("REF-")) {
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
            if (existingRecord.property_type) {
              workingEstimate.property_type = existingRecord.property_type;
            }
            if (existingRecord.payment_status === 'paid' || existingRecord.status === 'paid') {
              setIsPaid(true);
              setIsAlreadyPaid(true);
            }
          }
        } catch (err) {
          console.error("Error matching existing estimate:", err);
        }
      }
      if (!workingEstimate.ref_no || workingEstimate.ref_no.includes("...") || workingEstimate.ref_no.startsWith("TEMP")) {
        const now = new Date();
        const fy = (now.getMonth() + 1) >= 4 
          ? `${String(now.getFullYear()).slice(-2)}-${String(now.getFullYear() + 1).slice(-2)}` 
          : `${String(now.getFullYear() - 1).slice(-2)}-${String(now.getFullYear() - 1).slice(-2)}`;
        
        const firstName = (currentUser?.full_name || "GUEST").split(' ')[0].toUpperCase();
        const userCode = currentUser?.user_code || "U000"; 
        const count = (currentUser?.estimate_count || 0) + 1;
        
        workingEstimate.ref_no = `LnT/${fy}/${firstName}/${userCode}/C${String(count).padStart(4, '0')}`;
        setCurrentRefNo(workingEstimate.ref_no);
      }

      setEstimate(workingEstimate);

      const statusCheck = (workingEstimate.status || "").trim().toUpperCase();
      const paymentStatusCheck = (workingEstimate.payment_status || "").trim().toUpperCase();
      
      const isPaidFlag = 
        workingEstimate.isAlreadyPaid === true || 
        workingEstimate.is_paid === true ||
        statusCheck === "RECEIVED" || 
        statusCheck === "PAID" || 
        statusCheck === "SUCCESS" ||
        paymentStatusCheck === "PAID";

      if (isPaidFlag) {
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
          .select('status') 
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

  useEffect(() => {
    const preventSystemPrint = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        alert("System Print disabled! Kripya software mein diye gaye 'Save & Print' button ka hi upyog karein.");
        return false;
      }
    };

    const preventRightClick = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', preventSystemPrint, true);
    window.addEventListener('contextmenu', preventRightClick);

    return () => {
      window.removeEventListener('keydown', preventSystemPrint, true);
      window.removeEventListener('contextmenu', preventRightClick);
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
    setRenovationMasterItem(nearest);
  };

  if (!estimate) return <div className="p-10">Loading...</div>;
  if (!renovationMasterItem) return <div className="p-10">Loading Master Items...</div>;

  const formatQty = (val: number) => Number(val || 0).toFixed(2);
  const getUnit = (unit: string | null | undefined) => (unit && unit.trim() !== "" ? unit : "LS");
  
  async function getGroundFloorPlotMaster(estimate: any) {
    const activeDetails = estimate?.floor_details || {};
    const availableDetailsKeys = Object.keys(activeDetails || {});
    
    const matchedDetailsKey = availableDetailsKeys.find(
      (k) => k.trim().toUpperCase().includes("GROUND")
    ) || "GROUND FLOOR";

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

    let { data } = await supabase
      .from("plot_master")
      .select("*")
      .eq("width_feet", width)
      .eq("length_feet", length)
      .limit(1);

    if (data && data.length > 0) {
      return data[0];
    }

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
  const rate = Number(ratePerSqft || estimate?.rate || 800);
  const selectedFloors = estimate?.selected_floors || ["GROUND FLOOR"];
  
  const savedDataForCore = typeof window !== 'undefined' 
    ? JSON.parse(localStorage.getItem("renovationEstimatePreview") || localStorage.getItem("RenovationEstimatePreview") || "{}") 
    : {};
    
  const isFlat = propertyTypeVal === 'FLAT';
  const effectiveRateForMaster = rate;
  const isOnlyGroundAndTower = selectedFloors.every((f: string) => f === "GROUND FLOOR" || f === "TOWER");

  const gfL = Number(estimate?.floor_details?.["GROUND FLOOR"]?.length || savedDataForCore?.floor_details?.["GROUND FLOOR"]?.length || 0) / 3.28;
  const gfW = Number(estimate?.floor_details?.["GROUND FLOOR"]?.width || savedDataForCore?.floor_details?.["GROUND FLOOR"]?.width || 0) / 3.28;

  const lastFloorName = selectedFloors.filter((f: string) => f !== "TOWER").slice(-1)[0] || "GROUND FLOOR";
  const lfL = Number(estimate?.floor_details?.[lastFloorName]?.length || savedDataForCore?.floor_details?.[lastFloorName]?.length || gfL * 3.28) / 3.28;
  const lfW = Number(estimate?.floor_details?.[lastFloorName]?.width || savedDataForCore?.floor_details?.[lastFloorName]?.width || gfW * 3.28) / 3.28;

  const maxL = Math.max(gfL, lfL);
  const maxW = Math.max(gfW, lfW);

  const parapetQty = isFlat ? 0 : (2 * (maxL + maxW));

  let cobaQty = 0;
  if (!isFlat) {
    const gfArea = Number(estimate?.floor_details?.["GROUND FLOOR"]?.area || savedDataForCore?.floor_details?.["GROUND FLOOR"]?.area || 0);
    const lfArea = Number(estimate?.floor_details?.[lastFloorName]?.area || savedDataForCore?.floor_details?.[lastFloorName]?.area || gfArea);
    cobaQty = Math.max(gfArea, lfArea) / 10.764;
  }

const coreItems: Array<{
  key?: string;
  description: any;
  l: any;
  w: any;
  ht: any;
  nos: any;
  qty: any;
  unit: any;
  rate: any;
  calculatedAmount?: number;
  displayAmount?: string;
}> = [
  { 
    key: "internal_plaster",
    description: renovationMasterItem?.internal_plaster_desc || "Internal Plaster Work", 
    l: "-", w: "-", ht: "-", nos: 1, 
    qty: Number(internalPlasterQty || 0).toFixed(2), 
    unit: renovationMasterItem?.internal_plaster_unit || "SQM", 
    rate: renovationMasterItem?.internal_plaster_rate || 180 
  },
  { 
    key: "external_plaster",
    description: renovationMasterItem?.external_plaster_desc || "External Plaster Work", 
    l: "-", w: "-", ht: "-", nos: 1, 
    qty: Number(externalPlasterQty || 0).toFixed(2), 
    unit: renovationMasterItem?.external_plaster_unit || "SQM", 
    rate: renovationMasterItem?.external_plaster_rate || 240 
  },
  
  ...(!isFlat ? [
    { 
      key: "parapet_wall",
      description: "PARAPET WALL BRICKWORKIS 2212 Masonry Norms :- 4-Feet High Roof Parapet Protection Wall...", 
      l: maxL.toFixed(2), 
      w: maxW.toFixed(2), 
      ht: "-", 
      nos: 1, 
      qty: parapetQty.toFixed(2), 
      unit: renovationMasterItem?.parapet_wall_unit || "RM", 
      rate: renovationMasterItem?.parapet_wall_rate || 1150 
    },
    { 
      key: "terrace_coba",
      description: "TERRACE COBA WORKIS 3067 Brick Bat Coba Treatment...", 
      l: "-", w: "-", ht: "-", nos: 1,  
      qty: cobaQty.toFixed(2), 
      unit: renovationMasterItem?.terrace_coba_unit || "SQM", 
      rate: renovationMasterItem?.terrace_coba_rate || 1300 
    }
  ] : []),
];

const coreTotal = coreItems.reduce((sum, row) => sum + (Number(row.qty || 0) * Number(row.rate || 0)), 0);

const inputArea = Number(estimate?.total_built_up_area || estimate?.total_builtup_area || savedDataForCore?.total_built_up_area || 600);
const rawBaseValue = Number(estimate?.total_value || estimate?.construction_cost || (inputArea * rate));
const remainingBudget = Math.max(0, isNaN(rawBaseValue - coreTotal) ? 0 : rawBaseValue - coreTotal);

const slabRates = Object.keys(slabConfig).map(Number).sort((a, b) => a - b);
const activeSlab = slabRates.find(s => rate <= s) || slabRates[slabRates.length - 1];
const w = slabConfig[activeSlab] || {};

const isLiftHidden = rate >= 2700 && isOnlyGroundAndTower;
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

let adjustedWeights = { ...finalW };
if (isFlat) {
  const hiddenWeight = (adjustedWeights.water || 0) + (adjustedWeights.elev || 0) + (adjustedWeights.bore || 0);
  adjustedWeights.water = 0;
  adjustedWeights.elev = 0;
  adjustedWeights.bore = 0;

  const activeKeys = Object.keys(adjustedWeights).filter(k => !['water', 'elev', 'bore'].includes(k) && adjustedWeights[k] > 0);
  const totalActiveWeight = activeKeys.reduce((sum, k) => sum + adjustedWeights[k], 0);

  if (totalActiveWeight > 0) {
    activeKeys.forEach(k => {
      const proportion = adjustedWeights[k] / totalActiveWeight;
      adjustedWeights[k] += hiddenWeight * proportion;
    });
  }
}

const getSafeWeight = (val: any) => {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

const areaSqM = inputArea > 0 ? inputArea / 10.76 : 1;

const wDoor = getSafeWeight(adjustedWeights.door || adjustedWeights.door_frame);
const wPaint = getSafeWeight(adjustedWeights.paint);
const wMs = getSafeWeight(adjustedWeights.ms || adjustedWeights.ms_steel);
const wPlumb = getSafeWeight(adjustedWeights.plumb || adjustedWeights.plumbing);
const wElec = getSafeWeight(adjustedWeights.elec || adjustedWeights.electrical);
const wFlooring = getSafeWeight(adjustedWeights.flooring || adjustedWeights.floor);
const wCeiling = getSafeWeight(adjustedWeights.ceiling || adjustedWeights.false_ceiling);
const wKitchen = getSafeWeight(adjustedWeights.modular_kitchen || adjustedWeights.kitchen);
const wWater = getSafeWeight(finalW.water);
const wElev = getSafeWeight(finalW.elev || adjustedWeights.elevation);
const wBore = getSafeWeight(finalW.bore);
const wFurnish = getSafeWeight(adjustedWeights.furnish || adjustedWeights.full_furnishing);
const wFinal = getSafeWeight(adjustedWeights.final || adjustedWeights.final_finishing);
const wLift = getSafeWeight(finalW.lift);
const wConsult = getSafeWeight(adjustedWeights.cons || adjustedWeights.consultant);

const amtDoor = remainingBudget * wDoor;
const amtPaint = remainingBudget * wPaint;
const amtMs = remainingBudget * wMs;
const amtPlumb = remainingBudget * wPlumb;
const amtElec = remainingBudget * wElec;
const amtFlooring = remainingBudget * wFlooring;
const amtCeiling = remainingBudget * wCeiling;
const amtKitchen = remainingBudget * wKitchen;
const amtWater = remainingBudget * wWater;
const amtElev = remainingBudget * wElev;
const amtBore = remainingBudget * wBore;
const amtFurnish = remainingBudget * wFurnish;
const amtFinal = remainingBudget * wFinal;
const amtLift = remainingBudget * wLift;
const amtConsult = remainingBudget * wConsult;

const getStandardRate = (weight: number) => {
  const safeW = getSafeWeight(weight);
  if (safeW === 0) return "0.00";
  return (safeW * 100).toFixed(2) + "%";
};

const getReverseEngineeredRate = (amount: number, qty: number) => {
  if (remainingBudget <= 0 || rawBaseValue <= 0 || amount <= 0 || qty <= 0) {
    return "0.00";
  }
  return (amount / qty).toFixed(2);
};

const estimateRows: Array<any> = [
  ...coreItems,
  { 
    key: "door_frame",
    description: renovationMasterItem?.door_frame_desc, 
    l: "-", w: "-", ht: "-", nos: "-", qty: "1", 
    unit: renovationMasterItem?.door_frame_unit || "LS", 
    rate: getStandardRate(wDoor), 
    calculatedAmount: amtDoor 
  },
  { 
    key: "paint_putty",
    description: renovationMasterItem?.paint_putty_desc, 
    l: "-", w: "-", ht: "-", nos: "-", 
    qty: areaSqM.toFixed(2), 
    unit: renovationMasterItem?.paint_putty_unit || "SQM", 
    rate: getReverseEngineeredRate(amtPaint, areaSqM),
    calculatedAmount: amtPaint
  },
  { 
    key: "ms_steel",
    description: renovationMasterItem?.ms_steel_desc, 
    l: "-", w: "-", ht: "-", nos: "-", qty: "1", 
    unit: renovationMasterItem?.ms_steel_unit || "LSM", 
    rate: getStandardRate(wMs), 
    calculatedAmount: amtMs 
  },
  { 
    key: "plumbing",
    description: renovationMasterItem?.plumbing_desc, 
    l: "-", w: "-", ht: "-", nos: "-", qty: "1", 
    unit: renovationMasterItem?.plumbing_unit || "LS", 
    rate: getStandardRate(wPlumb), 
    calculatedAmount: amtPlumb 
  },
  { 
    key: "electrical",
    description: renovationMasterItem?.electrical_desc, 
    l: "-", w: "-", ht: "-", nos: "-", qty: "1", 
    unit: renovationMasterItem?.electrical_unit || "LS", 
    rate: getStandardRate(wElec), 
    calculatedAmount: amtElec 
  },
  { 
    key: "flooring",
    description: renovationMasterItem?.flooring_desc, 
    l: "-", w: "-", ht: "-", nos: "-", 
    qty: areaSqM.toFixed(2), 
    unit: renovationMasterItem?.flooring_unit || "SQM", 
    rate: getReverseEngineeredRate(amtFlooring, areaSqM),
    calculatedAmount: amtFlooring
  },
  { 
    key: "false_ceiling",
    description: renovationMasterItem?.false_ceiling_desc, 
    l: "-", w: "-", ht: "-", nos: "-", qty: "1", 
    unit: renovationMasterItem?.false_ceiling_unit || "LS", 
    rate: getStandardRate(wCeiling), 
    calculatedAmount: amtCeiling 
  },
  { 
    key: "modular_kitchen",
    description: renovationMasterItem?.modular_kitchen_desc, 
    l: "-", w: "-", ht: "-", nos: "-", qty: "1", 
    unit: renovationMasterItem?.modular_kitchen_unit || "LS", 
    rate: getStandardRate(wKitchen), 
    calculatedAmount: amtKitchen 
  },
  
  ...(!isFlat ? [
    { 
      key: "water_tank",
      description: "WATER TANK WORKIS 3370 Structural Concrete Tank :- Underground RCC Water Tank: Premium high-grade M25/M30 RCC monolithic structure; specialized structural crystallization matrix along with full food-grade internal epoxy membrane sealing for total leak protection", 
      l: "-", w: "-", ht: "-", nos: "-", qty: "1", unit: "LS", 
      rate: getStandardRate(wWater), calculatedAmount: amtWater 
    },
    { 
      key: "modern_elevation",
      description: "MODERN FRONT ELEVATION Architectural Design & Cladding Norms :- Modern Architectural Front Elevation Work: Ultra-modern bespoke elevation layout using premium slim-line Aluminium louvers, imported natural stone facade tile cladding, high-end structural glazing, and programmable smart exterior LED strips.", 
      l: "-", w: "-", ht: "-", nos: "-", qty: "1", unit: "LS", 
      rate: getStandardRate(wElev), calculatedAmount: amtElev 
    },
    { 
      key: "deep_boring",
      description: " DEEP BORING WORKCGWB & IS 2800 Norms :- Deep Borewell Excavation & Casing: Elite deep-well excavation using premium industrial-grade high-thickness casing profiles, custom mesh filter screens, extensive sand-free development flushing, and certified multi-hour yield audit.", 
      l: "-", w: "-", ht: "-", nos: "-", qty: "1", unit: "LS", 
      rate: getStandardRate(wBore), calculatedAmount: amtBore 
    }
  ] : []),

  { 
    key: "full_home_furnishing",
    description: renovationMasterItem?.full_home_furnishing_desc, 
    l: "-", w: "-", ht: "-", nos: "-", qty: "1", 
    unit: renovationMasterItem?.full_home_furnishing_unit || "LS", 
    rate: getStandardRate(wFurnish), calculatedAmount: amtFurnish 
  },
  { 
    key: "consultant_fee",
    description: renovationMasterItem?.consultant_fee_desc || "CoA & Council Norms IS 456 / IS 1893 PMC Guide Norms : -Architectural & Planning Structural Design & 3D Elevation Site Supervision & Quality Control: Turnkey bespoke Architectural, Luxury Interior, MEP & High-End Structural design packages; 24/7 digital monitoring, routine premium consultant visits, and mandatory laboratory material testing certificates.", 
    l: "-", w: "-", ht: "-", nos: "-", qty: "1", 
    unit: renovationMasterItem?.consultant_fee_unit || "LS", 
    rate: getStandardRate(wConsult), calculatedAmount: amtConsult 
  },
  { 
    key: "final_finishing",
    description: renovationMasterItem?.final_finishing_desc, 
    l: "-", w: "-", ht: "-", nos: "-", qty: "1", 
    unit: renovationMasterItem?.final_finishing_unit || "LS", 
    rate: getStandardRate(wFinal), calculatedAmount: amtFinal 
  },
  
  ...(!isLiftHidden ? [{
    key: "lift_installation",
    description: "LIFT INTALLATION  & STR. :- Lift Installation: Supplying & commissioning ultra-luxury 4-to-6 passenger automatic gearless smart lift with panoramic glass cabin/premium brushed SS panels, automatic rescue device (ARD), and top-tier silent operation systems.",
    l: "-", w: "-", ht: "-", nos: "-", qty: "1", 
    unit: renovationMasterItem?.lift_installation_unit || "LS", 
    rate: getStandardRate(wLift), calculatedAmount: amtLift
  }] : []),
];

let calculatedRowsSum = 0;
let exactRowsSumUnrounded = 0; 
let lastValidRow: any = null;

estimateRows.forEach((row: any) => {
  let rowAmt = 0;
  let exactRowAmt = 0;
  
  if (row.calculatedAmount !== undefined) {
    exactRowAmt = Number(row.calculatedAmount);
    rowAmt = Math.round(exactRowAmt);
  } else {
    const q = Number(row.qty || 0);
    const r = Number(row.rate || 0);
    exactRowAmt = isNaN(q * r) ? 0 : (q * r);
    rowAmt = Math.round(exactRowAmt);
    row.calculatedAmount = exactRowAmt; 
  }

  calculatedRowsSum += rowAmt;
  exactRowsSumUnrounded += exactRowAmt;

  if (rowAmt > 0) {
    lastValidRow = row;
  }

  row.displayAmount = exactRowAmt.toFixed(2);
});

const targetBudget = Math.round(rawBaseValue); 
let discrepancy = targetBudget - calculatedRowsSum;

if (discrepancy !== 0 && lastValidRow) {
  const currentAmt = Number(lastValidRow.calculatedAmount);
  lastValidRow.calculatedAmount = currentAmt + discrepancy;
  lastValidRow.displayAmount = Number(lastValidRow.calculatedAmount).toFixed(2);
  
  if (String(lastValidRow.rate).includes("%")) {
    const newWeightShare = Number(lastValidRow.calculatedAmount) / remainingBudget;
    lastValidRow.rate = (newWeightShare * 100).toFixed(2) + "%";
  } else {
    lastValidRow.rate = (Number(lastValidRow.calculatedAmount) / Number(lastValidRow.qty || 1)).toFixed(2);
  }
}

const subTotalFormatted = exactRowsSumUnrounded.toFixed(2);
const finalGrandTotal = targetBudget;
const finalAmountFormatted = Number(finalGrandTotal).toFixed(2);

if (isCheckingHistory) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-sm font-semibold tracking-wide uppercase">Validating Estimate History...</p>
    </div>
  );
} 

return (
  <div className="print-area print-page p-10 bg-white min-h-screen relative">
    
<style jsx global>{`
  @media print {
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
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

    {(!isPaid && !isAlreadyPaid && userCategory !== 'ADMIN' && (!estimate?.id || estimate?.id === "temp-id" || !estimate?.ref_no)) && (
      <div className="draft-watermark no-print">DRAFT</div>
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
      <div className="grid grid-cols-3 items-center">
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
      if ((isPaid || isAlreadyPaid || userCategory === 'ADMIN') && estimate?.ref_no && !estimate.ref_no.startsWith("TEMP") && !estimate.ref_no.includes("...")) {
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
        PROPOSED RENOVATION ESTIMATE FOR {(() => {
          const savedData = JSON.parse(localStorage.getItem("renovationEstimatePreview") || localStorage.getItem("RenovationEstimatePreview") || "{}");
          const pType = String(estimate?.property_type || savedData?.property_type || "HOUSE").trim().toUpperCase();
          const floors = estimate?.selected_floors || savedData?.selected_floors || ["GROUND FLOOR"];
          if (pType === 'HOUSE') {
            return floors.length > 0 ? floors.join(" + ") : "HOUSE";
          }
          return "FLAT";
        })()}
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

    {(() => {
      const savedData = JSON.parse(localStorage.getItem("renovationEstimatePreview") || localStorage.getItem("RenovationEstimatePreview") || "{}");
      const pType = String(estimate?.property_type || savedData?.property_type || "HOUSE").trim().toUpperCase();
      if (pType === 'HOUSE') {
        return (
          <table className="w-full border border-black border-collapse mb-4">
  <tbody>
    <tr>
      <td className="border border-black p-2 font-bold w-[80%]">PLOT AREA</td>
      <td className="border border-black p-2 text-center font-bold">
        {Number(estimate.plot_area || savedData.plot_area || 0).toFixed(2)} {estimate.plot_unit || "SQ.FT"}
      </td>
    </tr>
  </tbody>
</table>
        );
      }
      return null;
    })()}

    <table className="w-full border border-black border-collapse mb-6">
      <thead>
        <tr>
          <th className="border border-black p-2 w-[80px]">SR</th>
          <th className="border border-black p-2">DESCRIPTION</th>
          <th className="border border-black p-2 w-[180px]">AREA</th>
        </tr>
      </thead>
      <tbody>
        {(() => {
          const savedData = JSON.parse(localStorage.getItem("renovationEstimatePreview") || localStorage.getItem("RenovationEstimatePreview") || "{}");
          const pType = String(estimate?.property_type || savedData?.property_type || "HOUSE").trim().toUpperCase();
          const floors = estimate?.selected_floors || savedData?.selected_floors || [];
          if (pType === 'HOUSE' && floors.length > 0) {
            return floors.map((floor: string, index: number) => (
              <tr key={floor}>
                <td className="border border-black p-2 text-center">{index + 1}</td>
                <td className="border border-black p-2">{floor} BUILT UP AREA</td>
                <td className="border border-black p-2 text-center">
  {Number(estimate.floor_details?.[floor]?.area || savedData.floor_details?.[floor]?.area || 0).toFixed(2)} SQ.FT
</td>
              </tr>
            ));
          }
          return null;
        })()}
        <tr>
  <td colSpan={2} className="border border-black p-2 font-bold">TOTAL BUILT UP AREA</td>
  <td className="border border-black p-2 text-center font-bold">
    {Number(totalBuiltupSqFt || 0).toFixed(2)} SQ.FT
  </td>
</tr>
      </tbody>
    </table>

    <div className="flex justify-between items-center border border-black bg-slate-100 p-3 my-4 font-bold text-sm">
  <div>TOTAL BUILT UP AREA : {Number(totalBuiltupSqFt || 0).toFixed(2)} SQ.FT</div>
  <div>
    RATE PER SQ.FT : ₹ {Number(rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/-
  </div>
  <div>
    TOTAL VALUE : ₹ {Number(rawBaseValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/-
  </div>
</div>

    {renovationMasterItem && (
      <div>
        <table className="w-full border border-black border-collapse mt-6 text-base">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-black p-2 text-center w-10">SR</th>
              <th className="border border-black p-2">DESCRIPTION</th>
              <th className="border border-black p-2 text-center w-14">NOS</th>
              <th className="border border-black p-2 text-center w-16">QTY</th>
              <th className="border border-black p-2 text-center w-14">UNIT</th>
              <th className="border border-black p-2 text-center w-18">RATE</th>
              <th className="border border-black p-2 text-right w-24">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {estimateRows
              .filter((row) => {
                const rateVal = parseFloat((row.rate || "0").toString().replace('%', '')) || 0;
                const isPercentage = String(row.rate || "").includes("%");
                const amount = isPercentage ? (remainingBudget * (rateVal / 100)) : (Number(row.qty || 0) * Number(row.rate || 0));
                return amount > 0;
              })
              .map((row, index) => {
                const rateVal = parseFloat((row.rate || "0").toString().replace('%', '')) || 0;
                const isPercentage = String(row.rate || "").includes("%");
                const rowAmount = isPercentage ? (remainingBudget * (rateVal / 100)) : (Number(row.qty || 0) * Number(row.rate || 0));
                const currentGrandTotal = estimateRows.reduce((sum, r) => {
                  const rRate = parseFloat((r.rate || "0").toString().replace('%', '')) || 0;
                  const rIsPercentage = String(r.rate || "").includes("%");
                  const amt = rIsPercentage ? (remainingBudget * (rRate / 100)) : (Number(r.qty || 0) * Number(r.rate || 0));
                  return sum + amt;
                }, 0);
                const calculatedPercent = currentGrandTotal > 0 ? (rowAmount / currentGrandTotal) * 100 : 0;
                const showPercent = [
                  renovationMasterItem.paint_putty_desc, renovationMasterItem.plumbing_desc, renovationMasterItem.electrical_desc, 
                  renovationMasterItem.flooring_desc, renovationMasterItem.door_frame_desc, renovationMasterItem.ms_steel_desc, 
                  renovationMasterItem.false_ceiling_desc, renovationMasterItem.modular_kitchen_desc, renovationMasterItem.water_tank_desc, 
                  renovationMasterItem.full_home_furnishing_desc, renovationMasterItem.modern_elevation_desc, renovationMasterItem.deep_boring_desc, 
                  renovationMasterItem.final_finishing_desc
                ].includes(row.description);
                
                return (
                  <tr key={index} className="border-b border-black hover:bg-slate-50">
  <td className="border border-black p-1 text-center">{index + 1}</td>
  <td className="border border-black p-1 font-medium capitalize">{row.description?.toLowerCase()}</td>
  <td className="border border-black p-1 text-center">{row.nos ?? "-"}</td>
  
  <td className="border border-black p-1 text-center">
    {row.qty !== undefined && row.qty !== null ? Number(row.qty).toFixed(2) : "-"}
  </td>

  <td className="border border-black p-1 text-center">{row.unit}</td>

  <td className="border border-black p-1 text-center">
    {isPercentage ? (showPercent ? `${calculatedPercent.toFixed(2)}%` : "-") : (isNaN(Number(row.rate)) ? row.rate : Number(row.rate).toFixed(2))}
  </td>

  <td className="border border-black p-1 text-right font-semibold">
    {Number(row.displayAmount || row.calculatedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  </td>
</tr>
                );
              })}
            <tr className="bg-slate-100 font-bold border-t-2 border-black text-base whitespace-nowrap">
  <td colSpan={6} className="border border-black p-3 text-right uppercase tracking-wide">TOTAL AMOUNT:</td>
  <td className="border border-black p-3 text-right font-mono">
    ₹ {Math.round(Number(targetBudget || rawBaseValue || 0)).toLocaleString('en-IN')}
  </td>
</tr>
        </tbody>
      </table>
    </div>
  )}

    <table className="w-full border border-black border-collapse mt-6">
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
  value={`${typeof window !== 'undefined' ? window.location.origin : 'https://construction-estimate-software-5wi1i5qjz-divisha.vercel.app'}/verify-estimate?ref=${estimate?.ref_no}`} 
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

    {/* ✅ PaymentBanner Style (Inline - Extension me component use kiya hai) */}
    <div className="mt-8 mb-12 no-print border-t border-slate-200 pt-6">
      {!isPaid && !isAlreadyPaid && userCategory !== 'ADMIN' && (
        <div className="mb-4 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border-2 border-dashed border-amber-400 rounded-xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded shadow uppercase tracking-wider animate-pulse">
              ⚡ LIMITED TIME DEAL
            </span>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 uppercase">
                Professional Renovation Estimate & Verified Report
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

      <div className="flex flex-wrap items-center justify-start gap-6">
        {(isPaid || isAlreadyPaid || userCategory === 'ADMIN') ? (
          <button
            onClick={handleSaveAndPrint}
            disabled={isSaving}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg shadow-md hover:bg-blue-700 transition font-bold uppercase tracking-wide flex items-center gap-2"
          >
            {isSaving ? "SAVING..." : "🖨️ PRINT ESTIMATE"}
          </button>
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
            localStorage.removeItem("estimatePreview");
            router.push("/estimate");
          }}
          className="bg-slate-700 text-white px-8 py-3 rounded-lg shadow-md hover:bg-slate-800 transition font-bold uppercase tracking-wide"
        >
          ⬅️ BACK TO INPUT
        </button>
      </div>
    </div>

  </div>
);}