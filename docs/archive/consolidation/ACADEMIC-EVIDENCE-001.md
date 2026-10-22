# ACADEMIC-EVIDENCE-001 — Consolidação das Evidências Técnicas do Protótipo

## 1. Contexto e Ambiente de Validação
- **Protótipo Analisado:** `document-editor@0.1.0-rc.1` (Commit: `ef239ae`)
- **Compatibilidade Core:** Tiptap `2.27.3` e `3.31.3` (Conforme CONS-005).
- **Backend Consumidor:** APPE API (Java/Spring Boot, JPA/Hibernate, PostgreSQL).
- **Frontend Consumidor:** APPE Web (Angular 18).
- **Infraestrutura de Testes Biblioteca:** Vitest (Unidade), Puppeteer (E2E Smoke/Stress).
- **Infraestrutura Institucional:** Scripts REST NodeJS locais simulando transições e exportações OpenPDF.

## 2. Matriz de Rastreabilidade

| Funcionalidade ou requisito | Implementação | Teste realizado | Resultado | Fonte da evidência | Limitação |
|---|---|---|---|---|---|
| Documento semântico contínuo | Arquitetura Rota B (ausência de quebra persistente no modelo DOM proseMirror). | Scripts Puppeteer com extração `getHTML()`. | Aprovado | CONS-002, `hybrid-pagination.spec.cjs` | Renderização exige carga integral na árvore DOM (ausência de virtualização nativa completa). |
| Paginação visual (Decorations) | Paginador projeta divisões via `Decoration.widget`. | Contagem de espaçadores no DOM renderizado. | Aprovado | CONS-002, `PaginationController` | Limitado ao contexto visual de execução do host (navegador web). |
| PageBreak manual | Criação de nó customizado persistido na AST. | Inserção isolada via interface e persistência. | Aprovado | CONS-002, `tests/e2e/hybrid-pagination.spec.cjs` | N/A |
| PageBreak na posição zero | Lógica de scanner e offset matemático no `performLayout`. | Inserção no cursor `pos: 0`. | Aprovado | CONS-003, `tests/e2e/hybrid-pagination.spec.cjs` | N/A |
| Quebras consecutivas | Resolução topológica de widgets adjacentes. | Inserção repetitiva e avaliação de crash. | Aprovado | CONS-003, `tests/e2e/hybrid-pagination.spec.cjs` | Nós textuais em branco são mantidos fisicamente no DOM subjacente. |
| Paginação de tabelas | Divisão baseada em limites de Node (`<tr>` completas). | Estresse de inserção em múltiplas páginas. | Aprovado | CONS-004, `pagination-stress.spec.cjs` | Não realiza fragmentação intralinha. |
| Integridade do JSON | Filtragem natural imposta pela independência arquitetural de *Decorations*. | Leitura do documento submetido ao backend. | Aprovado | CONS-012, `integration_test.js` | N/A |
| Regra lastBreakPos | Garantia matemática contra loops infinitos de transição (`policies.ts`). | Unit Tests específicos isolados. | Aprovado | CONS-002, Vitest (`policies.spec`) | Avaliação depende de layout height, instável se WebFonts carregarem no meio da transação. |
| Configuração `manualBreakNodeName` | Opção exposta na injeção do construtor da Extensão Tiptap. | Alteração no bootstrap e inspeção AST. | Aprovado | CONS-007, Instanciação no APPE | N/A |
| Ownership do ChromeLayer | O paginador é dono estrito de seu invólucro `.page-chrome` (ADR-003). | Mount/Unmount do EditorView em lifecycle React/Angular. | Aprovado | CONS-008, `chrome.ts` | Multi-instância não suportada nativamente na mesma janela sem vazamento de CSS. |
| PrintSession | Neutralização de estilos e margens dinâmicas no `@media print`. | Acionamento via API programática e visualização de print. | Aprovado | CONS-009, `print.ts` | O script local não isola a impressão contra contêineres HTML globais do hospedeiro. |
| Compatibilidade Tiptap | Resolução de dependências peer flexíveis. | Testes em containers `tiptap@2` e `tiptap@3`. | Aprovado | CONS-005, CIs locais | Biblioteca amarrada ao ecossistema Tiptap/ProseMirror exclusivamente. |
| Integração Angular | Empacotamento para injestão via `npm install` local. | Smoke Test Puppeteer contra servidor Angular. | Aprovado | CONS-011 | Biblioteca exige acesso ao `window`/DOM (Não-SSR). |
| Persistência REST | API institucional Java recebe `PATCH` da estrutura WYSIWYG. | Script REST interceptando a request e salvando no banco de dados. | Aprovado | CONS-012, `integration_test.js` | Limitado aos perfis de Coordenador e Professor. |
| Transições de status | Regras transicionais impostas pelo sistema. | Simulação de fluxo via endpoints backend. | Aprovado | CONS-012, `test_workflow.cjs` | Sub-ciclos de devolução ou comentários individuais não foram exercitados nesta prova técnica. |
| Exportação OpenPDF | Geração do PDF final traduzindo AST preservada para iterações de backend. | Extração de páginas geradas (`pdfinfo`) com documento semântico. | Aprovado | CONS-012 | Incompatibilidades tipográficas sutis entre Browser Font Engine e Java Font Engine. |
| Limitações (Cypress) | Automação unificada frontend-backend para qualidade (Portão Q). | Inventário de infraestrutura e pacote. | ADIADO / NOT RUN | CONS-012 | Hospedeiro Angular desprovido da infraestrutura Cypress na baseline atual. |

