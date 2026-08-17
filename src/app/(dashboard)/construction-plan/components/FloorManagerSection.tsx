'use client';

import React, { useState } from "react";
import { FloorData, FloorRoom } from "@/lib/constructionPlan/types";
import { ROOM_CATALOG } from "@/lib/constructionPlan/roomRules";

interface FloorManagerSectionProps {
  selectedFloors: string[];
  floorData: Record<string, FloorData>;
  floorBhkConfig: Record<string, string>;
  roomEditorFloor: string | null;
  floorRooms: Record<string, Record<string, FloorRoom>>;
  updateFloorAreaDirect: (floor: string, area: number) => void;
  updateFloorDimensions?: (floor: string, length: number, width: number) => void;
  updateFloorSetbacks?: (floor: string, setback: { front?: number; rear?: number; left?: number; right?: number }) => void;
  applyBhkTemplate: (floor: string, bhkType: string) => void;
  openFloorCadModal: (floor: string) => void;
  ensureFloorRooms: (floor: string) => void;
  setRoomEditorFloor: (floor: string | null) => void;
  toggleRoom: (floor: string, roomKey: string) => void;
  updateRoom: (floor: string, roomKey: string, patch: Partial<FloorRoom>) => void;
  BHK_CONFIGURATIONS: readonly string[];
  plotLength?: number;
  plotWidth?: number;
  groundCoverage?: string;
}

