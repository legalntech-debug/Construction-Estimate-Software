import React, { useState } from 'react';

interface RouteMapFormProps {
  onGenerate: (data: any) => void;
  onClear: () => void;
}

const RouteMapForm: React.FC<RouteMapFormProps> = ({ onGenerate, onClear }) => {
  const [formData, setFormData] = useState({
    customerName: 'RAJESH KUMAR SHARMA',
    propertyAddress: 'PLOT NO. 48, LAXMI NAGAR EXTENSION, INDORE',
    plotArea: '1500 Sq.Ft.',
    plotShape: 'Rectangular (Regular)',
    latLongCombined: '22.7196, 75.8577',
    boundaryNorth: 'PLOT NO. 47',
    boundarySouth: 'OTHER PROPERTY',
    boundaryEast: '20 FT WIDE ROAD',
    boundaryWest: 'PLOT NO. 49',
    cornerRoadDist: '45m to Corner',
    landmarkName: 'Apex City Hospital',
    landmarkDist: '320 Meters',
    showCadMap: false // Default to false to save space
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Lat & Long ko comma se split karke parse kar sakte hain
    const parts = formData.latLongCombined.split(',');
    const latitude = parts[0] ? parts[0].trim() : '22.7196';
    const longitude = parts[1] ? parts[1].trim() : '75.8577';

    onGenerate({
      ...formData,
      latitude,
      longitude
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-700 p-5 rounded-xl shadow-xl text-slate-100">
      <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
        <h2 className="text-cyan-400 font-bold text-sm uppercase tracking-wide">
          📍 Location Plan Input Dashboard
        </h2>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, showCadMap: !formData.showCadMap })}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3 py-1 rounded border border-slate-700 transition"
        >
          {formData.showCadMap ? '📐 Hide CAD Map View' : '📐 Show CAD Map View'}
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Customer Name & Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Customer / Owner Name</label>
            <input
              type="text"
              name="customerName"
              value={formData.customerName}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Property Address</label>
            <input
              type="text"
              name="propertyAddress"
              value={formData.propertyAddress}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Plot Area & Plot Geometry in 1 Row (50% - 50%) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Plot Area (Sq.Ft / Sq.M)</label>
            <input
              type="text"
              name="plotArea"
              value={formData.plotArea}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Plot Geometry Shape</label>
            <select
              name="plotShape"
              value={formData.plotShape}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="Rectangular (Regular)">Rectangular (Regular)</option>
              <option value="Square">Square</option>
              <option value="Irregular">Irregular / Trapezoidal</option>
            </select>
          </div>
        </div>

        {/* Latitude & Longitude in 1 Single Combined Box */}
        <div>
          <label className="block text-slate-400 font-semibold mb-1">
            GPS Coordinates (Latitude, Longitude - Ek hi box me paste karein)
          </label>
          <input
            type="text"
            name="latLongCombined"
            value={formData.latLongCombined}
            onChange={handleChange}
            placeholder="e.g. 22.7196, 75.8577"
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-emerald-400 font-mono text-xs focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Four Boundaries (Stacked / Organized) */}
        <div className="border-t border-slate-800 pt-3">
          <label className="block text-slate-300 font-bold mb-2 uppercase text-[11px]">
            Four-Side Boundaries (Chouhaddi)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="text-slate-400 block mb-1">North Boundary</span>
              <input
                type="text"
                name="boundaryNorth"
                value={formData.boundaryNorth}
                onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">South Boundary</span>
              <input
                type="text"
                name="boundarySouth"
                value={formData.boundarySouth}
                onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">East Boundary</span>
              <input
                type="text"
                name="boundaryEast"
                value={formData.boundaryEast}
                onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">West Boundary</span>
              <input
                type="text"
                name="boundaryWest"
                value={formData.boundaryWest}
                onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs"
              />
            </div>
          </div>
        </div>

        {/* Landmarks & Distances */}
        <div className="border-t border-slate-800 pt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Corner Road Distance</label>
            <input
              type="text"
              name="cornerRoadDist"
              value={formData.cornerRoadDist}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Main Landmark Name (Green)</label>
            <input
              type="text"
              name="landmarkName"
              value={formData.landmarkName}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Distance from Landmark</label>
            <input
              type="text"
              name="landmarkDist"
              value={formData.landmarkDist}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-xs"
            />
          </div>
        </div>

        {/* Action Buttons at Bottom */}
        <div className="pt-4 border-t border-slate-800 flex gap-3">
          <button
            type="submit"
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2.5 rounded-lg transition shadow text-xs uppercase tracking-wider"
          >
            🚀 Generate Location Plan
          </button>
          <button
            type="button"
            onClick={onClear}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-lg transition shadow text-xs uppercase tracking-wider"
          >
            🗑️ Clear Plan
          </button>
        </div>
      </form>
    </div>
  );
};

export default RouteMapForm;