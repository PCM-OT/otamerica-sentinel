import React, { useState, useEffect, useMemo } from 'react';
import { Search, Layers, Edit3 } from 'lucide-react';
import { Equipment } from '../../types';

interface EditViewProps {
  data: Equipment[];
  onStartEditing: (item: Equipment) => void;
}

const EditView: React.FC<EditViewProps> = ({ data, onStartEditing }) => {
  const [editSearch, setEditSearch] = useState('');
  const [debouncedEditSearch, setDebouncedEditSearch] = useState('');

  useEffect(() => {
    if (editSearch.trim() === '') {
        setDebouncedEditSearch('');
        return;
    }
    const handler = setTimeout(() => {
      setDebouncedEditSearch(editSearch);
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [editSearch]);

  const filteredEditList = useMemo(() => {
    const term = debouncedEditSearch.trim().toLowerCase();
    if (term.length <= 1) return [];
    return data.filter(d => 
      d.tag.toLowerCase().includes(term) || 
      (d.equipamento || '').toLowerCase().includes(term) ||
      (d.modelo || '').toLowerCase().includes(term) ||
      (d.local || '').toLowerCase().includes(term) ||
      (d.localizacao || '').toLowerCase().includes(term)
    );
  }, [debouncedEditSearch, data]);

  return (
    <div className="p-8 pb-20 max-w-5xl mx-auto h-full flex flex-col">
        <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-2">Central de Edição</h2>
            <p className="text-[#94a3b8]">Busque pelo TAG ou nome do equipamento para editar suas informações.</p>
        </div>

        <div className="relative max-w-2xl mx-auto w-full mb-10">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="text-[#64748b]" size={20} />
            </div>
            <input 
                type="text" 
                autoFocus
                placeholder="Digite o TAG, modelo ou local..." 
                className="w-full bg-[#1e293b] border border-[rgba(148,163,184,0.25)] text-white rounded-2xl py-5 pl-12 pr-6 shadow-2xl focus:border-[#3b82f6] focus:ring-4 focus:ring-[#3b82f6]/10 outline-none transition-all text-lg placeholder:text-[#475569]"
                value={editSearch}
                onChange={(e) => setEditSearch(e.target.value)}
            />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {debouncedEditSearch && (
                <div className="space-y-3">
                    {filteredEditList.length > 0 ? (
                        filteredEditList.map(item => (
                            <div key={item.item || item.tag} className="bg-[rgba(17,24,39,0.6)] border border-[rgba(148,163,184,0.1)] p-4 rounded-xl flex items-center justify-between hover:bg-[#1e293b] hover:border-[#3b82f6]/50 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#0f172a] flex items-center justify-center text-[#94a3b8] font-bold border border-[rgba(148,163,184,0.2)]">
                                        <Layers size={18} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white font-mono">{item.tag}</span>
                                            <span className="text-[10px] bg-[#334155] text-[#94a3b8] px-2 py-0.5 rounded-full">{item.categoria}</span>
                                        </div>
                                        <div className="text-sm text-[#64748b] mt-0.5">
                                            {item.equipamento} • {item.local || 'Sem local'}
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onStartEditing(item)}
                                    className="px-4 py-2 bg-[#3b82f6]/10 text-[#3b82f6] rounded-lg font-bold text-sm border border-[#3b82f6]/20 hover:bg-[#3b82f6] hover:text-white transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                                >
                                    Editar
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-[#64748b] bg-[#1e293b]/30 rounded-2xl border border-dashed border-[#334155]">
                            Nenhum equipamento encontrado com "{debouncedEditSearch}".
                        </div>
                    )}
                </div>
            )}
            {!debouncedEditSearch && (
                <div className="flex flex-col items-center justify-center h-full text-[#475569] opacity-50">
                    <Edit3 size={64} className="mb-4" strokeWidth={1} />
                    <p>Comece a digitar para buscar...</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default EditView;