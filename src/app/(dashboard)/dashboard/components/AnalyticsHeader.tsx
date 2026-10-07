'use client';

import { Filter, Calendar, MapPin, Package, RotateCcw } from 'lucide-react';

interface Props {
  data: any[];
  selectedFY: string;
  setSelectedFY: (v: string) => void;
  selectedMonth: string;
  setSelectedMonth: (v: string) => void;
  selectedState: string;
  setSelectedState: (v: string) => void;
  selectedProduct: string;
  setSelectedProduct: (v: string) => void;
}

export default function AnalyticsHeader({
  data,
  selectedFY, setSelectedFY,
  selectedMonth, setSelectedMonth,
  selectedState, setSelectedState,
  selectedProduct, setSelectedProduct,
}: Props) {
  const getFY = (d: Date) => {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return m >= 4 ? `FY${y}-${String(y + 1).slice(-2)}` : `FY${y - 1}-${String(y).slice(-2)}`;
  };

  const fys = Array.from(new Set(data.map(d => getFY(new Date(d.created_date))))).sort().reverse();
  const states = Array.from(new Set(data.map(d => d.state || 'Unknown'))).sort();
  const products = Array.from(new Set(data.map(d => d.case_type || 'NEW CONSTRUCTION'))).sort();
  const months = Array.from(new Set(data.map(d => {
    const dt = new Date(d.created_date);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }))).sort().reverse();

  const monthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[parseInt(mo) - 1]} ${y}`;
  };

  const hasFilters = selectedFY !== 'ALL' || selectedMonth !== 'ALL' ||
                     selectedState !== 'ALL' || selectedProduct !== 'ALL';

  const clearAll = () => {
    setSelectedFY('ALL');
    setSelectedMonth('ALL');
    setSelectedState('ALL');
    setSelectedProduct('ALL');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Filter className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Analytics Filters
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Narrow down your business insights
            </p>
          </div>
        </div>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* FY */}
        <div>
          <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            <Calendar className="w-3 h-3" /> Financial Year
          </label>
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
          >
            <option value="ALL">All FY</option>
            {fys.map(fy => <option key={fy} value={fy}>{fy}</option>)}
          </select>
        </div>

        {/* Month */}
        <div>
          <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            <Calendar className="w-3 h-3" /> Month
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
          >
            <option value="ALL">All Months</option>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>

        {/* State */}
        <div>
          <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            <MapPin className="w-3 h-3" /> State
          </label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
          >
            <option value="ALL">All States</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Product */}
        <div>
          <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            <Package className="w-3 h-3" /> Product
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
          >
            <option value="ALL">All Products</option>
            {products.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}