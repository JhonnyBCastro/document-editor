const puppeteer = require('puppeteer');
const path = require('path');
const { spawn } = require('child_process');

(async () => {
    let serverProcess;
    let browser;
    
    try {
        serverProcess = spawn('npm', ['run', 'dev', '--', '--force'], {
            cwd: path.resolve(__dirname, '../../examples/vanilla-consumer'),
            stdio: 'pipe'
        });

        await new Promise((resolve, reject) => {
            serverProcess.stdout.on('data', (data) => {
                if (data.toString().includes('http://localhost:8543')) resolve();
            });
            serverProcess.stderr.on('data', (data) => {
                console.error(`Server error: ${data}`);
            });
        });

        browser = await puppeteer.launch({ 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1024'] 
        });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

        await page.goto('http://localhost:8543/');
        await page.waitForSelector('.tiptap', {timeout: 10000});
        
        await page.evaluate(() => {
            window.waitStabilization = function() {
                return new Promise(resolve => {
                    if (window.__appeLastSnapshot) {
                        const snap = window.__appeLastSnapshot;
                        window.__appeLastSnapshot = null;
                        resolve(snap);
                        return;
                    }
                    const check = setInterval(() => {
                        if (window.__appeLastSnapshot) {
                            clearInterval(check);
                            const snap = window.__appeLastSnapshot;
                            window.__appeLastSnapshot = null;
                            resolve(snap);
                        }
                    }, 50);
                });
            }
        });

        // Esperar a fixture inicial estabilizar
        await page.evaluate(() => window.waitStabilization());

        // Test 1: PageBreak manual isolado
        await page.evaluate(() => {
            window.__appeLastSnapshot = null;
            window.__appeEditor.commands.setContent('<p>P1</p><div class="page-break"></div><p>P2</p>');
            console.log("JSON PARSADO:", JSON.stringify(window.__appeEditor.getJSON()));
        });
        
        let snap = await page.evaluate(() => window.waitStabilization());
        
        const manualBreaks = snap.breaks.filter(b => b.origin === 'manual');
        if (manualBreaks.length !== 1 || snap.pages.length !== 2) {
            console.log("SNAPSHOT RETURNED:", JSON.stringify(snap));
            throw new Error(`Test 1 Failed: Expected 1 manual break and 2 pages, got ${manualBreaks.length} breaks and ${snap.pages.length} pages.`);
        }
        console.log('✓ Test 1: PageBreak manual isolado -> Passou');

        // Test 2: Coincidência entre manual e automática (Injetando quebras seguidas)
        await page.evaluate(() => {
            window.__appeLastSnapshot = null;
            window.__appeEditor.commands.setContent('<p>P1</p><div class="page-break"></div><div class="page-break"></div><p>P2</p>');
        });
        
        snap = await page.evaluate(() => window.waitStabilization());
        
        const manualBreaks2 = snap.breaks.filter(b => b.origin === 'manual');
        if (manualBreaks2.length !== 2 || snap.pages.length !== 3) {
            throw new Error(`Test 2 Failed: Expected 2 manual breaks and 3 pages, got ${manualBreaks2.length} breaks and ${snap.pages.length} pages.`);
        }
        console.log('✓ Test 2: PageBreaks consecutivos -> Passou');

        // Test 3: Quebra no início do documento
        await page.evaluate(() => {
            window.__appeLastSnapshot = null;
            window.__appeEditor.commands.setContent('<div class="page-break"></div><p>P2</p>');
            const doc = window.__appeEditor.state.doc;
            const manualBreaks = [];
            doc.descendants((node, p) => {
                if (node.type.name === 'pageBreak') manualBreaks.push(p);
            });
        });
        snap = await page.evaluate(() => window.waitStabilization());
        const manualBreaks3 = snap.breaks.filter(b => b.origin === 'manual');
        if (manualBreaks3.length !== 1 || snap.pages.length !== 2) {
            throw new Error(`Test 3 Failed: Expected 1 manual break and 2 pages, got ${manualBreaks3.length} breaks and ${snap.pages.length} pages.`);
        }
        console.log('✓ Test 3: PageBreak no inicio -> Passou');

        console.log('\n--- TODOS OS TESTES HÍBRIDOS PASSARAM ---');

    } catch (err) {
        console.error('Test Failed:', err);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        if (serverProcess) serverProcess.kill();
    }
})();
