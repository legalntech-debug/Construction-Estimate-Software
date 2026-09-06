import React, { useRef } from 'react';

interface TopSectionCardsProps {
  lat: string;
  lng: string;
  zoomMap1: number;
  setZoomMap1: React.Dispatch<React.SetStateAction<number>>;
  mapType1: 'k' | 'm';
  setMapType1: (val: 'k' | 'm') => void;
  propertyPhoto: string | null;
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  customerName: string;
  propertyAddress: string;
  plotArea: string;
  boundaryNorth: string; setBoundaryNorth: (v: string) => void;
  boundarySouth: string; setBoundarySouth: (v: string) => void;
  boundaryEast: string; setBoundaryEast: (v: string) => void;
  boundaryWest: string; setBoundaryWest: (v: string) => void;
}

export const TopSectionCards: React.FC<TopSectionCardsProps> = ({
  lat, lng, zoomMap1, setZoomMap1, mapType1, setMapType1,
  propertyPhoto, handlePhotoUpload, customerName, propertyAddress, plotArea,
  boundaryNorth, setBoundaryNorth, boundarySouth, setBoundarySouth,
  boundaryEast, setBoundaryEast, boundaryWest, setBoundaryWest
}) => {
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="grid grid-cols-12 gap-2 border-b-2 border-slate-800 pb-2">
      {/* 1. GOOGLE MAP PIN VIEW */}
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

      {/* 2. PROPERTY PHOTO */}
      <div className="col-span-12 md:col-span-4 border-2 border-slate-800 rounded bg-slate-100 flex flex-col items-center justify-center p-1 relative min-h-[200px]">
        {propertyPhoto ? (
          <div className="w-full h-full relative group">
            <img src={propertyPhoto} alt="Property" className="w-full h-48 object-cover rounded" />
            <button onClick={() => photoInputRef.current?.click()} className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[9px] px-2 py-1 rounded print:hidden">
              Change Photo
            </button>
          </div>
        ) : (
          <div className="text-center space-y-2 print:hidden">
            <button onClick={() => photoInputRef.current?.click()} className="bg-slate-800 text-white px-3 py-1.5 rounded font-bold text-xs shadow">
              📷 Upload Property Photo
            </button>
          </div>
        )}
        <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
      </div>

      {/* 3. ROUTE MAP DETAILS & BOUNDARIES */}
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

          {/* BOUNDARIES */}
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
  );
};