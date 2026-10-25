'use client';

import React, { useState } from 'react';
import RouteMapForm from './components/RouteMapForm';
import CadStudioCanvas from './components/CadStudioCanvas';
import TopSectionCards from './components/TopSectionCards';

const RouteMapPage: React.FC = () => {
  const [isGenerated, setIsGenerated] = useState(false);
  
  const [mapData, setMapData] = useState({
    latitude: '22.7196',
    longitude: '75.8577',
    customerName: 'RAJESH KUMAR SHARMA',
    propertyAddress: 'PLOT NO. 48, LAXMI NAGAR EXTENSION, INDORE',
    plotArea: '1500 Sq.Ft.',
    plotShape: 'Rectangular (Regular)',
    boundaryNorth: 'PLOT NO. 47',
    boundarySouth: 'OTHER PROPERTY',
    boundaryEast: '20 FT WIDE ROAD',
    boundaryWest: 'PLOT NO. 49',
    cornerRoadDist: '45m to Corner',
    landmarkName: 'Apex City Hospital',
    landmarkDist: '320 Meters',
    showMap: true
  });

  const handleGenerate = (data: any) => {
    setMapData({
      ...data,
      showMap: true
    });
    setIsGenerated(true); // Switch to preview view
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClear = () => {
    setIsGenerated(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Top Cards - Hamesha dikhenge */}
        <TopSectionCards 
          customerName={mapData.customerName}
          propertyAddress={mapData.propertyAddress}
          latitude={mapData.latitude}
          longitude={mapData.longitude}
        />

        {/* Conditional Rendering: Form vs Preview */}
        {!isGenerated ? (
          <RouteMapForm onGenerate={handleGenerate} onClear={handleClear} />
        ) : (
          <div className="space-y-4 animate-fade-in">
            {/* Preview Header / Actions */}
            <div className="flex justify-between items-center bg-slate-900 border border-slate-700 p-3 rounded-lg">
              <h2 className="text-cyan-400 font-bold text-sm uppercase tracking-wide">
                🖨️ Final Location Plan Preview
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsGenerated(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded text-xs font-bold"
                >
                  ✏️ Edit Details
                </button>
                <button 
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-xs font-bold"
                >
                  🖨️ Print / Save PDF
                </button>
              </div>
            </div>

            {/* Canvas - Map Display (CAD View Style) */}
            <CadStudioCanvas 
              latitude={mapData.latitude}
              longitude={mapData.longitude}
              showMap={mapData.showMap}
            />
          </div>
        )}

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