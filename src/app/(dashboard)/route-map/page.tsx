"use client";

import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const ValuationCadStudio: React.FC = () => {
  // Top Command & Details State
  const [commandInput, setCommandInput] = useState('');
  const [caseType, setCaseType] = useState('RETAIL MORTGAGE & LOAN AGAINST PROPERTY');
  const [feeType, setFeeType] = useState('AUTO');
  const [clientName, setClientName] = useState('UNICO HOUSING FINANCE LIMITED');
  const [representativeName, setRepresentativeName] = useState('JASVANT SINGH CHOUHAN');
  const [customerName, setCustomerName] = useState('RAJESH KUMAR SHARMA');
  const [plotArea, setPlotArea] = useState('1463 SQ FT');
  const [propertyAddress, setPropertyAddress] = useState('PLOT NO. 48, LAXMI NAGAR EXTENSION, INDORE');
  
  // Boundary Details State
  const [boundaryNorth, setBoundaryNorth] = useState('PLOT NO. 47');
  const [boundarySouth, setBoundarySouth] = useState('OTHER PROPERTY');
  const [boundaryEast, setBoundaryEast] = useState('20 FT WIDE ROAD');
  const [boundaryWest, setBoundaryWest] = useState('PLOT NO. 49');

  // GPS Coordinates & Maps State
  const [lat, setLat] = useState('22.7196');
  const [lng, setLng] = useState('75.8577');
  const [zoomMap1, setZoomMap1] = useState(18);
  const [mapType1, setMapType1] = useState<'k' | 'm'>('k');
  
  const [showMapOnCad, setShowMapOnCad] = useState(true);
  const [zoomMap2, setZoomMap2] = useState(19);
  const [mapType2, setMapType2] = useState<'k' | 'm'>('k');

  // CAD Tools & States (Sheet 2 & Sheet 3)
  const [orthoMode, setOrthoMode] = useState(false);
  const [tool2, setTool2] = useState('select');
  const [tool3, setTool3] = useState('select');

  // Paths / Elements Array for Sheet 2 & 3
  const [paths2, setPaths2] = useState<any[]>([]);
  const [paths3, setPaths3] = useState<any[]>([]);
  const [sheet3Images, setSheet3Images] = useState<any[]>([]);

  // Drawing States Sheet 2
  const [isDrawing2, setIsDrawing2] = useState(false);
  const [dragStart2, setDragStart2] = useState<{ x: number; y: number } | null>(null);
  const [currentMouse2, setCurrentMouse2] = useState<{ x: number; y: number } | null>(null);
  const [selectedElement2, setSelectedElement2] = useState<any | null>(null);
  const [isMoving2, setIsMoving2] = useState(false);
  const [moveOffset2, setMoveOffset2] = useState({ x: 0, y: 0 });

  // Drawing States Sheet 3
  const [isDrawing3, setIsDrawing3] = useState(false);
  const [dragStart3, setDragStart3] = useState<{ x: number; y: number } | null>(null);
  const [currentMouse3, setCurrentMouse3] = useState<{ x: number; y: number } | null>(null);
  const [selectedElement3, setSelectedElement3] = useState<any | null>(null);
  const [isMoving3, setIsMoving3] = useState(false);
  const [moveOffset3, setMoveOffset3] = useState({ x: 0, y: 0 });

  // Polyline Points
  const [polyPoints2, setPolyPoints2] = useState<{ x: number; y: number }[]>([]);
  const [polyPoints3, setPolyPoints3] = useState<{ x: number; y: number }[]>([]);

  // Command Log & Terminal
  const [commandLog, setCommandLog] = useState<string[]>([
    'System initialized successfully.',
    'AutoCAD CAD Engine 2026 loaded with Ortho Mode support.',
    'Ready for user commands.'
  ]);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [modalTargetSheet, setModalTargetSheet] = useState<number>(2);
  const [modalTextValue, setModalTextValue] = useState('');
  const [modalRotationValue, setModalRotationValue] = useState(0);

  // References
  const canvasRef2 = useRef<HTMLCanvasElement | null>(null);
  const canvasRef3 = useRef<HTMLCanvasElement | null>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

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
        setIsDrawing2(false);
        setIsDrawing3(false);
        setPolyPoints2([]);
        setPolyPoints3([]);
        setIsMoving2(false);
        setIsMoving3(false);
        addLog('Active tool operation cancelled by ESC key.');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orthoMode]);

  // Command Line Handler
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim().toUpperCase();
    if (!cmd) return;

    if (cmd === 'LINE' || cmd === 'L') {
      setTool3('line');
      addLog('Command executed: LINE tool active.');
    } else if (cmd === 'RECT' || cmd === 'REC') {
      setTool3('rect');
      addLog('Command executed: RECTANGLE tool active.');
    } else if (cmd === 'PLINE' || cmd === 'POLYLINE') {
      setTool3('polyline');
      addLog('Command executed: POLYLINE tool active.');
    } else if (cmd === 'HATCH') {
      setTool3('hatch');
      addLog('Command executed: HATCH tool active.');
    } else if (cmd === 'MOVE' || cmd === 'M') {
      setTool3('move');
      addLog('Command executed: MOVE tool active.');
    } else if (cmd === 'ROTATE' || cmd === 'RO') {
      setTool3('select');
      addLog('Select an element to rotate via properties modal.');
    } else if (cmd === 'ERASE' || cmd === 'DELETE') {
      setTool3('delete');
      addLog('Command executed: ERASE tool active.');
    } else if (cmd === 'MIRROR' || cmd === 'MI') {
      setTool3('mirror');
      addLog('Command executed: MIRROR tool active.');
    } else if (cmd === 'OFFSET' || cmd === 'O') {
      setTool3('offset');
      addLog('Command executed: OFFSET tool active.');
    } else if (cmd === 'TRIM') {
      setTool3('trim');
      addLog('Command executed: TRIM tool active.');
    } else {
      addLog(`Unknown command: ${cmd}`);
    }
    setCommandInput('');
  };

  // Render Canvas 2 & 3
  useEffect(() => {
    const canvas2 = canvasRef2.current;
    if (canvas2) {
      const ctx = canvas2.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas2.width, canvas2.height);
        
        // Draw grid lines
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < canvas2.width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas2.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas2.height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas2.width, y);
          ctx.stroke();
        }

        // Render paths2
        paths2.forEach((p) => {
          ctx.save();
          if (p.type === 'rect') {
            ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
            ctx.rotate(((p.rotation || 0) * Math.PI) / 180);
            ctx.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));

            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x, p.y, p.w, p.h);

            if (p.hatched) {
              ctx.fillStyle = 'rgba(2, 132, 199, 0.15)';
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
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x1, p.y1);
            ctx.lineTo(p.x2, p.y2);
            ctx.stroke();
          } else if (p.type === 'dim') {
            ctx.strokeStyle = '#e11d48';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x1, p.y1);
            ctx.lineTo(p.x2, p.y2);
            ctx.stroke();
            const dist = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
            ctx.fillStyle = '#e11d48';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(dist)} FT`, (p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2 - 5);
          } else if (p.type === 'polyline') {
            ctx.strokeStyle = p.color || '#0284c7';
            ctx.lineWidth = 2;
            ctx.beginPath();
            p.points.forEach((pt: any, idx: number) => {
              if (idx === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            });
            if (p.closed) ctx.closePath();
            ctx.stroke();
            if (p.closed && p.hatched) {
              ctx.fillStyle = 'rgba(2, 132, 199, 0.15)';
              ctx.fill();
            }
            if (p.text && p.points.length > 0) {
              ctx.fillStyle = '#0f172a';
              ctx.font = 'bold 11px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(p.text, p.points[0].x + 20, p.points[0].y + 20);
            }
          } else if (p.type === 'text') {
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(p.text, p.x, p.y);
          }
          ctx.restore();
        });

        // Preview live drawing for Sheet 2
        if (isDrawing2 && dragStart2 && currentMouse2) {
          ctx.strokeStyle = '#0284c7';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          if (tool2 === 'rect') {
            const rx = Math.min(dragStart2.x, currentMouse2.x);
            const ry = Math.min(dragStart2.y, currentMouse2.y);
            const rw = Math.abs(currentMouse2.x - dragStart2.x);
            const rh = Math.abs(currentMouse2.y - dragStart2.y);
            ctx.strokeRect(rx, ry, rw, rh);
          } else if (tool2 === 'line' || tool2 === 'dim') {
            ctx.beginPath();
            ctx.moveTo(dragStart2.x, dragStart2.y);
            ctx.lineTo(currentMouse2.x, currentMouse2.y);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }

        // Draw active polyline points for Sheet 2
        if (polyPoints2.length > 0) {
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 2;
          ctx.beginPath();
          polyPoints2.forEach((pt, i) => {
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
            ctx.fillStyle = '#059669';
            ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
          });
          if (currentMouse2) {
            ctx.lineTo(currentMouse2.x, currentMouse2.y);
          }
          ctx.stroke();
        }
      }
    }

    const canvas3 = canvasRef3.current;
    if (canvas3) {
      const ctx3 = canvas3.getContext('2d');
      if (ctx3) {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);

        // Dark CAD Grid for Sheet 3
        ctx3.strokeStyle = '#1e293b';
        ctx3.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < canvas3.width; x += gridSize) {
          ctx3.beginPath();
          ctx3.moveTo(x, 0);
          ctx3.lineTo(x, canvas3.height);
          ctx3.stroke();
        }
        for (let y = 0; y < canvas3.height; y += gridSize) {
          ctx3.beginPath();
          ctx3.moveTo(0, y);
          ctx3.lineTo(canvas3.width, y);
          ctx3.stroke();
        }

        // Render Sheet 3 Images
        sheet3Images.forEach((imgObj) => {
          const img = new Image();
          img.src = imgObj.url;
          if (img.complete) {
            ctx3.drawImage(img, imgObj.x, imgObj.y, imgObj.w, imgObj.h);
            ctx3.strokeStyle = '#38bdf8';
            ctx3.lineWidth = 2;
            ctx3.strokeRect(imgObj.x, imgObj.y, imgObj.w, imgObj.h);
            ctx3.fillStyle = '#0f172a';
            ctx3.fillRect(imgObj.x, imgObj.y + imgObj.h, imgObj.w, 20);
            ctx3.fillStyle = '#38bdf8';
            ctx3.font = 'bold 10px sans-serif';
            ctx3.textAlign = 'center';
            ctx3.fillText(imgObj.caption, imgObj.x + imgObj.w / 2, imgObj.y + imgObj.h + 13);
          } else {
            img.onload = () => {
              ctx3.drawImage(img, imgObj.x, imgObj.y, imgObj.w, imgObj.h);
            };
          }
        });

        // Render paths3
        paths3.forEach((p) => {
          ctx3.save();
          if (p.type === 'rect') {
            ctx3.translate(p.x + p.w / 2, p.y + p.h / 2);
            ctx3.rotate(((p.rotation || 0) * Math.PI) / 180);
            ctx3.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));

            ctx3.strokeStyle = '#38bdf8';
            ctx3.lineWidth = 2;
            ctx3.strokeRect(p.x, p.y, p.w, p.h);

            if (p.hatched) {
              ctx3.fillStyle = 'rgba(56, 189, 248, 0.2)';
              ctx3.fillRect(p.x, p.y, p.w, p.h);
            }

            if (p.text) {
              ctx3.fillStyle = '#ffffff';
              ctx3.font = 'bold 11px sans-serif';
              ctx3.textAlign = 'center';
              ctx3.textBaseline = 'middle';
              ctx3.fillText(p.text, p.x + p.w / 2, p.y + p.h / 2);
            }
          } else if (p.type === 'line') {
            ctx3.strokeStyle = '#38bdf8';
            ctx3.lineWidth = 2;
            ctx3.beginPath();
            ctx3.moveTo(p.x1, p.y1);
            ctx3.lineTo(p.x2, p.y2);
            ctx3.stroke();
          } else if (p.type === 'dim') {
            ctx3.strokeStyle = '#fb7185';
            ctx3.lineWidth = 1;
            ctx3.beginPath();
            ctx3.moveTo(p.x1, p.y1);
            ctx3.lineTo(p.x2, p.y2);
            ctx3.stroke();
            const dist = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
            ctx3.fillStyle = '#fb7185';
            ctx3.font = '10px monospace';
            ctx3.textAlign = 'center';
            ctx3.fillText(`${Math.round(dist)} FT`, (p.x1 + p.x2) / 2, (p.y1 + p.y2) / 2 - 5);
          } else if (p.type === 'polyline') {
            ctx3.strokeStyle = p.color || '#38bdf8';
            ctx3.lineWidth = 2;
            ctx3.beginPath();
            p.points.forEach((pt: any, idx: number) => {
              if (idx === 0) ctx3.moveTo(pt.x, pt.y);
              else ctx3.lineTo(pt.x, pt.y);
            });
            if (p.closed) ctx3.closePath();
            ctx3.stroke();
            if (p.closed && p.hatched) {
              ctx3.fillStyle = 'rgba(56, 189, 248, 0.2)';
              ctx3.fill();
            }
            if (p.text && p.points.length > 0) {
              ctx3.fillStyle = '#ffffff';
              ctx3.font = 'bold 11px sans-serif';
              ctx3.textAlign = 'center';
              ctx3.fillText(p.text, p.points[0].x + 20, p.points[0].y + 20);
            }
          } else if (p.type === 'text') {
            ctx3.fillStyle = '#ffffff';
            ctx3.font = 'bold 12px sans-serif';
            ctx3.fillText(p.text, p.x, p.y);
          }
          ctx3.restore();
        });

        // Preview live drawing for Sheet 3
        if (isDrawing3 && dragStart3 && currentMouse3) {
          ctx3.strokeStyle = '#38bdf8';
          ctx3.setLineDash([4, 4]);
          ctx3.lineWidth = 1.5;
          if (tool3 === 'rect') {
            const rx = Math.min(dragStart3.x, currentMouse3.x);
            const ry = Math.min(dragStart3.y, currentMouse3.y);
            const rw = Math.abs(currentMouse3.x - dragStart3.x);
            const rh = Math.abs(currentMouse3.y - dragStart3.y);
            ctx3.strokeRect(rx, ry, rw, rh);
          } else if (tool3 === 'line' || tool3 === 'dim') {
            ctx3.beginPath();
            ctx3.moveTo(dragStart3.x, dragStart3.y);
            ctx3.lineTo(currentMouse3.x, currentMouse3.y);
            ctx3.stroke();
          }
          ctx3.setLineDash([]);
        }

        // Draw active polyline points for Sheet 3
        if (polyPoints3.length > 0) {
          ctx3.strokeStyle = '#10b981';
          ctx3.lineWidth = 2;
          ctx3.beginPath();
          polyPoints3.forEach((pt, i) => {
            if (i === 0) ctx3.moveTo(pt.x, pt.y);
            else ctx3.lineTo(pt.x, pt.y);
            ctx3.fillStyle = '#10b981';
            ctx3.fillRect(pt.x - 3, pt.y - 3, 6, 6);
          });
          if (currentMouse3) {
            ctx3.lineTo(currentMouse3.x, currentMouse3.y);
          }
          ctx3.stroke();
        }
      }
    }
  }, [paths2, paths3, sheet3Images, isDrawing2, dragStart2, currentMouse2, isDrawing3, dragStart3, currentMouse3, polyPoints2, polyPoints3, tool2, tool3]);

  // Canvas 2 Click / Handlers
  const handleCanvasClick2 = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef2.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (tool2 === 'polyline') {
      if (orthoMode && polyPoints2.length > 0) {
        const lastPt = polyPoints2[polyPoints2.length - 1];
        if (Math.abs(x - lastPt.x) > Math.abs(y - lastPt.y)) y = lastPt.y;
        else x = lastPt.x;
      }
      if (polyPoints2.length === 0) {
        setPolyPoints2([{ x, y }]);
      } else {
        const startPt = polyPoints2[0];
        if (Math.hypot(x - startPt.x, y - startPt.y) < 15) {
          const defaultTxt = prompt('Enter Property/Plot Details for this Closed Polyline:', 'PLOT 480 - 1463 SQ FT') || 'PLOT AREA';
          setPaths2([...paths2, { type: 'polyline', points: polyPoints2, closed: true, color: '#0284c7', hatched: false, text: defaultTxt }]);
          setPolyPoints2([]);
          addLog('Smart Closed Polyline created with property text.');
        } else {
          setPolyPoints2([...polyPoints2, { x, y }]);
        }
      }
    } else if (tool2 === 'text') {
      const text = prompt('Enter text annotation:', 'PLOT LAYOUT');
      if (text) setPaths2([...paths2, { type: 'text', x, y, text, rotation: 0 }]);
    } else if (tool2 === 'hatch') {
      const idx = paths2.findIndex(p => p.type === 'rect' && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
      if (idx !== -1) {
        const up = [...paths2];
        up[idx].hatched = true;
        setPaths2(up);
        addLog('45° Hatch applied to rectangle.');
      }
    } else if (tool2 === 'move') {
      const idx = paths2.findIndex(p => {
        if (p.type === 'text') return Math.hypot(p.x - x, p.y - y) < 30;
        if (p.type === 'rect') return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
        return false;
      });
      if (!isMoving2 && idx !== -1) {
        setSelectedElement2(paths2[idx]);
        setIsMoving2(true);
        setMoveOffset2({ x: x - (paths2[idx].x || 0), y: y - (paths2[idx].y || 0) });
        addLog('MOVE: Element selected. Click destination point.');
      } else if (isMoving2 && selectedElement2) {
        const dx = x - (selectedElement2.x || 0) - moveOffset2.x;
        const dy = y - (selectedElement2.y || 0) - moveOffset2.y;
        const up = paths2.map(p => p === selectedElement2 ? { ...p, x: (p.x || 0) + dx, y: (p.y || 0) + dy } : p);
        setPaths2(up);
        setIsMoving2(false);
        setSelectedElement2(null);
        addLog('Object successfully moved.');
      }
    } else if (['select', 'delete', 'mirror', 'offset', 'trim', 'rotate'].includes(tool2)) {
      const idx = paths2.findIndex(p => {
        if (p.type === 'text') return Math.hypot(p.x - x, p.y - y) < 30;
        if (p.type === 'rect') return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
        if (p.type === 'line') return Math.hypot(p.x2 - p.x1, p.y2 - p.y1) < 40;
        return false;
      });
      if (idx !== -1) {
        const target = paths2[idx];
        if (tool2 === 'delete') {
          setPaths2(paths2.filter((_, i) => i !== idx));
          addLog('Erased element.');
        } else if (tool2 === 'mirror') {
          setPaths2([...paths2, { ...target, x: (target.x || 0) + 50 }]);
        } else if (tool2 === 'offset') {
          setPaths2([...paths2, { ...target, x: (target.x || 0) + 20, y: (target.y || 0) + 20 }]);
        } else if (tool2 === 'trim') {
          setPaths2(paths2.filter((_, i) => i !== idx));
        } else {
          setSelectedElement2(target);
          setModalTargetSheet(2);
          setModalTextValue(target.text || '');
          setModalRotationValue(target.rotation || 0);
          setEditModalOpen(true);
        }
      }
    }
  };

  const handleCanvasDoubleClick2 = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef2.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = paths2.findIndex(p => {
      if (p.type === 'text') return Math.hypot(p.x - x, p.y - y) < 30;
      if (p.type === 'rect') return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
      return false;
    });
    if (idx !== -1) {
      const target = paths2[idx];
      setSelectedElement2(target);
      setModalTargetSheet(2);
      setModalTextValue(target.text || '');
      setModalRotationValue(target.rotation || 0);
      setEditModalOpen(true);
      addLog('Opened Edit Modal for property text.');
    }
  };

  const handleMouseDown2 = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef2.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (['rect', 'line', 'dim', 'circle'].includes(tool2)) {
      setIsDrawing2(true);
      setDragStart2({ x, y });
      setCurrentMouse2({ x, y });
    }
  };

  const handleMouseMove2 = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef2.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    if (orthoMode && dragStart2 && (tool2 === 'line' || tool2 === 'rect' || tool2 === 'dim')) {
      if (Math.abs(x - dragStart2.x) > Math.abs(y - dragStart2.y)) y = dragStart2.y;
      else x = dragStart2.x;
    }
    setCurrentMouse2({ x, y });
  };

  const handleMouseUp2 = () => {
    if (!isDrawing2 || !dragStart2 || !currentMouse2) return;
    let cx = currentMouse2.x;
    let cy = currentMouse2.y;
    if (orthoMode) {
      if (Math.abs(cx - dragStart2.x) > Math.abs(cy - dragStart2.y)) cy = dragStart2.y;
      else cx = dragStart2.x;
    }

    if (tool2 === 'rect') {
      const x = Math.min(dragStart2.x, cx);
      const y = Math.min(dragStart2.y, cy);
      const w = Math.abs(cx - dragStart2.x);
      const h = Math.abs(cy - dragStart2.y);
      if (w > 5 && h > 5) {
        const defaultTxt = prompt('Enter Property Dimensions/Details inside Rectangle:', `${Math.round(w)} x ${Math.round(h)} FT`) || 'PLOT AREA';
        setPaths2([...paths2, { type: 'rect', x, y, w, h, rotation: 0, hatched: false, text: defaultTxt }]);
        addLog('Rectangle created with inserted property text.');
      }
    } else if (tool2 === 'line') {
      setPaths2([...paths2, { type: 'line', x1: dragStart2.x, y1: dragStart2.y, x2: cx, y2: cy, rotation: 0 }]);
    } else if (tool2 === 'dim') {
      setPaths2([...paths2, { type: 'dim', x1: dragStart2.x, y1: dragStart2.y, x2: cx, y2: cy }]);
    }
    setIsDrawing2(false);
    setDragStart2(null);
    setCurrentMouse2(null);
  };

  // Canvas 3 Handlers
  const handleCanvasClick3 = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef3.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (tool3 === 'polyline') {
      if (orthoMode && polyPoints3.length > 0) {
        const lastPt = polyPoints3[polyPoints3.length - 1];
        if (Math.abs(x - lastPt.x) > Math.abs(y - lastPt.y)) y = lastPt.y;
        else x = lastPt.x;
      }
      if (polyPoints3.length === 0) {
        setPolyPoints3([{ x, y }]);
      } else {
        const startPt = polyPoints3[0];
        if (Math.hypot(x - startPt.x, y - startPt.y) < 15) {
          const defaultTxt = prompt('Enter Property/Plot Details for this Closed Polyline:', 'PLOT 480 - 1463 SQ FT') || 'PLOT AREA';
          setPaths3([...paths3, { type: 'polyline', points: polyPoints3, closed: true, color: '#38bdf8', hatched: false, text: defaultTxt }]);
          setPolyPoints3([]);
          addLog('Sheet 3: Smart Closed Polyline created with property text.');
        } else {
          setPolyPoints3([...polyPoints3, { x, y }]);
        }
      }
    } else if (tool3 === 'text') {
      const text = prompt('Enter text annotation:', 'PLOT LAYOUT');
      if (text) setPaths3([...paths3, { type: 'text', x, y, text, rotation: 0 }]);
    } else if (tool3 === 'hatch') {
      const idx = paths3.findIndex(p => p.type === 'rect' && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
      if (idx !== -1) {
        const up = [...paths3];
        up[idx].hatched = true;
        setPaths3(up);
        addLog('Sheet 3: 45° Hatch applied.');
      }
    } else if (tool3 === 'move') {
      const idx = paths3.findIndex(p => {
        if (p.type === 'text') return Math.hypot(p.x - x, p.y - y) < 30;
        if (p.type === 'rect') return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
        return false;
      });
      if (!isMoving3 && idx !== -1) {
        setSelectedElement3(paths3[idx]);
        setIsMoving3(true);
        setMoveOffset3({ x: x - (paths3[idx].x || 0), y: y - (paths3[idx].y || 0) });
        addLog('Sheet 3 MOVE: Element selected. Click destination point.');
      } else if (isMoving3 && selectedElement3) {
        const dx = x - (selectedElement3.x || 0) - moveOffset3.x;
        const dy = y - (selectedElement3.y || 0) - moveOffset3.y;
        const up = paths3.map(p => p === selectedElement3 ? { ...p, x: (p.x || 0) + dx, y: (p.y || 0) + dy } : p);
        setPaths3(up);
        setIsMoving3(false);
        setSelectedElement3(null);
        addLog('Sheet 3: Object successfully moved.');
      }
    } else if (['select', 'delete', 'mirror', 'offset', 'trim', 'rotate'].includes(tool3)) {
      const idx = paths3.findIndex(p => {
        if (p.type === 'text') return Math.hypot(p.x - x, p.y - y) < 30;
        if (p.type === 'rect') return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
        if (p.type === 'line') return Math.hypot(p.x2 - p.x1, p.y2 - p.y1) < 40;
        return false;
      });
      if (idx !== -1) {
        const target = paths3[idx];
        if (tool3 === 'delete') {
          setPaths3(paths3.filter((_, i) => i !== idx));
          addLog('Sheet 3: Erased element.');
        } else if (tool3 === 'mirror') {
          setPaths3([...paths3, { ...target, x: (target.x || 0) + 50 }]);
        } else if (tool3 === 'offset') {
          setPaths3([...paths3, { ...target, x: (target.x || 0) + 20, y: (target.y || 0) + 20 }]);
        } else if (tool3 === 'trim') {
          setPaths3(paths3.filter((_, i) => i !== idx));
        } else {
          setSelectedElement3(target);
          setModalTargetSheet(3);
          setModalTextValue(target.text || '');
          setModalRotationValue(target.rotation || 0);
          setEditModalOpen(true);
        }
      }
    }
  };

  const handleCanvasDoubleClick3 = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef3.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = paths3.findIndex(p => {
      if (p.type === 'text') return Math.hypot(p.x - x, p.y - y) < 30;
      if (p.type === 'rect') return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
      return false;
    });
    if (idx !== -1) {
      const target = paths3[idx];
      setSelectedElement3(target);
      setModalTargetSheet(3);
      setModalTextValue(target.text || '');
      setModalRotationValue(target.rotation || 0);
      setEditModalOpen(true);
      addLog('Sheet 3: Opened Edit Modal for property text.');
    }
  };

  const handleMouseDown3 = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef3.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (['rect', 'line', 'dim', 'circle'].includes(tool3)) {
      setIsDrawing3(true);
      setDragStart3({ x, y });
      setCurrentMouse3({ x, y });
    }
  };

  const handleMouseMove3 = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef3.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    if (orthoMode && dragStart3 && (tool3 === 'line' || tool3 === 'rect' || tool3 === 'dim')) {
      if (Math.abs(x - dragStart3.x) > Math.abs(y - dragStart3.y)) y = dragStart3.y;
      else x = dragStart3.x;
    }
    setCurrentMouse3({ x, y });
  };

  const handleMouseUp3 = () => {
    if (!isDrawing3 || !dragStart3 || !currentMouse3) return;
    let cx = currentMouse3.x;
    let cy = currentMouse3.y;
    if (orthoMode) {
      if (Math.abs(cx - dragStart3.x) > Math.abs(cy - dragStart3.y)) cy = dragStart3.y;
      else cx = dragStart3.x;
    }

    if (tool3 === 'rect') {
      const x = Math.min(dragStart3.x, cx);
      const y = Math.min(dragStart3.y, cy);
      const w = Math.abs(cx - dragStart3.x);
      const h = Math.abs(cy - dragStart3.y);
      if (w > 5 && h > 5) {
        const defaultTxt = prompt('Enter Property Dimensions/Details inside Rectangle:', `${Math.round(w)} x ${Math.round(h)} FT`) || 'PLOT AREA';
        setPaths3([...paths3, { type: 'rect', x, y, w, h, rotation: 0, hatched: false, text: defaultTxt }]);
        addLog('Sheet 3: Rectangle created with inserted property text.');
      }
    } else if (tool3 === 'line') {
      setPaths3([...paths3, { type: 'line', x1: dragStart3.x, y1: dragStart3.y, x2: cx, y2: cy, rotation: 0 }]);
    } else if (tool3 === 'dim') {
      setPaths3([...paths3, { type: 'dim', x1: dragStart3.x, y1: dragStart3.y, x2: cx, y2: cy }]);
    }
    setIsDrawing3(false);
    setDragStart3(null);
    setCurrentMouse3(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) {
          const caption = prompt("Enter Image Caption:", "Plot Layout & Property Photo") || "Photo";
          setSheet3Images([...sheet3Images, { id: Date.now().toString(), url: result, x: 50, y: 50, w: 240, h: 170, caption }]);
          addLog('Image inserted on Sheet 3.');
        }
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
    pdf.save(`Valuation_Report_${customerName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-3 font-sans text-xs text-slate-100">
      
      {/* PROFESSIONAL COMMAND BAR & TOP CONTROLS */}
      <div className="max-w-7xl mx-auto mb-3 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl print:hidden space-y-2">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <div>
            <h1 className="font-extrabold text-sm text-cyan-400 uppercase">Professional Valuation & AutoCAD CAD Engine 2026</h1>
            <p className="text-[10px] text-slate-400">Ortho Mode (F8): <span className={orthoMode ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>{orthoMode ? 'ON (Straight)' : 'OFF (Free)'}</span> | Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300 font-mono">ESC</kbd> to cancel current tool.</p>
          </div>
          <button onClick={handleDownloadPDF} className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-lg">
            📥 Download Landscape PDF Report
          </button>
        </div>

        {/* COMMAND LINE INPUT */}
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

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-[11px]">
          <div><label className="block text-slate-400">Case Type</label><input type="text" value={caseType} onChange={(e) => setCaseType(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white uppercase font-bold" /></div>
          <div><label className="block text-slate-400">Fee Type</label><select value={feeType} onChange={(e) => setFeeType(e.target.value)} className="w-full bg-slate-950 border border-cyan-500 text-cyan-300 font-bold rounded p-1"><option value="AUTO">AUTO</option><option value="MANUAL">MANUAL</option></select></div>
          <div><label className="block text-slate-400">Client Name</label><input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white uppercase" /></div>
          <div><label className="block text-slate-400">Representative</label><input type="text" value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1 text-white uppercase" /></div>
          <div><label className="block text-slate-400">Latitude</label><input type="text" value={lat} onChange={(e) => setLat(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1 font-mono text-white" /></div>
          <div><label className="block text-slate-400">Longitude</label><input type="text" value={lng} onChange={(e) => setLng(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-1 font-mono text-white" /></div>
        </div>
      </div>

      {/* REPORT CONTAINER */}
      <div ref={reportRef} className="max-w-7xl mx-auto bg-white text-slate-900 border-2 border-slate-900 p-4 shadow-2xl space-y-4">
        
        {/* HEADER */}
        <div className="grid grid-cols-12 gap-2 border-b-2 border-slate-900 pb-2 items-center">
          <div className="col-span-8">
            <div className="bg-cyan-900 text-white p-1 text-center font-black text-xs uppercase rounded">EXECUTIVE GEO-TAGGED LOCATION PLAN & SITE LAYOUT REPORT</div>
            <div className="grid grid-cols-3 gap-2 mt-1.5 text-[10px]">
              <div><span className="font-bold text-slate-500">CASE TYPE:</span> <span className="font-bold text-slate-900">{caseType}</span></div>
              <div><span className="font-bold text-slate-500">CLIENT:</span> <span className="font-bold text-slate-900">{clientName}</span></div>
              <div><span className="font-bold text-slate-500">REPRESENTATIVE:</span> <span className="font-bold text-slate-900">{representativeName}</span></div>
              <div className="col-span-2"><span className="font-bold text-slate-500">CUSTOMER:</span> <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="border-b border-dashed border-slate-400 font-bold text-slate-900 bg-transparent px-1 w-full" /></div>
              <div><span className="font-bold text-slate-500">PLOT AREA:</span> <input type="text" value={plotArea} onChange={(e) => setPlotArea(e.target.value)} className="border-b border-dashed border-slate-400 font-bold text-slate-900 bg-transparent px-1 w-24" /></div>
              <div className="col-span-3"><span className="font-bold text-slate-500">PROPERTY ADDRESS:</span> <input type="text" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} className="border-b border-dashed border-slate-400 font-semibold text-slate-800 bg-transparent px-1 w-full" /></div>
              
              <div className="col-span-3 grid grid-cols-4 gap-1 mt-1 bg-slate-50 p-1 rounded border border-slate-200 text-[9px]">
                <div><span className="font-bold text-slate-600">NORTH:</span> <input type="text" value={boundaryNorth} onChange={(e) => setBoundaryNorth(e.target.value)} className="bg-transparent font-semibold w-full" /></div>
                <div><span className="font-bold text-slate-600">SOUTH:</span> <input type="text" value={boundarySouth} onChange={(e) => setBoundarySouth(e.target.value)} className="bg-transparent font-semibold w-full" /></div>
                <div><span className="font-bold text-slate-600">EAST:</span> <input type="text" value={boundaryEast} onChange={(e) => setBoundaryEast(e.target.value)} className="bg-transparent font-semibold w-full" /></div>
                <div><span className="font-bold text-slate-600">WEST:</span> <input type="text" value={boundaryWest} onChange={(e) => setBoundaryWest(e.target.value)} className="bg-transparent font-semibold w-full" /></div>
              </div>
            </div>
          </div>
          <div className="col-span-4 border border-slate-400 p-2 bg-slate-50 rounded flex items-center justify-between">
            <div className="text-[10px]">
              <p className="font-extrabold text-slate-900">GPS GEO-COORDINATES:</p>
              <p className="font-mono text-blue-700 font-bold">{lat}, {lng}</p>
              <p className="text-[8px] text-emerald-700 font-extrabold mt-0.5">✓ Verified Location Pin with Road View</p>
            </div>
            <div className="bg-red-600 text-white font-bold text-[9px] px-2 py-1 rounded shadow uppercase">CORNER</div>
          </div>
        </div>

        {/* SHEET 1: GOOGLE MAP VIEW */}
        <div className="border-2 border-slate-900 p-2.5 bg-white rounded">
          <div className="flex justify-between items-center bg-slate-100 p-1.5 rounded border mb-2">
            <span className="font-bold text-slate-900 text-xs uppercase">1. Neat & Clean Geo-Tagged Google Map & Road View (Full Width)</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-0.5 text-[10px] font-bold">
                <span>Map Zoom: {zoomMap1}</span>
                <button onClick={() => setZoomMap1(Math.max(zoomMap1 - 1, 10))} className="px-1 bg-slate-200 hover:bg-slate-300 rounded font-bold">-</button>
                <button onClick={() => setZoomMap1(Math.min(zoomMap1 + 1, 21))} className="px-1 bg-slate-200 hover:bg-slate-300 rounded font-bold">+</button>
              </div>
              <button onClick={() => setMapType1(mapType1 === 'k' ? 'm' : 'k')} className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 text-white rounded">
                {mapType1 === 'k' ? '🌍 Satellite & Road View' : '🗺️ Roadmap View'}
              </button>
              <a 
                href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`} 
                target="_blank" 
                rel="noreferrer"
                className="px-2.5 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded shadow"
              >
                📍 3D Road View
              </a>
            </div>
          </div>
          <div 
            className="w-full h-[520px] relative border border-slate-700 rounded bg-white overflow-hidden shadow-inner"
            onWheel={(e) => {
              e.preventDefault();
              if (e.deltaY < 0) setZoomMap1((prev) => Math.min(prev + 1, 21));
              else setZoomMap1((prev) => Math.max(prev - 1, 10));
            }}
          >
            <iframe src={`https://maps.google.com/maps?q=${lat},${lng}&t=${mapType1}&z=${zoomMap1}&output=embed`} title="Map 1" className="w-full h-full border-0" />
            <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-extrabold px-3 py-1 rounded shadow-2xl pointer-events-none">
              📍 LOCATION PIN & ROAD PROXIMITY: {lat}, {lng}
            </div>
          </div>
        </div>

        {/* SHEET 2: PRO AUTOCAD STUDIO WITH INDIVIDUAL MAP ZOOM & ROAD VIEW */}
        <div className="border-2 border-slate-900 p-2.5 bg-slate-100 rounded">
          <div className="flex flex-wrap justify-between items-center bg-slate-800 p-2 rounded border border-slate-700 mb-2 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-cyan-400 text-xs uppercase">2. Pro AutoCAD Location Plan Studio (With Independent Map Zoom & Road View)</span>
              <button 
                onClick={() => setShowMapOnCad(!showMapOnCad)} 
                className={`px-2 py-0.5 text-[10px] font-bold rounded ${showMapOnCad ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                {showMapOnCad ? 'Map: ON' : 'Map: OFF'}
              </button>
              {showMapOnCad && (
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[10px] text-white">
                  <span>Zoom: {zoomMap2}</span>
                  <button onClick={() => setZoomMap2(Math.max(zoomMap2 - 1, 10))} className="px-1 bg-slate-700 rounded font-bold">-</button>
                  <button onClick={() => setZoomMap2(Math.min(zoomMap2 + 1, 21))} className="px-1 bg-slate-700 rounded font-bold">+</button>
                  <button onClick={() => setMapType2(mapType2 === 'k' ? 'm' : 'k')} className="ml-1 px-1.5 py-0.5 bg-indigo-600 rounded font-bold">
                    {mapType2 === 'k' ? 'Satellite' : 'Roadmap'}
                  </button>
                  <a 
                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="ml-1 px-2 py-0.5 bg-amber-600 text-white rounded font-bold"
                  >
                    3D Road View
                  </a>
                </div>
              )}
            </div>

            <div className="print:hidden flex flex-wrap items-center gap-1 text-[10px]">
              <button onClick={() => setTool2('select')} className={`px-2 py-1 rounded ${tool2 === 'select' ? 'bg-indigo-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>🔍 Select</button>
              <button onClick={() => setTool2('polyline')} className={`px-2 py-1 rounded ${tool2 === 'polyline' ? 'bg-emerald-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>➰ Smart Pline</button>
              <button onClick={() => setTool2('rect')} className={`px-2 py-1 rounded ${tool2 === 'rect' ? 'bg-cyan-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>⬛ Property Rect</button>
              <button onClick={() => setTool2('line')} className={`px-2 py-1 rounded ${tool2 === 'line' ? 'bg-cyan-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>📏 Line</button>
              <button onClick={() => setTool2('hatch')} className={`px-2 py-1 rounded ${tool2 === 'hatch' ? 'bg-amber-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>🟧 45° Hatch</button>
              <button onClick={() => setTool2('text')} className={`px-2 py-1 rounded ${tool2 === 'text' ? 'bg-cyan-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>📝 Text</button>
              <button onClick={() => setTool2('dim')} className={`px-2 py-1 rounded ${tool2 === 'dim' ? 'bg-rose-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>📐 Dim</button>
              <button onClick={() => setTool2('move')} className={`px-2 py-1 rounded ${tool2 === 'move' ? 'bg-blue-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>📍 Move</button>
              <button onClick={() => setTool2('mirror')} className={`px-2 py-1 rounded ${tool2 === 'mirror' ? 'bg-purple-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>🪞 Mirror</button>
              <button onClick={() => setTool2('offset')} className={`px-2 py-1 rounded ${tool2 === 'offset' ? 'bg-orange-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>🔲 Offset</button>
              <button onClick={() => setTool2('trim')} className={`px-2 py-1 rounded ${tool2 === 'trim' ? 'bg-pink-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>✂️ Trim</button>
              <button onClick={() => setTool2('delete')} className={`px-2 py-1 rounded ${tool2 === 'delete' ? 'bg-red-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>🗑️ Erase</button>
              <button onClick={() => setPaths2(paths2.slice(0, -1))} className="px-2 py-1 bg-amber-700 text-white font-bold rounded">↩️ Undo</button>
            </div>
          </div>

          <div 
            className="w-full h-[520px] relative border-2 border-slate-700 rounded bg-white overflow-hidden shadow-inner cursor-crosshair"
            onWheel={(e) => {
              e.preventDefault();
              if (e.deltaY < 0) setZoomMap2((prev) => Math.min(prev + 1, 21));
              else setZoomMap2((prev) => Math.max(prev - 1, 10));
            }}
          >
            {showMapOnCad && (
              <div className="absolute inset-0 z-0 pointer-events-auto">
                <iframe src={`https://maps.google.com/maps?q=${lat},${lng}&t=${mapType2}&z=${zoomMap2}&output=embed`} title="CAD Map Background" className="w-full h-full border-0" />
              </div>
            )}
            <div className="absolute top-2 right-2 z-30 text-[10px] text-slate-800 font-mono bg-white/90 px-2.5 py-1 rounded border border-slate-300 pointer-events-none shadow">
              Active Tool: <span className="uppercase font-bold text-blue-700">{tool2}</span> | Double-click any text/rect to edit
            </div>
            <canvas 
              ref={canvasRef2} 
              width={1200} 
              height={520} 
              onClick={handleCanvasClick2}
              onDoubleClick={handleCanvasDoubleClick2}
              onMouseDown={handleMouseDown2} 
              onMouseMove={handleMouseMove2} 
              onMouseUp={handleMouseUp2} 
              className="absolute inset-0 w-full h-full z-20 pointer-events-auto bg-transparent" 
            />
          </div>
        </div>

        {/* SHEET 3: PURE AUTOCAD STUDIO SHEET & IMAGE UPLOAD */}
        <div className="border-2 border-slate-900 p-2.5 bg-slate-900 text-white rounded">
          <div className="flex flex-wrap justify-between items-center bg-slate-800 p-2 rounded border border-slate-700 mb-2 gap-2">
            <span className="font-bold text-cyan-400 text-xs uppercase">3. Pure AutoCAD Studio Sheet (Smart Property Drawing & Image Insertion)</span>
            
            <div className="print:hidden flex flex-wrap items-center gap-1 text-[10px]">
              <button onClick={() => setTool3('select')} className={`px-2 py-1 rounded ${tool3 === 'select' ? 'bg-indigo-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>🔍 Select</button>
              <button onClick={() => setTool3('polyline')} className={`px-2 py-1 rounded ${tool3 === 'polyline' ? 'bg-emerald-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>➰ Smart Pline</button>
              <button onClick={() => setTool3('rect')} className={`px-2 py-1 rounded ${tool3 === 'rect' ? 'bg-cyan-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>⬛ Property Rect</button>
              <button onClick={() => setTool3('line')} className={`px-2 py-1 rounded ${tool3 === 'line' ? 'bg-cyan-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>📏 Line</button>
              <button onClick={() => setTool3('hatch')} className={`px-2 py-1 rounded ${tool3 === 'hatch' ? 'bg-amber-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>🟧 45° Hatch</button>
              <button onClick={() => setTool3('text')} className={`px-2 py-1 rounded ${tool3 === 'text' ? 'bg-cyan-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>📝 Text</button>
              <button onClick={() => setTool3('dim')} className={`px-2 py-1 rounded ${tool3 === 'dim' ? 'bg-rose-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>📐 Dim</button>
              <button onClick={() => setTool3('move')} className={`px-2 py-1 rounded ${tool3 === 'move' ? 'bg-blue-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>📍 Move</button>
              <button onClick={() => setTool3('mirror')} className={`px-2 py-1 rounded ${tool3 === 'mirror' ? 'bg-purple-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>🪞 Mirror</button>
              <button onClick={() => setTool3('offset')} className={`px-2 py-1 rounded ${tool3 === 'offset' ? 'bg-orange-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>🔲 Offset</button>
              <button onClick={() => setTool3('trim')} className={`px-2 py-1 rounded ${tool3 === 'trim' ? 'bg-pink-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>✂️ Trim</button>
              <button onClick={() => setTool3('delete')} className={`px-2 py-1 rounded ${tool3 === 'delete' ? 'bg-red-600 font-bold text-white' : 'bg-slate-700 text-slate-200'}`}>🗑️ Erase</button>
              <button onClick={() => setPaths3(paths3.slice(0, -1))} className="px-2 py-1 bg-amber-700 text-white font-bold rounded">↩️ Undo</button>

              <button onClick={() => imageInputRef.current?.click()} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow flex items-center gap-1">
                📷 Insert Image
              </button>
              <input type="file" ref={imageInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            </div>
          </div>

          <div className="w-full h-[560px] bg-white border-2 border-slate-700 rounded relative overflow-hidden shadow-inner cursor-crosshair">
            <div className="absolute top-2 right-2 z-30 text-[10px] text-slate-800 font-mono bg-white/90 px-2.5 py-1 rounded border border-slate-300 pointer-events-none shadow">
              Active Tool 3: <span className="uppercase font-bold text-blue-700">{tool3}</span> | Double-click to edit text
            </div>
            <canvas 
              ref={canvasRef3} 
              width={1200} 
              height={560} 
              onClick={handleCanvasClick3}
              onDoubleClick={handleCanvasDoubleClick3}
              onMouseDown={handleMouseDown3} 
              onMouseMove={handleMouseMove3} 
              onMouseUp={handleMouseUp3} 
              className="absolute inset-0 w-full h-full z-20 pointer-events-auto bg-transparent" 
            />
          </div>
        </div>

        {/* COMMAND LOG TERMINAL */}
        <div className="bg-slate-950 border border-slate-800 p-2 rounded font-mono text-[11px] text-green-400 h-20 overflow-y-auto">
          {commandLog.map((log, idx) => (
            <div key={idx}>&gt; {log}</div>
          ))}
        </div>

        {/* EDIT & ROTATE MODAL */}
        {editModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl w-96 space-y-3 text-white">
              <h3 className="font-extrabold text-sm text-cyan-400">Edit Property Text / Dimensions & Rotation</h3>
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
                  if (modalTargetSheet === 2) {
                    setPaths2(paths2.map(p => p === selectedElement2 ? { ...p, text: modalTextValue, rotation: modalRotationValue } : p));
                  } else {
                    setPaths3(paths3.map(p => p === selectedElement3 ? { ...p, text: modalTextValue, rotation: modalRotationValue } : p));
                  }
                  setEditModalOpen(false);
                  addLog('Property text and rotation updated successfully.');
                }} className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-xs font-bold text-white">Apply</button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="border-t border-slate-300 pt-1.5 flex justify-between items-end text-[9px] text-slate-600">
          <div className="italic">Disclaimer: Executive report prepared for property valuation appraisal and inspection evaluation purposes.</div>
          <div className="font-bold uppercase">Certified CAD & Valuation Studio v2026</div>
        </div>
      </div>
    </div>
  );
};

export default ValuationCadStudio;