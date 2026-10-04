# ACCEPTANCE-EVIDENCE-001 — Especificação de Homologação

Por determinação formal, todas as futuras correções críticas de funcionalidade, ou extensões de capacidades na biblioteca `@jhonny_bcastro/document-editor`, estão submetidas ao duplo nível de homologação estrita detalhado abaixo. Nenhuma release será candidata sem a comprovação absoluta destes invariantes.

## Nível A — Engenharia da Biblioteca
**(Escopo: Frente A — Guardiã Canônica)**

Operado em total isolamento arquitetural (`document-editor` puro), validando os fundamentos geométricos e semânticos em consumidores genéricos (ex: `vanilla-consumer`).

**Exigências obrigatórias:**
1. **Execução Universal:** Aprovação estrita de todos os testes unitários (`vitest`) e integração (`puppeteer`). Nenhuma regressão nas capacidades lineares, paginação no ponto zero (pos 0) ou identificação manual.
2. **Ciclo Causal Completo:** Apresentação documentada da causa e demonstração irrefutável de sua falência na versão baseline (Reprodução de Defeito: *RED*).
3. **Resiliência a Substituições:** Garantir estabilidade visual (alturas dos espaçadores e total de páginas idênticos) após operações estressantes de sobreposição, tais como ciclos `Curto → Longo → Curto → Longo`.
4. **Verificação de Lifecycle:** O DOM manipulado não pode sofrer acumulações zumbis, provando o recolhimento assíncrono rigoroso.
5. **Agnosticismo a Versões Tiptap:** Ensaios comprovados rodando localmente sem throws no `Tiptap 2.27.3` e `3.31.3` (com *named imports* necessários no host).

## Nível B1 — Homologação da distribuição corretiva no consumidor APPE
**(Escopo: Frente B — Integração Externa)**

Testes reais no ecossistema do TCC (APPE Web/API). Executado exclusivamente após o sucesso irrestrito do Nível A e o encapsulamento físico (tarball).

**Exigências obrigatórias:**
1. **Não Intervenção:** Instalação de um futuro tarball candidato. Uso exclusivo dos imports públicos. Proibido utilizar qualquer tipo de *patch-package*, atalhos via *alias*, edição local em `node_modules` ou importações relativas (`../src`). 
2. **Rota Experimental:** Verificação na rota experimental `/template-v2`. Validar cenários V1/V2/V3 demonstrando a geometria física em relação aos snapshots.
3. **Edição e Integridade:** Demonstrar a edição dinâmica acoplada ao lifecycle Angular mantendo a integridade semântica.
4. **Ciclo Visual:** Observação manual da experiência responsiva e semântica diretamente proferida pelo autor (Boby).

## Nível B2 — Integração institucional ampliada

**Exigências obrigatórias:**
1. **Persistência via API:** Validação do fluxo de envio e recuperação do documento através das pontes REST oficiais do APPE.
2. **Ciclo Acadêmico:** Integração efetiva aos fluxos acadêmicos nativos (tramitação do Plano).
3. **OpenPDF:** Impressão e exportação OpenPDF utilizando a representação JSON armazenada nativamente no banco.

*Nota: O sucesso do Nível B1 não autoriza automaticamente o Nível B2.*

## Matriz de Provas Documentais
Nenhuma suposição compõe evidência. Um relatório de aprovação oficial exige a indexação explícita de:
- **Resultados V1/V2/V3 (quando aplicável):** Alturas (`spacerHeights`), disparos de DOM, e totalização exata das páginas.
- **Logs Físicos:** Excertos cruciais da CLI confirmando zero mutações indevidas do AST JSON.
- **Roteiro Manual:** Passos objetivos declarando "Clique aqui, cole isso, aguarde N segundos, inspecione a altura X".
- **Estado de Bloqueios:** Usar apenas nomenclaturas oficiais: `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`.
