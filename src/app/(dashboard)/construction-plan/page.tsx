"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Import modular engines
import { PlotDimensions, PlotShape, PlotSide, FloorData, FloorRoom, CadTool, CadObject, CadPoint } from "@/lib/constructionPlan/types";
import { ROOM_CATALOG, DEFAULT_ROOM_SELECTION, BHK_PRESETS, getRoomDefinition, calculateRoomAutoArea } from "@/lib/constructionPlan/roomRules";
import { validateConstructionPlan } from "@/lib/constructionPlan/floorValidation";
import { calculatePlotArea } from "@/lib/constructionPlan/plotEngine";
import { calculateSetbacks } from "@/lib/constructionPlan/setbackRules";
import { assessVastuForRoom } from "@/lib/constructionPlan/vastuRules";
import { calculateStaircase } from "@/lib/constructionPlan/staircaseRules";
import { calculateDoorsAndWindows } from "@/lib/constructionPlan/doorWindowRules";
import { calculateBuildableFootprint } from "@/lib/constructionPlan/layoutEngine";
import { prepareSheetLayout } from "@/lib/constructionPlan/sheetEngine";

const DEFAULT_FLOORS = ["GROUND FLOOR"];

const FLOOR_SEQUENCE = [
  "BASEMENT",
  "GROUND FLOOR",
  "FIRST FLOOR",
  "SECOND FLOOR",
  "THIRD FLOOR",
  "FOURTH FLOOR",
  "FIFTH FLOOR",
  "SIXTH FLOOR",
  "SEVENTH FLOOR",
  "EIGHTH FLOOR",
  "NINTH FLOOR",
  "TENTH FLOOR",
  "TOWER",
];

const EXTRA_FLOORS = FLOOR_SEQUENCE.filter(
  (floor) => floor !== "GROUND FLOOR"
);

const PLOT_SHAPES = [
  "RECTANGULAR",
  "SQUARE",
  "IRREGULAR / L-SHAPE",
  "TRAPEZOIDAL",
  "POLYGON",
] as const;

const ROAD_FACING_OPTIONS = [
  "1 SIDE ROAD (NORTH)",
  "1 SIDE ROAD (SOUTH)",
  "1 SIDE ROAD (EAST)",
  "1 SIDE ROAD (WEST)",
  "CORNER (2 SIDE ROAD: NORTH & EAST)",
  "CORNER (2 SIDE ROAD: SOUTH & EAST)",
  "CORNER (2 SIDE ROAD: NORTH & WEST)",
  "CORNER (2 SIDE ROAD: SOUTH & WEST)",
  "2 SIDE FRONT & REAR (NORTH & SOUTH)",
  "2 SIDE FRONT & REAR (EAST & WEST)",
  "3 SIDE ROAD",
  "4 SIDE ROAD (ISLAND / OPEN)",
] as const;

function sortFloors(floors: string[]): string[] {
  return [...floors].sort(
    (a, b) =>
      FLOOR_SEQUENCE.indexOf(a) - FLOOR_SEQUENCE.indexOf(b)
  );
}

