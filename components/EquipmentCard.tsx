import React from 'react';
import { Eye, MapPin, Calendar, Layers, ArrowRightLeft } from 'lucide-react';
import { Equipment } from '../types';
import { formatDateBR, getDaysUntilExpiry, parseDateSafe } from '../utils';

interface EquipmentCardProps {
  item: Equipment;
  onViewDetails: (item: Equipment) => void;
  statusOverride?: string;
  isTwin?: boolean;
  swapAction?: 'replace' | 'install'; 
}

const EquipmentCard: React.FC<EquipmentCardProps> = ({ item, onViewDetails, statusOverride, isTwin, swapAction }) => {
  const days = getDaysUntilExpiry(item);
  
  let statusColor = 'from-brand-primary to-brand-secondary'; 
  let statusText = 'EM DIA';
  let badgeClass = 'bg-[rgba(16,185,129,0.1)] text-[#34d399] border-[rgba(16,185,129,0.3)]';
  let themeStatus = 'VALIDO'; 

  if (statusOverride === 'Reprovado' || item.status === 'Reprovado') {
    statusColor = 'from-[#ff003c] to-[#ff4d73]'; 
    statusText = 'REPROVADO';
    badgeClass = 'bg-[rgba(255,0,60,0.15)] text-[#ff4d73] border-[rgba(255,0,60,0.4)] shadow-[0_0_10px_rgba(255,0,60,0.2)]';
    themeStatus = 'REPROVADO';
  } else if (statusOverride === 'Obsoleto' || item.status === 'Obsoleto') {
    statusColor = 'from-slate-600 to-slate-700';
    statusText = 'OBSOLETO';
    badgeClass = 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    themeStatus = 'OBSOLETO';
  } else if (days !== null) {
    if (days < 0) {
      statusColor = 'from-[#ef4444] to-[#f87171]';
      statusText = 'VENCIDO';
      badgeClass = 'bg-[rgba(239,68,68,0.1)] text-[#f87171] border-[rgba(239,68,68,0.3)]';
      themeStatus = 'VENCIDO';
    } else if (days <= 45) { 
      statusColor = 'from-[#f59e0b] to-[#fbbf24]';
      statusText = 'PRÓXIMO';
      badgeClass = 'bg-[rgba(245,158,11,0.1)] text-[#fbbf24] border-[rgba(245,158,11,0.3)]';
      themeStatus = 'ATENCAO';
    } else {
      statusColor = 'from-[#10b981] to-[#34d399]';
      statusText = 'EM DIA';
      badgeClass = 'bg-[rgba(16,185,129,0.1)] text-[#34d399] border-[rgba(16,185,129,0.3)]';
      themeStatus = 'VALIDO';
    }
  } else {
    statusColor = 'from-slate-600 to-slate-700';
    statusText = 'N/A';
    badgeClass = 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    themeStatus = 'VALIDO'; 
  }

  const getStatusTheme = () => {
    switch (themeStatus) {
      case 'REPROVADO':
        return { hoverBorder: 'hover:border-[#ff003c]', hoverShadow: 'hover:shadow-[0_0_15px_rgba(255,0,60,0.25)]', iconColor: 'text-[#ff003c]', btnHover: 'hover:bg-[#ff003c]/10 hover:border-[#ff003c]/50 hover:text-[#ff4d73]' };
      case 'VENCIDO':
        return { hoverBorder: 'hover:border-red-500', hoverShadow: 'hover:shadow-[0_2px_15px_rgba(239,68,68,0.15)]', iconColor: 'text-red-500', btnHover: 'hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400' };
      case 'ATENCAO':
        return { hoverBorder: 'hover:border-amber-500', hoverShadow: 'hover:shadow-[0_2px_15px_rgba(245,158,11,0.15)]', iconColor: 'text-amber-500', btnHover: 'hover:bg-amber-500/10 hover:border-amber-500/50 hover:text-amber-400' };
      case 'OBSOLETO':
        return { hoverBorder: 'hover:border-slate-500', hoverShadow: 'hover:shadow-[0_2px_15px_rgba(100,116,139,0.15)]', iconColor: 'text-slate-500', btnHover: 'hover:bg-slate-500/10 hover:border-slate-500/50 hover:text-slate-400' };
      case 'VALIDO':
      default:
        if (statusText === 'N/A') {
             return { hoverBorder: 'hover:border-slate-400', hoverShadow: 'hover:shadow-[0_2px_15px_rgba(148,163,184,0.15)]', iconColor: 'text-slate-400', btnHover: 'hover:bg-slate-500/10 hover:border-slate-500/50 hover:text-slate-300' };
        }
        return { hoverBorder: 'hover:border-emerald-500', hoverShadow: 'hover:shadow-[0_2px_15px_rgba(16,185,129,0.15)]', iconColor: 'text-emerald-500', btnHover: 'hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:text-emerald-400' };
    }
  };

  const theme = getStatusTheme();

  const getSwapStyle = () => {
    if (swapAction === 'replace') return { borderClass: 'border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse', message: 'TROCA', msgColor: 'text-amber-400', bg: 'bg-amber-500/20' };
    if (swapAction === 'install') return { borderClass: 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]', message: 'INSTALAR', msgColor: 'text-emerald-400', bg: 'bg-emerald-500/20' };
    return null;
  };

  const swapStyle = getSwapStyle();

  return (
    <div 
        onClick={() => onViewDetails(item)}
        className={`group relative bg-[rgba(17,24,39,0.8)] rounded-lg sm:rounded-xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 cursor-pointer flex flex-col 
        ${swapStyle ? swapStyle.borderClass : `border-[rgba(148,163,184,0.15)] ${theme.hoverBorder} ${theme.hoverShadow}`}`}
    >
        {/* Tira de status super fina */}
        <div className={`h-0.5 sm:h-1 w-full bg-gradient-to-r ${statusColor} shrink-0`} />

        {/* Paddings ultra reduzidos: p-1.5 no mobile, p-3 no desktop */}
        <div className="p-1.5 sm:p-3 flex flex-col h-full">
            <div className="flex justify-between items-start mb-1.5 sm:mb-2.5">
                <div className="flex flex-col min-w-0 pr-1">
                    <span className="text-[7px] sm:text-[9px] font-bold text-[#64748b] uppercase tracking-wider mb-0.5 leading-none">TAG</span>
                    <h3 className="text-[10px] sm:text-[13px] font-bold text-white font-mono tracking-tight truncate leading-none">{item.tag}</h3>
                </div>
                <div className="flex flex-col items-end gap-0.5 sm:gap-1 shrink-0">
                    <div className={`px-1 py-0.5 sm:px-1.5 rounded-[3px] sm:rounded text-[6px] sm:text-[8px] font-bold uppercase tracking-wider leading-none ${badgeClass}`}>
                        {statusText}
                    </div>
                    {isTwin && (
                        <div className={`flex items-center gap-0.5 text-[6px] sm:text-[7px] font-bold px-1 py-0.5 rounded-[3px] border shadow-sm backdrop-blur-md leading-none ${swapStyle ? `${swapStyle.bg} border-transparent ${swapStyle.msgColor}` : 'text-cyan-300 bg-cyan-950/40 border-cyan-800/50'}`}>
                            {swapStyle ? (
                                <><ArrowRightLeft size={6} className={swapAction === 'replace' ? 'animate-spin-slow' : ''} /> {swapStyle.message}</>
                            ) : (
                                <><span className="text-[7px] sm:text-[8px] leading-none">∞</span> GÊMEO</>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Espaçamentos e fontes mínimas no corpo do card */}
            <div className="space-y-1 sm:space-y-1.5 mb-1.5 sm:mb-3 flex-1">
                <div className="flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[11px] text-[#94a3b8] leading-tight">
                    <Layers size={9} className={`${theme.iconColor} shrink-0 sm:w-[12px] sm:h-[12px]`} />
                    <span className="truncate" title={item.equipamento || item.modelo || 'N/A'}>{item.equipamento || item.modelo || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[11px] text-[#94a3b8] leading-tight">
                    <MapPin size={9} className={`${theme.iconColor} shrink-0 sm:w-[12px] sm:h-[12px]`} />
                    <span className="truncate" title={item.local || item.localizacao || 'N/A'}>{item.local || item.localizacao || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[11px] text-[#94a3b8] leading-tight">
                    <Calendar size={9} className={`${theme.iconColor} shrink-0 sm:w-[12px] sm:h-[12px]`} />
                    <span className="truncate">{formatDateBR(parseDateSafe(item.dataProximaCalibracao || item.dataProximaInspecao || item.dataValidade))}</span>
                </div>
            </div>

            {/* Botão sutil e fino para manter o card clicável mas poupar espaço */}
            <div 
                className={`w-full py-0.5 sm:py-1 rounded-md bg-[#1e293b]/50 text-[#94a3b8] text-[0px] sm:text-[10px] font-semibold border border-[rgba(148,163,184,0.05)] transition-all flex items-center justify-center gap-1 group-hover:shadow-md mt-auto shrink-0 ${theme.btnHover}`}
            >
                <Eye size={10} className="sm:w-[12px] sm:h-[12px]" /> <span className="hidden sm:inline">Detalhes</span>
            </div>
        </div>
    </div>
  );
};

export default EquipmentCard;
