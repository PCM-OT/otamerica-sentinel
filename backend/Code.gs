/**
 * SENTINEL NEXUS — BACKEND (evolução do V33)
 *
 * Substitui o Code.gs atual mantendo o MESMO contrato com o front-end:
 * as ações, os nomes de campo e o formato das respostas continuam iguais.
 * O que muda são correções e recursos novos.
 *
 * CORREÇÕES EM RELAÇÃO AO V33
 *   1. Datas em texto "10/03/2025" eram lidas como 3 de outubro (new Date
 *      interpreta mm/dd). Agora dd/mm/aaaa é reconhecido explicitamente.
 *   2. formatDateToISO usava o fuso do script; com fuso diferente do da
 *      planilha, a data saía um dia atrás. Agora usa o fuso da planilha.
 *   3. Em DEMAIS EQUIPAMENTOS o código lia/escrevia DIAMETRO_CONEXAO, que não
 *      existe no mapa dessa aba: o campo INFORMAÇÕES nunca era gravado nem
 *      lido, em silêncio. O mapeamento agora é gerado de uma fonte só.
 *   4. deleteRecord casava `rowTag === tag || rowItem === tag`: uma TAG igual
 *      ao ITEM de outro equipamento marcava o registro errado como excluído.
 *   5. getNextItemId + appendRow sem trava: dois cadastros simultâneos
 *      pegavam o mesmo ITEM. Agora toda escrita roda sob LockService.
 *   6. readAllData ficava com a ÚLTIMA LINHA da planilha por item. Inserir um
 *      certificado antigo depois fazia o painel exibir o vencido como vigente.
 *      Agora vence a maior data de validade (empate: a linha mais recente).
 *   7. getSuggestionsList lia 5 colunas fixas e quebrava se a aba tivesse menos.
 *
 * NOVIDADES
 *   - Colunas que faltarem são criadas sozinhas, no fim da aba, sem mexer nas
 *     existentes (o mapeamento é posicional, então acrescentar no fim é seguro).
 *   - Token compartilhado validado em toda requisição.
 *   - Trilha de auditoria: quem, quando, o quê.
 *   - Campos de metrologia: laboratório, incerteza, erro máximo admissível,
 *     periodicidade — e LINK, para anexar o certificado no Drive.
 *   - action=history e action=audit no GET; resumo de vencimentos por e-mail.
 *
 * INSTALAÇÃO
 *   1. Cole este arquivo por cima do Code.gs atual.
 *   2. Preencha CONFIG abaixo.
 *   3. Rode a função `setup` uma vez (cria colunas e agenda o e-mail).
 *   4. Implantar → Nova implantação → App da Web (Executar como: Eu;
 *      Quem pode acessar: Qualquer pessoa).
 */

const CONFIG = {
  SHEET_ID: '1kukF8e9zcahs5-5s8ipSmaNnfOv8mVlAoJoiHXySWX4',

  /**
   * Segredo compartilhado. Gere um valor aleatório e repita em
   * assets/js/config.js → API_TOKEN. Deixe '' para manter aberto (não
   * recomendado). Não é autenticação forte — o token também fica no cliente —
   * mas impede o acesso de quem apenas descobriu a URL.
   */
  TOKEN: 'x3X0VrCGQiZ-en4OxGNeKcVbSGB_Ptnp',

  /** URL pública do app (Vercel), usada nos links do e-mail de alerta. */
  APP_URL: 'https://otamerica-sentinel.vercel.app',

  SUGGESTION_SHEET: 'SUGESTÕES',
  LOG_SHEET: 'AUDITORIA',

  /** Pasta do Drive para os certificados anexados. '' = raiz do Drive. */
  DRIVE_FOLDER_ID: '',

  /** Destinatários do resumo de vencimentos (separe com vírgula). */
  DIGEST_TO: '',
  DIGEST_WARN_DAYS: 40,

  /** Segundos de cache da leitura. 0 desliga. */
  CACHE_SECONDS: 600,
};

