import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension } from '../../src/extension';
import { PaginationController } from '../../src/controller';

describe('Reatividade após alterações estruturais (Etapa 1)', () => {
    let container: HTMLElement;
    let editor: Editor | null = null;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);
    });

    afterEach(() => {
        editor?.destroy();
        container.remove();
        vi.restoreAllMocks();
    });

    it('recalcula a paginação quando o tipo de nó muda mesmo sem alteração em doc.content.size', async () => {
        const text = 'Texto para teste de mutação de bloco.';
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: 'composed'
                })
            ],
            content: `<pre><code>${text}</code></pre>`
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        expect(controller).toBeDefined();

        const scheduleSpy = vi.spyOn(controller, 'scheduleRender');

        const initialDoc = editor.state.doc;
        expect(initialDoc.firstChild?.type.name).toBe('codeBlock');
        const initialSize = initialDoc.content.size;

        // Converter codeBlock para paragraph preservando exatamente o mesmo texto (tamanho idêntico)
        editor.chain().focus().setParagraph().run();

        const newDoc = editor.state.doc;
        expect(newDoc.firstChild?.type.name).toBe('paragraph');
        expect(newDoc.content.size).toBe(initialSize);
        expect(newDoc.eq(initialDoc)).toBe(false);

        // scheduleRender deve ter sido acionado mesmo com content.size idêntico
        expect(scheduleSpy).toHaveBeenCalled();
    });

    it('não agenda recálculo desnecessário quando ocorre apenas mudança de seleção', () => {
        const text = 'Texto longo para teste de seleção.';
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: 'composed'
                })
            ],
            content: `<p>${text}</p>`
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const scheduleSpy = vi.spyOn(controller, 'scheduleRender');
        scheduleSpy.mockClear();

        // Mudar seleção do cursor sem alterar o documento
        editor.commands.setTextSelection({ from: 1, to: 5 });
        expect(scheduleSpy).not.toHaveBeenCalled();

        editor.commands.setTextSelection({ from: 10, to: 10 });
        expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it('preserva o tratamento de paginationSettingsChanged', () => {
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: 'composed'
                })
            ],
            content: '<p>Texto simples.</p>'
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const scheduleSpy = vi.spyOn(controller, 'scheduleRender');
        scheduleSpy.mockClear();

        // Disparar transação com meta paginationSettingsChanged
        editor.view.dispatch(editor.state.tr.setMeta('paginationSettingsChanged', true));

        expect(scheduleSpy).toHaveBeenCalled();
    });
});
