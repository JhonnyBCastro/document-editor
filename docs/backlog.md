# Backlog Evolutivo - Document Editor

O pacote encontra-se na baseline funcional 0.1.0-alpha.2 (RC) com arquitetura de Rota B (Paginação Visual via Decorations) comprovadamente operante. A tabela abaixo reflete as intenções e manutenções identificadas para futuras iterações.

## Prioridade 0 (P0) - Funcionalidade Crítica
*(Nenhuma pendência crítica estrutural neste momento. O layout resolve PE-L sob stress e mantém isolamento semântico).*

## Prioridade 1 (P1) - Testabilidade, Documentação e Manutenção
- **Certificação da compatibilidade Tiptap:**
  - **Motivação:** A biblioteca declara suporte a Tiptap 2 e 3 (`peerDependencies`), mas os testes internos rodam nativamente apenas na v2.11.
  - **Resultado Esperado:** Criar uma matriz de testes CI ou configuração local capaz de rodar a suíte inteira contra o Tiptap v3 para oficializar o suporte.
- **Auditoria e tratamento de contratos públicos legados:**
  - **Motivação:** Contratos de persistência como `PersistedDocument` usam identificadores históricos (`document-editor-lab`) que vazam para a API pública.
  - **Resultado Esperado:** Isolar a infraestrutura de envelopes do core geométrico.
- **Ampliação do Unit Testing de Matemáticas Puras:**
  - **Motivação:** A suíte de regras semânticas já opera no Vitest (criada na CONS-003), mas a suíte E2E ainda carrega o peso principal da geometria e é falha por variações externas de renderização do DOM.
  - **Resultado Esperado:** Extrair e cobrir mais funções geométricas do `controller` (avaliadores de tamanho e fragmentação isolada) com Vitest/JSDOM, complementando a suíte unitária existente.

## Prioridade 2 (P2) - Melhorias Arquiteturais
- **Configuração genérica do nó manual de quebra:**
  - **Motivação:** `controller.ts` possui hardcode no nome de nó `pageBreak`.
  - **Resultado Esperado:** Tornar o nome da extensão flexível via `PaginationOptions`.
- **Evolução do contrato DOM do host:**
  - **Motivação:** A extensão assume globalmente `document.body` e o `#chrome-layer`.
  - **Resultado Esperado:** Estabelecer uma política segura de injeção contida no root do Tiptap.
- **Generalização gradual de nomenclaturas demonstrativas:**
  - **Motivação:** Fixtures nomeadas sob domínio do APPE (`PE-S`, `PE-L`).
  - **Resultado Esperado:** Nomes neutros descritivos quando couber limpeza.

## Research (Investigação)
- **Fragmentação Intralinha de Tabelas (TABLE_INTRAROW_UNSUPPORTED):**
  - **Motivação:** Atualmente a quebra recai sobre a `<tr>` inteira. Textos monolíticos transbordantes quebram o visual.
  - **Resultado Esperado:** Estratégia algorítmica viável no AST para fracionar a tabela.
- **Suporte Multi-Instância:**
  - **Motivação:** Dependência no DOM global (resolvida pela P2) impede renderização cruzada na mesma aba do navegador.
  - **Resultado Esperado:** Vários `editor` rodando paginação na mesma aba sem colisão geométrica.
- **Estratégia de Versionamento e Publicação:**
  - **Motivação:** Integrar diretamente o pacote npm a longo prazo.
