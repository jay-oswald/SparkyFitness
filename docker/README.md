# SparkyFitness Docker Configuration

This directory contains all Docker-related files for SparkyFitness deployment and development.

## Files

### Dockerfiles
- **`Dockerfile.frontend`** - Multi-stage build for React frontend with Nginx
- **`Dockerfile.backend`** - Multi-stage build for Node.js backend server

### Docker Compose Files
- **`docker-compose.prod.yml`** - Production deployment using pre-built images from DockerHub
- **`docker-compose.dev.yml`** - Local development with built images and volume mounts

### Configuration Files
- **`nginx.conf.template`** - Parameterized Nginx configuration template
- **`nginx.conf`** - Original static Nginx configuration (deprecated)
- **`docker-entrypoint.sh`** - Frontend container entrypoint script for environment variable substitution
- **`docker-helper.sh`** - Management script with built-in help and validation
- **`.env.example`** - Environment variables template file

## Docker Helper Script

The `docker-helper.sh` script provides a user-friendly interface to manage SparkyFitness Docker environments:

### Features
- **Built-in help system** - Run without arguments to see all options
- **Environment validation** - Prevents invalid environment/action combinations  
- **Descriptive actions** - Clear explanations of what each command does
- **Smart defaults** - Development environment includes live reloading
- **Status reporting** - Shows URLs and ports after startup
- **Cleanup tools** - Easy way to clean up Docker resources

### Available Commands

| Command | Description |
|---------|-------------|
| `up` | Start services (builds for dev, pulls for prod) |
| `down` | Stop and remove containers |
| `build` | Build/rebuild Docker images |
| `logs` | Show and follow container logs |
| `ps` | Show running container status |
| `clean` | Stop containers and clean up images/volumes |

### Environment Differences

| Feature | Development (`dev`) | Production (`prod`) |
|---------|-------------------|------------------|
| **Images** | Built from local source | Pre-built from DockerHub |
| **Ports** | Exposed (8080, 3010, 5432) | Internal only (3004 external) |
| **Volumes** | Source code mounted | Static build artifacts |
| **Reloading** | Live code changes | Requires rebuild |

## Usage

### Docker Helper Script (Recommended)
The easiest way to manage SparkyFitness Docker environments:

```bash
# Show help and available commands
./docker/docker-helper.sh

# Start development environment (with live code reloading)
./docker/docker-helper.sh dev up

# Start production environment (using DockerHub images)
./docker/docker-helper.sh prod up

# View logs
./docker/docker-helper.sh dev logs

# Stop services
./docker/docker-helper.sh dev down

# Clean up everything (containers, volumes, images)
./docker/docker-helper.sh dev clean
```

### Manual Docker Compose (Advanced)
For direct docker-compose usage:

```bash
# Production deployment
docker-compose -f docker/docker-compose.prod.yml up -d

# Local development
docker-compose -f docker/docker-compose.dev.yml up --build
```

### Environment Variables
Copy `docker/.env.example` to `.env` in the root directory and configure your settings. Key variables for Docker deployment:

#### Database
- `SPARKY_FITNESS_DB_NAME` - PostgreSQL database name
- `SPARKY_FITNESS_DB_USER` - Database username  
- `SPARKY_FITNESS_DB_PASSWORD` - Database password

#### Backend Configuration
- `SPARKY_FITNESS_SERVER_HOST` - Backend hostname (for frontend proxy)
- `SPARKY_FITNESS_SERVER_PORT` - Backend port (for frontend proxy)
- `SPARKY_FITNESS_FRONTEND_URL` - Frontend URL (for CORS)

#### Security
- `SPARKY_FITNESS_API_ENCRYPTION_KEY` - 64-character hex encryption key
- `JWT_SECRET` - JWT signing secret

## Development Features

The development docker-compose includes:
- **Volume mounts** for live code reloading
- **Exposed ports** for direct access (DB: 5432, Backend: 3010, Frontend: 8080)
- **Environment variable defaults** for quick setup
- **Source code mounting** for backend development

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│  (Nginx:80)     │────│  (Node.js:3010) │────│ (PostgreSQL)    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Network Communication
- Frontend proxies `/api/*` requests to backend via Nginx configuration
- Backend connects to database using service name `sparkyfitness-db`
- All services communicate over `sparkyfitness-network` bridge network

## Customization

### Frontend Environment Variables
The frontend container supports runtime configuration via environment variables:
- `SPARKY_FITNESS_SERVER_HOST` - Backend service hostname
- `SPARKY_FITNESS_SERVER_PORT` - Backend service port

These are substituted into the Nginx configuration at container startup.

### Volume Mounts (Development)
- Backend source code: `../SparkyFitnessServer:/app/SparkyFitnessServer`
- Node modules preserved: `/app/SparkyFitnessServer/node_modules`
- Database data: `../postgresql:/var/lib/postgresql/data`
