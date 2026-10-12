'use client';

import { useState, useMemo, useRef, useEffect } from 'react';

interface RazorpayTableWithFilterProps {
  transactions: any[];
}

type DatePreset = '' | 'today' | '7d' | '30d' | '90d' | 'month' | 'custom';

export default function RazorpayTableWithFilter({ transactions }: RazorpayTableWithFilterProps) {
  const [colFilters, setColFilters] = useState({
    paymentId: '',
    reference: '',
    customer: '',
    caseType: '',
    amount: '',
    paymentStatus: '',
    datePreset: '' as DatePreset,
    fromDate: '',
    toDate: '',
  });

  const [showCustomDatePopover, setShowCustomDatePopover] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false); // ✅ NEW
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowCustomDatePopover(false);
      }
    };
    if (showCustomDatePopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCustomDatePopover]);

  /* Amount resolver */
  const getAmount = (txn: any): number => {
    if (txn?.resolved_amount != null) {
      const n = Number(txn.resolved_amount);
      if (!isNaN(n) && n > 0) return n;
    }
    if (txn?.amount != null) {
      const n = Number(txn.amount);
      if (!isNaN(n) && n > 0) return n;
    }
    const isService =
      txn?.source_table === 'service_records' ||
      txn?.record_category === 'SERVICE' ||
      txn?.is_service_record === true ||
      (Number(txn?.gateway_fee || 0) > 0 && Number(txn?.user_payment || 0) === 0);

    const raw = isService
      ? txn?.gateway_fee ?? txn?.user_service_fee ?? txn?.user_payment ?? txn?.fee_standard ?? 0
      : txn?.user_payment ?? txn?.amount ?? txn?.total_amount ?? 0;

    const n = Number(raw);
    return isNaN(n) ? 0 : n;
  };

  const getDateRange = (): { from: Date | null; to: Date | null } => {
    const preset = colFilters.datePreset;

    if (preset === 'custom' && (colFilters.fromDate || colFilters.toDate)) {
      return {
        from: colFilters.fromDate ? new Date(colFilters.fromDate + 'T00:00:00') : null,
        to: colFilters.toDate ? new Date(colFilters.toDate + 'T23:59:59') : null,
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'today':
        return { from: today, to: new Date(today.getTime() + 86400000 - 1) };
      case '7d':
        return { from: new Date(today.getTime() - 7 * 86400000), to: new Date(today.getTime() + 86400000 - 1) };
      case '30d':
        return { from: new Date(today.getTime() - 30 * 86400000), to: new Date(today.getTime() + 86400000 - 1) };
      case '90d':
        return { from: new Date(today.getTime() - 90 * 86400000), to: new Date(today.getTime() + 86400000 - 1) };
      case 'month':
        return {
          from: new Date(now.getFullYear(), now.getMonth(), 1),
          to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        };
      default:
        return { from: null, to: null };
    }
  };

  const filteredTransactions = useMemo(() => {
    const dateRange = getDateRange();

    return transactions.filter((txn) => {
      if (dateRange.from || dateRange.to) {
        const txDate = new Date(txn.created_at || txn.date || Date.now());
        if (isNaN(txDate.getTime())) return false;
        if (dateRange.from && txDate < dateRange.from) return false;
        if (dateRange.to && txDate > dateRange.to) return false;
      }
      if (colFilters.paymentId) {
        const q = colFilters.paymentId.toLowerCase();
        if (!String(txn.razorpay_payment_id || '').toLowerCase().includes(q)) return false;
      }
      if (colFilters.reference) {
        const q = colFilters.reference.toLowerCase();
        const ref = String(txn.reference_no || txn.ref_no || '').toLowerCase();
        if (!ref.includes(q)) return false;
      }
      if (colFilters.customer) {
        const q = colFilters.customer.toLowerCase();
        const name = String(txn.customer_name || txn.client_name || '').toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (colFilters.caseType) {
        const q = colFilters.caseType.toLowerCase();
        const ct = String(txn.case_type || txn.caseType || txn.estimate_type || '').toLowerCase();
        if (!ct.includes(q)) return false;
      }
      if (colFilters.amount) {
        const q = colFilters.amount.replace(/[^0-9.-]/g, '');
        if (!String(getAmount(txn)).includes(q)) return false;
      }
      if (colFilters.paymentStatus) {
        const q = colFilters.paymentStatus.toLowerCase();
        const status = String(
          txn.platform_payment_status || txn.payment_status || 'paid'
        ).toLowerCase();
        if (status !== q) return false;
      }
      return true;
    });
  }, [transactions, colFilters]);

  const filteredTotal = useMemo(
    () => filteredTransactions.reduce((s, t) => s + getAmount(t), 0),
    [filteredTransactions]
  );

  const filteredPaidCount = useMemo(
    () =>
      filteredTransactions.filter(
        (t) =>
          String(t.platform_payment_status || t.payment_status || 'paid').toLowerCase() ===
          'paid'
      ).length,
    [filteredTransactions]
  );

  const caseTypeOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      const ct = t.case_type || t.caseType || t.estimate_type;
      if (ct) set.add(String(ct));
    });
    return Array.from(set).sort();
  }, [transactions]);

  const activeDateLabel = useMemo(() => {
    if (colFilters.datePreset === 'custom') {
      if (colFilters.fromDate && colFilters.toDate) return `${colFilters.fromDate} → ${colFilters.toDate}`;
      if (colFilters.fromDate) return `From ${colFilters.fromDate}`;
      if (colFilters.toDate) return `Upto ${colFilters.toDate}`;
    }
    if (colFilters.datePreset === 'today') return 'Today';
    if (colFilters.datePreset === '7d') return 'Last 7 days';
    if (colFilters.datePreset === '30d') return 'Last 30 days';
    if (colFilters.datePreset === '90d') return 'Last 90 days';
    if (colFilters.datePreset === 'month') return 'This month';
    return '';
  }, [colFilters]);

  const hasAnyFilter = Object.values(colFilters).some((v) => v !== '');

  const clearAllFilters = () => {
    setColFilters({
      paymentId: '',
      reference: '',
      customer: '',
      caseType: '',
      amount: '',
      paymentStatus: '',
      datePreset: '',
      fromDate: '',
      toDate: '',
    });
  };

  /* ✅ Shared status styles */
  const getStatusStyle = (status: string) =>
    status === 'paid'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : status === 'pending'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : status === 'failed'
      ? 'bg-rose-100 text-rose-700 border-rose-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  const getCaseTypeStyle = (caseType: string) =>
    String(caseType).toUpperCase().includes('NEW')
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : String(caseType).toUpperCase().includes('PLAN')
      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
      : String(caseType).toUpperCase().includes('RENOV')
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : String(caseType).toUpperCase().includes('VALUATION')
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : String(caseType).toUpperCase().includes('DEED')
      ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
      : 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">

      {/* ══════════════════════════════════════════════ */}
      {/* ✅ MOBILE VIEW — Cards + Collapsible Filters    */}
      {/* ══════════════════════════════════════════════ */}
      <div className="block md:hidden flex-1 overflow-auto">

        {/* Mobile Filter Toggle Bar */}
        <div className="sticky top-0 z-30 bg-slate-900 text-white px-3 py-2 flex items-center justify-between shadow-md">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded transition"
          >
            🔍 {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
            {hasAnyFilter && (
              <span className="bg-blue-500 text-white text-[9px] rounded-full px-1.5 py-0.5 ml-1">
                {Object.values(colFilters).filter((v) => v !== '').length}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-slate-300">TXN</span>
            <span className="font-bold tabular-nums">{filteredTransactions.length}</span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-400 font-bold tabular-nums">
              ₹{filteredTotal.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Collapsible Filters */}
        {showMobileFilters && (
          <div className="bg-slate-50 border-b border-slate-200 p-3 space-y-2">
            {/* Payment ID */}
            <input
              type="text"
              placeholder="Payment ID…"
              value={colFilters.paymentId}
              onChange={(e) => setColFilters({ ...colFilters, paymentId: e.target.value })}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {/* Reference No */}
            <input
              type="text"
              placeholder="Reference No…"
              value={colFilters.reference}
              onChange={(e) => setColFilters({ ...colFilters, reference: e.target.value })}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {/* Customer */}
            <input
              type="text"
              placeholder="Customer name…"
              value={colFilters.customer}
              onChange={(e) => setColFilters({ ...colFilters, customer: e.target.value })}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {/* Case Type + Amount row */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={colFilters.caseType}
                onChange={(e) => setColFilters({ ...colFilters, caseType: e.target.value })}
                className="px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">All Case Types</option>
                {caseTypeOptions.map((ct) => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="₹ Amount…"
                value={colFilters.amount}
                onChange={(e) => setColFilters({ ...colFilters, amount: e.target.value })}
                className="px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Date + Status row */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={colFilters.datePreset}
                onChange={(e) => {
                  const v = e.target.value as DatePreset;
                  setColFilters({
                    ...colFilters,
                    datePreset: v,
                    fromDate: v === 'custom' ? colFilters.fromDate : '',
                    toDate: v === 'custom' ? colFilters.toDate : '',
                  });
                }}
                className={`px-2.5 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  colFilters.datePreset ? 'border-blue-300 text-blue-700 font-semibold' : 'border-slate-200 text-slate-700'
                }`}
              >
                <option value="">All Dates</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="month">This Month</option>
              </select>

              <select
                value={colFilters.paymentStatus}
                onChange={(e) => setColFilters({ ...colFilters, paymentStatus: e.target.value })}
                className={`px-2.5 py-2 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  colFilters.paymentStatus === 'paid'
                    ? 'border-emerald-300 text-emerald-700'
                    : colFilters.paymentStatus === 'pending'
                    ? 'border-amber-300 text-amber-700'
                    : colFilters.paymentStatus === 'failed'
                    ? 'border-rose-300 text-rose-700'
                    : 'border-slate-200 text-slate-700'
                }`}
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Custom date range */}
            {colFilters.datePreset === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <input
                  type="date"
                  value={colFilters.fromDate}
                  onChange={(e) => setColFilters({ ...colFilters, fromDate: e.target.value })}
                  className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                />
                <input
                  type="date"
                  value={colFilters.toDate}
                  onChange={(e) => setColFilters({ ...colFilters, toDate: e.target.value })}
                  className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
                />
              </div>
            )}

            {/* Clear */}
            {hasAnyFilter && (
              <button
                onClick={clearAllFilters}
                className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold uppercase transition"
              >
                ✕ Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Mobile Cards List */}
        <div className="p-2.5 space-y-2.5">
          {filteredTransactions && filteredTransactions.length > 0 ? (
            filteredTransactions.map((txn: any, index: number) => {
              const status = String(
                txn.platform_payment_status || txn.payment_status || 'paid'
              ).toLowerCase();

              const caseType = txn.case_type || txn.caseType || txn.estimate_type || 'N/A';
              const txDate = new Date(txn.created_at || Date.now());

              return (
                <div
                  key={index}
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* TOP: Payment ID + Status */}
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                    <span
                      className="font-mono text-[10px] text-slate-600 truncate flex-1"
                      title={txn.razorpay_payment_id || 'N/A'}
                    >
                      {txn.razorpay_payment_id || 'N/A'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase shrink-0 ${getStatusStyle(status)}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {status}
                    </span>
                  </div>

                  {/* CUSTOMER */}
                  <div className="mb-2">
                    <div className="text-[13px] font-bold text-slate-800 line-clamp-2 leading-snug">
                      {txn.customer_name || txn.client_name || 'Valued User'}
                    </div>
                    <div
                      className="text-[10px] font-semibold text-blue-600 mt-0.5 truncate"
                      title={txn.reference_no || txn.ref_no || 'N/A'}
                    >
                      {txn.reference_no || txn.ref_no || 'N/A'}
                    </div>
                  </div>

                  {/* CASE TYPE + AMOUNT */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase truncate max-w-[60%] ${getCaseTypeStyle(caseType)}`}
                      title={caseType}
                    >
                      {caseType}
                    </span>
                    <span className="text-emerald-600 text-[15px] font-black tabular-nums shrink-0">
                      ₹{getAmount(txn).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* DATE */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-100">
                    <span>
                      {txDate.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span>
                      {txDate.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs font-medium">
              No matching payment records found.
            </div>
          )}
        </div>

        {/* Mobile Sticky Footer */}
        <div className="sticky bottom-0 z-20 bg-gradient-to-r from-slate-900 to-slate-800 text-white px-3 py-2.5 flex items-center justify-between shadow-lg">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-slate-300 font-bold">
              Total — Filtered
            </span>
            <span className="text-[10px] text-slate-400">
              {filteredTransactions.length} txn · ✓ {filteredPaidCount} paid
            </span>
          </div>
          <span className="text-emerald-400 text-[16px] font-black tabular-nums">
            ₹ {filteredTotal.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* ✅ DESKTOP VIEW — Table (unchanged)            */}
      {/* ══════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-1 overflow-auto flex-col">
        <table className="w-full text-left text-xs table-fixed">
          {/* ══════ HEADER ══════ */}
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-bold sticky top-0 z-20 shadow-sm">
            <tr>
              {/* Payment ID */}
              <th className="py-1.5 px-2 w-[15%] bg-slate-50">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500">Payment ID</span>
                  <input
                    type="text"
                    placeholder="Filter…"
                    value={colFilters.paymentId}
                    onChange={(e) => setColFilters({ ...colFilters, paymentId: e.target.value })}
                    className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 placeholder:text-[9px] normal-case"
                  />
                </div>
              </th>

              {/* Reference No */}
              <th className="py-1.5 px-2 w-[13%] bg-slate-50">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500">Reference No</span>
                  <input
                    type="text"
                    placeholder="Filter…"
                    value={colFilters.reference}
                    onChange={(e) => setColFilters({ ...colFilters, reference: e.target.value })}
                    className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 placeholder:text-[9px] normal-case"
                  />
                </div>
              </th>

              {/* Customer */}
              <th className="py-1.5 px-2 w-[16%] bg-slate-50">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500">Customer</span>
                  <input
                    type="text"
                    placeholder="Filter…"
                    value={colFilters.customer}
                    onChange={(e) => setColFilters({ ...colFilters, customer: e.target.value })}
                    className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 placeholder:text-[9px] normal-case"
                  />
                </div>
              </th>

              {/* Case Type */}
              <th className="py-1.5 px-2 w-[13%] bg-slate-50">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500">Case Type</span>
                  <select
                    value={colFilters.caseType}
                    onChange={(e) => setColFilters({ ...colFilters, caseType: e.target.value })}
                    className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer normal-case"
                  >
                    <option value="">All</option>
                    {caseTypeOptions.map((ct) => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>
              </th>

              {/* DATE */}
              <th className="py-1.5 px-2 w-[13%] bg-slate-50">
                <div className="flex flex-col gap-1" ref={popoverRef}>
                  <span className="text-[9px] text-slate-500 text-center block">Date</span>
                  <select
                    value={colFilters.datePreset}
                    onChange={(e) => {
                      const v = e.target.value as DatePreset;
                      if (v === 'custom') {
                        setColFilters({
                          ...colFilters,
                          datePreset: 'custom',
                          fromDate: colFilters.fromDate || '',
                          toDate: colFilters.toDate || '',
                        });
                        setShowCustomDatePopover(true);
                      } else {
                        setColFilters({
                          ...colFilters,
                          datePreset: v,
                          fromDate: '',
                          toDate: '',
                        });
                        setShowCustomDatePopover(false);
                      }
                    }}
                    className={`w-full px-1.5 py-0.5 text-[10px] bg-white border rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer normal-case truncate text-center ${
                      colFilters.datePreset ? 'border-blue-300 text-blue-700 font-semibold' : 'border-slate-200'
                    }`}
                  >
                    <option value="">All Dates</option>
                    <option value="today">Today</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="month">This Month</option>
                    <option value="custom">Custom Range…</option>
                  </select>

                  {colFilters.datePreset === 'custom' &&
                    (colFilters.fromDate || colFilters.toDate) && (
                      <button
                        type="button"
                        onClick={() => setShowCustomDatePopover(!showCustomDatePopover)}
                        className="w-full px-1.5 py-0.5 text-[9px] bg-blue-50 border border-blue-200 rounded text-blue-700 font-semibold truncate text-center hover:bg-blue-100 transition"
                        title={activeDateLabel}
                      >
                        📅 {activeDateLabel}
                      </button>
                    )}

                  {showCustomDatePopover && (
                    <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-slate-300 rounded-lg shadow-xl p-2.5 w-[220px]">
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200">
                        <span className="text-[10px] font-bold text-slate-700 uppercase">
                          Custom Date Range
                        </span>
                        <button
                          onClick={() => setShowCustomDatePopover(false)}
                          className="text-slate-400 hover:text-slate-700 font-bold text-xs"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">
                            From
                          </label>
                          <input
                            type="date"
                            value={colFilters.fromDate}
                            onChange={(e) =>
                              setColFilters({ ...colFilters, fromDate: e.target.value })
                            }
                            className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-200 rounded text-slate-700 normal-case focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">
                            To
                          </label>
                          <input
                            type="date"
                            value={colFilters.toDate}
                            onChange={(e) =>
                              setColFilters({ ...colFilters, toDate: e.target.value })
                            }
                            className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-200 rounded text-slate-700 normal-case focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="flex gap-1 mt-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() =>
                            setColFilters({
                              ...colFilters,
                              fromDate: '',
                              toDate: '',
                              datePreset: '',
                            })
                          }
                          className="flex-1 px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => setShowCustomDatePopover(false)}
                          className="flex-1 px-1.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </th>

              {/* AMOUNT */}
              <th className="py-1.5 px-2 w-[10%] bg-slate-50 text-center">
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-[9px] text-slate-500">Amount</span>
                  <input
                    type="text"
                    placeholder="₹"
                    value={colFilters.amount}
                    onChange={(e) => setColFilters({ ...colFilters, amount: e.target.value })}
                    className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 text-center normal-case"
                  />
                </div>
              </th>

              {/* Status */}
              <th className="py-1.5 px-2 w-[12%] bg-slate-50 text-center">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500">Status</span>
                  <select
                    value={colFilters.paymentStatus}
                    onChange={(e) =>
                      setColFilters({ ...colFilters, paymentStatus: e.target.value })
                    }
                    className={`w-full px-1.5 py-0.5 text-[10px] bg-white border rounded font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer normal-case ${
                      colFilters.paymentStatus === 'paid'
                        ? 'border-emerald-300 text-emerald-700'
                        : colFilters.paymentStatus === 'pending'
                        ? 'border-amber-300 text-amber-700'
                        : colFilters.paymentStatus === 'failed'
                        ? 'border-rose-300 text-rose-700'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <option value="">All</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </th>
            </tr>
          </thead>

          {/* ══════ BODY ══════ */}
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions && filteredTransactions.length > 0 ? (
              filteredTransactions.map((txn: any, index: number) => {
                const status = String(
                  txn.platform_payment_status || txn.payment_status || 'paid'
                ).toLowerCase();

                const caseType = txn.case_type || txn.caseType || txn.estimate_type || 'N/A';

                return (
                  <tr key={index} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-1 px-2 font-mono text-[10px] text-slate-700 truncate">
                      <span title={txn.razorpay_payment_id || 'N/A'}>
                        {txn.razorpay_payment_id || 'N/A'}
                      </span>
                    </td>

                    <td className="py-1 px-2 font-semibold text-blue-600 text-[10px] truncate">
                      <span title={txn.reference_no || txn.ref_no || 'N/A'}>
                        {txn.reference_no || txn.ref_no || 'N/A'}
                      </span>
                    </td>

                    <td className="py-1 px-2 font-medium text-slate-800 text-[11px] truncate">
                      <span title={txn.customer_name || txn.client_name || 'N/A'}>
                        {txn.customer_name || txn.client_name || 'Valued User'}
                      </span>
                    </td>

                    <td className="py-1 px-2">
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase truncate inline-block max-w-full ${getCaseTypeStyle(caseType)}`}
                        title={caseType}
                      >
                        {caseType}
                      </span>
                    </td>

                    <td className="py-1 px-2 whitespace-nowrap text-[10px] leading-tight text-center">
                      <div className="text-slate-700 font-semibold">
                        {new Date(txn.created_at || Date.now()).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </div>
                      <div className="text-slate-400">
                        {new Date(txn.created_at || Date.now()).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    <td className="py-1 px-2 text-center font-bold text-emerald-600 text-[12px] whitespace-nowrap tabular-nums">
                      ₹ {getAmount(txn).toLocaleString('en-IN')}
                    </td>

                    <td className="py-1 px-2 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase ${getStatusStyle(status)}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 text-xs font-medium">
                  No matching payment records found.
                </td>
              </tr>
            )}
          </tbody>

          {/* ══════ FOOTER ══════ */}
          <tfoot className="sticky bottom-0 z-20">
            <tr className="bg-gradient-to-r from-slate-900 to-slate-800 text-white font-bold">
              <td colSpan={5} className="py-2 px-3 border-t-2 border-slate-700">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-slate-300">
                    TOTAL — Filtered
                  </span>
                  <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-bold tabular-nums">
                    {filteredTransactions.length} txn
                  </span>
                  {activeDateLabel && (
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[9px] font-bold normal-case">
                      📅 {activeDateLabel}
                    </span>
                  )}
                  {hasAnyFilter && (
                    <button
                      onClick={clearAllFilters}
                      className="px-1.5 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded text-[9px] font-bold uppercase transition"
                    >
                      ✕ Clear Filters
                    </button>
                  )}
                </div>
              </td>
              <td className="py-2 px-3 border-t-2 border-slate-700 text-center whitespace-nowrap">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block leading-none">
                  Total
                </span>
                <span className="text-emerald-400 text-[13px] font-black tabular-nums">
                  ₹ {filteredTotal.toLocaleString('en-IN')}
                </span>
              </td>
              <td className="py-2 px-3 border-t-2 border-slate-700 text-center whitespace-nowrap">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block leading-none">
                  Paid
                </span>
                <span className="text-emerald-400 text-[12px] font-black tabular-nums">
                  ✓ {filteredPaidCount}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}