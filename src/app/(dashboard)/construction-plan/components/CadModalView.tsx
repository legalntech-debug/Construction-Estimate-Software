import React, { useState } from "react";
import PlotCadCanvas from "./PlotCadCanvas";
import PlotPolygonRenderer from "./PlotPolygonRenderer";
import BoundaryLabels from "./BoundaryLabels";
import RoadRenderer from "./RoadRenderer";
import { PlotDimensions, CadObject } from "@/lib/constructionPlan/types";

type CadTool = 
  | "SELECT" | "LINE" | "PLINE" | "RECTANGLE" | "OFFSET" 
  | "MOVE" | "COPY" | "ROTATE" | "DELETE" | "DIMENSION" | "TEXT" | "HATCH";

interface CadModalViewProps {
  isCadModalOpen: boolean;
  setIsCadModalOpen: (open: boolean) => void;
  plotShape: string;
  roadFacingOption: string;
  cadZoom: number;
  setCadZoom: React.Dispatch<React.SetStateAction<number>>;
  cadTool: CadTool;
  setCadCommand: (tool: CadTool) => void;
  orthMode: boolean;
  setOrthMode: React.Dispatch<React.SetStateAction<boolean>>;
  osnapMode: boolean;
  setOsnapMode: React.Dispatch<React.SetStateAction<boolean>>;
  undoLastCadAction: () => void;
  copySelectedCadObjects: () => void;
  rotateSelectedCadObjects: (angle: number) => void;
  deleteSelectedCadObjects: () => void;
  cadRotation: number;
  setCadRotation: (val: number) => void;
  cadText: string;
  setCadText: (val: string) => void;
  cadContainerRef: React.RefObject<HTMLDivElement | null>;
  handleMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleCadMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseUp: () => void;
  handleCadCanvasClick: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleCadDoubleClick: () => void;
  panOffset: { x: number; y: number };
  plotDimensions: PlotDimensions;
  updateDimensionPart: (side: keyof PlotDimensions, field: "ft" | "in", val: number) => void;
  measurementUnit: "FEET" | "METERS";
  plotArea: number;
  isMultiDimShape: boolean;
  boundaryNorth: string;
  setBoundaryNorth: (val: string) => void;
  boundarySouth: string;
  setBoundarySouth: (val: string) => void;
  boundaryEast: string;
  setBoundaryEast: (val: string) => void;
  boundaryWest: string;
  setBoundaryWest: (val: string) => void;
  cadObjects: CadObject[];
  selectedCadObjectIds: string[];
  toggleCadSelection: (id: string) => void;
  activeDrawingStart: { x: number; y: number } | null;
  mouseCurrentPoint: { x: number; y: number } | null;
}

