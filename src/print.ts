// src/pagination/print.ts
import { Editor } from '@tiptap/core';
import { LayoutSnapshot } from './types';
import { PaginationController } from './controller';

export interface PrintSession {
    snapshot: LayoutSnapshot;
    restore: () => Promise<void>;
}

let isPreparingPrint = false;

export async function preparePrintSession(editor: Editor): Promise<PrintSession> {
    if (isPreparingPrint) {
        throw new Error("A print session is already active or being prepared.");
    }
    
    isPreparingPrint = true;
    try {
        const controller = (editor.storage as any).pagination?.controller as PaginationController | null;
        if (!controller) {
            throw new Error("PaginationExtension not found or not initialized.");
        }

        const originalLayout = JSON.parse(JSON.stringify(controller.getLayout()));
        
        // Configura o layout de impressão (pageGap: 0)
        const printLayout = JSON.parse(JSON.stringify(originalLayout));
        printLayout.page.pageGap = 0;
        
        // Adiciona classe no body
        document.body.classList.add('print-mode');
        
        // Inicia o reflow com o novo layout
        controller.setLayout(printLayout);
        
        // Aguarda o controlador terminar de calcular e estabilizar o DOM
        const snapshot = await controller.whenLayoutStable();
        
        return {
            snapshot,
            restore: async () => {
                document.body.classList.remove('print-mode');
                controller.setLayout(originalLayout);
                await controller.whenLayoutStable();
                isPreparingPrint = false;
            }
        };
    } catch (e) {
        isPreparingPrint = false;
        throw e;
    }
}
