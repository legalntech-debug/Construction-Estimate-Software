'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ShieldCheck, UserCheck, UserX, AlertTriangle, Search, FileText, CheckCircle, XCircle, Trash2, Lock, Key, Plus } from 'lucide-react';

export default function AdminPartnerManagementPage() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    checkAuthorizationAndFetch();
  }, []);

  const checkAuthorizationAndFetch = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    setSession(session);

    // 1. Fetch allowed roles from database table
    const { data: rolePermissions } = await supabase
      .from('admin_role_permissions')
      .select('role_name');
    
    const rolesList = rolePermissions ? rolePermissions.map(r => r.role_name.toLowerCase()) : ['admin', 'ceo and a co-partner'];
    setAllowedRoles(rolesList);

    // 2. Fetch User Profile to check role & user_type
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type, role')
      .eq('id', session.user.id)
      .single();

    if (profile) {
      const userRole = (profile.role || '').toLowerCase();
      const userType = (profile.user_type || '').toLowerCase();

      // Check if user's role or user_type matches allowed permissions
      if (
        userType === 'admin' || 
        userType === 'ceo' || 
        rolesList.includes(userRole) ||
        rolesList.includes(userType)
      ) {
        setIsAuthorized(true);
        fetchAllPartners();
      } else {
        setIsAuthorized(false);
      }
    } else {
      setIsAuthorized(false);
    }
    setLoading(false);
  };

  const fetchAllPartners = async () => {
    const { data, error } = await supabase
      .from('partner_profiles')
      .select(`*, profiles:user_id (full_name, email, mobile, city, state, wallet_balance, role)`);

    if (error) {
      console.error('Error fetching partners:', error.message);
    } else {
      setPartners(data || []);
    }
  };

  const handleAddAllowedRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleInput.trim()) return;

    const { error } = await supabase
      .from('admin_role_permissions')
      .insert({ role_name: newRoleInput.trim() });

    if (error) {
      alert('ERROR ADDING ROLE: ' + error.message);
    } else {
      alert('ROLE SUCCESSFULLY AUTHORIZED FOR PARTNER MANAGEMENT ACCESS.');
      setNewRoleInput('');
      checkAuthorizationAndFetch();
    }
  };

  const handleRemoveAllowedRole = async (roleName: string) => {
    const confirmRemove = window.confirm(`ARE YOU SURE YOU WANT TO REVOKE ACCESS FOR ROLE: "${roleName}"?`);
    if (!confirmRemove) return;

    const { error } = await supabase
      .from('admin_role_permissions')
      .delete()
      .eq('role_name', roleName);

    if (error) {
      alert('ERROR REMOVING ROLE: ' + error.message);
    } else {
      alert('ROLE ACCESS REVOKED SUCCESSFULLY.');
      checkAuthorizationAndFetch();
    }
  };

  const handleUpdateStatus = async (partnerId: string, newStatus: string) => {
    const confirmAction = window.confirm(`ARE YOU SURE YOU WANT TO CHANGE PARTNER STATUS TO ${newStatus}?`);
    if (!confirmAction) return;

    const updatePayload: any = { approval_status: newStatus };
    if (newStatus === 'TERMINATED') {
      updatePayload.is_legacy_active = false;
    }

    const { error } = await supabase
      .from('partner_profiles')
      .update(updatePayload)
      .eq('partner_id', partnerId);

    if (error) {
      alert('FAILED TO UPDATE STATUS: ' + error.message);
    } else {
      alert(`PARTNER STATUS SUCCESSFULLY UPDATED TO ${newStatus}`);
      fetchAllPartners();
      setShowDetailModal(false);
    }
  };

  const handleTerminateAndForfeit = async (partnerId: string) => {
    const reason = prompt('ENTER REASON FOR CONTRACT TERMINATION & WALLET FORFEITURE (MANDATORY):');
    if (!reason) return;

    const confirmTerminate = window.confirm('WARNING: THIS WILL UNILATERALLY TERMINATE THE CONTRACT, BLOCK THE PARTNER, AND INSTANTLY FORFEIT ALL WALLET BALANCES AS PER POLICY. PROCEED?');
    if (!confirmTerminate) return;

    const { error } = await supabase
      .from('partner_profiles')
      .update({ approval_status: 'TERMINATED', is_legacy_active: false })
      .eq('partner_id', partnerId);

    if (error) {
      alert('ERROR TERMINATING PARTNER: ' + error.message);
      return;
    }

    alert('PARTNER CONTRACT TERMINATED UNILATERALLY AND WALLET BALANCE FORFEITED DUE TO POLICY BREACH.');
    fetchAllPartners();
    setShowDetailModal(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-300 bg-slate-950 min-h-screen">VERIFYING ADMIN & ROLE AUTHORIZATION...</div>;
  }

  if (!isAuthorized) {
    return (
      <div className="p-12 text-center bg-slate-950 min-h-screen flex flex-col items-center justify-center space-y-4 uppercase">
        <Lock className="text-red-500 w-16 h-16" />
        <h1 className="text-2xl font-black text-red-400">ACCESS DENIED</h1>
        <p className="text-xs text-slate-400 max-w-md">YOUR CURRENT PROFILE ROLE IS NOT AUTHORIZED TO ACCESS THE PARTNER MANAGEMENT CONSOLE. CONTACT THE MAIN ADMINISTRATOR TO GRANT PERMISSION.</p>
      </div>
    );
  }

  const filteredPartners = partners.filter(p => 
    p.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.coverage_location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6 uppercase">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-indigo-400 flex items-center gap-2">
            <ShieldCheck className="text-indigo-400 w-7 h-7" /> ADMIN & CEO PARTNER APPROVAL CONSOLE
          </h1>
          <p className="text-xs text-slate-400 mt-1">Review applications, monitor 3% net commission mappings & manage role-based access.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowRoleModal(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Key size={16} /> MANAGE ROLE ACCESS
          </button>
          <div className="w-full md:w-64">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="SEARCH PARTNER..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Partners Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800/60 text-indigo-300 border-b border-slate-800">
                <th className="p-4">Partner Name & Role</th>
                <th className="p-4">Coverage Area</th>
                <th className="p-4">PAN / Bank Info</th>
                <th className="p-4">Nominee Details</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">NO PARTNERS FOUND MATCHING CRITERIA.</td>
                </tr>
              ) : (
                filteredPartners.map((item) => (
                  <tr key={item.partner_id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                    <td className="p-4">
                      <div className="font-bold text-white">{item.profiles?.full_name || 'N/A'}</div>
                      <div className="text-[11px] text-indigo-300 font-semibold">Role: {item.profiles?.role || 'N/A'}</div>
                      <div className="text-[10px] text-slate-400">{item.profiles?.email}</div>
                    </td>
                    <td className="p-4 text-slate-300 font-semibold">{item.coverage_location || 'N/A'}</td>
                    <td className="p-4 text-slate-300">
                      <div>PAN: {item.pan_card_no}</div>
                      <div className="text-[11px] text-slate-400">A/C: {item.bank_account_no} ({item.ifsc_code})</div>
                    </td>
                    <td className="p-4 text-slate-300">
                      <div>{item.nominee_name} ({item.nominee_relation})</div>
                      <div className="text-[11px] text-slate-400">{item.nominee_phone}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] ${
                        item.approval_status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        item.approval_status === 'LEVEL_1_APPROVED' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                        item.approval_status === 'TERMINATED' ? 'bg-red-950 text-red-400 border border-red-800' :
                        'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {item.approval_status || 'PENDING'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => {
                          setSelectedPartner(item);
                          setShowDetailModal(true);
                        }} 
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer text-[11px]"
                      >
                        REVIEW & ACTION
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROLE ACCESS MANAGEMENT MODAL */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h3 className="text-base font-bold text-indigo-300 flex items-center gap-2">
                <Key size={18} /> MANAGE AUTHORIZED ROLES FOR CONSOLE
              </h3>
              <button onClick={() => setShowRoleModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-300">
              <p className="text-slate-400">
                Add exact role titles from the database profiles table (e.g. <code className="text-indigo-300">CEO and a Co-Partner</code>, <code className="text-indigo-300">Marketing Head Odisa</code>, <code className="text-indigo-300">admin</code>) to grant them access to this console.
              </p>

              <form onSubmit={handleAddAllowedRole} className="flex gap-2">
                <input 
                  type="text" 
                  required
                  placeholder="ENTER ROLE NAME..." 
                  value={newRoleInput}
                  onChange={(e) => setNewRoleInput(e.target.value)}
                  className="flex-1 p-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                <button type="submit" className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0">
                  <Plus size={16} /> ADD ROLE
                </button>
              </form>

              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-slate-200">Currently Authorized Roles:</h4>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-48 overflow-y-auto space-y-2">
                  {allowedRoles.map((role, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                      <span className="font-semibold text-emerald-400 uppercase">{role}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveAllowedRole(role)}
                        className="text-red-400 hover:text-red-300 font-bold text-[11px] cursor-pointer"
                      >
                        REVOKE
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button onClick={() => setShowRoleModal(false)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition cursor-pointer">
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL & ACTION MODAL */}
      {showDetailModal && selectedPartner && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h3 className="text-base font-bold text-indigo-300">PARTNER VERIFICATION & GOVERNANCE CONSOLE</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400">Full Name:</span> <strong className="text-white">{selectedPartner.profiles?.full_name}</strong>
                </div>
                <div>
                  <span className="text-slate-400">User Role:</span> <strong className="text-indigo-300">{selectedPartner.profiles?.role}</strong>
                </div>
                <div>
                  <span className="text-slate-400">PAN Number:</span> <strong className="text-white">{selectedPartner.pan_card_no}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Bank Account:</span> <strong className="text-white">{selectedPartner.bank_account_no} ({selectedPartner.ifsc_code})</strong>
                </div>
                <div>
                  <span className="text-slate-400">Coverage Location:</span> <strong className="text-white">{selectedPartner.coverage_location}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Wallet Balance:</span> <strong className="text-emerald-400">₹ {selectedPartner.profiles?.wallet_balance || 0}</strong>
                </div>
              </div>

              <div className="bg-amber-950/20 border border-amber-800/40 p-4 rounded-xl space-y-2">
                <h4 className="font-bold text-amber-300 flex items-center gap-2">
                  <AlertTriangle size={16} /> GOVERNANCE & UNILATERAL TERMINATION CONTROLS
                </h4>
                <p className="text-[11px] text-slate-400">
                  As per company policy, management can approve, suspend, or terminate partner contracts at any time without prior justification in case of fraudulent activity or compliance violations.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                {selectedPartner.approval_status !== 'LEVEL_1_APPROVED' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedPartner.partner_id, 'LEVEL_1_APPROVED')}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} /> LEVEL 1 APPROVAL
                  </button>
                )}
                {selectedPartner.approval_status !== 'APPROVED' && (
                  <button 
                    onClick={() => handleUpdateStatus(selectedPartner.partner_id, 'APPROVED')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} /> FULL CEO / ADMIN APPROVAL
                  </button>
                )}
                <button 
                  onClick={() => handleTerminateAndForfeit(selectedPartner.partner_id)}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-3 rounded-xl transition cursor-pointer flex items-center gap-2"
                >
                  <Trash2 size={16} /> TERMINATE & FORFEIT WALLET
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}