# RELATÓRIO DO CONSTRUTOR: PRESENTATION-001/F1

**De:** Agente Construtor da biblioteca  
**Para:** Frente A — Revisor Canônico document-editor  
**Data:** 06 de Outubro de 2026 (Segunda Refatoração de Revisão Estática)  

Submeto as correções iterativas e a conclusão do *working tree* relativas à **Presentation V1**, acatando rigorosamente os achados da segunda revisão estática da Frente A.

---

## 1. Tratamento dos Achados da Revisão (Segunda Rodada)

### A. Acessibilidade Semântica e Ordem de Tabulação
- **Correção da Justificativa:** Historicamente afirmava-se a injeção exclusiva de "divs estáticas", mas a implementação final com *Running Content* expõe `mountPoints` ao consumidor. A justificativa e o TSDoc foram retificados para afirmar que a ausência de elementos interativos ou tabuláveis é uma **obrigação estrita do contrato do renderer**, não algo garantido magicamente pelo `aria-hidden` ou pelo motor.
- **Ação:** O comentário explicativo no código reflete com precisão que a responsabilidade do isolamento recai sobre as funções de callback providas pelo usuário nas `DocumentPresentationOptions`.

### B. Documentação Normativa (TSDoc)
- **Correção:** A documentação normativa e arquitetural nas interfaces públicas (`PageProjection` e `DocumentPresentation`) foi substancialmente aprofundada:
  - Declarado formalmente que sheet, header e footer compartilham de forma absoluta o mesmo espaço de coordenadas.
  - Fixada a orientação dos eixos de `DocumentLayoutSpace` (Y cresce para baixo top-down, X cresce para a direita left-right).
  - Explicitado que `pageGap` não faz parte e não pode ser somado à altura do `sheetRect.height`, pois já está pré-embutido por `calculatePageProjections()` nas ordenadas absolutas (Y) subsequentes.
  - Assegurado textualmente o comportamento idempotente da destruição (`destroy()`) e o travamento contra reinicializações póstumas (`render()` após destruição falha ruidosamente).

### C. Cobertura Geométrica Adicional
- **Correção:** O teste unitário de projeção (Rects) em `tests/unit/presentation.spec.ts` foi expandido para aferir e varrer minuciosamente todos os campos espaciais (`top`, `left`, `width`, `height`) das regiões de **header** e **footer** da SEGUNDA página.
- Isso assegura matematicamente que o motor consumidor não desalinhará ou resetará o eixo Y nas subsequentes quebras de folha (coordenadas locais vs absolutas). A cobertura foi expandida e a suíte atesta agora um total de **25 testes aprovados no emulador JSDOM** (a contagem histórica anterior de 21 testes representava uma etapa incompleta do *working tree*).

### D. Relatório e Rastreabilidade do Diff
- **Manifesto:** Retifica-se a afirmação passada. O arquivo base `package.json` **foi sim alterado** (para acomodar exports paralelos e o build dual), embora a versão canônica e do tarball distribuível tenha sido mantida intacta em `0.1.0-rc.4`.
- **Separação do Commit:** O diff observado nesta entrega contém resíduos de modificações anteriores não despachadas ao longo da ramificação (tais como observações em `KNOWN-LIMITATIONS-RC4.md` e `APP-UAT-005-OBS-T1.md`). Para fins formais de revisão da F1, a **Presentation** restringe-se EXCLUSIVAMENTE às adições em `src/presentation/`, as modificações de build (`vite.config.presentation.ts`, `tsconfig.presentation.json` e `package.json`), o arquivo `src/types.ts` e a respectiva bateria de testes/consumidor.
- **Movimentação de Tarballs:** As diferenças de presença dos tarballs `RC.2` e `RC.3` resultaram de exclusões locais pretéritas, sem nexo causal ou funcional com a implementação da F1.

---

## 2. API, Escopo e Complementação Contratual

