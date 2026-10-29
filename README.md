# document-editor

Biblioteca de paginação visual de documentos contínuos para Tiptap/ProseMirror. Calcula quebras, aplica decorações transitórias e fornece projeções de páginas, mantendo as quebras automáticas fora do documento semântico persistido.

Destina-se a aplicações que precisam acrescentar uma visualização paginada a um editor Tiptap. Não fornece um editor completo, menus ou uma interface de aplicação pronta.

## Responsabilidades

| Camada | Responsabilidade |
|---|---|
| Core | Mede o documento no DOM, avalia políticas, calcula e aplica quebras estruturais e emite snapshots. |
| Presentation | Desenha folhas e regiões de cabeçalho/rodapé conforme as projeções e os renderizadores fornecidos; não calcula paginação nem cria área editável. |
| Editor e aplicação | O Editor fornece o modelo e as operações de edição. Na montagem manual, a aplicação coordena hosts, geometria, snapshots e descarte; na factory opcional, esses recursos próprios são coordenados nos limites da API. Schema/extensões, conteúdo, renderizadores, estilos não conflitantes, interface, persistência e regras de negócio continuam na aplicação. |

Somente o modo `composed` é suportado pela biblioteca. Essa restrição descreve o modo disponível, não certifica a geometria nem a montagem completa. A biblioteca permite Core isolado, Presentation isolada, composição manual e composição coordenada opcional. `composed` é o modo visual suportado; não significa que todo consumidor precise usar a factory. A entrada `/compose` oferece `createDocumentEditor(options)`, que cria e coordena recursos próprios. A montagem manual permanece disponível; mudanças externas não têm recálculo automaticamente garantido. Consulte os [limites essenciais](#limites-essenciais) antes de adotar.

## Estado e distribuição

**Identidade dos exemplos:** a receita manual histórica abaixo foi exercitada com o tarball identificado nesta seção. Não se presume que esse artefato contenha a Composição Coordenada V1. Para usar `/compose`, é necessário um pacote que efetivamente inclua essa entrada e suas declarações. A versão `0.1.0-rc.4`, isoladamente, não identifica os bytes do pacote. A validação independente do pacote foi encerrada com ressalvas no escopo autorizado e nos ambientes verificados; veja [proveniência](docs/provenance.md#validação-do-consumidor-v1--encerramento-de-29102026). Esse fechamento não comprova a execução literal do exemplo coordenado abaixo, que permanece proposto.

Linha de desenvolvimento: `feature/compose-next`. O manifesto declara `@jhonny_bcastro/document-editor`, versão `0.1.0-rc.4`; essa declaração não comprova publicação npm do código atual.

A receita usa o tarball local originado de `1c3b5add4ec8201ff176d67fd83f6677502cdd1d`, SHA-256 `fa869168a25bd9c6266188a1075fe714d2db15c3fa5fdf964ec35584e37dee14`. Identifique-o por origem e hash, não apenas pela versão; não presuma equivalência automática com o HEAD atual. A documentação é posterior a esse commit; o histórico da linha está em [proveniência](docs/provenance.md).

## Composição coordenada V1 — exemplo proposto

**Exemplo proposto — composição coordenada V1.** As assinaturas e os caminhos públicos abaixo foram conferidos por leitura dos tipos, exports e implementação locais. A validação do pacote no laboratório não equivale à compilação e execução literal deste trecho; essa execução específica continua não demonstrada. Pressupõe ambiente browser, pacote identificado que contenha `/compose`, resolução de imports CSS e extensões de schema compatíveis. Não reutilize automaticamente as versões do manifesto histórico.

HTML:

```html
<div id="document"></div>
```

TypeScript:

```ts
import StarterKit from '@tiptap/starter-kit';
import {
  createDocumentEditor,
  type DocumentEditorOptions,
} from '@jhonny_bcastro/document-editor/compose';
import '@jhonny_bcastro/document-editor/style.css';
import '@jhonny_bcastro/document-editor/presentation.css';

const host = document.querySelector<HTMLElement>('#document');
if (!host) throw new Error('Host #document não encontrado.');

const options: DocumentEditorOptions = {
  host,
  extensions: [StarterKit],
  content: '<p>Documento inicial</p>',
  layout: { page: { pageGap: 32 } },
  renderFooter(context, mountPoint) {
    mountPoint.textContent =
      `Página ${context.pageIndex + 1} de ${context.totalPages}`;
  },
  onLayoutStable(snapshot) {
    console.log('Publicação recebida:', snapshot.pages.length);
  },
  onError(incident) {
    console.error('Incidente da composição:', incident);
  },
};

const instance = createDocumentEditor(options);

// Funções da aplicação de exemplo, não novos métodos da biblioteca.
export function replaceContent() {
  instance.editor.commands.setContent('<p>Documento atualizado</p>');
}

export function dispose() {
  instance.destroy();
}
```

A composição instala a paginação: não inclua `PaginationExtension` em `extensions`. O host pertence a `options.host`. A interface retornada expõe somente `editor` e `destroy()`: não há getter de snapshot, `instance.render()` ou atualização dinâmica de layout.

O footer é fornecido explicitamente por callback. Os defaults de `runningContent` do Core não são convertidos automaticamente em conteúdo da Presentation.

A factory configura a geometria estrutural inicial. Tipografia, estilos não conflitantes e condições de montagem continuam relevantes. A execução literal deste exemplo e a instalação limpa do manifesto histórico apresentado adiante permanecem sem evidência no laboratório examinado.

Para experimentar um fluxo adaptado, consulte o [Live Demo](examples/live-demo/NOTES.md), com montagem coordenada e manual por imports públicos. Ele fornece schema mínimo e CSS de sobreposição próprios; sua checagem não equivale à execução literal deste exemplo com StarterKit.

## Receita manual — artefato histórico identificado

As próximas seções permitem preparar a aplicação sem importar fontes, configurações ou arquivos de exemplo do repositório. O pacote fornece Core, Presentation e os subpaths `style.css` e `presentation.css`. O exemplo usa somente essas entradas públicas. `whenLayoutStable`, `PaginationPluginKey` e `preparePrintSession` também estão exportados; não são necessários para montar esta receita.

## 1. Preparar uma aplicação independente

Use uma pasta nova, fora da biblioteca. Copie o `.tgz` fornecido para `package-input/library.tgz` e confira seu SHA-256 antes de instalar. As versões abaixo foram exercitadas no consumidor de referência; não certificam toda a faixa dos peers.

Crie os arquivos apresentados neste guia. O manifesto da aplicação é:

```json
{
  "name": "document-editor-quickstart",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "check": "tsc --noEmit -p tsconfig.json",
    "build": "npm run check && vite build"
  },
  "dependencies": {
    "@jhonny_bcastro/document-editor": "file:./package-input/library.tgz",
    "@tiptap/core": "3.32.0",
    "@tiptap/pm": "3.32.0",
    "@tiptap/starter-kit": "3.32.0"
  },
  "devDependencies": {
    "typescript": "7.0.2",
    "vite": "8.3.5"
  }
}
```

Execute `npm install` e preserve o lockfile gerado. A receita foi exercitada com dependências previamente resolvidas; uma instalação limpa desse manifesto e seu novo grafo transitivo não foram validados. As versões diretas estão fixadas para delimitar o ambiente de referência, não para garantir qualquer resolução transitiva.

Core/PM são peers da biblioteca. StarterKit é uma conveniência para este exemplo e fornece schema e comportamentos Tiptap; não é dependência obrigatória do Core. O esquema mínimo precisa de documento, texto e bloco válido. Headings, listas ou marcas requerem extensões correspondentes. Nó de quebra manual só é necessário se essa funcionalidade for usada; o StarterKit não fornece automaticamente o nó `pageBreak` da aplicação.

## 2. Tipagem dos imports CSS

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": [
      "ES2020",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "strict": true,
    "noEmit": true,
    "noUncheckedSideEffectImports": true
  },
  "include": [
    "src"
  ]
}
```

`src/vite-env.d.ts` — três barras, arquivo incluído por `include: ["src"]`:

```ts
/// <reference types="vite/client" />
```

Essa é a integração normal de tipos de assets no exemplo Vite, documentada nos [client types do Vite](https://vite.dev/guide/features.html#client-types). Não desligue `noUncheckedSideEffectImports` para ocultar erros. `skipLibCheck` não substitui a declaração de módulos CSS escritos nos imports da aplicação.

Os subpaths `@jhonny_bcastro/document-editor/style.css` e `@jhonny_bcastro/document-editor/presentation.css` existem neste artefato. A diretiva apenas reconhece seus tipos; a existência física e a resolução em runtime continuam sendo verificadas pelo bundler/browser.

## 3. Composição integrada

O Core não cria Editor ou schema. A Presentation não calcula paginação e não cria uma área editável. A aplicação conecta as duas partes pelo callback público de snapshot e fornece hosts com origem e escala compatíveis.

`index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Quick Start integrado</title>
  </head>
  <body>
    <div id="document" class="qs-frame">
      <div id="pages" class="qs-pages"></div>
      <div id="editor" class="qs-editor"></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:

