// Geo utilities for the Route Map / Location Plan service.
//
// - Reads roads, buildings and residential areas (colonies) from OpenStreetMap through the Overpass API
// - Finds the nearest "main road" of a property and the road route to it (graph search over the loaded roads)
//
// Everything in this file is plain TypeScript. The only browser feature it touches is localStorage for the optional
// data cache (guarded), so it can be unit tested in Node.

export type LatLng = { lat: number; lng: number };

export interface RoadWay {
  id: number;
  geometry: LatLng[];
  highway: string;
  name?: string;
  ref?: string;
}

export interface Footprint {
  id: number;
  ring: LatLng[];
  landuse?: string;
  name?: string;
}

export interface MapFeatures {
  roads: RoadWay[];
  buildings: Footprint[];
  areas: Footprint[];
}

export const EMPTY_FEATURES: MapFeatures = { roads: [], buildings: [], areas: [] };

// ---------------------------------------------------------------------------
// Basic geometry
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6371000;
export const METERS_PER_DEGREE_LAT = 111320;

export const toRad = (d: number) => (d * Math.PI) / 180;

export const haversineMeters = (a: LatLng, b: LatLng) => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

export const routeLengthMeters = (pts: LatLng[]) =>
  pts.slice(1).reduce((sum, p, i) => sum + haversineMeters(pts[i], p), 0);

// Initial bearing from a to b in degrees (0 = north, clockwise)
export const bearingDeg = (a: LatLng, b: LatLng) => {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const COMPASS_LABELS = ["NORTH", "NORTH-EAST", "EAST", "SOUTH-EAST", "SOUTH", "SOUTH-WEST", "WEST", "NORTH-WEST"];

// Eight-point compass name for a bearing
export const compassLabel = (deg: number) => COMPASS_LABELS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// Local flat projection (metres) around a reference point; accurate enough for distances of a few kilometres
const makeProjector = (origin: LatLng) => {
  const kx = METERS_PER_DEGREE_LAT * Math.cos(toRad(origin.lat));
  return (p: LatLng) => ({ x: (p.lng - origin.lng) * kx, y: (p.lat - origin.lat) * METERS_PER_DEGREE_LAT });
};

// Closest point of segment AB to P (all in the projected plane)
const projectOnSegment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return { x, y, t, dist: Math.hypot(p.x - x, p.y - y) };
};

// Ray casting point-in-polygon test
export const pointInRing = (p: LatLng, ring: LatLng[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng;
    const yi = ring[i].lat;
    const xj = ring[j].lng;
    const yj = ring[j].lat;
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const ringArea = (ring: LatLng[]) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j].lng * ring[i].lat - ring[i].lng * ring[j].lat;
  }
  return Math.abs(a / 2);
};

export const ringCentroid = (ring: LatLng[]): LatLng => ({
  lat: ring.reduce((s, p) => s + p.lat, 0) / ring.length,
  lng: ring.reduce((s, p) => s + p.lng, 0) / ring.length,
});

// Residential / commercial area (colony) that contains the point; the smallest one wins when areas are nested
export const findContainingArea = (p: LatLng, areas: Footprint[]): Footprint | null => {
  let best: Footprint | null = null;
  let bestArea = Infinity;
  for (const a of areas) {
    if (a.landuse !== "residential" && a.landuse !== "commercial") continue;
    if (!pointInRing(p, a.ring)) continue;
    const area = ringArea(a.ring);
    if (area < bestArea) {
      best = a;
      bestArea = area;
    }
  }
  return best;
};

// Nearest road way to a point (used when the user clicks a road to mark it as the main road)
export const nearestRoadWay = (p: LatLng, roads: RoadWay[], maxMeters: number): { way: RoadWay; distM: number } | null => {
  const proj = makeProjector(p);
  const origin = { x: 0, y: 0 };
  let best: { way: RoadWay; distM: number } | null = null;
  for (const way of roads) {
    for (let i = 1; i < way.geometry.length; i++) {
      const hit = projectOnSegment(origin, proj(way.geometry[i - 1]), proj(way.geometry[i]));
      if (hit.dist <= maxMeters && (!best || hit.dist < best.distM)) best = { way, distM: hit.dist };
    }
  }
  return best;
};

