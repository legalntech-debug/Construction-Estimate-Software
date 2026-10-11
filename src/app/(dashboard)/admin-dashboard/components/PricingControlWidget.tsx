'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Save, X, Check, AlertCircle, Clock, RefreshCw } from 'lucide-react';

interface PricingRow {
  id: string;
  case_type: string;
  state_name: string;
  user_category: string | null;
  mrp: number;
  price: number;
  discount_enabled: boolean;
  discount_percent: number | null;
  active: boolean;
  updated_at: string;
}

interface ChangeRequest {
  id: string;
  config_id: string;
  requested_by: string;
  requested_by_role: string;
  requested_at: string;
  old_values: any;
  new_values: any;
  change_summary: string;
  status: string;
  requester_name?: string;
  case_type?: string;
  state_name?: string;
}

function normalizeRole(role?: string | null): string {
  return (role || '').toUpperCase().replace(/[-\s]+/g, '_');
}

function getUserRoles(profile: any): string[] {
  const roles: string[] = [];
  if (profile?.role) roles.push(normalizeRole(profile.role));
  if (profile?.second_role) roles.push(normalizeRole(profile.second_role));
  return Array.from(new Set(roles));
}

const APPROVER_ROLES = ['ADMIN', 'SUPER_ADMIN'];
const EDITOR_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CEO', 'CO_PARTNER', 'CO_OWNER', 'MARKETING_SUPPORT', 'MARKETING_HEAD', 'INVESTOR'];

function canEditPricing(profile: any): boolean {
  return getUserRoles(profile).some((r) => EDITOR_ROLES.includes(r));
}

function canApprovePricing(profile: any): boolean {
  return getUserRoles(profile).some((r) => APPROVER_ROLES.includes(r));
}

// ═══════════════════════════════════════════════════════════
// AUTO-SYNC HELPERS
// ═══════════════════════════════════════════════════════════
const roundTwo = (n: number) => Math.round(n * 100) / 100;

const syncPercentFromPrice = (mrp: number, price: number): number | null => {
  if (!mrp || mrp <= 0 || price >= mrp) return null;
  return roundTwo(((mrp - price) / mrp) * 100);
};

const syncPriceFromPercent = (mrp: number, pct: number | null): number => {
  if (pct === null || pct <= 0 || !mrp || mrp <= 0) return mrp;
  return Math.round(mrp - (mrp * pct) / 100);
};

