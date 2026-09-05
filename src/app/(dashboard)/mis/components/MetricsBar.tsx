import { DollarSign, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface MetricsBarProps {
  metrics: {
    total: number;
    received: number;
    pending: number;
    waived: number;
  };
}

export default function MetricsBar({ metrics }: MetricsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-white border border-slate-200 px-3 py-3 rounded flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Total Value Stream</span>
          <h2 className="text-base font-black text-slate-900 mt-1">₹{metrics.total.toLocaleString('en-IN')}</h2>
        </div>
        <div className="p-1.5 bg-blue-50 text-blue-700 rounded shrink-0"><DollarSign size={16} /></div>
      </div>

      <div className="bg-white border border-slate-200 px-3 py-3 rounded flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] text-emerald-500 uppercase font-bold tracking-wider">Collections Realized</span>
          <h2 className="text-base font-black text-emerald-600 mt-1">₹{metrics.received.toLocaleString('en-IN')}</h2>
        </div>
        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded shrink-0"><CheckCircle2 size={16} /></div>
      </div>

      <div className="bg-white border border-slate-200 px-3 py-3 rounded flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Waived Revenue</span>
          <h2 className="text-base font-black text-slate-700 mt-1">₹{metrics.waived.toLocaleString('en-IN')}</h2>
        </div>
        <div className="p-1.5 bg-slate-100 text-slate-600 rounded shrink-0"><XCircle size={16} /></div>
      </div>

      <div className="bg-white border border-slate-200 px-3 py-3 rounded flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] text-amber-500 uppercase font-bold tracking-wider">Outstanding Escrow</span>
          <h2 className="text-base font-black text-amber-600 mt-1">₹{metrics.pending.toLocaleString('en-IN')}</h2>
        </div>
        <div className="p-1.5 bg-amber-50 text-amber-600 rounded shrink-0"><Clock size={16} /></div>
      </div>
    </div>
  );
}