// ---------------------------------------------------------------------------
// Overpass access
// ---------------------------------------------------------------------------

// The public Overpass instances are meant for light use (see the OpenStreetMap wiki, "Overpass API");
// for commercial volume run your own instance and put its URL first in this list. Failing servers are skipped.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

const REQUEST_TIMEOUT_MS = 20000;
const ROAD_EXCLUDE = "^(footway|steps|corridor|proposed|construction|elevator|platform|bus_stop|pedestrian|cycleway|bridleway)$";
const AREA_LANDUSE = "^(residential|commercial|industrial|retail|institutional)$";
const MAX_BUILDINGS = 6000;

// Default search radii (metres). Roads come first because they are small and enough to start the main road search;
// buildings and colonies follow in separate, lighter requests.
const ROAD_RADIUS_M = 900;
const BUILDING_RADIUS_M = 250;
const AREA_RADIUS_M = 700;
const ROAD_RADIUS_STEPS_M = [2500, 4500];

interface OverpassResult {
  elements?: any[];
  // Short reason shown to the user when every server failed
  error?: string;
}

// Runs one Overpass query; every endpoint is tried in turn.
const runOverpass = async (query: string, onRetry?: () => void): Promise<OverpassResult> => {
  let lastError = "NO RESPONSE";
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const url = OVERPASS_ENDPOINTS[i];
    if (i > 0) onRetry?.();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: "POST", body: new URLSearchParams({ data: query }), signal: controller.signal });
      if (res.status === 429) {
        lastError = "SERVER BUSY";
        continue;
      }
      if (!res.ok) {
        lastError = `SERVER ERROR ${res.status}`;
        continue;
      }
      const json = await res.json();
      // The server answers 200 with a "remark" when the query ran out of time or memory
      if (typeof json.remark === "string" && /runtime error|timed out|out of memory/i.test(json.remark)) {
        lastError = "QUERY TOO HEAVY";
        continue;
      }
      return { elements: Array.isArray(json.elements) ? json.elements : [] };
    } catch (e: any) {
      lastError = e?.name === "AbortError" ? "TIMEOUT" : "NETWORK ERROR";
      console.warn("Overpass request failed:", url, e);
    } finally {
      clearTimeout(timer);
    }
  }
  return { error: lastError };
};

const toRing = (el: any): LatLng[] | null => {
  if (!Array.isArray(el.geometry) || el.geometry.length < 4) return null;
  const ring: LatLng[] = el.geometry.map((g: any) => ({ lat: g.lat, lng: g.lon }));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first.lat !== last.lat || first.lng !== last.lng) return null; // only closed ways are polygons
  return ring;
};

