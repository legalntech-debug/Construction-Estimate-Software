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
  floor_details?: any;
  property_type?: string;
  property_address?: string;
  plot_area?: string;
  rate_per_sqft?: number;
  source_table?: 'mis_records' | 'service_records'; // Kis table se data aaya hai track karne ke liye
  record_category?: 'ESTIMATE' | 'SERVICE'; // Category differentiate karne ke liye
}

export default function MISPage() {
  const router = useRouter();
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

        // 1. Fetch Estimate Data from 'mis_records'
        let misQuery = supabase.from('mis_records').select('*');
        if (!isAdmin) {
          misQuery = supabase
            .from('mis_records')
            .select(`*, estimates!inner(user_id)`)
            .eq('estimates.user_id', user.id);
        }
        const { data: misData, error: misError } = await misQuery;
        if (misError) throw misError;

        // 2. Fetch Service/Deed Data from 'service_records'
        let serviceQuery = supabase.from('service_records').select('*');
        if (!isAdmin) {
          serviceQuery = serviceQuery.eq('user_id', user.id);
        }
        const { data: serviceData, error: serviceError } = await serviceQuery;
        if (serviceError) throw serviceError;

        // 3. Format and tag Estimate Records (`mis_records`)
        const formattedEstimates = (misData || []).map((item: any) => ({
          ...item,
          source_table: 'mis_records' as const,
          record_category: 'ESTIMATE' as const,
          case_type: item.case_type || 'Estimate Case',
          mobile_no: item.mobile_no || "",
          email_id: item.email_id || ""
        }));

       // 4. Format and tag Service Records (`service_records`)
        const formattedServices = (serviceData || []).map((item: any) => {
          // Extract buyer name safely from form_snapshot JSON if available
          let extractedBuyerName = item.customer_name;
          if (!extractedBuyerName && item.form_snapshot) {
            try {
              const snapshot = typeof item.form_snapshot === 'string' 
                ? JSON.parse(item.form_snapshot) 
                : item.form_snapshot;
              
              if (snapshot?.buyers && Array.isArray(snapshot.buyers) && snapshot.buyers.length > 0) {
                extractedBuyerName = snapshot.buyers[0]?.name;
              }
            } catch (e) {
              console.error("Error parsing form_snapshot for buyer name", e);
            }
          }

          return {
            ...item,
            customer_name: extractedBuyerName || item.buyer_name || item.buyer || item.client_name || "N/A",
            source_table: 'service_records' as const,
            record_category: 'SERVICE' as const,
            created_date: item.created_date || item.created_at || new Date().toISOString(),
            case_type: item.case_type || 'DEED_DRAFT',
            fee_standard: item.user_service_fee || item.fee_standard || item.fee || 0,
            mobile_no: item.mobile_no || "",
            email_id: item.email_id || ""
          };
        });

        // 5. Combine Both Datasets
        const combinedRecords = [...formattedEstimates, ...formattedServices];
        
        // Sort by date (latest first)
        combinedRecords.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());

        setRecords(combinedRecords as MISRecord[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserWalletAndData();
  }, []);

  const handleCreateClick = () => {
    if (walletBalance < 100) {
      alert("Access Denied: Wallet balance is less than ₹100. Please recharge first.");
      return;
    }
    router.push('/estimate');
  };

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

  // Core Mutation Engine for Status Handling and Revenue Auditing (#PROTECT & #SYNC)
  const updateStatus = async (id: string, newStatus: string) => {
    try {
      setActiveMenuId(null);

      // 1. Session state verification to protect multi-tenant integrity (#PROTECT)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("⚠️ CRITICAL SECURITY WARNING: Session expired. Action blocked.");
        return;
      }

      const exactUppercaseStatus = newStatus.toUpperCase();

      // 2. Multi-layer validation constraint for revenue loss prevention
      if (exactUppercaseStatus === 'WAIVED') {
        const verifyWaived = confirm("WARNING: Are you sure you want to mark this consulting fee as WAIVED? This will immediately affect revenue metrics.");
        if (!verifyWaived) return;
      }

      // 3. Dynamic Table Resolution & Secure database write transaction (#SYNC)
      const targetRecord = records.find(r => String(r.id) === String(id));
      const targetTable = targetRecord?.source_table || 'mis_records';

      const { data, error } = await supabase
        .from(targetTable)
        .update({ status: exactUppercaseStatus })
        .eq('id', id)
        .select(); // Real-time row return to verify commit execution

      if (error) throw error;

      if (!data || data.length === 0) {
        alert("⚠️ DATABASE WRITE FAILED: Row match query executed but 0 records updated in DB ledger. Please check RLS or connection state.");
        return;
      }

      // 4. Guaranteed Local UI Synchronization matrix allocation (#CLEAN)
      setRecords(prev => prev.map(r => String(r.id) === String(id) ? { ...r, status: exactUppercaseStatus as any } : r));
      
    } catch (error: any) {
      alert("Error processing mutation status updates: " + error.message);
    }
  };

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

      // Comprehensive payload with fallback mapping keys
      const reopenData = {
        id: record.id,
        ref_no: record.ref_no,
        customer_name: record.customer_name || "",
        client_name: record.client_name || "",
        representative: record.representative || "",
        case_type: record.case_type || "",
        estimate_type: record.case_type || "",
        property_type: record.property_type || "HOUSE",
        total_value: record.fee_standard || record.fee || 0,
        fee_standard: record.fee_standard || record.fee || 0,
        property_address: record.property_address || "",
        plot_area: record.plot_area || "",
        floor_details: parsedFloorDetails,
        rate_per_sqft: record.rate_per_sqft || 0,
        mobile_no: record.mobile_no || record.clients?.mobile_no || "",
        email_id: record.email_id || record.clients?.email_id || "",
        status: currentStatus,
        isAlreadyPaid: isPaidAlready,
        is_paid: isPaidAlready,
        // Form mapping fallback keys
        name: record.customer_name || "",
        address: record.property_address || "",
        client: record.client_name || ""
      };

      const caseTypeUpper = (record.case_type || "").trim().toUpperCase();
      
      if (caseTypeUpper.includes("RENOVATION")) {
        localStorage.setItem("renovationEstimatePreview", JSON.stringify(reopenData));
        window.location.href = "/renovation-estimate"; // Full reload to prevent stale cache
      } else {
        localStorage.setItem("estimatePreview", JSON.stringify(reopenData));
        window.location.href = "/estimate"; // Full reload to prevent stale cache
      }
    } catch (err: any) {
      alert("Failed to reopen case: " + err.message);
    }
  };

  const handleArchive = (id: string) => {
    setRecordToDelete(id);
    setConfirmPassword('');
    setAuthError('');
    setIsAuthModalOpen(true);
  };

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

 // Broadcast Communication Features Channels (Grouped by Client & Representative for Pending Cases)
  const triggerWhatsAppBroadcast = async () => {
    try {
      setLoading(true);

      // Get logged-in user details using profiles table schema (full_name, mobile, email)
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
        } else {
          loggedInUserName = user.user_metadata?.full_name || user.email?.split('@')[0] || "Admin";
        }
      }

      // 1. Get filtered records from current view (Case-insensitive check for PENDING or FINALIZED)
      let targetRecords = filteredRecords.filter(r => {
        const s = String(r.status || "").trim().toUpperCase();
        return s === 'PENDING' || s === 'FINALIZED';
      });

      if (targetRecords.length === 0) {
        targetRecords = records.filter(r => {
          const s = String(r.status || "").trim().toUpperCase();
          return s === 'PENDING' || s === 'FINALIZED';
        });
      }

      if (targetRecords.length === 0) {
        alert("⚠️ No pending or finalized cases found based on the current filter/view!");
        setLoading(false);
        return;
      }

      // 2. Group records by Client Name & Representative combination
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

      // 3. Loop through each unique group and build message
      for (const groupKey of Object.keys(groupedMap)) {
        const [clientName, repName] = groupKey.split('_|_');
        const recordsGroup = groupedMap[groupKey];
        
        let targetMobile = "";
        let targetEmail = "";

        // Check if mobile or email exists directly in the record
        for (const rec of recordsGroup) {
          if (rec.mobile_no) targetMobile = rec.mobile_no;
          if (rec.email_id) targetEmail = rec.email_id;
          if (targetMobile && targetEmail) break;
          
          if (rec.clients?.mobile_no) targetMobile = rec.clients.mobile_no;
          if (rec.clients?.email_id) targetEmail = rec.clients.email_id;
        }

        // If not in record, fetch from 'clients' table using client_name
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

        // If still no mobile, check representative in clients or profiles table
        if (!targetMobile && repName && repName !== "General") {
          try {
            const { data: repClientData } = await supabase
              .from('clients')
              .select('mobile_no, email_id')
              .ilike('representative_name', `%${repName}%`)
              .maybeSingle();

            if (repClientData) {
              if (repClientData.mobile_no) targetMobile = repClientData.mobile_no;
              if (repClientData.email_id && !targetEmail) targetEmail = repClientData.email_id;
            } else {
              const { data: repProfileData } = await supabase
                .from('profiles')
                .select('mobile, email')
                .ilike('full_name', `%${repName}%`)
                .maybeSingle();

              if (repProfileData) {
                if (repProfileData.mobile) targetMobile = repProfileData.mobile;
                if (repProfileData.email && !targetEmail) targetEmail = repProfileData.email;
              }
            }
          } catch (e) {}
        }

        let totalPendingFee = 0;
        recordsGroup.forEach(rec => {
          const fee = parseFloat(rec.fee_standard || rec.fee || 0);
          if (!isNaN(fee)) totalPendingFee += fee;
        });

        // 4. Constructing Professional Message Format
        let message = `Hello ${clientName} ${repName},\n\n`;
        message += `Here is the summary of your Pending Cases list (${repName}):\n\n`;
        
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
        message += `Total Pending Cases: ${recordsGroup.length}\n`;
        message += `Total Pending Amount: ₹${totalPendingFee.toLocaleString('en-IN')}\n\n`;
        message += `Please review and clear the dues at your earliest convenience.\n\n`;
        
        message += `Thanks & Regards,\n`;
        message += `${loggedInUserName}`;
        if (loggedInUserMobile) {
          message += `\n📞 ${loggedInUserMobile}`;
        }

        const cleanMobile = String(targetMobile || "").replace(/\D/g, '');

        // 5. Send via WhatsApp if valid mobile exists, otherwise fallback to Email if email exists
        if (cleanMobile.length >= 10) {
          const encodedMessage = encodeURIComponent(message);
          const whatsappUrl = `https://wa.me/91${cleanMobile}?text=${encodedMessage}`;
          window.open(whatsappUrl, '_blank');
          broadcastCount++;
        } else if (targetEmail && targetEmail.includes('@')) {
          const emailSubject = encodeURIComponent(`Pending Cases Summary - ${clientName}`);
          const emailBody = encodeURIComponent(message);
          const mailtoUrl = `mailto:${targetEmail}?subject=${emailSubject}&body=${emailBody}`;
          window.open(mailtoUrl, '_blank');
          emailFallbackCount++;
        } else {
          
        }
      }

      if (broadcastCount > 0 || emailFallbackCount > 0) {
        alert(`✅ Broadcast sent successfully!\n- WhatsApp opened: ${broadcastCount}\n- Email fallback opened: ${emailFallbackCount}`);
      } else {
        alert("⚠️ Could not send broadcast. Please ensure valid mobile numbers or email IDs are saved in the database.");
      }

    } catch (error: any) {
      
      alert("An error occurred while generating the broadcast.");
    } finally {
      setLoading(false);
    }
  };

