'use client';

import { OfferData } from './useStateWiseOffer';

interface OfferPopupProps {
  isOpen: boolean;
  onClose: () => void;
  offerData: OfferData | null;
}

export default function OfferPopup({
  isOpen,
  onClose,
  offerData,
}: OfferPopupProps) {
  if (!isOpen || !offerData) return null;

  // ✅ Build service list dynamically
  const services = [
    {
      key: 'estimate',
      label: 'ESTIMATE',
      mrp: offerData.estimate_mrp,
      price: offerData.estimate_price,
    },
    offerData.drafting_mrp > 0 && {
      key: 'drafting',
      label: 'DRAFTING',
      mrp: offerData.drafting_mrp,
      price: offerData.drafting_price,
    },
    offerData.map_mrp > 0 && {
      key: 'map',
      label: 'MAP',
      mrp: offerData.map_mrp,
      price: offerData.map_price,
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    mrp: number;
    price: number;
  }>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden relative animate-fadeIn max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-5 sm:p-6 text-center relative">
          <span className="inline-block bg-yellow-400 text-blue-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
            {offerData.source === 'GENERAL'
              ? '🌟 All India Special Offer'
              : `🌟 ${offerData.state_name} Special Offer`}
          </span>
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wide">
            Special Estimate Offer
          </h3>
          <p className="text-blue-100 text-xs mt-1">
            {offerData.source === 'GENERAL'
              ? 'Exclusive Pan-India offer for you!'
              : `Exclusive offer for ${offerData.state_name} region!`}
          </p>
        </div>

        <div className="p-4 sm:p-6">
          {/* ✅ SERVICE-WISE TABLE */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 mb-4 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 bg-blue-900 text-white text-[10px] font-black uppercase tracking-wider">
              <div className="p-2.5 text-left">Service</div>
              <div className="p-2.5 text-center border-l border-blue-700">MRP</div>
              <div className="p-2.5 text-center border-l border-blue-700">Offer Price</div>
            </div>

            {/* Rows */}
            {services.map((svc) => (
              <div
                key={svc.key}
                className="grid grid-cols-3 border-t border-gray-200 text-xs"
              >
                <div className="p-2.5 font-black text-slate-800 uppercase tracking-wide">
                  {svc.label}
                </div>
                <div className="p-2.5 text-center border-l border-gray-200 text-gray-500 line-through font-semibold">
                  ₹{svc.mrp}
                </div>
                <div className="p-2.5 text-center border-l border-gray-200 text-emerald-600 font-black">
                  ₹{svc.price}
                </div>
              </div>
            ))}

            {/* TOTAL Row */}
            <div className="grid grid-cols-3 border-t-2 border-blue-900 bg-yellow-50">
              <div className="p-2.5 font-black text-blue-900 uppercase text-xs">
                TOTAL
              </div>
              <div className="p-2.5 text-center border-l border-blue-200 text-gray-500 line-through font-black">
                ₹{offerData.total_mrp}
              </div>
              <div className="p-2.5 text-center border-l border-blue-200 text-emerald-700 font-black text-sm">
                ₹{offerData.total_price}
              </div>
            </div>
          </div>

          {/* Discount Badge */}
          <div className="text-center bg-yellow-50 rounded-lg py-2 border border-yellow-200 mb-4">
            <p className="text-yellow-700 text-xs uppercase font-black">
              🎉 You Save ₹{offerData.total_mrp - offerData.total_price} — {offerData.discount_percent}% OFF
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {services.length} Services Included
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-3 mb-5">
            {[
              'Complete Estimate & Drafting Report',
              'Map & Location Plan',
                'Expert Guidance & Support',
            ].map((text) => (
              <div key={text} className="flex items-center gap-3 text-xs sm:text-sm text-gray-700">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onClose}
            className="w-full bg-blue-900 text-white font-bold py-3 rounded-lg hover:bg-blue-800 transition shadow-lg text-sm uppercase tracking-wide"
          >
            Claim All for ₹{offerData.total_price}
          </button>
          <p className="text-center text-[10px] text-gray-400 mt-3">
            *Offer valid for {offerData.state_name} · Terms &amp; Conditions Apply
          </p>
        </div>
      </div>
    </div>
  );
}