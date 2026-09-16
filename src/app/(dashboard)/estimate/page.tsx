"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const DEFAULT_FLOORS = ["GROUND FLOOR"];
const EXTRA_FLOORS = [
  "BASEMENT", "FIRST FLOOR", "SECOND FLOOR", "TOWER", "THIRD FLOOR", 
  "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", 
  "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR"
];

export default function EstimatePage() {
  const router = useRouter();

  const [clients, setClients] = useState<any[]>([]);
  const [representative, setRepresentative] = useState("");
  const [filteredReps, setFilteredReps] = useState<string[]>([]);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [allRepresentatives, setAllRepresentatives] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [plotArea, setPlotArea] = useState("");
  const [plotUnit, setPlotUnit] = useState("SQ.FT");
  const [selectedFloors, setSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [tempSelectedFloors, setTempSelectedFloors] = useState<string[]>(DEFAULT_FLOORS);
  const [floorData, setFloorData] = useState<Record<string, { length: number; width: number; area: number }>>({});
  const [rate, setRate] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [feeMode, setFeeMode] = useState("AUTO");
  const [manualFee, setManualFee] = useState<number>(0);
  const [registeredFee, setRegisteredFee] = useState<number>(0);
  const [currentRefNo, setCurrentRefNo] = useState("");

  // Wallet & Access Control States
  const [walletBalance, setWalletBalance] = useState<number>(100);
  const [userPlan, setUserPlan] = useState<string>("BASIC PLAN");
  const [userRole, setUserRole] = useState<string>("");
  const [isAdminOrExempt, setIsAdminOrExempt] = useState<boolean>(false);
  const [isCheckingWallet, setIsCheckingWallet] = useState<boolean>(true);

  useEffect(() => {
    const checkWalletAndSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          let exempt = false;
          let currentRole = "";
          let currentPlan = "";

          // Role check via RPC or profiles table
          const { data: roleData } = await supabase.rpc('get_user_role', { target_user_id: session.user.id });
          if (roleData) currentRole = roleData.toLowerCase();

          const { data: profileData } = await supabase
            .from('profiles')
            .select('plan_type, wallet_balance, role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profileData) {
            if (profileData.plan_type) currentPlan = profileData.plan_type.toLowerCase();
            if (profileData.wallet_balance !== null && profileData.wallet_balance !== undefined) {
              setWalletBalance(Number(profileData.wallet_balance));
            }
            if (profileData.role) currentRole = profileData.role.toLowerCase();
          }

          setUserRole(currentRole);
          setUserPlan(currentPlan);

          // Check if user is Admin, CEO, or has Premium/Advanced plan (Exempt from restriction)
          if (
            currentRole === 'admin' || 
            currentRole === 'ceo' || 
            currentPlan.includes('premium') || 
            currentPlan.includes('advanced') ||
            session.user.email === 'legalntech@gmail.com'
          ) {
            exempt = true;
          }

          setIsAdminOrExempt(exempt);
        }
      } catch (err) {
        console.error("Wallet check error:", err);
      } finally {
        setIsCheckingWallet(false);
      }
    };

    checkWalletAndSession();
  }, []);

  useEffect(() => {
    const savedData = localStorage.getItem("estimateData") || localStorage.getItem("estimatePreview");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.ref_no) setCurrentRefNo(parsed.ref_no);
        setCustomerName(parsed.customer_name || "");
        setPropertyAddress(parsed.property_address || "");
        setPlotArea(parsed.plot_area?.toString() || "");
        setSelectedClientName(parsed.client_name || parsed.selected_client_name || "");
        setRepresentative(parsed.representative || "");
        setRate(Number(parsed.rate_per_sqft) || 0);
        setFeeMode(parsed.fee_mode || "AUTO");
        if (parsed.fee_amount) setManualFee(parsed.fee_amount);
        if (parsed.floor_details) {
          setFloorData(parsed.floor_details);
          const savedFloors = Object.keys(parsed.floor_details);
          if (savedFloors.length > 0) {
            setSelectedFloors(savedFloors);
          }
          const totalArea = Object.values(parsed.floor_details).reduce(
            (sum: number, f: any) => sum + Number(f.area || 0), 0
          );
          setAmount(Number(totalArea) * Number(parsed.rate_per_sqft || 0));
        }
      } catch (e) {
        console.error("Failed to parse saved estimate:", e);
      }
    }
  }, []);

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

  const handlePlotAreaChange = (val: string) => {
    const cleanVal = val.replace(/[^0-9.]/g, '');
    const parts = cleanVal.split('.');
    const formattedVal = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleanVal;

    setPlotArea(formattedVal);

    const newPlotNum = parseFloat(formattedVal) || 0;
    if (newPlotNum > 0) {
      for (const floor of selectedFloors) {
        const floorArea = floorData[floor]?.area || 0;
        if (floorArea > newPlotNum) {
          alert(`Validation Error: Floor "${floor}" area (${floorArea} SQ.FT) cannot exceed the Plot Area (${newPlotNum} SQ.FT).`);
        }
      }
    }
  };

  const updateArea = (floor: string, l: number, w: number) => {
    const validLength = Math.max(0, l);
    const validWidth = Math.max(0, w);
    
    const newArea = parseFloat((validLength * validWidth).toFixed(2));
    const plotAreaNum = parseFloat(plotArea) || 0;
    
    if (plotAreaNum > 0 && newArea > plotAreaNum) {
      alert(`Validation Error: Floor area (${newArea} SQ.FT) cannot exceed the Plot Area (${plotAreaNum} SQ.FT).`);
      return;
    }
    
    const updatedFloorData = { ...floorData, [floor]: { length: validLength, width: validWidth, area: newArea } };
    setFloorData(updatedFloorData);
    
    const newTotal = selectedFloors.reduce((sum, f) => sum + Number(updatedFloorData[f]?.area || 0), 0);
    setAmount(parseFloat((newTotal * rate).toFixed(2)));
  };

  const totalBuiltUpArea = selectedFloors.reduce((sum, f) => sum + Number(floorData[f]?.area || 0), 0);

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
    
    const { data, error } = await supabase
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

    const storedData = JSON.parse(localStorage.getItem("estimateData") || localStorage.getItem("estimatePreview") || "{}");
    const plotAreaNum = parseFloat(plotArea.toString().replace(/,/g, '')) || 0;
    
    if (!customerName.trim() || !propertyAddress.trim() || !plotArea || rate <= 0) {
      alert("Validation Error: Please fill in all required fields and ensure rate is provided.");
      return;
    }

    for (const floor of selectedFloors) {
      const fData = floorData[floor];
      const floorArea = fData?.area || 0;
      const fLength = fData?.length || 0;
      const fWidth = fData?.width || 0;

      if (fLength <= 0 || fWidth <= 0 || floorArea <= 0) {
        alert(`Validation Error: Floor "${floor}" has missing or zero dimensions. Please fill valid values or unselect this floor.`);
        return;
      }
      if (floorArea > plotAreaNum) {
        alert(`Validation Error: The area for ${floor} (${floorArea} SQ.FT) exceeds the plot area (${plotAreaNum} SQ.FT).`);
        return;
      }
    }

    const filteredFloorDetails: Record<string, { length: number; width: number; area: number }> = {};
    selectedFloors.forEach((floor) => {
      if (floorData[floor]?.area > 0) {
        filteredFloorDetails[floor] = floorData[floor];
      }
    });

    const manualTotalBuiltUp = Object.values(filteredFloorDetails).reduce((sum, f) => sum + (f.area || 0), 0);
    const finalCalculatedAmount = parseFloat((manualTotalBuiltUp * rate).toFixed(2));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please login to generate estimate.");
      return;
    }

    const plotMaster = await getPlotMasterData();
    const finalFee = feeMode === "AUTO" ? registeredFee : manualFee;

    const isSame = 
      String(storedData.customer_name || "").trim() === String(customerName || "").trim() &&
      String(storedData.property_address || "").trim() === String(propertyAddress || "").trim() &&
      Number(storedData.plot_area || 0) === Number(plotArea || 0) &&
      Number(storedData.rate_per_sqft || 0) === Number(rate || 0) &&
      String(storedData.client_name || "").trim() === String(selectedClientName || "").trim() &&
      String(storedData.representative || "").trim() === String(representative || "").trim() &&
      JSON.stringify(storedData.floor_details || {}) === JSON.stringify(filteredFloorDetails || {});

    const oldName = storedData.customer_name || "";
    const oldAddress = storedData.property_address || "";
    const nameSimilarity = getSimilarity(customerName, oldName);
    const addressSimilarity = getSimilarity(propertyAddress, oldAddress);
    
    const needsNewRef = !storedData.ref_no || nameSimilarity < 0.8 || addressSimilarity < 0.8;
    const finalRefNo = needsNewRef ? "REF-" + Date.now() : storedData.ref_no;
    setCurrentRefNo(finalRefNo);

    if (!isSame) {
      if (storedData.ref_no) {
        const { count } = await supabase
          .from('estimate_history')
          .select('*', { count: 'exact', head: true })
          .eq('ref_no', storedData.ref_no);
          
        if (count !== null && count >= 3) {
          alert("LIMIT REACHED: Aap is estimate ko 3 baar se zyada edit nahi kar sakte.");
          return;
        }
      }

      const historyData = {
        ref_no: finalRefNo,
        action_type: "RATE_UPDATE",
        user_id: user.id,
        changes: JSON.stringify({
          rate_per_sqft: rate,
          client_name: selectedClientName,
          representative_name: representative,
          customer_name: customerName,
          property_address: propertyAddress,
          plot_area: plotArea,
          floor_details: filteredFloorDetails,
          fee: finalFee
        }),
        created_at: new Date().toISOString()
      };

      await supabase.from("estimate_history").insert([historyData]);
    }

    if (!isAdminOrExempt && finalRefNo) {
      const { error: updateError } = await supabase
        .from('mis_records')
        .update({ fee: finalFee, user_id: user.id })
        .eq('ref_no', finalRefNo);
        
      if (updateError) console.error("Error updating fee:", updateError.message);
    }

    const residentialActiveFloors = selectedFloors.filter((f) => f !== "BASEMENT" && f !== "TOWER");
    const activeFloorCount = residentialActiveFloors.length;
    const activeHasTower = selectedFloors.includes("TOWER");
    const lastResFloor = residentialActiveFloors[residentialActiveFloors.length - 1];
    const activeLastFloorLength = filteredFloorDetails[lastResFloor]?.length || 0;
    const activeLastFloorWidth = filteredFloorDetails[lastResFloor]?.width || 0;
    const activeStaircaseCount = activeFloorCount;

    let activeDoorCount = 0;
    if (manualTotalBuiltUp <= 600) { activeDoorCount = 4 * activeFloorCount; }
    else if (manualTotalBuiltUp <= 1000) { activeDoorCount = 5 * activeFloorCount; }
    else if (manualTotalBuiltUp <= 1500) { activeDoorCount = 6 * activeFloorCount; }
    else if (manualTotalBuiltUp <= 2000) { activeDoorCount = 8 * activeFloorCount; }
    else { activeDoorCount = 8 + Math.ceil((manualTotalBuiltUp - 2000) / 500); }
    if (activeHasTower) { activeDoorCount += 1; }
    const activeWindowCount = activeDoorCount * 2;

    const estimateData = {
      ref_no: finalRefNo,
      id: storedData.id || null,
      customer_name: customerName,
      client_name: selectedClientName,
      representative,
      property_address: propertyAddress,
      plot_area: plotArea,
      selected_floors: selectedFloors,
      floor_details: filteredFloorDetails,
      total_builtup_area: manualTotalBuiltUp,
      rate_per_sqft: rate,
      construction_cost: finalCalculatedAmount,
      total_value: finalCalculatedAmount,
      fee_amount: finalFee,
      fee_mode: feeMode,
      estimate_type: "NEW CONSTRUCTION",
      plotMaster,
      floor_count: activeFloorCount,
      has_tower: activeHasTower,
      last_floor_length: activeLastFloorLength,
      last_floor_width: activeLastFloorWidth,
      staircase_count: activeStaircaseCount,
      door_count: activeDoorCount,
      window_count: activeWindowCount,
    };
    
    localStorage.setItem("estimatePreview", JSON.stringify(estimateData));
    router.push("/estimate-preview");
  };
  
  const handleClear = () => {
    localStorage.removeItem("estimateData");
    localStorage.removeItem("estimatePreview");
    setFloorData({});
    setRate(0);
    setAmount(0);
    setCustomerName("");
    setPropertyAddress("");
    setPlotArea("");
    setSelectedClientName("");
    setRepresentative("");
    setSelectedFloors(DEFAULT_FLOORS);
  };

  const isClientFilled = selectedClientName.trim() !== "" && representative.trim() !== "";
  const isCustomerFilled = isClientFilled && customerName.trim() !== "";
  const isAddressFilled = isCustomerFilled && propertyAddress.trim() !== "";
  const isPlotFilled = isAddressFilled && plotArea.trim() !== "";

  // Restriction only applies if NOT admin/CEO/premium/advanced AND wallet balance is less than 21
  const isWalletRestricted = !isAdminOrExempt && walletBalance < 21;

  if (isCheckingWallet) {
    return <div className="p-10 text-center font-bold text-lg">Checking wallet balance...</div>;
  }

  return (
    <div className="relative w-full max-w-5xl mx-auto p-2 sm:p-6 font-sans uppercase text-sm sm:text-lg text-black border border-black bg-white shadow-lg leading-tight overflow-x-auto">
      
      {/* RESTRICTION OVERLAY ONLY FOR BASIC PLAN USERS WITH WALLET < 21 */}
      {isWalletRestricted && (
        <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-100 border-2 border-red-600 text-red-700 p-6 rounded-xl max-w-lg shadow-2xl">
            <h2 className="text-2xl font-black uppercase mb-2">⚠️ Wallet Balance Low (Restricted)</h2>
            <p className="text-sm font-semibold mb-4">
              Aapka wallet balance (₹{walletBalance}) ₹21 se kam hai aur aapka plan Basic Plan hai. Isliye Construction Estimate portal ko lock kar diya gaya hai. Kripya apna wallet recharge karein.
            </p>
            <button 
              onClick={() => router.push('/wallet-ledger')}
              className="bg-red-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-red-700 shadow uppercase text-sm cursor-pointer"
            >
              Go to Wallet Ledger & Recharge
            </button>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center border-2 border-black bg-gray-100 p-3 mb-4 gap-2">
        <div className="hidden sm:block w-24"></div>
        <h1 className="text-xl sm:text-2xl font-bold text-center flex-1">CONSTRUCTION ESTIMATE INPUT FORM</h1>
        <div>
          <label className="bg-black text-white px-3 py-1.5 font-bold text-xs sm:text-base uppercase cursor-pointer hover:bg-gray-800 flex items-center gap-1 shadow">
            📁 UPLOAD DOC / AI SCAN
            <input 
              type="file" 
              className="hidden" 
              disabled={isWalletRestricted}
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
      
      {/* Top Fields Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 sm:gap-4 mb-4 border-b border-black pb-4">
        <div className="col-span-1 sm:col-span-2">
          <label className="font-bold block text-xs sm:text-lg">CASE TYPE</label>
          <select disabled={isWalletRestricted} className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg bg-white">
            <option>NEW CONSTRUCTION</option>
          </select>
        </div>
        <div className="col-span-1 sm:col-span-1">
          <label className="font-bold block text-xs sm:text-lg">FEE</label>
          <select disabled={isWalletRestricted} className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg bg-white" value={feeMode} onChange={(e) => setFeeMode(e.target.value)}>
            <option value="AUTO">AUTO</option>
            <option value="MANUAL">MANUAL</option>
          </select>
          {feeMode === "MANUAL" && (
            <input type="number" disabled={isWalletRestricted} placeholder="ENTER FEE" className="w-full border border-black p-1.5 mt-1 text-center text-xs sm:text-lg" onChange={(e) => setManualFee(Number(e.target.value))} />
          )}
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="font-bold block text-xs sm:text-lg">CLIENT NAME</label>
          <input list="clients-list" disabled={isWalletRestricted} value={selectedClientName} onChange={(e) => handleClientChange(e.target.value)} className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg" placeholder="SEARCH CLIENT..." />
          <datalist id="clients-list">{[...new Set(clients.map(c => c.client_name))].map((name, i) => <option key={i} value={name} />)}</datalist>
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="font-bold block text-xs sm:text-lg">REPRESENTATIVE</label>
          <input list="reps-list" disabled={isWalletRestricted} value={representative} onChange={(e) => setRepresentative(e.target.value)} className="w-full border border-black p-2 uppercase text-center text-xs sm:text-lg" placeholder="SEARCH REP..." />
          <datalist id="reps-list">{filteredReps.map((rep, i) => <option key={i} value={rep} />)}</datalist>
        </div>
      </div>

      {/* Customer Name & Property Address */}
      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 md:gap-4">
          <label className="col-span-1 md:col-span-3 font-bold text-sm sm:text-lg border border-black p-2.5 bg-gray-100">CUSTOMER NAME</label>
          <textarea 
            value={customerName} 
            disabled={isWalletRestricted || !isClientFilled}
            onChange={(e) => {
              setCustomerName(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }} 
            className={`col-span-1 md:col-span-9 border border-black p-2.5 uppercase text-left text-sm sm:text-lg resize-y overflow-hidden placeholder:text-gray-400 placeholder:normal-case ${(!isClientFilled || isWalletRestricted) ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} 
            rows={1} 
            placeholder="FILL HERE (e.g. Mr. Raju Dubela, s/o Premchand)"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 md:gap-4">
          <label className="col-span-1 md:col-span-3 font-bold text-sm sm:text-lg border border-black p-2.5 bg-gray-100">PROPERTY ADDRESS</label>
          <textarea 
            value={propertyAddress} 
            disabled={isWalletRestricted || !isCustomerFilled}
            onChange={(e) => {
              setPropertyAddress(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }} 
            className={`col-span-1 md:col-span-9 border border-black p-2.5 uppercase text-left text-sm sm:text-lg resize-y overflow-hidden placeholder:text-gray-400 placeholder:normal-case ${(!isCustomerFilled || isWalletRestricted) ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`} 
            rows={2} 
            placeholder="FILL HERE (e.g. 110 PATEL MARG, Vill. Rajgarh, Tehsil Sardarpur, Distt. Dhar, State MP)"
          />
        </div>
      </div>

      {/* Plot Area & Floor Selector */}
      <div className={`grid grid-cols-12 gap-2 md:gap-4 mb-2 items-center border-t border-black pt-3 ${(!isAddressFilled || isWalletRestricted) ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="col-span-5 md:col-span-3">
          <label className="font-bold block text-[11px] sm:text-lg truncate">PLOT AREA</label>
          <div className="relative flex items-center">
            <input 
              type="text" 
              placeholder="0.00" 
              disabled={isWalletRestricted || !isAddressFilled}
              value={plotArea} 
              onChange={(e) => handlePlotAreaChange(e.target.value)} 
              className="w-full border border-black p-2 uppercase text-center text-sm sm:text-lg" 
            />
            <span className="absolute right-2 text-black font-bold text-[9px] sm:text-base pointer-events-none">SQ. FT</span>
          </div>
        </div>
        <div className="col-span-7 md:col-span-7">
          <label className="font-bold block text-[11px] sm:text-lg truncate">SELECT FLOORS: ({selectedFloors.length})</label>
          <button 
            disabled={isWalletRestricted || !isPlotFilled}
            onClick={() => { setTempSelectedFloors(selectedFloors); setIsFloorModalOpen(true); }} 
            className={`w-full border border-black px-2 py-2.5 font-bold text-[10px] sm:text-lg mt-1 bg-gray-100 hover:bg-gray-200 truncate ${(!isPlotFilled || isWalletRestricted) ? 'cursor-not-allowed' : ''}`}
          >
            ADD + CHOOSE FLOOR
          </button>
        </div>
      </div>

      {/* Built Up Area Details */}
      <div className={`mt-4 border border-black rounded-none overflow-hidden ${(!isPlotFilled || isWalletRestricted) ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="bg-[#1e293b] text-white py-2.5 font-bold uppercase tracking-wider text-center text-sm sm:text-lg">BUILT UP AREA DETAILS</div>
        <div className="flex flex-col">
          {["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"]
            .filter(f => selectedFloors.includes(f))
            .map((f) => (
              <div key={f} className="grid grid-cols-12 items-center border-b border-black bg-white">
                <span className="col-span-4 font-bold text-black uppercase text-xs sm:text-lg p-2.5 text-center border-r border-black">{f}</span>
                <div className="col-span-4 grid grid-cols-2 gap-0 border-r border-black">
                  <input type="number" step="0.01" min="0" disabled={isWalletRestricted} placeholder="20 FT" value={floorData[f]?.width || ""} className="w-full text-center border-none bg-transparent outline-none p-2.5 text-xs sm:text-lg" onChange={(e) => updateArea(f, floorData[f]?.length || 0, parseFloat(e.target.value) || 0)} />
                  <input type="number" step="0.01" min="0" disabled={isWalletRestricted} placeholder="50 FT" value={floorData[f]?.length || ""} className="w-full text-center border-none bg-transparent outline-none p-2.5 text-xs sm:text-lg" onChange={(e) => updateArea(f, parseFloat(e.target.value) || 0, floorData[f]?.width || 0)} />
                </div>
                <input type="text" readOnly value={`${floorData[f]?.area || 0} SQ.FT`} className="col-span-4 p-2.5 text-center font-bold text-black text-xs sm:text-lg bg-transparent" />
              </div>
            ))}
        </div>
      </div>

      {/* Summary Calculation Bar */}
      <div className={`grid grid-cols-2 sm:grid-cols-5 mb-3 mt-4 items-center gap-2 ${(totalBuiltUpArea <= 0 || isWalletRestricted) ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="col-span-1 sm:col-span-1">
          <label className="font-bold block text-xs sm:text-lg">TOTAL AREA</label>
          <input type="text" readOnly value={`${totalBuiltUpArea} SQ.FT`} className="w-full border border-black p-2 uppercase text-center bg-gray-100 font-bold text-xs sm:text-lg" />
        </div>
        <div className="text-center font-bold text-lg hidden sm:block">X</div>
        <div className="col-span-1 sm:col-span-1">
          <label className="font-bold block text-xs sm:text-lg">RATE / SQ.FT</label>
          <input 
            type="number" 
            step="0.01" 
            disabled={isWalletRestricted}
            placeholder="RATE" 
            value={rate || ""} 
            onChange={(e) => { 
              const r = parseFloat(e.target.value) || 0; 
              setRate(r); 
              if (totalBuiltUpArea > 0) {
                setAmount(parseFloat((r * totalBuiltUpArea).toFixed(2))); 
              }
            }} 
            className="w-full text-center border border-black p-2 uppercase text-xs sm:text-lg" 
          />
        </div>
        <div className="text-center font-bold text-lg hidden sm:block">=</div>
        <div className="col-span-2 sm:col-span-1">
          <label className="font-bold block text-xs sm:text-lg">TOTAL AMOUNT</label>
          <input 
            type="text" 
            disabled={isWalletRestricted}
            placeholder="TOTAL AMOUNT"
            value={amount ? amount.toLocaleString('en-IN') + "/-" : ""} 
            onChange={(e) => {
              const rawVal = e.target.value.replace(/[^0-9.]/g, '');
              const amt = parseFloat(rawVal) || 0;
              setAmount(amt);
              if (totalBuiltUpArea > 0) {
                const calculatedRate = parseFloat((amt / totalBuiltUpArea).toFixed(2));
                setRate(calculatedRate);
              }
            }} 
            className="w-full border border-black p-2 uppercase text-center bg-gray-100 font-bold text-xs sm:text-lg" 
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 border-t border-black pt-4">
        <button 
          onClick={handleGenerate} 
          disabled={isWalletRestricted}
          className={`bg-black text-white px-6 py-3 font-bold uppercase text-sm sm:text-lg w-full sm:w-auto ${isWalletRestricted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}`}
        >
          GENERATE ESTIMATE
        </button>
        <button 
          onClick={handleClear} 
          disabled={isWalletRestricted}
          className={`bg-red-600 text-white px-6 py-3 font-bold uppercase text-sm sm:text-lg w-full sm:w-auto ${isWalletRestricted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700'}`}
        >
          Clear Data
        </button>
      </div>

      {/* Floor Selector Modal */}
      {isFloorModalOpen && !isWalletRestricted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 border border-black w-full max-w-[400px] uppercase text-xs sm:text-base">
            <h2 className="font-bold mb-4 border-b border-black pb-2 text-sm sm:text-lg">SELECT FLOORS</h2>
            <div className="space-y-2 max-h-[350px] overflow-auto mb-4">
              {[...DEFAULT_FLOORS, ...EXTRA_FLOORS].map((floor) => (
                <label key={floor} className="flex items-center gap-3 cursor-pointer p-2 border-b">
                  <input type="checkbox" checked={tempSelectedFloors.includes(floor)} onChange={() => setTempSelectedFloors(prev => prev.includes(floor) ? prev.filter(f => f !== floor) : [...prev, floor])} />
                  {floor}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button className="border border-black px-4 py-2" onClick={() => setIsFloorModalOpen(false)}>CANCEL</button>
              <button className="bg-black text-white px-4 py-2 font-bold" onClick={() => {
                const floorSequence = ["BASEMENT", "GROUND FLOOR", "FIRST FLOOR", "SECOND FLOOR", "THIRD FLOOR", "FOURTH FLOOR", "FIFTH FLOOR", "SIXTH FLOOR", "SEVENTH FLOOR", "EIGHTH FLOOR", "NINTH FLOOR", "TENTH FLOOR", "TOWER"];
                const sortedSelected = [...tempSelectedFloors].sort((a, b) => floorSequence.indexOf(a) - floorSequence.indexOf(b));
                setSelectedFloors(sortedSelected);

                const newTotal = sortedSelected.reduce((sum, f) => sum + Number(floorData[f]?.area || 0), 0);
                setAmount(parseFloat((newTotal * rate).toFixed(2)));

                setIsFloorModalOpen(false);
              }}>ADD SELECTED</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}