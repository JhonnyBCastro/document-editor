# Backlog Evolutivo - Document Editor

O pacote encontra-se na baseline funcional 0.1.0-rc.1 com arquitetura de Rota B (Paginação Visual via Decorations) comprovadamente operante. A tabela abaixo reflete as intenções e manutenções identificadas para futuras iterações.

## Prioridade 0 (P0) - Funcionalidade Crítica
*(Nenhuma pendência crítica estrutural neste momento. O layout resolve PE-L sob stress e mantém isolamento semântico).*

## Prioridade 1 (P1) - Testabilidade, Documentação e Manutenção
- **[CONCLUÍDO - CONS-005] Certificação da compatibilidade Tiptap:**
  - **Motivação:** A biblioteca declara suporte a Tiptap 2 e 3 (`peerDependencies`).
  - **Resultado:** Executado teste E2E rigoroso certificando a funcionalidade em versões de Tiptap 2.x e 3.x de maneira cruzada.
- **[CONCLUÍDO - CONS-006] Auditoria e tratamento de contratos públicos legados:**
  - **Motivação:** Contratos de persistência como `PersistedDocument` usavam identificadores históricos (`document-editor-lab`) que vazavam para a API pública.
  - **Resultado:** A API foi purificada, preservando apenas os contratos geométricos essenciais de paginação.
- **Ampliação do Unit Testing de Matemáticas Puras:**
  - **Motivação:** A suíte de regras semânticas já opera no Vitest (criada na CONS-003), mas a suíte E2E ainda carrega o peso principal da geometria e é falha por variações externas de renderização do DOM.
  - **Resultado Esperado:** Extrair e cobrir mais funções geométricas do `controller` (avaliadores de tamanho e fragmentação isolada) com Vitest/JSDOM, complementando a suíte unitária existente.

## Prioridade 2 (P2) - Melhorias Arquiteturais
- **[CONCLUÍDO - CONS-007] Configuração genérica do nó manual de quebra:**
  - **Motivação:** `controller.ts` possuía hardcode no nome de nó `pageBreak`.
  - **Resultado:** O identificador foi generalizado via `manualBreakNodeName` em `PaginationOptions`, desacoplando o núcleo de formatação do schema do consumidor.
- **[CONCLUÍDO - CONS-008 e CONS-008-F] Evolução do contrato DOM do host:**
  - **Motivação:** A extensão assume globalmente `document.body` e o `#chrome-layer`.
  - **Resultado:** O ChromeLayer foi parametrizado com fallback autogerenciado estrito (ADR-003). Componentes gerados pela biblioteca são limitados ao escopo local, pavimentando futuramente o suporte multi-instância.
- **Generalização gradual de nomenclaturas demonstrativas:**
  - **Motivação:** Fixtures nomeadas sob domínio do APPE (`PE-S`, `PE-L`).
  - **Resultado Esperado:** Nomes neutros descritivos quando couber limpeza.
- **Neutralidade do Cabeçalho Padrão (runningContent):**
  - **Motivação:** O cabeçalho automático carrega o vestígio "Document Editor Lab — Documento de Teste", que vazaria para consumidores sem configuração explícita.
  - **Resultado Esperado:** Modificar o padrão para um texto neutro ou iniciar com a exibição do cabeçalho desativada (`enabled: false`) nas próximas distribuições.

## Research (Investigação)
- **Fragmentação Intralinha de Tabelas (TABLE_INTRAROW_UNSUPPORTED):**
  - **Motivação:** Atualmente a quebra recai sobre a `<tr>` inteira. Textos monolíticos transbordantes quebram o visual.
  - **Resultado Esperado:** Estratégia algorítmica viável no AST para fracionar a tabela.
- **Suporte Multi-Instância:**
  - **Motivação:** Dependência no DOM global (resolvida pela P2) impede renderização cruzada na mesma aba do navegador.
  - **Resultado Esperado:** Vários `editor` rodando paginação na mesma aba sem colisão geométrica.
- **Estratégia de Versionamento e Publicação:**
  - **Motivação:** Integrar diretamente o pacote npm a longo prazo.
