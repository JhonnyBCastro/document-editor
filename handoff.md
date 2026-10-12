# Handoff da biblioteca document-editor — Antigravity

Frente A → Construtor da biblioteca. Corte: 12/10/2026. **Documento de contexto; não autoriza correções, verificações, instalação, build, navegador ou operações Git.** Leia pela IDE/filesystem. O contexto do consumidor está no [handoff da Frente B](/home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/ANTIGRAVITY-LAB-HANDOFF-001/HANDOFF-LAB.md); não é necessário reconstruir as conversas ou usar ferramentas Codex para começar a compreender o projeto.

## 1. Projeto e identidade atual

Abra **/home/jhonny/TCC/document-editor**. Na leitura desta preparação:

- HEAD: `83389999102626309dcb90ff8e8a1d38d3f05a4e`.
- Branch: `fix/reopen-002-f2-r4`.
- Índice vazio; **11 arquivos modificados e 3 novos** na working tree.
- Nome/versão declarados: `@jhonny_bcastro/document-editor@0.1.0-rc.4`.

**Leia a working tree, não somente o HEAD.** Os deltas consolidados ainda não foram commitados: modificados `src/controller.ts`, `src/decorations.ts`, `src/extension.ts`, `src/types.ts`, `README.md`, `docs/api.md`, `docs/architecture.md`, `docs/limitations.md`, `docs/backlog.md`, `docs/provenance.md` e `package.json`; novos `tests/unit/core-stability.spec.ts`, `tests/unit/paint-mode.spec.ts` e `docs/consolidation/CANONICAL-CONSOLIDATION-001.md`. Não descartar esse estado ou reaplicar a consolidação por encontrar Git dirty.

A etapa A foi aceita com testes próprios e recuperação externa. O pedido posterior de commit/push parou na primeira consulta remota: revisão automática de permissão expirou antes de iniciar o processo observado; não houve add/commit/push. Isso não prova erro de autenticação Git ou insegurança da operação. Remoto vivo continua desconhecido. A passagem não retoma essa oportunidade operacional.

`dist/` contém nove arquivos preexistentes ignorados; tarballs RC.2/3/4 e `document-alpha/` são históricos. **Não houve build/pack da canônica consolidada na etapa A.** Os exports do pacote apontam a `dist`: importar pela raiz pode consumir esses bytes antigos, não o TypeScript atual. RC.4 nominal não identifica commit, emissão nova ou homologação.

O Lab é outro repositório: **/home/jhonny/TCC/document-editor-reference-lab**, HEAD `bac1f360…` no checkpoint B, com vendor identificado como `d677032…`. O Precore em `/home/jhonny/TCC/editor-lab-pre-core` é histórico. Não modificar APPE, auxiliares ou worktrees para facilitar a retomada.

## 2. Arquivos essenciais

Os caminhos relativos abaixo pertencem a `/home/jhonny/TCC/document-editor/`.

| Arquivo                                                                                                    | Responsabilidade                                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                                                                                           | Barrel público, CSS,`whenLayoutStable`, impressão; não exporta factory composta                                |
| `src/types.ts`                                                                                           | Layout, opções, decisões, snapshots, projeções e contrato de coordenadas                                       |
| `src/extension.ts`                                                                                       | Plugin Tiptap/PM, controller/storage, trigger, decorations e descarte                                               |
| `src/controller.ts`                                                                                      | Agendamento/estabilidade, medição, decisões, neutralização de deslocamentos anteriores, aplicação e emissão |
| `src/measurement.ts`, `src/policies.ts`                                                                | Linhas visuais, políticas lineares/tabulares e progresso                                                           |
| `src/decorations.ts`                                                                                     | Carriers linear/manual/tabular, reservas e bordas geométricas B1                                                   |
| `src/projection.ts`                                                                                      | Rects de folhas/Header/Footer e distância entre páginas                                                           |
| `src/chrome.ts`, `src/style.css`                                                                       | Chrome legado, estilos geométricos e impressão                                                                    |
| `src/presentation/index.ts`, `src/presentation/presentation.css`                                       | Renderização independente por snapshot, pintura, callbacks/disposers e lifecycle                                  |
| `src/print.ts`                                                                                           | Preparação/restauração de impressão e efeitos globais                                                          |
| `tests/unit/`, `tests/fixtures/`                                                                       | Regressões; fixtures PE-S/M/L. Browser histórico está em`tests/e2e/`                                           |
| `package.json`, lock, Vitest/TS/Vite configs                                                             | Scripts, família instalada, tipagem e emissão                                                                     |
| `README.md`, `docs/api.md`, `architecture.md`, `limitations.md`, `backlog.md`, `provenance.md` | Documentação viva; ADRs/releases preservam cortes históricos                                                     |

