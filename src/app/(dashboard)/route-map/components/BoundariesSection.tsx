"use client";
// Four plot boundaries and the optional length (ft) of every side.
import type { Boundaries } from "../formTypes";
import { BOUNDARY_ROWS } from "../formConstants";

interface BoundariesSectionProps {
  // True once the geo coordinate is filled; the section stays locked until then
  isGeoFilled: boolean;
  boundaries: Boundaries;
  sideDims: Boundaries;
  handleBoundaryChange: (key: keyof Boundaries, value: string) => void;
  handleSideDimChange: (key: keyof Boundaries, value: string) => void;
}

export default function BoundariesSection({ isGeoFilled, boundaries, sideDims, handleBoundaryChange, handleSideDimChange }: BoundariesSectionProps) {
  return (
    <>
        <div className={`mt-4 border border-black rounded-none overflow-hidden ${!isGeoFilled ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="bg-[#1e293b] text-white py-2.5 font-bold uppercase tracking-wider text-center text-sm sm:text-lg">PLOT BOUNDARIES &amp; SIDE LENGTHS (ACTUAL)</div>
          <div className="grid grid-cols-12 border-b border-black bg-gray-100 text-[10px] sm:text-sm font-bold text-center">
            <span className="col-span-3 sm:col-span-2 p-1.5 border-r border-black">SIDE</span>
            <span className="col-span-6 sm:col-span-7 p-1.5 border-r border-black">BOUNDARY (WHAT IS ON THAT SIDE)</span>
            <span className="col-span-3 p-1.5">LENGTH (FT, OPTIONAL)</span>
          </div>
          <div className="flex flex-col">
            {BOUNDARY_ROWS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-12 items-center border-b border-black last:border-b-0 bg-white">
                <span className="col-span-3 sm:col-span-2 font-bold text-black uppercase text-xs sm:text-lg p-2.5 text-center border-r border-black">{label}</span>
                <input
                  type="text"
                  disabled={!isGeoFilled}
                  value={boundaries[key]}
                  onChange={(e) => handleBoundaryChange(key, e.target.value)}
                  placeholder="e.g. HOUSE OF DYARAM SINGH / 20 FT WIDE ROAD"
                  className="col-span-6 sm:col-span-7 w-full bg-transparent outline-none p-2.5 text-xs sm:text-lg uppercase placeholder:text-gray-400 placeholder:normal-case border-r border-black"
                />
                <div className="col-span-3 relative flex items-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={!isGeoFilled}
                    value={sideDims[key]}
                    onChange={(e) => handleSideDimChange(key, e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-transparent outline-none p-2.5 pr-8 text-xs sm:text-lg text-center placeholder:text-gray-400"
                  />
                  <span className="absolute right-2 text-[9px] sm:text-sm font-bold pointer-events-none">FT</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-1 text-[10px] sm:text-xs normal-case text-gray-600">
          Write ROAD in the boundary of the side that faces the road: the preview shows that side at the bottom. Side lengths are
          drawn as dimension lines and set the real size of the plot box on the route map.
        </p>
    </>
  );
}
