/**
 * SENTINEL — Utilitários compartilhados.
 * Datas, escaping, diálogos e helpers de DOM.
 */

/* ------------------------------------------------------------------ *
 * DOM
 * ------------------------------------------------------------------ */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const el = (id) => document.getElementById(id);

export function setText(id, txt) {
  const node = el(id);
  if (node) node.textContent = String(txt);
}

/**
 * Escapa texto para interpolação segura em HTML (conteúdo e atributos).
 * Todo dado vindo da planilha passa por aqui — ver README → "Segurança".
 */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function debounce(fn, ms = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ *
 * Datas
 *
 * Regra do projeto: uma data de validade é uma data de calendário, não um
 * instante. Nunca usamos `new Date(isoString)` diretamente para exibir — isso
 * desloca o dia conforme o fuso (03/10 vira 02/10 no Brasil). Toda data é
 * normalizada para meia-noite LOCAL.
 * ------------------------------------------------------------------ */

const MS_DAY = 86400000;
const NON_DATES = ['', '-', 'N/A', 'NA', 'PENDENTE', 'SEM DATA', 'NULL', 'UNDEFINED'];

function buildLocal(y, m, d) {
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  // Rejeita datas inexistentes (31/02 viraria 03/03 silenciosamente).
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/**
 * Converte qualquer representação vinda do backend em Date (meia-noite local)
 * ou null. Aceita Date, epoch, "dd/mm/aaaa", "aaaa-mm-dd" e ISO com hora.
 */
export function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return buildLocal(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : buildLocal(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  const raw = String(value).trim();
  if (!raw || NON_DATES.includes(raw.toUpperCase())) return null;

  // dd/mm/aaaa (aceita d/m/aaaa e sufixo de hora)
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return buildLocal(+br[3], +br[2], +br[1]);

  // aaaa-mm-dd puro (sem hora): já é data de calendário
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return buildLocal(+isoDate[1], +isoDate[2], +isoDate[3]);

  // ISO com hora: o Sheets serializa a meia-noite da planilha no fuso do
  // script (ex.: 2025-03-10T03:00:00.000Z). Arredondamos para a meia-noite
  // UTC mais próxima — recupera o dia correto para qualquer fuso entre
  // -12h e +12h — e só então lemos os componentes de calendário.
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const t = Date.parse(raw);
    if (Number.isNaN(t)) return null;
    const rounded = new Date(Math.round(t / MS_DAY) * MS_DAY);
    return buildLocal(rounded.getUTCFullYear(), rounded.getUTCMonth() + 1, rounded.getUTCDate());
  }

  // Último recurso: deixa o motor tentar, mas ainda normaliza para data local.
  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) return null;
  return buildLocal(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate());
}

/** Date → "dd/mm/aaaa". Aceita string e normaliza antes. */
export function formatBR(value) {
  const d = value instanceof Date ? value : parseDate(value);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Date → "aaaa-mm-dd" (valor de <input type="date">). */
export function toInputDate(value) {
  const d = value instanceof Date ? value : parseDate(value);
  if (!d) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Chave estável para comparar duas datas de calendário. */
export function dateKey(value) {
  const d = value instanceof Date ? value : parseDate(value);
  return d ? toInputDate(d) : '';
}

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Soma meses respeitando o fim do mês: 31/01 + 1 mês = 28/02, não 03/03.
 * Usado para calcular a validade a partir da data de calibração.
 */
export function addMonths(value, months) {
  const d = value instanceof Date ? value : parseDate(value);
  const n = Number(months);
  if (!d || !Number.isFinite(n)) return null;

  const day = d.getDate();
  const result = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDayOfMonth));
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Dias inteiros entre hoje e a data (negativo = vencido). */
export function daysUntil(date, from = today()) {
  if (!date) return null;
  return Math.round((date.getTime() - from.getTime()) / MS_DAY);
}

/* ------------------------------------------------------------------ *
 * Ícones (SVG inline)
 *
 * Evita chamar lucide.createIcons() a cada render — a função varre o
 * documento inteiro e era o gargalo do painel com muitos cards.
 * ------------------------------------------------------------------ */

const ICON_PATHS = {
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  wrench:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
};

export function iconSvg(name, size = 16, cls = '') {
  const body = ICON_PATHS[name] || ICON_PATHS.box;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round" class="${esc(cls)}" aria-hidden="true">${body}</svg>`
  );
}

/* ------------------------------------------------------------------ *
 * Feedback: toasts, overlay e diálogos
 * (substituem alert/confirm/prompt, que bloqueiam a página e não podem
 * ser estilizados nem testados)
 * ------------------------------------------------------------------ */

function toastHost() {
  let host = el('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  return host;
}

export function toast(message, type = 'info', ms = 5000) {
  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  node.textContent = message;
  toastHost().appendChild(node);
  setTimeout(() => {
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 250);
  }, ms);
  return node;
}

export function setBusy(active, label = 'Conectando ao Sentinel Nexus...') {
  const overlay = el('loading');
  if (!overlay) return;
  const text = el('loading-text');
  if (text) text.textContent = label;
  overlay.classList.toggle('active', active);
  overlay.setAttribute('aria-hidden', active ? 'false' : 'true');
}

let dialogState = null;

function ensureDialog() {
  let root = el('app-dialog');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'app-dialog';
  root.className = 'modal-overlay';
  root.innerHTML = `
    <div class="modal dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div class="modal-header-banner">
        <h3 id="dialog-title" style="color:#fff; font-size:16px;"></h3>
      </div>
      <div class="modal-body">
        <p id="dialog-message" class="dialog-message"></p>
        <ul id="dialog-list" class="dialog-list" hidden></ul>
        <label id="dialog-input-label" class="form-label" for="dialog-input" hidden></label>
        <textarea id="dialog-input" class="form-input" rows="3" hidden></textarea>
        <div id="dialog-error" class="dialog-error" hidden></div>
      </div>
      <div class="modal-footer" style="justify-content:flex-end; gap:10px;">
        <button type="button" class="btn-neutral" id="dialog-cancel">Cancelar</button>
        <button type="button" class="btn-apply" id="dialog-confirm">Confirmar</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const close = (result) => {
    if (!dialogState) return;
    const { resolve } = dialogState;
    dialogState = null;
    root.classList.remove('open');
    resolve(result);
  };

  el('dialog-cancel').addEventListener('click', () => close(null));
  el('dialog-confirm').addEventListener('click', () => {
    if (!dialogState) return;
    if (dialogState.input) {
      const value = el('dialog-input').value.trim();
      if (dialogState.required && !value) {
        const err = el('dialog-error');
        err.textContent = 'Campo obrigatório.';
        err.hidden = false;
        el('dialog-input').focus();
        return;
      }
      close(value);
      return;
    }
    close(true);
  });
  root.addEventListener('click', (e) => {
    if (e.target === root) close(null);
  });
  document.addEventListener('keydown', (e) => {
    if (!dialogState) return;
    if (e.key === 'Escape') close(null);
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) el('dialog-confirm').click();
  });

  return root;
}

/**
 * Diálogo modal. Resolve com:
 *   - `true`   quando confirmado sem campo de texto;
 *   - a string digitada quando `input` é usado;
 *   - `null`   quando cancelado.
 */
export function showDialog({
  title,
  message = '',
  items = [],
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = false,
  input = false,
  inputLabel = '',
  placeholder = '',
  required = false,
} = {}) {
  const root = ensureDialog();
  el('dialog-title').textContent = title;
  el('dialog-message').textContent = message;
  el('dialog-message').hidden = !message;

  const list = el('dialog-list');
  list.innerHTML = '';
  if (items.length) {
    const shown = items.slice(0, 12);
    list.innerHTML =
      shown.map((i) => `<li>${esc(i)}</li>`).join('') +
      (items.length > shown.length ? `<li class="muted">…e mais ${items.length - shown.length}</li>` : '');
    list.hidden = false;
  } else {
    list.hidden = true;
  }

  const field = el('dialog-input');
  const fieldLabel = el('dialog-input-label');
  field.hidden = !input;
  fieldLabel.hidden = !input;
  field.value = '';
  field.placeholder = placeholder;
  fieldLabel.textContent = inputLabel;
  el('dialog-error').hidden = true;

  const confirmBtn = el('dialog-confirm');
  confirmBtn.textContent = confirmText;
  confirmBtn.className = danger ? 'btn-delete-bulk' : 'btn-apply';
  el('dialog-cancel').textContent = cancelText;

  root.classList.add('open');
  setTimeout(() => (input ? field : confirmBtn).focus(), 50);

  return new Promise((resolve) => {
    dialogState = { resolve, input, required };
  });
}

export const confirmDialog = (opts) => showDialog(opts);
export const promptDialog = (opts) => showDialog({ ...opts, input: true });

/* ------------------------------------------------------------------ *
 * QR Code
 * ------------------------------------------------------------------ */

/**
 * Verifica se uma biblioteca de CDN carregou.
 * Sem isso, um CDN indisponível (rede restrita, chão de fábrica sem saída
 * para a internet) derrubava a tela inteira com "X is not defined".
 */
export function libAvailable(name) {
  switch (name) {
    case 'qr':
      return typeof window.QRious === 'function';
    case 'pdf':
      return Boolean(window.jspdf && window.jspdf.jsPDF);
    case 'xlsx':
      return typeof window.XLSX !== 'undefined';
    case 'chart':
      return typeof window.Chart !== 'undefined';
    default:
      return false;
  }
}

const LIB_LABELS = {
  qr: 'gerador de QR Code',
  pdf: 'gerador de PDF',
  xlsx: 'gerador de Excel',
  chart: 'biblioteca de gráficos',
};

/** Avisa e devolve false quando a biblioteca não está disponível. */
export function requireLib(name) {
  if (libAvailable(name)) return true;
  toast(
    `O ${LIB_LABELS[name] || name} não carregou (sem acesso ao CDN). ` +
      'Verifique a conexão e recarregue a página.',
    'error',
    9000,
  );
  return false;
}

/**
 * Gera o QR em PNG. JPEG (usado na versão anterior) cria artefatos de
 * compressão que atrapalham a leitura por leitores de celular.
 * Devolve null quando a biblioteca não está disponível.
 */
export function qrDataUrl(value, size = 320) {
  if (!libAvailable('qr')) return null;
  const canvas = document.createElement('canvas');
  // eslint-disable-next-line no-undef
  new QRious({ element: canvas, value, size, level: 'M' });
  return canvas.toDataURL('image/png');
}
