/**
 * GasPilot — App Store Screenshot Exporter
 *
 * Exports each of the 6 phone frames as a 1320×2868px PNG
 * (App Store Connect "iPhone 6.9 inch" requirement).
 *
 * Usage:
 *   npm install puppeteer   (or: npx puppeteer install)
 *   node export.js
 *
 * Output: ./exports/screenshot-01.png … screenshot-06.png
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// App Store required dimensions (iPhone 6.9")
const STORE_WIDTH = 1320;
const STORE_HEIGHT = 2868;

// Display size of .phone-frame in the HTML (px)
const FRAME_DISPLAY_WIDTH = 310;
const FRAME_DISPLAY_HEIGHT = 672;

// Scale factor to go from display → App Store resolution
const SCALE = STORE_WIDTH / FRAME_DISPLAY_WIDTH; // ≈ 4.258

const OUTPUT_DIR = path.join(__dirname, 'exports');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const SCREENSHOTS = [
  { selector: '.screenshot-card:nth-child(1) .phone-frame', name: 'screenshot-01-dashboard.png' },
  { selector: '.screenshot-card:nth-child(2) .phone-frame', name: 'screenshot-02-gas-certs.png' },
  { selector: '.screenshot-card:nth-child(3) .phone-frame', name: 'screenshot-03-jobs.png' },
  { selector: '.screenshot-card:nth-child(4) .phone-frame', name: 'screenshot-04-invoicing.png' },
  { selector: '.screenshot-card:nth-child(5) .phone-frame', name: 'screenshot-05-team.png' },
  { selector: '.screenshot-card:nth-child(6) .phone-frame', name: 'screenshot-06-calendar.png' },
];

(async () => {
  console.log('🚀 Launching Puppeteer…');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Set viewport large enough to render all 6 cards side by side
  await page.setViewport({
    width: 2200,
    height: 900,
    deviceScaleFactor: SCALE,
  });

  const htmlPath = path.join(__dirname, 'index.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

  // Wait for any transitions
  await new Promise(r => setTimeout(r, 500));

  for (const { selector, name } of SCREENSHOTS) {
    const element = await page.$(selector);
    if (!element) {
      console.warn(`⚠  Could not find element: ${selector}`);
      continue;
    }

    const outputPath = path.join(OUTPUT_DIR, name);
    await element.screenshot({
      path: outputPath,
      type: 'png',
    });

    console.log(`✅  Exported: exports/${name}`);
  }

  await browser.close();
  console.log(`\n🎉 Done! ${SCREENSHOTS.length} screenshots saved to ./exports/`);
  console.log(`   Resolution: ${STORE_WIDTH}×${STORE_HEIGHT}px (iPhone 6.9" App Store)`);
})();
