/**
 * SENTINEL — Tabelas de Gestão em Massa e Central de Exportação.
 *
 * As duas telas compartilham filtro, ordenação, seleção e renderização.
 * A seleção é sempre por TAG (ver comentário em store.js).
 */

import { statusColor, statusLabel } from '../status.js';
import { filterItems, sortItems, state } from '../store.js';
import { el, esc } from '../utils.js';

const COLUMNS = {
  tag: { label: 'TAG', sort: 'tag', render: (i) => `<span class="cell-tag">${esc(i.tag)}</span>` },
  equip: { label: 'Equipamento', sort: 'equip', render: (i) => esc(i.equip || '—') },
  local: { label: 'Local', sort: 'local', render: (i) => esc(i.local || '—') },
  date: {
    label: 'Vencimento',
    sort: 'days',
    render: (i) => esc(i.dateLabel || 'sem data'),
  },
  status: {
    label: 'Status',
    sort: 'status',
    render: (i) =>
      `<span class="status-chip ${i.health === 'none' ? 'neutral' : i.health}" ` +
      `style="color:${statusColor(i.health)}">${statusLabel(i.health)}</span>`,
  },
};

export const TABLES = {
  bulk: {
    tbody: 'bulk-list',
    head: 'bulk-head',
    search: 'bulk-search',
    localSelect: 'bulk-filter-local',
    selectAll: 'bulk-select-all',
    columns: ['tag', 'equip', 'date', 'status'],
    filters: () => state.bulk,
    selected: () => state.bulkSelected,
  },
  export: {
    tbody: 'export-list',
    head: 'export-head',
    search: 'export-search',
    localSelect: 'export-filter-local',
    selectAll: 'export-select-all',
    columns: ['tag', 'equip', 'local', 'date', 'status'],
    filters: () => state.export,
    selected: () => state.exportSelected,
  },
};

/** Itens visíveis de uma tabela, já filtrados e ordenados. */
export function visibleItems(name) {
  const cfg = TABLES[name];
  const f = cfg.filters();
  // Itens inativos (excluídos) ficam fora das duas telas — inclusive da
  // exportação, que antes os incluía nos relatórios em PDF/Excel.
  return sortItems(
    filterItems({ status: f.status, cat: f.cat, local: f.local, search: f.search }),
    f.sort,
  );
}

export function renderLocalOptions() {
  Object.values(TABLES).forEach((cfg) => {
    const select = el(cfg.localSelect);
    if (!select) return;
    const current = select.value;
    select.innerHTML =
      '<option value="">Local: Todos</option>' +
      state.locals.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
    if (state.locals.includes(current)) select.value = current;
  });
}

function renderHead(name) {
  const cfg = TABLES[name];
  const head = el(cfg.head);
  if (!head) return;
  const { sort } = cfg.filters();

  const cells = cfg.columns.map((key) => {
    const col = COLUMNS[key];
    const isActive = sort.key === col.sort;
    const arrow = isActive ? (sort.dir === 'asc' ? '▲' : '▼') : '';
    return (
      `<th aria-sort="${isActive ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}">` +
      `<button type="button" class="th-sort${isActive ? ' active' : ''}" data-sort="${esc(col.sort)}">` +
      `${esc(col.label)}<span class="sort-arrow">${arrow}</span></button></th>`
    );
  });

  head.innerHTML =
    `<tr><th class="col-check"><input type="checkbox" class="chk-custom" id="${cfg.selectAll}" ` +
    `aria-label="Selecionar todos os itens visíveis"></th>${cells.join('')}</tr>`;
}

export function renderTable(name) {
  const cfg = TABLES[name];
  const tbody = el(cfg.tbody);
  if (!tbody) return;

  renderHead(name);

  const items = visibleItems(name);
  const selected = cfg.selected();

  if (!items.length) {
    tbody.innerHTML =
      `<tr><td colspan="${cfg.columns.length + 1}" class="table-empty">` +
      'Nenhum equipamento encontrado com esses filtros.</td></tr>';
  } else {
    tbody.innerHTML = items
      .map((item) => {
        const checked = selected.has(item.tag) ? ' checked' : '';
        const cells = cfg.columns.map((key) => `<td>${COLUMNS[key].render(item)}</td>`).join('');
        return (
          `<tr class="${checked ? 'selected' : ''}" data-tag="${esc(item.tag)}">` +
          `<td class="col-check"><input type="checkbox" class="chk-custom" data-row-check${checked} ` +
          `aria-label="Selecionar ${esc(item.tag)}"></td>${cells}</tr>`
        );
      })
      .join('');
  }

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.tag));
  const someSelected = items.some((i) => selected.has(i.tag));
  const master = el(cfg.selectAll);
  if (master) {
    master.checked = allSelected;
    master.indeterminate = !allSelected && someSelected;
  }

  const counter = el(`${name}-count`);
  if (counter) counter.textContent = `${items.length} itens · ${selected.size} selecionados`;

  if (name === 'bulk') {
    const bar = el('bulk-bar');
    const count = el('sel-count');
    if (count) count.textContent = selected.size;
    if (bar) bar.classList.toggle('visible', selected.size > 0);
  }
}

export function renderTables() {
  renderTable('bulk');
  renderTable('export');
}

function toggleAllVisible(name, checked) {
  const selected = TABLES[name].selected();
  visibleItems(name).forEach((item) => {
    if (checked) selected.add(item.tag);
    else selected.delete(item.tag);
  });
  renderTable(name);
}

export function selectAllVisible(name) {
  toggleAllVisible(name, true);
}

export function clearSelection(name) {
  TABLES[name].selected().clear();
  renderTable(name);
}

/** Delegação de eventos das duas tabelas (registrada uma única vez). */
export function bindTables() {
  Object.entries(TABLES).forEach(([name, cfg]) => {
    const tbody = el(cfg.tbody);
    tbody?.addEventListener('change', (e) => {
      const box = e.target.closest('[data-row-check]');
      if (!box) return;
      const tag = box.closest('tr')?.dataset.tag;
      if (!tag) return;
      const selected = cfg.selected();
      if (box.checked) selected.add(tag);
      else selected.delete(tag);
      renderTable(name);
    });

    el(cfg.head)?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sort]');
      if (btn) {
        const sort = cfg.filters().sort;
        if (sort.key === btn.dataset.sort) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
        else {
          sort.key = btn.dataset.sort;
          sort.dir = 'asc';
        }
        renderTable(name);
        return;
      }
      const master = e.target.closest(`#${cfg.selectAll}`);
      if (master) toggleAllVisible(name, master.checked);
    });
  });
}
