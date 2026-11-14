import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  PaginationExtension,
  whenLayoutStable,
  type LayoutConfig,
  type LayoutSnapshot,
} from '../../src/index';
import {
  PaginationController,
  LAYOUT_DEGENERATE_COORDS_CODE,
  LAYOUT_CONVERGENCE_LIMIT_CODE,
  MAX_CONVERGENCE_PASSES,
} from '../../src/controller';
import * as policiesModule from '../../src/policies';

const ManualBreakNode = Node.create({
  name: 'manualPageBreak',
  group: 'block',
  atom: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break="true"]' }];
  },
  renderHTML() {
    return ['div', { 'data-page-break': 'true' }];
  },
});

const baseLayout: LayoutConfig = {
  page: {
    width: 794,
    height: 1123,
    marginTop: 96,
    marginRight: 96,
    marginBottom: 96,
    marginLeft: 96,
    pageGap: 24,
  },
  policies: {
    keepWithNext: false,
    widowOrphan: false,
    minLinesBeforeBreak: 2,
    minLinesAfterBreak: 2,
    keepWithNextMinLines: 2,
  },
  runningContent: {
    header: { enabled: false, text: '', align: 'left' },
    footer: { enabled: false, text: '', align: 'left' },
    differentFirstPage: false,
  },
};

