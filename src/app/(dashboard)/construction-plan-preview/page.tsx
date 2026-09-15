'use client';

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import CadFloorElevationRenderer from "../construction-plan/components/CadFloorElevationRenderer";
import PlotPolygonRenderer from "../construction-plan/components/PlotPolygonRenderer";
import BoundaryLabels from "../construction-plan/components/BoundaryLabels";
import RoadRenderer from "../construction-plan/components/RoadRenderer";
import { getRoadOrientation } from "../construction-plan/engine/roadOrientation";

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
    roadWidthEast = 15,
    roadWidthWest = 15,
    frontMos = 0,
    rearMos = 0,
    leftMos = 0,
    rightMos = 0,
    floorRooms = {},
  } = planData || {};

  const dimA = Number(dimensions?.A || dimensions?.width || 20);
  const dimB = Number(dimensions?.B || dimA);
  const dimC = Number(dimensions?.C || dimensions?.length || 50);
  const dimD = Number(dimensions?.D || dimC);

  const fMos = Number(frontMos || planData?.sideMos?.A || 0);
  const rMos = Number(rearMos || planData?.sideMos?.B || 0);
  const lMos = Number(leftMos || planData?.sideMos?.C || 0);
  const rtMos = Number(rightMos || planData?.sideMos?.D || 0);

  const builtWidth = dimA - lMos - rtMos;
  const builtLength = dimC - fMos - rMos;

  const scale = 5.5;

  // Plot Polygon Points Calculation
  const bottomWidth = dimA * scale;
  const topWidth = dimB * scale;
  const heightLeft = dimC * scale;
  const heightRight = dimD * scale;

  let pBottomLeft = { x: -bottomWidth / 2, y: heightLeft / 2 };
  let pBottomRight = { x: bottomWidth / 2, y: heightLeft / 2 };
  let pTopLeft = { x: -topWidth / 2, y: -heightLeft / 2 };
  let pTopRight = { x: topWidth / 2, y: -heightRight / 2 };

  const correctedPoints = [pTopLeft, pTopRight, pBottomRight, pBottomLeft];
  const xs = correctedPoints.map(p => p.x);
  const ys = correctedPoints.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Compute built-up points for CadFloorElevationRenderer
  const builtUpPoints = useMemo(() => {
    const mosFront = fMos * scale;
    const mosBack = rMos * scale;
    const mosLeft = lMos * scale;
    const mosRight = rtMos * scale;

    const isFullPlot = fMos === 0 && rMos === 0 && lMos === 0 && rtMos === 0;
    if (isFullPlot) return correctedPoints;

    return [
      { x: pTopLeft.x + mosLeft, y: pTopLeft.y + mosBack },
      { x: pTopRight.x - mosRight, y: pTopRight.y + mosBack },
      { x: pBottomRight.x - mosRight, y: pBottomRight.y - mosFront },
      { x: pBottomLeft.x + mosLeft, y: pBottomLeft.y - mosFront }
    ];
  }, [pTopLeft, pTopRight, pBottomRight, pBottomLeft, fMos, rMos, lMos, rtMos, scale]);

  // Road configuration
  const roadOptUpper = (roadFacingOption || "").toUpperCase();
  const activeNorth = roadOptUpper.includes("NORTH") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI") || roadOptUpper.includes("CORNER");
  const activeSouth = roadOptUpper.includes("SOUTH") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI") || roadOptUpper.includes("CORNER");
  const activeEast = roadOptUpper.includes("EAST") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI") || roadOptUpper.includes("CORNER");
  const activeWest = roadOptUpper.includes("WEST") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI");

  const currentNorthRoad = Number(roadWidthNorth) || 15;
  const currentSouthRoad = Number(roadWidthSouth) || 15;
  const currentEastRoad = Number(roadWidthEast) || 15;
  const currentWestRoad = Number(roadWidthWest) || 15;

  const activeRoadWidth = roadFacingOption.toUpperCase().includes("NORTH") ? currentNorthRoad : currentSouthRoad;

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
          className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 text-xs font-bold transition rounded cursor-pointer"
        >
          ← BACK TO CAD EDITOR
        </button>
        <h1 className="text-xs font-black tracking-wider text-amber-400">
          CONSTRUCTION CAD PLAN PREVIEW
        </h1>
        <button 
          onClick={() => window.print()} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 text-xs font-bold transition rounded cursor-pointer"
        >
          PRINT CAD SHEET
        </button>
      </div>

      {/* Main Grid Container */}
      <div className="max-w-[1600px] mx-auto bg-white border-2 border-black p-2.5 grid grid-cols-12 gap-3 print:border-0 print:p-0">
        
        {/* LEFT 70% CAD VIEWPORT CONTAINER */}
        <div className="col-span-8 md:col-span-9 border-2 border-black p-2 flex flex-col justify-between bg-black text-white min-h-[760px]">
          
          <div className="border-b border-slate-800 pb-1.5 mb-1 flex justify-between items-center text-[11px]">
            <span className="font-bold text-amber-400">
              PROJECT: PROPOSED RESIDENTIAL BUILDING ({roadFacingOption})
            </span>
            <span className="font-bold text-slate-400">
              SCALE: N.T.S. (AUTO-FIT TO 70% SHEET)
            </span>
          </div>

          {/* DYNAMIC SVG CANVAS FIT - SIZE INCREASED VIA VIEWBOX & SCALE */}
          <div className="flex-1 w-full flex items-center justify-center bg-black overflow-hidden rounded relative">
            <svg 
              viewBox="-150 -500 300 800"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full max-h-[74vh] transition-all duration-300"
            >
              <g transform="translate(50, 50) scale(1)">
                {/* 1. Plot Polygon Boundary */}
                <PlotPolygonRenderer
                  plotPolygon={correctedPoints}
                  proposedSitePolygon={[]}
                  cadZoom={1}
                  isSelected={false}
                  handlePolygonClick={() => {}}
                />

                {/* 2. Floor Plans, Elevations, Sections & Table */}
                <CadFloorElevationRenderer
                  totalFloors={totalFloors}
                  builtUpPoints={builtUpPoints}
                  scale={scale}
                  selectedFloors={normalizedSelectedFloors}
                  roadWidth={activeRoadWidth}
                  roadFacingOption={roadFacingOption}
                  floorBuiltUpAreas={planData?.floorBuiltUpAreas || { "GROUND FLOOR": builtWidth * builtLength }}
                  floorData={normalizedFloorData}
                  floorRooms={floorRooms || planData?.floorRooms || {}}
                  frontMos={fMos}
                  backMos={rMos}
                  measurementUnit={measurementUnit}
                />

                {/* 3. Boundary Labels & Compass */}
                <BoundaryLabels
                  topBoundary={boundaries.north}
                  bottomBoundary={boundaries.south}
                  leftBoundary={boundaries.west}
                  rightBoundary={boundaries.east}
                  dimA={dimA}
                  dimB={dimB}
                  dimC={dimC}
                  dimD={dimD}
                  pTopLeft={pTopLeft}
                  pTopRight={pTopRight}
                  pBottomLeft={pBottomLeft}
                  pBottomRight={pBottomRight}
                  centerX={centerX}
                  centerY={centerY}
                  minX={minX}
                  maxX={maxX}
                  roadFacingOption={roadFacingOption}
                  roadWidth={activeRoadWidth}
                  measurementUnit={measurementUnit}
                />

                {/* 4. Road Renderer */}
                <RoadRenderer
                  roadFacingOption={roadFacingOption}
                  bottomBoundary={boundaries.south}
                  topBoundary={boundaries.north}
                  boundaryEast={boundaries.east}
                  boundaryWest={boundaries.west}
                  pTopLeft={pTopLeft}
                  pTopRight={pTopRight}
                  pBottomLeft={pBottomLeft}
                  pBottomRight={pBottomRight}
                  roadWidthNorth={activeNorth ? currentNorthRoad : 0}
                  roadWidthSouth={activeSouth ? currentSouthRoad : 0}
                  roadWidthEast={activeEast ? currentEastRoad : 0}
                  roadWidthWest={activeWest ? currentWestRoad : 0}
                />
              </g>
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