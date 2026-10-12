# Backlog vigente

Corte12/10/2026. Versão declaradaRC4, working tree de consolidação não publicada. RelatosRC1/RC2, ADRs e releases são históricos; resultados delimitados não equivalem a ausência de pendências críticas ou certificação universal.

## Implementado no escopo selecionado

- Liberação do handle renderTimeout ao consumir callback, preservando debounce; regressões core-stability.
- visualMode legacy/composed, defaultlegacy, validação sem fallback, seleção fixa e rejeição de chromeLayerElement no composto.
- B1: quatro arestas geométricas1px/solid transparent em composed, sem mudança de dimensões/compensações; regressões paint-mode.
- Fluxo de testes separado: npm test agoraunit apenas; E2E/build explícitos. Verificações próprias da integração e seus resultados são registrados externamente, sem promessa de sucesso antes de ocorrerem.

## Prioridades pendentes de produto

1. Contrato e implementação de composição oficial: factory/bridge, ownership/insets/layout único, atualização suportada, estabilidade e descarte. Consumidor experimental não cumpre esse marco por existência.
2. Cobertura de mudanças de conteúdo de mesmo tamanho, fontes/rolagem e lifecycle; estudar somente mediante decisão própria. Não redesenhar scheduler por arrumação de repositório.
3. Experiência visual e alcance de conteúdo/multipágina, anomalias de Presentation/tabelas/transições: causas abertas. Homologação/interação e Gate Vanilla pendentes.
4. Print composto e multi-instância, incluindo efeitos globais e cancelamento/disposers.
5. Instalação reprodutível dos exemplos atuais, separados de RC4 histórico/snapshot sintético; resolver manifesto/lock da Presentation somente sob seleção própria.
6. Toolchainunit/peers2/3 e grafoPM: esclarecer mistura StarterKit3/Core2 sem atualizar dependências/lock preventivamente. Sem promessa de singleton global.

## Manutenção/testes e organização futura

- Runnersbrowser: separar outputs, tratamento de falha/capture/cleanup e comparação semântica real em proposta específica; não alterar oráculos/tolerâncias silenciosamente.
- Auxiliares, .bak, tgz e evidências: classificação/recuperação e destinos dependem de decisão; nenhuma exclusão está autorizada pela consolidaçãoA.
- Fragmentação intralinha, coexistência de instâncias e publicação futura são recortes distintos, não metas cumpridas por unitários.

## Pendências de integração/evidência externas

M1/effectiveHeightProof=UNAVAILABLE, S e margens horizontais, contrato/evidênciaC e SLP-B-02/helper/teste, reservas de build/grafo/tipos/temporalidade continuam com seus responsáveis e alcances. Não incorporar avaliador, supervisores, autorizações ou dados do Lab ao produto. Não converter insuficiência de testemunha em aprovação nem reclassificar diferenças históricas.
