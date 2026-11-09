/* ============================================================
   Admin Dashboard – Shared finance & data helpers
   ------------------------------------------------------------
   Single source of truth for every revenue / wallet number shown
   in the dashboard so that all sections always agree.

   Revenue definitions used everywhere
   -----------------------------------
   • Cash In            = approved wallet recharges + direct (Razorpay) payments
   • Earned Revenue     = wallet usage (estimates / services paid from wallet)
                          + direct (Razorpay) payments
   • Wallet Liability   = money users have deposited but not yet used
                          (sum of profiles.wallet_balance)
   A recharge is NOT revenue until the user uses it, so recharge and
   wallet usage must never be added together (that double-counts).
   ============================================================ */

/* ---------- Pure helpers (no I/O) ---------- */

export const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const inrFmt0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹ 1,23,456.50 */
export const inr = (n: number): string => `₹ ${inrFmt.format(round2(toNum(n)))}`;
export const inr0 = (n: number): string => `₹ ${inrFmt0.format(Math.round(toNum(n)))}`;

/** 12.3L / 4.5Cr style for tight KPI tiles */
export const inrCompact = (n: number): string => {
  const v = toNum(n);
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1e7) return `${sign}₹ ${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹ ${(a / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `${sign}₹ ${(a / 1e3).toFixed(1)} K`;
  return `${sign}₹ ${a.toFixed(0)}`;
};

export const firstPositive = (...vals: unknown[]): number => {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

/* ---------- Dates (always India time, never the viewer's/UTC day) ---------- */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' of the given instant in IST. '' when invalid. */
export const istDateKey = (iso: unknown): string => {
  if (!iso) return '';
  const t = new Date(iso as string).getTime();
  if (!Number.isFinite(t)) return '';
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10);
};

export const istMonthKey = (iso: unknown): string => istDateKey(iso).slice(0, 7);

/** Indian financial year label for a date, e.g. '2026-27' (Apr–Mar). */
export const fyOf = (iso: unknown): string => {
  const key = istDateKey(iso);
  if (!key) return '';
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

export const currentFY = (): string => fyOf(new Date().toISOString());
export const currentISTMonth = (): string => istMonthKey(new Date().toISOString());
export const currentISTDate = (): string => istDateKey(new Date().toISOString());

/** Last `count` financial years incl. current, newest first. */
export const fyOptions = (count = 6): string[] => {
  const startNow = Number(currentFY().slice(0, 4));
  return Array.from({ length: count }, (_, i) => {
    const s = startNow - i;
    return `${s}-${String((s + 1) % 100).padStart(2, '0')}`;
  });
};

export const yearOptions = (count = 6): string[] => {
  const y = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => String(y - i));
};

/* ---------- Status normalisation ---------- */

const norm = (s: unknown) => String(s ?? '').trim().toUpperCase();

const RECHARGE_APPROVED = new Set(['APPROVED', 'SUCCESS', 'SUCCESSFUL', 'PAID', 'COMPLETED', 'CAPTURED']);
const RECHARGE_PENDING = new Set(['PENDING', 'CREATED', 'INITIATED', 'PROCESSING', 'UNDER_REVIEW', '']);

export type RechargeBucket = 'approved' | 'pending' | 'rejected';

/**
 * The dashboard approves recharges as 'APPROVED' while the old profit widget
 * only looked for 'success|paid|completed' – so approved recharges never
 * reached the profit numbers. Every module must use this function instead.
 */
export const rechargeBucket = (status: unknown): RechargeBucket => {
  const s = norm(status);
  if (RECHARGE_APPROVED.has(s)) return 'approved';
  if (RECHARGE_PENDING.has(s)) return 'pending';
  return 'rejected';
};

/** Never revenue, whatever else the row says. */
const HARD_NOT_REVENUE = new Set([
  'FAILED', 'FAILURE', 'CANCELLED', 'CANCELED', 'REFUNDED', 'REJECTED', 'DECLINED', 'EXPIRED',
]);
/**
 * "Not yet confirmed" statuses. The status column is not always updated after a Razorpay payment
 * succeeds, so a row in one of these states still counts as received money when a Razorpay payment id
 * is stored on it. Without a payment id it is genuinely unpaid and is not counted.
 */
const SOFT_NOT_REVENUE = new Set(['PENDING', 'CREATED', 'UNPAID', 'ABANDONED', 'ATTEMPTED', 'INITIATED']);

/** A row counts as earned revenue unless it is failed / refunded, or unpaid with no gateway payment id. */
export const isRevenueRow = (tx: any): boolean => {
  const s = norm(tx?.payment_status);
  if (HARD_NOT_REVENUE.has(s)) return false;
  if (SOFT_NOT_REVENUE.has(s)) return hasGatewayPayment(tx);
  return true;
};

/** Status says pending but a gateway payment id exists - money was received, status was just not updated. */
export const isPendingButPaid = (tx: any): boolean => SOFT_NOT_REVENUE.has(norm(tx?.payment_status)) && hasGatewayPayment(tx);

export const hasGatewayPayment = (tx: any): boolean => {
  const clean = (v: unknown) => {
    const id = String(v ?? '').trim();
    return id !== '' && id.toUpperCase() !== 'N/A' && id.toLowerCase() !== 'null' ? id : '';
  };
  // Razorpay payment ids look like "pay_XXXX". Some rows keep it in payment_id instead.
  return clean(tx?.razorpay_payment_id) !== '' || /^pay_/i.test(clean(tx?.payment_id));
};

/** Bump when revenue rules change. Shown in the UI so you can confirm which build is running. */
export const FINANCE_RULES_VERSION = '2026-11-08.2';

/* ---------- Amount resolution ---------- */

export const isServiceRecord = (tx: any): boolean =>
  tx?.source_table === 'service_records' ||
  tx?.record_category === 'SERVICE' ||
  tx?.__is_service_record === true;

/**
 * First POSITIVE amount wins. The previous `a ?? b ?? c` chain stopped at the
 * first non-null value, so a stored 0 hid the real amount in the next column.
 */
export function resolveAmount(tx: any): number {
  return isServiceRecord(tx)
    ? firstPositive(
        tx?.gateway_fee, tx?.user_payment, tx?.user_service_fee,
        tx?.fee_standard, tx?.amount, tx?.gross_amount, tx?.paid_amount
      )
    : firstPositive(
        tx?.user_payment, tx?.amount, tx?.total_amount, tx?.gross_amount, tx?.paid_amount
      );
}

/* ---------- Paginated fetching (Supabase silently caps a query at 1000 rows) ---------- */

export interface FetchAllResult<T> {
  data: T[];
  error: { message: string; code?: string } | null;
  /** true when maxRows was hit – totals would be incomplete */
  truncated: boolean;
}

/**
 * Pulls every row of a query, page by page.
 * The builder MUST apply a stable order (e.g. created_at desc, id) before .range().
 *
 *   fetchAll((from, to) => supabase.from('estimates').select('*').order('id').range(from, to))
 */
export async function fetchAll<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  opts: { pageSize?: number; maxRows?: number } = {}
): Promise<FetchAllResult<T>> {
  const pageSize = opts.pageSize ?? 1000;
  const maxRows = opts.maxRows ?? 250000;
  const out: T[] = [];
  let from = 0;
  let lastSig = '';
  while (true) {
    let res;
    try {
      res = await build(from, from + pageSize - 1);
    } catch (e: any) {
      return { data: out, error: { message: e?.message || String(e) }, truncated: false };
    }
    if (res.error) {
      return {
        data: out,
        error: { message: res.error.message || String(res.error), code: res.error.code },
        truncated: false,
      };
    }
    const rows = res.data || [];
    // Safety: an RPC that returns one JSON array ignores .range() and would answer with the same
    // payload forever. Stop when a page is larger than requested or repeats the previous page.
    const sig = rows.length ? `${rows.length}|${JSON.stringify(rows[0])}|${JSON.stringify(rows[rows.length - 1])}` : '';
    if (rows.length > pageSize || (sig && sig === lastSig)) {
      if (rows.length > pageSize) out.push(...rows);
      return { data: out, error: null, truncated: false };
    }
    lastSig = sig;
    out.push(...rows);
    if (rows.length < pageSize) return { data: out, error: null, truncated: false };
    from += pageSize;
    if (out.length >= maxRows) return { data: out, error: null, truncated: true };
  }
}

/* ---------- Revenue transactions (estimates + service records) ---------- */

export interface RevenueTxn {
  id: string;
  source_table: 'estimates' | 'service_records';
  user_id: string | null;
  reference_no: string;
  ref_no: string;
  customer_name: string;
  case_type: string;
  created_at: string;
  payment_status: string;
  razorpay_payment_id: string;
  /** resolved ₹ value – the only field totals should read */
  amount: number;
  resolved_amount: number;
  /** 'GATEWAY' = paid directly via Razorpay, 'WALLET' = deducted from user wallet */
  channel: 'GATEWAY' | 'WALLET';
  [k: string]: any;
}

export function buildRevenueTxns(estimates: any[], services: any[]): RevenueTxn[] {
  const fromEstimates: RevenueTxn[] = (estimates || []).map((item: any) => {
    const refNo = item.ref_no || item.reference_no || item.estimate_no || item.id || '';
    let inferred = 'Estimate';
    if (String(refNo).includes('LnT')) inferred = 'Construction Estimate';
    else if (String(refNo).includes('FY') || String(refNo).includes('D0')) inferred = 'Estimate Type';
    const amount = firstPositive(item.user_payment, item.amount, item.total_amount);
    const tx: any = {
      ...item,
      source_table: 'estimates',
      case_type: item.estimate_type || item.case_type || inferred,
      reference_no: refNo,
      ref_no: refNo,
      customer_name: item.customer_name || item.client_name || 'N/A',
      amount,
      resolved_amount: amount,
      payment_status: item.payment_status || 'paid',
      razorpay_payment_id: item.razorpay_payment_id || 'N/A',
    };
    tx.channel = hasGatewayPayment(tx) ? 'GATEWAY' : 'WALLET';
    return tx;
  });

  const fromServices: RevenueTxn[] = (services || []).map((item: any) => {
    const refNo = item.ref_no || item.reference_no || item.razorpay_payment_id || item.id || '';
    const amount = firstPositive(
      item.gateway_fee, item.user_payment, item.user_service_fee, item.fee_standard, item.amount
    );
    let customerName = item.customer_name;
    if (!customerName && item.form_snapshot) {
      try {
        const snap = typeof item.form_snapshot === 'string' ? JSON.parse(item.form_snapshot) : item.form_snapshot;
        if (Array.isArray(snap?.buyers) && snap.buyers.length > 0) customerName = snap.buyers[0]?.name;
        else if (snap?.clientName) customerName = snap.clientName;
      } catch { /* malformed snapshot – ignore */ }
    }
    const tx: any = {
      ...item,
      source_table: 'service_records',
      case_type: item.service_type || item.case_type || (item.deed_type ? `DEED - ${item.deed_type}` : 'DRAFTING & MAP'),
      reference_no: refNo,
      ref_no: refNo,
      customer_name: customerName || item.client_name || 'N/A',
      amount,
      resolved_amount: amount,
      gateway_fee: amount,
      user_payment: toNum(item.user_payment),
      user_service_fee: toNum(item.user_service_fee),
      fee_standard: toNum(item.fee_standard),
      payment_status: item.payment_status || 'paid',
      razorpay_payment_id: item.razorpay_payment_id || 'N/A',
    };
    tx.channel = hasGatewayPayment(tx) ? 'GATEWAY' : 'WALLET';
    return tx;
  });

  return [...fromEstimates, ...fromServices].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

export interface RevenueSummary {
  total: number;
  gateway: number;
  wallet: number;
  count: number;
  gatewayCount: number;
  walletCount: number;
  excludedCount: number;
}

export function summarizeRevenue(txns: any[], opts: { excludeUserId?: string } = {}): RevenueSummary {
  const s: RevenueSummary = { total: 0, gateway: 0, wallet: 0, count: 0, gatewayCount: 0, walletCount: 0, excludedCount: 0 };
  for (const tx of txns) {
    if (!isRevenueRow(tx)) { s.excludedCount++; continue; }
    if (opts.excludeUserId && tx.user_id === opts.excludeUserId) continue;
    const amt = resolveAmount(tx);
    if (amt <= 0) continue;
    s.total += amt;
    s.count++;
    if (hasGatewayPayment(tx)) { s.gateway += amt; s.gatewayCount++; }
    else { s.wallet += amt; s.walletCount++; }
  }
  s.total = round2(s.total); s.gateway = round2(s.gateway); s.wallet = round2(s.wallet);
  return s;
}

/* ---------- Wallet: recharged / used / remaining ---------- */

export interface WalletUserRow {
  id: string;
  name: string;
  email: string;
  mobile: string;
  code: string;
  plan: string;
  recharged: number;
  used: number;
  refunded: number;
  balance: number;
  /** balance − (recharged − used − refunded). +ve = bonus/adjustment credit, −ve = needs review */
  adjustment: number;
  usagePct: number;
  rechargeCount: number;
  lastRechargeAt: string | null;
  flag: 'OK' | 'NEGATIVE_BALANCE' | 'REVIEW';
}

export interface WalletSummary {
  totalRecharged: number;
  totalPending: number;
  totalRejected: number;
  rechargeCount: number;
  pendingCount: number;
  totalUsed: number;
  totalRefunded: number;
  /** money users still hold with us (positive balances) */
  remainingBalance: number;
  /** premium / overdrawn wallets (negative balances) – amount users owe */
  receivable: number;
  /** remaining − receivable */
  netHeld: number;
  /** Bonus / manual credits that did not come through a recharge (derived) */
  bonusAndAdjustments: number;
  usagePct: number;
  usedSource: 'ledger' | 'estimates';
  usersWithBalance: number;
  usersFlagged: number;
  rows: WalletUserRow[];
}

/** Column names differ between projects (description / remarks / narration ...), so scan every text field. */
const isRefundTx = (tx: any) =>
  Object.values(tx || {}).some((v) => typeof v === 'string' && v.length < 400 && /refund/i.test(v));
const isDebitTx = (tx: any) => norm(tx?.type ?? tx?.txn_type ?? tx?.transaction_type ?? tx?.direction) === 'DEBIT';

export function computeWalletSummary(input: {
  recharges: any[];
  profiles: any[];
  ledger: any[];
  ledgerOk: boolean;
  /** used only when the wallet_transactions ledger is unavailable */
  walletPaidTxns?: any[];
  /** restrict recharges to a month ('YYYY-MM' in IST). Balances are always "as of now". */
  month?: string | null;
  excludeUserIds?: string[];
}): WalletSummary {
  const { recharges, profiles, ledger, ledgerOk, walletPaidTxns = [], month = null, excludeUserIds = [] } = input;
  const excluded = new Set(excludeUserIds);

  const rows = new Map<string, WalletUserRow>();
  for (const p of profiles || []) {
    if (!p?.id) continue;
    rows.set(String(p.id), {
      id: String(p.id),
      name: p.full_name || p.name || 'Unnamed',
      email: p.email || '',
      mobile: p.mobile || '',
      code: p.user_code || '',
      plan: p.plan_type || '',
      recharged: 0, used: 0, refunded: 0,
      balance: toNum(p.wallet_balance),
      adjustment: 0, usagePct: 0, rechargeCount: 0, lastRechargeAt: null, flag: 'OK',
    });
  }
  const ensure = (id: string): WalletUserRow => {
    let r = rows.get(id);
    if (!r) {
      r = { id, name: 'Unknown user', email: '', mobile: '', code: '', plan: '', recharged: 0, used: 0, refunded: 0, balance: 0, adjustment: 0, usagePct: 0, rechargeCount: 0, lastRechargeAt: null, flag: 'OK' };
      rows.set(id, r);
    }
    return r;
  };

  let totalPending = 0, totalRejected = 0, pendingCount = 0, rechargeCount = 0;
  for (const rc of recharges || []) {
    if (month && istMonthKey(rc.created_at) !== month) continue;
    const uid = String(rc.user_id ?? '');
    if (excluded.has(uid)) continue;
    const amt = toNum(rc.amount);
    if (amt <= 0) continue;
    const bucket = rechargeBucket(rc.status);
    if (bucket === 'approved') {
      const r = ensure(uid);
      r.recharged += amt; r.rechargeCount++;
      if (!r.lastRechargeAt || new Date(rc.created_at) > new Date(r.lastRechargeAt)) r.lastRechargeAt = rc.created_at;
      rechargeCount++;
    } else if (bucket === 'pending') { totalPending += amt; pendingCount++; }
    else totalRejected += amt;
  }

  let usedSource: 'ledger' | 'estimates' = 'ledger';
  if (ledgerOk) {
    for (const tx of ledger || []) {
      if (!isDebitTx(tx)) continue;
      if (month && istMonthKey(tx.created_at) !== month) continue;
      const uid = String(tx.user_id ?? '');
      if (excluded.has(uid)) continue;
      const amt = toNum(tx.amount);
      if (amt <= 0) continue;
      const r = ensure(uid);
      if (isRefundTx(tx)) r.refunded += amt; else r.used += amt;
    }
  } else {
    usedSource = 'estimates';
    for (const tx of walletPaidTxns) {
      if (!isRevenueRow(tx) || hasGatewayPayment(tx)) continue;
      if (month && istMonthKey(tx.created_at) !== month) continue;
      const uid = String(tx.user_id ?? '');
      if (excluded.has(uid)) continue;
      ensure(uid).used += resolveAmount(tx);
    }
  }

  const list: WalletUserRow[] = [];
  let remaining = 0, receivable = 0, totalRecharged = 0, totalUsed = 0, totalRefunded = 0, flagged = 0, withBal = 0;
  rows.forEach((r) => {
    if (excluded.has(r.id)) return;
    r.recharged = round2(r.recharged); r.used = round2(r.used); r.refunded = round2(r.refunded);
    r.adjustment = round2(r.balance - (r.recharged - r.used - r.refunded));
    r.usagePct = r.recharged > 0 ? Math.min(999, round2((r.used / r.recharged) * 100)) : 0;
    r.flag = r.balance < 0 ? 'NEGATIVE_BALANCE' : r.adjustment < -1 && !month ? 'REVIEW' : 'OK';
    if (r.flag !== 'OK') flagged++;
    if (r.balance > 0) { remaining += r.balance; withBal++; } else if (r.balance < 0) receivable += -r.balance;
    totalRecharged += r.recharged; totalUsed += r.used; totalRefunded += r.refunded;
    if (r.recharged > 0 || r.used > 0 || r.balance !== 0 || r.refunded > 0) list.push(r);
  });
  list.sort((a, b) => b.balance - a.balance);

  const bonus = month ? 0 : list.reduce((s, r) => s + Math.max(0, r.adjustment), 0);

  return {
    totalRecharged: round2(totalRecharged),
    totalPending: round2(totalPending),
    totalRejected: round2(totalRejected),
    rechargeCount, pendingCount,
    totalUsed: round2(totalUsed),
    totalRefunded: round2(totalRefunded),
    remainingBalance: round2(remaining),
    receivable: round2(receivable),
    netHeld: round2(remaining - receivable),
    bonusAndAdjustments: round2(bonus),
    usagePct: totalRecharged > 0 ? round2((totalUsed / totalRecharged) * 100) : 0,
    usedSource,
    usersWithBalance: withBal,
    usersFlagged: flagged,
    rows: list,
  };
}

/* ---------- Profit pool ---------- */

export const EFFECTIVE_START_MONTH = '2026-09';
/** Internal admin account – its own usage is excluded from partner profit. */
export const EXCLUDED_ADMIN_USER_ID = '458350dc-59b3-44d9-a9e4-6051602c5291';
/** Fixed monthly platform / infrastructure cost deducted before profit is shared. */
export const FIXED_MONTHLY_OVERHEAD = 10000;

export interface MonthProfit {
  month: string;            // 'YYYY-MM'
  gross: number;            // earned (or cash) revenue, all users
  adminSelfUsage: number;   // excluded admin usage
  publicGross: number;
  overhead: number;
  pool: number;             // may be negative = loss
  distributable: number;    // max(0, pool) – base for partner shares
  payouts: number;          // already settled to partners (memo, NOT a cost)
  undistributed: number;    // distributable − payouts
}

export function computeMonthProfit(args: {
  month: string;
  gross: number;
  adminSelfUsage: number;
  overheadPerMonth: number;
  payouts: number;
  effectiveStartMonth?: string;
}): MonthProfit {
  const start = args.effectiveStartMonth ?? EFFECTIVE_START_MONTH;
  const active = args.month >= start;
  const gross = active ? args.gross : 0;
  const admin = active ? args.adminSelfUsage : 0;
  const publicGross = gross - admin;
  const overhead = active ? args.overheadPerMonth : 0;
  const pool = publicGross - overhead;
  const distributable = Math.max(0, pool);
  return {
    month: args.month,
    gross: round2(gross),
    adminSelfUsage: round2(admin),
    publicGross: round2(publicGross),
    overhead,
    pool: round2(pool),
    distributable: round2(distributable),
    payouts: round2(args.payouts),
    undistributed: round2(distributable - args.payouts),
  };
}


/* ---------- IST ranges ---------- */

/** [from, to) ISO instants covering one IST calendar year. */
export const istYearRange = (year: number): { from: string; to: string } => ({
  from: new Date(`${year}-01-01T00:00:00+05:30`).toISOString(),
  to: new Date(`${year + 1}-01-01T00:00:00+05:30`).toISOString(),
});

/** Shift a 'YYYY-MM' key by `delta` months. */
export const addMonths = (key: string, delta: number): string => {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)) - 1 + delta;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, '0')}`;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-11' -> 'Nov 26' */
export const monthLabel = (key: string): string =>
  `${MONTH_SHORT[Number(key.slice(5, 7)) - 1] ?? key} ${key.slice(2, 4)}`;