```ts
import './style.css';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension, type LayoutConfig, type LayoutSnapshot } from '@jhonny_bcastro/document-editor';
import '@jhonny_bcastro/document-editor/style.css';
import { createDocumentPresentation } from '@jhonny_bcastro/document-editor/presentation';
import '@jhonny_bcastro/document-editor/presentation.css';

const frame = document.querySelector<HTMLElement>('#document')!;
const editorHost = document.querySelector<HTMLElement>('#editor')!;
const presentationHost = document.querySelector<HTMLElement>('#pages')!;

// Composição da aplicação: não é uma factory oferecida pela biblioteca.
const defaults = PaginationExtension.options.layout;
const layout: LayoutConfig = {
  ...defaults,
  page: { ...defaults.page }, // Ex.: pageGap: 32 pode ser definido aqui.
};
const page = layout.page;
for (const [name, value] of Object.entries({
  width: page.width, height: page.height,
  top: page.marginTop, right: page.marginRight,
  bottom: page.marginBottom, left: page.marginLeft,
})) frame.style.setProperty(`--page-${name}`, `${value}px`);

let disposed = false;
let latest: LayoutSnapshot | undefined;
const presentation = createDocumentPresentation(presentationHost, {
  renderFooter: (context, mount) => {
    mount.textContent = `Página ${context.pageIndex + 1} de ${context.totalPages}`;
    mount.style.textAlign = 'right';
    // O rect recebido já reserva as margens. Não adicionar padding de página.
  },
});
const editor = new Editor({
  element: editorHost,
  extensions: [StarterKit, PaginationExtension.configure({
    layout,
    onLayoutStable(snapshot) {
      if (disposed) return;
      latest = snapshot;
      presentation.render(snapshot);
      const last = snapshot.pages[snapshot.pages.length - 1];
      frame.style.minHeight = `${last ? last.sheetRect.top + last.sheetRect.height : page.height}px`;
    },
  })],
  content: '<h1>Documento</h1>' + Array.from({ length: 24 }, (_, i) =>
    `<p>Parágrafo ${i + 1}. ${'Texto para observar a paginação durante a edição. '.repeat(12)}</p>`
  ).join(''),
});

function dispose() {
  if (disposed) return;
  disposed = true;
  window.removeEventListener('pagehide', dispose);
  editor.destroy();
  presentation.destroy();
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);

// Exports opcionais da aplicação de exemplo; não são API da biblioteca.
export { editor, presentation, layout, dispose };
export const getSnapshot = () => latest;
```

