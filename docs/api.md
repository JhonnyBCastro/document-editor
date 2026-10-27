# API

Base da revisão documental anterior: `feature/compose-next`, HEAD `f7f1e617fae73394011cc332f6e1c4b59e5be8f7`, com fontes então comparadas a `1c3b5add4ec8201ff176d67fd83f6677502cdd1d`. Atualização focal de reatividade por inspeção estática em 27/10/2026: correção presente no commit local `4f3577446204bf7f99848394e3b48b3136df6630`. Esta conferência não repetiu testes nem verificou push. As entradas declaradas no [manifesto](../package.json) não comprovam publicação npm do estado atual.

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
| `onLayoutStable` | Callback com `LayoutSnapshot` ao fim de uma rodada local, inclusive quando há paginação parcial diagnosticada. Não constitui certificação geométrica. |

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

### Geometria e montagem

O Core usa `height - marginTop - marginBottom` como altura útil nominal e `marginBottom + pageGap + marginTop` como deslocamento básico entre áreas de conteúdo. Sua origem vertical é `editorRect.top + marginTop`, em coordenadas da viewport; os deslocamentos estruturais já instalados são descontados das medidas. A largura do texto vem do DOM efetivo: `page.width` e as margens horizontais dimensionam as projeções, mas não configuram a largura ou o padding do Editor.

Na composição, o consumidor precisa manter largura e insets do Editor coerentes com `layout.page` e alinhar a origem dos hosts às projeções locais. O Core aplica decorações; a Presentation aplica os retângulos recebidos, sem medir ou corrigir esse alinhamento. O [Quick Start](quick-start.md#coerência-geométrica-da-montagem) deriva os estilos de uma única configuração. Esse mapeamento manual é necessário hoje, não uma exigência de duplicar números independentes nem uma garantia automática de coerência. A geometria nominal não certifica cada corte físico.

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
