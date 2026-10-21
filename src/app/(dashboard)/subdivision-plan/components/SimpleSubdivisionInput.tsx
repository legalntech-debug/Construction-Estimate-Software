"use client";

import React from "react";

export interface CustomPieceDef {
  label: string;
  widthFt: number;
  depthFt: number;
}

export type SubdivisionMode =
  | "SIMPLE"
  | "CORNER"
  | "WITH_ROAD"
  | "CUSTOM_GRID";

export interface CornerSplitConfig {
  side1Pieces: number;   // top side pieces (e.g. 3)
  side2Pieces: number;   // right side pieces (e.g. 2)
  splitDirection: "HORIZONTAL" | "VERTICAL";  // which side is horizontal split
  roadSide?: "TOP" | "RIGHT" | "BOTTOM" | "LEFT";  // optional road on one side
  roadWidthFt?: number;  // road width
}

export interface RoadConfig {
  roadSide: "TOP" | "RIGHT" | "BOTTOM" | "LEFT";
  roadWidthFt: number;
}

export interface SimpleSubdivisionConfig {
  mode: SubdivisionMode;
  count: number;
  splitBy: "EQUAL" | "CUSTOM";
  direction: "VERTICAL" | "HORIZONTAL";
  customPieces?: CustomPieceDef[];
  corner?: CornerSplitConfig;
  road?: RoadConfig;
}

interface SimpleSubdivisionInputProps {
  value: SimpleSubdivisionConfig;
  onChange: (v: SimpleSubdivisionConfig) => void;
  measurementUnit: "FEET" | "METERS";
  plotWidthFt: number;
  plotLengthFt: number;
}

const DEFAULT_LABELS = [
  "Plot No. A", "Plot No. B", "Plot No. C", "Plot No. D",
  "Plot No. E", "Plot No. F", "Plot No. G", "Plot No. H",
  "Plot No. I", "Plot No. J", "Plot No. K", "Plot No. L",
];

