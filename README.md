# document-editor

Biblioteca de paginação visual de documentos contínuos para Tiptap/ProseMirror. Calcula quebras estruturais dinâmicas, aplica decorações transitórias e fornece projeções de páginas, mantendo as quebras automáticas fora do documento semântico persistido.

Destina-se a aplicações que precisam acrescentar uma visualização paginada e dividida em folhas a um editor Tiptap existente. Não fornece um editor completo pronto para uso, menus ou botões de aplicação.

---

## Responsabilidades

A paginação adota uma separação rigorosa de responsabilidades entre três camadas:

| Camada | Responsabilidade Principal |
|---|---|
| **Core** | Mede o documento no DOM, avalia políticas de quebra (linhas, títulos, tabelas), calcula quebras estruturais, aplica neutralizadores e emite snapshots com projeções geométricas. |
| **Presentation** | Desenha as folhas decorativas, margens e áreas de cabeçalho/rodapé conforme as projeções recebidas; não mede texto, não calcula quebras e não cria área editável. |
| **Aplicação** | Fornece o elemento hospedeiro (*host*), schema Tiptap, conteúdo, regras de negócio e persistência. Na **Composição Coordenada**, a biblioteca gerencia a sincronização interna entre Core e Presentation; na **Composição Manual**, a aplicação coordena o ciclo de vida e os eventos de cada camada. |

> **Modo visual:** Somente o modo `composed` é suportado pela biblioteca. Ele garante que a área de edição e as folhas decorativas compartilhem um espaço geométrico unificado sem interferência no modelo semântico.

---

## Estado e Distribuição

