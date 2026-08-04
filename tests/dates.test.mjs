/**
 * Testes da lógica de datas — a origem dos dois bugs mais graves da versão
 * anterior: datas em ISO viravam "N/A" e datas exibidas saíam um dia atrás.
 *
 * Rodar: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dateKey, daysUntil, esc, formatBR, parseDate, toInputDate } from '../assets/js/utils.js';

describe('parseDate', () => {
  it('lê o formato brasileiro dd/mm/aaaa', () => {
    const d = parseDate('10/03/2025');
    assert.equal(d.getFullYear(), 2025);
    assert.equal(d.getMonth(), 2);
    assert.equal(d.getDate(), 10);
    assert.equal(d.getHours(), 0);
  });

  it('aceita d/m/aaaa sem zero à esquerda', () => {
    assert.equal(formatBR(parseDate('1/2/2025')), '01/02/2025');
  });

  it('lê aaaa-mm-dd (valor de <input type="date">)', () => {
    assert.equal(formatBR(parseDate('2025-03-10')), '10/03/2025');
  });

  it('lê ISO com hora sem perder o dia — o bug que zerava o status', () => {
    // Antes: split('/') não encontrava 3 partes, a data virava epoch 0 e o
    // equipamento aparecia como "N/A", fora de todos os filtros de status.
    assert.equal(formatBR(parseDate('2025-03-10T03:00:00.000Z')), '10/03/2025');
  });

  it('não desloca o dia por causa do fuso, em nenhuma direção', () => {
    // Planilha em UTC-3 (São Paulo) serializa a meia-noite como 03:00Z.
    assert.equal(formatBR(parseDate('2025-03-10T03:00:00.000Z')), '10/03/2025');
    // Planilha em UTC+1 serializa como 23:00Z do dia anterior.
    assert.equal(formatBR(parseDate('2025-03-09T23:00:00.000Z')), '10/03/2025');
    // Planilha em UTC-7 (padrão de scripts sem fuso definido).
    assert.equal(formatBR(parseDate('2025-03-10T07:00:00.000Z')), '10/03/2025');
  });

  it('aceita objetos Date e epoch', () => {
    assert.equal(formatBR(parseDate(new Date(2025, 2, 10, 15, 30))), '10/03/2025');
    assert.equal(formatBR(parseDate(new Date(2025, 2, 10).getTime())), '10/03/2025');
  });

  it('rejeita datas que não existem no calendário', () => {
    // new Date(2025, 1, 31) rolava silenciosamente para 03/03.
    assert.equal(parseDate('31/02/2025'), null);
    assert.equal(parseDate('32/01/2025'), null);
    assert.equal(parseDate('10/13/2025'), null);
  });

  it('trata valores vazios e marcadores de pendência', () => {
    ['', '-', 'N/A', 'PENDENTE', 'pendente', null, undefined].forEach((v) => {
      assert.equal(parseDate(v), null, `esperava null para ${JSON.stringify(v)}`);
    });
  });
});

describe('formatBR / toInputDate / dateKey', () => {
  it('formata para exibição e para o input HTML', () => {
    assert.equal(formatBR('2025-12-05'), '05/12/2025');
    assert.equal(toInputDate('05/12/2025'), '2025-12-05');
  });

  it('dateKey compara datas escritas em formatos diferentes', () => {
    assert.equal(dateKey('10/03/2025'), dateKey('2025-03-10T03:00:00.000Z'));
    assert.notEqual(dateKey('10/03/2025'), dateKey('11/03/2025'));
    assert.equal(dateKey('PENDENTE'), '');
  });

  it('devolve string vazia quando não há data', () => {
    assert.equal(formatBR(null), '');
    assert.equal(formatBR('lixo'), '');
  });
});

describe('daysUntil', () => {
  const base = new Date(2025, 0, 10);

  it('conta dias inteiros à frente e atrás', () => {
    assert.equal(daysUntil(new Date(2025, 0, 10), base), 0);
    assert.equal(daysUntil(new Date(2025, 0, 20), base), 10);
    assert.equal(daysUntil(new Date(2025, 0, 1), base), -9);
  });

  it('não é afetado pelo horário de verão', () => {
    // Intervalo que cruza mudanças de fuso continua fechando em dias inteiros.
    assert.equal(daysUntil(new Date(2025, 11, 10), new Date(2025, 0, 10)), 334);
  });
});

describe('esc', () => {
  it('neutraliza HTML vindo da planilha', () => {
    assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(esc(`Válvula d'água "1/2"`), 'Válvula d&#39;água &quot;1/2&quot;');
  });

  it('não imprime "null"/"undefined" na tela', () => {
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
  });
});
