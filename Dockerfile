# BrainScraper – use when brainscraper service Root Directory is EMPTY.
# Context = repo root. Set NO_CACHE=1 for first deploy, then remove.
FROM node:20-slim

WORKDIR /app

COPY brainscraper/package.json ./
COPY brainscraper/package-lock.json* ./

RUN npm install --legacy-peer-deps

COPY brainscraper/ .

RUN npm run build

RUN npm prune --production --legacy-peer-deps || true

EXPOSE 3000

CMD ["npm", "start"]
