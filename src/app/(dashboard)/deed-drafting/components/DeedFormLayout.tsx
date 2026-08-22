'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Section1CaseInfo from "./sections/Section1CaseInfo";
import Section2Parties from "./sections/Section2Parties";
import Section3PropertyDetails from "./sections/Section3PropertyDetails";
import Section4TransactionDocs from "./sections/Section4TransactionDocs";
import Section5Actions from "./sections/Section5Actions";
import { DeedFormData } from "../types/deed";
import { generateDeedHtmlContent } from "../utils/deedTemplates";

export default function DeedFormLayout() {
  const router = useRouter();

  const [formData, setFormData] = useState<DeedFormData>({
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
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "cityName" ? value.toUpperCase() : value,
    }));
  };

  // Clear Form Handler
  const handleClearForm = () => {
    if (window.confirm("Are you sure you want to clear all form fields?")) {
      setFormData({
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
      });
    }
  };

  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const finalHtml = generateDeedHtmlContent(formData);

      const newWindow = window.open("", "_blank", "width=950,height=800");
      if (newWindow) {
        newWindow.document.write(finalHtml);
        newWindow.document.close();
      }
    } catch (err) {
      console.error("Draft generation error:", err);
      alert("Error generating draft.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-3 sm:p-4 md:p-6 bg-white rounded-2xl shadow-xl border border-gray-100 my-4 sm:my-6">
      
      <div className="mb-4 sm:mb-6 border-b pb-4">
        <h1 className="text-lg sm:text-xl md:text-2xl font-black text-blue-900 uppercase tracking-tight">
          ADVANCED LEGAL DRAFTING PORTAL
        </h1>
        <p className="text-xs text-gray-500 mt-1 font-semibold">
          Multi-State, Multi-Deed & Dynamic Mobile-Friendly Workflow
        </p>
      </div>

      <form onSubmit={handleGenerateDraft} className="space-y-4 sm:space-y-6">
        <Section1CaseInfo formData={formData} handleChange={handleChange} />
        <Section2Parties formData={formData} setFormData={setFormData} />
        <Section3PropertyDetails formData={formData} setFormData={setFormData} handleChange={handleChange} />
        <Section4TransactionDocs formData={formData} setFormData={setFormData} handleChange={handleChange} />
        
        {/* Pass onClearForm prop here */}
        <Section5Actions 
          isGenerating={isGenerating} 
          onDashboardClick={() => router.push("/dashboard")} 
          onClearForm={handleClearForm}
        />
      </form>

    </div>
  );
}