/* ================================================================== *
 * ESQUEMA DAS ABAS
 *
 * `headers` é a ordem física das colunas. `fields` mapeia o nome usado no
 * JSON (o mesmo que o formulário envia) para o índice da coluna.
 *
 * Para acrescentar um campo: coloque o cabeçalho no FIM de `headers`, o nome
 * em `fields` com o índice correspondente, e rode `setup`. A coluna é criada
 * sem mexer em nada que já existe.
 * ================================================================== */

const SHEET_SCHEMA = {
  'NR-10': {
    name: 'NR-10',
    headers: [
      'ITEM', 'TAG', 'TAG ANTERIOR', 'EQUIPAMENTO', 'ESPECIFICAÇÃO', 'FABRICANTE',
      'DIMENSÕES', 'ID MALÃO', 'ORDEM DE ENVIO', 'DATA DE CERTIFICAÇÃO',
      'DATA DE VALIDADE', 'Nº DO CERTIFICADO', 'RESULTADO', 'EXCLUÍDO', 'MOTIVO',
      // ↓ acrescentadas por este backend
      'LABORATÓRIO', 'INCERTEZA DE MEDIÇÃO', 'ERRO MÁXIMO ADMISSÍVEL',
      'PERIODICIDADE (MESES)', 'LINK',
    ],
    fields: {
      item: 0, tag: 1, tagAnterior: 2, equipamento: 3, especificacao: 4, fabricante: 5,
      dimensoes: 6, idMalao: 7, ordemEnvio: 8, dataCertificacao: 9, dataValidade: 10,
      numCertificado: 11, resultado: 12, excluido: 13, motivo: 14,
      lab: 15, incerteza: 16, ema: 17, periodicidade: 18, link: 19,
    },
  },

  'MANÔMETROS': {
    name: 'MANÔMETROS',
    headers: [
      'ITEM', 'TAG', 'TAG ANTERIOR', 'Nº SÉRIE', 'MODELO', 'FABRICANTE', 'FLUIDO',
      'FAIXA DE INDICAÇÃO', 'GLICERINA', 'POSIÇÃO DA CONEXÃO', 'TIPO DE CONEXÃO',
      'DIÂMETRO DA CONEXÃO', 'MATERIAL DA CONEXÃO', 'DIÂMETRO DA CAIXA',
      'MATERIAL DA CAIXA', 'EQUIP. ASSOCIADO', 'LOCALIZAÇÃO', 'DATA DE CERTIFICAÇÃO',
      'DATA DE VALIDADE', 'Nº DO CERTIFICADO', 'RESULTADO', 'EXCLUÍDO', 'MOTIVO',
      'LABORATÓRIO', 'INCERTEZA DE MEDIÇÃO', 'ERRO MÁXIMO ADMISSÍVEL',
      'PERIODICIDADE (MESES)', 'LINK',
    ],
    fields: {
      item: 0, tag: 1, tagAnterior: 2, numSerie: 3, modelo: 4, fabricante: 5, fluido: 6,
      faixaIndicacao: 7, glicerina: 8, posicaoConexao: 9, tipoConexao: 10,
      diametroConexao: 11, materialConexao: 12, diametroCaixa: 13, materialCaixa: 14,
      equipAssociado: 15, localizacao: 16, dataCertificacao: 17, dataValidade: 18,
      numCertificado: 19, resultado: 20, excluido: 21, motivo: 22,
      lab: 23, incerteza: 24, ema: 25, periodicidade: 26, link: 27,
    },
  },

  'DEMAIS EQUIPAMENTOS': {
    name: 'DEMAIS EQUIPAMENTOS',
    headers: [
      'ITEM', 'TAG', 'TAG ANTERIOR', 'MODELO', 'INFORMAÇÕES', 'LOCALIZAÇÃO',
      'DATA DE CERTIFICAÇÃO', 'DATA DE VALIDADE', 'Nº DO CERTIFICADO', 'RESULTADO',
      'EXCLUÍDO', 'MOTIVO',
      'LABORATÓRIO', 'INCERTEZA DE MEDIÇÃO', 'ERRO MÁXIMO ADMISSÍVEL',
      'PERIODICIDADE (MESES)', 'LINK',
    ],
    fields: {
      item: 0, tag: 1, tagAnterior: 2, modelo: 3, informacoes: 4, localizacao: 5,
      dataCertificacao: 6, dataValidade: 7, numCertificado: 8, resultado: 9,
      excluido: 10, motivo: 11,
      lab: 12, incerteza: 13, ema: 14, periodicidade: 15, link: 16,
    },
  },
};

