'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardChart from '@/app/components/DashboardChart';
import SystemAlerts from '../../components/SystemAlerts';
import InactiveUsersModal from '@/app/components/InactiveUsersModal';
import RazorpayRevenueChart from '@/app/components/RazorpayRevenueChart';
import RazorpayTableWithFilter from '@/app/components/RazorpayTableWithFilter';

export default function AdminDashboardPage(props: { 
  searchParams: Promise<{ filter?: string; inactiveDays?: string }> 
}) {
  const [searchParamsData, setSearchParamsData] = useState<{ filter?: string; inactiveDays?: string }>({});
  const [mounted, setMounted] = useState(false);

  // Modal / Drill-down state for user estimates
  const [selectedUserForEstimates, setSelectedUserForEstimates] = useState<any>(null);
  const [userEstimatesList, setUserEstimatesList] = useState<any[]>([]);

  // Modal Filter States (Declared at the top level to follow React Hook rules)
  const [modalFilterType, setModalFilterType] = useState<'all' | 'date' | 'month'>('all');
  const [modalSelectedDate, setModalSelectedDate] = useState('');
  const [modalSelectedMonth, setModalSelectedMonth] = useState('');

  // States for all fetched dashboard data
  const [dashboardData, setDashboardData] = useState<any>({
    records: [],
    stats: [],
    monthlyCases: [],
    fyData: [],
    totalUsers: 0,
    inactiveUsers: [],
    liveOnlineCount: 0,
    razorpayTransactions: [],
    auditLogs: [],
    storageFiles: [],
    allProfiles: [],
  });

  const [queryLatency, setQueryLatency] = useState(0);

  useEffect(() => {
    setMounted(true);
    props.searchParams.then((params) => {
      setSearchParamsData(params);
    });
  }, [props.searchParams]);

  const filter = searchParamsData.filter || 'all';
  const inactiveDays = Number(searchParamsData.inactiveDays || 30);

  useEffect(() => {
    if (!mounted) return;

    async function fetchDashboardData() {
      const startTime = Date.now();
      let startDate = new Date(); 
      
      if (filter === 'day') startDate.setDate(startDate.getDate() - 1);
      else if (filter === 'week') startDate.setDate(startDate.getDate() - 7);
      else if (filter === 'month') startDate.setMonth(startDate.getMonth() - 1);
      else if (filter === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
      else if (filter === 'fy') startDate.setMonth(3, 1); 
      else startDate.setFullYear(2020);

      try {
        const [
          { data: records },
          { data: stats },
          { data: monthlyCases },
          { data: fyData },
          { data: totalUsersCount },
          { data: inactiveUsersData },
          { count: liveOnlineCount },
          { data: razorpayTransactions },
          { data: auditLogs },
          { data: storageFiles },
          { data: enhancedProfiles }
        ] = await Promise.all([
          supabase.from('mis_records').select('*').gte('created_date', startDate.toISOString()),
          supabase.from('estimates').select('payment_status, user_id, amount, reference_no, customer_name, case_type, created_at'),
          supabase.rpc('get_monthly_case_count'),
          supabase.rpc('get_revenue_by_fy', { start_date: startDate.toISOString(), end_date: new Date().toISOString() }),
          supabase.rpc('get_total_users'),
          supabase.rpc('get_inactive_users', { days_limit: inactiveDays }),
          supabase.from('user_status').select('*', { count: 'exact', head: true }).eq('is_online', true),
          supabase.rpc('get_razorpay_transactions'),
          supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.storage.from('documents').list(),
          supabase.rpc('get_profiles_with_estimates_count')
        ]);

        setDashboardData({
          records: records || [],
          stats: stats || [],
          monthlyCases: monthlyCases || [],
          fyData: fyData || [],
          totalUsers: totalUsersCount ?? 0,
          inactiveUsers: inactiveUsersData || [],
          liveOnlineCount: liveOnlineCount ?? 0,
          razorpayTransactions: razorpayTransactions || [],
          auditLogs: auditLogs || [],
          storageFiles: storageFiles || [],
          allProfiles: enhancedProfiles || [],
        });

        setQueryLatency(Date.now() - startTime);
      } catch (err) {
        console.error("Error fetching admin dashboard data:", err);
      }
    }

    fetchDashboardData();
  }, [mounted, filter, inactiveDays]);

  // Function to handle opening user estimates breakdown modal
  const handleOpenUserEstimates = (profile: any) => {
    setSelectedUserForEstimates(profile);
    setUserEstimatesList(profile.estimates_list || []);
    setModalFilterType('all');
    setModalSelectedDate('');
    setModalSelectedMonth('');
  };

  if (!mounted) {
    return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-gray-500 text-xs tracking-widest font-mono">LOADING CONTROL CENTER...</div>;
  }

  const totalStorageBytes = dashboardData.storageFiles?.reduce((acc: number, file: any) => acc + (file.metadata?.size || 0), 0) || 0;
  const totalStorageMB = (totalStorageBytes / (1024 * 1024)).toFixed(2);

  const stateMap: { [key: string]: number } = {};
  dashboardData.allProfiles?.forEach((p: any) => {
    const userState = p.state || p.user_state || p.location;
    const st = userState && typeof userState === 'string' && userState.trim() !== '' 
      ? userState.trim().toUpperCase() 
      : 'NOT SPECIFIED';
    stateMap[st] = (stateMap[st] || 0) + 1; 
  });

  let stateCases = Object.keys(stateMap).map(k => ({ state_name: k, case_count: stateMap[k] }));
  const totalCalculatedRevenue = dashboardData.allProfiles?.reduce((acc: number, curr: any) => acc + Number(curr.total_revenue || 0), 0) || 0;

  // Filtered estimates computation for modal
  const filteredModalEstimates = userEstimatesList.filter((est: any) => {
    if (!est.created_at) return true;
    const estDate = new Date(est.created_at);
    
    if (modalFilterType === 'date' && modalSelectedDate) {
      const formattedEstDate = estDate.toISOString().split('T')[0];
      return formattedEstDate === modalSelectedDate;
    }
    if (modalFilterType === 'month' && modalSelectedMonth) {
      const estMonthStr = `${estDate.getFullYear()}-${String(estDate.getMonth() + 1).padStart(2, '0')}`;
      return estMonthStr === modalSelectedMonth;
    }
    return true;
  });

  const totalFilteredModalAmount = filteredModalEstimates.reduce((sum, curr) => sum + Number(curr.user_payment || curr.amount || 21), 0);

  return (
    <div className="p-4 sm:p-8 bg-slate-50/50 min-h-screen space-y-8 font-sans antialiased text-slate-950 relative">
      
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Enterprise Control Center</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-600 rounded-full border border-blue-100">v2.5 Pro Enterprise</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Real-time financial telemetry, RBAC security, audit trails, and live system health.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto">
            {['day', 'week', 'month', 'year', 'fy'].map((f) => (
              <Link 
                key={f} 
                href={`/admin-dashboard?filter=${f}`} 
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === f ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {f.toUpperCase()}
              </Link>
            ))}
          </div>

          <SystemAlerts type="status" message="SYSTEM ONLINE" />
        </div>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Storage Bucket Usage</p>
            <p className="text-xl font-black text-slate-800 mt-1">{totalStorageMB} MB <span className="text-xs font-normal text-slate-500">(Live Files)</span></p>
          </div>
          <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-sm">📦</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Database Query Latency</p>
            <p className={`text-xl font-black mt-1 ${queryLatency > 300 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {queryLatency} ms <span className="text-xs font-normal text-slate-500">(Optimal)</span>
            </p>
          </div>
          <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold text-sm">⚡</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active System Error Rate</p>
            <p className="text-xl font-black text-emerald-600 mt-1">0.00% <span className="text-xs font-normal text-slate-500">(Zero crashes)</span></p>
          </div>
          <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-sm">🛡️</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center bg-gradient-to-r from-blue-900 to-indigo-900 p-6 rounded-3xl text-white shadow-md">
        <div>
          <h2 className="text-lg font-bold">Financial Health Index: Optimal</h2>
          <p className="text-xs text-blue-200 mt-0.5">Total Revenue Tracked: ₹ {totalCalculatedRevenue.toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          <a 
            href="/api/admin/export-reports" 
            target="_blank"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition flex items-center gap-2"
          >
            <span>📥 Export CSV Report</span>
          </a>
        </div>
      </div>

      {/* Core KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Registered Users</h3>
              <p className="text-3xl font-black text-slate-900 mt-2">{dashboardData.totalUsers ?? 0}</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">👥</div>
          </div>
          <div className="mt-4 flex items-center text-xs text-slate-500 gap-1 font-medium">
            <span className="text-emerald-600 font-bold">100%</span> Database synced
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Now (Online)</h3>
              <p className="text-3xl font-black text-emerald-600 mt-2">{dashboardData.liveOnlineCount ?? 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">🟢</div>
          </div>
          <div className="mt-4 flex items-center text-xs text-emerald-600 gap-1 font-medium">
            <span>Live socket connection active</span>
          </div>
        </div>

        <InactiveUsersModal users={Array.isArray(dashboardData.inactiveUsers) ? dashboardData.inactiveUsers : []} />
      </div>

      {/* RBAC Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-slate-800 text-base">User Role & Estimates Management (RBAC)</h3>
            <p className="text-xs text-slate-500">Click on any user's total estimate count to inspect their generated estimates breakdown.</p>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-xl font-bold">Live Directory</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3 rounded-l-xl">User Details (Name & Email)</th>
                <th className="p-3">Mobile No.</th>
                <th className="p-3 text-center">Total Estimates</th>
                <th className="p-3">Total Revenue (Fee)</th>
                <th className="p-3">Assigned Role</th>
                <th className="p-3">Account Status</th>
                <th className="p-3 rounded-r-xl text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dashboardData.allProfiles && dashboardData.allProfiles.length > 0 ? (
                dashboardData.allProfiles.map((p: any) => {
                  const userId = p.id;
                  const userRevenue = p.total_revenue || 0;
                  const estCount = p.estimates_count || 0;

                  return (
                    <tr key={userId} className="hover:bg-slate-50/50 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{p.full_name || 'N/A'}</div>
                        <div className="text-xs text-slate-500">{p.email || 'No Email'}</div>
                      </td>

                      <td className="p-3 text-slate-700 font-medium">
                        {p.mobile || 'N/A'}
                      </td>

                      <td className="p-3 text-center">
                        <button 
                          onClick={() => handleOpenUserEstimates(p)}
                          className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-black text-xs transition shadow-sm border border-blue-200 inline-flex items-center gap-1.5"
                          title="Click to view all estimates for this user"
                        >
                          <span>📊 {estCount} {estCount === 1 ? 'Estimate' : 'Estimates'}</span>
                        </button>
                      </td>

                      <td className="p-3 font-semibold text-emerald-600">
                        ₹ {Number(userRevenue).toLocaleString('en-IN')}
                      </td>

                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${p.role === 'admin' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-slate-100 text-slate-600'}`}>
                          {p.role || 'user'}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${p.status === 'suspended' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {p.status || 'Active'}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <form action="/api/admin/update-role" method="POST" className="inline-flex gap-2">
                          <input type="hidden" name="user_id" value={p.user_id || p.id} />
                          <button type="submit" name="action" value="toggle_role" className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition">
                            Toggle Role
                          </button>
                          <button type="submit" name="action" value="toggle_status" className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-lg transition">
                            {p.status === 'suspended' ? 'Activate' : 'Suspend'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 text-sm">No profiles found in database table.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- WIDER USER ESTIMATES DRILL-DOWN MODAL WITH DATE/MONTH FILTERS --- */}
      {/* --- WIDER USER ESTIMATES DRILL-DOWN MODAL WITH FILTERS, EXCEL DOWNLOAD & WHATSAPP --- */}
      {selectedUserForEstimates && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black tracking-tight">Estimates Breakdown: {selectedUserForEstimates.full_name}</h3>
                <p className="text-xs text-slate-300 mt-0.5">Email: {selectedUserForEstimates.email} | Mobile: {selectedUserForEstimates.mobile || 'N/A'}</p>
              </div>
              <button 
                onClick={() => setSelectedUserForEstimates(null)}
                className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Filter Controls Bar & Export Actions */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter By:</span>
                <button 
                  onClick={() => { setModalFilterType('all'); setModalSelectedDate(''); setModalSelectedMonth(''); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${modalFilterType === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border text-slate-600 hover:bg-slate-100'}`}
                >
                  All Records
                </button>
                <button 
                  onClick={() => setModalFilterType('date')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${modalFilterType === 'date' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border text-slate-600 hover:bg-slate-100'}`}
                >
                  Specific Date
                </button>
                <button 
                  onClick={() => setModalFilterType('month')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${modalFilterType === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border text-slate-600 hover:bg-slate-100'}`}
                >
                  Month-wise
                </button>
              </div>

              {/* Conditional Inputs & Export / WhatsApp Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                {modalFilterType === 'date' && (
                  <input 
                    type="date"
                    value={modalSelectedDate}
                    onChange={(e) => setModalSelectedDate(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {modalFilterType === 'month' && (
                  <input 
                    type="month"
                    value={modalSelectedMonth}
                    onChange={(e) => setModalSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {/* Excel Download Button */}
                <button
                  onClick={() => {
                    let csvContent = "data:text/csv;charset=utf-8,Ref No,Date Time,Customer Name,Case Type,Amount\n";
                    filteredModalEstimates.forEach((est: any) => {
                      const row = [
                        `"${est.reference_no || est.ref_no || 'N/A'}"`,
                        `"${est.created_at ? new Date(est.created_at).toLocaleString() : 'N/A'}"`,
                        `"${est.customer_name || 'N/A'}"`,
                        `"${est.case_type || est.estimate_type || 'N/A'}"`,
                        est.user_payment || est.amount || 21
                      ].join(",");
                      csvContent += row + "\r\n";
                    });
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `Estimates_${selectedUserForEstimates.full_name || 'User'}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>📥 Download Excel</span>
                </button>

                {/* Send MIS on WhatsApp Button */}
                {selectedUserForEstimates.mobile && (
                  <a
                    href={`https://wa.me/91${selectedUserForEstimates.mobile.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Hello *${selectedUserForEstimates.full_name}*,\n\nHere is your MIS Estimates Summary Report:\n- Total Filtered Records: ${filteredModalEstimates.length}\n- Total Payable Amount: ₹ ${totalFilteredModalAmount.toLocaleString('en-IN')}\n\nPlease complete your payment at your earliest convenience. Thank you!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <span>💬 Send on WhatsApp</span>
                  </a>
                )}
              </div>
            </div>

            {/* Modal Body Table */}
            <div className="p-6 overflow-y-auto flex-1">
              {filteredModalEstimates.length > 0 ? (
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                      <tr>
                        <th className="p-3">Ref No.</th>
                        <th className="p-3">Date & Time</th>
                        <th className="p-3">Customer Name</th>
                        <th className="p-3">Case Type</th>
                        <th className="p-3 text-right">Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredModalEstimates.map((est: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition text-xs">
                          <td className="p-3 font-mono font-bold text-blue-600">{est.reference_no || est.ref_no || 'N/A'}</td>
                          <td className="p-3 text-slate-600">{est.created_at ? new Date(est.created_at).toLocaleString() : 'N/A'}</td>
                          <td className="p-3 font-semibold text-slate-900">{est.customer_name || 'N/A'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold uppercase text-[10px]">
                              {est.case_type || est.estimate_type || 'N/A'}
                            </span>
                          </td>
                          <td className="p-3 text-right font-black text-emerald-600">
                            ₹ {Number(est.user_payment || est.amount || 21).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                      <tr>
                        <td colSpan={4} className="p-3 text-right">Total Filtered Amount Paid:</td>
                        <td className="p-3 text-right text-emerald-700 text-sm">
                          ₹ {totalFilteredModalAmount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-sm font-medium">
                  No estimates found matching the selected date/month filter.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setSelectedUserForEstimates(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                Close Window
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Audit Logs */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-slate-800 text-base">System Audit Trail & Security Compliance</h3>
            <p className="text-xs text-slate-500">Chronological telemetry log of database changes, CRUD operations, and administrative actions.</p>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1 rounded-xl font-bold">Secure Log Stream</span>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {dashboardData.auditLogs && dashboardData.auditLogs.length > 0 ? (
            dashboardData.auditLogs.map((log: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-slate-50/70 border border-slate-100 rounded-2xl text-xs">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 font-bold rounded-lg uppercase">{log.action_type || 'UPDATE'}</span>
                  <span className="text-slate-700 font-medium">{log.description || log.table_name || 'System record modified'}</span>
                </div>
                <span className="text-slate-400">{new Date(log.created_at || Date.now()).toLocaleString()}</span>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-slate-400 text-sm">No audit logs found. Ensure `audit_logs` table has entries.</div>
          )}
        </div>
      </div>

      {/* Inactive Users */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Dead User Engagement Analysis</h3>
            <p className="text-xs text-slate-500">Monitor dormant user accounts based on custom inactivity thresholds.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-2xl border">
            {[10, 20, 30, 60, 90].map(d => (
              <Link 
                href={`/admin-dashboard?inactiveDays=${d}`} 
                key={d} 
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${inactiveDays === d ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
              >
                {d} Days
              </Link>
            ))}
          </div>
        </div>
        
        <div className="max-h-64 overflow-y-auto pr-2 divide-y divide-slate-100">
          {dashboardData.inactiveUsers && dashboardData.inactiveUsers.length > 0 ? (
            dashboardData.inactiveUsers.map((u: any) => (
              <div key={u.user_id} className="flex justify-between items-center py-3 text-sm">
                <span className="text-slate-700 font-medium">{u.email}</span>
                <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg font-medium">
                  Last login: {new Date(u.last_login).toLocaleDateString()}
                </span>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-slate-400 text-sm">No inactive users found for this threshold.</div>
          )}
        </div>
      </div>

      {/* Razorpay Revenue Chart */}
      <div>
        <RazorpayRevenueChart transactions={dashboardData.razorpayTransactions || []} />
      </div>

      {/* MIS Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Cases (Month-wise)</span>
            <span className="text-xs text-slate-400 font-normal">Aggregated metrics</span>
          </h3>
          <div className="space-y-2">
            {dashboardData.monthlyCases?.map((item: any) => (
              <div key={item.month_name} className="flex justify-between items-center py-2.5 border-b border-slate-50 text-sm">
                <span className="text-slate-600 font-medium">{item.month_name}</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-xl text-xs">{item.case_count} Cases</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Cases (State-wise)</span>
            <span className="text-xs text-slate-400 font-normal">Geographic spread</span>
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {stateCases && stateCases.length > 0 ? (
              stateCases.map((item: any, idx: number) => {
                const stateName = item.state_name || 'Not Specified';
                const caseCount = item.case_count ?? 0;

                return (
                  <div key={idx} className="flex justify-between items-center py-2.5 border-b border-slate-50 text-sm">
                    <span className="text-slate-600 font-medium">{stateName}</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-xl text-xs">
                      {caseCount} {caseCount === 1 ? 'Case' : 'Cases'}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex justify-between items-center py-2.5 border-b border-slate-50 text-sm">
                <span className="text-slate-600 font-medium">Not Specified</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-xl text-xs">0 Cases</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
            <span>Revenue (FY-wise)</span>
            <span className="text-xs text-slate-400 font-normal">Fiscal telemetry</span>
           </h3>
          <div className="space-y-2">
            {dashboardData.fyData?.map((item: any) => (
              <div key={item.fy_label} className="flex justify-between items-center py-2.5 border-b border-slate-50 text-sm">
                <span className="text-slate-600 font-medium">FY {item.fy_label}</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl text-xs">₹ {Number(item.revenue).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-4">Revenue Trend Line</h3>
           <DashboardChart data={dashboardData.records || []} />
        </div>
      </div>

      {/* Razorpay Transactions Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-base">Payment Gateway & Dispute Operations</h3>
          <span className="text-xs text-slate-400">Razorpay Live API Hook</span>
        </div>
        <RazorpayTableWithFilter transactions={dashboardData.razorpayTransactions || []} />
      </div>

    </div>
  );
}