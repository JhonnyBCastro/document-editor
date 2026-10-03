# Arquitetura

O `document-editor` baseia-se na separação total entre o **Documento Semântico** e a **Paginação Visual** (abordagem batizada de "Rota B" nos experimentos históricos).

## Paginação por Decorations
A extensão avalia geometricamente o documento montado no DOM pelo navegador. Utilizando os tamanhos reais dos elementos (`offsetHeight`, `getClientRects`), o `PaginationController` fragmenta o layout inserindo **Decorations do ProseMirror**.
Para o texto linear (parágrafos), utiliza `Decoration.widget` para inserir o espaço em branco da quebra (`div`).
Para as tabelas, utiliza **também `Decoration.widget`**, mas injetando um elemento `<tr>` virtual contendo um `<td>` e a classe `virtual-page-spacer` entre as linhas reais da tabela. O espaçador aumenta o deslocamento visual sem corromper a tabela, suportando `colspan` adaptado à largura da tabela. Não quebra células intralinha (como `rowspan` ou textos gigantes).

## O Controlador (`PaginationController`)
- **Separação do Schema Manual:** A definição semântica do nó manual pertence ao schema (ProseMirror Node) do consumidor. A identificação desse nó pelo Controlador é meramente configurável (via `manualBreakNodeName`), garantindo que o document-editor atue apenas orquestrando políticas visuais, e delegando a responsabilidade de persistência e extensão propriamente dita ao dono do projeto.
- **Regras de Progresso e lastBreakPos:** A regra atesta que uma fronteira escolhida pode recuar em relação ao cursor geométrico que encontrou o overflow (por exemplo, retrocedendo a linha para não quebrar uma viúva/órfã ou retrocedendo para o início da tabela), **desde que avance em relação à última quebra confirmada (`lastBreakPos`)**. Se não avançar, o algoritmo avança forçadamente para evitar loops infinitos.
- **whenLayoutStable:** Promise central para notificar aos consumidores e testes quando a paginação terminar as operações em idle.
- **Isolamento de Contêineres (ChromeLayer):** A projeção de cabeçalhos e rodapés de cada página é feita em uma camada sobreposta independente. Para manter estrito isolamento arquitetural e viabilizar instâncias simultâneas, o `PaginationController` instancia autonomamente o contêiner DOM (`.document-editor-chrome-layer`) em escopo restrito à sua hierarquia do host, sem fazer uso de IDs globais, garantindo desconstrução segura no ciclo `destroy()`.

## Print Contract (`preparePrintSession` / `restore`)
Para compatibilidade com exportadores do navegador (PDF via print), a biblioteca exporta a API `preparePrintSession`. A sequência realizada é:
1. Preservação da configuração `LayoutConfig` original.
2. Preparação do layout de impressão neutralizando as margens inter-páginas (`pageGap = 0`).
3. Adição do efeito global `document.body.classList.add('print-mode')`.
4. Iniciação do `reflow` forçado com a nova configuração.
5. Espera pela estabilização da paginação (`await controller.whenLayoutStable()`).
6. Disponibilização do `LayoutSnapshot` final.
7. O consumidor realiza a impressão, e em seguida chama `restore()`, que revoga a classe global e restaura as dimensões da configuração original.

> **Importante:** O consumidor não deverá interpretar `preparePrintSession` como um serviço que gera o PDF diretamente. A biblioteca prepara o layout visual; a exportação propriamente dita pertence ao navegador ou adaptador externo. A exportação oficial institucional backend continua utilizando o formato OpenPDF a partir do JSON semântico isolado.
