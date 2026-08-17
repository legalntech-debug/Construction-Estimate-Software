// src/app/(dashboard)/mis/components/ActionMenu.tsx
interface ActionMenuProps {
  rec: any;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  handleReopen: (record: any) => void;
  handleArchive: (id: string) => void;
}

export default function ActionMenu({
  rec,
  activeMenuId,
  setActiveMenuId,
  handleReopen,
  handleArchive,
}: ActionMenuProps) {
  return (
    <td className="p-3 text-center relative overflow-visible">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setActiveMenuId(rec.id === activeMenuId ? null : rec.id);
        }} 
        className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded font-black text-[10px] uppercase transition-all border border-blue-200"
      >
        {activeMenuId === rec.id ? "CLOSE" : "ACTION"}
      </button>

      {activeMenuId === rec.id && (
        <div className="fixed sm:absolute right-10 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 mt-2 w-36 bg-white border border-slate-300 shadow-2xl rounded-lg z-[9999] text-[10px] overflow-hidden">
          <button 
            onClick={() => {
              setActiveMenuId(null);
              handleReopen(rec);
            }} 
            className="w-full text-left p-2.5 hover:bg-slate-100 uppercase text-slate-700 font-bold border-b border-slate-100 flex items-center gap-2"
          >
            REOPEN CASE
          </button>
          <button 
            onClick={() => {
              setActiveMenuId(null);
              handleArchive(rec.id);
            }} 
            className="w-full text-left p-2.5 hover:bg-red-50 uppercase text-red-600 font-bold flex items-center gap-2"
          >
            DELETE CASE
          </button>
        </div>
      )}
    </td>
  );
}