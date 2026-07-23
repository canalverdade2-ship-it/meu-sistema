export type AffiliateStatus = 'ativo' | 'suspenso' | 'encerrado';
export type AffiliateCommissionStatus = 'pendente' | 'disponivel' | 'paga' | 'estornada';
export type AffiliatePayoutStatus = 'solicitado' | 'aprovado' | 'pago' | 'rejeitado' | 'cancelado';

export interface AffiliateProfile {
  id: string;
  codigoPublico: string;
  nomeDivulgacao: string;
  status: AffiliateStatus;
  pixTipo: string;
  pixChave: string;
  termosVersao?: string;
  termosAceitosEm?: string;
  criadoEm?: string;
}

export interface AffiliateProgram {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  percentual: number;
  baseTipo?: string;
  caminhoPadrao: string;
  janelaAtribuicaoDias: number;
  carenciaDias: number;
  saqueMinimo: number;
  pontosPorReal: number;
  ativo: boolean;
}

export interface AffiliateLink {
  id: string;
  programaId: string;
  programaCodigo: string;
  programaNome: string;
  codigo: string;
  destino: string;
  titulo: string;
  ativo: boolean;
  cliques: number;
  conversoes: number;
  comissaoTotal: number;
  criadoEm?: string;
}

export interface AffiliateCommission {
  id: string;
  programaCodigo: string;
  programaNome: string;
  origemTipo?: string;
  origemId?: string;
  baseElegivel: number;
  percentual: number;
  valor: number;
  status: AffiliateCommissionStatus;
  disponivelEm?: string;
  criadoEm?: string;
}

export interface AffiliatePayout {
  id: string;
  valor: number;
  status: AffiliatePayoutStatus;
  pixTipo?: string;
  pixChaveMascarada?: string;
  solicitadoEm?: string;
  pagoEm?: string;
  motivo?: string;
}

export interface AffiliateSummary {
  cliques: number;
  conversoes: number;
  totalPendente: number;
  totalDisponivel: number;
  totalPago: number;
  totalSolicitado: number;
  saqueMinimo: number;
  pontos?: number;
  saldoCarteira?: number;
  pontosTaxa?: number;
  pontosMinimo?: number;
  pontosAtivo?: boolean;
}

export interface AffiliateSnapshot {
  affiliate: AffiliateProfile | null;
  programs: AffiliateProgram[];
  links: AffiliateLink[];
  summary: AffiliateSummary;
  commissions: AffiliateCommission[];
  payouts: AffiliatePayout[];
}

export interface AffiliateProfileInput {
  nomeDivulgacao: string;
  pixTipo: string;
  pixChave: string;
}

export interface JoinAffiliateInput extends AffiliateProfileInput {
  termosVersao: string;
}

export interface CreateAffiliateLinkInput {
  programaCodigo: string;
  destino: string;
  titulo: string;
}
