# document-editor

Biblioteca de paginação visual de documentos contínuos para Tiptap/ProseMirror. As quebras automáticas são decorações transitórias, separadas do documento semântico.

## Estado e distribuição

Linha ativa: `feature/compose-next`. Este guia foi preparado sobre `1c3b5add4ec8201ff176d67fd83f6677502cdd1d`, antes destas alterações documentais. A linha anterior `dev/cons014-composed-20261022` pertence à proveniência CONS-014.

O manifesto declara `@jhonny_bcastro/document-editor` e `0.1.0-rc.4`. Isso não identifica o código atual como o tarball RC.4 histórico, não anuncia nova versão e não comprova publicação npm. O artefato local ensaiado tem SHA-256 `fa869168a25bd9c6266188a1075fe714d2db15c3fa5fdf964ec35584e37dee14`.

Core mede e calcula quebras/snapshots; Presentation desenha páginas a partir deles. A aplicação cria Editor, schema, hosts DOM e sua coordenação. Somente `composed` é suportado; outros modos são rejeitados. Não há factory de composição nem API de atualização dinâmica de layout neste Quick Start.

## Receita integrada autocontida

As próximas seções permitem preparar a aplicação sem importar fontes, configurações ou arquivos de exemplo do repositório. O pacote fornece Core, Presentation e os subpaths `style.css` e `presentation.css`. O exemplo usa somente essas entradas públicas. `whenLayoutStable`, `PaginationPluginKey` e `preparePrintSession` também estão exportados; não são necessários para montar esta receita.

## 1. Preparar uma aplicação independente

Use uma pasta nova, fora da biblioteca. Copie o `.tgz` fornecido para `package-input/library.tgz` e confira seu SHA-256 antes de instalar. As versões abaixo foram usadas nesta verificação; não são certificação de toda a faixa dos peers.

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

Depois, a instalação normal desse manifesto seria `npm install`. Essa instalação limpa **não foi repetida na investigação que fundamenta este guia**: a verificação usou cópia física das dependências já resolvidas do consumidor preservado, sem rede. O manifesto de exemplo declara dependências diretas explícitas e versões de topo fixas; produza e preserve o lockfile ao instalar em seu ambiente. A resolução transitiva dessa nova instalação ainda não foi validada por este guia.

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

O código usa somente entradas públicas do pacote. `editor`, `presentation`, `layout`, `dispose` e `getSnapshot` exportados no fim são recursos locais da aplicação de exemplo, não novas funções públicas da biblioteca. Pode remover esses exports se não usar um harness de inspeção.

`PaginationExtension.options.layout` fornece os defaults presentes na extensão. O exemplo cria um `LayoutConfig` completo e substitui o objeto `page` sem modificar os defaults. É possível personalizar `pageGap` nesse objeto. A tipagem atual rejeita `configure({ layout: { page: { pageGap: 32 } } })`, embora o merge de runtime testado preserve os demais defaults; por isso o guia não usa esse atalho nem `as any`.

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

A Presentation posiciona as folhas e as regiões conforme o snapshot. Não some o gap novamente. O footer já recebe um rect com margem esquerda e largura útil; não acrescente outra margem/padding de página. Alterar fontes ou estilos métricos pode exigir novo cálculo, que não é automaticamente garantido pelo contrato atual.

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

| Elemento | Relação estática esperada | Limite da evidência |
|---|---|---|
| Frame | Largura vem de `layout.page.width`; min-height inicial vem da altura e depois alcança o fim da última folha | A fórmula reserva extensão visual; não prova posição de cada linha. |
| Hosts pages/editor | Mesma origem local do frame: pages por `inset: 0`, editor pelo fluxo normal sem insets adicionais | Coerência por leitura de HTML/CSS; não houve comparação de `getBoundingClientRect()` desses hosts na coleta preservada. |
| Editor ProseMirror | Borda externa alinhada aos hosts; padding define área útil. Com os defaults, largura útil nominal 624 e altura útil 864 CSS px | Fontes, margens dos blocos e entrelinha continuam afetando medidas. Padding inicial/final não é padding repetido manualmente por página. |
| Folhas | Snapshot usa top local `i * (height + pageGap)`, com i zero-based; não somar outro gap em CSS | Browser registrou estilos inline 816×1056 e tops 0/1076 nas duas primeiras folhas, não seus retângulos globais medidos. |
| Header/footer | Nos defaults, left 96, width 624; footer começa em 960 na primeira folha | Derivado de `PageProjection`, não validação empírica de todas as margens. O renderer não deve recuar outra vez o conteúdo. |

