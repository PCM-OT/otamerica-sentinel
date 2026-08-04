/**
 * SENTINEL — Ficha do equipamento (modal).
 */

import { deleteItems } from '../actions.js';
import { appBaseUrl } from '../config.js';
import { statusLabel } from '../status.js';
import { getByTag, historyFor, isRejected, periodicityOf } from '../store.js';
import { dateKey, el, esc, promptDialog, qrDataUrl, toast } from '../utils.js';
import { downloadItemPdf } from '../exporters.js';

let currentTag = null;
let lastFocused = null;

export const currentItem = () => (currentTag ? getByTag(currentTag) : null);

/** Endereço público da ficha — é isto que vai dentro do QR Code. */
export const itemUrl = (tag) => `${appBaseUrl()}?tag=${encodeURIComponent(tag)}`;

function renderDetails(item) {
  const grid = el('m-details-container');
  if (!grid) return;

  const base = [
    ['CATEGORIA', item.cat],
    ['LOCALIZAÇÃO', item.local],
    ['FABRICANTE', item.fab],
    ['MODELO', item.model],
    ['Nº DO CERTIFICADO', item.certNum],
    ['CERTIFICADO EM', item.certifiedAtLabel],
    ['PERIODICIDADE', `${periodicityOf(item)} meses${item.periodicity ? '' : ' (padrão da categoria)'}`],
    ['VENCIMENTO', item.dateLabel],
    ['RESULTADO', item.result],
    ['LABORATÓRIO', item.lab],
    ['INCERTEZA DE MEDIÇÃO', item.uncertainty],
    ['ERRO MÁX. ADMISSÍVEL', item.ema],
    ['SITUAÇÃO', item.activeState || 'Ativo'],
  ].filter(([, v]) => v);

  // Evita repetir na grade o que já foi exibido acima, em qualquer grafia.
  const shown = new Set([
    ...base.map(([k]) => k.toUpperCase()),
    'LABORATÓRIO / ORGANISMO CALIBRADOR', 'ORGANISMO CALIBRADOR', 'INCERTEZA', 'EMA',
    'PERIODICIDADE (MESES)', 'TAG', 'EQUIPAMENTO',
  ]);
  const extra = Object.entries(item.fullDetails)
    .filter(([k, v]) => v && v !== '-' && !k.includes('DATA') && !k.includes('RESULTADO'))
    .filter(([k]) => !shown.has(k.toUpperCase()));

  grid.innerHTML = [...base, ...extra]
    .map(
      ([k, v]) =>
        `<div class="detail-item"><label>${esc(k)}</label><div>${esc(v)}</div></div>`,
    )
    .join('');
}

function renderHistory(item) {
  const tbody = el('m-history-list');
  if (!tbody) return;

  const rows = historyFor(item.tag);
  const currentKey = dateKey(item.validUntil);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="table-empty">Sem histórico registrado.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((h) => {
      const isCurrent = Boolean(currentKey) && dateKey(h.validUntil) === currentKey;
      // Sem a gambiarra de detectar "1969/1970": quando não há data válida,
      // dizemos isso explicitamente.
      const label = h.validUntil ? h.dateLabel : 'PENDENTE (sem data)';
      const rejected = isRejected(h);
      const restricted = h.result && h.result.toUpperCase().includes('RESTRIÇÃO');
      let resultColor = 'var(--text-muted)';
      if (h.result) resultColor = rejected ? 'var(--st-danger)' : restricted ? 'var(--st-warn)' : 'var(--st-ok)';
      return (
        `<tr>` +
        `<td style="font-weight:700; color:${isCurrent ? 'var(--st-ok)' : '#fff'}">` +
        `${esc(label)}${isCurrent ? ' <span class="chip-current">atual</span>' : ''}</td>` +
        `<td>${esc(h.certNum || '-')}</td>` +
        `<td style="color:${resultColor}">${esc(h.result || '-')}</td>` +
        `</tr>`
      );
    })
    .join('');
}

