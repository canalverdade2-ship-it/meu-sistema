import { ReactNode } from 'react';

export type ContratosSubDomainTab = 
  | 'crm_clientes'
  | 'contratos'
  | 'hub_empresas'
  | 'area_vip'
  | 'gsa_saude'
  | 'gsa_seguros'
  | 'atendimento_sac';

export interface ContratosTelemetry {
  totalClientes: number;
  clientesAtivos: number;
  novosClientesMes: number;
  clientesInadimplentes: number;
  totalSaldoCarteira: number;
  totalVipMembers: number;
  contratosAtivos: number;
  contratosAguardandoAssinatura: number;
  mrrSobGestao: number;
  empresasB2B: number;
  saudeVidasAtivas: number;
  segurosApolicesAtivas: number;
  sinistrosEmAberto: number;
  ticketsAbertos: number;
  ticketsSlaCritico: number;
}

// ─────────────────────────────────────────────────────────────
// 1. CRM CLIENTES 360º
// ─────────────────────────────────────────────────────────────
export type TipoPessoa = 'pf' | 'pj';
export type ClienteStatus = 'ativo' | 'inativo' | 'pendente' | 'bloqueado';

export interface ClienteDocumentoItem {
  id: string;
  tipo_documento: string;
  nome_arquivo: string;
  arquivo_url: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  criado_em: string;
  observacao?: string;
}

export interface ClienteExtratoItem {
  id: string;
  data: string;
  tipo: 'credito' | 'debito' | 'estorno' | 'saque' | 'bonus' | 'cashback';
  descricao: string;
  valor: number;
  saldo_resultante?: number;
}

export interface ClienteFaturaItem {
  id: string;
  codigo_fatura: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado' | 'em_cobranca';
  link_pagamento?: string;
}

export interface ClienteOperacionalItem {
  id: string;
  tipo: 'orcamento' | 'ordem_servico' | 'ordem_compra' | 'ordem_assinatura' | 'emprestimo' | 'ticket';
  codigo: string;
  titulo: string;
  valor?: number;
  data: string;
  status: string;
  detalhes?: string;
}

export interface Cliente360Record {
  id: string;
  codigo_cliente: string;
  nome: string;
  tipo_pessoa: TipoPessoa;
  cpf?: string;
  cnpj?: string;
  email: string;
  telefone: string;
  status: ClienteStatus;
  data_cadastro: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  observacoes?: string;
  saldo_carteira: number;
  saldo_pontos: number;
  nivel_vip_id?: string;
  nivel_vip_nome?: string;
  carteira_bloqueada: boolean;
  pontos_bloqueados: boolean;
  pin_bloqueado?: boolean;
  total_gasto_acumulado: number;
  faturas_pendentes_count: number;
  faturas_pendentes_valor: number;
  tickets_abertos_count: number;
  contratos_ativos_count: number;
  documentos?: ClienteDocumentoItem[];
  extrato?: ClienteExtratoItem[];
  faturas?: ClienteFaturaItem[];
  historico_operacional?: ClienteOperacionalItem[];
}

// ─────────────────────────────────────────────────────────────
// 2. CONTRATOS & DOCUMENTOS DIGITAIS
// ─────────────────────────────────────────────────────────────
export type ContratoTipo = 
  | 'prestacao_servicos'
  | 'saas_recorrencia'
  | 'locacao_equipamentos'
  | 'emprestimo_credito'
  | 'plano_saude'
  | 'apolice_seguro'
  | 'b2b_corporate'
  | 'acordo_confidencialidade_nda';

export type ContratoStatus = 
  | 'em_elaboracao'
  | 'aguardando_assinatura'
  | 'ativo'
  | 'pendente_renovacao'
  | 'vencido'
  | 'suspenso'
  | 'cancelado';

export interface SignatarioItem {
  id: string;
  nome: string;
  email: string;
  cpf_cnpj: string;
  papel: 'contratante' | 'contratado' | 'testemunha' | 'avalista' | 'interveniente';
  status: 'pendente' | 'assinado' | 'recusado';
  data_assinatura?: string;
  ip_assinatura?: string;
  metodo_assinatura?: 'token_email' | 'whatsapp' | 'icp_brasil' | 'presencial';
}

