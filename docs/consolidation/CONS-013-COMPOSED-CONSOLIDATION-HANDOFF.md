# CONS-013 — Dossiê Técnico de Consolidação da Arquitetura Composed e Handoff para as Frentes A e B

**Data de consolidação:** 21/10/2026  
**Ambiente de execução:** Cópia de testes autorizada (`/home/jhonny/Documentos/editor-biblioteca/document-editor-test`)  
**Status da proposta:** Proposta técnica experimental consolidada para avaliação e homologação das Frentes A e B (não incorporada à biblioteca canônica)

---

## 1. Sumário Executivo

Este documento consolida o trabalho técnico realizado na cópia experimental da biblioteca `@jhonny_bcastro/document-editor`, cujo objetivo foi estabilizar a paginação contínua, solucionar anomalias críticas de congelamento e corrupção de layout em textos extensos, e consolidar o modo `visualMode: 'composed'` como a **única arquitetura oficial e padrão da biblioteca**, promovendo a descontinuação e remoção fundamentada da camada legada (`legacy` / `chrome.ts`).

O documento destina-se aos revisores técnicos das **Frentes A e B** encarregados de avaliar a eventual incorporação dessas mudanças à biblioteca canônica, apresentando a motivação, o diagnóstico causal, as soluções implementadas, as evidências verificáveis de teste e os limites remanescentes da proposta.

---

## 2. Histórico Técnico e Diagnóstico de Problemas

### 2.1. O congelamento em textos contínuos extensos (CPU Lock)

#### Sintomas e Reprodução
Durante a validação operacional no Live Demo (`examples/live-demo`), ao limpar o documento e colar blocos contínuos de texto de grande extensão — especificamente código-fonte (como o conteúdo do arquivo [`src/controller.ts`](../../src/controller.ts), com ~34 KB e 741 linhas) —, o navegador travava de forma síncrona. A thread principal entrava em loop infinito e o editor parava de responder.

#### Diagnóstico e Cadeia Causal
A investigação detalhada do motor de paginação revelou uma falha interconectada entre a resolução de nós do DOM e a máquina de estados de quebra:
1. **Resolução imperfeita de nós do DOM:** Em `findBreak()`, a resolução de coordenadas de nós textuais ou contêineres de bloco contínuo utilizava índices que não correspondiam ao bloco em transbordo. A chamada `domAtPos()` falhava em identificar os nós de texto intermediários quando um bloco se estendia por múltiplas folhas sem quebras naturais de parágrafo.
2. **Seleção de quebra sem progresso (Zero-Progress Break):** Quando o candidato a quebra caía no início do bloco em transbordo, a posição calculada coincidia com a posição da quebra anterior (`candidate.exactPos <= lastBreakPos`), ou a decisão de quebra estagnava sem avançar posições no documento ProseMirror.
3. **Loop síncrono após `STALE_BREAK`:** O laço de layout `performLayout` detectava que o deslocamento não era suficiente, emitia uma condição de quebra obsoleta (`STALE_BREAK`) e reiniciava o cálculo geométrico na mesma posição sem progredir. Isso causava o esgotamento do loop em trabalho síncrono infinito, bloqueando o navegador.

#### Correção Implementada
1. **Resolução precisa do DOM:** Reformulação da busca de nós em [`src/controller.ts`](../../src/controller.ts) utilizando resolução exata para nós textuais (`TextNode`), garantindo identificação correta da linha e coordenadas via `Range.getClientRects()`.
2. **Garantia de avanço progressivo:** Em [`src/policies.ts`](../../src/policies.ts), na política de quebra de blocos contínuos (`multi_page_block_overflow`), a decisão de quebra é ancorada em `candidate.exactPos`, com guarda obrigatória de avanço estrito `candidate.exactPos > lastBreakPos`.
3. **Recuperação segura de `STALE_BREAK`:** O tratamento de quebra obsoleta foi limitado para impedir repetição síncrona de trabalho geométrico no mesmo ciclo caso a posição não progrida.

---

### 2.2. Anomalias visuais de continuidade e primeira página vazia

