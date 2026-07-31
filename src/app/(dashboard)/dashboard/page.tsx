'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

/* CARD COMPONENT */
function Card({ title, value, color }: any) {
  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition">
      <p className="text-xs text-gray-400">{title}</p>
      <h2 className={`text-2xl font-bold ${color}`}>{value}</h2>
    </div>
  );
}

export default function DashboardPage() {
  
  const router = useRouter();
  const [userData, setUserData] = useState<any>({email: '', id: '', name: 'Loading...', wallet: 0 });
  const [estimateList, setEstimateList] = useState<any[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [filterType, setFilterType] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [refWidth, setRefWidth] = useState(240); 
  const [clientWidth, setClientWidth] = useState(240);

  // Modal State for Transaction History
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Search Filters States
  const [refSearch, setRefSearch] = useState(''); // <-- Naya State Ref No. ke liye
  const [clientSearch, setClientSearch] = useState('');
  const [representativeSearch, setRepresentativeSearch] = useState('');

  useEffect(() => {
   const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const userEmail = user.email || '';
      const isAdmin = profile?.role === 'admin' || userEmail === 'admin@lnt.com'; 

      setUserData({
        email: userEmail,
        id: profile?.user_code || user.id.slice(0, 8),
        name: profile?.full_name || "Guest User",
        wallet: 0,
        planType: profile?.plan_type || 'BASIC ENGINE PLAN',
        isAdmin: isAdmin
      });

      let query = supabase
        .from('mis_records')
        .select('*')
        .order('created_date', { ascending: true });

      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error: recordsError } = await query;

      
      if (data) setEstimateList(data);
    };

    fetchData();
  }, []);

  // REF NO COLUMN RESIZE HANDLER
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = refWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentWidth = startWidth + (moveEvent.clientX - startX);
      if (currentWidth > 120) { 
        setRefWidth(currentWidth);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // CLIENT COLUMN RESIZE HANDLER
  const handleClientMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = clientWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentWidth = startWidth + (moveEvent.clientX - startX);
      if (currentWidth > 120) { 
        setClientWidth(currentWidth);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const totalValue = estimateList.reduce(
    (sum, i) => sum + Number(i.fee_standard || i.total_value || 0),
    0
  );

  const receivedAmount = estimateList
    .filter(i => (i.status || '').toUpperCase() === 'RECEIVED')
    .reduce((sum, i) => sum + Number(i.fee_standard || i.total_value || 0), 0);

  const pendingAmount = totalValue - receivedAmount;

  // Filter pipeline engine logic updated with Ref No. search
  const filteredList = estimateList.filter(item => {
    const currentStatus = (item.status || 'PENDING').toUpperCase();
    if (filterType === 'Paid' && currentStatus !== 'RECEIVED') return false;
    if (filterType === 'Pending' && currentStatus === 'RECEIVED') return false;

    // Ref No. Filter Logic
    const itemRef = (item.ref_no || '').toLowerCase();
    if (refSearch && !itemRef.includes(refSearch.toLowerCase())) return false;

    const itemClient = (item.client || item.client_name || '').toLowerCase();
    if (clientSearch && !itemClient.includes(clientSearch.toLowerCase())) return false;

    const itemRep = (item.representative || item.rep_name || '').toLowerCase();
    if (representativeSearch && !itemRep.includes(representativeSearch.toLowerCase())) return false;

    return true;
  });

  return (
    <div className="p-6 space-y-6 relative">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">
          {userData.isAdmin ? 'LNT ADMIN DASHBOARD (ALL RECORDS)' : 'LNT DASHBOARD'}
        </h1>

        {/* PROFILE */}
        <div className="relative">
          <div
            onClick={() => setShowProfile(!showProfile)}
            className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold cursor-pointer"
          >
            {userData?.email?.charAt(0).toUpperCase()}
          </div>

          {showProfile && (
            <div className="absolute right-0 mt-3 w-80 bg-white shadow-2xl rounded-2xl border border-slate-100 z-50 overflow-hidden text-slate-700 font-sans">
              <div className="bg-blue-600 p-4 text-white flex items-center gap-3">
                <div className="bg-blue-500/30 p-2 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <span className="font-bold text-sm tracking-wider uppercase">
                  {userData.isAdmin ? 'ADMIN ACCOUNT' : 'ACCOUNT STATUS'}
                </span>
              </div>

              <div className="p-4 space-y-4">
                <div className="space-y-3 pb-4 border-b border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span className="font-semibold uppercase">USER NAME</span>
                    </div>
                    <span className="font-extrabold text-slate-900 uppercase">{userData.name}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span className="font-semibold uppercase">USER EMAIL</span>
                    </div>
                    <span className="font-bold text-slate-900">{userData?.email}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span className="font-semibold uppercase">SYSTEM ID</span>
                    </div>
                    <span className="font-bold text-slate-900">{userData?.id}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-3 text-slate-500">
                    <span className="font-bold uppercase text-slate-700">PLAN TYPE</span>
                  </div>
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-md font-extrabold tracking-wide text-[10px] uppercase">
                    {userData?.planType || 'BASIC ENGINE PLAN'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">WALLET AMOUNT</p>
                      <p className="text-lg font-black text-slate-900">₹ {userData?.wallet?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-5 py-2 rounded-lg transition shadow-md shadow-blue-200 uppercase tracking-wider">
                    RECHARGE
                  </button>
                </div>

                <div className="space-y-1 text-xs font-bold">
                  <button 
                    onClick={() => router.push('/edit-profile')} 
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition group"
                  >
                    <span className="uppercase tracking-wide">EDIT PROFILE</span>
                  </button>

                  <button 
                    onClick={async () => {
                      try {
                        await supabase.from('profiles').update({ is_online: false }).eq('id', userData.id);
                        await supabase.auth.signOut();
                        router.push('/verify-estimate');
                      } catch (error) {
                        
                      }
                    }}
                    className="w-full flex items-center p-3 rounded-xl hover:bg-red-50 text-red-600 transition group mt-2"
                  >
                    <span className="uppercase tracking-wide">LOGOUT</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-4 gap-4">
        <Card title="TOTAL" value={totalValue} color="text-slate-800" />
        <Card title="RECEIVED" value={receivedAmount} color="text-green-600" />
        <Card title="PENDING" value={pendingAmount} color="text-red-600" />
        <Card title="ESTIMATES" value={estimateList.length} color="text-blue-600" />
      </div>

      {/* FILTER BAR */}
      <div className="flex gap-3">
        {['All', 'Paid', 'Pending'].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type as any)}
            className={`px-4 py-1 rounded-full text-sm border ${
              filterType === type ? 'bg-blue-600 text-white' : 'bg-white'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-slate-100">
        <table className="w-full text-left border-collapse table-fixed min-w-[1350px]">
          <thead>
            <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider text-center select-none">
              
              {/* Resizable Ref No. Column with Filter Input */}
              <th style={{ width: `${refWidth}px` }} className="p-2 text-center relative group">
                <div className="flex flex-col gap-1 items-center">
                  <span className="px-1 text-[10px] font-bold text-slate-300">REF NO</span>
                  <input
                    type="text"
                    placeholder="Filter Ref No..."
                    value={refSearch}
                    onChange={(e) => setRefSearch(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-white text-center focus:outline-none focus:border-blue-400 font-normal placeholder:text-slate-500"
                  />
                </div>
                <div onMouseDown={handleMouseDown} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent group-hover:bg-blue-500 cursor-col-resize transition-colors z-10" />
              </th>

              <th className="p-3 font-semibold w-24 text-center">DATE</th>
              <th className="p-3 font-semibold w-52 text-center">CUSTOMER NAME</th>
              
              {/* Resizable Client Column */}
              <th style={{ width: `${clientWidth}px` }} className="p-2 text-center relative group">
                <div className="flex flex-col gap-1 items-center">
                  <span className="px-1 text-[10px] font-bold text-slate-300">CLIENT</span>
                  <input
                    type="text"
                    placeholder="Filter Client..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-white text-center focus:outline-none focus:border-blue-400 font-normal placeholder:text-slate-500"
                  />
                </div>
                <div onMouseDown={handleClientMouseDown} className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent group-hover:bg-blue-500 cursor-col-resize transition-colors z-10" />
              </th>

              {/* Representative Column */}
              <th className="p-2 w-48 text-center">
                <div className="flex flex-col gap-1 items-center">
                  <span className="px-1 text-[10px] font-bold text-slate-300">REPRESENTATIVE</span>
                  <input
                    type="text"
                    placeholder="Filter Rep..."
                    value={representativeSearch}
                    onChange={(e) => setRepresentativeSearch(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-white text-center focus:outline-none focus:border-blue-400 font-normal placeholder:text-slate-500"
                  />
                </div>
              </th>

              <th className="p-3 font-semibold w-48 text-center">CASE TYPE</th>
              <th className="p-3 font-semibold w-28 text-center">FEE STANDARD</th>
              <th className="p-3 font-semibold w-28 text-center">STATUS</th>
              <th className="p-3 font-semibold w-36 text-center">TRANSACTION</th>
            </tr>
          </thead>
          
          <tbody>
            {filteredList.map(est => {
              const dateSource = est.created_date || est.created_at;
              const dateObj = dateSource ? new Date(dateSource) : null;
              const formattedDate = dateObj 
                ? `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`
                : '-';

              let cleanCustomerName = est.customer_name || '-';
              const match = cleanCustomerName.match(/^(.*?)\s+(s\/o|d\/o|w\/o|c\/o|S\/O|D\/O|W\/O|C\/O)\b/i);
              if (match && match[1]) {
                cleanCustomerName = match[1].trim();
              }

              return (
                <tr key={est.id} className="border-t hover:bg-slate-50 text-xs font-sans tracking-wide">
                  <td className="p-3 font-bold text-blue-600 uppercase whitespace-nowrap overflow-hidden text-ellipsis">
                    {est.ref_no}
                  </td>
                  <td className="p-3 text-slate-600 text-center whitespace-nowrap">{formattedDate}</td>
                  <td className="p-3 font-extrabold text-slate-800 uppercase whitespace-nowrap overflow-hidden text-ellipsis">
                    {cleanCustomerName.replace(/[,.]\s*$/, '')}
                  </td>
                  <td className="p-3 font-bold text-slate-700 uppercase text-center truncate">
                    {est.client_name || '-'}
                  </td>
                  <td className="p-3 font-semibold text-slate-600 uppercase text-center truncate">
                    {est.representative || '-'}
                  </td>
                  <td className="p-3 font-black text-slate-900 uppercase text-center whitespace-nowrap">
                    {est.case_type || 'NEW CONSTRUCTION'}
                  </td>
                  <td className="p-3 font-bold text-slate-800 text-center whitespace-nowrap">
                    ₹{est.fee_standard || '0'}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                      (est.status || 'PENDING').toUpperCase() === 'RECEIVED' ? 'bg-emerald-100 text-emerald-600' :
                      (est.status || 'PENDING').toUpperCase() === 'WAIVED' ? 'bg-slate-100 text-slate-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {(est.status || 'PENDING').toUpperCase()}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() => {
                        setSelectedTxn(est);
                        setIsModalOpen(true);
                      }}
                      className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1 rounded-lg text-xs transition border border-blue-200"
                    >
                      View History
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* TRANSACTION HISTORY MODAL POPUP */}
      {isModalOpen && selectedTxn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-base">Transaction History</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Reference No:</span>
                <span className="font-bold text-blue-600">{selectedTxn.ref_no}</span>
              </div>
              
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">User Name:</span>
                <span className="font-bold text-slate-800 uppercase">
                  {selectedTxn.ref_no ? selectedTxn.ref_no.split('/')[2] : 'N/A'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Customer Name:</span>
                <span className="font-bold text-slate-800 uppercase">{selectedTxn.customer_name}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Case Type:</span>
                <span className="font-bold text-slate-900 uppercase">{selectedTxn.case_type || selectedTxn.estimate_type || 'NEW CONSTRUCTION'}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Amount Paid:</span>
                <span className="font-extrabold text-emerald-600 text-sm">₹ {Number(selectedTxn.user_payment || selectedTxn.fee_standard || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Razorpay Payment ID:</span>
                <span className="font-mono font-semibold text-slate-800">{selectedTxn.razorpay_payment_id}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 font-medium">Date & Time:</span>
                <span className="font-semibold text-slate-700">
                  {new Date(selectedTxn.created_at || selectedTxn.created_date || Date.now()).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="text-xs text-gray-400 text-center pt-4">
        © 2026 LNT WITH AI 2.0 RIGHTS RESERVED
      </div>

    </div>
  );
}