export interface ContratoRecord {
  id: string;
  codigo_contrato: string;
  titulo: string;
  tipo: ContratoTipo;
  cliente_id: string;
  cliente_nome: string;
  cliente_documento: string;
  status: ContratoStatus;
  valor_mensal: number;
  valor_total: number;
  data_inicio: string;
  data_fim: string;
  renovacao_automatica: boolean;
  dias_para_vencimento?: number;
  arquivo_minuta_url?: string;
  arquivo_assinado_url?: string;
  signatarios: SignatarioItem[];
  termos_aditivos_count: number;
  observacoes?: string;
  clausulas_resumo?: string;
  criado_em: string;
  atualizado_em: string;
}

// ─────────────────────────────────────────────────────────────
// 3. HUB EMPRESAS / B2B CORPORATE
// ─────────────────────────────────────────────────────────────
export type B2BCondicaoPagamento = 'a_vista' | 'boleto_15dd' | 'boleto_30dd' | 'boleto_30_60dd' | 'faturamento_mensal';

export interface EmpresaB2BFilial {
  id: string;
  codigo_filial: string;
  nome_unidade: string;
  cnpj: string;
  cidade: string;
  estado: string;
  responsavel: string;
  telefone: string;
  status: 'ativo' | 'inativo';
}

export interface EmpresaB2BRecord {
  id: string;
  codigo_empresa: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual?: string;
  responsavel_legal: string;
  cargo_responsavel?: string;
  email_corporativo: string;
  telefone_corporativo: string;
  cidade: string;
  estado: string;
  endereco_completo: string;
  is_matriz: boolean;
  matriz_id?: string;
  filiais: EmpresaB2BFilial[];
  limite_credito_faturado: number;
  limite_credito_utilizado: number;
  condicao_pagamento: B2BCondicaoPagamento;
  desconto_corporativo_pct: number;
  sla_atendimento_horas: number;
  contratos_b2b_count: number;
  faturamento_mensal_medio: number;
  status: 'ativo' | 'em_analise' | 'bloqueado' | 'inativo';
  observacoes?: string;
  data_cadastro: string;
}

// ─────────────────────────────────────────────────────────────
// 4. ÁREA VIP & MEMBROS
// ─────────────────────────────────────────────────────────────
export type NivelVipId = 'bronze' | 'prata' | 'ouro' | 'diamante' | 'black';

export interface NivelVipConfig {
  id: NivelVipId;
  nome: string;
  pontos_minimos: number;
  gasto_minimo_anual: number;
  cashback_pct: number;
  desconto_servicos_pct: number;
  prioridade_atendimento_minutos: number;
  frete_gratis_loja: boolean;
  concierge_dedicado: boolean;
  cor_badge: string;
  cor_texto: string;
  visual_style: string;
  total_membros_ativos: number;
}

export interface VipMemberRecord {
  id: string;
  cliente_id: string;
  nome: string;
  email: string;
  telefone: string;
  nivel_vip: NivelVipId;
  nivel_nome: string;
  pontos_acumulados: number;
  total_gasto_ano: number;
  data_adesao_vip: string;
  data_renovacao_nivel: string;
  concierge_responsavel?: string;
  status: 'ativo' | 'em_risco_queda' | 'suspenso' | 'expirado';
  beneficios_utilizados_mes: number;
  voucher_cortesia_disponivel?: boolean;
}

// ─────────────────────────────────────────────────────────────
// 5. GSA SAÚDE & CONVÊNIOS
// ─────────────────────────────────────────────────────────────
export type SaudeTipoPlano = 'individual' | 'familiar' | 'pme' | 'coletivo_adesao' | 'odontologico';
export type SaudeStatusContrato = 'em_cotacao' | 'proposta_emitida' | 'em_implantacao' | 'ativo' | 'suspenso' | 'cancelado';

export interface SaudeBeneficiario {
  id: string;
  nome: string;
  cpf: string;
  data_nascimento: string;
  parentesco: 'titular' | 'conjuge' | 'filho(a)' | 'pai/mae' | 'dependente';
  numero_carteirinha?: string;
  carencia_restante_dias: number;
}

