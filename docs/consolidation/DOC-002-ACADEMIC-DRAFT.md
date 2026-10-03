# DOC-002-ACADEMIC-DRAFT — Proposta de Redação e Mapeamento de Evidências

Este documento serve como rascunho e guia estrutural para a redação do TCC, consolidando as evidências experimentais da biblioteca `document-editor` e sua integração ao sistema APPE. Ele endereça as exigências acadêmicas, estabelecendo o mapeamento técnico para o texto formal, sem atribuir validações empíricas com usuários e resguardando-se apenas às validações de sistema automatizadas e locais.

## 1. Erratas à Matriz de Evidências (DOC-001)

Antes de transpor as evidências para a monografia, as seguintes imprecisões do documento técnico `ACADEMIC-EVIDENCE-001.md` foram corrigidas para a redação final:

1. **Versão do Angular (Frontend):** O ambiente consumidor (`appe-web`) opera com **Angular 21.2.17**, e não Angular 18 como constava no artefato anterior. Toda menção à integração frontend no TCC deve referenciar Angular 21.
2. **Método de Extração nos Testes Híbridos:** Os testes de quebra de página não dependem exclusivamente da extração via `getHTML()`. A validação real da estrutura semântica (JSON) no navegador é feita via `page.evaluate(() => window.__appeEditor.getJSON())`, inspecionando diretamente os nós AST, e não apenas parseando HTML renderizado.
3. **Ausência de Testes React:** Não foram realizados testes E2E reais de integração com React. A tentativa via `react-integration.spec.js` é inexistente ou foi descartada da validação final. A validação de mount/unmount foca nos ciclos de vida das bibliotecas agnósticas consumidas pelo Angular. Qualquer menção a "lifecycle React/Angular" na matriz de validação visual limita-se a "lifecycle Angular" no escopo do TCC.
4. **Descrição de PrintSession e OpenPDF:** O recurso de `PrintSession` gerencia exclusivamente as adequações visuais do navegador (`@media print` no CSS) para suprimir margens dinâmicas da tela em eventuais visualizações nativas. A geração do PDF institucional definitivo é realizada no **backend (Java/OpenPDF)**, que interpreta o HTML semântico fornecido e produz o PDF final. Não se deve confundir a visualização de impressão no browser com a exportação oficial do sistema.

## 2. Mapeamento de Evidências para a Monografia

| Funcionalidade/Evidência | Seção Sugerida no TCC | Justificativa |
|---|---|---|
| Arquitetura Rota A vs Rota B (Decorations) | **Metodologia / Arquitetura do Sistema** | Fundamenta a decisão arquitetural de separar a geometria visual (decorations) do estado persistido (semântica). |
| Paginação Visual e Quebra Manual | **Resultados / Implementação do Editor** | Demonstra o núcleo da funcionalidade desenvolvida no `document-editor`. |
| Comportamento em Tabelas (Stress PE-L) | **Resultados / Avaliação de Estresse** | Comprova a robustez (151 linhas, 10 páginas) utilizando dados quantitativos precisos extraídos dos testes. |
| Persistência e Transições (DRAFT -> APPROVED) | **Validação / Integração Full-stack** | Evidencia que o estado semântico gerado pelo componente sobrevive a requisições HTTP e transita pelo ciclo da regra de negócio. |
| Exportação Institucional (OpenPDF) | **Resultados / Compatibilidade Backend** | Comprova o sucesso da abordagem híbrida: o backend Java consegue gerar um PDF final usando os dados produzidos pelo componente cliente sem quebras indesejadas. |

## 3. Proposta de Seção de Testes e Validação

Recomenda-se criar um capítulo (ou subcapítulo) intitulado **"Testes e Validação do Protótipo"**, estruturado em três níveis de abstração técnica:

