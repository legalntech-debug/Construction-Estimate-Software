"use client";
// Leaflet map used twice on the sheet: the satellite view (top) and the topo / route view (bottom).
//
// Route view base layers (BaseMode):
//   topo   vector topo map (roads with names, places, POIs, house footprints) drawn by MapLibre GL inside Leaflet
//   lines  road lines, buildings and colonies drawn from OpenStreetMap (Overpass) data
//   tiles  raster OpenStreetMap street map
// The plot outline, landmarks, main road highlight and route are Leaflet overlays on top of every base layer.
// The plot outline can be moved, reshaped and drawn by hand (edit / draw mode); names and boundary texts follow it.
import { useEffect, useRef, useState } from "react";
import { bearingDeg, haversineMeters, pointInRing, ringCentroid, routeLengthMeters } from "../engine/routeMapGeo";
import type { LatLng, MapFeatures } from "../engine/routeMapGeo";
import type { BaseMode, Boundaries, MapViewState } from "../engine/types";
import {
  BUILDING_FILL, GREEN_HATCH_ID, LABEL_YELLOW, OSM_ATTRIBUTION, PLOT_LABEL_SHORT, ROUTE_COLOR, SATELLITE_TILES, STREET_TILES,
} from "../engine/constants";
import {
  TEXT_HALO_BLACK, TEXT_HALO_WHITE, addHtmlMarker, ensureHatchPattern, loadLeaflet, mapLabelHtml, roadWeight,
  routeMidPoint, toLL,
} from "../engine/leafletSupport";
import { escapeHtml, measureText, wrapByWidth } from "../engine/helpers";
import { createTopoLayer } from "../engine/topoStyle";
import { ringCenter, simplifyRing } from "../engine/plotShape";
import { edgeFacing, fitLabelInRing, pxCentroid, placeBoundaryLabels } from "../engine/labelLayout";
import type { LabelRect, PxPoint } from "../engine/labelLayout";

// Boundary labels around the plot are shown from this zoom level on
const BOUNDARY_LABEL_MIN_ZOOM = 16;
const BOUNDARY_LABEL_FONT = 8;
const BOUNDARY_LABEL_MAX_WIDTH = 92;
const BOUNDARY_LABEL_LINE_HEIGHT = 9.5;
// The red dot that marks the site is shown up to this zoom level (the outline itself is too small to see)
const SITE_DOT_MAX_ZOOM = 16;
// Names inside the plot / landmark outlines grow with the zoom up to this size and disappear below the minimum
const NAME_MAX_FONT = 28;
const NAME_MIN_FONT = 5;
// Distance (pixels) within which a click on the first point closes the polygon that is being drawn
const CLOSE_POLYGON_PX = 14;
// Footprints found within this distance (pixels) of the site are offered when the site is not exactly on a building
const FOOTPRINT_SEARCH_PX = 8;

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

export interface LandmarkShape {
  id: string;
  name: string;
  ring: LatLng[];
}

// Functions the page can call on the route map
export interface MapApi {
  // Outline of the building (house footprint of the topo map) under a point, or null when there is none
  footprintAt: (p: LatLng) => LatLng[] | null;
}

interface LeafletMapProps {
  site: LatLng;
  tile: "satellite" | "street";
  base?: BaseMode;
  defaultZoom: number;
  initialView?: MapViewState | null;
  markerKind: "pin" | "none";
  // Plot outline (street map only) with its name and the four boundary texts
  plot?: {
    ring: LatLng[];
    label: string;
    boundaries?: Boundaries;
    // Handles to move the plot, drag its corners, add / delete corners
    edit?: { active: boolean; onChange: (ring: LatLng[]) => void };
    // Click corner by corner to draw the outline by hand; a click on the first point closes it
    draw?: { active: boolean; draft: LatLng[]; onAddPoint: (p: LatLng) => void; onFinish: () => void };
  };
  landmarks?: { items: LandmarkShape[]; adding: boolean; onAdd: (p: LatLng) => void };
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
  apiRef?: { current: MapApi | null };
}

// Square / circular handles of the plot editor (screen only: "no-print" hides them when printing)
const handleHtml = (kind: "vertex" | "mid" | "move") => {
  if (kind === "vertex") {
    return `<div style="width:16px;height:16px;margin:-8px 0 0 -8px;background:#fff;border:2px solid #1d4ed8;box-sizing:border-box;cursor:move"></div>`;
  }
  if (kind === "mid") {
    return `<div style="width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:rgba(29,78,216,0.35);border:1.5px solid #1d4ed8;box-sizing:border-box;cursor:copy" title="Add a corner"></div>`;
  }
  return `<div style="width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#1d4ed8;color:#fff;font:700 18px/30px Arial,sans-serif;text-align:center;cursor:move;box-shadow:0 0 0 2px #fff" title="Drag to move the plot">✥</div>`;
};

