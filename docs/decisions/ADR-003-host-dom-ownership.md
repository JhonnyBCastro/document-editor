# ADR-003: Host DOM Ownership e Isolamento do ChromeLayer

## Status
Aceito (CONS-008)

## Contexto
Durante o desenvolvimento das primeiras distribuições do `document-editor`, a extensão de paginação injetava o cabeçalho e rodapé visuais das páginas (`ChromeLayer`) dependendo obrigatoriamente da existência de um elemento de identificador `#chrome-layer` previamente configurado pelo host no DOM global do navegador (`document.getElementById('chrome-layer')`).

Esse acoplamento gerava várias limitações arquiteturais:
1. Impedia a execução de múltiplas instâncias do editor na mesma página, pois todas tentariam escrever no mesmo elemento global.
2. Transferia para o consumidor a responsabilidade de criar a estrutura DOM que pertencia, conceitualmente, ao isolamento visual da extensão.
3. Violava a independência do produto (ADR-002), assumindo que o ambiente consumidor adotava a topologia específica estabelecida pelo antigo laboratório experimental.

## Decisão
1. **Contrato de Montagem Dinâmico**: A extensão `PaginationExtension` agora gerencia autonomamente o seu contêiner visual de cabeçalho e rodapé. Caso não seja fornecida nenhuma referência externa, o `PaginationController` instancia dinamicamente o `ChromeLayer` como um `div.document-editor-chrome-layer` posicionado adjacente (irmão) ao contêiner `view.dom` associado à respectiva instância `EditorView`.
2. **Propriedade (Ownership) Clara**:
   - Elementos criados pelo controlador são removidos definitivamente do DOM durante a execução do método `destroy()`.
   - Elementos fornecidos explícitamente pelo host (por intermédio da chave opcional `chromeLayerElement` em `PaginationOptions`) **não são removidos** pelo controlador no `destroy()`; apenas o seu conteúdo (innerHTML) é purgado.
3. **Escopo DOM Local**: Consultas globais (`document.getElementById`) foram descontinuadas do controlador para os overlays, assegurando que o `ChromeLayer` pertencerá exclusivamente ao escopo da sua respectiva instância do `document-editor`.

## Consequências
- **Positivas**:
  - Elimina dependências não declaradas com o DOM global.
  - Abre caminho estrutural seguro para a implementação futura de suporte multi-instância (P2).
  - Melhora a DX para o usuário consumidor, que não precisará mais decorar a topologia exata com IDs "mágicos", funcionando de forma "plug and play".
- **Negativas / Limitações Conhecidas**:
  - A simulação do modo de impressão continua acoplada globalmente (`document.body.classList.add('print-mode')`), sendo esse o único resíduo documentado de manipulação DOM não restrita ao escopo da instância, pois a impressão no navegador tem natureza estruturalmente global e exige ocultamento forçado do layout do host hospedeiro.
