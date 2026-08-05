import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  itemName: string;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, onConfirm, itemName }) => {
  const [reason, setReason] = useState('');

  // Reset reason when modal opens
  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-[#1e293b] border border-red-500/30 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform scale-100 transition-all">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Marcar como Obsoleto</h3>
              <p className="text-sm text-slate-400">Esta ação requer justificativa.</p>
            </div>
          </div>
          
          <p className="text-slate-300 text-sm mb-6">
            Você está prestes a marcar o equipamento <strong className="text-white">{itemName}</strong> como obsoleto. 
            Ele será removido da lista ativa e movido para o histórico de obsoletos.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Motivo da Exclusão <span className="text-red-500">*</span></label>
            <textarea 
              autoFocus
              className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none h-24 placeholder:text-slate-600"
              placeholder="Descreva o motivo (ex: Danificado, Substituído, Fora de uso)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 bg-[#0f172a]/50 border-t border-slate-700 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-400 font-bold hover:text-white hover:bg-white/5 transition-colors text-sm"
          >
            Cancelar
          </button>
          <button 
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-red-900/20 text-sm"
          >
            Confirmar Exclusão
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;