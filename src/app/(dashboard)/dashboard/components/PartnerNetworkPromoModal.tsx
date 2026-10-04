'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, X, Sparkles, TrendingUp, Wallet, Gift, 
  ArrowRight, CheckCircle, Crown, IndianRupee, 
  Calendar, Award, Zap
} from 'lucide-react';
import PartnerApprovalLockModal from '../../partner-dashboard/components/PartnerApprovalLockModal';

interface PartnerNetworkPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
}

export default function PartnerNetworkPromoModal({ 
  isOpen, 
  onClose, 
  userId,
  userName 
}: PartnerNetworkPromoModalProps) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);
  const [showKYCForm, setShowKYCForm] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsClosing(true);
    localStorage.setItem(`partner_promo_seen_${userId}`, 'true');
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // 🔥 Open KYC form instead of direct redirect
  const handleClaim = () => {
    localStorage.setItem(`partner_promo_seen_${userId}`, 'true');
    localStorage.setItem(`partner_promo_clicked_${userId}`, 'true');
    setShowKYCForm(true);
  };

  // 🔥 Called after KYC form submission succeeds
  const handleKYCSubmitted = () => {
    setShowKYCForm(false);
    router.push('/partner-dashboard');
    onClose();
  };

  const benefits = [
    {
      icon: <IndianRupee className="w-5 h-5" />,
      title: "3% LIFETIME COMMISSION",
      desc: "Earn 3% commission on every user payment - for a full year!",
      color: "text-emerald-400",
      bg: "bg-emerald-950/40 border-emerald-800/50"
    },
    {
      icon: <Calendar className="w-5 h-5" />,
      title: "365 DAYS CONTINUOUS PAYOUT",
      desc: "Connect once, keep earning for the entire year",
      color: "text-amber-400",
      bg: "bg-amber-950/40 border-amber-800/50"
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "UNLIMITED NETWORK",
      desc: "Add as many users as you want - no limits!",
      color: "text-cyan-400",
      bg: "bg-cyan-950/40 border-cyan-800/50"
    },
    {
      icon: <Wallet className="w-5 h-5" />,
      title: "INSTANT WALLET CREDIT",
      desc: "Commission goes straight to your wallet - withdraw instantly",
      color: "text-purple-400",
      bg: "bg-purple-950/40 border-purple-800/50"
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "REAL-TIME TRACKING",
      desc: "Live dashboard - every user, every payment, every commission",
      color: "text-blue-400",
      bg: "bg-blue-950/40 border-blue-800/50"
    },
    {
      icon: <Award className="w-5 h-5" />,
      title: "MONTHLY SETTLEMENTS",
      desc: "Automatic settlement every month - no waiting",
      color: "text-rose-400",
      bg: "bg-rose-950/40 border-rose-800/50"
    }
  ];

  const stats = [
    { value: "3%", label: "Commission Rate", color: "text-emerald-400" },
    { value: "365", label: "Days Payout", color: "text-amber-400" },
    { value: "∞", label: "Network Size", color: "text-cyan-400" },
    { value: "24/7", label: "Live Tracking", color: "text-purple-400" }
  ];

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
        <div 
          className={`absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-200 ${
            isClosing ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={handleClose}
        />

        <div 
          className={`relative w-full max-w-2xl max-h-[95vh] overflow-y-auto bg-slate-900 rounded-3xl shadow-2xl border-2 border-indigo-500/30 transition-all duration-200 ${
            isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
          }`}
        >
          {/* HEADER */}
          <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 sm:p-8 rounded-t-3xl overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-20 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition backdrop-blur-sm"
            >
              <X size={20} />
            </button>

            <div className="relative z-10 text-center space-y-3">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/30">
                <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                <span className="text-[11px] font-black text-white uppercase tracking-wider">
                  NEW FEATURE LAUNCHED
                </span>
                <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight leading-tight">
                Partner Network
                <span className="block text-yellow-300 text-lg sm:text-2xl mt-1">
                  💰 EARN 3% LIFETIME
                </span>
              </h1>

              <p className="text-white/90 text-xs sm:text-sm max-w-md mx-auto font-medium">
                {userName ? `Dear ${userName}, ` : ''}
                Earn money from every connection - <b>continuous payout for 1 year!</b>
              </p>
            </div>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-4 gap-2 p-4 bg-slate-950/60 border-b border-slate-800">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className={`text-xl sm:text-2xl font-black ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* BODY */}
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                WHY JOIN PARTNER NETWORK?
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {benefits.map((benefit, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-xl border ${benefit.bg} flex items-start gap-3 hover:scale-[1.02] transition-transform`}
                >
                  <div className={`p-2 rounded-lg bg-slate-900/80 ${benefit.color} shrink-0`}>
                    {benefit.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`text-[11px] font-black ${benefit.color} uppercase tracking-wide`}>
                      {benefit.title}
                    </h3>
                    <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">
                      {benefit.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* EXAMPLE EARNING */}
            <div className="bg-gradient-to-r from-emerald-950/60 to-cyan-950/60 border border-emerald-800/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-400" />
                <span className="text-[11px] font-black text-yellow-400 uppercase tracking-wider">
                  EXAMPLE EARNING
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">10 Users</div>
                  <div className="text-sm font-black text-white">₹50,000</div>
                  <div className="text-[9px] text-emerald-400">Revenue</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Your 3%</div>
                  <div className="text-sm font-black text-emerald-400">₹1,500</div>
                  <div className="text-[9px] text-emerald-400">Commission</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">1 Year</div>
                  <div className="text-sm font-black text-amber-400">₹18,000</div>
                  <div className="text-[9px] text-amber-400">Total Earning</div>
                </div>
              </div>
            </div>

            {/* CTA BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={handleClaim}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-black py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 group"
              >
                <Gift className="w-4 h-4 group-hover:scale-110 transition" />
                CLAIM FREE PARTNER ACCOUNT
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
              <button
                onClick={handleClose}
                className="sm:w-auto px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase tracking-wider transition"
              >
                Maybe Later
              </button>
            </div>

            {/* TRUST INDICATORS */}
            <div className="flex items-center justify-center gap-4 pt-2 text-[9px] text-slate-500 font-bold uppercase">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                FREE TO JOIN
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                NO HIDDEN CHARGES
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                INSTANT ACTIVATION
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 KYC FORM MODAL — Reuse Existing PartnerApprovalLockModal */}
      {showKYCForm && (
        <PartnerApprovalLockModal
          userId={userId}
          hasAccount={false}
          approvalStatus="PENDING"
          approvedByLevel1={null}
          approvedByAdmin={null}
          onRefresh={handleKYCSubmitted}
          onClose={() => setShowKYCForm(false)}
        />
      )}
    </>
  );
}