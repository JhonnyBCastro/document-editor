# Arquitetura

Referência: `dev/cons014-composed-20261022`, commit `1962cdbb3456cc989b064017137d48a8df143d3d`. Descrição estática da implementação; não transfere homologações de distribuições anteriores.

## Documento contínuo e responsabilidades

O documento semântico Tiptap/ProseMirror permanece contínuo. As quebras automáticas são decorações transitórias, não páginas no schema persistido. O consumidor define o schema, inclusive o nó de quebra manual, e controla persistência e exportação.

Core mede DOM e coordenadas, avalia políticas, calcula quebras e produz snapshots e decorações. Presentation desenha folhas e running content usando as projeções recebidas. Não cria Editor, não calcula quebras e não recebe responsabilidade de edição. A [Live Demo](../examples/live-demo/NOTES.md) faz uma montagem concreta dessas camadas; não é uma factory pública genérica.

## Composed-only e ownership visual

`composed` é o único modo suportado e o padrão. O controller rejeita outros valores; `chromeLayerElement` e o ChromeLayer legado não pertencem ao contrato atual. A remoção não significa ausência de decorações estruturais no DOM: o Core ainda insere os neutralizadores necessários ao fluxo. As arestas B1 transparentes preservam sua contribuição geométrica.

O consumidor monta o host da Presentation no mesmo espaço de coordenadas das projeções, sem somar novamente o gap. A Presentation cria e remove seus próprios elementos e disposers. A coordenação do Editor e de seus hosts continua a cargo do consumidor. Veja o [ADR-004 retrospectivo](decisions/ADR-004-composed-only.md).

## Estado de decorações e publicação transacional

Na integração com `PaginationExtension`, `DecorationSet` pertence ao estado do plugin `PaginationPluginKey`. `apply` remapeia as decorações nas transações comuns. O controller lê e publica por uma bridge interna; não mantém uma segunda cópia ativa independente nessa integração.

A publicação usa transação sem steps e payload `replaceDecorations`, vinculado à identidade do documento. A bridge verifica a instalação síncrona e os guards de lifecycle antes de aceitar a publicação. Esses mecanismos internos não são uma API pública de composição. A construção direta do controller sem bridge conserva armazenamento local para usos internos e testes.

## Reatividade e estabilidade

O predicado atual é mudança de referência do documento combinada com mudança de tamanho ou `hasStructuralChange`, além do sinal independente `settingsChanged`. A comparação estrutural visita quantidade e tipos de nós; não compara genericamente texto, marcas ou atributos e não usa `doc.eq()`. A descrição completa está na [API](api.md).

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

A reavaliação de layout adota um comparador canônico que ordena as decorações estruturais ativas crescentemente por posição física (`from`) e compara cinco campos semânticos (`pos`, `effectiveDisplacement`, `origin`, `renderer` e `reasons`). Na ausência de alterações estruturais, a publicação transacional é suprimida e a revisão é preservada. Falhas numéricas ou corrupções de metadados acionam aborto atômico pré-publicação (`PaginationCorruptedSpecError`), mantendo as decorações ativas inalteradas e preservando aguardantes de estabilização sem corromper o estado do editor (DEC-05). O modelo algébrico e o protocolo de leitura uniforme constituem a implementação canônica interna, sem declarar comprovação física ou homologação de testes ainda não executados.


## Lifecycle, tabelas e impressão

As decorações tabulares operam nas fronteiras de linhas reais; fragmentação dentro de uma linha/célula não é suportada genericamente. A existência dessas políticas no Core não torna os cenários tabulares disponíveis na Demo atual.

A Presentation dispõe seus próprios elementos; o consumidor destrói Editor e Presentation. O Core não monta ChromeLayer. A preparação de impressão altera temporariamente o layout e uma classe global em `document.body`, com lock; impressão composta e multi-instância continuam limitadas.

## Alcance das evidências

A recorrência e os protocolos internos não são prova de geometria DOM/CSS para todo conteúdo. No ciclo CONS-014, os três cenários do checker registraram nova rodada (`freshLayoutRound: true`), mas `idempotent: false`, além de violações geométricas. O retorno zero do processo não converte esses campos em aprovação.

Testes unitários, builds e observações manuais têm alcances distintos. Veja [limitações](limitations.md), [proveniência](provenance.md) e [backlog](backlog.md). Relatórios anteriores ficam no [arquivo histórico](archive/README.md).
