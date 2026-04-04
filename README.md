# retro-weather-rtmp

Docker Compose stack: **MediaMTX** (RTSP) plus a **streamer** container (Xvfb, Chromium, Playwright, FFmpeg) that captures a browser session and publishes an H.264 stream over RTSP/TCP.

## First-time setup (new machine / first install)

Use **`git clone`**, not `git pull`—there is nothing to pull until the repo exists on disk.

```bash
git clone https://github.com/troyBORG/retro-weather-rtmp.git
cd retro-weather-rtmp
cp .env.example .env
nano .env   # set LOCATION to your ZIP (or edit with any editor)
docker compose up -d --build
```

- **`LOCATION`** lives only in **`.env`**, which is gitignored, so your ZIP is not pushed to Git.
- **Resolution** (`WIDTH`, `HEIGHT`, `DEPTH`, `FPS`) is set in **`docker-compose.yml`** (committed). Those values control the virtual display size, FFmpeg capture size, and the Chromium window/viewport—keep them consistent with each other.

Optional: Compose may mention baking builds (`COMPOSE_BAKE=true`). You can ignore that or enable it if you want.

## Updating an existing clone

After you already have the repo folder and remote configured:

```bash
cd retro-weather-rtmp
git pull
docker compose up -d --build
```

- If this is the first time you add **`.env`** on this machine: `cp .env.example .env` and set **`LOCATION`**.
- Rebuild when **`streamer/`** or **`docker-compose.yml`** changes; a config-only tweak to **`.env`** may only need `docker compose up -d` (no `--build`).

## Watching the stream

Example (RTSP over TCP):

```bash
ffplay -rtsp_transport tcp rtsp://127.0.0.1:8554/retro
```

Use your server’s IP from another machine if RTSP port **8554** is reachable.

## Compliance

Capturing and redistributing third-party sites may conflict with their terms of use. Use only where you have rights or permission, or substitute your own page/API-backed UI.
