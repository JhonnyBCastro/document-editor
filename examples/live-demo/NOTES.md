# Live Demo — instruções atuais

Consumidor de desenvolvimento da linha `dev/cons014-composed-20261022`, referência `1962cdbb3456cc989b064017137d48a8df143d3d`. Importa diretamente Core e Presentation de `src/`; não valida a instalação externa de uma distribuição npm.

Esta Demo exercita montagem manual. A existência da factory opcional não exige sua conversão. Para `/compose`, consulte a [seção coordenada do Quick Start](../../docs/quick-start.md#composição-coordenada-v1--exemplo-proposto). A Demo e a fixture geométrica interna não substituem a validação de um pacote instalado em consumidor independente.

## Pré-requisitos e execução

A raiz precisa ter dependências compatíveis disponíveis, incluindo Vite, `@tiptap/core` e `@tiptap/pm`. O checker usa `puppeteer-core` e o Chrome do sistema em `/usr/bin/google-chrome`. Não baixa navegador automaticamente. A disponibilidade em outras máquinas não foi certificada. Veja [desenvolvimento](../../docs/development.md).

A partir da raiz do repositório, inicie o servidor:

```sh
node ./node_modules/vite/bin/vite.js examples/live-demo --config examples/live-demo/vite.config.ts --host 127.0.0.1 --port 8544
```

Acesse `http://127.0.0.1:8544/`. A configuração resolve aliases Tiptap pela raiz `node_modules/`, usa porta estrita e cache local `node_modules/.vite-live-demo-8544`. `DEMO_PORT` altera a porta configurada e o sufixo do cache; se usar outra porta, alinhe a URL do checker. Não são necessários o antigo consumidor ou um tarball RC.4.

Com o servidor ativo, em outro terminal na raiz:

```sh
BASE=http://127.0.0.1:8544/ node examples/live-demo/check.cjs
```

O padrão é `mini,p:370,p:600`. Para escolher um subconjunto:

```sh
BASE=http://127.0.0.1:8544/ SCENARIOS=mini node examples/live-demo/check.cjs
```

Esses comandos são instruções; não foram executados na organização documental. O servidor escreve cache na raiz provisionada e o navegador utiliza perfil temporário. Encerre o servidor ao terminar e preserve resultados fora dos arquivos do produto. Não há saída de screenshot configurada no checker atual; capturas e avaliação manual são etapas separadas.

## Conteúdo disponível

A Demo define nós básicos de documento, parágrafo, texto, título e quebra manual com `Node.create`, sem StarterKit. Ela monta Editor e Presentation e fornece o rodapé por callback.

Os cenários lineares e sintéticos estão disponíveis. `PE-S`, `PE-M` e `PE-L` são tabulares e estão indisponíveis: as extensões correspondentes não existem no runtime provisionado e o schema atual da Demo não as monta. A seleção desses cenários recai em `mini`, com indicação na interface. Não representa validação de tabelas nem remoção das políticas tabulares do Core.

## Como interpretar o checker

- `freshLayoutRound`: informa se foi observada uma nova rodada após a solicitação de recálculo.
- `idempotent`: compara assinaturas das quebras entre rodadas; não é sinônimo de rodada nova.
- `violations`: quantidade de retângulos de texto fora dos limites usados pelo checker.
- `diag` e `lastLineOnLastPage`: observações adicionais, sem equivalência com homologação geral.

O processo pode retornar zero com `idempotent: false` e violações; leia os campos, não apenas o retorno. No ciclo CONS-014 de 22/10/2026:

| Cenário | Páginas / quebras | `freshLayoutRound` | `idempotent` | Violações |
|---|---|---|---|---:|
| `mini` | 5 / 4 | `true` | `false` | 3 |
| `p:370` | 31 / 30 | `true` | `false` | 19 |
| `p:600` | 50 / 49 | `true` | `false` | 60 |

Também houve HTTP 404 sem origem identificada. A sessão manual posterior foi favorável em cenários exercitados, com lentidão em centenas de páginas; não concluiu a investigação das inconsistências visuais anteriores. Veja [limitações](../../docs/limitations.md).

## Histórico

As notas anteriores, inclusive procedimentos hoje removidos e comparações com RC.4, foram preservadas no [diário histórico da Demo](../../docs/archive/live-demo/experiment-notes.md). Seus resultados e comandos pertencem aos respectivos cortes. Consulte o [ADR composed-only](../../docs/decisions/ADR-004-composed-only.md) e a [proveniência](../../docs/provenance.md) para a linha atual.