#### Sintomas Observados
Após a correção do congelamento, um teste manual no Live Demo revelou novos efeitos colaterais:
1. **Primeira página vazia:** Ao limpar o editor e colar o texto de `controller.ts`, a Página 1 ficava inteiramente em branco, e o texto iniciava apenas na Página 2.
2. **Linha em branco espúria no topo das páginas:** O texto apresentava um desvio vertical cumulativo de aproximadamente $15\text{ px}$ por folha.
3. **Desorganização de layout após Backspace na Página 1:** Ao posicionar o cursor no início do texto e pressionar Backspace, as decorações visuais de divisão de página se desorganizavam, e o texto atravessava os limites entre páginas.

#### Diagnóstico e Correções Implementadas

1. **Correção da primeira página vazia ([`src/policies.ts`](../../src/policies.ts)):**
   - *Causa:* Em `evaluateLinearPolicies()`, ao avaliar a primeira linha de um bloco (`targetLine === 0`), a política de prevenção de orfandade/transporte aplicava o transporte integral do bloco para a página seguinte mesmo quando o bloco era o primeiro do documento (`candidate.blockStart <= 1`). Isso gerava uma quebra espúria na posição inicial, empurrando todo o documento para a Página 2.
   - *Solução:* Foi adicionada uma salvaguarda estrita: se `targetLine === 0` e `candidate.blockStart <= 1`, a decisão direciona a quebra para `candidate.exactPos` com o motivo `natural_overflow`. O primeiro parágrafo é retido na Página 1 e apenas o seu transbordo migra para a Página 2.

2. **Absorção de `\n` terminal ([`src/controller.ts`](../../src/controller.ts)):**
   - *Causa:* Quando a quebra de página recaía imediatamente antes de um caractere `\n` (comum em código-fonte ou texto com quebras duras), esse `\n` era projetado no topo da folha seguinte, gerando uma linha em branco invisível mas mensurável que empurrava o conteúdo da folha em $15\text{ px}$ para baixo.
   - *Solução:* No aceite da decisão de quebra em `controller.ts`, quando o caractere na posição da quebra for `\n`, o offset é avançado em 1 (`decision.pos = decision.pos + 1`), fechando a linha na página atual e impedindo o surgimento de linha em branco espúria na página seguinte.

3. **Reatividade estrutural após edição ([`src/extension.ts`](../../src/extension.ts)):**
   - *Causa:* O gatilho de recálculo da paginação em `PaginationExtension` avaliava apenas `state.doc.content.size !== prevState.doc.content.size`. Ações que alteravam a estrutura do documento mantendo o mesmo tamanho de conteúdo (como a conversão de um `codeBlock` em `paragraph` ao teclar Backspace) não disparavam a repaginação, deixando decorações e spacers órfãos associados a nós DOM inexistentes.
   - *Solução:* A condição foi corrigida para `state.doc !== prevState.doc && (state.doc.content.size !== prevState.doc.content.size || !state.doc.eq(prevState.doc))`, garantindo que qualquer mutação semântica ou estrutural provoque o reagendamento seguro do layout.

---

## 3. Decisão Arquitetural: Consolidação do `composed` e Encerramento do `legacy`

### 3.1. Rationale e Fundamentação

A biblioteca possuía historicamente dois caminhos de apresentação visual:
1. **`legacy`:** O Core injetava imperativamente elementos DOM flutuantes (`.document-editor-chrome-layer`), manipulava o posicionamento CSS do elemento pai do editor (`parent.style.position = 'relative'`), alterava estilos inline (`editorEl.style.background = 'white'`) e pintava fundos brancos `#fff` e sombras dentro dos widgets de quebra do ProseMirror.
2. **`composed`:** O Core permanece estritamente neutro e focado em cálculo. Não injeta camadas flutuantes, não altera estilos do consumidor e preserva apenas bordas transparentes B1 (`1px solid transparent`) para a geometria de 1 px no box model. Toda a renderização de folhas de papel, margens, cabeçalhos e rodapés é delegada à camada externa [`@jhonny_bcastro/document-editor/presentation`](../../src/presentation/index.ts) (`createDocumentPresentation`), que consome as projeções calculadas (`calculatePageProjections`).

