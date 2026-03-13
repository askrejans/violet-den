# VioletDen — Single-container build for Home Assistant integration
#
# Builds the React frontend with Vite, then serves it alongside the
# Express backend in a single container. No nginx needed — HA or the
# user's existing reverse proxy handles TLS.
#
# Build:  docker build -f Dockerfile.ha -t violetden-ha .
# Run:    docker run -d --name violetden \
#           -p 4000:4000 \
#           -v violetden-data:/data \
#           -e HA_INTEGRATION=true \
#           -e HA_URL=http://homeassistant:8123 \
#           violetden-ha

# ── Stage 1: Build frontend ────────────────────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ── Stage 2: Production image ──────────────────────────────────────
FROM node:22-alpine
RUN apk add --no-cache openssl python3 make g++
WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev && \
    apk del python3 make g++

# Copy backend source
COPY backend/ .

# Copy built frontend into /app/dist
COPY --from=frontend-build /build/dist ./dist

EXPOSE 4000

ENV HA_INTEGRATION=true
ENV DATA_DIR=/data
ENV BACKEND_PORT=4000

CMD ["node", "index.js"]
