'use client';

import React from "react";

interface Section5Props {
  isGenerating: boolean;
  onDashboardClick: () => void;
  onClearForm: () => void;
}

export default function Section5Actions({ isGenerating, onDashboardClick, onClearForm }: Section5Props) {
  return (
    <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
      
      {/* Dashboard Button */}
      <button 
        type="button" 
        onClick={onDashboardClick}
        className="w-full sm:w-auto px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition shadow-sm uppercase tracking-wider"
      >
        ← Back to Dashboard
      </button>

      {/* Action Buttons Group */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        
        {/* Clear Form Button */}
        <button 
          type="button" 
          onClick={onClearForm}
          className="px-4 py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs rounded-xl transition border border-rose-200 flex items-center gap-1 uppercase tracking-wider"
        >
          🗑️ Clear Form
        </button>

        {/* Generate Draft / Print Button */}
        <button 
          type="submit" 
          disabled={isGenerating}
          className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          {isGenerating ? "Generating Draft..." : "Pay & Print / Generate Draft 🖨️"}
        </button>

      </div>

    </div>
  );
}