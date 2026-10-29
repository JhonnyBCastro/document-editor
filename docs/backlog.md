# Backlog

Base documental anterior: `feature/compose-next`, referência `1c3b5add4ec8201ff176d67fd83f6677502cdd1d`. Atualização focal em 27/10/2026: correção de reatividade presente no commit local `4f3577446204bf7f99848394e3b48b3136df6630`; push não verificado nesta revisão. Esta lista separa implementação, evidência e trabalho futuro; não reabre automaticamente decisões encerradas.

## Implementado

- Core/Presentation separados e modo único `composed`; rejeição de outros modos e remoção de `chromeLayerElement`.
- Ownership transacional de decorações no plugin, bridge interna e remapeamento.
- Recorrência de capacidade e validação de carriers/decisões estruturais.
- Reatividade por identidade, tamanho e igualdade documental (`Node.eq`), incluindo diferenças de texto, marcas e atributos com tamanho/estrutura preservados; mantido o sinal interno de configuração, com os limites descritos na [API](api.md).
- Live Demo independente dos consumidores removidos, com texto linear, títulos e edição; cenários tabulares explicitamente indisponíveis. Na manutenção de 29/10/2026, imports públicos por `dist/` local e fluxos coordenado/manual foram conferidos no recorte descrito nas [notas da Demo](../examples/live-demo/NOTES.md), sem validar literalmente os exemplos completos com StarterKit.
- Linha de desenvolvimento consolidada localmente e enviada ao remoto, preservando a proveniência canônica e experimental.

- Quick Start de pacote com schema, imports públicos, montagem manual histórica, CSS e descarte. O exemplo coordenado permanece proposto: sua execução literal não foi demonstrada pelo laboratório que validou o pacote.
- Composição Coordenada V1 implementada, revisada e homologada no escopo autorizado e nos ambientes verificados: `createDocumentEditor(options)`, `options.host`, interface mínima e entrada ESM `/compose`. Não inclui atualização dinâmica de layout.

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
3. Tornar instalação e execução reproduzíveis: esclarecer o grafo Tiptap/PM, versões ensaiadas, dependências da Demo e consumo externo do pacote. Não restaurar consumidores obsoletos.
4. Disponibilizar cenários tabulares na Demo por decisão própria, preservando os limites intralinha e de rowspan.
5. Ampliar validação de orçamento, recuperação de `STALE_BREAK`, associação estrutural tabular e mapeamento linha visual/intervalo PM (pendências N2–N5 do CONS-013). A recorrência algébrica não fecha a integração geométrica.
6. Decidir o comportamento sem corte elegível (L1) e de overshoot sem fronteira anterior (L2), sem confundir essas escolhas com ressalvas de rodapé ou impressão.
7. Se for autorizada uma nova etapa, verificar a execução literal das receitas documentais ainda propostas e ampliar ambientes ou condições somente com hipótese e escopo próprios. A validação do consumidor V1 está encerrada e não deve ser reaberta por este item. Instalação limpa de outros manifestos, fontes/CSS externos, multi-instância e impressão composta não recebem aprovação automática desse fechamento.
8. Revisar runners E2E históricos antes de propô-los como fluxo atual: pré-requisitos, comparação semântica, propagação de falhas e saídas portáteis.

## Fora de qualquer aprovação automática

Publicação de pacote, nova versão, compatibilidade universal e homologação completa exigem evidência e decisão próprias. O laboratório histórico deve adaptar seus consumidores ao contrato atual quando pertinente; sua desatualização não bloqueia o desenvolvimento da biblioteca.

Veja [limitações](limitations.md), [desenvolvimento](development.md) e [história](project-history.md).
