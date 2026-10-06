const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function run() {
    const browser = await puppeteer.launch({ 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1024'],
        defaultViewport: { width: 1280, height: 1024 }
    });
    
    // Test 1: T60 Table Gap Visibility
    const page1 = await browser.newPage();
    await page1.goto('http://localhost:8543/');
    await page1.waitForSelector('.tiptap');
    
    const T60 = { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H1' }] }] }] }] }] };
    for(let i=1; i<=60; i++) {
        T60.content[0].content.push({ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Data ${i}.x` }] }] }] });
    }
    await page1.evaluate((json) => window.__appeEditor.commands.setContent(json), T60);
    await new Promise(r => setTimeout(r, 1000));
    
    const tableGapInfo = await page1.evaluate(() => {
        const rows = document.querySelectorAll('tr');
        const gapRow = rows[35]; // Approximation for a gap
        const style = window.getComputedStyle(gapRow.querySelector('td'));
        
        let targetRow = null;
        for(const r of rows) {
            if(r.querySelector('td') && window.getComputedStyle(r.querySelector('td')).paddingTop.includes('260px')) {
                targetRow = r;
                break;
            }
            // Or look for height > 100
            if (r.getBoundingClientRect().height > 100 && r.innerText.includes('Data 36.x')) {
                targetRow = r;
            }
        }
        if (!targetRow) return { error: "No gap found" };
        
        const td = targetRow.querySelector('td');
        const tdStyle = window.getComputedStyle(td);
        const rect = td.getBoundingClientRect();
        
        return {
            paddingTop: tdStyle.paddingTop,
            backgroundColor: tdStyle.backgroundColor,
            tableBg: window.getComputedStyle(targetRow.closest('table')).backgroundColor,
            gapTop: rect.top,
            textTop: td.querySelector('p').getBoundingClientRect().top
        };
    });
    console.log("Table Gap Info:", tableGapInfo);
    
    // Scroll into view
    await page1.evaluate((y) => window.scrollTo(0, y - 200), tableGapInfo.gapTop);
    
    // Wait for scroll
    await new Promise(r => setTimeout(r, 200));

    // Check elementsFromPoint in the gap relative to viewport
    const gapMidY = tableGapInfo.gapTop - await page1.evaluate(() => window.scrollY) + 100;
    const gapElements = await page1.evaluate((y) => {
        return document.elementsFromPoint(300, y).map(e => ({
            tag: e.tagName,
            className: e.className,
            bg: window.getComputedStyle(e).backgroundColor,
            zIndex: window.getComputedStyle(e).zIndex
        }));
    }, gapMidY);
    console.log("Elements in Table Gap:", gapElements);
    
    // Toolbar and white rectangle investigation
    const toolbarInfo = await page1.evaluate(() => {
        // Since we are in vanilla, let's look for anything fixed or absolute at the top or bottom
        const els = document.querySelectorAll('*');
        const stickyEls = Array.from(els).filter(e => {
            const pos = window.getComputedStyle(e).position;
            return pos === 'fixed' || pos === 'sticky';
        }).map(e => e.className);
        
        return {
            stickyEls,
            elementsAtTop: document.elementsFromPoint(300, 10).map(e => ({tag: e.tagName, className: e.className, bg: window.getComputedStyle(e).backgroundColor}))
        };
    });
    console.log("Toolbar Info:", toolbarInfo);
    
    await page1.screenshot({ path: path.join(__dirname, 't60-obs.png'), fullPage: true });

    // Test 2: Linear Overflow Gap Visibility
    const page2 = await browser.newPage();
    await page2.goto('http://localhost:8543/');
    await page2.waitForSelector('.tiptap');
    
    const linear = { type: 'doc', content: [] };
    for(let i=1; i<=150; i++) {
        linear.content.push({ type: 'paragraph', content: [{ type: 'text', text: `Linear Line ${i}` }] });
    }
    await page2.evaluate((json) => window.__appeEditor.commands.setContent(json), linear);
    await new Promise(r => setTimeout(r, 1000));
    
    const linearGapInfo = await page2.evaluate(() => {
        // In the document-editor, linear pages are rendered as .page-view or .virtual-page or similar.
        // Let's just find the elements that have border-bottom or box-shadow for page breaks.
        const els = document.querySelectorAll('*');
        let pageBreakEl = null;
        for(const e of els) {
            if (e.className.includes('page') || window.getComputedStyle(e).borderBottom.includes('solid')) {
               // ... just check the DOM structure in general
            }
        }
        
        // Actually, just get elements at y=1100 (which should be between pages if a page is 1056px tall)
        window.scrollTo(0, 1056 - 200);
        return 1056;
    });
    await new Promise(r => setTimeout(r, 200));
    
    const linearGapInfo2 = await page2.evaluate(() => {
        const viewportY = 1056 - window.scrollY + 10; // slightly after page 1
        const elsInGap = document.elementsFromPoint(300, viewportY).map(e => ({
            tag: e.tagName,
            className: e.className,
            bg: window.getComputedStyle(e).backgroundColor,
            boxShadow: window.getComputedStyle(e).boxShadow
        }));
        
        return {
            viewportY,
            elementsInGap: elsInGap
        };
    });
    console.log("Linear Gap Info:", linearGapInfo2);
    
    await page2.screenshot({ path: path.join(__dirname, 'linear-obs.png'), fullPage: true });
    
    await browser.close();
}
run().catch(console.error);
