"use client";
import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';

interface DocumentScannerProps {
  onScanComplete: (data: { customerName: string; propertyAddress: string; plotArea: string }) => void;
}

export default function DocumentScanner({ onScanComplete }: DocumentScannerProps) {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("📄 SCAN & FILL");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseDocumentText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    let buyerName = "";
    let propertyAddress = "";
    let plotArea = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!buyerName && (line.includes("क्रेता") || line.includes("Purchaser") || line.includes("Buyer") || line.includes("Applicant"))) {
        if (lines[i + 1] && lines[i + 1].length > 3) {
          buyerName = lines[i + 1];
        } else {
          buyerName = line;
        }
      }

      if (!propertyAddress && (line.includes("संपत्ति") || line.includes("Property") || line.includes("Address") || line.includes("Location") || line.includes("Plot No"))) {
        let fullAddr = line;
        for (let j = 1; j <= 2; j++) {
          if (lines[i + j]) fullAddr += ", " + lines[i + j];
        }
        propertyAddress = fullAddr;
      }

      if (!plotArea && (line.includes("वर्ग फिट") || line.includes("Sq.Ft") || line.includes("SQFT") || line.includes("Sq. Ft") || line.includes("क्षेत्रफल"))) {
        const match = line.match(/([\d,]+\.?\d*)\s*(वर्ग|Sq|SQ|sq)/i);
        if (match) {
          plotArea = match[1];
        } else {
          plotArea = line;
        }
      }
    }

    if (!buyerName) {
      const match = text.match(/(?:Name|Buyer|Purchaser|क्रेता)[:\-]?\s*([A-Z\s]{4,})/i);
      if (match) buyerName = match[1].trim();
    }

    if (!plotArea) {
      const areaMatch = text.match(/([\d]{2,5})\s*(?:Sq\.?\s*Ft|वर्ग\s*फिट|SQFT)/i);
      if (areaMatch) plotArea = areaMatch[1];
    }

    return {
      buyerName: buyerName.toUpperCase(),
      propertyAddress: propertyAddress.toUpperCase(),
      plotArea: plotArea.replace(/[^0-9.]/g, ''),
    };
  };

  // डायनेमिकली PDF.js को लोड करने का तरीका ताकि OMMatrix का एरर न आए
  const convertPdfToImageBlob = async (file: File): Promise<string> => {
    const pdfjsLib = await import('pdfjs-dist');
    
    if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);

    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) throw new Error("Canvas context failed");

    await page.render({ canvasContext: context, viewport, canvas }).promise;
    return canvas.toDataURL('image/png');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusText("PROCESSING...");

    try {
      let imageSource: string | File = file;

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        setStatusText("CONVERTING PDF...");
        imageSource = await convertPdfToImageBlob(file);
      }

      setStatusText("SCANNING...");
      const worker = await createWorker('eng');
      const ret = await worker.recognize(imageSource);
      
      const text = ret.data.text;
      const extracted = parseDocumentText(text);
      
      onScanComplete({
        customerName: extracted.buyerName,
        propertyAddress: extracted.propertyAddress,
        plotArea: extracted.plotArea
      });

      await worker.terminate();
      alert("Document scanned and details filled successfully!");
    } catch (error) {
      console.error(error);
      alert("Error reading document. Please make sure the document is clear.");
    } finally {
      setLoading(false);
      setStatusText("📄 SCAN & FILL");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*,application/pdf" 
        onChange={handleFileChange}
        className="hidden" 
      />

      <button 
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="cursor-pointer bg-blue-600 text-white px-4 py-2 text-[10pt] font-bold uppercase border border-black hover:bg-blue-700 transition flex items-center gap-2 whitespace-nowrap"
      >
        {statusText}
      </button>
    </>
  );
}