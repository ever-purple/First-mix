import { chromium } from 'file:///C:/Users/sunchenxi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
for (const [width,height,name] of [[430,900,'430x900'],[390,844,'390x844']]) {
  const page = await browser.newPage({viewport:{width,height}});
  await page.goto('http://127.0.0.1:4177/concepts/course-03-playable.html?rev=layout13');
  await page.evaluate(()=>{document.querySelector('#overlay').hidden=true;document.querySelector('#bubble').hidden=false});
  await page.screenshot({path:`first-mix/.tmp-course03-${name}.png`,fullPage:true});
  const boxes = await page.evaluate(()=>Object.fromEntries(['.topbar','.logo','.question-bubble','.lesson'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return[selector,{top:r.top,bottom:r.bottom,height:r.height}]})));
  console.log(name, JSON.stringify(boxes));
  await page.close();
}
await browser.close();
