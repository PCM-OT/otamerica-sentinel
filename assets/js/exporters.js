/**
 * SENTINEL — Geração de PDF, Excel e etiquetas QR.
 */

import { statusLabel, statusRgb } from './status.js';
import { itemsByTags, periodicityOf, state } from './store.js';
import { formatBR, qrDataUrl, requireLib, toast } from './utils.js';
import { appBaseUrl } from './config.js';

const BLUE = [59, 130, 246];
const DARK = [11, 17, 33];
const A4 = { w: 210, h: 297 };

const itemUrl = (tag) => `${appBaseUrl()}?tag=${encodeURIComponent(tag)}`;
const stamp = () => formatBR(new Date());

function newDoc() {
  const { jsPDF } = window.jspdf;
  return new jsPDF();
}

function header(doc, title) {
  doc.setFillColor(...DARK);
  doc.rect(0, 0, A4.w, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('OTAMERICA | SENTINEL ASSET MANAGEMENT', 14, 26);
}

function footer(doc) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em ${stamp()} via Sentinel`, 14, A4.h - 7);
    doc.text(`Página ${i} de ${pages}`, A4.w - 14, A4.h - 7, { align: 'right' });
  }
}

/* ------------------------------------------------------------------ *
 * Ficha técnica individual
 * ------------------------------------------------------------------ */

export function downloadItemPdf(item) {
  if (!requireLib('pdf')) return;
  const doc = newDoc();
  header(doc, 'FICHA TÉCNICA');

  doc.setTextColor(...BLUE);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(item.tag, A4.w - 14, 18, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text(item.cat || '-', A4.w - 14, 26, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. DADOS DO EQUIPAMENTO', 14, 45);
  doc.setLineWidth(0.5);
  doc.line(14, 47, A4.w - 14, 47);

  const ignore = new Set([
    'TAG', 'EQUIPAMENTO', 'DATA DE VALIDADE', 'DATA DE CERTIFICAÇÃO', 'DATA DE CALIBRAÇÃO',
    'RESULTADO', 'LINK', 'ARQUIVO', 'ANEXO', 'Nº DO CERTIFICADO', 'STATUS', 'VENCIMENTO',
    'LOCALIZAÇÃO', 'FABRICANTE', 'MODELO', 'LABORATÓRIO', 'LABORATÓRIO / ORGANISMO CALIBRADOR',
    'ORGANISMO CALIBRADOR', 'INCERTEZA', 'INCERTEZA DE MEDIÇÃO', 'EMA', 'ERRO MÁXIMO ADMISSÍVEL',
    'PERIODICIDADE', 'PERIODICIDADE (MESES)',
  ]);

  const body = [
    ['Equipamento', item.equip || '-'],
    ['Localização', item.local || '-'],
    ['Fabricante', item.fab || '-'],
    ['Modelo', item.model || '-'],
    ['Nº do certificado', item.certNum || '-'],
    ['Certificado em', item.certifiedAtLabel || '-'],
    ['Periodicidade', `${periodicityOf(item)} meses`],
    ['Vencimento', item.dateLabel || 'sem data'],
    ['Resultado', item.result || '-'],
    ['Laboratório / organismo', item.lab || '-'],
    ['Incerteza de medição', item.uncertainty || '-'],
    ['Erro máximo admissível', item.ema || '-'],
    ['Status', statusLabel(item.health) + (item.blocked ? ' — BLOQUEADO (certificado reprovado)' : '')],
    ['Situação', item.activeState || 'Ativo'],
  ];

  Object.entries(item.fullDetails)
    .filter(([k, v]) => v && v !== '-' && !ignore.has(k.toUpperCase()))
    .forEach(([k, v]) => body.push([k, String(v)]));

  doc.autoTable({
    startY: 52,
    body,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 247, 250], cellWidth: 60 } },
  });

  // QR aponta para a ficha online — sempre atualizada — em vez de um JSON
  // congelado no momento da impressão.
  const qr = qrDataUrl(itemUrl(item.tag), 400);
  if (qr) {
    const qrSize = 45;
    const x = (A4.w - qrSize) / 2;
    let y = doc.lastAutoTable.finalY + 15;
    if (y + qrSize + 15 > A4.h - 15) {
      doc.addPage();
      y = 25;
    }
    doc.addImage(qr, 'PNG', x, y, qrSize, qrSize);
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('Escaneie para abrir a ficha atualizada', A4.w / 2, y + qrSize + 5, { align: 'center' });
  }

  footer(doc);
  doc.save(`${item.tag}_Ficha_Tecnica.pdf`);
}

/* ------------------------------------------------------------------ *
 * Relatório da seleção
 * ------------------------------------------------------------------ */

const SEVERITY = { danger: 0, warn: 1, none: 2, ok: 3 };

function selectedItems() {
  const items = itemsByTags(state.exportSelected);
  return items.sort((a, b) => SEVERITY[a.health] - SEVERITY[b.health] || a.tag.localeCompare(b.tag, 'pt-BR'));
}

export function downloadReportPdf() {
  const items = selectedItems();
  if (!items.length) return toast('Selecione ao menos um equipamento.', 'warn');
  if (!requireLib('pdf')) return;

  const doc = newDoc();
  header(doc, 'RELATÓRIO DE EXPORTAÇÃO');
  doc.setFontSize(9);
  doc.text(`Data: ${stamp()}`, A4.w - 14, 18, { align: 'right' });
  doc.text(`${items.length} equipamentos`, A4.w - 14, 26, { align: 'right' });

  doc.autoTable({
    startY: 42,
    head: [['#', 'TAG', 'EQUIPAMENTO', 'LOCAL', 'VENCIMENTO', 'DIAS', 'STATUS']],
    body: items.map((item, i) => [
      i + 1,
      item.tag,
      item.equip || '-',
      item.local || '-',
      item.dateLabel || 'sem data',
      item.days === null ? '-' : item.days,
      statusLabel(item.health),
    ]),
    theme: 'striped',
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 26 }, 5: { cellWidth: 14, halign: 'right' } },
    // Colore a coluna de status conforme a severidade.
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 6) return;
      const item = items[data.row.index];
      data.cell.styles.textColor = statusRgb(item.health);
      data.cell.styles.fontStyle = 'bold';
    },
  });

  footer(doc);
  doc.save(`Sentinel_Relatorio_${stamp().replace(/\//g, '-')}.pdf`);
}

/* ------------------------------------------------------------------ *
 * Etiquetas QR
 * ------------------------------------------------------------------ */

export function downloadQrLabels() {
  const items = selectedItems();
  if (!items.length) return toast('Selecione ao menos um equipamento.', 'warn');
  if (!requireLib('pdf') || !requireLib('qr')) return;

  const doc = newDoc();
  const margin = 10;
  const cols = 3;
  const rows = 7;
  const cellW = (A4.w - margin * 2) / cols;
  const cellH = (A4.h - margin * 2) / rows;
  const perPage = cols * rows;
  const qrSize = 24;

  items.forEach((item, index) => {
    const slot = index % perPage;
    if (index > 0 && slot === 0) doc.addPage();

    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const x = margin + col * cellW;
    const y = margin + row * cellH;

    doc.setDrawColor(210, 214, 220);
    doc.setLineWidth(0.2);
    doc.rect(x + 1, y + 1, cellW - 2, cellH - 2);

    doc.addImage(qrDataUrl(itemUrl(item.tag), 400), 'PNG', x + 4, y + 4, qrSize, qrSize);

    const textX = x + qrSize + 8;
    const textW = cellW - qrSize - 12;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(item.tag, textW), textX, y + 9);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(doc.splitTextToSize(item.equip || '-', textW).slice(0, 2), textX, y + 14);

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`Venc.: ${item.dateLabel || '—'}`, textX, y + 23);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...statusRgb(item.health));
    doc.text(statusLabel(item.health), textX, y + 27);
    doc.setFont('helvetica', 'normal');
  });

  doc.save('Sentinel_Etiquetas_QR.pdf');
}

