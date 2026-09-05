'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import SystemAlerts from '@/app/components/SystemAlerts';
import PushNotificationManager from '@/components/PushNotificationManager';

// Local Widgets
import AdminBroadcastWidget from '../admin-dashboard/components/AdminBroadcastWidget';
import AdminCreateUserWidget from '../admin-dashboard/components/AdminCreateUserWidget';
import AdminPendingApprovalsWidget from '../admin-dashboard/components/AdminPendingApprovalsWidget';
import BusinessProfitSharingWidget from '../admin-dashboard/components/BusinessProfitSharingWidget';

export default function AccessControlPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  // Verification Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [inputUserCode, setInputUserCode] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAccessControlData = async () => {
    setLoading(true);
    try {
      // 1. Fetch current logged-in user session & profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUserProfile(profileData);
      }

      // 2. Fetch all profiles directly from profiles table (Bypassing RPC)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      let sortedProfiles = profilesData || [];
      sortedProfiles.sort((a: any, b: any) => {
        const nameA = (a.full_name || '').toLowerCase();
        const nameB = (b.full_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setProfiles(sortedProfiles);
    } catch (err) {
      console.error('Error fetching access control data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessControlData();
  }, []);

  // Admin Security Check
  const isCurrentUserAdmin = 
    currentUserProfile?.role === 'admin' || 
    (currentUserProfile?.email || '').toLowerCase() === 'legalntech@gmail.com';

  const handleOpenSuspendModal = (user: any) => {
    if (!isCurrentUserAdmin) {
      alert('Unauthorized: Only Admin accounts can modify user status.');
      return;
    }
    setTargetUser(user);
    setInputUserCode('');
    setInputPassword('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleVerifyAndSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setVerifying(true);

    try {
      // 1. Verify User Code against current admin's profile record
      if (inputUserCode.trim() !== currentUserProfile?.user_code) {
        setErrorMsg('Invalid Admin User Code. Action denied.');
        setVerifying(false);
        return;
      }

      // 2. Verify Auth Password via Supabase Auth Re-authentication
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentUserProfile?.email,
        password: inputPassword,
      });

      if (authError) {
        setErrorMsg('Invalid Password. Verification failed.');
        setVerifying(false);
        return;
      }

      // 3. Status Toggle Logic
      const newStatus = targetUser.status === 'suspended' ? 'active' : 'suspended';

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', targetUser.id);

      if (updateError) {
        setErrorMsg('Failed to update user status: ' + updateError.message);
      } else {
        setModalOpen(false);
        fetchAccessControlData();
      }
    } catch (err: any) {
      setErrorMsg('An error occurred during verification.');
    } finally {
      setVerifying(false);
    }
  };

  const filteredProfiles = profiles.filter((p: any) => {
    const query = searchQuery.toLowerCase();
    const name = (p.full_name || '').toLowerCase();
    const email = (p.email || '').toLowerCase();
    const mobile = (p.mobile || '').toLowerCase();
    const category = (p.user_type || '').toLowerCase();
    const firm = (p.firm_name || '').toLowerCase();
    return name.includes(query) || email.includes(query) || mobile.includes(query) || category.includes(query) || firm.includes(query);
  });

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-gray-500 text-xs tracking-widest font-mono">
        LOADING ACCESS & CONTROL CENTER...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-slate-50/50 min-h-screen space-y-8 font-sans antialiased text-slate-950 relative select-none">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Access Control & User Management
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-purple-50 text-purple-600 rounded-full border border-purple-100">
              RBAC Engine Active
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage user roles, lock statuses, account suspensions, and platform access privileges.
          </p>
        </div>

        <SystemAlerts type="status" message="SECURITY SECURE" />
      </div>

      {/* Push Notification & Administrative Widgets */}
      <PushNotificationManager />
      <AdminBroadcastWidget />
      <AdminCreateUserWidget onUserCreated={fetchAccessControlData} />
      <AdminPendingApprovalsWidget onActionComplete={fetchAccessControlData} />

      {/* Business Profit Sharing Module */}
      <BusinessProfitSharingWidget />

      {/* RBAC Table (Desktop) & Cards Layout (Mobile) Panel */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base">User Privilege & Account Security (RBAC)</h3>
            <p className="text-xs text-slate-500">View live lock statuses, categories, firm names, and toggle account suspensions.</p>
          </div>
          <div className="w-full sm:w-80">
            <input 
              type="text"
              placeholder="🔍 Search name, email, mobile, category, firm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            />
          </div>
        </div>

        {/* 1. DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto pt-2">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-3 rounded-l-xl">User Details</th>
                <th className="p-3">Mobile No.</th>
                <th className="p-3">Category</th>
                <th className="p-3">Firm Name</th>
                <th className="p-3 text-center">Wallet Balance</th>
                <th className="p-3 text-center">Lock Status</th>
                <th className="p-3">Assigned Role</th>
                <th className="p-3">Account Status</th>
                <th className="p-3 rounded-r-xl text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map((p: any) => {
                  const userId = p.id;
                  const walletBalance = Number(p.wallet_balance ?? 0);
                  const userPlan = (p.plan_type || '').toUpperCase();
                  const role = (p.role || '').toLowerCase();
                  
                  const isAdminUser = role === 'admin' || (p.email || '').toLowerCase() === 'legalntech@gmail.com';
                  const isPremium = userPlan.includes('PREMIUM') || role === 'premium';
                  
                  const isMarketingSupport = role === 'marketing_support' || role === 'marketing & support' || role === 'marketing' || role === 'support';
                  const isInvestor = role === 'investor';
                  const isSpecialRole = isMarketingSupport || isInvestor;
                  
                  const isExempt = isAdminUser || isPremium || isSpecialRole;
                  const isLocked = !isExempt && walletBalance < 100;

                  return (
                    <tr key={userId} className="hover:bg-slate-50/50 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{p.full_name || 'N/A'}</div>
                        <div className="text-xs text-slate-500">{p.email || 'No Email'}</div>
                        {p.plan_type && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 rounded">
                            Plan: {p.plan_type}
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-slate-700 font-medium">{p.mobile || 'N/A'}</td>

                      <td className="p-3 text-slate-700 font-medium">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
                          {p.user_type || 'N/A'}
                        </span>
                      </td>

                      <td className="p-3 text-slate-700 font-medium">
                        <span className="text-xs font-semibold text-slate-600">
                          {p.firm_name || 'N/A'}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <span className={`px-3 py-1 rounded-xl font-black text-xs border ${
                          walletBalance < 0 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : walletBalance === 0 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {walletBalance < 0 ? `- ₹ ${Math.abs(walletBalance).toLocaleString('en-IN')}` : `₹ ${walletBalance.toLocaleString('en-IN')}`}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        {isAdminUser ? (
                          <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-[10px] font-extrabold uppercase">Admin</span>
                        ) : isMarketingSupport ? (
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-extrabold uppercase">Support</span>
                        ) : isInvestor ? (
                          <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-lg text-[10px] font-extrabold uppercase">Investor</span>
                        ) : isPremium ? (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-extrabold uppercase">Exempt</span>
                        ) : isLocked ? (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-extrabold uppercase animate-pulse">
                            🔒 Locked
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-extrabold uppercase">
                            🟢 Active
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          role === 'admin' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 
                          role === 'premium' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                          isMarketingSupport ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          isInvestor ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {isMarketingSupport ? 'Marketing & Support' : isInvestor ? 'Investor' : (p.role || 'user')}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${p.status === 'suspended' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {p.status || 'Active'}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="inline-flex gap-2">
                          <button 
                            disabled={!isCurrentUserAdmin}
                            onClick={() => handleOpenSuspendModal(p)}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                              !isCurrentUserAdmin
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : p.status === 'suspended'
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                            }`}
                          >
                            {p.status === 'suspended' ? 'Activate' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400 text-sm">No profiles match your search criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 2. MOBILE CARDS VIEW */}
        <div className="block md:hidden space-y-3 pt-2">
          {filteredProfiles.length > 0 ? (
            filteredProfiles.map((p: any) => {
              const userId = p.id;
              const walletBalance = Number(p.wallet_balance ?? 0);
              const userPlan = (p.plan_type || '').toUpperCase();
              const role = (p.role || '').toLowerCase();
              
              const isAdminUser = role === 'admin' || (p.email || '').toLowerCase() === 'legalntech@gmail.com';
              const isPremium = userPlan.includes('PREMIUM') || role === 'premium';
              
              const isMarketingSupport = role === 'marketing_support' || role === 'marketing & support' || role === 'marketing' || role === 'support';
              const isInvestor = role === 'investor';
              const isSpecialRole = isMarketingSupport || isInvestor;
              
              const isExempt = isAdminUser || isPremium || isSpecialRole;
              const isLocked = !isExempt && walletBalance < 100;

              return (
                <div key={userId} className="bg-slate-50/80 border border-slate-200/80 p-4 rounded-2xl space-y-3 shadow-xs">
                  <div className="flex justify-between items-start gap-2 border-b border-slate-200/60 pb-3">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{p.full_name || 'N/A'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{p.email || 'No Email'}</div>
                      {p.plan_type && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-bold bg-purple-50 text-purple-700 rounded border border-purple-100">
                          Plan: {p.plan_type}
                        </span>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase shrink-0 ${p.status === 'suspended' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {p.status || 'Active'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Mobile No.</span>
                      <span className="font-semibold text-slate-700 mt-0.5 block">{p.mobile || 'N/A'}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Wallet Balance</span>
                      <span className={`font-black text-xs mt-0.5 block ${
                        walletBalance < 0 
                          ? 'text-rose-600' 
                          : walletBalance === 0 
                          ? 'text-amber-600' 
                          : 'text-emerald-600'
                      }`}>
                        {walletBalance < 0 ? `- ₹ ${Math.abs(walletBalance).toLocaleString('en-IN')}` : `₹ ${walletBalance.toLocaleString('en-IN')}`}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Category (Type)</span>
                      <span className="font-semibold text-slate-700 mt-0.5 block truncate">{p.user_type || 'N/A'}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Firm Name</span>
                      <span className="font-semibold text-slate-700 mt-0.5 block truncate">{p.firm_name || 'N/A'}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Lock Status</span>
                      <div className="mt-1">
                        {isAdminUser ? (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-extrabold uppercase">Admin</span>
                        ) : isMarketingSupport ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-extrabold uppercase">Support</span>
                        ) : isInvestor ? (
                          <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-[9px] font-extrabold uppercase">Investor</span>
                        ) : isPremium ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-extrabold uppercase">Exempt</span>
                        ) : isLocked ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-extrabold uppercase animate-pulse">🔒 Locked</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-extrabold uppercase">🟢 Active</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Assigned Role</span>
                      <span className="font-bold text-slate-700 text-xs mt-1 block truncate">
                        {isMarketingSupport ? 'Marketing & Support' : isInvestor ? 'Investor' : (p.role || 'user')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button 
                      disabled={!isCurrentUserAdmin}
                      onClick={() => handleOpenSuspendModal(p)}
                      className={`w-full py-2 text-xs font-bold rounded-xl transition ${
                        !isCurrentUserAdmin
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : p.status === 'suspended'
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                      }`}
                    >
                      {p.status === 'suspended' ? 'Activate User Account' : 'Suspend User Account'}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-slate-400 text-sm">No profiles match your search criteria.</div>
          )}
        </div>
      </div>

      {/* Security Re-Authentication Modal */}
      {modalOpen && targetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Admin Security Verification</h3>
              <p className="text-xs text-slate-500 mt-1">
                To {targetUser.status === 'suspended' ? 'activate' : 'suspend'} <span className="font-semibold text-slate-800">{targetUser.full_name}</span>, enter your profile **User Code** and account **Password**.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleVerifyAndSuspend} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admin Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UC-10294"
                  value={inputUserCode}
                  onChange={(e) => setInputUserCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admin Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {verifying ? 'Verifying...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}