O código usa somente entradas públicas do pacote. `editor`, `presentation`, `layout`, `dispose` e `getSnapshot` exportados no fim são recursos locais da aplicação de exemplo, não novas funções públicas da biblioteca. Pode remover esses exports se não precisar acessar os recursos a partir de outro módulo da aplicação.

`PaginationExtension.options.layout` fornece os defaults presentes na extensão. O exemplo cria um `LayoutConfig` completo e substitui o objeto `page` sem modificar os defaults. É possível personalizar `pageGap` nesse objeto. A tipagem atual exige o `LayoutConfig` aninhado completo; por isso o guia deriva os valores dos defaults, sem usar `configure({ layout: { page: { pageGap: 32 } } })` ou `as any`.

`src/style.css`:

```css
body { margin: 0; padding: 24px; background: #e8e8e8; font-family: system-ui, sans-serif; }
.qs-frame { position: relative; width: var(--page-width, 816px); min-height: var(--page-height, 1056px); margin-inline: auto; }
.qs-pages { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.qs-editor { position: relative; z-index: 1; }
.qs-editor > .ProseMirror {
  box-sizing: border-box; width: 100%; min-height: var(--page-height, 1056px);
  padding: var(--page-top, 96px) var(--page-right, 96px) var(--page-bottom, 96px) var(--page-left, 96px);
  margin: 0; background: transparent; color: #222; font-size: 16px; line-height: 1.5;
}
.qs-editor p { margin: 0 0 1em; }
```

