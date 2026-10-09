# PAINT-MODE-B1-IMPL-001 — entrega para revisão

Executor: Construtor da biblioteca document-editor, sob Frente A. Autoridade final: Boby. Contrato B1 ratificado conforme CROSS-CONTRACT-CONSOLIDATION-002 e BOBY-RATIFICATION.json. B2–B4 não implementados. Gate Vanilla não homologado.

## Problema e alteração

No candidato histórico a25e691, composed removia borderBottom/borderTop, reduzindo a dimensão externa de pageBottom/pageTop em content-box. B1 conserva borda solid de 1 CSS px nessas duas arestas, com cor transparent no composed. Nas duas montagens de src/decorations.ts, foram acrescentados somente quatro ramos else. Legacy/default conserva as declarações anteriores inclusive #ccc; nenhum height/padding/box-sizing/posicionamento foi alterado. Fundos/sombras documentais e chrome continuam suprimidos no composed. Não há arestas novas no carrier, gap, conteúdo, PM, células, HR, hosts ou Presentation.

Arquivos rastreados alterados: src/decorations.ts, tests/unit/paint-mode.spec.ts, comentário de visualMode em src/types.ts e este documento novo. API/tipos/opções, manifestos, lockfiles, configurações e versão declarada 0.1.0-rc.4 permanecem inalterados.

## Isolamento e ambiente

Fonte preservada: `/home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-IMPL-001-CANDIDATE`, HEAD a25e69182a42ee5344fc297c796a8ff43a6d51ba, pai d6918c1233030667f3c8aae3ccf2e41f3787babb, Git limpo na entrada. Novo checkout: `/home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-B1-IMPL-001-CANDIDATE`. Branch: paint-mode-b1-impl-001. Novo commit local terá pai exato a25e691; identidade completa e estado final estão na evidência, evitando autorreferência de hash neste documento rastreado.

Clone local --no-hardlinks e sem alternates; inodes dos objetos conferidos independentes. Dependências copiadas integralmente com copytree/copy2 e symlinks internos preservados: 16.697 entradas, cobertura/bytes/modos/links iguais na entrada e arquivos fisicamente independentes. Não houve instalação, resolução, troca de pacote ou uso das árvores comuns da campanha.

Node /usr/bin/node v22.23.3; npm /usr/share/nodejs/npm/bin/npm-cli.js 10.9.9, com executáveis físicos/hashes registrados. Pacotes efetivos: Vitest 5.0.3, JSDOM 30.1.1, TypeScript 5.9.3, Vite 6.4.3, vite-plugin-dts 4.5.4; @tiptap/core e @tiptap/pm raiz 2.27.3, StarterKit 3.31.4 com Core/PM 3.31.4 aninhados; prosemirror-model 1.25.12 e prosemirror-tables 1.8.5. A presença dessas versões aninhadas é herdada da fonte, preservada e inventariada; não constitui certificação de singleton ou equivalência ao runtime comum da campanha. DEPENDENCY-VERSIONS.json lista 339 manifestos nomeados/versionados encontrados fisicamente.

Cache, temporários e capturas restritos ao checkout/evidência novos. Depois das verificações, o único delta no inventário da cópia de node_modules é o cache local de resultados .vite/vitest/.../results.json. Fonte histórica não compartilha esse arquivo. O inventário bruto e o delta ficam preservados; não se declara igualdade integral da cópia após execução.

## Verificações e tentativas

| Comando no checkout novo | Resultado |
| --- | --- |
| ./node_modules/.bin/vitest run tests/unit/paint-mode.spec.ts — target-001 | exit 1, sinal nulo; 17 passaram e 15 falharam na serialização do normalizador de teste |
| Mesmo comando — target-002 após correção local | exit 0, sinal nulo; 32/32 passaram |
| ./node_modules/.bin/vitest run | exit 0, sinal nulo; 62/62 em seis arquivos passaram |
| ./node_modules/.bin/tsc --noEmit -p tsconfig.json | exit 0, sinal nulo |
| ./node_modules/.bin/tsc --noEmit -p tsconfig.presentation.json | exit 0, sinal nulo |
| npm run build | exit 0, sinal nulo; build técnico Core e Presentation no novo dist |

A correção local autorizada ficou somente no teste: JSDOM serializava a borda como shorthand no legado e longhands no composto depois de alterar sua cor no clone. O normalizador agora usa largura/estilo observados para canonicalizar a representação; somente cor das duas arestas aprovadas e pintura background/box-shadow são normalizadas. Nenhum border dimensional é eliminado; assertions independentes exigem largura 1px, solid e cor correta por papel/aresta. Logs íntegros de todas as tentativas e explicação preservados. Somente a suíte afetada foi repetida antes dos checks ainda não executados.

## Rastreio assertions → B1

| Obrigação | Verificação |
| --- | --- |
| Bordas somente inferior de pageBottom/superior de pageTop, 1px solid | expectEdgeBorders verifica as quatro arestas de todos os nós, em legacy/default/composed |
| Cor transparent composed e #ccc legacy/default | Assertions explícitas por papel, sem remoção genérica de border |
| Ausência de fundos/sombras Core e ocultação no composed | expectComposedPaintContract verifica background/box-shadow/display/visibility/opacity; casos de controller preservam ausência de chrome |
| Estrutura, geometria declarada, metadata e ownership | DOM normalizado preserva nós/arestas/estilos dimensionais; assertions from/to/spec, atributos de linha, D, height/âncoras; casos existentes de ownership externo mantidos |
| Três renderers e configurações delimitadas | Casos existentes + matriz de 12: linear/manual/tabular × margens assimétricas, extraWhite zero/positivo, deslocamento fracionário e margens/gap fracionários |
| Omitido=legacy, chamadas antigas, seleção fixa e rejeições | Casos anteriores preservados; omitido/legacy comparados em cada caso de montagem |
| Box-sizing/padding não impostos para passar | Matriz exige ausência de novas declarações; nenhuma nova folha CSS introduzida |

ASSERTION-TRACE.json identifica as linhas concretas das assertions. Testes usam o ambiente existente JSDOM e estilos externos já presentes nos casos de ownership, sem impor box-sizing ou novos estilos de teste ao produto. Verificam declarações/estrutura/metadados; não apresentam rect/clientHeight/offsetHeight artificiais como prova de layout real.

## Evidência e limites

Evidência externa: `/home/jhonny/.codex/.chatgpt-projects/g-p-6ac40281098481919b31b27399dbd6c9/PAINT-MODE-B1-IMPL-001-EVIDENCE`. Contém comandos/cwd/ambiente/contexto, início/fim, stdout/stderr, códigos/sinais, inventários antes/depois, hashes, diff integral, identidade do commit e conferência de preservação. Dist é emissão técnica ignorada no checkout, inventariada separadamente, sem pack/selagem/release. Nenhum push, tag ou mudança de versão.

Nenhum browser, servidor, preflight operacional ou nova campanha; selo anterior não atualizado. Fontes/dist/dependências históricas, preparação/outputs/cache e autorização consumida preservados. Os veredictos históricos não foram reclassificados. Não há promessa de CSS arbitrário/!important, geometria/pintura real, impressão, singleton PM ou suficiência browser. Matriz browser content-box/border-box, cascata, margens/fracionários e revisão visual exigem autorização posterior. B2/cobertura, B3/continuidade e B4/overflow não foram codificados.

**Devolver à Frente A e PARAR. Aprovação técnica local não autoriza próxima etapa, materialização comum ou campanha.**
