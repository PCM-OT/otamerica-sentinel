
export interface Equipment {
  internalId?: string; // Identificador único gerado pelo frontend para garantir renderização correta
  item: string;
  tag: string;
  tagAnterior?: string;
  categoria: string;
  equipamento?: string;
  especificacao?: string;
  fabricante?: string;
  dimensoes?: string;
  idMalao?: string;
  ordemEnvio?: string;
  dataCertificacao?: string;
  dataCertificacaoTimestamp?: number;
  dataValidade?: string;
  dataValidadeTimestamp?: number;
  // Manometro specific
  numSerie?: string;
  modelo?: string;
  fluido?: string;
  faixaIndicacao?: string;
  glicerina?: string;
  posicaoConexao?: string;
  tipoConexao?: string;
  diametroConexao?: string;
  diametroCaixa?: string; // Alterado de diametroMostrador para coincidir com backend
  materialConexao?: string;
  materialCaixa?: string;
  equipAssociado?: string;
  funcao?: string;
  dataCalibracao?: string;
  dataProximaCalibracao?: string;
  dataCalibracaoTimestamp?: number;
  dataProximaCalibracaoTimestamp?: number;
  // Common
  numCertificado?: string;
  linkCertificado?: string;
  resultado: string;
  observacoes?: string;
  motivoReprovacao?: string;
  local?: string;
  localizacao?: string;
  // Status logic
  excluido: string; // "SIM" | "NÃO"
  activeState?: string; // Derived
  status?: 'Ativo' | 'Reprovado' | 'Obsoleto';
  // Additional props from DEMAIS
  dataInspecao?: string;
  dataProximaInspecao?: string;
}

export type ViewType = 'dashboard' | 'analytics' | 'register' | 'edit' | 'export' | 'rejected' | 'obsolete' | 'bulk-qr' | 'suggestions' | 'manual' | 'review-suggestions';

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'textarea' | 'url';
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export const FORM_CONFIG: Record<string, FormField[]> = {
  'NR-10': [
      { name: 'tag', label: 'TAG', type: 'text', required: true },
      { name: 'tagAnterior', label: 'TAG Anterior', type: 'text' },
      { name: 'equipamento', label: 'Equipamento', type: 'text', required: true },
      { name: 'especificacao', label: 'Especificação/Modelo', type: 'text' },
      { name: 'fabricante', label: 'Fabricante', type: 'text' },
      { name: 'dimensoes', label: 'Dimensões', type: 'text' },
      { name: 'idMalao', label: 'ID Malão', type: 'text' },
      { name: 'ordemEnvio', label: 'Ordem de Envio', type: 'text' },
      { name: 'dataCertificacao', label: 'Data Certificação', type: 'date', required: true },
      { name: 'dataValidade', label: 'Data Validade', type: 'date', required: true },
      { name: 'numCertificado', label: 'Nº Certificado', type: 'text' },
      { name: 'linkCertificado', label: 'Link do Certificado (URL)', type: 'url', placeholder: 'https://drive.google.com/...' },
      { name: 'resultado', label: 'Resultado', type: 'select', options: ['APROVADO', 'REPROVADO'] },
      { name: 'motivoReprovacao', label: 'Motivo Reprovação (se aplicável)', type: 'textarea' }
  ],
  'MANÔMETROS': [
      { name: 'tag', label: 'TAG', type: 'text', required: true },
      { name: 'tagAnterior', label: 'TAG Anterior', type: 'text' },
      { name: 'numSerie', label: 'Nº Série', type: 'text' },
      { name: 'modelo', label: 'Modelo', type: 'text' },
      { name: 'fabricante', label: 'Fabricante', type: 'text' },
      { name: 'fluido', label: 'Fluido', type: 'text' },
      { name: 'faixaIndicacao', label: 'Faixa de Indicação', type: 'text' },
      { name: 'glicerina', label: 'Glicerina', type: 'select', options: ['SIM', 'NÃO'] },
      { name: 'posicaoConexao', label: 'Posição Conexão', type: 'text' },
      { name: 'tipoConexao', label: 'Tipo Conexão', type: 'text' },
      { name: 'diametroConexao', label: 'Diâmetro Conexão', type: 'text' },
      { name: 'materialConexao', label: 'Material Conexão', type: 'text' },
      { name: 'diametroCaixa', label: 'Diâmetro Caixa', type: 'text' },
      { name: 'materialCaixa', label: 'Material Caixa', type: 'text' },
      { name: 'equipAssociado', label: 'Equip. Associado', type: 'text' },
      { name: 'local', label: 'Local', type: 'text' },
      { name: 'funcao', label: 'Função', type: 'select', options: ['Principal', 'Reserva'] },
      { name: 'dataCalibracao', label: 'Data Calibração', type: 'date', required: true },
      { name: 'dataProximaCalibracao', label: 'Data Próxima Calibração', type: 'date', required: true },
      { name: 'numeroCertificado', label: 'Nº Certificado', type: 'text' },
      { name: 'linkCertificado', label: 'Link do Certificado (URL)', type: 'url', placeholder: 'https://drive.google.com/...' },
      { name: 'resultado', label: 'Resultado', type: 'select', options: ['APROVADO', 'REPROVADO'], required: true },
      { name: 'observacoes', label: 'Observações', type: 'textarea' }
  ],
  'DEMAIS EQUIPAMENTOS': [
      { name: 'tag', label: 'TAG', type: 'text', required: true },
      { name: 'tagAnterior', label: 'TAG Anterior', type: 'text' },
      { name: 'modelo', label: 'Modelo', type: 'text' },
      { name: 'diametroConexao', label: 'Diâmetro Conexão', type: 'text' },
      { name: 'local', label: 'Local', type: 'text' },
      { name: 'dataInspecao', label: 'Data Inspeção', type: 'date', required: true },
      { name: 'dataProximaInspecao', label: 'Data Próxima Inspeção', type: 'date', required: true },
      { name: 'numeroCertificado', label: 'Nº Certificado', type: 'text' },
      { name: 'linkCertificado', label: 'Link do Certificado (URL)', type: 'url', placeholder: 'https://drive.google.com/...' },
      { name: 'resultado', label: 'Resultado', type: 'select', options: ['APROVADO', 'REPROVADO'], required: true },
      { name: 'observacoes', label: 'Observações', type: 'textarea' }
  ]
};