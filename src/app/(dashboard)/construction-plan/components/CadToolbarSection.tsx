import React from "react";

type CadTool = 
  | "SELECT" | "LINE" | "PLINE" | "RECTANGLE" | "OFFSET" 
  | "MOVE" | "COPY" | "ROTATE" | "DELETE" | "DIMENSION" | "TEXT" | "HATCH";

interface CadToolbarSectionProps {
  cadTool: CadTool;
  setCadCommand: (tool: CadTool) => void;
  orthMode: boolean;
  setOrthMode: React.Dispatch<React.SetStateAction<boolean>>;
  osnapMode: boolean;
  setOsnapMode: React.Dispatch<React.SetStateAction<boolean>>;
  undoLastCadAction: () => void;
  copySelectedCadObjects: () => void;
  rotateSelectedCadObjects: (angle: number) => void;
  deleteSelectedCadObjects: () => void;
  cadRotation: number;
  setCadRotation: (val: number) => void;
  cadText: string;
  setCadText: (val: string) => void;
}

export default function CadToolbarSection({
  cadTool,
  setCadCommand,
  orthMode,
  setOrthMode,
  osnapMode,
  setOsnapMode,
  undoLastCadAction,
  copySelectedCadObjects,
  rotateSelectedCadObjects,
  deleteSelectedCadObjects,
  cadRotation,
  setCadRotation,
  cadText,
  setCadText,
}: CadToolbarSectionProps) {
  return (
    <div className="border-b border-black bg-gray-100 p-2 flex gap-1 flex-wrap items-center">
      {(["SELECT", "LINE", "PLINE", "RECTANGLE", "OFFSET", "MOVE", "COPY", "ROTATE", "DELETE", "DIMENSION", "TEXT", "HATCH"] as CadTool[]).map((tool) => (
        <button
          key={tool}
          type="button"
          onClick={() => setCadCommand(tool)}
          className={`px-2 py-1 border border-black text-[9px] font-black cursor-pointer ${
            cadTool === tool 
              ? "bg-black text-white" 
              : "bg-white text-black hover:bg-gray-200"
          }`}
        >
          {tool}
        </button>
      ))}
      
      {/* ORTHO toggle */}
      <button 
        type="button" 
        onClick={() => setOrthMode((v) => !v)} 
        className={`px-2 py-1 border border-black text-[9px] font-black cursor-pointer ${
          orthMode 
            ? "bg-black text-white" 
            : "bg-white text-black hover:bg-gray-200"
        }`}
      >
        ORTHO
      </button>
      
      {/* OSNAP toggle */}
      <button 
        type="button" 
        onClick={() => setOsnapMode((v) => !v)} 
        className={`px-2 py-1 border border-black text-[9px] font-black cursor-pointer ${
          osnapMode 
            ? "bg-black text-white" 
            : "bg-white text-black hover:bg-gray-200"
        }`}
      >
        OSNAP
      </button>
      
      {/* UNDO */}
      <button 
        type="button" 
        onClick={undoLastCadAction} 
        className="px-2 py-1 border border-black text-[9px] font-black bg-white text-black hover:bg-gray-200 cursor-pointer"
      >
        UNDO
      </button>
      
      {/* COPY */}
      <button 
        type="button" 
        onClick={copySelectedCadObjects} 
        className="px-2 py-1 border border-black text-[9px] font-black bg-white text-black hover:bg-gray-200 cursor-pointer"
      >
        COPY
      </button>
      
      {/* ROTATE */}
      <button 
        type="button" 
        onClick={() => rotateSelectedCadObjects(cadRotation)} 
        className="px-2 py-1 border border-black text-[9px] font-black bg-white text-black hover:bg-gray-200 cursor-pointer"
      >
        ROTATE
      </button>
      
      {/* DELETE */}
      <button 
        type="button" 
        onClick={deleteSelectedCadObjects} 
        className="px-2 py-1 border border-black text-[9px] font-black bg-white text-red-600 hover:bg-red-50 cursor-pointer"
      >
        DELETE
      </button>
      
      {/* Rotation input */}
      <input 
        type="number" 
        value={cadRotation} 
        onChange={(e) => setCadRotation(Number(e.target.value) || 0)} 
        className="w-16 border border-black p-1 text-[9px] text-center bg-white text-black" 
        title="Rotation" 
      />
      
      {/* Text input */}
      <input 
        value={cadText} 
        onChange={(e) => setCadText(e.target.value)} 
        placeholder="TEXT" 
        className="w-32 border border-black p-1 text-[9px] bg-white text-black" 
      />
    </div>
  );
}