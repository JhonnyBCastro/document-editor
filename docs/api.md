# API

Base da revisão documental anterior: `feature/compose-next`, HEAD `f7f1e617fae73394011cc332f6e1c4b59e5be8f7`, com fontes então comparadas a `1c3b5add4ec8201ff176d67fd83f6677502cdd1d`. Atualização focal de reatividade por inspeção estática em 27/10/2026: correção presente no commit local `4f3577446204bf7f99848394e3b48b3136df6630`. Esta conferência não repetiu testes nem verificou push. As entradas declaradas no [manifesto](../package.json) não comprovam publicação npm do estado atual.

Para instalação, schema, hosts e CSS, comece pelo [Quick Start](quick-start.md). Os exemplos usam somente entradas do pacote local identificado, não fontes ou a Live Demo.

## Composição coordenada opcional

O subpath público `@jhonny_bcastro/document-editor/compose` é ESM exclusivo. Não altera os quatro exports preexistentes. Os estilos são consumidos separadamente por `@jhonny_bcastro/document-editor/style.css` e `@jhonny_bcastro/document-editor/presentation.css`; a composição usa `injectCSS: false` no Editor.

### Assinatura e opções

```ts
import type {
  DocumentEditorOptions,
  DocumentEditorInstance,
  DocumentEditorIncident,
  DocumentEditorCleanupReport,
} from '@jhonny_bcastro/document-editor/compose';

// Assinatura pública; não é uma segunda implementação.
declare function createDocumentEditor(
  options: DocumentEditorOptions,
): DocumentEditorInstance;
```

O retorno expõe somente `readonly editor: Editor` e `destroy(): void`. O host é `options.host`, não um argumento posicional. Não há getter de estado/snapshot, método próprio de renderização, adoção de Editor existente ou atualização dinâmica de layout.

| Opção | Tipo e alcance |
|---|---|
| `host` | `HTMLElement` obrigatório; destino dos nós próprios da composição. |
| `content`, `extensions`, `editable`, `autofocus`, `parseOptions` | Reutilizam os tipos das propriedades homônimas de `EditorOptions`. A composição instala sua própria paginação. |
| `layout.page` | Subconjunto parcial de `width`, `height`, `marginTop`, `marginRight`, `marginBottom`, `marginLeft` e `pageGap`, todos numéricos opcionais. Não é DeepPartial genérico do Core. |
| `renderHeader`, `renderFooter` | `(context: RunningContentContext, mountPoint: HTMLElement) => void \| Disposer`. |
| `onLayoutStable` | `(snapshot: LayoutSnapshot) => void`. |
| `onError` | `(incident: DocumentEditorIncident) => void`. |