/* ---------- Revenue sources (one fetch used by every module) ---------- */

/**
 * Loads estimates + paid service records page by page (no 1000-row cap).
 * Pass `range` (ISO instants, [from, to)) to limit the window, e.g. one IST year.
 * `supabase` is passed in so this file stays free of client imports.
 */
export async function fetchRevenueSources(
  supabase: any,
  range?: { from?: string; to?: string }
): Promise<{ estimates: FetchAllResult<any>; services: FetchAllResult<any>; ms: { estimates: number; services: number } }> {
  const timed = async <T,>(p: Promise<T>): Promise<[T, number]> => {
    const t0 = Date.now();
    const r = await p;
    return [r, Date.now() - t0];
  };

  const [[estimates, estMs], [services, svcMs]] = await Promise.all([
    timed(
      fetchAll<any>((a, b) => {
        let q = supabase.from('estimates').select('*');
        if (range?.from) q = q.gte('created_at', range.from);
        if (range?.to) q = q.lt('created_at', range.to);
        return q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(a, b);
      })
    ),
    timed(
      fetchAll<any>((a, b) => {
        let q = supabase.from('service_records').select('*').or('payment_status.ilike.paid,payment_status.ilike.success,payment_status.ilike.completed,payment_status.ilike.captured,payment_status.ilike.pending,razorpay_payment_id.not.is.null');
        if (range?.from) q = q.gte('created_at', range.from);
        if (range?.to) q = q.lt('created_at', range.to);
        return q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(a, b);
      })
    ),
  ]);
  return { estimates, services, ms: { estimates: estMs, services: svcMs } };
}

