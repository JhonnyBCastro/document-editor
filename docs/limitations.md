# Limitações

Marco funcional pós-F3 utilizado como base desta consolidação documental (branch `main`): `977f106c2fcf46771f46ae3a40813ddbc24f1297`, tree `f961be2ebca7f675445fa9d765a1205d893b55ee` (após incorporação da linha `feature/compose-next` via Pull Request #3, consolidação da correção de widow prevention no commit `90cc59b`, iniciativa F3 via Pull Request #16, consolidação documental R2 via Pull Request #20 e manutenção pós-F3 via Pull Requests #21, #19 e #22). As ressalvas abaixo descrevem limites reais de arquitetura e contratos conhecidos da biblioteca.

## Implementação e contratos

- **Reatividade delimitada:** a detecção documental exige mudança de referência e, então, mudança de tamanho ou diferença segundo `Node.eq`. Alterações de texto, marcas ou atributos podem agendar cálculo mesmo com tamanho e estrutura preservados. Documento equivalente, seleção pura e publicação neutra não implicam novo agendamento sem outro sinal. Isso não observa mudanças externas de geometria nem garante prazo de estabilização ou ausência de travamentos. Veja [API](api.md#atualização-e-reatividade).
- **Mudanças externas:** CSS, dimensões e recursos assíncronos podem mudar a geometria sem disparar recálculo. Não há observação contínua de resize, mutações DOM ou imagens. A espera por fontes ocorre quando uma rodada encontra carregamento em curso, sem garantir atualização após carregamentos posteriores.
- **Estabilidade:** a condição ociosa, isoladamente, não é suficiente para garantir novo agendamento: quando o orçamento de recuperação por invalidação documental (limite de três invalidações por tentativa) se encontra esgotado, `whenLayoutStable(editor)` registra o aguardante sem reiniciar automaticamente o cálculo; com timer ou cálculo ativo, também não garante rodada adicional. Esgotamento do orçamento, abortos, erros ou destruição podem deixar aguardantes pendentes sem garantia universal de resolução espontânea ou prazo. A reinicialização do orçamento no limite histórico de três passes parcialmente estabilizados não significa convergência completa, e um snapshot pode conter paginação parcial diagnosticada. Veja [snapshots e estabilidade](api.md#snapshots-e-estabilidade).
- **Composição:** a montagem manual mantém as responsabilidades da aplicação. A factory opcional assume a montagem inicial e os recursos próprios nos limites da [API](api.md#composição-coordenada-opcional); não oferece atualização dinâmica de layout, adoção de Editor existente ou observação geral de recursos externos. `presentation.render(snapshot)` não recalcula paginação. A montagem não certifica geometria geral, zoom ou transformações.
- **Tabelas:** as políticas procuram fronteiras de linhas, sem fragmentação intralinha geral. Podem emitir `TABLE_INTRAROW_UNSUPPORTED` ou `ROWSPAN_GROUP_EXCEEDS_PAGE` conforme a estrutura e as medidas encontradas. Não há garantia geral para tabelas arbitrárias; o nome do diagnóstico não comprova sozinho a causa física de uma ocorrência.
- **Conteúdo personalizado:** um schema válido não garante o tratamento especializado de todos os nós. Não há contrato geral de fragmentação para imagens, NodeViews ou blocos indivisíveis maiores que a área útil. As convenções reconhecidas e os limites estão na [API](api.md#conteúdo-e-schema-reconhecidos).
- **Impressão/multi-instância:** `preparePrintSession` usa classe global no body e lock de sessão. Não é geração de PDF nem certificação de impressão composta, coexistência de editores ou equivalência com renderizadores externos.
- **Browser:** medição depende de DOM, CSS e fontes. SSR não substitui paginação visual. Não há certificação geral de navegadores.
- **Dependências:** peers declaram Tiptap 2/3, mas isso não certifica toda a faixa nem uma única instância de cada módulo ProseMirror. As versões utilizadas e os limites dos ambientes estão em [desenvolvimento](development.md#ambiente-e-instalação); uma declaração de compatibilidade não equivale a uma matriz testada.
- **Contrato CSS do consumidor (`CSS C-01`) e recuperação geométrica limitada:** a biblioteca não injeta `word-wrap: break-word`, `white-space: pre-wrap` ou `white-space: break-spaces` em `.ProseMirror`, nem `white-space: pre-wrap` em `.ProseMirror pre`; essas regras integram a responsabilidade do consumidor. Sem elas (braço de controle `baseline`), blocos `<pre>` não quebram automaticamente na largura útil e espaços colapsados podem retornar `{0,0,0,0}` ao DOM. Mesmo sob `CSS C-01`, permanecem os limites contratuais de recuperação em `findEquivalentValidCoords()` (faixas `{0,0,0,0}` irrecuperáveis produzem paginação parcial local com `LAYOUT_DEGENERATE_COORDS`), não havendo certificação geométrica universal para documentos arbitrários, zoom ou fontes externas.
- **Ciclos de convergência parcial (`LAYOUT_CONVERGENCE_LIMIT`) e coordenadas não finitas:** rodadas que permaneçam mutáveis ao atingir o teto fixo de `3` passes publicam snapshot parcialmente estabilizado acompanhado de `LAYOUT_CONVERGENCE_LIMIT`; na validação prática do Autor foram registrados `5` estados exportados com esse diagnóstico sem comprovação universal de recuperação posterior espontânea (`OBS-U05-01`). A correção do protocolo de publicação da candidata `T1-R2` (PR #22) trata invalidações documentais concorrentes durante `publish()` e não constitui solução demonstrada para essas cinco ocorrências históricas de convergência parcial da F3. Coordenadas não finitas (`NaN`/`Infinity`) interrompem o passe sem publicar snapshot.

## Consumo de pacote e tipagem

- **Imports CSS:** os subpaths CSS existem no artefato identificado pelo [Quick Start](quick-start.md). O ambiente TypeScript precisa reconhecer imports de assets quando sua configuração os verifica; no exemplo Vite, use a declaração `vite/client` indicada no guia. Essa recomendação não é uma solução universal para outros bundlers ou configurações. Um bundle Vite bem-sucedido não comprova aprovação do TypeScript. O erro de tipagem observado não demonstrou ausência física dos CSS nem defeito do pacote.
- **Configuração aninhada:** a exigência de `LayoutConfig` completo pertence ao uso direto do Core. A factory aceita o subconjunto parcial aprovado de `layout.page`, não DeepPartial de toda a configuração. O caso histórico TS2740 está na [API](api.md#configuração-parcial-limite-dos-tipos-atuais).
- **Instalação e formatos:** a verificação focal histórica com dependências previamente resolvidas não comprovou instalação limpa do manifesto de exemplo. A posterior validação do consumidor V1 verificou instalação e consumo de um tarball identificado no ambiente do laboratório; não valida automaticamente aquele manifesto histórico nem outros grafos de dependências. `/compose` é ESM exclusivo; as quatro entradas preexistentes mantêm seus formatos. Peers declarados não equivalem a matriz testada da nova camada. A homologação técnica é limitada ao escopo autorizado e aos ambientes verificados; não encerra as ressalvas históricas gerais. CommonJS/UMD e matrizes amplas de versões não foram revalidados.

Os detalhes de configuração TypeScript, TS2882, comandos e resultados separados de tipos, bundle e browser estão em [desenvolvimento](development.md#experimento-do-pacote-tipos-bundle-e-browser). A identidade do tarball está no Quick Start; seu número de versão não identifica sozinho o estado da branch.

### Consumidor V1 — alcance do encerramento de 29/10/2026

A validação foi encerrada com ressalvas no escopo autorizado e nos ambientes verificados, conforme os registros relacionados em [proveniência](provenance.md#validação-do-consumidor-v1--encerramento-de-29102026). O resultado se limita ao artefato e às versões registrados em [desenvolvimento](development.md#validação-do-consumidor-v1--29-de-outubro-de-2026), sem certificar universalmente a biblioteca ou os exemplos literais deste repositório.

CON-13 corresponde a 20 ciclos de edição/substituição e publicação, não montagem/desmontagem repetida nem auditoria de vazamentos. Em CON-14, os perfis Standard e Custom tiveram 121 asserções recalculadas pela Frente A a partir dos retângulos e modelos de caixa montados, com desvio máximo de 0 CSS px. A tolerância de até 1 CSS px é exclusiva desse ensaio; a análise de interferência externa se restringe aos fatores efetivamente observados nessa execução.

O encerramento do navegador e o fechamento do servidor Vite/143 após SIGTERM foram registrados. A mensagem interna de saída 0 não substitui um registro externo, pelo processo pai, do código de saída efetivo do supervisor; tal registro não consta dos artefatos examinados. Os resultados TypeScript/build pertencem aos logs contemporâneos do executor; a Frente A não os repetiu. A divergência entre `rc.4` no manifesto e `rc.2` no lockfile de origem permanece registrada separadamente da identidade do tarball, conferida pelo SHA-256 indicado em [proveniência](provenance.md#validação-do-consumidor-v1--encerramento-de-29102026).

A identificação de `/favicon.ico` como o 404 observado no laboratório V1 não estabelece a origem nem a resolução dos 404 históricos da Demo ou de outros consumidores. Os resultados negativos anteriores abaixo permanecem preservados.

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

### Iniciativa F3 — alcance das validações técnica e prática (`a0c92d57`)

As campanhas técnica (`M-00 a M-06` e `E-00 a E-04`) e prática pelo Autor (`U-02 a U-05`) sobre o commit `a0c92d5765a9832c5c03794e196fa23552fe0cbc` (tarball `0.1.0-rc.4` SHA-256 `cdce16900a...`) demonstraram correção funcional observada para os defeitos históricos de colagem (`erro-1`, `8` páginas, `7` quebras) e conversão `codeBlock -> paragraph` por `Backspace` (`TypeScript`, `16` para `18` páginas), mantendo as seguintes ressalvas rastreáveis sem constituir certificação geométrica universal:
- **Excedente sub-pixel em espaços finais de `codeBlock` (`I-02` / `CV-07`):** `12` ocorrências de `U+0020` ultrapassaram `usefulRight = 720 px` entre `2,140625 px` e `2,15625 px`, sem caractere visível excedente e sem rolagem horizontal além de `816 px`; esse comportamento observado não configura tolerância garantida em outros ambientes.
- **Braço de controle `baseline` (`CV-02` / `OBS-U05-02`):** embora tenha preservado as `7` decisões de quebra de `erro-1`, apresentou `LAYOUT_DEGENERATE_COORDS` em `pos = 180` e `pos = 6633` (paginação parcial local na sub-região degenerada), não comprovando ausência universal de inconsistências geométricas locais nem constituindo alternativa recomendada de integração.
- **Observação de experiência `UX-U03-01`:** relato não instrumentado de exposição transitória ocasional (`~3 a 4 s`) durante carregamento do fixture TypeScript antes da paginação definitiva; classificada como não bloqueante no escopo atual e de causa indeterminada.

### Manutenção pós-F3 — alcance e ressalvas da candidata `T1-R2` (`PR #22`, `977f106c`)

As validações dos ciclos `T1`, `T1-R1` e `T1-R2` e da preparação da PR #22 (tarball `0.1.0-rc.4` SHA-256 `63da938292df3ac6b577cf6d3b6be2bebc40d43e46912068189e719f09651d0a`, `35` arquivos) demonstraram o alinhamento de desenvolvimento em Tiptap `3.35.0` e a resolução focal dos três achados de compatibilidade v2/v3 preservando as seguintes ressalvas técnicas e probatórias:
- **Reprodução do orçamento residual:** o cenário determinístico de alternância entre publicações intermediárias válidas e invalidadas utilizou timers simulados, fila controlada de `requestAnimationFrame` e coordenadas instrumentadas, interrompido no teto externo de seis ciclos (não constituindo execução literalmente infinita).
- **Fronteiras de orçamento e aguardantes:** a reinicialização do orçamento ocorre também quando o snapshot parcialmente estabilizado é aceito no limite histórico de três passes (sem significar convergência completa), e aguardantes de `whenLayoutStable()` podem permanecer pendentes após esgotamento sem garantia de recuperação espontânea.
- **Geometria física delimitada:** as medições físicas via `Element.getBoundingClientRect()` (`0 px` de delta em Tiptap `2.27.3` e `3.35.0`) aplicam-se às superfícies e cenários medidos em Chromium headless, sem comprovar ausência universal de overflow ou equivalência entre versões distintas de navegador.
- **Segurança no consumidor Tiptap 2:** no consumidor independente Tiptap `2.27.3`, o `npm audit` registrou `1` advisory raiz em `@tiptap/core@2.27.3` (`mergeAttributes` `__proto__`) e `24` entradas propagadas (`0` vulnerabilidades no consumidor Tiptap `3.35.0`). A compatibilidade funcional demonstrada não elimina essa ressalva de segurança para consumidores na geração 2.
- **Tipos internos alcançáveis:** a preservação das APIs públicas documentadas e dos cinco subpaths de `exports` não equivale a identidade literal de todos os membros internos/privados alcançáveis nos arquivos `.d.ts` distribuídos.
- **Versão nominal e publicação:** a versão `0.1.0-rc.4` no manifesto não implica publicação no registro npm.

## Pendências e referências

O modelo de capacidade e os validadores estruturais não provam suficiência universal do orçamento, recuperação de toda quebra obsoleta ou associação tabular em qualquer DOM. A correspondência entre linhas visuais e posições documentais, assim como as políticas para situações sem corte elegível e overshoot, permanece sujeita às pendências registradas no [backlog](backlog.md#planejado-ou-pendente).

Resultados unitários, builds e observações manuais não substituem validação geométrica, tabular ou de impressão. Totais de testes e validações de outros workspaces pertencem aos respectivos cortes: veja [evidências registradas](development.md#evidências-já-registradas) e [proveniência](provenance.md#evidências-e-alcance).

As ressalvas históricas não foram encerradas pela consolidação local ou pelo push. Seus identificadores e vínculos permanecem em [proveniência](provenance.md), [backlog](backlog.md) e [arquivo histórico](archive/README.md). Registros do laboratório não são dependências da biblioteca nem exigem restaurar consumidores antigos.
