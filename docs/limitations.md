# Limitações atuais

Corte12/10/2026. Implementação e testes têm alcance delimitado; a consolidação não homologa a biblioteca.

- **Composição:** legacy é default; composed neutraliza pintura do Core e conserva bordas geométricas B1 transparentes. Não oferece montagem pronta, insets automáticos, factory/bridge/updateLayout pública, rollback integrado ou impressão composta suportada.
- **Atualização:** estabilização local não garante atualização por toda edição/fontes/scroll. O trigger por tamanho/metadado pode não cobrir mudanças de mesmo tamanho. Não há correção geral das anomalias visuais observadas na referência experimental.
- **Lifecycle/multi-instância:** impressão usa lock/classe global do body; fontes/frames e cancelamento integral não estão certificados. Ownership local não prova coexistência perfeita de múltiplos editores.
- **Tabelas:** quebras por fronteiras de linhas; conteúdo/rowspan que exige fragmentação intralinha pode produzir TABLE_INTRAROW_UNSUPPORTED. Colspan adaptado não resolve todo caso de célula gigante.
- **DOM:** medição interativa depende de browser/DOM/fontes; SSR não é suportado como mecanismo de paginação visual. Snapshot sem diagnóstico não garante equivalência com renderização PDF externa.
- **Tipos/PM:** peers2/3 e ensaios2.27.3/3.31.3 não certificam todos os minors nem singleton global. Toolchainunit instalada mistura Core/PM2 e StarterKit3; unidade/tipos não atestam todo grafo transitivo/bundle.
- **Evidência browser:** campanha passiva histórica atendeu comparaçõesL/T delimitadas, conservou diferençasS e não homologou uso arbitrário. Imagem legível não valida seleção/clipboard/edição/multipágina. Sessão manual posterior foi interrompida por supervisão; vídeo é complemento separado, não reparação dos registros.
- **M1/S/C:** testemunho de altura/cascata M1 permanece UNAVAILABLE; S e margens horizontais independentes continuam pendentes. Contrato diferencialC não é prova absoluta M1; avaliador/helpers experimentais não são parte do produto.
- **Exemplos/artefatos:** Vanilla usa tarballRC4 histórico, Presentation usa snapshot sintético e manifesto incompleto de dependência. Dist existente e tarballs não foram emitidos por esta consolidação. Runnerstress compara comprimento JSON, grava resultado na raiz e catch pode não sinalizar erro; não é oráculo semântico suficiente.

Reservas históricas de identidade/empacotamento/temporalidade e Gate Vanilla conservam seus alcances. Ver [backlog](backlog.md) para ações ainda dependentes de decisão e [índice](consolidation/CANONICAL-CONSOLIDATION-001.md) para proveniência delimitada.
