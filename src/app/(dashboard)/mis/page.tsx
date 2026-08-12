'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  DollarSign, CheckCircle2, Clock, AlertCircle, 
  Mail, MessageSquare, FolderOpen, Trash2, XCircle, ShieldCheck, ChevronDown
} from 'lucide-react';

interface MISRecord {
  id: string;
  ref_no: string;
  created_date: string;
  customer_name: string;
  client_name: string;
  client?: string; // <--- Yeh line add kar dein
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

  estimates?: {
    user_id: string;
  }[];
}

export default function MISPage() {
  const router = useRouter();
  const menuRef = useRef<any>(null);
  const [records, setRecords] = useState<MISRecord[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Dropdown clear click detector
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchMISMasterData() {
      try {
        setLoading(true);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // 1. Role check karein
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        const isAdmin = profile?.role === 'admin';

        let query = supabase.from('mis_records').select('*');

        // 2. Agar Admin nahi hai, tabhi join lagayein aur filter karein
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
      } catch (err: any) {
        
      } finally {
        setLoading(false);
      }
    }
    fetchMISMasterData();
  }, []);

  // Filter Computation Logic Matrix
const filteredRecords = useMemo(() => {
  return records.filter(rec => {
    // Har field ko check karein ki wo null na ho
    const matchDate = (rec.created_date || "").toLowerCase().includes(filterDate.toLowerCase());
    const matchClient = (rec.client_name || "").toLowerCase().includes(filterClient.toLowerCase());
    const matchRep = (rec.representative || "").toLowerCase().includes(filterRepresentative.toLowerCase());
    
    // Case Type aur Status ke liye check (Think 10X Robust Case-Insensitive Mapping #SYNC)
    const matchCase = filterCaseType === 'ALL' || 
      (rec.case_type || "").toUpperCase().includes(filterCaseType.toUpperCase());

    const matchStatus = filterStatus === 'ALL' || 
      (rec.status || "").toUpperCase() === filterStatus.toUpperCase();

    return matchDate && matchClient && matchRep && matchCase && matchStatus;
  });
}, [records, filterDate, filterClient, filterRepresentative, filterCaseType, filterStatus]);

  // Financial Stream Metric Cards Calculation (Added Waived Amount)
  const metrics = useMemo(() => {
    return records.reduce((acc, curr) => {
      const currentStatus = (curr.status || "").toUpperCase();
      const fee = (curr.fee_standard || 0);
      
      acc.total += fee;
      if (currentStatus === 'RECEIVED') acc.received += fee;
      if (currentStatus === 'PENDING') acc.pending += fee;
      if (currentStatus === 'WAIVED') acc.waived += fee; // <--- Waived amount calculation
      
      return acc;
    }, { total: 0, received: 0, pending: 0, waived: 0 });
  }, [records]);

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

 // mis/page.tsx mein handleReopen function ko aise update karein:
