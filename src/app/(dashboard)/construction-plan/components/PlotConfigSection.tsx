"use client";

import React from "react";
import { PlotDimensions, PlotShape } from "../engine/planningTypes";


interface PlotConfigSectionProps {
  measurementUnit: "FEET" | "METERS";
  setMeasurementUnit: (val: "FEET" | "METERS") => void;
  roadFacingOption: string;
  setRoadFacingOption: (val: string) => void;
  plotShape: PlotShape | "IRREGULAR" | "L-SHAPE" | "";
  setPlotShape: (val: PlotShape | "IRREGULAR" | "L-SHAPE" | "") => void;
  plotArea: number;
  coverageType: string;
  setCoverageType: (val: string) => void;
  setTempSelectedFloors: (val: string[]) => void;
  selectedFloors: string[];
  setIsFloorModalOpen: (val: boolean) => void;
  setIsCadModalOpen: (val: boolean) => void;
  dimensionHistory: PlotDimensions[];
  handleUndo: () => void;
  handleResetDimensions: () => void;
  blueprintZoom: number;
  setBlueprintZoom: React.Dispatch<React.SetStateAction<number>>;
  isMultiDimShape: boolean;
  lShapeMetrics: any;
  plotDimensions: PlotDimensions;
  updateDimensionPart: (side: keyof PlotDimensions, field: "ft" | "in", val: number) => void;
  dimDetails: Record<string, { ft: number; in: number }>;
  setbackInputs: { front: number; rear: number; left: number; right: number };
  setSetbackInputs: React.Dispatch<React.SetStateAction<{ front: number; rear: number; left: number; right: number }>>;
  boundaryNorth: string;
  setBoundaryNorth: (val: string) => void;
  boundarySouth: string;
  setBoundarySouth: (val: string) => void;
  boundaryEast: string;
  setBoundaryEast: (val: string) => void;
  boundaryWest: string;
  setBoundaryWest: (val: string) => void;
  ROAD_FACING_OPTIONS: readonly string[];
  PLOT_SHAPES: readonly string[];
  calculatedNetArea?: number;
}