export default function ConstructionPlanInputPage() {
  const router = useRouter();

  const [clients, setClients] = useState<any[]>([]);
  const [representative, setRepresentative] = useState("");
  const [filteredReps, setFilteredReps] = useState<string[]>([]);
  const [allRepresentatives, setAllRepresentatives] = useState<string[]>([]);

  const [selectedClientName, setSelectedClientName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");

  const [caseType, setCaseType] = useState("NEW CONSTRUCTION DESIGN");
  const [feeMode, setFeeMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [manualFee, setManualFee] = useState(0);
  const [registeredFee, setRegisteredFee] = useState(0);

  const [rate, setRate] = useState(0);
  const [amount, setAmount] = useState(0);
  const [currentRefNo, setCurrentRefNo] = useState("");

  const [plotShape, setPlotShape] = useState<(typeof PLOT_SHAPES)[number]>("RECTANGULAR");
  const [roadFacingOption, setRoadFacingOption] = useState("1 SIDE ROAD (SOUTH)");

  const [plotDimensions, setPlotDimensions] = useState<PlotDimensions>({
    A: 20,
    B: 20,
    C: 40,
    D: 40,
  });

  const [autoDimensionSide, setAutoDimensionSide] = useState<PlotSide>("B");
  const [boundaryNorth, setBoundaryNorth] = useState("ARAJI OF DEEPAK SINGH");
  const [boundarySouth, setBoundarySouth] = useState("20' WIDE ROAD");
  const [boundaryEast, setBoundaryEast] = useState("ARAJI OF SANCHIT SHUKLA");
  const [boundaryWest, setBoundaryWest] = useState("REMAINING ARAJI OF THE SELLER");
  const [coverageType, setCoverageType] = useState("AS PER NORMS");

  const [isCadModalOpen, setIsCadModalOpen] = useState(false);
  const [selectedFloors, setSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [tempSelectedFloors, setTempSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [floorData, setFloorData] = useState<Record<string, FloorData>>({});

  const [floorRooms, setFloorRooms] = useState<Record<string, Record<string, FloorRoom>>>({});
  const [roomEditorFloor, setRoomEditorFloor] = useState<string | null>(null);
  const [bhkPreset, setBhkPreset] = useState<"1 RK" | "1 BHK" | "2 BHK" | "3 BHK" | "">("");

  const [cadTool, setCadTool] = useState<CadTool>("SELECT");
  const [cadObjects, setCadObjects] = useState<CadObject[]>([]);
  const [selectedCadObjectIds, setSelectedCadObjectIds] = useState<string[]>([]);
  const [cadPoints, setCadPoints] = useState<CadPoint[]>([]);
  const [cadText, setCadText] = useState("");
  const [cadRotation, setCadRotation] = useState(90);
  const [orthMode, setOrthMode] = useState(true);
  const [osnapMode, setOsnapMode] = useState(true);
  const [cadZoom, setCadZoom] = useState(1);

  useEffect(() => {
    const savedData = localStorage.getItem("estimateData") || localStorage.getItem("estimatePreview");
    if (!savedData) return;

    try {
      const parsed = JSON.parse(savedData);
      setCurrentRefNo(parsed.ref_no || "");
      setCustomerName(parsed.customer_name || "");
      setPropertyAddress(parsed.property_address || "");
      setSelectedClientName(parsed.client_name || parsed.selected_client_name || "");
      setRepresentative(parsed.representative || "");
      setRate(Number(parsed.rate_per_sqft) || 0);
      setFeeMode(parsed.fee_mode === "MANUAL" ? "MANUAL" : "AUTO");
      setManualFee(Number(parsed.fee_amount) || 0);

      if (parsed.plot_shape) setPlotShape(parsed.plot_shape);
      if (parsed.dimensions) {
        setPlotDimensions({
          A: Number(parsed.dimensions.A ?? 20),
          B: Number(parsed.dimensions.B ?? 20),
          C: Number(parsed.dimensions.C ?? 40),
          D: Number(parsed.dimensions.D ?? 40),
        });
      }
      if (parsed.floor_details) {
        setFloorData(parsed.floor_details);
        const floors = Object.keys(parsed.floor_details);
        setSelectedFloors(sortFloors(floors));
        setTempSelectedFloors(sortFloors(floors));
      }
      if (parsed.room_details) setFloorRooms(parsed.room_details);
      if (parsed.cad_objects) setCadObjects(parsed.cad_objects);
    } catch (error) {
      console.error("Failed to restore construction plan:", error);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from("clients").select("client_name, representative_name");
      if (error) {
        console.error("Client fetch error:", error);
        return;
      }
      const rows = data || [];
      setClients(rows);
      const reps = rows.map((row) => row.representative_name).filter((name): name is string => typeof name === "string" && name.trim() !== "");
      setAllRepresentatives(Array.from(new Set(reps)));
      setFilteredReps(Array.from(new Set(reps)));
    };
    fetchData();
  }, []);

  // Use plotEngine for accurate area computation
  const plotArea = useMemo(() => calculatePlotArea(plotDimensions, plotShape), [plotDimensions, plotShape]);

  // Use setback rules engine
  const setbacks = useMemo(() => calculateSetbacks(plotArea, 20, roadFacingOption.includes("CORNER")), [plotArea, roadFacingOption]);
  const buildableFootprint = useMemo(() => calculateBuildableFootprint(plotDimensions, setbacks), [plotDimensions, setbacks]);

  const handleClientChange = async (name: string) => {
    setSelectedClientName(name);
    const matches = clients.filter((client) => client.client_name === name && client.representative_name).map((client) => String(client.representative_name));
    const uniqueReps = Array.from(new Set(matches));
    setFilteredReps(uniqueReps.length > 0 ? uniqueReps : allRepresentatives);
    setRepresentative(uniqueReps.length === 1 ? uniqueReps[0] : "");

    const { data } = await supabase.from("clients").select("estimate_fee").eq("client_name", name).maybeSingle();
    setRegisteredFee(Number(data?.estimate_fee || 0));
  };

  const updateFloorArea = (floor: string, field: "length" | "width", value: number) => {
    const previous: FloorData = floorData[floor] || { length: 0, width: 0, area: 0 };
    const next: FloorData = { ...previous, [field]: value };
    next.area = Number((next.length * next.width).toFixed(2));

    if (plotArea > 0 && next.area > plotArea) {
      alert(`${floor}: Floor area ${next.area.toFixed(2)} SQ.FT cannot exceed plot area ${plotArea.toFixed(2)} SQ.FT.`);
      return;
    }

    const updated = { ...floorData, [floor]: next };
    setFloorData(updated);
    const total = Object.values(updated).reduce((sum, item) => sum + Number(item.area || 0), 0);
    setAmount(Number((total * rate).toFixed(2)));
  };

  const ensureFloorRooms = (floor: string) => {
    setFloorRooms((previous) => {
      if (previous[floor]) return previous;
      const next: Record<string, FloorRoom> = {};
      DEFAULT_ROOM_SELECTION.forEach((roomKey) => {
        const room = getRoomDefinition(roomKey);
        next[roomKey] = { selected: true, count: 1, areaMode: "AUTO", areaPerRoom: room.defaultArea };
      });
      return { ...previous, [floor]: next };
    });
  };

  const applyBhkPreset = (floor: string, preset: keyof typeof BHK_PRESETS) => {
    const floorArea = Number(floorData[floor]?.area || 0);
    const next: Record<string, FloorRoom> = {};

    BHK_PRESETS[preset].forEach(([roomKey, count]) => {
      const room = getRoomDefinition(roomKey);
      const autoArea = calculateRoomAutoArea(room, floorArea, floor === "GROUND FLOOR");
      next[roomKey] = { selected: true, count: Number(count), areaMode: "AUTO", areaPerRoom: autoArea };
    });

    setFloorRooms((previous) => ({ ...previous, [floor]: next }));
    setBhkPreset(preset);
  };

  const toggleRoom = (floor: string, roomKey: string) => {
    const room = getRoomDefinition(roomKey);
    setFloorRooms((previous) => {
      const floorRoomsData = previous[floor] || {};
      const current = floorRoomsData[roomKey] || { selected: false, count: 1, areaMode: "AUTO" as const, areaPerRoom: room.defaultArea };
      return { ...previous, [floor]: { ...floorRoomsData, [roomKey]: { ...current, selected: !current.selected } } };
    });
  };

  const updateRoom = (floor: string, roomKey: string, patch: Partial<FloorRoom>) => {
    const room = getRoomDefinition(roomKey);
    setFloorRooms((previous) => {
      const floorRoomsData = previous[floor] || {};
      const current = floorRoomsData[roomKey] || { selected: true, count: 1, areaMode: "AUTO" as const, areaPerRoom: room.defaultArea };
      return { ...previous, [floor]: { ...floorRoomsData, [roomKey]: { ...current, ...patch } } };
    });
  };

  const getFloorRoomTotal = (floor: string): number => {
    const rooms = floorRooms[floor] || {};
    return Object.values(rooms).filter((room) => room.selected).reduce((sum, room) => sum + Number(room.count || 0) * Number(room.areaPerRoom || 0), 0);
  };

  const refreshAutoRoomAreas = (floor: string) => {
    const floorArea = Number(floorData[floor]?.area || 0);
    setFloorRooms((previous) => {
      const currentFloor = previous[floor] || {};
      const updatedFloor: Record<string, FloorRoom> = {};
      Object.entries(currentFloor).forEach(([roomKey, room]) => {
        if (!room.selected || room.areaMode !== "AUTO") {
          updatedFloor[roomKey] = room;
          return;
        }
        const definition = getRoomDefinition(roomKey);
        updatedFloor[roomKey] = { ...room, areaPerRoom: calculateRoomAutoArea(definition, floorArea, floor === "GROUND FLOOR") };
      });
      return { ...previous, [floor]: updatedFloor };
    });
  };

  const totalBuiltUpArea = useMemo(() => Object.values(floorData).reduce((sum, floor) => sum + Number(floor.area || 0), 0), [floorData]);

  // Use door/window calculation engine
  const residentialFloors = selectedFloors.filter((floor) => floor !== "BASEMENT" && floor !== "TOWER");
  const floorCount = residentialFloors.length;
  const hasTower = selectedFloors.includes("TOWER");
  const doorWindowSpec = useMemo(() => calculateDoorsAndWindows(totalBuiltUpArea, floorCount, hasTower), [totalBuiltUpArea, floorCount, hasTower]);

  const cadPlotPoints = useMemo(() => {
    const A = plotDimensions.A || 1;
    const B = plotDimensions.B || A;
    const C = plotDimensions.C || 1;
    const D = plotDimensions.D || C;

    if (plotShape === "SQUARE") return [{ x: 0, y: 0 }, { x: A, y: 0 }, { x: A, y: A }, { x: 0, y: A }];
    if (plotShape === "RECTANGULAR") return [{ x: 0, y: 0 }, { x: A, y: 0 }, { x: A, y: C }, { x: 0, y: C }];
    return [{ x: 0, y: 0 }, { x: A, y: 0 }, { x: B, y: C }, { x: Math.max(0, B - D), y: D }];
  }, [plotDimensions, plotShape]);

  const cadScale = useMemo(() => {
    const maxX = Math.max(...cadPlotPoints.map((point) => point.x), 1);
    const maxY = Math.max(...cadPlotPoints.map((point) => point.y), 1);
    return Math.min(620 / maxX, 480 / maxY);
  }, [cadPlotPoints]);

  const scaledPlotPoints = cadPlotPoints.map((point) => ({ x: point.x * cadScale, y: point.y * cadScale }));

  const setCadCommand = (command: CadTool) => {
    setCadTool(command);
    setCadPoints([]);
    setCadText("");
  };

  const toggleCadSelection = (id: string) => {
    setSelectedCadObjectIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  };

  const deleteSelectedCadObjects = () => {
    if (selectedCadObjectIds.length === 0) return;
    setCadObjects((previous) => previous.filter((object) => !selectedCadObjectIds.includes(object.id)));
    setSelectedCadObjectIds([]);
  };

  const rotateSelectedCadObjects = (degrees: number) => {
    if (selectedCadObjectIds.length === 0) return;
    setCadObjects((previous) => previous.map((object) => selectedCadObjectIds.includes(object.id) ? { ...object, rotation: (object.rotation || 0) + degrees } : object));
  };

  const copySelectedCadObjects = () => {
    if (selectedCadObjectIds.length === 0) return;
    const copies = cadObjects.filter((object) => selectedCadObjectIds.includes(object.id)).map((object) => ({
      ...object,
      id: `${object.id}-COPY-${Date.now()}-${Math.random()}`,
      points: object.points.map((point) => ({ x: point.x + 20, y: point.y + 20 })),
    }));
    setCadObjects((previous) => [...previous, ...copies]);
    setSelectedCadObjectIds(copies.map((object) => object.id));
  };

  const addCadObject = (object: Omit<CadObject, "id">) => {
    const newObject: CadObject = { ...object, id: `CAD-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    setCadObjects((previous) => [...previous, newObject]);
    setSelectedCadObjectIds([newObject.id]);
  };

  const handleCadCanvasClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    let x = (event.clientX - rect.left) / cadZoom;
    let y = (event.clientY - rect.top) / cadZoom;

    if (orthMode && cadPoints.length > 0) {
      const last = cadPoints[cadPoints.length - 1];
      if (Math.abs(x - last.x) > Math.abs(y - last.y)) y = last.y;
      else x = last.x;
    }

    const point = { x, y };

    if (cadTool === "LINE" || cadTool === "PLINE") {
      const nextPoints = [...cadPoints, point];
      setCadPoints(nextPoints);
      if (cadTool === "LINE" && nextPoints.length === 2) {
        addCadObject({ type: "LINE", points: nextPoints, layer: "USER-GEOMETRY" });
        setCadPoints([]);
      }
    } else if (cadTool === "RECTANGLE") {
      if (cadPoints.length === 0) setCadPoints([point]);
      else {
        const first = cadPoints[0];
        addCadObject({ type: "RECTANGLE", points: [first, { x: point.x, y: first.y }, point, { x: first.x, y: point.y }], layer: "USER-GEOMETRY" });
        setCadPoints([]);
      }
    } else if (cadTool === "TEXT") {
      if (!cadText.trim()) {
        alert("Enter TEXT in the CAD TEXT box first.");
        return;
      }
      addCadObject({ type: "TEXT", points: [point], text: cadText, layer: "ANNOTATION" });
      setCadText("");
    }
  };

  const handleCadDoubleClick = () => {
    if (cadTool === "PLINE" && cadPoints.length >= 2) {
      addCadObject({ type: "POLYLINE", points: cadPoints, layer: "USER-GEOMETRY" });
      setCadPoints([]);
    }
  };

  const handleGenerate = async () => {
    if (!selectedClientName.trim() || !representative.trim()) {
      alert("Please select Client Name and Representative.");
      return;
    }

    if (!customerName.trim() || !propertyAddress.trim() || plotArea <= 0) {
      alert("Please complete customer, property and plot information.");
      return;
    }

    // Use floorValidation engine
    const validation = validateConstructionPlan(plotArea, selectedFloors, floorData, floorRooms);
    if (!validation.isValid) {
      alert(validation.errors[0].message);
      if (validation.errors[0].floor) setRoomEditorFloor(validation.errors[0].floor);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please login to generate construction plan.");
      return;
    }

    const finalFee = feeMode === "AUTO" ? registeredFee : manualFee;
    const totalRoomArea = selectedFloors.reduce((sum, floor) => sum + getFloorRoomTotal(floor), 0);

    // Use sheetEngine for final output layout preparation
    const sheetConfig = prepareSheetLayout({
      ref_no: currentRefNo || `PLAN-${Date.now()}`,
      customer_name: customerName,
      client_name: selectedClientName,
      representative,
      property_address: propertyAddress,
      case_type: caseType,
      plot_shape: plotShape,
      plot_area: plotArea,
      dimensions: plotDimensions,
      road_side: roadFacingOption,
      boundaries: { north: boundaryNorth, south: boundarySouth, east: boundaryEast, west: boundaryWest },
      coverage_type: coverageType,
      selected_floors: selectedFloors,
      floor_details: floorData,
      room_details: floorRooms,
      floor_room_totals: Object.fromEntries(selectedFloors.map((floor) => [floor, getFloorRoomTotal(floor)])),
      total_room_area: totalRoomArea,
      total_builtup_area: totalBuiltUpArea,
      rate_per_sqft: rate,
      total_value: amount,
      fee_amount: finalFee,
      fee_mode: feeMode,
      door_count: doorWindowSpec.mainDoors + doorWindowSpec.internalDoors + doorWindowSpec.bathroomDoors,
      window_count: doorWindowSpec.windows,
      cad_objects: cadObjects,
      cad_settings: { orth_mode: orthMode, osnap_mode: osnapMode },
      created_at: new Date().toISOString(),
    });

    localStorage.setItem("estimatePreview", JSON.stringify(sheetConfig));
    router.push("/construction-plan-preview");
  };

  const handleClear = () => {
    localStorage.removeItem("estimateData");
    localStorage.removeItem("estimatePreview");
    setFloorData({});
    setFloorRooms({});
    setRate(0);
    setAmount(0);
    setCustomerName("");
    setPropertyAddress("");
    setPlotDimensions({ A: 20, B: 20, C: 40, D: 40 });
    setSelectedClientName("");
    setRepresentative("");
    setSelectedFloors(DEFAULT_FLOORS);
    setTempSelectedFloors(DEFAULT_FLOORS);
    setCadObjects([]);
    setSelectedCadObjectIds([]);
    setCadPoints([]);
    setRoomEditorFloor(null);
  };

  return (
    <div className="min-h-screen bg-white text-black p-3">
      {/* HEADER */}
      <div className="border-b-2 border-black pb-3 mb-4">
        <div className="text-xl text-center font-black tracking-wide">
          CONSTRUCTION PLAN
        </div>
      </div>

      {/* CASE / CLIENT */}
      <div className="grid grid-cols-7 gap-4 mb-4 border-b border-black pb-4">
        <div className="col-span-2">
          <label className="font-bold block text-[12pt]">CASE TYPE</label>
          <select className="w-full border border-black p-1 uppercase text-center">
            <option>CONSTRUCTION PLAN</option>
          </select>
        </div>
        <div className="col-span-1">
          <label className="font-bold block text-[12pt]">FEE</label>
          <select className="w-full border border-black p-1 uppercase text-center" value={feeMode} onChange={(e) => setFeeMode(e.target.value as "AUTO" | "MANUAL")}>
            <option value="AUTO">AUTO</option>
            <option value="MANUAL">MANUAL</option>
          </select>
          {feeMode === "MANUAL" && (
            <input type="number" placeholder="ENTER FEE" className="w-full border border-black p-1 mt-1 text-center" onChange={(e) => setManualFee(Number(e.target.value))} />
          )}
        </div>
        
        <div className="col-span-2">
          <label className="font-bold block text-[12pt]">CLIENT NAME</label>
          <input list="clients-list" value={selectedClientName} onChange={(e) => handleClientChange(e.target.value)} className="w-full border border-black p-1 uppercase text-center" placeholder="SEARCH CLIENT..." />
          <datalist id="clients-list">{[...new Set(clients.map(c => c.client_name))].map((name, i) => <option key={i} value={name} />)}</datalist>
        </div>
        <div className="col-span-2">
          <label className="font-bold block text-[12pt]">REPRESENTATIVE</label>
          <input list="reps-list" value={representative} onChange={(e) => setRepresentative(e.target.value)} className="w-full border border-black p-1 uppercase text-center" placeholder="SEARCH REP..." />
          <datalist id="reps-list">{filteredReps.map((rep, i) => <option key={i} value={rep} />)}</datalist>
        </div>
      </div>

      {/* CUSTOMER & PROPERTY */}
      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-12 items-center gap-4">
          <label className="col-span-3 font-bold text-[12pt] border border-black p-2 bg-gray-100">CUSTOMER NAME</label>
          <textarea value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="col-span-9 border border-black p-2 uppercase text-left text-lg" rows={1} />
        </div>
        <div className="grid grid-cols-12 items-center gap-4">
          <label className="col-span-3 font-bold text-[12pt] border border-black p-2 bg-gray-100">PROPERTY ADDRESS</label>
          <textarea value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} className="col-span-9 border border-black p-2 uppercase text-left text-lg" rows={2} />
        </div>
      </div>

      {/* PLOT CONTROL */}
      <div className="border border-black mb-4">
        <div className="bg-slate-900 text-white p-2 text-center font-black text-xl">
          PLOT GEOMETRY & CAD SETUP
        </div>

        <div className="grid grid-cols-12 gap-3 p-3 items-center">
          <div className="col-span-3">
            <label className="font-bold text-[12pt] block mb-1">PLOT SHAPE</label>
            <select
              value={plotShape}
              onChange={(event) => setPlotShape(event.target.value as (typeof PLOT_SHAPES)[number])}
              className="w-full border border-black p-2 text-lg font-bold bg-white"
            >
              {PLOT_SHAPES.map((shape) => (
                <option key={shape} value={shape}>{shape}</option>
              ))}
            </select>
          </div>

          <div className="col-span-3">
            <label className="font-bold text-[12pt] block mb-1">ROAD / FRONT SIDE</label>
            <select
              value={roadFacingOption}
              onChange={(event) => setRoadFacingOption(event.target.value)}
              className="w-full border border-black p-2 text-lg font-bold bg-white"
            >
              {ROAD_FACING_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="font-bold text-[12pt] block mb-1">PLOT AREA</label>
            <div className="border border-black bg-gray-100 p-2 text-center font-black text-lg">
              {plotArea.toFixed(2)} SQ.FT
            </div>
          </div>

          <div className="col-span-2">
            <label className="font-bold text-[12pt] block mb-1">FLOORS</label>
            <button
              type="button"
              onClick={() => {
                setTempSelectedFloors(selectedFloors);
                setIsFloorModalOpen(true);
              }}
              className="w-full border border-black bg-gray-100 p-2 text-sm font-bold hover:bg-gray-200 transition"
            >
              SELECT ({selectedFloors.length})
            </button>
          </div>

          <div className="col-span-2">
            <label className="font-bold text-[12pt] block mb-1">CAD</label>
            <button
              type="button"
              onClick={() => setIsCadModalOpen(true)}
              className="w-full bg-blue-700 text-white p-2 text-sm font-black hover:bg-blue-800 transition"
            >
              OPEN CAD
            </button>
          </div>
        </div>

        {/* A B C D */}
        <div className="grid grid-cols-4 border-t border-black">
          {(
            [
              ["A", "FRONT / ROAD / BOTTOM"],
              ["B", "OPPOSITE"],
              ["C", "LEFT"],
              ["D", "RIGHT"],
            ] as const
          ).map(([side, description]) => (
            <div key={side} className="border-r border-black last:border-r-0 p-3">
              <div className="font-black text-sm">{side} SIDE</div>
              <div className="text-[10px] text-gray-600 mb-1 font-medium">{description}</div>
              <input
                type="number"
                min={1}
                step="0.01"
                value={plotDimensions[side]}
                onChange={(event) => {
                  const value = Number(event.target.value) || 0;
                  setPlotDimensions((previous) => ({ ...previous, [side]: value }));
                }}
                className="w-full border border-black p-2 text-center text-lg font-bold bg-white"
              />
            </div>
          ))}
        </div>

        {/* AUTO DIMENSION */}
        <div className="border-t border-b border-black p-3 bg-yellow-50">
          <div className="font-black text-xs mb-1">AUTOMATIC OPPOSITE-SIDE DIMENSION</div>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs font-bold">IF ONE SIDE IS LEFT BLANK / CHANGED:</span>
            <select
              value={autoDimensionSide}
              onChange={(event) => setAutoDimensionSide(event.target.value as PlotSide)}
              className="border border-black p-2 text-sm font-bold bg-white"
            >
              {(["A", "B", "C", "D"] as PlotSide[]).map((side) => (
                <option key={side} value={side}>AUTO {side}</option>
              ))}
            </select>
            <span className="text-xs font-medium">Geometry engine will calculate the missing compatible side.</span>
          </div>
        </div>
      </div>

      {/* FOUR BOUNDARIES (2x2 Grid Layout) */}
      <div className="border border-black mb-4">
        <div className="bg-slate-900 text-white p-2 text-center font-black text-xl">
          FOUR BOUNDARIES
        </div>

        <div className="grid grid-cols-2 border-b border-black">
          {(
            [
              ["EAST", boundaryEast, setBoundaryEast],
              ["WEST", boundaryWest, setBoundaryWest],
            ] as [string, string, React.Dispatch<React.SetStateAction<string>>][]
          ).map(([label, value, setter], index) => (
            <div key={label} className={`p-3 ${index === 0 ? "border-r border-black" : ""}`}>
              <label className="font-bold text-[12pt] block mb-1">{label}</label>
              <input
                type="text"
                value={value}
                onChange={(event) => setter(event.target.value)}
                className="w-full border border-black p-2 text-lg font-bold uppercase bg-white"
              />
            </div>
          ))}
        </div>
      </div>

      {/* FLOOR DIMENSIONS */}
      <div className="border border-black mb-4">
        <div className="bg-slate-900 text-white p-2 text-center font-black text-xl">
          FLOOR-WISE BUILT-UP AREA
        </div>

        {selectedFloors.map((floor) => {
          const data: FloorData = floorData[floor] || { length: 0, width: 0, area: 0 };
          return (
            <div key={floor} className="grid grid-cols-12 border-b border-black last:border-b-0 items-center p-2">
              <div className="col-span-3 p-2 font-black text-sm">{floor}</div>
              <div className="col-span-2 p-2">
                <input
                  type="number"
                  placeholder="WIDTH"
                  value={data.width || ""}
                  onChange={(event) => updateFloorArea(floor, "width", Number(event.target.value) || 0)}
                  className="w-full border border-black p-2 text-center text-lg font-bold bg-white"
                />
              </div>
              <div className="col-span-2 p-2">
                <input
                  type="number"
                  placeholder="LENGTH"
                  value={data.length || ""}
                  onChange={(event) => updateFloorArea(floor, "length", Number(event.target.value) || 0)}
                  className="w-full border border-black p-2 text-center text-lg font-bold bg-white"
                />
              </div>
              <div className="col-span-2 p-2 text-center font-black text-lg bg-gray-50 border border-black py-2.5">
                {data.area.toFixed(2)} SQ.FT
              </div>
              <div className="col-span-3 p-2 text-center">
                <button
                  type="button"
                  onClick={() => refreshAutoRoomAreas(floor)}
                  className="border border-black px-3 py-2 text-xs font-black bg-gray-100 hover:bg-gray-200 transition"
                >
                  REFRESH AUTO AREAS
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ROOM PLANNING */}
      <div className="border border-black mb-4">
        <div className="bg-slate-900 text-white p-2 text-center font-black text-xl">
          FLOOR-WISE ROOM PLANNING
        </div>

        {selectedFloors.map((floor) => {
          const floorArea = Number(floorData[floor]?.area || 0);
          const roomTotal = getFloorRoomTotal(floor);
          const balance = floorArea - roomTotal;

          return (
            <div key={floor} className="border-b border-black last:border-b-0">
              <div className="grid grid-cols-12 bg-gray-100 border-b border-black">
                <div className="col-span-3 p-2 font-black text-sm">{floor}</div>
                <div className="col-span-3 p-2 text-center font-bold text-sm">
                  FLOOR AREA<br />{floorArea.toFixed(2)} SQ.FT
                </div>
                <div className="col-span-3 p-2 text-center font-bold text-sm">
                  ROOM TOTAL<br />{roomTotal.toFixed(2)} SQ.FT
                </div>
                <div className={`col-span-3 p-2 text-center font-black text-sm ${balance < -0.01 ? "text-red-600" : "text-green-700"}`}>
                  BALANCE<br />{balance.toFixed(2)} SQ.FT
                </div>
              </div>

              <div className="p-2 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    ensureFloorRooms(floor);
                    setRoomEditorFloor(roomEditorFloor === floor ? null : floor);
                  }}
                  className="bg-black text-white px-4 py-2 text-sm font-black"
                >
                  ADD / EDIT ROOMS
                </button>

                {(["1 RK", "1 BHK", "2 BHK", "3 BHK"] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyBhkPreset(floor, preset)}
                    className="border border-black px-3 py-2 text-sm font-black hover:bg-gray-100"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {roomEditorFloor === floor && (
                <div className="p-2">
                  <div className="border border-black overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-slate-200">
                        <tr>
                          <th className="border border-black p-1">USE</th>
                          <th className="border border-black p-1">ROOM</th>
                          <th className="border border-black p-1">NOS</th>
                          <th className="border border-black p-1">AREA</th>
                          <th className="border border-black p-1">SQ.FT / ROOM</th>
                          <th className="border border-black p-1">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ROOM_CATALOG.map((room) => {
                          const current = floorRooms[floor]?.[room.key] || {
                            selected: false,
                            count: 1,
                            areaMode: "AUTO" as const,
                            areaPerRoom: calculateRoomAutoArea(room, floorArea, floor === "GROUND FLOOR"),
                          };

                          return (
                            <tr key={room.key}>
                              <td className="border border-black p-1 text-center">
                                <input
                                  type="checkbox"
                                  checked={current.selected}
                                  onChange={() => toggleRoom(floor, room.key)}
                                />
                              </td>
                              <td className="border border-black p-1 font-bold">{room.label}</td>
                              <td className="border border-black p-1">
                                <input
                                  type="number"
                                  min={1}
                                  value={current.count}
                                  disabled={!current.selected}
                                  onChange={(event) => updateRoom(floor, room.key, { count: Math.max(1, Number(event.target.value) || 1) })}
                                  className="w-full border border-black p-1 text-center"
                                />
                              </td>
                              <td className="border border-black p-1">
                                <select
                                  value={current.areaMode}
                                  disabled={!current.selected}
                                  onChange={(event) => {
                                    const mode = event.target.value as "AUTO" | "MANUAL";
                                    updateRoom(floor, room.key, {
                                      areaMode: mode,
                                      areaPerRoom: mode === "AUTO" ? calculateRoomAutoArea(room, floorArea, floor === "GROUND FLOOR") : current.areaPerRoom,
                                    });
                                  }}
                                  className="w-full border border-black p-1"
                                >
                                  <option value="AUTO">AUTO</option>
                                  <option value="MANUAL">MANUAL</option>
                                </select>
                              </td>
                              <td className="border border-black p-1">
                                <input
                                  type="number"
                                  min={room.minArea}
                                  step="0.01"
                                  disabled={!current.selected || current.areaMode === "AUTO"}
                                  value={current.areaPerRoom}
                                  onChange={(event) => updateRoom(floor, room.key, { areaPerRoom: Number(event.target.value) || 0 })}
                                  className="w-full border border-black p-1 text-center"
                                />
                              </td>
                              <td className="border border-black p-1 text-center font-black">
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

              <div className={`m-2 border border-black p-2 text-[10px] font-black ${balance < -0.01 ? "bg-red-100 text-red-700" : "bg-green-50 text-green-800"}`}>
                {balance < -0.01 ? "VALIDATION ERROR — ROOM AREA EXCEEDS FLOOR AREA" : `CHECK OK — ${balance.toFixed(2)} SQ.FT AVAILABLE FOR WALLS / PASSAGE / STAIR / DUCT / OTHER SPACE`}
              </div>
            </div>
          );
        })}

        <div className="bg-gray-100 p-2 text-right font-black text-xs">
          TOTAL ROOM AREA: {selectedFloors.reduce((sum, floor) => sum + getFloorRoomTotal(floor), 0).toFixed(2)} SQ.FT
        </div>
      </div>

      {/* TOTAL */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <div>
          <label className="font-bold text-xl">TOTAL BUILT-UP AREA</label>
          <div className="border border-black bg-gray-100 p-2 text-sm font-black">
            {totalBuiltUpArea.toFixed(2)} SQ.FT
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-2 border-t-2 border-black pt-3">
        <button type="button" onClick={handleGenerate} className="bg-black text-white px-6 py-3 text-xs font-black">
          GENERATE PLAN
        </button>
        <button type="button" onClick={handleClear} className="bg-red-600 text-white px-6 py-3 text-xs font-black">
          CLEAR DATA
        </button>
      </div>

      {/* CAD MODAL */}
      {isCadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 p-2">
          <div className="bg-white w-full h-full border-2 border-black flex flex-col">
            <div className="bg-slate-950 text-white p-2 flex items-center justify-between">
              <div className="font-black text-xs">CONSTRUCTION CAD — {plotShape}</div>
              <button type="button" onClick={() => setIsCadModalOpen(false)} className="bg-red-600 px-4 py-1 font-black text-xs">
                CLOSE
              </button>
            </div>

            <div className="border-b border-black bg-gray-100 p-2 flex gap-1 flex-wrap">
              {(["SELECT", "LINE", "PLINE", "RECTANGLE", "OFFSET", "MOVE", "COPY", "ROTATE", "DELETE", "DIMENSION", "TEXT", "HATCH"] as CadTool[]).map((tool) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => setCadCommand(tool)}
                  className={`px-2 py-1 border border-black text-[9px] font-black ${cadTool === tool ? "bg-blue-700 text-white" : "bg-white"}`}
                >
                  {tool}
                </button>
              ))}
              <button type="button" onClick={() => setOrthMode((v) => !v)} className={`px-2 py-1 border border-black text-[9px] font-black ${orthMode ? "bg-green-600 text-white" : "bg-white"}`}>ORTHO</button>
              <button type="button" onClick={() => setOsnapMode((v) => !v)} className={`px-2 py-1 border border-black text-[9px] font-black ${osnapMode ? "bg-green-600 text-white" : "bg-white"}`}>OSNAP</button>
              <button type="button" onClick={copySelectedCadObjects} className="px-2 py-1 border border-black text-[9px] font-black bg-white">COPY</button>
              <button type="button" onClick={() => rotateSelectedCadObjects(cadRotation)} className="px-2 py-1 border border-black text-[9px] font-black bg-white">ROTATE</button>
              <button type="button" onClick={deleteSelectedCadObjects} className="px-2 py-1 border border-black text-[9px] font-black bg-red-100">DELETE</button>
              <input type="number" value={cadRotation} onChange={(e) => setCadRotation(Number(e.target.value) || 0)} className="w-16 border border-black p-1 text-[9px] text-center" title="Rotation" />
              <input value={cadText} onChange={(e) => setCadText(e.target.value)} placeholder="TEXT" className="w-32 border border-black p-1 text-[9px]" />
            </div>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
              <div className="col-span-9 relative bg-white overflow-auto">
                <div className="absolute top-2 left-2 z-10 bg-yellow-300 border border-black px-2 py-1 text-[9px] font-black">
                  NORTH ↑
                </div>
                <svg width={900} height={650} className="w-full h-full min-w-[700px] min-h-[500px]" onClick={handleCadCanvasClick} onDoubleClick={handleCadDoubleClick}>
                  <defs>
                    <pattern id="cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1" />
                    </pattern>
                    <pattern id="cad-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="10" stroke="#94a3b8" strokeWidth="2" />
                    </pattern>
                  </defs>
                  <rect x="0" y="0" width="100%" height="100%" fill="url(#cad-grid)" />
                  <g transform={`translate(120 80) scale(${cadZoom})`}>
                    <polygon
                      points={scaledPlotPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                      fill="url(#cad-hatch)"
                      stroke="black"
                      strokeWidth="2"
                    />
                  </g>
                </svg>
              </div>

              <div className="col-span-3 border-l border-black bg-gray-100 p-3 overflow-y-auto">
                <div className="font-black text-xs border-b border-black pb-2 mb-3">PLOT INFORMATION</div>
                <div className="space-y-2 text-[10px]">
                  <div className="border border-black bg-white p-2"><b>A — FRONT:</b> {plotDimensions.A}'</div>
                  <div className="border border-black bg-white p-2"><b>B — OPPOSITE:</b> {plotDimensions.B}'</div>
                  <div className="border border-black bg-white p-2"><b>C — LEFT:</b> {plotDimensions.C}'</div>
                  <div className="border border-black bg-white p-2"><b>D — RIGHT:</b> {plotDimensions.D}'</div>
                  <div className="border border-black bg-yellow-100 p-2 font-black">AREA: {plotArea.toFixed(2)} SQ.FT</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("constructionPlanCad", JSON.stringify({ plotShape, plotDimensions, roadFacingOption, boundaryNorth, boundarySouth, boundaryEast, boundaryWest, cadObjects, orthMode, osnapMode }));
                    setIsCadModalOpen(false);
                  }}
                  className="w-full mt-4 bg-black text-white p-3 text-[10px] font-black"
                >
                  SAVE CAD LAYOUT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOOR MODAL */}
      {isFloorModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white border-2 border-black w-[420px] max-w-full">
            <div className="bg-black text-white p-3 font-black text-xs">SELECT FLOORS</div>
            <div className="max-h-[400px] overflow-y-auto">
              {["GROUND FLOOR", ...EXTRA_FLOORS].map((floor) => (
                <label key={floor} className="flex items-center gap-3 border-b border-black p-3 cursor-pointer text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={tempSelectedFloors.includes(floor)}
                    onChange={() => setTempSelectedFloors((previous) => previous.includes(floor) ? previous.filter((item) => item !== floor) : [...previous, floor])}
                  />
                  {floor}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 p-3">
              <button type="button" onClick={() => setIsFloorModalOpen(false)} className="border border-black px-4 py-2 text-xs font-black">CANCEL</button>
              <button
                type="button"
                onClick={() => {
                  const floors = sortFloors(tempSelectedFloors);
                  setSelectedFloors(floors);
                  floors.forEach((floor) => ensureFloorRooms(floor));
                  setIsFloorModalOpen(false);
                }}
                className="bg-black text-white px-4 py-2 text-xs font-black"
              >
                APPLY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}