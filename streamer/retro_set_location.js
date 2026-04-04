const { chromium } = require('playwright-core');

const CHROMIUM =
  process.env.CHROMIUM_PATH || '/usr/bin/chromium';

(async () => {
  const targetUrl = process.env.TARGET_URL || 'https://weather.com/retro/';
  const zip = process.env.LOCATION || '60601';
  const width = parseInt(process.env.WIDTH || '1920', 10);
  const height = parseInt(process.env.HEIGHT || '1080', 10);

  const browser = await chromium.launch({
    headless: false,
    executablePath: CHROMIUM,
    args: [
      `--window-size=${width},${height}`,
      '--no-first-run',
      '--disable-features=TranslateUI',
      '--kiosk',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    viewport: { width, height },
  });

  const page = await context.newPage();
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  const startBtn = page.getByRole('button', { name: /start retrocast/i });
  if (await startBtn.count()) {
    await startBtn.first().click();
  }

  const candidates = [
    page.getByPlaceholder(/search/i),
    page.getByRole('textbox', { name: /search/i }),
    page.locator('input[type="search"]'),
    page.locator('input').first(),
  ];

  for (const input of candidates) {
    try {
      if (await input.count()) {
        await input.first().click({ timeout: 1500 });
        await input.first().fill(zip, { timeout: 1500 });
        await page.keyboard.press('Enter');
        break;
      }
    } catch (_) {}
  }

  await page.waitForTimeout(3600 * 1000);
})();
