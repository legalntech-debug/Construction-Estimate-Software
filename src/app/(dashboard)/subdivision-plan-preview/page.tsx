"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

import PaymentGateway from "./components/PaymentGateway";
import { buildPlanPdf, downloadBlob } from "../construction-plan-preview/planPdf";
import SubdivisionCanvas from "../subdivision-plan/components/SubdivisionCanvas";
import CadViewModal from "../subdivision-plan/components/CadViewModal";
import { generateCustomLayoutPieces } from "../subdivision-plan/subdivisionLayouts";

/* =========================================================
   AUTO-GENERATE PIECES from input form config
   ---------------------------------------------------------
   Supported modes:
     - SIMPLE (EQUAL / CUSTOM)
     - CORNER (grid split)
     - WITH_ROAD (road cut + pieces)
     - CUSTOM_GRID (rows × columns)
     - TEMPLATE (layout pattern + piece sizes)
     - MANUAL (hand-built shapes)
========================================================= */
function generatePiecesFromConfig(dimA: number, dimC: number, config: any, unit: "FEET" | "METERS" = "FEET") {
  if (!config) return [];
  const mode = config.mode || "SIMPLE";
  const pieces: any[] = [];

  // TEMPLATE / MANUAL layouts are built by the shared layout module
  if (mode === "TEMPLATE" || mode === "MANUAL") {
    return generateCustomLayoutPieces(dimA, dimC, config, unit);
  }

  // ═══════════════════════════════════════════════════
  // MODE 1: SIMPLE (EQUAL / CUSTOM)
  // ═══════════════════════════════════════════════════
  if (mode === "SIMPLE") {
    const { count, direction, splitBy, customPieces } = config;

    // ─── CUSTOM sizes ───
    if (splitBy === "CUSTOM" && Array.isArray(customPieces) && customPieces.length > 0) {
      let cursor = 0;
      for (let i = 0; i < customPieces.length; i++) {
        const cp = customPieces[i];
        const w = Number(cp.widthFt) || 0;
        const d = Number(cp.depthFt) || 0;

        let polygon: any = [];
        let bboxW = 0, bboxH = 0;

        if (direction === "HORIZONTAL") {
          polygon = [
            { x: 0, y: cursor },
            { x: dimA, y: cursor },
            { x: dimA, y: cursor + d },
            { x: 0, y: cursor + d },
          ];
          bboxW = dimA; bboxH = d;
          cursor += d;
        } else {
          polygon = [
            { x: cursor, y: 0 },
            { x: cursor + w, y: 0 },
            { x: cursor + w, y: dimC },
            { x: cursor, y: dimC },
          ];
          bboxW = w; bboxH = dimC;
          cursor += w;
        }

        pieces.push({
          id: `p${i + 1}`,
          label: (cp.label || `PLOT ${i + 1}`).toUpperCase(),
          kind: "PLOT",
          number: i + 1,
          area: bboxW * bboxH,
          polygon,
          bbox: {
            minX: polygon[0].x, minY: polygon[0].y,
            maxX: polygon[2].x, maxY: polygon[2].y,
            w: bboxW, h: bboxH,
          },
          isRect: true,
          centroid: {
            x: (polygon[0].x + polygon[2].x) / 2,
            y: (polygon[0].y + polygon[2].y) / 2,
          },
        });
      }
      return pieces;
    }

    // ─── EQUAL split ───
    const totalCount = Math.max(1, Math.min(20, Number(count) || 1));
    for (let i = 0; i < totalCount; i++) {
      let polygon: any = [];
      let bboxW = 0, bboxH = 0;

      if (direction === "HORIZONTAL") {
        const pieceH = dimC / totalCount;
        polygon = [
          { x: 0, y: i * pieceH },
          { x: dimA, y: i * pieceH },
          { x: dimA, y: (i + 1) * pieceH },
          { x: 0, y: (i + 1) * pieceH },
        ];
        bboxW = dimA; bboxH = pieceH;
      } else {
        const pieceW = dimA / totalCount;
        polygon = [
          { x: i * pieceW, y: 0 },
          { x: (i + 1) * pieceW, y: 0 },
          { x: (i + 1) * pieceW, y: dimC },
          { x: i * pieceW, y: dimC },
        ];
        bboxW = pieceW; bboxH = dimC;
      }

      pieces.push({
        id: `p${i + 1}`,
        label: `PLOT ${i + 1}`,
        kind: "PLOT",
        number: i + 1,
        area: bboxW * bboxH,
        polygon,
        bbox: {
          minX: polygon[0].x, minY: polygon[0].y,
          maxX: polygon[2].x, maxY: polygon[2].y,
          w: bboxW, h: bboxH,
        },
        isRect: true,
        centroid: {
          x: (polygon[0].x + polygon[2].x) / 2,
          y: (polygon[0].y + polygon[2].y) / 2,
        },
      });
    }
    return pieces;
  }

  // ═══════════════════════════════════════════════════
  // MODE 2: CORNER PLOT / CUSTOM_GRID (rows × cols)
  // ═══════════════════════════════════════════════════
  if (mode === "CORNER" || mode === "CUSTOM_GRID") {
    const corner = config.corner || { side1Pieces: 3, side2Pieces: 2 };
    const cols = Math.max(1, Math.min(10, Number(corner.side1Pieces) || 3));
    const rows = Math.max(1, Math.min(10, Number(corner.side2Pieces) || 2));

    const pieceW = dimA / cols;
    const pieceH = dimC / rows;

    let idx = 0;
    const labels = "ABCDEFGHIJKLMNOPQRST";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = c * pieceW;
        const y0 = r * pieceH;
        const x1 = x0 + pieceW;
        const y1 = y0 + pieceH;
        const label = `PLOT ${labels[idx] || idx + 1}`;

        pieces.push({
          id: `p${idx + 1}`,
          label,
          kind: "PLOT",
          number: idx + 1,
          area: pieceW * pieceH,
          polygon: [
            { x: x0, y: y0 },
            { x: x1, y: y0 },
            { x: x1, y: y1 },
            { x: x0, y: y1 },
          ],
          bbox: {
            minX: x0, minY: y0,
            maxX: x1, maxY: y1,
            w: pieceW, h: pieceH,
          },
          isRect: true,
          centroid: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
        });
        idx++;
      }
    }
    return pieces;
  }

  // ═══════════════════════════════════════════════════
  // MODE 3: WITH_ROAD — Road portion + remaining pieces
  // ═══════════════════════════════════════════════════
  if (mode === "WITH_ROAD") {
    const road = config.road || { roadSide: "TOP", roadWidthFt: 10 };
    const roadW = Math.max(0, Number(road.roadWidthFt) || 10);
    const side = road.roadSide || "TOP";

    let roadPolygon: any = [];
    let plotX0 = 0, plotY0 = 0, plotX1 = dimA, plotY1 = dimC;

    if (side === "TOP") {
      roadPolygon = [
        { x: 0, y: 0 },
        { x: dimA, y: 0 },
        { x: dimA, y: roadW },
        { x: 0, y: roadW },
      ];
      plotY0 = roadW;
    } else if (side === "BOTTOM") {
      roadPolygon = [
        { x: 0, y: dimC - roadW },
        { x: dimA, y: dimC - roadW },
        { x: dimA, y: dimC },
        { x: 0, y: dimC },
      ];
      plotY1 = dimC - roadW;
    } else if (side === "LEFT") {
      roadPolygon = [
        { x: 0, y: 0 },
        { x: roadW, y: 0 },
        { x: roadW, y: dimC },
        { x: 0, y: dimC },
      ];
      plotX0 = roadW;
    } else {
      roadPolygon = [
        { x: dimA - roadW, y: 0 },
        { x: dimA, y: 0 },
        { x: dimA, y: dimC },
        { x: dimA - roadW, y: dimC },
      ];
      plotX1 = dimA - roadW;
    }

    // Add road piece
    pieces.push({
      id: `road-1`,
      label: `ROAD (${roadW} ft)`,
      kind: "REMAINDER",
      number: 0,
      area:
        (roadPolygon[2].x - roadPolygon[0].x) *
        (roadPolygon[2].y - roadPolygon[0].y),
      polygon: roadPolygon,
      bbox: {
        minX: roadPolygon[0].x, minY: roadPolygon[0].y,
        maxX: roadPolygon[2].x, maxY: roadPolygon[2].y,
        w: roadPolygon[2].x - roadPolygon[0].x,
        h: roadPolygon[2].y - roadPolygon[0].y,
      },
      isRect: true,
      centroid: {
        x: (roadPolygon[0].x + roadPolygon[2].x) / 2,
        y: (roadPolygon[0].y + roadPolygon[2].y) / 2,
      },
    });

    // Remaining plot split
    const remainingW = plotX1 - plotX0;
    const remainingH = plotY1 - plotY0;
    const count = Math.max(1, Number(config.count) || 1);
    const direction = config.direction || "VERTICAL";

    for (let i = 0; i < count; i++) {
      let polygon: any = [];
      let bboxW = 0, bboxH = 0;

      if (direction === "HORIZONTAL") {
        const pieceH = remainingH / count;
        polygon = [
          { x: plotX0, y: plotY0 + i * pieceH },
          { x: plotX1, y: plotY0 + i * pieceH },
          { x: plotX1, y: plotY0 + (i + 1) * pieceH },
          { x: plotX0, y: plotY0 + (i + 1) * pieceH },
        ];
        bboxW = remainingW; bboxH = pieceH;
      } else {
        const pieceW = remainingW / count;
        polygon = [
          { x: plotX0 + i * pieceW, y: plotY0 },
          { x: plotX0 + (i + 1) * pieceW, y: plotY0 },
          { x: plotX0 + (i + 1) * pieceW, y: plotY1 },
          { x: plotX0 + i * pieceW, y: plotY1 },
        ];
        bboxW = pieceW; bboxH = remainingH;
      }

      pieces.push({
        id: `p${i + 1}`,
        label: `PLOT ${i + 1}`,
        kind: "PLOT",
        number: i + 1,
        area: bboxW * bboxH,
        polygon,
        bbox: {
          minX: polygon[0].x, minY: polygon[0].y,
          maxX: polygon[2].x, maxY: polygon[2].y,
          w: bboxW, h: bboxH,
        },
        isRect: true,
        centroid: {
          x: (polygon[0].x + polygon[2].x) / 2,
          y: (polygon[0].y + polygon[2].y) / 2,
        },
      });
    }
    return pieces;
  }

  return pieces;
}

