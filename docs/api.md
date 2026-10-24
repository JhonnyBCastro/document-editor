# API

Referência de implementação: linha `feature/compose-next`, commit `1c3b5add4ec8201ff176d67fd83f6677502cdd1d` (antes desta atualização documental). As entradas declaradas no [manifesto](../package.json) não comprovam publicação npm do estado atual.

Para instalação, schema, hosts e CSS, comece pelo [Quick Start](quick-start.md). Os exemplos usam somente entradas do pacote local identificado, não fontes ou a Live Demo.

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
| `onLayoutStable` | Callback com `LayoutSnapshot` após a estabilização local do cálculo. Não constitui certificação geométrica. |

```ts
const pagination = PaginationExtension.configure({ visualMode: 'composed' });
```

Esse trecho pressupõe o import da extensão e sua inclusão nas extensões de um Editor. Não monta Presentation, schema, insets ou área de rolagem. Alterar opções depois da criação não troca o modo visual do controller. Não há factory pública de editor composto nem operação pública `updateLayout` de composição.

### Configuração parcial: limite dos tipos atuais

No Tiptap 3.32.0 ensaiado, `configure` faz merge profundo em runtime, mas sua assinatura é `Partial<Options>`. O objeto `layout` continua tipado como `LayoutConfig` completo: passar apenas `layout.page.pageGap` produziu TS2740. Não se anuncia suporte tipado a DeepPartial por essa constatação.

Para personalizar só o gap sem repetir os defaults nem usar casts:

```ts
import { PaginationExtension, type LayoutConfig } from '@jhonny_bcastro/document-editor';
const defaults = PaginationExtension.options.layout;
const layout: LayoutConfig = { ...defaults, page: { ...defaults.page, pageGap: 32 } };
const pagination = PaginationExtension.configure({ layout });
```

O consumidor também precisa derivar seus estilos geométricos do mesmo `layout.page`, como no Quick Start. Alterar apenas o Core não atualiza automaticamente os hosts. Não existe `Core({ gap })`, normalizador público ou factory de composição neste pacote.

### Atualização e reatividade

Na [extensão](../src/extension.ts), o hook `update` agenda layout quando:

```ts
state.doc !== prevState.doc && (
  state.doc.content.size !== prevState.doc.content.size ||
  hasStructuralChange(state.doc, prevState.doc)
)
```

Também agenda quando o estado do plugin registra `settingsChanged`. `hasStructuralChange` compara quantidade e tipos de nós, recursivamente nos blocos; não compara genericamente texto, marcas ou atributos. Não usa `doc.eq()`. Assim, alterações de mesmo tamanho que preservem essa estrutura podem não reagendar layout.

O sinal interno `paginationSettingsChanged` é lido em `apply` a cada transação. Na transação seguinte sem esse metadado, `settingsChanged` volta a `false`; o hook `update` não o consome por mutação. A existência desse canal interno não constitui uma API pública de atualização de configurações. Seleção pura, sem outro sinal, não satisfaz o predicado de alteração documental.

### Snapshots e estabilidade

`LayoutSnapshot` contém `revision`, `pages`, `breaks` e `diagnostics`. `pages` contém as projeções de folha, cabeçalho e rodapé em DocumentLayoutSpace (CSS px lógicos); o deslocamento por `pageGap` já está embutido nas posições das folhas.

`await whenLayoutStable(editor)` exige um controller inicializado e aguarda sua estabilização local. Quando o controller está ocioso, o helper atual pode agendar uma rodada; não deve ser tratado como simples getter passivo. Não garante uma rodada distinta por chamada concorrente, igualdade entre rodadas, estabilidade após mudanças externas de fontes/CSS ou ausência de violações geométricas. Em abortos por inconsistência, aguardantes podem permanecer pendentes; o host deve considerar essa limitação.

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
