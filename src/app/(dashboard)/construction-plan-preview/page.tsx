"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { generateCompleteConstructionPlan } from "@/lib/constructionPlan/planGenerator";
import { generateCadVectorBlueprint } from "@/lib/constructionPlan/cad/cadRenderer";
import { calculateDoorsAndWindows } from "@/lib/constructionPlan/doorWindowRules";

export default function ConstructionPlanPreviewPage() {
  const router = useRouter();
  const [sheetData, setSheetData] = useState<any>(null);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [cadBlueprint, setCadBlueprint] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(0.85);
  const [selectedFloorModal, setSelectedFloorModal] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const previewData = localStorage.getItem("estimatePreview");
      if (!previewData) {
        router.push("/construction-plan");
        return;
      }

      const parsed = JSON.parse(previewData);
      setSheetData(parsed);
      
      const completePlan = generateCompleteConstructionPlan(parsed);
      setGeneratedPlan(completePlan);

      const blueprint = generateCadVectorBlueprint(
        parsed.dimensions || { A: 20, B: 20, C: 40, D: 40 }, 
        completePlan.footprint,
        parsed.floor_details || {}
      );
      setCadBlueprint(blueprint);
    } catch (err: any) {
      console.error("Failed to parse sheet preview data:", err);
      setError(err?.message || "An error occurred while loading the plan.");
    }
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black p-4">
        <div className="border-2 border-black p-6 text-center max-w-md bg-gray-50">
          <h2 className="font-black text-red-600 text-lg mb-2">RENDER ERROR</h2>
          <p className="text-xs font-bold mb-4">{error}</p>
          <button
            onClick={() => router.push("/construction-plan")}
            className="bg-black text-white px-4 py-2 text-xs font-black uppercase"
          >
            Back to Editor
          </button>
        </div>
      </div>
    );
  }

  if (!sheetData || !generatedPlan || !cadBlueprint) {
    return (
      <div className="min-h-screen flex items-center justify-center font-black text-xs tracking-widest bg-white">
        LOADING ARCHITECTURAL SHEET & CAD BLUEPRINT...
      </div>
    );
  }

  const { metadata, selected_floors, floor_details } = sheetData;
  const floors = selected_floors && selected_floors.length > 0 
    ? selected_floors 
    : ["GROUND FLOOR", "FIRST FLOOR"];
  
  const totalBuiltUp = floors.reduce((acc: number, fName: string) => {
    const fArea = Number(floor_details?.[fName]?.area || generatedPlan.plotArea || 800);
    return acc + fArea;
  }, 0);

  const doorWindowSpecs = calculateDoorsAndWindows(totalBuiltUp, floors.length, false);
  const formattedFloorsTitle = floors.join(" + ");

  return (
    <div className="min-h-screen bg-gray-100 text-black p-4 flex flex-col items-center relative">
      
      {/* TOP CONTROLS & ZOOM TOOLBAR */}
      <div className="w-full max-w-[1450px] flex justify-between items-center mb-4 bg-white p-3 border-2 border-black shadow-md print:hidden">
        <button
          type="button"
          onClick={() => router.push("/construction-plan")}
          className="border border-black px-4 py-1.5 text-xs font-black bg-gray-100 hover:bg-gray-200"
        >
          ← BACK TO EDITOR
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black">SHEET ZOOM:</span>
          <button 
            onClick={() => setZoomLevel((prev) => Math.max(prev - 0.1, 0.5))}
            className="px-3 py-1 bg-gray-200 border border-black font-black text-xs hover:bg-gray-300"
          >
            -
          </button>
          <span className="text-[11px] font-bold w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
          <button 
            onClick={() => setZoomLevel((prev) => Math.min(prev + 0.1, 1.5))}
            className="px-3 py-1 bg-gray-200 border border-black font-black text-xs hover:bg-gray-300"
          >
            +
          </button>
          <button 
            onClick={() => setZoomLevel(0.85)}
            className="px-3 py-1 bg-black text-white font-black text-[10px] uppercase"
          >
            Reset
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="bg-black text-white px-6 py-1.5 text-xs font-black"
        >
          PRINT / SAVE PDF
        </button>
      </div>

      {/* FULLY SCROLLABLE & CENTERED CONTAINER */}
      <div 
        ref={containerRef}
        className="w-full overflow-auto flex flex-col items-center py-4 bg-gray-200 px-4"
      >
        <div 
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.1s ease-out' }}
          className="border-2 border-black w-[1350px] bg-white text-[9px] grid grid-cols-12 shadow-2xl shrink-0 my-2 mx-auto"
        >
          
          {/* LEFT 75% — TECHNICAL DRAWINGS SECTION */}
          <div className="col-span-9 border-r-2 border-black p-3 flex flex-col gap-3">
            
            {/* TOP STRUCTURAL BOXES */}
            <div className="grid grid-cols-3 gap-2 border-b-2 border-black pb-2">
              <div className="border border-black p-1.5 flex flex-col items-center justify-between bg-white h-[100px]">
                <svg width="35" height="55" viewBox="0 0 100 150" className="border border-black bg-white my-auto">
                  <rect x="15" y="10" width="70" height="130" fill="none" stroke="black" strokeWidth="2" />
                  <line x1="15" y1="45" x2="85" y2="45" stroke="black" strokeWidth="2" />
                  <line x1="15" y1="80" x2="85" y2="80" stroke="black" strokeWidth="2" />
                  <line x1="15" y1="115" x2="85" y2="115" stroke="black" strokeWidth="2" />
                </svg>
                <span className="font-black text-[7px] mt-1 pt-1 border-t border-black w-full text-center">FRONT ELEVATION</span>
              </div>

              <div className="border border-black p-1.5 flex flex-col items-center justify-between bg-white h-[100px]">
                <svg width="35" height="55" viewBox="0 0 100 150" className="border border-black bg-white my-auto">
                  <rect x="20" y="10" width="60" height="130" fill="none" stroke="black" strokeWidth="2" />
                  <line x1="20" y1="45" x2="80" y2="45" stroke="black" strokeWidth="1.5" />
                  <line x1="20" y1="80" x2="80" y2="80" stroke="black" strokeWidth="1.5" />
                  <line x1="20" y1="115" x2="80" y2="115" stroke="black" strokeWidth="1.5" />
                  <line x1="50" y1="10" x2="50" y2="140" stroke="black" strokeWidth="1" strokeDasharray="2,2" />
                </svg>
                <span className="font-black text-[7px] mt-1 pt-1 border-t border-black w-full text-center">SECTION X-X</span>
              </div>

              <div className="border border-black p-1.5 flex flex-col items-center justify-between bg-white h-[100px]">
                <svg width="35" height="55" viewBox="0 0 100 150" className="border border-black bg-white my-auto">
                  <rect x="20" y="15" width="60" height="120" fill="none" stroke="black" strokeWidth="2" />
                  <rect x="35" y="50" width="30" height="40" fill="none" stroke="black" strokeDasharray="3,3" />
                </svg>
                <span className="font-black text-[7px] mt-1 pt-1 border-t border-black w-full text-center">TERRACE PLAN</span>
              </div>
            </div>

            {/* DYNAMIC FLOOR PLANS & SITE PLAN */}
            <div className="grid grid-cols-3 gap-3 items-start">
              {floors.map((floorName: string) => {
                const roomsList = cadBlueprint.getRoomsForFloor(floorName);
                const fArea = floor_details?.[floorName]?.area || generatedPlan.plotArea;
                const isGround = floorName.toLowerCase().includes("ground");

                return (
                  <div key={floorName} className="flex flex-col justify-between bg-white border border-black p-1.5 shadow-sm relative group">
                    
                    <button 
                      onClick={() => setSelectedFloorModal({ title: floorName, type: 'floor', roomsList, isGround, fArea })}
                      className="absolute top-2 right-2 bg-black text-white text-[7px] px-1.5 py-0.5 font-black uppercase opacity-80 hover:opacity-100 z-10 print:hidden"
                    >
                      🔍 Zoom
                    </button>

                    <div className="w-full flex items-center justify-center bg-white cursor-pointer" onClick={() => setSelectedFloorModal({ title: floorName, type: 'floor', roomsList, isGround, fArea })}>
                      <svg viewBox={cadBlueprint.viewBox} className="w-full h-[340px] bg-white">
                        <defs>
                          <pattern id={`wallHatch-${floorName}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="4" stroke="black" strokeWidth="0.8" />
                          </pattern>
                        </defs>

                        {/* PROFESSIONAL DOUBLE WALL WITH HATCHING */}
                        <rect x="20" y="20" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="none" stroke={`url(#wallHatch-${floorName})`} strokeWidth="6" />
                        <rect x="20" y="20" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="none" stroke="black" strokeWidth="1.5" />

                        {roomsList.map((room: any, rIdx: number) => (
                          <g key={rIdx}>
                            <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="white" stroke={`url(#wallHatch-${floorName})`} strokeWidth="3" />
                            <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="white" stroke="black" strokeWidth="1" />
                            
                            {room.isStairs ? (
                              <g>
                                <line x1={room.x} y1={room.y + room.h/2} x2={room.x + room.w} y2={room.y + room.h/2} stroke="black" strokeWidth="1" />
                                <text x={room.x + room.w/2} y={room.y + room.h/2 - 4} textAnchor="middle" className="text-[6px] font-bold">UP</text>
                              </g>
                            ) : room.isParking ? (
                              <text x={room.x + room.w / 2} y={room.y + room.h / 2} textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-black fill-black uppercase tracking-widest">
                                PARKING
                              </text>
                            ) : (
                              <>
                                <text x={room.x + room.w / 2} y={room.y + room.h / 2 - 3} textAnchor="middle" dominantBaseline="middle" className="text-[5.5px] font-black tracking-tight fill-black">
                                  {room.name}
                                </text>
                                <text x={room.x + room.w / 2} y={room.y + room.h / 2 + 4.5} textAnchor="middle" dominantBaseline="middle" className="text-[4.5px] font-bold fill-gray-800">
                                  {room.area}
                                </text>
                              </>
                            )}
                          </g>
                        ))}

                        {/* CORRECTED DYNAMIC DOORS & WINDOWS PLACEMENT */}
                        <g>
                          {roomsList.map((room: any, idx: number) => {
                            if (room.isStairs || room.isParking) return null;
                            const doorX = room.x + room.w * 0.5 - 5;
                            const doorY = room.y;
                            return (
                              <g key={`door-${idx}`}>
                                <path d={`M ${doorX} ${doorY} A 8 8 0 0 1 ${doorX + 8} ${doorY - 8}`} fill="none" stroke="black" strokeWidth="0.8" />
                                <line x1={doorX} y1={doorY} x2={doorX + 8} y2={doorY} stroke="black" strokeWidth="1" />
                              </g>
                            );
                          })}
                          <rect x="17" y={20 + cadBlueprint.plotDepth * 0.4} width="6" height="14" fill="cyan" stroke="black" strokeWidth="0.8" />
                          <rect x={20 + cadBlueprint.plotWidth * 0.4} y="17" width="14" height="6" fill="cyan" stroke="black" strokeWidth="0.8" />
                        </g>
                      </svg>
                    </div>

                    <div className="pt-1.5 border-t border-black text-center mt-1 bg-gray-50">
                      <div className="font-black text-[9px] uppercase">{floorName}</div>
                      <div className="font-bold text-[8px] text-gray-700">{fArea} SQ.FT</div>
                    </div>
                  </div>
                );
              })}

              {/* SITE PLAN */}
              <div className="flex flex-col justify-between bg-white border border-black p-1.5 shadow-sm relative group">
                <button 
                  onClick={() => setSelectedFloorModal({ title: "SITE PLAN", type: 'site' })}
                  className="absolute top-2 right-2 bg-black text-white text-[7px] px-1.5 py-0.5 font-black uppercase opacity-80 hover:opacity-100 z-10 print:hidden"
                >
                  🔍 Zoom
                </button>

                <div className="w-full flex items-center justify-center bg-white cursor-pointer" onClick={() => setSelectedFloorModal({ title: "SITE PLAN", type: 'site' })}>
                  <svg viewBox={`0 0 ${cadBlueprint.plotWidth + 160} ${cadBlueprint.plotDepth + 140}`} className="w-full h-[340px] bg-white">
                    <defs>
                      <pattern id="siteHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="6" stroke="black" strokeWidth="0.8" />
                      </pattern>
                    </defs>

                    <text x="50%" y="24" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="black" fontFamily="sans-serif">{metadata?.topNeighbor || cadBlueprint.sitePlan?.topNeighbor || "SHRI HARI KUMAWAT HOUSE"}</text>
                    <text x="24" y="50%" textAnchor="middle" transform={`rotate(-90 24 ${cadBlueprint.plotDepth/2 + 50})`} fontSize="8.5" fontWeight="bold" fill="black" fontFamily="sans-serif">{metadata?.leftNeighbor || cadBlueprint.sitePlan?.leftNeighbor || "PAVITRA SHARMA HOUSE"}</text>
                    <text x={`${cadBlueprint.plotWidth + 135}`} y="50%" textAnchor="middle" transform={`rotate(90 ${cadBlueprint.plotWidth + 135} ${cadBlueprint.plotDepth/2 + 50})`} fontSize="8.5" fontWeight="bold" fill="black" fontFamily="sans-serif">{metadata?.rightNeighbor || "EAST BOUNDARY"}</text>

                    <rect x="60" y="50" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="url(#siteHatch)" stroke="none" />
                    <rect x="60" y="50" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="none" stroke="black" strokeWidth="2" />
                    
                    <text x={60 + cadBlueprint.plotWidth / 2} y={50 + cadBlueprint.plotDepth / 2} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="900" fill="black" fontFamily="sans-serif" letterSpacing="2">PROPOSED SITE</text>

                    <line x1="60" y1="38" x2={60 + cadBlueprint.plotWidth} y2="38" stroke="black" strokeWidth="1" />
                    <line x1="60" y1="35" x2="60" y2="41" stroke="black" strokeWidth="1" />
                    <line x1={60 + cadBlueprint.plotWidth} y1="35" x2={60 + cadBlueprint.plotWidth} y2="41" stroke="black" strokeWidth="1" />
                    <text x={60 + cadBlueprint.plotWidth / 2} y="32" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="black" fontFamily="sans-serif">{sheetData.dimensions?.A || 20}'</text>

                    <line x1={cadBlueprint.plotWidth + 80} y1="50" x2={cadBlueprint.plotWidth + 80} y2={50 + cadBlueprint.plotDepth} stroke="black" strokeWidth="1" />
                    <line x1={cadBlueprint.plotWidth + 77} y1="50" x2={cadBlueprint.plotWidth + 83} y2="50" stroke="black" strokeWidth="1" />
                    <line x1={cadBlueprint.plotWidth + 77} y1={50 + cadBlueprint.plotDepth} x2={cadBlueprint.plotWidth + 83} y2={50 + cadBlueprint.plotDepth} stroke="black" strokeWidth="1" />
                    <text x={cadBlueprint.plotWidth + 95} y={50 + cadBlueprint.plotDepth / 2} textAnchor="middle" transform={`rotate(90 ${cadBlueprint.plotWidth + 95} ${50 + cadBlueprint.plotDepth / 2})`} fontSize="9.5" fontWeight="900" fill="black" fontFamily="sans-serif">{sheetData.dimensions?.C || 50}'</text>

                    <rect x="60" y={50 + cadBlueprint.plotDepth} width={cadBlueprint.plotWidth} height="20" fill="#e2e8f0" stroke="black" strokeWidth="1.5" />
                    <text x={60 + cadBlueprint.plotWidth / 2} y={50 + cadBlueprint.plotDepth + 13} textAnchor="middle" fontSize="9" fontWeight="900" fill="black" fontFamily="sans-serif">ROAD</text>
                  </svg>
                </div>

                <div className="pt-1.5 border-t border-black text-center mt-1 bg-gray-50">
                  <div className="font-black text-[9px] uppercase">SITE PLAN</div>
                  <div className="font-bold text-[8px] text-gray-700">PLOT: {generatedPlan.plotArea} SQ.FT</div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT 25% — SIDEBAR & AREA STATEMENT */}
          <div className="col-span-3 bg-gray-50 p-3 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="border border-black p-2 bg-white text-center">
                <div className="font-black text-[10px] leading-tight uppercase">
                  PROPOSED RESIDENTIAL BUILDING ON {formattedFloorsTitle}
                </div>
              </div>

              <div className="space-y-1 text-[9px]">
                <div className="border border-black bg-white p-1">
                  <div className="font-bold text-gray-500 text-[7px]">CUSTOMER NAME</div>
                  <div className="font-black uppercase">{metadata?.customerName || "N/A"}</div>
                </div>
                <div className="border border-black bg-white p-1">
                  <div className="font-bold text-gray-500 text-[7px]">PROPERTY ADDRESS</div>
                  <div className="font-black uppercase">{metadata?.propertyAddress || "N/A"}</div>
                </div>
              </div>

              <div>
                <div className="font-black text-[9px] border-b border-black pb-1 text-center bg-slate-900 text-white p-1">
                  AREA STATEMENT
                </div>
                <div className="space-y-1 mt-1.5 text-[9px]">
                  <div className="flex justify-between border border-black bg-white p-1">
                    <span className="font-bold text-gray-700">PLOT AREA</span>
                    <span className="font-black">{generatedPlan.plotArea} SQ.FT</span>
                  </div>

                  {floors.map((fName: string) => {
                    const fArea = floor_details?.[fName]?.area || generatedPlan.plotArea;
                    return (
                      <div key={fName} className="flex justify-between border border-black bg-white p-1">
                        <span className="font-bold text-gray-700 uppercase text-[8px]">{fName} BUILT UP</span>
                        <span className="font-black">{fArea} SQ.FT</span>
                      </div>
                    );
                  })}

                  <div className="flex justify-between border border-black bg-white p-1 font-black text-[9px]">
                    <span>TOTAL BUILT UP</span>
                    <span>{totalBuiltUp} SQ.FT</span>
                  </div>
                </div>
              </div>

              <div className="border border-black bg-white p-1.5 text-[8px] space-y-0.5">
                <div className="font-black border-b border-black pb-0.5 uppercase text-slate-800">Engine Specifications</div>
                <div className="flex justify-between font-bold"><span>Main Doors:</span> <span>{doorWindowSpecs.mainDoors}</span></div>
                <div className="flex justify-between font-bold"><span>Internal Doors:</span> <span>{doorWindowSpecs.internalDoors}</span></div>
                <div className="flex justify-between font-bold"><span>Windows:</span> <span>{doorWindowSpecs.windows}</span></div>
              </div>
            </div>

            <div className="border-t border-black pt-2 mt-2 space-y-1.5">
              <div className="flex justify-between items-center bg-white border border-black p-1.5">
                <div className="text-center font-black text-[9px] leading-none">
                  <span className="text-red-600 block text-[10px]">N</span>
                  <div className="flex justify-between w-8 text-[7px] px-0.5 font-bold">
                    <span>W</span><span>E</span>
                  </div>
                  <span className="text-black block text-[10px]">S</span>
                </div>
                <div className="text-[7px] font-bold text-right">
                  SCALE: 1:100<br />CAD ENGINE
                </div>
              </div>

              <div className="border border-black bg-white p-1.5 text-[7px] space-y-0.5">
                <div className="font-black text-blue-800">Digitally signed by</div>
                <div className="font-black">Er. Jasvant Singh Chouhan</div>
                <div className="text-[6px] text-green-700 font-bold">Status: CAD Verified</div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ZOOMED FLOOR MODAL POPUP */}
      {selectedFloorModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border-2 border-black max-w-2xl w-full p-4 flex flex-col shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b-2 border-black mb-3">
              <h3 className="font-black text-sm uppercase">ZOOMED VIEW: {selectedFloorModal.title}</h3>
              <button 
                onClick={() => setSelectedFloorModal(null)}
                className="bg-black text-white px-3 py-1 text-xs font-black"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="w-full flex items-center justify-center bg-gray-50 border border-black p-2">
              <svg viewBox={selectedFloorModal.type === 'site' ? `0 0 ${cadBlueprint.plotWidth + 160} ${cadBlueprint.plotDepth + 140}` : cadBlueprint.viewBox} className="w-full h-[500px] bg-white">
                <defs>
                  <pattern id="wallHatchModal" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="4" stroke="black" strokeWidth="0.8" />
                  </pattern>
                  <pattern id="siteHatchModal" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="6" stroke="black" strokeWidth="0.8" />
                  </pattern>
                </defs>

                {selectedFloorModal.type === 'floor' ? (
                  <>
                    <rect x="20" y="20" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="none" stroke="url(#wallHatchModal)" strokeWidth="6" />
                    <rect x="20" y="20" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="none" stroke="black" strokeWidth="1.5" />

                    {selectedFloorModal.roomsList.map((room: any, rIdx: number) => (
                      <g key={rIdx}>
                        <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="white" stroke="url(#wallHatchModal)" strokeWidth="3" />
                        <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="white" stroke="black" strokeWidth="1" />
                        
                        {room.isStairs ? (
                          <g>
                            <line x1={room.x} y1={room.y + room.h/2} x2={room.x + room.w} y2={room.y + room.h/2} stroke="black" strokeWidth="1" />
                            <text x={room.x + room.w/2} y={room.y + room.h/2 - 4} textAnchor="middle" className="text-[7px] font-bold">UP</text>
                          </g>
                        ) : room.isParking ? (
                          <text x={room.x + room.w / 2} y={room.y + room.h / 2} textAnchor="middle" dominantBaseline="middle" className="text-[12px] font-black fill-black uppercase tracking-widest">
                            PARKING
                          </text>
                        ) : (
                          <>
                            <text x={room.x + room.w / 2} y={room.y + room.h / 2 - 3} textAnchor="middle" dominantBaseline="middle" className="text-[7px] font-black tracking-tight fill-black">
                              {room.name}
                            </text>
                            <text x={room.x + room.w / 2} y={room.y + room.h / 2 + 5} textAnchor="middle" dominantBaseline="middle" className="text-[5.5px] font-bold fill-gray-800">
                              {room.area}
                            </text>
                          </>
                        )}
                      </g>
                    ))}

                    <g>
                      {selectedFloorModal.roomsList.map((room: any, idx: number) => {
                        if (room.isStairs || room.isParking) return null;
                        const doorX = room.x + room.w * 0.5 - 5;
                        const doorY = room.y;
                        return (
                          <g key={`modal-door-${idx}`}>
                            <path d={`M ${doorX} ${doorY} A 8 8 0 0 1 ${doorX + 8} ${doorY - 8}`} fill="none" stroke="black" strokeWidth="0.8" />
                            <line x1={doorX} y1={doorY} x2={doorX + 8} y2={doorY} stroke="black" strokeWidth="1" />
                          </g>
                        );
                      })}
                      <rect x="17" y={20 + cadBlueprint.plotDepth * 0.4} width="6" height="14" fill="cyan" stroke="black" strokeWidth="0.8" />
                      <rect x={20 + cadBlueprint.plotWidth * 0.4} y="17" width="14" height="6" fill="cyan" stroke="black" strokeWidth="0.8" />
                    </g>
                  </>
                ) : (
                  <>
                    <text x="50%" y="24" textAnchor="middle" fontSize="9" fontWeight="bold" fill="black" fontFamily="sans-serif">{metadata?.topNeighbor || cadBlueprint.sitePlan?.topNeighbor || "SHRI HARI KUMAWAT HOUSE"}</text>
                    <text x="24" y="50%" textAnchor="middle" transform={`rotate(-90 24 ${cadBlueprint.plotDepth/2 + 50})`} fontSize="9" fontWeight="bold" fill="black" fontFamily="sans-serif">{metadata?.leftNeighbor || cadBlueprint.sitePlan?.leftNeighbor || "PAVITRA SHARMA HOUSE"}</text>
                    <text x={`${cadBlueprint.plotWidth + 135}`} y="50%" textAnchor="middle" transform={`rotate(90 ${cadBlueprint.plotWidth + 135} ${cadBlueprint.plotDepth/2 + 50})`} fontSize="9" fontWeight="bold" fill="black" fontFamily="sans-serif">{metadata?.rightNeighbor || "EAST BOUNDARY"}</text>

                    <rect x="60" y="50" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="url(#siteHatchModal)" stroke="none" />
                    <rect x="60" y="50" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="none" stroke="black" strokeWidth="2" />
                    
                    <text x={60 + cadBlueprint.plotWidth / 2} y={50 + cadBlueprint.plotDepth / 2} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="900" fill="black" fontFamily="sans-serif" letterSpacing="2">PROPOSED SITE</text>

                    <line x1="60" y1="38" x2={60 + cadBlueprint.plotWidth} y2="38" stroke="black" strokeWidth="1" />
                    <line x1="60" y1="35" x2="60" y2="41" stroke="black" strokeWidth="1" />
                    <line x1={60 + cadBlueprint.plotWidth} y1="35" x2={60 + cadBlueprint.plotWidth} y2="41" stroke="black" strokeWidth="1" />
                    <text x={60 + cadBlueprint.plotWidth / 2} y="32" textAnchor="middle" fontSize="10" fontWeight="900" fill="black" fontFamily="sans-serif">{sheetData.dimensions?.A || 20}'</text>

                    <line x1={cadBlueprint.plotWidth + 80} y1="50" x2={cadBlueprint.plotWidth + 80} y2={50 + cadBlueprint.plotDepth} stroke="black" strokeWidth="1" />
                    <line x1={cadBlueprint.plotWidth + 77} y1="50" x2={cadBlueprint.plotWidth + 83} y2="50" stroke="black" strokeWidth="1" />
                    <line x1={cadBlueprint.plotWidth + 77} y1={50 + cadBlueprint.plotDepth} x2={cadBlueprint.plotWidth + 83} y2={50 + cadBlueprint.plotDepth} stroke="black" strokeWidth="1" />
                    <text x={cadBlueprint.plotWidth + 95} y={50 + cadBlueprint.plotDepth / 2} textAnchor="middle" transform={`rotate(90 ${cadBlueprint.plotWidth + 95} ${50 + cadBlueprint.plotDepth / 2})`} fontSize="10" fontWeight="900" fill="black" fontFamily="sans-serif">{sheetData.dimensions?.C || 50}'</text>

                    <rect x="60" y={50 + cadBlueprint.plotDepth} width={cadBlueprint.plotWidth} height="20" fill="#e2e8f0" stroke="black" strokeWidth="1.5" />
                    <text x={60 + cadBlueprint.plotWidth / 2} y={50 + cadBlueprint.plotDepth + 13} textAnchor="middle" fontSize="9.5" fontWeight="900" fill="black" fontFamily="sans-serif">ROAD</text>
                  </>
                )}
              </svg>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}