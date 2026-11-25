# Proveniência

## Preparação da integração `Debug Overlay V1` (`DEBUG-OVERLAY-001`, 25/11/2026)

- **Base canônica adotada:** commit `2cb8e65c2b1a63e8aabf36f353cc49408af589a3` (tree `8014d92f47d75778e174574dec0a5d7d11eed003`) na branch `main` (após integração canônica da iniciativa `AUTO-CSS-C01 V1` via PR #24).
- **Linha experimental homologada (`R1`):** implementada e verificada em `ed-debug-overlay-v1-r1` (`candidate-debug-overlay-v1-r1-0.1.0-rc.4.tgz`, `120.816` bytes, `38` arquivos, SHA-256 `849cf238b066478dc553fa51bf74b9771e481d6598f50bf51caffff36beb6b6f`), sucedendo o marco experimental `R0` e acompanhada de seu acervo `R1`, complemento documental (`ED-DEBUG-OVERLAY-V1-R1-DOCUMENTARY-ADDENDUM-001.md`) e regularização probatória residual (`reconciliation-record.json`), homologada pelas decisões `D-OVL-20` a `D-OVL-24`.
- **Candidata de integração em preparação (`feat/debug-overlay-v1-ret`):** preparada localmente após as decisões `D-OVL-25` a `D-OVL-35`, incorporando os ajustes visuais `OVL-VIS-01` e `OVL-VIS-02` com fallback hierárquico e omissão controlada, bem como esta documentação canônica regularizada; encontra-se ainda em fase de preparação local e revisão pelas frentes, sem merge na `main` nem publicação no npm.

## Consolidação documental pós-F3 (PR #23) e preparação AUTO-CSS-C01 V1

- **Consolidação documental pós-F3 integrada em `main`:** a [Pull Request #23](https://github.com/JhonnyBCastro/document-editor/pull/23) foi integrada por squash em `main` no commit `fa199af49d0adabbd15d1a244b919451ff2a4d27` (tree `894f8badd5bd0cb83b3ad2f9c61deae582aad196`), sucessora do marco funcional pós-F3 `977f106c2fcf46771f46ae3a40813ddbc24f1297` (PR #22) e base canônica documental adotada na preparação de `24/11/2026`.
- **Experimentação controlada homologada (`AUTO-CSS-C01`):** sobre a base `fa199af49d0adabbd15d1a244b919451ff2a4d27`, a candidata `Modelo A` (`src/extension.ts` `+5/-0`, `src/style.css` `+11/-0`, `tests/unit/auto-css-c01.spec.ts`) foi submetida a campanha experimental de `24` pares em Tiptap `2.27.3` e `3.35.0` no `Chrome/154.0.8037.57`, registrada no relatório `ED-AUTO-CSS-C01-EXPERIMENT-REPORT-001.md` (SHA-256 `a8c1989aaba26340ea7affe7d3b5630a46716b97e0c8b0d9cfe4336be957cc6f`) e complementada por `ED-AUTO-CSS-C01-EXPERIMENT-ADDENDUM-001.md` (SHA-256 `0ee8972004d407fb7177b517e03f8a0cb2b3549b0126b691ba3ab824f49cf2a6`). Tarballs comparados no experimento: referência **`reference-post-f3-0.1.0-rc.4.tgz`** (`108.184` B, `35` arquivos, SHA-256 `fd99696cd6fbfbb02fc08d8dcd217a56db0cedaadc5a93ac97cecfc768057ea4`) e candidata experimental **`candidate-auto-css-c01-0.1.0-rc.4.tgz`** (`108.328` B, `35` arquivos, SHA-256 `c13368bd60dcf453098714d6f7701936313a097d5c75ac1754ebb0e47383d050`).
- **Decisões originais `D-01` a `D-04` e precisões `AD-CSS-01` a `AD-CSS-09`:** após revisões independentes das Frentes A e B e homologação pelo Autor, vigoram com seus sentidos originais preservados:
  - **`D-01`:** aceitação delimitada da limitação de isolamento CSS em editores externos fisicamente aninhados na raiz de um editor paginado para a primeira versão (`V1`), sem certificação de isolamento completo nem renúncia a evolução futura.
  - **`D-02`:** direção arquitetural para CSS C-01 nativo (`Modelo A`: marcador em `PaginationExtension`, reuso de `@jhonny_bcastro/document-editor/style.css`, importação explícita pelo consumidor, personalização por cascata CSS, ausência inicial de opção pública de desativação e preservação de Compose e Core manual).
  - **`D-03`:** realização do complemento documental independente (`ED-AUTO-CSS-C01-EXPERIMENT-ADDENDUM-001.md`), preservando integralmente o relatório e o acervo experimental originais.
  - **`D-04`:** dispensa de rodada corretiva experimental, novos ensaios e reconstrução da candidata naquela etapa complementar, preservando as delimitações `AD-CSS-01` a `AD-CSS-09` (`Range.getClientRects()` restrito à borda direita `> 0,001 px` com `charOverflow: null`/`N/A` em `erro-1`, leitura `getBoundingClientRect()` não instrumentada antes de `coordsAtPos()`, impressão focal em `erro-1` adaptado de `10` páginas em T2, rollback de inicialização efetivamente ensaiado com `hostChildrenAfterRollback: 0`, `orphanPaginatedElements: 0` e `cleanupStatus: "unconfirmed"`, e consolidação de `345 -> 339` nós inline na remoção de `link` em T2 preservando `146` parágrafos e `12.992` caracteres).
- **Registro da preparação local (`24/11/2026`):** mediante autorização específica posterior de preparação da integração canônica (distinta de `D-03` e `D-04`) e correção documental focal `R1`, o código homologado, o teste focal e esta documentação ativa foram consolidados na branch isolada `prep/auto-css-c01-v1` sobre a base canônica documental `fa199af49d0adabbd15d1a244b919451ff2a4d27`. Na preparação local de `24/11/2026` sobre essa base, a candidata encontrava-se pendente de revisão e integração; esse registro descreve aquele corte histórico e não estabelece o estado remoto de versões posteriores nem comprova publicação no registro npm.

## Manutenção pós-F3 — Issue #15, PR #19 e Candidata T1-R2 / PR #22

Após o encerramento técnico-prático da iniciativa F3 e a consolidação documental R2 (via [Pull Request #20](https://github.com/JhonnyBCastro/document-editor/pull/20)), o ciclo de manutenção pós-F3 incorporou três marcos distintos à branch canônica `main`:

- **Remediação da Issue #15 via [Pull Request #21](https://github.com/JhonnyBCastro/document-editor/pull/21):** commit [`88aa3393a961d9c55318172fbedb993c4664810f`](https://github.com/JhonnyBCastro/document-editor/commit/88aa3393a961d9c55318172fbedb993c4664810f) — migração para `vite-plugin-dts` `^5.1.2` (`unplugin-dts` `1.1.2`), remoção de `minimatch` e `@microsoft/api-extractor` do lockfile de desenvolvimento e ampliação de `test:types:public` para `.`, `./presentation` e `./compose`; [Issue #15](https://github.com/JhonnyBCastro/document-editor/issues/15) encerrada como `completed`.
- **Atualização do Vitest via [Pull Request #19](https://github.com/JhonnyBCastro/document-editor/pull/19):** commit [`1f689059639a3160b4fe0fd6afb440bc8d48db25`](https://github.com/JhonnyBCastro/document-editor/commit/1f689059639a3160b4fe0fd6afb440bc8d48db25) (`HEAD^{tree}: 4948ede6b8746f050894b856cc9aaa4fc606b5c4`) — atualização de `vitest` para `5.1.1`.
- **Alinhamento Tiptap e correções de compatibilidade v2/v3 (`T1-R2`) via [Pull Request #22](https://github.com/JhonnyBCastro/document-editor/pull/22):** integrada por squash and merge em `24/11/2026`, às `19:31:56 UTC`, no marco funcional pós-F3 utilizado como base desta consolidação documental: [`977f106c2fcf46771f46ae3a40813ddbc24f1297`](https://github.com/JhonnyBCastro/document-editor/commit/977f106c2fcf46771f46ae3a40813ddbc24f1297) (pai único `1f689059639a3160b4fe0fd6afb440bc8d48db25`). A árvore candidata (`a8051788...`), a árvore validada pelo `CI/verify` (Run `45435569900`, Job `138592317584`, commit sintético `99cf8de603bfe3e56a94d28c27ef232ca8316c6b`) e a árvore integrada na `main` correspondem integralmente a `f961be2ebca7f675445fa9d765a1205d893b55ee`.
- **Encerramento automático das PRs #17 e #18 pelo `dependabot[bot]`:** posteriormente ao merge da PR #22, em `24/11/2026`, o `dependabot[bot]` encerrou automaticamente, sem merge individual e sem intervenção manual do Construtor, a [PR #17](https://github.com/JhonnyBCastro/document-editor/pull/17) (campo REST `closed_at`: `19:34:04 UTC`; evento de encerramento: `19:34:05 UTC`) e a [PR #18](https://github.com/JhonnyBCastro/document-editor/pull/18) (campo REST `closed_at`: `19:34:05 UTC`; evento de encerramento: `19:34:06 UTC`), uma vez que as dependências já se encontravam atualizadas na `main`. Não houve nova execução do workflow `CI/verify` após o merge no recorte consultado (as execuções `45471444376` e `45471444835` pertencem ao Dependabot).
- **Distribuição experimental integral `T1-R2`:** versão nominal `0.1.0-rc.4`, `107.674` bytes, `35` arquivos, SHA-256 `63da938292df3ac6b577cf6d3b6be2bebc40d43e46912068189e719f09651d0a`. Sua identidade byte a byte com o tarball reconstruído na preparação da PR #22 foi confirmada independentemente pela Frente A. Esse artefato é distinto do tarball histórico `M-01` da F3 (`cdce16900a...`, `105.255` bytes, `26` arquivos) e não comprova publicação no registro npm.
- **Validações da `T1-R2` (em seus respectivos recortes):** `223` testes aprovados em `20` arquivos (não métrica de cobertura), 3 builds aprovados, verificação pública TypeScript, consumidores independentes em Tiptap `2.27.3` e `3.35.0` com instalações congeladas (`npm ci`) e validação focal em navegador com medições geométricas físicas selecionadas, sem certificação universal de versões, navegadores, geometria ou segurança (veja [limitações](limitations.md#manutenção-pós-f3--alcance-e-ressalvas-da-candidata-t1-r2-pr-22-977f106c) e [desenvolvimento](development.md#manutenção-pós-f3--candidata-t1-r2-e-pr-22-24-de-novembro-de-2026)).

## Iniciativa F3 — marco histórico de incorporação e validação (`PR #16`)

A iniciativa `CROSS-LAB-001/ED-PACKAGE-RUNTIME-F3` incorporou à branch `main`, via [Pull Request #16](https://github.com/JhonnyBCastro/document-editor/pull/16), o commit homologado [`a0c92d5765a9832c5c03794e196fa23552fe0cbc`](https://github.com/JhonnyBCastro/document-editor/commit/a0c92d5765a9832c5c03794e196fa23552fe0cbc) (`HEAD^{tree}: f5fb00cdff33c8b17957fd6da4a01d72118f18b8`), contemplando a guarda de coordenadas degeneradas e precedência manual (`C-02/R3`) e a distinção entre aborto e convergência em ciclo multi-passe com remoção pública de `getLastConvergenceState()` (`C-03/R2`).

- **Pacote empacotado a partir desse commit (`M-01`):** `jhonny_bcastro-document-editor-0.1.0-rc.4.tgz` (`105.255` bytes, `26` arquivos, SHA-256 `cdce16900a7c6d3c09a827803a2367add3f495d53481a8ae86d283c7f19f99d0`, integridade `sha512-IRFvmlg2NL/YmNxdj0pZvF15DmwZV12ZrOj+y86vD52PThSTgpLJbccb3XEZ9iOyP+qvHcMK3mjNBOKu95Ldwg==`). Como a versão `0.1.0-rc.4` do manifesto repete a string anterior, a procedência binária é comprovada pelo SHA-256 do tarball e dos `26` arquivos internos, sem equivaler a publicação no registro npm.
- **Validações associadas (com ressalvas):** suíte unitária `18/18` (`209/209` testes em `M-01`), campanha consumidora pós-merge (`M-00 a M-06` e complemento `E-00 a E-04`, aprovados com ressalvas) e validação prática pelo Autor (`U-02 a U-05`, homologada com as ressalvas `OBS-U05-01`, `OBS-U05-02`, `UX-U03-01` e `DOC-U05-01`).
- **Reconciliação de referências históricas:** os vetores e tamanhos primários de referência são definidos diretamente pelos arquivos brutos (`cv01-state-a.json`, `cv01-state-b.json`, `cv02-erro1-c01-scroll1.json`, `m00-preflight-record.json`), nos termos do adendo `ED-PACKAGE-RUNTIME-F3-HISTORICAL-REFERENCE-RECONCILIATION-ADDENDUM-001` e do seu complemento corretivo `ED-PACKAGE-RUNTIME-F3-HISTORICAL-REFERENCE-RECONCILIATION-CORRIGENDUM-001`.

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

## Manutenção posterior — normalização de metadados e Live Demo, 29/10/2026

A versão canônica de trabalho permanece `0.1.0-rc.4`, conforme o manifesto vigente. Foram alinhados apenas `package-lock.json.version` e `package-lock.json.packages[""].version`, antes em `0.1.0-rc.2`. A comparação estrutural confirmou que os demais metadados e registros de dependências do lockfile permaneceram iguais. Não houve instalação, nova versão, regeneração ou substituição do tarball validado, release ou publicação. A divergência registrada acima pertence ao artefato e ao corte de origem; está preservada como histórico, sem continuar como candidata de versão atual.

O Live Demo passou a consumir entradas públicas por autorreferência aos artefatos existentes de `dist/`, com fluxos coordenado e manual. Sua checagem TypeScript, build próprio e navegação focal são evidências desta manutenção, distintas dos logs do consumidor V1. Não foi reconstruída a biblioteca nem reaberta a homologação/validação anterior. Veja [notas, alcance e resultados](../examples/live-demo/NOTES.md). Os exemplos documentais completos continuam identificados como propostos; esta manutenção verificou fluxos adaptados, não sua execução literal.

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
