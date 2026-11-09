// Vector "topo" basemap of the route map.
//
// - Roads, water, parks, place / road / POI names: OpenStreetMap data served as vector tiles by OpenFreeMap
//   (free, no API key), drawn here in a CAD-like topographic style (grey houses, salmon roads with black casing)
// - Houses: ML building footprints (Google Open Buildings + Microsoft, combined by VIDA, PMTiles on Source Cooperative),
//   so houses show up even where OpenStreetMap has none
// - Rendered by MapLibre GL inside the Leaflet map (maplibre-gl-leaflet), so all overlays keep working
//
// Everything is loaded from CDNs at run time; nothing has to be installed.
import { BUILDING_FILL } from "./constants";

const MAPLIBRE_VERSION = "4.7.1";
const PMTILES_VERSION = "3.2.0";
const GL_LEAFLET_VERSION = "0.0.20";

const MAPLIBRE_JS = `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${MAPLIBRE_VERSION}/maplibre-gl.min.js`;
export const MAPLIBRE_CSS = `https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/${MAPLIBRE_VERSION}/maplibre-gl.min.css`;
const PMTILES_JS = `https://unpkg.com/pmtiles@${PMTILES_VERSION}/dist/pmtiles.js`;
const GL_LEAFLET_JS = `https://unpkg.com/@maplibre/maplibre-gl-leaflet@${GL_LEAFLET_VERSION}/leaflet-maplibre-gl.js`;

// OpenFreeMap: the "liberty" style is only read for its tile source, glyph (font) URL and font names
const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const FALLBACK_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const FALLBACK_SOURCE = { type: "vector", url: "https://tiles.openfreemap.org/planet" };
const FALLBACK_FONTS = { regular: ["Noto Sans Regular"], bold: ["Noto Sans Bold"] };

// Building footprints (Google + Microsoft ML footprints, ODbL / CC BY 4.0)
const BUILDINGS_PMTILES_URL =
  "https://data.source.coop/vida/google-microsoft-open-buildings/pmtiles/go_ms_building_footprints.pmtiles";
const BUILDINGS_SOURCE_LAYER = "building_footprints";

const TOPO_ATTRIBUTION =
  "© OpenStreetMap contributors · OpenFreeMap · Buildings: Google Open Buildings, Microsoft (VIDA)";

const STYLE_FETCH_TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------------
// Script loading
// ---------------------------------------------------------------------------

const pending = new Map<string, Promise<void>>();

const loadScript = (src: string): Promise<void> => {
  const existing = pending.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      pending.delete(src);
      reject(new Error(`Failed to load ${src}`));
    };
    document.body.appendChild(el);
  });
  pending.set(src, promise);
  return promise;
};

const loadCss = (href: string) => {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
};

let libsPromise: Promise<void> | null = null;

// MapLibre GL, the PMTiles reader and the Leaflet binding (in this order: each one needs the previous one)
const loadVectorLibs = (): Promise<void> => {
  if (libsPromise) return libsPromise;
  libsPromise = (async () => {
    loadCss(MAPLIBRE_CSS);
    await loadScript(MAPLIBRE_JS);
    await loadScript(PMTILES_JS);
    await loadScript(GL_LEAFLET_JS);
    // pmtiles:// URLs are resolved by this protocol handler (registered once per page)
    const w = window as any;
    if (!w.__routeMapPmtilesRegistered) {
      const protocol = new w.pmtiles.Protocol();
      w.maplibregl.addProtocol("pmtiles", protocol.tile);
      w.__routeMapPmtilesRegistered = true;
    }
  })().catch((e) => {
    libsPromise = null;
    throw e;
  });
  return libsPromise;
};

// ---------------------------------------------------------------------------
// Style
// ---------------------------------------------------------------------------

interface BaseResources {
  glyphs: string;
  source: any;
  fonts: { regular: string[]; bold: string[] };
}

