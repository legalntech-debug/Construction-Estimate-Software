'use client';

import React from "react";
import SaleAgreementFields from "../dynamic-inputs/SaleAgreementFields";
import MortgageFields from "../dynamic-inputs/MortgageFields";

interface Section4Props {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  handleChange: (e: any) => void;
}

export default function Section4TransactionDocs({ formData, setFormData, handleChange }: Section4Props) {
  
  const addInstallment = () => {
    setFormData((prev: any) => ({
      ...prev,
      installments: [...(prev.installments || []), { amount: "", amountWords: "", mode: "RTGS / NEFT", date: "" }]
    }));
  };

  const removeInstallment = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      installments: prev.installments.filter((_: any, i: number) => i !== index)
    }));
  };

  return (
    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-4">
      <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider">
        SECTION 4: TRANSACTION & PARENT DOCUMENT DETAILS
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">PARENT DOCUMENT DETAILS</label>
          <input 
            type="text" 
            name="parentDocument" 
            placeholder="e.g. Reg. No / Date / Title History" 
            value={formData.parentDocument} 
            onChange={handleChange} 
            className="w-full p-2 border rounded text-sm bg-white" 
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">TOTAL CONSIDERATION / AGREEMENT AMOUNT (₹) *</label>
          <input 
            type="text" 
            name="considerationAmount" 
            required
            placeholder="e.g. 15,00,000" 
            value={formData.considerationAmount} 
            onChange={handleChange} 
            className="w-full p-2 border rounded text-sm bg-white font-bold text-blue-900" 
          />
        </div>
      </div>

      {/* ================= PAYMENT INSTALLMENTS WITH DROPDOWN ================= */}
      <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm space-y-3 mt-3">
        <div className="flex justify-between items-center border-b pb-2">
          <div>
            <h3 className="text-xs font-bold text-blue-900 uppercase">Payment Breakdown / Installments (भुगतान का विवरण)</h3>
            <p className="text-[10px] text-gray-500">Select payment mode and enter breakdown details</p>
          </div>
          <button 
            type="button" 
            onClick={addInstallment} 
            className="text-[11px] bg-blue-700 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-800 transition"
          >
            + Add Payment Row
          </button>
        </div>

        {(!formData.installments || formData.installments.length === 0) && (
          <p className="text-xs text-gray-400 italic text-center py-2">No installment rows added yet. Click "+ Add Payment Row" to add.</p>
        )}

        {formData.installments?.map((inst: any, index: number) => (
          <div key={index} className="space-y-2 bg-slate-50 p-3 rounded-lg border relative">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-gray-600 uppercase">Payment Installment #{index + 1}</span>
              <button type="button" onClick={() => removeInstallment(index)} className="text-red-600 font-bold text-xs hover:text-red-800">
                ✕ Remove
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1">AMOUNT (₹)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 2,00,000" 
                  value={inst.amount} 
                  onChange={(e) => {
                    const updated = [...formData.installments];
                    updated[index].amount = e.target.value;
                    setFormData((prev: any) => ({ ...prev, installments: updated }));
                  }} 
                  className="w-full p-2 border rounded text-sm bg-white font-semibold" 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-gray-600 mb-1">AMOUNT IN WORDS (शब्दों में)</label>
                <input 
                  type="text" 
                  placeholder="e.g. दो लाख रुपये मात्र / Two Lakh Rupees Only" 
                  value={inst.amountWords} 
                  onChange={(e) => {
                    const updated = [...formData.installments];
                    updated[index].amountWords = e.target.value;
                    setFormData((prev: any) => ({ ...prev, installments: updated }));
                  }} 
                  className="w-full p-2 border rounded text-sm bg-white font-medium" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
              {/* Payment Mode Dropdown */}
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1">PAYMENT MODE</label>
                <select 
                  value={inst.mode} 
                  onChange={(e) => {
                    const updated = [...formData.installments];
                    updated[index].mode = e.target.value;
                    setFormData((prev: any) => ({ ...prev, installments: updated }));
                  }} 
                  className="w-full p-2 border rounded text-xs bg-white font-semibold text-blue-900"
                >
                  <option value="RTGS / NEFT">RTGS / NEFT / Bank Transfer</option>
                  <option value="CHEQUE">Cheque (चैक द्वारा)</option>
                  <option value="CASH">Cash (नकद)</option>
                  <option value="UPI / ONLINE">UPI / Online / Google Pay / PhonePe</option>
                  <option value="BANK LOAN">Bank Loan Disbursement</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-1">DATE / REFERENCE DETAILS (Ref No / Cheque No)</label>
                <input 
                  type="text" 
                  placeholder="e.g. UTR No / Cheque No & Dated" 
                  value={inst.date} 
                  onChange={(e) => {
                    const updated = [...formData.installments];
                    updated[index].date = e.target.value;
                    setFormData((prev: any) => ({ ...prev, installments: updated }));
                  }} 
                  className="w-full p-2 border rounded text-xs bg-white" 
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Conditional Dynamic Inputs based on Deed Type */}
      {formData.deedType === "SALE AGREEMENT" && (
        <SaleAgreementFields formData={formData} handleChange={handleChange} />
      )}

      {formData.deedType === "EQUITABLE MORTGAGE" && (
        <MortgageFields formData={formData} handleChange={handleChange} />
      )}
    </div>
  );
}