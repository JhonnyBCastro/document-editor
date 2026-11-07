# live-demo — notas de reprodução

Consumidor mínimo que importa `src/` do working tree (não o tarball RC.4). Somente `composed` é prioritário.

**Subir:** em `examples/vanilla-consumer`: `node_modules/.bin/vite ../live-demo --config ../live-demo/vite.config.ts` → http://localhost:8544/
**Verificar:** `node examples/live-demo/check.cjs` (Chrome em `/usr/bin/google-chrome`).

## Observações manuais do usuário (não validadas exaustivamente)
- composed: sem acúmulo de espaçamento entre páginas nos cenários testados; texto colado com 59 páginas; quebras manuais (linha tracejada vermelha) e tabela grande aparentemente corretas. Condições exatas (conteúdo colado, tamanho do doc) não registradas.

## Correção implementada: Orçamento de iterações e diagnóstico explícito
- **Problema anterior:** `controller.ts` laço com `failsafe < 5000` estático. Documentos acima de ~100k posições eram interrompidos silenciosamente sem paginar o restante.
- **Solução implementada em `src/controller.ts`:**
  1. O passo de amostragem `SCAN_STRIDE = 20` foi preservado explicitamente e documentado (medições empíricas comprovaram que passos 10, 20 e 40 produzem quebras idênticas).
  2. Orçamento dinâmico: `getIterationBudget(docSize) = 2 * Math.ceil(docSize / SCAN_STRIDE) + 100`. Cobre com margem confortável o trabalho útil medido (~1,05x a 1,11x de `ceil(docSize / SCAN_STRIDE)`).
  3. Diagnóstico obrigatório: se o laço terminar com `pos < docSize`, é emitido o diagnóstico com código `LAYOUT_ITERATION_LIMIT` contendo posição atingida e tamanho total, garantindo que o resultado nunca pareça completo silenciosamente.
  4. Suite de testes unitários dedicada criada em `tests/unit/iteration-limit.spec.ts` (3 testes cobrindo documento longo, interrupção com diagnóstico e crescimento com `docSize`).

## Resultados medidos pós-correção (check.cjs, browser real, 2026-10-20)

### Modo `composed` no código atual (:8544)
| Cenário | Tamanho (docSize) | Páginas | Diag | Última quebra / docSize | Última linha na última página? | Violações área útil | Idempotente |
|---|---|---|---|---|---|---|---|
| PE-S | 1.124 | 2 | 0 | 1010 | sim (pág 2) | 0/24 | sim |
| PE-M | 6.739 | 6 | 0 | 5263 | sim (pág 6) | 0/160 | sim |
| PE-L | 25.727 | 23 | 0 | 24387 | sim (pág 23) | 0/838 | sim |
| mini (60 parágrafos) | 11.211 | 5 | 0 | 8968 | sim (pág 5) | 0/180 | sim |
| p:100 (100 parágrafos) | 24.390 | 9 | 0 | 22769 | sim (pág 9) | 0/300 | sim |
| p:370 (370 parágrafos) | 90.540 | 32 | 0 | 88589 | sim (pág 32) | 0/1110 | sim |
| p:600 (600 parágrafos) | 146.890 | 52 | 0 | 145753 | sim (pág 52) | 0/1800 | sim |
| p:1500 (1500 parágrafos)| 367.890 | 129 | 0 | 366257 | sim (pág 129) | 0/4500 | sim |

*(Em todos os casos acima, o documento foi processado até o fim: `lastLineOnLastPage: true` e 0 violações de margem).*

---

## Comparação sistemática com o pacote RC.4 histórico (:8545)

Para isolar o comportamento do pacote RC.4 sem interferência de consumidores diferentes, `live-demo/vite.config.ts` foi parametrizado com `DEMO_LIB=rc4` e porta 8545, rodando a **mesma** página, **mesmas** dependências do Tiptap (2.27.3) e os mesmos fixtures sintéticos.

**Observações técnicas sobre RC.4:**
1. O pacote RC.4 compilado **não** possui a opção `visualMode: 'composed'` (o bundling histórico de RC.4 só suporta o modo documental legado).
2. O código compilado do RC.4 possui no bundle a checagem fixa `d < 5e3` (5000 iterações).
3. Em `whenLayoutStable()`, RC.4 não dispara novo ciclo sem transação externa pendente.

