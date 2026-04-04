#!/usr/bin/env bash
set -euo pipefail

: "${DISPLAY:=:99}"
: "${WIDTH:=1920}"
: "${HEIGHT:=1080}"
: "${DEPTH:=24}"
: "${FPS:=30}"
: "${LOCATION:=60601}"
: "${RTSP_URL:=rtsp://rtsp:8554/retro}"
: "${TARGET_URL:=https://weather.com/retro/}"

echo "Starting Xvfb on ${DISPLAY} at ${WIDTH}x${HEIGHT}x${DEPTH}"
Xvfb "${DISPLAY}" -screen 0 "${WIDTH}x${HEIGHT}x${DEPTH}" &

sleep 0.5

echo "Starting Fluxbox window manager"
fluxbox &

echo "Waiting for RTSP server..."
until nc -z rtsp 8554; do sleep 0.5; done

echo "Running automation to set location: ${LOCATION}"
node /app/retro_set_location.js &

ffmpeg \
  -f x11grab -video_size "${WIDTH}x${HEIGHT}" -framerate "${FPS}" -i "${DISPLAY}.0" \
  -vf "format=yuv420p" \
  -c:v libx264 -preset veryfast -tune zerolatency -g $((FPS * 2)) -keyint_min $((FPS * 2)) \
  -f rtsp -rtsp_transport tcp "${RTSP_URL}"
