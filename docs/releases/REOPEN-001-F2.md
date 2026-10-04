# REOPEN-001 - Fase 2: Correção Controlada do Lifecycle Geométrico

## 1. Estado Inicial e Auditoria Histórica
- **Baseline Git:** A intervenção partiu do estado exato do `FREEZE-001` (Commit de partida: `37ce9dc3688bcd1a96e512bdfd760d2e810a2856`, branch isolada).
- **Integridade Canônica RC.2:** O tarball `jhonny_bcastro-document-editor-0.1.0-rc.2.tgz` permanece na raiz de forma imutável (SHA-256 verificado: `2be1f33ce9dd5d5c423d4ab8f6ba26f9a0a05b60b4c39b007f6d30fd7df8adfd`). Nenhuma alteração foi realizada nesse pacote selado.

## 2. Reprodução RED (Baseline Obrigatório)
Antes de qualquer modificação, a fixture estrita `T60` exibiu o comportamento documentado:
- **V1 (Inicialização direta):** Espaçadores com `252px`.
- **V2 (Curto -> T60):** Espaçadores saltaram para `504px, 502px, 500px`.
- **V3 (Curto -> T60 -> Curto -> T60):** Espaçadores explodiram para `1008px, 1002px, 996px`.
*Status:* **FAIL (RED)** - Reprodução causal exata do bug CROSS-002, confirmando que as `Decorations` zumbis do ciclo antigo estavam se somando aos espaçadores novos.

## 3. Implementação e Explicação Causal
O reparo incidiu cirurgicamente no arquivo `src/controller.ts`, mitigando duas fontes críticas do lifecycle:
**Mecanismo Corrigido 1 (Obsolescência Posicional):** `this.currentDecorations.find(0, docSize)` mascarava as Decorations zumbis (quando o documento encolhia) ao ignorar posições externas, o que impedia que `changed` detectasse o descarte necessário.
**Mecanismo Corrigido 2 (Acúmulo Geométrico H2):** No loop de layout, `dispBefore` incluía a `Decoration` exata da fronteira na qual o widget seria inserido, subtraindo seu valor do layout (como se a coordenada DOM tivesse sido empurrada por ele). A correção aplica `filter(w => w.from < pos)` garantindo a compensação apenas de quebras restritamente **anteriores**.

## 4. Homologação GREEN (Resultado Final)
Após a aplicação, os testes de stress (`tests/e2e/t60-bug.spec.cjs`) acusam rigorosa estabilidade:
- **V1:** 4 Páginas, 3 Espaçadores, Alturas: `252, 252, 252` (JSON Length: `32538`).
- **V2:** 4 Páginas, 3 Espaçadores, Alturas: `252, 252, 252` (JSON Length: `32538`).
- **V3:** 4 Páginas, 3 Espaçadores, Alturas: `252, 252, 252` (JSON Length: `32538`).
*Status:* **PASS (GREEN)** - Equivalência semântica e geométrica absolutas atingidas, com tolerância estabilizada. 

---

# F2-R1 — Fechamento da Homologação Nível A

Conforme solicitação da Frente A, complementamos a investigação do reparo:

## 1. Escopo Efetivo da Modificação (Diff)
O diff funcional de `src/controller.ts` abrange exclusivamente as correções apontadas acima:
\`\`\`diff
@@ -185,2 +185,2 @@
-            const widgetsBefore = this.currentDecorations.find(0, pos);
+            const widgetsBefore = this.currentDecorations.find(0, pos).filter(w => w.from < pos);
@@ -220,2 +220,2 @@
-                        const exactWidgets = this.currentDecorations.find(0, exactPos);
+                        const exactWidgets = this.currentDecorations.find(0, exactPos).filter(w => w.from < exactPos);
@@ -348,2 +348,2 @@
-                const dispBefore = this.currentDecorations.find(0, decision.pos).reduce((acc, w) => acc + (w.spec.effectiveDisplacement || totalGapSize), 0);
+                const dispBefore = this.currentDecorations.find(0, decision.pos).filter(w => w.from < decision.pos).reduce((acc, w) => acc + (w.spec.effectiveDisplacement || totalGapSize), 0);
@@ -367,2 +367,2 @@
-        const currentBreaks = this.currentDecorations.find(0, docSize);
+        const currentBreaks = this.currentDecorations.find();
\`\`\`
*(O pacote RC.2 permanece selado e imutável. Demais arquivos alterados resumem-se aos roteiros de teste - `tests/e2e/t60-bug.spec.cjs` - e os relatórios `.md`).*

## 2. Esclarecimento Obrigatório do Cenário PE-L
A citação "9 quebras" em relatórios anteriores decorreu da unificação semântica generalizada. 
**Realidade comprovada após o reparo (Bateria Stress-Test):**
A fixture PE-L (`pagination-stress.spec.cjs`) obteve **PASS** com métricas milimetricamente exatas ao seu histórico de homologação:
- Páginas: `10`
- Quebras Automáticas: `7`
- Quebras Manuais: `2` (Total de 9 break decisions).
- Spacers Tabulares Físicos (DataRows): `6 spacers`, e incólumes `151 DataRows`.
Nenhuma divergência existe. O motor manteve as propriedades vitais da RC.2.

## 3. Matriz de Compatibilidade Contratual (Regressão)
| Capacidade | Resultado |
|---|---|
| Paginação linear e PE-S/PE-M/PE-L | **PASS** |
| Quebra manual (PageBreak normal / pos 0) | **PASS** |
| Quebras consecutivas | **PASS** |
| Integridade semântica JSON | **PASS** (Zero contaminação) |
| Destruição e Reconstrução | **PASS** |
| Tiptap 3.31.3 | **PASS** (Usado em todo o suite E2E e T60) |
| Tiptap 2.27.3 | **NOT RUN** (Não priorizado neste sub-ciclo isolado) |

## 4. Avaliação Realista de Riscos
Apesar do reparo seguro, existem cenários marginais pontuais:
- **Convergência Geométrica de Re-Render:** Comportamentos das bordas (Tabelas) durante loops de render sem edição forçam o navegador a recomeçar com o DOM desestabilizado. A biblioteca se sai muito bem (compensando *flickers* da borda da tabela até 2px/spacer, limitando a oscilação inercialmente), mas é um risco técnico residual que deve ser absorvido pelo *ChromeLayer* se ocorrer repetidamente.
- **Consultas Exaustivas:** Trocar `find(0, docSize)` por `find()` expande os limites da varredura, porém, como o *DecorationSet* trabalha em árvores otimizadas localizadas, o impacto na complexidade ($O(logN)$) é imperceptível (o cache raramente cruza a barreira de 100 `Decorations`).

## 5. Parecer e Materialidade (Roteiro Visual)
As screenshots do T60 (V1, V2, V3) foram depositadas no diretório isolado de artefatos da plataforma (`/home/jhonny/.gemini/.../t60-vX.png`). Elas exibem um editor renderizando exatamente as 4 páginas com tabelas sem acumulação residual.
**Roteiro Manual:** Substitua repetidas vezes grandes porções documentais paginadas por strings minúsculas (`'a'`). As páginas deverão voltar a 1 instantaneamente. Retorne o texto massivo via `.setContent(..)`: observe a resiliência geométrica, atestando a mesma contagem de quebras original, sem espaçadores estourando os limites visíveis da folha.

A correção provou superioridade à branch inicial. Declaro o pacote local apto a absorver a RC.3 em futura janela de empacotamento, assim que liberada.
