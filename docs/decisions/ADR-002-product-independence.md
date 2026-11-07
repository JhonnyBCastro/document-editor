# ADR-002: Independência de Produto do Document Editor

> Nota de evolução — 22/10/2026: a independência do produto continua vigente. Os diagnósticos de implementação abaixo descrevem a época da decisão: `manualBreakNodeName` já é configurável, `PersistedDocument` foi removido e ChromeLayer foi superado por composed-only. A declaração atual de dependências mistura Core/PM 2 e StarterKit 3; compatibilidade geral não está certificada. Consulte a [API](../api.md), as [limitações](../limitations.md) e o [ADR-004](ADR-004-composed-only.md). O texto histórico foi preservado, sem transformar pendências da época em requisitos atuais.

## Status
Aceito

## Contexto
A extensão `PaginationExtension` e a biblioteca `document-editor` foram extraídas do laboratório `editor-lab`. Durante a fase laboratorial e nas validações da CONS-004, o APPE atuou como consumidor institucional exclusivo, influenciando tipagens, regras de nomenclatura nos testes (ex: `PE-S`) e identificadores no schema (ex: `pageBreak`). 

Para que a biblioteca cumpra seu papel como um motor de infraestrutura agnóstico, focado na paginação visual híbrida de documentos ricos via Tiptap/ProseMirror, ela não pode ficar amarrada aos fluxos ou limitações de apenas um consumidor. O ciclo de vida, a matriz de compatibilidade e a qualidade do *document-editor* devem ser avaliados por critérios próprios, independentes dos portões de homologação institucionais (M/O/Q) do APPE.

## Decisão
Estabelecemos a diretriz arquitetural permanente: **O `document-editor` é um produto independente.**

### A. Independência de domínio
Classes, interfaces, configurações e algoritmos do núcleo não dependerão de conceitos institucionais como "professor", "disciplina", "Plano de Ensino", "coordenador" ou fluxos de "aprovação acadêmica". O uso de *fixtures* baseadas nesses domínios em cenários demonstrativos continua permitido, desde que o núcleo da biblioteca não espere essa estrutura específica.

### B. Fronteira entre biblioteca e consumidor
A biblioteca responsabiliza-se pelas funcionalidades documentais e pelo contrato público de paginação. Não incorporaremos dependências específicas do framework do consumidor (como Angular) nem exigências pontuais de persistência (como OpenPDF) apenas para atender ao APPE. Os consumidores serão sempre os responsáveis por:
- Autenticação e autorização.
- Persistência e regras de negócio institucionais.
- Integrações de Backend (APIs e adaptadores de exportação).
- Integração da View com o framework da aplicação (React, Angular, Vue, Vanilla).

### C. Schema configurável
Atualmente, a biblioteca tem dependência restrita e hardcoded com a string `pageBreak` para identificar o nó de quebra de página manual. Para evoluções futuras, esse identificador deverá ser explicitamente configurável no contrato `PaginationOptions`, mantendo `'pageBreak'` como um fallback/padrão por motivo de compatibilidade com a baseline.

### D. Contrato de persistência
Foi formalizado que o `JSON Semântico do Tiptap` é a única responsabilidade central preservada no tráfego de dados gerado pela biblioteca. Atualmente o contrato `PersistedDocument` na API possui o formato legado `'document-editor-lab'`. Envelopes de persistência só devem compor a API se representarem uma abstração genérica universal (a reavaliar no backlog).

### E. Contexto DOM do Host
Assumimos como dívida técnica a atual dependência de seletores globais e mutações globais (`document.body.classList`, injeções diretas em variáveis soltas do DOM). O futuro demandará um contrato explícito de montagem de renderização (containers e overlays) por instância, o que também destravará o suporte Multi-Instância.

### F. Compatibilidade Tiptap e Regressões
Há uma distinção clara entre "compatibilidade declarada" e "compatibilidade verificada". A biblioteca declara suporte a Tiptap `^2.0.0 || ^3.0.0` no `package.json`, porém os testes locais utilizam apenas Tiptap 2 (`devDependencies`). A validação no Tiptap 3 ocorreu apenas via "Smoke Test" integrado ao ambiente Angular do APPE, o que é insuficiente para garantir a total cobertura de suas APIs na major v3. Adicionaremos matrizes de testes independentes no futuro.

### G. Homologações Independentes
Os critérios de qualidade do Document Editor consistem em: API concisa, comportamento semântico protegido, geometria de quebra precisa e cobertura de regressão. Eles não se condicionam ao calendário do APPE nem dependem das aprovações de Portões M/O/Q institucionais. Similarmente, uma versão aprovada da biblioteca não significa que foi homologada para o fluxo de produção do APPE; cada projeto roda seu próprio ciclo de validação.

## Acoplamentos Observados
As seguintes ocorrências foram listadas para futuro tratamento ou documentação, distinguindo restrições de implementação de vazamentos funcionais:

1. **Nome literal `pageBreak` em `controller.ts`**: Acoplamento funcional/Schema. O núcleo espera exatamente este nome de nó.
2. **Envelope `PersistedDocument` e literal `document-editor-lab`**: Herança histórica de nomenclatura no `types.ts`. Pode vazar responsabilidade de persistência se considerado parte obrigatória da interface pública.
3. **Nomenclatura PE-S/M/L nas fixtures de teste**: Convenção e herança histórica. São fixtures válidas, o motor não se importa com seus conteúdos, mas os scripts de estresse as carregam e nomeiam os testes dessa forma.
4. **Seletores DOM globais (`document.body`, `#chrome-layer`)**: Restrição de implementação técnica. Foi a forma mais rápida de injetar a HUD do Paginador (Chrome) e afeta a futura capacidade multi-instância.
5. **Matriz Declarada de Compatibilidade Tiptap 2/3**: Compatibilidade declarada (v3) mas ainda não verificada nativamente em 100% da suíte de regressão automatizada (puppeteer/vitest roda em v2.11).
