# document-editor

A hybrid, non-destructive visual pagination extension for Tiptap and ProseMirror.

## Product Overview
`document-editor` is a TypeScript library that provides visual pagination for continuous documents rendered in the browser. It projects pages into a fixed format (e.g., US Letter by default) based on configurable layouts.

The core architectural principle of this library is **semantic isolation**: the underlying document structure (JSON/AST) remains continuous and untouched by the pagination logic. Automatic visual page breaks are calculated dynamically based on browser geometry and injected as transient ProseMirror `Decorations`. 

This library explicitly distinguishes between:
- **Automatic visual page breaks**: Transient spacer widgets calculated on the fly.
- **Manual page breaks**: Semantic nodes owned and persisted by the consumer's schema.

> **Note:** This library is not a complete WYSIWYG editor, a backend persistence service, or a server-side PDF generator.

## Features
- **Non-destructive visual pagination**: Preserves your semantic document tree.
- **Page projection**: Configurable layout boundaries.
- **Manual PageBreak recognition**: Integrates with your existing schema.
- **Consecutive & Starting breaks**: Supports consecutive manual breaks and breaks at the very beginning of the document.
- **Tabular pagination on row boundaries**: Safely breaks tables between `<tr>` elements using virtual row spacers (note: this is not full table virtualization).
- **Virtual headers/footers**: Maintains visual structure across projected pages.
- **Layout Stabilization notification**: Exposes hooks and promises to detect when the layout finishes calculating.
- **Print session management**: Prepares and restores the document for browser-based printing.
- **Isolated ChromeLayer mounting**: Automatically injects visual page boundaries independent of the semantic DOM, or allows custom container assignment.

## Installation
The current version (`0.1.0-rc.1`) is distributed as a local tarball. 

**Requirements:**
- A modern bundler (Vite, Webpack, etc.).
- Peer dependencies: `@tiptap/core` and `@tiptap/pm` (v2 or v3).

```bash
npm install ./document-editor-0.1.0-rc.1.tgz
```

## Quick Start
Initialize your Tiptap Editor by passing the `PaginationExtension`. The library relies on its CSS for geometry, so the stylesheet must be explicitly imported.

```typescript
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension } from 'document-editor';
import 'document-editor/style.css'; // Mandatory for geometry calculations

const element = document.querySelector('#editor');

if (element) {
  const editor = new Editor({
    element,
    extensions: [
      StarterKit,
      PaginationExtension.configure() // Uses defaults
    ]
  });
}
```

## Manual Page Breaks
The `manualBreakNodeName` option allows you to bind the pagination engine to your existing semantic page break node (default is `'pageBreak'`). 

**Important:** The library recognizes this identifier, but it **does not** automatically register the ProseMirror Node extension for you. You must register your own node extension in Tiptap.

```typescript
import { Node } from '@tiptap/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension } from 'document-editor';

// 1. The host defines its own semantic node for manual breaks.
const CustomPageBreak = Node.create({
  name: 'myCustomBreak',
  group: 'block',
  parseHTML() { return [{ tag: 'hr.page-break' }] },
  renderHTML() { return ['hr', { class: 'page-break' }] },
});

// 2. Configure the extension to listen to your custom node.
const element = document.querySelector('#editor');

if (element) {
  const editor = new Editor({
    element,
    extensions: [
      StarterKit,
      CustomPageBreak,
      PaginationExtension.configure({
        manualBreakNodeName: 'myCustomBreak'
      })
    ]
  });
}
```

## Layout Stabilization
Calculating page breaks requires DOM layout reads, which are batched using `requestAnimationFrame`.
You can wait for the engine to finish settling the layout using `whenLayoutStable` or the `onLayoutStable` configuration option.

```typescript
import { whenLayoutStable } from 'document-editor';

// Returns a Promise<LayoutSnapshot>
const snapshot = await whenLayoutStable(editor);
console.log('Total pages:', snapshot.pages.length);
```

*Note:* Stabilization means that the pagination engine has no pending reflows. It does not guarantee exact geometrical fidelity between the browser's visual pagination and PDFs produced by external server-side rendering engines, nor does it guarantee permanent stability if the host subsequently mutates fonts, images, or DOM containers.

## Pagination Widgets vs ChromeLayer
It is crucial to distinguish between the two layers of visual intervention:
1. **Pagination Widgets**: These are transient ProseMirror `Decorations` (linear spacers or tabular row spacers) injected directly into the editor's DOM to push content vertically down.
2. **ChromeLayer (`.document-editor-chrome-layer`)**: A sibling/underlay `div` element created by the library. This layer is strictly responsible for rendering the visual page backgrounds, box shadows, and virtual headers/footers.

