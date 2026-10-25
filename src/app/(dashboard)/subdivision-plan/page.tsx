"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ✅ Fixed Imports (Raste theek kar diye gaye hain)
import { PlotDimensions, PlotShape } from "./subdivisionTypes";
import SubdivisionClientDetails from "./components/SubdivisionClientDetails";
import SubdivisionConfigSection from "./components/SubdivisionConfigSection";
import SimpleSubdivisionInput, { SimpleSubdivisionConfig } from "./components/SimpleSubdivisionInput";

const ROAD_FACING_OPTIONS = [
  "1 SIDE ROAD (NORTH)", "1 SIDE ROAD (SOUTH)", "1 SIDE ROAD (EAST)", "1 SIDE ROAD (WEST)",
  "CORNER: MAIN RD NORTH & EAST", "CORNER: MAIN RD NORTH & WEST",
  "CORNER: MAIN RD SOUTH & EAST", "CORNER: MAIN RD SOUTH & WEST",
  "2 SIDE FRONT & REAR (NORTH & SOUTH)", "2 SIDE FRONT & REAR (EAST & WEST)",
  "3 SIDE ROAD (NORTH, EAST & WEST)", "3 SIDE ROAD (SOUTH, EAST & WEST)",
  "4 SIDE ROAD (ISLAND / OPEN)",
];

const PLOT_SHAPES = [
  "RECTANGLE", "SQUARE", "TRAPEZOIDAL", "POLYGON", "IRREGULAR", "L-SHAPE",
] as const;

// ✅ Default subdivision config (with mode + corner + road)
const DEFAULT_SUBDIVISION_CONFIG: SimpleSubdivisionConfig = {
  mode: "SIMPLE",
  count: 3,
  splitBy: "EQUAL",
  direction: "VERTICAL",
  customPieces: [],
  corner: {
    side1Pieces: 3,
    side2Pieces: 2,
    splitDirection: "HORIZONTAL",
    roadWidthFt: 0,
  },
  road: {
    roadSide: "TOP",
    roadWidthFt: 10,
  },
};