As definições completas estão nos [tipos públicos da composição](../src/compose/types.ts). Veja o [exemplo coordenado proposto](quick-start.md#composição-coordenada-v1--exemplo-proposto), ainda sem validação em consumidor independente.

### Normalização e rejeições

Os defaults são largura `816`, altura `1056`, margens `96` nos quatro lados e `pageGap: 20`, em CSS px. Uma propriedade numérica omitida ou `undefined` recebe seu default; frações válidas são preservadas.

Na implementação inspecionada, cada um dos sete campos numéricos passa pelo mesmo validador: strings, `null`, `NaN` e infinitos são rejeitados com `TypeError`, sem coerção. Largura e altura devem ser estritamente positivas; margens e gap podem ser zero, mas não negativos.

Também são rejeitados: `height + pageGap` não finito; `width - marginLeft - marginRight` não finito ou não positivo; `height - marginTop - marginBottom` não finito ou não positivo. Essa enumeração descreve as expressões efetivamente verificadas, sem prometer validação de toda grandeza derivada possível.

Chaves desconhecidas na raiz, em `layout` ou em `layout.page` são rejeitadas. Valores fornecidos para `layout` e `layout.page` devem ser objetos não nulos e não arrays. O tipo público exige `HTMLElement`; a checagem de runtime observa objeto não nulo e `nodeType === 1`, não uma certificação exaustiva de objetos que imitem elementos.

As rejeições preliminares ocorrem antes da montagem própria. A duplicação direta de paginação é verificada antes da construção; a detecção defensiva de extensões agrupadas ocorre após expansão, durante a inicialização, e pode exigir rollback. Não atribua ausência de efeitos a toda falha de inicialização.

O default de `runningContent` do Core conserva footer habilitado, texto `Página {page} de {total}` e alinhamento à direita. Isso não cria automaticamente o renderer de footer da Presentation; forneça `renderFooter` para o conteúdo dessa camada.

### Lifecycle e callbacks síncronos

A factory cria e coordena Editor, Presentation, wrapper e disposers conhecidos. Em uma publicação aceita, aplica a Presentation e o frame antes de encaminhar `onLayoutStable`, respeitando as guardas de terminalidade. Não acrescenta um agendamento público por `requestAnimationFrame`.

Os callbacks são síncronos. Promises retornadas não são aguardadas nem transformam a operação em assíncrona; não há garantia geral de captura de rejeições futuras. O retorno de renderer previsto pelo contrato é `void` ou função disposer.

`instance.destroy()` e a chamada direta `instance.editor.destroy()`, enquanto resolve para o interceptador instalado na instância, iniciam o encerramento coordenado. A terminalidade lógica bloqueia imediatamente novos encaminhamentos próprios da composição. Não comprova cessação universal da atividade interna do Core.

Quando existe operação síncrona ativa, a limpeza física pode ser adiada até sua saída normal ou excepcional, incluindo disposers recebidos tardiamente. Terminalidade não cancela a finalização pendente. Chamadas repetidas ou reentrantes não reiniciam o encerramento; a tentativa nativa de destruição é feita no máximo uma vez quando devida e alcançável.

As tentativas de limpeza dos recursos próprios conhecidos e alcançáveis são independentes: falha no Editor não dispensa Presentation, wrapper ou outros disposers alcançáveis. Remover o wrapper não confirma liberação de outros recursos. A interceptação não cobre referências nativas previamente capturadas, chamadas diretas ao protótipo ou substituições posteriores do método que a contornem. Não há promessa de limpeza universal de recursos externos ou desconhecidos.

### Incidentes — representação agrupada aprovada (Opção B)

| Campo | Semântica |
|---|---|
| `operation` | Contexto originador: `initialization`, `render` ou `destroy`. Rollback não é uma operação pública. |
| `primary` | Primeira ocorrência causal, com `error: unknown`, `phase` e `resource` opcional. Inclusive `throw undefined` é representável. |
| `secondaryFailures` | Ocorrências adicionais, preservando a causa principal e sem repetir a mesma ocorrência. Duas ocorrências podem lançar o mesmo objeto ou valor e continuar distintas. |
| `state` | `active` ou `closed` no momento da comunicação; não é consulta viva à composição. |
| `cleanup` | Resultado de limpeza dos recursos próprios conhecidos e aquisições parciais relevantes, com detalhe e limitações. |

As fases públicas são `composition-setup`, `editor-construction`, `presentation-render`, `running-content-render`, `frame-update`, `layout-callback`, `running-content-dispose`, `editor-destroy`, `presentation-destroy` e `wrapper-remove`. Sua existência no tipo não torna válida toda combinação com uma operação: aplicam-se os caminhos e as regras do contrato ratificado.

Uma falha de inicialização permanece `operation: 'initialization'` mesmo quando as falhas adicionais surgem no rollback. Uma falha de limpeza pode ser a principal quando origina o incidente; não é necessariamente secundária. As fases dos renderers e de seus disposers são distintas.

| `cleanup.status` | Critério |
|---|---|
| `not_required` | A operação não exigiu limpeza ou rollback. Não significa limpeza ainda pendente ou adiada. |
| `completed` | Liberação confirmada de todos os recursos próprios relevantes no conjunto delimitado, sem incerteza relevante nesse conjunto. |
| `incomplete` | Ao menos uma falha comprovada, mesmo que coexistam incertezas, que permanecem registradas. |
| `unconfirmed` | Nenhuma falha comprovada, mas existe liberação relevante sem confirmação suficiente. |

A precedência é `incomplete` sobre `unconfirmed` sobre `completed` quando há limpeza exigida. `not_required` representa ausência de necessidade, não um grau dessa precedência.

`cleanup.resources` distingue `released`, `failed` e `unconfirmed` por recurso conhecido. Retorno normal de `destroy()` sem view atribuída não confirma liberação de aquisições parciais do Editor. O resultado de disposer audita a execução da função entregue à composição, não recursos privados arbitrários do consumidor. Resultados já obtidos são preservados sem repetir a tentativa.

`cleanup.limitations` explica alcance, inacessibilidade e incertezas relevantes; não substitui falhas estruturadas nem duplica desnecessariamente a lista por recurso. A agregação não oculta resultados individuais.

Falha em `onLayoutStable` produz incidente não fatal; sem pedido de encerramento, a composição continua ativa. O incidente original conserva `state: 'active'` mesmo se o consumidor chamar `destroy()` dentro de `onError`. Incidentes terminais são distintos. Se `onError` lançar, o fallback preserva o incidente original e identifica separadamente a exceção do observador, sem recursão. Na ausência do observador, há contingência operacional em `console.error`.

A limitação de observabilidade aceita para V1 é estrita: durante a comunicação de um incidente não fatal, com composição ativa, o consumidor solicita `destroy()` dentro de `onError` e esse encerramento produz um incidente terminal distinto. Nesse caso não há garantia de entrega programática do segundo incidente por nova chamada a `onError`; `console.error` é a contingência operacional acordada, após a saída da operação ativa, as tentativas de limpeza pendentes e a consolidação dos resultados. Não generalize a exceção para todo descarte em `onError`.

Após comunicar um incidente, a composição não modifica nem reutiliza sua estrutura publicada. `readonly` é uma restrição estática; essa regra não promete congelamento profundo em runtime, imutabilidade dos erros originais ou proteção contra mutações do consumidor.

## Core

Entrada: `@jhonny_bcastro/document-editor`; CSS: `@jhonny_bcastro/document-editor/style.css`.

O [barrel Core](../src/index.ts) exporta os tipos de `types.ts`, `PaginationExtension`, `PaginationPluginKey`, `whenLayoutStable` e `preparePrintSession`/`PrintSession`. `PaginationController` não é exportado por esse barrel. A bridge de decorações e o payload de publicação são mecanismos internos, não API de composição do consumidor.

### PaginationExtension

O consumidor cria seu Editor e schema. Quebras automáticas são decorações; o schema e a serialização do nó de quebra manual pertencem ao consumidor.

| Opção | Contrato atual |
|---|---|
| `layout` | `LayoutConfig`: `page`, `policies` e `runningContent`. Defaults da extensão: 816×1056 CSS px, margens 96, gap 20; cabeçalho desativado e rodapé configurado como `Página {page} de {total}`. A Presentation usa seus próprios callbacks para pintar running content. |
| `visualMode` | Somente `'composed'`, também usado por omissão. O controller rejeita outros valores com `TypeError`. |
| `manualBreakNodeName` | Default `pageBreak`. Nome do nó semântico que o consumidor deve fornecer no schema. |
| `onLayoutStable` | Callback com `LayoutSnapshot` ao fim de uma rodada local, inclusive quando há paginação parcial diagnosticada. Não constitui certificação geométrica. |

```ts
const pagination = PaginationExtension.configure({ visualMode: 'composed' });
```

Esse trecho pressupõe o import da extensão e sua inclusão nas extensões de um Editor. Não monta Presentation, schema, insets ou área de rolagem. Alterar opções depois da criação não troca o modo visual do controller. O uso direto do Core não monta a composição coordenada. A factory possui normalização parcial específica de `layout.page`; isso não cria DeepPartial genérico nem uma operação pública `updateLayout`.

### Configuração parcial: limite dos tipos atuais

No Tiptap 3.32.0 ensaiado, `configure` faz merge profundo em runtime, mas sua assinatura é `Partial<Options>`. O objeto `layout` continua tipado como `LayoutConfig` completo: passar apenas `layout.page.pageGap` produziu TS2740. Não se anuncia suporte tipado a DeepPartial por essa constatação.

Para personalizar só o gap sem repetir os defaults nem usar casts:

```ts
import { PaginationExtension, type LayoutConfig } from '@jhonny_bcastro/document-editor';
const defaults = PaginationExtension.options.layout;
const layout: LayoutConfig = { ...defaults, page: { ...defaults.page, pageGap: 32 } };
const pagination = PaginationExtension.configure({ layout });
```

O consumidor também precisa derivar seus estilos geométricos do mesmo `layout.page`, como no Quick Start. Alterar apenas o Core não atualiza automaticamente os hosts. Não existe `Core({ gap })`. A normalização parcial da factory é específica da composição coordenada descrita acima, não uma mudança implícita da API do Core.

### Geometria e montagem

O Core usa `height - marginTop - marginBottom` como altura útil nominal e `marginBottom + pageGap + marginTop` como deslocamento básico entre áreas de conteúdo. Sua origem vertical é `editorRect.top + marginTop`, em coordenadas da viewport; os deslocamentos estruturais já instalados são descontados das medidas. A largura do texto vem do DOM efetivo: `page.width` e as margens horizontais dimensionam as projeções, mas não configuram a largura ou o padding do Editor.

Na composição manual, o consumidor precisa manter largura e insets do Editor coerentes com `layout.page` e alinhar a origem dos hosts às projeções locais. O Core aplica decorações; a Presentation aplica os retângulos recebidos, sem medir ou corrigir esse alinhamento. O [Quick Start](quick-start.md#coerência-geométrica-da-montagem) deriva os estilos de uma única configuração. Esse mapeamento manual é necessário nesse fluxo, não uma exigência de duplicar números independentes nem uma garantia automática de coerência. A geometria nominal não certifica cada corte físico.

Na composição coordenada, a factory cria seus recursos e deriva a geometria estrutural inicial de `layout.page`. A Presentation continua aplicando projeções, sem calcular paginação. As garantias da factory não são transferidas implicitamente ao Core ou à Presentation isolados. Estilos métricos e mudanças externas continuam sujeitos aos limites documentados.

### Conteúdo e schema reconhecidos

O controller percorre posições ProseMirror e consulta `coordsAtPos`. Para nós chamados `paragraph` e `heading`, agrupa retângulos DOM de `Range.getClientRects()` para orientar as políticas de linhas; keep-with-next reconhece a relação heading/parágrafo. Renomear esses nós pode retirar esse tratamento especializado, mesmo que o schema continue válido.

O caminho tabular reconhece `table`, procura células `tableCell`/`tableHeader` e usa `TableMap`. Exige estrutura compatível com prosemirror-tables: tabela/linhas/células, `tableRole` apropriado e atributos como `colspan`, `rowspan` e `colwidth`. Só renomear um nó ou renderizar HTML de tabela não estabelece esse contrato. Linhas maiores que a altura útil e certos grupos com rowspan podem ser bloqueados com diagnósticos, sem fragmentação intralinha geral.

Outros nós passam pelo caminho linear sem essa medição especializada de linhas. Não há protocolo público específico de medição/fragmentação para imagens, NodeViews ou blocos personalizados indivisíveis. Um bloco maior que a área útil não tem garantia geral de acomodação, divisão ou redução automática. O consumidor fornece schema, DOM e dimensões do conteúdo; isso não transfere a ele a obrigação de implementar quebras para simular suporte inexistente. Conteúdo personalizado precisa de validação própria antes de ser considerado suportado.

### Atualização e reatividade

O Core agenda cálculo na inicialização, em determinadas alterações documentais e quando recebe o sinal interno de configuração. Esse sinal não aplica opções por si só nem constitui uma API pública de atualização.

A detecção documental exige mudança de referência do documento e, então, mudança de tamanho ou diferença segundo `Node.eq` do ProseMirror. Assim, alterações de texto, marcas ou atributos representadas no documento podem agendar cálculo mesmo quando tamanho e estrutura permanecem iguais. Uma nova referência documental equivalente segundo `Node.eq`, seleção pura e publicação neutra de decorações, sem outro sinal de configuração, não provocam agendamento. Isso detecta diferenças documentais, não mudanças externas de geometria. O remapeamento de decorações, por si só, não garante atualização das quebras.

O Core não observa continuamente alterações externas de CSS, dimensões, imagens ou fontes. Verifica o estado das fontes quando inicia uma rodada e espera seu carregamento se necessário, mas não garante atualização após carregamentos posteriores. Prepare a geometria e as dimensões dos recursos conhecidos antes da montagem quando possível.

`presentation.render(snapshot)` atualiza a apresentação com as projeções fornecidas; não solicita novo cálculo ao Core. A coordenação dos recursos e das mudanças externas continua necessária, mas não há API pública dedicada que garanta invalidação e recálculo após qualquer mudança externa. O helper abaixo não substitui esse contrato.

### Snapshots e estabilidade

`LayoutSnapshot` contém `revision`, `pages`, `breaks` e `diagnostics`. As projeções usam coordenadas locais de layout (`DocumentLayoutSpace`), em CSS px; o deslocamento por `pageGap` já está incluído.

`revision` é um contador local do controller, iniciado em zero. Incrementa uma vez quando o comparador detecta diferenças entre as quebras calculadas e as decorações estruturais instaladas e a publicação termina sem erro ou destruição do controller antes do incremento. Não conta rodadas de cálculo nem todas as mudanças de geometria.

`whenLayoutStable(editor)` exige o controller inicializado pela `PaginationExtension`; sem ele, a promise rejeita. Com o controller disponível, o comportamento é:

| Estado na chamada | Comportamento |
|---|---|
| Ocioso: sem timer e sem cálculo ativo | Registra o aguardante e agenda cálculo; não retorna um snapshot em cache. |
| Timer pendente | Aguarda uma conclusão sem garantir rodada adicional ou reiniciar o timer por essa chamada. |
| Cálculo em curso | Aguarda uma conclusão sem garantir rodada adicional posterior à chamada ou a uma mudança externa. |

Chamadas concorrentes podem receber o mesmo snapshot. Concluir uma rodada não comprova ausência de trabalho pendente, processamento integral nem geometria atual correta. Um snapshot pode representar paginação parcial acompanhada de diagnóstico, como `LAYOUT_ITERATION_LIMIT`; examine `diagnostics` antes de interpretar o resultado como completo.

Se o percurso não alcançar a emissão do snapshot, por exemplo em determinados abortos, erros ou destruição, a promise pode permanecer pendente, sem rejeição automática por esses caminhos. Isso não significa que todo aborto gere pendência permanente: uma conclusão posterior pode resolver aguardantes preservados. Não há garantia geral de resolução dentro de um prazo.

Agendar cálculo, concluir uma rodada e obter um resultado que reflita a geometria atual são condições distintas. O helper não certifica alinhamento físico, idempotência ou atualização após mudanças externas posteriores.

### Preparação de impressão

`await preparePrintSession(editor)` retorna `PrintSession`, com `snapshot` e `restore(): Promise<void>`. O código ajusta temporariamente o gap e a classe global `print-mode`, com lock de sessão. Sempre aguarde a restauração em `finally`:

```ts
const session = await preparePrintSession(editor);
try {
  // Impressão/exportação e sua coordenação pertencem ao host.
} finally {
  await session.restore();
}
```

Não é um gerador de PDF nem uma garantia de impressão composta. A alteração global e o lock limitam coexistência de instâncias. Veja [limitações](limitations.md).

## Presentation

Entrada: `@jhonny_bcastro/document-editor/presentation`; CSS: `@jhonny_bcastro/document-editor/presentation.css`.

`createDocumentPresentation(host, options?)` retorna:

- `render(snapshot)`: projeta páginas e running content, sem calcular quebras; depois de `destroy`, lança erro.
- `clear()`: limpa recursos da renderização atual; depois de `destroy`, não produz efeito.
- `destroy()`: descarta estruturas próprias e previne renderizações; chamadas repetidas são ignoradas.

As opções `renderHeader` e `renderFooter` recebem contexto readonly e um ponto de montagem; podem retornar uma função de descarte. O conteúdo é visual, não interativo: não inserir elementos focáveis nem alterar a geometria do ponto de montagem.

Core isolado calcula e emite snapshots sem exigir Presentation. Presentation isolada pode renderizar snapshots fornecidos externamente, sem Editor ou cálculo de paginação; o [Quick Start](quick-start.md) inclui um exemplo sintético.

`RunningContentContext.pageIndex` é zero-based; `PageProjection.index` é one-based. Callbacks são opcionais e somente eles montam running content na Presentation: `layout.runningContent` não é encaminhado automaticamente. `render` recria os elementos e descarta recursos anteriores; `clear`/`destroy` também executam os disposers retornados. O contexto readonly é contrato TypeScript, não congelamento geral em runtime. Metadados via closure e nova chamada a render são coordenação da aplicação, não uma API dedicada de metadados. A camada é aria-hidden; não inserir controles focáveis nem depender exclusivamente dela para informação acessível essencial.

O host deve compartilhar origem e escala com DocumentLayoutSpace. O consumidor coordena insets, snapshots, Editor, Presentation e descarte. Não deve adicionar `pageGap` novamente aos retângulos recebidos. O contrato de descarte da Presentation não implica idempotência do cálculo de paginação.

Veja [arquitetura](architecture.md) e o consumidor em [Live Demo](../examples/live-demo/NOTES.md).
