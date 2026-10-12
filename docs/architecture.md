# Arquitetura vigente

Corte documental:12/10/2026. Separação entre documento semântico contínuo e paginação visual (“Rota B”). Não substituir ADRs/releases históricos por este estado vigente.

## Responsabilidades

Core mede DOM (`getClientRects`, `offsetHeight` e coordenadas), avalia políticas/quebras e produz LayoutSnapshot/projeções e Decorations. O consumidor fornece schema/content/UI e significado do nó manual configurável. Quebras tabulares usam espaçadores nas fronteiras de linhas, sem fragmentação intralinha suportada.

Presentation é entrada independente: pinta sheets/running content a partir do snapshot no host coordenado, com render/clear/destroy e disposers locais. Não calcula paginação, não cria Editor, não promete editor integrado. Integração oficial deverá definir fonte de layout, ownership, insets, atualização, estabilidade e descarte; permanece planejada. Consumidor experimental não equivale a factory/bridge pública pronta.

## Legacy/default e composto opt-in

`visualMode` é seleção explícita e fixa. Omissão=legacy preserva chrome/pintura histórica; host externo chromeLayerElement continua opção legado. Composed rejeita esse host, não cria chrome legado e não escreve pintura documental do Core nos estilos do consumidor. Mantém os mecanismos geométricos e quatro arestas decorativas1px/solid com cor transparente (B1), em vez de retirar contribuição de borda. Linear/manual/tabular, nós/dimensões/metadados/compensações não receberam redesign.

Composed não fornece sozinho folha/insets/rolagem ou running content pronto. Presentation deve ser montada e coordenada pelo consumidor segundo contratos próprios; automação de insets, atualização pública e composição/print oficial permanecem pendentes.

## Estabilidade e atualização

Correção mínima: scheduleRender libera renderTimeout=null quando o callback é consumido, antes de renderVirtualPages; debounce100ms existente preservado. Promessas/callbacks representam conclusão local da rodada. Não são garantia de geometria permanente ou de todos os eventos de alteração de layout.

O plugin agenda por tamanho de conteúdo/metadado de configuração. Mudança sem diferença de tamanho pode alterar medidas e não ser coberta por esse trigger. Há fonts.ready/frame cuja cobertura integral de cancelamento não é demonstrada. Não ampliar scheduler/triggers/políticas/snapshot nesta consolidação.

## Lifecycle e impressão

Core cria/descarta somente chrome próprio no legado e trata host externo sem apropriar filhos do consumidor. Presentation descarta recursos de render/disposers e host interno; host externo e Editor têm coordenação a cargo do consumidor. Cleanup de uma campanha não demonstra descarte completo de toda combinação de instâncias.

preparePrintSession altera layout temporário e classe global document.body, conserva lock até restore e devolve snapshot; host realiza impressão. Dependência global limita multi-instância. Impressão composta oficial não foi validada; PDF institucional e motor do browser não têm equivalência geométrica garantida.

## Produto, exemplos e evidências

src/configs e testesunit/fixtures constituem produto. Exemplos legacyRC4 e Presentation sintética são demonstrações delimitadas, não distribuição da working tree consolidada. E2E/artefatos/ADRs/releases permanecem históricos com seus alcances; governança extensa, materiais de campanha e auxiliares são externos, não dependência de runtime.

Exports Core/CSS/Presentation/CSS e tipos preservados; files=dist. Code/tgz antigos ou deps do Lab não são copiados como emissão nova. Externals protegidos não abrangem todo subpath PM/tables: não afirmar singleton global ou grafo runtime certificado. [Proveniência](provenance.md) e [backlog](backlog.md) identificam mudanças e pendências.
