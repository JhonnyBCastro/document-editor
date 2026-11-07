import { Editor } from "@tiptap/core";
import { PaginationExtension } from "../extension";
import { createDocumentPresentation, type DocumentPresentation, type RunningContentContext, type Disposer } from "../presentation";
import type { LayoutSnapshot } from "../types";
import type {
  DocumentEditorOptions,
  DocumentEditorInstance,
  DocumentEditorIncident,
  DocumentEditorOperation,
  DocumentEditorPhase,
  DocumentEditorResourceRef,
  DocumentEditorFailure,
  DocumentEditorCleanupReport,
  DocumentEditorCleanupResourceResult,
  DocumentEditorPageLayoutOptions,
} from "./types";

export * from "./types";

const ALLOWED_ROOT_KEYS = new Set([
  "host",
  "content",
  "extensions",
  "editable",
  "autofocus",
  "parseOptions",
  "layout",
  "renderHeader",
  "renderFooter",
  "onLayoutStable",
  "onError",
]);

const ALLOWED_LAYOUT_KEYS = new Set(["page"]);

const ALLOWED_PAGE_KEYS = new Set([
  "width",
  "height",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "pageGap",
]);

const DEFAULT_PAGE: Required<DocumentEditorPageLayoutOptions> = {
  width: 816,
  height: 1056,
  marginTop: 96,
  marginRight: 96,
  marginBottom: 96,
  marginLeft: 96,
  pageGap: 20,
};

function validateAndNormalizeOptions(options: DocumentEditorOptions): {
  host: HTMLElement;
  page: Required<DocumentEditorPageLayoutOptions>;
} {
  if (!options || typeof options !== "object") {
    throw new TypeError("Options must be an object.");
  }

  // Allowlist validation at root
  for (const key of Object.keys(options)) {
    if (!ALLOWED_ROOT_KEYS.has(key)) {
      throw new TypeError(`Unknown option: "${key}" is not permitted.`);
    }
  }

  // Host validation
  if (!options.host || typeof options.host !== "object" || (options.host as any).nodeType !== 1) {
    throw new TypeError('Option "host" must be an HTMLElement.');
  }

  // Layout validation
  if (options.layout !== undefined) {
    if (!options.layout || typeof options.layout !== "object" || Array.isArray(options.layout)) {
      throw new TypeError('Option "layout" must be an object.');
    }
    for (const key of Object.keys(options.layout)) {
      if (!ALLOWED_LAYOUT_KEYS.has(key)) {
        throw new TypeError(`Unknown layout property: "${key}" is not permitted.`);
      }
    }
  }

  const pageInput = options.layout?.page;
  if (pageInput !== undefined) {
    if (!pageInput || typeof pageInput !== "object" || Array.isArray(pageInput)) {
      throw new TypeError('Option "layout.page" must be an object.');
    }
    for (const key of Object.keys(pageInput)) {
      if (!ALLOWED_PAGE_KEYS.has(key)) {
        throw new TypeError(`Unknown layout.page property: "${key}" is not permitted.`);
      }
    }
  }

  // Validate properties individually
  function validateNum(
    val: unknown,
    name: string,
    defaultVal: number,
    allowZero: boolean
  ): number {
    if (val === undefined) return defaultVal;
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new TypeError(`Property "${name}" must be a finite number.`);
    }
    if (allowZero) {
      if (val < 0) {
        throw new TypeError(`Property "${name}" must be non-negative.`);
      }
    } else {
      if (val <= 0) {
        throw new TypeError(`Property "${name}" must be strictly positive.`);
      }
    }
    return val;
  }

  const width = validateNum(pageInput?.width, "width", DEFAULT_PAGE.width, false);
  const height = validateNum(pageInput?.height, "height", DEFAULT_PAGE.height, false);
  const marginTop = validateNum(pageInput?.marginTop, "marginTop", DEFAULT_PAGE.marginTop, true);
  const marginRight = validateNum(pageInput?.marginRight, "marginRight", DEFAULT_PAGE.marginRight, true);
  const marginBottom = validateNum(pageInput?.marginBottom, "marginBottom", DEFAULT_PAGE.marginBottom, true);
  const marginLeft = validateNum(pageInput?.marginLeft, "marginLeft", DEFAULT_PAGE.marginLeft, true);
  const pageGap = validateNum(pageInput?.pageGap, "pageGap", DEFAULT_PAGE.pageGap, true);

  // Validate derived dimensions and reject non-finite results (overflow)
  const pageStride = height + pageGap;
  if (!Number.isFinite(pageStride)) {
    throw new TypeError("Derived page stride (height + pageGap) must be a finite number.");
  }

  const usefulWidth = width - marginLeft - marginRight;
  if (!Number.isFinite(usefulWidth) || usefulWidth <= 0) {
    throw new TypeError(`Useful width (width - marginLeft - marginRight) must be strictly positive and finite. Got ${usefulWidth}.`);
  }

  const usefulHeight = height - marginTop - marginBottom;
  if (!Number.isFinite(usefulHeight) || usefulHeight <= 0) {
    throw new TypeError(`Useful height (height - marginTop - marginBottom) must be strictly positive and finite. Got ${usefulHeight}.`);
  }

  // Static pagination duplicate check in options.extensions
  if (Array.isArray(options.extensions)) {
    for (const ext of options.extensions) {
      if (ext && typeof ext === "object" && (ext as any).name === "pagination") {
        throw new Error("PaginationExtension is already provided by the composition layer.");
      }
    }
  }

  return {
    host: options.host,
    page: {
      width,
      height,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      pageGap,
    },
  };
}

