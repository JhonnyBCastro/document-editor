# Relatório de Consolidação: CONS-008 — Isolamento do ChromeLayer e Evolução do Contrato DOM do Host

## 1. Resumo da Atividade
- **Data:** 2026-10-03
- **Versão de Entrada:** `document-editor@0.1.0-alpha.4`
- **Versão de Saída:** `document-editor@0.1.0-alpha.5`
- **Baseline Comprovada:** Sim. `hybrid-pagination` e `pagination-stress` executados com sucesso (sem falhas e sem corrupção na quantidade geométrica de dados das tabelas, preservando `DataRows=151` e `Spacers=6`).

## 2. Problema Resolvido
O `document-editor` utilizava chamadas imperativas globais e hardcoded, notavelmente `document.getElementById('chrome-layer')`, para montar o overlay do cabeçalho e do rodapé virtuais. O host (`index.html` nos consumidores) era obrigado a instanciar previamente uma `<div id="chrome-layer"></div>`. 

Isso acoplava severamente a extensão de paginação e violava o princípio de "produto isolado", impedindo, inclusive, renderizações de múltiplas instâncias na mesma página.

## 3. Implementação
Foi definido o ADR-003: "Host DOM Ownership e Isolamento do ChromeLayer":
- **Configuração Genérica:** O `PaginationOptions` agora expõe o campo opcional `chromeLayerElement?: HTMLElement`.
- **Dinâmica Autogerida:** Se a configuração `chromeLayerElement` não for enviada pelo consumidor, o `PaginationController` instancia de forma inteligente uma tag `<div class="document-editor-chrome-layer"></div>` adjacente ao `view.dom` (Tiptap).
- **Ciclo de Vida (Ownership):** O construtor detecta de onde veio o elemento. Se foi criado pela própria biblioteca (`isChromeLayerOwner=true`), no método `.destroy()`, o nó DOM correspondente é expurgado integralmente. Se foi injetado via Host (`isChromeLayerOwner=false`), o `innerHTML` dele é limpo para evitar perdas estruturais no contêiner do desenvolvedor do produto (APPE).
- **Adequações de Style:** A folha de estilo `style.css` agora engloba adequadamente seletores compatíveis à classe `.document-editor-chrome-layer`. A classe `.page-chrome-gap` e as referências ao elemento obsoleto `#chrome-layer` foram normalizadas.

## 4. Omissão Consciente da Resolução Global `.print-mode`
Durante a auditoria DOM, identificou-se também as chamadas globais `document.body.classList.add('print-mode')`. Estas não foram refatoradas propositalmente. O CSS global de folha de estilo `@media print` demanda supressões e ocultações a nível global do viewport, o que extrapola os limites da restrição semântica de "múltiplas instâncias" temporárias, sendo mantida a sua permanência restritiva relatada na seção "Limitações Conhecidas" do ADR-003.

## 5. Pendência Resolvida
Durante a Etapa A, a pendência identificada na atividade anterior (referente à ausência de testes customizados do consumidor simulando o schema particular do projeto em Tiptap 3) foi resolvida. O `consumer-d-custom` foi configurado e aprovado em testes unitários, estressando e atestando as adaptações de nó de quebra manual parametrizado sem a menor corrupção. O documento `.antigravity-context.md` também foi expurgado de descrições desatualizadas e equivocadas referindo-se aos espaçadores visuais como "Decoration.node", restabelecendo que são gerados por "Decoration.widget".

## 6. Fechamento e Endurecimento (CONS-008-F)
A revisão da CONS-008 demonstrou uma vulnerabilidade na atribuição do controle DOM: quando o consumidor informava a `div` externa, o Controlador limpava apenas seu `innerHTML`. A versão `.alpha.6` corrigiu isso definindo que a biblioteca sempre criará um `<div class="document-editor-chrome-layer">` proprietário, que será anexado como filho caso o host providencie o `chromeLayerElement`.

- **Testes de Isolamento e Propriedade:** Foi adicionado o teste E2E Puppeteer (`test-isolation.cjs`) aos laboratórios verificando a destruição de componentes. O elemento externo fornecido não é mais afetado pelo ciclo `destroy()` do editor.
- **Limitações de Posicionamento Descobertas:** Observou-se a regra rígida de css da Rota B. Se o elemento raiz `.tiptap` possuir distorções de margens dentro de seu contêiner `position: relative`, as bordas absolutas falharão no alinhamento. A restrição foi documentada explicitamente em `limitations.md`.
- **STALE_BREAK auditada:** Foi corrigida a documentação em `limitations.md` afirmando de forma precisa que `STALE_BREAK` não recua o `lastBreakPos`, mas avança forçadamente o ponteiro de exploração `pos += 1` em caso de paralisação.
- **Versão Final de Entrega:** `document-editor@0.1.0-alpha.6`.

## 7. Próximo Passo
Evoluir gradualmente outras pendências de documentação, testabilidade matemática no vitest, limpeza de identificadores semânticos de teste e iniciar o suporte de multi-instâncias simultâneas na mesma window do navegador.
