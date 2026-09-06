"use client";

import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { RouteMapForm } from './components/RouteMapForm';
import { TopSectionCards } from './components/TopSectionCards';
import { CadStudioCanvas } from './components/CadStudioCanvas';

export default function RouteMapPage() {
  const [commandInput, setCommandInput] = useState('');
  const [customerName, setCustomerName] = useState('MR. PANKAJ KUMAR DUBEY, S/O MR. MUNNA DUBEY');
  const [plotArea, setPlotArea] = useState('3600 SQ. FT');
  const [propertyAddress, setPropertyAddress] = useState('PLOT PART OF LAND/SURVEY NO. ARAJI NO. 2/1/30/1/1, VILL. BADKHAR, MP');
  
  const [boundaryNorth, setBoundaryNorth] = useState('REMAINING LAND OF SELLER');
  const [boundarySouth, setBoundarySouth] = useState('ROAD');
  const [boundaryEast, setBoundaryEast] = useState('LAND OF YADAV');
  const [boundaryWest, setBoundaryWest] = useState('ROAD');

  const [lat, setLat] = useState('24.602920311999025');
  const [lng, setLng] = useState('80.86182175571227');
  const [zoomMap1, setZoomMap1] = useState(18);
  const [mapType1, setMapType1] = useState<'k' | 'm'>('k');
  const [propertyPhoto, setPropertyPhoto] = useState<string | null>(null);

  const [showMapOnCad, setShowMapOnCad] = useState(true);
  const [zoomMap2, setZoomMap2] = useState(19);
  const [mapType2, setMapType2] = useState<'k' | 'm'>('k');
  const [tool, setTool] = useState('select');

  const [paths, setPaths] = useState<any[]>([]);
  const [cadImages, setCadImages] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentMouse, setCurrentMouse] = useState<{ x: number; y: number } | null>(null);

  // Form Header States
  const [caseType, setCaseType] = useState('ROUTE MAP');
  const [fee, setFee] = useState('AUTO');
  const [clientName, setClientName] = useState('');
  const [representative, setRepresentative] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim().toUpperCase();
    if (cmd === 'LINE' || cmd === 'L') setTool('line');
    else if (cmd === 'RECT' || cmd === 'REC') setTool('rect');
    setCommandInput('');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPropertyPhoto(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCadImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) setCadImages([...cadImages, { id: Date.now().toString(), url: result, x: 50, y: 50, w: 220, h: 160 }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadPDF = async () => {
    const input = reportRef.current;
    if (!input) return;
    const canvas = await html2canvas(input, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 5, pdfWidth, pdfHeight);
    pdf.save(`Route_Map_${customerName.replace(/\s+/g, '_')}.pdf`);
  };

  // Canvas Handlers placeholders
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {};
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {};
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {};
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {};
  const handleMouseUp = () => {};

  return (
    <div className="min-h-screen bg-slate-950 p-2 font-sans text-xs text-slate-100">
      <RouteMapForm 
        commandInput={commandInput} 
        setCommandInput={setCommandInput} 
        handleCommandSubmit={handleCommandSubmit}
        caseType={caseType}
        setCaseType={setCaseType}
        fee={fee}
        setFee={setFee}
        clientName={clientName}
        setClientName={setClientName}
        representative={representative}
        setRepresentative={setRepresentative}
        customerName={customerName} 
        setCustomerName={setCustomerName} 
        propertyAddress={propertyAddress} 
        setPropertyAddress={setPropertyAddress}
        plotArea={plotArea} 
        setPlotArea={setPlotArea} 
        lat={lat} 
        setLat={setLat} 
        lng={lng} 
        setLng={setLng}
        handleDownloadPDF={handleDownloadPDF}
      />

      <div ref={reportRef} className="max-w-[1350px] mx-auto bg-white text-slate-900 border-2 border-slate-800 p-2.5 shadow-2xl space-y-2">
        <TopSectionCards 
          lat={lat} 
          lng={lng} 
          zoomMap1={zoomMap1} 
          setZoomMap1={setZoomMap1} 
          mapType1={mapType1} 
          setMapType1={setMapType1}
          propertyPhoto={propertyPhoto} 
          handlePhotoUpload={handlePhotoUpload} 
          customerName={customerName} 
          propertyAddress={propertyAddress} 
          plotArea={plotArea}
          boundaryNorth={boundaryNorth} 
          setBoundaryNorth={setBoundaryNorth} 
          boundarySouth={boundarySouth} 
          setBoundarySouth={setBoundarySouth}
          boundaryEast={boundaryEast} 
          setBoundaryEast={setBoundaryEast} 
          boundaryWest={boundaryWest} 
          setBoundaryWest={setBoundaryWest}
        />

        <CadStudioCanvas 
          showMapOnCad={showMapOnCad} 
          setShowMapOnCad={setShowMapOnCad} 
          zoomMap2={zoomMap2} 
          setZoomMap2={setZoomMap2} 
          mapType2={mapType2} 
          setMapType2={setMapType2}
          lat={lat} 
          lng={lng} 
          tool={tool} 
          setTool={setTool} 
          paths={paths} 
          setPaths={setPaths} 
          canvasRef={canvasRef}
          handleCanvasClick={handleCanvasClick} 
          handleCanvasDoubleClick={handleCanvasDoubleClick} 
          handleMouseDown={handleMouseDown} 
          handleMouseMove={handleMouseMove} 
          handleMouseUp={handleMouseUp}
          handleCadImageUpload={handleCadImageUpload}
        />
      </div>
    </div>
  );
}