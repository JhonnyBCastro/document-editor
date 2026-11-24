import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor, Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Plugin } from '@tiptap/pm/state';
import { PaginationExtension, PaginationPluginKey } from '../../src/extension';
import {
  PaginationController,
  LAYOUT_CONVERGENCE_LIMIT_CODE,
  MAX_CONVERGENCE_PASSES,
} from '../../src/controller';
import { whenLayoutStable } from '../../src/index';
import type { LayoutConfig, LayoutSnapshot } from '../../src/types';

const baseLayout: LayoutConfig = {
  page: {
    width: 794,
    height: 520,
    marginTop: 48,
    marginRight: 48,
    marginBottom: 48,
    marginLeft: 48,
    pageGap: 20,
  },
  policies: {
    keepWithNext: false,
    widowOrphan: false,
    minLinesBeforeBreak: 2,
    minLinesAfterBreak: 2,
    keepWithNextMinLines: 2,
  },
  runningContent: {
    header: { enabled: false, text: '', align: 'center' },
    footer: { enabled: true, text: 'Pagina {page} de {total}', align: 'right' },
    differentFirstPage: false,
  },
};

const ManualPageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  parseHTML: () => [{ tag: 'div[data-type="page-break"]' }],
  renderHTML: () => ['div', { 'data-type': 'page-break' }],
});

