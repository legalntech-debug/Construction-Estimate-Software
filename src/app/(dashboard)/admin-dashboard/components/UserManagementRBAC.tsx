'use client';

import React, { useState, useEffect } from 'react';

interface UserManagementRBACProps {
  filteredProfiles: any[];
  userTableSearch: string;
  setUserTableSearch: (val: string) => void;
  modalSelectedDate: string;
  setModalSelectedDate: (val: string) => void;
  modalSelectedMonth: string;
  setModalSelectedMonth: (val: string) => void;
  modalFilterType: string;
  setModalFilterType: (val: 'all' | 'date' | 'month') => void;
  hiddenSections: { [key: string]: boolean };
  toggleSection: (key: string) => void;
  handleUpdateUserRbac: (userId: string, actionField: 'role' | 'status', newValue: string) => Promise<void>;
  handleOpenUserEstimates: (profile: any) => void;
  supabaseClient?: any;
}

export default function UserManagementRBAC({
  filteredProfiles,
  userTableSearch,
  setUserTableSearch,
  modalSelectedDate,
  setModalSelectedDate,
  modalSelectedMonth,
  setModalSelectedMonth,
  modalFilterType,
  setModalFilterType,
  hiddenSections,
  toggleSection,
  handleUpdateUserRbac,
  handleOpenUserEstimates,
  supabaseClient,
}: UserManagementRBACProps) {
  
  const [enrichedDataMap, setEnrichedDataMap] = useState<{ [key: string]: { estimates: any[]; services: any[]; combined: any[] } }>({});

  useEffect(() => {
    async function fetchAllRecords() {
      try {
        const client = supabaseClient || (window as any).supabase;
        if (!filteredProfiles || filteredProfiles.length === 0) return;

        const userIds = filteredProfiles.map(p => p.id).filter(Boolean);
        if (userIds.length === 0) return;

        let allEstimates: any[] = [];
        let allServiceRecords: any[] = [];

        if (client) {
          // 1. Fetch estimates table using user_id
          try {
            const { data, error } = await client
              .from('estimates')
              .select('*')
              .in('user_id', userIds);
            if (!error && data) {
              allEstimates = data;
            }
          } catch (e) {
            console.error('Error fetching estimates:', e);
          }

          // 2. Fetch service_records table using user_id
          try {
            const { data, error } = await client
              .from('service_records')
              .select('*')
              .in('user_id', userIds);
            if (!error && data) {
              allServiceRecords = data;
            }
          } catch (e) {
            console.error('Error fetching service_records:', e);
          }
        }

        const newMap: { [key: string]: { estimates: any[]; services: any[]; combined: any[] } } = {};

        for (const p of filteredProfiles) {
          const userId = p.id;
          if (!userId) continue;

          const matchedEstimates = allEstimates.filter((item: any) => String(item.user_id) === String(userId));
          const matchedServices = allServiceRecords.filter((item: any) => String(item.user_id) === String(userId));

          const profileEstimates = [
            ...(Array.isArray(p.estimates_list) ? p.estimates_list : []),
            ...(Array.isArray(p.estimates) ? p.estimates : []),
            ...matchedEstimates
          ];

          const profileServices = [
            ...(Array.isArray(p.service_records) ? p.service_records : []),
            ...(Array.isArray(p.records) ? p.records : []),
            ...(Array.isArray(p.drafts) ? p.drafts : []),
            ...matchedServices
          ];

          // Deduplicate estimates
          const estMap = new Map();
          profileEstimates.forEach(item => {
            if (item) estMap.set(item.id || item.ref_no || JSON.stringify(item), item);
          });
          const uniqueEstimates = Array.from(estMap.values());

          // Deduplicate services
          const srvMap = new Map();
          profileServices.forEach(item => {
            if (item) srvMap.set(item.id || item.ref_no || JSON.stringify(item), item);
          });
          const uniqueServices = Array.from(srvMap.values());

          // Combined unique list
          const combinedMap = new Map();
          [...uniqueEstimates, ...uniqueServices].forEach(item => {
            if (item) combinedMap.set(item.id || item.ref_no || JSON.stringify(item), item);
          });
          const uniqueCombined = Array.from(combinedMap.values());

          newMap[userId] = {
            estimates: uniqueEstimates,
            services: uniqueServices,
            combined: uniqueCombined
          };
        }

        setEnrichedDataMap(newMap);
      } catch (err) {
        console.error('Error in fetchAllRecords:', err);
      }
    }

    fetchAllRecords();
  }, [filteredProfiles, supabaseClient]);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 overflow-x-hidden">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base">User Role, Category, Firm & Estimates Tracking (RBAC)</h3>
          <p className="text-xs text-slate-500">Filter user activity by date or month and search by name, category, or firm name.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex-1 sm:flex-initial">
            <span className="text-[10px] font-bold text-slate-500 uppercase">From:</span>
            <input 
              type="date" 
              value={modalSelectedDate && modalFilterType === 'date' ? modalSelectedDate : ''} 
              onChange={(e) => { setModalSelectedDate(e.target.value); setModalFilterType('date'); }}
              className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 w-full"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex-1 sm:flex-initial">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Month:</span>
            <input 
              type="month" 
              value={modalSelectedMonth} 
              onChange={(e) => { setModalSelectedMonth(e.target.value); setModalFilterType('month'); }}
              className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 w-full"
            />
          </div>

          {(modalSelectedDate || modalSelectedMonth || userTableSearch) && (
            <button 
              onClick={() => { setModalSelectedDate(''); setModalSelectedMonth(''); setUserTableSearch(''); setModalFilterType('all'); }}
              className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition w-full sm:w-auto text-center"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
        <div className="w-full sm:w-80">
          <input 
            type="text"
            placeholder="🔍 Search name, email, mobile, category, firm..."
            value={userTableSearch}
            onChange={(e) => setUserTableSearch(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <button 
          onClick={() => toggleSection('rbac')}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition whitespace-nowrap"
        >
          {hiddenSections.rbac ? 'Show [+]' : 'Hide [-]'}
        </button>
      </div>

      {!hiddenSections.rbac && (
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-sm min-w-[1100px] table-fixed">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3 rounded-l-xl w-[25%]">User Details</th>
                <th className="p-3 w-[18%]">Category & Firm</th>
                <th className="p-3 text-center w-[9%]">Wallet</th>
                <th className="p-3 text-center w-[8%]">Lock</th>
                <th className="p-3 text-center w-[9%]">Estimates / Services</th>
                <th className="p-3 w-[10%]">Revenue</th>
                <th className="p-3 w-[8%]">Role</th>
                <th className="p-3 w-[8%]">Status</th>
                <th className="p-3 rounded-r-xl text-right w-[9%]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(() => {
                const processedProfiles = filteredProfiles.map((p: any) => {
                  const recordData = enrichedDataMap[p.id] || { estimates: [], services: [], combined: [] };

                  let finalEstimates = recordData.estimates;
                  let finalServices = recordData.services;
                  let finalCombined = recordData.combined;

                  if (modalSelectedDate || modalSelectedMonth) {
                    const filterFn = (est: any) => {
                      const dateField = est?.created_at || est?.date;
                      if (!dateField) return false;
                      const estDate = new Date(dateField);
                      if (isNaN(estDate.getTime())) return false;

                      if (modalFilterType === 'date' && modalSelectedDate) {
                        return estDate.toISOString().split('T')[0] === modalSelectedDate;
                      }
                      if (modalFilterType === 'month' && modalSelectedMonth) {
                        const estMonthStr = `${estDate.getFullYear()}-${String(estDate.getMonth() + 1).padStart(2, '0')}`;
                        return estMonthStr === modalSelectedMonth;
                      }
                      return true;
                    };

                    finalEstimates = finalEstimates.filter(filterFn);
                    finalServices = finalServices.filter(filterFn);
                    
                    const combMap = new Map();
                    [...finalEstimates, ...finalServices].forEach(item => {
                      if (item) combMap.set(item.id || item.ref_no || JSON.stringify(item), item);
                    });
                    finalCombined = Array.from(combMap.values());
                  }

                  const estCount = finalEstimates.length;
                  const srvCount = finalServices.length;
                  const totalCount = finalCombined.length;

                  // Calculate revenue from both estimates and services securely
                  const userRevenue = finalCombined.reduce((sum: number, curr: any) => {
                    const val = Number(curr.user_payment ?? curr.fee_standard ?? curr.amount ?? curr.fee ?? 0);
                    return sum + (isNaN(val) ? 0 : val);
                  }, 0);

                  return { 
                    ...p, 
                    calculatedEstCount: estCount, 
                    calculatedSrvCount: srvCount,
                    calculatedTotalCount: totalCount,
                    calculatedRevenue: userRevenue, 
                    filteredEstimates: finalEstimates,
                    filteredServices: finalServices,
                    combinedRecords: finalCombined 
                  };
                }).filter((p: any) => {
                  if (!modalSelectedDate && !modalSelectedMonth) return true;
                  return p.calculatedTotalCount > 0;
                });

                (window as any).__tempFilteredProfiles = processedProfiles;

                if (processedProfiles.length === 0) {
                  return (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-400 text-sm">No profiles found matching your search or filter criteria.</td>
                    </tr>
                  );
                }

                return processedProfiles.map((p: any) => {
                  const userId = p.id;
                  const userWalletBalance = Number(p.wallet_balance ?? 0);
                  const userPlan = (p.plan_type || '').toUpperCase();
                  
                  const isAdminUser = p.role === 'admin' || (p.email || '').toLowerCase() === 'legalntech@gmail.com';
                  const isPremium = userPlan.includes('PREMIUM');
                  const isUserLocked = !isAdminUser && !isPremium && userWalletBalance < 100;

                  const userCategory = p.category || p.user_category || p.user_type || p.account_type || 'Individual';
                  const userFirmName = p.firm_name || p.company_name || p.business_name || 'N/A';

                  return (
                    <tr key={userId} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 truncate">
                        <div className="font-bold text-slate-900 truncate" title={p.full_name || p.name || 'N/A'}>{p.full_name || p.name || 'N/A'}</div>
                        <div className="text-xs text-slate-500 truncate" title={p.email || 'No Email'}>{p.email || 'No Email'}</div>
                        <div className="text-xs text-slate-600 font-medium mt-0.5 truncate" title={p.mobile || 'N/A'}>📞 {p.mobile || 'N/A'}</div>
                      </td>

                      <td className="p-3 truncate">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-bold truncate inline-block max-w-full" title={userCategory}>
                          {userCategory}
                        </span>
                        <div className="font-semibold text-slate-800 text-xs mt-1 truncate" title={userFirmName}>
                          🏢 {userFirmName}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-lg font-bold text-[11px] border inline-block whitespace-nowrap ${
                          userWalletBalance < 0 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : userWalletBalance === 0 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {userWalletBalance < 0 ? `-₹${Math.abs(userWalletBalance)}` : `₹${userWalletBalance}`}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        {isAdminUser ? (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md text-[10px] font-extrabold uppercase">Admin</span>
                        ) : isPremium ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-extrabold uppercase">Exempt</span>
                        ) : isUserLocked ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md text-[10px] font-extrabold uppercase animate-pulse">
                            🔒 Locked
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-extrabold uppercase">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <button 
                          onClick={() => {
                            const payload = {
                              ...p,
                              estimates_list: p.filteredEstimates,
                              service_records: p.filteredServices,
                              combined_records: p.combinedRecords
                            };
                            handleOpenUserEstimates(payload);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-[11px] transition border border-blue-200 whitespace-nowrap inline-flex items-center gap-1"
                          title="Estimates + Service Records"
                        >
                          📊 <span className="text-blue-900 font-black">{p.calculatedEstCount}</span> + <span className="text-indigo-900 font-black">{p.calculatedSrvCount}</span>
                        </button>
                      </td>

                      <td className="p-3 font-semibold text-emerald-600 text-xs whitespace-nowrap">
                        ₹{Number(p.calculatedRevenue).toLocaleString('en-IN')}
                      </td>

                      <td className="p-3">
                        <select 
                          value={p.role || 'user'}
                          onChange={(e) => handleUpdateUserRbac(userId, 'role', e.target.value)}
                          className={`px-1.5 py-1 rounded-md text-[11px] font-bold cursor-pointer border focus:outline-none w-full ${
                            p.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                            p.role === 'premium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="user">user</option>
                          <option value="premium">premium</option>
                        </select>
                      </td>

                      <td className="p-3">
                        <select 
                          value={p.status || 'Active'}
                          onChange={(e) => handleUpdateUserRbac(userId, 'status', e.target.value)}
                          className={`px-1.5 py-1 rounded-md text-[11px] font-bold cursor-pointer border focus:outline-none w-full ${
                            (p.status || '').toLowerCase() === 'suspended' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <option value="Active">Active</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </td>

                      <td className="p-3 text-right">
                        <button 
                          onClick={() => handleUpdateUserRbac(userId, 'status', (p.status || '').toLowerCase() === 'suspended' ? 'Active' : 'suspended')}
                          className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition whitespace-nowrap ${
                            (p.status || '').toLowerCase() === 'suspended' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                          }`}
                        >
                          {(p.status || '').toLowerCase() === 'suspended' ? 'Activate' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
            <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold text-slate-900 text-xs">
              {(() => {
                const currentList = (window as any).__tempFilteredProfiles || [];
                const filteredActiveCount = currentList.filter((p: any) => (p.status || 'active').toLowerCase() === 'active').length;
                const filteredSuspendedCount = currentList.filter((p: any) => (p.status || '').toLowerCase() === 'suspended').length;
                const filteredWalletSum = currentList.reduce((sum: number, p: any) => sum + Number(p.wallet_balance ?? 0), 0);
                const filteredEstSum = currentList.reduce((sum: number, p: any) => sum + Number(p.calculatedEstCount || 0), 0);
                const filteredSrvSum = currentList.reduce((sum: number, p: any) => sum + Number(p.calculatedSrvCount || 0), 0);
                const filteredRevenueSum = currentList.reduce((sum: number, p: any) => sum + Number(p.calculatedRevenue || 0), 0);

                return (
                  <tr>
                    <td colSpan={2} className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-blue-700 font-black text-xs">TOTAL (Filtered):</span>
                        <span className="text-slate-500 text-[11px]">Active: <strong className="text-emerald-600">{filteredActiveCount}</strong> | Suspended: <strong className="text-rose-600">{filteredSuspendedCount}</strong></span>
                      </div>
                    </td>
                    <td className={`p-3 text-center rounded-lg align-middle border text-xs ${filteredWalletSum < 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : filteredWalletSum === 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {filteredWalletSum < 0 ? `-₹${Math.abs(filteredWalletSum)}` : `₹${filteredWalletSum}`}
                    </td>
                    <td className="p-3"></td>
                    <td className="p-3 text-center text-blue-700 text-xs whitespace-nowrap font-bold">
                      {filteredEstSum} Est + {filteredSrvSum} Srv
                    </td>
                    <td colSpan={4} className="p-3 text-emerald-700 text-xs whitespace-nowrap">₹{filteredRevenueSum.toLocaleString('en-IN')}</td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}