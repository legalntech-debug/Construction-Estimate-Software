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
      className="col-span-9 bg-white relative overflow-hidden cursor-crosshair flex items-center justify-center select-none"
    >
      <svg
        className="w-full h-full absolute inset-0 touch-none"
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
            width={20 * cadZoom}
            height={20 * cadZoom}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${20 * cadZoom} 0 L 0 0 0 ${20 * cadZoom}`}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="0.8"
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
            <path d="M 0 2 L 10 5 L 0 8 z" fill="black" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="url(#cad-grid)" />
        {children}
      </svg>
    </div>
  );
}