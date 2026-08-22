'use client';

import React from "react";

interface MortgageFieldsProps {
  formData: any;
  handleChange: (e: any) => void;
}

export default function MortgageFields({ formData, handleChange }: MortgageFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-blue-200 mt-3">
      <div>
        <label className="block text-[11px] font-bold text-blue-900 mb-1">BANK / FINANCIAL INSTITUTION NAME</label>
        <input 
          type="text" 
          name="bankName" 
          placeholder="e.g. State Bank of India" 
          value={formData.bankName || ""} 
          onChange={handleChange} 
          className="w-full p-2 border rounded text-sm bg-white font-bold" 
        />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-blue-900 mb-1">SANCTIONED LOAN AMOUNT (₹)</label>
        <input 
          type="text" 
          name="loanAmount" 
          placeholder="e.g. 25,00,000" 
          value={formData.loanAmount || ""} 
          onChange={handleChange} 
          className="w-full p-2 border rounded text-sm bg-white font-bold" 
        />
      </div>
    </div>
  );
}