// src/lib/service-records.ts

import { supabase } from "@/lib/supabase";
import { checkChangesNeedRepayment, isRefNoExpired } from "./stringSimilarity";

// ============================================================
// TYPES
// ============================================================
export interface ServiceRecordPayload {
  ref_no: string;
  user_id?: string | null;
  case_type: string;
  payment_status?: "pending" | "paid" | "failed";
  platform_payment_status?: "unpaid" | "paid" | "admin_bypass";

  // Payment
  user_payment?: number;
  gateway_fee?: number;
  user_service_fee?: number;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;

  // Customer
  client_name?: string | null;
  representative?: string | null;
  customer_name?: string | null;
  property_address?: string | null;

  // Location
  state_name?: string | null;
  city_district?: string | null;

  // Map specific
  plot_area?: number | null;
  plot_area_unit?: string | null;
  road_side?: string | null;
  plot_shape?: string | null;
  ground_coverage?: string | null;
  total_builtup_area?: number | null;
  floor_details?: any;

  // Boundaries
  boundary_east?: string | null;
  boundary_west?: string | null;
  boundary_north?: string | null;
  boundary_south?: string | null;

  // Meta
  form_snapshot?: any;
  fee_mode?: string;
  status?: string;

  // Extra fields (future use — optional)
  property_type?: string | null;
  deed_type?: string | null;
  output_language?: string | null;
  fee_standard?: number | null;
}

