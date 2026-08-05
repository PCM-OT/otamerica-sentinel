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
import { dateKey, formatBR, setBusy, toast } from './utils.js';

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
  const payloads = list.map((tag) => ({
    action: 'delete',
    tag,
    // O backend grava o motivo na coluna MOTIVO e marca EXCLUIDO = SIM.
    motivo: reason,
    ...author,
  }));

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
 * Renova a validade dos equipamentos selecionados.
 *
 * O backend não tem uma ação "mudar a data": o histórico é imutável e cada
 * certificado é uma linha nova. Renovar é, portanto, criar uma nova versão do
 * registro — os dados do equipamento são copiados e só as datas mudam. É
 * também o comportamento correto para conformidade: a validade anterior
 * continua registrada, com quem a renovou e quando.
 *
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
    const item = getByTag(tag);
    if (!item) return;

    expected.set(tag, dateKey(date));
    payloads.push({
      action: 'create',
      category: item.cat,
      // Repassa o registro atual e sobrescreve só a validade: a nova linha
      // preserva fabricante, modelo, localização e o resto.
      data: { ...item.raw, tag: item.tag, dataValidade: sheetDate(date) },
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

export async function createEquipment(category, data) {
  const tag = data.tag;
  const author = await authorize('este cadastro');
  if (!author) return false;

  setBusy(true, 'Salvando equipamento...');
  let results;
  try {
    results = [{ ok: true, value: await postAction({ action: 'create', category, data, ...author }) }];
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

export const sendSuggestion = (nome, categoria, descricao) =>
  fireAndReport(
    { action: 'suggestion', data: { nome: nome || 'Anônimo', categoria, descricao } },
    { busyMsg: 'Enviando sugestão...', sentMsg: 'Sugestão enviada.' },
  );

/**
 * Data no formato que o backend lê sem trocar o dia.
 *
 * O `parseDateSafe` do Apps Script usa `new Date(texto)`: "10/03/2025" seria
 * lido como 3 de outubro (mm/dd), e "2025-03-10" como meia-noite UTC — que no
 * Brasil vira dia 9. Com hora local explícita, os dois problemas somem.
 */
export function sheetDate(date) {
  if (!date) return '';
  const iso = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  return `${iso}T00:00:00`;
}

/**
 * Substituição de base por CSV.
 *
 * O backend não expõe essa ação: o modelo é de histórico imutável, em que
 * cada certificado é uma linha nova e nada é sobrescrito. Manter o botão
 * enviando uma ação inexistente daria "Ação desconhecida" — ou, pior, a
 * impressão de que funcionou, já que no modo no-cors a resposta é opaca.
 */
export async function importCsv() {
  toast(
    'A substituição de base por CSV não existe neste backend: o histórico é imutável. ' +
      'Para carga em massa, edite a planilha diretamente.',
    'warn',
    10000,
  );
  return false;
}
