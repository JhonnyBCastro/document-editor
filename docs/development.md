# Desenvolvimento

Trabalhe em um checkout identificado da linha `feature/compose-next`. A referência desta atualização é `1c3b5add4ec8201ff176d67fd83f6677502cdd1d`. Os comandos abaixo são instruções, não registros de novas execuções desta revisão.

Para testar consumo de pacote, use o [Quick Start](quick-start.md), em pasta separada. As instruções abaixo sobre build/testes da biblioteca são outro fluxo; não importar `src/` para contornar problemas do pacote.

## Ambiente e instalação

O ciclo CONS-014 utilizou Node 22.23.3, Vite 6.4.3, Vitest 5.0.3 e JSDOM 30.1.1. São versões observadas, não requisitos mínimos certificados. O [manifesto](../package.json) e o [lockfile](../package-lock.json) descrevem dependências; o manifesto mistura Core/PM Tiptap 2 e StarterKit 3. Não se presume compatibilidade universal ou isolamento de todo subpath ProseMirror.

A validação registrada usou dependências provisionadas fisicamente de uma instalação local preservada. Não demonstrou instalação limpa. Em um ambiente novo, a resolução pelo lockfile deve ser tratada como preparação ainda não validada; não usar `--force`, alterar versões ou recuperar dependências dos consumidores removidos para ocultar incompatibilidades. Esta documentação não anuncia um pacote npm correspondente à branch.

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

As [instruções atuais da Demo](../examples/live-demo/NOTES.md) cobrem servidor, URL, cenários e dependências de browser. A Demo importa `src/`, não um pacote histórico. Os processos escrevem caches e usam perfil temporário de navegador; a sessão visual é uma verificação distinta do checker headless.

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
| Validação futura | Consumidor independente com artefato identificado, instalação e exemplos novos ainda planejados; dependem de autorização própria. |

As versões registradas no ciclo de composição incluem Node 22.23.4, Tiptap Core 2.27.3, TypeScript 5.9.3, Vitest 5.0.3, Vite 6.4.3, Puppeteer na faixa relatada `^25.12.0` e Chrome 154.0.8037.57. São referências dos ambientes informados nas evidências, não requisitos mínimos certificados nem versões verificadas novamente nesta edição.

A tolerância de até 1 CSS px pertence exclusivamente ao ensaio geométrico delimitado em Chromium headless. No perfil padrão, o stride é 1076 CSS px e a separação entre áreas úteis, 212; no personalizado, 1088 e 160. As verificações unitárias em jsdom não comprovam essas medidas físicas nem ausência geral de congelamentos.

A decisão do responsável pelo projeto e o parecer independente são registros distintos. Consulte o [registro de aprovações](https://app.notion.com/p/40701a4f21f68173a384e3502bbb6b57) e a [investigação de composição](https://app.notion.com/p/40501a4f21f681359935df0f1d95e42c), sujeitos ao acesso ao workspace. Caminhos temporários locais não são anexos preservados remotamente. Esses registros não são dependências de runtime.

## Contribuições e documentação

Preserve alterações preexistentes e identifique a base de cada mudança. Relate problema, arquivos alterados, verificações realmente executadas e limitações. Não descreva testes propostos como resultados nem converta observação manual em homologação geral. Os contratos operacionais antigos estão no [arquivo de governança](archive/README.md).

Use [API](api.md), [arquitetura](architecture.md), [limitações](limitations.md) e [backlog](backlog.md) para o estado vigente. Relatórios datados são fontes históricas, não especificações permanentes. A licença do projeto é [MIT](../LICENSE).
