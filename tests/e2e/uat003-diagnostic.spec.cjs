const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

(async () => {
  const browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1024'],
      defaultViewport: { width: 1280, height: 1024 }
  });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:8543/');
    await page.waitForSelector('.tiptap', {timeout: 10000});

    const linearDoc = {
      type: 'doc',
      content: []
    };
    for(let i=0; i<100; i++) {
        linearDoc.content.push({ type: 'paragraph', content: [{ type: 'text', text: `Paragraph ${i}` }]});
    }
    
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, linearDoc);
    
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

    console.log(`--- UAT-003: Investigação Diagnóstica ---`);
    
    await page.screenshot({ path: path.join(screenshotsDir, 'uat003-label.png') });
    
    const badgeInfo = await page.evaluate(() => {
        const badges = Array.from(document.querySelectorAll('.page-break-widget div'));
        const yellowBadge = badges.find(el => {
            const bg = window.getComputedStyle(el).backgroundColor;
            // #ffeb3b -> rgb(255, 235, 59)
            return bg === 'rgb(255, 235, 59)' || el.textContent.includes('natural_overflow');
        });
        
        if (yellowBadge) {
            return {
                text: yellowBadge.textContent,
                bg: window.getComputedStyle(yellowBadge).backgroundColor,
                visible: yellowBadge.offsetParent !== null
            };
        }
        return null;
    });
    
    if (badgeInfo) {
        console.log(`Encontrado Badge Diagnóstico: Text="${badgeInfo.text}", Background="${badgeInfo.bg}", Visível=${badgeInfo.visible}`);
        console.log('STATUS: RED (Etiqueta de diagnóstico exposta incondicionalmente na interface ordinária)');
    } else {
        console.log('STATUS: GREEN (Etiqueta não encontrada)');
    }

  } catch (err) {
    console.error('Error during script:', err);
    process.exit(1);
  } finally {
    await browser.close();
    process.exit(0);
  }
})();
