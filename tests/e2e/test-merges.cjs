const puppeteer = require('puppeteer');
const path = require('path');

async function run() {

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto('http://localhost:8543/');
    await page.waitForSelector('.tiptap');
    
    // Test Colspan
    console.log('--- Testing Colspan ---');
    const docColspan = {
        type: 'doc',
        content: [
            { type: 'table', content: [] }
        ]
    };
    for (let i = 1; i <= 30; i++) {
        let content = [];
        if (i === 20) {
            content.push({ type: 'tableCell', attrs: { colspan: 3, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Colspan Row' }] }] });
        } else {
            content.push({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${i} C1` }] }] });
            content.push({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${i} C2` }] }] });
            content.push({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${i} C3` }] }] });
        }
        docColspan.content[0].content.push({ type: 'tableRow', content });
    }
    await page.evaluate((json) => window.__appeEditor.commands.setContent(json), docColspan);
    await new Promise(r => setTimeout(r, 500));
    const pagesColspan = await page.evaluate(() => document.querySelectorAll('.page-break-row').length);
    console.log(`Colspan breaks: ${pagesColspan}`);

    // Test Rowspan
    console.log('--- Testing Rowspan ---');
    const docRowspan = {
        type: 'doc',
        content: [
            { type: 'table', content: [] }
        ]
    };
    for (let i = 1; i <= 25; i++) {
        let content = [];
        if (i === 15) {
            content.push({ type: 'tableCell', attrs: { colspan: 1, rowspan: 5, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rowspan 5' }] }] });
            content.push({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${i} C2` }] }] });
        } else if (i > 15 && i < 20) {
            content.push({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${i} C2` }] }] });
        } else {
            content.push({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${i} C1` }] }] });
            content.push({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${i} C2` }] }] });
        }
        docRowspan.content[0].content.push({ type: 'tableRow', content });
    }
    await page.evaluate((json) => window.__appeEditor.commands.setContent(json), docRowspan);
    await new Promise(r => setTimeout(r, 500));
    const pagesRowspan = await page.evaluate(() => document.querySelectorAll('.page-break-row').length);
    console.log(`Rowspan breaks: ${pagesRowspan}`);
    
    // Check if rowspan broke rendering
    const validRowspan = await page.evaluate(() => {
        const gap = document.querySelector('.page-break-row');
        return gap ? gap.style.getPropertyValue('--page-break-gap') !== '' : true;
    });
    console.log(`Rowspan rendering intact: ${validRowspan}`);

    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(__dirname, 'colspan-rowspan.png') });
    await browser.close();
}
run().catch(console.error);
