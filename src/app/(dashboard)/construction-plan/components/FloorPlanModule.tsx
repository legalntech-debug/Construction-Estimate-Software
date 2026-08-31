import React from 'react';
import CadFloorPlansView from './CadFloorPlansView';
import { FloorData } from '../engine/planningTypes';

interface FloorPlanModuleProps {
  floorData?: FloorData;
  processedFloors?: string[];
  itemsPerRow?: number;
  plotGap?: number;
  interFloorGap?: number;
  rowHeightGap?: number;
  baseBuiltUpWidth?: number;
  baseBuiltUpLength?: number;
  baseArea?: number;
  MANUAL_TOWER_DIM_X_OFFSET?: number;
  MANUAL_TOWER_DIM_Y_OFFSET?: number;
  scale?: number;
  cadZoom?: number;
  roadFacingOption?: string;
  boundaryNorth?: string;
  boundarySouth?: string;
  boundaryEast?: string;
  boundaryWest?: string;
  floorBuiltUpAreas?: Record<string, number>;
  getFloorPoints?: (floorName: string) => { x: number; y: number }[];
  [key: string]: any;
}

export const FloorPlanModule: React.FC<FloorPlanModuleProps> = (props) => {
  const { floorData } = props;

  if (!floorData || (!floorData.width && !floorData.length)) {
    return <div className="p-4 text-gray-500">No layout settings provided.</div>;
  }

  const floorWidth = Number(floorData.width) || 30;
  const floorLength = Number(floorData.length) || 50;
  const floorKey = (floorData as Record<string, any>).name || "Ground Floor";
  const calculatedArea = floorWidth * floorLength;

  const formattedFloorDataRecord: Record<string, FloorData> = {
    [floorKey]: floorData,
  };

  const defaultGetFloorPoints = (floorName: string) => {
    const currentData = formattedFloorDataRecord[floorName] || floorData;
    const w = Number(currentData.width) || floorWidth;
    const l = Number(currentData.length) || floorLength;
    const scaleVal = props.scale ?? 5.5;
    const widthPx = w * scaleVal;
    const lengthPx = l * scaleVal;

    return [
      { x: -widthPx / 2, y: -lengthPx / 2 },
      { x: widthPx / 2, y: -lengthPx / 2 },
      { x: widthPx / 2, y: lengthPx / 2 },
      { x: -widthPx / 2, y: lengthPx / 2 },
    ];
  };

  return (
    <div className="w-full h-full min-h-[400px] border rounded-lg bg-white p-4">
      <CadFloorPlansView
        floorData={formattedFloorDataRecord}
        processedFloors={props.processedFloors || [floorKey]}
        itemsPerRow={props.itemsPerRow ?? 2}
        plotGap={props.plotGap ?? 50}
        interFloorGap={props.interFloorGap ?? 30}
        rowHeightGap={props.rowHeightGap ?? 50}
        baseBuiltUpWidth={props.baseBuiltUpWidth ?? floorWidth}
        baseBuiltUpLength={props.baseBuiltUpLength ?? floorLength}
        baseArea={props.baseArea ?? calculatedArea}
        MANUAL_TOWER_DIM_X_OFFSET={props.MANUAL_TOWER_DIM_X_OFFSET ?? 0}
        MANUAL_TOWER_DIM_Y_OFFSET={props.MANUAL_TOWER_DIM_Y_OFFSET ?? 0}
        scale={props.scale ?? 5.5}
        cadZoom={props.cadZoom ?? 1}
        roadFacingOption={props.roadFacingOption || "SOUTH"}
        boundaryNorth={props.boundaryNorth || "OTHER PROPERTY"}
        boundarySouth={props.boundarySouth || "ROAD"}
        boundaryEast={props.boundaryEast || "OTHER PROPERTY"}
        boundaryWest={props.boundaryWest || "OTHER PROPERTY"}
        floorBuiltUpAreas={props.floorBuiltUpAreas || { [floorKey]: calculatedArea }}
        getFloorPoints={props.getFloorPoints || defaultGetFloorPoints}
        {...props}
      />
    </div>
  );
};

export default FloorPlanModule;