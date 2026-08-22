'use client';

import React from "react";
import { ALL_INDIA_STATES, getDistrictsByState } from "../../utils/stateJurisdictions";

interface Section1Props {
  formData: any;
  handleChange: (e: any) => void;
}

export default function Section1CaseInfo({ formData, handleChange }: Section1Props) {
  const districts = getDistrictsByState(formData.stateName);

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-4">
      <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider">
        SECTION 1: Case & General Information
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">CASE TYPE</label>
          <input type="text" name="caseType" value={formData.caseType} readOnly className="w-full p-2 border rounded text-sm bg-gray-100 font-bold" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">FEE MODE</label>
          <select name="feeMode" value={formData.feeMode} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-white font-bold">
            <option value="Auto">Auto Calculation</option>
            <option value="Manual">Manual Entry</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">CLIENT NAME *</label>
          <input type="text" name="clientName" required placeholder="Enter Client Name" value={formData.clientName} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-white uppercase font-semibold" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">REPRESENTATIVE NAME</label>
          <input type="text" name="representativeName" placeholder="Advocate / Rep Name" value={formData.representativeName} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-white uppercase" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">STATE (ALL INDIA)</label>
          <select name="stateName" value={formData.stateName} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-white font-semibold">
            {ALL_INDIA_STATES.map((st) => (
              <option key={st.code} value={st.name}>{st.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">CITY / DISTRICT *</label>
          <input type="text" name="cityName" required placeholder="Enter City" value={formData.cityName} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-white uppercase font-semibold" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">PROPERTY TYPE</label>
          <select name="propertyType" value={formData.propertyType} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-white font-semibold">
            <option value="PLOT">Plot (भूखंड)</option>
            <option value="HOUSE">House (मकान)</option>
            <option value="FLAT">Flat (फ्लैट)</option>
            <option value="COMMERCIAL">Commercial Shop</option>
            <option value="AGRICULTURAL">Agricultural Land</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">DEED TYPE</label>
          <select name="deedType" value={formData.deedType} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-blue-900 text-white font-bold">
            <option value="SALE DEED">Sale Deed (विक्रय-पत्र)</option>
            <option value="SALE AGREEMENT">Sale Agreement (विक्रय अनुबंध)</option>
            <option value="CO_OWNERSHIP">Co-Ownership Deed</option>
            <option value="EQUITABLE MORTGAGE">Equitable Mortgage (MODT)</option>
            <option value="RELEASE DEED">Release Deed (RM / हकत्याग)</option>
            <option value="GIFT DEED">Gift Deed (दान-पत्र)</option>
          </select>
        </div>
<div>
  <label className="block text-[11px] font-bold text-gray-700 mb-1">LANGUAGE</label>
  <select name="outputLanguage" value={formData.outputLanguage} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-white font-bold text-blue-700">
    <option value="HINDI">Hindi (हिंदी)</option>
    <option value="ENGLISH">English</option>
    <option value="MARATHI">Marathi (मराठी)</option>
    <option value="GUJARATI">Gujarati (ગુજરાતી)</option>
  </select>
</div>      </div>
    </div>
  );
}