// ============================================================
// ✅ CREATE OR UPDATE — VIA RPC rpc_save_map_service
//    (Deed Drafting + Construction Plan — dono ke liye)
// ============================================================
export async function createOrUpdateServiceRecord(
  payload: ServiceRecordPayload
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("rpc_save_map_service", {
      p_ref_no: payload.ref_no,
      p_user_id: payload.user_id || null,
      p_case_type: payload.case_type,
      p_payment_status: payload.payment_status || "pending",
      p_platform_payment_status: payload.platform_payment_status || "unpaid",
      p_user_payment: payload.user_payment || 0,
      p_gateway_fee: payload.gateway_fee || 0,
      p_user_service_fee: payload.user_service_fee || 0,
      p_razorpay_order_id: payload.razorpay_order_id || null,
      p_razorpay_payment_id: payload.razorpay_payment_id || null,
      p_client_name: payload.client_name || null,
      p_representative: payload.representative || null,
      p_customer_name: payload.customer_name || null,
      p_property_address: payload.property_address || null,
      p_state_name: payload.state_name || null,
      p_city_district: payload.city_district || null,
      p_plot_area: payload.plot_area || null,
      p_plot_area_unit: payload.plot_area_unit || null,
      p_road_side: payload.road_side || null,
      p_plot_shape: payload.plot_shape || null,
      p_ground_coverage: payload.ground_coverage || null,
      p_total_builtup_area: payload.total_builtup_area || null,
      p_floor_details: payload.floor_details || null,
      p_boundary_east: payload.boundary_east || null,
      p_boundary_west: payload.boundary_west || null,
      p_boundary_north: payload.boundary_north || null,
      p_boundary_south: payload.boundary_south || null,
      p_form_snapshot: payload.form_snapshot || null,
      p_fee_mode: payload.fee_mode || "Auto",
      p_status: payload.status || "finalized",
    });

    if (error) throw error;

    // RPC returns TABLE(ref_no, operation)
    return { success: true, data: data?.[0] };
  } catch (err: any) {
    console.error("[RPC rpc_save_map_service ERROR]", err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// ✅ UPDATE PAYMENT STATUS
// ============================================================
export async function updatePaymentStatus(
  ref_no: string,
  updates: {
    payment_status?: string;
    platform_payment_status?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    user_payment?: number;
    gateway_fee?: number;
    user_service_fee?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const existing = await getServiceRecord(ref_no);
  if (!existing) {
    return { success: false, error: "Record not found" };
  }

  const result = await createOrUpdateServiceRecord({
    ref_no,
    user_id: existing.user_id,
    case_type: existing.case_type,
    payment_status: updates.payment_status || existing.payment_status,
    platform_payment_status:
      updates.platform_payment_status || existing.platform_payment_status,
    user_payment: updates.user_payment ?? existing.user_payment,
    gateway_fee: updates.gateway_fee ?? existing.gateway_fee,
    user_service_fee: updates.user_service_fee ?? existing.user_service_fee,
    razorpay_order_id:
      updates.razorpay_order_id || existing.razorpay_order_id,
    razorpay_payment_id:
      updates.razorpay_payment_id || existing.razorpay_payment_id,
    client_name: existing.client_name,
    representative: existing.representative,
    customer_name: existing.customer_name,
    property_address: existing.property_address,
    state_name: existing.state_name,
    city_district: existing.city_district,
    plot_area: existing.plot_area,
    plot_area_unit: existing.plot_area_unit,
    road_side: existing.road_side,
    plot_shape: existing.plot_shape,
    ground_coverage: existing.ground_coverage,
    total_builtup_area: existing.total_builtup_area,
    floor_details: existing.floor_details,
    boundary_east: existing.boundary_east,
    boundary_west: existing.boundary_west,
    boundary_north: existing.boundary_north,
    boundary_south: existing.boundary_south,
    form_snapshot: existing.form_snapshot,
    fee_mode: existing.fee_mode,
    status: existing.status,
  });

  return { success: result.success, error: result.error };
}

// ============================================================
// ✅ GET SERVICE RECORD
// ============================================================
export async function getServiceRecord(ref_no: string) {
  const { data, error } = await supabase
    .from("service_records")
    .select("*")
    .eq("ref_no", ref_no)
    .maybeSingle();

  if (error) {
    console.error("[GET SERVICE RECORD ERROR]", error);
    return null;
  }
  return data;
}

// ============================================================
// ✅ CHECK IF ALREADY PAID
// ============================================================
export async function isAlreadyPaid(ref_no: string): Promise<boolean> {
  const record = await getServiceRecord(ref_no);
  if (!record) return false;
  return (
    record.payment_status === "paid" ||
    record.platform_payment_status === "paid" ||
    record.platform_payment_status === "admin_bypass"
  );
}

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//   🆕 CONSTRUCTION PLAN SPECIFIC FUNCTIONS (NEW)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════

// ============================================================
// ✅ NEW-1: Fetch paid record by ref_no
// ============================================================
export async function fetchPaidRecordByRef(refNo: string) {
  if (!refNo) return null;
  const record = await getServiceRecord(refNo);
  if (!record) return null;
  const isPaid =
    record.payment_status === "paid" ||
    record.platform_payment_status === "paid";
  return isPaid ? record : null;
}

// ============================================================
// ✅ NEW-2: Check reprint status (Business Rules Engine)
//    Rules:
//      1. Minor changes (spelling, state) → Auto-update, No re-payment
//      2. Major changes (name, colony, plot) → Re-payment
//      3. 60+ days old → Re-payment + New ref_no
//      4. Admin override → Print allowed (user_id same rahega)
// ============================================================
export async function checkReprintStatus(
  refNo: string,
  currentData: {
    customer_name?: string;
    property_address?: string;
  },
  isAdminOverride: boolean = false
): Promise<{
  status:
    | 'NEW'
    | 'PAID_SAME'
    | 'PAID_MINOR_CHANGE'
    | 'PAID_MAJOR_CHANGE'
    | 'EXPIRED'
    | 'ADMIN_OVERRIDE';
  needsRepayment: boolean;
  canPrint: boolean;
  reason: string;
  existingRecord?: any;
  matchScore?: number;
  daysRemaining?: number;
}> {
  // No ref_no → Naya user, normal payment
  if (!refNo || refNo === 'DRAFT') {
    return {
      status: 'NEW',
      needsRepayment: true,
      canPrint: false,
      reason: 'New record — payment required',
    };
  }

  // Paid record check karo
  const existing = await fetchPaidRecordByRef(refNo);

  if (!existing) {
    return {
      status: 'NEW',
      needsRepayment: true,
      canPrint: false,
      reason: 'No paid record found — payment required',
    };
  }

  // 60-day validity check
  const expired = isRefNoExpired(existing.created_at, 60);
  const daysRemaining = Math.max(
    0,
    60 - Math.floor(
      (Date.now() - new Date(existing.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  // ✅ ADMIN OVERRIDE — Print karne do, user_id same rahega
  if (isAdminOverride) {
    return {
      status: 'ADMIN_OVERRIDE',
      needsRepayment: false,
      canPrint: true,
      reason: 'Admin override — print allowed (user data unchanged)',
      existingRecord: existing,
      daysRemaining,
    };
  }

  // ❌ Expired → Re-payment
  if (expired) {
    return {
      status: 'EXPIRED',
      needsRepayment: true,
      canPrint: false,
      reason: `60-day validity expired (${60 - daysRemaining} days ago) — re-payment required`,
      existingRecord: existing,
      daysRemaining: 0,
    };
  }

  // Similarity check
  const result = checkChangesNeedRepayment(
    existing.customer_name || '',
    currentData.customer_name || '',
    existing.property_address || '',
    currentData.property_address || ''
  );

  if (!result.needsRepayment) {
    return {
      status: 'PAID_MINOR_CHANGE',
      needsRepayment: false,
      canPrint: true,
      reason: `Minor changes only (Score: ${result.combinedScore}%) — auto-update allowed`,
      existingRecord: existing,
      matchScore: result.combinedScore,
      daysRemaining,
    };
  }

  return {
    status: 'PAID_MAJOR_CHANGE',
    needsRepayment: true,
    canPrint: false,
    reason: result.reason,
    existingRecord: existing,
    matchScore: result.combinedScore,
    daysRemaining,
  };
}

// ============================================================
// ✅ NEW-3: Auto-update existing paid record (minor changes)
//    Note: user_id, payment_status, ref_no SAME rahenge
// ============================================================
export async function autoUpdatePaidRecord(
  refNo: string,
  updates: Partial<ServiceRecordPayload>
): Promise<{ success: boolean; error?: string }> {
  const existing = await getServiceRecord(refNo);
  if (!existing) {
    return { success: false, error: 'Record not found' };
  }

  const result = await createOrUpdateServiceRecord({
    ref_no: refNo,
    user_id: existing.user_id,           // ✅ Same user_id
    case_type: existing.case_type,
    payment_status: existing.payment_status,           // ✅ 'paid' hi rahega
    platform_payment_status: existing.platform_payment_status,
    user_payment: existing.user_payment,
    gateway_fee: existing.gateway_fee,
    user_service_fee: existing.user_service_fee,
    razorpay_order_id: existing.razorpay_order_id,
    razorpay_payment_id: existing.razorpay_payment_id,

    // ✅ Updated fields (minor changes)
    customer_name: updates.customer_name ?? existing.customer_name,
    property_address: updates.property_address ?? existing.property_address,
    client_name: updates.client_name ?? existing.client_name,
    representative: updates.representative ?? existing.representative,
    state_name: updates.state_name ?? existing.state_name,
    city_district: updates.city_district ?? existing.city_district,
    plot_area: updates.plot_area ?? existing.plot_area,
    plot_shape: updates.plot_shape ?? existing.plot_shape,
    ground_coverage: updates.ground_coverage ?? existing.ground_coverage,
    total_builtup_area: updates.total_builtup_area ?? existing.total_builtup_area,
    floor_details: updates.floor_details ?? existing.floor_details,
    boundary_east: updates.boundary_east ?? existing.boundary_east,
    boundary_west: updates.boundary_west ?? existing.boundary_west,
    boundary_north: updates.boundary_north ?? existing.boundary_north,
    boundary_south: updates.boundary_south ?? existing.boundary_south,
    form_snapshot: updates.form_snapshot ?? existing.form_snapshot,
    fee_mode: existing.fee_mode,
    status: existing.status,
  });

  return { success: result.success, error: result.error };
}

// ============================================================
// ✅ NEW-4: Generate next ref_no (Global P count)
//    Format: LnT/{FY}/{FIRST_NAME}/P{SEQ}
//    Example: LnT/26-27/MADHUSMITA/P001
//             LnT/26-27/DIKSHA/P002 (global count)
// ============================================================
export async function generateNextRefNo(
  firstName: string,
  caseType: string = 'CONSTRUCTION_PLAN'
): Promise<string> {
  const now = new Date();
  const fy = (now.getMonth() + 1) >= 4
    ? `${String(now.getFullYear()).slice(-2)}-${String(now.getFullYear() + 1).slice(-2)}`
    : `${String(now.getFullYear() - 1).slice(-2)}-${String(now.getFullYear()).slice(-2)}`;

  const cleanName = (firstName || 'GUEST').split(' ')[0].toUpperCase();

  // Global count — sirf construction case records
  const { count, error } = await supabase
    .from('service_records')
    .select('*', { count: 'exact', head: true })
    .eq('case_type', caseType);

  if (error) {
    console.error('[generateNextRefNo] Count error:', error);
  }

  const seq = (count || 0) + 1;
  const formattedSeq = `P${String(seq).padStart(3, '0')}`;

  return `LnT/${fy}/${cleanName}/${formattedSeq}`;
}