### 3.1. Validação Nível 1: Isolada da Biblioteca (Unitário e E2E)
Esta seção foca na garantia de qualidade intrínseca do `document-editor`, dissociada de seus consumidores.
* **Técnica:** Testes unitários (Vitest) para lógicas de paginação e proteções (Regra *lastBreakPos*); e testes End-to-End (Puppeteer) para avaliar renderização e reflow geométrico no DOM do navegador.
* **Resultado:** Comprovação matemática e visual da inserção de quebras contínuas e paginação tabular, incluindo o cenário de estresse com tabela de 151 linhas suportada nativamente, observando-se a correta destruição (*unmount*), rollback e preservação da integridade semântica.

### 3.2. Validação Nível 2: Integração Frontend (Angular 21)
Aborda o consumo da biblioteca na camada de aplicação cliente (SPA - Single Page Application).
* **Técnica:** *Smoke tests* do Angular garantindo o ciclo de vida (*mount/unmount*) do invólucro do editor (`.page-chrome`).
* **Resultado:** Inicialização bem-sucedida do pacote via NPM em ambiente Angular 21, injetando o formulário do Plano de Ensino à estrutura do framework sem conflito com o motor semântico subjacente (Tiptap/ProseMirror).

### 3.3. Validação Nível 3: Integração Full-stack, Persistência e Backend
Avalia o fluxo completo, ponta-a-ponta, do dado semântico e estrutural.
* **Técnica:** Validação em ambiente local das rotas REST de integração (backend consumidor da representação JSON semântica, e não de Decorations ou HTML visual transitório), conectando o payload gerado com a base PostgreSQL e o backend Spring Boot. Esta etapa e o smoke test de frontend consistem em validações independentes, não configurando uma única jornada E2E integral automatizada.
* **Resultado:** Confirmação da filtragem do "lixo visual". O payload JSON viaja de forma limpa, suporta as transições de status do microsserviço de revisão (`DRAFT` $\rightarrow$ `PENDING_REVIEW` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `APPROVED`) e é plenamente convertido em binário pelo motor institucional OpenPDF (Java), concluindo com sucesso o ciclo da informação.

## 4. Discussão Crítica dos Resultados

O desenvolvimento e a integração do `document-editor` ratificam a escolha da separação arquitetural estrita entre a exibição visual de quebras e a intenção semântica original do documento. A abordagem híbrida adotada resolveu o problema histórico de "HTML poluído e quebrado" no salvamento (conhecido como *WYSIWYG destrutivo*), garantindo um conteúdo imaculado e aderente à API REST.

**Principais contribuições técnicas:**
A manipulação da estrutura (AST) limitando-se ao estado puramente de negócio provou-se arquiteturalmente correta, vez que o gerador institucional OpenPDF no backend recebeu o conteúdo sem conflitos ou marcações estéticas dependentes de cliente web e elaborou o layout em PDF de forma satisfatória. Somado a isso, as proteções geométricas contornaram riscos de laços infinitos, assegurando performance responsiva aceitável em cenários complexos de edição de tabelas.

**Limitações inerentes à arquitetura:**
A renderização paginada da biblioteca depende exclusivamente do mecanismo de cálculo de bounding box nativo do DOM do navegador. Isso implica na restrição de se realizar o chamado *corte intralinha* em tabelas devido à indisponibilidade de quebra CSS fluída e programável no meio de um nodo `<tr>`. Da mesma forma, a estabilidade do reflow geométrico requer processamento local intenso, sendo limitada pelo uso exclusivo de Single-thread no *event loop* JS.

## 5. Limitações e Trabalhos Futuros

