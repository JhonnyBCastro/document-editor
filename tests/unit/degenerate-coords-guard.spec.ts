// tests/unit/degenerate-coords-guard.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension } from '../../src/extension';
import { PaginationController, LAYOUT_DEGENERATE_COORDS_CODE } from '../../src/controller';
import { LayoutConfig, LayoutSnapshot } from '../../src/types';

const baseLayout: LayoutConfig = {
  page: {
    width: 816,
    height: 1056,
    marginTop: 96,
    marginRight: 96,
    marginBottom: 96,
    marginLeft: 96,
    pageGap: 32,
  },
  policies: {
    keepWithNext: true,
    widowOrphan: true,
    minLinesBeforeBreak: 2,
    minLinesAfterBreak: 2,
    keepWithNextMinLines: 2,
  },
  runningContent: {
    header: { enabled: false, text: '', align: 'center' },
    footer: { enabled: true, text: 'Página {page} de {total}', align: 'right' },
    differentFirstPage: false,
  },
};

const ManualBreakNode = Node.create({
  name: 'manualPageBreak',
  group: 'block',
  atom: true,
  parseHTML() {
    return [{ tag: 'div[data-manual-page-break]' }];
  },
  renderHTML() {
    return ['div', { 'data-manual-page-break': 'true' }];
  },
});

