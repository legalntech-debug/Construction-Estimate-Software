"use client";
// Screen-only control panel above the sheet (hidden when printing).
import type { BaseMode, Landmark } from "../engine/types";

interface PreviewToolbarProps {
  baseMode: BaseMode;
  onBaseModeChange: (mode: BaseMode) => void;
  mapBusy: boolean;
  mapMessage: string;
  canLoadHere: boolean;
  onReloadData: () => void;
  onLoadHere: () => void;

  // Plot shape angle (degrees, clockwise). It follows the nearest street unless a value was typed in.
  plotAngle: number;
  angleIsAuto: boolean;
  onAngleChange: (value: number | undefined) => void;

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

  // Plot outline: built from the side lengths (auto) or moved / drawn / fitted by hand (manual)
  plotMode: "auto" | "manual";
  plotInfo: string;
  plotMessage: string;
  plotEditMode: boolean;
  onTogglePlotEdit: () => void;
  plotDrawMode: boolean;
  plotDraftCount: number;
  onTogglePlotDraw: () => void;
  onFinishPlotDraw: () => void;
  onFitBuilding: () => void;
  onResetPlotShape: () => void;

  // Site photos printed beside the satellite view
  photoCount: number;
  maxPhotos: number;
  onPhotoUpload: (file?: File) => void;
  onPhotoRemove: () => void;

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
        <button onClick={() => p.onBaseModeChange("topo")} className={p.baseMode === "topo" ? activeBtn : toolBtn}>TOPO MAP (AUTO)</button>
        <button onClick={() => p.onBaseModeChange("lines")} className={p.baseMode === "lines" ? activeBtn : toolBtn}>ROAD LINES</button>
        <button onClick={() => p.onBaseModeChange("tiles")} className={p.baseMode === "tiles" ? activeBtn : toolBtn}>STREET MAP</button>
        <button onClick={p.onReloadData} disabled={p.mapBusy} className={`${toolBtn} disabled:opacity-40`}>↻ RELOAD DATA</button>
        <button onClick={p.onLoadHere} disabled={p.mapBusy || !p.canLoadHere} className={`${toolBtn} disabled:opacity-40`}>⬇ LOAD MAP DATA HERE</button>
        {p.mapMessage && <span className="text-[11px] sm:text-xs font-bold text-blue-800">{p.mapMessage}</span>}
        <span className="basis-full text-[11px] sm:text-xs text-gray-600 normal-case">
          Topo map: roads, names and places from OpenStreetMap, houses from Google / Microsoft building footprints. It is
          drawn automatically; where a house or road is still missing, add it as a landmark or draw the route by hand.
        </span>
      </div>

      <div className={rowClass}>
        <span className="font-bold text-xs sm:text-sm">PLOT OUTLINE:</span>
        <span className="text-xs sm:text-sm font-bold">{p.plotMode === "auto" ? "AUTO (FROM SIDE LENGTHS)" : "MANUAL"}</span>
        <button onClick={p.onTogglePlotEdit} className={p.plotEditMode ? activeBtn : toolBtn}>
          {p.plotEditMode ? "✔ DONE EDITING" : "✥ MOVE / EDIT PLOT"}
        </button>
        <button onClick={p.onFitBuilding} className={toolBtn}>🏠 FIT TO BUILDING</button>
        <button onClick={p.onTogglePlotDraw} className={p.plotDrawMode ? activeBtn : toolBtn}>
          {p.plotDrawMode ? "✖ CANCEL DRAWING" : "✏️ DRAW PLOT BY HAND"}
        </button>
        {p.plotDrawMode && (
          <button onClick={p.onFinishPlotDraw} disabled={p.plotDraftCount < 3} className={`${toolBtn} disabled:opacity-40`}>
            ✔ FINISH ({p.plotDraftCount} POINTS)
          </button>
        )}
        <button onClick={p.onResetPlotShape} disabled={p.plotMode === "auto"} className={`${toolBtn} disabled:opacity-40`}>↺ BACK TO AUTO</button>
        {p.plotInfo && <span className="text-xs sm:text-sm font-bold">{p.plotInfo}</span>}
        {p.plotMessage && <span className="text-[11px] sm:text-xs font-bold text-blue-800">{p.plotMessage}</span>}
        {p.plotEditMode && (
          <span className="basis-full text-[11px] sm:text-xs text-blue-800 normal-case">
            Drag the ✥ handle to move the whole plot (if the coordinate is a little off), drag a square corner to reshape it, click a
            round mid point to add a corner, double click a corner to delete it. Works with mouse and touch.
          </span>
        )}
        {p.plotDrawMode && (
          <span className="basis-full text-[11px] sm:text-xs text-blue-800 normal-case">
            Click the corners of the plot one by one on the route map. Click the first (green) point again, or press Finish, to close it.
          </span>
        )}
      </div>

      <div className={rowClass}>
        <span className="font-bold text-xs sm:text-sm">PLOT ANGLE:</span>
        <input
          type="number"
          step="1"
          min={-90}
          max={90}
          value={Number.isFinite(p.plotAngle) ? p.plotAngle : 0}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) p.onAngleChange(Math.max(-90, Math.min(90, v)));
          }}
          className="w-20 border border-black p-1 text-center bg-white"
          title="Degrees, clockwise from north"
        />
        <span className="text-xs sm:text-sm font-bold">°</span>
        <button onClick={() => p.onAngleChange(undefined)} className={p.angleIsAuto ? activeBtn : toolBtn}>
          {p.angleIsAuto ? "✔ AUTO" : "↺ AUTO"}
        </button>
        <span className="text-[11px] sm:text-xs text-gray-600 normal-case">
          Auto: the plot follows the nearest street (its road side is made parallel to the road).
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
            Click on the building in the route map; its real shape is taken automatically. Then type the name.
          </span>
        )}
        {p.landmarks.map((lm) => (
          <div key={lm.id} className="flex items-center gap-1 border border-black bg-white px-2 py-1 text-xs">
            <span className="font-bold">{lm.name}</span>
            {lm.ring ? (
              <span className="text-[10px] text-gray-600">BUILDING SHAPE</span>
            ) : (
              <>
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
              </>
            )}
            <button onClick={() => p.onRemoveLandmark(lm.id)} className="px-1 font-bold hover:text-red-600" title="Remove landmark">✕</button>
          </div>
        ))}
      </div>

      <div className={rowClass}>
        <span className="font-bold text-xs sm:text-sm">SITE PHOTOS (BESIDE SATELLITE VIEW):</span>
        <label className={`${toolBtn} cursor-pointer ${p.photoCount >= p.maxPhotos ? "opacity-40 pointer-events-none" : ""}`}>
          📷 ADD PHOTO ({p.photoCount}/{p.maxPhotos})
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              p.onPhotoUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {p.photoCount > 0 && <button onClick={p.onPhotoRemove} className={toolBtn}>REMOVE LAST</button>}
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
