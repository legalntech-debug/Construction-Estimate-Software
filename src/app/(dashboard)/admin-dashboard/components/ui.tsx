'use client';

import React, { useCallback, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';

/* ============================================================
   Small design system for the admin dashboard
   Neutral slate surfaces, one accent (blue), semantic colours
   only for status (green / amber / red).
   ============================================================ */

export type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';

const toneText: Record<Tone, string> = {
  neutral: 'text-slate-900',
  positive: 'text-emerald-700',
  negative: 'text-rose-700',
  warning: 'text-amber-700',
  info: 'text-blue-700',
};

const toneBadge: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  positive: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  negative: 'bg-rose-50 text-rose-700 ring-rose-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ring-inset ${toneBadge[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Card({
  title, subtitle, actions, children, className = '', bodyClassName = 'p-5',
}: {
  title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode;
  children: React.ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Stat({
  label, value, hint, tone = 'neutral', icon, className = '',
}: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: Tone; icon?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${toneText[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-blue-700 text-white hover:bg-blue-800 border-blue-700',
  secondary: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600',
};

export function Btn({
  variant = 'secondary', size = 'md', className = '', ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
      } ${btnStyles[variant]} ${className}`}
    />
  );
}

export function Segmented<T extends string>({
  value, onChange, options, className = '',
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={`inline-flex rounded-lg bg-slate-100 p-0.5 ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap ${
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const inputCls =
  'h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

export const thCls = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 first:rounded-l-lg last:rounded-r-lg whitespace-nowrap';
export const tdCls = 'px-3 py-2.5 text-sm text-slate-700 align-middle';

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

/* ---------- Toasts (replace blocking alert()) ---------- */

export type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface ToastItem { id: number; kind: ToastKind; text: string }

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((p) => p.filter((t) => t.id !== id)), []);

  const notify = useCallback((text: string, kind: ToastKind = 'info', ms = 5000) => {
    const id = ++seq.current;
    setItems((p) => [...p.slice(-3), { id, kind, text }]);
    if (ms > 0) setTimeout(() => dismiss(id), ms);
  }, [dismiss]);

  const view = (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]" aria-live="polite">
      {items.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : t.kind === 'warning' ? AlertTriangle : Info;
        const color =
          t.kind === 'success' ? 'text-emerald-600' : t.kind === 'error' ? 'text-rose-600' : t.kind === 'warning' ? 'text-amber-600' : 'text-blue-600';
        return (
          <div key={t.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
            <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${color}`} />
            <p className="text-sm text-slate-800 flex-1 break-words">{t.text}</p>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );

  return { notify, toastView: view };
}

/* ---------- CSV helper (Excel-safe: BOM + proper quoting) ---------- */

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    // neutralise spreadsheet formula injection
    const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