// Converts raw Overpass elements to map features
export const parseElements = (elements: any[], center?: LatLng): MapFeatures => {
  const roads: RoadWay[] = [];
  let buildings: Footprint[] = [];
  const areas: Footprint[] = [];

  for (const el of elements) {
    if (el.type !== "way" || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
    const tags = el.tags || {};

    if (tags.highway) {
      roads.push({
        id: el.id,
        geometry: el.geometry.map((g: any) => ({ lat: g.lat, lng: g.lon })),
        highway: tags.highway,
        name: tags.name || tags["name:en"],
        ref: tags.ref,
      });
    } else if (tags.building) {
      const ring = toRing(el);
      if (ring) buildings.push({ id: el.id, ring, name: tags.name });
    } else if (tags.landuse) {
      const ring = toRing(el);
      if (ring) areas.push({ id: el.id, ring, landuse: tags.landuse, name: tags.name || tags["name:en"] });
    }
  }

  // Dense city blocks can hold tens of thousands of buildings; keep the ones closest to the centre
  if (center && buildings.length > MAX_BUILDINGS) {
    buildings = buildings
      .map((b) => ({ b, d: haversineMeters(center, ringCentroid(b.ring)) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, MAX_BUILDINGS)
      .map((x) => x.b);
  }
  return { roads, buildings, areas };
};

// Merges two feature sets without duplicates
export const mergeFeatures = (a: MapFeatures, b: MapFeatures): MapFeatures => {
  const merge = <T extends { id: number }>(x: T[], y: T[]) => {
    const seen = new Set(x.map((i) => i.id));
    return [...x, ...y.filter((i) => !seen.has(i.id))];
  };
  return { roads: merge(a.roads, b.roads), buildings: merge(a.buildings, b.buildings), areas: merge(a.areas, b.areas) };
};

const roadQuery = (c: LatLng, r: number) =>
  `[out:json][timeout:20];way["highway"]["highway"!~"${ROAD_EXCLUDE}"](around:${r},${c.lat},${c.lng});out geom qt;`;
const buildingQuery = (c: LatLng, r: number) => `[out:json][timeout:20];way["building"](around:${r},${c.lat},${c.lng});out geom qt;`;
const areaQuery = (c: LatLng, r: number) =>
  `[out:json][timeout:20];way["landuse"~"${AREA_LANDUSE}"](around:${r},${c.lat},${c.lng});out geom qt;`;

// ---------------------------------------------------------------------------
// Cache (browser only): the same property is not downloaded again when the page is reopened
// ---------------------------------------------------------------------------

const CACHE_PREFIX = "routeMapFeatures:";
const CACHE_INDEX_KEY = "routeMapFeaturesIndex";
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 4;
const CACHE_MAX_CHARS = 2_000_000;

const cacheKey = (c: LatLng, parts: string) => `${CACHE_PREFIX}${parts}:${c.lat.toFixed(4)},${c.lng.toFixed(4)}`;

const readCache = (c: LatLng, parts: string): MapFeatures | null => {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(cacheKey(c, parts));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.features as MapFeatures;
  } catch {
    return null;
  }
};

const writeCache = (c: LatLng, parts: string, features: MapFeatures) => {
  try {
    if (typeof localStorage === "undefined") return;
    const payload = JSON.stringify({ savedAt: Date.now(), features });
    if (payload.length > CACHE_MAX_CHARS) return;
    const key = cacheKey(c, parts);
    localStorage.setItem(key, payload);
    // Keep only the most recent entries
    const index: string[] = JSON.parse(localStorage.getItem(CACHE_INDEX_KEY) || "[]").filter((k: string) => k !== key);
    index.push(key);
    while (index.length > CACHE_MAX_ENTRIES) {
      const old = index.shift();
      if (old) localStorage.removeItem(old);
    }
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // Storage full or unavailable: the cache is optional
  }
};

// ---------------------------------------------------------------------------
// Loader used by the preview page
// ---------------------------------------------------------------------------

export type LoadPart = "roads" | "buildings" | "areas";
const ALL_PARTS: LoadPart[] = ["roads", "buildings", "areas"];

export interface LoadOptions {
  // Which data to load. The topo map only needs the roads (for the main road search); the road line drawing
  // also needs buildings and colonies.
  parts?: LoadPart[];
  // Widen the road search until a main road can be found (initial load of a property)
  findMainRoad?: boolean;
  // Ignore the cache and download again
  skipCache?: boolean;
  roadRadiusM?: number;
  buildingRadiusM?: number;
  areaRadiusM?: number;
}

export interface LoadOutcome {
  features: MapFeatures;
  // false when a requested road download failed
  ok: boolean;
  // Short text for parts that failed (e.g. buildings) while the roads loaded fine
  warning?: string;
  error?: string;
}

// Loads roads, then buildings, then colonies around a point. After every step onUpdate receives the merged result,
// so the map can draw the roads while the heavier data is still loading.
export const loadAround = async (
  center: LatLng,
  existing: MapFeatures,
  onUpdate: (features: MapFeatures, message: string) => void,
  options: LoadOptions = {}
): Promise<LoadOutcome> => {
  const parts = options.parts ?? ALL_PARTS;
  const partsKey = [...parts].sort().join("+");
  const roadR = options.roadRadiusM ?? ROAD_RADIUS_M;
  const buildingR = options.buildingRadiusM ?? BUILDING_RADIUS_M;
  const areaR = options.areaRadiusM ?? AREA_RADIUS_M;

  if (!options.skipCache) {
    const cached = readCache(center, partsKey);
    if (cached) {
      const merged = mergeFeatures(existing, cached);
      onUpdate(merged, "");
      return { features: merged, ok: true };
    }
  }

  let features = existing;
  const retryMessage = () => onUpdate(features, "SERVER BUSY - TRYING BACKUP SERVER…");

  // 1. Roads
  if (parts.includes("roads")) {
    onUpdate(features, "LOADING ROADS…");
    const roads = await runOverpass(roadQuery(center, roadR), retryMessage);
    if (!roads.elements) return { features, ok: false, error: roads.error };
    features = mergeFeatures(features, parseElements(roads.elements, center));
    onUpdate(features, parts.length > 1 ? "LOADING BUILDINGS…" : "");

    // 2. Wider road search when the property has no main road close by
    if (options.findMainRoad) {
      for (const radius of ROAD_RADIUS_STEPS_M) {
        if (analyzeMainRoad(center, features.roads)) break;
        onUpdate(features, `SEARCHING MAIN ROAD WITHIN ${(radius / 1000).toFixed(1)} KM…`);
        const more = await runOverpass(roadQuery(center, radius), retryMessage);
        if (!more.elements) break;
        features = mergeFeatures(features, parseElements(more.elements, center));
      }
    }
  }

  const warnings: string[] = [];

  // 3. Buildings
  if (parts.includes("buildings")) {
    onUpdate(features, "LOADING BUILDINGS…");
    const buildings = await runOverpass(buildingQuery(center, buildingR), retryMessage);
    if (buildings.elements) {
      features = mergeFeatures(features, parseElements(buildings.elements, center));
    } else {
      warnings.push(`BUILDINGS UNAVAILABLE (${buildings.error})`);
    }
  }

  // 4. Residential areas (colonies)
  if (parts.includes("areas")) {
    onUpdate(features, "LOADING COLONIES…");
    const areas = await runOverpass(areaQuery(center, areaR), retryMessage);
    if (areas.elements) {
      features = mergeFeatures(features, parseElements(areas.elements, center));
    } else {
      warnings.push(`COLONIES UNAVAILABLE (${areas.error})`);
    }
  }

  onUpdate(features, "");
  if (warnings.length === 0) writeCache(center, partsKey, features);
  return { features, ok: true, warning: warnings.length ? warnings.join(", ") : undefined };
};

// ---------------------------------------------------------------------------
// Main road detection
// ---------------------------------------------------------------------------
//
// A "main road" is a road of class tertiary or higher. For a property the logic is:
//   1. Snap the property to the nearest road segment (the access road).
//   2. Run a shortest-path search over the loaded road network from that point.
//   3. For every main road tier (1 = trunk / primary, 2 = secondary, 3 = tertiary) find the nearest reachable
//      point of that tier, measured along the roads.
//   4. Multiply each distance by the tier weight below and take the smallest result. A higher class road
//      therefore wins unless it is clearly further away than a lower class one.
//   5. If the access road itself is a main road, the plot is already on it and the distance is only the snap distance.
// The user can override the choice by clicking a road (forceWayId).

const MAIN_ROAD_TIER: Record<string, number> = {
  motorway: 1,
  trunk: 1,
  primary: 1,
  secondary: 2,
  tertiary: 3,
};
const MAIN_ROAD_TIER_WEIGHT: Record<number, number> = { 1: 0.6, 2: 0.8, 3: 1.0 };
const MAX_SEARCH_M = 8000;

export interface MainRoadResult {
  wayId: number;
  // Ids of all ways that belong to the same road (same name or ref), used to highlight it
  wayIds: number[];
  highway: string;
  name?: string;
  ref?: string;
  // Distance along the roads from the property to the main road
  distanceM: number;
  // Straight-line distance and compass direction from the property to the point where the route meets the main road
  straightM: number;
  bearing: number;
  direction: string;
  // The property already stands on the main road
  onMainRoad: boolean;
  junction: LatLng;
  // Route from the main road to the property (main road first, property last)
  path: LatLng[];
}

interface HeapItem {
  d: number;
  k: string;
}

// Minimal binary min-heap for Dijkstra
class MinHeap {
  private items: HeapItem[] = [];
  get size() {
    return this.items.length;
  }
  push(item: HeapItem) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].d <= a[i].d) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): HeapItem | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop() as HeapItem;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].d < a[m].d) m = l;
        if (r < a.length && a[r].d < a[m].d) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const nodeKey = (p: LatLng) => `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`;
