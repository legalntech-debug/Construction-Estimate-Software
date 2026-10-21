"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { fetchPricingRow, getDisplayPricing } from "@/lib/pricingFetch";
import { getItemRate } from "@/lib/pricing";

// Pricing item key for certificates in pricing_config (adjust if named differently)
const CERTIFICATE_PRICING_ITEM = "certificate";
const FALLBACK_FEE = 21;

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
  const paymentIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    const savedData = localStorage.getItem("certificatePreview");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setEstimate(parsed);
        
        // The input form sends the selected institution as `financial_institution`
        const selectedBank = parsed.financial_institution || parsed.bank_name;
        if (selectedBank) setBankName(selectedBank);
        if (parsed.inspection_date) setInspectionDate(parsed.inspection_date);
        if (parsed.completion_date) setCompletionDate(parsed.completion_date);

        // Check if matching record exists in local records with same key parameters
        const existingEstimates = JSON.parse(localStorage.getItem("estimates_records") || "[]");
        const matchedRecord = existingEstimates.find((item: any) => 
          item.customer_name === parsed.customer_name &&
          item.property_address === parsed.property_address &&
          item.total_builtup_area === parsed.total_builtup_area &&
          item.bank_name === (parsed.financial_institution || parsed.bank_name || bankName)
        );

        if (matchedRecord && (matchedRecord.isPaid || matchedRecord.platform_payment_status === "paid")) {
          paymentIdRef.current = matchedRecord.razorpay_payment_id || null;
          setIsPaid(true);
          setIsDraft(false);
          setCurrentRefNo(matchedRecord.ref_no);
        } else if (parsed.isPaid === true) {
          setIsPaid(true);
          setIsDraft(false);
          setCurrentRefNo(parsed.ref_no || generateRefNumber());
        } else {
          setIsPaid(false);
          setIsDraft(true);
          const userIdTag = user?.id ? `U${user.id}` : (user?.name ? user.name.replace(/\s+/g, '').toUpperCase() : "EXPERT");
          setCurrentRefNo(`DRAFT-${userIdTag}-${Math.floor(1000 + Math.random() * 9000)}`);
        }
      } catch (e) {
        console.error("Error parsing certificate data", e);
      }
    }
    const savedLogo = localStorage.getItem("customLogo");
    if (savedLogo) setLogoUrl(savedLogo);
  }, [user]);

  const generateRefNumber = () => {
    const currentYear = new Date().getFullYear();
    const financialYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    const usernameTag = user?.name ? user.name.replace(/\s+/g, '').toUpperCase() : (user?.id ? `U${user.id}` : "EXPERT");
    const randomSeq = `U${Math.floor(100 + Math.random() * 900)}`;
    return `LnT/${financialYear}/${usernameTag}/CERTIFICATE/${randomSeq}`;
  };

  const handleRazorpayPayment = async () => {
    if (isBusy) return;
    const finalRef = generateRefNumber();
    setCurrentRefNo(finalRef);

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
          paymentIdRef.current = response.razorpay_payment_id;
          setIsPaid(true);
          setIsDraft(false);

          // Record the gateway payment in estimates and mis_records (user_payment)
          const saved = await saveRecordToMIS(finalRef, {
            paymentId: response.razorpay_payment_id,
            amount: fee,
          });
          setIsBusy(false);
          alert(
            saved
              ? "Payment Successful! Certificate Generated & Saved to MIS and Estimates."
              : "Payment received, but the record could not be fully saved. Please contact support with your payment ID: " + response.razorpay_payment_id
          );
        },
        modal: { ondismiss: () => setIsBusy(false) },
        prefill: {
          name: estimate?.customer_name || "Client",
          email: user?.email || "legalntech@gmail.com",
          contact: user?.phone || "7987561396",
        },
        notes: {
          ref_no: finalRef,
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

  /**
   * Upserts the certificate into `estimates` and writes `user_payment` to both
   * `estimates` and `mis_records`. When `payment` is omitted (re-print of an
   * already paid record) the stored payment columns are left untouched.
   */
  const saveRecordToMIS = async (
    refNo: string,
    payment?: { paymentId: string; amount: number }
  ): Promise<boolean> => {
    const floorDetails = estimate?.floor_details || {};
    const currentCaseType = estimate?.estimate_type || estimate?.case_type || "CONSTRUCTION CERTIFICATE";
    const currentUserId = user?.id || null;

    const estimateRecordPayload: Record<string, any> = {
      ref_no: refNo,
      customer_name: estimate?.customer_name,
      property_address: estimate?.property_address,
      bank_name: bankName,
      total_builtup_area: estimate?.total_builtup_area,
      client_name: estimate?.client_name || estimate?.customer_name,
      representative: estimate?.representative || user?.name || "Er. Jasvant Chouhan",
      floor_details: floorDetails,
      platform_payment_status: "paid",
      payment_status: "paid",
      status: "finalized",
      estimate_type: currentCaseType,
      user_id: currentUserId,
      property_type: estimate?.property_type || "HOUSE",
      plot_area: estimate?.plot_area || null,
      fee_standard: estimate?.fee || estimate?.fee_amount || null,
      rate_per_sqft: estimate?.rate_per_sqft || 0
    };

    if (payment) {
      estimateRecordPayload.razorpay_payment_id = payment.paymentId;
      estimateRecordPayload.user_payment = payment.amount;
    }

    // Save locally for immediate UI reactivity
    const existingEstimates = JSON.parse(localStorage.getItem("estimates_records") || "[]");
    const previous = existingEstimates.find((item: any) => item.ref_no === refNo);
    const filteredEstimates = existingEstimates.filter((item: any) => item.ref_no !== refNo);
    localStorage.setItem(
      "estimates_records",
      JSON.stringify([{ ...(previous || {}), ...estimateRecordPayload, isPaid: true }, ...filteredEstimates])
    );

    try {
      const { error: estError } = await supabase
        .from("estimates")
        .upsert([estimateRecordPayload], { onConflict: "ref_no" });

      if (estError) {
        console.error("Supabase estimates upsert error:", estError.message);
        return false;
      }

      // Explicitly mirror the payment into mis_records so the gateway entry is never lost,
      // regardless of what the sync trigger copies.
      if (payment) {
        const { data: misRows, error: misError } = await supabase
          .from("mis_records")
          .update({
            user_payment: payment.amount,
            payment_status: "paid",
            platform_payment_status: "paid",
          })
          .eq("ref_no", refNo)
          .select("id");

        if (misError) {
          console.error("Supabase mis_records update error:", misError.message);
          return false;
        }
        if (!misRows || misRows.length === 0) {
          console.error("mis_records row not found for ref_no:", refNo);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("Error syncing record to database tables:", error);
      return false;
    }
  };

  const handleSaveAndPrint = async () => {
    if (isDraft || !isPaid) {
      handleRazorpayPayment();
      return;
    }

    setIsSaving(true);
    // Re-save without touching the stored payment columns
    await saveRecordToMIS(currentRefNo);
    setIsSaving(false);
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
          onClick={() => router.push("/estimate")}
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
            localStorage.removeItem("certificatePreview");
            router.push("/estimate");
          }}
          className="bg-gray-600 text-white px-8 py-3 rounded shadow-md hover:bg-gray-700 transition font-bold"
        >
          BACK TO INPUT
        </button>
      </div>
    </div>
  );
}