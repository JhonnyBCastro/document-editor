# Backlog Evolutivo - Document Editor

O pacote encontra-se na baseline funcional 0.1.0-alpha.0 com arquitetura de Rota B (Paginação Visual via Decorations) comprovadamente operante. A tabela abaixo reflete as intenções e manutenções identificadas para futuras iterações.

## Prioridade 0 (P0) - Funcionalidade Crítica
*(Nenhuma pendência crítica estrutural neste momento. O layout resolve PE-L sob stress e mantém isolamento semântico).*

## Prioridade 1 (P1) - Testabilidade, Documentação e Manutenção
- **Unit Testing de Matemáticas Puras:**
  - **Motivação:** A suíte de E2E é custosa e falha por variações externas de renderização do DOM.
  - **Resultado Esperado:** Os avaliadores de tamanho e funções de fragmentação isoladas no `controller` deverão ser cobertas por Jest ou Vitest usando JSDOM/Mocks antes de rodar Puppeteer.
- **Auditoria do Contrato do Host DOM:**
  - **Motivação:** A extensão assume `document.body` e o seletor `#chrome-layer`.
  - **Resultado Esperado:** Tornar os seletores relativos ao container root, suportando flexibilidade nas implementações hospedeiras e preparando caminho para Multi-Instância.

## Prioridade 2 (P2) - Melhorias Arquiteturais
- **Suporte Multi-Instância (Instâncias Simultâneas na Janela):**
  - **Motivação:** Como dependemos de um único `#chrome-layer` global e injeção central no `body`, não é possível rodar dezenas de `editor` renderizados simultaneamente na mesma aba do navegador sem que eles colidam.
  - **Resultado Esperado:** Cada instância gerenciar seu próprio contexto geométrico, escopando `ResizeObserver` e overlays para não vazar `LayoutSnapshot`.

## Research (Investigação)
- **Fragmentação Intralinha de Tabelas (TABLE_INTRAROW_UNSUPPORTED):**
  - **Motivação:** Atualmente quebramos a tabela inteiramente no `<tr>`. Células enormes (textos monolíticos) ou `rowspan` que sozinhos invadem e transbordam toda uma página A4 irão corromper visualmente o rodapé.
  - **Resultado Esperado:** Uma estratégia algorítmica viável no DOM e AST para fatiar o texto de uma única `<td>` transbordante, duplicando virtualmente a célula.
- **Estratégia de Versionamento e Publicação:**
  - **Motivação:** Integrar diretamente o `.tgz` no APPE a longo prazo e sincronizar versões sem atrito.
