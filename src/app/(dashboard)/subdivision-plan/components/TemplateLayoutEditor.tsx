"use client";

import React, { useMemo } from "react";
import SubdivisionSketch from "./SubdivisionSketch";
import CadPreviewCard from "./CadPreviewCard";
import {
  TEMPLATE_META,
  TemplateConfig,
  TemplateId,
  autoFillTemplatePieces,
  buildTemplatePieces,
  checkLayout,
  defaultTemplateConfig,
  getTemplateMeta,
  slotGroupLabel,
  templateSlotCount,
} from "../subdivisionLayouts";

/* =========================================================
   TEMPLATE MODE EDITOR
   1. Pick the pattern that matches how the plot was divided.
   2. Set the number of plots in each part of the pattern.
   3. Enter the width and depth of every piece.
   A live engineering sketch and a fit check are shown beside
   the size table.
========================================================= */

interface TemplateLayoutEditorProps {
  value: TemplateConfig;
  onChange: (v: TemplateConfig) => void;
  plotW: number;
  plotD: number;
  unit: "FEET" | "METERS";
}

const clampInt = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || min)));

export default function TemplateLayoutEditor({ value, onChange, plotW, plotD, unit }: TemplateLayoutEditorProps) {
  const u = unit === "FEET" ? "ft" : "m";
  const areaU = unit === "FEET" ? "SQ.FT" : "SQ.M";
  const meta = getTemplateMeta(value.id);
  const slots = templateSlotCount(value);

  const pieces = useMemo(() => buildTemplatePieces(plotW, plotD, value, unit), [plotW, plotD, value, unit]);
  const check = useMemo(() => checkLayout(plotW, plotD, pieces, unit), [plotW, plotD, pieces, unit]);

  // Small pictures of every pattern (drawn on a fixed sample plot)
  const thumbs = useMemo(
    () =>
      TEMPLATE_META.map((t) => ({
        id: t.id,
        pieces: buildTemplatePieces(60, 40, defaultTemplateConfig(60, 40, t.id, "FEET"), "FEET"),
      })),
    []
  );

  const selectTemplate = (id: TemplateId) => {
    if (id === value.id) return;
    onChange(defaultTemplateConfig(plotW, plotD, id, unit, { gapFt: value.gapFt, side: value.side }));
  };

  // Changing a count changes which row each piece belongs to, so sizes are re-filled (labels are kept)
  const setCount = (which: 1 | 2, n: number) => {
    const next: TemplateConfig =
      which === 1
        ? { ...value, count1: clampInt(n, meta.min1, meta.max1) }
        : { ...value, count2: clampInt(n, meta.min2, meta.max2) };
    onChange({ ...next, pieces: autoFillTemplatePieces(plotW, plotD, next) });
  };

  const autoFill = () => onChange({ ...value, pieces: autoFillTemplatePieces(plotW, plotD, value) });

  const updatePiece = (i: number, patch: Partial<TemplateConfig["pieces"][number]>) => {
    const list = [...value.pieces];
    list[i] = { ...(list[i] || { label: "", widthFt: 0, depthFt: 0 }), ...patch };
    onChange({ ...value, pieces: list });
  };

  return (
    <div className="p-4 bg-white space-y-4">
      {/* STEP 1 — pattern */}
      <div>
        <div className="font-black text-sm mb-2">STEP 1 — CHOOSE THE LAYOUT PATTERN</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TEMPLATE_META.map((t) => {
            const active = t.id === value.id;
            const thumb = thumbs.find((x) => x.id === t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTemplate(t.id)}
                className={`text-left border-2 p-2 cursor-pointer transition ${
                  active ? "border-black ring-4 ring-black bg-gray-100" : "border-gray-400 bg-white hover:border-black"
                }`}
              >
                <div className="border border-black bg-white mb-2">
                  <SubdivisionSketch plotW={60} plotD={40} pieces={thumb?.pieces || []} unit="FEET" variant="thumb" idPrefix={`tpl-${t.id}`} />
                </div>
                <div className="text-[11px] font-black leading-tight">{t.name}</div>
                <div className="text-[10px] text-gray-600 leading-tight">{t.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2 — pattern settings */}
      <div>
        <div className="font-black text-sm mb-2">STEP 2 — PATTERN SETTINGS</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border-2 border-black p-3">
            <label className="font-black text-[11px] block mb-1">{meta.count1Label}</label>
            <input
              type="number"
              min={meta.min1}
              max={meta.max1}
              value={value.count1}
              onChange={(e) => setCount(1, Number(e.target.value))}
              className="w-full border-2 border-black p-2 text-center font-black text-xl"
            />
          </div>
          {meta.count2Label && (
            <div className="border-2 border-black p-3">
              <label className="font-black text-[11px] block mb-1">{meta.count2Label}</label>
              <input
                type="number"
                min={meta.min2}
                max={meta.max2}
                value={value.count2}
                onChange={(e) => setCount(2, Number(e.target.value))}
                className="w-full border-2 border-black p-2 text-center font-black text-xl"
              />
            </div>
          )}
          {meta.gapLabel && (
            <div className="border-2 border-black p-3">
              <label className="font-black text-[11px] block mb-1">
                {meta.gapLabel} ({u})
              </label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={value.gapFt}
                onChange={(e) => onChange({ ...value, gapFt: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full border-2 border-black p-2 text-center font-black text-xl"
              />
            </div>
          )}
          {meta.sideLabel && (
            <div className="border-2 border-black p-3">
              <label className="font-black text-[11px] block mb-1">{meta.sideLabel}</label>
              <div className="grid grid-cols-2 gap-2">
                {(["LEFT", "RIGHT"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChange({ ...value, side: s })}
                    className={`border-2 border-black p-2 text-xs font-black cursor-pointer ${
                      value.side === s ? "bg-black text-white" : "bg-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STEP 3 — sizes + CAD view */}
      <div>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <div className="font-black text-sm">STEP 3 — ENTER THE SIZE OF EVERY PIECE</div>
          <button
            type="button"
            onClick={autoFill}
            className="border-2 border-black bg-white hover:bg-black hover:text-white px-3 py-1.5 text-xs font-black cursor-pointer transition"
          >
            ⚡ FILL TO PLOT SIZE
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          <div className="min-w-0">
            {/* Desktop / tablet: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-black text-white">
                  <tr>
                    <th className="border border-black p-2 w-10">#</th>
                    <th className="border border-black p-2 text-left">LABEL</th>
                    <th className="border border-black p-2 w-28">WIDTH ({u})</th>
                    <th className="border border-black p-2 w-28">DEPTH ({u})</th>
                    <th className="border border-black p-2 w-24">AREA</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: slots }).map((_, i) => {
                    const p = value.pieces[i] || { label: "", widthFt: 0, depthFt: 0 };
                    const group = slotGroupLabel(value, i);
                    const showGroup = group !== "" && (i === 0 || slotGroupLabel(value, i - 1) !== group);
                    return (
                      <React.Fragment key={i}>
                        {showGroup && (
                          <tr>
                            <td colSpan={5} className="border border-black bg-gray-200 px-2 py-1 text-[11px] font-black">
                              {group}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-white">
                          <td className="border border-black p-2 text-center font-black">{i + 1}</td>
                          <td className="border border-black p-1">
                            <input
                              type="text"
                              value={p.label || ""}
                              placeholder={`PLOT ${i + 1}`}
                              onChange={(e) => updatePiece(i, { label: e.target.value.toUpperCase() })}
                              className="w-full p-2 text-sm font-bold uppercase focus:outline-none focus:bg-gray-100"
                            />
                          </td>
                          <td className="border border-black p-1">
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={p.widthFt || ""}
                              onChange={(e) => updatePiece(i, { widthFt: Number(e.target.value) || 0 })}
                              className="w-full p-2 text-center text-sm font-bold focus:outline-none focus:bg-gray-100"
                            />
                          </td>
                          <td className="border border-black p-1">
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={p.depthFt || ""}
                              onChange={(e) => updatePiece(i, { depthFt: Number(e.target.value) || 0 })}
                              className="w-full p-2 text-center text-sm font-bold focus:outline-none focus:bg-gray-100"
                            />
                          </td>
                          <td className="border border-black p-2 text-center text-xs font-bold">
                            {((p.widthFt || 0) * (p.depthFt || 0)).toFixed(1)}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: one card per piece */}
            <div className="md:hidden space-y-2">
              {Array.from({ length: slots }).map((_, i) => {
                const p = value.pieces[i] || { label: "", widthFt: 0, depthFt: 0 };
                const group = slotGroupLabel(value, i);
                const showGroup = group !== "" && (i === 0 || slotGroupLabel(value, i - 1) !== group);
                return (
                  <React.Fragment key={i}>
                    {showGroup && <div className="bg-gray-200 border border-black px-2 py-1 text-[11px] font-black">{group}</div>}
                    <div className="border-2 border-black bg-white p-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-7 h-7 shrink-0 border-2 border-black rounded-full flex items-center justify-center text-xs font-black">{i + 1}</span>
                        <input
                          type="text"
                          value={p.label || ""}
                          placeholder={`PLOT ${i + 1}`}
                          onChange={(e) => updatePiece(i, { label: e.target.value.toUpperCase() })}
                          className="flex-1 min-w-0 border border-black p-2 text-sm font-bold uppercase"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <label className="text-[10px] font-bold block mb-0.5">WIDTH ({u})</label>
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            inputMode="decimal"
                            value={p.widthFt || ""}
                            onChange={(e) => updatePiece(i, { widthFt: Number(e.target.value) || 0 })}
                            className="w-full border border-black p-2 text-center text-sm font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold block mb-0.5">DEPTH ({u})</label>
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            inputMode="decimal"
                            value={p.depthFt || ""}
                            onChange={(e) => updatePiece(i, { depthFt: Number(e.target.value) || 0 })}
                            className="w-full border border-black p-2 text-center text-sm font-bold"
                          />
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] font-bold">AREA</div>
                          <div className="text-sm font-black py-2">{((p.widthFt || 0) * (p.depthFt || 0)).toFixed(1)}</div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {check.issues.length > 0 ? (
              <ul className="mt-3 border-2 border-black bg-gray-100 p-3 text-xs font-bold space-y-1">
                {check.issues.map((m, i) => (
                  <li key={i}>⚠ {m}</li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 border-2 border-black bg-gray-100 p-2 text-xs font-bold">✔ All pieces fit inside the plot.</div>
            )}
          </div>

          <div className="lg:sticky lg:top-4">
            <CadPreviewCard
              plotW={plotW}
              plotD={plotD}
              pieces={pieces}
              unit={unit}
              idPrefix="tpl-live"
              plotArea={check.plotArea}
              allocatedArea={check.allocatedArea}
              balanceArea={check.balanceArea}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
