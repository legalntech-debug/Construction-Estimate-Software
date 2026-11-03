"use client";
// Leaflet map used twice on the sheet: the satellite view (top) and the topo / route view (bottom).
//
// Route view base layers (BaseMode):
//   topo   vector topo map (roads with names, places, POIs, house footprints) drawn by MapLibre GL inside Leaflet
//   lines  road lines, buildings and colonies drawn from OpenStreetMap (Overpass) data
//   tiles  raster OpenStreetMap street map
// The plot box, landmarks, main road highlight and route are Leaflet overlays on top of every base layer.
import { useEffect, useRef, useState } from "react";
import { bearingDeg, ringCentroid, routeLengthMeters } from "../engine/routeMapGeo";
import type { LatLng, MapFeatures } from "../engine/routeMapGeo";
import type { BaseMode, Boundaries, Landmark, MapViewState } from "../engine/types";
import {
  BUILDING_FILL, FEET_TO_METERS, GREEN_HATCH_ID, LABEL_YELLOW, OSM_ATTRIBUTION,
  ROUTE_COLOR, SATELLITE_TILES, STREET_TILES,
} from "../engine/constants";
import {
  TEXT_HALO_BLACK, TEXT_HALO_WHITE, addHtmlMarker, ensureHatchPattern, loadLeaflet, mapLabelHtml, offsetLatLng,
  rectAround, rotateOffset, roadWeight, routeMidPoint, toLL,
} from "../engine/leafletSupport";
import { escapeHtml, measureText, wrapByWidth } from "../engine/helpers";
import { createTopoLayer } from "../engine/topoStyle";

// Boundary labels around the plot box are shown from this zoom level on
const BOUNDARY_LABEL_MIN_ZOOM = 16;
const BOUNDARY_LABEL_FONT = 8;
const BOUNDARY_LABEL_MAX_WIDTH = 92;
const BOUNDARY_LABEL_LINE_HEIGHT = 9.5;
// The red dot that marks the site is shown up to this zoom level (the box itself is too small to see)
const SITE_DOT_MAX_ZOOM = 16;

export interface TopoData {
  features: MapFeatures;
  // Ways that make up the detected main road (drawn heavier)
  mainWayIds: Set<number>;
  // Residential area (colony) that contains the property
  colonyId: number | null;
  mainRoadLabel: { position: LatLng; text: string } | null;
  picking: boolean;
  onPick: (p: LatLng) => void;
}

interface LeafletMapProps {
  site: LatLng;
  tile: "satellite" | "street";
  base?: BaseMode;
  defaultZoom: number;
  initialView?: MapViewState | null;
  markerKind: "pin" | "none";
  // Real-size plot box (street map only). angleDeg turns the box clockwise to follow the street.
  // boundaries: the four boundary texts, printed around the box.
  plot?: { widthFt: number; heightFt: number; label: string; boundaries?: Boundaries; angleDeg: number };
  landmarks?: { items: Landmark[]; adding: boolean; onAdd: (p: LatLng) => void };
  topo?: TopoData;
  // Message shown on the map while data loads or when it is unavailable (screen only)
  statusChip?: string;
  // Called when the vector topo map cannot be created (libraries or style could not be loaded)
  onTopoFailed?: (reason: string) => void;
  onViewChange?: (view: MapViewState) => void;
  route?: {
    points: LatLng[];
    drawing: boolean;
    onAddPoint: (p: LatLng) => void;
  };
}

type Rect = { x: number; y: number; w: number; h: number };
const rectsOverlap = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 1 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 1;

