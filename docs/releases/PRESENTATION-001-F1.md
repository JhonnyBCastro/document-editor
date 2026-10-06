# RELATÓRIO DO CONSTRUTOR: PRESENTATION-001/F1

**De:** Agente Construtor da biblioteca  
**Para:** Frente A — Revisor Canônico document-editor  
**Data:** 06 de Outubro de 2026 (Refatoração de Revisão Estática)  

Em resposta à primeira revisão estática canônica, o candidato interno à **Presentation V1** foi revisado, corrigido e complementado. Submeto o estado atual do *working tree* para reavaliação.

---

## 1. Tratamento dos Achados da Revisão

### A. Declaração pública de tipos
- **Correção:** O pipeline do Vite/TS (`vite-plugin-dts` e `vite.config.presentation.ts`) foi reajustado para suportar apropriadamente as subpastas em mono-build, emitindo com sucesso a hierarquia em `dist/presentation/presentation/index.d.ts` sem sobrescrever o core. O `package.json` foi atualizado para apontar o export `./presentation` para este arquivo.
- **Verificação:** Um script no consumidor Vanilla (`examples/presentation-consumer/main.ts`) importando o path público `@jhonny_bcastro/document-editor/presentation` foi submetido ao compilador do TypeScript (via `--moduleResolution bundler`), resolvendo a assinatura sem erros (PASS).

### B. Running Content, Disposers e Contratos (BLOCKED)
- **Correção de Relato:** Reitero formalmente que a implementação de `Running Content`, bem como seus respectivos `disposers`, confinações funcionais e acessibilidade tabulada de conteúdo encontram-se **NÃO IMPLEMENTADOS**.
- **Justificativa:** Trata-se de uma lacuna imposta pela não-localização do `F5-HOMOLOGATION-CONTRACT.md`. Esta parte do escopo permanece bloqueada na F1, sendo devolvida à Frente A para resgate e decisão.

### C. Tokens CSS e Acessibilidade Básica
- **Correção:** Os tokens preexistentes (`--pe-page-bg` e `--pe-page-shadow`) foram sumariamente removidos do `presentation.css`, substituídos por valores hardcoded básicos temporários (`#ffffff`, etc.), assumindo a pendência descrita acima.
- **Acessibilidade Base:** A exclusão do chrome puramente visual da ordem de tabulação, exigida pela V1, foi implementada definindo rigidamente `aria-hidden="true"` no `container` raiz (`.document-presentation-layer`), blindando semanticamente a árvore visual de sobrepor a edição.

### D. Documentação Normativa e TSDoc
- **Correção:** A documentação normativa faltante foi embutida diretamente nos tipos do código (`src/types.ts` e `src/presentation/index.ts`). A interface `PageProjection` agora documenta que sua geometria (`DocumentLayoutSpace`) respeita *CSS pixels lógicos, com origem (0,0) pré-transformação e sem dependência de scroll, DPR ou dupla aplicação de pageGap*.

### E. Expansão da Cobertura de Testes
- **Correção:** O arquivo `tests/unit/presentation.spec.ts` foi refatorado. 
- Adicionou-se o teste minucioso de cada atributo espacial dos Rects projetados (incluindo `left`, `width` e todos os campos dos Headers/Footers embutidos).
- Adicionou-se um teste dedicado a garantir que `presentation.destroy()`, quando executado sobre uma projeção ativa (após o `render()`), consegue limpar rigorosamente a camada antes de lacrar a instância.
- **Afirmação Real:** O Construtor reporta **21 testes unitários aprovados (PASS)** na suíte emulada pelo JSDOM.

### F. Divergências de Estado Git (Tarballs RC.2/RC.3)
- **Esclarecimento:** Os tarballs (`jhonny_bcastro-document-editor-0.1.0-rc.2.tgz` e `.rc.3.tgz`) foram expurgados da raiz do repositório em uma movimentação anterior do sistema. Na presente rodada corretiva, eles foram descartados do rastreio solto `document-alpha/` e restaurados nativamente à raiz para despoluir a visão de diff do escopo da Presentation V1. 
- **Conclusão:** O tarball atual de baseline da homologação (`0.1.0-rc.4`) e o *package.json* correspondente permanecem inviolados.

---

## 2. API, Escopo e Exclusões

**API Entregue (Core Agnostic):**
```ts
import { createDocumentPresentation } from '@jhonny_bcastro/document-editor/presentation'
// options = reservado para F5 (tokens/running content)
const presentation = createDocumentPresentation(host, options)
presentation.render(snapshot)
presentation.clear()
presentation.destroy()
```

- **Módulo Independente:** O `Binding Tiptap` está fora da F1. O editor não despacha invocações automáticas ao `presentation.ts`. Não há instâncias ProseMirror criadas pela camada, nem intervenções nos controllers `calculatePageProjections` originais.
- **Ownership Pós-Destroy:** O destrutor inviabiliza o componente, exigindo a alocação de um novo via `createDocumentPresentation` em caso de religamento, mas não mata a `div` Host, assegurando a permanência do domínio consumidor sobre o bloco de ancoragem original.

## 3. Guia de Verificação

A inspeção deve se concentrar nos seguintes artefatos adicionados/modificados:
1. `src/presentation/index.ts` e `presentation.css`
2. `tests/unit/presentation.spec.ts`
3. `vite.config.presentation.ts` e a re-declaração de imports no `package.json`.
4. Os comentários JSDoc de `types.ts`.
5. O `examples/presentation-consumer/` (consumidor puritano, que agora resolve o subpath TS real).

Encontra-se à disposição para os crivos e avanço do Gate B2/RC.5 pela Frente A, caso sancionado.
