# syntax=docker/dockerfile:1.4

# Stage 1: Install backend dependencies
FROM node:20-alpine AS backend_deps

WORKDIR /app/SparkyFitnessServer

COPY package.json package-lock.json ./
RUN npm install --production

# Stage 2: Final runtime image for backend
FROM node:20-alpine

# Set WORKDIR to the application directory
WORKDIR /app/SparkyFitnessServer

# Install necessary tools for runtime (curl, bash)
RUN apk add --no-cache bash curl nano

# Copy backend source code
COPY . .

# Copy node_modules from the build stage
COPY --from=backend_deps /app/SparkyFitnessServer/node_modules ./node_modules

# Expose backend port
EXPOSE 3010

# Set default environment variables for the backend (can be overridden at runtime)
ENV SPARKY_FITNESS_SERVER_PORT=3010
ENV LOG_LEVEL=INFO

# Command to run the backend
CMD ["node", "SparkyFitnessServer.js"]