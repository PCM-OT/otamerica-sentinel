/**
 * SENTINEL — Camada de acesso ao backend (Google Apps Script "Nexus").
 *
 * Nenhum outro módulo faz fetch diretamente.
 *
 * CONTRATO DO BACKEND (o que o Apps Script realmente espera/devolve)
 *
 *   Leitura   GET  ?action=read              → { success: true, data: [...] }
 *             GET  ?action=history&tag=X     → { success: true, history: [...] }
 *             GET  ?action=read_suggestions  → { success: true, data: [...] }
 *
 *   Escrita   POST corpo JSON (não FormData): { action, ...payload }
 *             → { success: true, ... }  ou  { success: false, error: "..." }
 *
 * Dois detalhes que não são óbvios e quebram tudo se ignorados:
 *
 *   1. `GET` sem `action` NÃO devolve dados: o Apps Script responde com a
 *      página HTML embutida. Por isso `action=read` é obrigatório.
 *   2. O corpo do POST é lido de `e.postData.contents`, ou seja, precisa ser
 *      uma string JSON. Enviar FormData faz o `JSON.parse` do servidor falhar.
 *      Mandamos a string sem cabeçalho Content-Type próprio: assim continua
 *      sendo uma requisição "simples", sem preflight e compatível com no-cors.
 */

import { CONFIG } from './config.js';

function apiUrl(params = {}) {
  const url = new URL(CONFIG.API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (CONFIG.API_TOKEN) url.searchParams.set('token', CONFIG.API_TOKEN);
  url.searchParams.set('_ts', Date.now()); // evita cache intermediário
  return url.toString();
}

async function readJson(response) {
  if (!response.ok) throw new Error(`Servidor respondeu HTTP ${response.status}`);

  const text = await response.text();
  // O Apps Script devolve a página HTML quando não reconhece a ação: dizer
  // "não é JSON" seria enigmático, então explicamos a causa provável.
  if (text.trim().startsWith('<')) {
    throw new Error(
      'O servidor devolveu HTML em vez de dados. Confirme que a implantação do ' +
        'Apps Script está atualizada e que a URL termina em /exec.',
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('A resposta do servidor não é um JSON válido.');
  }
}

/** Normaliza os formatos de erro já vistos em produção. */
function unwrap(payload, key = 'data') {
  if (Array.isArray(payload)) {
    // Formato antigo: lista pura, com erro sinalizado no primeiro item.
    if (payload.length && payload[0] && payload[0].error) {
      throw new Error(payload[0].msg || 'Erro reportado pelo servidor.');
    }
    return payload;
  }
  if (payload && payload.success === false) {
    throw new Error(payload.error || 'Erro reportado pelo servidor.');
  }
  if (payload && Array.isArray(payload[key])) return payload[key];
  throw new Error('Formato inesperado na resposta do servidor.');
}

/**
 * Baixa a base (uma linha por equipamento — o backend já devolve apenas a
 * versão mais recente de cada item).
 *
 * Devolve também de onde veio: sem rede, o service worker entrega a última
 * cópia local e marca a resposta com X-Sentinel-Cache.
 */
export async function fetchRecords() {
  const response = await fetch(apiUrl({ action: 'read' }), { method: 'GET' });
  const records = unwrap(await readJson(response));

  const cachedAt = response.headers.get('X-Sentinel-Cached-At');
  return {
    records,
    fromCache: response.headers.get('X-Sentinel-Cache') === 'hit',
    cachedAt: cachedAt ? new Date(cachedAt) : null,
  };
}

/**
 * Histórico de certificados de uma TAG.
 *
 * Precisa ser uma chamada própria: `action=read` devolve só a versão vigente
 * de cada equipamento, então o histórico não está na carga do painel.
 */
export async function fetchHistory(tag) {
  const response = await fetch(apiUrl({ action: 'history', tag }), { method: 'GET' });
  const payload = await readJson(response);
  if (payload && payload.success === false) throw new Error(payload.error || 'Falha ao ler o histórico.');
  if (payload && Array.isArray(payload.history)) return payload.history;
  // Implantação antiga, sem `history` no doGet.
  throw new Error('NAO_IMPLEMENTADO');
}

/** Caixa de sugestões (área ADM). */
export async function fetchSuggestions() {
  const response = await fetch(apiUrl({ action: 'read_suggestions' }), { method: 'GET' });
  return unwrap(await readJson(response));
}

/**
 * Trilha de auditoria. Requer `action=audit` no doGet — ver backend/Code.gs.
 */
export async function fetchAudit({ limit = 300 } = {}) {
  const response = await fetch(apiUrl({ action: 'audit', limit }), { method: 'GET' });
  const payload = await readJson(response);

  const rows = Array.isArray(payload) ? payload : payload && payload.data;
  if (!Array.isArray(rows)) throw new Error('NAO_IMPLEMENTADO');
  // Distingue a trilha de uma lista de equipamentos devolvida por engano.
  if (rows.length && rows[0] && rows[0].action === undefined) throw new Error('NAO_IMPLEMENTADO');
  return rows;
}

/**
 * Envia uma ação de escrita.
 *
 * Em WRITE_MODE 'no-cors' a resposta é opaca por definição — o navegador não
 * deixa ler status nem corpo. Nesse caso devolvemos `confirmed: false` e quem
 * chamou deve verificar o efeito recarregando a base (ver store.verifyWrite).
 * Nunca reporte sucesso ao usuário só porque o fetch não lançou erro.
 */
export async function postAction(payload) {
  const body = JSON.stringify(CONFIG.API_TOKEN ? { ...payload, token: CONFIG.API_TOKEN } : payload);

  if (CONFIG.WRITE_MODE === 'cors') {
    const response = await fetch(CONFIG.API_URL, { method: 'POST', body });
    const result = await readJson(response);
    if (result && result.success === false) throw new Error(result.error || 'O servidor recusou a operação.');
    return { confirmed: true, data: result };
  }

  await fetch(CONFIG.API_URL, { method: 'POST', mode: 'no-cors', body });
  return { confirmed: false, data: null };
}

/**
 * Executa várias ações com concorrência limitada.
 * Nunca rejeita: devolve um resultado por item, para que a interface consiga
 * relatar exatamente o que passou e o que falhou (e nunca trave o overlay).
 */
export async function postBatch(list, { concurrency = CONFIG.BULK_CONCURRENCY, onProgress } = {}) {
  const results = new Array(list.length);
  let cursor = 0;
  let finished = 0;

  const worker = async () => {
    while (cursor < list.length) {
      const index = cursor++;
      try {
        results[index] = { ok: true, value: await postAction(list[index]) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
      finished += 1;
      if (onProgress) onProgress(finished, list.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  return results;
}
