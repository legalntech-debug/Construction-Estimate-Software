import React, { useState, useEffect, useRef } from "react";
import PlotCadCanvas from "./PlotCadCanvas";
import PlotPolygonRenderer from "./PlotPolygonRenderer";
import BoundaryLabels from "./BoundaryLabels";
import RoadRenderer from "./RoadRenderer";
import { PlotDimensions, FloorData, FloorRoom, FloorPlanningSettings, PlanningMode } from "../engine/planningTypes";
import { getRoadOrientation } from "../engine/roadOrientation";
import CadFloorElevationRenderer from "./CadFloorElevationRenderer";
import CadToolbarSection from "./CadToolbarSection";
import CadSidebarDimensions from "./CadSidebarDimensions";

export interface CadObject {
  id: string;
  type: string;
  points: { x: number; y: number }[];
  rotation?: number;
  text?: string;
}

type CadTool = 
  | "SELECT" | "LINE" | "PLINE" | "RECTANGLE" | "OFFSET" 
  | "MOVE" | "COPY" | "ROTATE" | "DELETE" | "DIMENSION" | "TEXT" | "HATCH";

interface CadModalViewProps {
  isCadModalOpen: boolean;
  setIsCadModalOpen: (open: boolean) => void;
  plotShape: string;
  roadFacingOption: string;
  cadZoom: number;
  setCadZoom: React.Dispatch<React.SetStateAction<number>>;
  cadTool: CadTool;
  setCadCommand: (tool: CadTool) => void;
  orthMode: boolean;
  setOrthMode: React.Dispatch<React.SetStateAction<boolean>>;
  osnapMode: boolean;
  setOsnapMode: React.Dispatch<React.SetStateAction<boolean>>;
  undoLastCadAction: () => void;
  copySelectedCadObjects: () => void;
  rotateSelectedCadObjects: (angle: number) => void;
  deleteSelectedCadObjects: () => void;
  cadRotation: number;
  setCadRotation: (val: number) => void;
  cadText: string;
  setCadText: (val: string) => void;
  cadContainerRef: React.RefObject<HTMLDivElement | null>;
  handleMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleCadMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseUp: () => void;
  handleCadCanvasClick: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleCadDoubleClick: () => void;
  panOffset: { x: number; y: number };
  setPanOffset?: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  plotDimensions: PlotDimensions;
  updateDimensionPart: (side: keyof PlotDimensions, field: "ft" | "in", val: number) => void;
  measurementUnit: "FEET" | "METERS";
  plotArea: number;
  isMultiDimShape: boolean;
  boundaryNorth: string;
  setBoundaryNorth: (val: string) => void;
  boundarySouth: string;
  setBoundarySouth: (val: string) => void;
  boundaryEast: string;
  setBoundaryEast: (val: string) => void;
  boundaryWest: string;
  setBoundaryWest: (val: string) => void;
  cadObjects: CadObject[];
  selectedCadObjectIds: string[];
  toggleCadSelection: (id: string) => void;
  activeDrawingStart: { x: number; y: number } | null;
  mouseCurrentPoint: { x: number; y: number } | null;
  
  // 4 Directional Road Width Props
  roadWidthNorth?: number;
  roadWidthSouth?: number;
  roadWidthEast?: number;
  roadWidthWest?: number;
  setRoadWidthNorth?: (val: number) => void;
  setRoadWidthSouth?: (val: number) => void;
  setRoadWidthEast?: (val: number) => void;
  setRoadWidthWest?: (val: number) => void;

  frontMos?: number;
  rearMos?: number;
  leftMos?: number;
  rightMos?: number;
  setFrontMos?: (val: number) => void;
  setRearMos?: (val: number) => void;
  setLeftMos?: (val: number) => void;
  setRightMos?: (val: number) => void;
  totalFloors?: number;
  selectedFloors?: string[];
  floorBuiltUpAreas?: { [key: string]: number };
  floorData?: Record<string, FloorData | any>;

  // Newly Added Floor & Room Planning Props
  floorRooms?: Record<string, Record<string, FloorRoom>>;
  floorSettings?: Record<string, FloorPlanningSettings>;
  floorBhkConfig?: Record<string, string>;
  planningMode?: PlanningMode;
}

