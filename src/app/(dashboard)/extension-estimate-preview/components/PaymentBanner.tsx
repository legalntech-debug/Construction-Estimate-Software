// src/app/(dashboard)/extension-estimate-preview/components/PaymentBanner.tsx
"use client";

interface PricingDisplay {
  mrp: number;
  price: number;
  discountEnabled: boolean;
  discountPercent: number;
  savings: number;
  isFromDB: boolean;
}

interface PaymentBannerProps {
  isPaid: boolean;
  isAlreadyPaid: boolean;
  userCategory: string;
  isSaving: boolean;
  pricingLoading: boolean;
  gatewayFeeAmount: number;
  pricingDisplay: PricingDisplay;
  onPrint: () => void;
  onPay: () => void;
  onBack: () => void;
}

export default function PaymentBanner({
  isPaid,
  isAlreadyPaid,
  userCategory,
  isSaving,
  pricingLoading,
  gatewayFeeAmount,
  pricingDisplay,
  onPrint,
  onPay,
  onBack,
}: PaymentBannerProps) {
  const canPrint = isPaid || isAlreadyPaid || userCategory === "ADMIN";
  const showOffer = !canPrint;

  return (
    <div className="mt-8 mb-12 no-print border-t border-slate-200 pt-6">
      {/* ============================================================
          E-COMMERCE STYLE OFFER BANNER (Sirf Unpaid Users ke liye)
      ============================================================ */}
      {showOffer && (
        <div className="mb-4 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border-2 border-dashed border-amber-400 rounded-xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left Side: Offer Title */}
          <div className="flex items-center gap-3">
            <span className="bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded shadow uppercase tracking-wider animate-pulse">
              ⚡ LIMITED TIME DEAL
            </span>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 uppercase">
                Professional Extension Estimate & Verified Report
              </h4>
              <p className="text-xs text-slate-600 font-medium">
                Includes Instant PDF Download, Digital Sealing & Verification QR Code.
              </p>
            </div>
          </div>

          {/* Right Side: Dynamic Price Box */}
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-amber-200 shadow-inner">
            <div className="text-right">
              {pricingLoading ? (
                <span className="text-xs text-slate-500 font-bold">
                  Loading price...
                </span>
              ) : (
                <>
                  {pricingDisplay.discountEnabled &&
                    pricingDisplay.discountPercent > 0 && (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-gray-400 line-through font-semibold">
                          ₹ {pricingDisplay.mrp}/-
                        </span>
                        <span className="bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {pricingDisplay.discountPercent}% OFF
                        </span>
                      </div>
                    )}
                  <div className="text-lg font-black text-emerald-600 leading-tight">
                    ₹ {pricingDisplay.price}{" "}
                    <span className="text-xs font-bold text-slate-700">
                      Only
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          ACTION BUTTONS ROW
      ============================================================ */}
      <div className="flex flex-wrap items-center justify-start gap-6">
        {canPrint ? (
          <button
            onClick={onPrint}
            disabled={isSaving}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg shadow-md hover:bg-blue-700 transition font-bold uppercase tracking-wide flex items-center gap-2"
          >
            {isSaving ? "SAVING..." : "🖨️ PRINT ESTIMATE"}
          </button>
        ) : (
          <button
            onClick={onPay}
            disabled={pricingLoading}
            className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-8 py-3 rounded-lg shadow-lg hover:from-emerald-700 hover:to-green-700 transition font-extrabold uppercase tracking-wide flex items-center gap-2 text-base animate-bounce disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pricingLoading
              ? "⏳ LOADING PRICE..."
              : `🚀 PAY TO PRINT (₹${gatewayFeeAmount})`}
          </button>
        )}

        <button
          onClick={onBack}
          className="bg-slate-700 text-white px-8 py-3 rounded-lg shadow-md hover:bg-slate-800 transition font-bold uppercase tracking-wide"
        >
          ⬅️ BACK TO INPUT
        </button>
      </div>
    </div>
  );
}