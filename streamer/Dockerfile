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
  && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm ci --omit=dev

COPY retro_set_location.js /app/retro_set_location.js
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
