'use client';

import React, { useState } from "react";
import { FloorData, FloorRoom } from "@/lib/constructionPlan/types";

interface FloorManagerSectionProps {
  selectedFloors: string[];
  floorData: Record<string, FloorData>;
  floorBhkConfig: Record<string, string>;
  roomEditorFloor: string | null;
  floorRooms: Record<string, Record<string, FloorRoom>>;
  updateFloorAreaDirect: (floor: string, area: number) => void;
  updateFloorDimensions?: (floor: string, width: number, length: number) => void;
  updateFloorSetbacks?: (floor: string, setback: { front?: number; rear?: number; left?: number; right?: number }) => void;
  applyBhkTemplate: (floor: string, bhkType: string) => void;
  openFloorCadModal: (floor: string) => void;
  ensureFloorRooms: (floor: string) => void;
  setRoomEditorFloor: (floor: string | null) => void;
  toggleRoom: (floor: string, roomKey: string) => void;
  updateRoom: (floor: string, roomKey: string, patch: Partial<FloorRoom>) => void;
  resetFloorRooms?: (floor: string) => void;
  BHK_CONFIGURATIONS: readonly string[];
  plotLength?: number | string;
  plotWidth?: number | string;
  groundCoverage?: string;
  frontSetback?: number | string;
  rearSetback?: number | string;
  leftSetback?: number | string;
  rightSetback?: number | string;
}

interface SetbackType {
  front: number;
  rear: number;
  left: number;
  right: number;
}

export const ROOM_CATALOG = [
  { key: "parking", label: "PARKING", defaultArea: 120, minArea: 100, category: "Ground" },
  { key: "parking_with_stair", label: "PARKING WITH STAIRCASE", defaultArea: 160, minArea: 130, category: "Ground" },
  { key: "staircase", label: "STAIRCASE", defaultArea: 65, minArea: 40, category: "Core" },
  { key: "stair_in_living", label: "STAIR IN LIVING ROOM", defaultArea: 80, minArea: 50, category: "Core" },
  { key: "verandah", label: "VERANDAH / PORCH", defaultArea: 75, minArea: 40, category: "Exterior" },
  { key: "living_room", label: "LIVING ROOM", defaultArea: 180, minArea: 130, category: "Living" },
  { key: "hall", label: "HALL", defaultArea: 150, minArea: 100, category: "Living" },
  { key: "kitchen", label: "KITCHEN (STANDALONE)", defaultArea: 65, minArea: 45, category: "Kitchen" },
  { key: "kitchen_cum_dining", label: "KITCHEN CUM DINING", defaultArea: 130, minArea: 85, category: "Kitchen" },
  { key: "store_room", label: "STORE ROOM", defaultArea: 40, minArea: 25, category: "Utility" },
  { key: "master_bedroom", label: "MASTER BEDROOM", defaultArea: 180, minArea: 130, category: "Bedroom" },
  { key: "bedroom", label: "BEDROOM", defaultArea: 140, minArea: 100, category: "Bedroom" },
  { key: "dressing", label: "DRESSING ROOM", defaultArea: 40, minArea: 25, category: "Bedroom" },
  { key: "common_bathroom", label: "COMMON BATHROOM", defaultArea: 45, minArea: 25, category: "Bathroom" },
  { key: "attached_bathroom", label: "ATTACHED BATHROOM", defaultArea: 50, minArea: 30, category: "Bathroom" },
  { key: "wc", label: "WC (TOILET)", defaultArea: 25, minArea: 15, category: "Bathroom" },
  { key: "pooja_room", label: "POOJA ROOM", defaultArea: 30, minArea: 20, category: "Common" },
  { key: "study_room", label: "STUDY ROOM", defaultArea: 70, minArea: 45, category: "Common" },
  { key: "utility", label: "UTILITY / WASH AREA", defaultArea: 35, minArea: 20, category: "Utility" },
  { key: "balcony", label: "BALCONY", defaultArea: 45, minArea: 25, category: "Exterior" },
  { key: "duct", label: "VENTILATION DUCT", defaultArea: 25, minArea: 15, mandatory: true, category: "Core" },
  { key: "lift", label: "LIFT / ELEVATOR", defaultArea: 35, minArea: 28, category: "Core" },
  { key: "ground_garden", label: "GROUND FLOOR GARDEN / LAWN", defaultArea: 200, minArea: 100, category: "Exterior" },
  { key: "terrace_garden", label: "TERRACE GARDEN", defaultArea: 150, minArea: 80, category: "Exterior" },
  { key: "swimming_pool", label: "SWIMMING POOL", defaultArea: 300, minArea: 150, category: "Exterior" },
];

