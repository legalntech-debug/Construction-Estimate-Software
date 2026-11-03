"use client";
// Route Map / Location Plan - input form.
//
// Folder layout:
//   page.tsx                          form state, validation and the hand over to /route-map-preview
//   formTypes.ts / formConstants.ts   shared types and constants
//   formHelpers.ts                    coordinate validation and storage clean-up
//   components/ClientFeeFields.tsx    case type, fee, client and representative
//   components/GeoCoordinateSection.tsx  latitude / longitude
//   components/BoundariesSection.tsx  four boundaries and side lengths
//   components/EyeIcon.tsx            icon of the client fields toggle
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isRealRef, isNameAddressChangeMajor } from "@/lib/estimateRules";
import type { Boundaries } from "./formTypes";
import {
  BOUNDARY_ROWS,
  CLIENT_FIELDS_PREF_KEY,
  EMPTY_BOUNDARIES,
  HISTORY_ACTION_TYPE,
  PREVIEW_LOCATION_BOUND_KEYS,
  PREVIEW_OWNED_KEYS,
  RETURN_TO_FORM_FLAG,
  ROUTE_MAP_STORAGE_KEYS,
  ROUTE_MAP_TYPE,
} from "./formConstants";
import { clearSavedRouteMap, isValidLatitude, isValidLongitude, sanitizeCoordinate } from "./formHelpers";
import ClientFeeFields from "./components/ClientFeeFields";
import GeoCoordinateSection from "./components/GeoCoordinateSection";
import BoundariesSection from "./components/BoundariesSection";

