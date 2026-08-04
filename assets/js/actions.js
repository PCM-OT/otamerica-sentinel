/**
 * SENTINEL — Ações de escrita.
 *
 * Toda escrita passa por aqui e termina com uma VERIFICAÇÃO: recarregamos a
 * base e conferimos se o efeito esperado apareceu. A versão anterior exibia
 * "Dados enviados com sucesso!" sempre — mesmo quando o Apps Script recusava
 * a operação — porque `mode: 'no-cors'` esconde a resposta.
 */

import { postAction, postBatch } from './api.js';
import { isOffline } from './pwa.js';
import { authorFields, can, requireIdentity } from './session.js';
import { getByTag, load, verifyWrite } from './store.js';
import { dateKey, setBusy, toast } from './utils.js';

const MAX_FILE_MB = 10;

/**
 * Portão único de escrita: exige um responsável identificado e o papel
 * adequado, e devolve os campos de autoria que acompanham a requisição.
 * Devolve null quando a operação não deve prosseguir.
 */
async function authorize(actionLabel) {
  // Sem conexão não há como confirmar a escrita, e enfileirar para reenviar
  // depois arriscaria aplicar a alteração duas vezes (a resposta do POST é
  // opaca no modo no-cors). Melhor barrar e dizer isso com todas as letras.
  if (isOffline()) {
    toast('Sem conexão: alterações só podem ser enviadas online. Os dados continuam consultáveis.', 'warn', 9000);
    return null;
  }

  const user = await requireIdentity(actionLabel);
  if (!user) return null;
  if (!can('write')) {
    toast('Seu perfil é somente leitura. Peça acesso de edição ao administrador.', 'warn', 8000);
    return null;
  }
  return authorFields();
}

/** Lê um arquivo como base64 (sem o prefixo data:). */
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsText(file);
  });
}

export function checkFileSize(file) {
  const mb = file.size / (1024 * 1024);
  if (mb > MAX_FILE_MB) {
    throw new Error(`Arquivo de ${mb.toFixed(1)} MB excede o limite de ${MAX_FILE_MB} MB.`);
  }
}

/**
 * Fecha o ciclo de uma escrita: reporta erros reais, confirma o efeito e
 * devolve se a operação foi comprovadamente aplicada.
 */
async function finish({ results, verify, successMsg, partialMsg }) {
  const failures = results.filter((r) => !r.ok);
  if (failures.length === results.length) {
    const reason = failures[0]?.error?.message || 'falha de rede';
    setBusy(false);
    toast(`Nada foi enviado (${reason}).`, 'error', 8000);
    return false;
  }

  setBusy(true, 'Confirmando alteração no servidor...');
  const confirmed = await verifyWrite(verify);
  setBusy(false);

  if (confirmed && !failures.length) {
    toast(successMsg, 'success');
    return true;
  }
  if (confirmed) {
    toast(`${partialMsg} (${failures.length} de ${results.length} falharam no envio).`, 'warn', 9000);
    return true;
  }
  toast(
    'O envio saiu daqui, mas o servidor ainda não confirmou a alteração. ' +
      'Confira a planilha antes de repetir a operação.',
    'warn',
    12000,
  );
  return false;
}

/* ------------------------------------------------------------------ *
 * Exclusão (inativação)
 * ------------------------------------------------------------------ */

export async function deleteItems(tags, reason) {
  const list = [...tags];
  if (!list.length) return false;

  const author = await authorize('esta exclusão');
  if (!author) return false;

  setBusy(true, list.length > 1 ? `Inativando ${list.length} equipamentos...` : 'Inativando equipamento...');
  const payloads = list.map((tag) => {
    const item = getByTag(tag);
    return { action: 'delete', tag, reason, cat: item ? item.cat : '', ...author };
  });

  const results = await postBatch(payloads, {
    onProgress: (done, total) => setBusy(true, `Enviando ${done} de ${total}...`),
  });

  return finish({
    results,
    verify: () => list.every((tag) => { const i = getByTag(tag); return !i || i.activeState === 'Inativo'; }),
    successMsg: list.length > 1 ? `${list.length} equipamentos inativados.` : 'Equipamento inativado.',
    partialMsg: 'Inativação aplicada parcialmente',
  });
}

/* ------------------------------------------------------------------ *
 * Atualização de validade em massa
 * ------------------------------------------------------------------ */

