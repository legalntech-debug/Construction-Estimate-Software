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

interface DeedFormLayoutProps {
  initialData?: any;
}

/**
 * Generates a dynamic reference number for deeds (Starting with D for Draft).
 */
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
  const [userProfileState, setUserProfileState] = useState<string>("MADHYA PRADESH");
  const [userFullName, setUserFullName] = useState<string>("Client"); 
  const [userRole, setUserRole] = useState<string>("user"); 
  
  const [generatedDocHtml, setGeneratedDocHtml] = useState<string | null>(null);
  const [currentRefNo, setCurrentRefNo] = useState<string>("");

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
      setFormData({
        caseType: "Deed Draft",
        feeMode: "Auto",
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

  const buildPrintableHtml = (refNo: string, currentFormData: DeedFormData) => {
    const rawHtml = generateDeedHtmlContent({ ...currentFormData, refNo });
    return `
      <!DOCTYPE html>
      <html lang="hi">
        <head>
          <meta charset="UTF-8">
          <title>${currentFormData.deedType} - ${currentFormData.buyers?.[0]?.name || 'Draft'}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body {
              font-family: 'Mangal', 'Arial', sans-serif;
              font-size: 14px;
              line-height: 1.8;
              color: #111;
              margin: 0;
              padding: 0;
              background: #ffffff;
              position: relative;
            }
            body::before {
              content: "DRAFT";
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 120px;
              font-weight: 900;
              color: rgba(200, 200, 200, 0.22);
              z-index: -1000;
              pointer-events: none;
              letter-spacing: 20px;
            }
            .deed-container { max-width: 100%; margin: 0 auto; padding: 0; background: transparent; }
            .header-title { text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 20px; text-transform: uppercase; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
            .section-box { margin-bottom: 15px; text-align: justify; }
            .boundaries-box { background: #f8fafc !important; border: 1px solid #cbd5e1; padding: 15px; border-radius: 6px; margin: 15px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .signature-section { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .sig-box { width: 45%; text-align: center; border-top: 1px dashed #333; padding-top: 10px; margin-top: 40px; }
            .study-notice-footer { background: #fef3c7 !important; border: 1px dashed #d97706; color: #92400e; padding: 12px; font-size: 12px; text-align: center; margin-top: 30px; font-weight: bold; border-radius: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-btn-container, .deed-footer-meta { display: none; }
            @media print {
              .print-btn-container { display: none !important; }
              body::before { position: absolute; }
            }
          </style>
        </head>
        <body>
          <div class="deed-container">
            ${rawHtml}
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

    const targetColumn = "deed_fee"; 
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

      // FIXED FEE LOGIC: No 500 fallback, strictly uses fetched dynamic fee or 0
      let userServiceFeeAmount = 0;
      if (formData.feeMode === "Auto") {
        userServiceFeeAmount = await fetchDynamicFee(formData.clientName, formData.representativeName);
      } else {
        userServiceFeeAmount = Number((formData as any).manualFeeAmount) || 0;
      }

      const gatewayFeeAmount = 50; 

      const { data: { user } } = await supabase.auth.getUser();

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
            setCurrentRefNo(matchedRecord.ref_no);
            const printableHtml = buildPrintableHtml(matchedRecord.ref_no, formData);
            setGeneratedDocHtml(printableHtml);
            setIsGenerating(false);
            return;
          }
        }
      }

      const nextSeq = await fetchNextSequenceNumber();
      const userFirstName = userFullName ? userFullName.trim().split(" ")[0].replace(/[^a-zA-Z]/g, "") : "Client";
      const uniqueRefNo = generateReferenceNumber(userFirstName, nextSeq);
      setCurrentRefNo(uniqueRefNo);

      const formDataWithRef = { ...formData, refNo: uniqueRefNo };
      const printableHtml = buildPrintableHtml(uniqueRefNo, formData);
      setGeneratedDocHtml(printableHtml);

      // ADMIN BYPASS FLOW
      if (userRole === 'admin') {
        try {
          if (user) {
            const parsedPlotArea = formData.plotArea && !isNaN(Number(formData.plotArea)) 
              ? parseFloat(formData.plotArea) 
              : null;

            await supabase.from('service_records').insert([
              {
                ref_no: uniqueRefNo,
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
                form_snapshot: formDataWithRef,
              }
            ]);

            await supabase.from('mis_records').insert([
              {
                ref_no: uniqueRefNo,
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

      // RAZORPAY PAYMENT FLOW
      const res = await loadRazorpayScript();
      if (!res) {
        alert("Razorpay SDK failed to load. Please check your internet connection.");
        setIsGenerating(false);
        return;
      }

      const options: any = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_YourKeyHelp",
        amount: gatewayFeeAmount * 100, 
        currency: "INR",
        name: "Legal Drafting Portal",
        description: `Drafting Fee for ${targetState}`,
        handler: async function (response: any) {
          alert(`Payment Successful! Payment ID: ${response.razorpay_payment_id}`);

          try {
            if (user) {
              const parsedPlotArea = formData.plotArea && !isNaN(Number(formData.plotArea)) 
                ? parseFloat(formData.plotArea) 
                : null;

              await supabase.from('service_records').insert([
                {
                  ref_no: uniqueRefNo,
                  user_id: user.id,
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
                  form_snapshot: formDataWithRef,
                }
              ]);

              await supabase.from('mis_records').insert([
                {
                  ref_no: uniqueRefNo,
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
            console.error("Database error during draft save:", dbErr);
          }
          
          setIsGenerating(false);
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
        alert(`Payment failed: ${response.error.description}`);
        setIsGenerating(false);
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
      </div>

      <form onSubmit={handleGenerateDraft} className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4 sm:gap-6">
          <div className="col-span-1">
            <Section1CaseInfo formData={formData} handleChange={handleChange} />
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
                  onClick={handleDownloadPdf}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition flex items-center gap-2 cursor-pointer"
                >
                  📥 Direct Download PDF
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

            <div className="flex-1 bg-gray-200 p-4 sm:p-8 overflow-y-auto flex justify-center relative">
              <div 
                className="bg-white shadow-2xl w-full max-w-[210mm] min-h-[297mm] p-[20mm] box-border text-black relative mx-auto my-auto"
                style={{
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                }}
              >
                <div 
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-45deg)',
                    fontSize: '110px',
                    fontWeight: '900',
                    color: 'rgba(200, 200, 200, 0.25)',
                    zIndex: 10,
                    pointerEvents: 'none',
                    letterSpacing: '15px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  DRAFT
                </div>

                <div 
                  className="relative z-0"
                  dangerouslySetInnerHTML={{ __html: generatedDocHtml }}
                />
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}