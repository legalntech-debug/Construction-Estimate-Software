'use client';

/* ============================================================
   Error / crash monitor
   ------------------------------------------------------------
   Captures software failures anywhere in the app and stores them
   in `system_error_logs` so the admin dashboard can show them:

     • window "error" + "unhandledrejection"      (JS crashes)
     • React render crashes                        (ErrorBoundary)
     • same-origin /api/* responses with HTTP 5xx  (server crashes)
     • failed Supabase queries                     (reportSupabaseError)

   Install once, as early as possible, from a client component that is
   mounted in the ROOT layout (see README_UPGRADE.md):

       import { installErrorMonitor } from '@/app/(dashboard)/admin-dashboard/lib/errorMonitor';
       useEffect(() => installErrorMonitor(), []);

   The monitor never throws and never reports its own failures, so it
   cannot create an error loop.
   ============================================================ */

import { supabase } from '@/lib/supabase';

export type Severity = 'info' | 'warning' | 'error' | 'critical';
export type ErrorSource = 'window' | 'promise' | 'react' | 'api' | 'supabase' | 'manual';

export interface ErrorReport {
  message: string;
  stack?: string | null;
  source: ErrorSource;
  severity?: Severity;
  component?: string | null;
  context?: Record<string, unknown> | null;
}

export const ERROR_TABLE = 'system_error_logs';
const QUEUE_KEY = '__err_queue_v1';
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || null;

const IGNORED = [
  /ResizeObserver loop/i,
  /AbortError/i,
  /The user aborted a request/i,
  /Non-Error promise rejection captured/i,
];

const lastSent = new Map<string, number>();
let sentThisMinute = 0;
let minuteStart = Date.now();
let installed = false;
let flushing = false;

/* ---------- helpers ---------- */

const clip = (s: unknown, n: number): string => String(s ?? '').slice(0, n);

/** Stable id for "the same bug": source + message without volatile numbers/ids + top stack frame */
export function fingerprintOf(r: Pick<ErrorReport, 'message' | 'stack' | 'source' | 'component'>): string {
  const msg = clip(r.message, 300)
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '<id>')
    .replace(/\d+/g, '#');
  const frame = (r.stack || '').split('\n').find((l) => /at |@/.test(l)) || '';
  const raw = `${r.source}|${r.component || ''}|${msg}|${clip(frame.replace(/\d+/g, '#'), 160)}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  return `fp_${(h >>> 0).toString(16)}`;
}

function readQueue(): any[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function writeQueue(q: any[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-50))); } catch { /* storage unavailable */ }
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch { return null; }
}

async function insertRow(row: any): Promise<boolean> {
  try {
    const { error } = await supabase.from(ERROR_TABLE).insert([row]);
    return !error;
  } catch { return false; }
}

async function flushQueue() {
  if (flushing || typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const q = readQueue();
  if (!q.length) return;
  flushing = true;
  try {
    const remaining: any[] = [];
    for (const row of q) {
      if (!(await insertRow(row))) remaining.push(row);
    }
    writeQueue(remaining);
  } finally { flushing = false; }
}

/* ---------- public API ---------- */

export async function reportError(r: ErrorReport): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    const message = clip(r.message || 'Unknown error', 1500);
    if (IGNORED.some((rx) => rx.test(message))) return;

    const fp = fingerprintOf({ ...r, message });
    const now = Date.now();

    // Same bug at most once a minute, and at most 30 reports a minute overall.
    if (now - (lastSent.get(fp) || 0) < 60_000) return;
    if (now - minuteStart > 60_000) { minuteStart = now; sentThisMinute = 0; }
    if (sentThisMinute >= 30) return;
    lastSent.set(fp, now);
    sentThisMinute++;

    const row = {
      fingerprint: fp,
      severity: r.severity ?? (r.source === 'react' ? 'critical' : 'error'),
      source: r.source,
      message,
      stack: r.stack ? clip(r.stack, 6000) : null,
      component: r.component ? clip(r.component, 200) : null,
      url: clip(window.location.pathname + window.location.search, 500),
      user_id: await currentUserId(),
      user_agent: clip(navigator.userAgent, 300),
      app_version: APP_VERSION,
      context: r.context ?? null,
    };

    if (!(await insertRow(row))) {
      writeQueue([...readQueue(), { ...row, created_at: new Date().toISOString() }]);
    }
  } catch { /* the monitor must never throw */ }
}

export function reportSupabaseError(label: string, error: { message?: string; code?: string } | null | undefined, severity: Severity = 'error') {
  if (!error) return;
  void reportError({
    source: 'supabase',
    severity,
    message: `[${label}] ${error.message || 'query failed'}${error.code ? ` (${error.code})` : ''}`,
    component: label,
  });
}

/** Idempotent. Returns an uninstall function (safe to use as a useEffect cleanup). */
export function installErrorMonitor(): () => void {
  if (typeof window === 'undefined' || installed) return () => {};
  installed = true;

  const onError = (e: ErrorEvent) => {
    // Resource load errors (img/script) bubble here without e.error – only report script failures.
    if (!e.error && !e.message) return;
    void reportError({
      source: 'window',
      message: e.message || String(e.error),
      stack: e.error?.stack ?? `${e.filename}:${e.lineno}:${e.colno}`,
    });
  };

  const onRejection = (e: PromiseRejectionEvent) => {
    const reason: any = e.reason;
    void reportError({
      source: 'promise',
      message: reason?.message || (typeof reason === 'string' ? reason : 'Unhandled promise rejection'),
      stack: reason?.stack ?? null,
    });
  };

  const onOnline = () => { void flushQueue(); };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('online', onOnline);

  // Detect server crashes: same-origin /api/* answering 5xx (or the request itself failing).
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const input = args[0];
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    try {
      const res = await originalFetch(...args);
      try {
        const u = new URL(url, window.location.origin);
        if (u.origin === window.location.origin && u.pathname.startsWith('/api/') && res.status >= 500) {
          void reportError({
            source: 'api',
            severity: 'critical',
            message: `API ${res.status} on ${u.pathname}`,
            component: u.pathname,
            context: { status: res.status, method: (args[1]?.method || 'GET') },
          });
        }
      } catch { /* bad URL – ignore */ }
      return res;
    } catch (err: any) {
      try {
        const u = new URL(url, window.location.origin);
        if (u.origin === window.location.origin && u.pathname.startsWith('/api/') && err?.name !== 'AbortError') {
          void reportError({ source: 'api', severity: 'error', message: `API request failed: ${u.pathname} – ${err?.message}`, component: u.pathname });
        }
      } catch { /* ignore */ }
      throw err;
    }
  };

  void flushQueue();

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('online', onOnline);
    window.fetch = originalFetch;
    installed = false;
  };
}