// Reads tile source, glyph URL and font names from the OpenFreeMap liberty style (falls back to known values)
const readBaseResources = async (): Promise<BaseResources> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STYLE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(OPENFREEMAP_STYLE_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`Style request failed (${res.status})`);
    const json = await res.json();
    const source = Object.values(json.sources || {}).find((s: any) => s && s.type === "vector") || FALLBACK_SOURCE;

    // Font stacks used by the style; only fonts that exist in the glyph server may be requested
    const stacks: string[][] = (json.layers || [])
      .map((l: any) => l?.layout?.["text-font"])
      .filter((f: any) => Array.isArray(f) && f.every((x: any) => typeof x === "string"));
    const regular = stacks.find((f) => !f.some((x) => /bold/i.test(x))) || FALLBACK_FONTS.regular;
    const bold = stacks.find((f) => f.some((x) => /bold/i.test(x))) || regular;
    return { glyphs: json.glyphs || FALLBACK_GLYPHS, source, fonts: { regular, bold } };
  } catch (e) {
    console.warn("OpenFreeMap style could not be read, using defaults:", e);
    return { glyphs: FALLBACK_GLYPHS, source: FALLBACK_SOURCE, fonts: FALLBACK_FONTS };
  } finally {
    clearTimeout(timer);
  }
};

// Name shown on the map: English first, then the latin transliteration, then the local name
const NAME_EXPR = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name:latin"], ["get", "name"]];

const inClass = (classes: string[]) => ["in", ["get", "class"], ["literal", classes]];
const lineFilter = (classes: string[]) => ["all", ["==", ["geometry-type"], "LineString"], inClass(classes)];

// Line width that grows with the zoom like a real road: v14 pixels at zoom 14, doubling with every zoom level
const roadWidth = (v14: number, extra = 0): any => [
  "interpolate",
  ["exponential", 2],
  ["zoom"],
  10, Math.max(0.5, v14 / 16) + extra,
  14, v14 + extra,
  20, v14 * 64 + extra,
];

const ROADS = [
  { id: "service", classes: ["service", "track"], v14: 0.5, fill: "#fbd9c9" },
  { id: "minor", classes: ["minor"], v14: 0.7, fill: "#f8c4ad" },
  { id: "mid", classes: ["secondary", "tertiary"], v14: 1.4, fill: "#f3a583" },
  { id: "major", classes: ["motorway", "trunk", "primary"], v14: 2.4, fill: "#ee8a62" },
];
const CASING = "#2f2f2f";
const CASING_EXTRA = 1.6;

