import React, { useState } from 'react';
import { 
  ShieldCheck, LayoutDashboard, BarChart3, CheckCircle2, 
  AlertTriangle, AlertCircle, XOctagon, Archive, PlusCircle, 
  Download, QrCode, Lightbulb, Linkedin, BookOpen, ListChecks,
  Menu, X // Adicionado ícones do menu mobile
} from 'lucide-react';
import { ViewType } from '../types';

interface SidebarProps {
  currentView: ViewType;
  onChangeView: (view: ViewType) => void;
  onFilter: (status: string, multi: boolean) => void;
  activeFilters: string[];
  stats: { total: number; ok: number; warn: number; danger: number; rejected: number; obsolete: number };
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onFilter, activeFilters, stats }) => {
  // Estado para controlar se o menu está aberto no celular
  const [isOpen, setIsOpen] = useState(false);

  // Envolvemos a mudança de view para também fechar o menu no mobile
  const handleViewChange = (view: ViewType) => {
    onChangeView(view);
    setIsOpen(false);
  };

  // Envolvemos o filtro para também fechar o menu no mobile
  const handleFilterClick = (e: React.MouseEvent, status: string) => {
    const isMulti = e.ctrlKey || e.metaKey;
    onFilter(status, isMulti);
    setIsOpen(false);
  };

  const NavItem = ({ view, icon: Icon, label, badge, color }: any) => (
    <div 
      onClick={() => handleViewChange(view)}
      className={`relative group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-300 border border-transparent
        ${currentView === view 
          ? 'bg-gradient-to-r from-blue-600/20 to-blue-500/10 text-white border-brand-primary shadow-[0_8px_26px_rgba(59,130,246,0.4)] font-semibold' 
          : 'text-[#94a3b8] hover:bg-[rgba(17,24,39,0.92)] hover:text-white hover:border-[#94a3b840] hover:translate-x-1'
        }
      `}
    >
      {/* Active Indicator Line */}
      {currentView === view && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[70%] bg-brand-primary rounded-r-sm" />
      )}
      
      <Icon size={16} className={`transition-colors ${currentView === view ? 'text-brand-primary' : 'group-hover:text-white'}`} />
      <span className="text-[13px] tracking-wide">{label}</span>
      {badge !== undefined && (
        <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border backdrop-blur-md shadow-sm
          ${color === 'success' ? 'bg-[#10b981] text-black border-transparent' : 
            color === 'warning' ? 'bg-[#f59e0b] text-black border-transparent' :
            color === 'danger' ? 'bg-[#ef4444] text-white border-transparent' :
            'bg-[#111827]/90 text-white border-[#94a3b866]'
          }
        `}>
          {badge}
        </span>
      )}
    </div>
  );

  const isFilterActive = (status: string) => activeFilters.includes(status);

  return (
    <>
      {/* Botão Flutuante Mobile (FAB) */}
      <button
        onClick={() => setIsOpen(true)}
        className={`lg:hidden fixed bottom-6 right-6 z-[45] w-14 h-14 bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(59,130,246,0.4)] transition-all duration-300 ${
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100 hover:-translate-y-1'
        }`}
      >
        <Menu size={26} />
      </button>

      {/* Overlay Escuro para Mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50] lg:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Principal (Sliding Drawer no Mobile) */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-[60] flex flex-col w-[260px] h-screen border-r border-[#94a3b840] bg-gradient-to-b from-[rgba(17,24,39,0.98)] to-[rgba(5,8,20,0.99)] backdrop-blur-xl transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Decorative Sidebar Line */}
        <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-brand-primary to-transparent opacity-30 pointer-events-none" />

        {/* Brand Logo & Botão de Fechar no Mobile */}
        <div className="flex items-center justify-between mx-5 mt-5 mb-6 shrink-0">
          <div 
            className="flex items-center gap-3 cursor-pointer group select-none"
            onClick={() => handleViewChange('dashboard')}
          >
            <ShieldCheck size={28} className="text-brand-primary transition-transform group-hover:scale-110" strokeWidth={2.5} />
            <div className="flex flex-col">
              <span className="text-xl font-black text-white tracking-tight leading-none">OTAMERICA</span>
              <span className="text-[10px] font-bold text-brand-primary uppercase tracking-[0.25em] mt-0.5">SENTINEL</span>
            </div>
          </div>
          
          <button 
            onClick={() => setIsOpen(false)} 
            className="lg:hidden text-[#64748b] hover:text-white p-1 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4 custom-scrollbar">
          <section>
            <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-[1.5px] mb-1.5 ml-2 flex items-center gap-2">
              <span className="w-3 h-0.5 bg-brand-primary rounded-full"></span> Painel
            </div>
            <div className="space-y-0.5">
              <NavItem view="dashboard" icon={LayoutDashboard} label="Visão Geral" badge={stats.total} />
              <NavItem view="analytics" icon={BarChart3} label="Analytics" />
            </div>
          </section>

          <section>
            <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-[1.5px] mb-1.5 ml-2 flex items-center gap-2">
              <span className="w-3 h-0.5 bg-brand-primary rounded-full"></span> Filtros
            </div>
            <div className="space-y-1">
              <div 
                onClick={(e) => handleFilterClick(e, 'ok')} 
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-300
                  ${isFilterActive('ok') 
                    ? 'bg-[#10b9812e] border-[#10b981] shadow-[0_0_20px_rgba(16,185,129,0.25)]' 
                    : 'border-transparent hover:bg-[#10b98115] hover:border-[#10b98166]'
                  }
                `}
              >
                <CheckCircle2 size={16} className={`${isFilterActive('ok') ? 'text-[#10b981]' : 'text-[#94a3b8] group-hover:text-[#10b981]'} transition-colors`} /> 
                <span className={`text-[13px] font-medium ${isFilterActive('ok') ? 'text-white' : 'text-[#94a3b8] group-hover:text-white'}`}>Válidos</span>
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] bg-[#10b981] text-black font-bold font-mono">{stats.ok}</span>
              </div>

              <div 
                onClick={(e) => handleFilterClick(e, 'warn')} 
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-300
                  ${isFilterActive('warn') 
                    ? 'bg-[#f59e0b2e] border-[#f59e0b] shadow-[0_0_20px_rgba(245,158,11,0.25)]' 
                    : 'border-transparent hover:bg-[#f59e0b15] hover:border-[#f59e0b66]'
                  }
                `}
              >
                <AlertTriangle size={16} className={`${isFilterActive('warn') ? 'text-[#f59e0b]' : 'text-[#94a3b8] group-hover:text-[#f59e0b]'} transition-colors`} />
                <span className={`text-[13px] font-medium ${isFilterActive('warn') ? 'text-white' : 'text-[#94a3b8] group-hover:text-white'}`}>Atenção</span> 
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] bg-[#f59e0b] text-black font-bold font-mono">{stats.warn}</span>
              </div>

              <div 
                onClick={(e) => handleFilterClick(e, 'danger')} 
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-300
                  ${isFilterActive('danger') 
                    ? 'bg-[#ef44442e] border-[#ef4444] shadow-[0_0_20px_rgba(239,68,68,0.25)]' 
                    : 'border-transparent hover:bg-[#ef444415] hover:border-[#ef444466]'
                  }
                `}
              >
                <AlertCircle size={16} className={`${isFilterActive('danger') ? 'text-[#ef4444]' : 'text-[#94a3b8] group-hover:text-[#ef4444]'} transition-colors`} />
                <span className={`text-[13px] font-medium ${isFilterActive('danger') ? 'text-white' : 'text-[#94a3b8] group-hover:text-white'}`}>Vencidos</span> 
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] bg-[#ef4444] text-white font-bold font-mono">{stats.danger}</span>
              </div>
            </div>
          </section>

          <section>
            <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-[1.5px] mb-1.5 ml-2 flex items-center gap-2">
              <span className="w-3 h-0.5 bg-brand-primary rounded-full"></span> Especiais
            </div>
            <div className="space-y-0.5">
              <NavItem view="rejected" icon={XOctagon} label="Reprovados" badge={stats.rejected} />
              <NavItem view="obsolete" icon={Archive} label="Obsoletos" badge={stats.obsolete} />
            </div>
          </section>

          <section>
            <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-[1.5px] mb-1.5 ml-2 flex items-center gap-2">
              <span className="w-3 h-0.5 bg-brand-primary rounded-full"></span> Ferramentas
            </div>
            <div className="space-y-0.5">
              <NavItem view="register" icon={PlusCircle} label="Novo Cadastro" />
              <NavItem view="export" icon={Download} label="Exportação" />
              <NavItem view="bulk-qr" icon={QrCode} label="QR Codes (Lista)" />
              <NavItem view="suggestions" icon={Lightbulb} label="Sugestões" />
              <NavItem view="review-suggestions" icon={ListChecks} label="Avaliar Sugestões" />
              <NavItem view="manual" icon={BookOpen} label="Manual do Usuário" />
            </div>
          </section>
        </div>

        <a href="https://www.linkedin.com/in/lgcurty/" target="_blank" rel="noreferrer" className="mx-3 mb-3 p-3 rounded-xl border border-[#94a3b840] bg-gradient-to-br from-[rgba(59,130,246,0.12)] to-[rgba(37,99,235,0.05)] hover:from-[rgba(59,130,246,0.25)] hover:to-[rgba(37,99,235,0.18)] hover:border-brand-primary hover:shadow-[0_18px_40px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 transition-all duration-300 group flex items-center gap-3 shrink-0">
          <Linkedin size={20} className="text-brand-primary" />
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-white">Luís Gustavo Curty</span>
            <span className="text-[9px] text-brand-primary font-medium"> Developer LinkedIn</span>
          </div>
        </a>
      </aside>
    </>
  );
};

export default Sidebar;
