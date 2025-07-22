# Docker Deployment Guide

SparkyFitness uses a comprehensive Docker setup with separate configurations for development and production environments.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│  (Nginx:80)     │────│  (Node.js:3010) │────│ (PostgreSQL)    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Docker Helper Script

The recommended way to manage SparkyFitness Docker environments is using the included helper script:

```bash
# Show all available commands and help
./docker/docker-helper.sh

# Start development environment
./docker/docker-helper.sh dev up

# Start production environment  
./docker/docker-helper.sh prod up

# View logs
./docker/docker-helper.sh dev logs

# Stop services
./docker/docker-helper.sh dev down

# Clean up everything
./docker/docker-helper.sh dev clean
```

### Available Commands

| Command | Description |
|---------|-------------|
| `up` | Start services (builds for dev, pulls for prod) |
| `down` | Stop and remove containers |
| `build` | Build/rebuild Docker images |
| `logs` | Show and follow container logs |
| `ps` | Show running container status |
| `clean` | Stop containers and clean up images/volumes |

## Environment Differences

| Feature | Development (`dev`) | Production (`prod`) |
|---------|-------------------|------------------|
| **Images** | Built from local source | Pre-built from DockerHub |
| **Ports** | Exposed (8080, 3010, 5432) | Internal only (3004 external) |
| **Volumes** | Source code mounted | Static build artifacts |
| **Reloading** | Live code changes | Requires rebuild |
| **Database** | Persistent volume | Persistent volume |

## Development Environment

Perfect for active development with live reloading:

```bash
# Start development stack
./docker/docker-helper.sh dev up

# Services available:
# - Frontend: http://localhost:8080 (live reload)
# - Backend: http://localhost:3010 (direct access)
# - Database: localhost:5432 (direct access)
```

### Development Features

- **Live Code Reloading:** Frontend and backend changes reflect immediately
- **Volume Mounts:** Source code is mounted for real-time updates
- **Exposed Ports:** Direct access to all services for debugging
- **Debug Mode:** Detailed logging and error information

## Production Environment

Optimized for production deployment:

```bash
# Start production stack
./docker/docker-helper.sh prod up

# Service available:
# - Application: http://localhost:3004 (nginx proxy)
```

### Production Features

- **Pre-built Images:** Fast deployment using DockerHub images
- **Optimized Builds:** Multi-stage builds for minimal image size
- **Nginx Proxy:** Single entry point with proper routing
- **Security:** Internal networking, minimal exposed ports

## Manual Docker Compose

For advanced users who prefer direct docker-compose usage:

```bash
# Production deployment
docker-compose -f docker/docker-compose.prod.yml up -d

# Development with live reloading
docker-compose -f docker/docker-compose.dev.yml up --build

# Stop services
docker-compose -f docker/docker-compose.dev.yml down

# View logs
docker-compose -f docker/docker-compose.dev.yml logs -f
```

## Configuration Files

The `docker/` directory contains all Docker-related files:

### Dockerfiles
- **`Dockerfile.frontend`** - Multi-stage React + Nginx build
- **`Dockerfile.backend`** - Multi-stage Node.js build

### Compose Files
- **`docker-compose.dev.yml`** - Development environment
- **`docker-compose.prod.yml`** - Production environment

### Configuration
- **`nginx.conf.template`** - Parameterized Nginx configuration
- **`docker-entrypoint.sh`** - Frontend entrypoint with variable substitution
- **`docker-helper.sh`** - Management script
- **`.env.example`** - Environment variable template

## Environment Variables

### Frontend Configuration

The frontend container supports runtime configuration:

```bash
# Backend service connection (injected into Nginx config)
SPARKY_FITNESS_SERVER_HOST=sparkyfitness-server
SPARKY_FITNESS_SERVER_PORT=3010
```

### Backend Configuration

