'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AlertCircle, Mail, MessageSquare } from 'lucide-react';

// Sub-components import karein
import MetricsBar from './components/MetricsBar';
import ActionMenu from './components/ActionMenu';
import AuthModal from './components/AuthModal';

interface MISRecord {
  id: string;
  ref_no: string;
  created_date: string;
  customer_name: string;
  client_name: string;
  client?: string;
  representative: string;
  case_type: string;
  fee_standard: number; 
  status: 'Received' | 'Pending' | 'Waived';
  remark: string;
  client_plan_type?: 'BASIC' | 'PREMIUM'; 
  hours_elapsed?: number;
  account_status?: 'ACTIVE' | 'INACTIVE';
  mobile_no?: string;
  email_id?: string;
  estimates?: { user_id: string; }[];
  clients?: { mobile_no?: string; email_id?: string; };
  fee?: number;
}

export default function MISPage() {
  const router = useRouter();
  const menuRef = useRef<any>(null);
  const [records, setRecords] = useState<MISRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [filterRefNo, setFilterRefNo] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterRepresentative, setFilterRepresentative] = useState('');
  const [filterCaseType, setFilterCaseType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [authError, setAuthError] = useState('');
  const [walletBalance, setWalletBalance] = useState<number>(100);

  // Wallet and Data Fetching logic
  useEffect(() => {
    const fetchUserWalletAndData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_balance, role')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setWalletBalance(profile.wallet_balance || 0);
        }

        const isAdmin = profile?.role === 'admin';
        let query = supabase.from('mis_records').select('*');

        if (!isAdmin) {
          query = supabase
            .from('mis_records')
            .select(`*, estimates!inner(user_id)`)
            .eq('estimates.user_id', user.id);
        }

        const { data, error } = await query.order('created_date', { ascending: true });
        if (error) throw error;

        const formattedData = (data || []).map((item: any) => ({
          ...item,
          mobile_no: item.mobile_no || "",
          email_id: item.email_id || ""
        }));

        setRecords(formattedData as MISRecord[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserWalletAndData();
  }, []);

  // Wallet check for Create Entry button
  const handleCreateClick = () => {
    if (walletBalance < 100) {
      alert("Access Denied: Wallet balance is less than ₹100. Please recharge first.");
      return;
    }
    router.push('/estimate');
  };

  // Filter Logic for Ref No & Date
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      const matchRef = (rec.ref_no || "").toLowerCase().includes(filterRefNo.toLowerCase());
      
      let formattedDateStr = "";
      if (rec.created_date) {
        const d = new Date(rec.created_date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        formattedDateStr = `${day}/${month}/${year} ${year}-${month}-${day}`.toLowerCase();
      }
      const matchDate = formattedDateStr.includes(filterDate.toLowerCase());

      const matchClient = (rec.client_name || "").toLowerCase().includes(filterClient.toLowerCase());
      const matchRep = (rec.representative || "").toLowerCase().includes(filterRepresentative.toLowerCase());
      const matchCase = filterCaseType === 'ALL' || (rec.case_type || "").toUpperCase().includes(filterCaseType.toUpperCase());
      const matchStatus = filterStatus === 'ALL' || (rec.status || "").toUpperCase() === filterStatus.toUpperCase();

      return matchRef && matchDate && matchClient && matchRep && matchCase && matchStatus;
    });
  }, [records, filterRefNo, filterDate, filterClient, filterRepresentative, filterCaseType, filterStatus]);

  // Metrics Calculation
  const metrics = useMemo(() => {
    return records.reduce((acc, curr) => {
      const currentStatus = (curr.status || "").toUpperCase();
      const fee = (curr.fee_standard || 0);
      
      acc.total += fee;
      if (currentStatus === 'RECEIVED') acc.received += fee;
      if (currentStatus === 'PENDING') acc.pending += fee;
      if (currentStatus === 'WAIVED') acc.waived += fee;
      
      return acc;
    }, { total: 0, received: 0, pending: 0, waived: 0 });
  }, [records]);

  // --- FUNCTION 1: Update Status ---
  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('mis_records')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setRecords(prev =>
        prev.map(r => (r.id === id ? { ...r, status: newStatus as any } : r))
      );
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  // --- FUNCTION 2: Reopen Case (Fixed & Robust) ---
  const handleReopen = async (record: any) => {
    try {
      let parsedFloorDetails = record.floor_details;
      if (typeof record.floor_details === 'string') {
        try {
          parsedFloorDetails = JSON.parse(record.floor_details);
        } catch (e) {
          parsedFloorDetails = {};
        }
      }

      const currentStatus = (record.status || "").trim().toUpperCase();
      const isPaidAlready = currentStatus === "RECEIVED" || currentStatus === "PAID" || currentStatus === "SUCCESS";

      const reopenData = {
        id: record.id,
        ref_no: record.ref_no,
        customer_name: record.customer_name,
        client_name: record.client_name,
        representative: record.representative,
        case_type: record.case_type,
        estimate_type: record.case_type,
        property_type: record.property_type || "HOUSE",
        total_value: record.fee_standard,
        property_address: record.property_address || "",
        plot_area: record.plot_area || "",
        floor_details: parsedFloorDetails,
        rate_per_sqft: record.rate_per_sqft || 0,
        status: currentStatus,
        isAlreadyPaid: isPaidAlready,
        is_paid: isPaidAlready
      };

      const caseTypeUpper = (record.case_type || "").trim().toUpperCase();
      
      if (caseTypeUpper.includes("RENOVATION")) {
        localStorage.setItem("renovationEstimatePreview", JSON.stringify(reopenData));
        router.push("/renovation-estimate");
      } else {
        localStorage.setItem("estimatePreview", JSON.stringify(reopenData));
        router.push("/estimate");
      }
    } catch (err: any) {
      alert("Failed to reopen case: " + err.message);
    }
  };

  // --- FUNCTION 3: Archive / Delete Trigger ---
  const handleArchive = (id: string) => {
    setRecordToDelete(id);
    setConfirmPassword('');
    setAuthError('');
    setIsAuthModalOpen(true);
  };

  // --- FUNCTION 4: Execute Secure Delete with Password ---
  const executeSecureDelete = async () => {
    if (!recordToDelete) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        setAuthError("User session not found.");
        return;
      }

      const { error: authErrorCheck } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: confirmPassword,
      });

      if (authErrorCheck) {
        setAuthError("Incorrect password. Deletion aborted.");
        return;
      }

      const { error: deleteError } = await supabase
        .from('mis_records')
        .delete()
        .eq('id', recordToDelete);

      if (deleteError) throw deleteError;

      setRecords(prev => prev.filter(r => r.id !== recordToDelete));
      setIsAuthModalOpen(false);
      setRecordToDelete(null);
      setConfirmPassword('');
      alert("Record permanently deleted.");
    } catch (err: any) {
      setAuthError(err.message || "Deletion failed.");
    }
  };

  // --- FUNCTION 5: WhatsApp Broadcast (Advanced Grouping & Loading Protection) ---
  const triggerWhatsAppBroadcast = async () => {
    if (loading) {
      alert("⚠️ Please wait, active engine tables are still syncing...");
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      let loggedInUserName = "Admin / Executive";
      let loggedInUserMobile = "";

      if (user) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name, mobile')
          .eq('id', user.id)
          .maybeSingle();

        if (userProfile) {
          loggedInUserName = userProfile.full_name || "Admin";
          loggedInUserMobile = userProfile.mobile || "";
        }
      }

      let targetRecords = filteredRecords.filter(r => {
        const s = String(r.status || "").trim().toUpperCase();
        return s === 'PENDING' || s === 'FINALIZED' || s === '';
      });

      if (targetRecords.length === 0) {
        targetRecords = records;
      }

      if (targetRecords.length === 0) {
        alert("⚠️ No records found in the database to broadcast!");
        setLoading(false);
        return;
      }

      const groupedMap: { [key: string]: any[] } = {};

      targetRecords.forEach(record => {
        const clientGroupKey = record.client_name || record.customer_name || record.client || "Valued Client";
        const repName = record.representative || "General";
        const groupKey = `${clientGroupKey}_|_${repName}`;

        if (!groupedMap[groupKey]) {
          groupedMap[groupKey] = [];
        }
        groupedMap[groupKey].push(record);
      });

      let broadcastCount = 0;
      let emailFallbackCount = 0;

      for (const groupKey of Object.keys(groupedMap)) {
        const [clientName, repName] = groupKey.split('_|_');
        const recordsGroup = groupedMap[groupKey];
        
        let targetMobile = "";
        let targetEmail = "";

        for (const rec of recordsGroup) {
          if (rec.mobile_no) targetMobile = rec.mobile_no;
          if (rec.email_id) targetEmail = rec.email_id;
          if (targetMobile && targetEmail) break;
          
          if (rec.clients?.mobile_no) targetMobile = rec.clients.mobile_no;
          if (rec.clients?.email_id) targetEmail = rec.clients.email_id;
        }

        if ((!targetMobile || !targetEmail) && clientName !== "Valued Client") {
          try {
            const { data: clientDbData } = await supabase
              .from('clients')
              .select('mobile_no, email_id')
              .ilike('client_name', `%${clientName}%`)
              .maybeSingle();

            if (clientDbData) {
              if (!targetMobile && clientDbData.mobile_no) targetMobile = clientDbData.mobile_no;
              if (!targetEmail && clientDbData.email_id) targetEmail = clientDbData.email_id;
            }
          } catch (e) {}
        }

        let totalPendingFee = 0;
        recordsGroup.forEach(rec => {
          const fee = parseFloat(String(rec.fee_standard || rec.fee || 0));
          if (!isNaN(fee)) totalPendingFee += fee;
        });

        let message = `Hello ${clientName} ${repName},\n\n`;
        message += `Here is the summary of your cases (${repName}):\n\n`;
        
        message += `REF NO | DATE | CUSTOMER | TYPE | FEE | STATUS\n`;
        message += `--------------------------------------------------\n`;

        recordsGroup.forEach((rec, index) => {
          const ref = rec.ref_no || 'N/A';
          const date = rec.created_date ? new Date(rec.created_date).toLocaleDateString('en-GB') : 'N/A';
          const customer = rec.customer_name || 'N/A';
          const type = rec.case_type || 'Standard';
          const fee = rec.fee_standard || rec.fee || 0;
          const status = rec.status || 'Pending';
          
          message += `${index + 1}. ${ref} | ${date} | ${customer} | ${type} | ₹${fee} | ${status}\n`;
        });

        message += `--------------------------------------------------\n`;
        message += `Total Cases: ${recordsGroup.length}\n`;
        message += `Total Amount: ₹${totalPendingFee.toLocaleString('en-IN')}\n\n`;
        message += `Please review and clear dues.\n\n`;
        message += `Regards,\n${loggedInUserName}`;
        if (loggedInUserMobile) message += `\n📞 ${loggedInUserMobile}`;

        const cleanMobile = String(targetMobile || "").replace(/\D/g, '');

        if (cleanMobile.length >= 10) {
          const encodedMessage = encodeURIComponent(message);
          window.open(`https://wa.me/91${cleanMobile}?text=${encodedMessage}`, '_blank');
          broadcastCount++;
        } else if (targetEmail && targetEmail.includes('@')) {
          const emailSubject = encodeURIComponent(`Cases Summary - ${clientName}`);
          const emailBody = encodeURIComponent(message);
          window.open(`mailto:${targetEmail}?subject=${emailSubject}&body=${emailBody}`, '_blank');
          emailFallbackCount++;
        }
      }

      if (broadcastCount > 0 || emailFallbackCount > 0) {
        alert(`✅ Broadcast sent successfully!\n- WhatsApp opened: ${broadcastCount}\n- Email fallback opened: ${emailFallbackCount}`);
      } else {
        alert("⚠️ No valid mobile numbers or emails found in the records to broadcast. Please ensure your records contain 'mobile_no' or 'email_id'.");
      }

    } catch (error: any) {
      alert("An error occurred during WhatsApp broadcast.");
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCTION 6: Email Broadcast (Advanced Grouping & Loading Protection) ---
  const triggerEmailBroadcast = async () => {
    if (loading) {
      alert("⚠️ Please wait, active engine tables are still syncing...");
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      let loggedInUserName = "Admin / Executive";
      let loggedInUserEmail = "";
      let loggedInUserMobile = "";

      if (user) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name, mobile, email')
          .eq('id', user.id)
          .maybeSingle();

        if (userProfile) {
          loggedInUserName = userProfile.full_name || "Admin";
          loggedInUserEmail = userProfile.email || user.email || "";
          loggedInUserMobile = userProfile.mobile || "";
        }
      }

      let targetRecords = filteredRecords.filter(r => {
        const s = String(r.status || "").trim().toUpperCase();
        return s === 'PENDING' || s === 'FINALIZED' || s === '';
      });

      if (targetRecords.length === 0) {
        targetRecords = records;
      }

      if (targetRecords.length === 0) {
        alert("⚠️ No records found in the database to broadcast!");
        setLoading(false);
        return;
      }

      const groupedMap: { [key: string]: any[] } = {};

      targetRecords.forEach(record => {
        const clientGroupKey = record.client_name || record.customer_name || record.client || "Valued Client";
        const repName = record.representative || "General";
        const groupKey = `${clientGroupKey}_|_${repName}`;

        if (!groupedMap[groupKey]) {
          groupedMap[groupKey] = [];
        }
        groupedMap[groupKey].push(record);
      });

      let emailCount = 0;

      for (const groupKey of Object.keys(groupedMap)) {
        const [clientName, repName] = groupKey.split('_|_');
        const recordsGroup = groupedMap[groupKey];
        
        let targetEmail = "";

        for (const rec of recordsGroup) {
          if (rec.email_id) { targetEmail = rec.email_id; break; }
          if (rec.clients?.email_id) { targetEmail = rec.clients.email_id; break; }
        }

        if (!targetEmail && clientName !== "Valued Client") {
          try {
            const { data: clientDbData } = await supabase
              .from('clients')
              .select('email_id')
              .ilike('client_name', `%${clientName}%`)
              .maybeSingle();

            if (clientDbData?.email_id) targetEmail = clientDbData.email_id;
          } catch (e) {}
        }

        if (!targetEmail || !targetEmail.includes('@')) continue;

        let totalPendingFee = 0;
        recordsGroup.forEach(rec => {
          const fee = parseFloat(String(rec.fee_standard || rec.fee || 0));
          if (!isNaN(fee)) totalPendingFee += fee;
        });

        let emailBody = `Hello ${clientName},\n\n`;
        emailBody += `Here is the summary of your cases (Representative: ${repName}):\n\n`;
        
        emailBody += `REF NO | DATE | CUSTOMER | TYPE | FEE | STATUS\n`;
        emailBody += `--------------------------------------------------\n`;

        recordsGroup.forEach((rec, index) => {
          const ref = rec.ref_no || 'N/A';
          const date = rec.created_date ? new Date(rec.created_date).toLocaleDateString('en-GB') : 'N/A';
          const customer = rec.customer_name || 'N/A';
          const type = rec.case_type || 'Standard';
          const fee = rec.fee_standard || rec.fee || 0;
          const status = rec.status || 'Pending';
          
          emailBody += `${index + 1}. ${ref} | ${date} | ${customer} | ${type} | ₹${fee} | ${status}\n`;
        });

        emailBody += `--------------------------------------------------\n`;
        emailBody += `Total Cases: ${recordsGroup.length}\n`;
        emailBody += `Total Amount: ₹${totalPendingFee.toLocaleString('en-IN')}\n\n`;
        emailBody += `Please review and clear dues.\n\n`;
        emailBody += `Regards,\n${loggedInUserName}`;
        if (loggedInUserMobile) emailBody += `\n📞 ${loggedInUserMobile}`;
        if (loggedInUserEmail) emailBody += `\n✉️ ${loggedInUserEmail}`;

        const emailSubject = `Cases Summary - ${clientName} (${repName})`;

        const choice = window.prompt(
          `Recipient Email: ${targetEmail}\n\nChoose your email client:\nType 'gmail' for Google Gmail\nType 'outlook' for Microsoft Outlook\n(Click 'Cancel' to skip)`,
          'gmail'
        );

        if (!choice) continue;

        let emailUrl = "";
        const lowerChoice = choice.trim().toLowerCase();

        if (lowerChoice.includes('gmail')) {
          emailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        } else {
          emailUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(targetEmail)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        }

        window.open(emailUrl, '_blank');
        emailCount++;
      }

      if (emailCount > 0) {
        alert(`✅ Email composer opened successfully for ${emailCount} recipient(s)!`);
      } else {
        alert("⚠️ No valid email IDs found in the records to broadcast.");
      }

    } catch (error: any) {
      alert("An error occurred while generating the email broadcast.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto p-2 bg-slate-50 min-h-screen">
      
      {/* Header Panel */}
      <div className="flex items-center justify-between bg-white px-5 py-3 rounded border border-slate-200 shadow-xs">
        <h1 className="text-sm font-black tracking-wider text-slate-800 uppercase">MIS Analytics Engine</h1>
        <div className="flex gap-2">
          <button onClick={triggerWhatsAppBroadcast} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium text-xs flex items-center gap-2">
            💬 WHATSAPP BROADCAST
          </button>
          <button onClick={triggerEmailBroadcast} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-xs flex items-center gap-2">
            ✉️ EMAIL BROADCAST
          </button>
          <button onClick={handleCreateClick} className="bg-blue-950 hover:bg-slate-900 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded transition-all tracking-wider">
            + Create Entry
          </button>
        </div>
      </div>

      {/* Metrics Performance Bar Component */}
      <MetricsBar metrics={metrics} />

      {/* Embedded Dynamic Table Matrix */}
      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[1300px]">
            <thead>
              <tr className="bg-blue-950 text-white text-[11px] font-extrabold tracking-wider uppercase border-b border-blue-900">
                <th className="p-2 border-r border-blue-900 w-[14%] text-center">
                  <input 
                    type="text" 
                    value={filterRefNo} 
                    onChange={e => setFilterRefNo(e.target.value)} 
                    placeholder="REF NO" 
                    className="w-full bg-transparent placeholder-blue-200/60 text-white uppercase text-[11px] font-black focus:outline-none tracking-wider text-center" 
                  />
                </th>

                <th className="p-2 border-r border-blue-900 w-[10%] text-center">
                  <input 
                    type="text" 
                    value={filterDate} 
                    onChange={e => setFilterDate(e.target.value)} 
                    placeholder="DATE (DD/MM)" 
                    className="w-full bg-transparent placeholder-blue-200/60 text-white uppercase text-[11px] font-black focus:outline-none tracking-wider text-center" 
                  />
                </th>

                <th className="p-3 border-r border-blue-900 w-[16%] text-center">CUSTOMER NAME</th>
                
                <th className="p-2 border-r border-blue-900 w-[13%] text-center">
                  <input 
                    type="text" 
                    value={filterClient} 
                    onChange={e => setFilterClient(e.target.value)} 
                    placeholder="CLIENT" 
                    className="w-full bg-transparent placeholder-blue-200/60 text-white uppercase text-[10px] font-black focus:outline-none tracking-wider text-center" 
                  />
                </th>
                
                <th className="p-2 border-r border-blue-900 w-[13%] text-center">
                  <input 
                    type="text" 
                    value={filterRepresentative} 
                    onChange={e => setFilterRepresentative(e.target.value)} 
                    placeholder="REPRESENTATIVE" 
                    className="w-full bg-transparent placeholder-blue-200/60 text-white uppercase text-[11px] font-black focus:outline-none tracking-wider text-center" 
                  />
                </th>

                <th className="p-2 border-r border-blue-900 w-[12%] text-center">
                  <select 
                    value={filterCaseType} 
                    onChange={e => setFilterCaseType(e.target.value)} 
                    className="w-full bg-transparent text-white font-black text-[11px] uppercase focus:outline-none cursor-pointer text-center border-none" 
                    style={{ textAlignLast: 'center' }}
                  >
                    <option value="ALL" className="text-slate-900 font-bold">CASE TYPE</option>
                    <option value="Construction" className="text-slate-900 font-bold">NEW CONSTRUCTION</option>
                    <option value="Renovation" className="text-slate-900 font-bold">RENOVATION</option>
                    <option value="Route" className="text-slate-900 font-bold">ROUTE MAP</option>
                  </select>
                </th>

                <th className="p-3 border-r border-blue-900 w-[9%] text-center">FEE STANDARD</th>

                <th className="p-2 border-r border-blue-900 w-[12%] text-center">
                  <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)} 
                    className="w-full bg-transparent text-white font-black text-[11px] uppercase focus:outline-none cursor-pointer text-center border-none"
                  >
                    <option value="ALL" className="text-slate-900 font-bold">STATUS</option>
                    <option value="PENDING" className="text-slate-900 font-bold">PENDING</option>
                    <option value="RECEIVED" className="text-slate-900 font-bold">RECEIVED</option>
                    <option value="WAIVED" className="text-slate-900 font-bold">WAIVED</option>
                  </select>
                </th>

                <th className="p-3 w-[10%] text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700 text-[11px] font-bold bg-white">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-6 text-slate-400">Syncing active engine tables...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-7 text-slate-400 font-medium">
                    <div className="flex flex-col items-center gap-1 justify-center"><AlertCircle size={16} /><span>No logs match current search fields.</span></div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const cleanName = (rec.customer_name || "").split(/s\/o|d\/o|w\/o/i)[0].replace(/[,.-]+$/, "").trim().toUpperCase();
                  return (
                    <tr key={rec.id} className="border-b hover:bg-slate-50 transition-all text-[11px] font-bold whitespace-nowrap uppercase">
                      <td className="p-2 font-mono text-blue-700">{rec.ref_no}</td>
                      <td className="p-2 text-slate-500 text-center">{rec.created_date ? new Date(rec.created_date).toLocaleDateString('en-GB') : "-"}</td>
                      <td className="p-2 text-slate-900">
                        <div className="flex flex-col">
                          <span>{cleanName}</span>
                          <div className="flex gap-2 mt-1">
                            {rec.mobile_no && <a href={`https://wa.me/91${rec.mobile_no}`} target="_blank" className="text-emerald-600"><MessageSquare size={12} /></a>}
                            {rec.email_id && <a href={`mailto:${rec.email_id}`} className="text-blue-600"><Mail size={12} /></a>}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-slate-800 text-center">{rec.client_name ? rec.client_name.substring(0, 10).toUpperCase() : "N/A"}</td>
                      <td className="p-2 text-slate-600 text-center">{rec.representative ? rec.representative.toUpperCase() : "N/A"}</td>
                      <td className="p-2 text-slate-900 text-center">{rec.case_type ? rec.case_type.toUpperCase() : "N/A"}</td>
                      <td className="p-2 text-center">₹{(rec.fee_standard || 0).toLocaleString('en-IN')}</td>
                      <td className="p-2 text-center">
                        <select 
                          value={(rec.status || 'PENDING').toUpperCase()} 
                          onChange={(e) => updateStatus(String(rec.id), e.target.value)}
                          className={`px-2 py-1.5 rounded font-black uppercase text-[10px] cursor-pointer outline-none border ${
                            (rec.status || '').toUpperCase() === 'RECEIVED' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 
                            (rec.status || '').toUpperCase() === 'WAIVED' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                            'bg-red-100 text-red-600 border-red-200'
                          }`}
                        >
                          <option value="PENDING" className="text-red-600 font-bold bg-white">PENDING</option>
                          <option value="RECEIVED" className="text-emerald-600 font-bold bg-white">RECEIVED</option>
                          <option value="WAIVED" className="text-slate-600 font-bold bg-white">WAIVED</option>
                        </select>
                      </td>
                      
                      {/* Action Menu Component */}
                      <ActionMenu 
                        rec={rec}
                        activeMenuId={activeMenuId}
                        setActiveMenuId={setActiveMenuId}
                        handleReopen={handleReopen}
                        handleArchive={handleArchive}
                      />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Auth Modal Component */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        setIsOpen={setIsAuthModalOpen}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        authError={authError}
        executeSecureDelete={executeSecureDelete}
      />
    </div>
  );
}