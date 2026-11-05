"use client";
// Route Map / Location Plan - preview and print page.
//
// Folder layout:
//   page.tsx                       page state and the A4 sheet
//   hooks/useMapFeatures.ts        loads the OpenStreetMap data around the property
//   engine/routeMapGeo.ts          OpenStreetMap loading, main road search, routing (no DOM access)
//   engine/plotShape.ts            plot outline from the side lengths, rings, areas (no DOM access)
//   engine/labelLayout.ts          names inside outlines and boundary texts without overlap (no DOM access)
//   engine/topoStyle.ts            vector topo map style (OpenFreeMap + house footprints)
//   engine/types.ts / constants.ts / helpers.ts / leafletSupport.ts
//   components/LeafletMap.tsx      satellite view and topo / route view, plot editor
//   components/PlotSketch.tsx      engineering style plot drawing with dimensions
//   components/PreviewToolbar.tsx  screen-only controls
//   components/PhotoPanel.tsx      site photos beside the satellite view
//   components/NorthArrow.tsx      north symbol
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { analyzeMainRoad, findContainingArea, nearestRoadWay, plotRotationDeg, pointInRing, routeLengthMeters } from "./engine/routeMapGeo";
import type { LatLng, MainRoadResult } from "./engine/routeMapGeo";
import type { Landmark, MainRoadSummary, MapViewState, RouteMapData } from "./engine/types";
import {
  CYAN,
  DEFAULT_LANDMARK_HEIGHT_FT,
  DEFAULT_LANDMARK_WIDTH_FT,
  DISCLAIMER_TEXT,
  EMPTY_DIMS,
  EMPTY_LANDMARKS,
  EMPTY_POINTS,
  INSET_STORAGE_PREFIX,
  MAX_PHOTOS,
  PHOTO_STORAGE_PREFIX,
  PICK_ROAD_TOLERANCE_M,
  RETURN_TO_FORM_FLAG,
  ROUTE_MAP_TYPE,
  SIGNATORY_NAME,
  STORAGE_KEY,
} from "./engine/constants";
import { compressImageFile, findRoadSide, formatCoordinate, formatSignatureDate, mainRoadText, newId } from "./engine/helpers";
import { plotSidesFt, quadRing, rectAround, ringAreaSqFt, ringCenter, simplifyRing } from "./engine/plotShape";
import { useMapFeatures } from "./hooks/useMapFeatures";
import LeafletMap from "./components/LeafletMap";
import type { LandmarkShape, MapApi, TopoData } from "./components/LeafletMap";
import NorthArrow from "./components/NorthArrow";
import PhotoPanel from "./components/PhotoPanel";
import PlotSketch from "./components/PlotSketch";
import PreviewToolbar from "./components/PreviewToolbar";

// Only one click mode is active at a time
type EditMode = "none" | "route" | "landmark" | "pickRoad" | "plotEdit" | "plotDraw";

// Plot outlines whose area differs from the entered plot area by more than this share get a warning
const AREA_WARNING_SHARE = 0.1;

