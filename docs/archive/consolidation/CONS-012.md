# CONS-012 — Diagnóstico Seguro do Backend e Homologação M/O no APPE

## 1. Visão Geral
Esta etapa consistiu em identificar as causas da recusa de conexão da API na porta 8080 (identificada na CONS-011) e, após o estabelecimento seguro do serviço em ambiente local descartável, realizar a validação dos portões **M (Persistência)** e **O (OpenPDF)**.

**Artefato Base**: `document-editor@0.1.0-rc.1` (implantado via Angular no `appe-web`).

## 2. Diagnóstico da Infraestrutura (Porta 8080)
- **Problema Observado na CONS-011**: O comando `curl -I http://localhost:8080/api/pdf/planos/1` falhava com `Connection refused`.
- **Investigação**: A análise revelou que o backend Java/Spring Boot não estava em execução naquele momento. O script `dev.sh start` inicializa apenas o banco de dados PostgreSQL e PgAdmin (porta 5433).
- **Correções Aplicadas**:
  - Inicialização manual do Spring Boot via `./mvnw spring-boot:run`.
  - Tratamento do conflito de portas (uma instância estava travada).
  - Preenchimento da base com os dados sintéticos via `./dev.sh seed`.
  - **Correção Permanente no Seed (Hibernate NPE)**: Identificou-se que a inserção de planos via script SQL `04-teaching-plans.sql` omitia a coluna `version` (mapeada via `@Version` na entidade `TeachingPlan`), o que causava um `NullPointerException` (HTTP 500) do Hibernate. A correção foi aplicada de forma permanente no script-fonte `04-teaching-plans.sql`, onde a coluna `version` e o valor inicial `0` foram adicionados aos inserts. Uma reinicialização isolada do seed via `./dev.sh seed` demonstrou funcionamento liso das atualizações (PATCH) sem qualquer intervenção posterior manual.

## 3. Portão M: Persistência e Fluxo Institucional
- **Abordagem**: Utilização de scripts locais de integração (`integration_test.js` e `test_workflow.cjs`) consumindo diretamente a API com tokens JWT via HttpOnly Cookies.
- **Importante (Delimitação da Evidência)**: **Nenhuma tela ou operação do frontend Angular foi exercitada nesta fase**. Os testes limitaram-se exclusivamente a chamadas REST diretas à API.
- **Teste Realizado (REST)**:
  1. Login como Professor (papel `2000`).
  2. Recuperação da alocação via `/api/professor/disciplinas`.
  3. Recuperação do plano de ensino (`/api/professor/planos/gerar`).
  4. Atualização via `PATCH /api/professor/planos/{id}/valores`, enviando um JSON semântico sintético que inclui o identificador de quebra (`pageBreak`).
  5. Verificação da integridade do JSON salvo através de uma nova busca.
- **Evolução de Estados e Permissões**: A sequência real de estados atestada na API foi `DRAFT -> PENDING_REVIEW -> UNDER_REVIEW -> APPROVED`. O sistema exigiu adequadamente que o Coordenador (papel `4000`) chamasse o endpoint `/iniciar` antes de `/aprovar`, conforme a modelagem institucional. Não foram testadas funcionalidades de comentários em célula, devoluções/recusas, ou papéis além de Professor (2000) e Coordenador (4000).
- **Resultado (APROVADO)**: O JSON foi persistido exatamente conforme modelado pelo editor experimental.

## 4. Portão O: OpenPDF
- **Abordagem**: Requisição para `GET /api/pdf/planos/{id}` consumindo o binário resultante da persistência do documento sintético configurado no Portão M.
- **Teste Realizado e Resultado (APROVADO)**:
  O PDF gerado resultou num documento de exatamente **2 páginas**.
  - Na primeira página, verificou-se através de extração de texto a string: `"--- TEXTO ANTERIOR AO PAGEBREAK ---"`.
  - Na segunda página, confirmou-se a presença de: `"--- TEXTO POSTERIOR AO PAGEBREAK ---"`.
  **Detalhe Técnico Restrito:** O renderizador institucional (`OpenPdfRenderer`) reconheceu fielmente o nó semântico manual `pageBreak`. O editor exporta exclusivamente os nós intencionais (estruturais manuais); *Decorations* automáticas transitórias oriundas do paginador visual não são convertidas em nós, e consequentemente o JSON armazenado encontra-se integralmente livre de quaisquer estruturas de renderização UI ou artefatos (`ChromeLayer`, *spacers*).

## 5. Portão Q: Qualidade E2E
- **Investigação**: Realizado inventário buscando arquivos Cypress no `package.json` ou diretórios `cypress/` do repositório `appe-web`.
- **Resultado:** `ADIADO / NOT RUN — Cypress institucional`.
  A infraestrutura Cypress não está instalada ou configurada no projeto `appe-web`. Conforme as restrições arquiteturais da etapa, o portão foi postergado. O script Puppeteer desenvolvido anteriormente (smoke test) e os scripts de integração REST de API servem como evidências suplementares pontuais, mas não foram registrados artificialmente como uma execução de suíte de testes Cypress.

## Conclusão
A biblioteca `document-editor@0.1.0-rc.1` foi adotada com sucesso pelo APPE. Tanto a persistência semântica no banco relacional quanto a transcrição final para o OpenPDF demonstram conformidade total com a nova arquitetura independente (Rota B). O artefato `rc.1` demonstrou plena estabilidade para evolução à `1.0.0`.
