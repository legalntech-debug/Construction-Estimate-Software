"use client";

import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const ValuationCadStudio: React.FC = () => {
  // Top Command & Input Form State
  const [commandInput, setCommandInput] = useState('');
  const [caseType, setCaseType] = useState('RETAIL MORTGAGE & LAP');
  const [feeType, setFeeType] = useState('AUTO');
  const [clientName, setClientName] = useState('UNICO HOUSING FINANCE LIMITED');
  const [representativeName, setRepresentativeName] = useState('JASVANT SINGH CHOUHAN');
  const [customerName, setCustomerName] = useState('MRS. HEMA BAI, W/O MR. RAJENDRA SINGH');
  const [plotArea, setPlotArea] = useState('577.50 SQ. FT');
  const [propertyAddress, setPropertyAddress] = useState('PLOT PART OF LAND SHRIRAM NAGAR, SURVEY NO. 75/1, RATLAM, MP');
  
  // Boundary Details State
  const [boundaryNorth, setBoundaryNorth] = useState('ROAD');
  const [boundarySouth, setBoundarySouth] = useState('ALLEY / HOUSE OF MR. RAKESH BORASI');
  const [boundaryEast, setBoundaryEast] = useState('HOUSE OF MANGAL SINGH CHAUHAN');
  const [boundaryWest, setBoundaryWest] = useState('HOUSE OF SURENDRA SINGH SONGRA');

  // GPS Coordinates & Top Map State
  const [lat, setLat] = useState('23.353896');
  const [lng, setLng] = useState('75.837921');
  const [zoomMap1, setZoomMap1] = useState(18);
  const [mapType1, setMapType1] = useState<'k' | 'm'>('k');
  const [propertyPhoto, setPropertyPhoto] = useState<string | null>(null);

  // Bottom AutoCAD Studio State (Map + Canvas overlay)
  const [showMapOnCad, setShowMapOnCad] = useState(true);
  const [zoomMap2, setZoomMap2] = useState(19);
  const [mapType2, setMapType2] = useState<'k' | 'm'>('k');
  const [orthoMode, setOrthoMode] = useState(false);
  const [tool, setTool] = useState('select');

  // CAD Drawing Elements & Images
  const [paths, setPaths] = useState<any[]>([]);
  const [cadImages, setCadImages] = useState<any[]>([]);

  // Active Mouse / Interaction States
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentMouse, setCurrentMouse] = useState<{ x: number; y: number } | null>(null);
  const [selectedElement, setSelectedElement] = useState<any | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 });
  const [polyPoints, setPolyPoints] = useState<{ x: number; y: number }[]>([]);

  // Command Terminal Log
  const [commandLog, setCommandLog] = useState<string[]>([
    'System initialized successfully in Single-Sheet Mode.',
    'AutoCAD Engine loaded with Ortho support (F8).',
    'Ready for drawing commands.'
  ]);

  // Text / Rotation Property Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [modalTextValue, setModalTextValue] = useState('');
  const [modalRotationValue, setModalRotationValue] = useState(0);

  // Component References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const addLog = (msg: string) => {
    setCommandLog(prev => [msg, ...prev.slice(0, 49)]);
  };

  // Keyboard Event listener for Ortho Mode (F8) and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        setOrthoMode(prev => !prev);
        addLog(`Ortho Mode toggled: ${!orthoMode ? 'ON' : 'OFF'}`);
      } else if (e.key === 'Escape') {
        setIsDrawing(false);
        setPolyPoints([]);
        setIsMoving(false);
        addLog('Active tool operation cancelled by ESC key.');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orthoMode]);

  // Command Line Input Parser
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim().toUpperCase();
    if (!cmd) return;

    if (cmd === 'LINE' || cmd === 'L') {
      setTool('line');
      addLog('Command executed: LINE tool active.');
    } else if (cmd === 'RECT' || cmd === 'REC') {
      setTool('rect');
      addLog('Command executed: RECTANGLE tool active.');
    } else if (cmd === 'PLINE' || cmd === 'POLYLINE') {
      setTool('polyline');
      addLog('Command executed: POLYLINE tool active.');
    } else if (cmd === 'HATCH') {
      setTool('hatch');
      addLog('Command executed: HATCH tool active.');
    } else if (cmd === 'MOVE' || cmd === 'M') {
      setTool('move');
      addLog('Command executed: MOVE tool active.');
    } else if (cmd === 'ROTATE' || cmd === 'RO') {
      setTool('select');
      addLog('Select an element on canvas to rotate via properties modal.');
    } else if (cmd === 'ERASE' || cmd === 'DELETE') {
      setTool('delete');
      addLog('Command executed: ERASE tool active.');
    } else if (cmd === 'MIRROR' || cmd === 'MI') {
      setTool('mirror');
      addLog('Command executed: MIRROR tool active.');
    } else if (cmd === 'OFFSET' || cmd === 'O') {
      setTool('offset');
      addLog('Command executed: OFFSET tool active.');
    } else if (cmd === 'TRIM') {
      setTool('trim');
      addLog('Command executed: TRIM tool active.');
    } else {
      addLog(`Unknown command: ${cmd}`);
    }
    setCommandInput('');
  };

  // Canvas Render Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render Grid Lines if Map Overlay is OFF
    if (!showMapOnCad) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      const gridSize = 30;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Render Inserted Images
    cadImages.forEach((imgObj) => {
      const img = new Image();
      img.src = imgObj.url;
      if (img.complete) {
        ctx.drawImage(img, imgObj.x, imgObj.y, imgObj.w, imgObj.h);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.strokeRect(imgObj.x, imgObj.y, imgObj.w, imgObj.h);
      } else {
        img.onload = () => {
          ctx.drawImage(img, imgObj.x, imgObj.y, imgObj.w, imgObj.h);
        };
      }
    });

    // Render Canvas CAD Elements
    paths.forEach((p) => {
      ctx.save();
      if (p.type === 'rect') {
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(((p.rotation || 0) * Math.PI) / 180);
        ctx.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));

        ctx.strokeStyle = p.color || '#0284c7';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(p.x, p.y, p.w, p.h);

        if (p.hatched) {
          ctx.fillStyle = 'rgba(2, 132, 199, 0.2)';
          ctx.fillRect(p.x, p.y, p.w, p.h);
        }

        if (p.text) {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.text, p.x + p.w / 2, p.y + p.h / 2);
        }
      } else if (p.type === 'line') {
        ctx.strokeStyle = p.color || '#0284c7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      } else if (p.type === 'dim') {
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
        const dist = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
        ctx.fillStyle = '#e11d48';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(dist)} FT`, (p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2 - 5);
      } else if (p.type === 'polyline') {
        ctx.strokeStyle = p.color || '#0284c7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        p.points.forEach((pt: any, idx: number) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        if (p.closed) ctx.closePath();
        ctx.stroke();
        if (p.closed && p.hatched) {
          ctx.fillStyle = 'rgba(2, 132, 199, 0.2)';
          ctx.fill();
        }
        if (p.text && p.points.length > 0) {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.text, p.points[0].x + 25, p.points[0].y + 25);
        }
      } else if (p.type === 'text') {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.restore();
    });

    // Preview Live Mouse Drawing
    if (isDrawing && dragStart && currentMouse) {
      ctx.strokeStyle = '#0284c7';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      if (tool === 'rect') {
        const rx = Math.min(dragStart.x, currentMouse.x);
        const ry = Math.min(dragStart.y, currentMouse.y);
        const rw = Math.abs(currentMouse.x - dragStart.x);
        const rh = Math.abs(currentMouse.y - dragStart.y);
        ctx.strokeRect(rx, ry, rw, rh);
      } else if (tool === 'line' || tool === 'dim') {
        ctx.beginPath();
        ctx.moveTo(dragStart.x, dragStart.y);
        ctx.lineTo(currentMouse.x, currentMouse.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Active Polyline Drawing Points
    if (polyPoints.length > 0) {
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.beginPath();
      polyPoints.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
        ctx.fillStyle = '#059669';
        ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
      });
      if (currentMouse) {
        ctx.lineTo(currentMouse.x, currentMouse.y);
      }
      ctx.stroke();
    }
  }, [paths, cadImages, isDrawing, dragStart, currentMouse, polyPoints, tool, showMapOnCad]);

  // Canvas Click & Tool Handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (tool === 'polyline') {
      if (orthoMode && polyPoints.length > 0) {
        const lastPt = polyPoints[polyPoints.length - 1];
        if (Math.abs(x - lastPt.x) > Math.abs(y - lastPt.y)) y = lastPt.y;
        else x = lastPt.x;
      }
      if (polyPoints.length === 0) {
        setPolyPoints([{ x, y }]);
      } else {
        const startPt = polyPoints[0];
        if (Math.hypot(x - startPt.x, y - startPt.y) < 15) {
          const defaultTxt = prompt('Enter Details for this Closed Polyline Route:', 'ROAD ROUTE / BOUNDARY') || 'ROUTE';
          setPaths([...paths, { type: 'polyline', points: polyPoints, closed: true, color: '#0284c7', hatched: false, text: defaultTxt }]);
          setPolyPoints([]);
          addLog('Closed Polyline created.');
        } else {
          setPolyPoints([...polyPoints, { x, y }]);
        }
      }
    } else if (tool === 'text') {
      const text = prompt('Enter Annotation Text:', 'LOCATION MARKER');
      if (text) setPaths([...paths, { type: 'text', x, y, text, rotation: 0 }]);
    } else if (tool === 'hatch') {
      const idx = paths.findIndex(p => p.type === 'rect' && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
      if (idx !== -1) {
        const updated = [...paths];
        updated[idx].hatched = true;
        setPaths(updated);
        addLog('45° Hatch applied.');
      }
    } else if (tool === 'move') {
      const idx = paths.findIndex(p => {
        if (p.type === 'text') return Math.hypot(p.x - x, p.y - y) < 30;
        if (p.type === 'rect') return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
        return false;
      });
      if (!isMoving && idx !== -1) {
        setSelectedElement(paths[idx]);
        setIsMoving(true);
        setMoveOffset({ x: x - (paths[idx].x || 0), y: y - (paths[idx].y || 0) });
        addLog('MOVE: Element selected. Click destination point.');
      } else if (isMoving && selectedElement) {
        const dx = x - (selectedElement.x || 0) - moveOffset.x;
        const dy = y - (selectedElement.y || 0) - moveOffset.y;
        const updated = paths.map(p => p === selectedElement ? { ...p, x: (p.x || 0) + dx, y: (p.y || 0) + dy } : p);
        setPaths(updated);
        setIsMoving(false);
        setSelectedElement(null);
        addLog('Object moved successfully.');
      }
    } else if (['select', 'delete', 'mirror', 'offset', 'trim'].includes(tool)) {
      const idx = paths.findIndex(p => {
        if (p.type === 'text') return Math.hypot(p.x - x, p.y - y) < 30;
        if (p.type === 'rect') return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
        if (p.type === 'line') return Math.hypot(p.x2 - p.x1, p.y2 - p.y1) < 40;
        return false;
      });
      if (idx !== -1) {
        const target = paths[idx];
        if (tool === 'delete') {
          setPaths(paths.filter((_, i) => i !== idx));
          addLog('Erased element.');
        } else if (tool === 'mirror') {
          setPaths([...paths, { ...target, x: (target.x || 0) + 50 }]);
        } else if (tool === 'offset') {
          setPaths([...paths, { ...target, x: (target.x || 0) + 20, y: (target.y || 0) + 20 }]);
        } else if (tool === 'trim') {
          setPaths(paths.filter((_, i) => i !== idx));
        } else {
          setSelectedElement(target);
          setModalTextValue(target.text || '');
          setModalRotationValue(target.rotation || 0);
          setEditModalOpen(true);
        }
      }
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = paths.findIndex(p => {
      if (p.type === 'text') return Math.hypot(p.x - x, p.y - y) < 30;
      if (p.type === 'rect') return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
      return false;
    });
    if (idx !== -1) {
      const target = paths[idx];
      setSelectedElement(target);
      setModalTextValue(target.text || '');
      setModalRotationValue(target.rotation || 0);
      setEditModalOpen(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (['rect', 'line', 'dim'].includes(tool)) {
      setIsDrawing(true);
      setDragStart({ x, y });
      setCurrentMouse({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    if (orthoMode && dragStart && (tool === 'line' || tool === 'rect' || tool === 'dim')) {
      if (Math.abs(x - dragStart.x) > Math.abs(y - dragStart.y)) y = dragStart.y;
      else x = dragStart.x;
    }
    setCurrentMouse({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !dragStart || !currentMouse) return;
    let cx = currentMouse.x;
    let cy = currentMouse.y;
    if (orthoMode) {
      if (Math.abs(cx - dragStart.x) > Math.abs(cy - dragStart.y)) cy = dragStart.y;
      else cx = dragStart.x;
    }

    if (tool === 'rect') {
      const x = Math.min(dragStart.x, cx);
      const y = Math.min(dragStart.y, cy);
      const w = Math.abs(cx - dragStart.x);
      const h = Math.abs(cy - dragStart.y);
      if (w > 5 && h > 5) {
        const defaultTxt = prompt('Enter Property/Dimension Text:', `${Math.round(w)} x ${Math.round(h)} FT`) || 'PLOT AREA';
        setPaths([...paths, { type: 'rect', x, y, w, h, rotation: 0, hatched: false, text: defaultTxt }]);
        addLog('Rectangle created.');
      }
    } else if (tool === 'line') {
      setPaths([...paths, { type: 'line', x1: dragStart.x, y1: dragStart.y, x2: cx, y2: cy, rotation: 0 }]);
    } else if (tool === 'dim') {
      setPaths([...paths, { type: 'dim', x1: dragStart.x, y1: dragStart.y, x2: cx, y2: cy }]);
    }
    setIsDrawing(false);
    setDragStart(null);
    setCurrentMouse(null);
  };

  // Image Handling
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
        if (result) {
          setCadImages([...cadImages, { id: Date.now().toString(), url: result, x: 50, y: 50, w: 220, h: 160 }]);
          addLog('Image inserted onto CAD canvas.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // PDF Export
  const handleDownloadPDF = async () => {
    const input = reportRef.current;
    if (!input) return;
    const canvas = await html2canvas(input, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 5, pdfWidth, pdfHeight);
    pdf.save(`Route_Map_Location_Plan_${customerName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-2 font-sans text-xs text-slate-100">
      
      {/* ROUTE MAP INPUT FORM & COMMAND CONTROLS */}
      <div className="max-w-[1350px] mx-auto mb-2 bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl print:hidden space-y-2">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h1 className="font-extrabold text-sm text-cyan-400 uppercase tracking-wide">ROUTE MAP INPUT FORM & CAD LOCATION PLAN ENGINE</h1>
          <button onClick={handleDownloadPDF} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-bold text-xs shadow-md">
            📥 Export PDF Route Map
          </button>
        </div>

        {/* TOP COMMAND LINE */}
        <form onSubmit={handleCommandSubmit} className="flex gap-2 items-center bg-slate-950 p-2 rounded border border-slate-700">
          <span className="font-mono text-cyan-400 font-bold text-xs">Command:</span>
          <input 
            type="text" 
            value={commandInput} 
            onChange={(e) => setCommandInput(e.target.value)} 
            placeholder="Type command (LINE, PLINE, RECT, HATCH, MOVE, ROTATE, OFFSET, TRIM, ERASE, MIRROR)..." 
            className="w-full bg-transparent text-white font-mono text-xs focus:outline-none uppercase"
          />
        </form>

        {/* INPUT FIELDS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px]">
          <div><label className="block text-slate-400 text-[10px] uppercase">CASE TYPE</label><input type="text" value={caseType} onChange={(e) => setCaseType(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white uppercase font-bold" /></div>
          <div><label className="block text-slate-400 text-[10px] uppercase">FEE</label><select value={feeType} onChange={(e) => setFeeType(e.target.value)} className="w-full bg-slate-950 border border-cyan-500 text-cyan-300 font-bold rounded p-1"><option value="AUTO">AUTO</option><option value="MANUAL">MANUAL</option></select></div>
          <div><label className="block text-slate-400 text-[10px] uppercase">CLIENT NAME</label><input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white uppercase" /></div>
          <div><label className="block text-slate-400 text-[10px] uppercase">REPRESENTATIVE</label><input type="text" value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white uppercase" /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
          <div className="md:col-span-2"><label className="block text-slate-400 text-[10px] uppercase">CUSTOMER NAME</label><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white uppercase font-bold" /></div>
          <div><label className="block text-slate-400 text-[10px] uppercase">PLOT AREA</label><input type="text" value={plotArea} onChange={(e) => setPlotArea(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white font-bold" /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
          <div className="md:col-span-2"><label className="block text-slate-400 text-[10px] uppercase">PROPERTY ADDRESS</label><input type="text" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white uppercase" /></div>
          <div>
            <label className="block text-slate-400 text-[10px] uppercase">GEO COORDINATES (LAT, LONG)</label>
            <div className="flex gap-1">
              <input type="text" value={lat} onChange={(e) => setLat(e.target.value)} className="w-1/2 bg-slate-950 border border-slate-700 rounded p-1 text-white font-mono text-center" placeholder="Latitude" />
              <input type="text" value={lng} onChange={(e) => setLng(e.target.value)} className="w-1/2 bg-slate-950 border border-slate-700 rounded p-1 text-white font-mono text-center" placeholder="Longitude" />
            </div>
          </div>
        </div>
      </div>

      {/* SINGLE UNIFIED REPORT CONTAINER (EXACT IMAGE FORMAT) */}
      <div ref={reportRef} className="max-w-[1350px] mx-auto bg-white text-slate-900 border-2 border-slate-800 p-2.5 shadow-2xl space-y-2">
        
        {/* TOP SECTION: MAP + PROPERTY PHOTO + ROUTE MAP INFO SHEET */}
        <div className="grid grid-cols-12 gap-2 border-b-2 border-slate-800 pb-2">
          
          {/* TOP LEFT BOX: GOOGLE MAP VIEW (~35% WIDTH) */}
          <div className="col-span-12 md:col-span-4 border-2 border-slate-800 rounded bg-slate-50 flex flex-col justify-between overflow-hidden">
            <div className="flex justify-between items-center bg-slate-200 p-1 border-b border-slate-400 text-[10px] font-bold">
              <span className="text-slate-900">📍 Geo Map Pin</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setZoomMap1(Math.max(zoomMap1 - 1, 10))} className="px-1 bg-slate-300 rounded font-bold">-</button>
                <span className="text-[9px]">Z:{zoomMap1}</span>
                <button onClick={() => setZoomMap1(Math.min(zoomMap1 + 1, 21))} className="px-1 bg-slate-300 rounded font-bold">+</button>
                <button onClick={() => setMapType1(mapType1 === 'k' ? 'm' : 'k')} className="px-1.5 py-0.5 bg-slate-800 text-white rounded text-[9px]">
                  {mapType1 === 'k' ? 'Sat' : 'Map'}
                </button>
              </div>
            </div>
            <div className="w-full h-48 relative">
              <iframe src={`https://maps.google.com/maps?q=${lat},${lng}&t=${mapType1}&z=${zoomMap1}&output=embed`} title="Top Map" className="w-full h-full border-0" />
              <div className="absolute bottom-1 left-1 bg-black/80 text-white font-mono text-[8px] px-1.5 py-0.5 rounded">
                LAT & LONG: {lat}, {lng}
              </div>
            </div>
          </div>

          {/* TOP MIDDLE BOX: UPLOAD PROPERTY PHOTO (~35% WIDTH) */}
          <div className="col-span-12 md:col-span-4 border-2 border-slate-800 rounded bg-slate-100 flex flex-col items-center justify-center p-1 relative min-h-[200px]">
            {propertyPhoto ? (
              <div className="w-full h-full relative group">
                <img src={propertyPhoto} alt="Property" className="w-full h-48 object-cover rounded" />
                <button 
                  onClick={() => photoInputRef.current?.click()} 
                  className="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white text-[9px] px-2 py-1 rounded print:hidden"
                >
                  Change Photo
                </button>
              </div>
            ) : (
              <div className="text-center space-y-2 print:hidden">
                <button 
                  onClick={() => photoInputRef.current?.click()} 
                  className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded font-bold text-xs shadow"
                >
                  📷 Upload Property Photo
                </button>
                <p className="text-[9px] text-slate-500">Click to attach property photo for report</p>
              </div>
            )}
            <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
          </div>

          {/* TOP RIGHT BOX: ROUTE MAP / KEY PLAN / LOCATION PLAN DETAILS (~30% WIDTH) */}
          <div className="col-span-12 md:col-span-4 border-2 border-slate-800 rounded p-2 bg-white flex flex-col justify-between text-[10px]">
            <div>
              <div className="font-extrabold text-blue-800 text-xs border-b border-slate-300 pb-1 uppercase tracking-wide">ROUTE MAP / KEY PLAN / LOCATION PLAN</div>
              
              <div className="mt-1 space-y-0.5">
                <div><span className="text-slate-500 font-bold uppercase">CUSTOMER NAME:</span></div>
                <div className="font-extrabold text-slate-900 uppercase text-[11px] border-b border-slate-200 pb-0.5">{customerName}</div>
                
                <div className="pt-1"><span className="text-slate-500 font-bold uppercase">PROPERTY ADDRESS:</span></div>
                <div className="font-semibold text-slate-800 text-[9.5px] border-b border-slate-200 pb-0.5">{propertyAddress}</div>
                
                <div className="pt-1 flex justify-between items-center border-b border-slate-200 pb-0.5">
                  <span className="text-slate-500 font-bold uppercase">PLOT AREA:</span>
                  <span className="font-extrabold text-slate-900">{plotArea}</span>
                </div>
              </div>

              {/* BOUNDARY DETAILS TABLE */}
              <div className="mt-2 border border-slate-400 text-[8.5px]">
                <div className="grid grid-cols-2 border-b border-slate-300 bg-slate-50">
                  <div className="p-0.5 border-r border-slate-300"><span className="font-bold">NORTH:</span> <input type="text" value={boundaryNorth} onChange={(e) => setBoundaryNorth(e.target.value)} className="w-full bg-transparent font-semibold border-b border-dashed border-slate-400" /></div>
                  <div className="p-0.5"><span className="font-bold">SOUTH:</span> <input type="text" value={boundarySouth} onChange={(e) => setBoundarySouth(e.target.value)} className="w-full bg-transparent font-semibold border-b border-dashed border-slate-400" /></div>
                </div>
                <div className="grid grid-cols-2 bg-slate-50">
                  <div className="p-0.5 border-r border-slate-300"><span className="font-bold">EAST:</span> <input type="text" value={boundaryEast} onChange={(e) => setBoundaryEast(e.target.value)} className="w-full bg-transparent font-semibold border-b border-dashed border-slate-400" /></div>
                  <div className="p-0.5"><span className="font-bold">WEST:</span> <input type="text" value={boundaryWest} onChange={(e) => setBoundaryWest(e.target.value)} className="w-full bg-transparent font-semibold border-b border-dashed border-slate-400" /></div>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-slate-300 flex justify-between items-end text-[8px] text-slate-600">
              <div>
                <p>Digitally signed by <span className="font-bold text-slate-800">Er. Jasvant Singh Chouhan</span></p>
                <p>Date: {new Date().toISOString().split('T')[0]}</p>
              </div>
              <div className="font-extrabold text-blue-900">⬆ NORTH</div>
            </div>
          </div>

        </div>

        {/* BOTTOM SECTION (~60% AREA): PRO AUTOCAD LOCATION PLAN STUDIO WITH INDEPENDENT MAP ZOOM & ROAD VIEW */}
        <div className="border-2 border-slate-800 p-1.5 bg-slate-100 rounded">
          
          {/* TOOLBAR & CONTROLS */}
          <div className="flex flex-wrap justify-between items-center bg-slate-900 p-1.5 rounded border border-slate-700 mb-1.5 text-white gap-1 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-cyan-400 uppercase text-[11px]">2. Pro AutoCAD Location Plan Studio</span>
              <button 
                onClick={() => setShowMapOnCad(!showMapOnCad)} 
                className={`px-2 py-0.5 font-bold rounded ${showMapOnCad ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                Map: {showMapOnCad ? 'ON' : 'OFF'}
              </button>

              {showMapOnCad && (
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[9px]">
                  <span>Zoom: {zoomMap2}</span>
                  <button onClick={() => setZoomMap2(Math.max(zoomMap2 - 1, 10))} className="px-1 bg-slate-800 rounded font-bold">-</button>
                  <button onClick={() => setZoomMap2(Math.min(zoomMap2 + 1, 21))} className="px-1 bg-slate-800 rounded font-bold">+</button>
                  <button onClick={() => setMapType2(mapType2 === 'k' ? 'm' : 'k')} className="px-1.5 py-0.5 bg-indigo-600 rounded font-bold">
                    {mapType2 === 'k' ? 'Satellite' : 'Roadmap'}
                  </button>
                  <a 
                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-1.5 py-0.5 bg-amber-600 text-white rounded font-bold"
                  >
                    3D Road View
                  </a>
                </div>
              )}
            </div>

            {/* CAD ACTION BUTTONS */}
            <div className="print:hidden flex flex-wrap items-center gap-1">
              <button onClick={() => setTool('select')} className={`px-2 py-0.5 rounded font-bold ${tool === 'select' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>🔍 Select</button>
              <button onClick={() => setTool('polyline')} className={`px-2 py-0.5 rounded font-bold ${tool === 'polyline' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>➰ Thin Polyline</button>
              <button onClick={() => setTool('rect')} className={`px-2 py-0.5 rounded font-bold ${tool === 'rect' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}>⬛ Rect</button>
              <button onClick={() => setTool('line')} className={`px-2 py-0.5 rounded font-bold ${tool === 'line' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}>📏 Line</button>
              <button onClick={() => setTool('hatch')} className={`px-2 py-0.5 rounded font-bold ${tool === 'hatch' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'}`}>🟧 Hatch</button>
              <button onClick={() => setTool('text')} className={`px-2 py-0.5 rounded font-bold ${tool === 'text' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}>📝 Text</button>
              <button onClick={() => setTool('dim')} className={`px-2 py-0.5 rounded font-bold ${tool === 'dim' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'}`}>📐 Dim</button>
              <button onClick={() => setTool('move')} className={`px-2 py-0.5 rounded font-bold ${tool === 'move' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>📍 Move</button>
              <button onClick={() => setTool('mirror')} className={`px-2 py-0.5 rounded font-bold ${tool === 'mirror' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}>🪞 Mirror</button>
              <button onClick={() => setTool('offset')} className={`px-2 py-0.5 rounded font-bold ${tool === 'offset' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-300'}`}>🔲 Offset</button>
              <button onClick={() => setTool('trim')} className={`px-2 py-0.5 rounded font-bold ${tool === 'trim' ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-300'}`}>✂️ Trim</button>
              <button onClick={() => setTool('delete')} className={`px-2 py-0.5 rounded font-bold ${tool === 'delete' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'}`}>🗑️ Erase</button>
              <button onClick={() => setPaths(paths.slice(0, -1))} className="px-2 py-0.5 bg-amber-700 text-white font-bold rounded">↩️ Undo</button>
              <button onClick={() => imageInputRef.current?.click()} className="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded">📷 Insert Image</button>
              <input type="file" ref={imageInputRef} onChange={handleCadImageUpload} accept="image/*" className="hidden" />
            </div>
          </div>

          {/* MAIN CAD CANVAS PORTION (~60% HEIGHT AREA) */}
          <div 
            className="w-full h-[480px] relative border-2 border-slate-700 rounded bg-white overflow-hidden shadow-inner cursor-crosshair"
            onWheel={(e) => {
              e.preventDefault();
              if (e.deltaY < 0) setZoomMap2((prev) => Math.min(prev + 1, 21));
              else setZoomMap2((prev) => Math.max(prev - 1, 10));
            }}
          >
            {showMapOnCad && (
              <div className="absolute inset-0 z-0 pointer-events-auto">
                <iframe src={`https://maps.google.com/maps?q=${lat},${lng}&t=${mapType2}&z=${zoomMap2}&output=embed`} title="CAD Map Overlay" className="w-full h-full border-0 opacity-90" />
              </div>
            )}
            
            <div className="absolute top-2 right-2 z-30 text-[9px] text-slate-900 font-mono bg-white/90 px-2 py-0.5 rounded border border-slate-300 pointer-events-none shadow">
              Active Tool: <span className="uppercase font-bold text-blue-700">{tool}</span> | Double-click element to edit
            </div>

            <canvas 
              ref={canvasRef} 
              width={1300} 
              height={480} 
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              onMouseDown={handleMouseDown} 
              onMouseMove={handleMouseMove} 
              onMouseUp={handleMouseUp} 
              className="absolute inset-0 w-full h-full z-20 pointer-events-auto bg-transparent" 
            />
          </div>
        </div>

        {/* COMMAND LOG TERMINAL */}
        <div className="bg-slate-950 border border-slate-800 p-1.5 rounded font-mono text-[10px] text-green-400 h-16 overflow-y-auto print:hidden">
          {commandLog.map((log, idx) => (
            <div key={idx}>&gt; {log}</div>
          ))}
        </div>

        {/* EDIT & ROTATION MODAL */}
        {editModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:hidden">
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl w-96 space-y-3 text-white">
              <h3 className="font-extrabold text-sm text-cyan-400">Edit Property Details / Rotation</h3>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Property Text / Dimensions:</label>
                <input 
                  type="text" 
                  value={modalTextValue} 
                  onChange={(e) => setModalTextValue(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white font-bold" 
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Rotation Angle ({modalRotationValue}°):</label>
                <input 
                  type="range" 
                  min="0" 
                  max="360" 
                  value={modalRotationValue} 
                  onChange={(e) => setModalRotationValue(Number(e.target.value))} 
                  className="w-full accent-cyan-500" 
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditModalOpen(false)} className="px-3 py-1 bg-slate-700 rounded text-xs font-bold">Cancel</button>
                <button onClick={() => {
                  setPaths(paths.map(p => p === selectedElement ? { ...p, text: modalTextValue, rotation: modalRotationValue } : p));
                  setEditModalOpen(false);
                  addLog('Property text and rotation updated.');
                }} className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-xs font-bold text-white">Apply</button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="border-t border-slate-300 pt-1 flex justify-between items-center text-[8.5px] text-slate-500">
          <div>THIS ROUTE MAP PREPARED AT REQUEST OF CUSTOMER FOR HIS IN-HOUSE PURPOSE AND BASED ALL DETAILS PROVIDED BY CUSTOMER</div>
          <div className="font-bold uppercase">Certified CAD Location Plan Studio v2026</div>
        </div>
      </div>
    </div>
  );
};

export default ValuationCadStudio;