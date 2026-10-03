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
1. **Contrato de Montagem Dinâmico**: A extensão `PaginationExtension` agora gerencia autonomamente o seu contêiner visual interno de cabeçalho e rodapé (`div.document-editor-chrome-layer`).
2. **Propriedade (Ownership) e Filhos**:
   - A biblioteca cria exclusivamente a sua camada interna. Caso o consumidor não informe nada, esse elemento é posicionado dinamicamente como adjacente (irmão) ao contêiner `view.dom`.
   - Se o host fornecer explicitamente o ponto de montagem por meio da chave opcional `chromeLayerElement` no `PaginationOptions`, o controlador apenas fará o `appendChild` da sua camada interna para dentro desse contêiner do consumidor.
   - Durante a destruição (`destroy()`), apenas a camada interna (`.document-editor-chrome-layer`) é removida. O elemento externo fornecido pelo host permanece intocado, garantindo que nenhum conteúdo de terceiros seja deletado indevidamente.
3. **Escopo DOM Local**: Consultas globais (`document.getElementById`) foram descontinuadas do controlador para os overlays, assegurando que o `ChromeLayer` interno pertencerá ao escopo da sua respectiva instância do `document-editor`.

## Consequências
- **Positivas**:
  - Elimina dependências não declaradas com o DOM global.
  - Abre caminho estrutural seguro para a implementação futura de suporte multi-instância (P2).
  - Melhora a DX para o usuário consumidor, que não precisará mais decorar a topologia exata com IDs "mágicos", funcionando de forma "plug and play".
- **Negativas / Limitações Conhecidas**:
  - A simulação do modo de impressão continua acoplada globalmente (`document.body.classList.add('print-mode')`), sendo um resíduo documentado de manipulação DOM não restrita ao escopo da instância, pois a impressão no navegador tem natureza estruturalmente global e exige ocultamento forçado do layout do host hospedeiro.
