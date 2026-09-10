'use client';

import React, { useState } from 'react';
import RouteMapForm from './components/RouteMapForm';
import CadStudioCanvas from './components/CadStudioCanvas';
import TopSectionCards from './components/TopSectionCards';

const RouteMapPage: React.FC = () => {
  const [mapData, setMapData] = useState({
    latitude: '22.7196',
    longitude: '75.8577',
    customerName: 'RAJESH KUMAR SHARMA',
    propertyAddress: 'PLOT NO. 48, LAXMI NAGAR EXTENSION, INDORE',
    showMap: true
  });

  const handleGenerate = (data: any) => {
    setMapData({
      ...data,
      showMap: true
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Top Cards */}
        <TopSectionCards 
          customerName={mapData.customerName}
          propertyAddress={mapData.propertyAddress}
          latitude={mapData.latitude}
          longitude={mapData.longitude}
        />

        {/* Form */}
        <RouteMapForm onGenerate={handleGenerate} />

        {/* Canvas - Map Display */}
        <CadStudioCanvas 
          latitude={mapData.latitude}
          longitude={mapData.longitude}
          showMap={mapData.showMap}
        />

        {/* Footer */}
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg">
          <p className="text-slate-400 text-xs text-center">
            🗺️ Route Map Generator v1.0 | GPS Coordinates: {mapData.latitude}, {mapData.longitude}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RouteMapPage;