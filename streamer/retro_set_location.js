const { chromium } = require('playwright-core');

const CHROMIUM =
  process.env.CHROMIUM_PATH || '/usr/bin/chromium';

async function clickStartRetrocast(page) {
  const start = page.getByRole('button', { name: /start retrocast/i });
  try {
    await start.waitFor({ state: 'visible', timeout: 90000 });
    await start.click();
  } catch {
    // Countdown may finish and the UI auto-starts, or the CTA is gone already.
  }
}

/** Try to unmute in-page audio so PulseAudio captures it. */
async function tryUnmute(page) {
  await page.waitForTimeout(6000);

  const attempts = [
    () => page.getByRole('button', { name: /^unmute$/i }),
    () => page.getByRole('button', { name: /unmute/i }),
    () => page.locator('[aria-label*="unmute" i]'),
    () => page.locator('button[aria-label*="mute" i]').first(),
    () => page.locator('[title*="unmute" i]'),
    () => page.locator('[title*="mute" i]').first(),
  ];

  for (const getLoc of attempts) {
    try {
      const loc = getLoc();
      if (await loc.count()) {
        const el = loc.first();
        if (await el.isVisible({ timeout: 2500 }).catch(() => false)) {
          await el.click({ timeout: 5000 });
          return;
        }
      }
    } catch (_) {}
  }
}

(async () => {
  const targetUrl = process.env.TARGET_URL || 'https://weather.com/retro/';
  const zip = process.env.LOCATION || '60601';
  const width = parseInt(process.env.WIDTH || '1920', 10);
  const height = parseInt(process.env.HEIGHT || '1080', 10);

  const browser = await chromium.launch({
    headless: false,
    executablePath: CHROMIUM,
    env: {
      ...process.env,
      PULSE_SINK: process.env.PULSE_SINK || 'retro_sink',
    },
    args: [
      `--window-size=${width},${height}`,
      '--no-first-run',
      '--disable-features=TranslateUI',
      '--kiosk',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const context = await browser.newContext({
    viewport: { width, height },
  });

  const page = await context.newPage();
  await page.goto(targetUrl, {
    waitUntil: 'load',
    timeout: 180000,
  });

  await clickStartRetrocast(page);

  await tryUnmute(page);

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