export default function SubdivisionPlanPreview() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [planData, setPlanData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refNo, setRefNo] = useState<string>("DRAFT");
  const [userState, setUserState] = useState<string>("MADHYA PRADESH");
  const [userCategory, setUserCategory] = useState<string>("INDIVIDUAL USER");
  const [screenshotBlocker, setScreenshotBlocker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pieces, setPieces] = useState<any[]>([]);
  const [cadOpen, setCadOpen] = useState(false); // full-screen zoom / pan CAD viewer

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ─── Load planData ───
  useEffect(() => {
    try {
      const raw = localStorage.getItem("subdivision_plan_preview_data");
      if (raw) {
        const parsed = JSON.parse(raw);
        console.log("[SUBDIV PREVIEW] Loaded planData:", parsed);
        setPlanData(parsed);
      }
    } catch (err) {
      console.error("Error loading subdivision preview:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── AUTO-GENERATE PIECES ───
  useEffect(() => {
    if (!planData) return;
    if (pieces.length > 0) return;

    const cfg = planData.subdivisionConfig;
    if (!cfg) return;

    const resolve = (k: "A" | "B" | "C" | "D"): number => {
      const p = planData.plotDimensions?.[k];
      if (p !== undefined && Number(p) > 0) return Number(p);
      const d = planData.dimDetails?.[k];
      if (d) {
        const t = Number(d.ft || 0) + Number(d.in || 0) / 12;
        if (t > 0) return t;
      }
      return 0;
    };

    const dimA = resolve("A") || 30;
    const dimC = resolve("C") || 50;

    const generated = generatePiecesFromConfig(
      dimA,
      dimC,
      cfg,
      planData.measurementUnit === "METERS" ? "METERS" : "FEET"
    );
    console.log(
      "[SUBDIV PREVIEW] Auto-generated pieces:",
      generated.length,
      generated
    );
    setPieces(generated);
  }, [planData, pieces.length]);

  // ─── Reopen detection ───
  useEffect(() => {
    if (!planData) return;
    try {
      const savedRef = localStorage.getItem("subdivisionPlanRefNo");
      const reopenFlag = localStorage.getItem("subdivisionPlanReopen");
      if (reopenFlag === "true" && savedRef && savedRef !== "DRAFT") {
        setRefNo(savedRef);
        localStorage.removeItem("subdivisionPlanReopen");
        return;
      }
      if (savedRef && savedRef !== "DRAFT") {
        setRefNo(savedRef);
        return;
      }
      setRefNo("DRAFT");
    } catch {
      setRefNo("DRAFT");
    }
  }, [planData]);

  // ─── Fetch profile ───
  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser?.id) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("state, user_type, role")
          .eq("id", currentUser.id)
          .maybeSingle();
        if (data?.state) setUserState(data.state);
        setUserCategory(
          (data?.user_type || data?.role || "INDIVIDUAL USER").toUpperCase()
        );
      } catch (err) {
        console.error("[SUBDIV PROFILE]", err);
      }
    };
    fetchProfile();
  }, [currentUser]);

  const generateRefNo = useCallback(async (): Promise<string> => {
    try {
      const now = new Date();
      const fy =
        now.getMonth() + 1 >= 4
          ? `${String(now.getFullYear()).slice(-2)}-${String(
              now.getFullYear() + 1
            ).slice(-2)}`
          : `${String(now.getFullYear() - 1).slice(-2)}-${String(
              now.getFullYear()
            ).slice(-2)}`;
      const firstName = (currentUser?.full_name || "GUEST")
        .split(" ")[0]
        .toUpperCase();
      const { count } = await supabase
        .from("service_records")
        .select("*", { count: "exact", head: true })
        .eq("case_type", "SUBDIVISION_PLAN");
      const seq = (count || 0) + 1;
      return `LnT/${fy}/${firstName}/S${String(seq).padStart(3, "0")}`;
    } catch {
      return `LnT/24-25/GUEST/S001`;
    }
  }, [currentUser]);

  // ─── Destructure planData ───
  const {
    customerName = "N/A",
    propertyAddress = "N/A",
    plotArea = 0,
    boundaries = { north: "—", south: "—", east: "—", west: "—" },
    plotDimensions = null,
    dimDetails = null,
    roadFacingOption,
    measurementUnit = "FEET",
    roadWidthNorth = 15,
    roadWidthSouth = 15,
    roadWidthEast = 15,
    roadWidthWest = 15,
    subdivisionConfig = null,
  } = planData || {};

  const activeRoadFacing = roadFacingOption || "ROAD SIDE NOT SPECIFIED";

  const resolveDim = (k: "A" | "B" | "C" | "D"): number => {
    const p = plotDimensions?.[k];
    if (p !== undefined && Number(p) > 0) return Number(p);
    const d = dimDetails?.[k];
    if (d) {
      const t = Number(d.ft || 0) + Number(d.in || 0) / 12;
      if (t > 0) return t;
    }
    return 0;
  };

  const dimA = resolveDim("A") || 30;
  const dimB = resolveDim("B") || dimA;
  const dimC = resolveDim("C") || 50;
  const dimD = resolveDim("D") || dimC;
  const safePlotArea = Number(plotArea) > 0 ? Number(plotArea) : dimA * dimC;

  // Bigger drawing for small plots so the piece text and dimensions stay readable (never below the old 5.5)
  const canvasScale = Math.min(12, Math.max(5.5, Math.min(480 / dimA, 330 / dimC)));

  const selectedClientNameFromData = planData?.selectedClientName || "";
  const representativeFromData = planData?.representative || "";
  const plotShapeFromData = planData?.plotShape || "RECTANGLE";

  // ─── Payment ───
  const payment = PaymentGateway({
    refNo: refNo || "DRAFT",
    refNoGenerator: generateRefNo,
    caseType: "SUBDIVISION_PLAN",
    stateName: userState,
    pricingItem: "map",
    userCategory: userCategory,
    customerName,
    propertyAddress,
    clientName: selectedClientNameFromData,
    representative: representativeFromData,
    formSnapshot: {
      ...(planData || {}),
      customerName,
      propertyAddress,
      selectedClientName: selectedClientNameFromData,
      representative: representativeFromData,
      plotShape: plotShapeFromData,
      roadFacingOption: activeRoadFacing,
      plotArea: safePlotArea,
      plotDimensions: {
        ...(plotDimensions || {}),
        A: dimA,
        B: dimB,
        C: dimC,
        D: dimD,
        width: dimA,
        length: dimC,
        area: dimA * dimC,
      },
      dimDetails: dimDetails || {},
      boundaries: {
        north: boundaries.north || "",
        south: boundaries.south || "",
        east: boundaries.east || "",
        west: boundaries.west || "",
      },
      measurementUnit,
      pieces,
    },
    extraFields: {
      property_type: "LAND",
      deed_type: "SUBDIVISION_PLAN",
      plot_area: safePlotArea || null,
      plot_area_unit: measurementUnit,
      road_side: activeRoadFacing,
      plot_shape: plotShapeFromData,
      customer_name: customerName,
      property_address: propertyAddress,
      client_name: selectedClientNameFromData || null,
      representative: representativeFromData || null,
      boundary_east: boundaries.east || null,
      boundary_west: boundaries.west || null,
      boundary_north: boundaries.north || null,
      boundary_south: boundaries.south || null,
      subdivision_count: pieces.length,
      fee_mode: "Auto",
    },
    onPaymentSuccess: (paymentId, orderId, finalRefNo) => {
      if (finalRefNo) {
        setRefNo(finalRefNo);
        try {
          localStorage.setItem("subdivisionPlanRefNo", finalRefNo);
        } catch {}
      }
    },
    onPaymentError: (err) => console.error("[SUBDIV PAYMENT ERROR]", err),
  });

  const canPrint = payment.isPaid || payment.isAdminUser;

  // ─── Print protection ───
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
      if (ctrl && k === "p") {
        e.preventDefault();
        alert("🔒 Payment required to print.");
        return false;
      }
      if (ctrl && k === "s") {
        e.preventDefault();
        return false;
      }
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
    window.addEventListener("keydown", blockKeys, true);
    return () => window.removeEventListener("keydown", blockKeys, true);
  }, [canPrint]);

  // ─── PDF handlers ───
  const [pdfBusy, setPdfBusy] = useState<null | "print" | "download" | "share">(
    null
  );
  const pdfFileName = `Subdivision_Plan_${String(refNo || "DRAFT").replace(
    /[^A-Za-z0-9_-]+/g,
    "_"
  )}.pdf`;

  const handleDownloadPdf = useCallback(async () => {
    if (!canPrint || pdfBusy) return;
    try {
      setPdfBusy("download");
      const blob = await buildPlanPdf({ isMobile, title: pdfFileName });
      if (blob) downloadBlob(blob, pdfFileName);
    } catch (e) {
      console.error("[PDF]", e);
      alert("PDF error.");
    } finally {
      setPdfBusy(null);
    }
  }, [canPrint, pdfBusy, isMobile, pdfFileName]);

  const handlePrintClick = useCallback(async () => {
    if (payment.reuseChecking) return;
    if (!canPrint) {
      payment.handlePayment();
      return;
    }
    if (isMobile) {
      const w = window.open("", "_blank");
      try {
        setPdfBusy("print");
        const blob = await buildPlanPdf({ isMobile, title: pdfFileName });
        if (blob && w) w.location.href = URL.createObjectURL(blob);
        else if (blob) downloadBlob(blob, pdfFileName);
      } finally {
        setPdfBusy(null);
      }
      return;
    }
    setTimeout(() => window.print(), 200);
  }, [payment, canPrint, isMobile, pdfFileName]);

  // qrVerifyUrl — must be computed BEFORE the early return
  const qrVerifyUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/verify-estimate?ref=${encodeURIComponent(
      refNo || "PENDING"
    )}`;
  }, [refNo]);

  // ✅ EARLY RETURN
  if (loading) {
    return (
      <div className="p-10 text-center font-bold">
        LOADING SUBDIVISION PREVIEW...
      </div>
    );
  }

  // ✅ Non-hook calculations
  const totalPieces = pieces.length;
  const plotPieces = pieces.filter((p: any) => p.kind === "PLOT").length;
  const totalPieceArea = pieces.reduce(
    (s: number, p: any) => s + (p.area || 0),
    0
  );

  // TEMPLATE / MANUAL layouts need their own layout data from the input page.
  // If it did not arrive (old input page, cleared storage) there is nothing to draw or print.
  const layoutMode = planData?.subdivisionConfig?.mode;
  const layoutMissing = (layoutMode === "TEMPLATE" || layoutMode === "MANUAL") && pieces.length === 0;

  return (
    <div
      id="print-root"
      className="min-h-screen bg-white p-3 text-black uppercase font-sans print:p-0"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: A3 landscape; margin: 0; }
          body:not(.paid-user) #print-root, body:not(.paid-user) #print-root * { display: none !important; }
          body:not(.paid-user)::after {
            content: "🔒 PAYMENT REQUIRED TO PRINT";
            display: block !important; font-size: 28pt; font-weight: 900;
            text-align: center; color: #cc0000; padding: 80px;
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%); background: #fff;
            border: 4px dashed #cc0000; width: 80%;
          }
          html body #print-root { margin: 0 !important; padding: 0 !important; }
          button { display: none !important; }
        }
      `,
        }}
      />

      {screenshotBlocker && !canPrint && (
        <div className="fixed inset-0 z-[99999] bg-black flex items-center justify-center">
          <div className="text-white text-center">
            <div className="text-6xl mb-4">🔒</div>
            <div className="text-2xl font-black">SCREEN CAPTURE DETECTED</div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="max-w-[1600px] mx-auto flex flex-wrap justify-between items-center gap-2 bg-slate-800 text-white p-2.5 mb-2 rounded print:hidden">
        <button
          onClick={() => router.back()}
          className="bg-slate-700 px-3 py-1.5 text-xs font-bold rounded cursor-pointer"
        >
          ← BACK
        </button>
        <h1 className="text-xs font-black text-amber-400 order-last w-full text-center sm:order-none sm:w-auto">
          SUBDIVISION PLAN PREVIEW
        </h1>
        <button
          type="button"
          onClick={() => setCadOpen(true)}
          disabled={pieces.length === 0}
          className="bg-black border border-white/60 hover:bg-white hover:text-black px-3 py-1.5 text-xs font-bold rounded cursor-pointer disabled:opacity-40"
        >
          🖥 CAD VIEW
        </button>
        <button
          onClick={handlePrintClick}
          disabled={
            layoutMissing ||
            payment.reuseChecking ||
            payment.paymentLoading ||
            payment.pricingLoading
          }
          className={`px-4 py-1.5 text-xs font-bold rounded cursor-pointer ${
            canPrint
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {payment.reuseChecking
            ? "CHECKING..."
            : canPrint
            ? "🖨️ PRINT NOW"
            : `💳 PAY ₹${payment.price || 0} & PRINT`}
        </button>
      </div>

      {layoutMissing && (
        <div className="max-w-[1600px] mx-auto mb-2 p-3 border-2 border-red-600 bg-red-50 text-red-700 text-xs font-bold print:hidden">
          ⚠ NO {layoutMode} LAYOUT DATA WAS RECEIVED. GO BACK TO THE INPUT PAGE, BUILD THE LAYOUT AND PRESS
          “GENERATE SUBDIVISION PLAN” AGAIN. PRINTING IS DISABLED UNTIL THE LAYOUT IS AVAILABLE.
        </div>
      )}

      {payment.renderStatusMessage()}

      {canPrint && (
        <div className="max-w-[1600px] mx-auto flex gap-2 mb-2 print:hidden">
          <button
            onClick={handleDownloadPdf}
            disabled={!!pdfBusy}
            className="px-4 py-1.5 text-xs font-bold rounded text-white bg-emerald-600 cursor-pointer"
          >
            {pdfBusy === "download" ? "..." : "⬇️ DOWNLOAD PDF"}
          </button>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="max-w-[1600px] mx-auto bg-white border-2 border-black p-2.5 grid grid-cols-12 gap-3">
        {/* LEFT: CANVAS */}
        <div className="col-span-8 md:col-span-9 border-2 border-black p-1.5 flex flex-col bg-white">
          <div className="border-b border-black pb-1 mb-1 flex justify-between text-[11px] font-bold">
            <span>PROJECT: SUBDIVISION LAYOUT ({activeRoadFacing})</span>
            <span className="text-gray-600">SCALE: N.T.S.</span>
          </div>
          <div className="flex-1 w-full flex items-center justify-center bg-white">
            <svg
              viewBox={`-500 -400 1000 800`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-auto"
              style={{ aspectRatio: "1000 / 800" }}
            >
              <rect
                x="-500"
                y="-400"
                width="1000"
                height="800"
                fill="#ffffff"
              />
              <SubdivisionCanvas
                plotDimensions={{
                  ...(plotDimensions || {}),
                  A: dimA,
                  B: dimB,
                  C: dimC,
                  D: dimD,
                }}
                roadFacingOption={activeRoadFacing}
                boundaries={{
                  north: boundaries.north || "",
                  south: boundaries.south || "",
                  east: boundaries.east || "",
                  west: boundaries.west || "",
                }}
                measurementUnit={measurementUnit}
                roadWidthNorth={roadWidthNorth}
                roadWidthSouth={roadWidthSouth}
                roadWidthEast={roadWidthEast}
                roadWidthWest={roadWidthWest}
                pieces={pieces}
                scale={canvasScale}
              />
            </svg>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="col-span-4 md:col-span-3 border-2 border-black p-3 flex flex-col justify-between bg-white">
          <div>
            <div className="text-center font-black text-2xl border-b-2 border-black pb-1.5 mb-2">
              🏗️ LNT CONSULTANT
            </div>
            <div className="text-center text-xs font-bold text-gray-600 mb-1.5">
              SUBDIVISION PLAN
            </div>

            <div className="border border-black p-2 mb-2 bg-gray-50">
              <div className="font-bold text-xs border-b border-black pb-1 mb-1">
                REFERENCE
              </div>
              <div className="font-mono text-[10px] font-bold text-slate-800 break-all">
                {refNo || "DRAFT"}
              </div>
              <div className="text-[9px] text-gray-600 mt-1">
                DATE: {new Date().toLocaleDateString("en-IN")}
              </div>
            </div>

            <div className="border border-black p-2 mb-2 bg-gray-50">
              <div className="font-bold text-xs border-b border-black pb-1 mb-1">
                CUSTOMER DETAILS
              </div>
              <div className="break-words text-[11px]">
                <strong>NAME:</strong> {customerName}
              </div>
              <div className="break-words text-[11px] mt-0.5">
                <strong>ADDRESS:</strong> {propertyAddress}
              </div>
            </div>

            <div className="border border-black p-2 mb-2 bg-gray-50">
              <div className="font-bold text-xs border-b border-black pb-1 mb-1">
                PLOT DETAILS
              </div>
              <div className="flex justify-between text-[11px]">
                <span>PLOT AREA:</span>
                <span>{Number(safePlotArea).toFixed(2)} SQFT</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                <span>SIZE:</span>
                <span>
                  {dimA}' × {dimC}'
                </span>
              </div>
              {subdivisionConfig && (
                <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                  <span>MODE:</span>
                  <span>{subdivisionConfig.mode || "SIMPLE"}</span>
                </div>
              )}
            </div>

            <div className="border border-black p-2 mb-2 bg-gray-50">
              <div className="font-bold text-xs border-b border-black pb-1 mb-1">
                SUBDIVISION SUMMARY
              </div>
              <div className="flex justify-between text-[11px]">
                <span>TOTAL PIECES:</span>
                <span>{totalPieces}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>PLOTS:</span>
                <span>{plotPieces}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-600 mt-1 border-t pt-1">
                <span>ALLOCATED:</span>
                <span>{totalPieceArea.toFixed(2)} SQFT</span>
              </div>
            </div>

            <div className="border border-black p-2 mb-2 bg-gray-50">
              <div className="font-bold text-xs border-b border-black pb-1 mb-1">
                PIECES
              </div>
              <div className="max-h-[200px] overflow-auto space-y-1">
                {pieces.length === 0 && (
                  <div className="text-[10px] text-gray-500 italic">
                    No pieces generated.
                  </div>
                )}
                {pieces.map((p: any, i: number) => (
                  <div
                    key={i}
                    className="flex justify-between text-[10px] border-b pb-0.5"
                  >
                    <span className="font-bold">{p.label}</span>
                    <span>
                      {p.isRect
                        ? `${p.bbox.w.toFixed(1)}×${p.bbox.h.toFixed(1)}`
                        : "IRR."}{" "}
                      · {p.area.toFixed(0)} sqft
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t-2 border-black pt-2">
            {canPrint ? (
              <div className="flex flex-col items-center">
                <QRCodeSVG
                  value={qrVerifyUrl}
                  size={75}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
                <p className="text-[7px] mt-1 text-gray-500 font-bold">
                  SCAN TO VERIFY
                </p>
                <p className="text-[10px] font-bold mt-1">
                  AUTHORISED SIGNATORY
                </p>
              </div>
            ) : (
              <div className="border-2 border-dashed border-red-400 rounded p-3 text-center bg-red-50">
                <p className="text-[12px] text-red-700 font-black">
                  ⚠️ DRAFT COPY
                </p>
                <p className="text-[9px] text-red-600 font-bold mt-1">
                  PAY TO UNLOCK
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* FULL-SCREEN CAD VIEWER (zoom / pan; handy on mobile where the sheet is small) */}
      <CadViewModal
        open={cadOpen}
        onClose={() => setCadOpen(false)}
        title="CAD VIEW — SUBDIVISION LAYOUT"
        aspect={1000 / 800}
        status={`${pieces.filter((p: any) => p.kind === "PLOT").length} PLOTS · ${pieces.length} PIECES · ${activeRoadFacing}`}
      >
        <svg viewBox="-500 -400 1000 800" className="w-full h-auto" style={{ aspectRatio: "1000 / 800", display: "block" }}>
          <rect x="-500" y="-400" width="1000" height="800" fill="#ffffff" />
          <SubdivisionCanvas
            plotDimensions={{ ...(plotDimensions || {}), A: dimA, B: dimB, C: dimC, D: dimD }}
            roadFacingOption={activeRoadFacing}
            boundaries={{
              north: boundaries.north || "",
              south: boundaries.south || "",
              east: boundaries.east || "",
              west: boundaries.west || "",
            }}
            measurementUnit={measurementUnit}
            roadWidthNorth={roadWidthNorth}
            roadWidthSouth={roadWidthSouth}
            roadWidthEast={roadWidthEast}
            roadWidthWest={roadWidthWest}
            pieces={pieces}
            scale={canvasScale}
          />
        </svg>
      </CadViewModal>
    </div>
  );
}