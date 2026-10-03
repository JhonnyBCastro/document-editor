# CONS-010 — Quality Assurance, Release Gates e Final Release Candidate

## 1. Objetivo
Realizar uma auditoria transversal da distribuição, corrigir lacunas de cobertura, executar a matriz de testes contra as versões de referência do Tiptap, testar o isolamento e estabelecer os gates para autorizar o primeiro Release Candidate (RC).

## 2. Estado Inicial e Correções de Rastreabilidade
- A CONS-008-F e a CONS-009 produziram acidentalmente diferentes binários sob a mesma nomenclatura de versão `0.1.0-alpha.6`, ferindo o princípio de rastreabilidade e imutabilidade de pacotes.
- O teste P09 originalmente na CONS-009 realizava validação de quebras de página genéricas (lineares) sob um nome que remetia ao teste tabular (PE-L).
- **Correções aplicadas:** A versão foi provisoriamente isolada. O teste original P09 foi renomeado para **P09-L** (Paginação Linear). Criamos o novo teste **P09-T** (Stress Test Tabela Longa) injetando uma tabela dinâmica para testar recuperação dos espaçadores `.virtual-page-spacer` sem timeout de serialização JSON do Puppeteer.

## 3. Inventário dos Testes de Integração e Sistema
A suíte E2E automatizada agora engloba:
- **test-print.cjs (P01-P10)**: Valida isolamento, idempotência e recuperação da PrintSession e PrintMode.
- **hybrid-pagination.spec.cjs**: Valida coerência semântica e visual de pagebreaks manuais e auto.
- **pagination-stress.spec.cjs**: PE-S, PE-M, PE-L, e Rollback verificam performance, integridade e limpeza do JSON.
- **test-isolation.cjs**: Verifica suporte real-life de instâncias de ChromeLayer em múltiplos layouts, host containers, reflow e fallbacks.

## 4. Matriz Tiptap 2 e Tiptap 3 (Print Session Tests)

| Teste | Tiptap 2 (Consumer A) | Tiptap 3 (Consumer B) |
|---|---|---|
| P01 — Preparação | PASS | PASS |
| P02 — Restauração | PASS | PASS |
| P03 — Idempotência | PASS | PASS |
| P04 — Classe preexistente | PASS | PASS |
| P05 — Falha simulada | PASS | PASS |
| P06 — Concorrência | PASS | PASS |
| P07 — JSON íntegro | PASS | PASS |
| P08 — PageBreak manual | PASS | PASS |
| P09-L — Paginação linear | PASS | PASS |
| P09-T — Tabela longa | PASS | PASS |
| P10 — Retorno à edição | PASS | PASS |

## 5. Regressões Consolidadas
- **P09-L (Linear)**: Passou nos hosts e garantiu estabilidade de dezenas de `page-break-widget` injetados num documento text-heavy.
- **P09-T (Tabular)**: Passou usando uma tabela programática extensa, certificando recuperação do `.virtual-page-spacer` durante as recálculos assíncronos das sessões de impressão.
- **Smoke test físico**: (Não auditado, focado em E2E Puppeteer. O Tiptap Editor não se compromete a ter fidelidade 100% fotográfica da impressão física nativa, sendo de responsabilidade do projeto de Backend/CSS do APPE).
- **Testes Híbridos (Hybrid)**: PASS.
- **Testes de Isolation (Ownership)**: PASS.
- **Vitest (Unit)**: PASS.
- **Stress Test (PE-S, PE-M, PE-L, Rollback)**: PASS.

## 6. Auditoria da Distribuição
O pacote foi gerado utilizando `npm pack` sob o nome `document-editor-0.1.0-rc.1.tgz`.
- Exportações `main`, `module`, e `types` estão devidamente declaradas.
- O arquivo `dist/document-editor.css` expõe os overlays de forma isolada.
- Instalação testada de forma "limpa" nos consumidores usando tarballs literais, provando a resolução das *peerDependencies* Tiptap sem necessitar *legacy-peer-deps*.
- O artefato resultante tem exatos 43.7 kB.

## 7. Matriz de Release Gates G1–G12

| Gate | Descrição | Status |
|---|---|---|
| G1 | Build reproduzível | PASS |
| G2 | Integridade da API pública | PASS |
| G3 | Instalação externa independente | PASS |
| G4 | Compatibilidade Tiptap 2.27.3 | PASS |
| G5 | Compatibilidade Tiptap 3.31.3 | PASS |
| G6 | Paginação híbrida e PageBreak | PASS |
| G7 | Paginação tabular longa | PASS |
| G8 | Ownership e destruição DOM | PASS |
| G9 | PrintSession P01–P10 (inclui P09-L e P09-T) | PASS |
| G10 | Integridade semântica do JSON | PASS |
| G11 | Documentação consistente | PASS |
| G12 | Identidade e rastreabilidade do artefato | PASS |

## 8. Pendências e Limitações Conhecidas
- O layout de tabelas não faz fragmentação intralinha. Uma célula massiva (height > pageHeight) causa overflow oculto (limitação nativa não solucionada no contexto do ProseMirror sem splitting invasivo do JSON).
- Não há suporte a multi-instâncias visuais absolutas concorrendo eventos globais do Window (necessário confinar escopo futuro).

## 9. Identidade da Versão e Instruções
- **Versão:** `document-editor@0.1.0-rc.1`
- **Commit:** `ef239ae`
- **Hash SHA-256 (Tarball):** `d581e3c939dbc24d4133ce9c43e5e5e466cc4cdc5c762f10d357044501a33d1e`
- **Decisão:** Release Candidate (RC) **Aprovada**.

Para reproduzir localmente:
1. `npm run build && npm pack` na raiz do projeto.
2. `cd ../cons-005/consumer-a` e `npm install` com o tarball.
3. `node test-print.cjs` (ou outras suítes) e acompanhe.

## 10. Recomendação para a próxima atividade
CONS-011: Encerrar TCC ou formalizar a integração definitiva e homologação final nas portas institucionais M/O/Q do APPE utilizando a biblioteca `0.1.0-rc.1`.
