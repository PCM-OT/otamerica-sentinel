#!/usr/bin/env node
/**
 * Carimba no service worker uma versão derivada do conteúdo do app.
 *
 * Por que existe: o navegador só instala um service worker novo se o ARQUIVO
 * sw.js mudar. Se o HTML/CSS/JS mudarem mas o sw.js continuar idêntico, quem
 * já usou o app segue com a versão em cache. Depender de lembrar de
 * incrementar a versão à mão é o jeito clássico de publicar uma correção que
 * nunca chega em ninguém.
 *
 * Aqui a versão é o hash do conteúdo: muda quando (e só quando) o app muda.
 *
 * Uso:
 *   npm run build          — reescreve sw.js com a versão atual
 *   npm run build -- --check  — não escreve; sai com 1 se estiver desatualizado
 *
 * No Vercel isto roda sozinho: vercel.json define buildCommand.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SW_PATH = join(ROOT, 'sw.js');

const swSource = readFileSync(SW_PATH, 'utf8');

/**
 * Os arquivos versionados são exatamente os que o service worker pré-carrega
 * (SHELL_ASSETS), lidos do próprio sw.js para as duas listas nunca divergirem.
 * O sw.js fica de fora: ele contém a versão, e incluí-lo criaria um ciclo.
 */
function shellAssets(source) {
  const block = source.match(/const SHELL_ASSETS = \[([\s\S]*?)\];/);
  if (!block) throw new Error('SHELL_ASSETS não encontrado em sw.js');
  return [...block[1].matchAll(/'([^']+)'/g)]
    .map((m) => m[1])
    .filter((p) => p !== './') // atalho para index.html, já na lista
    .sort();
}

function contentHash(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    try {
      hash.update(readFileSync(join(ROOT, file)));
    } catch {
      // Arquivo listado mas ausente: entra no hash como "faltando", para que
      // a situação apareça na próxima verificação em vez de passar batido.
      hash.update('__AUSENTE__');
      console.warn(`aviso: ${file} está no SHELL_ASSETS mas não existe`);
    }
  }
  return hash.digest('hex').slice(0, 12);
}

const files = shellAssets(swSource);
const version = `v${contentHash(files)}`;
const current = swSource.match(/const VERSION = '([^']+)';/);

if (!current) {
  console.error('erro: não encontrei a linha `const VERSION` em sw.js');
  process.exit(1);
}

const checkOnly = process.argv.includes('--check');

if (current[1] === version) {
  console.log(`sw.js já está em ${version} (${files.length} arquivos).`);
  process.exit(0);
}

if (checkOnly) {
  console.error(`sw.js está em ${current[1]}, mas o conteúdo corresponde a ${version}.`);
  console.error('Rode `npm run build` e faça commit do sw.js atualizado.');
  process.exit(1);
}

writeFileSync(SW_PATH, swSource.replace(/const VERSION = '[^']+';/, `const VERSION = '${version}';`));
console.log(`sw.js: ${current[1]} → ${version} (${files.length} arquivos)`);
