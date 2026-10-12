import { chromium } from 'file:///C:/Users/sunchenxi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto('http://127.0.0.1:4177/dj-archive-visual-c-options.html', { waitUntil: 'networkidle' });
const result = { concepts: {}, errors };

for (const name of ['cover', 'collage', 'liquid']) {
  await page.locator(`[data-show="${name}"]`).click();
  await page.waitForTimeout(500);
  result.concepts[name] = await page.evaluate(activeName => {
    const active = document.querySelector('.concept.is-active');
    const canvas = active.querySelector('canvas');
    const context = canvas?.getContext('2d');
    const sample = context ? [...context.getImageData(Math.max(0, Math.floor(canvas.width / 2)), Math.max(0, Math.floor(canvas.height / 2)), 1, 1).data] : null;
    return {
      active: active?.dataset.concept,
      expected: activeName,
      overflow: document.documentElement.scrollWidth - innerWidth,
      canvas: canvas ? { width: canvas.width, height: canvas.height, sample } : null,
      imagesReady: [...active.querySelectorAll('img')].every(image => image.complete && image.naturalWidth > 0),
      aiEntryVisible: active.querySelector('[data-open-ai]')?.getBoundingClientRect().height > 0
    };
  }, name);
  const frameA = await page.locator('.concept.is-active canvas').evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(180);
  const frameB = await page.locator('.concept.is-active canvas').evaluate(canvas => canvas.toDataURL());
  result.concepts[name].animated = frameA !== frameB;
  await page.screenshot({ path: `.tmp-archive-${name}.png`, fullPage: true });
}

await page.locator('.concept.is-active [data-open-ai]').click();
await page.waitForTimeout(350);
result.modal = await page.evaluate(() => ({
  open: !document.querySelector('#aiLayer').hidden,
  overflow: document.querySelector('.ai-sheet').scrollWidth - document.querySelector('.ai-sheet').clientWidth,
  height: document.querySelector('.ai-sheet').getBoundingClientRect().height
}));
await page.screenshot({ path: '.tmp-archive-ai.png', fullPage: false });
await page.locator('#aiClose').click();
result.modal.closed = await page.locator('#aiLayer').evaluate(element => element.hidden);

console.log(JSON.stringify(result, null, 2));
await browser.close();
