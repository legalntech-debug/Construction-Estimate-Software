// Formatting, text measuring and sizing helpers of the route map preview.
import type { Boundaries, MainRoadSummary } from "./types";

export const pad2 = (n: number) => String(n).padStart(2, "0");

// Coordinates are printed with 6 decimals (about 0.1 m), which is plenty for a location plan
export const formatCoordinate = (value: string) => {
  const n = parseFloat(value);
  return isNaN(n) ? value : n.toFixed(6);
};

// Formats the timestamp like a digital signature stamp: 2026.09.18 15:02:15 +05'30'
export const formatSignatureDate = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} ${sign}${pad2(Math.floor(abs / 60))}'${pad2(abs % 60)}'`;
};

// Engineering style length: 25.5 -> 25'-6"
export const formatFeetInches = (value: string) => {
  const n = parseFloat(value);
  if (!(n > 0)) return "";
  let feet = Math.floor(n);
  let inches = Math.round((n - feet) * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}'-${inches}"`;
};

export const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Text width measurement (canvas) used by the plot sketch layout; falls back to an estimate outside the browser
let measureCtx: CanvasRenderingContext2D | null | undefined;
export const measureText = (text: string, fontPx: number, bold = true) => {
  if (measureCtx === undefined) {
    try {
      measureCtx = document.createElement("canvas").getContext("2d");
    } catch {
      measureCtx = null;
    }
  }
  if (measureCtx) {
    measureCtx.font = `${bold ? 700 : 400} ${fontPx}px Arial, Helvetica, sans-serif`;
    return measureCtx.measureText(text).width;
  }
  return text.length * fontPx * 0.62;
};

// Greedy word wrap by measured width, so long boundary texts break into lines instead of running over other items
export const wrapByWidth = (text: string, maxWidth: number, fontPx: number, maxLines = 6): string[] => {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (!current || measureText(candidate, fontPx) <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.?$/, "…");
    return kept;
  }
  return lines;
};

// Downscales an uploaded image so it fits comfortably into sessionStorage
export const compressImageFile = (file: File, maxWidth = 900): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image file"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas is not available"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

export const averageOf = (a: string, b: string) => {
  const nums = [a, b].map((v) => parseFloat(v)).filter((n) => n > 0);
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
};

// Real-world plot size (feet) used for the box on the route map. Side lengths come from the optional inputs;
// whatever is missing is derived from the plot area (a square when nothing else is known).
export const getPlotSizeFt = (dims: Boundaries, plotArea: string) => {
  const area = parseFloat(String(plotArea).replace(/,/g, "")) || 0;
  const widthFt = averageOf(dims.north, dims.south);
  const heightFt = averageOf(dims.east, dims.west);
  const side = area > 0 ? Math.sqrt(area) : 30;
  const w = widthFt || (heightFt && area > 0 ? area / heightFt : side);
  const h = heightFt || (widthFt && area > 0 ? area / widthFt : side);
  return { widthFt: w, heightFt: h };
};

export const mainRoadText = (s: MainRoadSummary) => {
  const name = (s.name || `${s.highway} road`).toUpperCase();
  return s.on_main_road
    ? `PROPERTY IS ON MAIN ROAD : ${name}`
    : `MAIN ROAD : ${name} - APPROX. ${s.distance_m} METER TOWARDS ${s.direction}`;
};
