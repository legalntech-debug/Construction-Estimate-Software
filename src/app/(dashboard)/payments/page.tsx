'use client';
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function PaymentsPage() {
  const [data, setData] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedRep, setSelectedRep] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [expandedBill, setExpandedBill] = useState<string | null>(null);
  const [utrValues, setUtrValues] = useState<{ [key: string]: string }>({});

  const updateUtr = async (invoiceId: string, utrNo: string) => {
  if (!utrNo) return alert("Pehle UTR number fill karein!");

  const { error } = await supabase
    .from("invoices")
    .update({ 
      utr_no: utrNo, 
      status: "PAID" 
    })
    .eq("id", invoiceId);

  if (error) {
    console.error("Error updating UTR:", error);
    alert(`Error: ${error.message}`);
  } else {
    alert("UTR Number successfully save ho gaya!");
    fetchData(); // Refresh data
  }
};

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. Current user ki ID get karein
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 2. Records fetch (MIS Records) - Sirf login user ke
    const { data: records } = await supabase
      .from("mis_records")
      .select("*")
      .eq("user_id", user.id); // Sirf login user ka data
    setData(records || []);
    
    // 3. Invoices fetch - Admin ya User filter
    // Agar aapka koi 'profiles' table hai jisme 'role' column hai toh use karein
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    let query = supabase.from("invoices").select("*").order('created_at', { ascending: false });

    // Agar user Admin nahi hai, toh sirf uska apna data dikhao
    if (profile?.role !== 'admin') {
      query = query.eq("user_id", user.id); 
    }

    const { data: invs, error } = await query;
      
    if (error) {
      console.error("Supabase Error (Fetch Invoices):", error);
    } else {
      setInvoices(invs || []);
    }
  };
  
  const generateInvoice = async () => {
    if (!selectedClient || !selectedMonth) return alert("Select Client & Month!");

    const billNo = `LNT/${Date.now().toString().slice(-6)}`;
    const currentDate = new Date().toLocaleDateString('en-IN');
    const clientCases = data.filter(r => r.client_name === selectedClient);
    
    // Calculations
    const subTotal = clientCases.reduce((sum, r) => sum + (Number(r.fee_standard) || 0), 0);
    const gstAmount = subTotal * 0.18; // 18% GST assume kiya hai
    const finalAmount = subTotal + gstAmount;

    // 1. PDF Generation
    const doc = new jsPDF();
    
    // Letterhead
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("LEGAL n TECH", 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("IOV APPROVED VALUER A-33162 | BUILDING PERMISSION DEPARTMENT", 105, 22, { align: 'center' });
    doc.text("ADDRESS: GROUND FLOOR, BUILDING NO. 180/5, MEGHDOOT NAGAR, INDORE", 105, 27, { align: 'center' });
    doc.text("Email: legalntech@gmail.com", 105, 32, { align: 'center' });
    doc.line(20, 35, 190, 35);

    // Bill Info
    doc.setFontSize(12);
    doc.text(`BILL NO: ${billNo}`, 20, 45);
    doc.text(`DATE: ${currentDate}`, 190, 45, { align: 'right' });

    // Customer Details
    doc.setFontSize(11);
    doc.text(`CUSTOMER NAME: ${selectedClient}`, 20, 55);
    doc.text(`REPRESENTATIVE: ${selectedRep}`, 20, 60);
    doc.text("ADDRESS: ________________________", 20, 65);
    doc.text("GST NO: ________________________", 20, 70);

    doc.setFontSize(14);
    doc.text("PROFESSIONAL BILL", 105, 82, { align: 'center' });

    // Table
    autoTable(doc, {
      startY: 90,
      head: [['REF NO', 'CASE TYPE', 'AMOUNT']],
      body: [
        ...clientCases.map(r => [r.ref_no, r.case_type, r.fee_standard]),
        ['', 'SUBTOTAL', subTotal.toFixed(2)],
        ['', 'GST (18%)', gstAmount.toFixed(2)],
        ['', 'FINAL TOTAL', finalAmount.toFixed(2)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175] }, // Blue color
    });
    
    doc.save(`Invoice_${selectedClient}.pdf`);

    // 2. Database Insert
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Session expired!");

    const { error } = await supabase.from("invoices").insert([{ 
        user_id: user.id,
        invoice_no: billNo,
        client_name: selectedClient,
        representative: selectedRep,
        total_amount: finalAmount, // Final amount store karein
        status: 'BILLED'
    }]);

    if (error) alert(`Error: ${error.message}`);
    else {
        fetchData();
        alert("Bill generate ho gaya!");
    }
  };

  return (
    <div className="p-8 bg-slate-950 min-h-screen text-white">
      <div className="max-w-xl mx-auto bg-slate-900 p-8 rounded-2xl border border-slate-700 mb-8">
        <h2 className="text-xl font-black mb-4 text-blue-400 uppercase">Professional Billing System</h2>
        
        <select className="w-full bg-slate-950 p-3 rounded mb-4 text-white border border-slate-700" onChange={(e) => {
          const [c, r] = e.target.value.split('|');
          setSelectedClient(c); setSelectedRep(r);
        }}>
          <option value="">SELECT CLIENT | REP</option>
          {Array.from(new Set(data.map(r => `${r.client_name || 'NO CLIENT'}|${r.representative || 'NO REP'}`)))
            .map((i, index) => <option key={index} value={i}>{i.replace('|', ' - ')}</option>)}
        </select>

        <select className="w-full bg-slate-950 p-3 rounded mb-4 text-white border border-slate-700" onChange={(e) => setSelectedMonth(e.target.value)}>
          <option value="">SELECT BILL MONTH</option>
          {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        
        <button onClick={generateInvoice} className="w-full bg-blue-600 p-4 font-black uppercase rounded hover:bg-blue-700">GENERATE & DOWNLOAD BILL</button>
      </div>

      <div className="max-w-6xl mx-auto bg-white p-6 rounded-xl text-black">
        <h3 className="font-black mb-4 uppercase text-slate-700">MY CLIENT LEDGER</h3>
        <table className="w-full text-sm">
  <thead className="bg-slate-200">
    <tr className="uppercase text-left">
      <th className="p-2">BILL NO</th>
      <th className="p-2">CLIENT | REP</th>
      <th className="p-2">AMOUNT</th>
      <th className="p-2">STATUS</th>
      <th className="p-2">UTR NO</th>
      <th className="p-2">VIEW</th>
    </tr>
  </thead>
  <tbody>
    {invoices.map((inv) => (
      <React.Fragment key={inv.id}>
        <tr className="border-b uppercase">
          <td className="p-2">{inv.invoice_no}</td>
          
          {/* CLIENT | REP Single Line */}
          <td className="p-2 whitespace-nowrap">
            <span className="font-bold">{inv.client_name}</span>
            <span className="text-gray-500 text-xs"> | {inv.representative || 'N/A'}</span>
          </td>
          
          <td className="p-2">{inv.total_amount}</td>
          <td className="p-2 font-bold text-blue-700">{inv.status}</td>
          
          {/* UTR COLUMN */}
          <td className="p-2">
            {inv.utr_no ? (
              <span className="text-green-700 font-bold">{inv.utr_no}</span>
            ) : (
              <div className="flex gap-1 items-center">
                <input
                  type="text"
                  placeholder="UTR No"
                  className="border rounded px-1 w-20 text-black text-xs"
                  onChange={(e) => setUtrValues({ ...utrValues, [inv.id]: e.target.value })}
                />
                <button
                  onClick={() => updateUtr(inv.id, utrValues[inv.id])}
                  className="bg-green-600 text-white px-1 rounded text-[10px]"
                >
                  SAVE
                </button>
              </div>
            )}
          </td>

          <td className="p-2">
            <button 
              onClick={() => setExpandedBill(expandedBill === inv.invoice_no ? null : inv.invoice_no)} 
              className="bg-slate-800 text-white px-2 py-1 rounded text-[10px]"
            >
              {expandedBill === inv.invoice_no ? "HIDE" : "VIEW"}
            </button>
          </td>
        </tr>
        
        {/* Expanded Details */}
        {expandedBill === inv.invoice_no && (
          <tr>
            <td colSpan={6} className="p-4 bg-slate-50 text-[11px] text-black">
              <div className="font-bold mb-2">BILL DETAILS:</div>
              {data
                .filter(r => r.client_name === inv.client_name)
                .map((r, idx) => (
                  <div key={idx} className="flex gap-4 border-b py-1">
                    <span>Ref: {r.ref_no}</span>
                    <span>Type: {r.case_type}</span>
                    <span className="font-bold">₹{r.fee_standard}</span>
                  </div>
              ))}
            </td>
          </tr>
        )}
      </React.Fragment>
    ))}
  </tbody>
</table>
      </div>
    </div>
  );
}