### Matriz comparativa (mesmo consumidor, modo `legacy`, porta 8544 vs 8545):

| Cenário | Código ATUAL (`legacy`, :8544) | Pacote RC.4 (`legacy`, :8545) | Análise / Diferença |
|---|---|---|---|
| **PE-M** (6.7k) | 6 págs, 5 quebras, **0 violações**, fim na pág 6 | 5 págs, 4 quebras, **36 violações**, fim transbordou para pág 7 | RC.4 quebrou de forma diferente e transbordou conteúdo além das páginas desenhadas. |
| **p:370** (90.5k) | 32 págs, 31 quebras, **0 violações**, fim na pág 32 | 30 págs, 29 quebras, **236 violações**, fim transbordou para pág 31 | RC.4 acumulou desvios e causou sobreposição em margens. |
| **p:600** (146.8k)| 52 págs, 51 quebras, **0 violações**, fim na pág 52 | 31 págs, 30 quebras, **391 violações**, fim na pág 47 (truncou em pos 92019) | **No RC.4 o truncamento em 5000 iterações é ativo**, parando em ~pos 92000. No código atual, paginou todas as 52 páginas sem violações. |

### Conclusão da comparação RC.4 vs Código Atual:
O truncamento no caso `long` (600 parágrafos) **já existia no pacote RC.4 original** (`d < 5e3` no bundle compilado). Além disso, o pacote RC.4 apresentava desvios geométricos acumulados em modo `legacy` mesmo em documentos menores como PE-M (36 violações de margem), enquanto o código atual com o modo `composed` e as evoluções geométricas mantém 0 violações em todos os cenários testados até 1.500 parágrafos.

---

## Correção isolada do congelamento em blocos de texto extensos (2026-10-20)

### Causa Raiz Confirmada:
1. Em `controller.ts`, `nodeDOM(start)` retornava `TextNode` (`nodeType === 3`) em vez do elemento `<p>`.
2. Em parágrafos contínuos extensos (> 1 página), a quebra da página 2 caía em `targetLine = 0 -> blockStart`.
3. Como `blockStart <= lastBreakPos`, a quebra tornava-se stale (`isStale = true`).
4. O tratamento de `isStale` fazia `pos += 1; continue;`, repetindo medições síncronas de geometria DOM (`coordsAtPos`) caractere a caractere por milhares de iterações, congelando a thread principal com 100% de CPU.

### Solução Mínima Implementada:
1. **Resolução de DOM do bloco:** `rawBefore` via `exactRes.before(exactRes.depth)` (quando `depth > 0`) obtém diretamente o elemento de bloco (`nodeType === 1`). Se `rawStart` for retornado com `nodeType === 3`, obtém `parentElement`.
2. **Defensiva em JSDOM (`getVisualLines`):** proteção contra ausência de `Range.prototype.getClientRects`, evitando `TypeError` em ambientes de teste sem geometria.
3. **Tratamento de blocos contínuos multi-página (`evaluateLinearPolicies`):** se `candidate.blockStart <= candidate.lastBreakPos`, o bloco já começou em página anterior; a quebra é emitida na fronteira natural `candidate.exactPos` (`reasons: ['multi_page_block_overflow']`).
4. **Recuperação de `STALE_BREAK` no controller:** se qualquer decisão for stale, recupera para `candidate.exactPos` ou avança com salto seguro `Math.max(pos + SCAN_STRIDE, lastBreakPos + 1)`, eliminando qualquer avanço de 1 em 1 caractere.

### Resultados Empíricos Medidos no Chrome Real (:8544):
- **Parágrafo contínuo único de 16.000 caracteres:** processado em **163.8 ms**, gerando 5 páginas, 4 quebras, 0 diagnósticos de erro.
- **`controller.ts` colado na íntegra como parágrafo contínuo único (35.520 caracteres):** processado em **318.7 ms**, gerando 19 páginas, 18 quebras, 0 diagnósticos de erro, 0 bloqueio da thread principal.
- **`controller.ts` colado como múltiplos parágrafos (`\n\n`):** processado em **172.8 ms**, gerando 20 páginas, 19 quebras, 0 diagnósticos de erro.
- **Invariantes e Regressões (`check.cjs`):** 0 violações de margem e 100% idempotente em PE-S, PE-M, PE-L, mini, p:370 e p:600.
- **Testes automatizados:** 125/125 testes passando no vitest, 0 erros no typecheck TypeScript.

