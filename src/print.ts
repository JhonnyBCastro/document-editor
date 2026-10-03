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
    
    let originalLayout: any = null;
    let hadPrintMode = false;
    let controller: PaginationController | null = null;
    let isRestored = false;
    
    try {
        controller = (editor.storage as any).pagination?.controller as PaginationController | null;
        if (!controller) {
            throw new Error("PaginationExtension not found or not initialized.");
        }

        originalLayout = JSON.parse(JSON.stringify(controller.getLayout()));
        
        // Verifica se a classe print-mode já existia no body antes da sessão
        hadPrintMode = document.body.classList.contains('print-mode');
        if (!hadPrintMode) {
            document.body.classList.add('print-mode');
        }
        
        const printLayout = JSON.parse(JSON.stringify(originalLayout));
        printLayout.page.pageGap = 0;
        
        controller.setLayout(printLayout);
        
        const snapshot = await controller.whenLayoutStable();
        
        return {
            snapshot,
            restore: async () => {
                if (isRestored) return; // idempotency
                isRestored = true;
                
                if (!hadPrintMode) {
                    document.body.classList.remove('print-mode');
                }
                
                if (controller) {
                    controller.setLayout(originalLayout);
                    // It's safe to await whenLayoutStable only if editor is not destroyed. 
                    // However, we shouldn't throw in restore if it is destroyed.
                    try {
                        await controller.whenLayoutStable();
                    } catch (e) {
                        console.warn("Could not stabilize layout during restore:", e);
                    }
                }
                
                isPreparingPrint = false;
            }
        };
    } catch (e) {
        // Safe rollback of side effects if preparation fails
        if (!hadPrintMode) {
            document.body.classList.remove('print-mode');
        }
        if (controller && originalLayout) {
            controller.setLayout(originalLayout);
        }
        isPreparingPrint = false;
        throw e;
    }
}
