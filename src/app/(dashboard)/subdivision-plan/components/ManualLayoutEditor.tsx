"use client";

import React, { useMemo, useState } from "react";
import CadPreviewCard from "./CadPreviewCard";
import {
  ManualConfig,
  ManualKind,
  ManualPieceDef,
  ManualShape,
  NotchCorner,
  buildManualPieces,
  checkLayout,
  newManualPiece,
  newManualUid,
} from "../subdivisionLayouts";

/* =========================================================
   MANUAL MODE EDITOR
   The user builds the layout piece by piece. Every piece has a
   shape (rectangle, L-shape, trapezoid or free polygon), a type
   (plot / open land / road) and an exact position + size.
========================================================= */

interface ManualLayoutEditorProps {
  value: ManualConfig;
  onChange: (v: ManualConfig) => void;
  plotW: number;
  plotD: number;
  unit: "FEET" | "METERS";
}

const SHAPES: { id: ManualShape; label: string }[] = [
  { id: "RECT", label: "RECTANGLE" },
  { id: "L", label: "L-SHAPE" },
  { id: "TRAP", label: "TRAPEZOID" },
  { id: "POLY", label: "POLYGON" },
];

function NumField({ label, value, onChange, step = 0.5 }: { label: string; value: number | undefined; onChange: (n: number) => void; step?: number }) {
  return (
    <div>
      <label className="font-bold text-[10px] block mb-0.5">{label}</label>
      <input
        type="number"
        step={step}
        inputMode="decimal"
        value={value === undefined || Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full border border-black p-1.5 text-center text-sm font-bold focus:outline-none focus:bg-gray-100"
      />
    </div>
  );
}

export default function ManualLayoutEditor({ value, onChange, plotW, plotD, unit }: ManualLayoutEditorProps) {
  const u = unit === "FEET" ? "ft" : "m";
  const areaU = unit === "FEET" ? "SQ.FT" : "SQ.M";
  const list = value.pieces || [];
  const [selected, setSelected] = useState<string | null>(null);

  const pieces = useMemo(() => buildManualPieces(value, unit), [value, unit]);
  const check = useMemo(() => checkLayout(plotW, plotD, pieces, unit), [plotW, plotD, pieces, unit]);

  const setList = (next: ManualPieceDef[]) => onChange({ ...value, pieces: next });
  const update = (uid: string, patch: Partial<ManualPieceDef>) => setList(list.map((p) => (p.uid === uid ? { ...p, ...patch } : p)));
  const remove = (uid: string) => setList(list.filter((p) => p.uid !== uid));
  const duplicate = (p: ManualPieceDef) => {
    const copy: ManualPieceDef = { ...p, uid: newManualUid(), label: "", points: p.points ? p.points.map((q) => ({ ...q })) : undefined };
    const at = list.findIndex((x) => x.uid === p.uid);
    const next = [...list];
    next.splice(at + 1, 0, copy);
    setList(next);
    setSelected(copy.uid);
  };
  const add = (shape: ManualShape, kind: ManualKind = "PLOT") => {
    const piece = newManualPiece(plotW, plotD, shape, kind);
    setList([...list, piece]);
    setSelected(piece.uid);
  };

  // Snap helpers: put this piece next to the previous one in the list
  const placeRightOfPrevious = (idx: number) => {
    const prev = pieces.find((p) => p.id === list[idx - 1]?.uid);
    if (!prev) return;
    update(list[idx].uid, { x: Number(prev.bbox.maxX.toFixed(2)), y: Number(prev.bbox.minY.toFixed(2)) });
  };
  const placeBelowPrevious = (idx: number) => {
    const prev = pieces.find((p) => p.id === list[idx - 1]?.uid);
    if (!prev) return;
    update(list[idx].uid, { x: Number(prev.bbox.minX.toFixed(2)), y: Number(prev.bbox.maxY.toFixed(2)) });
  };

  const updatePoint = (uid: string, pts: { x: number; y: number }[]) => update(uid, { points: pts });

  return (
    <div className="p-4 bg-white space-y-4">
      <div className="border-2 border-black p-3 text-xs font-bold">
        Build the layout piece by piece. Positions are measured in {u} from the <span className="underline">top-left corner</span> of the plot (X to the right, Y downwards).
        Plot size: {plotW.toFixed(2)} × {plotD.toFixed(2)} {u}.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-black text-sm mr-1">ADD PIECE:</span>
        {SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => add(s.id)}
            className="border-2 border-black bg-white hover:bg-black hover:text-white px-3 py-1.5 text-xs font-black cursor-pointer transition"
          >
            + {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => add("RECT", "ROAD")}
          className="border-2 border-dashed border-black bg-white hover:bg-black hover:text-white px-3 py-1.5 text-xs font-black cursor-pointer transition"
        >
          + ROAD STRIP
        </button>
        <button
          type="button"
          onClick={() => add("RECT", "OPEN")}
          className="border-2 border-dashed border-black bg-white hover:bg-black hover:text-white px-3 py-1.5 text-xs font-black cursor-pointer transition"
        >
          + OPEN LAND
        </button>
        {list.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Remove all pieces?")) { setList([]); setSelected(null); }
            }}
            className="ml-auto border-2 border-black bg-white hover:bg-black hover:text-white px-3 py-1.5 text-xs font-black cursor-pointer transition"
          >
            CLEAR ALL
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* piece list */}
        <div className="space-y-3 min-w-0">
          {list.length === 0 && (
            <div className="border-2 border-dashed border-gray-400 p-8 text-center text-xs font-bold text-gray-500">
              No pieces yet. Use “ADD PIECE” to start drawing the layout.
            </div>
          )}

          {list.map((p, idx) => {
            const info = pieces.find((x) => x.id === p.uid);
            const active = selected === p.uid;
            return (
              <div key={p.uid} className={`border-2 ${active ? "border-black ring-2 ring-black" : "border-gray-500"} bg-white`}>
                <div
                  className="flex flex-wrap items-center gap-2 p-2 bg-gray-100 border-b border-black cursor-pointer"
                  onClick={() => setSelected(p.uid)}
                >
                  <span className="w-6 h-6 border-2 border-black rounded-full flex items-center justify-center text-[11px] font-black bg-white">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={p.label}
                    placeholder={p.kind === "PLOT" ? "PLOT NAME (OPTIONAL)" : p.kind === "ROAD" ? "ROAD" : "OPEN LAND"}
                    onChange={(e) => update(p.uid, { label: e.target.value.toUpperCase() })}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-[120px] border border-black p-1.5 text-xs font-bold uppercase"
                  />
                  <select
                    value={p.kind}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => update(p.uid, { kind: e.target.value as ManualKind })}
                    className="border border-black p-1.5 text-xs font-bold bg-white"
                  >
                    <option value="PLOT">PLOT</option>
                    <option value="OPEN">OPEN LAND</option>
                    <option value="ROAD">ROAD</option>
                  </select>
                  <select
                    value={p.shape}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const shape = e.target.value as ManualShape;
                      const fresh = newManualPiece(plotW, plotD, shape, p.kind);
                      update(p.uid, { ...fresh, uid: p.uid, label: p.label, kind: p.kind, x: p.x, y: p.y, w: p.w || fresh.w, d: p.d || fresh.d });
                    }}
                    className="border border-black p-1.5 text-xs font-bold bg-white"
                  >
                    {SHAPES.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    title="Duplicate"
                    onClick={(e) => { e.stopPropagation(); duplicate(p); }}
                    className="border border-black px-2 py-1 text-xs font-black bg-white hover:bg-black hover:text-white cursor-pointer"
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); remove(p.uid); }}
                    className="border border-black px-2 py-1 text-xs font-black bg-white hover:bg-black hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 space-y-2" onClick={() => setSelected(p.uid)}>
                  {p.shape !== "POLY" && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <NumField label={`X FROM LEFT (${u})`} value={p.x} onChange={(n) => update(p.uid, { x: n })} />
                      <NumField label={`Y FROM TOP (${u})`} value={p.y} onChange={(n) => update(p.uid, { y: n })} />
                      <NumField label={p.shape === "TRAP" ? `BOTTOM WIDTH (${u})` : `WIDTH (${u})`} value={p.w} onChange={(n) => update(p.uid, { w: n })} />
                      <NumField label={p.shape === "TRAP" ? `HEIGHT (${u})` : `DEPTH (${u})`} value={p.d} onChange={(n) => update(p.uid, { d: n })} />
                    </div>
                  )}

                  {p.shape === "L" && (
                    <div className="grid grid-cols-3 gap-2">
                      <NumField label={`CUT-OUT WIDTH (${u})`} value={p.notchW} onChange={(n) => update(p.uid, { notchW: n })} />
                      <NumField label={`CUT-OUT DEPTH (${u})`} value={p.notchD} onChange={(n) => update(p.uid, { notchD: n })} />
                      <div>
                        <label className="font-bold text-[10px] block mb-0.5">CUT-OUT CORNER</label>
                        <select
                          value={p.notchCorner || "TR"}
                          onChange={(e) => update(p.uid, { notchCorner: e.target.value as NotchCorner })}
                          className="w-full border border-black p-1.5 text-sm font-bold bg-white"
                        >
                          <option value="TL">TOP-LEFT</option>
                          <option value="TR">TOP-RIGHT</option>
                          <option value="BL">BOTTOM-LEFT</option>
                          <option value="BR">BOTTOM-RIGHT</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {p.shape === "TRAP" && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <NumField label={`TOP WIDTH (${u})`} value={p.topW} onChange={(n) => update(p.uid, { topW: n })} />
                    </div>
                  )}

                  {p.shape === "POLY" && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold">CORNER POINTS ({u}, FROM TOP-LEFT OF PLOT) — AT LEAST 3, IN ORDER AROUND THE PIECE</div>
                      {(p.points || []).map((pt, k) => (
                        <div key={k} className="flex items-end gap-2">
                          <span className="w-5 text-xs font-black pb-2">{k + 1}</span>
                          <NumField label="X" value={pt.x} onChange={(n) => updatePoint(p.uid, (p.points || []).map((q, j) => (j === k ? { ...q, x: n } : q)))} />
                          <NumField label="Y" value={pt.y} onChange={(n) => updatePoint(p.uid, (p.points || []).map((q, j) => (j === k ? { ...q, y: n } : q)))} />
                          <button
                            type="button"
                            disabled={(p.points || []).length <= 3}
                            onClick={() => updatePoint(p.uid, (p.points || []).filter((_, j) => j !== k))}
                            className="border border-black px-2 py-1.5 text-xs font-black bg-white hover:bg-black hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const pts = p.points || [];
                          const last = pts[pts.length - 1] || { x: 0, y: 0 };
                          updatePoint(p.uid, [...pts, { x: last.x, y: last.y }]);
                        }}
                        className="border-2 border-black px-3 py-1 text-xs font-black bg-white hover:bg-black hover:text-white cursor-pointer"
                      >
                        + ADD POINT
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="text-[11px] font-bold">
                      {info ? `AREA: ${info.area.toFixed(1)} ${areaU}` : "⚠ Incomplete shape — it will not be drawn"}
                    </div>
                    {idx > 0 && p.shape !== "POLY" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => placeRightOfPrevious(idx)}
                          className="border border-black px-2 py-1 text-[10px] font-black bg-white hover:bg-black hover:text-white cursor-pointer"
                        >
                          → RIGHT OF PREVIOUS
                        </button>
                        <button
                          type="button"
                          onClick={() => placeBelowPrevious(idx)}
                          className="border border-black px-2 py-1 text-[10px] font-black bg-white hover:bg-black hover:text-white cursor-pointer"
                        >
                          ↓ BELOW PREVIOUS
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CAD view + checks (stays beside the list on desktop, below it on mobile) */}
        <div className="lg:sticky lg:top-4 space-y-3">
          <CadPreviewCard
            plotW={plotW}
            plotD={plotD}
            pieces={pieces}
            unit={unit}
            idPrefix="man-live"
            selectedPieceId={selected}
            plotArea={check.plotArea}
            allocatedArea={check.allocatedArea}
            balanceArea={check.balanceArea}
          />

          {check.issues.length > 0 ? (
            <ul className="border-2 border-black bg-gray-100 p-3 text-xs font-bold space-y-1">
              {check.issues.map((m, i) => <li key={i}>⚠ {m}</li>)}
            </ul>
          ) : (
            list.length > 0 && <div className="border-2 border-black bg-gray-100 p-2 text-xs font-bold">✔ All pieces are inside the plot and do not overlap.</div>
          )}
        </div>
      </div>
    </div>
  );
}
