// Small helpers of the route map input form.
import { RETURN_TO_FORM_FLAG, ROUTE_MAP_STORAGE_KEYS } from "./formConstants";

export const clearSavedRouteMap = () => {
  try {
    ROUTE_MAP_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(RETURN_TO_FORM_FLAG);
  } catch {}
};

// Keeps only characters that can appear in a signed decimal number
export const sanitizeCoordinate = (val: string) => {
  const cleaned = val.replace(/[^0-9.\-]/g, "");
  const negative = cleaned.startsWith("-") ? "-" : "";
  const unsigned = cleaned.replace(/-/g, "");
  const parts = unsigned.split(".");
  return negative + (parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : unsigned);
};

export const isValidLatitude = (val: string) => {
  const n = parseFloat(val);
  return val.trim() !== "" && !isNaN(n) && n >= -90 && n <= 90;
};

export const isValidLongitude = (val: string) => {
  const n = parseFloat(val);
  return val.trim() !== "" && !isNaN(n) && n >= -180 && n <= 180;
};
