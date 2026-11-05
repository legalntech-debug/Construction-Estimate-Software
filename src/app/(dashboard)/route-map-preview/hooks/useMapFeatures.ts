"use client";
// Loads the OpenStreetMap data around the property (roads for the main road search, plus buildings and colonies for the
// road lines mode) and keeps the status text for the toolbar and the map.
import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_FEATURES, loadAround } from "../engine/routeMapGeo";
import type { LatLng, LoadOptions, LoadOutcome, LoadPart, MapFeatures } from "../engine/routeMapGeo";
import type { BaseMode, MapViewState } from "../engine/types";
import { EXTRA_LOAD_BUILDING_RADIUS_M, EXTRA_LOAD_ROAD_RADIUS_M } from "../engine/constants";

// Which data a base map needs: the topo map only needs the roads (for the main road search); the road lines mode
// draws roads, buildings and colonies itself.
const partsFor = (mode: BaseMode): LoadPart[] => (mode === "lines" ? ["roads", "buildings", "areas"] : ["roads"]);

// Message for the toolbar and the map after a load finished
const finishMessage = (outcome: LoadOutcome, mode: BaseMode) => {
  if (!outcome.ok) {
    return mode === "lines"
      ? `MAP DATA UNAVAILABLE (${outcome.error || "NO RESPONSE"}) - RELOAD OR USE STREET MAP`
      : `MAIN ROAD SEARCH UNAVAILABLE (${outcome.error || "NO RESPONSE"}) - RELOAD, OR DRAW THE ROUTE BY HAND`;
  }
  if (outcome.features.roads.length === 0) {
    return mode === "lines" ? "NO ROAD DATA HERE - USE STREET MAP OR DRAW THE ROUTE" : "NO ROAD DATA FOR THE MAIN ROAD SEARCH - DRAW THE ROUTE BY HAND";
  }
  return outcome.warning || "";
};

export interface MapStatus {
  busy: boolean;
  message: string;
}

// site: the coordinate entered on the form (null while it is not valid); data is loaded around it once
export function useMapFeatures(site: LatLng | null, baseMode: BaseMode) {
  const [features, setFeatures] = useState<MapFeatures>(EMPTY_FEATURES);
  const [status, setStatus] = useState<MapStatus>({ busy: false, message: "" });
  const loadedSiteRef = useRef("");
  // True once buildings and colonies were downloaded as well (needed by the road lines mode only)
  const fullDataLoadedRef = useRef(false);

  // Runs a data load. Roads are drawn as soon as they arrive; the message follows the progress.
  const runLoad = useCallback(
    async (center: LatLng, existing: MapFeatures, options: LoadOptions) => {
      setStatus({ busy: true, message: "LOADING…" });
      const outcome = await loadAround(
        center,
        existing,
        (merged, message) => {
          setFeatures(merged);
          setStatus({ busy: true, message });
        },
        options
      );
      setFeatures(outcome.features);
      setStatus({ busy: false, message: finishMessage(outcome, baseMode) });
      return outcome;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseMode]
  );

  // Initial load around the property
  const loadSite = useCallback(
    async (s: LatLng, skipCache: boolean) => {
      const parts = partsFor(baseMode);
      const outcome = await runLoad(s, EMPTY_FEATURES, { findMainRoad: true, skipCache, parts });
      fullDataLoadedRef.current = parts.includes("buildings") && outcome.ok;
    },
    [baseMode, runLoad]
  );

  const siteLat = site?.lat;
  const siteLng = site?.lng;

  useEffect(() => {
    if (siteLat === undefined || siteLng === undefined) return;
    const key = `${siteLat},${siteLng}`;
    if (loadedSiteRef.current === key) return;
    loadedSiteRef.current = key;
    loadSite({ lat: siteLat, lng: siteLng }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteLat, siteLng]);

  // Switching to the road lines mode needs buildings and colonies, which the topo map does not download
  useEffect(() => {
    if (siteLat === undefined || siteLng === undefined) return;
    if (baseMode !== "lines" || fullDataLoadedRef.current || !loadedSiteRef.current) return;
    fullDataLoadedRef.current = true;
    runLoad({ lat: siteLat, lng: siteLng }, features, { parts: ["buildings", "areas"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMode]);

  const reload = useCallback(() => {
    if (siteLat === undefined || siteLng === undefined) return;
    setFeatures(EMPTY_FEATURES);
    loadSite({ lat: siteLat, lng: siteLng }, true);
  }, [siteLat, siteLng, loadSite]);

  // Extra load around the current map centre (when the user pans away from the property)
  const loadHere = useCallback(
    (view: MapViewState | undefined) => {
      if (!view) return;
      runLoad({ lat: view.lat, lng: view.lng }, features, {
        skipCache: true,
        parts: partsFor(baseMode),
        roadRadiusM: EXTRA_LOAD_ROAD_RADIUS_M,
        buildingRadiusM: EXTRA_LOAD_BUILDING_RADIUS_M,
      });
    },
    [baseMode, features, runLoad]
  );

  const setMessage = useCallback((message: string) => setStatus({ busy: false, message }), []);

  return { features, status, setMessage, reload, loadHere };
}