---

## Encerramento da rodada de correções — Paginação, reatividade e cursor (2026-10-21)

### 1. Resumo das correções implementadas na cópia de teste

1. **Reatividade a alterações estruturais (`src/extension.ts`):**
   - Implementada a função `hasStructuralChange(doc1, doc2)`, que compara tipos de nós e contagem de filhos.
   - O hook `update` do plugin agora detecta alterações estruturais (como a conversão de `codeBlock` para `paragraph` via Backspace), mesmo quando `doc.content.size` permanece idêntico.
   - Preservado o contrato de não recalcular em substituições textuais simples de mesmo tamanho.
   - Suíte focal em `tests/unit/structural-reactivity.spec.ts` (3 testes aprovados).

2. **Prevenção da página inicial vazia em blocos contínuos (`src/policies.ts`):**
   - Em `evaluateLinearPolicies`, quando `targetLine === 0` e `candidate.blockStart <= 1`, a decisão direciona para `candidate.exactPos` (`reasons = ['natural_overflow']`).
   - Impede que o primeiro bloco do documento gere uma quebra espúria em `pos <= 1` empurrando todo o conteúdo para a Página 2.
   - Preservada a política de transporte integral para parágrafos subsequentes (`blockStart > 1`).
   - Cenário 7 adicionado a `tests/unit/long-continuous-block.spec.ts` (aprovado).

3. **Absorção de `\n` terminal e eliminação de linhas extras (`src/controller.ts`):**
   - Quando a quebra aceita recai imediatamente antes de um caractere `\n` (típico de blocos pré-formatados / código), a posição `decision.pos` é avançada em 1 caractere (`\n`).
   - Com isso, a terminação de linha fecha a linha na página atual, impedindo que o `\n` seja projetado no início da página seguinte como linha em branco espúria.
   - Eliminado o acúmulo progressivo de desvios verticais de $15\text{ px}$ por folha.

### 2. Validação manual e automatizada

- **Suíte de testes unitários:** 125/125 testes aprovados (`npm test`).
- **Verificação de tipagem TypeScript:** 0 erros (`npx tsc --noEmit`).
- **Validação no Live Demo (:8544):**
  - O congelamento durante a colagem de textos extensos não voltou a ocorrer.
  - A primeira página recebe o conteúdo normalmente (131 linhas visíveis).
  - Transições entre páginas e navegação por teclado operacionais.
  - Corrupção de layout após Backspace no início do bloco não reproduzida.

### 3. Ressalva geométrica residual (Limitação conhecida)

- **Comportamento observado:** Em algumas páginas, o texto atinge proximidade excessiva ou sobreposição parcial de alguns pixels em relação ao indicador de numeração do rodapé. No teste manual, não foi verificado transbordamento significativo para além do limite físico geral da folha.
- **Avaliação técnica:** O contrato formal do motor de paginação (fórmula nominal $T_1 = A + U$, $n_i = \text{coords.top} - \sum \text{disp}$, $r_i = \max(0, T_i - n_i)$) calcula cotas de transbordo com base no topo da linha (`coords.top`). Em fontes com altura de linha relevante e margens compactas, a base da última linha (`coords.bottom`) pode penetrar a margem inferior em alguns pixels.
- **Status:** Registrado como limitação visual conhecida para avaliação futura, especialmente relevante quando for especificado o contrato de running content para rodapés com conteúdo rico e cabeçalhos formais.

---

## Consolidação da arquitetura `composed` e encerramento do `legacy` (2026-10-21)

Em conformidade com a autorização técnica, a arquitetura `composed` foi consolidada como o único comportamento oficial e padrão da biblioteca na cópia de teste. O modo `legacy` e a camada obsoleta de chrome foram descontinuados e removidos do código de execução.

### 1. Resumo das alterações de código e remoções

