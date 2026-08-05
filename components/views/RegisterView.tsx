import React, { useState, useRef } from 'react';
import { ArrowUp, Edit3, AlertCircle } from 'lucide-react';
import { Equipment, FORM_CONFIG, ViewType } from '../../types';
import { api } from '../../services/api';
import SuccessModal from '../SuccessModal';

interface RegisterViewProps {
  editingItem: Equipment | null;
  setEditingItem: (item: Equipment | null) => void;
  formCategory: string;
  setFormCategory: (cat: string) => void;
  setView: (view: ViewType) => void;
  onRefresh: () => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ 
  editingItem, setEditingItem, formCategory, setFormCategory, setView, onRefresh 
}) => {
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastRegisteredTag, setLastRegisteredTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Ref para controlar o formulário HTML diretamente
  const formRef = useRef<HTMLFormElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (dataObj: any, category: string) => {
    const errors: Record<string, string> = {};
    const config = FORM_CONFIG[category] || [];

    config.forEach(field => {
      const value = dataObj[field.name];
      const trimmedValue = typeof value === 'string' ? value.trim() : value;

      if (field.required && !trimmedValue) {
          errors[field.name] = 'Este campo é obrigatório.';
      }
      
      if (field.type === 'date' && trimmedValue) {
        const date = new Date(trimmedValue);
        if (isNaN(date.getTime())) {
          errors[field.name] = 'Data inválida.';
        } else {
            const year = date.getFullYear();
            if (year < 1900 || year > 2100) {
                 errors[field.name] = 'Ano inválido (deve estar entre 1900 e 2100).';
            }
        }
      }
    });
    return errors;
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const rawFormEntries = Object.fromEntries(formData.entries());
    const dataObj = editingItem ? { ...editingItem, ...rawFormEntries } : rawFormEntries;
    
    const currentCategory = editingItem ? editingItem.categoria : formCategory;
    const errors = validateForm(dataObj, currentCategory);

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false);
      return;
    }

    try {
      await api.create(dataObj, currentCategory);
      
      onRefresh(); // Atualiza a lista em background

      if (editingItem) {
        // Se for edição, apenas avisa e volta (comportamento padrão)
        alert('Equipamento atualizado com sucesso!');
        setEditingItem(null);
        setView('dashboard');
      } else {
        // Se for novo cadastro, mostra o modal de decisão
        setLastRegisteredTag(String(dataObj.tag));
        setShowSuccessModal(true);
      }
    } catch (err) {
      alert('Erro ao salvar. Verifique a conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ações do Modal de Sucesso
  const handleSuccessClear = () => {
    formRef.current?.reset();
    setFormErrors({});
    setShowSuccessModal(false);
  };

  const handleSuccessKeep = () => {
    // Apenas fecha o modal, mantendo os dados no formRef
    setShowSuccessModal(false);
  };

  const handleSuccessExit = () => {
    setShowSuccessModal(false);
    // Limpa estado global de edição se houver e volta
    setEditingItem(null);
    setView('dashboard');
  };

  return (
    <div className="p-8 pb-32 max-w-4xl mx-auto">
        <div className="bg-[rgba(17,24,39,0.92)] p-8 rounded-[24px] border border-[rgba(148,163,184,0.15)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600"></div>
            
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-white">{editingItem ? 'Editar Equipamento' : 'Novo Cadastro'}</h2>
                    <p className="text-sm text-[#94a3b8] mt-1">{editingItem ? `Atualizando dados do TAG: ${editingItem.tag}` : 'Preencha os dados abaixo para registrar um novo ativo.'}</p>
                </div>
                {!editingItem && (
                    <select 
                        value={formCategory} 
                        onChange={(e) => { setFormCategory(e.target.value); setFormErrors({}); }}
                        className="bg-[#111827] text-white border border-[rgba(148,163,184,0.3)] rounded-lg px-4 py-2 text-sm focus:border-[#3b82f6] outline-none shadow-sm"
                    >
                        {Object.keys(FORM_CONFIG).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                )}
            </div>

            <form ref={formRef} onSubmit={handleRegisterSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(FORM_CONFIG[editingItem ? editingItem.categoria : formCategory] || []).map((field) => (
                        <div key={field.name} className={`space-y-2 ${field.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                            <label className="text-[12px] font-bold text-[#94a3b8] uppercase tracking-[0.5px] ml-1 flex items-center gap-1">
                                {field.label} 
                                {editingItem && field.required && <span className="text-red-400">*</span>}
                            </label>
                            
                            {field.type === 'textarea' ? (
                                <textarea
                                    name={field.name}
                                    defaultValue={editingItem ? (editingItem as any)[field.name] : ''}
                                    className={`w-full bg-[#0f172a] border ${formErrors[field.name] ? 'border-[#ef4444]' : 'border-[rgba(148,163,184,0.2)]'} rounded-xl p-3 text-white text-sm focus:border-[#3b82f6] focus:ring-[3px] focus:ring-[rgba(59,130,246,0.15)] outline-none transition-all resize-none h-24`}
                                    placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
                                    onChange={handleInputChange}
                                />
                            ) : field.type === 'select' ? (
                                <div className="relative">
                                    <select
                                        name={field.name}
                                        defaultValue={editingItem ? (editingItem as any)[field.name] : ''}
                                        className={`w-full bg-[#0f172a] border ${formErrors[field.name] ? 'border-[#ef4444]' : 'border-[rgba(148,163,184,0.2)]'} rounded-xl p-3 text-white text-sm focus:border-[#3b82f6] focus:ring-[3px] focus:ring-[rgba(59,130,246,0.15)] outline-none transition-all appearance-none`}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">Selecione...</option>
                                        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748b]">▼</div>
                                </div>
                            ) : (
                                <input
                                    type={field.type}
                                    name={field.name}
                                    defaultValue={editingItem ? (field.type === 'date' ? ((editingItem as any)[field.name] || '').split('T')[0] : (editingItem as any)[field.name]) : ''}
                                    className={`w-full bg-[#0f172a] border ${formErrors[field.name] ? 'border-[#ef4444]' : 'border-[rgba(148,163,184,0.2)]'} rounded-xl p-3 text-white text-sm focus:border-[#3b82f6] focus:ring-[3px] focus:ring-[rgba(59,130,246,0.15)] outline-none transition-all placeholder:text-[#334155]`}
                                    placeholder={field.placeholder || `Digite ${field.label.toLowerCase()}...`}
                                    onChange={handleInputChange}
                                />
                            )}
                            {formErrors[field.name] && (
                                <span className="text-[11px] text-[#ef4444] font-medium flex items-center gap-1 ml-1 animate-in fade-in slide-in-from-left-1">
                                    <AlertCircle size={10} /> {formErrors[field.name]}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                <div className="pt-6 border-t border-[rgba(148,163,184,0.1)] flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={() => { setEditingItem(null); setView('dashboard'); }}
                        className="px-6 py-3 rounded-xl border border-[rgba(148,163,184,0.2)] text-[#94a3b8] font-bold hover:bg-[#1e293b] hover:text-white transition-all"
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        className={`px-8 py-3 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white font-bold shadow-[0_4px_14px_rgba(59,130,246,0.4)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.6)] hover:-translate-y-0.5 transition-all flex items-center gap-2 ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>Salvando...</>
                        ) : (
                            editingItem ? <><Edit3 size={18}/> Salvar Alterações</> : <><ArrowUp size={18} className="rotate-45"/> Cadastrar</>
                        )}
                    </button>
                </div>
            </form>
        </div>

        {/* Modal de Sucesso Customizado */}
        <SuccessModal 
            isOpen={showSuccessModal}
            tagName={lastRegisteredTag}
            onClear={handleSuccessClear}
            onKeep={handleSuccessKeep}
            onExit={handleSuccessExit}
        />
    </div>
  );
};

export default RegisterView;