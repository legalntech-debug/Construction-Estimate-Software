import React, { useRef, useEffect, useState } from 'react';

interface CadStudioCanvasProps {
  latitude: string;
  longitude: string;
  showMap: boolean;
}

const CadStudioCanvas: React.FC<CadStudioCanvasProps> = ({ 
  latitude, 
  longitude, 
  showMap 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(18);

  // Google Maps Static URL generate karo
  const getMapUrl = () => {
    const lat = parseFloat(latitude) || 22.7196;
    const lng = parseFloat(longitude) || 75.8577;
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=1200x500&markers=color:red%7Clabel:P%7C${lat},${lng}&key=YOUR_GOOGLE_MAPS_API_KEY`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Agar map show karna hai toh
    if (showMap) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = getMapUrl();
      
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawBoundary(ctx);
      };
      
      img.onerror = () => {
        // Agar map load na ho toh grid show karo
        drawGrid(ctx);
        drawBoundary(ctx);
      };
    } else {
      drawGrid(ctx);
      drawBoundary(ctx);
    }
  }, [latitude, longitude, showMap, zoom]);

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    
    for (let x = 0; x < 1200; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 500);
      ctx.stroke();
    }
    
    for (let y = 0; y < 500; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1200, y);
      ctx.stroke();
    }
  };

  const drawBoundary = (ctx: CanvasRenderingContext2D) => {
    // Sample boundary draw (aap isko actual coordinates se replace kar sakte hain)
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    
    // Example: Rectangle boundary
    ctx.strokeRect(100, 100, 400, 300);
    ctx.setLineDash([]);
    
    // Label
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('📍 PROPERTY BOUNDARY', 120, 130);
  };

  return (
    <div className="relative border-2 border-slate-700 rounded-lg overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        width={1200}
        height={500}
        className="w-full h-auto"
      />
      
      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setZoom(Math.min(zoom + 1, 21))}
          className="bg-slate-800 hover:bg-slate-700 text-white w-8 h-8 rounded-full font-bold"
        >
          +
        </button>
        <button
          onClick={() => setZoom(Math.max(zoom - 1, 10))}
          className="bg-slate-800 hover:bg-slate-700 text-white w-8 h-8 rounded-full font-bold"
        >
          −
        </button>
      </div>
    </div>
  );
};

export default CadStudioCanvas;