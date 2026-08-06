import React, { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { getWarnDays, useWarnDays } from './settings';
import Sidebar from './components/Sidebar';
import EquipmentCard from './components/EquipmentCard';
import SortToolbar from './components/SortToolbar';
import DeleteModal from './components/DeleteModal';
import { api } from './services/api';
import { Equipment, ViewType, FORM_CONFIG } from './types';
import { getStatusHierarchical, getDaysUntilExpiry, parseDateSafe, isReallyActive, formatDateBR, detectTwinManometers } from './utils';
import { Search, ArrowUp, ArrowDown, Download, FileText, FileSpreadsheet, Send, QrCode, Trash2, X, Lock, Edit3, Repeat, AlertCircle, ExternalLink, Calendar, Printer, Layers, History, FilterX, CheckCircle2 } from 'lucide-react';

// Lazy Load Components
const DashboardView = React.lazy(() => import('./components/views/DashboardView'));
const AnalyticsView = React.lazy(() => import('./components/views/AnalyticsView'));
const RegisterView = React.lazy(() => import('./components/views/RegisterView'));
const EditView = React.lazy(() => import('./components/views/EditView'));
const ExportView = React.lazy(() => import('./components/views/ExportView'));
const ManualView = React.lazy(() => import('./components/views/ManualView'));
const ReviewSuggestionsView = React.lazy(() => import('./components/views/ReviewSuggestionsView'));

// Declare libraries loaded via CDN
declare const window: any;

function App() {
  const [view, setView] = useState<ViewType>('dashboard');
  const [data, setData] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const warnDays = useWarnDays();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string[]>(['all']);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  
  // Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Edit & Export specific state
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [exportFilters, setExportFilters] = useState({ category: 'all', status: 'all', location: '' });

  // Analytics specific state
  const [analyticsFilters, setAnalyticsFilters] = useState<{status: string | null, category: string | null, location: string | null}>({
    status: null,
    category: null,
    location: null
  });

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  // Form states
  const [formCategory, setFormCategory] = useState('NR-10');
  const [suggestionForm, setSuggestionForm] = useState({ name: '', category: 'Melhoria', desc: '' });
  const [suggestionSent, setSuggestionSent] = useState(false);

  // 1. Carregamento inicial (Executa apenas uma vez quando a aplicação é aberta)
  useEffect(() => {
    fetchData();
  }, []);

  // 2. Lógica de Atualização Automática (Gere o intervalo sem forçar recarregamentos visuais)
  useEffect(() => {
    const intervalId = setInterval(() => {
        if (view === 'dashboard' && !selectedItem && !isDeleteModalOpen && !editingItem) {
            // Passa 'true' para indicar carregamento silencioso (sem mostrar o spinner)
            fetchData(true);
        }
    }, 300000); // Mantemos os 5 minutos (300000 ms) para proteger o backend

    return () => clearInterval(intervalId);
  }, [view, selectedItem, isDeleteModalOpen, editingItem]);

  // 3. DETECTOR DE QR CODE: Abre o modal automaticamente se houver ?tag=XYZ no link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tagFromUrl = params.get('tag');
    
    // Se encontrou a tag no link, os dados já carregaram e nenhum item está aberto
    if (tagFromUrl && data.length > 0 && !selectedItem) {
        const itemDaUrl = data.find(d => d.tag === tagFromUrl);
        if (itemDaUrl) {
            setSelectedItem(itemDaUrl); // Abre a janela do equipamento
            
            // Opcional: Limpa o link na barra de endereços para ficar elegante
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
  }, [data]); // Só roda quando a lista de equipamentos termina de carregar

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.read();
      if (res.success && Array.isArray(res.data)) {
        let initialData = res.data;

        // --- LÓGICA DE CORREÇÃO DE DATAS ---
        const itemsMissingDate = initialData.filter(item => {
            if (item.status === 'Obsoleto' || item.status === 'Reprovado') return false;
            
            let dateVal = item.dataValidade;
            if (item.categoria === 'MANÔMETROS') dateVal = item.dataProximaCalibracao;
            else if (item.categoria === 'DEMAIS EQUIPAMENTOS') dateVal = item.dataProximaInspecao;

            return !dateVal || dateVal === '' || dateVal === 'N/A';
        });

        if (itemsMissingDate.length > 0) {
            const updates = await Promise.all(itemsMissingDate.map(async (item) => {
                try {
                    const histRes = await api.getHistory(item.tag);
                    if (histRes.history && histRes.history.length > 0) {
                        const sortedHistory = histRes.history.sort((a: any, b: any) => {
                            const tA = a.dataCalibracaoTimestamp || a.dataValidadeTimestamp || parseDateSafe(a.dataCalibracao || a.dataValidade) || 0;
                            const tB = b.dataCalibracaoTimestamp || b.dataValidadeTimestamp || parseDateSafe(b.dataCalibracao || b.dataValidade) || 0;
                            return tB - tA;
                        });

                        const lastRecord = sortedHistory[0];
                        
                        let recoveredDate = null;
                        if (item.categoria === 'MANÔMETROS') recoveredDate = lastRecord.dataProximaCalibracao || lastRecord.dataValidade;
                        else if (item.categoria === 'DEMAIS EQUIPAMENTOS') recoveredDate = lastRecord.dataProximaInspecao || lastRecord.dataValidade;
                        else recoveredDate = lastRecord.dataValidade;

                        if (recoveredDate && recoveredDate !== 'N/A') {
                            return { tag: item.tag, recoveredDate };
                        }
                    }
                } catch (err) {
                    console.warn(`Erro ao recuperar histórico para ${item.tag}`, err);
                }
                return null;
            }));

            const validUpdates = updates.filter(u => u !== null) as { tag: string, recoveredDate: string }[];

            if (validUpdates.length > 0) {
                initialData = initialData.map(d => {
                    const match = validUpdates.find(u => u.tag === d.tag);
                    if (match) {
                        if (d.categoria === 'MANÔMETROS') return { ...d, dataProximaCalibracao: match.recoveredDate };
                        if (d.categoria === 'DEMAIS EQUIPAMENTOS') return { ...d, dataProximaInspecao: match.recoveredDate };
                        return { ...d, dataValidade: match.recoveredDate };
                    }
                    return d;
                });
            }
        }
        setData(initialData);
      }
    } catch (e) {
      console.error("Failed to fetch", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // --- Lógica Central de Status (Source of Truth) ---
  const getItemStatusKey = (item: Equipment): 'ok' | 'warn' | 'danger' => {
    const days = getDaysUntilExpiry(item);
    if (days === null) return 'ok'; 
    if (days < 0) return 'danger';
    if (days <= warnDays) return 'warn';
    return 'ok';
  };

  const activeData = useMemo(() => data.filter(isReallyActive), [data]);
  const rejectedDataRaw = useMemo(() => data.filter(d => getStatusHierarchical(d) === 'Reprovado'), [data]);
  const obsoleteDataRaw = useMemo(() => data.filter(d => getStatusHierarchical(d) === 'Obsoleto'), [data]);
  const twinManometers = useMemo(() => detectTwinManometers(activeData), [activeData]);

  const isItemTwin = (item: Equipment) => {
    if (item.categoria !== 'MANÔMETROS') return false;
    return twinManometers.some(group => 
      group.principal.item === item.item || group.reserva.item === item.item
    );
  };

  const sortData = (list: Equipment[]) => {
    if (!sortConfig) return list;
    return [...list].sort((a, b) => {
      if (sortConfig.key === 'date') {
        const dateA = parseDateSafe(a.dataProximaCalibracao || a.dataProximaInspecao || a.dataValidade) || 0;
        const dateB = parseDateSafe(b.dataProximaCalibracao || b.dataProximaInspecao || b.dataValidade) || 0;
        return sortConfig.dir === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortConfig.key === 'tag') {
        return sortConfig.dir === 'asc' ? a.tag.localeCompare(b.tag) : b.tag.localeCompare(a.tag);
      }
      return 0;
    });
  };

  const filteredDashboardData = useMemo(() => {
    let filtered = activeData;
    if (!categoryFilter.includes('all')) {
      filtered = filtered.filter(item => categoryFilter.includes(item.categoria));
    }
    if (statusFilters.length > 0) {
      filtered = filtered.filter(item => {
        const status = getItemStatusKey(item);
        return statusFilters.includes(status);
      });
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        (item.tag?.toLowerCase() || '').includes(term) ||
        (item.equipamento?.toLowerCase() || '').includes(term) ||
        (item.local?.toLowerCase() || '').includes(term) ||
        (item.modelo?.toLowerCase() || '').includes(term)
      );
    }
    return sortData(filtered);
  }, [activeData, categoryFilter, statusFilters, searchTerm, sortConfig]);

  const rejectedData = useMemo(() => sortData(rejectedDataRaw), [rejectedDataRaw, sortConfig]);
  const obsoleteData = useMemo(() => sortData(obsoleteDataRaw), [obsoleteDataRaw, sortConfig]);

  const filteredExportList = useMemo(() => {
    let list = [...activeData];
    if (exportFilters.category !== 'all') {
        list = list.filter(d => d.categoria === exportFilters.category);
    }
    if (exportFilters.status !== 'all') {
        list = list.filter(d => {
            const statusKey = getItemStatusKey(d);
            return statusKey === exportFilters.status;
        });
    }
    if (exportFilters.location) {
        const locLower = exportFilters.location.toLowerCase();
        list = list.filter(d => (d.local || d.localizacao || '').toLowerCase().includes(locLower));
    }
    return sortData(list);
  }, [activeData, exportFilters, sortConfig]);

  const stats = useMemo(() => {
    let sourceData = activeData;
    if (!categoryFilter.includes('all')) {
         sourceData = sourceData.filter(d => categoryFilter.includes(d.categoria));
    }

    const total = sourceData.length;
    let ok = 0, warn = 0, danger = 0;
    
    sourceData.forEach(d => {
      const statusKey = getItemStatusKey(d);
      if (statusKey === 'danger') danger++;
      else if (statusKey === 'warn') warn++;
      else ok++;
    });

    return { total, ok, warn, danger, rejected: rejectedData.length, obsolete: obsoleteData.length };
  }, [activeData, categoryFilter, rejectedData, obsoleteData]);

  // Analytics Helpers
  const { analyticsData, categoryStats, statusStats, locationStats } = useMemo(() => {
    let filtered = activeData;

    if (analyticsFilters.status) {
        filtered = filtered.filter(d => {
            const statusKey = getItemStatusKey(d);
            let uiStatus = 'Válidos';
            if (statusKey === 'danger') uiStatus = 'Vencidos';
            else if (statusKey === 'warn') uiStatus = 'Atenção';
            return uiStatus === analyticsFilters.status;
        });
    }
    if (analyticsFilters.category) {
        filtered = filtered.filter(d => d.categoria === analyticsFilters.category);
    }
    if (analyticsFilters.location) {
        filtered = filtered.filter(d => (d.local || d.localizacao || 'Indefinido') === analyticsFilters.location);
    }

    const catCounts: Record<string, number> = {};
    const locCounts: Record<string, number> = {};
    let ok = 0, warn = 0, danger = 0;

    filtered.forEach(d => {
        catCounts[d.categoria] = (catCounts[d.categoria] || 0) + 1;
        const loc = d.local || d.localizacao || 'Indefinido';
        locCounts[loc] = (locCounts[loc] || 0) + 1;
        
        const statusKey = getItemStatusKey(d);
        if (statusKey === 'danger') danger++;
        else if (statusKey === 'warn') warn++;
        else ok++;
    });

    const finalCatStats = Object.keys(catCounts).map(k => ({ name: k, value: catCounts[k] }));
    const finalLocStats = Object.keys(locCounts)
        .map(k => ({ name: k, value: locCounts[k] }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 5);

    const finalStatusStats = [
        { name: 'Válidos', value: ok, color: '#10b981' },
        { name: 'Atenção', value: warn, color: '#f59e0b' },
        { name: 'Vencidos', value: danger, color: '#ef4444' }
    ].filter(d => d.value > 0);

    return { 
        analyticsData: filtered, 
        categoryStats: finalCatStats, 
        statusStats: finalStatusStats,
        locationStats: finalLocStats
    };
  }, [activeData, analyticsFilters]);

  const handleFilterPill = (cat: string, e: React.MouseEvent) => {
    const isMulti = e.ctrlKey || e.metaKey;
    if (cat === 'all') { setCategoryFilter(['all']); return; }
    setCategoryFilter(prev => {
        if (isMulti) {
            const cleanPrev = prev.filter(c => c !== 'all');
            if (cleanPrev.includes(cat)) {
                const result = cleanPrev.filter(c => c !== cat);
                return result.length === 0 ? ['all'] : result;
            } else { return [...cleanPrev, cat]; }
        } else { return [cat]; }
    });
  };

  const handleQuickFilter = (status: string, multi: boolean) => {
    if (multi) {
        setStatusFilters(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
    } else {
        setStatusFilters(prev => prev.length === 1 && prev[0] === status ? [] : [status]);
    }
    setView('dashboard');
  };

  const handleResetFilters = () => {
    setCategoryFilter(['all']);
    setStatusFilters([]);
    setSearchTerm('');
  };

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortConfig({ key, dir });
  };

  const handleSuggestionSubmit = async () => {
    if (!suggestionForm.name.trim() || !suggestionForm.desc.trim()) {
      alert("Por favor, preencha todos os campos.");
      return;
    }
    const payload = {
        nome: suggestionForm.name,
        categoria: suggestionForm.category,
        descricao: suggestionForm.desc
    };
    await api.suggestion(payload);
    setSuggestionSent(true);
    setSuggestionForm({ ...suggestionForm, desc: '' });
  };

  // Open Modal Logic
  const handleDeleteClick = () => {
    if (!selectedItem) return;
    if (!selectedItem.tag || selectedItem.tag === 'Sem TAG') {
        alert("Erro: Este equipamento não possui uma TAG válida.");
        return;
    }
    setIsDeleteModalOpen(true);
  };

  // Confirm Delete Logic
  const handleConfirmDelete = async (reason: string) => {
    if (!selectedItem) return;
    try {
        const response = await api.delete(selectedItem.tag, reason, selectedItem.categoria);
        if (response && response.success) {
            alert("Sucesso: Equipamento marcado como obsoleto.");
            setIsDeleteModalOpen(false);
            setSelectedItem(null);
            fetchData();
        } else {
            throw new Error(response?.error || response?.message || "Falha desconhecida no servidor.");
        }
    } catch (error: any) {
        console.error("Erro na exclusão:", error);
        alert(`Erro ao marcar como obsoleto: ${error.message || "Verifique sua conexão."}`);
    }
  };

  const downloadHistoryExcel = async (item: Equipment) => {
    try {
        const res = await api.getHistory(item.tag);
        if (res.history && res.history.length > 0) {
            const ws = window.XLSX.utils.json_to_sheet(res.history);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, "Histórico");
            window.XLSX.writeFile(wb, `Historico_${item.tag}.xlsx`);
        } else {
            alert("Não há histórico disponível para este equipamento.");
        }
    } catch (e) {
        console.error(e);
        alert("Erro ao baixar histórico.");
    }
  };

  const startEditing = (item: Equipment) => {
    setEditingItem(item);
    const categoryExists = Object.keys(FORM_CONFIG).includes(item.categoria);
    setFormCategory(categoryExists ? item.categoria : 'NR-10');
    setView('register');
  };

  const generatePDF = async (item: Equipment) => {
    try {
        const doc = new window.jspdf.jsPDF();
        const blueColor = [59, 130, 246];
        const darkColor = [11, 17, 33];
        const grayColor = [100, 116, 139];

        doc.setFillColor(...darkColor);
        doc.rect(0, 0, 210, 30, 'F');

        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.text('SENTINEL NEXUS', 15, 12);

        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text('Sistema de Gestão de Ativos e Conformidade', 15, 17);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 15, 24);

        const days = getDaysUntilExpiry(item);
        let statusText = "VÁLIDO";
        let statusColor = [16, 185, 129];

        if (item.status === 'Reprovado') { statusText = "REPROVADO"; statusColor = [239, 68, 68]; }
        else if (item.status === 'Obsoleto') { statusText = "OBSOLETO"; statusColor = [100, 116, 139]; }
        else if (days !== null) {
            if (days < 0) { statusText = "VENCIDO"; statusColor = [239, 68, 68]; }
            else if (days <= getWarnDays()) { statusText = "ATENÇÃO"; statusColor = [245, 158, 11]; }
        } else {
            statusText = "N/A";
            statusColor = [100, 116, 139]; 
        }

        doc.setFillColor(...statusColor);
        doc.roundedRect(150, 8, 45, 14, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text(statusText, 172.5, 17, { align: 'center' });

        let y = 40;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text('Ficha Técnica do Equipamento', 15, y);
        y += 6;
        doc.setFontSize(18);
        doc.setTextColor(...blueColor);
        doc.setFont(undefined, 'bold');
        doc.text(String(item.tag || 'Sem TAG'), 15, y);
        y += 5;
        doc.setFontSize(10);
        doc.setTextColor(...grayColor);
        doc.setFont(undefined, 'bold');
        doc.text(String(item.categoria).toUpperCase(), 15, y);
        y += 8;

        const config = FORM_CONFIG[item.categoria] || [];
        const tableBody = config.map(field => {
            let val = (item as any)[field.name];
            if (field.type === 'date' && val) val = formatDateBR(parseDateSafe(val));
            if (!val) val = '-';
            return [field.label, val];
        });

        (doc as any).autoTable({
            startY: y,
            head: [['Especificação', 'Detalhe']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: blueColor, textColor: 255, fontStyle: 'bold', fontSize: 9, cellPadding: 2 },
            bodyStyles: { textColor: 50, fontSize: 8, cellPadding: 2 },
            alternateRowStyles: { fillColor: [241, 245, 249] },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 }, 1: { cellWidth: 'auto' } },
            margin: { left: 15, right: 15 }
        });

        y = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.setTextColor(...blueColor);
        doc.setFont(undefined, 'bold');
        doc.text('Histórico de Registros', 15, y);
        y += 4;

        try {
            const historyRes = await api.getHistory(item.tag);
            const history = historyRes.history || [];
            if (history.length > 0) {
                (doc as any).autoTable({
                    startY: y,
                    head: [['Data', 'Certificado', 'Resultado', 'Validade']],
                    body: history.slice(0, 5).map((h: any) => [
                        formatDateBR(h.dataCalibracaoTimestamp || parseDateSafe(h.dataCalibracao || h.dataInspecao || h.dataCertificacao)),
                        h.numCertificado || '-',
                        h.resultado || '-',
                        formatDateBR(h.dataValidadeTimestamp || parseDateSafe(h.dataProximaCalibracao || h.dataProximaInspecao || h.dataValidade))
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, cellPadding: 2 },
                    bodyStyles: { fontSize: 8, cellPadding: 2 },
                    margin: { left: 15, right: 15 }
                });
                y = (doc as any).lastAutoTable.finalY + 10;
            } else {
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.setFont(undefined, 'normal');
                doc.text('Nenhum histórico registrado.', 15, y + 5);
                y += 15;
            }
        } catch (error) { console.error("Error history", error); }

        doc.setDrawColor(200, 200, 200);
        doc.line(15, y, 195, y);
        y += 5;

        const baseUrl = window.location.origin; // Pega o link raiz do site automaticamente
        const qrValue = `${baseUrl}?tag=${encodeURIComponent(item.tag)}`;
        const qr = new window.QRious({ value: qrValue, size: 150 });
        doc.addImage(qr.toDataURL(), 'PNG', 15, y, 25, 25);
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text('Acesso Digital', 45, y + 8);
        doc.setFontSize(7);
        doc.setTextColor(...grayColor);
        doc.setFont(undefined, 'normal');
        doc.text('Documento gerado eletronicamente pelo Sentinel Nexus V33.', 45, y + 14);
        doc.text('Verifique a autenticidade escaneando o código ao lado.', 45, y + 19);
        doc.save(`${item.tag}_FichaTecnica.pdf`);
    } catch (e) { alert("Erro ao gerar PDF."); }
  };

  const downloadSingleLabel = (item: Equipment) => {
    try {
        const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: [60, 60] });
        const baseUrl = window.location.origin; // Pega o link raiz do site automaticamente
        const qrValue = `${baseUrl}?tag=${encodeURIComponent(item.tag)}`;
        const qr = new window.QRious({ value: qrValue, size: 200 });
        doc.addImage(qr.toDataURL(), 'PNG', 10, 5, 40, 40);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(String(item.tag || 'N/A'), 30, 50, { align: 'center' });
        doc.setFontSize(6);
        doc.setFont(undefined, 'normal');
        doc.text('SENTINEL NEXUS', 30, 55, { align: 'center' });
        doc.save(`${item.tag}_Etiqueta.pdf`);
    } catch (e) { alert("Erro etiqueta."); }
  };

  const generateBulkQR = () => {
    const doc = new window.jspdf.jsPDF();
    let x = 20, y = 20;
    filteredDashboardData.forEach((item) => {
        const baseUrl = window.location.origin; // Pega o link raiz do site automaticamente
        const qrValue = `${baseUrl}?tag=${encodeURIComponent(item.tag)}`;
        const qr = new window.QRious({ value: qrValue, size: 100 });
        doc.addImage(qr.toDataURL(), 'PNG', x, y, 50, 50);
        doc.setFontSize(10);
        doc.text(String(item.tag || 'N/A'), x + 25, y + 55, { align: 'center' });
        x += 70;
        if (x > 150) { x = 20; y += 70; }
        if (y > 250) { doc.addPage(); y = 20; }
    });
    doc.save('bulk_qrcodes.pdf');
  };

  const daysUntilExpiry = selectedItem ? getDaysUntilExpiry(selectedItem) : null;

  return (
    <div className="flex bg-[#0b1121] min-h-screen text-[#f8fafc] font-sans relative z-10 selection:bg-[#3b82f6] selection:text-white">
      <Sidebar currentView={view} onChangeView={(v) => { if(v === 'edit') { setEditingItem(null); } setView(v); }} onFilter={handleQuickFilter} activeFilters={statusFilters} stats={stats} />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="h-20 border-b border-[rgba(148,163,184,0.25)] flex items-center justify-between px-10 bg-[rgba(17,24,39,0.85)] backdrop-blur-xl z-40 sticky top-0 relative">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-[#94a3b8]">{view === 'dashboard' ? 'Visão Geral' : view === 'bulk-qr' ? 'QR Codes em Massa' : view === 'edit' ? 'Central de Edição' : view === 'manual' ? 'Manual do Usuário' : view === 'review-suggestions' ? 'Avaliar Sugestões' : view.charAt(0).toUpperCase() + view.slice(1)}</h1>
          <div className="relative w-[400px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" size={18} />
            <input type="text" placeholder="Buscar equipamento, TAG ou local..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); if(view !== 'dashboard') setView('dashboard'); }} className="w-full bg-[rgba(17,24,39,0.92)] border border-[rgba(148,163,184,0.25)] rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:border-[#3b82f6] focus:ring-[3px] focus:ring-[rgba(59,130,246,0.4)] outline-none transition-all placeholder:text-[#64748b]" />
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#3b82f6] to-transparent opacity-60"></div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <Suspense fallback={
             <div className="flex items-center justify-center h-full text-[#64748b] animate-pulse">
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 rounded-full border-2 border-[#3b82f6] border-t-transparent animate-spin"></div>
                  <p className="font-mono text-sm">Carregando módulos...</p>
                </div>
             </div>
          }>
            {view === 'dashboard' && (
              <DashboardView 
                data={filteredDashboardData} 
                loading={loading}
                twinManometers={twinManometers}
                categoryFilter={categoryFilter}
                statusFilters={statusFilters}
                searchTerm={searchTerm}
                onFilterPill={handleFilterPill}
                onResetFilters={handleResetFilters}
                sortConfig={sortConfig}
                onSort={handleSort}
                onViewDetails={setSelectedItem}
                isItemTwin={isItemTwin}
              />
            )}
            {view === 'analytics' && (
              <AnalyticsView 
                activeData={activeData}
                filters={analyticsFilters}
                stats={{ categoryStats, statusStats, locationStats }}
                onFilterChange={setAnalyticsFilters}
              />
            )}
            {view === 'register' && (
              <RegisterView 
                editingItem={editingItem} 
                setEditingItem={setEditingItem}
                formCategory={formCategory}
                setFormCategory={setFormCategory}
                setView={setView}
                onRefresh={fetchData}
              />
            )}
            {view === 'edit' && (
              <EditView 
                data={data}
                onStartEditing={startEditing}
              />
            )}
            {view === 'export' && (
              <ExportView 
                exportFilters={exportFilters}
                setExportFilters={setExportFilters}
                filteredExportList={filteredExportList}
              />
            )}
            {view === 'rejected' && <div className="p-8 h-full flex flex-col"><div className="flex justify-end mb-4"><SortToolbar itemCount={rejectedData.length} sortConfig={sortConfig} onSort={handleSort}/></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-20">{rejectedData.map(item => <EquipmentCard key={item.item} item={item} onViewDetails={setSelectedItem} statusOverride="Reprovado" />)}{rejectedData.length === 0 && <div className="col-span-full text-center py-20 text-[#64748b]">Nenhum equipamento reprovado.</div>}</div></div>}
            {view === 'obsolete' && <div className="p-8 h-full flex flex-col"><div className="flex justify-end mb-4"><SortToolbar itemCount={obsoleteData.length} sortConfig={sortConfig} onSort={handleSort}/></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-20">{obsoleteData.map(item => <EquipmentCard key={item.item} item={item} onViewDetails={setSelectedItem} statusOverride="Obsoleto" />)}{obsoleteData.length === 0 && <div className="col-span-full text-center py-20 text-[#64748b]">Nenhum equipamento obsoleto.</div>}</div></div>}
            {view === 'bulk-qr' && (
                <div className="p-8 flex flex-col h-full">
                  <div className="flex justify-between items-center mb-8">
                      <div><h2 className="text-xl font-bold text-white flex items-center gap-2"><QrCode className="text-brand-primary"/> Gerador em Massa</h2><p className="text-sm text-slate-400 mt-1">Exibindo {filteredDashboardData.length} códigos</p></div>
                      <button onClick={generateBulkQR} className="px-6 py-3 bg-[#3b82f6] rounded-xl text-white font-bold hover:bg-[#2563eb] flex items-center gap-2 shadow-[0_8px_24px_rgba(59,130,246,0.4)] hover:-translate-y-1 transition-all"><Download size={20} /> Baixar PDF Completo</button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {filteredDashboardData.length === 0 ? <div className="text-center text-slate-500 py-20">Nenhum equipamento encontrado.</div> : <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-20">{filteredDashboardData.map(item => <div key={item.item || item.tag} className="bg-white p-4 rounded-xl flex flex-col items-center justify-center text-center shadow-md border border-slate-200">{(() => { const baseUrl = window.location.origin; const qrValue = `${baseUrl}?tag=${encodeURIComponent(item.tag)}`; const qr = new window.QRious({ value: qrValue, size: 100, level: 'H' }); return <img src={qr.toDataURL()} alt="QR" className="w-24 h-24 mb-2" />; })()}<span className="text-xs font-bold text-slate-900 font-mono break-all">{item.tag}</span></div>)}</div>}
                  </div>
                </div>
            )}
            {view === 'suggestions' && (
              <div className="p-8 max-w-xl mx-auto">
                <div className="bg-[rgba(17,24,39,0.92)] p-8 rounded-[16px] border border-[rgba(148,163,184,0.25)] backdrop-blur-[18px]">
                  <h2 className="text-2xl font-bold text-white mb-6">Enviar Sugestão/Melhoria</h2>
                  
                  {suggestionSent ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4 animate-in fade-in zoom-in duration-300">
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mb-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                        <CheckCircle2 size={32} strokeWidth={3} />
                      </div>
                      <h3 className="text-xl font-bold text-white">Sugestão Enviada!</h3>
                      <p className="text-slate-400 text-center px-4">Obrigado por contribuir com a melhoria contínua do sistema Sentinel Nexus.</p>
                      <button onClick={() => setSuggestionSent(false)} className="mt-4 px-6 py-2 bg-[#1e293b] text-white rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors text-sm font-bold">Enviar nova sugestão</button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[13px] font-bold text-[#94a3b8] uppercase tracking-[0.5px] mb-2">Seu Nome (Usuário)</label>
                        <input className="w-full bg-[#111827] border border-[rgba(148,163,184,0.25)] rounded-lg p-3 text-white focus:border-[#3b82f6] outline-none placeholder:text-slate-600" placeholder="Digite seu nome..." value={suggestionForm.name} onChange={e => setSuggestionForm({...suggestionForm, name: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[13px] font-bold text-[#94a3b8] uppercase tracking-[0.5px] mb-2">Tipo</label>
                        <select className="w-full bg-[#111827] border border-[rgba(148,163,184,0.25)] rounded-lg p-3 text-white focus:border-[#3b82f6] outline-none" value={suggestionForm.category} onChange={e => setSuggestionForm({...suggestionForm, category: e.target.value})}>
                          <option value="Melhoria">Melhoria</option>
                          <option value="Bug/Erro">Bug/Erro</option>
                          <option value="Nova Funcionalidade">Nova Funcionalidade</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[13px] font-bold text-[#94a3b8] uppercase tracking-[0.5px] mb-2">Mensagem (Descrição)</label>
                        <textarea className="w-full bg-[#111827] border border-[rgba(148,163,184,0.25)] rounded-lg p-3 text-white focus:border-[#3b82f6] outline-none placeholder:text-slate-600" rows={4} placeholder="Descreva sua sugestão..." value={suggestionForm.desc} onChange={e => setSuggestionForm({...suggestionForm, desc: e.target.value})} />
                      </div>
                      <button onClick={handleSuggestionSubmit} className="w-full py-3 bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-lg text-white font-bold flex justify-center items-center gap-2 hover:shadow-[0_8px_24px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 transition-all">
                        <Send size={18}/> Enviar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {view === 'manual' && <ManualView />}
            {view === 'review-suggestions' && <ReviewSuggestionsView />}
          </Suspense>
        </div>
      </main>
      
      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(11,17,33,0.92)] backdrop-blur-[18px] p-4 animate-in fade-in duration-200">
          <div className="bg-[rgba(17,24,39,0.95)] w-full max-w-4xl rounded-[18px] border border-[rgba(148,163,184,0.25)] shadow-[0_24px_70px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[rgba(148,163,184,0.08)] flex justify-between items-center bg-[rgba(17,24,39,0.98)]">
              <div><h3 className="text-xl font-bold text-white">Detalhes do Equipamento</h3><p className="text-sm text-[#94a3b8] mt-1 font-mono">{selectedItem.tag}</p></div>
              <button onClick={() => setSelectedItem(null)} className="text-[#94a3b8] hover:text-[#ef4444] transition-colors"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
               <div className="flex flex-col md:flex-row gap-8 mb-8">
                  <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-lg border border-slate-200 min-w-[200px]">
                      {(() => { const baseUrl = window.location.origin; const qrValue = `${baseUrl}?tag=${encodeURIComponent(selectedItem.tag)}`; const qr = new window.QRious({ value: qrValue, size: 160, level: 'H' }); return <img src={qr.toDataURL()} alt="QR Code" className="w-40 h-40" />; })()}
                      <span className="text-xs text-slate-900 font-mono mt-3 font-bold tracking-widest">{selectedItem.tag}</span>
                      <button onClick={() => downloadSingleLabel(selectedItem)} className="mt-4 text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 flex items-center gap-1 transition-colors"><Printer size={12} /> Baixar Etiqueta QR</button>
                  </div>
                  <div className="flex-1 space-y-4">
                      <div className="bg-[rgba(59,130,246,0.08)] p-5 rounded-xl border border-[rgba(59,130,246,0.2)]">
                        <h4 className="text-[12px] font-bold text-[#94a3b8] mb-3 uppercase tracking-[1px] flex items-center gap-2"><Repeat size={14} /> Status de Validade</h4>
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-sm text-slate-400">Vence em</span>
                                <span className="text-white font-mono font-bold text-lg">{formatDateBR(parseDateSafe(selectedItem.dataProximaCalibracao || selectedItem.dataProximaInspecao || selectedItem.dataValidade))}</span>
                            </div>
                            {/* Updated Status Badge Logic in Modal */}
                            <span className={`px-4 py-2 rounded-lg text-sm font-bold shadow-lg ${
                                daysUntilExpiry === null ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30' :
                                daysUntilExpiry < 0 ? 'bg-[#ef4444] text-white' : 
                                daysUntilExpiry <= warnDays ? 'bg-[#f59e0b] text-black' : 
                                'bg-[#10b981] text-black'
                            }`}>
                                {daysUntilExpiry === null ? 'N/A' : daysUntilExpiry < 0 ? 'VENCIDO' : daysUntilExpiry <= warnDays ? 'ATENÇÃO' : 'VÁLIDO'}
                            </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-[#111827]/50 p-4 rounded-xl border border-white/5"><span className="text-[10px] uppercase text-[#64748b] font-bold block mb-1">Local</span><span className="text-white font-medium break-all">{selectedItem.local || selectedItem.localizacao || 'N/A'}</span></div>
                          <div className="bg-[#111827]/50 p-4 rounded-xl border border-white/5"><span className="text-[10px] uppercase text-[#64748b] font-bold block mb-1">Categoria</span><span className="text-white font-medium">{selectedItem.categoria}</span></div>
                      </div>
                  </div>
               </div>
               <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-widest border-b border-white/10 pb-2">Especificações Técnicas Completas</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                   {(FORM_CONFIG[selectedItem.categoria] || []).map(field => {
                       const value = (selectedItem as any)[field.name];
                       let displayValue: React.ReactNode = value || '-';
                       if (field.type === 'date' && value) displayValue = formatDateBR(parseDateSafe(value));
                       if (field.type === 'url' && value) displayValue = <a href={value} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all flex items-center gap-1">Abrir Link <ExternalLink size={12}/></a>;
                       return (<div key={field.name} className="flex justify-between items-baseline border-b border-[rgba(148,163,184,0.08)] pb-2"><span className="text-[11px] uppercase tracking-[0.5px] text-[#64748b] font-bold w-1/3">{field.label}</span><span className="text-sm text-white font-medium text-right w-2/3 break-words pl-2">{displayValue}</span></div>);
                   })}
               </div>
            </div>
            <div className="p-6 border-t border-[rgba(148,163,184,0.08)] flex justify-end gap-3 bg-[rgba(17,24,39,0.98)]">
              <button onClick={() => downloadHistoryExcel(selectedItem)} className="px-5 py-2.5 bg-[#0f766e] text-white border border-transparent rounded-lg font-bold hover:bg-[#115e59] transition-all flex items-center gap-2"><History size={18} /> Baixar Histórico</button>
              <button onClick={() => { setSelectedItem(null); startEditing(selectedItem); }} className="px-5 py-2.5 bg-[#111827] border border-[rgba(148,163,184,0.25)] text-[#94a3b8] rounded-lg font-bold hover:text-white hover:border-[#3b82f6] transition-all flex items-center gap-2"><Edit3 size={18} /> Editar</button>
              <button onClick={handleDeleteClick} className="px-5 py-2.5 bg-[#ef4444] text-white border border-transparent rounded-lg font-bold hover:bg-[#dc2626] transition-all flex items-center gap-2"><Trash2 size={18} /> Obsoleto</button>
              <button onClick={() => generatePDF(selectedItem)} className="px-5 py-2.5 bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white rounded-lg font-bold hover:shadow-[0_8px_24px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 transition-all flex items-center gap-2"><Download size={18} /> PDF</button>
            </div>
          </div>
        </div>
      )}

      <DeleteModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={selectedItem?.tag || ''}
      />
    </div>
  );
}

export default App;
