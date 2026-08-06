/**
 * Preferências locais do usuário.
 *
 * O prazo de "Atenção" estava fixo em 45 dias, repetido em quatro pontos
 * (App.tsx duas vezes, o PDF de exportação e o EquipmentCard). Além de não
 * ser configurável, valores divergentes entre esses pontos passariam
 * despercebidos. Agora há uma fonte só.
 *
 * Fica no localStorage, por navegador: não há backend de preferências, e
 * gravar na planilha faria uma troca de limiar exigir permissão de escrita.
 */
import { useEffect, useState } from 'react';

const KEY = 'sentinel:warnDays';
const EVENT = 'sentinel:warnDaysChange';

export const DEFAULT_WARN_DAYS = 45;
export const MIN_WARN_DAYS = 1;
export const MAX_WARN_DAYS = 365;

/** Leitura direta, para código fora de componente (geração de PDF etc.). */
export function getWarnDays(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return DEFAULT_WARN_DAYS;
    const n = parseInt(raw, 10);
    // Valor inválido no storage cai no padrão em vez de virar NaN e fazer
    // toda comparação de status retornar false silenciosamente.
    return Number.isFinite(n) && n >= MIN_WARN_DAYS && n <= MAX_WARN_DAYS ? n : DEFAULT_WARN_DAYS;
  } catch {
    return DEFAULT_WARN_DAYS; // modo privado / storage bloqueado
  }
}

export function setWarnDays(days: number): number {
  const n = Math.min(MAX_WARN_DAYS, Math.max(MIN_WARN_DAYS, Math.round(days) || DEFAULT_WARN_DAYS));
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    /* sem persistência: a sessão atual ainda respeita o valor */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
  return n;
}

/** Reage à troca do limiar, inclusive feita em outra aba. */
export function useWarnDays(): number {
  const [days, setDays] = useState(getWarnDays);

  useEffect(() => {
    const sync = () => setDays(getWarnDays());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return days;
}