O snapshot está em coordenadas locais de layout, enquanto a medição do Core usa o DOM/viewport e compensa a origem do editor. A receita procura tornar essas origens compatíveis; não converte coordenadas aplicando o deslocamento do body aos rects do snapshot. Somente uma medição conjunta de frame, hosts, editor, folhas e linhas poderia comprovar o alinhamento físico no ambiente alvo. Essa medição completa **não foi realizada** na evidência disponível.

### O que o browser confirmou e o que não confirmou

A coleta headless registrou editor editável, sete folhas e seis quebras, depois doze folhas/onze quebras após inserção, numeração atualizada e remoção dos elementos observados no descarte. O campo chamado `rects` no JSON preservado contém `style.width`, `style.height` e `style.top`, e não uma leitura global de `getBoundingClientRect()`.

Não foram validados nessa coleta: alinhamento físico completo entre hosts e texto, cortes sem violações, precisão de margens, zoom/transformações, outras tipografias, responsividade, impressão ou idempotência. O HTTP 404 permaneceu sem origem identificada. Nenhum desses pontos foi convertido em aprovação pela abertura do exemplo.

## 4. Executar e interpretar

```sh
npm run check
npm run build
npm run dev
```

`check` verifica tipos. `build` encadeia checagem e bundle; o Vite isolado não é um substituto para tsc. O servidor informa a URL disponível. Não é necessário acessar fontes, `dist` ou configuração da biblioteca original: todos os imports passam pelo pacote instalado.

Na verificação focal do consumidor temporário, o tsc e o bundle do exemplo passaram. A inspeção headless observou 7 folhas e 6 quebras; após inserção, 12 folhas e 11 quebras, com numeração atualizada. A quantidade depende do conteúdo e do ambiente; esses números não são critérios fixos do produto. Houve HTTP 404 não investigado, sem impedir a montagem observada. Não foi aprovado layout geométrico geral ou idempotência.


## Fluxos separados e limites

- **Core isolado:** use Editor/schema, `PaginationExtension` e `style.css`, recebendo snapshots por `onLayoutStable`; não crie Presentation. O Core mantém decorações e cálculo, mas não desenha papel/header/footer. Os hosts e insets do editor continuam necessários.
- **Presentation isolada:** use `createDocumentPresentation` e `presentation.css`, recebendo um `LayoutSnapshot` externo. Não cria Editor, não mede conteúdo e não calcula paginação. Importar um tipo `LayoutSnapshot` não carrega o Core em runtime.
- **Integrado:** a receita acima conecta as duas partes por callback. O esquema é fornecido via StarterKit, que é conveniência deste exemplo, não dependência obrigatória da biblioteca.

O [Quick Start completo](docs/quick-start.md) traz as duas receitas isoladas e detalhes de callbacks, índices e descarte. Esses guias estão no repositório e não são incluídos no tarball atual (`files: dist`). Esta receita integrada no README não depende deles.

O primeiro executor relatou oito → nove páginas depois de configurar schema/CSS. A investigação focal posterior observou sete → doze com outro conteúdo, typecheck e bundle aprovados, e um HTTP 404 de origem não investigada no fluxo integrado. Não comparar as contagens como benchmark ou regressão.

Continuam abertas as ressalvas de reatividade de mudanças isométricas, geometria, idempotência, impressão composta, multi-instância, dependências e tabelas. `freshLayoutRound: true` não significa `idempotent: true`; os resultados negativos anteriores permanecem registrados. Nenhum Quick Start funcional constitui homologação completa.

## Documentação do repositório

- [Quick Start](docs/quick-start.md), [API](docs/api.md) e [arquitetura](docs/architecture.md).
- [Desenvolvimento](docs/development.md) e [Live Demo](examples/live-demo/NOTES.md); a Demo importa fontes e não substitui consumo do pacote.
- [Limitações](docs/limitations.md) e [backlog](docs/backlog.md).
- [Proveniência](docs/provenance.md), [história](docs/project-history.md) e [arquivo histórico](docs/archive/README.md).
- Decisões: [extração](docs/decisions/ADR-001-project-consolidation.md), [independência](docs/decisions/ADR-002-product-independence.md), [ownership histórico](docs/decisions/ADR-003-host-dom-ownership.md) e [composed-only](docs/decisions/ADR-004-composed-only.md).

Esses links relativos servem à navegação do repositório; a ausência dos guias num tarball não autoriza imports privados ou acesso às fontes para fazer a biblioteca funcionar.

## Licença

[MIT](LICENSE), Copyright (c) 2026 Jhonny B. Castro.
