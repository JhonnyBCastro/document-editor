# REOPEN-001 - Fase 2: Correção Controlada do Lifecycle Geométrico

## 1. Estado Inicial e Auditoria Histórica
- **Baseline Git:** A intervenção partiu do estado exato do `FREEZE-001`.
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

# F2-R2 — Fechamento Final do Nível A

## 1. Diff Funcional Consolidado (H1 + H2)
A intervenção consolidada no `src/controller.ts` para corrigir tanto a obsolescência de limite (H1) quanto o acúmulo sub-posicional exato (H2) consiste em:
```diff
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
```

## 2. Intenção Matemática H2
A expressão `filter(w => w.from < pos)` evita que o loop subtraia erroneamente a altura de um *spacer* que, embora mapeado no mesmo índice `pos`, é inserido subsequentemente no DOM (`side: 1`). Se esse *spacer* exato fosse deduzido do `dispBefore`, a variável `spaceLeft` aumentaria indevidamente, empurrando o layout para baixo e retroalimentando distorções na estabilização seguinte (Acúmulo H2). Como o DOM virtual não desloca o `coordsAtPos` por elementos renderizados *após* a posição, filtrá-los reestabelece o alinhamento com a topologia física real. Não afeta quebras consecutivas nem quebras manuais (pois a posição física `pos` de quebras já instaladas *antes* na árvore prossegue sendo contabilizada rigorosamente).

## 3. Evidências Físicas e Estruturais (Fixture T60)
O roteiro de homologação `t60-bug.spec.cjs` foi expandido e registrou **PASS** em todos os asserts, provando:
- **Igualdade Estrutural:** O JSON extraído em V1, V2 e V3 é **exatamente igual** (`assert.deepStrictEqual`), garantindo nenhuma contaminação.
- **Decorations Residuais:** No estado "Curto" (`shortDoc`), a quantidade de quebras computadas cai exatamente para zero, atestando o lixo coletado.
- **Asserções de Geometria:** Para V1/V2/V3, o array de quebras coincide, cada qual em sua `pos`, com a mesma `reason`, `renderer` e exato `effectiveDisplacement`.
- **Fidelidade Física:** O valor de `effectiveDisplacement` para cada nó mapeia simetricamente a `getBoundingClientRect().height` extraída dos `<tr>` da tabela injetada. 
- **Segunda Estabilização:** Rodar `scheduleRender()` sequencial sobre o V2 não distorce o vetor `breaks` além do limiar físico compensatório da tabela (ex: compensações ínfimas de bordas DOM tabulares).
- **Screenshots:** As capturas da RC local (V1, V2 e V3) comprovam as quatro páginas (renderizadas e salvas no diretório local de log da IDE / artefatos do Agente).
- **Roteiro de Validação:** Utilizando Vanilla Consumer (npm run dev), cole o texto massivo contendo tabelas. Limpe-o (shortDoc). Re-cole o mesmo payload. As quatro páginas serão instanciadas idênticas, sem o distúrbio quilométrico documentado nas submissões anteriores.

## 4. Preservação da PE-L
A homologação `pagination-stress.spec.cjs` validou os marcadores absolutos sem qualquer distúrbio de fixture, e o resultado final foi **idêntico** à RC.2:
- DataRows Tabulares Físicos: 151
- Páginas: 10
- Quebras Automáticas: 7
- Quebras Manuais: 2 
*(Totalizando os 9 eventos matemáticos de layout break documentados na arquitetura).*
- Espaçadores de Tabela Virtuais: 6

## 5. Compatibilidade Ambiental
As dependências do `vanilla-consumer` foram alvos de regressão:
- **Tiptap 3.31.3:** Testes estritos aprovados (**PASS**).
- **Tiptap 2.27.3:** Após a instalação exata (`@tiptap/core@2.27.3 @tiptap/pm@2.27.3`, etc.), todas as matrizes estruturais reportaram **PASS**, confirmando a total neutralidade da abstração do controlador perante as variações de engine ProseMirror antigas.

## 6. Riscos Residuais e Integridade
O risco documentado restringe-se a reacomodações infinitesimais de bordas renderizadas (1~2px) em `<table>` complexas por ação do *box-model* e *border-collapse* do navegador ao separar *rows* durante inserções DOM intensivas. O algoritmo corrigido estabiliza isso num ciclo limítrofe inercial na segunda renderização, evitando a explosão geométrica anterior (que atingia mais de +500px por frame).
O tarball histórico `document-editor-0.1.0-rc.2.tgz` (`2be1f33ce9dd5d5c423d4ab8f6ba26f9a0a05b60b4c39b007f6d30fd7df8adfd`) continua completamente lacrado. Nenhuma ação de publish/push ou tag foi executada.

## 7. Matriz Final de Autorização
| Gate Nível A | Veredito |
|---|---|
| Asserções Geométricas e Semânticas JSON (T60) | **PASS** |
| Acumulação H1 e H2 mitigada | **PASS** |
| Manutenção das métricas PE-L rigorosas | **PASS** |
| Compatibilidade Tiptap 3.31.3 | **PASS** |
| Compatibilidade Tiptap 2.27.3 | **PASS** |

O Nível A está apto à deliberação executiva.
