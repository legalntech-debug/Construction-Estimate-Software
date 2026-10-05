'use client';

import { useState, useEffect } from 'react';
import {
  X, MessageCircle, Phone, ChevronRight, HelpCircle, AlertCircle,
  Wallet, UserCheck, FileText, Clock, Shield, ArrowRight, Headphones
} from 'lucide-react';

interface CorporateSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: any;
  defaultIssue?: string | null;
}

// Corporate Support Contacts
const SUPPORT_CONTACTS = {
  admin: {
    name: 'Administrator',
    role: 'Primary Admin',
    phone: '917987561396',
    displayPhone: '+91 79875 61396',
    description: 'For account approval, wallet recharge & general queries'
  },
  coPartner: {
    name: 'Co-Partner',
    role: 'Operations Head',
    phone: '918249169703',
    displayPhone: '+91 82491 69703',
    description: 'For escalation & operational support'
  },
  ceo: {
    name: 'CEO Office',
    role: 'Executive Management',
    phone: '918103804355',
    displayPhone: '+91 81038 04355',
    description: 'For critical escalations & executive matters'
  }
};

// Issue Categories with pre-filled messages
const ISSUE_CATEGORIES = [
  {
    id: 'approval',
    icon: UserCheck,
    title: 'Account Approval Pending',
    subtitle: 'Request fast-track approval of your account',
    color: 'amber',
    message: (u: any) =>
      `Dear Administrator,\n\n` +
      `I am writing to request approval of my L&T Consultant Services account.\n\n` +
      `Account Details:\n` +
      `Name: ${u.name}\n` +
      `Email: ${u.email}\n` +
      `System ID: ${u.id}\n` +
      `Registered On: ${u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : 'N/A'}\n\n` +
      `Kindly review and approve my account at your earliest convenience so I can access all platform services.\n\n` +
      `Thank you,\n${u.name}`
  },
  {
    id: 'recharge',
    icon: Wallet,
    title: 'Wallet Recharge Approval',
    subtitle: 'Follow up on pending recharge request',
    color: 'emerald',
    message: (u: any) =>
      `Dear Administrator,\n\n` +
      `I have submitted a wallet recharge request and would like to follow up on its approval status.\n\n` +
      `Account Details:\n` +
      `Name: ${u.name}\n` +
      `Email: ${u.email}\n` +
      `System ID: ${u.id}\n` +
      `Current Wallet Balance: ₹${Number(u.wallet || 0).toFixed(2)}\n\n` +
      `Kindly verify the payment and approve the recharge at the earliest so I can continue using the services without interruption.\n\n` +
      `Thank you,\n${u.name}`
  },
  {
    id: 'low_wallet',
    icon: AlertCircle,
    title: 'Low Wallet Balance Issue',
    subtitle: 'Wallet balance is below minimum threshold',
    color: 'rose',
    message: (u: any) =>
      `Dear Administrator,\n\n` +
      `My wallet balance has fallen below the minimum threshold and I need assistance.\n\n` +
      `Account Details:\n` +
      `Name: ${u.name}\n` +
      `Email: ${u.email}\n` +
      `System ID: ${u.id}\n` +
      `Current Wallet Balance: ₹${Number(u.wallet || 0).toFixed(2)}\n\n` +
      `Kindly guide me on the recharge process or assist with any available options so I can restore full access to my account.\n\n` +
      `Thank you,\n${u.name}`
  },
  {
    id: 'kyc',
    icon: FileText,
    title: 'KYC / Partner Account',
    subtitle: 'Help with Partner Network registration',
    color: 'blue',
    message: (u: any) =>
      `Dear Administrator,\n\n` +
      `I require assistance regarding my Partner Network account / KYC verification.\n\n` +
      `Account Details:\n` +
      `Name: ${u.name}\n` +
      `Email: ${u.email}\n` +
      `System ID: ${u.id}\n\n` +
      `Kindly guide me through the process or share the required documents list.\n\n` +
      `Thank you,\n${u.name}`
  },
  {
    id: 'billing',
    icon: Clock,
    title: 'Billing / Subscription Query',
    subtitle: 'Monthly bill or subscription related',
    color: 'purple',
    message: (u: any) =>
      `Dear Administrator,\n\n` +
      `I have a query regarding my monthly billing / subscription statement.\n\n` +
      `Account Details:\n` +
      `Name: ${u.name}\n` +
      `Email: ${u.email}\n` +
      `System ID: ${u.id}\n` +
      `Plan Type: ${u.planType}\n\n` +
      `Kindly provide clarification and assist with the billing process.\n\n` +
      `Thank you,\n${u.name}`
  },
  {
    id: 'technical',
    icon: Shield,
    title: 'Technical Support',
    subtitle: 'Report an issue or request assistance',
    color: 'slate',
    message: (u: any) =>
      `Dear Support Team,\n\n` +
      `I am facing a technical issue and require assistance.\n\n` +
      `Account Details:\n` +
      `Name: ${u.name}\n` +
      `Email: ${u.email}\n` +
      `System ID: ${u.id}\n\n` +
      `Issue Description: [Please describe your issue here]\n\n` +
      `Kindly look into this matter and provide a resolution at the earliest.\n\n` +
      `Thank you,\n${u.name}`
  },
  {
    id: 'escalation',
    icon: ArrowRight,
    title: 'Escalation — No Response',
    subtitle: 'Escalate to management if no response received',
    color: 'red',
    message: (u: any) =>
      `Dear Management,\n\n` +
      `I have previously raised a concern but have not received a response within the expected timeframe. I am escalating this matter for your kind attention.\n\n` +
      `Account Details:\n` +
      `Name: ${u.name}\n` +
      `Email: ${u.email}\n` +
      `System ID: ${u.id}\n\n` +
      `Issue Summary: [Please describe your issue here]\n\n` +
      `Kindly review and provide a resolution at your earliest convenience.\n\n` +
      `Thank you,\n${u.name}`
  },
  {
    id: 'custom',
    icon: MessageCircle,
    title: 'Custom Message',
    subtitle: 'Type your own message',
    color: 'indigo',
    message: (u: any) =>
      `Dear Administrator,\n\n` +
      `Name: ${u.name}\n` +
      `Email: ${u.email}\n` +
      `System ID: ${u.id}\n\n` +
      `Message: [Type your message here]\n\n` +
      `Thank you,\n${u.name}`
  }
];

