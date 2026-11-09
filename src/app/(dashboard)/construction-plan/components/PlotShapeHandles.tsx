"use client";

import React, { useEffect, useRef } from "react";

type DimKey = "A" | "B" | "C" | "D" | "E" | "F";
type Pt = { x: number; y: number };

/**
 * v28: plot shape ko screen par mouse / touch se adjust karne ke handles.
 *  - QUAD (irregular / trapezoid): 4 corner handles  -> chaaron sides (A,B,C,D) ki length badalti hai
 *  - L: 2 handles  -> (1) andar ka kona = kata hua hissa (B, C, E, F),  (2) bahar ka kona = poora size (A, D)
 * Pan se alag: handle par mouse/touch shuru hone par canvas pan nahi hota (native listeners).
 */
export interface PlotShapeHandlesProps {
  mode: "QUAD" | "L";
  zoom: number;            // currentZoom
  scale: number;           // px per ft (CAD scale)
  /** QUAD: [TL, TR, BR, BL] px (plot ke centre se) */
  corners?: Pt[];
  /** L: base (rear-right notch) geometry + flips + feet->px mapper */
  lGeo?: { W: number; H: number; notchW: number; notchH: number; flipX: boolean; flipY: boolean; toPx: (x: number, y: number) => Pt };
  onChange: (d: Partial<Record<DimKey, number>>) => void;
}

const snap = (v: number) => Math.round(v * 4) / 4;   // 0.25 ft

export default function PlotShapeHandles({ mode, zoom, scale, corners, lGeo, onChange }: PlotShapeHandlesProps) {
  const refs = useRef<Record<string, SVGGElement | null>>({});
  // latest props drag ke dauran bhi mil sakein
  const latest = useRef({ mode, zoom, scale, corners, lGeo, onChange });
  latest.current = { mode, zoom, scale, corners, lGeo, onChange };

  const handles: { key: string; p: Pt; label: string }[] = [];
  if (mode === "QUAD" && corners && corners.length === 4) {
    ["TL", "TR", "BR", "BL"].forEach((k, i) => handles.push({ key: k, p: corners[i], label: k }));
  } else if (mode === "L" && lGeo) {
    const fx = (x: number) => (lGeo.flipX ? lGeo.W - x : x);
    const fy = (y: number) => (lGeo.flipY ? lGeo.H - y : y);
    handles.push({ key: "LNOTCH", p: lGeo.toPx(fx(lGeo.W - lGeo.notchW), fy(lGeo.notchH)), label: "notch" });
    handles.push({ key: "LCORNER", p: lGeo.toPx(fx(lGeo.W), fy(lGeo.H)), label: "size" });
  }

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    (Object.entries(refs.current) as [string, SVGGElement | null][]).forEach(([key, el]) => {
      if (!el) return;
      const stop = (e: Event) => { e.stopPropagation(); };
      const onDown = (e: PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const svg = (el as any).ownerSVGElement as SVGSVGElement | null;
        const ctm = svg?.getScreenCTM();
        const k = ctm ? ctm.a : 1;
        const startX = e.clientX, startY = e.clientY;
        const L = latest.current;
        const pxPerFt = Math.max(0.0001, k * (L.zoom || 1) * L.scale);
        // drag shuru hone par snapshot
        const startCorners = L.corners ? L.corners.map((c) => ({ x: c.x / L.scale, y: c.y / L.scale })) : null;
        const startL = L.lGeo ? { W: L.lGeo.W, H: L.lGeo.H, nw: L.lGeo.notchW, nh: L.lGeo.notchH, flipX: L.lGeo.flipX, flipY: L.lGeo.flipY } : null;
        let raf = 0;
        let last: { x: number; y: number } = { x: startX, y: startY };

        const apply = () => {
          raf = 0;
          const dx = (last.x - startX) / pxPerFt, dy = (last.y - startY) / pxPerFt;   // feet (screen: x right, y down)
          if (latest.current.mode === "QUAD" && startCorners) {
            const idx = ({ TL: 0, TR: 1, BR: 2, BL: 3 } as any)[key] as number;
            const pts = startCorners.map((c, i) => (i === idx ? { x: c.x + dx, y: c.y + dy } : c));
            const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
            const [TL, TR, BR, BL] = pts;
            const mn = (v: number) => Math.max(3, snap(v));
            latest.current.onChange({ A: mn(dist(BL, BR)), B: mn(dist(TL, TR)), C: mn(dist(BL, TL)), D: mn(dist(BR, TR)) });
          } else if (latest.current.mode === "L" && startL) {
            const dxB = startL.flipX ? -dx : dx, dyB = startL.flipY ? -dy : dy;   // base (rear-right notch) frame
            if (key === "LNOTCH") {
              const nw = Math.min(startL.W - 1, Math.max(1, snap(startL.nw - dxB)));
              const nh = Math.min(startL.H - 1, Math.max(1, snap(startL.nh + dyB)));
              latest.current.onChange({ C: snap(startL.W - nw), B: snap(startL.H - nh), E: nw, F: nh });
            } else {
              const W = Math.max(startL.nw + 1, snap(startL.W + dxB));
              const H = Math.max(startL.nh + 1, snap(startL.H + dyB));
              latest.current.onChange({ A: W, D: H, C: snap(W - startL.nw), B: snap(H - startL.nh), E: startL.nw, F: startL.nh });
            }
          }
        };
        const move = (ev: PointerEvent) => {
          ev.preventDefault();
          last = { x: ev.clientX, y: ev.clientY };
          if (!raf) raf = requestAnimationFrame(apply);
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          if (raf) { cancelAnimationFrame(raf); apply(); }
        };
        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
      };
      // canvas ka pan / 2-finger zoom handle par shuru na ho
      el.addEventListener("mousedown", stop);
      el.addEventListener("touchstart", (e) => { e.stopPropagation(); e.preventDefault(); }, { passive: false });
      el.addEventListener("click", stop);
      el.addEventListener("pointerdown", onDown as any);
      cleanups.push(() => {
        el.removeEventListener("mousedown", stop);
        el.removeEventListener("click", stop);
        el.removeEventListener("pointerdown", onDown as any);
      });
    });
    return () => cleanups.forEach((c) => c());
    // handles ki list (key set) badalne par hi dobara bandhna hai
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, handles.map((h) => h.key).join("|")]);

  const r = 9 / Math.max(0.2, zoom);        // screen par ~9px (touch ke liye bada hit area neeche)
  return (
    <g data-shape-handles="1">
      {handles.map((h) => (
        <g key={h.key} ref={(el) => { refs.current[h.key] = el; }} style={{ cursor: "grab", touchAction: "none" }}>
          <circle cx={h.p.x} cy={h.p.y} r={r * 2.4} fill="transparent" />
          <circle cx={h.p.x} cy={h.p.y} r={r} fill="#2563eb" fillOpacity={0.85} stroke="#ffffff" strokeWidth={r * 0.25} />
          <circle cx={h.p.x} cy={h.p.y} r={r * 0.35} fill="#ffffff" />
        </g>
      ))}
    </g>
  );
}