const AUDIT_HEADERS = ['DATA/HORA', 'AÇÃO', 'CATEGORIA', 'TAG', 'DETALHE', 'USUÁRIO'];
const SUGGESTION_HEADERS = ['DATA', 'NOME', 'CATEGORIA', 'DESCRIÇÃO', 'STATUS'];

/* ------------------------------------------------------------------ *
 * Infraestrutura
 * ------------------------------------------------------------------ */

function ss() {
  return SpreadsheetApp.openById(CONFIG.SHEET_ID);
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function checkToken(params) {
  if (!CONFIG.TOKEN) return;
  if (String((params && params.token) || '') !== CONFIG.TOKEN) {
    throw new Error('Token inválido ou ausente.');
  }
}

/**
 * Garante que a aba exista e tenha todas as colunas do esquema.
 *
 * O mapeamento é POSICIONAL, então só acrescentamos colunas no fim e nunca
 * tocamos nas existentes — inclusive nos títulos, que podem estar escritos de
 * outro jeito na planilha atual.
 */
function ensureColumns(category) {
  const schema = SHEET_SCHEMA[category];
  if (!schema) throw new Error('Categoria desconhecida: ' + category);

  const book = ss();
  let sheet = book.getSheetByName(schema.name);
  let created = false;

  if (!sheet) {
    sheet = book.insertSheet(schema.name);
    created = true;
  }

  const needed = schema.headers.length;
  if (sheet.getMaxColumns() < needed) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), needed - sheet.getMaxColumns());
  }

  const filled = sheet.getLastColumn();
  const added = [];
  for (let c = filled + 1; c <= needed; c += 1) {
    sheet.getRange(1, c).setValue(schema.headers[c - 1]);
    added.push(schema.headers[c - 1]);
  }

  if (added.length) {
    sheet.getRange(1, 1, 1, needed).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return { sheet: sheet, created: created, added: added };
}

function ensureAuxSheet(name, headers) {
  const book = ss();
  let sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return { sheet: sheet, created: true };
  }
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return { sheet: sheet, created: false };
}

function clearCache() {
  CacheService.getScriptCache().remove('allData_cache');
}

/* ------------------------------------------------------------------ *
 * Datas
 * ------------------------------------------------------------------ */

/**
 * Converte qualquer representação de data em timestamp, ou null.
 *
 * O ponto delicado é o texto: `new Date('10/03/2025')` devolve 3 de OUTUBRO,
 * porque o motor lê mm/dd. Numa planilha brasileira isso trocava o mês
 * silenciosamente. Por isso dd/mm/aaaa é tratado antes de qualquer coisa.
 */
function parseDateSafe(value) {
  if (value === null || value === undefined || value === '') return null;

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? null : value.getTime();
  }

  if (typeof value === 'number') {
    if (!isFinite(value) || value <= 0) return null;
    // Serial do Excel/Sheets (dias desde 30/12/1899).
    if (value < 100000) return new Date(1899, 11, 30).getTime() + value * 86400000;
    return value;
  }

  const text = String(value).trim();
  if (!text || text.toUpperCase() === 'PENDENTE' || text === '-') return null;

  // dd/mm/aaaa (com ou sem hora)
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return buildDate(Number(br[3]), Number(br[2]), Number(br[1]));

  // aaaa-mm-dd (com ou sem hora) — lido como data local, não UTC
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed.getTime();
}

/** Data de calendário à meia-noite local, rejeitando 31/02 e afins. */
function buildDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date.getTime();
}

