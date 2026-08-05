import { Equipment } from '../types';

// =========================================================================================
// CONFIGURAÇÃO DE CONEXÃO COM O BANCO DE DADOS (GOOGLE APPS SCRIPT)
// =========================================================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwcVBoZdvrpPPuwYrHdXupSH3Rb8OJeKqxlAL71M8O6QBxrHxlR5Bys-Uspb3QFAdS7/exec';

/**
 * Segredo compartilhado com o Apps Script (CONFIG.TOKEN em backend/Code.gs).
 *
 * Não é autenticação forte — ele viaja no navegador de qualquer visitante —
 * mas impede o acesso de quem apenas descobriu a URL do /exec. O backend faz
 * `if (!CONFIG.TOKEN) return` antes de validar, então enviar o token para uma
 * implantação que ainda não o exige é inofensivo.
 */
const API_TOKEN = 'x3X0VrCGQiZ-en4OxGNeKcVbSGB_Ptnp';

/** Acrescenta o token na query, preservando os parâmetros já montados. */
const withToken = (url: string): string =>
  API_TOKEN ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(API_TOKEN)}` : url;

/** Corpo do POST com o token junto, sem repetir o campo em cada chamada. */
const body = (payload: Record<string, any>): string =>
  JSON.stringify(API_TOKEN ? { ...payload, token: API_TOKEN } : payload);

// Função auxiliar para normalizar categorias vindas de digitação manual na planilha
const normalizeCategory = (raw: any): string => {
  if (!raw) return 'DEMAIS EQUIPAMENTOS';
  const str = String(raw).toUpperCase().trim();
  
  if (str.includes('NR') || str.includes('10') || str.includes('ELETR')) return 'NR-10';
  if (str.includes('MAN') || str.includes('PRESS') || str.includes('METER')) return 'MANÔMETROS';
  if (str.includes('OUTROS') || str.includes('GERAL') || str.includes('DIVERSOS')) return 'DEMAIS EQUIPAMENTOS';
  
  // Se já estiver correto ou for uma categoria nova, mantém, caso contrário agrupa em Demais
  return ['NR-10', 'MANÔMETROS', 'DEMAIS EQUIPAMENTOS'].includes(str) ? str : 'DEMAIS EQUIPAMENTOS';
};

export const api = {
  read: async (): Promise<{ success: boolean; data: Equipment[] }> => {
    try {
      const response = await fetch(withToken(`${API_URL}?action=read`), {
        method: 'GET',
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(
          `O servidor respondeu HTTP ${response.status}. ` +
            (response.status === 404
              ? 'A implantação do Apps Script não existe mais — a URL muda quando se cria uma "Nova implantação" em vez de publicar uma nova versão da existente.'
              : 'Confira a implantação do Apps Script.'),
        );
      }

      // Lido como texto primeiro: o Apps Script devolve HTML quando a
      // implantação está desatualizada ou exige login, e nesse caso
      // response.json() estoura "Unexpected token '<'", que não diz nada a
      // quem está usando o sistema.
      const raw = await response.text();
      if (raw.trim().startsWith('<')) {
        throw new Error(
          'O servidor devolveu uma página HTML em vez de dados. Em geral isso ' +
            'significa que a implantação do Apps Script está desatualizada, ou que ' +
            'o acesso não está como "Qualquer pessoa".',
        );
      }

      let json: any;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error('A resposta do servidor não é um JSON válido.');
      }

      if (json && json.success === false && json.error) {
        // Erro que o próprio Apps Script reportou (token inválido, por exemplo).
        throw new Error(json.error);
      }

      if (json.success && Array.isArray(json.data)) {
        const mappedData = json.data.map((item: any, index: number) => {
          // Normalização da Categoria para garantir funcionamento dos filtros
          const normalizedCat = normalizeCategory(item.category || item.categoria || item.CATEGORIA);

          // Adapter Robusto: Mapeia colunas da planilha para o sistema
          const newItem: any = {
            ...item, 
            
            // Geração de ID interno único para evitar bugs de renderização no React
            internalId: `eq-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            
            // Identificação
            tag: item.tag || item.TAG || item.patrimonio || item.PATRIMONIO || 'Sem TAG',
            tagAnterior: item.tagAnterior || item.tag_anterior || item.TAG_ANTERIOR || item.antigo || '',
            categoria: normalizedCat,
            equipamento: item.equipamento || item.descricao || item.modelo || item.DESCRICAO || 'Equipamento',
            local: item.local || item.localizacao || item.setor || item.LOCAL || item.area || '',
            
            // Especificações
            fabricante: item.fabricante || item.marca || item.FABRICANTE || '',
            modelo: item.modelo || item.MODELO || '',
            numSerie: item.numSerie || item.n_serie || item.num_serie || item.numero_serie || item.serie || '',
            especificacao: item.especificacao || item.especificacoes || item.capacidade || '',
            dimensoes: item.dimensoes || item.medidas || '',
            
            // Certificação
            numCertificado: item.numCertificado || item.n_certificado || item.numero_certificado || item.certificado || '',
            linkCertificado: item.linkCertificado || item.link || item.url_certificado || item.drive || '',
            resultado: (item.resultado || item.status_calibracao || item.laudo || 'APROVADO').toUpperCase(),
            observacoes: item.observacoes || item.obs || item.OBSERVACOES || '',
            
            // Controle
            excluido: String(item.excluido || item.obsoleto || item.inativo || 'NÃO').toUpperCase(),
          };

          // Mapeamento Inteligente de Datas baseada na Categoria Normalizada
          const rawDataCert = item.dataCertificacao || item.data_teste || item.data_calibracao || item.calibracao || item.inspecao;
          const rawDataVal = item.dataValidade || item.validade || item.data_vencimento || item.vencimento || item.proxima;

          if (normalizedCat === 'MANÔMETROS') {
            newItem.dataCalibracao = rawDataCert;
            newItem.dataProximaCalibracao = rawDataVal;
            // Detalhes Manômetros
            newItem.diametroCaixa = item.diametroCaixa || item.diametro_caixa || item.diametro || '';
            newItem.faixaIndicacao = item.faixaIndicacao || item.faixa || item.escala || item.range || '';
            newItem.fluido = item.fluido || 'Padrão';
          } else if (normalizedCat === 'DEMAIS EQUIPAMENTOS') {
            newItem.dataInspecao = rawDataCert;
            newItem.dataProximaInspecao = rawDataVal;
          } else {
            // NR-10
            newItem.dataCertificacao = rawDataCert;
            newItem.dataValidade = rawDataVal;
          }

          return newItem;
        });
        
        return { success: true, data: mappedData };
      }
      
      return json;
    } catch (error) {
      console.error('Erro de conexão:', error);
      throw error;
    }
  },

  /**
   * Valida a senha da área restrita NO SERVIDOR.
   *
   * O cliente envia só o que o usuário digitou; a senha correta fica no
   * Apps Script (CONFIG.ADMIN_PASSCODE) e nunca chega ao bundle. Isto barra
   * quem lê o código-fonte, mas não quem mexe no próprio navegador: a porta
   * real é restringir a implantação do Apps Script às contas da empresa.
   */
  checkAdmin: async (passcode: string): Promise<boolean> => {
    try {
      const response = await fetch(
        withToken(`${API_URL}?action=admin_check&passcode=${encodeURIComponent(passcode)}`),
        { method: 'GET', redirect: 'follow' },
      );
      if (!response.ok) return false;
      const json = await response.json();
      return json.success === true;
    } catch (error) {
      console.error('Falha ao validar a senha:', error);
      return false;
    }
  },

  create: async (data: any, category: string) => {
    const payload = { ...data };
    
    // Normaliza datas para envio
    if (category === 'MANÔMETROS') {
      if (data.dataCalibracao) payload.dataCertificacao = data.dataCalibracao;
      if (data.dataProximaCalibracao) payload.dataValidade = data.dataProximaCalibracao;
    } else if (category === 'DEMAIS EQUIPAMENTOS') {
      if (data.dataInspecao) payload.dataCertificacao = data.dataInspecao;
      if (data.dataProximaInspecao) payload.dataValidade = data.dataProximaInspecao;
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body({ action: 'create', data: payload, category }),
    });
    return response.json();
  },

  // Adicionado parâmetro 'category' para garantir que o script saiba qual aba atualizar
  delete: async (tag: string, reason: string, category: string) => {
    const response = await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body({ action: 'delete', tag, reason, category }),
    });
    return response.json();
  },

  suggestion: async (data: any) => {
    const response = await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body({ action: 'suggestion', data }),
    });
    return response.json();
  },

  // Novo método para buscar sugestões
  getSuggestions: async () => {
    // Assume que o backend responde a action=read_suggestions com { data: [...] }
    const response = await fetch(withToken(`${API_URL}?action=read_suggestions`), {
        method: 'GET',
        redirect: 'follow'
    });
    return response.json();
  },

  getHistory: async (tag: string) => {
    const response = await fetch(withToken(`${API_URL}?action=history&tag=${encodeURIComponent(tag)}`), {
        method: 'GET',
        redirect: 'follow'
    });
    return response.json();
  }
};