export const buildTopoStyle = async (): Promise<any> => {
  const { glyphs, source, fonts } = await readBaseResources();

  const haloWhite = { "text-halo-color": "#ffffff", "text-halo-width": 1.8 };
  const layers: any[] = [
    { id: "bg", type: "background", paint: { "background-color": "#ffffff" } },

    // Ground
    {
      id: "landuse-residential", type: "fill", source: "ofm", "source-layer": "landuse",
      filter: inClass(["residential"]), paint: { "fill-color": "#f6f2ec" },
    },
    {
      id: "landuse-institution", type: "fill", source: "ofm", "source-layer": "landuse",
      filter: inClass(["school", "hospital", "stadium", "pitch", "playground", "cemetery"]),
      paint: { "fill-color": "#efeaf3" },
    },
    {
      id: "landcover-green", type: "fill", source: "ofm", "source-layer": "landcover",
      filter: inClass(["grass", "wood"]), paint: { "fill-color": "#ebf4e4" },
    },
    { id: "park", type: "fill", source: "ofm", "source-layer": "park", paint: { "fill-color": "#e3f0da" } },
    { id: "water", type: "fill", source: "ofm", "source-layer": "water", paint: { "fill-color": "#cfe6f5" } },
    {
      id: "waterway", type: "line", source: "ofm", "source-layer": "waterway",
      paint: { "line-color": "#9cc9e6", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.6, 18, 3] },
    },

    // Houses: ML footprints first, OpenStreetMap buildings on top (same look, so overlaps are invisible)
    {
      id: "buildings-ml", type: "fill", source: "vida", "source-layer": BUILDINGS_SOURCE_LAYER, minzoom: 13,
      paint: { "fill-color": BUILDING_FILL, "fill-outline-color": "#2b2b2b" },
    },
    {
      id: "buildings-osm", type: "fill", source: "ofm", "source-layer": "building", minzoom: 13,
      paint: { "fill-color": BUILDING_FILL, "fill-outline-color": "#2b2b2b" },
    },

    // Railway
    {
      id: "rail-base", type: "line", source: "ofm", "source-layer": "transportation", filter: lineFilter(["rail"]),
      paint: { "line-color": "#222222", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 18, 4] },
    },
    {
      id: "rail-dash", type: "line", source: "ofm", "source-layer": "transportation", filter: lineFilter(["rail"]),
      paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 18, 2], "line-dasharray": [3, 3] },
    },
  ];

  // Road casings first (all classes), then the fills, so junctions open up like on a drawing
  ROADS.forEach((r) =>
    layers.push({
      id: `road-casing-${r.id}`, type: "line", source: "ofm", "source-layer": "transportation", filter: lineFilter(r.classes),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": CASING, "line-width": roadWidth(r.v14, CASING_EXTRA) },
    })
  );
  ROADS.forEach((r) =>
    layers.push({
      id: `road-fill-${r.id}`, type: "line", source: "ofm", "source-layer": "transportation", filter: lineFilter(r.classes),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": r.fill, "line-width": roadWidth(r.v14) },
    })
  );
  layers.push({
    id: "road-path", type: "line", source: "ofm", "source-layer": "transportation", filter: lineFilter(["path"]), minzoom: 15,
    paint: { "line-color": "#555555", "line-width": 0.8, "line-dasharray": [2, 2] },
  });

  // Names, like a normal map: roads, places (colonies, wards), points of interest
  layers.push(
    {
      id: "road-names", type: "symbol", source: "ofm", "source-layer": "transportation_name", minzoom: 13,
      layout: {
        "symbol-placement": "line",
        "text-field": NAME_EXPR,
        "text-font": fonts.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 13, 9, 18, 13],
        "symbol-spacing": 300,
        "text-max-angle": 30,
      },
      paint: { "text-color": "#1f1f1f", ...haloWhite },
    },
    {
      id: "place-names", type: "symbol", source: "ofm", "source-layer": "place", minzoom: 11,
      filter: inClass(["city", "town", "village", "hamlet", "suburb", "quarter", "neighbourhood", "isolated_dwelling"]),
      layout: {
        "text-field": NAME_EXPR,
        "text-font": fonts.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 17, 15],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.12,
        "text-max-width": 8,
      },
      paint: { "text-color": "#3a3a3a", ...haloWhite },
    },
    {
      id: "poi-dots", type: "circle", source: "ofm", "source-layer": "poi", minzoom: 15,
      filter: ["has", "name"],
      paint: { "circle-radius": 2.5, "circle-color": "#555555", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 },
    },
    {
      id: "poi-names", type: "symbol", source: "ofm", "source-layer": "poi", minzoom: 15,
      filter: ["has", "name"],
      layout: {
        "text-field": NAME_EXPR,
        "text-font": fonts.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 15, 9, 18, 12],
        "text-anchor": "top",
        "text-offset": [0, 0.5],
        "text-max-width": 7,
      },
      paint: { "text-color": "#2a2a2a", ...haloWhite },
    }
  );

  return {
    version: 8,
    glyphs,
    sources: {
      ofm: source,
      vida: { type: "vector", url: `pmtiles://${BUILDINGS_PMTILES_URL}` },
    },
    layers,
  };
};

// Creates the Leaflet layer that draws the topo basemap. Throws when the libraries cannot be loaded.
export const createTopoLayer = async (L: any): Promise<any> => {
  await loadVectorLibs();
  if (typeof L.maplibreGL !== "function") throw new Error("maplibre-gl-leaflet is not available");
  const style = await buildTopoStyle();
  // preserveDrawingBuffer keeps the picture available for printing / saving as PDF
  return L.maplibreGL({ style, attribution: TOPO_ATTRIBUTION, preserveDrawingBuffer: true });
};
