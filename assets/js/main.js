/**
 * SENTINEL — Inicialização e orquestração das telas.
 */

import { deleteItems, updateValidity } from './actions.js';
import { CONFIG } from './config.js';
import {
  counts,
  emit,
  getByTag,
  itemsByTags,
  load,
  onChange,
  periodicityOf,
  recalcStatus,
  reloadQuiet,
  state,
  toggleFilterValue,
} from './store.js';
import { bindSession, initAuth, onIdentityChange } from './session.js';
import { initPwa, onConnectionChange } from './pwa.js';
import {
  addMonths,
  confirmDialog,
  debounce,
  el,
  esc,
  formatBR,
  parseDate,
  promptDialog,
  setBusy,
  setText,
  toast,
  today,
} from './utils.js';
import { bindAdmin } from './views/admin.js';
import { bindAudit, loadAudit } from './views/audit.js';
import { bindCharts, renderCharts, renderKpis } from './views/charts.js';
import {
  bindDashboard,
  renderCategoryPills,
  renderDashboard,
  renderSortToolbar,
  resetDashboardPage,
  SORT_OPTIONS,
} from './views/dashboard.js';
import { bindModal, openItemModal } from './views/modal.js';
import { bindRegister } from './views/register.js';
import {
  bindTables,
  clearSelection,
  renderCategoryButtons,
  renderLocalOptions,
  renderTable,
  renderTables,
  selectAllVisible,
  TABLES,
} from './views/tables.js';
import { downloadQrLabels, downloadReportPdf, downloadXlsx } from './exporters.js';

const VIEWS = {
  dash: 'Visão Geral',
  analytics: 'Analytics',
  register: 'Novo Cadastro',
  bulk: 'Atualizar / Excluir',
  export: 'Central de Exportação',
  audit: 'Auditoria',
  suggest: 'Sugestões',
};

let currentView = 'dash';

/* ------------------------------------------------------------------ *
 * URL — permite compartilhar link de uma tela, de um filtro ou de um item.
 * ------------------------------------------------------------------ */

function syncUrl() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  params.set('view', currentView);

  const status = [...state.dashboard.status].filter((s) => s !== 'all');
  if (status.length) params.set('status', status.join(',')); else params.delete('status');
  if (state.dashboard.cat !== 'all') params.set('cat', state.dashboard.cat); else params.delete('cat');
  if (state.dashboard.search) params.set('q', state.dashboard.search); else params.delete('q');

  // Só entra na URL quando difere do padrão, para não poluir o link com a
  // ordenação que já é a inicial.
  const { key, dir } = state.dashboard.sort;
  if (key === 'days' && dir === 'asc') params.delete('sort');
  else params.set('sort', `${key}:${dir}`);

  window.history.replaceState({}, '', url);
}

function applyUrl() {
  const params = new URLSearchParams(window.location.search);

  const status = params.get('status');
  if (status) {
    state.dashboard.status = new Set(status.split(',').filter(Boolean));
    if (!state.dashboard.status.size) state.dashboard.status.add('all');
  }
  const cat = params.get('cat');
  if (cat) state.dashboard.cat = cat;

  // Aceita só as combinações oferecidas na barra: um `sort` inventado na URL
  // cairia no padrão do sortItems e a pílula ativa não bateria com a ordem.
  const sort = params.get('sort');
  if (sort) {
    const [key, dir] = sort.split(':');
    if (SORT_OPTIONS.some((o) => o.key === key && o.dir === dir)) {
      state.dashboard.sort = { key, dir };
    }
  }

  const q = params.get('q');
  if (q) {
    state.dashboard.search = q.toLowerCase();
    const input = el('search');
    if (input) input.value = q;
  }

  const view = params.get('view');
  if (view && VIEWS[view]) switchView(view, { silent: true });

  // Redesenha com os filtros vindos da URL antes de abrir qualquer ficha.
  emit();

  const tag = params.get('tag');
  if (tag) openItemModal(tag);
}

