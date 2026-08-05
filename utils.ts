import { Equipment } from './types';

export function parseDateSafe(value: any): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') {
      // Excel serial check
      if (value > 25569 && value < 60000) {
          return new Date((value - 25569) * 86400000).getTime();
      }
      return value;
  }
  
  const str = String(value).trim();
  
  // Specific fix for YYYY-MM-DD strings to force Local Time instead of UTC
  // Using new Date('2024-05-10') treats it as UTC, which becomes May 9th 21:00 in Brazil (-3)
  // We want to force it to treat YYYY-MM-DD as T00:00:00 Local
  const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const isoMatch = str.match(isoDateRegex);
  if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1; // Month is 0-indexed
      const day = parseInt(isoMatch[3], 10);
      return new Date(year, month, day).getTime();
  }

  const formats = [
      /^(\d{2})\/(\d{2})\/(\d{4})$/, 
      /^(\d{2})-(\d{2})-(\d{4})$/ 
  ];
  
  for (let fmt of formats) {
      const match = str.match(fmt);
      if (match) {
          // DD/MM/YYYY
          const d = parseInt(match[1], 10);
          const m = parseInt(match[2], 10) - 1;
          const y = parseInt(match[3], 10);
          return new Date(y, m, d).getTime();
      }
  }
  
  // Fallback
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback.getTime();
}

export function formatDateBR(timestamp: number | null | undefined): string {
  if (!timestamp) return 'N/A';
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getStatusHierarchical(item: Equipment): 'Ativo' | 'Reprovado' | 'Obsoleto' {
  if (item.excluido === 'SIM') return 'Obsoleto';
  if (item.resultado?.toUpperCase().includes('REPROVADO')) return 'Reprovado';
  return 'Ativo';
}

export function getDaysUntilExpiry(item: Equipment): number | null {
  const nextDate = item.dataProximaCalibracao || item.dataProximaInspecao || item.dataValidade;
  const ts = parseDateSafe(nextDate);
  if (!ts) return null;
  
  const now = new Date();
  // Reset time to start of day for accurate day diff
  now.setHours(0,0,0,0);
  
  return Math.ceil((ts - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function isReallyActive(item: Equipment): boolean {
  return getStatusHierarchical(item) === 'Ativo';
}

export interface TwinGroup {
  principal: Equipment;
  reserva: Equipment;
  needsSwap: boolean;
}

/**
 * Quantos números separam um manômetro do seu par.
 *
 * A frota é de 60 manômetros em 30 posições: o 1 e o 31 servem ao mesmo
 * ponto, o 2 e o 32, e assim por diante. Enquanto um está instalado, o outro
 * é a reserva calibrada — é isso que garante que a posição nunca fique sem
 * manômetro válido. Quando o 02 se aproxima do vencimento, o 32 vai para
 * calibração e depois assume o lugar dele.
 */
export const TWIN_OFFSET = 30;

/** Dias de antecedência que disparam o aviso de troca. */
export const TWIN_SWAP_WARN_DAYS = 30;

/**
 * Número do manômetro dentro da frota, lido do fim da TAG.
 *
 * Aceita "MAN-02", "MAN 02", "02" ou "MANOMETRO-032": o que importa são os
 * dígitos finais. Devolve null quando não há número — TAG fora do padrão fica
 * de fora do pareamento em vez de ser pareada errado.
 */
export function manometerNumber(tag: string | undefined | null): number | null {
  const match = String(tag || '').trim().match(/(\d+)$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** O par de um número: 1..30 ↔ 31..60. Fora dessa faixa, não há par. */
export function twinNumber(n: number): number | null {
  if (n >= 1 && n <= TWIN_OFFSET) return n + TWIN_OFFSET;
  if (n > TWIN_OFFSET && n <= TWIN_OFFSET * 2) return n - TWIN_OFFSET;
  return null;
}

/**
 * Pares de manômetros e quais precisam de troca.
 *
 * O pareamento vem da numeração da TAG, e não de um campo "função": essa
 * coluna não existe na planilha, então a versão anterior desta função nunca
 * formava um par sequer — procurava funcao === 'Principal' num dado que o
 * backend não grava, e o aviso de troca jamais aparecia.
 *
 * Instalado = número baixo (1..30); reserva = o correspondente (31..60).
 */
export function detectTwinManometers(allData: Equipment[]): TwinGroup[] {
  const byNumber = new Map<number, Equipment>();

  allData.forEach(item => {
    if (item.categoria !== 'MANÔMETROS' || !isReallyActive(item)) return;
    const n = manometerNumber(item.tag);
    if (n === null || twinNumber(n) === null) return;
    // Havendo TAGs repetidas, fica a de vencimento mais distante: é o
    // certificado que vale hoje para aquela posição.
    const atual = byNumber.get(n);
    if (!atual || (getDaysUntilExpiry(item) ?? -Infinity) > (getDaysUntilExpiry(atual) ?? -Infinity)) {
      byNumber.set(n, item);
    }
  });

  const twins: TwinGroup[] = [];

  for (let n = 1; n <= TWIN_OFFSET; n++) {
    const principal = byNumber.get(n);
    const reserva = byNumber.get(n + TWIN_OFFSET);
    if (!principal || !reserva) continue;

    const diasPrincipal = getDaysUntilExpiry(principal);
    const diasReserva = getDaysUntilExpiry(reserva);

    twins.push({
      principal,
      reserva,
      // Troca quando o instalado está perto de vencer e a reserva dura mais.
      // Faltando data em um dos dois não há como comparar, e afirmar "troque"
      // sobre dado ausente seria pior do que não avisar.
      needsSwap:
        diasPrincipal !== null &&
        diasReserva !== null &&
        diasPrincipal <= TWIN_SWAP_WARN_DAYS &&
        diasReserva > diasPrincipal,
    });
  }

  return twins;
}
