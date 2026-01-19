# BrainScraper – for LOCAL only: docker build -f brainscraper/Dockerfile . from repo root
# with build context = brainscraper/ (e.g. docker build -f brainscraper/Dockerfile brainscraper).
# For RAILWAY: use Root Directory = brainscraper and this Dockerfile.
FROM node:20-slim
# Instant cache bust: Railway sets RAILWAY_GIT_COMMIT_SHA at build; new commit = full rebuild. Local: defaults to "local".
ARG RAILWAY_GIT_COMMIT_SHA=local
# Manual override: --build-arg PILOT_BUILD=$(date +%Y%m%d) to force rebuild
ARG PILOT_BUILD=20260119
RUN echo "cachebust rev=$RAILWAY_GIT_COMMIT_SHA pilot=$PILOT_BUILD"

WORKDIR /app

# Copy package files (context root = brainscraper/ when Root Directory = brainscraper)
COPY package.json ./
COPY package-lock.json* ./

# Install ALL dependencies (including dev for build). --legacy-peer-deps for React 19.
RUN npm install --legacy-peer-deps

# Copy application code (brainscraper/.dockerignore excludes node_modules, .next)
COPY . .

# Build the application (layer invalidated when COPY . . changes, e.g. page.tsx)
RUN npm run build

# Prune dev dependencies after build (keep only production)
RUN npm prune --production --legacy-peer-deps || true

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]