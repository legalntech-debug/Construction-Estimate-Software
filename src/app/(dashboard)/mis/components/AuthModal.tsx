// src/app/(dashboard)/mis/components/AuthModal.tsx
import { ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  authError: string;
  executeSecureDelete: () => void;
}

export default function AuthModal({
  isOpen,
  setIsOpen,
  confirmPassword,
  setConfirmPassword,
  authError,
  executeSecureDelete,
}: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3">
      <div className="bg-white rounded border border-slate-300 p-4 sm:p-5 w-full max-w-[280px] sm:max-w-xs shadow-xl">
        <div className="flex items-center gap-2 text-red-600 font-black uppercase text-[11px] mb-2">
          <ShieldCheck size={16} />
          <span>Security Validation Check</span>
        </div>
        <p className="text-slate-500 text-[10px] font-medium leading-relaxed mb-3">
          Enter account profile authorization password key to trigger execution flush sequence permanently.
        </p>

        <div className="space-y-2.5">
          <input 
            type="password" 
            placeholder="ENTER ACCESS PASSWORD" 
            value={confirmPassword} 
            onChange={e => setConfirmPassword(e.target.value)} 
            className="w-full border border-slate-300 rounded px-2.5 py-2 sm:py-1.5 text-[11px] font-bold text-slate-800 tracking-wider focus:outline-none focus:border-red-600 bg-slate-50" 
          />
          {authError && <p className="text-red-600 text-[9px] font-black uppercase">⚠️ {authError}</p>}
          <div className="flex gap-2 justify-end text-[10px] sm:text-[9px] font-black uppercase pt-1">
            <button 
              onClick={() => setIsOpen(false)} 
              className="px-3 py-1.5 sm:px-2.5 sm:py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
            >
              Abort
            </button>
            <button 
              onClick={executeSecureDelete} 
              className="px-3 py-1.5 sm:px-2.5 sm:py-1 bg-red-600 hover:bg-red-700 text-white rounded shadow-xs"
            >
              Flush Row
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}