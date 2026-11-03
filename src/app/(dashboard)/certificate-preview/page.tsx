"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { fetchPricingRow, getDisplayPricing } from "@/lib/pricingFetch";
import { getItemRate } from "@/lib/pricing";
import {
  NAME_ADDRESS_CHANGE_LIMIT,
  isRealRef,
  isNameAddressChangeMajor,
  isEstimateExpired,
} from "@/lib/estimateRules";

// Pricing item key for certificates in pricing_config (adjust if named differently)
const CERTIFICATE_PRICING_ITEM = "certificate";
const FALLBACK_FEE = 21;

// localStorage key shared with the input form (/construction-certificate)
const CERTIFICATE_STORAGE_KEY = "certificatePreview";
const CERTIFICATE_FORM_ROUTE = "/construction-certificate";

// Ref no format (same idea as the estimate preview):  LnT/26-27/JASVANT/U001/CT0001
//   U001  = this user's own certificate count
//   CT0001 = GLOBAL certificate counter (DB sequence, see certificate_ref_counter.sql)
// The "CT" prefix keeps certificate refs different from estimate refs (C0001), because
// mis_records.ref_no is unique across modules.
const CERT_SERIES_PREFIX = "CT";

// Same status value the estimate flow passes to its save RPC
const CERT_SAVE_STATUS = "pending";

type PaymentData = {
  p_payment_status: string;
  p_order_id: string | null;
  p_payment_id: string | null;
  p_user_payment: number;
};

// A saved certificate ref: a real ref (estimateRules) that is not a DRAFT placeholder or an old temporary "CERT-<timestamp>" id
const isCertRef = (ref?: string | null): boolean => {
  const r = String(ref || "").trim().toUpperCase();
  return !!r && !r.startsWith("DRAFT") && !r.startsWith("CERT-") && isRealRef(ref);
};

/**
 * Confirms against the database that a ref no really belongs to a PAID certificate.
 * Local flags (React state / localStorage) can be edited by the user, so every action that releases
 * a printout (print, PDF download, share, save of a paid record) is checked here first.
 * Fails closed: a missing record or a network error counts as "not paid".
 */
async function verifyPaidOnServer(refNo?: string | null): Promise<boolean> {
  if (!isCertRef(refNo)) return false;
  try {
    const { data: cert } = await supabase
      .from("certificates")
      .select("payment_status")
      .eq("ref_no", refNo)
      .maybeSingle();
    if (cert && String(cert.payment_status || "").toLowerCase() === "paid") return true;

    const { data: mis } = await supabase
      .from("mis_records")
      .select("platform_payment_status")
      .eq("ref_no", refNo)
      .maybeSingle();
    return !!mis && String(mis.platform_payment_status || "").toLowerCase() === "paid";
  } catch (err) {
    console.error("[CERTIFICATE PRINT GUARD] Payment verification failed:", err);
    return false;
  }
}

/**
 * New certificate ref no (only for a fresh record or a new-payment record).
 * The global part comes from a database sequence, so it is the same series for every user
 * (RLS-safe and atomic) - a count(*) query would only see the user's own rows.
 */
async function generateCertificateRef(userId: string, fullName?: string | null): Promise<string> {
  const now = new Date();
  const fy = (now.getMonth() + 1) >= 4
    ? `${String(now.getFullYear()).slice(-2)}-${String(now.getFullYear() + 1).slice(-2)}`
    : `${String(now.getFullYear() - 1).slice(-2)}-${String(now.getFullYear()).slice(-2)}`;
  const firstName = (fullName || "GUEST").trim().split(/\s+/)[0].toUpperCase();

  // A. the user's own certificate count (U001, U002 ...)
  let userSeq = 1;
  try {
    const { count, error } = await supabase
      .from("certificates")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if (!error && count !== null) userSeq = count + 1;
  } catch {}

  // B. global certificate number (CT0001, CT0002 ...)
  let globalPart: string;
  try {
    const { data, error } = await supabase.rpc("next_certificate_seq");
    if (error || data === null || data === undefined) throw error || new Error("next_certificate_seq returned empty");
    globalPart = `${CERT_SERIES_PREFIX}${String(Number(data)).padStart(4, "0")}`;
  } catch (err) {
    // Never fall back to a small number (could collide with an existing ref after the payment was taken)
    console.error("[CERTIFICATE REF] sequence unavailable, using timestamp fallback:", err);
    globalPart = `${CERT_SERIES_PREFIX}${String(Date.now()).slice(-8)}`;
  }

  return `LnT/${fy}/${firstName}/U${String(userSeq).padStart(3, "0")}/${globalPart}`;
}

