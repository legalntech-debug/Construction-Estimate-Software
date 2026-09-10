import React, { useState, useEffect } from 'react';

interface EditElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: any;
  onSave: (updatedElement: any) => void;
  onDelete: (id: string) => void;
}

export const EditElementModal: React.FC<EditElementModalProps> = ({
  isOpen,
  onClose,
  element,
  onSave,
  onDelete,
}) => {
  const [textValue, setTextValue] = useState('');
  const [dimensionLabel, setDimensionLabel] = useState('');

  useEffect(() => {
    if (element) {
      setTextValue(element.text || element.label || '');
      setDimensionLabel(element.dimension || '');
    }
  }, [element]);

  if (!isOpen || !element) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...element,
      text: textValue,
      label: textValue,
      dimension: dimensionLabel,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-4 w-full max-w-md text-slate-100 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
          <h3 className="font-extrabold text-cyan-400 text-sm uppercase">✏️ Edit Canvas Element</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold">✕</button>
        </div>

        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-bold uppercase mb-1">Text / Label Content</label>
            <input 
              type="text" 
              value={textValue} 
              onChange={(e) => setTextValue(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-cyan-500 focus:outline-none"
              placeholder="Enter text or label..."
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold uppercase mb-1">Dimension / Size Note</label>
            <input 
              type="text" 
              value={dimensionLabel} 
              onChange={(e) => setDimensionLabel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-cyan-500 focus:outline-none"
              placeholder="e.g. 40'-0&quot;"
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-800">
            <button 
              type="button" 
              onClick={() => { onDelete(element.id); onClose(); }}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-bold transition-all"
            >
              🗑️ Delete Element
            </button>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded font-bold"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-1.5 rounded font-bold shadow"
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};