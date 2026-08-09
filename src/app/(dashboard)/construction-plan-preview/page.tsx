"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateCompleteConstructionPlan } from "@/lib/constructionPlan/planGenerator";
import { generateCadVectorBlueprint } from "@/lib/constructionPlan/cad/cadRenderer";
import { calculateDoorsAndWindows } from "@/lib/constructionPlan/doorWindowRules";

export default function ConstructionPlanPreviewPage() {
  const router = useRouter();

  const [sheetData, setSheetData] = useState<any>(null);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [cadBlueprint, setCadBlueprint] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.85);
  const [selectedFloorModal, setSelectedFloorModal] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("estimatePreview");

      if (!raw) {
        router.push("/construction-plan");
        return;
      }

      const parsed = JSON.parse(raw);
      const selectedFloors = Array.isArray(parsed.selected_floors) && parsed.selected_floors.length > 0
        ? parsed.selected_floors
        : ["GROUND FLOOR"];

      const normalized = {
        ...parsed,
        selected_floors: selectedFloors,
        floor_details: parsed.floor_details || {},
        room_details: parsed.room_details || {},
      };

      const completePlan = generateCompleteConstructionPlan(normalized);

      const blueprint = generateCadVectorBlueprint(
        normalized.dimensions || { A: 20, B: 20, C: 40, D: 40 },
        completePlan.footprint,
        normalized.floor_details,
        normalized.room_details,
        selectedFloors,
        normalized.road_side || ""
      );

      setSheetData(normalized);
      setGeneratedPlan(completePlan);
      setCadBlueprint(blueprint);
    } catch (err: any) {
      console.error("Construction plan preview error:", err);
      setError(err?.message || "Unable to generate construction plan.");
    }
  }, [router]);

  const floors = useMemo(() => {
    if (!sheetData) return ["GROUND FLOOR"];
    return Array.isArray(sheetData.selected_floors) && sheetData.selected_floors.length > 0
      ? sheetData.selected_floors
      : ["GROUND FLOOR"];
  }, [sheetData]);

  const floorDetails = sheetData?.floor_details || {};
  const roomDetails = sheetData?.room_details || {};
  const dimensions = sheetData?.dimensions || { A: 20, B: 20, C: 40, D: 40 };

  const residentialFloors = floors.filter((floor: string) => floor !== "BASEMENT" && floor !== "TOWER");
  const hasTower = floors.includes("TOWER");

  const totalBuiltUp = floors.reduce((sum: number, floor: string) => {
    return sum + Number(floorDetails?.[floor]?.area || 0);
  }, 0);

  const doorWindowSpecs = calculateDoorsAndWindows(
    totalBuiltUp,
    residentialFloors.length,
    hasTower
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="border-2 border-black p-6 max-w-xl w-full text-center">
          <h2 className="font-black text-red-600 text-xl mb-3">RENDER ERROR</h2>
          <p className="font-bold text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={() => router.push("/construction-plan")}
            className="bg-black text-white px-5 py-2 font-black text-xs"
          >
            BACK TO EDITOR
          </button>
        </div>
      </div>
    );
  }

  if (!sheetData || !generatedPlan || !cadBlueprint) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white font-black text-xs tracking-widest">
        GENERATING ARCHITECTURAL DRAWING...
      </div>
    );
  }

  const metadata = sheetData.metadata || {};
  const formattedFloorsTitle = floors.join(" + ");

  const plotWidthFt = Number(dimensions.A || 20);
  const plotDepthFt = Number(dimensions.C || 40);

  const renderDoor = (room: any, index: number) => {
    if (!room.door) return null;

    const door = room.door;
    const key = `door-${room.key}-${index}`;

    if (door.side === "BOTTOM") {
      const x = room.x + door.offset;
      const y = room.y + room.h;
      return (
        <g key={key}>
          <rect x={x} y={y - 1.5} width={door.width} height={3} fill="white" stroke="white" strokeWidth="3" />
          <line x1={x} y1={y} x2={x + door.width} y2={y} stroke="black" strokeWidth="1" />
          <path d={`M ${x} ${y} A ${door.width} ${door.width} 0 0 1 ${x + door.width} ${y - door.width}`} fill="none" stroke="black" strokeWidth="0.8" />
        </g>
      );
    }

    return null;
  };

  const renderWindows = (room: any, index: number) => {
    if (!Array.isArray(room.windows)) return null;

    return room.windows.map((window: any, wIndex: number) => {
      const key = `window-${room.key}-${index}-${wIndex}`;

      if (window.side === "TOP") {
        const x = room.x + window.offset;
        const y = room.y;
        return (
          <g key={key}>
            <rect x={x} y={y - 1.5} width={window.width} height={3} fill="white" stroke="white" strokeWidth="3" />
            <line x1={x} y1={y} x2={x + window.width} y2={y} stroke="#2563eb" strokeWidth="2" />
            <line x1={x + window.width / 2} y1={y - 1.5} x2={x + window.width / 2} y2={y + 1.5} stroke="#2563eb" strokeWidth="0.7" />
          </g>
        );
      }

      return null;
    });
  };

  const renderFloorPlan = (floorName: string, modal = false) => {
    const rooms = cadBlueprint.getRoomsForFloor(floorName);

    if (rooms.length === 0) return null;

    const svgHeight = modal ? 650 : 400;

    return (
      <svg
        viewBox={cadBlueprint.viewBox}
        className={`w-full bg-white ${modal ? "h-[650px]" : "h-[400px]"}`}
      >
        <defs>
          <pattern
            id={`wall-hatch-${modal ? "modal-" : ""}${floorName.replace(/[^a-z0-9]/gi, "-")}`}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="4" stroke="black" strokeWidth="0.8" />
          </pattern>
        </defs>

        {/* True floor boundary / external wall */}
        <rect
          x="20"
          y="20"
          width={cadBlueprint.plotWidth}
          height={cadBlueprint.plotDepth}
          fill="white"
          stroke="black"
          strokeWidth={cadBlueprint.externalWallThickness}
        />

        {/* Inner room walls */}
        {rooms.map((room: any, index: number) => {
          if (room.isOpen) return null;

          return (
            <g key={`room-${room.key}-${index}`}>
              <rect
                x={room.x}
                y={room.y}
                width={room.w}
                height={room.h}
                fill="white"
                stroke="black"
                strokeWidth={room.wallThickness || cadBlueprint.internalWallThickness}
              />

              {room.isStairs ? (
                <g>
                  <text
                    x={room.x + room.w / 2}
                    y={room.y + 15}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="900"
                  >
                    STAIRCASE — UP
                  </text>

                  {Array.from({ length: 9 }).map((_, step) => {
                    const yy = room.y + 25 + (step * Math.max(8, room.h - 40)) / 8;
                    return (
                      <line
                        key={step}
                        x1={room.x + 5}
                        y1={yy}
                        x2={room.x + room.w - 5}
                        y2={yy}
                        stroke="black"
                        strokeWidth="0.8"
                      />
                    );
                  })}
                </g>
              ) : room.isParking ? (
                <text
                  x={room.x + room.w / 2}
                  y={room.y + room.h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="8"
                  fontWeight="900"
                >
                  PARKING
                </text>
              ) : (
                <>
                  <text
                    x={room.x + room.w / 2}
                    y={room.y + room.h / 2 - 4}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={modal ? 8 : 6}
                    fontWeight="900"
                  >
                    {room.name}
                  </text>
                  <text
                    x={room.x + room.w / 2}
                    y={room.y + room.h / 2 + 7}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={modal ? 6 : 5}
                    fontWeight="700"
                  >
                    {room.area} SQ.FT
                  </text>
                </>
              )}

              {renderDoor(room, index)}
              {renderWindows(room, index)}
            </g>
          );
        })}

        {/* Remaining circulation/open area is intentionally not boxed. */}
        {rooms.filter((room: any) => room.isOpen).map((room: any, index: number) => (
          <text
            key={`open-${index}`}
            x={room.x + room.w / 2}
            y={room.y + room.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={modal ? 6 : 4.5}
            fontWeight="700"
            fill="#64748b"
          >
            {room.name}
          </text>
        ))}

        <text
          x={cadBlueprint.plotWidth / 2 + 20}
          y="12"
          textAnchor="middle"
          fontSize="8"
          fontWeight="900"
        >
          NORTH ↑
        </text>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 text-black p-4 flex flex-col items-center">
      <div className="w-full max-w-[1450px] flex justify-between items-center mb-4 bg-white p-3 border-2 border-black shadow-md print:hidden">
        <button
          type="button"
          onClick={() => router.push("/construction-plan")}
          className="border border-black px-4 py-2 text-xs font-black bg-gray-100"
        >
          ← BACK TO EDITOR
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black">SHEET ZOOM</span>
          <button type="button" onClick={() => setZoomLevel((v) => Math.max(0.5, v - 0.1))} className="px-3 py-1 bg-gray-200 border border-black font-black">−</button>
          <span className="w-12 text-center text-xs font-black">{Math.round(zoomLevel * 100)}%</span>
          <button type="button" onClick={() => setZoomLevel((v) => Math.min(1.5, v + 0.1))} className="px-3 py-1 bg-gray-200 border border-black font-black">+</button>
          <button type="button" onClick={() => setZoomLevel(0.85)} className="px-3 py-1 bg-black text-white font-black text-xs">RESET</button>
        </div>

        <button type="button" onClick={() => window.print()} className="bg-black text-white px-6 py-2 text-xs font-black">
          PRINT / SAVE PDF
        </button>
      </div>

      <div className="w-full overflow-auto flex justify-center py-4 bg-gray-200">
        <div
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center" }}
          className="border-2 border-black w-[1350px] bg-white text-[9px] grid grid-cols-12 shadow-2xl shrink-0"
        >
          <div className="col-span-9 border-r-2 border-black p-3 flex flex-col gap-3">
            <div className="border-b-2 border-black pb-2">
              <div className="text-center font-black text-sm">
                PROPOSED RESIDENTIAL BUILDING ON {formattedFloorsTitle}
              </div>
              <div className="text-center text-[8px] font-bold mt-1">
                PLOT: {generatedPlan.plotArea} SQ.FT | {plotWidthFt}' × {plotDepthFt}' | ROAD: {sheetData.road_side || "NOT SPECIFIED"}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 items-start">
              {floors.map((floorName: string) => {
                const fArea = Number(floorDetails?.[floorName]?.area || 0);
                const rooms = roomDetails?.[floorName] || {};

                return (
                  <div key={floorName} className="flex flex-col bg-white relative">
                    <button
                      type="button"
                      onClick={() => setSelectedFloorModal({ title: floorName, type: "floor" })}
                      className="absolute top-1 right-1 bg-black text-white text-[7px] px-2 py-1 font-black z-10 print:hidden"
                    >
                      🔍 ZOOM
                    </button>

                    <div className="border border-black">
                      {renderFloorPlan(floorName)}
                    </div>

                    <div className="text-center mt-1">
                      <div className="font-black text-[9px]">{floorName}</div>
                      <div className="font-bold text-[8px] text-gray-700">{fArea.toFixed(2)} SQ.FT</div>
                      <div className="text-[7px] text-gray-500">
                        ROOMS: {Object.values(rooms).filter((r: any) => r?.selected).length}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-col bg-white relative">
                <div className="border border-black">
                  <svg viewBox={`0 0 ${cadBlueprint.plotWidth + 160} ${cadBlueprint.plotDepth + 100}`} className="w-full h-[400px] bg-white">
                    <text x={60 + cadBlueprint.plotWidth / 2} y="18" textAnchor="middle" fontSize="9" fontWeight="900">NORTH</text>
                    <rect x="60" y="40" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="white" stroke="black" strokeWidth="2" />
                    <text x={60 + cadBlueprint.plotWidth / 2} y={40 + cadBlueprint.plotDepth / 2} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="900">PROPOSED SITE</text>
                    <text x={60 + cadBlueprint.plotWidth / 2} y={40 + cadBlueprint.plotDepth + 20} textAnchor="middle" fontSize="9" fontWeight="900">
                      {sheetData.boundaries?.south || "ROAD"}
                    </text>
                    <text x={60 + cadBlueprint.plotWidth / 2} y="34" textAnchor="middle" fontSize="8" fontWeight="900">
                      {sheetData.boundaries?.north || "NORTH BOUNDARY"}
                    </text>
                    <text x="35" y={40 + cadBlueprint.plotDepth / 2} textAnchor="middle" transform={`rotate(-90 35 ${40 + cadBlueprint.plotDepth / 2})`} fontSize="8" fontWeight="900">
                      {sheetData.boundaries?.west || "WEST BOUNDARY"}
                    </text>
                    <text x={cadBlueprint.plotWidth + 85} y={40 + cadBlueprint.plotDepth / 2} textAnchor="middle" transform={`rotate(90 ${cadBlueprint.plotWidth + 85} ${40 + cadBlueprint.plotDepth / 2})`} fontSize="8" fontWeight="900">
                      {sheetData.boundaries?.east || "EAST BOUNDARY"}
                    </text>
                    <rect x="60" y={40 + cadBlueprint.plotDepth} width={cadBlueprint.plotWidth} height="20" fill="#e2e8f0" stroke="black" />
                    <text x={60 + cadBlueprint.plotWidth / 2} y={40 + cadBlueprint.plotDepth + 14} textAnchor="middle" fontSize="8" fontWeight="900">ROAD</text>
                  </svg>
                </div>
                <div className="text-center mt-1">
                  <div className="font-black text-[9px]">SITE PLAN</div>
                  <div className="font-bold text-[8px]">PLOT: {generatedPlan.plotArea} SQ.FT</div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-3 bg-gray-50 p-3 flex flex-col gap-3">
            <div className="border border-black p-2 bg-white text-center">
              <div className="font-black text-[10px]">AREA STATEMENT</div>
            </div>

            <div className="space-y-1 text-[9px]">
              <div className="border border-black bg-white p-1">
                <b>CUSTOMER:</b> {metadata?.customerName || sheetData.customer_name || "N/A"}
              </div>
              <div className="border border-black bg-white p-1">
                <b>ADDRESS:</b> {metadata?.propertyAddress || sheetData.property_address || "N/A"}
              </div>
            </div>

            <div className="border border-black bg-white p-2 text-[9px]">
              <div className="font-black border-b border-black pb-1 mb-1">FLOOR-WISE BUILT-UP</div>
              <div className="flex justify-between"><b>PLOT</b><b>{generatedPlan.plotArea} SQ.FT</b></div>
              {floors.map((floor: string) => (
                <div key={floor} className="flex justify-between">
                  <span>{floor}</span>
                  <b>{Number(floorDetails?.[floor]?.area || 0).toFixed(2)}</b>
                </div>
              ))}
              <div className="flex justify-between border-t border-black mt-1 pt-1 font-black">
                <span>TOTAL</span><span>{totalBuiltUp.toFixed(2)}</span>
              </div>
            </div>

            <div className="border border-black bg-white p-2 text-[9px]">
              <div className="font-black border-b border-black pb-1 mb-1">ROOM INPUT</div>
              {floors.map((floor: string) => {
                const selected = Object.entries(roomDetails?.[floor] || {})
                  .filter(([, room]: any) => room?.selected)
                  .map(([key, room]: any) => `${key} × ${room.count || 1}`);
                return (
                  <div key={floor} className="mb-1">
                    <div className="font-black">{floor}</div>
                    <div>{selected.length ? selected.join(", ") : "NO ROOMS SELECTED"}</div>
                  </div>
                );
              })}
            </div>

            <div className="border border-black bg-white p-2 text-[9px]">
              <div className="font-black border-b border-black pb-1 mb-1">ENGINE SPECIFICATIONS</div>
              <div className="flex justify-between"><span>Main Doors</span><b>{doorWindowSpecs.mainDoors}</b></div>
              <div className="flex justify-between"><span>Internal Doors</span><b>{doorWindowSpecs.internalDoors}</b></div>
              <div className="flex justify-between"><span>Bathroom Doors</span><b>{doorWindowSpecs.bathroomDoors}</b></div>
              <div className="flex justify-between"><span>Windows</span><b>{doorWindowSpecs.windows}</b></div>
              <div className="flex justify-between"><span>Ventilators</span><b>{doorWindowSpecs.ventilators}</b></div>
            </div>

            <div className="border border-black bg-white p-2 text-[8px]">
              <div className="font-black">WALL SPECIFICATION</div>
              <div>EXTERNAL WALL: 8 INCH</div>
              <div>INTERNAL PARTITION: 4 INCH</div>
              <div>STAIR: 3.5 FT NOMINAL WIDTH</div>
            </div>
          </div>
        </div>
      </div>

      {selectedFloorModal && selectedFloorModal.type === "floor" && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border-2 border-black w-full max-w-6xl p-4 shadow-2xl">
            <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
              <h3 className="font-black text-sm">ZOOMED FLOOR PLAN — {selectedFloorModal.title}</h3>
              <button type="button" onClick={() => setSelectedFloorModal(null)} className="bg-black text-white px-4 py-2 text-xs font-black">CLOSE</button>
            </div>
            <div className="border border-black bg-white">
              {renderFloorPlan(selectedFloorModal.title, true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
