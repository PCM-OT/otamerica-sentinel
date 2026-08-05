import React, { useState, useEffect } from 'react';
import { Lock, Unlock, FileSpreadsheet, ExternalLink, ShieldAlert, MessageSquare, RefreshCw, User, Tag, CalendarDays, X, Eye } from 'lucide-react';
import { api } from '../../services/api';

interface Suggestion {
  data?: string;
  nome: string;
  categoria: string;
  descricao: string;
  status?: string;
}

const ReviewSuggestionsView: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  
  // Data State
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

  const DATABASE_URL = "https://docs.google.com/spreadsheets/u/0/"; 

  useEffect(() => {
    if (isAuthenticated) {
        fetchSuggestions();
    }
  }, [isAuthenticated]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
        const res = await api.getSuggestions();
        if (res.data && Array.isArray(res.data)) {
            // Se o backend retornar as sugestões mais antigas primeiro, inverte para mostrar as novas
            setSuggestions(res.data.reverse()); 
        } else {
            console.warn("Nenhuma sugestão retornada ou endpoint não implementado no GAS.");
            setSuggestions([]); 
        }
    } catch (e) {
        console.error("Erro ao buscar sugestões", e);
    } finally {
        setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'LGCurty') {
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPassword('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 animate-in fade-in zoom-in duration-500">
        <div className="bg-[rgba(17,24,39,0.95)] p-8 rounded-2xl border border-[rgba(148,163,184,0.15)] shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-sm w-full text-center backdrop-blur-xl">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700">
            <Lock className="text-slate-400" size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
          <p className="text-sm text-slate-400 mb-6">Esta área é reservada para administradores.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="Digite a senha de acesso..." 
              className={`w-full bg-[#0f172a] border ${error ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-center tracking-widest`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-xs text-red-500 font-bold">Senha incorreta.</p>}
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20"
            >
              Desbloquear
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full flex flex-col max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Header com Ações */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800 pb-6">
        <div>
            <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                    <Unlock size={12} /> Admin
                </span>
                <h1 className="text-3xl font-bold text-white">Sugestões Recebidas</h1>
            </div>
            <p className="text-slate-400 text-sm">Acompanhe o feedback e melhorias solicitadas pelos usuários.</p>
        </div>
        
        <div className="flex gap-3">
             <button 
                onClick={fetchSuggestions}
                disabled={loading}
                className="px-4 py-2 bg-[#1e293b] text-slate-300 hover:text-white border border-slate-700 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-all"
            >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Atualizar
            </button>

            <a 
                href={DATABASE_URL} 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5"
            >
                <FileSpreadsheet size={16} /> Abrir Planilha (Base)
            </a>
        </div>
      </div>

      {/* Lista de Sugestões - Rolagem Vertical */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {loading && suggestions.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <RefreshCw size={40} className="text-blue-500 animate-spin mb-4" />
                <p className="text-slate-400">Carregando sugestões...</p>
             </div>
        ) : suggestions.length === 0 ? (
            <div className="bg-[#1e293b]/50 border border-dashed border-slate-700 rounded-2xl p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-500 mb-4">
                    <MessageSquare size={32} />
                </div>
                <h3 className="text-white font-bold text-lg">Nenhuma sugestão encontrada</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-md">
                    Parece que ninguém enviou sugestões ainda, ou o backend não retornou dados. Verifique a planilha clicando no botão acima.
                </p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                {suggestions.map((item, idx) => (
                    <div 
                        key={idx} 
                        onClick={() => setSelectedSuggestion(item)}
                        className="bg-[rgba(17,24,39,0.8)] border border-[rgba(148,163,184,0.15)] p-5 rounded-2xl hover:border-blue-500/30 transition-all group hover:shadow-lg hover:shadow-blue-900/10 cursor-pointer flex flex-col h-full"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                                    item.categoria === 'Bug/Erro' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    item.categoria === 'Nova Funcionalidade' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                }`}>
                                    {item.categoria}
                                </span>
                            </div>
                            {item.data && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-500 whitespace-nowrap">
                                    <CalendarDays size={10} /> {new Date(item.data).toLocaleDateString('pt-BR')}
                                </span>
                            )}
                        </div>
                        
                        {/* Descrição com truncate (line-clamp) e break-words para evitar scroll horizontal */}
                        <p className="text-slate-200 text-sm leading-relaxed mb-4 flex-1 line-clamp-4 break-words overflow-hidden text-ellipsis">
                            {item.descricao}
                        </p>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-800 mt-auto">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                    <User size={12} />
                                </div>
                                <span className="text-xs font-bold text-slate-400 truncate max-w-[120px]" title={item.nome}>{item.nome}</span>
                            </div>
                            <span className="text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                                Ler mais <Eye size={12} />
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-800 flex justify-center text-xs text-slate-600 gap-2">
          <ShieldAlert size={12} />
          <span>Nota: A exclusão de sugestões deve ser feita diretamente na planilha do Google Sheets.</span>
      </div>

      {/* MODAL DE DETALHES DA SUGESTÃO */}
      {selectedSuggestion && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e293b] border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-slate-700 flex justify-between items-start bg-[#111827]">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                                selectedSuggestion.categoria === 'Bug/Erro' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                selectedSuggestion.categoria === 'Nova Funcionalidade' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}>
                                {selectedSuggestion.categoria}
                            </span>
                            <span className="text-slate-500 text-xs font-mono">
                                {selectedSuggestion.data ? new Date(selectedSuggestion.data).toLocaleString('pt-BR') : 'Data N/A'}
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-white">Detalhes da Sugestão</h3>
                    </div>
                    <button 
                        onClick={() => setSelectedSuggestion(null)} 
                        className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center gap-3 mb-6 p-4 bg-[#0f172a] rounded-xl border border-slate-800">
                        <div className="w-10 h-10 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-400 border border-blue-500/20">
                            <User size={20} />
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Enviado por</span>
                            <p className="text-white font-bold">{selectedSuggestion.nome}</p>
                        </div>
                    </div>

                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Descrição Completa</label>
                    {/* Adicionado break-words para garantir rolagem vertical correta em textos longos sem espaços */}
                    <div className="bg-[#0f172a] p-6 rounded-xl border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                        {selectedSuggestion.descricao}
                    </div>
                </div>

                <div className="p-4 bg-[#111827] border-t border-slate-700 flex justify-end">
                    <button 
                        onClick={() => setSelectedSuggestion(null)}
                        className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-sm transition-colors border border-slate-600"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ReviewSuggestionsView;