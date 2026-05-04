const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(5000);
  
  // Try to simulate zooming in by scrolling mouse
  console.log('Zooming in...');
  await page.mouse.move(500, 500);
  await page.mouse.wheel(0, -1000);
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, -1000);
  await page.waitForTimeout(2000);
  
  await browser.close();
})();