/* ---------- Monthly roll-ups ---------- */

export interface MonthRevenue {
  /** all users, including the internal admin account */
  gross: number;
  /** internal admin account's own usage (excluded from profit) */
  admin: number;
  /** public users – paid directly through Razorpay */
  gateway: number;
  /** public users – deducted from wallet */
  wallet: number;
}

/** Earned revenue per IST month ('YYYY-MM'). Failed / pending / refunded rows are skipped. */
export function revenueByMonth(txns: any[], adminUserId?: string): Map<string, MonthRevenue> {
  const out = new Map<string, MonthRevenue>();
  for (const tx of txns || []) {
    if (!isRevenueRow(tx)) continue;
    const amt = resolveAmount(tx);
    if (amt <= 0) continue;
    const k = istMonthKey(tx.created_at);
    if (!k) continue;
    const r = out.get(k) ?? { gross: 0, admin: 0, gateway: 0, wallet: 0 };
    r.gross += amt;
    if (adminUserId && tx.user_id === adminUserId) r.admin += amt;
    else if (hasGatewayPayment(tx)) r.gateway += amt;
    else r.wallet += amt;
    out.set(k, r);
  }
  out.forEach((r) => { r.gross = round2(r.gross); r.admin = round2(r.admin); r.gateway = round2(r.gateway); r.wallet = round2(r.wallet); });
  return out;
}

