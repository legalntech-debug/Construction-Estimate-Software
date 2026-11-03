"use client";
// Leaflet map used twice on the sheet: the satellite view (top) and the topography / route view (bottom).
import { useEffect, useRef, useState } from "react";
import { bearingDeg, ringCentroid, routeLengthMeters } from "../routeMapGeo";
import type { LatLng, MapFeatures } from "../routeMapGeo";
import type { BaseMode, Landmark, MapViewState } from "../types";
import {
  BUILDING_FILL, FEET_TO_METERS, GREEN_HATCH_ID, LABEL_YELLOW, METERS_PER_DEGREE_LAT, OSM_ATTRIBUTION,
  ROUTE_COLOR, SATELLITE_TILES, STREET_TILES,
} from "../constants";
import { ensureHatchPattern, loadLeaflet, rectAround, roadWeight, routeMidPoint, toLL } from "../leafletSupport";
import { escapeHtml } from "../helpers";

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
  // Street map only: topography line drawing (OpenStreetMap data) or the raster street tiles
  base?: BaseMode;
  defaultZoom: number;
  initialView?: MapViewState | null;
  markerKind: "pin" | "none";
  // Real-size plot box (street map only)
  plot?: { widthFt: number; heightFt: number; label: string };
  landmarks?: { items: Landmark[]; adding: boolean; onAdd: (p: LatLng) => void };
  topo?: TopoData;
  // Message shown on the map while data loads or when it is unavailable (screen only)
  statusChip?: string;
  onViewChange?: (view: MapViewState) => void;
  route?: {
    points: LatLng[];
    drawing: boolean;
    onAddPoint: (p: LatLng) => void;
  };
}