export default function RouteMapInputPage() {
  const router = useRouter();

  const [clients, setClients] = useState<any[]>([]);
  const [representative, setRepresentative] = useState("");
  const [filteredReps, setFilteredReps] = useState<string[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [allRepresentatives, setAllRepresentatives] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [plotArea, setPlotArea] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [boundaries, setBoundaries] = useState<Boundaries>(EMPTY_BOUNDARIES);
  // Optional length (ft) of every plot side, drawn as dimension lines on the preview sheet
  const [sideDims, setSideDims] = useState<Boundaries>(EMPTY_BOUNDARIES);
  const [feeMode, setFeeMode] = useState("AUTO");
  const [manualFee, setManualFee] = useState<number>(0);
  const [registeredFee, setRegisteredFee] = useState<number>(0);

  // Leave-the-form guard: saved data is wiped when the user leaves, except when moving on to the preview page
  const goingToPreviewRef = useRef(false);
  const isMountedRef = useRef(false);

  // Optional Client Name / Representative fields: hidden by default, preference is remembered
  const [showClientFields, setShowClientFields] = useState(false);
  // Client details are mandatory only while the fields are visible or partially filled
  const clientRequired = showClientFields || selectedClientName.trim() !== "" || representative.trim() !== "";

  const toggleClientFields = () => {
    const next = !showClientFields;
    setShowClientFields(next);
    try { localStorage.setItem(CLIENT_FIELDS_PREF_KEY, next ? "1" : "0"); } catch {}
  };

  useEffect(() => {
    try {
      if (localStorage.getItem(CLIENT_FIELDS_PREF_KEY) === "1") setShowClientFields(true);
    } catch {}
  }, []);

  // Clear the saved route map data when the user leaves the input form (dashboard, another service, ...).
  // It is kept only when the form hands over to the preview page; the preview page then decides what to keep.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Deferred so that a React strict-mode remount (isMountedRef becomes true again) does not wipe the data
      setTimeout(() => {
        if (!isMountedRef.current && !goingToPreviewRef.current) clearSavedRouteMap();
      }, 0);
    };
  }, []);

  // Restore previously entered data (reopen flow or Back to Input from the preview page)
  useEffect(() => {
    const savedData = localStorage.getItem("routeMapData") || localStorage.getItem("routeMapPreview");
    if (!savedData) return;
    try {
      const parsed = JSON.parse(savedData);

      // Never load another service's data
      if (parsed.estimate_type && parsed.estimate_type !== ROUTE_MAP_TYPE) return;

      // A finished (paid) route map is only reloaded when the user explicitly came back from the preview page.
      // A fresh visit (new service, new session, reopened tab) must start with an empty form.
      const isFinished = parsed.is_paid === true || parsed.payment_status === "paid";
      const cameBackFromPreview = sessionStorage.getItem(RETURN_TO_FORM_FLAG) === "1";
      // Data explicitly placed under "routeMapData" (e.g. by a reopen flow) is never discarded here
      const isReopenData = !!localStorage.getItem("routeMapData");
      if (isFinished && !cameBackFromPreview && !isReopenData) {
        ROUTE_MAP_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
        return;
      }

      setCustomerName(parsed.customer_name || "");
      setPropertyAddress(parsed.property_address || "");
      setPlotArea(parsed.plot_area?.toString() || "");
      setLatitude(parsed.latitude?.toString() || "");
      setLongitude(parsed.longitude?.toString() || "");
      setBoundaries({ ...EMPTY_BOUNDARIES, ...(parsed.boundaries || {}) });
      setSideDims({ ...EMPTY_BOUNDARIES, ...(parsed.side_dims || {}) });
      setSelectedClientName(parsed.client_name || parsed.selected_client_name || "");
      setRepresentative(parsed.representative || "");
      // A restored record that already has client details must show them
      if (parsed.client_name || parsed.selected_client_name || parsed.representative) setShowClientFields(true);
      setFeeMode(parsed.fee_mode || "AUTO");
      if (parsed.fee_amount) setManualFee(parsed.fee_amount);
    } catch (e) {
      console.error("Failed to parse saved route map data:", e);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const { data: clientsTable, error } = await supabase
        .from("clients")
        .select("client_name, representative_name");

      if (error) {
        console.error("Error fetching clients:", error);
        return;
      }

      const combined = clientsTable || [];
      setClients(combined);

      const representatives = combined
        .map((c) => c.representative_name)
        .filter((name): name is string => typeof name === "string" && name.trim() !== "");

      const uniqueReps = Array.from(new Set(representatives)) as string[];

      setAllRepresentatives(uniqueReps);
      setFilteredReps(uniqueReps);
    };
    fetchData();
  }, []);

  const handleClientChange = (name: string) => {
    setSelectedClientName(name);

    const matches: string[] = clients
      .filter((c: any) => c.client_name === name && c.representative_name)
      .map((c: any) => c.representative_name as string);

    supabase.from("clients").select("estimate_fee").eq("client_name", name).maybeSingle()
      .then(({ data }) => setRegisteredFee(data?.estimate_fee || 0));

    if (matches.length > 0) {
      const uniqueReps = Array.from(new Set(matches)) as string[];
      setFilteredReps(uniqueReps);
      setRepresentative(uniqueReps.length === 1 ? uniqueReps[0] : "");
    } else {
      setFilteredReps(allRepresentatives);
      setRepresentative("");
    }
  };

  const handlePlotAreaChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9.]/g, "");
    const parts = cleanVal.split(".");
    setPlotArea(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleanVal);
  };

  // Accepts a pasted "lat, long" pair (as copied from Google Maps) in either coordinate field
  const handleCoordinateChange = (field: "lat" | "lng", val: string) => {
    const pair = val.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (pair) {
      setLatitude(pair[1]);
      setLongitude(pair[2]);
      return;
    }
    if (field === "lat") setLatitude(sanitizeCoordinate(val));
    else setLongitude(sanitizeCoordinate(val));
  };

  const handleBoundaryChange = (key: keyof Boundaries, val: string) => {
    setBoundaries((prev) => ({ ...prev, [key]: val }));
  };

  // Side length: digits and one decimal point only
  const handleSideDimChange = (key: keyof Boundaries, val: string) => {
    const cleanVal = val.replace(/[^0-9.]/g, "");
    const parts = cleanVal.split(".");
    setSideDims((prev) => ({ ...prev, [key]: parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleanVal }));
  };

  const handleGenerate = async () => {
    if (clientRequired && (!selectedClientName.trim() || !representative.trim())) {
      setShowClientFields(true);
      alert("Validation Error: Please select both Client Name and Representative.");
      return;
    }

    const storedData = JSON.parse(localStorage.getItem("routeMapData") || localStorage.getItem("routeMapPreview") || "{}");
    const plotAreaNum = parseFloat(plotArea.toString().replace(/,/g, "")) || 0;

    if (!customerName.trim() || !propertyAddress.trim() || plotAreaNum <= 0) {
      alert("Validation Error: Please fill in Customer Name, Property Address and Plot Area.");
      return;
    }

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      alert("Validation Error: Please enter valid Property Geo Coordinates (Latitude: -90 to 90, Longitude: -180 to 180).");
      return;
    }

    const missingBoundary = BOUNDARY_ROWS.find((b) => !boundaries[b.key].trim());
    if (missingBoundary) {
      alert(`Validation Error: Please fill the ${missingBoundary.label} boundary.`);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please login to generate route map.");
      return;
    }

    const finalFee = feeMode === "AUTO" ? registeredFee : manualFee;

    const cleanBoundaries: Boundaries = {
      east: boundaries.east.trim(),
      west: boundaries.west.trim(),
      north: boundaries.north.trim(),
      south: boundaries.south.trim(),
    };

    // Side lengths: keep only values greater than zero
    const cleanSideDims: Boundaries = {
      east: parseFloat(sideDims.east) > 0 ? sideDims.east.trim() : "",
      west: parseFloat(sideDims.west) > 0 ? sideDims.west.trim() : "",
      north: parseFloat(sideDims.north) > 0 ? sideDims.north.trim() : "",
      south: parseFloat(sideDims.south) > 0 ? sideDims.south.trim() : "",
    };

    const isSame =
      String(storedData.customer_name || "").trim() === String(customerName || "").trim() &&
      String(storedData.property_address || "").trim() === String(propertyAddress || "").trim() &&
      Number(storedData.plot_area || 0) === Number(plotArea || 0) &&
      String(storedData.latitude || "").trim() === latitude.trim() &&
      String(storedData.longitude || "").trim() === longitude.trim() &&
      String(storedData.client_name || "").trim() === String(selectedClientName || "").trim() &&
      String(storedData.representative || "").trim() === String(representative || "").trim() &&
      JSON.stringify(storedData.boundaries || {}) === JSON.stringify(cleanBoundaries) &&
      JSON.stringify({ ...EMPTY_BOUNDARIES, ...(storedData.side_dims || {}) }) === JSON.stringify(cleanSideDims);

    // Same business rule as the estimate flow (shared helper): name OR address changed beyond the limit => NEW record.
    // A new record must not inherit the old id / ref no, otherwise the preview would treat it as already paid.
    const hadRealRef = isRealRef(storedData.ref_no);
    const majorChange = hadRealRef && isNameAddressChangeMajor(
      { customer_name: storedData.customer_name, property_address: storedData.property_address },
      { customer_name: customerName, property_address: propertyAddress }
    );
    const needsNewRef = !hadRealRef || majorChange;
    const finalRefNo = needsNewRef ? "REF-" + Date.now() : storedData.ref_no;

    // Only edits of an existing ref no are counted / logged; a brand-new record starts with a clean history
    if (!isSame && hadRealRef && !majorChange) {
      const { count } = await supabase
        .from("estimate_history")
        .select("*", { count: "exact", head: true })
        .eq("ref_no", storedData.ref_no);

      if (count !== null && count >= 3) {
        alert("LIMIT REACHED: You cannot edit this route map more than 3 times.");
        return;
      }

      const { error: historyError } = await supabase.from("estimate_history").insert([{
        ref_no: finalRefNo,
        action_type: HISTORY_ACTION_TYPE,
        user_id: user.id,
        changes: JSON.stringify({
          client_name: selectedClientName,
          representative_name: representative,
          customer_name: customerName,
          property_address: propertyAddress,
          plot_area: plotArea,
          latitude,
          longitude,
          boundaries: cleanBoundaries,
          side_dims: cleanSideDims,
          fee: finalFee,
        }),
        created_at: new Date().toISOString(),
      }]);

      if (historyError) console.error("Error writing route map history:", historyError.message);
    }

    // Carry the preview page fields over when the same record is generated again
    const carried: Record<string, unknown> = {};
    if (!needsNewRef) {
      const coordsChanged =
        String(storedData.latitude || "").trim() !== latitude.trim() || String(storedData.longitude || "").trim() !== longitude.trim();
      PREVIEW_OWNED_KEYS.forEach((k) => {
        if (storedData[k] !== undefined) carried[k] = storedData[k];
      });
      if (!coordsChanged) {
        PREVIEW_LOCATION_BOUND_KEYS.forEach((k) => {
          if (storedData[k] !== undefined) carried[k] = storedData[k];
        });
      }
      // The signature time stays the same unless something on the form changed
      if (isSame && storedData.generated_at) carried.generated_at = storedData.generated_at;
    }

    const routeMapData = {
      ...carried,
      ref_no: finalRefNo,
      // Detach from the old record when this is a new route map (major name/address change)
      id: needsNewRef ? null : (storedData.id || null),
      // Tells the preview page that the decision is already made: new ref no + new payment required
      force_new_ref: majorChange,
      new_ref_reason: majorChange ? "NAME_ADDRESS_CHANGED" : null,
      previous_ref_no: majorChange ? storedData.ref_no : null,
      customer_name: customerName,
      client_name: selectedClientName,
      representative,
      property_address: propertyAddress,
      plot_area: plotArea,
      latitude: latitude.trim(),
      longitude: longitude.trim(),
      boundaries: cleanBoundaries,
      side_dims: cleanSideDims,
      fee_amount: finalFee,
      fee_mode: feeMode,
      estimate_type: ROUTE_MAP_TYPE,
    };

    localStorage.setItem("routeMapPreview", JSON.stringify(routeMapData));
    // The preview page needs the saved data; do not wipe it while navigating there
    goingToPreviewRef.current = true;
    router.push("/route-map-preview");
  };

  const handleClear = () => {
    clearSavedRouteMap();
    setCustomerName("");
    setPropertyAddress("");
    setPlotArea("");
    setLatitude("");
    setLongitude("");
    setBoundaries(EMPTY_BOUNDARIES);
    setSideDims(EMPTY_BOUNDARIES);
    setSelectedClientName("");
    setRepresentative("");
  };

  // Progressive unlock: each section opens only after the previous one is filled
  const isClientFilled = !clientRequired || (selectedClientName.trim() !== "" && representative.trim() !== "");
  const isCustomerFilled = isClientFilled && customerName.trim() !== "";
  const isAddressFilled = isCustomerFilled && propertyAddress.trim() !== "";
  const isPlotFilled = isAddressFilled && plotArea.trim() !== "";
  const isGeoFilled = isPlotFilled && isValidLatitude(latitude) && isValidLongitude(longitude);

  const mapsLink = isGeoFilled ? `https://www.google.com/maps?q=${latitude.trim()},${longitude.trim()}` : "";

  return (
    <div className="relative w-full max-w-5xl mx-auto p-2 sm:p-6 font-sans uppercase text-sm sm:text-lg text-black border border-black bg-white shadow-lg leading-tight overflow-x-auto">

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center border-2 border-black bg-gray-100 p-3 mb-4 gap-2">
        <div className="hidden sm:block w-24"></div>
        <h1 className="text-xl sm:text-2xl font-bold text-center flex-1">ROUTE MAP / LOCATION PLAN INPUT FORM</h1>
        <div>
          <label className="bg-black text-white px-3 py-1.5 font-bold text-xs sm:text-base uppercase cursor-pointer hover:bg-gray-800 flex items-center gap-1 shadow">
            📁 UPLOAD DOC / AI SCAN
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  alert(`Document "${file.name}" uploaded successfully!`);
                }
              }}
            />
          </label>
        </div>
      </div>

      <style>{`
        @keyframes rmReveal { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        @keyframes rmBlink { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.1); } }
        .rm-reveal { animation: rmReveal 0.25s ease-out both; }
        .rm-eye-btn:hover svg { animation: rmBlink 0.45s ease-in-out; }
        @media (prefers-reduced-motion: reduce) { .rm-reveal, .rm-eye-btn:hover svg { animation: none; } }
      `}</style>

      <ClientFeeFields
        feeMode={feeMode}
        setFeeMode={setFeeMode}
        manualFee={manualFee}
        setManualFee={setManualFee}
        showClientFields={showClientFields}
        toggleClientFields={toggleClientFields}
        clients={clients}
        selectedClientName={selectedClientName}
        handleClientChange={handleClientChange}
        representative={representative}
        setRepresentative={setRepresentative}
        filteredReps={filteredReps}
      />

      {/* Customer Name & Property Address */}
      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 md:gap-4">
          <label className="col-span-1 md:col-span-3 font-bold text-sm sm:text-lg border border-black p-2.5 bg-gray-100">CUSTOMER NAME</label>
          <textarea
            value={customerName}
            disabled={!isClientFilled}
            onChange={(e) => {
              setCustomerName(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            className={`col-span-1 md:col-span-9 border border-black p-2.5 uppercase text-left text-sm sm:text-lg resize-y overflow-hidden placeholder:text-gray-400 placeholder:normal-case ${!isClientFilled ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
            rows={1}
            placeholder="FILL HERE (e.g. Mr. Ram Vishvas Patel, s/o Mr. Jhalle Prasad Patel)"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 md:gap-4">
          <label className="col-span-1 md:col-span-3 font-bold text-sm sm:text-lg border border-black p-2.5 bg-gray-100">PROPERTY ADDRESS</label>
          <textarea
            value={propertyAddress}
            disabled={!isCustomerFilled}
            onChange={(e) => {
              setPropertyAddress(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            className={`col-span-1 md:col-span-9 border border-black p-2.5 uppercase text-left text-sm sm:text-lg resize-y overflow-hidden placeholder:text-gray-400 placeholder:normal-case ${!isCustomerFilled ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
            rows={2}
            placeholder="FILL HERE (e.g. Khasra No. 331/2/3, Vill. Ragla, Tehsil Uchahara, Distt. Satna, State MP)"
          />
        </div>
      </div>

      {/* Plot Area */}
      <div className={`grid grid-cols-12 gap-2 md:gap-4 mb-2 items-center border-t border-black pt-3 ${!isAddressFilled ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="col-span-12 md:col-span-4">
          <label className="font-bold block text-[11px] sm:text-lg truncate">PLOT AREA</label>
          <div className="relative flex items-center">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              disabled={!isAddressFilled}
              value={plotArea}
              onChange={(e) => handlePlotAreaChange(e.target.value)}
              className="w-full border border-black p-2 uppercase text-center text-sm sm:text-lg"
            />
            <span className="absolute right-2 text-black font-bold text-[9px] sm:text-base pointer-events-none">SQ. FT</span>
          </div>
        </div>
      </div>

      <GeoCoordinateSection
        isPlotFilled={isPlotFilled}
        latitude={latitude}
        longitude={longitude}
        handleCoordinateChange={handleCoordinateChange}
        mapsLink={mapsLink}
      />

      <BoundariesSection
        isGeoFilled={isGeoFilled}
        boundaries={boundaries}
        sideDims={sideDims}
        handleBoundaryChange={handleBoundaryChange}
        handleSideDimChange={handleSideDimChange}
      />

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 border-t border-black pt-4 mt-4">
        <button
          onClick={handleGenerate}
          className="bg-black text-white px-6 py-3 font-bold uppercase text-sm sm:text-lg w-full sm:w-auto hover:bg-gray-800"
        >
          GENERATE ROUTE MAP
        </button>
        <button
          onClick={handleClear}
          className="bg-red-600 text-white px-6 py-3 font-bold uppercase text-sm sm:text-lg w-full sm:w-auto hover:bg-red-700"
        >
          Clear Data
        </button>
      </div>
    </div>
  );
}
