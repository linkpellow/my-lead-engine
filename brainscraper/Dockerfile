# BrainScraper: Next.js LinkedIn Lead Generation UI
# Railway Root Directory: brainscraper/
# Build context is set to brainscraper/ directory
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files (from brainscraper/ directory)
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for build)
# Use npm install instead of npm ci since lock file may be out of sync
# Use --legacy-peer-deps to handle React 19 compatibility with older packages
RUN npm install --legacy-peer-deps

# Copy application code (from brainscraper/ directory)
COPY . .

# Build the application
RUN npm run build

# Prune dev dependencies after build (keep only production)
RUN npm prune --production --legacy-peer-deps

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]