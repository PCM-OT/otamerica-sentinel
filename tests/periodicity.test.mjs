/**
 * Testes de periodicidade e da regra de certificado reprovado.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CONFIG, periodicityFor } from '../assets/js/config.js';
import { isRejected, periodicityOf, recalcStatus, state } from '../assets/js/store.js';
import { addMonths, formatBR, parseDate, today } from '../assets/js/utils.js';

describe('addMonths', () => {
  it('soma meses simples', () => {
    assert.equal(formatBR(addMonths(parseDate('10/03/2025'), 12)), '10/03/2026');
    assert.equal(formatBR(addMonths(parseDate('10/03/2025'), 6)), '10/09/2025');
  });

  it('vira o ano corretamente', () => {
    assert.equal(formatBR(addMonths(parseDate('15/11/2025'), 3)), '15/02/2026');
  });

  it('não estoura o fim do mês', () => {
    // 31/01 + 1 mês = 28/02 (não 03/03, como faria setMonth direto).
    assert.equal(formatBR(addMonths(parseDate('31/01/2025'), 1)), '28/02/2025');
    assert.equal(formatBR(addMonths(parseDate('31/03/2025'), 1)), '30/04/2025');
    // Ano bissexto.
    assert.equal(formatBR(addMonths(parseDate('31/01/2024'), 1)), '29/02/2024');
  });

  it('aceita string e devolve meia-noite local', () => {
    const d = addMonths('01/01/2025', 12);
    assert.equal(d.getHours(), 0);
    assert.equal(formatBR(d), '01/01/2026');
  });

  it('devolve null para entrada inválida', () => {
    assert.equal(addMonths('PENDENTE', 12), null);
    assert.equal(addMonths('10/03/2025', 'abc'), null);
    assert.equal(addMonths(null, 12), null);
  });
});

describe('periodicidade', () => {
  it('usa o padrão da categoria quando o equipamento não define', () => {
    assert.equal(periodicityFor('NR10'), 6);
    assert.equal(periodicityFor('MANOMETRO'), 12);
    assert.equal(periodicityFor('CATEGORIA-NOVA'), CONFIG.PERIODICITY_MONTHS.default);
  });

  it('o valor do equipamento tem prioridade', () => {
    assert.equal(periodicityOf({ cat: 'NR10', periodicity: 24 }), 24);
    assert.equal(periodicityOf({ cat: 'NR10', periodicity: null }), 6);
  });
});

describe('certificado reprovado', () => {
  const record = (over) => ({
    tag: 'T',
    cat: 'NR10',
    result: '',
    activeState: 'Ativo',
    validUntil: null,
    days: null,
    health: 'none',
    blocked: false,
    ...over,
  });

  const future = () => {
    const d = today();
    d.setDate(d.getDate() + 300);
    return d;
  };

  it('invalida o equipamento mesmo dentro do prazo', () => {
    state.records = [record({ result: 'REPROVADO', validUntil: future() })];
    recalcStatus();
    assert.equal(state.records[0].health, 'danger');
    assert.equal(state.records[0].blocked, true);
  });

  it('"aprovado com restrição" não bloqueia', () => {
    state.records = [record({ result: 'APROVADO COM RESTRIÇÃO', validUntil: future() })];
    recalcStatus();
    assert.equal(state.records[0].health, 'ok');
    assert.equal(state.records[0].blocked, false);
  });

  it('reprovado sem data também fica bloqueado, não "sem data"', () => {
    state.records = [record({ result: 'REPROVADO', validUntil: null })];
    recalcStatus();
    assert.equal(state.records[0].health, 'danger');
  });

  it('isRejected é insensível a caixa', () => {
    assert.equal(isRejected({ result: 'reprovado' }), true);
    assert.equal(isRejected({ result: 'Aprovado' }), false);
    assert.equal(isRejected({ result: '' }), false);
  });
});

describe('renovação por periodicidade', () => {
  it('encadeia a partir da validade atual, sem intervalo descoberto', () => {
    const atual = parseDate('15/06/2025');
    assert.equal(formatBR(addMonths(atual, periodicityOf({ cat: 'NR10' }))), '15/12/2025');
  });

  it('a partir de hoje usa a periodicidade do equipamento', () => {
    const base = today();
    const esperado = addMonths(base, 24);
    assert.equal(
      formatBR(addMonths(base, periodicityOf({ cat: 'MANOMETRO', periodicity: 24 }))),
      formatBR(esperado),
    );
  });
});
