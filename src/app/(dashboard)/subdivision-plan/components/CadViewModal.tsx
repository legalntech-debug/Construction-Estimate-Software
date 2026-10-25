"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/* =========================================================
   CAD VIEW MODAL
   Full-screen viewer for a drawing: zoom (wheel / pinch /
   buttons), pan (drag), fit-to-screen, optional grid.
   Works on desktop (mouse + keyboard) and on mobile (touch).
   The caller renders the drawing as an <svg className="w-full h-auto">
   child; `aspect` is that drawing's width / height.
========================================================= */

interface CadViewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** width / height of the drawing (used to fit it on screen) */
  aspect: number;
  /** text shown in the status bar */
  status?: string;
  children: React.ReactNode;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 10;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export default function CadViewModal({ open, onClose, title, aspect, status, children }: CadViewModalProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState({ z: 1, tx: 0, ty: 0 });
  const [baseW, setBaseW] = useState(800);
  const [grid, setGrid] = useState(true);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; z: number } | null>(null);
  const dragLast = useRef<{ x: number; y: number } | null>(null);

  // Fit the drawing inside the stage and centre it
  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const bw = Math.max(200, Math.min(w - 24, (h - 24) * aspect));
    setBaseW(bw);
    setView({ z: 1, tx: (w - bw) / 2, ty: Math.max(8, (h - bw / aspect) / 2) });
  }, [aspect]);

  // Lock page scrolling while the viewer is open, close on Esc
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(fit, 30);
    window.addEventListener("resize", fit);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
      clearTimeout(t);
    };
  }, [open, onClose, fit]);

  // Zoom keeping the point (px, py) of the stage fixed
  const zoomAt = useCallback((factor: number, px?: number, py?: number) => {
    const el = stageRef.current;
    const cx = px ?? (el ? el.clientWidth / 2 : 0);
    const cy = py ?? (el ? el.clientHeight / 2 : 0);
    setView((v) => {
      const nz = clampZoom(v.z * factor);
      const k = nz / v.z;
      return { z: nz, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
    });
  }, []);

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) dragLast.current = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), z: view.z };
      dragLast.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      const target = clampZoom(pinchStart.current.z * (dist / pinchStart.current.dist));
      setView((v) => {
        const k = target / v.z;
        return { z: target, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
      });
      return;
    }

    if (pointers.current.size === 1 && dragLast.current) {
      const dx = e.clientX - dragLast.current.x;
      const dy = e.clientY - dragLast.current.y;
      dragLast.current = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 1) {
      const [p] = Array.from(pointers.current.values());
      dragLast.current = { x: p.x, y: p.y };
    } else {
      dragLast.current = null;
    }
  };

  if (!open) return null;

  const btn =
    "border border-white/70 bg-black text-white hover:bg-white hover:text-black px-3 py-1.5 text-xs sm:text-sm font-black cursor-pointer transition select-none";

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white text-black" role="dialog" aria-modal="true" aria-label={title}>
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-black text-white px-3 py-2">
        <div className="font-black text-sm sm:text-base tracking-wide mr-auto">{title}</div>
        <button type="button" className={btn} onClick={() => zoomAt(1 / 1.25)} aria-label="Zoom out">−</button>
        <span className="text-xs font-black w-14 text-center tabular-nums">{Math.round(view.z * 100)}%</span>
        <button type="button" className={btn} onClick={() => zoomAt(1.25)} aria-label="Zoom in">+</button>
        <button type="button" className={btn} onClick={fit}>FIT</button>
        <button type="button" className={btn} onClick={() => setGrid((g) => !g)}>{grid ? "GRID: ON" : "GRID: OFF"}</button>
        <button type="button" className={`${btn} bg-red-700`} onClick={onClose}>✕ CLOSE</button>
      </div>

      {/* stage */}
      <div
        ref={stageRef}
        className="relative flex-1 overflow-hidden bg-white cursor-grab active:cursor-grabbing"
        style={{
          touchAction: "none",
          backgroundImage: grid
            ? "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)"
            : "none",
          backgroundSize: "24px 24px",
        }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={fit}
      >
        <div
          style={{
            width: baseW,
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`,
            transformOrigin: "0 0",
            background: "#ffffff",
            boxShadow: "0 0 0 1px #000",
            pointerEvents: "none",
          }}
        >
          {children}
        </div>
      </div>

      {/* status bar */}
      <div className="bg-black text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 flex flex-wrap gap-x-4 gap-y-1">
        <span>{status || "CAD VIEW"}</span>
        <span className="ml-auto opacity-80">Drag = pan · Wheel / pinch = zoom · Double-click = fit · Esc = close</span>
      </div>
    </div>
  );
}
