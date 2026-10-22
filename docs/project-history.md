# História do projeto

Síntese retrospectiva organizada em 22/10/2026. Separa decisões e resultados históricos da implementação atual; não constitui reexecução dos experimentos nem certificação de suas alegações.

## Do laboratório à biblioteca

A recuperação documental da Frente B identificou a série EXP-001–038 no laboratório pré-Core: 38 identificadores, 36 relatórios individuais e dois ausentes (EXP-029 e EXP-037), além de 28 entradas HTML. Não há evidência de 38 execuções independentes integralmente verificadas. Variantes, fixtures e repetições não ampliam essa contagem.

| Fase | Contribuição histórica e limite |
|---|---|
| EXP-001–006 | Editor, superfície de página e medição; exploração de widgets e interferência das decorações na geometria. Ainda não era paginação completa. |
| EXP-007–016 — Rota A | Páginas e fragmentos no schema, split/merge e reflow. Custos de wrappers, interação e serialização motivaram abandonar essa representação; não significa impossibilidade geral de seleção no ProseMirror. |
| EXP-017–020 — Rota B | Documento contínuo e decorações, com neutralização de deslocamentos e políticas. Ghost DOM e remoção transitória de widgets foram alternativas abandonadas no percurso. |
| EXP-021–028 | Fronteiras tabulares, TableMap e políticas de corte; fragmentação intralinha com células paralelas mostrou limites. Persistência permaneceu separada dos metadados visuais. |
| EXP-029–033 | Running content, projeção, modularização e impressão. Há lacunas de relatório e diferenças entre logs; não se afirma fidelidade universal ou regressão exatamente idêntica. |
| EXP-034–038 | Distribuição e consumidores, quebra manual e integração piloto institucional. Não homologam a linha atual; resultados de edição/rollback e equivalência semântica são incompletos em parte dos registros. |

Na recuperação, EXP-037 tem relatório ausente e resultado preservado de 9 PASS/1 FAIL, diferente do 10/10 alegado no índice. O laboratório também usa `DEC-007` para decisões diferentes: qualquer citação deve incluir título e documento de origem.

Essas informações provêm da síntese documental da Frente B fornecida ao projeto nesta revisão. As fontes originais estão em `editor-lab-pre-core`, sobretudo o índice `docs/experiments.md` e relatórios `docs/experiments/EXP-*.md`; não fazem parte deste repositório público. Datas ausentes, disponibilidade de imagens/PDFs e vínculos de execução não foram reconstruídos. Esta síntese não reavaliou os artefatos visuais.

## Extração e independência

A extração para `document-editor` é registrada no [ADR-001](decisions/ADR-001-project-consolidation.md). O [ADR-002](decisions/ADR-002-product-independence.md) preserva a independência de domínio: aplicações cuidam de autenticação, persistência e integração com backend. OpenPDF e homologações institucionais são recortes próprios, não requisitos do Core.

A remoção de `PersistedDocument` e a configuração do nome do nó manual estão nos registros [CONS-006](archive/consolidation/CONS-006.md) e [CONS-007](archive/consolidation/CONS-007.md).

## Geometria, tabelas e Presentation

As [investigações REOPEN](archive/README.md) registram tentativas de espaçadores tabulares, falhas de seleção/clipboard e a evolução para associação às linhas semânticas. Não devem ser resumidas como uma sequência de êxitos sem as alternativas descartadas.

O [ADR-003](decisions/ADR-003-host-dom-ownership.md) documenta ownership do antigo ChromeLayer. O Reference Lab RC.4 e campanhas posteriores ajudaram a separar edição, geometria e apresentação. São consumidores e registros históricos; não exigem adaptar a biblioteca atual a seus contratos antigos. Campanhas parciais e interrupções mantêm seu alcance, sem transferência de aprovação.

## Composed-only e CONS-014

O [dossiê CONS-013](archive/consolidation/CONS-013-COMPOSED-CONSOLIDATION-HANDOFF.md), datado de 21/10/2026, apresenta a proposta experimental composed-only. Sua adoção na linha consolidada é descrita pelo [ADR-004 retrospectivo](decisions/ADR-004-composed-only.md), sem atribuir ao ADR uma aprovação contemporânea inexistente.

Em 22/10/2026, CONS-014 preservou o estado canônico, registrou snapshot experimental independente, criou a reprodução e adaptou a Live Demo aos contratos disponíveis. A [proveniência](provenance.md) identifica os commits e a separação entre fonte, manifesto e pacote histórico.

A candidata teve resultados unitários e builds favoráveis, checker com ressalvas e avaliação manual favorável em cenários delimitados. Idempotência negativa, violações geométricas, HTTP 404 e cenários tabulares indisponíveis continuam registrados nas [limitações](limitations.md). Não são eliminados pelos experimentos antigos.
