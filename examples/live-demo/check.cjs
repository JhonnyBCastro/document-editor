// Verificacao geometrica minima do modo composed (browser real, via demo em :8544).
// Uso: node examples/live-demo/check.cjs   (requer o servidor da demo ativo)
// Invariantes checados:
//  A) nenhuma linha de texto visivel cai nas margens/gap entre paginas (fora de [top+mT, top+H-mB] da sua pagina)
//  B) nova rodada de layout sobre o mesmo documento reproduz as mesmas quebras (idempotencia)
//  C) no de paginas == quebras + 1 e diagnostics reportados
const puppeteer = require('puppeteer-core');

// Cenarios suportados nesta versao delimitada: 'mini' e sinteticos 'p:N' (cenarios tabulares PE-* estao indisponiveis sem @tiptap/extension-table)
const SCENARIOS = (process.env.SCENARIOS || 'mini,p:370,p:600').split(',').map(x => x === 'long' ? 'p:600' : x);
const BASE = process.env.BASE || 'http://localhost:8544/';
const SYN = sc => (sc.startsWith('p:') ? +sc.slice(2) : 0);

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE.ERROR', m.text()); });
  for (const sc of SCENARIOS) {
    await page.goto(BASE, { waitUntil: 'load' });
    const modeSelect = await page.$('#mode');
    if (modeSelect) await page.select('#mode', process.env.MODE || 'composed');
    if (!SYN(sc)) await page.select('#fx', sc);
    await page.click('#go');
    await page.waitForFunction(() => window.__snap, { timeout: 15000 });
    if (SYN(sc)) {
      await page.evaluate((N) => {
        window.__snap = null;
        const para = i => ({ type: 'paragraph', content: [{ type: 'text', text: `P${i}. ` + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor. '.repeat(1 + (i % 5)) }] });
        window.__editor.commands.setContent({ type: 'doc', content: Array.from({ length: N }, (_, i) => para(i)) });
      }, SYN(sc));
      await page.waitForFunction(() => window.__snap, { timeout: 60000 });
    }
    await new Promise(r => setTimeout(r, 600));
    const res = await page.evaluate(async () => {
      const first = window.__snap;
      const ctl = window.__editor.storage.pagination.controller;
      // Dispara nova rodada de layout para comparacao efetiva de idempotencia
      const second = await Promise.race([ctl.whenLayoutStable(), new Promise(r => setTimeout(() => r(null), 5000))]) || first;
      const secondIsFresh = second !== first;
      const sig = s => JSON.stringify(s.breaks.map(b => [b.pos, Math.round(b.effectiveDisplacement * 100) / 100, b.renderer, b.origin]));
      const L = ctl.getLayout().page;
      const edTop = window.__editor.view.dom.getBoundingClientRect().top;
      // linhas visiveis: rects de nos de texto
      const walker = document.createTreeWalker(window.__editor.view.dom, NodeFilter.SHOW_TEXT);
      const violations = []; let lines = 0, n;
      while ((n = walker.nextNode())) {
        if (!n.textContent.trim()) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        for (const rc of r.getClientRects()) {
          if (rc.height === 0) continue;
          lines++;
          const y = rc.top - edTop, yb = rc.bottom - edTop;
          const pageH = L.height + L.pageGap;
          const k = Math.floor((y + 1) / pageH);
          const lo = k * pageH + L.marginTop, hi = k * pageH + L.height - L.marginBottom;
          if (y < lo - 1 || yb > hi + 1) violations.push({ page: k + 1, top: Math.round(y - k * pageH), bottom: Math.round(yb - k * pageH), text: n.textContent.slice(0, 30) });
        }
      }
      // Prova de que o fim do documento foi paginado: ultima linha de texto pertence a ultima pagina
      // e a posicao da ultima quebra / diagnostico de limite sao reportados.
      let lastTop = 0, lastN = null; const w2 = document.createTreeWalker(window.__editor.view.dom, NodeFilter.SHOW_TEXT);
      while ((n = w2.nextNode())) if (n.textContent.trim()) lastN = n;
      if (lastN) { const rr = document.createRange(); rr.selectNodeContents(lastN); const rs = rr.getClientRects(); lastTop = rs[rs.length - 1].top - edTop; }
      const lastLinePage = Math.floor((lastTop + 1) / (L.height + L.pageGap)) + 1;
      const lastBreak = second.breaks[second.breaks.length - 1];
      return {
        docSize: window.__editor.state.doc.content.size, lastBreakPos: lastBreak && lastBreak.pos,
        lastLinePage, lastLineOnLastPage: lastLinePage === second.pages.length,
        pages: second.pages.length, breaks: second.breaks.length,
        diag: second.diagnostics.map(d => d.code + '@' + d.pos),
        idempotent: secondIsFresh ? sig(first) === sig(second) : 'n/a(no-recalc)',
        freshLayoutRound: secondIsFresh,
        lines, violations: violations.length, sample: violations.slice(0, 4),
        reasons: [...new Set(second.breaks.flatMap(b => b.reasons))],
      };
    });
    console.log(sc, JSON.stringify(res));
  }
  await browser.close();
})();
