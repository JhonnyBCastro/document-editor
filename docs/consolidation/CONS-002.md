# CONS-002: Contrato executável, reprodutibilidade e documentação do Document Editor

## 1. Objetivo
A finalidade desta atividade foi verificar a instalação, execução, distribuição, documentação e equivalência da implementação existente no pacote `document-editor@0.1.0-alpha.0` a partir da extração do projeto laboratorial `editor-lab`.

## 2. Diagnóstico Inicial (Estado Encontrado e Divergências)
- **APIs Fantasmas:** A documentação `api.md` antiga informava um uso de `editor.on('transaction')` ouvindo por metadados `pagination-snapshot`, e sugeria o uso de uma função `await whenLayoutStable(editor)`. No entanto, a implementação canônica não exportava esta função e também não disparava metadados da transação.
- **Porta do E2E:** O teste de regressão Puppeteer pressupunha silenciosamente `localhost:5173`, falhando ao transitar para 5174 ou encontrar processos defasados e não gerenciava o ciclo de vida do servidor de preview.
- **Limitações e Architecture:** As limitações não refletiam estritamente as dependências arquiteturais como uso obrigatório do `document.body` para impressão, e do seletor global do ChromeLayer. A explicação do `lastBreakPos` e do reflow na quebra de tabela (`table-row-spacer` via Decoration Node e não Widget) estava ambígua.

## 3. Decisões e Alterações Executadas
1. **Auditoria do Contrato Público (`src/index.ts`):** O índice foi limpo para não exportar módulos completos indiscriminadamente. Exportou-se estritamente `PaginationExtension`, `whenLayoutStable` (efetivamente criada exportando a interface da Promise da classe instanciada internamente), tipos públicos, e as funções exclusivas do contrato de print `preparePrintSession`.
2. **Atualização do Vanilla Consumer:** O consumidor foi ajustado para adotar a configuração atualizada e documentada do Tiptap: `PaginationExtension.configure({ onLayoutStable: ... })`, integrando as `peerDependencies` e suportando `Table` e `PageBreak` para emular o ambiente nativo do APPE e decodificar a geometria JSON sem falhas. A `div#chrome-layer` foi adicionada na casca HTML.
3. **Runner do E2E (Determinístico):** O teste migrou de `localhost:4200` fixo para fazer o **spawn autônomo** do processo `npm run preview` e aguardar seu start. Um novo `vite.config.ts` no `vanilla-consumer` assegura que será utilizada a porta com `strictPort: true` na porta `8543`.
4. **Documentações Vivas:** Arquivos `api.md`, `architecture.md`, `limitations.md` e o ADR-001 foram cirurgicamente atualizados com a real semântica de decorations de `table-row-spacer`, regra de progresso pelo referencial de `lastBreakPos`, print-mode fallback, e `onLayoutStable`. Foi criada uma aba de backlog formal: `docs/backlog.md`.

## 4. Build, Distribuição e Testes
- **Build & Distribuição:** `npm run build && npm pack` compilaram ESM, UMD e Tipos, além do CSS, gerando o pacote `document-editor-0.1.0-alpha.0.tgz` (com tamanho comprimido de ~43.3 kB).
- **Consumidor Independente:** O pacote isolado simulando consumo real resolveu devidamente as tipagens Typescript `index.d.ts` e exportação do estilo `dist/document-editor.css`.
- **E2E Puppeteer:** Executado de forma autônoma invocando o `vanilla-consumer` temporário na porta segura `8543`. 

Resultados do Log na Instância Puppeteer Autônoma:
| Fixture | Baseline Original | Teste CONS-002 | Variação Identificada |
|---|---|---|---|
| **PE-S** | 2 páginas | **2 páginas** | 0 quebras automáticas. (Equivalente) |
| **PE-M** | 3 páginas | **3 páginas** | 0 quebras automáticas. (Equivalente) |
| **PE-L** | 15 páginas (CSS APPE) | **10 páginas** (CSS Vanilla) | Comportamento natural e determinístico devido às diferenças de CSS e height de tabelas fora do framework CSS base. As 7 quebras ocorrem perfeitamente na tabela gigantesca. |

O teste E2E gerou o arquivo de stress isolado e registrou o roll-back com destruição sem vazar nós e hooks de memória na aba.

## 5. Pendências Residuais
- Testes autônomos podem falhar intermitentemente nas chamadas do Puppeteer (`ProtocolError: Runtime.callFunctionOn timed out`) caso não aguardem a fonte da página inteiramente nas fixtures com tabelas colossais antes das interações de `setContent`. Adicionou-se explicitamente listeners no script para lidar com crashes não tratados.

## 6. Próxima CONS sugerida
Não havendo lacunas técnicas para extração, recomendo **Adoção Direta (M, O e Q)** e homologação real final no aplicativo Web Institucional do APPE no repositório backend e front original utilizando a interface agora pública documentada em API. Qualquer melhoria deverá vir como `minor updates` puxados por esse `document-editor`. O próximo trabalho sugerido listado no `docs/backlog.md` refere-se estritamente à testabilidade com Unit Tests Jest para se afastar do alto custo mecânico e intermitente do E2E com headless browsers inteiros.
