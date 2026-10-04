const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

function generateT60() {
  const rows = [];
  rows.push({
    type: 'tableRow',
    content: [
      { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H1' }] }] },
      { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H2' }] }] },
      { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H3' }] }] }
    ]
  });
  for (let i = 1; i <= 60; i++) {
    rows.push({
      type: 'tableRow',
      content: [
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Row ${i} Col 1` }] }] },
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Row ${i} Col 2` }] }] },
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Row ${i} Col 3` }] }] }
      ]
    });
  }
  return { type: 'doc', content: [{ type: 'table', content: rows }] };
}

(async () => {
  const { spawn } = require('child_process');
  const serverProcess = spawn('npm', ['run', 'preview'], {
      cwd: path.resolve(__dirname, '../../examples/vanilla-consumer'),
      stdio: 'pipe'
  });

  await new Promise((resolve, reject) => {
      serverProcess.stdout.on('data', (data) => {
          if (data.toString().includes('http://localhost:8543')) resolve();
      });
      serverProcess.stderr.on('data', (data) => console.error(`Server error: ${data}`));
      serverProcess.on('exit', (code) => {
          if (code !== 0 && code !== null) reject(new Error(`Server exited with code ${code}`));
      });
  });

  const browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1024'],
      defaultViewport: { width: 1280, height: 1024 }
  });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:8543/');
    await page.waitForSelector('.tiptap', {timeout: 10000});

    const T60 = generateT60();
    
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, T60);
    
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const check = () => {
          const snap = window.__appeLastSnapshot;
          if (snap) {
            window.__appeLastSnapshot = null;
            resolve(snap);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    });

    const screenshotsDir = '/home/jhonny/.gemini/antigravity-ide/brain/88a31939-ff9d-4894-a9ac-e5e1007395f2';

    // Helper to get PM selection
    const getPMSelection = async () => {
      return page.evaluate(() => {
        const sel = window.__appeEditor.state.selection;
        return { 
          from: sel.from, 
          to: sel.to, 
          empty: sel.empty, 
          type: sel.type ? sel.type : sel.constructor.name,
          content: window.__appeEditor.state.doc.textBetween(sel.from, sel.to, ' ') 
        };
      });
    };

    // S1: Seleção interna
    console.log(`--- S1: Seleção interna ---`);
    await page.evaluate(() => {
        window.__appeEditor.commands.setTextSelection({ from: 139, to: 142 });
    });
    let s1 = await getPMSelection();
    console.log(`S1 Selection: ${s1.from}-${s1.to}, empty: ${s1.empty}, content: ${s1.content}`);

    // S2: Seleção por teclado
    console.log(`--- S2: Seleção por teclado através da fronteira ---`);
    await page.evaluate(() => {
        window.__appeEditor.commands.setTextSelection({ from: 1507, to: 1516 });
    });
    let s2 = await getPMSelection();
    console.log(`S2 Selection: ${s2.from}-${s2.to}, empty: ${s2.empty}, content: ${s2.content}`);

    // S3: Arraste de mouse através da fronteira
    console.log(`--- S3: Arraste de mouse (Drag) ---`);
    
    const dragCoords = await page.evaluate(() => {
        // Encontrar as células ao redor do spacer
        const cells = Array.from(document.querySelectorAll('td p'));
        // Linha antes do spacer (prox 1507) e depois (prox 1516)
        // O spacer ocorre na quebra de página (entre as rows ~33-34)
        const cellStart = cells.find(c => c.textContent.includes('Row 33 Col 1'));
        const cellEnd = cells.find(c => c.textContent.includes('Row 34 Col 1'));
        if(!cellStart || !cellEnd) return null;
        
        cellStart.scrollIntoView({ block: 'center' });
        return new Promise(resolve => setTimeout(resolve, 500)).then(() => {
            const rect1 = cellStart.getBoundingClientRect();
            const rect2 = cellEnd.getBoundingClientRect();
            return {
                x1: rect1.left + rect1.width / 2, y1: rect1.top + rect1.height / 2,
                x2: rect2.left + rect2.width / 2, y2: rect2.top + rect2.height / 2
            };
        });
    });

    if (dragCoords) {
        let eventsLog3 = await page.evaluate((coords) => {
            const logs = [];
            const view = window.__appeEditor.view;
            
            function simulateMouse(type, x, y) {
                const el = document.elementFromPoint(x, y);
                const ev = new MouseEvent(type, {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    buttons: type === 'mouseup' ? 0 : 1
                });
                el.dispatchEvent(ev);
                
                const pos = view.posAtCoords({left: x, top: y});
                const sel = view.state.selection;
                logs.push(`[${type}] target: ${el ? el.tagName + '.' + el.className : 'null'}, text: ${el ? el.textContent?.substring(0, 10) : ''}, posAtCoords: ${pos ? pos.pos : 'null'}, pm_sel: ${sel.constructor.name}(${sel.from}-${sel.to})`);
            }
            
            simulateMouse('mousedown', coords.x1, coords.y1);
            
            // Move partially into spacer
            const midY = (coords.y1 + coords.y2) / 2;
            simulateMouse('mousemove', coords.x1, midY);
            
            // Move to end
            simulateMouse('mousemove', coords.x2, coords.y2);
            
            simulateMouse('mouseup', coords.x2, coords.y2);
            
            return logs;
        }, dragCoords);
        
        console.log("S3 Events Log:\n" + eventsLog3.join('\n'));
        await page.screenshot({ path: path.join(screenshotsDir, 'uat001-s3.png') });
        
        let s3 = await page.evaluate(() => {
            const sel = window.__appeEditor.state.selection;
            return { from: sel.from, to: sel.to, empty: sel.empty, className: sel.constructor.name, isCellSelection: !!sel.isCellSelection, content: window.__appeEditor.state.doc.textBetween(sel.from, sel.to, ' ') };
        });
        console.log(`S3 PM Selection: ${s3.from}-${s3.to}, type: ${s3.className}, isCellSelection: ${s3.isCellSelection}, empty: ${s3.empty}, content: ${s3.content}`);
        
        const nativeSel = await page.evaluate(() => {
            const sel = window.getSelection();
            return { rangeCount: sel.rangeCount, isCollapsed: sel.isCollapsed, text: sel.toString() };
        });
        console.log(`S3 Native Selection: rangeCount=${nativeSel.rangeCount}, isCollapsed=${nativeSel.isCollapsed}, text="${nativeSel.text}"`);
        
        // Se isCollapsed for verdadeiro quando arrastou texto real, S3 falhou.
        if (s3.empty) {
            console.log('STATUS: RED (S3 Failed - Selection empty across spacer)');
        }
    } else {
        console.log('STATUS: BLOCKED (Could not find rows)');
    }

    // S4: Forçar CellSelection
    console.log(`--- S4: Forçar CellSelection ---`);
    await page.evaluate(() => {
        const { CellSelection } = window.__appeEditor.extensionManager.extensions.find(e => e.name === 'table').options.View || {};
        // Not easily available... let's just log the class name of the current selection.
    });

    // S5: Arraste de mouse (Drag) NORMAL (sem spacer)
    console.log(`--- S5: Arraste de mouse NORMAL (sem spacer) ---`);
    const dragCoords2 = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('td p'));
        const cellStart = cells.find(c => c.textContent.includes('Row 2 Col 1'));
        const cellEnd = cells.find(c => c.textContent.includes('Row 3 Col 1')); // same col
        if(!cellStart || !cellEnd) return null;
        
        cellStart.scrollIntoView({ block: 'center' });
        return new Promise(resolve => setTimeout(resolve, 500)).then(() => {
            const rect1 = cellStart.getBoundingClientRect();
            const rect2 = cellEnd.getBoundingClientRect();
            return {
                x1: rect1.left + rect1.width / 2, y1: rect1.top + rect1.height / 2,
                x2: rect2.left + rect2.width / 2, y2: rect2.top + rect2.height / 2
            };
        });
    });

    if (dragCoords2) {
        let eventsLog = await page.evaluate((coords) => {
            const logs = [];
            const el1 = document.elementFromPoint(coords.x1, coords.y1);
            const el2 = document.elementFromPoint(coords.x2, coords.y2);
            
            const view = window.__appeEditor.view;
            
            function simulateMouse(type, x, y) {
                const el = document.elementFromPoint(x, y);
                const ev = new MouseEvent(type, {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    buttons: type === 'mouseup' ? 0 : 1
                });
                el.dispatchEvent(ev);
                
                const pos = view.posAtCoords({left: x, top: y});
                const sel = view.state.selection;
                logs.push(`[${type}] target: ${el.tagName}.${el.className}, text: ${el.textContent?.substring(0, 10)}, posAtCoords: ${pos ? pos.pos : 'null'}, pm_sel: ${sel.constructor.name}(${sel.from}-${sel.to})`);
            }
            
            simulateMouse('mousedown', coords.x1, coords.y1);
            
            // Move partially
            simulateMouse('mousemove', coords.x1, coords.y1 + 10);
            
            // Move to end
            simulateMouse('mousemove', coords.x2, coords.y2);
            
            simulateMouse('mouseup', coords.x2, coords.y2);
            
            return logs;
        }, dragCoords2);
        
        console.log("S5 Events Log:\n" + eventsLog.join('\n'));

        let s5 = await page.evaluate(() => {
            const sel = window.__appeEditor.state.selection;
            return { from: sel.from, to: sel.to, empty: sel.empty, className: sel.constructor.name, isCellSelection: !!sel.isCellSelection, content: window.__appeEditor.state.doc.textBetween(sel.from, sel.to, ' ') };
        });
        console.log(`S5 PM Selection: ${s5.from}-${s5.to}, type: ${s5.className}, isCellSelection: ${s5.isCellSelection}, empty: ${s5.empty}, content: ${s5.content}`);
        
        const nativeSel = await page.evaluate(() => {
            const sel = window.getSelection();
            return { rangeCount: sel.rangeCount, isCollapsed: sel.isCollapsed, text: sel.toString() };
        });
        console.log(`S5 Native Selection: rangeCount=${nativeSel.rangeCount}, isCollapsed=${nativeSel.isCollapsed}, text="${nativeSel.text}"`);
    }

  } catch (err) {
    console.error('Error during script:', err);
    process.exit(1);
  } finally {
    await browser.close();
    if (serverProcess) serverProcess.kill();
    process.exit(0);
  }
})();
