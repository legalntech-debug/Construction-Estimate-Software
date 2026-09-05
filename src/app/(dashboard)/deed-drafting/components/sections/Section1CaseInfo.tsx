'use client';

import React, { useState, useEffect } from "react";
import { ALL_INDIA_STATES, getDistrictsByState } from "../../utils/stateJurisdictions";
import { supabase } from "@/lib/supabase";

interface Section1Props {
  formData: any;
  handleChange: (e: any) => void;
  setFormData?: any;
}

export default function Section1CaseInfo({ formData, handleChange, setFormData }: Section1Props) {
  const [clients, setClients] = useState<any[]>([]);
  const [filteredReps, setFilteredReps] = useState<string[]>([]);
  const [allRepresentatives, setAllRepresentatives] = useState<string[]>([]);

  // Fetch clients and representatives from Supabase just like in EstimatePage
  useEffect(() => {
    const fetchClientsData = async () => {
      const { data: clientsTable, error } = await supabase
        .from('clients')
        .select('client_name, representative_name');
      
      if (error) {
        console.error("Error fetching clients:", error);
        return;
      }

      const combined = clientsTable || [];
      setClients(combined);

      const representatives = combined
        .map((c) => c.representative_name)
        .filter((name): name is string => typeof name === 'string' && name.trim() !== "");

      const uniqueReps = Array.from(new Set(representatives)) as string[];
      setAllRepresentatives(uniqueReps);
      setFilteredReps(uniqueReps);
    };
    fetchClientsData();
  }, []);

  const handleClientNameSelect = (name: string) => {
    // Mimic parent change or direct form update if setFormData is available
    const event = {
      target: { name: "clientName", value: name }
    };
    handleChange(event);

    const matches: string[] = clients
      .filter((c: any) => c.client_name === name && c.representative_name)
      .map((c: any) => c.representative_name as string);

      if (matches.length > 0) {
        const uniqueReps = Array.from(new Set(matches)) as string[];
        setFilteredReps(uniqueReps);
        if (uniqueReps.length === 1 && setFormData) {
          setFormData((prev: any) => ({ ...prev, representativeName: uniqueReps[0] }));
        }
      } else {
        setFilteredReps(allRepresentatives);
      }
  };

  return (
    <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-4">
      <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider">
        SECTION 1: Case & General Information
      </h2>
      
      {/* Mobile 2 columns, Desktop 4 columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <div>
          <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 mb-1">CASE TYPE</label>
          <input type="text" name="caseType" value={formData.caseType} readOnly className="w-full p-2 border rounded text-xs sm:text-sm bg-gray-100 font-bold" />
        </div>
        
        <div>
          <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 mb-1">FEE MODE</label>
          <select name="feeMode" value={formData.feeMode} onChange={handleChange} className="w-full p-2 border rounded text-xs sm:text-sm bg-white font-bold">
            <option value="Auto">Auto Calculation</option>
            <option value="Manual">Manual Entry</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 mb-1">CLIENT NAME *</label>
          <input 
            type="text" 
            list="section-clients-list"
            name="clientName" 
            required 
            placeholder="SEARCH CLIENT..." 
            value={formData.clientName} 
            onChange={(e) => handleClientNameSelect(e.target.value)} 
            className="w-full p-2 border rounded text-xs sm:text-sm bg-white uppercase font-semibold" 
          />
          <datalist id="section-clients-list">
            {[...new Set(clients.map(c => c.client_name))].map((name, i) => (
              <option key={i} value={name} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 mb-1">REPRESENTATIVE NAME</label>
          <input 
            type="text" 
            list="section-reps-list"
            name="representativeName" 
            placeholder="SEARCH REP..." 
            value={formData.representativeName} 
            onChange={handleChange} 
            className="w-full p-2 border rounded text-xs sm:text-sm bg-white uppercase" 
          />
          <datalist id="section-reps-list">
            {filteredReps.map((rep, i) => (
              <option key={i} value={rep} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Mobile 2 columns, Desktop 5 columns */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 pt-2">
        <div>
          <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 mb-1">STATE (ALL INDIA)</label>
          <select name="stateName" value={formData.stateName} onChange={handleChange} className="w-full p-2 border rounded text-xs sm:text-sm bg-white font-semibold">
            {ALL_INDIA_STATES.map((st) => (
              <option key={st.code} value={st.name}>{st.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 mb-1">CITY / DISTRICT *</label>
          <input type="text" name="cityName" required placeholder="Enter City" value={formData.cityName} onChange={handleChange} className="w-full p-2 border rounded text-xs sm:text-sm bg-white uppercase font-semibold" />
        </div>
        <div>
          <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 mb-1">PROPERTY TYPE</label>
          <select name="propertyType" value={formData.propertyType} onChange={handleChange} className="w-full p-2 border rounded text-xs sm:text-sm bg-white font-semibold">
            <option value="PLOT">Plot (भूखंड)</option>
            <option value="HOUSE">House (मकान)</option>
            <option value="FLAT">Flat (फ्लैट)</option>
            <option value="COMMERCIAL">Commercial Shop</option>
            <option value="AGRICULTURAL">Agricultural Land</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 mb-1">DEED TYPE</label>
          <select name="deedType" value={formData.deedType} onChange={handleChange} className="w-full p-2 border rounded text-xs sm:text-sm bg-blue-900 text-white font-bold">
            <option value="SALE DEED">Sale Deed (विक्रय-पत्र)</option>
            <option value="SALE AGREEMENT">Sale Agreement (विक्रय अनुबंध)</option>
            <option value="CO_OWNERSHIP">Co-Ownership Deed</option>
            <option value="EQUITABLE MORTGAGE">Equitable Mortgage (MODT)</option>
            <option value="RELEASE DEED">Release Deed (RM / हकत्याग)</option>
            <option value="GIFT DEED">Gift Deed (दान-पत्र)</option>
          </select>
        </div>
        <div className="col-span-2 md:col-span-1">
          <label className="block text-[10px] sm:text-[11px] font-bold text-gray-700 mb-1">LANGUAGE</label>
          <select name="outputLanguage" value={formData.outputLanguage} onChange={handleChange} className="w-full p-2 border rounded text-xs sm:text-sm bg-white font-bold text-blue-700">
            <option value="HINDI">Hindi (हिंदी)</option>
            <option value="ENGLISH">English</option>
            <option value="MARATHI">Marathi (मराठी)</option>
            <option value="GUJARATI">Gujarati (ગુજરાતી)</option>
          </select>
        </div>
      </div>
    </div>
  );
}