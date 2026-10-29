# Proveniência

## Corte posterior — Composição Coordenada V1

A implementação, a revisão independente e a homologação técnica da Composição Coordenada V1 foram concluídas no escopo autorizado e nos ambientes verificados, conforme a decisão do responsável pelo projeto e o parecer conclusivo já registrados. Este texto referencia esse fechamento; não cria nova decisão de homologação nem amplia seu alcance.

O responsável pelo projeto declarou ter realizado o commit e enviado as alterações ao GitHub para preservar o estado do código. Não foram informados aqui hash, branch ou data dessa operação, nem houve confirmação independente do conteúdo remoto nesta análise documental. O envio não equivale a release, publicação npm ou autorização para essas ações.

A leitura local de documentação, implementação, tipos e manifesto não comprova identidade com o remoto ou com qualquer tarball. As referências de commits e distribuição abaixo pertencem aos respectivos cortes históricos; não são tratadas como HEAD atual nem recebem retroativamente a Composição Coordenada V1.

O [registro de aprovações](https://app.notion.com/p/40701a4f21f68173a384e3502bbb6b57) e a [investigação de composição](https://app.notion.com/p/40501a4f21f681359935df0f1d95e42c) mantêm as decisões e revisões de origem, sujeitos ao acesso ao workspace. A separação entre resultados reproduzidos na revisão conclusiva, rodadas anteriores e relatos do construtor está em [desenvolvimento](development.md#composição-coordenada-v1--evidências-por-procedência). Nenhum comando de teste ou build foi repetido para produzir esta atualização documental; não se afirma preservação remota de arquivos temporários locais.

## Validação do consumidor V1 — encerramento de 29/10/2026

A validação independente do consumidor foi formalmente encerrada pelo responsável pelo projeto, com ressalvas, no escopo autorizado e nos ambientes verificados, após o parecer conclusivo da Frente A sobre a Rodada 3. Esse encerramento é distinto da homologação técnica anterior da biblioteca e não constitui nova homologação, release ou publicação npm.

O laboratório usou o tarball `jhonny_bcastro-document-editor-0.1.0-rc.4.tgz`, SHA-256 `ce99cf63c920d889048806d30b238101281f255889d0cab86845fec7374c715f`. Ele não deve ser confundido com o artefato histórico de hash `fa869168a25bd9c6266188a1075fe714d2db15c3fa5fdf964ec35584e37dee14` citado na receita manual. A versão `0.1.0-rc.4`, isoladamente, não identifica esses bytes.

Os registros de origem são o [encerramento definitivo](https://drive.google.com/file/d/1xaWpOYhO64jIo2PZXlsKsPs1Q-RNJt_U/view), SHA-256 `4f0a28e43478c62819b444c706c30a7a823bf54959a59b85d99a4d798508ca35`, e o [parecer independente da Rodada 3](https://drive.google.com/file/d/1oV_aovKdVbfJ42YPwjwc4zmh_SqPNnZy/view), SHA-256 `b5c2f8ccaa5b3b696cd2e341213128a23824ebc46f15abe5006ba877cd2b7ca8`. O [backup das evidências](https://drive.google.com/drive/folders/11KQASZhYEyQkql3Y7dww5bOzkGE2zlR1) preserva os relatórios e resultados anteriores; esses links podem exigir permissão e não são dependências de runtime.

O parecer combina resultados anteriores preservados, inspeção dos verificadores e artefatos e recálculo independente da geometria. TypeScript e build do consumidor são sustentados pelos logs contemporâneos do executor, não por nova execução da Frente A. Os detalhes de ambiente e alcance estão em [desenvolvimento](development.md#validação-do-consumidor-v1--29-de-outubro-de-2026) e [limitações](limitations.md#consumidor-v1--alcance-do-encerramento-de-29102026).

O fechamento do laboratório não comprova a execução literal dos exemplos propostos do README/Quick Start nem uma matriz universal de compatibilidade. A divergência de metadados `rc.4` no manifesto de origem e `rc.2` no lockfile permanece registrada, sem alteração desses arquivos por esta atualização.

## Linha e distribuição — corte histórico de 22/10/2026

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
