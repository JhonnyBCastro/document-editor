# RC.4 — Limitações Conhecidas e Comportamento da Seleção Tabular

**Ressalva Oficial:** RC.4 aceita com ressalvas no UAT humano B1-05.

As ocorrências **UAT-001A** e **UAT-001D** permanecem formalmente abertas para tratamento posterior. Não são declaradas como corrigidas, tampouco descartadas. O registro desta admissão documental faz parte integral da homologação B1 e da revisão cruzada da Frente A.

---

## 1. Contexto Arquitetural

A arquitetura precedente (RC.3) dependia da criação de um elemento transitório (um `<tr>` fictício contendo `div`) como espaçador físico no fluxo do `tbody`. Já a RC.4 eliminou as linhas `<tr>` fictícias em favor de compensações geométricas (padding CSS) associadas diretamente a `<tr>` e `<td>` reais, embora continue utilizando `Decorations` transitórias de apresentação. A continuidade preservada diz respeito principalmente à estrutura matricial de linhas e células semânticas, evitando falsos espaçadores no DOM real.

Nos ensaios controlados (S1, S2, S3), este novo mecanismo demonstrou capacidade de sustentar de forma contínua e favorável o arrasto e a conversão em `CellSelection` pelo gap visual. No entanto, o sistema e o pacote RC.4 não afirmam ter resolvido universalmente todos os problemas de seleção tabular do Tiptap.

---

## 2. Registro de Ocorrências (UAT-001)

### UAT-001A — Feedback visual ao iniciar dentro de célula
Quando a ação de arraste é iniciada diretamente do interior da área útil de uma célula, é observável que a seleção lógica prossegue e o conteúdo fica factível para cópia (`CellSelection` forma-se de fato e classes `selectedCell` se ativam nos DOM nodes pertinentes). Porém, o feedback de destaque gráfico na interface humana pode se apresentar insuficientemente perceptível ou invisível.
- **Classificação:** Deficiência conhecida de UX (Aberta).
- **Nota:** A causa da ausência de pintura não pode ser atribuída exclusivamente ao CSS (z-index ou opacity, p.ex.) sem prévia demonstração isolada.

### UAT-001B — Seleção iniciada no parágrafo anterior
Um arraste desencadeado a partir de um nó textual regular (ex. `<p>`), antes da tabela, resulta em captação favorável, transpassando o complexo tabular de modo eficaz na cópia de dados.
- **Classificação:** Comportamento funcional documentado.
- **Nota:** Este trajeto colateral exequível não substitui, anula, ou sana as ocorrências documentadas em UAT-001A e UAT-001D.

### UAT-001C — Margem branca interna da A4
Há nítida distinção fisiológica entre os espaços vazios e passivos:
- *Margem branca interna:* Componente inerente e clicável da própria superfície do `ProseMirror`.
- *Wrapper cinza externo:* Região ornamental/fundo neutro fora da interface gráfica (DOM scope).
- *Células (`td`/`th`):* Superfície de dados da tabela.

O início do clique-arraste pela margem branca interna propicia a captura como `TextSelection`, forçando em determinados perfis uma ancoragem de origem visual deslocada (ex: desde o início físico do documento tabular). As tentativas emuladas em código devem respeitar a origem na margem da folha, não cabendo substituí-la por controles iniciados na região do wrapper cinza.
- **Classificação:** Comportamento conhecido de interação e ancoragem. Causa específica inconclusiva em RC.4.

### UAT-001D — Seleção integral no limite estrutural
As observações físicas sobre a captura arrastada na fronteira demarcam os seguintes comportamentos (Matriz Discriminante):

| Cenário | Condição | Resultado Observado |
|:---:|:---|:---|
| **L1** | Seleção parcial da tabela. | Seleção absolutamente funcional. |
| **L2** | Seleção terminando **exatamente** no limite estrutural final da tabela. | `TextSelection` colapsada (`from=6`, `to=6`, `empty=true`). |
| **L3** | Seleção ultrapassando a tabela e incluindo um conteúdo textual de parágrafo subsequente. | Destaque e evento de cópia amplamente funcionais conforme observação humana. |

- Para **L2**, ressalta-se que o browser aciona nativamente um evento *"Copy"*. Porém, a `Clipboard` da máquina *não é substituída* (mantendo um dado plantado anteriormente como `SENTINEL_CLIPBOARD`). Esta falência silenciosa de transferência evidencia que a simples emissão do evento Copy não significa cópia lógica plena em ProseMirror.
- Para **L3**, destaca-se que, apesar da reprodutibilidade autômata (Puppeteer) possuir dificuldades de aderência ao tracking da trajetória de transição fina, a verificação externa executada manualmente atesta o resultado positivo.