A manutenção de ambos os caminhos no mesmo código-fonte trazia severas desvantagens:
- **Divergência de comportamento:** O caminho `legacy` apresentava desvios acumulados de margem (ex.: 36 violações de margem no fixture PE-M em RC.4) e não representava o padrão visual aceito para o produto.
- **Acoplamento indevido no DOM:** A injeção de nós `.document-editor-chrome-layer` dentro do contêiner do consumidor violava o princípio de isolamento do editor e causava conflitos com frameworks modernos (React, Angular).
- **Código morto e sobrecarga de manutenção:** Manter bifurcações `if (visualMode === 'legacy')` nos métodos de decorações, no controller e nos testes impunha um custo contínuo de manutenção para dar suporte a um modo obsoleto.

### 3.2. Distinção Arquitetural dos Componentes

Para fundamentar as remoções perante os revisores, adotou-se a seguinte classificação:

| Categoria | Descrição | Tratamento Adotado |
|---|---|---|
| **Código e Testes Ativos** | Representam o comportamento atual e esperado da biblioteca (`visualMode: 'composed'`, bordas B1 transparentes, decorações desacopladas, `DocumentPresentation`). | **Preservados e consolidados como padrão único.** |
| **Código Executável Obsoleto** | Implementações exclusivas do chrome legado (`src/chrome.ts`, seletores `.document-editor-chrome-layer`, injeções de DOM, suporte a `chromeLayerElement`). | **Removidos do runtime.** |
| **Testes Obsoletos** | Testes que verificavam exclusivamente o comportamento de código morto excluído (`tests/unit/chrome.spec.ts`). | **Removidos.** |
| **Testes de Contrato Vigente** | Testes de estabilidade, limites de iteração, tabela, decorações, carrier e rejeição de modos inválidos. | **Adaptados para o contrato unificado `composed`.** |
| **Histórico Técnico e Decisões** | Benchmarks comparativos com RC.4, análises de limitações de 5.000 iterações, ADRs e registros de consolidação. | **Preservados integralmente na documentação.** |
| **Exemplos de Consumidores Antigos** | `examples/vanilla-consumer` (baseado em tarball RC.4 histórico) e backups. | **Preservados no disco sem modificações nesta etapa, com status registrado para futura decisão do usuário.** |

### 3.3. Remoção dos Contratos Públicos Residuais

Para evitar compatibilidade artificial que mascararia problemas na adoção da biblioteca:
- `PaginationVisualMode`: Tipado estritamente como `export type PaginationVisualMode = 'composed';`. O valor `'legacy'` foi removido do tipo.
- `chromeLayerElement`: Campo removido de `PaginationOptions` e da assinatura de `PaginationController`.
- **Rejeição estrita em runtime:** Se um consumidor tentar inicializar a extensão ou o controller com `visualMode: 'legacy'` (ou qualquer valor diferente de `'composed'`), o sistema lança imediatamente um `TypeError('Invalid pagination visualMode: expected "composed".')`, sem fallbacks silenciosos.

---

## 4. Responsabilidades Deliberadamente Preservadas

Durante a limpeza, as seguintes responsabilidades compartilhadas foram rigorosamente verificadas e preservadas:

1. **[`src/projection.ts`](../../src/projection.ts) (`calculatePageProjections`):**
   - Embora originalmente criado para auxiliar na projeção de folhas, este módulo é o elo matemático fundamental entre o Core e a Presentation. Ele converte os deslocamentos das quebras (`BreakDecision`) nos retângulos lógicos das páginas (`sheetRect`, `headerRect`, `footerRect`) no espaço de layout do documento. O módulo foi preservado integralmente.
2. **Regras CSS de tabelas em [`src/style.css`](../../src/style.css):**
   - As regras `.page-break-row > td` e `.page-break-row > th` foram mantidas intactas, pois implementam o mecanismo de espaçamento físico do `table-row-spacer` nas quebras intra-tabela.
3. **Arestas B1 transparentes em [`src/decorations.ts`](../../src/decorations.ts):**
   - Preservadas as bordas de `1px solid transparent` nos spacers de quebra para garantir a retenção da espessura física de 1 px no cálculo geométrico sem pintar linhas visíveis sobre o editor.
