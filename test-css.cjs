const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(`file://${__dirname}/experimental-table.html`);
    
    const rects = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tr'));
        return rows.map((r, i) => {
            const rect = r.getBoundingClientRect();
            return { row: i + 1, top: rect.top, bottom: rect.bottom, height: rect.height };
        });
    });
    console.log(rects);
    await browser.close();
})();
