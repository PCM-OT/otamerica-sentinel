/**
 * SENTINEL — Configuração central.
 *
 * Este é o único arquivo que precisa ser editado para apontar o app para
 * outro backend, mudar prazos de alerta ou trocar a senha da área ADM.
 */

export const CONFIG = {
  /**
   * URL do Web App do Google Apps Script (implantação /exec).
   *
   * ⚠️ SEGURANÇA: esta URL fica visível no navegador de qualquer visitante.
   * Enquanto o backend não exigir token/login, qualquer pessoa com o link
   * consegue ler e alterar a base. Ver README.md → "Segurança".
   */
  API_URL:
    'https://script.google.com/macros/s/AKfycbzIst_viCTXsj5WSZnC6Aq1Di8lWPv2uH1V2xRt3QtNWbxawsxpuBpcw0-Ac_sPBfjZ/exec',

  /**
   * Token compartilhado enviado em toda requisição (parâmetro `token`).
   * Deixe vazio enquanto o Apps Script não validar o token.
   * Ver backend/Code.gs.example para o lado do servidor.
   */
  API_TOKEN: '',

  /**
   * 'no-cors'  → não é possível ler a resposta do servidor. O app compensa
   *              recarregando a base e conferindo se a alteração foi aplicada.
   * 'cors'     → o Apps Script devolve JSON com cabeçalho CORS e o app passa
   *              a reportar o erro real. Prefira este modo (ver backend/).
   */
  WRITE_MODE: 'no-cors',

  /** Dias de antecedência para o status "ATENÇÃO", por categoria. */
  WARN_DAYS: {
    default: 40,
    NR10: 40,
    MANOMETRO: 30,
    OUTROS: 40,
  },

  /** Periodicidade padrão de calibração, em meses, por categoria. */
  PERIODICITY_MONTHS: {
    default: 12,
    NR10: 6,
    MANOMETRO: 12,
    OUTROS: 12,
  },

  /**
   * Um certificado com resultado REPROVADO invalida o equipamento mesmo que a
   * data de validade ainda esteja no futuro. Deixe `false` se a sua operação
   * tratar reprovação apenas como registro histórico.
   */
  BLOCK_ON_REJECTED: true,

  /** Identificação de quem altera a base. */
  AUTH: {
    /**
     * ID de cliente OAuth do Google. Vazio = login Google desativado e o app
     * apenas pergunta o nome do responsável (identificação, não autenticação).
     * Como criar: console.cloud.google.com → Credenciais → ID do cliente OAuth
     * → Aplicativo da Web → origem autorizada = a URL deste site.
     */
    GOOGLE_CLIENT_ID: '',
    /** Exige identificação antes de qualquer escrita. */
    REQUIRE_IDENTITY: true,
    /** Papel atribuído quando não há login Google: leitor | editor | admin. */
    DEFAULT_ROLE: 'editor',
  },

  /** Recarrega a base automaticamente (ms). 0 desativa. */
  REFRESH_INTERVAL_MS: 5 * 60 * 1000,

  /**
   * Senha da área ADM.
   * ⚠️ Isto é apenas conveniência de interface: a senha viaja no código-fonte
   * e NÃO protege os dados. A proteção real precisa estar no backend.
   */
  ADMIN_PASSCODE: 'Toil@2025',

  /** Planilha aberta pelo botão "ABRIR PLANILHA" da área ADM. */
  SHEET_URL: 'https://docs.google.com/spreadsheets/u/0/',

  /**
   * URL pública do app, usada nos QR Codes. Vazio = detecta automaticamente
   * a partir do endereço atual.
   */
  APP_URL: '',

  /** Quantos cards o painel renderiza por vez. */
  PAGE_SIZE: 60,

  /** Requisições simultâneas em operações de massa. */
  BULK_CONCURRENCY: 3,
};

/** Base para os links de QR Code. */
export function appBaseUrl() {
  if (CONFIG.APP_URL) return CONFIG.APP_URL;
  return window.location.origin + window.location.pathname;
}

/** Dias de antecedência do alerta amarelo para uma categoria. */
export function warnDaysFor(cat) {
  const key = String(cat || '').toUpperCase();
  return CONFIG.WARN_DAYS[key] ?? CONFIG.WARN_DAYS.default;
}

/** Periodicidade padrão de calibração (meses) para uma categoria. */
export function periodicityFor(cat) {
  const key = String(cat || '').toUpperCase();
  return CONFIG.PERIODICITY_MONTHS[key] ?? CONFIG.PERIODICITY_MONTHS.default;
}

/** Permissões por papel. A checagem real precisa estar no backend. */
export const ROLE_PERMISSIONS = {
  leitor: [],
  editor: ['write'],
  admin: ['write', 'admin'],
};

export const RESULT_OPTIONS = ['APROVADO', 'APROVADO COM RESTRIÇÃO', 'REPROVADO'];

export const CATEGORIES = [
  { value: 'NR10', label: 'NR-10 / Elétrica', short: 'NR10' },
  { value: 'MANOMETRO', label: 'Manômetro', short: 'MANÔMETROS' },
  { value: 'OUTROS', label: 'Demais Equipamentos', short: 'OUTROS' },
];

export const STATUSES = [
  { value: 'ok', label: 'VÁLIDO', color: 'var(--st-ok)' },
  { value: 'warn', label: 'ATENÇÃO', color: 'var(--st-warn)' },
  { value: 'danger', label: 'VENCIDO', color: 'var(--st-danger)' },
  { value: 'none', label: 'SEM DATA', color: 'var(--st-neutral)' },
];

