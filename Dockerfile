# Multi-stage Dockerfile for NiFi Analyzer

# Builder stage - installs dependencies (use Debian slim so glibc is available for native modules)
FROM node:24-slim AS builder


# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package configuration files
COPY .npmrc package.json pnpm-lock.yaml tsconfig.json ./

# Install dependencies and rebuild for correct architecture
RUN pnpm install

# Final stage - runtime with source code
FROM builder AS final

# Copy TypeScript source files
COPY src/ ./src/


# Create data directory
RUN mkdir -p /data

# Default command
CMD ["pnpm", "start"]