4. **Núcleo de cálculo e políticas:**
   - As políticas de orfandade/viuvez, prevenção de quebra em cabeçalhos (`keepWithNext`), cálculo de capacidade residual e controle de estabilidade assíncrona (`whenLayoutStable`) foram mantidas e validadas.

---

## 5. Dossiê de Evidências e Validação

Todas as evidências abaixo foram executadas e verificadas no ambiente de testes da cópia autorizada:

### 5.1. Suíte de Testes Unitários (`npm test`)
- **Comando:** `npm test` (Vitest v2.1.9 sob ambiente JSDOM)
- **Resultado:** **11 arquivos aprovados (11/11), 118 testes aprovados (118/118), 0 falhas.**
- **Duração média:** 3,45 segundos.
- **Arquivos cobertos:**
  - `tests/unit/core-stability.spec.ts` (5 testes)
  - `tests/unit/carrier-contributions.spec.ts` (14 testes)
  - `tests/unit/decoration-association.spec.ts` (25 testes)
  - `tests/unit/pagination-budget-recurrence.spec.ts` (11 testes)
  - `tests/unit/paint-mode.spec.ts` (28 testes)
  - `tests/unit/presentation.spec.ts` (12 testes)
  - `tests/unit/iteration-limit.spec.ts` (3 testes)
  - `tests/unit/long-continuous-block.spec.ts` (7 testes)
  - `tests/unit/structural-reactivity.spec.ts` (3 testes)
  - `tests/unit/projection.spec.ts` (4 testes)
  - `tests/unit/progress.spec.ts` (6 testes)

### 5.2. Verificação de Tipagem TypeScript (`npx tsc --noEmit`)
- **Comando:** `npx tsc --noEmit`
- **Resultado:** **Código de saída 0, nenhum erro de tipagem estática encontrado em todo o projeto.**

### 5.3. Build de Produção (`npm run build`)
- **Comando:** `npm run build` (Vite v6.4.3 para Core e Presentation)
- **Artefatos gerados com sucesso:**
  - `dist/document-editor.css` (0.28 kB)
  - `dist/pagination.es.js` (98.63 kB)
  - `dist/pagination.umd.js` (64.77 kB)
  - `dist/index.d.ts` (6.33 kB)
  - `dist/presentation/presentation.css` (0.61 kB)
  - `dist/presentation/index.es.js` (3.07 kB)
  - `dist/presentation/index.umd.js` (2.57 kB)

### 5.4. Verificação Automatizada no Live Demo (`examples/live-demo/check.cjs`)
- **Comando:** `node examples/live-demo/check.cjs`
- **Ambiente:** Google Chrome headless real, porta 8544.
- **Resultados obtidos por cenário:**
  - `PE-S` (1.1k docSize): 2 páginas, 1 quebra, 0 violações, idempotente.
  - `PE-M` (6.7k docSize): 6 páginas, 5 quebras, 0 violações de margem.
  - `PE-L` (25.7k docSize): 23 páginas, 22 quebras.
  - `mini` (11.2k docSize): 5 páginas, 4 quebras.
  - `p:370` (90.5k docSize): 31 páginas, 30 quebras.
  - `p:600` (146.8k docSize): 50 páginas, 49 quebras.

### 5.5. Teste de Estresse e Regressão do Texto Contínuo
- **Procedimento:** Limpeza total do editor via `commands.clearContent(true)` e inserção em lote de 33.898 caracteres (741 linhas do arquivo `src/controller.ts`).
- **Métricas registradas:**
  - **Tempo de layout e estabilização:** **138 ms**.
  - **Dimensão resultante:** 19 páginas, 18 quebras estruturais.
  - **Diagnósticos:** `[]` (nenhum diagnóstico `LAYOUT_ITERATION_LIMIT` ou advertência de truncamento).
  - **Posição da primeira linha:** `firstLinePage = 1`, `firstLineTop = 112px` (conteúdo inicia normalmente no topo da Página 1).
  - **Edição ativa após paginação:** Inserção e deleção de texto no início do documento (`pos = 1`) executadas com sucesso, com recálculo reativo confirmado via `whenLayoutStable()`.

