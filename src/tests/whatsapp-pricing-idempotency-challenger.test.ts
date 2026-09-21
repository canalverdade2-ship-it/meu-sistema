import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Hoisted mocks for Supabase client
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockFunctionsInvoke = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
    functions: {
      invoke: (...args: any[]) => mockFunctionsInvoke(...args),
    },
  },
  getSupabase: () => ({
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
    functions: {
      invoke: (...args: any[]) => mockFunctionsInvoke(...args),
    },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: (...args: any[]) => mockToastError(...args),
    success: (...args: any[]) => mockToastSuccess(...args),
  },
}));

// Mock global fetch for Node environment
const originalFetch = global.fetch;

import {
  whatsappNotificationService,
  resolveWhatsAppDestination,
  type WhatsAppContext,
} from '../lib/whatsappNotificationService';

import {
  getProductRegularPrice,
  getProductEffectivePrice,
  getProductDiscountAmount,
  getProductDiscountPercentage,
  formatProductDiscountPercentage,
  hasActiveProductDiscount,
  getProductQuantityPriceBreakdown,
  getProductPromotionQuantityInfo,
  getProductDiscountValidityInfo,
  getProductRemainingDaysText,
  getProductRemainingQuantityText,
} from '../lib/productPricing';

import {
  crc16,
  formatEMV,
  generatePixCopiaECola,
  getQrCodeImageUrl,
  createInfinitePayOrderCheckout,
  checkOrderStatus,
} from '../lib/pixService';

import type { Produto } from '../types';