Entradas públicas: Core, `/style.css`, `/presentation` e `/presentation.css`. Core exporta `PaginationExtension`, `PaginationPluginKey`, tipos, `whenLayoutStable(editor)` e `preparePrintSession(editor)`/`PrintSession`. Presentation exporta `createDocumentPresentation(host, options?)` e tipos. Os tipos emitidos de Presentation ficam em `dist/presentation/presentation/index.d.ts`, com arquivo auxiliar de tipos. Storage, `window.paginationController` e métodos internos não são bridge pública suportada.

## 3. Responsabilidades e contratos

**Paginação:** o documento semântico continua contínuo; quebras automáticas são Decorations transitórias. O consumidor registra o schema do nó manual (`pageBreak` por default; `horizontalRule` no Lab). O Core mede DOM/fontes, avalia políticas e produz decisões, carriers e projeções; não é matemática inteiramente independente do browser. Tabelas quebram entre linhas; fragmentação arbitrária intralinha não é suporte demonstrado. `BreakDecision.origin` permanece opcional.

**Cálculo e projeção:** `performLayout` usa geometria do editor/`coordsAtPos` e subtrai deslocamentos de decorations anteriores para obter coordenada neutralizada. Altura útil é `height - marginTop - marginBottom`; reserva-base é `marginBottom + pageGap + marginTop`. Esses mecanismos são pontos de leitura, não causas já demonstradas das anomalias.

`calculatePageProjections` usa `breaks.length + 1` páginas. Na iteração `i`, `sheet.top = i * (page.height + pageGap)`; folha tem tamanho físico configurado, Header ocupa reserva superior e Footer começa em `sheetTop + height - marginBottom`. O gap já está na projeção: Presentation não deve somá-lo novamente. `PageProjection.index` é `i + 1`; contexto/atributos da Presentation usam o índice zero-based da iteração. Não misturar os dois ao investigar uma página.

`PageProjection` usa **DocumentLayoutSpace, CSS pixels lógicos pré-transformação**. Host deve ter mesma origem/escala. DOMRect/coordsAtPos/scroll/zoom exigem conversão explícita ao confrontar limites locais; pixel de vídeo não é CSS px autenticado. Não duplicar insets nem comparar viewport Y diretamente com `sheetRect.top` local.

**Estabilidade:** debounce de 100 ms preservado; a correção libera `renderTimeout` quando o callback é consumido. `whenLayoutStable` espera emissão e pode agendar cálculo; não é getter passivo de snapshot. Callback de estabilidade representa conclusão local, não geometria permanentemente correta. Revision cresce quando as decisões/decorations mudam, não necessariamente por edição ou emissão. Diagnóstico vazio não é certificação geométrica.

O trigger atual observa tamanho do conteúdo ou metadado de configuração. Edição de mesmo tamanho pode alterar medidas sem esse caminho; isso é risco, não defeito universal comprovado. `fonts.ready`/frames têm cancelamento integral não demonstrado. Destroy não certifica liquidação de todas as Promises.