/**
 * `dateFor` pode ser uma Date (mesma validade para todos) ou uma função
 * (tag) => Date, usada na renovação por periodicidade, em que cada
 * equipamento tem a própria data-base.
 */
export async function updateValidity(tags, dateFor) {
  const list = [...tags];
  if (!list.length) return false;

  const author = await authorize('esta atualização');
  if (!author) return false;

  const resolve = typeof dateFor === 'function' ? dateFor : () => dateFor;
  const expected = new Map();

  const payloads = [];
  list.forEach((tag) => {
    const date = resolve(tag);
    if (!date) return; // sem data-base: nada a atualizar
    expected.set(tag, dateKey(date));
    const item = getByTag(tag);
    payloads.push({
      action: 'update_date',
      tag,
      // O backend espera dd/mm/aaaa, mesmo formato da planilha.
      newDate: date.toLocaleDateString('pt-BR'),
      cat: item ? item.cat : '',
      ...author,
    });
  });

  if (!payloads.length) {
    toast('Nenhum equipamento selecionado tem data-base para renovar.', 'warn', 8000);
    return false;
  }

  setBusy(true, `Atualizando ${payloads.length} equipamento(s)...`);
  const results = await postBatch(payloads, {
    onProgress: (done, total) => setBusy(true, `Enviando ${done} de ${total}...`),
  });

  return finish({
    results,
    verify: () =>
      [...expected.entries()].every(([tag, key]) => {
        const item = getByTag(tag);
        return item && dateKey(item.validUntil) === key;
      }),
    successMsg: `Validade atualizada para ${payloads.length} equipamento(s).`,
    partialMsg: 'Validade atualizada parcialmente',
  });
}

/* ------------------------------------------------------------------ *
 * Cadastro
 * ------------------------------------------------------------------ */

export async function createEquipment(formData, tag) {
  const author = await authorize('este cadastro');
  if (!author) return false;
  Object.entries(author).forEach(([k, v]) => formData.append(k, v));

  setBusy(true, 'Salvando equipamento...');
  let results;
  try {
    results = [{ ok: true, value: await postAction(formData) }];
  } catch (error) {
    results = [{ ok: false, error }];
  }
  return finish({
    results,
    verify: () => Boolean(getByTag(tag)),
    successMsg: `Equipamento ${tag} salvo.`,
    partialMsg: 'Cadastro registrado',
  });
}

/* ------------------------------------------------------------------ *
 * Ações sem efeito verificável na base de equipamentos
 * ------------------------------------------------------------------ */

async function fireAndReport(payload, { busyMsg, sentMsg }) {
  setBusy(true, busyMsg);
  try {
    const res = await postAction(payload);
    setBusy(false);
    if (res.confirmed) {
      toast(sentMsg, 'success');
      return true;
    }
    toast(
      `${sentMsg} O servidor não confirma o recebimento neste modo — ` +
        'confira a planilha se precisar de certeza.',
      'info',
      9000,
    );
    return true;
  } catch (error) {
    setBusy(false);
    toast(`Falha no envio: ${error.message}`, 'error', 8000);
    return false;
  }
}

export const sendSuggestion = (type, msg) =>
  fireAndReport({ action: 'suggestion', type, msg }, { busyMsg: 'Enviando sugestão...', sentMsg: 'Sugestão enviada.' });

export async function importCsv(cat, csvContent) {
  const author = await authorize('esta substituição de base');
  if (!author) return false;
  if (!can('admin')) {
    toast('Apenas administradores podem substituir bases.', 'warn', 8000);
    return false;
  }

  setBusy(true, 'Substituindo a base...');
  try {
    await postAction({ action: 'import_csv', cat, csvContent, ...author });
  } catch (error) {
    setBusy(false);
    toast(`Falha ao enviar o CSV: ${error.message}`, 'error', 8000);
    return false;
  }
  setBusy(true, 'Recarregando a base...');
  await new Promise((r) => setTimeout(r, 2500));
  try {
    await load();
    setBusy(false);
    toast(`Base de ${cat} recarregada. Confira os totais antes de seguir.`, 'success', 9000);
    return true;
  } catch (error) {
    setBusy(false);
    toast(`Base enviada, mas a recarga falhou: ${error.message}`, 'warn', 9000);
    return false;
  }
}
