import { describe, it, expect } from 'vitest';
import { checkProgressRule } from '../../src/policies';
import { BreakDecision } from '../../src/types';

describe('Progress Rule Invariants (lastBreakPos)', () => {
    
    // Helper para gerar um dummy
    function makeDecision(pos: number): BreakDecision {
        return { status: 'accepted', pos, effectiveDisplacement: 0, reasons: [], renderer: 'linear-widget' };
    }

    it('Cenário 1 — Avanço simples: Aceita decisão posicionada depois da última quebra', () => {
        const breaks = [makeDecision(50), makeDecision(100)];
        const decision = makeDecision(150);
        
        const { isStale, lastBreakPos } = checkProgressRule(decision, breaks);
        expect(isStale).toBe(false);
        expect(lastBreakPos).toBe(100);
    });

    it('Cenário 2 — Recuo tabular legítimo: Aceita decisão que recua em relação ao raycaster, mas avança em relação à quebra', () => {
        // Exemplo: raycaster encontrou overflow em 150, mas a tabela recuou para a fronteira segura em 120.
        // A quebra anterior foi em 100.
        const breaks = [makeDecision(100)];
        const decision = makeDecision(120); // 120 > 100, avanço válido
        
        const { isStale, lastBreakPos } = checkProgressRule(decision, breaks);
        expect(isStale).toBe(false);
        expect(lastBreakPos).toBe(100);
    });

    it('Cenário 3 — Fronteira repetida: Rejeita decisão que não avança (mesmo valor da última quebra)', () => {
        const breaks = [makeDecision(100)];
        const decision = makeDecision(100); // 100 == 100
        
        const { isStale, lastBreakPos } = checkProgressRule(decision, breaks);
        expect(isStale).toBe(true);
        expect(lastBreakPos).toBe(100);
    });

    it('Cenário 4 — Retrocesso inválido: Rejeita decisão anterior à última quebra', () => {
        const breaks = [makeDecision(100)];
        const decision = makeDecision(90); // 90 < 100
        
        const { isStale, lastBreakPos } = checkProgressRule(decision, breaks);
        expect(isStale).toBe(true);
        expect(lastBreakPos).toBe(100);
    });

    it('Cenário 5 — Quebra manual intermediária: Atualiza corretamente o referencial ao mesclar quebras', () => {
        // breaks contém uma manual no meio
        const breaks = [makeDecision(100), { ...makeDecision(150), origin: 'manual' } as BreakDecision];
        const decision = makeDecision(160);
        
        const { isStale, lastBreakPos } = checkProgressRule(decision, breaks);
        expect(isStale).toBe(false);
        expect(lastBreakPos).toBe(150);
    });

    it('Cenário 6 — Tabela extensa: Prevenção de loop quando a tabela não oferece recuo válido', () => {
        // Tabela colossal inicia em 100. Raycaster em 110 bate overflow.
        // O avaliador tenta recuar, mas a única fronteira era antes da tabela (por exemplo, 95).
        // Isso ocorreu no EXP-038.
        const breaks = [makeDecision(105)]; // O controller conseguiu quebrar um parágrafo pouco antes em 105.
        // Raycaster avaliou e a tabela sugere a quebra no inicio dela em 100.
        const decision = makeDecision(100); 
        
        const { isStale, lastBreakPos } = checkProgressRule(decision, breaks);
        
        // 100 < 105 -> Inválido. A regra detecta o STALE_BREAK.
        // Isso previne que o algoritmo quebre repetidamente no inicio da tabela criando páginas em branco.
        expect(isStale).toBe(true);
        expect(lastBreakPos).toBe(105);
    });

});