- **Host Ownership**: The host is responsible for the CSS positioning and styling of the outer container. 
- **Library Ownership**: The library creates and destroys only its internal `.document-editor-chrome-layer`.
- **Custom Mounting**: You can supply a custom container via the `chromeLayerElement` configuration option.

## Print Session
The library provides an asynchronous `preparePrintSession` utility that prepares the DOM for browser printing (e.g., neutralizing page gaps) and provides a `restore` callback.

```typescript
import { preparePrintSession } from 'document-editor';

// 1. Prepare the layout for printing
const session = await preparePrintSession(editor);

try {
  // 2. The host is strictly responsible for controlling the print lifecycle.
  // Example of a host-implemented function (not provided by this library):
  // Implemented by the consuming application, not document-editor.
  declare function hostControlledPrintFlow(): Promise<void>;
  
  await hostControlledPrintFlow();
} finally {
  // 3. Always restore the layout after the print lifecycle concludes.
  await session.restore();
}
```
*Note:* This routine explicitly applies a global `print-mode` CSS class to `document.body` and modifies the editor layout. Consequently, the library imposes a strict lock: the lock `isPreparingPrint` becomes active upon preparation and remains active until `restore()` is called. Invoking `preparePrintSession` concurrently will throw an error. This routine does not directly generate PDF files.

## How Pagination Works
The engine follows a linear pipeline:
1. **Semantic Document**: The raw content is structurally continuous.
2. **Geometrical Measurement**: The engine probes the DOM nodes' bounding rects.
3. **Decisions**: It calculates boundaries based on the configured page height.
4. **Projection**: It generates virtual pages and virtual table spacers.
5. **Decorations**: It applies non-destructive `Decorations` to push content vertically down.

## Configuration Reference

| Option | Type | Default Value | Description |
|---|---|---|---|
| `layout.page` | `Object` | `{ width: 816, height: 1056, marginTop: 96, marginRight: 96, marginBottom: 96, marginLeft: 96, pageGap: 20 }` | Page geometry in pixels (US Letter @ 96 DPI by default). |
| `layout.policies` | `Object` | `{ keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 }` | Typographic control policies. |
| `layout.runningContent` | `Object` | `{ header: { enabled: true, text: 'Document Editor Lab — Documento de Teste', align: 'center' }, footer: { enabled: true, text: 'Página {page} de {total}', align: 'right' }, differentFirstPage: false }` | Header and footer configuration. |
| `onLayoutStable` | `Function` | `undefined` | Callback invoked whenever the layout settles. |
| `manualBreakNodeName` | `string` | `'pageBreak'` | The Tiptap node name representing semantic manual breaks. |
| `chromeLayerElement` | `HTMLElement` | `undefined` | Optional external container to host the visual page backgrounds. |

## Known Limitations
- **Single-instance**: While the ChromeLayer possesses isolated ownership per editor instance, multi-instance usage is not officially validated. Supporting simultaneous editors falls outside the current contract, primarily due to the global DOM mutations triggered during printing (`.print-mode`).
- **DOM Dependency**: Heavily relies on the Browser DOM font engine and CSS geometry; No Server-Side Rendering (SSR) support.
- **Intrarow Fragmentation**: Complex tables with extremely tall `<tr>` elements cannot be split mid-row. Emits `TABLE_INTRAROW_UNSUPPORTED` diagnostics.
- **Render Differences**: There is no guarantee of exact geometric fidelity between the browser's visual pagination and external PDF engines.

## Compatibility and Testing
Verified reference versions:
- Tiptap `2.27.3`
- Tiptap `3.31.3`

The library possesses internal unit and end-to-end integration tests via Puppeteer.
As an example of its capability, the isolated validation fixture `PE-L` successfully paginates a continuous block of 151 tabular `DataRows` across 10 virtual pages, injecting 7 automatic breaks and 6 tabular spacers. 
*Note: Successful execution on these reference versions does not implicitly certify all minor variations across the two majors.*

## Architecture and Design Decisions
For more details on why the library separates structural and visual concerns, and why it manages its own DOM layer, please consult the Architectural Decision Records (ADRs) available in the repository:
- [Architecture Overview](docs/architecture.md)
- [ADR-002: Product Independence](docs/decisions/ADR-002-product-independence.md)
- [ADR-003: Host DOM Ownership](docs/decisions/ADR-003-host-dom-ownership.md)

## License and Project Status
**Version:** Release Candidate `0.1.0-rc.1`
**Status:** Local tarball distribution. 
**License:** MIT License
