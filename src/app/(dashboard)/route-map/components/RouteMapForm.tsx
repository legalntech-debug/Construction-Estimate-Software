import React, { useState } from 'react';

interface RouteMapFormProps {
  onGenerate: (data: any) => void;
}

const RouteMapForm: React.FC<RouteMapFormProps> = ({ onGenerate }) => {
  const [formData, setFormData] = useState({
    customerName: 'RAJESH KUMAR SHARMA',
    propertyAddress: 'PLOT NO. 48, LAXMI NAGAR EXTENSION, INDORE',
    latitude: '22.7196',
    longitude: '75.8577',
    plotDimensions: '30 FT x 50 FT',
    boundaryNorth: 'PLOT NO. 47',
    boundarySouth: 'OTHER PROPERTY',
    boundaryEast: '20 FT WIDE ROAD',
    boundaryWest: 'PLOT NO. 49',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(formData);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl">
      <h2 className="text-cyan-400 font-bold text-sm mb-3">📍 Route Map Generator</h2>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 text-xs mb-1">Customer Name</label>
            <input
              type="text"
              name="customerName"
              value={formData.customerName}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm"
            />
          </div>
          
          <div>
            <label className="block text-slate-400 text-xs mb-1">Property Address</label>
            <input
              type="text"
              name="propertyAddress"
              value={formData.propertyAddress}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm"
            />
          </div>
          
          <div>
            <label className="block text-slate-400 text-xs mb-1">Latitude</label>
            <input
              type="text"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm"
            />
          </div>
          
          <div>
            <label className="block text-slate-400 text-xs mb-1">Longitude</label>
            <input
              type="text"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-slate-400 text-xs mb-1">Plot Dimensions</label>
            <input
              type="text"
              name="plotDimensions"
              value={formData.plotDimensions}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">North Boundary</label>
            <input
              type="text"
              name="boundaryNorth"
              value={formData.boundaryNorth}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">South Boundary</label>
            <input
              type="text"
              name="boundarySouth"
              value={formData.boundarySouth}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">East Boundary</label>
            <input
              type="text"
              name="boundaryEast"
              value={formData.boundaryEast}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 rounded-lg transition"
        >
          🗺️ Generate Route Map
        </button>
      </form>
    </div>
  );
};

export default RouteMapForm;