As variáveis definidas pela aplicação vêm do mesmo `layout.page` passado ao Core. Os fallbacks CSS correspondem ao perfil atual e servem à receita sem inicialização geométrica; não são outra configuração da Presentation. Ao personalizar, mantenha os valores efetivos nas variáveis, não números independentes em cada host. Este mapeamento ainda é trabalho da aplicação; não é uma API de composição já oferecida pela biblioteca.

A Presentation posiciona as folhas e as regiões conforme o snapshot. Não some o gap novamente. O footer já recebe um rect com margem esquerda e largura útil; não acrescente outra margem/padding de página. Alterar fontes, estilos métricos ou o tamanho de imagens após o carregamento pode exigir novo cálculo: não há observação automática de imagens, resize ou mutações DOM. Configure largura e padding do Editor antes da montagem; `page.width` não aplica esses estilos por você. Repintar um snapshot antigo na Presentation não recalcula paginação.

A área editável fica acima da Presentation, com fundo transparente. O exemplo usa folha 816×1056, margens 96 e gap 20, equivalentes ao perfil Letter atual em CSS px. Não é A4. Cores/sombras podem usar as variáveis existentes da Presentation, como `--document-editor-page-background` e `--document-editor-page-shadow`, sem alterar retângulos.

### Coerência geométrica da montagem

```text
frame (.qs-frame, relativo; largura da página; sem padding/borda próprios)
├── pages (.qs-pages, absoluto; inset: 0)
│   └── camada Presentation → folhas/header/footer absolutos nos rects do snapshot
└── editor (.qs-editor, fluxo normal; sem inset extra)
    └── .ProseMirror (border-box; largura 100%; padding das margens)
```

O contrato desta receita depende do CSS mostrado, sem regras externas que acrescentem offset, borda, padding, transformação ou escala a apenas uma camada. O `padding: 24px` do body desloca o conjunto, não somente uma das camadas. A margem automática do frame centraliza ambas. O z-index mantém texto acima do papel; ele não corrige origem ou escala.

Mantenha a largura e o padding do Editor derivados de `layout.page`. As projeções usam coordenadas locais de layout (`DocumentLayoutSpace`), em CSS px: não some o deslocamento do body nem outro gap aos retângulos recebidos. A altura do frame acompanha o fim da última folha, mas isso não comprova a posição de cada linha. O alinhamento físico completo ainda não foi validado.

