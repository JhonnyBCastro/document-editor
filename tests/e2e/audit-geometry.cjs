const puppeteer = require('puppeteer');
const path = require('path');

async function run() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto('http://localhost:8543/');
    await page.waitForSelector('.tiptap');

    // T60 geometric closure
    console.log('--- T60 Geometric Audit ---');
    const T60 = { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H1' }] }] }] }] }] };
    for(let i=1; i<=60; i++) {
        T60.content[0].content.push({ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${i}` }] }] }] });
    }
    
    await page.evaluate((json) => window.__appeEditor.commands.setContent(json), T60);
    await new Promise(r => setTimeout(r, 1000));
    
    const geom = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr');
        // gap between Row 16 and Row 17 (index 16 and 17)
        const trPrev = rows[16];
        const trGap = rows[17];
        
        const rectPrev = trPrev.getBoundingClientRect();
        const rectGap = trGap.getBoundingClientRect();
        const styleGap = window.getComputedStyle(trGap.querySelector('td'));
        
        const pPrev = trPrev.querySelector('p');
        const pGap = trGap.querySelector('p');
        const rectPrevText = pPrev.getBoundingClientRect();
        const rectGapText = pGap.getBoundingClientRect();
        
        return {
            prevTextBottom: rectPrevText.bottom,
            gapTextTop: rectGapText.top,
            gapPaddingTop: styleGap.paddingTop,
            gapVar: trGap.style.getPropertyValue('--page-break-gap'),
            distanceBetweenTexts: rectGapText.top - rectPrevText.bottom
        };
    });
    console.log('T60 Geometry:', geom);

    // S3 drag elementFromPoint
    console.log('--- S3 Drag Audit ---');
    const dragLogs = await page.evaluate(() => {
        const logs = [];
        const rows = document.querySelectorAll('tr');
        const trPrev = rows[16];
        const trGap = rows[17];
        
        trPrev.scrollIntoView({ block: 'start' });
        
        const rect1 = trPrev.getBoundingClientRect();
        const rect2 = trGap.getBoundingClientRect();
        
        const x = rect1.left + 5;
        const y1 = rect1.top + 5;
        const y2 = rect2.top + 5;
        
        const midY = (y1 + y2) / 2;
        
        const el1 = document.elementFromPoint(x, y1);
        const elMid = document.elementFromPoint(x, midY);
        const el2 = document.elementFromPoint(x, y2);
        
        logs.push({ y: y1, el: el1 ? el1.tagName : 'null' });
        logs.push({ y: midY, el: elMid ? elMid.tagName : 'null' });
        logs.push({ y: y2, el: el2 ? el2.tagName : 'null' });
        return logs;
    });
    console.log('Drag elementFromPoint:', dragLogs);

    await browser.close();
}
run().catch(console.error);
