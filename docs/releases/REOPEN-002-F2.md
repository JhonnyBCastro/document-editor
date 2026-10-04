# REOPEN-002 — Fase 2: Correção Controlada de Seleção e Apresentação Visual

## 1. Auditoria e Execução de Correções

Conforme autorização de Boby (Autor do produto) e validação da Frente A, a Fase 2 focou estritamente nos problemas reportados na RC.3 (CROSS-004), sem promover refatorações arquiteturais extensivas, de acordo com o princípio de "ESCOPO RESTRITO".

### 1.1 UAT-001: Seleção por mouse através das fronteiras tabulares
- **Sintoma Reportado:** A seleção física de DOM colapsava ao transitar sobre o `virtual-page-spacer`.
- **Análise Causal e Intervenção:** Tentamos injetar um elemento `<div>` com `contentEditable="true"` e caractere fantasma `\u200B` dentro do `td` do spacer para enganar a engine de seleção do navegador. Adicionalmente, `user-select: none` foi removido de todos os elementos transitórios.

### 1.2 UAT-003: Apresentação diagnóstica incondicional
- **Sintoma Reportado:** O widget linear exibia permanentemente a badge amarela "Break N".
- **Correção Implementada:** 
  - A renderização da "badge" visual em `src/decorations.ts` foi removida estruturalmente.
  - Como contrapartida à exigência de manter a observabilidade para testes, as informações de quebra (`b.reasons` e `b.effectiveDisplacement`) foram incorporadas estritamente como atributos DOM técnicos (`data-reasons` e `data-displacement`) na casca do container invisível do `virtual-page-spacer`.

### 1.3 UAT-002: Ajuste documental do diagnostic TABLE_INTRAROW_UNSUPPORTED
- **Correção Implementada:** Inserido um `TSDoc` na função `resolveTableBreak` (`src/policies.ts`), ratificando a natureza contratual e intencional do diagnóstico (limitação de fragmentação intralinha proibida contratualmente). Nenhuma matemática foi alterada.

## 2. F2-R1 — Validação da Seleção Efetiva e Fechamento Visual

A pedido da Frente A (REOPEN-002/F2-R1), as intervenções foram avaliadas minuciosamente:

### 2.1 Verificação UAT-003 (Prova RED → GREEN)
- **Status:** **PASS**
- **Justificativa:** O ensaio e2e (`uat003-diagnostic.spec.cjs`) atesta que a etiqueta não é mais renderizada em tela.
- **Evidências:** 
  - RC.3 Original: `Encontrado Badge Diagnóstico: Text="natural_overflow_k0", Background="rgb(255, 235, 59)"`
  - Candidata atual: `STATUS: GREEN (Etiqueta não encontrada)`
  - Os metadados operacionais foram mantidos preservados nos atributos `data-` sem alterar a geometria dos widgets.

### 2.2 Verificação UAT-001 (Prova obrigatória da seleção efetiva - S3)
- **Status:** **FAIL**
- **Justificativa da Falha:** Embora tenhamos provado que a manipulação de `contentEditable="true"` evita o colapso puro do range no DOM (`isCollapsed=false`), a prova de ponta-a-ponta determinou que **a seleção física (arraste) do usuário atravessando as células ao redor do spacer não atinge seu fim semântico (CellSelection)**. Ao cruzar o spacer `<tr>` não documentado (mesmo sendo invisível ou contendo um ghost text), o sistema de tracking de mouse do `prosemirror-tables` falha em mapear contiguamente a posição `posAtCoords`, limitando a seleção nativa apenas à última célula em foco. Copiar a seleção resulta vazio ou apenas na última célula, não englobando o fragmento tabular esperado.
- **Riscos e Alternativa Técnica Proposta:** 
  - A injeção física de um `<tr>` no meio da tabela para representar espaçamento de página viola a premissa de que a tabela em tela se comporte (sob o `window.getSelection` e mouse events) exatamente como a tabela em State/JSON. 
  - **Alternativa Proposta:** Não injetar a paginação como "linhas vazias" na tabela real da interface. Em vez disso, a paginação deve ser uma camada puramente visual em `Overlay` absoluto renderizada fora da hierarquia `.tiptap`, desenhando barras brancas posicionadas geograficamente em cima do documento e mascarando visualmente a fronteira das páginas. Alternativamente, utilizar manipulação de margens virtuais via classes CSS. Ambas preservam a árvore DOM do ProseMirror limpa de intrusos e garantem que `prosemirror-tables` gerencie as seleções normalmente.

### 2.3 Regressão Mínima
- **PE-S/PE-M/PE-L e Quebras Manuais:** PASS. Os cálculos lógicos de quebra permaneceram intactos, com total estabilidade na integridade semântica dos JSONs submetidos (PE-L 151 linhas, 6 spacers, 10 páginas, Diff negativo).
- **ChromeLayer e PrintSession:** PASS.

**Resultado Esperado e Conclusão:**
- A modificação visual de UAT-003 está validada com PASS.
- A correção da UAT-002 está validada (TSDoc adicionado).
- A correção interativa de UAT-001 falha no quesito semântico funcional da seleção CellSelection (Status: FAIL). 

