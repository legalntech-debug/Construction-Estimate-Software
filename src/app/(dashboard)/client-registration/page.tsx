'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function ClientRegistrationContent() {
  const searchParams = useSearchParams();
  const [clientCategory, setClientCategory] = useState('');
  const [clientName, setClientName] = useState('');
  const [representative, setRepresentative] = useState('');
  const [countryCode, setCountryCode] = useState('+91 INDIA');
  const [mobileNo, setMobileNo] = useState('');
  const [emailId, setEmailId] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [address, setAddress] = useState('');
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
        setClientCategory(data.client_category || '');
        setClientName(data.client_name || '');
        setRepresentative(data.representative_name || '');
        setCountryCode(data.country_code || '+91 INDIA');
        setMobileNo(data.mobile_no || '');
        setEmailId(data.email_id || '');
        setGstNo(data.gst_no || '');
        setAddress(data.address || '');
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

  // Agar URL mein ID hai, toh seedha update karein
  // Agar URL mein ID hai, toh seedha update karein
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
      .eq('id', Number(clientIdParam));

    if (error) { 
      alert("Update Error: " + error.message); 
      return; 
    }
    alert('CLIENT UPDATED SUCCESSFULLY');
    return;
  }

  const clientId = 'CLI' + Date.now().toString().slice(-4);

  // 4. Insert Logic
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

  if (error) { alert(error.message); return; }
  alert(`CLIENT SAVED : ${clientId}`);
};

 return (
    <div className="p-6">
  <div className="bg-white rounded-xl shadow-md p-6">

    <h1 className="text-2xl font-bold text-blue-900 mb-6">
      {clientIdParam ? 'EDIT CLIENT REGISTRATION' : 'NEW CLIENT REGISTRATION'}
    </h1>

    <div className="grid grid-cols-3 gap-4 mb-4"></div>
    <div className="grid grid-cols-3 gap-4 mb-4">

  {/* CLIENT CATEGORY */}

  <div>
    <label className="font-semibold">
      CLIENT CATEGORY *
    </label>

    <select
      value={clientCategory}
      onChange={(e) => setClientCategory(e.target.value)}
      className="w-full border rounded-lg p-2 mt-1"
    >
      <option value="">
        SELECT CATEGORY
      </option>

      <option value="INDIVIDUAL USER">
        INDIVIDUAL USER
      </option>

      <option value="CONSTRUCTOR">
        CONSTRUCTOR
      </option>

      <option value="ENGINEER">
        ENGINEER
      </option>

      <option value="DSA">
        DSA
      </option>

      <option value="BANKER">
        BANKER
      </option>
    </select>
  </div>

  {/* NAME */}

  <div>
    <label className="font-semibold">

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
  onChange={(e) => setClientName(e.target.value.toUpperCase())}
  className="w-full border rounded-lg p-2 mt-1 uppercase"
/>
  </div>

  {/* REPRESENTATIVE NAME*/}

  <div>
    <label className="font-semibold">
      REPRESENTATIVE NAME*
    </label>

    <input
  type="text"
  value={representative}
  onChange={(e) => setRepresentative(e.target.value.toUpperCase())}
  className="w-full border rounded-lg p-2 mt-1 uppercase"
/>
  </div>

</div>

{/* MOBILE + COUNTRY */}

        <div className="grid grid-cols-2 gap-4 mb-4">

          <div>
            <label className="font-semibold">
              COUNTRY CODE
            </label>

            <select
  value={countryCode}
  onChange={(e) => setCountryCode(e.target.value)}
  className="w-full border rounded-lg p-2 mt-1"
>
              <option>+91 INDIA</option>
              <option>+1 USA</option>
              <option>+44 UK</option>
              <option>+971 UAE</option>
            </select>
          </div>

          <div>
            <label className="font-semibold">
              MOBILE NO *
            </label>

            <input
  type="text"
  maxLength={10}
  value={mobileNo}
  onChange={(e) => setMobileNo(e.target.value)}
  className="w-full border rounded-lg p-2 mt-1"
/>
          </div>

        </div>
        {/* EMAIL + GST */}

        <div className="grid grid-cols-2 gap-4 mb-4">

          <div>
            <label className="font-semibold">
              EMAIL ID *
            </label>

           <input
  type="email"
  value={emailId}
  onChange={(e) => setEmailId(e.target.value)}
  className="w-full border rounded-lg p-2 mt-1"
/>

          </div>

          <div>
            <label className="font-semibold">
              GST NO
            </label>

            <input
  type="text"
  value={gstNo}
  onChange={(e) => setGstNo(e.target.value.toUpperCase())}
  className="w-full border rounded-lg p-2 mt-1 uppercase"
/>

          </div>

        </div>

        {/* ADDRESS */}

        <div className="mb-4">

          <label className="font-semibold">
            ADDRESS *
          </label>

          <textarea
  rows={3}
  value={address}
  onChange={(e) => setAddress(e.target.value.toUpperCase())}
  className="w-full border rounded-lg p-2 mt-1 uppercase"
/>

        </div>

        {/* PLAN */}

        <div className="grid grid-cols-2 gap-4 mb-4">

          <div>
            <label className="font-semibold">
              PLAN TYPE *
            </label>

            <select
            
            
  value={planType}
  
  onChange={(e) => setPlanType(e.target.value)}
  className="w-full border rounded-lg p-2 mt-1"
>
  <option>BASIC</option> <option>PREMIUM</option>
            </select>
            
          </div>

          <div>
            <label className="font-semibold">
              ACCOUNT STATUS *
            </label>

            <select
  value={accountStatus}
  onChange={(e) => setAccountStatus(e.target.value)}
  className="w-full border rounded-lg p-2 mt-1"
  
>
  <option>ACTIVE</option> <option>INACTIVE</option>
            </select>
          </div>

        </div>

        {/* FEES */}

        <div className="grid grid-cols-4 gap-4 mb-6">

          <div>
            <label className="font-semibold">
              ESTIMATE FEE
            </label>

            <input
             type="number"
             value={estimateFee}
             onChange={(e) => setEstimateFee(Number(e.target.value))}
             className="w-full border rounded-lg p-2 mt-1"
          />
          </div>

          <div>
            <label className="font-semibold">
              PLAN FEE
              </label>

            <input
              type="number"
              value={planFee}
              onChange={(e) => setPlanFee(Number(e.target.value))}
              className="w-full border rounded-lg p-2 mt-1"
            />
          </div>

          <div>
            <label className="font-semibold">
              ROUTE MAP FEE
              </label>

            <input
              type="number"
              value={routeMapFee}
              onChange={(e) => setRouteMapFee(Number(e.target.value))}
              className="w-full border rounded-lg p-2 mt-1"
            />
          </div>

          <div>
            <label className="font-semibold">
               DRAFTING FEE
                 </label>

            <input
              type="number"
              value={draftingFee}
             onChange={(e) => setDraftingFee(Number(e.target.value))}
              className="w-full border rounded-lg p-2 mt-1"
            />
          </div>

        </div>

        <button
          onClick={handleSaveClient}
          className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-3 rounded-lg font-semibold"
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