export default function SimpleSubdivisionInput({
  value,
  onChange,
  measurementUnit,
  plotWidthFt,
  plotLengthFt,
}: SimpleSubdivisionInputProps) {
  const unit = measurementUnit === "FEET" ? "ft" : "m";

  const mode: SubdivisionMode = value.mode || "SIMPLE";
  const customPieces: CustomPieceDef[] = value.customPieces || [];
  const corner: CornerSplitConfig = value.corner || {
    side1Pieces: 3,
    side2Pieces: 2,
    splitDirection: "HORIZONTAL",
    roadWidthFt: 0,
  };
  const road: RoadConfig = value.road || {
    roadSide: "TOP",
    roadWidthFt: 10,
  };

  const ensureCount = (count: number) => {
    const newCount = Math.max(2, Math.min(20, count));
    const existing = customPieces.slice(0, newCount);
    while (existing.length < newCount) {
      const idx = existing.length;
      existing.push({
        label: DEFAULT_LABELS[idx] || `Piece ${idx + 1}`,
        widthFt: Number((plotWidthFt / newCount).toFixed(2)),
        depthFt: plotLengthFt,
      });
    }
    return existing;
  };

  const updateCount = (newCount: number) => {
    const count = Math.max(2, Math.min(20, newCount));
    const updatedPieces = ensureCount(count);
    onChange({ ...value, count, customPieces: updatedPieces });
  };

  const updatePiece = (idx: number, patch: Partial<CustomPieceDef>) => {
    const updated = [...customPieces];
    updated[idx] = { ...updated[idx], ...patch };
    onChange({ ...value, customPieces: updated });
  };

  const isVertical = value.direction === "VERTICAL";
  const totalCustomWidth = customPieces.reduce((s, p) => s + (p.widthFt || 0), 0);
  const totalCustomDepth = customPieces.reduce((s, p) => s + (p.depthFt || 0), 0);
  const fitsPlot = isVertical
    ? Math.abs(totalCustomWidth - plotWidthFt) < 0.5
    : Math.abs(totalCustomDepth - plotLengthFt) < 0.5;

  const autoFill = () => {
    const n = customPieces.length || value.count;
    const perPieceW = Number((plotWidthFt / n).toFixed(2));
    const perPieceD = Number((plotLengthFt / n).toFixed(2));
    const updated = customPieces.map((p, i) => ({
      ...p,
      label: p.label || DEFAULT_LABELS[i] || `Piece ${i + 1}`,
      widthFt: isVertical ? perPieceW : plotWidthFt,
      depthFt: isVertical ? plotLengthFt : perPieceD,
    }));
    onChange({ ...value, customPieces: updated });
  };

  return (
    <div className="border-2 border-black mb-4 bg-white">
      <div className="bg-slate-800 text-white p-3 font-black text-base">
        3. SUBDIVISION LAYOUT — PLOT TODKAR PLOTS BANAO
      </div>

      {/* ─── MODE SELECTOR ─── */}
      <div className="p-4 border-b-2 border-black bg-blue-50">
        <label className="font-black text-sm block mb-3">
          SUBDIVISION MODE:
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { val: "SIMPLE", label: "SIMPLE", hint: "Equal ya custom sizes" },
            { val: "CORNER", label: "CORNER PLOT", hint: "2 sides me todna" },
            { val: "WITH_ROAD", label: "WITH ROAD", hint: "Road alag karke pieces" },
            { val: "CUSTOM_GRID", label: "CUSTOM GRID", hint: "Kitna bhi pieces" },
          ].map((opt) => (
            <label
              key={opt.val}
              className={`flex flex-col items-center gap-1 p-3 border-2 cursor-pointer rounded ${
                mode === opt.val
                  ? "bg-blue-600 text-white border-blue-800"
                  : "bg-white border-black"
              }`}
            >
              <input
                type="radio"
                name="subdivisionMode"
                className="hidden"
                checked={mode === opt.val}
                onChange={() => onChange({ ...value, mode: opt.val as SubdivisionMode })}
              />
              <span className="text-sm font-black">{opt.label}</span>
              <span className={`text-[10px] ${mode === opt.val ? "text-blue-100" : "text-gray-500"}`}>
                {opt.hint}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* MODE 1: SIMPLE                                      */}
      {/* ═══════════════════════════════════════════════════ */}
      {mode === "SIMPLE" && (
        <>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border-2 border-black p-4 bg-gray-50">
              <label className="font-black text-base block mb-3">
                1. NUMBER OF PIECES
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={value.count}
                  onChange={(e) => updateCount(Number(e.target.value) || 2)}
                  className="w-full border-2 border-black p-3 text-center font-black text-2xl"
                />
                <span className="text-sm font-bold text-gray-600 whitespace-nowrap">PIECES</span>
              </div>
            </div>

            <div className="border-2 border-black p-4 bg-gray-50">
              <label className="font-black text-base block mb-3">2. SPLIT MODE</label>
              <div className="flex flex-col gap-2">
                {[
                  { val: "EQUAL", label: "EQUAL SPLIT", hint: "Sab pieces barabar" },
                  { val: "CUSTOM", label: "CUSTOM SIZES", hint: "Har piece alag" },
                ].map((opt) => (
                  <label
                    key={opt.val}
                    className={`flex items-center gap-2 p-2 border-2 cursor-pointer rounded ${
                      value.splitBy === opt.val
                        ? "bg-blue-100 border-blue-600"
                        : "bg-white border-black"
                    }`}
                  >
                    <input
                      type="radio"
                      name="splitBy"
                      checked={value.splitBy === opt.val}
                      onChange={() => {
                        if (opt.val === "CUSTOM" && (!value.customPieces || value.customPieces.length === 0)) {
                          onChange({
                            ...value,
                            splitBy: "CUSTOM",
                            customPieces: ensureCount(value.count),
                          });
                        } else {
                          onChange({ ...value, splitBy: opt.val as any });
                        }
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{opt.label}</span>
                      <span className="text-[10px] text-gray-500">{opt.hint}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-2 border-black p-4 bg-gray-50">
              <label className="font-black text-base block mb-3">3. DIRECTION</label>
              <div className="flex flex-col gap-2">
                {[
                  { val: "VERTICAL", label: "VERTICAL (| | |)", hint: "Left → Right" },
                  { val: "HORIZONTAL", label: "HORIZONTAL (≡)", hint: "Top → Bottom" },
                ].map((opt) => (
                  <label
                    key={opt.val}
                    className={`flex items-center gap-2 p-2 border-2 cursor-pointer rounded ${
                      value.direction === opt.val
                        ? "bg-blue-100 border-blue-600"
                        : "bg-white border-black"
                    }`}
                  >
                    <input
                      type="radio"
                      name="direction"
                      checked={value.direction === opt.val}
                      onChange={() => onChange({ ...value, direction: opt.val as any })}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{opt.label}</span>
                      <span className="text-[10px] text-gray-500">{opt.hint}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {value.splitBy === "CUSTOM" && (
            <div className="border-t-2 border-black p-4 bg-blue-50">
              <div className="flex justify-between items-center mb-3">
                <div className="font-black text-base">
                  📐 CUSTOM PIECE SIZES & LABELS
                </div>
                <button
                  type="button"
                  onClick={autoFill}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-black rounded cursor-pointer"
                >
                  ⚡ AUTO-FILL EQUAL
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="border border-black p-2 text-left w-12">#</th>
                      <th className="border border-black p-2 text-left">LABEL</th>
                      <th className="border border-black p-2 text-center w-32">
                        {isVertical ? "WIDTH" : "DEPTH"} ({unit})
                      </th>
                      <th className="border border-black p-2 text-center w-32">
                        {isVertical ? "DEPTH" : "WIDTH"} ({unit})
                      </th>
                      <th className="border border-black p-2 text-center w-24">
                        AREA (sq.{unit})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customPieces.map((p, i) => {
                      const area = (p.widthFt || 0) * (p.depthFt || 0);
                      return (
                        <tr key={i} className="bg-white">
                          <td className="border border-black p-2 text-center font-black text-base">
                            {i + 1}
                          </td>
                          <td className="border border-black p-1">
                            <input
                              type="text"
                              value={p.label || ""}
                              onChange={(e) =>
                                updatePiece(i, { label: e.target.value.toUpperCase() })
                              }
                              placeholder={`Plot No. ${String.fromCharCode(65 + i)}`}
                              className="w-full border-0 p-2 text-sm font-bold uppercase focus:outline-none focus:bg-yellow-100"
                            />
                          </td>
                          <td className="border border-black p-1">
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={p.widthFt || 0}
                              onChange={(e) =>
                                updatePiece(i, { widthFt: Number(e.target.value) || 0 })
                              }
                              className="w-full border-0 p-2 text-center text-sm font-bold focus:outline-none focus:bg-yellow-100"
                            />
                          </td>
                          <td className="border border-black p-1">
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={p.depthFt || 0}
                              onChange={(e) =>
                                updatePiece(i, { depthFt: Number(e.target.value) || 0 })
                              }
                              className="w-full border-0 p-2 text-center text-sm font-bold focus:outline-none focus:bg-yellow-100"
                            />
                          </td>
                          <td className="border border-black p-2 text-center font-bold text-blue-800 text-sm">
                            {area.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100">
                    <tr>
                      <td colSpan={2} className="border border-black p-2 text-right font-black text-sm">
                        TOTAL:
                      </td>
                      <td
                        className={`border border-black p-2 text-center font-black text-sm ${
                          isVertical && !fitsPlot
                            ? "bg-red-200 text-red-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {isVertical ? totalCustomWidth.toFixed(2) : totalCustomDepth.toFixed(2)}
                        {" / "}
                        {isVertical ? plotWidthFt : plotLengthFt}
                      </td>
                      <td className="border border-black p-2 text-center font-black text-sm">
                        {isVertical ? totalCustomDepth.toFixed(2) : totalCustomWidth.toFixed(2)}
                      </td>
                      <td className="border border-black p-2 text-center font-black text-blue-800 text-sm">
                        {customPieces.reduce((s, p) => s + (p.widthFt * p.depthFt || 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {!fitsPlot && (
                <div className="mt-3 p-3 bg-red-100 border-2 border-red-400 rounded text-sm font-black text-red-800">
                  ⚠️ WARNING: Total {isVertical ? "width" : "depth"} (
                  {isVertical ? totalCustomWidth.toFixed(2) : totalCustomDepth.toFixed(2)}) {unit} ≠ plot{" "}
                  {isVertical ? "width" : "depth"} ({isVertical ? plotWidthFt : plotLengthFt}) {unit}.
                </div>
              )}
              {fitsPlot && (
                <div className="mt-3 p-3 bg-green-100 border-2 border-green-400 rounded text-sm font-black text-green-800">
                  ✅ Perfect fit! Total {isVertical ? "width" : "depth"} matches plot size.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* MODE 2: CORNER PLOT                                  */}
      {/* ═══════════════════════════════════════════════════ */}
      {mode === "CORNER" && (
        <div className="p-4 bg-purple-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-2 border-black p-4 bg-white">
              <label className="font-black text-base block mb-2">
                SIDE 1 — Kitne pieces?
              </label>
              <div className="text-[10px] text-gray-500 mb-2">
                (Front / main road side)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={corner.side1Pieces}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      corner: {
                        ...corner,
                        side1Pieces: Math.max(1, Number(e.target.value) || 1),
                      },
                    })
                  }
                  className="w-full border-2 border-black p-3 text-center font-black text-2xl"
                />
                <span className="text-sm font-bold">PIECES</span>
              </div>
            </div>

            <div className="border-2 border-black p-4 bg-white">
              <label className="font-black text-base block mb-2">
                SIDE 2 — Kitne pieces?
              </label>
              <div className="text-[10px] text-gray-500 mb-2">
                (Corner / side road side)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={corner.side2Pieces}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      corner: {
                        ...corner,
                        side2Pieces: Math.max(1, Number(e.target.value) || 1),
                      },
                    })
                  }
                  className="w-full border-2 border-black p-3 text-center font-black text-2xl"
                />
                <span className="text-sm font-bold">PIECES</span>
              </div>
            </div>
          </div>

          <div className="mt-4 border-2 border-black p-4 bg-white">
            <div className="font-black text-base mb-3">SIDE 1 SPLIT DIRECTION</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: "HORIZONTAL", label: "HORIZONTAL (≡)", hint: "Side 1 = width, Side 2 = depth" },
                { val: "VERTICAL", label: "VERTICAL (| | |)", hint: "Side 1 = depth, Side 2 = width" },
              ].map((opt) => (
                <label
                  key={opt.val}
                  className={`flex items-center gap-2 p-3 border-2 cursor-pointer rounded ${
                    corner.splitDirection === opt.val
                      ? "bg-blue-100 border-blue-600"
                      : "bg-white border-black"
                  }`}
                >
                  <input
                    type="radio"
                    name="cornerDirection"
                    checked={corner.splitDirection === opt.val}
                    onChange={() =>
                      onChange({
                        ...value,
                        corner: { ...corner, splitDirection: opt.val as any },
                      })
                    }
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{opt.label}</span>
                    <span className="text-[10px] text-gray-500">{opt.hint}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-100 border-2 border-yellow-500 rounded">
            <div className="text-sm font-bold text-yellow-900">
              📋 PREVIEW: Plot ({plotWidthFt}' × {plotLengthFt}') — {corner.side1Pieces} pieces on side 1
              × {corner.side2Pieces} pieces on side 2 ={" "}
              <span className="text-red-700 font-black">
                {corner.side1Pieces * corner.side2Pieces} total pieces
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* MODE 3: WITH ROAD                                    */}
      {/* ═══════════════════════════════════════════════════ */}
      {mode === "WITH_ROAD" && (
        <div className="p-4 bg-orange-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-2 border-black p-4 bg-white">
              <label className="font-black text-base block mb-3">
                ROAD SIDE
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: "TOP", label: "TOP ↑" },
                  { val: "RIGHT", label: "RIGHT →" },
                  { val: "BOTTOM", label: "BOTTOM ↓" },
                  { val: "LEFT", label: "LEFT ←" },
                ].map((opt) => (
                  <label
                    key={opt.val}
                    className={`flex items-center justify-center gap-2 p-3 border-2 cursor-pointer rounded ${
                      road.roadSide === opt.val
                        ? "bg-blue-100 border-blue-600"
                        : "bg-white border-black"
                    }`}
                  >
                    <input
                      type="radio"
                      name="roadSide"
                      checked={road.roadSide === opt.val}
                      onChange={() =>
                        onChange({
                          ...value,
                          road: { ...road, roadSide: opt.val as any },
                        })
                      }
                    />
                    <span className="text-sm font-black">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-2 border-black p-4 bg-white">
              <label className="font-black text-base block mb-2">
                ROAD WIDTH
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={road.roadWidthFt}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      road: {
                        ...road,
                        roadWidthFt: Math.max(3, Number(e.target.value) || 10),
                      },
                    })
                  }
                  className="w-full border-2 border-black p-3 text-center font-black text-2xl"
                />
                <span className="text-sm font-bold">{unit}</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-2">
                Plot ke andar road ka hissa — pieces ke alawa alag dikhega.
              </div>
            </div>
          </div>

          <div className="mt-4 border-2 border-black p-4 bg-white">
            <label className="font-black text-base block mb-2">
              BAKE HUE PIECES (road ke baad jo bache)
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold">Kitne pieces me todna hai?</span>
              <input
                type="number"
                min={1}
                max={10}
                value={value.count}
                onChange={(e) =>
                  onChange({ ...value, count: Math.max(1, Number(e.target.value) || 1) })
                }
                className="w-24 border-2 border-black p-2 text-center font-black text-xl"
              />
              <select
                value={value.direction}
                onChange={(e) =>
                  onChange({ ...value, direction: e.target.value as any })
                }
                className="border-2 border-black p-2 text-sm font-bold"
              >
                <option value="VERTICAL">VERTICAL</option>
                <option value="HORIZONTAL">HORIZONTAL</option>
              </select>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-100 border-2 border-yellow-500 rounded">
            <div className="text-sm font-bold text-yellow-900">
              📋 PREVIEW: {road.roadWidthFt}' road on {road.roadSide} side, then{" "}
              <span className="text-red-700 font-black">{value.count} pieces</span> in{" "}
              {value.direction} direction
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* MODE 4: CUSTOM GRID                                  */}
      {/* ═══════════════════════════════════════════════════ */}
      {mode === "CUSTOM_GRID" && (
        <div className="p-4 bg-green-50">
          <div className="text-sm font-bold mb-4 text-green-900">
            📐 Custom Grid — Kitne rows × columns me todna hai
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border-2 border-black p-4 bg-white">
              <label className="font-black text-sm block mb-2">ROWS (Top → Bottom)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={corner.side2Pieces}
                onChange={(e) =>
                  onChange({
                    ...value,
                    corner: {
                      ...corner,
                      side2Pieces: Math.max(1, Number(e.target.value) || 1),
                    },
                  })
                }
                className="w-full border-2 border-black p-3 text-center font-black text-2xl"
              />
            </div>

            <div className="border-2 border-black p-4 bg-white">
              <label className="font-black text-sm block mb-2">COLUMNS (Left → Right)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={corner.side1Pieces}
                onChange={(e) =>
                  onChange({
                    ...value,
                    corner: {
                      ...corner,
                      side1Pieces: Math.max(1, Number(e.target.value) || 1),
                    },
                  })
                }
                className="w-full border-2 border-black p-3 text-center font-black text-2xl"
              />
            </div>

            <div className="border-2 border-black p-4 bg-white flex flex-col justify-center">
              <div className="text-sm font-bold">TOTAL PIECES</div>
              <div className="text-4xl font-black text-blue-800">
                {corner.side1Pieces * corner.side2Pieces}
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-100 border-2 border-yellow-500 rounded">
            <div className="text-sm font-bold text-yellow-900">
              📋 {corner.side2Pieces} rows × {corner.side1Pieces} columns ={" "}
              <span className="text-red-700 font-black">
                {corner.side1Pieces * corner.side2Pieces} pieces
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUMMARY ─── */}
      <div className="border-t-2 border-black p-3 bg-yellow-50">
        <div className="text-xs font-bold text-gray-700 mb-1">
          📋 FINAL PREVIEW
        </div>
        <div className="text-sm font-black text-blue-900">
          {plotWidthFt} × {plotLengthFt} {unit} plot → MODE: {mode}
          {mode === "SIMPLE" && (
            <> — {value.count} {value.splitBy} pieces in {value.direction}</>
          )}
          {mode === "CORNER" && (
            <> — {corner.side1Pieces} × {corner.side2Pieces} grid</>
          )}
          {mode === "WITH_ROAD" && (
            <> — Road {road.roadWidthFt}{unit} on {road.roadSide} + {value.count} pieces</>
          )}
          {mode === "CUSTOM_GRID" && (
            <> — {corner.side1Pieces} × {corner.side2Pieces} grid</>
          )}
        </div>
      </div>
    </div>
  );
}