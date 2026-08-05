import React from 'react';
import { CheckCircle2, Eraser, Copy, LayoutDashboard } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  tagName: string;
  onClear: () => void;
  onKeep: () => void;
  onExit: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, tagName, onClear, onKeep, onExit }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-[#1e293b] border border-emerald-500/30 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transform scale-100 transition-all">
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto mb-6 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <CheckCircle2 size={32} strokeWidth={3} />
          </div>
          
          <h3 className="text-2xl font-bold text-white mb-2">Cadastro Realizado!</h3>
          <p className="text-slate-400 text-sm mb-8">
            O equipamento <strong className="text-emerald-400 font-mono text-base">{tagName}</strong> foi salvo com sucesso na base de dados.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button 
              onClick={onClear}
              className="group flex flex-col items-center justify-center p-4 bg-[#0f172a] border border-slate-700 hover:border-emerald-500/50 rounded-xl transition-all hover:bg-[#0f172a]/80"
            >
              <Eraser className="text-slate-400 group-hover:text-white mb-2" size={24} />
              <span className="text-white font-bold text-sm">Novo (Limpar)</span>
              <span className="text-xs text-slate-500 mt-1">Limpar formulário para novo item</span>
            </button>

            <button 
              onClick={onKeep}
              className="group flex flex-col items-center justify-center p-4 bg-[#0f172a] border border-slate-700 hover:border-brand-primary/50 rounded-xl transition-all hover:bg-[#0f172a]/80"
            >
              <Copy className="text-slate-400 group-hover:text-white mb-2" size={24} />
              <span className="text-white font-bold text-sm">Manter Dados</span>
              <span className="text-xs text-slate-500 mt-1">Aproveitar dados para similar</span>
            </button>
          </div>
        </div>

        <div className="p-4 bg-[#0f172a]/50 border-t border-slate-700 flex justify-center">
          <button 
            onClick={onExit}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold py-2 px-4 rounded-lg hover:bg-white/5"
          >
            <LayoutDashboard size={16} />
            Voltar para o Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessModal;