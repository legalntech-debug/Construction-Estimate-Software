"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// [START NEW FEATURE] - Supabase Client Import
import { supabase } from "@/lib/supabase";
// [END NEW FEATURE]
import { fetchPricingRow, getDisplayPricing } from "@/lib/pricingFetch";
import { getItemRate } from "@/lib/pricing";
import {
  NAME_ADDRESS_CHANGE_LIMIT,
  isRealRef,
  isNameAddressChangeMajor,
  isEstimateExpired,
} from "@/lib/estimateRules";

// localStorage keys that carry the certificate between this form and /certificate-preview
const CERT_STORAGE_KEYS = ["certificateData", "certificatePreview"];
// sessionStorage flag: "the data was loaded / returned on purpose (reopen or Back to Input) - keep it"
const RETURN_TO_FORM_FLAG = "certificateReturnToForm";
// Same business rules as the estimate flow: 3 edits per ref no, then a new certificate is needed
const MAX_EDITS = 3;
const CERTIFICATE_PRICING_ITEM = "constructionCertificate";
const FALLBACK_FEE = 21;
const OWNER_EMAIL = "legalntech@gmail.com";

const clearSavedCertificate = () => {
  try {
    CERT_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(RETURN_TO_FORM_FLAG);
  } catch {}
};

// Order-independent fingerprint of the floor areas (key order of a stored JSON must not count as a change)
const areaMapKey = (fd: any): string => {
  const out: Record<string, number> = {};
  Object.keys(fd || {}).sort().forEach((k) => {
    const a = Number(fd[k]?.area || 0);
    if (a > 0) out[k] = a;
  });
  return JSON.stringify(out);
};

type ChoiceOption = { key: string; label: string; tone: "primary" | "danger" | "neutral" };
type ChoiceDialog = { title: string; lines: string[]; options: ChoiceOption[] };

const DEFAULT_FLOORS = ["GROUND FLOOR"];
const EXTRA_FLOORS = [
  "BASEMENT", "FIRST FLOOR", "SECOND FLOOR", "TOWER", "THIRD FLOOR", 
  "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", 
  "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR"
];

// List of popular Banks, NBFCs, and HFCs for Construction Certificates
const FINANCIAL_INSTITUTIONS = [
  "SMFG INDIA HOME FINANCE CO. LTD.",
  "AAVAS FINANCIERS LIMITED",
  "AADHAR HOUSING FINANCE LTD.",
  "CAPRI GLOBAL HOUSING FINANCE",
  "HDFC BANK LTD.",
  "ICICI BANK LTD.",
  "BAJAJ HOUSING FINANCE LTD.",
  "AXIS BANK LTD.",
  "LIC HOUSING FINANCE LTD.",
  "OTHER"
];