// ✅ Yeh naya wala function replace karke paste karna hai
  const handleReopen = async (record: any) => {
    try {
      const { data, error } = await supabase
        .from("mis_records")
        .select("edit_count, status")
        .eq("id", record.id)
        .single();

      if (error) throw error;

      if (data && data.edit_count >= 5) {
        alert("⚠️ ACCESS DENIED: Limit (5) reached.");
        return;
      }

      let parsedFloorDetails = record.floor_details;
      if (typeof record.floor_details === 'string') {
        try {
          parsedFloorDetails = JSON.parse(record.floor_details);
        } catch (e) {
          parsedFloorDetails = {};
        }
      }

      const currentStatus = (data?.status || record.status || "").trim().toUpperCase();
      const isPaidAlready = 
        currentStatus === "RECEIVED" || 
        currentStatus === "PAID" || 
        currentStatus === "SUCCESS" ||
        record.isAlreadyPaid === true ||
        record.is_paid === true;

      const reopenData = {
        id: record.id,
        customer_name: record.customer_name,
        client_name: record.client_name,
        representative: record.representative,
        case_type: record.case_type,
        estimate_type: record.case_type,
        property_type: record.property_type || "HOUSE", // <--- Yeh line add/ensure karein
        total_value: record.fee_standard,
        property_address: record.property_address || "",
        plot_area: record.plot_area || "",
        floor_details: parsedFloorDetails,
        rate_per_sqft: record.rate_per_sqft,
        status: currentStatus,
        isAlreadyPaid: isPaidAlready,
        is_paid: isPaidAlready
      };

      // Check case type and redirect to appropriate page
      const caseTypeUpper = (record.case_type || "").trim().toUpperCase();
      
      if (caseTypeUpper.includes("RENOVATION")) {
        localStorage.setItem("renovationEstimatePreview", JSON.stringify(reopenData));
        router.push("/renovation-estimate");
      } else {
        localStorage.setItem("estimatePreview", JSON.stringify(reopenData));
        router.push("/estimate");
      }
      
    } catch (err: any) {
      
      alert("Error: Data fetch nahi ho paya.");
    }
  };
  
  // Pipeline Engine for Safe Archival and Hard-Deletion Prevention
  const handleArchive = async (id: string) => {
    try {
      // 1. Double layer confirmation protocol for destructive actions
      const firstCheck = confirm("WARNING: Are you sure you want to archive this case ledger record?");
      if (!firstCheck) return;

      const secondCheck = prompt("SECURITY VALIDATION: Type 'CONFIRM' to execute archive transaction sequence:");
      if (secondCheck !== "CONFIRM") {
        alert("Invalid text parameters. Archive protocol aborted.");
        return;
      }

      // 2. Extract active user token context to avoid unauthorized access (#PROTECT)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Session validation expired. Action denied.");
        return;
      }

      // 3. Secure database write transaction sequence (Archiving targets strict uppercase 'WAIVED')
            
      const { data, error } = await supabase
        .from('mis_records')
        .update({ status: 'WAIVED' }) // Database strict UPPERCASE format synced
        .eq('id', id)
        .select();

      if (error) {
        
        throw error;
      }
      
      // 4. Interface state optimization and local data sync (#CLEAN)
      setRecords(prev => prev.filter(r => r.id !== id));
      alert("SUCCESS: Record has been safely moved to system archives.");

    } catch (error: any) {
      
      alert("Pipeline Error: Mutation write blocked. " + error.message);
    }
  };

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

      // 3. Secure database write transaction sequence with Typecasting and Row Select Sync (#SYNC)
            
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) {
        throw new Error("Invalid Record ID Format detected on Client Runtime Engine.");
      }

      const { data, error } = await supabase
        .from('mis_records')
        .update({ status: exactUppercaseStatus })
        .eq('id', numericId)
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

  
  // FIXED: Routing URLs explicitly switched to lowercase target paths (/estimate, /construction-plan, etc.)
 const handleOpenCase = (record: MISRecord) => {
  setActiveMenuId(null);
  
  // Safety check: agar case_type null hai toh fallback dega
  const type = (record.case_type || "").toLowerCase();
  
  if (type.includes('construction') || type.includes('renovation') || type.includes('estimate')) {
    router.push(`/estimate?refNo=${encodeURIComponent(record.ref_no)}`);
  } else if (type.includes('plan')) {
    router.push(`/construction-plan?refNo=${encodeURIComponent(record.ref_no)}`);
  } else if (type.includes('route') || type.includes('map')) {
    router.push(`/route-map?refNo=${encodeURIComponent(record.ref_no)}`);
  } else {
    router.push(`/estimate?refNo=${encodeURIComponent(record.ref_no)}`);
  }
};

  // Local Action State Cancellations
  const handleCancelCase = async (id: string) => {
    setActiveMenuId(null);
    if (!window.confirm("Bhai, kya aap is entry ka status Waived mark karna chahte hain?")) return;
    
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'Waived', remark: 'Transaction status marked as Waived by panel.' } : r));
    await supabase.from('mis_records').update({ status: 'Waived', remark: 'Transaction status marked as Waived.' }).eq('id', id);
  };

  // User Activation Manual Override Control
  const toggleAccountActivation = async (id: string, currentStatus: 'ACTIVE' | 'INACTIVE') => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const confirmMsg = nextStatus === 'ACTIVE' 
      ? "Bhai, kya aap is inactive account ko manually unlock karke operational lifecycle active karna chahte hain?"
      : "Bhai, kya aap is client ledger state ko force suspend/inactive karna chahte hain?";

    if (!window.confirm(confirmMsg)) return;

    setRecords(prev => prev.map(r => r.id === id ? { ...r, account_status: nextStatus, hours_elapsed: nextStatus === 'ACTIVE' ? 0 : r.hours_elapsed } : r));
    await supabase.from('mis_records').update({ account_status: nextStatus, hours_elapsed: nextStatus === 'ACTIVE' ? 0 : undefined }).eq('id', id);
  };

  // Secure Delete Validation Modal Trigger
  const triggerSecureDelete = (id: string) => {
    setActiveMenuId(null);
    setRecordToDelete(id);
    setConfirmPassword('');
    setAuthError('');
    setIsAuthModalOpen(true);
  };

  const executeSecureDelete = async () => {
    if (!confirmPassword) return setAuthError('Operational confirmation password required.');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Active administrator session not found.");

      const { error } = await supabase.auth.signInWithPassword({ 
        email: user.email, 
        password: confirmPassword 
      });
      
      if (error) return setAuthError("Security Failure: Authentication mismatched.");

      if (recordToDelete) {
        await supabase.from('mis_records').delete().eq('id', recordToDelete);
        setRecords(prev => prev.filter(r => r.id !== recordToDelete));
      }
      setIsAuthModalOpen(false);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto p-2 bg-slate-50 min-h-screen">
      
      {/* Header Panel */}
      <div className="flex items-center justify-between bg-white px-5 py-3 rounded border border-slate-200 shadow-xs">
        <h1 className="text-sm font-black tracking-wider text-slate-800 uppercase">MIS Analytics Engine</h1>
        <div className="flex gap-2">
          {/* WhatsApp Broadcast Button */}
<button
  onClick={triggerWhatsAppBroadcast}
  disabled={loading}
  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2"
>
  {loading ? "Processing..." : "💬 WHATSAPP BROADCAST"}
</button>

{/* Email Broadcast Button */}
<button
  onClick={triggerEmailBroadcast}
  disabled={loading}
  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2"
>
  {loading ? "Processing..." : "✉️ EMAIL BROADCAST"}
</button>
          {/* FIXED: Target create path lowered to standard route structure */}
          <button onClick={() => router.push('/estimate')} className="bg-blue-950 hover:bg-slate-900 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded transition-all tracking-wider">
            + Create Entry
          </button>
        </div>
      </div>

     {/* Metrics Performance Bar (4 Cards Layout) */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
  <div className="bg-white border border-slate-200 px-4 py-3 rounded flex items-center justify-between">
    <div>
      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Total Value Stream</span>
      <h2 className="text-lg font-black text-slate-900">₹{metrics.total.toLocaleString('en-IN')}</h2>
    </div>
    <div className="p-1.5 bg-blue-50 text-blue-700 rounded"><DollarSign size={16} /></div>
  </div>

  <div className="bg-white border border-slate-200 px-4 py-3 rounded flex items-center justify-between">
    <div>
      <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-widest">Collections Realized</span>
      <h2 className="text-lg font-black text-emerald-600">₹{metrics.received.toLocaleString('en-IN')}</h2>
    </div>
    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded"><CheckCircle2 size={16} /></div>
  </div>

  <div className="bg-white border border-slate-200 px-4 py-3 rounded flex items-center justify-between">
    <div>
      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Waived Revenue</span>
      <h2 className="text-lg font-black text-slate-700">₹{metrics.waived.toLocaleString('en-IN')}</h2>
    </div>
    <div className="p-1.5 bg-slate-100 text-slate-600 rounded"><XCircle size={16} /></div>
  </div>

  <div className="bg-white border border-slate-200 px-4 py-3 rounded flex items-center justify-between">
    <div>
      <span className="text-[10px] text-amber-500 uppercase font-bold tracking-widest">Outstanding Escrow</span>
      <h2 className="text-lg font-black text-amber-600">₹{metrics.pending.toLocaleString('en-IN')}</h2>
    </div>
    <div className="p-1.5 bg-amber-50 text-amber-600 rounded"><Clock size={16} /></div>
  </div>
</div>

      {/* Embedded Dynamic Table Matrix */}
      <div className="bg-white border border-slate-300 rounded shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[1300px]">
            
            {/* Unified Dynamic Header Filtering System */}
            <thead>
              <tr className="bg-blue-950 text-white text-[11px] font-extrabold tracking-wider uppercase border-b border-blue-900">
                {/* REF NO - Centered */}
                <th className="p-3 border-r border-blue-900 w-[14%] text-center tracking-wider text-blue-100 select-none">REF NO</th>

                {/* 1. Filter Input: Date - Centered Input Text */}
                <th className="p-2 border-r border-blue-900 w-[10%] text-center">
                  <input 
                    type="text" 
                    value={filterDate} 
                    onChange={e => setFilterDate(e.target.value)} 
                    placeholder="DATE (YYYY-MM)" 
                    className="w-full bg-transparent placeholder-blue-200/60 text-white uppercase text-[11px] font-black focus:outline-none tracking-wider text-center"
                  />
                </th>

                {/* CUSTOMER NAME - Centered */}
                <th className="p-3 border-r border-blue-900 w-[17%] text-center tracking-wider text-blue-100 select-none">CUSTOMER NAME</th>

                {/* 2. Filter Input: Client - Centered Input Text */}
                <th className="p-2 border-r border-blue-900 w-[13%] text-center">
                  <input 
                    type="text" 
                    value={filterClient} 
                    onChange={e => setFilterClient(e.target.value)} 
                    placeholder="CLIENT" 
                    className="w-full bg-transparent placeholder-blue-200/60 text-white uppercase text-[11px] font-black focus:outline-none tracking-wider text-center"
                  />
                </th>

                {/* 3. Filter Input: Representative - Centered Input Text */}
                <th className="p-2 border-r border-blue-900 w-[13%] text-center">
                  <input 
                    type="text" 
                    value={filterRepresentative} 
                    onChange={e => setFilterRepresentative(e.target.value)} 
                    placeholder="REPRESENTATIVE" 
                    className="w-full bg-transparent placeholder-blue-200/60 text-white uppercase text-[11px] font-black focus:outline-none tracking-wider text-center"
                  />
                </th>

                {/* 4. Dropdown Selector: Case Type - Centered Element Selector */}
                <th className="p-2 border-r border-blue-900 w-[12%] text-center">
                  <select 
                      value={filterCaseType} 
                        onChange={e => setFilterCaseType(e.target.value)} 
                        className="w-full bg-transparent text-white font-black text-[11px] uppercase tracking-wider focus:outline-none cursor-pointer border-none text-center"
                        style={{ textAlignLast: 'center' }}
                  >
                    <option value="ALL" className="text-slate-900 font-bold">CASE TYPE</option>
                    <option value="Construction" className="text-slate-900 font-bold">NEW CONSTRUCTION</option>
                    <option value="Renovation" className="text-slate-900 font-bold">RENOVATION</option>
                    <option value="Renovation" className="text-slate-900 font-bold">RENOVATION + EXTENSTION</option>
                    <option value="Route" className="text-slate-900 font-bold">ROUTE MAP</option>
                    <option value="Plan" className="text-slate-900 font-bold">PLAN</option>
                    <option value="Plan" className="text-slate-900 font-bold">DRAFTING</option>
                  </select>
                </th>

                {/* FEE STANDARD - Centered */}
                <th className="p-3 border-r border-blue-900 w-[9%] text-center tracking-wider text-blue-100 select-none">FEE STANDARD</th>

                {/* 5. Dropdown Selector: Status - Centered */}
                <th className="p-2 border-r border-blue-900 w-[12%] text-center">
                  <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)} 
                    className="w-full bg-transparent text-white font-black text-[11px] uppercase tracking-wider focus:outline-none cursor-pointer text-center border-none"
                  >
                    <option value="ALL" className="text-slate-900 font-bold">STATUS</option>
                    <option value="PENDING" className="text-slate-900 font-bold">PENDING</option>
                    <option value="RECEIVED" className="text-slate-900 font-bold">RECEIVED</option>
                    <option value="WAIVED" className="text-slate-900 font-bold">WAIVED</option>
                  </select>
                </th>

                {/* ACTIONS - Centered */}
                <th className="p-3 w-[10%] text-center tracking-wider text-blue-100 select-none">ACTIONS</th>
              </tr>
            </thead>

            {/* Core Data Population Block */}
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
      const cleanName = rec.customer_name
  .split(/s\/o|d\/o|w\/o/i)[0] // Split by s/o, d/o, w/o
  .replace(/[,.-]+$/, "")      // Hataye agar end mein comma ya dot ho
  .trim()                      // Extra spaces hataye
  .toUpperCase();              // Pura naam Uppercase mein
      return (
        <tr key={rec.id} className="border-b hover:bg-slate-50 transition-all text-[11px] font-bold whitespace-nowrap uppercase">
  {/* REF NO - Left Aligned (Default) */}
  <td className="p-2 font-mono text-blue-700">{rec.ref_no}</td>
  
  {/* DATE - Center */}
  <td className="p-2 text-slate-500 text-center">
  {rec.created_date ? new Date(rec.created_date).toLocaleDateString('en-GB') : "-"}
</td>
  
  {/* CUSTOMER NAME - Left Aligned (Default) */}
  {/* CUSTOMER NAME - With Contact Buttons */}
<td className="p-2 text-slate-900">
  <div className="flex flex-col">
    <span>{cleanName.toUpperCase()}</span>
    <div className="flex gap-2 mt-1">
      {/* WhatsApp Link */}
      {rec.mobile_no && (
        <a 
          href={`https://wa.me/91${rec.mobile_no}?text=Hello%20${encodeURIComponent(cleanName)},%20Your%20case%20${rec.ref_no}%20update...`}
          target="_blank"
          className="text-emerald-600 hover:text-emerald-800"
        >
          <MessageSquare size={12} />
        </a>
      )}
      {/* Email Link */}
      {rec.email_id && (
        <a 
          href={`mailto:${rec.email_id}?subject=Case%20Update%20${rec.ref_no}&body=Dear%20${cleanName},%20regarding%20your%20case...`}
          className="text-blue-600 hover:text-blue-800"
        >
          <Mail size={12} />
        </a>
      )}
    </div>
  </div>
</td>
  
  {/* CLIENT - Center */}
<td className="p-2 text-slate-800 text-center">
  {rec.client_name ? rec.client_name.substring(0, 10).toUpperCase() : "N/A"}...
</td>

{/* REPRESENTATIVE - Center */}
<td className="p-2 text-slate-600 text-center">
  {rec.representative ? rec.representative.toUpperCase() : "N/A"}
</td>

{/* CASE TYPE - Center */}
<td className="p-2 text-slate-900 text-center">
  {rec.case_type ? rec.case_type.toUpperCase() : "N/A"}
</td>
  
 {/* FEE Column */}
<td className="p-2 text-center">
  ₹{(rec.fee_standard || 0).toLocaleString('en-IN')}
</td>
  
 {/* STATUS - Clickable Status Update (#CLEAN & #SYNC) */}
<td className="p-2 text-center">
  <select 
    value={(rec.status || 'PENDING').toUpperCase()} 
    onChange={(e) => updateStatus(String(rec.id), e.target.value)}
    className={`px-2 py-1.5 rounded font-black uppercase text-[10px] cursor-pointer outline-none border border-transparent transition-all tracking-wider ${
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
  
  {/* ACTION - Only Reopen and Delete */}
<td className="p-3 text-center relative">
  <button 
    onClick={() => setActiveMenuId(rec.id === activeMenuId ? null : rec.id)} 
    className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded font-black text-[10px] uppercase transition-all border border-blue-200"
  >
    {activeMenuId === rec.id ? "CLOSE" : "ACTION"}
  </button>

  {activeMenuId === rec.id && (
    <div className="absolute right-1/2 translate-x-1/2 mt-2 w-32 bg-white border border-slate-200 shadow-2xl rounded-lg z-[100] text-[10px] overflow-hidden">
      <button 
        onClick={() => handleReopen(rec)} 
        className="w-full text-left p-3 hover:bg-slate-50 uppercase text-slate-700 font-bold border-b border-slate-100 flex items-center gap-2"
      >
        REOPEN CASE
      </button>
      <button 
        onClick={() => handleArchive(rec.id)} 
        className="w-full text-left p-3 hover:bg-red-50 uppercase text-red-600 font-bold flex items-center gap-2"
      >
        DELETE CASE
      </button>
    </div>
  )}
</td>
</tr>
      );
    })
  )}
</tbody>
          </table>
        </div>
      </div>

            {/* Delete Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded border border-slate-300 p-5 w-full max-w-xs mx-4 shadow-xl">
            <div className="flex items-center gap-2 text-red-600 font-black uppercase text-[11px] mb-2">
              <ShieldCheck size={16} />
              <span>Security Validation Check</span>
            </div>
            <p className="text-slate-500 text-[10px] font-medium leading-relaxed mb-3">Enter account profile authorization password key to trigger execution flush sequence permanently.</p>

            <div className="space-y-2.5">
              <input 
                type="password" 
                placeholder="ENTER ACCESS PASSWORD" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-[11px] font-bold text-slate-800 tracking-wider focus:outline-none focus:border-red-600" 
              />
              {authError && <p className="text-red-600 text-[9px] font-black uppercase">⚠️ {authError}</p>}
              <div className="flex gap-1.5 justify-end text-[9px] font-black uppercase">
                <button onClick={() => setIsAuthModalOpen(false)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded">Abort</button>
                <button onClick={executeSecureDelete} className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded shadow-xs">Flush Row</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}