# API vigente

## Core

Entrada pública: `@jhonny_bcastro/document-editor`; CSS: `@jhonny_bcastro/document-editor/style.css`. Exporta `PaginationExtension`, `PaginationPluginKey`, tipos de `types.ts`, `whenLayoutStable` e `preparePrintSession`/`PrintSession`. `PaginationController` não é uma factory de composição exportada pelo barrel.

### PaginationExtension e opções

O consumidor monta seu Editor e schema Tiptap/PM. A extensão insere Decorations transitórias; não cria o schema do nó de quebra manual nem transforma essas quebras em nós semânticos próprios.

| Opção | Contrato |
|---|---|
| `layout` | `LayoutConfig`: page, policies e runningContent. Defaults da extensão:816×1056, margens96, gap20; cabeçalho desativado e rodapé `Página {page} de {total}`. |
| `visualMode` | `'legacy' \| 'composed'`, omissão=legacy. Fixo na criação do controller. Inválido rejeitado por TypeError sem fallback. |
| `chromeLayerElement` | Host externo opcional do chrome legado. Qualquer valor definido conflita com composed e é rejeitado. |
| `manualBreakNodeName` | Default `pageBreak`; schema/parse/render semânticos pertencem ao consumidor. |
| `onLayoutStable` | Callback com `LayoutSnapshot` após estabilização local do cálculo. |

```ts
import { PaginationExtension } from '@jhonny_bcastro/document-editor';
const pagination = PaginationExtension.configure({ visualMode: 'composed' });
```

Essa configuração não monta Presentation, insets ou área rolável. Mutações posteriores de opções não trocam visualMode. Não há `updateLayout` público de composição aprovado; métodos internos do controller não constituem bridge suportada. O trigger atual considera tamanho do documento/metadado: edição do mesmo tamanho pode alterar medidas sem esse trigger, risco estático ainda pendente.

### Snapshots e estabilidade

`LayoutSnapshot` contém revision/pages/breaks/diagnostics. `await whenLayoutStable(editor)` exige controller inicializado e retorna snapshot da estabilização local. O handle de renderTimeout é liberado quando o callback é consumido, antes de renderVirtualPages. Isso preserva debounce e evita aguardar handle já executado; não promete estabilidade permanente após mudanças de conteúdo/fontes/DOM.

### Impressão

`preparePrintSession(editor)` retorna `{ snapshot, restore }`. Aplica classe global print-mode quando necessária e pageGap0 temporário; sessão concorrente é rejeitada por lock. Impressão/exportação pertencem ao host/browser. Sempre chamar `restore()` no finally. Não é geração de PDF nem contrato de impressão composta suportada. Multi-instância/lifecycle de fontes e frames permanecem limitados.

## Presentation independente

Entrada: `@jhonny_bcastro/document-editor/presentation`; CSS: `@jhonny_bcastro/document-editor/presentation.css`.

`createDocumentPresentation(host, options?)` retorna `DocumentPresentation` com:

- `render(snapshot)`: pinta projeção no espaço coordenado do host sem alterar o snapshot. Após destroy lança erro.
- `clear()`: descarta recursos de render atual; após destroy não produz efeito.
- `destroy()`: remove estruturas próprias e previne render; idempotente.

Opções `renderHeader`/`renderFooter` recebem contexto readonly e mountPoint; podem retornar disposer. Conteúdo é visual-only/não interativo: não inserir elementos focáveis nem modificar geometria do mount. Host co-originário/co-escalado com DocumentLayoutSpace, coordenadasX→direita/Y→baixo. O consumidor coordena snapshots/insets/ownership e destruição; essa montagem experimental não é factory pronta ou integração oficial.

No composto, Core mantém bordas geométricas B1 transparentes e estilos do consumidor; Presentation não calcula quebras e não controla edição. Ver [arquitetura](architecture.md) e [limitações](limitations.md).
