/**
 * SENTINEL — Estado da aplicação.
 *
 * Responsável por: baixar, normalizar, deduplicar por TAG, calcular status,
 * guardar filtros/seleções e avisar as views quando algo muda.
 *
 * Regra importante: as seleções em massa são guardadas por TAG, nunca por
 * índice de array. Índices mudam a cada recarga da base e apontariam para
 * outro equipamento — risco real de inativar/alterar o ativo errado.
 */

import { fetchRecords } from './api.js';
import { CONFIG, periodicityFor, warnDaysFor } from './config.js';
import { daysUntil, formatBR, parseDate, today } from './utils.js';

export const state = {
  records: [], // todos os registros (inclui histórico)
  latest: [], // um registro por TAG — o de validade mais recente
  locals: [],
  categories: [],
  loadedAt: null,
  fromCache: false,
  cachedAt: null,
  error: null,

  dashboard: { status: new Set(['all']), cat: 'all', search: '', page: 1 },
  bulk: { status: new Set(['all']), cat: new Set(['all']), local: '', search: '', sort: { key: 'days', dir: 'asc' } },
  export: { status: new Set(['all']), cat: new Set(['all']), local: '', search: '', sort: { key: 'days', dir: 'asc' } },

  bulkSelected: new Set(), // TAGs
  exportSelected: new Set(), // TAGs
};

/* ------------------------------------------------------------------ *
 * Eventos
 * ------------------------------------------------------------------ */

const listeners = new Set();
export const onChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const emit = () => listeners.forEach((fn) => fn());

/* ------------------------------------------------------------------ *
 * Normalização
 * ------------------------------------------------------------------ */

/** Lê um campo aceitando o nome curto do backend ou o cabeçalho da planilha. */
function pick(raw, keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
      return String(raw[key]).trim();
    }
    const detail = raw.fullDetails && raw.fullDetails[key];
    if (detail !== undefined && detail !== null && String(detail).trim() !== '') {
      return String(detail).trim();
    }
  }
  return '';
}

function normalize(raw) {
  const validUntil = parseDate(raw.dateStr ?? raw.date ?? raw.validade);
  const certifiedAt = parseDate(pick(raw, ['certDate', 'cert_date', 'DATA DE CERTIFICAÇÃO', 'DATA DE CALIBRAÇÃO']));
  const periodicityRaw = pick(raw, ['periodicidade', 'periodicity', 'PERIODICIDADE (MESES)', 'PERIODICIDADE']);
  const periodicity = periodicityRaw ? Number(String(periodicityRaw).replace(/[^\d]/g, '')) : null;

  return {
    tag: String(raw.tag ?? '').trim(),
    equip: String(raw.equip ?? '').trim(),
    local: String(raw.local ?? '').trim(),
    cat: String(raw.cat ?? '').trim(),
    model: String(raw.model ?? '').trim(),
    fab: String(raw.fab ?? '').trim(),
    certNum: String(raw.certNum ?? '').trim(),
    result: String(raw.result ?? '').trim(),
    file: String(raw.file ?? '').trim(),
    activeState: String(raw.activeState ?? '').trim(),
    fullDetails: raw.fullDetails && typeof raw.fullDetails === 'object' ? raw.fullDetails : {},

    // Metrologia
    lab: pick(raw, ['lab', 'LABORATÓRIO', 'LABORATÓRIO / ORGANISMO CALIBRADOR', 'ORGANISMO CALIBRADOR']),
    uncertainty: pick(raw, ['incerteza', 'uncertainty', 'INCERTEZA DE MEDIÇÃO', 'INCERTEZA']),
    ema: pick(raw, ['ema', 'EMA', 'ERRO MÁXIMO ADMISSÍVEL']),
    certifiedAt,
    certifiedAtLabel: certifiedAt ? formatBR(certifiedAt) : '',
    periodicity: Number.isFinite(periodicity) && periodicity > 0 ? periodicity : null,

    validUntil,
    dateLabel: validUntil ? formatBR(validUntil) : '',
    days: null,
    health: 'none',
    blocked: false,
    raw,
  };
}

/** Periodicidade do equipamento, com o padrão da categoria como fallback. */
export const periodicityOf = (item) => item.periodicity || periodicityFor(item.cat);

/** Um certificado reprovado invalida o equipamento, mesmo dentro do prazo. */
export const isRejected = (item) => item.result.toUpperCase() === 'REPROVADO';

export const isActive = (item) => item.activeState !== 'Inativo';

/** Recalcula dias restantes e status. Chamado no load e na virada do dia. */
export function recalcStatus() {
  const ref = today();
  state.records.forEach((item) => {
    item.blocked = CONFIG.BLOCK_ON_REJECTED && isRejected(item);

    if (!item.validUntil) {
      item.days = null;
      item.health = item.blocked ? 'danger' : 'none';
      return;
    }
    const diff = daysUntil(item.validUntil, ref);
    item.days = diff;

    if (item.blocked) item.health = 'danger';
    else if (diff < 0) item.health = 'danger';
    else if (diff <= warnDaysFor(item.cat)) item.health = 'warn';
    else item.health = 'ok';
  });
}

