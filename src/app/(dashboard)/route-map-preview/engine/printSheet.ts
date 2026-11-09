// Prints the sheet from a clean browser window.
//
// Printing the page itself depends on everything around the sheet (dashboard layout, side menu, styles of other pages
// that were loaded earlier), which is what broke the layout of the maps. Instead the sheet is copied into a new,
// empty window together with the few styles it needs, and that window is printed. The copy is an exact picture of
// the sheet as it is on screen, so the print always looks like the preview. Browser only.
import { LEAFLET_VERSION } from "./constants";
import { MAPLIBRE_CSS } from "./topoStyle";

const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const IMAGE_WAIT_MS = 12000;
const AFTER_LOAD_SETTLE_MS = 300;

// Base styles of the page that the sheet was written for (same rules as the CSS reset of the site), plus the paper size
const BASE_CSS = `
  *, ::before, ::after { box-sizing: border-box; border-width: 0; border-style: solid; }
  html { line-height: 1.5; -webkit-text-size-adjust: 100%; }
  html, body { margin: 0; padding: 0; background: #fff; height: 209.5mm; overflow: hidden; }
  img, svg, canvas { display: block; vertical-align: middle; }
  img { max-width: 100%; height: auto; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: 297mm 210mm; margin: 0; }
  #route-map-sheet { margin: 0 !important; box-shadow: none !important; height: 209.5mm !important; }
  .leaflet-control-zoom { display: none !important; }
  .no-print { display: none !important; }
`;

const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A canvas (the topo map) is copied as a picture of what it shows now. The map stores such a picture in the
// data-snapshot attribute right after it was drawn (a WebGL canvas can read back empty later); otherwise it is read here.
const replaceCanvases = (source: HTMLElement, copy: HTMLElement) => {
  const from = source.querySelectorAll("canvas");
  copy.querySelectorAll("canvas").forEach((canvas, i) => {
    try {
      const original = from[i] as HTMLCanvasElement;
      const img = document.createElement("img");
      img.src = original.getAttribute("data-snapshot") || original.toDataURL("image/png");
      img.className = canvas.className;
      img.setAttribute("style", canvas.getAttribute("style") || "");
      canvas.replaceWith(img);
    } catch (e) {
      console.warn("A map canvas could not be copied for printing:", e);
    }
  });
};

const waitForImages = (doc: Document) =>
  Promise.race([
    Promise.all(
      Array.from(doc.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, IMAGE_WAIT_MS)),
  ]);

interface PrintSheetOptions {
  // Window / file name (the browser proposes it when saving as PDF)
  title: string;
  // Extra CSS needed by the sheet
  css: string;
  // Called before the sheet is copied: the maps repaint and the tiles load
  prepare: () => Promise<void>;
}

// Returns false when the browser blocked the new window (the caller can fall back to printing the page itself).
// Must be called straight from a click: the window is opened before anything is awaited.
export const printSheet = async (sheet: HTMLElement, options: PrintSheetOptions): Promise<boolean> => {
  const win = window.open("", "_blank");
  if (!win) return false;

  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeText(options.title)}</title></head>` +
      `<body style="font:14px Arial,sans-serif;padding:16px">Preparing the sheet for printing…</body></html>`
  );
  win.document.close();

  try {
    await options.prepare();

    const copy = sheet.cloneNode(true) as HTMLElement;
    replaceCanvases(sheet, copy);
    copy.querySelectorAll(".no-print, .leaflet-control-zoom").forEach((el) => el.remove());

    const html =
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeText(options.title)}</title>` +
      `<link rel="stylesheet" href="${LEAFLET_CSS}"><link rel="stylesheet" href="${MAPLIBRE_CSS}">` +
      `<style>${BASE_CSS}${options.css}</style></head><body>${copy.outerHTML}</body></html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();

    await waitForImages(win.document);
    await new Promise((resolve) => setTimeout(resolve, AFTER_LOAD_SETTLE_MS));
    win.focus();
    win.onafterprint = () => win.close();
    win.print();
    return true;
  } catch (e) {
    win.close();
    throw e;
  }
};
