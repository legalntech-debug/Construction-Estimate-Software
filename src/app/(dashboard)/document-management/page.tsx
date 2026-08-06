"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface DocumentItem {
  id: number;
  state: string;
  district: string;
  tehsil: string;
  village: string;
  survey_no: string;
  colony_name: string;
  doc_type: string;
  file_name: string;
  file_size: string;
  file_url: string;
  is_paid: boolean;
}

export default function DocumentManagementSystem() {
  const [formData, setFormData] = useState({
    state: "Madhya Pradesh",
    district: "Indore",
    tehsil: "Indore",
    village: "Bicholi Mardana",
    surveyNo: "",
    colonyName: "",
    docType: "Colony Layout",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  // Admin Access Control
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Search/Filter States
  const [filters, setFilters] = useState({
    state: "",
    district: "",
    tehsil: "",
    village: "",
    surveyNo: "",
    colonyName: "",
    docType: "",
  });

  const indianPropertyDocTypes = [
    "Colony Layout (Approved Master Plan)",
    "Building Permission / Commencement Certificate (CC)",
    "Completion Certificate / Occupancy Certificate (OC)",
    "Prakoshtha Declaration (Apartment / Unit Deed)",
    "Share Certificate / Society Allotment Letter",
    "RERA Registration Certificate",
    "Title Deed / Sale Patta / Registry Copy",
    "Mutation Extract (Khata / Namantaran)",
    "Land Revenue Record / Khasra & B1",
    "7/12 Extract & Property Card",
    "Encumbrance Certificate (EC)",
    "Town & Country Planning (T&CP) Sanction",
    "NOC from Pollution Control / Fire Department",
    "Structural Stability Certificate"
  ];

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // 🔄 Rotation State
  const [rotationDeg, setRotationDeg] = useState<number>(0);

  const checkUserRole = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session || !session.user) {
        setIsAdmin(false);
        return;
      }

      const user = session.user;
      setCurrentUserEmail(user.email || null);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) {
        setIsAdmin(false);
        return;
      }

      if (profileData.role?.trim().toLowerCase() === "admin") {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      setIsAdmin(false);
    }
  };

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("id", { ascending: false });
    if (data) setDocuments(data);
    if (error) console.error("Error fetching docs:", error);
  };

  useEffect(() => {
    fetchDocuments();
    checkUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        checkUserRole();
      } else {
        setIsAdmin(false);
        setCurrentUserEmail(null);
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's' || e.key === 'P' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        alert("🔒 Printing and Saving are disabled for previewed documents.");
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert("Access Denied: Only users with 'admin' role can upload files.");
      return;
    }
    if (!selectedFile) {
      alert("Please select a document or ZIP archive.");
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `${Date.now()}_${selectedFile.name}`;

      const { error: storageError } = await supabase.storage
        .from("DOCUMENT MANAGEMENT SYSTEM")
        .upload(fileName, selectedFile);

      if (storageError) throw storageError;

      const { data: publicUrlData } = supabase.storage
        .from("DOCUMENT MANAGEMENT SYSTEM")
        .getPublicUrl(fileName);

      const fileUrl = publicUrlData.publicUrl;
      const fileSize = `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`;

      const { error: dbError } = await supabase.from("documents").insert([
        {
          state: formData.state,
          district: formData.district,
          tehsil: formData.tehsil,
          village: formData.village,
          survey_no: formData.surveyNo,
          colony_name: formData.colonyName || "Independent Property",
          doc_type: formData.docType,
          file_name: selectedFile.name,
          file_size: fileSize,
          file_url: fileUrl,
          is_paid: false,
        },
      ]);

      if (dbError) throw dbError;

      alert("✅ Document successfully uploaded to Supabase!");
      setSelectedFile(null);
      fetchDocuments();
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!activeDoc) return;
    setIsProcessingPayment(true);

    try {
      const res = await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });

      if (!res) {
        alert("Razorpay SDK failed to load. Are you online?");
        setIsProcessingPayment(false);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_YourKeyHere",
        amount: 499 * 100,
        currency: "INR",
        name: "LnT Document Management System",
        description: `Unlock Document: ${activeDoc.doc_type}`,
        handler: async function (response: any) {
          try {
            const { error } = await supabase
              .from("documents")
              .update({ 
                is_paid: true,
                razorpay_payment_id: response.razorpay_payment_id 
              })
              .eq("id", activeDoc.id);

            if (error) {
              alert("Payment recorded on Razorpay, but database update failed: " + error.message);
              return;
            }

            setDocuments(documents.map(d => d.id === activeDoc.id ? { ...d, is_paid: true } : d));
            setActiveDoc({ ...activeDoc, is_paid: true });
            setShowPaymentModal(false);
            alert("✅ Payment Successful! Download unlocked.");
          } catch (err: any) {
            alert("Error updating payment status: " + err.message);
          }
        },
        prefill: {
          email: currentUserEmail || "user@example.com",
        },
        theme: {
          color: "#2563eb",
        },
      };

      const paymentWindow = new (window as any).Razorpay(options);
      paymentWindow.open();
    } catch (err: any) {
      alert("Payment initialization failed: " + err.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleRotateLeft = () => setRotationDeg((prev) => (prev - 90) % 360);
  const handleRotateRight = () => setRotationDeg((prev) => (prev + 90) % 360);
  const handleResetRotation = () => setRotationDeg(0);

  const filteredDocuments = documents.filter((doc) => {
    return (
      doc.state?.toLowerCase().includes(filters.state.toLowerCase()) &&
      doc.district?.toLowerCase().includes(filters.district.toLowerCase()) &&
      doc.tehsil?.toLowerCase().includes(filters.tehsil.toLowerCase()) &&
      doc.village?.toLowerCase().includes(filters.village.toLowerCase()) &&
      doc.survey_no?.toLowerCase().includes(filters.surveyNo.toLowerCase()) &&
      doc.colony_name?.toLowerCase().includes(filters.colonyName.toLowerCase()) &&
      doc.doc_type?.toLowerCase().includes(filters.docType.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans select-none">
      <style>{`
        @media print {
          body { display: none !important; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>🏛️</span> LnT DOCUMENT MANAGEMENT SYSTEM (DMS)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              "L n T The Smart Enterprise Vault Built to Accelerate Your Future."
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200">
              Vault Status: Secured 🔒
            </div>

            {isAdmin ? (
              <div className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <span>👑</span> Admin Mode Active {currentUserEmail ? `(${currentUserEmail})` : ""}
              </div>
            ) : (
              <div className="bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200">
                Mode: Standard User (View Only)
              </div>
            )}
          </div>
        </div>

        {/* Upload Form */}
        {isAdmin && (
          <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 border-l-4 border-l-blue-600">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span>📤</span> UPLOAD NEW PROPERTY DOCUMENT / ARCHIVE (.ZIP) [ADMIN AUTHORIZED]
              </h2>
              <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded">Profiles Table Verified</span>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">STATE</label>
                  <input type="text" name="state" value={formData.state} onChange={handleInputChange} className="w-full p-2 border rounded-lg text-xs bg-slate-50 font-medium focus:bg-white transition" required />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">DISTRICT</label>
                  <input type="text" name="district" placeholder="e.g. Indore" value={formData.district} onChange={handleInputChange} className="w-full p-2 border rounded-lg text-xs bg-slate-50 font-medium focus:bg-white transition" required />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">TEHSIL</label>
                  <input type="text" name="tehsil" placeholder="e.g. Indore" value={formData.tehsil} onChange={handleInputChange} className="w-full p-2 border rounded-lg text-xs bg-slate-50 font-medium focus:bg-white transition" required />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">VILLAGE / AREA</label>
                  <input type="text" name="village" placeholder="e.g. Bicholi Mardana" value={formData.village} onChange={handleInputChange} className="w-full p-2 border rounded-lg text-xs bg-slate-50 font-medium focus:bg-white transition" required />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">LAND SURVEY NO. / PLOT NO.</label>
                  <input type="text" name="surveyNo" placeholder="e.g. 142/2" value={formData.surveyNo} onChange={handleInputChange} className="w-full p-2 border rounded-lg text-xs bg-slate-50 font-medium focus:bg-white transition" required />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">COLONY / BLDG NAME</label>
                  <input type="text" name="colonyName" placeholder="e.g. Royal Palms" value={formData.colonyName} onChange={handleInputChange} className="w-full p-2 border rounded-lg text-xs bg-slate-50 font-medium focus:bg-white transition" required />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">DOCUMENT TYPE</label>
                  <select name="docType" value={formData.docType} onChange={handleInputChange} className="w-full p-2 border rounded-lg text-xs bg-slate-50 font-medium focus:bg-white transition">
                    {indianPropertyDocTypes.map((doc, idx) => (
                      <option key={idx} value={doc}>{doc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-center justify-between pt-2 border-t border-slate-100">
                <div className="w-full">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">SELECT FILE (PDF, Images, .ZIP Archive)</label>
                  <input type="file" accept=".pdf,.zip,.rar,.jpg,.jpeg,.png" onChange={handleFileChange} className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer" />
                </div>
                <button type="submit" disabled={isUploading} className="w-full md:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs transition whitespace-nowrap disabled:opacity-50">
                  {isUploading ? "Uploading..." : "Upload to DMS"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 tracking-wide">
              DOCUMENT DIRECTORY ({filteredDocuments.length} Entries)
            </h3>
            <span className="text-[11px] text-slate-400">Type directly inside table headers to filter</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#1b2a4a] text-slate-300 border-b border-[#243b67] font-medium text-[11px]">
                  <th className="p-3 w-12 text-slate-300 font-semibold">SR.</th>
                  <th className="p-2"><input type="text" name="state" placeholder="STATE" value={filters.state} onChange={handleFilterChange} className="w-full bg-transparent border-none text-white placeholder-slate-400 focus:outline-hidden font-semibold uppercase text-[11px]" /></th>
                  <th className="p-2"><input type="text" name="district" placeholder="DISTRICT" value={filters.district} onChange={handleFilterChange} className="w-full bg-transparent border-none text-white placeholder-slate-400 focus:outline-hidden font-semibold uppercase text-[11px]" /></th>
                  <th className="p-2"><input type="text" name="tehsil" placeholder="TEHSIL" value={filters.tehsil} onChange={handleFilterChange} className="w-full bg-transparent border-none text-white placeholder-slate-400 focus:outline-hidden font-semibold uppercase text-[11px]" /></th>
                  <th className="p-2"><input type="text" name="village" placeholder="VILLAGE" value={filters.village} onChange={handleFilterChange} className="w-full bg-transparent border-none text-white placeholder-slate-400 focus:outline-hidden font-semibold uppercase text-[11px]" /></th>
                  <th className="p-2"><input type="text" name="surveyNo" placeholder="SURVEY NO." value={filters.surveyNo} onChange={handleFilterChange} className="w-full bg-transparent border-none text-white placeholder-slate-400 focus:outline-hidden font-semibold uppercase text-[11px]" /></th>
                  <th className="p-2"><input type="text" name="colonyName" placeholder="COLONY / BLDG" value={filters.colonyName} onChange={handleFilterChange} className="w-full bg-transparent border-none text-white placeholder-slate-400 focus:outline-hidden font-semibold uppercase text-[11px]" /></th>
                  <th className="p-2"><input type="text" name="docType" placeholder="DOCUMENT TYPE" value={filters.docType} onChange={handleFilterChange} className="w-full bg-transparent border-none text-white placeholder-slate-400 focus:outline-hidden font-semibold uppercase text-[11px]" /></th>
                  <th className="p-3 text-center w-36 text-slate-300 font-semibold">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredDocuments.length > 0 ? (
                  filteredDocuments.map((doc, index) => (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 font-semibold text-slate-400">#{index + 1}</td>
                      <td className="p-3 font-medium">{doc.state}</td>
                      <td className="p-3">{doc.district}</td>
                      <td className="p-3">{doc.tehsil}</td>
                      <td className="p-3">{doc.village}</td>
                      <td className="p-3 font-semibold text-blue-600">{doc.survey_no}</td>
                      <td className="p-3 font-medium">{doc.colony_name}</td>
                      <td className="p-3 text-[11px]">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-medium border border-slate-200">
                          {doc.doc_type}
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-1.5 whitespace-nowrap">
                        {doc.is_paid || isAdmin ? (
                          <>
                            <button 
                              onClick={() => { setActiveDoc(doc); setPreviewUrl(doc.file_url); setRotationDeg(0); }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded text-[11px] transition shadow-xs"
                            >
                              View
                            </button>
                            <a 
                              href={doc.file_url} 
                              download={doc.file_name}
                              className="inline-block px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-[11px] transition shadow-xs"
                            >
                              Download
                            </a>
                          </>
                        ) : (
                          <button 
                            onClick={() => { setActiveDoc(doc); setShowPaymentModal(true); }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded text-[11px] transition shadow-xs"
                          >
                            Pay ₹499
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-400">
                      No matching documents found in Supabase vault.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Preview Modal */}
      {previewUrl && activeDoc && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-center items-center p-4"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">{activeDoc.doc_type}</h3>
                <p className="text-[10px] text-slate-400">File: {activeDoc.file_name} ({activeDoc.file_size})</p>
              </div>

              {/* Rotation Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRotateLeft}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded transition"
                  title="Rotate Left"
                >
                  ↺ -90°
                </button>
                <button
                  onClick={handleRotateRight}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded transition"
                  title="Rotate Right"
                >
                  ↻ +90°
                </button>
                <button
                  onClick={handleResetRotation}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition"
                  title="Reset"
                >
                  Reset
                </button>
                <button 
                  onClick={() => { setPreviewUrl(null); setActiveDoc(null); setRotationDeg(0); }}
                  className="bg-slate-800 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition ml-2"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-slate-100 p-2 overflow-auto flex items-center justify-center relative">
              {activeDoc.is_paid || isAdmin ? (
                <div 
                  className="w-full h-full transition-transform duration-300 ease-in-out flex items-center justify-center relative"
                  style={{ transform: `rotate(${rotationDeg}deg)` }}
                >
                  <div 
                    className="absolute inset-0 z-10 bg-transparent cursor-default"
                    onContextMenu={(e) => { e.preventDefault(); alert("Right-click is disabled."); }}
                  ></div>

                  <iframe 
                    src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                    className="w-full h-full rounded-lg border border-slate-300 bg-white"
                    title="Document Viewer"
                  />
                </div>
              ) : (
                <div className="text-center space-y-3 p-6">
                  <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xl mx-auto font-bold">
                    🔒
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Preview Locked</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    You must complete the payment of ₹499 to view and download this document.
                  </p>
                  <button 
                    onClick={() => { setPreviewUrl(null); setShowPaymentModal(true); }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs shadow-xs"
                  >
                    Proceed to Payment (₹499)
                  </button>
                </div>
              )}
            </div>

            <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                🔒 Protected Viewer (Right-Click, Save & Print Disabled)
              </span>
              {activeDoc.is_paid || isAdmin ? (
                <a href={activeDoc.file_url} download={activeDoc.file_name} className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg">
                  Download File
                </a>
              ) : (
                <button onClick={() => { setPreviewUrl(null); setShowPaymentModal(true); }} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs">
                  Proceed to Payment (₹499)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && activeDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl p-6 text-center space-y-4">
            <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-lg mx-auto font-bold">
              🔒
            </div>
            <h3 className="text-sm font-bold text-slate-900">Unlock Download Rights</h3>
            <p className="text-xs text-slate-500">
              Unlock <span className="font-semibold text-slate-700">{activeDoc.file_name}</span> for Survey No: <span className="font-bold text-blue-600">{activeDoc.survey_no}</span> via Razorpay.
            </p>
            
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-left text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Access Fee:</span> <span className="font-semibold">₹499.00</span></div>
              <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-slate-900"><span>Total:</span> <span className="text-blue-600">₹499.00</span></div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowPaymentModal(false)} className="w-1/2 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs">
                Cancel
              </button>
              <button 
                onClick={handleRazorpayPayment} 
                disabled={isProcessingPayment}
                className="w-1/2 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-xs disabled:opacity-50"
              >
                {isProcessingPayment ? "Processing..." : "Pay with Razorpay"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}