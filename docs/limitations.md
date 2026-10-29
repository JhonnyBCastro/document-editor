# Limitações

Referência de código inspecionado: `feature/compose-next`, HEAD `f7f1e617fae73394011cc332f6e1c4b59e5be8f7`. A árvore `src/` não apresenta diferenças em relação ao commit `1c3b5add4ec8201ff176d67fd83f6677502cdd1d`. Os registros de validação pertencem aos respectivos ensaios e não foram reexecutados nesta revisão. Estas ressalvas não constituem homologação geral.

## Implementação e contratos

- **Reatividade delimitada:** a detecção documental exige mudança de referência e, então, mudança de tamanho ou diferença segundo `Node.eq`. Alterações de texto, marcas ou atributos podem agendar cálculo mesmo com tamanho e estrutura preservados. Documento equivalente, seleção pura e publicação neutra não implicam novo agendamento sem outro sinal. Isso não observa mudanças externas de geometria nem garante prazo de estabilização ou ausência de travamentos. Veja [API](api.md#atualização-e-reatividade).
- **Mudanças externas:** CSS, dimensões e recursos assíncronos podem mudar a geometria sem disparar recálculo. Não há observação contínua de resize, mutações DOM ou imagens. A espera por fontes ocorre quando uma rodada encontra carregamento em curso, sem garantir atualização após carregamentos posteriores.
- **Estabilidade:** quando o controller está ocioso, `whenLayoutStable(editor)` agenda cálculo; com timer ou cálculo ativo, não garante uma rodada adicional. Abortos, erros ou destruição podem deixar aguardantes pendentes, sem implicar que toda pendência seja permanente. Um snapshot também pode conter paginação parcial diagnosticada. Veja [snapshots e estabilidade](api.md#snapshots-e-estabilidade).
- **Composição:** a montagem manual mantém as responsabilidades da aplicação. A factory opcional assume a montagem inicial e os recursos próprios nos limites da [API](api.md#composição-coordenada-opcional); não oferece atualização dinâmica de layout, adoção de Editor existente ou observação geral de recursos externos. `presentation.render(snapshot)` não recalcula paginação. A montagem não certifica geometria geral, zoom ou transformações.
- **Tabelas:** as políticas procuram fronteiras de linhas, sem fragmentação intralinha geral. Podem emitir `TABLE_INTRAROW_UNSUPPORTED` ou `ROWSPAN_GROUP_EXCEEDS_PAGE` conforme a estrutura e as medidas encontradas. Não há garantia geral para tabelas arbitrárias; o nome do diagnóstico não comprova sozinho a causa física de uma ocorrência.
- **Conteúdo personalizado:** um schema válido não garante o tratamento especializado de todos os nós. Não há contrato geral de fragmentação para imagens, NodeViews ou blocos indivisíveis maiores que a área útil. As convenções reconhecidas e os limites estão na [API](api.md#conteúdo-e-schema-reconhecidos).
- **Impressão/multi-instância:** `preparePrintSession` usa classe global no body e lock de sessão. Não é geração de PDF nem certificação de impressão composta, coexistência de editores ou equivalência com renderizadores externos.
- **Browser:** medição depende de DOM, CSS e fontes. SSR não substitui paginação visual. Não há certificação geral de navegadores.
- **Dependências:** peers declaram Tiptap 2/3, mas isso não certifica toda a faixa nem uma única instância de cada módulo ProseMirror. As versões utilizadas e os limites dos ambientes estão em [desenvolvimento](development.md#ambiente-e-instalação); uma declaração de compatibilidade não equivale a uma matriz testada.

## Consumo de pacote e tipagem

- **Imports CSS:** os subpaths CSS existem no artefato identificado pelo [Quick Start](quick-start.md). O ambiente TypeScript precisa reconhecer imports de assets quando sua configuração os verifica; no exemplo Vite, use a declaração `vite/client` indicada no guia. Essa recomendação não é uma solução universal para outros bundlers ou configurações. Um bundle Vite bem-sucedido não comprova aprovação do TypeScript. O erro de tipagem observado não demonstrou ausência física dos CSS nem defeito do pacote.
- **Configuração aninhada:** a exigência de `LayoutConfig` completo pertence ao uso direto do Core. A factory aceita o subconjunto parcial aprovado de `layout.page`, não DeepPartial de toda a configuração. O caso histórico TS2740 está na [API](api.md#configuração-parcial-limite-dos-tipos-atuais).
- **Instalação e formatos:** a verificação focal com dependências previamente resolvidas não comprovou instalação limpa do manifesto de exemplo. `/compose` é ESM exclusivo; as quatro entradas preexistentes mantêm seus formatos. Peers declarados não equivalem a matriz testada da nova camada. A homologação técnica é limitada ao escopo autorizado e aos ambientes verificados; não encerra as ressalvas históricas gerais. CommonJS/UMD e matrizes amplas de versões não foram revalidados.

Os detalhes de configuração TypeScript, TS2882, comandos e resultados separados de tipos, bundle e browser estão em [desenvolvimento](development.md#experimento-do-pacote-tipos-bundle-e-browser). A identidade do tarball está no Quick Start; seu número de versão não identifica sozinho o estado da branch.

## Registros de validação e seu alcance

### Checker da Demo — registro de 22/10/2026

Valores preservados do registro existente, não resultados de uma nova execução:

| Cenário | Páginas | Quebras | `freshLayoutRound` | `idempotent` | Violações geométricas |
|---|---:|---:|---|---|---:|
| `mini` | 5 | 4 | `true` | `false` | 3 |
| `p:370` | 31 | 30 | `true` | `false` | 19 |
| `p:600` | 50 | 49 | `true` | `false` | 60 |

No [checker](../examples/live-demo/check.cjs), `freshLayoutRound` verifica `second !== first`. Quando as referências são distintas, `idempotent` compara assinaturas das quebras com posição, deslocamento arredondado a duas casas decimais, renderer e origem; não compara o snapshot inteiro. Sem outro snapshot, o checker registra `n/a(no-recalc)`. Essas definições foram conferidas no instrumento; os valores históricos da tabela não foram reproduzidos nesta etapa.

Receber outro snapshot não comprovou idempotência nem ausência de violações nos ensaios registrados. `idempotent: false` não identifica, por si só, uma causa física das violações. Diagnósticos vazios, última linha na última página e retorno zero do processo não eliminam as violações nem certificam a geometria.

Há ressalva geométrica na proximidade do rodapé. A explicação histórica baseada em `coords.top` versus `coords.bottom` não estabelece, por si só, a causa de todas as violações. Não se declara geometria geral correta nem se reduz toda divergência a uma tolerância aprovada.

### Demo e observação manual

A Demo atual monta texto linear, títulos e quebra manual com nós definidos pelo consumidor. Os cenários tabulares `PE-S`, `PE-M` e `PE-L` estão explicitamente indisponíveis nessa montagem; sua seleção recai em `mini` com aviso. Isso delimita a Demo, não elimina as políticas tabulares do Core nem afirma ausência dessas dependências em todo ambiente possível.

O usuário relatou avaliação favorável com aproximadamente 49 e 472 páginas, edição posterior e ausência de travamento observado. Houve lentidão em centenas de páginas. Não é benchmark controlado nem prova de ausência de defeitos. Duas inconsistências visuais anteriores não foram reproduzidas conclusivamente e permanecem sem conclusão definitiva.

### Consumo independente e ocorrências sem diagnóstico

Os registros de consumo descrevem montagem, edição e descarte em alcance delimitado. A remoção dos elementos observados não constitui auditoria exaustiva de memória; as contagens de páginas de conteúdos e execuções diferentes não constituem benchmark.

Há registros de HTTP 404 de origem não identificada na Demo e no consumidor focal. Não há evidência para atribuí-los ao pacote, identificá-los como a mesma ocorrência ou declará-los resolvidos. O relato de console sem erros pertence a outra execução. Veja [desenvolvimento](development.md#experimento-do-pacote-tipos-bundle-e-browser) para o registro do consumidor.

## Pendências e referências

O modelo de capacidade e os validadores estruturais não provam suficiência universal do orçamento, recuperação de toda quebra obsoleta ou associação tabular em qualquer DOM. A correspondência entre linhas visuais e posições documentais, assim como as políticas para situações sem corte elegível e overshoot, permanece sujeita às pendências registradas no [backlog](backlog.md#planejado-ou-pendente).

Resultados unitários, builds e observações manuais não substituem validação geométrica, tabular ou de impressão. Totais de testes e validações de outros workspaces pertencem aos respectivos cortes: veja [evidências registradas](development.md#evidências-já-registradas) e [proveniência](provenance.md#evidências-e-alcance).

As ressalvas históricas não foram encerradas pela consolidação local ou pelo push. Seus identificadores e vínculos permanecem em [proveniência](provenance.md), [backlog](backlog.md) e [arquivo histórico](archive/README.md). Registros do laboratório não são dependências da biblioteca nem exigem restaurar consumidores antigos.
