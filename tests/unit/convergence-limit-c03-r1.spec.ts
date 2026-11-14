import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  PaginationExtension,
  whenLayoutStable,
  type LayoutConfig,
  type LayoutSnapshot,
} from '../../src/index';
import {
  PaginationController,
  LAYOUT_CONVERGENCE_LIMIT_CODE,
  MAX_CONVERGENCE_PASSES,
} from '../../src/controller';

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

function createLongTextDoc(): string {
  return `<p>${'Palavra '.repeat(60)}</p>`;
}

describe('C-03/R1 — Semântica de convergência, diagnóstico explícito e revisão observável', () => {
  let container: HTMLElement;
  let editor: Editor | null = null;
  let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    originalGetBCR = window.Element.prototype.getBoundingClientRect;
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
    window.Element.prototype.getBoundingClientRect = originalGetBCR;
    editor?.destroy();
    editor = null;
    container.remove();
    vi.restoreAllMocks();
  });

  it('Cenário A: convergência normal multi-passe emite snapshot único sem LAYOUT_CONVERGENCE_LIMIT e incrementa revision uma única vez por ciclo', async () => {
    const snapshots: LayoutSnapshot[] = [];

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
      content: createLongTextDoc(),
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    // Aguarda ciclo inicial do construtor concluir
    const initialSnap = await whenLayoutStable(editor);
    const revBeforeCycle = initialSnap.revision;
    const countBeforeCycle = snapshots.length;

    let passInCycle = 0;
    const origPerformLayout = (controller as any).performLayout.bind(controller);
    vi.spyOn(controller as any, 'performLayout').mockImplementation(() => {
      passInCycle += 1;
      return origPerformLayout();
    });

    // Passe 1 -> quebra em ~180 (changed=true); Passe 2 -> desloca para ~120 (changed=true);
    // Passe 3 -> mantém ~120 (changed=false, converge dentro de maxPasses=3).
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      const breakThreshold = passInCycle === 1 ? 180 : 120;
      const top = pos >= breakThreshold ? 3000 : 100 + pos * 2;
      return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
    });

    const waitPromise = whenLayoutStable(editor);
    controller.scheduleRender();
    const cycleSnap = await waitPromise;

    expect(passInCycle).toBe(3);
    expect(snapshots.length - countBeforeCycle).toBe(1);
    expect(cycleSnap.revision).toBe(revBeforeCycle + 1);
    expect(cycleSnap.diagnostics.some((d) => d.code === LAYOUT_CONVERGENCE_LIMIT_CODE)).toBe(false);
    expect(
      (controller as any)[Symbol.for('@jhonny_bcastro/document-editor/convergence-state')]
    ).toEqual({ converged: true, aborted: false, passes: 3 });

    // Novo ciclo ocioso sem alteração de breaks/decorations: revision permanece inalterada (+0)
    const waitIdle = whenLayoutStable(editor);
    controller.scheduleRender();
    const idleSnap = await waitIdle;
    expect(idleSnap.revision).toBe(cycleSnap.revision);
    expect(idleSnap.diagnostics.some((d) => d.code === LAYOUT_CONVERGENCE_LIMIT_CODE)).toBe(false);
  });

  it('Cenário B e C: se o último passe ainda altera decorações, emite LAYOUT_CONVERGENCE_LIMIT sem travar callbacks/whenLayoutStable, incrementa revision 1x no ciclo e limpa em ciclo convergido posterior', async () => {
    const snapshots: LayoutSnapshot[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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
      content: createLongTextDoc(),
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    const initialSnap = await whenLayoutStable(editor);
    const revBeforeCycle = initialSnap.revision;
    const countBeforeCycle = snapshots.length;

    let passCounter = 0;
    const origPerformLayout = (controller as any).performLayout.bind(controller);
    vi.spyOn(controller as any, 'performLayout').mockImplementation(() => {
      passCounter += 1;
      return origPerformLayout();
    });

    // Passes 1, 2 e 3 produzem thresholds distintos (210 -> 160 -> 110), forçando changed=true no 3º passe;
    // Passes >= 4 mantêm threshold fixo em 110, permitindo convergência em ciclo subsequente.
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      const thresholds = [210, 160, 110];
      const threshold = passCounter <= 3 ? thresholds[passCounter - 1] : 110;
      const top = pos >= threshold ? 3000 : 100 + pos * 2;
      return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
    });

    const waitNonConverged = whenLayoutStable(editor);
    controller.scheduleRender();
    const nonConvergedSnap = await waitNonConverged;

    // Executou exatamente MAX_CONVERGENCE_PASSES passes e NÃO considerou convergido
    expect(passCounter).toBe(MAX_CONVERGENCE_PASSES);
    expect(
      (controller as any)[Symbol.for('@jhonny_bcastro/document-editor/convergence-state')]
    ).toEqual({ converged: false, aborted: false, passes: MAX_CONVERGENCE_PASSES });

    // Contratos públicos disparados normalmente (sem travar), snapshot coerente com diagnóstico explícito
    expect(snapshots.length - countBeforeCycle).toBe(1);
    expect(nonConvergedSnap.pages.length).toBeGreaterThanOrEqual(2);
    expect(nonConvergedSnap.breaks.length).toBeGreaterThanOrEqual(1);
    expect(
      nonConvergedSnap.diagnostics.some((d) => d.code === LAYOUT_CONVERGENCE_LIMIT_CODE)
    ).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(LAYOUT_CONVERGENCE_LIMIT_CODE)
    );

    // Revision conta ciclo observável (+1), NÃO os 3 passes internos (+3)
    expect(nonConvergedSnap.revision).toBe(revBeforeCycle + 1);

    // Ciclo posterior agora converge (threshold estabilizado em 210 -> changed=false)
    const waitRecovered = whenLayoutStable(editor);
    controller.scheduleRender();
    const recoveredSnap = await waitRecovered;

    expect(
      (controller as any)[Symbol.for('@jhonny_bcastro/document-editor/convergence-state')]
    ).toEqual({ converged: true, aborted: false, passes: 1 });
    expect(
      recoveredSnap.diagnostics.some((d) => d.code === LAYOUT_CONVERGENCE_LIMIT_CODE)
    ).toBe(false);
    expect(recoveredSnap.revision).toBe(nonConvergedSnap.revision);
  });

  it('Cenário D (decisivo): passe 1 instala mudança estrutural e passe 2 aborta por reentrância — não declara convergência, preserva contabilização pendente e conclui ciclo posterior com revision coerente sem duplicação', async () => {
    const snapshots: LayoutSnapshot[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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
      content: createLongTextDoc(),
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    const initialSnap = await whenLayoutStable(editor);
    const revBeforeAbortCycle = initialSnap.revision;
    const snapshotsBeforeAbort = snapshots.length;

    let cyclePass = 0;
    let mutateDocOnPass = false;
    const origPerformLayout = (controller as any).performLayout.bind(controller);
    vi.spyOn(controller as any, 'performLayout').mockImplementation(() => {
      cyclePass += 1;
      return origPerformLayout();
    });

    let activeThreshold = 180;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (cyclePass === 2 && mutateDocOnPass && pos >= 50) {
        // Mutação documental mid-layout dispara guarda de reentrância (view.state.doc !== initialDoc)
        mutateDocOnPass = false;
        editor!.view.dispatch(editor!.state.tr.insertText(' ', 1));
      }
      const threshold = cyclePass === 1 ? 180 : activeThreshold;
      const top = pos >= threshold ? 3000 : 100 + pos * 2;
      return { top, right: 500, bottom: top + 16, left: 96 } as DOMRect;
    });

    // Inicia ciclo de forma síncrona suprimindo reagendamento colateral da própria mutação reentrante:
    // Passe 1 instala quebra em ~180 (changed=true); Passe 2 sofre aborto por reentrância.
    const schedSpy = vi.spyOn(controller, 'scheduleRender').mockImplementation(() => {});
    mutateDocOnPass = true;
    activeThreshold = 120;
    const abortedWaiter = whenLayoutStable(editor);
    (controller as any).renderVirtualPages();
    await new Promise((r) => setTimeout(r, 40));

    expect(cyclePass).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Abortando publicação reentrante')
    );
    expect(
      (controller as any)[Symbol.for('@jhonny_bcastro/document-editor/convergence-state')]
    ).toEqual({ converged: false, aborted: true, passes: 2 });

    // Waiters e onLayoutStable NÃO devem ter sido disparados no aborto
    expect(snapshots.length).toBe(snapshotsBeforeAbort);
    const raceResult = await Promise.race([
      abortedWaiter.then(() => 'resolved'),
      new Promise<'pending'>((r) => setTimeout(() => r('pending'), 40)),
    ]);
    expect(raceResult).toBe('pending');
    // Mudança estrutural instalada no Passe 1 continua registrada para contabilização
    expect((controller as any).pendingCyclePublishedChanges).toBe(true);

    // Ciclo posterior agora conclui normalmente mantendo threshold=180 (changed=false no Passe 3!)
    schedSpy.mockRestore();
    activeThreshold = 180;
    controller.scheduleRender();
    const settledSnap = await abortedWaiter;

    expect(snapshots.length - snapshotsBeforeAbort).toBe(1);
    expect(settledSnap.revision).toBe(revBeforeAbortCycle + 1);
    expect(settledSnap.breaks.length).toBeGreaterThanOrEqual(1);
    expect(
      (controller as any)[Symbol.for('@jhonny_bcastro/document-editor/convergence-state')]
    ).toMatchObject({ converged: true, aborted: false });

    // Ciclo ocioso posterior não duplica revision
    const waitIdle = whenLayoutStable(editor);
    controller.scheduleRender();
    const idleSnap = await waitIdle;
    expect(idleSnap.revision).toBe(settledSnap.revision);
  });

  it('Cenário E e F: aborto sem mudança prévia não altera revision nem força resolução, e getLastConvergenceState() está ausente da API pública em runtime', async () => {
    const snapshots: LayoutSnapshot[] = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});

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
      content: createLongTextDoc(),
    });

    const controller = editor.storage.pagination.controller as PaginationController;
    expect('getLastConvergenceState' in (controller as any)).toBe(false);

    const initialSnap = await whenLayoutStable(editor);
    const revBefore = initialSnap.revision;
    const countBefore = snapshots.length;

    let triggerInitialAbort = true;
    vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
      if (triggerInitialAbort && pos >= 20) {
        triggerInitialAbort = false;
        editor!.view.dispatch(editor!.state.tr.insertText('x', 1));
      }
      return { top: 100, right: 500, bottom: 116, left: 96 } as DOMRect;
    });

    const schedSpy = vi.spyOn(controller, 'scheduleRender').mockImplementation(() => {});
    const pWaiter = whenLayoutStable(editor);
    (controller as any).renderVirtualPages();
    await new Promise((r) => setTimeout(r, 40));

    expect(
      (controller as any)[Symbol.for('@jhonny_bcastro/document-editor/convergence-state')]
    ).toEqual({ converged: false, aborted: true, passes: 1 });
    expect(snapshots.length).toBe(countBefore);
    expect((controller as any).pendingCyclePublishedChanges).toBe(false);

    const raceStatus = await Promise.race([
      pWaiter.then(() => 'resolved'),
      new Promise<'pending'>((r) => setTimeout(() => r('pending'), 40)),
    ]);
    expect(raceStatus).toBe('pending');

    schedSpy.mockRestore();
    controller.scheduleRender();
    const settled = await pWaiter;
    expect(settled.revision).toBe(revBefore);
    expect(
      (controller as any)[Symbol.for('@jhonny_bcastro/document-editor/convergence-state')]
    ).toEqual({ converged: true, aborted: false, passes: 1 });
  });
});
