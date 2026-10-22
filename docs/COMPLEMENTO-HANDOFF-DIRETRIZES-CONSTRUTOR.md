# Complemento ao Handoff da Biblioteca — Diretrizes e Prestação de Contas do Construtor

**Data de vigência:** 12/10/2026  
**Escopo:** Frente A — Biblioteca Canônica (`/home/jhonny/TCC/document-editor`)  
**Natureza:** Complemento normativo e operacional ao `handoff.md` e harmonizado com o contrato geral dos construtores (`docs/CONTRATO-CONSTRUTORES.md`).

---

## 1. Finalidade e Papel do Documento

Este complemento fornece diretrizes explícitas para os novos construtores que operam via Antigravity IDE na biblioteca canônica `document-editor`. O objetivo é assegurar execução rastreável, verificável e compreensível, sem reabrir auditorias históricas, campanhas repetitivas de hashes ou suposições operacionais tácitas.

---

## 2. Preservação do Estado de Trabalho e Verificação Prévia

O handoff técnico (`handoff.md`) retrata o corte de 12/10/2026 (`8338999…`). O histórico evoluiu em dois commits subsequentes:
- `a84ae56b…`: consolidação da etapa A acrescida de `docs/CONTRATO-CONSTRUTORES.md` (15 arquivos no total, e não apenas os 14 da consolidação).
- `1680a590…` (HEAD atual): registro de `handoff.md` e deste complemento, com working tree atualmente limpa.
*Nota de transporte:* A existência desses commits locais e das referências de branch não confirma envio efetivo ao GitHub; o estado do remoto vivo permanece como verificação a ser tratada sob escopo aprovado.

Antes de qualquer intervenção que altere arquivos:
- **Verificar estado do Git:** inspecionar formalmente a distinção entre `HEAD`, branch atual, índice e working tree (`git status`, commits recentes).
- **Distinção de artefatos:** separar rigorosamente o código-fonte TypeScript em `src/`, os artefatos compilados em `dist/`, a versão declarada em `package.json` e a versão de fato emitida/consumida.

---

## 3. Estrutura de Prestação de Contas e Precedência da Biblioteca

Ao concluir qualquer tarefa na biblioteca canônica, a devolutiva do construtor deve ser estruturada nos seguintes 7 tópicos:

1. **Objetivo:** o que a tarefa deveria alcançar.
2. **Estado inicial:** base utilizada, commit/branch de partida e condições encontradas antes da intervenção.
3. **Ações realizadas:** arquivos examinados ou alterados, comandos executados e verificações realmente feitas.
4. **Resultado concreto:** o que mudou, o que foi observado na prática e aderência ao objetivo.
5. **Evidências:** caminhos, trechos de código, commits, saídas de comandos e resultados verificáveis.
6. **Limitações:** o que não foi verificado, o que permanece desconhecido e conclusões que não podem ser extraídas.
7. **Próximo marco:** próxima entrega concreta, dependências diretas e autorizações necessárias.

> **Precedência e Harmonização:** O contrato geral (`docs/CONTRATO-CONSTRUTORES.md`) prevê seis tópicos. Na biblioteca canônica, a formalização autônoma do tópico **"2. Estado inicial"** tem precedência específica devido à sensibilidade do rastreamento de commits, working tree e artefatos compilados. Essa diferença editorial é uma extensão harmonizada e não constitui conflito normativo ou bloqueio técnico.

*Regra de comunicação:* explicar o significado prático das evidências em linguagem direta, sem despejar sequências cegas de hashes, siglas herméticas ou logs extensos.

---

## 4. Classificação Rigorosa do Resultado

Toda conclusão de tarefa deve enquadrar o resultado exclusivamente em uma das seguintes categorias factuais:

- `Implementado, mas ainda não verificado`
- `Verificado em escopo limitado`
- `Demonstrado no cenário prático especificado`
- `Bloqueado` (com evidência e causa impeditiva documentada)
- `Aguardando decisão ou autorização`

Testes unitários ou passagem de checagem de tipos (`tsc`) não constituem prova de comportamento funcional no navegador. Uma observação manual pontual favorável não equivale à homologação da biblioteca.

---

## 5. Disciplina para Mudanças de Código e Revisão Técnica

Quando uma tarefa envolver alteração ou correção de código:
- Especificar problema, arquivos/componentes afetados e justificativa técnica da abordagem adotada.
- Contrastar o comportamento anterior relevante com o comportamento esperado.
- Se houver alternativas plausíveis, explicar o motivo da escolha e as consequências consideradas.
- Não apresentar hipóteses como se fossem causas confirmadas.
- Fornecer evidências e passos suficientes para permitir contestação independente por revisores.

---

## 6. Investigação Técnica da Hipótese de Paginação

O relato de que a primeira página aparenta estar correta e as páginas seguintes apresentam conteúdo progressivamente deslocado para baixo permanece registrado como **hipótese investigativa do usuário**, e **não como defeito comprovado**.

Em eventuais tarefas futuras sobre o tema:
- Não atribuir a causa prematuramente a Core, Presentation, margens, bordas, gap ou comunicação entre camadas.
- Conduzir investigação delimitada isolando com evidências:
  1. *Cálculo e fluxo:* posições ProseMirror, decisões, carriers e deslocamentos efetivos.
  2. *Projeção geométrica:* rects de folhas, Header e Footer gerados no snapshot.
  3. *Representação visual:* DOM rendered versus rects calculados.
  4. *Coordenadas e escala:* conversão entre DocumentLayoutSpace (CSS px pré-transformação) e coordenadas de tela/viewport.
  5. *Atualização de estado:* gatilhos de recálculo e estabilidade.

---

## 7. Relação com a Frente B e com o Usuário

- **Fontes complementares:** o handoff da Frente B (`HANDOFF-LAB.md`) é a referência do laboratório/consumidor experimental; o handoff da Frente A (`handoff.md`) é a referência da biblioteca. Um não substitui o outro.
- **Isolamento de runtime:** não presumir que o Lab consome automaticamente o TypeScript da working tree da biblioteca sem processo de sincronização/vendor formalmente executado.
- **Comunicação executiva:** manter o usuário ciente dos avanços reais, impactos práticos e decisões pendentes em linguagem direta e transparente.

---

## 8. Escopo e Limites de Autorização

- **Ausência de autorização operacional permanente:** Este documento e os materiais de transição não concedem autorização tácita ou permanente para modificações de código, testes automatizados pesados, scripts de navegador, alterações de dependências ou operações Git.
- **Validade do escopo da tarefa:** A ausência de autorização permanente **não significa proibição permanente** de testes, builds ou alterações. Continuam valendo rigorosamente o escopo e as autorizações conferidas à tarefa concreta autorizada pelo usuário. Quando o objetivo da tarefa aprovada exigir uma verificação, build ou alteração, o construtor atua estritamente dentro desses limites delimitados.
