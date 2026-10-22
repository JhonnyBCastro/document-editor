# document-editor

Biblioteca de paginação visual de documentos contínuos para Tiptap/ProseMirror. As quebras automáticas são decorações transitórias: não transformam o documento semântico em uma coleção de páginas persistidas.

## Estado do projeto

Linha de desenvolvimento: `dev/cons014-composed-20261022`. A referência desta organização documental é o commit `1962cdbb3456cc989b064017137d48a8df143d3d`, anterior às edições documentais aqui descritas.

O nome declarado é `@jhonny_bcastro/document-editor`. O manifesto ainda contém `0.1.0-rc.4`; essa declaração não torna o código desta branch equivalente ao pacote RC.4 histórico. Não há anúncio de nova versão nem comprovação de publicação npm do estado atual. Veja [proveniência](docs/provenance.md).

## Core e Presentation

- **Core:** mede o DOM, calcula quebras, publica decorações e fornece snapshots de layout.
- **Presentation:** desenha folhas, cabeçalhos e rodapés a partir desses snapshots; não cria o editor nem calcula as quebras.
- **Consumidor:** fornece schema Tiptap, conteúdo, DOM, UI, montagem e descarte das duas camadas.

O único modo suportado é `composed`, também usado quando `visualMode` é omitido. Valores diferentes são rejeitados com `TypeError`. O contrato antigo `chromeLayerElement` e a camada ChromeLayer foram removidos. A decisão está registrada retrospectivamente no [ADR-004](docs/decisions/ADR-004-composed-only.md).

## Entradas declaradas do pacote

As entradas abaixo descrevem o contrato de distribuição do manifesto, não uma instrução para instalar um pacote atual já publicado:

```ts
import { PaginationExtension, whenLayoutStable, preparePrintSession } from '@jhonny_bcastro/document-editor';
import type { LayoutSnapshot, PaginationVisualMode } from '@jhonny_bcastro/document-editor';
import '@jhonny_bcastro/document-editor/style.css';

import { createDocumentPresentation } from '@jhonny_bcastro/document-editor/presentation';
import '@jhonny_bcastro/document-editor/presentation.css';
```

A [API](docs/api.md) detalha opções e responsabilidades. Para trabalhar a partir da fonte, consulte [desenvolvimento](docs/development.md). A instalação limpa e o consumo externo de uma nova distribuição não foram certificados por esta revisão documental.

## Exemplo atual

A [Live Demo](examples/live-demo/NOTES.md) monta um editor com Presentation consumindo diretamente `src/`. É um consumidor de desenvolvimento, não uma prova de instalação do pacote distribuído.

A Demo está delimitada a texto linear, títulos e edição. Os cenários tabulares `PE-S`, `PE-M` e `PE-L` estão indisponíveis. Os antigos consumidores e comparações RC.4 pertencem ao [arquivo histórico](docs/archive/README.md), sem necessidade de restaurá-los.

## Evidências e limitações

O ciclo CONS-014 registrou 118 testes unitários aprovados em 11 arquivos e builds Core/Presentation concluídos. A sessão manual foi favorável nos cenários exercitados, incluindo documentos extensos, com lentidão em centenas de páginas. São observações delimitadas, não homologação geral.

Permanecem:

- `idempotent: false` nos três cenários automatizados; `freshLayoutRound: true` apenas registra uma nova rodada de layout.
- Violações geométricas reportadas pelo checker e um HTTP 404 de origem não identificada.
- Reatividade por tamanho/estrutura e sinal de configuração; alterações de texto, marcas ou atributos com tamanho constante não têm detecção geral garantida pelo predicado atual.
- Limites de impressão composta, multi-instância e compatibilidade de dependências; ausência de certificação universal de navegadores ou Tiptap 2/3.

Leia [limitações](docs/limitations.md) antes de adotar a biblioteca. Resultados históricos de tabelas ou distribuições anteriores não validam automaticamente esta branch.

## Documentação

- [API](docs/api.md) e [arquitetura](docs/architecture.md).
- [Desenvolvimento e comandos](docs/development.md) e [Live Demo](examples/live-demo/NOTES.md).
- [Limitações](docs/limitations.md) e [backlog](docs/backlog.md).
- [Proveniência](docs/provenance.md), [história do projeto](docs/project-history.md) e [arquivo histórico](docs/archive/README.md).
- Decisões: [extração](docs/decisions/ADR-001-project-consolidation.md), [independência](docs/decisions/ADR-002-product-independence.md), [ownership histórico](docs/decisions/ADR-003-host-dom-ownership.md) e [composed-only](docs/decisions/ADR-004-composed-only.md).

## Licença

[MIT](LICENSE), Copyright (c) 2026 Jhonny B. Castro.
