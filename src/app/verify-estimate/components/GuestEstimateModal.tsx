'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type ServiceType = 'estimate' | 'map' | 'drafting' | null;

const SERVICE_OPTIONS = [
  {
    id: 'estimate' as const,
    title: 'Estimate',
    price: '₹1000',
    icon: '🏗️',
    desc: 'Full construction cost estimate with material breakup',
    route: '/estimate',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'map' as const,
    title: 'Map / Location Plan',
    price: '₹1500',
    icon: '🗺️',
    desc: 'Site map, location plan & layout drawing',
    route: '/map',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'drafting' as const,
    title: 'Deed Drafting',
    price: '₹300',
    icon: '📜',
    desc: 'Property deed draft with legal formatting',
    route: '/deed',
    color: 'from-purple-500 to-pink-600',
  },
];

export default function GuestEstimateModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [selectedService, setSelectedService] = useState<ServiceType>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  // Reset on close/open
  useEffect(() => {
    if (isOpen) {
      setSelectedService(null);
      setStep('select');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleServiceSelect = (serviceId: ServiceType) => {
    setSelectedService(serviceId);
    setStep('confirm');
  };

  const handleProceed = () => {
    if (!selectedService) return;

    const service = SERVICE_OPTIONS.find((s) => s.id === selectedService);
    if (!service) return;

    // ✅ Guest mode flags set karo
    localStorage.setItem('GUEST_MODE', 'true');
    localStorage.setItem('GUEST_SERVICE_TYPE', selectedService);
    localStorage.setItem('GUEST_PRICE', service.price.replace('₹', ''));

    // ✅ Existing form route pe redirect karo — guest mode me khulega
    router.push(service.route);
    onClose();
  };

  const handleBack = () => {
    setSelectedService(null);
    setStep('select');
  };

  const handleClose = () => {
    setSelectedService(null);
    setStep('select');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden relative animate-fadeIn my-6 max-h-[90vh] overflow-y-auto">

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-5 sm:p-6 text-center relative">
          <span className="inline-block bg-yellow-400 text-slate-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
            ⭐ No Registration Required
          </span>
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wide">
            🆕 Book Guest Service
          </h3>
          <p className="text-emerald-100 text-xs mt-1">
            {step === 'select'
              ? 'Choose a service to continue'
              : 'Confirm your selection'}
          </p>
        </div>

        <div className="p-5 sm:p-6">

          {/* ═══ STEP 1: SERVICE SELECTION ═══ */}
          {step === 'select' && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                Select Service Type
              </p>

              {SERVICE_OPTIONS.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleServiceSelect(service.id)}
                  className={`w-full text-left bg-gradient-to-br ${service.color} text-white rounded-xl p-4 shadow-lg hover:scale-[1.02] transition-all duration-300 group relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />

                  <div className="relative z-10 flex items-center gap-4">
                    <div className="text-3xl shrink-0">{service.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-black uppercase tracking-tight text-sm">
                          {service.title}
                        </h4>
                        <span className="text-sm font-black bg-white/20 px-2 py-0.5 rounded whitespace-nowrap">
                          {service.price}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90 leading-snug">
                        {service.desc}
                      </p>
                    </div>
                    <span className="text-2xl font-black group-hover:translate-x-1 transition-transform shrink-0">
                      →
                    </span>
                  </div>
                </button>
              ))}

              <div className="mt-5 pt-4 border-t border-gray-200 text-center">
                <p className="text-[10px] text-gray-400">
                  🔒 Secure payment • No signup • Instant delivery
                </p>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: CONFIRMATION ═══ */}
          {step === 'confirm' && selectedService && (
            <div className="space-y-4">
              {(() => {
                const service = SERVICE_OPTIONS.find((s) => s.id === selectedService);
                if (!service) return null;

                return (
                  <>
                    <div className={`bg-gradient-to-br ${service.color} text-white rounded-xl p-5 shadow-lg`}>
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">{service.icon}</div>
                        <div>
                          <h4 className="font-black uppercase text-base">{service.title}</h4>
                          <p className="text-2xl font-black mt-1">{service.price}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-blue-900 uppercase mb-2">
                        📋 What happens next?
                      </p>
                      <ul className="text-[11px] text-gray-700 space-y-1.5">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">1.</span>
                          <span>Fill the simple form (no login needed)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">2.</span>
                          <span>Pay securely via UPI / Bank Transfer</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">3.</span>
                          <span>Download your report after approval</span>
                        </li>
                      </ul>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleBack}
                        className="flex-1 border-2 border-gray-300 text-gray-700 px-4 py-3 rounded-lg font-bold text-xs uppercase tracking-wide hover:bg-gray-50 transition"
                      >
                        ← Change
                      </button>
                      <button
                        onClick={handleProceed}
                        className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-3 rounded-lg font-black text-xs uppercase tracking-wide hover:from-emerald-700 hover:to-teal-700 transition shadow-lg flex items-center justify-center gap-2"
                      >
                        Start Now →
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}