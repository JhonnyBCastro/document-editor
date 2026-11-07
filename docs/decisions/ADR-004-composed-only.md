# ADR-004 — Composed-only

## Natureza, data e status

Registro retrospectivo redigido na organização documental de 22/10/2026, referente a uma decisão já adotada na linha de desenvolvimento. Não é um ADR escrito ou aprovado em 21/10/2026 e não cria uma nova aprovação funcional.

A origem documental é o [dossiê CONS-013](../archive/consolidation/CONS-013-COMPOSED-CONSOLIDATION-HANDOFF.md), datado de 21/10/2026, que apresentava a mudança como proposta experimental sujeita à revisão. A incorporação na linha consolidada ocorreu no fluxo CONS-014 de 22/10/2026, com reprodução em `835f75df0693a1807f39cfc003081b0fd2f36442` e adaptação da Demo em `1962cdbb3456cc989b064017137d48a8df143d3d`.

Os atos completos de autorização/revisão estão no dossiê externo CONS-014; não foram anexados a este repositório. Não se atribui uma data independente de aprovação ao texto novo deste ADR. O contrato descrito é constatável em [types.ts](../../src/types.ts), [extension.ts](../../src/extension.ts) e [controller.ts](../../src/controller.ts), na referência da [proveniência](../provenance.md).

## Contexto

A manutenção dos caminhos `legacy` e `composed` dividia responsabilidades visuais e preservava acoplamentos de montagem no Core. As observações históricas motivaram sua separação; não constituem prova de que todo problema geométrico era causado pelo modo legado.

O princípio de ownership do [ADR-003](ADR-003-host-dom-ownership.md) permanece relevante, mas seu mecanismo específico de ChromeLayer foi superado.

## Decisão existente registrada

- `PaginationVisualMode` admite somente `'composed'`; esse também é o default.
- O controller rejeita outros valores com `TypeError`, sem fallback para legado.
- Core calcula paginação, decorações estruturais e snapshots; Presentation desenha folhas e running content em host fornecido pelo consumidor.
- O contrato antigo `chromeLayerElement` e a camada ChromeLayer foram removidos. Não restaurar consumidores ou artefatos obsoletos como dependências ativas.
- O consumidor coordena schema, Editor, hosts, snapshots, insets e descarte. Não se introduz uma factory pública de composição por este registro.

## Consequências e limites

As entradas Core/Presentation são separadas e as arestas B1 transparentes preservam contribuição geométrica. Remover pintura legada não elimina os neutralizadores estruturais do DOM.

Esta decisão não aprova geometria geral, idempotência, impressão composta, multi-instância ou compatibilidade universal. A Demo atual está delimitada a conteúdo linear e títulos; indisponibilidade tabular é uma limitação do consumidor. As pendências do CONS-013 e a tarefa focal C-05 continuam independentes.

Veja [arquitetura](../architecture.md), [API](../api.md) e [limitações](../limitations.md). A licença [MIT](../../LICENSE) permanece inalterada; nenhuma nova versão ou publicação é criada por este ADR.
