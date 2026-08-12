'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Users, ArrowUpCircle, Printer, FileText, X, MessageCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface PremiumUserBill {
  id: string;
  full_name: string;
  user_code: string;
  email: string;
  mobile: string;
  plan_type: string;
  wallet_balance: number;
  dataSource?: any[];
}

export default function PremiumBillingWidget() {
  const [premiumUsers, setPremiumUsers] = useState<PremiumUserBill[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedUser, setSelectedUser] = useState<PremiumUserBill | null>(null);
  const [userCasesList, setUserCasesList] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState<boolean>(false);
  const [showBillModal, setShowBillModal] = useState<boolean>(false);

  useEffect(() => {
    fetchPremiumBillingData();
  }, []);

  const fetchPremiumBillingData = async () => {
    setLoading(true);
    try {
      const { data: profilesData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, user_code, email, mobile, plan_type, wallet_balance')
        .ilike('plan_type', '%PREMIUM%');

      if (profileError) throw profileError;

      if (profilesData && profilesData.length > 0) {
        const formattedData: PremiumUserBill[] = await Promise.all(
          profilesData.map(async (user: any) => {
            const { data: txData } = await supabase
              .from('wallet_transactions')
              .select('*')
              .eq('user_id', user.id);

            return {
              id: user.id,
              full_name: user.full_name,
              user_code: user.user_code,
              email: user.email,
              mobile: user.mobile,
              plan_type: user.plan_type,
              wallet_balance: user.wallet_balance,
              dataSource: txData || [],
            };
          })
        );
        setPremiumUsers(formattedData);
      } else {
        setPremiumUsers([]);
      }
    } catch (err) {
      console.error('Error fetching premium billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openUserPassbook = async (user: PremiumUserBill) => {
    setSelectedUser(user);
    setShowBillModal(true);
    setLoadingTx(true);
    try {
      const { data: txData, error: txError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (txError) throw txError;
      setUserCasesList(txData || []);
    } catch (err) {
      console.error('Error fetching user transactions/cases:', err);
      setUserCasesList([]);
    } finally {
      setLoadingTx(false);
    }
  };

  const grandTotalBilled = premiumUsers.reduce((acc, u) => {
    const total = (u.dataSource || []).reduce((s: number, tx: any) => {
      if (tx.type === 'DEBIT' || tx.amount > 0) {
        return s + Number(tx.amount || 0);
      }
      return s;
    }, 0);
    return acc + total;
  }, 0);

  // Function to send bill via WhatsApp
  const handleSendWhatsApp = (user: PremiumUserBill) => {
    if (!user.mobile) {
      alert('Subscriber mobile number is not available.');
      return;
    }
    const userBilled = (user.dataSource || []).reduce((s: number, tx: any) => {
      return tx.type === 'DEBIT' ? s + Number(tx.amount || 0) : s;
    }, 0);

    const message = `*L&T CONSULTANT SERVICES - BILL STATEMENT*\n\n` +
      `Hello *${user.full_name}* (${user.user_code}),\n` +
      `Here is your Premium Subscription & Billing Summary:\n\n` +
      `• Plan Type: ${user.plan_type}\n` +
      `• Wallet Balance: ₹ ${user.wallet_balance.toFixed(2)}\n` +
      `• Total Billed Amount: ₹ ${userBilled.toFixed(2)}\n\n` +
      `Thank you for choosing our professional services.`;

    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/${user.mobile.replace(/[^0-9]/g, '')}?text=${encodedMsg}`, '_blank');
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <ShieldCheck className="text-blue-900" size={24} /> Premium Plan Billing & Usage
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Active premium subscribers passbook, case logs, and letterhead bill generation.</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 transition shadow"
        >
          <Printer size={14} /> Print Report
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Premium Users</p>
            <h3 className="text-2xl font-black text-blue-900 mt-1">{premiumUsers.length}</h3>
          </div>
          <div className="p-3 bg-blue-100 text-blue-900 rounded-lg"><Users size={20} /></div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cumulative Billed Amount</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">₹ {grandTotalBilled.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-rose-100 text-rose-600 rounded-lg"><ArrowUpCircle size={20} /></div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs font-bold uppercase">Loading records...</div>
        ) : premiumUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-bold uppercase">No active premium plan users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[10px]">
                  <th className="p-3 w-12">Sr.</th>
                  <th className="p-3">User Code</th>
                  <th className="p-3">Subscriber Name</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Plan Type</th>
                  <th className="p-3 text-right">Wallet Balance</th>
                  <th className="p-3 text-right">Total Billed</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {premiumUsers.map((user, index) => {
                  const userBilled = (user.dataSource || []).reduce((s: number, tx: any) => {
                    return tx.type === 'DEBIT' ? s + Number(tx.amount || 0) : s;
                  }, 0);
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-400">{index + 1}</td>
                      <td className="p-3 font-mono font-bold text-blue-600">{user.user_code}</td>
                      <td className="p-3 font-bold text-slate-900 uppercase">{user.full_name}</td>
                      <td className="p-3 text-slate-600">
                        <div>{user.mobile}</div>
                        <div className="text-[10px] text-slate-400">{user.email}</div>
                      </td>
                      <td className="p-3">
                        <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2 py-0.5 rounded uppercase">
                          {user.plan_type}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-bold ${user.wallet_balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {user.wallet_balance < 0 ? `- ₹ ${Math.abs(user.wallet_balance).toFixed(2)}` : `₹ ${user.wallet_balance.toFixed(2)}`}
                      </td>
                      <td className="p-3 text-right font-black text-rose-600">
                        ₹ {userBilled.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openUserPassbook(user)}
                            className="bg-blue-900 text-white px-2.5 py-1.5 rounded text-[10px] font-bold hover:bg-blue-800 transition flex items-center gap-1 shadow-sm"
                          >
                            <FileText size={12} /> View Bill
                          </button>
                          <button
                            onClick={() => handleSendWhatsApp(user)}
                            className="bg-emerald-600 text-white p-1.5 rounded text-[10px] font-bold hover:bg-emerald-700 transition flex items-center shadow-sm"
                            title="Send Bill via WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BILL & LETTERHEAD MODAL */}
      {showBillModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200 no-print">
              <h3 className="text-base font-black text-slate-900 uppercase">
                Official Letterhead Bill & Case Ledger - {selectedUser.full_name} ({selectedUser.user_code})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSendWhatsApp(selectedUser)}
                  className="bg-emerald-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
                >
                  <MessageCircle size={14} /> Send WhatsApp
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 shadow-sm"
                >
                  <Printer size={14} /> Print / Save PDF
                </button>
                <button
                  onClick={() => setShowBillModal(false)}
                  className="bg-slate-200 text-slate-700 p-2 rounded hover:bg-slate-300"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* LETTERHEAD CONTENT CONTAINER */}
            <div className="bg-white p-6 text-slate-900">
              
              <div className="mb-6 border-b-2 border-black pb-4">
                <div className="grid grid-cols-3 items-center">
                  <div className="text-[12px] uppercase font-bold text-slate-700">
                    <p>IOV APPROVED VALUER A-33162</p>
                    <p>BUILDING PERMISSION DEPARTMENT</p>
                    <p>ENG/172/2024</p>
                  </div>
                  <div className="flex justify-center items-center">
                    <img src="/logo.jpg" alt="Logo" className="h-20 w-auto object-contain" />
                  </div>
                  <div className="text-[12px] text-right font-bold text-slate-700">
                    <p>ADDRESS GROUND FLOOR, BUILDING NO. 180/5,</p>
                    <p>MEGHDOOT NAGAR, INDORE</p>
                    <p>CONTACT NO. 79875-61396</p>
                    <p>Gmail: legalntech@gmail.com</p>
                  </div>
                </div>
                <div className="mt-4 text-[13px] text-center font-bold text-slate-600 uppercase leading-relaxed border-t pt-2">
                  <p>SUBSCRIPTION USAGE, CASE LEDGER & BILL STATEMENT</p>
                  <hr className="w-full border border-black border-collapse mt-2 mb-2"/>
                </div>
                <div className="flex justify-between items-center text-xs mt-2 px-1 font-semibold">
                  <span><strong>USER CODE:</strong> <span className="font-mono font-bold text-blue-700">{selectedUser.user_code}</span></span>
                  <span>DATE: {new Date().toLocaleDateString('en-IN')}</span>
                </div>
              </div>

              <table className="w-full border-collapse mb-6 text-xs">
                <tbody>
                  <tr>
                    <td className="font-bold w-[200px] py-1">SUBSCRIBER NAME</td>
                    <td className="font-bold w-[20px]">:</td>
                    <td className="uppercase font-semibold">{selectedUser.full_name}</td>
                  </tr>
                  <tr>
                    <td className="font-bold py-1">CONTACT / EMAIL</td>
                    <td className="font-bold">:</td>
                    <td>{selectedUser.mobile} | {selectedUser.email}</td>
                  </tr>
                  <tr>
                    <td className="font-bold py-1">CURRENT WALLET BALANCE</td>
                    <td className="font-bold">:</td>
                    <td className={`font-bold ${selectedUser.wallet_balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      ₹ {selectedUser.wallet_balance.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* DETAILED CASES & TRANSACTIONS TABLE */}
              <div className="mb-6">
                <h4 className="font-bold text-xs uppercase mb-2 text-slate-800 bg-slate-100 p-2 border border-black">
                  Detailed Case List & Fee Ledger Log
                </h4>
                {loadingTx ? (
                  <div className="p-4 text-center text-xs text-slate-500">Loading cases and transaction logs...</div>
                ) : userCasesList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 border border-black">No cases or transactions found for this user.</div>
                ) : (
                  <table className="w-full border border-black border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 font-bold uppercase text-[10px]">
                        <th className="border border-black p-2 w-10 text-center">SR</th>
                        <th className="border border-black p-2 w-28">Date</th>
                        <th className="border border-black p-2">Reference / Case / Description</th>
                        <th className="border border-black p-2 w-24 text-center">Type</th>
                        <th className="border border-black p-2 w-28 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userCasesList.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className="border border-black p-2 text-center">{idx + 1}</td>
                          <td className="border border-black p-2">{new Date(item.created_at || Date.now()).toLocaleDateString('en-IN')}</td>
                          <td className="border border-black p-2 font-mono uppercase font-semibold">
                            {item.description || item.reference_id || item.ref_no || 'Platform Construction Estimate Case'}
                          </td>
                          <td className="border border-black p-2 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded text-[9px] ${item.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {item.type || 'DEBIT'}
                            </span>
                          </td>
                          <td className={`border border-black p-2 text-right font-bold ${item.type === 'CREDIT' ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {item.type === 'CREDIT' ? `+ ₹ ${Number(item.amount || 0).toFixed(2)}` : `- ₹ ${Number(item.amount || 0).toFixed(2)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Disclaimer and Signature Footer */}
              <table className="w-full border border-black border-collapse mt-4">
                <tbody>
                  <tr>
                    <td className="border border-black p-4 w-[65%] align-top">
                      <h4 className="font-bold mb-1 text-xs">DISCLAIMER & TERMS:</h4>
                      <p className="text-[10px] text-justify leading-relaxed text-gray-800">
                        This is an official system-generated bill and case statement combining secure platform usage logs and transaction records. Negative wallet balances and outstanding case fees are payable immediately as per professional service agreements.
                      </p>
                    </td>
                    <td className="border border-black p-4 w-[35%] align-top text-center">
                      <div className="flex flex-col items-center">
                        <QRCodeSVG 
                          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/client-dashboard?user=${selectedUser.user_code}`} 
                          size={55} 
                          level="H" 
                        />
                        <p className="text-[8px] mt-1 text-gray-500 font-bold">SCAN TO VERIFY</p>
                      </div>
                      <div className="text-[10px] text-blue-900 border border-blue-200 bg-blue-50 p-2 rounded text-left mt-2 shadow-sm">
                        <p className="font-bold border-b border-blue-200 mb-1">✓ VERIFIED SIGNATURE</p>
                        <p className="font-bold">Er. J.Chouhan</p>
                        <p className="mt-1">Digitally Verified & Approved</p>
                      </div>
                      <div className="border-t border-black pt-2 mt-2">
                        <p className="font-bold text-xs">AUTHORISED SIGNATORY</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}