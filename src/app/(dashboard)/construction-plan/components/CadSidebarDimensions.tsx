import React from "react";
import { PlotDimensions } from "@/lib/constructionPlan/types";

interface CadSidebarDimensionsProps {
  editModeToggle: "PLOT" | "MOS";
  setEditModeToggle: React.Dispatch<React.SetStateAction<"PLOT" | "MOS">>;
  isSimpleRect: boolean;
  isMultiDimShape: boolean;
  plotDimensions: PlotDimensions;
  updateDimensionPart: (side: keyof PlotDimensions, field: "ft" | "in", val: number) => void;
  sideAngles: Record<string, number>;
  setSideAngles: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  mosAngles: Record<string, number>;
  setMosAngles: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  sideSlant: Record<string, "MID" | "LEFT" | "RIGHT">;
  setSideSlant: React.Dispatch<React.SetStateAction<Record<string, "MID" | "LEFT" | "RIGHT">>>;
  sideMos: Record<string, number>;
  handleMosChange: (side: string, val: number) => void;
  actualLenA: number;
  actualLenB: number;
  actualLenC: number;
  actualLenD: number;
  dimA: number;
  dimC: number;
  calculatedArea: number;
  plotArea: number;
  measurementUnit: "FEET" | "METERS";
  boundaryNorth: string;
  setBoundaryNorth: (val: string) => void;
  boundarySouth: string;
  setBoundarySouth: (val: string) => void;
  boundaryEast: string;
  setBoundaryEast: (val: string) => void;
  boundaryWest: string;
  setBoundaryWest: (val: string) => void;
  currentRoadWidth: number;
  handleRoadWidthChange: (val: number) => void;
}

