'use client';

import React from "react";

interface SaleAgreementFieldsProps {
  formData: any;
  handleChange: (e: any) => void;
}

export default function SaleAgreementFields({ formData, handleChange }: SaleAgreementFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-blue-200 mt-3">
      <div>
        <label className="block text-[11px] font-bold text-blue-900 mb-1">BAYANA / ADVANCE AMOUNT (₹)</label>
        <input 
          type="text" 
          name="bayanaAmount" 
          placeholder="e.g. 2,00,000" 
          value={formData.bayanaAmount || ""} 
          onChange={handleChange} 
          className="w-full p-2 border rounded text-sm bg-white font-bold" 
        />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-blue-900 mb-1">REMAINING AMOUNT (₹)</label>
        <input 
          type="text" 
          name="remainingAmount" 
          placeholder="e.g. 13,00,000" 
          value={formData.remainingAmount || ""} 
          onChange={handleChange} 
          className="w-full p-2 border rounded text-sm bg-white font-bold" 
        />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-blue-900 mb-1">PAYMENT PERIOD</label>
        <input 
          type="text" 
          name="paymentPeriod" 
          placeholder="e.g. 3 माह" 
          value={formData.paymentPeriod || "3 माह"} 
          onChange={handleChange} 
          className="w-full p-2 border rounded text-sm bg-white font-bold" 
        />
      </div>
    </div>
  );
}