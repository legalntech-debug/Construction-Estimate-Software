// Constants of the route map input form (storage keys, carry-over lists, boundary rows).
import type { Boundaries } from "./formTypes";

// localStorage keys that carry the route map data between the input form and the preview page.
// Dedicated keys are used so this service never collides with the estimate / renovation / remaining-work flows.
export const ROUTE_MAP_STORAGE_KEYS = ["routeMapData", "routeMapPreview"];
// sessionStorage flag set by the preview page when the user comes BACK to this form (Back to Input / browser back)
export const RETURN_TO_FORM_FLAG = "routeMapReturnToForm";
export const ROUTE_MAP_TYPE = "ROUTE MAP";
// Remembers (per browser) whether the optional Client / Representative fields are shown; hidden by default
export const CLIENT_FIELDS_PREF_KEY = "routeMapShowClientFields";
// Action type written to estimate_history when an existing ref no is edited
export const HISTORY_ACTION_TYPE = "ROUTE_MAP_UPDATE";

// Fields that are created on the preview page. When the same record is generated again they are carried over, so a
// route, landmarks or map views drawn earlier are not lost. The location bound ones are dropped when the coordinates change.
export const PREVIEW_OWNED_KEYS = ["base_map"];
export const PREVIEW_LOCATION_BOUND_KEYS = [
  "route_points",
  "route_source",
  "main_road_override",
  "main_road_summary",
  "landmarks",
  "route_view",
  "satellite_view",
  "plot_angle_override",
  "plot_polygon",
];
export const EMPTY_BOUNDARIES: Boundaries = { east: "", west: "", north: "", south: "" };

// Boundary rows rendered in the form, in the order they appear on the location plan
export const BOUNDARY_ROWS: { key: keyof Boundaries; label: string }[] = [
  { key: "east", label: "EAST" },
  { key: "west", label: "WEST" },
  { key: "north", label: "NORTH" },
  { key: "south", label: "SOUTH" },
];
