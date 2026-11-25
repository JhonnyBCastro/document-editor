# Arquitetura

Descrição estática e formal da arquitetura Composed, incorporando o modelo nativo `AUTO-CSS-C01 V1` (elaborado na preparação de `24/11/2026` sobre a base canônica documental `fa199af49d0adabbd15d1a244b919451ff2a4d27`, tree `894f8badd5bd0cb83b3ad2f9c61deae582aad196`, sucessora do marco funcional pós-F3 `977f106c2fcf46771f46ae3a40813ddbc24f1297` após as Pull Requests #3, #16, #21, #19, #22 e #23). Naquela preparação de `24/11/2026`, a candidata encontrava-se pendente de revisão e integração, registro histórico que não estabelece o estado remoto de versões posteriores.

## Documento contínuo e responsabilidades

O documento semântico Tiptap/ProseMirror permanece contínuo. As quebras automáticas são decorações transitórias, não páginas no schema persistido. O consumidor define o schema, inclusive o nó de quebra manual, e controla persistência e exportação.

Core mede DOM e coordenadas, avalia políticas, calcula quebras e produz snapshots e decorações. Presentation desenha folhas e running content usando as projeções recebidas. Não cria Editor, não calcula quebras e não recebe responsabilidade de edição. A [Live Demo](../examples/live-demo/NOTES.md) faz uma montagem concreta dessas camadas; não é uma factory pública genérica.

## Composed-only e ownership visual

`composed` é o único modo suportado e o padrão. O controller rejeita outros valores; `chromeLayerElement` e o ChromeLayer legado não pertencem ao contrato atual. A remoção não significa ausência de decorações estruturais no DOM: o Core ainda insere os neutralizadores necessários ao fluxo. As arestas B1 transparentes preservam sua contribuição geométrica.

Na montagem manual, o consumidor monta o host da Presentation no mesmo espaço de coordenadas das projeções, sem somar novamente o gap. A Presentation cria e remove seus próprios elementos e disposers. A coordenação do Editor e de seus hosts continua a cargo do consumidor na montagem manual. Veja o [ADR-004 retrospectivo](decisions/ADR-004-composed-only.md).

Na composição coordenada, a factory cria seus recursos e deriva a geometria estrutural inicial de `layout.page`. A Presentation continua aplicando projeções, sem calcular paginação. Quando provisionada opcionalmente via `options.debugOverlay`, a camada diagnóstica (`Debug Overlay V1`) consome exclusivamente os `LayoutSnapshot` publicados pelo Core dentro do mesmo `DocumentLayoutSpace` (via `render(snapshot)` síncrono sem retroalimentação ao Core), mantendo isolamento operacional e tratamento de falhas próprio sem constituir outro motor de paginação. As garantias da factory não são transferidas implicitamente ao Core ou à Presentation isolados. Estilos métricos e mudanças externas continuam sujeitos aos limites documentados.

## Estado de decorações, publicação transacional e recuperação

Na integração com `PaginationExtension`, `DecorationSet` pertence ao estado do plugin `PaginationPluginKey`. `apply` remapeia as decorações nas transações comuns. O controller lê e publica por uma bridge interna; não mantém uma segunda cópia ativa independente nessa integração.

No modelo nativo `AUTO-CSS-C01 V1`, esse mesmo `Plugin` gerado em `PaginationExtension` expõe `props.attributes` com `{ class: 'document-editor-paginated' }` na raiz editável `.ProseMirror` associada à extensão (sem alterar schema nem JSON do documento; na factory `createDocumentEditor` o Editor utiliza `injectCSS: false`, enquanto na montagem manual a opção `injectCSS` pertence ao Editor consumidor, não sendo imposta pela extensão e permanecendo distinta da importação explícita de `@jhonny_bcastro/document-editor/style.css`). Esse marcador permite que `@jhonny_bcastro/document-editor/style.css` aplique nativamente as regras `CSS C-01` em `.ProseMirror.document-editor-paginated` e `.ProseMirror.document-editor-paginated pre` (especificidades `(0,2,0)` e `(0,2,1)`).

Em relação ao isolamento visual entre instâncias: observou-se isolamento CSS em relação a editores externos independentes fora da subárvore de um editor paginado; entretanto, não se afirma ausência de interferência em qualquer editor sem `PaginationExtension`. Em editores externos fisicamente aninhados na raiz de um editor paginado (e.g. via `NodeView`), a raiz interna não recebe o marcador `document-editor-paginated`, porém pode herdar `white-space` e `overflow-wrap` da raiz envolvente quando não os redefine, e elementos `<pre>` internos recebem diretamente o seletor descendente `.ProseMirror.document-editor-paginated pre`. A interferência CSS foi demonstrada nessa topologia aninhada (sem falha funcional ou corrupção documental demonstradas), constituindo aceitação delimitada na decisão `D-01` — e não correção técnica nem isolamento completo.

A publicação usa transação sem steps e payload `replaceDecorations`, vinculado à identidade do documento e marcado por token único (`Symbol`) rastreado síncronamente durante o dispatch. A bridge distingue explicitamente três desfechos internos:

1. **Instalação válida (`installed`):** a transação de publicação foi processada sobre o documento alvo, o documento final permanece idêntico, o token é confirmado no estado do plugin sem invalidação e o `DecorationSet` lido pós-dispatch corresponde à referência publicada.
2. **Invalidação documental concorrente (`invalidated_by_doc_change`):** a transação de publicação foi comprovadamente processada pelo plugin, mas uma mutação documental legítima subsequente no mesmo dispatch (por exemplo um `appendTransaction`, como o `TrailingNode` do `StarterKit` 3) alterou o documento e remapeou as decorações sobre o novo estado. Essa invalidação legítima não é tratada como falha de instalação; o plugin suprime o reagendamento cego em `view.update()` enquanto `publish()` está ativo para evitar agendamento duplicado.
3. **Falha efetiva de instalação ou integridade (exceção):** mantêm-se todas as guardas negativas (controller destruído, divergência de documento, payload inválido, steps na transação de publicação, rejeição por `filterTransaction`, `dispatchTransaction` descartado/no-op ou ausência de confirmação no estado final).

No `PaginationController`, a recuperação de `invalidated_by_doc_change` é governada por um **orçamento contínuo de invalidações por tentativa de estabilização** (limite de três invalidações, usando a constante `MAX_CONVERGENCE_PASSES = 3`), distinto do **limite histórico de três passes de convergência por ciclo**:

- Publicações intermediárias válidas (`deferStableIfChanged && changed`) e reagendamentos internos preservam o orçamento sem reinicializá-lo.
- Cada publicação invalidada consome `1` unidade do orçamento, preserva `pendingCyclePublishedChanges = true`, aborta o ciclo corrente sem emitir snapshot obsoleto nem incrementar `revision` e agenda nova rodada enquanto o total permanecer abaixo de três.
- Ao atingir o limite de três invalidações, o controller marca esgotamento (`publicationRecoveryExhausted`), interrompe o reagendamento automático, emite advertência operacional via `console.warn` (`LAYOUT_CONVERGENCE_LIMIT` — sem emitir snapshot nem registrar diagnóstico em snapshot publicado) e impede contorno por reagendamentos internos ou chamadas repetidas de `whenLayoutStable()`.
- A reinicialização legítima do orçamento ocorre exclusivamente ao concluir uma estabilização (incluindo quando o limite histórico de três passes aceita um snapshot parcialmente estabilizado, sem que isso signifique convergência completa) ou diante de alteração externa legítima (`notifyExternalDocumentChange()`, disparado fora do dispatch de publicação, ou `setLayout()`). A destruição do controller (`destroy()`) bloqueia permanentemente qualquer retomada.

Esses mecanismos permanecem internos à bridge e ao controller; não constituem novas APIs públicas de composição. A construção direta do controller sem bridge conserva armazenamento local para usos internos e testes.

## Reatividade e estabilidade

A detecção documental exige mudança de referência e, então, mudança de tamanho ou diferença segundo `Node.eq`. Alterações de texto, marcas ou atributos podem, portanto, agendar cálculo mesmo com tamanho e estrutura preservados. Documento equivalente, seleção pura e publicação neutra não implicam novo agendamento sem outro sinal. Isso não observa mudanças externas de geometria nem garante prazo de estabilização ou ausência de travamentos. O sinal interno independente `settingsChanged` permanece distinto dessa detecção. A descrição completa está na [API](api.md).

`settingsChanged` é recalculado por `apply` em cada transação, voltando a falso quando o metadado não está presente. O debounce libera o handle do timer antes de renderizar. Isso não garante observação de CSS/fontes externas nem idempotência entre rodadas. `whenLayoutStable` observa estabilização local, não correção física permanente.

## Orçamento de capacidade e contribuição dos neutralizadores (Bloco B)

A determinação de alvos de quebra distingue a origem na viewport (`editorRect.top`) e a margem superior da página para definir o início do espaço projetado ($A = \text{editorRect.top} + \text{marginTop}$). O espaço neutro é obtido descontando da coordenada física bruta a contribuição acumulada dos neutralizadores estruturais precedentes ($n = \text{rawTop} - \text{cumulativeDisplacement}$).

A determinação de alvos de quebra adota a recorrência de capacidade estrita:
$$T_1 = A + U$$
$$r_i = \max(0, T_i - n_i)$$
$$D_i = G + r_i$$
$$T_{i+1} = T_i + U - r_i$$
onde $A$ é a coordenada inicial do editor compensada pela margem superior, $U$ é a altura útil nominal da folha, $G$ é o gap total entre páginas, $n_i$ é a coordenada neutra da quebra e $r_i$ é a folga residual. Ao atualizar $T_{i+1}$ subtraindo a folga consumida $r_i$, o orçamento disponível na folha seguinte restabelece exatamente $U$ no ramo nominal, eliminando a transferência e o acúmulo de folgas em quebras antecipadas sucessivas. Em condições de overshoot ($n_i > T_i$), fixa-se $r_i = 0$, $D_i = G$ e $T_{i+1} = T_i + U$, de modo que a capacidade residual na página seguinte torna-se $U - (n_i - T_i) < U$, preservando a regra de avanço sem gerar folgas negativas nem garantir capacidade útil intacta.

As decorações estruturais inseridas pelo Core são identificadas pelo protocolo de metadados tipados no campo `spec` (`PaginationDecorationSpec` com `structural: true`, `effectiveDisplacement`, `origin`, `renderer` e `reasons`). O acumulador de deslocamento `getCumulativeDisplacement` soma exclusivamente decorações com `spec.structural === true`, conferindo finitude estrita e integridade numérica em cada elemento. Decorações de terceiros e overlays visuais declarados com `structural: false` (como o overlay visual das tabelas) contribuem exatamente zero, prevenindo contagem espúria ou duplicada.

A integridade do protocolo de metadados e das decisões de quebra é garantida por validações em múltiplos estágios (B-R1 e B-R2):
1. **Validação de carriers instalados:** no início do ciclo de layout, todos os carriers estruturais presentes no `DecorationSet` instalado são validados contra o documento (posições `from` e `to` da própria `Decoration` no intervalo `[0, docSize]` com `to >= from`, deslocamento numérico finito não negativo, `renderer` canônico obrigatório pertencente a `{'linear-widget', 'table-row-spacer', 'manual-spacer'}`, `origin` opcional em `{'automatic', 'manual'}` e `reasons` como array denso de strings).
2. **Validação de decisões de política:** assim que uma decisão (`BreakDecision`) é retornada por uma política linear ou tabular, sua forma (`pos`, `renderer`, `origin`, `reasons`) é validada imediatamente antes de qualquer normalização ou invocação de `reasons.join`, inclusive no ramo de diagnóstico de decisões bloqueadas (`status: 'blocked'`).
3. **Validação de deslocamento:** o deslocamento efetivo $D_i$ é validado pelo controller logo após o cálculo derivado da folga residual.
4. **Validação pré-comparador e pré-fábrica:** ambas as coleções (`currentStructural` e `breaks`) são validadas integralmente antes da execução do comparador e antes de qualquer chamada à fábrica de decorações, inclusive quando o resultado comparativo for de ausência de alteração (`changed = false`).
5. **Array denso de razões (B-R1):** a validação de `reasons` verifica que cada índice de `0` até `length - 1` é propriedade própria do array e contém valor do tipo `string`. Arrays vazios `[]` são válidos; lacunas (sparse arrays), índices herdados de protótipos, valores nulos, indefinidos, números ou objetos provocam rejeição imediata, sem compactação, normalização ou preenchimento silencioso. O comparador canônico acessa `reasons` diretamente sem fallbacks sintéticos (`reasons || []`), comparando estritamente tamanho e valores ordenados.

A reavaliação de layout adota um comparador canônico que ordena as decorações estruturais ativas crescentemente por posição física (`from`) e compara cinco campos semânticos (`pos`, `effectiveDisplacement`, `origin`, `renderer` e `reasons`). Na ausência de alterações estruturais, uma nova publicação transacional é suprimida. A revisão é preservada quando também não existe publicação anterior pendente de contabilização; após recuperação com decorações equivalentes, essa pendência ainda pode produzir um único incremento no trecho de aceitação do resultado. Falhas numéricas ou corrupções de metadados acionam aborto atômico pré-publicação (`PaginationCorruptedSpecError`), mantendo as decorações ativas inalteradas e preservando aguardantes de estabilização sem corromper o estado do editor (DEC-05). O modelo algébrico e o protocolo de leitura uniforme constituem a implementação canônica interna, sem declarar comprovação física ou homologação de testes ainda não executados.


## Lifecycle, tabelas e impressão

As decorações tabulares operam nas fronteiras de linhas reais; fragmentação dentro de uma linha/célula não é suportada genericamente. A existência dessas políticas no Core não torna os cenários tabulares disponíveis na Demo atual.

A Presentation dispõe seus próprios elementos; na montagem manual, o consumidor destrói Editor e Presentation. O Core não monta ChromeLayer. A preparação de impressão altera temporariamente o layout e uma classe global em `document.body`, com lock; impressão composta e multi-instância continuam limitadas.

## Alcance das evidências

A recorrência e os protocolos internos não são prova de geometria DOM/CSS para todo conteúdo. No ciclo CONS-014, os três cenários do checker registraram nova rodada (`freshLayoutRound: true`), mas `idempotent: false`, além de violações geométricas. O retorno zero do processo não converte esses campos em aprovação.

Testes unitários, builds e observações manuais têm alcances distintos. Veja [limitações](limitations.md), [proveniência](provenance.md) e [backlog](backlog.md). Relatórios anteriores ficam no [arquivo histórico](archive/README.md).
