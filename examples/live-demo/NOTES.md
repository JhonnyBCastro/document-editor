# Live Demo — instruções atuais

Exemplo de desenvolvimento com dois fluxos: **Coordenado V1**, via `createDocumentEditor({ host, ... })`, e **Manual**, via Editor, PaginationExtension e Presentation. Todos os imports da biblioteca usam o nome público do pacote e os subpaths exportados, incluindo CSS. A autorreferência resolve para os artefatos já existentes em `dist/` deste checkout; não há alias para `src/`, import de fixtures internas ou instalação por tarball neste Demo. Isso não substitui o consumidor independente V1, cuja validação permanece encerrada com ressalvas.

## Pré-requisitos e execução

São necessários Node, Vite, Tiptap Core/PM e artefatos `dist/` que contenham as entradas públicas e suas declarações. Consulte [desenvolvimento](../../docs/development.md) antes de preparar um ambiente novo. Se os artefatos estiverem ausentes ou desatualizados em relação às fontes, o Demo não comprova o código-fonte atual: será necessária uma preparação separada do build da biblioteca.

A partir da raiz, com as dependências já disponíveis:

```sh
node ./node_modules/vite/bin/vite.js examples/live-demo --config examples/live-demo/vite.config.ts --host 127.0.0.1 --port 8544
```

Acesse `http://127.0.0.1:8544/`. O seletor escolhe o fluxo; **Recriar editor** descarta a instância anterior e monta novamente o conteúdo linear. Edite diretamente na folha. A configuração mantém porta estrita, deduplicação dos módulos Tiptap/ProseMirror e cache em `node_modules/.vite-live-demo-8544`. `DEMO_PORT` altera a porta configurada e o sufixo do cache. Encerre o servidor ao terminar. Nenhum comando instrui instalação automática.

## Conteúdo e relação com os exemplos públicos

O schema mínimo usa `Node.create` para documento, parágrafo, texto, títulos e quebra manual. Não usa StarterKit. No ambiente local observado em 29/10/2026, Core/PM eram 2.27.3 e StarterKit 3.31.4; esta manutenção não altera nem certifica essa combinação. PE-S/M/L são tabulares e aparecem como opção indisponível, sem substituir silenciosamente a escolha por outro conteúdo. A importação antes inutilizada das fixtures de testes e as regras CSS de tabelas foram removidas; cenários tabulares continuam fora do Demo.

O fluxo coordenado exemplifica `options.host`, schema sem PaginationExtension duplicada, footer síncrono, atualização por `instance.editor.commands.setContent()` e descarte por `instance.destroy()`. O manual deriva layout dos defaults públicos, encaminha snapshots a `presentation.render()` e descarta os dois componentes. O CSS da aplicação coloca o texto editável acima das folhas decorativas; o modo manual também aplica largura e margens antes da montagem. Esse estilo da aplicação é necessário para a demonstração visual e não cria um novo contrato da biblioteca.

Os trechos selecionados do [README](../../README.md#composição-coordenada-v1--exemplo-proposto) e do [Quick Start](../../docs/quick-start.md#composição-coordenada-v1--exemplo-proposto) foram confrontados com tipos, exports e os dois fluxos do Demo. Imports públicos, `options.host`, footer, atualização e descarte têm correspondência. O schema e o CSS são adaptações do Demo: **os exemplos completos que usam StarterKit permanecem propostos, sem execução literal demonstrada por esta manutenção**. A receita manual histórica conserva a identidade do seu próprio tarball.

## Verificação focal desta manutenção — 29/10/2026

- Checagem TypeScript do `main.ts`, por executável local: aprovada.
- Build Vite somente do Demo, com saída separada em diretório temporário: aprovado. Não houve rebuild da biblioteca.
- Navegação automatizada em Chrome 154.0.8037.57: nos dois fluxos, 5 folhas e 5 footers iniciais; após substituição, 1 folha e footer “Página 1 de 1”; texto visível e edição por teclado observados, sem erros de página ou HTTP no recorte. Capturas inspecionadas separadamente; isso não equivale a uma sessão manual exploratória pelo usuário.
- Não houve instalação, execução do checker histórico, nova campanha de geometria/lifecycle, commit, push ou publicação. As evidências e comandos desta manutenção ficam em relatório separado; não substituem resultados negativos anteriores.

## Checker histórico — uso separado

O arquivo `check.cjs` foi preservado. Usa `puppeteer-core` local e Chrome do sistema em `/usr/bin/google-chrome`, sem download automático. Com o servidor ativo:

```sh
BASE=http://127.0.0.1:8544/ SCENARIOS=mini node examples/live-demo/check.cjs
```

Seu padrão completo é `mini,p:370,p:600`; os sintéticos são configurados pelo próprio checker. Ele usa a ponte de inspeção da aplicação `window.__editor`/`window.__snap` e acessa o controlador interno: **não é exemplo de consumo exclusivamente público nem critério novo de aprovação**. Não foi executado nesta manutenção. O retorno zero pode acompanhar resultados desfavoráveis. A ampliação dos testes exige escopo posterior próprio.

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