export interface TrendPoint { month: string; label: string; earned: number; cashIn: number }

/**
 * Last `months` IST months, oldest first.
 *   earned = public revenue (wallet usage + direct payments)
 *   cashIn = approved recharges + direct payments (money that actually arrived)
 */
export function buildMonthlyTrend(
  txns: any[],
  recharges: any[],
  opts: { adminUserId?: string; months?: number } = {}
): TrendPoint[] {
  const n = opts.months ?? 12;
  const rev = revenueByMonth(txns, opts.adminUserId);
  const cash = new Map<string, number>();
  for (const rc of recharges || []) {
    if (rechargeBucket(rc.status) !== 'approved') continue;
    if (opts.adminUserId && rc.user_id === opts.adminUserId) continue;
    const amt = toNum(rc.amount);
    const k = istMonthKey(rc.created_at);
    if (amt > 0 && k) cash.set(k, (cash.get(k) ?? 0) + amt);
  }
  const now = currentISTMonth();
  return Array.from({ length: n }, (_, i) => {
    const key = addMonths(now, i - (n - 1));
    const r = rev.get(key);
    const earned = r ? r.gateway + r.wallet : 0;
    return { month: key, label: monthLabel(key), earned: round2(earned), cashIn: round2((cash.get(key) ?? 0) + (r?.gateway ?? 0)) };
  });
}