const triggerEmailBroadcast = async () => {
    try {
      setLoading(true);

      // Get logged-in user details
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
        } else {
          loggedInUserName = user.user_metadata?.full_name || user.email?.split('@')[0] || "Admin";
          loggedInUserEmail = user.email || "";
        }
      }

      // 1. Get filtered records
      let targetRecords = filteredRecords.filter(r => {
        const s = String(r.status || "").trim().toUpperCase();
        return s === 'PENDING' || s === 'FINALIZED';
      });

      if (targetRecords.length === 0) {
        targetRecords = records.filter(r => {
          const s = String(r.status || "").trim().toUpperCase();
          return s === 'PENDING' || s === 'FINALIZED';
        });
      }

      if (targetRecords.length === 0) {
        alert("⚠️ No pending or finalized cases found based on the current filter/view!");
        setLoading(false);
        return;
      }

      // 2. Group records by Client & Representative
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

      // 3. Loop through each group
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

        if (!targetEmail || !targetEmail.includes('@')) {
          
          continue;
        }

        let totalPendingFee = 0;
        recordsGroup.forEach(rec => {
          const fee = parseFloat(rec.fee_standard || rec.fee || 0);
          if (!isNaN(fee)) totalPendingFee += fee;
        });

        // Build Email Content
        let emailBody = `Hello ${clientName},\n\n`;
        emailBody += `Here is the summary of your Pending Cases (Representative: ${repName}):\n\n`;
        
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
        emailBody += `Total Pending Cases: ${recordsGroup.length}\n`;
        emailBody += `Total Pending Amount: ₹${totalPendingFee.toLocaleString('en-IN')}\n\n`;
        emailBody += `Please review and clear the dues at your earliest convenience.\n\n`;
        
        emailBody += `Thanks & Regards,\n`;
        emailBody += `${loggedInUserName}`;
        if (loggedInUserMobile) emailBody += `\n📞 ${loggedInUserMobile}`;
        if (loggedInUserEmail) emailBody += `\n✉️ ${loggedInUserEmail}`;

        const emailSubject = `Pending Cases Summary - ${clientName} (${repName})`;

        // 4. ASK USER: Gmail ya Outlook kisme kholna hai?
        const choice = window.prompt(
          `Recipient Email: ${targetEmail}\n\nChoose your preferred email client:\nType 'gmail' for Google Gmail\nType 'outlook' for Microsoft Outlook\n(Click 'Cancel' to skip)`,
          'gmail'
        );

        if (!choice) continue;

        let emailUrl = "";
        const lowerChoice = choice.trim().toLowerCase();

        if (lowerChoice.includes('gmail')) {
          // Direct web Gmail composer link
          emailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        } else {
          // Direct web Outlook composer link (Works in browser without opening native desktop app)
          emailUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(targetEmail)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        }

        window.open(emailUrl, '_blank');
        emailCount++;
      }

      if (emailCount > 0) {
        alert(`✅ Email composer opened successfully for ${emailCount} recipient(s)!`);
      } else {
        alert("⚠️ No valid emails found to broadcast.");
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
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white px-5 py-3 rounded border border-slate-200 shadow-xs">
        <h1 className="text-sm font-black tracking-wider text-slate-800 uppercase">MIS Analytics Engine</h1>
        <div className="flex flex-wrap items-center justify-center gap-2 w-full md:w-auto">
          <button onClick={triggerWhatsAppBroadcast} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md font-medium text-xs flex items-center gap-1.5 flex-1 md:flex-initial justify-center">
            💬 <span className="hidden sm:inline">WHATSAPP</span> BROADCAST
          </button>
          <button onClick={triggerEmailBroadcast} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md font-medium text-xs flex items-center gap-1.5 flex-1 md:flex-initial justify-center">
            ✉️ <span className="hidden sm:inline">EMAIL</span> BROADCAST
          </button>
          <button onClick={handleCreateClick} className="bg-blue-950 hover:bg-slate-900 text-white text-[10px] font-bold uppercase px-3 py-2 rounded transition-all tracking-wider flex-1 md:flex-initial justify-center">
            + Create Entry
          </button>
        </div>
      </div>

      <MetricsBar metrics={metrics} />

      {/* Embedded Dynamic Table Matrix for Desktop / Cards for Mobile */}
      
      {/* 1. MOBILE CARD VIEW & FILTERS (Visible only on small screens) */}
      <div className="block md:hidden space-y-3">
        
        {/* Mobile Search & Filter Box */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Quick Filters (Mobile)</div>
          
          <div className="grid grid-cols-2 gap-2">
            <input 
              type="text" 
              value={filterRefNo} 
              onChange={e => setFilterRefNo(e.target.value)} 
              placeholder="Search Ref No..." 
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 uppercase font-bold focus:outline-none focus:border-blue-500" 
            />
            <input 
              type="text" 
              value={filterClient} 
              onChange={e => setFilterClient(e.target.value)} 
              placeholder="Client Name..." 
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 uppercase font-bold focus:outline-none focus:border-blue-500" 
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select 
              value={filterCaseType} 
              onChange={e => setFilterCaseType(e.target.value)} 
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 uppercase font-bold focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Case Types</option>
              <option value="Construction">New Construction</option>
              <option value="Renovation">Renovation</option>
              <option value="Route">Route Map</option>
            </select>

            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)} 
              className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-800 uppercase font-bold focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="RECEIVED">Received</option>
              <option value="WAIVED">Waived</option>
            </select>
          </div>
        </div>

        {/* Existing Mobile Cards Loop */}
        {loading ? (
          <div className="bg-white p-4 rounded text-center text-slate-400 text-xs">Syncing active engine tables...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white p-6 rounded text-center text-slate-400 text-xs flex flex-col items-center gap-1">
            <AlertCircle size={16} /><span>No logs match current search fields.</span>
          </div>
        ) : (
          filteredRecords.map((rec) => {
            // ... card elements loop ...
            const cleanName = (rec.customer_name || "").split(/s\/o|d\/o|w\/o/i)[0].replace(/[,.-]+$/, "").trim().toUpperCase();
            return (
              <div key={rec.id} className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-2.5">
                
                {/* Top Row: Ref No & Date */}
                <div className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-2">
                  <span className="font-mono font-bold text-blue-700">{rec.ref_no}</span>
                  <span className="text-slate-500">{rec.created_date ? new Date(rec.created_date).toLocaleDateString('en-GB') : "-"}</span>
                </div>

                {/* Customer & Details */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 uppercase">{cleanName}</span>
                    <span className="text-xs font-black text-slate-900">₹{(rec.fee_standard || 0).toLocaleString('en-IN')}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 font-medium">
                    <div><span className="text-slate-400">Client:</span> {rec.client_name ? rec.client_name.toUpperCase() : "N/A"}</div>
                    <div><span className="text-slate-400">Rep:</span> {rec.representative ? rec.representative.toUpperCase() : "N/A"}</div>
                  </div>

                  <div className="text-[11px] text-slate-500 font-medium">
                    <span className="text-slate-400">Type:</span> {rec.case_type ? rec.case_type.toUpperCase() : "N/A"}
                  </div>
                </div>

                {/* Bottom Row: Status Dropdown & Action Options */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                  <select 
                    value={(rec.status || 'PENDING').toUpperCase()} 
                    onChange={(e) => updateStatus(String(rec.id), e.target.value)}
                    className={`px-2 py-1 rounded font-black uppercase text-[10px] cursor-pointer outline-none border flex-1 ${
                      (rec.status || '').toUpperCase() === 'RECEIVED' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 
                      (rec.status || '').toUpperCase() === 'WAIVED' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                      'bg-red-100 text-red-600 border-red-200'
                    }`}
                  >
                    <option value="PENDING" className="text-red-600 font-bold bg-white">PENDING</option>
                    <option value="RECEIVED" className="text-emerald-600 font-bold bg-white">RECEIVED</option>
                    <option value="WAIVED" className="text-slate-600 font-bold bg-white">WAIVED</option>
                  </select>

                  <div className="flex items-center gap-1">
                    {rec.mobile_no && <a href={`https://wa.me/91${rec.mobile_no}`} target="_blank" className="p-1.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-200"><MessageSquare size={14} /></a>}
                    {rec.email_id && <a href={`mailto:${rec.email_id}`} className="p-1.5 bg-blue-50 text-blue-600 rounded border border-blue-200"><Mail size={14} /></a>}
                    
                    {/* Action Menu for Mobile */}
                    <button 
                      onClick={() => setActiveMenuId(activeMenuId === rec.id ? null : rec.id)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded border border-slate-300"
                    >
                      Actions ▾
                    </button>
                  </div>
                </div>

                {/* Inline Action Dropdown for Mobile if Active */}
                {activeMenuId === rec.id && (
                  <div className="flex gap-2 pt-2 border-t border-dashed border-slate-200">
                    <button onClick={() => handleReopen(rec)} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-1.5 rounded text-[10px] font-bold border border-blue-200">
                      Reopen / Edit
                    </button>
                    <button onClick={() => handleArchive(rec.id)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 py-1.5 rounded text-[10px] font-bold border border-red-200">
                      Delete
                    </button>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>


      {/* 2. DESKTOP TABLE VIEW (Hidden on mobile, visible on desktop md+) */}
      <div className="hidden md:block bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
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
                      <td className="p-2 text-slate-800 text-center">{rec.client_name ? rec.client_name.toUpperCase() : "N/A"}</td>
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
    </div>
  );
}