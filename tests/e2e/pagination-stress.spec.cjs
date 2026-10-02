const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const peS = require('../fixtures/PE-S.json');
const peM = require('../fixtures/PE-M.json');
const peL = require('../fixtures/PE-L.json');

const results = {
    'PE-S': {},
    'PE-M': {},
    'PE-L': {},
    'PE-L-Edit': {},
    'Rollback': {}
};

async function waitStabilization(page) {
    return page.evaluate(() => {
        return new Promise((resolve) => {
            const check = () => {
                const snap = window.__appeLastSnapshot;
                if (snap) {
                    resolve(snap);
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    });
}

(async () => {
  const { spawn } = require('child_process');
  
  // 1. Iniciar o servidor
  const serverProcess = spawn('npm', ['run', 'preview'], {
      cwd: path.resolve(__dirname, '../../examples/vanilla-consumer'),
      stdio: 'pipe'
  });

  await new Promise((resolve, reject) => {
      serverProcess.stdout.on('data', (data) => {
          if (data.toString().includes('http://localhost:8543')) {
              resolve();
          }
      });
      serverProcess.stderr.on('data', (data) => {
          console.error(`Server error: ${data}`);
      });
      serverProcess.on('exit', (code) => {
          if (code !== 0 && code !== null) {
              reject(new Error(`Server exited with code ${code}`));
          }
      });
  });

  const browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1024'],
      defaultViewport: { width: 1280, height: 1024 }
  });
  const page = await browser.newPage();
  
  try {
    // 3. Abrir a página correta
    await page.goto('http://localhost:8543/');
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err));
    
    await page.waitForSelector('.tiptap', {timeout: 10000});
    
    // Funções de Teste injetadas no contexto
    await page.exposeFunction('logMessage', msg => console.log(msg));

    async function runTest(fixtureName, fixtureData) {
        console.log(`\n--- Testando ${fixtureName} ---`);
        
        // Limpar snapshot anterior
        await page.evaluate(() => { window.__appeLastSnapshot = null; });
        
        const startTime = Date.now();
        // Carregar JSON
        await page.evaluate((json) => {
            window.__appeEditor.commands.setContent(json);
        }, fixtureData);
        
        // Aguardar estabilização
        const snapshot = await waitStabilization(page);
        const duration = Date.now() - startTime;
        
        console.log(`Estabilizado em ${duration}ms. Páginas: ${snapshot.pages.length}, Auto: ${snapshot.breaks.filter(b=>b.origin!=='manual').length}`);
        
        // Extrair o DOM para geometria
        const geom = await page.evaluate(() => {
            const wrappers = document.querySelectorAll('#chrome-layer .page-chrome-header');
            const chromePagesCount = wrappers.length; // because we render headers instead of pages directly
            const totalDecorations = window.__appeEditor.state.doc.content.size; // Just a proxy for size
            return {
               chromeHeaders: chromePagesCount
            };
        });
        
        // Capturar JSON pós estabilização (Etapa N: Integridade)
        const postJson = await page.evaluate(() => window.__appeEditor.getJSON());
        
        // Verificação profunda para PE-L
        let tableCheck = {};
        if (fixtureName === 'PE-L') {
            tableCheck = await page.evaluate(() => {
                const tables = document.querySelectorAll('table');
                if (tables.length < 3) return { ok: false, error: 'Tabelas ausentes' };
                const bigTable = tables[tables.length - 2];
                const rows = bigTable.querySelectorAll('tr:not(.virtual-page-spacer)');
                const spacers = bigTable.querySelectorAll('tr.virtual-page-spacer');
                return {
                    ok: true,
                    dataRows: rows.length,
                    spacers: spacers.length
                };
            });
            console.log(`PE-L Table Check: DataRows=${tableCheck.dataRows}, Spacers=${tableCheck.spacers}`);
        }
        
        // Verificar diferença JSON
        // Na teoria, semântica deve ser idêntica. Como adicionamos marks, alguns podem mudar.
        // Vamos checar pelo menos os tamanhos.
        const originalString = JSON.stringify(fixtureData);
        const postString = JSON.stringify(postJson);
        const sizeDiff = postString.length - originalString.length;
        console.log(`JSON Length: Original=${originalString.length}, Pós=${postString.length}, Diff=${sizeDiff}`);

        results[fixtureName] = {
            duration,
            pages: snapshot.pages.length,
            autoBreaks: snapshot.breaks.filter(b => b.origin !== 'manual').length,
            manualBreaks: snapshot.breaks.filter(b => b.origin === 'manual').length,
            diagnostics: snapshot.diagnostics,
            geom,
            tableCheck,
            semanticDiff: sizeDiff
        };
        fs.writeFileSync('stress-test-results.json', JSON.stringify(results, null, 2));
    }
    
    await runTest('PE-S', peS);
    await runTest('PE-M', peM);
    await runTest('PE-L', peL);
    
    /*
    console.log(`\n--- Testando PE-L Edit (Etapa N / L) ---`);
    await page.evaluate(() => { window.__appeLastSnapshot = null; });
    
    // Inserir texto
    await page.focus('.tiptap');
    await page.keyboard.press('End');
    await page.keyboard.type(' TESTE DE INSERCAO MANUAL ');
    await new Promise(r => setTimeout(r, 500));
    const snapEdit = await waitStabilization(page);
    
    // Undo
    await page.evaluate(() => window.__appeEditor.commands.undo());
    await new Promise(r => setTimeout(r, 500));
    const snapUndo = await waitStabilization(page);
    
    const finalJson = await page.evaluate(() => window.__appeEditor.getJSON());
    results['PE-L-Edit'] = {
        editPages: snapEdit.pages.length,
        undoPages: snapUndo.pages.length,
        finalJsonSize: JSON.stringify(finalJson).length
    };
    */
    
    console.log(`\n--- Testando Rollback (Etapa P) ---`);
    const rollbackResult = await page.evaluate(() => {
        try {
            const currentJson = window.__appeEditor.getJSON();
            window.__appeEditor.destroy();
            
            // Ver se sobrou algo
            const domClear = document.querySelector('.tiptap') === null;
            
            return {
                success: true,
                domCleared: domClear,
                jsonSizeSaved: JSON.stringify(currentJson).length
            };
        } catch(e) {
            return { success: false, error: e.message };
        }
    });
    
    results['Rollback'] = rollbackResult;
    console.log(`Rollback: ${rollbackResult.success ? 'Success' : 'Fail'}`);
    
    fs.writeFileSync('stress-test-results.json', JSON.stringify(results, null, 2));
    console.log('\nResultados salvos em stress-test-results.json');
    
  } catch (err) {
    console.error('Error during script:', err);
  } finally {
    await browser.close();
    if (serverProcess) {
        serverProcess.kill();
    }
  }
})();
