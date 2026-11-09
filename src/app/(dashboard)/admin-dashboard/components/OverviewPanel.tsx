'use client';

import React, { useMemo } from 'react';
import {
  AlertOctagon, AlertTriangle, ArrowDownToLine, ArrowRight, CheckCircle2, IndianRupee, PiggyBank,
  ReceiptText, TrendingDown, TrendingUp, Users, Wallet, Zap,
} from 'lucide-react';
import InactiveUsersModal from '@/app/components/InactiveUsersModal';
import {
  buildMonthlyTrend, computeWalletSummary, currentISTMonth, EXCLUDED_ADMIN_USER_ID, inr, inr0, monthLabel,
  rechargeBucket, revenueByMonth, toNum, addMonths, type RevenueTxn,
} from '../lib/finance';
import RevenueTrendChart from './RevenueTrendChart';
import type { HealthStats } from './SystemHealthPanel';
import { Btn, Card, Stat } from './ui';

interface Props {
  txns: RevenueTxn[];
  recharges: any[];
  profiles: any[];
  ledger: any[];
  ledgerOk: boolean;
  refundRequests: any[];
  health: HealthStats | null;
  failedSources: number;
  totalUsers: number;
  onlineCount: number;
  inactiveUsers: any[];
  onNavigate: (tab: string) => void;
}

const delta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

