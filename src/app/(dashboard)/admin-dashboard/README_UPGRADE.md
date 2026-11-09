# Admin Dashboard – upgrade notes

## Setup (3 steps)
1. **Supabase SQL editor** → run `sql/01_run_now.sql` (safe: only creates missing things).
   `sql/02_recharge_functions_AFTER_TRIGGER_REVIEW.sql` must NOT be run until you have checked what the
   `trg_sync_wallet` trigger does (instructions are at the top of that file). Until then recharge
   approvals use the standard (non-atomic) path, same as before.
2. **Crash capture from every page** – in the ROOT layout (client component):
   ```ts
   import { installErrorMonitor } from '@/app/(dashboard)/admin-dashboard/lib/errorMonitor';
   useEffect(() => installErrorMonitor(), []);
   ```
   (The dashboard installs it too, but without this only crashes on this page are logged.)
3. Dependencies used: `lucide-react`, `recharts`.

## Money definitions (lib/finance.ts – used by every screen)
- **Cash in** = approved recharges + direct Razorpay payments
- **Earned revenue** = wallet usage + direct Razorpay payments (estimates + service records)
- **Wallet liability** = balances users still hold with us
- A recharge is NOT revenue until used. Never add recharge + usage.
- **Profit pool** = earned revenue − admin self-usage − fixed overhead (₹10,000/month, from 2026-09).
  Partner payouts distribute the profit; they are not a cost.
- All dates/months/FY are in IST.

## Fixed
- Profit widget: recharges were added on top of usage (double count), service_records were missing,
  `APPROVED` recharges were ignored, 1000-row cap, UTC months, payouts shown as "Less" but not deducted.
- Recharge revoke no longer clamps wallet at 0 (negative = overdrawn/receivable, flagged).
- "0.00% zero crashes" was hardcoded – replaced by real crash log + data-source health.
- Failed data loads no longer silently show ₹0; they appear in System health.

## Not touched / can be deleted
`GatewayRevenueWidget`, `GstIncomeManagementWidget`, `AdminMisFinancialWidget` are no longer used.
Refund, Premium billing, Pricing, RBAC and Create-user widgets keep their own internals (they still use `alert()`).
