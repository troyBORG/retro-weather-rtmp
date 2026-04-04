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
  // Do not call requestFullscreen() here — some SPAs treat it like a resize and reset the player.
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

/** Wake video overlays (many players only show mute after hover). */
async function nudgePlayerUi(page, width, height) {
  try {
    const v = page.locator('video').first();
    if (await v.count()) {
      await v.hover({ timeout: 3000 }).catch(() => {});
    }
  } catch (_) {}
  await page.mouse.move(Math.floor(width / 2), Math.floor(height * 0.85));
  await page.waitForTimeout(400);
  await page.mouse.move(Math.floor(width / 2), Math.floor(height / 2));
}

/** Try to unmute in-page audio so PulseAudio captures it (retries: controls often appear late). */
async function tryUnmute(page, width, height) {
  const initialMs = parseInt(process.env.UNMUTE_INITIAL_DELAY_MS || '14000', 10);
  const stepMs = parseInt(process.env.UNMUTE_RETRY_INTERVAL_MS || '7000', 10);
  const maxPasses = parseInt(process.env.UNMUTE_MAX_PASSES || '18', 10);

  // Only unmute-specific targets — broad "mute" / generic SVG buttons can hit close/restart and reset the session.
  const attempts = [
    () => page.getByRole('button', { name: /^unmute$/i }),
    () => page.getByRole('button', { name: /unmute/i }),
    () => page.locator('[aria-label*="unmute" i]'),
    () => page.locator('button[aria-label*="unmute" i]'),
    () => page.locator('[title*="unmute" i]'),
  ];

  await page.waitForTimeout(initialMs);

  for (let pass = 0; pass < maxPasses; pass++) {
    await nudgePlayerUi(page, width, height);

    for (const getLoc of attempts) {
      try {
        const loc = getLoc();
        if (await loc.count()) {
          const el = loc.first();
          if (await el.isVisible({ timeout: 3500 }).catch(() => false)) {
            await el.click({ timeout: 5000 });
            return;
          }
        }
      } catch (_) {}
    }

    await page.waitForTimeout(stepMs);
  }
}

(async () => {
  const targetUrl = process.env.TARGET_URL || 'https://weather.com/retro/';
  const width = parseInt(process.env.WIDTH || '1920', 10);
  const height = parseInt(process.env.HEIGHT || '1080', 10);

  // Persistent profile opens a real X11 window at launch. Plain launch() uses
  // --no-startup-window so kiosk/size often do not apply to the Playwright-driven window.
  const context = await chromium.launchPersistentContext(USER_DATA, {
    headless: false,
    executablePath: CHROMIUM,
    // Stops the "Chrome is being controlled by automated test software" banner (top of window).
    ignoreDefaultArgs: ['--enable-automation'],
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
      '--disable-infobars',
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

  await tryUnmute(page, width, height);

  await page.waitForTimeout(2000);
  forceFillDisplay(width, height);
  await forceFullscreen(page, width, height);

  // Do not type ZIP / press Enter in the page — that can navigate or restart RetroCast. LOCATION is still
  // used for timezone (start.sh) and you can set location in the UI by hand if needed.

  await page.waitForTimeout(3600 * 1000);
})();