/* ------------------------------------------------------------------ *
 * Navegação
 * ------------------------------------------------------------------ */

export function switchView(view, { silent = false } = {}) {
  if (!VIEWS[view]) return;
  currentView = view;

  document.querySelectorAll('.view-section').forEach((section) => {
    section.classList.toggle('active', section.id === `view-${view}`);
  });
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle('active', active);
    item.setAttribute('aria-current', active ? 'page' : 'false');
  });

  setText('page-title', VIEWS[view]);
  document.body.classList.remove('sidebar-open');

  if (view === 'analytics') renderCharts();
  if (view === 'audit') loadAudit();
  if (!silent) syncUrl();
}

/* ------------------------------------------------------------------ *
 * Renderização
 * ------------------------------------------------------------------ */

function renderQuickFilters() {
  ['ok', 'warn', 'danger', 'none'].forEach((status) => {
    const btn = el(`qf-${status}`);
    if (!btn) return;
    const active = state.dashboard.status.has(status);
    btn.classList.toggle(`active-${status}`, active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function renderBadges() {
  const c = counts();
  setText('n-total', c.total);
  setText('n-ok', c.ok);
  setText('n-warn', c.warn);
  setText('n-danger', c.danger);
  setText('n-none', c.none);

  const noneNav = el('qf-none');
  // O filtro "sem data" só aparece quando existem itens nessa situação —
  // antes esses equipamentos sumiam de todos os filtros sem aviso.
  if (noneNav) noneNav.hidden = c.none === 0;

  const stamp = el('last-update');
  if (stamp && state.loadedAt) {
    const hora = state.loadedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    // Offline, deixa claro que o número na tela é de uma cópia local.
    stamp.textContent = state.fromCache ? `Cópia local de ${hora}` : `Atualizado ${hora}`;
    stamp.classList.toggle('stale', state.fromCache);
  }
}

function renderAll() {
  renderBadges();
  renderQuickFilters();
  renderCategoryPills();
  renderSortToolbar();
  renderDashboard();
  renderCategoryButtons();
  renderLocalOptions();
  renderTables();
  renderKpis();
  if (currentView === 'analytics') renderCharts();
}

function renderLoadError(message) {
  const grid = el('grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state error">
      <div class="empty-title">Não foi possível carregar os dados</div>
      <p>${esc(message)}</p>
      <button type="button" class="btn-apply" id="btn-retry">Tentar novamente</button>
    </div>`;
  el('btn-retry')?.addEventListener('click', boot);
}

/* ------------------------------------------------------------------ *
 * Ações de massa
 * ------------------------------------------------------------------ */

async function handleBulkDelete() {
  const tags = [...state.bulkSelected];
  if (!tags.length) {
    toast('Selecione ao menos um equipamento.', 'warn');
    return;
  }

  const items = itemsByTags(tags);
  const reason = await promptDialog({
    title: `Inativar ${tags.length} equipamento(s)?`,
    message: 'Eles saem das listas e dos relatórios. O histórico permanece na planilha.',
    items: items.map((i) => `${i.tag} — ${i.equip || 'sem descrição'}`),
    inputLabel: 'Motivo da exclusão',
    placeholder: 'Ex: lote sucateado',
    confirmText: 'Inativar',
    danger: true,
    required: true,
  });
  if (!reason) return;

  const done = await deleteItems(tags, reason);
  if (done) state.bulkSelected.clear();
  renderAll();
}

/**
 * Calcula a nova validade de cada TAG no modo "renovar por periodicidade".
 * Cada equipamento parte da própria data-base, então a função é resolvida
 * item a item (ver actions.updateValidity).
 */
function renewalResolver() {
  const from = el('bulk-renew-base').value; // 'current' | 'today'
  const override = Number(el('bulk-renew-months').value) || null;

  return (tag) => {
    const item = getByTag(tag);
    if (!item) return null;
    const base = from === 'today' ? today() : item.validUntil || item.certifiedAt || today();
    return addMonths(base, override || periodicityOf(item));
  };
}

function bulkMode() {
  return el('bulk-mode')?.value || 'fixed';
}

async function handleBulkUpdate() {
  const tags = [...state.bulkSelected];
  if (!tags.length) {
    toast('Selecione ao menos um equipamento.', 'warn');
    return;
  }

  let dateFor;
  let title;
  let message;
  let preview;

  if (bulkMode() === 'renew') {
    const resolve = renewalResolver();
    const items = itemsByTags(tags);
    const computed = items.map((i) => ({ item: i, next: resolve(i.tag) }));
    const valid = computed.filter((c) => c.next);
    if (!valid.length) {
      toast('Nenhum dos selecionados tem data-base para renovar.', 'warn', 8000);
      return;
    }

    dateFor = resolve;
    title = `Renovar ${valid.length} equipamento(s)?`;
    message =
      el('bulk-renew-base').value === 'today'
        ? 'Nova validade = hoje + periodicidade de cada equipamento.'
        : 'Nova validade = validade atual + periodicidade de cada equipamento.';
    preview = valid.map(
      (c) => `${c.item.tag}: ${c.item.dateLabel || 'sem data'} → ${formatBR(c.next)} (${
        Number(el('bulk-renew-months').value) || periodicityOf(c.item)
      } meses)`,
    );
  } else {
    const date = parseDate(el('bulk-date').value);
    if (!date) {
      toast('Escolha uma data de vencimento válida.', 'warn');
      return;
    }
    if (date < today()) {
      const ok = await confirmDialog({
        title: 'Data no passado',
        message: 'A data escolhida já passou — os equipamentos ficarão marcados como vencidos. Continuar?',
        confirmText: 'Continuar',
        danger: true,
      });
      if (!ok) return;
    }
    dateFor = date;
    title = `Atualizar ${tags.length} equipamento(s)?`;
    message = `Nova validade: ${formatBR(date)}.`;
    preview = itemsByTags(tags).map((i) => `${i.tag} — vence ${i.dateLabel || 'sem data'}`);
  }

  const proceed = await confirmDialog({ title, message, items: preview, confirmText: 'Aplicar' });
  if (!proceed) return;

  const done = await updateValidity(tags, dateFor);
  if (done) {
    state.bulkSelected.clear();
    el('bulk-date').value = '';
  }
  renderAll();
}

/* ------------------------------------------------------------------ *
 * Ligações de eventos
 * ------------------------------------------------------------------ */

function bindNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });

  document.querySelectorAll('[data-quick-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleFilterValue(state.dashboard.status, btn.dataset.quickFilter);
      resetDashboardPage();
      renderQuickFilters();
      renderDashboard();
      syncUrl();
    });
  });

  el('btn-menu')?.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  el('sidebar-scrim')?.addEventListener('click', () => document.body.classList.remove('sidebar-open'));

  const search = el('search');
  search?.addEventListener(
    'input',
    debounce(() => {
      state.dashboard.search = search.value.trim().toLowerCase();
      resetDashboardPage();
      renderDashboard();
      syncUrl();
    }, 200),
  );
}

function bindFilterButtons() {
  // Delegação: os botões de categoria são criados em tempo de execução.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter-table]');
    if (!btn) return;

    const name = btn.dataset.filterTable;
    const kind = btn.dataset.filterKind; // 'status' | 'cat'
    const filters = TABLES[name].filters();
    toggleFilterValue(filters[kind], btn.dataset.filterValue);

    document
      .querySelectorAll(`[data-filter-table="${name}"][data-filter-kind="${kind}"]`)
      .forEach((other) => {
        const on = filters[kind].has(other.dataset.filterValue);
        other.classList.toggle('active', on);
        other.setAttribute('aria-pressed', String(on));
      });
    renderTable(name);
  });

  Object.entries(TABLES).forEach(([name, cfg]) => {
    el(cfg.search)?.addEventListener(
      'input',
      debounce((e) => {
        cfg.filters().search = e.target.value.trim().toLowerCase();
        renderTable(name);
      }, 200),
    );
    el(cfg.localSelect)?.addEventListener('change', (e) => {
      cfg.filters().local = e.target.value;
      renderTable(name);
    });
  });
}

function bindToolbars() {
  el('btn-bulk-delete')?.addEventListener('click', handleBulkDelete);
  el('btn-bulk-update')?.addEventListener('click', handleBulkUpdate);
  el('btn-bulk-clear')?.addEventListener('click', () => clearSelection('bulk'));

  el('bulk-mode')?.addEventListener('change', () => {
    const renew = bulkMode() === 'renew';
    el('bulk-fixed-fields').hidden = renew;
    el('bulk-renew-fields').hidden = !renew;
  });

  el('btn-export-select-visible')?.addEventListener('click', () => selectAllVisible('export'));
  el('btn-export-clear')?.addEventListener('click', () => clearSelection('export'));
  el('btn-export-pdf')?.addEventListener('click', downloadReportPdf);
  el('btn-export-xlsx')?.addEventListener('click', downloadXlsx);
  el('btn-export-qr')?.addEventListener('click', downloadQrLabels);
  el('btn-refresh')?.addEventListener('click', () => boot({ silentUrl: true }));
}

/* ------------------------------------------------------------------ *
 * Tarefas periódicas
 * ------------------------------------------------------------------ */

function startTimers() {
  // Vira o dia com o painel aberto (TV/quiosque): sem isto a contagem de dias
  // congela no dia em que a página foi carregada.
  let currentDay = today().getTime();
  setInterval(() => {
    const day = today().getTime();
    if (day !== currentDay) {
      currentDay = day;
      recalcStatus();
      emit();
    }
  }, 60_000);

  if (CONFIG.REFRESH_INTERVAL_MS > 0) {
    setInterval(() => {
      if (document.hidden) return;
      if (!navigator.onLine) return;
      if (document.querySelector('.modal-overlay.open')) return;
      reloadQuiet();
    }, CONFIG.REFRESH_INTERVAL_MS);
  }

  // Voltou a rede: troca a cópia local pelos dados do servidor.
  onConnectionChange((online) => {
    if (online) reloadQuiet();
    else renderAll();
  });
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

async function boot({ silentUrl = false } = {}) {
  setBusy(true, 'Conectando ao Sentinel...');
  try {
    await load();
    setBusy(false);
    if (!silentUrl) applyUrl();
  } catch (error) {
    setBusy(false);
    console.error(error);
    renderLoadError(error.message);
    toast('Falha ao carregar os dados.', 'error', 8000);
  }
}

function init() {
  bindNavigation();
  bindFilterButtons();
  bindToolbars();
  bindTables();
  bindModal();
  bindRegister();
  bindAdmin();
  bindAudit();
  bindSession();
  bindDashboard({
    onClearFilters: () => {
      state.dashboard.status = new Set(['all']);
      state.dashboard.cat = 'all';
      state.dashboard.search = '';
      const input = el('search');
      if (input) input.value = '';
      resetDashboardPage();
      renderAll();
      syncUrl();
    },
    onSelectCat: (cat) => {
      state.dashboard.cat = cat;
      resetDashboardPage();
      renderCategoryPills();
      renderDashboard();
      syncUrl();
    },
    onSelectSort: (key, dir) => {
      state.dashboard.sort = { key, dir };
      resetDashboardPage();
      renderSortToolbar();
      renderDashboard();
      syncUrl();
    },
  });
  bindCharts({
    onStatusClick: (status) => {
      state.dashboard.status = new Set([status]);
      resetDashboardPage();
      switchView('dash');
      renderAll();
    },
  });

  onChange(renderAll);
  onIdentityChange(() => renderAll());
  initAuth();
  initPwa({ onFirstControl: () => reloadQuiet() });
  startTimers();
  boot();
}

document.addEventListener('DOMContentLoaded', init);
