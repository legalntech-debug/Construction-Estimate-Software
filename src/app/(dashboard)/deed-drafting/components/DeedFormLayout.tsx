'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Section1CaseInfo from "./sections/Section1CaseInfo";
import Section2Parties from "./sections/Section2Parties";
import Section3PropertyDetails from "./sections/Section3PropertyDetails";
import Section4TransactionDocs from "./sections/Section4TransactionDocs";
import Section5Actions from "./sections/Section5Actions";
import { DeedFormData } from "../types/deed";
import { generateDeedHtmlContent } from "../utils/deedTemplates";
import { supabase } from "@/lib/supabase";
import { getItemRate } from "@/lib/pricing";
// ✅ NEW: State-wise DB pricing
import { fetchPricingRow, getDisplayPricing } from "@/lib/pricingFetch";

interface DeedFormLayoutProps {
  initialData?: any;
}

const generateReferenceNumber = (userFullName: string, sequenceNumber: number | string): string => {
  const today = new Date();
  const currentMonth = today.getMonth(); 
  const currentYear = today.getFullYear();
  
  let startYear: number;
  let endYearSuffix: string;

  if (currentMonth >= 3) {
    startYear = currentYear;
    endYearSuffix = (currentYear + 1).toString().slice(-2);
  } else {
    startYear = currentYear - 1;
    endYearSuffix = currentYear.toString().slice(-2);
  }
  
  const financialYear = `FY${startYear}-${endYearSuffix}`;
  const firstName = userFullName 
    ? userFullName.trim().split(" ")[0].replace(/[^a-zA-Z]/g, "") 
    : "Client";

  const formattedSeq = typeof sequenceNumber === 'number' 
    ? `D${sequenceNumber.toString().padStart(4, '0')}` 
    : sequenceNumber.startsWith('D') ? sequenceNumber : `D${sequenceNumber}`;

  return `${financialYear}/${firstName}/${formattedSeq}`;
};

