# CONS-007 — Configuração Genérica do Nó de Quebra Manual

## 1. Objetivo
Permitir que os consumidores configurem o nome do nó manual de quebra de página registrado no Tiptap/ProseMirror, abolindo a necessidade impositiva de todos os consumidores utilizarem especificamente o nome `pageBreak`. Isso avança a independência arquitetural da biblioteca baseada no ADR-002, transferindo a propriedade de esquema para o consumidor enquanto o controlador geométrico abstrai unicamente a detecção visual.

## 2. Diagnóstico Inicial
Ao rastrear o source da versão `document-editor@0.1.0-alpha.3`, o identificador `pageBreak` estava intrinsecamente fixado em `src/controller.ts` durante a varredura primária do documento (`this.view.state.doc.descendants(...)`). Conforme o *ADR-002 (Independência de Produto)*, a extensão não deve presumir ou monopolizar esquemas internos do ProseMirror do projeto final.

## 3. Contrato Adotado
A opção pública `manualBreakNodeName?: string` foi injetada no contrato `PaginationOptions` exportado em `src/types.ts`.
A extensão de inicialização (`PaginationExtension` em `src/extension.ts`) atribui o valor de fallback `'pageBreak'` caso não preenchido, preservando imediatamente a retrocompatibilidade com consumidores existentes. Esse valor é repassado ao `PaginationController` em sua instanciação e utilizado no detector visual do iterador descendente do DOM.

## 4. Alterações Executadas
- `src/types.ts`: Ampliação da interface `PaginationOptions` incluindo `manualBreakNodeName`.
- `src/extension.ts`: Ajustes na inicialização do Tiptap para injetar a variável a partir de `this.options`.
- `src/controller.ts`: Atualização na linha 114 substituindo `node.type.name === 'pageBreak'` pelo identificador passado no construtor da classe base (`this.manualBreakNodeName`).
- Atualização do Checkpoint (`.antigravity-context.md`), da API em `docs/api.md` e do documento visual de arquitetura `docs/architecture.md`.

## 5. Regressões e Proteção do Baseline (Retrocompatibilidade)
As suítes originais foram executadas contra o pacote distribuído *sem modificação da inicialização* no Consumer A e Consumer B.
- **Isolamento e progressão zero**: Validado sem corrupção. A posição inicial é preservada e os quebras consecutivas funcionaram.
- Todos os testes E2E Híbridos rodaram em modo `PASS` limpo nos motores de **Tiptap v2 (2.27.3)** e **Tiptap v3 (3.31.3)**.

## 6. Criação e Execução de Schema Alternativo
Foi criada a fixture contida `consumer-c-custom` baseada no Tiptap v2.
Nesse ambiente:
- O tipo ProseMirror criado internamente chamava-se `documentBreak`.
- O payload de inicialização do Tiptap enviou o conteúdo injetando marcações como `{ type: 'documentBreak' }`.
- O Editor foi configurado chamando a extensão customizada: `PaginationExtension.configure({ manualBreakNodeName: 'documentBreak' })`.
**Resultado**: Sucesso absoluto. A paginação reconheceu os offsets manuais recém nomeados, estabilizou as quebras semânticas perfeitamente, gerou a quantidade de páginas preditas e submeteu ao stress tabular de longa escala (PE-L com 10 páginas / 7 auto breaks) completando limpo. 

## 7. Build e Distribuição
Os testes unitários matemáticos da extensão passaram ilesos.
Foi consolidado o build para ES e UMD contendo as novas assinaturas tipadas para TypeScript.
Versão promovida para **`document-editor@0.1.0-alpha.4`** e compactada no ambiente.

## 8. Commit
Foi gerado o release respectivo da iteração arquitetural no commit `98cae7a`.

## 9. Recomendação de Backlog (CONS-008)
Com o desacoplamento do Schema estabelecido, recomenda-se iniciar os trabalhos em torno das restrições DOM. Como prioridade de arquitetura atual, a P2 sugere uma **evolução do contrato DOM do host** (o fato da extensão anexar estilos à instância `document.body` invés do contêiner isolado do editor impacta eventuais consumidores multi-instância). Extensão dos testes unitários matemáticos (P1) e fragmentação intralinha em tabelas (Research) seguem como candidatas viáveis.