export default function PricingControlWidget() {
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);

  // ✅ Column-wise inline filters (Case Type + State dropdowns)
  const [colFilters, setColFilters] = useState({
    caseType: '',   // exact value from dropdown
    state: '',      // exact value from dropdown
    mrp: '',
    price: '',
    discount: '',
    pct: '',
    status: '',
  });

  const [editingRow, setEditingRow] = useState<PricingRow | null>(null);
  const [editForm, setEditForm] = useState({
    mrp: 0,
    price: 0,
    discount_enabled: true,
    discount_percent: null as number | null,
  });
  const [saving, setSaving] = useState(false);

  const [approvingReq, setApprovingReq] = useState<ChangeRequest | null>(null);
  const [adminEditedValues, setAdminEditedValues] = useState<any>({});
  const [adminNote, setAdminNote] = useState('');

  const canEdit = canEditPricing(currentUser);
  const canApprove = canApprovePricing(currentUser);

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('pricing_config')
      .select('*')
      .order('case_type', { ascending: true })
      .order('state_name', { ascending: true });
    if (!error) setRows(data || []);
    return data || [];
  }, []);

  const fetchPendingRequests = useCallback(async () => {
    if (!canApprove) return;
    const { data, error } = await supabase
      .from('pricing_change_requests')
      .select('*')
      .eq('status', 'PENDING')
      .order('requested_at', { ascending: false });

    if (error || !data) return;

    const userIds = Array.from(new Set(data.map((r: any) => r.requested_by).filter(Boolean)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', userIds);

    const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

    const configIds = Array.from(new Set(data.map((r: any) => r.config_id).filter(Boolean)));
    const { data: configs } = await supabase
      .from('pricing_config')
      .select('id, case_type, state_name')
      .in('id', configIds);
    const cfgMap = new Map((configs || []).map((c: any) => [c.id, c]));

    setPendingRequests(
      data.map((r: any) => {
        const cfg: any = cfgMap.get(r.config_id) || {};
        return {
          ...r,
          requester_name: nameMap.get(r.requested_by) || 'Unknown',
          case_type: cfg.case_type || '—',
          state_name: cfg.state_name || '—',
        };
      })
    );
  }, [canApprove]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (canEdit) {
        await fetchRows();
        await fetchPendingRequests();
      }
      setLoading(false);
    })();
  }, [canEdit, fetchRows, fetchPendingRequests]);

  // ✅ Unique case types & states for dropdowns
  const uniqueCaseTypes = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.case_type).filter(Boolean))).sort();
  }, [rows]);

  const uniqueStates = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.state_name).filter(Boolean))).sort();
  }, [rows]);

  // ═══════════════════════════════════════════════════════════
  // Filtered rows
  // ═══════════════════════════════════════════════════════════
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const f = colFilters;

      if (f.caseType && r.case_type !== f.caseType) return false;
      if (f.state && r.state_name !== f.state) return false;

      if (f.mrp) {
        const q = f.mrp.replace(/[^0-9.-]/g, '');
        if (!String(Number(r.mrp)).includes(q)) return false;
      }
      if (f.price) {
        const q = f.price.replace(/[^0-9.-]/g, '');
        if (!String(Number(r.price)).includes(q)) return false;
      }
      if (f.discount) {
        const isOn = r.discount_enabled ? 'on' : 'off';
        if (f.discount.toLowerCase() !== isOn) return false;
      }
      if (f.pct) {
        const pct = r.discount_enabled && r.mrp > r.price
          ? r.discount_percent ?? Math.round(((r.mrp - r.price) / r.mrp) * 100)
          : 0;
        if (!String(pct).includes(f.pct)) return false;
      }
      if (f.status) {
        const st = r.active ? 'live' : 'inactive';
        if (f.status.toLowerCase() !== st) return false;
      }
      return true;
    });
  }, [rows, colFilters]);

  // Computed totals for footer
  const totals = useMemo(() => {
    let liveCount = 0;
    let inactiveCount = 0;
    let totalMrp = 0;
    let totalPrice = 0;
    let totalDiscount = 0;

    filteredRows.forEach((r) => {
      if (r.active) liveCount++;
      else inactiveCount++;
      totalMrp += Number(r.mrp || 0);
      totalPrice += Number(r.price || 0);
      if (r.discount_enabled && r.mrp > r.price) {
        totalDiscount += r.mrp - r.price;
      }
    });

    return { liveCount, inactiveCount, totalMrp, totalPrice, totalDiscount };
  }, [filteredRows]);

  const hasAnyFilter = Object.values(colFilters).some((v) => v !== '');

  const clearAllFilters = () => {
    setColFilters({
      caseType: '',
      state: '',
      mrp: '',
      price: '',
      discount: '',
      pct: '',
      status: '',
    });
  };

  const handleSave = async () => {
    if (!editingRow || !currentUser) return;
    setSaving(true);

    try {
      const finalMrp = Number(editForm.mrp);
      const finalPrice = Number(editForm.price);
      const autoPercent = syncPercentFromPrice(finalMrp, finalPrice);

      const oldValues = {
        mrp: editingRow.mrp,
        price: editingRow.price,
        discount_enabled: editingRow.discount_enabled,
        discount_percent: editingRow.discount_percent,
      };

      const newValues = {
        mrp: finalMrp,
        price: finalPrice,
        discount_enabled: editForm.discount_enabled,
        discount_percent:
          editForm.discount_percent !== null ? editForm.discount_percent : autoPercent,
      };

      const parts: string[] = [];
      if (oldValues.mrp !== newValues.mrp) parts.push(`MRP ₹${oldValues.mrp} → ₹${newValues.mrp}`);
      if (oldValues.price !== newValues.price) parts.push(`Price ₹${oldValues.price} → ₹${newValues.price}`);
      if (oldValues.discount_enabled !== newValues.discount_enabled)
        parts.push(`Discount ${oldValues.discount_enabled ? 'OFF' : 'ON'}`);
      if (oldValues.discount_percent !== newValues.discount_percent)
        parts.push(`Discount % ${oldValues.discount_percent ?? '—'} → ${newValues.discount_percent ?? '—'}`);
      const summary = parts.join(' | ') || 'No changes';

      if (canApprove) {
        const { error } = await supabase
          .from('pricing_config')
          .update({
            ...newValues,
            updated_at: new Date().toISOString(),
            updated_by: currentUser.id,
          })
          .eq('id', editingRow.id);
        if (error) throw error;

        await supabase.from('pricing_audit_log').insert({
          config_id: editingRow.id,
          action: 'EDITED',
          actor_id: currentUser.id,
          actor_role: normalizeRole(currentUser.role),
          old_values: oldValues,
          new_values: newValues,
        });

        alert('✅ Pricing updated successfully!');
        await fetchRows();
      } else {
        const { error } = await supabase
          .from('pricing_change_requests')
          .insert({
            config_id: editingRow.id,
            requested_by: currentUser.id,
            requested_by_role: normalizeRole(currentUser.role),
            old_values: oldValues,
            new_values: newValues,
            change_summary: summary,
            status: 'PENDING',
          });
        if (error) throw error;

        await supabase.from('pricing_audit_log').insert({
          config_id: editingRow.id,
          action: 'SUBMITTED',
          actor_id: currentUser.id,
          actor_role: normalizeRole(currentUser.role),
          old_values: oldValues,
          new_values: newValues,
        });

        alert('📩 Change submitted for Admin approval!');
        await fetchRows();
        await fetchPendingRequests();
      }

      setEditingRow(null);
    } catch (err: any) {
      alert('❌ ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!approvingReq || !currentUser) return;

    const finalMrp = Number(adminEditedValues.mrp ?? approvingReq.new_values.mrp);
    const finalPrice = Number(adminEditedValues.price ?? approvingReq.new_values.price);
    const finalDiscountPercent =
      adminEditedValues.discount_percent ??
      approvingReq.new_values.discount_percent ??
      syncPercentFromPrice(finalMrp, finalPrice);

    const finalValues = {
      mrp: finalMrp,
      price: finalPrice,
      discount_enabled:
        adminEditedValues.discount_enabled ?? approvingReq.new_values.discount_enabled,
      discount_percent: finalDiscountPercent,
    };

    const wasOverridden =
      Number(approvingReq.new_values.mrp) !== finalValues.mrp ||
      Number(approvingReq.new_values.price) !== finalValues.price;

    try {
      const { error: updateErr } = await supabase
        .from('pricing_config')
        .update({
          ...finalValues,
          updated_at: new Date().toISOString(),
          updated_by: currentUser.id,
        })
        .eq('id', approvingReq.config_id);
      if (updateErr) throw updateErr;

      const { error: reqErr } = await supabase
        .from('pricing_change_requests')
        .update({
          status: 'APPROVED',
          approved_by: currentUser.id,
          approved_at: new Date().toISOString(),
          applied_at: new Date().toISOString(),
          admin_edited_values: wasOverridden ? finalValues : null,
          admin_note: adminNote || null,
          approved_with_override: wasOverridden,
        })
        .eq('id', approvingReq.id);
      if (reqErr) throw reqErr;

      await supabase.from('pricing_audit_log').insert({
        config_id: approvingReq.config_id,
        action: wasOverridden ? 'APPROVED_WITH_OVERRIDE' : 'APPROVED',
        actor_id: currentUser.id,
        actor_role: normalizeRole(currentUser.role),
        old_values: approvingReq.old_values,
        new_values: finalValues,
        metadata: { requester_id: approvingReq.requested_by, note: adminNote },
      });

      alert(wasOverridden ? '✅ Approved with your override!' : '✅ Request approved!');
      setApprovingReq(null);
      setAdminEditedValues({});
      setAdminNote('');
      await fetchRows();
      await fetchPendingRequests();
    } catch (err: any) {
      alert('❌ ' + (err.message || err));
    }
  };

  const handleReject = async (req: ChangeRequest) => {
    const reason = prompt('Reason for rejection (mandatory):');
    if (!reason || !currentUser) return;

    await supabase
      .from('pricing_change_requests')
      .update({
        status: 'REJECTED',
        rejected_by: currentUser.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', req.id);

    await supabase.from('pricing_audit_log').insert({
      config_id: req.config_id,
      action: 'REJECTED',
      actor_id: currentUser.id,
      actor_role: normalizeRole(currentUser.role),
      old_values: req.old_values,
      new_values: req.new_values,
      metadata: { reason, requester_id: req.requested_by },
    });

    alert('❌ Request rejected');
    await fetchPendingRequests();
  };

  if (!canEdit) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="text-center py-8">
          <AlertCircle className="text-rose-500 w-12 h-12 mx-auto mb-3" />
          <h3 className="font-black text-slate-800">ACCESS DENIED</h3>
          <p className="text-xs text-slate-500 mt-1">
            Aapke role ko pricing edit karne ki permission nahi hai.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="text-center py-12 text-slate-500 text-xs font-bold uppercase tracking-wider">
          Loading pricing data...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* ══════════════════════════════════════════════════════════ */}
      {/* HEADER                                                       */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 sm:px-5 py-3 border-b border-slate-700 shrink-0">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-lg bg-amber-500/40 blur-md" />
              <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <span className="text-lg">💰</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-sm sm:text-base tracking-tight leading-tight">
                  Pricing Control Panel
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    canApprove
                      ? 'bg-purple-500/15 border border-purple-500/30 text-purple-300'
                      : 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                  }`}
                >
                  {canApprove ? '👑 Admin' : '📩 Editor'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                State-wise pricing, MRP & discount control
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-md px-2.5 py-1 backdrop-blur-sm">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Rows
              </span>
              <span className="text-[12px] font-black text-white tabular-nums">
                {filteredRows.length}
              </span>
            </div>

            {canApprove && pendingRequests.length > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-1 backdrop-blur-sm animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[10px] font-bold text-amber-400 tabular-nums">
                  {pendingRequests.length}
                </span>
                <span className="text-[9px] font-semibold text-amber-500/80 uppercase tracking-wider">
                  Pending
                </span>
              </div>
            )}

            <button
              onClick={() => {
                fetchRows();
                fetchPendingRequests();
              }}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-md text-[10px] font-bold transition flex items-center gap-1 backdrop-blur-sm"
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* PENDING APPROVALS QUEUE                                      */}
      {/* ══════════════════════════════════════════════════════════ */}
      {canApprove && pendingRequests.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 space-y-2">
          <h4 className="text-[11px] font-black text-amber-800 uppercase flex items-center gap-2">
            <Clock size={13} /> Pending Approvals ({pendingRequests.length})
          </h4>
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white border border-amber-200 rounded-lg p-2.5 flex flex-col sm:flex-row justify-between gap-2"
              >
                <div className="text-[11px] flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate">
                    <span className="text-blue-600">{req.requester_name}</span>{' '}
                    <span className="text-[9px] text-slate-500">({req.requested_by_role})</span>
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                    <strong>{req.case_type}</strong> × <strong>{req.state_name}</strong>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{req.change_summary}</p>
                </div>
                <div className="flex gap-1.5 shrink-0 items-center">
                  <button
                    onClick={() => {
                      setApprovingReq(req);
                      setAdminEditedValues({
                        mrp: req.new_values.mrp,
                        price: req.new_values.price,
                        discount_enabled: req.new_values.discount_enabled,
                        discount_percent: req.new_values.discount_percent,
                      });
                      setAdminNote('');
                    }}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold flex items-center gap-1"
                  >
                    <Check size={11} /> Review
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-md text-[10px] font-bold flex items-center gap-1"
                  >
                    <X size={11} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TABLE — Fixed height + sticky header + sticky footer         */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div
        className="overflow-y-auto overflow-x-auto"
        style={{ height: 'calc(100vh - 380px)', minHeight: '360px' }}
      >
        <table className="w-full text-left text-xs table-fixed">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-bold sticky top-0 z-20 shadow-sm">
            <tr>
              {/* CASE TYPE — DROPDOWN */}
              <th className="py-1.5 px-2 w-[20%] bg-slate-50">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500">Case Type</span>
                  <select
                    value={colFilters.caseType}
                    onChange={(e) => setColFilters({ ...colFilters, caseType: e.target.value })}
                    className={`w-full px-1.5 py-0.5 text-[10px] bg-white border rounded font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer normal-case ${
                      colFilters.caseType ? 'border-blue-300 text-blue-700 font-semibold' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <option value="">All Case Types</option>
                    {uniqueCaseTypes.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                </div>
              </th>

              {/* STATE — DROPDOWN */}
              <th className="py-1.5 px-2 w-[18%] bg-slate-50">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500">State</span>
                  <select
                    value={colFilters.state}
                    onChange={(e) => setColFilters({ ...colFilters, state: e.target.value })}
                    className={`w-full px-1.5 py-0.5 text-[10px] bg-white border rounded font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer normal-case ${
                      colFilters.state ? 'border-blue-300 text-blue-700 font-semibold' : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <option value="">All States</option>
                    {uniqueStates.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </th>

              {/* MRP */}
              <th className="py-1.5 px-2 w-[11%] bg-slate-50 text-center">
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-[9px] text-slate-500">MRP</span>
                  <input
                    type="text"
                    placeholder="₹"
                    value={colFilters.mrp}
                    onChange={(e) => setColFilters({ ...colFilters, mrp: e.target.value })}
                    className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 text-center normal-case"
                  />
                </div>
              </th>

              {/* PRICE */}
              <th className="py-1.5 px-2 w-[11%] bg-slate-50 text-center">
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-[9px] text-slate-500">Price</span>
                  <input
                    type="text"
                    placeholder="₹"
                    value={colFilters.price}
                    onChange={(e) => setColFilters({ ...colFilters, price: e.target.value })}
                    className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 text-center normal-case"
                  />
                </div>
              </th>

              {/* DISCOUNT */}
              <th className="py-1.5 px-2 w-[10%] bg-slate-50 text-center">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500">Discount</span>
                  <select
                    value={colFilters.discount}
                    onChange={(e) => setColFilters({ ...colFilters, discount: e.target.value })}
                    className="w-full px-1 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer normal-case"
                  >
                    <option value="">All</option>
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </div>
              </th>

              {/* % OFF */}
              <th className="py-1.5 px-2 w-[10%] bg-slate-50 text-center">
                <div className="flex flex-col gap-1 items-center">
                  <span className="text-[9px] text-slate-500">% Off</span>
                  <input
                    type="text"
                    placeholder="%"
                    value={colFilters.pct}
                    onChange={(e) => setColFilters({ ...colFilters, pct: e.target.value })}
                    className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 text-center normal-case"
                  />
                </div>
              </th>

              {/* STATUS */}
              <th className="py-1.5 px-2 w-[10%] bg-slate-50 text-center">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500">Status</span>
                  <select
                    value={colFilters.status}
                    onChange={(e) => setColFilters({ ...colFilters, status: e.target.value })}
                    className="w-full px-1 py-0.5 text-[10px] bg-white border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer normal-case"
                  >
                    <option value="">All</option>
                    <option value="live">Live</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </th>

              {/* ACTION */}
              <th className="py-1.5 px-2 w-[10%] bg-slate-50 text-center">
                <span className="text-[9px] text-slate-500">Action</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                  No pricing rows found matching your filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const pct =
                  row.discount_enabled && row.mrp > row.price
                    ? row.discount_percent ?? Math.round(((row.mrp - row.price) / row.mrp) * 100)
                    : 0;

                return (
                  <tr key={row.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-1 px-2 font-bold text-slate-800 text-[11px] truncate">
                      <span title={row.case_type}>{row.case_type}</span>
                    </td>
                    <td className="py-1 px-2">
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold uppercase truncate inline-block max-w-full">
                        {row.state_name}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-center font-mono text-slate-600 text-[11px] whitespace-nowrap tabular-nums">
                      ₹{row.mrp.toLocaleString('en-IN')}
                    </td>
                    <td className="py-1 px-2 text-center font-mono font-bold text-emerald-600 text-[12px] whitespace-nowrap tabular-nums">
                      ₹{row.price.toLocaleString('en-IN')}
                    </td>
                    <td className="py-1 px-2 text-center">
                      {row.discount_enabled ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200 text-[9px] font-bold uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          on
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200 text-[9px] font-bold uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          off
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-center font-bold text-amber-600 text-[11px] tabular-nums">
                      {pct ? `${pct}%` : '—'}
                    </td>
                    <td className="py-1 px-2 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase ${
                          row.active
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {row.active ? 'live' : 'inactive'}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-center">
                      <button
                        onClick={() => {
                          setEditingRow(row);
                          setEditForm({
                            mrp: row.mrp,
                            price: row.price,
                            discount_enabled: row.discount_enabled,
                            discount_percent: row.discount_percent,
                          });
                        }}
                        className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold transition"
                      >
                        ✎ Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* ✅ STICKY FOOTER */}
          <tfoot className="sticky bottom-0 z-20">
            <tr className="bg-gradient-to-r from-slate-900 to-slate-800 text-white font-bold">
              <td colSpan={2} className="py-2 px-3 border-t-2 border-slate-700">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-slate-300">
                    TOTAL — Filtered
                  </span>
                  <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-bold tabular-nums">
                    {filteredRows.length} rows
                  </span>
                  <span className="text-[9px] text-emerald-400">
                    ● {totals.liveCount} live
                  </span>
                  <span className="text-[9px] text-rose-400">
                    ● {totals.inactiveCount} inactive
                  </span>
                  {hasAnyFilter && (
                    <button
                      onClick={clearAllFilters}
                      className="px-1.5 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded text-[9px] font-bold uppercase transition"
                    >
                      ✕ Clear Filters
                    </button>
                  )}
                </div>
              </td>
              <td className="py-2 px-3 border-t-2 border-slate-700 text-center whitespace-nowrap">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block leading-none">
                  Total MRP
                </span>
                <span className="text-slate-200 text-[12px] font-bold tabular-nums">
                  ₹{totals.totalMrp.toLocaleString('en-IN')}
                </span>
              </td>
              <td className="py-2 px-3 border-t-2 border-slate-700 text-center whitespace-nowrap">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block leading-none">
                  Total Price
                </span>
                <span className="text-emerald-400 text-[12px] font-black tabular-nums">
                  ₹{totals.totalPrice.toLocaleString('en-IN')}
                </span>
              </td>
              <td colSpan={2} className="py-2 px-3 border-t-2 border-slate-700 text-center whitespace-nowrap">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block leading-none">
                  Total Savings
                </span>
                <span className="text-amber-400 text-[12px] font-black tabular-nums">
                  ₹{totals.totalDiscount.toLocaleString('en-IN')}
                </span>
              </td>
              <td colSpan={2} className="py-2 px-3 border-t-2 border-slate-700 text-center whitespace-nowrap">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block leading-none">
                  Avg Discount
                </span>
                <span className="text-amber-400 text-[12px] font-black tabular-nums">
                  {totals.totalMrp > 0
                    ? ((totals.totalDiscount / totals.totalMrp) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* EDIT MODAL — SAME AS BEFORE                                 */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-sm text-slate-800">
                {canApprove ? '✎ Edit Pricing' : '📩 Submit Change for Approval'}
              </h3>
              <button
                onClick={() => setEditingRow(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Case × State</p>
              <p className="text-xs font-black text-slate-800 mt-0.5">
                {editingRow.case_type} × {editingRow.state_name}
              </p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Quick Discount
              </label>
              <div className="flex gap-1 flex-wrap mt-1">
                {[5, 10, 15, 20, 25, 30, 50].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setEditForm({
                        ...editForm,
                        discount_percent: p,
                        price: syncPriceFromPercent(editForm.mrp, p),
                      })
                    }
                    className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                      editForm.discount_percent === p
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {p}% OFF
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setEditForm({
                      ...editForm,
                      discount_percent: null,
                      price: editForm.mrp,
                    })
                  }
                  className="px-2 py-1 rounded text-[10px] font-bold bg-rose-100 text-rose-700 hover:bg-rose-200"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">MRP (₹)</label>
                <input
                  type="number"
                  value={editForm.mrp}
                  onChange={(e) => {
                    const newMrp = Number(e.target.value);
                    const newPrice =
                      editForm.discount_percent !== null
                        ? syncPriceFromPercent(newMrp, editForm.discount_percent)
                        : editForm.price;
                    setEditForm({
                      ...editForm,
                      mrp: newMrp,
                      price: newPrice,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Price (₹)</label>
                <input
                  type="number"
                  value={editForm.price}
                  onChange={(e) => {
                    const newPrice = Number(e.target.value);
                    setEditForm({
                      ...editForm,
                      price: newPrice,
                      discount_percent: syncPercentFromPrice(editForm.mrp, newPrice),
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {editForm.mrp > 0 && editForm.price < editForm.mrp && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">
                    ✓ {syncPercentFromPrice(editForm.mrp, editForm.price)}% off auto-calculated
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <input
                  type="checkbox"
                  checked={editForm.discount_enabled}
                  onChange={(e) =>
                    setEditForm({ ...editForm, discount_enabled: e.target.checked })
                  }
                  id="disc-toggle"
                  className="w-4 h-4"
                />
                <label htmlFor="disc-toggle" className="text-xs font-bold text-emerald-800">
                  Discount ON (show MRP cut + % badge to user)
                </label>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Discount % (blank = auto)
                </label>
                <input
                  type="number"
                  value={editForm.discount_percent ?? ''}
                  placeholder="auto"
                  onChange={(e) => {
                    const pct = e.target.value === '' ? null : Number(e.target.value);
                    setEditForm({
                      ...editForm,
                      discount_percent: pct,
                      price: syncPriceFromPercent(editForm.mrp, pct),
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-blue-600 mt-1">
                  💡 % badlenge to price auto-update hoga
                </p>
              </div>

              <div className="bg-slate-900 text-white p-3 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-slate-400">Live Preview</p>
                <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                  {editForm.mrp > editForm.price && editForm.discount_enabled && (
                    <span className="line-through text-slate-500 text-xs">
                      ₹{editForm.mrp}
                    </span>
                  )}
                  <span className="text-lg font-black text-emerald-400">
                    ₹{editForm.price}
                  </span>
                  {editForm.discount_percent !== null && editForm.discount_percent > 0 && (
                    <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded font-bold">
                      {editForm.discount_percent}% OFF
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Savings: ₹{editForm.mrp - editForm.price}
                </p>
              </div>

              {!canApprove && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800">
                  ⚠️ Ye changes <strong>Admin</strong> ko approval ke liye jayenge.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingRow(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Save size={12} />
                {saving ? 'Saving...' : canApprove ? 'Save Directly' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* APPROVE MODAL — SAME AS BEFORE                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {approvingReq && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <Check size={16} className="text-emerald-600" /> Review & Approve
              </h3>
              <button
                onClick={() => {
                  setApprovingReq(null);
                  setAdminEditedValues({});
                  setAdminNote('');
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
              <p className="text-xs text-slate-700">
                Request by <strong className="text-blue-700">{approvingReq.requester_name}</strong>{' '}
                <span className="text-[10px] text-slate-500">
                  ({approvingReq.requested_by_role})
                </span>
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left font-bold text-slate-600">FIELD</th>
                    <th className="p-2 text-right font-bold text-slate-600">OLD</th>
                    <th className="p-2 text-right font-bold text-blue-600">REQUESTED</th>
                    <th className="p-2 text-right font-bold text-emerald-600 bg-emerald-50">
                      YOUR VALUE
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {['mrp', 'price'].map((f) => (
                    <tr key={f}>
                      <td className="p-2 font-bold uppercase text-slate-700">{f}</td>
                      <td className="p-2 text-right text-slate-500 font-mono">
                        ₹{approvingReq.old_values?.[f]}
                      </td>
                      <td className="p-2 text-right text-blue-600 font-bold font-mono">
                        ₹{approvingReq.new_values?.[f]}
                      </td>
                      <td className="p-2 text-right bg-emerald-50">
                        <input
                          type="number"
                          value={adminEditedValues[f] ?? ''}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = { ...adminEditedValues, [f]: val };
                            if (f === 'price') {
                              const mrp = Number(
                                updated.mrp ?? approvingReq.new_values.mrp
                              );
                              updated.discount_percent = syncPercentFromPrice(mrp, val);
                            }
                            if (f === 'mrp' && updated.discount_percent !== null && updated.discount_percent !== undefined) {
                              updated.price = syncPriceFromPercent(
                                val,
                                updated.discount_percent
                              );
                            }
                            setAdminEditedValues(updated);
                          }}
                          className="w-24 px-2 py-1 border border-emerald-300 rounded text-right font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="p-2 font-bold uppercase text-slate-700">Discount</td>
                    <td className="p-2 text-right">
                      {approvingReq.old_values?.discount_enabled ? 'ON' : 'OFF'}
                    </td>
                    <td className="p-2 text-right text-blue-600 font-bold">
                      {approvingReq.new_values?.discount_enabled ? 'ON' : 'OFF'}
                    </td>
                    <td className="p-2 text-right bg-emerald-50">
                      <input
                        type="checkbox"
                        checked={adminEditedValues.discount_enabled ?? false}
                        onChange={(e) =>
                          setAdminEditedValues({
                            ...adminEditedValues,
                            discount_enabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold uppercase text-slate-700">% Off</td>
                    <td className="p-2 text-right text-slate-500">
                      {approvingReq.old_values?.discount_percent ?? '—'}%
                    </td>
                    <td className="p-2 text-right text-blue-600 font-bold">
                      {approvingReq.new_values?.discount_percent ?? '—'}%
                    </td>
                    <td className="p-2 text-right bg-emerald-50">
                      <input
                        type="number"
                        value={adminEditedValues.discount_percent ?? ''}
                        placeholder="auto"
                        onChange={(e) => {
                          const pct = e.target.value === '' ? null : Number(e.target.value);
                          const mrp = Number(
                            adminEditedValues.mrp ?? approvingReq.new_values.mrp
                          );
                          setAdminEditedValues({
                            ...adminEditedValues,
                            discount_percent: pct,
                            price: syncPriceFromPercent(mrp, pct),
                          });
                        }}
                        className="w-24 px-2 py-1 border border-emerald-300 rounded text-right font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Admin Note (optional)
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
                placeholder="e.g. Reduced from requested value as per policy"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setApprovingReq(null);
                  setAdminEditedValues({});
                  setAdminNote('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Check size={12} /> Approve with My Values
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}