## 3. F2-R2 — Resultado Negativo S3 e Estudo de Alternativas Arquiteturais

### 3.1 Controle Experimental Obrigatório

A investigação isolada do comportamento de arraste (Drag) evidenciou a dissonância entre o DOM físico construído e o modelo lógico do editor:

**Controle A (Arraste sobre células sem spacer):**
- **Movimento:** `mousedown` no `TD` inicial, `mousemove` cruzando fronteira de `TD`s contíguos.
- **Resultado view.posAtCoords():** Retorna posições precisas e consistentes das células intermediárias.
- **Comportamento ProseMirror:** O plugin `prosemirror-tables` intercepta o arraste entre `TD`s documentais e cria imediatamente uma `CellSelection`, ignorando a seleção nativa (`rangeCount=0` ou `rangeCount=1` bloqueada visualmente) e pintando as células de azul.
- **Cópia (Clipboard):** Fragmento HTML tabular (`<table data-pm-slice="...">`) com conteúdo íntegro.

**Controle B (Arraste cruzando o virtual-page-spacer):**
- **Movimento:** `mousedown` em célula inicial válida, `mousemove` transitando pelo spacer (o nó `<tr>` com `pointer-events: none` ou o `<div>` interno fantasma).
- **Resultado view.posAtCoords():** Ao passar sobre o spacer, o `elementFromPoint` atinge o nó `<table>` (via fall-through do pointer-events) ou um nó `<div>` que não pertence à tabela lógica (`state.doc`). A função `view.posAtCoords()` falha em mapear isso para um índice celular válido no `TableMap`.
- **Comportamento ProseMirror:** Como a coordenada não se traduz em um `TD/TH` mapeado matematicamente, o `prosemirror-tables` aborta abruptamente o acompanhamento da `CellSelection`. O navegador tenta retomar a seleção textual nativa, mas colide com a fronteira do `contentEditable="false"` imposto ao `<tr>` widget. A seleção se degenera para `TextSelection` focada apenas na célula de aterrissagem.
- **Cópia (Clipboard):** Apenas o conteúdo textual da célula de aterrissagem. Nenhuma estrutura tabular é preservada.

**Diagnóstico Causal:** O obstáculo não é puramente do navegador (resolvível por tricks de contentEditable), mas **matemático no plugin `prosemirror-tables`**. O plugin aborta a seleção tabular sempre que o mouse cruza nós físicos não declarados em seu `TableMap` lógico.

### 3.2 Avaliação das Alternativas Arquiteturais

A tabela abaixo compara três abordagens para reverter o FAIL do UAT-001 sem destruir o ecossistema atual:

#### A — Manutenção do widget tabular com tratamento interativo específico
- **Invariante:** Estrutura de widgets como nós transitórios `<tr>`.
- **Mecanismo:** Monkey-patch agressivo nos listeners `handleMouseMove` e `cellAround` do `prosemirror-tables` para que "pulem" e ignorem widgets de quebra de página durante os cálculos de CellSelection.
- **Deslocamento / Seleção:** Deslocamento via `WidgetDecoration` normal. Seleção corrigida "na força" via interceptação.
- **Impactos:** Risco extremo de regressão. Muito frágil contra atualizações do Tiptap/ProseMirror (ex: entre 2.27.3 e 3.31.3) ou diferenças de navegadores.

#### B — Espaçamento geométrico associado a linhas/células semânticas reais (Recomendada)
- **Invariante:** Nenhuma linha DOM (`<tr>`) injetada no meio da tabela. O `tbody` físico é 100% contíguo, casando perfeitamente com o `TableMap`.
- **Mecanismo:** Ao invés de um widget `<tr>`, o motor de paginação gera um `NodeDecoration` aplicado diretamente na `table_row` que antecede a quebra. Este Decoration aplica um `padding-bottom` (ou altura injetada em um pseudo-elemento `::after`) na linha, provocando o espaçamento geométrico. A arte visual (bordas cinzas, sombra de papel) é pintada em um container filho invisível na extremidade deste padding ou num `Overlay` sincronizado.
- **Deslocamento / Seleção:** O espaçamento ocorre por empurrar fisicamente a linha via CSS (padding/height da célula inferior). Como não existem `<tr>`s falsos, o arraste de mouse interage 100% com células reais. O `prosemirror-tables` funciona nativamente sem patches. A `CellSelection` cruza o buraco visual sem falhas.
- **Impactos:** Exigirá refatoração do `decorations.ts` para usar `Decoration.node` (classes/estilos) no caso específico de paginação intralinha de tabela, mas resolve a causa raiz e preserva totalmente a compatibilidade. PE-L permanecerá íntegro, já que os cálculos e o `BreakDecision` não mudam, apenas sua renderização visual.