/** Sum of earned revenue per Indian FY label ('2026-27'), newest first. */
export function revenueByFY(txns: any[], adminUserId?: string): { fy: string; revenue: number; count: number }[] {
  const m = new Map<string, { revenue: number; count: number }>();
  for (const tx of txns || []) {
    if (!isRevenueRow(tx)) continue;
    if (adminUserId && tx.user_id === adminUserId) continue;
    const amt = resolveAmount(tx);
    const fy = fyOf(tx.created_at);
    if (amt <= 0 || !fy) continue;
    const r = m.get(fy) ?? { revenue: 0, count: 0 };
    r.revenue += amt; r.count++;
    m.set(fy, r);
  }
  return [...m.entries()].map(([fy, v]) => ({ fy, revenue: round2(v.revenue), count: v.count })).sort((a, b) => (a.fy < b.fy ? 1 : -1));
}


/* ---------- Revenue split by source (estimates vs service records, gateway vs wallet) ---------- */

export interface SourceAmount { amount: number; count: number }
export interface RevenueSplit {
  estimatesGateway: SourceAmount;
  estimatesWallet: SourceAmount;
  servicesGateway: SourceAmount;
  servicesWallet: SourceAmount;
  /** internal admin account usage – excluded from "public" */
  admin: SourceAmount;
  /** public revenue = the four lines above */
  total: number;
  publicCount: number;
}

