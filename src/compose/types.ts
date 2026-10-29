import type { Editor, EditorOptions } from "@tiptap/core";
import type { LayoutSnapshot } from "../types";
import type { RunningContentContext, Disposer } from "../presentation";

/**
 * Operação principal que identifica o contexto originador do incidente.
 * Conforme ratificado na Opção B da Minuta de Autorização.
 */
export type DocumentEditorOperation = "initialization" | "render" | "destroy";

/**
 * Fase específica do ciclo de vida onde a ocorrência se manifestou.
 */
export type DocumentEditorPhase =
  | "composition-setup"
  | "editor-construction"
  | "presentation-render"
  | "running-content-render"
  | "frame-update"
  | "layout-callback"
  | "running-content-dispose"
  | "editor-destroy"
  | "presentation-destroy"
  | "wrapper-remove";

/**
 * Referência a um recurso sob responsabilidade ou gerenciamento da composição.
 */
export interface DocumentEditorResourceRef {
  readonly kind: "editor" | "presentation" | "wrapper" | "running-content";
  readonly detail?: string;
}

/**
 * Falha estruturada com fase e recurso associados.
 */
export interface DocumentEditorFailure {
  readonly error: unknown;
  readonly phase: DocumentEditorPhase;
  readonly resource?: DocumentEditorResourceRef;
}

/**
 * Resultado auditado da tentativa de liberação de um recurso individual.
 */
export interface DocumentEditorCleanupResourceResult {
  readonly resource: DocumentEditorResourceRef;
  readonly status: "released" | "failed" | "unconfirmed";
}

/**
 * Relatório consolidado da limpeza dos recursos próprios conhecidos e aquisições parciais.
 */
export interface DocumentEditorCleanupReport {
  readonly status: "not_required" | "completed" | "incomplete" | "unconfirmed";
  readonly resources: ReadonlyArray<DocumentEditorCleanupResourceResult>;
  readonly limitations: ReadonlyArray<string>;
}

/**
 * Modelo informativo do incidente comunicado pela composição.
 * Opção B ratificada integralmente.
 */
export interface DocumentEditorIncident {
  readonly operation: DocumentEditorOperation;
  readonly primary: DocumentEditorFailure;
  readonly secondaryFailures: ReadonlyArray<DocumentEditorFailure>;
  readonly state: "active" | "closed";
  readonly cleanup: DocumentEditorCleanupReport;
}

/**
 * Configuração de geometria inicial restrita a layout.page.
 */
export interface DocumentEditorPageLayoutOptions {
  readonly width?: number;
  readonly height?: number;
  readonly marginTop?: number;
  readonly marginRight?: number;
  readonly marginBottom?: number;
  readonly marginLeft?: number;
  readonly pageGap?: number;
}

/**
 * Opções públicas estritamente restritas à allowlist ratificada em COMP-CONTRATO-V1-R0.
 */
export interface DocumentEditorOptions {
  readonly host: HTMLElement;

  // Opções do Core (reutilizando estritamente os tipos de EditorOptions)
  readonly content?: EditorOptions["content"];
  readonly extensions?: EditorOptions["extensions"];
  readonly editable?: EditorOptions["editable"];
  readonly autofocus?: EditorOptions["autofocus"];
  readonly parseOptions?: EditorOptions["parseOptions"];

  // Geometria restrita a layout.page
  readonly layout?: {
    readonly page?: DocumentEditorPageLayoutOptions;
  };

  // Callbacks de Presentation fiéis ao contrato existente
  readonly renderHeader?: (context: RunningContentContext, mountPoint: HTMLElement) => void | Disposer;
  readonly renderFooter?: (context: RunningContentContext, mountPoint: HTMLElement) => void | Disposer;

  // Notificações síncronas
  readonly onLayoutStable?: (snapshot: LayoutSnapshot) => void;
  readonly onError?: (incident: DocumentEditorIncident) => void;
}

/**
 * Interface pública mínima retornada pela composição.
 */
export interface DocumentEditorInstance {
  readonly editor: Editor;
  destroy(): void;
}
