/**
 * Guarda-corpos entre as três pontas do projeto: formulário (front), colunas
 * (backend) e versão do service worker (publicação).
 *
 * São os erros que não aparecem em teste de tela: um campo novo que o backend
 * descarta em silêncio, ou uma publicação que nunca chega em quem já usou o app.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { FORM_CONFIG } from '../assets/js/config.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = readFileSync(join(ROOT, 'backend/Code.gs'), 'utf8');

/**
 * Lê o SHEET_SCHEMA do Apps Script:
 * { categoria: { headers: [...], fields: { campo: índice } } }
 */
function backendSchema() {
  const out = {};
  const blocks = [...backend.matchAll(/^ {2}'([^']+)': \{\n([\s\S]*?)^ {2}\},$/gm)];
  assert.ok(blocks.length, 'SHEET_SCHEMA não encontrado no backend');

  blocks.forEach(([, cat, body]) => {
    const headers = body.match(/headers: \[([\s\S]*?)\],\n/);
    const fields = body.match(/fields: \{([\s\S]*?)\},\n/);
    if (!headers || !fields) return;

    out[cat] = {
      headers: [...headers[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
      fields: Object.fromEntries(
        [...fields[1].matchAll(/(\w+): (\d+)/g)].map(([, name, index]) => [name, Number(index)]),
      ),
    };
  });
  return out;
}

const schema = backendSchema();

describe('esquema do backend', () => {
  it('usa exatamente os nomes de aba que o app envia como categoria', () => {
    assert.deepEqual(Object.keys(schema).sort(), Object.keys(FORM_CONFIG).sort());
  });

  it('tem coluna para todo campo do formulário', () => {
    Object.entries(FORM_CONFIG).forEach(([cat, formFields]) => {
      formFields.forEach((f) => {
        assert.ok(
          schema[cat].fields[f.id] !== undefined,
          `campo "${f.id}" existe no formulário de ${cat} mas não tem coluna no backend — ` +
            'o valor seria descartado em silêncio',
        );
      });
    });
  });

  it('mantém o mapeamento posicional coerente com os cabeçalhos', () => {
    Object.entries(schema).forEach(([cat, { headers, fields }]) => {
      const indexes = Object.values(fields);
      assert.equal(new Set(indexes).size, indexes.length, `${cat}: dois campos apontam para a mesma coluna`);
      indexes.forEach((i) => {
        assert.ok(i < headers.length, `${cat}: índice ${i} além dos cabeçalhos declarados`);
      });
    });
  });

  it('preserva a ordem original das colunas do V33', () => {
    // O mapeamento é posicional: mexer na ordem existente reescreveria a
    // planilha inteira. Campos novos só podem entrar no fim.
    assert.deepEqual(
      ['item', 'tag', 'tagAnterior', 'equipamento', 'especificacao', 'fabricante'].map(
        (f) => schema['NR-10'].fields[f],
      ),
      [0, 1, 2, 3, 4, 5],
    );
    assert.equal(schema['NR-10'].fields.motivo, 14, 'MOTIVO era a última coluna do V33');
    assert.equal(schema['DEMAIS EQUIPAMENTOS'].fields.motivo, 11);
    assert.equal(schema['MANÔMETROS'].fields.motivo, 22);
  });

  it('tem as colunas de controle usadas pela leitura e pela exclusão', () => {
    Object.entries(schema).forEach(([cat, { fields }]) => {
      ['item', 'tag', 'excluido', 'motivo', 'dataValidade'].forEach((f) => {
        assert.ok(fields[f] !== undefined, `${cat}: falta a coluna ${f}`);
      });
    });
  });

  it('cria colunas que faltarem sem tocar nas existentes', () => {
    assert.match(backend, /function ensureColumns\(/);
    // Só escreve a partir da primeira coluna vazia.
    assert.match(backend, /for \(let c = filled \+ 1; c <= needed/);
    assert.doesNotMatch(backend, /deleteColumn|clearContents\(\)/);
  });

  it('expõe as funções de instalação e de alerta', () => {
    ['function setup(', 'function installDigestTrigger(', 'function testDigest(', 'function sendExpiryDigest(']
      .forEach((fn) => assert.ok(backend.includes(fn), `${fn}...) ausente`));
  });

  it('corrige as datas em texto dd/mm/aaaa', () => {
    // new Date('10/03/2025') devolveria 3 de outubro.
    assert.match(backend, /text\.match\(\/\^\(\\d\{1,2\}\)\\\/\(\\d\{1,2\}\)\\\/\(\\d\{4\}\)/);
    assert.match(backend, /getSpreadsheetTimeZone\(\)/);
  });

  it('protege as escritas com trava', () => {
    assert.match(backend, /LockService\.getScriptLock\(\)/);
    assert.match(backend, /lock\.waitLock\(/);
  });
});

describe('versão do service worker', () => {
  it('está sincronizada com o conteúdo do app', () => {
    // Se falhar: rode `npm run build` e faça commit do sw.js.
    // Sem isso, quem já abriu o app continua com a versão antiga em cache.
    execFileSync('node', [join(ROOT, 'scripts/build-sw.mjs'), '--check'], { stdio: 'pipe' });
  });

  it('pré-carrega todos os módulos que o app importa', () => {
    const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
    const precached = [...sw.matchAll(/'(\.\/assets\/js\/[^']+)'/g)].map((m) => m[1].replace('./', ''));

    const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const entry = index.match(/src="(assets\/js\/[^"]+)"/);
    assert.ok(entry, 'index.html não carrega nenhum módulo');
    assert.ok(precached.includes(entry[1]), `${entry[1]} não está no SHELL_ASSETS`);

    // Todo módulo importado por outro também precisa estar no precache, senão
    // o app quebra offline ao carregar uma tela ainda não visitada.
    precached.forEach((file) => {
      const source = readFileSync(join(ROOT, file), 'utf8');
      [...source.matchAll(/from '(\.[^']+)'/g)].forEach(([, rel]) => {
        const resolved = resolve(dirname(join(ROOT, file)), rel).replace(`${ROOT}/`, '');
        assert.ok(precached.includes(resolved), `${resolved} (importado por ${file}) não está no SHELL_ASSETS`);
      });
    });
  });
});
