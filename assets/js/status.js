/**
 * SENTINEL — Vocabulário de status.
 * Módulo isolado para que views e exportadores compartilhem os mesmos rótulos
 * sem depender umas das outras.
 */

export function statusLabel(health) {
  switch (health) {
    case 'danger':
      return 'VENCIDO';
    case 'warn':
      return 'ATENÇÃO';
    case 'ok':
      return 'VÁLIDO';
    default:
      return 'SEM DATA';
  }
}

export const statusColor = (health) =>
  ({
    danger: 'var(--st-danger)',
    warn: 'var(--st-warn)',
    ok: 'var(--st-ok)',
  })[health] || 'var(--st-neutral)';

/** Cor RGB para os PDFs (jsPDF não entende variáveis CSS). */
export const statusRgb = (health) =>
  ({
    danger: [239, 68, 68],
    warn: [245, 158, 11],
    ok: [16, 185, 129],
  })[health] || [100, 116, 139];

/** Texto do contador de dias exibido no card. */
export function countdown(item) {
  if (item.days === null) return { value: '—', label: 'SEM DATA' };
  if (item.days < 0) {
    const n = Math.abs(item.days);
    return { value: n, label: n === 1 ? 'DIA VENCIDO' : 'DIAS VENCIDO' };
  }
  if (item.days === 0) return { value: 'HOJE', label: 'VENCE HOJE' };
  return { value: item.days, label: item.days === 1 ? 'DIA RESTANTE' : 'DIAS RESTANTES' };
}