describe('T1-R2 Budget Regression Suite — Orçamento Entre Ciclos, Revisões, Listeners e Guardas', () => {
  let host: HTMLElement;
  let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;
  let originalRaf: typeof window.requestAnimationFrame;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    originalGetBCR = window.Element.prototype.getBoundingClientRect;
    originalRaf = window.requestAnimationFrame;
    window.Element.prototype.getBoundingClientRect = function () {
      return {
        width: 794,
        height: 520,
        top: 0,
        left: 0,
        bottom: 520,
        right: 794,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.requestAnimationFrame = originalRaf;
    window.Element.prototype.getBoundingClientRect = originalGetBCR;
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  });

  it('alternância entre publicação intermediária válida e invalidação esgota orçamento em 3 ciclos reais e impede contorno por whenLayoutStable()', async () => {
    vi.useFakeTimers();
    const rafQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let pubTxCount = 0;
    let validIntermediatePubs = 0;
    let invalidatedPubs = 0;
    const snapshots: LayoutSnapshot[] = [];

    const AlternatingAppendExt = Extension.create({
      name: 'alternatingAppendR2',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            appendTransaction(trs, _old, next) {
              if (trs.some((tr) => tr.getMeta(PaginationPluginKey) !== undefined)) {
                pubTxCount += 1;
                if (pubTxCount % 2 === 1) {
                  validIntermediatePubs += 1;
                  return null;
                }
                invalidatedPubs += 1;
                return next.tr.insertText('!', next.doc.content.size - 1);
              }
              return null;
            },
          }),
        ];
      },
    });

    const editor = new Editor({
      element: host,
      extensions: [
        StarterKit.configure({ trailingNode: false }),
        ManualPageBreak,
        AlternatingAppendExt,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          onLayoutStable: (s) => snapshots.push(s),
        }),
      ],
      content: '<p>Bloco inicial</p><div data-type="page-break"></div><p>Bloco final</p>',
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    let layoutCalls = 0;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => {
      const shift = layoutCalls * 7;
      return {
        top: pos * 10 + shift,
        bottom: pos * 10 + shift + 18,
        left: 48,
        right: 700,
      } as DOMRect;
    });

    const origPerform = (controller as any).performLayout.bind(controller);
    (controller as any).performLayout = () => {
      layoutCalls += 1;
      return origPerform();
    };

    let listener1Resolved = false;
    void whenLayoutStable(editor).then(() => {
      listener1Resolved = true;
    });

    // Executa até um teto de segurança externo de 6 ciclos
    let cyclesExecuted = 0;
    for (let c = 0; c < 6; c++) {
      if (!(controller as any).renderTimeout && rafQueue.length === 0) break;
      vi.advanceTimersByTime(150);
      if (rafQueue.length > 0) {
        cyclesExecuted += 1;
        rafQueue.shift()!(cyclesExecuted * 16);
      }
    }

    // Deve parar exatamente em MAX_CONVERGENCE_PASSES (3) ciclos — nunca renovar por publicação intermediária válida
    expect(cyclesExecuted).toBe(MAX_CONVERGENCE_PASSES);
    expect(validIntermediatePubs).toBe(MAX_CONVERGENCE_PASSES);
    expect(invalidatedPubs).toBe(MAX_CONVERGENCE_PASSES);
    expect((controller as any).publicationInvalidationsInAttempt).toBe(MAX_CONVERGENCE_PASSES);
    expect((controller as any).publicationRecoveryExhausted).toBe(true);
    expect((controller as any).renderTimeout).toBeNull();
    expect(rafQueue).toHaveLength(0);
    expect(snapshots).toHaveLength(0);
    expect((controller as any).revision).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(LAYOUT_CONVERGENCE_LIMIT_CODE));

    // Chamadas repetidas de whenLayoutStable() após esgotamento não podem contornar o orçamento
    let listener2Resolved = false;
    void whenLayoutStable(editor).then(() => {
      listener2Resolved = true;
    });
    vi.advanceTimersByTime(500);
    expect(rafQueue).toHaveLength(0);
    expect((controller as any).renderTimeout).toBeNull();
    expect(invalidatedPubs).toBe(MAX_CONVERGENCE_PASSES);

    await Promise.resolve();
    expect(listener1Resolved).toBe(false);
    expect(listener2Resolved).toBe(false);
    expect((controller as any).stableListeners).toHaveLength(2);

    editor.destroy();
  });

  it('retomada após alteração externa legítima reinicializa orçamento, converge, contabiliza revisão única e resolve listeners pendentes', async () => {
    vi.useFakeTimers();
    const rafQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let invalidateEnabled = true;
    let pubTxCount = 0;
    const snapshots: LayoutSnapshot[] = [];

    const ToggleableAppendExt = Extension.create({
      name: 'toggleableAlternatingAppend',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            appendTransaction(trs, _old, next) {
              if (invalidateEnabled && trs.some((tr) => tr.getMeta(PaginationPluginKey) !== undefined)) {
                pubTxCount += 1;
                if (pubTxCount % 2 === 0) {
                  return next.tr.insertText('!', next.doc.content.size - 1);
                }
              }
              return null;
            },
          }),
        ];
      },
    });

    const editor = new Editor({
      element: host,
      extensions: [
        StarterKit.configure({ trailingNode: false }),
        ManualPageBreak,
        ToggleableAppendExt,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          onLayoutStable: (s) => snapshots.push(s),
        }),
      ],
      content: '<p>Inicio</p><div data-type="page-break"></div><p>Fim</p>',
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    let dynamicShift = 0;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => ({
      top: pos * 10 + dynamicShift,
      bottom: pos * 10 + dynamicShift + 18,
      left: 48,
      right: 700,
    } as DOMRect));

    const origPerform = (controller as any).performLayout.bind(controller);
    (controller as any).performLayout = () => {
      if (invalidateEnabled) dynamicShift += 7;
      return origPerform();
    };

    const p1 = whenLayoutStable(editor);
    const p2 = whenLayoutStable(editor);

    const flushCycles = (max: number) => {
      let count = 0;
      for (let i = 0; i < max; i++) {
        if (!(controller as any).renderTimeout && rafQueue.length === 0) break;
        vi.advanceTimersByTime(150);
        if (rafQueue.length > 0) {
          count += 1;
          rafQueue.shift()!(count * 16);
        }
      }
      return count;
    };

    // 1. Esgota orçamento na primeira tentativa
    expect(flushCycles(6)).toBe(MAX_CONVERGENCE_PASSES);
    expect((controller as any).publicationRecoveryExhausted).toBe(true);
    expect(snapshots).toHaveLength(0);

    // 2. Cessam as invalidações e ocorre edição externa legítima
    invalidateEnabled = false;
    editor.commands.insertContentAt(2, ' editado');

    expect((controller as any).publicationRecoveryExhausted).toBe(false);
    expect((controller as any).publicationInvalidationsInAttempt).toBe(0);
    expect((controller as any).renderTimeout).not.toBeNull();

    // 3. Nova tentativa converge e resolve os 2 listeners pendentes
    expect(flushCycles(4)).toBe(1);
    const [s1, s2] = await Promise.all([p1, p2]);
    expect(s1).toBe(s2);
    expect(s1.revision).toBe(1);
    expect(snapshots).toHaveLength(1);
    expect((controller as any).publicationInvalidationsInAttempt).toBe(0);
    expect((controller as any).publicationRecoveryExhausted).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();

    editor.destroy();
  });

  it('invalidações sucessivas abaixo do limite (2) e recuperação com decorações equivalentes contabilizam revisão sem perda e reinicializam orçamento', async () => {
    vi.useFakeTimers();
    const rafQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const snapshots: LayoutSnapshot[] = [];
    let remainingInvalidations = 2;

    const TwoInvalidationsExt = Extension.create({
      name: 'twoInvalidationsThenStable',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            appendTransaction(trs, _old, next) {
              if (remainingInvalidations > 0 && trs.some((tr) => tr.getMeta(PaginationPluginKey) !== undefined)) {
                remainingInvalidations -= 1;
                return next.tr.insertText('z', next.doc.content.size - 1);
              }
              return null;
            },
          }),
        ];
      },
    });

    const editor = new Editor({
      element: host,
      extensions: [
        StarterKit.configure({ trailingNode: false }),
        ManualPageBreak,
        TwoInvalidationsExt,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          onLayoutStable: (s) => snapshots.push(s),
        }),
      ],
      content: '<p>P1</p><div data-type="page-break"></div><p>P2</p>',
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => ({
      top: pos * 10,
      bottom: pos * 10 + 18,
      left: 48,
      right: 700,
    } as DOMRect));

    const waiter = whenLayoutStable(editor);

    // Ciclo 1: publica -> invalidado (1/3); na rodada 2 as decorações mapeadas já são equivalentes (changed=false) -> estabiliza!
    // Vamos forçar mudança de pageGap após a 1ª invalidação para exercitar 2 invalidações sucessivas e só então equivalência.
    vi.advanceTimersByTime(150);
    rafQueue.shift()!(16); // invalidação 1 (remaining=1)
    expect((controller as any).publicationInvalidationsInAttempt).toBe(1);
    expect(snapshots).toHaveLength(0);

    // Ajusta layout internamente (sem resetar orçamento) para provocar nova publicação no ciclo 2 -> invalidação 2
    (controller as any).layout = { ...baseLayout, page: { ...baseLayout.page, pageGap: 22 } };
    vi.advanceTimersByTime(150);
    rafQueue.shift()!(32); // invalidação 2 (remaining=0)
    expect((controller as any).publicationInvalidationsInAttempt).toBe(2);
    expect(snapshots).toHaveLength(0);

    // Ciclo 3: decorações mapeadas equivalentes (changed=false) -> estabiliza e contabiliza revision=1 sem perder publicação!
    vi.advanceTimersByTime(150);
    rafQueue.shift()!(48);

    const snap = await waiter;
    expect(snap.revision).toBe(1);
    expect(snapshots).toHaveLength(1);
    expect((controller as any).publicationInvalidationsInAttempt).toBe(0);
    expect((controller as any).publicationRecoveryExhausted).toBe(false);
    expect((controller as any).pendingCyclePublishedChanges).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();

    editor.destroy();
  });

  it('destruição durante recuperação agendada interrompe timer e impede qualquer retomada posterior', () => {
    vi.useFakeTimers();
    const rafQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });

    const snapshots: LayoutSnapshot[] = [];
    let shouldInvalidate = true;

    const InvalidateOnceExt = Extension.create({
      name: 'invalidateOnceBeforeDestroy',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            appendTransaction(trs, _old, next) {
              if (shouldInvalidate && trs.some((tr) => tr.getMeta(PaginationPluginKey) !== undefined)) {
                shouldInvalidate = false;
                return next.tr.insertText('!', next.doc.content.size - 1);
              }
              return null;
            },
          }),
        ];
      },
    });

    const editor = new Editor({
      element: host,
      extensions: [
        StarterKit.configure({ trailingNode: false }),
        ManualPageBreak,
        InvalidateOnceExt,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
          onLayoutStable: (s) => snapshots.push(s),
        }),
      ],
      content: '<p>A</p><div data-type="page-break"></div><p>B</p>',
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => ({
      top: pos * 10,
      bottom: pos * 10 + 18,
      left: 48,
      right: 700,
    } as DOMRect));

    // Dispara ciclo 1 -> invalidado -> reagenda timer de recuperação
    vi.advanceTimersByTime(150);
    rafQueue.shift()!(16);
    expect((controller as any).publicationInvalidationsInAttempt).toBe(1);
    expect((controller as any).renderTimeout).not.toBeNull();

    // Destrói durante a recuperação pendente
    editor.destroy();
    expect((controller as any).renderTimeout).toBeNull();

    // Tentativas externas pós-destroy não devem reagendar nem executar
    controller.notifyExternalDocumentChange();
    controller.setLayout(baseLayout);
    vi.advanceTimersByTime(500);
    expect(rafQueue).toHaveLength(0);
    expect(snapshots).toHaveLength(0);
  });

  it('preserva guarda negativa (Resultado C) quando filterTransaction rejeita explicitamente a transação de publicação', () => {
    const RejectPublishExt = Extension.create({
      name: 'rejectPaginationPublication',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            filterTransaction(tr) {
              if (tr.getMeta(PaginationPluginKey) !== undefined) {
                return false;
              }
              return true;
            },
          }),
        ];
      },
    });

    const editor = new Editor({
      element: host,
      extensions: [
        StarterKit.configure({ trailingNode: false }),
        ManualPageBreak,
        RejectPublishExt,
        PaginationExtension.configure({
          layout: baseLayout,
          visualMode: 'composed',
        }),
      ],
      content: '<p>Bloco 1</p><div data-type="page-break"></div><p>Bloco 2</p>',
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => ({
      top: pos * 10,
      bottom: pos * 10 + 18,
      left: 48,
      right: 700,
    } as DOMRect));

    expect(() => {
      (controller as any).performLayout();
    }).toThrowError(/published decorations were not effectively installed on view\.state/);

    editor.destroy();
  });
});

