'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function VerifyEstimate() {
  const [filterRefNo, setFilterRefNo] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterCaseType, setFilterCaseType] = useState('ALL');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOfferPopup, setShowOfferPopup] = useState(false);
  const [showAboutPopup, setShowAboutPopup] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // ✅ YouTube Carousel + Dismiss State
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [showYoutubeBanner, setShowYoutubeBanner] = useState(true);

  const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/channel/UC1mP_vOnzepkvsZuIfB5SXQ';

  const youtubeVideos = [
    { title: 'How Construction Estimation Works', url: YOUTUBE_CHANNEL_URL },
    { title: 'Building Plan Approval Process', url: YOUTUBE_CHANNEL_URL },
    { title: 'Interior Design Walkthrough', url: YOUTUBE_CHANNEL_URL },
    { title: 'Property Purchase Tips', url: YOUTUBE_CHANNEL_URL },
    { title: 'Estimate Verification Guide', url: YOUTUBE_CHANNEL_URL },
  ];

  const [counts, setCounts] = useState({
    total: 0,
    estimate: 0,
    constructionPlan: 0,
    deedDraft: 0,
    subDivisionLayout: 0,
    locationPlan: 0,
    keyPlan: 0,
    other: 0,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    const caseParam = params.get('case');

    if (ref) setFilterRefNo(ref);
    if (caseParam) setFilterCaseType(caseParam.toUpperCase());

    handleSearch();

    const timer = setTimeout(() => {
      setShowOfferPopup(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showYoutubeBanner) return;

    const interval = setInterval(() => {
      setCurrentVideoIndex((prev) => (prev + 1) % youtubeVideos.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [youtubeVideos.length, showYoutubeBanner]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [filterRefNo, filterCustomer, filterCaseType]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      let estimatesQuery = supabase
        .from('estimates')
        .select('id, ref_no, created_at, customer_name, property_address, plot_area, total_builtup_area, total_construction_cost, estimate_snapshot, rate_per_sqft, estimate_type');

      if (filterRefNo) estimatesQuery = estimatesQuery.ilike('ref_no', `%${filterRefNo}%`);
      if (filterCustomer) estimatesQuery = estimatesQuery.ilike('customer_name', `%${filterCustomer}%`);

      let serviceQuery = supabase
        .from('service_records')
        .select('ref_no, created_at, customer_name, client_name, representative, property_address, plot_area, plot_area_unit, total_builtup_area, case_type, floor_details, form_snapshot, state_name, city_district, plot_shape, road_side, ground_coverage, boundary_east, boundary_west, boundary_north, boundary_south, deed_type, output_language, property_type, status');

      if (filterRefNo) serviceQuery = serviceQuery.ilike('ref_no', `%${filterRefNo}%`);
      if (filterCustomer) {
        serviceQuery = serviceQuery.or(
          `customer_name.ilike.%${filterCustomer}%,client_name.ilike.%${filterCustomer}%,representative.ilike.%${filterCustomer}%`
        );
      }

      const [estRes, srvRes] = await Promise.all([
        estimatesQuery.order('created_at', { ascending: false }),
        serviceQuery.order('created_at', { ascending: false }),
      ]);

      if (estRes.error) console.error('[ESTIMATES FETCH]', estRes.error.message);
      if (srvRes.error) console.error('[SERVICE RECORDS FETCH]', srvRes.error.message);

      const normalizedEstimates = (estRes.data || []).map((item: any) => {
        const snapshot = item.estimate_snapshot || {};
        return {
          _source: 'ESTIMATE',
          _key: `est-${item.id}`,
          ref_no: item.ref_no,
          created_at: item.created_at,
          customer_name: item.customer_name,
          property_address: item.property_address,
          plot_area: item.plot_area || snapshot.plot_area,
          total_builtup_area: item.total_builtup_area,
          rate_per_sqft: item.rate_per_sqft || snapshot.rate_per_sqft,
          amount: item.total_construction_cost,
          case_type: 'ESTIMATE',
          payment_status: 'paid',
          estimate_snapshot: item.estimate_snapshot,
          raw: item,
        };
      });

      const normalizedServices = (srvRes.data || []).map((item: any) => {
        const snapshot = item.form_snapshot || {};
        const resolvedCustomerName =
          item.customer_name || item.client_name || item.representative || 'N/A';
        const resolvedAmount = Number(item.gateway_fee || 0) || Number(item.user_payment || 0) || 0;

        return {
          _source: 'SERVICE',
          _key: `srv-${item.ref_no}`,
          ref_no: item.ref_no,
          created_at: item.created_at,
          customer_name: resolvedCustomerName,
          property_address: item.property_address,
          plot_area: item.plot_area || snapshot.plotArea,
          plot_area_unit: item.plot_area_unit || 'SQFT',
          total_builtup_area: item.total_builtup_area,
          rate_per_sqft: item.rate_per_sqft,
          amount: resolvedAmount,
          case_type: item.case_type || 'MAP',
          payment_status: item.payment_status || 'pending',
          platform_payment_status: item.platform_payment_status,
          service_record: item,
          raw: item,
        };
      });

      let merged = [...normalizedEstimates, ...normalizedServices].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      const allRecords = [...merged];
      const newCounts = {
        total: allRecords.length,
        estimate: allRecords.filter((r) => r._source === 'ESTIMATE').length,
        constructionPlan: allRecords.filter((r) => r.case_type === 'CONSTRUCTION_PLAN').length,
        deedDraft: allRecords.filter((r) => r.case_type === 'DEED_DRAFT').length,
        subDivisionLayout: allRecords.filter((r) => r.case_type === 'SUB_DIVISION_LAYOUT').length,
        locationPlan: allRecords.filter((r) => r.case_type === 'LOCATION_PLAN').length,
        keyPlan: allRecords.filter((r) => r.case_type === 'KEY_PLAN').length,
        other: allRecords.filter(
          (r) =>
            r._source !== 'ESTIMATE' &&
            !['CONSTRUCTION_PLAN', 'DEED_DRAFT', 'SUB_DIVISION_LAYOUT', 'LOCATION_PLAN', 'KEY_PLAN', 'MAP'].includes(r.case_type)
        ).length,
      };
      setCounts(newCounts);

      if (filterCaseType === 'ESTIMATE') {
        merged = merged.filter((r) => r._source === 'ESTIMATE');
      } else if (filterCaseType !== 'ALL') {
        merged = merged.filter((r) => r.case_type === filterCaseType);
      }

      setResults(merged);
    } catch (err) {
      console.error('Execution error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getCaseTypeBadgeClass = (caseType: string) => {
    switch (caseType) {
      case 'ESTIMATE': return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'CONSTRUCTION_PLAN': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'DEED_DRAFT': return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'SUB_DIVISION_LAYOUT': return 'bg-pink-100 text-pink-800 border border-pink-200';
      case 'LOCATION_PLAN': return 'bg-teal-100 text-teal-800 border border-teal-200';
      case 'KEY_PLAN': return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'MAP': return 'bg-green-100 text-green-800 border border-green-200';
      default: return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  const downloadPDF = async (item: any) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const isService = item._source === 'SERVICE';
    const snapshot = isService ? (item.service_record?.form_snapshot || {}) : (item.estimate_snapshot || {});

    try {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.src = '/logo.jpg';
      await new Promise((resolve) => {
        logoImg.onload = () => {
          doc.addImage(logoImg, 'JPEG', 14, 10, 22, 22);
          resolve(true);
        };
        logoImg.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn('Logo load failed', err);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(20, 48, 114);
    doc.text('LEGAL N TECH CONSULTANT', 105, 18, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('ENGINEERING CONSULTANT', 105, 24, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text('203, MAYUR COMPLEX, 49 SUTAR GALI, JAIL ROAD, INDORE (M.P)', 105, 29, { align: 'center' });
    doc.text('Contact: 8103804355 / 79875-61396 | Email: legalntech@gmail.com', 105, 33, { align: 'center' });

    doc.setDrawColor(20, 48, 114);
    doc.setLineWidth(0.6);
    doc.line(14, 37, 196, 37);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);
    doc.text('WE PROVIDE TECHNICAL SERVICES INCLUDING CONSTRUCTION ESTIMATION, BUILDING PLANNING AND DESIGN, BUILDING PERMISSION AND PLAN APPROVAL, SITE LAYOUT.', 105, 42, { align: 'center', maxWidth: 182 });

    doc.setDrawColor(20, 48, 114);
    doc.setLineWidth(0.4);
    doc.line(14, 46, 196, 46);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`REF NO: ${item.ref_no || 'N/A'}`, 14, 53);
    const displayDate = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : '-';
    doc.text(`DATE: ${displayDate}`, 196, 53, { align: 'right' });

    doc.setFontSize(12);
    doc.setTextColor(20, 48, 114);
    const titleMap: any = {
      ESTIMATE: 'PROPOSED CONSTRUCTION ESTIMATE REPORT',
      CONSTRUCTION_PLAN: 'CONSTRUCTION PLAN VERIFICATION REPORT',
      DEED_DRAFT: 'DEED DRAFT VERIFICATION REPORT',
      SUB_DIVISION_LAYOUT: 'SUB DIVISION LAYOUT VERIFICATION REPORT',
      LOCATION_PLAN: 'LOCATION PLAN VERIFICATION REPORT',
      KEY_PLAN: 'KEY PLAN VERIFICATION REPORT',
      MAP: 'MAP VERIFICATION REPORT',
    };
    doc.text(titleMap[item.case_type] || 'VERIFICATION REPORT', 105, 63, { align: 'center' });

    doc.setDrawColor(20, 48, 114);
    doc.setLineWidth(0.3);
    doc.line(14, 66, 196, 66);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 48, 114);
    doc.text(`CASE TYPE: ${item.case_type || 'N/A'}`, 14, 73);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('CUSTOMER NAME', 14, 82);
    doc.setFont('helvetica', 'normal');
    doc.text(`: ${item.customer_name || 'N/A'}`, 60, 82);

    doc.setFont('helvetica', 'bold');
    doc.text('PROPERTY ADDRESS', 14, 89);
    doc.setFont('helvetica', 'normal');
    const splitAddress = doc.splitTextToSize(item.property_address || 'N/A', 130);
    doc.text(':', 60, 89);
    doc.text(splitAddress, 63, 89);

    const addressLines = Array.isArray(splitAddress) ? splitAddress.length : 1;
    const addressEndY = 89 + (addressLines * 4.5);

    doc.setFont('helvetica', 'bold');
    doc.text('PLOT AREA', 14, addressEndY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `: ${item.plot_area || snapshot.plotArea || 0} ${item.plot_area_unit || 'SQFT'}`,
      60,
      addressEndY + 5
    );

    let currentY = addressEndY + 12;

    if (isService) {
      const sr = item.service_record || {};
      const floorDetails = sr.floor_details || {};

      let floorRows: any[][] = [];

      if (floorDetails && typeof floorDetails === 'object' && Object.keys(floorDetails).length > 0) {
        Object.entries(floorDetails).forEach(([floorName, data]: any, idx: number) => {
          if (typeof data === 'object' && data !== null) {
            const area = data.area || data.builtup_area || data.outerArea || 0;
            const width = data.width || data.width_feet || '-';
            const length = data.length || data.length_feet || '-';
            floorRows.push([idx + 1, floorName, width, length, `${area} SQ.FT`]);
          }
        });
      }

      if (floorRows.length === 0 && snapshot && typeof snapshot === 'object') {
        const genFloor = snapshot.generatedFloorPlans || snapshot.floorData || {};
        if (genFloor && typeof genFloor === 'object') {
          Object.entries(genFloor).forEach(([floorName, data]: any, idx: number) => {
            if (typeof data === 'object' && data !== null) {
              floorRows.push([
                idx + 1,
                floorName,
                data.width || '-',
                data.length || '-',
                `${data.area || data.outerArea || 0} SQ.FT`,
              ]);
            }
          });
        }
      }

      if (floorRows.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(20, 48, 114);
        doc.text('FLOOR-WISE AREA BREAKUP', 14, currentY + 6);
        currentY += 8;

        autoTable(doc, {
          startY: currentY,
          head: [['SR', 'FLOOR / AREA', 'WIDTH (FT)', 'LENGTH (FT)', 'AREA']],
          body: floorRows,
          theme: 'grid',
          headStyles: { fillColor: [20, 48, 114], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
          bodyStyles: { fontSize: 9, textColor: [0, 0, 0] },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 60, fontStyle: 'bold' },
            2: { cellWidth: 30, halign: 'center' },
            3: { cellWidth: 30, halign: 'center' },
            4: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
      }

      if (item.total_builtup_area) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`TOTAL BUILT-UP AREA: ${item.total_builtup_area} SQ.FT`, 14, currentY + 5);
        currentY += 10;
      }

      const boundaries = [
        { label: 'EAST BOUNDARY', value: sr.boundary_east || '-' },
        { label: 'WEST BOUNDARY', value: sr.boundary_west || '-' },
        { label: 'NORTH BOUNDARY', value: sr.boundary_north || '-' },
        { label: 'SOUTH BOUNDARY', value: sr.boundary_south || '-' },
      ];

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 48, 114);
      doc.text('BOUNDARY DETAILS', 14, currentY + 6);
      currentY += 8;

      autoTable(doc, {
        startY: currentY,
        head: [['SR', 'BOUNDARY', 'DESCRIPTION']],
        body: boundaries.map((b, i) => [i + 1, b.label, b.value]),
        theme: 'grid',
        headStyles: { fillColor: [20, 48, 114], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 50, fontStyle: 'bold' },
          2: { cellWidth: 120 },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;

      const extraRows: any[][] = [];
      if (sr.state_name) extraRows.push(['STATE', sr.state_name]);
      if (sr.city_district) extraRows.push(['CITY / DISTRICT', sr.city_district]);
      if (sr.plot_shape) extraRows.push(['PLOT SHAPE', sr.plot_shape]);
      if (sr.road_side) extraRows.push(['ROAD SIDE', sr.road_side]);
      if (sr.ground_coverage) extraRows.push(['GROUND COVERAGE', sr.ground_coverage]);
      if (sr.deed_type) extraRows.push(['DEED TYPE', sr.deed_type]);
      if (sr.property_type) extraRows.push(['PROPERTY TYPE', sr.property_type]);
      if (sr.output_language) extraRows.push(['OUTPUT LANGUAGE', sr.output_language]);

      if (extraRows.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(20, 48, 114);
        doc.text('ADDITIONAL DETAILS', 14, currentY + 6);
        currentY += 8;

        autoTable(doc, {
          startY: currentY,
          head: [['SR', 'PARAMETER', 'VALUE']],
          body: extraRows.map((r, i) => [i + 1, r[0], r[1]]),
          theme: 'grid',
          headStyles: { fillColor: [20, 48, 114], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: [0, 0, 0] },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 60, fontStyle: 'bold' },
            2: { cellWidth: 110 },
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(20, 48, 114);
      doc.text('PAYMENT INFORMATION', 14, currentY + 6);
      currentY += 8;

      autoTable(doc, {
        startY: currentY,
        body: [
          ['Payment Status', `${item.payment_status || 'pending'}`],
          ['Platform Payment', `${item.platform_payment_status || 'unpaid'}`],
          ['Amount', item.amount ? `Rs. ${Number(item.amount).toLocaleString('en-IN')}/-` : '-'],
        ],
        theme: 'grid',
        bodyStyles: { fontSize: 9, textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold' },
          1: { cellWidth: 122 },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (!isService) {
      const summaryRows = [
        ['1', 'PLOT AREA', `${item.plot_area || snapshot.plot_area || 0} SQ.FT`],
        ['2', 'TOTAL BUILT UP AREA', `${item.total_builtup_area || 0} SQ.FT`],
        ['3', 'RATE PER SQ.FT', `Rs. ${item.rate_per_sqft || snapshot.rate_per_sqft || 0}/-`],
        ['4', 'TOTAL ESTIMATE VALUE', `Rs. ${item.amount ? Number(item.amount).toLocaleString('en-IN') : 0}/-`],
      ];

      autoTable(doc, {
        startY: currentY + 2,
        head: [['SR', 'DESCRIPTION', 'VALUES']],
        body: summaryRows,
        theme: 'grid',
        headStyles: { fillColor: [20, 48, 114], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 60, fontStyle: 'bold' },
          2: { cellWidth: 110, halign: 'right', fontStyle: 'bold' },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    if (!isService) {
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(239, 68, 68);
      doc.setLineWidth(0.4);
      doc.rect(14, currentY, 182, 30, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(220, 38, 38);
      doc.text("DETAILED MEASUREMENT BREAKUP IS LOCKED", 105, currentY + 8, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text("To view complete structural descriptions, material specifications,", 105, currentY + 15, { align: "center" });
      doc.text("please process standard authorization premium payment.", 105, currentY + 20, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 48, 114);
      doc.text("Click 'Unlock Full PDF Report' to clear pending invoice.", 105, currentY + 26, { align: "center" });

      currentY += 40;
    }

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(14, currentY, 196, currentY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("DISCLAIMER & TERMS:", 14, currentY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    const disclaimerText = "This is a system-generated verification report. It is provided for informational purposes only. The details mentioned are as per the records saved in our database at the time of generation. This document is valid for 60 days from the date of issue. The estimator bears no financial or legal liability for any budget shortfalls, cost overruns, or discrepancies that may arise during actual construction.";
    const splitDisclaimer = doc.splitTextToSize(disclaimerText, 182);
    doc.text(splitDisclaimer, 14, currentY + 10);

    const fileName = `${item.case_type || 'Report'}_${item.ref_no || 'report'}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col scroll-smooth">
      {/* Top Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white py-2 px-3 sm:px-6 flex flex-col sm:flex-row justify-between items-center text-[10px] sm:text-xs font-medium tracking-wide gap-2">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            8103804355
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            legalntech@gmail.com
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden lg:inline">203, MAYUR COMPLEX, 49 SUTAR GALI, JAIL ROAD, INDORE (M.P)</span>
          <span className="bg-blue-600 px-2 py-0.5 rounded text-[9px] uppercase font-bold">Pan India</span>
        </div>
      </div>

      {/* Marquee */}
      <div className="bg-blue-800 text-white py-1.5 overflow-hidden whitespace-nowrap font-bold uppercase text-[10px] tracking-wider border-b border-blue-700">
        <div className="animate-marquee inline-block">
          Welcome to Legal n Tech Consultants • ERP Secure Gateway • Construction Planning • Interior Design • Building Permission • Property Purchase Advice • Pan India Service
        </div>
      </div>

      {/* NAVBAR */}
      <nav className="bg-white shadow-lg sticky top-0 z-50 border-b-2 border-blue-900">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
            <img src="/logo.jpg" alt="Logo" className="h-8 sm:h-11 w-auto object-contain" />
            <div className="min-w-0">
              <h1 className="text-[10px] xs:text-xs sm:text-xl font-black text-blue-900 uppercase tracking-tight leading-tight truncate">
                Legal N Tech
              </h1>
              <p className="text-[6px] sm:text-[9px] text-gray-500 font-semibold uppercase tracking-widest truncate">
                Engineering Consultant
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-4 text-xs font-bold text-gray-700 uppercase tracking-wide">
            <a href="#services" className="hover:text-blue-600 transition-colors">Services</a>
            <a href="#insights" className="hover:text-blue-600 transition-colors">Insights</a>
            <a href="#properties" className="hover:text-blue-600 transition-colors">Properties</a>
            <a href="#careers" className="hover:text-blue-600 transition-colors">Careers</a>
            <button onClick={() => setShowAboutPopup(true)} className="hover:text-blue-600 transition-colors uppercase">About Us</button>
            <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Link
              href="/login"
              className="text-blue-900 text-[10px] sm:text-xs font-bold px-2 sm:px-4 py-1.5 sm:py-2.5 hover:bg-blue-50 rounded-lg transition-all border border-blue-900 sm:border-2 whitespace-nowrap"
            >
              SIGN IN
            </Link>

            <Link
              href="/signup"
              className="bg-gradient-to-r from-blue-900 to-blue-700 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-lg hover:from-blue-800 hover:to-blue-600 shadow-md transition-all whitespace-nowrap"
            >
              SIGN UP
            </Link>

            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-1.5 sm:p-2 text-blue-900 hover:bg-blue-50 rounded-lg transition ml-0.5"
              aria-label="Toggle menu"
            >
              {showMobileMenu ? (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
              )}
            </button>
          </div>
        </div>

        {showMobileMenu && (
          <div className="lg:hidden bg-white border-t border-gray-200 px-4 py-3 space-y-1 shadow-xl animate-fadeIn">
            <a href="#services" onClick={() => setShowMobileMenu(false)} className="block py-2.5 text-sm font-bold text-gray-700 uppercase hover:text-blue-600 hover:bg-blue-50 px-3 rounded-lg transition">Services</a>
            <a href="#insights" onClick={() => setShowMobileMenu(false)} className="block py-2.5 text-sm font-bold text-gray-700 uppercase hover:text-blue-600 hover:bg-blue-50 px-3 rounded-lg transition">Insights</a>
            <a href="#properties" onClick={() => setShowMobileMenu(false)} className="block py-2.5 text-sm font-bold text-gray-700 uppercase hover:text-blue-600 hover:bg-blue-50 px-3 rounded-lg transition">Properties</a>
            <a href="#careers" onClick={() => setShowMobileMenu(false)} className="block py-2.5 text-sm font-bold text-gray-700 uppercase hover:text-blue-600 hover:bg-blue-50 px-3 rounded-lg transition">Careers</a>
            <button
              onClick={() => { setShowAboutPopup(true); setShowMobileMenu(false); }}
              className="block w-full text-left py-2.5 text-sm font-bold text-gray-700 uppercase hover:text-blue-600 hover:bg-blue-50 px-3 rounded-lg transition"
            >
              About Us
            </button>
            <a href="#contact" onClick={() => setShowMobileMenu(false)} className="block py-2.5 text-sm font-bold text-gray-700 uppercase hover:text-blue-600 hover:bg-blue-50 px-3 rounded-lg transition">Contact</a>
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HERO — Corporate Style with YouTube Banner (Dismissible) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 2px)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-10"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* LEFT: Hero Content (2 Columns) */}
            <div className="lg:col-span-2">
              <span className="inline-block bg-yellow-400 text-slate-900 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4">
                11+ Years Experience
              </span>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight mb-4 leading-tight">
                We make <span className="text-blue-400">engineering work</span> easy and smooth.
              </h1>

              <p className="text-base sm:text-lg text-blue-100 mb-6 sm:mb-8 font-light leading-relaxed">
                Pan India service for Construction Planning, Interior Design, Building Permission, and Property Purchase Advice. We create solutions for clients of every size.
              </p>

              <div className="flex flex-wrap gap-3 sm:gap-4">
                <Link href="#verify" className="bg-white text-blue-900 px-5 sm:px-8 py-3 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wide hover:bg-blue-50 transition-all shadow-xl">
                  Verify Records
                </Link>
                <Link href="/signup" className="bg-transparent border-2 border-white text-white px-5 sm:px-8 py-3 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wide hover:bg-white/10 transition-all">
                  Get Started
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-8 pt-6 border-t border-white/20">
                <span className="flex items-center gap-2 text-xs text-blue-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Verified & Trusted
                </span>
                <span className="flex items-center gap-2 text-xs text-blue-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  Secure Gateway
                </span>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* RIGHT: YouTube Carousel Card (Dismissible) */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {showYoutubeBanner && (
              <div className="lg:col-span-1 relative animate-fadeIn">
                <div className="bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
                  
                  {/* Cancel / Close Button */}
                  <button
                    onClick={() => setShowYoutubeBanner(false)}
                    className="absolute top-2 right-2 z-10 bg-black/40 hover:bg-black/70 text-white rounded-full p-1.5 transition-all"
                    aria-label="Dismiss YouTube banner"
                    title="Cancel / Hide this banner"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>

                  {/* NEW Badge */}
                  <div className="absolute top-2 left-2 z-10">
                    <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      ● Live
                    </span>
                  </div>

                  <a
                    href={youtubeVideos[currentVideoIndex].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group mt-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                        <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-red-300 uppercase tracking-wide">▶ Watch on YouTube</p>
                        <p className="text-[10px] text-blue-200">Our Official Channel</p>
                      </div>
                    </div>

                    <div className="bg-black/30 rounded-lg p-3 border border-white/10 group-hover:border-red-400/50 transition-all">
                      <p className="text-sm font-bold text-white mb-1 line-clamp-2">
                        {youtubeVideos[currentVideoIndex].title}
                      </p>
                      <p className="text-[10px] text-blue-200">
                        Tap to watch tutorials, tips & construction guides
                      </p>
                    </div>

                    {/* Slider dots */}
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                      {youtubeVideos.map((_, idx) => (
                        <span
                          key={idx}
                          className={`rounded-full transition-all ${
                            idx === currentVideoIndex ? 'bg-red-500 w-6 h-1.5' : 'bg-white/30 w-1.5 h-1.5'
                          }`}
                        />
                      ))}
                    </div>
                  </a>

                  {/* Bottom CTA */}
                  <div className="mt-3 pt-3 border-t border-white/10 text-center">
                    <p className="text-[9px] text-blue-200">
                      
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white border-b border-gray-200 py-8 sm:py-12" id="insights">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 text-center">
            <div>
              <p className="text-2xl sm:text-4xl font-black text-blue-900">500+</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-bold tracking-wider mt-1">Projects Completed</p>
            </div>
            <div>
              <p className="text-2xl sm:text-4xl font-black text-blue-900">50+</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-bold tracking-wider mt-1">Expert Engineers</p>
            </div>
            <div>
              <p className="text-2xl sm:text-4xl font-black text-blue-900">Pan India</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-bold tracking-wider mt-1">Service Coverage</p>
            </div>
            <div>
              <p className="text-2xl sm:text-4xl font-black text-blue-900">100%</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-bold tracking-wider mt-1">Client Satisfaction</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Cards Section */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 -mt-6 sm:-mt-8 relative z-20 mb-6 sm:mb-10" id="services">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white p-5 sm:p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-2xl hover:border-blue-200 transition-all duration-300">
            <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
            </div>
            <h3 className="text-blue-900 font-bold text-base uppercase mb-2 tracking-wide">Company Profile</h3>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
              Legal N Tech Consultant is a premier engineering firm providing end-to-end Construction Planning, Interior Design, Building Permission, and Property Purchase Advice.
            </p>
            <p className="text-blue-700 text-[10px] font-bold uppercase tracking-wide mt-3">11+ Years of Industry Experience</p>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-2xl hover:border-blue-200 transition-all duration-300">
            <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
            </div>
            <h3 className="text-blue-900 font-bold text-base uppercase mb-3 tracking-wide">Vision & Goal</h3>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-2">
              <span className="font-bold text-gray-800">Vision:</span> To become India's fastest and smoothest construction & real estate consultancy.
            </p>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
              <span className="font-bold text-gray-800">Goal:</span> To stand beside every customer at every step.
            </p>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-2xl hover:border-blue-200 transition-all duration-300">
            <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h3 className="text-blue-900 font-bold text-base uppercase mb-3 tracking-wide">Our Services</h3>
            <ul className="text-gray-600 text-xs sm:text-sm leading-relaxed space-y-1.5">
              <li>• Construction Work</li>
              <li>• Estimation Work</li>
              <li>• Construction Planning</li>
              <li>• Interior Design</li>
              <li>• Building Permission</li>
              <li>• Property Purchase Advice</li>
            </ul>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-2xl hover:border-blue-200 transition-all duration-300">
            <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <h3 className="text-blue-900 font-bold text-base uppercase mb-3 tracking-wide">Why Choose Us</h3>
            <ul className="text-gray-600 text-xs sm:text-sm leading-relaxed space-y-1.5">
              <li>• 24x365 Available</li>
              <li>• Instant & Easy Way</li>
              <li>• Very Attractive Price</li>
              <li>• Pan India Service</li>
              <li>• Secure Client Gateway</li>
              <li>• Instant PDF Reports</li>
            </ul>
          </div>
        </div>
      </div>

      {/* VERIFICATION PORTAL */}
      <div id="verify" className="max-w-7xl mx-auto px-2 sm:px-6 py-8 sm:py-12 flex-grow w-full">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-4xl font-black text-blue-900 uppercase tracking-wide mb-2">
            Verification Portal
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-blue-900 mx-auto rounded-full"></div>
          <p className="text-gray-500 text-xs sm:text-sm mt-3 sm:mt-4 px-2">
            Search and verify construction estimates, plans, deed drafts & layouts using Reference Number or Customer Name.
          </p>
        </div>

        {/* How It Works Card — SINGLE ROW (YouTube removed from here) */}
        <div className="mb-6 max-w-md mx-auto sm:mx-0">
          <button
            onClick={() => setShowHowItWorks(true)}
            className="w-full group bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl p-4 hover:shadow-xl hover:border-blue-500 transition-all text-left flex items-center gap-3"
          >
            <div className="w-12 h-12 bg-blue-900 rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">New Here?</p>
              <p className="text-sm font-bold text-blue-900">How It Works</p>
              <p className="text-[10px] text-gray-600 truncate">Learn in 3 easy steps</p>
            </div>
          </button>
        </div>

        {/* COUNT SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-2xl font-black text-blue-900">{counts.total}</p>
            <p className="text-[9px] sm:text-[10px] text-blue-700 uppercase font-bold tracking-wide">Total</p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-2xl font-black text-amber-700">{counts.estimate}</p>
            <p className="text-[9px] sm:text-[10px] text-amber-700 uppercase font-bold tracking-wide">Estimates</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-2xl font-black text-blue-700">{counts.constructionPlan}</p>
            <p className="text-[9px] sm:text-[10px] text-blue-700 uppercase font-bold tracking-wide">Construction</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-2xl font-black text-purple-700">{counts.deedDraft}</p>
            <p className="text-[9px] sm:text-[10px] text-purple-700 uppercase font-bold tracking-wide">Deed Draft</p>
          </div>
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 border-2 border-pink-200 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-2xl font-black text-pink-700">{counts.subDivisionLayout}</p>
            <p className="text-[9px] sm:text-[10px] text-pink-700 uppercase font-bold tracking-wide">Sub Division</p>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 border-2 border-teal-200 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-2xl font-black text-teal-700">{counts.locationPlan + counts.keyPlan}</p>
            <p className="text-[9px] sm:text-[10px] text-teal-700 uppercase font-bold tracking-wide">Location/Key</p>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-2xl font-black text-gray-700">{counts.other}</p>
            <p className="text-[9px] sm:text-[10px] text-gray-700 uppercase font-bold tracking-wide">Other</p>
          </div>
        </div>

        {/* TABLE */}
        <div className="border-2 border-blue-900 rounded-xl shadow-2xl bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <div className="max-h-[500px] sm:max-h-[600px] overflow-y-auto">
              <table className="w-full border-collapse min-w-[900px] sm:min-w-[1000px]">
                <thead className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white uppercase text-[10px] sm:text-xs sticky top-0 z-10 shadow-lg">
                  <tr>
                    <th className="border border-blue-700 p-2 sm:p-3 w-[160px]">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold">Ref No.</span>
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={filterRefNo}
                          onChange={(e) => setFilterRefNo(e.target.value)}
                          className="p-1.5 text-black text-[10px] sm:text-xs font-normal rounded border border-blue-300 w-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        />
                      </div>
                    </th>
                    <th className="border border-blue-700 p-2 sm:p-3 w-[85px] font-bold">Date</th>
                    <th className="border border-blue-700 p-2 sm:p-3 w-[160px]">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold">Customer</span>
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={filterCustomer}
                          onChange={(e) => setFilterCustomer(e.target.value)}
                          className="p-1.5 text-black text-[10px] sm:text-xs font-normal rounded border border-blue-300 w-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        />
                      </div>
                    </th>
                    <th className="border border-blue-700 p-2 sm:p-3 w-[150px]">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold">Case Type</span>
                        <select
                          value={filterCaseType}
                          onChange={(e) => setFilterCaseType(e.target.value)}
                          className="p-1.5 text-black text-[10px] sm:text-xs font-normal rounded border border-blue-300 w-full focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        >
                          <option value="ALL">All</option>
                          <option value="ESTIMATE">Estimate</option>
                          <option value="CONSTRUCTION_PLAN">Construction Plan</option>
                          <option value="DEED_DRAFT">Deed Draft</option>
                          <option value="SUB_DIVISION_LAYOUT">Sub Division Layout</option>
                          <option value="LOCATION_PLAN">Location Plan</option>
                          <option value="KEY_PLAN">Key Plan</option>
                          <option value="MAP">Map</option>
                        </select>
                      </div>
                    </th>
                    <th className="border border-blue-700 p-2 sm:p-3 w-[200px] font-bold">Property Address</th>
                    <th className="border border-blue-700 p-2 sm:p-3 w-[75px] font-bold">Plot Area</th>
                    <th className="border border-blue-700 p-2 sm:p-3 w-[75px] font-bold">Built-up</th>
                    <th className="border border-blue-700 p-2 sm:p-3 w-[85px] font-bold">Rate</th>
                    <th className="border border-blue-700 p-2 sm:p-3 w-[100px] font-bold">Amount</th>
                    <th className="border border-blue-700 p-2 sm:p-3 w-[75px] font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="border p-6 sm:p-8 text-gray-500 text-center font-medium text-sm">
                        🔍 Searching records...
                      </td>
                    </tr>
                  ) : results.length > 0 ? (
                    results.map((item: any) => {
                      const snapshot = item.estimate_snapshot || item.service_record?.form_snapshot || {};

                      return (
                        <tr key={item._key} className="text-center border-b hover:bg-blue-50/60 text-[11px] sm:text-sm transition-colors">
                          <td className="border p-2 sm:p-3 font-bold text-blue-700 break-words text-[10px] sm:text-xs">
                            {item.ref_no || 'N/A'}
                          </td>
                          <td className="border p-2 sm:p-3 text-gray-700 text-[10px] sm:text-xs">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : '-'}
                          </td>
                          <td className="border p-2 sm:p-3 text-gray-900 font-semibold break-words text-[10px] sm:text-xs">
                            {item.customer_name || 'N/A'}
                          </td>
                          <td className="border p-2 sm:p-3 text-[10px] sm:text-xs">
                            <span className={`inline-block px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-bold rounded whitespace-nowrap ${getCaseTypeBadgeClass(item.case_type)}`}>
                              {item.case_type}
                            </span>
                          </td>
                          <td className="border p-2 sm:p-3 text-gray-700 break-words text-left text-[10px] sm:text-xs">
                            {item.property_address || 'N/A'}
                          </td>
                          <td className="border p-2 sm:p-3 text-gray-700 text-[10px] sm:text-xs">
                            {item.plot_area || snapshot.plot_area || '-'}
                          </td>
                          <td className="border p-2 sm:p-3 text-gray-700 text-[10px] sm:text-xs">
                            {item.total_builtup_area || '0'}
                          </td>
                          <td className="border p-2 sm:p-3 text-gray-700 text-[10px] sm:text-xs">
                            {item.rate_per_sqft || snapshot.rate_per_sqft || '-'}
                          </td>
                          <td className="border p-2 sm:p-3 font-bold text-blue-900 text-[10px] sm:text-xs">
                            {item.amount && Number(item.amount) > 0
                              ? `₹${Number(item.amount).toLocaleString('en-IN')}`
                              : '-'}
                          </td>
                          <td className="border p-2 sm:p-3">
                            <button
                              onClick={() => downloadPDF(item)}
                              className="bg-gradient-to-r from-green-600 to-green-700 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold hover:from-green-700 hover:to-green-800 cursor-pointer active:scale-95 transition-all shadow-md whitespace-nowrap"
                            >
                              PDF
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="border p-6 sm:p-8 text-gray-500 text-center font-medium text-sm">
                        No records found. Try different filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="sm:hidden text-center mt-2">
          <p className="text-[10px] text-gray-400 italic">← Swipe left/right to see full table →</p>
        </div>

        {!loading && results.length > 0 && (
          <div className="text-center mt-3 sm:mt-4">
            <span className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-100 text-blue-800 rounded-lg text-[11px] sm:text-xs font-bold">
              ✓ {results.length} record{results.length !== 1 ? 's' : ''} found
            </span>
          </div>
        )}
      </div>

      {/* Career Section */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 py-10 sm:py-14 border-y-2 border-blue-100" id="careers">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-blue-900 uppercase tracking-wide">Join Our Team</h2>
            <p className="text-gray-600 text-xs sm:text-sm mt-2">We are always looking for talented engineers, designers, and planners.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-5 sm:p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-xl transition-all">
              <h4 className="font-bold text-blue-900 mb-1 text-sm sm:text-base">Civil Engineer</h4>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3">Full Time | Pan India</p>
              <p className="text-xs sm:text-sm text-gray-600 mb-4">Experience in construction estimation and structural design.</p>
              <Link href="/careers" className="text-blue-600 text-xs font-bold uppercase hover:underline">Apply Now →</Link>
            </div>
            <div className="bg-white p-5 sm:p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-xl transition-all">
              <h4 className="font-bold text-blue-900 mb-1 text-sm sm:text-base">Interior Designer</h4>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3">Full Time | Pan India</p>
              <p className="text-xs sm:text-sm text-gray-600 mb-4">Creative mindset with expertise in modern interior planning.</p>
              <Link href="/careers" className="text-blue-600 text-xs font-bold uppercase hover:underline">Apply Now →</Link>
            </div>
            <div className="bg-white p-5 sm:p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-xl transition-all">
              <h4 className="font-bold text-blue-900 mb-1 text-sm sm:text-base">Building Plan Approver</h4>
              <p className="text-[10px] sm:text-xs text-gray-500 mb-3">Full Time | Pan India</p>
              <p className="text-xs sm:text-sm text-gray-600 mb-4">Knowledge of municipal building permission processes.</p>
              <Link href="/careers" className="text-blue-600 text-xs font-bold uppercase hover:underline">Apply Now →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS MODAL */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden relative animate-fadeIn my-6 sm:my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowHowItWorks(false)}
              className="absolute top-3 right-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-5 sm:p-6 text-center relative">
              <span className="inline-block bg-yellow-400 text-blue-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                Beginner's Guide
              </span>
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wide">How It Works</h3>
              <p className="text-blue-100 text-xs mt-1">Verify any estimate in 3 easy steps</p>
            </div>

            <div className="p-5 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
              <div className="flex gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-900 to-blue-700 text-white rounded-full flex items-center justify-center font-black text-base sm:text-lg shrink-0 shadow-md">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 text-sm sm:text-base mb-1">Enter Your Reference Number</h4>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    Every estimate, plan, or deed draft has a unique <strong>REF NO</strong> (e.g., <code className="bg-blue-50 text-blue-800 px-1 rounded text-[10px]">LnT/26-27/NAAM/U001/C0001</code>).
                    Enter it in the <strong>Ref No. filter</strong> box above, or scan the QR code from your printed document.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-900 to-blue-700 text-white rounded-full flex items-center justify-center font-black text-base sm:text-lg shrink-0 shadow-md">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 text-sm sm:text-base mb-1">View Verified Records</h4>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    All your records — <strong>Estimates, Construction Plans, Deed Drafts, Sub Division Layouts, Location Plans</strong> — appear in one unified table.
                    Use the <strong>Case Type filter</strong> to narrow down.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-900 to-blue-700 text-white rounded-full flex items-center justify-center font-black text-base sm:text-lg shrink-0 shadow-md">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 text-sm sm:text-base mb-1">Download PDF Report</h4>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    Click the green <strong>PDF</strong> button next to any record. A complete verification report with customer details, floor-wise area breakup, boundaries, and payment info downloads instantly.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl p-4 sm:p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-9 h-9 bg-red-600 rounded-full flex items-center justify-center text-white">
                    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                  <p className="text-sm font-bold text-red-700">Still have questions?</p>
                </div>
                <p className="text-xs text-gray-700 mb-3">
                  Watch our complete video tutorial on YouTube for step-by-step walkthrough
                </p>
                <a
                  href={YOUTUBE_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-red-600 text-white px-5 sm:px-6 py-2.5 rounded-lg font-bold text-xs sm:text-sm hover:bg-red-700 transition-all shadow-md"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  Visit Our YouTube Channel
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offer Popup Modal */}
      {showOfferPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden relative animate-fadeIn max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowOfferPopup(false)}
              className="absolute top-3 right-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-5 sm:p-6 text-center relative">
              <span className="inline-block bg-yellow-400 text-blue-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                Limited Time Offer
              </span>
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wide">Special Estimate Offer</h3>
              <p className="text-blue-100 text-xs mt-1">Get your complete estimate report at an unbeatable price!</p>
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                  <div className="text-center flex-1">
                    <p className="text-gray-500 text-xs uppercase font-bold">Estimate</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-700 line-through">₹120</p>
                  </div>
                  <div className="text-center flex-1 border-l border-gray-200">
                    <p className="text-gray-500 text-xs uppercase font-bold">Drafting</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-700 line-through">₹100</p>
                  </div>
                </div>
                <div className="text-center bg-yellow-50 rounded-lg py-2 border border-yellow-200">
                  <p className="text-yellow-700 text-xs uppercase font-bold">Offer Price</p>
                  <p className="text-2xl sm:text-3xl font-black text-green-600">₹21/-</p>
                  <p className="text-[10px] text-gray-500 mt-1">Both Estimate & Drafting included</p>
                </div>
              </div>

              <div className="space-y-3 mb-5 sm:mb-6">
                <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-700">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <span>Complete Estimate & Drafting Report</span>
                </div>
                <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-700">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <span>Map & Location Plan</span>
                </div>
                <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-700">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 shrink-0">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden relative animate-fadeIn my-6 sm:my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAboutPopup(false)}
              className="absolute top-3 right-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-2 transition z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-5 sm:p-6 text-center relative">
              <span className="inline-block bg-yellow-400 text-blue-900 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                11+ Years Experience
              </span>
              <h3 className="text-lg sm:text-2xl md:text-3xl font-black uppercase tracking-wide">About Legal N Tech Consultant</h3>
              <p className="text-blue-100 text-xs mt-2">Your Trusted Engineering & Real Estate Partner</p>
            </div>

            <div className="p-4 sm:p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-blue-50 p-4 sm:p-5 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center text-white shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                    </div>
                    <h4 className="text-blue-900 font-bold text-base sm:text-lg uppercase">Company Profile</h4>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                    Legal N Tech Consultant is a premier engineering firm providing end-to-end Construction Planning, Interior Design, Building Permission, and Property Purchase Advice.
                  </p>
                </div>

                <div className="bg-blue-50 p-4 sm:p-5 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center text-white shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    </div>
                    <h4 className="text-blue-900 font-bold text-base sm:text-lg uppercase">Vision & Goal</h4>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-2">
                    <span className="font-bold text-gray-800">Vision:</span> To become India's fastest and smoothest construction & real estate consultancy.
                  </p>
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                    <span className="font-bold text-gray-800">Goal:</span> To stand beside every customer at every step.
                  </p>
                </div>
              </div>

              <div className="mt-4 sm:mt-6 bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-200">
                <h4 className="text-blue-900 font-bold text-xs sm:text-sm uppercase tracking-wide mb-3">What We Are Building for You:</h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 text-gray-600 text-xs sm:text-sm">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 shrink-0"></span>
                    <span><span className="font-semibold text-gray-800">Online Document Management System</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 shrink-0"></span>
                    <span><span className="font-semibold text-gray-800">Online House Planning Service</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 shrink-0"></span>
                    <span><span className="font-semibold text-gray-800">Construction Planning & Consultancy</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 shrink-0"></span>
                    <span><span className="font-semibold text-gray-800">Civil & Real Estate Guidance</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 shrink-0"></span>
                    <span><span className="font-semibold text-gray-800">End-to-End Home Building Support</span></span>
                  </li>
                </ul>
              </div>

              <div className="mt-5 sm:mt-6 text-center">
                <button
                  onClick={() => setShowAboutPopup(false)}
                  className="bg-blue-900 text-white font-bold py-2.5 sm:py-3 px-6 sm:px-8 rounded-lg hover:bg-blue-800 transition shadow-lg text-xs sm:text-sm uppercase tracking-wide"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white pt-10 sm:pt-14 pb-6 mt-8 sm:mt-10 border-t-4 border-blue-600" id="contact">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
          <div>
            <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider mb-3 sm:mb-4 text-blue-300">Legal N Tech Consultant</h3>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-4">
              Engineering Consultant providing Pan India services for Construction Planning, Interior Design, Building Permission, and Property Purchase Advice.
            </p>
            <div className="flex items-start gap-2 text-xs sm:text-sm text-gray-300">
              <svg className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span>203, MAYUR COMPLEX, 49 SUTAR GALI, JAIL ROAD, INDORE (M.P)</span>
            </div>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider mb-3 sm:mb-4 text-blue-300">Contact Us</h3>
            <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-300">
              <li className="flex items-start gap-2 sm:gap-3">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                <div>
                  <p className="font-semibold text-white">Helpline:</p>
                  <p>8103804355 / 79875-61396</p>
                </div>
              </li>
              <li className="flex items-start gap-2 sm:gap-3">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                <div>
                  <p className="font-semibold text-white">Email:</p>
                  <p>legalntech@gmail.com</p>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider mb-3 sm:mb-4 text-blue-300">Disclaimer</h3>
            <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed">
              This estimation is provided purely as a tentative budgetary guide. It is not a binding commercial contract or a fixed-price quotation. Final expenses may vary due to market fluctuations, site conditions, and design changes. The estimator bears no financial or legal liability for any budget shortfalls. Valid for 60 days from date of issue.
            </p>
          </div>
        </div>

        <div className="border-t border-blue-800 pt-6 text-center px-3">
          <p className="text-[10px] sm:text-xs text-blue-300">
            © {new Date().getFullYear()} Legal N Tech Consultant. All Rights Reserved. | Engineering Consultant
          </p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { animation: marquee 20s linear infinite; }
        @keyframes fadeIn { from { opacity: 0; opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}