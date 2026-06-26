# Production image for the Beit Index server (serves the SPA + /api).
#
# Includes Chromium so Puppeteer can render report PDFs, plus Arabic fonts so
# the RTL reports render correctly (without these, Arabic text shows as boxes).
FROM node:20-bookworm-slim

# Chromium + the libraries/fonts it needs to render the Arabic reports.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      fonts-noto-core \
      fonts-kacst \
      fonts-arabeyes \
  && rm -rf /var/lib/apt/lists/*

# Puppeteer (puppeteer-core) launches this binary; getChromePath() reads it.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

# Install all deps (build needs vite/esbuild), then build, then drop dev deps.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/server.cjs"]