A receita não reduz automaticamente a folha para caber na viewport; a aplicação define a rolagem externa. O [Quick Start](docs/quick-start.md#coerência-geométrica-da-montagem) detalha os requisitos de montagem, personalização e estilos estruturais.

## 4. Executar e interpretar

```sh
npm run check
npm run build
npm run dev
```

`check` verifica tipos. `build` encadeia checagem e bundle; o Vite isolado não é um substituto para tsc. O servidor informa a URL disponível. Não é necessário acessar fontes, `dist` ou configuração da biblioteca original: todos os imports passam pelo pacote instalado.

Depois de iniciar, verifique a área editável, as folhas e a numeração; acrescente conteúdo suficiente para observar novas páginas. O exemplo encerra Editor e Presentation no descarte. Essa verificação manual não equivale a teste de aceitação nem comprova correção geométrica, idempotência ou compatibilidade ampla; não substitui uma validação da aplicação no seu ambiente.

## Fluxos separados

- **Core isolado:** use Editor/schema, `PaginationExtension` e `style.css`, recebendo snapshots por `onLayoutStable`; não crie Presentation. O Core mantém decorações e cálculo, mas não desenha papel/header/footer. Os hosts e insets do editor continuam necessários.
- **Presentation isolada:** use `createDocumentPresentation` e `presentation.css`, recebendo um `LayoutSnapshot` externo. Não cria Editor, não mede conteúdo e não calcula paginação. Importar um tipo `LayoutSnapshot` não carrega o Core em runtime.
- **Manual:** a receita histórica conecta Core e Presentation por callback. StarterKit é conveniência do exemplo, não dependência obrigatória da biblioteca.
- **Coordenado:** a factory opcional `createDocumentEditor(options)` coordena recursos próprios; o exemplo acima permanece proposto, com execução literal não demonstrada.

O [Quick Start completo](docs/quick-start.md) traz as duas receitas isoladas e detalhes de callbacks, índices e descarte. Esses guias estão no repositório e não são incluídos no tarball atual (`files: dist`). Esta receita integrada no README não depende deles.

## Limites essenciais

- **Geometria e atualização:** origem, largura e margens dos hosts precisam permanecer coerentes. Alterações documentais são detectadas conforme a regra de `Node.eq` descrita na API. CSS, fontes, dimensões e recursos tardios permanecem fora da observação geral automática.
- **Estabilidade:** quando o controller está ocioso, `whenLayoutStable(editor)` agenda cálculo; com timer ou cálculo em curso, aguarda o trabalho acompanhado pelo controller, sem garantir uma rodada adicional. Não é uma API geral de invalidação, não certifica a geometria atual e pode permanecer pendente em determinados caminhos de falha.
- **Resultados:** snapshots podem conter paginação parcial diagnosticada. Há registros de idempotência negativa e violações geométricas; concluir uma rodada ou observar edição responsiva não demonstra que esses problemas foram resolvidos.
- **Conteúdo e ambientes:** schema válido não garante suporte a qualquer nó. Tabelas arbitrárias, conteúdo personalizado, impressão composta, múltiplos editores, zoom e compatibilidade geral de navegadores/Tiptap 2/3 não estão certificados.

Veja [API](docs/api.md#snapshots-e-estabilidade) para o contrato de atualização, [Quick Start](docs/quick-start.md) para os fluxos completos e [limitações](docs/limitations.md) para resultados, ressalvas e questões abertas. Não há homologação geral da biblioteca.

## Documentação do repositório

- [Quick Start](docs/quick-start.md), [API](docs/api.md) e [arquitetura](docs/architecture.md).
- [Desenvolvimento](docs/development.md) e [Live Demo](examples/live-demo/NOTES.md); a Demo usa entradas públicas resolvidas para `dist/` local e não substitui instalação independente do pacote.
- [Limitações](docs/limitations.md) e [backlog](docs/backlog.md).
- [Proveniência](docs/provenance.md), [história](docs/project-history.md) e [arquivo histórico](docs/archive/README.md).
- Decisões: [extração](docs/decisions/ADR-001-project-consolidation.md), [independência](docs/decisions/ADR-002-product-independence.md), [ownership histórico](docs/decisions/ADR-003-host-dom-ownership.md) e [composed-only](docs/decisions/ADR-004-composed-only.md).

Esses links relativos servem à navegação do repositório; a ausência dos guias num tarball não autoriza imports privados ou acesso às fontes para fazer a biblioteca funcionar.

## Licença

[MIT](LICENSE), Copyright (c) 2026 Jhonny B. Castro.
