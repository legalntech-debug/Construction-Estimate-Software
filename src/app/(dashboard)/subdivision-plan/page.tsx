"use client";

import React from "react";
import SubdivisionLayout from "./SubdivisionLayout";

export default function SubdivisionPlanPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto bg-white text-black font-sans uppercase">
      <div className="bg-slate-900 text-white p-3 text-center font-black text-2xl mb-6 tracking-wide shadow">
        SUBDIVISION PLAN
      </div>
      <SubdivisionLayout />
    </div>
  );
}
