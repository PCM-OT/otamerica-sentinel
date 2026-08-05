import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, Legend, CartesianGrid
} from 'recharts';
import { FilterX } from 'lucide-react';
import { Equipment } from '../../types';

interface AnalyticsViewProps {
  activeData: Equipment[];
  filters: { status: string | null; category: string | null; location: string | null };
  stats: {
    categoryStats: { name: string; value: number }[];
    statusStats: { name: string; value: number; color: string }[];
    locationStats: { name: string; value: number }[];
  };
  onFilterChange: (filters: { status: string | null; category: string | null; location: string | null }) => void;
}

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ filters, stats, onFilterChange }) => {
  const { categoryStats, statusStats, locationStats } = stats;
  const hasFilters = filters.category || filters.status || filters.location;

  return (
    <div className="p-8 pb-20 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">Analytics Interativo</h2>
          {hasFilters && (
              <button 
                  onClick={() => onFilterChange({ status: null, category: null, location: null })}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all"
              >
                  <FilterX size={14} /> Limpar Filtros
              </button>
          )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Status Chart */}
          <div className={`bg-[rgba(17,24,39,0.92)] p-6 rounded-[20px] border transition-all duration-300 shadow-xl ${filters.status ? 'border-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-[rgba(148,163,184,0.15)]'}`}>
              <h3 className="text-sm font-bold text-[#94a3b8] mb-4 uppercase tracking-wider">Status (Clique para filtrar)</h3>
              <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie 
                              data={statusStats} 
                              cx="50%" cy="50%" 
                              innerRadius={60} outerRadius={80} 
                              paddingAngle={5} 
                              dataKey="value"
                              cursor="pointer"
                              onClick={(data) => onFilterChange({ ...filters, status: filters.status === data.name ? null : data.name })}
                          >
                              {statusStats.map((entry, index) => (
                                  <Cell 
                                      key={`cell-${index}`} 
                                      fill={entry.color} 
                                      stroke="rgba(0,0,0,0.2)" 
                                      opacity={filters.status && filters.status !== entry.name ? 0.3 : 1}
                                  />
                              ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }} />
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Category Chart */}
          <div className={`bg-[rgba(17,24,39,0.92)] p-6 rounded-[20px] border transition-all duration-300 shadow-xl ${filters.category ? 'border-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-[rgba(148,163,184,0.15)]'}`}>
              <h3 className="text-sm font-bold text-[#94a3b8] mb-4 uppercase tracking-wider">Categorias</h3>
              <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                          data={categoryStats} 
                          layout="vertical" 
                          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                          onClick={(data: any) => data && data.activePayload && onFilterChange({ ...filters, category: filters.category === data.activePayload[0].payload.name ? null : data.activePayload[0].payload.name })}
                      >
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                          <XAxis type="number" stroke="#94a3b8" tick={{fontSize: 10}} />
                          <YAxis dataKey="name" type="category" width={90} stroke="#94a3b8" tick={{fontSize: 10}} />
                          <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }} />
                          <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} cursor="pointer">
                              {categoryStats.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill="#3b82f6" opacity={filters.category && filters.category !== entry.name ? 0.3 : 1} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

           {/* Location Chart (Top 5) */}
           <div className={`bg-[rgba(17,24,39,0.92)] p-6 rounded-[20px] border transition-all duration-300 shadow-xl ${filters.location ? 'border-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-[rgba(148,163,184,0.15)]'}`}>
              <h3 className="text-sm font-bold text-[#94a3b8] mb-4 uppercase tracking-wider">Top 5 Locais</h3>
              <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                          data={locationStats} 
                          layout="vertical" 
                          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                          onClick={(data: any) => data && data.activePayload && onFilterChange({ ...filters, location: filters.location === data.activePayload[0].payload.name ? null : data.activePayload[0].payload.name })}
                      >
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                          <XAxis type="number" stroke="#94a3b8" tick={{fontSize: 10}} />
                          <YAxis dataKey="name" type="category" width={90} stroke="#94a3b8" tick={{fontSize: 10}} />
                          <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }} />
                          <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} cursor="pointer">
                              {locationStats.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill="#8b5cf6" opacity={filters.location && filters.location !== entry.name ? 0.3 : 1} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>
      
      {/* Filter Summary */}
      <div className="mt-8 p-4 rounded-xl bg-[#1e293b]/50 border border-[#334155] flex items-center gap-4">
           <div className="text-sm font-bold text-[#94a3b8]">Filtros Ativos:</div>
           <div className="flex gap-2">
               {filters.status && <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">Status: {filters.status}</span>}
               {filters.category && <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">Categ: {filters.category}</span>}
               {filters.location && <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold border border-purple-500/30">Local: {filters.location}</span>}
               {!hasFilters && <span className="text-xs text-slate-500 italic">Nenhum filtro selecionado. Clique nos gráficos para interagir.</span>}
           </div>
      </div>
    </div>
  );
};

export default AnalyticsView;