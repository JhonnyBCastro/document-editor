# DOC-003-REPORT — Diagnóstico e Revisão Acadêmica da Monografia APPE

Este documento formaliza a entrega da etapa documental **DOC-003**, com o objetivo de integrar as evidências técnicas consolidadas (do *document-editor* e da integração REST) na monografia real do sistema APPE, preservando o escopo acadêmico do TCC.

---

## A. Diagnóstico da Monografia Original
A monografia encontra-se estruturada nos moldes de trabalho final de graduação (Introdução, Referencial Teórico, Metodologia, Resultados).
- O objeto central do texto é o sistema de automação **APPE** (Automação do Preenchimento do Plano de Ensino).
- A arquitetura está corretamente descrita como microsserviços (Spring Boot, Angular, FastAPI Python).
- Foi identificada uma defasagem crítica no Capítulo de Resultados, onde a geração do arquivo final (PDF) ainda é descrita como sendo realizada no navegador a partir de HTML (impressão do browser), o que diverge do avanço alcançado na *CONS-012* (integração OpenPDF no backend baseada em JSON).

## B. Mapa de Inserção de Evidências por Seção
A integração das evidências técnicas será distribuída da seguinte forma:

1. **Metodologia (Arquitetura do Frontend/Editor)**:
   - *Evidência*: Abordagem Híbrida (Rota A/B - Separação da Geometria Visual do Estado Semântico).
   - *Justificativa*: Fundamentar que a manipulação do DOM e injeção do Tiptap isentou o backend Java de cálculos complexos.
2. **Resultados e Implementação**:
   - *Evidência*: Validação da Paginação, *Smoke Tests* do Angular 21, Teste de Estresse (PE-L e P09-T).
   - *Justificativa*: Demonstra a capacidade de absorver tabelas e estruturas extensas de forma estável.
3. **Resultados de Integração Full-Stack**:
   - *Evidência*: Transição REST e Geração OpenPDF.
   - *Justificativa*: Comprovar que o payload JSON viajou limpo, passou pelas fases de aprovação (`DRAFT` $\rightarrow$ `PENDING_REVIEW` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `APPROVED`), e foi convertido com sucesso para PDF em servidor.
4. **Considerações Finais / Trabalhos Futuros**:
   - *Evidência*: Ausência de corte intralinha, acoplamento ao Browser Font Engine, e necessidade futura de mensuração humana do sistema.

## C. Lista de Inconsistências Encontradas

A auditoria (`Etapa C`) do DOCX revelou os seguintes pontos:

| Referência Encontrada | Trecho / Tema | Classificação | Ação a ser tomada |
|---|---|---|---|
| **Python / PpcDiscipline** | Menção a PpcDiscipline e ao processamento Python para extração de planilhas e scraping (ex. Linha 300). | *Informação Histórica Válida* | **Preservar** na metodologia (arquitetura proposta), mas adicionar ressalva na discussão de resultados de que a lógica de `PpcDiscipline` foi desvinculada/inativada na iteração atual do microsserviço (a arquitetura Python detalhada reflete a proposta histórica, e não a totalidade da implementação vigente). |
| **Geração de PDF no Frontend** | Linha 528: *"Essa abordagem dispensa a geração de PDF no lado do servidor, aproveitando a própria renderização HTML..."* | **Atualização Necessária (Urgente)** | Substituir por texto descrevendo o OpenPDF consumindo a estrutura JSON semântica, não o HTML visual transitório, ressaltando o sucesso da integração. |
| **Tempo Docente / Produtividade** | Justificativas e objetivos (ex: L87, L94) mencionam *"otimizar o tempo docente, reduzir erros"*. | *Informação Histórica Válida* | Manter na *Introdução* e *Referencial*. No entanto, evitar conclusões empíricas nas *Considerações Finais* que declarem essa otimização como "já alcançada e comprovada", uma vez que faltam métricas de testes qualitativos (Nível Usuário). |
| **Versão Angular** | Textos referenciando a biblioteca "Angular" genericamente ou em POCs (ex: L342). | *Atualização Necessária* | Confirmar ou adicionar menção explícita ao consumo validado pelo *Angular 21.2.17* nos parágrafos de implementação técnica. |
| **Testes de Integração e E2E** | Ausência da devida separação dos testes (E2E Frontend vs. REST Backend). | *Atualização Necessária* | Esclarecer que o *smoke test* frontend e o teste institucional REST (executado via scripts locais simulando o payload, e não diretamente disparado pela interface Angular) são validações independentes, não caracterizando um teste E2E ponta-a-ponta integrado (como seria via Cypress/Portão Q, que está marcado como *ADIADO / NOT RUN*). |