export function createDocumentEditor(options: DocumentEditorOptions): DocumentEditorInstance {
  // 1. Static validation prior to any allocation or DOM mutation
  const { host, page: pageConfig } = validateAndNormalizeOptions(options);

  // Logical terminality vs physical finalization separation
  let isTerminal = false;
  let forwardingsBlocked = false;
  let activeOperationDepth = 0;
  let pendingCleanup = false;
  let pendingDestroyOrigin: "instance" | "editor" | "initialization" | "render" = "instance";
  let pendingHasPrimaryCause = false;
  let pendingPrimaryCause: unknown = undefined;
  let pendingPrimaryPhase: DocumentEditorPhase | undefined = undefined;
  let pendingPrimaryResource: DocumentEditorResourceRef | undefined = undefined;

  let destroyRequestedInsideOnError = false;
  let physicalTeardownStarted = false;
  let physicalTeardownCompleted = false;
  let isCoordinatingDestroy = false;
  let isInsideOnError = false;
  let cachedCleanupReport: DocumentEditorCleanupReport | null = null;

  // Cleanup tracking flags for resources
  let nativeDestroyAttempted = false;
  let presentationDestroyAttempted = false;
  let wrapperDestroyAttempted = false;

  // Detailed capture facts recorded separately (never deduced by failure timing or phase)
  const captureFacts = {
    callbackReached: false,
    editorCaptured: false,
    originalMethodCaptured: false,
    interceptInstalled: false,
    viewAssigned: false,
  };

  let capturedEditor: Editor | null = null;
  let originalEditorDestroy: (() => void) | null = null;
  let presentation: DocumentPresentation | null = null;
  let wrapper: HTMLElement | null = null;
  let editorMount: HTMLElement | null = null;

  // Tracked Disposers
  interface TrackedDisposer {
    id: number;
    region: "header" | "footer";
    disposer: Disposer;
    attempted: boolean;
    status?: "released" | "failed";
    error?: unknown;
  }

  interface TrackedFailureOccurrence {
    id: number;
    error: unknown;
    phase: DocumentEditorPhase;
    resource?: DocumentEditorResourceRef;
  }

  let disposerSeq = 0;
  let failureSeq = 0;
  const activeDisposers: TrackedDisposer[] = [];
  const secondaryOccurrences: TrackedFailureOccurrence[] = [];

  function recordSecondaryFailure(
    phase: DocumentEditorPhase,
    error: unknown,
    resource?: DocumentEditorResourceRef
  ): TrackedFailureOccurrence {
    const occ: TrackedFailureOccurrence = {
      id: ++failureSeq,
      error,
      phase,
      resource,
    };
    secondaryOccurrences.push(occ);
    return occ;
  }

  // Intercept disposer failures occurring during replacement render
  let hasCausativeDisposerOccurrence = false;
  let firstCausativeDisposerOccurrence: TrackedFailureOccurrence | null = null;
  let runningContentRenderError: { error: unknown; region: "header" | "footer" } | null = null;

  // Disposer proxy wrappers
  const wrappedRenderHeader = options.renderHeader
    ? (context: RunningContentContext, mountPoint: HTMLElement): void | Disposer => {
        if (forwardingsBlocked || isTerminal) return;
        let result: void | Disposer;
        try {
          result = options.renderHeader!(context, mountPoint);
        } catch (renderErr) {
          runningContentRenderError = { error: renderErr, region: "header" };
          throw renderErr;
        }

        if (typeof result === "function") {
          const entry: TrackedDisposer = {
            id: ++disposerSeq,
            region: "header",
            disposer: result,
            attempted: false,
          };
          activeDisposers.push(entry);
          return () => {
            if (entry.attempted) return;
            entry.attempted = true;
            try {
              result();
              entry.status = "released";
            } catch (err) {
              entry.status = "failed";
              entry.error = err;
              if (!hasCausativeDisposerOccurrence) {
                hasCausativeDisposerOccurrence = true;
                firstCausativeDisposerOccurrence = {
                  id: ++failureSeq,
                  error: err,
                  phase: "running-content-dispose",
                  resource: { kind: "running-content", detail: "header" },
                };
                isTerminal = true;
                forwardingsBlocked = true;
              } else {
                recordSecondaryFailure(
                  "running-content-dispose",
                  err,
                  { kind: "running-content", detail: "header" }
                );
              }
              throw err;
            }
          };
        }
      }
    : undefined;

  const wrappedRenderFooter = options.renderFooter
    ? (context: RunningContentContext, mountPoint: HTMLElement): void | Disposer => {
        if (forwardingsBlocked || isTerminal) return;
        let result: void | Disposer;
        try {
          result = options.renderFooter!(context, mountPoint);
        } catch (renderErr) {
          runningContentRenderError = { error: renderErr, region: "footer" };
          throw renderErr;
        }

        if (typeof result === "function") {
          const entry: TrackedDisposer = {
            id: ++disposerSeq,
            region: "footer",
            disposer: result,
            attempted: false,
          };
          activeDisposers.push(entry);
          return () => {
            if (entry.attempted) return;
            entry.attempted = true;
            try {
              result();
              entry.status = "released";
            } catch (err) {
              entry.status = "failed";
              entry.error = err;
              if (!hasCausativeDisposerOccurrence) {
                hasCausativeDisposerOccurrence = true;
                firstCausativeDisposerOccurrence = {
                  id: ++failureSeq,
                  error: err,
                  phase: "running-content-dispose",
                  resource: { kind: "running-content", detail: "footer" },
                };
                isTerminal = true;
                forwardingsBlocked = true;
              } else {
                recordSecondaryFailure(
                  "running-content-dispose",
                  err,
                  { kind: "running-content", detail: "footer" }
                );
              }
              throw err;
            }
          };
        }
      }
    : undefined;

  function buildCleanupReport(
    resourceResults: DocumentEditorCleanupResourceResult[],
    limitations: string[]
  ): DocumentEditorCleanupReport {
    let hasFailed = false;
    let hasUnconfirmed = false;
    for (const r of resourceResults) {
      if (r.status === "failed") hasFailed = true;
      if (r.status === "unconfirmed") hasUnconfirmed = true;
    }

    let status: DocumentEditorCleanupReport["status"] = "completed";
    if (hasFailed) {
      status = "incomplete";
    } else if (hasUnconfirmed) {
      status = "unconfirmed";
    } else if (resourceResults.length === 0) {
      status = "not_required";
    }

    return {
      status,
      resources: [...resourceResults],
      limitations: [...limitations],
    };
  }

  function executePhysicalTeardown(
    origin: "instance" | "editor" | "initialization" | "render",
    hasPrimaryCause: boolean,
    primaryCause?: unknown,
    primaryPhase?: DocumentEditorPhase,
    primaryResource?: DocumentEditorResourceRef
  ): DocumentEditorCleanupReport {
    if (physicalTeardownStarted || physicalTeardownCompleted) {
      return cachedCleanupReport || buildCleanupReport([], []);
    }
    physicalTeardownStarted = true;
    isCoordinatingDestroy = true;

    const resourceResults: DocumentEditorCleanupResourceResult[] = [];
    const limitations: string[] = [];

    // Attempt 1: Running Content Disposers
    for (const d of activeDisposers) {
      if (!d.attempted) {
        d.attempted = true;
        try {
          d.disposer();
          d.status = "released";
          resourceResults.push({ resource: { kind: "running-content", detail: d.region }, status: "released" });
        } catch (err) {
          d.status = "failed";
          d.error = err;
          recordSecondaryFailure("running-content-dispose", err, { kind: "running-content", detail: d.region });
          resourceResults.push({ resource: { kind: "running-content", detail: d.region }, status: "failed" });
        }
      } else if (d.status === "failed") {
        resourceResults.push({ resource: { kind: "running-content", detail: d.region }, status: "failed" });
      } else if (d.status === "released") {
        resourceResults.push({ resource: { kind: "running-content", detail: d.region }, status: "released" });
      }
    }

    // Inspect view state on captured editor if present
    if (capturedEditor && (capturedEditor as any).view) {
      captureFacts.viewAssigned = true;
    }

    // Attempt 2: Native Editor
    // When attempt is due and Editor is reachable, it must NOT be omitted.
    // Native attempt flag must be set BEFORE the call.
    // An exception during Editor.destroy() must be recorded as failure of the attempt, not confirmation.
    if (capturedEditor && originalEditorDestroy && !nativeDestroyAttempted) {
      nativeDestroyAttempted = true;
      try {
        originalEditorDestroy.call(capturedEditor);
        if (captureFacts.viewAssigned) {
          resourceResults.push({ resource: { kind: "editor" }, status: "released" });
        } else {
          // View was never assigned; partial acquisition cannot be confirmed released from destroy return alone
          resourceResults.push({ resource: { kind: "editor" }, status: "unconfirmed" });
          limitations.push("Editor view was not assigned prior to teardown; release cannot be confirmed from destroy return alone.");
        }
      } catch (err) {
        recordSecondaryFailure("editor-destroy", err, { kind: "editor" });
        resourceResults.push({ resource: { kind: "editor" }, status: "failed" });
      }
    } else if (!capturedEditor) {
      resourceResults.push({ resource: { kind: "editor" }, status: "unconfirmed" });
      if (!captureFacts.callbackReached) {
        limitations.push("Editor capture callback (onBeforeCreate) was not reached.");
      } else {
        limitations.push("Editor instance was not captured from event payload.");
      }
    } else if (!originalEditorDestroy) {
      resourceResults.push({ resource: { kind: "editor" }, status: "unconfirmed" });
      limitations.push("Original destroy method on Editor was not captured prior to interception.");
    }

    // Attempt 3: Presentation (independent cleanup continues regardless of Editor result)
    if (presentation && !presentationDestroyAttempted) {
      presentationDestroyAttempted = true;
      try {
        presentation.destroy();
        resourceResults.push({ resource: { kind: "presentation" }, status: "released" });
      } catch (err) {
        recordSecondaryFailure("presentation-destroy", err, { kind: "presentation" });
        resourceResults.push({ resource: { kind: "presentation" }, status: "failed" });
      }
    }

    // Attempt 4: Wrapper DOM (independent cleanup continues regardless of Editor/Presentation result)
    if (wrapper && !wrapperDestroyAttempted) {
      wrapperDestroyAttempted = true;
      try {
        if (wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
        }
        resourceResults.push({ resource: { kind: "wrapper" }, status: "released" });
      } catch (err) {
        recordSecondaryFailure("wrapper-remove", err, { kind: "wrapper" });
        resourceResults.push({ resource: { kind: "wrapper" }, status: "failed" });
      }
    }

    isCoordinatingDestroy = false;
    physicalTeardownCompleted = true;
    const report = buildCleanupReport(resourceResults, limitations);
    cachedCleanupReport = report;

    // Determine public incident classification:
    // Internal reason like initialization-rollback MUST preserve operation: "initialization".
    // Do not use "primaryCause !== undefined" as sentinel: throw undefined is valid!
    if (hasPrimaryCause || report.status === "incomplete") {
      let op: DocumentEditorOperation;
      if (origin === "initialization") {
        op = "initialization";
      } else if (origin === "render") {
        op = "render";
      } else {
        op = "destroy";
      }

      let primary: DocumentEditorFailure;
      const remainingSecondaries: DocumentEditorFailure[] = secondaryOccurrences.map(occ => ({
        error: occ.error,
        phase: occ.phase,
        resource: occ.resource,
      }));

      if (hasPrimaryCause) {
        primary = {
          error: primaryCause,
          phase: primaryPhase || (op === "initialization" ? "editor-construction" : "editor-destroy"),
          resource: primaryResource || { kind: "editor" },
        };
      } else {
        const firstOcc = remainingSecondaries.shift();
        primary = firstOcc || {
          error: new Error("Cleanup failed"),
          phase: "editor-destroy",
          resource: { kind: "editor" },
        };
      }

      const incident: DocumentEditorIncident = {
        operation: op,
        primary,
        secondaryFailures: remainingSecondaries,
        state: "closed",
        cleanup: report,
      };

      if (isInsideOnError || destroyRequestedInsideOnError) {
        // Accepted V1 contingency channel
        console.error("DocumentEditor: Terminal incident occurred during reentrant destroy in onError", incident);
      } else if (options.onError) {
        isInsideOnError = true;
        try {
          options.onError(incident);
        } catch (obsErr) {
          console.error("DocumentEditor: Exception thrown by consumer onError observer", obsErr, incident);
        } finally {
          isInsideOnError = false;
        }
      } else {
        console.error("DocumentEditor: Fatal incident occurred with no onError handler configured", incident);
      }
    }

    return report;
  }

  function deferOrExecuteTeardown(
    origin: "instance" | "editor" | "initialization" | "render",
    hasPrimaryCause: boolean,
    primaryCause?: unknown,
    primaryPhase?: DocumentEditorPhase,
    primaryResource?: DocumentEditorResourceRef
  ): void {
    isTerminal = true;
    forwardingsBlocked = true;

    if (isInsideOnError) {
      destroyRequestedInsideOnError = true;
    }

    if (physicalTeardownStarted || physicalTeardownCompleted || isCoordinatingDestroy) {
      return;
    }

    if (activeOperationDepth > 0) {
      pendingCleanup = true;
      pendingDestroyOrigin = origin;
      pendingHasPrimaryCause = hasPrimaryCause;
      pendingPrimaryCause = primaryCause;
      pendingPrimaryPhase = primaryPhase;
      pendingPrimaryResource = primaryResource;
      return;
    }

    executePhysicalTeardown(origin, hasPrimaryCause, primaryCause, primaryPhase, primaryResource);
  }

  function handleCoordinatedDestroy(origin: "instance" | "editor"): void {
    deferOrExecuteTeardown(origin, false);
  }

  // 2. DOM Wrapper and Presentation setup
  try {
    wrapper = document.createElement("div");
    wrapper.className = "document-editor-composition-wrapper";
    wrapper.style.position = "relative";
    wrapper.style.width = `${pageConfig.width}px`;
    wrapper.style.boxSizing = "border-box";
    host.appendChild(wrapper);

    editorMount = document.createElement("div");
    editorMount.className = "document-editor-core-mount";
    editorMount.style.width = `${pageConfig.width}px`;
    editorMount.style.boxSizing = "border-box";
    wrapper.appendChild(editorMount);

    presentation = createDocumentPresentation(wrapper, {
      renderHeader: wrappedRenderHeader,
      renderFooter: wrappedRenderFooter,
    });
  } catch (setupErr) {
    isTerminal = true;
    forwardingsBlocked = true;
    executePhysicalTeardown("initialization", true, setupErr, "composition-setup", { kind: "wrapper" });
    throw setupErr;
  }

  // 3. Setup PaginationExtension with coordinated options
  // Preserves existing runningContent defaults: footer enabled with standard text
  const paginationExt = PaginationExtension.configure({
    layout: {
      page: pageConfig,
      policies: {
        keepWithNext: true,
        widowOrphan: true,
        minLinesBeforeBreak: 2,
        minLinesAfterBreak: 2,
        keepWithNextMinLines: 2,
      },
      runningContent: {
        header: { enabled: false, text: "", align: "center" },
        footer: { enabled: true, text: "Página {page} de {total}", align: "right" },
        differentFirstPage: false,
      },
    },
    visualMode: "composed",
    onLayoutStable: (snapshot: LayoutSnapshot) => {
      if (forwardingsBlocked || isTerminal) return;
      activeOperationDepth++;
      runningContentRenderError = null;
      hasCausativeDisposerOccurrence = false;
      firstCausativeDisposerOccurrence = null;
      try {
        // Step 1: Presentation render
        try {
          presentation!.render(snapshot);
        } catch (renderErr) {
          forwardingsBlocked = true;
          isTerminal = true;
          let phase: DocumentEditorPhase = "presentation-render";
          let resource: DocumentEditorResourceRef = { kind: "presentation" };
          const rcErr = runningContentRenderError as { error: unknown; region: "header" | "footer" } | null;
          if (rcErr) {
            phase = "running-content-render";
            resource = { kind: "running-content", detail: rcErr.region };
          }
          deferOrExecuteTeardown("render", true, renderErr, phase, resource);
          return;
        }

        // Check if any disposer threw during presentation render replacement
        const dispErr = firstCausativeDisposerOccurrence as TrackedFailureOccurrence | null;
        if (dispErr) {
          hasCausativeDisposerOccurrence = false;
          firstCausativeDisposerOccurrence = null;
          deferOrExecuteTeardown("render", true, dispErr.error, dispErr.phase, dispErr.resource);
          return;
        }

        // Re-evaluate terminality before Step 2
        if (forwardingsBlocked || isTerminal) return;

        // Step 2: Update frame visual extent
        try {
          if (wrapper && snapshot.pages.length > 0) {
            const lastPage = snapshot.pages[snapshot.pages.length - 1];
            const totalHeight = lastPage.sheetRect.top + lastPage.sheetRect.height;
            wrapper.style.minHeight = `${totalHeight}px`;
          }
        } catch (frameErr) {
          forwardingsBlocked = true;
          isTerminal = true;
          deferOrExecuteTeardown("render", true, frameErr, "frame-update", { kind: "wrapper" });
          return;
        }

        // Re-evaluate terminality before Step 3 (consumer callback)
        if (forwardingsBlocked || isTerminal) return;

        // Step 3: Consumer callback
        if (options.onLayoutStable) {
          try {
            options.onLayoutStable(snapshot);
          } catch (cbErr) {
            // Non-fatal consumer callback error
            if (options.onError) {
              const nonFatalIncident: DocumentEditorIncident = {
                operation: "render",
                primary: {
                  error: cbErr,
                  phase: "layout-callback",
                  resource: { kind: "editor" },
                },
                secondaryFailures: [],
                state: isTerminal ? "closed" : "active",
                cleanup: {
                  status: "not_required",
                  resources: [],
                  limitations: [],
                },
              };
              isInsideOnError = true;
              try {
                options.onError(nonFatalIncident);
              } catch (obsErr) {
                console.error(
                  "DocumentEditor: Exception thrown by consumer onError observer during non-fatal incident",
                  obsErr,
                  nonFatalIncident
                );
              } finally {
                isInsideOnError = false;
              }
            } else {
              // Operational contingency when onError observer is absent
              console.error("DocumentEditor: Exception in onLayoutStable with no onError observer", cbErr);
            }
          }
        }
      } finally {
        activeOperationDepth--;
        // Internal finalizer proceeds with pending attempts after the active operation returns,
        // normally or by exception!
        if (activeOperationDepth === 0 && pendingCleanup && !physicalTeardownStarted) {
          pendingCleanup = false;
          executePhysicalTeardown(
            pendingDestroyOrigin,
            pendingHasPrimaryCause,
            pendingPrimaryCause,
            pendingPrimaryPhase,
            pendingPrimaryResource
          );
        }
      }
    },
  });

  const extensions = [paginationExt, ...(options.extensions || [])];

  const composedOnBeforeCreate = (event: { editor: Editor }) => {
    captureFacts.callbackReached = true;
    const ed = event?.editor;
    if (ed) {
      captureFacts.editorCaptured = true;
      capturedEditor = ed;
      if (typeof ed.destroy === "function") {
        captureFacts.originalMethodCaptured = true;
        originalEditorDestroy = ed.destroy;
        ed.destroy = function interceptedEditorDestroy(this: Editor) {
          handleCoordinatedDestroy("editor");
        };
        captureFacts.interceptInstalled = true;
      }
      if ((ed as any).view) {
        captureFacts.viewAssigned = true;
      }

      // Check for duplicate pagination introduced by grouped extensions
      if (ed.extensionManager && Array.isArray(ed.extensionManager.extensions)) {
        const paginationExts = ed.extensionManager.extensions.filter((e) => e.name === "pagination");
        if (paginationExts.length > 1) {
          throw new Error("Duplicate pagination extension detected via grouped extension expansion.");
        }
      }
    }
  };

  // 4. Construct Editor with rollback on failure
  let editorInstance: Editor;
  try {
    editorInstance = new Editor({
      element: editorMount,
      content: options.content,
      extensions,
      editable: options.editable,
      autofocus: options.autofocus,
      parseOptions: options.parseOptions,
      injectCSS: false,
      onBeforeCreate: composedOnBeforeCreate,
    });
    if (editorInstance && (editorInstance as any).view) {
      captureFacts.viewAssigned = true;
      // Configure ProseMirror element styles natively to fulfill contracted page geometry
      const dom = (editorInstance as any).view.dom as HTMLElement | undefined;
      if (dom && dom.style) {
        dom.style.boxSizing = "border-box";
        dom.style.width = `${pageConfig.width}px`;
        dom.style.paddingTop = `${pageConfig.marginTop}px`;
        dom.style.paddingRight = `${pageConfig.marginRight}px`;
        dom.style.paddingBottom = `${pageConfig.marginBottom}px`;
        dom.style.paddingLeft = `${pageConfig.marginLeft}px`;
        dom.style.outline = "none";
        dom.style.background = "transparent";
      }
    }
  } catch (initErr) {
    isTerminal = true;
    forwardingsBlocked = true;
    executePhysicalTeardown("initialization", true, initErr, "editor-construction", { kind: "editor" });
    throw initErr;
  }

  // 5. Return minimal public interface
  return {
    editor: editorInstance,
    destroy() {
      handleCoordinatedDestroy("instance");
    },
  };
}
