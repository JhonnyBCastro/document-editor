# CROSS-LAB-001/PRESENTATION-VANILLA-PAINT-MODE-IMPL-001 — entrega à Frente A

Implementação isolada delimitada. Autoridade final: Boby. Construtor da biblioteca sob Frente A. Data: 08/10/2026, America/Sao_Paulo. Resultado: seleção explícita de modo e neutralização de pintura do Core; não constitui composição pronta, release ou homologação. Gate Vanilla não homologado.

## Identidade, isolamento e fontes

Base: d6918c1233030667f3c8aae3ccf2e41f3787babb. Pai histórico: 8a8f3ef45df1cc6e21bd491ad3a482cd155ef3f8. HEAD inicial igual à base, status inicial vazio.

Fonte congelada: /home/jhonny/document-editor/PRESENTATION-001-CANDIDATE-d6918c1.

Checkout de implementação: /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-IMPL-001-CANDIDATE. Branch: paint-mode-impl-001. Clone Git independente criado com `git clone --no-hardlinks --no-checkout /home/jhonny/document-editor/PRESENTATION-001-CANDIDATE-d6918c1 PAINT-MODE-IMPL-001-CANDIDATE`, seguido de `git checkout -b paint-mode-impl-001 d6918c1233030667f3c8aae3ccf2e41f3787babb`. A nova identidade é o commit que contém este documento; seu SHA completo, pai e estado final constam em /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-IMPL-001-EVIDENCE/IDENTITY.json, evitando autorreferência circular no commit.

Raiz de evidências: /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-IMPL-001-EVIDENCE. Diff integral em CANDIDATE.diff; inventários em FILES.json e ARTIFACTS.sha256; resultados brutos em 01-targeted.log a 06-build.log; preflight em PREFLIGHT.json; preservação de todos os arquivos rastreados da base em PRESERVATION.json. Manifesto exclui a si próprio; hashes demonstram identidade, não correção funcional. Nenhuma mensagem externa foi enviada à Frente A/B.

Instruções do AGENTS.md do projeto preservadas. Não encontrados AGENTS.md adicionais aplicáveis na fonte/nas regiões src e docs. Consultados: diretiva anexada /home/jhonny/.codex/attachments/6cb4cb0f-bb0c-40fb-9712-660a005c8cd8/Texto colado.txt; ratificação recebida no chat; preparação documental aceita e revisão encaminhada; fontes Core, Presentation, ADR-003 e F1 já lidas; package.json, lockfile apenas por hash de preservação, configs Vitest/TypeScript/Vite, testes existentes pertinentes e measurement/index. Scripts foram lidos antes de execução. O arquivo físico ARCHITECTURE-CONTRACT-CONSOLIDATION-001 não foi localizado em busca dirigida por nome e cabeçalho nas raízes locais pertinentes; seu conteúdo não é presumido. A diretiva atual explicita o contrato necessário ao recorte, e a ratificação está disponível na conversa. Não houve necessidade de ampliar o escopo por essa lacuna.

node_modules da fonte estava disponível e foi copiado integralmente para o checkout; symlinks internos relativos permanecem locais. Inspeção não encontrou symlinks para dependências externas compartilhadas. Sem instalação, atualização de dependências ou lockfile. Versões efetivas: Node 22.23.3, npm 10.9.9, Git 2.50.1, TypeScript 5.9.3, Vitest 5.0.3, Vite 6.4.3, vite-plugin-dts 4.5.4, JSDOM 30.1.1, @tiptap/core e @tiptap/pm 2.27.3, StarterKit 3.31.4. Versões efetivas são registro do ambiente existente, não declaração de compatibilidade ampliada.

## Alterações e mapa de requisitos