/** Timestamp → 'aaaa-mm-dd' no fuso da PLANILHA (não no do script). */
function formatDateToISO(value) {
  const timestamp = parseDateSafe(value);
  if (!timestamp) return '';
  return Utilities.formatDate(new Date(timestamp), ss().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

function formatDateBR(value) {
  const timestamp = parseDateSafe(value);
  if (!timestamp) return '';
  return Utilities.formatDate(new Date(timestamp), ss().getSpreadsheetTimeZone(), 'dd/MM/yyyy');
}

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    checkToken(params);

    switch (params.action) {
      case 'read':
        return json(readCached(params.fresh === '1'));
      case 'history':
        return json(getHistory(params.tag));
      case 'read_suggestions':
        return json(getSuggestionsList());
      case 'audit':
        return json(readAudit(Number(params.limit) || 300));
      default:
        // Sem `action` o app não tem o que fazer com HTML: melhor dizer isso
        // do que devolver uma página e o cliente falhar ao interpretar JSON.
        return json({ success: false, error: 'Informe action=read, history, read_suggestions ou audit.' });
    }
  } catch (error) {
    return json({ success: false, error: error.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Nenhum dado recebido no corpo da requisição.');
    }

    let params;
    try {
      params = JSON.parse(e.postData.contents);
    } catch (parseError) {
      params = JSON.parse(e.postData.contents.replace(/[\u0000-\u001F]+/g, ''));
    }

    checkToken(params);

    // Sem trava, dois cadastros simultâneos pegavam o mesmo ITEM e uma
    // exclusão podia escrever sobre a linha que a outra estava lendo.
    lock.waitLock(30000);

    const author = authorOf(params);
    let result;

    switch (params.action) {
      case 'read':
        result = readAllData();
        break;
      case 'create':
        result = createRecord(params, author);
        break;
      case 'delete':
        result = deleteRecord(params, author);
        break;
      case 'history':
        result = getHistory(params.tag);
        break;
      case 'suggestion':
        result = saveSuggestion(params);
        break;
      default:
        throw new Error('Ação desconhecida: ' + params.action);
    }

    return json(result);
  } catch (error) {
    return json({ success: false, error: error.message });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {
      /* já liberado */
    }
  }
}

/** Quem está operando: e-mail da sessão, se houver; senão o nome declarado. */
function authorOf(params) {
  let email = '';
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (ignored) {
    email = '';
  }
  if (email) return email;
  return params.user ? params.user + ' (não verificado)' : 'anônimo';
}

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */

function readCached(fresh) {
  const cache = CacheService.getScriptCache();

  if (!fresh && CONFIG.CACHE_SECONDS > 0) {
    const cached = cache.get('allData_cache');
    if (cached) return JSON.parse(cached);
  }

  const data = readAllData();
  const serialized = JSON.stringify(data);
  // O limite do cache é 100KB por chave; acima disso simplesmente não guarda.
  if (CONFIG.CACHE_SECONDS > 0 && serialized.length < 100000) {
    cache.put('allData_cache', serialized, CONFIG.CACHE_SECONDS);
  }
  return data;
}

function readAllData() {
  const book = ss();
  const allData = [];

  Object.keys(SHEET_SCHEMA).forEach(function (category) {
    const schema = SHEET_SCHEMA[category];
    const sheet = book.getSheetByName(schema.name);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const width = Math.min(schema.headers.length, sheet.getLastColumn());
    const rows = sheet.getRange(2, 1, lastRow - 1, width).getValues();

    // Uma linha por ITEM: vence a maior validade. O V33 ficava com a última
    // linha da planilha, então inserir um certificado antigo depois fazia o
    // painel mostrar o vencido como vigente.
    const latest = {};
    rows.forEach(function (row, index) {
      if (!String(row[schema.fields.tag] || '').trim()) return;

      const record = parseRowToObject(row, category);
      record.rowIndex = index;

      const current = latest[record.item];
      if (!current) {
        latest[record.item] = record;
        return;
      }
      const a = record.dataValidadeTimestamp || 0;
      const b = current.dataValidadeTimestamp || 0;
      if (a > b || (a === b && record.rowIndex > current.rowIndex)) latest[record.item] = record;
    });

    Object.keys(latest).forEach(function (key) {
      allData.push(latest[key]);
    });
  });

  return { success: true, data: allData };
}

/**
 * Linha → objeto, dirigido pelo mapa `fields`.
 *
 * Antes cada categoria tinha um bloco próprio, e o de DEMAIS EQUIPAMENTOS
 * lia uma coluna inexistente enquanto INFORMAÇÕES nunca aparecia. Com uma
 * fonte única de nomes, esse tipo de erro deixa de ser possível.
 */
function parseRowToObject(row, category) {
  const schema = SHEET_SCHEMA[category];
  const record = { category: category };

  Object.keys(schema.fields).forEach(function (field) {
    const index = schema.fields[field];
    const value = row[index];
    record[field] = value === null || value === undefined ? '' : String(value).trim();
  });

  record.dataCertificacaoTimestamp = parseDateSafe(row[schema.fields.dataCertificacao]);
  record.dataValidadeTimestamp = parseDateSafe(row[schema.fields.dataValidade]);
  record.dataCertificacao = formatDateToISO(row[schema.fields.dataCertificacao]);
  record.dataValidade = formatDateToISO(row[schema.fields.dataValidade]);
  record.excluido = String(record.excluido || 'NÃO').toUpperCase();

  // Status hierárquico: excluído > reprovado > ativo.
  if (record.excluido === 'SIM') {
    record.status = 'Obsoleto';
    record.isDeleted = true;
  } else if (record.resultado && record.resultado.toUpperCase().indexOf('REPROVADO') !== -1) {
    record.status = 'Reprovado';
    record.isRejected = true;
  } else {
    record.status = 'Ativo';
  }

  return record;
}

/** Todas as versões de uma TAG, da mais recente para a mais antiga. */
function getHistory(tag) {
  if (!tag) return { success: false, error: 'TAG é obrigatória' };

  const book = ss();
  const history = [];

  Object.keys(SHEET_SCHEMA).forEach(function (category) {
    const schema = SHEET_SCHEMA[category];
    const sheet = book.getSheetByName(schema.name);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const width = Math.min(schema.headers.length, sheet.getLastColumn());
    const rows = sheet.getRange(2, 1, lastRow - 1, width).getValues();

    rows.forEach(function (row) {
      if (String(row[schema.fields.tag] || '').trim() === String(tag).trim()) {
        history.push(parseRowToObject(row, category));
      }
    });
  });

  history.sort(function (a, b) {
    return (b.dataValidadeTimestamp || 0) - (a.dataValidadeTimestamp || 0);
  });

  return { success: true, tag: tag, totalVersions: history.length, history: history };
}

function readAudit(limit) {
  const sheet = ss().getSheetByName(CONFIG.LOG_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return { success: true, data: [] };

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, AUDIT_HEADERS.length)
    .getValues()
    .reverse()
    .slice(0, limit);

  return {
    success: true,
    data: rows.map(function (r) {
      return {
        date: Object.prototype.toString.call(r[0]) === '[object Date]' ? r[0].toISOString() : String(r[0]),
        action: String(r[1] || ''),
        cat: String(r[2] || ''),
        tag: String(r[3] || ''),
        detail: String(r[4] || ''),
        user: String(r[5] || ''),
      };
    }),
  };
}

/* ------------------------------------------------------------------ *
 * Escrita
 * ------------------------------------------------------------------ */

function audit(action, category, tag, detail, author) {
  const sheet = ensureAuxSheet(CONFIG.LOG_SHEET, AUDIT_HEADERS).sheet;
  sheet.appendRow([new Date(), action, category || '', tag || '', detail || '', author || 'anônimo']);
}

/**
 * Cada certificado é uma LINHA NOVA: o histórico é imutável.
 * Renovar a validade de um equipamento é criar uma nova versão dele.
 */
function createRecord(params, author) {
  const category = params.category || params.cat;
  const schema = SHEET_SCHEMA[category];
  if (!schema) throw new Error('Categoria desconhecida: ' + category);

  const sheet = ensureColumns(category).sheet;
  const data = params.data || params;
  const tag = String(data.tag || params.tag || '').trim();
  if (!tag) throw new Error('TAG é obrigatória');

  const existingItem = findItemByTag(sheet, schema, tag);
  const itemId = existingItem || getNextItemId(sheet, schema);

  const row = new Array(schema.headers.length).fill('');
  Object.keys(schema.fields).forEach(function (field) {
    if (data[field] !== undefined && data[field] !== null) row[schema.fields[field]] = data[field];
  });

  row[schema.fields.item] = itemId;
  row[schema.fields.tag] = tag;
  row[schema.fields.excluido] = 'NÃO';
  row[schema.fields.motivo] = '';
  if (!row[schema.fields.resultado]) row[schema.fields.resultado] = 'APROVADO';

  // Datas gravadas como Date de verdade: a planilha passa a ordenar e filtrar
  // corretamente, e a leitura deixa de depender de interpretar texto.
  ['dataCertificacao', 'dataValidade'].forEach(function (field) {
    const timestamp = parseDateSafe(data[field]);
    row[schema.fields[field]] = timestamp ? new Date(timestamp) : '';
  });

  if (data.fileData && data.fileName) {
    row[schema.fields.link] = saveAttachment(data);
  }

  sheet.appendRow(row);
  clearCache();
  audit('create', category, tag, existingItem ? 'nova versão' : 'primeiro cadastro', author);

  return {
    success: true,
    itemId: itemId,
    tag: tag,
    message: existingItem
      ? 'Nova versão do equipamento registrada (histórico preservado)'
      : 'Novo equipamento criado',
  };
}

function saveAttachment(data) {
  const blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), data.mimeType, data.fileName);
  const file = CONFIG.DRIVE_FOLDER_ID
    ? DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID).createFile(blob)
    : DriveApp.createFile(blob);
  return file.getUrl();
}

