// src/lib/service-records.ts

import { supabase } from "@/lib/supabase";

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