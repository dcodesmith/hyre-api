# Dockerfile - Multi-stage build for hyre-api-nestjs
# Stage 1: Build stage
FROM node:18-alpine AS builder

WORKDIR /app

RUN corepack enable pnpm

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install ALL dependencies (including dev dependencies for building)
RUN pnpm install --frozen-lockfile

# Copy source code and configs
COPY . .

# Generate Prisma client and build TypeScript
RUN npx prisma generate && pnpm build

# Stage 2: Production stage
FROM node:18-alpine AS production

WORKDIR /app

RUN corepack enable pnpm && apk add --no-cache curl

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy Prisma schema and generate client (needed at runtime)
COPY prisma ./prisma
RUN pnpm dlx prisma generate
# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set production environment
ENV NODE_ENV=production

# Expose health check port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health > /dev/null || exit 1


# Run the worker
CMD ["pnpm", "start"]

