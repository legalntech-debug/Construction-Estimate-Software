"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import "./print.css";
import { QRCodeSVG } from 'qrcode.react';

const slabConfig: any = {
  1000: { door: 0.20, plumb: 0.335, elec: 0.335, paint: 0.13 },
  1100: { door: 0.18, paint: 0.18, plumb: 0.25, elec: 0.25, ms: 0.14 },
  1150: { door: 0.18, paint: 0.18, plumb: 0.25, elec: 0.25, ms: 0.14 },
  1200: { door: 0.14, paint: 0.14, ms: 0.08, plumb: 0.2, elec: 0.2, floor: 0.24 },
  1250: { door: 0.14, paint: 0.14, ms: 0.08, plumb: 0.2, elec: 0.2, floor: 0.24 },
  1300: { door: 0.14, paint: 0.14, ms: 0.08, plumb: 0.2, elec: 0.2, floor: 0.24 },
  1350: { door: 0.14, paint: 0.14, ms: 0.1, plumb: 0.195, elec: 0.195, floor: 0.23 },
  1400: { door: 0.14, paint: 0.14, ms: 0.11, plumb: 0.195, elec: 0.195, floor: 0.22 },
  1500: { door: 0.131, paint: 0.125, ms: 0.13, plumb: 0.187, elec: 0.187, floor: 0.24 },
  1550: { door: 0.095, paint: 0.111, ms: 0.095, plumb: 0.16, elec: 0.16, floor: 0.17, ceiling: 0.08, water: 0.129 },
  1600: { door: 0.095, paint: 0.111, ms: 0.095, plumb: 0.16, elec: 0.16, floor: 0.18, ceiling: 0.07, water: 0.129 },
  1650: { door: 0.095, paint: 0.111, ms: 0.095, plumb: 0.16, elec: 0.16, floor: 0.18, ceiling: 0.07, water: 0.129 },
  1700: { door: 0.09, paint: 0.09, ms: 0.09, plumb: 0.13, elec: 0.13, floor: 0.15, ceiling: 0.04, kitchen: 0.15, water: 0.13 },
  1750: { door: 0.09, paint: 0.09, ms: 0.09, plumb: 0.13, elec: 0.13, floor: 0.15, ceiling: 0.04, kitchen: 0.28 },
  1800: { door: 0.078, paint: 0.08, ms: 0.078, plumb: 0.13, elec: 0.13, floor: 0.135, ceiling: 0.05, kitchen: 0.154, water: 0.1, furnish: 0.065 },
  1900: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.13, elec: 0.13, floor: 0.13, ceiling: 0.06, kitchen: 0.14, water: 0.1, furnish: 0.12 },
  2000: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.10, elec: 0.10, floor: 0.11, ceiling: 0.06, kitchen: 0.13, water: 0.11, furnish: 0.16, elev: 0.04 },
  2100: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.16, elev: 0.04, cons: 0.02 },
  2200: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045 },
  2250: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045 },
  2300: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045 },
  2350: { door: 0.06, paint: 0.07, ms: 0.06, plumb: 0.105, elec: 0.105, floor: 0.12, ceiling: 0.06, kitchen: 0.11, water: 0.09, furnish: 0.12, elev: 0.035, cons: 0.02, bore: 0.045 },
  2400: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045 },
  2450: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.182, elev: 0.035, cons: 0.02, bore: 0.043 },
  2500: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045 },
  2550: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045 },
  2600: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045 },
  2650: { door: 0.05, paint: 0.06, ms: 0.05, plumb: 0.09, elec: 0.09, floor: 0.12, ceiling: 0.05, kitchen: 0.12, water: 0.09, furnish: 0.18, elev: 0.035, cons: 0.02, bore: 0.045 },
  2700: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.09, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.335 },
  2750: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.09, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.335 },
  2800: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.1, elev: 0.02, cons: 0.02, bore: 0.025, lift: 0.335 },
  2850: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.06, furnish: 0.1, elev: 0.02, cons: 0.02, bore: 0.025, lift: 0.335 },
  2900: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.045, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.34 },
  3000: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.045, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.035, lift: 0.34 },
  3100: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.04, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.03, lift: 0.35 },
  3150: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.07, elec: 0.07, floor: 0.08, ceiling: 0.04, kitchen: 0.05, water: 0.04, furnish: 0.11, elev: 0.02, cons: 0.02, bore: 0.03, lift: 0.35 },
  3200: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.075, elec: 0.07, floor: 0.085, ceiling: 0.04, kitchen: 0.07, water: 0.035, furnish: 0.17, elev: 0.02, cons: 0.02, bore: 0.02, lift: 0.275 },
  3250: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.075, elec: 0.07, floor: 0.085, ceiling: 0.04, kitchen: 0.07, water: 0.035, furnish: 0.17, elev: 0.02, cons: 0.02, bore: 0.02, lift: 0.275 },
  3500: { door: 0.035, paint: 0.05, ms: 0.035, plumb: 0.075, elec: 0.07, floor: 0.095, ceiling: 0.04, kitchen: 0.07, water: 0.035, furnish: 0.195, elev: 0.02, cons: 0.023, bore: 0.017, lift: 0.24 },
  3750: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.06, water: 0.023, furnish: 0.206, elev: 0.015, cons: 0.03, bore: 0.012, lift: 0.20 },
  4000: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.356, elev: 0.01, cons: 0.03, bore: 0.005, lift: 0.085 },
  4250: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.354, elev: 0.01, cons: 0.03, bore: 0.007, lift: 0.085 },
  4500: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.354, elev: 0.01, cons: 0.03, bore: 0.007, lift: 0.085 },
  4750: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.336, elev: 0.01, cons: 0.033, bore: 0.007, lift: 0.1 },
  5000: { door: 0.04, paint: 0.05, ms: 0.04, plumb: 0.075, elec: 0.072, floor: 0.135, ceiling: 0.042, kitchen: 0.04, water: 0.02, furnish: 0.337, elev: 0.01, cons: 0.033, bore: 0.006, lift: 0.1 }
};

