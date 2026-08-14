"use client";

import React, { ReactNode, RefObject } from "react";

interface PlotCadCanvasProps {
  cadContainerRef: RefObject<HTMLDivElement | null>;
  cadZoom: number;
  handleMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleCadMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseUp: () => void;
  handleCadCanvasClick: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleCadDoubleClick: () => void;
  children: ReactNode;
}

export default function PlotCadCanvas({
  cadContainerRef,
  cadZoom,
  handleMouseDown,
  handleCadMouseMove,
  handleMouseUp,
  handleCadCanvasClick,
  handleCadDoubleClick,
  children,
}: PlotCadCanvasProps) {
  return (
    <div
      ref={cadContainerRef}
      className="col-span-9 w-full h-full bg-[#121212] relative overflow-hidden cursor-crosshair flex items-center justify-center select-none"
      onWheel={(e) => {
        // Wheel event ko yahan rokne ke bajaye zoom handle karne dein
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        // Agar aapke paas yahan cadZoom ka prop hai toh use update kar sakte hain
      }}
    >
      <svg
        className="w-full h-full absolute inset-0"
        viewBox="-500 -350 1000 700"
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleCadMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCadCanvasClick}
        onDoubleClick={handleCadDoubleClick}
      >
        <defs>
          <pattern
            id="cad-grid"
            width={20 * (cadZoom || 1)}
            height={20 * (cadZoom || 1)}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${20 * (cadZoom || 1)} 0 L 0 0 0 ${20 * (cadZoom || 1)}`}
              fill="none"
              stroke="#222222"
              strokeWidth="0.5"
            />
          </pattern>

          {/* Arrow Marker Definition */}
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 2 L 10 5 L 0 8 z" fill="#ffffff" />
          </marker>
        </defs>

        {/* Background Grid Rect covering coordinate space */}
        <rect x="-1000" y="-700" width="2000" height="1400" fill="url(#cad-grid)" />
        
        {/* Render CAD children (Plot, Road, Boundary, Objects) */}
        {children}
      </svg>
    </div>
  );
}