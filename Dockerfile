# FireHarmony — all-in-one image: static site + /api/hotspots FIRMS proxy.
# Build:  docker build -t fireharmony .
# Run:    docker run -p 3000:3000 -e FIRMS_MAP_KEY=your_key fireharmony
# (without FIRMS_MAP_KEY the app runs in demo mode with synthetic data)
FROM node:22-alpine

WORKDIR /app

# install server deps first for better layer caching
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --no-fund --no-audit

# site + server code
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# express serves the static site from /app and the API from /app/server
CMD ["node", "server/index.js"]
