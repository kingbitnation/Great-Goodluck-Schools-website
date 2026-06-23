FROM node:24

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (allow legacy peer deps for complex trees)
RUN npm set progress=false && npm install --legacy-peer-deps --no-audit --no-fund

# Copy source
COPY . .

# Generate Prisma client if schema exists
RUN npx prisma generate || true

# Expose port
EXPOSE 4000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Default command
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/backend/server.js"]
