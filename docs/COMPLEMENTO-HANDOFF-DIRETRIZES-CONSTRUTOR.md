# Complemento ao Handoff da Biblioteca — Diretrizes e Prestação de Contas do Construtor

**Data de vigência:** 12/10/2026  
**Escopo:** Frente A — Biblioteca Canônica (`/home/jhonny/TCC/document-editor`)  
**Natureza:** Complemento normativo e operacional ao `handoff.md` e harmonizado com o contrato geral dos construtores (`docs/CONTRATO-CONSTRUTORES.md`).

---

## 1. Finalidade e Papel do Documento

Este complemento fornece diretrizes explícitas para os novos construtores que operam via Antigravity IDE na biblioteca canônica `document-editor`. O objetivo é assegurar execução rastreável, verificável e compreensível, sem reabrir auditorias históricas, campanhas repetitivas de hashes ou suposições operacionais tácitas.

---

## 2. Preservação do Estado de Trabalho e Verificação Prévia

O handoff técnico (`handoff.md`) retrata o estado registrado no corte de 12/10/2026. O construtor não deve presumir que o repositório permanece idêntico nem que o handoff concede autorizações operacionais.

Antes de qualquer intervenção que altere arquivos:
- **Verificar estado do Git:** inspecionar formalmente a distinção entre `HEAD`, branch atual, índice e working tree (`git status`, commits recentes).
- **Confirmar deltas:** atestar a situação dos 11 arquivos modificados e 3 novos registrados na consolidação A antes de qualquer ação, sem descartar alterações locais ou reaplicá-las às cegas.
- **Distinção de artefatos:** separar rigorosamente o código-fonte TypeScript em `src/`, os artefatos compilados em `dist/`, a versão declarada em `package.json` e a versão de fato emitida/consumida.

---

## 3. Estrutura Obrigatória de Prestação de Contas

Ao concluir qualquer tarefa ou etapa, a devolutiva do construtor deve ser estruturada obrigatoriamente nos seguintes 7 tópicos:

1. **Objetivo:** o que a tarefa deveria alcançar.
2. **Estado inicial:** base utilizada, commit/branch de partida e condições encontradas antes da intervenção.
3. **Ações realizadas:** arquivos examinados ou alterados, comandos executados e verificações realmente feitas.
4. **Resultado concreto:** o que mudou, o que foi observado na prática e aderência ao objetivo.
5. **Evidências:** caminhos, trechos de código, commits, saídas de comandos e resultados verificáveis.
6. **Limitações:** o que não foi verificado, o que permanece desconhecido e conclusões que não podem ser extraídas.
7. **Próximo marco:** próxima entrega concreta, dependências diretas e autorizações necessárias.

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

## 8. Limites Estritos de Autorização

Este documento e as diretrizes aqui consolidadas **não concedem autorização** para:
- Modificações de código fora de tarefa autorizada.
- Execução de builds, testes automatizados pesados ou suítes de navegador (Puppeteer/Playwright).
- Instalação ou alteração de pacotes/dependências.
- Operações de escrita no Git (commits, pushes, rebases, merges).
- Publicação de pacotes ou alteração da arquitetura sem escopo deliberado.
