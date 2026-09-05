'use client';

import React, { useState, useEffect } from "react";
import DeedFormLayout from "./components/DeedFormLayout";

export default function DeedDraftingPage() {
  const [reopenedData, setReopenedData] = useState<any>(null);
  const [currentRefNo, setCurrentRefNo] = useState<string>("");

  useEffect(() => {
    const savedDraft = localStorage.getItem("deedDraftData");
    if (savedDraft) {
      try {
        const parsedData = JSON.parse(savedDraft);
        setReopenedData(parsedData);

        if (parsedData.ref_no || parsedData.refNo) {
          setCurrentRefNo(parsedData.ref_no || parsedData.refNo);
        }
      } catch (e) {
        console.error("Error parsing saved deed draft data:", e);
      }
    }
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 py-4 sm:py-6 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              DEED DRAFTING PORTAL
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Multi-state automated drafting, dynamic templates, and instant print preview.
            </p>
          </div>
          {currentRefNo && (
            <div className="bg-blue-900 text-white px-3 py-1.5 rounded-lg text-xs font-mono font-bold shadow-sm self-start sm:self-auto">
              Ref No: {currentRefNo}
            </div>
          )}
        </div>

        {/* Main 5-Section Dynamic Form Engine with mobile overflow safety */}
        <div className="w-full overflow-x-hidden">
          <DeedFormLayout initialData={reopenedData} />
        </div>
      </div>
    </main>
  );
}