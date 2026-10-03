# API

## PaginationExtension
A extensão principal que deve ser adicionada à matriz de plugins do Tiptap.

## LayoutSnapshot
Tipo exportado. O controlador aciona o callback configurado sempre que a paginação terminar as operações em idle. O host pode inspecioná-lo:
```typescript
// Exemplo A — Schema convencional (reconhece pageBreak por padrão)
const editor = new Editor({
  extensions: [
    PaginationExtension.configure({
      onLayoutStable: (snap) => {
        console.log('Total pages:', snap.pages.length);
      }
    })
  ]
});

// Exemplo B — Schema personalizado
const editorCustom = new Editor({
  extensions: [
    PaginationExtension.configure({
      manualBreakNodeName: 'documentBreak', // O document-editor mapeará as quebras em cima desse nó registrado pelo host
      onLayoutStable: (snap) => {
        console.log('Total pages:', snap.pages.length);
      }
    })
  ]
});
```

*Nota: O `manualBreakNodeName` informa ao renderizador geométrico qual nó deverá ser tratado como uma fronteira de página obrigatória. O consumidor (host) é o responsável exclusivo por criar e prover o schema prose-mirror desse nó. A biblioteca não injeta nós proprietários na estrutura do seu documento.*

## whenLayoutStable
Função aguardada que retorna uma promise que é resolvida apenas quando o cálculo de `requestAnimationFrame` da paginação atinge um estado estável sem novos fluxos de reflow pendentes.

```typescript
import { whenLayoutStable } from 'document-editor';

await whenLayoutStable(editor);
```
