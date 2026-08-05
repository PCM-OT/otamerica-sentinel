import React from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { Equipment, FORM_CONFIG } from '../../types';
import { formatDateBR, parseDateSafe, getDaysUntilExpiry, getStatusHierarchical } from '../../utils';

// Declare window for libraries
declare const window: any;

interface ExportViewProps {
  exportFilters: { category: string; status: string; location: string };
  setExportFilters: (filters: { category: string; status: string; location: string }) => void;
  filteredExportList: Equipment[];
}

const ExportView: React.FC<ExportViewProps> = ({ exportFilters, setExportFilters, filteredExportList }) => {
  const exportData = (format: 'pdf' | 'excel') => {
    const list = filteredExportList;
    if (format === 'excel') {
        const ws = window.XLSX.utils.json_to_sheet(list);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "Export");
        window.XLSX.writeFile(wb, "sentinel_export.xlsx");
    } else {
        const doc = new window.jspdf.jsPDF('l');
        doc.text("Relatório de Exportação - Sentinel Nexus", 14, 15);
        (doc as any).autoTable({
            head: [['#', 'TAG', 'Categoria', 'Local', 'Validade', 'Status']],
            body: list.map((i, idx) => [
                idx + 1,
                i.tag, 
                i.categoria, 
                i.local || i.localizacao || '-', 
                formatDateBR(parseDateSafe(i.dataProximaCalibracao || i.dataProximaInspecao)),
                getStatusHierarchical(i)
            ]),
            startY: 20,
        });
        doc.save("sentinel_relatorio.pdf");
    }
  };

  return (
    <div className="p-8 h-full flex flex-col">
        <div className="bg-[rgba(17,24,39,0.92)] p-6 rounded-[20px] border border-[rgba(148,163,184,0.15)] mb-6 shadow-lg backdrop-blur-md">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Download size={20} className="text-brand-primary"/> Exportação de Dados</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block">Categoria</label>
                    <select className="w-full bg-[#0f172a] border border-[rgba(148,163,184,0.2)] rounded-lg p-2.5 text-white text-sm focus:border-[#3b82f6] outline-none" value={exportFilters.category} onChange={e => setExportFilters({...exportFilters, category: e.target.value})}>
                        <option value="all">Todas</option>
                        {Object.keys(FORM_CONFIG).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block">Status</label>
                    <select className="w-full bg-[#0f172a] border border-[rgba(148,163,184,0.2)] rounded-lg p-2.5 text-white text-sm focus:border-[#3b82f6] outline-none" value={exportFilters.status} onChange={e => setExportFilters({...exportFilters, status: e.target.value})}>
                        <option value="all">Todos</option>
                        <option value="ok">Válidos</option>
                        <option value="warn">Atenção</option>
                        <option value="danger">Vencidos</option>
                    </select>
                </div>
                <div>
                    <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block">Local</label>
                    <input type="text" className="w-full bg-[#0f172a] border border-[rgba(148,163,184,0.2)] rounded-lg p-2.5 text-white text-sm focus:border-[#3b82f6] outline-none" placeholder="Filtrar por local..." value={exportFilters.location} onChange={e => setExportFilters({...exportFilters, location: e.target.value})} />
                </div>
                <div className="flex items-end gap-2">
                    <button onClick={() => exportData('pdf')} className="flex-1 py-2.5 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg font-bold text-sm transition-all flex justify-center items-center gap-2"><FileText size={16}/> PDF</button>
                    <button onClick={() => exportData('excel')} className="flex-1 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-lg font-bold text-sm transition-all flex justify-center items-center gap-2"><FileSpreadsheet size={16}/> Excel</button>
                </div>
            </div>
        </div>

        <div className="flex-1 bg-[rgba(17,24,39,0.5)] rounded-[20px] border border-[rgba(148,163,184,0.1)] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[rgba(148,163,184,0.1)] bg-[rgba(17,24,39,0.8)] flex justify-between items-center">
                <span className="text-sm font-bold text-[#94a3b8] uppercase tracking-wider">Pré-visualização ({filteredExportList.length} itens)</span>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[#1e293b] sticky top-0 z-10">
                        <tr>
                            <th className="p-4 text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider">TAG</th>
                            <th className="p-4 text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider">Equipamento</th>
                            <th className="p-4 text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider">Local</th>
                            <th className="p-4 text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider">Validade</th>
                            <th className="p-4 text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(148,163,184,0.1)]">
                        {filteredExportList.map((item, idx) => (
                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-sm font-mono text-white font-bold">{item.tag}</td>
                                <td className="p-4 text-sm text-[#cbd5e1]">{item.equipamento || item.modelo}</td>
                                <td className="p-4 text-sm text-[#94a3b8]">{item.local || item.localizacao}</td>
                                <td className="p-4 text-sm text-[#94a3b8]">{formatDateBR(parseDateSafe(item.dataProximaCalibracao || item.dataProximaInspecao || item.dataValidade))}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                        getDaysUntilExpiry(item) === null ? 'bg-slate-500/20 text-slate-400' :
                                        getDaysUntilExpiry(item)! < 0 ? 'bg-red-500/20 text-red-400' : 
                                        getDaysUntilExpiry(item)! <= 45 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                                    }`}>
                                        {getDaysUntilExpiry(item) === null ? 'N/A' : getDaysUntilExpiry(item)! < 0 ? 'Vencido' : getDaysUntilExpiry(item)! <= 45 ? 'Atenção' : 'Válido'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredExportList.length === 0 && (
                    <div className="p-10 text-center text-[#64748b]">Nenhum dado para exibir com os filtros atuais.</div>
                )}
            </div>
        </div>
    </div>
  );
};

export default ExportView;