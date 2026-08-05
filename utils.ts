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

export function detectTwinManometers(allData: Equipment[]): TwinGroup[] {
  const manometers = allData.filter(item => 
      item.categoria === 'MANÔMETROS' && isReallyActive(item)
  );
  
  const twins: TwinGroup[] = [];
  const grouped: Record<string, Equipment[]> = {};
  
  manometers.forEach(m => {
      // Grouping key: Local + Range (Faixa Indicacao)
      const local = m.local || m.localizacao || 'Unknown';
      const faixa = m.faixaIndicacao || 'Unknown';
      const key = `${local}_${faixa}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
  });
  
  Object.values(grouped).forEach(group => {
      if (group.length === 2) {
          const principal = group.find(m => m.funcao === 'Principal');
          const reserva = group.find(m => m.funcao === 'Reserva');
          
          if (principal && reserva) {
              const principalExpiry = parseDateSafe(principal.dataProximaCalibracao);
              const reservaExpiry = parseDateSafe(reserva.dataProximaCalibracao);
              
              if (principalExpiry && reservaExpiry) {
                  const now = Date.now();
                  const daysUntilPrincipalExpiry = (principalExpiry - now) / (1000 * 60 * 60 * 24);
                  
                  twins.push({
                      principal,
                      reserva,
                      // Logic: Swap needed if Principal is expiring soon (<30 days) AND Reserva has more time left than Principal
                      needsSwap: daysUntilPrincipalExpiry < 30 && reservaExpiry > principalExpiry
                  });
              }
          }
      }
  });
  
  return twins;
}