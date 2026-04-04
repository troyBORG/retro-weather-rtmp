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
- **Resolution** (`WIDTH`, `HEIGHT`, `DEPTH`, `FPS`) is set in **`docker-compose.yml`** (committed). Those values control the virtual display size, FFmpeg capture size, and the Chromium window—the streamer uses kiosk/fullscreen flags, Fluxbox rules for `Chromium`, and `wmctrl` so the browser window should match that size edge-to-edge.

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

MediaMTX publishes the stream at path **`retro`**. The URL is always:

```text
rtsp://<docker-host-ip>:8554/retro
```

**On the Docker host itself** (SSH or local terminal):

```bash
ffplay -rtsp_transport tcp rtsp://127.0.0.1:8554/retro
```

**From another PC, phone, or TV on your LAN**, use the host’s LAN IP (example: **`192.0.2.10`**):

```bash
ffplay -rtsp_transport tcp rtsp://192.0.2.10:8554/retro
```

**VLC:** *Media → Open Network Stream…* (or Ctrl+N) → paste `rtsp://192.0.2.10:8554/retro` → under *Show more options* you can prefer TCP if playback fails.

**Firewall:** port **8554/tcp** must be allowed on the Docker host (and on any router path if you ever forward it). `docker-compose.yml` maps host `8554` → MediaMTX.

If nothing connects, confirm the stack is up (`docker compose ps`) and that MediaMTX logs show publishing to path `retro` (see MediaMTX container logs).

**Video and audio:** The streamer muxes **H.264** from the virtual display and **AAC** from a PulseAudio null sink (what Chromium plays). Automation tries to click **START RETROCAST** if it is still visible, then looks for an **unmute** control—if the page auto-starts, the start step is skipped. If PulseAudio fails to start inside the container, the entrypoint falls back to **video only** (check streamer logs for `PulseAudio failed`).

## Compliance

Capturing and redistributing third-party sites may conflict with their terms of use. Use only where you have rights or permission, or substitute your own page/API-backed UI.