export default function LeafletMap({
  site, tile, base = "topo", defaultZoom, initialView, markerKind, plot, landmarks, topo, statusChip, onTopoFailed, onViewChange, route,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const shapesLayerRef = useRef<any>(null);
  const overlayLayerRef = useRef<any>(null);
  const streetTileRef = useRef<any>(null);
  const glLayerRef = useRef<any>(null);
  const glRequestRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [glStatus, setGlStatus] = useState<"idle" | "loading" | "ready">("idle");

  // Latest callbacks / flags are read through refs so the map is created only once
  const onViewChangeRef = useRef(onViewChange);
  const onTopoFailedRef = useRef(onTopoFailed);
  const routeRef = useRef(route);
  const landmarksRef = useRef(landmarks);
  const topoRef = useRef(topo);
  onViewChangeRef.current = onViewChange;
  onTopoFailedRef.current = onTopoFailed;
  routeRef.current = route;
  landmarksRef.current = landmarks;
  topoRef.current = topo;

  // Map creation
  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const startView = initialView || { lat: site.lat, lng: site.lng, zoom: defaultZoom };
        const map = L.map(containerRef.current, {
          center: [startView.lat, startView.lng],
          zoom: startView.zoom,
          maxZoom: 19,
          zoomControl: false,
          attributionControl: true,
        });
        L.control.zoom({ position: "bottomright" }).addTo(map);
        map.attributionControl.setPrefix(false);

        // Stacking order: areas < buildings < roads < plot / landmark boxes < route line (default overlay pane)
        map.createPane("rmAreas").style.zIndex = "330";
        map.createPane("rmBuildings").style.zIndex = "340";
        map.createPane("rmRoads").style.zIndex = "350";
        map.createPane("rmShapes").style.zIndex = "390";

        if (tile === "satellite") {
          L.tileLayer(SATELLITE_TILES, { maxZoom: 19, attribution: "Tiles © Esri" }).addTo(map);
        } else {
          map.attributionControl.addAttribution(OSM_ATTRIBUTION);
          overlayLayerRef.current = L.layerGroup();
        }

        if (markerKind === "pin") {
          const pinHtml = `<svg width="26" height="36" viewBox="0 0 26 36" style="display:block;transform:translate(-13px,-34px)"><path d="M13 1C6.4 1 1 6.2 1 12.7 1 21.5 13 35 13 35s12-13.5 12-22.3C25 6.2 19.6 1 13 1z" fill="#e11d1d" stroke="#7f1d1d" stroke-width="1.5"/><circle cx="13" cy="12.5" r="4.5" fill="#fff"/></svg>`;
          addHtmlMarker(L, map, site, pinHtml);
        }

        shapesLayerRef.current = L.layerGroup().addTo(map);
        routeLayerRef.current = L.layerGroup().addTo(map);

        map.on("moveend", () => {
          const c = map.getCenter();
          onViewChangeRef.current?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
        });
        map.on("click", (e: any) => {
          const p = { lat: e.latlng.lat, lng: e.latlng.lng };
          const r = routeRef.current;
          if (r?.drawing) r.onAddPoint(p);
          const lm = landmarksRef.current;
          if (lm?.adding) lm.onAdd(p);
          const tp = topoRef.current;
          if (tp?.picking) tp.onPick(p);
        });

        // With a saved route but no saved view, frame the whole route together with the site
        const pts = routeRef.current?.points || [];
        if (!initialView && pts.length > 0) {
          map.fitBounds(L.latLngBounds([[site.lat, site.lng], ...pts.map((p) => [p.lat, p.lng])]), { padding: [30, 30] });
        }

        mapRef.current = map;
        setReady(true);
      })
      .catch((err) => console.error("Map initialisation failed:", err));

    return () => {
      cancelled = true;
      glRequestRef.current += 1;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      routeLayerRef.current = null;
      shapesLayerRef.current = null;
      overlayLayerRef.current = null;
      streetTileRef.current = null;
      glLayerRef.current = null;
      setReady(false);
    };
    // The map is intentionally created once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Street map base layer: vector topo map, road lines or raster tiles
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const overlay = overlayLayerRef.current;
    if (!ready || !L || !map || !overlay || tile !== "street") return;

    // Raster street tiles
    if (base === "tiles") {
      if (!streetTileRef.current) {
        streetTileRef.current = L.tileLayer(STREET_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION });
      }
      streetTileRef.current.addTo(map);
      map.removeLayer(overlay);
    } else {
      if (streetTileRef.current) map.removeLayer(streetTileRef.current);
      overlay.addTo(map);
    }

    // Vector topo map (MapLibre GL inside Leaflet)
    if (base !== "topo") {
      glRequestRef.current += 1; // cancels a creation that is still running
      if (glLayerRef.current) map.removeLayer(glLayerRef.current);
      setGlStatus("idle");
      return;
    }

    if (glLayerRef.current) {
      glLayerRef.current.addTo(map);
      return;
    }
    const request = ++glRequestRef.current;
    setGlStatus("loading");
    createTopoLayer(L)
      .then((layer) => {
        if (request !== glRequestRef.current || !mapRef.current) return;
        glLayerRef.current = layer;
        layer.addTo(mapRef.current);
        const gl = layer.getMaplibreMap?.();
        if (gl) {
          gl.once("idle", () => setGlStatus("ready"));
          gl.on("error", (e: any) => console.warn("Topo map warning:", e?.error?.message || e));
        } else {
          setGlStatus("ready");
        }
      })
      .catch((err) => {
        if (request !== glRequestRef.current) return;
        console.error("Topo map could not be created:", err);
        setGlStatus("idle");
        onTopoFailedRef.current?.(String(err?.message || err));
      });
  }, [ready, base, tile]);

  // Overlay data: in "lines" mode all roads, houses and colonies; in "topo" mode only the highlighted main road
  useEffect(() => {
    const L = window.L;
    const layer = overlayLayerRef.current;
    if (!ready || !L || !layer) return;

    layer.clearLayers();
    if (!topo || base === "tiles") return;
    const { features, mainWayIds, colonyId, mainRoadLabel } = topo;
    const linesMode = base === "lines";

    if (linesMode) {
      // Residential areas; the one that contains the property gets the strong outline and its name
      features.areas.forEach((a) => {
        const isColony = a.id === colonyId;
        L.polygon(a.ring.map(toLL), {
          color: isColony ? "#000" : "#666",
          weight: isColony ? 2.5 : 1,
          dashArray: isColony ? "10 5" : "3 4",
          fill: false,
          interactive: false,
          pane: "rmAreas",
        }).addTo(layer);
      });
      const colony = features.areas.find((a) => a.id === colonyId);
      if (colony?.name) {
        const c = ringCentroid(colony.ring);
        const html = mapLabelHtml(colony.name.toUpperCase(), {
          shift: "translate(-50%,-50%)",
          font: "800 11px/1.2 Arial,sans-serif",
          halo: TEXT_HALO_WHITE,
          extraStyle: "letter-spacing:1px",
        });
        addHtmlMarker(L, layer, c, html);
      }

      // Built houses
      features.buildings.forEach((b) => {
        L.polygon(b.ring.map(toLL), {
          color: "#2b2b2b",
          weight: 0.7,
          fillColor: BUILDING_FILL,
          fillOpacity: 1,
          interactive: false,
          pane: "rmBuildings",
        }).addTo(layer);
      });
    }

    // Roads: in lines mode every road (main road on top); in topo mode only the main road, as a highlight over the map
    const drawRoad = (r: (typeof features.roads)[number], main: boolean) => {
      const w = roadWeight(r.highway);
      const pts = r.geometry.map(toLL);
      if (linesMode && !main) {
        L.polyline(pts, { color: "#000", weight: w, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false, pane: "rmRoads" }).addTo(layer);
        return;
      }
      // Highlighted road: black casing with an orange core
      L.polyline(pts, { color: "#000", weight: w + 6, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false, pane: "rmRoads" }).addTo(layer);
      L.polyline(pts, { color: "#ee6b3b", weight: w + 3, opacity: 1, lineCap: "round", lineJoin: "round", interactive: false, pane: "rmRoads" }).addTo(layer);
    };
    if (linesMode) features.roads.forEach((r) => !mainWayIds.has(r.id) && drawRoad(r, false));
    features.roads.forEach((r) => mainWayIds.has(r.id) && drawRoad(r, true));

    if (mainRoadLabel) {
      const html = mapLabelHtml(mainRoadLabel.text, { shift: "translate(-50%,-140%)", font: "800 10px/1.2 Arial,sans-serif", halo: TEXT_HALO_WHITE });
      addHtmlMarker(L, layer, mainRoadLabel.position, html);
    }
  }, [ready, base, topo?.features, topo?.mainWayIds, topo?.colonyId, topo?.mainRoadLabel]);

  // Plot box, landmark boxes and the boundary texts around the plot. All boxes are geographic polygons, so they scale
  // with the map exactly like the real ground, and they are turned to follow the street.
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const layer = shapesLayerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();

    const angle = plot?.angleDeg ?? 0;

    // "above": name sits over the top edge (landmarks); "center": name sits inside the box (proposed site)
    const addBox = (center: LatLng, widthFt: number, heightFt: number, label: string, outline: string, labelAt: "above" | "center") => {
      const poly = L.polygon(rectAround(center, widthFt, heightFt, angle), {
        color: outline,
        weight: 1.6,
        fillOpacity: 1,
        interactive: false,
        pane: "rmShapes",
      }).addTo(layer);

      const el: SVGElement | undefined = poly.getElement();
      if (el) {
        ensureHatchPattern(el.ownerSVGElement);
        el.setAttribute("fill", `url(#${GREEN_HATCH_ID})`);
      }

      // Name: yellow text with a dark outline (stays readable on white and on satellite)
      let anchor: LatLng = center;
      if (labelAt === "above") {
        const [e, n] = rotateOffset(0, (heightFt * FEET_TO_METERS) / 2, angle);
        anchor = offsetLatLng(center, e, n);
      }
      const labelHtml = mapLabelHtml(label, {
        shift: labelAt === "above" ? "translate(-50%,-110%)" : "translate(-50%,-50%)",
        font: "800 10px/1.2 Arial,sans-serif",
        color: LABEL_YELLOW,
        halo: TEXT_HALO_BLACK,
      });
      addHtmlMarker(L, layer, anchor, labelHtml);
    };

    if (plot) addBox(site, plot.widthFt, plot.heightFt, plot.label, "#e11d1d", "center");
    (landmarks?.items || []).forEach((lm) =>
      addBox({ lat: lm.lat, lng: lm.lng }, Math.max(lm.width_ft, 1), Math.max(lm.height_ft, 1), lm.name, "#000", "above")
    );

    if (!plot) return;

    // Boundary texts: every text sits outside "its" edge of the (turned) plot box. Texts wrap inside a narrow column and
    // are pushed outwards until no text touches another text or the plot name, so nothing overlaps at any zoom level.
    const boundaryGroup = L.layerGroup().addTo(layer);
    const buildBoundaryLabels = () => {
      boundaryGroup.clearLayers();
      const boundaries = plot.boundaries;
      const zoom = map.getZoom();
      if (!boundaries || zoom < BOUNDARY_LABEL_MIN_ZOOM) return;

      const metersPerPixel = (156543.03392 * Math.cos((site.lat * Math.PI) / 180)) / Math.pow(2, zoom);
      const feetToPx = FEET_TO_METERS / metersPerPixel;
      const halfW = (plot.widthFt * feetToPx) / 2;
      const halfH = (plot.heightFt * feetToPx) / 2;
      const rot = (plot.angleDeg * Math.PI) / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);

      // Outward normals of the four edges on screen (x right, y down) after the clockwise turn
      const sides = ([
        { key: "north" as const, nx: 0, ny: -1, half: halfH },
        { key: "south" as const, nx: 0, ny: 1, half: halfH },
        { key: "east" as const, nx: 1, ny: 0, half: halfW },
        { key: "west" as const, nx: -1, ny: 0, half: halfW },
      ]).map((s) => ({ ...s, ux: s.nx * cos - s.ny * sin, uy: s.nx * sin + s.ny * cos }));

      // The plot name in the middle of the box is an obstacle too
      const placed: Rect[] = [{ x: 0, y: 0, w: measureText(plot.label, 10) + 6, h: 13 }];

      sides.forEach((s) => {
        const text = (boundaries[s.key] || "").trim();
        if (!text) return;
        const lines = wrapByWidth(text, BOUNDARY_LABEL_MAX_WIDTH, BOUNDARY_LABEL_FONT, 4);
        const w = Math.max(...lines.map((l) => measureText(l, BOUNDARY_LABEL_FONT))) + 4;
        const h = lines.length * BOUNDARY_LABEL_LINE_HEIGHT + 3;
        const reach = Math.abs(s.ux) * (w / 2) + Math.abs(s.uy) * (h / 2);

        let dist = 3;
        let rect: Rect = { x: 0, y: 0, w, h };
        for (let i = 0; i < 80; i++) {
          rect = { x: s.ux * (s.half + dist + reach), y: s.uy * (s.half + dist + reach), w, h };
          if (!placed.some((p) => rectsOverlap(rect, p))) break;
          dist += 3;
        }
        placed.push(rect);

        const html =
          `<div style="position:absolute;left:0;top:0;transform:translate(${(rect.x - w / 2).toFixed(1)}px,${(rect.y - h / 2).toFixed(1)}px);` +
          `width:${Math.ceil(w)}px;text-align:center;white-space:nowrap;font:700 ${BOUNDARY_LABEL_FONT}px/${BOUNDARY_LABEL_LINE_HEIGHT}px Arial,sans-serif;` +
          `color:#000;${TEXT_HALO_WHITE}">${lines.map(escapeHtml).join("<br>")}</div>`;
        addHtmlMarker(L, boundaryGroup, site, html);
      });
    };

    // When zoomed far out the plot box is only a few pixels wide, so a red dot marks the site
    const dot = L.circleMarker([site.lat, site.lng], {
      radius: 4,
      color: "#7f1d1d",
      weight: 1,
      fillColor: "#e11d1d",
      fillOpacity: 1,
      interactive: false,
    });
    const syncZoomItems = () => {
      if (map.getZoom() <= SITE_DOT_MAX_ZOOM) {
        if (!layer.hasLayer(dot)) layer.addLayer(dot);
      } else {
        layer.removeLayer(dot);
      }
      buildBoundaryLabels();
    };
    syncZoomItems();
    map.on("zoomend", syncZoomItems);
    return () => {
      map.off("zoomend", syncZoomItems);
    };
  }, [ready, site.lat, site.lng, plot?.widthFt, plot?.heightFt, plot?.label, plot?.boundaries, plot?.angleDeg, landmarks?.items]);

  // Route polyline, end arrow and distance label
  useEffect(() => {
    const L = window.L;
    const layer = routeLayerRef.current;
    if (!ready || !L || !layer) return;

    layer.clearLayers();
    const pts = route?.points || [];
    if (pts.length === 0) return;

    L.polyline(pts.map(toLL), { color: ROUTE_COLOR, weight: 3, opacity: 1 }).addTo(layer);

    // Vertex handles are shown only while drawing, so the printed sheet stays clean
    if (route?.drawing) {
      pts.forEach((p, i) =>
        L.circleMarker([p.lat, p.lng], {
          radius: i === 0 ? 5 : 4,
          color: ROUTE_COLOR,
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 2,
        }).addTo(layer)
      );
    }

    if (pts.length >= 2) {
      const last = pts[pts.length - 1];
      const bearing = bearingDeg(pts[pts.length - 2], last);
      const arrowHtml = `<div style="transform:rotate(${bearing}deg);width:0;height:0"><svg width="18" height="18" viewBox="0 0 18 18" style="display:block;transform:translate(-9px,-9px)"><path d="M9 1 L16 16 L9 12 L2 16 Z" fill="${ROUTE_COLOR}"/></svg></div>`;
      addHtmlMarker(L, layer, last, arrowHtml);

      const meters = Math.round(routeLengthMeters(pts));
      const mid = routeMidPoint(pts);
      const labelHtml = mapLabelHtml(`APPROX. ${meters} METER`, {
        shift: "translate(-50%,-125%)",
        font: "700 9px/1.3 Arial,sans-serif",
        extraStyle: "background:rgba(255,255,255,0.85);padding:0 3px",
      });
      addHtmlMarker(L, layer, mid, labelHtml);
    }
  }, [ready, route?.points, route?.drawing]);

  // Cursor feedback while drawing / adding landmarks / picking the main road
  const picking = !!route?.drawing || !!landmarks?.adding || !!topo?.picking;
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.getContainer().style.cursor = picking ? "crosshair" : "";
  }, [ready, picking]);

  // Make sure tiles fill the container right before printing
  useEffect(() => {
    const handler = () => {
      mapRef.current?.invalidateSize();
      glLayerRef.current?.getMaplibreMap?.()?.resize?.();
    };
    window.addEventListener("beforeprint", handler);
    return () => window.removeEventListener("beforeprint", handler);
  }, []);

  const chipText = glStatus === "loading" ? "LOADING TOPO MAP…" : statusChip;

  return (
    <>
      <div
        ref={containerRef}
        className={tile === "street" && base === "tiles" ? "rm-street-gray" : undefined}
        style={{ position: "absolute", inset: 0, zIndex: 0, background: tile === "street" ? "#fff" : "#e5e7eb" }}
      />
      {chipText && tile === "street" && base !== "tiles" && (
        <div
          className="no-print"
          style={{ position: "absolute", left: "50%", bottom: 6, transform: "translateX(-50%)", zIndex: 1300, background: "#fff", border: "1px solid #000", padding: "1px 8px", fontSize: 11, fontWeight: 700, pointerEvents: "none" }}
        >
          {chipText}
        </div>
      )}
    </>
  );
}
