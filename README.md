# document-editor

Biblioteca de paginação visual de documento contínuo para Tiptap/ProseMirror. O JSON semântico permanece separado das quebras visuais. Core e Presentation são entradas independentes.

## Identidade e distribuição

Nome: `@jhonny_bcastro/document-editor`. Versão declarada: **0.1.0-rc.4**. A working tree incorpora os deltas de estabilidade, seleção de pintura e B1 descritos em [proveniência](docs/provenance.md); não representa uma nova publicação, RC.5 ou homologação.

Os tarballs RC.2/3/4 existentes são distribuições históricas locais; seus bytes não são uma emissão da working tree consolidada. O estado remoto/npm atual não foi consultado nesta consolidação. Instale um artefato identificado pela sua distribuição e use um conjunto compatível de Tiptap/PM; não copie `node_modules` de consumidores experimentais. A declaração de peers aceita majors 2/3; os ensaios de referência não certificam todas as versões ou singleton global.

## Entradas públicas

```ts
import { PaginationExtension, whenLayoutStable, preparePrintSession } from '@jhonny_bcastro/document-editor';
import type { LayoutSnapshot, PaginationVisualMode } from '@jhonny_bcastro/document-editor';
import '@jhonny_bcastro/document-editor/style.css';

import { createDocumentPresentation } from '@jhonny_bcastro/document-editor/presentation';
import '@jhonny_bcastro/document-editor/presentation.css';
```

Core oferece extensão, snapshots e preparação de impressão. Presentation consome snapshots para pintar superfícies/header/footer; não cria Editor nem schema. O consumidor fornece schema, conteúdo, DOM, UI e coordenação de montagem. Detalhes em [API](docs/api.md) e [arquitetura](docs/architecture.md).

## Seleção de pintura

`PaginationExtension.configure({ visualMode: 'legacy' })` preserva o comportamento legado. Omissão equivale a `legacy`. `visualMode: 'composed'` é opt-in e fixo durante a instância: Core deixa de produzir pintura documental/chrome legado, conserva geometria e estilos do consumidor e mantém as arestas decorativas B1 de 1px solid transparent. Valor inválido ou `chromeLayerElement` definido no composto é rejeitado sem fallback.

Composto sozinho não monta um documento pronto: factory/bridge oficial, insets automáticos, atualização suportada e impressão composta permanecem pendentes. Não mude opções de uma instância esperando troca de modo; crie outra instância respeitando o lifecycle.

## Exemplos existentes

- `examples/vanilla-consumer`: editor/schema/PageBreak, modo legado, dependência no tarball **RC.4 histórico**, Tiptap2.27.3. Não é exemplo ligado automaticamente ao código consolidado.
- `examples/presentation-consumer`: renderização de **snapshot sintético**, sem editor integrado. Importa o pacote, mas seu manifesto não declara a dependência local instalada: reprodução autônoma permanece pendente.
- `examples/vanilla-consumer.bak`: histórico Tiptap3/file:root; package/lock diferem do exemplo ativo. Não usar como fallback de instalação.

As árvores/tarballs foram preservados. Não existe nesta entrega comando de lançamento composto oficial ou sessão browser aprovada.

## Verificações separadas

| Comando | Alcance/pré-requisito |
|---|---|
| `npm test` | Agora executa **somente** `npm run test:unit`; deixou de encadear E2E/browser. |
| `npm run test:unit` | Vitest/JSDOM, regressões unitárias; não comprova geometria/pintura reais. |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | Tipos Core no ambiente instalado. |
| `node node_modules/typescript/bin/tsc --noEmit --emitDeclarationOnly false -p tsconfig.presentation.json` | Tipos Presentation, sem emissão. |
| `npm run build` | Build técnico Vite Core + Presentation; separado de testes e distribuição. |
| `npm run test:e2e` | Runner histórico de stress com Puppeteer, fixtures e servidor consumidor próprio em8543; requer decisão/ambiente browser separados. |

Não execute os runners `run*.sh` para preparar ambiente: contêm paths locais e encerramento por porta. O E2E histórico grava resultados na raiz e mede diferença de comprimento JSON, não igualdade semântica completa; catch pode não propagar falha. Esses limites não foram alterados para obter aprovação. Comandos de build/servidor/browser/instalação não foram executados por esta consolidação.

## Estado e limites

Compatibilidade histórica em Tiptap2.27.3/3.31.3 é delimitada, não garantia universal. Atualização por edição de mesmo tamanho, fontes/scroll, multi-instância, impressão composta, integração oficial e uso visual arbitrário permanecem com limites. Gate Vanilla não homologado. Pendências experimentais e anomalias de Presentation não foram corrigidas pela organização do código.

Leia [limitações](docs/limitations.md), [backlog](docs/backlog.md) e o [índice de consolidação](docs/consolidation/CANONICAL-CONSOLIDATION-001.md). ADRs/releases preservam suas datas e alcances históricos. Licença MIT.
