'use client';

import { useState } from 'react';

export default function RazorpayTableWithFilter({ transactions }: { transactions: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter transactions based on Payment ID or Reference No.
  const filteredTransactions = transactions.filter((txn) => {
    const paymentId = (txn.razorpay_payment_id || '').toLowerCase();
    const refNo = (txn.ref_no || '').toLowerCase();
    const query = searchTerm.toLowerCase();

    return paymentId.includes(query) || refNo.includes(query);
  });

  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm mt-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Razorpay Live Revenue & Transactions</h3>
          <p className="text-xs text-gray-500">Real-time gateway collections fetched directly from estimates database.</p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Search Input for Filters */}
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search Payment ID or Ref No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-right whitespace-nowrap">
            <span className="text-[10px] font-semibold text-emerald-600 block">Total Gateway Revenue</span>
            <span className="text-lg font-extrabold text-emerald-700">
              ₹ {transactions.reduce((acc: number, curr: any) => acc + Number(curr.user_payment || 0), 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 text-gray-700 uppercase tracking-wider font-semibold border-b border-gray-200">
              <th className="py-3 px-4">Razorpay Payment ID</th>
              <th className="py-3 px-4">Reference No</th>
              <th className="py-3 px-4">Customer Name</th>
              <th className="py-3 px-4">Case Type</th>
              <th className="py-3 px-4">Date & Time</th>
              <th className="py-3 px-4 text-right">Amount Paid</th>
              <th className="py-3 px-4 text-center">Payment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-gray-600">
            {filteredTransactions && filteredTransactions.length > 0 ? (
              filteredTransactions.map((txn: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-gray-800">{txn.razorpay_payment_id || "N/A"}</td>
                  <td className="py-3 px-4 font-semibold text-blue-600">{txn.ref_no || "N/A"}</td>
                  <td className="py-3 px-4 font-medium text-gray-800">{txn.customer_name || txn.client_name || "Valued User"}</td>
                  <td className="py-3 px-4 font-medium text-blue-600">{txn.estimate_type || "N/A"}</td>
                  <td className="py-3 px-4">{new Date(txn.created_at || Date.now()).toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">₹ {Number(txn.user_payment || 0).toLocaleString()}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-full text-[10px]">
                      {txn.platform_payment_status || 'PAID'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-400">
                  No matching payment records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}