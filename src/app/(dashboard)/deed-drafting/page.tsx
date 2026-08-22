'use client';

import React from "react";
import DeedFormLayout from "./components/DeedFormLayout";

export default function DeedDraftingPage() {
  return (
    <main className="min-h-screen bg-slate-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Deed Drafting & Registration Portal
          </h1>
          <p className="text-sm text-slate-600">
            Multi-state automated legal drafting, dynamic templates, and instant print preview.
          </p>
        </div>

        {/* Main 5-Section Dynamic Form Engine */}
        <DeedFormLayout />
      </div>
    </main>
  );
}