export default function PlotConfigSection({
  measurementUnit,
  setMeasurementUnit,
  roadFacingOption,
  setRoadFacingOption,
  plotShape,
  setPlotShape,
  plotArea,
  coverageType,
  setCoverageType,
  setTempSelectedFloors,
  selectedFloors,
  setIsFloorModalOpen,
  setIsCadModalOpen,
  dimensionHistory,
  handleUndo,
  handleResetDimensions,
  blueprintZoom,
  setBlueprintZoom,
  isMultiDimShape,
  lShapeMetrics,
  plotDimensions,
  updateDimensionPart,
  dimDetails,
  setbackInputs,
  setSetbackInputs,
  boundaryNorth,
  setBoundaryNorth,
  boundarySouth,
  setBoundarySouth,
  boundaryEast,
  setBoundaryEast,
  boundaryWest,
  setBoundaryWest,
  ROAD_FACING_OPTIONS,
  PLOT_SHAPES,
  calculatedNetArea = 0,
}: PlotConfigSectionProps) {
  const isRoadSelected = Boolean(roadFacingOption && roadFacingOption.trim() !== "");
  const isShapeSelected = isRoadSelected && Boolean(plotShape && plotShape.trim() !== "");
  const areDimensionsFilled = isShapeSelected && plotArea > 0;
  const areDetailsCompleted = areDimensionsFilled && Boolean(coverageType);

  // Check if rectangle is selected
  // Line 91 ko yeh kar dein:
const isRectangle = (plotShape as string).toUpperCase() === "RECTANGLE";

  const onResetClick = () => {
    const confirmed = window.confirm("Are you sure you want to reset?");
    if (confirmed) {
      handleResetDimensions();
      updateDimensionPart("A", "ft", 0);
      updateDimensionPart("B", "ft", 0);
      updateDimensionPart("C", "ft", 0);
      updateDimensionPart("D", "ft", 0);
    }
  };

  return (
    <div className="border border-black mb-4 bg-white">
      <div className="bg-slate-900 text-white p-2 font-black text-xl flex justify-between items-center px-4">
        <div className="flex gap-2 invisible opacity-0 pointer-events-none">
          <button type="button" className="px-3 py-1 text-xs">UNDO</button>
          <button type="button" className="px-3 py-1 text-xs">RESET</button>
        </div>
        
        <span className="text-center flex-1">PLOT GEOMETRY & CAD SETUP</span>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!areDimensionsFilled || dimensionHistory.length === 0}
            className="bg-yellow-500 text-black px-3 py-1 text-xs font-black rounded hover:bg-yellow-400 disabled:opacity-40 cursor-pointer"
          >
            ↩ UNDO
          </button>
          <button
            type="button"
            onClick={onResetClick}
            disabled={!areDimensionsFilled}
            className="bg-red-600 text-white px-3 py-1 text-xs font-black rounded hover:bg-red-700 disabled:opacity-40 cursor-pointer"
          >
            🔄 RESET
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 divide-x divide-black">
        
        {/* 1. PLOT & COVERAGE */}
        <div className="col-span-3 p-3 space-y-3">
          <div className="font-black text-sm bg-gray-200 p-1 text-center border border-black">1. PLOT & COVERAGE</div>
          
          <div>
            <label className="font-bold text-[11pt] block mb-1">UNIT</label>
            <select
              value={measurementUnit}
              onChange={(e) => setMeasurementUnit(e.target.value as any)}
              className="w-full border border-black p-2 text-sm font-bold bg-white cursor-pointer"
            >
              <option value="FEET">FEET</option>
              <option value="METERS">METERS</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-[11pt] block mb-1">ROAD / FRONT SIDE <span className="text-red-600">*</span></label>
            <select
              value={roadFacingOption}
              onChange={(event) => setRoadFacingOption(event.target.value)}
              className="w-full border border-black p-2 text-sm font-bold bg-yellow-50 focus:bg-white cursor-pointer"
            >
              <option value="">-- SELECT ROAD SIDE FIRST --</option>
              {ROAD_FACING_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-[11pt] block mb-1">PLOT SHAPE</label>
            <select
              value={plotShape}
              disabled={!isRoadSelected}
              onChange={(event) => setPlotShape(event.target.value as any)}
              className="w-full border border-black p-2 text-sm font-bold bg-white disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer"
            >
              <option value="">-- CHOOSE ONE SHAPE --</option>
              {PLOT_SHAPES.map((shape) => (
                <option key={shape} value={shape}>{shape}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-[11pt] block mb-1">PLOT AREA</label>
            <div className={`border border-black p-2 text-center font-black text-base ${isShapeSelected ? "bg-gray-100 text-black" : "bg-gray-200 text-gray-400"}`}>
              {isShapeSelected ? `${plotArea.toFixed(2)} SQ.${measurementUnit === "FEET" ? "FT" : "M"}` : "---"}
            </div>
          </div>

          <div>
            <label className="font-bold text-[11pt] block mb-1">GROUND COVERAGE</label>
            <select
              value={coverageType}
              disabled={!isShapeSelected}
              onChange={(event) => setCoverageType(event.target.value)}
              className="w-full border border-black p-2 text-sm font-bold bg-white disabled:bg-gray-100 disabled:text-gray-400 mb-2 cursor-pointer"
            >
              <option value="100_PERCENT">100% — FULL (DEFAULT)</option>
              <option value="AS_PER_NORMS">AS PER NORMS</option>
              <option value="CUSTOM_PERCENT">CUSTOM %</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-[11pt] block mb-1">FLOORS & CAD</label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!areDetailsCompleted}
                onClick={() => {
                  setTempSelectedFloors(selectedFloors);
                  setIsFloorModalOpen(true);
                }}
                className="w-1/2 border border-black bg-gray-100 p-2 text-xs font-bold hover:bg-gray-200 disabled:opacity-40 transition cursor-pointer"
              >
                FLOORS ({selectedFloors.length})
              </button>
              <button
                type="button"
                disabled={!areDetailsCompleted}
                onClick={() => setIsCadModalOpen(true)}
                className="w-1/2 bg-blue-700 text-white p-2 text-xs font-black hover:bg-blue-800 disabled:opacity-40 transition cursor-pointer"
              >
                OPEN CAD
              </button>
            </div>
          </div>
        </div>

        {/* 2. DIMENSIONS / CAD */}
        <div className={`${isMultiDimShape ? "col-span-5" : "col-span-3"} p-3 flex flex-col justify-between space-y-3`}>
          <div className="bg-gray-200 border border-black p-1 text-center font-black text-sm flex justify-center items-center px-2">
            <span>{isMultiDimShape ? "2. SIDES & EDIT DIMENSIONS" : "2. DIMENSIONS"}</span>
            {!isShapeSelected && <span className="text-red-600 text-[10px] ml-2">(Locked)</span>}
          </div>

          {!isShapeSelected ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50 border border-dashed border-gray-400 p-6 text-center text-gray-500 font-bold text-sm">
              🔒 Select Road & Plot Shape first to unlock dimensions.
            </div>
          ) : isMultiDimShape ? (
            <div className="border border-black bg-[#090d16] text-white p-2 flex-1 flex flex-col items-center justify-between">
              <div className="text-[10px] font-bold text-cyan-400 mb-1 text-center">EDIT DIMENSIONS DIRECTLY ON CAD (SCROLL TO ZOOM)</div>
              
              <div 
                className="relative bg-[#05070b] border border-cyan-900/50 w-full flex-1 min-h-[300px] flex items-center justify-center shadow-inner my-1 select-none overflow-hidden"
                onWheel={(e) => {
                  e.stopPropagation();
                  const zoomDelta = e.deltaY < 0 ? 0.15 : -0.15;
                  setBlueprintZoom((z) => Math.min(Math.max(z + zoomDelta, 0.5), 3.0));
                }}
              >
                <div 
                  className="relative w-full h-full flex items-center justify-center transition-transform duration-75"
                  style={{ transform: `scale(${blueprintZoom})`, transformOrigin: 'center center' }}
                >
                  <div className="relative w-[220px] h-[180px] flex items-center justify-center">
                    <svg width="240" height="200" viewBox="0 0 240 200" className="absolute inset-0 overflow-visible">
                      <defs>
                        <pattern id="hatch-pattern-box" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                          <line x1="0" y1="0" x2="0" y2="8" stroke="#00ffff" strokeWidth="0.8" strokeOpacity="0.5" />
                        </pattern>
                        <clipPath id="lshape-clip">
                          <polygon points="40,30 200,30 200,100 120,100 120,170 40,170" />
                        </clipPath>
                      </defs>
                      <rect width="240" height="200" fill="url(#hatch-pattern-box)" clipPath="url(#lshape-clip)" />
                      <polygon points="40,30 200,30 200,100 120,100 120,170 40,170" fill="none" stroke="#00ffff" strokeWidth="2.5" />
                    </svg>

                    {/* SIDE A */}
                    <div className="absolute flex items-center bg-black/95 border border-yellow-400 px-1 py-0.5 rounded shadow z-30" style={{ top: '12%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                      <span className="text-[9px] font-bold text-yellow-400 mr-1">A:</span>
                      <input type="number" value={plotDimensions.A} onChange={(e) => updateDimensionPart("A", "ft", Number(e.target.value))} className="w-10 text-center text-[10px] font-black bg-white text-black rounded" />
                    </div>

                    {/* SIDE B */}
                    <div className="absolute flex items-center bg-black/95 border border-yellow-400 px-1 py-0.5 rounded shadow z-30" style={{ top: '38%', left: '88%', transform: 'translate(-50%, -50%)' }}>
                      <span className="text-[9px] font-bold text-yellow-400 mr-1">B:</span>
                      <input type="number" value={plotDimensions.B} onChange={(e) => updateDimensionPart("B", "ft", Number(e.target.value))} className="w-10 text-center text-[10px] font-black bg-white text-black rounded" />
                    </div>

                    {/* SIDE C */}
                    <div className="absolute flex items-center bg-black/95 border border-yellow-400 px-1 py-0.5 rounded shadow z-30" style={{ top: '88%', left: '33%', transform: 'translate(-50%, -50%)' }}>
                      <span className="text-[9px] font-bold text-yellow-400 mr-1">C:</span>
                      <input type="number" value={plotDimensions.C} onChange={(e) => updateDimensionPart("C", "ft", Number(e.target.value))} className="w-10 text-center text-[10px] font-black bg-white text-black rounded" />
                    </div>

                    {/* SIDE D */}
                    <div className="absolute flex items-center bg-black/95 border border-yellow-400 px-1 py-0.5 rounded shadow z-30" style={{ top: '51%', left: '13%', transform: 'translate(-50%, -50%)' }}>
                      <span className="text-[9px] font-bold text-yellow-400 mr-1">D:</span>
                      <input type="number" value={plotDimensions.D} onChange={(e) => updateDimensionPart("D", "ft", Number(e.target.value))} className="w-10 text-center text-[10px] font-black bg-white text-black rounded" />
                    </div>

                    {/* SIDE E */}
                    <div className="absolute flex items-center bg-black/95 border border-cyan-400 px-1 py-0.5 rounded shadow z-30" style={{ top: '53%', left: '67%', transform: 'translate(-50%, -50%)' }}>
                      <span className="text-[9px] font-bold text-cyan-300 mr-1">E:</span>
                      <input type="number" value={plotDimensions.E} onChange={(e) => updateDimensionPart("E", "ft", Number(e.target.value))} className="w-10 text-center text-[10px] font-black bg-white text-black rounded" />
                    </div>

                    {/* SIDE F */}
                    <div className="absolute flex items-center bg-black/95 border border-cyan-400 px-1 py-0.5 rounded shadow z-30" style={{ top: '69%', left: '44%', transform: 'translate(-50%, -50%)' }}>
                      <span className="text-[9px] font-bold text-cyan-300 mr-1">F:</span>
                      <input type="number" value={plotDimensions.F} onChange={(e) => updateDimensionPart("F", "ft", Number(e.target.value))} className="w-10 text-center text-[10px] font-black bg-white text-black rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 bg-gray-50 p-3 border border-black flex-1 overflow-y-auto">
              {[
                { key: "A", label: "SIDE A", sub: "MAIN FRONT WIDTH (ROAD SIDE)" },
                ...(isRectangle ? [] : [{ key: "B", label: "SIDE B", sub: "REAR WIDTH" }]),
                { key: "C", label: "SIDE C", sub: "RIGHT DEPTH" },
                ...(isRectangle ? [] : [{ key: "D", label: "SIDE D", sub: "LEFT DEPTH" }]),
              ].map((item) => (
                <div key={item.key} className="border border-black p-2 bg-white">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-black text-xs">{item.label}</span>
                    <span className="text-[10px] text-gray-500 font-bold">{item.sub}</span>
                  </div>

                  {measurementUnit === "FEET" ? (
                    // --- FEET & INCHES VIEW ---
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center">
                        <input
                          type="number"
                          min={0}
                          value={dimDetails[item.key]?.ft || 0}
                          onChange={(e) => updateDimensionPart(item.key as any, "ft", Number(e.target.value))}
                          className="w-full border border-black p-1 text-center text-sm font-bold bg-white"
                        />
                        <span className="ml-1 text-xs font-bold">FT</span>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min={0}
                          max={11}
                          value={dimDetails[item.key]?.in || 0}
                          onChange={(e) => updateDimensionPart(item.key as any, "in", Number(e.target.value))}
                          className="w-full border border-black p-1 text-center text-sm font-bold bg-white"
                        />
                        <span className="ml-1 text-xs font-bold">IN</span>
                      </div>
                    </div>
                  ) : (
                    // --- METERS VIEW (Single Input Box) ---
                    <div className="flex items-center">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={plotDimensions[item.key] || 0}
                        onChange={(e) => updateDimensionPart(item.key as any, "ft", Number(e.target.value))}
                        className="w-full border border-black p-1 text-center text-sm font-bold bg-white"
                      />
                      <span className="ml-1 text-xs font-bold">M</span>
                    </div>
                  )}
                </div>
              ))}
              {isRectangle && (
                <div className="p-2 bg-blue-50 border border-blue-300 text-[11px] font-bold text-blue-800 text-center">
                  💡 Rectangle mode: Side B & D are automatically synced with A & C. Open CAD view to adjust details if needed.
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. MOS */}
        <div className={`${isMultiDimShape ? "col-span-1" : "col-span-3"} p-3 space-y-3 flex flex-col justify-between`}>
          <div className="space-y-3">
            <div className="font-black text-sm bg-gray-200 p-1 text-center border border-black">3. MOS</div>
            {["front", "rear", "left", "right"].map((key) => (
              <div key={key}>
                <label className="font-bold text-[9pt] uppercase block mb-1">{key}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!isShapeSelected || coverageType === "100_PERCENT"}
                  value={coverageType === "100_PERCENT" ? 0 : setbackInputs[key as keyof typeof setbackInputs]}
                  onChange={(event) => setSetbackInputs((prev) => ({ ...prev, [key]: Math.max(0, Number(event.target.value) || 0) }))}
                  className="w-full border border-black p-1.5 text-xs font-bold text-center disabled:bg-gray-100 bg-white"
                />
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-3 rounded-lg border border-slate-700 shadow-md text-center mt-3">
            <div className="text-[10px] font-extrabold tracking-wider text-amber-400 uppercase mb-0.5">NET BUILT-UP AREA (GF)</div>
            <div className="text-lg font-black tracking-tight text-cyan-300">
              {areDimensionsFilled ? `${calculatedNetArea.toFixed(2)} SQ.FT` : "---"}
            </div>
          </div>
        </div>

        {/* 4. BOUNDARIES */}
        <div className="col-span-3 p-3 space-y-3">
          <div className="font-black text-sm bg-gray-200 p-1 text-center border border-black">4. BOUNDARIES</div>
          {!areDetailsCompleted ? (
            <div className="h-[260px] flex items-center justify-center bg-gray-50 border border-dashed border-gray-400 p-4 text-center text-gray-500 font-bold text-xs">
              🔒 Complete Road, Shape & Dimensions to unlock boundaries.
            </div>
          ) : (
            [
              { label: "EAST", value: boundaryEast, setter: setBoundaryEast },
              { label: "WEST", value: boundaryWest, setter: setBoundaryWest },
              { label: "NORTH", value: boundaryNorth, setter: setBoundaryNorth },
              { label: "SOUTH", value: boundarySouth, setter: setBoundarySouth },

            ].map((item) => (
              <div key={item.label}>
                <label className="font-bold text-[9pt] block mb-1">{item.label}</label>
                <textarea
                  rows={2}
                  value={item.value}
                  onChange={(event) => item.setter(event.target.value)}
                  placeholder={`Enter ${item.label.toLowerCase()} boundary...`}
                  className="w-full border border-black p-1.5 text-xs font-bold uppercase bg-white resize-y min-h-[36px] focus:outline-none"
                />
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}