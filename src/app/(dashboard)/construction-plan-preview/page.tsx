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
  const [refNo, setRefNo] = useState<string>("DRAFT");
  const [userState, setUserState] = useState<string>("MADHYA PRADESH");
  const [userCategory, setUserCategory] = useState<string>("INDIVIDUAL USER");
  const [screenshotBlocker, setScreenshotBlocker] = useState(false);

  // ✅ Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ============================================================
  // LOAD PLAN DATA
  // ============================================================
  useEffect(() => {
    try {
      const rawData =
        localStorage.getItem("constructionPlanData") ||
        localStorage.getItem("construction_plan_preview_data") ||
        localStorage.getItem("CONSTRUCTION_PLAN_INPUT");
      if (rawData) setPlanData(JSON.parse(rawData));
    } catch (err) {
      console.error("Error loading preview data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try { localStorage.removeItem("constructionPlanRefNo"); } catch {}
    setRefNo("DRAFT");
  }, []);

  // ============================================================
  // FETCH USER PROFILE
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
        if (data?.state) setUserState(data.state);
        const category = data?.user_type || data?.role || "INDIVIDUAL USER";
        setUserCategory(category.toUpperCase());
      } catch (err) {
        console.error("[FETCH USER PROFILE ERROR]", err);
      }
    };
    fetchUserProfile();
  }, [currentUser]);

  // ============================================================
  // REF NO GENERATOR
  // ============================================================
  const generateRefNo = useCallback(async (): Promise<string> => {
    try {
      const now = new Date();
      const fy = (now.getMonth() + 1) >= 4
        ? `${String(now.getFullYear()).slice(-2)}-${String(now.getFullYear() + 1).slice(-2)}`
        : `${String(now.getFullYear() - 1).slice(-2)}-${String(now.getFullYear()).slice(-2)}`;
      const firstName = (currentUser?.full_name || "GUEST").split(' ')[0].toUpperCase();
      const { count: globalCount } = await supabase
        .from('service_records')
        .select('*', { count: 'exact', head: true })
        .eq('case_type', 'CONSTRUCTION_PLAN');
      const globalSeq = (globalCount || 0) + 1;
      const formattedSeq = `P${String(globalSeq).padStart(3, '0')}`;
      return `LnT/${fy}/${firstName}/${formattedSeq}`;
    } catch (err) {
      console.error("Ref No generation failed:", err);
      const now = new Date();
      const fy = `${String(now.getFullYear()).slice(-2)}-${String(now.getFullYear() + 1).slice(-2)}`;
      return `LnT/${fy}/GUEST/P001`;
    }
  }, [currentUser]);

  // ============================================================
  // DATA DESTRUCTURING
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

  const resolveDimension = (key: "A" | "B" | "C" | "D"): number => {
    if (dimensions?.[key] !== undefined && Number(dimensions[key]) > 0) return Number(dimensions[key]);
    if (plotDimensions?.[key] !== undefined && Number(plotDimensions[key]) > 0) return Number(plotDimensions[key]);
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

  const fallbackFromFloorData = (() => {
    const fd = planData?.floorData || {};
    const gf = fd["GROUND FLOOR"] || {};
    return { w: Number(gf.width) || 0, l: Number(gf.length) || 0 };
  })();

  const dimA = rawDimA > 0 ? rawDimA : (fallbackFromFloorData.w > 0 ? fallbackFromFloorData.w : (Number(dimensions?.width) || Number(plotDimensions?.width) || 20));
  const dimB = rawDimB > 0 ? rawDimB : dimA;
  const dimC = rawDimC > 0 ? rawDimC : (fallbackFromFloorData.l > 0 ? fallbackFromFloorData.l : (Number(dimensions?.length) || Number(plotDimensions?.length) || 50));
  const dimD = rawDimD > 0 ? rawDimD : dimC;

  const safePlotArea = Number(plotArea) > 0 ? Number(plotArea) : (dimA * dimC);

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
  // AUTO-FIT VIEWBOX
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
      const colIndex = rowIndex % 2 === 0 ? (itemsPerRow - 1) - (i % itemsPerRow) : (i % itemsPerRow);
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
    if (currentAspect < targetAspect) finalW = drawingH * targetAspect;
    else finalH = drawingW / targetAspect;
    const finalX = finalCenterX - finalW / 2;
    const finalY = finalCenterY - finalH / 2;
    const pad = 5;
    return { x: finalX - pad, y: finalY - pad, w: finalW + pad * 2, h: finalH + pad * 2 };
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
        const temp = fW; fW = fL; fL = temp;
      }
      result[floorKey] = {
        width: fW, length: fL,
        area: Number(fData.area) || (fW * fL),
        rooms: fData.rooms || [],
        isValid: true, ...fData,
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

  const selectedClientNameFromData = planData?.selectedClientName || planData?.clientName || "";
  const representativeFromData = planData?.representative || "";
  const cityDistrictFromData = planData?.cityName || planData?.city_district || "";
  const plotShapeFromData = planData?.plotShape || "RECTANGLE";

  // ============================================================
  // PAYMENT GATEWAY
  // ============================================================
  const payment = PaymentGateway({
    refNo: refNo || "DRAFT",
    refNoGenerator: generateRefNo,
    caseType: "CONSTRUCTION_PLAN",
    stateName: userState,
    pricingItem: "map",
    userCategory: userCategory,
    customerName: customerName,
    propertyAddress: propertyAddress,
    clientName: selectedClientNameFromData,
    representative: representativeFromData,
    formSnapshot: {
      ...(planData || {}),
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
        width: dimA, length: dimC, area: dimA * dimC,
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
      client_name: selectedClientNameFromData || null,
      representative: representativeFromData || null,
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
      if (finalRefNo) {
        setRefNo(finalRefNo);
        try { localStorage.setItem("constructionPlanRefNo", finalRefNo); } catch {}
      }
    },
    onPaymentError: (error) => console.error("[PAYMENT ERROR]", error),
  });

  const canPrint = payment.isPaid || payment.isAdminUser;

  // ============================================================
  // 🛡️ STRICT PRINT PROTECTION + SCREENSHOT BLOCKER
  // ============================================================
  useEffect(() => {
    if (canPrint) {
      document.body.classList.add("paid-user");
      return () => document.body.classList.remove("paid-user");
    }
    document.body.classList.remove("paid-user");

    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (ctrl && k === "p") { e.preventDefault(); e.stopPropagation(); alert("🔒 Payment required to print."); return false; }
      if (ctrl && k === "s") { e.preventDefault(); return false; }
      if (ctrl && k === "u") { e.preventDefault(); return false; }
      if (ctrl && shift && (k === "i" || k === "j" || k === "c")) { e.preventDefault(); return false; }
      if (k === "f12") { e.preventDefault(); return false; }
      if (ctrl && k === "a") { e.preventDefault(); return false; }
      if (ctrl && k === "c") { e.preventDefault(); return false; }
      if (ctrl && shift && k === "s") { e.preventDefault(); return false; }
      if (ctrl && shift && ["3", "4", "5"].includes(k)) {
        e.preventDefault();
        setScreenshotBlocker(true);
        setTimeout(() => setScreenshotBlocker(false), 2000);
        return false;
      }
      if (k === "printscreen") {
        e.preventDefault();
        navigator.clipboard.writeText("").catch(() => {});
        setScreenshotBlocker(true);
        setTimeout(() => setScreenshotBlocker(false), 2000);
        return false;
      }
    };

    const blockContext = (e: MouseEvent) => { e.preventDefault(); return false; };
    const blockPrintEvent = (e: Event) => { e.preventDefault(); return false; };
    const blockCopy = (e: ClipboardEvent | DragEvent) => { e.preventDefault(); return false; };

    const onBlur = () => {
      setScreenshotBlocker(true);
      setTimeout(() => setScreenshotBlocker(false), 1500);
    };

    window.addEventListener("keydown", blockKeys, true);
    window.addEventListener("contextmenu", blockContext, true);
    window.addEventListener("beforeprint", blockPrintEvent, true);
    document.addEventListener("copy", blockCopy as any, true);
    document.addEventListener("cut", blockCopy as any, true);
    document.addEventListener("dragstart", blockCopy as any, true);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", blockKeys, true);
      window.removeEventListener("contextmenu", blockContext, true);
      window.removeEventListener("beforeprint", blockPrintEvent, true);
      document.removeEventListener("copy", blockCopy as any, true);
      document.removeEventListener("cut", blockCopy as any, true);
      document.removeEventListener("dragstart", blockCopy as any, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [canPrint]);

  // ============================================================
  // SERVER-SIDE VERIFY
  // ============================================================
  const verifyPaidOnServer = useCallback(async (): Promise<boolean> => {
    try {
      if (!refNo || refNo === "DRAFT") return false;
      if (payment.isAdminUser) return true;
      const { data, error } = await supabase
        .from("service_records")
        .select("payment_status, razorpay_payment_id")
        .eq("ref_no", refNo)
        .maybeSingle();
      if (error) { console.error("[SERVER VERIFY ERROR]", error); return false; }
      const isPaid = data?.payment_status === "paid" && Boolean(data?.razorpay_payment_id) && data.razorpay_payment_id !== "ADMIN_FREE";
      console.log("[SERVER VERIFY]", { refNo, isPaid, data });
      return isPaid;
    } catch (err) {
      console.error("[SERVER VERIFY EXCEPTION]", err);
      return false;
    }
  }, [refNo, payment.isAdminUser]);

  const handlePrintClick = useCallback(async () => {
    if (!canPrint) { payment.handlePayment(); return; }
    const verified = await verifyPaidOnServer();
    if (!verified) { alert("🔒 Server verification failed."); return; }
    setTimeout(() => window.print(), 200);
  }, [canPrint, payment, verifyPaidOnServer]);

  // ============================================================
  // PRINT FIT
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
            ? prev : { x: b.x, y: b.y, w: b.width, h: b.height }
        );
      } catch {}
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
  // DYNAMIC SHEET SIZE
  // ============================================================
  const sheet = useMemo(() => {
    const MARGIN = 4, GAP = 3, PAD = 2, SIDEBAR = 66;
    const MIN_W = 297, MIN_SHEET_H_MM = 175, TARGET_MM_PER_UNIT = 0.18;
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

  // ============================================================
  // 🛡️ UNIQUE DRAFT WATERMARK TEXT
  // ============================================================
  const draftWatermarkText = useMemo(() => {
    const date = new Date().toLocaleDateString('en-IN');
    const user = currentUser?.email || "GUEST";
    return `DRAFT • NOT FOR CONSTRUCTION • ${user} • ${date}`;
  }, [currentUser]);

  if (loading) {
    return (
      <div className="p-10 text-center font-bold text-black bg-white min-h-screen">
        LOADING ARCHITECTURAL CAD PREVIEW...
      </div>
    );
  }

  const mobileWrapperStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed", top: "50%", left: "50%",
        width: "100vh", height: "100vw",
        transform: "translate(-50%, -50%) rotate(90deg)",
        transformOrigin: "center center",
        backgroundColor: "#ffffff",
        padding: "6px", boxSizing: "border-box",
        overflow: "auto", zIndex: 40,
      }
    : {};

  return (
    <div
      id="print-root"
      className={
        isMobile
          ? "bg-white text-black uppercase font-sans print:p-0"
          : "min-h-screen bg-white p-3 text-black uppercase font-sans print:p-0 print:bg-white"
      }
      style={isMobile ? mobileWrapperStyle : undefined}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: ${sheet.W}mm ${sheet.H}mm; margin: 0; }

          body:not(.paid-user) #print-root,
          body:not(.paid-user) #print-root * {
            display: none !important;
            visibility: hidden !important;
          }
          body:not(.paid-user)::after {
            content: "🔒 PAYMENT REQUIRED TO PRINT THIS DOCUMENT";
            display: block !important;
            visibility: visible !important;
            font-size: 28pt; font-weight: 900;
            text-align: center; color: #cc0000;
            padding: 80px 40px;
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: #fff;
            border: 4px dashed #cc0000;
            width: 80%;
          }

          html, body {
            margin: 0 !important; padding: 0 !important; background: #fff !important;
            width: ${sheet.W}mm !important; height: ${sheet.H}mm !important; overflow: visible !important;
          }
          html body #print-root {
            margin: 0 !important; padding: 0 !important; background: #fff !important;
            width: ${sheet.W}mm !important; height: ${sheet.H}mm !important; min-height: 0 !important;
            position: relative !important; overflow: hidden !important;
            transform: none !important;
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

      {/* ✅ SCREENSHOT BLOCKER OVERLAY */}
      {screenshotBlocker && !canPrint && (
        <div className="fixed inset-0 z-[99999] bg-black flex items-center justify-center">
          <div className="text-white text-center">
            <div className="text-6xl mb-4">🔒</div>
            <div className="text-2xl font-black">SCREEN CAPTURE DETECTED</div>
            <div className="text-sm mt-2">This content is protected. Payment required.</div>
          </div>
        </div>
      )}

      {/* ACTION HEADER */}
      <div className={`${isMobile ? "max-w-full" : "max-w-[1600px] mx-auto"} flex flex-wrap justify-between items-center bg-slate-800 text-white ${isMobile ? "p-1.5 gap-1" : "p-2.5 mb-2 gap-2"} rounded shadow print:hidden border border-slate-700`}>
        <button onClick={() => router.back()} className={`bg-slate-700 hover:bg-slate-600 text-white ${isMobile ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"} font-bold transition rounded cursor-pointer`}>
          ← BACK
        </button>
        <h1 className={`${isMobile ? "text-[10px]" : "text-xs"} font-black tracking-wider text-amber-400`}>
          CONSTRUCTION CAD PLAN PREVIEW
        </h1>
        <button
          onClick={handlePrintClick}
          disabled={payment.paymentLoading || (!payment.scriptLoaded && !canPrint) || payment.pricingLoading}
          className={`${isMobile ? "px-2 py-1 text-[10px]" : "px-4 py-1.5 text-xs"} font-bold transition rounded cursor-pointer ${
            payment.paymentLoading || (!payment.scriptLoaded && !canPrint) || payment.pricingLoading
              ? "bg-gray-400 cursor-not-allowed"
              : canPrint ? "bg-blue-600 hover:bg-blue-700"
              : payment.isAdminUser ? "bg-purple-600 hover:bg-purple-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          } text-white`}
        >
          {payment.pricingLoading ? "LOADING PRICE..."
            : payment.paymentLoading ? "PROCESSING..."
            : canPrint ? "🖨️ PRINT NOW"
            : payment.isAdminUser ? "🖨️ FREE (ADMIN)"
            : `💳 PAY ₹${payment.price || 0} & PRINT`}
        </button>
      </div>

      <div className={`${isMobile ? "max-w-full" : "max-w-[1600px] mx-auto"}`}>
        {payment.renderStatusMessage()}
      </div>

      {/* LAUNCH OFFER BANNER */}
      {!canPrint && !payment.isAdminUser && (
        <div className={`${isMobile ? "max-w-full" : "max-w-[1600px] mx-auto"} mb-2 print:hidden`}>
          <div className={`bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border-2 border-dashed border-amber-400 rounded-xl ${isMobile ? "p-1.5" : "p-3"} shadow-md flex flex-col sm:flex-row items-center justify-between gap-3`}>
            <div className="flex items-center gap-3">
              <span className={`bg-red-600 text-white ${isMobile ? "text-[9px] px-1.5 py-0.5" : "text-[11px] px-2.5 py-1"} rounded shadow uppercase tracking-wider animate-pulse font-extrabold`}>
                ⚡ LIMITED TIME
              </span>
              <div>
                <h4 className={`${isMobile ? "text-[10px]" : "text-xs"} font-extrabold text-slate-900 uppercase`}>
                  Professional Construction Plan Print
                </h4>
                <p className={`${isMobile ? "text-[9px]" : "text-[10px]"} text-slate-600 font-medium`}>
                  Includes Instant PDF Download, Digital Sealing & Verification QR Code.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-amber-200 shadow-inner">
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {payment.discountEnabled && payment.discountPercent > 0 && (
                    <>
                      <span className="text-[10px] text-gray-400 line-through font-semibold">₹ {payment.mrp}/-</span>
                      <span className="bg-green-100 text-green-800 text-[9px] font-bold px-1.5 py-0.5 rounded">{payment.discountPercent}% OFF</span>
                    </>
                  )}
                </div>
                <div className={`${isMobile ? "text-sm" : "text-base"} font-black text-emerald-600 leading-tight`}>
                  ₹ {payment.price || 0} <span className="text-[10px] font-bold text-slate-700">Only</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN GRID */}
      <div id="print-grid" className={`${isMobile ? "max-w-full" : "max-w-[1600px] mx-auto"} bg-white border-2 border-black ${isMobile ? "p-1.5" : "p-2.5"} grid grid-cols-12 gap-3 print:border-2 print:border-black print:p-2 print:box-border`}>

        {/* LEFT CAD CANVAS */}
        <div id="main-cad-canvas" className="col-span-8 md:col-span-9 border-2 border-black p-1.5 flex flex-col justify-between bg-white text-black print:min-h-0 print:border-0">
          <div className={`border-b border-black pb-1 mb-1 flex flex-wrap justify-between items-center ${isMobile ? "text-[9px]" : "text-[11px]"} gap-1 print:hidden`}>
            <span className="font-bold text-black truncate">PROJECT: PROPOSED RESIDENTIAL BUILDING ({activeRoadFacing})</span>
            <span className="font-bold text-gray-600">SCALE: N.T.S. (AUTO-FIT)</span>
          </div>

          <div id="cad-svg-wrap" className="flex-1 w-full flex items-center justify-center bg-white overflow-visible rounded relative print:min-h-0">
            <svg
              id="cad-svg"
              viewBox={`${viewBoxFit.x} ${viewBoxFit.y} ${viewBoxFit.w} ${viewBoxFit.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-auto"
              style={{ aspectRatio: `${viewBoxFit.w} / ${viewBoxFit.h}` }}
            >
              {/* ✅ FIRST: White background rect */}
              <rect
                x={viewBoxFit.x}
                y={viewBoxFit.y}
                width={viewBoxFit.w}
                height={viewBoxFit.h}
                fill="#ffffff"
              />

              {/* ✅ THEN: Drawing Group */}
              <g ref={drawingRef} transform="translate(0, 0) scale(1)">
                <PlotPolygonRenderer
                  plotPolygon={correctedPoints}
                  proposedSitePolygon={builtUpPoints}
                  cadZoom={1}
                  isSelected={false}
                  handlePolygonClick={() => {}}
                />

                {(() => {
                  const builtUpCenterX = builtUpPoints.reduce((sum, p) => sum + p.x, 0) / builtUpPoints.length;
                  const builtUpCenterY = builtUpPoints.reduce((sum, p) => sum + p.y, 0) / builtUpPoints.length;
                  const builtUpWidth = Math.abs(builtUpPoints[1].x - builtUpPoints[0].x);
                  const isNarrowBuiltUp = builtUpWidth < 80;
                  const textRotation = isNarrowBuiltUp ? -90 : 0;

                  return (
                    <g transform={`translate(${builtUpCenterX}, ${builtUpCenterY})`}>
                      <text
                        x="0"
                        y="1"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#000000"
                        transform={`rotate(${textRotation})`}
                        style={{
                          fontWeight: "900",
                          fontSize: "7.5px",
                          fontFamily: "sans-serif",
                          paintOrder: "stroke",
                          stroke: "#ffffff",
                          strokeWidth: "3px",
                        }}
                      >
                        PROPOSED SITE
                      </text>
                    </g>
                  );
                })()}

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
                  dimA={dimA} dimB={dimB} dimC={dimC} dimD={dimD}
                  pTopLeft={pTopLeft} pTopRight={pTopRight}
                  pBottomLeft={pBottomLeft} pBottomRight={pBottomRight}
                  centerX={centerX} centerY={centerY}
                  minX={minX} maxX={maxX}
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
                  pTopLeft={pTopLeft} pTopRight={pTopRight}
                  pBottomLeft={pBottomLeft} pBottomRight={pBottomRight}
                  roadWidthNorth={activeNorth ? currentNorthRoad : 0}
                  roadWidthSouth={activeSouth ? currentSouthRoad : 0}
                  roadWidthEast={activeEast ? currentEastRoad : 0}
                  roadWidthWest={activeWest ? currentWestRoad : 0}
                />
              </g>

              {/* ✅ LAST: Watermark overlay — ON TOP of drawing (payment se pehle) */}
              {!canPrint && (
                <>
                  <defs>
                    <pattern
                      id="watermark-pattern"
                      x="0" y="0"
                      width="400" height="300"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(-30)"
                    >
                      <text x="0" y="40" fontSize="28" fontWeight="900" fill="#000" fillOpacity="0.10" fontFamily="Arial, sans-serif" letterSpacing="2">
                        {draftWatermarkText}
                      </text>
                      <text x="-200" y="140" fontSize="28" fontWeight="900" fill="#cc0000" fillOpacity="0.08" fontFamily="Arial, sans-serif" letterSpacing="2">
                        ⚠ DRAFT — NOT FOR CONSTRUCTION ⚠
                      </text>
                      <text x="0" y="240" fontSize="28" fontWeight="900" fill="#000" fillOpacity="0.10" fontFamily="Arial, sans-serif" letterSpacing="2">
                        {draftWatermarkText}
                      </text>
                    </pattern>
                  </defs>

                  <rect
                    x={viewBoxFit.x}
                    y={viewBoxFit.y}
                    width={viewBoxFit.w}
                    height={viewBoxFit.h}
                    fill="url(#watermark-pattern)"
                    pointerEvents="none"
                  />

                  <g opacity="0.20" pointerEvents="none">
                    <text
                      x={viewBoxFit.x + viewBoxFit.w / 2}
                      y={viewBoxFit.y + viewBoxFit.h / 2}
                      textAnchor="middle"
                      fontSize={Math.round(viewBoxFit.w * 0.20)}
                      fontWeight="900"
                      fill="#cc0000"
                      fontFamily="Arial Black, sans-serif"
                      transform={`rotate(-30, ${viewBoxFit.x + viewBoxFit.w / 2}, ${viewBoxFit.y + viewBoxFit.h / 2})`}
                    >
                      DRAFT
                    </text>
                  </g>

                  <g opacity="0.12" pointerEvents="none">
                    <text
                      x={viewBoxFit.x + viewBoxFit.w * 0.05}
                      y={viewBoxFit.y + viewBoxFit.h * 0.95}
                      fontSize={Math.round(viewBoxFit.w * 0.025)}
                      fontWeight="900"
                      fill="#1e3a8a"
                      fontFamily="Arial, sans-serif"
                    >
                      🏗️ LNT CONSULTANT
                    </text>
                    <text
                      x={viewBoxFit.x + viewBoxFit.w * 0.55}
                      y={viewBoxFit.y + viewBoxFit.h * 0.08}
                      fontSize={Math.round(viewBoxFit.w * 0.025)}
                      fontWeight="900"
                      fill="#1e3a8a"
                      fontFamily="Arial, sans-serif"
                    >
                      🏗️ LNT CONSULTANT
                    </text>
                  </g>

                  <g pointerEvents="none">
                    <rect
                      x={viewBoxFit.x}
                      y={viewBoxFit.y + viewBoxFit.h - viewBoxFit.h * 0.06}
                      width={viewBoxFit.w}
                      height={viewBoxFit.h * 0.06}
                      fill="#cc0000"
                      fillOpacity="0.85"
                    />
                    <text
                      x={viewBoxFit.x + viewBoxFit.w / 2}
                      y={viewBoxFit.y + viewBoxFit.h - viewBoxFit.h * 0.018}
                      textAnchor="middle"
                      fontSize={Math.round(viewBoxFit.w * 0.022)}
                      fontWeight="900"
                      fill="#ffffff"
                      fontFamily="Arial, sans-serif"
                    >
                      ⚠️ UNAUTHORIZED COPY - DRAFT - PRINT AFTER PAYMENT ONLY ⚠️
                    </text>
                  </g>
                </>
              )}

              {/* Header bar */}
              <g pointerEvents="none">
                <rect
                  x={viewBoxFit.x}
                  y={viewBoxFit.y}
                  width={viewBoxFit.w}
                  height={viewBoxFit.h * 0.035}
                  fill="#1e3a8a"
                  fillOpacity="0.95"
                />
                <text
                  x={viewBoxFit.x + viewBoxFit.w * 0.02}
                  y={viewBoxFit.y + viewBoxFit.h * 0.024}
                  fontSize={Math.round(viewBoxFit.w * 0.018)}
                  fontWeight="900"
                  fill="#ffffff"
                  fontFamily="Arial, sans-serif"
                >
                  🏗️ LNT CONSULTANT
                </text>
                <text
                  x={viewBoxFit.x + viewBoxFit.w * 0.98}
                  y={viewBoxFit.y + viewBoxFit.h * 0.024}
                  textAnchor="end"
                  fontSize={Math.round(viewBoxFit.w * 0.014)}
                  fontWeight="700"
                  fill="#ffffff"
                  fontFamily="Arial, sans-serif"
                >
                  {canPrint ? `REF: ${refNo}` : "DRAFT COPY"}
                </text>
              </g>
            </svg>
          </div>

          <div className={`border-t border-black pt-1 text-center ${isMobile ? "text-[8px]" : "text-[9px]"} text-gray-600 font-bold print:hidden`}>
            AUTOMATICALLY GENERATED DYNAMIC CAD DRAWING SHEET
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div id="main-sidebar" className={`col-span-4 md:col-span-3 border-2 border-black ${isMobile ? "p-1.5 text-[9px]" : "p-3 text-[11px]"} flex flex-col justify-between bg-white print:border-0`}>
          <div>
            <div className={`text-center font-black ${isMobile ? "text-base" : "text-2xl"} border-b-2 border-black pb-1.5 mb-2`}>
              🏗️ LNT CONSULTANT
            </div>
            <div className="text-center text-xs font-bold text-gray-600 mb-1.5">
              CONSTRUCTION PLAN / FLOOR PLAN
            </div>

            <div className={`border border-black ${isMobile ? "p-1.5" : "p-2.5"} mb-2 bg-gray-50`}>
              <div className={`font-bold border-b border-black pb-1 mb-1 ${isMobile ? "text-[10px]" : "text-xs"}`}>REFERENCE</div>
              <div className={`font-mono ${isMobile ? "text-[9px]" : "text-[10px]"} font-bold text-slate-800 break-all`}>
                {refNo || "DRAFT"}
              </div>
              <div className={`${isMobile ? "text-[8px]" : "text-[9px]"} text-gray-600 mt-1`}>
                DATE: {new Date().toLocaleDateString('en-IN')}
              </div>
            </div>

            <div className={`border border-black ${isMobile ? "p-1.5" : "p-2.5"} mb-2 bg-gray-50`}>
              <div className={`font-bold border-b border-black pb-1 mb-1 ${isMobile ? "text-[10px]" : "text-xs"}`}>CUSTOMER & LOCATION DETAILS</div>
              <div className="truncate"><strong>NAME:</strong> {customerName}</div>
              <div className="truncate"><strong>ADDRESS:</strong> {propertyAddress}</div>
            </div>

            <div className={`border border-black ${isMobile ? "p-1.5" : "p-2.5"} mb-2 bg-gray-50`}>
              <div className={`font-bold border-b border-black pb-1 mb-1 ${isMobile ? "text-[10px]" : "text-xs"}`}>AREA STATEMENT</div>
              <div className="flex justify-between">
                <span>PLOT AREA:</span>
                <span>{Number(plotArea).toFixed(2)} SQFT.</span>
              </div>
              <div className={`flex justify-between ${isMobile ? "text-[8px]" : "text-[10px]"} text-gray-600 mt-1`}>
                <span>PLOT SIZE:</span>
                <span>{dimA}' × {dimC}'</span>
              </div>
            </div>

            <div className={`border border-black ${isMobile ? "p-1.5" : "p-2.5"} mb-2 bg-gray-50`}>
              <div className={`font-bold border-b border-black pb-1 mb-1 ${isMobile ? "text-[10px]" : "text-xs"}`}>FLOOR-WISE BUILT-UP AREA</div>
              <div className="grid grid-cols-1 gap-1">
                {normalizedSelectedFloors.map((floor: string, idx: number) => {
                  const floorInfo = normalizedFloorData[floor] || {};
                  const floorArea = Number(floorInfo.area) || (Number(floorInfo.width) * Number(floorInfo.length)) || 0;
                  const isTower = floor.toUpperCase().includes("TOWER") || floor.toUpperCase().includes("MUMTY");
                  return (
                    <div key={idx} className="flex justify-between">
                      <span className="font-bold">{floor}:{isTower ? " (MUMTY)" : ""}</span>
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

          <div className="border-t-2 border-black pt-2">
            {canPrint ? (
              <>
                <div className="flex flex-row items-center justify-between gap-2 p-1">
                  <div className="flex flex-col items-center shrink-0">
                    <QRCodeSVG
                      value={`https://construction-estimate-software.vercel.app/verify-plan?ref=${encodeURIComponent(refNo || "PENDING")}`}
                      size={isMobile ? 55 : 75}
                      level="M"
                    />
                    <p className={`${isMobile ? "text-[6px]" : "text-[7px]"} mt-1 text-gray-500 font-bold text-center`}>SCAN TO VERIFY</p>
                  </div>
                  <div className="flex flex-col items-center justify-end flex-1">
                    <img src="/signature-jayant-tomar.png" alt="Authorised Signature" className={`${isMobile ? "h-16" : "h-24"} w-auto object-contain`} />
                    <p className={`${isMobile ? "text-[7px]" : "text-[8px]"} font-bold text-slate-700 mt-0.5`}>ER. JAYANT TOMAR</p>
                    <p className={`${isMobile ? "text-[6px]" : "text-[7px]"} font-bold text-slate-600 leading-tight`}>T &amp; CP REGD. NO.</p>
                    <p className={`${isMobile ? "text-[6px]" : "text-[7px]"} font-bold text-slate-600 leading-tight`}>23IND-IER050924212</p>
                  </div>
                </div>
                <div className={`${isMobile ? "text-[8px] p-1.5" : "text-[9px] p-2"} text-blue-900 border border-blue-200 bg-blue-50 rounded text-left w-full shadow-sm mt-1`}>
                  <p className="font-bold border-b border-blue-200 mb-1">✓ DIGITALLY VERIFIED</p>
                  <p className="font-bold">Er. J.TOMAR</p>
                  <p className="mt-1 break-words">Digitally Verified &amp; Approved</p>
                </div>
                <div className="border-t border-black pt-1 mt-1 text-center">
                  <p className={`font-bold ${isMobile ? "text-[9px]" : "text-[10px]"}`}>AUTHORISED SIGNATORY</p>
                </div>
              </>
            ) : (
              <div className="border-2 border-dashed border-red-400 rounded p-3 text-center bg-red-50">
                <p className={`${isMobile ? "text-[10px]" : "text-[12px]"} text-red-700 font-black`}>⚠️ DRAFT COPY</p>
                <p className={`${isMobile ? "text-[8px]" : "text-[9px]"} text-red-600 font-bold mt-1`}>NOT VALID FOR CONSTRUCTION</p>
                <p className={`${isMobile ? "text-[8px]" : "text-[9px]"} text-red-600 font-bold mt-1`}>🔒 PAY TO UNLOCK QR &amp; SIGNATURE</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}