const keyToPoint = (k: string): LatLng => {
  const [lat, lng] = k.split(",").map(Number);
  return { lat, lng };
};

const sameRoadIds = (way: RoadWay, roads: RoadWay[]) =>
  roads
    .filter((r) => r.id === way.id || (!!way.name && r.name === way.name) || (!!way.ref && r.ref === way.ref))
    .map((r) => r.id);

export const analyzeMainRoad = (
  site: LatLng,
  roads: RoadWay[],
  options: { forceWayId?: number } = {}
): MainRoadResult | null => {
  if (roads.length === 0) return null;
  const proj = makeProjector(site);
  const origin = { x: 0, y: 0 };

  // Road graph: nodes are identified by their coordinates, so ways that share a node are connected
  const adj = new Map<string, { to: string; w: number }[]>();
  const addEdge = (a: string, b: string, w: number) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, w });
    adj.get(b)!.push({ to: a, w });
  };

  // Tier of the road (best one) at every node, and the way that provides it
  const nodeTier = new Map<string, { tier: number; way: RoadWay }>();
  const forced = options.forceWayId !== undefined ? roads.find((r) => r.id === options.forceWayId) : undefined;
  const forcedIds = forced ? new Set(sameRoadIds(forced, roads)) : null;

  let snap: { way: RoadWay; i: number; x: number; y: number; dist: number } | null = null;

  for (const way of roads) {
    const tier = MAIN_ROAD_TIER[way.highway];
    const isTarget = forcedIds ? forcedIds.has(way.id) : tier !== undefined;
    const effectiveTier = forcedIds ? 0 : tier;

    for (let i = 0; i < way.geometry.length; i++) {
      const key = nodeKey(way.geometry[i]);
      if (isTarget) {
        const prev = nodeTier.get(key);
        if (!prev || effectiveTier < prev.tier) nodeTier.set(key, { tier: effectiveTier, way });
      }
      if (i > 0) {
        const keyPrev = nodeKey(way.geometry[i - 1]);
        addEdge(keyPrev, key, haversineMeters(way.geometry[i - 1], way.geometry[i]));
        const hit = projectOnSegment(origin, proj(way.geometry[i - 1]), proj(way.geometry[i]));
        if (!snap || hit.dist < snap.dist) snap = { way, i, x: hit.x, y: hit.y, dist: hit.dist };
      }
    }
  }
  if (!snap) return null;

  // Snap point as a coordinate
  const kx = METERS_PER_DEGREE_LAT * Math.cos(toRad(site.lat));
  const snapPoint: LatLng = { lat: site.lat + snap.y / METERS_PER_DEGREE_LAT, lng: site.lng + snap.x / kx };
  const segA = snap.way.geometry[snap.i - 1];
  const segB = snap.way.geometry[snap.i];

  // Virtual start node connected to both ends of the snapped segment
  const START = "S";
  adj.set(START, [
    { to: nodeKey(segA), w: snap.dist + haversineMeters(snapPoint, segA) },
    { to: nodeKey(segB), w: snap.dist + haversineMeters(snapPoint, segB) },
  ]);

  // Dijkstra
  const dist = new Map<string, number>([[START, 0]]);
  const prev = new Map<string, string>();
  const heap = new MinHeap();
  heap.push({ d: 0, k: START });
  while (heap.size > 0) {
    const cur = heap.pop() as HeapItem;
    if (cur.d > (dist.get(cur.k) ?? Infinity)) continue;
    if (cur.d > MAX_SEARCH_M) break;
    for (const e of adj.get(cur.k) || []) {
      const nd = cur.d + e.w;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, cur.k);
        heap.push({ d: nd, k: e.to });
      }
    }
  }

  // Nearest reachable node per tier
  const bestPerTier = new Map<number, { key: string; d: number; way: RoadWay }>();
  nodeTier.forEach((info, key) => {
    const d = dist.get(key);
    if (d === undefined) return;
    const cur = bestPerTier.get(info.tier);
    if (!cur || d < cur.d) bestPerTier.set(info.tier, { key, d, way: info.way });
  });

  // Candidate list: reachable tiers + the access road itself when it is a main road
  interface Candidate {
    tier: number;
    d: number;
    way: RoadWay;
    key?: string;
    direct: boolean;
  }
  const candidates: Candidate[] = [];
  bestPerTier.forEach((v, tier) => candidates.push({ tier, d: v.d, way: v.way, key: v.key, direct: false }));

  const snapTier = forcedIds ? (forcedIds.has(snap.way.id) ? 0 : undefined) : MAIN_ROAD_TIER[snap.way.highway];
  if (snapTier !== undefined) candidates.push({ tier: snapTier, d: snap.dist, way: snap.way, direct: true });

  if (candidates.length === 0) return null;

  const weight = (tier: number) => (forcedIds ? 1 : MAIN_ROAD_TIER_WEIGHT[tier] ?? 1);
  candidates.sort((a, b) => a.d * weight(a.tier) - b.d * weight(b.tier));
  const chosen = candidates[0];

  // Route points, from the main road to the property
  let path: LatLng[];
  let junction: LatLng;
  if (chosen.direct) {
    junction = snapPoint;
    path = [snapPoint, site];
  } else {
    const chain: string[] = [];
    let k: string | undefined = chosen.key;
    while (k && k !== START) {
      chain.push(k);
      k = prev.get(k);
    }
    // chain runs from the main road back to the snapped segment end
    path = [...chain.map(keyToPoint), snapPoint, site];
    junction = keyToPoint(chosen.key as string);
  }

  const bearing = bearingDeg(site, junction);
  return {
    wayId: chosen.way.id,
    wayIds: sameRoadIds(chosen.way, roads),
    highway: chosen.way.highway,
    name: chosen.way.name,
    ref: chosen.way.ref,
    distanceM: chosen.d,
    straightM: haversineMeters(site, junction),
    bearing,
    direction: compassLabel(bearing),
    onMainRoad: chosen.direct,
    junction,
    path,
  };
};