export default function DeedFormLayout({ initialData }: DeedFormLayoutProps) {
  const router = useRouter();

  const [formData, setFormData] = useState<DeedFormData>(() => {
    if (initialData) {
      return {
        caseType: "Deed Draft",
        feeMode: "Auto",
        feeAmount: 0,
        clientName: "",
        representativeName: "",
        stateName: "MADHYA PRADESH",
        cityName: "INDORE",
        propertyType: "HOUSE",
        deedType: "SALE DEED",
        outputLanguage: "HINDI",
        sellers: [{ name: "", details: "" }],
        buyers: [{ name: "", details: "" }],
        propertyAddress: "",
        plotArea: "",
        plotAreaUnit: "Sq. Ft.",
        floorsList: [{ floorName: "GROUND FLOOR", builtUpArea: "", areaUnit: "Sq. Ft.", constructionType: "RCC Frame Structure" }],
        parentDocument: "",
        considerationAmount: "",
        installments: [],
        bayanaAmount: "",
        remainingAmount: "",
        paymentPeriod: "3 माह",
        bankName: "",
        loanAmount: "",
        boundaryEast: "",
        boundaryWest: "",
        boundaryNorth: "",
        boundarySouth: "",
        ...initialData,
      };
    }

    return {
      caseType: "Deed Draft",
      feeMode: "Auto",
      feeAmount: 0,
      clientName: "",
      representativeName: "",
      stateName: "MADHYA PRADESH",
      cityName: "INDORE",
      propertyType: "HOUSE",
      deedType: "SALE DEED",
      outputLanguage: "HINDI",
      sellers: [{ name: "", details: "" }],
      buyers: [{ name: "", details: "" }],
      propertyAddress: "",
      plotArea: "",
      plotAreaUnit: "Sq. Ft.",
      floorsList: [{ floorName: "GROUND FLOOR", builtUpArea: "", areaUnit: "Sq. Ft.", constructionType: "RCC Frame Structure" }],
      parentDocument: "",
      considerationAmount: "",
      installments: [],
      bayanaAmount: "",
      remainingAmount: "",
      paymentPeriod: "3 माह",
      bankName: "",
      loanAmount: "",
      boundaryEast: "",
      boundaryWest: "",
      boundaryNorth: "",
      boundarySouth: "",
    };
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);
  const [userProfileState, setUserProfileState] = useState<string>("MADHYA PRADESH");
  const [userFullName, setUserFullName] = useState<string>("Client"); 
  const [userRole, setUserRole] = useState<string>("user"); 
  
  const [generatedDocHtml, setGeneratedDocHtml] = useState<string | null>(null);
  const [currentRefNo, setCurrentRefNo] = useState<string>("");

  /* ============================================================
     ✅ NEW: STATE-WISE PRICING DISPLAY (from pricing_config)
     ============================================================ */
  const [pricingDisplay, setPricingDisplay] = useState<{
    mrp: number;
    price: number;
    discountEnabled: boolean;
    discountPercent: number;
    savings: number;
    isFromDB: boolean;
  }>({
    mrp: 0,
    price: 0,
    discountEnabled: false,
    discountPercent: 0,
    savings: 0,
    isFromDB: false,
  });
  const [pricingLoading, setPricingLoading] = useState(true);

  /* ============================================================
     ✅ NEW useEffect: Fetch pricing from pricing_config based on state
     ============================================================ */
  useEffect(() => {
    let alive = true;

    const loadPricing = async () => {
      setPricingLoading(true);
      const targetState = userProfileState || formData.stateName;
      
      try {
        const row = await fetchPricingRow("drafting", targetState);
        const display = getDisplayPricing(row);

        if (!alive) return;

        if (display.isFromDB && display.price > 0) {
          // ✅ DB se aayi value
          setPricingDisplay({
            mrp: display.mrp,
            price: display.price,
            discountEnabled: display.discountEnabled,
            discountPercent: display.discountPercent,
            savings: display.savings,
            isFromDB: true,
          });
          console.log(`💰 [DB PRICING] ${targetState} × drafting = ₹${display.price}`);
        } else {
          // ✅ Fallback: hardcoded pricing.ts
          const fallbackPrice = getItemRate(targetState, "drafting");
          setPricingDisplay({
            mrp: fallbackPrice,
            price: fallbackPrice,
            discountEnabled: false,
            discountPercent: 0,
            savings: 0,
            isFromDB: false,
          });
          console.log(`⚠️ [FALLBACK PRICING] ${targetState} × drafting = ₹${fallbackPrice}`);
        }
      } catch (err) {
        console.error("[PRICING FETCH ERROR]", err);
        if (!alive) return;
        const fallbackPrice = getItemRate(targetState, "drafting");
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

    return () => {
      alive = false;
    };
  }, [userProfileState, formData.stateName]);

  /* ============================================================
     ✅ EFFECT 1: Restore saved draft data (from dashboard reopen)
     ============================================================ */
  useEffect(() => {
    const savedDraft = localStorage.getItem("deedDraftData");
    if (savedDraft) {
      try {
        const parsedData = JSON.parse(savedDraft);
        
        if (parsedData.created_at || parsedData.updated_at) {
          const recordDate = new Date(parsedData.created_at || parsedData.updated_at);
          const currentDate = new Date();
          const diffTime = Math.abs(currentDate.getTime() - recordDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > 60 && userRole !== 'admin') {
            alert("This draft is older than 60 days and has been locked as per system policy.");
            localStorage.removeItem("deedDraftData");
            return;
          }
        }

        setFormData((prev) => ({
          ...prev,
          ...parsedData,
        }));

        if (parsedData.ref_no || parsedData.refNo) {
          setCurrentRefNo(parsedData.ref_no || parsedData.refNo);
        }

        localStorage.removeItem("deedDraftData");
      } catch (e) {
        console.error("Error parsing saved deed draft data:", e);
      }
    }
  }, [userRole]);

  /* ============================================================
     ✅ EFFECT 2: Restore form data after payment cancel/fail
     ============================================================ */
  useEffect(() => {
    const formBackup = localStorage.getItem("deedDraftFormBackup");
    if (formBackup) {
      try {
        const parsed = JSON.parse(formBackup);
        
        const backupAge = Date.now() - (parsed.__backupTime || 0);
        if (backupAge < 10 * 60 * 1000) {
          const { __backupTime, ...cleanData } = parsed;
          setFormData((prev) => ({ ...prev, ...cleanData }));
          console.log("✅ Form data restored from backup after payment cancel");
        }
        
        localStorage.removeItem("deedDraftFormBackup");
      } catch (e) {
        console.error("Error restoring form backup:", e);
      }
    }
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('state, full_name, role')
            .eq('id', user.id)
            .single();

          if (profile) {
            if (profile.state) {
              setUserProfileState(profile.state);
              setFormData((prev) => ({ ...prev, stateName: profile.state }));
            }
            if (profile.full_name) {
              setUserFullName(profile.full_name);
            }
            if (profile.role) {
              setUserRole(profile.role);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      }
    };

    fetchUserProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "cityName" ? value.toUpperCase() : value,
    }));
  };

  const handleClearForm = () => {
    if (window.confirm("Are you sure you want to clear all form fields?")) {
      localStorage.removeItem("deedDraftFormBackup");
      
      setFormData({
        caseType: "Deed Draft",
        feeMode: "Auto",
        feeAmount: 0,
        clientName: "",
        representativeName: "",
        stateName: userProfileState,
        cityName: "INDORE",
        propertyType: "HOUSE",
        deedType: "SALE DEED",
        outputLanguage: "HINDI",
        sellers: [{ name: "", details: "" }],
        buyers: [{ name: "", details: "" }],
        propertyAddress: "",
        plotArea: "",
        plotAreaUnit: "Sq. Ft.",
        floorsList: [{ floorName: "GROUND FLOOR", builtUpArea: "", areaUnit: "Sq. Ft.", constructionType: "RCC Frame Structure" }],
        parentDocument: "",
        considerationAmount: "",
        installments: [],
        bayanaAmount: "",
        remainingAmount: "",
        paymentPeriod: "3 माह",
        bankName: "",
        loanAmount: "",
        boundaryEast: "",
        boundaryWest: "",
        boundaryNorth: "",
        boundarySouth: "",
      });
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleDownloadFile = () => {
    if (!generatedDocHtml) return;
    
    const buyerNameClean = formData.buyers?.[0]?.name 
      ? formData.buyers[0].name.replace(/[^a-zA-Z0-9]/g, "_") 
      : "Buyer";
    
    const addressClean = formData.propertyAddress 
      ? formData.propertyAddress.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30) 
      : "Property";

    const fileName = `${formData.deedType.replace(/\s+/g, '_')}_${buyerNameClean}_${addressClean}.html`;

    const blob = new Blob([generatedDocHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ✅ REAL PDF FILE DOWNLOAD (payment ke baad draft modal se) — print dialog nahi, seedha .pdf file save hoti hai
  const handleDownloadRealPdf = async () => {
    if (!generatedDocHtml || isPdfDownloading) return;
    setIsPdfDownloading(true);

    const buyerNameClean = formData.buyers?.[0]?.name
      ? formData.buyers[0].name.replace(/[^a-zA-Z0-9]/g, "_")
      : "Buyer";
    const fileName = `${formData.deedType.replace(/\s+/g, "_")}_${buyerNameClean}_${currentRefNo || "Draft"}.pdf`;

    let iframe: HTMLIFrameElement | null = null;
    try {
      // @ts-ignore - html2pdf.js ke paas types nahi hote
      const html2pdfModule: any = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default || html2pdfModule;

      // Alag iframe me render karte hain taaki deed ki CSS (body::before watermark etc.) app page ko affect na kare
      iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:170mm;height:297mm;border:0;visibility:hidden;";
      document.body.appendChild(iframe);

      await new Promise<void>((resolve) => {
        iframe!.onload = () => resolve();
        iframe!.srcdoc = generatedDocHtml;
      });

      const idoc = iframe.contentDocument!;
      // CSS watermark PDF me kaam nahi karta, niche jsPDF se har page par lagayenge
      const st = idoc.createElement("style");
      st.textContent = "body::before{display:none !important;} body{padding:0 !important;margin:0 !important;}";
      idoc.head.appendChild(st);
      try { await (idoc as any).fonts?.ready; } catch {}
      await new Promise((r) => setTimeout(r, 300));

      await html2pdf()
        .set({
          margin: [20, 20, 20, 20], // mm (A4 @page margin jaisa)
          filename: fileName,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: iframe.clientWidth },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"], avoid: ["p", "tr", ".signature-section", ".boundaries-box", ".study-notice-footer"] },
        })
        .from(idoc.body)
        .toPdf()
        .get("pdf")
        .then((pdf: any) => {
          // Har page par halka "DRAFT" watermark (screen/print jaisa)
          try {
            const total = pdf.internal.getNumberOfPages();
            const w = pdf.internal.pageSize.getWidth();
            const h = pdf.internal.pageSize.getHeight();
            for (let i = 1; i <= total; i++) {
              pdf.setPage(i);
              pdf.saveGraphicsState();
              pdf.setGState(new pdf.GState({ opacity: 0.12 }));
              pdf.setTextColor(120, 120, 120);
              pdf.setFontSize(110);
              pdf.text("DRAFT", w / 2, h / 2, { angle: 45, align: "center" });
              pdf.restoreGraphicsState();
            }
          } catch (wmErr) {
            console.warn("Watermark skip:", wmErr);
          }
        })
        .save();
    } catch (err) {
      console.error("PDF download failed, falling back to print dialog:", err);
      alert("Direct PDF download me dikkat aayi. Print window khol rahe hain — wahan 'Save as PDF' select karein.");
      handleDownloadPdf();
    } finally {
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      setIsPdfDownloading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!generatedDocHtml) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(generatedDocHtml);
      printWindow.document.close();
      
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 500);
      };
    }
  };

  // ✅ Template poora HTML document (apni <style> ke saath) return karta hai. Use dobara <html> ke andar wrap karne se
  // do alag CSS (body margin 40px, 850px container, padding 40px) aapas me takrate the aur A4 me fit nahi baithta tha.
  // Isliye yahan sirf <body> ka content nikaal kar EK hi clean A4 stylesheet lagate hain.
  const extractDeedBody = (html: string): string => {
    const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    let body = m ? m[1] : html;
    body = body.replace(/<style[\s\S]*?<\/style>/gi, "");
    body = body.replace(/<div class="print-btn-container">[\s\S]*?<\/button>\s*<\/div>/i, "");
    return body;
  };

  const buildPrintableHtml = (refNo: string, currentFormData: DeedFormData) => {
    const rawHtml = generateDeedHtmlContent({ ...currentFormData, refNo });
    const deedBody = extractDeedBody(rawHtml);
    return `
      <!DOCTYPE html>
      <html lang="hi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${currentFormData.deedType} - ${currentFormData.buyers?.[0]?.name || 'Draft'}</title>
          <style>
            /* ---------- A4 PAGE SETUP ---------- */
            @page { size: A4 portrait; margin: 18mm 18mm 20mm 18mm; }
            *, *::before, *::after { box-sizing: border-box; }
            html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body {
              font-family: 'Mangal', 'Noto Sans Devanagari', 'Arial', sans-serif;
              font-size: 14px;
              line-height: 1.75;
              color: #111;
              margin: 0;
              padding: 0;
              background: #ffffff;
              width: 100%;
              position: relative;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            /* screen preview: page jaisa margin (print me @page margin lagta hai) */
            @media screen {
              body { padding: 18mm; }
            }
            @media screen and (max-width: 600px) {
              body { padding: 12px; }
            }
            body::before {
              content: "DRAFT";
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 110px;
              font-weight: 900;
              color: rgba(200, 200, 200, 0.22);
              z-index: -1000;
              pointer-events: none;
              letter-spacing: 15px;
              white-space: nowrap;
            }
            /* ---------- CONTENT ---------- */
            .deed-container { width: 100%; max-width: none; margin: 0; padding: 0; border: 0; box-shadow: none; background: transparent; }
            .deed-container > div { max-width: 100%; }
            p { margin: 0 0 10px 0; text-align: justify; orphans: 3; widows: 3; }
            img, table { max-width: 100%; }
            table { border-collapse: collapse; }
            td, th { overflow-wrap: anywhere; vertical-align: top; }
            .header-title { text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 20px; text-transform: uppercase; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; break-after: avoid; page-break-after: avoid; }
            .section-box { margin-bottom: 15px; text-align: justify; }
            .boundaries-box { background: #f8fafc; border: 0; box-shadow: inset 0 0 0 1px #cbd5e1; padding: 12px 15px; border-radius: 6px; margin: 15px 0; break-inside: avoid; page-break-inside: avoid; }
            .signature-section { margin-top: 40px; display: flex; justify-content: space-between; gap: 24px; break-inside: avoid; page-break-inside: avoid; }
            .sig-box { width: 47%; text-align: center; border-top: 1px dashed #333; padding-top: 10px; margin-top: 40px; }
            .study-notice-footer { background: #fef3c7; border: 1px dashed #d97706; color: #92400e; padding: 12px; font-size: 12px; text-align: center; margin-top: 30px; font-weight: bold; border-radius: 4px; break-inside: avoid; page-break-inside: avoid; }
            .print-btn-container, .deed-footer-meta { display: none !important; }
            @media print {
              body::before { position: absolute; }
            }
          </style>
        </head>
        <body>
          <div class="deed-container">
            ${deedBody}
          </div>
        </body>
      </html>
    `;
  };

  const fetchNextSequenceNumber = async (): Promise<number> => {
    try {
      const { data, error } = await supabase.rpc('get_next_deed_sequence');
      if (!error && data !== null) {
        return Number(data);
      }
    } catch (e) {
      console.error("Error fetching sequence from DB, fallback to timestamp:", e);
    }
    return Math.floor(Math.random() * 900) + 100;
  };

  const fetchDynamicFee = async (clientName: string, repName: string) => {
    if (!clientName) return 0;

    const targetColumn = "drafting_fee";
    const cleanCName = clientName?.split(/[.\s]+/)[0].trim();
    const cleanRName = repName?.split(/[.\s]+/)[0].trim();
    
    const { data, error } = await supabase
      .from("clients")
      .select(targetColumn)
      .ilike("client_name", `${cleanCName}%`) 
      .ilike("representative_name", `${cleanRName}%`)
      .maybeSingle();

    if (error) {
      console.error("Error fetching dynamic fee:", error);
      return 0;
    }

    return data ? Number(data[targetColumn] || 0) : 0; 
  };

  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const targetState = userProfileState || formData.stateName;

      let userServiceFeeAmount = 0;
      if (formData.feeMode === "Auto") {
        userServiceFeeAmount = await fetchDynamicFee(formData.clientName, formData.representativeName);
      } else {
        userServiceFeeAmount = Number((formData as any).feeAmount) || 0;
      }

      /* ✅ STATE-WISE DRAFTING FEE from pricing_config DB */
      let gatewayFeeAmount = 0;
      try {
        const row = await fetchPricingRow("drafting", targetState);
        const display = getDisplayPricing(row);
        if (display.isFromDB && display.price > 0) {
          gatewayFeeAmount = display.price;
          console.log(`💰 [DB PRICING] ${targetState} × drafting = ₹${gatewayFeeAmount}`);
        } else {
          gatewayFeeAmount = getItemRate(targetState, "drafting");
          console.log(`⚠️ [FALLBACK PRICING] ${targetState} × drafting = ₹${gatewayFeeAmount}`);
        }
      } catch (err) {
        console.error("[PRICING FETCH ERROR]", err);
        gatewayFeeAmount = getItemRate(targetState, "drafting");
      }

      console.log(`🎯 State: ${targetState} | Gateway Fee: ₹${gatewayFeeAmount}`);

      const { data: { user } } = await supabase.auth.getUser();

      /* ============ STEP 1: CHECK EXISTING PAID RECORD (REOPEN) ============ */
      if (user) {
        const currentSellerName = formData.sellers?.[0]?.name?.trim() || "";
        const currentBuyerName = formData.buyers?.[0]?.name?.trim() || "";
        const currentAddress = formData.propertyAddress?.trim() || "";

        let query = supabase
          .from('service_records')
          .select('*')
          .eq('payment_status', 'paid');

        if (userRole !== 'admin') {
          query = query.eq('user_id', user.id);
        }

        const { data: existingRecords, error: queryError } = await query;

        if (!queryError && existingRecords && existingRecords.length > 0) {
          const matchedRecord = existingRecords.find((record: any) => {
            if (userRole !== 'admin' && record.user_id !== user.id) return false;

            if (record.created_at) {
              const recordDate = new Date(record.created_at);
              const currentDate = new Date();
              const diffTime = Math.abs(currentDate.getTime() - recordDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays > 60 && userRole !== 'admin') return false; 
            }

            const snapshot = record.form_snapshot;
            if (!snapshot) return false;
            
            const savedSeller = snapshot.sellers?.[0]?.name?.trim() || "";
            const savedBuyer = snapshot.buyers?.[0]?.name?.trim() || "";
            const savedAddress = snapshot.propertyAddress?.trim() || "";

            return (
              savedSeller.toLowerCase() === currentSellerName.toLowerCase() &&
              savedBuyer.toLowerCase() === currentBuyerName.toLowerCase() &&
              savedAddress.toLowerCase() === currentAddress.toLowerCase()
            );
          });

          if (matchedRecord) {
            try {
              const parsedPlotArea = formData.plotArea && !isNaN(Number(formData.plotArea)) 
                ? parseFloat(formData.plotArea) 
                : null;

              await supabase
                .from('service_records')
                .update({
                  client_name: formData.clientName || "Valued Client",
                  representative: formData.representativeName,
                  state_name: userProfileState || formData.stateName,
                  city_district: formData.cityName,
                  property_type: formData.propertyType,
                  deed_type: formData.deedType,
                  output_language: formData.outputLanguage,
                  plot_area: parsedPlotArea,
                  property_address: formData.propertyAddress,
                  fee_standard: userServiceFeeAmount,
                  user_service_fee: userServiceFeeAmount,
                  user_payment: userServiceFeeAmount,
                  gateway_fee: gatewayFeeAmount,
                  fee_mode: formData.feeMode,
                  boundary_east: formData.boundaryEast,
                  boundary_west: formData.boundaryWest,
                  boundary_north: formData.boundaryNorth,
                  boundary_south: formData.boundarySouth,
                  form_snapshot: { ...formData, refNo: matchedRecord.ref_no },
                  updated_at: new Date().toISOString(),
                })
                .eq('ref_no', matchedRecord.ref_no);

              await supabase
                .from('mis_records')
                .update({
                  customer_name: formData.buyers?.[0]?.name || "Customer",
                  client_name: formData.clientName || "Valued Client",
                  representative: formData.representativeName || "Self",
                  fee_standard: userServiceFeeAmount,
                  property_address: formData.propertyAddress,
                  plot_area: parsedPlotArea,
                  property_type: formData.propertyType || 'HOUSE',
                })
                .eq('ref_no', matchedRecord.ref_no);

              console.log(`✅ Updated record for ref ${matchedRecord.ref_no}`);
            } catch (err) {
              console.error("❌ Failed to update existing record:", err);
            }

            setCurrentRefNo(matchedRecord.ref_no);
            const printableHtml = buildPrintableHtml(matchedRecord.ref_no, formData);
            setGeneratedDocHtml(printableHtml);
            setIsGenerating(false);
            return;
          }
        }
      }

      /* ============ STEP 2: ADMIN BYPASS FLOW ============ */
      if (userRole === 'admin') {
        try {
          const nextSeq = await fetchNextSequenceNumber();
          const userFirstName = userFullName 
            ? userFullName.trim().split(" ")[0].replace(/[^a-zA-Z]/g, "") 
            : "Client";
          const adminRefNo = generateReferenceNumber(userFirstName, nextSeq);
          setCurrentRefNo(adminRefNo);

          const adminFormDataWithRef = { ...formData, refNo: adminRefNo };
          const adminPrintableHtml = buildPrintableHtml(adminRefNo, formData);
          setGeneratedDocHtml(adminPrintableHtml);

          if (user) {
            const parsedPlotArea = formData.plotArea && !isNaN(Number(formData.plotArea)) 
              ? parseFloat(formData.plotArea) 
              : null;

            await supabase.from('service_records').insert([
              {
                ref_no: adminRefNo,
                user_id: user.id,
                case_type: 'DEED_DRAFT',
                payment_status: 'paid',
                platform_payment_status: 'admin_bypass',
                user_payment: userServiceFeeAmount,
                gateway_fee: gatewayFeeAmount,
                user_service_fee: userServiceFeeAmount,
                fee_mode: formData.feeMode,
                razorpay_order_id: 'ADMIN_BYPASS',
                razorpay_payment_id: 'ADMIN_FREE',
                client_name: formData.clientName || "Valued Client",
                representative: formData.representativeName,
                state_name: targetState,
                city_district: formData.cityName,
                property_type: formData.propertyType,
                deed_type: formData.deedType,
                output_language: formData.outputLanguage,
                plot_area: parsedPlotArea,
                property_address: formData.propertyAddress,
                fee_standard: userServiceFeeAmount,
                boundary_east: formData.boundaryEast,
                boundary_west: formData.boundaryWest,
                boundary_north: formData.boundaryNorth,
                boundary_south: formData.boundarySouth,
                form_snapshot: adminFormDataWithRef,
              }
            ]);

            await supabase.from('mis_records').insert([
              {
                ref_no: adminRefNo,
                user_id: user.id,
                customer_name: formData.buyers?.[0]?.name || "Customer",
                client_name: formData.clientName || "Valued Client",
                representative: formData.representativeName || "Self",
                case_type: 'DEED_DRAFT',
                fee_standard: userServiceFeeAmount,
                status: 'PENDING',
                property_address: formData.propertyAddress,
                plot_area: parsedPlotArea,
                property_type: formData.propertyType || 'HOUSE',
              }
            ]);
          }
        } catch (dbErr) {
          console.error("Database error during admin draft save:", dbErr);
        }

        setIsGenerating(false);
        return;
      }

      /* ============ STEP 3: RAZORPAY PAYMENT FLOW (NON-ADMIN) ============ */
      const res = await loadRazorpayScript();
      if (!res) {
        alert("Razorpay SDK failed to load. Please check your internet connection.");
        setIsGenerating(false);
        return;
      }

      try {
        localStorage.setItem(
          "deedDraftFormBackup",
          JSON.stringify({ ...formData, __backupTime: Date.now() })
        );
        console.log("💾 Form backup saved before Razorpay");
      } catch (e) {
        console.error("Failed to backup form data:", e);
      }

      const options: any = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_YourKeyHelp",
        amount: Math.round(gatewayFeeAmount * 100),
        currency: "INR",
        name: "Legal Drafting Portal",
        description: `Drafting Fee for ${targetState} — ₹${gatewayFeeAmount}`,

        handler: async function (response: any) {
          try {
            localStorage.removeItem("deedDraftFormBackup");

            const nextSeq = await fetchNextSequenceNumber();
            const userFirstName = userFullName 
              ? userFullName.trim().split(" ")[0].replace(/[^a-zA-Z]/g, "") 
              : "Client";
            const newUniqueRefNo = generateReferenceNumber(userFirstName, nextSeq);
            const newFormDataWithRef = { ...formData, refNo: newUniqueRefNo };

            setCurrentRefNo(newUniqueRefNo);

            const newPrintableHtml = buildPrintableHtml(newUniqueRefNo, formData);
            setGeneratedDocHtml(newPrintableHtml);

            alert(`✅ Payment Successful!\nPayment ID: ${response.razorpay_payment_id}\nRef No: ${newUniqueRefNo}`);

            const { data: { user: currentUser } } = await supabase.auth.getUser();
            
            if (currentUser) {
              const parsedPlotArea = formData.plotArea && !isNaN(Number(formData.plotArea)) 
                ? parseFloat(formData.plotArea) 
                : null;

              await supabase.from('service_records').insert([
                {
                  ref_no: newUniqueRefNo,
                  user_id: currentUser.id,
                  case_type: 'DEED_DRAFT',
                  payment_status: 'paid',
                  platform_payment_status: 'paid',
                  user_payment: userServiceFeeAmount,
                  gateway_fee: gatewayFeeAmount,
                  user_service_fee: userServiceFeeAmount,
                  fee_mode: formData.feeMode,
                  razorpay_order_id: response.razorpay_order_id || 'DIRECT_PAY',
                  razorpay_payment_id: response.razorpay_payment_id,
                  client_name: formData.clientName || "Valued Client",
                  representative: formData.representativeName,
                  state_name: targetState,
                  city_district: formData.cityName,
                  property_type: formData.propertyType,
                  deed_type: formData.deedType,
                  output_language: formData.outputLanguage,
                  plot_area: parsedPlotArea,
                  property_address: formData.propertyAddress,
                  fee_standard: userServiceFeeAmount,
                  boundary_east: formData.boundaryEast,
                  boundary_west: formData.boundaryWest,
                  boundary_north: formData.boundaryNorth,
                  boundary_south: formData.boundarySouth,
                  form_snapshot: newFormDataWithRef,
                }
              ]);

              await supabase.from('mis_records').insert([
                {
                  ref_no: newUniqueRefNo,
                  user_id: currentUser.id,
                  customer_name: formData.buyers?.[0]?.name || "Customer",
                  client_name: formData.clientName || "Valued Client",
                  representative: formData.representativeName || "Self",
                  case_type: 'DEED_DRAFT',
                  fee_standard: userServiceFeeAmount,
                  status: 'PENDING',
                  property_address: formData.propertyAddress,
                  plot_area: parsedPlotArea,
                  property_type: formData.propertyType || 'HOUSE',
                }
              ]);

              console.log(`✅ Payment success! Ref: ${newUniqueRefNo}`);
            }
          } catch (dbErr) {
            console.error("Database error during draft save:", dbErr);
            alert("Payment ho gayi lekin record save nahi hua. Please contact support.");
          }
          
          setIsGenerating(false);
        },

        modal: {
          ondismiss: function () {
            console.log("❌ Payment cancelled by user");
            setIsGenerating(false);
            alert("❌ Payment cancel kar diya gaya.\n✅ Aapka form data safe hai — aap dobara try kar sakte hain.");
          }
        },

        prefill: {
          name: formData.clientName || "Valued Client",
          email: "",
          contact: "",
        },
        theme: {
          color: "#1e3a8a",
        },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
      
      paymentObject.on('payment.failed', function (response: any) {
        console.error("❌ Payment failed:", response.error);
        setIsGenerating(false);
        alert(`❌ Payment failed: ${response.error.description || 'Unknown error'}\n✅ Aapka form data safe hai — aap dobara try kar sakte hain.`);
      });

    } catch (err) {
      console.error("Draft generation error:", err);
      alert("Error processing payment or generating draft.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-3 sm:p-4 md:p-6 bg-white rounded-2xl shadow-xl border border-gray-100 my-4 sm:my-6 relative">
      
      <div className="mb-4 sm:mb-6 border-b pb-4">
        <h1 className="text-lg sm:text-xl md:text-2xl font-black text-blue-900 uppercase tracking-tight">
          ADVANCED LEGAL DRAFTING PORTAL {userRole === 'admin' && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded ml-2">Admin Mode</span>}
        </h1>
        <p className="text-xs text-gray-500 mt-1 font-semibold">
          Multi-State, Multi-Deed & Dynamic Mobile-Friendly Workflow (Profile State: <span className="text-blue-600 font-bold">{userProfileState}</span>)
        </p>
        {currentRefNo && (
          <div className="mt-2 inline-block bg-blue-100 text-blue-900 px-3 py-1 rounded text-xs font-mono font-bold">
            Loaded Ref No: {currentRefNo}
          </div>
        )}

        {/* ✅ STATE-WISE PRICING DISPLAY */}
        {userRole !== 'admin' && (
          <div className="mt-3 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border-2 border-dashed border-amber-400 rounded-xl p-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-red-600 text-white text-[11px] px-2.5 py-1 rounded shadow uppercase tracking-wider animate-pulse font-extrabold">
                ⚡ LIMITED TIME OFFER
              </span>
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase">
                  Professional Legal Drafting Service
                </h4>
                <p className="text-[10px] text-slate-600 font-medium">
                  State: <span className="font-bold text-blue-700">{userProfileState}</span> | Instant PDF + Digital Seal
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
                        <span className="text-[11px] text-gray-400 line-through font-semibold">
                          ₹ {pricingDisplay.mrp}/-
                        </span>
                        <span className="bg-green-100 text-green-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {pricingDisplay.discountPercent}% OFF
                        </span>
                      </div>
                    )}
                    <div className="text-lg font-black text-emerald-600 leading-tight">
                      ₹ {pricingDisplay.price || 0}
                      <span className="text-xs font-bold text-slate-700 ml-1">Only</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleGenerateDraft} className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4 sm:gap-6">
          <div className="col-span-1">
            <Section1CaseInfo 
              formData={formData} 
              handleChange={handleChange} 
              setFormData={setFormData} 
            />
          </div>
          <div className="col-span-1">
            <Section2Parties formData={formData} setFormData={setFormData} />
          </div>
          <div className="col-span-1">
            <Section3PropertyDetails formData={formData} setFormData={setFormData} handleChange={handleChange} />
          </div>
          <div className="col-span-1">
            <Section4TransactionDocs formData={formData} setFormData={setFormData} handleChange={handleChange} />
          </div>
        </div>
        
        <Section5Actions 
  isGenerating={isGenerating} 
  onDashboardClick={() => router.push("/dashboard")} 
  onClearForm={handleClearForm}
  isAdmin={userRole === 'admin'}
/>
      </form>

      {generatedDocHtml && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center items-center p-2 sm:p-6">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            
            <div className="bg-blue-900 text-white px-6 py-4 flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-lg font-bold">Draft Available</h2>
                <p className="text-xs text-blue-200">Ref No: {currentRefNo}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadRealPdf}
                  disabled={isPdfDownloading}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition flex items-center gap-2 cursor-pointer"
                >
                  {isPdfDownloading ? "⏳ PDF ban rahi hai..." : "📥 Download PDF"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition flex items-center gap-2 cursor-pointer"
                >
                  🖨️ Print
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition flex items-center gap-2 cursor-pointer"
                >
                  💾 Download HTML
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedDocHtml(null);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-bold text-sm transition cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-200 p-2 sm:p-6 overflow-y-auto flex justify-center">
              {/* Deed ka HTML iframe me dikhate hain: A4 (210mm) width, print/PDF jaisa hi layout, aur deed ki CSS app me leak nahi hoti */}
              <iframe
                title="Deed Preview"
                srcDoc={generatedDocHtml}
                onLoad={(e) => {
                  const f = e.currentTarget;
                  const fit = () => {
                    const h = f.contentDocument?.documentElement?.scrollHeight;
                    if (h) f.style.height = h + "px";
                  };
                  fit();
                  setTimeout(fit, 300);
                }}
                className="bg-white border-0 shrink-0 mx-auto"
                style={{
                  width: "210mm",
                  maxWidth: "100%",
                  minHeight: "297mm",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                }}
              />
            </div>

          </div>
        </div>
      )}

    </div>
  );
}