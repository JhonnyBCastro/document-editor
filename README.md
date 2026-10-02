# document-editor

Biblioteca consolidada de paginação para o Tiptap/ProseMirror, extraída do laboratório `editor-lab`.

Esta extensão provê um mecanismo de paginação híbrido (automático e manual) via `Decorations` sem corromper a árvore de sintaxe persistida (AST) do documento.

## Como instalar

```bash
npm install document-editor
```

## Como usar

```typescript
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension } from 'document-editor';
import 'document-editor/style.css';

const editor = new Editor({
  element: document.querySelector('#editor'),
  extensions: [
    StarterKit,
    PaginationExtension
  ]
});
```

## Estrutura do Projeto
- `src/`: Núcleo funcional da extensão (Controller, Chrome, Policies).
- `dist/`: Arquivos empacotados pelo Vite (ESM, UMD e CSS).
- `examples/vanilla-consumer/`: Consumidor minimalista para testar a integração.
- `docs/`: Documentação técnica.
- `tests/`: Testes automatizados usando Puppeteer.

## Como compilar o pacote
```bash
npm install
npm run build
```

## Como rodar o exemplo local
```bash
cd examples/vanilla-consumer
npm install
npm run dev
```

## Relação com o projeto APPE
O `document-editor` é um pacote agnóstico desenhado para ser consumido pelo front-end institucional do APPE. Todas as investigações históricas permanecem arquivadas no diretório `editor-lab`.
