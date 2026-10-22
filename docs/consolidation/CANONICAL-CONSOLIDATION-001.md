# CANONICAL-CONSOLIDATION-001

Corte12/10/2026. ConjuntoA limitado a14 arquivos, sobre HEAD83389999102626309dcb90ff8e8a1d38d3f05a4e. Produto permanece candidatoRC4; sem commit/publicação ou homologação por esta etapa.

## Deltas de produto

- **Estabilidade d6918c:** timer consumido libera renderTimeout antes do render; debounce existente preservado. Evita que whenLayoutStable dependa de handle já consumido. Testes cobrem promessas sucessivas/concorrentes, cálculo ativo e reagendamento.
- **Paint-mode a25e691:** legacy default/omissão; composto explícito/fixo; inválido ou hostchrome conflitante rejeitado sem fallback. Core conserva geometria e estilos do consumidor, sem montar composição.
- **B1 d677032:** preserva quatro contribuições de borda1px/solid por cortransparent em composto; testes conservam dimensões/estilo/metadados e variam deslocamentos/margens. Não cria correção visual geral.

Proveniência por commit/pai em [provenance](../provenance.md); API/arquitetura/limitações/backlog vivos complementam este índice. Releases/ADRs antigos ficam intactos. Registros completos de recuperação/diff/checks e governança permanecem externos; nenhum caminhoLab/dependência experimental foi introduzido no runtime.

## Fluxos de verificação

npm test deixou de encadear E2E: apenasunit. Tipagens, build técnico e browser têm comandos e alcances separados noREADME. Os checks autorizadosA são unidade dirigida, suíteunit e tiposCore/Presentation, com resultados externos próprios; não se presume sucesso ou resultado browser.

## Estado preservado

Sem arquivamentoB/movimento de auxiliares, tgz, PNG, logs, resultados ou .bak. Integração oficial/factory/atualização/insets/print composto e homologação permanecem pendentes. M1/S/C/SLP-B-02 e margens horizontais/anomalias visuais conservam seus registros. A working tree é entregue para revisão e decisão de commit porBoby, não para release automático.

---

## Consolidação experimental da arquitetura `composed` (21/10/2026)

Para o relatório completo da consolidação do `composed`, resolução do congelamento em texto contínuo, eliminação dos caminhos executáveis e tipos de `legacy`, e guia de revisão para as Frentes A e B, consulte:
- [CONS-013 — Dossiê Técnico de Consolidação da Arquitetura Composed e Handoff para as Frentes A e B](CONS-013-COMPOSED-CONSOLIDATION-HANDOFF.md)

