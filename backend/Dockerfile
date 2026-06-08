# GreenWaveCoin Backend Coordinator — Production Dockerfile
# =============================================================
# Multi-stage build: compile TypeScript, then run lean production image.

# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools needed for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


# ---- Production stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime tools for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy only what is needed
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
