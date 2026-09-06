import React, { useRef } from 'react';

interface CadStudioCanvasProps {
  showMapOnCad: boolean;
  setShowMapOnCad: (val: boolean) => void;
  zoomMap2: number;
  setZoomMap2: React.Dispatch<React.SetStateAction<number>>;
  mapType2: 'k' | 'm';
  setMapType2: (val: 'k' | 'm') => void;
  lat: string;
  lng: string;
  tool: string;
  setTool: (val: string) => void;
  paths: any[];
  setPaths: React.Dispatch<React.SetStateAction<any[]>>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  handleCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseUp: () => void;
  handleCadImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CadStudioCanvas: React.FC<CadStudioCanvasProps> = ({
  showMapOnCad, setShowMapOnCad, zoomMap2, setZoomMap2, mapType2, setMapType2,
  lat, lng, tool, setTool, paths, setPaths, canvasRef,
  handleCanvasClick, handleCanvasDoubleClick, handleMouseDown, handleMouseMove, handleMouseUp,
  handleCadImageUpload
}) => {
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="border-2 border-slate-800 p-1.5 bg-slate-100 rounded">
      {/* TOOLBAR */}
      <div className="flex flex-wrap justify-between items-center bg-slate-900 p-1.5 rounded border border-slate-700 mb-1.5 text-white gap-1 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-cyan-400 uppercase text-[11px]">Pro AutoCAD Location Plan Studio</span>
          <button onClick={() => setShowMapOnCad(!showMapOnCad)} className={`px-2 py-0.5 font-bold rounded ${showMapOnCad ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
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
            </div>
          )}
        </div>

        {/* CAD TOOLS */}
        <div className="print:hidden flex flex-wrap items-center gap-1">
          <button onClick={() => setTool('select')} className={`px-2 py-0.5 rounded font-bold ${tool === 'select' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'}`}>🔍 Select</button>
          <button onClick={() => setTool('polyline')} className={`px-2 py-0.5 rounded font-bold ${tool === 'polyline' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>➰ Polyline</button>
          <button onClick={() => setTool('rect')} className={`px-2 py-0.5 rounded font-bold ${tool === 'rect' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}>⬛ Rect</button>
          <button onClick={() => setTool('line')} className={`px-2 py-0.5 rounded font-bold ${tool === 'line' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}>📏 Line</button>
          <button onClick={() => setTool('hatch')} className={`px-2 py-0.5 rounded font-bold ${tool === 'hatch' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'}`}>🟧 Hatch</button>
          <button onClick={() => setTool('text')} className={`px-2 py-0.5 rounded font-bold ${tool === 'text' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}>📝 Text</button>
          <button onClick={() => setTool('dim')} className={`px-2 py-0.5 rounded font-bold ${tool === 'dim' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'}`}>📐 Dim</button>
          <button onClick={() => setTool('delete')} className={`px-2 py-0.5 rounded font-bold ${tool === 'delete' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'}`}>🗑️ Erase</button>
          <button onClick={() => setPaths(paths.slice(0, -1))} className="px-2 py-0.5 bg-amber-700 text-white font-bold rounded">↩️ Undo</button>
        </div>
      </div>

      {/* CANVAS VIEW */}
      <div className="w-full h-[480px] relative border-2 border-slate-700 rounded bg-white overflow-hidden shadow-inner cursor-crosshair">
        {showMapOnCad && (
          <div className="absolute inset-0 z-0 pointer-events-auto">
            <iframe src={`https://maps.google.com/maps?q=${lat},${lng}&t=${mapType2}&z=${zoomMap2}&output=embed`} title="CAD Map Overlay" className="w-full h-full border-0 opacity-90" />
          </div>
        )}
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
  );
};