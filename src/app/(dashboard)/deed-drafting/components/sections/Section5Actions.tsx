'use client';

import React from "react";

interface Section5Props {
  isGenerating: boolean;
  onDashboardClick: () => void;
  onClearForm: () => void;
  isAdmin?: boolean;             // 👈 Admin चेक के लिए
  hasGeneratedDoc?: boolean;     // 👈 ड्राफ्ट पहले से बन चूका है या नहीं
  onViewDoc?: () => void;        // 👈 बने हुए डॉक्यूमेंट को देखने/डाउनलोड करने का फंक्शन
}

export default function Section5Actions({ 
  isGenerating, 
  onDashboardClick, 
  onClearForm, 
  isAdmin, 
  hasGeneratedDoc, 
  onViewDoc 
}: Section5Props) {
  return (
    <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
      
      {/* Dashboard Button */}
      <button 
        type="button" 
        onClick={onDashboardClick}
        className="w-full sm:w-auto px-5 py-3 sm:py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition shadow-sm uppercase tracking-wider text-center cursor-pointer"
      >
        ← Back to Dashboard
      </button>

      {/* Action Buttons Group */}
      <div className="flex flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
        
        {/* Clear Form Button */}
        <button 
          type="button" 
          onClick={onClearForm}
          className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs rounded-xl transition border border-rose-200 flex items-center justify-center gap-1 uppercase tracking-wider cursor-pointer"
        >
          🗑️ Clear Form
        </button>

        {/* यदि डॉक्यूमेंट पहले से जेनरेट/पेड है, तो यहाँ डायरेक्ट डाउनलोड/व्यू बटन दिखेगा */}
        {hasGeneratedDoc && onViewDoc && (
          <button 
            type="button" 
            onClick={onViewDoc}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 uppercase tracking-wider text-center cursor-pointer animate-pulse"
          >
            📥 View / Download Draft 🖨️
          </button>
        )}

        {/* Generate Draft / Pay Button */}
        {!hasGeneratedDoc && (
          <button 
            type="submit" 
            disabled={isGenerating}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider text-center cursor-pointer"
          >
            {isGenerating 
              ? "Processing..." 
              : isAdmin 
                ? "Generate Free (Admin) 🖨️" 
                : "Pay & Print / Generate 🖨️"}
          </button>
        )}

      </div>

    </div>
  );
}