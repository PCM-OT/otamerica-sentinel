/**
 * SENTINEL — Camada de acesso ao backend (Google Apps Script).
 *
 * Nenhum outro módulo faz fetch diretamente.
 */

import { CONFIG } from './config.js';

export function toFormData(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null) fd.append(k, v);
  });
  return fd;
}

function withToken(fd) {
  if (CONFIG.API_TOKEN) fd.append('token', CONFIG.API_TOKEN);
  return fd;
}

/**
 * Baixa a base completa (todos os registros, incluindo histórico).
 * Devolve também de onde veio: sem rede, o service worker entrega a última
 * cópia local e marca a resposta com X-Sentinel-Cache.
 */
export async function fetchRecords() {
  const url = new URL(CONFIG.API_URL);
  if (CONFIG.API_TOKEN) url.searchParams.set('token', CONFIG.API_TOKEN);
  url.searchParams.set('_ts', Date.now()); // evita cache intermediário

  const response = await fetch(url.toString(), { method: 'GET' });
  if (!response.ok) throw new Error(`Servidor respondeu HTTP ${response.status}`);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('A resposta do servidor não é um JSON válido. Verifique a implantação do Apps Script.');
  }

  // O Apps Script sinaliza erro devolvendo [{ error: true, msg: "..." }]
  if (Array.isArray(data) && data.length && data[0] && data[0].error) {
    throw new Error(data[0].msg || 'Erro reportado pelo servidor.');
  }
  if (data && !Array.isArray(data) && data.error) {
    throw new Error(data.msg || data.error || 'Erro reportado pelo servidor.');
  }
  if (!Array.isArray(data)) throw new Error('Formato inesperado: esperava uma lista de registros.');

  const cachedAt = response.headers.get('X-Sentinel-Cached-At');
  return {
    records: data,
    fromCache: response.headers.get('X-Sentinel-Cache') === 'hit',
    cachedAt: cachedAt ? new Date(cachedAt) : null,
  };
}

/**
 * Baixa a trilha de auditoria (quem alterou o quê e quando).
 * Requer `action=audit` no doGet do Apps Script — ver backend/Code.gs.example.
 */
export async function fetchAudit({ limit = 300 } = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set('action', 'audit');
  url.searchParams.set('limit', String(limit));
  if (CONFIG.API_TOKEN) url.searchParams.set('token', CONFIG.API_TOKEN);
  url.searchParams.set('_ts', Date.now());

  const response = await fetch(url.toString(), { method: 'GET' });
  if (!response.ok) throw new Error(`Servidor respondeu HTTP ${response.status}`);

  const data = await response.json().catch(() => null);
  if (Array.isArray(data) && data.length && data[0] && data[0].error) {
    throw new Error(data[0].msg || 'Erro reportado pelo servidor.');
  }
  if (!Array.isArray(data)) {
    // O script antigo ignora `action` no GET e devolve a lista de equipamentos.
    throw new Error('NAO_IMPLEMENTADO');
  }
  // Distingue "lista de auditoria" de "lista de equipamentos" devolvida por engano.
  if (data.length && data[0] && data[0].tag !== undefined && data[0].action === undefined) {
    throw new Error('NAO_IMPLEMENTADO');
  }
  return data;
}

/**
 * Envia uma ação de escrita.
 *
 * Em WRITE_MODE 'no-cors' a resposta é opaca por definição — o navegador não
 * deixa ler status nem corpo. Nesse caso devolvemos `confirmed: false` e quem
 * chamou deve verificar o efeito recarregando a base (ver store.verifyWrite).
 * Nunca reporte sucesso ao usuário só porque o fetch não lançou erro.
 */
export async function postAction(params) {
  const fd = withToken(params instanceof FormData ? params : toFormData(params));

  if (CONFIG.WRITE_MODE === 'cors') {
    const response = await fetch(CONFIG.API_URL, { method: 'POST', body: fd });
    if (!response.ok) throw new Error(`Servidor respondeu HTTP ${response.status}`);
    const json = await response.json().catch(() => null);
    if (json && json.ok === false) throw new Error(json.error || 'O servidor recusou a operação.');
    return { confirmed: true, data: json };
  }

  await fetch(CONFIG.API_URL, { method: 'POST', mode: 'no-cors', body: fd });
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
