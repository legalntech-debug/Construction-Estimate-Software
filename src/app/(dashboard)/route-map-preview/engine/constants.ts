// Constants of the route map preview (storage keys, colours, map sources, defaults).
import type { LatLng } from "./routeMapGeo";
import type { Boundaries, Landmark } from "./types";


// localStorage key written by the input form (/route-map)
export const STORAGE_KEY = "routeMapPreview";
// sessionStorage flag read by the input form to restore its fields after "Back to Input"
export const RETURN_TO_FORM_FLAG = "routeMapReturnToForm";
// sessionStorage key prefix for the optional khasra / cadastral inset image (kept out of localStorage because of its size)
export const INSET_STORAGE_PREFIX = "routeMapInset:";
export const ROUTE_MAP_TYPE = "ROUTE MAP";

// Name printed in the "Digitally signed by" block of the sheet
export const SIGNATORY_NAME = "Er. Jayant Tomar";
export const DISCLAIMER_TEXT =
  "THIS ROUTE MAP IS PREPARED AT THE REQUEST OF THE CUSTOMER FOR HIS IN-HOUSE PURPOSE. ALL DETAILS ARE FILLED AS PROVIDED BY THE CUSTOMER, WE ARE NOT RESPONSIBLE FOR ANY OWNERSHIP ETC.";

// Colours used on the sheet
export const CYAN = "#19c6f0";
export const ROUTE_COLOR = "#1d4ed8";
export const HATCH_GREEN = "#16a34a";
export const LABEL_YELLOW = "#ffd400";
export const BUILDING_FILL = "#8a8a8a";

export const LEAFLET_VERSION = "1.9.4";
export const SATELLITE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
// Optional raster street basemap ("STREET MAP" mode). The public OpenStreetMap tile server needs no API key, but its
// usage policy gives no guarantee for heavy or commercial traffic.
export const STREET_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";

// A side of the plot is treated as "road side" when its boundary text contains one of these words
export const ROAD_PATTERN = /ROAD|RASTA|SADAK|MARG|STREET|GALI/i;

export const FEET_TO_METERS = 0.3048;
export const GREEN_HATCH_ID = "rm-hatch-green";

// Default size of a newly added landmark box (feet)
export const DEFAULT_LANDMARK_WIDTH_FT = 40;
export const DEFAULT_LANDMARK_HEIGHT_FT = 30;
// Radius around a click that is searched for a road when the user picks the main road by hand
export const PICK_ROAD_TOLERANCE_M = 60;
// Radius of the extra data load around the map centre ("LOAD MAP DATA HERE")
export const EXTRA_LOAD_ROAD_RADIUS_M = 700;
export const EXTRA_LOAD_BUILDING_RADIUS_M = 400;

export const EMPTY_POINTS: LatLng[] = [];
export const EMPTY_LANDMARKS: Landmark[] = [];
export const EMPTY_DIMS: Boundaries = { east: "", west: "", north: "", south: "" };
