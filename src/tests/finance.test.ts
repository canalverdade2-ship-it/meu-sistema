import { calcularParcela } from '../utils/emprestimoUtils';

declare const describe: any;
declare const it: any;
declare const expect: any;

describe('Financial Math Utilities', () => {
  describe('calcularParcela (emprestimoUtils)', () => {
    it('should correctly calculate installment and total financed amount with standard rounding', () => {
      // valorAprovado = 1000, juros = 10%, parcelas = 10
      // total = 1000 * 1.10 = 1100
      // parcela = 1100 / 10 = 110
      const result = calcularParcela(1000, 10, 10);
      expect(result.valorTotalFinanciado).toBe(1100);
      expect(result.valorParcela).toBe(110);
    });

    it('should correctly round floating point values', () => {
      // valorAprovado = 1000.55, juros = 12.3%, parcelas = 3
      // total = 1000.55 * 1.123 = 1123.61765 -> round to 2 decimals -> 1123.62
      // parcela = 1123.62 / 3 = 374.54
      const result = calcularParcela(1000.55, 12.3, 3);
      expect(result.valorTotalFinanciado).toBe(1123.62);
      expect(result.valorParcela).toBe(374.54);
    });

    it('should handle zero interest', () => {
      const result = calcularParcela(500, 0, 5);
      expect(result.valorTotalFinanciado).toBe(500);
      expect(result.valorParcela).toBe(100);
    });
  });

  describe('Gamification Points Rounding (Mock)', () => {
    // Simulating the rounding logic from gamification.ts
    // Math.floor(Math.round(valorPago * 100) / 100 * pontosPorReal)
    const calculateGamificationPoints = (valorPago: number, pontosPorReal: number) => {
      return Math.floor(Math.round(valorPago * 100) / 100 * pontosPorReal);
    };

    it('should calculate integer points correctly for exact values', () => {
      expect(calculateGamificationPoints(100, 1)).toBe(100);
      expect(calculateGamificationPoints(100, 2)).toBe(200);
    });

    it('should apply Math.round and then Math.floor properly to avoid floating point issues', () => {
      // 99.99 * 1 = 99.99 -> floor -> 99
      expect(calculateGamificationPoints(99.99, 1)).toBe(99);
      
      // Math.round(99.995 * 100) / 100 = 100 -> floor = 100
      expect(calculateGamificationPoints(99.995, 1)).toBe(100);
      
      // 50.50 * 1.5 = 75.75 -> floor -> 75
      expect(calculateGamificationPoints(50.50, 1.5)).toBe(75);
    });

    it('should avoid floating point precision issues like 0.1 + 0.2', () => {
      const problematicValue = 0.1 + 0.2; // 0.30000000000000004
      expect(calculateGamificationPoints(problematicValue, 10)).toBe(3);
    });
  });
});
