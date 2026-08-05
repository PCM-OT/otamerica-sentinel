/**
 * SENTINEL — Área ADM: importação de CSV e atalhos.
 *
 * ⚠️ A senha desta área é apenas conveniência de interface. Ela viaja no
 * código-fonte e não protege os dados — a autorização real precisa estar no
 * Apps Script (ver backend/Code.gs.example).
 */

import { importCsv, readFileAsText } from '../actions.js';
import { CATEGORIES, CONFIG } from '../config.js';
import { confirmDialog, el, promptDialog, toast } from '../utils.js';

let brandClicks = 0;
let clickTimer = null;

/** Divide uma linha de CSV respeitando aspas. */
function splitLine(line, delimiter) {
  const out = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(value);
      value = '';
    } else value += ch;
  }
  out.push(value);
  return out;
}

/** Leitura só para pré-visualização — quem importa de fato é o backend. */
function previewCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return { rows: 0, columns: 0, header: [], delimiter: ',' };
  const commas = (lines[0].match(/,/g) || []).length;
  const semis = (lines[0].match(/;/g) || []).length;
  const delimiter = semis > commas ? ';' : ',';
  const header = splitLine(lines[0], delimiter).map((h) => h.trim());
  return { rows: lines.length - 1, columns: header.length, header, delimiter };
}

async function handleImport() {
  const file = el('adm-file-input')?.files?.[0];
  const cat = el('adm-cat-select').value;
  if (!file) {
    toast('Selecione um arquivo CSV.', 'warn');
    return;
  }

  let text;
  try {
    text = await readFileAsText(file);
  } catch (error) {
    toast(error.message, 'error');
    return;
  }

  const info = previewCsv(text);
  if (!info.rows) {
    toast('O arquivo não tem linhas de dados.', 'error');
    return;
  }

  // O Excel em português salva CSV com ponto e vírgula por padrão — importar
  // assim zera a base com uma única coluna. Melhor barrar antes.
  if (info.delimiter === ';') {
    const proceed = await confirmDialog({
      title: 'Separador provavelmente incorreto',
      message:
        'O arquivo parece usar ponto e vírgula (padrão do Excel em português). ' +
        'A base espera vírgula — salve como "CSV UTF-8 (delimitado por vírgulas)". ' +
        'Enviar assim pode destruir a base desta categoria.',
      confirmText: 'Enviar mesmo assim',
      danger: true,
    });
    if (!proceed) return;
  }

  const typed = await promptDialog({
    title: `Substituir toda a base de ${cat}?`,
    message:
      `Esta operação APAGA os registros atuais da categoria e grava ${info.rows} linha(s) do arquivo. ` +
      'Não há desfazer pelo app — faça uma cópia da planilha antes. ' +
      `Colunas detectadas: ${info.columns}.`,
    items: info.header.slice(0, 8),
    inputLabel: `Digite ${cat} para confirmar`,
    placeholder: cat,
    confirmText: 'Substituir base',
    danger: true,
    required: true,
  });
  if (!typed) return;
  if (typed.trim().toUpperCase() !== cat.toUpperCase()) {
    toast('Confirmação não confere. Nada foi enviado.', 'warn');
    return;
  }

  await importCsv(cat, text);
  el('adm-file-input').value = '';
}

async function unlockAdmin() {
  const passcode = await promptDialog({
    title: 'Área administrativa',
    message: 'Esta área permite substituir bases inteiras. Use com cuidado.',
    inputLabel: 'Senha',
    confirmText: 'Entrar',
    required: true,
  });
  if (passcode === null) return;
  if (passcode !== CONFIG.ADMIN_PASSCODE) {
    toast('Senha incorreta.', 'error');
    return;
  }
  el('secret-cloud-widget').hidden = false;
  toast('Área ADM liberada.', 'success');
}

export function bindAdmin() {
  // A importação de CSV depende de suporte no backend; sem ele, o bloco nem
  // aparece, em vez de oferecer um botão que falha.
  const csvBlock = el('adm-csv-block');
  if (csvBlock) csvBlock.hidden = !CONFIG.FEATURES.csvImport;

  const catSelect = el('adm-cat-select');
  if (catSelect) {
    catSelect.innerHTML = CATEGORIES.map((c) => `<option value="${c.value}">Base ${c.short}</option>`).join('');
  }

  el('brand-container')?.addEventListener('click', () => {
    brandClicks += 1;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      brandClicks = 0;
    }, 2000);
    if (brandClicks >= 5) {
      brandClicks = 0;
      unlockAdmin();
    }
  });

  el('btn-upload-csv')?.addEventListener('click', handleImport);
  el('btn-open-sheet')?.addEventListener('click', () => window.open(CONFIG.SHEET_URL, '_blank', 'noopener'));
  el('btn-help')?.addEventListener('click', () => el('help-modal').classList.add('open'));
  el('btn-help-close')?.addEventListener('click', () => el('help-modal').classList.remove('open'));
  el('help-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'help-modal') e.currentTarget.classList.remove('open');
  });
}