| Arquivo / região | Mudança | Requisitos da diretiva |
|---|---|---|
| src/types.ts / PaginationOptions | tipo PaginationVisualMode e opção documentada; default/fixação/conflito/limite de composição | §3 seleção e contrato |
| src/extension.ts / addOptions e criação do controller | default legacy e transporte escalar da opção; trigger/scheduler intactos | §3 default, captura e import independente |
| src/controller.ts / início do constructor | rejeitar modo desconhecido e chrome definido em composed antes de criar DOM ou tocar parent; capturar readonly | §3 validação sem fallback e modo fixo |
| src/controller.ts / aquisição de chrome | somente legacy cria chrome e ajusta posicionamento do parent; campo pode estar ausente | §5 ausência de chrome e mutação de parent no composed |
| src/controller.ts / emissão de decorações e pintura PM | encaminhar modo capturado; só legacy escreve background/boxShadow; atualização chrome já condicionada à presença | §5 neutralização e preservação de estilos externos |
| src/decorations.ts / propriedades decorativas | condicionar apenas background, borderTop/borderBottom e boxShadow; manter nós/caixas/widgets/offsets/altura/spec/metadados | §5 geometria preservada, sem ocultação |
| tests/unit/paint-mode.spec.ts | 20 casos de contrato, efeitos DOM, compatibilidade direta/extension, captura e três renderers | §6 itens 1–9 |
| docs/PAINT-MODE-IMPL-001-DELIVERY.md | proveniência, resultados, decisões e limites | §9 entrega |

Decisões locais: argumento visualMode final opcional no constructor preserva chamadas de até cinco argumentos; helper de decorações recebe argumento final opcional default legacy. Não há novo export de composição ou mudança de manifesto. Validação ocorre no início do constructor, antes dos efeitos próprios do controller; isso não promete rollback dos recursos do editor/framework criado antes do controller. A expressão chromeLayerElement !== undefined também rejeita null em runtime no modo composto. O controller captura valor escalar; mutar options depois não troca o modo. Não se implementou transição, limpeza/restauração de transição ou transparência forçada do PM. Em composed, nenhum estilo do consumidor é apagado para simular neutralização.

## Verificações técnicas e resultados

Todos os comandos seguintes executados no checkout /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-IMPL-001-CANDIDATE. Cada execução tem stdout/stderr combinados e exit code registrados nos arquivos externos .log/.json.

| Comando exato | Resultado efetivo |
|---|---|
| `node_modules/.bin/vitest run tests/unit/paint-mode.spec.ts` (primeira invocação) | exit 1; 18 PASS, 2 FAIL no normalizador do teste |
| `node_modules/.bin/vitest run tests/unit/paint-mode.spec.ts` (após correção do auxiliar) | exit 0; 20/20 PASS |
| `npm run test:unit` | exit 0; 6 arquivos, 50/50 PASS |
| `node_modules/.bin/tsc --noEmit -p tsconfig.json` | exit 0, sem saída |
| `node_modules/.bin/tsc --noEmit -p tsconfig.presentation.json` | exit 0, sem saída |
| `npm run build` | exit 0; dois builds Vite existentes concluídos |
| `git diff --check` | exit 0, sem saída |

Falha inicial preservada: normalizador do teste removia propriedades CSS em sequência; JSDOM podia reconstituir/remanescer a shorthand background transparent. Reprodução delimitada com JSDOM confirmou diferença de enumeração e remoção de shorthand. Corrigido somente o auxiliar para reconstruir a lista completa de declarações não decorativas, mantendo comparação exata de estrutura/geometria/metadados e verificação independente de ausência de pintura. Nenhuma assertion foi relaxada, nenhuma fixture alterada e nenhum contrato ou código de produto foi mudado em reação a essa falha.

Cobertura nova: omissão e legacy explícito preservam chrome/fundo/sombra e restauração histórica do parent; chamada direta anterior com host chrome preserva filhos terceiros; composed não cria DOM chrome nem consulta/muta posicionamento do parent, não escreve estilos externos mesmo em layouts repetidos e suporta destroy sem chrome; inválidos (incluindo null) e conflito de host são rejeitados antes de efeitos próprios do controller; mutação de configuração original e opções da extensão não troca modo; import de Presentation não altera default; caminho real de quebra manual recebe composed; os três renderers mantêm nós, posições PM, specs, razões, deslocamentos, caixas, margens negativas e node attrs de tabela, removendo somente pintura.

