/**
 * Bibliotecas de PDF, Excel e QR — empacotadas, não vindas de CDN.
 *
 * Elas eram carregadas do cdnjs e usadas como globais (window.QRious etc.).
 * O QRious é instanciado DENTRO do render do modal de detalhes, então bastava
 * o CDN falhar — firewall da fábrica, indisponibilidade, offline — para
 * "window.QRious is not a constructor" derrubar a árvore de componentes e o
 * modal simplesmente não abrir. Um recurso de exportação quebrava a leitura.
 *
 * Empacotando, o app deixa de depender de rede externa, o CSP dispensa
 * cdnjs, e some uma ida à rede no carregamento inicial.
 *
 * Os globais continuam sendo preenchidos de propósito: são 18 pontos de uso
 * espalhados por App.tsx, ExportView e ManualView, e reescrevê-los todos
 * agora seria risco sem ganho. O import garante que existam antes do React
 * montar.
 */
import jsPDFAutoTable from 'jspdf-autotable';
import QRious from 'qrious';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

// jspdf-autotable registra o método autoTable no protótipo do jsPDF.
void jsPDFAutoTable;

const w = window as any;
w.QRious = QRious;
w.jspdf = { jsPDF };
w.XLSX = XLSX;

export {};
