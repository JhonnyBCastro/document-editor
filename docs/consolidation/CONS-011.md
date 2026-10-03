# CONS-011 — Relatório de Adoção Controlada da RC.1 e Homologação Institucional

## 1. Preflight e Estado Inicial
- **Bibliotecas e Dependências:** Verificamos o artefato imutável `document-editor-0.1.0-rc.1.tgz`.
- **Hash SHA-256 Confirmado:** `d581e3c939dbc24d4133ce9c43e5e5e466cc4cdc5c762f10d357044501a33d1e`
- **Commit:** `ef239ae`
- **Estado do APPE:** A branch `cons-004-rc-validation` continha alterações experimentais não commitadas (inclusive um script Puppeteer local). Realizamos o backup desse estado e derivamos a branch exclusiva de homologação: `cons-011-appe-rc1-homologation`.

## 2. Instalação e Build
- **Artefato:** Armazenamos o tarball localmente no diretório `appe-web/appe-web/lib/` e utilizamos `npm install file:lib/document-editor-0.1.0-rc.1.tgz`.
- **Peer Dependencies:** A árvore do npm resolveu o Tiptap 3.31.3 perfeitamente de forma deduped, sem necessitar de flags depreciadas como `--legacy-peer-deps`.
- **Build Angular:** O build foi concluído com sucesso, os chunks foram gerados corretamente e as dependências estilos (`document-editor/style.css`) foram resolvidas pelo Vite.

## 3. Preservação do Modo Convencional
No `AppeEditorComponent`, asseguramos o seguinte contrato seguro:
```typescript
@Input() enableExperimentalPagination = false;
```
Adicionalmente, ajustamos `manualBreakNodeName: 'pageBreak'` no config, permitindo ao document-editor interagir de forma não invasiva com a tag legada (convencional) do editor institucional, preservando total independência.

## 4. Smoke Test Integrado (Portão Automático Local)
- O script `appe-smoke.spec.cjs` foi executado com Puppeteer em modo headless sobre o Angular dev server.
- O teste executou o ciclo de vida completo previsto:
  - `[PASS]` Inicialização convencional e carregamento do JSON.
  - `[PASS]` Reconstrução em modo experimental.
  - `[PASS]` PageBreak manual detectado e posicionado semânticamente (na posição zero inclusive).
  - `[PASS]` Tabela extensa induzida a renderizar, forçando repaginação profunda (`virtual-page-spacers`).
  - `[PASS]` O layout estabilizou.
  - `[PASS]` O JSON extraído permaneceu cirurgicamente limpo sem vazar widgets visuais do ProseMirror.
  - `[PASS]` Retorno do rollback para a visualização convencional, garantindo independência do JSON.

## 5. Matriz de Homologação (Portões M, O, Q)

| Portão | Cenário | Resultado | Evidência | Pendência |
|---|---|---|---|---|
| **E** | Smoke Test (Local E2E) | **PASS** | Script `appe-smoke.spec.cjs` confirmou a ausência de corrupção do documento e funcionamento estrutural da RC.1 no APPE. | Nenhuma. |
| **M** | Persistência Institucional | **BLOCKED** | Backend não disponível (porta 8080 recusou a ligação). Não iniciamos banco de dados de produção arbitrário conforme política estabelecida. | Iniciar o `appe-api` e validar a carga bidirecional com DB real. |
| **O** | Exportação OpenPDF | **BLOCKED** | Backend inoperante para validar a exportação `GET /api/pdf/planos/{id}`. | Disponibilizar a API OpenPDF integrada ao plano salvo. |
| **Q** | Regressão Cypress | **BLOCKED** | Infraestrutura nativa Cypress não identificada na raiz do projeto institucional. | Instalar, configurar e traduzir os cenários do Puppeteer para spec Cypress. |

## 6. Origem dos Bloqueios / Problemas
- Não foram encontrados defeitos na biblioteca `document-editor` (PASS completo nos escopos que tangem ao frontend).
- A integração do Adaptador APPE (Angular) com os inputs/outputs funcionou adequadamente.
- Os bloqueios (M e O) são estritamente ambientais relacionados à indisponibilidade do serviço Backend APPE.

## 7. Instruções de Rollback
Caso a instituição deseje suspender a adoção:
1. No repositório `appe-web`, faça `git checkout cons-004-rc-validation` ou retorne para `main`.
2. Para remover completamente o artefato RC.1: `npm uninstall document-editor` e delete a pasta local `lib/`.

## 8. Decisão Sobre Integração
O frontend provou-se tecnicamente apto e estável para receber a paginação experimental sem riscos ao documento original e aos usuários. A RC.1 do document-editor passou na prova de fogo do client-side. A adoção plena fica condicionada apenas ao ligamento com os serviços backend.

## 9. Próxima Atividade Recomendada
Homologar a persistência institucional em ambiente com o Backend ativo, ou declarar o TCC finalizado e fechado com os êxitos obtidos na validação isolada do Frontend.
