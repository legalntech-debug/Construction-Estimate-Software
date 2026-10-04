import React from "react";
import {
  SectionCutDef, ElevationSide, CutAxis, SectionLook, SECTION_COLORS, normalizeLook,
} from "../engine/sectionEngine";

interface Props {
  cuts: SectionCutDef[];
  onCutsChange: (cuts: SectionCutDef[]) => void;
  elevationSides: ElevationSide[];
  onElevationSidesChange: (sides: ElevationSide[]) => void;
}

const ids = ["A", "B", "C", "D", "E"];

export default function CadSectionControls({ cuts, onCutsChange, elevationSides, onElevationSidesChange }: Props) {
  const update = (i: number, patch: Partial<SectionCutDef>) => {
    onCutsChange(cuts.map((c, k) => {
      if (k !== i) return c;
      const merged = { ...c, ...patch };
      merged.look = normalizeLook(merged.axis, merged.look);
      return merged;
    }));
  };

  const add = () => {
    if (cuts.length >= 5) return;
    const used = new Set(cuts.map((c) => c.id));
    const id = ids.find((x) => !used.has(x)) || String(cuts.length + 1);
    const vertical = cuts.length % 2 === 0;
    onCutsChange([
      ...cuts,
      { id, axis: vertical ? "VERTICAL" : "HORIZONTAL", positionFt: "AUTO", look: vertical ? "LEFT" : "UP", color: SECTION_COLORS[cuts.length % SECTION_COLORS.length] },
    ]);
  };

  const toggleSide = (s: ElevationSide) => {
    const next = elevationSides.includes(s) ? elevationSides.filter((x) => x !== s) : [...elevationSides, s];
    onElevationSidesChange((["FRONT", "REAR", "LEFT", "RIGHT"] as ElevationSide[]).filter((x) => next.includes(x)));
  };

  const cellCls = "flex items-center bg-gray-50 border border-black px-1 py-0.5";

  return (
    <div className="border-t-2 border-black pt-2 mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="font-black text-xs">SECTION CUTS</div>
        <button type="button" onClick={add} disabled={cuts.length >= 5}
          className="border border-black bg-white px-1.5 py-0.5 text-[8px] font-black cursor-pointer disabled:opacity-40">
          + ADD
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {cuts.map((c, i) => {
          const isAuto = c.positionFt === "AUTO";
          return (
            <div key={c.id + i} className="border border-black bg-white p-1.5 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-black text-[10px]" style={{ color: c.color }}>SECTION {c.id}-{c.id}</span>
                <button type="button" onClick={() => onCutsChange(cuts.filter((_, k) => k !== i))}
                  className="text-[8px] font-black text-red-600 cursor-pointer">REMOVE</button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className={cellCls}>
                  <select value={c.axis} onChange={(e) => update(i, { axis: e.target.value as CutAxis })}
                    className="w-full bg-transparent text-center font-black text-[8px] outline-none cursor-pointer">
                    <option value="VERTICAL">LENGTH-WISE (|)</option>
                    <option value="HORIZONTAL">WIDTH-WISE (—)</option>
                  </select>
                </div>
                <div className={cellCls}>
                  <select value={c.look} onChange={(e) => update(i, { look: e.target.value as SectionLook })}
                    className="w-full bg-transparent text-center font-black text-[8px] outline-none cursor-pointer">
                    {c.axis === "VERTICAL" ? (
                      <>
                        <option value="LEFT">VIEW ← LEFT</option>
                        <option value="RIGHT">VIEW → RIGHT</option>
                      </>
                    ) : (
                      <>
                        <option value="UP">VIEW ↑ BACK</option>
                        <option value="DOWN">VIEW ↓ FRONT</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <label className={`${cellCls} gap-1 cursor-pointer`}>
                  <input type="checkbox" checked={isAuto} onChange={(e) => update(i, { positionFt: e.target.checked ? "AUTO" : 5 })} />
                  <span className="text-[8px] font-black">AUTO (STAIR)</span>
                </label>
                <div className={cellCls}>
                  <input type="number" min={0} step={0.5} disabled={isAuto}
                    value={isAuto ? "" : Number(c.positionFt)}
                    placeholder="FT"
                    onChange={(e) => update(i, { positionFt: Number(e.target.value) || 0 })}
                    className="w-full bg-transparent text-center font-black text-[9px] outline-none disabled:opacity-40" />
                  <span className="text-[8px] font-bold text-gray-600 ml-0.5">FT</span>
                </div>
              </div>
              <div className="text-[7.5px] font-bold text-gray-600">
                {c.axis === "VERTICAL" ? "Distance from LEFT edge of plan" : "Distance from TOP edge of plan"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="font-black text-xs mt-2.5 mb-1">ELEVATIONS</div>
      <div className="border border-black bg-white p-1.5 grid grid-cols-2 gap-1">
        {(["FRONT", "REAR", "LEFT", "RIGHT"] as ElevationSide[]).map((s) => (
          <label key={s} className="flex items-center gap-1 text-[9px] font-black cursor-pointer">
            <input type="checkbox" checked={elevationSides.includes(s)} onChange={() => toggleSide(s)} />
            {s}
          </label>
        ))}
      </div>
    </div>
  );
}