---

## 3. Controles Base (Sem PaginationExtension) e Causalidades

A patologia observada no cenário **L2** não se restringe a documentos multipáginas; é constatada analogamente em tabelas curtas (aonde nenhuma fragmentação ou distanciador CSS ocorre).
Adicionalmente, houve relato oficial comunicado pela *Frente B* verificando incidência equivalente também em implementações cruas desprovidas da própria `PaginationExtension`. Qualquer evidência bruta a respeito atua como divisor crucial da pesquisa. 

- **Atenção (Governança):** Fica proibido declarar a `PaginationExtension` como causa isolada e exclusiva do travamento relatado na UAT-001D. Analogamente, não está garantida isenção imediata da biblioteca na perturbação da árvore antes de apuração completa de responsabilidades do `prosemirror-tables` vs `Tiptap` nativo. Não emitir inferências finais absolutas.

---

## 4. Controles D2-IN e D2-OUT

Resultados das imitações de limites espaciais documentam diferenças cardinais de *mouseup* (soltura):
- **D2-IN:** Soltar o arraste estritamente *dentro* do plano focal do `ProseMirror` compila a formatação da `CellSelection` de ponta-a-ponta. Cópia bem-sucedida.
- **D2-OUT:** Soltar o clique por sobre o container/fundo da aplicação (Wrapper cinza) resultou em seleção truncada e cópia incompleta, retornando posições neutras via `posAtCoords = null` e comprimindo retrospectivamente o range para apenas uma célula original (A1). Não foi demonstrada corrupção do documento semântico.

Estes testes expõem as severas tolerâncias da superfície de captura do ProseMirror, e sob hipótese alguma representam invalidação ou pretexto para contornar a UAT-001C, onde as margens originais internas sofrem da inconsistência de seleção sem estarem caindo em D2-OUT.

---

## 5. Distinções Conceituais Rigorosas (Disclaimer)

É mandatório em qualquer prosseguimento dessa questão observar isoladamente as instâncias que compõem a operação. Uma etapa não pode definir outra por inferência:
1. `TextSelection` x `CellSelection` do framework.
2. Estado estrito da seleção bruta (via `window.getSelection()`).
3. Destaque Visual (UI).
4. O conteúdo efetivo inserido na *Transfer Área/Clipboard*.
5. A integridade semântica da malha (nós de dados reais).

A seleção lógica não significa ausência de problemas operacionais. Uma anomalia visual (ex.: pintar poucas células) não constitui desmoronamento lógico estrutural de dados, e a falta de visibilidade não deve ser assumida sumariamente como perca semântica documental.

---

## 6. Matriz Recomendada de Regressão

Com vistas a um retorno pericial ou eventual *backlog* em tempo hábil futuro, toda diligência investigativa sobre `UAT-001A` e `UAT-001D` requer o ensaio dos pontos:

- Arraste iniciado diretamente dentro de células.
- Destaque perceptível de `selectedCell`.
- Seleção iniciada na margem interna A4.
- Seleção parcial da tabela.
- Seleção integral terminando exatamente no limite estrutural.
- Seleção ultrapassando a tabela e incluindo um caractere posterior.
- Comparação entre `TextSelection` e `CellSelection`.
- Copy/Paste textual e HTML, com conferência estrita do conteúdo transferido.
- Controle com e sem paginação, quando aplicável.
- Seleção através de fronteiras virtuais.
- Ausência de contaminação do JSON.
- Repetição manual do gesto original por *Boby*.

*(Obs: Este anexo presta função de catálogo. O acionamento efetivo da investigação não é automático.)*

---

## 7. Proveniência Investigativa (Trilha Auditora)

Referências dos artefatos da bateria UAT B1 e seus derivados:
- `CROSS-005/R1`
- `APP-VALIDATION-005-B1`
- `APP-UAT-005-T1-R1`
- `APP-UAT-005-T1-R2`
- `APP-UAT-005-T1-R3`
- `APP-UAT-005-T1-R4`

*Toda observância de controle sem PaginationExtension baseia-se em relato emitido pela Frente B; não se tratando portanto de materialidade fabricada pela Frente A dentro desta suíte, preenchendo assim as ressalvas de reprodução.*
