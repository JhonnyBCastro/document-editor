const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

(async () => {
    let serverProcess = spawn('npm', ['run', 'dev'], { cwd: '/home/jhonny/TCC/document-editor', shell: true });
    await new Promise((resolve) => {
        serverProcess.stdout.on('data', (data) => {
            if (data.toString().includes('http://localhost:8543')) resolve();
        });
    });
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto('http://localhost:8543/');
    await page.waitForSelector('.tiptap table');
    
    const coords = await page.evaluate(() => {
        const trs = Array.from(document.querySelectorAll('tr'));
        const tr1 = trs[32]; // Row 33
        const tr2 = trs[33]; // Row 34
        if (!tr1 || !tr2) return null;
        tr1.scrollIntoView();
        const rect1 = tr1.children[0].getBoundingClientRect();
        const rect2 = tr2.children[0].getBoundingClientRect();
        return {
            x1: rect1.left + 20, y1: rect1.top + 20,
            x2: rect2.left + 20, y2: rect2.top + 20
        };
    });
    
    await page.mouse.move(coords.x1, coords.y1);
    await page.mouse.down();
    await page.mouse.move(coords.x2, coords.y2, { steps: 50 });
    await page.mouse.up();
    
    let sel = await page.evaluate(() => {
        const sel = window.__appeEditor.state.selection;
        return { type: sel.constructor.name, empty: sel.empty, isCellSelection: !!sel.isCellSelection };
    });
    console.log("Drag result:", sel);
    
    await browser.close();
    serverProcess.kill();
})();
