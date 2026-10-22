# Contrato de Trabalho e Comunicação dos Construtores

**Data de vigência:** 12/10/2026  
**Escopo:** Frente A (`document-editor`) e Frente B (`document-editor-reference-lab`)  
**Natureza:** Complemento normativo e reutilizável aos materiais de transição (handoffs) de ambas as frentes.

---

## Finalidade

Este documento estabelece as diretrizes de execução, prestação de contas e comunicação para os novos agentes construtores. Aplica-se de forma coordenada tanto à **Frente A** (desenvolvimento da biblioteca canônica Core/Presentation) quanto à **Frente B** (integração e validação visual no Reference Lab).

Não substitui os handoffs técnicos nem reabre auditorias passadas; define o padrão operacional de trabalho daqui em diante.

---

## 1. Comunicação Obrigatória ao Concluir Cada Etapa

Ao término de qualquer etapa ou entrega, o construtor deverá apresentar um relatório objetivo e compreensível, estruturado estritamente nos seguintes tópicos:

1. **Objetivo:** O que a etapa pretendia alcançar.
2. **Ações realizadas:** Arquivos lidos, alterados, comandos executados e verificações realmente feitas.
3. **Resultado:** O que mudou e o que foi observado na prática.
4. **Evidências:** Arquivos, caminhos, commits, saídas de comandos ou registros relevantes.
5. **Limitações:** O que não foi verificado e quais conclusões não podem ser extraídas.
6. **Próximo marco:** A próxima entrega concreta, suas dependências e se necessita de autorização explícita.

> **Regras de integridade:**
> - Não apresentar ações planejadas como se tivessem sido executadas.
> - Não declarar testes aprovados sem execução real e resultado verificável.
> - Não usar apenas hashes, siglas ou códigos de status sem explicar seu significado prático.

---

## 2. Mudanças de Código

Sempre que uma tarefa envolver alteração de código, o construtor deverá apresentar:

- **Arquivos modificados e motivo** individual de cada alteração.
- **Comportamento esperado:** o que se pretende corrigir ou acrescentar.
- **Verificações executadas e resultados reais:** sem inferências ou suposições.
- **Riscos, efeitos colaterais e questões em aberto:** impactos potenciais em outras camadas.
- **Estado do Git relevante:** discriminar claramente alterações preexistentes que não pertencem à tarefa atual.
- **Distinção de escopo:** diferenciar claramente entre:
  1. *Implementação entregue* (código escrito).
  2. *Validação em escopo limitado* (testes pontuais/sintéticos executados).
  3. *Funcionamento demonstrado no uso real* (comportamento verificado de ponta a ponta).

> **Preservação de trabalho:**
> Preservar estritamente o trabalho preexistente. Não sobrescrever, descartar ou reverter alterações sem identificar previamente sua origem e obter autorização expressa.

---

## 3. Progresso e Encerramento de Etapas

- Toda etapa deve ter um **resultado observável** e um **critério de conclusão definido**.
- O agente deve explicar com precisão o que falta para alcançar esse critério, sem inventar quantidades arbitrárias de etapas futuras quando não puderem ser estimadas com segurança.
- **Evitar ciclos infinitos:** coibir auditorias circulares, checagens repetitivas de hashes ou documentos que não produzam uma decisão ou avanço prático.
- Quando uma evidência adicional não for indispensável à decisão imediata, registrar a limitação e propor que seja tratada em tarefa delimitada posterior.

### Classificação do Encerramento

Ao final de cada tarefa, o resultado deve ser enquadrado exclusivamente em uma das seguintes categorias (sustentada por evidências factuais):

- `Implementado, mas ainda não verificado`
- `Verificado em escopo limitado`
- `Demonstrado no cenário prático especificado`
- `Bloqueado` (especificar motivo impeditivo e evidência)
- `Aguardando decisão ou autorização`

---

## 4. Relação com os Revisores

- O construtor deve fornecer insumos, documentação e passos suficientes para permitir **revisão técnica independente**.
- Não presumir que o próprio resultado está correto meramente por ter passado nos testes que o construtor escolheu executar.
- Em caso de contestação ou divergência apontada por um revisor, responder ao ponto específico com evidências e justificativas técnicas, em vez de simplesmente reiterar a conclusão anterior.
- A contestação fundamentada pelo revisor e a defesa técnica pelo construtor são bem-vindas, desde que pautadas em dados verificáveis.

---

## 5. Comunicação com o Usuário

A comunicação com o usuário deve priorizar clareza executiva e transparência técnica, permitindo entender de imediato:

1. O que foi feito.
2. O que isso muda no projeto.
3. O que foi realmente verificado.
4. O que ainda não funciona, não foi testado ou permanece desconhecido.
5. Qual é a próxima decisão ou ação concreta necessária.

O nível de profundidade técnica deve ser suficiente para permitir auditoria, mas sempre acompanhado de uma explicação em linguagem direta. Não assumir que o usuário decifrará logs extensos, hashes isolados ou siglas internas.

---

## 6. Limites de Autorização

- Este contrato **não concede autorização permanente** para builds, testes automatizados pesados, campanhas de navegador (Puppeteer/Playwright), instalações/upgrades de dependências, commits, publicações ou reorganização de estrutura de diretórios.
- O escopo restrito de cada tarefa e as autorizações preexistentes concedidas continuam valendo.
- Qualquer ação fora do escopo autorizado deve ser proposta como próximo marco e aguardar aprovação explícita antes da execução.
