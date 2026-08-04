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
const backend = readFileSync(join(ROOT, 'backend/Code.gs.example'), 'utf8');

/** Lê o mapa FIELDS do Apps Script: { categoria: { campo: 'CABEÇALHO' } }. */
function backendFields() {
  const block = backend.match(/const FIELDS = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'FIELDS não encontrado no backend');

  const out = {};
  const categories = [...block[1].matchAll(/^ {2}(\w+): \[([\s\S]*?)^ {2}\],$/gm)];
  categories.forEach(([, cat, body]) => {
    out[cat] = {};
    [...body.matchAll(/\['([^']+)', '([^']+)'\]/g)].forEach(([, field, header]) => {
      out[cat][field] = header;
    });
  });
  return out;
}

const fields = backendFields();

describe('esquema do backend', () => {
  it('cobre as três categorias', () => {
    assert.deepEqual(Object.keys(fields).sort(), ['MANOMETRO', 'NR10', 'OUTROS']);
  });

  it('tem coluna para todo campo do formulário', () => {
    Object.entries(FORM_CONFIG).forEach(([cat, formFields]) => {
      formFields.forEach((f) => {
        assert.ok(
          fields[cat][f.id],
          `campo "${f.id}" existe no formulário de ${cat} mas não tem coluna no backend — ` +
            'o valor seria descartado em silêncio',
        );
      });
    });
  });

  it('inclui as colunas de controle usadas pela leitura e pela inativação', () => {
    const system = backend.match(/const SYSTEM_COLUMNS = \[([^\]]+)\]/);
    assert.ok(system, 'SYSTEM_COLUMNS não encontrado');
    assert.match(system[1], /'SITUAÇÃO'/);
    assert.match(system[1], /'LINK'/);
  });

  it('cria abas e colunas que faltarem, sem apagar as existentes', () => {
    assert.match(backend, /function ensureSheet\(/);
    assert.match(backend, /function ensureSchema\(/);
    // sheetFor passa por ensureSheet: toda escrita conserta o esquema.
    assert.match(backend, /function sheetFor\(cat\) \{[\s\S]*?ensureSheet\(/);
    // Colunas novas entram no fim; nada de limpar a aba.
    assert.doesNotMatch(backend, /ensureSheet[\s\S]{0,400}?deleteColumn/);
  });

  it('expõe as funções de instalação e de alerta', () => {
    ['function setup(', 'function installDigestTrigger(', 'function testDigest(', 'function sendExpiryDigest(']
      .forEach((fn) => assert.ok(backend.includes(fn), `${fn}...) ausente`));
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
