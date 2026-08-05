import React from 'react';
import EquipmentCard from '../EquipmentCard';
import SortToolbar from '../SortToolbar';
import { Equipment } from '../../types';
import { Repeat, X } from 'lucide-react';
import { TwinGroup } from '../../utils';

interface DashboardViewProps {
  data: Equipment[];
  loading: boolean;
  twinManometers: TwinGroup[];
  categoryFilter: string[];
  statusFilters: string[];
  searchTerm: string;
  onFilterPill: (cat: string, e: React.MouseEvent) => void;
  onResetFilters: () => void;
  sortConfig: { key: string; dir: 'asc' | 'desc' } | null;
  onSort: (key: string, dir: 'asc' | 'desc') => void;
  onViewDetails: (item: Equipment) => void;
  isItemTwin: (item: Equipment) => boolean;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  data, loading, twinManometers, categoryFilter, statusFilters, searchTerm,
  onFilterPill, onResetFilters, sortConfig, onSort, onViewDetails, isItemTwin
}) => {
  return (
    <div className="p-2 sm:p-4">
      {twinManometers.length > 0 && twinManometers.some(t => t.needsSwap) && (
          <div className="mb-3 sm:mb-4 grid grid-cols-1 lg:grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-4 duration-500">
              {twinManometers.filter(t => t.needsSwap).map((twin, idx) => (
                  <div key={idx} className="bg-gradient-to-r from-blue-900/40 to-slate-900/40 border border-blue-500/30 rounded-lg sm:rounded-xl p-2 sm:p-3 flex items-center justify-between shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                      <div className="flex items-center gap-2 sm:gap-3">
                          <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-full text-blue-400"><Repeat size={14} className="sm:w-[16px] sm:h-[16px]" /></div>
                          <div>
                              <h4 className="text-white font-bold text-[10px] sm:text-[12px] leading-tight">Sugestão de Troca</h4>
                              <p className="text-[8px] sm:text-[10px] text-slate-400 mt-0.5">Local: <span className="text-blue-300">{twin.principal.local || 'N/A'}</span></p>
                          </div>
                      </div>
                      <div className="text-right">
                          <div className="text-[8px] sm:text-[10px] text-white font-mono"><span className="text-red-400">{twin.principal.tag}</span> <span className="text-slate-600">↔</span> <span className="text-emerald-400">{twin.reserva.tag}</span></div>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* Menu de Filtros Ultra Compacto */}
      <div className="flex flex-wrap gap-1.5 items-center mb-3 sm:mb-4 pb-2.5 sm:pb-3 border-b border-[rgba(148,163,184,0.08)]">
        {['all', 'NR-10', 'MANÔMETROS', 'DEMAIS EQUIPAMENTOS'].map(cat => {
            const isActive = cat === 'all' 
                ? categoryFilter.includes('all') 
                : categoryFilter.includes(cat) && !categoryFilter.includes('all');
                
            return (
              <button 
                key={cat} 
                onClick={(e) => onFilterPill(cat, e)} 
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg text-[9px] sm:text-[11px] font-bold transition-all border ${isActive ? 'bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white border-transparent shadow-[0_2px_8px_rgba(59,130,246,0.3)]' : 'bg-[rgba(17,24,39,0.92)] border-[rgba(148,163,184,0.25)] text-[#94a3b8] hover:border-[#3b82f6] hover:text-white'}`}
              >
                {cat === 'all' ? 'Todos' : cat}
              </button>
            );
        })}
        {(!categoryFilter.includes('all') || statusFilters.length > 0 || searchTerm !== '') && (
            <button onClick={onResetFilters} className="px-2 py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[11px] font-bold text-white bg-red-500/20 border border-red-500/50 hover:bg-red-500 hover:border-red-500 transition-all flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-in fade-in slide-in-from-left-2"><X size={10} /> Limpar</button>
        )}
        <div className="ml-auto scale-75 sm:scale-90 origin-right">
            <SortToolbar itemCount={data.length} sortConfig={sortConfig} onSort={onSort} />
        </div>
      </div>

      {/* GRID DE ALTA DENSIDADE: 2 a 3 colunas no celular, 8 colunas no desktop largo. Gaps reduzidos ao extremo. */}
      <div className="grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5 sm:gap-3 pb-20">
        {loading ? [...Array(12)].map((_, i) => <div key={i} className="h-28 sm:h-36 rounded-lg sm:rounded-xl bg-[#111827]/50 animate-pulse border border-[rgba(148,163,184,0.16)] relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div></div>) : data.length === 0 ? <div className="col-span-full text-center py-20 text-[#64748b]"><p className="text-sm sm:text-base font-medium">Nenhum equipamento encontrado.</p></div> : data.map(item => {
            const twinGroup = twinManometers.find(g => g.principal.item === item.item || g.reserva.item === item.item);
            let swapAction: 'replace' | 'install' | undefined;
            if (twinGroup && twinGroup.needsSwap) {
               if (twinGroup.principal.item === item.item) swapAction = 'replace';
               if (twinGroup.reserva.item === item.item) swapAction = 'install';
            }

            return <EquipmentCard key={item.internalId || item.tag} item={item} onViewDetails={onViewDetails} isTwin={isItemTwin(item)} swapAction={swapAction} />
        })}
      </div>
    </div>
  );
};

export default DashboardView;
