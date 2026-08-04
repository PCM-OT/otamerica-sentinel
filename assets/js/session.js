/**
 * SENTINEL — Identidade de quem opera o sistema.
 *
 * Dois modos, conforme `CONFIG.AUTH.GOOGLE_CLIENT_ID`:
 *
 *   vazio        → IDENTIFICAÇÃO. O app pergunta o nome do responsável e o
 *                  envia junto de cada escrita, para a trilha de auditoria.
 *                  Não é autenticação: ninguém prova ser quem diz.
 *
 *   preenchido   → LOGIN GOOGLE. O usuário entra com a conta Google e o app
 *                  envia o ID token em cada escrita. Continua não sendo
 *                  segurança até que o BACKEND valide esse token — decodificar
 *                  o JWT aqui só serve para exibir nome e e-mail.
 *
 * Em ambos os casos a autorização real é responsabilidade do Apps Script
 * (ver backend/Code.gs.example).
 */

import { CONFIG, ROLE_PERMISSIONS } from './config.js';
import { el, esc, promptDialog, toast } from './utils.js';

const STORAGE_KEY = 'sentinel.identity.v1';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

let identity = null;
const listeners = new Set();

export const currentUser = () => identity;
export const isSignedIn = () => Boolean(identity);
export const googleEnabled = () => Boolean(CONFIG.AUTH.GOOGLE_CLIENT_ID);

export function onIdentityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn(identity));
  renderUserChip();
}

/** Permissões do usuário atual: 'write' | 'admin'. */
export function can(permission) {
  const role = identity?.role || (googleEnabled() ? 'leitor' : CONFIG.AUTH.DEFAULT_ROLE);
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

function persist() {
  try {
    if (identity) localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Modo privado / storage bloqueado: a sessão vale só para esta aba.
  }
}

export function setIdentity(next) {
  identity = next;
  persist();
  emit();
}

export function signOut() {
  // Impede que a próxima sessão reaproveite a conta sem escolher.
  if (googleEnabled() && window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  setIdentity(null);
  toast('Sessão encerrada.', 'info');
}

export function restoreIdentity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    // Um token do Google expira em ~1h; não faz sentido reenviá-lo depois.
    if (saved.idToken && saved.expiresAt && Date.now() > saved.expiresAt) {
      delete saved.idToken;
      saved.verified = false;
    }
    identity = saved;
    emit();
  } catch {
    identity = null;
  }
}

/**
 * Garante que exista um responsável identificado antes de uma escrita.
 * Devolve a identidade ou null se o usuário desistir.
 */
export async function requireIdentity(actionLabel = 'esta alteração') {
  if (!CONFIG.AUTH.REQUIRE_IDENTITY) return identity || { name: 'não identificado', role: CONFIG.AUTH.DEFAULT_ROLE };
  if (identity) return identity;

  if (googleEnabled()) {
    toast(`Entre com sua conta Google para registrar ${actionLabel}.`, 'warn', 7000);
    promptGoogleSignIn();
    return null;
  }

  const name = await promptDialog({
    title: 'Quem está registrando?',
    message:
      `O nome fica gravado na trilha de auditoria junto de ${actionLabel}. ` +
      'Ele é usado apenas para rastreabilidade.',
    inputLabel: 'Nome e matrícula do responsável',
    placeholder: 'Ex: João Silva — 12345',
    confirmText: 'Continuar',
    required: true,
  });
  if (!name) return null;

  if (name.trim().length < 3) {
    toast('Informe um nome identificável.', 'warn');
    return null;
  }

  setIdentity({ name: name.trim(), email: '', role: CONFIG.AUTH.DEFAULT_ROLE, verified: false });
  return identity;
}

/** Campos anexados a toda escrita, para o backend registrar o autor. */
export function authorFields() {
  if (!identity) return {};
  const fields = { user: identity.name };
  if (identity.email) fields.userEmail = identity.email;
  if (identity.idToken) fields.idToken = identity.idToken;
  return fields;
}

/* ------------------------------------------------------------------ *
 * Login Google (opcional)
 * ------------------------------------------------------------------ */

/**
 * Lê o payload do JWT apenas para exibir nome/e-mail.
 * ⚠️ Isto NÃO valida a assinatura — quem valida é o backend.
 */
function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = atob(part);
    // Decodifica UTF-8 corretamente (nomes com acento).
    const json = decodeURIComponent(
      bytes
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function fetchRole(idToken) {
  // O papel vem do backend (aba USUARIOS). Sem esse endpoint, cai no padrão.
  try {
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set('action', 'whoami');
    url.searchParams.set('idToken', idToken);
    if (CONFIG.API_TOKEN) url.searchParams.set('token', CONFIG.API_TOKEN);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.role ? data.role : null;
  } catch {
    return null;
  }
}

async function handleCredential(response) {
  const claims = decodeJwtPayload(response.credential);
  if (!claims) {
    toast('Não foi possível ler as credenciais do Google.', 'error');
    return;
  }

  setIdentity({
    name: claims.name || claims.email,
    email: claims.email || '',
    role: CONFIG.AUTH.DEFAULT_ROLE,
    verified: true,
    idToken: response.credential,
    expiresAt: claims.exp ? claims.exp * 1000 : Date.now() + 3600_000,
  });
  toast(`Bem-vindo(a), ${identity.name}.`, 'success');

  const role = await fetchRole(response.credential);
  if (role && role !== identity.role) setIdentity({ ...identity, role });
}

function promptGoogleSignIn() {
  if (window.google?.accounts?.id) window.google.accounts.id.prompt();
}

export function initAuth() {
  restoreIdentity();
  renderUserChip();

  if (!googleEnabled()) return;

  const script = document.createElement('script');
  script.src = GIS_SRC;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    try {
      window.google.accounts.id.initialize({
        client_id: CONFIG.AUTH.GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
      });
      const slot = el('google-signin');
      if (slot && !identity) {
        window.google.accounts.id.renderButton(slot, { theme: 'filled_blue', size: 'medium', locale: 'pt-BR' });
        slot.hidden = false;
      }
    } catch (error) {
      console.error('Falha ao inicializar o login Google:', error);
    }
  };
  script.onerror = () => toast('O login Google não carregou (sem acesso à rede do Google).', 'error', 8000);
  document.head.appendChild(script);
}

/* ------------------------------------------------------------------ *
 * Interface
 * ------------------------------------------------------------------ */

function renderUserChip() {
  const chip = el('user-chip');
  if (!chip) return;

  const slot = el('google-signin');
  if (slot) slot.hidden = Boolean(identity) || !googleEnabled();

  if (!identity) {
    chip.hidden = true;
    return;
  }

  chip.hidden = false;
  const roleLabel = identity.role.charAt(0).toUpperCase() + identity.role.slice(1);
  const initials = identity.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  chip.innerHTML =
    `<span class="user-avatar" aria-hidden="true">${esc(initials)}</span>` +
    `<span class="user-meta"><span class="user-name">${esc(identity.name)}</span>` +
    `<span class="user-role">${esc(roleLabel)}${identity.verified ? '' : ' · não verificado'}</span></span>` +
    '<button type="button" class="user-exit" data-signout aria-label="Sair">Sair</button>';
}

export function bindSession() {
  el('user-chip')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-signout]')) signOut();
  });
}
