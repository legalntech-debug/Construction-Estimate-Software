'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function ClientRegistrationContent() {
  const searchParams = useSearchParams();
  const [clientCategory, setClientCategory] = useState('INDIVIDUAL USER');
  const [clientName, setClientName] = useState('DEFAULT CLIENT');
  const [representative, setRepresentative] = useState('SELF');
  const [countryCode, setCountryCode] = useState('+91 INDIA');
  const [mobileNo, setMobileNo] = useState('0000000000');
  const [emailId, setEmailId] = useState('default@example.com');
  const [gstNo, setGstNo] = useState('');
  const [address, setAddress] = useState('DEFAULT ADDRESS');
  const [planType, setPlanType] = useState('BASIC');
  const [accountStatus, setAccountStatus] = useState('ACTIVE');
  
  const [estimateFee, setEstimateFee] = useState(0);
  const [planFee, setPlanFee] = useState(0);
  const [routeMapFee, setRouteMapFee] = useState(0);
  const [draftingFee, setDraftingFee] = useState(0);
  const clientIdParam = searchParams.get('id');

  // URL se ID milne par database se purana data fetch karne ka logic
  useEffect(() => {
    if (!clientIdParam) return;

    const fetchClientData = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .or(`id.eq.${clientIdParam},client_id.eq.${clientIdParam}`)
        .maybeSingle();

      if (error) {
        console.error("Error fetching client:", error);
        return;
      }

      if (data) {
        setClientCategory(data.client_category || 'INDIVIDUAL USER');
        setClientName(data.client_name || 'DEFAULT CLIENT');
        setRepresentative(data.representative_name || 'SELF');
        setCountryCode(data.country_code || '+91 INDIA');
        setMobileNo(data.mobile_no || '0000000000');
        setEmailId(data.email_id || 'default@example.com');
        setGstNo(data.gst_no || '');
        setAddress(data.address || 'DEFAULT ADDRESS');
        setPlanType(data.plan_type || 'BASIC');
        setAccountStatus(data.account_status || 'ACTIVE');
        setEstimateFee(data.estimate_fee || 0);
        setPlanFee(data.plan_fee || 0);
        setRouteMapFee(data.route_map_fee || 0);
        setDraftingFee(data.drafting_fee || 0);
      }
    };

    fetchClientData();
  }, [clientIdParam]);

  const handleSaveClient = async () => {
    // 1. Validation Logic
    const requiredFields = {
      clientCategory, clientName, representative, mobileNo, 
      address, planType, accountStatus, estimateFee, planFee, routeMapFee, draftingFee
    };

    const hasEmptyField = Object.entries(requiredFields).some(([key, value]) => {
      return value === "" || value === 0 || value === null;
    });

    if (hasEmptyField) {
      alert("PLEASE FILL ALL REQUIRED FIELDS (Email and GST are optional)");
      return;
    }

    // 2. Auth Session
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    if (!userId) {
      alert("User session not found. Please log in again.");
      return;
    }

    // 3. Duplicate Check with English Warning & Details
    if (!clientIdParam) {
      const { data: existingClients, error: checkError } = await supabase
        .from('clients')
        .select('client_id, client_name, representative_name, mobile_no, email_id')
        .eq('user_id', userId)
        .or(`mobile_no.eq.${mobileNo},email_id.eq.${emailId}`);

      if (checkError) {
        console.error("Error checking duplicate:", checkError);
      } else if (existingClients && existingClients.length > 0) {
        const matchedClient = existingClients[0];
        const confirmSave = window.confirm(
          `This Mobile Number or Email is already registered with Client Name: "${matchedClient.client_name}" and Representative Name: "${matchedClient.representative_name}". Do you still want to register this client with the same details?`
        );
        if (!confirmSave) {
          return;
        }
      }
    }

    // 4. Update Logic
    if (clientIdParam) {
      console.log("Updating client with ID:", clientIdParam);

      const { error } = await supabase
        .from('clients')
        .update({
          client_category: clientCategory,
          client_name: clientName,
          representative_name: representative,
          country_code: countryCode,
          mobile_no: mobileNo,
          email_id: emailId,
          gst_no: gstNo,
          address: address,
          plan_type: planType,
          account_status: accountStatus,
          estimate_fee: estimateFee,
          plan_fee: planFee,
          route_map_fee: routeMapFee,
          drafting_fee: draftingFee,
          user_id: userId
        })
        .or(`id.eq.${clientIdParam},client_id.eq.${clientIdParam}`);

      if (error) { 
        alert("Update Error: " + error.message); 
        return; 
      }
      alert('CLIENT UPDATED SUCCESSFULLY');
      return;
    }

    const clientId = 'CLI' + Date.now().toString().slice(-4);

    // 5. Insert Logic
    const { error } = await supabase
      .from('clients')
      .insert([{
        user_id: userId,
        client_id: clientId,
        client_category: clientCategory,
        client_name: clientName,
        representative_name: representative,
        country_code: countryCode,
        mobile_no: mobileNo,
        email_id: emailId,
        gst_no: gstNo,
        address: address,
        plan_type: planType,
        account_status: accountStatus,
        estimate_fee: estimateFee,
        plan_fee: planFee,
        route_map_fee: routeMapFee,
        drafting_fee: draftingFee,
      }]);

    if (error) { 
      alert("Save Error: " + error.message); 
      return; 
    }
    
    alert(`CLIENT SAVED : ${clientId}`);
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">

        <h1 className="text-xl sm:text-2xl font-bold text-blue-900 mb-6">
          {clientIdParam ? 'EDIT CLIENT REGISTRATION' : 'NEW CLIENT REGISTRATION'}
        </h1>

        {/* TOP ROW: Client Category, Client Name, Representative Name (3 cols on desktop, 2 cols on mobile) */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
          {/* CLIENT CATEGORY */}
          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">
              CLIENT CATEGORY *
            </label>
            <select
              value={clientCategory}
              onChange={(e) => setClientCategory(e.target.value)}
              className="w-full border rounded-lg p-2 mt-1 text-xs sm:text-sm bg-white"
            >
              <option value="">SELECT CATEGORY</option>
              <option value="INDIVIDUAL USER">INDIVIDUAL USER</option>
              <option value="CONSTRUCTOR">CONSTRUCTOR</option>
              <option value="ENGINEER">ENGINEER</option>
              <option value="DSA">DSA</option>
              <option value="BANKER">BANKER</option>
            </select>
          </div>

          {/* NAME */}
          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">
              {clientCategory === 'BANKER'
                ? 'BANK NAME *'
                : clientCategory === 'DSA'
                ? 'DSA FIRM NAME *'
                : clientCategory === 'CONSTRUCTOR'
                ? 'COMPANY NAME *'
                : clientCategory === 'ENGINEER'
                ? 'ENGINEER NAME *'
                : 'CLIENT NAME *'}
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value.replace(/\s+/g, ' ').toUpperCase())}
              onBlur={(e) => setClientName(e.target.value.trim().replace(/\s+/g, ' ').toUpperCase())}
              className="w-full border rounded-lg p-2 mt-1 uppercase text-xs sm:text-sm"
            />
          </div>

          {/* REPRESENTATIVE NAME */}
          <div className="col-span-2 lg:col-span-1">
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">
              REPRESENTATIVE NAME *
            </label>
            <input
              type="text"
              value={representative}
              onChange={(e) => setRepresentative(e.target.value.replace(/\s+/g, ' ').toUpperCase())}
              onBlur={(e) => setRepresentative(e.target.value.trim().replace(/\s+/g, ' ').toUpperCase())}
              className="w-full border rounded-lg p-2 mt-1 uppercase text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* MOBILE + COUNTRY */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">
              COUNTRY CODE
            </label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full border rounded-lg p-2 mt-1 text-xs sm:text-sm bg-white"
            >
              <option>+91 INDIA</option>
              <option>+1 USA</option>
              <option>+44 UK</option>
              <option>+971 UAE</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">
              MOBILE NO *
            </label>
            <input
              type="text"
              maxLength={10}
              value={mobileNo}
              onChange={(e) => setMobileNo(e.target.value)}
              className="w-full border rounded-lg p-2 mt-1 text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* EMAIL + GST */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">
              EMAIL ID *
            </label>
            <input
              type="email"
              value={emailId}
              onChange={(e) => setEmailId(e.target.value)}
              className="w-full border rounded-lg p-2 mt-1 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">
              GST NO
            </label>
            <input
              type="text"
              value={gstNo}
              onChange={(e) => setGstNo(e.target.value.toUpperCase())}
              className="w-full border rounded-lg p-2 mt-1 uppercase text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* ADDRESS */}
        <div className="mb-4">
          <label className="font-semibold text-[10px] sm:text-xs text-slate-700">
            ADDRESS *
          </label>
          <textarea
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value.toUpperCase())}
            className="w-full border rounded-lg p-2 mt-1 uppercase text-xs sm:text-sm"
          />
        </div>

        {/* PLAN */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">
              PLAN TYPE *
            </label>
            <select
              value={planType}
              onChange={(e) => setPlanType(e.target.value)}
              className="w-full border rounded-lg p-2 mt-1 text-xs sm:text-sm bg-white"
            >
              <option>BASIC</option> 
              <option>PREMIUM</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">
              ACCOUNT STATUS *
            </label>
            <select
              value={accountStatus}
              onChange={(e) => setAccountStatus(e.target.value)}
              className="w-full border rounded-lg p-2 mt-1 text-xs sm:text-sm bg-white"
            >
              <option>ACTIVE</option> 
              <option>INACTIVE</option>
            </select>
          </div>
        </div>

        {/* FEES (4 cols on desktop, 2 cols on mobile) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">ESTIMATE FEE</label>
            <input
               type="number"
               value={estimateFee}
               onChange={(e) => setEstimateFee(Number(e.target.value))}
               className="w-full border rounded-lg p-2 mt-1 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">PLAN FEE</label>
            <input
              type="number"
              value={planFee}
              onChange={(e) => setPlanFee(Number(e.target.value))}
              className="w-full border rounded-lg p-2 mt-1 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">ROUTE MAP FEE</label>
            <input
              type="number"
              value={routeMapFee}
              onChange={(e) => setRouteMapFee(Number(e.target.value))}
              className="w-full border rounded-lg p-2 mt-1 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="font-semibold text-[10px] sm:text-xs text-slate-700">DRAFTING FEE</label>
            <input
              type="number"
              value={draftingFee}
              onChange={(e) => setDraftingFee(Number(e.target.value))}
              className="w-full border rounded-lg p-2 mt-1 text-xs sm:text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleSaveClient}
          className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white px-8 py-3 rounded-lg font-semibold text-sm transition-all"
        >
          {clientIdParam ? 'UPDATE CLIENT' : 'SAVE CLIENT'}
        </button>

      </div>
    </div>
  );
}

export default function ClientRegistration() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-blue-900 font-semibold">Loading...</div>}>
      <ClientRegistrationContent />
    </Suspense>
  );
}