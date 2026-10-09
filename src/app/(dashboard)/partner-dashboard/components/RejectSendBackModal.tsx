'use client';

import { useState } from 'react';
import { X, AlertTriangle, RotateCcw, XCircle, Send } from 'lucide-react';

interface RejectSendBackModalProps {
  partnerName: string;
  action: 'REJECT' | 'SEND_BACK';
  onClose: () => void;
  onConfirm: (reasonCode: string, reasonText: string, customText: string) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════
// REASON DROPDOWN OPTIONS
// ═══════════════════════════════════════════════════════════════
const REJECT_REASONS = [
  { code: 'FAKE_DOCS', label: 'Fake / Forged Documents' },
  { code: 'INVALID_AADHAAR', label: 'Invalid Aadhaar Number' },
  { code: 'INVALID_PAN', label: 'Invalid PAN Card' },
  { code: 'DUPLICATE_ACCOUNT', label: 'Duplicate Account' },
  { code: 'UNDER_AGE', label: 'Under Age (Below 18)' },
  { code: 'INVALID_BANK', label: 'Invalid Bank Details' },
  { code: 'BLACKLISTED', label: 'Blacklisted / Fraud History' },
  { code: 'INCOMPLETE_KYC', label: 'Incomplete KYC' },
  { code: 'CUSTOM', label: 'Other (Please Specify)' },
];

const SEND_BACK_REASONS = [
  { code: 'INVALID_AADHAAR', label: 'Aadhaar Number Incorrect' },
  { code: 'INVALID_PAN', label: 'PAN Card Details Wrong' },
  { code: 'INVALID_BANK', label: 'Bank Account / IFSC Incorrect' },
  { code: 'WRONG_DOB', label: 'Date of Birth Incorrect' },
  { code: 'WRONG_COVERAGE', label: 'Coverage Location Wrong' },
  { code: 'NOMINEE_DETAILS', label: 'Nominee Details Incorrect' },
  { code: 'BANK_PROOF_MISSING', label: 'Bank Proof Missing' },
  { code: 'ADDRESS_MISMATCH', label: 'Address Mismatch' },
  { code: 'CUSTOM', label: 'Other (Please Specify)' },
];

export default function RejectSendBackModal({
  partnerName,
  action,
  onClose,
  onConfirm,
}: RejectSendBackModalProps) {
  const [reasonCode, setReasonCode] = useState('');
  const [customText, setCustomText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reasons = action === 'REJECT' ? REJECT_REASONS : SEND_BACK_REASONS;
  const isCustom = reasonCode === 'CUSTOM';

  const handleSubmit = async () => {
    setError('');

    if (!reasonCode) {
      setError('Please select a reason.');
      return;
    }

    if (isCustom && !customText.trim()) {
      setError('Please write custom reason.');
      return;
    }

    const selectedReason = reasons.find((r) => r.code === reasonCode);
    const finalReasonText = isCustom
      ? customText.trim()
      : (selectedReason?.label || '');

    setSubmitting(true);
    try {
      await onConfirm(reasonCode, finalReasonText, customText.trim());
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const isReject = action === 'REJECT';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 font-sans uppercase">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl">

        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className={`text-sm font-black flex items-center gap-2 ${
            isReject ? 'text-red-400' : 'text-amber-400'
          }`}>
            {isReject ? <XCircle size={16} /> : <RotateCcw size={16} />}
            {isReject ? 'REJECT PARTNER' : 'SEND BACK FOR CORRECTION'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            disabled={submitting}
          >
            <X size={16} />
          </button>
        </div>

        {/* PARTNER INFO */}
        <div className={`p-3 rounded-xl border ${
          isReject
            ? 'bg-red-950/40 border-red-800/60'
            : 'bg-amber-950/40 border-amber-800/60'
        }`}>
          <p className="text-[10px] font-bold text-slate-400 mb-1">
            {isReject ? 'REJECTING PARTNER:' : 'SENDING BACK PARTNER:'}
          </p>
          <p className="text-white font-bold text-sm">{partnerName}</p>
        </div>

        {/* EXPLANATION */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-400">
            {isReject
              ? '⚠️ Partner ko permanently reject kiya jayega. Woh phir se apply nahi kar sakta.'
              : '📝 Partner ko correction ke liye wapas bheja jayega. Woh details update karke phir se submit kar sakta hai.'}
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="bg-red-950/80 border border-red-800 text-red-300 text-[11px] p-2.5 rounded-xl font-bold flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* REASON DROPDOWN */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1">
            SELECT REASON *
          </label>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            disabled={submitting}
            className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">-- Choose reason --</option>
            {reasons.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* CUSTOM TEXT (only if CUSTOM selected) */}
        {isCustom && (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">
              CUSTOM REASON *
            </label>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              disabled={submitting}
              rows={3}
              maxLength={300}
              placeholder="Write custom reason here..."
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {customText.length}/300 characters
            </p>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !reasonCode}
            className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
              isReject
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            {submitting ? (
              'PROCESSING...'
            ) : (
              <>
                {isReject ? <XCircle size={14} /> : <Send size={14} />}
                {isReject ? 'CONFIRM REJECT' : 'SEND BACK'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}