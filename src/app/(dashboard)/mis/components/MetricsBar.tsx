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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div className="bg-white border border-slate-200 px-4 py-3 rounded flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Total Value Stream</span>
          <h2 className="text-lg font-black text-slate-900">₹{metrics.total.toLocaleString('en-IN')}</h2>
        </div>
        <div className="p-1.5 bg-blue-50 text-blue-700 rounded"><DollarSign size={16} /></div>
      </div>

      <div className="bg-white border border-slate-200 px-4 py-3 rounded flex items-center justify-between">
        <div>
          <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-widest">Collections Realized</span>
          <h2 className="text-lg font-black text-emerald-600">₹{metrics.received.toLocaleString('en-IN')}</h2>
        </div>
        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded"><CheckCircle2 size={16} /></div>
      </div>

      <div className="bg-white border border-slate-200 px-4 py-3 rounded flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Waived Revenue</span>
          <h2 className="text-lg font-black text-slate-700">₹{metrics.waived.toLocaleString('en-IN')}</h2>
        </div>
        <div className="p-1.5 bg-slate-100 text-slate-600 rounded"><XCircle size={16} /></div>
      </div>

      <div className="bg-white border border-slate-200 px-4 py-3 rounded flex items-center justify-between">
        <div>
          <span className="text-[10px] text-amber-500 uppercase font-bold tracking-widest">Outstanding Escrow</span>
          <h2 className="text-lg font-black text-amber-600">₹{metrics.pending.toLocaleString('en-IN')}</h2>
        </div>
        <div className="p-1.5 bg-amber-50 text-amber-600 rounded"><Clock size={16} /></div>
      </div>
    </div>
  );
}