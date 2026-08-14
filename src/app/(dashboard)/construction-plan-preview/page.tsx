"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateCompleteConstructionPlan } from "@/lib/constructionPlan/planGenerator";
import { generateCadVectorBlueprint } from "@/lib/constructionPlan/cad/cadRenderer";
import { calculateDoorsAndWindows } from "@/lib/constructionPlan/doorWindowRules";
import "./print.css";

type Point = { x: number; y: number };

type UserProfile = {
  id: string;
  full_name?: string | null;
  user_code?: string | null;
  role?: string | null;
  email?: string | null;
};

function financialYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4
    ? `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`
    : `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}

function normalizeUsername(profile?: UserProfile | null) {
  const raw = profile?.user_code || profile?.full_name || profile?.email?.split("@")[0] || "USER";
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (cleaned || "USER").slice(0, 12);
}

function polygonArea(points: Point[]) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

function pointsString(points: Point[]) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function bounds(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function fitPolygon(points: Point[], width = 520, height = 360, pad = 55) {
  if (!points.length) return { points: [], viewBox: `0 0 ${width} ${height}` };
  const b = bounds(points);
  const sourceW = Math.max(0.001, b.maxX - b.minX);
  const sourceH = Math.max(0.001, b.maxY - b.minY);
  const scale = Math.min((width - pad * 2) / sourceW, (height - pad * 2) / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const ox = (width - drawW) / 2;
  const oy = (height - drawH) / 2;
  return {
    points: points.map((p) => ({ x: ox + (p.x - b.minX) * scale, y: oy + (p.y - b.minY) * scale })),
    viewBox: `0 0 ${width} ${height}`,
  };
}

function extractRoadDirections(value: string) {
  const option = String(value || "").toUpperCase();
  const directions = ["NORTH", "SOUTH", "EAST", "WEST"] as const;
  const found = directions
    .map((direction) => ({ direction, index: option.indexOf(direction) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.direction);

  if (option.includes("4 SIDE")) return [...directions];
  if (option.includes("3 SIDE")) return found.slice(0, 3);
  if (option.includes("2 SIDE") || option.includes("CORNER")) return found.slice(0, 2);
  if (found.length) return [found[0]];
  return [];
}

function screenSideForCompass(main: string, direction: string) {
  const maps: Record<string, Record<string, "top" | "bottom" | "left" | "right">> = {
    NORTH: { NORTH: "bottom", SOUTH: "top", EAST: "right", WEST: "left" },
    SOUTH: { NORTH: "top", SOUTH: "bottom", EAST: "left", WEST: "right" },
    EAST: { NORTH: "right", SOUTH: "left", EAST: "bottom", WEST: "top" },
    WEST: { NORTH: "left", SOUTH: "right", EAST: "top", WEST: "bottom" },
  };
  return maps[main]?.[direction] || "bottom";
}

function northVector(main: string) {
  const side = screenSideForCompass(main, "NORTH");
  const vectors: Record<string, { dx: number; dy: number }> = {
    top: { dx: 0, dy: -1 },
    bottom: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 },
  };
  return vectors[side];
}

function formatArea(value: unknown) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function ConstructionPlanPreviewPage() {
  const router = useRouter();
  const [sheetData, setSheetData] = useState<any>(null);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [cadBlueprint, setCadBlueprint] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [refNo, setRefNo] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFloorModal, setSelectedFloorModal] = useState<string | null>(null);

  const loadRazorpay = useCallback(async () => {
    if ((window as any).Razorpay) return true;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Razorpay SDK failed to load.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Razorpay SDK failed to load."));
      document.body.appendChild(script);
    });
    return Boolean((window as any).Razorpay);
  }, []);

  useEffect(() => {
    const initialise = async () => {
      try {
        const raw = localStorage.getItem("construction_plan_preview_data");
        if (!raw) {
          router.push("/construction-plan");
          return;
        }

        const parsed = JSON.parse(raw);
        const selectedFloors = Array.isArray(parsed.selectedFloors) && parsed.selectedFloors.length
          ? parsed.selectedFloors
          : Array.isArray(parsed.selected_floors) && parsed.selected_floors.length
            ? parsed.selected_floors
            : ["GROUND FLOOR"];

        const normalized = {
          ...parsed,
          dimensions: parsed.plotDimensions || parsed.dimensions || { A: 20, B: 20, C: 40, D: 40, E: 0, F: 0 },
          plot_shape: parsed.plotShape || parsed.plot_shape || "RECTANGULAR",
          plot_area: Number(parsed.plotArea || parsed.plot_area || 0),
          road_side: parsed.roadFacingOption || parsed.road_side || "",
          coverage_type: parsed.coverageType || parsed.coverage_type || "100_PERCENT",
          setbacks: parsed.setbackInputs || parsed.setbacks || {},
          boundaries: parsed.boundaries || {},
          selected_floors: selectedFloors,
          floor_details: parsed.floorData || parsed.floor_details || {},
          room_details: parsed.floorRooms || parsed.room_details || {},
          total_builtup_area: Object.values(parsed.floorData || parsed.floor_details || {}).reduce(
            (sum: number, value: any) => sum + Number(value?.area || 0),
            0
          ),
          customer_name: parsed.customerName || parsed.customer_name || "",
          property_address: parsed.propertyAddress || parsed.property_address || "",
          client_name: parsed.selectedClientName || parsed.client_name || "",
          representative: parsed.representative || "",
          fee_amount: Number(parsed.feeAmount || 0),
          fee_mode: parsed.feeMode || "AUTO",
        };

        const completePlan = generateCompleteConstructionPlan(normalized);
        const blueprint = generateCadVectorBlueprint(
          normalized.dimensions,
          completePlan.footprint,
          normalized.floor_details,
          normalized.room_details,
          selectedFloors,
          normalized.road_side
        );

        setSheetData(normalized);
        setGeneratedPlan(completePlan);
        setCadBlueprint(blueprint);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("id, full_name, user_code, role, email")
            .eq("id", user.id)
            .maybeSingle();
          const nextProfile = (userProfile || { id: user.id, email: user.email }) as UserProfile;
          setProfile(nextProfile);
          setIsAdmin(String(nextProfile.role || "").toLowerCase() === "admin");

          const savedPayment = localStorage.getItem("construction_plan_payment_status");
          const savedRef = localStorage.getItem("construction_plan_ref_no");
          if (savedRef) {
            setRefNo(savedRef);
            setIsPaid(savedPayment === "paid");
          } else {
            const fy = financialYear();
            const username = normalizeUsername(nextProfile);
            const prefix = `${fy}/${username}/P`;
            const { data: existingRefs } = await supabase
              .from("estimates")
              .select("ref_no")
              .ilike("ref_no", `${prefix}%`)
              .limit(500);

            let maxSeq = 0;
            (existingRefs || []).forEach((row: any) => {
              const match = String(row.ref_no || "").match(/\/P(\d+)$/i);
              if (match) maxSeq = Math.max(maxSeq, Number(match[1]) || 0);
            });
            const nextRef = `${prefix}${String(maxSeq + 1).padStart(6, "0")}`;
            setRefNo(nextRef);
            localStorage.setItem("construction_plan_ref_no", nextRef);
          }
        }
      } catch (err: any) {
        console.error("Construction plan preview error:", err);
        setError(err?.message || "Unable to generate construction plan.");
      }
    };

    initialise();
  }, [router]);

  const floors = useMemo(() => {
    if (!sheetData) return ["GROUND FLOOR"];
    return sheetData.selected_floors || ["GROUND FLOOR"];
  }, [sheetData]);

  const floorDetails = sheetData?.floor_details || {};
  const roomDetails = sheetData?.room_details || {};
  const totalBuiltUp = floors.reduce((sum: number, floor: string) => sum + Number(floorDetails?.[floor]?.area || 0), 0);
  const residentialFloors = floors.filter((floor: string) => floor !== "BASEMENT" && floor !== "TOWER");
  const hasTower = floors.includes("TOWER");
  const doorWindowSpecs = calculateDoorsAndWindows(totalBuiltUp, residentialFloors.length, hasTower);
  const plotPolygon = generatedPlan?.plotGeometry?.vertices || [];
  const buildablePolygon = generatedPlan?.buildableGeometry?.buildablePolygon || [];
  const roads = extractRoadDirections(sheetData?.road_side || "");
  const mainRoad = roads[0] || "SOUTH";
  const plotFit = fitPolygon(plotPolygon);
  const plotArea = Number(generatedPlan?.plotArea || polygonArea(plotPolygon));
  const buildableArea = Number(generatedPlan?.buildableGeometry?.buildableArea || 0);
  const paymentAmount = Math.max(0, Number(sheetData?.fee_amount || 0));
  const effectivePayment = paymentAmount > 0 ? paymentAmount : 21;

  const saveConstructionPlanRecord = async (paymentData?: { paymentId?: string; orderId?: string }) => {
    if (!profile?.id || !refNo) return;

    const snapshot = {
      ...sheetData,
      ref_no: refNo,
      generated_plot_geometry: generatedPlan?.plotGeometry,
      generated_buildable_geometry: generatedPlan?.buildableGeometry,
      generated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("estimates")
      .select("id")
      .eq("ref_no", refNo)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await supabase.from("estimates").insert([{
        ref_no: refNo,
        user_id: profile.id,
        customer_name: sheetData.customer_name || "GUEST",
        client_name: sheetData.client_name || "",
        representative: sheetData.representative || "",
        property_address: sheetData.property_address || "",
        plot_area: plotArea,
        total_builtup_area: totalBuiltUp,
        construction_cost: 0,
        estimate_type: "CONSTRUCTION PLAN",
        plan_type: "CONSTRUCTION PLAN",
        estimate_snapshot: snapshot,
        payment_status: paymentData?.paymentId ? "paid" : "pending",
        platform_payment_status: paymentData?.paymentId ? "paid" : "pending",
        razorpay_payment_id: paymentData?.paymentId || null,
      }]);

      if (insertError) throw insertError;
    } else if (paymentData?.paymentId) {
      const { error: updateError } = await supabase
        .from("estimates")
        .update({
          payment_status: "paid",
          platform_payment_status: "paid",
          razorpay_payment_id: paymentData.paymentId,
        })
        .eq("ref_no", refNo);
      if (updateError) throw updateError;
    }
  };

  const handlePayment = async () => {
    if (isAdmin) {
      setIsPaid(true);
      localStorage.setItem("construction_plan_payment_status", "paid");
      await saveConstructionPlanRecord();
      window.print();
      return;
    }

    if (isPaid || paymentBusy) return;

    setPaymentBusy(true);
    try {
      await saveConstructionPlanRecord();
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Razorpay checkout could not be loaded.");

      const orderResponse = await fetch("/api/analyze/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: effectivePayment, receipt: refNo }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok || !orderData.id) {
        throw new Error(orderData?.error || "Unable to create payment order.");
      }

      const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!key) throw new Error("NEXT_PUBLIC_RAZORPAY_KEY_ID is not configured.");

      const razorpay = new (window as any).Razorpay({
        key,
        amount: orderData.amount,
        currency: "INR",
        name: "Construction Estimate Software",
        description: `Construction Plan — ${refNo}`,
        order_id: orderData.id,
        prefill: {
          name: profile?.full_name || sheetData?.customer_name || "",
          email: profile?.email || "",
        },
        notes: { reference_no: refNo, case_type: "CONSTRUCTION PLAN" },
        theme: { color: "#111827" },
        handler: async (response: any) => {
          try {
            await saveConstructionPlanRecord({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
            });
            setIsPaid(true);
            localStorage.setItem("construction_plan_payment_status", "paid");
            localStorage.setItem("construction_plan_ref_no", refNo);
            alert(`Payment successful. Reference No: ${refNo}`);
            setTimeout(() => window.print(), 300);
          } catch (saveError: any) {
            alert(`Payment received, but plan save failed: ${saveError?.message || "Unknown error"}. Please contact admin before closing this page.`);
          } finally {
            setPaymentBusy(false);
          }
        },
        modal: {
          ondismiss: () => setPaymentBusy(false),
        },
      });

      razorpay.open();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Payment initialization failed.");
      setPaymentBusy(false);
    }
  };

  const renderDimensionLabels = (points: Point[]) => {
    if (points.length < 2) return null;
    return points.map((a, index) => {
      const b = points[(index + 1) % points.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.01) return null;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const nx = -dy / length;
      const ny = dx / length;
      const offset = 16;
      const label = `${length.toFixed(2)}'`;
      return (
        <g key={`dimension-${index}`}>
          <line x1={a.x + nx * 5} y1={a.y + ny * 5} x2={b.x + nx * 5} y2={b.y + ny * 5} stroke="#111" strokeWidth="0.8" />
          <text x={mx + nx * offset} y={my + ny * offset} textAnchor="middle" fontSize="8" fontWeight="800" transform={`rotate(${Math.atan2(dy, dx) * 180 / Math.PI} ${mx + nx * offset} ${my + ny * offset})`}>{label}</text>
        </g>
      );
    });
  };

  const renderSitePlan = () => {
    const fittedPlot = plotFit.points;
    if (!fittedPlot.length) return <div className="h-full flex items-center justify-center font-bold">NO PLOT GEOMETRY</div>;
    const fittedBuildable = fitPolygon(buildablePolygon, 520, 360, 55).points;
    const width = 520;
    const height = 360;
    const center = { x: width / 2, y: height / 2 };
    const arrow = northVector(mainRoad);
    const roadThickness = 30;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full bg-white">
        <defs>
          <pattern id="siteHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="#ef4444" strokeWidth="1" opacity="0.55" />
          </pattern>
          <marker id="northArrowHead" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#111" />
          </marker>
        </defs>

        {roads.map((direction: string) => {
          const side = screenSideForCompass(mainRoad, direction);
          if (side === "bottom") return <rect key={direction} x="30" y={height - roadThickness} width={width - 60} height={roadThickness} fill="#e5e7eb" stroke="#111" strokeWidth="1" />;
          if (side === "top") return <rect key={direction} x="30" y="0" width={width - 60} height={roadThickness} fill="#e5e7eb" stroke="#111" strokeWidth="1" />;
          if (side === "left") return <rect key={direction} x="0" y="30" width={roadThickness} height={height - 60} fill="#e5e7eb" stroke="#111" strokeWidth="1" />;
          return <rect key={direction} x={width - roadThickness} y="30" width={roadThickness} height={height - 60} fill="#e5e7eb" stroke="#111" strokeWidth="1" />;
        })}

        {roads.map((direction: string) => {
          const side = screenSideForCompass(mainRoad, direction);
          if (side === "bottom") return <text key={`road-${direction}`} x={width / 2} y={height - 10} textAnchor="middle" fontSize="9" fontWeight="900">ROAD — {direction}</text>;
          if (side === "top") return <text key={`road-${direction}`} x={width / 2} y="20" textAnchor="middle" fontSize="9" fontWeight="900">ROAD — {direction}</text>;
          if (side === "left") return <text key={`road-${direction}`} x="12" y={height / 2} textAnchor="middle" fontSize="9" fontWeight="900" transform={`rotate(-90 12 ${height / 2})`}>ROAD — {direction}</text>;
          return <text key={`road-${direction}`} x={width - 12} y={height / 2} textAnchor="middle" fontSize="9" fontWeight="900" transform={`rotate(90 ${width - 12} ${height / 2})`}>ROAD — {direction}</text>;
        })}

        <polygon points={pointsString(fittedPlot)} fill="white" stroke="#d4a500" strokeWidth="4" />
        {fittedBuildable.length > 2 && <polygon points={pointsString(fittedBuildable)} fill="url(#siteHatch)" stroke="#dc2626" strokeWidth="2.5" />}
        {renderDimensionLabels(fittedPlot)}

        <line x1={center.x} y1={center.y} x2={center.x + arrow.dx * 70} y2={center.y + arrow.dy * 70} stroke="#111" strokeWidth="2" markerEnd="url(#northArrowHead)" />
        <text x={center.x + arrow.dx * 85} y={center.y + arrow.dy * 85} textAnchor="middle" fontSize="11" fontWeight="900">N</text>

        <text x={center.x} y={center.y + 4} textAnchor="middle" fontSize="11" fontWeight="900">PROPOSED SITE</text>
        <text x={center.x} y={height - 45} textAnchor="middle" fontSize="8" fontWeight="700">YELLOW = PLOT / RED = BUILDABLE</text>
      </svg>
    );
  };

  const renderFloorPlan = (floorName: string, modal = false) => {
    if (!cadBlueprint) return null;
    const rooms = cadBlueprint.getRoomsForFloor(floorName);
    const heightClass = modal ? "h-[650px]" : "h-[280px]";
    return (
      <svg viewBox={cadBlueprint.viewBox} className={`w-full ${heightClass} bg-white`}>
        <rect x="20" y="20" width={cadBlueprint.plotWidth} height={cadBlueprint.plotDepth} fill="white" stroke="black" strokeWidth={cadBlueprint.externalWallThickness || 2} />
        {rooms.map((room: any, index: number) => room.isOpen ? null : (
          <g key={`${floorName}-${room.key}-${index}`}>
            <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="white" stroke="black" strokeWidth={room.wallThickness || cadBlueprint.internalWallThickness || 1} />
            {room.isStairs ? (
              <>
                <text x={room.x + room.w / 2} y={room.y + 15} textAnchor="middle" fontSize="8" fontWeight="900">STAIR UP</text>
                {Array.from({ length: 8 }).map((_, step) => {
                  const y = room.y + 25 + (step * Math.max(8, room.h - 40)) / 7;
                  return <line key={step} x1={room.x + 5} y1={y} x2={room.x + room.w - 5} y2={y} stroke="black" strokeWidth="0.8" />;
                })}
              </>
            ) : room.isParking ? (
              <text x={room.x + room.w / 2} y={room.y + room.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="900">PARKING</text>
            ) : (
              <>
                <text x={room.x + room.w / 2} y={room.y + room.h / 2 - 4} textAnchor="middle" dominantBaseline="middle" fontSize={modal ? 9 : 6} fontWeight="900">{room.name}</text>
                <text x={room.x + room.w / 2} y={room.y + room.h / 2 + 7} textAnchor="middle" dominantBaseline="middle" fontSize={modal ? 7 : 5} fontWeight="700">{room.area} SQ.FT</text>
              </>
            )}
          </g>
        ))}
        <text x={cadBlueprint.plotWidth / 2 + 20} y="12" textAnchor="middle" fontSize="8" fontWeight="900">N ↑</text>
      </svg>
    );
  };

  const renderElevation = () => {
    const count = Math.max(1, floors.length);
    const h = 190 + count * 35;
    return (
      <svg viewBox={`0 0 360 ${h}`} className="w-full h-[280px] bg-white">
        <line x1="30" y1={h - 20} x2="330" y2={h - 20} stroke="black" strokeWidth="2" />
        <rect x="85" y="45" width="190" height={h - 65} fill="white" stroke="black" strokeWidth="2" />
        {Array.from({ length: count }).map((_, i) => {
          const y = 45 + i * ((h - 65) / count);
          const floor = floors[i] || `FLOOR ${i + 1}`;
          return (
            <g key={floor}>
              {i > 0 && <line x1="85" y1={y} x2="275" y2={y} stroke="black" strokeWidth="1.3" />}
              <text x="180" y={y + 18} textAnchor="middle" fontSize="7" fontWeight="900">{floor}</text>
              <rect x="105" y={y + 25} width="42" height="35" fill="white" stroke="black" strokeWidth="1" />
              <rect x="213" y={y + 25} width="42" height="35" fill="white" stroke="black" strokeWidth="1" />
            </g>
          );
        })}
        <rect x="165" y={h - 80} width="30" height="60" fill="white" stroke="black" strokeWidth="1.2" />
        <text x="180" y={h - 4} textAnchor="middle" fontSize="9" fontWeight="900">FRONT ELEVATION</text>
        <text x="180" y="22" textAnchor="middle" fontSize="8" fontWeight="900">PROPOSED RESIDENTIAL BUILDING</text>
      </svg>
    );
  };

  const renderSection = () => {
    const count = Math.max(1, floors.length);
    const h = 190 + count * 35;
    return (
      <svg viewBox={`0 0 360 ${h}`} className="w-full h-[280px] bg-white">
        <line x1="30" y1={h - 20} x2="330" y2={h - 20} stroke="black" strokeWidth="2" />
        <rect x="85" y="45" width="190" height={h - 65} fill="white" stroke="black" strokeWidth="2" />
        {Array.from({ length: count + 1 }).map((_, i) => {
          const y = 45 + i * ((h - 65) / count);
          return <line key={i} x1="85" y1={Math.min(y, h - 20)} x2="275" y2={Math.min(y, h - 20)} stroke="black" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "4 3"} />;
        })}
        {Array.from({ length: count }).map((_, i) => {
          const y = 62 + i * ((h - 65) / count);
          return <text key={i} x="180" y={y} textAnchor="middle" fontSize="7" fontWeight="800">{floors[i] || `FLOOR ${i + 1}`} SLAB</text>;
        })}
        <text x="180" y={h - 4} textAnchor="middle" fontSize="9" fontWeight="900">SECTION X-X</text>
      </svg>
    );
  };

  const boundaries = sheetData?.boundaries || {};
  const disclaimer = "PLAN IS PREPARED AT THE REQUEST OF CUSTOMER FOR HIS INTERNAL USE ONLY. NOT FOR APPROVAL FROM AUTHORITY.";

  if (error) {
    return <div className="min-h-screen flex items-center justify-center p-6"><div className="border-2 border-black p-6 max-w-xl text-center"><h2 className="font-black text-red-600 mb-3">RENDER ERROR</h2><p className="font-bold text-sm mb-4">{error}</p><button onClick={() => router.push("/construction-plan")} className="bg-black text-white px-5 py-2 font-black">BACK TO EDITOR</button></div></div>;
  }

  if (!sheetData || !generatedPlan || !cadBlueprint) {
    return <div className="min-h-screen flex items-center justify-center font-black text-xs tracking-widest">GENERATING ARCHITECTURAL DRAWING...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-200 p-4 text-black">
      <div className="print-hide w-full max-w-[1600px] mx-auto mb-4 bg-white border-2 border-black p-3 flex flex-wrap gap-3 items-center justify-between shadow-md">
        <div>
          <div className="font-black text-sm">CONSTRUCTION PLAN PRINT PREVIEW</div>
          <div className="font-bold text-[10px]">REF NO: {refNo || "GENERATING..."}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => router.push("/construction-plan")} className="border border-black px-4 py-2 text-xs font-black bg-white">← EDIT PLAN</button>
          {!isPaid && !isAdmin && (
            <button onClick={handlePayment} disabled={paymentBusy} className="bg-black text-white px-5 py-2 text-xs font-black disabled:opacity-50">
              {paymentBusy ? "PROCESSING..." : `PAY ₹${effectivePayment.toFixed(2)} & PRINT / DOWNLOAD`}
            </button>
          )}
          {(isPaid || isAdmin) && (
            <button onClick={() => window.print()} className="bg-emerald-700 text-white px-5 py-2 text-xs font-black">PRINT / SAVE PDF</button>
          )}
        </div>
      </div>

      <main className="construction-print-sheet mx-auto bg-white border-2 border-black shadow-2xl w-[1600px] min-h-[1100px] uppercase">
        <header className="border-b-2 border-black p-4 grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <div className="text-center font-black text-xl tracking-wide">PROPOSED RESIDENTIAL BUILDING ON {floors.join(" + ")}</div>
            <div className="text-center font-bold text-[10px] mt-2">CONSTRUCTION PLAN / SITE & FLOOR LAYOUT</div>
          </div>
          <div className="col-span-4 border-l-2 border-black pl-4 text-[10px] font-bold space-y-1">
            <div><b>REF NO:</b> {refNo}</div>
            <div><b>DATE:</b> {new Date().toLocaleDateString("en-IN")}</div>
            <div><b>USER:</b> {normalizeUsername(profile)}</div>
          </div>
        </header>

        <div className="grid grid-cols-10 min-h-[930px]">
          <section className="col-span-7 border-r-2 border-black p-4">
            <div className="grid grid-cols-2 gap-4">
              {floors.map((floor: string) => (
                <div key={floor} className="border border-black bg-white">
                  {renderFloorPlan(floor)}
                  <div className="border-t border-black text-center py-1 text-[9px] font-black">{floor} — {formatArea(floorDetails?.[floor]?.area)} SQ.FT BUILT-UP</div>
                </div>
              ))}

              <div className="border border-black bg-white">
                {renderElevation()}
                <div className="border-t border-black text-center py-1 text-[9px] font-black">FRONT ELEVATION</div>
              </div>

              <div className="border border-black bg-white">
                {renderSection()}
                <div className="border-t border-black text-center py-1 text-[9px] font-black">SECTION X-X</div>
              </div>

              <div className="border border-black bg-white col-span-2">
                <div className="h-[430px]">{renderSitePlan()}</div>
                <div className="border-t border-black text-center py-1 text-[10px] font-black">SITE PLAN</div>
              </div>
            </div>
          </section>

          <aside className="col-span-3 p-4 bg-slate-50">
            <div className="border-2 border-black bg-white text-center p-2 font-black text-sm">AREA STATEMENT</div>

            <div className="border border-black bg-white mt-3 text-[10px]">
              <div className="p-2 border-b border-black"><b>CUSTOMER NAME:</b><br />{sheetData.customer_name || "N/A"}</div>
              <div className="p-2"><b>PROPERTY ADDRESS:</b><br />{sheetData.property_address || "N/A"}</div>
            </div>

            <div className="border border-black bg-white mt-3 p-2 text-[10px] space-y-1">
              <div className="font-black border-b border-black pb-1 mb-1">PLOT DETAILS</div>
              <div className="flex justify-between"><span>PLOT AREA</span><b>{formatArea(plotArea)} SQ.FT</b></div>
              <div className="flex justify-between"><span>BUILT-UP AREA</span><b>{formatArea(buildableArea)} SQ.FT</b></div>
              <div className="flex justify-between"><span>TOTAL BUILT-UP</span><b>{formatArea(totalBuiltUp)} SQ.FT</b></div>
              <div className="flex justify-between"><span>SHAPE</span><b>{sheetData.plot_shape}</b></div>
              <div className="flex justify-between"><span>ROAD</span><b>{sheetData.road_side || "N/A"}</b></div>
            </div>

            <div className="border border-black bg-white mt-3 p-2 text-[10px]">
              <div className="font-black border-b border-black pb-1 mb-1">FLOOR-WISE AREA</div>
              {floors.map((floor: string) => <div key={floor} className="flex justify-between"><span>{floor}</span><b>{formatArea(floorDetails?.[floor]?.area)}</b></div>)}
              <div className="flex justify-between border-t border-black mt-1 pt-1 font-black"><span>TOTAL</span><span>{formatArea(totalBuiltUp)}</span></div>
            </div>

            <div className="border border-black bg-white mt-3 p-2 text-[10px]">
              <div className="font-black border-b border-black pb-1 mb-1">BOUNDARY / ROAD</div>
              <div>NORTH: {boundaries.north || "N/A"}</div>
              <div>SOUTH: {boundaries.south || "N/A"}</div>
              <div>EAST: {boundaries.east || "N/A"}</div>
              <div>WEST: {boundaries.west || "N/A"}</div>
            </div>

            <div className="border border-black bg-white mt-3 p-2 text-[10px]">
              <div className="font-black border-b border-black pb-1 mb-1">MOS / SETBACK</div>
              <div className="flex justify-between"><span>FRONT</span><b>{Number(sheetData.setbacks?.front || 0)}'</b></div>
              <div className="flex justify-between"><span>REAR</span><b>{Number(sheetData.setbacks?.rear || 0)}'</b></div>
              <div className="flex justify-between"><span>LEFT</span><b>{Number(sheetData.setbacks?.left || 0)}'</b></div>
              <div className="flex justify-between"><span>RIGHT</span><b>{Number(sheetData.setbacks?.right || 0)}'</b></div>
            </div>

            <div className="border border-black bg-white mt-3 p-2 text-[10px]">
              <div className="font-black border-b border-black pb-1 mb-1">ENGINE SPECIFICATIONS</div>
              <div className="flex justify-between"><span>MAIN DOORS</span><b>{doorWindowSpecs.mainDoors}</b></div>
              <div className="flex justify-between"><span>INTERNAL DOORS</span><b>{doorWindowSpecs.internalDoors}</b></div>
              <div className="flex justify-between"><span>BATHROOM DOORS</span><b>{doorWindowSpecs.bathroomDoors}</b></div>
              <div className="flex justify-between"><span>WINDOWS</span><b>{doorWindowSpecs.windows}</b></div>
              <div className="flex justify-between"><span>VENTILATORS</span><b>{doorWindowSpecs.ventilators}</b></div>
            </div>

            <div className="border border-black bg-white mt-3 p-2 text-[9px] leading-4">
              <div className="font-black">WALL SPECIFICATION</div>
              <div>EXTERNAL WALL: 8 INCH</div>
              <div>INTERNAL PARTITION: 4 INCH</div>
              <div>STAIR: 3.5 FT NOMINAL WIDTH</div>
            </div>

            <div className="border-2 border-black bg-white mt-4 p-2 text-[8px] leading-3">
              {disclaimer}
            </div>

            <div className="border border-black bg-white mt-4 p-2 text-[9px]">
              <div className="font-black">REFERENCE</div>
              <div className="font-mono font-bold mt-1">{refNo}</div>
            </div>
          </aside>
        </div>

        <footer className="border-t-2 border-black p-2 text-[8px] flex justify-between font-bold">
          <span>CONSTRUCTION PLAN — INTERNAL PRELIMINARY DRAWING</span>
          <span>REF: {refNo}</span>
          <span>NOT FOR STATUTORY APPROVAL</span>
        </footer>
      </main>

      {selectedFloorModal && (
        <div className="print-hide fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black w-full max-w-6xl p-4">
            <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
              <h3 className="font-black text-sm">{selectedFloorModal} — FLOOR PLAN</h3>
              <button onClick={() => setSelectedFloorModal(null)} className="bg-black text-white px-4 py-2 text-xs font-black">CLOSE</button>
            </div>
            {renderFloorPlan(selectedFloorModal, true)}
          </div>
        </div>
      )}
    </div>
  );
}
