# Limitações

Referência: linha `dev/cons014-composed-20261022`, commit `1962cdbb3456cc989b064017137d48a8df143d3d`. Estas ressalvas descrevem o estado conhecido; documentação organizada não constitui homologação geral.

## Implementação e contratos

- **Reatividade delimitada:** o hook da extensão compara referência, tamanho e estrutura de quantidade/tipos de nós, além de `settingsChanged`. Não compara genericamente texto, marcas ou atributos por `doc.eq()`. Mudanças de mesmo tamanho podem alterar medidas sem satisfazer o predicado. A suíte focal C-05 de outro workspace não certifica essa implementação. Veja [API](api.md).
- **Mudanças externas:** CSS, fontes tardias, escala e outros efeitos do DOM não são cobertos universalmente pelo reagendamento transacional. A estabilização observada não é permanente.
- **Composição:** Core e Presentation são separados. Não há factory pública de editor completo, insets automáticos ou bridge pública de composição. O consumidor coordena montagem e descarte.
- **Tabelas:** políticas do Core trabalham em fronteiras de linhas. Linhas/células e rowspans que exigem fragmentação intralinha podem produzir `TABLE_INTRAROW_UNSUPPORTED`. Não há garantia geral para tabelas arbitrárias.
- **Impressão/multi-instância:** `preparePrintSession` usa classe global no body e lock de sessão. Não é geração de PDF nem certificação de impressão composta, coexistência de editores ou equivalência com renderizadores externos.
- **Browser:** medição depende de DOM, CSS e fontes. SSR não substitui paginação visual. Não há certificação geral de navegadores.
- **Dependências:** peers declaram Tiptap 2/3, mas isso não certifica todos os minors ou um singleton global ProseMirror. O ambiente ensaiado misturava Core/PM 2.27.3 e StarterKit 3.31.4. Instalação limpa e matriz ampla permanecem sem comprovação nesta etapa.

## Resultado conhecido do checker da Demo — CONS-014, 22/10/2026

| Cenário | Páginas | Quebras | `freshLayoutRound` | `idempotent` | Violações geométricas |
|---|---:|---:|---|---|---:|
| `mini` | 5 | 4 | `true` | `false` | 3 |
| `p:370` | 31 | 30 | `true` | `false` | 19 |
| `p:600` | 50 | 49 | `true` | `false` | 60 |

Uma nova rodada de layout não prova igualdade entre rodadas. O checker reportou diagnósticos vazios e última linha na última página nesses cenários, mas isso não elimina as violações nem certifica idempotência. O código de saída zero também não significa aprovação desses critérios. Houve um HTTP 404 de origem não identificada.

Há ressalva geométrica na proximidade do rodapé. A explicação histórica baseada em `coords.top` versus `coords.bottom` não estabelece, por si só, a causa de todas as violações. Não se declara geometria geral correta nem se reduz toda divergência a uma tolerância aprovada.

## Demo e observação manual

A Demo atual monta texto linear, títulos e quebra manual com nós definidos no consumidor. Os cenários tabulares `PE-S`, `PE-M` e `PE-L` estão indisponíveis por ausência das extensões correspondentes no ambiente provisionado; sua seleção recai em `mini` com aviso. Isso delimita o consumidor, não elimina os mecanismos tabulares da biblioteca.

O usuário relatou avaliação favorável com aproximadamente 49 e 472 páginas, edição posterior e ausência de travamento observado. Houve lentidão em centenas de páginas. Não é benchmark controlado nem prova de ausência de defeitos. Duas inconsistências visuais anteriores não foram reproduzidas conclusivamente e permanecem sem conclusão definitiva.

## Evidências e pendências históricas

Os 118 testes da candidata e os builds registrados não substituem geometria real, validação tabular, impressão ou a suíte focal independente de C-05. Alegações de outros totais de testes, versões ou consumidores nos relatórios arquivados pertencem àqueles cortes.

O modelo de capacidade e os validadores estruturais não provam suficiência universal do orçamento, recuperação de toda quebra obsoleta ou associação tabular em qualquer DOM. Políticas para situações sem corte elegível e overshoot permanecem delimitadas. Abortos por inconsistência podem manter aguardantes de estabilidade pendentes.

Ressalvas do CONS-013, do Checkpoint 0 e da Fase 1 não foram encerradas pela consolidação local ou pelo push da branch. Registros do laboratório não são dependências da biblioteca nem condição para adaptar o produto ao consumidor antigo. Veja [backlog](backlog.md), [proveniência](provenance.md) e [arquivo histórico](archive/README.md).