export default function ExtensionEstimatePreviewPage() {
  const router = useRouter();
  const { currentUser, setCurrentUser } = useAuth();

  const [estimate, setEstimate] = useState<any>(null);
  const [masterItem, setMasterItem] = useState<any>(null);
  const [selectedPlotMaster, setSelectedPlotMaster] = useState<any>(null);
  const [totalColumnNos, setTotalColumnNos] = useState(0);

  const [isPaid, setIsPaid] = useState(false);
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
  const [signatureDetails, setSignatureDetails] = useState<string | null>(null);
  const userCategory = (currentUser?.user_type || 'INDIVIDUAL USER').toUpperCase();
  const [isFinalized, setIsFinalized] = useState(false);
  
  const [finalFee, setFinalFee] = useState(150);
  const [currentRefNo, setCurrentRefNo] = useState("LNT/26-27/...");
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false);
  
  const isGroundFloorOnly = estimate?.floors === 1 || false;
  const groundFloorArea = estimate?.groundFloorArea || 0;
  const firstFloorArea = estimate?.firstFloorArea || 0;
  const totalCombinedArea = groundFloorArea + firstFloorArea;

  const checkEstimatePaymentStatus = async (currentRefNo: string) => {
    if (!currentRefNo) return;
    try {
      const { data } = await supabase
        .from('estimates')
        .select('platform_payment_status, payment_status, status')
        .eq('ref_no', currentRefNo)
        .maybeSingle();

      if (data) {
        if (data.platform_payment_status === 'paid' || data.payment_status === 'paid' || data.status === 'paid') {
          setIsAlreadyPaid(true);
          setIsPaid(true);
          setRequiresPayment(false);
        }
      }
    } catch (err) {}
  };

  useEffect(() => {
    const data = localStorage.getItem("extensionEstimatePreview");
    if (!data) {
      router.push("/extension-estimate"); 
      return;
    }
    try {
      const parsedData = JSON.parse(data);
      setEstimate(parsedData);
      if (parsedData?.rate_per_sqft) {
        loadMasterItem(Number(parsedData.rate_per_sqft));
      }
    } catch (e) {
      console.error("Error parsing preview data", e);
    }
  }, []);

  useEffect(() => {
    const savedData = JSON.parse(localStorage.getItem("extensionEstimatePreview") || "{}");
    if (savedData?.ref_no) {
      checkEstimatePaymentStatus(savedData.ref_no);
    }
  }, []);

  useEffect(() => {
    const checkExistingPayment = async () => {
      const savedData = localStorage.getItem("extensionEstimatePreview");
      if (!savedData) return;
      try {
        const parsed = JSON.parse(savedData);
        if (!parsed.ref_no) return;

        const { data } = await supabase
          .from('mis_records')
          .select('platform_payment_status')
          .eq('ref_no', parsed.ref_no)
          .maybeSingle();

        if (data && data.platform_payment_status === 'paid') {
          setIsAlreadyPaid(true);
          setIsPaid(true);
        }
      } catch (err) {}
    };
    checkExistingPayment();
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
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (!estimate?.id && estimate?.ref_no) {
        const { data: existingData } = await supabase
          .from('estimates')
          .select('id')
          .eq('ref_no', estimate.ref_no)
          .maybeSingle();

        if (!existingData) {
          await supabase.from('estimates').insert([
            {
              ref_no: estimate.ref_no,
              customer_name: estimate.customer_name,
              property_address: estimate.property_address,
              total_builtup_area: estimate.total_builtup_area,
              construction_cost: estimate.construction_cost || estimate.total_value,
            }
          ]);
        }
      }
      window.print();
    } catch (error) {
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

      const res = await fetch("/api/analyze/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 21 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create order");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: 2100,
        currency: "INR",
        name: "Construction Estimate",
        order_id: data.id,
        handler: async function (response: any) {
          try {
            const paymentDetails = {
              p_payment_status: 'paid',
              p_order_id: response.razorpay_order_id,
              p_payment_id: response.razorpay_payment_id,
              p_user_payment: 21
            };

            setIsPaid(true);
            setIsAlreadyPaid(true);
            await handleSaveAndFinalize(paymentDetails);
            
            const rzpElement = document.querySelector('.razorpay-checkout-frame');
            if (rzpElement) { rzpElement.remove(); }
            
            window.print();
            setTimeout(() => { router.push('/dashboard'); }, 3000);
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
      "NEW CONSTRUCTION": "estimate_fee",
      "RENOVATION": "plan_fee",
      "RENOVATION + EXTENSION": "route_map_fee",
      "EXTENSION & RENOVATION": "route_map_fee"
    };
    const targetColumn = caseTypeMap[caseType] || "estimate_fee";

    const cleanCName = clientName?.split(/[.\s]+/)[0].trim();
    const cleanRName = repName?.split(/[.\s]+/)[0].trim();
    
    const { data } = await supabase
      .from("clients")
      .select(targetColumn)
      .ilike("client_name", `${cleanCName}%`) 
      .ilike("representative_name", `${cleanRName}%`)
      .maybeSingle();

    return data ? Number(data[targetColumn] || 0) : 0;
  };

  const handleSaveAndFinalize = async (paymentData?: any) => {
    const isAuthorized = userCategory === 'ADMIN' || isPaid || paymentData;
    if (!isAuthorized) {
      alert("Payment of ₹21/- is required to save and print.");
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
        : null;
      let skipNewRefGeneration = false;

      if (activeRefNo) {
        skipNewRefGeneration = true;
      }

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

      if (!activeRefNo) {
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
            return;
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
        p_estimate_type: estimate?.estimate_type || 'EXTENSION & RENOVATION',
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
        p_order_id: paymentData?.p_order_id || null,
        p_payment_id: paymentData?.p_payment_id || null,
        p_user_payment: Number(paymentData?.p_user_payment || 21)
      };

      const { data, error } = await supabase.rpc('rpc_save_estimate', payload);
      if (error) throw error;

      if (data && data.length > 0) {
        if (!activeEstimateId) {
          await supabase.from('profiles').update({ estimate_count: (currentUser?.estimate_count || 0) + 1 }).eq('id', userId);
        }
        
        const result = data[0];
        setEstimate((prev: any) => ({ ...prev, id: result.estimate_id, ref_no: result.ref_no }));
        setIsFinalized(true);
        setIsPaid(true);
        localStorage.removeItem("extensionEstimatePreview");
        alert(`Saved successfully! Ref: ${result.ref_no}`);
        setTimeout(() => window.print(), 500);
      }
    } catch (error: any) {
      alert("Error: " + (error.message || "Failed to save data"));
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to check if Ground Floor has Proposed construction
  const isGroundFloorProposed = (() => {
    const gfMode = estimate?.floor_modes?.["GROUND FLOOR"];
    const gfSelected = estimate?.selected_floors?.includes("GROUND FLOOR");
    if (!gfSelected) return false;
    return gfMode === "PROPOSED" || gfMode === "BOTH";
  })();

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

        const count = await getColumnsForFloor(fData.width || fData.proposed?.width || 0, fData.length || fData.proposed?.length || 0);
        if (floor === "GROUND FLOOR") {
          groundCols = count;
        } else {
          otherFloorsCols += count;
        }
      }

      // Agar ground floor proposed hai toh columns double honge, nahi toh sirf upper/other floors ke columns rahenge
      const finalTotal = isGroundFloorProposed ? (groundCols * 2) + otherFloorsCols : otherFloorsCols;
      if (isMounted && totalColumnNos !== finalTotal) {
        setTotalColumnNos(finalTotal);
      }
    }

    calculateDynamicColumns();

    return () => {
      isMounted = false;
    };
  }, [estimate, totalColumnNos, isGroundFloorProposed]);

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
    setMasterItem(nearest);
  };

  if (!estimate) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-600 font-bold mb-4">No Estimate Data Found in LocalStorage!</p>
        <button 
          onClick={() => router.push('/extension-estimate')} 
          className="bg-blue-600 text-white px-4 py-2 rounded font-bold"
        >
          Go Back to Estimate Input
        </button>
      </div>
    );
  }
  
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

  const gfLength = estimate.floor_details?.["GROUND FLOOR"]?.proposed?.length || estimate.floor_details?.["GROUND FLOOR"]?.length || 0;
  const gfWidth = estimate.floor_details?.["GROUND FLOOR"]?.proposed?.width || estimate.floor_details?.["GROUND FLOOR"]?.width || 0;

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
  estimate.selected_floors?.forEach((floor: string, index: number) => {
    const floorDataObj = estimate.floor_details?.[floor] || {};
    const floorArea = Number(floorDataObj.proposed?.area || floorDataObj.existing?.area || floorDataObj.area || 0);
    let kgPerSqft = 3.6; 
    if (index >= 4) {
      kgPerSqft += (index - 3) * 0.3;
    }
    if (floorArea > 1500) {
      kgPerSqft += 0.2;
    }
    totalSteelQty += (floorArea * kgPerSqft);
  });

  const currentMasterItem = masterItem || { reinforcement_steel_rate: 0, shuttering_rate: 0, preliminary_rate: 0, earthwork_rate: 0 };
  const baseRate = Number(currentMasterItem.reinforcement_steel_rate || 0);
  const actualFloorsCount = estimate.selected_floors?.filter((f: string) => f !== "TOWER").length || 1;
  const effectiveRate = actualFloorsCount > 4 ? (baseRate + (actualFloorsCount - 4)) : baseRate;
  
  const shutteringQty = Number(estimate.total_builtup_area || 0) / 10.76;
  const baseShutterRate = Number(currentMasterItem.shuttering_rate || 0);
  const totalFloorCount = estimate.selected_floors?.length || 1;

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

  let brickMultiplier = 0.92;
  if (builtupAreaSqFt >= 200 && builtupAreaSqFt <= 600) brickMultiplier = 0.82;
  else if (builtupAreaSqFt <= 1000) brickMultiplier = 0.85;
  else if (builtupAreaSqFt <= 1500) brickMultiplier = 0.88;
  else if (builtupAreaSqFt <= 2000) brickMultiplier = 0.90;

  const wallLengthRm = builtupAreaSqMt * 0.9;
  const brickQtyCum = (wallLengthRm * 2.7 * 0.15 * brickMultiplier) * 1.05;

  const internalPlasterQty = builtupAreaSqMt * 3.35;
  const externalPlasterQty = builtupAreaSqMt * 3;

  const msSteelQty = Number(estimate.total_value || 0) * 0.05;
  const ratePerSqft = Number(estimate.rate_per_sqft || 0);

  const spm = selectedPlotMaster || { 
    footing_width_meter: 0, footing_length_meter: 0, footing_height_meter: 0, 
    no_of_column: 0, footing_thickness_meter: 0, column_width_meter: 0, 
    column_length_meter: 0, column_height: 0 
  };

  // Agar Ground Floor proposed nahi hai, toh foundation work ki quantities zero ho jayengi
  const earthworkQty = isGroundFloorProposed ? (Number(spm.footing_width_meter || 0) + 0.6) * 
    (Number(spm.footing_length_meter || 0) + 0.6) * 
    (Number(spm.footing_height_meter || 0) + 0.6) * 
    Number(spm.no_of_column || 0) : 0;

  const pccThickness = 0.2; 
  const pccQty = isGroundFloorProposed ? parseFloat(String(spm.footing_length_meter || 0)) *
    parseFloat(String(spm.footing_width_meter || 0)) *
    pccThickness *
    parseFloat(String(spm.no_of_column || 0)) : 0;

  const rccFootingQty = isGroundFloorProposed ? Number(spm.footing_width_meter || 0) * Number(spm.footing_length_meter || 0) * Number(spm.footing_thickness_meter || 0) * Number(spm.no_of_column || 0) : 0;
  const columnQty = Number(spm.column_width_meter || 0) * Number(spm.column_length_meter || 0) * Number(spm.column_height || 0) * totalColumnNos;
  
  const plinthLength = gfLength > 0 && gfWidth > 0 ? (2 * ((gfLength / 3.28) + (gfWidth / 3.28))) * 1.8 : 0;
  const plinthBeamQty = isGroundFloorProposed ? plinthLength * 0.20 * 0.30 : 0;

  const floorsList = estimate.selected_floors || [];
  let totalRoofBeamLength = 0;

  for (const floor of floorsList) {
    const fData = estimate.floor_details?.[floor];
    if (fData) {
      const fL = fData.proposed?.length || fData.length || 0;
      const fW = fData.proposed?.width || fData.width || 0;
      if (fL > 0 && fW > 0) {
        const floorBeamLen = (2 * ((fL / 3.28) + (fW / 3.28))) * 1.8;
        totalRoofBeamLength += floorBeamLen;
      }
    }
  }
  const roofBeamQty = totalRoofBeamLength * 0.20 * 0.30;

  const totalAreaSqMt = Number(estimate.total_builtup_area || 0) / 10.76;
  const gfFloorData = estimate.floor_details?.["GROUND FLOOR"];
  const gfAreaVal = gfFloorData?.proposed?.area || gfFloorData?.existing?.area || gfFloorData?.area || 0;
  const gfAreaSqMt = Number(gfAreaVal) / 10.76;
  const slabThick = Number(spm.slab_thicknes || 0.12);
  const plinthThick = Number(spm.plinth_slab_thicknes || 0.10);
  const slabQty = (totalAreaSqMt * slabThick) + (isGroundFloorProposed ? (gfAreaSqMt * plinthThick) : 0);

  const floorOrder: { [key: string]: number } = {
    "GROUND FLOOR": 1, "FIRST FLOOR": 2, "SECOND FLOOR": 3,
    "THIRD FLOOR": 4, "FOURTH FLOOR": 5, "FIFTH FLOOR": 6,
    "SIXTH FLOOR": 7, "SEVENTH FLOOR": 8, "EIGHTH FLOOR": 9,
  };

  const sortedFloors = [...(estimate.selected_floors || [])].sort((a, b) => {
    return (floorOrder[a] || 100) - (floorOrder[b] || 100);
  });

  const selectedFloors = estimate.selected_floors || [];
  const isOnlyGroundAndTower = selectedFloors.every((f: string) => f === "GROUND FLOOR" || f === "TOWER");
  const hasUpperFloors = selectedFloors.some((f: string) => f !== "GROUND FLOOR" && f !== "TOWER");
  const isRateAbove1450 = ratePerSqft > 1450;
  const isRateInRange = ratePerSqft > 1550 && ratePerSqft < 1900;

  const shouldHideParapet = isRateInRange && isOnlyGroundAndTower;

  const groundLenMtr = gfLength > 0 ? gfLength / 3.28 : 0;
  const groundWidMtr = gfWidth > 0 ? gfWidth / 3.28 : 0;

  const lastFloorName = estimate.selected_floors?.filter((f: string) => f !== "TOWER").slice(-1)[0] || "GROUND FLOOR";
  const lastFloorObj = estimate.floor_details?.[lastFloorName] || {};
  const lfL = (lastFloorObj.proposed?.length || lastFloorObj.length || 0) / 3.28;
  const lfW = (lastFloorObj.proposed?.width || lastFloorObj.width || 0) / 3.28;

  const maxL = Math.max(groundLenMtr, lfL);
  const maxW = Math.max(groundWidMtr, lfW);

  const parapetQtyRM = shouldHideParapet ? 0 : (2 * (maxL + maxW));
  const parapetRate = Number(masterItem.parapet_wall_rate || 0);

  let cobaQty = 0;
  const shouldShowCoba = isRateAbove1450 && hasUpperFloors && !shouldHideParapet;

  if (shouldShowCoba) {
    const getFloorArea = (floorKey: string) => {
      const fObj = estimate.floor_details?.[floorKey];
      if (!fObj) return 0;
      const rawArea = fObj.proposed?.area || fObj.existing?.area || fObj.area || 0;
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
    { 
      description: masterItem.earthwork_desc, 
      l: isGroundFloorProposed ? (selectedPlotMaster?.footing_length_meter || 0) : 0, 
      w: isGroundFloorProposed ? (selectedPlotMaster?.footing_width_meter || 0) : 0, 
      ht: isGroundFloorProposed ? (selectedPlotMaster?.footing_height_meter || 0) : 0, 
      nos: isGroundFloorProposed ? (selectedPlotMaster?.no_of_column || 0) : 0, 
      qty: isGroundFloorProposed ? Number(earthworkQty || 0).toFixed(2) : "0.00", 
      unit: "CUM", 
      rate: masterItem.earthwork_rate 
    },
    { 
      description: masterItem.pcc_foundation_desc, 
      l: isGroundFloorProposed ? (selectedPlotMaster?.footing_length_meter || 0) : 0, 
      w: isGroundFloorProposed ? (selectedPlotMaster?.footing_width_meter || 0) : 0, 
      ht: isGroundFloorProposed ? "0.2" : 0, 
      nos: isGroundFloorProposed ? (selectedPlotMaster?.no_of_column || 0) : 0, 
      qty: isGroundFloorProposed ? Number(pccQty || 0).toFixed(2) : "0.00", 
      unit: "CUM", 
      rate: masterItem.pcc_foundation_rate 
    },
    { 
      description: masterItem.anti_termite_desc, 
      l: isGroundFloorProposed ? groundLenMtr.toFixed(2) : 0, 
      w: isGroundFloorProposed ? groundWidMtr.toFixed(2) : 0, 
      ht: "-", 
      nos: isGroundFloorProposed ? 1 : 0, 
      qty: isGroundFloorProposed ? (groundLenMtr * groundWidMtr).toFixed(2) : "0.00", 
      unit: getUnit(masterItem.anti_termite_unit), 
      rate: masterItem.anti_termite_rate 
    },
    { 
      description: masterItem.rcc_foundation_desc, 
      l: isGroundFloorProposed ? (selectedPlotMaster?.footing_length_meter || 0) : 0, 
      w: isGroundFloorProposed ? (selectedPlotMaster?.footing_width_meter || 0) : 0, 
      ht: isGroundFloorProposed ? (selectedPlotMaster?.footing_thickness_meter || 0) : 0, 
      nos: isGroundFloorProposed ? (selectedPlotMaster?.no_of_column || 0) : 0, 
      qty: isGroundFloorProposed ? Number(rccFootingQty || 0).toFixed(2) : "0.00", 
      unit: "CUM", 
      rate: masterItem.rcc_foundation_rate 
    },
    { description: masterItem.rcc_column_desc, l: selectedPlotMaster?.column_width_meter || 0, w: selectedPlotMaster?.column_length_meter || 0, ht: selectedPlotMaster?.column_height || 0, nos: totalColumnNos, qty: (Number(selectedPlotMaster?.column_width_meter || 0) * Number(selectedPlotMaster?.column_length_meter || 0) * Number(selectedPlotMaster?.column_height || 0) * totalColumnNos).toFixed(2), unit: "CUM", rate: masterItem.rcc_column_rate },
    { 
      description: masterItem.plinth_beam_desc, 
      l: isGroundFloorProposed ? plinthLength.toFixed(2) : 0, 
      w: isGroundFloorProposed ? Number(selectedPlotMaster?.beam_width_meter || 0).toFixed(2) : 0, 
      ht: isGroundFloorProposed ? Number(selectedPlotMaster?.beam_depth_meter || 0).toFixed(2) : 0, 
      nos: isGroundFloorProposed ? 1 : 0, 
      qty: isGroundFloorProposed ? Number(plinthBeamQty || 0).toFixed(2) : "0.00", 
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

  const coreTotal = coreItems.reduce((sum, row) => sum + (Number(row.qty || 0) * Number(row.rate || 0)), 0);
  const rawBaseValue = Number(estimate.total_value || estimate.construction_cost || 0);
  const remainingBudget = Math.max(0, isNaN(rawBaseValue - coreTotal) ? 0 : rawBaseValue - coreTotal);

  const slabRates = Object.keys(slabConfig).map(Number).sort((a, b) => a - b);
  const activeSlab = slabRates.find(s => ratePerSqft <= s) || 5000;
  const w = slabConfig[activeSlab];
  
  const isLiftHidden = ratePerSqft >= 2700 && isGroundFloorOnly;
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
    ...(!isLiftHidden ? [{ description: masterItem.lift_installation_desc, l: "-", w: "-", ht: "-", nos: "-", qty: 1, unit: "LS", rate: ((finalW.lift || 0) * 100).toFixed(1) + "%" }] : []),
    { description: masterItem.consultant_fee_desc, l: "-", w: "-", ht: "-", nos: "-", qty: "-", unit: "LS", rate: ((finalW.cons || 0) * 100).toFixed(1) + "%" },
  ];

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
            <span className="font-mono font-bold text-slate-800">{estimate?.ref_no || "N/A"}</span>
          </span>
          <span>DATE: {new Date().toLocaleDateString('en-IN')}</span>
        </div>
      </div>

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold uppercase text-center">
          EXTENSION & RENOVATION ESTIMATE FOR {sortedFloors.join(" + ")}
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
            <th className="border border-black p-2">DESCRIPTION / FLOOR TYPE</th>
            <th className="border border-black p-2 w-[120px]">STATUS</th>
            <th className="border border-black p-2 w-[150px]">AREA</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(estimate?.floor_details || {})
            .map(([floor, data]: [string, any], index: number) => {
              const mode = estimate?.floor_modes?.[floor] || "BOTH";
              const rowsToRender = [];

              if (mode === "BOTH" || mode === "EXISTING") {
                rowsToRender.push(
                  <tr key={`existing-${floor}`}>
                    <td className="border border-black p-2 text-center">{index + 1}</td>
                    <td className="border border-black p-2">{floor} BUILT UP AREA</td>
                    <td className="border border-black p-2 text-center text-orange-600 font-semibold">EXISTING</td>
                    <td className="border border-black p-2 text-center">{data?.existing?.area || 0} SQ.FT</td>
                  </tr>
                );
              }

              if (mode === "BOTH" || mode === "PROPOSED") {
                rowsToRender.push(
                  <tr key={`proposed-${floor}`}>
                    <td className="border border-black p-2 text-center">{index + 1}</td>
                    <td className="border border-black p-2 font-bold">{floor} BUILT UP AREA</td>
                    <td className="border border-black p-2 text-center text-purple-700 font-bold">PROPOSED</td>
                    <td className="border border-black p-2 text-center font-bold">{data?.proposed?.area || 0} SQ.FT</td>
                  </tr>
                );
              }

              return rowsToRender;
            })}

          <tr>
            <td colSpan={3} className="border border-black p-2 font-bold text-right">
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
        <table className="w-full border border-black border-collapse mt-6">
          <thead>
            <tr>
              <th className="border p-2">SR</th>
              <th className="border p-2">DESCRIPTION</th>
              <th className="border p-2">NOS</th>
              <th className="border p-2">QTY</th>
              <th className="border p-2">UNIT</th>
              <th className="border p-2">RATE</th>
              <th className="border p-2">AMOUNT</th>
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
                      {row.unit === "LS" ? (showPercent ? `${calculatedPercent.toFixed(2)}%` : "-") : row.rate}
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
                        value={`${typeof window !== 'undefined' ? window.location.origin : 'https://construction-estimate-software.vercel.app'}/verify-estimate?ref=${estimate?.ref_no}`} 
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

      <div className="flex flex-wrap items-center justify-start gap-6 mt-8 mb-12 no-print border-t border-slate-200 pt-6">
        {(isPaid || isAlreadyPaid || userCategory === 'ADMIN') ? (
          <button
            onClick={handleSaveAndPrint}
            disabled={isSaving}
            className="bg-blue-600 text-white px-8 py-3 rounded shadow-md hover:bg-blue-700 transition font-bold"
          >
            {isSaving ? "SAVING..." : "PRINT ESTIMATE"}
          </button>
        ) : (
          <button
            onClick={handleRazorpayPayment}
            className="bg-green-600 text-white px-8 py-3 rounded shadow-md hover:bg-green-700 transition font-bold"
          >
            PAY TO PRINT (₹21)
          </button>
        )}

        <button
          onClick={() => {
            localStorage.removeItem("extensionEstimatePreview");
            router.push("/extension-estimate");
          }}
          className="bg-gray-600 text-white px-8 py-3 rounded shadow-md hover:bg-gray-700 transition font-bold ml-4" 
        >
          BACK TO INPUT
        </button>
      </div>
    </div>
  );
}