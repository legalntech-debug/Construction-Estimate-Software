"use client";

/* =========================================================
   SUBDIVISION LAYOUT + PLOT GEOMETRY
   ---------------------------------------------------------
   - Construction plan jaisa plot render (roads/boundaries)
   - Upar subdivision canvas (cut / split / carve)
   - Sidebar me pieces list
========================================================= */

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  applyCut,
  carvePlots,
  createRoot,
  cutAtDistance,
  describePieces,
  equalSplit,
  lShapePlot,
  mergePieces,
  normalizedPolygon,
  pieceToPlotDimensions,
  polygonArea,
  rectPlot,
  trapezoidPlot,
} from "../subdivisionEngine";
import type {
  Corner, CutScope, EdgeFrom, PieceInfo, PlotDimensions, Pt, SubPiece,
} from "../subdivisionTypes";
import { PlotDimensions as CPlanPlotDimensions } from "../../construction-plan/engine/planningTypes";

// ─── Construction plan components (roads, boundaries) ───
import PlotPolygonRenderer from "../../construction-plan/components/PlotPolygonRenderer";
import BoundaryLabels from "../../construction-plan/components/BoundaryLabels";
import RoadRenderer from "../../construction-plan/components/RoadRenderer";

type Tool = "SELECT" | "CUT" | "DRAW";
type ShapeKind = "RECT" | "L" | "TRAP" | "CUSTOM";

export interface SubdivisionLayoutWithPlotProps {
  unitLabel?: "ft" | "m";
  onPiecesChange?: (pieces: PieceInfo[]) => void;
  onGeneratePlan?: (data: {
    piece: PieceInfo;
    dimensions: PlotDimensions;
    polygon: Pt[];
  }) => void;

  // ─── Plot geometry (construction plan se) ───
  plotDimensions: CPlanPlotDimensions;
  roadFacingOption: string;
  boundaries: { north: string; south: string; east: string; west: string };
  measurementUnit: "FEET" | "METERS";
  roadWidthNorth?: number;
  roadWidthSouth?: number;
  roadWidthEast?: number;
  roadWidthWest?: number;
}

const PALETTE = [
  "#dbeafe", "#dcfce7", "#fef9c3", "#fce7f3",
  "#ede9fe", "#ffedd5", "#cffafe", "#e2e8f0",
];
const fmt = (n: number) =>
  Math.abs(n - Math.round(n)) < 0.005
    ? String(Math.round(n))
    : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

