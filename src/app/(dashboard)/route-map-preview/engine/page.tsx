"use client";
// Route Map / Location Plan - preview and print page.
//
// Folder layout:
//   page.tsx                    page state, data loading and the A4 sheet
//   routeMapGeo.ts              engine: OpenStreetMap loading, main road search, routing (no DOM access)
//   types.ts / constants.ts     shared types and constants
//   helpers.ts                  formatting, text measuring, sizing
//   leafletSupport.ts           Leaflet loader and drawing helpers
//   components/LeafletMap.tsx   satellite view and topography / route view
//   components/PlotSketch.tsx   engineering style plot drawing with dimensions
//   components/PreviewToolbar.tsx  screen-only controls
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  EMPTY_FEATURES,
  analyzeMainRoad,
  findContainingArea,
  loadAround,
  nearestRoadWay,
  plotRotationDeg,
  routeLengthMeters,
} from "./routeMapGeo";
import type { LoadPart } from "./routeMapGeo";
import type { LatLng, MainRoadResult, MapFeatures } from "./routeMapGeo";
import type { BaseMode, Landmark, MainRoadSummary, MapViewState, RouteMapData } from "./types";
import {
  CYAN,
  DEFAULT_LANDMARK_HEIGHT_FT,
  DEFAULT_LANDMARK_WIDTH_FT,
  DISCLAIMER_TEXT,
  EMPTY_DIMS,
  EMPTY_LANDMARKS,
  EMPTY_POINTS,
  EXTRA_LOAD_BUILDING_RADIUS_M,
  EXTRA_LOAD_ROAD_RADIUS_M,
  INSET_STORAGE_PREFIX,
  PICK_ROAD_TOLERANCE_M,
  RETURN_TO_FORM_FLAG,
  ROUTE_MAP_TYPE,
  SIGNATORY_NAME,
  STORAGE_KEY,
} from "./constants";
import { compressImageFile, findRoadSide, formatCoordinate, formatSignatureDate, getPlotSizeFt, mainRoadText, newId } from "./helpers";
import LeafletMap from "./components/LeafletMap";
import type { TopoData } from "./components/LeafletMap";
import NorthArrow from "./components/NorthArrow";
import PlotSketch from "./components/PlotSketch";
import PreviewToolbar from "./components/PreviewToolbar";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RouteMapPreviewPage() {
  const router = useRouter();

  const [data, setData] = useState<RouteMapData | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [landmarkMode, setLandmarkMode] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [insetImage, setInsetImage] = useState<string | null>(null);

  // Roads, buildings and colonies around the property (OpenStreetMap), loaded once per property
  const [features, setFeatures] = useState<MapFeatures>(EMPTY_FEATURES);
  const [mapStatus, setMapStatus] = useState<{ busy: boolean; message: string }>({ busy: false, message: "" });
  const loadedSiteRef = useRef("");
  // True once buildings and colonies were downloaded as well (needed by the road lines mode only)
  const fullDataLoadedRef = useRef(false);

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
    } catch (e) {
      console.error("Failed to load route map data:", e);
      router.replace("/route-map");
    }
  }, [router]);

  // Persist every change made on this page (route, landmarks, side dimensions, map views) next to the form data
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

  const siteLat = data ? parseFloat(data.latitude) : NaN;
  const siteLng = data ? parseFloat(data.longitude) : NaN;
  const siteValid = !isNaN(siteLat) && !isNaN(siteLng);
  const baseMode: BaseMode = data?.base_map || "topo";

  // Message for the toolbar and the map after a load finished
  const finishMessage = (outcome: { ok: boolean; warning?: string; error?: string; features: MapFeatures }) => {
    if (!outcome.ok) return `MAP DATA UNAVAILABLE (${outcome.error || "NO RESPONSE"}) - RELOAD OR USE STREET MAP`;
    if (outcome.features.roads.length === 0) return "NO ROAD DATA HERE - USE STREET MAP OR DRAW THE ROUTE";
    return outcome.warning || "";
  };

  // Initial data load around the property. The topo map only needs the roads (for the main road search); the road lines
  // mode also needs buildings and colonies. Roads are drawn as soon as they arrive.
  const loadSite = useCallback(async (s: LatLng, skipCache = false, parts: LoadPart[] = ["roads"]) => {
    setMapStatus({ busy: true, message: "LOADING ROADS…" });
    const outcome = await loadAround(
      s,
      EMPTY_FEATURES,
      (features, message) => {
        setFeatures(features);
        setMapStatus({ busy: true, message });
      },
      { findMainRoad: true, skipCache, parts }
    );
    setFeatures(outcome.features);
    fullDataLoadedRef.current = parts.includes("buildings") && outcome.ok;
    setMapStatus({ busy: false, message: finishMessage(outcome) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!siteValid) return;
    const key = `${siteLat},${siteLng}`;
    if (loadedSiteRef.current === key) return;
    loadedSiteRef.current = key;
    loadSite({ lat: siteLat, lng: siteLng }, false, baseMode === "lines" ? ["roads", "buildings", "areas"] : ["roads"]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteValid, siteLat, siteLng, loadSite]);

  // Switching to the road lines mode needs buildings and colonies, which the topo map does not download
  useEffect(() => {
    if (!siteValid || baseMode !== "lines" || fullDataLoadedRef.current || !loadedSiteRef.current) return;
    fullDataLoadedRef.current = true;
    (async () => {
      setMapStatus({ busy: true, message: "LOADING BUILDINGS…" });
      const outcome = await loadAround(
        { lat: siteLat, lng: siteLng },
        features,
        (merged, message) => {
          setFeatures(merged);
          setMapStatus({ busy: true, message });
        },
        { parts: ["buildings", "areas"] }
      );
      setFeatures(outcome.features);
      setMapStatus({ busy: false, message: finishMessage(outcome) });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMode, siteValid]);

  const handleReloadData = () => {
    if (!siteValid) return;
    setFeatures(EMPTY_FEATURES);
    loadSite({ lat: siteLat, lng: siteLng }, true, baseMode === "lines" ? ["roads", "buildings", "areas"] : ["roads"]);
  };

  // Extra load around the current map centre (when the user pans away from the property)
  const handleLoadHere = async () => {
    const view = data?.route_view;
    if (!view) return;
    setMapStatus({ busy: true, message: "LOADING MAP DATA HERE…" });
    const outcome = await loadAround(
      { lat: view.lat, lng: view.lng },
      features,
      (merged, message) => {
        setFeatures(merged);
        setMapStatus({ busy: true, message });
      },
      {
        skipCache: true,
        parts: baseMode === "lines" ? ["roads", "buildings", "areas"] : ["roads"],
        roadRadiusM: EXTRA_LOAD_ROAD_RADIUS_M,
        buildingRadiusM: EXTRA_LOAD_BUILDING_RADIUS_M,
      }
    );
    setFeatures(outcome.features);
    setMapStatus({ busy: false, message: finishMessage(outcome) });
  };

  // Main road search over the loaded road network
  const analysis = useMemo<MainRoadResult | null>(() => {
    if (!siteValid || features.roads.length === 0) return null;
    return analyzeMainRoad({ lat: siteLat, lng: siteLng }, features.roads, { forceWayId: data?.main_road_override });
  }, [siteValid, siteLat, siteLng, features.roads, data?.main_road_override]);

  // Colony (residential area) that contains the property
  const colony = useMemo(
    () => (siteValid ? findContainingArea({ lat: siteLat, lng: siteLng }, features.areas) : null),
    [siteValid, siteLat, siteLng, features.areas]
  );

  // Angle of the plot: detected from the nearest road and the road side of the plot, or typed in by hand
  const autoPlotAngle = useMemo(
    () => (siteValid ? plotRotationDeg({ lat: siteLat, lng: siteLng }, features.roads, data ? findRoadSide(data.boundaries) : null) : 0),
    [siteValid, siteLat, siteLng, features.roads, data?.boundaries] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const plotAngle = data?.plot_angle_override ?? autoPlotAngle;

  const mainWayIds = useMemo(() => new Set<number>(analysis?.wayIds ?? []), [analysis]);

  const mainRoadLabel = useMemo(
    () =>
      analysis
        ? { position: analysis.junction, text: (analysis.name ? `${analysis.name} (MAIN ROAD)` : "MAIN ROAD").toUpperCase() }
        : null,
    [analysis]
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

  const handleAddLandmark = useCallback((p: LatLng) => {
    const name = window.prompt("Landmark name (e.g. HOUSE OF RAM SWAROOP):");
    if (!name || !name.trim()) return;
    const landmark: Landmark = {
      id: newId(),
      name: name.trim().toUpperCase(),
      lat: p.lat,
      lng: p.lng,
      width_ft: DEFAULT_LANDMARK_WIDTH_FT,
      height_ft: DEFAULT_LANDMARK_HEIGHT_FT,
    };
    setData((prev) => (prev ? { ...prev, landmarks: [...(prev.landmarks || []), landmark] } : prev));
  }, []);

  // The user clicked a road to mark it as the main road
  const handlePickMainRoad = useCallback(
    (p: LatLng) => {
      const hit = nearestRoadWay(p, features.roads, PICK_ROAD_TOLERANCE_M);
      if (!hit) {
        alert("No road found near that click. Click closer to a road line.");
        return;
      }
      setData((prev) => (prev ? { ...prev, main_road_override: hit.way.id, route_source: "auto" } : prev));
      setPickMode(false);
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
      setMapStatus({ busy: false, message: "TOPO MAP UNAVAILABLE - USING ROAD LINES" });
    },
    [updateData]
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

  // Only one click mode is active at a time
  const toggleDrawMode = () => {
    setDrawMode((v) => !v);
    setLandmarkMode(false);
    setPickMode(false);
  };
  const toggleLandmarkMode = () => {
    setLandmarkMode((v) => !v);
    setDrawMode(false);
    setPickMode(false);
  };
  const togglePickMode = () => {
    setPickMode((v) => !v);
    setDrawMode(false);
    setLandmarkMode(false);
  };

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

  const handleBackToInput = () => {
    try {
      sessionStorage.setItem(RETURN_TO_FORM_FLAG, "1");
    } catch {}
    router.push("/route-map");
  };

  if (!data) {
    return <div className="p-8 text-center font-bold uppercase">LOADING ROUTE MAP...</div>;
  }

  if (!siteValid) {
    return (
      <div className="p-8 text-center font-bold uppercase">
        INVALID GEO COORDINATES.{" "}
        <button className="underline" onClick={handleBackToInput}>GO BACK TO INPUT</button>
      </div>
    );
  }

  const site: LatLng = { lat: siteLat, lng: siteLng };
  const routePoints = data.route_points || EMPTY_POINTS;
  const landmarkItems = data.landmarks || EMPTY_LANDMARKS;
  const routeMeters = Math.round(routeLengthMeters(routePoints));
  const sideDims = { ...EMPTY_DIMS, ...(data.side_dims || {}) };
  const plotSize = getPlotSizeFt(sideDims, data.plot_area);
  const summary = data.main_road_summary;

  const topo: TopoData = {
    features,
    mainWayIds,
    colonyId: colony?.id ?? null,
    mainRoadLabel,
    picking: pickMode,
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
        onLoadHere={handleLoadHere}
        plotAngle={plotAngle}
        angleIsAuto={data.plot_angle_override === undefined}
        onAngleChange={(value) => updateData({ plot_angle_override: value })}
        mainRoadText={summary ? mainRoadText(summary) : null}
        pickMode={pickMode}
        onTogglePick={togglePickMode}
        onAutoRoute={handleAutoRoute}
        drawMode={drawMode}
        onToggleDraw={toggleDrawMode}
        routePointCount={routePoints.length}
        routeMeters={routeMeters}
        routeSource={data.route_source}
        onUndoPoint={handleUndoPoint}
        onClearRoute={handleClearRoute}
        landmarkMode={landmarkMode}
        onToggleLandmark={toggleLandmarkMode}
        landmarks={landmarkItems}
        onUpdateLandmark={updateLandmark}
        onRemoveLandmark={removeLandmark}
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
              {/* Satellite view */}
              <div style={{ height: "38%", position: "relative", borderBottom: "0.3mm solid #000" }}>
                <LeafletMap
                  site={site}
                  tile="satellite"
                  defaultZoom={17}
                  initialView={data.satellite_view}
                  markerKind="pin"
                  onViewChange={handleSatelliteViewChange}
                />
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
                  plot={{ widthFt: plotSize.widthFt, heightFt: plotSize.heightFt, label: "PROPOSED SITE", boundaries: data.boundaries, angleDeg: plotAngle }}
                  landmarks={{ items: landmarkItems, adding: landmarkMode, onAdd: handleAddLandmark }}
                  topo={topo}
                  statusChip={mapStatus.message}
                  onTopoFailed={handleTopoFailed}
                  onViewChange={handleRouteViewChange}
                  route={{ points: routePoints, drawing: drawMode, onAddPoint: handleAddRoutePoint }}
                />

                {/* Coordinates and main road */}
                <div style={{ position: "absolute", top: "2mm", left: "3mm", zIndex: 1200, pointerEvents: "none", maxWidth: "44%" }}>
                  <div style={{ background: "rgba(255,255,255,0.9)", padding: "0.5mm 2mm", fontWeight: 700, fontSize: "13pt", color: CYAN, display: "inline-block" }}>
                    LAT &amp; LONG : {formatCoordinate(data.latitude)}, {formatCoordinate(data.longitude)}
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
