# Quick Start — fluxos de consumo

**Identidade dos exemplos:** a receita manual histórica abaixo foi exercitada com o tarball identificado nesta seção. Não se presume que esse artefato contenha a Composição Coordenada V1. Para usar `/compose`, é necessário um pacote que efetivamente inclua essa entrada e suas declarações. A versão `0.1.0-rc.4`, isoladamente, não identifica os bytes do pacote. O novo exemplo coordenado ainda depende de validação em consumidor independente.

## Composição coordenada V1 — exemplo proposto

**Exemplo proposto — composição coordenada V1.** As assinaturas e os caminhos públicos abaixo foram conferidos por leitura dos tipos, exports e implementação locais. Este exemplo específico não foi compilado nem executado nesta análise e ainda não foi validado em consumidor independente. Pressupõe ambiente browser, pacote identificado que contenha `/compose`, resolução de imports CSS e extensões de schema compatíveis. Não reutilize automaticamente as versões do manifesto histórico.

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

A factory configura a geometria estrutural inicial. Tipografia, estilos não conflitantes e condições de montagem continuam relevantes. A resolução das dependências, a instalação limpa e a apresentação visual deste exemplo serão verificadas no consumidor independente.

## Receita manual — artefato histórico identificado

**Atualizado em 24/10/2026.** Guia de montagem de um consumidor Vite + TypeScript. Artefato de referência: tarball oriundo de `feature/compose-next`, commit `1c3b5add4ec8201ff176d67fd83f6677502cdd1d`, SHA-256 `fa869168a25bd9c6266188a1075fe714d2db15c3fa5fdf964ec35584e37dee14`.

O manifesto declara `0.1.0-rc.4`; identifique o artefato pelo commit de origem e pelo hash, não apenas pela versão. As instruções usam um tarball local, sem presumir publicação npm. Este guia é posterior ao commit de origem do pacote.

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

O código usa somente entradas públicas do pacote. `editor`, `presentation`, `layout`, `dispose` e `getSnapshot` exportados no fim são recursos locais da aplicação de exemplo, não novas funções públicas da biblioteca. Pode remover esses exports se não usar um harness de inspeção.

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

| Elemento | Relação geométrica da receita |
|---|---|
| Frame | Largura de `layout.page.width`; altura mínima inicial da página, atualizada até o fim da última folha pelo callback. Essa extensão não comprova a posição de cada linha. |
| Hosts pages/editor | Mesma origem local: pages por `inset: 0`, editor pelo fluxo normal sem insets adicionais. |
| Editor ProseMirror | Box externo alinhado aos hosts; padding das margens. Área útil nominal de 624×864 CSS px nos defaults. Fontes, margens dos blocos e entrelinha afetam medidas; o padding externo não se repete manualmente por página. |
| Folhas | Top local `i * (height + pageGap)`, com i zero-based; não acrescentar outro gap em CSS. |
| Header/footer | Nos defaults, left 96 e width 624; footer começa em 960 na primeira folha. O renderer não deve acrescentar novamente o recuo de página. |

O snapshot usa coordenadas locais de layout; a medição do Core usa DOM/viewport e a origem do Editor. Não some o deslocamento do body aos retângulos recebidos. Manter essa montagem coerente é necessário, mas o alinhamento físico completo entre hosts, folhas e texto não foi validado.

A receita pressupõe Editor com dimensões mensuráveis e conteúdo com largura útil coerente com a folha. A largura da página não é aplicada ao Editor pelo Core. Se a viewport for menor, o exemplo não reduz a folha nem escolhe um perfil responsivo: a aplicação define a rolagem externa. Reduzir apenas a largura do Editor altera a quebra de linhas sem ajustar a folha. Mesmo uma transformação comum às duas camadas não tem garantia de paginação: o cálculo mistura medidas DOM com dimensões configuradas e não normaliza escala CSS. Zoom e transformações permanecem não certificados.

Cores, sombras e fundo das folhas podem ser personalizados sem mudar seus retângulos. Fontes, entrelinha, margens de blocos, bordas que alterem medidas e tamanhos de imagens influenciam a paginação. Em tabelas, preserve a regra estrutural `.page-break-row > td` / `.page-break-row > th` de `style.css`, que acrescenta o deslocamento ao padding superior. Se personalizar o padding-base das células, alinhe também `--tiptap-cell-padding` (fallback 8px); não substitua o padding estrutural por um valor fixo. Isso não certifica tabelas arbitrárias. O CSS Core também contém regras globais de impressão Letter, que não acompanham automaticamente outro perfil de página.