1. **Camada de Chrome legada (`src/chrome.ts` e `tests/unit/chrome.spec.ts`):**
   - **Removidos integralmente:** O arquivo `src/chrome.ts` (que injetava e sincronizava `.document-editor-chrome-layer` com divs flutuantes sobre o editor) e sua suíte unitária órfã foram deletados.
2. **Estilos de produção (`src/style.css`):**
   - Removidos todos os seletores do chrome legado (`#pages-layer`, `#chrome-layer`, `.document-editor-chrome-layer`, `.page-chrome-*`).
   - Preservadas integralmente as regras do spacer tabular (`.page-break-row > td`, `.page-break-row > th`) e as regras de `@media print`.
3. **Decorações do editor (`src/decorations.ts`):**
   - Removida a bifurcação condicional `if (visualMode === 'legacy')`.
   - Todas as quebras estruturais e de espaçamento adotam o contrato do modo `composed`, utilizando bordas B1 `1px solid transparent` para preservar a integridade física de 1 px no box model sem pintar linhas cinzas ou fundos brancos `#fff` no DOM do editor.
4. **Controlador do motor (`src/controller.ts`):**
   - Removidos os campos privados `chromeLayer` e `originalParentPosition`.
   - Removidas as injeções de DOM no construtor e a limpeza em `destroy()`.
   - Removida a alteração imperativa `editorEl.style.background = 'white'`.
   - Padronizado `visualMode: PaginationVisualMode = 'composed'` como padrão oficial.
   - Parâmetro `chromeLayerElement` removido da assinatura.
   - Chamadas com qualquer modo diferente de `'composed'` (inclusive `'legacy'`) lançam estritamente `TypeError` sem fallback.
5. **Extensão pública e tipos (`src/extension.ts` e `src/types.ts`):**
   - O default da extensão foi fixado em `visualMode: 'composed'`.
   - `PaginationVisualMode` tipado estritamente como `'composed'`.
   - Campo `chromeLayerElement` removido de `PaginationOptions`.
6. **Live Demo (`examples/live-demo`):**
   - Removido o seletor `<select id="mode">` da barra de ferramentas; o Live Demo opera de forma limpa e direta com `createDocumentPresentation` consumindo os snapshots do Core.
7. **Suítes de testes (`tests/unit`):**
   - `tests/unit/paint-mode.spec.ts` reescrito para testar o contrato oficial `composed` (zero injeção de DOM, bordas B1 transparentes, rejeição estrita de modos inválidos sem fallback).
   - `tests/unit/carrier-contributions.spec.ts`, `tests/unit/pagination-budget-recurrence.spec.ts` e `tests/unit/decoration-association.spec.ts` consolidados para o modo oficial `composed`.

Para o handoff técnico completo com métricas, diagnóstico de regressão e guia de revisão para as Frentes A e B, consulte:
- [CONS-013 — Dossiê Técnico de Consolidação da Arquitetura Composed e Handoff para as Frentes A e B](../consolidation/CONS-013-COMPOSED-CONSOLIDATION-HANDOFF.md)


---

## Adaptação focal da Live Demo — CONS-014 (2026-10-22)

Em conformidade com a autorização da Frente A de 22/10/2026:
1. **Resolução de Dependências da Raiz Isolada:**
   - A configuração `vite.config.ts` foi desacoplada de `examples/vanilla-consumer` e aponta diretamente para a raiz provisionada do repositório (`../../node_modules`).
   - Removidas todas as referências ativas a `DEMO_LIB=rc4` e substituições por pacotes legados.
   - Cache isolado localmente em `../../node_modules/.vite-live-demo-8544`.
2. **Delimitação Explícita de Funcionalidades Indisponíveis (Cenários Tabulares):**
   - Na raiz provisionada do projeto, os pacotes `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell` e `@tiptap/extension-table-header` estão **ausentes** (existiam unicamente no consumidor legado).
   - Conforme autorização formal, esta versão da Demo fica delimitada ao fluxo linear, headings e edição, **com indicação explícita na interface e nas notas de que os cenários tabulares (PE-S, PE-M, PE-L) estão indisponíveis**.
   - Os cenários de fluxo linear e parágrafos sintéticos (`mini`, `p:370`, `p:600`) permanecem integralmente suportados e validados pelo `check.cjs`.