function renderQr(item) {
  const url = itemUrl(item.tag);
  const data = qrDataUrl(url, 320);
  const img = el('m-qr-img');
  if (img) {
    img.hidden = !data;
    if (data) {
      img.src = data;
      img.alt = `QR Code do equipamento ${item.tag}`;
    }
  }
  const tagLabel = el('m-qr-tag');
  if (tagLabel) tagLabel.textContent = item.tag;
  const hint = el('m-qr-hint');
  if (hint) {
    hint.textContent = data
      ? 'Escaneie para abrir a ficha atualizada no celular.'
      : 'QR indisponível: o gerador não carregou (sem acesso ao CDN).';
  }
}

export function openItemModal(tag) {
  const item = getByTag(tag);
  if (!item) {
    toast(`Equipamento ${tag} não encontrado.`, 'error');
    return;
  }

  currentTag = tag;
  lastFocused = document.activeElement;

  el('m-equip').textContent = item.equip || item.tag;
  el('m-tag-display').textContent = `${item.tag}${item.cat ? ` | ${item.cat}` : ''}`;

  const chip = el('m-status-chip');
  if (chip) {
    chip.textContent = statusLabel(item.health);
    chip.className = `status-chip ${item.health === 'none' ? 'neutral' : item.health}`;
  }

  // Um certificado reprovado invalida o equipamento mesmo dentro do prazo.
  const alert = el('m-alert');
  if (alert) {
    alert.hidden = !item.blocked;
    if (item.blocked) {
      alert.textContent =
        'Certificado REPROVADO: o equipamento está bloqueado para uso, mesmo com a validade em dia.';
    }
  }

  renderDetails(item);
  renderHistory(item);
  renderQr(item);
  toggleQr(false);

  const link = el('m-file-link');
  if (link) {
    const hasFile = item.file && /^https?:\/\//i.test(item.file);
    link.href = hasFile ? item.file : '#';
    link.hidden = !hasFile;
  }

  const modal = el('modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  el('btn-modal-close')?.focus();

  const url = new URL(window.location.href);
  url.searchParams.set('tag', tag);
  window.history.replaceState({}, '', url);
}

export function closeModal() {
  const modal = el('modal');
  if (!modal.classList.contains('open')) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  currentTag = null;

  const url = new URL(window.location.href);
  url.searchParams.delete('tag');
  window.history.replaceState({}, '', url);

  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  lastFocused = null;
}

export function toggleQr(show) {
  el('m-right-panel')?.classList.toggle('open', show);
}

async function handleDelete() {
  const item = currentItem();
  if (!item) return;

  const reason = await promptDialog({
    title: `Inativar ${item.tag}?`,
    message:
      'O equipamento sai das listas e dos relatórios, mas o histórico permanece na planilha.',
    items: [`${item.tag} — ${item.equip || 'sem descrição'}`],
    inputLabel: 'Motivo da exclusão',
    placeholder: 'Ex: equipamento sucateado, devolvido ao fornecedor...',
    confirmText: 'Inativar',
    danger: true,
    required: true,
  });
  if (!reason) return;

  closeModal();
  await deleteItems([item.tag], reason);
}

/** Registrado uma única vez pelo main.js. */
export function bindModal() {
  el('btn-modal-close')?.addEventListener('click', closeModal);
  el('btn-modal-close-footer')?.addEventListener('click', closeModal);
  el('btn-modal-delete')?.addEventListener('click', handleDelete);
  el('btn-modal-pdf')?.addEventListener('click', () => {
    const item = currentItem();
    if (item) downloadItemPdf(item);
  });
  el('btn-modal-qr')?.addEventListener('click', () => toggleQr(true));
  el('btn-qr-close')?.addEventListener('click', () => toggleQr(false));

  el('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el('modal')?.classList.contains('open')) closeModal();
  });
}
