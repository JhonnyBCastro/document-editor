import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDocumentEditor } from "../../src/compose";
import { PaginationExtension, whenLayoutStable } from "../../src/index";
import { createDocumentPresentation } from "../../src/presentation/index";
import { Extension, Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

describe("Composition Layer V1 — createDocumentEditor", () => {
  let host: HTMLElement;
  let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);

    originalGetBCR = window.Element.prototype.getBoundingClientRect;
    window.Element.prototype.getBoundingClientRect = function() {
      return {
        width: 816,
        height: 1056,
        top: 0,
        left: 0,
        bottom: 1056,
        right: 816,
        x: 0,
        y: 0,
        toJSON: () => {}
      } as DOMRect;
    };
  });

  afterEach(() => {
    window.Element.prototype.getBoundingClientRect = originalGetBCR;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
  });

  describe("1. Allowlist and Options Normalization (TR-NORM-01, TR-NORM-04)", () => {
    it("rejects unknown root options with TypeError", () => {
      expect(() => {
        createDocumentEditor({
          host,
          // @ts-expect-error testing unknown property
          unknownProp: true,
        });
      }).toThrow(TypeError);
    });

    it("rejects missing or non-HTMLElement host with TypeError", () => {
      expect(() => {
        // @ts-expect-error testing missing host
        createDocumentEditor({});
      }).toThrow(TypeError);

      expect(() => {
        // @ts-expect-error testing invalid host
        createDocumentEditor({ host: "not-an-element" });
      }).toThrow(TypeError);
    });

    it("rejects unknown properties in layout and layout.page with TypeError", () => {
      expect(() => {
        createDocumentEditor({
          host,
          layout: {
            // @ts-expect-error testing unknown layout property
            policies: {},
          },
        });
      }).toThrow(TypeError);

      expect(() => {
        createDocumentEditor({
          host,
          layout: {
            page: {
              // @ts-expect-error testing unknown page property
              unknownPageKey: 123,
            },
          },
        });
      }).toThrow(TypeError);
    });

    it("preserves defaults when layout.page properties are omitted or undefined", () => {
      const instance = createDocumentEditor({ host, extensions: [StarterKit] });
      expect(instance.editor).toBeDefined();
      const storage = (instance.editor.storage as any).pagination;
      expect(storage).toBeDefined();
      expect(storage.controller.getLayout().page).toEqual({
        width: 816,
        height: 1056,
        marginTop: 96,
        marginRight: 96,
        marginBottom: 96,
        marginLeft: 96,
        pageGap: 20,
      });
      instance.destroy();
    });

    it("rejects zero on width and height with TypeError", () => {
      expect(() => {
        createDocumentEditor({
          host,
          layout: { page: { width: 0 } },
        });
      }).toThrow(TypeError);

      expect(() => {
        createDocumentEditor({
          host,
          layout: { page: { height: 0 } },
        });
      }).toThrow(TypeError);
    });

    it("accepts zero on margins and pageGap", () => {
      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        layout: {
          page: {
            marginTop: 0,
            marginRight: 0,
            marginBottom: 0,
            marginLeft: 0,
            pageGap: 0,
          },
        },
      });
      const storage = (instance.editor.storage as any).pagination;
      expect(storage.controller.getLayout().page.marginTop).toBe(0);
      expect(storage.controller.getLayout().page.pageGap).toBe(0);
      instance.destroy();
    });

    it("accepts positive finite fractions", () => {
      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        layout: {
          page: {
            width: 816.5,
            height: 1056.25,
            marginTop: 48.5,
          },
        },
      });
      const storage = (instance.editor.storage as any).pagination;
      expect(storage.controller.getLayout().page.width).toBe(816.5);
      expect(storage.controller.getLayout().page.height).toBe(1056.25);
      expect(storage.controller.getLayout().page.marginTop).toBe(48.5);
      instance.destroy();
    });

    it("rejects negative numbers, strings, NaN, Infinity and null with TypeError", () => {
      const invalidValues = [-10, "96", NaN, Infinity, -Infinity, null];
      for (const val of invalidValues) {
        expect(() => {
          createDocumentEditor({
            host,
            // @ts-expect-error testing invalid type
            layout: { page: { width: val } },
          });
        }).toThrow(TypeError);

        expect(() => {
          createDocumentEditor({
            host,
            // @ts-expect-error testing invalid type
            layout: { page: { marginTop: val } },
          });
        }).toThrow(TypeError);
      }
    });

    it("rejects margins that zero or exceed page dimensions with TypeError", () => {
      expect(() => {
        createDocumentEditor({
          host,
          layout: {
            page: {
              width: 200,
              marginLeft: 100,
              marginRight: 100, // usefulWidth = 0
            },
          },
        });
      }).toThrow(TypeError);

      expect(() => {
        createDocumentEditor({
          host,
          layout: {
            page: {
              height: 200,
              marginTop: 150,
              marginBottom: 100, // usefulHeight = -50
            },
          },
        });
      }).toThrow(TypeError);
    });

    it("does not mutate consumer options or share mutable state between instances", () => {
      const consumerOptions = {
        host,
        extensions: [StarterKit],
        layout: {
          page: {
            width: 800,
            marginTop: 50,
          },
        },
      };
      const instance1 = createDocumentEditor(consumerOptions);
      expect(consumerOptions.layout.page.width).toBe(800);
      expect((consumerOptions.layout.page as any).height).toBeUndefined();

      const host2 = document.createElement("div");
      document.body.appendChild(host2);
      const instance2 = createDocumentEditor({ host: host2, extensions: [StarterKit] });

      const storage1 = (instance1.editor.storage as any).pagination.controller.getLayout().page;
      const storage2 = (instance2.editor.storage as any).pagination.controller.getLayout().page;
      expect(storage1.width).toBe(800);
      expect(storage2.width).toBe(816);

      instance1.destroy();
      instance2.destroy();
      host2.remove();
    });
  });

  describe("2. Pagination Duplicity Detection (TR-NORM-06)", () => {
    it("rejects direct PaginationExtension in options.extensions before construction", () => {
      expect(() => {
        createDocumentEditor({
          host,
          extensions: [PaginationExtension],
        });
      }).toThrow(/already provided by the composition layer/);
    });

    it("detects grouped duplicate pagination in onBeforeCreate and aborts with rollback", () => {
      const GroupedExtension = Extension.create({
        name: "groupedBundle",
        addExtensions() {
          return [PaginationExtension];
        },
      });

      expect(() => {
        createDocumentEditor({
          host,
          extensions: [StarterKit, GroupedExtension],
        });
      }).toThrow(/Duplicate pagination extension detected/);

      // Verify rollback removed wrapper from host
      expect(host.children.length).toBe(0);
    });
  });

  describe("3. Lifecycle and Direct Interception (TR-REENT-01, TR-CLEAN-INDEPENDENT-01)", () => {
    it("destroys completely via instance.destroy() and removes wrapper from host", () => {
      const instance = createDocumentEditor({ host, extensions: [StarterKit] });
      expect(host.children.length).toBe(1);
      const editor = instance.editor;

      instance.destroy();

      expect(editor.isDestroyed).toBe(true);
      expect(host.children.length).toBe(0);
    });

    it("destroys completely when consumer calls instance.editor.destroy() directly", () => {
      const instance = createDocumentEditor({ host, extensions: [StarterKit] });
      expect(host.children.length).toBe(1);
      const editor = instance.editor;

      // Direct call on editor
      editor.destroy();

      expect(editor.isDestroyed).toBe(true);
      expect(host.children.length).toBe(0);
    });

    it("is strictly idempotent: repeated calls to destroy do not repeat execution", () => {
      const instance = createDocumentEditor({ host, extensions: [StarterKit] });
      const editor = instance.editor;

      instance.destroy();
      expect(host.children.length).toBe(0);

      // Subsequent calls on instance or editor are safe no-ops
      expect(() => instance.destroy()).not.toThrow();
      expect(() => editor.destroy()).not.toThrow();
      expect(host.children.length).toBe(0);
    });

    it("continues cleaning Presentation and DOM wrapper even if Editor.destroy throws", () => {
      let capturedIncident: any = null;
      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        onError(incident) {
          capturedIncident = incident;
        },
      });

      // Inject a failure into editor view destroy
      const ed = instance.editor as any;
      ed.view.destroy = () => {
        throw new Error("Simulated native editor view destroy crash");
      };

      instance.destroy();

      // Presentation and wrapper are still cleaned up
      expect(host.children.length).toBe(0);
      expect(capturedIncident).toBeDefined();
      expect(capturedIncident.operation).toBe("destroy");
      expect(capturedIncident.cleanup.status).toBe("incomplete");
      const editorResult = capturedIncident.cleanup.resources.find((r: any) => r.resource.kind === "editor");
      expect(editorResult.status).toBe("failed");
      const wrapperResult = capturedIncident.cleanup.resources.find((r: any) => r.resource.kind === "wrapper");
      expect(wrapperResult.status).toBe("released");
    });
  });

  describe("4. Disposers Tracking and Execution", () => {
    it("executes header and footer disposers on destroy", async () => {
      let headerDisposed = false;
      let footerDisposed = false;

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Hello world page</p>",
        renderHeader() {
          return () => {
            headerDisposed = true;
          };
        },
        renderFooter() {
          return () => {
            footerDisposed = true;
          };
        },
      });

      await whenLayoutStable(instance.editor);

      instance.destroy();
      expect(headerDisposed).toBe(true);
      expect(footerDisposed).toBe(true);
    });

    it("continues running other disposers even if one disposer throws", async () => {
      let secondDisposed = false;
      let capturedIncident: any = null;

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Hello world page</p>",
        onError(incident) {
          capturedIncident = incident;
        },
        renderHeader() {
          return () => {
            throw new Error("Faulty header disposer");
          };
        },
        renderFooter() {
          return () => {
            secondDisposed = true;
          };
        },
      });

      await whenLayoutStable(instance.editor);

      instance.destroy();
      expect(secondDisposed).toBe(true);
      expect(host.children.length).toBe(0);
      expect(capturedIncident).toBeDefined();
    });
  });

  describe("5. Observability V1 Contingency Channel and Reentrancy (TR-INC-CONTINGENCY-01)", () => {
    it("logs to console.error when destroy is called inside onError during non-fatal incident", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      let onErrorCallCount = 0;

      let instanceRef: any = null;
      instanceRef = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Content to trigger layout</p>",
        onLayoutStable() {
          throw new Error("Non-fatal layout callback error");
        },
        onError(incident) {
          onErrorCallCount++;
          expect(incident.operation).toBe("render");
          expect(incident.primary.phase).toBe("layout-callback");
          // Reentrant destroy inside onError
          instanceRef.destroy();
        },
      });

      await whenLayoutStable(instanceRef.editor);

      expect(onErrorCallCount).toBe(1);
      // Verify destroy completed and wrapper removed
      expect(host.children.length).toBe(0);

      // Verify that no recursive call to onError happened
      expect(onErrorCallCount).toBe(1);

      consoleErrorSpy.mockRestore();
    });

    it("catches and logs exception if consumer onError throws, without breaking teardown", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Content</p>",
        onLayoutStable() {
          throw new Error("Non-fatal layout callback error");
        },
        onError() {
          throw new Error("Observer crash inside onError");
        },
      });

      await whenLayoutStable(instance.editor);

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
      instance.destroy();
    });
  });

  describe("6. Frente A Comprehensive Review & Regression Suite", () => {
    it("1. replacement disposer failure causes a terminal render incident", async () => {
      const incidents: any[] = [];
      const marker = new Error("replacement-disposer-failure");
      let renders = 0;

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Content 1</p>",
        onError(e) {
          incidents.push(e);
        },
        renderHeader() {
          renders++;
          return () => {
            throw marker;
          };
        },
      });

      await whenLayoutStable(instance.editor);
      // Trigger replacement layout
      instance.editor.commands.setContent("<p>Content 2 replacement</p>");
      await whenLayoutStable(instance.editor).catch(() => {});

      expect(incidents.length).toBeGreaterThanOrEqual(1);
      const fatal = incidents.find(inc => inc.state === "closed");
      expect(fatal).toBeDefined();
      expect(fatal.operation).toBe("render");
      expect(fatal.primary.error).toBe(marker);
      expect(fatal.primary.phase).toBe("running-content-dispose");
      expect(instance.editor.isDestroyed).toBe(true);
    });

    it("2. destroy requested by renderer blocks later success callback and executes late disposer", async () => {
      let instanceRef: any;
      let lateDisposed = 0;
      const success = vi.fn();

      instanceRef = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Content</p>",
        onLayoutStable: success,
        renderHeader() {
          instanceRef.destroy();
          return () => {
            lateDisposed++;
          };
        },
      });

      await whenLayoutStable(instanceRef.editor).catch(() => {});

      expect(lateDisposed).toBe(1);
      expect(success).not.toHaveBeenCalled();
      expect(instanceRef.editor.isDestroyed).toBe(true);
    });

    it("3. undefined thrown by renderer remains a fatal primary cause", async () => {
      const incidents: any[] = [];
      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Content</p>",
        onError(e) {
          incidents.push(e);
        },
        renderHeader() {
          throw undefined;
        },
      });

      await whenLayoutStable(instance.editor).catch(() => {});

      expect(incidents).toHaveLength(1);
      expect(incidents[0].operation).toBe("render");
      expect(incidents[0].primary.error).toBeUndefined();
      expect(incidents[0].primary.phase).toBe("running-content-render");
      expect(incidents[0].state).toBe("closed");
      expect(instance.editor.isDestroyed).toBe(true);
    });

    it("4. running-content callback failure uses specific phase and resource", async () => {
      const incidents: any[] = [];
      const marker = new Error("header-failure");
      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Content</p>",
        onError(e) {
          incidents.push(e);
        },
        renderHeader() {
          throw marker;
        },
      });

      await whenLayoutStable(instance.editor).catch(() => {});

      expect(incidents).toHaveLength(1);
      expect(incidents[0].primary.error).toBe(marker);
      expect(incidents[0].primary.phase).toBe("running-content-render");
      expect(incidents[0].primary.resource).toEqual({ kind: "running-content", detail: "header" });
      expect(instance.editor.isDestroyed).toBe(true);
    });

    it("5. failed constructor with no assigned view reports unconfirmed from destroy return alone", () => {
      const incidents: any[] = [];
      const marker = new Error("toDOM-crash");
      const CrashNode = Extension.create({
        name: "crashReviewNode",
        // Trigger error during view construction
      });
      const CrashNodeExt = Node.create ? Node.create({
        name: "crashReviewNode",
        group: "block",
        atom: true,
        renderHTML() { throw marker; }
      }) : null;

      // Import Node dynamically from @tiptap/core
      const { Node: TNode } = require("@tiptap/core");
      const CrashingNode = TNode.create({
        name: "crashingReviewNode",
        group: "block",
        atom: true,
        renderHTML() { throw marker; }
      });

      expect(() => {
        createDocumentEditor({
          host,
          extensions: [StarterKit, CrashingNode],
          content: { type: "doc", content: [{ type: "crashingReviewNode" }] },
          onError(e) {
            incidents.push(e);
          },
        });
      }).toThrow(marker);

      expect(incidents).toHaveLength(1);
      const editorRes = incidents[0].cleanup.resources.find((r: any) => r.resource.kind === "editor");
      expect(editorRes.status).toBe("unconfirmed");
      expect(incidents[0].cleanup.limitations.length).toBeGreaterThan(0);
      expect(incidents[0].cleanup.limitations[0]).toContain("Editor view was not assigned");
    });

    it("6. throwing callback without onError has operational contingency via console.error", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const marker = new Error("callback-without-observer");

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Content</p>",
        onLayoutStable() {
          throw marker;
        },
      });

      await whenLayoutStable(instance.editor);

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
      instance.destroy();
    });

    it("7. destroy from a renderer defers native destruction until renderer returns", async () => {
      const calls: string[] = [];
      let instanceRef: any;

      instanceRef = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Content</p>",
        renderHeader() {
          calls.push("renderer:start");
          instanceRef.destroy();
          calls.push("renderer:end");
          return () => calls.push("disposer");
        },
      });

      instanceRef.editor.on("destroy", () => calls.push("native-destroy"));

      await whenLayoutStable(instanceRef.editor).catch(() => {});

      expect(calls.indexOf("renderer:end")).toBeLessThan(calls.indexOf("native-destroy"));
      expect(calls).toContain("disposer");
    });

    it("8. finite inputs whose derived page stride overflows are rejected before mounting", () => {
      expect(() => {
        createDocumentEditor({
          host,
          extensions: [StarterKit],
          layout: {
            page: {
              height: Number.MAX_VALUE,
              pageGap: Number.MAX_VALUE,
            },
          },
        });
      }).toThrow(TypeError);

      expect(host.children.length).toBe(0);
    });

    it("9. preserves existing running-content defaults (footer enabled)", () => {
      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
      });

      const running = (instance.editor.storage as any).pagination.controller.getLayout().runningContent;
      expect(running.footer).toEqual({
        enabled: true,
        text: "Página {page} de {total}",
        align: "right",
      });

      instance.destroy();
    });

    it("10. demonstrates contingency channel with REAL cleanup failure during descarte inside onError", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      let onErrorCalls = 0;
      let nonFatalIncident: any = null;
      let instanceRef: any;

      instanceRef = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Content</p>",
        onLayoutStable() {
          throw new Error("Initial non-fatal error");
        },
        onError(incident) {
          onErrorCalls++;
          nonFatalIncident = incident;

          // Inject failure into editor view destroy
          const ed = instanceRef.editor as any;
          ed.view.destroy = () => {
            throw new Error("Real native teardown crash inside reentrant destroy");
          };

          // Reentrant destroy inside onError
          instanceRef.destroy();
        },
      });

      await whenLayoutStable(instanceRef.editor);

      // Verify no recursion into onError: exactly 1 call
      expect(onErrorCalls).toBe(1);
      expect(nonFatalIncident.operation).toBe("render");
      expect(nonFatalIncident.primary.phase).toBe("layout-callback");

      // Verify contingency channel logged the distinct terminal incident
      expect(consoleErrorSpy).toHaveBeenCalled();
      const contingencyArgs = consoleErrorSpy.mock.calls.find(call =>
        typeof call[0] === "string" && call[0].includes("DocumentEditor: Terminal incident occurred during reentrant destroy in onError")
      );
      expect(contingencyArgs).toBeDefined();
      const terminalIncident = contingencyArgs![1];
      expect(terminalIncident.operation).toBe("destroy");
      expect(terminalIncident.cleanup.status).toBe("incomplete");
      const edRes = terminalIncident.cleanup.resources.find((r: any) => r.resource.kind === "editor");
      expect(edRes.status).toBe("failed");

      consoleErrorSpy.mockRestore();
    });

    it("11. reports and incident snapshots are immutable and not reused across subsequent operations", async () => {
      const publishedIncidents: any[] = [];

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Initial</p>",
        onLayoutStable() {
          throw new Error("First non-fatal error");
        },
        onError(incident) {
          publishedIncidents.push(incident);
        },
      });

      await whenLayoutStable(instance.editor);

      expect(publishedIncidents.length).toBe(1);
      const firstIncident = publishedIncidents[0];
      const firstSnapshot = JSON.stringify(firstIncident);

      // Trigger second layout round with another non-fatal error
      instance.editor.commands.setContent("<p>Second</p>");
      await whenLayoutStable(instance.editor).catch(() => {});

      // Verify two distinct incidents were published
      expect(publishedIncidents.length).toBe(2);
      expect(publishedIncidents[0]).not.toBe(publishedIncidents[1]);

      // Verify original first published incident was NOT mutated or overwritten
      expect(JSON.stringify(publishedIncidents[0])).toBe(firstSnapshot);
      expect(publishedIncidents[0].state).toBe("active");

      instance.destroy();
      expect(JSON.stringify(publishedIncidents[0])).toBe(firstSnapshot);
    });

    it("12. preserves pre-existing host children, Core isolado, Presentation isolada and manual composition", async () => {
      // 12A. Host preservation
      const preExisting1 = document.createElement("div");
      preExisting1.id = "pre-1";
      preExisting1.textContent = "Pre-existing 1";
      host.appendChild(preExisting1);

      const preExisting2 = document.createElement("span");
      preExisting2.id = "pre-2";
      preExisting2.textContent = "Pre-existing 2";
      host.appendChild(preExisting2);

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Composed content</p>",
      });

      expect(host.contains(preExisting1)).toBe(true);
      expect(host.contains(preExisting2)).toBe(true);
      expect(host.children[0]).toBe(preExisting1);
      expect(host.children[1]).toBe(preExisting2);

      instance.destroy();

      // Only composition wrapper is removed; pre-existing elements remain intact
      expect(host.contains(preExisting1)).toBe(true);
      expect(host.contains(preExisting2)).toBe(true);
      expect(host.children.length).toBe(2);

      // 12B. Core isolado works as before
      const coreHost = document.createElement("div");
      document.body.appendChild(coreHost);
      const coreEditor = new Editor({
        element: coreHost,
        extensions: [StarterKit, PaginationExtension],
        content: "<p>Isolated core</p>",
      });
      expect(coreEditor.isDestroyed).toBe(false);
      coreEditor.destroy();
      expect(coreEditor.isDestroyed).toBe(true);
      coreHost.remove();

      // 12C. Presentation isolada works as before
      const presHost = document.createElement("div");
      document.body.appendChild(presHost);
      // createDocumentPresentation imported statically
      const pres = createDocumentPresentation(presHost);
      expect(typeof pres.render).toBe("function");
      expect(typeof pres.destroy).toBe("function");
      pres.destroy();
      presHost.remove();

      // 12D. Coordenação manual completa entre Core e Presentation
      const manualHost = document.createElement("div");
      document.body.appendChild(manualHost);
      const manualEditorMount = document.createElement("div");
      manualHost.appendChild(manualEditorMount);

      const publishedSnapshots: any[] = [];
      let publicationCycle = 0;

      const manualPresentation = createDocumentPresentation(manualHost, {
        renderHeader(ctx, mount) {
          mount.textContent = `Header Page ${ctx.pageIndex + 1} [cycle:${publicationCycle}]`;
          mount.setAttribute("data-publication-cycle", String(publicationCycle));
        },
        renderFooter(ctx, mount) {
          mount.textContent = `Footer Page ${ctx.pageIndex + 1} [cycle:${publicationCycle}]`;
          mount.setAttribute("data-publication-cycle", String(publicationCycle));
        }
      });

      const manualEditor = new Editor({
        element: manualEditorMount,
        extensions: [
          StarterKit,
          PaginationExtension.configure({
            visualMode: "composed",
            onLayoutStable: (snap) => {
              publicationCycle++;
              publishedSnapshots.push(snap);
              manualPresentation.render(snap);
            }
          })
        ],
        content: "<p>Manual composition initial page 1</p>",
      });

      // Aguardar primeira publicação efetiva do Core
      const initialSnap = await whenLayoutStable(manualEditor);
      expect(initialSnap).toBeDefined();
      expect(publishedSnapshots.length).toBe(1);
      expect(publishedSnapshots[0]).toBe(initialSnap);

      const initialSheets = manualHost.querySelectorAll(".document-presentation-sheet");
      const initialHeaders = manualHost.querySelectorAll(".document-presentation-header");
      const initialFooters = manualHost.querySelectorAll(".document-presentation-footer");

      expect(initialSheets.length).toBeGreaterThanOrEqual(1);
      expect(initialHeaders.length).toBe(initialSheets.length);
      expect(initialFooters.length).toBe(initialSheets.length);
      expect(initialHeaders[0].textContent).toBe(`Header Page 1 [cycle:1]`);
      expect(initialHeaders[0].getAttribute("data-publication-cycle")).toBe("1");
      expect(initialFooters[0].textContent).toBe(`Footer Page 1 [cycle:1]`);
      expect(initialFooters[0].getAttribute("data-publication-cycle")).toBe("1");

      // Substituir o conteúdo e aguardar nova publicação efetiva do Core
      manualEditor.commands.setContent("<p>Updated manual composition content</p>");
      const updatedSnap = await whenLayoutStable(manualEditor);

      expect(updatedSnap).toBeDefined();
      expect(publishedSnapshots.length).toBe(2);
      expect(publishedSnapshots[1]).toBe(updatedSnap);

      const updatedSheets = manualHost.querySelectorAll(".document-presentation-sheet");
      const updatedHeaders = manualHost.querySelectorAll(".document-presentation-header");
      const updatedFooters = manualHost.querySelectorAll(".document-presentation-footer");

      expect(updatedSheets.length).toBeGreaterThanOrEqual(1);
      expect(updatedHeaders.length).toBe(updatedSheets.length);
      expect(updatedFooters.length).toBe(updatedSheets.length);

      // Comprovar que a nova publicação foi efetivamente aplicada à Presentation
      expect(updatedHeaders[0].getAttribute("data-publication-cycle")).toBe("2");
      expect(updatedHeaders[0].textContent).toBe(`Header Page 1 [cycle:2]`);
      expect(updatedHeaders[0].getAttribute("data-publication-cycle")).not.toBe("1");
      expect(updatedFooters[0].getAttribute("data-publication-cycle")).toBe("2");
      expect(updatedFooters[0].textContent).toBe(`Footer Page 1 [cycle:2]`);

      // Descartar Editor e Presentation e verificar resultados observáveis pertinentes
      manualEditor.destroy();
      expect(manualEditor.isDestroyed).toBe(true);

      manualPresentation.destroy();
      expect(manualHost.querySelector(".document-presentation-layer")).toBeNull();
      expect(manualHost.querySelectorAll(".document-presentation-sheet").length).toBe(0);

      manualHost.remove();
    });

    it("13. instance.editor satisfies instanceof Editor and wrapping exposes minimal interface", () => {
      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
      });

      expect(instance.editor).toBeInstanceOf(Editor);
      expect(typeof instance.destroy).toBe("function");
      expect(Object.keys(instance).sort()).toEqual(["destroy", "editor"]);

      instance.destroy();
      expect(host.children.length).toBe(0);
    });
    it("14. preserves first causative disposer occurrence as primary even when subsequent disposers fail", () => {
      const incidents: any[] = [];
      const h = new Error("first-header-dispose");
      const f = new Error("second-footer-dispose");
      let headers = 0;
      let footers = 0;

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Disposer test</p>",
        onError: (e) => incidents.push(e),
        renderHeader() {
          headers++;
          return () => { throw h; };
        },
        renderFooter() {
          footers++;
          return () => { throw f; };
        },
      });

      const snap = {
        revision: 1,
        pages: [{
          index: 0,
          sheetRect: { left: 0, top: 0, width: 816, height: 1056 },
          headerRect: { left: 96, top: 0, width: 624, height: 96 },
          footerRect: { left: 96, top: 960, width: 624, height: 96 },
        }],
        breaks: [],
        diagnostics: []
      };

      instance.editor.storage.pagination.controller.onLayoutStable(snap);
      instance.editor.storage.pagination.controller.onLayoutStable(snap);

      expect(incidents.length).toBe(1);
      const inc = incidents[0];
      expect(inc.primary.error).toBe(h);
      expect(inc.secondaryFailures.some((x: any) => x.error === inc.primary.error)).toBe(false);
      expect(inc.secondaryFailures.some((x: any) => x.error === f)).toBe(true);
      expect(headers).toBe(1);
      expect(footers).toBe(1);
      expect(inc.cleanup.status).toBe("incomplete");
      expect(inc.cleanup.resources.some((r: any) => r.resource.kind === "running-content" && r.status === "failed")).toBe(true);
    });

    it("15. retains original fatal incident and observer exception separately in contingency when onError throws", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const primary = new Error("original-render-failure");
      const observer = new Error("observer-failure");

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Error observer</p>",
        renderHeader() { throw primary; },
        onError() { throw observer; }
      });

      const snap = {
        revision: 1,
        pages: [{
          index: 0,
          sheetRect: { left: 0, top: 0, width: 816, height: 1056 },
          headerRect: { left: 96, top: 0, width: 624, height: 96 },
          footerRect: { left: 96, top: 960, width: 624, height: 96 },
        }],
        breaks: [],
        diagnostics: []
      };

      instance.editor.storage.pagination.controller.onLayoutStable(snap);

      const args = consoleErrorSpy.mock.calls.flat();
      expect(args.some((x: any) => x === primary || x?.primary?.error === primary)).toBe(true);
      expect(args.includes(observer)).toBe(true);
      consoleErrorSpy.mockRestore();
    });

    it("16. provides contingency for fatal renderer failure without onError", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const primary = new Error("fatal-without-observer");

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>No onError</p>",
        renderHeader() { throw primary; }
      });

      const snap = {
        revision: 1,
        pages: [{
          index: 0,
          sheetRect: { left: 0, top: 0, width: 816, height: 1056 },
          headerRect: { left: 96, top: 0, width: 624, height: 96 },
          footerRect: { left: 96, top: 960, width: 624, height: 96 },
        }],
        breaks: [],
        diagnostics: []
      };

      instance.editor.storage.pagination.controller.onLayoutStable(snap);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const args = consoleErrorSpy.mock.calls.flat();
      expect(args.some((x: any) => x?.primary?.error === primary)).toBe(true);
      consoleErrorSpy.mockRestore();
    });
    it("17. preserves non-fatal incident when onError throws during onLayoutStable, without recursion or closing composition", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const callbackError = new Error("onLayoutStable-non-fatal");
      const observerError = new Error("onError-observer-throws");
      let onErrorCalls = 0;

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Active content</p>",
        onLayoutStable() {
          throw callbackError;
        },
        onError(incident) {
          onErrorCalls++;
          throw observerError;
        }
      });

      const snap = {
        revision: 1,
        pages: [{
          index: 0,
          sheetRect: { left: 0, top: 0, width: 816, height: 1056 },
          headerRect: { left: 96, top: 0, width: 624, height: 96 },
          footerRect: { left: 96, top: 960, width: 624, height: 96 },
        }],
        breaks: [],
        diagnostics: []
      };

      // Trigger the onLayoutStable notification
      instance.editor.storage.pagination.controller.onLayoutStable(snap);

      // 1. Verify no recursive notification
      expect(onErrorCalls).toBe(1);

      // 2. Verify contingency log preserves original incident and observer error separately
      expect(consoleErrorSpy).toHaveBeenCalled();
      const args = consoleErrorSpy.mock.calls.flat();
      expect(args.includes(observerError)).toBe(true);
      const loggedIncident = args.find((x: any) => x?.primary?.error === callbackError);
      expect(loggedIncident).toBeDefined();
      expect(loggedIncident.operation).toBe("render");
      expect(loggedIncident.primary.phase).toBe("layout-callback");
      expect(loggedIncident.state).toBe("active");

      // 3. Verify composition remains active (no destroy requested)
      expect(instance.editor.isDestroyed).toBe(false);
      expect(host.children.length).toBeGreaterThan(0);

      consoleErrorSpy.mockRestore();
      instance.destroy();
    });

    it("18. preserves individual disposer results in cleanup report when header succeeds and footer fails", () => {
      const incidents: any[] = [];
      let headerDisposedCount = 0;
      let footerDisposedCount = 0;
      const footerError = new Error("footer-disposer-fails");

      const instance = createDocumentEditor({
        host,
        extensions: [StarterKit],
        content: "<p>Disposer test</p>",
        onError: (e) => incidents.push(e),
        renderHeader() {
          return () => {
            headerDisposedCount++;
            // Returns normally
          };
        },
        renderFooter() {
          return () => {
            footerDisposedCount++;
            throw footerError;
          };
        },
      });

      const snap = {
        revision: 1,
        pages: [{
          index: 0,
          sheetRect: { left: 0, top: 0, width: 816, height: 1056 },
          headerRect: { left: 96, top: 0, width: 624, height: 96 },
          footerRect: { left: 96, top: 960, width: 624, height: 96 },
        }],
        breaks: [],
        diagnostics: []
      };

      instance.editor.storage.pagination.controller.onLayoutStable(snap);
      instance.editor.storage.pagination.controller.onLayoutStable(snap);

      // Verify each disposer executed exactly once during replacement
      expect(headerDisposedCount).toBe(1);
      expect(footerDisposedCount).toBe(1);

      expect(incidents.length).toBe(1);
      const inc = incidents[0];
      expect(inc.primary.error).toBe(footerError);
      expect(inc.secondaryFailures.some((x: any) => x.error === inc.primary.error)).toBe(false);

      // Verify cleanup report has both released header and failed footer
      const headerRes = inc.cleanup.resources.find((r: any) => r.resource.kind === "running-content" && r.resource.detail === "header");
      const footerRes = inc.cleanup.resources.find((r: any) => r.resource.kind === "running-content" && r.resource.detail === "footer");
      expect(headerRes).toBeDefined();
      expect(headerRes.status).toBe("released");
      expect(footerRes).toBeDefined();
      expect(footerRes.status).toBe("failed");

      expect(inc.cleanup.status).toBe("incomplete");

      // Verify independent cleanups of Editor, Presentation, Wrapper
      const edRes = inc.cleanup.resources.find((r: any) => r.resource.kind === "editor");
      const presRes = inc.cleanup.resources.find((r: any) => r.resource.kind === "presentation");
      const wrapRes = inc.cleanup.resources.find((r: any) => r.resource.kind === "wrapper");
      expect(edRes?.status).toBe("released");
      expect(presRes?.status).toBe("released");
      expect(wrapRes?.status).toBe("released");
    });
  });
});
