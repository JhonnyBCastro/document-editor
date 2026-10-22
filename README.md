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

## Arquitetura oficial (`composed`) e descontinuação do `legacy`

A biblioteca adota o modo `composed` como sua arquitetura oficial e padrão. A omissão de `visualMode` equivale a `'composed'`:

- **Core limpo e sem poluição de DOM:** O Core calcula a paginação e injeta apenas as quebras estruturais e compensações geométricas de entrelinhas (com arestas decorativas transparentes B1 `1px solid transparent`). Não injeta camadas de chrome artificial (`.document-editor-chrome-layer`), fundos brancos `#fff` ou sombras sobre o editor do ProseMirror.
- **Camada de apresentação dedicada:** A renderização das páginas (folhas de papel, cabeçalhos e rodapés) é realizada de forma desacoplada pelo módulo `@jhonny_bcastro/document-editor/presentation` (`createDocumentPresentation`), que consome os snapshots e projeções geométricas emitidos pelo Core.
- **Descontinuação do `legacy`:** O modo `'legacy'` e a opção `chromeLayerElement` foram descontinuados e removidos do código executável e das definições de tipo (`PaginationVisualMode = 'composed'`). Iniciar instâncias com valores diferentes de `'composed'` (inclusive `'legacy'`) lança estritamente `TypeError` sem fallback silencioso. Consulte o dossiê [CONS-013](docs/consolidation/CONS-013-COMPOSED-CONSOLIDATION-HANDOFF.md) para o handoff completo.

## Exemplos existentes

- `examples/live-demo`: Demonstração operacional oficial da working tree, executando o editor integrado a `DocumentPresentation` em modo `composed` na porta 8544.
- `examples/vanilla-consumer`: Consumidor experimental antigo, dependente do tarball **RC.4 histórico** e modo legado na porta 8545. Preservado no disco nesta etapa para decisão posterior de limpeza pelo usuário.
- `examples/presentation-consumer`: Renderização de **snapshot sintético** via Presentation, sem editor ProseMirror integrado.
- `examples/vanilla-consumer.bak`: Backup histórico legado com Tiptap 3; mantido para referência técnica.

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