As restrições de escopo relatadas neste trabalho representam convites a estudos adicionais:
1. **Quebra Intralinha de Tabelas (Row Splitting):** Atualmente, linhas de tabela (`<tr>`) contendo blocos densos de texto são paginadas inteiramente para a página seguinte, o que acarreta grandes espaços verticais ociosos na página atual.
2. **Dependência do Browser Font Engine:** Discrepâncias tipográficas tênues entre a renderização de fontes nativas em clientes (SO e Browsers distintos) e a geração de fonte isolada no OpenPDF Java demandam elaboração futura de métricas unificadas em servidor de fontes para espelhamento absoluto (*Pixel-perfect WYSIWYG*).
3. **Restrição Multi-instância:** A estrutura de *ChromeLayer* impede a renderização simultânea de dois editores na mesma janela preservando totalmente o CSS de paginação. Novas pesquisas sobre o emprego de componentes em encapsulamento rígido (*Shadow DOM*) se farão necessárias.
4. **Análises Empíricas e Métricas Humanas:** Para preservar o rigor acadêmico, optou-se por excluir qualquer afirmativa de usabilidade intuitiva ou redução do tempo docente no preenchimento de planos sem métricas prévias formais. Medir a experiência e o impacto real frente aos professores torna-se o próximo degrau na validação do sistema através de métodos qualitativos e quantitativos dedicados.
5. **Cobertura de Automação Institucional:** O nível de validação por Cypress (*Portão Q* na esteira CI) permaneceu não finalizado (*Not Run*), evidenciando o potencial evolutivo nas práticas de CI/CD institucionais com a inclusão de testes regressivos.

## 6. Sugestões de Tabelas/Figuras para a Monografia

Para elevar o teor analítico da redação, recomenda-se construir e inserir as seguintes representações gráficas (baseadas nas figuras pré-existentes da revisão e novos dados):

*   **Figura A (Fluxograma de Arquitetura Rota B):** Diagrama exibindo a bifurcação dos dados: as *decorations* ficando mantidas na memória provisória do *Browser*, e a via persistente (`JSON` limpo) viajando ao REST.
*   **Figura B (Ciclo de Status do Plano de Ensino):** Diagrama de máquina de estados expondo as etapas testadas no APPE API (`DRAFT` $\rightarrow$ `PENDING_REVIEW` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `APPROVED`).
*   **Tabela 1 (Resultado Analítico de Teste de Estresse PE-L e P09-T):**
    *   *Linhas Submetidas:* 151 (na fixture PE-L) e variação programática no P09-T.
    *   *Páginas Renderizadas (ChromeLayer):* 10
    *   *Quebras Automáticas (*PageBreaks* inferidas):* 7
    *   *Virtual Spacers (Espaçadores injetados em cabeçalhos):* 6
*   **Quadro Resumo (WYSIWYG Destrutivo x Híbrido Semântico):** Tabela paralela abordando os benefícios para persistência (Banco de Dados) e renderização na nuvem/backend, em contraponto às perdas no WYSIWYG antigo.

## 7. Trechos do TCC que Exigem Revisão (Pontos Críticos)

À luz das auditorias, o documento matriz `TCC-APPE.docx` exige revisão manual imediata nos seguintes tópicos:

1.  **Capítulo Metodológico (Frontend):** Retificar as menções ao *framework* no texto base. Garantir que as informações atestem o consumo pelo Angular v21 (a baseline real validada localmente) e suprimir conjecturas sobre *ports* imaturos ou POCs que já não traduzem a infraestrutura real.
2.  **Capítulos de Resultados/Discussão:** Mapear a integração formal. Substituir parágrafos descritivos ou conclusivos antecipados pelos atestados advindos do cenário *CONS-012*. Ressaltar que não apenas a geração no *Browser* funcionou (Nível 2), mas que de fato o motor *OpenPDF* do servidor conseguiu converter o estado JSON final enviado pelo Angular (Nível 3). Remover afirmações referentes ao microserviço Python de `PpcDiscipline`, cujo vínculo foi inativado.
3.  **Conclusão Final:** Podar jargões entusiásticos sobre impactos organizacionais empíricos e produtividade que não possuem referencial numérico comprovado na matriz técnica do trabalho, firmando as conclusões do TCC em sua sólida e suficiente natureza arquitetônica e integrativa computacional.
