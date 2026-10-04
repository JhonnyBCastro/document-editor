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

const shortDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Short Doc' }] }]
};

async function waitStabilization(page) {
  return page.evaluate(() => {
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
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    await page.waitForSelector('.tiptap', {timeout: 10000});

    const T60 = generateT60();
    
    async function extractInfo() {
      return page.evaluate(() => {
        const editor = window.__appeEditor;
        const json = editor.getJSON();
        const trs = document.querySelectorAll('.tiptap table tr:not(.virtual-page-spacer)');
        const spacers = document.querySelectorAll('.tiptap table tr.virtual-page-spacer');
        const spacerHeights = Array.from(spacers).map(el => el.getBoundingClientRect().height);
        return {
          jsonSize: JSON.stringify(json).length,
          dataRows: trs.length,
          spacers: spacers.length,
          spacerHeights
        };
      });
    }

    const screenshotsDir = '/home/jhonny/.gemini/antigravity-ide/brain/88a31939-ff9d-4894-a9ac-e5e1007395f2';

    console.log(`\n--- V1: setContent(T60) ---`);
    await page.evaluate(() => { window.__appeLastSnapshot = null; });
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, T60);
    const snapV1 = await waitStabilization(page);
    const infoV1 = await extractInfo();
    console.log(`V1 Páginas: ${snapV1.pages.length}, Espaçadores: ${infoV1.spacers}, JSON Length: ${infoV1.jsonSize}`);
    console.log(`V1 Spacer Heights: ${infoV1.spacerHeights.join(', ')}`);
    console.log(`V1 displacements:`, snapV1.breaks.map(b => b.effectiveDisplacement).join(', '));
    await page.screenshot({ path: path.join(screenshotsDir, 't60-v1.png'), fullPage: true });
    
    console.log(`\n--- V2: curto -> T60 ---`);
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, shortDoc);
    const snapV2Short = await waitStabilization(page);
    assert.strictEqual(snapV2Short.breaks.length, 0, 'Documento curto não deve ter breaks');
    
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, T60);
    const snapV2 = await waitStabilization(page);
    const infoV2 = await extractInfo();
    console.log(`V2 Páginas: ${snapV2.pages.length}, Espaçadores: ${infoV2.spacers}, JSON Length: ${infoV2.jsonSize}`);
    console.log(`V2 Spacer Heights: ${infoV2.spacerHeights.join(', ')}`);
    console.log(`V2 displacements:`, snapV2.breaks.map(b => b.effectiveDisplacement).join(', '));
    await page.screenshot({ path: path.join(screenshotsDir, 't60-v2.png'), fullPage: true });

    await page.evaluate(() => { window.paginationController.scheduleRender(); });
    const snapV2Second = await waitStabilization(page);
    
    function assertTolerance(arr1, arr2, tol, msg) {
      assert.strictEqual(arr1.length, arr2.length, msg + ' (lengths differ)');
      for (let i = 0; i < arr1.length; i++) {
        assert.ok(Math.abs(arr1[i] - arr2[i]) <= tol, `${msg}: index ${i} differ by more than ${tol} (${arr1[i]} vs ${arr2[i]})`);
      }
    }
    
    assertTolerance(snapV2Second.breaks.map(b => b.effectiveDisplacement), snapV2.breaks.map(b => b.effectiveDisplacement), 10, 'Segunda estabilização V2 não deve divergir além das bordas acumuladas');
    
    console.log(`\n--- V3: curto -> T60 -> curto -> T60 ---`);
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, shortDoc);
    const snapV3Short = await waitStabilization(page);
    assert.strictEqual(snapV3Short.breaks.length, 0, 'Documento curto V3 não deve ter breaks');
    
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, T60);
    await waitStabilization(page);
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, shortDoc);
    await waitStabilization(page);
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, T60);
    const snapV3 = await waitStabilization(page);
    const infoV3 = await extractInfo();
    console.log(`V3 Páginas: ${snapV3.pages.length}, Espaçadores: ${infoV3.spacers}, JSON Length: ${infoV3.jsonSize}`);
    console.log(`V3 Spacer Heights: ${infoV3.spacerHeights.join(', ')}`);
    console.log(`V3 displacements:`, snapV3.breaks.map(b => b.effectiveDisplacement).join(', '));
    await page.screenshot({ path: path.join(screenshotsDir, 't60-v3.png'), fullPage: true });

    assert.ok(infoV2.spacerHeights[0] < 300, `V2 Spacer acumulou e explodiu para ${infoV2.spacerHeights[0]}px!`);
    assert.ok(infoV3.spacerHeights[0] < 300, `V3 Spacer acumulou e explodiu para ${infoV3.spacerHeights[0]}px!`);
    
    assertTolerance(snapV2.breaks.map(b => b.effectiveDisplacement), snapV3.breaks.map(b => b.effectiveDisplacement), 10, 'V2 e V3 divergiram!');
    
    console.log('\nSUCCESS! No geometric accumulation detected (GREEN).');
  } catch (err) {
    console.error('Error during script:', err);
    process.exit(1);
  } finally {
    await browser.close();
    if (serverProcess) serverProcess.kill();
  }
})();
