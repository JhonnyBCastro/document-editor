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

- **Branch canônica permanente:** `main` (commit de referência `c7b5497cc58bbddbf6966f69d0409040bb3d468d`).
- **Versão do manifesto:** `0.1.0-rc.4`. Esta declaração identifica os metadados do pacote local, mas não comprova publicação no registro público npm do estado atual da `main`.
- **Instalação validada:** Para consumir o estado canônico homologado da biblioteca, gere o pacote a partir da raiz do repositório:
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

---

## Principais Configurações

### Opções da Factory (`DocumentEditorOptions`)

| Propriedade | Tipo | Descrição |
|---|---|---|
| `host` | `HTMLElement` (obrigatório) | Elemento DOM que conterá as camadas de edição e apresentação. |
| `content` | `Content` (opcional) | Conteúdo inicial (HTML ou JSON do ProseMirror). |
| `extensions` | `Extensions` (opcional) | Extensões do Tiptap (ex.: `StarterKit`). Não incluir paginação aqui. |
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
  --document-editor-page-border: 1px solid #e2e8f0;
}
```

---

## Fluxos de Consumo

1. **Composição Coordenada (Recomendado):** A factory `createDocumentEditor` coordena criação, redimensionamento de container, apresentação e descarte.
2. **Composição Manual (Avançado):** A aplicação instancia o `Editor` com `PaginationExtension` e conecta manualmente os snapshots a `createDocumentPresentation`. Indicado para quem precisa de controle customizado de renderização e layouts especiais.
3. **Módulos Isolados:** É possível utilizar apenas o **Core** (cálculo de quebras e decorações) ou apenas a **Presentation** (visualização de snapshots gerados externamente).

Consulte o [Quick Start Completo](docs/quick-start.md) para o guia passo a passo da Composição Manual e dos fluxos isolados.

---

## Limitações Essenciais

- **Reatividade Documental:** O recálculo de quebras é agendado automaticamente por alterações estruturais ou de texto segundo a igualdade `Node.eq` do ProseMirror. Alterações externas de CSS ou fontes após a montagem inicial não possuem observadores automáticos.
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