Estabilize, quando possível, fontes e dimensões dos recursos antes de montar. Carregamento tardio de imagens e mudanças externas de CSS/tamanho não são observados automaticamente. Veja [invalidação e atualização](api.md#atualização-e-reatividade) antes de depender de recálculo após esses eventos; não reutilize um snapshot antigo como prova de novo cálculo.

## 4. Executar e interpretar

```sh
npm run check
npm run build
npm run dev
```

`check` verifica tipos. `build` encadeia checagem e bundle; o Vite isolado não é um substituto para tsc. O servidor informa a URL disponível. Não é necessário acessar fontes, `dist` ou configuração da biblioteca original: todos os imports passam pelo pacote instalado.

Após iniciar o servidor, verifique se há uma área editável, folhas e numeração; acrescente conteúdo suficiente para observar novas páginas. No descarte, o exemplo encerra Editor e Presentation. Essas observações não substituem os limites de validação ao fim deste guia.

## 5. Core isolado — cálculo sem folhas da Presentation

Este fluxo usa Editor/schema e CSS geométrico, mas não importa Presentation ou seu CSS. Produz snapshots e decorações; **não** desenha automaticamente papel, cabeçalho ou rodapé. Para executá-lo no projeto Vite, salve o HTML abaixo como página alternativa (por exemplo, `core-only.html` na raiz do projeto, acessível via `/core-only.html`) ou substitua o conteúdo de `index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Core isolado</title>
  </head>
  <body>
    <div id="document" class="qs-frame">
      <div id="editor" class="qs-editor"></div>
    </div>
    <script type="module" src="/src/core-only.ts"></script>
  </body>
</html>
```

`src/core-only.ts`:

```ts
import './style.css';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension, type LayoutSnapshot } from '@jhonny_bcastro/document-editor';
import '@jhonny_bcastro/document-editor/style.css';
const frame = document.querySelector<HTMLElement>('#document')!;
const page = PaginationExtension.options.layout.page;
for (const [name, value] of Object.entries({width:page.width,height:page.height,top:page.marginTop,right:page.marginRight,bottom:page.marginBottom,left:page.marginLeft})) frame.style.setProperty(`--page-${name}`,`${value}px`);
let snapshot: LayoutSnapshot | undefined;
const editor = new Editor({ element: document.querySelector<HTMLElement>('#editor')!, extensions: [StarterKit, PaginationExtension.configure({onLayoutStable(s) { snapshot = s; }})], content: Array.from({length:24},()=>`<p>${'Core sem Presentation. '.repeat(25)}</p>`).join('') });
function dispose() { editor.destroy(); }
window.addEventListener('pagehide', dispose, {once:true});
if (import.meta.hot) import.meta.hot.dispose(dispose);
export { editor, dispose };
export const getSnapshot = () => snapshot;
```

Este fluxo mantém Editor e cálculo de paginação, sem desenhar folhas da Presentation. Consulte o último snapshot com `getSnapshot()`. A quantidade de páginas depende do conteúdo e do ambiente.

## 6. Presentation isolada — visualização de dados fornecidos

Não precisa de Editor para executar, mas precisa de `LayoutSnapshot`/`PageProjection` coerentes produzidos externamente. Importar esses tipos do Core não implica carregar o Core em runtime. O exemplo sintético só desenha uma folha; não mede texto ou cria paginação automaticamente. Para executá-lo no projeto Vite, salve o HTML abaixo como página alternativa (por exemplo, `presentation-only.html` na raiz do projeto, acessível via `/presentation-only.html`) ou substitua o conteúdo de `index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Presentation isolada</title>
  </head>
  <body>
    <div id="document" class="qs-frame">
      <div id="pages" class="qs-pages"></div>
    </div>
    <script type="module" src="/src/presentation-only.ts"></script>
  </body>
</html>
```

`src/presentation-only.ts`:

```ts
import './style.css';
import type { LayoutSnapshot } from '@jhonny_bcastro/document-editor';
import { createDocumentPresentation } from '@jhonny_bcastro/document-editor/presentation';
import '@jhonny_bcastro/document-editor/presentation.css';
// Dados fornecidos externamente: não há medição, editor ou cálculo de paginação.
const snapshot: LayoutSnapshot = { revision: 0, breaks: [], diagnostics: [], pages: [{ index: 1, sheetRect: {top:0,left:0,width:816,height:1056}, headerRect: {top:0,left:96,width:624,height:96}, footerRect: {top:960,left:96,width:624,height:96} }] };
const presentation = createDocumentPresentation(document.querySelector<HTMLElement>('#pages')!, {renderFooter(c,mount) {mount.textContent = `Página ${c.pageIndex + 1} de ${c.totalPages}`;}});
presentation.render(snapshot);
function dispose() { presentation.destroy(); }
window.addEventListener('pagehide', dispose, {once:true});
if (import.meta.hot) import.meta.hot.dispose(dispose);
export { presentation, dispose };
```

Usa o mesmo CSS da receita, com fallbacks do perfil Letter. Uma aplicação que fornece outro snapshot também precisa dimensionar seu host de forma coerente. Este exemplo desenha uma folha com footer, sem área editável; não é um editor independente nem um gerador de snapshots.

## 7. Callbacks e recursos

`onLayoutStable` entrega o snapshot ao fim de uma rodada local; o exemplo usa esse callback para atualizar a Presentation, sem precisar chamar também `whenLayoutStable(editor)`.

Quando o controller está ocioso, `whenLayoutStable(editor)` agenda cálculo. Com timer ou cálculo em curso, aguarda uma conclusão sem garantir rodada adicional. Não é uma operação geral de invalidação nem certifica que o snapshot reflita mudanças externas posteriores. A promise pode continuar pendente se o percurso não alcançar a emissão do snapshot; um aborto não implica necessariamente pendência permanente. Consulte o [contrato de estabilidade](api.md#snapshots-e-estabilidade) antes de usá-lo para coordenar mudanças externas.

O snapshot pode conter paginação parcial acompanhada de diagnóstico. Examine `diagnostics`; concluir uma rodada não comprova processamento integral nem geometria atual correta. `presentation.render(snapshot)` só atualiza a apresentação dos dados recebidos, sem solicitar cálculo ao Core.

`renderHeader`/`renderFooter` são opcionais, recebem contexto e mount e podem retornar disposer. `pageIndex` é zero-based; `PageProjection.index` é one-based. As opções `runningContent` do Core não são convertidas automaticamente em renderers da Presentation.

A Presentation recria seus elementos em `render` e executa disposers anteriores. `clear` limpa conteúdo; `destroy` remove a camada e não aceita novos renders. A aplicação deve desmontar Editor e Presentation, como no exemplo. Conteúdo visual não deve ser focável; a camada é aria-hidden. Metadados não confiáveis devem usar texto ou tratamento seguro, não interpolação indiscriminada em `innerHTML`.

## 8. Limites que acompanham o exemplo

A receita foi exercitada com checagem TypeScript, bundle e montagem no browser: edição paginada e atualização da numeração foram observadas, assim como a remoção dos elementos no descarte. Isso não constitui auditoria de memória, benchmark ou certificação geométrica. Não houve nova execução para esta revisão editorial.

Não há garantia geral de idempotência do cálculo, ausência de violações geométricas ou alinhamento físico completo. Zoom/transformações, impressão composta, SSR, múltiplos editores, tabelas arbitrárias e compatibilidade geral Tiptap 2/3 não estão certificados por esta receita. Mudanças de texto, marcas ou atributos que preservem tamanho e estrutura podem não agendar novo cálculo; recursos tardios também não têm recálculo automático garantido.

Esta descrição pertence ao tarball histórico identificado no guia. A implementação atual usa `Node.eq`; isso não demonstra que os bytes daquele tarball contenham a correção.

## Referências

A composição do exemplo pertence à aplicação; este guia não introduz factory, configuração compartilhada automática ou API de atualização dinâmica. Veja [API](api.md) para o contrato público, [limitações](limitations.md) para as ressalvas conhecidas e [desenvolvimento](development.md) para os registros técnicos e de validação.

Os guias complementares ficam no repositório e não acompanham necessariamente o tarball; o README contém uma receita integrada sem exigir acesso a eles.
