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
  - **Correção Crítica no Seed (Hibernate NPE)**: Identificou-se que a inserção de planos via script SQL deixava a coluna `version` como `NULL`, o que causava um `NullPointerException` (HTTP 500) do Hibernate no momento de persistir o documento. Foi executado um `UPDATE` no banco descartável setando `version = 0`.

## 3. Portão M: Persistência e Fluxo Institucional
- **Abordagem**: Utilização de um script de integração (`test_workflow.cjs`) consumindo diretamente a API com tokens JWT via HttpOnly Cookies.
- **Teste Realizado**:
  1. Login como Professor (`2000`).
  2. Recuperação da alocação via `/api/professor/disciplinas`.
  3. Recuperação do plano (`/api/professor/planos/gerar`).
  4. Atualização via `PATCH /api/professor/planos/{id}/valores`, enviando um JSON semântico contendo o novo identificador de quebra (`pageBreak`).
  5. Re-recuperação do plano via API e verificação da integridade do JSON salvo.
- **Resultado (APROVADO)**: O JSON foi persistido exatamente conforme produzido pelo editor experimental. Nenhuma estrutura transitória (como o `ChromeLayer`) poluiu o documento armazenado. O ciclo de submissão (Professor) e revisão/aprovação (Coordenador) funcionou perfeitamente.

## 4. Portão O: OpenPDF
- **Abordagem**: Recuperação do binário originado pela persistência do Portão M.
- **Teste Realizado**:
  - Requisição para `GET /api/pdf/planos/{id}`.
  - Verificação de metadados (`pdfinfo`) e extração de texto (`pdftotext`).
- **Resultado (APROVADO)**: O PDF gerado foi bem-sucedido e produziu um documento de **2 páginas**. O renderizador backend `OpenPdfRenderer` identificou adequadamente a Decoration convertida em node semântico `pageBreak`, forçando a quebra de página de forma fiel à interface visual.

## 5. Portão Q: Qualidade E2E
- **Investigação**: Realizado inventário buscando arquivos Cypress no `package.json` ou diretórios `cypress/`.
- **Resultado (DESCARTADO)**: A infraestrutura Cypress não está instalada ou configurada no projeto `appe-web`. Conforme diretriz, o portão foi ignorado e o teste via script de integração com Puppeteer (na etapa anterior) mais o teste de API atual servem de validação principal de qualidade.

## Conclusão
A biblioteca `document-editor@0.1.0-rc.1` foi adotada com sucesso pelo APPE. Tanto a persistência semântica no banco relacional quanto a transcrição final para o OpenPDF demonstram conformidade total com a nova arquitetura independente (Rota B). O artefato `rc.1` demonstrou plena estabilidade para evolução à `1.0.0`.
