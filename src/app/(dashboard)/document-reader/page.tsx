"use client";
import { useState } from 'react';
import { createWorker } from 'tesseract.js';

export default function DocumentReader() {
  const [loading, setLoading] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [parsedData, setParsedData] = useState({
    buyerName: "",
    propertyAddress: "",
    plotArea: "",
  });

  // टेक्स्ट से डेटा अलग (Parse) करने का फंक्शन
  const parseDocumentText = (text: string) => {
    // 1. Buyer Name ढूंढने के लिए
    const buyerMatch = text.match(/क्रेता पक्षकार-?\s*([^\n]+)/i);
    const buyerName = buyerMatch ? buyerMatch[1].trim() : "";

    // 2. Property Address ढूंढने के लिए
    const addressMatch = text.match(/विक्रय संपत्ति का पूर्ण विवरण[ः:]\s*([^\n]+(?:\n[^\n]+){0,2})/i);
    const propertyAddress = addressMatch ? addressMatch[1].trim() : "";

    // 3. Plot Area ढूंढने के लिए
    const areaMatch = text.match(/क्षेत्रफल[^\d]*([\d\s×x*]+(?:वर्गफिट|sq\.?\s*ft|वर्गमीटर)?)/i);
    const plotArea = areaMatch ? areaMatch[1].trim() : "";

    return {
      buyerName,
      propertyAddress,
      plotArea,
    };
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setExtractedText("Scanning document with AI...");
    setParsedData({ buyerName: "", propertyAddress: "", plotArea: "" });

    try {
      // Tesseract worker create karein
      const worker = await createWorker('eng');
      const ret = await worker.recognize(file);
      
      const text = ret.data.text;
      setExtractedText(text);

      // टेक्स्ट मिलने के बाद ऑटो-पार्सिंग रन करें
      const extracted = parseDocumentText(text);
      setParsedData(extracted);

      await worker.terminate();
    } catch (error) {
      console.error(error);
      setExtractedText("Error reading document.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-md space-y-6">
      <h2 className="text-xl font-bold mb-4">AI Document Reader & Extractor</h2>
      
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleImageUpload}
        className="mb-4 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      {loading && <p className="text-blue-600 font-medium">Processing document, please wait...</p>}

      {/* Parsed Data Output Box */}
      <div className="grid grid-cols-1 gap-4 p-4 bg-slate-50 border rounded-lg">
        <h3 className="font-semibold text-slate-700">Auto-Extracted Details:</h3>
        
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase">Buyer Name:</label>
          <input 
            type="text" 
            value={parsedData.buyerName} 
            readOnly 
            placeholder="Will auto-populate..."
            className="w-full mt-1 p-2 border rounded bg-white text-sm font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase">Property Address:</label>
          <textarea 
            value={parsedData.propertyAddress} 
            readOnly 
            rows={2}
            placeholder="Will auto-populate..."
            className="w-full mt-1 p-2 border rounded bg-white text-sm font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase">Plot Area:</label>
          <input 
            type="text" 
            value={parsedData.plotArea} 
            readOnly 
            placeholder="Will auto-populate..."
            className="w-full mt-1 p-2 border rounded bg-white text-sm font-medium"
          />
        </div>
      </div>

      {/* Full Extracted Text Output */}
      <div className="mt-4">
        <label className="block font-semibold mb-2">Full Raw Extracted Text:</label>
        <textarea 
          value={extractedText} 
          readOnly 
          rows={6}
          className="w-full p-3 border rounded-md bg-gray-50 text-xs text-gray-600"
          placeholder="Scanned text will appear here..."
        />
      </div>
    </div>
  );
}