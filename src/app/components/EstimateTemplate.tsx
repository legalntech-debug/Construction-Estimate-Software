'use React';

import React, { useRef, useMemo } from 'react';
import { useEffect, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/lib/supabase';

const EstimateTemplate = ({ data }: { data: any }) => {
  if (!data) return <div>Loading...</div>;

  const componentRef = useRef<HTMLDivElement>(null);

  // 1. SMART DYNAMIC FILE NAMING LOGIC
  const computePrintTitle = useMemo(() => {
    if (!data?.ref_no) return 'CONSTRUCTION_ESTIMATE_REPORT';

    // A. Parse System Reference Codes (Uxxxx and Cxxxx)
    let uBlock = 'U000';
    let cBlock = 'C000';
    const uMatch = data.ref_no.match(/U(\d+)/i);
    const cMatch = data.ref_no.match(/C(\d+)/i);
    if (uMatch) uBlock = `U${uMatch[1]}`;
    if (cMatch) cBlock = `C${cMatch[1]}`;

    // B. Clean Customer Name (Filter out S/O, D/O, W/O and keeping text before it)
    let cleanName = data.customer_name || 'CUSTOMER';
    const splitters = [/\bS\/O\b/i, /\bD\/O\b/i, /\bW\/O\b/i, /\bSO\b/i, /\bDO\b/i, /\bWO\b/i, /-/];
    for (const pattern of splitters) {
      if (cleanName.toUpperCase().search(pattern) !== -1) {
        cleanName = cleanName.split(pattern)[0].trim();
      }
    }
    cleanName = cleanName.replace(/[^A-Z0-9\s]/gi, '').trim().replace(/\s+/g, '_');

    // C. Sequential Address Extractor Loop (Plot No, Colony, Survey, Vill)
    let cleanAddressStr = 'PROPERTY_LOCATION';
    if (data.property_address) {
      const tokens = data.property_address.split(/[\s,.\-/]+/);
      const matchedTokens: string[] = [];
      const trackingTerms = [
        'PLOT', 'COLONY', 'SURVEY', 'VILL', 'VILLAGE', 
        'TEHSIL', 'DIST', 'DISTT', 'DISTRICT'
      ];
      
      let tokenCounter = 0;
      for (let i = 0; i < tokens.length; i++) {
        if (tokenCounter >= 6) break; // Limit length to avoid extremely long names
        const currentToken = tokens[i].toUpperCase();
        
        const isMatch = trackingTerms.some(term => currentToken.includes(term)) || 
                        (i > 0 && trackingTerms.some(term => tokens[i-1].toUpperCase().includes(term))) ||
                        (/^\d+$/.test(currentToken) && tokens[i-1] && trackingTerms.some(term => tokens[i-1].toUpperCase().includes('PLOT')));
        
        if (isMatch) {
          matchedTokens.push(tokens[i]);
          tokenCounter++;
        }
      }

      if (matchedTokens.length > 0) {
        cleanAddressStr = matchedTokens.join('_').replace(/[^A-Z0-9_]/gi, '');
      } else {
        cleanAddressStr = tokens.slice(0, 4).join('_').replace(/[^A-Z0-9_]/gi, '');
      }
    }

    return `${uBlock}_${cBlock}_${cleanName}_${cleanAddressStr}`.toUpperCase();
  }, [data]);

  // 2. PRINT COMMAND HANDLER
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: computePrintTitle,
  });

  // 3. MASTER CATALOG STATE SETUP
  const floorSequence = [
    'Basement Floor Built-up Area', 'Ground Floor Built-up Area', 'First Floor Built-up Area',
    'Second Floor Built-up Area', 'Third Floor Built-up Area', 'Fourth Floor Built-up Area',
    'Fifth Floor Built-up Area', 'Tower Floor Built-up Area',
  ];
  const cleanFloorName = (name: string) => name.replace(' Built-up Area', '');
  const [masterData, setMasterData] = useState<any>(null);

  useEffect(() => {
    const fetchMasterData = async () => {
      if (!data.rate_per_sqft) return;
      const { data: record, error } = await supabase
        .from('master_items')
        .select('*')
        .eq('rate_sqft', Number(data.rate_per_sqft))
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.error("Supabase Database Error:", error);
      else if (record) setMasterData(record);
    };
    fetchMasterData();
  }, [data.rate_per_sqft]);

  const itemMapping = [
    { label: "Preliminary Works", rateKey: 'preliminary_rate', descKey: 'preliminary_desc' },
    { label: "Earthwork", rateKey: 'earthwork_rate', descKey: 'earthwork_desc' },
    { label: "Foundation PCC Work", rateKey: 'pcc_foundation_rate', descKey: 'pcc_foundation_desc' },
    { label: "Anti Termite Work", rateKey: 'anti_termite_rate', descKey: 'anti_termite_desc' },
    { label: "RCC Foundation Work", rateKey: 'rcc_foundation_rate', descKey: 'rcc_foundation_desc' },
    { label: "RCC Column Work", rateKey: 'rcc_column_rate', descKey: 'rcc_column_desc' },
    { label: "Plinth Beam RCC Work", rateKey: 'plinth_beam_rate', descKey: 'plinth_beam_desc' },
    { label: "RCC Lintel Work", rateKey: 'rcc_lintel_rate', descKey: 'rcc_lintel_desc' },
    { label: "RCC Chajja Work", rateKey: 'rcc_chajja_rate', descKey: 'rcc_chajja_desc' },
    { label: "Roof Beam RCC Work", rateKey: 'roof_beam_rate', descKey: 'roof_beam_desc' },
    { label: "RCC Slab Work", rateKey: 'rcc_slab_rate', descKey: 'rcc_slab_desc' },
    { label: "RCC Staircase Work", rateKey: 'rcc_staircase_rate', descKey: 'rcc_staircase_desc' },
    { label: "Reinforcement Steel", rateKey: 'reinforcement_steel_rate', descKey: 'reinforcement_steel_desc' },
    { label: "Shuttering", rateKey: 'shuttering_rate', descKey: 'shuttering_desc' },
    { label: "Sub & Super Structure Brickwork", rateKey: 'brickwork_rate', descKey: 'brickwork_desc' },
    { label: "Internal Plaster Work", rateKey: 'internal_plaster_rate', descKey: 'internal_plaster_desc' },
    { label: "External Plaster Work", rateKey: 'external_plaster_rate', descKey: 'external_plaster_desc' },
    { label: "Door Frame & Shutter", rateKey: 'door_frame_rate', descKey: 'door_frame_desc' },
    { label: "Paint & Putty", rateKey: 'paint_putty_rate', descKey: 'paint_putty_desc' },
    { label: "MS & Steel Work", rateKey: 'ms_steel_rate', descKey: 'ms_steel_desc' },
    { label: "Plumbing Work", rateKey: 'plumbing_rate', descKey: 'plumbing_desc' },
    { label: "Electrical Work", rateKey: 'electrical_rate', descKey: 'electrical_desc' },
    { label: "Flooring Work", rateKey: 'flooring_rate', descKey: 'flooring_desc' },
    { label: "False Ceiling Work", rateKey: 'false_ceiling_rate', descKey: 'false_ceiling_desc' },
    { label: "Modular Kitchen Work", rateKey: 'modular_kitchen_rate', descKey: 'modular_kitchen_desc' },
    { label: "Water Tank Work", rateKey: 'water_tank_rate', descKey: 'water_tank_desc' },
    { label: "Full Home Furnishing", rateKey: 'full_home_furnishing_rate', descKey: 'full_home_furnishing_desc' },
    { label: "Parapet Wall Brickwork", rateKey: 'parapet_wall_rate', descKey: 'parapet_wall_desc' },
    { label: "Modern Front Elevation", rateKey: 'modern_elevation_rate', descKey: 'modern_elevation_desc' },
    { label: "Terrace Coba Work", rateKey: 'terrace_coba_rate', descKey: 'terrace_coba_desc' },
    { label: "Deep Boring Work", rateKey: 'deep_boring_rate', descKey: 'deep_boring_desc' },
    { label: "Final Finishing Work", rateKey: 'final_finishing_rate', descKey: 'final_finishing_desc' },
    { label: "Lift Installation", rateKey: 'lift_installation_rate', descKey: 'lift_installation_desc' },
    { label: "Consultant Fee", rateKey: 'consultant_fee_rate', descKey: 'consultant_fee_desc' }
  ];

  return (
    <div className="p-4 font-['Calibri']">
      
      {/* 1. Print Controller Panel Action Trigger */}
      <div className="print:hidden text-center mb-6">
        <button 
          onClick={handlePrint} 
          className="bg-blue-950 hover:bg-slate-900 text-white font-bold uppercase tracking-wider px-8 py-3 rounded shadow-md transition-colors"
        >
          Print & Save Report
        </button>
        <p className="text-xs text-slate-400 mt-2 font-mono">
          Save Format Target: {computePrintTitle}.pdf
        </p>
      </div>

      {/* 2. Isolated Sheet Print Engine Canvas Staging Section */}
      <div id="print-section" ref={componentRef} className="bg-white p-2">
        
        {/* Strict Media CSS Engine to Overcome Blank Page Stream Issues */}
        <style jsx global>{`
          @media print {
            body, html {
              background: #fff !important;
              color: #000 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .print\\:hidden, aside, nav, button {
              display: none !important;
            }
            #print-section {
              display: block !important;
              position: absolute !important;
              top: 0mm !important;
              left: 0mm !important;
              width: 100% !important;
              height: auto !important;
              padding: 15mm 12mm !important;
              overflow: visible !important;
            }
            table {
              page-break-inside: auto !important;
            }
            tr {
              page-break-inside: avoid !important;
              page-break-after: auto !important;
            }
          }
        `}</style>

        {/* Dynamic Image Header Area */}
        <div className="mb-6 border-b-2 border-black pb-2">
          <img src="/letterhead.jpg" alt="Letterhead Stationery" className="w-full h-auto object-contain" />
        </div>
        
        <div className="flex justify-between mb-4 border-b-2 border-black pb-1 text-[10pt] font-bold uppercase">
          <p><strong>Ref No:</strong> {data?.ref_no || 'LNT/PENDING'}</p>
          <p><strong>Date:</strong> {data?.estimate_date || ''}</p>
        </div>

        <h1 className="text-xl font-black uppercase text-center my-5 tracking-wide border-y border-dashed border-black py-1.5">
          PROPOSED CONSTRUCTION ESTIMATE
        </h1>

        {/* Master Meta Demographics Profile Layout */}
        <div className="space-y-2 mb-6 border-b pb-4 text-[10pt] font-bold uppercase tracking-wide">
           <div className="flex"><span className="w-[160px] shrink-0 font-extrabold">Client Name:</span><span className="break-all">{data?.customer_name || '—'}</span></div>
           <div className="flex"><span className="w-[160px] shrink-0 font-extrabold">Property Address:</span><span className="break-all">{data?.property_address || '—'}</span></div>
        </div>

        {/* Dynamic Structural Calculation Matrix Ledger Grid */}
        <table className="w-full border-collapse border border-black text-[10pt] font-bold uppercase">
          <thead>
            <tr className="bg-slate-100 text-black border-b border-black font-black">
              <th className="border border-black p-2.5 text-left w-[55%]">Description</th>
              <th className="border border-black p-2.5 text-center w-[8%]">Nos</th>
              <th className="border border-black p-2.5 text-center w-[10%]">Qty</th>
              <th className="border border-black p-2.5 text-center w-[10%]">Unit</th>
              <th className="border border-black p-2.5 text-right pr-2 w-[17%]">Rate/Unit</th>
              <th className="border border-black p-2.5 text-right pr-2 w-[20%]">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/50">
            {masterData && itemMapping.map((item, index) =>
              masterData[item.rateKey] ? (
                <tr key={index} className="border-b border-black">
                  <td className="border border-black p-2 text-left leading-tight">
                    <span className="font-black text-slate-900 block">{item.label}</span>
                    <small className="text-[9pt] font-medium text-slate-700 normal-case block mt-0.5">{masterData[item.descKey]}</small>
                  </td>
                  <td className="border border-black p-2 text-center align-middle">1</td>
                  <td className="border border-black p-2 text-center align-middle">{data?.total_builtup_area || '1'}</td>
                  <td className="border border-black p-2 text-center align-middle">sq.ft</td>
                  <td className="border border-black p-2 text-right pr-2 align-middle">₹{Number(masterData[item.rateKey]).toLocaleString('en-IN')}</td>
                  <td className="border border-black p-2 text-right pr-2 align-middle">₹{Number(Number(masterData[item.rateKey]) * Number(data?.total_builtup_area || 1)).toLocaleString('en-IN')}/-</td>
                </tr>
              ) : null
            )}
            
            {/* Consolidated Dynamic Financial Row */}
            <tr className="bg-slate-50 border-t-2 border-black font-black text-[11pt]">
              <td colSpan={2} className="border border-black p-3 text-left uppercase tracking-wider">
                Total Estimated Construction Value
              </td>
              <td colSpan={4} className="border border-black p-3 text-right pr-2 font-black text-[12pt]">
                ₹{Number(data?.total_value || 0).toLocaleString('en-IN')}/-
              </td>
            </tr>
          </tbody>
        </table>

        {/* Structural Authorized Verification Bottom Footer Component Block */}
        <div className="mt-8 border border-black p-3 flex justify-between items-center text-[9.5pt] font-bold uppercase tracking-wide">
          <div className="max-w-[60%] font-medium normal-case text-justify text-slate-600 leading-tight">
            <span className="font-black text-[10pt] uppercase text-black block mb-1">Important System Notes:</span>
            This document is a structural technical budget calculation compiled based on standard matrix evaluation logs. Unforeseen geological or site-specific adjustments might alter actual cost vectors.
          </div>
          <div className="text-center min-w-[220px] flex flex-col justify-between h-[80px]">
            <span className="text-[8.5pt] text-slate-400 font-extrabold tracking-widest">FOR LEGAL N TECH CONSULTANT</span>
            <div className="border-t border-dashed border-black pt-1 font-black text-[10pt]">
              AUTHORIZED SIGNATORY
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EstimateTemplate;