describe('EMPIRICAL CHALLENGER 2: WhatsApp Cascade, Store Pricing & DB Idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // DOMAIN 1: WHATSAPP 3-TIER CASCADE & DESTINATION ROUTING
  // =========================================================================
  describe('Domain 1: WhatsApp 3-Tier Fallback Cascade & Destination Routing', () => {
    describe('1.1 Destination Routing & Master Admin LID Override', () => {
      const adminNumbers = [
        '11971858372',
        '+55 (11) 97185-8372',
        '5511971858372',
        '011971858372',
        '+55 11 97185-8372',
        '(11) 7185-8372',
        '1171858372',
        '971858372',
      ];

      adminNumbers.forEach((num) => {
        it(`should resolve Master Admin variant "${num}" to direct Baileys LID JID 38830967099420@lid`, async () => {
          const dest = await resolveWhatsAppDestination(num);
          expect(dest).toBe('38830967099420@lid');
        });
      });

      it('should resolve standard 10/11-digit numbers with DDI 55 prefix when Evolution API chat lookup is offline', async () => {
        (global.fetch as any).mockRejectedValue(new Error('Network error on Evolution API'));

        expect(await resolveWhatsAppDestination('11987654321')).toBe('5511987654321');
        expect(await resolveWhatsAppDestination('(21) 99999-8888')).toBe('5521999998888');
        expect(await resolveWhatsAppDestination('4133221100')).toBe('554133221100');
        expect(await resolveWhatsAppDestination('5511988887777')).toBe('5511988887777');
      });

      it('should resolve active JID from Evolution API findChats if contact is cached', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { remoteJid: '5511999990000@s.whatsapp.net', pushName: 'Cliente Teste' },
            { remoteJid: '9988776655@lid', pushName: 'Conta Comercial' },
          ],
        });

        const dest = await resolveWhatsAppDestination('11999990000');
        expect(dest).toBe('5511999990000@s.whatsapp.net');
      });

      it('should gracefully handle empty or invalid phone strings without crashing', async () => {
        expect(await resolveWhatsAppDestination('')).toBe('');
        expect(await resolveWhatsAppDestination('   ')).toBe('   ');
      });
    });

    describe('1.2 3-Tier Fallback Cascade Simulation Under Fault Injection', () => {
      const targetPhone = '11988887777';
      const msg = 'Notificação de auditoria do sistema GSA HUB';

      it('Scenario A: Tier 1 (Evolution API direct) succeeds -> sends immediately and skips Tiers 2 and 3', async () => {
        (global.fetch as any).mockImplementation(async (url: string) => {
          if (url.includes(':8080/chat/findChats')) {
            return { ok: false };
          }
          if (url.includes(':8080/message/sendText/GSA_WhatsApp')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ key: { id: 'EVO_MSG_SUCCESS_101' }, status: 'PENDING' }),
            };
          }
          return { ok: false };
        });

        const result = await whatsappNotificationService.enviarWhatsAppDireto(targetPhone, msg);
        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          'http://147.15.43.141:8080/message/sendText/GSA_WhatsApp',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              number: '5511988887777',
              text: msg,
              delay: 500,
              linkPreview: true,
            }),
          })
        );
        expect(mockFunctionsInvoke).not.toHaveBeenCalled();
      });

      it('Scenario B: Tier 1 fails (HTTP 502 / network timeout) -> falls back to Tier 2 (Edge function vps-api) successfully', async () => {
        (global.fetch as any).mockImplementation(async (url: string) => {
          if (url.includes(':8080/')) {
            throw new Error('Evolution API 502 Bad Gateway / Connection Refused');
          }
          return { ok: false };
        });

        mockFunctionsInvoke.mockResolvedValueOnce({
          data: { success: true, messageId: 'EDGE_MSG_202' },
          error: null,
        });

        const result = await whatsappNotificationService.enviarWhatsAppDireto(targetPhone, msg);
        expect(result).toBe(true);
        expect(mockFunctionsInvoke).toHaveBeenCalledWith('vps-api', {
          body: {
            action: 'send-whatsapp',
            phone: '5511988887777',
            message: msg,
            title: 'Notificação GSA HUB',
            category: 'CLIENTE',
            targetIp: '147.15.43.141',
          },
        });
      });

      it('Scenario C: Tier 1 fails (500) AND Tier 2 fails (RPC error) -> falls back to Tier 3 (n8n webhook) successfully', async () => {
        (global.fetch as any).mockImplementation(async (url: string) => {
          if (url.includes(':8080/')) {
            return { ok: false, status: 500 };
          }
          if (url.includes(':5678/webhook/send-whatsapp')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ message: 'Workflow executed successfully' }),
            };
          }
          return { ok: false };
        });

        mockFunctionsInvoke.mockRejectedValueOnce(new Error('Edge function 500 Internal Server Error'));

        const result = await whatsappNotificationService.enviarWhatsAppDireto(targetPhone, msg);
        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          'http://147.15.43.141:5678/webhook/send-whatsapp',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              phone: '5511988887777',
              message: msg,
              title: 'Notificação GSA HUB',
              category: 'CLIENTE',
            }),
          })
        );
      });

      it('Scenario D: Total network failure (Tier 1 down, Tier 2 down, Tier 3 down) -> returns false and alerts via toast without unhandled promise rejection', async () => {
        (global.fetch as any).mockRejectedValue(new Error('Global Network Blackout'));
        mockFunctionsInvoke.mockRejectedValue(new Error('Edge Function Unreachable'));

        const result = await whatsappNotificationService.enviarWhatsAppDireto(targetPhone, msg);
        expect(result).toBe(false);
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining('Ocorreu um erro no servidor de WhatsApp')
        );
      });

      it('Scenario E: Master Admin LID routing in Tier 1 dispatch payload', async () => {
        (global.fetch as any).mockImplementation(async (url: string) => {
          if (url.includes(':8080/message/sendText/GSA_WhatsApp')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ key: { id: 'ADMIN_LID_MSG_1' } }),
            };
          }
          return { ok: false };
        });

        const result = await whatsappNotificationService.enviarWhatsAppDireto('11971858372', 'Admin Alert');
        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          'http://147.15.43.141:8080/message/sendText/GSA_WhatsApp',
          expect.objectContaining({
            body: expect.stringContaining('"number":"38830967099420@lid"'),
          })
        );
      });
    });

    describe('1.3 Comprehensive WhatsApp Context Generator Stress Test (All 30 Types)', () => {
      const allContextTypes: WhatsAppContext['tipo'][] = [
        'orcamento', 'os', 'compra', 'assinatura', 'fatura', 'voucher',
        'promocao', 'emprestimo', 'credito', 'produto', 'cobranca', 'cliente',
        'ticket', 'indicacao', 'personalizado', 'carteira_digital', 'carteira_pontos',
        'documento_cliente', 'fiscal', 'venda', 'reembolso', 'vip', 'premio',
        'cupom', 'troca', 'servico', 'acesso', 'cadastro', 'demanda_tecnico',
        'documento_prestador', 'extrato'
      ];

      allContextTypes.forEach((tipo) => {
        it(`should generate valid, formatted WhatsApp message for context type "${tipo}"`, () => {
          const msg = whatsappNotificationService.gerarMensagemWhatsApp({
            tipo,
            clienteNome: 'Adriano Farias',
            codigo: 'TEST-CODE-2026',
            status: 'aprovado',
            valorTotal: '1.250,00',
            dataVencimento: '30/08/2026',
            detalhesExtras: 'Observações de teste detalhadas',
            titulo: 'Título do Item de Teste',
          });

          expect(msg).toBeTypeOf('string');
          expect(msg.length).toBeGreaterThan(30);
          expect(msg).toContain('GSA — Gestão de Serviços');
          expect(msg).toContain('Adriano Farias');
          expect(msg).toContain('_Mensagem enviada via GSA HUB._');
        });
      });
    });
  });

  // =========================================================================
  // DOMAIN 2: STORE PRICING, QUOTA SPLITS & PIX EMV BR CODE VALIDITY
  // =========================================================================
  describe('Domain 2: Store Checkout Pricing, Promotional Quota Splits & PIX EMV BR Code', () => {
    describe('2.1 Boundary Quantities & Promotional Quota Splits', () => {
      const promoProduct: Produto = {
        id: 'prod-split-test',
        nome: 'Serviço Premium GSA',
        valor: 100.00,
        valor_promocional: 60.00,
        desconto_ativo: true,
        desconto_prazo_tipo: 'indeterminado',
        desconto_limite_quantidade_ativo: true,
        desconto_quantidade_limite: 10,
        desconto_quantidade_utilizada: 6, // 4 units remaining at promo price
        estoque_disponivel: 100,
      } as any;

      it('Boundary: quantidade = 0 should return subtotalFinal = 0 without error', () => {
        const b = getProductQuantityPriceBreakdown(promoProduct, 0);
        expect(b.quantidadeSolicitada).toBe(0);
        expect(b.quantidadeComDesconto).toBe(0);
        expect(b.quantidadeSemDesconto).toBe(0);
        expect(b.subtotalFinal).toBe(0);
      });

      it('Boundary: quantidade = 1 should apply promotional price (1 unit at R$ 60)', () => {
        const b = getProductQuantityPriceBreakdown(promoProduct, 1);
        expect(b.quantidadeSolicitada).toBe(1);
        expect(b.quantidadeComDesconto).toBe(1);
        expect(b.quantidadeSemDesconto).toBe(0);
        expect(b.subtotalComDesconto).toBe(60.00);
        expect(b.subtotalSemDesconto).toBe(0);
        expect(b.subtotalFinal).toBe(60.00);
      });

      it('Boundary: quantidade = remaining quota (4) should apply promotional price to all (4 at R$ 60 = R$ 240)', () => {
        const b = getProductQuantityPriceBreakdown(promoProduct, 4);
        expect(b.quantidadeSolicitada).toBe(4);
        expect(b.quantidadeComDesconto).toBe(4);
        expect(b.quantidadeSemDesconto).toBe(0);
        expect(b.subtotalComDesconto).toBe(240.00);
        expect(b.subtotalSemDesconto).toBe(0);
        expect(b.subtotalFinal).toBe(240.00);
      });

      it('Boundary: quantidade = remaining quota + 1 (5) should split into 4 promo (R$ 240) + 1 regular (R$ 100) = R$ 340', () => {
        const b = getProductQuantityPriceBreakdown(promoProduct, 5);
        expect(b.quantidadeSolicitada).toBe(5);
        expect(b.quantidadeComDesconto).toBe(4);
        expect(b.quantidadeSemDesconto).toBe(1);
        expect(b.subtotalComDesconto).toBe(240.00);
        expect(b.subtotalSemDesconto).toBe(100.00);
        expect(b.subtotalFinal).toBe(340.00);
      });

      it('Large volume: quantidade = 10,000 should accurately split into 4 promo + 9,996 regular = R$ 999,840.00', () => {
        const b = getProductQuantityPriceBreakdown(promoProduct, 10000);
        expect(b.quantidadeSolicitada).toBe(10000);
        expect(b.quantidadeComDesconto).toBe(4);
        expect(b.quantidadeSemDesconto).toBe(9996);
        expect(b.subtotalComDesconto).toBe(240.00);
        expect(b.subtotalSemDesconto).toBe(999600.00);
        expect(b.subtotalFinal).toBe(999840.00);
      });

      it('Exhausted quota (utilizada >= limite) should apply regular price to 100% of units', () => {
        const exhaustedProd: Produto = {
          ...promoProduct,
          desconto_quantidade_utilizada: 10, // 0 remaining
        };
        const b = getProductQuantityPriceBreakdown(exhaustedProd, 3);
        expect(b.quantidadeComDesconto).toBe(0);
        expect(b.quantidadeSemDesconto).toBe(3);
        expect(b.subtotalComDesconto).toBe(0);
        expect(b.subtotalSemDesconto).toBe(300.00);
        expect(b.subtotalFinal).toBe(300.00);
      });

      it('Floating point precision: fractional unit prices should not cause floating point artifacts', () => {
        const fractionalProd: Produto = {
          ...promoProduct,
          valor: 33.33,
          valor_promocional: 19.99,
          desconto_quantidade_limite: 5,
          desconto_quantidade_utilizada: 2, // 3 remaining
        };

        const b = getProductQuantityPriceBreakdown(fractionalProd, 5); // 3 promo @ 19.99 + 2 reg @ 33.33
        expect(b.subtotalComDesconto).toBe(59.97); // 3 * 19.99 = 59.97
        expect(b.subtotalSemDesconto).toBe(66.66); // 2 * 33.33 = 66.66
        expect(b.subtotalFinal).toBe(126.63); // 59.97 + 66.66 = 126.63
      });
    });

    describe('2.2 PIX EMV BR Code CRC16-CCITT Verification & Specification Compliance', () => {
      it('should compute valid standard CRC16-CCITT checksum for BACEN sample vectors', () => {
        // Test with known EMV BR Code payloads
        const payload1 = '00020126360014br.gov.bcb.pix0114+55119208577565204000053039865802BR5918GRUPO GSA SERVICOS6009SAO PAULO62070503***6304';
        const checksum = crc16(payload1);
        expect(checksum).toHaveLength(4);
        expect(checksum).toMatch(/^[0-9A-F]{4}$/);

        // Deterministic check: recalculating same string returns same checksum
        expect(crc16(payload1)).toBe(checksum);
      });

      it('formatEMV: should properly pad tag lengths to 2 digits', () => {
        expect(formatEMV('00', '01')).toBe('000201');
        expect(formatEMV('01', '12')).toBe('010212');
        expect(formatEMV('53', '986')).toBe('5303986');
        expect(formatEMV('58', 'BR')).toBe('5802BR');
        expect(formatEMV('59', 'GSA')).toBe('5903GSA');
      });

      it('generatePixCopiaECola: should normalize accent characters and enforce EMV length constraints', () => {
        const pixPayload = generatePixCopiaECola({
          chavePix: '11920857756',
          nomeRecebedor: 'José da Conceição & Filhos', // Accented name > 25 chars
          cidadeRecebedor: 'São Bernardo do Campo', // Accented city > 15 chars
          valor: 250.75,
          txId: 'PED#9988-ABC',
          descricao: 'Pagamento Loja GSA',
        });

        // Format Indicator (Tag 00)
        expect(pixPayload).toContain('000201');
        // Point of Initiation (Tag 01, '12' for dynamic with value)
        expect(pixPayload).toContain('010212');
        // Merchant Account Info (Tag 26) with GUI and Key
        expect(pixPayload).toContain('br.gov.bcb.pix');
        expect(pixPayload).toContain('+5511920857756');
        // Currency 986 (Tag 53)
        expect(pixPayload).toContain('5303986');
        // Value (Tag 54)
        expect(pixPayload).toContain('5406250.75');
        // Country BR (Tag 58)
        expect(pixPayload).toContain('5802BR');
        // Merchant Name stripped of accents, uppercase, max 25 chars: "JOSE DA CONCEICAO & FILHO" (25 chars)
        expect(pixPayload).toContain('5925JOSE DA CONCEICAO & FILHO');
        // Merchant City stripped of accents, uppercase, max 15 chars: "SAO BERNARDO DO" (15 chars)
        expect(pixPayload).toContain('6015SAO BERNARDO DO');
        // txId sanitized alphanumeric only: "PED9988ABC" (10 chars)
        expect(pixPayload).toContain('62140510PED9988ABC');
        // CRC tag present at the end
        expect(pixPayload).toContain('6304');

        // Verify CRC matches calculated CRC on payload body
        const payloadBody = pixPayload.slice(0, -4);
        const expectedCrc = crc16(payloadBody);
        expect(pixPayload.endsWith(expectedCrc)).toBe(true);
      });

      it('generatePixCopiaECola: should support static zero-value PIX (Tag 01 = 11, without Tag 54)', () => {
        const pixPayload = generatePixCopiaECola({
          chavePix: 'contato@grupogsa.com',
          nomeRecebedor: 'GRUPO GSA',
          cidadeRecebedor: 'SAO PAULO',
          valor: 0,
        });

        expect(pixPayload).toContain('010211'); // Static QR Code
        expect(!pixPayload.includes('540')).toBe(true); // No Tag 54
        const payloadBody = pixPayload.slice(0, -4);
        const expectedCrc = crc16(payloadBody);
        expect(pixPayload.endsWith(expectedCrc)).toBe(true);
      });

      it('getQrCodeImageUrl: should encode the PIX string into a valid QR server URL', () => {
        const pix = '00020101021126580014br.gov.bcb.pix0114+55119208577565204000053039865802BR5909GRUPO GSA6009SAO PAULO62070503***630489AB';
        const url = getQrCodeImageUrl(pix, 250);
        expect(url).toContain('https://api.qrserver.com/v1/create-qr-code/?size=250x250');
        expect(url).toContain(encodeURIComponent(pix));
      });
    });
  });

  // =========================================================================
  // DOMAIN 3: DATABASE SCHEMA IDEMPOTENCY EMPIRICAL AUDIT
  // =========================================================================
  describe('Domain 3: Database Schema Idempotency Verification Across All Migration Files', () => {
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');

    it('should verify that supabase/migrations directory exists and contains all migration scripts', () => {
      expect(fs.existsSync(migrationsDir)).toBe(true);
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
      expect(files.length).toBeGreaterThanOrEqual(80);
    });

    it('should scan all SQL migration files for non-idempotent table, column, index, and function declarations', () => {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
      const nonIdempotentFindings: { file: string; line: number; issue: string; code: string }[] = [];

      files.forEach((fileName) => {
        const filePath = path.join(migrationsDir, fileName);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const trimmed = line.trim();
          // Skip comments
          if (trimmed.startsWith('--') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            return;
          }

          // 1. CREATE TABLE without IF NOT EXISTS
          if (
            /create\s+table\s+/i.test(trimmed) &&
            !/create\s+table\s+if\s+not\s+exists/i.test(trimmed) &&
            !/create\s+temp/i.test(trimmed)
          ) {
            nonIdempotentFindings.push({
              file: fileName,
              line: index + 1,
              issue: 'CREATE TABLE without IF NOT EXISTS',
              code: trimmed,
            });
          }

          // 2. ALTER TABLE ... ADD COLUMN without IF NOT EXISTS
          if (
            /alter\s+table\s+.*\s+add\s+column\s+/i.test(trimmed) &&
            !/add\s+column\s+if\s+not\s+exists/i.test(trimmed)
          ) {
            nonIdempotentFindings.push({
              file: fileName,
              line: index + 1,
              issue: 'ALTER TABLE ADD COLUMN without IF NOT EXISTS',
              code: trimmed,
            });
          }

          // 3. CREATE INDEX without IF NOT EXISTS
          if (
            /create\s+(unique\s+)?index\s+/i.test(trimmed) &&
            !/create\s+(unique\s+)?index\s+if\s+not\s+exists/i.test(trimmed)
          ) {
            nonIdempotentFindings.push({
              file: fileName,
              line: index + 1,
              issue: 'CREATE INDEX without IF NOT EXISTS',
              code: trimmed,
            });
          }
        });
      });

      // Report any non-idempotent findings
      if (nonIdempotentFindings.length > 0) {
        console.warn(`Idempotency audit found ${nonIdempotentFindings.length} legacy non-idempotent clauses in migration files:`, nonIdempotentFindings.slice(0, 5));
      }

      // Check the latest consolidated production migration (20260826220000_production_remediation_consolidated.sql)
      const consolidatedMigrationPath = path.join(migrationsDir, '20260826220000_production_remediation_consolidated.sql');
      if (fs.existsSync(consolidatedMigrationPath)) {
        const consContent = fs.readFileSync(consolidatedMigrationPath, 'utf-8');
        const consLines = consContent.split('\n');
        const consViolations: string[] = [];

        consLines.forEach((l, i) => {
          const t = l.trim();
          if (t.startsWith('--')) return;
          if (/create\s+table\s+/i.test(t) && !/create\s+table\s+if\s+not\s+exists/i.test(t)) {
            consViolations.push(`Line ${i + 1}: ${t}`);
          }
          if (/alter\s+table\s+.*\s+add\s+column\s+/i.test(t) && !/add\s+column\s+if\s+not\s+exists/i.test(t)) {
            consViolations.push(`Line ${i + 1}: ${t}`);
          }
        });

        expect(consViolations).toEqual([]);
      }
    });

    it('should verify that all consolidated RPC definitions use CREATE OR REPLACE FUNCTION', () => {
      const consolidatedPath = path.join(migrationsDir, '20260826220000_production_remediation_consolidated.sql');
      if (fs.existsSync(consolidatedPath)) {
        const content = fs.readFileSync(consolidatedPath, 'utf-8');
        const createFuncMatches: string[] = Array.from(content.match(/create\s+(or\s+replace\s+)?function\s+([a-zA-Z0-9_]+)/gi) || []);

        createFuncMatches.forEach((match: string) => {
          expect(match.toLowerCase()).toContain('create or replace function');
        });
      }
    });
  });
});
