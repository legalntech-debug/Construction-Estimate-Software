'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function VerifyEstimate() {
  const [filterRefNo, setFilterRefNo] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    
    if (ref) {
      setFilterRefNo(ref); 
    } else {
      handleSearch();
    }
  }, []); 

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch();
    }, 500);
    
    return () => clearTimeout(delayDebounceFn);
  }, [filterRefNo, filterCustomer]);

  const handleSearch = async () => {
    try {
      let query = supabase
        .from('estimates')
        .select('id, ref_no, created_at, customer_name, property_address, plot_area, total_builtup_area, total_construction_cost, estimate_snapshot, rate_per_sqft');
      
      if (filterRefNo) {
        query = query.ilike('ref_no', `%${filterRefNo}%`);
      }
      if (filterCustomer) {
        query = query.ilike('customer_name', `%${filterCustomer}%`);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        console.error("Supabase fetch error:", error.message);
      } else {
        setResults(data || []);
      }
    } catch (err) {
      console.error("Execution error:", err);
    }
  };

  const downloadPDF = (item: any) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const snapshot = item.estimate_snapshot || {};
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(20, 48, 114);
    doc.text("LEGAL N TECH CONSULTANT", 105, 20, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Approved Valuer & Engineering Consultant", 105, 26, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Construction Estimate Summary Report", 105, 33, { align: "center" });
    
    doc.setDrawColor(20, 48, 114);
    doc.setLineWidth(0.6);
    doc.line(14, 37, 196, 37);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`REF NO: ${item.ref_no || 'N/A'}`, 14, 44);
    
    const displayDate = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : '-';
    doc.text(`DATE: ${displayDate}`, 196, 44, { align: "right" });

    doc.setFontSize(11);
    doc.text("PROPOSED CONSTRUCTION ESTIMATE REPORT", 14, 54);

    doc.setFontSize(10);
    doc.text("CUSTOMER NAME", 14, 64);
    doc.setFont("helvetica", "normal");
    doc.text(`: ${item.customer_name || 'N/A'}`, 60, 64);

    doc.setFont("helvetica", "bold");
    doc.text("PROPERTY ADDRESS", 14, 72);
    doc.setFont("helvetica", "normal");
    
    const splitAddress = doc.splitTextToSize(item.property_address || 'N/A', 130);
    doc.text(":", 60, 72);
    doc.text(splitAddress, 63, 72);

    const addressLines = Array.isArray(splitAddress) ? splitAddress.length : 1;
    const tableStartY = 75 + (addressLines * 5);

    const summaryHeaders = [["SR", "DESCRIPTION", "AREA / VALUES"]];
    const summaryRows = [
      ["1", "PLOT AREA", `${item.plot_area || snapshot.plot_area || '0'} SQ.FT`],
      ["2", "TOTAL BUILT UP AREA", `${item.total_builtup_area || '0'} SQ.FT`],
      ["3", "RATE PER SQ.FT", `Rs. ${item.rate_per_sqft || snapshot.rate_per_sqft || '0'}/-`],
      ["4", "TOTAL ESTIMATE VALUE", `Rs. ${item.total_construction_cost ? Number(item.total_construction_cost).toLocaleString('en-IN') : '0'}/-`]
    ];

    autoTable(doc, {
      startY: tableStartY,
      head: summaryHeaders,
      body: summaryRows,
      theme: 'grid',
      headStyles: { fillColor: [20, 48, 114], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9.5, textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 120, fontStyle: 'bold' },
        2: { cellWidth: 47, halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    
    doc.setFillColor(254, 242, 242); 
    doc.setDrawColor(239, 68, 68); 
    doc.setLineWidth(0.4);
    doc.rect(14, finalY, 182, 32, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(220, 38, 38); 
    doc.text("DETAILED MEASUREMENT BREAKUP IS LOCKED", 105, finalY + 8, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.text("To view complete structural descriptions, material specifications, quantity surveys (BBS),", 105, finalY + 15, { align: "center" });
    doc.text("and full operational multi-page dynamic reports, please process standard authorization premium payment.", 105, finalY + 20, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 48, 114);
    doc.text("Click 'Unlock Full PDF Report' on portal gateway dashboard to clear pending invoice.", 105, finalY + 26, { align: "center" });

    const noteY = finalY + 45;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(14, noteY, 196, noteY);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    
    const disclaimerText1 = "This is a system generated document summary report. No physical signature is required.";
    const disclaimerText2 = `This document is issued solely for verifying estimate records using Reference Number: ${item.ref_no || 'N/A'}.`;
    
    doc.text(disclaimerText1, 105, noteY + 5, { align: "center" });
    doc.text(disclaimerText2, 105, noteY + 10, { align: "center" });

    doc.save(`Summary_Report_${item.ref_no}.pdf`);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-blue-900 text-white py-2 overflow-hidden whitespace-nowrap font-bold uppercase text-xs">
        <div className="animate-marquee inline-block">
          Welcome to Legal n Tech Consultants • ERP Secure Gateway • Construction Estimate System • Client Management Live • MIS Dashboard • PDF Engine • Wallet System • AI ERP Core
        </div>
      </div>

      {/* NAVBAR */}
      <nav className="flex flex-col sm:flex-row justify-between items-center gap-4 p-5 border-b border-gray-200 bg-white shadow-sm">
        <h1 className="text-xl font-extrabold text-blue-900 uppercase text-center sm:text-left tracking-wide">
          LnT WITH AI 2.0 PORTAL
        </h1>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-blue-900 text-sm font-bold px-4 py-2 hover:bg-blue-50 rounded-lg transition">Sign In</Link>
          <Link href="/signup" className="bg-blue-900 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-blue-800 shadow transition">Sign Up</Link>
        </div>
      </nav>

      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <h2 className="text-2xl font-black mb-6 text-center text-blue-900 uppercase tracking-wide">ESTIMATE VERIFICATION PORTAL</h2>
        
        {/* TABLE CONTAINER WITH PROPER SCROLL & WIDTH */}
        <div className="overflow-x-auto border border-blue-600 rounded-xl shadow-md bg-white">
          <table className="w-full border-collapse min-w-[900px]">
            <thead className="bg-blue-900 text-white uppercase text-xs">
              <tr>
                <th className="border p-3 w-[180px]">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold">Ref No.</span>
                    <input 
                      type="text"
                      placeholder="Filter Ref..."
                      value={filterRefNo}
                      onChange={(e) => setFilterRefNo(e.target.value)}
                      className="p-1.5 text-black text-xs font-normal rounded border border-gray-300 w-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    />
                  </div>
                </th>
                <th className="border p-3 w-[90px] font-bold">Date</th>
                <th className="border p-3 w-[180px]">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold">Customer Name</span>
                    <input 
                      type="text"
                      placeholder="Filter Name..."
                      value={filterCustomer}
                      onChange={(e) => setFilterCustomer(e.target.value)}
                      className="p-1.5 text-black text-xs font-normal rounded border border-gray-300 w-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    />
                  </div>
                </th>
                <th className="border p-3 w-[240px] font-bold">Property Address</th>
                <th className="border p-3 w-[80px] font-bold">Plot Area</th>
                <th className="border p-3 w-[80px] font-bold">Built-up</th>
                <th className="border p-3 w-[90px] font-bold">Rate/Sq.Ft</th>
                <th className="border p-3 w-[110px] font-bold">Amount</th>
                <th className="border p-3 w-[80px] font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {results.length > 0 ? results.map((item: any) => {
                const snapshot = item.estimate_snapshot || {};
                return (
                  <tr key={item.id} className="text-center border-b hover:bg-blue-50/60 text-sm">
                    <td className="border p-3.5 font-bold text-blue-700 break-words">{item.ref_no || 'N/A'}</td>
                    <td className="border p-3.5 text-gray-700">{item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : '-'}</td>
                    <td className="border p-3.5 text-gray-900 font-semibold break-words">{item.customer_name || 'N/A'}</td>
                    <td className="border p-3.5 text-gray-700 break-words text-left">{item.property_address || 'N/A'}</td>
                    <td className="border p-3.5 text-gray-700">{item.plot_area || snapshot.plot_area || '-'}</td>
                    <td className="border p-3.5 text-gray-700">{item.total_builtup_area || '0'}</td>
                    <td className="border p-3.5 text-gray-700">{item.rate_per_sqft || snapshot.rate_per_sqft || '-'}</td>
                    <td className="border p-3.5 font-bold text-blue-900">
                      {item.total_construction_cost ? `₹${Number(item.total_construction_cost).toLocaleString('en-IN')}` : '₹0'}
                    </td>
                    <td className="border p-3.5">
                      <button 
                        onClick={() => downloadPDF(item)}
                        className="bg-green-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 cursor-pointer active:scale-95 transition-transform shadow"
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={9} className="border p-8 text-gray-500 text-center font-medium">No data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { animation: marquee 20s linear infinite; }
      `}</style>
    </div>
  );
}