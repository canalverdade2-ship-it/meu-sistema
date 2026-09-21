import { describe, expect, it } from 'vitest';
import {
  GovernancaSuperDomain,
  GovernancaExecutiveDashboard,
  GovernancaCollaboratorDashboard,
  GovernancaAcessosView,
  GovernancaConfiguracoesView,
  GovernancaInfraView,
  GovernancaRelatoriosView,
  GovernancaAuditoriaView,
  AVAILABLE_MODULES,
  REPORTS,
} from '../components/admin/super-domains/governanca';

describe('Governança, Auditoria & Configurações Super-Domain (SD5)', () => {
  describe('Super-Domain Components Export & Definition', () => {
    it('should export all 7 primary sub-views and the main orchestrator component', () => {
      expect(typeof GovernancaSuperDomain).toBe('function');
      expect(typeof GovernancaExecutiveDashboard).toBe('function');
      expect(typeof GovernancaCollaboratorDashboard).toBe('function');
      expect(typeof GovernancaAcessosView).toBe('function');
      expect(typeof GovernancaConfiguracoesView).toBe('function');
      expect(typeof GovernancaInfraView).toBe('function');
      expect(typeof GovernancaRelatoriosView).toBe('function');
      expect(typeof GovernancaAuditoriaView).toBe('function');
    });
  });

  describe('RBAC & Modular Permissions Matrix', () => {
    it('should contain all 22 granular system modules in AVAILABLE_MODULES', () => {
      expect(AVAILABLE_MODULES.length).toBe(22);
      const moduleKeys = AVAILABLE_MODULES.map(([key]) => key);

      expect(moduleKeys).toContain('cadastro');
      expect(moduleKeys).toContain('prestadores');
      expect(moduleKeys).toContain('fornecedores');
      expect(moduleKeys).toContain('operacoes');
      expect(moduleKeys).toContain('loja');
      expect(moduleKeys).toContain('classificados');
      expect(moduleKeys).toContain('viagens');
      expect(moduleKeys).toContain('saude');
      expect(moduleKeys).toContain('seguros');
      expect(moduleKeys).toContain('fidelidade');
      expect(moduleKeys).toContain('promocoes');
      expect(moduleKeys).toContain('atendimento');
      expect(moduleKeys).toContain('financeiro');
      expect(moduleKeys).toContain('cobranca');
      expect(moduleKeys).toContain('fiscal');
      expect(moduleKeys).toContain('emprestimos');
      expect(moduleKeys).toContain('credito_loja');
      expect(moduleKeys).toContain('afiliados');
      expect(moduleKeys).toContain('relatorios');
      expect(moduleKeys).toContain('configuracoes');
      expect(moduleKeys).toContain('demandas');
      expect(moduleKeys).toContain('sistema');
    });

    it('should have descriptive labels for all 22 modules', () => {
      AVAILABLE_MODULES.forEach(([key, label]) => {
        expect(key.length).toBeGreaterThan(0);
        expect(label.length).toBeGreaterThan(3);
      });
    });
  });

  describe('Executive Business Reports Catalog (15 Reports)', () => {
    it('should contain exactly 15 analytical business reports', () => {
      expect(REPORTS.length).toBe(15);
    });

    it('should include all required operational and financial report definitions', () => {
      const reportIds = REPORTS.map((r) => r.id);
      expect(reportIds).toEqual([
        'executivo',
        'financeiro',
        'rentabilidade',
        'cobranca',
        'emprestimos',
        'loja',
        'credito',
        'clientes',
        'os',
        'prestadores',
        'gamificacao',
        'suporte',
        'marketing',
        'fiscal',
        'operacional',
      ]);
    });

    it('should define valid categories and metadata for each report', () => {
      REPORTS.forEach((report) => {
        expect(report.id).toBeDefined();
        expect(report.label).toBeDefined();
        expect(report.description).toBeDefined();
        expect(report.category).toBeDefined();
        expect(Array.isArray(report.requiredModules)).toBe(true);
        expect(typeof report.icon).toBe('object');
      });
    });

    it('should designate adminOnly protection for sensitive executive and operational reports', () => {
      const executivo = REPORTS.find((r) => r.id === 'executivo');
      const operacional = REPORTS.find((r) => r.id === 'operacional');
      const clientes = REPORTS.find((r) => r.id === 'clientes');

      expect(executivo?.adminOnly).toBe(true);
      expect(operacional?.adminOnly).toBe(true);
      expect(clientes?.adminOnly).toBeUndefined();
    });
  });
});
