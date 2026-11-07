# CONS-006 — Auditoria e Estabilização dos Contratos Públicos

## 1. Objetivo
Auditar e estabilizar os contratos públicos expostos pelo `document-editor`, identificando e tratando responsabilidades históricas de persistência herdadas (como o tipo legados `PersistedDocument`), a fim de alinhar a API à diretriz de "Independência de Produto" (ADR-002) sem gerar quebras estruturais na compatibilidade visual Tiptap 2.x e 3.x recém certificada.

## 2. Estado Inicial
- O pacote foi atestado compatível com versões `2.27.3` e `3.31.3` do Tiptap na CONS-005.
- As responsabilidades de persistência, como o envelope com formato estrito `document-editor-lab`, eram exportados indiscriminadamente no arquivo `types.ts`, sugerindo ao consumidor que a arquitetura forçava o encapsulamento do documento neste envelope, contradizendo o ADR-002.
- Não havia inventário oficial dos contratos geométricos exportados para integração e manipulação via IDE do consumidor.

## 3. Matriz dos Contratos Públicos (Inventário)

Durante a auditoria de `src/index.ts`, `src/types.ts`, e `src/extension.ts`, os seguintes contratos formam a superfície da API pública efetiva do produto, distribuída no `index.d.ts`:

| Identificador          | Público? | Responsabilidade                                                                               | Encaminhamento                    |
|------------------------|----------|------------------------------------------------------------------------------------------------|-----------------------------------|
| `PaginationExtension`  | SIM      | Invocação primária e configuração da extensão no array de instâncias Tiptap.                   | Mantido inalterado.               |
| `PaginationOptions`    | SIM      | Contrato de configuração para inicializar o layout geométrico e o listener `onLayoutStable`.   | Mantido inalterado.               |
| `LayoutConfig`         | SIM      | Argumento central de métricas de página, cabeçalhos, rodapés e políticas visuais.              | Mantido inalterado.               |
| `whenLayoutStable()`   | SIM      | Promise utilitária para sincronização externa baseada no estado de carregamento do controller. | Mantida inalterada.               |
| `LayoutSnapshot`       | SIM      | Envelope informativo de resposta contendo o mapeamento de páginas emitido após renderização.   | Mantido inalterado.               |
| `PageProjection`       | SIM      | Geometria das páginas (bounding rects) descritas no `LayoutSnapshot`.                          | Mantido inalterado.               |
| `BreakDecision`        | SIM      | Array informacional demonstrando quebras aplicadas.                                            | Mantido inalterado.               |
| `LayoutDiagnostic`     | SIM      | Array de diagnósticos operacionais relatando fragmentações severas ou exceções lógicas.        | Mantido inalterado.               |
| `preparePrintSession()`| SIM      | Função de mutação temporária (e devolução) injetando o comportamento unificado de impressão.   | Mantida inalterada.               |
| `PrintSession`         | SIM      | Tipo de controle retornado por `preparePrintSession()`.                                        | Mantida inalterada.               |
| `PersistedDocument`    | NÃO      | Envelope legado de armazenamento do Tiptap que obriga um identificador de schema (`format`).   | **REMOVIDO da biblioteca**.       |
| `BreakCandidate`       | NÃO      | Tipo estritamente funcional usado pelo iterador do Controller no pipeline de políticas.        | Mantido (apenas uso interno).     |

## 4. Diagnóstico de `PersistedDocument`
O tipo `PersistedDocument` foi identificado como:
1. **Inexistente em Runtime:** Nenhuma linha de lógica operacional ou geométrica do núcleo dependia ou invocava esse objeto.
2. **Herdado sem propósito no Produto Independente:** Consumidores como APPE recuperam apenas o `JSON` puro e gerenciam seus próprios DTOs e entidades transacionais (ex: salvamento em base e OpenPDF).
3. **Ausente nos consumidores isolados da CONS-005:** Os consumidores simulados já executavam a validação da PaginationExtension unicamente enviando/recebendo o modelo JSON do ProseMirror.

## 5. Decisão Técnica Adotada
**Estratégia A — Contrato interno e não utilizado**.  
O contrato genérico de persistência (`PersistedDocument`) foi removido da matriz de tipos em `src/types.ts`. A formalização do limite arquitetural diz respeito apenas aos metadados geométricos e manipulação de página na View, declarando com clareza que o `document-editor` é absolutamente **agnóstico** em relação ao schema e envelope de persistência usado pelo backend do projeto consumidor.

## 6. Arquivos Modificados
- `src/types.ts`: Removido bloco contendo `PersistedDocument`.
- `package.json`: A versão do pacote foi bumpada de `0.1.0-alpha.2` para `0.1.0-alpha.3` devido à mutação destrutiva na tipagem declarada `index.d.ts`.
- `docs/backlog.md`: Marcada a CONS-005 como concluída no Backlog.
- `.antigravity-context.md`: Corrigido e alinhado o log da atividade.

## 7. Impacto e Testes (Regressão Semântica)
O pacote atualizado `document-editor-0.1.0-alpha.3.tgz` foi novamente compilado e testado com absoluto sucesso nas suítes híbridas e estresse.
- Compilação das tipagens TypeScript completada sem erros subjacentes de missing property.
- Testes end-to-end de Consumer A (Tiptap 2.27.3) estabilizados `PE-L` rigorosamente sem alterações geométricas (10 páginas geradas com rollback limpo).
- Testes end-to-end de Consumer B (Tiptap 3.31.3) estabilizados identicamente.

## 8. Versionamento
Lançada e publicada localmente a versão `document-editor@0.1.0-alpha.3`. A nova distribuição consolida o contrato público agnóstico sem gerar side-effects sobre o núcleo geométrico ou exigir refatorações destrutivas dos usuários finais da alfa.

## 9. Próxima Etapa
A biblioteca demonstra coesão arquitetural. Com a estabilização atual dos contratos geométricos e atesto universal de integração, a próxima ação recomendada recai sobre os tópicos de P1 ou P2 (e.g., ampliar cobertura unitária, tornar extensão manual flexível ou alinhar escopo institucional para o APPE).
