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
        
        // Remove text formatting for strict semantic comparison if needed, but T60 is clean.
        
        return {
          json: JSON.parse(JSON.stringify(json)),
          dataRows: trs.length,
          spacers: spacers.length,
          spacerHeights
        };
      });
    }

    const screenshotsDir = '/home/jhonny/.gemini/antigravity-ide/brain/88a31939-ff9d-4894-a9ac-e5e1007395f2';

    // V1
    console.log(`\n--- V1: setContent(T60) ---`);
    await page.evaluate(() => { window.__appeLastSnapshot = null; });
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, T60);
    const snapV1 = await waitStabilization(page);
    const infoV1 = await extractInfo();
    console.log(`V1 Páginas: ${snapV1.pages.length}, Espaçadores: ${infoV1.spacers}`);
    await page.screenshot({ path: path.join(screenshotsDir, 't60-v1.png'), fullPage: true });
    
    // V2
    console.log(`\n--- V2: curto -> T60 ---`);
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, shortDoc);
    const snapV2Short = await waitStabilization(page);
    assert.strictEqual(snapV2Short.breaks.length, 0, 'Documento curto não deve ter breaks');
    
    await page.evaluate((json) => { window.__appeEditor.commands.setContent(json); }, T60);
    const snapV2 = await waitStabilization(page);
    const infoV2 = await extractInfo();
    console.log(`V2 Páginas: ${snapV2.pages.length}, Espaçadores: ${infoV2.spacers}`);
    await page.screenshot({ path: path.join(screenshotsDir, 't60-v2.png'), fullPage: true });

    // Second Stabilization
    await page.evaluate(() => { window.paginationController.scheduleRender(); });
    const snapV2Second = await waitStabilization(page);
    
    // V3
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
    console.log(`V3 Páginas: ${snapV3.pages.length}, Espaçadores: ${infoV3.spacers}`);
    await page.screenshot({ path: path.join(screenshotsDir, 't60-v3.png'), fullPage: true });

    // --- ASSERÇÕES ESTRUTURAIS E GEOMÉTRICAS ---

    // Igualdade Semântica do JSON (V1 = V2 = V3)
    assert.deepStrictEqual(infoV1.json, infoV2.json, "JSON de V1 deve ser igual ao V2");
    assert.deepStrictEqual(infoV2.json, infoV3.json, "JSON de V2 deve ser igual ao V3");
    
    function mapBreaks(snap) {
      return snap.breaks.map(b => ({
        pos: b.pos,
        reason: b.reason,
        effectiveDisplacement: b.effectiveDisplacement,
        renderer: b.renderer
      }));
    }
    
    const mappedV1 = mapBreaks(snapV1);
    const mappedV2 = mapBreaks(snapV2);
    const mappedV3 = mapBreaks(snapV3);
    const mappedV2Second = mapBreaks(snapV2Second);

    // Igualdade de Posições, Motivos e Renderizadores (V2 == V3)
    for (let i = 0; i < mappedV2.length; i++) {
        assert.strictEqual(mappedV2[i].pos, mappedV3[i].pos, `Posição do break ${i} difere`);
        assert.strictEqual(mappedV2[i].reason, mappedV3[i].reason, `Motivo do break ${i} difere`);
        assert.strictEqual(mappedV2[i].renderer, mappedV3[i].renderer, `Renderer do break ${i} difere`);
    }

    function assertTolerance(arr1, arr2, tol, msg) {
      assert.strictEqual(arr1.length, arr2.length, msg + ' (lengths differ)');
      for (let i = 0; i < arr1.length; i++) {
        assert.ok(Math.abs(arr1[i] - arr2[i]) <= tol, `${msg}: index ${i} differ by more than ${tol} (${arr1[i]} vs ${arr2[i]})`);
      }
    }

    // Correspondência entre effectiveDisplacement e Dimensão Física
    assertTolerance(mappedV2.map(b => b.effectiveDisplacement), infoV2.spacerHeights, 2, "Displacement V2 deve bater fisicamente com o Spacer");
    assertTolerance(mappedV3.map(b => b.effectiveDisplacement), infoV3.spacerHeights, 2, "Displacement V3 deve bater fisicamente com o Spacer");

    // V2 Second Stabilization (Sem acumulação)
    assertTolerance(mappedV2Second.map(b => b.effectiveDisplacement), mappedV2.map(b => b.effectiveDisplacement), 10, "Segunda estabilização não pode divergir além da tolerância de bordas");

    // V2 = V3 Tolerância
    assertTolerance(mappedV2.map(b => b.effectiveDisplacement), mappedV3.map(b => b.effectiveDisplacement), 10, "V2 e V3 divergiram");

    console.log('\nSUCCESS! Todas as asserções Nível A aprovadas (GREEN).');
  } catch (err) {
    console.error('Error during script:', err);
    process.exit(1);
  } finally {
    await browser.close();
    if (serverProcess) serverProcess.kill();
  }
})();