A compensação CSS de células permanece byte-idêntica, inclusive fórmula break-gap+cell-padding. Testes DOM/unitários verificam invariantes de emissão e estilos, não medição real de padding/linhas/tabelas em browser. Não foi alterado o include dos scripts existentes nem executada suíte e2e/semântica.

## Preservação, limitações e parada

Todos os arquivos rastreados da base fora dos quatro arquivos autorizados foram comparados byte a byte por SHA-256, inclusive src/chrome.ts, src/presentation/**, CSS, package.json/exports/lockfile, configs de distribuição, projection/measurement/políticas/snapshot e testes históricos. Apenas um teste novo e este documento foram adicionados. A fonte congelada permanece com HEAD/pai originais e estado Git vazio. Escopo da preservação material: arquivos rastreados da base; não é nova auditoria integral de tarballs, arquivos ignorados, LAB ou campanhas históricas.

Build gerou arquivos apenas no dist ignorado do novo checkout; dependências e artefatos de build não fazem parte do commit. O build foi técnico, sem pack/publicação. Não houve alteração de scheduler, trigger doc.content.size, políticas, compensações, formato snapshot ou lifecycle geral; a correção histórica de renderTimeout foi preservada.

Browser ainda necessário, sob diretiva própria: geometria real comparável com os mesmos insets/conteúdo, primeira página e múltiplas posteriores, tabelas/manuais, CSS externo, pintura/stacking/hit-testing e interação. Neutralizar pintura do Core não monta Presentation, não aplica insets e não garante conteúdo visualmente correto sozinho. Não se transferem PASS históricos; F03 isolada não prova suficiência multipágina. A suite existente e build não homologam Gate Vanilla.

Factory, bridge público, atualização suportada, insets automáticos, adaptação de running content, impressão composta, cancelamento geral e canais novos de erro permanecem fora do escopo. Nenhum navegador, clipboard, campanha histórica, Gate, pack, release, push ou merge executado. Não houve SCOPE_CHANGE_REQUIRED: o recorte foi concluído sem modificar arquivos protegidos.

G01/G02 encerrados, precedência e identidades históricas preservadas. Novo commit local somente para revisão; d6918c... continua identificando exclusivamente os bytes históricos. **Entrega à Frente A e PARAR. Nenhum resultado técnico libera campanha posterior, ampliação de escopo ou homologação.**

## Saídas brutas das verificações autorizadas

### 01-targeted.log

```text

 RUN  v5.0.3 /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-IMPL-001-CANDIDATE

 ❯ tests/unit/paint-mode.spec.ts (20 tests | 2 failed) 259ms
   ❯ paint mode: decorations preserve geometry and metadata (3)
     × only removes paint for linear-widget 15ms
     × only removes paint for manual-spacer 6ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/unit/paint-mode.spec.ts > paint mode: decorations preserve geometry and metadata > only removes paint for linear-widget
 FAIL  tests/unit/paint-mode.spec.ts > paint mode: decorations preserve geometry and metadata > only removes paint for manual-spacer
AssertionError: expected '<div class="page-break-widget" data-r…' to be '<div class="page-break-widget" data-r…' // Object.is equality

Expected: "<div class="page-break-widget" data-reasons="fixture_reason" data-displacement="240" style="height: 240px; width: 100%; background: transparent; position: relative; margin-left: -50px; margin-right: -60px;"><div style="position: absolute; top: 0px; width: 100%; height: 120px;"></div><div style="position: absolute; top: 120px; width: 100%; height: 20px;"></div><div style="position: absolute; bottom: 0px; width: 100%; height: 100px;"></div></div>"
Received: "<div class="page-break-widget" data-reasons="fixture_reason" data-displacement="240" style="height: 240px; width: 100%; position: relative; margin-left: -50px; margin-right: -60px;"><div style="position: absolute; top: 0px; width: 100%; height: 120px;"></div><div style="position: absolute; top: 120px; width: 100%; height: 20px;"></div><div style="position: absolute; bottom: 0px; width: 100%; height: 100px;"></div></div>"

 ❯ tests/unit/paint-mode.spec.ts:228:39
    226|         const newRoot = widgetDOM(composed[index]);
    227|         expect(widgetDOM(omitted[index]).outerHTML).toBe(oldRoot.outer…
    228|         expect(withoutPaint(newRoot)).toBe(withoutPaint(oldRoot));
       |                                       ^
    229|         expectNoPaint(newRoot);
    230|         expect(newRoot.children).toHaveLength(3);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯


 Test Files  1 failed (1)
      Tests  2 failed | 18 passed (20)
   Start at  17:00:54
   Duration  1.22s (environment 42%, tests 24%, transform 24%, import 10%)
```

### 02-targeted.log

```text

 RUN  v5.0.3 /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-IMPL-001-CANDIDATE


 Test Files  1 passed (1)
      Tests  20 passed (20)
   Start at  17:01:20
   Duration  1.14s (environment 42%, tests 25%, transform 22%, import 11%)
```

### 03-unit.log

```text

> @jhonny_bcastro/document-editor@0.1.0-rc.4 test:unit
> vitest run


 RUN  v5.0.3 /home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-IMPL-001-CANDIDATE


 Test Files  6 passed (6)
      Tests  50 passed (50)
   Start at  17:01:27
   Duration  2.54s (environment 71%, tests 20%, transform 5%, import 4%, worker 1%)
```

### 04-types.log

```text

```

### 05-presentation-types.log

```text

```

### 06-build.log

```text

> @jhonny_bcastro/document-editor@0.1.0-rc.4 build
> vite build -c vite.config.lib.ts && vite build -c vite.config.presentation.ts

vite v6.4.3 building for production...
transforming...
✓ 20 modules transformed.
rendering chunks...

[vite:dts] Start generate declaration files...
computing gzip size...
dist/document-editor.css   0.74 kB │ gzip:  0.38 kB
dist/pagination.es.js     87.45 kB │ gzip: 23.54 kB
[vite:dts] Start rollup declaration files...
Analysis will use the bundled TypeScript version 5.9.3
[vite:dts] Declaration files built in 1486ms.

dist/document-editor.css   0.74 kB │ gzip:  0.38 kB
dist/pagination.umd.js    57.36 kB │ gzip: 18.08 kB
✓ built in 1.93s
vite v6.4.3 building for production...
transforming...
✓ 2 modules transformed.
rendering chunks...

[vite:dts] Start generate declaration files...
computing gzip size...
dist/presentation/presentation.css  0.61 kB │ gzip: 0.27 kB
dist/presentation/index.es.js       3.07 kB │ gzip: 0.92 kB
[vite:dts] Declaration files built in 741ms.

dist/presentation/presentation.css  0.61 kB │ gzip: 0.27 kB
dist/presentation/index.umd.js      2.57 kB │ gzip: 0.95 kB
✓ built in 816ms
```

## Hashes dos arquivos de implementação/teste

```text
24c419c0c64dcd3f70590721741770fb5d34d0d4faa21795f6d8d0cacd598919  src/controller.ts
7421708048b052053ebff320b576aae481f820cfdf2d58ba129cee803bd1965a  src/decorations.ts
47022de1f1edb4eb3643bf552322edcd7c2b624209019e68d14f68d442f72fb0  src/extension.ts
b0f6e8898479795702d856575d5ad0aa499bae58ac35f695dd7e83ba091cfac4  src/types.ts
03e0df408e0249ae64d333f229d74a23b158fd39a53c3ff355cff99f9038f191  tests/unit/paint-mode.spec.ts
```
