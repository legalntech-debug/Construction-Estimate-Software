"use client";

/* =========================================================
SUBDIVISION LAYOUT — editor component
---------------------------------------------------------
1) Plot ka shape banao (Rectangle / L / Trapezoid / apna polygon draw)
2) Plot ko kitne bhi tukdo me todo:
     - Cut line draw karo (poora plot ya sirf selected piece)
     - Equal split (N barabar hisse)
     - Edge se distance par cut  (e.g. LEFT se 10 ft)
     - Size se carve (W x D x N, e.g. 10x30 x 3)
3) Har piece ek alag plot hai -> "GENERATE PLAN" se existing
   construction-plan engine me us piece ka size chala jata hai.
========================================================= */

import React, { useCallback, useMemo, useRef, useState } from "react";
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
  Corner,
  CutScope,
  EdgeFrom,
  PieceInfo,
  PlotDimensions,
  Pt,
  SubPiece,
} from "../subdivisionTypes";

type Tool = "SELECT" | "CUT" | "DRAW";
type ShapeKind = "RECT" | "L" | "TRAP" | "CUSTOM";

export interface SubdivisionLayoutProps {
  unitLabel?: "ft" | "m";
  /** Piece par "GENERATE PLAN" dabane par chalta hai */
  onGeneratePlan?: (data: {
    piece: PieceInfo;
    dimensions: PlotDimensions;
    polygon: Pt[];
  }) => void;
  /** ✅ NEW: parent ko pieces sync karo (preview ke liye) */
  onPiecesChange?: (pieces: PieceInfo[]) => void;
}

const PALETTE = [
  "#dbeafe", "#dcfce7", "#fef9c3", "#fce7f3",
  "#ede9fe", "#ffedd5", "#cffafe", "#e2e8f0",
];
const fmt = (n: number) =>
  Math.abs(n - Math.round(n)) < 0.005
    ? String(Math.round(n))
    : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