const emptySplit = (): RevenueSplit => ({
  estimatesGateway: { amount: 0, count: 0 }, estimatesWallet: { amount: 0, count: 0 },
  servicesGateway: { amount: 0, count: 0 }, servicesWallet: { amount: 0, count: 0 },
  admin: { amount: 0, count: 0 }, total: 0, publicCount: 0,
});

const addToSplit = (r: RevenueSplit, tx: any, amt: number, adminUserId?: string) => {
  let bucket: SourceAmount;
  if (adminUserId && tx.user_id === adminUserId) bucket = r.admin;
  else {
    const svc = isServiceRecord(tx);
    const gw = hasGatewayPayment(tx);
    bucket = svc ? (gw ? r.servicesGateway : r.servicesWallet) : (gw ? r.estimatesGateway : r.estimatesWallet);
    r.total += amt; r.publicCount++;
  }
  bucket.amount += amt; bucket.count++;
};

const finishSplit = (r: RevenueSplit) => {
  for (const k of ['estimatesGateway', 'estimatesWallet', 'servicesGateway', 'servicesWallet', 'admin'] as const) r[k].amount = round2(r[k].amount);
  r.total = round2(r.total);
  return r;
};

/** Earned revenue split by source. `filter` narrows rows (e.g. a period). */
export function revenueBySource(txns: any[], opts: { adminUserId?: string; filter?: (tx: any) => boolean } = {}): RevenueSplit {
  const r = emptySplit();
  for (const tx of txns || []) {
    if (!isRevenueRow(tx) || (opts.filter && !opts.filter(tx))) continue;
    const amt = resolveAmount(tx);
    if (amt > 0) addToSplit(r, tx, amt, opts.adminUserId);
  }
  return finishSplit(r);
}