**Pintura:** `legacy` é default/omissão; `composed` é opt-in e fixo por instância. Inválido e `chromeLayerElement` definido em composed rejeitam sem fallback. Legado pinta PM/chrome; composed não escreve essa pintura, mantém estilos do consumidor e mecanismos geométricos. B1 conserva quatro arestas de 1 px solid transparent nos carriers. Não remover estruturas ou compensações por sua aparência decorativa.

**Composição:** Presentation aplica rects, não pagina nem cria Editor. `render` após destroy lança; clear após destroy não age; destroy é idempotente. Callbacks de Header/Footer são visual-only, não focáveis e não devem alterar geometria do mount. Erros de disposer podem ser capturados internamente no console, sem canal estruturado completo.

Consumidor coordena schema/conteúdo, host, insets, configuração única, stacking, encaminhamento do snapshot e descarte. Factory/bridge oficiais, atualização suportada, insets automáticos e impressão composta continuam pendentes. A montagem experimental não é integração pronta.

`preparePrintSession` aplica pageGap zero e classe global no body, mantém lock e retorna snapshot/restore; o host imprime e restaura em finally. Não é gerador PDF; efeitos globais limitam multi-instância e não há equivalência garantida a motores externos.

## 4. Verificações e procedimentos

A consolidação A executou, na canônica, os comandos abaixo com `/usr/bin/node`, ambiente fechado e captura externa. **Não foram repetidos nesta passagem.**

```sh
node node_modules/vitest/vitest.mjs run tests/unit/core-stability.spec.ts tests/unit/paint-mode.spec.ts
node node_modules/vitest/vitest.mjs run tests/unit
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node node_modules/typescript/bin/tsc --noEmit --emitDeclarationOnly false -p tsconfig.presentation.json
```

Resultados: 37 dirigidos (5 stability + 32 paint-mode), incluídos nos **62 totais em 6 arquivos**; não 99 distintos. Tipagens Core/Presentation com código zero, sem emissão. Exceção intencional `Faulty disposer` em teste aprovado foi preservada no stderr. JSDOM/tipos não demonstram geometria ou pintura real. Node 22.23.3 é versão documentada nos checks, não invocada novamente aqui.