export default function FloorManagerSection({
  selectedFloors,
  floorData,
  floorBhkConfig,
  roomEditorFloor,
  floorRooms,
  updateFloorAreaDirect,
  updateFloorDimensions,
  updateFloorSetbacks,
  applyBhkTemplate,
  openFloorCadModal,
  ensureFloorRooms,
  setRoomEditorFloor,
  toggleRoom,
  updateRoom,
  resetFloorRooms,
  BHK_CONFIGURATIONS,
  plotLength = 0,
  plotWidth = 0,
  groundCoverage = "100_PERCENT",
  frontSetback = 0,
  rearSetback = 0,
  leftSetback = 0,
  rightSetback = 0,
}: FloorManagerSectionProps) {
  const [mosEditorFloor, setMosEditorFloor] = useState<string | null>(null);

  // Accurate Plot Mapping: plotLength is Front Width (Side A), plotWidth is Depth (Side C)
  const plotFrontWidth = Number(plotLength) > 0 ? Number(plotLength) : 20;
  const plotDepth = Number(plotWidth) > 0 ? Number(plotWidth) : 50;
  const maxPlotArea = plotFrontWidth * plotDepth > 0 ? plotFrontWidth * plotDepth : 1000;

  const numFrontSetback = Number(frontSetback) || 0;
  const numRearSetback = Number(rearSetback) || 0;
  const numLeftSetback = Number(leftSetback) || 0;
  const numRightSetback = Number(rightSetback) || 0;

  console.log("=== [FloorManagerSection Render Debug] ===", {
    plotFrontWidth,
    plotDepth,
    maxPlotArea,
  });

  return (
    <div className="border-2 border-black mb-4 bg-white shadow-sm uppercase font-sans">
      <div className="bg-slate-900 text-white p-2.5 text-center font-black text-lg tracking-wide uppercase">
        FLOOR-WISE BUILT-UP AREA & ROOM PLANNING (PROFESSIONAL PLOT SYNC VIEW)
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-200 text-black border-b-2 border-black">
            <tr>
              <th className="border-r border-black p-2.5 font-black text-left pl-3">FLOOR</th>
              <th className="border-r border-black p-2.5 font-black text-center">WIDTH (FT)</th>
              <th className="border-r border-black p-2.5 font-black text-center">LENGTH (FT)</th>
              <th className="border-r border-black p-2.5 font-black text-center">BUILT-UP AREA</th>
              <th className="border-r border-black p-2.5 font-black text-center">TEMPLATE</th>
              <th className="border-r border-black p-2.5 font-black text-center">MOS</th>
              <th className="border-r border-black p-2.5 font-black text-center">CAD VIEW</th>
              <th className="p-2.5 font-black text-center">ROOM EDIT</th>
            </tr>
          </thead>
          <tbody>
            {selectedFloors.map((floor) => {
              const isGround = floor === "GROUND FLOOR";
              const isTower = floor.toUpperCase().includes("TOWER");
              const data = (floorData[floor] || {}) as FloorData & { setbacks?: SetbackType };
              const currentBhk = floorBhkConfig[floor] || "CUSTOM";
              const isMosOpen = mosEditorFloor === floor;
              const isRoomOpen = roomEditorFloor === floor;

              const setbacks: SetbackType = data.setbacks && typeof data.setbacks === 'object' ? {
                front: Number(data.setbacks.front ?? numFrontSetback),
                rear: Number(data.setbacks.rear ?? numRearSetback),
                left: Number(data.setbacks.left ?? numLeftSetback),
                right: Number(data.setbacks.right ?? numRightSetback),
              } : {
                front: numFrontSetback,
                rear: numRearSetback,
                left: numLeftSetback,
                right: numRightSetback,
              };

              const rawW = Number(data.width);
              const rawL = Number(data.length);

              let currentWidth = 0;
              let currentLength = 0;

              if (isGround) {
                // Robust Ground Floor Normalizer & Swapping Guard
                let w = rawW > 0 ? rawW : plotFrontWidth;
                let l = rawL > 0 ? rawL : plotDepth;

                // If width and length are swapped (e.g. width = 40/50 and length = 20)
                if (w > plotFrontWidth && l <= plotFrontWidth) {
                  const temp = w;
                  w = l;
                  l = temp;
                }

                currentWidth = w > plotFrontWidth ? plotFrontWidth : w;
                currentLength = l > plotDepth ? plotDepth : l;
              } else if (isTower) {
                currentWidth = rawW > 0 ? rawW : 10;
                currentLength = rawL > 0 ? rawL : 10;
              } else {
                // Upper floors fully manual width & length
                currentWidth = rawW > 0 ? rawW : plotFrontWidth;
                currentLength = rawL > 0 ? rawL : plotDepth;
              }

              const calculatedArea = currentWidth * currentLength;
              const totalFloorBuiltUp = Number(data.area || calculatedArea || calculatedArea);

              console.log(`--- [Floor Row Debug] ${floor} ---`, {
                rawW,
                rawL,
                currentWidth,
                currentLength,
                totalFloorBuiltUp,
              });

              const floorRoomMap = floorRooms[floor] || {};
              let allocatedRoomArea = 0;
              ROOM_CATALOG.forEach(cat => {
                const roomInfo = floorRoomMap[cat.key];
                if (roomInfo && roomInfo.selected) {
                  allocatedRoomArea += Number(roomInfo.count || 1) * Number(roomInfo.areaPerRoom || cat.defaultArea);
                }
              });

              const isFullCoverage = groundCoverage === "100_PERCENT";
              const availableCatalog = ROOM_CATALOG.filter(cat => {
                if (cat.mandatory) return true;
                if (totalFloorBuiltUp > 0 && cat.minArea > totalFloorBuiltUp) return false;
                return true;
              });

              return (
                <React.Fragment key={floor}>
                  <tr className="border-b border-black hover:bg-gray-50 transition">
                    <td className="border-r border-black p-3 font-black text-left pl-3 uppercase bg-slate-50 min-w-[180px]">
                      {isGround ? "GROUND FLOOR (PARKING & STAIR)" : isTower ? "TOWER PARKING & LIVING" : `${floor} PARKING & LIVING`}
                    </td>
                    
                    {/* Width Input */}
                    <td className="border-r border-black p-2.5 text-center">
                      <input
                        type="number"
                        max={isGround ? plotFrontWidth : undefined}
                        value={currentWidth}
                        onChange={(e) => {
                          let w = Number(e.target.value) || 0;
                          if (isGround && w > plotFrontWidth) {
                            alert(`Ground floor width cannot exceed plot front width (${plotFrontWidth} FT)!`);
                            w = plotFrontWidth;
                          }
                          const l = currentLength;
                          const newArea = Number((w * l).toFixed(2));

                          if (!isGround || newArea <= maxPlotArea) {
                            if (updateFloorDimensions) {
                              updateFloorDimensions(floor, w, l);
                            }
                            updateFloorAreaDirect(floor, newArea);
                          } else {
                            alert(`Floor area cannot exceed plot area (${maxPlotArea} SQ.FT)!`);
                          }
                        }}
                        placeholder="Width"
                        className="w-20 border-2 border-black p-1.5 text-center font-black text-xs bg-white"
                      />
                    </td>

                    {/* Length Input */}
                    <td className="border-r border-black p-2.5 text-center">
                      <input
                        type="number"
                        max={isGround ? plotDepth : undefined}
                        value={currentLength}
                        onChange={(e) => {
                          let l = Number(e.target.value) || 0;
                          if (isGround && l > plotDepth) {
                            alert(`Ground floor length cannot exceed plot depth (${plotDepth} FT)!`);
                            l = plotDepth;
                          }
                          const w = currentWidth;
                          const newArea = Number((w * l).toFixed(2));

                          if (!isGround || newArea <= maxPlotArea) {
                            if (updateFloorDimensions) {
                              updateFloorDimensions(floor, w, l);
                            }
                            updateFloorAreaDirect(floor, newArea);
                          } else {
                            alert(`Floor area cannot exceed plot area (${maxPlotArea} SQ.FT)!`);
                          }
                        }}
                        placeholder="Length"
                        className="w-20 border-2 border-black p-1.5 text-center font-black text-xs bg-white"
                      />
                    </td>

                    {/* Built-up Area Input */}
                    <td className="border-r border-black p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          max={isGround ? maxPlotArea : undefined}
                          value={data.area || totalFloorBuiltUp || ""}
                          onChange={(event) => {
                            let val = Number(event.target.value) || 0;
                            if (isGround && val > maxPlotArea) {
                              alert(`Area cannot exceed total plot area (${maxPlotArea} SQ.FT)!`);
                              val = maxPlotArea;
                            }
                            updateFloorAreaDirect(floor, val);
                          }}
                          className="w-24 border-2 border-black p-1.5 text-center font-black text-xs bg-white"
                        />
                        <span className="text-[10px] font-black">SQ.FT</span>
                      </div>
                    </td>
                    <td className="border-r border-black p-2.5 text-center">
                      <select
                        value={currentBhk}
                        onChange={(e) => applyBhkTemplate(floor, e.target.value)}
                        className="border-2 border-black p-1.5 text-xs font-black bg-white w-28 sm:w-32"
                      >
                        {BHK_CONFIGURATIONS.map((bhk) => (
                          <option key={bhk} value={bhk}>{bhk}</option>
                        ))}
                      </select>
                    </td>
                    <td className="border-r border-black p-2.5 text-center">
                      {isGround || isTower ? (
                        <span className="text-[10px] font-bold text-gray-400">PLOT SETUP</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMosEditorFloor(isMosOpen ? null : floor)}
                          className="bg-amber-600 text-white px-3 py-1.5 text-xs font-black shadow hover:bg-amber-700 transition cursor-pointer uppercase"
                        >
                          {isMosOpen ? "CLOSE MOS" : "EDIT MOS"}
                        </button>
                      )}
                    </td>
                    <td className="border-r border-black p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => openFloorCadModal(floor)}
                        className="bg-blue-600 text-white px-3 py-1.5 text-xs font-black shadow hover:bg-blue-700 transition cursor-pointer uppercase"
                      >
                        CAD VIEW
                      </button>
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          ensureFloorRooms(floor);
                          setRoomEditorFloor(isRoomOpen ? null : floor);
                        }}
                        className="bg-black text-white px-3 py-1.5 text-xs font-black shadow hover:bg-zinc-800 transition cursor-pointer uppercase"
                      >
                        {isRoomOpen ? "CLOSE" : "ROOMS"}
                      </button>
                    </td>
                  </tr>

                  {/* Individual Floor MOS Editor (Only for Upper Floors excluding Tower)[cite: 1] */}
                  {!isGround && !isTower && isMosOpen && (
                    <tr className="bg-amber-50 border-b border-black">
                      <td colSpan={8} className="p-3">
                        <div className="border border-amber-600 p-3 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                          <div className="text-xs font-black text-amber-900 col-span-2 sm:col-span-4 uppercase border-b border-amber-300 pb-1 flex justify-between items-center">
                            <span>Margin of Setbacks (MOS) & Open Space for {floor}</span>
                            <span className="text-[10px] text-gray-600">Max Plot: {plotFrontWidth}×{plotDepth} FT</span>
                          </div>
                          {["front", "rear", "left", "right"].map((side) => (
                            <div key={side} className="flex flex-col gap-1">
                              <span className="text-[10px] font-black">{side.toUpperCase()} MOS (FT)</span>
                              <input
                                type="number"
                                min={0}
                                value={setbacks[side as keyof SetbackType] ?? 0}
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  if (rawVal.includes('-')) return;
                                  const val = rawVal === "" ? 0 : Number(rawVal);
                                  const updated: SetbackType = { ...setbacks, [side]: val };
                                  if (updateFloorSetbacks) updateFloorSetbacks(floor, updated);
                                }}
                                className="border border-black p-1.5 text-center text-xs font-bold bg-white"
                              />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}

                  {isRoomOpen && (
                    <tr className="bg-slate-50 border-b-2 border-black">
                      <td colSpan={8} className="p-4">
                        <div className="border-2 border-black bg-white p-3">
                          <div className="flex flex-col sm:flex-row justify-between items-center mb-3 border-b-2 border-black pb-2 gap-2">
                            <div className="font-black text-xs uppercase text-slate-900 text-left">
                              SEQUENTIAL ROOM PLANNING FOR {floor} (SMART FILTERED BY AREA: {totalFloorBuiltUp} SQ.FT)
                            </div>
                            <div className="text-xs font-black flex gap-3 items-center">
                              <span className="bg-slate-200 px-3 py-1 border border-black">
                                FLOOR BUILT-UP: {totalFloorBuiltUp} SQ.FT
                              </span>
                              <span className={`px-3 py-1 border border-black ${allocatedRoomArea > totalFloorBuiltUp ? 'bg-red-200 text-red-900' : 'bg-green-100 text-green-900'}`}>
                                ALLOCATED: {allocatedRoomArea.toFixed(2)} SQ.FT
                              </span>
                            </div>
                          </div>

                          {allocatedRoomArea > totalFloorBuiltUp && (
                            <div className="bg-red-600 text-white p-2 text-xs font-black mb-3 text-center border border-black">
                              ⚠️ WARNING: Selected rooms total area ({allocatedRoomArea.toFixed(2)} SQ.FT) exceeds floor built-up area ({totalFloorBuiltUp} SQ.FT)!
                            </div>
                          )}

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                            <div className="border-2 border-black p-3 bg-white">
                              <div className="bg-slate-900 text-white p-2 text-xs font-black mb-2 flex justify-between items-center">
                                <span>PART 1: SELECT COMPATIBLE ITEMS (CATALOG)</span>
                                {resetFloorRooms && (
                                  <button
                                    type="button"
                                    onClick={() => resetFloorRooms(floor)}
                                    className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-white cursor-pointer"
                                  >
                                    RESET ALL
                                  </button>
                                )}
                              </div>
                              <div className="max-h-[380px] overflow-auto">
                                <table className="w-full border-collapse text-xs">
                                  <thead className="bg-slate-200 sticky top-0">
                                    <tr>
                                      <th className="border border-black p-1.5 font-black text-center w-10">SEL</th>
                                      <th className="border border-black p-1.5 font-black text-left pl-2">ITEM / ROOM</th>
                                      <th className="border border-black p-1.5 font-black text-center w-12">NOS</th>
                                      <th className="border border-black p-1.5 font-black text-center w-20">MODE</th>
                                      <th className="border border-black p-1.5 font-black text-center w-20">SQ.FT</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {availableCatalog.map((room) => {
                                      const current = floorRoomMap[room.key] || {
                                        selected: room.mandatory && isFullCoverage ? true : false,
                                        count: 1,
                                        areaMode: "AUTO" as const,
                                        areaPerRoom: room.defaultArea,
                                      };
                                      const itemTotalArea = Number(current.count || 1) * Number(current.areaPerRoom || room.defaultArea);

                                      return (
                                        <tr key={room.key} className={current.selected ? "bg-amber-50" : ""}>
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="checkbox"
                                              checked={current.selected}
                                              onChange={() => {
                                                const nextAllocated = allocatedRoomArea + (current.selected ? -itemTotalArea : itemTotalArea);
                                                if (!current.selected && nextAllocated > totalFloorBuiltUp) {
                                                  alert("Cannot select: Exceeds floor built-up area!");
                                                  return;
                                                }
                                                toggleRoom(floor, room.key);
                                              }}
                                              className="w-4 h-4 cursor-pointer"
                                            />
                                          </td>
                                          <td className="border border-black p-1.5 font-bold text-left pl-2">
                                            {room.label} {room.mandatory && <span className="text-[8px] bg-amber-400 px-1 ml-1 font-black">MANDATORY</span>}
                                          </td>
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="number"
                                              min={1}
                                              value={current.count || 1}
                                              disabled={!current.selected}
                                              onChange={(e) => updateRoom(floor, room.key, { count: Math.max(1, Number(e.target.value) || 1) })}
                                              className="w-12 border border-black p-1 text-center font-bold text-xs bg-white"
                                            />
                                          </td>
                                          <td className="border border-black p-1.5 text-center">
                                            <select
                                              disabled={!current.selected}
                                              value={current.areaMode || "AUTO"}
                                              onChange={(e) => updateRoom(floor, room.key, { areaMode: e.target.value as "AUTO" | "MANUAL" })}
                                              className="border border-black p-1 text-[10px] font-bold bg-white"
                                            >
                                              <option value="AUTO">AUTO</option>
                                              <option value="MANUAL">MANUAL</option>
                                            </select>
                                          </td>
                                          <td className="border border-black p-1.5 text-center">
                                            <input
                                              type="number"
                                              min={room.minArea}
                                              disabled={!current.selected || current.areaMode === "AUTO"}
                                              value={current.areaPerRoom || room.defaultArea}
                                              onChange={(e) => updateRoom(floor, room.key, { areaPerRoom: Number(e.target.value) || room.defaultArea })}
                                              className={`w-16 border border-black p-1 text-center font-bold text-xs ${current.areaMode === "AUTO" ? "bg-gray-100" : "bg-white"}`}
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="border-2 border-black p-3 bg-white">
                              <div className="bg-slate-900 text-white p-2 text-xs font-black mb-2 text-left pl-2">
                                PART 2: SELECTED ITEMS LIST & SUMMARY (SEQUENTIAL)
                              </div>
                              <div className="max-h-[380px] overflow-auto">
                                <table className="w-full border-collapse text-xs">
                                  <thead className="bg-slate-200 sticky top-0">
                                    <tr>
                                      <th className="border border-black p-1.5 font-black text-left pl-2">SELECTED ITEM</th>
                                      <th className="border border-black p-1.5 font-black text-center">NOS</th>
                                      <th className="border border-black p-1.5 font-black text-center">SQ.FT / UNIT</th>
                                      <th className="border border-black p-1.5 font-black text-right pr-2">TOTAL</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ROOM_CATALOG.filter(room => floorRoomMap[room.key]?.selected).length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="border border-black p-8 text-center text-gray-500 font-bold">
                                          No items selected yet. Choose items from Part 1.
                                        </td>
                                      </tr>
                                    ) : (
                                      ROOM_CATALOG.filter(room => floorRoomMap[room.key]?.selected).map((room) => {
                                        const current = floorRoomMap[room.key];
                                        const total = Number(current.count || 1) * Number(current.areaPerRoom || room.defaultArea);
                                        return (
                                          <tr key={`sel-${room.key}`} className="bg-green-50">
                                            <td className="border border-black p-1.5 font-bold text-left pl-2">{room.label}</td>
                                            <td className="border border-black p-1.5 text-center font-bold">{current.count || 1}</td>
                                            <td className="border border-black p-1.5 text-center font-bold">{current.areaPerRoom || room.defaultArea}</td>
                                            <td className="border border-black p-1.5 text-right pr-2 font-black">{total.toFixed(2)} SQ.FT</td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              <div className="mt-3 p-2 bg-slate-100 border border-black text-[10px] font-bold text-left">
                                <div>✅ Total Allocated: <span className="font-black text-black">{allocatedRoomArea.toFixed(2)} SQ.FT</span></div>
                                <div className="mt-1 text-gray-700">ℹ️ Remaining space automatically adjusts in Hall / Living Room.</div>
                              </div>
                            </div>

                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}