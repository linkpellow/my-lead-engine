# BrainScraper – use when brainscraper service Root Directory is EMPTY.
# Context = repo root. NO_CACHE=1 in [environments.production] forces --no-cache. RAILWAY_GIT_COMMIT_SHA busts on new commits.
FROM node:20-slim

ARG RAILWAY_GIT_COMMIT_SHA=local
RUN echo "cachebust rev=$RAILWAY_GIT_COMMIT_SHA"

WORKDIR /app

COPY brainscraper/package.json ./
COPY brainscraper/package-lock.json* ./

RUN npm install --legacy-peer-deps

COPY brainscraper/ .

RUN npm run build

RUN npm prune --production --legacy-peer-deps || true

EXPOSE 3000

CMD ["npm", "start"]
