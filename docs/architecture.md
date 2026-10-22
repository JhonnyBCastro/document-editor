# Arquitetura vigente

Corte documental: 18/10/2026. Separação entre documento semântico contínuo e paginação visual (“Rota B”). Não substituir ADRs/releases históricos por este estado vigente.

## Responsabilidades

Core mede DOM (`getClientRects`, `offsetHeight` e coordenadas), avalia políticas/quebras e produz LayoutSnapshot/projeções e Decorations. O consumidor fornece schema/content/UI e significado do nó manual configurável. Quebras tabulares usam espaçadores nas fronteiras de linhas, sem fragmentação intralinha suportada.

## Ownership de decorações e publicação transacional (Bloco A)

No caminho integrado com a extensão TipTap (`PaginationExtension`), o `DecorationSet` pertence unicamente ao estado do plugin ProseMirror (`PaginationPluginKey`), sendo atualizado de forma transacional pura via `apply` e remapeado automaticamente (`set.map(tr.mapping, tr.doc)`). Os contratos de estado e payload da publicação são tipos internos, não exportados no barrel público do pacote. O `PaginationController` integrado não mantém cópia ativa independente: todas as leituras geométricas e comparativas consultam o estado do documento ativo através de uma ponte interna (`PaginationDecorationBridge`). A publicação de um novo layout ocorre via transação sem steps com payload discriminado (`kind: 'replaceDecorations'`), sendo conferida a efetiva instalação síncrona no `view.state` e o estado de ciclo de vida antes de emitir estabilidade ou incrementar revisão.

No modo standalone / construção direta sem ponte (preservado para compatibilidade e testes locais), o controller mantém o armazenamento local histórico (`currentDecorations`) e despacho direto. Guards de destruição asseguram que instâncias descartadas não publiquem nem reagendem após `destroy()` (inclusive se o descarte ocorrer de forma reentrante durante o dispatch), e nenhum despacho de limpeza é realizado durante o teardown da view.

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

Presentation é entrada independente: pinta sheets/running content a partir do snapshot no host coordenado, com render/clear/destroy e disposers locais. Não calcula paginação, não cria Editor, não promete editor integrado. Integração oficial deverá definir fonte de layout, ownership, insets, atualização, estabilidade e descarte; permanece planejada. Consumidor experimental não equivale a factory/bridge pública pronta.

## Legacy/default e composto opt-in

`visualMode` é seleção explícita e fixa. Omissão=legacy preserva chrome/pintura histórica; host externo chromeLayerElement continua opção legado. Composed rejeita esse host, não cria chrome legado e não escreve pintura documental do Core nos estilos do consumidor. Mantém os mecanismos geométricos e quatro arestas decorativas 1px/solid com cor transparente (B1), em vez de retirar contribuição de borda. Linear/manual/tabular, nós/dimensões/metadados/compensações não receberam redesign.

Composed não fornece sozinho folha/insets/rolagem ou running content pronto. Presentation deve ser montada e coordenada pelo consumidor segundo contratos próprios; automação de insets, atualização pública e composição/print oficial permanecem pendentes.

## Estabilidade e atualização

Correção mínima: scheduleRender libera renderTimeout=null quando o callback é consumido, antes de renderVirtualPages; debounce 100ms existente preservado. Promessas/callbacks representam conclusão local da rodada. Não são garantia de geometria permanente ou de todos os eventos de alteração de layout.

O plugin agenda por tamanho de conteúdo/metadado de configuração. Mudança sem diferença de tamanho pode alterar medidas e não ser coberta por esse trigger. Há fonts.ready/frame cuja cobertura integral de cancelamento não é demonstrada. Não ampliar scheduler/triggers/políticas/snapshot nesta consolidação.

## Lifecycle e impressão

Core cria/descarta somente chrome próprio no legado e trata host externo sem apropriar filhos do consumidor. Presentation descarta recursos de render/disposers e host interno; host externo e Editor têm coordenação a cargo do consumidor. Cleanup de uma campanha não demonstra descarte completo de toda combinação de instâncias.

preparePrintSession altera layout temporário e classe global document.body, conserva lock até restore e devolve snapshot; host realiza impressão. Dependência global limita multi-instância. Impressão composta oficial não foi validada; PDF institucional e motor do browser não têm equivalência geométrica garantida.

## Produto, exemplos e evidências

src/configs e testes unit/fixtures constituem produto. Exemplos legacyRC4 e Presentation sintética são demonstrações delimitadas, não distribuição da working tree consolidada. E2E/artefatos/ADRs/releases permanecem históricos com seus alcances; governança extensa, materiais de campanha e auxiliares são externos, não dependência de runtime.

Exports Core/CSS/Presentation/CSS e tipos preservados; files=dist. Code/tgz antigos ou deps do Lab não são copiados como emissão nova. Externals protegidos não abrangem todo subpath PM/tables: não afirmar singleton global ou grafo runtime certificado. [Proveniência](provenance.md) e [backlog](backlog.md) identificam mudanças e pendências.
