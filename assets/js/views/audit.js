/**
 * SENTINEL — Trilha de auditoria.
 *
 * Lê o log gravado pelo backend (quem, quando, o quê). Enquanto o Apps Script
 * não expuser `action=audit`, a tela explica o que falta em vez de quebrar.
 */

import { fetchAudit } from '../api.js';
import { el, esc, formatBR, parseDate } from '../utils.js';

const ACTION_LABELS = {
  create: 'Cadastro',
  delete: 'Inativação',
  update_date: 'Nova validade',
  import_csv: 'Substituição de base',
  suggestion: 'Sugestão',
};

let loaded = false;
let rows = [];
let filterText = '';

function formatWhen(value) {
  const date = parseDate(value);
  if (!date) return esc(String(value || '—'));
  const time = new Date(value);
  const hhmm = Number.isNaN(time.getTime())
    ? ''
    : ` ${time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return `${formatBR(date)}${hhmm}`;
}

function render() {
  const tbody = el('audit-list');
  if (!tbody) return;

  const term = filterText.trim().toLowerCase();
  const view = term
    ? rows.filter((r) =>
        [r.tag, r.user, r.detail, ACTION_LABELS[r.action] || r.action]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
    : rows;

  if (!view.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="table-empty">Nenhum registro de alteração encontrado.</td></tr>';
  } else {
    tbody.innerHTML = view
      .map(
        (r) => `<tr>
          <td>${formatWhen(r.date)}</td>
          <td><span class="audit-action">${esc(ACTION_LABELS[r.action] || r.action || '—')}</span></td>
          <td><span class="cell-tag">${esc(r.tag || '—')}</span></td>
          <td>${esc(r.detail || '—')}</td>
          <td>${esc(r.user || 'não identificado')}</td>
        </tr>`,
      )
      .join('');
  }

  const count = el('audit-count');
  if (count) count.textContent = `${view.length} registro(s)`;
}

function renderUnavailable(message) {
  const tbody = el('audit-list');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="table-empty">${esc(message)}</td></tr>`;
  const count = el('audit-count');
  if (count) count.textContent = '';
}

export async function loadAudit({ force = false } = {}) {
  if (loaded && !force) {
    render();
    return;
  }
  renderUnavailable('Carregando...');
  try {
    rows = await fetchAudit();
    loaded = true;
    render();
  } catch (error) {
    loaded = false;
    if (error.message === 'NAO_IMPLEMENTADO') {
      renderUnavailable(
        'O backend ainda não expõe a trilha de auditoria. ' +
          'Publique o doGet com action=audit (backend/Code.gs.example) para ver aqui quem alterou o quê.',
      );
    } else {
      renderUnavailable(`Não foi possível carregar a auditoria: ${error.message}`);
    }
  }
}

export function bindAudit() {
  el('audit-search')?.addEventListener('input', (e) => {
    filterText = e.target.value;
    if (loaded) render();
  });
  el('btn-audit-refresh')?.addEventListener('click', () => loadAudit({ force: true }));
}