/* ------------------------------------------------------------------ *
 * Excel
 * ------------------------------------------------------------------ */

export function downloadXlsx() {
  const items = selectedItems();
  if (!items.length) return toast('Selecione ao menos um equipamento.', 'warn');
  if (!requireLib('xlsx')) return;

  const rows = items.map((item) => ({
    TAG: item.tag,
    EQUIPAMENTO: item.equip,
    CATEGORIA: item.cat,
    LOCAL: item.local,
    FABRICANTE: item.fab,
    MODELO: item.model,
    'Nº CERTIFICADO': item.certNum,
    'CERTIFICADO EM': item.certifiedAtLabel,
    'PERIODICIDADE (MESES)': periodicityOf(item),
    VENCIMENTO: item.dateLabel,
    'DIAS RESTANTES': item.days === null ? '' : item.days,
    RESULTADO: item.result,
    LABORATÓRIO: item.lab,
    'INCERTEZA DE MEDIÇÃO': item.uncertainty,
    'ERRO MÁX. ADMISSÍVEL': item.ema,
    STATUS: statusLabel(item.health),
    BLOQUEADO: item.blocked ? 'SIM' : '',
    SITUAÇÃO: item.activeState || 'Ativo',
    FICHA: itemUrl(item.tag),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 }, { wch: 32 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
    { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 },
    { wch: 24 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 40 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sentinel');
  XLSX.writeFile(wb, `Sentinel_${stamp().replace(/\//g, '-')}.xlsx`);
}