/** Same split, grouped by IST month ('YYYY-MM'). */
export function revenueSplitByMonth(txns: any[], adminUserId?: string): Map<string, RevenueSplit> {
  const m = new Map<string, RevenueSplit>();
  for (const tx of txns || []) {
    if (!isRevenueRow(tx)) continue;
    const amt = resolveAmount(tx);
    const k = istMonthKey(tx.created_at);
    if (amt <= 0 || !k) continue;
    const r = m.get(k) ?? emptySplit();
    addToSplit(r, tx, amt, adminUserId);
    m.set(k, r);
  }
  m.forEach(finishSplit);
  return m;
}

/* ---------- Reporting periods (IST) ---------- */

export type ReportPeriod = 'day' | 'week' | 'month' | 'fy' | 'year' | 'all';
export const REPORT_PERIOD_LABEL: Record<ReportPeriod, string> = {
  day: 'Today', week: 'Last 7 days', month: 'This month', fy: 'This FY', year: 'Last 12 months', all: 'All time',
};

/** Start of the period as epoch ms (IST midnight based). */
export function periodStartMs(p: ReportPeriod): number {
  const today = istDateKey(new Date().toISOString());
  const dayStart = new Date(`${today}T00:00:00+05:30`).getTime();
  switch (p) {
    case 'day': return dayStart;
    case 'week': return dayStart - 6 * 86400000;
    case 'month': return new Date(`${currentISTMonth()}-01T00:00:00+05:30`).getTime();
    case 'fy': {
      const y = Number(today.slice(0, 4)); const m = Number(today.slice(5, 7));
      return new Date(`${m >= 4 ? y : y - 1}-04-01T00:00:00+05:30`).getTime();
    }
    case 'year': return new Date(`${addMonths(currentISTMonth(), -11)}-01T00:00:00+05:30`).getTime();
    default: return 0;
  }
}

/** Equal-length window immediately before the period (for "vs previous"). null for all-time. */
export function previousWindow(p: ReportPeriod): [number, number] | null {
  if (p === 'all') return null;
  const start = periodStartMs(p);
  const len = Date.now() - start;
  return [start - len, start];
}
