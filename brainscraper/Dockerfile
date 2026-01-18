# BrainScraper – for LOCAL only: docker build -f brainscraper/Dockerfile . from repo root
# with build context = brainscraper/ (e.g. docker build -f brainscraper/Dockerfile brainscraper).
# For RAILWAY: use Root Directory = EMPTY and /Dockerfile at repo root (see /Dockerfile).
FROM node:20-slim

WORKDIR /app

# Copy package files (context root = brainscraper/ when Root Directory = brainscraper)
COPY package.json ./
COPY package-lock.json* ./

# Install ALL dependencies (including dev for build). --legacy-peer-deps for React 19.
RUN npm install --legacy-peer-deps

# Copy application code (brainscraper/.dockerignore excludes node_modules, .next)
COPY . .

# Build the application
RUN npm run build

# Prune dev dependencies after build (keep only production)
RUN npm prune --production --legacy-peer-deps || true

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]