export interface SaudeRecord {
  id: string;
  codigo_proposta_contrato: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_documento: string;
  operadora_nome: string;
  nome_plano: string;
  tipo_plano: SaudeTipoPlano;
  coparticipacao: boolean;
  acomodacao: 'enfermaria' | 'apartamento' | 'vip';
  abrangencia: 'regional' | 'estadual' | 'nacional';
  vidas_count: number;
  valor_mensalidade: number;
  comissao_prevista: number;
  comissao_status: 'prevista' | 'confirmada' | 'recebida' | 'cancelada';
  status: SaudeStatusContrato;
  data_inicio: string;
  data_reajuste_anual: string;
  beneficiarios: SaudeBeneficiario[];
  observacoes?: string;
}

// ─────────────────────────────────────────────────────────────
// 6. GSA SEGUROS & SINISTROS
// ─────────────────────────────────────────────────────────────
export type SeguroRamo = 'auto' | 'vida' | 'residencial' | 'empresarial' | 'fianca_locaticia' | 'responsabilidade_civil' | 'transporte_carga';
export type SeguroStatus = 'em_cotacao' | 'proposta' | 'emitida' | 'vigente' | 'em_sinistro' | 'renovacao' | 'cancelada';
export type SinistroStatus = 'comunicado' | 'documentacao_pendente' | 'vistoria_realizada' | 'em_analise_seguradora' | 'indenizado' | 'recusado' | 'liquidado';

export interface SinistroItem {
  id: string;
  codigo_sinistro: string;
  data_ocorrencia: string;
  descricao: string;
  valor_reclamado: number;
  valor_indenizado?: number;
  franquia_paga: boolean;
  status: SinistroStatus;
  boletim_ocorrencia_url?: string;
  laudo_pericial_url?: string;
  atualizado_em: string;
}

export interface SeguroRecord {
  id: string;
  codigo_apolice: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_documento: string;
  seguradora_nome: string;
  ramo: SeguroRamo;
  objeto_segurado: string; // Ex: Honda Civic 2023, Galpão Matriz, Vida Titular
  importancia_segurada: number;
  premio_total: number;
  forma_pagamento: string;
  franquia_valor?: number;
  vigencia_inicio: string;
  vigencia_fim: string;
  status: SeguroStatus;
  comissao_corretagem: number;
  assistencia_24h_ativa: boolean;
  sinistros: SinistroItem[];
  observacoes?: string;
}

// ─────────────────────────────────────────────────────────────
// 7. ATENDIMENTO, SAC & TICKETS OMNICHANNEL
// ─────────────────────────────────────────────────────────────
export type TicketPrioridade = 'urgente' | 'alta' | 'normal' | 'baixa';
export type TicketCategoria = 'financeiro' | 'suporte_tecnico' | 'comercial' | 'contratos' | 'sinistro' | 'saude' | 'cancelamento' | 'outro';
export type TicketStatus = 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'resolvido' | 'cancelado';
export type TicketCanal = 'web_chat' | 'whatsapp' | 'email' | 'portal_cliente' | 'telefone';

export interface TicketMessageItem {
  id: string;
  ticket_id: string;
  autor_tipo: 'cliente' | 'atendente' | 'sistema';
  autor_nome: string;
  texto: string;
  anexo_url?: string;
  anexo_nome?: string;
  anexo_tipo?: string;
  criado_em: string;
  privado?: boolean;
}

export interface TicketSacRecord {
  id: string;
  protocolo: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_telefone: string;
  cliente_nivel_vip?: NivelVipId;
  assunto: string;
  descricao_inicial: string;
  categoria: TicketCategoria;
  prioridade: TicketPrioridade;
  status: TicketStatus;
  canal_origem: TicketCanal;
  sla_limite_horas: number;
  sla_data_limite: string;
  sla_vencido: boolean;
  atendente_id?: string;
  atendente_nome?: string;
  departamento: string;
  mensagens: TicketMessageItem[];
  satisfacao_avaliacao?: number; // 1 a 5
  criado_em: string;
  atualizado_em: string;
  fechado_em?: string;
}
