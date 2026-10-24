# Backlog

Estado documental da linha `feature/compose-next`, referência `1c3b5add4ec8201ff176d67fd83f6677502cdd1d` (antes desta edição). Esta lista separa implementação, evidência e trabalho futuro; não reabre automaticamente decisões encerradas.

## Implementado

- Core/Presentation separados e modo único `composed`; rejeição de outros modos e remoção de `chromeLayerElement`.
- Ownership transacional de decorações no plugin, bridge interna e remapeamento.
- Recorrência de capacidade e validação de carriers/decisões estruturais.
- Reatividade por tamanho/estrutura e sinal de configuração, com os limites descritos na [API](api.md).
- Live Demo independente dos consumidores removidos, com texto linear, títulos e edição; cenários tabulares explicitamente indisponíveis.
- Linha de desenvolvimento consolidada localmente e enviada ao remoto, preservando a proveniência canônica e experimental.

- Quick Start de pacote com schema, imports públicos, composição manual, CSS e descarte; sem factory implementada. O README contém a receita integrada mesmo quando os guias não acompanham o tarball.

## Observado com validação limitada

- 118 testes em 11 arquivos e builds Core/Presentation aprovados no ciclo da candidata; não repetidos na edição documental.
- Checker executado em três cenários lineares, com `freshLayoutRound: true`, mas `idempotent: false` e violações geométricas.
- Sessão manual favorável, inclusive documento de aproximadamente 472 páginas; lentidão observada, sem benchmark ou homologação geral.
- Reavaliação das duas inconsistências visuais anteriores sem reprodução conclusiva. Não registrar como correção comprovada.

- Consumidor focal do tarball com tsc e bundle separados; TS2882 reproduzido e eliminado pela declaração de assets ativa, sem desativar a checagem. Montagem integrada/isoladas e descarte observados em alcance delimitado; novo 404 sem origem determinada.
- Merge parcial aninhado preserva defaults no runtime Tiptap 3.32.0, mas os tipos atuais exigem layout completo. Isso não equivale a suporte público DeepPartial.

## Planejado ou pendente

1. Investigar idempotência negativa, violações geométricas e HTTP 404 com hipótese e escopo próprios; sem atribuição causal antecipada.
2. Delimitar e validar reatividade de mudanças de texto, marcas e atributos com tamanho constante na linha atual. A tarefa focal C-05 permanece independente.
3. Tornar instalação e execução reproduzíveis: esclarecer o grafo Tiptap/PM, versões ensaiadas, dependências da Demo e consumo externo do pacote. Não restaurar consumidores obsoletos.
4. Disponibilizar cenários tabulares na Demo por decisão própria, preservando os limites intralinha e de rowspan.
5. Ampliar validação de orçamento, recuperação de `STALE_BREAK`, associação estrutural tabular e mapeamento linha visual/intervalo PM (pendências N2–N5 do CONS-013). A recorrência algébrica não fecha a integração geométrica.
6. Decidir o comportamento sem corte elegível (L1) e de overshoot sem fronteira anterior (L2), sem confundir essas escolhas com ressalvas de rodapé ou impressão.
7. Revisar especificação externa de uma factory opcional: normalização inicial, insets, schema da aplicação, ownership e descarte. Nenhuma factory ou atualização dinâmica de layout foi implementada. Fontes/CSS externos, multi-instância e impressão composta continuam tarefas separadas.
8. Revisar runners E2E históricos antes de propô-los como fluxo atual: pré-requisitos, comparação semântica, propagação de falhas e saídas portáteis.

## Fora de qualquer aprovação automática

Publicação de pacote, nova versão, compatibilidade universal e homologação completa exigem evidência e decisão próprias. O laboratório histórico deve adaptar seus consumidores ao contrato atual quando pertinente; sua desatualização não bloqueia o desenvolvimento da biblioteca.

Veja [limitações](limitations.md), [desenvolvimento](development.md) e [história](project-history.md).