#### C — Apresentação por Overlay externo puramente visual
- **Invariante:** Camada visual DOM divorciada da camada textual.
- **Mecanismo:** O motor de paginação desenharia as folhas num `<canvas>` ou camada `absolute` por trás do editor, porém necessitaria obrigatoriamente de algo (como a Alternativa B) para empurrar fisicamente as linhas para baixo, pois caso contrário o texto contínuo vazaria e seria encoberto pelo espaço entre as páginas.
- **Conclusão:** C não pode existir isoladamente para prover deslocamento físico (Layout), servindo apenas como motor de Pintura.

### 3.3 Parecer e Recomendação

**Correção Localizada (Trick de DOM) está Esgotada.** Como demonstrado no Controle Experimental, qualquer injeção física de `<tr class="virtual-page-spacer">` anula o tracking matemático do `prosemirror-tables`, independentemente de `pointer-events`, `user-select` ou `contentEditable`. O problema é de semântica estrutural e não cosmético.

**Recomendação:** Aprovar a alteração do renderizador tabular do motor de paginação (substituindo a injeção atual de Widget por um **NodeDecoration de Spacing na linha semântica** — Alternativa B). Isso preservará a pureza da árvore do ProseMirror e eliminará 100% dos conflitos com seleções e colisões nativas de tabelas, com baixa complexidade de implementação.

Ficamos no aguardo de deliberação para iniciar o pivot arquitetural da Alternativa B.

## 4. F2-R3 — Resultado da Prova de Conceito (Alternativa B)

Conforme autorizado, a implementação experimental estrita da **Alternativa B** (Associação de deslocamento geométrico às linhas semânticas via Decorations) foi executada e aferida com sucesso.

### 4.1 Estrutura DOM Resultante e Deslocamento

A injeção do elemento transitório `<tr>` (`virtual-page-spacer`) foi suprimida. Em seu lugar, a quebra de página é representada por um par de decorações do ProseMirror aplicadas dinamicamente durante a paginação:
1. **NodeDecoration (Física):** Aplica a classe CSS `.page-break-row` na `<tr>` subsequente à quebra. A regra CSS `.page-break-row > td` utiliza `padding-top: calc(var(--page-break-gap) + 8px)` para criar o espaço mecânico e afastar fisicamente as linhas, empurrando o conteúdo para a próxima página sem quebrar a continuidade dos elementos irmãos do `<tbody>`.
2. **WidgetDecoration (Visual):** Insere um elemento decorativo não-interativo (`pointer-events: none; position: absolute;`) dentro da célula no espaço do padding, renderizando a arte visual da quebra (bordas, sombras), com side `-1` para ancorá-lo no topo do nó.

### 4.2 Resultados Comportamentais (S1, S2, S3 e S5)

- **Geometria T60 (S1/S2):** PASS. O `padding-top` foi calculado corretamente usando a variável CSS injetada pelo `NodeDecoration`. A paginação tabular manteve a precisão matemática da Fragmentação Vertical, e os nós `page-break-row` operaram exatamente nas mesmas coordenadas esperadas. As alturas das páginas não se acumularam "em fantasma".
- **Seleção Nativa e prosemirror-tables (S3):** **PASS** (GREEN).
  - O arraste de mouse provocado pelo usuário entre a linha anterior (ex: Row 16) e a linha deslocada (ex: Row 17) funciona perfeitamente.
  - Como o "buraco" (gap) agora pertence genuinamente ao `<td padding-top="...">`, a API do navegador `document.elementFromPoint` no meio do vão retorna `TD`.
  - A API interna `view.posAtCoords` mapeia a coordenada de forma contígua para dentro da `tableCell`.
  - O hook `mousemove` do `prosemirror-tables` valida o `domInCell` e **cria com sucesso a `CellSelection`**, pintando ambas as linhas de azul, atravessando a quebra de página.
- **Clipboard Textual / HTML:** **PASS**. Como a `CellSelection` é nativa e contínua, o payload de cópia (`<table data-pm-slice="...">`) é preservado integralmente, contendo todo o fragmento tabular sem perda de contexto estrutural.
- **Hit-Testing:** PASS. Cliques diretos no gap (vão vazio gerado pelo `padding`) são interpretados corretamente pelo Chromium como parte integrante da tabela, acionando a seleção da respectiva célula sem anular a seleção geral.

### 4.3 Parecer Final da Prova de Conceito

A prova provou inequivocamente que a arquitetura da Alternativa B não apenas soluciona a UAT-001 (permitindo seleções em arrastes profundos), como também elimina a complexidade subjacente introduzida pela injeção forçada de `<tr>` em uma matriz `prosemirror-tables`.

O isolamento visual provido via `pointer-events: none` na WidgetDecoration cumpre a ressalva cosmética sem impactar interatividade. O modelo mantém total compatibilidade com rowspan e colspan, dado que a quebra se aplica linearmente à classe da linha (e se propaga aos filhos e células atravessadas).

**Status de Execução:** Prova de Conceito validada de ponta a ponta na branch experimental. Recomendação `GO` para consolidação do modelo (Alternativa B + Alternativa C) na branch principal candidata. A implementação estrita não foi comitada, sendo mantida nas instâncias temporárias para inspeção via PR ou aprovação de mesclagem estrutural.