---

## 6. Estado dos Exemplos e Consumidores

| Diretório | Finalidade e Descrição | Estado Atual | Recomendação para Frentes A e B |
|---|---|---|---|
| `examples/live-demo/` | Demonstração operacional do editor integrado com `DocumentPresentation`. Utiliza diretamente o código de `src/`. | Ativo, operando 100% no modo oficial `composed`. | Manter como exemplo oficial de referência. |
| `examples/vanilla-consumer/` | Consumidor experimental antigo configurado com o pacote histórico `document-editor-0.1.0-rc.4.tgz` na porta 8545. | Obsoleto. Depende de tarball legado e modo antigo. Preservado no disco sem alterações nesta etapa. | Avaliar remoção ou modernização após a homologação das frentes A/B. |
| `examples/vanilla-consumer.bak/` | Backup de consumidor com Tiptap 3. | Histórico. Não utilizado no pipeline de testes. | Pode ser excluído na limpeza final de repositório. |
| `examples/presentation-consumer/` | Demonstração isolada de renderização de snapshot sintético via `presentation`. | Standalone. Não integra editor ProseMirror completo. | Manter como referência de teste da biblioteca de apresentação. |

---

## 7. Limitações Conhecidas e Escopo Remanescente

1. **Ressalva geométrica residual no rodapé:**
   - Em páginas com tipografia alta e entrelinhas expressivas, a base da última linha de texto (`coords.bottom`) pode se aproximar excessivamente ou sobrepor em alguns pixels o indicador numérico do rodapé.
   - *Causa técnica:* O modelo de cálculo baseia-se no topo da linha (`coords.top`). Em margens compactas, a altura da linha consome parte da margem inferior nominal.
   - *Status:* Limitação visual conhecida preservada para tratamento quando for formalizado o subsistema de running content rico.
2. **Impressão em modo composto:**
   - A função `preparePrintSession` opera manipulando classes no `document.body` e foi desenhada originalmente para o modo legado. A impressão oficial no modo `composed` integrado com `DocumentPresentation` requer especificação própria de `@media print` para exportação PDF de alta fidelidade.
3. **Escopo estrito da cópia:**
   - Nenhuma alteração foi realizada na biblioteca canônica. A incorporação formal depende do fluxo de revisão descrito na seção seguinte.

---

## 8. Guia de Revisão para as Frentes A e B

As equipes de revisão técnica (Frente A e Frente B) devem atentar para os seguintes pontos de decisão arquitetural:

1. **Homologação da descontinuação do `legacy`:**
   - *Ponto de avaliação:* Avaliar se a biblioteca canônica deve adotar a remoção estrita do `legacy` (conforme implementado aqui) ou se exigirá um ciclo deprecado intermediário com warnings.
   - *Recomendação da cópia de testes:* Adotar a remoção estrita. Manter o modo legado impõe um custo de manutenção injustificado para um comportamento visual já rejeitado pelo produto.
2. **Contrato de tipos da extensão (`PaginationVisualMode` e `PaginationOptions`):**
   - *Ponto de avaliação:* Confirmar a remoção do campo `chromeLayerElement` e a restrição do tipo `PaginationVisualMode = 'composed'`.
3. **Reatividade do documento em `extension.ts`:**
   - *Ponto de avaliação:* Verificar se a checagem `!state.doc.eq(prevState.doc)` atende a todos os cenários de mutação sem overhead de performance em transações puras de seleção de cursor.
4. **Política de absorção de quebras de linha em código-fonte:**
   - *Ponto de avaliação:* Revisar o avanço `decision.pos + 1` para o caractere `\n` em `controller.ts` para confirmar compatibilidade com documentos contendo múltiplos nós de bloco contínuos e listas.
5. **Geometria de entrelinhas e margens B1:**
   - *Ponto de avaliação:* Confirmar a conformidade das bordas transparentes B1 (`1px solid transparent`) nos ambientes de destino do consumidor (navegadores Chrome, Firefox e Safari).

---
*Dossiê concluído e pronto para encaminhamento técnico.*