export default function CadModalView({
  isCadModalOpen,
  setIsCadModalOpen,
  plotShape,
  roadFacingOption,
  cadZoom,
  setCadZoom,
  cadTool,
  setCadCommand,
  orthMode,
  setOrthMode,
  osnapMode,
  setOsnapMode,
  undoLastCadAction,
  copySelectedCadObjects,
  rotateSelectedCadObjects,
  deleteSelectedCadObjects,
  cadRotation,
  setCadRotation,
  cadText,
  setCadText,
  cadContainerRef,
  handleMouseDown,
  handleCadMouseMove,
  handleMouseUp,
  handleCadCanvasClick,
  handleCadDoubleClick,
  panOffset,
  plotDimensions,
  updateDimensionPart,
  measurementUnit,
  plotArea,
  isMultiDimShape,
  boundaryNorth,
  setBoundaryNorth,
  boundarySouth,
  setBoundarySouth,
  boundaryEast,
  setBoundaryEast,
  boundaryWest,
  setBoundaryWest,
  cadObjects,
  selectedCadObjectIds,
  toggleCadSelection,
  activeDrawingStart,
  mouseCurrentPoint,
}: CadModalViewProps) {
  const [sideAngles, setSideAngles] = useState<Record<string, number>>({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 });
  const [isCustomIrregular, setIsCustomIrregular] = useState<boolean>(false);

  if (!isCadModalOpen) return null;

  const currentZoom = cadZoom && cadZoom > 0.1 ? cadZoom : 1.2;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-2 flex flex-col uppercase font-sans">
      <div className="bg-white w-full h-full border-2 border-black flex flex-col relative overflow-hidden">
        {/* Top Header Bar */}
        <div className="bg-slate-950 text-white p-2 flex items-center justify-between">
          <div className="font-black text-xs">
            CONSTRUCTION CAD — {isCustomIrregular ? "IRREGULAR / CUSTOM SHAPE" : (plotShape || "RECTANGLE")} | ROAD: {roadFacingOption || "NOT SPECIFIED"}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white text-black px-2 py-0.5 text-[10px] font-black border border-black">
              <span>ZOOM: {Math.round(currentZoom * 100)}%</span>
              <button type="button" onClick={() => setCadZoom((prev) => Math.max(0.2, (prev || 1) - 0.1))} className="px-1 font-bold hover:bg-gray-200 cursor-pointer">-</button>
              <button type="button" onClick={() => setCadZoom((prev) => Math.min(3, (prev || 1) + 0.1))} className="px-1 font-bold hover:bg-gray-200 cursor-pointer">+</button>
              <button type="button" onClick={() => setCadZoom(1.2)} className="px-1 font-bold hover:bg-gray-200 text-red-600 cursor-pointer">RESET</button>
            </div>
            <button type="button" onClick={() => setIsCadModalOpen(false)} className="bg-red-600 px-4 py-1 font-black text-xs cursor-pointer text-white">CLOSE</button>
          </div>
        </div>

        {/* CAD Toolbar */}
        <div className="border-b border-black bg-gray-100 p-2 flex gap-1 flex-wrap items-center">
          {(["SELECT", "LINE", "PLINE", "RECTANGLE", "OFFSET", "MOVE", "COPY", "ROTATE", "DELETE", "DIMENSION", "TEXT", "HATCH"] as CadTool[]).map((tool) => (
            <button
              key={tool}
              type="button"
              onClick={() => setCadCommand(tool)}
              className={`px-2 py-1 border border-black text-[9px] font-black cursor-pointer ${cadTool === tool ? "bg-blue-700 text-white" : "bg-white"}`}
            >
              {tool}
            </button>
          ))}
          <button type="button" onClick={() => setOrthMode((v) => !v)} className={`px-2 py-1 border border-black text-[9px] font-black cursor-pointer ${orthMode ? "bg-green-600 text-white" : "bg-white"}`}>ORTHO</button>
          <button type="button" onClick={() => setOsnapMode((v) => !v)} className={`px-2 py-1 border border-black text-[9px] font-black cursor-pointer ${osnapMode ? "bg-green-600 text-white" : "bg-white"}`}>OSNAP</button>
          <button type="button" onClick={undoLastCadAction} className="px-2 py-1 border border-black text-[9px] font-black bg-yellow-200 cursor-pointer">UNDO</button>
          <button type="button" onClick={copySelectedCadObjects} className="px-2 py-1 border border-black text-[9px] font-black bg-white cursor-pointer">COPY</button>
          <button type="button" onClick={() => rotateSelectedCadObjects(cadRotation)} className="px-2 py-1 border border-black text-[9px] font-black bg-white cursor-pointer">ROTATE</button>
          <button type="button" onClick={deleteSelectedCadObjects} className="px-2 py-1 border border-black text-[9px] font-black bg-red-100 cursor-pointer">DELETE</button>
          <input type="number" value={cadRotation} onChange={(e) => setCadRotation(Number(e.target.value) || 0)} className="w-16 border border-black p-1 text-[9px] text-center" title="Rotation" />
          <input value={cadText} onChange={(e) => setCadText(e.target.value)} placeholder="TEXT" className="w-32 border border-black p-1 text-[9px]" />
        </div>

        {/* CAD Canvas Area with Right Sidebar */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden relative">
          <div 
            className="col-span-9 h-full relative overflow-hidden bg-white"
            onWheel={(e) => {
              // Mouse wheel delta se zoom calculate karein
              const delta = e.deltaY < 0 ? 0.1 : -0.1;
              setCadZoom((prev) => Math.min(3, Math.max(0.2, (prev || 1) + delta)));
            }}
          >
            <PlotCadCanvas
              cadContainerRef={cadContainerRef}
              cadZoom={currentZoom}
              handleMouseDown={handleMouseDown}
              handleCadMouseMove={handleCadMouseMove}
              handleMouseUp={handleMouseUp}
              handleCadCanvasClick={handleCadCanvasClick}
              handleCadDoubleClick={handleCadDoubleClick}
            >
              {/* North Badge Direction */}
              {(() => {
                const opt = (roadFacingOption || "").toUpperCase();
                let northText = "↑ NORTH";
                let badgePos = "top-2 left-2";
                
                if (opt.includes("EAST")) {
                  northText = "← NORTH (WEST)";
                } else if (opt.includes("WEST")) {
                  northText = "→ NORTH (EAST)";
                  badgePos = "top-2 right-2";
                } else if (opt.includes("NORTH")) {
                  northText = "↓ NORTH (REAR / SOUTH)";
                  badgePos = "bottom-2 left-2";
                } else {
                  northText = "↑ NORTH (FRONT)";
                  badgePos = "top-2 left-2";
                }

return (
  <div className={`absolute ${badgePos} z-10 bg-yellow-300 border border-black px-2 py-1 text-[10px] font-black flex items-center gap-1 shadow-md pointer-events-none`}>
    <span>{northText}</span>
  </div>
);
              })()}

              {/* Master Group Render with Safe Fallback Dimensions */}
              {(() => {
                let dimA = Number(plotDimensions?.A) || 30;
                let dimB = (!isCustomIrregular && (plotShape === "RECTANGLE" || plotShape === "SQUARE")) ? dimA : (Number(plotDimensions?.B) || dimA);
                let dimC = Number(plotDimensions?.C) || 40;
                let dimD = (!isCustomIrregular && (plotShape === "RECTANGLE" || plotShape === "SQUARE")) ? dimC : (Number(plotDimensions?.D) || dimC);

                const scale = 5.5; 
                const bottomWidth = dimA * scale;
                const topWidth = dimB * scale;
                const heightLeft = dimC * scale;
                const heightRight = dimD * scale;

                const pBottomLeft = { x: -bottomWidth / 2, y: heightLeft / 2 };
                const pBottomRight = { x: bottomWidth / 2, y: heightLeft / 2 };
                const pTopLeft = { x: -topWidth / 2, y: -heightLeft / 2 };
                const pTopRight = { x: topWidth / 2, y: -heightRight / 2 };

                const correctedPoints = [pTopLeft, pTopRight, pBottomRight, pBottomLeft];
                const xs = correctedPoints.map(p => p.x);
                const ys = correctedPoints.map(p => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;

                const effectiveRotation = cadRotation + (sideAngles.A || 0);

                return (
                  <g transform={`translate(380, 120) scale(${currentZoom}) rotate(${effectiveRotation}) translate(${panOffset?.x || 0}, ${panOffset?.y || 0})`}>
                    <PlotPolygonRenderer
                      plotPolygon={correctedPoints}
                      proposedSitePolygon={correctedPoints}
                      cadZoom={currentZoom}
                      isSelected={false}
                      handlePolygonClick={() => {}}
                    />
                    <BoundaryLabels
                      topBoundary={boundaryNorth}
                      bottomBoundary={boundarySouth}
                      leftBoundary={boundaryWest}
                      rightBoundary={boundaryEast}
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
                    />
                    <RoadRenderer
                      roadFacingOption={roadFacingOption}
                      bottomBoundary={boundarySouth}
                      topBoundary={boundaryNorth}
                      boundaryEast={boundaryEast}
                      boundaryWest={boundaryWest}
                      pTopLeft={pTopLeft}
                      pTopRight={pTopRight}
                      pBottomLeft={pBottomLeft}
                      pBottomRight={pBottomRight}
                    />

                    {/* Proposed Site Label */}
                    <g transform={`translate(${centerX}, ${centerY})`}>
                      <rect x="-65" y="-16" width="130" height="32" fill="#121212" stroke="#ffffff" strokeWidth="1.5" />
                      <text x="0" y="5" textAnchor="middle" fill="#ffffff" style={{ fontWeight: "900", fontSize: "13px", fontFamily: "sans-serif" }}>
                        PROPOSED SITE
                      </text>
                    </g>
                  </g>
                );
              })()}

              {/* Render User CAD Objects */}
              {cadObjects?.map((obj) => {
                const isSelected = selectedCadObjectIds?.includes(obj.id);
                const strokeColor = isSelected ? "red" : "black";
                const strokeW = 2;

                if (obj.type === "LINE" && obj.points?.length >= 2) {
                  return (
                    <line
                      key={obj.id}
                      x1={obj.points[0].x}
                      y1={obj.points[0].y}
                      x2={obj.points[1].x}
                      y2={obj.points[1].y}
                      stroke={strokeColor}
                      strokeWidth={strokeW}
                      onClick={(e) => { e.stopPropagation(); toggleCadSelection(obj.id); }}
                      className="cursor-pointer"
                    />
                  );
                }
                if ((obj.type === "POLYLINE" || obj.type === "RECTANGLE") && obj.points?.length >= 2) {
                  return (
                    <polygon
                      key={obj.id}
                      points={obj.points.map(p => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeW}
                      onClick={(e) => { e.stopPropagation(); toggleCadSelection(obj.id); }}
                      className="cursor-pointer"
                    />
                  );
                }
                if (obj.type === "TEXT" && obj.points?.length > 0) {
                  return (
                    <text
                      key={obj.id}
                      x={obj.points[0].x}
                      y={obj.points[0].y}
                      fill={strokeColor}
                      fontSize="14"
                      fontWeight="bold"
                      transform={`rotate(${obj.rotation || 0}, ${obj.points[0].x}, ${obj.points[0].y})`}
                      onClick={(e) => { e.stopPropagation(); toggleCadSelection(obj.id); }}
                      className="cursor-pointer"
                    >
                      {obj.text}
                    </text>
                  );
                }
                return null;
              })}
            </PlotCadCanvas>
          </div>

          {/* Right Sidebar: Edit Plot Dimensions & Boundaries */}
          <div className="col-span-3 border-l border-black bg-gray-100 p-2.5 overflow-y-auto flex flex-col space-y-2">
            <div className="font-black text-xs mb-1">EDIT PLOT DIMENSIONS</div>

            {/* Side Rows with Equal Columns for Dimension & Angle */}
            {["A", "B", "C", "D", ...(isMultiDimShape ? ["E", "F"] : [])].map((side) => (
              <div key={side} className="border border-black bg-white p-1.5 flex flex-col gap-1 shadow-sm">
                <span className="font-black text-[10px]">SIDE {side}:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center gap-1 bg-gray-50 border border-black px-1 py-0.5">
                    <input
                      type="number"
                      value={plotDimensions?.[side as keyof PlotDimensions] || 0}
                      onChange={(e) => {
                        setIsCustomIrregular(true);
                        updateDimensionPart(side as any, "ft", Number(e.target.value));
                      }}
                      className="w-full bg-transparent text-center font-black text-[11px] text-black outline-none"
                    />
                    <span className="text-[9px] font-bold text-gray-600">{measurementUnit === "FEET" ? "FT" : "M"}</span>
                  </div>

                  <div className="flex items-center gap-1 bg-gray-50 border border-black px-1 py-0.5">
                    <input
                      type="number"
                      value={sideAngles[side] || 0}
                      onChange={(e) => {
                        setIsCustomIrregular(true);
                        const val = Number(e.target.value) || 0;
                        setSideAngles((prev) => ({ ...prev, [side]: val }));
                      }}
                      className="w-full bg-transparent text-center font-black text-[11px] text-black outline-none"
                    />
                    <span className="text-[9px] font-bold text-gray-600">°</span>
                  </div>
                </div>
              </div>
            ))}

            <div className="border border-black bg-yellow-100 p-1.5 font-black text-center text-xs mt-1">
              AREA: {plotArea ? plotArea.toFixed(2) : "0.00"} SQ.{measurementUnit === "FEET" ? "FEET" : "METERS"}
            </div>

            {/* BOUNDARIES REFERENCE SECTION */}
            <div className="border-t-2 border-black pt-2 mt-2">
              <div className="font-black text-xs mb-1.5">PLOT BOUNDARIES</div>
              <div className="border border-black bg-white p-2 flex flex-col gap-1.5 shadow-sm text-[11px]">
                <div>
                  <span className="font-bold text-[10px] block">NORTH:</span>
                  <input
                    type="text"
                    value={boundaryNorth || ""}
                    onChange={(e) => setBoundaryNorth(e.target.value)}
                    className="w-full border border-black p-1 text-xs font-bold bg-white text-black mt-0.5 box-border"
                  />
                </div>
                <div>
                  <span className="font-bold text-[10px] block">SOUTH:</span>
                  <input
                    type="text"
                    value={boundarySouth || ""}
                    onChange={(e) => setBoundarySouth(e.target.value)}
                    className="w-full border border-black p-1 text-xs font-bold bg-white text-black mt-0.5 box-border"
                  />
                </div>
                <div>
                  <span className="font-bold text-[10px] block">EAST:</span>
                  <input
                    type="text"
                    value={boundaryEast || ""}
                    onChange={(e) => setBoundaryEast(e.target.value)}
                    className="w-full border border-black p-1 text-xs font-bold bg-white text-black mt-0.5 box-border"
                  />
                </div>
                <div>
                  <span className="font-bold text-[10px] block">WEST:</span>
                  <input
                    type="text"
                    value={boundaryWest || ""}
                    onChange={(e) => setBoundaryWest(e.target.value)}
                    className="w-full border border-black p-1 text-xs font-bold bg-white text-black mt-0.5 box-border"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}