export const FORM_CONFIG = {
  NR10: [
    { id: 'tag', label: 'IDENTIFICAÇÃO (TAG)', type: 'text', placeholder: 'Ex: ALICA-01', required: true },
    { id: 'equip', label: 'EQUIPAMENTO', type: 'text', placeholder: 'Ex: Alicate Isolado' },
    { id: 'model', label: 'ESPECIFICAÇÃO/MODELO', type: 'text' },
    { id: 'fab', label: 'FABRICANTE', type: 'text' },
    { id: 'dimensoes', label: 'DIMENSÕES', type: 'text' },
    { id: 'id_malao', label: 'ID MALÃO', type: 'text' },
    { id: 'ordem_envio', label: 'ORDEM DE ENVIO', type: 'text' },
    { id: 'lab', label: 'LABORATÓRIO / ORGANISMO CALIBRADOR', type: 'text', placeholder: 'Ex: RBC 0123' },
    { id: 'result', label: 'RESULTADO', type: 'select', options: RESULT_OPTIONS, blank: true },
    { id: 'incerteza', label: 'INCERTEZA DE MEDIÇÃO', type: 'text', placeholder: 'Ex: ± 0,05 bar (k=2)' },
    { id: 'ema', label: 'ERRO MÁXIMO ADMISSÍVEL', type: 'text', placeholder: 'Ex: ± 1% do fundo de escala' },
    { id: 'cert_date', label: 'DATA DE CERTIFICAÇÃO', type: 'date' },
    { id: 'periodicidade', label: 'PERIODICIDADE (MESES)', type: 'number', hint: 'Usada para calcular a validade automaticamente.' },
    { id: 'date', label: 'DATA DE VALIDADE', type: 'date' },
    { id: 'cert_num', label: 'Nº DO CERTIFICADO', type: 'text' },
  ],
  MANOMETRO: [
    { id: 'tag', label: 'TAG', type: 'text', placeholder: 'Ex: MAN-001', required: true },
    { id: 'n_serie', label: 'Nº SÉRIE', type: 'text' },
    { id: 'model', label: 'MODELO', type: 'text' },
    { id: 'fab', label: 'FABRICANTE', type: 'text' },
    { id: 'fluido', label: 'FLUIDO', type: 'text' },
    { id: 'faixa', label: 'FAIXA DE INDICAÇÃO', type: 'text' },
    { id: 'glicerina', label: 'GLICERINA', type: 'select', options: ['SIM', 'NÃO'] },
    { id: 'pos_conexao', label: 'POSIÇÃO DA CONEXÃO', type: 'text' },
    { id: 'tipo_conexao', label: 'TIPO DE CONEXÃO', type: 'text', placeholder: 'Ex: BSP, NPT' },
    { id: 'diam_conexao', label: 'DIÂMETRO DA CONEXÃO', type: 'text', placeholder: 'Ex: 1/4"' },
    { id: 'mat_conexao', label: 'MATERIAL DA CONEXÃO', type: 'text' },
    { id: 'diam_caixa', label: 'DIÂMETRO DA CAIXA', type: 'text' },
    { id: 'mat_caixa', label: 'MATERIAL DA CAIXA', type: 'text' },
    { id: 'equip_assoc', label: 'EQUIP. ASSOCIADO', type: 'text' },
    { id: 'local', label: 'LOCALIZAÇÃO', type: 'text' },
    { id: 'lab', label: 'LABORATÓRIO / ORGANISMO CALIBRADOR', type: 'text', placeholder: 'Ex: RBC 0123' },
    { id: 'result', label: 'RESULTADO', type: 'select', options: RESULT_OPTIONS, blank: true },
    { id: 'incerteza', label: 'INCERTEZA DE MEDIÇÃO', type: 'text', placeholder: 'Ex: ± 0,05 bar (k=2)' },
    { id: 'ema', label: 'ERRO MÁXIMO ADMISSÍVEL', type: 'text', placeholder: 'Ex: ± 1% do fundo de escala' },
    { id: 'cert_date', label: 'DATA DE CERTIFICAÇÃO', type: 'date' },
    { id: 'periodicidade', label: 'PERIODICIDADE (MESES)', type: 'number', hint: 'Usada para calcular a validade automaticamente.' },
    { id: 'date', label: 'DATA DE VALIDADE', type: 'date' },
    { id: 'cert_num', label: 'Nº DO CERTIFICADO', type: 'text' },
  ],
  OUTROS: [
    { id: 'tag', label: 'TAG', type: 'text', required: true },
    { id: 'equip', label: 'EQUIPAMENTO', type: 'text' },
    { id: 'model', label: 'MODELO', type: 'text' },
    { id: 'diam_conexao', label: 'DIÂMETRO DA CONEXÃO', type: 'text' },
    { id: 'local', label: 'LOCALIZAÇÃO', type: 'text' },
    { id: 'lab', label: 'LABORATÓRIO / ORGANISMO CALIBRADOR', type: 'text', placeholder: 'Ex: RBC 0123' },
    { id: 'result', label: 'RESULTADO', type: 'select', options: RESULT_OPTIONS, blank: true },
    { id: 'incerteza', label: 'INCERTEZA DE MEDIÇÃO', type: 'text', placeholder: 'Ex: ± 0,05 bar (k=2)' },
    { id: 'ema', label: 'ERRO MÁXIMO ADMISSÍVEL', type: 'text', placeholder: 'Ex: ± 1% do fundo de escala' },
    { id: 'cert_date', label: 'DATA DE CERTIFICAÇÃO', type: 'date' },
    { id: 'periodicidade', label: 'PERIODICIDADE (MESES)', type: 'number', hint: 'Usada para calcular a validade automaticamente.' },
    { id: 'date', label: 'DATA DE VALIDADE', type: 'date' },
    { id: 'cert_num', label: 'Nº DO CERTIFICADO', type: 'text' },
  ],
};