export default function SubdivisionLayoutWithPlot({
  unitLabel = "ft",
  onPiecesChange,
  onGeneratePlan,
  plotDimensions,
  roadFacingOption,
  boundaries,
  measurementUnit,
  roadWidthNorth = 15,
  roadWidthSouth = 15,
  roadWidthEast = 15,
  roadWidthWest = 15,
}: SubdivisionLayoutWithPlotProps) {
  // ─── Plot setup from props ───
  const dimA = Number(plotDimensions.A) || 30;
  const dimB = Number(plotDimensions.B) || dimA;
  const dimC = Number(plotDimensions.C) || 50;
  const dimD = Number(plotDimensions.D) || dimC;

  const scale = 5.5;

  // ─── Pieces state (initialised from plot dimensions) ───
  const [plot, setPlot] = useState<Pt[]>(() => rectPlot(dimA, dimC));
  const [history, setHistory] = useState<SubPiece[][]>(() => [
    createRoot(rectPlot(dimA, dimC)),
  ]);
  const pieces = history[history.length - 1];
  const infos = useMemo(() => describePieces(pieces), [pieces]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = infos.find((p) => p.id === selectedId) || null;

  // ✅ Parent ko pieces sync karo
  React.useEffect(() => {
    onPiecesChange?.(infos);
  }, [infos, onPiecesChange]);

  // ✅ Plot dimensions change hone par reset karo
  React.useEffect(() => {
    const newPlot = rectPlot(dimA, dimC);
    setPlot(newPlot);
    setHistory([createRoot(newPlot)]);
    setSelectedId(null);
  }, [dimA, dimC]);

  const commit = useCallback(
    (next: SubPiece[]) => setHistory((h) => [...h, next]),
    []
  );
  const undo = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const resetPieces = () => {
    setHistory([createRoot(plot)]);
    setSelectedId(null);
  };

  // ─── Tools ───
  const [tool, setTool] = useState<Tool>("SELECT");
  const [scope, setScope] = useState<CutScope>("ALL");
  const [snap, setSnap] = useState(0.5);
  const [ortho, setOrtho] = useState(true);
  const [cutStart, setCutStart] = useState<Pt | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);

  const [eqN, setEqN] = useState(3);
  const [eqDir, setEqDir] = useState<"VERTICAL" | "HORIZONTAL">("VERTICAL");
  const [distFrom, setDistFrom] = useState<EdgeFrom>("LEFT");
  const [dist, setDist] = useState(10);
  const [carve, setCarve] = useState({
    w: 10, d: 30, count: 3, corner: "TL" as Corner,
  });

  // ─── Viewbox (SVG pixel space) ───
  const bb = useMemo(() => {
    const pts = tool === "DRAW" && plot.length ? plot : plot;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [plot, tool]);
  const span = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY, 10);
  const pad = span * 0.14;
  const vb = {
    x: bb.minX - pad,
    y: bb.minY - pad,
    w: bb.maxX - bb.minX + pad * 2,
    h: bb.maxY - bb.minY + pad * 2,
  };
  const fs = Math.max(vb.w, vb.h) / 48;
  const svgRef = useRef<SVGSVGElement>(null);

  const toFeet = (e: React.MouseEvent): Pt => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM()!.inverse();
    const r = pt.matrixTransform(m);
    const sx = snap > 0 ? Math.round(r.x / snap) * snap : r.x;
    const sy = snap > 0 ? Math.round(r.y / snap) * snap : r.y;
    return { x: sx, y: sy };
  };

  const orthoPoint = (from: Pt, to: Pt): Pt => {
    if (!ortho) return to;
    return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
      ? { x: to.x, y: from.y }
      : { x: from.x, y: to.y };
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    const p = toFeet(e);
    if (tool === "CUT") {
      if (!cutStart) {
        setCutStart(p);
      } else {
        const end = orthoPoint(cutStart, p);
        if (Math.hypot(end.x - cutStart.x, end.y - cutStart.y) > 0.01) {
          const cutScope: CutScope =
            scope === "PIECE" && selected ? "PIECE" : "ALL";
          commit(
            applyCut(pieces, {
              a: cutStart,
              b: end,
              scope: cutScope,
              pieceId: selected?.id,
            })
          );
        }
        setCutStart(null);
      }
    }
  };

  const onMove = (e: React.MouseEvent) => {
    if (tool === "SELECT") return;
    const p = toFeet(e);
    setHover(tool === "CUT" && cutStart ? orthoPoint(cutStart, p) : p);
  };

  // ─── Panel actions ───
  const needSel = !selected;
  const doEqual = () =>
    selected && commit(equalSplit(pieces, selected.id, Math.max(2, eqN), eqDir));
  const doDist = () =>
    selected && commit(cutAtDistance(pieces, selected.id, distFrom, dist));
  const doCarve = () => selected && commit(carvePlots(pieces, selected.id, carve));
  const toggleKind = (id: string) =>
    commit(
      pieces.map((p) =>
        p.id === id
          ? { ...p, kind: p.kind === "PLOT" ? "REMAINDER" : "PLOT" }
          : p
      )
    );
  const doMerge = (idB: string) => {
    if (!selected) return;
    const m = mergePieces(pieces, selected.id, idB);
    if (m) commit(m);
    else alert("Ye do pieces jud nahi sakte.");
  };
  const neighbours = selected
    ? infos.filter(
        (o) => o.id !== selected.id && mergePieces(pieces, selected.id, o.id) !== null
      )
    : [];

  const plotCount = infos.filter((p) => p.kind === "PLOT").length;
  const totalArea = Math.round(polygonArea(plot) * 100) / 100;
  const usedArea =
    Math.round(
      infos.filter((p) => p.kind === "PLOT").reduce((s, p) => s + p.area, 0) * 100
    ) / 100;

  // ─── Render helpers ───
  const path = (poly: Pt[]) =>
    poly.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") + " Z";

  const btn =
    "px-2 py-1 border border-black text-xs font-bold bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer";
  const btnOn = "px-2 py-1 border border-black text-xs font-bold bg-slate-900 text-white cursor-pointer";
  const inp = "border border-black px-1 py-0.5 text-xs w-16";

  // ─── Construction plan plot coords (px) ───
  const bottomWidth = dimA * scale;
  const topWidth = dimB * scale;
  const heightLeft = dimC * scale;
  const heightRight = dimD * scale;

  const pBottomLeft = { x: -bottomWidth / 2, y: heightLeft / 2 };
  const pBottomRight = { x: bottomWidth / 2, y: heightLeft / 2 };
  const pTopLeft = { x: -topWidth / 2, y: -heightLeft / 2 };
  const pTopRight = { x: topWidth / 2, y: -heightRight / 2 };

  const correctedPoints = [pTopLeft, pTopRight, pBottomRight, pBottomLeft];
  const centerX = (pTopLeft.x + pBottomRight.x) / 2;
  const centerY = (pTopLeft.y + pBottomRight.y) / 2;
  const minX = Math.min(pTopLeft.x, pBottomLeft.x);
  const maxX = Math.max(pTopRight.x, pBottomRight.x);

  const roadOptUpper = (roadFacingOption || "").toUpperCase();
  const activeNorth = roadOptUpper.includes("NORTH") || roadOptUpper.includes("ALL") || roadOptUpper.includes("CORNER");
  const activeSouth = roadOptUpper.includes("SOUTH") || roadOptUpper.includes("ALL");
  const activeEast = roadOptUpper.includes("EAST") || roadOptUpper.includes("ALL") || roadOptUpper.includes("CORNER");
  const activeWest = roadOptUpper.includes("WEST") || roadOptUpper.includes("ALL");

  // ─── Piece polygons in construction-plan world coords ───
  const piecePolys = useMemo(() => {
    return infos.map((pc, idx) => {
      const ox = pTopLeft.x;
      const oy = pTopLeft.y;
      return {
        ...pc,
        idx,
        worldPoly: pc.polygon.map((p) => ({
          x: ox + p.x * scale,
          y: oy + p.y * scale,
        })),
      };
    });
  }, [infos, pTopLeft.x, pTopLeft.y, scale]);

  return (
    <div className="border-2 border-black bg-white text-black">
      <div className="bg-slate-900 text-white px-3 py-2 font-black tracking-wide">
        SUB DIVISION LAYOUT
      </div>

      <div className="grid grid-cols-12 gap-0">
        {/* ════ LEFT PANEL — tools ════ */}
        <div className="col-span-12 lg:col-span-3 border-r border-black p-3 space-y-4 text-xs">
          {/* 1. Plot shape summary */}
          <section>
            <div className="font-black mb-1">1. PLOT SHAPE</div>
            <div className="text-[10px] text-gray-600 mb-1">
              {dimA}' × {dimC}' ({measurementUnit === "FEET" ? "Feet" : "Meters"})
            </div>
            <div className="text-[10px] text-gray-500">
              Plot geometry neeche canvas me dikh rahi hai.
              Plot badalne ke liye input form me "2. PLOT GEOMETRY" use karo.
            </div>
          </section>

          {/* 2. Tools */}
          <section>
            <div className="font-black mb-1">2. SUB DIVIDE</div>
            <div className="flex gap-1 flex-wrap mb-2">
              <button
                className={tool === "SELECT" ? btnOn : btn}
                onClick={() => { setTool("SELECT"); setCutStart(null); }}
              >
                SELECT
              </button>
              <button
                className={tool === "CUT" ? btnOn : btn}
                onClick={() => { setTool("CUT"); setCutStart(null); }}
              >
                DRAW CUT LINE
              </button>
              <button className={btn} onClick={undo} disabled={history.length < 2}>
                UNDO
              </button>
              <button className={btn} onClick={resetPieces}>
                CLEAR CUTS
              </button>
            </div>

            <div className="flex gap-3 items-center mb-2">
              <label>
                <input type="checkbox" checked={ortho} onChange={(e) => setOrtho(e.target.checked)} /> ORTHO
              </label>
              <label>
                SNAP{" "}
                <select className="border border-black text-xs" value={snap} onChange={(e) => setSnap(+e.target.value)}>
                  <option value={0}>OFF</option>
                  <option value={0.25}>0.25</option>
                  <option value={0.5}>0.5</option>
                  <option value={1}>1</option>
                  <option value={5}>5</option>
                </select>
              </label>
            </div>

            <div className="mb-2">
              CUT SCOPE:{" "}
              <label className="mr-2">
                <input type="radio" checked={scope === "ALL"} onChange={() => setScope("ALL")} /> POORA PLOT
              </label>
              <label>
                <input type="radio" checked={scope === "PIECE"} onChange={() => setScope("PIECE")} /> SELECTED
              </label>
            </div>

            <div className={`border border-black p-2 space-y-3 ${needSel ? "opacity-50" : ""}`}>
              <div className="font-bold">
                {needSel
                  ? "PEHLE KOI PIECE SELECT KARO ↑"
                  : `SELECTED: ${selected!.label} (${fmt(selected!.bbox.w)} x ${fmt(selected!.bbox.h)})`}
              </div>

              <div>
                <div className="font-bold mb-1">EQUAL SPLIT</div>
                <div className="flex gap-1 items-center flex-wrap">
                  <input className={inp} type="number" min={2} value={eqN} onChange={(e) => setEqN(+e.target.value)} /> PARTS
                  <select className="border border-black text-xs" value={eqDir} onChange={(e) => setEqDir(e.target.value as any)}>
                    <option value="VERTICAL">VERTICAL</option>
                    <option value="HORIZONTAL">HORIZONTAL</option>
                  </select>
                  <button className={btn} disabled={needSel} onClick={doEqual}>SPLIT</button>
                </div>
              </div>

              <div>
                <div className="font-bold mb-1">EDGE SE DISTANCE PAR CUT</div>
                <div className="flex gap-1 items-center flex-wrap">
                  <select className="border border-black text-xs" value={distFrom} onChange={(e) => setDistFrom(e.target.value as EdgeFrom)}>
                    <option value="LEFT">LEFT SE</option>
                    <option value="RIGHT">RIGHT SE</option>
                    <option value="TOP">TOP SE</option>
                    <option value="BOTTOM">BOTTOM SE</option>
                  </select>
                  <input className={inp} type="number" value={dist} onChange={(e) => setDist(+e.target.value)} /> {unitLabel}
                  <button className={btn} disabled={needSel} onClick={doDist}>CUT</button>
                </div>
              </div>

              <div>
                <div className="font-bold mb-1">SIZE SE CARVE (W x D x COUNT)</div>
                <div className="flex gap-1 items-center flex-wrap">
                  <input className={inp} type="number" value={carve.w} onChange={(e) => setCarve({ ...carve, w: +e.target.value })} /> x
                  <input className={inp} type="number" value={carve.d} onChange={(e) => setCarve({ ...carve, d: +e.target.value })} /> x
                  <input className={inp} type="number" min={1} value={carve.count} onChange={(e) => setCarve({ ...carve, count: Math.max(1, +e.target.value) })} />
                  <select className="border border-black text-xs" value={carve.corner} onChange={(e) => setCarve({ ...carve, corner: e.target.value as Corner })}>
                    <option value="TL">TOP-LEFT</option>
                    <option value="TR">TOP-RIGHT</option>
                    <option value="BL">BOTTOM-LEFT</option>
                    <option value="BR">BOTTOM-RIGHT</option>
                  </select>
                  <button className={btn} disabled={needSel} onClick={doCarve}>CARVE</button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ════ CENTER — CANVAS with PLOT + ROADS + PIECES ════ */}
        <div className="col-span-12 lg:col-span-6 bg-white relative" style={{ minHeight: 640 }}>
          <svg
            ref={svgRef}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            className="w-full h-full absolute inset-0"
            style={{
              cursor: tool === "SELECT" ? "default" : "crosshair",
              background: "#fff",
            }}
            onClick={onCanvasClick}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            {/* ─── Construction plan plot + roads + boundaries ─── */}
            <g transform={`translate(0,0)`}>
              <PlotPolygonRenderer
                plotPolygon={correctedPoints}
                proposedSitePolygon={[]}
                cadZoom={1}
                isSelected={false}
                handlePolygonClick={() => {}}
              />

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
                roadWidthNorth={activeNorth ? roadWidthNorth : 0}
                roadWidthSouth={activeSouth ? roadWidthSouth : 0}
                roadWidthEast={activeEast ? roadWidthEast : 0}
                roadWidthWest={activeWest ? roadWidthWest : 0}
              />
            </g>

            {/* ─── Subdivision pieces overlay (with world coords) ─── */}
            <g transform={`translate(${pTopLeft.x}, ${pTopLeft.y})`}>
              {infos.map((pc) => {
                const isSel = pc.id === selectedId;
                const isPlot = pc.kind === "PLOT";
                const fill = isPlot
                  ? PALETTE[(pc.number - 1) % PALETTE.length]
                  : "#f1f5f9";

                return (
                  <g
                    key={pc.id}
                    onClick={(e) => {
                      if (tool === "SELECT") {
                        e.stopPropagation();
                        setSelectedId(isSel ? null : pc.id);
                      }
                    }}
                    style={{ cursor: tool === "SELECT" ? "pointer" : "crosshair" }}
                  >
                    {/* Piece polygon (in feet, scaled by `scale` because parent translate is in feet) */}
                    <path
                      d={path(pc.polygon)}
                      fill={fill}
                      stroke={isSel ? "#dc2626" : "#0f172a"}
                      strokeWidth={isSel ? fs * 0.18 : fs * 0.1}
                      strokeLinejoin="round"
                      opacity={0.9}
                      transform={`scale(${scale})`}
                    />

                    {/* Label */}
                    <g transform={`translate(${pc.centroid.x * scale}, ${pc.centroid.y * scale})`}>
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        y={-fs * 0.5}
                        fontSize={fs * 1.0}
                        fontWeight="900"
                        fill="#0f172a"
                        pointerEvents="none"
                        style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "3px" }}
                      >
                        {pc.label}
                      </text>
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        y={fs * 0.9}
                        fontSize={fs * 0.75}
                        fill="#1e40af"
                        fontWeight="700"
                        pointerEvents="none"
                        style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "2px" }}
                      >
                        {pc.isRect
                          ? `${fmt(pc.bbox.w)} × ${fmt(pc.bbox.h)}`
                          : "IRREGULAR"}{" "}
                        · {fmt(pc.area)} sq{unitLabel}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>

            {/* ─── Plot outline on top (from construction plan) ─── */}
            <PlotPolygonRenderer
              plotPolygon={correctedPoints}
              proposedSitePolygon={[]}
              cadZoom={1}
              isSelected={false}
              handlePolygonClick={() => {}}
            />

            {/* Cut preview line */}
            {tool === "CUT" && cutStart && hover && (() => {
              const dx = hover.x - cutStart.x;
              const dy = hover.y - cutStart.y;
              const L = Math.hypot(dx, dy) || 1;
              const big = 500;
              return (
                <g pointerEvents="none">
                  <line
                    x1={pTopLeft.x + (cutStart.x - (dx / L) * big) * scale}
                    y1={pTopLeft.y + (cutStart.y - (dy / L) * big) * scale}
                    x2={pTopLeft.x + (cutStart.x + (dx / L) * big) * scale}
                    y2={pTopLeft.y + (cutStart.y + (dy / L) * big) * scale}
                    stroke="#dc2626"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                  />
                  <circle
                    cx={pTopLeft.x + cutStart.x * scale}
                    cy={pTopLeft.y + cutStart.y * scale}
                    r="3"
                    fill="#dc2626"
                  />
                </g>
              );
            })()}
          </svg>
        </div>

        {/* ════ RIGHT PANEL — pieces list ════ */}
        <div className="col-span-12 lg:col-span-3 border-l border-black p-3 text-xs space-y-2">
          <div className="font-black">
            3. PIECES ({plotCount} PLOT{plotCount === 1 ? "" : "S"})
          </div>
          <div className="text-slate-700">
            TOTAL: {fmt(totalArea)} sq{unitLabel} · PLOTS: {fmt(usedArea)} · OPEN: {fmt(Math.round((totalArea - usedArea) * 100) / 100)}
          </div>
          <div className="space-y-1 max-h-[520px] overflow-auto">
            {infos.map((pc) => (
              <div
                key={pc.id}
                className={`border p-2 ${pc.id === selectedId ? "border-red-600 bg-red-50" : "border-black"}`}
                onClick={() => setSelectedId(pc.id)}
              >
                <div className="flex justify-between items-center">
                  <b>{pc.label}</b>
                  <span>
                    {pc.isRect
                      ? `${fmt(pc.bbox.w)} x ${fmt(pc.bbox.h)}`
                      : `BOX ${fmt(pc.bbox.w)} x ${fmt(pc.bbox.h)}`}{" "}
                    · {fmt(pc.area)} sq{unitLabel}
                  </span>
                </div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <button
                    className={btn}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleKind(pc.id);
                    }}
                  >
                    {pc.kind === "PLOT" ? "MAKE OPEN" : "MAKE PLOT"}
                  </button>
                  {pc.kind === "PLOT" && onGeneratePlan && (
                    <button
                      className={btnOn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onGeneratePlan({
                          piece: pc,
                          dimensions: pieceToPlotDimensions(pc),
                          polygon: normalizedPolygon(pc),
                        });
                      }}
                    >
                      GENERATE PLAN →
                    </button>
                  )}
                </div>
                {pc.id === selectedId && neighbours.length > 0 && (
                  <div className="mt-1">
                    MERGE WITH:{" "}
                    <select
                      className="border border-black text-xs"
                      value=""
                      onChange={(e) => e.target.value && doMerge(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">— choose —</option>
                      {neighbours.map((n) => (
                        <option key={n.id} value={n.id}>{n.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}