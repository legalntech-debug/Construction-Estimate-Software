// Shared types of the route map preview.
import type { LatLng } from "./routeMapGeo";

export type MapViewState = { lat: number; lng: number; zoom: number };
export type Boundaries = { east: string; west: string; north: string; south: string };
export type BaseMode = "lines" | "tiles";

export interface Landmark {
  id: string;
  name: string;
  lat: number;
  lng: number;
  width_ft: number;
  height_ft: number;
}

// Result of the main road search that is saved with the record
export interface MainRoadSummary {
  name: string;
  highway: string;
  distance_m: number;
  direction: string;
  on_main_road: boolean;
}

export interface RouteMapData {
  ref_no?: string;
  customer_name: string;
  property_address: string;
  plot_area: string;
  latitude: string;
  longitude: string;
  boundaries: Boundaries;
  estimate_type?: string;
  // Fields owned by this page
  route_points?: LatLng[];
  // "auto" = generated from the road network, "manual" = drawn by the user (never overwritten automatically)
  route_source?: "auto" | "manual";
  // OSM way id of a main road chosen by hand
  main_road_override?: number;
  main_road_summary?: MainRoadSummary;
  landmarks?: Landmark[];
  base_map?: BaseMode;
  side_dims?: Boundaries;
  satellite_view?: MapViewState;
  route_view?: MapViewState;
  generated_at?: string;
}

declare global {
  interface Window {
    L?: any;
  }
}
