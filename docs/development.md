# Desenvolvimento

Trabalhe em um checkout identificado da linha `dev/cons014-composed-20261022`. A base desta documentação é `1962cdbb3456cc989b064017137d48a8df143d3d`. Os comandos abaixo são instruções, não registros de novas execuções desta revisão.

## Ambiente e instalação

O ciclo CONS-014 utilizou Node 22.23.3, Vite 6.4.3, Vitest 5.0.3 e JSDOM 30.1.1. São versões observadas, não requisitos mínimos certificados. O [manifesto](../package.json) e o [lockfile](../package-lock.json) descrevem dependências; o manifesto mistura Core/PM Tiptap 2 e StarterKit 3. Não se presume compatibilidade universal ou isolamento de todo subpath ProseMirror.

A validação registrada usou dependências provisionadas fisicamente de uma instalação local preservada. Não demonstrou instalação limpa. Em um ambiente novo, a resolução pelo lockfile deve ser tratada como preparação ainda não validada; não usar `--force`, alterar versões ou recuperar dependências dos consumidores removidos para ocultar incompatibilidades. Esta documentação não anuncia um pacote npm correspondente à branch.

## Testes e builds

A partir da raiz, com as dependências já disponíveis:

```sh
npm test
npm run build
```

`npm test` executa somente `test:unit` (Vitest); o build encadeia Core e Presentation. Comandos explícitos equivalentes para o ciclo documentado:

```sh
node ./node_modules/vitest/vitest.mjs run --reporter=verbose
node ./node_modules/vite/bin/vite.js build -c vite.config.lib.ts
node ./node_modules/vite/bin/vite.js build -c vite.config.presentation.ts
```

As configurações de build geram bundles e declarações via plugin DTS. Isso não equivale a uma campanha independente e completa de checagem de tipos. `node_modules/`, caches e `dist/` são artefatos locais, não fontes do produto.

## Live Demo e checker

As [instruções atuais da Demo](../examples/live-demo/NOTES.md) cobrem servidor, URL, cenários e dependências de browser. A Demo importa `src/`, não um pacote histórico. Os processos escrevem caches e usam perfil temporário de navegador; a sessão visual é uma verificação distinta do checker headless.

Não confundir `freshLayoutRound` com `idempotent`. Os resultados negativos e violações devem ser lidos mesmo quando o checker termina com código zero. Veja [limitações](limitations.md).

## E2E históricos

O script `test:e2e` ainda aponta para `tests/e2e/pagination-stress.spec.cjs`. Não constitui um fluxo atual autônomo: os scripts históricos usam servidor na porta 8543, alguns dependem do antigo `vanilla-consumer` e incluem destinos de captura locais. Há verificações por diferença de comprimento JSON e tratamentos de erro que não constituem oráculo semântico completo.

Não usar esses procedimentos como receita de inicialização da Demo atual nem presumir sua aprovação a partir da suíte unitária. A revisão dos runners é uma tarefa separada; não exige restaurar exemplos ou testes deliberadamente removidos.

## Evidências já registradas

No ciclo CONS-014, a candidata teve 118 testes aprovados em 11 arquivos e builds Core/Presentation concluídos. O checker posterior observou `mini`, `p:370` e `p:600`; a sessão manual do usuário foi favorável em alcance exploratório. Essas evidências não aprovam idempotência, geometria geral, tabelas na Demo ou todas as versões de dependências. A suíte focal C-05 de outro workspace é independente.

## Contribuições e documentação

Preserve alterações preexistentes e identifique a base de cada mudança. Relate problema, arquivos alterados, verificações realmente executadas e limitações. Não descreva testes propostos como resultados nem converta observação manual em homologação geral. Os contratos operacionais antigos estão no [arquivo de governança](archive/README.md).

Use [API](api.md), [arquitetura](architecture.md), [limitações](limitations.md) e [backlog](backlog.md) para o estado vigente. Relatórios datados são fontes históricas, não especificações permanentes. A licença do projeto é [MIT](../LICENSE).
