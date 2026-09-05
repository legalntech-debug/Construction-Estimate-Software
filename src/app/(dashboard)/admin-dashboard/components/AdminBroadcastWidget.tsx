'use client';
import { useState } from 'react';

export default function AdminBroadcastWidget() {
  const [title, setTitle] = useState('☀️ Good Morning! L&T Consultant Services');
  const [body, setBody] = useState('Get your sale estimate & map drafting done 24/7 anytime via L&T Consultant Software.');
  const [loading, setLoading] = useState(false);
  const [showBroadcastPanel, setShowBroadcastPanel] = useState(false);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) {
      alert('Please enter both title and message.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });

      const result = await response.json();
      if (result.success) {
        alert('Global Push Notification sent successfully to all users!');
      } else {
        alert('Failed to send broadcast: ' + result.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 my-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800 text-sm sm:text-base">📢 Send Broadcast Push Notification</h3>
          <p className="text-[11px] sm:text-xs text-slate-500">Send an instant notification directly to all users&apos; mobile and desktop screens.</p>
        </div>
        <button 
          onClick={() => setShowBroadcastPanel(!showBroadcastPanel)}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition shrink-0 ml-2"
        >
          {showBroadcastPanel ? 'Hide [-]' : 'Show [+]'}
        </button>
      </div>

      {showBroadcastPanel && (
        <form onSubmit={handleSendBroadcast} className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Notification Title</label>
            <input 
              type="text" 
              placeholder="e.g. Daily Update / New Feature" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Message Body</label>
            <textarea 
              placeholder="e.g. Din ka naya estimate check karna na bhulein!" 
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm uppercase tracking-wider"
          >
            {loading ? 'Broadcasting...' : '🚀 Blast Notification to All Users'}
          </button>
        </form>
      )}
    </div>
  );
}