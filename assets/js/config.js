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

  /**
   * Dias de antecedência para o status "ATENÇÃO", por categoria.
   * As chaves são os nomes das ABAS da planilha, que é o que o backend usa
   * como categoria.
   */
  WARN_DAYS: {
    default: 40,
    'NR-10': 40,
    'MANÔMETROS': 30,
    'DEMAIS EQUIPAMENTOS': 40,
  },

  /** Periodicidade padrão de calibração, em meses, por categoria. */
  PERIODICITY_MONTHS: {
    default: 12,
    'NR-10': 6,
    'MANÔMETROS': 12,
    'DEMAIS EQUIPAMENTOS': 12,
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
  APP_URL: 'otamerica-sentinel.vercel.app',

  /**
   * Recursos que dependem de suporte no backend. Deixe `false` enquanto o
   * Apps Script não tiver a parte correspondente: é melhor esconder o botão
   * do que oferecer algo que falha em silêncio.
   */
  FEATURES: {
    /** Anexar certificado ao cadastro (exige coluna LINK + upload no Drive). */
    attachments: false,
    /** Substituir base por CSV (não existe no modelo de histórico imutável). */
    csvImport: false,
  },

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

/**
 * Categorias = abas da planilha. Os nomes precisam bater exatamente com
 * SHEET_CONFIG no Apps Script, incluindo hífen e acentos.
 */
export const CATEGORIES = [
  { value: 'NR-10', label: 'NR-10 / Elétrica', short: 'NR-10' },
  { value: 'MANÔMETROS', label: 'Manômetro', short: 'MANÔMETROS' },
  { value: 'DEMAIS EQUIPAMENTOS', label: 'Demais Equipamentos', short: 'DEMAIS' },
];

/**
 * Nomes dos campos usados pelo backend (chaves de `data` no POST) que o app
 * precisa referenciar diretamente.
 */
export const FIELD = {
  tag: 'tag',
  certified: 'dataCertificacao',
  validity: 'dataValidade',
  periodicity: 'periodicidade',
  result: 'resultado',
};

export const STATUSES = [
  { value: 'ok', label: 'VÁLIDO', color: 'var(--st-ok)' },
  { value: 'warn', label: 'ATENÇÃO', color: 'var(--st-warn)' },
  { value: 'danger', label: 'VENCIDO', color: 'var(--st-danger)' },
  { value: 'none', label: 'SEM DATA', color: 'var(--st-neutral)' },
];

export const FORM_CONFIG = {
  'NR-10': [
    { id: 'tag', label: 'IDENTIFICAÇÃO (TAG)', type: 'text', placeholder: 'Ex: ALICA-01', required: true },
    { id: 'tagAnterior', label: 'TAG ANTERIOR', type: 'text', hint: 'Preencha quando o equipamento for reidentificado.' },
    { id: 'equipamento', label: 'EQUIPAMENTO', type: 'text', placeholder: 'Ex: Alicate Isolado' },
    { id: 'especificacao', label: 'ESPECIFICAÇÃO', type: 'text' },
    { id: 'fabricante', label: 'FABRICANTE', type: 'text' },
    { id: 'dimensoes', label: 'DIMENSÕES', type: 'text' },
    { id: 'idMalao', label: 'ID MALÃO', type: 'text' },
    { id: 'ordemEnvio', label: 'ORDEM DE ENVIO', type: 'text' },
    { id: 'lab', label: 'LABORATÓRIO / ORGANISMO CALIBRADOR', type: 'text', placeholder: 'Ex: RBC 0123' },
    { id: 'resultado', label: 'RESULTADO', type: 'select', options: RESULT_OPTIONS, blank: true },
    { id: 'incerteza', label: 'INCERTEZA DE MEDIÇÃO', type: 'text', placeholder: 'Ex: ± 0,05 bar (k=2)' },
    { id: 'ema', label: 'ERRO MÁXIMO ADMISSÍVEL', type: 'text', placeholder: 'Ex: ± 1% do fundo de escala' },
    { id: 'dataCertificacao', label: 'DATA DE CERTIFICAÇÃO', type: 'date' },
    { id: 'periodicidade', label: 'PERIODICIDADE (MESES)', type: 'number', hint: 'Usada para calcular a validade automaticamente.' },
    { id: 'dataValidade', label: 'DATA DE VALIDADE', type: 'date' },
    { id: 'numCertificado', label: 'Nº DO CERTIFICADO', type: 'text' },
  ],
  'MANÔMETROS': [
    { id: 'tag', label: 'TAG', type: 'text', placeholder: 'Ex: MAN-001', required: true },
    { id: 'tagAnterior', label: 'TAG ANTERIOR', type: 'text' },
    { id: 'numSerie', label: 'Nº SÉRIE', type: 'text' },
    { id: 'modelo', label: 'MODELO', type: 'text' },
    { id: 'fabricante', label: 'FABRICANTE', type: 'text' },
    { id: 'fluido', label: 'FLUIDO', type: 'text' },
    { id: 'faixaIndicacao', label: 'FAIXA DE INDICAÇÃO', type: 'text' },
    { id: 'glicerina', label: 'GLICERINA', type: 'select', options: ['SIM', 'NÃO'], blank: true },
    { id: 'posicaoConexao', label: 'POSIÇÃO DA CONEXÃO', type: 'text' },
    { id: 'tipoConexao', label: 'TIPO DE CONEXÃO', type: 'text', placeholder: 'Ex: BSP, NPT' },
    { id: 'diametroConexao', label: 'DIÂMETRO DA CONEXÃO', type: 'text', placeholder: 'Ex: 1/4"' },
    { id: 'materialConexao', label: 'MATERIAL DA CONEXÃO', type: 'text' },
    { id: 'diametroCaixa', label: 'DIÂMETRO DA CAIXA', type: 'text' },
    { id: 'materialCaixa', label: 'MATERIAL DA CAIXA', type: 'text' },
    { id: 'equipAssociado', label: 'EQUIP. ASSOCIADO', type: 'text' },
    { id: 'localizacao', label: 'LOCALIZAÇÃO', type: 'text' },
    { id: 'lab', label: 'LABORATÓRIO / ORGANISMO CALIBRADOR', type: 'text', placeholder: 'Ex: RBC 0123' },
    { id: 'resultado', label: 'RESULTADO', type: 'select', options: RESULT_OPTIONS, blank: true },
    { id: 'incerteza', label: 'INCERTEZA DE MEDIÇÃO', type: 'text', placeholder: 'Ex: ± 0,05 bar (k=2)' },
    { id: 'ema', label: 'ERRO MÁXIMO ADMISSÍVEL', type: 'text', placeholder: 'Ex: ± 1% do fundo de escala' },
    { id: 'dataCertificacao', label: 'DATA DE CERTIFICAÇÃO', type: 'date' },
    { id: 'periodicidade', label: 'PERIODICIDADE (MESES)', type: 'number', hint: 'Usada para calcular a validade automaticamente.' },
    { id: 'dataValidade', label: 'DATA DE VALIDADE', type: 'date' },
    { id: 'numCertificado', label: 'Nº DO CERTIFICADO', type: 'text' },
  ],
  'DEMAIS EQUIPAMENTOS': [
    { id: 'tag', label: 'TAG', type: 'text', required: true },
    { id: 'tagAnterior', label: 'TAG ANTERIOR', type: 'text' },
    { id: 'modelo', label: 'MODELO', type: 'text' },
    { id: 'informacoes', label: 'INFORMAÇÕES', type: 'text' },
    { id: 'localizacao', label: 'LOCALIZAÇÃO', type: 'text' },
    { id: 'lab', label: 'LABORATÓRIO / ORGANISMO CALIBRADOR', type: 'text', placeholder: 'Ex: RBC 0123' },
    { id: 'resultado', label: 'RESULTADO', type: 'select', options: RESULT_OPTIONS, blank: true },
    { id: 'incerteza', label: 'INCERTEZA DE MEDIÇÃO', type: 'text', placeholder: 'Ex: ± 0,05 bar (k=2)' },
    { id: 'ema', label: 'ERRO MÁXIMO ADMISSÍVEL', type: 'text', placeholder: 'Ex: ± 1% do fundo de escala' },
    { id: 'dataCertificacao', label: 'DATA DE CERTIFICAÇÃO', type: 'date' },
    { id: 'periodicidade', label: 'PERIODICIDADE (MESES)', type: 'number', hint: 'Usada para calcular a validade automaticamente.' },
    { id: 'dataValidade', label: 'DATA DE VALIDADE', type: 'date' },
    { id: 'numCertificado', label: 'Nº DO CERTIFICADO', type: 'text' },
  ],
};
