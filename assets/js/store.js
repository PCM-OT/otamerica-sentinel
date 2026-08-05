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

import { fetchHistory, fetchRecords } from './api.js';
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

/** Primeiro valor não vazio entre várias chaves possíveis. */
function pick(raw, keys) {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

/**
 * Campos que descrevem o equipamento, por categoria — usados para montar a
 * ficha e o PDF. A chave é o nome que o backend usa; o valor, o rótulo.
 */
const DETAIL_LABELS = {
  tagAnterior: 'TAG ANTERIOR',
  equipamento: 'EQUIPAMENTO',
  especificacao: 'ESPECIFICAÇÃO',
  fabricante: 'FABRICANTE',
  dimensoes: 'DIMENSÕES',
  idMalao: 'ID MALÃO',
  ordemEnvio: 'ORDEM DE ENVIO',
  numSerie: 'Nº SÉRIE',
  modelo: 'MODELO',
  fluido: 'FLUIDO',
  faixaIndicacao: 'FAIXA DE INDICAÇÃO',
  glicerina: 'GLICERINA',
  posicaoConexao: 'POSIÇÃO DA CONEXÃO',
  tipoConexao: 'TIPO DE CONEXÃO',
  diametroConexao: 'DIÂMETRO DA CONEXÃO',
  materialConexao: 'MATERIAL DA CONEXÃO',
  diametroCaixa: 'DIÂMETRO DA CAIXA',
  materialCaixa: 'MATERIAL DA CAIXA',
  equipAssociado: 'EQUIP. ASSOCIADO',
  informacoes: 'INFORMAÇÕES',
  localizacao: 'LOCALIZAÇÃO',
  motivo: 'MOTIVO DA EXCLUSÃO',
};

/**
 * Traduz um registro do backend para a forma que as telas usam.
 *
 * O backend nomeia os campos em português e por categoria (equipamento,
 * numSerie, modelo...), marca exclusão em `excluido: SIM/NÃO` e devolve datas
 * em ISO. Este é o único ponto do app que conhece esses nomes.
 */
function normalize(raw) {
  const validUntil = parseDate(pick(raw, ['dataValidade', 'dataValidadeTimestamp', 'dateStr']));
  const certifiedAt = parseDate(pick(raw, ['dataCertificacao', 'dataCertificacaoTimestamp', 'certDate']));
  const periodicityRaw = pick(raw, ['periodicidade', 'periodicity']);
  const periodicity = periodicityRaw ? Number(String(periodicityRaw).replace(/[^\d]/g, '')) : null;

  // Cada categoria descreve o equipamento num campo diferente.
  const equip = pick(raw, ['equipamento', 'equip', 'modelo', 'especificacao', 'numSerie']);

  const fullDetails = {};
  Object.entries(DETAIL_LABELS).forEach(([key, label]) => {
    const value = pick(raw, [key]);
    if (value) fullDetails[label] = value;
  });

  return {
    // `item` é o identificador estável do equipamento na planilha; a TAG pode
    // mudar (por isso existe TAG ANTERIOR), mas o item permanece.
    item: pick(raw, ['item']),
    tag: pick(raw, ['tag']),
    tagAnterior: pick(raw, ['tagAnterior']),
    equip,
    local: pick(raw, ['localizacao', 'local']),
    cat: pick(raw, ['category', 'cat']),
    model: pick(raw, ['modelo', 'especificacao', 'model']),
    fab: pick(raw, ['fabricante', 'fab']),
    certNum: pick(raw, ['numCertificado', 'certNum']),
    result: pick(raw, ['resultado', 'result']),
    file: pick(raw, ['link', 'file']),
    reason: pick(raw, ['motivo']),

    // O backend marca exclusão em EXCLUIDO = SIM/NÃO.
    activeState: pick(raw, ['excluido']).toUpperCase() === 'SIM' ? 'Inativo' : 'Ativo',

    // Metrologia — colunas acrescentadas ao fim das abas; quando não existem,
    // chegam vazias e a ficha simplesmente não mostra a linha.
    lab: pick(raw, ['lab', 'laboratorio']),
    uncertainty: pick(raw, ['incerteza']),
    ema: pick(raw, ['ema']),

    certifiedAt,
    certifiedAtLabel: certifiedAt ? formatBR(certifiedAt) : '',
    periodicity: Number.isFinite(periodicity) && periodicity > 0 ? periodicity : null,

    validUntil,
    dateLabel: validUntil ? formatBR(validUntil) : '',
    days: null,
    health: 'none',
    blocked: false,
    fullDetails,
    raw,
  };
}

/** Periodicidade do equipamento, com o padrão da categoria como fallback. */
export const periodicityOf = (item) => item.periodicity || periodicityFor(item.cat);

/** Um certificado reprovado invalida o equipamento, mesmo dentro do prazo. */
export const isRejected = (item) => item.result.toUpperCase().includes('REPROVADO');

export const isActive = (item) => item.activeState !== 'Inativo';

/** Calcula dias restantes e status de um registro. */
function applyStatus(item, ref = today()) {
  item.blocked = CONFIG.BLOCK_ON_REJECTED && isRejected(item);

  if (!item.validUntil) {
    item.days = null;
    item.health = item.blocked ? 'danger' : 'none';
    return item;
  }

  const diff = daysUntil(item.validUntil, ref);
  item.days = diff;

  if (item.blocked) item.health = 'danger';
  else if (diff < 0) item.health = 'danger';
  else if (diff <= warnDaysFor(item.cat)) item.health = 'warn';
  else item.health = 'ok';
  return item;
}

/** Recalcula dias restantes e status. Chamado no load e na virada do dia. */
export function recalcStatus() {
  const ref = today();
  state.records.forEach((item) => applyStatus(item, ref));
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

const byValidityDesc = (a, b) => {
  const av = a.validUntil ? a.validUntil.getTime() : -Infinity;
  const bv = b.validUntil ? b.validUntil.getTime() : -Infinity;
  return bv - av;
};

/** O que dá para mostrar sem ir ao servidor: a versão vigente. */
export function localHistoryFor(tag) {
  return state.records.filter((r) => r.tag === tag).sort(byValidityDesc);
}

/**
 * Histórico completo de certificados de uma TAG.
 *
 * Precisa de uma chamada própria: a carga do painel traz apenas a versão
 * vigente de cada equipamento, então filtrar localmente devolveria uma linha
 * só — dando a impressão de que o histórico se perdeu.
 */
export async function loadHistoryFor(tag) {
  try {
    const rows = await fetchHistory(tag);
    const history = rows.map(normalize);
    history.forEach(applyStatus);
    return { history: history.sort(byValidityDesc), complete: true };
  } catch (error) {
    return {
      history: localHistoryFor(tag),
      complete: false,
      reason:
        error.message === 'NAO_IMPLEMENTADO'
          ? 'Esta implantação do backend não expõe o histórico (action=history).'
          : error.message,
    };
  }
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
