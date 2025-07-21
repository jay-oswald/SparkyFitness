# Development Workflow

This guide covers the development workflow, coding standards, and contribution process for SparkyFitness.

## Architecture Overview

SparkyFitness follows a full-stack architecture:

- **Frontend**: React 18 + TypeScript + Vite (`src/`)
- **Backend**: Node.js/Express (`SparkyFitnessServer/`)
- **Database**: PostgreSQL with Row Level Security (RLS)
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: React Context + TanStack Query
- **AI**: Multi-provider support (OpenAI, Anthropic, Google, etc.)

## Development Setup

### Quick Start

```bash
# Clone and setup
git clone https://github.com/CodeWithCJ/SparkyFitness.git
cd SparkyFitness

# Copy environment template
cp docker/.env.example .env

# Start development environment
./docker/docker-helper.sh dev up

# Access application at http://localhost:8080
```

### Development Commands

```bash
# Frontend development server (port 8080)
npm run dev

# Backend server (port 3010)  
npm run start-backend

# Docker development (local builds)
./docker/docker-helper.sh dev up

# Docker production (DockerHub images)
./docker/docker-helper.sh prod up
```

## Project Structure

```
SparkyFitness/
├── src/                          # Frontend React application
│   ├── components/               # Reusable UI components
│   ├── contexts/                 # React Context providers
│   ├── hooks/                    # Custom React hooks
│   ├── pages/                    # Page-level components
│   ├── services/                 # API service layer
│   └── utils/                    # Shared utilities
├── SparkyFitnessServer/          # Backend Node.js application
│   ├── models/                   # Repository pattern (database layer)
│   ├── routes/                   # Express route handlers
│   ├── integrations/             # External API integrations
│   ├── ai/                       # AI provider configurations
│   ├── middleware/               # Express middleware
│   └── utils/                    # Backend utilities
├── docker/                       # Docker configuration files
└── docs/                         # Documentation site (Nuxt Content)
```

## Key Development Patterns

### Repository Pattern (Backend)

All database operations use the repository pattern in `SparkyFitnessServer/models/`:

```javascript
// Example: userRepository.js
const pool = require('../db/connection');

async function createUser(userId, email, hashedPassword, full_name) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Multiple related inserts in transaction
    const result = await client.query(
      'INSERT INTO users (id, email, password_hash, full_name) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, email, hashedPassword, full_name]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Frontend Context Providers

Key contexts in `src/contexts/`:

- **PreferencesContext**: User settings, goals, theme, AI provider config
- **ChatbotVisibilityContext**: AI assistant state management

```typescript
// Example context usage
const { preferences, updatePreferences } = usePreferences();
const { isVisible, toggleChatbot } = useChatbotVisibility();
```

### External Provider Integration

Modular integration system in `SparkyFitnessServer/integrations/`:

- **Food providers**: OpenFoodFacts, Nutritionix, FatSecret
- **Exercise data**: Wger integration
- **Health data**: Apple Health integration
- **Encryption**: All API keys encrypted at rest using `security/encryption.js`

## Database Conventions

### Schema Patterns

- **UUID primary keys** for all tables (`gen_random_uuid()`)
- **Audit fields**: `created_at`, `updated_at` on all tables
- **RLS policies**: Users only access their own data
- **Transaction patterns**: Multi-table operations wrapped in transactions

### Migration Strategy

- **Auto-migrations**: `utils/dbMigrations.js` runs on server startup
- **Version tracking**: Migrations applied based on version numbers
- **Schema changes**: Always backward compatible during development

## API Patterns

### Response Format

- **Success**: JSON data directly
- **Error**: `{ error: "message" }` with appropriate HTTP status
- **Auth**: JWT tokens in Authorization header
- **CORS**: Configured for frontend URL in environment

### Error Handling

Consistent error patterns across integrations:

```javascript
try {
  const response = await fetch(searchUrl, { method: 'GET' });
  if (!response.ok) {
    const errorText = await response.text();
    log('error', "API error:", errorText);
    throw new Error(`API error: ${errorText}`);
  }
  return await response.json();
} catch (error) {
  log('error', `Error with query "${query}":`, error);
  throw error;
}
```

## AI Integration

### Multi-Provider Support

```javascript
// SparkyFitnessServer/ai/config.js
function getDefaultModel(serviceType) {
  switch (serviceType) {
    case 'openai': return 'gpt-4o-mini';
    case 'anthropic': return 'claude-3-5-sonnet-20241022';
    case 'google': return 'gemini-pro';
    // ...
  }
}
```

### Chat System Architecture

- **Backend**: `routes/chatRoutes.js` handles AI provider routing
- **Frontend**: `DraggableChatbotButton` component for UI
- **Storage**: Chat history with metadata in PostgreSQL
- **Capabilities**: Food logging, image analysis, exercise tracking, measurements

## Development Workflow

### 1. Environment Setup

```bash
# Copy environment template
cp docker/.env.example .env

