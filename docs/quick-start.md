# Quick Start — Guia de Início Rápido

Este guia apresenta o passo a passo para integrar a paginação visual do `document-editor` em uma aplicação baseada em Vite e TypeScript.

A biblioteca oferece dois caminhos principais de integração:
1. **[Composição Coordenada V1](#composição-coordenada-v1--quick-start-primário) (Recomendado):** Inicializa e sincroniza automaticamente a área de edição e a apresentação visual por meio da factory `createDocumentEditor`.
2. **[Composição Manual Avançada](#composição-manual-avançada):** Fornece controle direto sobre o ciclo de vida e a montagem de cada camada para cenários de arquitetura especializada.
3. **[Módulos Isolados](#módulos-isolados):** Permite utilizar apenas o Core (cálculo) ou apenas a Presentation (desenho).

---

## 1. Preparação do Ambiente e Instalação

### Geração do Pacote Local da Main

A base canônica permanente do projeto é a branch `main` (commit `c7b5497cc58bbddbf6966f69d0409040bb3d468d`). Para obter o pacote validado, gere o arquivo `.tgz` na raiz da biblioteca:

```bash
npm run build
npm pack
```

O comando gerará o arquivo `jhonny_bcastro-document-editor-0.1.0-rc.4.tgz`.

### Estrutura da Aplicação Consumidora

Crie um diretório isolado para o projeto consumidor e configure os arquivos fundamentais:

`package.json`:
```json
{
  "name": "document-editor-quickstart",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "check": "tsc --noEmit",
    "build": "npm run check && vite build"
  },
  "dependencies": {
    "@jhonny_bcastro/document-editor": "file:./jhonny_bcastro-document-editor-0.1.0-rc.4.tgz",
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

Copie o `.tgz` gerado para a raiz da aplicação consumidora, ao lado de `package.json`, para corresponder ao caminho `file:./jhonny_bcastro-document-editor-0.1.0-rc.4.tgz` acima.

Instale as dependências via:
```bash
npm install
```

### Configuração TypeScript e Tipos CSS

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "strict": true,
    "noEmit": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```
*(Esta diretiva permite que o TypeScript reconheça as importações dos subpaths CSS `@jhonny_bcastro/document-editor/style.css` e `@jhonny_bcastro/document-editor/presentation.css`).*

---

## Composição coordenada V1 — Quick Start primário

A Composição Coordenada V1 (`createDocumentEditor`) é o caminho de consumo primário e recomendado. A factory cria o elemento wrapper interno, atualiza sua altura conforme os snapshots e sincroniza as projeções do Core com a Presentation. Não instala observadores automáticos para mudanças externas de dimensões, CSS ou fontes.

### HTML (`index.html`)

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Exemplo Coordenado — document-editor</title>
  </head>
  <body>
    <div id="document"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### TypeScript (`src/main.ts`)

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
  extensions: [StarterKit], // Não adicionar PaginationExtension aqui
  content: '<p>Documento inicial com paginação contínua.</p>',
  layout: {
    page: {
      pageGap: 32, // Espaço entre as folhas decorativas em CSS px
    },
  },
  renderHeader(context, mountPoint) {
    mountPoint.textContent = 'Cabeçalho Institucional';
    mountPoint.style.fontSize = '12px';
    mountPoint.style.color = '#718096';
  },
  renderFooter(context, mountPoint) {
    mountPoint.textContent = `Página ${context.pageIndex + 1} de ${context.totalPages}`;
    mountPoint.style.fontSize = '12px';
    mountPoint.style.textAlign = 'right';
  },
  onLayoutStable(snapshot) {
    console.log('Publicação recebida. Total de páginas:', snapshot.pages.length);
  },
  onError(incident) {
    console.error('Incidente na composição:', incident);
  },
};

const instance = createDocumentEditor(options);

// Exemplo de manipulação programática do conteúdo
export function replaceContent(html: string) {
  instance.editor.commands.setContent(html);
}

// Encerramento ordenado e descarte da instância
export function dispose() {
  instance.destroy();
}
```

### Executar a Aplicação

```bash
npm run check   # Verifica tipos TypeScript
npm run build   # Executa build de produção com Vite
npm run dev     # Inicia o servidor local de desenvolvimento
```

---

## 3. Presets e Configurações Cotidianas

### Configuração de Dimensões e Margens (`layout.page`)

A propriedade `layout.page` aceita valores numéricos finitos em **CSS pixels** (96 DPI):

```ts
// Preset Carta / Letter (Padrão: 8.5" x 11" ≈ 816px x 1056px)
export const LETTER_PAGE = {
  width: 816,
  height: 1056,
  marginTop: 96,
  marginRight: 96,
  marginBottom: 96,
  marginLeft: 96,
  pageGap: 20,
};

// Preset A4 (210mm x 297mm ≈ 794px x 1123px)
export const A4_PAGE = {
  width: 794,
  height: 1123,
  marginTop: 96,
  marginRight: 96,
  marginBottom: 96,
  marginLeft: 96,
  pageGap: 24,
};
```

Para aplicar o preset A4 na Composição Coordenada:
```ts
const options: DocumentEditorOptions = {
  host,
  extensions: [StarterKit],
  layout: {
    page: A4_PAGE,
  },
  // ...
};
```

### Callbacks de Cabeçalho e Rodapé (`RunningContentContext`)

Os callbacks `renderHeader` e `renderFooter` recebem o contexto da folha atual e o elemento container `mountPoint`:
- `context.pageIndex`: Índice da página com base zero (`0, 1, 2...`).
- `context.totalPages`: Total de páginas emitidas no snapshot atual.
- `context.region`: `'header' | 'footer'`.
- `context.rect`: Retângulo delimitador reservado para a região (já descontadas as margens da folha).

> **Atenção:** Os elementos renderizados são puramente visuais (`aria-hidden`). Não injete controles focáveis (inputs, botões navegáveis por tab) nem altere as margens externas do `mountPoint`.

---

## Composição manual avançada

Caso sua aplicação necessite gerenciar diretamente os ciclos de vida, personalizar eventos do Tiptap ou desacoplar o container do Editor da camada de folhas, utilize a **Composição Manual**.

### HTML (`index.html`)

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Composição Manual</title>
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

### CSS Estrutural (`src/style.css`)

```css
body {
  margin: 0;
  padding: 24px;
  background: #e8e8e8;
  font-family: system-ui, sans-serif;
}

.qs-frame {
  position: relative;
  width: var(--page-width, 816px);
  min-height: var(--page-height, 1056px);
  margin-inline: auto;
}

.qs-pages {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.qs-editor {
  position: relative;
  z-index: 1;
}

.qs-editor > .ProseMirror {
  box-sizing: border-box;
  width: 100%;
  min-height: var(--page-height, 1056px);
  padding: var(--page-top, 96px) var(--page-right, 96px) var(--page-bottom, 96px) var(--page-left, 96px);
  margin: 0;
  background: transparent;
  color: #222;
  font-size: 16px;
  line-height: 1.5;
}

.qs-editor p {
  margin: 0 0 1em;
}
```

### TypeScript (`src/main.ts`)

```ts
import './style.css';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  PaginationExtension,
  type LayoutConfig,
  type LayoutSnapshot,
} from '@jhonny_bcastro/document-editor';
import '@jhonny_bcastro/document-editor/style.css';
import { createDocumentPresentation } from '@jhonny_bcastro/document-editor/presentation';
import '@jhonny_bcastro/document-editor/presentation.css';

const frame = document.querySelector<HTMLElement>('#document')!;
const editorHost = document.querySelector<HTMLElement>('#editor')!;
const presentationHost = document.querySelector<HTMLElement>('#pages')!;

// Deriva a configuração a partir dos padrões públicos da extensão
const defaults = PaginationExtension.options.layout;
const layout: LayoutConfig = {
  ...defaults,
  page: { ...defaults.page, pageGap: 32 },
};

// Sincroniza as variáveis CSS da moldura com a geometria
const page = layout.page;
for (const [name, value] of Object.entries({
  width: page.width,
  height: page.height,
  top: page.marginTop,
  right: page.marginRight,
  bottom: page.marginBottom,
  left: page.marginLeft,
})) {
  frame.style.setProperty(`--page-${name}`, `${value}px`);
}

let disposed = false;
let latestSnapshot: LayoutSnapshot | undefined;

// 1. Inicializa a camada de apresentação
const presentation = createDocumentPresentation(presentationHost, {
  renderFooter: (context, mount) => {
    mount.textContent = `Página ${context.pageIndex + 1} de ${context.totalPages}`;
    mount.style.textAlign = 'right';
  },
});

// 2. Inicializa o Editor conectando o snapshot à apresentação
const editor = new Editor({
  element: editorHost,
  extensions: [
    StarterKit,
    PaginationExtension.configure({
      layout,
      onLayoutStable(snapshot) {
        if (disposed) return;
        latestSnapshot = snapshot;
        presentation.render(snapshot);

        // Atualiza a altura do frame conforme a última folha
        const last = snapshot.pages[snapshot.pages.length - 1];
        frame.style.minHeight = `${
          last ? last.sheetRect.top + last.sheetRect.height : page.height
        }px`;
      },
    }),
  ],
  content: '<h1>Documento</h1>' + Array.from({ length: 20 }, (_, i) =>
    `<p>Parágrafo ${i + 1}. Conteúdo para demonstrar a paginação contínua.</p>`
  ).join(''),
});

// 3. Função de descarte limpo
export function dispose() {
  if (disposed) return;
  disposed = true;
  editor.destroy();
  presentation.destroy();
}

window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
```

### Coerência Geométrica da Montagem Manual

| Elemento | Relação e Contrato |
|---|---|
| **Frame (`.qs-frame`)** | Posicionamento relativo; largura correspondente à folha (`page.width`); sem padding ou borda próprios. |
| **Pages Host (`.qs-pages`)** | Posicionamento absoluto com `inset: 0` e `pointer-events: none` para ficar sob o texto. |
| **Editor Host (`.qs-editor`)** | Posicionamento relativo com `z-index: 1`; fluxo normal. |
| **ProseMirror (`.ProseMirror`)** | `box-sizing: border-box`; fundo transparente; padding correspondente exatamente às margens da página. |
| **Folhas (`sheetRect`)** | Posicionadas de forma absoluta pela Presentation no top local `i * (height + pageGap)`. |

---

## Módulos Isolados

### Core Isolado (Cálculo sem Desenho de Folhas)

Útil para aplicações que desejam obter os pontos de quebra e snapshots sem desenhar as folhas da Presentation. A medição continua dependendo de um editor montado no DOM: configure sua largura e padding conforme `layout.page`, como na receita manual acima. O import `style.css` não configura essas dimensões:

```ts
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension, type LayoutSnapshot } from '@jhonny_bcastro/document-editor';
import '@jhonny_bcastro/document-editor/style.css';

let currentSnapshot: LayoutSnapshot | undefined;

const editor = new Editor({
  element: document.querySelector<HTMLElement>('#editor')!,
  extensions: [
    StarterKit,
    PaginationExtension.configure({
      onLayoutStable(snapshot) {
        currentSnapshot = snapshot;
        console.log('Quebras calculadas:', snapshot.breaks.length);
      },
    }),
  ],
  content: '<p>Texto sob análise de paginação.</p>',
});
```

### Presentation Isolada (Visualização de Projeções Externas)

Útil para renderizar projeções de páginas pré-calculadas ou recebidas de um backend sem instanciar um editor ProseMirror:

```ts
import { createDocumentPresentation } from '@jhonny_bcastro/document-editor/presentation';
import '@jhonny_bcastro/document-editor/presentation.css';
import type { LayoutSnapshot } from '@jhonny_bcastro/document-editor';

const host = document.querySelector<HTMLElement>('#pages')!;
const presentation = createDocumentPresentation(host, {
  renderFooter(context, mount) {
    mount.textContent = `Página ${context.pageIndex + 1} de ${context.totalPages}`;
  },
});

// Fornece um snapshot previamente calculado
presentation.render(externalSnapshot);
```

---

## 4. Próximos Passos e Referências

- **[Referência Completa de API](api.md):** Tipagem detalhada de `DocumentEditorOptions`, tratamento de incidentes e métodos auxiliares como `whenLayoutStable`.
- **[Limitações Técnicas Conhecidas](limitations.md):** Reatividade documental, regras para tabelas e blocos indivisíveis.
- **[Demonstração Interativa (Live Demo)](../examples/live-demo/NOTES.md):** Aplicação executável localmente para testar os fluxos interativos.
