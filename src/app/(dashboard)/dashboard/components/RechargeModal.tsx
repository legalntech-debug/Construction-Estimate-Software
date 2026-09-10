'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData?: any;
  onRechargeSubmitted?: () => Promise<void> | void;
  upiId?: string;
  helplineNo?: string;
}

export default function RechargeModal({
  isOpen,
  onClose,
  userData,
  onRechargeSubmitted,
  upiId = '9669562719-3@axl',
  helplineNo = '7987561396'
}: RechargeModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [amount, setAmount] = useState<string>('');
  const [utr, setUtr] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [desktopNotice, setDesktopNotice] = useState<boolean>(false);
  
  // Status states
  const [latestStatus, setLatestStatus] = useState<string | null>(null);
  const [adminRemark, setAdminRemark] = useState<string | null>(null);
  const [userRecharges, setUserRecharges] = useState<any[]>([]);

  // Fetch user's recharge history and latest status when modal opens
  useEffect(() => {
    if (isOpen && userData) {
      fetchUserRecharges();
    } else {
      setLatestStatus(null);
      setAdminRemark(null);
      setUserRecharges([]);
      setStep(1);
      setUtr('');
    }
  }, [isOpen, userData]);

  const fetchUserRecharges = async () => {
    try {
      const userId = userData?.uuid || userData?.id;
      const userEmail = userData?.email;

      let query = supabase
        .from('wallet_recharges')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      } else if (userEmail) {
        query = query.eq('user_email', userEmail);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        setUserRecharges(data);
        setLatestStatus(data[0].status);
        setAdminRemark(data[0].admin_remark);
      }
    } catch (err) {
      console.error('Error fetching recharge history:', err);
    }
  };

  if (!isOpen) return null;

  const payeeName = 'DRC Consultation';
  const transactionNote = 'Wallet Recharge';
  const rawUpiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount || '0'}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

  const handleUpiPayment = (appScheme?: string) => {
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    let targetLink = rawUpiUrl;

    if (appScheme === 'gpay') {
      targetLink = `gpay://upi/pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;
    } else if (appScheme === 'phonepe') {
      targetLink = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;
    } else if (appScheme === 'paytm') {
      targetLink = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;
    }

    navigator.clipboard.writeText(upiId);

    const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      window.location.href = targetLink;
      setTimeout(() => setStep(2), 2000);
    } else {
      setDesktopNotice(true);
      setTimeout(() => setDesktopNotice(false), 5000);
    }
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    const cleanUtr = utr.trim();
    if (cleanUtr.length < 12) {
      alert('Please enter a valid 12-digit UTR / Reference number');
      return;
    }

    try {
      setLoading(true);

      // Check if this exact UTR was already rejected 2 or more times
      const { data: utrHistory, error: utrCheckErr } = await supabase
        .from('wallet_recharges')
        .select('id, status')
        .eq('utr_no', cleanUtr);

      if (!utrCheckErr && utrHistory) {
        const rejectedCount = utrHistory.filter(item => item.status === 'REJECTED').length;
        
        if (rejectedCount >= 2) {
          alert(`❌ Limit Exceeded: This UTR number has already been rejected ${rejectedCount} times. You cannot submit it again. Please contact support at ${helplineNo}.`);
          setLoading(false);
          return;
        }

        const activeOrApproved = utrHistory.find(item => item.status === 'APPROVED' || item.status === 'PENDING');
        if (activeOrApproved) {
          alert(`❌ This UTR number is already active or approved in the system! (Status: ${activeOrApproved.status})`);
          setLoading(false);
          return;
        }
      }

      const { error: insertError } = await supabase
        .from('wallet_recharges')
        .insert({
          user_id: userData?.uuid || userData?.id || null,
          user_email: userData?.email || null,
          user_name: userData?.name || userData?.fullName || 'User',
          amount: numAmount,
          utr_no: cleanUtr,
          status: 'PENDING',
          admin_remark: null 
        });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('This UTR number already exists in the system.');
        }
        throw insertError;
      }

      alert('Recharge request submitted successfully! Waiting for Admin approval.');

      if (onRechargeSubmitted) {
        await onRechargeSubmitted();
      }
      onClose();
    } catch (error: any) {
      console.error('Submission failed:', error);
      alert('Failed to submit recharge request: ' + (error.message || error));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'REJECTED':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      case 'SENT_BACK':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      default:
        return 'bg-amber-100 text-amber-900 border-amber-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl transition-all">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
          <h2 className="font-bold text-sm tracking-wide flex items-center gap-2">
            <span>📱</span> RECHARGE WALLET
          </h2>
          <button 
            type="button"
            onClick={onClose} 
            className="text-gray-400 hover:text-white font-bold text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Latest Status & Prominent Rejection Reason Banner */}
        {latestStatus && (
          <div className={`px-4 py-3 border-b text-xs font-semibold flex flex-col gap-1.5 ${getStatusBadge(latestStatus)}`}>
            <div className="flex justify-between items-center">
              <span>Status: <strong className="underline uppercase">{latestStatus}</strong></span>
              <span className="text-[10px] font-mono opacity-90">{userRecharges[0]?.utr_no ? `UTR: ${userRecharges[0].utr_no}` : ''}</span>
            </div>
            
            {/* Clear Reason Box if Rejected/Sent Back */}
            {adminRemark ? (
              <div className="bg-white/80 p-2 rounded border border-rose-300 text-rose-900 text-[11px] font-medium leading-snug">
                <span className="font-bold block text-rose-700">❌ Reason given by Admin:</span>
                "{adminRemark}"
              </div>
            ) : latestStatus.toUpperCase() === 'REJECTED' ? (
              <div className="bg-white/80 p-1.5 rounded border border-rose-300 text-rose-900 text-[11px]">
                <span className="font-bold text-rose-700">❌ Reason:</span> Admin did not leave a specific note. Please verify your payment or contact support.
              </div>
            ) : null}
          </div>
        )}

        {/* Desktop Browser Alert */}
        {desktopNotice && (
          <div className="bg-amber-50 border-b border-amber-200 p-2.5 text-[11px] text-amber-900 font-medium text-center leading-tight">
            📋 UPI ID copied! Mobile device par ye click direct PhonePe / GPay app launch karega.
          </div>
        )}

        {/* SCREEN 1: Payment & QR View */}
        {step === 1 && (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            
            {/* QR Code Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-[11px] font-bold text-slate-600 tracking-wider uppercase mb-2">
                SCAN QR CODE TO PAY VIA ANY UPI APP
              </p>
              
              <div className="bg-white p-2 inline-block rounded-lg border shadow-sm mb-2">
                <img 
                  src="/qr-code.jpg" 
                  alt="UPI QR Code" 
                  className="w-40 h-40 mx-auto object-contain"
                />
              </div>

              {/* UPI ID Display & Copy */}
              <div className="flex items-center justify-center gap-2 bg-white border rounded-lg px-3 py-1.5 max-w-[260px] mx-auto mt-1">
                <span className="text-xs font-mono font-bold text-slate-800 truncate">
                  UPI ID: {upiId}
                </span>
                <button 
                  type="button"
                  onClick={handleCopyUpi} 
                  className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              <p className="text-[11px] font-medium text-slate-500 mt-2">
                Helpline / WhatsApp Support: <span className="font-bold text-slate-800">{helplineNo}</span>
              </p>
            </div>

            {/* Instruction Box */}
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-[11px] text-blue-900 leading-relaxed">
              <p className="font-bold mb-0.5">Instructions:</p>
              Scan the QR code to transfer funds, enter exact amount & UTR below. Share screenshot on WhatsApp at <span className="font-bold">{helplineNo}</span> for fast approval.
            </div>

            {/* Recharge Amount Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                RECHARGE AMOUNT (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-slate-500">₹</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    let val = e.target.value;
                    val = val.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) {
                      val = parts[0] + '.' + parts.slice(1).join('');
                    }
                    setAmount(val);
                  }}
                  placeholder="e.g. 500"
                  className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 text-base outline-none"
                />
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => handleUpiPayment()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow transition text-sm flex items-center justify-center gap-2"
            >
              <span>⚡</span> PAY & RECHARGE (Select UPI App)
            </button>

            {/* Direct App Launchers */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-2 text-center">Or Direct Pay via Installed App:</p>
              <div className="grid grid-cols-3 gap-2.5">
                
                {/* Google Pay */}
                <button
                  type="button"
                  onClick={() => handleUpiPayment('gpay')}
                  className="border border-slate-200 hover:border-slate-300 hover:bg-slate-50 p-2.5 rounded-xl text-xs font-bold text-slate-700 flex flex-col items-center gap-1.5 transition shadow-sm"
                >
                  <svg className="w-7 h-7" viewBox="0 0 48 48" fill="none">
                    <path d="M43.611 20.083H42V20H24V28H35.303C33.654 32.657 29.223 36 24 36C17.373 36 12 30.627 12 24C12 17.373 17.373 12 24 12C27.059 12 29.842 13.154 31.961 15.039L37.618 9.382C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24C4 35.045 12.955 44 24 44C35.045 44 44 35.045 44 24C44 22.659 43.862 21.35 43.611 20.083Z" fill="#FFC107"/>
                    <path d="M6.306 14.691L12.877 19.511C14.655 15.108 18.961 12 24 12C27.059 12 29.842 13.154 31.961 15.039L37.618 9.382C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691Z" fill="#FF3D00"/>
                    <path d="M24 44C29.166 44 33.86 42.023 37.408 38.786L31.226 33.722C29.231 35.216 26.721 36 24 36C18.799 36 14.381 32.683 12.717 28.054L6.194 33.078C9.507 39.557 16.227 44 24 44Z" fill="#4CAF50"/>
                    <path d="M43.611 20.083H42V20H24V28H35.303C34.512 30.237 33.064 32.186 31.222 33.725L37.404 38.789C41.047 35.432 43.439 30.292 43.896 24.329C43.967 22.903 43.847 21.472 43.611 20.083Z" fill="#1976D2"/>
                  </svg>
                  <span>Google Pay</span>
                </button>

                {/* PhonePe */}
                <button
                  type="button"
                  onClick={() => handleUpiPayment('phonepe')}
                  className="border border-slate-200 hover:border-slate-300 hover:bg-slate-50 p-2.5 rounded-xl text-xs font-bold text-slate-700 flex flex-col items-center gap-1.5 transition shadow-sm"
                >
                  <svg className="w-7 h-7" viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" rx="12" fill="#5F259F"/>
                    <path d="M22.5 13H17.5V35H22.5V26.5H25.5C29.5 26.5 32.5 23.5 32.5 19.5C32.5 15.5 29.5 13 25.5 13H22.5ZM22.5 22.5V17H25.5C27 17 28 18 28 19.5C28 21 27 22.5 25.5 22.5H22.5Z" fill="white"/>
                  </svg>
                  <span>PhonePe</span>
                </button>

                {/* Paytm */}
                <button
                  type="button"
                  onClick={() => handleUpiPayment('paytm')}
                  className="border border-slate-200 hover:border-slate-300 hover:bg-slate-50 p-2.5 rounded-xl text-xs font-bold text-slate-700 flex flex-col items-center gap-1.5 transition shadow-sm"
                >
                  <svg className="w-7 h-7" viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" rx="12" fill="#002E6E"/>
                    <path d="M12 18H16.5C19 18 20.5 19.2 20.5 21.2C20.5 23.5 18.5 24.8 16.5 24.8H14.5V30H12V18ZM14.5 22.8H16.2C17.5 22.8 18.2 22.2 18.2 21.2C18.2 20.2 17.5 19.8 16.2 19.8H14.5V22.8Z" fill="#00B9F5"/>
                    <path d="M22 18H36V21H27V30H24.2V21H22V18Z" fill="#00B9F5"/>
                  </svg>
                  <span>Paytm</span>
                </button>

              </div>
            </div>

            {/* Navigation Link */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Already paid? Submit 12 digit UTR ➔
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 2: UTR Submission Form */}
        {step === 2 && (
          <div className="p-5 space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs text-blue-800 leading-relaxed">
              ℹ️ Enter your 12-digit UTR / Reference No. below. Make sure to fix the error mentioned in the admin remark above if your previous payment was rejected.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                AMOUNT PAID
              </label>
              <input
                type="text"
                value={`₹ ${amount}`}
                disabled
                className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 cursor-not-allowed text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                UTR NO / UPI TRANSACTION REFERENCE <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={12}
                value={utr}
                onChange={(e) => setUtr(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 12-digit UTR or UPI Ref ID"
                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-slate-800 text-sm outline-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                className="w-1/2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-lg text-xs transition uppercase"
              >
                BACK
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs shadow transition disabled:opacity-50 uppercase"
              >
                {loading ? 'Submitting...' : 'SUBMIT REQUEST'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}