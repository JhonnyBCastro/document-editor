const puppeteer = require("puppeteer");
const { createServer } = require("vite");
const path = require("path");

async function runGeometricRehearsal() {
  console.log("================================================================================");
  console.log("   E2E GEOMETRIC REHEARSAL — EXPANDED PHYSICAL AUDIT (PUPPETEER)");
  console.log("   Acceptance Criterion: Tolerance <= 1.0 CSS px (Delimited to this Rehearsal)");
  console.log("================================================================================");

  // 1. Start local Vite server
  const port = 8556;
  const server = await createServer({
    server: { port },
    configFile: false,
    root: process.cwd(),
  });
  await server.listen();
  console.log(`[Vite] Server started on http://localhost:${port}`);

  // 2. Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,1024"],
    defaultViewport: { width: 1280, height: 1024 },
  });
  const page = await browser.newPage();

  page.on("console", msg => {
    if (msg.type() === "error") {
      console.error("[Browser Error]", msg.text());
    }
  });
  page.on("pageerror", err => console.error("[Browser PageError]", err));

  try {
    // 3. Open rehearsal page
    await page.goto(`http://localhost:${port}/tests/e2e/composition-geometry.html`, { waitUntil: "networkidle0" });

    // 4. Initialize both Profiles
    console.log("[Rehearsal] Initializing Profile A (Standard) and Profile B (Custom)...");
    const initRes = await page.evaluate(async () => {
      return await window.__initProfiles();
    });
    console.log("[Rehearsal] Profiles initialized:", initRes);

    // Give browser a moment to ensure all DOM paints and mutations are settled
    await new Promise(r => setTimeout(r, 600));

    // 5. Measure DOM elements for both profiles
    const auditData = await page.evaluate(() => {
      function measureHost(hostId, profileKey, W, H, L, R, T, B, G) {
        const host = document.getElementById(hostId);
        const hostRect = host.getBoundingClientRect();
        const hostStyle = window.getComputedStyle(host);
        const bL_host = parseFloat(hostStyle.borderLeftWidth) || 0;
        const bT_host = parseFloat(hostStyle.borderTopWidth) || 0;

        // Independent Reference Origin
        const Ox = hostRect.left + bL_host;
        const Oy = hostRect.top + bT_host;

        const wrapper = host.querySelector(".document-editor-composition-wrapper");
        const wr = wrapper ? wrapper.getBoundingClientRect() : null; const wrapperRect = wr ? { left: wr.left, top: wr.top, width: wr.width, height: wr.height } : null;

        const presentationLayer = host.querySelector(".document-presentation-layer");
        const lr = presentationLayer ? presentationLayer.getBoundingClientRect() : null; const layerRect = lr ? { left: lr.left, top: lr.top, width: lr.width, height: lr.height } : null;

        const editorMount = host.querySelector(".document-editor-core-mount");
        const mr = editorMount ? editorMount.getBoundingClientRect() : null; const editorMountRect = mr ? { left: mr.left, top: mr.top, width: mr.width, height: mr.height } : null;

        const editorEl = host.querySelector(".ProseMirror");
        const eRect = editorEl.getBoundingClientRect();
        const eStyle = window.getComputedStyle(editorEl);
        const bL = parseFloat(eStyle.borderLeftWidth) || 0;
        const bR = parseFloat(eStyle.borderRightWidth) || 0;
        const bT = parseFloat(eStyle.borderTopWidth) || 0;
        const bB = parseFloat(eStyle.borderBottomWidth) || 0;
        const pL = parseFloat(eStyle.paddingLeft) || 0;
        const pR = parseFloat(eStyle.paddingRight) || 0;
        const pT = parseFloat(eStyle.paddingTop) || 0;
        const pB = parseFloat(eStyle.paddingBottom) || 0;

        const sheets = Array.from(host.querySelectorAll(".document-presentation-sheet")).map(s => {
          const r = s.getBoundingClientRect();
          return {
            index: parseInt(s.getAttribute("data-page-index") || "0", 10),
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
            right: r.right,
          };
        });

        const headers = Array.from(host.querySelectorAll(".document-presentation-header")).map(h => {
          const r = h.getBoundingClientRect();
          return {
            index: parseInt(h.getAttribute("data-page-index") || "0", 10),
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
            right: r.right,
          };
        });

        const footers = Array.from(host.querySelectorAll(".document-presentation-footer")).map(f => {
          const r = f.getBoundingClientRect();
          return {
            index: parseInt(f.getAttribute("data-page-index") || "0", 10),
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
            right: r.right,
          };
        });

        const snap = profileKey === "A" ? window.__instances.snapA : window.__instances.snapB;

        return {
          profileKey,
          nominal: { W, H, L, R, T, B, G },
          origin: { x: Ox, y: Oy },
          hostRect: { left: hostRect.left, top: hostRect.top, width: hostRect.width, height: hostRect.height },
          hostBorders: { bL: bL_host, bT: bT_host },
          wrapperRect,
          layerRect,
          editorMountRect,
          editor: {
            rect: { left: eRect.left, top: eRect.top, width: eRect.width, height: eRect.height, right: eRect.right, bottom: eRect.bottom },
            borders: { bL, bR, bT, bB },
            padding: { pL, pR, pT, pB },
          },
          sheets,
          headers,
          footers,
          snapshotPages: snap.pages,
        };
      }

      return {
        profileA: measureHost("host-a", "A", 816, 1056, 96, 96, 96, 96, 20),
        profileB: measureHost("host-b", "B", 816, 1056, 64, 64, 64, 64, 32),
      };
    });

    // 6. Verify Formulas and Print Audit
    function auditProfile(data) {
      console.log(`\n--------------------------------------------------------------------------------`);
      console.log(`  EXPANDED AUDIT: PROFILE ${data.profileKey} (W=${data.nominal.W}, H=${data.nominal.H}, L=${data.nominal.L}, R=${data.nominal.R}, T=${data.nominal.T}, B=${data.nominal.B}, G=${data.nominal.G})`);
      console.log(`--------------------------------------------------------------------------------`);

      const { nominal, origin, editor, sheets, headers, footers, snapshotPages, layerRect } = data;
      const { W, H, L, R, T, B, G } = nominal;
      const { bL, bR, bT, bB } = editor.borders;
      const { pL, pR, pT, pB } = editor.padding;
      const E = editor.rect;

      let allPassed = true;
      const checks = [];

      function assertFormula(name, measured, expected) {
        const diff = Math.abs(measured - expected);
        const pass = diff <= 1.0;
        if (!pass) allPassed = false;
        checks.push({
          name,
          measured: measured.toFixed(2),
          expected: expected.toFixed(2),
          diff: diff.toFixed(3),
          pass: pass ? "PASS" : "FAIL",
        });
      }

      // Formula 1: Reference origin connection
      assertFormula(
        "F01: Reference Origin X (hostRect.left + bL_host)",
        origin.x,
        data.hostRect.left + data.hostBorders.bL
      );
      assertFormula(
        "F01: Reference Origin Y (hostRect.top + bT_host)",
        origin.y,
        data.hostRect.top + data.hostBorders.bT
      );

      // Formula 1B: Effective Presentation Layer Origin
      if (layerRect) {
        assertFormula(
          "F01B: Presentation Layer Origin X (layerRect.left ≈ O.x)",
          layerRect.left,
          origin.x
        );
        assertFormula(
          "F01B: Presentation Layer Origin Y (layerRect.top ≈ O.y)",
          layerRect.top,
          origin.y
        );
      }

      // Formula 2: Início horizontal efetivo do conteúdo
      // E.left + bL + pL ≈ O.x + S0.left + L
      const S0_left = snapshotPages[0].sheetRect.left;
      const contentLeftEdge = E.left + bL + pL;
      assertFormula(
        "F02: Content Horizontal Start (E.left + bL + pL ≈ O.x + S0.left + L)",
        contentLeftEdge,
        origin.x + S0_left + L
      );

      // Formula 3: Início vertical efetivo do conteúdo
      // E.top + bT + pT ≈ O.y + S0.top + T
      const S0_top = snapshotPages[0].sheetRect.top;
      const contentTopEdge = E.top + bT + pT;
      assertFormula(
        "F03: Content Vertical Start (E.top + bT + pT ≈ O.y + S0.top + T)",
        contentTopEdge,
        origin.y + S0_top + T
      );

      // Formula 4: Largura efetiva do conteúdo
      // E.width - bL - bR - pL - pR ≈ W - L - R
      const usefulWidth = W - L - R;
      const effectiveContentWidth = E.width - bL - bR - pL - pR;
      assertFormula(
        "F04: Content Effective Width (E.width - bL - bR - pL - pR ≈ W - L - R)",
        effectiveContentWidth,
        usefulWidth
      );

      // Direct Content Right Border Verification:
      // contentRightEdge = E.right - bR - pR
      const contentRightEdge = E.right - bR - pR;
      assertFormula(
        "F04B: Direct Content Right Border (E.right - bR - pR ≈ O.x + S0.left + W - R)",
        contentRightEdge,
        origin.x + S0_left + W - R
      );
      assertFormula(
        "F04C: Direct Measured Width (contentRightEdge - contentLeftEdge ≈ usefulWidth)",
        contentRightEdge - contentLeftEdge,
        usefulWidth
      );

      // Useful vertical height
      const usefulHeight = H - T - B;

      // Formula 5, 6, 7: Physical position & dimensions of each sheet
      for (let i = 0; i < sheets.length; i++) {
        const s = sheets[i];
        const snapS = snapshotPages[i].sheetRect;

        assertFormula(
          `F05: Sheet[${i}] X Position (sheetDOM_${i}.left ≈ O.x + S_${i}.left)`,
          s.left,
          origin.x + snapS.left
        );
        assertFormula(
          `F06: Sheet[${i}] Y Position (sheetDOM_${i}.top ≈ O.y + S_${i}.top)`,
          s.top,
          origin.y + snapS.top
        );
        assertFormula(
          `F07: Sheet[${i}] Width (sheetDOM_${i}.width ≈ W)`,
          s.width,
          W
        );
        assertFormula(
          `F07: Sheet[${i}] Height (sheetDOM_${i}.height ≈ H)`,
          s.height,
          H
        );
      }

      // Formula 8: Header physical position, width and height
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        assertFormula(
          `F08: Header[${i}] X (headerDOM_${i}.left ≈ O.x + S_${i}.left + L)`,
          h.left,
          origin.x + snapshotPages[i].sheetRect.left + L
        );
        assertFormula(
          `F08: Header[${i}] Top (headerDOM_${i}.top ≈ O.y + S_${i}.top)`,
          h.top,
          origin.y + snapshotPages[i].sheetRect.top
        );
        assertFormula(
          `F08: Header[${i}] Width (headerDOM_${i}.width ≈ W - L - R)`,
          h.width,
          usefulWidth
        );
        assertFormula(
          `F08: Header[${i}] Height (headerDOM_${i}.height ≈ T)`,
          h.height,
          T
        );
      }

      // Formula 9: Footer physical position, width and height
      for (let i = 0; i < footers.length; i++) {
        const f = footers[i];
        assertFormula(
          `F09: Footer[${i}] X (footerDOM_${i}.left ≈ O.x + S_${i}.left + L)`,
          f.left,
          origin.x + snapshotPages[i].sheetRect.left + L
        );
        assertFormula(
          `F09: Footer[${i}] Top (footerDOM_${i}.top ≈ O.y + S_${i}.top + H - B)`,
          f.top,
          origin.y + snapshotPages[i].sheetRect.top + H - B
        );
        assertFormula(
          `F09: Footer[${i}] Width (footerDOM_${i}.width ≈ W - L - R)`,
          f.width,
          usefulWidth
        );
        assertFormula(
          `F09: Footer[${i}] Height (footerDOM_${i}.height ≈ B)`,
          f.height,
          B
        );

        // Measured useful vertical height between header bottom and footer top
        if (headers[i]) {
          const measuredUsefulHeight = f.top - headers[i].bottom;
          assertFormula(
            `F09B: Useful Vertical Height [${i}] (footerDOM.top - headerDOM.bottom ≈ H - T - B)`,
            measuredUsefulHeight,
            usefulHeight
          );
        }
      }

      // Formula 11: Consecutive sheet stride: sheetDOM[i+1].top - sheetDOM[i].top ≈ H + G
      for (let i = 0; i < sheets.length - 1; i++) {
        const measuredStride = sheets[i + 1].top - sheets[i].top;
        assertFormula(
          `F11: Consecutive Sheet Stride [${i}->${i + 1}] (sheetDOM_${i + 1}.top - sheetDOM_${i}.top ≈ H + G)`,
          measuredStride,
          H + G
        );
      }

      // Formula 12: Consecutive useful area separation: headerDOM[i+1].bottom - footerDOM[i].top ≈ B + G + T
      for (let i = 0; i < Math.min(sheets.length - 1, headers.length - 1, footers.length - 1); i++) {
        const measuredSeparation = headers[i + 1].bottom - footers[i].top;
        assertFormula(
          `F12: Consecutive Useful Area Separation [${i}->${i + 1}] (headerDOM_${i + 1}.bottom - footerDOM_${i}.top ≈ B + G + T)`,
          measuredSeparation,
          B + G + T
        );
      }

      // Formula 10: Right nominal content boundary (O.x + 720 for Profile A, O.x + 752 for Profile B)
      const expectedRight = data.profileKey === "A" ? origin.x + 720 : origin.x + 752;
      assertFormula(
        `F10: Right Nominal Boundary (Content Right ≈ O.x + ${data.profileKey === "A" ? 720 : 752})`,
        contentRightEdge,
        expectedRight
      );

      console.table(checks);
      if (!allPassed) {
        throw new Error(`Geometric rehearsal FAILED for Profile ${data.profileKey} (one or more formulas exceeded 1.0 CSS px tolerance)`);
      }
      console.log(`>>> Profile ${data.profileKey}: ALL ${checks.length} EXPANDED FORMULAS SATISFIED (diff <= 1.0 CSS px) <<<`);
      return { allPassed, checksCount: checks.length };
    }

    const resA = auditProfile(auditData.profileA);
    const resB = auditProfile(auditData.profileB);

    console.log(`\n================================================================================`);
    console.log(`   E2E GEOMETRIC AUDIT SUMMARY: ALL EXPANDED PROFILES PASSED (TOLERANCE <= 1.0px)`);
    console.log(`================================================================================`);
  } finally {
    await browser.close();
    await server.close();
  }
}

runGeometricRehearsal().catch(err => {
  console.error("Fatal rehearsal error:", err);
  process.exit(1);
});
