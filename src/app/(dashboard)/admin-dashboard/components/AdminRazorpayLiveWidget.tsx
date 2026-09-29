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
      /* ---------- 1. CASE TYPE RESOLUTION ---------- */
      let resolvedCaseType = item.case_type || item.caseType || item.estimate_type;

      if (!resolvedCaseType || resolvedCaseType === 'N/A') {
        const matchingEstimate = estimates.find(
          (est) => 
            est.id === item.reference_id || 
            est.order_id === item.order_id ||
            est.payment_id === item.payment_id ||
            est.ref_no === item.reference_no ||
            est.ref_no === item.ref_no
        );

        const matchingService = serviceRecords.find(
          (srv) => 
            srv.id === item.reference_id || 
            srv.order_id === item.order_id ||
            srv.payment_id === item.payment_id ||
            srv.ref_no === item.reference_no ||
            srv.ref_no === item.ref_no ||
            srv.razorpay_payment_id === item.razorpay_payment_id
        );

        if (matchingEstimate) {
          resolvedCaseType = matchingEstimate.estimate_type || matchingEstimate.case_type;
        } else if (matchingService) {
          resolvedCaseType = matchingService.case_type || matchingService.deed_type;
        }

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

      /* ---------- 2. ✅ DETECT SERVICE RECORD ---------- */
      // Priority 1: source_table tag (from RPC)
      // Priority 2: gateway_fee > 0 && user_payment = 0 (fallback)
      // Priority 3: match against serviceRecords array
      const isServiceRecord =
        item.source_table === 'service_records' ||
        item.record_category === 'SERVICE' ||
        (Number(item.gateway_fee || 0) > 0 && Number(item.user_payment || 0) === 0) ||
        serviceRecords.some(
          (srv) =>
            srv.ref_no === item.reference_no ||
            srv.ref_no === item.ref_no ||
            srv.id === item.reference_id ||
            srv.payment_id === item.payment_id ||
            (srv.razorpay_payment_id && srv.razorpay_payment_id === item.razorpay_payment_id)
        );

      /* ---------- 3. ✅ AMOUNT RESOLUTION ---------- */
      let resolvedAmount = 0;

      if (isServiceRecord) {
        // ✅ Service records: gateway_fee FIRST (ye actual charge hai)
        const candidates = [
          item.gateway_fee,
          item.user_service_fee,
          item.user_payment,
          item.fee_standard,
          item.amount,        // RPC ka resolved amount fallback
        ];
        for (const c of candidates) {
          const n = Number(c);
          if (!isNaN(n) && n > 0) {
            resolvedAmount = n;
            break;
          }
        }
      } else {
        // Estimates: user_payment first
        const candidates = [
          item.user_payment,
          item.amount,
          item.total_amount,
        ];
        for (const c of candidates) {
          const n = Number(c);
          if (!isNaN(n) && n > 0) {
            resolvedAmount = n;
            break;
          }
        }
      }

      /* ---------- 4. CUSTOMER NAME FALLBACK ---------- */
      let resolvedCustomerName = item.customer_name || item.client_name || 'N/A';
      if ((!item.customer_name || item.customer_name === 'N/A') && item.form_snapshot) {
        try {
          const snapshot = typeof item.form_snapshot === 'string'
            ? JSON.parse(item.form_snapshot)
            : item.form_snapshot;
          if (snapshot?.buyers && Array.isArray(snapshot.buyers) && snapshot.buyers.length > 0) {
            resolvedCustomerName = snapshot.buyers[0]?.name || resolvedCustomerName;
          }
        } catch (e) {}
      }

      /* ---------- 5. FINAL RETURN ---------- */
      return {
        ...item,
        case_type: resolvedCaseType,
        caseType: resolvedCaseType,
        amount: resolvedAmount,                    // ✅ final resolved amount
        resolved_amount: resolvedAmount,           // ✅ explicit resolved key
        is_service_record: isServiceRecord,        // ✅ debug/UI hint
        // Preserve raw values for table fallback
        gateway_fee: Number(item.gateway_fee || 0),
        user_service_fee: Number(item.user_service_fee || 0),
        user_payment: Number(item.user_payment || 0),
        fee_standard: Number(item.fee_standard || 0),
        source_table: item.source_table || (isServiceRecord ? 'service_records' : 'estimates'),
        customer_name: resolvedCustomerName,
        client_name: item.client_name || resolvedCustomerName,
        reference_no: item.reference_no || item.ref_no || item.razorpay_payment_id || item.id || 'N/A',
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