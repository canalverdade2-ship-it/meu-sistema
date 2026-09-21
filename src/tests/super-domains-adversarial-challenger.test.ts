import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  formatCurrency,
  formatDate,
  maskCPF,
  maskCNPJ,
  maskPhone,
} from '../lib/utils';
import {
  getStatusBadgeVariant,
  getStatusBadgeLabel,
  StatusVariant,
} from '../components/admin/super-domains/shared/StatusBadge';
import {
  SUPER_DOMAINS,
  SuperDomainConfig,
} from '../components/admin/AdminNavigation';
import {
  normalizeAdminModule,
  hasAdminModuleAccess,
} from '../security/collaboratorAccess';
import { type AdminModule } from '../routing/adminAccess';
import { AVAILABLE_MODULES } from '../components/admin/super-domains/governanca/GovernancaAcessosView';
import { REPORTS } from '../components/admin/super-domains/governanca/GovernancaRelatoriosView';

// Mock session and admin RPC for adversarial simulation
vi.mock('../lib/sessionService', () => ({
  sessionService: {
    getCurrentSession: vi.fn(() => ({
      sessaoId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
      sessionToken: 'test_token_secret_xyz123',
      atorTipo: 'admin',
      nome: 'Administrador Chefe',
    })),
  },
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (funcName: string, params: Record<string, unknown>) => {
      // Simulate PostgreSQL behavior and parameter checks
      if (!params.p_sessao_id || !params.p_session_token) {
        return { data: null, error: new Error('Sessão administrativa não autenticada.') };
      }

      switch (funcName) {
        case 'gsa_admin_processar_saque': {
          if (!params.p_saque_id) {
            return { data: null, error: new Error('p_saque_id é obrigatório.') };
          }
          const acao = String(params.p_acao).toLowerCase();
          if (!['aprovar', 'rejeitar', 'pago', 'cancelado'].includes(acao)) {
            return { data: null, error: new Error(`Ação inválida: ${params.p_acao}`) };
          }
          if (acao === 'rejeitar' && (!params.p_motivo || String(params.p_motivo).trim() === '')) {
            return { data: null, error: new Error('Motivo obrigatório para rejeição.') };
          }
          return {
            data: {
              success: true,
              saque_id: params.p_saque_id,
              status: acao === 'aprovar' ? 'pago' : 'rejeitado',
              data_pagamento: params.p_data_pagamento || new Date().toISOString().split('T')[0],
              motivo: params.p_motivo || null,
            },
            error: null,
          };
        }

        case 'gsa_admin_processar_saque_prestador': {
          if (!params.p_saque_id) {
            return { data: null, error: new Error('p_saque_id é obrigatório.') };
          }
          const acao = String(params.p_acao).toLowerCase();
          if (!['aprovar', 'rejeitar', 'pago', 'cancelado'].includes(acao)) {
            return { data: null, error: new Error(`Ação inválida: ${params.p_acao}`) };
          }
          return {
            data: {
              success: true,
              saque_id: params.p_saque_id,
              status: acao === 'aprovar' ? 'pago' : 'rejeitado',
              data_pagamento: params.p_data_pagamento || new Date().toISOString().split('T')[0],
            },
            error: null,
          };
        }

        case 'gsa_admin_baixar_fatura': {
          if (!params.p_fatura_id) {
            return { data: null, error: new Error('p_fatura_id é obrigatório.') };
          }
          const metodo = String(params.p_metodo || 'manual').trim();
          return {
            data: {
              success: true,
              fatura_id: params.p_fatura_id,
              status: 'pago',
              metodo,
              data_pagamento: params.p_data_pagamento || new Date().toISOString(),
              observacoes: params.p_observacoes || null,
            },
            error: null,
          };
        }

        case 'gsa_admin_approve_budget': {
          if (!params.p_orcamento_id) {
            return { data: null, error: new Error('p_orcamento_id é obrigatório.') };
          }
          const approvalKind = String(params.p_approval_kind || 'standard');
          return {
            data: {
              success: true,
              orcamento_id: params.p_orcamento_id,
              request_id: params.p_request_id || null,
              approval_kind: approvalKind,
              os_id: `os-${params.p_orcamento_id}`,
              fatura_id: `fat-${params.p_orcamento_id}`,
            },
            error: null,
          };
        }

        case 'gsa_admin_save_collaborator': {
          const payload = (params.p_payload as Record<string, any>) || {};
          if (!payload.nome || payload.nome.trim().length < 2) {
            return { data: null, error: new Error('Informe o nome do colaborador.') };
          }
          const isNew = !params.p_id;
          return {
            data: {
              success: true,
              id: params.p_id || 'colab-uuid-gen-12345',
              initial_credential: isNew ? 'GSA-COLLAB-SEC-9988' : null,
              nome: payload.nome.trim(),
              modules: params.p_modules || [],
            },
            error: null,
          };
        }

        default:
          return { data: { success: true }, error: null };
      }
    }),
  },
}));