interface SetbackType {
  front: number;
  rear: number;
  left: number;
  right: number;
}

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
  BHK_CONFIGURATIONS,
  plotLength = 0,
  plotWidth = 0,
  groundCoverage = "100%",
}: FloorManagerSectionProps) {
  const [mosEditorFloor, setMosEditorFloor] = useState<string | null>(null);
  const [localState, setLocalState] = useState<Record<string, { width: number; length: number; setbacks: SetbackType }>>({});

  return (
    <div className="border-2 border-black mb-4 bg-white shadow-sm">
      <div className="bg-slate-900 text-white p-2.5 text-center font-black text-lg tracking-wide uppercase">
        FLOOR-WISE BUILT-UP AREA & ROOM PLANNING
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-200 text-black border-b-2 border-black">
            <tr>
              <th className="border-r border-black p-2.5 font-black text-center">FLOOR</th>
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
            {selectedFloors.map((floor, index) => {
              const data = (floorData[floor] || { length: 0, width: 0, area: 0 }) as FloorData & {
                setbacks?: SetbackType;
              };
              const currentBhk = floorBhkConfig[floor] || "CUSTOM";
              const isMosOpen = mosEditorFloor === floor;
              const isRoomOpen = roomEditorFloor === floor;

              const setbacks: SetbackType = localState[floor]?.setbacks || data.setbacks || { front: 0, rear: 0, left: 0, right: 0 };
              const fMos = setbacks.front || 0;
              const rMos = setbacks.rear || 0;
              const lMos = setbacks.left || 0;
              const rightMos = setbacks.right || 0;

              let defaultWidth = data.width;
              let defaultLength = data.length;

              if (!defaultWidth || !defaultLength) {
                if (index === 0) {
                  if (plotWidth > 0) defaultWidth = plotWidth - (lMos + rightMos);
                  if (plotLength > 0) defaultLength = plotLength - (fMos + rMos);
                } else {
                  const groundFloorName = selectedFloors[0];
                  const groundData = (floorData[groundFloorName] || {}) as FloorData & { setbacks?: SetbackType };
                  const gSetbacks: SetbackType = groundData.setbacks || { front: 0, rear: 0, left: 0, right: 0 };
                  const groundWidth = groundData.width || (plotWidth > 0 ? plotWidth - (gSetbacks.left + gSetbacks.right) : 0);
                  const groundLength = groundData.length || (plotLength > 0 ? plotLength - (gSetbacks.front + gSetbacks.rear) : 0);

                  defaultWidth = groundWidth > 0 ? groundWidth - (lMos + rightMos) : 0;
                  defaultLength = groundLength > 0 ? groundLength - (fMos + rMos) : 0;
                }
              }

              const currentWidth = localState[floor]?.width ?? data.width ?? defaultWidth ?? "";
              const currentLength = localState[floor]?.length ?? data.length ?? defaultLength ?? "";

              return (
                <React.Fragment key={floor}>
                  <tr className="border-b border-black hover:bg-gray-50 transition">
                    
                    {/* 1. Floor Name */}
                    <td className="border-r border-black p-3 font-black text-center uppercase bg-slate-50 min-w-[130px]">
                      {floor}
                    </td>

                    {/* 2. Width */}
                    <td className="border-r border-black p-2.5 text-center">
                      <div className="flex items-center justify-center">
                        <input
                          type="number"
                          value={currentWidth || ""}
                          onChange={(e) => {
                            const w = Number(e.target.value) || 0;
                            const l = Number(currentLength) || 0;
                            setLocalState((prev: Record<string, { width: number; length: number; setbacks: SetbackType }>) => ({
                              ...prev,
                              [floor]: { width: w, length: l, setbacks }
                            }));
                            if (updateFloorDimensions) {
                              updateFloorDimensions(floor, l, w);
                            } else {
                              updateFloorAreaDirect(floor, Number((l * w).toFixed(2)));
                            }
                          }}
                          placeholder="Width"
                          className="w-20 border-2 border-black p-1.5 text-center font-black text-xs bg-white"
                        />
                      </div>
                    </td>

                    {/* 3. Length */}
                    <td className="border-r border-black p-2.5 text-center">
                      <div className="flex items-center justify-center">
                        <input
                          type="number"
                          value={currentLength || ""}
                          onChange={(e) => {
                            const l = Number(e.target.value) || 0;
                            const w = Number(currentWidth) || 0;
                            setLocalState((prev: Record<string, { width: number; length: number; setbacks: SetbackType }>) => ({
                              ...prev,
                              [floor]: { width: w, length: l, setbacks }
                            }));
                            if (updateFloorDimensions) {
                              updateFloorDimensions(floor, l, w);
                            } else {
                              updateFloorAreaDirect(floor, Number((l * w).toFixed(2)));
                            }
                          }}
                          placeholder="Length"
                          className="w-20 border-2 border-black p-1.5 text-center font-black text-xs bg-white"
                        />
                      </div>
                    </td>

                    {/* 4. Built-Up Area */}
                    <td className="border-r border-black p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          value={data.area || ""}
                          onChange={(event) => updateFloorAreaDirect(floor, Number(event.target.value) || 0)}
                          className="w-24 border-2 border-black p-1.5 text-center font-black text-xs bg-white"
                        />
                        <span className="text-[10px] font-black">SQ.FT</span>
                      </div>
                    </td>

                    {/* 5. Template */}
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

                    {/* 6. MOS Button */}
                    <td className="border-r border-black p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setMosEditorFloor(isMosOpen ? null : floor)}
                        className="bg-amber-600 text-white px-3 py-1.5 text-xs font-black shadow hover:bg-amber-700 transition cursor-pointer uppercase"
                      >
                        {isMosOpen ? "CLOSE MOS" : "EDIT MOS"}
                      </button>
                    </td>

                    {/* 7. CAD View */}
                    <td className="border-r border-black p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => openFloorCadModal(floor)}
                        className="bg-blue-600 text-white px-3 py-1.5 text-xs font-black shadow hover:bg-blue-700 transition cursor-pointer uppercase"
                      >
                        CAD VIEW
                      </button>
                    </td>

                    {/* 8. Room Edit */}
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

                  {/* Expandable MOS Editor Row */}
                  {isMosOpen && (
                    <tr className="bg-amber-50 border-b border-black">
                      <td colSpan={8} className="p-3">
                        <div className="border border-amber-600 p-3 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                          <div className="text-xs font-black text-amber-900 col-span-2 sm:col-span-4 uppercase border-b border-amber-300 pb-1">
                            Margin of Setbacks (MOS) for {floor}
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black">FRONT MOS (FT)</span>
                            <input
                              type="number"
                              value={setbacks.front ?? 0}
                              onChange={(e) => {
                                const updated: SetbackType = { ...setbacks, front: Number(e.target.value) || 0 };
                                setLocalState((prev: Record<string, { width: number; length: number; setbacks: SetbackType }>) => ({
                                  ...prev,
                                  [floor]: { width: Number(currentWidth), length: Number(currentLength), setbacks: updated }
                                }));
                                if (updateFloorSetbacks) updateFloorSetbacks(floor, updated);
                              }}
                              className="border border-black p-1.5 text-center text-xs font-bold bg-white"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black">REAR MOS (FT)</span>
                            <input
                              type="number"
                              value={setbacks.rear ?? 0}
                              onChange={(e) => {
                                const updated: SetbackType = { ...setbacks, rear: Number(e.target.value) || 0 };
                                setLocalState((prev: Record<string, { width: number; length: number; setbacks: SetbackType }>) => ({
                                  ...prev,
                                  [floor]: { width: Number(currentWidth), length: Number(currentLength), setbacks: updated }
                                }));
                                if (updateFloorSetbacks) updateFloorSetbacks(floor, updated);
                              }}
                              className="border border-black p-1.5 text-center text-xs font-bold bg-white"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black">LEFT MOS (FT)</span>
                            <input
                              type="number"
                              value={setbacks.left ?? 0}
                              onChange={(e) => {
                                const updated: SetbackType = { ...setbacks, left: Number(e.target.value) || 0 };
                                setLocalState((prev: Record<string, { width: number; length: number; setbacks: SetbackType }>) => ({
                                  ...prev,
                                  [floor]: { width: Number(currentWidth), length: Number(currentLength), setbacks: updated }
                                }));
                                if (updateFloorSetbacks) updateFloorSetbacks(floor, updated);
                              }}
                              className="border border-black p-1.5 text-center text-xs font-bold bg-white"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black">RIGHT MOS (FT)</span>
                            <input
                              type="number"
                              value={setbacks.right ?? 0}
                              onChange={(e) => {
                                const updated: SetbackType = { ...setbacks, right: Number(e.target.value) || 0 };
                                setLocalState((prev: Record<string, { width: number; length: number; setbacks: SetbackType }>) => ({
                                  ...prev,
                                  [floor]: { width: Number(currentWidth), length: Number(currentLength), setbacks: updated }
                                }));
                                if (updateFloorSetbacks) updateFloorSetbacks(floor, updated);
                              }}
                              className="border border-black p-1.5 text-center text-xs font-bold bg-white"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Expandable Room Editor Row */}
                  {isRoomOpen && (
                    <tr className="bg-slate-50 border-b border-black">
                      <td colSpan={8} className="p-3">
                        <div className="border border-black p-3 bg-white overflow-x-auto">
                          <div className="font-black text-xs uppercase mb-2 text-slate-800">Room Configuration for {floor}</div>
                          <table className="w-full border-collapse text-xs sm:text-sm min-w-[500px]">
                            <thead className="bg-slate-200">
                              <tr>
                                <th className="border border-black p-2 font-black">USE</th>
                                <th className="border border-black p-2 font-black">ROOM</th>
                                <th className="border border-black p-2 font-black">NOS</th>
                                <th className="border border-black p-2 font-black">SQ.FT / ROOM</th>
                                <th className="border border-black p-2 font-black">TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ROOM_CATALOG.map((room) => {
                                const current = floorRooms[floor]?.[room.key] || {
                                  selected: false,
                                  count: 1,
                                  areaMode: "AUTO" as const,
                                  areaPerRoom: room.defaultArea,
                                };

                                return (
                                  <tr key={room.key}>
                                    <td className="border border-black p-2 text-center">
                                      <input
                                        type="checkbox"
                                        checked={current.selected}
                                        onChange={() => toggleRoom(floor, room.key)}
                                        className="w-4 h-4 cursor-pointer"
                                      />
                                    </td>
                                    <td className="border border-black p-2 font-bold">{room.label}</td>
                                    <td className="border border-black p-2">
                                      <input
                                        type="number"
                                        min={1}
                                        value={current.count}
                                        disabled={!current.selected}
                                        onChange={(event) => updateRoom(floor, room.key, { count: Math.max(1, Number(event.target.value) || 1) })}
                                        className="w-full border border-black p-1.5 text-center font-bold bg-white text-xs"
                                      />
                                    </td>
                                    <td className="border border-black p-2">
                                      <input
                                        type="number"
                                        min={room.minArea}
                                        step="0.01"
                                        disabled={!current.selected}
                                        value={current.areaPerRoom}
                                        onChange={(event) => updateRoom(floor, room.key, { areaPerRoom: Number(event.target.value) || 0 })}
                                        className="w-full border border-black p-1.5 text-center font-bold bg-white text-xs"
                                      />
                                    </td>
                                    <td className="border border-black p-2 text-center font-black text-xs">
                                      {(Number(current.count || 0) * Number(current.areaPerRoom || 0)).toFixed(2)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
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