describe('C-02: Guarda de Coordenadas Degeneradas {0,0,0,0} no PaginationController', () => {
  let container: HTMLElement;
  let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;
  let editor: Editor | null = null;
  let snapshot: LayoutSnapshot | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    originalGetBCR = window.Element.prototype.getBoundingClientRect;
    window.Element.prototype.getBoundingClientRect = function () {
      return {
        width: 816,
        height: 3000,
        top: 0,
        left: 0,
        bottom: 3000,
        right: 816,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect;
    };
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
    window.Element.prototype.getBoundingClientRect = originalGetBCR;
    container.remove();
    vi.restoreAllMocks();
  });

  it('rejeita retângulo degenerado {0,0,0,0} sob viewport rolada (targetNeutralY < 0) sem produzir quebra falsa', () => {
    const text = 'Linha curta inicial. '.repeat(25); // ~525 chars (deve caber em 1 página)
    snapshot = null;

    // Simula documento rolado além do targetNeutralY da 1ª página:
    // editorRect.top = -5800 -> startY = -5704 -> targetNeutralY = -4840 (< 0)
    window.Element.prototype.getBoundingClientRect = function () {
      return {
        width: 816,
        height: 8000,
        top: -5800,
        left: 0,
        bottom: 2200,
        right: 816,
        x: 0,
        y: -5800,
        toJSON: () => {},
      } as DOMRect;
    };

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: `<p>${text}</p>`,
    });

    const controller = editor.storage.pagination.controller as PaginationController;

    // Injeta retângulo degenerado {0,0,0,0} na posição pos=180 (similar ao caso erro-1)
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (pos >= 179 && pos <= 181) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      const top = -5704 + pos * 0.5;
      return { top, right: 200, bottom: top + 16, left: 96 } as DOMRect;
    });

    (controller as any).performLayout();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.breaks).toHaveLength(0);
    expect(snapshot!.pages).toHaveLength(1);
    expect(snapshot!.diagnostics).toHaveLength(0);
  });

  it('preserva coordenadas legítimas quando coords.top === 0 e há extensão física (bottom > 0 || left > 0 || right > 0)', () => {
    const text = 'Conteúdo paginado. '.repeat(120); // ~2280 chars
    snapshot = null;

    // Simula editor rolado de forma que targetNeutralY fique negativo, e posições em ~1800 têm top === 0 legítimo
    window.Element.prototype.getBoundingClientRect = function () {
      return {
        width: 816,
        height: 4000,
        top: -2000,
        left: 0,
        bottom: 2000,
        right: 816,
        x: 0,
        y: -2000,
        toJSON: () => {},
      } as DOMRect;
    };

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: `<p>${text}</p>`,
    });

    const controller = editor.storage.pagination.controller as PaginationController;

    // pos = 950 -> top = -2000 + 96 + 950 = -954; targetNeutralY = -1040 -> já estoura em pos ~ 864!
    // Vamos colocar uma região legítima com top === 0 exatamente em pos=1904 (top=-2000+96+pos) após a quebra!
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      const top = -1904 + pos; // Em pos=1904, top === 0, mas bottom=16, left=300, right=300!
      return { top, right: 300, bottom: top + 16, left: 300 } as DOMRect;
    });

    (controller as any).performLayout();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.diagnostics).toHaveLength(0);
    // Deve quebrar normalmente ao cruzar 864px úteis (~pos 864) e continuar paginando através de pos=1904 (top===0 legítimo)
    expect(snapshot!.pages.length).toBeGreaterThanOrEqual(2);
    expect(snapshot!.breaks.length).toBeGreaterThanOrEqual(1);
    expect(snapshot!.breaks[0].pos).toBeGreaterThan(800);
    expect(snapshot!.breaks[0].pos).toBeLessThan(950);
  });

  it('também preserva coordenada legítima top===0 quando apenas left/right > 0 com targetNeutralY === -1', () => {
    const text = 'Bloco curto para teste de topo exato zero. '.repeat(25);
    snapshot = null;

    window.Element.prototype.getBoundingClientRect = function () {
      return {
        width: 816,
        height: 2000,
        top: -961, // startY = -865, usableHeight = 864, targetNeutralY = -1
        left: 0,
        bottom: 1039,
        right: 816,
        x: 0,
        y: -961,
        toJSON: () => {},
      } as DOMRect;
    };

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: `<p>${text}</p>`,
    });

    const controller = editor.storage.pagination.controller as PaginationController;

    // A partir de pos=865, top === 0 com left=120, right=120 (zero height mas deslocamento X legítimo, NÃO é {0,0,0,0})
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (pos >= 865 && pos <= 900) {
        return { top: 0, right: 120, bottom: 0, left: 120 } as DOMRect;
      }
      const top = -865 + pos;
      return { top, right: 120, bottom: top + 16, left: 120 } as DOMRect;
    });

    (controller as any).performLayout();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.diagnostics).toHaveLength(0);
    expect(snapshot!.breaks.length).toBeGreaterThanOrEqual(1);
    expect(snapshot!.breaks[0].pos).toBeGreaterThanOrEqual(860);
    expect(snapshot!.breaks[0].pos).toBeLessThanOrEqual(870);
  });

  it('emite LayoutDiagnostic explícito quando a vizinhança degenerada {0,0,0,0} é irrecuperável e mantém progresso sem quebra falsa', () => {
    const text = 'Trecho sem caixa mensurável. '.repeat(15); // ~435 chars
    snapshot = null;

    window.Element.prototype.getBoundingClientRect = function () {
      return {
        width: 816,
        height: 2000,
        top: -3000,
        left: 0,
        bottom: -1000,
        right: 816,
        x: 0,
        y: -3000,
        toJSON: () => {},
      } as DOMRect;
    };

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: `<p>${text}</p>`,
    });

    const controller = editor.storage.pagination.controller as PaginationController;

    // Todas as posições retornam {0,0,0,0}
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation(() => {
      return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
    });

    (controller as any).performLayout();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.breaks).toHaveLength(0);
    expect(snapshot!.diagnostics.some((d) => d.code === LAYOUT_DEGENERATE_COORDS_CODE)).toBe(true);
  });

  it('não salta indevidamente sobre quebra manual ao sondar vizinho válido nem corrompe varredura regressiva exactPos', () => {
    const before = 'A'.repeat(170);
    const after = 'B'.repeat(1100);
    snapshot = null;

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        ManualBreakNode,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          manualBreakNodeName: 'manualPageBreak',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: before }] },
          { type: 'manualPageBreak' },
          { type: 'paragraph', content: [{ type: 'text', text: after }] },
        ],
      },
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    // Simula pos=180 como {0,0,0,0} logo após quebra manual (e pos=1105 no overflow da P2 com 1 posição degenerada após overflow)
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (pos === 180 || pos === 1105) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      const top = 96 + (pos > 175 ? pos - 175 + 100 : pos);
      return { top, right: 400, bottom: top + 16, left: 96 } as DOMRect;
    });

    (controller as any).performLayout();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.breaks.some((b) => b.origin === 'manual')).toBe(true);
    expect(snapshot!.breaks.length).toBeGreaterThanOrEqual(2);
    expect(snapshot!.diagnostics).toHaveLength(0);
  });

  it('B-01: preserva quebra manual quando {0,0,0,0} ocorre exatamente em nextManualPos sem inventar spaceLeft', () => {
    const before = 'A'.repeat(170);
    const after = 'B'.repeat(400);
    snapshot = null;

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        ManualBreakNode,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          manualBreakNodeName: 'manualPageBreak',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: before }] },
          { type: 'manualPageBreak' },
          { type: 'paragraph', content: [{ type: 'text', text: after }] },
        ],
      },
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    const totalGapSize =
      baseLayout.page.marginBottom + baseLayout.page.pageGap + baseLayout.page.marginTop; // 224

    // pos === 172 é exatamente nextManualPos (nó manualPageBreak)
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (pos === 172) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      const top = 96 + pos * 0.5;
      return { top, right: 400, bottom: top + 16, left: 96 } as DOMRect;
    });

    (controller as any).performLayout();

    expect(snapshot).not.toBeNull();
    const manualBreaks = snapshot!.breaks.filter((b) => b.origin === 'manual');
    expect(manualBreaks).toHaveLength(1);
    expect(manualBreaks[0].pos).toBe(173);
    // Sem coordenadas equivalentes válidas em 172, não inventa spaceLeft: usa exatamente totalGapSize
    expect(manualBreaks[0].effectiveDisplacement).toBe(totalGapSize);
    expect(Number.isFinite(manualBreaks[0].effectiveDisplacement)).toBe(true);
    expect(snapshot!.diagnostics.some((d) => d.code === LAYOUT_DEGENERATE_COORDS_CODE && d.pos === 172)).toBe(true);
  });

  it('B-01: preserva quebra manual em ordem documental exata quando faixa {0,0,0,0} cobre e ultrapassa nextManualPos entre quebras automáticas', () => {
    const before = 'A'.repeat(1195);
    const midDegenerate = 'C'.repeat(25);
    const after = 'B'.repeat(2400);
    snapshot = null;

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        ManualBreakNode,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          manualBreakNodeName: 'manualPageBreak',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: before }] },
          { type: 'manualPageBreak' },
          { type: 'paragraph', content: [{ type: 'text', text: midDegenerate }] },
          { type: 'paragraph', content: [{ type: 'text', text: after }] },
        ],
      },
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    // manualPageBreak está em 1197 (nodeSize=1). Faixa [1185..1225] degenerada cobrindo nextManualPos!
    // Parágrafo 'after' começa em ~1226 fora da faixa degenerada.
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (pos >= 1185 && pos <= 1225) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      const top = 96 + pos * 0.9;
      return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
    });

    (controller as any).performLayout();

    expect(snapshot).not.toBeNull();
    const manualBreaks = snapshot!.breaks.filter((b) => b.origin === 'manual');
    const autoBreaks = snapshot!.breaks.filter((b) => b.origin === 'automatic');
    expect(manualBreaks).toHaveLength(1);
    expect(manualBreaks[0].pos).toBe(1198);
    expect(autoBreaks.length).toBeGreaterThanOrEqual(2);

    // Ordem documental estrita: automática1 (< 1197) -> manual (1198) -> automática2 (> 1198)
    const manualIdx = snapshot!.breaks.findIndex((b) => b.origin === 'manual');
    expect(manualIdx).toBeGreaterThan(0);
    expect(snapshot!.breaks[manualIdx - 1].origin).toBe('automatic');
    expect(snapshot!.breaks[manualIdx - 1].pos).toBeLessThan(1197);
    expect(snapshot!.breaks[manualIdx + 1].origin).toBe('automatic');
    expect(snapshot!.breaks[manualIdx + 1].pos).toBeGreaterThan(1198);

    for (let i = 1; i < snapshot!.breaks.length; i++) {
      expect(snapshot!.breaks[i].pos).toBeGreaterThan(snapshot!.breaks[i - 1].pos);
    }
    for (const b of snapshot!.breaks) {
      expect(Number.isFinite(b.pos)).toBe(true);
      expect(Number.isFinite(b.effectiveDisplacement)).toBe(true);
    }
    expect(snapshot!.diagnostics.some((d) => d.code === LAYOUT_DEGENERATE_COORDS_CODE)).toBe(true);
  });

  it('B-02: aborta seleção de lines[K] quando exactCoords é {0,0,0,0} irrecuperável, preserva quebras válidas anteriores e avança sem pular quebra manual', () => {
    const p1 = 'Linha válida inicial. '.repeat(60); // ~1320 chars (gera quebra válida na P1)
    const p2 = 'Trecho longo com região inicial degenerada. '.repeat(20); // ~880 chars
    snapshot = null;

    const origRangeGetClientRects = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () {
      return [
        { top: 100, bottom: 116, left: 96, right: 500, width: 404, height: 16, x: 96, y: 100, toJSON: () => ({}) },
        { top: 1400, bottom: 1416, left: 96, right: 500, width: 404, height: 16, x: 96, y: 1400, toJSON: () => ({}) },
        { top: 1900, bottom: 1916, left: 96, right: 500, width: 404, height: 16, x: 96, y: 1900, toJSON: () => ({}) },
      ] as unknown as DOMRectList;
    };

    try {
      editor = new Editor({
        element: container,
        extensions: [
          StarterKit,
          ManualBreakNode,
          PaginationExtension.configure({
            layout: baseLayout,
            visualMode: 'composed',
            manualBreakNodeName: 'manualPageBreak',
            onLayoutStable: (s) => {
              snapshot = s;
            },
          }),
        ],
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: p1 }] },
            { type: 'paragraph', content: [{ type: 'text', text: p2 }] },
            { type: 'manualPageBreak' },
            { type: 'paragraph', content: [{ type: 'text', text: 'Final após manual.' }] },
          ],
        },
      });

      const controller = editor.storage.pagination.controller as PaginationController;
      let p2Start = 0;
      let manualPos = 0;
      editor.state.doc.forEach((node, offset, idx) => {
        if (idx === 1) {
          p2Start = offset + 1;
        } else if (node.type.name === 'manualPageBreak') {
          manualPos = offset;
        }
      });

      let exactPosTriggeredDegenerate = false;
      const seenOverflowThresholdPos = p2Start + 40;
      const exactStopPos = seenOverflowThresholdPos - 1;
      let callsAtTarget = 0;
      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
        if (pos === exactStopPos) {
          callsAtTarget++;
          if (callsAtTarget >= 2) {
            exactPosTriggeredDegenerate = true;
            return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
          }
          return { top: 1800, right: 500, bottom: 1816, left: 96 } as DOMRect;
        }
        if (exactPosTriggeredDegenerate && pos >= exactStopPos - 25 && pos <= exactStopPos + 25) {
          return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
        }
        if (pos >= seenOverflowThresholdPos) {
          const top = 1900 + (pos - seenOverflowThresholdPos);
          return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
        }
        const top = 96 + pos;
        return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
      });

      (controller as any).performLayout();

      expect(snapshot).not.toBeNull();
      expect(exactPosTriggeredDegenerate).toBe(true);
      // A quebra válida da P1 foi preservada (~pos 864) e nenhuma quebra falsa foi gerada com K=0
      expect(snapshot!.breaks.length).toBeGreaterThanOrEqual(2);
      const autoBreaks = snapshot!.breaks.filter((b) => b.origin === 'automatic');
      expect(autoBreaks[0].pos).toBeGreaterThan(800);
      expect(autoBreaks[0].pos).toBeLessThan(950);
      // Quebra manual posterior NÃO foi pulada
      expect(snapshot!.breaks.some((b) => b.origin === 'manual' && b.pos === manualPos + 1)).toBe(true);
      // Emitiu diagnóstico explícito de região com paginação incompleta sem inventar quebra na faixa degenerada
      expect(snapshot!.diagnostics.some((d) => d.code === LAYOUT_DEGENERATE_COORDS_CODE)).toBe(true);
    } finally {
      Range.prototype.getClientRects = origRangeGetClientRects;
    }
  });

  it('B-02: quando exactCoords é {0,0,0,0} mas vizinho equivalente na mesma linha é válido, seleciona K correto sem diagnóstico', () => {
    const p1 = 'Parágrafo com múltiplas linhas para testar seleção de linha K. '.repeat(25);
    snapshot = null;

    const origRangeGetClientRects = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () {
      return [
        { top: 100, bottom: 116, left: 96, right: 500, width: 404, height: 16, x: 96, y: 100, toJSON: () => ({}) },
        { top: 945, bottom: 961, left: 96, right: 500, width: 404, height: 16, x: 96, y: 945, toJSON: () => ({}) },
        { top: 965, bottom: 981, left: 96, right: 500, width: 404, height: 16, x: 96, y: 965, toJSON: () => ({}) },
      ] as unknown as DOMRectList;
    };

    try {
      editor = new Editor({
        element: container,
        extensions: [
          StarterKit,
          PaginationExtension.configure({
            layout: baseLayout,
            visualMode: 'composed',
            onLayoutStable: (s) => {
              snapshot = s;
            },
          }),
        ],
        content: `<p>${p1}</p>`,
      });

      const controller = editor.storage.pagination.controller as PaginationController;
      let spyCallsAtExact = 0;
      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
        // exactPos para em 864 (96+864=960 <= 960); na consulta de exactCoords (2ª leitura em 864),
        // simula {0,0,0,0} isolado com vizinhos válidos 863 e 865 na mesma linha visual (top ~960 -> K=1, não K=0!)
        if (pos === 864) {
          spyCallsAtExact++;
          if (spyCallsAtExact === 2) {
            return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
          }
        }
        const top = 96 + pos;
        return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
      });

      (controller as any).performLayout();

      expect(snapshot).not.toBeNull();
      expect(spyCallsAtExact).toBeGreaterThanOrEqual(2);
      expect(snapshot!.diagnostics).toHaveLength(0);
      expect(snapshot!.breaks.length).toBeGreaterThanOrEqual(1);
      expect(snapshot!.breaks[0].pos).toBeGreaterThan(800);
    } finally {
      Range.prototype.getClientRects = origRangeGetClientRects;
    }
  });

  it('B-03: valida equivalência estrita do vizinho recuperado (mesmo nó, mesma linha visual, sem atravessar manualPageBreak ou decoração estrutural)', () => {
    const p1 = 'Parágrafo A linha unica.'; // 1..24
    const p2 = 'Parágrafo B texto contínuo na linha um e também continua na linha dois visualmente.';
    snapshot = null;

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        ManualBreakNode,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          manualBreakNodeName: 'manualPageBreak',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: p1 }] },
          { type: 'manualPageBreak' },
          { type: 'paragraph', content: [{ type: 'text', text: p2 }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Parágrafo C separado.' }] },
        ],
      },
    });

    const controller = editor.storage.pagination.controller as any;
    const doc = editor.state.doc;
    let p1Start = 0;
    let p1End = 0;
    let manualPos = 0;
    let p2Start = 0;
    let p2End = 0;
    let p3Start = 0;
    doc.forEach((node, offset, idx) => {
      if (idx === 0) { p1Start = offset + 1; p1End = offset + node.nodeSize - 1; }
      if (idx === 1) { manualPos = offset; }
      if (idx === 2) { p2Start = offset + 1; p2End = offset + node.nodeSize - 1; }
      if (idx === 3) { p3Start = offset + 1; }
    });

    const p2MidWrap = p2Start + 35;

    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      // 1) Em p1End: somente p1End-1 é {0,0,0,0}, mas p1End é validável apenas se mesmo bloco;
      // aqui vamos deixar TODO p1 (exceto nada? não: deixar p1End {0,0,0,0} e p1End-1 {0,0,0,0} -> próximo válido é manualPos+2 em P2!)
      if (pos >= p1End - 2 && pos <= p1End) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      // 2) Em p2: p2MidWrap é {0,0,0,0}, esquerda (< p2MidWrap) está na Linha 0 (top=200), direita (> p2MidWrap) está na Linha 1 (top=220) -> linhas visuais diferentes!
      if (pos === p2MidWrap) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      // 3) Em p2+10: {0,0,0,0} cercado por p2+9 (top=200) e p2+11 (top=200) -> MESMA linha visual e mesmo nó!
      if (pos === p2Start + 10) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      // 4) Em p3Start..p3Start+2: {0,0,0,0}, válido apenas em P2 (nó anterior) ou além de structPos
      if (pos >= p3Start && pos <= p3Start + 3) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      if (pos >= p2Start && pos < p2MidWrap) {
        return { top: 200, right: 300, bottom: 216, left: 96 } as DOMRect;
      }
      if (pos > p2MidWrap && pos <= p2End) {
        return { top: 220, right: 300, bottom: 236, left: 96 } as DOMRect;
      }
      const top = 100 + pos;
      return { top, right: 300, bottom: top + 16, left: 96 } as DOMRect;
    });

    // (a) Mesmo nó + mesma linha visual (p2Start+10 cercado por top=200/200) -> ACEITO
    const resSameLine = controller.findEquivalentValidCoords(p2Start + 10, 1, doc.content.size, 20, [manualPos], []);
    expect(resSameLine).not.toBeNull();
    expect(resSameLine.coords.top).toBe(200);
    expect(Math.abs(resSameLine.pos - (p2Start + 10))).toBe(1);

    // (b) Linha visual diferente (p2MidWrap entre Linha 0 top=200 e Linha 1 top=220) -> REJEITADO (null)
    const resDiffLine = controller.findEquivalentValidCoords(p2MidWrap, 1, doc.content.size, 20, [manualPos], []);
    expect(resDiffLine).toBeNull();

    // (c) Cruzamento de manualPageBreak / nó diferente (p1End..p1End-2 degenerado) -> REJEITADO (null)
    const resCrossManual = controller.findEquivalentValidCoords(p1End - 1, 1, doc.content.size, 20, [manualPos], []);
    expect(resCrossManual).toBeNull();

    // (d) Cruzamento de nó diferente mesmo sem manualPageBreak (p3Start+1 com todo P3 anterior degenerado) -> REJEITADO (null)
    const resCrossNode = controller.findEquivalentValidCoords(p3Start + 1, 1, doc.content.size, 20, [], []);
    expect(resCrossNode).toBeNull();

    // (e) Separação por decoração estrutural currentStructural (d.from = p2Start + 10 ou p2Start + 11) -> REJEITADO quando única âncora está do outro lado de d.from
    const resCrossStructural = controller.findEquivalentValidCoords(
      p2Start + 10,
      1,
      doc.content.size,
      20,
      [manualPos],
      [{ from: p2Start + 9 }, { from: p2Start + 11 }]
    );
    expect(resCrossStructural).toBeNull();
  });

  it('B-03: no ponto de quebra aceito (coordsBefore), {0,0,0,0} não-equivalente não inventa spaceLeft e emite LAYOUT_DEGENERATE_COORDS', () => {
    const p1 = 'A'.repeat(1100);
    snapshot = null;

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: `<p>${p1}</p>`,
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    // Simula overflow onde exactPos=864 passa pelo backward scan (#1 -> 960) e exactCoords (#2 -> 960),
    // e então ao ser consultado em coordsBefore (decision.pos=864, chamada #3+) retorna {0,0,0,0}!
    // Na vizinhança de 864, esquerda (<864) está em linha anterior (top=200) e direita (>864) em linha posterior (top=970) -> linhas visuais distintas!
    let callsAt864 = 0;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (pos === 864) {
        callsAt864++;
        if (callsAt864 === 3) {
          return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
        }
        return { top: 960, right: 400, bottom: 976, left: 96 } as DOMRect;
      }
      if (pos < 864) {
        return { top: 200, right: 400, bottom: 216, left: 96 } as DOMRect;
      }
      const top = 96 + pos;
      return { top, right: 400, bottom: top + 16, left: 96 } as DOMRect;
    });

    (controller as any).performLayout();

    expect(snapshot).not.toBeNull();
    expect(callsAt864).toBeGreaterThanOrEqual(3);
    // Como decision.pos=864 tornou-se {0,0,0,0} entre linhas visuais distintas (200 vs 961+),
    // a quebra ambígua foi descartada sem inventar spaceLeft=760 e emitiu LAYOUT_DEGENERATE_COORDS.
    for (const b of snapshot!.breaks) {
      expect(b.effectiveDisplacement).toBeLessThan(600);
    }
    expect(snapshot!.diagnostics.some((d) => d.code === LAYOUT_DEGENERATE_COORDS_CODE)).toBe(true);
  });

  // ── C-02/R2: Progressão segura diante de quebra manual pendente (B-01/R2) ──

  it('C-02/R2 B-01: varredura antes de nextManualPos com sonda exatamente no marcador ou decisão após ele não pula quebra manual pendente', () => {
    const p1 = 'A'.repeat(1100); // conteúdo 1..1100, node 0..1102
    const p2 = 'B'.repeat(2400);
    const p3 = 'C'.repeat(400);
    snapshot = null;

    const origRangeGetClientRects = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () {
      const rects: DOMRect[] = [];
      for (let top = 100; top <= 3600; top += 20) {
        rects.push({
          top,
          bottom: top + 16,
          left: 96,
          right: 500,
          width: 404,
          height: 16,
          x: 96,
          y: top,
          toJSON: () => ({}),
        } as DOMRect);
      }
      return rects as unknown as DOMRectList;
    };

    try {
      editor = new Editor({
        element: container,
        extensions: [
          StarterKit,
          ManualBreakNode,
          PaginationExtension.configure({
            layout: baseLayout,
            visualMode: 'composed',
            manualBreakNodeName: 'manualPageBreak',
            onLayoutStable: (s) => {
              snapshot = s;
            },
          }),
        ],
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: p1 }] },
            { type: 'manualPageBreak' },
            { type: 'paragraph', content: [{ type: 'text', text: p2 }] },
            { type: 'manualPageBreak' },
            { type: 'paragraph', content: [{ type: 'text', text: p3 }] },
          ],
        },
      });

      const controller = editor.storage.pagination.controller as PaginationController;
      const manualPositions: number[] = [];
      editor.state.doc.forEach((node, offset) => {
        if (node.type.name === 'manualPageBreak') manualPositions.push(offset);
      });
      expect(manualPositions).toHaveLength(2);
      const [m1Pos, m2Pos] = manualPositions; // m1Pos = 1102, m2Pos = 2205

      // Caso 1: antes de m1Pos (pos = m1Pos - 10), exactPos/probe no próprio marcador ou vizinho próximo,
      // e exactCoords irrecuperável em m1Pos-12..m1Pos com região degenerada cobrindo [m1Pos-15..m1Pos+10],
      // forçando advanceSafelyWithoutSkippingManual enquanto pos < m1Pos!
      // Caso 2: antes de m2Pos (pos = m2Pos - 8), simulação onde overflow faz decision/exactPos alcançar >= m2Pos.
      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
        // Sonda em m1Pos - 10: retorna overflow (> target 960), backward scan encontra exactPos = m1Pos - 11,
        // mas na leitura de exactCoords/coordsBefore toda a faixa [m1Pos - 15 .. m1Pos + 10] é {0,0,0,0}!
        if (pos >= m1Pos - 15 && pos <= m1Pos + 10) {
          return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
        }
        // Em m2Pos - 8..m2Pos - 1: mantém região válida mas próxima da segunda quebra manual
        if (pos >= m2Pos - 5 && pos <= m2Pos + 5) {
          return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
        }
        const top = 96 + pos * 0.92;
        return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
      });

      (controller as any).performLayout();

      expect(snapshot).not.toBeNull();
      const breaks = snapshot!.breaks;
      const manuals = breaks.filter((b) => b.origin === 'manual');
      const autos = breaks.filter((b) => b.origin === 'automatic');

      // Ambas as quebras manuais preservadas nas posições documentais exatas, sem duplicação e sem omissão
      expect(manuals.map((b) => b.pos)).toEqual([m1Pos + 1, m2Pos + 1]);
      expect(autos.length).toBeGreaterThanOrEqual(2);

      // Ordem documental estritamente crescente e coerente com os marcos m1Pos e m2Pos
      for (let i = 1; i < breaks.length; i++) {
        expect(breaks[i].pos).toBeGreaterThan(breaks[i - 1].pos);
      }
      const m1Idx = breaks.findIndex((b) => b.origin === 'manual' && b.pos === m1Pos + 1);
      const m2Idx = breaks.findIndex((b) => b.origin === 'manual' && b.pos === m2Pos + 1);
      expect(m1Idx).toBeGreaterThan(0);
      expect(m2Idx).toBeGreaterThan(m1Idx);
      expect(breaks[m1Idx - 1].pos).toBeLessThan(m1Pos);
      expect(breaks[m1Idx + 1].pos).toBeGreaterThan(m1Pos + 1);
      expect(breaks[m2Idx - 1].pos).toBeLessThan(m2Pos);
      expect(snapshot!.diagnostics.some((d) => d.code === LAYOUT_DEGENERATE_COORDS_CODE)).toBe(true);
    } finally {
      Range.prototype.getClientRects = origRangeGetClientRects;
    }
  });

  it('C-02/R2 B-01: quando findEquivalentValidCoords recupera coordsPos >= nextManualPos ou decisão proposta > nextManualPos, varredura para em nextManualPos sem saltar o marcador', () => {
    const p1 = 'A'.repeat(200);
    const p2 = 'B'.repeat(200);
    snapshot = null;

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        ManualBreakNode,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          manualBreakNodeName: 'manualPageBreak',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: p1 }] },
          { type: 'manualPageBreak' },
          { type: 'paragraph', content: [{ type: 'text', text: p2 }] },
        ],
      },
    });

    const controller = editor.storage.pagination.controller as any;
    let manualPos = -1;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === 'manualPageBreak') manualPos = offset;
    });
    expect(manualPos).toBe(202);

    // Força cenário em que probePos < manualPos retorna {0,0,0,0},
    // mas o helper de recuperação devolve uma posição situada no marcador (coordsPos = manualPos)
    // ou além dele (coordsPos = manualPos + 12), enquanto exactCoords/coordsBefore em seguida falha.
    const spyEq = vi.spyOn(controller, 'findEquivalentValidCoords')
      .mockImplementationOnce(() => ({
        pos: manualPos, // exatamente no marcador enquanto varredura ainda está em pos = 180 < 202
        coords: { top: 2000, right: 500, bottom: 2016, left: 96 },
      }))
      .mockImplementationOnce(() => null); // exactCoords falha -> deve chamar advanceSafelyWithoutSkippingManual(max(180, 202))

    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (pos >= 180 && pos <= manualPos + 2) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      const top = 100 + pos;
      return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
    });

    controller.performLayout();

    expect(spyEq).toHaveBeenCalled();
    expect(snapshot).not.toBeNull();
    const manuals = snapshot!.breaks.filter((b) => b.origin === 'manual');
    expect(manuals).toHaveLength(1);
    expect(manuals[0].pos).toBe(manualPos + 1);
    expect(snapshot!.diagnostics.some((d) => d.code === LAYOUT_DEGENERATE_COORDS_CODE)).toBe(true);
  });

  it('C-02/R2 B-01: decisão proposta após nextManualPos com quebra manual pendente não omite nem reordena a quebra manual e garante progresso finito', () => {
    const p1 = 'Linha antes da quebra manual. '.repeat(35); // ~1050 chars
    const p2 = 'Texto após quebra manual. '.repeat(20);
    snapshot = null;

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        ManualBreakNode,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          manualBreakNodeName: 'manualPageBreak',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: p1 }] },
          { type: 'manualPageBreak' },
          { type: 'paragraph', content: [{ type: 'text', text: p2 }] },
        ],
      },
    });

    const controller = editor.storage.pagination.controller as any;
    let manualPos = -1;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === 'manualPageBreak') manualPos = offset;
    });
    expect(manualPos).toBeGreaterThan(900);

    // Simula overflow logo antes de manualPos (em manualPos - 10) onde coordsBefore após
    // decision.pos (manualPos + 5 via \n ou decisão estendida) retorna {0,0,0,0} e também
    // cenário onde coordsBefore é válido: em nenhum caso a quebra manual pode ser saltada.
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (pos >= manualPos - 12 && pos <= manualPos - 1) {
        return { top: 1200, right: 500, bottom: 1216, left: 96 } as DOMRect;
      }
      if (pos >= manualPos - 30 && pos < manualPos - 12) {
        return { top: 900, right: 500, bottom: 916, left: 96 } as DOMRect;
      }
      if (pos === manualPos) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      const top = 100 + pos * 0.5;
      return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
    });

    // Força também findEquivalentValidCoords a devolver posição além do marcador uma vez
    vi.spyOn(controller, 'findEquivalentValidCoords').mockImplementation((...args: any[]) => {
      const centerPos = args[0] as number;
      if (centerPos < manualPos && centerPos >= manualPos - 20) {
        return { pos: manualPos + 15, coords: { top: 1250, right: 500, bottom: 1266, left: 96 } };
      }
      return null;
    });

    controller.performLayout();

    expect(snapshot).not.toBeNull();
    const manuals = snapshot!.breaks.filter((b) => b.origin === 'manual');
    expect(manuals).toHaveLength(1);
    expect(manuals[0].pos).toBe(manualPos + 1);
    for (let i = 1; i < snapshot!.breaks.length; i++) {
      expect(snapshot!.breaks[i].pos).toBeGreaterThan(snapshot!.breaks[i - 1].pos);
    }
  });

  // ── C-02/R2: Equivalência estrita da âncora visual (B-03/R2) ──

  it('C-02/R2 B-03: rejeita confirmação bilateral quando uma sonda não tem linha visual medida identificável ou pertence a linha distinta dentro de <= 4 px', () => {
    const text = 'Parágrafo com linhas visuais medidas próximas e texto contínuo de exemplo.';
    snapshot = null;

    const origRangeGetClientRects = Range.prototype.getClientRects;
    // Duas linhas visuais medidas: Linha 0 = [100..116], Linha 1 = [118..134] (apenas 2 px de distância!)
    Range.prototype.getClientRects = function () {
      return [
        { top: 100, bottom: 116, left: 96, right: 500, width: 404, height: 16, x: 96, y: 100, toJSON: () => ({}) },
        { top: 118, bottom: 134, left: 96, right: 500, width: 404, height: 16, x: 96, y: 118, toJSON: () => ({}) },
      ] as unknown as DOMRectList;
    };

    try {
      editor = new Editor({
        element: container,
        extensions: [
          StarterKit,
          PaginationExtension.configure({
            layout: baseLayout,
            visualMode: 'composed',
            onLayoutStable: (s) => {
              snapshot = s;
            },
          }),
        ],
        content: `<p>${text}</p>`,
      });

      const controller = editor.storage.pagination.controller as any;
      const pDom = editor.view.dom.querySelector('p') as HTMLElement;
      expect(pDom).toBeTruthy();
      const docSize = editor.state.doc.content.size;

      // Subcaso A: Duas sondas associadas à MESMA linha medida (Linha 0: top=104 e top=106) -> ACEITO
      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
        if (pos === 20) return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
        if (pos < 20) return { top: 104, right: 200, bottom: 115, left: 96 } as DOMRect;
        return { top: 106, right: 220, bottom: 115, left: 96 } as DOMRect;
      });
      const sameMeasured = controller.findEquivalentValidCoords(20, 1, docSize, 10, [], [], null, pDom);
      expect(sameMeasured).not.toBeNull();
      expect(sameMeasured.pos).toBe(21);

      // Subcaso B: Uma sonda na Linha 0 (top=115) e outra na Linha 1 (top=118) com |115-118| = 3 <= 4 -> REJEITADO!
      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
        if (pos === 20) return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
        if (pos < 20) return { top: 115, right: 480, bottom: 116, left: 96 } as DOMRect; // Linha 0 [100..116]
        return { top: 118, right: 120, bottom: 134, left: 96 } as DOMRect; // Linha 1 [118..134]
      });
      const closeDiffLines = controller.findEquivalentValidCoords(20, 1, docSize, 10, [], [], null, pDom);
      expect(closeDiffLines).toBeNull();

      // Subcaso C: Uma sonda na Linha 0 (top=100) e outra SEM associação a nenhuma linha medida (top=103? não, top=90 ou top=180, ou top=103 dentro? não: linha 0 é [100..116], top=97 está fora de [100..116] e |100-97|=3 <= 4! e top=140 também fora)
      // Nota: top=97 e |100-97|=3<=4 mas fora de [99..117] -> findVisualLineIdx === -1!
      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
        if (pos === 20) return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
        if (pos < 20) return { top: 100, right: 200, bottom: 116, left: 96 } as DOMRect; // Linha 0
        return { top: 97, right: 200, bottom: 113, left: 96 } as DOMRect; // Sem linha visual associável (-3px acima da Linha 0, dentro de 4px!)
      });
      const orphanProbe = controller.findEquivalentValidCoords(20, 1, docSize, 10, [], [], null, pDom);
      expect(orphanProbe).toBeNull();
    } finally {
      Range.prototype.getClientRects = origRangeGetClientRects;
    }
  });

  it('C-02/R2 B-03: recuperação unilateral aceita exclusivamente espaços colapsados e rejeita qualquer caractere não branco', () => {
    snapshot = null;
    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          onLayoutStable: (s) => {
            snapshot = s;
          },
        }),
      ],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'abc   ' }] }, // pos 1..7 ('a'=1,'b'=2,'c'=3,' '=4,' '=5,' '=6, end=7)
          { type: 'paragraph', content: [{ type: 'text', text: '   xyz' }] }, // pos 9..15
        ],
      },
    });

    const controller = editor.storage.pagination.controller as any;
    const docSize = editor.state.doc.content.size;

    // P1: posições 5..7 (apenas espaços finais após ' ') retornam {0,0,0,0}, posição 4 (início do primeiro ' ') é válida.
    // Entre 4 e 6 há apenas '  ' (somente espaços colapsados, sem não-brancos e sem conteúdo posterior) -> ACEITO!
    // Já no parágrafo P1 com 4 válido e centro em 6 se houver caractere 'c' no intervalo (ex.: válido só em 3, centro em 5 -> textBetween(3,5)='c ') -> REJEITADO!
    const coordsSpy = vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (pos >= 5 && pos <= 7) return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      if (pos >= 9 && pos <= 11) return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      const top = 100 + pos * 2;
      return { top, right: 300, bottom: top + 16, left: 96 } as DOMRect;
    });

    // (a) Unilateral para trás apenas espaços colapsados (4..6 = "  ") -> ACEITO em pos=4
    const backSpacesOnly = controller.findEquivalentValidCoords(6, 1, docSize, 10, [], []);
    expect(backSpacesOnly).not.toBeNull();
    expect(backSpacesOnly.pos).toBe(4);

    // (b) Unilateral para frente apenas espaços colapsados (10..12 = "  ") -> ACEITO em pos=12
    const fwdSpacesOnly = controller.findEquivalentValidCoords(10, 1, docSize, 10, [], []);
    expect(fwdSpacesOnly).not.toBeNull();
    expect(fwdSpacesOnly.pos).toBe(12);

    // (c) Agora torna pos=4 também {0,0,0,0}, deixando pos=3 (antes de 'c') como nearestBackward:
    // textBetween(3, 6) = "c  " contém o caractere não branco 'c' -> DEVE REJEITAR (null)!
    coordsSpy.mockImplementation((pos: number) => {
      if (pos >= 4 && pos <= 7) return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      const top = 100 + pos * 2;
      return { top, right: 300, bottom: top + 16, left: 96 } as DOMRect;
    });
    const backWithNonWhitespace = controller.findEquivalentValidCoords(5, 1, docSize, 10, [], []);
    expect(backWithNonWhitespace).toBeNull();
  });

  // ── C-02/R3: Precedência estrita de quebra manual pendente sobre blockedRegion ──

  it('C-02/R3 (a/b/c/d): nextManualPos no interior, fronteira inicial/decisão blocked, fronteira final e com coords degeneradas dentro de blockedRegion nunca é omitido em execução de duas iterações', async () => {
    const policiesModule = await import('../../src/policies');
    const createManualDocEditor = (p1Text: string, p2Text: string) => {
      vi.restoreAllMocks();
      snapshot = null;
      if (editor) {
        editor.destroy();
      }
      editor = new Editor({
        element: container,
        extensions: [
          StarterKit,
          ManualBreakNode,
          PaginationExtension.configure({
            layout: baseLayout,
            visualMode: 'composed',
            manualBreakNodeName: 'manualPageBreak',
            onLayoutStable: (s) => {
              snapshot = s;
            },
          }),
        ],
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: p1Text }] },
            { type: 'manualPageBreak' },
            { type: 'paragraph', content: [{ type: 'text', text: p2Text }] },
          ],
        },
      });
      let manualPos = -1;
      editor.state.doc.forEach((node, offset) => {
        if (node.type.name === 'manualPageBreak') manualPos = offset;
      });
      return {
        controller: editor.storage.pagination.controller as any,
        manualPos,
      };
    };

    const assertManualInvariant = (manualPos: number) => {
      expect(snapshot).not.toBeNull();
      const manuals = snapshot!.breaks.filter((b) => b.origin === 'manual');
      expect(manuals).toHaveLength(1);
      expect(manuals[0].pos).toBe(manualPos + 1);
      expect(manuals[0].reasons).toContain('manual_page_break');
      for (let i = 1; i < snapshot!.breaks.length; i++) {
        expect(snapshot!.breaks[i].pos).toBeGreaterThan(snapshot!.breaks[i - 1].pos);
      }
    };

    // Caso (a) Interior: overflow em pos >= blockedStart + 1 => exactPos = blockedStart (= manualPos - 5),
    // blockedRegion = [manualPos - 5 .. manualPos + 5] (nextManualPos no interior da blockedRegion).
    // Iteração 1: guardManualStep limita salto para manualPos; Iteração 2: pos === manualPos dentro da blockedRegion.
    {
      const { controller, manualPos } = createManualDocEditor(
        'Linha antes da quebra manual. '.repeat(12),
        'Texto após quebra manual. '.repeat(8),
      );
      const blockedStart = manualPos - 5;
      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
        if (pos >= blockedStart + 1) {
          return { top: 1200 + (pos - blockedStart) * 2, right: 500, bottom: 1216 + (pos - blockedStart) * 2, left: 96 } as DOMRect;
        }
        const top = 100 + pos * 0.5;
        return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
      });
      const policySpy = vi.spyOn(policiesModule, 'evaluateLinearPolicies').mockImplementation((candidate: any) => {
        if (candidate.exactPos === blockedStart) {
          return { status: 'blocked', pos: blockedStart, reasons: ['test_blocked_region'], renderer: 'linear-widget', code: 'TEST_BLOCKED_INTERIOR' };
        }
        return { status: 'accepted', pos: candidate.exactPos, reasons: ['natural_overflow'], renderer: 'linear-widget' };
      });

      controller.performLayout();
      expect(policySpy).toHaveBeenCalled();
      expect(snapshot!.diagnostics.some((d) => d.code === 'TEST_BLOCKED_INTERIOR')).toBe(true);
      assertManualInvariant(manualPos);
    }

    // Caso (b) Fronteira final: blockedStart = manualPos - 10 => blockedRegionEnd === manualPos
    {
      const { controller, manualPos } = createManualDocEditor(
        'Linha antes da quebra manual. '.repeat(12),
        'Texto após quebra manual. '.repeat(8),
      );
      const blockedStart = manualPos - 10;
      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
        if (pos >= blockedStart + 1) {
          return { top: 1200 + (pos - blockedStart) * 2, right: 500, bottom: 1216 + (pos - blockedStart) * 2, left: 96 } as DOMRect;
        }
        const top = 100 + pos * 0.5;
        return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
      });
      vi.spyOn(policiesModule, 'evaluateLinearPolicies').mockImplementation((candidate: any) => {
        if (candidate.exactPos === blockedStart) {
          return { status: 'blocked', pos: blockedStart, reasons: ['test_blocked_end_boundary'], renderer: 'linear-widget', code: 'TEST_BLOCKED_END' };
        }
        return { status: 'accepted', pos: candidate.exactPos, reasons: ['natural_overflow'], renderer: 'linear-widget' };
      });

      controller.performLayout();
      expect(snapshot!.diagnostics.some((d) => d.code === 'TEST_BLOCKED_END')).toBe(true);
      assertManualInvariant(manualPos);
    }

    // Caso (c) Fronteira inicial: pos < nextManualPos com {0,0,0,0} recupera em coordsPos === manualPos (> target),
    // ou decision.status === 'blocked' enquanto pos === nextManualPos (atPendingManual)
    {
      const { controller, manualPos } = createManualDocEditor(
        'Linha antes da quebra manual. '.repeat(12),
        'Texto após quebra manual. '.repeat(8),
      );
      const overflowThreshold = manualPos - 1;
      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
        if (pos >= manualPos) {
          return { top: 1200 + (pos - manualPos) * 2, right: 500, bottom: 1216 + (pos - manualPos) * 2, left: 96 } as DOMRect;
        }
        const top = 100 + pos * 0.5;
        return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
      });
      vi.spyOn(policiesModule, 'evaluateLinearPolicies').mockImplementation((candidate: any) => {
        if (candidate.exactPos === overflowThreshold) {
          return { status: 'blocked', pos: overflowThreshold, reasons: ['test_blocked_start_boundary'], renderer: 'linear-widget', code: 'TEST_BLOCKED_START' };
        }
        return { status: 'accepted', pos: candidate.exactPos, reasons: ['natural_overflow'], renderer: 'linear-widget' };
      });

      controller.performLayout();
      expect(snapshot!.diagnostics.some((d) => d.code === 'TEST_BLOCKED_START')).toBe(true);
      assertManualInvariant(manualPos);
    }

    // Caso (d) Coords degeneradas {0,0,0,0} sobre manualPos dentro de blockedRegion [manualPos - 5 .. manualPos + 5]
    {
      const { controller, manualPos } = createManualDocEditor(
        'Linha antes da quebra manual. '.repeat(12),
        'Texto após quebra manual. '.repeat(8),
      );
      const blockedStart = manualPos - 5;
      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
        if (pos >= manualPos - 1 && pos <= manualPos + 3) {
          return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
        }
        if (pos >= blockedStart + 1) {
          return { top: 1200 + (pos - blockedStart) * 2, right: 500, bottom: 1216 + (pos - blockedStart) * 2, left: 96 } as DOMRect;
        }
        const top = 100 + pos * 0.5;
        return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
      });
      vi.spyOn(policiesModule, 'evaluateLinearPolicies').mockImplementation((candidate: any) => {
        if (candidate.exactPos === blockedStart) {
          return { status: 'blocked', pos: blockedStart, reasons: ['test_blocked_degenerate_manual'], renderer: 'linear-widget', code: 'TEST_BLOCKED_DEGEN' };
        }
        return { status: 'accepted', pos: candidate.exactPos, reasons: ['natural_overflow'], renderer: 'linear-widget' };
      });

      controller.performLayout();
      expect(snapshot!.diagnostics.some((d) => d.code === 'TEST_BLOCKED_DEGEN')).toBe(true);
      assertManualInvariant(manualPos);
      expect(snapshot!.diagnostics.some((d) => d.code === LAYOUT_DEGENERATE_COORDS_CODE)).toBe(true);
    }
  });
});

