import React from "react";
import { formatDim, renderTopWidthDim, renderHeightDim, renderEarthSymbol } from "./CadDimUtils";

interface CadElevationSectionViewProps {
  elevationStartX: number;
  sectionStartX: number;
  elevationHeight: number;
  sectionHeight: number;
  baseBuiltUpWidth: number;
  baseBuiltUpHeight: number;
  scale: number;
  processedFloors: string[];
  floorData: Record<string, any>;
  hasBasement: boolean;
  basementHeight?: number;
  frontMos?: number;
  backMos?: number;
  widthColumnCount: number;
  depthColumnCount: number;
  effectiveMainFloorsCount: number;
  hasTowerSelected: boolean;
  measurementUnit?: "FEET" | "METERS";
  renderBuildingStructure: (startX: number, totalWidth: number, colCount: number, isSection: boolean, showDims: boolean) => React.ReactNode;
  renderRightFloorLabels: (startX: number, width: number) => React.ReactNode;
}

export default function CadElevationSectionView({
  elevationStartX,
  sectionStartX,
  elevationHeight,
  sectionHeight,
  baseBuiltUpWidth,
  baseBuiltUpHeight,
  scale,
  processedFloors,
  floorData,
  hasBasement,
  basementHeight,
  frontMos = 10,
  backMos = 5,
  widthColumnCount,
  depthColumnCount,
  effectiveMainFloorsCount,
  hasTowerSelected,
  measurementUnit,
  renderBuildingStructure,
  renderRightFloorLabels,
}: CadElevationSectionViewProps) {
  const FLOOR_H = 10 * scale;
  const SLAB_H = 0.5 * scale;
  const PLINTH_H = 1.5 * scale;
  const PLINTH_OFFSET = 0.5 * scale;
  const BASEMENT_H = basementHeight !== undefined ? basementHeight : 8 * scale;
  const WALL_THICKNESS = (8 / 12) * scale;

  const bwHeight = 6 * scale; 
  const bwThickness = (8 / 12) * scale; 
  const frontMosPx = (frontMos || 0) * scale;
  const backMosPx = (backMos || 0) * scale;

  const sectionGroundStartX = frontMos > 0 ? (elevationStartX - frontMosPx) : elevationStartX;
  const sectionGroundEndX = backMos > 0 ? (elevationStartX + baseBuiltUpHeight + backMosPx) : (elevationStartX + baseBuiltUpHeight);

  const BALCONY_H = 1.2 * 3.28084 * scale;

  return (
    <g>
      {/* 1. FRONT ELEVATION */}
      <g className="elevation-view">
        {renderTopWidthDim(elevationStartX, baseBuiltUpWidth, -elevationHeight, formatDim(baseBuiltUpWidth, scale, measurementUnit), scale)}

        <rect
          x={elevationStartX}
          y={-elevationHeight}
          width={baseBuiltUpWidth}
          height={elevationHeight}
          stroke="#00aaff"
          strokeWidth="0.6"
          fill="none"
        />

        {renderBuildingStructure(elevationStartX, baseBuiltUpWidth, widthColumnCount, false, true)}

        {processedFloors.map((floor, index) => {
          const isGround = floor.toUpperCase().includes("GROUND");
          const fData = floorData[floor] || { width: baseBuiltUpWidth / scale, length: 30, area: 0, hasBalcony: !isGround };
          
          let accumulatedH = 0;
          for (let i = 0; i < index; i++) {
            accumulatedH += FLOOR_H + SLAB_H;
          }
          const floorTopY = -accumulatedH - FLOOR_H - SLAB_H;

          const hasBalcony = fData.hasBalcony !== undefined ? fData.hasBalcony : !isGround;

          const gateW = (fData.gateWidth || 4) * scale;
          const gateH = (fData.gateHeight || 6) * scale;
          const gateXOffset = elevationStartX + baseBuiltUpWidth / 2 + (fData.gateOffsetX !== undefined ? fData.gateOffsetX * scale : (-baseBuiltUpWidth / 2 + gateW / 2 + 10));

          const stairWidth = 4 * scale;
          const stairTreadCount = 3;

          return (
            <g key={`elev-features-${index}`}>
              {!isGround && hasBalcony && (
                <g transform={`translate(${elevationStartX}, ${floorTopY})`}>
                  <rect
                    x={WALL_THICKNESS}
                    y={FLOOR_H - BALCONY_H}
                    width={baseBuiltUpWidth - (2 * WALL_THICKNESS)}
                    height={BALCONY_H}
                    fill="none"
                    stroke="#059669"
                    strokeWidth="0.8"
                  />
                  <text
                    x={baseBuiltUpWidth / 2}
                    y={FLOOR_H - BALCONY_H / 2}
                    fill="#059669"
                    fontSize="5"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    BALCONY (1.2M HEIGHT)
                  </text>
                </g>
              )}

              {isGround && (
                <g>
                  {/* Front Door / Gate positioned above plinth level (y = 0 upwards) */}
                  <rect
                    x={gateXOffset - gateW / 2}
                    y={-gateH}
                    width={gateW}
                    height={gateH}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="1"
                    strokeDasharray="3 2"
                  />
                  <text
                    x={gateXOffset}
                    y={-gateH / 2}
                    fill="#2563eb"
                    fontSize="5"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    GATE ({(gateW / scale).toFixed(1)}&apos;×{(gateH / scale).toFixed(1)}&apos;)
                  </text>

                  {/* Stairs positioned below plinth level (connecting ground level PLINTH_H to plinth level 0) */}
                  <g transform={`translate(${gateXOffset}, 0)`}>
                    {Array.from({ length: stairTreadCount }).map((_, stepIdx) => {
                      const stepW = stairWidth - (stepIdx * (0.5 * scale));
                      const stepH = PLINTH_H / stairTreadCount;
                      const stepY = (stepIdx + 1) * stepH;
                      return (
                        <rect
                          key={stepIdx}
                          x={-stepW / 2}
                          y={stepY - stepH}
                          width={stepW}
                          height={stepH}
                          fill="#cbd5e1"
                          stroke="#0f172a"
                          strokeWidth="0.4"
                        />
                      );
                    })}
                    <text
                      x="0"
                      y={PLINTH_H + 6}
                      fill="#0f172a"
                      fontSize="4"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      STAIRS (RISE 6&quot;, TREAD 1&apos;)
                    </text>
                  </g>
                </g>
              )}
            </g>
          );
        })}

        <line x1={elevationStartX - PLINTH_OFFSET - 25} y1={0} x2={elevationStartX + baseBuiltUpWidth + PLINTH_OFFSET + 25} y2={0} stroke="#00aaff" strokeWidth="0.6" strokeDasharray="4" />
        <text x={elevationStartX + baseBuiltUpWidth / 2 + 110} y={2} fill="#00aaff" fontSize="7.5" fontWeight="bold" textAnchor="middle">
          PLINTH LEVEL 
        </text>

        <line x1={elevationStartX - 25} y1={PLINTH_H} x2={elevationStartX + baseBuiltUpWidth + 25} y2={PLINTH_H} stroke="#00aaff" strokeWidth="0.6" />
        {renderEarthSymbol(elevationStartX - 25, elevationStartX, PLINTH_H, scale)}
        {renderEarthSymbol(elevationStartX + baseBuiltUpWidth, elevationStartX + baseBuiltUpWidth + 25, PLINTH_H, scale)}

        <text x={elevationStartX + baseBuiltUpWidth / 2 + 130} y={PLINTH_H + 4} fill="#00aaff" fontSize="7.5" fontWeight="bold" textAnchor="middle">
          GROUND LEVEL
        </text>

        {hasBasement && (
          <g>
            <rect x={elevationStartX} y={PLINTH_H} width={baseBuiltUpWidth} height={BASEMENT_H} stroke="#00aaff" strokeWidth="0.5" fill="none" />
            {renderHeightDim(elevationStartX, PLINTH_H, PLINTH_H + BASEMENT_H, formatDim(BASEMENT_H, scale, measurementUnit), 'left', '#00aaff', scale)}
            
            <line 
              x1={elevationStartX + WALL_THICKNESS} 
              y1={PLINTH_H + BASEMENT_H - (3 * scale)} 
              x2={elevationStartX + baseBuiltUpWidth - WALL_THICKNESS} 
              y2={PLINTH_H + BASEMENT_H - (3 * scale)} 
              stroke="#00aaff" 
              strokeWidth="0.4" 
              strokeDasharray="2" 
            />
            
            <line
              x1={elevationStartX + baseBuiltUpWidth}
              y1={PLINTH_H + BASEMENT_H / 2}
              x2={elevationStartX + baseBuiltUpWidth + 6 * scale}
              y2={PLINTH_H + BASEMENT_H / 2}
              stroke="#00aaff"
              strokeWidth="0.5"
              strokeDasharray="2"
            />
            <rect
              x={elevationStartX + baseBuiltUpWidth + 6 * scale}
              y={PLINTH_H + BASEMENT_H / 2 - 7.5}
              width={95}
              height={15}
              fill="#000000"
              fillOpacity="0.92"
              stroke="#00aaff"
              strokeWidth="0.5"
              rx="2"
            />
            <text
              x={elevationStartX + baseBuiltUpWidth + 10 * scale + 35}
              y={PLINTH_H + BASEMENT_H / 2}
              fill="#00aaff"
              fontSize="7"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              BASEMENT ({formatDim(BASEMENT_H, scale, measurementUnit)})
            </text>
          </g>
        )}

        <text x={elevationStartX + baseBuiltUpWidth / 2} y={PLINTH_H + (hasBasement ? BASEMENT_H : 0) + 45} fill="#00aaff" fontSize="10" fontWeight="bold" textAnchor="middle">
          FRONT ELEVATION
        </text>
      </g>

      {/* 2. SECTION VIEW */}
      <g className="section-view" transform={`translate(${sectionStartX - elevationStartX}, 0)`}>
        {renderTopWidthDim(elevationStartX, baseBuiltUpHeight, -sectionHeight, formatDim(baseBuiltUpHeight, scale, measurementUnit), scale)}

        <text x={elevationStartX + (baseBuiltUpHeight / 2)} y={PLINTH_H + (hasBasement ? BASEMENT_H : 0) + 45} fill="#00aaff" fontSize="10" fontWeight="bold" textAnchor="middle">
          SECTION VIEW
        </text>

        <rect
          x={elevationStartX}
          y={-sectionHeight}
          width={baseBuiltUpHeight}
          height={sectionHeight}
          stroke="#00aaff"
          strokeWidth="0.5"
          fill="none"
        />

        {renderBuildingStructure(elevationStartX, baseBuiltUpHeight, depthColumnCount, true, false)}

        {renderRightFloorLabels(elevationStartX, baseBuiltUpHeight)}

        {/* FRONT BOUNDARY WALL & DIMENSION */}
        {frontMos > 0 && (
          <g className="front-boundary-wall">
            <rect
              x={elevationStartX - frontMosPx}
              y={PLINTH_H - bwHeight}
              width={bwThickness}
              height={bwHeight}
              fill="url(#wallHatch)"
              stroke="#00aaff"
              strokeWidth="0.5"
            />
            {renderHeightDim(elevationStartX - frontMosPx, PLINTH_H - bwHeight, PLINTH_H, formatDim(bwHeight, scale, measurementUnit), 'left', '#00aaff', scale)}
            <text x={elevationStartX - frontMosPx + 2} y={PLINTH_H - bwHeight - 3} fill="#00aaff" fontSize="5.5" fontWeight="bold">
              FRONT BOUNDARY WALL ({formatDim(bwHeight, scale, measurementUnit)})
            </text>
          </g>
        )}

        {/* REAR BOUNDARY WALL & DIMENSION */}
        {backMos > 0 && (
          <g className="back-boundary-wall">
            <rect
              x={elevationStartX + baseBuiltUpHeight + backMosPx - bwThickness}
              y={PLINTH_H - bwHeight}
              width={bwThickness}
              height={bwHeight}
              fill="url(#wallHatch)"
              stroke="#00aaff"
              strokeWidth="0.5"
            />
            {renderHeightDim(elevationStartX + baseBuiltUpHeight + backMosPx, PLINTH_H - bwHeight, PLINTH_H, formatDim(bwHeight, scale, measurementUnit), 'right', '#00aaff', scale)}
            <text x={elevationStartX + baseBuiltUpHeight + backMosPx - bwThickness - 30} y={PLINTH_H - bwHeight - 3} fill="#00aaff" fontSize="5.5" fontWeight="bold">
              REAR BOUNDARY WALL ({formatDim(bwHeight, scale, measurementUnit)})
            </text>
          </g>
        )}

        {/* Plinth Level Line */}
        <line x1={elevationStartX} y1={0} x2={elevationStartX + baseBuiltUpHeight} y2={0} stroke="#00aaff" strokeWidth="0.6" strokeDasharray="4" />

        {/* Ground Level Line */}
        <line x1={sectionGroundStartX - 15} y1={PLINTH_H} x2={sectionGroundEndX + 15} y2={PLINTH_H} stroke="#00aaff" strokeWidth="0.6" />
        {renderEarthSymbol(sectionGroundStartX - 15, sectionGroundStartX, PLINTH_H, scale)}
        {renderEarthSymbol(sectionGroundEndX, sectionGroundEndX + 15, PLINTH_H, scale)}

        {hasBasement && (
          <g>
            <rect x={elevationStartX} y={PLINTH_H} width={baseBuiltUpHeight} height={BASEMENT_H} stroke="#00aaff" strokeWidth="0.5" fill="none" />
            <line 
              x1={elevationStartX + WALL_THICKNESS} 
              y1={PLINTH_H + BASEMENT_H - (3 * scale)} 
              x2={elevationStartX + baseBuiltUpHeight - WALL_THICKNESS} 
              y2={PLINTH_H + BASEMENT_H - (3 * scale)} 
              stroke="#00aaff" 
              strokeWidth="0.4" 
              strokeDasharray="2" 
            />
          </g>
        )}
      </g>
    </g>
  );
}