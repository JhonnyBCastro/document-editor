import { createDocumentPresentation, DocumentPresentation } from '@jhonny_bcastro/document-editor/presentation';
import type { LayoutSnapshot } from '@jhonny_bcastro/document-editor';
import '@jhonny_bcastro/document-editor/presentation.css';

const host = document.getElementById('host') as HTMLElement;
const btnRender = document.getElementById('btn-render') as HTMLButtonElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnDestroy = document.getElementById('btn-destroy') as HTMLButtonElement;

let presentation: DocumentPresentation | null = createDocumentPresentation(host);

const syntheticSnapshot: LayoutSnapshot = {
    revision: 1,
    pages: [
        {
            index: 0,
            sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
            headerRect: { top: 96, left: 96, width: 624, height: 50 },
            footerRect: { top: 910, left: 96, width: 624, height: 50 }
        },
        {
            index: 1,
            sheetRect: { top: 1076, left: 0, width: 816, height: 1056 },
            headerRect: { top: 1172, left: 96, width: 624, height: 50 },
            footerRect: { top: 1986, left: 96, width: 624, height: 50 }
        }
    ],
    breaks: [],
    diagnostics: []
};

btnRender.addEventListener('click', () => {
    if (!presentation) {
        alert("Presentation is destroyed. Refresh to start again.");
        return;
    }
    presentation.render(syntheticSnapshot);
});

btnClear.addEventListener('click', () => {
    if (presentation) {
        presentation.clear();
    }
});

btnDestroy.addEventListener('click', () => {
    if (presentation) {
        presentation.destroy();
        presentation = null;
    }
});
