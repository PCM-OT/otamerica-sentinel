/**
 * SENTINEL — Instalação offline (PWA) e estado da conexão.
 */

import { CONFIG } from './config.js';
import { el, toast } from './utils.js';

const listeners = new Set();

export const isOffline = () => !navigator.onLine;

export function onConnectionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function renderBanner() {
  const banner = el('offline-banner');
  if (banner) banner.hidden = navigator.onLine;
  document.body.classList.toggle('is-offline', !navigator.onLine);
}

function announce(online) {
  renderBanner();
  listeners.forEach((fn) => fn(online));
  if (online) toast('Conexão restabelecida. Atualizando os dados...', 'success');
  else toast('Sem conexão. Você continua consultando a última base baixada.', 'warn', 8000);
}

/** Oferece a atualização em vez de trocar o app por baixo de quem está usando. */
function promptUpdate(worker) {
  const node = toast('Nova versão do Sentinel disponível.', 'info', 30000);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toast-action';
  button.textContent = 'Atualizar agora';
  button.addEventListener('click', () => {
    worker.postMessage('SKIP_WAITING');
  });
  node.appendChild(button);
}

function watchForUpdates(registration) {
  if (registration.waiting) promptUpdate(registration.waiting);

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      // "installed" com um controller ativo = há uma versão nova esperando.
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        promptUpdate(installing);
      }
    });
  });
}

/**
 * @param {{ onFirstControl?: () => void }} hooks
 */
export function initPwa({ onFirstControl } = {}) {
  renderBanner();
  window.addEventListener('online', () => announce(true));
  window.addEventListener('offline', () => announce(false));

  // Service Worker exige contexto seguro: https ou localhost.
  if (!('serviceWorker' in navigator)) return;

  // Se já havia um controller, um controllerchange significa versão nova.
  // Na primeira instalação o clients.claim() também dispara o evento, e
  // recarregar ali faria a página piscar sozinha na primeira visita.
  const hadController = Boolean(navigator.serviceWorker.controller);

  window.addEventListener('load', async () => {
    try {
      // A URL da API viaja na query para o SW saber o que é chamada de dados
      // sem depender de um host fixo (e serve como versão do registro).
      const swUrl = `./sw.js?api=${encodeURIComponent(CONFIG.API_URL)}`;
      const registration = await navigator.serviceWorker.register(swUrl, { scope: './' });
      watchForUpdates(registration);

      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !hadController) return;
        reloading = true;
        window.location.reload();
      });

      // Na primeira visita a base é baixada antes de o service worker assumir,
      // então nada dela fica em cache. Repetimos a busca assim que ele passa a
      // controlar a página — senão o app abriria vazio no primeiro uso offline.
      if (!hadController && onFirstControl) {
        await navigator.serviceWorker.ready;
        if (navigator.serviceWorker.controller) onFirstControl();
        else navigator.serviceWorker.addEventListener('controllerchange', () => onFirstControl(), { once: true });
      }
    } catch (error) {
      // Sem service worker o app continua funcionando — só perde o offline.
      console.warn('Modo offline indisponível:', error.message);
    }
  });
}
