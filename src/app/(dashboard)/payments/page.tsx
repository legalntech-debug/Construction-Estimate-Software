'use client';
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function PaymentsPage() {
  const [data, setData] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [billedRefNos, setBilledRefNos] = useState<string[]>([]);
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
      fetchData(); 
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: records } = await supabase
      .from("mis_records")
      .select("*")
      .eq("user_id", user.id);
    setData(records || []);
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    let query = supabase.from("invoices").select("*").order('created_at', { ascending: false });

    if (profile?.role !== 'admin') {
      query = query.eq("user_id", user.id); 
    }

    const { data: invs, error } = await query;
      
    if (error) {
      console.error("Supabase Error (Fetch Invoices):", error);
    } else {
      setInvoices(invs || []);
    }

    // Fetch already billed reference numbers to restrict duplicate billing
    const { data: billedItems } = await supabase
      .from("invoice_items") 
      .select("ref_no");
    
    if (billedItems) {
      setBilledRefNos(billedItems.map(item => item.ref_no));
    }
  };
  
  const generateInvoice = async () => {
    if (!selectedClient || !selectedMonth) return alert("Select Client & Month!");

    const billNo = `LNT/${Date.now().toString().slice(-6)}`;
    const currentDate = new Date().toLocaleDateString('en-IN');
    
    // Filter client cases and EXCLUDE those ref_nos that are already billed
    const clientCases = data.filter(r => 
      r.client_name === selectedClient && !billedRefNos.includes(r.ref_no)
    );

    if (clientCases.length === 0) {
      return alert("No unbilled cases found for this client! All cases are already billed.");
    }
    
    const formatCustomerName = (name: string) => {
      if (!name) return "N/A";
      const cleaned = name.split(/,\s*(w\/o|s\/o|d\/o|W\/O|S\/O|D\/O)/i)[0];
      return cleaned.trim();
    };

    const { data: clientData } = await supabase
      .from("clients")
      .select("address, gst_no")
      .eq("client_name", selectedClient)
      .single();

    let clientAddress = clientData?.address || "N/A";
    let clientGst = clientData?.gst_no || "";

    if (!clientGst || clientGst === "N/A") {
      const manualGst = prompt(`Enter GST No. for ${selectedClient} (Leave blank if not applicable):`, "");
      clientGst = manualGst ? manualGst.trim() : "N/A";
    }

    const totalAmount = clientCases.reduce((sum, r) => sum + (Number(r.fee_standard) || 0), 0);
    const baseAmount = totalAmount / 1.18; 
    const gstAmount = totalAmount - baseAmount;

    const doc = new jsPDF();

    doc.setTextColor(240, 240, 240);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(40);
    doc.text("PROFESSIONAL INVOICE", 105, 150, { align: 'center', angle: 45 });

    doc.setTextColor(0, 0, 0);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LEGAL n TECH", 105, 12, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("IOV APPROVED VALUER A-33162 | BUILDING PERMISSION DEPARTMENT", 105, 17, { align: 'center' });
    doc.text("ADDRESS: GROUND FLOOR, BUILDING NO. 180/5, MEGHDOOT NAGAR, INDORE", 105, 21, { align: 'center' });
    doc.text("Email: legalntech@gmail.com", 105, 25, { align: 'center' });
    
    doc.line(14, 28, 196, 28);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`BILL NO: ${billNo}`, 14, 34);
    doc.text(`DATE: ${currentDate}`, 196, 34, { align: 'right' });

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PROFESSIONAL BILL", 105, 43, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.text(`CLIENT NAME / REP:`, 14, 51);
    doc.setFont("helvetica", "normal");
    doc.text(`${selectedClient}    |    ${selectedRep}`, 52, 51);

    doc.setFont("helvetica", "bold");
    doc.text(`ADDRESS:`, 14, 58);
    doc.setFont("helvetica", "normal");
    doc.text(`${clientAddress}`, 52, 58);

    doc.setFont("helvetica", "bold");
    doc.text(`GST NO:`, 14, 65);
    doc.setFont("helvetica", "normal");
    doc.text(`${clientGst}`, 52, 65);

    autoTable(doc, {
      startY: 72,
      head: [['SR. NO.', 'REF NO', 'CUSTOMER NAME', 'CASE TYPE', 'AMOUNT (₹)']],
      body: [
        ...clientCases.map((r, index) => [
          (index + 1).toString(), 
          r.ref_no, 
          formatCustomerName(r.customer_name), 
          r.case_type, 
          Number(r.fee_standard).toFixed(2)
        ]),
        ['', '', '', 'TOTAL AMOUNT', totalAmount.toFixed(2)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], fontSize: 8, cellPadding: 3 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 50 },
        2: { cellWidth: 45 },
        3: { cellWidth: 43 },
        4: { cellWidth: 30 }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(`*Note: Amount is inclusive of GST. (Calculated GST @ 18%: Rs. ${gstAmount.toFixed(2)})`, 14, finalY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("This is an electronically generated document and does not require a physical signature or seal.", 105, finalY + 16, { align: 'center' });

    doc.save(`Invoice_${selectedClient}.pdf`);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("Session expired!");

    const { error } = await supabase.from("invoices").insert([{ 
        user_id: user.id,
        invoice_no: billNo,
        client_name: selectedClient,
        representative: selectedRep,
        total_amount: totalAmount, 
        status: 'BILLED'
    }]);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      fetchData();
      alert("Bill generated successfully and duplicate references blocked!");
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
                  
                  <td className="p-2 whitespace-nowrap">
                    <span className="font-bold">{inv.client_name}</span>
                    <span className="text-gray-500 text-xs"> | {inv.representative || 'N/A'}</span>
                  </td>
                  
                  <td className="p-2">{inv.total_amount}</td>
                  <td className="p-2 font-bold text-blue-700">{inv.status}</td>
                  
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