/** Um registro por TAG: o de maior validade (sem data fica por último). */
function computeLatest() {
  const byTag = new Map();
  state.records.forEach((item) => {
    if (!item.tag) return;
    const current = byTag.get(item.tag);
    if (!current) {
      byTag.set(item.tag, item);
      return;
    }
    const a = item.validUntil ? item.validUntil.getTime() : -Infinity;
    const b = current.validUntil ? current.validUntil.getTime() : -Infinity;
    if (a > b) byTag.set(item.tag, item);
  });
  state.latest = Array.from(byTag.values());
}

function computeFacets() {
  state.locals = [...new Set(state.latest.map((i) => i.local).filter((l) => l && l !== '-'))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
  state.categories = [...new Set(state.latest.map((i) => i.cat).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

/** Baixa e reprocessa a base inteira. */
export async function load() {
  const { records, fromCache, cachedAt } = await fetchRecords();
  state.records = records.map(normalize);
  recalcStatus();
  computeLatest();
  computeFacets();
  state.fromCache = fromCache;
  state.cachedAt = cachedAt;
  // Offline, "atualizado" é a hora em que a cópia local foi baixada.
  state.loadedAt = fromCache && cachedAt ? cachedAt : new Date();
  state.error = null;
  pruneSelections();
  emit();
  return state.latest;
}

/** Recarrega sem propagar erro (usado no refresh automático). */
export async function reloadQuiet() {
  try {
    await load();
    return true;
  } catch (err) {
    console.error('Falha ao atualizar a base:', err);
    return false;
  }
}

/** Descarta seleções de TAGs que não existem mais após uma recarga. */
function pruneSelections() {
  const known = new Set(state.latest.map((i) => i.tag));
  [state.bulkSelected, state.exportSelected].forEach((set) => {
    [...set].forEach((tag) => {
      if (!known.has(tag)) set.delete(tag);
    });
  });
}

/* ------------------------------------------------------------------ *
 * Consultas
 * ------------------------------------------------------------------ */

export const getByTag = (tag) => state.latest.find((i) => i.tag === tag) || null;

export function historyFor(tag) {
  return state.records
    .filter((r) => r.tag === tag)
    .sort((a, b) => {
      const av = a.validUntil ? a.validUntil.getTime() : -Infinity;
      const bv = b.validUntil ? b.validUntil.getTime() : -Infinity;
      return bv - av;
    });
}

export function itemsByTags(tags) {
  return [...tags].map((t) => getByTag(t)).filter(Boolean);
}

/**
 * Confirma se uma escrita realmente foi aplicada.
 * Necessário porque no modo 'no-cors' a resposta do POST é opaca: recarregamos
 * a base e conferimos o efeito esperado em vez de supor sucesso.
 */
export async function verifyWrite(predicate, { attempts = 3, delayMs = 1800 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    await new Promise((r) => setTimeout(r, delayMs));
    try {
      await load();
    } catch (err) {
      console.error(err);
      continue;
    }
    if (predicate(state)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Filtros e ordenação
 * ------------------------------------------------------------------ */

/** Alterna um valor num Set de filtro multi-seleção ('all' é exclusivo). */
export function toggleFilterValue(set, value) {
  if (value === 'all') {
    set.clear();
    set.add('all');
    return;
  }
  set.delete('all');
  if (set.has(value)) set.delete(value);
  else set.add(value);
  if (set.size === 0) set.add('all');
}

const matchesSet = (set, value) => set.has('all') || set.has(value);

/** Busca única para todas as telas: TAG, equipamento, local, modelo e nº do certificado. */
function matchesSearch(item, term) {
  if (!term) return true;
  const haystack = [item.tag, item.equip, item.local, item.model, item.fab, item.certNum]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

export function filterItems({ status, cat, local, search, includeInactive = false }) {
  const term = (search || '').trim().toLowerCase();
  return state.latest.filter((item) => {
    if (!includeInactive && !isActive(item)) return false;
    if (status && !matchesSet(status, item.health)) return false;
    if (cat instanceof Set) {
      if (!matchesSet(cat, item.cat)) return false;
    } else if (cat && cat !== 'all' && item.cat !== cat) return false;
    if (local && item.local !== local) return false;
    return matchesSearch(item, term);
  });
}

const SORT_VALUES = {
  tag: (i) => i.tag.toLowerCase(),
  equip: (i) => i.equip.toLowerCase(),
  local: (i) => i.local.toLowerCase(),
  days: (i) => (i.days === null ? Number.POSITIVE_INFINITY : i.days),
  status: (i) => ['danger', 'warn', 'ok', 'none'].indexOf(i.health),
};

export function sortItems(items, { key = 'days', dir = 'asc' } = {}) {
  const pick = SORT_VALUES[key] || SORT_VALUES.days;
  const factor = dir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = pick(a);
    const bv = pick(b);
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return a.tag.localeCompare(b.tag, 'pt-BR');
  });
}

/** Contagens exibidas nos badges e KPIs (somente ativos). */
export function counts() {
  const active = state.latest.filter(isActive);
  const by = (h) => active.filter((i) => i.health === h).length;
  const ok = by('ok');
  const total = active.length;
  return {
    total,
    ok,
    warn: by('warn'),
    danger: by('danger'),
    none: by('none'),
    compliance: total ? Math.round((ok / total) * 100) : 0,
  };
}
