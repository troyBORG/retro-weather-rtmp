const { execSync } = require('child_process');
const { chromium } = require('playwright-core');

const CHROMIUM =
  process.env.CHROMIUM_PATH || '/usr/bin/chromium';

const USER_DATA =
  process.env.CHROMIUM_USER_DATA ||
  `${process.env.HOME || '/home/streamer'}/.pw-chromium-profile`;

function xEnv() {
  return { ...process.env, DISPLAY: process.env.DISPLAY || ':99' };
}

/** Exact placement: gravity,x,y,w,h — fills the Xvfb screen without relying on fullscreen bit alone. */
function wmExactGeometry(width, height) {
  const env = xEnv();
  const cmds = [
    `wmctrl -r "Chromium" -e 0,0,0,${width},${height}`,
    `wmctrl -xr chromium.Chromium -e 0,0,0,${width},${height}`,
    `wmctrl -xr Chromium.Chromium -e 0,0,0,${width},${height}`,
    `wmctrl -a "RetroCast" -e 0,0,0,${width},${height}`,
  ];
  for (const c of cmds) {
    try {
      execSync(c, { stdio: 'ignore', env, timeout: 4000 });
      return;
    } catch (_) {}
  }
}

function xdotoolFill(width, height) {
  const env = xEnv();
  const classes = ['chromium', 'Chromium', 'chromium-browser'];
  for (const cls of classes) {
    try {
      const out = execSync(`xdotool search --onlyvisible --class ${cls}`, {
        encoding: 'utf8',
        env,
        timeout: 5000,
      });
      const ids = out
        .trim()
        .split(/\n/)
        .flatMap((line) => line.trim().split(/\s+/))
        .filter(Boolean);
      for (const id of ids) {
        try {
          execSync(`xdotool windowactivate ${id}`, { stdio: 'ignore', env });
          execSync(`xdotool windowsize ${id} ${width} ${height}`, {
            stdio: 'ignore',
            env,
          });
          execSync(`xdotool windowmove ${id} 0 0`, { stdio: 'ignore', env });
        } catch (_) {}
      }
      if (ids.length) return;
    } catch (_) {}
  }
}

function wmFullscreen() {
  const env = xEnv();
  const cmds = [
    'wmctrl -xr chromium.Chromium -b add,fullscreen',
    'wmctrl -xr Chromium.Chromium -b add,fullscreen',
    'wmctrl -xr Chromium -b add,fullscreen',
    'wmctrl -a "Chromium" -b add,fullscreen',
    'wmctrl -a "RetroCast" -b add,fullscreen',
  ];
  for (const c of cmds) {
    try {
      execSync(c, { stdio: 'ignore', env, timeout: 4000 });
      return;
    } catch (_) {}
  }
}

function forceFillDisplay(width, height) {
  wmExactGeometry(width, height);
  xdotoolFill(width, height);
  wmFullscreen();
}

async function forceFullscreen(page, width, height) {
  try {
    await page.evaluate(async () => {
      try {
        const el = document.fullscreenElement || document.documentElement;
        await el.requestFullscreen();
      } catch (_) {}
    });
  } catch (_) {}
  forceFillDisplay(width, height);
}

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

  // Persistent profile opens a real X11 window at launch. Plain launch() uses
  // --no-startup-window so kiosk/size often do not apply to the Playwright-driven window.
  const context = await chromium.launchPersistentContext(USER_DATA, {
    headless: false,
    executablePath: CHROMIUM,
    env: {
      ...process.env,
      PULSE_SINK: process.env.PULSE_SINK || 'retro_sink',
    },
    viewport: null,
    args: [
      `--window-size=${width},${height}`,
      '--window-position=0,0',
      '--start-fullscreen',
      '--no-first-run',
      '--disable-features=TranslateUI',
      '--kiosk',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
      '--ozone-platform=x11',
    ],
  });

  let page = context.pages()[0];
  if (!page) page = await context.newPage();

  const keepSizing = setInterval(() => {
    forceFillDisplay(width, height);
  }, 8000);
  setTimeout(() => clearInterval(keepSizing), 6 * 60 * 1000);

  await page.goto(targetUrl, {
    waitUntil: 'load',
    timeout: 180000,
  });

  await page.waitForTimeout(1500);
  forceFillDisplay(width, height);
  await page.waitForTimeout(2000);
  forceFillDisplay(width, height);
  await forceFullscreen(page, width, height);

  await clickStartRetrocast(page);

  await tryUnmute(page);

  await page.waitForTimeout(2000);
  forceFillDisplay(width, height);
  await forceFullscreen(page, width, height);

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