# Generate secure keys
openssl rand -hex 32  # For SPARKY_FITNESS_API_ENCRYPTION_KEY
openssl rand -base64 32  # For JWT_SECRET
```

### 2. Start Development Environment

```bash
# Option 1: Docker (recommended)
./docker/docker-helper.sh dev up

# Option 2: Local development
npm run start-backend  # Terminal 1
npm run dev            # Terminal 2
```

### 3. Make Changes

- **Frontend changes**: Automatically reload at `http://localhost:8080`
- **Backend changes**: Restart backend service or use nodemon
- **Database changes**: Add migrations to `SparkyFitnessServer/db/migrations/`

### 4. Testing

```bash
# Run frontend tests
npm test

# Run backend tests
cd SparkyFitnessServer && npm test

# Integration tests
npm run test:integration
```

### 5. Code Quality

```bash
# Lint frontend code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

## Contribution Guidelines

### Before Contributing

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** from `main`
4. **Set up development environment** following this guide

### Making Changes

1. **Follow existing patterns** in the codebase
2. **Add tests** for new functionality
3. **Update documentation** as needed
4. **Use descriptive commit messages**

### Submitting Changes

1. **Push to your fork** on GitHub
2. **Create a Pull Request** against the `main` branch
3. **Fill out the PR template** with details
4. **Respond to review feedback** promptly

### Code Standards

#### Frontend (TypeScript/React)

```typescript
// Use TypeScript interfaces
interface UserPreferences {
  theme: 'light' | 'dark';
  units: 'metric' | 'imperial';
  aiProvider?: string;
}

// Use proper component patterns
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  const [state, setState] = useState<string>('');
  
  return (
    <div className="p-4 rounded-lg bg-background">
      {/* Component content */}
    </div>
  );
};
```

#### Backend (Node.js)

```javascript
// Use async/await consistently
async function createUser(userData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Database operations
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Use proper error handling
app.use((error, req, res, next) => {
  log('error', 'Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});
```

## Debugging

### Frontend Debugging

- **React Developer Tools**: Browser extension for component inspection
- **Browser DevTools**: Network, console, and source debugging
- **Vite HMR**: Hot module replacement for instant updates

### Backend Debugging

```bash
# View backend logs
./docker/docker-helper.sh dev logs sparkyfitness-server-new

# Debug with Node.js inspector
node --inspect SparkyFitnessServer.js

# Database debugging
docker exec -it sparkyfitness-db-1 psql -U sparky -d sparkyfitness_db
```

### Performance Profiling

```bash
# Frontend bundle analysis
npm run build:analyze

# Backend memory/CPU profiling
node --prof SparkyFitnessServer.js
```

## Deployment

### Development Deployment

```bash
# Start development stack
./docker/docker-helper.sh dev up
```

### Production Deployment

```bash
# Start production stack
./docker/docker-helper.sh prod up
```

### Custom Deployment

- **Docker Hub**: Pre-built images available
- **Manual deployment**: Build and deploy custom images
- **Environment variables**: Configure for your infrastructure

## Resources

### Key Files for Understanding

- **Server entry**: `SparkyFitnessServer/SparkyFitnessServer.js`
- **Database schema**: [Database Schema](../database-schema)
- **App overview**: [App Overview](../app-overview)
- **Frontend entry**: `src/App.tsx`

### External Documentation

- **React**: https://react.dev/
- **TypeScript**: https://www.typescriptlang.org/
- **Express**: https://expressjs.com/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **Docker**: https://docs.docker.com/

### Community

- **Discord**: https://discord.gg/vcnMT5cPEA
- **GitHub Discussions**: Project discussions and Q&A
- **Issues**: Bug reports and feature requests
