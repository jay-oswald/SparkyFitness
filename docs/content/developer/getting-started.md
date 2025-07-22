# Getting Started with SparkyFitness

SparkyFitness is a comprehensive fitness tracking application built with React 18 + TypeScript + Vite frontend and Node.js/Express backend, using PostgreSQL with Row Level Security.

## Quick Start

The fastest way to get SparkyFitness running is using our Docker helper script:

```bash
# Clone the repository
git clone https://github.com/CodeWithCJ/SparkyFitness.git
cd SparkyFitness

# Copy environment template
cp docker/.env.example .env

# Start development environment (with live reloading)
./docker/docker-helper.sh dev up

# Access the application at http://localhost:8080
```

## Prerequisites

### For Docker Deployment (Recommended)
- **Docker & Docker Compose** - For containerized deployment
- **Git** - For cloning the repository

### For Local Development
- **Node.js 18+** and **npm** - For running the application locally
- **PostgreSQL 15+** - Database server
- **Git** - For version control

## Installation Options

Choose the deployment method that best fits your needs:

### 🚀 Production Deployment

For a production setup using pre-built DockerHub images:

1. **Configure Environment Variables:**
   ```bash
   # Copy and edit the environment template
   cp docker/.env.example .env
   
   # Key variables to configure:
   # SPARKY_FITNESS_ADMIN_EMAIL=your-admin@email.com
   # SPARKY_FITNESS_API_ENCRYPTION_KEY=your-64-char-hex-key
   # JWT_SECRET=your-jwt-secret
   ```

2. **Start Production Services:**
   ```bash
   ./docker/docker-helper.sh prod up
   ```

3. **Access Application:**
   - Frontend: `http://localhost:3004`

### 🔧 Development Setup

For local development with live reloading:

1. **Configure Environment:**
   ```bash
   cp docker/.env.example .env
   # Edit .env with your development settings
   ```

2. **Start Development Environment:**
   ```bash
   # Start all services with live reloading
   ./docker/docker-helper.sh dev up
   ```

3. **Access Services:**
   - Frontend: `http://localhost:8080` (live reloading)
   - Backend API: `http://localhost:3010`
   - Database: `localhost:5432`

### 🖥️ Local Development (No Docker)

For pure local development without containers:

1. **Setup Environment:**
   ```bash
   # Copy environment file
   cp docker/.env.example .env
   
   # Install dependencies
   npm install
   cd SparkyFitnessServer && npm install && cd ..
   ```

2. **Start Services:**
   ```bash
   # Terminal 1: Start backend
   npm run start-backend
   
   # Terminal 2: Start frontend
   npm run dev
   ```

3. **Access Application:**
   - Frontend: `http://localhost:8080`
   - Backend: `http://localhost:3010`

## Environment Configuration

### Required Variables

Copy `docker/.env.example` to `.env` and configure these essential variables:

```bash
# Database Configuration
SPARKY_FITNESS_DB_NAME=sparkyfitness_db
SPARKY_FITNESS_DB_USER=sparky
SPARKY_FITNESS_DB_PASSWORD=your_secure_password

# Backend Configuration
SPARKY_FITNESS_SERVER_HOST=sparkyfitness-server
SPARKY_FITNESS_SERVER_PORT=3010
SPARKY_FITNESS_FRONTEND_URL=http://localhost:8080

# Security (Generate secure keys!)
SPARKY_FITNESS_API_ENCRYPTION_KEY=your_64_character_hex_encryption_key
JWT_SECRET=your_jwt_signing_secret

# Admin Setup
SPARKY_FITNESS_ADMIN_EMAIL=admin@example.com
SPARKY_FITNESS_FORCE_EMAIL_LOGIN=true
```

### Generating Secure Keys

```bash
# Generate encryption key (64-char hex)
openssl rand -hex 32

# Generate JWT secret
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## First Time Setup

After starting the application:

1. **Create Admin Account:**
   - Register with the email specified in `SPARKY_FITNESS_ADMIN_EMAIL`
   - Admin privileges will be automatically granted

2. **Configure Application:**
   - Navigate to Settings → Integrations
   - Add food providers (OpenFoodFacts is free)
   - Configure AI providers if using the chatbot

3. **Set User Preferences:**
   - Update profile information
   - Set fitness goals
   - Configure units and preferences

## Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Check what's using the port
lsof -i :8080
lsof -i :3010

# Stop conflicting services or change ports in .env
```

**Database Connection Issues:**
```bash
# Check database logs
./docker/docker-helper.sh dev logs sparkyfitness-db

# Reset database
./docker/docker-helper.sh dev down
./docker/docker-helper.sh dev clean
./docker/docker-helper.sh dev up
```

**Build Issues:**
```bash
# Clean rebuild
./docker/docker-helper.sh dev build --no-cache
```

### Getting Help

- **Discord Community:** https://discord.gg/vcnMT5cPEA
- **GitHub Discussions:** Post questions and issues
- **Documentation:** Comprehensive guides in this docs site