function findItemByTag(sheet, schema, tag) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const width = Math.min(schema.headers.length, sheet.getLastColumn());
  const rows = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (String(rows[i][schema.fields.tag] || '').trim() === String(tag).trim()) {
      return String(rows[i][schema.fields.item]);
    }
  }
  return null;
}

function getNextItemId(sheet, schema) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;

  const values = sheet.getRange(2, schema.fields.item + 1, lastRow - 1, 1).getValues();
  let maxId = 0;
  values.forEach(function (r) {
    const n = parseInt(r[0], 10);
    if (!isNaN(n) && n > maxId) maxId = n;
  });
  return maxId + 1;
}

/**
 * Exclusão lógica: marca EXCLUÍDO = SIM.
 *
 * Casa apenas pela TAG. O V33 aceitava também o ITEM no mesmo parâmetro, e
 * uma TAG numérica igual ao ITEM de outro equipamento marcava o registro
 * errado.
 */
function deleteRecord(params, author) {
  const tag = String(params.tag || '').trim();
  const motivo = params.motivo || params.reason || 'Sem motivo especificado';
  if (!tag) throw new Error('TAG é obrigatória para exclusão');

  const book = ss();
  let marked = 0;
  let category = '';

  Object.keys(SHEET_SCHEMA).forEach(function (cat) {
    const schema = SHEET_SCHEMA[cat];
    const sheet = book.getSheetByName(schema.name);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const width = Math.min(schema.headers.length, sheet.getLastColumn());
    const rows = sheet.getRange(2, 1, lastRow - 1, width).getValues();

    // Marca TODAS as versões da TAG: se só a última fosse marcada, a versão
    // anterior voltaria a ser a vigente na próxima leitura.
    rows.forEach(function (row, i) {
      if (String(row[schema.fields.tag] || '').trim() !== tag) return;
      const rowNumber = i + 2;
      sheet.getRange(rowNumber, schema.fields.excluido + 1).setValue('SIM');
      sheet.getRange(rowNumber, schema.fields.motivo + 1).setValue(motivo);
      marked += 1;
      category = cat;
    });
  });

  if (!marked) throw new Error('Equipamento não encontrado: ' + tag);

  clearCache();
  audit('delete', category, tag, motivo, author);
  return { success: true, message: 'Equipamento marcado como obsoleto', tag: tag, rows: marked };
}

