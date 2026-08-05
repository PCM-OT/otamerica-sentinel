import React from 'react';
import { ArrowUp, ArrowDown, Calendar } from 'lucide-react';

interface SortToolbarProps {
  itemCount: number;
  sortConfig: { key: string; dir: 'asc' | 'desc' } | null;
  onSort: (key: string, dir: 'asc' | 'desc') => void;
}

const SortToolbar: React.FC<SortToolbarProps> = ({ itemCount, sortConfig, onSort }) => {
  return (
    <div className="ml-auto flex gap-2 items-center flex-wrap justify-end">
        <span className="text-[11px] text-[#64748b] mr-2 uppercase tracking-wider hidden md:inline-block">{itemCount} itens</span>
        <div className="flex items-center gap-1 p-1 bg-[#0f172a] border border-[#1e293b] rounded-xl">
            <div className="pl-2 pr-1 text-slate-500 flex items-center justify-center"><Calendar size={14}/></div>
            <button onClick={() => onSort('date', 'asc')} className={`p-1.5 rounded-lg transition-all ${sortConfig?.key === 'date' && sortConfig.dir === 'asc' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}><ArrowUp size={14}/></button>
            <button onClick={() => onSort('date', 'desc')} className={`p-1.5 rounded-lg transition-all ${sortConfig?.key === 'date' && sortConfig.dir === 'desc' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}><ArrowDown size={14}/></button>
        </div>
        <div className="flex items-center gap-1 p-1 bg-[#0f172a] border border-[#1e293b] rounded-xl">
            <button onClick={() => onSort('tag', 'asc')} className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${sortConfig?.key === 'tag' && sortConfig.dir === 'asc' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>A-Z</button>
            <button onClick={() => onSort('tag', 'desc')} className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${sortConfig?.key === 'tag' && sortConfig.dir === 'desc' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>Z-A</button>
        </div>
    </div>
  );
};

export default SortToolbar;