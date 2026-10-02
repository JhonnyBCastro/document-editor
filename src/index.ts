import './style.css';
import { Editor } from '@tiptap/core';
import { PaginationController } from './controller';

export * from './types';
export * from './extension';
export { preparePrintSession, type PrintSession } from './print';

export async function whenLayoutStable(editor: Editor): Promise<import('./types').LayoutSnapshot> {
    const controller = (editor.storage as any).pagination?.controller as PaginationController | null;
    if (!controller) {
        throw new Error("PaginationExtension not found or not initialized.");
    }
    return controller.whenLayoutStable();
}