export default function SubdivisionPlanInput() {
  const router = useRouter();
  const [caseType, setCaseType] = useState("SUBDIVISION PLAN");
  const [feeMode, setFeeMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [manualFee, setManualFee] = useState<number>(0);
  const [registeredFee, setRegisteredFee] = useState<number>(0);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [representative, setRepresentative] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [filteredReps, setFilteredReps] = useState<string[]>([]);
  const [allRepresentatives, setAllRepresentatives] = useState<string[]>([]);

  const [measurementUnit, setMeasurementUnit] = useState<"FEET" | "METERS">("FEET");
  const [roadFacingOption, setRoadFacingOption] = useState("");
  const [plotShape, setPlotShape] = useState<PlotShape | "IRREGULAR" | "L-SHAPE" | "">("" as any);
  const [roadWidthSouth, setRoadWidthSouth] = useState(15);
  const [roadWidthNorth, setRoadWidthNorth] = useState(15);
  const [roadWidthEast, setRoadWidthEast] = useState(15);
  const [roadWidthWest, setRoadWidthWest] = useState(15);

  const [plotDimensions, setPlotDimensions] = useState<PlotDimensions>({
    length: 0, width: 0, area: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0,
  });
  const [dimDetails, setDimDetails] = useState<Record<string, { ft: number; in: number }>>({
    A: { ft: 0, in: 0 }, B: { ft: 0, in: 0 }, C: { ft: 0, in: 0 }, D: { ft: 0, in: 0 },
  });
  const [dimensionHistory, setDimensionHistory] = useState<PlotDimensions[]>([]);

  const [boundaryNorth, setBoundaryNorth] = useState("");
  const [boundarySouth, setBoundarySouth] = useState("");
  const [boundaryEast, setBoundaryEast] = useState("");
  const [boundaryWest, setBoundaryWest] = useState("");

  const [subdivisionConfig, setSubdivisionConfig] = useState<SimpleSubdivisionConfig>(
    DEFAULT_SUBDIVISION_CONFIG
  );

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from("clients").select("client_name, representative_name");
      const combined = (data || []) as Array<{
        client_name: string | null;
        representative_name: string | null;
      }>;
      setClients(combined);
      const reps: string[] = combined
        .map((c) => c.representative_name)
        .filter((n): n is string => typeof n === "string" && n.trim() !== "");
      const unique: string[] = Array.from(new Set<string>(reps));
      setAllRepresentatives(unique);
      setFilteredReps(unique);
    };
    fetchData();
  }, []);

  const frontWidthFt =
    Number(dimDetails.A?.ft ?? plotDimensions.A ?? 0) +
    Number(dimDetails.A?.in ?? 0) / 12;
  const depthFt =
    Number(dimDetails.C?.ft ?? plotDimensions.C ?? 0) +
    Number(dimDetails.C?.in ?? 0) / 12;
  const plotArea = frontWidthFt * depthFt;

  const isMultiDimShape = typeof plotShape === "string" && plotShape.includes("L-SHAPE");

  const updateDimensionPart = (side: keyof PlotDimensions, field: "ft" | "in", val: number) => {
    setDimensionHistory((prev) => [...prev, { ...plotDimensions }]);
    const currentDetail = dimDetails[side as string] || { ft: 0, in: 0 };
    const updatedDetail = { ...currentDetail, [field]: val };
    const totalFeet = Number(updatedDetail.ft || 0) + Number(updatedDetail.in || 0) / 12;
    setDimDetails((prev) => ({ ...prev, [side]: updatedDetail }));
    setPlotDimensions((prev) => {
      const next: PlotDimensions = { ...prev, [side]: totalFeet };
      if (side === "A") next.width = totalFeet;
      if (side === "C") next.length = totalFeet;
      const finalA = side === "A" ? totalFeet : Number(prev.A) || 0;
      const finalC = side === "C" ? totalFeet : Number(prev.C) || 0;
      next.area = finalA * finalC;
      return next;
    });
  };

  const handleUndo = () => {
    if (dimensionHistory.length === 0) return;
    const last = dimensionHistory[dimensionHistory.length - 1];
    setPlotDimensions(last);
    setDimensionHistory((prev) => prev.slice(0, -1));
  };

  const handleResetDimensions = () => {
    setPlotDimensions({ length: 0, width: 0, area: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 });
    setDimDetails({ A: { ft: 0, in: 0 }, B: { ft: 0, in: 0 }, C: { ft: 0, in: 0 }, D: { ft: 0, in: 0 } });
    setDimensionHistory([]);
    setRoadFacingOption("");
    setPlotShape("");
  };

  const handleClientChange = (name: string) => {
    setSelectedClientName(name);
    const matches = clients
      .filter((c: any) => c.client_name === name && c.representative_name)
      .map((c: any) => c.representative_name as string);
    supabase.from("clients").select("estimate_fee").eq("client_name", name).maybeSingle()
      .then(({ data }) => setRegisteredFee(data?.estimate_fee || 0));
    if (matches.length > 0) {
      const unique = Array.from(new Set(matches));
      setFilteredReps(unique);
      setRepresentative(unique.length === 1 ? unique[0] : "");
    } else {
      setFilteredReps(allRepresentatives);
      setRepresentative("");
    }
  };

  const handleGeneratePlan = () => {
    try {
      const dimA = Number(plotDimensions.A) || frontWidthFt || 30;
      const dimC = Number(plotDimensions.C) || depthFt || 50;

      const payload = {
        caseType, feeMode, manualFee, registeredFee,
        customerName: customerName || "",
        propertyAddress: propertyAddress || "",
        selectedClientName: selectedClientName || "",
        representative: representative || "",
        measurementUnit,
        roadFacingOption: roadFacingOption || "1 SIDE ROAD (SOUTH)",
        plotShape: plotShape || "RECTANGLE",
        plotArea: plotArea || dimA * dimC,
        plotDimensions: {
          ...plotDimensions,
          A: dimA,
          B: Number(plotDimensions.B) || dimA,
          C: dimC,
          D: Number(plotDimensions.D) || dimC,
          width: dimA, length: dimC, area: dimA * dimC,
        },
        dimDetails: { ...dimDetails },
        roadWidthNorth, roadWidthSouth, roadWidthEast, roadWidthWest,
        boundaries: {
          north: boundaryNorth || "",
          south: boundarySouth || "",
          east: boundaryEast || "",
          west: boundaryWest || "",
        },
        subdivisionConfig: {
          mode: subdivisionConfig.mode || "SIMPLE",
          count: subdivisionConfig.count,
          splitBy: subdivisionConfig.splitBy,
          direction: subdivisionConfig.direction,
          customPieces: subdivisionConfig.splitBy === "CUSTOM"
            ? subdivisionConfig.customPieces
            : undefined,
          corner: subdivisionConfig.corner,
          road: subdivisionConfig.road,
          template: subdivisionConfig.mode === "TEMPLATE" ? subdivisionConfig.template : undefined,
          manual: subdivisionConfig.mode === "MANUAL" ? subdivisionConfig.manual : undefined,
        },
        pieces: [], 
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem("subdivision_plan_preview_data", JSON.stringify(payload));
      router.push("/subdivision-plan-preview");
    } catch (error) {
      console.error("Subdivision plan generation failed:", error);
      alert("Plan generation failed.");
    }
  };

  const handleClearForm = () => {
    if (!window.confirm("Are you sure you want to clear all data?")) return;
    setCustomerName(""); setPropertyAddress("");
    setSelectedClientName(""); setRepresentative("");
    setRoadFacingOption(""); setPlotShape("");
    handleResetDimensions();
    setBoundaryNorth(""); setBoundarySouth("");
    setBoundaryEast(""); setBoundaryWest("");
    setSubdivisionConfig(DEFAULT_SUBDIVISION_CONFIG);
    alert("Form cleared!");
  };

  const hasPlotGeometry = Boolean(roadFacingOption && plotShape && frontWidthFt > 0 && depthFt > 0);

  return (
    <div className="p-3 sm:p-6 max-w-[1400px] mx-auto bg-white text-black font-sans uppercase">
      <div className="bg-slate-900 text-white p-3 text-center font-black text-lg sm:text-2xl mb-4 sm:mb-6 tracking-wide shadow">
        SUBDIVISION PLAN INPUT FORM
      </div>

      <SubdivisionClientDetails
        caseType={caseType} setCaseType={setCaseType}
        feeMode={feeMode} setFeeMode={setFeeMode} setManualFee={setManualFee}
        selectedClientName={selectedClientName} handleClientChange={handleClientChange}
        clients={clients} representative={representative} setRepresentative={setRepresentative}
        filteredReps={filteredReps}
        customerName={customerName} setCustomerName={setCustomerName}
        propertyAddress={propertyAddress} setPropertyAddress={setPropertyAddress}
      />

      <SubdivisionConfigSection
        measurementUnit={measurementUnit} setMeasurementUnit={setMeasurementUnit}
        roadFacingOption={roadFacingOption} setRoadFacingOption={setRoadFacingOption}
        plotShape={plotShape} setPlotShape={setPlotShape}
        plotArea={plotArea} plotDimensions={plotDimensions}
        updateDimensionPart={updateDimensionPart}
        dimDetails={dimDetails}
        boundaryNorth={boundaryNorth} setBoundaryNorth={setBoundaryNorth}
        boundarySouth={boundarySouth} setBoundarySouth={setBoundarySouth}
        boundaryEast={boundaryEast} setBoundaryEast={setBoundaryEast}
        boundaryWest={boundaryWest} setBoundaryWest={setBoundaryWest}
        ROAD_FACING_OPTIONS={ROAD_FACING_OPTIONS}
        PLOT_SHAPES={PLOT_SHAPES}
        dimensionHistory={dimensionHistory}
        handleUndo={handleUndo}
        handleResetDimensions={handleResetDimensions}
        isMultiDimShape={isMultiDimShape}
        calculatedNetArea={plotArea}
      />

      {hasPlotGeometry ? (
        <SimpleSubdivisionInput
          value={subdivisionConfig}
          onChange={setSubdivisionConfig}
          measurementUnit={measurementUnit}
          plotWidthFt={frontWidthFt}
          plotLengthFt={depthFt}
        />
      ) : (
        <div className="border-2 border-dashed border-gray-400 bg-gray-50 p-8 text-center text-gray-500 font-bold text-sm mb-4">
          🔒 Complete Road + Shape + Dimensions to unlock subdivision layout.
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 border-t-2 border-black pt-3">
        <button
          type="button"
          onClick={handleGeneratePlan}
          className="bg-black hover:bg-zinc-800 text-white px-6 py-3 text-xs font-black uppercase transition cursor-pointer w-full sm:w-auto"
        >
          GENERATE SUBDIVISION PLAN
        </button>
        <button
          type="button"
          onClick={handleClearForm}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 text-xs font-black uppercase transition cursor-pointer w-full sm:w-auto"
        >
          CLEAR DATA
        </button>
      </div>
    </div>
  );
}