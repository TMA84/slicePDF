# --- Build stage ---
FROM node:22-slim AS build

WORKDIR /app

# Install build dependencies for node-canvas
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

RUN npm ci

COPY client/ client/
COPY server/ server/

# Build the frontend
RUN npm run build -w client

# --- Production stage ---
FROM node:22-slim

WORKDIR /app

# Runtime dependencies for node-canvas + pdfjs-dist
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json server/

# Install production dependencies only
RUN npm ci --workspace=server --omit=dev && npm cache clean --force

# Copy server source (runs via tsx)
COPY server/ server/

# Copy built frontend
COPY --from=build /app/client/dist client/dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npx", "tsx", "server/src/index.ts"]
