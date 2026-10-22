# Proveniência

## Linha atual e distribuição

Referência documental: `dev/cons014-composed-20261022`, commit `1962cdbb3456cc989b064017137d48a8df143d3d`. A branch foi enviada ao remoto e sua presença foi confirmada pelo usuário no GitHub em 22/10/2026. Isso não constitui publicação de pacote, merge ou homologação geral.

O manifesto declara `@jhonny_bcastro/document-editor` e `0.1.0-rc.4`. A declaração permanece no arquivo; o código desta linha não é identificado como os bytes do tarball RC.4 histórico. Não se anuncia uma nova versão nem se presume publicação npm do estado atual. A licença permanece [MIT](../LICENSE).

## CONS-014 — preservação e reprodução, 22/10/2026

| Referência | OID | Alcance |
|---|---|---|
| Base canônica | `1680a5905bcf321fafa73af38534362e326f0cf8` | Base histórica anterior à preservação das alterações locais. |
| Checkpoint canônico | `2ae591a35e97add1d854cb78276688cebf2acf84` | Preservação das seis modificações rastreadas e três testes locais inventariados. |
| Snapshot experimental independente | `318da90db44eb7604ee13f320a2fdf58cdcc8629` | Commit-raiz em repositório separado; não inventa ancestralidade Git para a cópia física. |
| Reprodução experimental | `835f75df0693a1807f39cfc003081b0fd2f36442` | Descendente do checkpoint canônico; reprodução do conjunto inventariado. |
| Desenvolvimento composed | `1962cdbb3456cc989b064017137d48a8df143d3d` | Descendente da reprodução, com adaptação focal de cinco arquivos da Live Demo. |

A matriz de reprodução registrou 133 caminhos: 11 adicionados, 16 substituídos, 66 preservados literalmente, um `.gitignore` adaptado e 39 excluídos apenas na reprodução. A árvore candidata contém 94 arquivos; a diferença intencional de `.gitignore` permite fixtures PNG. Arquivos excluídos da candidata permanecem recuperáveis no checkpoint, sem exigir restauração dos consumidores antigos.

O snapshot experimental é uma fonte identificada, não selo de correção integral. A linha de desenvolvimento mantém parentesco com o checkpoint canônico; isso não atribui histórico próprio comprovado à cópia experimental.

## Evidências e alcance

Os relatórios CONS-014 registraram 118 testes em 11 arquivos, builds Core/Presentation e execução headless delimitada. No checker, `freshLayoutRound: true` coexistiu com `idempotent: false` e violações geométricas. O usuário relatou sessão manual favorável, sem homologação geral. A suíte focal C-05 pertence a outro workspace e não foi incorporada por presunção a esta evidência.

Os dossiês completos de preservação, reprodução e validação permanecem externos ao repositório, nas sessões `session-20261022T210900Z_a7f3d2e1` e `session-20261022T172500Z_e83b1a4f`. Não foram importados logs, capturas ou backups para completar artificialmente o arquivo público. Essas referências permitem identificar os registros de origem, mas não prometem disponibilidade pública dos artefatos.

A revisão final confirmou o índice e os nove arquivos locais originais contra as referências anteriores, além da branch criada no repositório canônico. As ressalvas do Checkpoint 0 e da Fase 1 permanecem; não se converte preservação observada em prova de ausência global de escritas concorrentes.

Veja [história](project-history.md), [limitações](limitations.md) e [arquivo](archive/README.md).

---

## Registro anterior preservado

O texto abaixo conserva o corte da consolidação anterior. Expressões como “vigente”, “não publicada” e “sem commit” pertencem àquela etapa, não ao estado atual da branch. Apenas o destino do link ao arquivo histórico foi atualizado.

### Proveniência do produto — corte anterior

### Origem histórica

Extração document-editor a partir do laboratório editor-lab@0.2.2 em02/10/2026, referência histórica ec1c69765648e12b6ce224fb5ef19e4b3210803d. ExperimentosEXP e registros permanecem no laboratório/arquivo; não são dependências de runtime. ADR-001/002/003 e releases locais conservam seus textos/datas/alcances.

### Consolidação canônicaA —12/10/2026

Linha-base fix/reopen-002-f2-r4, HEAD83389999102626309dcb90ff8e8a1d38d3f05a4e, pai8a8f3ef45df1cc6e21bd491ad3a482cd155ef3f8. O relatório GATE-VANILLA-PARTIAL-RUN-001 exclusivo dessa linha permanece preservado. A presença de d6918c noutra branch não significava incorporação; a consolidação aplica deltas de produto sem cherry-pick/merge/commit.

| Commit de origem | Pai | Arquivos/regiões pertinentes |
|---|---|---|
| d6918c1233030667f3c8aae3ccf2e41f3787babb | 8a8f3ef45df1cc6e21bd491ad3a482cd155ef3f8 | controller.scheduleRender e novo core-stability.spec.ts |
| a25e69182a42ee5344fc297c796a8ff43a6d51ba | d6918c1233030667f3c8aae3ccf2e41f3787babb | controller/decorations/extension/types e paint-mode.spec.ts: seleção de pintura |
| d6770323018bd460e557b4c2bfb4fd4e4b997e84 | a25e69182a42ee5344fc297c796a8ff43a6d51ba | decorations/types e paint-mode.spec.ts: arestas geométricasB1 e regressões |

Quatro fontes e dois testes correspondem às fontes finaisB1 aprovadas no escopo. Outros src, configs, package-lock, exports/peers/versão e históricos permanecem fora dessa integração. Package altera somente scripts.test; documentos vivos refletem estado vigente, sem importar governança inteira.

### Alcance das evidências

B1 teve aceite unitário/técnico delimitado: tentativa inicial de testes falhou por normalizaçãoJSDOM e a correção no teste foi registrada. Ensaios históricos não são resultados próprios da canônica consolidada. Campanha004 satisfez paresL/T delimitados, manteve diferençasS/saída3 e revisão visual separada; não homologação. DV2 teve interrupção de supervisão e vídeo complementar, sem causa/correção geral demonstrada.

Autorizações, patches, recuperação e capturas desta consolidação ficam no dossiê externo identificado como CANONICAL-CONSOLIDATION-A-001, sob revisãoFrenteA e autoridadeBoby. Este índice fornece identificadores portáteis, não caminhos de máquina para consumo do produto. Não houve nova publicação nem transferência de selo/PASS histórico. Ver [índice da consolidação](archive/consolidation/CANONICAL-CONSOLIDATION-001.md).