function Delta({ cur, prev, label }: { cur: number; prev: number; label: string }) {
  const d = delta(cur, prev);
  if (d === null) return <span>{label}: no data last month</span>;
  const up = d >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 ${up ? 'text-emerald-700' : 'text-rose-700'}`}>
      <Icon className="h-3.5 w-3.5" />
      {up ? '+' : ''}{d.toFixed(1)}% {label}
    </span>
  );
}

export default function OverviewPanel({
  txns, recharges, profiles, ledger, ledgerOk, refundRequests, health, failedSources, totalUsers, onlineCount, inactiveUsers, onNavigate,
}: Props) {
  const thisMonth = currentISTMonth();
  const lastMonth = addMonths(thisMonth, -1);

  const trend = useMemo(() => buildMonthlyTrend(txns, recharges, { adminUserId: EXCLUDED_ADMIN_USER_ID, months: 12 }), [txns, recharges]);
  const rev = useMemo(() => revenueByMonth(txns, EXCLUDED_ADMIN_USER_ID), [txns]);
  const cur = rev.get(thisMonth);
  const prev = rev.get(lastMonth);
  const earnedNow = (cur?.gateway ?? 0) + (cur?.wallet ?? 0);
  const earnedPrev = (prev?.gateway ?? 0) + (prev?.wallet ?? 0);
  const cashNow = trend[trend.length - 1]?.cashIn ?? 0;
  const cashPrev = trend[trend.length - 2]?.cashIn ?? 0;

  const wallet = useMemo(
    () => computeWalletSummary({ recharges, profiles, ledger, ledgerOk, walletPaidTxns: txns, excludeUserIds: [EXCLUDED_ADMIN_USER_ID] }),
    [recharges, profiles, ledger, ledgerOk, txns]
  );

  const pendingRecharge = useMemo(() => {
    let n = 0, amt = 0;
    recharges.forEach((r) => { if (rechargeBucket(r.status) === 'pending') { n++; amt += toNum(r.amount); } });
    return { n, amt };
  }, [recharges]);

  const pendingRefunds = useMemo(
    () => refundRequests.filter((r) => ['PENDING', ''].includes(String(r.status ?? '').trim().toUpperCase())).length,
    [refundRequests]
  );

  /* ---- "needs your attention" list ---- */
  const attention: { key: string; tone: 'red' | 'amber'; text: string; tab: string; cta: string }[] = [];
  if (health && health.critical24h > 0)
    attention.push({ key: 'crit', tone: 'red', text: `${health.critical24h} critical error${health.critical24h > 1 ? 's' : ''} in the last 24 hours`, tab: 'health', cta: 'Investigate' });
  if (failedSources > 0)
    attention.push({ key: 'src', tone: 'red', text: `${failedSources} data source${failedSources > 1 ? 's' : ''} failed to load – some numbers may be incomplete`, tab: 'health', cta: 'View details' });
  if (health && health.critical24h === 0 && health.open24h > 0)
    attention.push({ key: 'err', tone: 'amber', text: `${health.open24h} unresolved error${health.open24h > 1 ? 's' : ''} in the last 24 hours`, tab: 'health', cta: 'Review' });
  if (pendingRecharge.n > 0)
    attention.push({ key: 'rch', tone: 'amber', text: `${pendingRecharge.n} wallet recharge${pendingRecharge.n > 1 ? 's' : ''} awaiting approval (${inr0(pendingRecharge.amt)})`, tab: 'recharges', cta: 'Review' });
  if (pendingRefunds > 0)
    attention.push({ key: 'ref', tone: 'amber', text: `${pendingRefunds} refund request${pendingRefunds > 1 ? 's' : ''} pending`, tab: 'refunds', cta: 'Review' });
  if (wallet.usersFlagged > 0)
    attention.push({ key: 'wal', tone: 'amber', text: `${wallet.usersFlagged} wallet${wallet.usersFlagged > 1 ? 's' : ''} need review (overdrawn or balance mismatch)`, tab: 'wallet', cta: 'Open wallets' });

  const usedPct = Math.min(100, wallet.usagePct);

  return (
    <div className="space-y-6">
      {/* Attention */}
      {attention.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">All clear</p>
            <p className="text-sm opacity-90">No pending approvals, no unresolved errors, every data source loaded.</p>
          </div>
        </div>
      ) : (
        <Card title="Needs your attention" subtitle={`${attention.length} item${attention.length > 1 ? 's' : ''}`} bodyClassName="p-0">
          <ul className="divide-y divide-slate-100">
            {attention.map((a) => (
              <li key={a.key} className="flex items-center gap-3 px-5 py-3">
                {a.tone === 'red'
                  ? <AlertOctagon className="h-4 w-4 text-rose-600 shrink-0" />
                  : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
                <p className="flex-1 text-sm text-slate-800">{a.text}</p>
                <Btn size="sm" onClick={() => onNavigate(a.tab)}>{a.cta} <ArrowRight className="h-3.5 w-3.5" /></Btn>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Wallet position */}
      <section aria-label="Wallet position" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Customer wallet position</h2>
            <p className="text-xs text-slate-500">How much users deposited, how much they have used, and what we hold for them. Internal admin account excluded.</p>
          </div>
          <Btn size="sm" onClick={() => onNavigate('wallet')}>Per-user statement <ArrowRight className="h-3.5 w-3.5" /></Btn>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Total recharged" value={inr0(wallet.totalRecharged)} tone="info" icon={<ArrowDownToLine className="h-4 w-4" />} hint={`${wallet.rechargeCount} approved recharges`} />
          <Stat label="Used by users" value={inr0(wallet.totalUsed)} icon={<ReceiptText className="h-4 w-4" />} hint={`${wallet.usagePct.toFixed(1)}% of recharged`} />
          <Stat label="Remaining with us" value={inr0(wallet.remainingBalance)} tone="positive" icon={<PiggyBank className="h-4 w-4" />} hint={`${wallet.usersWithBalance} users hold a balance`} />
          <Stat
            label="Net held for users" value={inr0(wallet.netHeld)} icon={<Wallet className="h-4 w-4" />}
            tone={wallet.receivable > 0 ? 'warning' : 'neutral'}
            hint={wallet.receivable > 0 ? `after ${inr0(wallet.receivable)} overdrawn (receivable)` : 'Liability – not yet earned'}
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between text-xs text-slate-600 mb-2">
            <span>Used {inr0(wallet.totalUsed)}</span>
            <span>Refunded {inr0(wallet.totalRefunded)}</span>
            <span>Remaining {inr0(wallet.remainingBalance)}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex" role="img" aria-label={`${usedPct.toFixed(0)} percent of recharged money has been used`}>
            <div className="bg-blue-600" style={{ width: `${usedPct}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {wallet.usedSource === 'ledger'
              ? 'Usage comes from the wallet ledger.'
              : 'Wallet ledger unavailable – usage estimated from wallet-paid estimates.'}
            {wallet.bonusAndAdjustments > 0 && <> Includes {inr0(wallet.bonusAndAdjustments)} of bonus / manual credits that did not come via recharge.</>}
          </p>
        </div>
      </section>

      {/* This month */}
      <section aria-label="This month" className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">This month · {monthLabel(thisMonth)} <span className="font-normal text-slate-500">(India time)</span></h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="Earned revenue" value={inr0(earnedNow)} tone="info" icon={<IndianRupee className="h-4 w-4" />}
            hint={<Delta cur={earnedNow} prev={earnedPrev} label="vs last month" />}
          />
          <Stat
            label="Cash received" value={inr0(cashNow)} icon={<ArrowDownToLine className="h-4 w-4" />}
            hint={<Delta cur={cashNow} prev={cashPrev} label="vs last month" />}
          />
          <Stat label="Direct (Razorpay)" value={inr0(cur?.gateway ?? 0)} icon={<Zap className="h-4 w-4" />} hint="Paid online per case" />
          <Stat label="From wallet usage" value={inr0(cur?.wallet ?? 0)} icon={<Wallet className="h-4 w-4" />} hint="Deducted from recharged balance" />
        </div>
        <Card
          title="Earned revenue vs cash received"
          subtitle="Cash received = approved recharges + direct payments. Earned = wallet usage + direct payments. Recharges are not revenue until used."
        >
          <RevenueTrendChart data={trend} />
        </Card>
      </section>

      {/* Users */}
      <section aria-label="Users" className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Users</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="Registered users" value={totalUsers.toLocaleString('en-IN')} icon={<Users className="h-4 w-4" />} />
          <Stat label="Online now" value={onlineCount.toLocaleString('en-IN')} tone={onlineCount ? 'positive' : 'neutral'} hint="Active session in user_status" />
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
            <InactiveUsersModal users={Array.isArray(inactiveUsers) ? inactiveUsers : []} />
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Last 12 months earned: {inr(trend.reduce((s, t) => s + t.earned, 0))} · cash received: {inr(trend.reduce((s, t) => s + t.cashIn, 0))}
      </p>
    </div>
  );
}
