"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function CertificatePreviewPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [estimate, setEstimate] = useState<any>(null);
  const [bankName, setBankName] = useState("SMFG India Home Finance Company Ltd");
  const [inspectionDate, setInspectionDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [signatureDetails, setSignatureDetails] = useState("");
  const [currentRefNo, setCurrentRefNo] = useState("");
  const [isDraft, setIsDraft] = useState(true);
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

  useEffect(() => {
    const savedData = localStorage.getItem("certificatePreview");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setEstimate(parsed);
        
        if (parsed.bank_name) setBankName(parsed.bank_name);
        if (parsed.inspection_date) setInspectionDate(parsed.inspection_date);
        if (parsed.completion_date) setCompletionDate(parsed.completion_date);

        // Check if matching record exists in local records with same key parameters
        const existingEstimates = JSON.parse(localStorage.getItem("estimates_records") || "[]");
        const matchedRecord = existingEstimates.find((item: any) => 
          item.customer_name === parsed.customer_name &&
          item.property_address === parsed.property_address &&
          item.total_builtup_area === parsed.total_builtup_area &&
          item.bank_name === (parsed.bank_name || bankName)
        );

        if (matchedRecord && matchedRecord.isPaid) {
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

  const handleRazorpayPayment = () => {
    const finalRef = generateRefNumber();
    setCurrentRefNo(finalRef);

    const amountInPaise = 21 * 100; // ₹21
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_mockkeyID", 
      amount: amountInPaise,
      currency: "INR",
      name: `${user?.name || "Er. J. Chouhan"} Valuer Portal`,
      description: "Certificate Verification & Generation Fee",
      // Removed localhost image reference to avoid CORS loopback error in checkout popup
      handler: function (response: any) {
        setIsPaid(true);
        setIsDraft(false);
        saveRecordToMIS(finalRef, response.razorpay_payment_id);
        alert("Payment Successful! Certificate Generated & Saved to MIS and Estimates.");
      },
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

    if (typeof window !== "undefined" && (window as any).Razorpay) {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } else {
      setIsPaid(true);
      setIsDraft(false);
      saveRecordToMIS(finalRef, "TEST_PAYMENT_ID");
    }
  };

  const saveRecordToMIS = async (refNo: string, paymentId: string) => {
    const floorDetails = estimate?.floor_details || {};
    const currentCaseType = estimate?.estimate_type || estimate?.case_type || "CONSTRUCTION CERTIFICATE";
    const currentUserId = user?.id || null;

    // Sirf estimates table ka payload (Trigger khud mis_records mein sync kar dega)
    const estimateRecordPayload = {
      ref_no: refNo,
      customer_name: estimate?.customer_name,
      property_address: estimate?.property_address,
      bank_name: bankName,
      total_builtup_area: estimate?.total_builtup_area,
      client_name: estimate?.customer_name,
      representative: user?.name || "Er. Jasvant Chouhan",
      floor_details: floorDetails,
      razorpay_payment_id: paymentId,
      platform_payment_status: "paid",
      payment_status: "paid",
      status: "finalized",
      estimate_type: currentCaseType,
      user_id: currentUserId,
      property_type: estimate?.property_type || "HOUSE",
      plot_area: estimate?.plot_area || null,
      fee_standard: estimate?.fee || null,
      rate_per_sqft: estimate?.rate_per_sqft || 0
    };

    // Save locally for immediate UI reactivity
    const existingEstimates = JSON.parse(localStorage.getItem("estimates_records") || "[]");
    const filteredEstimates = existingEstimates.filter((item: any) => item.ref_no !== refNo);
    localStorage.setItem("estimates_records", JSON.stringify([estimateRecordPayload, ...filteredEstimates]));

    try {
      // Sirf 'estimates' table mein upsert karo. Trigger khud mis_records update kar dega!
      const { error: estError } = await supabase
        .from("estimates")
        .upsert([estimateRecordPayload], { onConflict: "ref_no" });
      
      if (estError) {
        console.error("Supabase estimates upsert error:", estError.message);
      } else {
        console.log("Successfully saved estimate, trigger will auto-sync MIS.");
      }

    } catch (error) {
      console.error("Error syncing record to database tables:", error);
    }
  };

  const handleSaveAndPrint = () => {
    if (isDraft || !isPaid) {
      handleRazorpayPayment();
      return;
    }

    setIsSaving(true);
    saveRecordToMIS(currentRefNo, "EXISTING_PAID_REF");
    setTimeout(() => {
      setIsSaving(false);
      window.print();
    }, 1000);
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

      <div className="certificate-sheet max-w-4xl mx-auto bg-white p-8 relative overflow-hidden">
        
        {isDraft && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <span className="text-red-500/15 font-extrabold text-[110px] tracking-widest uppercase transform -rotate-45 select-none">
              DRAFT
            </span>
          </div>
        )}

        {isDraft && (
          <div className="bg-amber-500 text-white text-center py-2 font-bold uppercase tracking-widest text-xs mb-4 rounded print:hidden shadow relative z-10">
            ⚠️ DRAFT PREVIEW MODE - COMPLETE PAYMENT (₹21) TO REMOVE WATERMARK & UNLOCK OFFICIAL CERTIFICATE
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
                      <p>IOV APPROVED VALUER A-33162</p>
                      <p>BUILDING PERMISSION DEPARTMENT</p>
                      <p>ENG/172/2024</p>
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
                      <p>ADDRESS GROUND FLOOR, BUILDING NO. 180/5,</p>
                      <p>MEGHDOOT NAGAR, INDORE</p>
                      <p>CONTACT NO. 79875-61396</p>
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
            I / We <strong>{user?.name || "Er. Jasvant Chouhan"}</strong>, having License Number <strong>172/2024</strong> have undertaken assignment as Engineer / Licensed Engineer appointed by <strong>{estimate.customer_name}</strong> for checking and certifying the construction work of the Building as per IS code Standards and following Building By laws / norms.
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
                    <p className="font-bold">{user?.name || "Er. J. Chouhan"}</p>
                    <p className="mt-1 break-words">{signatureDetails || "Digitally Verified & Approved"}</p>
                  </div>
                </div>
              ) : (
                <div className="h-16 flex items-center justify-center text-center">
                  <p className="text-xs text-red-500 font-bold italic">🔒 Digital Signature & Barcode Locked (Complete ₹21 Payment below to Unlock)</p>
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
          <button
            onClick={handleSaveAndPrint}
            disabled={isSaving}
            className="bg-blue-600 text-white px-8 py-3 rounded shadow-md hover:bg-blue-700 transition font-bold"
          >
            {isSaving ? "SAVING..." : "PRINT CERTIFICATE"}
          </button>
        ) : (
          <button
            onClick={handleRazorpayPayment}
            className="bg-green-600 text-white px-8 py-3 rounded shadow-md hover:bg-green-700 transition font-bold animate-pulse"
          >
            PAY TO REMOVE DRAFT & UNLOCK (₹21)
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