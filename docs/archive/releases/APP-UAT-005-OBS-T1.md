# APP-UAT-005-OBS-T1 — Auditoria da Apresentação Visual das Quebras

**Origem:** Frente B — Revisor de Integração APPE  
**Natureza:** Investigação Diagnóstica  

## 1. Escopo da Investigação
O objetivo desta auditoria foi diagnosticar duas ocorrências visuais reportadas na RC.4:
1. A ausência de separação visual (fundo cinza) nas quebras de página da paginação tabular (T60), que se apresentam brancas, contrastando com as quebras lineares.
2. A presença de um "retângulo branco" inselecionável acima da toolbar.

Os cenários foram emulados via Puppeteer em um ambiente *vanilla-consumer* com geometria e CSS equivalentes, focando estritamente no motor de renderização (z-index, backgrounds, padding e elementsFromPoint).

---

## 2. Compensação Tabular (T60)

As leituras físicas na quebra entre "Data 35.x" e "Data 36.x" confirmaram:
- **Geometria:** O motor está aplicando corretamente o `padding-top` (ex: `260px` capturado em runtime) na célula `<td/>` de quebra, deslocando o conteúdo com precisão matemática.
- **Fundo da Célula e Tabela:** O `background-color` da `td` e da `table` é transparente (`rgba(0, 0, 0, 0)`).
- **Fundo do Container Pai:** O `background-color` do elemento principal do editor (`.tiptap.ProseMirror`) é branco sólido (`rgb(255, 255, 255)`).

**Diagnóstico Visual:**  
Como a compensação geométrica (via `Decoration.node` e `padding`) ocorre *internamente* aos nós da tabela, o espaço de 260px resultante é transparente. Sendo a tabela filha direta do contêiner `.tiptap` (que possui fundo branco), a área da quebra revela a cor de fundo do próprio editor. 
**Conclusão:** Trata-se de uma consequência estritamente visual (pintura/composição) de se expandir o conteúdo de forma intra-nó em uma superfície de edição monolítica e branca. **Não é uma falha de cálculo geométrico ou estrutural.**

---

## 3. Camada Visual das Páginas (Linear vs Tabular)

- **Cenário Linear:** Em quebras de texto/parágrafos, a biblioteca costuma injetar elementos dedicados (ex: `.page-break-widget`) que fragmentam a ilusão contínua ou possuem estilização (`box-shadow`, margens e fundos) desenhada especificamente para simular a separação cinza entre as folhas, interceptando o fundo branco.
- **Cenário Tabular:** Na arquitetura consolidada na RC.4 (Alternativa B+C), eliminamos deliberadamente o elemento injetado (`<tr class="virtual-page-spacer">`) para proteger a integridade semântica da malha (CellSelection, Colspans). Como resultado, não há um elemento físico no DOM da tabela que possa receber a estilização de "vão cinza" e sombreamento (shadows) das bordas da página. O vão existe matematicamente, mas visualmente é apenas "vazio branco" sobre o fundo do editor.

---

## 4. Retângulo Branco Acima da Toolbar

O rastreio via `document.elementsFromPoint()` nas coordenadas suspeitas apontou a seguinte pilha Z (do mais alto para o mais baixo):
1. `div.tiptap.ProseMirror` (`bg: rgb(255, 255, 255)`)
2. `div.tiptap-container`
3. `body` / `html`

**Diagnóstico Visual:**  
O "retângulo branco" inselecionável inspecionado por Boby não é um elemento ou div independente corrompida. É, na verdade, **a própria superfície de fundo do editor (`.tiptap`)**. 
Como a superfície do editor é um bloco contínuo de fundo branco, qualquer sobreposição da toolbar (seja por posicionamento `absolute`/`fixed`) ou extensão natural do padding bottom do documento fará com que partes do `.tiptap` fiquem visíveis adjacentes à toolbar, aparentando ser um "retângulo em branco".
A impossibilidade de selecioná-lo no inspetor do Chrome ocorre porque ele não é um nó separado, mas sim o prolongamento da área de fundo do contêiner principal.

---

## 5. Parecer e Conclusão

Ambas as ocorrências possuem **origem comum no CSS de pintura e composição visual**, não configurando regressões geométricas, corrupções no JSON ou vazamentos de nós.

- **Sobre a Tabela (T60):** O abandono dos "falsos nós" (como o `tr` espaçador) resolveu a seleção, mas trocou o preenchimento físico (onde se poderia pintar de cinza) por `padding` transparente (onde brilha o branco da folha). Caso se deseje pintar esse vão de cinza futuramente, será necessária uma estratégia visual (ex: `linear-gradient` dinâmico no background da célula ou pseudoelementos `::before` absolutos vinculados à célula que assumam a pintura do vão), sem alterar a estrutura tabular.
- **Sobre a Toolbar:** Recomenda-se a revisão do z-index e margens/paddings da interface de empacotamento (APPE) ao redor da `.tiptap`, visando ocultar a exposição da tela de fundo.

**Nenhuma alteração foi realizada na RC.4 ou no CSS do consumidor.** Aguarda-se deliberação e parecer da Frente B sobre os próximos passos.
