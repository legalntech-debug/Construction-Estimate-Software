// Leaflet helpers shared by the map components: CDN loader, real-size boxes, hatch pattern, road weights.
import { haversineMeters, routeLengthMeters } from "./routeMapGeo";
import type { LatLng } from "./routeMapGeo";
import { FEET_TO_METERS, GREEN_HATCH_ID, HATCH_GREEN, LEAFLET_VERSION, METERS_PER_DEGREE_LAT } from "./constants";

let leafletPromise: Promise<any> | null = null;

export const loadLeaflet = (): Promise<any> => {
  if (typeof window === "undefined") return Promise.reject(new Error("Leaflet requires a browser"));
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    const base = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist`;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = `${base}/leaflet.css`;
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = `${base}/leaflet.js`;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => {
      leafletPromise = null;
      reject(new Error("Failed to load Leaflet"));
    };
    document.body.appendChild(script);
  });

  return leafletPromise;
};

const toRad = (d: number) => (d * Math.PI) / 180;

// Point located at half of the total route length (used to place the distance label)
export const routeMidPoint = (pts: LatLng[]): LatLng => {
  const half = routeLengthMeters(pts) / 2;
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = haversineMeters(pts[i - 1], pts[i]);
    if (walked + seg >= half && seg > 0) {
      const t = (half - walked) / seg;
      return {
        lat: pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * t,
        lng: pts[i - 1].lng + (pts[i].lng - pts[i - 1].lng) * t,
      };
    }
    walked += seg;
  }
  return pts[pts.length - 1];
};

// Corner coordinates (NW, NE, SE, SW) of a north-up rectangle of real-world size centred on a point.
// Because the corners are geographic coordinates, the box keeps its true size on the map at every zoom level.
export const rectAround = (c: LatLng, widthFt: number, heightFt: number): [number, number][] => {
  const dLat = (heightFt * FEET_TO_METERS) / 2 / METERS_PER_DEGREE_LAT;
  const dLng = (widthFt * FEET_TO_METERS) / 2 / (METERS_PER_DEGREE_LAT * Math.cos(toRad(c.lat)));
  return [
    [c.lat + dLat, c.lng - dLng],
    [c.lat + dLat, c.lng + dLng],
    [c.lat - dLat, c.lng + dLng],
    [c.lat - dLat, c.lng - dLng],
  ];
};

// Adds the green hatch pattern to the SVG of a Leaflet renderer (once per SVG)
export const ensureHatchPattern = (svg: SVGSVGElement | null | undefined) => {
  if (!svg || svg.querySelector(`#${GREEN_HATCH_ID}`)) return;
  const ns = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(ns, "defs");
  const pattern = document.createElementNS(ns, "pattern");
  pattern.setAttribute("id", GREEN_HATCH_ID);
  pattern.setAttribute("width", "6");
  pattern.setAttribute("height", "6");
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  pattern.setAttribute("patternTransform", "rotate(45)");
  const line = document.createElementNS(ns, "line");
  line.setAttribute("x1", "0");
  line.setAttribute("y1", "0");
  line.setAttribute("x2", "0");
  line.setAttribute("y2", "6");
  line.setAttribute("stroke", HATCH_GREEN);
  line.setAttribute("stroke-width", "1.4");
  pattern.appendChild(line);
  defs.appendChild(pattern);
  svg.insertBefore(defs, svg.firstChild);
};

// Line weight (px) of an OSM road by its highway class
export const roadWeight = (highway?: string) => {
  switch (highway) {
    case "motorway":
    case "trunk":
    case "primary":
      return 4;
    case "secondary":
    case "tertiary":
      return 3;
    case "residential":
    case "unclassified":
    case "living_street":
      return 2;
    default:
      return 1.2;
  }
};

// Leaflet expects [lat, lng] tuples
export const toLL = (p: LatLng): [number, number] => [p.lat, p.lng];
