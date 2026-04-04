FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    xvfb \
    fluxbox \
    chromium \
    ffmpeg \
    xauth \
    ca-certificates \
    fonts-dejavu-core \
    nodejs \
    npm \
    netcat-openbsd \
    pulseaudio \
    pulseaudio-utils \
    dbus-x11 \
  && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

# PulseAudio refuses to run as root; run the stack as a normal user.
RUN useradd -m -u 1000 -s /bin/bash streamer \
  && mkdir -p /run/user/1000 \
  && chown streamer:streamer /run/user/1000

WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm ci --omit=dev

COPY retro_set_location.js /app/retro_set_location.js
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh \
  && chown -R streamer:streamer /app /home/streamer

USER streamer
ENV HOME=/home/streamer
ENV XDG_RUNTIME_DIR=/run/user/1000

CMD ["/app/start.sh"]