export default function CadSidebarDimensions({
  editModeToggle,
  setEditModeToggle,
  isSimpleRect,
  isMultiDimShape,
  plotDimensions,
  updateDimensionPart,
  sideAngles,
  setSideAngles,
  mosAngles,
  setMosAngles,
  sideSlant,
  setSideSlant,
  sideMos,
  handleMosChange,
  actualLenA,
  actualLenB,
  actualLenC,
  actualLenD,
  dimA,
  dimC,
  calculatedArea,
  plotArea,
  measurementUnit,
  boundaryNorth,
  setBoundaryNorth,
  boundarySouth,
  setBoundarySouth,
  boundaryEast,
  setBoundaryEast,
  boundaryWest,
  setBoundaryWest,
  currentRoadWidth,
  handleRoadWidthChange,
}: CadSidebarDimensionsProps) {
  return (
    <div className="col-span-3 border-l border-black bg-gray-100 p-2.5 overflow-y-auto flex flex-col space-y-2">
      {/* EDIT PLOT DIMENSIONS HEADER WITH CORNER TOGGLE BUTTONS */}
      <div className="flex items-center justify-between mb-1">
        <div className="font-black text-xs">EDIT PLOT DIMENSIONS</div>
        <div className="flex border border-black bg-white">
          <button
            type="button"
            onClick={() => setEditModeToggle("PLOT")}
            className={`px-1.5 py-0.5 text-[8px] font-black cursor-pointer ${
              editModeToggle === "PLOT" ? "bg-blue-700 text-white" : "bg-white text-black hover:bg-gray-100"
            }`}
          >
            PLOT
          </button>
          <button
            type="button"
            onClick={() => setEditModeToggle("MOS")}
            className={`px-1.5 py-0.5 text-[8px] font-black cursor-pointer ${
              editModeToggle === "MOS" ? "bg-red-600 text-white" : "bg-white text-black hover:bg-gray-100"
            }`}
          >
            MOS
          </button>
        </div>
      </div>

      {/* Column Headers */}
      {isSimpleRect ? (
        <div className="grid grid-cols-2 gap-1 px-0.5 text-[7.5px] font-black text-gray-700 text-center">
          <div>DIST</div>
          <div>MOS</div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1 px-0.5 text-[7.5px] font-black text-gray-700 text-center">
          <div>DIST</div>
          <div>MOS</div>
          <div>DEG</div>
          <div>SLANT</div>
        </div>
      )}

      {(isSimpleRect ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", ...(isMultiDimShape ? ["E", "F"] : [])]).map((side) => {
        let mosLabel = `SIDE ${side}`;
        if (side === "A") mosLabel = `FRONT (A)`;
        else if (side === "B") mosLabel = `BACK (B)`;
        else if (side === "C") mosLabel = `LEFT (C)`;
        else if (side === "D") mosLabel = `RIGHT (D)`;

        let displayLength = plotDimensions?.[side as keyof PlotDimensions] || 0;
        if (!isSimpleRect) {
          if (side === "A" && sideAngles.A) displayLength = Number(actualLenA.toFixed(1));
          if (side === "B" && sideAngles.B) displayLength = Number(actualLenB.toFixed(1));
          if (side === "C" && sideAngles.C) displayLength = Number(actualLenC.toFixed(1));
          if (side === "D" && sideAngles.D) displayLength = Number(actualLenD.toFixed(1));
        } else {
          if (side === "B") displayLength = dimA;
          if (side === "D") displayLength = dimC;
        }

        return (
          <div key={side} className="border border-black bg-white p-1.5 flex flex-col gap-1 shadow-sm">
            <span className="font-black text-[10px]">{mosLabel}:</span>
            {isSimpleRect ? (
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-0.5 bg-gray-50 border border-black px-1 py-0.5">
                  <input
                    type="number"
                    value={displayLength}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (side === "B") {
                        updateDimensionPart("A", "ft", val);
                      } else if (side === "D") {
                        updateDimensionPart("C", "ft", val);
                      } else {
                        updateDimensionPart(side as any, "ft", val);
                      }
                    }}
                    className="w-full bg-transparent text-center font-black text-[9px] text-black outline-none"
                  />
                </div>
                <div className="flex items-center gap-0.5 bg-gray-50 border border-black px-1 py-0.5">
                  <input
                    type="number"
                    value={sideMos[side] || 0}
                    onChange={(e) => handleMosChange(side, Number(e.target.value) || 0)}
                    className="w-full bg-transparent text-center font-black text-[9px] text-red-600 outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1">
                <div className="flex items-center gap-0.5 bg-gray-50 border border-black px-1 py-0.5">
                  <input
                    type="number"
                    value={displayLength}
                    onChange={(e) => {
                      updateDimensionPart(side as any, "ft", Number(e.target.value));
                    }}
                    className="w-full bg-transparent text-center font-black text-[9px] text-black outline-none"
                  />
                </div>
                <div className="flex items-center gap-0.5 bg-gray-50 border border-black px-1 py-0.5">
                  <input
                    type="number"
                    value={sideMos[side] || 0}
                    onChange={(e) => handleMosChange(side, Number(e.target.value) || 0)}
                    className="w-full bg-transparent text-center font-black text-[9px] text-red-600 outline-none"
                  />
                </div>
                <div className="flex items-center gap-0.5 bg-gray-50 border border-black px-1 py-0.5">
                  <input
                    type="number"
                    placeholder="DEG"
                    value={editModeToggle === "PLOT" ? (sideAngles[side] || 0) : (mosAngles[side] || 0)}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      if (editModeToggle === "PLOT") {
                        setSideAngles((prev) => ({ ...prev, [side]: val }));
                      } else {
                        setMosAngles((prev) => ({ ...prev, [side]: val }));
                      }
                    }}
                    className="w-full bg-transparent text-center font-black text-[9px] text-black outline-none"
                  />
                </div>
                <div className="flex items-center gap-0.5 bg-gray-50 border border-black px-0.5 py-0.5">
                  <select
                    value={sideSlant[side] || "MID"}
                    onChange={(e) => {
                      const val = e.target.value as "MID" | "LEFT" | "RIGHT";
                      setSideSlant((prev) => ({ ...prev, [side]: val }));
                    }}
                    className="w-full bg-transparent text-center font-black text-[8px] text-black outline-none uppercase cursor-pointer"
                  >
                    <option value="MID">MID</option>
                    <option value="LEFT">LEFT</option>
                    <option value="RIGHT">RIGHT</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Area Badge */}
      <div className="border border-black bg-yellow-100 p-1.5 font-black text-center text-xs mt-1">
        AREA: {(isSimpleRect ? (dimA * dimC) : (calculatedArea || plotArea)).toFixed(2)} SQ.{measurementUnit === "FEET" ? "FEET" : "METERS"}
      </div>

      {/* BOUNDARIES REFERENCE SECTION */}
      <div className="border-t-2 border-black pt-2 mt-2">
        <div className="font-black text-xs mb-1.5">PLOT BOUNDARIES</div>
        <div className="border border-black bg-white p-2 flex flex-col gap-1.5 shadow-sm text-[11px]">
          <div>
            <span className="font-bold text-[10px] block">EAST:</span>
            <input
              type="text"
              value={boundaryEast || ""}
              onChange={(e) => setBoundaryEast(e.target.value.toUpperCase())}
              style={{ textTransform: "uppercase" }}
              className="w-full border border-black p-1 text-xs font-bold bg-white text-black mt-0.5 box-border"
            />
          </div>
          <div>
            <span className="font-bold text-[10px] block">WEST:</span>
            <input
              type="text"
              value={boundaryWest || ""}
              onChange={(e) => setBoundaryWest(e.target.value.toUpperCase())}
              style={{ textTransform: "uppercase" }}
              className="w-full border border-black p-1 text-xs font-bold bg-white text-black mt-0.5 box-border"
            />
          </div>
          <div>
            <span className="font-bold text-[10px] block">NORTH:</span>
            <input
              type="text"
              value={boundaryNorth || ""}
              onChange={(e) => setBoundaryNorth(e.target.value.toUpperCase())}
              style={{ textTransform: "uppercase" }}
              className="w-full border border-black p-1 text-xs font-bold bg-white text-black mt-0.5 box-border"
            />
          </div>
          <div>
            <span className="font-bold text-[10px] block">SOUTH:</span>
            <input
              type="text"
              value={boundarySouth || ""}
              onChange={(e) => setBoundarySouth(e.target.value.toUpperCase())}
              style={{ textTransform: "uppercase" }}
              className="w-full border border-black p-1 text-xs font-bold bg-white text-black mt-0.5 box-border"
            />
          </div>
        </div>
      </div>

      {/* ROAD WIDTH SECTION */}
      <div className="border-t-2 border-black pt-2 margin-top-2">
        <div className="font-black text-xs mb-1.5">ROAD WIDTH (FEET)</div>
        <div className="border border-black bg-white p-2 flex flex-col gap-1 shadow-sm text-[11px]">
          <div className="flex items-center gap-1 bg-gray-500/10 border border-black px-1.5 py-1">
            <input
              type="number"
              value={currentRoadWidth}
              onChange={(e) => handleRoadWidthChange(Number(e.target.value) || 15)}
              className="w-full bg-transparent text-center font-black text-xs text-black outline-none"
            />
            <span className="text-[10px] font-bold text-gray-600">FT</span>
          </div>
        </div>
      </div>
    </div>
  );
}