export default function RouteMapPreviewPage() {
  const router = useRouter();

  const [data, setData] = useState<RouteMapData | null>(null);
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [plotDraft, setPlotDraft] = useState<LatLng[]>([]);
  const [plotMessage, setPlotMessage] = useState("");
  const [insetImage, setInsetImage] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const mapApiRef = useRef<MapApi | null>(null);

  // Load the record handed over by the input form
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        router.replace("/route-map");
        return;
      }
      const parsed: RouteMapData = JSON.parse(raw);
      if (parsed.estimate_type && parsed.estimate_type !== ROUTE_MAP_TYPE) {
        router.replace("/route-map");
        return;
      }
      // The signature timestamp is fixed on first load so reopening the page does not change it
      const withStamp: RouteMapData = { ...parsed, generated_at: parsed.generated_at || new Date().toISOString() };
      setData(withStamp);

      const savedInset = sessionStorage.getItem(INSET_STORAGE_PREFIX + (parsed.ref_no || ""));
      if (savedInset) setInsetImage(savedInset);
      const savedPhotos = sessionStorage.getItem(PHOTO_STORAGE_PREFIX + (parsed.ref_no || ""));
      if (savedPhotos) setPhotos(JSON.parse(savedPhotos));
    } catch (e) {
      console.error("Failed to load route map data:", e);
      router.replace("/route-map");
    }
  }, [router]);

  // Persist every change made on this page (route, landmarks, plot outline, map views) next to the form data
  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to persist route map data:", e);
    }
  }, [data]);

  // The browser uses the document title as the default file name of "Save as PDF"
  useEffect(() => {
    if (!data) return;
    const previousTitle = document.title;
    document.title = `${data.customer_name || "CUSTOMER"} - ROUTE MAP`.toUpperCase();
    return () => {
      document.title = previousTitle;
    };
  }, [data?.customer_name]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateData = useCallback((patch: Partial<RouteMapData>) => {
    setData((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Coordinate entered on the form
  const siteLat = data ? parseFloat(data.latitude) : NaN;
  const siteLng = data ? parseFloat(data.longitude) : NaN;
  const siteValid = !isNaN(siteLat) && !isNaN(siteLng);
  const enteredSite = useMemo<LatLng | null>(() => (siteValid ? { lat: siteLat, lng: siteLng } : null), [siteValid, siteLat, siteLng]);
  const baseMode = data?.base_map || "topo";

  // OpenStreetMap data around the entered coordinate (roads for the main road search, buildings for the lines mode)
  const { features, status: mapStatus, setMessage, reload: handleReloadData, loadHere } = useMapFeatures(enteredSite, baseMode);

  // Plot outline: built from the side lengths and the area (not forced to 90 degree corners) and turned to follow the
  // street, unless it was moved, drawn or fitted to a building by hand
  const sideDims = useMemo(() => ({ ...EMPTY_DIMS, ...(data?.side_dims || {}) }), [data?.side_dims]);
  const { sides, areaSqFt } = useMemo(() => plotSidesFt(sideDims, data?.plot_area ?? ""), [sideDims, data?.plot_area]);
  const manualRing = data?.plot_polygon && data.plot_polygon.length >= 3 ? data.plot_polygon : null;

  // Position of the property: the entered coordinate, or the centre of the plot when it was adjusted by hand
  const site = useMemo<LatLng | null>(() => (manualRing ? ringCenter(manualRing) : enteredSite), [manualRing, enteredSite]);

  // Angle of the plot: detected from the nearest road and the road side of the plot, or typed in by hand
  const autoPlotAngle = useMemo(
    () => (site ? plotRotationDeg(site, features.roads, data ? findRoadSide(data.boundaries) : null) : 0),
    [site, features.roads, data?.boundaries] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const plotAngle = data?.plot_angle_override ?? autoPlotAngle;

  const plotRing = useMemo<LatLng[]>(
    () => manualRing ?? (site ? quadRing(site, sides, areaSqFt, plotAngle) : []),
    [manualRing, site, sides, areaSqFt, plotAngle]
  );

  // Main road search over the loaded road network
  const analysis = useMemo<MainRoadResult | null>(() => {
    if (!site || features.roads.length === 0) return null;
    return analyzeMainRoad(site, features.roads, { forceWayId: data?.main_road_override });
  }, [site, features.roads, data?.main_road_override]);

  // Colony (residential area) that contains the property
  const colony = useMemo(() => (site ? findContainingArea(site, features.areas) : null), [site, features.areas]);

  const mainWayIds = useMemo(() => new Set<number>(analysis?.wayIds ?? []), [analysis]);

  const mainRoadLabel = useMemo(
    () =>
      analysis
        ? { position: analysis.junction, text: (analysis.name ? `${analysis.name} (MAIN ROAD)` : "MAIN ROAD").toUpperCase() }
        : null,
    [analysis]
  );

  // Landmarks as outlines: the real building shape when known, otherwise a box turned like the plot
  const landmarkShapes = useMemo<LandmarkShape[]>(
    () =>
      (data?.landmarks || EMPTY_LANDMARKS).map((lm) => ({
        id: lm.id,
        name: lm.name,
        ring:
          lm.ring && lm.ring.length >= 3
            ? lm.ring
            : rectAround({ lat: lm.lat, lng: lm.lng }, Math.max(lm.width_ft, 1), Math.max(lm.height_ft, 1), plotAngle),
      })),
    [data?.landmarks, plotAngle]
  );

  // Keep the saved summary and the automatic route in step with the analysis. A route drawn by hand is never replaced.
  useEffect(() => {
    if (!analysis) return;
    const summary: MainRoadSummary = {
      name: analysis.name || analysis.ref || "",
      highway: analysis.highway,
      distance_m: Math.round(analysis.distanceM),
      direction: analysis.direction,
      on_main_road: analysis.onMainRoad,
    };
    setData((prev) => {
      if (!prev) return prev;
      const manualRoute = prev.route_source === "manual" || (!prev.route_source && (prev.route_points?.length ?? 0) > 0);
      const sameSummary = JSON.stringify(prev.main_road_summary) === JSON.stringify(summary);
      const sameRoute = manualRoute || JSON.stringify(prev.route_points) === JSON.stringify(analysis.path);
      if (sameSummary && sameRoute) return prev;
      return {
        ...prev,
        main_road_summary: summary,
        ...(manualRoute ? {} : { route_points: analysis.path, route_source: "auto" as const }),
      };
    });
  }, [analysis]);

  const handleSatelliteViewChange = useCallback((view: MapViewState) => updateData({ satellite_view: view }), [updateData]);
  const handleRouteViewChange = useCallback((view: MapViewState) => updateData({ route_view: view }), [updateData]);

  const handleAddRoutePoint = useCallback((p: LatLng) => {
    setData((prev) => (prev ? { ...prev, route_points: [...(prev.route_points || []), p], route_source: "manual" } : prev));
  }, []);

  // A landmark takes the real outline of the building that was clicked (house footprint of the topo map, or an
  // OpenStreetMap building); without a building it becomes a box of the default size
  const handleAddLandmark = useCallback(
    (p: LatLng) => {
      const name = window.prompt("Landmark name (e.g. HOUSE OF RAM SWAROOP):");
      if (!name || !name.trim()) return;
      let ring: LatLng[] | null = mapApiRef.current?.footprintAt(p) ?? null;
      if (!ring) {
        const building = features.buildings.find((b) => pointInRing(p, b.ring));
        if (building) ring = simplifyRing(building.ring, 0.3);
      }
      const centre = ring ? ringCenter(ring) : p;
      const landmark: Landmark = {
        id: newId(),
        name: name.trim().toUpperCase(),
        lat: centre.lat,
        lng: centre.lng,
        width_ft: DEFAULT_LANDMARK_WIDTH_FT,
        height_ft: DEFAULT_LANDMARK_HEIGHT_FT,
        ...(ring ? { ring } : {}),
      };
      setData((prev) => (prev ? { ...prev, landmarks: [...(prev.landmarks || []), landmark] } : prev));
    },
    [features.buildings]
  );

  // The user clicked a road to mark it as the main road
  const handlePickMainRoad = useCallback(
    (p: LatLng) => {
      const hit = nearestRoadWay(p, features.roads, PICK_ROAD_TOLERANCE_M);
      if (!hit) {
        alert("No road found near that click. Click closer to a road line.");
        return;
      }
      setData((prev) => (prev ? { ...prev, main_road_override: hit.way.id, route_source: "auto" } : prev));
      setEditMode("none");
    },
    [features.roads]
  );

  const updateLandmark = (id: string, patch: Partial<Landmark>) =>
    updateData({ landmarks: (data?.landmarks || []).map((lm) => (lm.id === id ? { ...lm, ...patch } : lm)) });

  const removeLandmark = (id: string) => updateData({ landmarks: (data?.landmarks || []).filter((lm) => lm.id !== id) });

  const handleUndoPoint = () => updateData({ route_points: (data?.route_points || []).slice(0, -1), route_source: "manual" });
  const handleClearRoute = () => updateData({ route_points: [], route_source: "manual" });

  // The vector topo map could not be created (libraries blocked, offline ...): continue with the road lines
  const handleTopoFailed = useCallback(
    (reason: string) => {
      console.warn("Topo map unavailable:", reason);
      updateData({ base_map: "lines" });
      setMessage("TOPO MAP UNAVAILABLE - USING ROAD LINES");
    },
    [updateData, setMessage]
  );

  // Back to the automatic main road and route
  const handleAutoRoute = () => {
    const hadOverride = data?.main_road_override !== undefined;
    updateData({
      route_source: "auto",
      main_road_override: undefined,
      ...(analysis && !hadOverride ? { route_points: analysis.path } : {}),
    });
  };

  // ---- Plot outline ----

  const commitPlotRing = useCallback(
    (ring: LatLng[]) => {
      updateData({ plot_polygon: ring });
      setPlotMessage("");
    },
    [updateData]
  );

  const addPlotDraftPoint = useCallback((p: LatLng) => setPlotDraft((prev) => [...prev, p]), []);

  const finishPlotDraw = useCallback(() => {
    if (plotDraft.length < 3) return;
    updateData({ plot_polygon: plotDraft });
    setPlotDraft([]);
    setEditMode("plotEdit");
    setPlotMessage("PLOT DRAWN - DRAG THE CORNERS TO FINE TUNE");
  }, [plotDraft, updateData]);

  // Takes the outline of the building under the property as the plot outline
  const handleFitBuilding = () => {
    if (baseMode !== "topo") {
      setPlotMessage("SWITCH TO THE TOPO MAP FIRST - IT HAS THE HOUSE FOOTPRINTS");
      return;
    }
    const ring = site ? mapApiRef.current?.footprintAt(site) : null;
    if (!ring) {
      setPlotMessage("NO BUILDING UNDER THE SITE - MOVE THE PLOT, OR DRAW IT BY HAND");
      return;
    }
    updateData({ plot_polygon: ring });
    setPlotMessage(`PLOT SET TO THE BUILDING SHAPE (${Math.round(ringAreaSqFt(ring))} SQ. FT)`);
  };

  const handleResetPlotShape = () => {
    updateData({ plot_polygon: undefined });
    setPlotMessage("");
  };

  // ---- Click modes (one at a time) ----

  const setMode = (next: EditMode) => {
    setEditMode(next);
    if (next !== "plotDraw") setPlotDraft([]);
  };
  const toggleMode = (mode: EditMode) => setMode(editMode === mode ? "none" : mode);

  // ---- Images ----

  const handleInsetUpload = async (file?: File) => {
    if (!file || !data) return;
    try {
      const url = await compressImageFile(file);
      setInsetImage(url);
      try {
        sessionStorage.setItem(INSET_STORAGE_PREFIX + (data.ref_no || ""), url);
      } catch {
        // Storage quota exceeded: the image still works for this session
      }
    } catch (e) {
      alert("Could not read the selected image. Please try another file.");
    }
  };

  const handleInsetRemove = () => {
    setInsetImage(null);
    try {
      sessionStorage.removeItem(INSET_STORAGE_PREFIX + (data?.ref_no || ""));
    } catch {}
  };

  const savePhotos = (next: string[]) => {
    setPhotos(next);
    try {
      sessionStorage.setItem(PHOTO_STORAGE_PREFIX + (data?.ref_no || ""), JSON.stringify(next));
    } catch {
      // Storage quota exceeded: the photos still work for this session
    }
  };

  const handlePhotoUpload = async (file?: File) => {
    if (!file || photos.length >= MAX_PHOTOS) return;
    try {
      savePhotos([...photos, await compressImageFile(file, 1000)]);
    } catch (e) {
      alert("Could not read the selected photo. Please try another file.");
    }
  };

  const handleBackToInput = () => {
    try {
      sessionStorage.setItem(RETURN_TO_FORM_FLAG, "1");
    } catch {}
    router.push("/route-map");
  };

  if (!data) {
    return <div className="p-8 text-center font-bold uppercase">LOADING ROUTE MAP...</div>;
  }

  if (!site || !enteredSite) {
    return (
      <div className="p-8 text-center font-bold uppercase">
        INVALID GEO COORDINATES.{" "}
        <button className="underline" onClick={handleBackToInput}>GO BACK TO INPUT</button>
      </div>
    );
  }

  const routePoints = data.route_points || EMPTY_POINTS;
  const landmarkItems = data.landmarks || EMPTY_LANDMARKS;
  const routeMeters = Math.round(routeLengthMeters(routePoints));
  const summary = data.main_road_summary;

  // Coordinate printed on the sheet: the entered one, or the centre of the plot when the plot was adjusted by hand
  const printedLat = manualRing ? String(site.lat) : data.latitude;
  const printedLng = manualRing ? String(site.lng) : data.longitude;

  const shapeArea = Math.round(ringAreaSqFt(plotRing));
  const enteredArea = Math.round(areaSqFt);
  const areaDiffers = enteredArea > 0 && Math.abs(shapeArea - enteredArea) / enteredArea > AREA_WARNING_SHARE;
  const plotInfo = `SHAPE AREA ${shapeArea} SQ. FT (ENTERED ${enteredArea})${areaDiffers ? " - DIFFERENT, CHECK THE OUTLINE" : ""}`;

  const topo: TopoData = {
    features,
    mainWayIds,
    colonyId: colony?.id ?? null,
    mainRoadLabel,
    picking: editMode === "pickRoad",
    onPick: handlePickMainRoad,
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto p-2 sm:p-4 font-sans text-black">
      <style>{`
        #route-map-sheet { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        #route-map-sheet .leaflet-container { font-family: Arial, sans-serif; }
        #route-map-sheet .rm-street-gray .leaflet-tile-pane { filter: grayscale(1) contrast(1.1); }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { height: 210mm !important; overflow: hidden !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #route-map-sheet, #route-map-sheet * { visibility: visible !important; }
          #route-map-sheet { position: fixed !important; left: 0; top: 0; margin: 0 !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          #route-map-sheet .leaflet-control-zoom { display: none !important; }
        }
      `}</style>

      {/* Toolbar (screen only) */}
      <PreviewToolbar
        baseMode={baseMode}
        onBaseModeChange={(mode) => updateData({ base_map: mode })}
        mapBusy={mapStatus.busy}
        mapMessage={mapStatus.message}
        canLoadHere={!!data.route_view}
        onReloadData={handleReloadData}
        onLoadHere={() => loadHere(data.route_view)}
        plotAngle={plotAngle}
        angleIsAuto={data.plot_angle_override === undefined}
        onAngleChange={(value) => updateData({ plot_angle_override: value })}
        mainRoadText={summary ? mainRoadText(summary) : null}
        pickMode={editMode === "pickRoad"}
        onTogglePick={() => toggleMode("pickRoad")}
        onAutoRoute={handleAutoRoute}
        drawMode={editMode === "route"}
        onToggleDraw={() => toggleMode("route")}
        routePointCount={routePoints.length}
        routeMeters={routeMeters}
        routeSource={data.route_source}
        onUndoPoint={handleUndoPoint}
        onClearRoute={handleClearRoute}
        landmarkMode={editMode === "landmark"}
        onToggleLandmark={() => toggleMode("landmark")}
        landmarks={landmarkItems}
        onUpdateLandmark={updateLandmark}
        onRemoveLandmark={removeLandmark}
        plotMode={manualRing ? "manual" : "auto"}
        plotInfo={plotInfo}
        plotMessage={plotMessage}
        plotEditMode={editMode === "plotEdit"}
        onTogglePlotEdit={() => toggleMode("plotEdit")}
        plotDrawMode={editMode === "plotDraw"}
        plotDraftCount={plotDraft.length}
        onTogglePlotDraw={() => toggleMode("plotDraw")}
        onFinishPlotDraw={finishPlotDraw}
        onFitBuilding={handleFitBuilding}
        onResetPlotShape={handleResetPlotShape}
        photoCount={photos.length}
        maxPhotos={MAX_PHOTOS}
        onPhotoUpload={handlePhotoUpload}
        onPhotoRemove={() => savePhotos(photos.slice(0, -1))}
        hasInset={!!insetImage}
        onInsetUpload={handleInsetUpload}
        onInsetRemove={handleInsetRemove}
        onBack={handleBackToInput}
        onPrint={() => window.print()}
      />

      {/* Sheet (A4 landscape, printed as is) */}
      <div id="route-map-scroll" className="overflow-x-auto">
        <div
          id="route-map-sheet"
          style={{
            width: "297mm",
            height: "210mm",
            padding: "10mm 12mm",
            boxSizing: "border-box",
            background: "#fff",
            boxShadow: "0 0 8px rgba(0,0,0,0.25)",
            margin: "0 auto",
            fontFamily: "Arial, Helvetica, sans-serif",
            color: "#000",
          }}
        >
          <div style={{ display: "flex", width: "100%", height: "100%", border: "0.3mm solid #000", boxSizing: "border-box" }}>
            {/* LEFT COLUMN */}
            <div style={{ width: "71%", display: "flex", flexDirection: "column", borderRight: "0.3mm solid #000" }}>
              {/* Satellite view with the site photos beside it */}
              <div style={{ height: "38%", display: "flex", borderBottom: "0.3mm solid #000" }}>
                <div style={{ position: "relative", flex: "0 0 66%" }}>
                  <LeafletMap
                    site={site}
                    tile="satellite"
                    defaultZoom={17}
                    initialView={data.satellite_view}
                    markerKind="pin"
                    onViewChange={handleSatelliteViewChange}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0, borderLeft: "0.3mm solid #000", overflow: "hidden" }}>
                  <PhotoPanel photos={photos} />
                </div>
              </div>

              {/* Route map */}
              <div style={{ flex: 1, position: "relative" }}>
                <LeafletMap
                  site={site}
                  tile="street"
                  base={baseMode}
                  defaultZoom={17}
                  initialView={data.route_view}
                  markerKind="none"
                  plot={{
                    ring: plotRing,
                    label: "PROPOSED SITE",
                    boundaries: data.boundaries,
                    edit: { active: editMode === "plotEdit", onChange: commitPlotRing },
                    draw: { active: editMode === "plotDraw", draft: plotDraft, onAddPoint: addPlotDraftPoint, onFinish: finishPlotDraw },
                  }}
                  landmarks={{ items: landmarkShapes, adding: editMode === "landmark", onAdd: handleAddLandmark }}
                  apiRef={mapApiRef}
                  topo={topo}
                  statusChip={mapStatus.message}
                  onTopoFailed={handleTopoFailed}
                  onViewChange={handleRouteViewChange}
                  route={{ points: routePoints, drawing: editMode === "route", onAddPoint: handleAddRoutePoint }}
                />

                {/* Coordinates and main road */}
                <div style={{ position: "absolute", top: "2mm", left: "3mm", zIndex: 1200, pointerEvents: "none", maxWidth: "44%" }}>
                  <div style={{ background: "rgba(255,255,255,0.9)", padding: "0.5mm 2mm", fontWeight: 700, fontSize: "13pt", color: CYAN, display: "inline-block" }}>
                    LAT &amp; LONG : {formatCoordinate(printedLat)}, {formatCoordinate(printedLng)}
                  </div>
                  {summary && (
                    <div style={{ marginTop: "1mm", background: "rgba(255,255,255,0.9)", padding: "0.5mm 2mm", fontWeight: 700, fontSize: "7.5pt", display: "inline-block", lineHeight: 1.25 }}>
                      {mainRoadText(summary)}
                    </div>
                  )}
                </div>

                {/* Khasra / cadastral inset */}
                {insetImage && (
                  <img
                    src={insetImage}
                    alt="Khasra map"
                    style={{ position: "absolute", top: "2mm", left: "46%", width: "auto", height: "auto", maxWidth: "27%", maxHeight: "34%", background: "#fff", border: "0.3mm solid #000", zIndex: 1100, pointerEvents: "none" }}
                  />
                )}

                {/* North symbol (maps have north at the top, like a normal map) */}
                <div style={{ position: "absolute", right: "3mm", top: "2mm", zIndex: 1200, pointerEvents: "none" }}>
                  <NorthArrow color={CYAN} />
                </div>

                {/* Disclaimer */}
                <div style={{ position: "absolute", left: "2mm", bottom: "1.5mm", zIndex: 1200, maxWidth: "62%", background: "rgba(255,255,255,0.9)", padding: "0.3mm 1mm", fontWeight: 700, fontSize: "5.5pt", lineHeight: 1.25, pointerEvents: "none" }}>
                  {DISCLAIMER_TEXT}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ width: "29%", display: "flex", flexDirection: "column" }}>
              {/* Customer block */}
              <div style={{ flex: "0 0 34.5%", padding: "3mm 3mm 2mm", boxSizing: "border-box", overflow: "hidden" }}>
                <div style={{ color: CYAN, fontWeight: 700, fontSize: "12.5pt", textAlign: "center", lineHeight: 1.15, marginBottom: "4mm" }}>
                  ROUTE MAP / KEY PLAN / LOCATION PLAN
                </div>
                <div style={{ color: CYAN, fontWeight: 700, fontSize: "8.5pt", marginBottom: "1.5mm" }}>CUSTOMER NAME</div>
                <div style={{ fontWeight: 700, fontSize: "8pt", textTransform: "uppercase", lineHeight: 1.25, marginBottom: "3.5mm" }}>
                  {data.customer_name}
                </div>
                <div style={{ color: CYAN, fontWeight: 700, fontSize: "8.5pt", marginBottom: "1.5mm" }}>PROPERTY ADDRESS :</div>
                <div style={{ fontWeight: 700, fontSize: "8pt", textTransform: "uppercase", lineHeight: 1.25 }}>
                  {data.property_address}
                </div>
              </div>

              {/* Plot area row */}
              <div style={{ flex: "0 0 4%", borderTop: "0.3mm solid #000", borderBottom: "0.3mm solid #000", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 3mm", fontWeight: 700, fontSize: "10.5pt", textTransform: "uppercase" }}>
                <span>PLOT AREA</span>
                <span>{data.plot_area} SQ. FT</span>
              </div>

              {/* Plot sketch */}
              <div style={{ flex: 1, minHeight: 0, padding: "1mm" }}>
                <PlotSketch boundaries={data.boundaries} dims={sideDims} />
              </div>

              {/* Signature block */}
              <div style={{ flex: "0 0 17.5%", borderTop: "0.3mm solid #000", padding: "2.5mm 3mm", boxSizing: "border-box", fontSize: "10.5pt", lineHeight: 1.3 }}>
                <div>Digitally signed by {SIGNATORY_NAME}</div>
                <div>Date: {formatSignatureDate(data.generated_at)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
