'use client';

import React from "react";

interface Section2Props {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

export default function Section2Parties({ formData, setFormData }: Section2Props) {
  const lang = formData.outputLanguage || "HINDI";

  // Localization labels based on selected language
  let labels = {
    title: "SECTION 2: PARTIES DETAILS (पक्षकार विवरण)",
    sellerTitle: "1st Box: First Party / Seller Details (प्रथम पक्ष / विक्रेता)",
    buyerTitle: "2nd Box: Second Party / Buyer Details (द्वितीय पक्ष / क्रेता)",
    addSeller: "+ Add Seller",
    addBuyer: "+ Add Buyer",
    namePlaceholder: "पूरा नाम दर्ज करें (Full Name)",
    detailsPlaceholder: "पिता/पति का नाम एवं पूर्ण पता (KYC & Address)",
    sellerBadge: "विक्रेता / प्रथम पक्ष",
    buyerBadge: "क्रेता / द्वितीय पक्ष",
  };

  if (lang === "MARATHI" || lang === "मराठी") {
    labels = {
      title: "SECTION 2: पक्ष तपशील (Parties Details)",
      sellerTitle: "पहिले बॉक्स: पहिले पक्ष / विक्रेता तपशील",
      buyerTitle: "दुसरे बॉक्स: दुसरे पक्ष / खरेदीदार तपशील",
      addSeller: "+ विक्रेता जोडा",
      addBuyer: "+ खरेदीदार जोडा",
      namePlaceholder: "पूर्ण नाव प्रविष्ट करा",
      detailsPlaceholder: "वडिलांचे/पतीचे नाव आणि पूर्ण पत्ता",
      sellerBadge: "विक्रेता / पहिले पक्ष",
      buyerBadge: "खरेदीदार / दुसरे पक्ष",
    };
  } else if (lang === "GUJARATI" || lang === "ગુજરાતી") {
    labels = {
      title: "SECTION 2: પક્ષકારોની વિગતો",
      sellerTitle: "પ્રથમ બોક્સ: પ્રથમ પક્ષ / વેચાણકર્તાની વિગતો",
      buyerTitle: "બીજું બોક્સ: બીજા પક્ષ / ખરીદનારની વિગતો",
      addSeller: "+ વેચાણકર્તા ઉમેરો",
      addBuyer: "+ ખરીદનાર ઉમેરો",
      namePlaceholder: "પૂરું નામ દાખલ કરો",
      detailsPlaceholder: "પિતા/પતિનું નામ અને પૂરું સરનામું",
      sellerBadge: "વેચાણકર્તા / પ્રથમ પક્ષ",
      buyerBadge: "ખરીદનાર / બીજો પક્ષ",
    };
  } else if (lang === "ENGLISH") {
    labels = {
      title: "SECTION 2: Parties Details",
      sellerTitle: "Box 1: First Party / Seller Details",
      buyerTitle: "Box 2: Second Party / Buyer Details",
      addSeller: "+ Add Seller",
      addBuyer: "+ Add Buyer",
      namePlaceholder: "Enter Full Name",
      detailsPlaceholder: "Father's/Husband's Name & Complete Address",
      sellerBadge: "Seller / First Party",
      buyerBadge: "Buyer / Second Party",
    };
  }

  // Handlers for Sellers
  const addSeller = () => {
    setFormData((prev: any) => ({
      ...prev,
      sellers: [...prev.sellers, { name: "", details: "" }]
    }));
  };

  const removeSeller = (index: number) => {
    if (formData.sellers.length === 1) return;
    setFormData((prev: any) => ({
      ...prev,
      sellers: prev.sellers.filter((_: any, i: number) => i !== index)
    }));
  };

  // Handlers for Buyers
  const addBuyer = () => {
    setFormData((prev: any) => ({
      ...prev,
      buyers: [...prev.buyers, { name: "", details: "" }]
    }));
  };

  const removeBuyer = (index: number) => {
    if (formData.buyers.length === 1) return;
    setFormData((prev: any) => ({
      ...prev,
      buyers: prev.buyers.filter((_: any, i: number) => i !== index)
    }));
  };

  return (
    <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-4">
      <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider">
        {labels.title}
      </h2>

      {/* Stacked 1-column layout optimized for mobile and desktop clarity */}
      <div className="grid grid-cols-1 gap-4">
        
        {/* ================= BOX 1: FIRST PARTY / SELLER ================= */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-blue-100 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-xs font-bold text-blue-900 uppercase">{labels.sellerTitle}</h3>
            <button 
              type="button" 
              onClick={addSeller} 
              className="text-[11px] bg-blue-700 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-800 transition"
            >
              {labels.addSeller}
            </button>
          </div>

          {formData.sellers.map((seller: any, index: number) => (
            <div key={index} className="space-y-2 bg-slate-50 p-3 rounded-lg border">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase">{labels.sellerBadge} #{index + 1}</span>
                {formData.sellers.length > 1 && (
                  <button type="button" onClick={() => removeSeller(index)} className="text-red-600 font-bold text-xs hover:text-red-800">
                    ✕ Remove
                  </button>
                )}
              </div>
              
              {/* Name field converted to resizable textarea for multi-name support */}
              <textarea 
                placeholder={labels.namePlaceholder} 
                value={seller.name} 
                onChange={(e) => {
                  const updated = [...formData.sellers];
                  updated[index].name = e.target.value;
                  setFormData((prev: any) => ({ ...prev, sellers: updated }));
                }} 
                className="w-full p-2 border rounded text-xs sm:text-sm bg-white font-semibold uppercase resize-y min-h-[42px]" 
                rows={1}
                required 
              />
              
              {/* Details field with vertical resize enabled */}
              <textarea 
                placeholder={labels.detailsPlaceholder} 
                value={seller.details} 
                onChange={(e) => {
                  const updated = [...formData.sellers];
                  updated[index].details = e.target.value;
                  setFormData((prev: any) => ({ ...prev, sellers: updated }));
                }} 
                className="w-full p-2 border rounded text-xs sm:text-sm bg-white resize-y min-h-[64px] uppercase" 
                rows={2}
              />
            </div>
          ))}
        </div>

        {/* ================= BOX 2: SECOND PARTY / BUYER ================= */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-emerald-100 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-xs font-bold text-emerald-900 uppercase">{labels.buyerTitle}</h3>
            <button 
              type="button" 
              onClick={addBuyer} 
              className="text-[11px] bg-emerald-700 text-white px-3 py-1.5 rounded font-bold hover:bg-emerald-800 transition"
            >
              {labels.addBuyer}
            </button>
          </div>

          {formData.buyers.map((buyer: any, index: number) => (
            <div key={index} className="space-y-2 bg-slate-50 p-3 rounded-lg border">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase">{labels.buyerBadge} #{index + 1}</span>
                {formData.buyers.length > 1 && (
                  <button type="button" onClick={() => removeBuyer(index)} className="text-red-600 font-bold text-xs hover:text-red-800">
                    ✕ Remove
                  </button>
                )}
              </div>

              {/* Name field converted to resizable textarea for multi-name support */}
              <textarea 
                placeholder={labels.namePlaceholder} 
                value={buyer.name} 
                onChange={(e) => {
                  const updated = [...formData.buyers];
                  updated[index].name = e.target.value;
                  setFormData((prev: any) => ({ ...prev, buyers: updated }));
                }} 
                className="w-full p-2 border rounded text-xs sm:text-sm bg-white font-semibold uppercase resize-y min-h-[42px]" 
                rows={1}
                required 
              />

              {/* Details field with vertical resize enabled */}
              <textarea 
                placeholder={labels.detailsPlaceholder} 
                value={buyer.details} 
                onChange={(e) => {
                  const updated = [...formData.buyers];
                  updated[index].details = e.target.value;
                  setFormData((prev: any) => ({ ...prev, buyers: updated }));
                }} 
                className="w-full p-2 border rounded text-xs sm:text-sm bg-white resize-y min-h-[64px] uppercase" 
                rows={2}
              />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}