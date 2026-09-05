'use client';

import React from 'react';
import DashboardChart from '@/app/(dashboard)/admin-dashboard/components/DashboardChart';

interface AdminMisFinancialWidgetProps {
  monthlyCases: any[];
  stateCases: any[];
  fyData: any[];
  records: any[];
  hiddenSections: { [key: string]: boolean };
  toggleSection: (key: string) => void;
}

export default function AdminMisFinancialWidget({
  monthlyCases,
  stateCases,
  fyData,
  records,
  hiddenSections,
  toggleSection,
}: AdminMisFinancialWidgetProps) {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800 text-base">MIS & Financial Telemetry Metrics</h3>
        <button 
          onClick={() => toggleSection('mis')}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
        >
          {hiddenSections.mis ? 'Show [+]' : 'Hide [-]'}
        </button>
      </div>

      {!hiddenSections.mis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Month-wise Cases */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
              <span>Cases (Month-wise)</span>
              <span className="text-xs text-slate-400 font-normal">Aggregated metrics</span>
            </h3>
            <div className="space-y-2">
              {monthlyCases?.map((item: any) => (
                <div key={item.month_name} className="flex justify-between items-center py-2.5 border-b border-slate-200/50 text-sm">
                  <span className="text-slate-600 font-medium">{item.month_name}</span>
                  <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded-xl text-xs border">{item.case_count} Cases</span>
                </div>
              ))}
            </div>
          </div>

          {/* State-wise Cases */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
              <span>Cases (State-wise)</span>
              <span className="text-xs text-slate-400 font-normal">Geographic spread</span>
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {stateCases && stateCases.length > 0 ? (
                stateCases.map((item: any, idx: number) => {
                  const stateName = item.state_name || 'Not Specified';
                  const caseCount = item.case_count ?? 0;

                  return (
                    <div key={idx} className="flex justify-between items-center py-2.5 border-b border-slate-200/50 text-sm">
                      <span className="text-slate-600 font-medium">{stateName}</span>
                      <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded-xl text-xs border">
                        {caseCount} {caseCount === 1 ? 'Case' : 'Cases'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex justify-between items-center py-2.5 border-b border-slate-200/50 text-sm">
                  <span className="text-slate-600 font-medium">Not Specified</span>
                  <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded-xl text-xs border">0 Cases</span>
                </div>
              )}
            </div>
          </div>

          {/* Revenue FY-wise */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
              <span>Revenue (FY-wise)</span>
              <span className="text-xs text-slate-400 font-normal">Fiscal telemetry</span>
            </h3>
            <div className="space-y-2">
              {fyData?.map((item: any) => (
                <div key={item.fy_label} className="flex justify-between items-center py-2.5 border-b border-slate-200/50 text-sm">
                  <span className="text-slate-600 font-medium">FY {item.fy_label}</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl text-xs border border-emerald-100">₹ {Number(item.revenue).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Revenue Trend Line */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4">Revenue Trend Line</h3>
            <DashboardChart data={records || []} />
          </div>
        </div>
      )}
    </div>
  );
}