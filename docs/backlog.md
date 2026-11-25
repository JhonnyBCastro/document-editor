# Backlog

Base canônica documental adotada em `24/11/2026` (branch `main`): `fa199af49d0adabbd15d1a244b919451ff2a4d27`, tree `894f8badd5bd0cb83b3ad2f9c61deae582aad196` (após incorporação da linha `feature/compose-next` via Pull Request #3, iniciativa F3 via Pull Request #16, consolidação documental R2 via Pull Request #20, manutenção pós-F3 via Pull Requests #21, #19 e #22 sobre o marco funcional pós-F3 `977f106c2fcf46771f46ae3a40813ddbc24f1297`, e consolidação documental pós-F3 via Pull Request #23). Esta lista separa implementação, evidência e trabalho futuro; não reabre automaticamente decisões encerradas nem estabelece o estado remoto de versões posteriores.

## Implementado

- Core/Presentation separados e modo único `composed`; rejeição de outros modos e remoção de `chromeLayerElement`.
- Ownership transacional de decorações no plugin, bridge interna e remapeamento.
- Recorrência de capacidade e validação de carriers/decisões estruturais.
- Reatividade por identidade, tamanho e igualdade documental (`Node.eq`), incluindo diferenças de texto, marcas e atributos com tamanho/estrutura preservados; mantido o sinal interno de configuração, com os limites descritos na [API](api.md).
- Live Demo independente dos consumidores removidos, com texto linear, títulos e edição; cenários tabulares explicitamente indisponíveis. Na manutenção de 29/10/2026, imports públicos por `dist/` local e fluxos coordenado/manual foram conferidos no recorte descrito nas [notas da Demo](../examples/live-demo/NOTES.md), sem validar literalmente os exemplos completos com StarterKit.
- Linha de desenvolvimento consolidada localmente e enviada ao remoto, preservando a proveniência canônica e experimental.

- Quick Start primário com Composição Coordenada V1 (`createDocumentEditor`), validado literalmente em consumidor independente limpo com TypeScript, build Vite e execução em navegador; receita de montagem manual avançada preservada.
- Composição Coordenada V1 implementada, revisada e homologada no escopo autorizado e nos ambientes verificados: `createDocumentEditor(options)`, `options.host`, interface mínima e entrada ESM `/compose`. Não inclui atualização dinâmica de layout.
- Manutenção pós-F3 integrada na `main`:
  - **Issue #15 / PR #21 (`88aa3393a961d9c55318172fbedb993c4664810f`):** migração de `vite-plugin-dts` para `^5.1.2` (`unplugin-dts` `1.1.2`), remoção das entradas de `minimatch` e `@microsoft/api-extractor` no lockfile de desenvolvimento e ampliação de `test:types:public` para `.`, `./presentation` e `./compose` (Issue #15 encerrada como `completed`).
  - **PR #19 (`1f689059639a3160b4fe0fd6afb440bc8d48db25`):** atualização de `vitest` para `5.1.1`.
  - **PR #22 (`977f106c2fcf46771f46ae3a40813ddbc24f1297`):** alinhamento de `@tiptap/{core,pm,starter-kit}` em `devDependencies` para `^3.35.0` (`25` pacotes Tiptap resolvidos em `3.35.0`, mantendo peers `^2.0.0 || ^3.0.0`), verificação resiliente de aquisição da `EditorView` e normalização de `autofocus` omitido para `false` em `createDocumentEditor`, protocolo explícito de publicação em três desfechos com orçamento contínuo de três invalidações entre ciclos e 14 testes focais de regressão (`223` testes em `20` arquivos). As PRs #17 e #18 foram encerradas automaticamente pelo Dependabot sem merge individual após essa integração.
- **Incorporação nativa `AUTO-CSS-C01 V1` (experimentalmente homologada e preparada para integração sobre a base `fa199af4`):** aplicação padrão do contrato **`CSS C-01`** em `@jhonny_bcastro/document-editor/style.css` por meio do marcador `document-editor-paginated` adicionado por `PaginationExtension` à raiz editável, preservando o import explícito do CSS pelo consumidor (`C-CSS-02`), sobrescrita via cascata CSS (`C-CSS-04`) e o teste focal `tests/unit/auto-css-c01.spec.ts` (`6` testes; detalhes e histórico datado de `24/11/2026` em [proveniência](provenance.md#consolidação-documental-pós-f3-pr-23-e-preparação-auto-css-c01-v1)).
- **Preparação local `Debug Overlay V1` (`DEBUG-OVERLAY-001`, candidata de integração regularizada sobre a base `2cb8e65c`, pendente de integração na `main`):** camada diagnóstica visual opcional e independente em `@jhonny_bcastro/document-editor/presentation` (`createDocumentDebugOverlay`) e provisionamento opcional em `@jhonny_bcastro/document-editor/compose` (`options.debugOverlay` / `instance.debugOverlay`), incorporando a candidata experimental homologada R1, os ajustes visuais localizados (`OVL-VIS-01` e `OVL-VIS-02` com fallback confinado e omissão visual controlada) e a evolução delimitada de cleanup (`'debug-overlay'` / `'debug-overlay-destroy'`), ainda não integrada à `main` nem publicada no npm.

## Observado com validação limitada

- 118 testes em 11 arquivos e builds Core/Presentation aprovados no ciclo da candidata; não repetidos na edição documental.
- Correção de reatividade: construtor reportou 10 testes de reatividade, 25 de associação, 125 unitários e tipagem sem erros. Frente A inspecionou a entrega, sem repetir testes/tipagem; estes resultados não são uma nova execução desta edição. Ensaio local em navegador (sessão `20261026-163800`) aceito no recorte A/B: edição textual de mesmo tamanho seguida de agendamento, cálculo e emissão; observação visual favorável nos recortes, sem homologação geométrica, desempenho ou idempotência.
- Checker executado em três cenários lineares, com `freshLayoutRound: true`, mas `idempotent: false` e violações geométricas.
- Sessão manual favorável, inclusive documento de aproximadamente 472 páginas; lentidão observada, sem benchmark ou homologação geral.
- Reavaliação das duas inconsistências visuais anteriores sem reprodução conclusiva. Não registrar como correção comprovada.

- Consumidor focal do tarball com tsc e bundle separados; TS2882 reproduzido e eliminado pela declaração de assets ativa, sem desativar a checagem. Montagem integrada/isoladas e descarte observados em alcance delimitado; novo 404 sem origem determinada.
- Merge parcial aninhado preserva defaults no runtime Tiptap 3.32.0, mas os tipos atuais exigem layout completo. Isso não equivale a suporte público DeepPartial.

- Validação do consumidor V1 encerrada com ressalvas, no escopo autorizado e nos ambientes verificados, com tarball identificado e imports públicos. Foram preservados os fluxos coordenado, isolados e manual, controles positivo/negativo e os limites dos cenários de lifecycle e geometria. O registro de identidade, decisão e evidências está em [proveniência](provenance.md#validação-do-consumidor-v1--encerramento-de-29102026).

## Planejado ou pendente

1. Investigar idempotência negativa, violações geométricas e HTTP 404 com hipótese e escopo próprios; sem atribuição causal antecipada.
2. Ampliar evidências de reatividade somente com hipótese e escopo próprios: a correção documental está implementada e o ensaio real cobriu duas edições textuais de mesmo tamanho, não uma matriz visual geral de marcas/atributos ou desempenho. Mudanças externas de geometria e a tarefa focal C-05 permanecem independentes.
3. Consolidar reprodutibilidade da Live Demo e de eventuais matrizes adicionais de consumo externo: o grafo de desenvolvimento Tiptap/PM foi alinhado na `main` em `3.35.0` com `npm ci` verificado na PR #22 e no CI, mas dependências da Demo e matrizes amplas de consumidores continuam sujeitas a escopo próprio. Não restaurar consumidores obsoletos.
4. Disponibilizar cenários tabulares na Demo por decisão própria, preservando os limites intralinha e de rowspan.
5. Ampliar validação de orçamento, recuperação de `STALE_BREAK`, associação estrutural tabular e mapeamento linha visual/intervalo PM (pendências N2–N5 do CONS-013). A recorrência algébrica não fecha a integração geométrica.
6. Decidir o comportamento sem corte elegível (L1) e de overshoot sem fronteira anterior (L2), sem confundir essas escolhas com ressalvas de rodapé ou impressão.
7. Se for autorizada uma nova etapa, verificar a execução literal das receitas documentais ainda propostas e ampliar ambientes ou condições somente com hipótese e escopo próprios. A validação do consumidor V1 está encerrada e não deve ser reaberta por este item. Instalação limpa de outros manifestos, fontes/CSS externos, multi-instância e impressão composta não recebem aprovação automática desse fechamento.
8. Revisar runners E2E históricos antes de propô-los como fluxo atual: pré-requisitos, comparação semântica, propagação de falhas e saídas portáteis.
9. **Evoluções futuras pós-`AUTO-CSS-C01 V1` (`D-01`, `D-02`):** avaliar, caso surja necessidade em ciclos futuros, eventual opção pública explícita de desativação (ausente em V1 conforme `D-02`) e eventual tratamento de isolamento CSS dedicado para editores externos fisicamente aninhados na raiz de um editor paginado (limitação aceita de forma delimitada em `D-01`). Na preparação local de `24/11/2026` sobre `fa199af4...`, o escopo V1 encontrava-se pendente de revisão e integração canônica.
10. **Observações pós-F3 (`OBS-U05-01` e `UX-U03-01`):** Avaliar, em ciclo próprio futuro, a recuperação espontânea posterior de cenários parcialmente estabilizados (`LAYOUT_CONVERGENCE_LIMIT`, `5` ocorrências observadas em `U-05`) e investigar com instrumentação temporal a apresentação transitória relatada em carregamentos extensos (`UX-U03-01`, sem medição instrumental até o momento).

## Fora de qualquer aprovação automática

Publicação de pacote, nova versão, compatibilidade universal e homologação completa exigem evidência e decisão próprias. O laboratório histórico deve adaptar seus consumidores ao contrato atual quando pertinente; sua desatualização não bloqueia o desenvolvimento da biblioteca.

Veja [limitações](limitations.md), [desenvolvimento](development.md) e [história](project-history.md).
