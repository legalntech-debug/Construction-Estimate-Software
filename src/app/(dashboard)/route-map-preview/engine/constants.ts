// Constants of the route map preview (storage keys, colours, map sources, defaults).
import type { LatLng } from "./routeMapGeo";
import type { Boundaries, Landmark } from "./types";


// localStorage key written by the input form (/route-map)
export const STORAGE_KEY = "routeMapPreview";
// sessionStorage flag read by the input form to restore its fields after "Back to Input"
export const RETURN_TO_FORM_FLAG = "routeMapReturnToForm";
// sessionStorage key prefix for the optional khasra / cadastral inset image (kept out of localStorage because of its size)
// sessionStorage key prefix for the site photos shown beside the satellite view, and how many fit on the sheet
export const PHOTO_STORAGE_PREFIX = "routeMapPhotos:";
export const MAX_PHOTOS = 2;
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

// Shorter name of the plot, used when the full name does not fit into the outline at the current zoom
export const PLOT_LABEL_SHORT = "SITE";

// Default size of a newly added landmark box (feet) when no building outline is found under the click
export const DEFAULT_LANDMARK_WIDTH_FT = 80;
export const DEFAULT_LANDMARK_HEIGHT_FT = 60;
// Radius around a click that is searched for a road when the user picks the main road by hand
export const PICK_ROAD_TOLERANCE_M = 60;
// Radius of the extra data load around the map centre ("LOAD MAP DATA HERE")
export const EXTRA_LOAD_ROAD_RADIUS_M = 700;
export const EXTRA_LOAD_BUILDING_RADIUS_M = 400;

export const EMPTY_POINTS: LatLng[] = [];
export const EMPTY_LANDMARKS: Landmark[] = [];
export const EMPTY_DIMS: Boundaries = { east: "", west: "", north: "", south: "" };

// Printing: the page asks the maps to repaint at print size (event), waits for the tiles, then opens the print dialog
export const PRINT_PREPARE_EVENT = "route-map-prepare-print";
export const PRINT_SETTLE_MS = 800;

// One type scale for the whole sheet: every text on the sheet uses one of these sizes and the same font family
export const SHEET_FONT_FAMILY = "Arial, Helvetica, sans-serif";
export const SHEET_FONT = {
  title: "12pt", // sheet title and coordinates
  heading: "8.5pt", // field names and their values
  row: "10pt", // plot area and signature
  note: "7.5pt", // main road line
  fine: "5.5pt", // disclaimer
};

// Map overlay texts in px: boundary texts and the route distance share one size, road names are one step larger
export const MAP_FONT_PX = { fine: 8, small: 9 };
