'use client';

import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { reportError } from '../lib/errorMonitor';

interface Props {
  /** Human-readable widget name – stored with the crash report */
  name: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Isolates a crash to one widget: the rest of the dashboard keeps working,
 * the crash is written to system_error_logs, and the admin can retry.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void reportError({
      source: 'react',
      severity: 'critical',
      message: error?.message || 'Component render crashed',
      stack: `${error?.stack || ''}\n--- component stack ---${info?.componentStack || ''}`,
      component: this.props.name,
    });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-rose-900">“{this.props.name}” stopped working</p>
          <p className="text-xs text-rose-700 mt-1 break-words">{this.state.error.message}</p>
          <p className="text-xs text-rose-600 mt-1">This crash has been logged in System Health. The rest of the dashboard is unaffected.</p>
        </div>
        <button
          onClick={() => this.setState({ error: null })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
        >
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }
}
