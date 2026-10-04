# REOPEN-001 - Fase 1: Auditoria Causal (CROSS-002)

## 1. Auditoria do Lifecycle e Reprodução da Falha (T60)
A reprodução local utilizando a fixture `T60` no arquivo `tests/e2e/t60-bug.spec.cjs` confirmou integralmente a anomalia (RED regression).
Os resultados da bateria para a fixture tabular revelam uma **acumulação aritmética perfeita**:
- **V1 (Inicialização Direta):** 4 Páginas, 3 Espaçadores com alturas: `252, 252, 252`.
- **V2 (Curto → T60):** 4 Páginas, 3 Espaçadores com alturas acumuladas: `504, 502, 500`.
- **V3 (Curto → T60 → Curto → T60):** 4 Páginas, 3 Espaçadores explodindo para: `1008, 1002, 996`.

### Causa Raiz Causal (O Fluxo do Defeito)
A investigação no `src/controller.ts` e `src/extension.ts` revelou a seguinte cadeia de eventos, confirmando a obsolescência posicional e o acúmulo entre ciclos:
1. **Falta de Mapeamento Transacional:** Em `extension.ts`, a transação do ProseMirror apenas aciona `controller.scheduleRender()`. O conjunto `currentDecorations` (guardado de forma stateful no controller, e não no state do Plugin) **não é mapeado** pelo `tr.mapping`. As posições antigas (ex: 200, 400) continuam existindo de forma absoluta.
2. **Cegueira na Invalidação (`controller.ts` L367):** Quando o documento é substituído por um texto curto (V2 - `shortDoc`), `performLayout` calcula zero quebras (`breaks = []`). No momento de comparar se o layout mudou, o código faz:
   `const currentBreaks = this.currentDecorations.find(0, docSize);`
   Como `docSize` é diminuto (ex: 15), as decorations antigas (nas posições 200, 400) **não são retornadas** por este `find`.
   Logo, `currentBreaks.length` é `0`. A variável `changed` avalia `0 !== 0` resultando em `false`. 
3. **Preservação Indevida do Estado Zumbi:** Como `changed === false`, o bloco que recriaria as decorations (`this.currentDecorations = DecorationSet.create(...)`) não é executado. A classe mantém secretamente as decorations antigas no final do documento virtual.
4. **Acumulação Matemática no Retorno (T60):** Quando `setContent(T60)` é aplicado novamente, o tamanho do documento volta a ser ~2000. O ProseMirror reinsere as decorations antigas no DOM porque elas subitamente caem dentro dos limites! Durante o novo `performLayout()`, o `dispBefore` (L348) soma o `effectiveDisplacement` dessas decorations zumbis (252). Mas como o DOM mede essa geometria antes da projeção, a compensação matemática falha, subtraindo o valor virtual fantasma e injetando a defasagem como novo `spaceLeft`, **dobrando** o tamanho do espaçador (`252 -> 504 -> 1008`).

## 2. Hipóteses Avaliadas
- **H1 (Obsolescência posicional): CONFIRMADO.** O controller mantém um cache sujo de `DecorationSet` não-mapeado, permitindo que componentes sobrevivam a substituições totais.
- **H2 (Obsolescência geométrica): CONFIRMADO.** Os valores fantasmas de `effectiveDisplacement` são lidos do cache sujo e reaplicados ao cálculo do novo gap, inflacionando a decisão.
- **H3 (Ordem de atualização): DESCARTADO.** O DOM atualiza no tempo certo, mas baseia-se em dados ressuscitados indevidamente pela view.
- **H4 (Acumulação entre ciclos): CONFIRMADO.** É o fenômeno aritmético mais visível do defeito, onde cada ciclo soma a geometria fantasma ao novo cálculo.
- **H5 (Estabilização prematura): DESCARTADO.** A estabilização está aguardando o processamento do raf; a falha está no dado, não no tempo.

## 3. Avaliação de Alternativas Corretivas

**Alternativa A — Mapeamento Transacional (Plugin State)**
Migrar a custódia das decorations para o `Plugin.state` (onde ProseMirror as mapeia automaticamente via `tr.mapping.map(decos)`).
- **Vantagens:** Edições incrementais deslocam spacers magicamente sem relayout pesado momentâneo.
- **Riscos:** Em um `setContent` total, o mapeamento pode deletar ou aglutinar todas as decorations no pos 0, destruindo a memória geométrica de qualquer maneira.

**Alternativa B — Invalidação Geométrica (Limpeza Forçada)**
Limpar sumariamente `this.currentDecorations = DecorationSet.empty` ao notar disparidades drásticas de `docSize` no início do `performLayout`.
- **Vantagens:** Impossibilita o vazamento de memória zumbi entre documentos.
- **Riscos:** Pode gerar *flicker* (piscar visual) se limparmos cedo demais num ciclo onde os widgets poderiam ser reaproveitados.

**Alternativa C — Reconstrução Controlada (Correção do Comparador)**
Modificar o ponto cego da invalidação. Usar `this.currentDecorations.find()` (sem os limites de `0 a docSize`) para checar disparidades.
- **Vantagens:** O código perceberia que há 3 decorations na memória, mas 0 no novo array. `changed` seria `true`, forçando a criação de um `DecorationSet.empty` limpo e legítimo. Baixíssima complexidade e não altera a arquitetura.
- **Riscos:** Mínimos, pois o próprio autor arquitetou a checagem com a intenção de limpar o estado quando divergem.

**Estratégia Recomendada:** 
Implementar uma fusão de **C**. O defeito é primariamente causado por uma falha condicional lógica no descarte do cache quando o documento encolhe. A correção deve garantir que *out-of-bounds decorations* engatilhem `changed = true`, somado a proteções no cálculo iterativo para não herdar alturas de widgets não gerenciados no ciclo atual. 

## 4. Próximos Passos (Pendentes - Fase 2)
1. Aguardar autorização de Boby (REOPEN-001 - Fase 2) para alterar o `src/controller.ts`.
2. Implementar e testar a solução focada na limpeza total do estado transitório zumbi.
3. Certificar sob a nova diretriz de ACCEPTANCE-EVIDENCE-001.
