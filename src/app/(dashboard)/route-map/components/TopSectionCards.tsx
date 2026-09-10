import React from 'react';

interface TopSectionCardsProps {
  customerName: string;
  propertyAddress: string;
  latitude: string;
  longitude: string;
}

const TopSectionCards: React.FC<TopSectionCardsProps> = ({
  customerName,
  propertyAddress,
  latitude,
  longitude
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg">
        <p className="text-slate-400 text-[10px] uppercase">Customer</p>
        <p className="text-white font-bold text-sm">{customerName}</p>
      </div>
      
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg md:col-span-2">
        <p className="text-slate-400 text-[10px] uppercase">Property Address</p>
        <p className="text-white font-bold text-sm">{propertyAddress}</p>
      </div>
      
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg">
        <p className="text-slate-400 text-[10px] uppercase">GPS Coordinates</p>
        <p className="text-emerald-400 font-mono font-bold text-sm">
          📍 {latitude}, {longitude}
        </p>
      </div>
    </div>
  );
};

export default TopSectionCards;