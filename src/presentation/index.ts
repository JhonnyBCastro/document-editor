import type { LayoutSnapshot, PageProjection } from '../types';

import './presentation.css';

export type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export interface RunningContentContext {
    readonly pageIndex: number;
    readonly totalPages: number;
    readonly region: 'header' | 'footer';
    readonly rect: DeepReadonly<PageProjection['headerRect']>;
    readonly pageProjection: DeepReadonly<PageProjection>;
}

export type Disposer = () => void;

/**
 * Opções para inicialização da Presentation V1.
 * 
 * Contrato de Running Content (V1):
 * - É visual-only, estritamente de leitura e não interativo.
 * - Os callbacks NÃO podem injetar elementos focáveis/tabuláveis.
 * - Os callbacks NÃO podem alterar a geometria original do mountPoint (padding, margens que estourem o box).
 * - O conteúdo injetado deve ser projetado visualmente embaixo do conteúdo semântico do editor pelo consumidor.
 */
export interface DocumentPresentationOptions {
    renderHeader?: (context: RunningContentContext, mountPoint: HTMLElement) => void | Disposer;
    renderFooter?: (context: RunningContentContext, mountPoint: HTMLElement) => void | Disposer;
}

/**
 * Camada de apresentação agnóstica do layout do documento.
 * Não possui dependência do Editor, não altera o JSON original e obedece
 * estritamente à geometria provida pelo LayoutSnapshot.
 * 
 * - Render após destroy: Lança exceção. Uma instância destruída não pode ser reutilizada.
 * - Idempotência do destroy: Chamadas múltiplas a destroy() são seguras e ignoradas silenciosamente.
 * - Clear após destroy: Operação sem efeito.
 */
export interface DocumentPresentation {
    /** Consome o snapshot sem alterá-lo e atualiza a projeção visual no Host */
    render(snapshot: LayoutSnapshot): void;
    /** Limpa os recursos atuais projetados sem destruir a instância */
    clear(): void;
    /** Desanexa as estruturas visuais e previne novas renderizações. (Idempotente) */
    destroy(): void;
}

/**
 * Cria a camada Presentation no container Host especificado.
 * O Host deverá ser co-originário e co-escalado com as coordenadas do DocumentLayoutSpace.
 * Todos os elementos (sheet, header, footer) compartilham o mesmo espaço de coordenadas,
 * cujos eixos crescem para a direita (X) e para baixo (Y).
 */
export function createDocumentPresentation(host: HTMLElement, options?: DocumentPresentationOptions): DocumentPresentation {
    let destroyed = false;
    let container: HTMLElement | null = document.createElement('div');
    container.className = 'document-presentation-layer';
    container.setAttribute('data-document-editor-presentation', '');
    
    // aria-hidden="true" oculta a árvore das tecnologias assistivas (leitores de tela).
    // A ocultação semântica não impede a tabulação por si só; é obrigação estrita do
    // contrato do renderer (consumidor) não inserir controles interativos ou tabuláveis,
    // garantindo a ausência de foco indevido sob o conteúdo ativo.
    container.setAttribute('aria-hidden', 'true');
    host.appendChild(container);

    let activeDisposers: Disposer[] = [];
    let isDisposing = false;

    const disposeAll = () => {
        if (isDisposing) return;
        isDisposing = true;
        const toDispose = activeDisposers;
        activeDisposers = [];
        for (const dispose of toDispose) {
            try {
                dispose();
            } catch (e) {
                console.error("DocumentPresentation: error executing disposer", e);
            }
        }
        isDisposing = false;
    };

    const clonePageProjection = (page: PageProjection): PageProjection => ({
        index: page.index,
        sheetRect: { ...page.sheetRect },
        headerRect: { ...page.headerRect },
        footerRect: { ...page.footerRect }
    });

    return {
        render(snapshot: LayoutSnapshot) {
            if (destroyed) {
                throw new Error("Cannot render: presentation instance has been destroyed.");
            }
            if (!container || isDisposing) {
                throw new Error("Cannot render: presentation is currently disposing resources.");
            }
            
            disposeAll();
            container.innerHTML = '';

            const totalPages = snapshot.pages.length;

            snapshot.pages.forEach((page, index) => {
                const sheet = document.createElement('div');
                sheet.className = 'document-presentation-sheet';
                sheet.setAttribute('data-page-surface', '');
                sheet.setAttribute('data-page-index', index.toString()); // zero-based
                sheet.style.top = `${page.sheetRect.top}px`;
                sheet.style.left = `${page.sheetRect.left}px`;
                sheet.style.width = `${page.sheetRect.width}px`;
                sheet.style.height = `${page.sheetRect.height}px`;
                container!.appendChild(sheet);

                if (options?.renderHeader) {
                    const header = document.createElement('div');
                    header.className = 'document-presentation-header';
                    header.setAttribute('data-region', 'header');
                    header.setAttribute('data-page-index', index.toString());
                    header.style.top = `${page.headerRect.top}px`;
                    header.style.left = `${page.headerRect.left}px`;
                    header.style.width = `${page.headerRect.width}px`;
                    header.style.height = `${page.headerRect.height}px`;
                    container!.appendChild(header);

                    const context: RunningContentContext = {
                        pageIndex: index,
                        totalPages,
                        region: 'header',
                        rect: { ...page.headerRect },
                        pageProjection: clonePageProjection(page)
                    };
                    const disposer = options.renderHeader(context, header);
                    if (typeof disposer === 'function') activeDisposers.push(disposer);
                }

                if (options?.renderFooter) {
                    const footer = document.createElement('div');
                    footer.className = 'document-presentation-footer';
                    footer.setAttribute('data-region', 'footer');
                    footer.setAttribute('data-page-index', index.toString());
                    footer.style.top = `${page.footerRect.top}px`;
                    footer.style.left = `${page.footerRect.left}px`;
                    footer.style.width = `${page.footerRect.width}px`;
                    footer.style.height = `${page.footerRect.height}px`;
                    container!.appendChild(footer);

                    const context: RunningContentContext = {
                        pageIndex: index,
                        totalPages,
                        region: 'footer',
                        rect: { ...page.footerRect },
                        pageProjection: clonePageProjection(page)
                    };
                    const disposer = options.renderFooter(context, footer);
                    if (typeof disposer === 'function') activeDisposers.push(disposer);
                }
            });
        },
        clear() {
            if (destroyed || isDisposing) return;
            disposeAll();
            container!.innerHTML = '';
        },
        destroy() {
            if (destroyed || isDisposing) return;
            destroyed = true;
            try {
                disposeAll();
            } finally {
                if (container && container.parentNode) {
                    container.parentNode.removeChild(container);
                }
                container = null;
            }
        }
    };
}
