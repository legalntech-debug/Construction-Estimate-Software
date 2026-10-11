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
  serviceRecords = [],
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

      /* ---------- 2. DETECT SERVICE RECORD ---------- */
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

      /* ---------- 3. AMOUNT RESOLUTION ---------- */
      let resolvedAmount = 0;

      if (isServiceRecord) {
        const candidates = [
          item.gateway_fee,
          item.user_service_fee,
          item.user_payment,
          item.fee_standard,
          item.amount,
        ];
        for (const c of candidates) {
          const n = Number(c);
          if (!isNaN(n) && n > 0) {
            resolvedAmount = n;
            break;
          }
        }
      } else {
        const candidates = [item.user_payment, item.amount, item.total_amount];
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
          const snapshot =
            typeof item.form_snapshot === 'string'
              ? JSON.parse(item.form_snapshot)
              : item.form_snapshot;
          if (snapshot?.buyers && Array.isArray(snapshot.buyers) && snapshot.buyers.length > 0) {
            resolvedCustomerName = snapshot.buyers[0]?.name || resolvedCustomerName;
          }
        } catch (e) {}
      }

      /* ---------- 5. NORMALIZED PAYMENT STATUS ---------- */
      const rawStatus = String(
        item.platform_payment_status || item.payment_status || item.status || ''
      )
        .toLowerCase()
        .trim();

      const normalizedStatus =
        rawStatus === 'paid' || rawStatus === 'success' || rawStatus === 'captured'
          ? 'paid'
          : rawStatus === 'failed' || rawStatus === 'cancelled'
          ? 'failed'
          : 'pending';

      /* ---------- 6. FINAL RETURN ---------- */
      return {
        ...item,
        case_type: resolvedCaseType,
        caseType: resolvedCaseType,
        amount: resolvedAmount,
        resolved_amount: resolvedAmount,
        is_service_record: isServiceRecord,
        gateway_fee: Number(item.gateway_fee || 0),
        user_service_fee: Number(item.user_service_fee || 0),
        user_payment: Number(item.user_payment || 0),
        fee_standard: Number(item.fee_standard || 0),
        source_table: item.source_table || (isServiceRecord ? 'service_records' : 'estimates'),
        customer_name: resolvedCustomerName,
        client_name: item.client_name || resolvedCustomerName,
        reference_no:
          item.ref_no || item.reference_no || item.razorpay_payment_id || item.id || 'N/A',
        // ✅ Normalized status for counters
        _normalizedStatus: normalizedStatus,
      };
    });
  }, [transactions, estimates, serviceRecords]);

  // ═══════════════════════════════════════════════════════════════
  // ✅ KPI computations — DYNAMIC (using _normalizedStatus)
  // ═══════════════════════════════════════════════════════════════
  const totalRevenue = useMemo(
    () =>
      formattedTransactions.reduce(
        (sum, t) => sum + Number(t.resolved_amount || t.amount || 0),
        0
      ),
    [formattedTransactions]
  );

  const paidCount = useMemo(
    () => formattedTransactions.filter((t) => t._normalizedStatus === 'paid').length,
    [formattedTransactions]
  );

  const pendingCount = useMemo(
    () => formattedTransactions.filter((t) => t._normalizedStatus === 'pending').length,
    [formattedTransactions]
  );

  const failedCount = useMemo(
    () => formattedTransactions.filter((t) => t._normalizedStatus === 'failed').length,
    [formattedTransactions]
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* SMART CORPORATE HEADER                                          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 sm:px-5 py-3 border-b border-slate-700 shrink-0">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          {/* LEFT */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-lg bg-blue-500/40 blur-md" />
              <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
                  />
                </svg>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-sm sm:text-base tracking-tight leading-tight">
                  Payment Gateway & Dispute Operations
                </h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  Live
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                Razorpay · Real-time gateway collections & settlement
              </p>
            </div>
          </div>

          {/* RIGHT — KPI Chips */}
          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-md px-2.5 py-1 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Revenue
              </span>
              <span className="text-[12px] font-black text-emerald-400 tabular-nums">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-md px-2.5 py-1 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Total Txn
              </span>
              <span className="text-[12px] font-black text-white tabular-nums">
                {formattedTransactions.length}
              </span>
            </div>

            {/* ✅ Paid — dynamic */}
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2.5 py-1 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400 tabular-nums">
                {paidCount}
              </span>
              <span className="text-[9px] font-semibold text-emerald-500/80 uppercase tracking-wider">
                Paid
              </span>
            </div>

            {/* ✅ Pending — dynamic */}
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-1 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[10px] font-bold text-amber-400 tabular-nums">
                {pendingCount}
              </span>
              <span className="text-[9px] font-semibold text-amber-500/80 uppercase tracking-wider">
                Pending
              </span>
            </div>

            {/* ✅ Failed — sirf dikhao agar > 0 ho */}
            {failedCount > 0 && (
              <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 rounded-md px-2.5 py-1 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span className="text-[10px] font-bold text-rose-400 tabular-nums">
                  {failedCount}
                </span>
                <span className="text-[9px] font-semibold text-rose-500/80 uppercase tracking-wider">
                  Failed
                </span>
              </div>
            )}

            <button
              onClick={() => setIsHidden(!isHidden)}
              className="ml-auto lg:ml-0 px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-md text-[10px] font-bold transition whitespace-nowrap backdrop-blur-sm"
            >
              {isHidden ? 'Show [+]' : 'Hide [−]'}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TABLE                                                            */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {!isHidden && (
        <div
          className="w-full"
          style={{
            height: 'calc(100vh - 180px)',
            minHeight: '420px',
          }}
        >
          <div className="h-full w-full overflow-y-auto overflow-x-auto">
            <RazorpayTableWithFilter transactions={formattedTransactions} />
          </div>
        </div>
      )}
    </div>
  );
}