'use client';
import { useState, useMemo } from 'react';

export default function InactiveUsersModal({ users }: { users: any[] }) {
  const [show, setShow] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  // Filtered List Logic
  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      (u.city?.toLowerCase().includes(cityFilter.toLowerCase())) &&
      (u.state?.toLowerCase().includes(stateFilter.toLowerCase()))
    );
  }, [users, cityFilter, stateFilter]);

  if (!show) {
    return (
      <div onClick={() => setShow(true)} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50">
        <h3 className="text-gray-500 text-sm">Inactive Users</h3>
        <p className="text-3xl font-bold text-red-600">{users.length}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Inactive Users List</h2>
          <button onClick={() => setShow(false)} className="text-gray-500 hover:text-black font-bold text-xl">✕</button>
        </div>

        {/* Filter Section */}
        <div className="p-4 bg-gray-50 flex gap-4 border-b">
          <input 
            placeholder="Search City..." 
            className="border p-2 rounded-lg w-full text-sm"
            onChange={(e) => setCityFilter(e.target.value)}
          />
          <input 
            placeholder="Search State..." 
            className="border p-2 rounded-lg w-full text-sm"
            onChange={(e) => setStateFilter(e.target.value)}
          />
        </div>

        <div className="overflow-y-auto p-6">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 uppercase">
              <tr>
                <th className="p-3">SR NO</th>
                <th className="p-3">USER NAME</th>
                <th className="p-3">CITY</th>
                <th className="p-3">STATE</th>
                <th className="p-3">TOTAL CASE</th>
                <th className="p-3">INACTIVE FROM</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, i) => (
                <tr key={u.user_id} className="border-b text-gray-700">
                  <td className="p-3">{i + 1}</td>
                  <td className="p-3 font-medium">{u.full_name}</td>
                  <td className="p-3">{u.city}</td>
                  <td className="p-3">{u.state}</td>
                  <td className="p-3 text-center font-bold">{u.total_cases}</td>
                  <td className="p-3">{new Date(u.last_seen).toLocaleDateString()}</td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">No users found matching your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}