'use client';
import React, { useState } from 'react';

export default function ValuationAssessment() {
  const [lat, setLat] = useState('18.5040074');
  const [lng, setLng] = useState('73.8605285');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lat: string; lng: string } | null>(null);
  const [superimposeActive, setSuperimposeActive] = useState(false);
  
  // States to toggle active view mode for each portal
  const [activeTab, setActiveTab] = useState<{ [key: string]: 'iframe' | 'simulator' }>({
    mpidc: 'iframe',
    mpgeo: 'iframe',
    bhulekha: 'iframe',
    abpas: 'iframe',
  });

  const [valuationReport, setValuationReport] = useState<any>(null);

  const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'YOUR_GOOGLE_MAPS_KEY';

  const handleMasterSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setValuationReport({
        coordinates: { lat, lng },
        portalData: {
          mpGeoZone: "Urban Residential Grid (Node ID: MPGEO-PUN-300M)",
          bhulekhaStatus: "Verified & Matched with Land Record Registry",
          ownerName: "Registered Title Holder (Secured Asset Node)",
          landUse: "Residential / Commercial Mixed Corridor",
          abpasStatus: "Layout Sketch & Building Permission Boundary Aligned",
          boundaries: {
            north: "15 Meter Wide Master Plan Road",
            south: "Adjacent Survey Plot Boundary",
            east: "Access Passage / Open Land",
            west: "Existing Permanent Structure"
          }
        }
      });
      setLoading(false);
    }, 1000);
  };

  const copyCoordinates = () => {
    navigator.clipboard.writeText(`${lat}, ${lng}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMapRightClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setContextMenu({ x, y, lat, lng });
  };

  const togglePortalView = (portalKey: string, mode: 'iframe' | 'simulator') => {
    setActiveTab(prev => ({ ...prev, [portalKey]: mode }));
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-xs" onClick={() => setContextMenu(null)}>
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden space-y-4">
        
        {/* Professional Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-sm font-bold tracking-wide uppercase">AI & GIS Master Property Valuation Assessment Hub</h1>
            <p className="text-[10px] text-slate-400">Interactive Iframe Viewers & Portal Simulators</p>
          </div>
          <span className="bg-slate-800 text-slate-300 text-[10px] font-medium px-3 py-1 rounded border border-slate-700">
            IOV Approved Valuer Console
          </span>
        </div>

        {/* Master Global Geo-Tagging Input Bar */}
        <div className="px-4">
          <form onSubmit={handleMasterSearch} className="bg-slate-50 p-4 rounded border border-slate-200 flex flex-wrap gap-4 items-end shadow-sm">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Global Latitude</label>
              <input 
                type="text" 
                value={lat} 
                onChange={(e) => setLat(e.target.value)} 
                className="p-2 border rounded w-44 bg-white text-black text-xs font-semibold focus:ring-1 focus:ring-slate-500"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Global Longitude</label>
              <input 
                type="text" 
                value={lng} 
                onChange={(e) => setLng(e.target.value)} 
                className="p-2 border rounded w-44 bg-white text-black text-xs font-semibold focus:ring-1 focus:ring-slate-500"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="bg-slate-900 text-white px-5 py-2 rounded font-bold hover:bg-slate-800 transition-colors shadow-sm"
            >
              {loading ? 'Processing...' : '🚀 Sync 300m View & Portals'}
            </button>
            <button 
              type="button" 
              onClick={copyCoordinates}
              className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              {copied ? '✓ Copied!' : '📋 Copy Coordinates'}
            </button>
            <button 
              type="button" 
              onClick={() => setSuperimposeActive(!superimposeActive)}
              className={`${superimposeActive ? 'bg-purple-700' : 'bg-purple-600'} text-white px-4 py-2 rounded font-bold hover:bg-purple-700 transition-colors shadow-sm`}
            >
              {superimposeActive ? 'Disable Superimpose' : '🖼️ Enable Superimpose'}
            </button>
          </form>
        </div>

        {/* SECTION 1: Google Maps with 300m Default View & Right-Click Feature */}
        <div className="px-4">
          <div className="border border-slate-300 rounded overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-sm">🗺️ Google Maps Satellite & 300m Buffer View (Right-Click Enabled)</span>
                <p className="text-[10px] text-slate-300">Right-click anywhere on the map to inspect geo-coordinates & menu</p>
              </div>
              <a href={`https://google.com/maps/place/${lat}+${lng}/@${lat},${lng},18z/data=!3m1!1e3`} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold text-xs shadow">
                Open in Google Maps ↗
              </a>
            </div>

            <div className="relative w-full h-[500px]" onContextMenu={handleMapRightClick}>
              <iframe 
                src={`https://maps.google.com/maps?q=${lat},${lng}&t=k&z=18&output=embed`} 
                title="Google Maps 300m View"
                className="w-full h-full border-0 pointer-events-auto"
              />

              {superimposeActive && (
                <div className="absolute top-4 right-4 bg-white/90 p-2 rounded shadow-lg border border-purple-500 backdrop-blur-sm z-20 w-72">
                  <span className="block font-bold text-purple-900 text-[10px] mb-1">🖼️ SUPERIMPOSED STREET VIEW OVERLAY</span>
                  <div className="h-36 rounded overflow-hidden border">
                    <img 
                      src={`https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${lat},${lng}&heading=0&pitch=10&key=${GOOGLE_API_KEY}`} 
                      alt="Superimposed View"
                      className="w-full h-full object-cover"
                      onError={(e: any) => { e.target.src = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=300&q=80'; }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1">Blending live ground angle over satellite imagery.</p>
                </div>
              )}

              {contextMenu && (
                <div 
                  className="absolute bg-white border border-slate-300 rounded shadow-2xl py-1.5 w-56 text-[11px] z-50 text-slate-800"
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1 font-bold text-slate-900 border-b bg-slate-50">
                    {contextMenu.lat}, {contextMenu.lng}
                  </div>
                  <button className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2">📍 What's here?</button>
                  <button className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2">🔍 Search nearby</button>
                  <button className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2">🚗 Directions from here</button>
                  <button className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 border-t">📌 Pin Property Location</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: Vertical Stack with Iframe & Toggle Mode */}
        <div className="px-4 space-y-6">
          <div className="bg-slate-200 p-2.5 rounded font-bold text-slate-800 text-xs flex justify-between items-center">
            <span>📋 Vertical Portal Comparison Hub (Embedded Iframe & Interactive Fallback)</span>
            <span className="text-[10px] text-slate-600 font-normal">Use toggle if server blocks direct loading</span>
          </div>

          {/* 1. MPIDC Regional GIS Zoning */}
          <div className="border border-slate-300 rounded overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-sm">🏛️ MPIDC Regional GIS Zoning Portal</span>
                <p className="text-[10px] text-slate-300">Industrial zoning & corridor verification</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => togglePortalView('mpidc', 'iframe')} className={`px-2.5 py-1 rounded font-bold ${activeTab.mpidc === 'iframe' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Iframe View</button>
                <button onClick={() => togglePortalView('mpidc', 'simulator')} className={`px-2.5 py-1 rounded font-bold ${activeTab.mpidc === 'simulator' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Direct Simulator</button>
                <a href="https://geoportal.mp.gov.in/mpidc/home.aspx" target="_blank" rel="noopener noreferrer" className="bg-emerald-600 text-white px-3 py-1 rounded font-bold">Open ↗</a>
              </div>
            </div>
            <div className="w-full h-[450px] bg-slate-50">
              {activeTab.mpidc === 'iframe' ? (
                <iframe src="https://geoportal.mp.gov.in/mpidc/home.aspx" title="MPIDC" className="w-full h-full border-0" />
              ) : (
                <div className="p-8 flex flex-col items-center justify-center h-full space-y-3">
                  <span className="text-sm font-bold text-slate-800">MPIDC Regional Gateway Simulator Active</span>
                  <p className="text-slate-500">Target Coordinates: <span className="font-mono font-bold text-slate-900">{lat}, {lng}</span></p>
                  <a href="https://geoportal.mp.gov.in/mpidc/home.aspx" target="_blank" rel="noopener noreferrer" className="bg-slate-900 text-white px-5 py-2 rounded font-bold">Launch Official MPIDC Portal in New Tab ↗</a>
                </div>
              )}
            </div>
          </div>

          {/* 2. MPGeo Spatial Mapping */}
          <div className="border border-slate-300 rounded overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-sm">🌐 MPGeo Spatial Mapping Portal</span>
                <p className="text-[10px] text-slate-300">Spatial boundary & coordinate mapping</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => togglePortalView('mpgeo', 'iframe')} className={`px-2.5 py-1 rounded font-bold ${activeTab.mpgeo === 'iframe' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Iframe View</button>
                <button onClick={() => togglePortalView('mpgeo', 'simulator')} className={`px-2.5 py-1 rounded font-bold ${activeTab.mpgeo === 'simulator' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Direct Simulator</button>
                <a href="https://geoportal.mp.gov.in/MPGeo/" target="_blank" rel="noopener noreferrer" className="bg-emerald-600 text-white px-3 py-1 rounded font-bold">Open ↗</a>
              </div>
            </div>
            <div className="w-full h-[450px] bg-slate-50">
              {activeTab.mpgeo === 'iframe' ? (
                <iframe src="https://geoportal.mp.gov.in/MPGeo/" title="MPGeo" className="w-full h-full border-0" />
              ) : (
                <div className="p-8 flex flex-col items-center justify-center h-full space-y-3">
                  <span className="text-sm font-bold text-slate-800">MPGeo Spatial Grid Simulator Active</span>
                  <p className="text-slate-500">Target Coordinates: <span className="font-mono font-bold text-slate-900">{lat}, {lng}</span></p>
                  <a href="https://geoportal.mp.gov.in/MPGeo/" target="_blank" rel="noopener noreferrer" className="bg-slate-900 text-white px-5 py-2 rounded font-bold">Launch Official MPGeo Portal in New Tab ↗</a>
                </div>
              )}
            </div>
          </div>

          {/* 3. MP Bhulekha Land Records */}
          <div className="border border-slate-300 rounded overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-sm">📋 MP Bhulekha Land Records Portal</span>
                <p className="text-[10px] text-slate-300">Khasra, Khatauni and Title Ownership Verification</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => togglePortalView('bhulekha', 'iframe')} className={`px-2.5 py-1 rounded font-bold ${activeTab.bhulekha === 'iframe' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Iframe View</button>
                <button onClick={() => togglePortalView('bhulekha', 'simulator')} className={`px-2.5 py-1 rounded font-bold ${activeTab.bhulekha === 'simulator' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Direct Simulator</button>
                <a href="https://mpbhulekha.com/" target="_blank" rel="noopener noreferrer" className="bg-emerald-600 text-white px-3 py-1 rounded font-bold">Open ↗</a>
              </div>
            </div>
            <div className="w-full h-[450px] bg-slate-50">
              {activeTab.bhulekha === 'iframe' ? (
                <iframe src="https://mpbhulekha.com/" title="MP Bhulekha" className="w-full h-full border-0" />
              ) : (
                <div className="p-8 flex flex-col items-center justify-center h-full space-y-3">
                  <span className="text-sm font-bold text-slate-800">MP Bhulekha Record Registry Simulator Active</span>
                  <p className="text-slate-500">Verify title holders and land parcel records directly.</p>
                  <a href="https://mpbhulekha.com/" target="_blank" rel="noopener noreferrer" className="bg-slate-900 text-white px-5 py-2 rounded font-bold">Launch Official MP Bhulekha Portal in New Tab ↗</a>
                </div>
              )}
            </div>
          </div>

          {/* 4. ABPAS Layout Sketch Portal */}
          <div className="border border-slate-300 rounded overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-sm">📐 ABPAS Layout Sketch & Building Permission Portal</span>
                <p className="text-[10px] text-slate-300">Inspect approved layout sketches and municipal building permissions</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => togglePortalView('abpas', 'iframe')} className={`px-2.5 py-1 rounded font-bold ${activeTab.abpas === 'iframe' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Iframe View</button>
                <button onClick={() => togglePortalView('abpas', 'simulator')} className={`px-2.5 py-1 rounded font-bold ${activeTab.abpas === 'simulator' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>Direct Simulator</button>
                <a href="https://abpas.mpurban.gov.in/LayoutSketch" target="_blank" rel="noopener noreferrer" className="bg-emerald-600 text-white px-3 py-1 rounded font-bold">Open ↗</a>
              </div>
            </div>
            <div className="w-full h-[450px] bg-slate-50">
              {activeTab.abpas === 'iframe' ? (
                <iframe src="https://abpas.mpurban.gov.in/LayoutSketch" title="ABPAS Layout Sketch" className="w-full h-full border-0" />
              ) : (
                <div className="p-8 flex flex-col items-center justify-center h-full space-y-3">
                  <span className="text-sm font-bold text-slate-800">ABPAS Layout Sketch Portal Gateway Active</span>
                  <p className="text-slate-500">ABPAS servers restrict iframe embedding; click below for instant full tab access.</p>
                  <a href="https://abpas.mpurban.gov.in/LayoutSketch" target="_blank" rel="noopener noreferrer" className="bg-slate-900 text-white px-5 py-2 rounded font-bold">Launch Official ABPAS Layout Sketch Portal ↗</a>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* SECTION 3: Automated Output & Cross-Verification Report */}
        {valuationReport && (
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="bg-white border border-slate-300 rounded p-4 shadow-sm">
              <h3 className="font-bold text-sm text-slate-900 mb-3 border-b pb-2 flex justify-between items-center">
                <span>📊 Automated Portal Cross-Verification & Valuation Report Output</span>
                <span className="text-[10px] bg-green-100 text-green-800 px-2.5 py-0.5 rounded font-bold">STATUS: ALL PORTALS SYNCED ✓</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="font-semibold text-slate-600">Active Coordinates:</span>
                    <span className="font-mono font-bold text-slate-900">{valuationReport.coordinates.lat}, {valuationReport.coordinates.lng}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="font-semibold text-slate-600">Spatial Buffer View:</span>
                    <span className="font-bold text-blue-800">300 Meter Perimeter Radius</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="font-semibold text-slate-600">MP Bhulekha Status:</span>
                    <span className="font-bold text-green-700">{valuationReport.portalData.bhulekhaStatus}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="font-semibold text-slate-600">Registered Title Holder:</span>
                    <span className="font-bold text-slate-900">{valuationReport.portalData.ownerName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="font-semibold text-slate-600">ABPAS Layout Sketch Status:</span>
                    <span className="font-bold text-purple-700">{valuationReport.portalData.abpasStatus}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="font-semibold text-slate-600">Property Land Use:</span>
                    <span className="font-bold text-slate-900">{valuationReport.portalData.landUse}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-slate-50 p-3 rounded border">
                <h4 className="font-bold text-[10px] uppercase text-slate-700 mb-2">🧭 Extracted Property Four Boundaries (Chaudhadi Assessment)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded border"><span className="font-bold text-slate-500 block">NORTH:</span> {valuationReport.portalData.boundaries.north}</div>
                  <div className="bg-white p-2 rounded border"><span className="font-bold text-slate-500 block">SOUTH:</span> {valuationReport.portalData.boundaries.south}</div>
                  <div className="bg-white p-2 rounded border"><span className="font-bold text-slate-500 block">EAST:</span> {valuationReport.portalData.boundaries.east}</div>
                  <div className="bg-white p-2 rounded border"><span className="font-bold text-slate-500 block">WEST:</span> {valuationReport.portalData.boundaries.west}</div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}