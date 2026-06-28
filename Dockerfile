FROM node:20-bookworm-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm set progress=false && npm ci --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY src/backend ./src/backend
COPY docs/openapi.yaml ./docs/openapi.yaml
COPY scripts ./scripts

RUN sed -i 's/\r$//' scripts/docker-entrypoint.sh scripts/wait-for-db.js scripts/seed-if-empty.js \
  && chmod +x scripts/docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4000/api/health/live',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["scripts/docker-entrypoint.sh"]
CMD ["node", "src/backend/server.js"]