function saveSuggestion(params) {
  const sheet = ensureAuxSheet(CONFIG.SUGGESTION_SHEET, SUGGESTION_HEADERS).sheet;
  const data = params.data || params;

  sheet.appendRow([
    new Date(),
    data.nome || 'Anônimo',
    data.categoria || data.type || 'Outro',
    data.descricao || data.msg || '',
    'PENDENTE',
  ]);

  return { success: true, message: 'Sugestão registrada com sucesso!' };
}

function getSuggestionsList() {
  const sheet = ss().getSheetByName(CONFIG.SUGGESTION_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return { success: true, data: [] };

  // Largura real da aba: ler 5 colunas fixas quebrava se houvesse menos.
  const width = Math.min(SUGGESTION_HEADERS.length, sheet.getLastColumn());
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();

  return {
    success: true,
    data: rows.map(function (r) {
      return {
        data: Object.prototype.toString.call(r[0]) === '[object Date]' ? r[0].toISOString() : String(r[0] || ''),
        nome: String(r[1] || ''),
        categoria: String(r[2] || ''),
        descricao: String(r[3] || ''),
        status: String(r[4] || ''),
      };
    }),
  };
}

/* ================================================================== *
 * INSTALAÇÃO E ALERTAS
 * ================================================================== */

/** Execute uma vez pelo editor: cria colunas/abas e agenda o e-mail. */
function setup() {
  const lines = ['SENTINEL — instalação', ''];

  Object.keys(SHEET_SCHEMA).forEach(function (category) {
    const result = ensureColumns(category);
    if (result.created) lines.push(category + ': aba criada');
    else if (result.added.length) lines.push(category + ': colunas acrescentadas → ' + result.added.join(', '));
    else lines.push(category + ': já estava completa');
  });

  ensureAuxSheet(CONFIG.LOG_SHEET, AUDIT_HEADERS);
  ensureAuxSheet(CONFIG.SUGGESTION_SHEET, SUGGESTION_HEADERS);
  lines.push(CONFIG.LOG_SHEET + ' e ' + CONFIG.SUGGESTION_SHEET + ': prontas');

  clearCache();
  lines.push('', CONFIG.DIGEST_TO ? installDigestTrigger() : '⚠️ Preencha CONFIG.DIGEST_TO para ligar o alerta por e-mail.');
  if (!CONFIG.TOKEN) lines.push('⚠️ CONFIG.TOKEN vazio: a API está aberta a quem tiver a URL.');
  if (!CONFIG.APP_URL) lines.push('⚠️ Preencha CONFIG.APP_URL para os links do e-mail.');

  lines.push('', 'Próximo passo: Implantar → Nova implantação → App da Web.');
  Logger.log(lines.join('\n'));
  return lines.join('\n');
}

/** Cria (ou recria) o acionador semanal do resumo de vencimentos. */
function installDigestTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'sendExpiryDigest') ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger('sendExpiryDigest').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  return 'Resumo semanal agendado: segunda-feira, 7h → ' + CONFIG.DIGEST_TO;
}

