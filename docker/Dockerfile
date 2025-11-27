# Multi-stage Dockerfile for ChurchLink
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /frontend

# Copy frontend package files
COPY frontend/web/churchlink/package.json frontend/web/churchlink/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source code
COPY frontend/web/churchlink/ ./

# Build frontend (outputs to dist/)
RUN pnpm run build

# Stage 2: Python backend with built frontend
FROM ghcr.io/astral-sh/uv:debian-slim

WORKDIR /app

# Copy backend code
COPY backend/ ./

# Copy built frontend to expected location
# Backend expects: ../frontend/web/churchlink/dist/
COPY --from=frontend-builder /frontend/dist ../frontend/web/churchlink/dist

# Expose backend port
EXPOSE 8000

# Run in production mode
CMD ["uv", "run", "main.py", "production"]
