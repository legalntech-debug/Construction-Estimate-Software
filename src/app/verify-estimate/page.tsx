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
  const [showOfferPopup, setShowOfferPopup] = useState(false);
  const [showAboutPopup, setShowAboutPopup] = useState(false);

  // Initialize component: Parse URL params and trigger search
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    
    if (ref) {
      setFilterRefNo(ref); 
    } else {
      handleSearch();
    }

    // Display offer popup after 1.5 seconds
    const timer = setTimeout(() => {
      setShowOfferPopup(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []); 

  // Debounced search on filter change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch();
    }, 500);
    
    return () => clearTimeout(delayDebounceFn);
  }, [filterRefNo, filterCustomer]);

  // Fetch estimates from Supabase based on filters
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

  // Generate and download PDF report for a specific estimate
  const downloadPDF = (item: any) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const snapshot = item.estimate_snapshot || {};
    
    // Company Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(20, 48, 114);
    doc.text("LEGAL N TECH CONSULTANT", 105, 20, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Engineering Consultant", 105, 26, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("203, MAYUR COMPLEX, 49 SUTAR GALI, JAIL ROAD, INDORE (M.P)", 105, 31, { align: "center" });
    doc.text("Contact: 8103804355 / 79875-61396 | Email: legalntech@gmail.com", 105, 35, { align: "center" });

    doc.setDrawColor(20, 48, 114);
    doc.setLineWidth(0.6);
    doc.line(14, 38, 196, 38);

    // Corporate Profile Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 48, 114);
    doc.text("CORPORATE PROFILE", 14, 45);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("We provide technical services including Construction Planning, Interior Design, Building", 14, 50);
    doc.text("Permission & Plan Approval, and Property Purchase Advice.", 14, 54);

    // Vision & Goal Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(20, 48, 114);
    doc.text("VISION:", 14, 60);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("To make engineering work easy and smooth for everyone across India.", 30, 60);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 48, 114);
    doc.text("GOAL:", 14, 65);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("Empowering clients with accurate, transparent, and AI-integrated planning solutions.", 30, 65);

    // Services Section
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 48, 114);
    doc.text("SERVICES:", 14, 70);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text("1. Construction Planning  2. Interior Design  3. Building Permission  4. Property Advice", 30, 70);

    doc.setDrawColor(20, 48, 114);
    doc.setLineWidth(0.6);
    doc.line(14, 75, 196, 75);

    // Estimate Details Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`REF NO: ${item.ref_no || 'N/A'}`, 14, 82);
    
    const displayDate = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : '-';
    doc.text(`DATE: ${displayDate}`, 196, 82, { align: "right" });

    doc.setFontSize(11);
    doc.text("PROPOSED CONSTRUCTION ESTIMATE REPORT", 14, 92);

    doc.setFontSize(10);
    doc.text("CUSTOMER NAME", 14, 102);
    doc.setFont("helvetica", "normal");
    doc.text(`: ${item.customer_name || 'N/A'}`, 60, 102);

    doc.setFont("helvetica", "bold");
    doc.text("PROPERTY ADDRESS", 14, 110);
    doc.setFont("helvetica", "normal");
    
    const splitAddress = doc.splitTextToSize(item.property_address || 'N/A', 130);
    doc.text(":", 60, 110);
    doc.text(splitAddress, 63, 110);

    const addressLines = Array.isArray(splitAddress) ? splitAddress.length : 1;
    const tableStartY = 117 + (addressLines * 5);

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

    // Disclaimer & Terms Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("DISCLAIMER & TERMS:", 14, noteY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    const disclaimerText = "This estimation is provided purely as a tentative budgetary guide for informational purposes at the request of the customer to understand the potential scope and incurred costs of the house/bungalow. It is not a binding commercial contract, a fixed-price quotation, or a guaranteed construction cost, as final expenses may vary significantly due to market fluctuations in material prices (e.g., steel, cement), unforeseen site-specific conditions, design changes, and local regulatory requirements. Before initiating any financial commitments, the customer is strictly advised to conduct a detailed site inspection and consult with qualified structural engineers and contractors to obtain finalized site-specific BOQs and quotes. The estimator bears no financial or legal liability for any budget shortfalls, cost overruns, or discrepancies that may arise during actual construction, and the use of this document for any financial or institutional application remains the sole responsibility of the customer. This document is valid for 60 days from the date of issue.";
    const splitDisclaimer = doc.splitTextToSize(disclaimerText, 180);
    doc.text(splitDisclaimer, 14, noteY + 10);

    doc.save(`Summary_Report_${item.ref_no}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col scroll-smooth">
      {/* Top Bar: Contact & Address Information */}
      <div className="bg-blue-900 text-white py-2 px-6 flex flex-col sm:flex-row justify-between items-center text-[10px] sm:text-xs font-medium tracking-wide">
        <div className="flex items-center gap-4 mb-2 sm:mb-0">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            8103804355
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            legalntech@gmail.com
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">203, MAYUR COMPLEX, 49 SUTAR GALI, JAIL ROAD, INDORE (M.P)</span>
          <span className="bg-blue-700 px-2 py-0.5 rounded text-[9px] uppercase">Pan India Service</span>
        </div>
      </div>

      {/* Marquee: Announcement Bar */}
      <div className="bg-blue-800 text-white py-1.5 overflow-hidden whitespace-nowrap font-bold uppercase text-[10px] tracking-wider border-b border-blue-700">
        <div className="animate-marquee inline-block">
          Welcome to Legal n Tech Consultants • ERP Secure Gateway • Construction Planning • Interior Design • Building Permission • Property Purchase Advice • Pan India Service
        </div>
      </div>

      {/* Navbar: CBRE-Style Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-3">
          
          {/* Logo Section */}
          <div className="flex items-center gap-3 shrink-0">
            <img src="/logo.jpg" alt="Company Logo" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-extrabold text-blue-900 uppercase tracking-tight leading-tight">
                Legal N Tech <span className="text-blue-600">Consultant</span>
              </h1>
              <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-widest">Engineering Consultant</p>
            </div>
          </div>
          
          {/* Navigation Links */}
          <div className="hidden lg:flex items-center gap-5 text-xs font-bold text-gray-700 uppercase tracking-wide">
            <a href="#services" className="hover:text-blue-600 transition">Services</a>
            <a href="#insights" className="hover:text-blue-600 transition">Insights & Research</a>
            <a href="#properties" className="hover:text-blue-600 transition">Properties</a>
            <a href="#offices" className="hover:text-blue-600 transition">Offices</a>
            <a href="#careers" className="hover:text-blue-600 transition">Careers</a>
            
            {/* About Us: Opens Popup */}
            <button 
              onClick={() => setShowAboutPopup(true)} 
              className="hover:text-blue-600 transition uppercase"
            >
              About Us
            </button>

            <a href="#contact" className="hover:text-blue-600 transition">Contact Us</a>
          </div>

          {/* Authentication Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/login" className="text-blue-900 text-xs font-bold px-3 py-2 hover:bg-blue-50 rounded-lg transition whitespace-nowrap">Sign In</Link>
            <Link href="/signup" className="bg-blue-900 text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-blue-800 shadow-md transition-all whitespace-nowrap">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
        <div className="max-w-7xl mx-auto px-6 py-16 relative z-10">
          <div className="max-w-3xl">
            
            {/* Experience Badge */}
            <span className="inline-block bg-yellow-400 text-blue-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4">
              11+ Years Experience
            </span>

            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4 leading-tight">
              We make <span className="text-blue-400">engineering work</span> easy and smooth for everyone.
            </h1>
            <p className="text-lg text-blue-100 mb-8 font-light">
              Pan India service for Construction Planning, Interior Design, Building Permission, and Property Purchase Advice. We create solutions for clients of every size.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="#verify" className="bg-white text-blue-900 px-8 py-3 rounded-lg font-bold text-sm uppercase tracking-wide hover:bg-blue-50 transition shadow-lg">
                Verify Estimate
              </Link>
              <Link href="/signup" className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-bold text-sm uppercase tracking-wide hover:bg-white/10 transition">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Company Growth / Stats Section */}
      <div className="bg-white border-b border-gray-200 py-10" id="insights">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            
            {/* Stat 1: Projects Completed */}
            <div className="group relative cursor-pointer">
              <p className="text-3xl font-black text-blue-900">500+</p>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Projects Completed</p>
              
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-blue-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 shadow-xl">
                <p className="font-bold mb-1 text-blue-300">500+ Projects</p>
                <p className="text-gray-200">We have successfully completed over 500 construction and estimation projects to date.</p>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-blue-900"></div>
              </div>
            </div>

            {/* Stat 2: Expert Engineers */}
            <div className="group relative cursor-pointer">
              <p className="text-3xl font-black text-blue-900">50+</p>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Expert Engineers</p>
              
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-blue-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 shadow-xl">
                <p className="font-bold mb-1 text-blue-300">50+ Expert Engineers</p>
                <p className="text-gray-200">Our team comprises over 50 experienced engineers who handle every project with precision.</p>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-blue-900"></div>
              </div>
            </div>

            {/* Stat 3: Pan India Service */}
            <div className="group relative cursor-pointer">
              <p className="text-3xl font-black text-blue-900">Pan India</p>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Service Coverage</p>
              
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-blue-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 shadow-xl">
                <p className="font-bold mb-1 text-blue-300">Pan India Service</p>
                <p className="text-gray-200">We provide our services across every corner of India, no matter which state you are in.</p>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-blue-900"></div>
              </div>
            </div>

            {/* Stat 4: Client Satisfaction */}
            <div className="group relative cursor-pointer">
              <p className="text-3xl font-black text-blue-900">100%</p>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Client Satisfaction</p>
              
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-blue-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 shadow-xl">
                <p className="font-bold mb-1 text-blue-300">100% Satisfaction</p>
                <p className="text-gray-200">All our clients are 100% satisfied with our services. Experience it yourself!</p>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-blue-900"></div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Corporate Details: 4 Cards Section */}
      <div className="max-w-7xl mx-auto px-6 -mt-8 relative z-20 mb-10" id="services">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Company Profile */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300" id="about">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
            </div>
            <h3 className="text-blue-900 font-bold text-lg uppercase mb-2">Company Profile</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-2">
              Legal N Tech Consultant is a premier engineering firm providing end-to-end Construction Planning, Interior Design, Building Permission, and Property Purchase Advice.
            </p>
            <p className="text-blue-700 text-xs font-bold uppercase tracking-wide">11+ Years of Industry Experience</p>
          </div>

          {/* Card 2: Vision & Goal */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
            </div>
            <h3 className="text-blue-900 font-bold text-lg uppercase mb-3">Vision & Goal</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-3">
              <span className="font-bold text-gray-800">Vision (Next 5 Years):</span> To become India's fastest and smoothest construction & real estate consultancy — where every customer gets a completely online, transparent, and hassle-free experience from planning to possession.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mb-3">
              <span className="font-bold text-gray-800">Goal:</span> To stand beside every customer at every step — from online house planning, document management, construction planning, and building permission to final construction guidance — so that building a home becomes easy, affordable, and stress-free.
            </p>
            <div className="mt-3 border-t border-gray-200 pt-3">
              <p className="text-blue-900 font-bold text-xs uppercase tracking-wide mb-2">What We Are Building for You:</p>
              <ul className="text-gray-600 text-xs space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1 shrink-0"></span>
                  <span><span className="font-semibold text-gray-800">Online Document Management System</span> — All documents in one place, safe & secure.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1 shrink-0"></span>
                  <span><span className="font-semibold text-gray-800">Online House Planning Service</span> — Get your house plan made from home.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1 shrink-0"></span>
                  <span><span className="font-semibold text-gray-800">Construction Planning & Consultancy</span> — Expert guidance at every step.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1 shrink-0"></span>
                  <span><span className="font-semibold text-gray-800">Civil & Real Estate Guidance</span> — Full support from property purchase to construction.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1 shrink-0"></span>
                  <span><span className="font-semibold text-gray-800">End-to-End Home Building Support</span> — From foundation to finish, we are with you.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 3: Our Services */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h3 className="text-blue-900 font-bold text-lg uppercase mb-3">Our Services</h3>
            <ul className="text-gray-600 text-sm leading-relaxed space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Construction Work:</span> Complete end-to-end construction solutions from foundation to finish.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Estimation Work:</span> Accurate cost estimation with detailed BOQ, material specs & rate analysis.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Construction Planning:</span> Strategic project planning with timeline & resource management.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Interior Design:</span> Modern & functional interior design solutions for every space.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Building Permission:</span> Fast & hassle-free building plan approval and permissions.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Property Purchase Advice:</span> Expert guidance for smart property investment decisions.</span>
              </li>
            </ul>
          </div>

          {/* Card 4: Why Choose Us */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <h3 className="text-blue-900 font-bold text-lg uppercase mb-3">Why Choose Us</h3>
            <ul className="text-gray-600 text-sm leading-relaxed space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">24x365 Available:</span> We are available round the clock, every day of the year for you.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Instant & Easy Way:</span> Get your work done instantly with our simple and easy process.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Very Attractive Price:</span> Premium services at the most competitive and attractive prices.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Just Input & Get Output:</span> Simply enter your details and everything gets generated automatically.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Pan India Service:</span> Serving clients across every corner of India.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Secure Client Gateway:</span> Your data is safe and secure with our encrypted portal.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0"></span>
                <span><span className="font-semibold text-gray-800">Instant PDF Reports:</span> Download detailed reports instantly in PDF format.</span>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* Verification Portal Section */}
      <div id="verify" className="max-w-7xl mx-auto px-6 py-10 flex-grow w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-blue-900 uppercase tracking-wide mb-2">Estimate Verification Portal</h2>
          <div className="w-24 h-1 bg-blue-600 mx-auto rounded-full"></div>
          <p className="text-gray-500 text-sm mt-4">Search and verify construction estimates using Reference Number or Customer Name.</p>
        </div>
        
        <div className="border border-blue-600 rounded-xl shadow-xl bg-white overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead className="bg-blue-900 text-white uppercase text-xs sticky top-0 z-10 shadow-md">
                <tr>
                  <th className="border p-3 w-[180px] bg-blue-900">
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
                  <th className="border p-3 w-[90px] font-bold bg-blue-900">Date</th>
                  <th className="border p-3 w-[180px] bg-blue-900">
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
                  <th className="border p-3 w-[240px] font-bold bg-blue-900">Property Address</th>
                  <th className="border p-3 w-[80px] font-bold bg-blue-900">Plot Area</th>
                  <th className="border p-3 w-[80px] font-bold bg-blue-900">Built-up</th>
                  <th className="border p-3 w-[90px] font-bold bg-blue-900">Rate/Sq.Ft</th>
                  <th className="border p-3 w-[110px] font-bold bg-blue-900">Amount</th>
                  <th className="border p-3 w-[80px] font-bold bg-blue-900">Action</th>
                </tr>
              </thead>
              <tbody>
                {results.length > 0 ? results.map((item: any) => {
                  const snapshot = item.estimate_snapshot || {};
                  return (
                    <tr key={item.id} className="text-center border-b hover:bg-blue-50/60 text-sm transition-colors">
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
                          className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 cursor-pointer active:scale-95 transition-all shadow-md"
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
      </div>

      {/* Career Section */}
      <div className="bg-blue-50 py-12 border-y border-blue-100" id="careers">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-blue-900 uppercase tracking-wide">Join Our Team</h2>
            <p className="text-gray-600 text-sm mt-2">We are always looking for talented engineers, designers, and planners.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h4 className="font-bold text-blue-900 mb-1">Civil Engineer</h4>
              <p className="text-xs text-gray-500 mb-3">Full Time | Pan India</p>
              <p className="text-sm text-gray-600 mb-4">Experience in construction estimation and structural design.</p>
              <Link href="/careers" className="text-blue-600 text-xs font-bold uppercase hover:underline">Apply Now →</Link>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h4 className="font-bold text-blue-900 mb-1">Interior Designer</h4>
              <p className="text-xs text-gray-500 mb-3">Full Time | Pan India</p>
              <p className="text-sm text-gray-600 mb-4">Creative mindset with expertise in modern interior planning.</p>
              <Link href="/careers" className="text-blue-600 text-xs font-bold uppercase hover:underline">Apply Now →</Link>
            </div>
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h4 className="font-bold text-blue-900 mb-1">Building Plan Approver</h4>
              <p className="text-xs text-gray-500 mb-3">Full Time | Pan India</p>
              <p className="text-sm text-gray-600 mb-4">Knowledge of municipal building permission processes.</p>
              <Link href="/careers" className="text-blue-600 text-xs font-bold uppercase hover:underline">Apply Now →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Offer Popup Modal */}
      {showOfferPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden relative animate-fadeIn">
            <button 
              onClick={() => setShowOfferPopup(false)}
              className="absolute top-3 right-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6 text-center relative">
              <span className="inline-block bg-yellow-400 text-blue-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                Limited Time Offer
              </span>
              <h3 className="text-2xl font-black uppercase tracking-wide">Special Estimate Offer</h3>
              <p className="text-blue-100 text-xs mt-1">Get your complete estimate report at an unbeatable price!</p>
            </div>

            <div className="p-6">
              <div className="flex flex-col gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                  <div className="text-center flex-1">
                    <p className="text-gray-500 text-xs uppercase font-bold">Estimate</p>
                    <p className="text-xl font-bold text-gray-700 line-through">₹120</p>
                  </div>
                  <div className="text-center flex-1 border-l border-gray-200">
                    <p className="text-gray-500 text-xs uppercase font-bold">Drafting</p>
                    <p className="text-xl font-bold text-gray-700 line-through">₹100</p>
                  </div>
                </div>
                <div className="text-center bg-yellow-50 rounded-lg py-2 border border-yellow-200">
                  <p className="text-yellow-700 text-xs uppercase font-bold">Offer Price</p>
                  <p className="text-3xl font-black text-green-600">₹21/-</p>
                  <p className="text-[10px] text-gray-500 mt-1">Both Estimate & Drafting are included in this offer</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <span>Complete Estimate & Drafting Report</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <span>Map & Location Plan</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <span>Upcoming Services (Ready in 1 Min)</span>
                </div>
              </div>

              <button 
                onClick={() => setShowOfferPopup(false)}
                className="w-full bg-blue-900 text-white font-bold py-3 rounded-lg hover:bg-blue-800 transition shadow-lg text-sm uppercase tracking-wide"
              >
                Claim Offer Now
              </button>
              <p className="text-center text-[10px] text-gray-400 mt-3">*Terms & Conditions Apply</p>
            </div>
          </div>
        </div>
      )}

      {/* About Us Popup Modal */}
      {showAboutPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden relative animate-fadeIn my-8">
            
            <button 
              onClick={() => setShowAboutPopup(false)}
              className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6 text-center relative">
              <span className="inline-block bg-yellow-400 text-blue-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                11+ Years Experience
              </span>
              <h3 className="text-2xl md:text-3xl font-black uppercase tracking-wide">About Legal N Tech Consultant</h3>
              <p className="text-blue-100 text-xs mt-2">Your Trusted Engineering & Real Estate Partner</p>
            </div>

            <div className="p-6 md:p-8 max-h-[70vh] overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Company Profile */}
                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                    </div>
                    <h4 className="text-blue-900 font-bold text-lg uppercase">Company Profile</h4>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Legal N Tech Consultant is a premier engineering firm providing end-to-end Construction Planning, Interior Design, Building Permission, and Property Purchase Advice.
                  </p>
                  <p className="text-blue-700 text-xs font-bold uppercase tracking-wide mt-3">11+ Years of Industry Experience</p>
                </div>

                {/* Vision & Goal */}
                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    </div>
                    <h4 className="text-blue-900 font-bold text-lg uppercase">Vision & Goal</h4>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-2">
                    <span className="font-bold text-gray-800">Vision (Next 5 Years):</span> To become India's fastest and smoothest construction & real estate consultancy — where every customer gets a completely online, transparent, and hassle-free experience from planning to possession.
                  </p>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    <span className="font-bold text-gray-800">Goal:</span> To stand beside every customer at every step — from online house planning, document management, construction planning, and building permission to final construction guidance.
                  </p>
                </div>

              </div>

              {/* What We Are Building for You */}
              <div className="mt-6 bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h4 className="text-blue-900 font-bold text-sm uppercase tracking-wide mb-3">What We Are Building for You:</h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-600 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 shrink-0"></span>
                    <span><span className="font-semibold text-gray-800">Online Document Management System</span> — All documents in one place, safe & secure.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 shrink-0"></span>
                    <span><span className="font-semibold text-gray-800">Online House Planning Service</span> — Get your house plan made from home.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 shrink-0"></span>
                    <span><span className="font-semibold text-gray-800">Construction Planning & Consultancy</span> — Expert guidance at every step.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 shrink-0"></span>
                    <span><span className="font-semibold text-gray-800">Civil & Real Estate Guidance</span> — Full support from property purchase to construction.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 shrink-0"></span>
                    <span><span className="font-semibold text-gray-800">End-to-End Home Building Support</span> — From foundation to finish, we are with you.</span>
                  </li>
                </ul>
              </div>

              {/* Close Button */}
              <div className="mt-6 text-center">
                <button 
                  onClick={() => setShowAboutPopup(false)}
                  className="bg-blue-900 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-800 transition shadow-lg text-sm uppercase tracking-wide"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Footer Section */}
      <footer className="bg-blue-900 text-white pt-12 pb-6 mt-10 border-t-4 border-blue-700" id="contact">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          
          <div>
            <h3 className="text-lg font-bold uppercase tracking-wider mb-4 text-blue-300">Legal N Tech Consultant</h3>
            <p className="text-sm text-gray-300 leading-relaxed mb-4">
              Engineering Consultant providing Pan India services for Construction Planning, Interior Design, Building Permission, and Property Purchase Advice.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span>203, MAYUR COMPLEX, 49 SUTAR GALI, JAIL ROAD, INDORE (M.P)</span>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold uppercase tracking-wider mb-4 text-blue-300">Contact Us</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                <div>
                  <p className="font-semibold text-white">Helpline:</p>
                  <p>8103804355 / 79875-61396</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                <div>
                  <p className="font-semibold text-white">Email:</p>
                  <p>legalntech@gmail.com</p>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold uppercase tracking-wider mb-4 text-blue-300">Disclaimer</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              This estimation is provided purely as a tentative budgetary guide. It is not a binding commercial contract or a fixed-price quotation. Final expenses may vary due to market fluctuations, site conditions, and design changes. The estimator bears no financial or legal liability for any budget shortfalls. Valid for 60 days from date of issue.
            </p>
          </div>

        </div>

        <div className="border-t border-blue-800 pt-6 text-center">
          <p className="text-xs text-blue-300">
            © {new Date().getFullYear()} Legal N Tech Consultant. All Rights Reserved. | Engineering Consultant
          </p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { animation: marquee 20s linear infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
}