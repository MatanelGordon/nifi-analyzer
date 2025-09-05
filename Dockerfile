FROM node:24-bookworm-slim AS builder


# Install pnpm
RUN npm install -g pnpm

# Install system build deps required to compile native modules (better-sqlite3)
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
	   python3 \
	   make \
	   g++ \
	   build-essential \
	   libsqlite3-dev \
	   pkg-config \
	&& rm -rf /var/lib/apt/lists/*

# Make sure native modules are built from source inside the image
ENV npm_config_build_from_source=true

# Set working directory
WORKDIR /app

# Copy package configuration files
COPY .npmrc package.json pnpm-lock.yaml tsconfig.json ./

# Install dependencies and rebuild for correct architecture
RUN pnpm install
RUN npm rebuild better-sqlite3 sqlite3 --build-from-source

# Final stage - runtime with source code
FROM builder AS final

# Copy TypeScript source files
COPY src/ ./src/


# Create data directory
RUN mkdir -p /data

# Default command
CMD ["pnpm", "start"]