export default function CorporateSupportModal({
  isOpen,
  onClose,
  userData,
  defaultIssue = null
}: CorporateSupportModalProps) {
  const [selectedIssue, setSelectedIssue] = useState<string | null>(defaultIssue);
  const [selectedContact, setSelectedContact] = useState<'admin' | 'coPartner' | 'ceo'>('admin');
  const [showEscalation, setShowEscalation] = useState(false);

  // ✅ CRITICAL FIX: Sync defaultIssue whenever modal opens
  // This ensures that when a user clicks "Contact Admin" from the approval banner,
  // the "Account Approval Pending" issue is pre-selected automatically.
  useEffect(() => {
    if (isOpen) {
      if (defaultIssue) {
        setSelectedIssue(defaultIssue);
        setSelectedContact(defaultIssue === 'escalation' ? 'ceo' : 'admin');
      } else {
        setSelectedIssue(null);
        setSelectedContact('admin');
      }
      setShowEscalation(false);
    }
  }, [isOpen, defaultIssue]);

  if (!isOpen) return null;

  const handleIssueSelect = (issueId: string) => {
    setSelectedIssue(issueId);
    setShowEscalation(false);
    if (issueId === 'escalation') {
      setSelectedContact('ceo');
    } else {
      setSelectedContact('admin');
    }
  };

  const handleSendWhatsApp = () => {
    if (!selectedIssue) return;

    const issue = ISSUE_CATEGORIES.find((i) => i.id === selectedIssue);
    if (!issue) return;

    const message = issue.message(userData);
    const contact = SUPPORT_CONTACTS[selectedContact];
    const whatsappUrl = `https://wa.me/${contact.phone}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
  };

  const handleEscalate = () => {
    setShowEscalation(true);
    setSelectedContact('ceo');
    setSelectedIssue('escalation');
  };

  const selectedIssueObj = ISSUE_CATEGORIES.find((i) => i.id === selectedIssue);

  const getColorClasses = (color: string) => {
    const map: any = {
      amber: 'border-amber-300 bg-amber-50 text-amber-700',
      emerald: 'border-emerald-300 bg-emerald-50 text-emerald-700',
      rose: 'border-rose-300 bg-rose-50 text-rose-700',
      blue: 'border-blue-300 bg-blue-50 text-blue-700',
      purple: 'border-purple-300 bg-purple-50 text-purple-700',
      slate: 'border-slate-300 bg-slate-50 text-slate-700',
      red: 'border-red-300 bg-red-50 text-red-700',
      indigo: 'border-indigo-300 bg-indigo-50 text-indigo-700'
    };
    return map[color] || map.slate;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base uppercase tracking-wide">
                LnT Support Center
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-300">
                Select your concern and connect with the right team
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {/* STEP 1: SELECT ISSUE */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                1
              </div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Select Your Concern
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ISSUE_CATEGORIES.map((issue) => {
                const Icon = issue.icon;
                const isSelected = selectedIssue === issue.id;
                return (
                  <button
                    key={issue.id}
                    onClick={() => handleIssueSelect(issue.id)}
                    className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getColorClasses(issue.color)}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight">
                          {issue.title}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          {issue.subtitle}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: SELECT CONTACT */}
          {selectedIssue && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                  2
                </div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Choose Support Contact
                </h4>
              </div>

              <div className="space-y-2">
                {(Object.keys(SUPPORT_CONTACTS) as Array<keyof typeof SUPPORT_CONTACTS>).map((key) => {
                  const contact = SUPPORT_CONTACTS[key];
                  const isSelected = selectedContact === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedContact(key)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Phone className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black text-slate-800 uppercase">
                              {contact.name} — {contact.role}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {contact.description}
                            </p>
                            <p className="text-[10px] font-mono font-bold text-emerald-700 mt-0.5">
                              {contact.displayPhone}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ESCALATION NOTICE */}
          {!showEscalation && selectedIssue && selectedIssue !== 'escalation' && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[11px] font-black text-amber-800 uppercase">
                    Not getting a response?
                  </p>
                  <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                    If you have not received a response within 24 hours, you may escalate the matter to our executive management.
                  </p>
                </div>
              </div>
              <button
                onClick={handleEscalate}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-wider py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Escalate to Management
              </button>
            </div>
          )}

          {showEscalation && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black text-rose-800 uppercase">
                  Escalation Mode Activated
                </p>
                <p className="text-[10px] text-rose-700 mt-0.5 leading-relaxed">
                  Your message will be sent directly to the CEO Office. Please describe your issue clearly so it can be resolved at the earliest.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={onClose}
              className="sm:w-auto px-4 py-2.5 border-2 border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-[11px] uppercase tracking-wider transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSendWhatsApp}
              disabled={!selectedIssue}
              className={`flex-1 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider shadow-md transition cursor-pointer flex items-center justify-center gap-2 ${
                selectedIssue
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              Send via WhatsApp
              {selectedIssueObj && (
                <span className="hidden sm:inline text-[10px] opacity-90">
                  — {selectedIssueObj.title}
                </span>
              )}
            </button>
          </div>
          <p className="text-[9px] text-slate-400 text-center mt-2 font-medium">
            A professional message will be pre-filled. You can review it before sending.
          </p>
        </div>

      </div>
    </div>
  );
}