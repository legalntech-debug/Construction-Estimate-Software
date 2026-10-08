// planPdf.ts  →  page.tsx ke saath wale folder me rakhein
// npm i html-to-image jspdf
import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";

// Desktop print.css jaisa hi FIXED A4 landscape sheet
export const PAGE_W = 297; // mm
export const PAGE_H = 210; // mm

type Css = Partial<CSSStyleDeclaration>;
const setCss = (el: Element | null, css: Css) => {
  if (el) Object.assign((el as HTMLElement).style, css);
};

const isSafari = () =>
  typeof navigator !== "undefined" &&
  /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

/**
 * #print-grid ka clone ek off-screen A4-landscape sheet (297x210mm) me daalta hai
 * (print.css wali same dimensions), phir usse PDF banata hai.
 * Mobile/desktop dono par output bilkul same aata hai, kyunki live (rotated /
 * responsive) DOM par depend nahi karta.
 */
export async function buildPlanPdf(opts: { isMobile: boolean; title?: string }): Promise<Blob> {
  const grid = document.getElementById("print-grid");
  if (!grid) throw new Error("print-grid not found");

  const stage = document.createElement("div");
  stage.style.cssText =
    "position:fixed;left:-20000px;top:0;pointer-events:none;z-index:-1;background:#fff;";
  const sheet = document.createElement("div");
  sheet.style.cssText = `position:relative;width:${PAGE_W}mm;height:${PAGE_H}mm;background:#fff;overflow:hidden;`;

  const clone = grid.cloneNode(true) as HTMLElement;

  // ---- print.css (desktop block) ka exact layout ----
  setCss(clone, {
    position: "absolute", left: "5mm", top: "5mm",
    width: "287mm", height: "200mm", maxWidth: "none",
    display: "flex", gap: "3mm", margin: "0", padding: "2mm",
    border: "1.5px solid #000", boxSizing: "border-box", overflow: "hidden",
  });
  setCss(clone.querySelector("#main-cad-canvas"), {
    flex: "1 1 auto", minWidth: "0", width: "auto", height: "100%", minHeight: "0",
    margin: "0", padding: "0", border: "0", overflow: "hidden",
    display: "block", position: "relative",
  });
  setCss(clone.querySelector("#cad-svg-wrap"), {
    position: "relative", display: "block", width: "100%", height: "100%", minHeight: "0",
  });
  setCss(clone.querySelector("#cad-svg"), {
    position: "absolute", left: "0", top: "0", width: "100%", height: "100%",
    maxHeight: "none", aspectRatio: "auto", display: "block",
  });
  setCss(clone.querySelector("#main-sidebar"), {
    flex: "0 0 66mm", width: "66mm", height: "100%", minHeight: "0",
    margin: "0", padding: "2mm", border: "0", borderLeft: "1.5px solid #000",
    boxSizing: "border-box", overflow: "hidden", fontSize: "9px", position: "relative",
  });

  // Tailwind "print:hidden" sirf real print me kaam karta hai -> yahan manually hide
  clone.querySelectorAll('[class*="print:hidden"], button').forEach((el) => setCss(el, { display: "none" }));
  clone.querySelectorAll("svg text[opacity]").forEach((el) => ((el as SVGElement).style.opacity = "0.08"));

  sheet.appendChild(clone);
  stage.appendChild(sheet);
  document.body.appendChild(stage);

  try {
    if ((document as any).fonts?.ready) await (document as any).fonts.ready;

    const renderOpts = {
      pixelRatio: opts.isMobile ? 2.5 : 3, // mobile par memory bachane ke liye thoda kam
      backgroundColor: "#ffffff",
      cacheBust: true,
      width: sheet.offsetWidth,
      height: sheet.offsetHeight,
    };
    // Safari/iOS par pehla render aksar blank/adhura aata hai -> warm-up
    if (isSafari()) await toCanvas(sheet, renderOpts);
    const canvas = await toCanvas(sheet, renderOpts);

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [PAGE_W, PAGE_H], compress: true });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, PAGE_W, PAGE_H, undefined, "FAST");
    if (opts.title) pdf.setProperties({ title: opts.title });
    return pdf.output("blob");
  } finally {
    stage.remove();
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Native share sheet (WhatsApp / Gmail / Drive ...) me PDF file ke saath. */
export async function sharePdf(
  blob: Blob, filename: string, title: string, text: string
): Promise<"shared" | "cancelled" | "unsupported"> {
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text });
      return "shared";
    } catch (e: any) {
      if (e?.name === "AbortError") return "cancelled";
      return "unsupported";
    }
  }
  return "unsupported";
}
