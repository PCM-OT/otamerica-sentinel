/**
 * Testes de status, filtros e ordenação.
 */

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  counts,
  filterItems,
  recalcStatus,
  sortItems,
  state,
  toggleFilterValue,
} from '../assets/js/store.js';
import { today } from '../assets/js/utils.js';

/** Data a N dias de hoje, sempre à meia-noite local. */
function inDays(n) {
  const d = today();
  d.setDate(d.getDate() + n);
  return d;
}

function record(overrides) {
  return {
    tag: 'T-1',
    equip: 'Equipamento',
    local: 'Oficina',
    cat: 'NR10',
    model: '',
    fab: '',
    certNum: '',
    result: '',
    file: '',
    activeState: 'Ativo',
    fullDetails: {},
    validUntil: null,
    dateLabel: '',
    days: null,
    health: 'none',
    ...overrides,
  };
}

function seed(records) {
  state.records = records;
  recalcStatus();
  state.latest = records;
}

describe('recalcStatus', () => {
  it('classifica válido, atenção e vencido', () => {
    seed([
      record({ tag: 'A', validUntil: inDays(120) }),
      record({ tag: 'B', validUntil: inDays(10) }),
      record({ tag: 'C', validUntil: inDays(-1) }),
    ]);
    assert.equal(state.records[0].health, 'ok');
    assert.equal(state.records[1].health, 'warn');
    assert.equal(state.records[2].health, 'danger');
  });

  it('vence hoje ainda conta como atenção, não como vencido', () => {
    seed([record({ tag: 'A', validUntil: inDays(0) })]);
    assert.equal(state.records[0].days, 0);
    assert.equal(state.records[0].health, 'warn');
  });

  it('respeita o limite de dias configurado por categoria', () => {
    // NR10 alerta com 40 dias; manômetro, com 30.
    seed([
      record({ tag: 'A', cat: 'NR10', validUntil: inDays(35) }),
      record({ tag: 'B', cat: 'MANOMETRO', validUntil: inDays(35) }),
    ]);
    assert.equal(state.records[0].health, 'warn');
    assert.equal(state.records[1].health, 'ok');
  });

  it('marca como "sem data" em vez de esconder o equipamento', () => {
    // Antes esses itens viravam "N/A" e sumiam de todos os filtros de status.
    seed([record({ tag: 'A', validUntil: null })]);
    assert.equal(state.records[0].health, 'none');
    assert.equal(state.records[0].days, null);
  });
});

describe('counts', () => {
  beforeEach(() => {
    seed([
      record({ tag: 'A', validUntil: inDays(90) }),
      record({ tag: 'B', validUntil: inDays(5) }),
      record({ tag: 'C', validUntil: inDays(-5) }),
      record({ tag: 'D', validUntil: null }),
      record({ tag: 'E', validUntil: inDays(90), activeState: 'Inativo' }),
    ]);
  });

  it('ignora inativos e soma todas as faixas', () => {
    const c = counts();
    assert.equal(c.total, 4);
    assert.equal(c.ok, 1);
    assert.equal(c.warn, 1);
    assert.equal(c.danger, 1);
    assert.equal(c.none, 1);
    // As quatro faixas fecham o total — nenhum equipamento fica invisível.
    assert.equal(c.ok + c.warn + c.danger + c.none, c.total);
  });

  it('calcula o percentual de conformidade', () => {
    assert.equal(counts().compliance, 25);
  });
});

describe('filterItems', () => {
  beforeEach(() => {
    seed([
      record({ tag: 'ALICA-01', equip: 'Alicate isolado', cat: 'NR10', local: 'Oficina', validUntil: inDays(90) }),
      record({ tag: 'MAN-001', equip: 'Manômetro', cat: 'MANOMETRO', local: 'Campo', validUntil: inDays(-2) }),
      record({ tag: 'OUT-9', equip: 'Torquímetro', cat: 'OUTROS', local: 'Campo', validUntil: null, activeState: 'Inativo' }),
    ]);
  });

  it('exclui inativos por padrão — inclusive nas exportações', () => {
    const view = filterItems({ status: new Set(['all']), cat: new Set(['all']), local: '', search: '' });
    assert.deepEqual(view.map((i) => i.tag), ['ALICA-01', 'MAN-001']);
  });

  it('filtra por status, categoria e local', () => {
    assert.equal(filterItems({ status: new Set(['danger']), search: '' }).length, 1);
    assert.equal(filterItems({ status: new Set(['all']), cat: new Set(['NR10']), search: '' }).length, 1);
    assert.equal(filterItems({ status: new Set(['all']), local: 'Campo', search: '' }).length, 1);
  });

  it('busca por TAG e também por descrição e local', () => {
    // A tela de exportação antes buscava apenas na TAG.
    assert.equal(filterItems({ status: new Set(['all']), search: 'alicate' }).length, 1);
    assert.equal(filterItems({ status: new Set(['all']), search: 'oficina' }).length, 1);
    assert.equal(filterItems({ status: new Set(['all']), search: 'man-001' }).length, 1);
  });
});

describe('sortItems', () => {
  it('coloca os mais críticos primeiro e os sem data no fim', () => {
    seed([
      record({ tag: 'A', validUntil: inDays(30) }),
      record({ tag: 'B', validUntil: null }),
      record({ tag: 'C', validUntil: inDays(-10) }),
    ]);
    const ordered = sortItems(state.latest, { key: 'days', dir: 'asc' });
    assert.deepEqual(ordered.map((i) => i.tag), ['C', 'A', 'B']);
  });
});

describe('toggleFilterValue', () => {
  it('"todos" é exclusivo e a seleção múltipla se acumula', () => {
    const set = new Set(['all']);
    toggleFilterValue(set, 'ok');
    assert.deepEqual([...set], ['ok']);
    toggleFilterValue(set, 'warn');
    assert.deepEqual([...set].sort(), ['ok', 'warn']);
    toggleFilterValue(set, 'ok');
    assert.deepEqual([...set], ['warn']);
    toggleFilterValue(set, 'warn');
    assert.deepEqual([...set], ['all'], 'esvaziar volta para "todos"');
    toggleFilterValue(set, 'danger');
    toggleFilterValue(set, 'all');
    assert.deepEqual([...set], ['all']);
  });
});
