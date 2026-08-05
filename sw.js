/**
 * SENTINEL — Service Worker.
 *
 * Objetivo: o app abrir e mostrar a última base conhecida mesmo sem rede —
 * o cenário real é o técnico no chão de fábrica, com sinal ruim, escaneando
 * a etiqueta de um equipamento.
 *
 * Estratégias:
 *   navegação        → rede primeiro, cache como reserva (evita shell velho)
 *   estáticos locais → cache primeiro, revalidando em segundo plano
 *   CDN e fontes     → cache primeiro, revalidando em segundo plano
 *   API (GET)        → rede primeiro; sem rede, devolve a última resposta
 *                      marcada com X-Sentinel-Cache/X-Sentinel-Cached-At
 *   API (POST)       → nunca cacheado e nunca enfileirado (ver README:
 *                      com resposta opaca não há como saber se aplicou,
 *                      e reenviar depois arriscaria duplicar a alteração)
 *
 * Ao mudar qualquer arquivo do app, incremente VERSION.
 */

const VERSION = 'v82e3b3b3df35';
const SHELL_CACHE = `sentinel-shell-${VERSION}`;
const RUNTIME_CACHE = `sentinel-runtime-${VERSION}`;
const DATA_CACHE = `sentinel-data-${VERSION}`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/js/main.js',
  './assets/js/config.js',
  './assets/js/utils.js',
  './assets/js/status.js',
  './assets/js/api.js',
  './assets/js/store.js',
  './assets/js/actions.js',
  './assets/js/session.js',
  './assets/js/exporters.js',
  './assets/js/pwa.js',
  './assets/js/views/dashboard.js',
  './assets/js/views/tables.js',
  './assets/js/views/modal.js',
  './assets/js/views/charts.js',
  './assets/js/views/register.js',
  './assets/js/views/admin.js',
  './assets/js/views/audit.js',
];

/**
 * URL da API recebida no registro (./sw.js?api=...). Sem host fixo: se o
 * backend mudar de endereço, o cache de dados continua funcionando.
 */
const API_URL = new URLSearchParams(self.location.search).get('api') || '';
const API = API_URL ? new URL(API_URL) : null;

const CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'cdn.sheetjs.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

const isApi = (url) => Boolean(API) && url.origin === API.origin && url.pathname === API.pathname;
const isCdn = (url) => CDN_HOSTS.includes(url.hostname);

/**
 * Chave estável para a resposta da API.
 * A URL real carrega `_ts` (anti-cache) e o token; sem normalizar, cada
 * requisição viraria uma entrada nova e o cache nunca seria reaproveitado.
 */
function apiCacheKey(url) {
  const action = url.searchParams.get('action') || 'records';
  return `${url.origin}${url.pathname}?action=${action}`;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll falha inteiro se um item falhar; adicionamos um a um para que
      // um arquivo ausente não impeça a instalação.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('sentinel-') && !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_DATA_CACHE') caches.delete(DATA_CACHE);
});

/** Copia a resposta acrescentando cabeçalhos (Headers de resposta é imutável). */
async function withHeaders(response, extra) {
  const body = await response.blob();
  const headers = new Headers(response.headers);
  Object.entries(extra).forEach(([k, v]) => headers.set(k, v));
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      // Respostas opacas (no-cors) não podem ser inspecionadas; guardá-las
      // esconderia falhas silenciosamente.
      if (response && response.ok && response.type !== 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || network.then((r) => r || Promise.reject(new Error('offline')));
}

async function networkFirstDocument(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(SHELL_CACHE);
    cache.put('./index.html', response.clone());
    return response;
  } catch {
    const cached = (await caches.match('./index.html')) || (await caches.match(request));
    if (cached) return cached;
    throw new Error('offline');
  }
}

async function apiGet(request, url) {
  const key = apiCacheKey(url);
  const cache = await caches.open(DATA_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type !== 'opaque') {
      const stamped = await withHeaders(response.clone(), {
        'X-Sentinel-Cached-At': new Date().toISOString(),
      });
      await cache.put(key, stamped);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(key);
    if (!cached) throw error;
    // O app usa este cabeçalho para avisar que os dados são de uma cópia local.
    return withHeaders(cached, { 'X-Sentinel-Cache': 'hit' });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // escritas nunca passam pelo cache

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (isApi(url)) {
    event.respondWith(apiGet(request, url));
    return;
  }

  if (isCdn(url)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
  }
});
