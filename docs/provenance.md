# Proveniência do produto

## Origem histórica

Extração document-editor a partir do laboratório editor-lab@0.2.2 em02/10/2026, referência histórica ec1c69765648e12b6ce224fb5ef19e4b3210803d. ExperimentosEXP e registros permanecem no laboratório/arquivo; não são dependências de runtime. ADR-001/002/003 e releases locais conservam seus textos/datas/alcances.

## Consolidação canônicaA —12/10/2026

Linha-base fix/reopen-002-f2-r4, HEAD83389999102626309dcb90ff8e8a1d38d3f05a4e, pai8a8f3ef45df1cc6e21bd491ad3a482cd155ef3f8. O relatório GATE-VANILLA-PARTIAL-RUN-001 exclusivo dessa linha permanece preservado. A presença de d6918c noutra branch não significava incorporação; a consolidação aplica deltas de produto sem cherry-pick/merge/commit.

| Commit de origem | Pai | Arquivos/regiões pertinentes |
|---|---|---|
| d6918c1233030667f3c8aae3ccf2e41f3787babb | 8a8f3ef45df1cc6e21bd491ad3a482cd155ef3f8 | controller.scheduleRender e novo core-stability.spec.ts |
| a25e69182a42ee5344fc297c796a8ff43a6d51ba | d6918c1233030667f3c8aae3ccf2e41f3787babb | controller/decorations/extension/types e paint-mode.spec.ts: seleção de pintura |
| d6770323018bd460e557b4c2bfb4fd4e4b997e84 | a25e69182a42ee5344fc297c796a8ff43a6d51ba | decorations/types e paint-mode.spec.ts: arestas geométricasB1 e regressões |

Quatro fontes e dois testes correspondem às fontes finaisB1 aprovadas no escopo. Outros src, configs, package-lock, exports/peers/versão e históricos permanecem fora dessa integração. Package altera somente scripts.test; documentos vivos refletem estado vigente, sem importar governança inteira.

## Alcance das evidências

B1 teve aceite unitário/técnico delimitado: tentativa inicial de testes falhou por normalizaçãoJSDOM e a correção no teste foi registrada. Ensaios históricos não são resultados próprios da canônica consolidada. Campanha004 satisfez paresL/T delimitados, manteve diferençasS/saída3 e revisão visual separada; não homologação. DV2 teve interrupção de supervisão e vídeo complementar, sem causa/correção geral demonstrada.

Autorizações, patches, recuperação e capturas desta consolidação ficam no dossiê externo identificado como CANONICAL-CONSOLIDATION-A-001, sob revisãoFrenteA e autoridadeBoby. Este índice fornece identificadores portáteis, não caminhos de máquina para consumo do produto. Não houve nova publicação nem transferência de selo/PASS histórico. Ver [índice da consolidação](consolidation/CANONICAL-CONSOLIDATION-001.md).
