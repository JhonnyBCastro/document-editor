import type { LayoutSnapshot } from '../types';

import './presentation.css';

/**
 * Opções para inicialização da Presentation V1.
 */
export interface DocumentPresentationOptions {
    // TODO: Awaiting frozen definitions for running content, tokens, data attributes, and accessibility (F5-HOMOLOGATION-CONTRACT.md).
}

/**
 * Camada de apresentação agnóstica do layout do documento.
 * Não possui dependência do Editor, não altera JSON original e obedece
 * estritamente à geometria provida pelo LayoutSnapshot.
 */
export interface DocumentPresentation {
    /** Consome o snapshot sem alterá-lo e atualiza a projeção visual no Host */
    render(snapshot: LayoutSnapshot): void;
    /** Limpa os recursos atuais projetados sem destruir a instância */
    clear(): void;
    /** Desanexa as estruturas visuais e previne novas renderizações */
    destroy(): void;
}

/**
 * Cria a camada Presentation no container Host especificado.
 * O Host deverá ser co-originário e co-escalado com as coordenadas do DocumentLayoutSpace,
 * geralmente compartilhando origem (0,0) com o conteúdo textual do editor.
 */
export function createDocumentPresentation(host: HTMLElement, _options?: DocumentPresentationOptions): DocumentPresentation {
    let destroyed = false;
    let container: HTMLElement | null = document.createElement('div');
    container.className = 'document-presentation-layer';
    container.setAttribute('aria-hidden', 'true'); // Exclusão do chrome puramente visual da ordem de tabulação
    host.appendChild(container);

    // Host should be co-originário and co-escalado.
    // In consumer code, the host typically shares coordinates with the editor content.

    return {
        render(snapshot: LayoutSnapshot): void {
            if (destroyed) {
                throw new Error("Cannot render: presentation instance has been destroyed.");
            }
            if (!container) return;

            // Clear previous projections
            this.clear();

            for (const page of snapshot.pages) {
                const sheet = document.createElement('div');
                sheet.className = 'document-presentation-sheet';
                // Use DocumentLayoutSpace geometry directly (no offsets or pageGap additions).
                sheet.style.top = `${page.sheetRect.top}px`;
                sheet.style.left = `${page.sheetRect.left}px`;
                sheet.style.width = `${page.sheetRect.width}px`;
                sheet.style.height = `${page.sheetRect.height}px`;

                const header = document.createElement('div');
                header.className = 'document-presentation-header';
                // Header rects are in document space natively per PageProjection
                header.style.top = `${page.headerRect.top}px`;
                header.style.left = `${page.headerRect.left}px`;
                header.style.width = `${page.headerRect.width}px`;
                header.style.height = `${page.headerRect.height}px`;

                const footer = document.createElement('div');
                footer.className = 'document-presentation-footer';
                // Footer rects are in document space natively
                footer.style.top = `${page.footerRect.top}px`;
                footer.style.left = `${page.footerRect.left}px`;
                footer.style.width = `${page.footerRect.width}px`;
                footer.style.height = `${page.footerRect.height}px`;

                // Running content mounting would go here. Awaiting frozen definitions.
                
                container.appendChild(sheet);
                container.appendChild(header);
                container.appendChild(footer);
            }
        },
        
        clear(): void {
            if (destroyed || !container) return;
            // Clean up resources cleanly.
            // When running content disposers exist, call them here.
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        },
        
        destroy(): void {
            if (destroyed) return;
            this.clear();
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
            container = null;
            destroyed = true;
        }
    };
}
