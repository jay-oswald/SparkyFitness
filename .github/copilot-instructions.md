# SparkyFitness AI Coding Agent Instructions

## Architecture Overview

**Full-stack fitness tracking application** - self-hosted alternative to MyFitnessPal with AI-powered nutrition assistance.

- **Frontend**: React 18 + TypeScript + Vite (`src/`)
- **Backend**: Node.js/Express (`SparkyFitnessServer/`)
- **Database**: PostgreSQL with Row Level Security (RLS)
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: React Context + TanStack Query
- **AI**: Multi-provider support (OpenAI, Anthropic, Google, etc.)

## Development Workflow

### Running the Application
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

### Key Configuration Files
- **Vite config** (`vite.config.ts`): API proxy setup (`/api` → `localhost:3010`)
- **Environment**: Root `.env` file (loaded by backend at `path.resolve(__dirname, '../.env')`)
- **Docker**: `docker/` directory contains all Docker-related files
  - `docker-compose.dev.yml` - Local development builds
  - `docker-compose.prod.yml` - Production DockerHub images
  - `docker-helper.sh` - Management script for Docker operations

## Critical Architecture Patterns

### Repository Pattern (Backend)
All database operations use repository pattern in `SparkyFitnessServer/models/`:
```javascript
// Example: userRepository.js
const pool = require('../db/connection');

async function createUser(userId, email, hashedPassword, full_name) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Multiple related inserts in transaction
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### External Provider Integration
Modular integration system in `SparkyFitnessServer/integrations/`:
- **Food providers**: OpenFoodFacts, Nutritionix, FatSecret
- **Exercise data**: Wger integration
- **Health data**: Apple Health integration
- **Encryption**: All API keys encrypted at rest using `security/encryption.js`

### Frontend Context Providers
Key contexts in `src/contexts/`:
- **PreferencesContext**: User settings, goals, theme, AI provider config
- **ChatbotVisibilityContext**: AI assistant state management

### Database Schema Conventions
- **UUID primary keys** for all tables (`gen_random_uuid()`)
- **Audit fields**: `created_at`, `updated_at` on all tables
- **RLS policies**: Users only access their own data
- **Transaction patterns**: Multi-table operations wrapped in transactions

## AI Integration Patterns

### Multi-Provider AI Support
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

## Data Flow Patterns

### Meal Planning System
1. **Templates** (`meal_plan_templates`) → **Scheduled Plans** (`meal_plans`) → **Food Diary Entries** (`food_diary`)
2. Complex meal expansion logic in `mealPlanTemplateRepository.js`
3. Date-range planning support with single-day granularity

### Family Access Control
- **Granular permissions**: `calorie`, `checkin`, `reports`, `food_list`
- **RLS enforcement**: Database-level security policies
- **Access patterns**: `familyAccessRepository.js` manages relationship permissions

### External API Error Handling
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

## Development Conventions

### API Response Patterns
- **Success**: JSON data directly
- **Error**: `{ error: "message" }` with appropriate HTTP status
- **Auth**: JWT tokens in Authorization header
- **CORS**: Configured for frontend URL in environment

### Database Migration Strategy
- **Auto-migrations**: `utils/dbMigrations.js` runs on server startup
- **Version tracking**: Migrations applied based on version numbers
- **Schema changes**: Always backward compatible during development

### Component Architecture
- **shadcn/ui** for base components
- **Custom components** in `src/components/`
- **Page-level** components in `src/pages/`
- **Shared utilities** in `src/utils/`

### Environment-Specific Behavior
- **Development**: Vite proxy, hot reload, debug logging
- **Docker**: Production builds, environment variable injection
- **Database**: Connection pooling, transaction management

## Key Files for Understanding
- **Server entry**: `SparkyFitnessServer/SparkyFitnessServer.js` (route registration, middleware setup)
- **Database schema**: `docs/content/database-schema.md` (comprehensive table documentation)
- **App overview**: `docs/content/app-overview.md` (feature documentation)
- **Frontend entry**: `src/App.tsx` (context providers, query client setup)
