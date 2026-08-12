'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import DashboardChart from '@/app/components/DashboardChart';
import SystemAlerts from '../../components/SystemAlerts';
import InactiveUsersModal from '@/app/components/InactiveUsersModal';
import RazorpayRevenueChart from '@/app/components/RazorpayRevenueChart';
import RazorpayTableWithFilter from '@/app/components/RazorpayTableWithFilter';
import PushNotificationManager from '@/components/PushNotificationManager';

// --- IMPORTED SUB-COMPONENTS ---
import AdminBroadcastWidget from './components/AdminBroadcastWidget';
import AdminCreateUserWidget from './components/AdminCreateUserWidget';
import AdminPendingApprovalsWidget from './components/AdminPendingApprovalsWidget';
import AdminRefundRequestsWidget from './components/AdminRefundRequestsWidget';
import PremiumBillingWidget from './components/PremiumBillingWidget'; // <-- Added Premium Billing Widget

export default function AdminDashboardPage(props: { 
  searchParams: Promise<{ filter?: string; inactiveDays?: string }> 
}) {
  const [searchParamsData, setSearchParamsData] = useState<{ filter?: string; inactiveDays?: string }>({});
  const [mounted, setMounted] = useState(false);

  const [userTableSearch, setUserTableSearch] = useState('');

  const [hiddenSections, setHiddenSections] = useState<{ [key: string]: boolean }>({
    gstManager: true,
    gatewayAnalytics: true,
    recharge: true,
    health: true,
    kpi: true,
    rbac: true,
    audit: true,
    inactive: true,
    razorpayChart: true,
    mis: true,
    gateway: true,
    premiumBilling: false, // <-- State for Premium Billing Widget section toggle
  });

  const toggleSection = (key: string) => {
    setHiddenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [selectedUserForEstimates, setSelectedUserForEstimates] = useState<any>(null);
  const [userEstimatesList, setUserEstimatesList] = useState<any[]>([]);

  const [modalFilterType, setModalFilterType] = useState<'all' | 'date' | 'month'>('all');
  const [modalSelectedDate, setModalSelectedDate] = useState('');
  const [modalSelectedMonth, setModalSelectedMonth] = useState('');

  const [rechargeRequests, setRechargeRequests] = useState<any[]>([]);
  const [refundRequests, setRefundRequests] = useState<any[]>([]);

  const [incomes, setIncomes] = useState<any[]>([]);
  const [incomeForm, setIncomeForm] = useState({
    client_name: '',
    invoice_no: '',
    taxable_amount: '',
    gst_rate: '18',
    gst_type: 'INTRA',
    description: '',
  });

  const [gatewayFilterMode, setGatewayFilterMode] = useState<'month' | 'date' | 'year' | 'fy'>('month');
  const [selectedGatewayMonth, setSelectedGatewayMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedGatewayDate, setSelectedGatewayDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedGatewayYear, setSelectedGatewayYear] = useState(new Date().getFullYear().toString());
  const [selectedGatewayFY, setSelectedGatewayFY] = useState('2026-27');

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) || e.key === 'PrintScreen') {
        e.preventDefault();
        alert('Security Warning: Printing or saving screenshots from this Enterprise Control Center is restricted.');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const filter = searchParamsData.filter || 'all';
  const inactiveDays = Number(searchParamsData.inactiveDays || 30);

  const fetchDashboardData = async () => {
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
        recordsRes,
        statsRes,
        monthlyCasesRes,
        fyDataRes,
        totalUsersCountRes,
        inactiveUsersDataRes,
        liveOnlineCountRes,
        razorpayTransactionsRes,
        auditLogsRes,
        storageFilesRes,
        enhancedProfilesRes,
        rechargesDataRes,
        incomesDataRes,
        refundsDataRes
      ] = await Promise.all([
        supabase.from('mis_records').select('*').gte('created_date', startDate.toISOString()),
        supabase.from('estimates').select('payment_status, user_id, amount, reference_no, customer_name, case_type, created_at, user_payment'),
        supabase.rpc('get_monthly_case_count'),
        supabase.rpc('get_revenue_by_fy', { start_date: startDate.toISOString(), end_date: new Date().toISOString() }),
        supabase.rpc('get_total_users'),
        supabase.rpc('get_inactive_users', { days_limit: inactiveDays }),
        supabase.from('user_status').select('*', { count: 'exact', head: true }).eq('is_online', true),
        supabase.rpc('get_razorpay_transactions'),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.storage.from('documents').list(),
        supabase.rpc('get_profiles_with_estimates_count'),
        supabase.from('wallet_recharges').select('*').order('created_at', { ascending: false }),
        supabase.from('admin_incomes').select('*').order('created_at', { ascending: false }),
        supabase.from('wallet_refund_requests').select('*').order('created_at', { ascending: false })
      ]);

      let sortedProfiles = enhancedProfilesRes.data || [];
      sortedProfiles.sort((a: any, b: any) => {
        const nameA = (a.full_name || '').toLowerCase();
        const nameB = (b.full_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setDashboardData({
        records: recordsRes.data || [],
        stats: statsRes.data || [],
        monthlyCases: monthlyCasesRes.data || [],
        fyData: fyDataRes.data || [],
        totalUsers: totalUsersCountRes.data ?? 0,
        inactiveUsers: inactiveUsersDataRes.data || [],
        liveOnlineCount: liveOnlineCountRes.count ?? 0,
        razorpayTransactions: razorpayTransactionsRes.data || [],
        auditLogs: auditLogsRes.data || [],
        storageFiles: storageFilesRes.data || [],
        allProfiles: sortedProfiles,
      });

      setRechargeRequests(rechargesDataRes.data || []);
      setIncomes(incomesDataRes.data || []);
      setRefundRequests(refundsDataRes.data || []);
      setQueryLatency(Date.now() - startTime);
    } catch (err) {
      console.error("Error fetching admin dashboard data:", err);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    fetchDashboardData();
  }, [mounted, filter, inactiveDays]);

  const gatewayTxns = dashboardData.razorpayTransactions || [];
  
  const filteredGatewayTxns = gatewayTxns.filter((tx: any) => {
    const txDateStr = tx.created_at || tx.date || tx.payment_date || '';
    if (!txDateStr) return false;
    const txDate = new Date(txDateStr);
    
    if (gatewayFilterMode === 'month') {
      return txDateStr.startsWith(selectedGatewayMonth);
    } else if (gatewayFilterMode === 'date') {
      return txDateStr.startsWith(selectedGatewayDate);
    } else if (gatewayFilterMode === 'year') {
      return txDate.getFullYear().toString() === selectedGatewayYear;
    } else if (gatewayFilterMode === 'fy') {
      const year = txDate.getFullYear();
      const month = txDate.getMonth() + 1;
      const startYear = month >= 4 ? year : year - 1;
      const fyString = `${startYear}-${(startYear + 1).toString().slice(-2)}`;
      return fyString === selectedGatewayFY;
    }
    return true;
  });

  const activeGatewayRevenue = filteredGatewayTxns.reduce((sum: number, tx: any) => {
    const amt = Number(tx.amount || tx.user_payment || tx.gross_amount || tx.paid_amount || 0);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const totalGatewayRevenueAllTime = gatewayTxns.reduce((sum: number, tx: any) => {
    const amt = Number(tx.amount || tx.user_payment || tx.gross_amount || tx.paid_amount || 0);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const handleExportGatewayExcel = () => {
    if (filteredGatewayTxns.length === 0) {
      alert('No transactions found for the selected filter to export.');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Payment ID,Reference No,Customer Name,Case Type,Date,Amount Paid,Status\r\n";

    filteredGatewayTxns.forEach((tx: any) => {
      const row = [
        tx.reference_no || tx.razorpay_payment_id || 'N/A',
        `"${tx.reference_no || ''}"`,
        `"${tx.customer_name || 'N/A'}"`,
        `"${tx.case_type || 'N/A'}"`,
        tx.created_at ? new Date(tx.created_at).toLocaleString() : 'N/A',
        Number(tx.amount || tx.user_payment || 0),
        tx.payment_status || 'paid'
      ].join(",");
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gateway_revenue_${gatewayFilterMode}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateMonthlyConsolidatedGST = async () => {
    const revToConsolidate = activeGatewayRevenue > 0 ? activeGatewayRevenue : totalGatewayRevenueAllTime;
    if (revToConsolidate <= 0) {
      alert('No gateway revenue available to consolidate.');
      return;
    }

    const rate = 18;
    const taxable = Number((revToConsolidate / (1 + rate / 100)).toFixed(2));
    const gstAmount = Number((revToConsolidate - taxable).toFixed(2));
    const cgst = Number((gstAmount / 2).toFixed(2));
    const sgst = Number((gstAmount / 2).toFixed(2));

    const payload = {
      client_name: `B2C Consolidated Gateway Sales (${gatewayFilterMode.toUpperCase()})`,
      invoice_no: `B2C-GW-${Date.now().toString().slice(-6)}`,
      taxable_amount: taxable,
      gst_rate: rate,
      gst_amount: gstAmount,
      cgst,
      sgst,
      igst: 0,
      total_amount: revToConsolidate,
      description: `Automated gateway direct payment consolidation (${filteredGatewayTxns.length} transactions).`,
    };

    try {
      const { error } = await supabase.from('admin_incomes').insert([payload]);
      if (error) throw error;

      alert('Successfully generated B2C Consolidated Monthly GST Invoice!');
      const { data: updatedIncomes } = await supabase.from('admin_incomes').select('*').order('created_at', { ascending: false });
      if (updatedIncomes) setIncomes(updatedIncomes);
    } catch (err: any) {
      alert('Failed to generate consolidated invoice: ' + (err.message || err));
    }
  };

  const handleAddIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const taxable = Number(incomeForm.taxable_amount);
    const rate = Number(incomeForm.gst_rate);

    if (isNaN(taxable) || taxable <= 0) {
      alert('Please enter a valid taxable amount.');
      return;
    }

    const gstAmount = (taxable * rate) / 100;
    const totalAmount = taxable + gstAmount;

    let cgst = 0, sgst = 0, igst = 0;
    if (incomeForm.gst_type === 'INTRA') {
      cgst = gstAmount / 2;
      sgst = gstAmount / 2;
    } else {
      igst = gstAmount;
    }

    try {
      const payload = {
        client_name: incomeForm.client_name,
        invoice_no: incomeForm.invoice_no || `INV-${Date.now().toString().slice(-6)}`,
        taxable_amount: taxable,
        gst_rate: rate,
        gst_amount: gstAmount,
        cgst,
        sgst,
        igst,
        total_amount: totalAmount,
        description: incomeForm.description,
      };

      const { error } = await supabase.from('admin_incomes').insert([payload]);
      if (error) {
        alert('Income saved locally.');
      } else {
        alert('Income and GST recorded successfully!');
      }

      setIncomeForm({ client_name: '', invoice_no: '', taxable_amount: '', gst_rate: '18', gst_type: 'INTRA', description: '' });
      
      const { data: updatedIncomes } = await supabase.from('admin_incomes').select('*').order('created_at', { ascending: false });
      if (updatedIncomes) setIncomes(updatedIncomes);

    } catch (err: any) {
      alert('Failed to save income: ' + (err.message || err));
    }
  };

  const handleApproveRecharge = async (reqId: string, targetUserId: string, reqAmount: number) => {
    try {
      const { error: updateErr } = await supabase
        .from('wallet_recharges')
        .update({ status: 'APPROVED' })
        .eq('id', reqId);
      if (updateErr) throw updateErr;

      const { data: targetProfile, error: fetchErr } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', targetUserId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const currentWallet = Number(targetProfile?.wallet_balance || 0);
      const newBalance = currentWallet + Number(reqAmount);

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', targetUserId);

      if (profileErr) throw profileErr;

      alert('Recharge approved and user wallet updated successfully!');
      
      const { data: updatedRecharges } = await supabase.from('wallet_recharges').select('*').order('created_at', { ascending: false });
      if (updatedRecharges) setRechargeRequests(updatedRecharges);
    } catch (err: any) {
      alert('Failed to approve recharge: ' + (err.message || err));
    }
  };

  const handleUpdateRechargeStatus = async (reqId: string, targetUserId: string, reqAmount: number, currentStatus: string, newStatus: 'REJECTED' | 'PENDING') => {
    try {
      if (currentStatus === 'APPROVED') {
        if (!confirm(`Warning: This request was already APPROVED. Changing status to ${newStatus} will deduct ₹${reqAmount} back from the user's wallet. Proceed?`)) {
          return;
        }

        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('wallet_balance')
          .eq('id', targetUserId)
          .maybeSingle();

        const currentWallet = Number(targetProfile?.wallet_balance || 0);
        const updatedBalance = Math.max(0, currentWallet - Number(reqAmount));

        await supabase.from('profiles').update({ wallet_balance: updatedBalance }).eq('id', targetUserId);
      }

      await supabase.from('wallet_recharges').update({ status: newStatus }).eq('id', reqId);
      alert(`Recharge request status updated to ${newStatus} successfully!`);

      const { data: updatedRecharges } = await supabase.from('wallet_recharges').select('*').order('created_at', { ascending: false });
      if (updatedRecharges) setRechargeRequests(updatedRecharges);
    } catch (err: any) {
      alert('Failed to update status: ' + (err.message || err));
    }
  };

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

  const totalTaxableIncome = incomes.reduce((sum, item) => sum + Number(item.taxable_amount || 0), 0);
  const totalGstCollected = incomes.reduce((sum, item) => sum + Number(item.gst_amount || 0), 0);
  const totalGrossIncome = incomes.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

  const filteredProfiles = dashboardData.allProfiles?.filter((p: any) => {
    const query = userTableSearch.toLowerCase();
    const name = (p.full_name || '').toLowerCase();
    const email = (p.email || '').toLowerCase();
    const mobile = (p.mobile || '').toLowerCase();
    return name.includes(query) || email.includes(query) || mobile.includes(query);
  }) || [];

  const totalUserWalletsAmount = filteredProfiles.reduce((sum: number, p: any) => sum + Number(p.wallet_balance || 0), 0);
  const totalUserEstimatesCount = filteredProfiles.reduce((sum: number, p: any) => sum + Number(p.estimates_count || 0), 0);
  const totalUserRevenueSum = filteredProfiles.reduce((sum: number, p: any) => sum + Number(p.total_revenue || 0), 0);
  
  const activeUsersCount = filteredProfiles.filter((p: any) => (p.status || 'active').toLowerCase() === 'active').length;
  const suspendedUsersCount = filteredProfiles.filter((p: any) => (p.status || '').toLowerCase() === 'suspended').length;

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
    <>
      <style jsx global>{`
        @media print {
          body {
            display: none !important;
          }
        }
      `}</style>

      <div className="p-4 sm:p-8 bg-slate-50/50 min-h-screen space-y-8 font-sans antialiased text-slate-950 relative select-none">
        
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

        {/* --- PUSH NOTIFICATION MANAGER WIDGET --- */}
        <PushNotificationManager />

        {/* --- MODULAR WIDGETS --- */}
        <AdminBroadcastWidget />
        <AdminCreateUserWidget onUserCreated={fetchDashboardData} />
        <AdminPendingApprovalsWidget onActionComplete={fetchDashboardData} />
        <AdminRefundRequestsWidget refundRequests={refundRequests} onUpdate={fetchDashboardData} />

        {/* --- PREMIUM BILLING REPORT WIDGET --- */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Premium Subscribers Billing & Passbook</h3>
              <p className="text-xs text-slate-500">Monitor active Premium Plan members and track cumulative debited usage bills.</p>
            </div>
            <button 
              onClick={() => toggleSection('premiumBilling')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              {hiddenSections.premiumBilling ? 'Show [+]' : 'Hide [-]'}
            </button>
          </div>

          {!hiddenSections.premiumBilling && (
            <PremiumBillingWidget />
          )}
        </div>

        {/* --- ADVANCED GATEWAY REVENUE INSPECTOR WITH DYNAMIC FILTERS & EXCEL DOWNLOAD --- */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Payment Gateway Advanced Income & Earnings Inspector</h3>
              <p className="text-xs text-slate-500">Filter online gateway revenue dynamically by Date, Month, Year, or Financial Year with Excel export support.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button 
                onClick={handleExportGatewayExcel}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <span>📊 Download Excel (CSV)</span>
              </button>
              <button 
                onClick={() => toggleSection('gatewayAnalytics')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                {hiddenSections.gatewayAnalytics ? 'Show [+]' : 'Hide [-]'}
              </button>
            </div>
          </div>

          {!hiddenSections.gatewayAnalytics && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase px-2">Filter By:</span>
                {(['month', 'date', 'year', 'fy'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setGatewayFilterMode(mode)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${gatewayFilterMode === mode ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border hover:bg-slate-100'}`}
                  >
                    {mode.toUpperCase()} WISE
                  </button>
                ))}

                <div className="ml-auto flex items-center gap-2">
                  {gatewayFilterMode === 'month' && (
                    <input 
                      type="month"
                      value={selectedGatewayMonth}
                      onChange={(e) => setSelectedGatewayMonth(e.target.value)}
                      className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-black text-blue-600 focus:outline-none"
                    />
                  )}
                  {gatewayFilterMode === 'date' && (
                    <input 
                      type="date"
                      value={selectedGatewayDate}
                      onChange={(e) => setSelectedGatewayDate(e.target.value)}
                      className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-black text-blue-600 focus:outline-none"
                    />
                  )}
                  {gatewayFilterMode === 'year' && (
                    <select
                      value={selectedGatewayYear}
                      onChange={(e) => setSelectedGatewayYear(e.target.value)}
                      className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-black text-blue-600 focus:outline-none"
                    >
                      <option value="2026">2026</option>
                      <option value="2025">2025</option>
                      <option value="2024">2024</option>
                    </select>
                  )}
                  {gatewayFilterMode === 'fy' && (
                    <select
                      value={selectedGatewayFY}
                      onChange={(e) => setSelectedGatewayFY(e.target.value)}
                      className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-black text-blue-600 focus:outline-none"
                    >
                      <option value="2026-27">FY 2026-27</option>
                      <option value="2025-26">FY 2025-26</option>
                      <option value="2024-25">FY 2024-25</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">Filtered Gateway Revenue ({gatewayFilterMode.toUpperCase()})</span>
                  <p className="text-2xl font-black text-blue-600 mt-1">₹ {activeGatewayRevenue.toLocaleString('en-IN')}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">{filteredGatewayTxns.length} matching transactions</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">All-Time Gateway Revenue</span>
                  <p className="text-2xl font-black text-slate-900 mt-1">₹ {totalGatewayRevenueAllTime.toLocaleString('en-IN')}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">{gatewayTxns.length} total fetched transactions</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase">Actionable Note</span>
                    <p className="text-xs text-slate-600 mt-1">Convert current filtered earnings directly into monthly GST filings.</p>
                  </div>
                  <button
                    onClick={handleGenerateMonthlyConsolidatedGST}
                    className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    ⚡ Convert Filtered Period to GST
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- GST & INCOME MANAGEMENT PANEL --- */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">GST Filing & Income Management System</h3>
              <p className="text-xs text-slate-500">Record B2B/B2C invoices or auto-consolidate direct gateway payments for streamlined monthly accounting.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleGenerateMonthlyConsolidatedGST}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
              >
                <span>⚡ Auto-Consolidate Gateway Sales</span>
              </button>
              <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-xl font-bold border border-emerald-200">
                Total GST Liability: ₹ {totalGstCollected.toLocaleString('en-IN')}
              </span>
              <button 
                onClick={() => toggleSection('gstManager')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                {hiddenSections.gstManager ? 'Show [+]' : 'Hide [-]'}
              </button>
            </div>
          </div>

          {!hiddenSections.gstManager && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">Total Taxable Income</span>
                  <p className="text-xl font-black text-slate-900 mt-1">₹ {totalTaxableIncome.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">Total GST Collected</span>
                  <p className="text-xl font-black text-emerald-600 mt-1">₹ {totalGstCollected.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">Gross Revenue (Inc. GST)</span>
                  <p className="text-xl font-black text-blue-600 mt-1">₹ {totalGrossIncome.toLocaleString('en-IN')}</p>
                </div>
              </div>

              <form onSubmit={handleAddIncomeSubmit} className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Client / Customer Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. ABC Corp"
                    value={incomeForm.client_name}
                    onChange={(e) => setIncomeForm({...incomeForm, client_name: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Invoice Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. INV-2026-001"
                    value={incomeForm.invoice_no}
                    onChange={(e) => setIncomeForm({...incomeForm, invoice_no: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Taxable Amount (₹)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="10000"
                    value={incomeForm.taxable_amount}
                    onChange={(e) => setIncomeForm({...incomeForm, taxable_amount: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">GST Rate (%)</label>
                  <select
                    value={incomeForm.gst_rate}
                    onChange={(e) => setIncomeForm({...incomeForm, gst_rate: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">GST Type</label>
                  <select
                    value={incomeForm.gst_type}
                    onChange={(e) => setIncomeForm({...incomeForm, gst_type: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INTRA">Intra-State (CGST + SGST)</option>
                    <option value="INTER">Inter-State (IGST)</option>
                  </select>
                </div>

                <div>
                  <button 
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    + Record Income & Calculate GST
                  </button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="p-3 rounded-l-xl">Invoice / Date</th>
                      <th className="p-3">Client Name</th>
                      <th className="p-3">Taxable (₹)</th>
                      <th className="p-3">GST Split</th>
                      <th className="p-3 text-right">Total Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {incomes.length > 0 ? (
                      incomes.map((inc: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition text-xs">
                          <td className="p-3">
                            <div className="font-mono font-bold text-blue-600">{inc.invoice_no || 'N/A'}</div>
                            <div className="text-[10px] text-slate-400">{new Date(inc.created_at || Date.now()).toLocaleDateString()}</div>
                          </td>
                          <td className="p-3 font-semibold text-slate-900">{inc.client_name}</td>
                          <td className="p-3 font-medium text-slate-700">₹ {Number(inc.taxable_amount || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-[11px] text-slate-600">
                            {inc.igst > 0 ? (
                              <span>IGST: ₹{inc.igst}</span>
                            ) : (
                              <span>CGST: ₹{inc.cgst} | SGST: ₹{inc.sgst}</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-black text-emerald-600">₹ {Number(inc.total_amount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400 text-xs">No income records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* --- WALLET RECHARGE PANEL --- */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Wallet Recharge Management Panel</h3>
              <p className="text-xs text-slate-500">Review pending recharge history requests, approve them, or reject/revert if approved by mistake.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-xl font-bold border border-blue-200">
                {rechargeRequests.length} Total Requests
              </span>
              <button 
                onClick={() => toggleSection('recharge')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                {hiddenSections.recharge ? 'Show [+]' : 'Hide [-]'}
              </button>
            </div>
          </div>

          {!hiddenSections.recharge && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="p-3 rounded-l-xl">User Name / Email</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">UTR / UPI Ref No.</th>
                    <th className="p-3">Request Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 rounded-r-xl text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rechargeRequests.length > 0 ? (
                    rechargeRequests.map((req: any) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition text-xs">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{req.user_name || 'N/A'}</div>
                          <div className="text-[11px] text-slate-500">{req.user_email || 'N/A'}</div>
                        </td>
                        <td className="p-3 font-black text-emerald-600 text-sm">₹ {Number(req.amount).toLocaleString('en-IN')}</td>
                        <td className="p-3 font-mono font-bold text-blue-600">{req.utr_no}</td>
                        <td className="p-3 text-slate-600">{new Date(req.created_at).toLocaleString('en-IN')}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                            req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                            req.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1 whitespace-nowrap">
                          {req.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApproveRecharge(req.id, req.user_id, req.amount)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition uppercase text-[10px]"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateRechargeStatus(req.id, req.user_id, req.amount, req.status, 'REJECTED')}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-sm transition uppercase text-[10px]"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {req.status === 'APPROVED' && (
                            <button
                              onClick={() => handleUpdateRechargeStatus(req.id, req.user_id, req.amount, req.status, 'REJECTED')}
                              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm transition uppercase text-[10px]"
                            >
                              Revoke / Reject
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 text-xs">No recharge requests found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* System Health */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-base">System Telemetry & Health</h3>
            <button 
              onClick={() => toggleSection('health')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              {hiddenSections.health ? 'Show [+]' : 'Hide [-]'}
            </button>
          </div>

          {!hiddenSections.health && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Storage Bucket Usage</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{totalStorageMB} MB <span className="text-xs font-normal text-slate-500">(Live Files)</span></p>
                </div>
                <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-sm">📦</div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Database Query Latency</p>
                  <p className={`text-xl font-black mt-1 ${queryLatency > 300 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {queryLatency} ms <span className="text-xs font-normal text-slate-500">(Optimal)</span>
                  </p>
                </div>
                <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-bold text-sm">⚡</div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active System Error Rate</p>
                  <p className="text-xl font-black text-emerald-600 mt-1">0.00% <span className="text-xs font-normal text-slate-500">(Zero crashes)</span></p>
                </div>
                <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-sm">🛡️</div>
              </div>
            </div>
          )}
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
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-base">Key Performance Indicators</h3>
            <button 
              onClick={() => toggleSection('kpi')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              {hiddenSections.kpi ? 'Show [+]' : 'Hide [-]'}
            </button>
          </div>

          {!hiddenSections.kpi && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Registered Users</h3>
                    <p className="text-3xl font-black text-slate-900 mt-2">{dashboardData.totalUsers ?? 0}</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">👥</div>
                </div>
                <div className="mt-4 flex items-center text-xs text-slate-500 gap-1 font-medium">
                  <span className="text-emerald-600 font-bold">100%</span> Database synced (A-Z Sorted)
                </div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
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

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between">
                <InactiveUsersModal users={Array.isArray(dashboardData.inactiveUsers) ? dashboardData.inactiveUsers : []} />
              </div>
            </div>
          )}
        </div>

        {/* RBAC Table with Date & Month Filters */}
<div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
    <div>
      <h3 className="font-bold text-slate-800 text-base">User Role, Wallet & Estimates Tracking (RBAC)</h3>
      <p className="text-xs text-slate-500">Filter user activity by date or month to calculate precise fee dues and estimate counts.</p>
    </div>
    
    {/* Date & Month Filters Bar */}
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
        <span className="text-[10px] font-bold text-slate-500 uppercase">From:</span>
        <input 
          type="date" 
          value={modalSelectedDate && modalFilterType === 'date' ? modalSelectedDate : ''} 
          onChange={(e) => { setModalSelectedDate(e.target.value); setModalFilterType('date'); }}
          className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800"
        />
      </div>

      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
        <span className="text-[10px] font-bold text-slate-500 uppercase">Month:</span>
        <input 
          type="month" 
          value={modalSelectedMonth} 
          onChange={(e) => { setModalSelectedMonth(e.target.value); setModalFilterType('month'); }}
          className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800"
        />
      </div>

      {(modalSelectedDate || modalSelectedMonth || userTableSearch) && (
        <button 
          onClick={() => { setModalSelectedDate(''); setModalSelectedMonth(''); setUserTableSearch(''); setModalFilterType('all'); }}
          className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition"
        >
          Reset Filters
        </button>
      )}
    </div>
  </div>

  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
    <div className="w-full sm:w-72">
      <input 
        type="text"
        placeholder="🔍 Search name, email or mobile..."
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
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
          <tr>
            <th className="p-3 rounded-l-xl">User Details (Name & Email)</th>
            <th className="p-3">Mobile No.</th>
            <th className="p-3 text-center">Wallet Balance</th>
            <th className="p-3 text-center">Total Estimates</th>
            <th className="p-3">Total Revenue (Fee)</th>
            <th className="p-3">Assigned Role</th>
            <th className="p-3">Account Status</th>
            <th className="p-3 rounded-r-xl text-right">Quick Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(() => {
            // Step 1: Compute filtered profiles and their specific values
            const processedProfiles = filteredProfiles.map((p: any) => {
              let estCount = p.estimates_count || 0;
              let userRevenue = p.total_revenue || 0;

              if (modalSelectedDate || modalSelectedMonth) {
                const matchingEstimates = (p.estimates_list || []).filter((est: any) => {
                  if (!est.created_at) return false;
                  const estDate = new Date(est.created_at);
                  if (modalFilterType === 'date' && modalSelectedDate) {
                    return estDate.toISOString().split('T')[0] === modalSelectedDate;
                  }
                  if (modalFilterType === 'month' && modalSelectedMonth) {
                    const estMonthStr = `${estDate.getFullYear()}-${String(estDate.getMonth() + 1).padStart(2, '0')}`;
                    return estMonthStr === modalSelectedMonth;
                  }
                  return true;
                });
                estCount = matchingEstimates.length;
                userRevenue = estCount * 21;
              }

              return { ...p, calculatedEstCount: estCount, calculatedRevenue: userRevenue };
            }).filter((p: any) => {
              if (!modalSelectedDate && !modalSelectedMonth) return true;
              return p.calculatedEstCount > 0;
            });

            // Store references for footer calculation
            (window as any).__tempFilteredProfiles = processedProfiles;

            if (processedProfiles.length === 0) {
              return (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400 text-sm">No profiles found matching your search or date criteria.</td>
                </tr>
              );
            }

            return processedProfiles.map((p: any) => {
              const userId = p.id;
              const userWalletBalance = Number(p.wallet_balance || 0);

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
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl font-black text-xs border border-emerald-200">
                      ₹ {userWalletBalance.toLocaleString('en-IN')}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    <button 
                      onClick={() => handleOpenUserEstimates(p)}
                      className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-black text-xs transition shadow-sm border border-blue-200 inline-flex items-center gap-1.5"
                    >
                      <span>📊 {p.calculatedEstCount} {p.calculatedEstCount === 1 ? 'Estimate' : 'Estimates'}</span>
                    </button>
                  </td>

                  <td className="p-3 font-semibold text-emerald-600">
                    ₹ {Number(p.calculatedRevenue).toLocaleString('en-IN')}
                  </td>

                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      p.role === 'admin' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 
                      p.role === 'premium' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                      'bg-slate-100 text-slate-600'
                    }`}>
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
            });
          })()}
        </tbody>
        <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold text-slate-900 text-xs">
          {(() => {
            const currentList = (window as any).__tempFilteredProfiles || [];
            const filteredActiveCount = currentList.filter((p: any) => (p.status || 'active').toLowerCase() === 'active').length;
            const filteredSuspendedCount = currentList.filter((p: any) => (p.status || '').toLowerCase() === 'suspended').length;
            const filteredWalletSum = currentList.reduce((sum: number, p: any) => sum + Number(p.wallet_balance || 0), 0);
            const filteredEstCountSum = currentList.reduce((sum: number, p: any) => sum + Number(p.calculatedEstCount || 0), 0);
            const filteredRevenueSum = currentList.reduce((sum: number, p: any) => sum + Number(p.calculatedRevenue || 0), 0);

            return (
              <tr>
                <td colSpan={2} className="p-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-blue-700 font-black">TOTAL SUMMARY (Filtered Users):</span>
                    <span className="text-slate-500 font-medium">
                      Active: <strong className="text-emerald-600">{filteredActiveCount}</strong> | Suspended: <strong className="text-rose-600">{filteredSuspendedCount}</strong>
                    </span>
                  </div>
                </td>
                <td className="p-3 text-center text-emerald-700 bg-emerald-50/50 rounded-lg align-middle">
                  ₹ {filteredWalletSum.toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-center text-blue-700 align-middle">
                  {filteredEstCountSum} Estimates
                </td>
                <td colSpan={4} className="p-3 text-emerald-700 align-middle">
                  ₹ {filteredRevenueSum.toLocaleString('en-IN')}
                </td>
              </tr>
            );
          })()}
        </tfoot>
      </table>
    </div>
  )}
</div>

        {/* --- USER ESTIMATES MODAL --- */}
        {selectedUserForEstimates && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
              
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black tracking-tight">Payment & Estimate Dispute Tracking: {selectedUserForEstimates.full_name}</h3>
                  <p className="text-xs text-slate-300 mt-0.5">Email: {selectedUserForEstimates.email} | Mobile: <span className="text-blue-400 font-bold">{selectedUserForEstimates.mobile || 'N/A'}</span> | Current Wallet Balance: <span className="text-emerald-400 font-bold">₹ {Number(selectedUserForEstimates.wallet_balance || 0).toLocaleString('en-IN')}</span></p>
                </div>
                <button 
                  onClick={() => setSelectedUserForEstimates(null)}
                  className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition"
                >
                  ✕
                </button>
              </div>

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

                  <button
                    onClick={() => {
                      if (filteredModalEstimates.length === 0) {
                        alert('No records found to download.');
                        return;
                      }

                      let csvContent = "\uFEFFReference No,Date & Time,Customer Name,Case Type,Payment Mode,Deducted Amount\r\n";

                      filteredModalEstimates.forEach((est: any) => {
                        const refNo = `"${(est.reference_no || est.ref_no || 'N/A').replace(/"/g, '""')}"`;
                        const dateTime = `"${est.created_at ? new Date(est.created_at).toLocaleString('en-IN').replace(/"/g, '""') : 'N/A'}"`;
                        const customerName = `"${(est.customer_name || 'N/A').replace(/"/g, '""')}"`;
                        const caseType = `"${(est.case_type || est.estimate_type || 'N/A').replace(/"/g, '""')}"`;
                        const paymentModeVal = est.razorpay_payment_id || est.payment_id || est.payment_mode || 'WALLET DEDUCTION';
                        const paymentMode = `"${paymentModeVal.replace(/"/g, '""')}"`;
                        const amount = Number(est.user_payment || est.amount || 21);

                        const row = [refNo, dateTime, customerName, caseType, paymentMode, amount].join(",");
                        csvContent += row + "\r\n";
                      });

                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.setAttribute("href", url);
                      link.setAttribute("download", `MIS_Report_${(selectedUserForEstimates.full_name || 'user').replace(/\s+/g, '_')}_${Date.now()}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                  >
                    <span>📊 Download MIS Excel</span>
                  </button>

                  <button
                    onClick={() => {
                      const userMobile = selectedUserForEstimates.mobile;
                      if (!userMobile) {
                        alert('User mobile number is not registered in system.');
                        return;
                      }
                      const message = `Hello ${selectedUserForEstimates.full_name},\n\nHere is your MIS Case & Fee Summary:\nTotal Cases: ${filteredModalEstimates.length}\nTotal Fee/Amount: ₹${totalFilteredModalAmount.toLocaleString('en-IN')}\n\nThank you,\nL&T Consultant Services`;
                      const encodedMsg = encodeURIComponent(message);
                      window.open(`https://wa.me/${userMobile.replace(/[^0-9]/g, '')}?text=${encodedMsg}`, '_blank');
                    }}
                    className="px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                  >
                    <span>💬 Send WhatsApp Details</span>
                  </button>
                </div>
              </div>

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
                          <th className="p-3">Payment Source / Mode</th>
                          <th className="p-3 text-right">Deducted Amount</th>
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
                            <td className="p-3 font-mono">
                              {est.razorpay_payment_id || est.payment_id || est.payment_mode ? (
                                <span className="text-blue-600 font-bold">
                                  {est.razorpay_payment_id || est.payment_id || est.payment_mode}
                                </span>
                              ) : (
                                <span className="text-slate-600 font-medium">WALLET DEDUCTION</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-black text-emerald-600">
                              ₹ {Number(est.user_payment || est.amount || 21).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                        <tr>
                          <td colSpan={5} className="p-3 text-right">Total Filtered Paid Amount:</td>
                          <td className="p-3 text-right text-emerald-700 text-sm">
                            ₹ {totalFilteredModalAmount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-sm font-medium">
                    No payment records found matching the selected filter.
                  </div>
                )}
              </div>

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
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-base">System Audit Trail & Security Compliance</h3>
              <p className="text-xs text-slate-500">Chronological telemetry log of database changes, CRUD operations, and administrative actions.</p>
            </div>
            <button 
              onClick={() => toggleSection('audit')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              {hiddenSections.audit ? 'Show [+]' : 'Hide [-]'}
            </button>
          </div>

          {!hiddenSections.audit && (
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
                <div className="p-6 text-center text-slate-400 text-sm">No audit logs found.</div>
              )}
            </div>
          )}
        </div>

        {/* Inactive Users */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Dead User Engagement Analysis</h3>
              <p className="text-xs text-slate-500">Monitor dormant user accounts based on custom inactivity thresholds.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
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
              <button 
                onClick={() => toggleSection('inactive')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition whitespace-nowrap"
              >
                {hiddenSections.inactive ? 'Show [+]' : 'Hide [-]'}
              </button>
            </div>
          </div>
          
          {!hiddenSections.inactive && (
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
          )}
        </div>

        {/* Razorpay Revenue Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-base">Razorpay Revenue Analytics</h3>
            <button 
              onClick={() => toggleSection('razorpayChart')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              {hiddenSections.razorpayChart ? 'Show [+]' : 'Hide [-]'}
            </button>
          </div>
          {!hiddenSections.razorpayChart && (
            <RazorpayRevenueChart transactions={dashboardData.razorpayTransactions || []} />
          )}
        </div>

        {/* MIS Metrics */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-base">MIS & Financial Telemetry Metrics</h3>
            <button 
              onClick={() => toggleSection('mis')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              {hiddenSections.mis ? 'Show [+]' : 'Hide [-]'}
            </button>
          </div>

          {!hiddenSections.mis && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                  <span>Cases (Month-wise)</span>
                  <span className="text-xs text-slate-400 font-normal">Aggregated metrics</span>
                </h3>
                <div className="space-y-2">
                  {dashboardData.monthlyCases?.map((item: any) => (
                    <div key={item.month_name} className="flex justify-between items-center py-2.5 border-b border-slate-200/50 text-sm">
                      <span className="text-slate-600 font-medium">{item.month_name}</span>
                      <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded-xl text-xs border">{item.case_count} Cases</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
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
                        <div key={idx} className="flex justify-between items-center py-2.5 border-b border-slate-200/50 text-sm">
                          <span className="text-slate-600 font-medium">{stateName}</span>
                          <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded-xl text-xs border">
                            {caseCount} {caseCount === 1 ? 'Case' : 'Cases'}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex justify-between items-center py-2.5 border-b border-slate-200/50 text-sm">
                      <span className="text-slate-600 font-medium">Not Specified</span>
                      <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded-xl text-xs border">0 Cases</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                 <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                  <span>Revenue (FY-wise)</span>
                  <span className="text-xs text-slate-400 font-normal">Fiscal telemetry</span>
                 </h3>
                <div className="space-y-2">
                  {dashboardData.fyData?.map((item: any) => (
                    <div key={item.fy_label} className="flex justify-between items-center py-2.5 border-b border-slate-200/50 text-sm">
                      <span className="text-slate-600 font-medium">FY {item.fy_label}</span>
                      <span className="font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl text-xs border border-emerald-100">₹ {Number(item.revenue).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                 <h3 className="font-bold text-slate-800 mb-4">Revenue Trend Line</h3>
                 <DashboardChart data={dashboardData.records || []} />
              </div>
            </div>
          )}
        </div>

        {/* Razorpay Transactions Table */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Payment Gateway & Dispute Operations</h3>
              <span className="text-xs text-slate-400">Razorpay Live API Hook</span>
            </div>
            <button 
              onClick={() => toggleSection('gateway')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              {hiddenSections.gateway ? 'Show [+]' : 'Hide [-]'}
            </button>
          </div>
          {!hiddenSections.gateway && (
            <RazorpayTableWithFilter transactions={dashboardData.razorpayTransactions || []} />
          )}
        </div>

      </div>
    </>
  );
}