## D. Proposta Textual Acadêmica Revisada

*(Textos a serem inseridos de forma localizada no DOCX)*

**Para Arquitetura da Solução e Editor (Substituição/Acréscimo):**
> O módulo de edição e paginação (document-editor) atua exclusivamente como fornecedor de uma representação JSON semântica e pura. A arquitetura empregada isola totalmente a geometria de paginação visual (implementada via *Decorations* nativas da biblioteca no cliente no encapsulamento `.document-editor-chrome-layer`), garantindo que o backend Java consuma e armazene estritamente os dados estruturais do Plano de Ensino, livres do HTML visual transitório ou marcações específicas de navegador (*WYSIWYG Semântico*). Essa integração foi devidamente homologada e testada no ambiente do SPA consumido pela infraestrutura do framework Angular 21.2.17, observando-se a correta destruição dos componentes em tela (*unmount*), execução de rollback de alterações em falhas sistêmicas e preservação da integridade semântica da árvore de documentos.

**Para Integração Backend e OpenPDF (Substituindo a L528 do DOCX original):**
> A exportação oficial do Plano de Ensino é realizada no backend do APPE, por meio da API Java e da biblioteca OpenPDF, utilizando a representação estruturada em JSON armazenada pelo sistema. Nesse processo, o nó manual pageBreak, inserido intencionalmente no editor, é interpretado pelo renderizador como uma instrução de mudança de página. Por outro lado, as quebras automáticas calculadas para a pré-visualização no navegador são representadas por Decorations transitórias do ProseMirror e não integram o documento persistido. Durante os testes locais de integração REST, a exportação de um documento sintético contendo uma quebra manual resultou em um PDF de duas páginas, com o conteúdo anterior à quebra na primeira e o conteúdo posterior na segunda. Esse resultado demonstrou a compatibilidade funcional da quebra manual entre a persistência e a exportação institucional, sem estabelecer equivalência geométrica exata entre a visualização no navegador e o documento final.

**Para Discussão e Limitações:**
> O protótipo demonstrou estabilidade na integração. Observou-se a capacidade da biblioteca de processar tabelas complexas e gerenciar quebras automáticas de acordo com os limites físicos preestabelecidos com correta preservação de memória. Como limitações inerentes à arquitetura delineada, nota-se a ausência de suporte nativo e simples para cortes intralinha precisos (divisão automática de elementos `<tr>` espessos), a dependência do *Browser Font Engine* em detrimento à via servidor e a indisponibilidade, nesta iteração, de baterias unificadas e completas de testes regressivos automatizados (o portão Q institucional figura no estado *ADIADO / NOT RUN*). Ademais, ressalta-se que as avaliações limitaram-se ao escopo automatizado, restringindo-se afirmativas empíricas diretas de usabilidade e efetiva redução de tempo na confecção do plano até a realização futura de ensaios analíticos controlados com usuários finais.

## E. Identificação das Figuras e Tabelas Recomendadas

| Elemento | Descrição | Justificativa |
|---|---|---|
| **Figura (Fluxograma Arquitetural Rota B)** | Diagrama ilustrando a digitação, processamento das *decorations* em memória visual e a persistência REST. | Explica de forma didática o núcleo da contribuição da biblioteca (a separação semântica). |
| **Figura (Ciclo de Status)** | Diagrama de estados: `DRAFT`, `PENDING_REVIEW`, `UNDER_REVIEW`, `APPROVED`, etc. | Evidencia as regras de negócio cobertas pela automação de fluxo de revisão do documento no APPE. |
| **Tabela (Resultados Teste Estresse PE-L e P09-T)** | Tabulação demonstrando o desempenho frente à manipulação pesada de tabelas. | Formaliza a solidez técnica do editor com dados quantitativos precisos. |

## F. Relação das Evidências que Sustentam os Resultados

1. **Robustez de Renderização:** Validadas pela documentação CONS-002, CONS-003, e CONS-004 através dos ensaios locais da biblioteca (Testes em Puppeteer).
2. **Integração Angular:** Comprovada pela *CONS-011*, validando *smoke test* e destruição visual em Angular 21.2.17.
3. **Persistência / Exportação Backend OpenPDF:** Comprovada pelos scripts REST da atividade *CONS-012*, que efetivaram persistência da versão `0.1.0-rc.1` (commit *ef239ae*) via base de dados descartável.
