'use client';

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import CadFloorElevationRenderer from "../construction-plan/components/CadFloorElevationRenderer";

export default function ConstructionPlanPreview() {
  const router = useRouter();
  const [planData, setPlanData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const rawData =
        localStorage.getItem("constructionPlanData") ||
        localStorage.getItem("construction_plan_preview_data") ||
        localStorage.getItem("CONSTRUCTION_PLAN_INPUT");

      if (rawData) {
        setPlanData(JSON.parse(rawData));
      }
    } catch (err) {
      console.error("Error loading preview data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Extract Plan Data with default fallbacks
  const {
    customerName = "N/A",
    propertyAddress = "N/A",
    plotArea = 1000,
    groundBuiltUp = 1000,
    totalBuiltUp = 1000,
    boundaries = { north: "ROAD", south: "PLOT NO. 40", east: "PLOT NO. 42", west: "PLOT NO. 38" },
    dimensions = { width: 20, length: 50, A: 20, B: 20, C: 50, D: 50 },
    roadFacingOption = "1 SIDE ROAD (NORTH)",
    totalFloors = 1,
    selectedFloors = ["GROUND FLOOR"],
    measurementUnit = "FEET",
    roadWidthNorth = 20,
    roadWidthSouth = 15,
    frontMos = 0,
    rearMos = 0,
    leftMos = 0,
    rightMos = 0,
  } = planData || {};

  const widthFt = Number(dimensions?.A || dimensions?.width || 20);
  const lengthFt = Number(dimensions?.C || dimensions?.length || 50);

  const fMos = Number(frontMos || planData?.sideMos?.A || 0);
  const rMos = Number(rearMos || planData?.sideMos?.B || 0);
  const lMos = Number(leftMos || planData?.sideMos?.C || 0);
  const rtMos = Number(rightMos || planData?.sideMos?.D || 0);

  const builtWidth = widthFt - lMos - rtMos;
  const builtLength = lengthFt - fMos - rMos;

  const scale = 5.5;

  // Compute built-up points for CadFloorElevationRenderer
  const builtUpPoints = useMemo(() => {
    const wPx = builtWidth * scale;
    const hPx = builtLength * scale;
    return [
      { x: -wPx / 2, y: -hPx / 2 },
      { x: wPx / 2, y: -hPx / 2 },
      { x: wPx / 2, y: hPx / 2 },
      { x: -wPx / 2, y: hPx / 2 }
    ];
  }, [builtWidth, builtLength, scale]);

  // Ensure selectedFloors and floorData are normalized correctly
  const normalizedSelectedFloors = useMemo(() => {
    if (Array.isArray(selectedFloors) && selectedFloors.length > 0) {
      return selectedFloors;
    }
    return ["GROUND FLOOR"];
  }, [selectedFloors]);

  const normalizedFloorData = useMemo(() => {
    const rawFloorData = planData?.floorData || {};
    const result: Record<string, any> = {};

    normalizedSelectedFloors.forEach((floorKey: string) => {
      const fData = rawFloorData[floorKey] || {};
      let fW = Number(fData.width) || builtWidth;
      let fL = Number(fData.length) || builtLength;

      if (floorKey.toUpperCase().includes("GROUND") && fW > fL && fL <= builtWidth) {
        const temp = fW;
        fW = fL;
        fL = temp;
      }

      result[floorKey] = {
        width: fW,
        length: fL,
        area: Number(fData.area) || (fW * fL),
        rooms: fData.rooms || [],
        autoRooms: fData.autoRooms || ["PARKING", "LIVING ROOM", "KITCHEN", "MASTER BEDROOM"],
        isValid: true,
        ...fData,
      };
    });

    return result;
  }, [planData, normalizedSelectedFloors, builtWidth, builtLength]);

  const activeRoadWidth = roadFacingOption.toUpperCase().includes("NORTH")
    ? (roadWidthNorth || 20)
    : (roadWidthSouth || 15);

  if (loading) {
    return (
      <div className="p-10 text-center font-bold text-white bg-slate-900 min-h-screen">
        LOADING ARCHITECTURAL CAD PREVIEW...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-3 text-black uppercase font-sans print:p-0 print:bg-white">
      {/* Action Header */}
      <div className="max-w-[1600px] mx-auto flex justify-between items-center bg-slate-800 text-white p-2.5 mb-2 rounded shadow print:hidden border border-slate-700">
        <button 
          onClick={() => router.back()} 
          className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 text-xs font-bold transition rounded"
        >
          ← BACK TO CAD EDITOR
        </button>
        <h1 className="text-xs font-black tracking-wider text-amber-400">
          CONSTRUCTION CAD PLAN PREVIEW
        </h1>
        <button 
          onClick={() => window.print()} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 text-xs font-bold transition rounded"
        >
          PRINT CAD SHEET
        </button>
      </div>

      {/* Main Grid Container */}
      <div className="max-w-[1600px] mx-auto bg-white border-2 border-black p-2.5 grid grid-cols-12 gap-3 print:border-0 print:p-0">
        
        {/* LEFT 70% CAD VIEWPORT CONTAINER */}
        <div className="col-span-8 md:col-span-9 border-2 border-black p-2 flex flex-col justify-between bg-black text-white min-h-[760px]">
          
          {/* Info Header inside Viewport */}
          <div className="border-b border-slate-800 pb-1.5 mb-1 flex justify-between items-center text-[11px]">
            <span className="font-bold text-amber-400">
              PROJECT: PROPOSED RESIDENTIAL BUILDING ({roadFacingOption})
            </span>
            <span className="font-bold text-slate-400">
              SCALE: N.T.S. (AUTO-FIT TO 70% SHEET)
            </span>
          </div>

          {/* DYNAMIC SVG CANVAS FIT */}
          <div className="flex-1 w-full flex items-center justify-center bg-black overflow-hidden rounded relative">
            <svg 
              viewBox="-420 -320 1200 800"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full max-h-[74vh] transition-all duration-300"
            >
              <CadFloorElevationRenderer
                totalFloors={totalFloors}
                builtUpPoints={builtUpPoints}
                scale={scale}
                selectedFloors={normalizedSelectedFloors}
                roadWidth={activeRoadWidth}
                roadFacingOption={roadFacingOption}
                floorBuiltUpAreas={planData?.floorBuiltUpAreas || { "GROUND FLOOR": builtWidth * builtLength }}
                floorData={normalizedFloorData}
                frontMos={fMos}
                backMos={rMos}
                measurementUnit={measurementUnit}
              />
            </svg>
          </div>

          <div className="border-t border-slate-800 pt-1 text-center text-[9px] text-slate-400 font-bold">
            AUTOMATICALLY GENERATED DYNAMIC CAD DRAWING SHEET
          </div>
        </div>

        {/* RIGHT 30% SIDEBAR SUMMARY TABLE */}
        <div className="col-span-4 md:col-span-3 border-2 border-black p-3 flex flex-col justify-between text-[11px] bg-white">
          <div>
            <div className="text-center font-black text-sm border-b-2 border-black pb-2 mb-3">
              LNT WITH AI 2.0
              <div className="text-[9px] font-normal text-gray-600">ARCHITECTURAL & STRUCTURAL DRAWING</div>
            </div>

            <div className="border border-black p-2.5 mb-3 bg-gray-50">
              <div className="font-bold border-b border-black pb-1 mb-1 text-xs">CUSTOMER & LOCATION DETAILS</div>
              <div className="truncate"><strong>NAME:</strong> {customerName}</div>
              <div className="truncate"><strong>ADDRESS:</strong> {propertyAddress}</div>
            </div>

            <div className="border border-black p-2.5 mb-3 bg-gray-50">
              <div className="font-bold border-b border-black pb-1 mb-1 text-xs">AREA STATEMENT</div>
              <div className="flex justify-between"><span>PLOT AREA:</span> <span>{Number(plotArea).toFixed(2)} SQFT.</span></div>
              <div className="flex justify-between"><span>GROUND BUILT UP:</span> <span>{Number(groundBuiltUp).toFixed(2)} SQFT.</span></div>
              <div className="flex justify-between font-bold border-t border-gray-400 pt-1 mt-1">
                <span>TOTAL BUILT-UP:</span> <span>{Number(totalBuiltUp).toFixed(2)} SQFT.</span>
              </div>
            </div>

            <div className="border border-black p-2.5 mb-3 bg-gray-50">
              <div className="font-bold border-b border-black pb-1 mb-1 text-xs">BOUNDARIES</div>
              <div className="grid grid-cols-1 gap-1">
                <div><strong>NORTH:</strong> {boundaries.north || "ROAD"}</div>
                <div><strong>SOUTH:</strong> {boundaries.south || "PLOT NO. 40"}</div>
                <div><strong>EAST:</strong> {boundaries.east || "PLOT NO. 42"}</div>
                <div><strong>WEST:</strong> {boundaries.west || "PLOT NO. 38"}</div>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-black pt-4 grid grid-cols-2 text-center text-[9px] font-bold">
            <div>
              <div className="h-10"></div>
              <div>CLIENT SIGN</div>
            </div>
            <div>
              <div className="h-10"></div>
              <div>ARCHITECT SIGN</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}