describe('Integração C-02/R3 + C-03/R2 — Reconciliação G-01..G-09 e matriz T-05..T-09', () => {
  let container: HTMLElement;
  let editor: Editor | null = null;
  let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;
  let originalGetClientRects: typeof Range.prototype.getClientRects;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    originalGetBCR = window.Element.prototype.getBoundingClientRect;
    originalGetClientRects = Range.prototype.getClientRects;
    window.Element.prototype.getBoundingClientRect = function () {
      return {
        width: 794,
        height: 1123,
        top: 0,
        left: 0,
        bottom: 1123,
        right: 794,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect;
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Range.prototype.getClientRects = originalGetClientRects;
    window.Element.prototype.getBoundingClientRect = originalGetBCR;
    if (editor) {
      editor.destroy();
      editor = null;
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('T-05 integrado: quebra manual dentro de blockedRegion com linhas visuais medidas (C-03) preserva precedência estrita C-02/R3', () => {
    let snapshot: LayoutSnapshot | null = null;
    Range.prototype.getClientRects = function () {
      return [
        { top: 100, bottom: 118, left: 96, right: 500, width: 404, height: 18, x: 96, y: 100, toJSON: () => ({}) },
        { top: 120, bottom: 138, left: 96, right: 500, width: 404, height: 18, x: 96, y: 120, toJSON: () => ({}) },
      ] as unknown as DOMRectList;
    };

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
          { type: 'paragraph', content: [{ type: 'text', text: 'Linha antes da quebra manual. '.repeat(12) }] },
          { type: 'manualPageBreak' },
          { type: 'paragraph', content: [{ type: 'text', text: 'Texto após quebra manual. '.repeat(8) }] },
        ],
      },
    });

    const controller = editor.storage.pagination.controller as any;
    let manualPos = -1;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === 'manualPageBreak') manualPos = offset;
    });
    expect(manualPos).toBeGreaterThan(200);

    const blockedStart = manualPos - 5;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (pos >= blockedStart + 1) {
        return { top: 1200 + (pos - blockedStart) * 2, right: 500, bottom: 1218 + (pos - blockedStart) * 2, left: 96 } as DOMRect;
      }
      const top = 100 + pos * 0.5;
      return { top, right: 500, bottom: top + 18, left: 96 } as DOMRect;
    });
    vi.spyOn(policiesModule, 'evaluateLinearPolicies').mockImplementation((candidate: any) => {
      if (candidate.exactPos === blockedStart) {
        return { status: 'blocked', pos: blockedStart, reasons: ['integrated_blocked'], renderer: 'linear-widget', code: 'INTEGRATED_BLOCKED' };
      }
      return { status: 'accepted', pos: candidate.exactPos, reasons: ['natural_overflow'], renderer: 'linear-widget' };
    });

    controller.performLayout();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.diagnostics.some((d) => d.code === 'INTEGRATED_BLOCKED')).toBe(true);
    const manuals = snapshot!.breaks.filter((b) => b.origin === 'manual');
    expect(manuals).toHaveLength(1);
    expect(manuals[0].pos).toBe(manualPos + 1);
    for (let i = 1; i < snapshot!.breaks.length; i++) {
      expect(snapshot!.breaks[i].pos).toBeGreaterThan(snapshot!.breaks[i - 1].pos);
    }
  });

  it('T-06(a) integrado: coordenada degenerada {0,0,0,0} em exactPos dentro de codeBlock (node.isTextblock C-03) aciona guarda C-02/R3 e emite diagnóstico sem quebra falsa', () => {
    let snapshot: LayoutSnapshot | null = null;
    Range.prototype.getClientRects = function () {
      return [
        { top: 100, bottom: 118, left: 96, right: 500, width: 404, height: 18, x: 96, y: 100, toJSON: () => ({}) },
        { top: 1050, bottom: 1068, left: 96, right: 500, width: 404, height: 18, x: 96, y: 1050, toJSON: () => ({}) },
      ] as unknown as DOMRectList;
    };

    const codeBody = `${'const line1 = 1;\n'.repeat(12)}const alvo = 2;\n${'const line3 = 3;\n'.repeat(10)}`;
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
          { type: 'codeBlock', content: [{ type: 'text', text: codeBody }] },
          { type: 'paragraph' },
        ],
      },
    });

    const controller = editor.storage.pagination.controller as any;
    // Simula overflow a partir de pos=201 com exactPos=199 parando na varredura (#1 -> top=200 <= targetNeutralY),
    // e na leitura de exactCoords (#2+) retornando {0,0,0,0} irrecuperável na vizinhança [175..225] dentro do codeBlock.
    let callsAtExact = 0;
    let exactTriggeredDegenerate = false;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (pos === 199) {
        callsAtExact++;
        if (callsAtExact >= 2) {
          exactTriggeredDegenerate = true;
          return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
        }
        return { top: 200, right: 500, bottom: 218, left: 96 } as DOMRect;
      }
      if (exactTriggeredDegenerate && pos >= 175 && pos <= 225) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      if (pos >= 200) {
        return { top: 1100 + (pos - 200), right: 500, bottom: 1118 + (pos - 200), left: 96 } as DOMRect;
      }
      const top = 100 + pos * 0.5;
      return { top, right: 500, bottom: top + 18, left: 96 } as DOMRect;
    });

    controller.performLayout();

    expect(exactTriggeredDegenerate).toBe(true);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.diagnostics.some((d) => d.code === LAYOUT_DEGENERATE_COORDS_CODE && d.pos === 199)).toBe(true);
    // Nenhuma quebra falsa deve ter sido decidida dentro da zona degenerada [175..225]
    expect(snapshot!.breaks.some((b) => b.pos >= 175 && b.pos <= 225)).toBe(false);
  });

  it('T-06(b) integrado: coordenada degenerada {0,0,0,0} na leitura de \\n (nlCoords) impede avanço silencioso de decision.pos++ e emite diagnóstico', () => {
    let snapshot: LayoutSnapshot | null = null;
    Range.prototype.getClientRects = function () {
      return [
        { top: 100, bottom: 118, left: 96, right: 500, width: 404, height: 18, x: 96, y: 100, toJSON: () => ({}) },
      ] as unknown as DOMRectList;
    };

    const textWithNl = `${'Linha A de teste. '.repeat(8)}\n${'Linha B após quebra. '.repeat(8)}`;
    const nlIndexInText = textWithNl.indexOf('\n');
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
          { type: 'codeBlock', content: [{ type: 'text', text: textWithNl }] },
          { type: 'paragraph' },
        ],
      },
    });

    const controller = editor.storage.pagination.controller as any;
    const nlDocPos = 1 + nlIndexInText; // codeBlock start = 1

    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      // Sonda no '\n' (decision.pos) e vizinhança no bloco retorna {0,0,0,0} irrecuperável
      if (pos >= nlDocPos - 5 && pos <= nlDocPos + 5) {
        return { top: 0, right: 0, bottom: 0, left: 0 } as DOMRect;
      }
      if (pos > nlDocPos + 5) {
        return { top: 1200 + (pos - nlDocPos), right: 500, bottom: 1218 + (pos - nlDocPos), left: 96 } as DOMRect;
      }
      return { top: 100 + pos * 0.5, right: 500, bottom: 118 + pos * 0.5, left: 96 } as DOMRect;
    });

    vi.spyOn(policiesModule, 'evaluateLinearPolicies').mockImplementation((candidate: any) => {
      if (candidate.exactPos === nlDocPos - 6) {
        return { status: 'accepted', pos: nlDocPos, reasons: ['test_nl_decision'], renderer: 'linear-widget' };
      }
      return { status: 'accepted', pos: candidate.exactPos, reasons: ['natural_overflow'], renderer: 'linear-widget' };
    });

    controller.performLayout();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.diagnostics.some((d) => d.code === LAYOUT_DEGENERATE_COORDS_CODE && d.pos === nlDocPos)).toBe(true);
    // decision.pos não pode ter avançado silenciosamente para nlDocPos + 1 a partir de {0,0,0,0}
    expect(snapshot!.breaks.some((b) => b.pos === nlDocPos + 1)).toBe(false);
  });

  it('T-07/T-08/G-09 integrado: aborto preserva pendingCyclePublishedChanges, limite emite LAYOUT_CONVERGENCE_LIMIT e API pública omite getLastConvergenceState()', async () => {
    const snapshots: LayoutSnapshot[] = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    editor = new Editor({
      element: container,
      extensions: [
        StarterKit,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          onLayoutStable: (s) => snapshots.push(s),
        }),
      ],
      content: `<p>${'Bloco integrado '.repeat(60)}</p>`,
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    expect('getLastConvergenceState' in (controller as any)).toBe(false);

    const initSnap = await whenLayoutStable(editor);
    const rev0 = initSnap.revision;

    // T-07: Pass 1 instala quebra -> Pass 2 aborta por reentrância
    let passCount = 0;
    let triggerDispatch = true;
    const origPerformLayout = (controller as any).performLayout.bind(controller);
    vi.spyOn(controller as any, 'performLayout').mockImplementation(() => {
      passCount += 1;
      return origPerformLayout();
    });
    let thresh = 180;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (passCount === 2 && triggerDispatch && pos >= 40) {
        triggerDispatch = false;
        editor!.view.dispatch(editor!.state.tr.insertText(' ', 1));
      }
      const activeT = passCount === 1 ? 180 : thresh;
      const top = pos >= activeT ? 3000 : 100 + pos * 2;
      return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
    });

    const schedSpy = vi.spyOn(controller, 'scheduleRender').mockImplementation(() => {});
    thresh = 120;
    const waiterAbort = whenLayoutStable(editor);
    (controller as any).renderVirtualPages();
    await new Promise((r) => setTimeout(r, 40));

    expect(
      (controller as any)[Symbol.for('@jhonny_bcastro/document-editor/convergence-state')]
    ).toEqual({ converged: false, aborted: true, passes: 2 });
    expect((controller as any).pendingCyclePublishedChanges).toBe(true);
    const pendingCheck = await Promise.race([
      waiterAbort.then(() => 'resolved'),
      new Promise<'pending'>((r) => setTimeout(() => r('pending'), 30)),
    ]);
    expect(pendingCheck).toBe('pending');

    // Recuperação T-07: threshold estável contabiliza exatamente +1 em revision
    schedSpy.mockRestore();
    thresh = 180;
    controller.scheduleRender();
    const afterRecovery = await waiterAbort;
    expect(afterRecovery.revision).toBe(rev0 + 1);

    // T-08: 3 passes sempre mutáveis emitem LAYOUT_CONVERGENCE_LIMIT e recuperam em ciclo limpo
    let oscillating = true;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      const t = oscillating ? 100 + passCount * 35 : 180;
      const top = pos >= t ? 3000 : 100 + pos * 2;
      return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
    });
    const limitSnap = await whenLayoutStable(editor);
    expect(limitSnap.diagnostics.some((d) => d.code === LAYOUT_CONVERGENCE_LIMIT_CODE)).toBe(true);
    expect(
      (controller as any)[Symbol.for('@jhonny_bcastro/document-editor/convergence-state')]
    ).toEqual({ converged: false, aborted: false, passes: MAX_CONVERGENCE_PASSES });

    oscillating = false;
    controller.scheduleRender();
    const cleanSnap = await whenLayoutStable(editor);
    expect(cleanSnap.diagnostics.some((d) => d.code === LAYOUT_CONVERGENCE_LIMIT_CODE)).toBe(false);
    expect(
      (controller as any)[Symbol.for('@jhonny_bcastro/document-editor/convergence-state')]
    ).toMatchObject({ converged: true, aborted: false });
  });
});
