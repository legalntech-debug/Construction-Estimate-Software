"use client";
// Latitude / longitude inputs of the property (paste "lat, long" from a map in either box).

interface GeoCoordinateSectionProps {
  // True once the previous sections are filled; the section stays locked until then
  isPlotFilled: boolean;
  latitude: string;
  longitude: string;
  handleCoordinateChange: (field: "lat" | "lng", value: string) => void;
  mapsLink: string;
}

export default function GeoCoordinateSection({ isPlotFilled, latitude, longitude, handleCoordinateChange, mapsLink }: GeoCoordinateSectionProps) {
  return (
    <div className={`mt-4 border border-black rounded-none overflow-hidden ${!isPlotFilled ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="bg-[#1e293b] text-white py-2.5 font-bold uppercase tracking-wider text-center text-sm sm:text-lg">PROPERTY GEO COORDINATE</div>
          <div className="grid grid-cols-1 sm:grid-cols-12 items-stretch">
            <div className="sm:col-span-4 border-b sm:border-b-0 sm:border-r border-black p-2">
              <label className="font-bold block text-xs sm:text-base">LATITUDE</label>
              <input
                type="text"
                inputMode="decimal"
                disabled={!isPlotFilled}
                value={latitude}
                onChange={(e) => handleCoordinateChange("lat", e.target.value)}
                placeholder="24.365755"
                className="w-full border border-black p-2 text-center text-sm sm:text-lg"
              />
            </div>
            <div className="sm:col-span-4 border-b sm:border-b-0 sm:border-r border-black p-2">
              <label className="font-bold block text-xs sm:text-base">LONGITUDE</label>
              <input
                type="text"
                inputMode="decimal"
                disabled={!isPlotFilled}
                value={longitude}
                onChange={(e) => handleCoordinateChange("lng", e.target.value)}
                placeholder="80.793211"
                className="w-full border border-black p-2 text-center text-sm sm:text-lg"
              />
            </div>
            <div className="sm:col-span-4 p-2 flex flex-col justify-end">
              {mapsLink ? (
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full border border-black bg-gray-100 hover:bg-gray-200 p-2 text-center font-bold text-xs sm:text-base"
                >
                  📍 VERIFY ON MAP
                </a>
              ) : (
                <div className="w-full border border-dashed border-black p-2 text-center text-[10px] sm:text-sm text-gray-500 normal-case">
                  Paste "lat, long" from Google Maps in either box
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
