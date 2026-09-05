'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminPendingApprovalsWidget({ onActionComplete }: { onActionComplete: () => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('approval_status', 'PENDING');

      if (error) throw error;
      setRequests(data || []);
    } catch (err: any) {
      console.error('Error fetching pending approvals:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const handleApprove = async (userId: string, email: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: 'APPROVED', status: 'active' })
        .eq('id', userId);

      if (error) throw error;
      alert(`Success! ${email}'s account has been approved.`);
      fetchPendingRequests();
      onActionComplete();
    } catch (err: any) {
      alert('Failed to approve: ' + err.message);
    }
  };

  const handleReject = async (userId: string, email: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: 'REJECTED' })
        .eq('id', userId);

      if (error) throw error;
      alert(`Registration rejected for ${email}.`);
      fetchPendingRequests();
      onActionComplete();
    } catch (err: any) {
      alert('Failed to reject: ' + err.message);
    }
  };

  if (loading || requests.length === 0) return null;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-amber-200 shadow-sm space-y-4 my-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h3 className="font-bold text-amber-800 text-sm sm:text-base">⏳ New User Registration Requests</h3>
          <p className="text-[11px] sm:text-xs text-slate-500">Approve new users to grant them access to the platform and features.</p>
        </div>
        <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-xl font-bold text-xs shrink-0">
          {requests.length} Pending
        </span>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="w-full text-left text-sm min-w-[600px] sm:min-w-full">
          <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
            <tr>
              <th className="p-3 rounded-l-xl">User Full Name & Email</th>
              <th className="p-3">Mobile No.</th>
              <th className="p-3">City / State</th>
              <th className="p-3">Sign-up Date</th>
              <th className="p-3 rounded-r-xl text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((req: any) => (
              <tr key={req.id} className="hover:bg-slate-50/50 transition text-xs">
                <td className="p-3">
                  <div className="font-bold text-slate-900">{req.full_name || 'N/A'}</div>
                  <div className="text-[11px] text-slate-500">{req.email}</div>
                </td>
                <td className="p-3 text-slate-700 font-medium">{req.mobile || 'N/A'}</td>
                <td className="p-3 text-slate-600 font-semibold uppercase">{req.city}, {req.state}</td>
                <td className="p-3 text-slate-500">{new Date(req.created_at || Date.now()).toLocaleDateString()}</td>
                <td className="p-3 text-right space-x-1 sm:space-x-2 whitespace-nowrap">
                  <button
                    onClick={() => handleApprove(req.id, req.email)}
                    className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-sm uppercase text-[10px]"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(req.id, req.email)}
                    className="px-2.5 sm:px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition shadow-sm uppercase text-[10px]"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}