"use client";
// Screen-only control panel above the sheet (hidden when printing).
import type { BaseMode, Landmark } from "../types";

interface PreviewToolbarProps {
  baseMode: BaseMode;
  onBaseModeChange: (mode: BaseMode) => void;
  mapBusy: boolean;
  mapMessage: string;
  canLoadHere: boolean;
  onReloadData: () => void;
  onLoadHere: () => void;

  // Text of the detected main road, or null while nothing was found
  mainRoadText: string | null;
  pickMode: boolean;
  onTogglePick: () => void;
  onAutoRoute: () => void;

  drawMode: boolean;
  onToggleDraw: () => void;
  routePointCount: number;
  routeMeters: number;
  routeSource?: "auto" | "manual";
  onUndoPoint: () => void;
  onClearRoute: () => void;

  landmarkMode: boolean;
  onToggleLandmark: () => void;
  landmarks: Landmark[];
  onUpdateLandmark: (id: string, patch: Partial<Landmark>) => void;
  onRemoveLandmark: (id: string) => void;

  hasInset: boolean;
  onInsetUpload: (file?: File) => void;
  onInsetRemove: () => void;

  onBack: () => void;
  onPrint: () => void;
}

const toolBtn = "border border-black px-3 py-2 font-bold uppercase text-xs sm:text-sm bg-white hover:bg-gray-100";
const activeBtn = "border border-black px-3 py-2 font-bold uppercase text-xs sm:text-sm bg-blue-700 text-white";
const rowClass = "flex flex-wrap items-center gap-2 border-t border-black pt-3";

const toNumber = (value: string) => Number(value.replace(/[^0-9.]/g, "")) || 0;

export default function PreviewToolbar(p: PreviewToolbarProps) {
  return (
    <div className="no-print border border-black bg-gray-100 p-3 mb-4 space-y-3 uppercase">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={p.onBack} className={toolBtn}>← BACK TO INPUT</button>
        <button onClick={p.onPrint} className="bg-black text-white px-4 py-2 font-bold uppercase text-xs sm:text-sm hover:bg-gray-800">
          🖨️ PRINT / SAVE PDF
        </button>
        <span className="text-[11px] sm:text-xs text-gray-600 normal-case">
          Choose "Save as PDF", paper A4, layout Landscape, margins None.
        </span>
      </div>

      <div className={rowClass}>
        <span className="font-bold text-xs sm:text-sm">ROUTE MAP BASE:</span>
        <button onClick={() => p.onBaseModeChange("lines")} className={p.baseMode === "lines" ? activeBtn : toolBtn}>TOPOGRAPHY (AUTO)</button>
        <button onClick={() => p.onBaseModeChange("tiles")} className={p.baseMode === "tiles" ? activeBtn : toolBtn}>STREET MAP</button>
        <button onClick={p.onReloadData} disabled={p.mapBusy} className={`${toolBtn} disabled:opacity-40`}>↻ RELOAD DATA</button>
        <button onClick={p.onLoadHere} disabled={p.mapBusy || !p.canLoadHere} className={`${toolBtn} disabled:opacity-40`}>⬇ LOAD MAP DATA HERE</button>
        {p.mapMessage && <span className="text-[11px] sm:text-xs font-bold text-blue-800">{p.mapMessage}</span>}
        <span className="basis-full text-[11px] sm:text-xs text-gray-600 normal-case">
          Roads, built houses and colonies come from OpenStreetMap, so only what is mapped there is drawn. Where a house or road
          is missing, add it as a landmark or draw the route by hand.
        </span>
      </div>

      <div className={rowClass}>
        <span className="font-bold text-xs sm:text-sm">MAIN ROAD:</span>
        <span className="text-xs sm:text-sm font-bold">{p.mainRoadText ?? (p.mapBusy ? "SEARCHING…" : "NOT FOUND")}</span>
        <button onClick={p.onTogglePick} className={p.pickMode ? activeBtn : toolBtn}>
          {p.pickMode ? "✔ CLICK A ROAD ON THE MAP" : "🛣 PICK MAIN ROAD"}
        </button>
        <button onClick={p.onAutoRoute} className={toolBtn}>⚙ AUTO MAIN ROAD & ROUTE</button>
      </div>

      <div className={rowClass}>
        <span className="font-bold text-xs sm:text-sm">ROUTE:</span>
        <button onClick={p.onToggleDraw} className={p.drawMode ? activeBtn : toolBtn}>
          {p.drawMode ? "✔ DONE DRAWING" : "✏️ DRAW ROUTE BY HAND"}
        </button>
        <button onClick={p.onUndoPoint} disabled={p.routePointCount === 0} className={`${toolBtn} disabled:opacity-40`}>↩ UNDO POINT</button>
        <button onClick={p.onClearRoute} disabled={p.routePointCount === 0} className={`${toolBtn} disabled:opacity-40`}>🗑 CLEAR ROUTE</button>
        <span className="font-bold text-xs sm:text-sm">
          {p.routePointCount >= 2 ? `DISTANCE: ~${p.routeMeters} M (${p.routeSource === "manual" ? "MANUAL" : "AUTO"})` : "NO ROUTE YET"}
        </span>
        {p.drawMode && (
          <span className="text-[11px] sm:text-xs text-blue-800 normal-case">
            Click on the route map (lower left) from the main road towards the site. The last click gets the arrow.
          </span>
        )}
      </div>

      <div className={rowClass}>
        <span className="font-bold text-xs sm:text-sm">LANDMARKS:</span>
        <button onClick={p.onToggleLandmark} className={p.landmarkMode ? activeBtn : toolBtn}>
          {p.landmarkMode ? "✔ DONE ADDING" : "➕ ADD LANDMARK"}
        </button>
        {p.landmarkMode && (
          <span className="text-[11px] sm:text-xs text-blue-800 normal-case">
            Click on the route map where the landmark stands, then type its name.
          </span>
        )}
        {p.landmarks.map((lm) => (
          <div key={lm.id} className="flex items-center gap-1 border border-black bg-white px-2 py-1 text-xs">
            <span className="font-bold">{lm.name}</span>
            <input
              type="text"
              inputMode="decimal"
              value={lm.width_ft || ""}
              onChange={(e) => p.onUpdateLandmark(lm.id, { width_ft: toNumber(e.target.value) })}
              className="w-12 border border-black p-0.5 text-center"
              title="Width (ft, east-west)"
            />
            ×
            <input
              type="text"
              inputMode="decimal"
              value={lm.height_ft || ""}
              onChange={(e) => p.onUpdateLandmark(lm.id, { height_ft: toNumber(e.target.value) })}
              className="w-12 border border-black p-0.5 text-center"
              title="Height (ft, north-south)"
            />
            FT
            <button onClick={() => p.onRemoveLandmark(lm.id)} className="px-1 font-bold hover:text-red-600" title="Remove landmark">✕</button>
          </div>
        ))}
      </div>

      <div className={rowClass}>
        <span className="font-bold text-xs sm:text-sm">KHASRA / CADASTRAL MAP:</span>
        <label className={`${toolBtn} cursor-pointer`}>
          📎 {p.hasInset ? "REPLACE IMAGE" : "ADD IMAGE"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              p.onInsetUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {p.hasInset && <button onClick={p.onInsetRemove} className={toolBtn}>REMOVE</button>}
      </div>
    </div>
  );
}
