
import { createDocumentEditor, type DocumentEditorInstance, type DocumentEditorOptions, type DocumentEditorIncident } from "@jhonny_bcastro/document-editor/compose";

const host = document.createElement("div");
const options: DocumentEditorOptions = {
  host,
  onError(incident: DocumentEditorIncident) {
    console.log(incident.operation);
  }
};
const instance: DocumentEditorInstance = createDocumentEditor(options);
instance.destroy();
