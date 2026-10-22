# CONS-004 — Release Candidate e Integração Controlada no APPE

## 1. Estado Inicial
- **Projeto Base**: `document-editor@0.1.0-alpha.0` (commit f5f92c1e2bc5fc1c4c8c4461c377c01e6adda18b)
- **Consumidor Institucional**: `appe-web` (branch experimental originada da EXP-038).

## 2. Baseline Executada (Etapas A e B)
- Foram verificados os testes unitários (`vitest`) e os híbridos E2E com correção de syntax no Puppeteer.
- **Correção da posição zero (`pos = 0`)**: Confirmada com o teste de isolamento. O fallback geométrico `Math.max(1, pos)` não interfere na semântica da posição zero.
- **Regra `lastBreakPos`**: Confirmada pelos stress tests (sem loops infinitos e sem recuos semânticos destrutivos).
- **Resultados Baseline Geométrica**:
  - PE-S: 2 páginas (121ms).
  - PE-M: 3 páginas (117ms).
  - PE-L: 10 páginas, 7 quebras auto, 6 spacers (163ms).

## 3. Geração da Versão Candidata (Etapa C)
- A peerDependency do Tiptap foi expandida para suportar `^2.0.0 || ^3.0.0`.
- **Nova versão gerada**: `document-editor@0.1.0-alpha.2`.
- O pacote foi compilado (`npm run build`) e inspecionado via `npm pack`.
- **Conteúdo do tarball (`document-editor-0.1.0-alpha.2.tgz`)**:
  - `dist/document-editor.css`
  - `dist/pagination.es.js`
  - `dist/pagination.umd.js`
  - `dist/index.d.ts`
  - `package.json`
  - `README.md`

## 4. Verificação Independente (Etapa D)
Um projeto "sandbox" (`temp-consumer`) foi criado externamente para confirmar que a biblioteca expõe ESM, declarações de tipos e importa o tiptap corretamente sem estar atrelada ao ecossistema local do `editor-lab`.

## 5. Integração Controlada e Compatibilidade Angular (Etapas E e F)
- A branch local `cons-004-rc-validation` foi gerada a partir da `exp-038-pagination-pilot` no repositório `appe-web`.
- A antiga dependência `editor-lab` foi substituída pelo `document-editor-0.1.0-alpha.2.tgz`.
- O import no `appe-editor.component.ts` foi refatorado.
- **Resultado do Build Angular**: SUCESSO. A expansão das peerDependencies permitiu que a biblioteca funcionasse perfeitamente com a v3.31.3 do Tiptap utilizada no APPE. O tamanho do bundle está alinhado e o Angular compiler processou o modo sem erros.

## 6. Smoke Test (Etapa G)
Uma rota dinâmica (`/smoke`) foi criada injetando a API Angular (`enableExperimentalPagination`).
- O Puppeteer comprovou:
  - Inicialização transparente do editor convencional e migração para o experimental sem queda.
  - PageBreak detectado e protegido semântica/visualmente, inclusive na posição 0.
  - Teste da Tabela Longa resultou em reflow sem engasgos do layout.
  - `editor.getJSON()` completamente desprovido de referências sujas (`pageGap`, `table-row-spacer`, `widget`).
  - O rollback por destruição também teve sucesso.

## 7. Pendências Institucionais (Etapa H)
Essas pendências (M, O e Q) referem-se à homologação definitiva e não impedem a conclusão do RC da biblioteca:
- **Portão M**: Validar permissões e fluxo de envio/revisão (BLOCKED: requer back-end rodando).
- **Portão O**: Comprovar renderização OpenPDF de um json pós-RC (BLOCKED: backend independente necessário).
- **Portão Q**: Preparar Cypress E2E institucional (BLOCKED: a test suite E2E principal não está focada no RC isolado agora).

## 8. Instruções de Rollback
Caso a RC não seja provada nos portões M/O/Q, basta reverter a branch `cons-004-rc-validation` ou migrar a configuração `@Input() enableExperimentalPagination = false`. Nenhuma tag estrutural foi persistida nos Planos de Ensino salvos.

## Próxima Atividade Recomendada
Iniciar a etapa institucional para destravar os portões M, O e Q, ou declarar o RC como `document-editor@1.0.0` e homologar o merge oficial no APPE.