/** Monta o resumo e escreve no log, sem enviar — confira antes de agendar. */
function testDigest() {
  const digest = buildDigest();
  Logger.log(digest.text || 'Nenhum vencimento a reportar no momento.');
  return digest.text;
}

function sendExpiryDigest() {
  if (!CONFIG.DIGEST_TO) return;
  const digest = buildDigest();
  if (!digest.text) return; // nada a reportar: não enche a caixa de entrada

  MailApp.sendEmail({
    to: CONFIG.DIGEST_TO,
    subject: '[Sentinel] ' + digest.expired.length + ' vencidos, ' + digest.soon.length + ' a vencer',
    body: digest.text,
    htmlBody: digest.html,
  });
}

function buildDigest() {
  const records = readAllData().data;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expired = [];
  const soon = [];

  records.forEach(function (r) {
    if (r.isDeleted) return;
    if (!r.dataValidadeTimestamp) return;

    const days = Math.round((r.dataValidadeTimestamp - today.getTime()) / 86400000);
    const item = {
      tag: r.tag,
      equip: r.equipamento || r.modelo || r.numSerie || '',
      local: r.localizacao || '',
      date: formatDateBR(r.dataValidadeTimestamp),
      days: days,
      rejected: Boolean(r.isRejected),
    };

    if (days < 0 || item.rejected) expired.push(item);
    else if (days <= CONFIG.DIGEST_WARN_DAYS) soon.push(item);
  });

  const byDays = function (a, b) {
    return a.days - b.days;
  };
  expired.sort(byDays);
  soon.sort(byDays);

  if (!expired.length && !soon.length) return { text: '', html: '', expired: expired, soon: soon };

  const label = function (i) {
    if (i.rejected) return 'REPROVADO';
    return i.days < 0 ? 'vencido há ' + Math.abs(i.days) + ' dias' : 'faltam ' + i.days + ' dias';
  };
  const line = function (i) {
    return i.tag + ' — ' + i.equip + (i.local ? ' (' + i.local + ')' : '') + ' — vence ' + i.date + ' — ' + label(i);
  };

  const dateLabel = Utilities.formatDate(today, ss().getSpreadsheetTimeZone(), 'dd/MM/yyyy');
  const text = [
    'Resumo Sentinel — ' + dateLabel,
    '',
    'VENCIDOS / BLOQUEADOS (' + expired.length + ')',
    expired.length ? expired.map(line).join('\n') : 'nenhum',
    '',
    'VENCEM EM ATÉ ' + CONFIG.DIGEST_WARN_DAYS + ' DIAS (' + soon.length + ')',
    soon.length ? soon.map(line).join('\n') : 'nenhum',
    CONFIG.APP_URL ? '\nAbrir o painel: ' + CONFIG.APP_URL : '',
  ].join('\n');

  const cell = 'padding:6px 10px;border-bottom:1px solid #e2e8f0';
  const row = function (i, color) {
    const tagCell = CONFIG.APP_URL
      ? '<a href="' + CONFIG.APP_URL + '?tag=' + encodeURIComponent(i.tag) + '">' + i.tag + '</a>'
      : i.tag;
    return (
      '<tr><td style="' + cell + ';font-family:monospace">' + tagCell + '</td>' +
      '<td style="' + cell + '">' + i.equip + '</td>' +
      '<td style="' + cell + '">' + i.local + '</td>' +
      '<td style="' + cell + '">' + i.date + '</td>' +
      '<td style="' + cell + ';color:' + color + ';font-weight:bold">' + label(i) + '</td></tr>'
    );
  };
  const table = function (title, items, color) {
    if (!items.length) return '';
    return (
      '<h3 style="font-family:sans-serif;color:' + color + '">' + title + ' (' + items.length + ')</h3>' +
      '<table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;width:100%">' +
      '<tr style="background:#0b1121;color:#fff"><th align="left" style="padding:6px 10px">TAG</th>' +
      '<th align="left" style="padding:6px 10px">Equipamento</th>' +
      '<th align="left" style="padding:6px 10px">Local</th>' +
      '<th align="left" style="padding:6px 10px">Vencimento</th>' +
      '<th align="left" style="padding:6px 10px">Situação</th></tr>' +
      items.map(function (i) { return row(i, color); }).join('') +
      '</table>'
    );
  };

  const html =
    '<div style="max-width:760px">' +
    '<h2 style="font-family:sans-serif;color:#0b1121">Sentinel — resumo de ' + dateLabel + '</h2>' +
    table('Vencidos / bloqueados', expired, '#ef4444') +
    table('Vencem em até ' + CONFIG.DIGEST_WARN_DAYS + ' dias', soon, '#b45309') +
    '</div>';

  return { text: text, html: html, expired: expired, soon: soon };
}
