/**
 * Geração do relatório em PDF.
 *
 * Ficava embutida em ExportView como um doc.text + autoTable de seis
 * colunas sem nenhuma identidade visual — um segundo relatório (a etiqueta
 * de equipamento em App.tsx) já tinha layout próprio, mas o de exportação
 * em massa, que é o mais usado, ficou o mais pobre dos dois.
 *
 * Isolado aqui porque a lógica de desenho (cabeçalho, cartões de resumo,
 * rodapé por página) não tem relação com o componente React que a aciona —
 * e assim pode ser reutilizada se um dia surgir outro relatório.
 */
import { Equipment } from '../types';
import { expiryTimestamp, formatDateBR, getDaysUntilExpiry } from '../utils';

declare const window: any;

// Mesmas cores de --st-ok/--st-warn/--st-danger/--st-neutral usadas nos
// cards e no CSS: o PDF deve parecer parte do mesmo sistema, não outro app.
const BRAND: [number, number, number] = [59, 130, 246];
const BRAND_DARK: [number, number, number] = [11, 17, 33];
const COLOR = {
  ok: [16, 185, 129] as [number, number, number],
  warn: [245, 158, 11] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  none: [100, 116, 139] as [number, number, number],
};
const TEXT_MUTED: [number, number, number] = [100, 116, 139];
const BORDER: [number, number, number] = [226, 232, 240];

type Situacao = 'Vencido' | 'Atenção' | 'Válido' | 'Sem data';

function situacaoOf(item: Equipment, warnDays: number): Situacao {
  const days = getDaysUntilExpiry(item);
  if (days === null) return 'Sem data';
  if (days < 0) return 'Vencido';
  return days <= warnDays ? 'Atenção' : 'Válido';
}

function colorOf(situacao: Situacao): [number, number, number] {
  if (situacao === 'Vencido') return COLOR.danger;
  if (situacao === 'Atenção') return COLOR.warn;
  if (situacao === 'Válido') return COLOR.ok;
  return COLOR.none;
}

export interface ExportPdfFilters {
  category: string;
  status: string;
  location: string;
}

const STATUS_LABEL: Record<string, string> = {
  all: 'Todos',
  ok: 'Válidos',
  warn: 'Atenção',
  danger: 'Vencidos',
};

export function generateExportPdf(list: Equipment[], filters: ExportPdfFilters, warnDays: number): void {
  const doc = new window.jspdf.jsPDF('l', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  const now = new Date();
  const generatedAt =
    now.toLocaleDateString('pt-BR') +
    ' às ' +
    now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const counts = { ok: 0, warn: 0, danger: 0, none: 0 };
  list.forEach((item) => {
    const s = situacaoOf(item, warnDays);
    if (s === 'Válido') counts.ok += 1;
    else if (s === 'Atenção') counts.warn += 1;
    else if (s === 'Vencido') counts.danger += 1;
    else counts.none += 1;
  });

  const filterParts: string[] = [
    `Categoria: ${filters.category === 'all' ? 'Todas' : filters.category}`,
    `Situação: ${STATUS_LABEL[filters.status] || 'Todos'}`,
  ];
  if (filters.location.trim()) filterParts.push(`Local: "${filters.location.trim()}"`);

  /** Cabeçalho e rodapé, redesenhados em toda página pelo autoTable. */
  function drawHeader() {
    doc.setFillColor(...BRAND_DARK);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setFillColor(...BRAND);
    doc.rect(0, 24, pageWidth, 1.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('OTAMERICA', margin, 11);
    doc.setTextColor(...BRAND);
    doc.text('SENTINEL', margin + doc.getTextWidth('OTAMERICA ') + 2, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 210, 225);
    doc.text('Relatório de equipamentos e validade de certificados', margin, 18);

    doc.setFontSize(8.5);
    doc.setTextColor(180, 190, 210);
    doc.text(`Gerado em ${generatedAt}`, pageWidth - margin, 11, { align: 'right' });
    doc.text(filterParts.join('   •   '), pageWidth - margin, 17, { align: 'right' });
  }

  function drawFooter(pageNumber: number, pageCount: number) {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Sentinel — controle de validade de certificados e calibrações', margin, pageHeight - 7);
    doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  drawHeader();

  // Cartões de resumo: um retângulo por situação, com a contagem e a cor que
  // o resto do app já usa para o mesmo status — o relatório deve ser
  // reconhecível como a mesma ferramenta, não um documento à parte.
  const cards: { label: string; value: number; color: [number, number, number] }[] = [
    { label: 'TOTAL', value: list.length, color: BRAND },
    { label: 'VÁLIDOS', value: counts.ok, color: COLOR.ok },
    { label: 'ATENÇÃO', value: counts.warn, color: COLOR.warn },
    { label: 'VENCIDOS', value: counts.danger, color: COLOR.danger },
  ];
  const cardGap = 4;
  const cardW = (pageWidth - margin * 2 - cardGap * (cards.length - 1)) / cards.length;
  const cardY = 30;
  const cardH = 16;

  cards.forEach((card, i) => {
    const x = margin + i * (cardW + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, cardY, cardW, cardH, 2, 2, 'FD');
    doc.setDrawColor(...card.color);
    doc.setLineWidth(1);
    doc.line(x, cardY, x, cardY + cardH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...card.color);
    doc.text(String(card.value), x + 5, cardY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(card.label, x + 5, cardY + 14);
  });

  const tableStartY = cardY + cardH + 8;

  const head = [['#', 'TAG', 'Categoria', 'Equipamento', 'Local', 'Nº Certificado', 'Validade', 'Situação']];
  const body = list.map((item, idx) => [
    idx + 1,
    item.tag,
    item.categoria,
    item.equipamento || item.modelo || '-',
    item.local || item.localizacao || '-',
    item.numCertificado || '-',
    formatDateBR(expiryTimestamp(item)),
    situacaoOf(item, warnDays),
  ]);
  const SITUACAO_COL = head[0].length - 1;

  (doc as any).autoTable({
    head,
    body,
    startY: tableStartY,
    margin: { left: margin, right: margin, bottom: 16 },
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: BRAND_DARK, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { fontStyle: 'bold', font: 'courier' },
      6: { halign: 'center' },
      7: { halign: 'center', fontStyle: 'bold' },
    },
    // Colore só a célula de Situação, na cor do próprio status — é a
    // informação que mais importa numa varredura visual rápida do relatório.
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === SITUACAO_COL) {
        const situacao = data.cell.raw as Situacao;
        const [r, g, b] = colorOf(situacao);
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fillColor = [r, g, b];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: () => {
      // A primeira página já tem cabeçalho e cartões desenhados antes da
      // tabela; nas seguintes, o autoTable dispara este hook a cada página
      // nova, então só o cabeçalho se repete.
      if (doc.internal.getCurrentPageInfo().pageNumber > 1) drawHeader();
    },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    drawFooter(p, pageCount);
  }

  const stamp = now.toISOString().slice(0, 10);
  doc.save(`sentinel_relatorio_${stamp}.pdf`);
}
