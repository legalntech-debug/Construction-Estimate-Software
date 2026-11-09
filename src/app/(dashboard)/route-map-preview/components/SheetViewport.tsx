"use client";
// Shows the fixed size A4 sheet at a size that fits the screen. On a phone or a small window the sheet is scaled down
// to the width of the screen ("fit"); "actual" shows it at 100 % and the area scrolls sideways. The sheet itself is
// never changed (it keeps its millimetre size), so printing and the map coordinates stay exact.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const MM_TO_PX = 96 / 25.4;
const SHEET_WIDTH_PX = 297 * MM_TO_PX;
const SHEET_HEIGHT_PX = 210 * MM_TO_PX;

export type ViewMode = "fit" | "actual";

export default function SheetViewport({ mode, children }: { mode: ViewMode; children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => setHostWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = mode === "fit" && hostWidth > 0 ? Math.min(1, hostWidth / SHEET_WIDTH_PX) : 1;

  return (
    <div ref={hostRef} className="w-full overflow-x-auto">
      <div style={{ width: SHEET_WIDTH_PX * scale, height: SHEET_HEIGHT_PX * scale, margin: "0 auto" }}>
        <div
          style={{
            width: SHEET_WIDTH_PX,
            height: SHEET_HEIGHT_PX,
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
