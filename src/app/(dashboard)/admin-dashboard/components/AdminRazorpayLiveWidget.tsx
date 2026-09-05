'use client';

import { useState, useMemo } from 'react';
import RazorpayTableWithFilter from '@/app/components/RazorpayTableWithFilter';

interface AdminRazorpayLiveWidgetProps {
  transactions: any[];
  estimates?: any[];
  serviceRecords?: any[];
}

export default function AdminRazorpayLiveWidget({ 
  transactions = [], 
  estimates = [], 
  serviceRecords = [] 
}: AdminRazorpayLiveWidgetProps) {
  const [isHidden, setIsHidden] = useState(false);

  const formattedTransactions = useMemo(() => {
    return transactions.map((item) => {
      // 1. Check direct properties
      let resolvedCaseType = item.case_type || item.caseType || item.estimate_type;

      if (!resolvedCaseType || resolvedCaseType === 'N/A') {
        // 2. Check in estimates table
        const matchingEstimate = estimates.find(
          (est) => 
            est.id === item.reference_id || 
            est.order_id === item.order_id ||
            est.payment_id === item.payment_id ||
            est.ref_no === item.reference_no ||
            est.ref_no === item.ref_no
        );

        // 3. Check in service records table
        const matchingService = serviceRecords.find(
          (srv) => 
            srv.id === item.reference_id || 
            srv.order_id === item.order_id ||
            srv.payment_id === item.payment_id ||
            srv.ref_no === item.reference_no ||
            srv.ref_no === item.ref_no
        );

        if (matchingEstimate) {
          resolvedCaseType = matchingEstimate.estimate_type || matchingEstimate.case_type;
        } else if (matchingService) {
          resolvedCaseType = matchingService.case_type || matchingService.deed_type;
        }

        // 4. Force fallback using Reference No string patterns if still N/A
        if (!resolvedCaseType || resolvedCaseType === 'N/A') {
          const refString = (item.ref_no || item.reference_no || item.referenceId || '').toUpperCase();
          if (refString.includes('LNT')) {
            resolvedCaseType = 'Construction Estimate';
          } else if (refString.includes('FY') || refString.includes('D0')) {
            resolvedCaseType = 'Valuation Assessment';
          } else {
            resolvedCaseType = 'General Estimate';
          }
        }
      }

      return {
        ...item,
        case_type: resolvedCaseType,
        caseType: resolvedCaseType,
      };
    });
  }, [transactions, estimates, serviceRecords]);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-base">Payment Gateway & Dispute Operations</h3>
          <span className="text-xs text-slate-400">Razorpay Live API Hook</span>
        </div>
        <button 
          onClick={() => setIsHidden(!isHidden)}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
        >
          {isHidden ? 'Show [+]' : 'Hide [-]'}
        </button>
      </div>
      {!isHidden && (
        <RazorpayTableWithFilter transactions={formattedTransactions} />
      )}
    </div>
  );
}