/**
 * SENTINEL — Analytics (Chart.js).
 */

import { counts, isActive, state } from '../store.js';
import { el, libAvailable, setText, toast } from '../utils.js';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const instances = {};

let onSliceClick = () => {};

const GRID = '#334155';
const MUTED = '#94a3b8';

function activeItems() {
  return state.latest.filter(isActive);
}

function renderHealth() {
  const canvas = el('chartHealth');
  if (!canvas) return;
  const c = counts();
  const buckets = [
    { key: 'ok', label: 'VÁLIDO', value: c.ok, color: '#10b981' },
    { key: 'warn', label: 'ATENÇÃO', value: c.warn, color: '#f59e0b' },
    { key: 'danger', label: 'VENCIDO', value: c.danger, color: '#ef4444' },
    { key: 'none', label: 'SEM DATA', value: c.none, color: '#64748b' },
  ];

  instances.health?.destroy();
  instances.health = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: buckets.map((b) => b.label),
      datasets: [{ data: buckets.map((b) => b.value), backgroundColor: buckets.map((b) => b.color), borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#fff', boxWidth: 12 } } },
      onClick: (_e, elements) => {
        if (elements.length) onSliceClick(buckets[elements[0].index].key);
      },
    },
  });
}

function renderCategories() {
  const canvas = el('chartCat');
  if (!canvas) return;
  const tally = {};
  activeItems().forEach((i) => {
    const key = i.cat || 'SEM CATEGORIA';
    tally[key] = (tally[key] || 0) + 1;
  });

  instances.cat?.destroy();
  instances.cat = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: Object.keys(tally),
      datasets: [{ label: 'Equipamentos', data: Object.values(tally), backgroundColor: '#3b82f6', borderRadius: 4 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: MUTED, precision: 0 } },
        x: { grid: { display: false }, ticks: { color: '#fff' } },
      },
    },
  });
}

function renderTimeline() {
  const canvas = el('chartTimeline');
  if (!canvas) return;
  const range = parseInt(el('chartPeriod')?.value, 10) || 6;
  const now = new Date();
  const buckets = new Map();

  for (let i = 0; i < range; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    buckets.set(`${d.getFullYear()}-${d.getMonth()}`, {
      label: `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      count: 0,
    });
  }

  activeItems().forEach((i) => {
    if (!i.validUntil) return;
    const key = `${i.validUntil.getFullYear()}-${i.validUntil.getMonth()}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.count += 1;
  });

  const values = [...buckets.values()];
  instances.time?.destroy();
  instances.time = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: values.map((v) => v.label),
      datasets: [
        {
          label: 'Vencimentos',
          data: values.map((v) => v.count),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: MUTED, precision: 0 } },
        x: { grid: { color: GRID }, ticks: { color: '#fff' } },
      },
    },
  });
}

export function renderKpis() {
  const c = counts();
  setText('kpi-total', c.total);
  setText('kpi-ok', c.ok);
  setText('kpi-warn', c.warn);
  setText('kpi-danger', c.danger);
  setText('kpi-none', c.none);
  setText('kpi-compliance', `${c.compliance}%`);
}

let warnedMissingLib = false;

/** Só desenha quando a aba está visível — gráfico oculto não tem dimensão. */
export function renderCharts() {
  renderKpis();
  if (!el('view-analytics')?.classList.contains('active')) return;

  // Os KPIs continuam funcionando mesmo sem a biblioteca de gráficos.
  if (!libAvailable('chart')) {
    if (!warnedMissingLib) {
      warnedMissingLib = true;
      toast('Os gráficos não carregaram (sem acesso ao CDN). Os indicadores acima seguem válidos.', 'warn', 9000);
    }
    return;
  }

  renderHealth();
  renderCategories();
  renderTimeline();
}

export function bindCharts({ onStatusClick }) {
  onSliceClick = onStatusClick;
  el('chartPeriod')?.addEventListener('change', () => {
    if (libAvailable('chart')) renderTimeline();
  });
}
