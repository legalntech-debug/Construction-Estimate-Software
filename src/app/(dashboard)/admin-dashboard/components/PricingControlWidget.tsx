'use client';

import React, { useEffect, useState, useCallback } from 'react';
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

/** MRP + Price se auto % nikalna */
const syncPercentFromPrice = (mrp: number, price: number): number | null => {
  if (!mrp || mrp <= 0 || price >= mrp) return null;
  return roundTwo(((mrp - price) / mrp) * 100);
};

/** MRP + % se auto price nikalna */
const syncPriceFromPercent = (mrp: number, pct: number | null): number => {
  if (pct === null || pct <= 0 || !mrp || mrp <= 0) return mrp;
  return Math.round(mrp - (mrp * pct) / 100);
};

export default function PricingControlWidget() {
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);

  const [filterCaseType, setFilterCaseType] = useState('ALL');
  const [filterState, setFilterState] = useState('ALL');
  const [search, setSearch] = useState('');

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

  const handleSave = async () => {
    if (!editingRow || !currentUser) return;
    setSaving(true);

    try {
      // ═══ AUTO-SYNC: price और % dono consistent karo ═══
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

    // ═══ AUTO-SYNC: agar admin ne % nahi diya to price se auto nikaalo ═══
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

  const filteredRows = rows.filter((r) => {
    if (filterCaseType !== 'ALL' && r.case_type !== filterCaseType) return false;
    if (filterState !== 'ALL' && r.state_name !== filterState) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.case_type.toLowerCase().includes(q) ||
        r.state_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueCaseTypes = Array.from(new Set(rows.map((r) => r.case_type)));
  const uniqueStates = Array.from(new Set(rows.map((r) => r.state_name)));

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
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            💰 Pricing Control Panel
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded ${
                canApprove
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {canApprove ? 'ADMIN — Direct Edit + Approve' : 'EDIT → Submit for Approval'}
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            State-wise pricing, MRP, discount toggle, aur CEO/Co-Partner approvals manage karein.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canApprove && pendingRequests.length > 0 && (
            <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-xl text-xs font-black animate-pulse">
              ⏳ {pendingRequests.length} Pending
            </span>
          )}
          <button
            onClick={() => {
              fetchRows();
              fetchPendingRequests();
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* PENDING APPROVALS QUEUE */}
      {canApprove && pendingRequests.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-2">
          <h4 className="text-xs font-black text-amber-800 uppercase flex items-center gap-2">
            <Clock size={14} /> Pending Approvals
          </h4>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row justify-between gap-3"
              >
                <div className="text-xs flex-1">
                  <p className="font-bold text-slate-800">
                    <span className="text-blue-600">{req.requester_name}</span>{' '}
                    <span className="text-[10px] text-slate-500">({req.requested_by_role})</span>
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    <strong>{req.case_type}</strong> × <strong>{req.state_name}</strong>
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{req.change_summary}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(req.requested_at).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 items-center">
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
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Check size={12} /> Review
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <select
          value={filterCaseType}
          onChange={(e) => setFilterCaseType(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">ALL CASE TYPES</option>
          {uniqueCaseTypes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">ALL STATES</option>
          {uniqueStates.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="🔍 Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <span className="text-[10px] font-bold text-slate-500 px-2">
          {filteredRows.length} rows
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 1. DESKTOP TABLE VIEW */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="hidden md:block rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-3 text-left font-bold">CASE TYPE</th>
                <th className="p-3 text-left font-bold">STATE</th>
                <th className="p-3 text-right font-bold">MRP</th>
                <th className="p-3 text-right font-bold">PRICE</th>
                <th className="p-3 text-center font-bold">DISCOUNT</th>
                <th className="p-3 text-center font-bold">% OFF</th>
                <th className="p-3 text-center font-bold">STATUS</th>
                <th className="p-3 text-center font-bold">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => {
                const pct =
                  row.discount_enabled && row.mrp > row.price
                    ? row.discount_percent ??
                      Math.round(((row.mrp - row.price) / row.mrp) * 100)
                    : 0;
                return (
                  <tr key={row.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-bold text-slate-800">{row.case_type}</td>
                    <td className="p-3 font-bold text-blue-700">{row.state_name}</td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      ₹{row.mrp.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                      ₹{row.price.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-center">
                      {row.discount_enabled ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold text-[10px]">
                          ON
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-bold text-[10px]">
                          OFF
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-amber-600">
                      {pct ? `${pct}%` : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          row.active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {row.active ? 'LIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
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
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold"
                      >
                        ✎ Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                    No pricing rows found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 2. MOBILE CARD VIEW */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="block md:hidden space-y-3">
        {filteredRows.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl">
            No pricing rows found.
          </div>
        ) : (
          filteredRows.map((row) => {
            const pct =
              row.discount_enabled && row.mrp > row.price
                ? row.discount_percent ??
                  Math.round(((row.mrp - row.price) / row.mrp) * 100)
                : 0;
            return (
              <div
                key={row.id}
                className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-2"
              >
                <div className="flex justify-between items-start gap-2 border-b border-slate-200 pb-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-xs truncate">{row.case_type}</div>
                    <div className="text-[11px] text-blue-700 font-semibold truncate">
                      📍 {row.state_name}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase shrink-0 ${
                      row.active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {row.active ? 'LIVE' : 'INACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">MRP</span>
                    <span className="font-mono text-slate-600 text-[11px] mt-0.5 block">
                      ₹{row.mrp.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">Price</span>
                    <span className="font-mono font-bold text-emerald-600 text-[11px] mt-0.5 block">
                      ₹{row.price.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">Discount</span>
                    <span
                      className={`font-bold text-[10px] mt-0.5 block ${
                        row.discount_enabled ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {row.discount_enabled ? '✅ ON' : '❌ OFF'}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">% OFF</span>
                    <span className="font-bold text-amber-600 text-[11px] mt-0.5 block">
                      {pct ? `${pct}%` : '—'}
                    </span>
                  </div>
                </div>

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
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
                >
                  ✎ Edit Pricing
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* EDIT MODAL — AUTO-SYNC ENABLED */}
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

            {/* Quick % Buttons */}
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
              {/* MRP Input */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">MRP (₹)</label>
                <input
                  type="number"
                  value={editForm.mrp}
                  onChange={(e) => {
                    const newMrp = Number(e.target.value);
                    // Agar % diya hua hai → price recalculate
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

              {/* Price Input → % auto */}
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

              {/* Discount Toggle */}
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

              {/* Discount % Input → Price auto */}
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

              {/* Live Preview */}
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
      {/* APPROVE MODAL — AUTO-SYNC ENABLED */}
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
                            // Agar price badla → % auto-sync
                            if (f === 'price') {
                              const mrp = Number(
                                updated.mrp ?? approvingReq.new_values.mrp
                              );
                              updated.discount_percent = syncPercentFromPrice(mrp, val);
                            }
                            // Agar mrp badla → price auto (agar % tha)
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