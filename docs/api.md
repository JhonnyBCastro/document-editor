# API

## PaginationExtension
A extensão principal que deve ser adicionada à matriz de plugins do Tiptap.

## LayoutSnapshot
Tipo exportado. O controlador aciona o callback configurado sempre que a paginação terminar as operações em idle. O host pode inspecioná-lo:
```typescript
const editor = new Editor({
  extensions: [
    PaginationExtension.configure({
      onLayoutStable: (snap) => {
        console.log('Total pages:', snap.pages.length);
      }
    })
  ]
});
```

## whenLayoutStable
Função aguardada que retorna uma promise que é resolvida apenas quando o cálculo de `requestAnimationFrame` da paginação atinge um estado estável sem novos fluxos de reflow pendentes.

```typescript
import { whenLayoutStable } from 'document-editor';

await whenLayoutStable(editor);
```