// ---------------------------------------------------------------------------
// Plot orientation
// ---------------------------------------------------------------------------

// Normalises an angle to the range (-90, 90]
const normalizeHalfTurn = (deg: number) => {
  const r = ((deg % 180) + 180) % 180;
  return r > 90 ? r - 180 : r;
};

// Angle (degrees, clockwise, relative to a north-up plot) that makes the plot follow the street it stands on:
//  - when the plot's road side is known (east / west side: the road runs along the plot's north-south axis;
//    north / south side: along its east-west axis) that side is made parallel to the nearest road
//  - otherwise the plot axes are aligned with the nearest road in the smallest possible turn
// Returns 0 when there is no road within maxDistM.
export const plotRotationDeg = (
  site: LatLng,
  roads: RoadWay[],
  roadSide?: "north" | "east" | "south" | "west" | null,
  maxDistM = 120
): number => {
  const proj = makeProjector(site);
  const origin = { x: 0, y: 0 };
  let best: { dist: number; bearing: number } | null = null;

  for (const way of roads) {
    for (let i = 1; i < way.geometry.length; i++) {
      const a = proj(way.geometry[i - 1]);
      const b = proj(way.geometry[i]);
      // Very short segments give a noisy direction
      if (Math.hypot(b.x - a.x, b.y - a.y) < 3) continue;
      const hit = projectOnSegment(origin, a, b);
      if (hit.dist <= maxDistM && (!best || hit.dist < best.dist)) {
        const bearing = ((Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI + 360) % 180;
        best = { dist: hit.dist, bearing };
      }
    }
  }
  if (!best) return 0;

  const phi = best.bearing;
  let angle: number;
  if (roadSide === "east" || roadSide === "west") angle = normalizeHalfTurn(phi);
  else if (roadSide === "north" || roadSide === "south") angle = normalizeHalfTurn(phi - 90);
  else {
    const r = ((phi % 90) + 90) % 90;
    angle = r > 45 ? r - 90 : r;
  }
  return Math.round(angle * 10) / 10;
};

// ---------------------------------------------------------------------------
// Point along a road
// ---------------------------------------------------------------------------

// A point on one of the given ways, distM metres along the road from the spot nearest to "near", and the direction of
// the road there (bearing in degrees, 0 = north). Used to put the main road name beside the plot instead of on it.
// The way is followed in the direction that has enough road left; null when none of the ways exist.
export const pointAlongWays = (
  roads: RoadWay[],
  wayIds: number[] | Set<number>,
  near: LatLng,
  distM: number
): { point: LatLng; bearing: number } | null => {
  const ids = wayIds instanceof Set ? wayIds : new Set(wayIds);
  const proj = makeProjector(near);
  const origin = { x: 0, y: 0 };

  // Nearest segment of the ways
  let best: { way: RoadWay; index: number; t: number; dist: number } | null = null;
  for (const way of roads) {
    if (!ids.has(way.id)) continue;
    for (let i = 1; i < way.geometry.length; i++) {
      const hit = projectOnSegment(origin, proj(way.geometry[i - 1]), proj(way.geometry[i]));
      if (!best || hit.dist < best.dist) best = { way, index: i, t: hit.t, dist: hit.dist };
    }
  }
  if (!best) return null;

  const { way, index, t } = best;
  const geometry = way.geometry;
  const start: LatLng = {
    lat: geometry[index - 1].lat + (geometry[index].lat - geometry[index - 1].lat) * t,
    lng: geometry[index - 1].lng + (geometry[index].lng - geometry[index - 1].lng) * t,
  };

  // Walk along the way from the start point in one direction
  const walk = (forward: boolean): { point: LatLng; bearing: number; reached: boolean } => {
    let from = start;
    let remaining = distM;
    let i = forward ? index : index - 1;
    let lastBearing = bearingDeg(geometry[index - 1], geometry[index]) + (forward ? 0 : 180);
    while (i >= 0 && i < geometry.length) {
      const to = geometry[i];
      const seg = haversineMeters(from, to);
      if (seg > 0) lastBearing = bearingDeg(from, to);
      if (seg >= remaining && seg > 0) {
        const k = remaining / seg;
        return {
          point: { lat: from.lat + (to.lat - from.lat) * k, lng: from.lng + (to.lng - from.lng) * k },
          bearing: lastBearing,
          reached: true,
        };
      }
      remaining -= seg;
      from = to;
      i += forward ? 1 : -1;
    }
    return { point: from, bearing: lastBearing, reached: false };
  };

  const forward = walk(true);
  if (forward.reached) return { point: forward.point, bearing: forward.bearing };
  const backward = walk(false);
  if (backward.reached) return { point: backward.point, bearing: backward.bearing };
  // The road is shorter than the distance in both directions: use the end that is further away
  const far = haversineMeters(start, forward.point) >= haversineMeters(start, backward.point) ? forward : backward;
  return { point: far.point, bearing: far.bearing };
};
