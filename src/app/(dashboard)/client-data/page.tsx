  "use client";

  import { useEffect, useState } from "react";
  import { supabase } from "@/lib/supabase";

  export default function ClientDataPage() {
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [showActionBox, setShowActionBox] = useState(false);

    const [searchName, setSearchName] = useState("");
    const [searchRep, setSearchRep] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    // FETCH
  // FETCH (सिर्फ टेस्टिंग के लिए admin चेक हटाकर देखें)
const fetchClients = async () => {
  setLoading(true);

  // प्रोफाइल रोल चेक को कमेंट आउट करें और सीधे डेटा फेच करें
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("client_name", { ascending: true });

  if (error) {
    console.log("Error:", error);
    setClients([]);
  } else {
    console.log("Total records fetched:", data?.length); // कंसोल में देखें कितने रिकॉर्ड आए
    setClients(data || []);
  }

  setLoading(false);
};

    useEffect(() => {
      fetchClients();
    }, []);

    // FILTER
    const filteredClients = clients.filter((c) => {
      const matchName =
        c.client_name?.toLowerCase().includes(searchName.toLowerCase());

      const matchRep =
        c.representative_name?.toLowerCase().includes(searchRep.toLowerCase());

      const matchCategory =
        categoryFilter === "" || c.client_category === categoryFilter;

      const matchStatus =
        statusFilter === "" || c.account_status === statusFilter;

      return matchName && matchRep && matchCategory && matchStatus;
    });

    return (
      <div className="p-6">
        <div className="bg-white p-6 rounded-xl shadow">

          <h1 className="text-2xl font-bold text-blue-900 mb-6">
            CLIENT DATA
          </h1>

          {/* TABLE */}
          <table className="w-full border">

            {/* HEADER */}
            <thead>
              <tr className="bg-blue-900 text-white">

                <th className="p-3">CLIENT ID</th>

                {/* CATEGORY */}
                <th className="p-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-black text-xs p-1 w-full"
                  >
                    <option value="">CATEGORY</option>
                    <option value="BANKER">BANKER</option>
                    <option value="DSA">DSA</option>
                    <option value="CONSTRUCTOR">CONSTRUCTOR</option>
                    <option value="ENGINEER">ENGINEER</option>
                    <option value="INDIVIDUAL USER">INDIVIDUAL USER</option>
                  </select>
                </th>

                {/* NAME */}
                <th className="p-2">
                  <input
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="CLIENT NAME"
                    className="text-black text-xs p-1 w-full"
                  />
                </th>

                {/* REPRESENTATIVE */}
                <th className="p-2">
                  <input
                    value={searchRep}
                    onChange={(e) => setSearchRep(e.target.value)}
                    placeholder="REPRESENTATIVE"
                    className="text-black text-xs p-1 w-full"
                  />
                </th>

                <th className="p-3">PLAN</th>

                {/* STATUS */}
                <th className="p-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-black text-xs p-1 w-full"
                  >
                    <option value="">STATUS</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </th>

                <th className="p-3">MOBILE</th>
                <th className="p-3">ACTION</th>

              </tr>
            </thead>

            {/* BODY */}
            <tbody>
              {filteredClients.map((c) => (
                <tr key={c.id} className="border-b">

                  <td className="p-3">{c.client_id}</td>
                  <td className="p-3">{c.client_category}</td>
                  <td className="p-3">{c.client_name}</td>
                  <td className="p-3">{c.representative_name}</td>
                  <td className="p-3">{c.plan_type}</td>

                  <td className="p-3">
                    <span className={`px-2 py-1 text-xs rounded ${
                      c.account_status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}>
                      {c.account_status}
                    </span>
                  </td>

                  <td className="p-3">{c.mobile_no}</td>

                  {/* VIEW BUTTON */}
                  <td
                    className="p-3 text-blue-600 font-bold cursor-pointer"
                    onClick={() => {
                      setSelectedClient(c);
                      setShowActionBox(true);
                    }}
                  >
                    VIEW
                  </td>

                </tr>
              ))}
            </tbody>

          </table>

          {/* ACTION POPUP */}
          {showActionBox && selectedClient && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center">

              <div className="bg-white p-6 rounded-xl w-80 text-center">

                <h2 className="text-lg font-bold mb-3">CLIENT ACTION</h2>

                <p className="mb-4 font-semibold">
                  {selectedClient.client_name}
                </p>

                {/* EDIT */}
                  {/* NAYA CODE - ISE APNE PURANE CODE KI JAGAH RAKHEIN */}
<button
  onClick={() => {
    const editId = selectedClient.id || selectedClient.client_id;
    window.location.href = `/client-registration?id=${editId}`;
  }}
  className="w-full bg-blue-600 text-white py-2 rounded mb-2 hover:bg-blue-700 transition"
>
  EDIT
</button>

                // DELETE
  <button
    onClick={async () => {
      const ok = window.confirm("Delete this client?");
      if (!ok) return;

      const { data: { user } } = await supabase.auth.getUser();
      
      // Admin check karne ke liye profile fetch karein
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      let deleteQuery = supabase.from("clients").delete().eq("client_id", selectedClient.client_id);

      // Agar Admin nahi hai, toh hi user_id ka filter lagayein
      if (profile?.role !== 'admin') {
        deleteQuery = deleteQuery.eq("user_id", user?.id);
      }

      const { error } = await deleteQuery;

      if (error) {
        alert(error.message);
        return;
      }

      alert("Deleted");
      setShowActionBox(false);
      setSelectedClient(null);
      fetchClients();
    }}
    className="w-full bg-red-600 text-white py-2 rounded"
  >
    DELETE
  </button>

                {/* CANCEL */}
                <button
                  onClick={() => setShowActionBox(false)}
                  className="w-full mt-2 border py-2 rounded"
                >
                  CANCEL
                </button>

              </div>
            </div>
          )}

        </div>
      </div>
    );
  }