export default function CadModalView({
  isCadModalOpen,
  setIsCadModalOpen,
  plotShape,
  roadFacingOption,
  cadZoom,
  setCadZoom,
  cadTool,
  setCadCommand,
  orthMode,
  setOrthMode,
  osnapMode,
  setOsnapMode,
  undoLastCadAction,
  copySelectedCadObjects,
  rotateSelectedCadObjects,
  deleteSelectedCadObjects,
  cadRotation,
  setCadRotation,
  cadText,
  setCadText,
  cadContainerRef,
  handleMouseDown,
  handleCadMouseMove,
  handleMouseUp,
  handleCadCanvasClick,
  handleCadDoubleClick,
  panOffset,
  setPanOffset,
  plotDimensions,
  updateDimensionPart,
  measurementUnit,
  plotArea,
  isMultiDimShape,
  boundaryNorth,
  setBoundaryNorth,
  boundarySouth,
  setBoundarySouth,
  boundaryEast,
  setBoundaryEast,
  boundaryWest,
  setBoundaryWest,
  cadObjects,
  selectedCadObjectIds,
  toggleCadSelection,
  
  roadWidthNorth = 15,
  roadWidthSouth = 15,
  roadWidthEast = 15,
  roadWidthWest = 15,
  setRoadWidthNorth,
  setRoadWidthSouth,
  setRoadWidthEast,
  setRoadWidthWest,

  frontMos = 0,
  rearMos = 0,
  leftMos = 0,
  rightMos = 0,
  setFrontMos,
  setRearMos,
  setLeftMos,
  setRightMos,
  totalFloors = 1,
  selectedFloors = [],
  floorBuiltUpAreas = {},
  floorData = {},
  floorRooms,
  floorSettings,
  floorBhkConfig,
  planningMode,
}: CadModalViewProps) {
  
  const [sideAngles, setSideAngles] = useState<Record<string, number>>({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 });
  const [mosAngles, setMosAngles] = useState<Record<string, number>>({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 });
  const [sideSlant, setSideSlant] = useState<Record<string, "MID" | "LEFT" | "RIGHT">>({ A: "MID", B: "MID", C: "MID", D: "MID", E: "MID", F: "MID" });
  
  const [localNorthRoad, setLocalNorthRoad] = useState<number>(roadWidthNorth ?? 15);
  const [localSouthRoad, setLocalSouthRoad] = useState<number>(roadWidthSouth ?? 15);
  const [localEastRoad, setLocalEastRoad] = useState<number>(roadWidthEast ?? 15);
  const [localWestRoad, setLocalWestRoad] = useState<number>(roadWidthWest ?? 15);
  

  useEffect(() => {
    if (roadWidthNorth !== undefined) setLocalNorthRoad(roadWidthNorth);
  }, [roadWidthNorth]);
  useEffect(() => {
    if (roadWidthSouth !== undefined) setLocalSouthRoad(roadWidthSouth);
  }, [roadWidthSouth]);
  useEffect(() => {
    if (roadWidthEast !== undefined) setLocalEastRoad(roadWidthEast);
  }, [roadWidthEast]);
  useEffect(() => {
    if (roadWidthWest !== undefined) setLocalWestRoad(roadWidthWest);
  }, [roadWidthWest]);

  const currentNorthRoad = localNorthRoad;
  const currentSouthRoad = localSouthRoad;
  const currentEastRoad = localEastRoad;
  const currentWestRoad = localWestRoad;

  const roadOptUpper = (roadFacingOption || "").toUpperCase();
  const hasNorthRoad = roadOptUpper.includes("NORTH") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI") || roadOptUpper.includes("CORNER");
  const hasSouthRoad = roadOptUpper.includes("SOUTH") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI");
  const hasEastRoad = roadOptUpper.includes("EAST") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI") || roadOptUpper.includes("CORNER");
  const hasWestRoad = roadOptUpper.includes("WEST") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI");

  let activeNorth = hasNorthRoad;
  let activeSouth = hasSouthRoad;
  let activeEast = hasEastRoad;
  let activeWest = hasWestRoad;

  if (roadOptUpper.includes("CORNER")) {
    activeNorth = roadOptUpper.includes("NORTH");
    activeSouth = roadOptUpper.includes("SOUTH");
    activeEast = roadOptUpper.includes("EAST");
    activeWest = roadOptUpper.includes("WEST");
  } else if (!roadOptUpper.includes("NORTH") && !roadOptUpper.includes("SOUTH") && !roadOptUpper.includes("EAST") && !roadOptUpper.includes("WEST") && !roadOptUpper.includes("ALL") && !roadOptUpper.includes("MULTI")) {
    activeSouth = true; 
    activeNorth = false;
    activeEast = false;
    activeWest = false;
  }
  
  const [editModeToggle, setEditModeToggle] = useState<"PLOT" | "MOS">("PLOT");
  const [localPan, setLocalPan] = useState<{ x: number; y: number }>(panOffset || { x: 0, y: 0 });

  useEffect(() => {
    if (panOffset) {
      setLocalPan(panOffset);
    }
  }, [panOffset]);

  const updatePan = (updater: (prev: { x: number; y: number }) => { x: number; y: number }) => {
    const next = updater(localPan);
    setLocalPan(next);
    if (setPanOffset) {
      setPanOffset(next);
    }
  };

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  const [sideMos, setSideMos] = useState<Record<string, number>>({ 
    A: frontMos || 0, 
    B: rearMos || 0, 
    C: leftMos || 0, 
    D: rightMos || 0, 
    E: 0, 
    F: 0 
  });

  useEffect(() => {
    setSideMos({
      A: frontMos || 0,
      B: rearMos || 0,
      C: leftMos || 0,
      D: rightMos || 0,
      E: 0,
      F: 0,
    });
  }, [frontMos, rearMos, leftMos, rightMos]);

  const currentZoom = cadZoom && cadZoom > 0.1 ? cadZoom : 1.2;

  useEffect(() => {
    const element = canvasWrapperRef.current;
    if (!element) return;

    let initialTouchDistance = 0;
    let initialZoom = 1;
    let touchStartPos: { x: number; y: number } | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        touchStartPos = null;
        initialTouchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialZoom = currentZoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && touchStartPos) {
        e.preventDefault();
        const dx = e.touches[0].clientX - touchStartPos.x;
        const dy = e.touches[0].clientY - touchStartPos.y;
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        updatePan((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
      } else if (e.touches.length === 2 && initialTouchDistance > 0) {
        e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = currentDistance / initialTouchDistance;
        const newZoom = Math.min(4, Math.max(0.15, initialZoom * scale));
        setCadZoom(newZoom);
      }
    };

    const handleTouchEnd = () => {
      touchStartPos = null;
      initialTouchDistance = 0;
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [currentZoom, setCadZoom]);

  const handleMosChange = (side: string, val: number) => {
    setSideMos((prev) => ({ ...prev, [side]: val }));
    if (side === "A" && setFrontMos) setFrontMos(val);
    if (side === "B" && setRearMos) setRearMos(val);
    if (side === "C" && setLeftMos) setLeftMos(val);
    if (side === "D" && setRightMos) setRightMos(val);
  };
  
  const handleNorthRoadChange = (val: number) => {
    const cleanVal = isNaN(val) ? 15 : Math.max(1, val);
    setLocalNorthRoad(cleanVal);
    if (setRoadWidthNorth) setRoadWidthNorth(cleanVal);
  };
  const handleSouthRoadChange = (val: number) => {
    const cleanVal = isNaN(val) ? 15 : Math.max(1, val);
    setLocalSouthRoad(cleanVal);
    if (setRoadWidthSouth) setRoadWidthSouth(cleanVal);
  };
  const handleEastRoadChange = (val: number) => {
    const cleanVal = isNaN(val) ? 15 : Math.max(1, val);
    setLocalEastRoad(cleanVal);
    if (setRoadWidthEast) setRoadWidthEast(cleanVal);
  };
  const handleWestRoadChange = (val: number) => {
    const cleanVal = isNaN(val) ? 15 : Math.max(1, val);
    setLocalWestRoad(cleanVal);
    if (setRoadWidthWest) setRoadWidthWest(cleanVal);
  };

  useEffect(() => {
    if (isCadModalOpen) {
      console.log("--- CAD MODAL DATA CHECK ---");
      console.log("1. Plot Dimensions:", plotDimensions);
      console.log("2. Selected Floors:", selectedFloors);
      console.log("3. Floor Data:", floorData);
      console.log("4. Road Facing:", roadFacingOption);
      console.log("5. Floor Rooms:", floorRooms);
      console.log("6. Planning Mode:", planningMode);
    }
  }, [isCadModalOpen, plotDimensions, selectedFloors, floorData, roadFacingOption, floorRooms, planningMode]);

  if (!isCadModalOpen) return null;

  const isSimpleRect = (plotShape === "RECTANGLE" || plotShape === "SQUARE") && !isMultiDimShape;

  const plotDims = plotDimensions as Record<string, any>;
  let dimA = Number(plotDims?.A) || 20;
  let dimB = isSimpleRect ? dimA : (Number(plotDims?.B) || dimA);
  let dimC = Number(plotDims?.C) || 50;
  let dimD = isSimpleRect ? dimC : (Number(plotDims?.D) || dimC);

  const normalizedFloorData = Object.entries(floorData || {}).reduce((acc, [floorKey, fData]) => {
    if (!fData) return acc;
    let fW = Number(fData.width) || dimA;
    let fL = Number(fData.length) || dimC;
    
    if (floorKey.toUpperCase().includes("GROUND") && fW > fL && fL <= dimA) {
      const temp = fW;
      fW = fL;
      fL = temp;
    }
    acc[floorKey] = {
      ...fData,
      width: fW,
      length: fL,
      area: Number(fData.area) || (fW * fL),
    };
    return acc;
  }, {} as Record<string, FloorData | any>);

  const scale = 5.5; 
  const bottomWidth = dimA * scale;
  const topWidth = dimB * scale;
  const heightLeft = dimC * scale;
  const heightRight = dimD * scale;

  let diffWidth = topWidth - bottomWidth;
  let shiftXLeft = 0;
  let shiftXRight = 0;

  const slantB = sideSlant.B || "MID";
  if (slantB === "LEFT") {
    shiftXLeft = -diffWidth;
    shiftXRight = 0;
  } else if (slantB === "RIGHT") {
    shiftXLeft = 0;
    shiftXRight = diffWidth;
  } else {
    shiftXLeft = -diffWidth / 2;
    shiftXRight = diffWidth / 2;
  }

  let pBottomLeft = { x: -bottomWidth / 2, y: heightLeft / 2 };
  let pBottomRight = { x: bottomWidth / 2, y: heightLeft / 2 };
  let pTopLeft = { x: -bottomWidth / 2 + shiftXLeft, y: -heightLeft / 2 };
  let pTopRight = { x: bottomWidth / 2 + shiftXRight, y: -heightRight / 2 };

  const angleA = isSimpleRect ? 0 : ((sideAngles.A || 0) * Math.PI) / 180;
  const angleB = isSimpleRect ? 0 : ((sideAngles.B || 0) * Math.PI) / 180;
  const angleC = isSimpleRect ? 0 : ((sideAngles.C || 0) * Math.PI) / 180;
  const angleD = isSimpleRect ? 0 : ((sideAngles.D || 0) * Math.PI) / 180;

  if (angleA !== 0) {
    const dx = pBottomRight.x - pBottomLeft.x;
    const dy = pBottomRight.y - pBottomLeft.y;
    const cos = Math.cos(angleA);
    const sin = Math.sin(angleA);
    pBottomRight = {
      x: pBottomLeft.x + (dx * cos - dy * sin),
      y: pBottomLeft.y + (dx * sin + dy * cos),
    };
  }

  if (angleB !== 0) {
    const dx = pTopRight.x - pTopLeft.x;
    const dy = pTopRight.y - pTopLeft.y;
    const cos = Math.cos(angleB);
    const sin = Math.sin(angleB);
    pTopRight = {
      x: pTopLeft.x + (dx * cos - dy * sin),
      y: pTopLeft.y + (dx * sin + dy * cos),
    };
  }

  if (angleC !== 0) {
    const cos = Math.cos(angleC);
    const sin = Math.sin(angleC);
    const dx = pTopLeft.x - pBottomLeft.x;
    const dy = pTopLeft.y - pBottomLeft.y;
    pTopLeft = {
      x: pBottomLeft.x + (dx * cos - dy * sin),
      y: pBottomLeft.y + (dx * sin + dy * cos),
    };
  }

  if (angleD !== 0) {
    const cos = Math.cos(angleD);
    const sin = Math.sin(angleD);
    const dx = pTopRight.x - pBottomRight.x;
    const dy = pTopRight.y - pBottomRight.y;
    pTopRight = {
      x: pBottomRight.x + (dx * cos - dy * sin),
      y: pBottomRight.y + (dx * sin + dy * cos),
    };
  }

  const actualLenA = Math.hypot(pBottomRight.x - pBottomLeft.x, pBottomRight.y - pBottomLeft.y) / scale;
  const actualLenB = Math.hypot(pTopRight.x - pTopLeft.x, pTopRight.y - pTopLeft.y) / scale;
  const actualLenC = Math.hypot(pTopLeft.x - pBottomLeft.x, pTopLeft.y - pBottomLeft.y) / scale;
  const actualLenD = Math.hypot(pTopRight.x - pBottomRight.x, pTopRight.y - pBottomRight.y) / scale;

  const polyPoints = [pTopLeft, pTopRight, pBottomRight, pBottomLeft];
  let calculatedArea = 0;
  for (let i = 0; i < polyPoints.length; i++) {
    const j = (i + 1) % polyPoints.length;
    calculatedArea += (polyPoints[i].x / scale) * (polyPoints[j].y / scale);
    calculatedArea -= (polyPoints[j].x / scale) * (polyPoints[i].y / scale);
  }
  calculatedArea = Math.abs(calculatedArea) / 2;

  const displayShapeName = isMultiDimShape ? "IRREGULAR / CUSTOM SHAPE" : (plotShape || "RECTANGLE");

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-2 flex flex-col uppercase font-sans">
      <div className="bg-white w-full h-full border-2 border-black flex flex-col relative overflow-hidden">
        {/* Top Header Bar */}
        <div className="bg-slate-950 text-white p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-yellow-400 text-black px-1.5 py-0.5 text-[10px] font-black rounded-sm">
              SHAPE: {displayShapeName}
            </span>
            <div className="font-black text-xs">
              CONSTRUCTION CAD | ROAD: {roadFacingOption || "NOT SPECIFIED"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white text-black px-2 py-0.5 text-[10px] font-black border border-black">
              <span>ZOOM: {Math.round(currentZoom * 100)}%</span>
              <button type="button" onClick={() => setCadZoom((prev) => Math.max(0.2, (prev || 1) - 0.1))} className="px-1 font-bold hover:bg-gray-200 cursor-pointer">-</button>
              <button type="button" onClick={() => setCadZoom((prev) => Math.min(3, (prev || 1) + 0.1))} className="px-1 font-bold hover:bg-gray-200 cursor-pointer">+</button>
              <button type="button" onClick={() => { setCadZoom(1.2); updatePan(() => ({ x: 0, y: 0 })); }} className="px-1 font-bold hover:bg-gray-200 text-red-600 cursor-pointer">RESET</button>
            </div>
            <button type="button" onClick={() => setIsCadModalOpen(false)} className="bg-red-600 px-4 py-1 font-black text-xs cursor-pointer text-white">CLOSE</button>
          </div>
        </div>

        {/* CAD Toolbar Component */}
        <CadToolbarSection
          cadTool={cadTool}
          setCadCommand={setCadCommand}
          orthMode={orthMode}
          setOrthMode={setOrthMode}
          osnapMode={osnapMode}
          setOsnapMode={setOsnapMode}
          undoLastCadAction={undoLastCadAction}
          copySelectedCadObjects={copySelectedCadObjects}
          rotateSelectedCadObjects={rotateSelectedCadObjects}
          deleteSelectedCadObjects={deleteSelectedCadObjects}
          cadRotation={cadRotation}
          setCadRotation={setCadRotation}
          cadText={cadText}
          setCadText={setCadText}
        />

        {/* CAD Canvas Area with Right Sidebar */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden relative">
          <div 
            ref={canvasWrapperRef}
            className="col-span-9 h-full relative overflow-hidden bg-white cursor-grab active:cursor-grabbing"
            onWheel={(e) => {
              e.preventDefault();
              const zoomFactor = Math.exp(-e.deltaY * 0.0015);
              const oldZoom = currentZoom;
              const newZoom = Math.min(4, Math.max(0.15, oldZoom * zoomFactor));
              setCadZoom(newZoom);

              const element = canvasWrapperRef.current;
              if (element) {
                const rect = element.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const scaleRatio = newZoom / oldZoom;
                const baseOffX = 380;
                const baseOffY = 150;
                const currentPan = localPan || { x: 0, y: 0 };

                updatePan(() => ({
                  x: currentPan.x + (mouseX - baseOffX - currentPan.x) * (1 - scaleRatio),
                  y: currentPan.y + (mouseY - baseOffY - currentPan.y) * (1 - scaleRatio),
                }));
              }
            }}
            onMouseDown={(e) => {
              if (e.button === 0) {
                isDraggingRef.current = true;
                dragStartRef.current = { x: e.clientX, y: e.clientY };
              }
            }}
            onMouseMove={(e) => {
              if (!isDraggingRef.current) return;
              const dx = e.clientX - dragStartRef.current.x;
              const dy = e.clientY - dragStartRef.current.y;
              dragStartRef.current = { x: e.clientX, y: e.clientY };

              updatePan((prev) => ({
                x: prev.x + dx,
                y: prev.y + dy,
              }));
            }}
            onMouseUp={() => {
              isDraggingRef.current = false;
            }}
            onMouseLeave={() => {
              isDraggingRef.current = false;
            }}
          >
            <PlotCadCanvas
              cadContainerRef={cadContainerRef}
              cadZoom={currentZoom}
              handleMouseDown={handleMouseDown}
              handleCadMouseMove={handleCadMouseMove}
              handleMouseUp={handleMouseUp}
              handleCadCanvasClick={handleCadCanvasClick}
              handleCadDoubleClick={handleCadDoubleClick}
            >
              {/* North Badge Direction */}
              {(() => {
                const opt = (roadFacingOption || "1 SIDE ROAD (SOUTH)").toUpperCase();
                let northArrow = "↑";
                if (opt.includes("NORTH")) northArrow = "↓";
                else if (opt.includes("EAST")) northArrow = "→";
                else if (opt.includes("WEST")) northArrow = "←";
                return (
                  <div className="absolute top-2 left-2 z-10 bg-yellow-300 border border-black px-1.5 py-0.5 text-[8px] font-black flex items-center gap-1 shadow-sm pointer-events-none">
                    <span>NORTH {northArrow}</span>
                  </div>
                );
              })()}

              {/* Master Group Render */}
              {(() => {
                const correctedPoints = [pTopLeft, pTopRight, pBottomRight, pBottomLeft];
                const xs = correctedPoints.map(p => p.x);
                const ys = correctedPoints.map(p => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;

                const mosFront = (sideMos.A || 0) * scale;
                const mosBack = (sideMos.B || 0) * scale;
                const mosLeft = (sideMos.C || 0) * scale;
                const mosRight = (sideMos.D || 0) * scale;

                const mosAVal = Number(sideMos.A) || 0;
                const mosBVal = Number(sideMos.B) || 0;
                const mosCVal = Number(sideMos.C) || 0;
                const mosDVal = Number(sideMos.D) || 0;

                const isFullPlot = (mosAVal === 0 && mosBVal === 0 && mosCVal === 0 && mosDVal === 0);

                let bTopLeft = { x: pTopLeft.x + mosLeft, y: pTopLeft.y + mosBack };
                let bTopRight = { x: pTopRight.x - mosRight, y: pTopRight.y + mosBack };
                let bBottomRight = { x: pBottomRight.x - mosRight, y: pBottomRight.y - mosFront };
                let bBottomLeft = { x: pBottomLeft.x + mosLeft, y: pBottomLeft.y - mosFront };

                const mAngleA = isSimpleRect ? 0 : ((mosAngles.A || 0) * Math.PI) / 180;
                const mAngleB = isSimpleRect ? 0 : ((mosAngles.B || 0) * Math.PI) / 180;
                const mAngleC = isSimpleRect ? 0 : ((mosAngles.C || 0) * Math.PI) / 180;
                const mAngleD = isSimpleRect ? 0 : ((mosAngles.D || 0) * Math.PI) / 180;

                if (mAngleA !== 0) {
                  const dx = bBottomRight.x - bBottomLeft.x;
                  const dy = bBottomRight.y - bBottomLeft.y;
                  const cos = Math.cos(mAngleA);
                  const sin = Math.sin(mAngleA);
                  bBottomRight = {
                    x: bBottomLeft.x + (dx * cos - dy * sin),
                    y: bBottomLeft.y + (dx * sin + dy * cos),
                  };
                }
                if (mAngleB !== 0) {
                  const dx = bTopRight.x - bTopLeft.x;
                  const dy = bTopRight.y - bTopLeft.y;
                  const cos = Math.cos(mAngleB);
                  const sin = Math.sin(mAngleB);
                  bTopRight = {
                    x: bTopLeft.x + (dx * cos - dy * sin),
                    y: bTopLeft.y + (dx * sin + dy * cos),
                  };
                }
                if (mAngleC !== 0) {
                  const cos = Math.cos(mAngleC);
                  const sin = Math.sin(mAngleC);
                  const dx = bTopLeft.x - bBottomLeft.x;
                  const dy = bTopLeft.y - bBottomLeft.y;
                  bTopLeft = {
                    x: bBottomLeft.x + (dx * cos - dy * sin),
                    y: bBottomLeft.y + (dx * sin + dy * cos),
                  };
                }
                if (mAngleD !== 0) {
                  const cos = Math.cos(mAngleD);
                  const sin = Math.sin(mAngleD);
                  const dx = bTopRight.x - bBottomRight.x;
                  const dy = bTopRight.y - bBottomRight.y;
                  bTopRight = {
                    x: bBottomRight.x + (dx * cos - dy * sin),
                    y: bBottomRight.y + (dx * sin + dy * cos),
                  };
                }

                const builtUpPoints = isFullPlot ? correctedPoints : [bTopLeft, bTopRight, bBottomRight, bBottomLeft];

                const builtUpCenterX = (builtUpPoints.reduce((sum, p) => sum + p.x, 0)) / builtUpPoints.length;
                const builtUpCenterY = (builtUpPoints.reduce((sum, p) => sum + p.y, 0)) / builtUpPoints.length;
                const builtUpWidth = Math.abs(bTopRight.x - bTopLeft.x);

                const hatchLines = [];
                const step = 8;
                const bX = builtUpPoints.map(p => p.x);
                const bY = builtUpPoints.map(p => p.y);
                const minBX = Math.min(...bX);
                const maxBX = Math.max(...bX);
                const minBY = Math.min(...bY);
                const maxBY = Math.max(...bY);

                for (let d = minBX - (maxBY - minBY); d < maxBX + (maxBY - minBY); d += step) {
                  const x1 = d;
                  const y1 = minBY;
                  const x2 = d + (maxBY - minBY);
                  const y2 = maxBY;
                  hatchLines.push({ x1, y1, x2, y2 });
                }

                return (
                  <g transform={`translate(380, 150) translate(${localPan?.x || 0}, ${localPan?.y || 0}) scale(${currentZoom})`}>
                    <PlotPolygonRenderer
                      plotPolygon={correctedPoints}
                      proposedSitePolygon={[]}
                      cadZoom={currentZoom}
                      isSelected={false}
                      handlePolygonClick={() => {}}
                    />

                    {/* RENDER SELECTED FLOORS ELEVATION SIDE-BY-SIDE WITH PRESERVED NORMALIZED FLOOR DATA */}
                    <CadFloorElevationRenderer
                      totalFloors={totalFloors}
                      builtUpPoints={builtUpPoints}
                      scale={scale}
                      selectedFloors={selectedFloors}
                      roadWidth={(() => {
                        const main = getRoadOrientation(roadFacingOption || "1 SIDE ROAD (SOUTH)").mainRoad;
                        if (main === "NORTH") return currentNorthRoad;
                        if (main === "EAST") return currentEastRoad;
                        if (main === "WEST") return currentWestRoad;
                        return currentSouthRoad;
                      })()}
                      roadFacingOption={roadFacingOption}
                      floorBuiltUpAreas={floorBuiltUpAreas}
                      floorData={normalizedFloorData}
                      frontMos={sideMos.A ?? frontMos}
                      backMos={sideMos.B ?? rearMos}
                      measurementUnit={measurementUnit}
                    />

                    <g>
                      <defs>
                        <clipPath id="builtUpClip">
                          <polygon points={builtUpPoints.map(p => `${p.x},${p.y}`).join(" ")} />
                        </clipPath>
                      </defs>

                      <polygon
                        points={builtUpPoints.map(p => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke={isFullPlot ? "transparent" : "red"}
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray="4 2"
                      />

                      <g clipPath="url(#builtUpClip)">
                        {hatchLines.map((line, idx) => (
                          <line
                            key={idx}
                            x1={line.x1}
                            y1={line.y1}
                            x2={line.x2}
                            y2={line.y2}
                            stroke="#666666"
                            strokeWidth="0.5"
                            opacity="0.6"
                          />
                        ))}
                      </g>

                      {!isFullPlot && (
                        <>
                          {mosBVal > 0 && (() => {
                            const dimX = pTopLeft.x - 5.5; 
                            const midY = (pTopLeft.y + bTopLeft.y) / 2;
                            const labelText = `${mosBVal}'`;
                            const mosTextCenterX = (bTopLeft.x + bTopRight.x) / 2;
                            const mosTextCenterY = (pTopLeft.y + bTopLeft.y) / 2;
                            return (
                              <g>
                                <line x1={dimX} y1={pTopLeft.y} x2={dimX} y2={bTopLeft.y} stroke="red" strokeWidth="1" />
                                <polygon points={`${dimX},${pTopLeft.y} ${dimX - 3},${pTopLeft.y + 6} ${dimX + 3},${pTopLeft.y + 6}`} fill="red" />
                                <polygon points={`${dimX},${bTopLeft.y} ${dimX - 3},${bTopLeft.y - 6} ${dimX + 3},${bTopLeft.y - 6}`} fill="red" />
                                <text x={dimX - 10} y={midY} fill="red" fontSize="8" fontWeight="900" textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90, ${dimX - 10}, ${midY})`}>
                                  {labelText}
                                </text>
                                <text x={mosTextCenterX} y={mosTextCenterY} fill="red" fontSize="7" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                                  REAR MOS
                                </text>
                              </g>
                            );
                          })()}

                          {mosAVal > 0 && (() => {
                            const dimX = pBottomLeft.x - 5.5; 
                            const midY = (pBottomLeft.y + bBottomLeft.y) / 2;
                            const labelText = `${mosAVal}'`;
                            const mosTextCenterX = (bBottomLeft.x + bBottomRight.x) / 2;
                            const mosTextCenterY = (pBottomLeft.y + bBottomLeft.y) / 2;
                            return (
                              <g>
                                <line x1={dimX} y1={pBottomLeft.y} x2={dimX} y2={bBottomLeft.y} stroke="red" strokeWidth="1" />
                                <polygon points={`${dimX},${pBottomLeft.y} ${dimX - 3},${pBottomLeft.y - 6} ${dimX + 3},${pBottomLeft.y - 6}`} fill="red" />
                                <polygon points={`${dimX},${bBottomLeft.y} ${dimX - 3},${bBottomLeft.y + 6} ${dimX + 3},${bBottomLeft.y + 6}`} fill="red" />
                                <text x={dimX - 10} y={midY} fill="red" fontSize="8" fontWeight="900" textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90, ${dimX - 10}, ${midY})`}>
                                  {labelText}
                                </text>
                                <text x={mosTextCenterX} y={mosTextCenterY} fill="red" fontSize="7" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                                  FRONT MOS
                                </text>
                              </g>
                            );
                          })()}

                          {mosCVal > 0 && (() => {
                            const dimY = pTopLeft.y - 5.5; 
                            const midX = (pTopLeft.x + bTopLeft.x) / 2;
                            const labelText = `${mosCVal}'`;
                            const mosTextCenterX = (pTopLeft.x + bTopLeft.x) / 2;
                            const mosTextCenterY = (bTopLeft.y + bBottomLeft.y) / 2;
                            return (
                              <g>
                                <line x1={pTopLeft.x} y1={dimY} x2={bTopLeft.x} y2={dimY} stroke="red" strokeWidth="1" />
                                <polygon points={`${pTopLeft.x},${dimY} ${pTopLeft.x + 6},${dimY - 3} ${pTopLeft.x + 6},${dimY + 3}`} fill="red" />
                                <polygon points={`${bTopLeft.x},${dimY} ${bTopLeft.x - 6},${dimY - 3} ${bTopLeft.x - 6},${dimY + 3}`} fill="red" />
                                <text x={midX} y={dimY - 8} fill="red" fontSize="8" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                                  {labelText}
                                </text>
                                <text x={mosTextCenterX} y={mosTextCenterY} fill="red" fontSize="7" fontWeight="900" textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90, ${mosTextCenterX}, ${mosTextCenterY})`}>
                                  LEFT MOS
                                </text>
                              </g>
                            );
                          })()}

                          {mosDVal > 0 && (() => {
                            const dimY = pTopRight.y - 5.5; 
                            const midX = (pTopRight.x + bTopRight.x) / 2;
                            const labelText = `${mosDVal}'`;
                            const mosTextCenterX = (pTopRight.x + bTopRight.x) / 2;
                            const mosTextCenterY = (bTopRight.y + bBottomRight.y) / 2;
                            return (
                              <g>
                                <line x1={pTopRight.x} y1={dimY} x2={bTopRight.x} y2={dimY} stroke="red" strokeWidth="1" />
                                <polygon points={`${pTopRight.x},${dimY} ${pTopRight.x + 6},${dimY - 3} ${pTopRight.x + 6},${dimY + 3}`} fill="red" />
                                <polygon points={`${bTopRight.x},${dimY} ${bTopRight.x - 6},${dimY - 3} ${bTopRight.x - 6},${dimY + 3}`} fill="red" />
                                <text x={midX} y={dimY - 8} fill="red" fontSize="8" fontWeight="900" textAnchor="middle" dominantBaseline="middle">
                                  {labelText}
                                </text>
                                <text x={mosTextCenterX} y={mosTextCenterY} fill="red" fontSize="7" fontWeight="900" textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90, ${mosTextCenterX}, ${mosTextCenterY})`}>
                                  RIGHT MOS
                                </text>
                              </g>
                            );
                          })()}
                        </>
                      )}
                    </g>

                    <BoundaryLabels
                      topBoundary={boundaryNorth}
                      bottomBoundary={boundarySouth}
                      leftBoundary={boundaryWest}
                      rightBoundary={boundaryEast}
                      dimA={isSimpleRect ? dimA : Number(actualLenA.toFixed(1))}
                      dimB={isSimpleRect ? dimA : Number(actualLenB.toFixed(1))}
                      dimC={isSimpleRect ? dimC : Number(actualLenC.toFixed(1))}
                      dimD={isSimpleRect ? dimC : Number(actualLenD.toFixed(1))}
                      pTopLeft={pTopLeft}
                      pTopRight={pTopRight}
                      pBottomLeft={pBottomLeft}
                      pBottomRight={pBottomRight}
                      centerX={centerX} 
                      centerY={centerY}
                      minX={minX}
                      maxX={maxX}
                      roadFacingOption={roadFacingOption}
                      roadWidth={(() => {
                        const main = getRoadOrientation(roadFacingOption || "1 SIDE ROAD (SOUTH)").mainRoad;
                        if (main === "NORTH") return currentNorthRoad;
                        if (main === "EAST") return currentEastRoad;
                        if (main === "WEST") return currentWestRoad;
                        return currentSouthRoad;
                      })()}
                    />

                    <RoadRenderer
                      roadFacingOption={roadFacingOption}
                      bottomBoundary={boundarySouth}
                      topBoundary={boundaryNorth}
                      boundaryEast={boundaryEast}
                      boundaryWest={boundaryWest}
                      pTopLeft={pTopLeft}
                      pTopRight={pTopRight}
                      pBottomLeft={pBottomLeft}
                      pBottomRight={pBottomRight}
                      roadWidthNorth={activeNorth ? currentNorthRoad : 0}
                      roadWidthSouth={activeSouth ? currentSouthRoad : 0}
                      roadWidthEast={activeEast ? currentEastRoad : 0}
                      roadWidthWest={activeWest ? currentWestRoad : 0}
                    />

                    {(() => {
                      const isNarrowBuiltUp = builtUpWidth < 80;
                      const textRotation = isNarrowBuiltUp ? -90 : 0;

                      return (
                        <g transform={`translate(${builtUpCenterX}, ${builtUpCenterY})`}>
                          <text 
                            x="0" 
                            y="1" 
                            textAnchor="middle" 
                            dominantBaseline="middle"
                            fill="#ffffff" 
                            transform={`rotate(${textRotation})`}
                            style={{ fontWeight: "900", fontSize: "7.5px", fontFamily: "sans-serif", paintOrder: "stroke", stroke: "#000000", strokeWidth: "3px" }}
                          >
                            PROPOSED SITE
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })()}

              {cadObjects?.map((obj) => {
                const isSelected = selectedCadObjectIds?.includes(obj.id);
                const strokeColor = isSelected ? "red" : "#ffffff";
                const strokeW = 1;

                if (obj.type === "LINE" && obj.points?.length >= 2) {
                  return (
                    <line
                      key={obj.id}
                      x1={obj.points[0].x}
                      y1={obj.points[0].y}
                      x2={obj.points[1].x}
                      y2={obj.points[1].y}
                      stroke={strokeColor}
                      strokeWidth={strokeW}
                      vectorEffect="non-scaling-stroke"
                      onClick={(e) => { e.stopPropagation(); toggleCadSelection(obj.id); }}
                      className="cursor-pointer"
                    />
                  );
                }
                if ((obj.type === "POLYLINE" || obj.type === "RECTANGLE") && obj.points?.length >= 2) {
                  return (
                    <polygon
                      key={obj.id}
                      points={obj.points.map(p => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeW}
                      vectorEffect="non-scaling-stroke"
                      onClick={(e) => { e.stopPropagation(); toggleCadSelection(obj.id); }}
                      className="cursor-pointer"
                    />
                  );
                }
                if (obj.type === "TEXT" && obj.points?.length > 0) {
                  return (
                    <text
                      key={obj.id}
                      x={obj.points[0].x}
                      y={obj.points[0].y}
                      fill={strokeColor}
                      fontSize="14"
                      fontWeight="bold"
                      transform={`rotate(${obj.rotation || 0}, ${obj.points[0].x}, ${obj.points[0].y})`}
                      onClick={(e) => { e.stopPropagation(); toggleCadSelection(obj.id); }}
                      className="cursor-pointer"
                    >
                      {obj.text}
                    </text>
                  );
                }
                return null;
              })}
            </PlotCadCanvas>
          </div>

          <CadSidebarDimensions
            editModeToggle={editModeToggle}
            setEditModeToggle={setEditModeToggle}
            isSimpleRect={isSimpleRect}
            isMultiDimShape={isMultiDimShape}
            plotDimensions={plotDimensions}
            updateDimensionPart={updateDimensionPart}
            sideAngles={sideAngles}
            setSideAngles={setSideAngles}
            mosAngles={mosAngles}
            setMosAngles={setMosAngles}
            sideSlant={sideSlant}
            setSideSlant={setSideSlant}
            sideMos={sideMos}
            handleMosChange={handleMosChange}
            actualLenA={actualLenA}
            actualLenB={actualLenB}
            actualLenC={actualLenC}
            actualLenD={actualLenD}
            dimA={dimA}
            dimC={dimC}
            calculatedArea={calculatedArea}
            plotArea={plotArea}
            measurementUnit={measurementUnit}
            boundaryNorth={boundaryNorth}
            setBoundaryNorth={setBoundaryNorth}
            boundarySouth={boundarySouth}
            setBoundarySouth={setBoundarySouth}
            boundaryEast={boundaryEast}
            setBoundaryEast={setBoundaryEast}
            boundaryWest={boundaryWest}
            setBoundaryWest={setBoundaryWest}
            
            roadWidthNorth={activeNorth ? currentNorthRoad : undefined}
            roadWidthSouth={activeSouth ? currentSouthRoad : undefined}
            roadWidthEast={activeEast ? currentEastRoad : undefined}
            roadWidthWest={activeWest ? currentWestRoad : undefined}
            handleNorthRoadChange={activeNorth ? handleNorthRoadChange : undefined}
            handleSouthRoadChange={activeSouth ? handleSouthRoadChange : undefined}
            handleEastRoadChange={activeEast ? handleEastRoadChange : undefined}
            handleWestRoadChange={activeWest ? handleWestRoadChange : undefined}
          />
        </div>
      </div>
    </div>
  );
}