- **Branch canônica permanente:** `main` (base canônica documental após Pull Requests #16, #20, #21, #19, #22 e #23: `fa199af49d0adabbd15d1a244b919451ff2a4d27`, tree `894f8badd5bd0cb83b3ad2f9c61deae582aad196`, sucessora do marco funcional pós-F3 `977f106c2fcf46771f46ae3a40813ddbc24f1297`; na preparação local de `24/11/2026` sobre essa base, a candidata `AUTO-CSS-C01 V1` encontrava-se pendente de revisão e integração, registro histórico que não estabelece o estado remoto de versões posteriores).
- **Versão do manifesto:** `0.1.0-rc.4`. Esta declaração identifica os metadados do pacote local, sem comprovar publicação no registro público npm.
- **Compatibilidade declarada:** `peerDependencies` preservam `@tiptap/core` e `@tiptap/pm` em `^2.0.0 || ^3.0.0`; o ambiente de desenvolvimento do repositório está alinhado em `@tiptap/{core,pm,starter-kit}` `^3.35.0` (resolvidos em `3.35.0`). Veja [Desenvolvimento](docs/development.md#ambiente-e-instalação) e [Proveniência](docs/provenance.md) para os ambientes ensaiados e o alcance das validações.
- **Instalação local do pacote:** Para gerar e instalar o tarball a partir da raiz do repositório:
  ```bash
  npm run build
  npm pack
  ```
  Isso produzirá o arquivo `.tgz` (ex.: `jhonny_bcastro-document-editor-0.1.0-rc.4.tgz`), que pode ser instalado diretamente na aplicação consumidora:
  ```bash
  npm install /caminho/para/jhonny_bcastro-document-editor-0.1.0-rc.4.tgz
  ```

---

## Quick Start — Composição Coordenada V1

A **Composição Coordenada V1** (`createDocumentEditor`) é o caminho recomendado para a maioria das aplicações. Ela inicializa e sincroniza automaticamente o Core e a Presentation dentro de um único elemento hospedeiro.

### 1. Elemento HTML

```html
<div id="document"></div>
```

### 2. Código TypeScript

```ts
import StarterKit from '@tiptap/starter-kit';
import {
  createDocumentEditor,
  type DocumentEditorOptions,
} from '@jhonny_bcastro/document-editor/compose';
import '@jhonny_bcastro/document-editor/style.css';
import '@jhonny_bcastro/document-editor/presentation.css';
// Opcional: importe o stylesheet do consumidor após os CSS do pacote
// caso deseje personalizar aparência ou regras pela cascata CSS.
import './style.css';

const host = document.querySelector<HTMLElement>('#document');
if (!host) throw new Error('Elemento #document não encontrado.');

const options: DocumentEditorOptions = {
  host,
  extensions: [StarterKit],
  content: '<p>Documento inicial paginado.</p>',
  layout: {
    page: {
      pageGap: 32, // Espaçamento entre folhas em CSS px
    },
  },
  renderFooter(context, mountPoint) {
    mountPoint.textContent = `Página ${context.pageIndex + 1} de ${context.totalPages}`;
  },
  onLayoutStable(snapshot) {
    console.log('Layout atualizado. Total de páginas:', snapshot.pages.length);
  },
  onError(incident) {
    console.error('Incidente na composição:', incident);
  },
};

// Inicializa a instância coordenada
const instance = createDocumentEditor(options);

// Acesso ao editor Tiptap subjacente
export function updateText() {
  instance.editor.commands.setContent('<p>Novo conteúdo adicionado.</p>');
}

// Encerramento limpo e liberação de recursos
export function dispose() {
  instance.destroy();
}
```

> **Atenção:** A composição coordenada instala sua própria extensão de paginação. **Não** inclua `PaginationExtension` no array `extensions`.

### 3. Comportamento CSS C-01 Nativo (`AUTO-CSS-C01 V1`)

A importação explícita de `@jhonny_bcastro/document-editor/style.css` e `@jhonny_bcastro/document-editor/presentation.css` continua obrigatória na integração (`createDocumentEditor` utiliza `injectCSS: false`, enquanto na montagem manual a opção `injectCSS` pertence ao `Editor` consumidor, não sendo imposta pela `PaginationExtension`). Sob o contrato **`AUTO-CSS-C01 V1`**, `@jhonny_bcastro/document-editor/style.css` passa a fornecer nativamente as regras `CSS C-01` escopadas a instâncias com `PaginationExtension` (marcadas internamente pela classe `document-editor-paginated` aplicada pelo plugin à raiz editável, sem alterar opções públicas nem introduzir injeção automática via JavaScript):

```css
/* Regras aplicadas nativamente por @jhonny_bcastro/document-editor/style.css */
.ProseMirror.document-editor-paginated {
  word-wrap: break-word;
  white-space: pre-wrap;
  white-space: break-spaces;
}

.ProseMirror.document-editor-paginated pre {
  white-space: pre-wrap;
}
```

Na integração padrão (tanto na Composição Coordenada quanto no Core manual), **não é mais necessário** que a aplicação declare essas regras em seu próprio CSS. Caso o consumidor deseje personalizar o comportamento via cascata CSS (por exemplo usando `#document .ProseMirror` após `@jhonny_bcastro/document-editor/style.css`), deve considerar o eventual efeito sobre a geometria medida pelo controlador. Consulte o [Quick Start Completo](docs/quick-start.md#comportamento-css-c-01-nativo-auto-css-c01-v1-e-personalização-opcional) e as [Limitações Técnicas](docs/limitations.md) para detalhes de especificidade, cascata e alcance das validações.

---

## Principais Configurações

### Opções da Factory (`DocumentEditorOptions`)

| Propriedade | Tipo | Descrição |
|---|---|---|
| `host` | `HTMLElement` (obrigatório) | Elemento DOM que conterá as camadas de edição e apresentação. |
| `content` | `Content` (opcional) | Conteúdo inicial (HTML ou JSON do ProseMirror). |
| `extensions` | `Extensions` (opcional) | Extensões do Tiptap (ex.: `StarterKit`). Não incluir paginação aqui. |
| `autofocus` | `FocusPosition` (opcional) | Quando omitido ou `undefined`, normalizado para `false` pela composição coordenada; valores explícitos são preservados. Essa normalização não se aplica automaticamente aos fluxos standalone/manuais. |
| `layout.page` | `DocumentEditorPageLayoutOptions` | Dimensões e margens estruturais da página (veja presets abaixo). |
| `renderHeader` | `(context, mountPoint) => void \| Disposer` | Callback para desenhar o conteúdo do cabeçalho de cada folha. |
| `renderFooter` | `(context, mountPoint) => void \| Disposer` | Callback para desenhar o conteúdo do rodapé de cada folha. |
| `onLayoutStable` | `(snapshot: LayoutSnapshot) => void` | Notificação disparada quando o cálculo de paginação atinge estabilidade. |
| `onError` | `(incident: DocumentEditorIncident) => void` | Tratador para incidentes operacionais da composição. |

### Presets de Dimensões de Página (`layout.page`)

As dimensões são informadas em **CSS pixels** (96 DPI):

```ts
// Preset Carta / Letter (Padrão da biblioteca: 8.5" x 11")
const letterLayout = {
  width: 816,
  height: 1056,
  marginTop: 96,
  marginRight: 96,
  marginBottom: 96,
  marginLeft: 96,
  pageGap: 20,
};

// Preset A4 (210mm x 297mm ≈ 794px x 1123px)
const a4Layout = {
  width: 794,
  height: 1123,
  marginTop: 96,
  marginRight: 96,
  marginBottom: 96,
  marginLeft: 96,
  pageGap: 24,
};
```

### Personalização Visual via CSS

A Presentation expõe variáveis CSS para customizar a aparência das folhas sem afetar os retângulos físicos:

```css
:root {
  --document-editor-page-background: #ffffff;
  --document-editor-page-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  --document-editor-page-border-color: #e2e8f0;
}
```

---

## Fluxos de Consumo

1. **Composição Coordenada (Recomendado):** A factory `createDocumentEditor` coordena a montagem inicial, a atualização da altura do wrapper conforme os snapshots, a apresentação e o descarte. Não observa automaticamente mudanças externas de dimensões ou CSS.
2. **Composição Manual (Avançado):** A aplicação instancia o `Editor` com `PaginationExtension` e conecta manualmente os snapshots a `createDocumentPresentation`. Indicado para quem precisa de controle customizado de renderização e layouts especiais.
3. **Módulos Isolados:** É possível utilizar apenas o **Core** (cálculo de quebras e decorações) ou apenas a **Presentation** (visualização de snapshots gerados externamente).

Consulte o [Quick Start Completo](docs/quick-start.md) para o guia passo a passo da Composição Manual e dos fluxos isolados.

---

## Limitações Essenciais

- **Reatividade Documental:** O recálculo de quebras é agendado automaticamente por alterações estruturais ou de texto segundo a igualdade `Node.eq` do ProseMirror. Alterações externas de CSS ou fontes após a montagem inicial não possuem observadores automáticos.
- **Estabilidade e Orçamento de Recuperação:** Invalidações documentais concorrentes durante a publicação (por exemplo via `appendTransaction`) acionam recuperação controlada limitada a três invalidações na mesma tentativa; após esgotamento, `whenLayoutStable()` não reinicia automaticamente o cálculo e os aguardantes podem permanecer pendentes até uma alteração externa legítima. Veja [API](docs/api.md#snapshots-e-estabilidade).
- **Fontes e Recursos Assíncronos:** O cálculo afere métricas no DOM. Recomenda-se que fontes personalizadas estejam carregadas (`document.fonts.ready`) antes da inicialização para evitar quebras em posições desatualizadas.
- **Tabelas:** Linhas de tabelas que excedem a altura útil da página ou certos arranjos complexos com `rowspan` podem emitir diagnósticos de bloqueio (`TABLE_INTRAROW_UNSUPPORTED`), pois não há quebra arbitrária dentro de uma mesma linha/célula.
- **Imagens e Blocos Indivisíveis:** Elementos de bloco com altura maior que a altura útil nominal não são fragmentados automaticamente.
- **Zoom do Navegador:** Transformações de escala CSS arbitrárias aplicadas externamente não são normalizadas automaticamente pelo motor de cálculo.

Consulte o documento de [Limitações Técnicas](docs/limitations.md) e a [Referência de API](docs/api.md) para a especificação exaustiva.

---

## Documentação Completa

- [Guia Rápido (Quick Start)](docs/quick-start.md) — Passo a passo detalhado, receitas Vite e Composição Manual.
- [Referência de API](docs/api.md) — Contratos públicos, ciclo de vida, normalização e incidentes.
- [Arquitetura](docs/architecture.md) — Modelo matemático de capacidade estrita (Bloco B) e neutralizadores.
- [Limitações Técnicas](docs/limitations.md) — Comportamentos observados, tabelas e restrições.
- [Desenvolvimento](docs/development.md) — Instruções para testes unitários, build e manutenção.
- [Demonstração Interativa](examples/live-demo/NOTES.md) — Exemplo interativo executável localmente via Vite.
- [Proveniência e Histórico](docs/provenance.md) — Registro canônico de marcos e integridade Git.

---

## Licença

[MIT](LICENSE), Copyright (c) 2026 Jhonny B. Castro.
