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
: "${PULSE_SINK_NAME:=retro_sink}"

echo "Starting Xvfb on ${DISPLAY} at ${WIDTH}x${HEIGHT}x${DEPTH}"
Xvfb "${DISPLAY}" -screen 0 "${WIDTH}x${HEIGHT}x${DEPTH}" &

sleep 0.5

echo "Starting PulseAudio (null sink for browser → FFmpeg)"
if command -v dbus-launch >/dev/null; then
  eval "$(dbus-launch --sh-syntax)"
fi
pulseaudio -D --exit-idle-time=-1 --disallow-exit 2>/dev/null || true
sleep 1
if ! pactl info >/dev/null 2>&1; then
  echo "PulseAudio failed to start; continuing with video-only." >&2
  export AUDIO_AVAILABLE=0
else
  pactl load-module module-null-sink "sink_name=${PULSE_SINK_NAME}" \
    sink_properties=device.description=RetroSink 2>/dev/null || true
  pactl set-default-sink "${PULSE_SINK_NAME}" 2>/dev/null || true
  export PULSE_SINK="${PULSE_SINK_NAME}"
  export AUDIO_AVAILABLE=1
  echo "Audio capture from ${PULSE_SINK_NAME}.monitor"
fi

echo "Starting Fluxbox window manager"
fluxbox &

echo "Waiting for RTSP server..."
until nc -z rtsp 8554; do sleep 0.5; done

echo "Running automation to set location: ${LOCATION}"
node /app/retro_set_location.js &

if [[ "${AUDIO_AVAILABLE:-0}" == "1" ]]; then
  exec ffmpeg -y \
    -f x11grab -video_size "${WIDTH}x${HEIGHT}" -framerate "${FPS}" -thread_queue_size 1024 -i "${DISPLAY}.0" \
    -f pulse -thread_queue_size 1024 -i "${PULSE_SINK_NAME}.monitor" \
    -vf "format=yuv420p" \
    -c:v libx264 -preset veryfast -tune zerolatency -g $((FPS * 2)) -keyint_min $((FPS * 2)) \
    -c:a aac -b:a 160k -ar 48000 -ac 2 \
    -map 0:v -map 1:a \
    -f rtsp -rtsp_transport tcp "${RTSP_URL}"
else
  exec ffmpeg -y \
    -f x11grab -video_size "${WIDTH}x${HEIGHT}" -framerate "${FPS}" -thread_queue_size 1024 -i "${DISPLAY}.0" \
    -vf "format=yuv420p" \
    -c:v libx264 -preset veryfast -tune zerolatency -g $((FPS * 2)) -keyint_min $((FPS * 2)) \
    -f rtsp -rtsp_transport tcp "${RTSP_URL}"
fi