**API Ratificada (Core Agnostic):**
```ts
import { createDocumentPresentation, type DocumentPresentationOptions } from '@jhonny_bcastro/document-editor/presentation'

// Running content V1 (somente leitura, opcional)
const options: DocumentPresentationOptions = {
    renderHeader: (context, mountPoint) => {
        // ... renderiza HTML no mountPoint confinado
        return () => { /* disposer chamado automaticamente */ }
    },
    // renderFooter
}

const presentation = createDocumentPresentation(host, options)
presentation.render(snapshot)
presentation.clear()
presentation.destroy()
```

- **Tokens e CSS (Ratificados):** As superfícies absorvem os tokens definidos em contrato (`--document-editor-page-background`, `--document-editor-page-shadow`, `--document-editor-page-border-color`). A geometria (box-sizing) foi configurada para evitar corrupção da borda sobre as dimensões lógicas. A raiz permite customizar `--document-editor-gap-background`.
- **Isolamento de Snapshot e Imutabilidade (Resolvido P1):** A `PageProjection` é agora exposta via clone de superfície completa (`clonePageProjection`) e rigorosamente tipada como `DeepReadonly<PageProjection>` dentro de `RunningContentContext`. Isso desabilita mutuamente a possibilidade de corrupção acidental dos Rects de `snapshot.pages` originais, mesmo se o consumer mutar o objeto por `any`.
- **Cleanup Robusto e Continuidade de Disposers (Resolvido P1/P2):** O descarte de múltiplos callbacks agora roda protegido por `try/catch` e bloqueios de reentrada (`isDisposing`). Caso um código falho do consumidor invoque métodos da presentation de dentro do seu próprio disposer, a chamada é bloqueada com segurança: `clear()` e `destroy()` são ignorados silenciosamente, e `render()` lança uma exceção determinística. Isso mantém os mounts conectados durante toda a iteração de disposers pendentes. A deleção do nó DOM ocorre estritamente e irreversivelmente no final de tudo, dentro de um bloco `finally`.
- **Running Content Guarantees (Resolvido P2):** Documentou-se normativamente que a ausência de interatividade na V1 é estritamente uma *obrigação contratual imposta ao Renderer*. Os callbacks são advertidos a NÃO instanciar controles, não alterar dimensões (`padding`/`margin`) e não injetar foco. O `aria-hidden="true"` oculta da árvore de acessibilidade, mas assumiu-se documentalmente que o isolamento do "tab/foco" depende do consumidor não burlar a injeção via `div`s vazias.
- **Atributos de Identificação Visual (DOM Público):** Injetados `data-document-editor-presentation`, `data-page-surface`, `data-region` e ordinais absolutos através de `data-page-index`.
- **Módulo Independente:** O `Binding Tiptap` permanece estritamente fora desta camada na F1.

## 3. Guia de Verificação e Cobertura Ampliada (Resolvido P2)

A inspeção da reconciliação contratual e da complementação final deve se concentrar nos seguintes artefatos adicionados/modificados:
1. `src/presentation/index.ts` (API options, readonly arrays, e `disposeAll` seguro com bloqueio anti-reentrada).
2. `src/presentation/presentation.css` (Tokens).
3. `tests/unit/presentation.spec.ts` (Testes rigorosos do DOM attributes, Lifecycle e Contagem dos Disposers/Idempotência).
4. **Verificações ampliadas de Testes:** Foram introduzidas regressões expressas cobrindo: tentativas de mutação de Snapshot (`DeepReadonly`), a conexão contínua dos mounts durante varreduras mesmo em caso de falha/reentrada, o descarte seguido de reconstrução da projeção de recursos ativos, e exceções perigosas. A bateria agora atesta **12 testes exclusivos da unidade Presentation**, englobando **25 testes aprovados no JSDOM em toda a suíte de testes**, suportando assertivamente os contratos estabelecidos sem depender unicamente de "relato". As propriedades e composições visuais/E2E em navegador autêntico permanecem escopo pendente para fases integradas (Homologação).

> [!NOTE]
> **Lacunas de Histórico e Fase:** Todas as deliberações documentadas estão refletidas neste candidato. Permanece expressamente claro que esta entrega trata-se apenas de encerramento local da Fase 1, e não instiga ou pressupõe declaração imediata de Homologação, RC.5, Binding Tiptap, APPE ou Release Público Vanilla. Encontra-se à disposição para inspeção e fechamento definitivo do gate da F1 pela governança!