| Procedimento declarado                 | Distinção                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm test`                           | Agora unitários somente; esse encadeamento não foi executado na etapa A                           |
| `npm run test:unit` / `test:watch` | Vitest run/watch; veja config/include. Quatro checks acima são as execuções registradas          |
| `npm run build`                      | Vite Core + Presentation/dts/CSS; não executado para esta consolidação                           |
| `npm run test:e2e`                   | Runner histórico de stress, consumidor em 8543 e efeitos próprios; não executar por implicação |

A raiz da biblioteca **não tem script dev**: é pacote, não aplicação. O Lab tem `npm run dev` documentado e relato manual limitado de Boby; o relato não é captura da expressão exata. As dependências existem, mas Core/PM 2 com StarterKit 3 no ambiente unitário não certificam todas as combinações. Não instalar/atualizar preventivamente.

Os runners antigos gravam resultados na raiz, usam polling e possuem limitações de sinalização de erro; `semanticDiff` mede comprimento JSON, não igualdade semântica. `run*.sh` usam caminhos locais e encerramento por porta; `remove_server_process` reescreve testes. Não usar esses scripts como rotina automática de verificação.

## 5. Relação com o payload d677032 do Lab

Nesta leitura comparei **13 arquivos de `src/` canônicos** com a fonte em `PAINT-MODE-B1-IMPL-001-CANDIDATE`: todos byte-idênticos. Isso liga os fontes selecionados à fonte B1, não transforma HEAD `8338999` em `d677032`, não inclui docs/package e não produz distribuição.

Os quatro exports/CSS do vendor do Lab conferem com `config/reference.json` e são byte-idênticos ao payload new da MATERIALIZATION-004. A entrada manual carrega esse vendor, não o dist canônico mutável. O Lab usa Tiptap 3.31.3/Vite 5.4.21; não importa o runtime 004. Não há certificação global de singleton PM, grafo ou bytes HTTP.

**Atualização futura recomendada:** escolher fonte/artefato e objetivo com Boby; identificar toolchain e checks; produzir emissão somente se autorizada; registrar fonte/commit ou delta local e hashes; conferir exports/CSS/types pertinentes. O Construtor do Lab integra recursos em vendor/config com preservação e registra verificações/uso efetivos. Não editar bundle para corrigir, copiar node_modules ou trocar pacote pelo nome RC.4. Sem emissão nova identificada, manter o vendor atual. Build/pack/install/browser não estão autorizados por este roteiro.

## 6. Implementado, observado e pendente

Aceitos no recorte: timer, seleção de pintura/B1 e incorporação A com unidades/tipos/docs. Campanha 004 satisfez pares L/T delimitados e N2 teve parecer visual favorável; isso não provou toda composição. DV2 foi interrompida por supervisão e vídeo posterior acrescentou anomalias sem causa. Lab implantado/transferido tem relato posterior de funcionamento como antes em uso pessoal limitado.

**Possível deslocamento progressivo:** Boby relata primeira página aparentemente correta e conteúdo começando/terminando mais abaixo nas seguintes, com crescimento aparente. Ainda faltam documento, revisão e medidas associados. Não concluir acúmulo de margem, borda, gap ou erro do Core/Presentation.

Para um recorte futuro escolhido, distinguir:

- **Cálculo/fluxo:** posições PM, decisões/carriers/effectiveDisplacement e alturas, na primeira e pelo menos duas páginas seguintes.
- **Representação:** DOM sheet/Header/Footer versus rects do mesmo snapshot.
- **Coordenadas:** origem/escala editor/host, scroll/zoom/DPR/insets e conversões.
- **Atualização/métricas:** fonte/estado e emissão antes/depois da ação; painel antigo não prova render atual.

Isso é orientação para escolher evidência, não coleta ou instrumentação autorizada. Não inventar API/global, aplicar tolerância favorável ou mascarar sintoma com vendor/CSS.

Permanecem: composição oficial, atualização/lifecycle, impressão composta, intralinha/multi-instância, uso arbitrário, PM/tipos/grafo, S/margens, M1 indisponível, evidência C, SLP-B-02/helper sem aceite e causa de teste desconhecida, Gate e reservas históricas. Essas pendências não impedem entender/retomar tarefa delimitada; impedem anunciar produto plenamente validado.

## 7. Retomada e fontes opcionais

Este pacote completa o contexto A antes faltante e será confrontado compactamente com B. Para começar, bastam este arquivo, fontes/docs canônicos e handoff B. Referências externas opcionais:

- /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/DOCUMENT-EDITOR-CANONICAL-CONSOLIDATION-A-EVIDENCE-001/REPORT.md — resultados próprios;
- /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/DOCUMENT-EDITOR-CANONICAL-CONSOLIDATION-A-REVIEW-001/CROSS-CANONICAL-CONSOLIDATION-A-REVIEW-001.md — aceite;
- /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/DOCUMENT-EDITOR-CANONICAL-CONSOLIDATION-COMMIT-PUSH-EVIDENCE-001/REPORT.md — parada Git;
- /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-B1-IMPL-001-CANDIDATE — fonte histórica;
- /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-BROWSER-MATERIALIZATION-004/new/payload — emissão do vendor.

Falta de emissão nova, remoto desconhecido e causalidade visual aberta **não impedem concluir a passagem documental**. Antes de desenvolvimento, Boby define a tarefa concreta e suas verificações; este handoff não retoma autorização operacional consumida. Se o novo ambiente não tiver dependências, declarar a necessidade antes de instalar.

Esta preparação fez somente leitura/hash/Git local não mutante e documentos novos. SOURCE-IDENTITIES.json registra fontes dirigidas, não auditoria total. Sem correções, checks/tests/build/install/npm/browser/remotos/commits/movimentação ou append no roadmap. Não é necessário conservar protocolos Codex como rotina obrigatória da IDE; registros futuros devem ser proporcionais ao escopo aprovado. Gate não homologado.
