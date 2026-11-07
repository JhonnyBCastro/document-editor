# REOPEN-002 — Fase 1: Auditoria Causal de Seleção e Apresentação Visual

1. Identidade e Integridade do Ambiente

- **Distribuição Investigada:** `@jhonny_bcastro/document-editor@0.1.0-rc.3`
- **Estado Git:** Commit congelado da RC.3 original. Diretório de trabalho limpo. Nenhuma alteração funcional ou dependência externa introduzida.
- **SHA-256 (RC.2 Histórica):** `2be1f33ce9dd5d5c423d4ab8f6ba26f9a0a05b60b4c39b007f6d30fd7df8adfd`
- **SHA-256 (RC.3 Candidata):** `03bc8cfc0c50408d1e7644be47636a96eec80e86006f49e02abdfbb14acdc442`
  *Ambos os pacotes históricos permanecem preservados e idênticos às suas respectivas criações.*

---

## 2. UAT-001 — Investigação Causal da Seleção Tabular

### 2.1. Auditoria Estática

No arquivo `src/decorations.ts` (linhas 8-12), os espaçadores tabulares são construídos assim:

```typescript
if (b.renderer === 'table-row-spacer') {
    widget = document.createElement('tr')
    widget.className = 'virtual-page-spacer'
    widget.contentEditable = 'false'
    widget.setAttribute('aria-hidden', 'true')
// ...
```

E recebem `pointerEvents = 'none'` na camada visual interna.
A injeção do atributo `contentEditable="false"` num `<tr>` em tabelas ProseMirror impõe uma barreira física na árvore DOM. Quando o usuário clica e arrasta o ponteiro, o navegador tenta resolver o *range* de seleção nativa, mas ao topar num bloco rigidamente intransponível e sem conteúdo de texto que seja alheio ao event loop do ProseMirror, ele colapsa a seleção no limite da borda (resultando em um DOM Selection vazio). O ProseMirror internamente consegue até projetar a intenção da seleção (`S3 PM Selection` não é empty no teste), mas a renderização visual pelo navegador falha por completo, impossibilitando a percepção ou a cópia textual.

### 2.2. Reprodução em Consumidor Independente (Vanilla)

O roteiro `tests/e2e/uat001-selection.spec.cjs` confirmou a denúncia com a fixture `T60`:

- **S1 (Interno: 139-142):** PASS - A seleção restrita à célula funcionou.
- **S2 (Teclado: 1507-1516):** PASS - Shift+Setas transpõem o espaçador normalmente (o ProseMirror mapeia os passos).
- **S3 (Arraste Físico: Linha 33 para Linha 34 transpondo a quebra):** **FAIL (RED)** - O evento nativo do navegador devolveu `rangeCount=1, isCollapsed=true, text=""`. O arraste quebra na barreira visual.
  *(Comportamento canônico confirmado, não restrito ao ambiente Angular da Frente B).*

---

## 3. UAT-003 — Instrumentação Diagnóstica Exposta

### 3.1. Auditoria Estática

Em `src/policies.ts` (linha 32), a quebra de página recebe `reasons = ['natural_overflow_k0']`. Em seguida, em `src/decorations.ts` (linhas 107-120), a estrutura linear constrói e anexa incondicionalmente a *badge* visual:

```typescript
const badge = document.createElement('div')
badge.textContent = b.reasons.join(', ')
badge.style.background = '#ffeb3b' // Amarelo
widget.appendChild(badge)
```

Não existe *nenhuma* trava condicional (`if (layout.debug)` etc.) impedindo a renderização deste balão. Ele é exposto por padrão em qualquer ambiente consumindo a RC.3.

### 3.2. Reprodução (RED)

O script `tests/e2e/uat003-diagnostic.spec.cjs` instanciou 100 parágrafos num consumidor independente e buscou pelo badge amarelo RGB(255, 235, 59).

- **Resultado:** A etiqueta `natural_overflow_k0` foi encontrada fisicamente injetada, visível (`offsetParent !== null`) e com o fundo amarelo.
- **Status:** **FAIL (RED)**. Violação explícita da integridade de interface ordinária do usuário final.

---

## 4. UAT-002 — Esclarecimento Contratual Estático

A análise estática do arquivo `src/policies.ts` detectou a emissão de `TABLE_INTRAROW_UNSUPPORTED` em dois momentos principais durante a `evaluateTablePolicies`:

1. Quando a célula específica não pôde ser resolvida geograficamente no `map.findCell(localCellPos)`.
2. O momento mais crucial: **quando uma única linha excede inteiramente o espaço contínuo da página.**

```typescript
let rowHeight = rowBottomCoords.bottom - rowTopCoords.top;
if (rowHeight > usableHeight) {
    return {
        status: 'blocked',
        code: 'TABLE_INTRAROW_UNSUPPORTED',
        reasons: ['row_exceeds_page_height'],
        // ...
```

**Esclarecimento Contratual:** O diagnóstico *não* ocorre simplesmente se uma linha "não couber" no restante inferior da página (pois aí ela seria empurrada para a próxima página através do corte na linha segura `safeRow`). Ele *só* ocorre quando a altura dessa única `<tr>` (ou `rowspan`) é **maior que toda a altura livre `usableHeight` de uma página 100% limpa.**
Como a arquitetura canônica proíbe a "fragmentação intralinha" (dividir os pixels de uma mesma linha física no meio de um parágrafo da célula), o motor adota a transferência de sacrifício: ele emite `TABLE_INTRAROW_UNSUPPORTED` e recusa o corte (`status: blocked`), permitindo que a linha vaze visualmente pela folha para preservar os dados e evitar um *infinite loop* (tentar quebrar eternamente o que não é quebrável).

---

## 5. Hipóteses Causais e Recomendações (Estratégia)

### UAT-001 (Seleção Tabular)

- **Causa Confirmada:** `contentEditable="false"` num `<tr>` interrompe nativamente a seleção em bloco via cursor do sistema operacional.
- **Alternativas:** Remover o atributo `contentEditable` poderia expor o espaçador a edições corrompidas do usuário. A recomendação da literatura do ProseMirror é usar a *option* `{ ignoreSelection: true }` no `Decoration.widget`, para instruir a engine a lidar pacificamente com a barreira ao resolver interseções, somada possivelmente à injeção de CSS `user-select: none`.
- **Estratégia Recomendada:** Alterar os parâmetros de criação do widget.

### UAT-003 (Diagnósticos Amarelos)

- **Causa Confirmada:** Construção incondicional de DOM para `badge` nos `page-break-widget`.
- **Alternativas:** Atrelar a anexação do `badge` a uma bandeira de debug, ou extinguir sua representação visual, visto que as `reasons` já existem acessivelmente na propriedade `layoutSnapshot.breaks`.
- **Estratégia Recomendada:** Remoção física e definitiva do trecho do `badge` de `src/decorations.ts`, poupando ciclos de CPU do navegador, transferindo 100% da rastreabilidade para o JSON puro. O espaçador manterá sua altura correta intacta.

## 6. Veredicto da Fase 1

As anomalias denunciadas pela Frente B e pelo UAT do APPE foram confirmadas perfeitamente no núcleo canônico distribuído, gerando cenários reprodutíveis, sem a interferência do consumidor. Nenhuma linha de código foi editada. Recomendo autorizar a **REOPEN-002 — Fase 2 (Implementação Corretiva)** para resolver pontualmente as UAT-001 e UAT-003 sob a malha de testes RED agora criada. O UAT-002 fica documentado como *comportamento projetado e esperado* da arquitetura sem fragmentação.
