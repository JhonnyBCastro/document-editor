import type { Editor } from "@tiptap/core";
import {
  PaginationExtension,
  PaginationPluginKey,
  preparePrintSession,
  whenLayoutStable,
  type BreakCandidate,
  type BreakDecision,
  type LayoutConfig,
  type LayoutDiagnostic,
  type LayoutSnapshot,
  type PageProjection,
  type PaginationOptions,
  type PaginationVisualMode,
  type PrintSession,
} from "@jhonny_bcastro/document-editor";
import {
  createDocumentPresentation,
  type DeepReadonly,
  type Disposer,
  type DocumentPresentation,
  type DocumentPresentationOptions,
  type RunningContentContext,
} from "@jhonny_bcastro/document-editor/presentation";
import {
  createDocumentEditor,
  type DocumentEditorCleanupReport,
  type DocumentEditorCleanupResourceResult,
  type DocumentEditorFailure,
  type DocumentEditorIncident,
  type DocumentEditorInstance,
  type DocumentEditorOperation,
  type DocumentEditorOptions,
  type DocumentEditorPageLayoutOptions,
  type DocumentEditorPhase,
  type DocumentEditorResourceRef,
} from "@jhonny_bcastro/document-editor/compose";

const host = document.createElement("div");

// 1. Subpath '.' (Core)
const mode: PaginationVisualMode = "composed";
const coreExtension = PaginationExtension.configure({ visualMode: mode });
const pluginKeyRef = PaginationPluginKey;
async function checkCoreAsync(editor: Editor): Promise<[LayoutSnapshot, PrintSession]> {
  const snap: LayoutSnapshot = await whenLayoutStable(editor);
  const printSession: PrintSession = await preparePrintSession(editor);
  return [snap, printSession];
}
type _CoreTypesCheck = [
  LayoutConfig,
  BreakCandidate,
  BreakDecision,
  LayoutDiagnostic,
  PageProjection,
  PaginationOptions,
];

// 2. Subpath './presentation'
const presentationOptions: DocumentPresentationOptions = {
  renderHeader(context: RunningContentContext, mountPoint: HTMLElement): void | Disposer {
    mountPoint.textContent = `Page ${context.pageIndex + 1} / ${context.totalPages}`;
    const readonlyRect: DeepReadonly<PageProjection["headerRect"]> = context.rect;
    void readonlyRect;
    return () => {
      mountPoint.textContent = "";
    };
  },
};
const presentation: DocumentPresentation = createDocumentPresentation(host, presentationOptions);
presentation.clear();
presentation.destroy();

// 3. Subpath './compose'
const pageLayout: DocumentEditorPageLayoutOptions = { pageGap: 24 };
const options: DocumentEditorOptions = {
  host,
  layout: { page: pageLayout },
  onError(incident: DocumentEditorIncident) {
    const op: DocumentEditorOperation = incident.operation;
    const primary: DocumentEditorFailure = incident.primary;
    const phase: DocumentEditorPhase = primary.phase;
    const cleanup: DocumentEditorCleanupReport = incident.cleanup;
    const resources: readonly DocumentEditorCleanupResourceResult[] = cleanup.resources;
    const ref: DocumentEditorResourceRef | undefined = resources[0]?.resource;
    console.log(op, phase, ref);
  },
};
const instance: DocumentEditorInstance = createDocumentEditor(options);
instance.destroy();

void coreExtension;
void pluginKeyRef;
void checkCoreAsync;
type _KeepCoreTypes = _CoreTypesCheck;
export type { _KeepCoreTypes };