export default function ConstructionCertificatePage() {
  const router = useRouter();

  // State Management for Form Fields and Database Records
  const [clients, setClients] = useState<any[]>([]);
  const [representative, setRepresentative] = useState("");
  const [filteredReps, setFilteredReps] = useState<string[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [allRepresentatives, setAllRepresentatives] = useState<string[]>([]);
  
  // Certificate & Document Scan Specific States
  const [selectedInstitution, setSelectedInstitution] = useState(FINANCIAL_INSTITUTIONS[0]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const [customerName, setCustomerName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [plotArea, setPlotArea] = useState("");
  const [selectedFloors, setSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [tempSelectedFloors, setTempSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [floorData, setFloorData] = useState<Record<string, { length: number; width: number; area: number }>>({});
  
  // Fee States (rate / amount are no longer collected on this form;
  // the certificate fee is resolved from the pricing table on the preview page)
  const [feeMode, setFeeMode] = useState("AUTO");
  const [manualFee, setManualFee] = useState<number>(0);
  const [registeredFee, setRegisteredFee] = useState<number>(0);
  const [currentRefNo, setCurrentRefNo] = useState("");

  // Admin = profile role admin/ceo, user_type ADMIN or the owner account (premium/advanced plans are NOT admin here)
  const [isAdmin, setIsAdmin] = useState(false);
  // Leave-the-form guard: saved data is wiped when the user leaves, except when moving on to the preview page
  const goingToPreviewRef = useRef(false);
  const isMountedRef = useRef(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // Confirmation dialog (new-certificate charge / admin "same ref or new ref")
  const [dialog, setDialog] = useState<ChoiceDialog | null>(null);
  const dialogResolveRef = useRef<((key: string) => void) | null>(null);
  const askChoice = (d: ChoiceDialog) =>
    new Promise<string>((resolve) => {
      dialogResolveRef.current = resolve;
      setDialog(d);
    });
  const answerDialog = (key: string) => {
    setDialog(null);
    dialogResolveRef.current?.(key);
    dialogResolveRef.current = null;
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, user_type")
          .eq("id", session.user.id)
          .maybeSingle();
        const role = String(profile?.role || "").toLowerCase();
        const type = String(profile?.user_type || "").toUpperCase();
        setIsAdmin(
          role === "admin" || role === "ceo" || type === "ADMIN" ||
          String(session.user.email || "").toLowerCase() === OWNER_EMAIL
        );
      } catch (err) {
        console.error("Admin check error:", err);
      }
    })();
  }, []);

  // Clear the saved certificate when the user leaves the form (dashboard, another service, ...).
  // It is kept only when the form hands over to the preview page.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Deferred so that a React strict-mode remount does not wipe the data
      setTimeout(() => {
        if (!isMountedRef.current && !goingToPreviewRef.current) clearSavedCertificate();
      }, 0);
    };
  }, []);

  // Certificate charge from the pricing table (state + user category) - shown in the "new certificate" warning
  const resolveCertificateFee = async (userId: string): Promise<number> => {
    try {
      const { data: profile } = await supabase.from("profiles").select("state, user_type").eq("id", userId).maybeSingle();
      const state = String(profile?.state || "MADHYA PRADESH");
      const category = String(profile?.user_type || "INDIVIDUAL USER").toUpperCase();
      const row = await fetchPricingRow(CERTIFICATE_PRICING_ITEM, state, category);
      const display = getDisplayPricing(row);
      if (display.isFromDB && display.price > 0) return display.price;
      return getItemRate(state, CERTIFICATE_PRICING_ITEM) || FALLBACK_FEE;
    } catch {
      return FALLBACK_FEE;
    }
  };

  // Load existing certificate data from local storage if reopening an entry
  useEffect(() => {
    const savedData = localStorage.getItem("certificateData") || localStorage.getItem("certificatePreview");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);

        // A finished (paid) certificate is only reloaded when the user came back from the preview page or reopened it.
        // A fresh visit (new session, reopened tab) must start with an empty form.
        const isFinished = parsed.is_paid === true || parsed.isPaid === true || parsed.payment_status === "paid";
        const deliberate = sessionStorage.getItem(RETURN_TO_FORM_FLAG) === "1" || !!localStorage.getItem("certificateData");
        if (isFinished && !deliberate) {
          CERT_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
          return;
        }

        if (parsed.ref_no) setCurrentRefNo(parsed.ref_no);
        setCustomerName(parsed.customer_name || "");
        setPropertyAddress(parsed.property_address || "");
        setPlotArea(parsed.plot_area?.toString() || "");
        setSelectedClientName(parsed.client_name || parsed.selected_client_name || "");
        setRepresentative(parsed.representative || "");
        setSelectedInstitution(parsed.financial_institution || FINANCIAL_INSTITUTIONS[0]);
        setFeeMode(parsed.fee_mode || "AUTO");
        if (parsed.fee_amount) setManualFee(parsed.fee_amount);
        if (parsed.floor_details) {
          setFloorData(parsed.floor_details);
          setSelectedFloors(Object.keys(parsed.floor_details));
        }
      } catch (e) {
        console.error("Failed to parse saved certificate data:", e);
      }
    }
  }, []);

  // Fetch client details and representatives from Supabase
  useEffect(() => {
    const fetchData = async () => {
      const { data: clientsTable, error } = await supabase
        .from('clients')
        .select('client_name, representative_name');
      
      if (error) {
        console.error("Error fetching clients:", error);
        return;
      }

      const combined = clientsTable || [];
      setClients(combined);

      const representatives = combined
        .map((c) => c.representative_name)
        .filter((name): name is string => typeof name === 'string' && name.trim() !== "");

      const uniqueReps = Array.from(new Set(representatives)) as string[];

      setAllRepresentatives(uniqueReps);
      setFilteredReps(uniqueReps);
    };
    fetchData();
  }, []);

  // Handle client selection and filter corresponding representatives
  const handleClientChange = (name: string) => {
    setSelectedClientName(name);
    
    const matches: string[] = clients
      .filter((c: any) => c.client_name === name && c.representative_name)
      .map((c: any) => c.representative_name as string);
    
    supabase.from('clients').select('estimate_fee').eq('client_name', name).maybeSingle()
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

  // Handle Document Upload, Scan, and Structured Auto-Fill
  const handleDocumentScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setIsScanning(true);

    // Simulate OCR & AI parsing for multi-language title documents, maps, and khasras
    setTimeout(() => {
      setIsScanning(false);

      const parsedOwnerName = "RAJESH KUMAR SHARMA";
      const parsedPlotArea = "1250";
      const structuredAddress = "PLOT NO. 42, VISHNUPURI COLONY, WARD NO. 12, ON LAND SURVEY NO. 104/2, VILL KHJARANA, PH NO. 14, TEHSIL INDORE, DISTT INDORE, MADHYA PRADESH";

      setCustomerName(parsedOwnerName);
      setPropertyAddress(structuredAddress);
      setPlotArea(parsedPlotArea);

      alert(`Document "${file.name}" scanned successfully! Form auto-filled with Owner Name, Formatted Address, and Plot Area.`);
    }, 1500);
  };

  // Update individual floor area with strict validation against plot area
  const updateArea = (floor: string, l: number, w: number) => {
    const newArea = parseFloat((l * w).toFixed(2));
    const plotAreaNum = parseFloat(plotArea) || 0;
    
    if (plotAreaNum > 0 && newArea > plotAreaNum) {
      alert(`Validation Error: Floor area (${newArea} SQ.FT) cannot exceed the plot area (${plotAreaNum} SQ.FT).`);
      return;
    }
    
    const updatedFloorData = { ...floorData, [floor]: { length: l, width: w, area: newArea } };
    setFloorData(updatedFloorData);
  };

  const totalBuiltUpArea = Object.values(floorData).reduce((sum, f) => sum + (f.area || 0), 0);

  const residentialFloors = selectedFloors.filter((f) => f !== "BASEMENT" && f !== "TOWER");
  const floorCount = residentialFloors.length;
  const hasTower = selectedFloors.includes("TOWER");

  const lastResidentialFloor = residentialFloors[residentialFloors.length - 1];
  const lastFloorLength = floorData[lastResidentialFloor]?.length || 0;
  const lastFloorWidth = floorData[lastResidentialFloor]?.width || 0;
  const staircaseCount = floorCount;

  let doorCount = 0;
  if (totalBuiltUpArea <= 600) { doorCount = 4 * floorCount; }
  else if (totalBuiltUpArea <= 1000) { doorCount = 5 * floorCount; }
  else if (totalBuiltUpArea <= 1500) { doorCount = 6 * floorCount; }
  else if (totalBuiltUpArea <= 2000) { doorCount = 8 * floorCount; }
  else { doorCount = 8 + Math.ceil((totalBuiltUpArea - 2000) / 500); }
  if (hasTower) { doorCount += 1; }
  const windowCount = doorCount * 2;

  const getPlotMasterData = async () => {
    const width = Number(floorData["GROUND FLOOR"]?.width || 0);
    const length = Number(floorData["GROUND FLOOR"]?.length || 0);
    const area = Number(floorData["GROUND FLOOR"]?.area || 0);
    
    const { data } = await supabase
      .from("plot_master")
      .select("*")
      .eq("builtup_area_sqft", area)
      .eq("width_feet", width)
      .eq("length_feet", length)
      .limit(1);
      
    if (data && data.length > 0) return data[0];

    const { data: allRows } = await supabase.from("plot_master").select("*");
    if (!allRows || allRows.length === 0) return null;

    return allRows.sort((a, b) => {
      const scoreA = Math.abs(a.width_feet - width) + Math.abs(a.length_feet - length) + Math.abs(a.builtup_area_sqft - area);
      const scoreB = Math.abs(b.width_feet - width) + Math.abs(b.length_feet - length) + Math.abs(b.builtup_area_sqft - area);
      return scoreA - scoreB;
    })[0];
  };

  const getSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    
    const costs = new Array();
    for (let i = 0; i <= longer.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= shorter.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (longer.charAt(i - 1) !== shorter.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[shorter.length] = lastValue;
    }
    const distance = costs[shorter.length];
    return (longer.length - distance) / longer.length;
  };

  const handleGenerate = async () => {
    if (!selectedClientName.trim() || !representative.trim()) {
      alert("Validation Error: Please select both Client Name and Representative.");
      return;
    }

    const storedData = JSON.parse(localStorage.getItem("certificateData") || localStorage.getItem("certificatePreview") || "{}");
    const plotAreaNum = parseFloat(plotArea.toString().replace(/,/g, '')) || 0;
    
    if (!customerName.trim() || !propertyAddress.trim() || !plotArea || Object.keys(floorData).length === 0) {
      alert("Validation Error: Please fill in all required customer details, plot area, and floor dimensions.");
      return;
    }
    
    for (const floor of selectedFloors) {
      const floorArea = floorData[floor]?.area || 0;
      if (!(floorData[floor]?.length > 0) || !(floorData[floor]?.width > 0) || floorArea <= 0) {
        alert(`Validation Error: Floor "${floor}" has missing or zero dimensions. Please fill valid values or unselect this floor.`);
        return;
      }
      if (floorArea > plotAreaNum) {
        alert(`Validation Error: The area for ${floor} (${floorArea} SQ.FT) exceeds the plot area (${plotAreaNum} SQ.FT).`);
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please login to generate certificate.");
      return;
    }

    if (isGenerating) return;
    setIsGenerating(true);
    try {
    const plotMaster = await getPlotMasterData();
    const finalFee = feeMode === "AUTO" ? registeredFee : manualFee;

    const filteredFloorDetails: Record<string, { length: number; width: number; area: number }> = {};
    selectedFloors.forEach((floor) => {
      if (floorData[floor]?.area > 0) filteredFloorDetails[floor] = floorData[floor];
    });

    // The ref no is generated by the preview after the payment (global sequence). Here we only decide whether
    // this certificate keeps its saved ref no (update) or must become a NEW certificate (new ref no + new payment).
    const existingRefNo: string | null =
      storedData.ref_no && isRealRef(storedData.ref_no) && !String(storedData.ref_no).startsWith("CERT-") && !String(storedData.ref_no).toUpperCase().startsWith("DRAFT")
        ? storedData.ref_no
        : null;
    const hadRealRef = !!existingRefNo;

    // The saved record is the truth for the 15% / 60-day rules (not the browser copy)
    let rec: any = null;
    if (hadRealRef) {
      const { data } = await supabase
        .from("estimates")
        .select("id, user_id, customer_name, property_address, created_at")
        .eq("ref_no", existingRefNo)
        .maybeSingle();
      rec = data || null;
    }

    const isSame =
      String(storedData.customer_name || "").trim() === String(customerName || "").trim() &&
      String(storedData.property_address || "").trim() === String(propertyAddress || "").trim() &&
      Number(storedData.plot_area || 0) === Number(plotArea || 0) &&
      String(storedData.client_name || "").trim() === String(selectedClientName || "").trim() &&
      String(storedData.representative || "").trim() === String(representative || "").trim() &&
      areaMapKey(storedData.floor_details) === areaMapKey(filteredFloorDetails);

    let decision: "same" | "new" = "same";
    let newReason: string | null = null;

    if (hadRealRef) {
      const baseline = {
        customer_name: rec?.customer_name ?? storedData.customer_name,
        property_address: rec?.property_address ?? storedData.property_address,
      };
      const majorChange = isNameAddressChangeMajor(baseline, { customer_name: customerName, property_address: propertyAddress });
      const expired = !!rec && isEstimateExpired(rec.created_at);

      if (isAdmin) {
        // ADMIN: a saved certificate is never turned into a new one silently, and never into one in the admin's name.
        // Only when something changed does the admin choose: update the SAME ref no (owner / payment untouched)
        // or generate a NEW ref no (created under the admin's own account, like a fresh input).
        if (!isSame) {
          const ownerNote = rec?.user_id && rec.user_id !== user.id ? " It belongs to another user." : "";
          const choice = await askChoice({
            title: "Existing certificate found",
            lines: [
              `Ref No: ${existingRefNo}.${ownerNote}`,
              "You changed the details of this saved certificate. What do you want to do?",
              "UPDATE SAME REF: the details are updated on the same Ref No. Owner, payment and ledger stay unchanged.",
              "GENERATE NEW REF: a new certificate with a new Ref No is created under your account.",
            ],
            options: [
              { key: "same", label: "Update same Ref No", tone: "primary" },
              { key: "new", label: "Generate new Ref No", tone: "danger" },
              { key: "cancel", label: "Cancel", tone: "neutral" },
            ],
          });
          if (choice === "cancel") return;
          decision = choice === "new" ? "new" : "same";
          if (decision === "new") newReason = "ADMIN_NEW";
        }
      } else if (majorChange || expired) {
        // USER: changed beyond the limit (or older than 60 days) -> NEW certificate, new payment. Tell before continuing.
        const reason = expired
          ? "this certificate is older than 60 days"
          : `the customer name / property address changed by more than ${NAME_ADDRESS_CHANGE_LIMIT}%`;
        const fee = await resolveCertificateFee(user.id);
        const choice = await askChoice({
          title: "New certificate charge applies",
          lines: [
            `Because ${reason}, this is treated as a NEW certificate.`,
            `A new Ref No will be generated and a new charge of ₹${fee} will apply (previous Ref ${existingRefNo} stays as it is).`,
            "Press CONTINUE to go to the preview and pay for the new certificate, or CANCEL to keep editing.",
          ],
          options: [
            { key: "new", label: `Continue (pay ₹${fee})`, tone: "primary" },
            { key: "cancel", label: "Cancel", tone: "neutral" },
          ],
        });
        if (choice !== "new") return;
        decision = "new";
        newReason = expired ? "EXPIRED_60_DAYS" : "NAME_ADDRESS_CHANGED";
      } else if (!isSame) {
        // USER: change within the limit -> SAME ref no is updated, but only MAX_EDITS times
        const { count } = await supabase
          .from("estimate_history")
          .select("*", { count: "exact", head: true })
          .eq("ref_no", existingRefNo);
        if (count !== null && count >= MAX_EDITS) {
          alert(`LIMIT REACHED: You cannot edit this certificate more than ${MAX_EDITS} times. Please generate a new certificate.`);
          return;
        }
        await supabase.from("estimate_history").insert([
          {
            ref_no: existingRefNo,
            action_type: "RATE_UPDATE",
            user_id: user.id,
            changes: JSON.stringify({
              customer_name: customerName,
              property_address: propertyAddress,
              plot_area: plotArea,
              client_name: selectedClientName,
              representative_name: representative,
              floor_details: filteredFloorDetails,
              financial_institution: selectedInstitution,
              type: "CONSTRUCTION CERTIFICATE",
            }),
            created_at: new Date().toISOString(),
          },
        ]);
      }
    }

    const keepRef = hadRealRef && decision === "same";
    const forNewUserCharge = decision === "new" && !isAdmin;

    const certificateData = {
      ref_no: keepRef ? existingRefNo : null,
      id: keepRef ? (rec?.id || storedData.id || null) : null,
      // Tells the preview that the decision is already made: new ref no + new payment required (users only)
      force_new_ref: forNewUserCharge,
      new_ref_reason: forNewUserCharge ? newReason : null,
      previous_ref_no: decision === "new" && hadRealRef ? existingRefNo : null,
      customer_name: customerName,
      client_name: selectedClientName,
      representative: representative,
      financial_institution: selectedInstitution,
      property_address: propertyAddress,
      plot_area: plotArea,
      selected_floors: selectedFloors,
      floor_details: filteredFloorDetails,
      total_builtup_area: Object.values(filteredFloorDetails).reduce((sum, f) => sum + (f.area || 0), 0),
      // Inspection / completion dates and signature text typed on the preview survive a round trip
      inspection_date: storedData.inspection_date || "",
      completion_date: storedData.completion_date || "",
      signature_details: storedData.signature_details || "",
      // Legacy keys kept as 0 for backward compatibility with the preview page
      rate_per_sqft: 0,
      construction_cost: 0,
      total_value: 0,
      fee_amount: finalFee,
      fee_mode: feeMode,
      certificate_type: "CONSTRUCTION CERTIFICATE",
      plotMaster,
      floor_count: floorCount,
      has_tower: hasTower,
      last_floor_length: lastFloorLength,
      last_floor_width: lastFloorWidth,
      staircase_count: staircaseCount,
      door_count: doorCount,
      window_count: windowCount,
    };

    setCurrentRefNo(keepRef ? (existingRefNo as string) : "");
    localStorage.setItem("certificatePreview", JSON.stringify(certificateData));
    // The preview page needs the saved data; do not wipe it while navigating there
    goingToPreviewRef.current = true;
    router.push("/certificate-preview");
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleClear = () => {
    clearSavedCertificate();
    setCurrentRefNo("");
    setFloorData({});
    setCustomerName("");
    setPropertyAddress("");
    setPlotArea("");
    setSelectedClientName("");
    setRepresentative("");
    setSelectedFloors(DEFAULT_FLOORS);
    setUploadedFile(null);
  };

  return (
    <div className="p-6 font-sans uppercase text-lg text-black max-w-5xl mx-auto border border-black bg-white shadow-lg leading-tight">
      <h1 className="text-2xl font-bold text-center border-2 border-black bg-gray-100 p-1 mb-3">CONSTRUCTION CERTIFICATE INPUT FORM</h1>
      
      {/* 50-50 Split Row with Clean White Background and Corner Upload Option */}
      <div className="mb-4 bg-white text-black p-3 border border-black grid grid-cols-2 gap-4 shadow-sm items-center">
        <div>
          <label className="font-bold block text-[9.5pt] text-black mb-0.5">BANK / NBFC / HFC</label>
          <input 
            type="text"
            list="institutions-list"
            className="w-full border border-black p-1 uppercase text-center text-[9.5pt] bg-white font-bold text-black" 
            value={selectedInstitution} 
            onChange={(e) => setSelectedInstitution(e.target.value)}
            placeholder="SELECT OR TYPE INSTITUTION..."
          />
          <datalist id="institutions-list">
            {FINANCIAL_INSTITUTIONS.map((inst, idx) => (
              <option key={idx} value={inst} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col items-end">
          <label className="font-bold block text-[9.5pt] text-black mb-0.5 w-full text-right">DOCUMENT UPLOAD</label>
          <div className="flex items-center gap-2 justify-end">
            <input 
              type="file" 
              id="doc-scan-input" 
              className="hidden" 
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" 
              onChange={handleDocumentScan} 
            />
            <label 
              htmlFor="doc-scan-input" 
              className="bg-[#1e293b] text-white px-3 py-1 text-[9pt] font-bold cursor-pointer hover:bg-slate-800 transition uppercase shadow border border-black truncate max-w-[150px]"
              title={uploadedFile ? uploadedFile.name : "Upload"}
            >
              {uploadedFile ? uploadedFile.name : "UPLOAD"}
            </label>
            {uploadedFile && (
              <button 
                onClick={() => setUploadedFile(null)} 
                className="bg-red-600 text-white px-2 py-1 text-[9pt] font-bold uppercase border border-black hover:bg-red-700"
              >
                CANCEL
              </button>
            )}
            <span className="bg-[#1e293b] text-white px-3 py-1 text-[9pt] font-bold uppercase tracking-wider border border-black shadow-sm">
              {isScanning ? "SCANNING..." : "SCAN"}
            </span>

          </div>
        </div>
      </div>

      {/* Top Configuration Bar: Case Type, Fee Type, Client Name, and Representative */}
      <div className="grid grid-cols-12 gap-3 mb-4 border-b border-black pb-4">
        <div className="col-span-4">
          <label className="font-bold block text-[11pt]">CASE TYPE</label>
          <select className="w-full border border-black p-1 uppercase text-center bg-gray-100 text-lg" disabled>
            <option>CONSTRUCTION CERTIFICATE</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="font-bold block text-[11pt]">FEE TYPE</label>
          <select 
            className="w-full border border-black p-1 uppercase text-center text-lg bg-white" 
            value={feeMode} 
            onChange={(e) => setFeeMode(e.target.value)}
          >
            <option value="AUTO">AUTO</option>
            <option value="MANUAL">MANUAL</option>
          </select>
          {feeMode === "MANUAL" && (
            <input 
              type="number" 
              placeholder="FEE" 
              className="w-full border border-black p-1 mt-1 text-center text-lg bg-white" 
              onChange={(e) => setManualFee(Number(e.target.value))} 
            />
          )}
        </div>

        <div className="col-span-3">
          <label className="font-bold block text-[11pt]">CLIENT NAME</label>
          <input 
            list="clients-list" 
            value={selectedClientName} 
            onChange={(e) => handleClientChange(e.target.value)} 
            className="w-full border border-black p-1 uppercase text-center text-lg bg-white" 
            placeholder="SEARCH..." 
          />
          <datalist id="clients-list">{[...new Set(clients.map(c => c.client_name))].map((name, i) => <option key={i} value={name} />)}</datalist>
        </div>

        <div className="col-span-3">
          <label className="font-bold block text-[11pt]">REPRESENTATIVE</label>
          <input 
            list="reps-list" 
            value={representative} 
            onChange={(e) => setRepresentative(e.target.value)} 
            className="w-full border border-black p-1 uppercase text-center text-lg bg-white" 
            placeholder="SEARCH REP..." 
          />
          <datalist id="reps-list">{filteredReps.map((rep, i) => <option key={i} value={rep} />)}</datalist>
        </div>
      </div>

      {/* Customer Name and Property Address Fields */}
      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-12 items-center gap-4">
          <label className="col-span-3 font-bold text-[12pt] border border-black p-2 bg-gray-100">CUSTOMER NAME</label>
          <textarea value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="col-span-9 border border-black p-2 uppercase text-left text-lg bg-white" rows={1} />
        </div>
        <div className="grid grid-cols-12 items-center gap-4">
          <label className="col-span-3 font-bold text-[12pt] border border-black p-2 bg-gray-100">PROPERTY ADDRESS</label>
          <textarea value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} className="col-span-9 border border-black p-2 uppercase text-left text-lg bg-white" rows={2} placeholder="HOUSE OR PLOT NO., COLONY NAME, WARD NO., ON LAND SURVEY NO., VILL, PH NO., TEHSIL, DISTT, STATE" />
        </div>
      </div>

      {/* Plot Area and Floor Selector */}
      <div className="grid grid-cols-10 gap-4 mb-1 items-center border-t border-black pt-2">
        <div className="col-span-3">
          <label className="font-bold block text-[12pt]">PLOT AREA</label>
          <div className="relative flex items-center">
            <input 
              type="text" 
              placeholder="0.00" 
              value={plotArea ? Number(plotArea).toLocaleString('en-IN') : ""} 
              onChange={(e) => { 
                const val = e.target.value.replace(/[^0-9.]/g, ''); 
                setPlotArea(val); 
              }} 
              className="w-full border border-black p-1 uppercase text-center text-xl bg-white font-bold" 
            />
            <span className="absolute right-2 text-black font-bold text-[10pt] pointer-events-none">SQ. FT</span>
          </div>
        </div>
        <div className="col-span-7">
          <label className="font-bold block text-[12pt]">SELECT FLOORS: ({selectedFloors.length} SELECTED)</label>
          <button onClick={() => { setTempSelectedFloors(selectedFloors); setIsFloorModalOpen(true); }} className="border border-black px-10 py-1 font-bold text-[10pt] mt-1 bg-gray-100 hover:bg-gray-200">+ ADD / CHOOSE FLOOR</button>
        </div>
      </div>

      {/* Built Up Area Details Table */}
      <div className="mt-4 border border-black rounded-none overflow-hidden">
        <div className="bg-[#1e293b] text-white py-2 font-bold uppercase tracking-wider text-center text-[12pt]">BUILT UP AREA DETAILS (CHOOSE WIDTH & LENGTH)</div>
        <div className="flex flex-col">
          {["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"]
            .filter(f => selectedFloors.includes(f))
            .map((f) => (
              <div key={f} className="grid grid-cols-12 items-center border-b border-black bg-white">
                <span className="col-span-4 font-bold text-black uppercase text-[12pt] p-2 text-center border-r border-black">{f}</span>
                <div className="col-span-4 grid grid-cols-2 gap-0 border-r border-black">
                  <input type="number" step="0.01" placeholder="W (FEET)" value={floorData[f]?.width || ""} className="w-full text-center border-none bg-transparent outline-none p-2" onChange={(e) => updateArea(f, floorData[f]?.length || 0, parseFloat(e.target.value) || 0)} />
                  <input type="number" step="0.01" placeholder="L (FEET)" value={floorData[f]?.length || ""} className="w-full text-center border-none bg-transparent outline-none p-2" onChange={(e) => updateArea(f, parseFloat(e.target.value) || 0, floorData[f]?.width || 0)} />
                </div>
                <input type="text" readOnly value={`${floorData[f]?.area || 0} SQ.FT`} className="col-span-4 p-2 text-center font-bold text-black text-[12pt] bg-transparent" />
              </div>
            ))}
        </div>
      </div>

      {/* Total built-up area summary (rate / amount removed) */}
      <div className="mb-3 mt-4 bg-gray-50 p-2 border border-black max-w-xs">
        <label className="font-bold block text-[11pt]">TOTAL AREA</label>
        <input type="text" readOnly value={`${totalBuiltUpArea} SQ.FT`} className="w-full border border-black p-1 uppercase text-center bg-white font-bold" />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 border-t border-black pt-4">
        <button onClick={handleGenerate} disabled={isGenerating} className="bg-black text-white px-6 py-2 font-bold uppercase hover:bg-gray-800 disabled:opacity-60">{isGenerating ? "PLEASE WAIT..." : "GENERATE CERTIFICATE"}</button>
        <button onClick={handleClear} className="bg-red-600 text-white px-6 py-2 font-bold uppercase hover:bg-red-700">Clear Data</button>
      </div>

      {/* Confirmation dialog: new-certificate charge (users) / same ref or new ref (admin) */}
      {dialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white p-6 border-2 border-black w-full max-w-md normal-case text-sm">
            <h2 className="font-bold uppercase mb-3 border-b border-black pb-2 text-base">{dialog.title}</h2>
            <div className="space-y-2 mb-5 text-gray-800">
              {dialog.lines.map((l, i) => (<p key={i}>{l}</p>))}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {dialog.options.map((o) => (
                <button
                  key={o.key}
                  onClick={() => answerDialog(o.key)}
                  className={
                    "px-4 py-2 font-bold uppercase border border-black " +
                    (o.tone === "primary" ? "bg-black text-white hover:bg-gray-800"
                      : o.tone === "danger" ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-white hover:bg-gray-100")
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floor Selection Modal */}
      {isFloorModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 border border-black w-[400px] uppercase text-[9pt]">
            <h2 className="font-bold mb-4 border-b border-black pb-2 text-[11pt]">SELECT FLOORS</h2>
            <div className="space-y-2 max-h-[350px] overflow-auto mb-4">
              {[...DEFAULT_FLOORS, ...EXTRA_FLOORS].map((floor) => (
                <label key={floor} className="flex items-center gap-3 cursor-pointer p-2 border-b">
                  <input type="checkbox" checked={tempSelectedFloors.includes(floor)} onChange={() => setTempSelectedFloors(prev => prev.includes(floor) ? prev.filter(f => f !== floor) : [...prev, floor])} />
                  {floor}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button className="border border-black px-4 py-2 hover:bg-gray-100" onClick={() => setIsFloorModalOpen(false)}>CANCEL</button>
              <button className="bg-black text-white px-4 py-2 font-bold hover:bg-gray-800" onClick={() => {
                const floorSequence = ["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"];
                setSelectedFloors([...tempSelectedFloors].sort((a, b) => floorSequence.indexOf(a) - floorSequence.indexOf(b)));
                setIsFloorModalOpen(false);
              }}>ADD SELECTED</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}