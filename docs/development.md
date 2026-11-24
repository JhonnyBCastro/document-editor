# Desenvolvimento

Trabalhe a partir da branch canônica `main` (marco funcional pós-F3 utilizado como base desta consolidação documental: `977f106c2fcf46771f46ae3a40813ddbc24f1297`, tree `f961be2ebca7f675445fa9d765a1205d893b55ee`, após a incorporação da linha `feature/compose-next` via Pull Request #3, a iniciativa F3 via Pull Request #16 e a manutenção pós-F3 via Pull Requests #21, #19 e #22). Os comandos abaixo são instruções operacionais para desenvolvimento, testes e verificação da biblioteca.

Para testar consumo de pacote, use o [Quick Start](quick-start.md), em pasta separada. As instruções abaixo sobre build/testes da biblioteca são outro fluxo; não importar `src/` para contornar problemas do pacote.

## Ambiente e instalação

### Grafo de desenvolvimento no marco funcional pós-F3 (`977f106c`)

O [manifesto](../package.json) e o [lockfile](../package-lock.json) consolidados pela manutenção pós-F3 (PRs #21, #19 e #22) apresentam:

- **Dependências de desenvolvimento Tiptap declaradas e resolvidas:** `@tiptap/core`, `@tiptap/pm` e `@tiptap/starter-kit` declarados em `^3.35.0` no manifesto, resolvidos em `3.35.0` no lockfile (`25` pacotes `@tiptap/*` resolvidos em `3.35.0`, eliminando as duplicatas anteriores de `@tiptap/core` e `@tiptap/pm`).
- **Ferramentas de teste e tipos resolvidas:** `vitest` `5.1.1`, `vite-plugin-dts` `5.1.2` e `unplugin-dts` `1.1.2`.
- **Remediação da Issue #15 no lockfile:** `0` entradas de `minimatch` e `0` entradas de `@microsoft/api-extractor` no grafo posterior à PR #21 (`294` entradas em `packages`, sendo `293` excluindo o pacote raiz). No lockfile histórico imediatamente anterior à PR #21 (`7d44a8a5ad45db2a16c0f98deba864daa1299087`), o inventário do grafo continha duas entradas distintas: `minimatch@10.2.3` em `node_modules/minimatch` (versão vinculada ao advisory examinado na Issue #15) e `minimatch@9.0.9` sob `node_modules/@vue/language-core/node_modules/minimatch`, sem atribuir automaticamente o mesmo advisory ou impacto concreto às duas versões. A remoção dessas entradas não constitui certificação geral de segurança: o `npm audit` de desenvolvimento ainda registra alertas residuais na cadeia de desenvolvimento (`11` alertas: `4` raízes + `7` propagados em Puppeteer/`zod`).
- **Peers públicos preservados:** `@tiptap/core` e `@tiptap/pm` mantidos em `^2.0.0 || ^3.0.0`. Versões declaradas, versões resolvidas no lockfile e versões ensaiadas em testes não estabelecem certificação universal de toda a faixa de peers nem requisitos mínimos certificados.
- **Instalação estrita verificada:** durante a preparação da PR #22 (Node `24.22.3` / npm `11.19.1`) e no workflow `CI/verify` do GitHub Actions (Node `24`), a instalação limpa por `npm ci` (sem `--force` ou `--legacy-peer-deps`) foi demonstrada com aprovação dos testes, builds e validação pública de tipos.

### Registro histórico de ambiente (`CONS-014`)

Historicamente, o ciclo `CONS-014` utilizou Node `22.23.3`, Vite `6.4.3`, Vitest `5.0.3` e JSDOM `30.1.1`, quando o manifesto ainda misturava Core/PM na geração 2 e StarterKit na geração 3 e as validações daquele corte utilizaram dependências provisionadas fisicamente sem verificar instalação limpa. Esse limite permanece preservado como registro histórico daquele ciclo. Esta documentação não anuncia publicação npm correspondente à branch.

## Experimento do pacote: tipos, bundle e browser

O consumidor independente resolveu Core/PM/StarterKit 3.32.0, TypeScript 7.0.2 e Vite 8.3.5. O primeiro executor relatou instalação e uso favoráveis. A investigação focal posterior reutilizou cópia física dessa resolução; não certificou uma instalação limpa do novo manifesto de exemplo.

Com `vite/client` comentado, tsc retornou TS2882 para os dois CSS do pacote e o CSS local; Vite isolado gerou bundle. Com a diretiva de três barras ativa, tsc passou; uma declaração ambiente CSS equivalente também passou. A receita final foi verificada com `noUncheckedSideEffectImports: true`. Não desativar a opção nem usar `skipLibCheck` como justificativa para ignorar erro no código da aplicação.

No consumidor, `npm run dev` executa Vite e não comprova tipos. O Quick Start define `check` separado e `build` encadeando check e Vite. A inspeção headless confirmou montagem, edição e descarte no alcance dos exemplos; registrou um HTTP 404 não investigado no fluxo integrado. Nenhum desses resultados comprova geometria ou idempotência.

Os comandos e códigos de retorno foram registrados separadamente na investigação externa de 23/10/2026. Esta atualização documental não repetiu essas execuções.

## Testes e builds

A partir da raiz, com as dependências já disponíveis:

```sh
npm test
npm run build
```

`npm test` executa `test:unit`. `npm run build` encadeia os builds de Core, Presentation e Compose. O manifesto também fornece `test:types:public` e `test:compose:geometry`. O script histórico `test:e2e` é um fluxo separado.

As instruções abaixo são propostas para uma execução futura autorizada, não comandos executados nesta análise documental:

```sh
npm run test:unit
node ./node_modules/typescript/bin/tsc --noEmit
npm run build
npm run test:types:public
npm run test:compose:geometry
```

Execute somente com as dependências locais previamente disponíveis e identificadas. Se algum executável estiver ausente, interrompa e registre a preparação necessária; estes comandos não instruem instalação, atualização ou uso de `npx`/`npm exec` com download implícito. O caminho local `node_modules/typescript/bin/tsc` e seu arquivo de entrada `lib/tsc.js` foram conferidos por leitura nesta preparação documental, sem executar o compilador; sua disponibilidade não é presumida em outras máquinas.

Execute o build antes do consumo público para produzir as declarações pertinentes. A checagem TypeScript pública usa autorreferência no repositório; o E2E geométrico importa fontes locais. Esses procedimentos não comprovam instalação independente do pacote.

O subpath ESM `/compose` aponta seus tipos para `dist/compose/compose/index.d.ts` e seu bundle para `dist/compose/index.es.js`. Aplicações devem importar o subpath público, não esses caminhos internos.

As configurações de build geram bundles e declarações via plugin DTS. Isso não equivale a uma campanha independente e completa de checagem de tipos. `node_modules/`, caches e `dist/` são artefatos locais, não fontes do produto.

## Live Demo e checker

As [instruções atuais da Demo](../examples/live-demo/NOTES.md) cobrem servidor, URL, cenários e dependências de browser. A Demo usa as entradas públicas do pacote, por autorreferência aos artefatos locais de `dist/`, sem alias para `src/`. Oferece montagem coordenada e manual; não equivale a uma instalação independente. A verificação focal da manutenção de 29/10/2026 está identificada nas notas da Demo, separada dos resultados históricos abaixo. Os processos escrevem caches e usam perfil temporário de navegador; a sessão visual é uma verificação distinta do checker headless.

Não confundir `freshLayoutRound` com `idempotent`. Os resultados negativos e violações devem ser lidos mesmo quando o checker termina com código zero. Veja [limitações](limitations.md).

## E2E históricos

O script `test:e2e` ainda aponta para `tests/e2e/pagination-stress.spec.cjs`. Não constitui um fluxo atual autônomo: os scripts históricos usam servidor na porta 8543, alguns dependem do antigo `vanilla-consumer` e incluem destinos de captura locais. Há verificações por diferença de comprimento JSON e tratamentos de erro que não constituem oráculo semântico completo.

Não usar esses procedimentos como receita de inicialização da Demo atual nem presumir sua aprovação a partir da suíte unitária. A revisão dos runners é uma tarefa separada; não exige restaurar exemplos ou testes deliberadamente removidos.

## Evidências já registradas

No ciclo CONS-014, a candidata teve 118 testes aprovados em 11 arquivos e builds Core/Presentation concluídos. O checker posterior observou `mini`, `p:370` e `p:600`; a sessão manual do usuário foi favorável em alcance exploratório. Essas evidências não aprovam idempotência, geometria geral, tabelas na Demo ou todas as versões de dependências. A suíte focal C-05 de outro workspace é independente.

### Composição Coordenada V1 — evidências por procedência

A implementação, a revisão independente e a homologação técnica foram concluídas no escopo autorizado e nos ambientes verificados. Esse fechamento não comprova instalação limpa, compatibilidade universal ou o estado atual do repositório remoto. A presente análise documental não executou novamente testes, compilador, build, exemplos ou medições.

| Procedência | Evidência e alcance |
|---|---|
| Revisão conclusiva da Frente A | Registro de 163 testes unitários, quatro sondagens focais, consumo público TypeScript e verificação da composição manual com controles positivo, negativo e de identidade do snapshot. São resultados daquela revisão, não desta edição. |
| Rodadas anteriores da Frente A | Sondagens de duas suítes de nove testes, tipagem, build, importação ESM e ensaio geométrico nos dois perfis, com 53 e 38 condições. Não apresentar como repetidos na rodada conclusiva os procedimentos que não o foram. |
| Relatos do construtor | Comandos, contagens e resultados das devoluções são relatos identificados; não substituem reprodução independente. |
| Preparação documental atual | Leitura de fontes, tipos, manifesto, scripts e disponibilidade dos arquivos locais das ferramentas; sem execução dos comandos documentados. |
| Validação do consumidor V1 — 29/10/2026 | Encerrada com ressalvas no escopo autorizado e nos ambientes verificados. O executor produziu os resultados; a Frente A inspecionou os artefatos e recalculou a geometria, sem repetir TypeScript/build ou os testes do laboratório. Os exemplos literais novos não recebem validação por associação. |

As versões registradas no ciclo de composição incluem Node 22.23.4, Tiptap Core 2.27.3, TypeScript 5.9.3, Vitest 5.0.3, Vite 6.4.3, Puppeteer na faixa relatada `^25.12.0` e Chrome 154.0.8037.57. São referências dos ambientes informados nas evidências, não requisitos mínimos certificados nem versões verificadas novamente nesta edição.

A tolerância de até 1 CSS px pertence exclusivamente ao ensaio geométrico delimitado em Chromium headless. No perfil padrão, o stride é 1076 CSS px e a separação entre áreas úteis, 212; no personalizado, 1088 e 160. As verificações unitárias em jsdom não comprovam essas medidas físicas nem ausência geral de congelamentos.

A decisão do responsável pelo projeto e o parecer independente são registros distintos. Consulte o [registro de aprovações](https://app.notion.com/p/40701a4f21f68173a384e3502bbb6b57) e a [investigação de composição](https://app.notion.com/p/40501a4f21f681359935df0f1d95e42c), sujeitos ao acesso ao workspace. Caminhos temporários locais não são anexos preservados remotamente. Esses registros não são dependências de runtime.

### Validação do consumidor V1 — 29 de outubro de 2026

O [registro de encerramento e a identidade do artefato](provenance.md#validação-do-consumidor-v1--encerramento-de-29102026) distinguem a decisão do responsável pelo projeto do parecer independente. A instalação e o consumo público do tarball foram verificados no laboratório separado, preservando os fluxos coordenado, Core/Presentation isolados e montagem manual. Isso não comprova instalação limpa de todo manifesto de exemplo ou de qualquer grafo transitivo.

O ambiente registrado foi Linux x64, Node 22.23.4, Tiptap Core/PM/StarterKit 2.27.3, TypeScript 5.9.3, Vite 6.4.3, puppeteer-core 25.12.0 e Chrome headless 154.0.8037.57. São versões ensaiadas, não novos requisitos mínimos nem certificação das faixas dos peers.

Os logs contemporâneos do executor registram `./node_modules/.bin/tsc --noEmit --skipLibCheck false`, saída 0 e zero diagnósticos, e build Vite do consumidor com saída 0. O override explícito de `skipLibCheck` prevalece sobre o valor `true` do arquivo de configuração. A Frente A conferiu arquivos, logs e hashes; não repetiu essas execuções nem o build para estabelecer equivalência reproduzida entre fontes e bundle.

CON-07 demonstrou a aplicação da segunda publicação à Presentation. CON-08 suprimiu essa aplicação e verificou a falha específica da condição de atualização, com o estado anterior preservado. CON-09 observou ausência de callbacks indevidos na janela de 1 s + 2 frames; CON-10/11/12 cobriram causalidade, contingência e limpeza nos cenários delimitados. CON-13 demonstrou 20 ciclos de edição/substituição e publicação, não 20 ciclos de montagem/descarte.

Na Rodada 3, dedicada a CON-14, o executor preservou retângulos físicos e modelos de caixa antes do descarte. A Frente A recalculou 121 asserções, 68 Standard e 53 Custom, cobrindo 16 identificadores, com desvio máximo de 0 CSS px. A tolerância de até 1 CSS px vale somente para o ensaio aprovado, não para qualquer montagem ou conteúdo.

O supervisor registrou fechamento do navegador e evento de fechamento do servidor Vite com código 143 após SIGTERM. A mensagem interna de saída 0 não substitui um registro externo, pelo processo pai, do código de saída efetivo do supervisor; tal registro não consta dos artefatos examinados. Ramos excepcionais do supervisor não foram todos exercidos. O GET 404 de `/favicon.ico` foi identificado nesse laboratório sem impacto observado no ensaio; isso não resolve os 404 históricos de outras execuções.

Esses resultados não reexecutam nem substituem os registros anteriores de implementação, os negativos da Demo ou as ressalvas descritas em [limitações](limitations.md).

### Manutenção pós-F3 — candidata `T1-R2` e PR #22 (24 de novembro de 2026)

Na conclusão dos ciclos experimentais `T1`, `T1-R1` e `T1-R2` e na preparação da PR #22 (`a8051788...`, integrada por squash em `977f106c2fcf46771f46ae3a40813ddbc24f1297`, tree `f961be2ebca7f675445fa9d765a1205d893b55ee`):

- **Gates locais e CI da PR #22:** `npm ci`, `npm test` (`223` testes aprovados em `20` arquivos, com `0` exceções assíncronas não tratadas — contagem de testes, não métrica de cobertura), `npm run build` (Core, Presentation e Compose) e `npm run test:types:public` (`.`, `./presentation` e `./compose`) aprovados localmente e no job obrigatório `CI/verify` (Run `45435569900`, Job `138592317584`, executado sobre o merge sintético `99cf8de603bfe3e56a94d28c27ef232ca8316c6b` de árvore idêntica `f961be2ebca7f675445fa9d765a1205d893b55ee`). Não houve nova execução de `CI/verify` após o merge no recorte consultado (as execuções posteriores `45471444376` e `45471444835` pertencem ao Dependabot).
- **Consumidores independentes ensaiados na `T1-R2`:** dois consumidores externos independentes (`typescript@5.9.3` com `strict: true` e `skipLibCheck: false`, `vite@6.4.5`, instalação congelada via `npm ci`) — um em Tiptap `2.27.3` e outro em Tiptap `3.35.0` — validados em Chromium headless com `0` `pageErrors`, `0` `unexpectedConsoleErrors` e medições físicas `getBoundingClientRect()` com desvio máximo de `0 px` nas superfícies e cenários medidos.
- **Ressalvas preservadas:** no consumidor Tiptap `2.27.3`, o `npm audit` reportou `1` advisory raiz em `@tiptap/core@2.27.3` e `24` entradas propagadas (`0` vulnerabilidades no consumidor Tiptap `3.35.0`). A identidade do tarball e dos marcos está em [proveniência](provenance.md#manutenção-pós-f3--issue-15-pr-19-e-candidata-t1-r2--pr-22).

## Contribuições e documentação

Preserve alterações preexistentes e identifique a base de cada mudança. Relate problema, arquivos alterados, verificações realmente executadas e limitações. Não descreva testes propostos como resultados nem converta observação manual em homologação geral. Os contratos operacionais antigos estão no [arquivo de governança](archive/README.md).

Use [API](api.md), [arquitetura](architecture.md), [limitações](limitations.md) e [backlog](backlog.md) para o estado vigente. Relatórios datados são fontes históricas, não especificações permanentes. A licença do projeto é [MIT](../LICENSE).
