import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor, Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Plugin } from '@tiptap/pm/state';
import { createDocumentEditor, type DocumentEditorIncident } from '../../src/compose/index';
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

const SimpleTableNode = Node.create({
  name: 'table',
  group: 'block',
  content: 'paragraph+',
  parseHTML() {
    return [{ tag: 'table' }];
  },
  renderHTML() {
    return ['table', 0];
  },
});

const ManualPageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }];
  },
  renderHTML() {
    return ['div', { 'data-type': 'page-break' }];
  },
});

describe('T1-R1 Regression Suite — T1-FIND-01, T1-FIND-02 e T1-FIND-03', () => {
  let host: HTMLElement;
  let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    originalGetBCR = window.Element.prototype.getBoundingClientRect;
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
    window.Element.prototype.getBoundingClientRect = originalGetBCR;
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  });

  describe('1. Compose — Lifecycle e rollback (T1-FIND-01)', () => {
    it('falha anterior à aquisição da view preserva causa primária, classifica editor como unconfirmed e conclui teardown independente', () => {
      const incidents: DocumentEditorIncident[] = [];
      const primaryErr = new Error('t1-r1-pre-mount-crash');
      const CrashingNode = Node.create({
        name: 'crashingPreMountNode',
        group: 'block',
        atom: true,
        renderHTML() {
          throw primaryErr;
        },
      });

      expect(() => {
        createDocumentEditor({
          host,
          extensions: [StarterKit, CrashingNode],
          content: { type: 'doc', content: [{ type: 'crashingPreMountNode' }] },
          onError(inc) {
            incidents.push(inc);
          },
        });
      }).toThrow(primaryErr);

      expect(incidents).toHaveLength(1);
      expect(incidents[0].operation).toBe('initialization');
      expect(incidents[0].primary.error).toBe(primaryErr);
      expect(incidents[0].cleanup.status).toBe('unconfirmed');

      const editorRes = incidents[0].cleanup.resources.find((r) => r.resource.kind === 'editor');
      const presRes = incidents[0].cleanup.resources.find((r) => r.resource.kind === 'presentation');
      const wrapperRes = incidents[0].cleanup.resources.find((r) => r.resource.kind === 'wrapper');
      expect(editorRes?.status).toBe('unconfirmed');
      expect(presRes?.status).toBe('released');
      expect(wrapperRes?.status).toBe('released');
      expect(incidents[0].cleanup.limitations[0]).toContain('Editor view was not assigned');
      expect(host.children).toHaveLength(0);
    });

    it('aquisição efetiva confirmada permite destroy limpo, idempotente e sem incidentes', () => {
      const incidents: DocumentEditorIncident[] = [];
      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: '<p>Aquisição normal confirmada</p>',
        onError(inc) {
          incidents.push(inc);
        },
      });

      expect(instance.editor.view.dom).toBeInstanceOf(HTMLElement);
      instance.destroy();
      instance.destroy(); // idempotência
      expect(instance.editor.isDestroyed).toBe(true);
      expect(host.children).toHaveLength(0);
      expect(incidents).toHaveLength(0);
    });

    it('falha posterior à aquisição em view.destroy registra falha secundária e preserva teardown independente', () => {
      const incidents: DocumentEditorIncident[] = [];
      const destroyErr = new Error('t1-r1-post-mount-destroy-fail');
      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: '<p>Falha após aquisição</p>',
        onError(inc) {
          incidents.push(inc);
        },
      });

      instance.editor.view.destroy = () => {
        throw destroyErr;
      };

      instance.destroy();
      instance.destroy(); // idempotência após falha

      expect(incidents).toHaveLength(1);
      expect(incidents[0].operation).toBe('destroy');
      expect(incidents[0].primary.error).toBe(destroyErr);
      expect(incidents[0].cleanup.status).toBe('incomplete');
      const editorRes = incidents[0].cleanup.resources.find((r) => r.resource.kind === 'editor');
      const presRes = incidents[0].cleanup.resources.find((r) => r.resource.kind === 'presentation');
      const wrapperRes = incidents[0].cleanup.resources.find((r) => r.resource.kind === 'wrapper');
      expect(editorRes?.status).toBe('failed');
      expect(presRes?.status).toBe('released');
      expect(wrapperRes?.status).toBe('released');
      expect(host.children).toHaveLength(0);
    });
  });

  describe('2. Compose — Autofocus (T1-FIND-02)', () => {
    it('omissão de autofocus normaliza para false sem foco nem scrollIntoView involuntários', async () => {
      const sentinel = document.createElement('input');
      document.body.appendChild(sentinel);
      sentinel.focus();

      const rafCallbacks: FrameRequestCallback[] = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: '<p>Sem autofocus explícito</p>',
      });

      expect(instance.editor.options.autofocus).toBe(false);
      const focusCmdSpy = vi.spyOn(instance.editor.commands, 'focus');
      const scrollCmdSpy = vi.spyOn(instance.editor.commands, 'scrollIntoView');

      await new Promise((r) => setTimeout(r, 20));
      while (rafCallbacks.length > 0) {
        const cb = rafCallbacks.shift()!;
        cb(0);
      }

      expect(focusCmdSpy).not.toHaveBeenCalled();
      expect(scrollCmdSpy).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(sentinel);

      instance.destroy();
      sentinel.remove();
    });

    it('preserva fielmente todos os valores explícitos admitidos de autofocus (false, null, true, 0, 1, start, end, all)', () => {
      const explicitValues: Array<boolean | number | 'start' | 'end' | 'all' | null> = [
        false,
        null,
        true,
        0,
        1,
        'start',
        'end',
        'all',
      ];

      for (const val of explicitValues) {
        const h = document.createElement('div');
        document.body.appendChild(h);
        const instance = createDocumentEditor({
          host: h,
          extensions: [StarterKit],
          content: '<p>Valor explícito de autofocus</p>',
          autofocus: val,
        });
        expect(instance.editor.options.autofocus).toBe(val);
        instance.destroy();
        h.remove();
      }
    });
  });

  describe('3. Core — Protocolo de publicação e T1-FIND-03', () => {
    it('documento terminado em tabela com TrailingNode ativo recupera sem erro de console, sem snapshot obsoleto e sem resolução prematura', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const snapshots: LayoutSnapshot[] = [];

      const editor = new Editor({
        element: host,
        extensions: [
          StarterKit,
          SimpleTableNode,
          ManualPageBreak,
          PaginationExtension.configure({
            layout: baseLayout,
            visualMode: 'composed',
            onLayoutStable: (s) => snapshots.push(s),
          }),
        ],
        content: '<p>Introdução</p><div data-type="page-break"></div><table><p>Celula</p></table>',
      });

      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => ({
        top: pos * 10,
        bottom: pos * 10 + 18,
        left: 48,
        right: 700,
      } as DOMRect));

      expect(editor.state.doc.lastChild?.type.name).toBe('table');

      const finalSnapshot = await whenLayoutStable(editor);

      expect(editor.state.doc.lastChild?.type.name).toBe('paragraph');
      expect(errorSpy).not.toHaveBeenCalled();
      expect(snapshots.length).toBe(1);
      expect(snapshots[0]).toBe(finalSnapshot);
      expect(finalSnapshot.revision).toBe(1);
      expect(finalSnapshot.breaks.length).toBeGreaterThanOrEqual(1);

      editor.destroy();
    });

    it('mudança estrutural determinística por appendTransaction abandona rodada invalidada, preserva pendingCyclePublishedChanges e converge na rodada seguinte', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const snapshots: LayoutSnapshot[] = [];
      let shouldAppendOnce = true;

      const DeterministicAppendExt = Extension.create({
        name: 'deterministicAppendOnce',
        addProseMirrorPlugins() {
          return [
            new Plugin({
              appendTransaction(transactions, _oldState, newState) {
                if (
                  shouldAppendOnce &&
                  transactions.some((tr) => tr.getMeta(PaginationPluginKey) !== undefined)
                ) {
                  shouldAppendOnce = false;
                  return newState.tr.insertText(' [appended]', newState.doc.content.size - 1);
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
          DeterministicAppendExt,
          PaginationExtension.configure({
            layout: baseLayout,
            visualMode: 'composed',
            onLayoutStable: (s) => snapshots.push(s),
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

      // Cancel initial scheduled render so we drive deterministically
      if ((controller as any).renderTimeout) {
        clearTimeout((controller as any).renderTimeout);
        (controller as any).renderTimeout = null;
      }

      const waiter = whenLayoutStable(editor);
      // Clear timer set by whenLayoutStable and execute first performLayout directly
      if ((controller as any).renderTimeout) {
        clearTimeout((controller as any).renderTimeout);
        (controller as any).renderTimeout = null;
      }

      const scheduleSpy = vi.spyOn(controller, 'scheduleRender');
      (controller as any).performLayout();

      // Rodada 1 foi invalidada por appendTransaction:
      expect(errorSpy).not.toHaveBeenCalled();
      expect(shouldAppendOnce).toBe(false);
      expect(editor.state.doc.textContent).toContain('[appended]');
      expect(snapshots).toHaveLength(0);
      expect((controller as any).revision).toBe(0);
      expect((controller as any).pendingCyclePublishedChanges).toBe(true);
      expect(scheduleSpy).toHaveBeenCalledTimes(1);

      // Listener não resolveu prematuramente
      const stillPending = await Promise.race([
        waiter.then(() => 'resolved'),
        new Promise<'pending'>((r) => setTimeout(() => r('pending'), 25)),
      ]);
      expect(stillPending).toBe('pending');

      // Rodada reagendada converge sobre o documento instalado e contabiliza revisão = 1
      const resolvedSnapshot = await waiter;
      expect(resolvedSnapshot.revision).toBe(1);
      expect(snapshots).toHaveLength(1);
      expect(errorSpy).not.toHaveBeenCalled();

      editor.destroy();
    });

    it('invalidações repetidas respeitam limite MAX_CONVERGENCE_PASSES sem loop infinito e sem emitir snapshot obsoleto', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const snapshots: LayoutSnapshot[] = [];
      let appendCount = 0;

      const InfiniteAppendExt = Extension.create({
        name: 'infiniteAppendOnPublish',
        addProseMirrorPlugins() {
          return [
            new Plugin({
              appendTransaction(transactions, _oldState, newState) {
                if (transactions.some((tr) => tr.getMeta(PaginationPluginKey) !== undefined)) {
                  appendCount += 1;
                  return newState.tr.insertText(`x`, newState.doc.content.size - 1);
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
          InfiniteAppendExt,
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

      if ((controller as any).renderTimeout) {
        clearTimeout((controller as any).renderTimeout);
        (controller as any).renderTimeout = null;
      }

      const scheduleSpy = vi.spyOn(controller, 'scheduleRender').mockImplementation(() => {});

      for (let i = 0; i < MAX_CONVERGENCE_PASSES; i++) {
        // Simula nova divergência de quebras a cada tentativa para forçar publicação
        (controller as any).performLayout();
        // Altera layout pageGap ligeiramente para garantir changed=true na próxima tentativa
        (controller as any).layout = {
          ...baseLayout,
          page: { ...baseLayout.page, pageGap: 20 + i + 1 },
        };
      }

      expect(appendCount).toBe(MAX_CONVERGENCE_PASSES);
      // Somente MAX_CONVERGENCE_PASSES - 1 reagendamentos permitidos; na tentativa limite para de reagendar
      expect(scheduleSpy).toHaveBeenCalledTimes(MAX_CONVERGENCE_PASSES - 1);
      expect(snapshots).toHaveLength(0);
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(LAYOUT_CONVERGENCE_LIMIT_CODE));

      editor.destroy();
    });

    it('preserva guarda negativa (Resultado C) quando dispatch descarta a transação de publicação sem processá-la', () => {
      const editor = new Editor({
        element: host,
        extensions: [
          StarterKit.configure({ trailingNode: false }),
          ManualPageBreak,
          PaginationExtension.configure({ layout: baseLayout, visualMode: 'composed' }),
        ],
        content: '<p>Guarda negativa</p><div data-type="page-break"></div><p>Fim</p>',
      });

      const controller = editor.storage.pagination.controller as PaginationController;
      vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => ({
        top: pos * 10,
        bottom: pos * 10 + 18,
        left: 48,
        right: 700,
      } as DOMRect));

      editor.view.setProps({
        dispatchTransaction: () => {
          // Aplica outra transação alterando o documento SEM processar a transação de publicação
          const otherState = editor.view.state.apply(editor.view.state.tr.insertText('hijack', 1));
          editor.view.updateState(otherState);
        },
      });

      expect(() => {
        (controller as any).performLayout();
      }).toThrowError(/published decorations were not effectively installed on view\.state/);

      editor.destroy();
    });
  });
});
