"use client";

import React from "react";
// ✅ Rasta theek kiya gaya hai
import { PlotDimensions, PlotShape } from "../subdivisionTypes";

interface SubdivisionConfigSectionProps {
  measurementUnit: "FEET" | "METERS";
  setMeasurementUnit: (val: "FEET" | "METERS") => void;
  roadFacingOption: string;
  setRoadFacingOption: (val: string) => void;
  plotShape: PlotShape | "IRREGULAR" | "L-SHAPE" | "";
  setPlotShape: (val: PlotShape | "IRREGULAR" | "L-SHAPE" | "") => void;
  plotArea: number;
  plotDimensions: PlotDimensions;
  updateDimensionPart: (side: keyof PlotDimensions, field: "ft" | "in", val: number) => void;
  dimDetails: Record<string, { ft: number; in: number }>;
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
  dimensionHistory: PlotDimensions[];
  handleUndo: () => void;
  handleResetDimensions: () => void;
  isMultiDimShape: boolean;
  calculatedNetArea?: number;
}

const safeValue = (val: number | undefined) => (val === 0 || val === undefined ? "" : val);

export default function SubdivisionConfigSection({
  measurementUnit,
  setMeasurementUnit,
  roadFacingOption,
  setRoadFacingOption,
  plotShape,
  setPlotShape,
  plotArea,
  plotDimensions,
  updateDimensionPart,
  dimDetails,
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
  dimensionHistory,
  handleUndo,
  handleResetDimensions,
  isMultiDimShape,
  calculatedNetArea = 0,
}: SubdivisionConfigSectionProps) {
  const isRoadSelected = Boolean(roadFacingOption && roadFacingOption.trim() !== "");
  const isShapeSelected = isRoadSelected && Boolean(plotShape && plotShape.trim() !== "");
  const isRectangle = (plotShape as string).toUpperCase() === "RECTANGLE";

  const onResetClick = () => {
    const confirmed = window.confirm("Are you sure you want to reset plot?");
    if (confirmed) {
      handleResetDimensions();
      updateDimensionPart("A", "ft", 0);
      updateDimensionPart("B", "ft", 0);
      updateDimensionPart("C", "ft", 0);
      updateDimensionPart("D", "ft", 0);
    }
  };

  return (
    <div className="border border-black mb-4 bg-white shadow-sm">
      <div className="bg-slate-900 text-white p-3 font-black text-base md:text-xl flex flex-col sm:flex-row justify-between items-center px-4 gap-2">
        <span className="text-center flex-1 tracking-tight">SUBDIVISION — PLOT GEOMETRY</span>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleUndo}
            disabled={dimensionHistory.length === 0}
            className="bg-yellow-500 text-black px-3 py-1.5 text-xs font-black rounded hover:bg-yellow-400 disabled:opacity-40 cursor-pointer flex-1 sm:flex-initial"
          >
            ↩ UNDO
          </button>
          <button
            type="button"
            onClick={onResetClick}
            className="bg-red-600 text-white px-3 py-1.5 text-xs font-black rounded hover:bg-red-700 cursor-pointer flex-1 sm:flex-initial"
          >
            🔄 RESET
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black">
        {/* 1. PLOT & ROAD */}
        <div className="col-span-12 md:col-span-4 p-4 space-y-4">
          <div className="font-black text-sm bg-gray-200 p-1.5 text-center border border-black">
            1. PLOT & ROAD
          </div>

          <div>
            <label className="font-bold text-[11pt] block mb-1">UNIT</label>
            <select
              value={measurementUnit}
              onChange={(e) => setMeasurementUnit(e.target.value as any)}
              className="w-full border border-black p-2.5 text-sm font-bold bg-white"
            >
              <option value="FEET">FEET</option>
              <option value="METERS">METERS</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-[11pt] block mb-1">ROAD / FRONT SIDE <span className="text-red-600">*</span></label>
            <select
              value={roadFacingOption}
              onChange={(e) => setRoadFacingOption(e.target.value)}
              className="w-full border border-black p-2.5 text-sm font-bold bg-yellow-50 cursor-pointer"
            >
              <option value="">-- SELECT ROAD SIDE --</option>
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
              onChange={(e) => setPlotShape(e.target.value as any)}
              className="w-full border border-black p-2.5 text-sm font-bold bg-white disabled:bg-gray-100 cursor-pointer"
            >
              <option value="">-- CHOOSE SHAPE --</option>
              {PLOT_SHAPES.map((shape) => (
                <option key={shape} value={shape}>{shape}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-[11pt] block mb-1">PLOT AREA</label>
            <div className={`border border-black p-2.5 text-center font-black text-base ${isShapeSelected ? "bg-gray-100" : "bg-gray-200 text-gray-400"}`}>
              {isShapeSelected ? `${plotArea.toFixed(2)} SQ.${measurementUnit === "FEET" ? "FT" : "M"}` : "---"}
            </div>
          </div>
        </div>

        {/* 2. DIMENSIONS */}
        <div className={`col-span-12 ${isMultiDimShape ? "md:col-span-5" : "md:col-span-4"} p-4 space-y-3`}>
          <div className="bg-gray-200 border border-black p-1.5 text-center font-black text-sm">
            2. DIMENSIONS
          </div>

          {!isShapeSelected ? (
            <div className="flex items-center justify-center bg-gray-50 border border-dashed border-gray-400 p-8 text-center text-gray-500 font-bold text-sm min-h-[200px]">
              🔒 Select Road & Plot Shape first.
            </div>
          ) : (
            <div className="space-y-3 bg-gray-50 p-3 border border-black">
              {[
                { key: "A", label: "SIDE A", sub: "FRONT WIDTH" },
                ...(isRectangle ? [] : [{ key: "B", label: "SIDE B", sub: "REAR WIDTH" }]),
                { key: "C", label: "SIDE C", sub: "RIGHT DEPTH" },
                ...(isRectangle ? [] : [{ key: "D", label: "SIDE D", sub: "LEFT DEPTH" }]),
              ].map((item) => (
                <div key={item.key} className="border border-black p-2.5 bg-white">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-black text-xs">{item.label}</span>
                    <span className="text-[10px] text-gray-500 font-bold">{item.sub}</span>
                  </div>
                  {measurementUnit === "FEET" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center">
                        <input
                          type="number"
                          min={0}
                          value={safeValue(dimDetails[item.key]?.ft)}
                          onChange={(e) => updateDimensionPart(item.key as any, "ft", Number(e.target.value))}
                          className="w-full border border-black p-2 text-center text-sm font-bold"
                        />
                        <span className="ml-1 text-xs font-bold">FT</span>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min={0}
                          max={11}
                          value={safeValue(dimDetails[item.key]?.in)}
                          onChange={(e) => updateDimensionPart(item.key as any, "in", Number(e.target.value))}
                          className="w-full border border-black p-2 text-center text-sm font-bold"
                        />
                        <span className="ml-1 text-xs font-bold">IN</span>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={safeValue(plotDimensions[item.key])}
                      onChange={(e) => updateDimensionPart(item.key as any, "ft", Number(e.target.value))}
                      className="w-full border border-black p-2 text-center text-sm font-bold"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. BOUNDARIES */}
        <div className="col-span-12 md:col-span-4 p-4 space-y-3">
          <div className="font-black text-sm bg-gray-200 p-1.5 text-center border border-black">
            3. BOUNDARIES
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-3">
            {[
              { label: "EAST", value: boundaryEast, setter: setBoundaryEast },
              { label: "WEST", value: boundaryWest, setter: setBoundaryWest },
              { label: "NORTH", value: boundaryNorth, setter: setBoundaryNorth },
              { label: "SOUTH", value: boundarySouth, setter: setBoundarySouth },
            ].map((item) => (
              <div key={item.label}>
                <label className="font-bold text-[10px] block mb-1">{item.label}</label>
                <textarea
                  rows={2}
                  value={item.value}
                  onChange={(e) => item.setter(e.target.value)}
                  placeholder={`Enter ${item.label.toLowerCase()} boundary...`}
                  className="w-full border border-black p-2 text-xs font-bold uppercase resize-y min-h-[40px]"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}