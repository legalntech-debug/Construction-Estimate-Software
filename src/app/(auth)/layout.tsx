export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 flex justify-center items-center p-0 md:p-6 overflow-x-hidden">
      
      {/* 1. LEFT SIDE PANEL - Mobile par completely hidden rahega, sirf Desktop (lg) par dikhega */}
      <div className="hidden lg:flex flex-col w-72 p-6 space-y-4 text-white border-r border-slate-800/80">
        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
          Services Module
        </h3>
        <div className="space-y-2 text-xs text-slate-300">
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            ⚡ Construction Estimate Engine
          </div>
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            ⚡ Route Map & Key Plan System
          </div>
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            ⚡ Legal Documentation Workflow
          </div>
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            ⚡ Property Valuation Module
          </div>
        </div>
      </div>

      {/* 2. MAIN AUTH FORM AREA - Mobile par 100% full screen aur center alignment rahega */}
      <div className="w-full flex-1 flex flex-col justify-center items-center min-h-[100dvh] md:min-h-0 p-4 sm:p-6 z-10">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>

      {/* 3. RIGHT SIDE PANEL - Mobile par completely hidden rahega, sirf Desktop (lg) par dikhega */}
      <div className="hidden lg:flex flex-col w-72 p-6 space-y-4 text-white border-l border-slate-800/80">
        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
          Offers & Pipeline
        </h3>
        <div className="p-3 bg-slate-900/80 rounded-lg border border-amber-500/30 text-xs">
          <span className="bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] mr-2">
            LIMITED
          </span>
          Get instant estimates at ₹21 launch offer!
        </div>
      </div>

    </div>
  );
}