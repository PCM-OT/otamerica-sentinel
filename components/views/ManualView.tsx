import React from 'react';
import { 
  BookOpen, Search, Edit3, Trash2, Download, QrCode, ShieldCheck, 
  ArrowRightLeft, Target, GitMerge, Activity, CheckCircle2, AlertTriangle, AlertCircle 
} from 'lucide-react';

declare const window: any;

const ManualView: React.FC = () => {

  const generateManualPDF = () => {
    try {
        const doc = new window.jspdf.jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 20;

        // --- Helper Functions for PDF Drawing ---

        const checkPageBreak = (heightNeeded: number) => {
            if (y + heightNeeded > 280) {
                doc.addPage();
                y = 20;
            }
        };

        const addTitle = (text: string) => {
            checkPageBreak(15);
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(59, 130, 246); // Brand Blue
            doc.text(text, margin, y);
            y += 10;
        };

        const addSubtitle = (text: string) => {
            checkPageBreak(10);
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(text, margin, y);
            y += 8;
        };

        const addParagraph = (text: string) => {
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(60, 60, 60);
            const lines = doc.splitTextToSize(text, pageWidth - (margin * 2));
            checkPageBreak(lines.length * 5);
            doc.text(lines, margin, y);
            y += (lines.length * 5) + 5;
        };

        const drawStatusLegend = () => {
            checkPageBreak(40);
            const startY = y;
            const boxSize = 6;
            
            // Green
            doc.setFillColor(16, 185, 129);
            doc.rect(margin, y, boxSize, boxSize, 'F');
            doc.setFontSize(9); doc.setTextColor(0,0,0); doc.setFont(undefined, 'bold');
            doc.text("VERDE (Válido)", margin + 10, y + 4);
            doc.setFont(undefined, 'normal'); doc.setTextColor(100,100,100);
            doc.text("Validade > 45 dias. Equipamento seguro.", margin + 50, y + 4);
            y += 10;

            // Yellow
            doc.setFillColor(245, 158, 11);
            doc.rect(margin, y, boxSize, boxSize, 'F');
            doc.setFontSize(9); doc.setTextColor(0,0,0); doc.setFont(undefined, 'bold');
            doc.text("AMARELO (Atenção)", margin + 10, y + 4);
            doc.setFont(undefined, 'normal'); doc.setTextColor(100,100,100);
            doc.text("Vence em breve (≤ 45 dias). Planejar calibração.", margin + 50, y + 4);
            y += 10;

            // Red
            doc.setFillColor(239, 68, 68);
            doc.rect(margin, y, boxSize, boxSize, 'F');
            doc.setFontSize(9); doc.setTextColor(0,0,0); doc.setFont(undefined, 'bold');
            doc.text("VERMELHO (Vencido)", margin + 10, y + 4);
            doc.setFont(undefined, 'normal'); doc.setTextColor(100,100,100);
            doc.text("Validade expirada. Bloquear uso imediatamente.", margin + 50, y + 4);
            y += 15;
        };

        const drawFlowchart = () => {
            checkPageBreak(60);
            const boxWidth = 50;
            const boxHeight = 12;
            const centerX = pageWidth / 2;
            
            doc.setFontSize(8);
            doc.setDrawColor(100, 116, 139);
            doc.setTextColor(255, 255, 255);

            // Step 1
            doc.setFillColor(30, 41, 59); // Dark Slate
            doc.roundedRect(centerX - (boxWidth/2), y, boxWidth, boxHeight, 2, 2, 'F');
            doc.text("1. Identificação de Pares", centerX, y + 7, { align: 'center' });
            y += boxHeight;

            // Arrow
            doc.setDrawColor(59, 130, 246);
            doc.line(centerX, y, centerX, y + 8);
            y += 8;

            // Step 2
            doc.setFillColor(59, 130, 246); // Blue
            doc.roundedRect(centerX - (boxWidth/2), y, boxWidth, boxHeight, 2, 2, 'F');
            doc.text("2. Análise de Datas", centerX, y + 7, { align: 'center' });
            y += boxHeight;

             // Arrow
            doc.line(centerX, y, centerX, y + 8);
            y += 8;

            // Step 3
            doc.setFillColor(16, 185, 129); // Emerald
            doc.roundedRect(centerX - (boxWidth/2), y, boxWidth, boxHeight, 2, 2, 'F');
            doc.text("3. Sugestão de Troca", centerX, y + 7, { align: 'center' });
            y += 15;
            
            doc.setTextColor(60, 60, 60); // Reset Text
        };

        // --- Content Generation ---

        // CAPA
        doc.setFillColor(11, 17, 33);
        doc.rect(0, 0, pageWidth, 297, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(30);
        doc.setFont(undefined, 'bold');
        doc.text('MANUAL DO USUÁRIO', pageWidth / 2, 120, { align: 'center' });
        doc.setFontSize(14);
        doc.setTextColor(59, 130, 246);
        doc.text('SENTINEL NEXUS V33', pageWidth / 2, 135, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('Versão PDF Gerada Automaticamente', pageWidth / 2, 145, { align: 'center' });
        
        doc.addPage();
        y = 20;
        doc.setTextColor(0,0,0);

        // 1. OBJETIVO
        addTitle('1. Objetivo e Concepção');
        addParagraph('O Sentinel Nexus foi concebido para resolver um problema crítico na indústria: o gerenciamento descentralizado e propenso a falhas de ativos de segurança.');
        addParagraph('O objetivo principal é mitigar riscos operacionais, garantindo que nenhum equipamento (como luvas isolantes, manômetros ou ferramentas) seja utilizado com a validade de inspeção vencida.');
        addParagraph('O sistema atua como uma camada de inteligência (Business Intelligence) sobre os dados brutos, transformando datas de validade em alertas visuais acionáveis.');

        // 2. DASHBOARD
        addTitle('2. O Painel Principal (Dashboard)');
        addSubtitle('Legenda Visual de Status');
        addParagraph('O sistema utiliza cores para comunicação instantânea de risco:');
        drawStatusLegend();

        // 3. MANÔMETROS GÊMEOS
        addTitle('3. Inteligência de Manômetros Gêmeos');
        addParagraph('O sistema possui um algoritmo exclusivo para "Manômetros Gêmeos". Em muitas instalações, existe um manômetro Principal (em uso) e um Reserva (guardado).');
        addParagraph('O Sentinel Nexus identifica automaticamente esses pares se eles tiverem o mesmo "Local" e a mesma "Faixa de Indicação".');
        addSubtitle('Lógica do Algoritmo (Fluxo)');
        drawFlowchart();
        addParagraph('Se o Manômetro Principal estiver vencendo (< 30 dias) e o Reserva estiver com validade longa, o sistema emite um alerta de "Sugestão de Troca" no topo do Dashboard, otimizando a logística de manutenção.');

        // 4. NAVEGAÇÃO
        addTitle('4. Navegação e Busca');
        addParagraph('A barra lateral contém o menu. No topo, a barra de busca global permite encontrar qualquer ativo pelo TAG, Equipamento ou Local.');
        
        // 5. CADASTRO E EDIÇÃO
        addTitle('5. Cadastro e Edição');
        addSubtitle('Cadastrando');
        addParagraph('Use o botão "Novo Cadastro" no menu lateral. Preencha os campos obrigatórios (*). O sistema calcula automaticamente os status.');
        addSubtitle('Editando (Fluxo Correto)');
        addParagraph('Para garantir a integridade dos dados, a edição é feita através dos detalhes do item:');
        addParagraph('1. Busque o equipamento no Dashboard (via busca ou filtros).');
        addParagraph('2. Clique no cartão do equipamento para abrir a janela de "Detalhes".');
        addParagraph('3. No rodapé da janela de detalhes, clique no botão "Editar".');

        // 6. EXPORTAÇÃO
        addTitle('6. Exportação e Documentos');
        addParagraph('Na aba "Exportação", é possível gerar relatórios em PDF ou planilhas Excel filtradas por setor ou status, facilitando auditorias e reuniões de gestão.');

        doc.save('Manual_Sentinel_Nexus.pdf');
    } catch (e) {
        alert("Erro ao gerar PDF.");
        console.error(e);
    }
  };

  return (
    <div className="p-8 pb-32 max-w-5xl mx-auto text-[#f8fafc] font-sans">
        <div className="flex justify-between items-center mb-10 border-b border-slate-700 pb-6">
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-200 flex items-center gap-3">
                    <BookOpen size={32} className="text-blue-500"/> Manual do Usuário
                </h1>
                <p className="text-slate-400 mt-2">Guia operacional e conceitual do Sentinel Nexus V33.</p>
            </div>
            <button 
                onClick={generateManualPDF}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all hover:-translate-y-1"
            >
                <Download size={20} /> Baixar Manual em PDF
            </button>
        </div>

        <div className="space-y-16">
            
            {/* SEÇÃO 1: OBJETIVO */}
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400"><Target /></div>
                    <h2 className="text-2xl font-bold text-white">1. Objetivo e Concepção do Sistema</h2>
                </div>
                <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800">
                    <p className="text-slate-300 leading-relaxed mb-6">
                        O <strong>Sentinel Nexus</strong> não é apenas uma planilha digitalizada. Ele foi pensado para ser um 
                        <span className="text-blue-400 font-bold"> Escudo Ativo de Conformidade</span>. 
                        Em ambientes industriais, o controle de validade de EPIs e instrumentos críticos (como manômetros) muitas vezes falha por erro humano ou falta de visibilidade.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                            <ShieldCheck className="text-emerald-400 mb-2" size={24}/>
                            <h3 className="font-bold text-white mb-1">Segurança</h3>
                            <p className="text-xs text-slate-400">Garantir que nenhum colaborador use equipamentos vencidos.</p>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                            <Activity className="text-blue-400 mb-2" size={24}/>
                            <h3 className="font-bold text-white mb-1">Confiabilidade</h3>
                            <p className="text-xs text-slate-400">Assegurar precisão nas medições através de calibrações em dia.</p>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center text-center">
                            <GitMerge className="text-purple-400 mb-2" size={24}/>
                            <h3 className="font-bold text-white mb-1">Centralização</h3>
                            <p className="text-xs text-slate-400">Unificar dados dispersos em uma única fonte da verdade.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SEÇÃO 2: MANÔMETROS GÊMEOS (FLUXOGRAMA) */}
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400"><ArrowRightLeft /></div>
                    <h2 className="text-2xl font-bold text-white">2. Inteligência de Manômetros Gêmeos</h2>
                </div>
                
                <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800">
                    <p className="text-slate-300 mb-8">
                        O sistema automatiza a gestão de troca entre instrumentos instalados e de reserva.
                        O algoritmo segue o seguinte fluxo lógico para gerar alertas de <strong>Sugestão de Troca</strong>:
                    </p>

                    {/* CSS Flowchart Representation */}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 relative py-4">
                        <div className="flex flex-col items-center z-10">
                            <div className="w-48 p-3 bg-slate-800 rounded-lg border border-slate-700 text-center text-sm font-bold text-white shadow-lg">
                                Coleta de Dados
                            </div>
                            <div className="text-slate-600 text-xs mt-1">Busca todos os manômetros</div>
                        </div>
                        
                        <div className="hidden md:block w-12 h-0.5 bg-slate-700"></div> {/* Horizontal Line */}
                        <div className="block md:hidden w-0.5 h-8 bg-slate-700"></div> {/* Vertical Line Mobile */}

                        <div className="flex flex-col items-center z-10">
                            <div className="w-48 p-3 bg-blue-900/30 rounded-lg border border-blue-500/30 text-center text-sm font-bold text-blue-200 shadow-lg">
                                Agrupamento
                            </div>
                            <div className="text-slate-600 text-xs mt-1">Mesmo Local + Mesma Faixa</div>
                        </div>

                        <div className="hidden md:block w-12 h-0.5 bg-slate-700"></div>
                        <div className="block md:hidden w-0.5 h-8 bg-slate-700"></div>

                        <div className="flex flex-col items-center z-10">
                            <div className="w-48 p-3 bg-emerald-900/30 rounded-lg border border-emerald-500/30 text-center text-sm font-bold text-emerald-200 shadow-lg">
                                Decisão
                            </div>
                            <div className="text-slate-600 text-xs mt-1">Principal Vencendo & Reserva OK?</div>
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex gap-3 items-start">
                        <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={18} />
                        <div>
                            <h4 className="text-yellow-500 font-bold text-sm">O Resultado</h4>
                            <p className="text-slate-400 text-sm">
                                Se a condição for verdadeira, um card especial aparece no topo do Dashboard sugerindo a inversão física dos equipamentos.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SEÇÃO 3: EDIÇÃO CORRETA */}
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400"><Edit3 /></div>
                    <h2 className="text-2xl font-bold text-white">3. Como Editar um Equipamento</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                        <h3 className="font-bold text-white mb-4">Fluxo Padrão</h3>
                        <ol className="relative border-l border-slate-700 ml-3 space-y-6">
                            <li className="ml-6">
                                <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-slate-800 rounded-full ring-4 ring-slate-900 text-xs font-bold text-blue-500">1</span>
                                <h4 className="font-bold text-slate-200">Localizar</h4>
                                <p className="text-sm text-slate-400">Use a busca global no topo ou os filtros para encontrar o card do equipamento.</p>
                            </li>
                            <li className="ml-6">
                                <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-slate-800 rounded-full ring-4 ring-slate-900 text-xs font-bold text-blue-500">2</span>
                                <h4 className="font-bold text-slate-200">Abrir Detalhes</h4>
                                <p className="text-sm text-slate-400">Clique no botão "Ver Detalhes" dentro do card.</p>
                            </li>
                            <li className="ml-6">
                                <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-slate-800 rounded-full ring-4 ring-slate-900 text-xs font-bold text-blue-500">3</span>
                                <h4 className="font-bold text-slate-200">Editar</h4>
                                <p className="text-sm text-slate-400">No rodapé da janela de detalhes, clique no botão cinza "Editar". Isso abrirá o formulário com os dados carregados.</p>
                            </li>
                        </ol>
                    </div>
                    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex flex-col justify-center items-center text-center">
                        <AlertCircle size={48} className="text-slate-600 mb-4" />
                        <h3 className="font-bold text-white">Nota Importante</h3>
                        <p className="text-sm text-slate-400 mt-2">
                            A edição altera os dados em tempo real para todos os usuários. Certifique-se de ter as informações corretas (certificados, datas) antes de salvar.
                        </p>
                    </div>
                </div>
            </section>

             {/* SEÇÃO 4: LEGENDAS VISUAIS */}
             <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400"><CheckCircle2 /></div>
                    <h2 className="text-2xl font-bold text-white">4. Legenda de Status</h2>
                </div>
                
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                            <span className="font-bold text-emerald-400">Válido</span>
                        </div>
                        <p className="text-xs text-slate-400">Equipamento seguro para uso. Validade superior a 45 dias.</p>
                    </div>
                    <div className="p-4 bg-amber-900/10 border border-amber-500/20 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]"></div>
                            <span className="font-bold text-amber-400">Atenção</span>
                        </div>
                        <p className="text-xs text-slate-400">Vence em breve (menos de 45 dias). Necessário agendar calibração.</p>
                    </div>
                    <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
                            <span className="font-bold text-red-400">Vencido</span>
                        </div>
                        <p className="text-xs text-slate-400">Validade expirada. O uso do equipamento está proibido.</p>
                    </div>
                </div>
            </section>

        </div>
    </div>
  );
};

export default ManualView;