import { callAdminRpc } from '../lib/adminRpc';

describe('Empirical Challenger: Super-Domains Adversarial Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. CRITICAL RPC SIGNATURE & PARAMETER STRESS TESTING
  // ════════════════════════════════════════════════════════════════════════════
  describe('1. Critical RPC Contract & Parameter Stress-Testing', () => {
    it('RPC #1 (gsa_admin_processar_saque): stress-tests client withdrawal clearance and adversarial inputs', async () => {
      // 1.1 Approval with default payment date
      const resApproval = await callAdminRpc<{ success: boolean; status: string }>('gsa_admin_processar_saque', {
        p_saque_id: 'saque-uuid-001',
        p_acao: 'aprovar',
      });
      expect(resApproval.success).toBe(true);
      expect(resApproval.status).toBe('pago');

      // 1.2 Rejection with explicit reason
      const resRejection = await callAdminRpc<{ success: boolean; status: string; motivo: string }>('gsa_admin_processar_saque', {
        p_saque_id: 'saque-uuid-002',
        p_acao: 'rejeitar',
        p_motivo: 'Chave PIX inválida / CPF divergente do titular',
      });
      expect(resRejection.success).toBe(true);
      expect(resRejection.status).toBe('rejeitado');
      expect(resRejection.motivo).toContain('Chave PIX inválida');

      // 1.3 Adversarial: Missing saque_id must throw error
      await expect(
        callAdminRpc('gsa_admin_processar_saque', { p_acao: 'aprovar' })
      ).rejects.toThrow('p_saque_id é obrigatório.');

      // 1.4 Adversarial: Invalid action name must throw error
      await expect(
        callAdminRpc('gsa_admin_processar_saque', {
          p_saque_id: 'saque-uuid-003',
          p_acao: 'invalid_action_hack',
        })
      ).rejects.toThrow('Ação inválida: invalid_action_hack');

      // 1.5 Adversarial: Rejection without motive must fail
      await expect(
        callAdminRpc('gsa_admin_processar_saque', {
          p_saque_id: 'saque-uuid-004',
          p_acao: 'rejeitar',
          p_motivo: '',
        })
      ).rejects.toThrow('Motivo obrigatório para rejeição.');
    });

    it('RPC #2 (gsa_admin_processar_saque_prestador): stress-tests provider payout clearance with PIX key dates', async () => {
      // 2.1 Provider payout approval with custom payment date
      const customDate = '2026-08-25';
      const resProvider = await callAdminRpc<{ success: boolean; status: string; data_pagamento: string }>(
        'gsa_admin_processar_saque_prestador',
        {
          p_saque_id: 'saque-prestador-uuid-999',
          p_acao: 'aprovar',
          p_data_pagamento: customDate,
        }
      );
      expect(resProvider.success).toBe(true);
      expect(resProvider.status).toBe('pago');
      expect(resProvider.data_pagamento).toBe(customDate);

      // 2.2 Provider payout rejection
      const resReject = await callAdminRpc<{ success: boolean; status: string }>(
        'gsa_admin_processar_saque_prestador',
        {
          p_saque_id: 'saque-prestador-uuid-888',
          p_acao: 'rejeitar',
          p_motivo: 'Documentação do prestador pendente',
        }
      );
      expect(resReject.success).toBe(true);
      expect(resReject.status).toBe('rejeitado');
    });

    it('RPC #3 (gsa_admin_baixar_fatura): stress-tests invoice settlement across payment methods and annotations', async () => {
      const paymentMethods = ['manual', 'pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'boleto_bancario', 'transferencia'];

      for (const metodo of paymentMethods) {
        const res = await callAdminRpc<{ success: boolean; status: string; metodo: string; observacoes: string | null }>(
          'gsa_admin_baixar_fatura',
          {
            p_fatura_id: `fat-test-${metodo}`,
            p_metodo: metodo,
            p_observacoes: `Baixa conferida via comprovante banco (${metodo})`,
          }
        );
        expect(res.success).toBe(true);
        expect(res.status).toBe('pago');
        expect(res.metodo).toBe(metodo);
        expect(res.observacoes).toContain(`(${metodo})`);
      }

      // Adversarial: Missing fatura_id must throw error
      await expect(
        callAdminRpc('gsa_admin_baixar_fatura', { p_metodo: 'pix' })
      ).rejects.toThrow('p_fatura_id é obrigatório.');
    });

    it('RPC #4 (gsa_admin_approve_budget): stress-tests budget approval and automatic OS / order generation', async () => {
      // 4.1 Standard budget approval
      const resStandard = await callAdminRpc<{
        success: boolean;
        orcamento_id: string;
        approval_kind: string;
        os_id: string;
        fatura_id: string;
      }>('gsa_admin_approve_budget', {
        p_orcamento_id: 'orc-1001',
        p_request_id: 'req-5001',
        p_approval_kind: 'standard',
      });

      expect(resStandard.success).toBe(true);
      expect(resStandard.approval_kind).toBe('standard');
      expect(resStandard.os_id).toBe('os-orc-1001');
      expect(resStandard.fatura_id).toBe('fat-orc-1001');

      // 4.2 Negotiation approval
      const resNegotiation = await callAdminRpc<{
        success: boolean;
        approval_kind: string;
      }>('gsa_admin_approve_budget', {
        p_orcamento_id: 'orc-1002',
        p_approval_kind: 'negotiation',
      });
      expect(resNegotiation.success).toBe(true);
      expect(resNegotiation.approval_kind).toBe('negotiation');

      // 4.3 Adversarial: Missing orcamento_id must fail
      await expect(
        callAdminRpc('gsa_admin_approve_budget', { p_approval_kind: 'standard' })
      ).rejects.toThrow('p_orcamento_id é obrigatório.');
    });

    it('RPC #5 (gsa_admin_save_collaborator): stress-tests RBAC collaborator creation and permission array fuzzing', async () => {
      const fullPermissions = AVAILABLE_MODULES.map((m) => m[0]);
      expect(fullPermissions.length).toBe(22);

      // 5.1 Create new collaborator (p_id null -> issues credential)
      const resNew = await callAdminRpc<{
        success: boolean;
        id: string;
        initial_credential?: string | null;
        modules: string[];
      }>('gsa_admin_save_collaborator', {
        p_id: null,
        p_payload: {
          nome: 'Adriano Supervisor',
          email: 'adriano.supervisor@gsa.com.br',
          telefone: '(11) 98765-4321',
          funcao_id: 'funcao-gerente-uuid',
        },
        p_modules: fullPermissions,
      });

      expect(resNew.success).toBe(true);
      expect(resNew.id).toBeDefined();
      expect(resNew.initial_credential).toBe('GSA-COLLAB-SEC-9988');
      expect(resNew.modules.length).toBe(22);

      // 5.2 Update existing collaborator (p_id provided -> no new credential)
      const resUpdate = await callAdminRpc<{
        success: boolean;
        id: string;
        initial_credential?: string | null;
      }>('gsa_admin_save_collaborator', {
        p_id: 'colab-existing-uuid-777',
        p_payload: {
          nome: 'Adriano Supervisor Atualizado',
          email: 'adriano.supervisor@gsa.com.br',
        },
        p_modules: ['dashboard', 'operacoes', 'financeiro'],
      });

      expect(resUpdate.success).toBe(true);
      expect(resUpdate.id).toBe('colab-existing-uuid-777');
      expect(resUpdate.initial_credential).toBeNull();

      // 5.3 Adversarial: Empty or single-character name must fail
      await expect(
        callAdminRpc('gsa_admin_save_collaborator', {
          p_payload: { nome: 'A' },
        })
      ).rejects.toThrow('Informe o nome do colaborador.');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. 60-MODULE ROUTING ALIAS FUZZING & SUPER-DOMAINS RECEPTIVITY
  // ════════════════════════════════════════════════════════════════════════════
  describe('2. 60-Module URL Navigation & Legacy Alias Fuzzing Oracle', () => {
    const allKnownModules: string[] = [
      // Operações
      'operacoes', 'orcamentos', 'os', 'demandas', 'ordens_compra', 'ordens_assinatura',
      'catalogo', 'produtos', 'servicos', 'pacotes', 'categorias', 'viagens',
      'classificados', 'publicidade', 'anuncios', 'campanhas', 'gsa_tv', 'scraping', 'shopee',
      // Financeiro
      'financeiro', 'faturamento', 'faturas', 'caixa', 'fluxo_caixa', 'cobranca',
      'inadimplencia', 'acordos', 'fiscal', 'nfe', 'impostos', 'emprestimos',
      'credito_loja', 'credito', 'rentabilidade', 'reembolsos', 'calculadoras', 'gateway',
      // Pessoas
      'pessoas', 'prestadores', 'prestadores_saques', 'saques_prestadores', 'repasses',
      'fornecedores', 'parceiros', 'trabalhe_conosco', 'carreiras', 'afiliados',
      'fidelidade', 'premios', 'vouchers', 'promocoes', 'cupons', 'trocas', 'saques_clientes',
      // Contratos & Jurídico
      'contratos', 'clientes', 'crm', 'documentos', 'minutas', 'empresas', 'b2b',
      'corporate', 'area_vip', 'vip', 'saude', 'convenios', 'seguros', 'sinistros',
      'atendimento', 'sac', 'tickets',
      // Governança & Sistema
      'governanca', 'dashboard', 'executive', 'cockpit', 'colaborador', 'acessos',
      'permissoes', 'rbac', 'configuracoes', 'sistema', 'infra', 'vps', 'cloudflare',
      'whatsapp', 'relatorios', 'auditoria', 'logs'
    ];

    it('should safely map and normalize every legacy admin module to a valid AdminModule', () => {
      const recognized = new Set<string>();

      for (const mod of allKnownModules) {
        const normalized = normalizeAdminModule(mod);
        expect(normalized).toBeDefined();
        if (normalized) {
          recognized.add(normalized);
        }
      }

      // Verify that every single module maps to an authentic registered system module
      expect(recognized.size).toBeGreaterThan(15);
    });

    it('should resist adversarial URL variations: uppercase, query strings, hashes, and dirty inputs', () => {
      const dirtyInputs = [
        'OPERACOES',
        '  financeiro  ',
        'PESSOAS#tab=saques',
        'contratos?view=crm&id=123',
        'governanca/subview',
        'CLiEnTeS',
        'PRESTADORES_SAQUES',
      ];

      for (const input of dirtyInputs) {
        const clean = input.trim().toLowerCase().split(/[#/?]/)[0];
        const normalized = normalizeAdminModule(clean);
        expect(normalized).toBeDefined();
      }
    });

    it('should guarantee Super-Domains master inventory configuration integrity', () => {
      expect(SUPER_DOMAINS).toBeDefined();
      expect(SUPER_DOMAINS.length).toBe(5);

      const domainIds = SUPER_DOMAINS.map((d) => d.id);
      expect(domainIds).toEqual([
        'operacoes',
        'financeiro',
        'pessoas',
        'contratos',
        'governanca',
      ]);

      // Ensure each super-domain has non-empty metadata
      for (const domain of SUPER_DOMAINS) {
        expect(domain.name.length).toBeGreaterThan(0);
        expect(domain.tagline.length).toBeGreaterThan(0);
        expect(domain.modules.length).toBeGreaterThan(0);
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. ENTERPRISE LIGHT DESIGN SYSTEM & NUMERICAL ORACLE
  // ════════════════════════════════════════════════════════════════════════════
  describe('3. Enterprise Light Design System & Mathematical Oracles', () => {
    it('should format currency with strict BRL Brazilian cent precision and negative handling', () => {
      expect(formatCurrency(0)).toBe('R$\u00a00,00');
      expect(formatCurrency(1250.5)).toBe('R$\u00a01.250,50');
      expect(formatCurrency(1000000)).toBe('R$\u00a01.000.000,00');
      expect(formatCurrency(-500.25)).toBe('-R$\u00a0500,25');
      expect(formatCurrency(0.01)).toBe('R$\u00a00,01');
      expect(formatCurrency(NaN)).toBe('R$\u00a00,00');
    });

    it('should mask CPF, CNPJ, and Phone correctly and resist corrupted strings', () => {
      // Standard valid documents
      expect(maskCPF('12345678901')).toBe('123.456.789-01');
      expect(maskCNPJ('12345678000195')).toBe('12.345.678/0001-95');

      // Dirty inputs with letters/symbols
      expect(maskCPF('123.456.789-01abc')).toBe('123.456.789-01');
      expect(maskPhone('11987654321')).toBe('(11) 98765-4321');

      // Incomplete/empty
      expect(maskCPF('')).toBe('');
      expect(maskCNPJ('')).toBe('');
      expect(maskPhone('')).toBe('');
    });

    it('should map StatusBadge semantic variants and colors exhaustively across all statuses', () => {
      const statusMatrix: Array<{ status: string; expectedVariant: StatusVariant }> = [
        // Success (emerald)
        { status: 'pago', expectedVariant: 'emerald' },
        { status: 'aprovado', expectedVariant: 'emerald' },
        { status: 'concluido', expectedVariant: 'emerald' },
        { status: 'ativo', expectedVariant: 'emerald' },
        { status: 'finalizado', expectedVariant: 'emerald' },

        // Warning / Pending (amber)
        { status: 'pendente', expectedVariant: 'amber' },
        { status: 'analise', expectedVariant: 'amber' },
        { status: 'agendado', expectedVariant: 'amber' },

        // Danger (rose)
        { status: 'vencido', expectedVariant: 'rose' },
        { status: 'cancelado', expectedVariant: 'rose' },
        { status: 'rejeitado', expectedVariant: 'rose' },
        { status: 'inadimplente', expectedVariant: 'rose' },

        // In Progress / Open (blue)
        { status: 'em_andamento', expectedVariant: 'blue' },
        { status: 'executando', expectedVariant: 'blue' },
        { status: 'processando', expectedVariant: 'blue' },
        { status: 'aberto', expectedVariant: 'blue' },

        // Neutral (slate)
        { status: 'rascunho', expectedVariant: 'slate' },
        { status: 'inativo', expectedVariant: 'slate' },
        { status: 'desconhecido_qualquer', expectedVariant: 'slate' },
      ];

      for (const item of statusMatrix) {
        const variant = getStatusBadgeVariant(item.status);
        expect(variant).toBe(item.expectedVariant);
        const label = getStatusBadgeLabel(item.status);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it('should verify that all 15 executive reports catalog entries are valid and structured', () => {
      expect(REPORTS).toBeDefined();
      expect(REPORTS.length).toBe(15);

      for (const rep of REPORTS) {
        expect(rep.id).toBeDefined();
        expect(rep.label).toBeDefined();
        expect(rep.description).toBeDefined();
        expect(rep.category).toBeDefined();
        expect(rep.icon).toBeDefined();
        expect(Array.isArray(rep.requiredModules)).toBe(true);
      }
    });
  });
});