export default function SubdivisionLayout({
  unitLabel = "ft",
  onGeneratePlan,
  onPiecesChange,
}: SubdivisionLayoutProps) {
  /* ---------- plot + pieces (with undo history) ---------- */
  const [plot, setPlot] = useState<Pt[]>(() => rectPlot(30, 50));
  const [history, setHistory] = useState<SubPiece[][]>(() => [
    createRoot(rectPlot(30, 50)),
  ]);
  const pieces = history[history.length - 1];
  const infos = useMemo(() => describePieces(pieces), [pieces]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = infos.find((p) => p.id === selectedId) || null;

  /* ✅ Parent ko pieces sync karo */
  React.useEffect(() => {
    onPiecesChange?.(infos);
  }, [infos, onPiecesChange]);

  const commit = useCallback(
    (next: SubPiece[]) => setHistory((h) => [...h, next]),
    []
  );
  const undo = () =>
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const resetPieces = () => {
    setHistory([createRoot(plot)]);
    setSelectedId(null);
  };

  /* ---------- plot setup ---------- */
  const [shapeKind, setShapeKind] = useState<ShapeKind>("RECT");
  const [rect, setRect] = useState({ w: 30, d: 50 });
  const [lsh, setLsh] = useState({
    w: 40,
    d: 50,
    cw: 15,
    ch: 20,
    corner: "TR" as Corner,
  });
  const [trap, setTrap] = useState({
    top: 20,
    bottom: 30,
    left: 40,
    right: 35,
  });
  const [draft, setDraft] = useState<Pt[]>([]);

  const setNewPlot = (poly: Pt[]) => {
    setPlot(poly);
    setHistory([createRoot(poly)]);
    setSelectedId(null);
    setTool("SELECT");
  };
  const applyShape = () => {
    if (shapeKind === "RECT") setNewPlot(rectPlot(rect.w, rect.d));
    else if (shapeKind === "L")
      setNewPlot(lShapePlot(lsh.w, lsh.d, lsh.cw, lsh.ch, lsh.corner));
    else if (shapeKind === "TRAP")
      setNewPlot(trapezoidPlot(trap.top, trap.bottom, trap.left, trap.right));
    else {
      setDraft([]);
      setTool("DRAW");
    }
  };

  /* ---------- tools ---------- */
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
    w: 10,
    d: 30,
    count: 3,
    corner: "TL" as Corner,
  });

  /* ---------- view box ---------- */
  const bb = useMemo(() => {
    const pts = tool === "DRAW" && draft.length ? [...plot, ...draft] : plot;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }, [plot, draft, tool]);
  const span = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY, 10);
  const pad = span * 0.14;
  const vb =
    tool === "DRAW"
      ? { x: -10, y: -10, w: 80, h: 70 }
      : {
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
    if (tool === "DRAW") {
      if (
        draft.length >= 3 &&
        Math.hypot(p.x - draft[0].x, p.y - draft[0].y) <
          Math.max(snap, 1) * 1.1
      )
        return closeDraft();
      setDraft((d) => [...d, p]);
    } else if (tool === "CUT") {
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
  const closeDraft = () => {
    if (draft.length >= 3 && polygonArea(draft) > 1) setNewPlot(draft);
    setDraft([]);
  };

  const onMove = (e: React.MouseEvent) => {
    if (tool === "SELECT") return;
    const p = toFeet(e);
    setHover(tool === "CUT" && cutStart ? orthoPoint(cutStart, p) : p);
  };

  /* ---------- panel actions ---------- */
  const needSel = !selected;
  const doEqual = () =>
    selected &&
    commit(equalSplit(pieces, selected.id, Math.max(2, eqN), eqDir));
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
    else
      alert(
        "Ye do pieces jud nahi sakte (adjacent nahi hain ya union simple shape nahi banata)."
      );
  };
  const neighbours = selected
    ? infos.filter(
        (o) => o.id !== selected.id && mergePieces(pieces, selected.id, o.id) !== null
      )
    : [];

  const exportSvg = () => {
    const el = svgRef.current;
    if (!el) return;
    const blob = new Blob([new XMLSerializer().serializeToString(el)], {
      type: "image/svg+xml",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "subdivision-layout.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const plotCount = infos.filter((p) => p.kind === "PLOT").length;
  const totalArea = Math.round(polygonArea(plot) * 100) / 100;
  const usedArea =
    Math.round(
      infos.filter((p) => p.kind === "PLOT").reduce((s, p) => s + p.area, 0) * 100
    ) / 100;

  /* ---------- render helpers ---------- */
  const path = (poly: Pt[]) =>
    poly.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") + " Z";

  const edgeLabels = (pc: PieceInfo) =>
    pc.polygon.map((p, i) => {
      const q = pc.polygon[(i + 1) % pc.polygon.length];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len < fs * 1.2) return null;
      const mx = (p.x + q.x) / 2,
        my = (p.y + q.y) / 2;
      let ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      if (ang > 90 || ang < -90) ang += 180;
      const c = pc.centroid;
      const vx = c.x - mx,
        vy = c.y - my,
        vl = Math.hypot(vx, vy) || 1;
      const ox = mx + (vx / vl) * fs * 0.9,
        oy = my + (vy / vl) * fs * 0.9;
      return (
        <text
          key={i}
          x={ox}
          y={oy}
          fontSize={fs * 0.8}
          fill="#334155"
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(${ang} ${ox} ${oy})`}
        >
          {fmt(len)}
        </text>
      );
    });

  const btn =
    "px-2 py-1 border border-black text-xs font-bold bg-white hover:bg-slate-100 disabled:opacity-40";
  const btnOn = "px-2 py-1 border border-black text-xs font-bold bg-slate-900 text-white";
  const inp = "border border-black px-1 py-0.5 text-xs w-16";

  return (
    <div className="border-2 border-black bg-white text-black">
      <div className="bg-slate-900 text-white px-3 py-2 font-black tracking-wide">
        SUB DIVISION LAYOUT
      </div>

      <div className="grid grid-cols-12 gap-0">
        {/* ============ LEFT PANEL ============ */}
        <div className="col-span-12 lg:col-span-3 border-r border-black p-3 space-y-4 text-xs">
          {/* 1. plot shape */}
          <section>
            <div className="font-black mb-1">1. PLOT SHAPE</div>
            <div className="flex gap-1 flex-wrap mb-2">
              {(
                [
                  ["RECT", "RECTANGLE"],
                  ["L", "L-SHAPE"],
                  ["TRAP", "TRAPEZOID"],
                  ["CUSTOM", "DRAW OWN"],
                ] as [ShapeKind, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  className={shapeKind === k ? btnOn : btn}
                  onClick={() => setShapeKind(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            {shapeKind === "RECT" && (
              <div className="flex gap-2 items-center">
                W{" "}
                <input
                  className={inp}
                  type="number"
                  value={rect.w}
                  onChange={(e) => setRect({ ...rect, w: +e.target.value })}
                />
                D{" "}
                <input
                  className={inp}
                  type="number"
                  value={rect.d}
                  onChange={(e) => setRect({ ...rect, d: +e.target.value })}
                />
              </div>
            )}
            {shapeKind === "L" && (
              <div className="grid grid-cols-2 gap-1">
                <label>
                  W{" "}
                  <input
                    className={inp}
                    type="number"
                    value={lsh.w}
                    onChange={(e) => setLsh({ ...lsh, w: +e.target.value })}
                  />
                </label>
                <label>
                  D{" "}
                  <input
                    className={inp}
                    type="number"
                    value={lsh.d}
                    onChange={(e) => setLsh({ ...lsh, d: +e.target.value })}
                  />
                </label>
                <label>
                  CUT W{" "}
                  <input
                    className={inp}
                    type="number"
                    value={lsh.cw}
                    onChange={(e) => setLsh({ ...lsh, cw: +e.target.value })}
                  />
                </label>
                <label>
                  CUT D{" "}
                  <input
                    className={inp}
                    type="number"
                    value={lsh.ch}
                    onChange={(e) => setLsh({ ...lsh, ch: +e.target.value })}
                  />
                </label>
                <label className="col-span-2">
                  CUT CORNER{" "}
                  <select
                    className="border border-black text-xs"
                    value={lsh.corner}
                    onChange={(e) =>
                      setLsh({ ...lsh, corner: e.target.value as Corner })
                    }
                  >
                    <option value="TL">TOP-LEFT</option>
                    <option value="TR">TOP-RIGHT</option>
                    <option value="BL">BOTTOM-LEFT</option>
                    <option value="BR">BOTTOM-RIGHT</option>
                  </select>
                </label>
              </div>
            )}
            {shapeKind === "TRAP" && (
              <div className="grid grid-cols-2 gap-1">
                <label>
                  TOP{" "}
                  <input
                    className={inp}
                    type="number"
                    value={trap.top}
                    onChange={(e) => setTrap({ ...trap, top: +e.target.value })}
                  />
                </label>
                <label>
                  BOTTOM{" "}
                  <input
                    className={inp}
                    type="number"
                    value={trap.bottom}
                    onChange={(e) => setTrap({ ...trap, bottom: +e.target.value })}
                  />
                </label>
                <label>
                  LEFT{" "}
                  <input
                    className={inp}
                    type="number"
                    value={trap.left}
                    onChange={(e) => setTrap({ ...trap, left: +e.target.value })}
                  />
                </label>
                <label>
                  RIGHT{" "}
                  <input
                    className={inp}
                    type="number"
                    value={trap.right}
                    onChange={(e) => setTrap({ ...trap, right: +e.target.value })}
                  />
                </label>
              </div>
            )}
            {shapeKind === "CUSTOM" && (
              <div className="text-slate-600 normal-case">
                Canvas par click karke corners lagao. Pehle point par wapas
                click (ya CLOSE) se shape band hoga.
              </div>
            )}
            <button className={`${btn} mt-2 w-full`} onClick={applyShape}>
              {shapeKind === "CUSTOM" ? "START DRAWING" : "SET PLOT (RESETS CUTS)"}
            </button>
            {tool === "DRAW" && (
              <div className="flex gap-1 mt-1">
                <button
                  className={btn}
                  onClick={closeDraft}
                  disabled={draft.length < 3}
                >
                  CLOSE SHAPE
                </button>
                <button
                  className={btn}
                  onClick={() => {
                    setDraft([]);
                    setTool("SELECT");
                  }}
                >
                  CANCEL
                </button>
              </div>
            )}
          </section>

          {/* 2. tools */}
          <section>
            <div className="font-black mb-1">2. SUB DIVIDE</div>
            <div className="flex gap-1 flex-wrap mb-2">
              <button
                className={tool === "SELECT" ? btnOn : btn}
                onClick={() => {
                  setTool("SELECT");
                  setCutStart(null);
                }}
              >
                SELECT
              </button>
              <button
                className={tool === "CUT" ? btnOn : btn}
                onClick={() => {
                  setTool("CUT");
                  setCutStart(null);
                }}
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
                <input
                  type="checkbox"
                  checked={ortho}
                  onChange={(e) => setOrtho(e.target.checked)}
                />{" "}
                ORTHO
              </label>
              <label>
                SNAP{" "}
                <select
                  className="border border-black text-xs"
                  value={snap}
                  onChange={(e) => setSnap(+e.target.value)}
                >
                  <option value={0}>OFF</option>
                  <option value={0.25}>0.25</option>
                  <option value={0.5}>0.5</option>
                  <option value={1}>1</option>
                  <option value={5}>5</option>
                </select>
              </label>
            </div>
            <div className="mb-2">
              CUT LINE SCOPE:{" "}
              <label className="mr-2">
                <input
                  type="radio"
                  checked={scope === "ALL"}
                  onChange={() => setScope("ALL")}
                />{" "}
                POORA PLOT
              </label>
              <label>
                <input
                  type="radio"
                  checked={scope === "PIECE"}
                  onChange={() => setScope("PIECE")}
                />{" "}
                SELECTED PIECE
              </label>
            </div>
            {tool === "CUT" && (
              <div className="text-slate-600 normal-case mb-2">
                {cutStart
                  ? "Line ka doosra point click karo."
                  : "Line ka pehla point click karo. Line poore piece ke aar-paar kategi."}
              </div>
            )}

            <div className={`border border-black p-2 space-y-3 ${needSel ? "opacity-50" : ""}`}>
              <div className="font-bold">
                {needSel
                  ? "PEHLE KOI PIECE SELECT KARO ↑"
                  : `SELECTED: ${selected!.label} (${fmt(selected!.bbox.w)} x ${fmt(selected!.bbox.h)})`}
              </div>

              <div>
                <div className="font-bold mb-1">EQUAL SPLIT</div>
                <div className="flex gap-1 items-center flex-wrap">
                  <input
                    className={inp}
                    type="number"
                    min={2}
                    value={eqN}
                    onChange={(e) => setEqN(+e.target.value)}
                  />{" "}
                  PARTS
                  <select
                    className="border border-black text-xs"
                    value={eqDir}
                    onChange={(e) => setEqDir(e.target.value as any)}
                  >
                    <option value="VERTICAL">VERTICAL (| | |)</option>
                    <option value="HORIZONTAL">HORIZONTAL (≡)</option>
                  </select>
                  <button className={btn} disabled={needSel} onClick={doEqual}>
                    SPLIT
                  </button>
                </div>
              </div>

              <div>
                <div className="font-bold mb-1">EDGE SE DISTANCE PAR CUT</div>
                <div className="flex gap-1 items-center flex-wrap">
                  <select
                    className="border border-black text-xs"
                    value={distFrom}
                    onChange={(e) => setDistFrom(e.target.value as EdgeFrom)}
                  >
                    <option value="LEFT">LEFT SE</option>
                    <option value="RIGHT">RIGHT SE</option>
                    <option value="TOP">TOP SE</option>
                    <option value="BOTTOM">BOTTOM SE</option>
                  </select>
                  <input
                    className={inp}
                    type="number"
                    value={dist}
                    onChange={(e) => setDist(+e.target.value)}
                  />{" "}
                  {unitLabel}
                  <button className={btn} disabled={needSel} onClick={doDist}>
                    CUT
                  </button>
                </div>
              </div>

              <div>
                <div className="font-bold mb-1">SIZE SE CARVE (W x D x COUNT)</div>
                <div className="flex gap-1 items-center flex-wrap">
                  <input
                    className={inp}
                    type="number"
                    value={carve.w}
                    onChange={(e) => setCarve({ ...carve, w: +e.target.value })}
                  />{" "}
                  x
                  <input
                    className={inp}
                    type="number"
                    value={carve.d}
                    onChange={(e) => setCarve({ ...carve, d: +e.target.value })}
                  />{" "}
                  x
                  <input
                    className={inp}
                    type="number"
                    min={1}
                    value={carve.count}
                    onChange={(e) =>
                      setCarve({ ...carve, count: Math.max(1, +e.target.value) })
                    }
                  />
                  <select
                    className="border border-black text-xs"
                    value={carve.corner}
                    onChange={(e) =>
                      setCarve({ ...carve, corner: e.target.value as Corner })
                    }
                  >
                    <option value="TL">TOP-LEFT SE</option>
                    <option value="TR">TOP-RIGHT SE</option>
                    <option value="BL">BOTTOM-LEFT SE</option>
                    <option value="BR">BOTTOM-RIGHT SE</option>
                  </select>
                  <button className={btn} disabled={needSel} onClick={doCarve}>
                    CARVE
                  </button>
                </div>
                <div className="text-slate-600 normal-case mt-1">
                  Bacha hua hissa OPEN/REMAINDER ban jata hai (baad me PLOT bana
                  sakte ho).
                </div>
              </div>
            </div>
          </section>

          <button className={`${btn} w-full`} onClick={exportSvg}>
            DOWNLOAD LAYOUT (SVG)
          </button>
        </div>

        {/* ============ CANVAS ============ */}
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
            onDoubleClick={() => tool === "DRAW" && closeDraft()}
          >
            <defs>
              <pattern
                id="sub-grid"
                width={snap >= 1 ? snap : 1}
                height={snap >= 1 ? snap : 1}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${snap >= 1 ? snap : 1} 0 L 0 0 0 ${snap >= 1 ? snap : 1}`}
                  fill="none"
                  stroke="#eef2f7"
                  strokeWidth={0.03 * (vb.w / 60)}
                />
              </pattern>
            </defs>
            <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#sub-grid)" />

            {tool !== "DRAW" &&
              infos.map((pc, i) => {
                const isSel = pc.id === selectedId;
                const fill =
                  pc.kind === "PLOT"
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
                  >
                    <path
                      d={path(pc.polygon)}
                      fill={fill}
                      stroke={isSel ? "#dc2626" : "#0f172a"}
                      strokeWidth={isSel ? fs * 0.18 : fs * 0.1}
                      strokeLinejoin="round"
                    />
                    {pc.kind === "REMAINDER" && (
                      <path
                        d={path(pc.polygon)}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth={fs * 0.05}
                        strokeDasharray={`${fs * 0.3} ${fs * 0.3}`}
                      />
                    )}
                    {edgeLabels(pc)}
                    <text
                      x={pc.centroid.x}
                      y={pc.centroid.y - fs * 0.5}
                      fontSize={fs * 1.05}
                      fontWeight={800}
                      textAnchor="middle"
                      fill="#0f172a"
                      pointerEvents="none"
                    >
                      {pc.label}
                    </text>
                    <text
                      x={pc.centroid.x}
                      y={pc.centroid.y + fs * 0.9}
                      fontSize={fs * 0.8}
                      textAnchor="middle"
                      fill="#334155"
                      pointerEvents="none"
                    >
                      {pc.isRect
                        ? `${fmt(pc.bbox.w)} x ${fmt(pc.bbox.h)}`
                        : "IRREGULAR"}{" "}
                      · {fmt(pc.area)} sq{unitLabel}
                    </text>
                  </g>
                );
              })}

            {/* drawing a custom plot */}
            {tool === "DRAW" && (
              <g>
                {draft.length > 0 && (
                  <polyline
                    points={[...draft, ...(hover ? [hover] : [])]
                      .map((p) => `${p.x},${p.y}`)
                      .join(" ")}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth={0.25}
                  />
                )}
                {draft.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={i === 0 ? 0.9 : 0.5}
                    fill={i === 0 ? "#16a34a" : "#dc2626"}
                  />
                ))}
                {hover && draft.length > 0 && (
                  <text
                    x={hover.x + 1}
                    y={hover.y - 1}
                    fontSize={1.8}
                    fill="#dc2626"
                  >
                    {fmt(
                      Math.hypot(
                        hover.x - draft[draft.length - 1].x,
                        hover.y - draft[draft.length - 1].y
                      )
                    )}{" "}
                    {unitLabel}
                  </text>
                )}
              </g>
            )}

            {/* cut preview — line ko lamba kheench kar dikhao */}
            {tool === "CUT" &&
              cutStart &&
              hover &&
              (() => {
                const dx = hover.x - cutStart.x,
                  dy = hover.y - cutStart.y;
                const L = Math.hypot(dx, dy) || 1;
                const big = 500;
                return (
                  <g pointerEvents="none">
                    <line
                      x1={cutStart.x - (dx / L) * big}
                      y1={cutStart.y - (dy / L) * big}
                      x2={cutStart.x + (dx / L) * big}
                      y2={cutStart.y + (dy / L) * big}
                      stroke="#dc2626"
                      strokeWidth={fs * 0.1}
                      strokeDasharray={`${fs * 0.5} ${fs * 0.3}`}
                    />
                    <circle
                      cx={cutStart.x}
                      cy={cutStart.y}
                      r={fs * 0.25}
                      fill="#dc2626"
                    />
                    <text
                      x={hover.x + fs * 0.5}
                      y={hover.y - fs * 0.5}
                      fontSize={fs * 0.9}
                      fill="#dc2626"
                    >
                      {fmt(L)} {unitLabel}
                    </text>
                  </g>
                );
              })()}
            {tool === "CUT" && !cutStart && hover && (
              <circle
                cx={hover.x}
                cy={hover.y}
                r={fs * 0.25}
                fill="#dc2626"
                pointerEvents="none"
              />
            )}
          </svg>
        </div>

        {/* ============ RIGHT PANEL: pieces ============ */}
        <div className="col-span-12 lg:col-span-3 border-l border-black p-3 text-xs space-y-2">
          <div className="font-black">
            3. PIECES ({plotCount} PLOT{plotCount === 1 ? "" : "S"})
          </div>
          <div className="text-slate-700">
            TOTAL: {fmt(totalArea)} sq{unitLabel} · PLOTS: {fmt(usedArea)} · OPEN:{" "}
            {fmt(Math.round((totalArea - usedArea) * 100) / 100)}
          </div>
          <div className="space-y-1 max-h-[520px] overflow-auto">
            {infos.map((pc) => (
              <div
                key={pc.id}
                className={`border p-2 ${
                  pc.id === selectedId ? "border-red-600 bg-red-50" : "border-black"
                }`}
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
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!onGeneratePlan && (
            <div className="text-slate-600 normal-case">
              Tip: onGeneratePlan prop do to har PLOT par "GENERATE PLAN" button
              aayega.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}