## 3. Resultados Quantitativos Registrados
A estabilidade geométrica para paginações em larga escala foi validada através das métricas obtidas na *fixture* `PE-L` (Tabela Extensa) durante a CONS-004 e validada novamente antes do Release Candidate:
- Foram processadas **151 DataRows** em sequência ininterrupta.
- Foram projetadas **10 páginas virtuais** renderizadas pelo ChromeLayer.
- O motor efetuou a decisão assíncrona de **7 quebras automáticas**.
- O sistema injetou **6 espaçadores virtuais** (*Spacers/Header Clones*) para preservar a fluidez do layout tabular.
**Importante:** Tempos de estabilização são assíncronos e submetidos às regras geométricas (event loop) do browser, e não servem como benchmark matemático puro para CPU devido à dependência do motor de rendering host. 

## 4. Diferenças entre Modelagem e Implementação Institucional
Durante a validação E2E REST do APPE (CONS-012), foi exercitada e atestada a seguinte transição de status da entidade *Plano de Ensino*:
`DRAFT` → `PENDING_REVIEW` → `UNDER_REVIEW` → `APPROVED`.
- **Divergência Analítica Constatada:** Originalmente, em artefatos abstratos de modelagem, poderia não estar estritamente mapeada a obrigatoriedade da etapa isolada `UNDER_REVIEW` (Iniciada via endpoint `/iniciar` pelo Coordenador). O sistema backend proíbe transições diretas de `PENDING_REVIEW` para aprovação final, resguardando o rastreio da posse do documento durante a revisão. 
- **Omissões Testáveis:** Caminhos de devolução (`REVISION_NEEDED`), cancelamentos (`cancelSubmission`) e o relacionamento fino de `PlanReviewComment` (comentários contextuais) não foram validadas e permanecem ausentes do escopo formal documentado nesta etapa técnica.

## 5. Delimitação das Evidências da Exportação OpenPDF
O Teste M/O (CONS-012) submeteu intencionalmente um documento híbrido: texto envolto por uma quebra estrutural intencional gerada a partir do frontend.
- O banco persistiu a AST sem o lixo virtual (decorations visuais automatizadas pela biblioteca).
- O motor institucional **OpenPDF** consumiu essa árvore, leu a cláusula semântica e gerou fielmente o artefato binário com exatas **duas (2)** páginas lógicas (avaliado via metadados de sistema).
**Afirmação sustentável academicamente:** O paginador atua de modo arquiteturalmente íntegro na Rota B — "As automações geométricas se isolam no invólucro do DOM, enquanto a estrutura canônica armazena exclusividades de intenção do autor, garantindo que o backend desconheça, pela virtude do design, as operações transitórias do cliente web."

## 6. Limitações Conhecidas e Trabalho Futuro
Não se alega falha no protótipo em virtude destas limitações; elas foram escopadas metodologicamente:
- A impossibilidade atual de corte intralinha (`<tr>` com grande volume de dados é empurrado inteiramente, causando lacuna vertical indesejada).
- Dependência intrínseca ao Browser Environment (impossibilidade de renderização nativa de PDF em servidores node isolados).
- Single-instance only: Inseguro em arquiteturas dashboard que contiverem instâncias concomitantes.
- Infraestrutura institucional incompleta (Portão Q pendente em face da ausência do Cypress base).
- Possíveis discrepâncias de calibração tipográfica nativa.

## 7. Proposta de Distribuição de Evidências no TCC
Recomenda-se estruturar a narrativa final no documento monográfico da seguinte forma:
1. **Análise e Modelagem:** Retratar a dificuldade histórica do domínio (WYSIWYG destrutivo x semântico) e evidenciar as divergências institucionais de fluxos operacionais (a descoberta de transições intermediárias como a `UNDER_REVIEW`).
2. **Arquitetura e Tecnologias:** Embasar a separação com foco no ADR-002 e no ADR-003, justificando como a injeção do Tiptap isentou o backend Java de lidar com cálculos matemáticos complexos.
3. **Implementação das Funcionalidades:** Evidenciar o trecho da Rota B (Decorations) relatados no item 2, focando em como o ownership resgatou o documento de vazamentos CSS indesejados.
4. **Testes e Validação:** Transformar a Matriz da Seção 2 no núcleo da tabela de cobertura de requisitos qualitativos e quantitativos, incluindo o stress PE-L com tabelas.
5. **Discussão de Resultados:** Validar as assunções arquiteturais através do atestado fornecido no teste OpenPDF (Seção 5); o OpenPDF provou que a semântica híbrida atende plenamente ao negócio, dispensando algoritmos duplicados e complexos no Java.
6. **Limitações e Trabalhos Futuros:** Enumerar as restrições relatadas na Seção 6 sem comprometer o valor do trabalho, expondo a quebra intralinha de tabelas como um natural limitador do escopo e um convite para expansões em pesquisas subjacentes.