export default function CertificatePreviewPage() {
  const router = useRouter();
  const auth: any = useAuth();
  const user: any = auth?.currentUser ?? auth?.user;
  
  const [estimate, setEstimate] = useState<any>(null);
  const [bankName, setBankName] = useState("SMFG India Home Finance Company Ltd");
  const [inspectionDate, setInspectionDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [signatureDetails, setSignatureDetails] = useState("");
  const [currentRefNo, setCurrentRefNo] = useState("");
  const [isDraft, setIsDraft] = useState(true);
  const [fee, setFee] = useState<number>(FALLBACK_FEE);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  // certificates.id of the saved record (reopen / reprint -> UPDATE the same record)
  const [certificateId, setCertificateId] = useState<string | null>(null);
  // name/address changed > limit or record older than 60 days -> brand new record + new ref no + new payment
  const [needsNewPayment, setNeedsNewPayment] = useState(false);
  const [newPaymentReason, setNewPaymentReason] = useState("");
  const [originalRefNo, setOriginalRefNo] = useState<string | null>(null);
  // payment taken but the save failed -> keep the details so the save can be retried (never charge twice)
  const [pendingPayment, setPendingPayment] = useState<PaymentData | null>(null);
  const isSavingRef = useRef(false);
  const paymentIdRef = useRef<string | null>(null);
  const orderIdRef = useRef<string | null>(null);
  const userPaymentRef = useRef<number | null>(null);
  const currentCaseType = estimate?.estimate_type || estimate?.case_type || "CONSTRUCTION CERTIFICATE";
  const userCategory = user?.category || "ENGINEER";
  const [useCustomLetterhead, setUseCustomLetterhead] = useState(false);
  const [customHeaderTitle, setCustomHeaderTitle] = useState("");
  const [customSubtitle, setCustomSubtitle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [legalText, setLegalText] = useState("IOV APPROVED VALUER A-33162 | BUILDING PERMISSION DEPARTMENT");

  // Load Razorpay Script Dynamically
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Resolve the certificate fee from the pricing table (state + user category)
  useEffect(() => {
    let alive = true;
    const targetState = user?.state || estimate?.state_name || "MADHYA PRADESH";
    const pricingCategory = String(user?.user_type || user?.category || "INDIVIDUAL USER").toUpperCase();

    (async () => {
      setPricingLoading(true);
      try {
        const row = await fetchPricingRow(CERTIFICATE_PRICING_ITEM, targetState, pricingCategory);
        const display = getDisplayPricing(row);
        if (!alive) return;
        setFee(
          display.isFromDB && display.price > 0
            ? display.price
            : getItemRate(targetState, CERTIFICATE_PRICING_ITEM) || FALLBACK_FEE
        );
      } catch (err) {
        console.error("[CERTIFICATE PRICING ERROR]", err);
        if (alive) setFee(getItemRate(targetState, CERTIFICATE_PRICING_ITEM) || FALLBACK_FEE);
      } finally {
        if (alive) setPricingLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [user?.state, user?.user_type, user?.category, estimate?.state_name]);

  // ---------------------------------------------------------------
  // LOAD the certificate from the input form and decide: paid reprint / new payment / draft.
  // The decision comes from the DATABASE (not from localStorage flags):
  //   - ref no exists + paid + name/address changed <= limit + younger than 60 days -> same record (reprint / update)
  //   - changed more than the limit, or older than 60 days                          -> new record, new ref no, new payment
  //   - no ref no / not paid                                                         -> draft, pay to unlock
  // ---------------------------------------------------------------
  useEffect(() => {
    let alive = true;

    const savedLogo = localStorage.getItem("customLogo");
    if (savedLogo) setLogoUrl(savedLogo);

    const savedData = localStorage.getItem(CERTIFICATE_STORAGE_KEY);
    if (!savedData) return;

    let parsed: any;
    try {
      parsed = JSON.parse(savedData);
    } catch (e) {
      console.error("Error parsing certificate data", e);
      return;
    }

    setEstimate(parsed);
    // The input form sends the selected institution as `financial_institution`
    const selectedBank = parsed.financial_institution || parsed.bank_name;
    if (selectedBank) setBankName(selectedBank);
    if (parsed.inspection_date) setInspectionDate(parsed.inspection_date);
    if (parsed.completion_date) setCompletionDate(parsed.completion_date);

    const showDraft = () => {
      const userIdTag = user?.id ? `U${String(user.id).slice(0, 6)}` : (user?.name ? user.name.replace(/\s+/g, '').toUpperCase() : "EXPERT");
      setIsPaid(false);
      setIsDraft(true);
      setCurrentRefNo(`DRAFT-${userIdTag}-${Math.floor(1000 + Math.random() * 9000)}`);
    };

    (async () => {
      if (!isCertRef(parsed.ref_no)) {
        showDraft();
        return;
      }
      const refNo: string = parsed.ref_no;
      try {
        const { data: cert } = await supabase
          .from("certificates")
          .select("*")
          .eq("ref_no", refNo)
          .maybeSingle();

        let paid = !!cert && String(cert.payment_status || "").toLowerCase() === "paid";
        const { data: mis } = await supabase
          .from("mis_records")
          .select("*")
          .eq("ref_no", refNo)
          .maybeSingle();
        if (!paid) paid = !!mis && String(mis.platform_payment_status || "").toLowerCase() === "paid";

        if (!alive) return;
        if (!paid) {
          showDraft();
          return;
        }

        // 15% rule + 60-day rule (same helpers as the estimate preview)
        const changedTooMuch = !!cert && isNameAddressChangeMajor(
          { customer_name: cert.customer_name, property_address: cert.property_address },
          { customer_name: parsed.customer_name, property_address: parsed.property_address }
        );
        const expired = !!cert && isEstimateExpired(cert.created_at);

        if (changedTooMuch || expired) {
          setNeedsNewPayment(true);
          setNewPaymentReason(expired ? "EXPIRED_60_DAYS" : "CHANGED");
          setOriginalRefNo(refNo);
          setCertificateId(null);
          setEstimate((prev: any) => (prev ? { ...prev, id: null, ref_no: null } : prev));
          showDraft();
          return;
        }

        // Paid + same record -> keep its payment details so that a re-save never wipes them
        orderIdRef.current = mis?.razorpay_order_id ?? null;
        paymentIdRef.current = mis?.razorpay_payment_id ?? null;
        const storedAmount = Number(mis?.amount_paid ?? mis?.user_payment ?? 0);
        userPaymentRef.current = storedAmount > 0 ? storedAmount : null;

        setCertificateId(cert?.id ?? parsed.id ?? null);
        setIsPaid(true);
        setIsDraft(false);
        setCurrentRefNo(refNo);
      } catch (err) {
        console.error("[CERTIFICATE LOAD] payment status check failed:", err);
        if (alive) showDraft(); // fail closed
      }
    })();

    return () => { alive = false; };
  }, [user?.id]);

  // ---------------------------------------------------------------
  // SAVE (create / update) through rpc_save_certificate
  //   - fresh record or new payment -> new ref no (global sequence) + INSERT
  //   - same ref no (reprint / minor change) -> UPDATE the existing record
  //   - every detail of the form goes into `snapshot`; client / fee / areas are also mirrored into the
  //     mis_records columns that exist
  // ---------------------------------------------------------------
  const handleSaveAndFinalize = async (paymentData?: PaymentData): Promise<boolean> => {
    if (isSavingRef.current) return false;

    const userId = user?.id;
    if (!userId) { alert("User ID not found! Please login again."); return false; }

    // A fresh payment or an admin is always authorized. A "paid" flag alone is NOT trusted (it can be edited in
    // localStorage / React state): the ref no must exist in the database as a paid certificate.
    let isAuthorized: boolean = userCategory === "ADMIN" || !!paymentData;
    if (!isAuthorized && isPaid && !needsNewPayment) {
      isAuthorized = await verifyPaidOnServer(currentRefNo);
    }
    if (!isAuthorized) {
      alert(`Payment of ₹${fee}/- is required to save and print.`);
      return false;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      let activeRefNo: string | null = !needsNewPayment && isCertRef(currentRefNo) ? currentRefNo : null;
      let activeId: string | null = needsNewPayment ? null : certificateId;
      const hadRefNoAtStart = !!activeRefNo;

      // State has the ref no but not the id -> find the exact record
      if (!activeId && activeRefNo) {
        const { data: found } = await supabase
          .from("certificates")
          .select("id")
          .eq("ref_no", activeRefNo)
          .eq("user_id", userId)
          .maybeSingle();
        if (found) activeId = found.id;
      }

      // A new ref no is generated only for a fresh / new-payment record
      if (!activeRefNo) {
        activeRefNo = await generateCertificateRef(userId, user?.full_name || user?.name);
      }

      // Payment details: a fresh payment brings its own; a re-save keeps the stored ones
      // (the RPC overwrites razorpay ids / amount in mis_records, so they must be passed again)
      const orderId = paymentData?.p_order_id ?? orderIdRef.current ?? null;
      const paymentId = paymentData?.p_payment_id ?? paymentIdRef.current ?? null;
      const amount = Number(
        paymentData?.p_user_payment ??
        userPaymentRef.current ??
        (hadRefNoAtStart || userCategory === "ADMIN" ? 0 : fee)
      ) || 0;

      const snapshot = {
        ...(estimate || {}),
        id: undefined,
        ref_no: activeRefNo,
        bank_name: bankName,
        financial_institution: bankName,
        inspection_date: inspectionDate,
        completion_date: completionDate,
        signature_details: signatureDetails,
        user_payment: amount,
        saved_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.rpc("rpc_save_certificate", {
        p_certificate_id: activeId,
        p_user_id: userId,
        p_customer_name: estimate?.customer_name || "GUEST",
        p_property_address: estimate?.property_address || "",
        p_ref_no: activeRefNo,
        p_snapshot: snapshot,
        p_status: CERT_SAVE_STATUS,
        p_payment_status: paymentData?.p_payment_status || "paid",
        p_order_id: orderId,
        p_payment_id: paymentId,
        p_user_payment: amount,
        // details for mis_records (client, representative, fee, areas ...)
        p_client_name: estimate?.client_name || null,
        p_representative: estimate?.representative || null,
        p_fee_standard: Number(estimate?.fee_amount) || null,
        p_plot_area: Number(String(estimate?.plot_area ?? "").replace(/,/g, "")) || null,
        p_total_builtup_area: Number(estimate?.total_builtup_area) || null,
        p_floor_details: estimate?.floor_details && typeof estimate.floor_details === "object" ? estimate.floor_details : null,
        p_bank_name: bankName || null,
        p_case_type: currentCaseType,
      });
      if (error) throw error;

      const result: any = Array.isArray(data) ? data[0] : data;
      const savedId: string | null = result?.certificate_id ?? result?.id ?? null;
      if (!result || !savedId) {
        throw new Error("Certificate record could not be saved (no record returned). Please try again.");
      }
      const savedRef: string = result.ref_no || activeRefNo;

      // Success
      orderIdRef.current = orderId;
      paymentIdRef.current = paymentId;
      userPaymentRef.current = amount > 0 ? amount : userPaymentRef.current;
      setCertificateId(savedId);
      setCurrentRefNo(savedRef);
      setEstimate((prev: any) => ({ ...(prev || {}), id: savedId, ref_no: savedRef }));
      setIsPaid(true);
      setIsDraft(false);
      setNeedsNewPayment(false);
      setOriginalRefNo(null);
      setNewPaymentReason("");
      setPendingPayment(null);

      // Keep the saved data + ref no + id so that "Back to Input" returns with everything still filled in
      try {
        localStorage.setItem(
          CERTIFICATE_STORAGE_KEY,
          JSON.stringify({
            ...(estimate || {}),
            id: savedId,
            ref_no: savedRef,
            financial_institution: bankName,
            bank_name: bankName,
            inspection_date: inspectionDate,
            completion_date: completionDate,
            payment_status: "paid",
            isPaid: true,
          })
        );
      } catch {}
      return true;
    } catch (err: any) {
      console.error("[CERTIFICATE SAVE ERROR]", err);
      alert("Error: " + (err?.message || "Failed to save certificate"));
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (isBusy) return;

    try {
      setIsBusy(true);
      if (typeof window === "undefined" || !(window as any).Razorpay) {
        throw new Error("Payment gateway is still loading. Please try again.");
      }

      // Create a server-side order for the fee resolved from the pricing table
      const orderRes = await fetch("/api/analyze/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: fee }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || "Failed to create order");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_mockkeyID",
        amount: Math.round(fee * 100), // paise
        currency: "INR",
        order_id: order.id,
        name: `${user?.name || "Er. J. TOMAR"} Valuer Portal`,
        description: "Certificate Verification & Generation Fee",
        handler: async function (response: any) {
          const paymentDetails: PaymentData = {
            p_payment_status: "paid",
            p_order_id: response.razorpay_order_id || order.id || null,
            p_payment_id: response.razorpay_payment_id,
            p_user_payment: fee,
          };
          paymentIdRef.current = response.razorpay_payment_id;
          setPendingPayment(paymentDetails); // cleared by a successful save; lets the user retry without paying again

          // The ref no is generated here (after the payment), exactly like the estimate preview
          const saved = await handleSaveAndFinalize(paymentDetails);
          setIsBusy(false);
          if (saved) {
            alert("Payment Successful! Certificate Generated & Saved to MIS.");
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            alert("Payment received, but the record could not be saved. Press 'RETRY SAVE' (do not pay again). Payment ID: " + response.razorpay_payment_id);
          }
        },
        modal: { ondismiss: () => setIsBusy(false) },
        prefill: {
          name: estimate?.customer_name || "Client",
          email: user?.email || "legalntech@gmail.com",
          contact: user?.phone || "7987561396",
        },
        notes: {
          case_type: "Construction Certificate",
        },
        theme: {
          color: "#2563eb",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("[CERTIFICATE PAYMENT INIT ERROR]", err);
      alert("Payment initialization failed. " + (err?.message || "Please try again."));
      setIsBusy(false);
    }
  };

  // Verify on the server, then save the latest edits (same ref no -> UPDATE) before anything is released
  const releaseGuard = async (): Promise<boolean> => {
    if (userCategory !== "ADMIN") {
      const verified = await verifyPaidOnServer(currentRefNo);
      if (!verified) { alert("🔒 Server verification failed."); return false; }
    }
    return handleSaveAndFinalize();
  };

  const handleSaveAndPrint = async () => {
    if (isDraft || !isPaid) {
      handleRazorpayPayment();
      return;
    }
    if (!(await releaseGuard())) return;
    window.print();
  };

  // ---------------------------------------------------------------
  // PDF export (download + share). Requires: npm i html2canvas jspdf
  // ---------------------------------------------------------------
  const pdfFileName = `Certificate_${(currentRefNo || "draft").replace(/[^\w-]+/g, "_")}.pdf`;

  const buildPdfBlob = async (): Promise<Blob> => {
    const el = document.getElementById("certificate-preview-container");
    if (!el) throw new Error("Certificate container not found");

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      // Skip on-screen only controls (class "print:hidden")
      ignoreElements: (node: Element) => node.classList?.contains("print:hidden"),
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    const img = canvas.toDataURL("image/jpeg", 0.95);

    // Slice the tall image across multiple A4 pages
    let offsetY = 0;
    let remaining = imgH;
    pdf.addImage(img, "JPEG", 0, offsetY, pageW, imgH);
    remaining -= pageH;
    while (remaining > 0) {
      offsetY -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, offsetY, pageW, imgH);
      remaining -= pageH;
    }
    return pdf.output("blob");
  };

  const triggerDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (isBusy) return;
    try {
      setIsBusy(true);
      if (!(await releaseGuard())) return;
      triggerDownload(await buildPdfBlob());
    } catch (err: any) {
      alert("PDF download failed: " + (err?.message || ""));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSharePdf = async () => {
    if (isBusy) return;
    try {
      setIsBusy(true);
      if (!(await releaseGuard())) return;
      const blob = await buildPdfBlob();
      const file = new File([blob], pdfFileName, { type: "application/pdf" });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Construction Certificate" });
      } else {
        // Browsers without file sharing support: fall back to download
        triggerDownload(blob);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") alert("Share failed: " + (err?.message || ""));
    } finally {
      setIsBusy(false);
    }
  };

  if (!estimate) {
    return (
      <div className="p-10 text-center font-sans">
        <p className="text-gray-600 font-bold mb-4">No certificate data found.</p>
        <button 
          onClick={() => router.push(CERTIFICATE_FORM_ROUTE)}
          className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  const floorDetails = estimate.floor_details || {};
  const sortedFloors = Object.keys(floorDetails).filter(
    (floor) => floorDetails[floor]?.selected || floorDetails[floor]?.area > 0
  );

  return (
    <div className="bg-white min-h-screen relative font-sans text-sm p-8 md:p-12 print:p-0">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .bg-white.min-h-screen, .bg-white.min-h-screen * {
            visibility: visible !important;
          }
          .bg-white.min-h-screen {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            background: white !important;
            box-shadow: none !important;
          }
          .print\:hidden {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
        }
      `}</style>

      <div id="certificate-preview-container" className="certificate-sheet max-w-4xl mx-auto bg-white p-8 relative overflow-hidden">
        
        {isDraft && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <span className="text-red-500/15 font-extrabold text-[110px] tracking-widest uppercase transform -rotate-45 select-none">
              DRAFT
            </span>
          </div>
        )}

        {isDraft && (
          <div className="bg-amber-500 text-white text-center py-2 font-bold uppercase tracking-widest text-xs mb-4 rounded print:hidden shadow relative z-10">
            ⚠️ DRAFT PREVIEW MODE - COMPLETE PAYMENT (₹{fee}) TO REMOVE WATERMARK & UNLOCK OFFICIAL CERTIFICATE
          </div>
        )}

        {['ENGINEER', 'ARCHITECT', 'ADMIN'].includes(userCategory) && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-left print:hidden shadow-sm relative z-10">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 mt-3">
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

        <div className="mb-6 border-b-2 border-black pb-4 relative z-10">
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="w-1/3 text-[11px] uppercase font-bold text-slate-700 align-middle leading-tight">
                  {useCustomLetterhead ? (
                    <p className="text-base text-black font-bold uppercase">{customHeaderTitle || "ENTER HEADER TITLE"}</p>
                  ) : (
                    <>
                      <p>T&CP 23IND-IER050924212</p>
                    </>
                  )}
                </td>

                <td className="w-1/3 text-center align-middle py-1">
                  {useCustomLetterhead ? (
                    <div className="relative group cursor-pointer border border-dashed border-gray-400 p-1 rounded inline-flex items-center justify-center h-16 w-32 mx-auto">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Custom Logo" className="h-14 w-auto object-contain" />
                      ) : (
                        <div className="text-center text-[9px] text-gray-500 font-bold uppercase">Insert Logo</div>
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
                    <img src="/logo.jpg" alt="Logo" className="h-16 w-auto object-contain mx-auto" />
                  )}
                </td>

                <td className="w-1/3 text-[11px] text-right font-bold text-slate-700 align-middle leading-tight">
                  {useCustomLetterhead ? (
                    <p className="text-xs text-black font-medium uppercase">{customSubtitle || "ENTER DESIGNATION"}</p>
                  ) : (
                    <>
                      <p>203, MAYUR COMPLEX, 49 SUTAR GALI,</p>
        <p>JAIL ROAD, INDORE (M.P)</p>
        <p>CONTACT NO. 8103804355 / 79875-61396 </p>
        <p>Gmail: legalntech@gmail.com</p>
                    </>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-3 text-center font-bold text-slate-700 uppercase leading-normal border-t pt-2">
            <input
              type="text"
              value={legalText}
              onChange={(e) => setLegalText(e.target.value)}
              disabled={!useCustomLetterhead}
              className={`w-full text-xs font-bold border-none text-center uppercase tracking-wider ${!useCustomLetterhead ? "bg-transparent cursor-default" : "bg-white border border-slate-200 py-1"}`}
            />
          </div>
          
          <hr className="w-full border-t border-black my-2" />

          <div className="flex justify-between items-center text-xs px-1 font-semibold">
            <span>
              <strong>REF NO:</strong> <span className="font-mono font-bold text-slate-900">{currentRefNo}</span>
            </span>
            <span><strong>DATE:</strong> {new Date().toLocaleDateString('en-IN')}</span>
          </div>
        </div>

        <div className="space-y-4 text-justify text-slate-900 leading-relaxed relative z-10 text-xs sm:text-sm">
          <p className="italic text-gray-600 print:hidden">
            (To be submitted at the time of Home Loan disbursement)
          </p>

          <div>
            <p className="font-bold">To,</p>
            <div className="flex items-center gap-2 mt-1">
              <input 
                type="text" 
                value={bankName} 
                onChange={(e) => setBankName(e.target.value)}
                className="font-bold border-b border-dashed border-gray-400 bg-transparent w-full focus:outline-none focus:border-black text-sm"
              />
            </div>
          </div>

          <div>
            <p className="font-bold uppercase tracking-wide">
              Subject : Certificate regarding Construction Work for the Building (termed as Property) of {estimate.customer_name}
            </p>
          </div>

          <p className="font-medium uppercase leading-normal">
            <strong>Property Address:</strong> {estimate.property_address}
          </p>

          <p>
            Admeasuring{" "}
            {sortedFloors.length > 0 ? sortedFloors.map((floor, idx) => {
              const area = floorDetails[floor]?.area || 0;
              const prefix = idx === 0 ? "" : idx === sortedFloors.length - 1 ? " and " : ", ";
              return `${prefix}${floor.toLowerCase()} area ${area} sq.ft`;
            }).join("") : `${estimate.total_builtup_area || 1000} sq.ft`}
            {` and total area is ${estimate.total_builtup_area || 1000} sq.ft of Built up area contracted by `}
            <strong>{estimate.customer_name}</strong>.
          </p>

          <p>Sir / Madam,</p>

          <p>
            I / We <strong>{user?.name || "Er. J. Tomar"}</strong>, having License Number <strong>T&CP 23IND-IER050924212</strong> have undertaken assignment as Engineer / Licensed Engineer appointed by <strong>{estimate.customer_name}</strong> for checking and certifying the construction work of the Building as per IS code Standards and following Building By laws / norms.
          </p>

          <p>
            Based on the site inspection conducted by us on date 
            <input 
              type="text" 
              placeholder="DD/MM/YYYY" 
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              className="mx-2 px-2 py-0.5 text-center border-b border-black text-xs font-mono w-28 bg-transparent"
            /> 
            for the building, hereby certify that the construction is completed on date 
            <input 
              type="text" 
              placeholder="DD/MM/YYYY" 
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
              className="mx-2 px-2 py-0.5 text-center border-b border-black text-xs font-mono w-28 bg-transparent"
            /> 
            and the Built up structure is strictly as per sanctioned plan and / or building by laws.
          </p>

          <div className="pt-4 mt-6">
            <p className="font-bold mb-4">Yours Faithfully,</p>
            
            <div className="max-w-md border border-slate-300 rounded-lg p-4 bg-slate-50/50">
              {isPaid ? (
                <div className="flex flex-row items-center justify-between gap-4">
                  <div className="flex flex-col items-center">
                    <QRCodeSVG 
                      value={`${typeof window !== 'undefined' ? window.location.origin : 'https://construction-estimate-software.vercel.app'}/verify-estimate?ref=${currentRefNo}`} 
                      size={65} 
                      level="H" 
                    />
                    <p className="text-[8px] mt-1 text-gray-500 font-bold text-center">SCAN TO VERIFY</p>
                  </div>

                  <div className="text-[10px] text-blue-900 border border-blue-200 bg-blue-50 p-2.5 rounded text-left w-full shadow-sm">
                    <p className="font-bold border-b border-blue-200 mb-1">✓ VERIFIED SIGNATURE</p>
                    <p className="font-bold">{user?.name || "Er. J. TOMAR"}</p>
                    <p className="mt-1 break-words">{signatureDetails || "Digitally Verified & Approved"}</p>
                  </div>
                </div>
              ) : (
                <div className="h-16 flex items-center justify-center text-center">
                  <p className="text-xs text-red-500 font-bold italic">🔒 Digital Signature & Barcode Locked (Complete ₹{fee} Payment below to Unlock)</p>
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-black w-72 pt-1">
              <p className="text-xs font-bold uppercase tracking-wide">(Seal and Stamp of Engineers / Firm)</p>
            </div>
          </div>
        </div>

      </div>

      {needsNewPayment && !isPaid && (
        <p className="print:hidden max-w-4xl mx-auto mt-6 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded p-3">
          {newPaymentReason === "EXPIRED_60_DAYS"
            ? `⚠️ This certificate is older than 60 days, so it is treated as a NEW certificate (previous Ref: ${originalRefNo || "-"}). A new REF NO will be generated and a new payment is required to print.`
            : `⚠️ Customer name or property address changed by more than ${NAME_ADDRESS_CHANGE_LIMIT}%, so this is treated as a NEW certificate (previous Ref: ${originalRefNo || "-"}). A new REF NO will be generated and a new payment is required to print.`}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-start gap-4 mt-10 mb-12 print:hidden border-t border-slate-200 pt-6 font-sans max-w-4xl mx-auto">
        {isPaid ? (
          <>
            <button
              onClick={handleSaveAndPrint}
              disabled={isSaving || isBusy}
              className="bg-blue-600 text-white px-8 py-3 rounded shadow-md hover:bg-blue-700 transition font-bold"
            >
              {isSaving ? "SAVING..." : "PRINT CERTIFICATE"}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isBusy}
              className="bg-emerald-600 text-white px-8 py-3 rounded shadow-md hover:bg-emerald-700 transition font-bold disabled:opacity-60"
            >
              {isBusy ? "PLEASE WAIT..." : "DOWNLOAD PDF"}
            </button>
            <button
              onClick={handleSharePdf}
              disabled={isBusy}
              className="bg-indigo-600 text-white px-8 py-3 rounded shadow-md hover:bg-indigo-700 transition font-bold disabled:opacity-60"
            >
              SHARE
            </button>
          </>
        ) : pendingPayment ? (
          <button
            onClick={async () => {
              const ok = await handleSaveAndFinalize(pendingPayment);
              if (ok) alert("Certificate saved.");
            }}
            disabled={isSaving}
            className="bg-orange-600 text-white px-8 py-3 rounded shadow-md hover:bg-orange-700 transition font-bold disabled:opacity-60"
          >
            {isSaving ? "SAVING..." : "RETRY SAVE (PAYMENT ALREADY RECEIVED)"}
          </button>
        ) : (
          <button
            onClick={handleRazorpayPayment}
            disabled={pricingLoading || isBusy}
            className="bg-green-600 text-white px-8 py-3 rounded shadow-md hover:bg-green-700 transition font-bold animate-pulse disabled:opacity-60"
          >
            {pricingLoading ? "LOADING PRICE..." : `PAY TO REMOVE DRAFT & UNLOCK (₹${fee})`}
          </button>
        )}

        <button
          onClick={() => {
            // Keep the data (with ref no / id) so the input form comes back filled in - same as the estimate preview
            router.push(CERTIFICATE_FORM_ROUTE);
          }}
          className="bg-gray-600 text-white px-8 py-3 rounded shadow-md hover:bg-gray-700 transition font-bold"
        >
          BACK TO INPUT
        </button>
      </div>
    </div>
  );
}