export default function LeafletMap({ site, tile, base = "lines", defaultZoom, initialView, markerKind, plot, landmarks, topo, statusChip, onViewChange, route }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const shapesLayerRef = useRef<any>(null);
  const topoLayerRef = useRef<any>(null);
  const streetTileRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // Latest callbacks / flags are read through refs so the map is created only once
  const onViewChangeRef = useRef(onViewChange);
  const routeRef = useRef(route);
  const landmarksRef = useRef(landmarks);
  const topoRef = useRef(topo);
  onViewChangeRef.current = onViewChange;
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
        L.control.zoom({ position: "topright" }).addTo(map);
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
          topoLayerRef.current = L.layerGroup();
        }

        if (markerKind === "pin") {
          const pinHtml = `<svg width="26" height="36" viewBox="0 0 26 36" style="display:block;transform:translate(-13px,-34px)"><path d="M13 1C6.4 1 1 6.2 1 12.7 1 21.5 13 35 13 35s12-13.5 12-22.3C25 6.2 19.6 1 13 1z" fill="#e11d1d" stroke="#7f1d1d" stroke-width="1.5"/><circle cx="13" cy="12.5" r="4.5" fill="#fff"/></svg>`;
          L.marker([site.lat, site.lng], {
            icon: L.divIcon({ className: "", html: pinHtml, iconSize: [0, 0] }),
            interactive: false,
          }).addTo(map);
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      routeLayerRef.current = null;
      shapesLayerRef.current = null;
      topoLayerRef.current = null;
      streetTileRef.current = null;
      setReady(false);
    };
    // The map is intentionally created once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Street map base: topography line drawing or raster street tiles
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const topoLayer = topoLayerRef.current;
    if (!ready || !L || !map || !topoLayer || tile !== "street") return;

    if (base === "tiles") {
      if (!streetTileRef.current) {
        streetTileRef.current = L.tileLayer(STREET_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION });
      }
      streetTileRef.current.addTo(map);
      map.removeLayer(topoLayer);
    } else {
      if (streetTileRef.current) map.removeLayer(streetTileRef.current);
      topoLayer.addTo(map);
    }
  }, [ready, base, tile]);

  // Topography: colonies, built houses and roads as black line work (the main road is drawn heavier)
  useEffect(() => {
    const L = window.L;
    const layer = topoLayerRef.current;
    if (!ready || !L || !layer) return;

    layer.clearLayers();
    if (!topo) return;
    const { features, mainWayIds, colonyId, mainRoadLabel } = topo;

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
      const html =
        `<div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);white-space:nowrap;font:800 11px/1.2 Arial,sans-serif;` +
        `letter-spacing:1px;color:#000;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff">${escapeHtml(colony.name.toUpperCase())}</div>`;
      L.marker([c.lat, c.lng], { icon: L.divIcon({ className: "", html, iconSize: [0, 0] }), interactive: false }).addTo(layer);
    }

    // Built houses
    features.buildings.forEach((b) => {
      L.polygon(b.ring.map(toLL), {
        color: "#000",
        weight: 0.7,
        fillColor: BUILDING_FILL,
        fillOpacity: 1,
        interactive: false,
        pane: "rmBuildings",
      }).addTo(layer);
    });

    // Roads: regular ways first, the main road on top
    const drawRoad = (r: (typeof features.roads)[number], main: boolean) =>
      L.polyline(r.geometry.map(toLL), {
        color: "#000",
        weight: main ? roadWeight(r.highway) + 3 : roadWeight(r.highway),
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
        pane: "rmRoads",
      }).addTo(layer);
    features.roads.forEach((r) => {
      if (!mainWayIds.has(r.id)) drawRoad(r, false);
    });
    features.roads.forEach((r) => {
      if (mainWayIds.has(r.id)) drawRoad(r, true);
    });

    if (mainRoadLabel) {
      const html =
        `<div style="position:absolute;left:0;top:0;transform:translate(-50%,-140%);white-space:nowrap;font:800 10px/1.2 Arial,sans-serif;` +
        `color:#000;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff">${escapeHtml(mainRoadLabel.text)}</div>`;
      L.marker([mainRoadLabel.position.lat, mainRoadLabel.position.lng], {
        icon: L.divIcon({ className: "", html, iconSize: [0, 0] }),
        interactive: false,
      }).addTo(layer);
    }
  }, [ready, topo?.features, topo?.mainWayIds, topo?.colonyId, topo?.mainRoadLabel]);

  // Plot box and landmark boxes: geographic polygons, so they scale with the map exactly like the real ground
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const layer = shapesLayerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();

    const addBox = (center: LatLng, widthFt: number, heightFt: number, label: string, outline: string) => {
      const poly = L.polygon(rectAround(center, widthFt, heightFt), {
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

      // Name: yellow text with a dark outline (stays readable on white and on satellite), above the north edge
      const northLat = center.lat + (heightFt * FEET_TO_METERS) / 2 / METERS_PER_DEGREE_LAT;
      const labelHtml =
        `<div style="position:absolute;left:0;top:0;transform:translate(-50%,-110%);white-space:nowrap;` +
        `font:800 10px/1.2 Arial,sans-serif;color:${LABEL_YELLOW};` +
        `text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000">${escapeHtml(label)}</div>`;
      L.marker([northLat, center.lng], {
        icon: L.divIcon({ className: "", html: labelHtml, iconSize: [0, 0] }),
        interactive: false,
      }).addTo(layer);
    };

    if (plot) addBox(site, plot.widthFt, plot.heightFt, plot.label, "#e11d1d");
    (landmarks?.items || []).forEach((lm) =>
      addBox({ lat: lm.lat, lng: lm.lng }, Math.max(lm.width_ft, 1), Math.max(lm.height_ft, 1), lm.name, "#000")
    );

    // When zoomed far out the plot box is only a few pixels wide, so a red dot marks the site
    if (!plot) return;
    const dot = L.circleMarker([site.lat, site.lng], {
      radius: 4,
      color: "#7f1d1d",
      weight: 1,
      fillColor: "#e11d1d",
      fillOpacity: 1,
      interactive: false,
    });
    const syncDot = () => {
      if (map.getZoom() <= 17) {
        if (!layer.hasLayer(dot)) layer.addLayer(dot);
      } else {
        layer.removeLayer(dot);
      }
    };
    syncDot();
    map.on("zoomend", syncDot);
    return () => {
      map.off("zoomend", syncDot);
    };
  }, [ready, site.lat, site.lng, plot?.widthFt, plot?.heightFt, plot?.label, landmarks?.items]);

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
      L.marker([last.lat, last.lng], {
        icon: L.divIcon({ className: "", html: arrowHtml, iconSize: [0, 0] }),
        interactive: false,
      }).addTo(layer);

      const meters = Math.round(routeLengthMeters(pts));
      const mid = routeMidPoint(pts);
      // The icon box has zero size, so the label is positioned absolutely to be centred above the route line
      const labelHtml = `<div style="position:absolute;left:0;top:0;transform:translate(-50%,-125%);white-space:nowrap;background:rgba(255,255,255,0.85);padding:0 3px;font:700 9px/1.3 Arial,sans-serif;color:#000">APPROX. ${meters} METER</div>`;
      L.marker([mid.lat, mid.lng], {
        icon: L.divIcon({ className: "", html: labelHtml, iconSize: [0, 0] }),
        interactive: false,
      }).addTo(layer);
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
    const handler = () => mapRef.current?.invalidateSize();
    window.addEventListener("beforeprint", handler);
    return () => window.removeEventListener("beforeprint", handler);
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className={tile === "street" && base === "tiles" ? "rm-street-gray" : undefined}
        style={{ position: "absolute", inset: 0, zIndex: 0, background: tile === "street" ? "#fff" : "#e5e7eb" }}
      />
      {statusChip && tile === "street" && base === "lines" && (
        <div
          className="no-print"
          style={{ position: "absolute", left: "50%", bottom: 6, transform: "translateX(-50%)", zIndex: 1300, background: "#fff", border: "1px solid #000", padding: "1px 8px", fontSize: 11, fontWeight: 700, pointerEvents: "none" }}
        >
          {statusChip}
        </div>
      )}
    </>
  );
}
