"use client";

import React from "react";
import { FloorData, FloorRoom } from "@/lib/constructionPlan/types";
import { ROOM_CATALOG } from "@/lib/constructionPlan/roomRules";

interface FloorManagerSectionProps {
  selectedFloors: string[];
  floorData: Record<string, FloorData>;
  floorBhkConfig: Record<string, string>;
  roomEditorFloor: string | null;
  floorRooms: Record<string, Record<string, FloorRoom>>;
  updateFloorAreaDirect: (floor: string, area: number) => void;
  applyBhkTemplate: (floor: string, bhkType: string) => void;
  openFloorCadModal: (floor: string) => void;
  ensureFloorRooms: (floor: string) => void;
  setRoomEditorFloor: (floor: string | null) => void;
  toggleRoom: (floor: string, roomKey: string) => void;
  updateRoom: (floor: string, roomKey: string, patch: Partial<FloorRoom>) => void;
  BHK_CONFIGURATIONS: readonly string[];
}

export default function FloorManagerSection({
  selectedFloors,
  floorData,
  floorBhkConfig,
  roomEditorFloor,
  floorRooms,
  updateFloorAreaDirect,
  applyBhkTemplate,
  openFloorCadModal,
  ensureFloorRooms,
  setRoomEditorFloor,
  toggleRoom,
  updateRoom,
  BHK_CONFIGURATIONS,
}: FloorManagerSectionProps) {
  return (
    <div className="border border-black mb-4">
      <div className="bg-slate-900 text-white p-2.5 text-center font-black text-xl tracking-wide">
        FLOOR-WISE BUILT-UP AREA & ROOM PLANNING
      </div>

      {selectedFloors.map((floor) => {
        const data: FloorData = floorData[floor] || { length: 0, width: 0, area: 0 };
        const currentBhk = floorBhkConfig[floor] || "CUSTOM";

        return (
          <div key={floor} className="border-b border-black last:border-b-0 p-4 bg-white space-y-3">
            <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-4 border border-black">
              {/* Floor Name Font Size Increased */}
              <div className="font-black text-lg uppercase min-w-[160px]">{floor}</div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-black">BUILT-UP AREA:</span>
                <input
                  type="number"
                  value={data.area || ""}
                  onChange={(event) => updateFloorAreaDirect(floor, Number(event.target.value) || 0)}
                  className="w-36 border-2 border-black p-2 text-center text-base font-black bg-white"
                />
                <span className="text-sm font-black ml-1">SQ.FT</span>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm font-black">TEMPLATE:</span>
                <select
                  value={currentBhk}
                  onChange={(e) => applyBhkTemplate(floor, e.target.value)}
                  className="border-2 border-black p-2 text-sm font-black bg-white min-w-[120px]"
                >
                  {BHK_CONFIGURATIONS.map((bhk) => (
                    <option key={bhk} value={bhk}>{bhk}</option>
                  ))}
                </select>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openFloorCadModal(floor)}
                  className="bg-blue-600 text-white px-5 py-2.5 text-xs font-black shadow hover:bg-blue-700 transition cursor-pointer"
                >
                  FLOOR CAD VIEW
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ensureFloorRooms(floor);
                    setRoomEditorFloor(roomEditorFloor === floor ? null : floor);
                  }}
                  className="bg-black text-white px-5 py-2.5 text-xs font-black shadow hover:bg-zinc-800 transition cursor-pointer"
                >
                  {roomEditorFloor === floor ? "CLOSE TABLE" : "ADD & EDIT ROOMS"}
                </button>
              </div>
            </div>

            {roomEditorFloor === floor && (
              <div className="p-3 border border-black bg-slate-50">
                <div className="border border-black overflow-x-auto bg-white">
                  <table className="w-full border-collapse text-sm">
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
                            <td className="border border-black p-2 font-bold text-sm">{room.label}</td>
                            <td className="border border-black p-2">
                              <input
                                type="number"
                                min={1}
                                value={current.count}
                                disabled={!current.selected}
                                onChange={(event) => updateRoom(floor, room.key, { count: Math.max(1, Number(event.target.value) || 1) })}
                                className="w-full border border-black p-1.5 text-center text-sm font-bold bg-white"
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
                                className="w-full border border-black p-1.5 text-center text-sm font-bold bg-white"
                              />
                            </td>
                            <td className="border border-black p-2 text-center font-black text-sm">
                              {(Number(current.count || 0) * Number(current.areaPerRoom || 0)).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}