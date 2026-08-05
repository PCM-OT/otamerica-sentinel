/**
 * SENTINEL — Painel principal (cards).
 */

import { CONFIG } from '../config.js';
import { countdown, statusLabel } from '../status.js';
import { filterItems, sortItems, state } from '../store.js';
import { el, esc, iconSvg } from '../utils.js';
import { openItemModal } from './modal.js';

function iconFor(cat) {
  const c = String(cat || '').toLowerCase();
  if (c.includes('nr')) return 'zap';
  if (c.includes('man')) return 'gauge';
  if (c.includes('valv') || c.includes('out')) return 'wrench';
  return 'box';
}

export function visibleDashboardItems() {
  const { status, cat, search, sort } = state.dashboard;
  return sortItems(filterItems({ status, cat, search }), sort);
}

/**
 * Ordenações do painel, no vocabulário da versão React (A-Z / Z-A por TAG).
 * "Vencimento" segue como padrão: é a ordem que responde à pergunta que o app
 * existe para responder — o que vence primeiro.
 */
export const SORT_OPTIONS = [
  { key: 'days', dir: 'asc', label: 'Vencimento' },
  { key: 'tag', dir: 'asc', label: 'TAG A-Z' },
  { key: 'tag', dir: 'desc', label: 'TAG Z-A' },
  { key: 'equip', dir: 'asc', label: 'Equipamento' },
];

export function renderSortToolbar() {
  const host = el('sort-toolbar');
  if (!host) return;
  const { key, dir } = state.dashboard.sort;
  host.innerHTML =
    '<span class="sort-label">Ordenar</span>' +
    SORT_OPTIONS.map((o) => {
      const active = o.key === key && o.dir === dir;
      return (
        `<button type="button" class="pill-sort${active ? ' active' : ''}" ` +
        `data-sort-key="${o.key}" data-sort-dir="${o.dir}" aria-pressed="${active}">${esc(o.label)}</button>`
      );
    }).join('');
}

export function resetDashboardPage() {
  state.dashboard.page = 1;
}

function cardHtml(item) {
  const { value, label } = countdown(item);
  const cls = item.health === 'none' ? 'neutral' : item.health;
  const colorClass =
    { danger: 'c-danger', warn: 'c-warn', ok: 'c-ok' }[item.health] || 'c-neutral';

  return `
    <article class="card ${cls}" data-tag="${esc(item.tag)}" tabindex="0" role="button"
             aria-label="${esc(`${item.tag} — ${item.equip || 'sem descrição'} — ${statusLabel(item.health)}`)}">
      <div class="card-header">
        <span class="tag-id">${esc(item.tag)}</span>
        <span class="cat-icon">${iconSvg(iconFor(item.cat), 16)}</span>
      </div>
      <div class="card-body">
        <div class="equip-name">${esc(item.equip || '—')}</div>
        <div class="equip-meta">${esc(item.local || 'Local não informado')}</div>
      </div>
      <div class="card-footer">
        <div>
          <div class="days-left ${colorClass}">${esc(value)}</div>
          <div class="status-lbl">${esc(label)}</div>
        </div>
        <div class="card-footer-right">
          <span class="status-chip ${cls}">${statusLabel(item.health)}</span>
          <div class="date-small">${esc(item.dateLabel || 'sem vencimento')}</div>
        </div>
      </div>
    </article>`;
}

function emptyStateHtml() {
  const filtering =
    !state.dashboard.status.has('all') || state.dashboard.cat !== 'all' || state.dashboard.search;
  return `
    <div class="empty-state">
      <div class="empty-title">${filtering ? 'Nenhum equipamento nesses filtros' : 'Nenhum equipamento cadastrado'}</div>
      <p>${
        filtering
          ? 'Ajuste os filtros de status, categoria ou o texto da busca.'
          : 'Use "Novo Cadastro" para incluir o primeiro equipamento.'
      }</p>
      ${filtering ? '<button type="button" class="btn-apply" data-action="clear-filters">Limpar filtros</button>' : ''}
    </div>`;
}

export function renderCategoryPills() {
  const bar = el('cat-toolbar');
  if (!bar) return;
  const current = state.dashboard.cat;
  const pills = [{ value: 'all', label: 'TODOS' }, ...state.categories.map((c) => ({ value: c, label: c }))];
  bar.innerHTML = pills
    .map(
      (p) =>
        `<button type="button" class="pill-filter${p.value === current ? ' active' : ''}" ` +
        `data-cat="${esc(p.value)}" aria-pressed="${p.value === current}">${esc(p.label)}</button>`,
    )
    .join('');
}

export function renderDashboard() {
  const grid = el('grid');
  if (!grid) return;

  const items = visibleDashboardItems();
  const limit = state.dashboard.page * CONFIG.PAGE_SIZE;
  const page = items.slice(0, limit);
  const remaining = items.length - page.length;

  if (!items.length) {
    grid.innerHTML = emptyStateHtml();
  } else {
    grid.innerHTML = page.map(cardHtml).join('');
  }

  const more = el('load-more-wrap');
  if (more) {
    more.hidden = remaining <= 0;
    const btn = el('load-more');
    if (btn) btn.textContent = `Carregar mais (${remaining} restantes)`;
  }

  const summary = el('dash-summary');
  if (summary) {
    summary.textContent = items.length
      ? `Exibindo ${page.length} de ${items.length} equipamentos`
      : '';
  }
}

/** Liga os eventos do painel uma única vez (delegação). */
export function bindDashboard({ onClearFilters, onSelectCat, onSelectSort }) {
  const grid = el('grid');
  const openFromEvent = (target) => {
    const card = target.closest('[data-tag]');
    if (!card) return false;
    openItemModal(card.dataset.tag);
    return true;
  };

  grid?.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="clear-filters"]')) {
      onClearFilters();
      return;
    }
    openFromEvent(e.target);
  });

  grid?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('[data-tag]')) {
      e.preventDefault();
      openFromEvent(e.target);
    }
  });

  el('cat-toolbar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (btn) onSelectCat(btn.dataset.cat);
  });

  el('sort-toolbar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sort-key]');
    if (btn) onSelectSort(btn.dataset.sortKey, btn.dataset.sortDir);
  });

  el('load-more')?.addEventListener('click', () => {
    state.dashboard.page += 1;
    renderDashboard();
  });
}
