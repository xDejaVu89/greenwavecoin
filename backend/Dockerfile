# GreenWaveCoin Backend Coordinator — Production Dockerfile
# =============================================================
# Multi-stage build: compile TypeScript, then run lean production image.

# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools needed for better-sqlite3 native module + Python distutils
RUN apk add --no-cache python3 py3-setuptools make g++

# Install ALL dependencies (including devDeps for TypeScript compilation)
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


# ---- Production stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime tools for better-sqlite3 native rebuild
RUN apk add --no-cache python3 py3-setuptools make g++

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
