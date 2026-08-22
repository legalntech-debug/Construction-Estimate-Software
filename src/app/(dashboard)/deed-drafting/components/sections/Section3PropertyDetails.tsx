'use client';

import React from "react";

interface Section3Props {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  handleChange: (e: any) => void;
}

export default function Section3PropertyDetails({ formData, setFormData, handleChange }: Section3Props) {
  
  const isBuiltUpProperty = ["HOUSE", "FLAT", "COMMERCIAL"].includes(formData.propertyType?.toUpperCase());

  const addFloor = () => {
    setFormData((prev: any) => ({
      ...prev,
      floorsList: [
        ...(prev.floorsList || []),
        { floorName: "FIRST FLOOR", builtUpArea: "", areaUnit: "Sq. Ft.", constructionType: "RCC Frame Structure" }
      ]
    }));
  };

  const removeFloor = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      floorsList: prev.floorsList.filter((_: any, i: number) => i !== index)
    }));
  };

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-4">
      <h2 className="text-xs font-black text-blue-900 uppercase tracking-wider">
        SECTION 3: PROPERTY DETAILS, ADDRESS & FOUR BOUNDARIES (चतुःसीमा)
      </h2>

      {/* Plot Area & Exact Address */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">TOTAL PLOT / LAND AREA *</label>
          <input 
            type="text" 
            name="plotArea" 
            required 
            placeholder="e.g. 1000" 
            value={formData.plotArea} 
            onChange={handleChange} 
            className="w-full p-2 border rounded text-sm bg-white font-semibold" 
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-1">PLOT AREA UNIT</label>
          <select 
            name="plotAreaUnit" 
            value={formData.plotAreaUnit || "Sq. Ft."} 
            onChange={handleChange} 
            className="w-full p-2 border rounded text-sm bg-white font-bold text-blue-900"
          >
            <option value="Sq. Ft.">Sq. Ft. (वर्ग फीट)</option>
            <option value="Sq. Mtr.">Sq. Mtr. (वर्ग मीटर)</option>
            <option value="Acre">Acre (एकड़)</option>
            <option value="Hectare">Hectare (हेक्टेयर)</option>
            <option value="Bigha">Bigha (बीघा)</option>
          </select>
        </div>
        
        {/* Exact Property Address as Textarea for automatic text wrapping */}
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold text-gray-700 mb-1">EXACT PROPERTY ADDRESS * (Auto-Wrap)</label>
          <textarea 
            name="propertyAddress" 
            required 
            rows={2}
            placeholder="e.g. Plot No 81, Dwarka Valley, Mangliya, Indore, Madhya Pradesh" 
            value={formData.propertyAddress} 
            onChange={handleChange} 
            className="w-full p-2 border rounded text-sm bg-white font-semibold uppercase resize-y" 
          />
        </div>
      </div>

      {/* Building & Floor Construction Details */}
      {isBuiltUpProperty && (
        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <div>
              <h3 className="text-xs font-bold text-blue-900 uppercase">
                Building & Floor Construction Details (निर्माण एवं तल का विवरण)
              </h3>
              <p className="text-[10px] text-gray-500">
                Property Type: <span className="font-bold text-blue-700">{formData.propertyType}</span> - Add floors and built-up area breakdown
              </p>
            </div>
            <button 
              type="button" 
              onClick={addFloor} 
              className="text-[11px] bg-blue-700 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-800 transition"
            >
              + Add Floor Details
            </button>
          </div>

          {(!formData.floorsList || formData.floorsList.length === 0) && (
            <p className="text-xs text-gray-400 italic text-center py-2">
              No floor details added. Click "+ Add Floor Details" to specify construction area.
            </p>
          )}

          {formData.floorsList?.map((floor: any, index: number) => (
            <div key={index} className="space-y-2 bg-slate-50 p-3 rounded-lg border">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-600 uppercase">Floor #{index + 1}</span>
                {formData.floorsList.length > 1 && (
                  <button type="button" onClick={() => removeFloor(index)} className="text-red-600 font-bold text-xs hover:text-red-800">
                    ✕ Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">FLOOR / LEVEL NAME</label>
                  <select 
                    value={floor.floorName} 
                    onChange={(e) => {
                      const updated = [...formData.floorsList];
                      updated[index].floorName = e.target.value;
                      setFormData((prev: any) => ({ ...prev, floorsList: updated }));
                    }} 
                    className="w-full p-2 border rounded text-xs bg-white font-semibold"
                  >
                    <option value="GROUND FLOOR">Ground Floor (भूतल)</option>
                    <option value="FIRST FLOOR">First Floor (प्रथम तल)</option>
                    <option value="SECOND FLOOR">Second Floor (द्वितीय तल)</option>
                    <option value="THIRD FLOOR">Third Floor (तृतीय तल)</option>
                    <option value="BASEMENT">Basement (तहखाना)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">BUILT-UP AREA</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 800" 
                    value={floor.builtUpArea} 
                    onChange={(e) => {
                      const updated = [...formData.floorsList];
                      updated[index].builtUpArea = e.target.value;
                      setFormData((prev: any) => ({ ...prev, floorsList: updated }));
                    }} 
                    className="w-full p-2 border rounded text-xs bg-white font-semibold" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">AREA UNIT</label>
                  <select 
                    value={floor.areaUnit || "Sq. Ft."} 
                    onChange={(e) => {
                      const updated = [...formData.floorsList];
                      updated[index].areaUnit = e.target.value;
                      setFormData((prev: any) => ({ ...prev, floorsList: updated }));
                    }} 
                    className="w-full p-2 border rounded text-xs bg-white font-semibold"
                  >
                    <option value="Sq. Ft.">Sq. Ft. (वर्ग फीट)</option>
                    <option value="Sq. Mtr.">Sq. Mtr. (वर्ग मीटर)</option>
                    <option value="Acre">Acre (एकड़)</option>
                    <option value="Hectare">Hectare (हेक्टेयर)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-1">TYPE OF CONSTRUCTION</label>
                  <select 
                    value={floor.constructionType || "RCC Frame Structure"} 
                    onChange={(e) => {
                      const updated = [...formData.floorsList];
                      updated[index].constructionType = e.target.value;
                      setFormData((prev: any) => ({ ...prev, floorsList: updated }));
                    }} 
                    className="w-full p-2 border rounded text-xs bg-white font-semibold"
                  >
                    <option value="RCC Frame Structure">RCC Frame Structure (आरसीसी)</option>
                    <option value="Load Bearing Structure">Load Bearing Structure (लोकल निर्माण)</option>
                    <option value="Tin Shed / Temporary Structure">Tin Shed / Temporary Structure</option>
                    <option value="Commercial Shop Structure">Commercial Shop Structure</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Four Boundaries: 2x2 Layout */}
      <div className="pt-2 border-t border-gray-200">
        <label className="block text-[11px] font-black text-blue-900 uppercase mb-2">
          चतुःसीमा विवरण (Four Boundaries - 2x2 Layout)
        </label>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-600 mb-1">EAST (पूर्व)</label>
            <input 
              type="text" 
              name="boundaryEast" 
              required 
              placeholder="e.g. 9.00 मीटर वाईड रोड / अन्य प्लॉट" 
              value={formData.boundaryEast} 
              onChange={handleChange} 
              className="w-full p-2.5 border rounded text-sm bg-white font-medium" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-600 mb-1">WEST (पश्चिम)</label>
            <input 
              type="text" 
              name="boundaryWest" 
              required 
              placeholder="e.g. अन्य की संपत्ति / प्लॉट नं. 82" 
              value={formData.boundaryWest} 
              onChange={handleChange} 
              className="w-full p-2.5 border rounded text-sm bg-white font-medium" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-600 mb-1">NORTH (उत्तर)</label>
            <input 
              type="text" 
              name="boundaryNorth" 
              required 
              placeholder="e.g. प्लॉट नं. 75" 
              value={formData.boundaryNorth} 
              onChange={handleChange} 
              className="w-full p-2.5 border rounded text-sm bg-white font-medium" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-600 mb-1">SOUTH (दक्षिण)</label>
            <input 
              type="text" 
              name="boundarySouth" 
              required 
              placeholder="e.g. 30 फीट चौड़ा मार्ग" 
              value={formData.boundarySouth} 
              onChange={handleChange} 
              className="w-full p-2.5 border rounded text-sm bg-white font-medium" 
            />
          </div>
        </div>
      </div>

    </div>
  );
}