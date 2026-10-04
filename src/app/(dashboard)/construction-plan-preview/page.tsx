'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import CadFloorElevationRenderer from "../construction-plan/components/CadFloorElevationRenderer";
import PlotPolygonRenderer from "../construction-plan/components/PlotPolygonRenderer";
import BoundaryLabels from "../construction-plan/components/BoundaryLabels";
import RoadRenderer from "../construction-plan/components/RoadRenderer";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import PaymentGateway from "./components/PaymentGateway";

export default function ConstructionPlanPreview() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [planData, setPlanData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ✅ FIX: Initial refNo = "DRAFT" — payment se pehle yahi dikhega
  const [refNo, setRefNo] = useState<string>("DRAFT");

  const [userState, setUserState] = useState<string>("MADHYA PRADESH");
  const [userCategory, setUserCategory] = useState<string>("INDIVIDUAL USER");

  // ============================================================
  // LOAD PLAN DATA FROM LOCALSTORAGE
  // ============================================================
  useEffect(() => {
    try {
      const rawData =
        localStorage.getItem("constructionPlanData") ||
        localStorage.getItem("construction_plan_preview_data") ||
        localStorage.getItem("CONSTRUCTION_PLAN_INPUT");

      if (rawData) {
        const parsed = JSON.parse(rawData);
        setPlanData(parsed);
        // ✅ planData.ref_no ab use NAHI karenge — payment ke baad fresh ref banega
      }
    } catch (err) {
      console.error("Error loading preview data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================
  // ✅ REF NO. RESET — Har preview open par DRAFT set karo
  // Purana ref localStorage se hata do taaki fresh generate ho payment ke baad
  // ============================================================
  useEffect(() => {
    try {
      localStorage.removeItem("constructionPlanRefNo");
    } catch {}
    setRefNo("DRAFT");
  }, []);

  // ============================================================
  // ✅ FETCH USER PROFILE — state + category
  // ============================================================
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!currentUser?.id) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("state, user_type, role")
          .eq("id", currentUser.id)
          .maybeSingle();
        if (data?.state) {
          setUserState(data.state);
        }
        const category = data?.user_type || data?.role || "INDIVIDUAL USER";
        setUserCategory(category.toUpperCase());
      } catch (err) {
        console.error("[FETCH USER PROFILE ERROR]", err);
      }
    };
    fetchUserProfile();
  }, [currentUser]);

  // ============================================================
  // ✅ REF NO. GENERATOR — Callback jo payment success par call hoga
  //    Auto-call NAHI karte — sirf PaymentGateway use karega
  // ============================================================
  const generateRefNo = useCallback(async (): Promise<string> => {
    try {
      const now = new Date();
      const fy = (now.getMonth() + 1) >= 4
        ? `${String(now.getFullYear()).slice(-2)}-${String(now.getFullYear() + 1).slice(-2)}`
        : `${String(now.getFullYear() - 1).slice(-2)}-${String(now.getFullYear()).slice(-2)}`;

      const firstName = (currentUser?.full_name || "GUEST").split(' ')[0].toUpperCase();

      // ✅ service_records se count lo (deed_drafting se nahi)
      const { count: userCount } = await supabase
        .from('service_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser?.id);

      const personalSeq = (userCount || 0) + 1;
      const formattedUserSeq = `P${String(personalSeq).padStart(3, '0')}`;

      const { count: globalCount } = await supabase
        .from('service_records')
        .select('*', { count: 'exact', head: true });

      const globalSeq = (globalCount || 0) + 1;
      const formattedGlobalSeq = `C${String(globalSeq).padStart(4, '0')}`;

      const newRef = `LnT/${fy}/${firstName}/${formattedUserSeq}/${formattedGlobalSeq}`;
      console.log("[REF NO GENERATED]", newRef);
      return newRef;
    } catch (err) {
      console.error("Ref No generation failed:", err);
      const now = new Date();
      const fy = `${String(now.getFullYear()).slice(-2)}-${String(now.getFullYear() + 1).slice(-2)}`;
      const fallback = `LnT/${fy}/GUEST/P001/C0001`;
      console.warn("[REF NO FALLBACK]", fallback);
      return fallback;
    }
  }, [currentUser]);

  // ============================================================
  // 🔥 DATA DESTRUCTURING
  // ============================================================
  const {
    customerName = "N/A",
    propertyAddress = "N/A",
    plotArea = 1000,
    boundaries = { north: "—", south: "—", east: "—", west: "—" },
    dimensions = null,
    plotDimensions = null,
    dimDetails = null,
    roadFacingOption,
    totalFloors = 1,
    selectedFloors = ["GROUND FLOOR"],
    measurementUnit = "FEET",
    roadWidthNorth = 20,
    roadWidthSouth = 15,
    roadWidthEast = 15,
    roadWidthWest = 15,
    frontMos = 0,
    rearMos = 0,
    leftMos = 0,
    rightMos = 0,
    floorRooms = {},
  } = planData || {};

  const activeRoadFacing = roadFacingOption || "ROAD SIDE NOT SPECIFIED";

  // Dimension resolver
  const resolveDimension = (key: "A" | "B" | "C" | "D"): number => {
    if (dimensions?.[key] !== undefined && Number(dimensions[key]) > 0) {
      return Number(dimensions[key]);
    }
    if (plotDimensions?.[key] !== undefined && Number(plotDimensions[key]) > 0) {
      return Number(plotDimensions[key]);
    }
    if (dimDetails?.[key] !== undefined) {
      const ft = Number(dimDetails[key]?.ft || 0);
      const inch = Number(dimDetails[key]?.in || 0);
      const total = ft + inch / 12;
      if (total > 0) return total;
    }
    return 0;
  };

   const rawDimA = resolveDimension("A");
  const rawDimB = resolveDimension("B");
  const rawDimC = resolveDimension("C");
  const rawDimD = resolveDimension("D");

  // ✅ FIX: Agar saare dimensions 0 hain, to floorData se recover karo
  const fallbackFromFloorData = (() => {
    const fd = planData?.floorData || {};
    const gf = fd["GROUND FLOOR"] || {};
    const w = Number(gf.width) || 0;
    const l = Number(gf.length) || 0;
    return { w, l };
  })();

  const dimA = rawDimA > 0
    ? rawDimA
    : (fallbackFromFloorData.w > 0
        ? fallbackFromFloorData.w
        : (Number(dimensions?.width) || Number(plotDimensions?.width) || 20));
  const dimB = rawDimB > 0 ? rawDimB : dimA;
  const dimC = rawDimC > 0
    ? rawDimC
    : (fallbackFromFloorData.l > 0
        ? fallbackFromFloorData.l
        : (Number(dimensions?.length) || Number(plotDimensions?.length) || 50));
   const dimD = rawDimD > 0 ? rawDimD : dimC;

  // ✅ FIX: safePlotArea — pehle planData ka plotArea, warna dimA × dimC
  const safePlotArea = Number(plotArea) > 0
    ? Number(plotArea)
    : (dimA * dimC);

  if (typeof window !== 'undefined' && planData) {
    console.log('[PREVIEW] Plot Dimensions:', {
      dimA, dimB, dimC, dimD,
      plotArea,
      safePlotArea,
      fromDimensions: dimensions,
      fromPlotDimensions: plotDimensions,
      fromDimDetails: dimDetails,
    });
  }
  const fMos = Number(frontMos || planData?.sideMos?.A || 0);
  const rMos = Number(rearMos || planData?.sideMos?.B || 0);
  const lMos = Number(leftMos || planData?.sideMos?.C || 0);
  const rtMos = Number(rightMos || planData?.sideMos?.D || 0);

  const builtWidth = dimA - lMos - rtMos;
  const builtLength = dimC - fMos - rMos;

  const scale = 5;

  const bottomWidth = dimA * scale;
  const topWidth = dimB * scale;
  const heightLeft = dimC * scale;
  const heightRight = dimD * scale;

  const pBottomLeft = { x: -bottomWidth / 2, y: heightLeft / 2 };
  const pBottomRight = { x: bottomWidth / 2, y: heightLeft / 2 };
  const pTopLeft = { x: -topWidth / 2, y: -heightLeft / 2 };
  const pTopRight = { x: topWidth / 2, y: -heightRight / 2 };

  const correctedPoints = [pTopLeft, pTopRight, pBottomRight, pBottomLeft];
  const xs = correctedPoints.map(p => p.x);
  const ys = correctedPoints.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const builtUpPoints = useMemo(() => {
    const mosFront = fMos * scale;
    const mosBack = rMos * scale;
    const mosLeft = lMos * scale;
    const mosRight = rtMos * scale;

    const isFullPlot = fMos === 0 && rMos === 0 && lMos === 0 && rtMos === 0;
    if (isFullPlot) return correctedPoints;

    return [
      { x: pTopLeft.x + mosLeft, y: pTopLeft.y + mosBack },
      { x: pTopRight.x - mosRight, y: pTopRight.y + mosBack },
      { x: pBottomRight.x - mosRight, y: pBottomRight.y - mosFront },
      { x: pBottomLeft.x + mosLeft, y: pBottomLeft.y - mosFront }
    ];
  }, [pTopLeft, pTopRight, pBottomRight, pBottomLeft, fMos, rMos, lMos, rtMos, scale]);

  // ============================================================
  // 🔥 AUTO-FIT VIEWBOX
  // ============================================================
  const autoFitViewBox = useMemo(() => {
    const plotW = Math.max(bottomWidth, topWidth);
    const plotH = Math.max(heightLeft, heightRight);

    const baseGap = 60 * scale;
    const interFloorGap = 15 * scale;
    const rowHeightGap = plotH + 25 * scale;
    const MANUAL_ELEV_Y_OFFSET = -25 * scale;
    const MANUAL_TABLE_Y_OFFSET = -55 * scale;
    const sectionGap = 40 * scale;
    const tableGap = 70 * scale;
    const tableWidth = plotW + 50 * scale;

    const floorCount = (selectedFloors || []).length || 1;
    const itemsPerRow = floorCount > 6 ? 4 : 3;

    let leftmostX = Infinity;
    let topmostY = Infinity;
    for (let i = 0; i < floorCount; i++) {
      const rowIndex = Math.floor(i / itemsPerRow);
      const colIndex = rowIndex % 2 === 0
        ? (itemsPerRow - 1) - (i % itemsPerRow)
        : (i % itemsPerRow);

      const shiftX = baseGap + (colIndex * (plotW + interFloorGap));
      const shiftY = rowIndex * rowHeightGap;

      const minX = -(plotW / 2) - shiftX;
      const minY = -(plotH / 2) - shiftY;

      if (minX < leftmostX) leftmostX = minX;
      if (minY < topmostY) topmostY = minY;
    }

    const elevationStartX = leftmostX;
    const elevationRowStartY = topmostY + MANUAL_ELEV_Y_OFFSET;

    const plotLeftX = elevationStartX - 30;
    const tableRightX = elevationStartX + plotW + sectionGap + plotH + tableGap + tableWidth + 30;
    const tableTopY = elevationRowStartY + MANUAL_TABLE_Y_OFFSET - 30;

    const maxRows = Math.ceil(floorCount / itemsPerRow);
    const plotBottomY = topmostY + (maxRows - 1) * rowHeightGap + plotH / 2 + 40;

    const drawingW = tableRightX - plotLeftX;
    const drawingH = plotBottomY - tableTopY;

    const drawingCenterX = (plotLeftX + tableRightX) / 2;
    const drawingCenterY = (tableTopY + plotBottomY) / 2;

    const horizontalBiasX = drawingW * 0.1;
    const verticalBiasY = drawingH * -0.15;

    const finalCenterX = drawingCenterX - horizontalBiasX;
    const finalCenterY = drawingCenterY - verticalBiasY;

    const targetAspect = 1.18;
    const currentAspect = drawingW / drawingH;

    let finalW = drawingW;
    let finalH = drawingH;

    if (currentAspect < targetAspect) {
      finalW = drawingH * targetAspect;
    } else {
      finalH = drawingW / targetAspect;
    }

    const finalX = finalCenterX - finalW / 2;
    const finalY = finalCenterY - finalH / 2;

    const pad = 5;

    return {
      x: finalX - pad,
      y: finalY - pad,
      w: finalW + pad * 2,
      h: finalH + pad * 2,
    };
  }, [bottomWidth, topWidth, heightLeft, heightRight, scale, selectedFloors]);

  const roadOptUpper = (activeRoadFacing || "").toUpperCase();
  const activeNorth = roadOptUpper.includes("NORTH") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI") || roadOptUpper.includes("CORNER");
  const activeSouth = roadOptUpper.includes("SOUTH") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI") || roadOptUpper.includes("CORNER");
  const activeEast = roadOptUpper.includes("EAST") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI") || roadOptUpper.includes("CORNER");
  const activeWest = roadOptUpper.includes("WEST") || roadOptUpper.includes("ALL") || roadOptUpper.includes("MULTI");

  const currentNorthRoad = Number(roadWidthNorth) || 15;
  const currentSouthRoad = Number(roadWidthSouth) || 15;
  const currentEastRoad = Number(roadWidthEast) || 15;
  const currentWestRoad = Number(roadWidthWest) || 15;
  const activeRoadWidth = roadOptUpper.includes("NORTH") ? currentNorthRoad : currentSouthRoad;

  const normalizedSelectedFloors = useMemo(() => {
    if (Array.isArray(selectedFloors) && selectedFloors.length > 0) return selectedFloors;
    return ["GROUND FLOOR"];
  }, [selectedFloors]);

  const normalizedFloorData = useMemo(() => {
    const rawFloorData = planData?.floorData || {};
    const result: Record<string, any> = {};

    normalizedSelectedFloors.forEach((floorKey: string) => {
      const isTower = floorKey.toUpperCase().includes("TOWER") || floorKey.toUpperCase().includes("MUMTY");
      const fData = rawFloorData[floorKey] || {};

      let fW = Number(fData.width) || builtWidth;
      let fL = Number(fData.length) || builtLength;

      if (isTower) {
        fW = Math.min(10, builtWidth);
        fL = Math.min(10, builtLength);
      } else if (floorKey.toUpperCase().includes("GROUND") && fW > fL && fL <= builtWidth) {
        const temp = fW;
        fW = fL;
        fL = temp;
      }

      result[floorKey] = {
        width: fW,
        length: fL,
        area: Number(fData.area) || (fW * fL),
        rooms: fData.rooms || [],
        isValid: true,
        ...fData,
      };
    });

    return result;
  }, [planData, normalizedSelectedFloors, builtWidth, builtLength]);

  const computedFloorWiseTotal = useMemo(() => {
    let total = 0;
    normalizedSelectedFloors.forEach((floor: string) => {
      const floorInfo = normalizedFloorData[floor] || {};
      const floorArea = Number(floorInfo.area) || (Number(floorInfo.width) * Number(floorInfo.length)) || 0;
      total += floorArea;
    });
    return total;
  }, [normalizedSelectedFloors, normalizedFloorData]);

  // ============================================================
  // ✅ PAYMENT GATEWAY HOOK
  //  - refNoGenerator pass karo (payment ke baad fresh ref)
  //  - onPaymentSuccess mein finalRefNo receive karo
  // ============================================================
  // ✅ FIX: saara data extract karo planData se (form_snapshot ke saath)
  const selectedClientNameFromData = planData?.selectedClientName || planData?.clientName || "";
  const representativeFromData = planData?.representative || "";
  const cityDistrictFromData = planData?.cityName || planData?.city_district || "";
  const plotShapeFromData = planData?.plotShape || "RECTANGLE";

  const payment = PaymentGateway({
    refNo: refNo || "DRAFT",
    refNoGenerator: generateRefNo,
    caseType: "CONSTRUCTION_PLAN",
    stateName: userState,
    pricingItem: "map",
    userCategory: userCategory,
    customerName: customerName,

    // ✅ form_snapshot mein POORA data bhejo
    formSnapshot: {
      ...(planData || {}),
      // Explicit overrides
      customerName: customerName || planData?.customerName || "",
      propertyAddress: propertyAddress || planData?.propertyAddress || "",
      selectedClientName: selectedClientNameFromData,
      representative: representativeFromData,
      plotShape: plotShapeFromData,
      roadFacingOption: activeRoadFacing,
      plotArea: safePlotArea,
      plotDimensions: {
        ...(planData?.plotDimensions || {}),
        A: dimA, B: dimB, C: dimC, D: dimD,
        width: dimA, length: dimC,
        area: dimA * dimC,
      },
      dimDetails: planData?.dimDetails || {},
      selectedFloors: normalizedSelectedFloors,
      floorData: planData?.floorData || {},
      floorRooms: planData?.floorRooms || {},
      boundaries: {
        north: boundaries.north || "",
        south: boundaries.south || "",
        east: boundaries.east || "",
        west: boundaries.west || "",
      },
      measurementUnit: measurementUnit,
      coverageType: planData?.coverageType || "100_PERCENT",
      parkingSide: planData?.parkingSide || "SOUTH",
      planningMode: planData?.planningMode || "AUTO",
      floorSettings: planData?.floorSettings || {},
      totalFloors: normalizedSelectedFloors.length,
    },

    extraFields: {
      property_type: "HOUSE",
      deed_type: "CONSTRUCTION_PLAN",
      plot_area: safePlotArea || null,
      plot_area_unit: measurementUnit || "SQFT",
      road_side: activeRoadFacing,
      plot_shape: plotShapeFromData,
      ground_coverage: planData?.coverageType || "",
      total_builtup_area: computedFloorWiseTotal,
      customer_name: customerName || null,
      property_address: propertyAddress || null,
      client_name: selectedClientNameFromData || null,      // ✅ FIX: client alag
      representative: representativeFromData || null,       // ✅ FIX: rep alag
      city_district: cityDistrictFromData || null,
      boundary_east: boundaries.east || null,
      boundary_west: boundaries.west || null,
      boundary_north: boundaries.north || null,
      boundary_south: boundaries.south || null,
      floor_details: planData?.floorData || normalizedFloorData,
      fee_mode: "Auto",
    },
    onPaymentSuccess: (paymentId, orderId, finalRefNo) => {
      console.log("[PAYMENT SUCCESS]", { paymentId, orderId, finalRefNo });

      // ✅ Payment ke baad fresh refNo set karo
      if (finalRefNo) {
        setRefNo(finalRefNo);
        // LocalStorage mein bhi save karo (agar user refresh kare)
        try {
          localStorage.setItem("constructionPlanRefNo", finalRefNo);
        } catch {}
      }

      // Print dialog kholo
      setTimeout(() => window.print(), 500);
    },
    onPaymentError: (error) => {
      console.error("[PAYMENT ERROR]", error);
    },
  });

  // ✅ Helper — Print allowed check (paid OR admin)
  const canPrint = payment.isPaid || payment.isAdminUser;

  // ============================================================
  // 🔥 PRINT FIT
  // ============================================================
  const drawingRef = useRef<SVGGElement | null>(null);
  const [contentBox, setContentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const g = drawingRef.current;
      if (!g) return;
      try {
        const b = g.getBBox();
        if (![b.x, b.y, b.width, b.height].every(Number.isFinite) || b.width <= 0 || b.height <= 0) return;
        if (b.width > autoFitViewBox.w * 3 || b.height > autoFitViewBox.h * 3 || b.width < autoFitViewBox.w * 0.15) return;
        setContentBox((prev) =>
          prev && Math.abs(prev.x - b.x) < 0.5 && Math.abs(prev.y - b.y) < 0.5 &&
          Math.abs(prev.w - b.width) < 0.5 && Math.abs(prev.h - b.height) < 0.5
            ? prev
            : { x: b.x, y: b.y, w: b.width, h: b.height }
        );
      } catch {
        /* getBBox fail -> estimate use hoga */
      }
    };
    const raf = requestAnimationFrame(measure);
    const t1 = setTimeout(measure, 250);
    const t2 = setTimeout(measure, 1000);
    window.addEventListener("beforeprint", measure);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("beforeprint", measure);
    };
  }, [loading, planData, floorRooms, normalizedSelectedFloors, normalizedFloorData, autoFitViewBox, canPrint, measurementUnit]);

  const viewBoxFit = useMemo(() => {
    if (!contentBox) return autoFitViewBox;
    const pad = Math.max(8, Math.max(contentBox.w, contentBox.h) * 0.012);
    return { x: contentBox.x - pad, y: contentBox.y - pad, w: contentBox.w + pad * 2, h: contentBox.h + pad * 2 };
  }, [contentBox, autoFitViewBox]);

  // ============================================================
  // 📄 DYNAMIC SHEET SIZE
  // ============================================================
  const sheet = useMemo(() => {
    const MARGIN = 4;
    const GAP = 3;
    const PAD = 2;
    const SIDEBAR = 66;
    const MIN_W = 297;
    const MIN_SHEET_H_MM = 175;
    const TARGET_MM_PER_UNIT = 0.18;
    const MAX_W = 841, MAX_H = 1189;

    let sheetW = MIN_W;
    let drawW = sheetW - 2 * MARGIN - SIDEBAR - GAP - 2 * PAD;
    let k = drawW / viewBoxFit.w;
    if (k < TARGET_MM_PER_UNIT) {
      k = TARGET_MM_PER_UNIT;
      drawW = viewBoxFit.w * k;
      sheetW = Math.min(MAX_W, drawW + 2 * PAD + SIDEBAR + GAP + 2 * MARGIN);
    }
    const drawH = viewBoxFit.h * k;
    const sheetH = Math.min(MAX_H, Math.max(MIN_SHEET_H_MM, drawH + 2 * PAD + 2 * MARGIN));
    const r = (v: number) => Math.round(v * 10) / 10;
    return {
      W: r(sheetW), H: r(sheetH), MARGIN, GAP, SIDEBAR,
      innerW: r(sheetW - 2 * MARGIN), innerH: r(sheetH - 2 * MARGIN),
      canvasW: r(sheetW - 2 * MARGIN - SIDEBAR - GAP),
    };
  }, [viewBoxFit]);

  if (loading) {
    return (
      <div className="p-10 text-center font-bold text-black bg-white min-h-screen">
        LOADING ARCHITECTURAL CAD PREVIEW...
      </div>
    );
  }

  return (
    <div id="print-root" className="min-h-screen bg-white p-3 text-black uppercase font-sans print:p-0 print:bg-white">

      {/* PRINT CSS — dynamic sheet size */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: ${sheet.W}mm ${sheet.H}mm; margin: 0; }
          html, body {
            margin: 0 !important; padding: 0 !important; background: #fff !important;
            width: ${sheet.W}mm !important; height: ${sheet.H}mm !important; overflow: visible !important;
          }
          html body #print-root {
            margin: 0 !important; padding: 0 !important; background: #fff !important;
            width: ${sheet.W}mm !important; height: ${sheet.H}mm !important; min-height: 0 !important;
            position: relative !important; overflow: hidden !important;
          }
          html body #print-root > *:not(#print-grid) { display: none !important; }
          html body #print-grid {
            display: block !important; position: relative !important;
            width: ${sheet.W}mm !important; height: ${sheet.H}mm !important; max-width: none !important;
            margin: 0 !important; padding: 0 !important; border: none !important; overflow: hidden !important;
          }
          html body #print-grid #main-cad-canvas {
            position: absolute !important;
            left: ${sheet.MARGIN}mm !important; top: ${sheet.MARGIN}mm !important;
            width: ${sheet.canvasW}mm !important; height: ${sheet.innerH}mm !important;
            min-height: 0 !important; margin: 0 !important; padding: 2mm !important;
            border: 1.5px solid #000 !important; box-sizing: border-box !important;
            display: block !important; overflow: hidden !important; page-break-inside: avoid !important;
          }
          html body #print-grid #cad-svg-wrap {
            position: relative !important; width: 100% !important; height: 100% !important;
            min-height: 0 !important; display: block !important;
          }
          html body #print-grid #cad-svg {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; height: 100% !important; max-height: none !important;
            aspect-ratio: auto !important; display: block !important;
          }
          html body #print-grid #main-sidebar {
            position: absolute !important;
            right: ${sheet.MARGIN}mm !important; top: ${sheet.MARGIN}mm !important;
            width: ${sheet.SIDEBAR}mm !important; height: ${sheet.innerH}mm !important;
            min-height: 0 !important; margin: 0 !important; padding: 2mm !important;
            border: 1.5px solid #000 !important; box-sizing: border-box !important;
            overflow: hidden !important; page-break-inside: avoid !important;
          }
          button { display: none !important; }
          svg text[opacity] { opacity: 0.08 !important; }
        }
      `,
        }}
      />

      {/* ACTION HEADER */}
      <div className="max-w-[1600px] mx-auto flex flex-wrap justify-between items-center bg-slate-800 text-white p-2.5 mb-2 rounded shadow print:hidden border border-slate-700 gap-2">
        <button
          onClick={() => router.back()}
          className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 text-xs font-bold transition rounded cursor-pointer"
        >
          ← BACK TO CAD EDITOR
        </button>
        <h1 className="text-xs font-black tracking-wider text-amber-400">
          CONSTRUCTION CAD PLAN PREVIEW
        </h1>
        <button
          onClick={canPrint ? () => window.print() : payment.handlePayment}
          disabled={payment.paymentLoading || (!payment.scriptLoaded && !canPrint)}
          className={`px-4 py-1.5 text-xs font-bold transition rounded cursor-pointer ${
            payment.paymentLoading || (!payment.scriptLoaded && !canPrint)
              ? "bg-gray-400 cursor-not-allowed"
              : canPrint
              ? "bg-blue-600 hover:bg-blue-700"
              : payment.isAdminUser
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          } text-white`}
        >
          {payment.paymentLoading
            ? "PROCESSING..."
            : canPrint
            ? "🖨️ PRINT NOW"
            : payment.isAdminUser
            ? "🖨️ GENERATE FREE (ADMIN)"
            : `💳 PAY ₹${payment.amount} & PRINT`}
        </button>
      </div>

      {/* ✅ PAYMENT STATUS MESSAGE */}
      <div className="max-w-[1600px] mx-auto">
        {payment.renderStatusMessage()}
      </div>

      {/* ✅ LAUNCH OFFER BANNER */}
      {!canPrint && !payment.isAdminUser && (
        <div className="max-w-[1600px] mx-auto mb-2 print:hidden">
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border-2 border-dashed border-amber-400 rounded-xl p-3 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded shadow uppercase tracking-wider animate-pulse">
                ⚡ LIMITED TIME DEAL
              </span>
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase">
                  Professional Construction Plan Print
                </h4>
                <p className="text-[10px] text-slate-600 font-medium">
                  Includes Instant PDF Download, Digital Sealing & Verification QR Code.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-amber-200 shadow-inner">
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-[10px] text-gray-400 line-through font-semibold">
                    ₹ 999/-
                  </span>
                  <span className="bg-green-100 text-green-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                    77% OFF
                  </span>
                </div>
                <div className="text-base font-black text-emerald-600 leading-tight">
                  ₹ {payment.amount}{" "}
                  <span className="text-[10px] font-bold text-slate-700">Only</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN GRID */}
      <div id="print-grid" className="max-w-[1600px] mx-auto bg-white border-2 border-black p-2.5 grid grid-cols-12 gap-3 print:border-2 print:border-black print:p-2 print:box-border">

        {/* LEFT CAD CANVAS */}
        <div
          id="main-cad-canvas"
          className="col-span-8 md:col-span-9 border-2 border-black p-2 flex flex-col justify-between bg-white text-black print:min-h-0 print:border-0"
        >
          <div className="border-b border-black pb-1.5 mb-1 flex flex-wrap justify-between items-center text-[11px] gap-1 print:hidden">
            <span className="font-bold text-black">
              PROJECT: PROPOSED RESIDENTIAL BUILDING ({activeRoadFacing})
            </span>
            <span className="font-bold text-gray-600">
              SCALE: N.T.S. (AUTO-FIT)
            </span>
          </div>

          <div
            id="cad-svg-wrap"
            className="flex-1 w-full flex items-center justify-center bg-white overflow-visible rounded relative print:min-h-0"
          >
            <svg
              id="cad-svg"
              viewBox={`${viewBoxFit.x} ${viewBoxFit.y} ${viewBoxFit.w} ${viewBoxFit.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-auto"
              style={{ aspectRatio: `${viewBoxFit.w} / ${viewBoxFit.h}` }}
            >
              <rect
                x={viewBoxFit.x}
                y={viewBoxFit.y}
                width={viewBoxFit.w}
                height={viewBoxFit.h}
                fill="#ffffff"
              />

              {/* ✅ DRAFT WATERMARK — payment tak (admin ke liye nahi) */}
              {!canPrint && (
                <g opacity="0.12" pointerEvents="none">
                  <text
                    x={viewBoxFit.x + viewBoxFit.w / 2}
                    y={viewBoxFit.y + viewBoxFit.h / 2}
                    textAnchor="middle"
                    fontSize={Math.round(viewBoxFit.w * 0.16)}
                    fontWeight="900"
                    fill="#000"
                    transform={`rotate(-35, ${viewBoxFit.x + viewBoxFit.w / 2}, ${viewBoxFit.y + viewBoxFit.h / 2})`}
                  >
                    DRAFT
                  </text>
                </g>
              )}

              <g ref={drawingRef} transform="translate(0, 0) scale(1)">
                <PlotPolygonRenderer
                  plotPolygon={correctedPoints}
                  proposedSitePolygon={builtUpPoints}
                  cadZoom={1}
                  isSelected={false}
                  handlePolygonClick={() => {}}
                />

                <CadFloorElevationRenderer
                  totalFloors={totalFloors}
                  builtUpPoints={builtUpPoints}
                  scale={scale}
                  selectedFloors={normalizedSelectedFloors}
                  roadWidth={activeRoadWidth}
                  roadFacingOption={activeRoadFacing}
                  floorBuiltUpAreas={planData?.floorBuiltUpAreas || { "GROUND FLOOR": builtWidth * builtLength }}
                  floorData={normalizedFloorData}
                  floorRooms={floorRooms || planData?.floorRooms || {}}
                  frontMos={fMos}
                  backMos={rMos}
                  measurementUnit={measurementUnit}
                />

                <BoundaryLabels
                  topBoundary={boundaries.north}
                  bottomBoundary={boundaries.south}
                  leftBoundary={boundaries.west}
                  rightBoundary={boundaries.east}
                  dimA={dimA}
                  dimB={dimB}
                  dimC={dimC}
                  dimD={dimD}
                  pTopLeft={pTopLeft}
                  pTopRight={pTopRight}
                  pBottomLeft={pBottomLeft}
                  pBottomRight={pBottomRight}
                  centerX={centerX}
                  centerY={centerY}
                  minX={minX}
                  maxX={maxX}
                  roadFacingOption={activeRoadFacing}
                  roadWidth={activeRoadWidth}
                  measurementUnit={measurementUnit}
                />

                <RoadRenderer
                  roadFacingOption={activeRoadFacing}
                  bottomBoundary={boundaries.south}
                  topBoundary={boundaries.north}
                  boundaryEast={boundaries.east}
                  boundaryWest={boundaries.west}
                  pTopLeft={pTopLeft}
                  pTopRight={pTopRight}
                  pBottomLeft={pBottomLeft}
                  pBottomRight={pBottomRight}
                  roadWidthNorth={activeNorth ? currentNorthRoad : 0}
                  roadWidthSouth={activeSouth ? currentSouthRoad : 0}
                  roadWidthEast={activeEast ? currentEastRoad : 0}
                  roadWidthWest={activeWest ? currentWestRoad : 0}
                />
              </g>
            </svg>
          </div>

          <div className="border-t border-black pt-1 text-center text-[9px] text-gray-600 font-bold print:hidden">
            AUTOMATICALLY GENERATED DYNAMIC CAD DRAWING SHEET
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div
          id="main-sidebar"
          className="col-span-4 md:col-span-3 border-2 border-black p-3 flex flex-col justify-between text-[11px] bg-white print:border-0"
        >
          <div>
            <div className="text-center font-black text-2xl border-b-2 border-black pb-2 mb-3">
              CONSTRUCTION PLAN / FLOOR PLAN
            </div>

            <div className="border border-black p-2.5 mb-3 bg-gray-50">
              <div className="font-bold border-b border-black pb-1 mb-1 text-xs">REFERENCE</div>
              <div className="font-mono text-[10px] font-bold text-slate-800 break-all">
                {refNo || "DRAFT"}
              </div>
              <div className="text-[9px] text-gray-600 mt-1">
                DATE: {new Date().toLocaleDateString('en-IN')}
              </div>
            </div>

            <div className="border border-black p-2.5 mb-3 bg-gray-50">
              <div className="font-bold border-b border-black pb-1 mb-1 text-xs">CUSTOMER & LOCATION DETAILS</div>
              <div className="truncate"><strong>NAME:</strong> {customerName}</div>
              <div className="truncate"><strong>ADDRESS:</strong> {propertyAddress}</div>
            </div>

            <div className="border border-black p-2.5 mb-3 bg-gray-50">
              <div className="font-bold border-b border-black pb-1 mb-1 text-xs">AREA STATEMENT</div>
              <div className="flex justify-between">
                <span>PLOT AREA:</span>
                <span>{Number(plotArea).toFixed(2)} SQFT.</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                <span>PLOT SIZE:</span>
                <span>{dimA}' × {dimC}'</span>
              </div>
            </div>

            <div className="border border-black p-2.5 mb-3 bg-gray-50">
              <div className="font-bold border-b border-black pb-1 mb-1 text-xs">
                FLOOR-WISE BUILT-UP AREA
              </div>
              <div className="grid grid-cols-1 gap-1">
                {normalizedSelectedFloors.map((floor: string, idx: number) => {
                  const floorInfo = normalizedFloorData[floor] || {};
                  const floorArea = Number(floorInfo.area) || (Number(floorInfo.width) * Number(floorInfo.length)) || 0;
                  const isTower = floor.toUpperCase().includes("TOWER") || floor.toUpperCase().includes("MUMTY");

                  return (
                    <div key={idx} className="flex justify-between">
                      <span className="font-bold">
                        {floor}:{isTower ? " (MUMTY)" : ""}
                      </span>
                      <span>{floorArea.toFixed(2)} SQFT.</span>
                    </div>
                  );
                })}

                <div className="flex justify-between font-bold border-t-2 border-black pt-1 mt-1">
                  <span>TOTAL BUILT-UP:</span>
                  <span>{computedFloorWiseTotal.toFixed(2)} SQFT.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-black pt-4">
            {/* ✅ QR + Signature — sirf paid/admin ke liye */}
            {canPrint ? (
              <>
                <div className="flex flex-row items-center justify-between gap-2 p-1">
                  <div className="flex flex-col items-center">
                    <QRCodeSVG
                      value={`https://construction-estimate-software.vercel.app/verify-plan?ref=${encodeURIComponent(refNo || "PENDING")}`}
                      size={75}
                      level="M"
                    />
                    <p className="text-[7px] mt-1 text-gray-500 font-bold text-center">SCAN TO VERIFY</p>
                  </div>

                  <div className="text-[9px] text-blue-900 border border-blue-200 bg-blue-50 p-2 rounded text-left w-full shadow-sm">
                    <p className="font-bold border-b border-blue-200 mb-1">✓ VERIFIED SIGNATURE</p>
                    <p className="font-bold">Er. J.TOMAR</p>
                    <p className="mt-1 break-words">Digitally Verified & Approved</p>
                  </div>
                </div>

                <div className="border-t border-black pt-2 mt-2 text-center">
                  <p className="font-bold text-[10px]">AUTHORISED SIGNATORY</p>
                </div>
              </>
            ) : (
              <div className="border border-dashed border-gray-300 rounded p-3 text-center">
                <p className="text-[9px] text-gray-400 font-bold">
                  🔒 QR CODE & SIGNATURE
                </p>
                <p className="text-[8px] text-gray-400 mt-1">
                  Available after payment
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}