```bash
# Database connection
SPARKY_FITNESS_DB_HOST=sparkyfitness-db
SPARKY_FITNESS_DB_PORT=5432
SPARKY_FITNESS_DB_NAME=sparkyfitness_db

# Security
SPARKY_FITNESS_API_ENCRYPTION_KEY=your_64_char_hex_key
JWT_SECRET=your_jwt_secret

# CORS
SPARKY_FITNESS_FRONTEND_URL=http://localhost:8080
```

## Networking

All services communicate over a custom bridge network:

```yaml
networks:
  sparkyfitness-network:
    driver: bridge
```

### Service Discovery

- Frontend → Backend: `http://sparkyfitness-server:3010`
- Backend → Database: `postgresql://sparkyfitness-db:5432`
- External → Frontend: `http://localhost:8080` (dev) or `http://localhost:3004` (prod)

## Data Persistence

### Database Volume

```yaml
volumes:
  - ./postgresql:/var/lib/postgresql/data  # Development
  - sparkyfitness_postgres_data:/var/lib/postgresql/data  # Production
```

### Development Volumes

```yaml
# Live code reloading
- ../SparkyFitnessServer:/app/SparkyFitnessServer
- /app/SparkyFitnessServer/node_modules  # Preserve installed packages
```

## Troubleshooting

### Common Issues

**Port Conflicts:**
```bash
# Check what's using ports
lsof -i :8080 :3010 :5432 :3004

# Stop conflicting services or change ports in .env
```

**Build Failures:**
```bash
# Clean build (removes cache)
./docker/docker-helper.sh dev build --no-cache

# Reset everything
./docker/docker-helper.sh dev clean
./docker/docker-helper.sh dev up
```

**Permission Issues:**
```bash
# Fix volume permissions (Linux/WSL)
sudo chown -R $USER:$USER ./postgresql
```

**Database Issues:**
```bash
# View database logs
./docker/docker-helper.sh dev logs sparkyfitness-db

# Reset database (DESTRUCTIVE!)
./docker/docker-helper.sh dev down
sudo rm -rf ./postgresql
./docker/docker-helper.sh dev up
```

### Debugging Tips

**View Logs:**
```bash
# All services
./docker/docker-helper.sh dev logs

# Specific service
./docker/docker-helper.sh dev logs sparkyfitness-frontend

# Follow logs in real-time
docker-compose -f docker/docker-compose.dev.yml logs -f
```

**Container Inspection:**
```bash
# List running containers
./docker/docker-helper.sh dev ps

# Execute commands in container
docker exec -it sparkyfitness-frontend-1 sh
docker exec -it sparkyfitness-server-1 sh
docker exec -it sparkyfitness-db-1 psql -U sparky -d sparkyfitness_db
```

## Custom Builds

### Building Specific Images

```bash
# Build only frontend
docker build -f docker/Dockerfile.frontend -t my-sparkyfitness-frontend .

# Build only backend  
docker build -f docker/Dockerfile.backend -t my-sparkyfitness-backend ./SparkyFitnessServer
```

### Using Custom Images

Edit the compose files to use your custom images:

```yaml
# In docker-compose.dev.yml
sparkyfitness-frontend:
  image: my-sparkyfitness-frontend:latest
  # Remove build section
```

## Performance Optimization

### Production Optimizations

- **Multi-stage builds** reduce final image size
- **Nginx compression** reduces bandwidth usage  
- **Static file serving** improves performance
- **Connection pooling** optimizes database connections

### Development Optimizations

- **Volume mounts** enable instant code changes
- **Preserved node_modules** speeds up container restarts
- **Direct port access** enables debugging tools

## Security Considerations

### Production Security

- Only port 3004 exposed externally
- Internal service communication over private network
- Environment variables for sensitive configuration
- Nginx proxy adds security headers

### Development Security

- All ports exposed for development convenience
- Use strong passwords even in development
- Rotate API keys regularly
- Never commit real credentials to version control
