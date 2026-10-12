import { chromium } from 'file:///C:/Users/sunchenxi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const results = {};

await page.goto('http://127.0.0.1:4177/index.html?view=practice', { waitUntil: 'networkidle' });
await page.locator('#practiceGuideButton').click();
await page.waitForTimeout(500);
results.guide = await page.evaluate(() => ({
  open: !document.querySelector('#practiceGuide').hidden,
  steps: document.querySelector('#practiceGuideProgress').textContent,
  spotlight: !document.querySelector('.practice-guide-spotlight').hidden,
  overflow: document.documentElement.scrollWidth - innerWidth
}));
await page.screenshot({ path: '.tmp-practice-guide.png', fullPage: false });
for (let index = 0; index < 6; index += 1) {
  await page.locator('#practiceGuideNext').click();
  await page.waitForTimeout(90);
}
await page.locator('#practiceGuideNext').click();
await page.waitForTimeout(120);
results.guide.closed = await page.locator('#practiceGuide').evaluate(element => element.hidden);
results.guide.mainScrollTop = await page.locator('main').evaluate(element => element.scrollTop);

await page.goto('http://127.0.0.1:4177/index.html?view=my', { waitUntil: 'networkidle' });
await page.locator('[data-my-view="works"]').click();
await page.waitForTimeout(200);
results.my = await page.evaluate(() => ({
  viewport: innerWidth,
  htmlWidth: document.documentElement.getBoundingClientRect().width,
  bodyWidth: document.body.getBoundingClientRect().width,
  overflow: document.documentElement.scrollWidth - innerWidth,
  emptyVisible: !document.querySelector('#worksEmpty').hidden
}));
await page.screenshot({ path: '.tmp-my-empty.png', fullPage: false });

console.log(JSON.stringify(results, null, 2));
await browser.close();