const geoJsonRing = (coords: number[][]): LatLng[] => coords.map(([lng, lat]) => ({ lat, lng }));

export default function LeafletMap({
  site, tile, base = "topo", defaultZoom, initialView, markerKind, plot, landmarks, topo, statusChip, onTopoFailed,
  onViewChange, route, apiRef,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pinRef = useRef<any>(null);
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
  const plotRef = useRef(plot);
  onViewChangeRef.current = onViewChange;
  onTopoFailedRef.current = onTopoFailed;
  routeRef.current = route;
  landmarksRef.current = landmarks;
  topoRef.current = topo;
  plotRef.current = plot;

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
          // A double click on a corner of the plot deletes it; it must not zoom the map
          doubleClickZoom: false,
        });
        L.control.zoom({ position: "bottomright" }).addTo(map);
        map.attributionControl.setPrefix(false);

        // Stacking order: areas < buildings < roads < plot / landmark outlines < route line (default overlay pane)
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
          pinRef.current = addHtmlMarker(L, map, site, pinHtml);
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

          // Drawing the plot outline: a click on the first point closes the polygon
          const draw = plotRef.current?.draw;
          if (draw?.active) {
            const first = draw.draft[0];
            if (first && draw.draft.length >= 3) {
              const a = map.latLngToContainerPoint([first.lat, first.lng]);
              const b = map.latLngToContainerPoint(e.latlng);
              if (Math.hypot(a.x - b.x, a.y - b.y) <= CLOSE_POLYGON_PX) {
                draw.onFinish();
                return;
              }
            }
            draw.onAddPoint(p);
          }
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
      pinRef.current = null;
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

  // The site pin follows the property when its position is adjusted
  useEffect(() => {
    pinRef.current?.setLatLng([site.lat, site.lng]);
  }, [ready, site.lat, site.lng]);

  // Functions for the page: the building outline under a point (from the rendered house footprints)
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      footprintAt: (p: LatLng) => {
        const gl = glLayerRef.current?.getMaplibreMap?.();
        if (!gl) return null;
        const layers = ["buildings-ml", "buildings-osm"].filter((id) => gl.getLayer(id));
        if (layers.length === 0) return null;

        const pt = gl.project([p.lng, p.lat]);
        let features = gl.queryRenderedFeatures([pt.x, pt.y], { layers });
        if (features.length === 0) {
          const r = FOOTPRINT_SEARCH_PX;
          features = gl.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers });
        }

        const rings: LatLng[][] = [];
        features.forEach((f: any) => {
          const g = f.geometry;
          if (g?.type === "Polygon") rings.push(geoJsonRing(g.coordinates[0]));
          else if (g?.type === "MultiPolygon") g.coordinates.forEach((poly: number[][][]) => rings.push(geoJsonRing(poly[0])));
        });
        if (rings.length === 0) return null;

        // The outline that contains the point, otherwise the nearest one
        const inside = rings.find((r) => pointInRing(p, r));
        const best =
          inside ||
          rings.reduce((a, b) => (haversineMeters(p, ringCenter(a)) <= haversineMeters(p, ringCenter(b)) ? a : b));
        return simplifyRing(best, 0.3);
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

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
        const html = mapLabelHtml(colony.name.toUpperCase(), {
          shift: "translate(-50%,-50%)",
          font: "800 11px/1.2 Arial,sans-serif",
          halo: TEXT_HALO_WHITE,
          extraStyle: "letter-spacing:1px",
        });
        addHtmlMarker(L, layer, ringCentroid(colony.ring), html);
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

  // Plot and landmark outlines, their names, the boundary texts around the plot and the plot editor handles.
  // Outlines are geographic polygons, so they scale with the map exactly like the real ground.
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const layer = shapesLayerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();

    const plotRing = plot && plot.ring.length >= 3 ? plot.ring : null;
    // labels: names to try, longest first (the first one that fits into the outline at the current zoom is shown)
    const items: { ring: LatLng[]; labels: string[]; outline: string; isPlot: boolean }[] = [];
    if (plotRing && plot) items.push({ ring: plotRing, labels: [plot.label, PLOT_LABEL_SHORT], outline: "#e11d1d", isPlot: true });
    (landmarks?.items || []).forEach((lm) => lm.ring.length >= 3 && items.push({ ring: lm.ring, labels: [lm.name], outline: "#000", isPlot: false }));

    // Outlines with green hatching
    const polygons: any[] = items.map((it) => {
      const poly = L.polygon(it.ring.map(toLL), {
        color: it.outline,
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
      return poly;
    });

    // Polygon that is being drawn by hand
    const draft = plot?.draw?.active ? plot.draw.draft : [];
    if (draft.length > 0) {
      if (draft.length >= 2) L.polyline(draft.map(toLL), { color: "#e11d1d", weight: 2, dashArray: "6 4", interactive: false, pane: "rmShapes" }).addTo(layer);
      draft.forEach((p, i) =>
        L.circleMarker([p.lat, p.lng], {
          radius: i === 0 ? 7 : 4,
          color: i === 0 ? "#16a34a" : "#e11d1d",
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 2,
          interactive: false,
          className: "no-print",
        }).addTo(layer)
      );
    }

    // Plot editor: drag the whole plot (centre handle), drag a corner, click a mid point to add a corner,
    // double click a corner to delete it. Works with mouse and touch.
    if (plot?.edit?.active && plotRing) {
      const ring = plotRing;
      const onChange = plot.edit.onChange;
      const plotPoly = polygons[0];
      const handleIcon = (kind: "vertex" | "mid" | "move") =>
        L.divIcon({ className: "no-print", html: handleHtml(kind), iconSize: [0, 0] });
      const toPlain = (m: any): LatLng => ({ lat: m.getLatLng().lat, lng: m.getLatLng().lng });

      const vertexMarkers = ring.map((p, i) => {
        const m = L.marker([p.lat, p.lng], { draggable: true, icon: handleIcon("vertex"), zIndexOffset: 1000 }).addTo(layer);
        m.on("drag", () => plotPoly.setLatLngs(vertexMarkers.map((x: any) => x.getLatLng())));
        m.on("dragend", () => onChange(vertexMarkers.map(toPlain)));
        m.on("dblclick", (e: any) => {
          L.DomEvent.stop(e);
          if (ring.length > 3) onChange(ring.filter((_, j) => j !== i));
        });
        return m;
      });

      ring.forEach((p, i) => {
        const q = ring[(i + 1) % ring.length];
        const mid = { lat: (p.lat + q.lat) / 2, lng: (p.lng + q.lng) / 2 };
        L.marker([mid.lat, mid.lng], { icon: handleIcon("mid"), zIndexOffset: 900 })
          .addTo(layer)
          .on("click", (e: any) => {
            L.DomEvent.stop(e);
            onChange([...ring.slice(0, i + 1), mid, ...ring.slice(i + 1)]);
          });
      });

      const c = ringCenter(ring);
      let start: { lat: number; lng: number } | null = null;
      const mover = L.marker([c.lat, c.lng], { draggable: true, icon: handleIcon("move"), zIndexOffset: 1100 }).addTo(layer);
      mover.on("dragstart", () => {
        start = mover.getLatLng();
      });
      mover.on("drag", () => {
        if (!start) return;
        const now = mover.getLatLng();
        const dLat = now.lat - start.lat;
        const dLng = now.lng - start.lng;
        plotPoly.setLatLngs(ring.map((p) => [p.lat + dLat, p.lng + dLng]));
        vertexMarkers.forEach((m: any, i: number) => m.setLatLng([ring[i].lat + dLat, ring[i].lng + dLng]));
      });
      mover.on("dragend", () => {
        if (!start) return;
        const now = mover.getLatLng();
        const dLat = now.lat - start.lat;
        const dLng = now.lng - start.lng;
        onChange(ring.map((p) => ({ lat: p.lat + dLat, lng: p.lng + dLng })));
      });
    }

    // Names and boundary texts depend on the zoom (pixel sizes), so they are rebuilt after every zoom
    const nameGroup = L.layerGroup().addTo(layer);
    const boundaryGroup = L.layerGroup().addTo(layer);

    const toPx = (ring: LatLng[]): PxPoint[] =>
      ring.map((p) => {
        const pt = map.latLngToLayerPoint([p.lat, p.lng]);
        return { x: pt.x, y: pt.y };
      });

    const rebuildLabels = () => {
      nameGroup.clearLayers();
      boundaryGroup.clearLayers();
      const obstacles: LabelRect[] = [];
      const plotCentre = plotRing ? pxCentroid(toPx(plotRing)) : null;

      // Names stay inside their outline: the font follows the size of the outline on screen
      items.forEach((it) => {
        const px = toPx(it.ring);
        let label = it.labels[0];
        let fit = null as ReturnType<typeof fitLabelInRing>;
        for (const candidate of it.labels) {
          fit = fitLabelInRing(px, measureText(candidate, 100) / 100, { maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT });
          label = candidate;
          if (fit) break;
        }
        if (!fit) return;
        const anchor = map.layerPointToLatLng([fit.x, fit.y]);
        const html = mapLabelHtml(label, {
          shift: `translate(-50%,-50%) rotate(${fit.angleDeg.toFixed(1)}deg)`,
          font: `800 ${fit.fontPx.toFixed(1)}px/1 Arial,sans-serif`,
          color: LABEL_YELLOW,
          halo: TEXT_HALO_BLACK,
        });
        addHtmlMarker(L, nameGroup, { lat: anchor.lat, lng: anchor.lng }, html);
        if (it.isPlot) {
          const w = (measureText(label, 100) / 100) * fit.fontPx;
          obstacles.push({ x: fit.x, y: fit.y, w: Math.max(w, fit.fontPx) + 2, h: Math.max(w, fit.fontPx) * 0.6 + 2 });
        }
      });

      // Boundary texts: one text outside each side of the plot, pushed outwards until nothing overlaps
      const boundaries = plot?.boundaries;
      if (!plotRing || !boundaries || !plotCentre || map.getZoom() < BOUNDARY_LABEL_MIN_ZOOM) return;
      const centre = plotCentre;
      const px = toPx(plotRing);
      const dirs = {
        north: { x: 0, y: -1 },
        east: { x: 1, y: 0 },
        south: { x: 0, y: 1 },
        west: { x: -1, y: 0 },
      } as const;

      const requests = (Object.keys(dirs) as (keyof typeof dirs)[]).flatMap((key) => {
        const text = (boundaries[key] || "").trim();
        const edge = edgeFacing(px, dirs[key]);
        if (!text || !edge) return [];
        const lines = wrapByWidth(text, BOUNDARY_LABEL_MAX_WIDTH, BOUNDARY_LABEL_FONT, 4);
        const w = Math.max(...lines.map((l) => measureText(l, BOUNDARY_LABEL_FONT))) + 4;
        const h = lines.length * BOUNDARY_LABEL_LINE_HEIGHT + 3;
        return [{ key, edge, w, h, lines }];
      });
      const placed = placeBoundaryLabels(requests, obstacles);

      const anchor = map.layerPointToLatLng([centre.x, centre.y]);
      requests.forEach((r) => {
        const rect = placed[r.key];
        const html =
          `<div style="position:absolute;left:0;top:0;transform:translate(${(rect.x - centre.x - rect.w / 2).toFixed(1)}px,${(rect.y - centre.y - rect.h / 2).toFixed(1)}px);` +
          `width:${Math.ceil(rect.w)}px;text-align:center;white-space:nowrap;font:700 ${BOUNDARY_LABEL_FONT}px/${BOUNDARY_LABEL_LINE_HEIGHT}px Arial,sans-serif;` +
          `color:#000;${TEXT_HALO_WHITE}">${r.lines.map(escapeHtml).join("<br>")}</div>`;
        addHtmlMarker(L, boundaryGroup, { lat: anchor.lat, lng: anchor.lng }, html);
      });
    };

    // When zoomed far out the plot is only a few pixels wide, so a red dot marks the site
    const dotAt = plotRing ? ringCenter(plotRing) : site;
    const dot = L.circleMarker([dotAt.lat, dotAt.lng], {
      radius: 4,
      color: "#7f1d1d",
      weight: 1,
      fillColor: "#e11d1d",
      fillOpacity: 1,
      interactive: false,
    });
    const syncZoomItems = () => {
      if (plotRing && map.getZoom() <= SITE_DOT_MAX_ZOOM) {
        if (!layer.hasLayer(dot)) layer.addLayer(dot);
      } else {
        layer.removeLayer(dot);
      }
      rebuildLabels();
    };
    syncZoomItems();
    map.on("zoomend", syncZoomItems);
    return () => {
      map.off("zoomend", syncZoomItems);
    };
  }, [ready, site.lat, site.lng, plot?.ring, plot?.label, plot?.boundaries, plot?.edit?.active, plot?.draw?.active, plot?.draw?.draft, landmarks?.items]);

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

  // Cursor feedback while drawing / adding landmarks / picking the main road / drawing the plot
  const picking = !!route?.drawing || !!landmarks?.adding || !!topo?.picking || !!plot?.draw?.active;
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
